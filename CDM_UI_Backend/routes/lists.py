from fastapi import APIRouter, HTTPException, status, Body, UploadFile, File
from typing import List, Dict, Any, Optional
import uuid
import re
from pydantic import BaseModel
from neo4j import WRITE_ACCESS
from db import get_driver
from schema import CSVUploadResponse

router = APIRouter()

class ListValueRequest(BaseModel):
    id: Optional[str] = None
    value: str

class TieredListRequest(BaseModel):
    id: Optional[str] = None
    set: str
    grouping: str
    list: str
    listId: str  # ID of the tiered list node

class ListCreateRequest(BaseModel):
    sector: str  # Can be "ALL" or comma-separated values
    domain: str  # Can be "ALL" or comma-separated values
    country: str  # Can be "ALL" or comma-separated values
    set: str
    grouping: str
    list: str
    format: Optional[str] = ""
    source: Optional[str] = ""
    upkeep: Optional[str] = ""
    graph: Optional[str] = ""
    origin: Optional[str] = ""
    status: Optional[str] = "Active"
    listValuesList: Optional[List[ListValueRequest]] = []
    tieredListsList: Optional[List[TieredListRequest]] = []
    tieredListValues: Optional[Dict[str, List[List[str]]]] = None  # Dict mapping tier 1 value to list of tiered value arrays
    variationsList: Optional[List[dict]] = None  # List of variations to create for the list

class ListUpdateRequest(BaseModel):
    sector: Optional[str] = None
    domain: Optional[str] = None
    country: Optional[str] = None
    set: Optional[str] = None
    grouping: Optional[str] = None
    list: Optional[str] = None
    format: Optional[str] = None
    source: Optional[str] = None
    upkeep: Optional[str] = None
    graph: Optional[str] = None
    origin: Optional[str] = None
    status: Optional[str] = None
    listValuesList: Optional[List[ListValueRequest]] = None
    tieredListsList: Optional[List[TieredListRequest]] = None
    tieredListValues: Optional[Dict[str, List[List[str]]]] = None  # Dict mapping tier 1 value to list of tiered value arrays
    variationsList: Optional[List[dict]] = None  # List of variations to append to the list
    listType: Optional[str] = None  # 'Single' or 'Multi-Level'
    numberOfLevels: Optional[int] = None  # Number of tiers (2-10)
    tierNames: Optional[List[str]] = None  # Names of tier lists (e.g., ['State', 'City'])

async def create_list_driver_relationships(session, list_id: str, sector_str: str, domain_str: str, country_str: str):
    """
    Create driver relationships for a list based on sector, domain, and country.
    Creates IS_RELEVANT_TO relationships from driver nodes to the list.
    """
    try:
        print(f"Creating driver relationships for list {list_id} with sector={sector_str}, domain={domain_str}, country={country_str}")
        
        # Delete existing driver relationships
        session.run("""
            MATCH (l:List {id: $list_id})
            MATCH (s:Sector)-[r:IS_RELEVANT_TO]->(l)
            DELETE r
        """, list_id=list_id)
        session.run("""
            MATCH (l:List {id: $list_id})
            MATCH (d:Domain)-[r:IS_RELEVANT_TO]->(l)
            DELETE r
        """, list_id=list_id)
        session.run("""
            MATCH (l:List {id: $list_id})
            MATCH (c:Country)-[r:IS_RELEVANT_TO]->(l)
            DELETE r
        """, list_id=list_id)
        
        # Handle Sector relationships
        if sector_str == "ALL":
            result = session.run("""
                MATCH (s:Sector)
                MATCH (l:List {id: $list_id})
                WITH s, l
                MERGE (s)-[:IS_RELEVANT_TO]->(l)
                RETURN count(s) as count
            """, list_id=list_id)
            record = result.single()
            count = record["count"] if record else 0
            print(f"Created {count} Sector relationships (ALL)")
        else:
            sectors = [s.strip() for s in sector_str.split(',')]
            for sector in sectors:
                if sector and sector != "None":
                    result = session.run("""
                        MERGE (s:Sector {name: $sector})
                        WITH s
                        MATCH (l:List {id: $list_id})
                        MERGE (s)-[:IS_RELEVANT_TO]->(l)
                        RETURN s.name as sector
                    """, sector=sector, list_id=list_id)
                    record = result.single()
                    if record:
                        print(f"Created IS_RELEVANT_TO relationship: Sector({record['sector']}) -> List({list_id})")
        
        # Handle Domain relationships
        if domain_str == "ALL":
            result = session.run("""
                MATCH (d:Domain)
                MATCH (l:List {id: $list_id})
                WITH d, l
                MERGE (d)-[:IS_RELEVANT_TO]->(l)
                RETURN count(d) as count
            """, list_id=list_id)
            record = result.single()
            count = record["count"] if record else 0
            print(f"Created {count} Domain relationships (ALL)")
        else:
            domains = [d.strip() for d in domain_str.split(',')]
            for domain in domains:
                if domain and domain != "None":
                    result = session.run("""
                        MERGE (d:Domain {name: $domain})
                        WITH d
                        MATCH (l:List {id: $list_id})
                        MERGE (d)-[:IS_RELEVANT_TO]->(l)
                        RETURN d.name as domain
                    """, domain=domain, list_id=list_id)
                    record = result.single()
                    if record:
                        print(f"Created IS_RELEVANT_TO relationship: Domain({record['domain']}) -> List({list_id})")
        
        # Handle Country relationships
        if country_str == "ALL":
            result = session.run("""
                MATCH (c:Country)
                MATCH (l:List {id: $list_id})
                WITH c, l
                MERGE (c)-[:IS_RELEVANT_TO]->(l)
                RETURN count(c) as count
            """, list_id=list_id)
            record = result.single()
            count = record["count"] if record else 0
            print(f"Created {count} Country relationships (ALL)")
        else:
            countries = [c.strip() for c in country_str.split(',')]
            for country in countries:
                if country and country != "None":
                    result = session.run("""
                        MERGE (c:Country {name: $country})
                        WITH c
                        MATCH (l:List {id: $list_id})
                        MERGE (c)-[:IS_RELEVANT_TO]->(l)
                        RETURN c.name as country
                    """, country=country, list_id=list_id)
                    record = result.single()
                    if record:
                        print(f"Created IS_RELEVANT_TO relationship: Country({record['country']}) -> List({list_id})")
        
    except Exception as e:
        print(f"Error creating driver relationships for list {list_id}: {e}")
        raise

async def create_list_values(session, list_id: str, list_values: List[Any], replace: bool = False):
    """
    Create list value nodes and HAS_LIST_VALUE relationships from List to ListValue nodes.
    Prevents duplicate values within the same list (case-insensitive).
    
    Args:
        session: Neo4j session
        list_id: ID of the list
        list_values: List of dicts with 'value' key
        replace: If True, replace all existing list values. If False, append only new values.
    """
    try:
        print(f"Creating list values for list {list_id} (replace={replace})")
        
        # If replacing, delete all existing relationships first
        if replace:
            session.run("""
                MATCH (l:List {id: $list_id})-[r:HAS_LIST_VALUE]->(lv:ListValue)
                DELETE r
            """, list_id=list_id)
            print(f"Deleted all existing list value relationships for list {list_id}")
        
        # Get existing list values for this list to check for duplicates (if not replacing)
        if not replace:
            existing_values_result = session.run("""
                MATCH (l:List {id: $list_id})-[:HAS_LIST_VALUE]->(lv:ListValue)
                RETURN lv.value as value
            """, list_id=list_id)
            existing_values = {record["value"].lower() for record in existing_values_result}
        else:
            existing_values = set()
        
        created_count = 0
        skipped_duplicates = 0
        
        for list_value in list_values:
            # Handle both dict and Pydantic model (ListValueRequest)
            if isinstance(list_value, dict):
                value = list_value.get("value", "").strip()
            else:
                # Pydantic model - access as attribute
                # ListValueRequest has a 'value' attribute
                value = getattr(list_value, "value", "").strip() if hasattr(list_value, "value") else ""
            
            if not value:
                continue
            
            # Check for duplicate (case-insensitive) within the same list
            if value.lower() in existing_values:
                print(f"⚠️ Skipping duplicate list value '{value}' for list {list_id}")
                skipped_duplicates += 1
                continue
            
            # Create ListValue node and relationship
            result = session.run("""
                MATCH (l:List {id: $list_id})
                MERGE (lv:ListValue {value: $value})
                MERGE (l)-[:HAS_LIST_VALUE]->(lv)
                RETURN lv.value as value
            """, list_id=list_id, value=value)
            
            if result.single():
                existing_values.add(value.lower())
                created_count += 1
                print(f"✅ Created list value '{value}' for list {list_id}")
        
        print(f"Created {created_count} list values, skipped {skipped_duplicates} duplicates")
        return created_count
        
    except Exception as e:
        print(f"Error creating list values for list {list_id}: {e}")
        raise

async def create_tier_list_nodes(session, parent_list_id: str, tier_names: List[str], set_name: str, grouping_name: str):
    """
    Create tier list nodes from tier names and return their IDs.
    Each tier list node will have the same set and grouping as the parent list.
    """
    try:
        print(f"Creating tier list nodes for parent list {parent_list_id} with tier names: {tier_names}")
        
        # Get parent list info
        parent_result = session.run("""
            MATCH (l:List {id: $list_id})
            RETURN l.set as set, l.grouping as grouping, l.name as name
        """, list_id=parent_list_id)
        
        parent_record = parent_result.single()
        if not parent_record:
            raise ValueError(f"Parent list {parent_list_id} not found")
        
        parent_set = set_name or parent_record["set"]
        parent_grouping = grouping_name or parent_record["grouping"]
        
        tier_list_ids = []
        
        for index, tier_name in enumerate(tier_names, start=2):  # Start at tier 2
            if not tier_name or not tier_name.strip():
                print(f"⚠️ Skipping empty tier name at index {index}")
                continue
            
            tier_name = tier_name.strip()
            
            # Check if tier list already exists with this name, set, and grouping
            existing_result = session.run("""
                MATCH (l:List {name: $tier_name, set: $set, grouping: $grouping})
                RETURN l.id as id
            """, tier_name=tier_name, set=parent_set, grouping=parent_grouping)
            
            existing_record = existing_result.single()
            if existing_record:
                tier_list_id = existing_record["id"]
                print(f"✅ Tier list '{tier_name}' already exists with id {tier_list_id}")
            else:
                # Create new tier list node
                tier_list_id = str(uuid.uuid4())
                session.run("""
                    MERGE (s:Set {name: $set})
                    MERGE (g:Grouping {name: $grouping})
                    MERGE (s)-[:HAS_GROUPING]->(g)
                    WITH g
                    CREATE (l:List {
                        id: $tier_list_id,
                        name: $tier_name,
                        set: $set,
                        grouping: $grouping,
                        format: '',
                        source: '',
                        upkeep: '',
                        graph: '',
                        origin: '',
                        status: 'Active'
                    })
                    MERGE (g)-[:HAS_LIST]->(l)
                """, tier_list_id=tier_list_id, tier_name=tier_name, set=parent_set, grouping=parent_grouping)
                print(f"✅ Created tier list node '{tier_name}' with id {tier_list_id}")
            
            tier_list_ids.append(tier_list_id)
        
        return tier_list_ids
        
    except Exception as e:
        print(f"Error creating tier list nodes: {e}")
        raise

async def create_tiered_list_relationships(session, list_id: str, tiered_lists: List[Dict[str, Any]]):
    """
    Create tiered list relationships (HAS_TIER_2, HAS_TIER_3, etc.) from parent list to tiered lists.
    Replaces all existing tiered relationships.
    Also deletes tiered value relationships for removed tiers, but preserves tier 1 list values.
    """
    try:
        print(f"Creating tiered list relationships for list {list_id}")
        
        # Get current tiered list IDs before deletion
        current_tiered_result = session.run("""
            MATCH (l:List {id: $list_id})-[r:HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
            RETURN tiered.id as id, type(r) as rel_type
            ORDER BY type(r)
        """, list_id=list_id)
        
        current_tiered_ids = set()
        for record in current_tiered_result:
            current_tiered_ids.add(record["id"])
        
        # Get new tiered list IDs
        new_tiered_ids = set()
        for tiered_list in tiered_lists:
            tiered_list_id = tiered_list.get("listId") if isinstance(tiered_list, dict) else getattr(tiered_list, "listId", None)
            if tiered_list_id:
                new_tiered_ids.add(tiered_list_id)
        
        # Find removed tiered list IDs
        removed_tiered_ids = current_tiered_ids - new_tiered_ids
        
        # Delete tiered value relationships for removed tiers
        # We need to delete relationships that connect to tiered values associated with removed tier lists
        if removed_tiered_ids:
            print(f"Removing tiered value relationships for removed tier lists: {removed_tiered_ids}")
            # Get list names for removed tiers to identify their value relationships
            for removed_id in removed_tiered_ids:
                removed_list_result = session.run("""
                    MATCH (removed:List {id: $removed_id})
                    RETURN removed.name as name
                """, removed_id=removed_id)
                removed_record = removed_list_result.single()
                if removed_record:
                    removed_list_name = removed_record["name"]
                    # Sanitize list name for relationship type
                    sanitized_name = removed_list_name.upper().replace(' ', '_').replace('-', '_').replace('.', '_')
                    relationship_type = f"HAS_{sanitized_name}_VALUE"
                    
                    # Delete relationships of this type
                    session.run(f"""
                        MATCH (lv1:ListValue)-[r:{relationship_type}]->(lv2:ListValue)
                        DELETE r
                    """)
                    
                    # Also delete any tiered value nodes that have this listName and are orphaned
                    session.run("""
                        MATCH (lv:ListValue)
                        WHERE lv.tier IS NOT NULL 
                          AND lv.listName = $list_name
                          AND NOT EXISTS {
                            MATCH (lv2:ListValue)-[r]->(lv)
                            WHERE type(r) STARTS WITH 'HAS_' AND type(r) ENDS WITH '_VALUE'
                          }
                        DETACH DELETE lv
                    """, list_name=removed_list_name)
        
        # Delete all existing tiered relationships
        session.run("""
            MATCH (l:List {id: $list_id})-[r:HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
            DELETE r
        """, list_id=list_id)
        print(f"Deleted all existing tiered relationships for list {list_id}")
        
        created_count = 0
        
        for index, tiered_list in enumerate(tiered_lists, start=2):  # Start at tier 2
            tier_number = min(index, 10)  # Cap at tier 10
            tiered_list_id = tiered_list.get("listId") if isinstance(tiered_list, dict) else getattr(tiered_list, "listId", None)
            
            if not tiered_list_id:
                print(f"⚠️ Skipping tiered list entry {index} - missing listId")
                continue
            
            # Create relationship with appropriate tier number
            relationship_type = f"HAS_TIER_{tier_number}"
            # Build query with relationship type
            query = f"""
                MATCH (l:List {{id: $list_id}})
                MATCH (tiered:List {{id: $tiered_list_id}})
                MERGE (l)-[r:{relationship_type}]->(tiered)
                RETURN r
            """
            result = session.run(query, list_id=list_id, tiered_list_id=tiered_list_id)
            
            if result.single():
                created_count += 1
                print(f"✅ Created {relationship_type} relationship from list {list_id} to tiered list {tiered_list_id}")
        
        print(f"Created {created_count} tiered list relationships")
        return created_count
        
    except Exception as e:
        print(f"Error creating tiered list relationships for list {list_id}: {e}")
        raise

async def create_tiered_list_values(session, list_id: str, tiered_lists: List[Dict[str, Any]], tiered_values: Dict[str, List[List[str]]]):
    """
    Create tiered list values with relationships.
    tiered_values: Dict mapping tier 1 value (e.g., "USA") to list of arrays, where each array contains values for tier 2, 3, etc.
    For example: {"USA": [["California", "Los Angeles"], ["Texas", "Houston"]], "Canada": [["Ontario", "Toronto"]]}
    """
    try:
        print(f"Creating tiered list values for list {list_id}")
        
        # Get the tiered list structure
        if not tiered_lists or len(tiered_lists) == 0:
            print("No tiered lists defined, skipping tiered values")
            return 0
        
        # Get list names for each tier
        tier_list_names = []
        tier_list_ids = []
        
        # First, get the parent list name
        parent_list_result = session.run("MATCH (l:List {id: $list_id}) RETURN l.name as name", list_id=list_id)
        parent_list_record = parent_list_result.single()
        if not parent_list_record:
            print(f"Parent list {list_id} not found")
            return 0
        
        parent_list_name = parent_list_record["name"]
        tier_list_names.append(parent_list_name)
        tier_list_ids.append(list_id)
        
        # Get tiered list names and IDs
        for tier in tiered_lists:
            tier_list_id = tier.get("listId") if isinstance(tier, dict) else getattr(tier, "listId", None)
            if tier_list_id:
                tier_list_result = session.run("MATCH (l:List {id: $tier_id}) RETURN l.name as name", tier_id=tier_list_id)
                tier_list_record = tier_list_result.single()
                if tier_list_record:
                    tier_list_names.append(tier_list_record["name"])
                    tier_list_ids.append(tier_list_id)
        
        print(f"Tier structure: {tier_list_names}")
        
        created_count = 0
        
        # Process each tier 1 value
        for tier1_value, tiered_value_arrays in tiered_values.items():
            if not tier1_value:
                continue
            
            # Create or get the tier 1 list value node
            tier1_lv_result = session.run("""
                MATCH (l:List {id: $list_id})
                MERGE (lv1:ListValue {value: $value})
                MERGE (l)-[:HAS_LIST_VALUE]->(lv1)
                RETURN lv1
            """, list_id=list_id, value=tier1_value)
            
            if not tier1_lv_result.single():
                print(f"Failed to create/get tier 1 list value: {tier1_value}")
                continue
            
            # Process each array of tiered values
            for tiered_value_array in tiered_value_arrays:
                if not tiered_value_array or len(tiered_value_array) == 0:
                    continue
                
                # Create chain of relationships: tier1 -> tier2 -> tier3 -> ...
                previous_lv_value = tier1_value
                
                for tier_index, tier_value in enumerate(tiered_value_array):
                    if not tier_value:
                        break
                    
                    # Check if we have enough tier lists for this tier index
                    if tier_index + 1 >= len(tier_list_names) or tier_index + 1 >= len(tier_list_ids):
                        print(f"⚠️ WARNING: Not enough tier lists for tier index {tier_index}. Expected {tier_index + 2} tiers but only have {len(tier_list_names)}.")
                        break
                    
                    tier_number = tier_index + 2  # Start at tier 2
                    tier_list_name = tier_list_names[tier_index + 1]
                    
                    # Validate tier_list_name is not None
                    if not tier_list_name:
                        print(f"⚠️ WARNING: tier_list_name is None or empty for tier_index {tier_index}")
                        break
                    
                    # Create relationship type: HAS_STATE_VALUE, HAS_CITY_VALUE, etc.
                    # Convert list name to relationship type (e.g., "State" -> "HAS_STATE_VALUE")
                    # Sanitize list name for relationship type (remove/replace special chars, uppercase)
                    # Neo4j relationship types can only contain letters, numbers, and underscores
                    sanitized_list_name = str(tier_list_name).upper()
                    # Replace common special characters
                    sanitized_list_name = sanitized_list_name.replace('&', 'AND')
                    sanitized_list_name = sanitized_list_name.replace('&AMP;', 'AND')  # HTML entity
                    sanitized_list_name = sanitized_list_name.replace(' ', '_')
                    sanitized_list_name = sanitized_list_name.replace('-', '_')
                    sanitized_list_name = sanitized_list_name.replace('.', '_')
                    sanitized_list_name = sanitized_list_name.replace(',', '_')
                    sanitized_list_name = sanitized_list_name.replace('(', '_')
                    sanitized_list_name = sanitized_list_name.replace(')', '_')
                    sanitized_list_name = sanitized_list_name.replace('[', '_')
                    sanitized_list_name = sanitized_list_name.replace(']', '_')
                    sanitized_list_name = sanitized_list_name.replace('{', '_')
                    sanitized_list_name = sanitized_list_name.replace('}', '_')
                    sanitized_list_name = sanitized_list_name.replace('/', '_')
                    sanitized_list_name = sanitized_list_name.replace('\\', '_')
                    sanitized_list_name = sanitized_list_name.replace('@', 'AT')
                    sanitized_list_name = sanitized_list_name.replace('#', 'HASH')
                    sanitized_list_name = sanitized_list_name.replace('$', 'DOLLAR')
                    sanitized_list_name = sanitized_list_name.replace('%', 'PERCENT')
                    sanitized_list_name = sanitized_list_name.replace('*', 'STAR')
                    sanitized_list_name = sanitized_list_name.replace('+', 'PLUS')
                    sanitized_list_name = sanitized_list_name.replace('=', 'EQUALS')
                    sanitized_list_name = sanitized_list_name.replace('!', 'EXCLAMATION')
                    sanitized_list_name = sanitized_list_name.replace('?', 'QUESTION')
                    sanitized_list_name = sanitized_list_name.replace(':', '_')
                    sanitized_list_name = sanitized_list_name.replace(';', '_')
                    sanitized_list_name = sanitized_list_name.replace("'", '_')
                    sanitized_list_name = sanitized_list_name.replace('"', '_')
                    sanitized_list_name = sanitized_list_name.replace('|', '_')
                    sanitized_list_name = sanitized_list_name.replace('<', '_')
                    sanitized_list_name = sanitized_list_name.replace('>', '_')
                    # Remove any remaining non-alphanumeric characters except underscores
                    sanitized_list_name = re.sub(r'[^A-Z0-9_]', '_', sanitized_list_name)
                    # Remove multiple consecutive underscores
                    sanitized_list_name = re.sub(r'_+', '_', sanitized_list_name)
                    # Remove leading/trailing underscores
                    sanitized_list_name = sanitized_list_name.strip('_')
                    relationship_type = f"HAS_{sanitized_list_name}_VALUE"
                    
                    # Create or get the tiered list value node with properties
                    # Use MERGE to create node with properties, ensuring uniqueness
                    # tier_list_id was already validated above when checking bounds
                    tier_list_id = tier_list_ids[tier_index + 1]  # Get the ID of the tiered list
                    
                    # For tier 1, match by value and connection to parent list
                    # For tier 2+, match by value, tier, and listName to ensure we get the right node
                    if tier_index == 0:
                        # First tier after tier 1 - match previous by value and connection to parent list
                        query = f"""
                            MATCH (parent_list:List {{id: $list_id}})-[:HAS_LIST_VALUE]->(prev:ListValue {{value: $prev_value}})
                            MATCH (tier_list:List {{id: $tier_list_id}})
                            MERGE (current:ListValue {{value: $tier_value, tier: $tier_number, listName: $tier_list_name}})
                            ON CREATE SET current.tier = $tier_number, current.listName = $tier_list_name
                            ON MATCH SET current.tier = $tier_number, current.listName = $tier_list_name
                            MERGE (prev)-[r:{relationship_type}]->(current)
                            MERGE (tier_list)-[:HAS_LIST_VALUE]->(current)
                            RETURN current
                        """
                    else:
                        # Subsequent tiers - match previous by value, tier, and listName
                        # Validate we have enough tier lists
                        if tier_index >= len(tier_list_names):
                            print(f"⚠️ WARNING: Not enough tier lists for previous tier index {tier_index}")
                            break
                        prev_tier_number = tier_index + 1
                        prev_tier_list_name = tier_list_names[tier_index]
                        
                        # Validate prev_tier_list_name is not None
                        if not prev_tier_list_name:
                            print(f"⚠️ WARNING: prev_tier_list_name is None or empty for tier_index {tier_index}")
                            break
                        query = f"""
                            MATCH (prev:ListValue {{value: $prev_value, tier: $prev_tier_number, listName: $prev_tier_list_name}})
                            MATCH (tier_list:List {{id: $tier_list_id}})
                            MERGE (current:ListValue {{value: $tier_value, tier: $tier_number, listName: $tier_list_name}})
                            ON CREATE SET current.tier = $tier_number, current.listName = $tier_list_name
                            ON MATCH SET current.tier = $tier_number, current.listName = $tier_list_name
                            MERGE (prev)-[r:{relationship_type}]->(current)
                            MERGE (tier_list)-[:HAS_LIST_VALUE]->(current)
                            RETURN current
                        """
                    
                    result = session.run(query, 
                        list_id=list_id,
                        prev_value=previous_lv_value,
                        tier_value=tier_value,
                        tier_number=tier_number,
                        tier_list_name=tier_list_name,
                        tier_list_id=tier_list_id,
                        prev_tier_number=tier_index + 1 if tier_index > 0 else None,
                        prev_tier_list_name=tier_list_names[tier_index] if tier_index > 0 else None
                    )
                    
                    record = result.single()
                    if record:
                        created_count += 1
                        previous_lv_value = tier_value
                        print(f"✅ Created relationship: {previous_lv_value} -> {tier_value} (tier {tier_number})")
                    else:
                        print(f"❌ Failed to create relationship for {tier_value} (tier {tier_number})")
                        print(f"   Previous value: {previous_lv_value}, Tier list: {tier_list_name}")
                        break
        
        print(f"Created {created_count} tiered list value relationships")
        return created_count
        
    except Exception as e:
        print(f"Error creating tiered list values for list {list_id}: {e}")
        import traceback
        traceback.print_exc()
        raise

@router.get("/lists", response_model=List[Dict[str, Any]])
async def get_lists():
    """
    Get all lists from the CDM with proper taxonomy structure.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (s:Set)-[:HAS_GROUPING]->(g:Grouping)-[:HAS_LIST]->(l:List)
                OPTIONAL MATCH (l)<-[:IS_RELEVANT_TO]-(sector:Sector)
                OPTIONAL MATCH (l)<-[:IS_RELEVANT_TO]-(domain:Domain)
                OPTIONAL MATCH (l)<-[:IS_RELEVANT_TO]-(country:Country)
                OPTIONAL MATCH (v:Variable)-[:HAS_LIST]->(l)
                OPTIONAL MATCH (l)-[:HAS_LIST_VALUE]->(lv:ListValue)
                OPTIONAL MATCH (l)-[tier_rel:HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
                OPTIONAL MATCH (parent:List)-[parent_tier_rel:HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(l)
                OPTIONAL MATCH (l)-[:HAS_VARIATION]->(var:Variation)
                WITH l, s, g, 
                     collect(DISTINCT sector.name) as sectors,
                     collect(DISTINCT domain.name) as domains,
                     collect(DISTINCT country.name) as countries,
                     count(DISTINCT v) as variables_count,
                     collect(DISTINCT lv.value) as list_values,
                     collect(DISTINCT {listId: tiered.id, set: tiered.set, grouping: tiered.grouping, list: tiered.name}) as tiered_lists,
                     count(DISTINCT parent) > 0 as has_incoming_tier,
                     count(DISTINCT var) as variations_count,
                     collect(DISTINCT {id: var.id, name: var.name}) as variations,
                     size(collect(DISTINCT tiered.id)) as tiered_count
                RETURN l.id as id, l.name as list, l.set as set, l.grouping as grouping,
                       l.format as format, l.source as source, l.upkeep as upkeep,
                       l.graph as graph, l.origin as origin, l.status as status,
                       s.name as set_name, g.name as grouping_name,
                       sectors, domains, countries, variables_count, list_values, tiered_lists, has_incoming_tier,
                       variations_count, variations, tiered_count
                ORDER BY l.id
            """)

            lists = []
            for record in result:
                sectors = record["sectors"] or []
                domains = record["domains"] or []
                countries = record["countries"] or []
                
                # Create driver strings
                sector_str = "ALL" if "ALL" in sectors else (", ".join(sectors) if sectors else "ALL")
                domain_str = "ALL" if "ALL" in domains else (", ".join(domains) if domains else "ALL")
                country_str = "ALL" if "ALL" in countries else (", ".join(countries) if countries else "ALL")
                
                # Convert list values to ListValue format
                list_values = record.get("list_values") or []
                listValuesList = [{"id": str(i), "value": val} for i, val in enumerate(list_values) if val]
                
                # Convert tiered lists
                tiered_lists_raw = record.get("tiered_lists") or []
                tieredListsList = []
                for tier in tiered_lists_raw:
                    if tier and tier.get("listId"):
                        tieredListsList.append({
                            "id": tier.get("listId"),
                            "set": tier.get("set", ""),
                            "grouping": tier.get("grouping", ""),
                            "list": tier.get("list", ""),
                            "listId": tier.get("listId")
                        })
                
                variations_list = record.get("variations") or []
                variations_count = record.get("variations_count") or 0
                tiered_count = record.get("tiered_count") or 0
                
                # Determine listType, numberOfLevels, and tierNames from tiered lists
                list_type = 'Multi-Level' if tiered_count > 0 else 'Single'
                number_of_levels = tiered_count + 1 if tiered_count > 0 else 2
                tier_names = [tier.get("list", "") for tier in tieredListsList if tier.get("list")]
                
                list_item = {
                    "id": record["id"],
                    "sector": sector_str if sector_str != "ALL" else ["ALL"],
                    "domain": domain_str if domain_str != "ALL" else ["ALL"],
                    "country": country_str if country_str != "ALL" else ["ALL"],
                    "set": record["set"],
                    "grouping": record["grouping"],
                    "list": record["list"],
                    "format": record["format"] or "",
                    "source": record["source"] or "",
                    "upkeep": record["upkeep"] or "",
                    "graph": record["graph"] or "",
                    "origin": record["origin"] or "",
                    "status": record["status"] or "Active",
                    "variables": record["variables_count"] or 0,
                    "variablesAttachedList": [],
                    "listValuesList": listValuesList,
                    "tieredListsList": tieredListsList,
                    "hasIncomingTier": record.get("has_incoming_tier", False),
                    "variations": variations_count,
                    "variationsList": variations_list,
                    "listType": list_type,
                    "numberOfLevels": number_of_levels,
                    "tierNames": tier_names
                }
                lists.append(list_item)

            return lists

    except Exception as e:
        print(f"Error fetching lists: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch lists: {str(e)}")

@router.post("/lists")
async def create_list(list_data: ListCreateRequest):
    """
    Create a new list in the CDM with proper taxonomy structure.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Generate unique ID
            list_id = str(uuid.uuid4())
            
            # Create taxonomy structure: Set -> Grouping -> List
            result = session.run("""
                // MERGE Set node (avoid duplicates)
                MERGE (s:Set {name: $set})
                
                // MERGE Grouping node (avoid duplicates)
                MERGE (g:Grouping {name: $grouping})
                
                // Create relationship Set -> Grouping
                MERGE (s)-[:HAS_GROUPING]->(g)
                
                // Create List node with all properties
                CREATE (l:List {
                    id: $id,
                    name: $list,
                    set: $set,
                    grouping: $grouping,
                    format: $format,
                    source: $source,
                    upkeep: $upkeep,
                    graph: $graph,
                    origin: $origin,
                    status: $status
                })
                
                // Create relationship Grouping -> List
                MERGE (g)-[:HAS_LIST]->(l)
                
                // Return the list data for response
                RETURN l.id as id, l.name as list, l.set as set, l.grouping as grouping,
                       l.format as format, l.source as source, l.upkeep as upkeep,
                       l.graph as graph, l.origin as origin, l.status as status
            """, {
                "id": list_id,
                "set": list_data.set,
                "grouping": list_data.grouping,
                "list": list_data.list,
                "format": list_data.format or "",
                "source": list_data.source or "",
                "upkeep": list_data.upkeep or "",
                "graph": list_data.graph or "",
                "origin": list_data.origin or "",
                "status": list_data.status or "Active"
            })

            record = result.single()
            if not record:
                raise HTTPException(status_code=500, detail="Failed to create list")

            # Create driver relationships
            await create_list_driver_relationships(
                session, 
                list_id, 
                list_data.sector, 
                list_data.domain, 
                list_data.country
            )

            # Create list values as nodes with HAS_LIST_VALUE relationships (replace all)
            if list_data.listValuesList is not None:
                await create_list_values(session, list_id, list_data.listValuesList, replace=True)
            
            # Create tiered list relationships
            if list_data.tieredListsList is not None:
                await create_tiered_list_relationships(session, list_id, list_data.tieredListsList)
            
            # Create tiered list values
            if list_data.tieredListValues is not None and list_data.tieredListsList:
                await create_tiered_list_values(session, list_id, list_data.tieredListsList, list_data.tieredListValues)

            # Handle variationsList if provided
            has_variations_list = list_data.variationsList is not None and len(list_data.variationsList) > 0
            if has_variations_list:
                parsed_variations_list = list_data.variationsList
                print(f"DEBUG: Processing {len(parsed_variations_list)} variations for new list")
                
                for var in parsed_variations_list:
                    variation_name = var.get("name", "").strip()
                    if not variation_name:
                        continue
                    
                    print(f"DEBUG: Processing variation: {variation_name}")
                    
                    # Check if variation already exists for this list (case-insensitive)
                    existing_variation_for_list = session.run("""
                        MATCH (l:List {id: $list_id})-[:HAS_VARIATION]->(var:Variation)
                        WHERE toLower(var.name) = toLower($variation_name)
                        RETURN var.id as id, var.name as name
                    """, list_id=list_id, variation_name=variation_name).single()
                    
                    if existing_variation_for_list:
                        print(f"DEBUG: Variation '{variation_name}' already exists for list {list_id}, skipping")
                        continue
                    
                    # Check if variation exists globally (case-insensitive)
                    existing_variation = session.run("""
                        MATCH (var:Variation)
                        WHERE toLower(var.name) = toLower($variation_name)
                        RETURN var.id as id, var.name as name
                    """, variation_name=variation_name).single()
                    
                    if existing_variation:
                        # Variation exists globally, connect it to this list
                        variation_id = existing_variation["id"]
                        print(f"DEBUG: Connecting existing global variation '{variation_name}' to list {list_id}")
                        
                        session.run("""
                            MATCH (l:List {id: $list_id})
                            MATCH (var:Variation {id: $variation_id})
                            CREATE (l)-[:HAS_VARIATION]->(var)
                        """, list_id=list_id, variation_id=variation_id)
                    else:
                        # Create new variation
                        variation_id = str(uuid.uuid4())
                        print(f"DEBUG: Creating new variation '{variation_name}' for list {list_id}")
                        
                        session.run("""
                            CREATE (var:Variation {
                                id: $variation_id,
                                name: $variation_name
                            })
                        """, variation_id=variation_id, variation_name=variation_name)
                        
                        session.run("""
                            MATCH (l:List {id: $list_id})
                            MATCH (var:Variation {id: $variation_id})
                            CREATE (l)-[:HAS_VARIATION]->(var)
                        """, list_id=list_id, variation_id=variation_id)

            # Get variations count and list for the newly created list
            variations_result = session.run("""
                MATCH (l:List {id: $id})-[:HAS_VARIATION]->(var:Variation)
                RETURN count(var) as count, collect(DISTINCT {id: var.id, name: var.name}) as variations
            """, {"id": list_id})

            variations_record = variations_result.single()
            variations_count = variations_record["count"] if variations_record else 0
            variations_list = variations_record["variations"] if variations_record and variations_record["variations"] else []

            return {
                "id": record["id"],
                "sector": list_data.sector,
                "domain": list_data.domain,
                "country": list_data.country,
                "set": record["set"],
                "grouping": record["grouping"],
                "list": record["list"],
                "format": record["format"],
                "source": record["source"],
                "upkeep": record["upkeep"],
                "graph": record["graph"],
                "origin": record["origin"],
                "status": record["status"],
                "variablesAttachedList": [],
                "listValuesList": list_data.listValuesList if list_data.listValuesList else [],
                "variations": variations_count,
                "variationsList": variations_list
            }

    except Exception as e:
        print(f"Error creating list: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create list: {str(e)}")

@router.put("/lists/{list_id}")
async def update_list(list_id: str, list_data: ListUpdateRequest):
    """
    Update an existing list in the CDM.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Check if list exists
            check_result = session.run("""
                MATCH (l:List {id: $id})
                RETURN l
            """, {"id": list_id})
            
            if not check_result.single():
                raise HTTPException(status_code=404, detail="List not found")
            
            # Build update query dynamically based on provided fields
            update_fields = []
            params = {"id": list_id}
            
            if list_data.set is not None:
                update_fields.append("l.set = $set")
                params["set"] = list_data.set
            if list_data.grouping is not None:
                update_fields.append("l.grouping = $grouping")
                params["grouping"] = list_data.grouping
            if list_data.list is not None:
                update_fields.append("l.name = $list")
                params["list"] = list_data.list
            if list_data.format is not None:
                update_fields.append("l.format = $format")
                params["format"] = list_data.format
            if list_data.source is not None:
                update_fields.append("l.source = $source")
                params["source"] = list_data.source
            if list_data.upkeep is not None:
                update_fields.append("l.upkeep = $upkeep")
                params["upkeep"] = list_data.upkeep
            if list_data.graph is not None:
                update_fields.append("l.graph = $graph")
                params["graph"] = list_data.graph
            if list_data.origin is not None:
                update_fields.append("l.origin = $origin")
                params["origin"] = list_data.origin
            if list_data.status is not None:
                update_fields.append("l.status = $status")
                params["status"] = list_data.status
            
            if update_fields:
                update_query = f"""
                    MATCH (l:List {{id: $id}})
                    SET {', '.join(update_fields)}
                    RETURN l
                """
                session.run(update_query, params)
            
            # Update taxonomy relationships if set or grouping changed
            if list_data.set is not None or list_data.grouping is not None:
                # Get current values if not provided
                current_result = session.run("""
                    MATCH (l:List {id: $id})
                    RETURN l.set as set, l.grouping as grouping
                """, {"id": list_id})
                current = current_result.single()
                set_name = list_data.set if list_data.set is not None else current["set"]
                grouping_name = list_data.grouping if list_data.grouping is not None else current["grouping"]
                
                # Update taxonomy relationships
                session.run("""
                    MATCH (l:List {id: $id})
                    OPTIONAL MATCH (g:Grouping)-[r:HAS_LIST]->(l)
                    DELETE r
                    WITH l
                    MERGE (s:Set {name: $set})
                    MERGE (g:Grouping {name: $grouping})
                    MERGE (s)-[:HAS_GROUPING]->(g)
                    MERGE (g)-[:HAS_LIST]->(l)
                """, {"id": list_id, "set": set_name, "grouping": grouping_name})
            
            # Handle listType changes (Single vs Multi-Level)
            if list_data.listType is not None:
                # If switching to Single, clear all tiered relationships
                if list_data.listType == 'Single':
                    print(f"Switching list {list_id} to Single type - clearing tiered relationships")
                    session.run("""
                        MATCH (l:List {id: $list_id})-[r:HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
                        DELETE r
                    """, list_id=list_id)
                    
                    # Delete tiered value relationships
                    session.run("""
                        MATCH (lv1:ListValue)-[r]->(lv2:ListValue)
                        WHERE type(r) STARTS WITH 'HAS_' AND type(r) ENDS WITH '_VALUE'
                          AND type(r) <> 'HAS_LIST_VALUE'
                        DELETE r
                    """)
                    
                    # Delete orphaned tiered list value nodes
                    session.run("""
                        MATCH (lv:ListValue)
                        WHERE lv.tier IS NOT NULL
                          AND NOT EXISTS {
                            MATCH (lv2:ListValue)-[r]->(lv)
                            WHERE type(r) STARTS WITH 'HAS_' AND type(r) ENDS WITH '_VALUE'
                          }
                        DETACH DELETE lv
                    """)
            
            # Handle Multi-Level list setup: create tier list nodes and relationships
            print(f"DEBUG: Checking listType setup - listType={list_data.listType}, tierNames={list_data.tierNames}, numberOfLevels={list_data.numberOfLevels}")
            if list_data.listType == 'Multi-Level' and list_data.tierNames is not None and len(list_data.tierNames) > 0:
                print(f"Setting up Multi-Level list {list_id} with tier names: {list_data.tierNames}")
                
                # Get current set and grouping
                current_result = session.run("""
                    MATCH (l:List {id: $id})
                    RETURN l.set as set, l.grouping as grouping
                """, {"id": list_id})
                current = current_result.single()
                if not current:
                    raise HTTPException(status_code=404, detail="List not found")
                set_name = list_data.set if list_data.set is not None else current["set"]
                grouping_name = list_data.grouping if list_data.grouping is not None else current["grouping"]
                
                # Create tier list nodes
                tier_list_ids = await create_tier_list_nodes(session, list_id, list_data.tierNames, set_name, grouping_name)
                print(f"DEBUG: Created {len(tier_list_ids)} tier list nodes with IDs: {tier_list_ids}")
                
                # Build tieredListsList from tier list IDs
                tiered_lists = []
                for tier_list_id in tier_list_ids:
                    # Get tier list info
                    tier_result = session.run("""
                        MATCH (l:List {id: $tier_id})
                        RETURN l.name as name, l.set as set, l.grouping as grouping
                    """, tier_id=tier_list_id)
                    tier_record = tier_result.single()
                    if tier_record:
                        tiered_lists.append({
                            "listId": tier_list_id,
                            "set": tier_record["set"],
                            "grouping": tier_record["grouping"],
                            "list": tier_record["name"]
                        })
                
                print(f"DEBUG: Built tiered_lists: {tiered_lists}")
                
                # Create tiered list relationships
                if tiered_lists:
                    await create_tiered_list_relationships(session, list_id, tiered_lists)
                    print(f"✅ Created {len(tiered_lists)} tier list relationships")
            
            # Update list values if provided (replace all existing with new ones)
            # Note: Even if listValuesList is an empty array, we still want to replace (clear all values)
            if list_data.listValuesList is not None:
                await create_list_values(session, list_id, list_data.listValuesList, replace=True)
            
            # Update tiered list relationships if provided (replace all existing)
            # This handles the old structure where tieredListsList is explicitly provided
            if list_data.tieredListsList is not None:
                await create_tiered_list_relationships(session, list_id, list_data.tieredListsList)
            
            # Update tiered list values if provided
            if list_data.tieredListValues is not None:
                print(f"Processing tieredListValues for list {list_id}")
                print(f"tieredListValues data: {list_data.tieredListValues}")
                
                # Get current tiered lists structure from database
                current_tiered_result = session.run("""
                    MATCH (l:List {id: $list_id})-[r:HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
                    RETURN tiered.id as id, tiered.set as set, tiered.grouping as grouping, tiered.name as list, type(r) as rel_type
                    ORDER BY type(r)
                """, list_id=list_id)
                
                current_tiered_lists = []
                for record in current_tiered_result:
                    current_tiered_lists.append({
                        "listId": record["id"],
                        "set": record["set"],
                        "grouping": record["grouping"],
                        "list": record["list"]
                    })
                
                print(f"Found {len(current_tiered_lists)} tiered lists for list {list_id}")
                
                # If no tiered lists found but tierNames are provided, create them now
                if not current_tiered_lists and list_data.tierNames and len(list_data.tierNames) > 0:
                    print(f"⚠️ No tiered lists found, but tierNames provided. Creating tier list nodes now...")
                    # Get current set and grouping
                    current_result = session.run("""
                        MATCH (l:List {id: $id})
                        RETURN l.set as set, l.grouping as grouping
                    """, {"id": list_id})
                    current = current_result.single()
                    if not current:
                        print(f"⚠️ ERROR: List {list_id} not found when trying to create tier list nodes")
                        raise HTTPException(status_code=404, detail=f"List {list_id} not found")
                    
                    set_name = list_data.set if list_data.set is not None else current["set"]
                    grouping_name = list_data.grouping if list_data.grouping is not None else current["grouping"]
                    
                    # Create tier list nodes
                    tier_list_ids = await create_tier_list_nodes(session, list_id, list_data.tierNames, set_name, grouping_name)
                    
                    # Build tieredListsList from tier list IDs
                    for tier_list_id in tier_list_ids:
                        tier_result = session.run("""
                            MATCH (l:List {id: $tier_id})
                            RETURN l.name as name, l.set as set, l.grouping as grouping
                        """, tier_id=tier_list_id)
                        tier_record = tier_result.single()
                        if tier_record:
                            current_tiered_lists.append({
                                "listId": tier_list_id,
                                "set": tier_record["set"],
                                "grouping": tier_record["grouping"],
                                "list": tier_record["name"]
                            })
                    
                    # Create tiered list relationships
                    if current_tiered_lists:
                        await create_tiered_list_relationships(session, list_id, current_tiered_lists)
                        print(f"✅ Created {len(current_tiered_lists)} tier list nodes and relationships")
                        print(f"DEBUG: current_tiered_lists after creation: {current_tiered_lists}")
                    else:
                        print(f"⚠️ WARNING: Failed to create tier list nodes or build tieredListsList")
                
                if not current_tiered_lists:
                    print(f"⚠️ WARNING: No tiered lists found for list {list_id}. Cannot save tiered values.")
                    print(f"   Make sure you have saved the List Type configuration (Multi-Level with tier names) first.")
                    # Don't raise an error, just log a warning - the API call will succeed but no values will be saved
                else:
                    # Delete existing tiered value relationships
                    # Delete all relationships from tier 1 list values to tiered list values
                    delete_result = session.run("""
                        MATCH (l:List {id: $list_id})-[r1:HAS_LIST_VALUE]->(lv1:ListValue)
                        MATCH (lv1)-[r2]->(lv2:ListValue)
                        WHERE type(r2) STARTS WITH 'HAS_' AND type(r2) ENDS WITH '_VALUE'
                          AND type(r2) <> 'HAS_LIST_VALUE'
                        DELETE r2
                        RETURN count(r2) as deleted_count
                    """, list_id=list_id)
                    delete_record = delete_result.single()
                    deleted_count = delete_record["deleted_count"] if delete_record else 0
                    print(f"Deleted {deleted_count} existing tiered value relationships")
                    
                    # Also delete orphaned tiered list value nodes (those that are no longer connected to tier 1 values)
                    # These are nodes with tier property that have no incoming relationships from other ListValues
                    delete_orphans_result = session.run("""
                        MATCH (lv:ListValue)
                        WHERE lv.tier IS NOT NULL
                          AND NOT EXISTS {
                            MATCH (lv2:ListValue)-[r]->(lv)
                            WHERE type(r) STARTS WITH 'HAS_' AND type(r) ENDS WITH '_VALUE'
                          }
                        DETACH DELETE lv
                        RETURN count(lv) as deleted_count
                    """)
                    delete_orphans_record = delete_orphans_result.single()
                    deleted_orphans = delete_orphans_record["deleted_count"] if delete_orphans_record else 0
                    print(f"Deleted {deleted_orphans} orphaned tiered list value nodes")
                    
                    # Create new tiered value relationships
                    try:
                        created_count = await create_tiered_list_values(session, list_id, current_tiered_lists, list_data.tieredListValues)
                        print(f"✅ Created {created_count} tiered list value relationships")
                    except Exception as e:
                        print(f"❌ Error creating tiered list values: {e}")
                        import traceback
                        traceback.print_exc()
                        raise
            
            # Handle variationsList if provided (append variations to the list)
            has_variations_list = list_data.variationsList is not None and len(list_data.variationsList) > 0
            if has_variations_list:
                parsed_variations_list = list_data.variationsList
                print(f"DEBUG: Processing {len(parsed_variations_list)} variations for list {list_id}")
                
                for var in parsed_variations_list:
                    variation_name = var.get("name", "").strip()
                    if not variation_name:
                        continue
                    
                    print(f"DEBUG: Processing variation: {variation_name}")
                    
                    # Check if variation already exists for this list (case-insensitive)
                    existing_variation_for_list = session.run("""
                        MATCH (l:List {id: $list_id})-[:HAS_VARIATION]->(var:Variation)
                        WHERE toLower(var.name) = toLower($variation_name)
                        RETURN var.id as id, var.name as name
                    """, list_id=list_id, variation_name=variation_name).single()
                    
                    if existing_variation_for_list:
                        print(f"DEBUG: Variation '{variation_name}' already exists for list {list_id}, skipping")
                        continue
                    
                    # Check if variation exists globally (case-insensitive)
                    existing_variation = session.run("""
                        MATCH (var:Variation)
                        WHERE toLower(var.name) = toLower($variation_name)
                        RETURN var.id as id, var.name as name
                    """, variation_name=variation_name).single()
                    
                    if existing_variation:
                        # Variation exists globally, connect it to this list
                        variation_id = existing_variation["id"]
                        print(f"DEBUG: Connecting existing global variation '{variation_name}' to list {list_id}")
                        
                        session.run("""
                            MATCH (l:List {id: $list_id})
                            MATCH (var:Variation {id: $variation_id})
                            CREATE (l)-[:HAS_VARIATION]->(var)
                        """, list_id=list_id, variation_id=variation_id)
                    else:
                        # Create new variation
                        variation_id = str(uuid.uuid4())
                        print(f"DEBUG: Creating new variation '{variation_name}' for list {list_id}")
                        
                        session.run("""
                            CREATE (var:Variation {
                                id: $variation_id,
                                name: $variation_name
                            })
                        """, variation_id=variation_id, variation_name=variation_name)
                        
                        session.run("""
                            MATCH (l:List {id: $list_id})
                            MATCH (var:Variation {id: $variation_id})
                            CREATE (l)-[:HAS_VARIATION]->(var)
                        """, list_id=list_id, variation_id=variation_id)
            
            # Update driver relationships if sector, domain, or country changed
            if list_data.sector is not None or list_data.domain is not None or list_data.country is not None:
                current_result = session.run("""
                    MATCH (l:List {id: $id})
                    OPTIONAL MATCH (s:Sector)-[:IS_RELEVANT_TO]->(l)
                    OPTIONAL MATCH (d:Domain)-[:IS_RELEVANT_TO]->(l)
                    OPTIONAL MATCH (c:Country)-[:IS_RELEVANT_TO]->(l)
                    WITH l, 
                         collect(DISTINCT s.name) as sectors,
                         collect(DISTINCT d.name) as domains,
                         collect(DISTINCT c.name) as countries
                    RETURN sectors, domains, countries
                """, {"id": list_id})
                current = current_result.single()
                
                if current:
                    sector_str = list_data.sector if list_data.sector is not None else (", ".join(current["sectors"]) if current["sectors"] else "ALL")
                    domain_str = list_data.domain if list_data.domain is not None else (", ".join(current["domains"]) if current["domains"] else "ALL")
                    country_str = list_data.country if list_data.country is not None else (", ".join(current["countries"]) if current["countries"] else "ALL")
                else:
                    # Fallback if current is None
                    sector_str = list_data.sector if list_data.sector is not None else "ALL"
                    domain_str = list_data.domain if list_data.domain is not None else "ALL"
                    country_str = list_data.country if list_data.country is not None else "ALL"
                
                await create_list_driver_relationships(session, list_id, sector_str, domain_str, country_str)
            
            # Return updated list
            print(f"DEBUG: Fetching updated list data for {list_id}")
            print(f"DEBUG: list_data.listType={list_data.listType}, list_data.tierNames={list_data.tierNames}, list_data.numberOfLevels={list_data.numberOfLevels}")
            result = session.run("""
                MATCH (l:List {id: $id})
                OPTIONAL MATCH (s:Sector)-[:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (d:Domain)-[:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (c:Country)-[:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (l)-[:HAS_LIST_VALUE]->(lv:ListValue)
                OPTIONAL MATCH (l)-[tier_rel:HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
                OPTIONAL MATCH (l)-[:HAS_VARIATION]->(var:Variation)
                WITH l, 
                     collect(DISTINCT s.name) as sectors,
                     collect(DISTINCT d.name) as domains,
                     collect(DISTINCT c.name) as countries,
                     collect(DISTINCT lv.value) as list_values,
                     collect(DISTINCT {listId: tiered.id, set: tiered.set, grouping: tiered.grouping, list: tiered.name}) as tiered_lists,
                     count(DISTINCT var) as variations_count,
                     collect(DISTINCT {id: var.id, name: var.name}) as variations,
                     size(collect(DISTINCT tiered.id)) as tiered_count
                RETURN l.id as id, l.name as list, l.set as set, l.grouping as grouping,
                       l.format as format, l.source as source, l.upkeep as upkeep,
                       l.graph as graph, l.origin as origin, l.status as status,
                       sectors, domains, countries, list_values, tiered_lists, variations_count, variations, tiered_count
            """, {"id": list_id})
            
            record = result.single()
            if not record:
                raise HTTPException(status_code=404, detail="List not found after update")
            
            sectors = record["sectors"] or []
            domains = record["domains"] or []
            countries = record["countries"] or []
            
            sector_str = "ALL" if "ALL" in sectors else (", ".join(sectors) if sectors else "ALL")
            domain_str = "ALL" if "ALL" in domains else (", ".join(domains) if domains else "ALL")
            country_str = "ALL" if "ALL" in countries else (", ".join(countries) if countries else "ALL")
            
            # Convert list values to ListValue format
            list_values = record.get("list_values") or []
            listValuesList = [{"id": str(i), "value": val} for i, val in enumerate(list_values) if val]
            
            # Convert tiered lists
            tiered_lists_raw = record.get("tiered_lists") or []
            tieredListsList = []
            for tier in tiered_lists_raw:
                if tier and isinstance(tier, dict) and tier.get("listId"):
                    tieredListsList.append({
                        "id": tier.get("listId"),
                        "set": tier.get("set", ""),
                        "grouping": tier.get("grouping", ""),
                        "list": tier.get("list", ""),
                        "listId": tier.get("listId")
                    })
            
            print(f"DEBUG: Response tiered_lists_raw: {tiered_lists_raw}")
            print(f"DEBUG: Response tieredListsList: {tieredListsList}")
            print(f"DEBUG: Response tiered_count: {record.get('tiered_count')}")
            
            variations_list = record.get("variations") or []
            variations_count = record.get("variations_count") or 0
            tiered_count = record.get("tiered_count") or 0
            
            # Determine listType, numberOfLevels, and tierNames from tiered lists
            # If listType was provided in the update, use it; otherwise infer from tiered_count
            if list_data.listType is not None:
                list_type = list_data.listType
            else:
                list_type = 'Multi-Level' if tiered_count > 0 else 'Single'
            
            # If numberOfLevels was provided, use it; otherwise calculate from tiered_count
            if list_data.numberOfLevels is not None:
                number_of_levels = list_data.numberOfLevels
            else:
                number_of_levels = tiered_count + 1 if tiered_count > 0 else 2
            
            # If tierNames were provided, use them; otherwise get from tieredListsList
            if list_data.tierNames is not None and len(list_data.tierNames) > 0:
                tier_names = list_data.tierNames
            else:
                tier_names = [tier.get("list", "") for tier in tieredListsList if tier and isinstance(tier, dict) and tier.get("list")]
            
            return {
                "id": record["id"],
                "sector": sector_str if sector_str != "ALL" else ["ALL"],
                "domain": domain_str if domain_str != "ALL" else ["ALL"],
                "country": country_str if country_str != "ALL" else ["ALL"],
                "set": record["set"],
                "grouping": record["grouping"],
                "list": record["list"],
                "format": record["format"] or "",
                "source": record["source"] or "",
                "upkeep": record["upkeep"] or "",
                "graph": record["graph"] or "",
                "origin": record["origin"] or "",
                "status": record["status"] or "Active",
                "variablesAttachedList": [],
                "listValuesList": listValuesList,
                "tieredListsList": tieredListsList,
                "variations": variations_count,
                "variationsList": variations_list,
                "listType": list_type,
                "numberOfLevels": number_of_levels,
                "tierNames": tier_names
            }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating list: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update list: {str(e)}")

@router.delete("/lists/{list_id}")
async def delete_list(list_id: str):
    """
    Delete a list and all its relationships from the CDM.
    This will delete the list node and all relationships (both incoming and outgoing).
    Connected nodes (like drivers, variables) will NOT be deleted, only the relationships.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            # Check if list exists first
            check_result = session.run("""
                MATCH (l:List {id: $id})
                RETURN l.id as id
            """, {"id": list_id})
            
            check_record = check_result.single()
            if not check_record:
                raise HTTPException(status_code=404, detail="List not found")
            
            # Delete the list and all its relationships using write transaction
            # DETACH DELETE will delete the node and all relationships (both incoming and outgoing)
            # but will NOT delete the connected nodes themselves
            def delete_tx(tx):
                # First, capture the ID before deletion since we can't access the node after DETACH DELETE
                check = tx.run("""
                    MATCH (l:List {id: $id})
                    RETURN l.id as id
                """, {"id": list_id})
                check_record = check.single()
                if not check_record:
                    return None
                
                # Then delete (can't return the node after deletion)
                tx.run("""
                    MATCH (l:List {id: $id})
                    DETACH DELETE l
                """, {"id": list_id})
                
                return check_record
            
            record = session.execute_write(delete_tx)
            if not record:
                raise HTTPException(status_code=404, detail="List not found")

            print(f"✅ Successfully deleted list {list_id}")
            return {"message": "List deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting list: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to delete list: {str(e)}")

@router.get("/lists/{list_id}/tiered-values")
async def get_tiered_list_values(list_id: str):
    """
    Get tiered list values for a specific list.
    Returns a structure that maps tier 1 values to arrays of tiered values.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # First, get the tiered list structure
            tiered_structure_result = session.run("""
                MATCH (l:List {id: $list_id})
                OPTIONAL MATCH (l)-[tier_rel:HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
                WITH l, tiered, tier_rel
                ORDER BY type(tier_rel)
                RETURN l.name as parent_list_name, 
                       collect(DISTINCT {listId: tiered.id, listName: tiered.name, tierNumber: type(tier_rel)}) as tiered_lists
            """, {"list_id": list_id})
            
            tiered_structure_record = tiered_structure_result.single()
            if not tiered_structure_record:
                return {}
            
            tiered_lists = tiered_structure_record.get("tiered_lists", [])
            if not tiered_lists:
                return {}
            
            # Build relationship pattern dynamically based on tiered lists
            # We need to traverse: List -> ListValue (tier 1) -> ListValue (tier 2) -> ListValue (tier 3) -> ...
            # The relationship types are dynamic: HAS_STATE_VALUE, HAS_CITY_VALUE, etc.
            
            # Get all tier 1 list values
            tier1_result = session.run("""
                MATCH (l:List {id: $list_id})-[r:HAS_LIST_VALUE]->(lv1:ListValue)
                RETURN lv1.value as tier1_value
                ORDER BY lv1.value
            """, {"list_id": list_id})
            
            tier1_values = [record["tier1_value"] for record in tier1_result if record["tier1_value"]]
            
            if not tier1_values:
                return {}
            
            # For each tier 1 value, traverse the tiered relationships
            result_data: Dict[str, List[List[str]]] = {}
            
            for tier1_value in tier1_values:
                # Find all complete paths from tier1_value through tiered relationships
                # We'll use a recursive CTE-like approach by finding all paths
                query = """
                    MATCH (l:List {id: $list_id})-[r1:HAS_LIST_VALUE]->(lv1:ListValue {value: $tier1_value})
                    MATCH path = (lv1)-[*1..10]->(lv:ListValue)
                    WHERE ALL(rel in relationships(path) WHERE type(rel) STARTS WITH 'HAS_' AND type(rel) ENDS WITH '_VALUE')
                      AND type(relationships(path)[0]) <> 'HAS_LIST_VALUE'
                      AND size(relationships(path)) <= 10
                    WITH lv1, path, relationships(path) as rels, nodes(path) as path_nodes
                    WHERE size(rels) > 0
                    WITH lv1, path_nodes, rels,
                         [node in path_nodes WHERE node <> lv1 | node.value] as tiered_values
                    RETURN DISTINCT tiered_values
                    ORDER BY size(tiered_values)
                """
                
                paths_result = session.run(query, {
                    "list_id": list_id, 
                    "tier1_value": tier1_value
                })
                
                tiered_arrays: List[List[str]] = []
                seen_paths = set()
                
                for path_record in paths_result:
                    tiered_values = path_record.get("tiered_values", [])
                    if tiered_values and len(tiered_values) > 0:
                        # Filter out empty values and create a unique key
                        filtered_values = [v for v in tiered_values if v]
                        if filtered_values:
                            path_key = tuple(filtered_values)
                            if path_key not in seen_paths:
                                seen_paths.add(path_key)
                                tiered_arrays.append(filtered_values)
                
                if tiered_arrays:
                    result_data[tier1_value] = tiered_arrays
            
            return result_data

    except Exception as e:
        print(f"Error fetching tiered list values: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch tiered list values: {str(e)}")

@router.get("/lists/{list_id}")
async def get_list(list_id: str):
    """
    Get a single list by ID.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (l:List {id: $id})
                OPTIONAL MATCH (s:Sector)-[:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (d:Domain)-[:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (c:Country)-[:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (v:Variable)-[:HAS_LIST]->(l)
                OPTIONAL MATCH (l)-[:HAS_LIST_VALUE]->(lv:ListValue)
                OPTIONAL MATCH (l)-[tier_rel:HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
                OPTIONAL MATCH (parent:List)-[parent_tier_rel:HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(l)
                WITH l, 
                     collect(DISTINCT s.name) as sectors,
                     collect(DISTINCT d.name) as domains,
                     collect(DISTINCT c.name) as countries,
                     count(DISTINCT v) as variables_count,
                     collect(DISTINCT lv.value) as list_values,
                     collect(DISTINCT {listId: tiered.id, set: tiered.set, grouping: tiered.grouping, list: tiered.name}) as tiered_lists,
                     count(DISTINCT parent) > 0 as has_incoming_tier,
                     size(collect(DISTINCT tiered.id)) as tiered_count
                RETURN l.id as id, l.name as list, l.set as set, l.grouping as grouping,
                       l.format as format, l.source as source, l.upkeep as upkeep,
                       l.graph as graph, l.origin as origin, l.status as status,
                       sectors, domains, countries, variables_count, list_values, tiered_lists, has_incoming_tier, tiered_count
            """, {"id": list_id})
            
            record = result.single()
            if not record:
                raise HTTPException(status_code=404, detail="List not found")
            
            sectors = record["sectors"] or []
            domains = record["domains"] or []
            countries = record["countries"] or []
            
            sector_str = "ALL" if "ALL" in sectors else (", ".join(sectors) if sectors else "ALL")
            domain_str = "ALL" if "ALL" in domains else (", ".join(domains) if domains else "ALL")
            country_str = "ALL" if "ALL" in countries else (", ".join(countries) if countries else "ALL")
            
            # Convert list values to ListValue format
            list_values = record.get("list_values") or []
            listValuesList = [{"id": str(i), "value": val} for i, val in enumerate(list_values) if val]
            
            # Convert tiered lists
            tiered_lists_raw = record.get("tiered_lists") or []
            tieredListsList = []
            for tier in tiered_lists_raw:
                if tier and tier.get("listId"):
                    tieredListsList.append({
                        "id": tier.get("listId"),
                        "set": tier.get("set", ""),
                        "grouping": tier.get("grouping", ""),
                        "list": tier.get("list", ""),
                        "listId": tier.get("listId")
                    })
            
            tiered_count = record.get("tiered_count") or 0
            list_type = 'Multi-Level' if tiered_count > 0 else 'Single'
            number_of_levels = tiered_count + 1 if tiered_count > 0 else 2
            tier_names = [tier.get("list", "") for tier in tieredListsList if tier.get("list")]
            
            return {
                "id": record["id"],
                "sector": sector_str if sector_str != "ALL" else ["ALL"],
                "domain": domain_str if domain_str != "ALL" else ["ALL"],
                "country": country_str if country_str != "ALL" else ["ALL"],
                "set": record["set"],
                "grouping": record["grouping"],
                "list": record["list"],
                "format": record["format"] or "",
                "source": record["source"] or "",
                "upkeep": record["upkeep"] or "",
                "graph": record["graph"] or "",
                "origin": record["origin"] or "",
                "status": record["status"] or "Active",
                "variables": record["variables_count"] or 0,
                "variablesAttachedList": [],
                "listValuesList": listValuesList,
                "tieredListsList": tieredListsList,
                "hasIncomingTier": record.get("has_incoming_tier", False),
                "listType": list_type,
                "numberOfLevels": number_of_levels,
                "tierNames": tier_names
            }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching list: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch list: {str(e)}")

@router.get("/lists/{list_id}/variable-relationships")
async def get_list_variable_relationships(list_id: str):
    """
    Get all variables that have a HAS_LIST relationship to the specified list.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (v:Variable)-[r:HAS_LIST]->(l:List {id: $list_id})
                OPTIONAL MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v)
                RETURN v.id as id, v.name as variable, v.section as section,
                       p.name as part, g.name as group,
                       v.formatI as formatI, v.formatII as formatII,
                       v.gType as gType, v.validation as validation,
                       v.default as default, v.graph as graph
            """, {"list_id": list_id})
            
            variables = []
            for record in result:
                variables.append({
                    "id": record["id"],
                    "part": record["part"] or "",
                    "section": record["section"] or "",
                    "group": record["group"] or "",
                    "variable": record["variable"] or record["name"] or "",
                    "name": record["variable"] or record["name"] or "",
                    "formatI": record["formatI"] or "",
                    "formatII": record["formatII"] or "",
                    "gType": record["gType"] or "",
                    "validation": record["validation"] or "",
                    "default": record["default"] or "",
                    "graph": record["graph"] or ""
                })
            
            return {"variables": variables}

    except Exception as e:
        print(f"Error fetching list variable relationships: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch list variable relationships: {str(e)}")

@router.post("/lists/{target_list_id}/clone-applicability/{source_list_id}")
async def clone_list_applicability(target_list_id: str, source_list_id: str):
    """
    Clone all variable applicability from a source list to a target list.
    Only works if the target list has no existing applicability.
    Creates HAS_LIST relationships from variables to the target list.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j.")
    
    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            # Check if target list exists
            target_check = session.run("""
                MATCH (l:List {id: $list_id})
                RETURN l.id as id, l.list as list_name
            """, list_id=target_list_id).single()
            
            if not target_check:
                raise HTTPException(status_code=404, detail=f"Target list with ID {target_list_id} not found")
            
            # Check if source list exists
            source_check = session.run("""
                MATCH (l:List {id: $list_id})
                RETURN l.id as id, l.list as list_name
            """, list_id=source_list_id).single()
            
            if not source_check:
                raise HTTPException(status_code=404, detail=f"Source list with ID {source_list_id} not found")
            
            # Check if target list already has applicability
            existing_rels_count = session.run("""
                MATCH (v:Variable)-[:HAS_LIST]->(l:List {id: $list_id})
                RETURN count(v) as rel_count
            """, list_id=target_list_id).single()
            
            if existing_rels_count and existing_rels_count["rel_count"] > 0:
                raise HTTPException(
                    status_code=400, 
                    detail="Target list already has applicability. Please delete existing applicability before cloning."
                )
            
            # Get all variables that have relationships to source list
            source_variables = session.run("""
                MATCH (v:Variable)-[:HAS_LIST]->(l:List {id: $source_id})
                RETURN DISTINCT v.id as variable_id
            """, source_id=source_list_id).data()
            
            if not source_variables:
                return {
                    "message": "Source list has no applicability to clone",
                    "cloned_count": 0
                }
            
            cloned_count = 0
            
            # Clone relationships
            for var_record in source_variables:
                variable_id = var_record["variable_id"]
                try:
                    # Create HAS_LIST relationship from variable to target list
                    result = session.run("""
                        MATCH (v:Variable {id: $variable_id})
                        MATCH (l:List {id: $target_id})
                        MERGE (v)-[r:HAS_LIST]->(l)
                        ON CREATE SET r.createdBy = "clone"
                        RETURN r
                    """, variable_id=variable_id, target_id=target_list_id)
                    
                    if result.single():
                        cloned_count += 1
                        print(f"✅ Cloned HAS_LIST relationship: Variable {variable_id} -> List {target_list_id}")
                except Exception as e:
                    print(f"⚠️ Error cloning relationship for variable {variable_id}: {e}")
            
            # Update the target list's variables count
            final_count = session.run("""
                MATCH (l:List {id: $list_id})
                SET l.variables = size([(v:Variable)-[:HAS_LIST]->(l) | v])
                RETURN l.variables as count
            """, list_id=target_list_id).single()
            
            return {
                "message": f"Successfully cloned {cloned_count} variable relationship(s)",
                "cloned_count": cloned_count
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error cloning list applicability: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to clone list applicability: {str(e)}")

@router.post("/lists/bulk-clone-applicability/{source_list_id}")
async def bulk_clone_list_applicability(source_list_id: str, target_list_ids: List[str] = Body(...)):
    """
    Clone all variable applicability from a source list to multiple target lists.
    Only works if all target lists have no existing applicability.
    Creates HAS_LIST relationships from variables to each target list.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j.")
    
    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            # Check if source list exists
            source_check = session.run("""
                MATCH (l:List {id: $list_id})
                RETURN l.id as id, l.list as list_name
            """, list_id=source_list_id).single()
            
            if not source_check:
                raise HTTPException(status_code=404, detail=f"Source list with ID {source_list_id} not found")
            
            # Check if all target lists exist and have no relationships
            for target_id in target_list_ids:
                target_check = session.run("""
                    MATCH (l:List {id: $list_id})
                    RETURN l.id as id, l.list as list_name
                """, list_id=target_id).single()
                
                if not target_check:
                    raise HTTPException(status_code=404, detail=f"Target list with ID {target_id} not found")
                
                # Check if target list already has applicability
                existing_rels_count = session.run("""
                    MATCH (v:Variable)-[:HAS_LIST]->(l:List {id: $list_id})
                    RETURN count(v) as rel_count
                """, list_id=target_id).single()
                
                if existing_rels_count and existing_rels_count["rel_count"] > 0:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Target list {target_id} already has applicability. Please delete existing applicability before cloning."
                    )
            
            # Get all variables that have relationships to source list
            source_variables = session.run("""
                MATCH (v:Variable)-[:HAS_LIST]->(l:List {id: $source_id})
                RETURN DISTINCT v.id as variable_id
            """, source_id=source_list_id).data()
            
            if not source_variables:
                return {
                    "message": "Source list has no applicability to clone",
                    "cloned_count": 0,
                    "targets_processed": len(target_list_ids)
                }
            
            total_cloned = 0
            
            # Clone to each target list
            for target_id in target_list_ids:
                target_cloned = 0
                
                for var_record in source_variables:
                    variable_id = var_record["variable_id"]
                    try:
                        result = session.run("""
                            MATCH (v:Variable {id: $variable_id})
                            MATCH (l:List {id: $target_id})
                            MERGE (v)-[r:HAS_LIST]->(l)
                            ON CREATE SET r.createdBy = "clone"
                            RETURN r
                        """, variable_id=variable_id, target_id=target_id)
                        
                        if result.single():
                            target_cloned += 1
                    except Exception as e:
                        print(f"⚠️ Error cloning relationship for variable {variable_id} to list {target_id}: {e}")
                
                # Update the target list's variables count
                session.run("""
                    MATCH (l:List {id: $list_id})
                    SET l.variables = size([(v:Variable)-[:HAS_LIST]->(l) | v])
                """, list_id=target_id)
                
                total_cloned += target_cloned
            
            return {
                "message": f"Successfully cloned applicability to {len(target_list_ids)} list(s)",
                "cloned_count": total_cloned,
                "targets_processed": len(target_list_ids)
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error bulk cloning list applicability: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to bulk clone list applicability: {str(e)}")

@router.get("/lists/{list_id}/variations")
async def get_list_variations(list_id: str):
    """Get all variations for a list"""
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Check if list exists
            list_check = session.run("""
                MATCH (l:List {id: $list_id})
                RETURN l.id as id
            """, list_id=list_id).single()
            
            if not list_check:
                raise HTTPException(status_code=404, detail="List not found")

            # Get variations
            variations_result = session.run("""
                MATCH (l:List {id: $list_id})-[:HAS_VARIATION]->(var:Variation)
                RETURN var.id as id, var.name as name
                ORDER BY var.name
            """, list_id=list_id)

            variations = []
            for var_record in variations_result:
                variations.append({
                    "id": var_record["id"],
                    "name": var_record["name"]
                })

            return {
                "variationsList": variations,
                "variations": len(variations)
            }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching list variations: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch list variations: {str(e)}")

@router.post("/lists/{list_id}/variations/upload", response_model=CSVUploadResponse)
async def bulk_upload_list_variations(list_id: str, file: UploadFile = File(...)):
    """Bulk upload variations for a list from CSV file"""
    print(f"DEBUG: bulk_upload_list_variations called with list_id={list_id}, file={file.filename}")
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV file")

    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        # Read CSV content and parse it robustly
        content = await file.read()
        print(f"CSV content length: {len(content)}")
        
        # Decode content and handle BOM
        try:
            text_content = content.decode('utf-8-sig')
        except UnicodeDecodeError:
            text_content = content.decode('utf-8')
        
        # Parse CSV manually to handle unquoted fields with spaces
        text_content = text_content.replace('\r\n', '\n').replace('\r', '\n')
        
        lines = text_content.strip().split('\n')
        if not lines:
            raise HTTPException(status_code=400, detail="Empty CSV file")
        
        # Get headers from first line
        headers = [h.strip() for h in lines[0].split(',')]
        
        # Parse data rows
        rows = []
        for i, line in enumerate(lines[1:], start=2):
            if not line.strip():
                continue
            
            values = [v.strip() for v in line.split(',')]
            
            row = {}
            for j, header in enumerate(headers):
                row[header] = values[j] if j < len(values) else ""
            rows.append(row)
                    
        print(f"Successfully parsed {len(rows)} rows from CSV")
    except Exception as e:
        print(f"Error in CSV parsing: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"CSV parsing error: {str(e)}")
    
    created_variations = []
    errors = []
    skipped_count = 0
    
    try:
        with driver.session() as session:
            print(f"DEBUG: Starting session for list {list_id}")
            # Check if list exists
            list_check = session.run("""
                MATCH (l:List {id: $list_id})
                RETURN l.id as id
            """, list_id=list_id).single()
            
            if not list_check:
                raise HTTPException(status_code=404, detail="List not found")

            # Get existing variations for this list to check for duplicates
            existing_variations_result = session.run("""
                MATCH (l:List {id: $list_id})-[:HAS_VARIATION]->(var:Variation)
                RETURN var.name as name
            """, list_id=list_id)
            
            existing_variation_names = {record["name"].lower() for record in existing_variations_result}
            
            # Get all global variations to check for existing ones
            global_variations_result = session.run("""
                MATCH (var:Variation)
                RETURN var.name as name, var.id as id
            """)
            
            global_variations = {record["name"].lower(): {"id": record["id"], "original_name": record["name"]} for record in global_variations_result}
            print(f"DEBUG: Found {len(global_variations)} global variations")
            
            # Track variations within this CSV upload to detect duplicates within the file
            csv_variation_names = set()
            
            for row_num, row in enumerate(rows, start=2):
                # Get variation name from the row
                variation_name = row.get('Variation', '').strip()
                if not variation_name:
                    errors.append(f"Row {row_num}: Variation name is required")
                    continue
                
                # Check for duplicates within the CSV file itself (case-insensitive)
                if variation_name.lower() in csv_variation_names:
                    errors.append(f"Row {row_num}: Duplicate variation name '{variation_name}' found within the CSV file")
                    continue
                
                # Check for duplicates (case-insensitive) - only for this specific list
                if variation_name.lower() in existing_variation_names:
                    skipped_count += 1
                    print(f"Skipping duplicate variation for this list: {variation_name}")
                    continue
                
                # Add to CSV tracking set
                csv_variation_names.add(variation_name.lower())
                
                # Check if variation exists globally using our pre-loaded data (case-insensitive)
                if variation_name.lower() in global_variations:
                    # Variation exists globally, just connect it to this list
                    print(f"Connecting existing global variation to list: {variation_name}")
                    
                    variation_id = global_variations[variation_name.lower()]["id"]
                    
                    # Check if this variation is already connected to this list
                    already_connected = session.run("""
                        MATCH (l:List {id: $list_id})-[:HAS_VARIATION]->(var:Variation {id: $variation_id})
                        RETURN var.id as id
                    """, list_id=list_id, variation_id=variation_id).single()
                    
                    if not already_connected:
                        # Connect existing variation to list (MERGE to avoid duplicate relationships)
                        session.run("""
                            MATCH (l:List {id: $list_id})
                            MATCH (var:Variation {id: $variation_id})
                            MERGE (l)-[:HAS_VARIATION]->(var)
                        """, list_id=list_id, variation_id=variation_id)
                        
                        existing_variation_names.add(variation_name.lower())
                        
                        created_variations.append({
                            "id": variation_id,
                            "name": variation_name
                        })
                    else:
                        print(f"Variation {variation_name} already connected to this list, skipping")
                        skipped_count += 1
                else:
                    # Create new variation
                    print(f"Creating new variation: {variation_name}")
                    variation_id = str(uuid.uuid4())
                    
                    try:
                        # Create variation node
                        session.run("""
                            CREATE (var:Variation {
                                id: $variation_id,
                                name: $variation_name
                            })
                        """, variation_id=variation_id, variation_name=variation_name)
                        
                        # Connect variation to list
                        session.run("""
                            MATCH (l:List {id: $list_id})
                            MATCH (var:Variation {id: $variation_id})
                            CREATE (l)-[:HAS_VARIATION]->(var)
                        """, list_id=list_id, variation_id=variation_id)
                        
                        existing_variation_names.add(variation_name.lower())
                        
                        created_variations.append({
                            "id": variation_id,
                            "name": variation_name
                        })
                    except Exception as create_error:
                        print(f"Error creating variation {variation_name}: {create_error}")
                        errors.append(f"Row {row_num}: Failed to create variation '{variation_name}': {str(create_error)}")
    
    except HTTPException:
        raise
    except Exception as session_error:
        print(f"DEBUG: Session error: {str(session_error)}")
        errors.append(f"Database session error: {str(session_error)}")

    return CSVUploadResponse(
        success=True,
        message=f"Successfully created {len(created_variations)} variations. Skipped {skipped_count} duplicates.",
        created_count=len(created_variations),
        error_count=len(errors),
        errors=errors
    )

