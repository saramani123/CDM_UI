from fastapi import APIRouter, HTTPException, status, Body, UploadFile, File, Request
from fastapi.encoders import jsonable_encoder
import json
from typing import List, Dict, Any, Optional
import uuid
import re
from pydantic import BaseModel, ConfigDict, field_validator, model_validator
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
    model_config = ConfigDict(extra='allow')  # Allow extra fields like _variations in tieredListValues
    
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
    tieredListValues: Optional[Any] = None  # Dict mapping tier 1 value to list of tiered value arrays, can also contain _variations key (using Any to avoid Pydantic validation issues with nested dicts)
    variationsList: Optional[List[dict]] = None  # List of variations to create for the list

class ListUpdateRequest(BaseModel):
    model_config = ConfigDict(extra='allow')  # Allow extra fields like _variations in tieredListValues
    
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
    listValuesVariations: Optional[Dict[str, List[str]]] = None  # Dict mapping list value to list of its variations (abbreviated versions, can have multiple)
    tieredListsList: Optional[List[TieredListRequest]] = None
    tieredListValues: Optional[Any] = None  # Dict mapping tier 1 value to list of tiered value arrays, can also contain _variations key (using Any to avoid Pydantic validation issues with nested dicts)
    variationsList: Optional[List[dict]] = None  # List of variations to append to the list
    listType: Optional[str] = None  # 'Single' or 'Multi-Level'
    numberOfLevels: Optional[int] = None  # Number of tiers (2-10)
    tierNames: Optional[List[str]] = None  # Names of tier lists (e.g., ['State', 'City'])

async def get_child_lists(session, parent_list_id: str) -> List[str]:
    """
    Get all child list IDs for a parent list via HAS_TIER_X relationships.
    Returns a list of child list IDs.
    """
    try:
        result = session.run("""
            MATCH (parent:List {id: $parent_id})-[r:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(child:List)
            RETURN child.id as child_id
            ORDER BY 
                CASE type(r)
                    WHEN 'HAS_TIER_1' THEN 1
                    WHEN 'HAS_TIER_2' THEN 2
                    WHEN 'HAS_TIER_3' THEN 3
                    WHEN 'HAS_TIER_4' THEN 4
                    WHEN 'HAS_TIER_5' THEN 5
                    WHEN 'HAS_TIER_6' THEN 6
                    WHEN 'HAS_TIER_7' THEN 7
                    WHEN 'HAS_TIER_8' THEN 8
                    WHEN 'HAS_TIER_9' THEN 9
                    WHEN 'HAS_TIER_10' THEN 10
                    ELSE 99
                END
        """, parent_id=parent_list_id)
        
        child_ids = [record["child_id"] for record in result if record["child_id"]]
        print(f"Found {len(child_ids)} child lists for parent list {parent_list_id}: {child_ids}")
        return child_ids
    except Exception as e:
        print(f"Error getting child lists: {e}")
        import traceback
        traceback.print_exc()
        return []

async def cascade_parent_changes_to_children(session, parent_list_id: str, list_data: ListUpdateRequest):
    """
    Cascade parent list changes to all child lists (tier lists).
    Updates: sector, domain, country, set, grouping, format, source, upkeep, graph, origin.
    """
    try:
        child_ids = await get_child_lists(session, parent_list_id)
        if not child_ids:
            print(f"No child lists found for parent {parent_list_id}, skipping cascade")
            return
        
        print(f"Cascading changes from parent list {parent_list_id} to {len(child_ids)} child lists")
        
        # Get parent list's current values to use for children
        parent_result = session.run("""
            MATCH (l:List {id: $id})
            RETURN l.set as set, l.grouping as grouping, l.format as format, 
                   l.source as source, l.upkeep as upkeep, l.graph as graph, l.origin as origin
        """, {"id": parent_list_id})
        parent_record = parent_result.single()
        if not parent_record:
            print(f"Parent list {parent_list_id} not found, cannot cascade")
            return
        
        # Determine which values to use (from update or current parent values)
        set_name = list_data.set if list_data.set is not None else parent_record["set"]
        grouping_name = list_data.grouping if list_data.grouping is not None else parent_record["grouping"]
        format_val = list_data.format if list_data.format is not None else parent_record["format"]
        source_val = list_data.source if list_data.source is not None else parent_record["source"]
        upkeep_val = list_data.upkeep if list_data.upkeep is not None else parent_record["upkeep"]
        graph_val = list_data.graph if list_data.graph is not None else parent_record["graph"]
        origin_val = list_data.origin if list_data.origin is not None else parent_record["origin"]
        
        # Get parent's current driver values (after parent update, so these reflect the updated values)
        parent_drivers_result = session.run("""
            MATCH (l:List {id: $id})
            OPTIONAL MATCH (s:Sector)-[:IS_RELEVANT_TO]->(l)
            OPTIONAL MATCH (d:Domain)-[:IS_RELEVANT_TO]->(l)
            OPTIONAL MATCH (c:Country)-[:IS_RELEVANT_TO]->(l)
            RETURN collect(DISTINCT s.name) as sectors, 
                   collect(DISTINCT d.name) as domains, 
                   collect(DISTINCT c.name) as countries
        """, {"id": parent_list_id})
        parent_drivers = parent_drivers_result.single()
        sectors = parent_drivers["sectors"] if parent_drivers and parent_drivers["sectors"] else []
        domains = parent_drivers["domains"] if parent_drivers and parent_drivers["domains"] else []
        countries = parent_drivers["countries"] if parent_drivers and parent_drivers["countries"] else []
        
        # Convert to comma-separated strings (same format as used in create_list_driver_relationships)
        sector_str = ', '.join(sectors) if sectors else 'ALL'
        domain_str = ', '.join(domains) if domains else 'ALL'
        country_str = ', '.join(countries) if countries else 'ALL'
        
        # Update each child list
        for child_id in child_ids:
            print(f"Updating child list {child_id} with parent values")
            
            # Build update fields for child list
            update_fields = []
            params = {"id": child_id}
            
            # Update metadata fields if they changed on parent
            if list_data.set is not None:
                update_fields.append("l.set = $set")
                params["set"] = set_name
            if list_data.grouping is not None:
                update_fields.append("l.grouping = $grouping")
                params["grouping"] = grouping_name
            if list_data.format is not None:
                update_fields.append("l.format = $format")
                params["format"] = format_val
            if list_data.source is not None:
                update_fields.append("l.source = $source")
                params["source"] = source_val
            if list_data.upkeep is not None:
                update_fields.append("l.upkeep = $upkeep")
                params["upkeep"] = upkeep_val
            if list_data.graph is not None:
                update_fields.append("l.graph = $graph")
                params["graph"] = graph_val
            if list_data.origin is not None:
                update_fields.append("l.origin = $origin")
                params["origin"] = origin_val
            
            # Update child list properties
            if update_fields:
                update_query = f"""
                    MATCH (l:List {{id: $id}})
                    SET {', '.join(update_fields)}
                """
                session.run(update_query, params)
                print(f"Updated child list {child_id} properties: {', '.join(update_fields)}")
            
            # Update taxonomy relationships if set or grouping changed
            if list_data.set is not None or list_data.grouping is not None:
                session.run("""
                    MATCH (l:List {id: $id})
                    OPTIONAL MATCH (g:Grouping)-[r:HAS_LIST]->(l)
                    DELETE r
                    WITH l
                    MERGE (s:Set {name: $set})
                    MERGE (g:Grouping {name: $grouping})
                    MERGE (s)-[:HAS_GROUPING]->(g)
                    MERGE (g)-[:HAS_LIST]->(l)
                """, {"id": child_id, "set": set_name, "grouping": grouping_name})
                print(f"Updated child list {child_id} taxonomy: set={set_name}, grouping={grouping_name}")
            
            # Always update driver relationships for child lists to match parent
            # (Parent's drivers were already updated above, so we use the current parent values)
            await create_list_driver_relationships(session, child_id, sector_str, domain_str, country_str)
            print(f"Updated child list {child_id} drivers to match parent: sector={sector_str}, domain={domain_str}, country={country_str}")
        
        print(f"✅ Successfully cascaded changes to {len(child_ids)} child lists")
        
    except Exception as e:
        print(f"Error cascading changes to child lists: {e}")
        import traceback
        traceback.print_exc()
        # Don't raise - we don't want to fail the parent update if child update fails

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

async def create_value_variation(session, list_value: str, variation_value: str, list_name: str, tier: Optional[int] = None):
    """
    Create a Variation node and link it to a ListValue node with "HAS_VALUE_VARIATION" relationship.
    """
    try:
        if not variation_value or not variation_value.strip():
            return
        
        variation_value = variation_value.strip()
        
        # Create or get Variation node
        # Use a unique ID for the variation based on the value
        variation_id = str(uuid.uuid4())
        
        # Build the WHERE clause based on whether tier is provided
        if tier is not None:
            where_clause = "(lv.listName = $list_name OR lv.listName IS NULL) AND lv.tier = $tier"
        else:
            where_clause = "(lv.listName = $list_name OR lv.listName IS NULL) AND (lv.tier IS NULL OR lv.tier = 0)"
        
        # Create Variation node and relationship
        query = f"""
            MATCH (lv:ListValue {{value: $list_value}})
            WHERE {where_clause}
            MERGE (var:Variation {{name: $variation_value, valueVariation: true}})
            ON CREATE SET var.id = $variation_id, var.valueVariation = true
            MERGE (lv)-[:HAS_VALUE_VARIATION]->(var)
        """
        
        params = {
            "list_value": list_value,
            "variation_value": variation_value,
            "list_name": list_name,
            "variation_id": variation_id
        }
        if tier is not None:
            params["tier"] = tier
        
        session.run(query, **params)
        
        print(f"✅ Created value variation: {list_value} -> {variation_value}")
    except Exception as e:
        print(f"Error creating value variation for {list_value}: {e}")
        import traceback
        traceback.print_exc()

async def create_list_values(session, list_id: str, list_values: List[Any], replace: bool = False, variations: Optional[Dict[str, str]] = None):
    """
    Create list value nodes and HAS_LIST_VALUE relationships from List to ListValue nodes.
    Prevents duplicate values within the same list (case-insensitive).
    
    Args:
        session: Neo4j session
        list_id: ID of the list
        list_values: List of dicts with 'value' key
        replace: If True, replace all existing list values. If False, append only new values.
        variations: Optional dict mapping list value to its variation (abbreviated version)
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
                
                # Create variations if present (can have multiple variations per value)
                if variations and value in variations:
                    variation_values = variations[value]
                    # Get list name for variation
                    list_name_result = session.run("""
                        MATCH (l:List {id: $list_id})
                        RETURN l.name as name
                    """, list_id=list_id)
                    list_name_record = list_name_result.single()
                    list_name = list_name_record["name"] if list_name_record else ""
                    
                    # Handle array of variations
                    if isinstance(variation_values, list):
                        for var_value in variation_values:
                            if var_value and var_value.strip():
                                await create_value_variation(session, value, var_value.strip(), list_name)
                    elif isinstance(variation_values, str) and variation_values.strip():
                        # Single variation as string (could be comma-separated)
                        var_list = [v.strip() for v in variation_values.split(',') if v.strip()]
                        for var_value in var_list:
                            await create_value_variation(session, value, var_value, list_name)
        
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
        
        for index, tier_name in enumerate(tier_names, start=1):  # Start at tier 1
            if not tier_name or not tier_name.strip():
                print(f"⚠️ Skipping empty tier name at index {index}")
                continue
            
            tier_name = tier_name.strip()
            tier_number = index  # Tier 1, Tier 2, etc.
            
            # Check if tier list already exists with this name, set, and grouping
            existing_result = session.run("""
                MATCH (l:List {name: $tier_name, set: $set, grouping: $grouping})
                RETURN l.id as id
            """, tier_name=tier_name, set=parent_set, grouping=parent_grouping)
            
            existing_record = existing_result.single()
            if existing_record:
                tier_list_id = existing_record["id"]
                # Update tier property if it exists
                session.run("""
                    MATCH (l:List {id: $tier_list_id})
                    SET l.tier = $tier_number
                """, tier_list_id=tier_list_id, tier_number=tier_number)
                print(f"✅ Tier list '{tier_name}' already exists with id {tier_list_id}, set tier={tier_number}")
            else:
                # Create new tier list node with tier property
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
                        status: 'Active',
                        tier: $tier_number
                    })
                    MERGE (g)-[:HAS_LIST]->(l)
                """, tier_list_id=tier_list_id, tier_name=tier_name, set=parent_set, grouping=parent_grouping, tier_number=tier_number)
                print(f"✅ Created tier list node '{tier_name}' with id {tier_list_id}, tier={tier_number}")
            
            tier_list_ids.append(tier_list_id)
        
        return tier_list_ids
        
    except Exception as e:
        print(f"Error creating tier list nodes: {e}")
        raise

async def create_tiered_list_relationships(session, list_id: str, tiered_lists: List[Dict[str, Any]]):
    """
    Create tiered list relationships (HAS_TIER_1, HAS_TIER_2, etc.) from parent list to tiered lists.
    Replaces all existing tiered relationships.
    Also deletes tiered value relationships for removed tiers.
    """
    try:
        print(f"Creating tiered list relationships for list {list_id}")
        
        # Get current tiered list IDs before deletion
        current_tiered_result = session.run("""
            MATCH (l:List {id: $list_id})-[r:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
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
            MATCH (l:List {id: $list_id})-[r:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
            DELETE r
        """, list_id=list_id)
        print(f"Deleted all existing tiered relationships for list {list_id}")
        
        created_count = 0
        
        for tiered_list in tiered_lists:
            # Get tier number from tiered_list dict if available, otherwise use index
            tier_number = None
            if isinstance(tiered_list, dict):
                tier_number = tiered_list.get("tier")
            elif hasattr(tiered_list, "tier"):
                tier_number = getattr(tiered_list, "tier", None)
            
            # If tier number not in dict, try to get from database
            tiered_list_id = tiered_list.get("listId") if isinstance(tiered_list, dict) else getattr(tiered_list, "listId", None)
            if not tier_number and tiered_list_id:
                tier_result = session.run("MATCH (l:List {id: $tier_id}) RETURN l.tier as tier", tier_id=tiered_list_id)
                tier_record = tier_result.single()
                if tier_record:
                    tier_number = tier_record.get("tier")
            
            # Fallback to index if tier number still not found (shouldn't happen if data is correct)
            if not tier_number:
                # Find index in sorted list
                for idx, tl in enumerate(tiered_lists, start=1):
                    tl_id = tl.get("listId") if isinstance(tl, dict) else getattr(tl, "listId", None)
                    if tl_id == tiered_list_id:
                        tier_number = min(idx, 10)
                        break
                if not tier_number:
                    print(f"⚠️ WARNING: Could not determine tier number for tiered list {tiered_list_id}, skipping")
                    continue
            
            tier_number = min(int(tier_number), 10)  # Cap at tier 10 and ensure it's an integer
            
            if not tiered_list_id:
                print(f"⚠️ Skipping tiered list entry - missing listId")
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

async def create_tiered_list_values(session, list_id: str, tiered_lists: List[Dict[str, Any]], tiered_values: Dict[str, Any]):
    """
    Create tiered list values with relationships.
    Parent list has NO values. Only tier lists have values.
    tiered_values: Dict mapping Tier 1 value to list of arrays, where each array contains values for Tier 2, Tier 3, etc.
    Also supports variations: tiered_values can have a "_variations" key with format:
    {
      "_variations": {
        "Tier1Value": {
          "Tier1Value": "variation1",
          "Tier2Value1": "variation2",
          ...
        }
      }
    }
    For example: {"USA": [["California", "Los Angeles"], ["Texas", "Houston"]], "Canada": [["Ontario", "Toronto"]]}
    Where "USA" is a Tier 1 value, "California"/"Texas" are Tier 2 values, "Los Angeles"/"Houston" are Tier 3 values.
    """
    try:
        print(f"Creating tiered list values for list {list_id}")
        
        # Extract variations if present
        variations = {}
        if "_variations" in tiered_values:
            variations = tiered_values.pop("_variations")
            print(f"Found variations data: {variations}")
            # Ensure variations are in correct format: { "Tier1Value": { "Tier1Value": ["var1", "var2"], "Tier2Value": ["var3"] } }
            # Convert any string values to lists
            for tier1_value, value_variations in variations.items():
                if isinstance(value_variations, dict):
                    for value, vars_data in value_variations.items():
                        if not isinstance(vars_data, list):
                            # Convert single string to list, or split comma-separated
                            if isinstance(vars_data, str):
                                variations[tier1_value][value] = [v.strip() for v in vars_data.split(',') if v.strip()]
                            else:
                                variations[tier1_value][value] = []
            # Convert variations format: { "Tier1Value": { "Tier1Value": ["var1", "var2"], "Tier2Value": ["var3"] } }
            # to a format we can use: { "Tier1Value": { "Tier1Value": ["var1", "var2"], "Tier2Value": ["var3"] } }
            # (already in correct format, just ensure values are lists)
            for tier1_value, value_variations in variations.items():
                if isinstance(value_variations, dict):
                    for value, vars_list in value_variations.items():
                        if not isinstance(vars_list, list):
                            # Convert single string to list
                            variations[tier1_value][value] = [vars_list] if vars_list else []
        
        # Get the tiered list structure
        if not tiered_lists or len(tiered_lists) == 0:
            print("No tiered lists defined, skipping tiered values")
            return 0
        
        # Get tier list names and IDs (Tier 1, Tier 2, etc.)
        tier_list_names = []
        tier_list_ids = []
        
        # Get tiered list names and IDs (these are Tier 1, Tier 2, etc.)
        tier_info_list = []
        for tier in tiered_lists:
            tier_list_id = tier.get("listId") if isinstance(tier, dict) else getattr(tier, "listId", None)
            if tier_list_id:
                # Try to get tier from the tiered_lists dict first, then from database
                tier_number_from_dict = tier.get("tier") if isinstance(tier, dict) else None
                tier_list_result = session.run("MATCH (l:List {id: $tier_id}) RETURN l.name as name, l.tier as tier", tier_id=tier_list_id)
                tier_list_record = tier_list_result.single()
                if tier_list_record:
                    # Use tier from dict if available, otherwise from database, otherwise 0
                    tier_number = tier_number_from_dict or tier_list_record.get("tier") or 0
                    tier_info_list.append({
                        'id': tier_list_id,
                        'name': tier_list_record["name"],
                        'tier': tier_number
                    })
        
        # Sort by tier number to ensure correct order (Tier 1, Tier 2, etc.)
        tier_info_list.sort(key=lambda x: x['tier'])
        tier_list_ids = [x['id'] for x in tier_info_list]
        tier_list_names = [x['name'] for x in tier_info_list]
        
        print(f"Found {len(tier_list_names)} tiered lists")
        print(f"Tier structure (ordered by tier number): {[(x['name'], x['tier']) for x in tier_info_list]}")
        
        if len(tier_list_names) == 0:
            print("No tier lists found, skipping tiered values")
            return 0
        
        created_count = 0
        
        # Process each Tier 1 value
        for tier1_value, tiered_value_arrays in tiered_values.items():
            if not tier1_value or not tier1_value.strip():
                continue
            
            tier1_value = tier1_value.strip()
            tier1_list_id = tier_list_ids[0]  # First tier list (Tier 1)
            tier1_list_name = tier_list_names[0]
            
            # Create or get the Tier 1 list value node (connected to Tier 1 list, NOT parent list)
            tier1_lv_result = session.run("""
                MATCH (tier1_list:List {id: $tier1_list_id})
                MERGE (lv1:ListValue {value: $value, tier: 1, listName: $tier1_list_name})
                ON CREATE SET lv1.tier = 1, lv1.listName = $tier1_list_name
                ON MATCH SET lv1.tier = 1, lv1.listName = $tier1_list_name
                MERGE (tier1_list)-[:HAS_LIST_VALUE]->(lv1)
                RETURN lv1
            """, tier1_list_id=tier1_list_id, value=tier1_value, tier1_list_name=tier1_list_name)
            
            if not tier1_lv_result.single():
                print(f"Failed to create/get Tier 1 list value: {tier1_value}")
                continue
            
            # Create variations for Tier 1 value if present (can have multiple variations)
            tier1_variations = variations.get(tier1_value, {})
            if tier1_value in tier1_variations:
                variation_values = tier1_variations[tier1_value]
                if isinstance(variation_values, list):
                    for var_value in variation_values:
                        if var_value and var_value.strip():
                            await create_value_variation(session, tier1_value, var_value.strip(), tier1_list_name, 1)
                elif variation_values and variation_values.strip():
                    # Single variation as string
                    await create_value_variation(session, tier1_value, variation_values.strip(), tier1_list_name, 1)
            
            # Process each array of tiered values (Tier 2, Tier 3, etc.)
            for tiered_value_array in tiered_value_arrays:
                if not tiered_value_array or len(tiered_value_array) == 0:
                    continue
                
                # Create chain of relationships: Tier1 -> Tier2 -> Tier3 -> ...
                previous_lv_value = tier1_value
                previous_tier_number = 1
                
                for tier_index, tier_value in enumerate(tiered_value_array):
                    if not tier_value or not tier_value.strip():
                        break
                    
                    tier_value = tier_value.strip()
                    
                    # Check if we have enough tier lists for this tier index
                    # tier_index 0 = Tier 2, tier_index 1 = Tier 3, etc.
                    if tier_index + 1 >= len(tier_list_names) or tier_index + 1 >= len(tier_list_ids):
                        print(f"⚠️ WARNING: Not enough tier lists for tier index {tier_index}. Expected Tier {tier_index + 2} but only have {len(tier_list_names)} tiers.")
                        break
                    
                    current_tier_number = tier_index + 2  # Tier 2, Tier 3, etc.
                    current_tier_list_id = tier_list_ids[tier_index + 1]
                    current_tier_list_name = tier_list_names[tier_index + 1]
                    
                    # Relationship type: HAS_TIER_2_VALUE, HAS_TIER_3_VALUE, etc.
                    relationship_type = f"HAS_TIER_{current_tier_number}_VALUE"
                    
                    # Create or get the current tier list value node
                    # Get previous tier list name for matching
                    prev_tier_list_name = tier_list_names[tier_index] if tier_index > 0 else tier1_list_name
                    
                    # First, verify the previous value exists
                    prev_check = session.run("""
                        MATCH (prev:ListValue {value: $prev_value, tier: $prev_tier_number})
                        WHERE prev.listName = $prev_tier_list_name OR prev.listName IS NULL
                        RETURN prev
                        LIMIT 1
                    """, prev_value=previous_lv_value, prev_tier_number=previous_tier_number, prev_tier_list_name=prev_tier_list_name)
                    
                    if not prev_check.single():
                        print(f"❌ Previous ListValue not found: value={previous_lv_value}, tier={previous_tier_number}, listName={prev_tier_list_name}")
                        print(f"   Skipping tier value: {tier_value} (Tier {current_tier_number})")
                        break
                    
                    query = f"""
                        MATCH (prev:ListValue {{value: $prev_value, tier: $prev_tier_number}})
                        WHERE prev.listName = $prev_tier_list_name OR prev.listName IS NULL
                        MATCH (current_tier_list:List {{id: $current_tier_list_id}})
                        MERGE (current:ListValue {{value: $tier_value, tier: $current_tier_number}})
                        ON CREATE SET current.tier = $current_tier_number, current.listName = $current_tier_list_name
                        ON MATCH SET current.tier = $current_tier_number, current.listName = $current_tier_list_name
                        MERGE (prev)-[r:{relationship_type}]->(current)
                        MERGE (current_tier_list)-[:HAS_LIST_VALUE]->(current)
                        RETURN current
                    """
                    
                    result = session.run(query, 
                        prev_value=previous_lv_value,
                        prev_tier_number=previous_tier_number,
                        prev_tier_list_name=prev_tier_list_name,
                        tier_value=tier_value,
                        current_tier_number=current_tier_number,
                        current_tier_list_name=current_tier_list_name,
                        current_tier_list_id=current_tier_list_id
                    )
                    
                    record = result.single()
                    if record:
                        created_count += 1
                        
                        # Create variations for this tier value if present (can have multiple variations)
                        if tier1_value in variations:
                            tier_variations = variations[tier1_value]
                            if tier_value in tier_variations:
                                variation_values = tier_variations[tier_value]
                                if isinstance(variation_values, list):
                                    # Multiple variations for this value
                                    for var_value in variation_values:
                                        if var_value and var_value.strip():
                                            await create_value_variation(session, tier_value, var_value.strip(), current_tier_list_name, current_tier_number)
                                elif variation_values and variation_values.strip():
                                    # Single variation as string
                                    await create_value_variation(session, tier_value, variation_values.strip(), current_tier_list_name, current_tier_number)
                        
                        previous_lv_value = tier_value
                        previous_tier_number = current_tier_number
                        print(f"✅ Created relationship: {previous_lv_value} -> {tier_value} (Tier {current_tier_number})")
                    else:
                        print(f"❌ Failed to create relationship for {tier_value} (Tier {current_tier_number})")
                        print(f"   Previous value: {previous_lv_value}, Tier list: {current_tier_list_name}")
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
                OPTIONAL MATCH (l)-[tier_rel:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
                OPTIONAL MATCH (parent:List)-[parent_tier_rel:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(l)
                OPTIONAL MATCH (l)-[:HAS_VARIATION]->(var:Variation)
                WITH l, s, g, 
                     collect(DISTINCT sector.name) as sectors,
                     collect(DISTINCT domain.name) as domains,
                     collect(DISTINCT country.name) as countries,
                     count(DISTINCT v) as variables_count,
                     collect(DISTINCT lv.value) as list_values,
                     collect(DISTINCT {listId: tiered.id, set: tiered.set, grouping: tiered.grouping, list: tiered.name, tier: tiered.tier, relType: type(tier_rel)}) as tiered_lists,
                     count(DISTINCT parent) > 0 as has_incoming_tier,
                     head(collect(DISTINCT type(parent_tier_rel))) as parent_tier_rel_type,
                     count(DISTINCT var) as variations_count,
                     collect(DISTINCT {id: var.id, name: var.name}) as variations,
                     size(collect(DISTINCT tiered.id)) as tiered_count
                WITH l, s, g, sectors, domains, countries, variables_count, list_values, tiered_lists, 
                     has_incoming_tier, parent_tier_rel_type, variations_count, variations, tiered_count,
                     l.tier as list_tier_property,
                     CASE 
                       WHEN l.tier IS NOT NULL THEN 
                         toInteger(l.tier)
                       WHEN parent_tier_rel_type IS NOT NULL THEN 
                         toInteger(substring(parent_tier_rel_type, 9))  // Extract number from "HAS_TIER_X" (e.g., "HAS_TIER_1" -> 1)
                       ELSE NULL 
                     END as tier_number
                RETURN l.id as id, l.name as list, l.set as set, l.grouping as grouping,
                       l.format as format, l.source as source, l.upkeep as upkeep,
                       l.graph as graph, l.origin as origin, l.status as status,
                       s.name as set_name, g.name as grouping_name,
                       sectors, domains, countries, variables_count, list_values, tiered_lists, has_incoming_tier,
                       variations_count, variations, tiered_count, tier_number
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
                # Filter out None/empty values and ensure we have strings
                list_values = [val for val in list_values if val and str(val).strip()]
                listValuesList = [{"id": str(i), "value": val} for i, val in enumerate(list_values) if val]
                
                # Convert tiered lists - use tier property from query result
                tiered_lists_raw = record.get("tiered_lists") or []
                tieredListsList = []
                tier_list_info_with_tier = []
                
                for tier in tiered_lists_raw:
                    if tier and tier.get("listId"):
                        tier_list_id = tier.get("listId")
                        # Get tier number from query result (tier property or extract from relType)
                        tier_number = tier.get("tier")
                        if not tier_number:
                            # Try to extract from relationship type
                            rel_type = tier.get("relType", "")
                            if rel_type and rel_type.startswith("HAS_TIER_"):
                                try:
                                    tier_number = int(rel_type.replace("HAS_TIER_", ""))
                                except:
                                    tier_number = None
                        
                        tier_info = {
                            "id": tier_list_id,
                            "set": tier.get("set", ""),
                            "grouping": tier.get("grouping", ""),
                            "list": tier.get("list", ""),
                            "listId": tier_list_id,
                            "tier": tier_number
                        }
                        tieredListsList.append(tier_info)
                        tier_list_info_with_tier.append({
                            "name": tier.get("list", ""),
                            "tier": tier_number or 999  # Use high number if tier not set
                        })
                
                # Sort tier names by tier number to ensure correct order
                tier_list_info_with_tier.sort(key=lambda x: x.get("tier", 999))
                # ALSO sort tieredListsList by tier number to ensure correct order in response
                tieredListsList.sort(key=lambda x: x.get("tier", 999))
                
                variations_list = record.get("variations") or []
                variations_count = record.get("variations_count") or 0
                tiered_count = record.get("tiered_count") or 0
                
                # Determine listType, numberOfLevels, and tierNames from tiered lists
                list_type = 'Multi-Level' if tiered_count > 0 else 'Single'
                number_of_levels = tiered_count if tiered_count > 0 else 2
                tier_names = [t["name"] for t in tier_list_info_with_tier if t.get("name")]
                
                tier_number = record.get("tier_number")
                
                # Calculate total values count and sample values
                # For single lists: use list_values count
                # For multi-level lists: count all values across all tiers
                if tiered_count == 0:
                    # Single list: count distinct values
                    # Filter out None/empty values
                    filtered_list_values = [val for val in list_values if val and str(val).strip()]
                    total_values_count = len(filtered_list_values)
                    sample_values = filtered_list_values[:3] if filtered_list_values else []
                    print(f"DEBUG: Single list {record['list']} (id: {record['id']}) - totalValuesCount: {total_values_count}, sampleValues: {sample_values}")
                else:
                    # Multi-level list: query tiered values
                    # For multi-level lists, values are stored on tier lists, not the parent list
                    # Get the tier 1 list ID by finding the list with HAS_TIER_1 relationship
                    tier1_list_id_result = session.run("""
                        MATCH (parent:List {id: $list_id})-[r:HAS_TIER_1]->(tier1_list:List)
                        RETURN tier1_list.id as tier1_list_id
                        LIMIT 1
                    """, {"list_id": record["id"]})
                    
                    tier1_list_id_record = tier1_list_id_result.single()
                    tier1_list_id = tier1_list_id_record.get("tier1_list_id") if tier1_list_id_record else None
                    
                    if tier1_list_id:
                        # Get tier 1 values from the tier 1 list (all values connected to tier 1 list)
                        tier1_query = session.run("""
                            MATCH (tier1_list:List {id: $tier1_list_id})-[r:HAS_LIST_VALUE]->(lv1:ListValue)
                            RETURN collect(DISTINCT lv1.value) as tier1_values
                        """, {"tier1_list_id": tier1_list_id})
                        
                        tier1_result = tier1_query.single()
                        tier1_vals = tier1_result.get("tier1_values") or [] if tier1_result else []
                        # Filter out None/empty values
                        tier1_vals = [val for val in tier1_vals if val and str(val).strip()]
                        
                        print(f"DEBUG: Multi-level list {record['list']} (id: {record['id']}) - tier1_list_id: {tier1_list_id}, tier1_vals count: {len(tier1_vals)}, tier1_vals: {tier1_vals[:5]}")
                        
                        # Count all distinct values across all tier lists
                        # This includes:
                        # 1. All ListValue nodes directly connected to any tier list via HAS_LIST_VALUE
                        # 2. All ListValue nodes reachable via tier value relationships
                        # Use a simple approach: count all values from tier lists directly
                        # For nested values, we'll count them separately and combine
                        direct_count_query = session.run("""
                            MATCH (parent:List {id: $list_id})-[tier_rel:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tier_list:List)
                            MATCH (tier_list)-[:HAS_LIST_VALUE]->(lv:ListValue)
                            RETURN count(DISTINCT lv) as direct_count
                        """, {"list_id": record["id"]})
                        
                        nested_count_query = session.run("""
                            MATCH (parent:List {id: $list_id})-[tier_rel:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tier_list:List)
                            MATCH (tier_list)-[:HAS_LIST_VALUE]->(lv:ListValue)
                            MATCH (lv)-[tier_val_rel]->(lv2:ListValue)
                            WHERE type(tier_val_rel) STARTS WITH 'HAS_' AND type(tier_val_rel) ENDS WITH '_VALUE'
                            RETURN count(DISTINCT lv2) as nested_count
                        """, {"list_id": record["id"]})
                        
                        direct_result = direct_count_query.single()
                        nested_result = nested_count_query.single()
                        
                        direct_count = direct_result.get("direct_count") or 0 if direct_result else 0
                        nested_count = nested_result.get("nested_count") or 0 if nested_result else 0
                        
                        # For now, just use direct count (nested values are typically already counted in direct)
                        # In the future, we could subtract overlaps, but for now this is safer
                        total_values_count = direct_count
                        print(f"DEBUG: Multi-level list {record['list']} - direct_count: {direct_count}, nested_count: {nested_count}, total_values_count: {total_values_count}")
                        
                        sample_values = tier1_vals[:3] if tier1_vals else []
                    else:
                        # No tier 1 list found, set to 0
                        total_values_count = 0
                        sample_values = []
                
                # Debug logging
                if record["id"] and (total_values_count > 0 or len(sample_values) > 0):
                    print(f"DEBUG: List {record['list']} (id: {record['id']}) - totalValuesCount: {total_values_count}, sampleValues: {sample_values}, listType: {list_type}")
                
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
                    "tierNumber": tier_number,  # Add tier number (1, 2, 3, etc.) for tier lists
                    "totalValuesCount": total_values_count,  # Total count of values
                    "sampleValues": sample_values if isinstance(sample_values, list) else [],  # First 3 values for display - ensure it's a list
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
async def update_list(list_id: str, request: Request):
    """
    Update an existing list in the CDM.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        # Get raw request body to handle _variations in tieredListValues
        raw_data = await request.json()
        
        # Extract tieredListValues with _variations before validation
        tiered_list_values_raw = raw_data.get('tieredListValues')
        
        # Create a copy of raw_data without tieredListValues for validation
        data_for_validation = {k: v for k, v in raw_data.items() if k != 'tieredListValues'}
        
        # Validate the rest of the data
        list_data = ListUpdateRequest(**data_for_validation)
        
        # Manually set tieredListValues after validation (as Any type)
        if tiered_list_values_raw is not None:
            list_data.tieredListValues = tiered_list_values_raw
        
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
                        MATCH (l:List {id: $list_id})-[r:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
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
                
                # Build tieredListsList from tier list IDs - preserve order and include tier number
                tiered_lists = []
                for index, tier_list_id in enumerate(tier_list_ids, start=1):
                    # Get tier list info including tier property
                    tier_result = session.run("""
                        MATCH (l:List {id: $tier_id})
                        RETURN l.name as name, l.set as set, l.grouping as grouping, l.tier as tier
                    """, tier_id=tier_list_id)
                    tier_record = tier_result.single()
                    if tier_record:
                        tier_number = tier_record.get("tier") or index  # Use tier property if available, otherwise use index
                        tiered_lists.append({
                            "listId": tier_list_id,
                            "set": tier_record["set"],
                            "grouping": tier_record["grouping"],
                            "list": tier_record["name"],
                            "tier": tier_number  # Include tier number for sorting
                        })
                
                # Sort tiered_lists by tier number to ensure correct order
                tiered_lists.sort(key=lambda x: x.get("tier", 999))
                
                print(f"DEBUG: Built tiered_lists (ordered by tier): {tiered_lists}")
                
                # Create tiered list relationships
                if tiered_lists:
                    await create_tiered_list_relationships(session, list_id, tiered_lists)
                    print(f"✅ Created {len(tiered_lists)} tier list relationships")
            
            # Update list values if provided (replace all existing with new ones)
            # Note: Even if listValuesList is an empty array, we still want to replace (clear all values)
            if list_data.listValuesList is not None:
                await create_list_values(session, list_id, list_data.listValuesList, replace=True, variations=list_data.listValuesVariations)
            
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
                    MATCH (l:List {id: $list_id})-[r:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
                    RETURN tiered.id as id, tiered.set as set, tiered.grouping as grouping, tiered.name as list, type(r) as rel_type
                    ORDER BY 
                        CASE type(r)
                            WHEN 'HAS_TIER_1' THEN 1
                            WHEN 'HAS_TIER_2' THEN 2
                            WHEN 'HAS_TIER_3' THEN 3
                            WHEN 'HAS_TIER_4' THEN 4
                            WHEN 'HAS_TIER_5' THEN 5
                            WHEN 'HAS_TIER_6' THEN 6
                            WHEN 'HAS_TIER_7' THEN 7
                            WHEN 'HAS_TIER_8' THEN 8
                            WHEN 'HAS_TIER_9' THEN 9
                            WHEN 'HAS_TIER_10' THEN 10
                            ELSE 99
                        END
                """, list_id=list_id)
                
                current_tiered_lists = []
                for record in current_tiered_result:
                    if record["id"]:  # Only add if id is not None
                        # Extract tier number from relationship type (e.g., "HAS_TIER_1" -> 1)
                        rel_type = record.get("rel_type", "")
                        tier_number = 999  # Default to high number if can't parse
                        if rel_type and rel_type.startswith("HAS_TIER_"):
                            try:
                                tier_number = int(rel_type.replace("HAS_TIER_", ""))
                            except:
                                pass
                        
                        tier_info = {
                            "listId": record["id"],
                            "set": record["set"],
                            "grouping": record["grouping"],
                            "list": record["list"],
                            "tier": tier_number  # Include tier number for sorting
                        }
                        current_tiered_lists.append(tier_info)
                        print(f"DEBUG: Found tiered list - id: {record['id']}, name: {record['list']}, rel_type: {record.get('rel_type', 'N/A')}, tier: {tier_number}")
                
                # Sort current_tiered_lists by tier number to ensure correct order
                current_tiered_lists.sort(key=lambda x: x.get("tier", 999))
                
                print(f"Found {len(current_tiered_lists)} tiered lists for list {list_id}")
                if len(current_tiered_lists) == 0:
                    print(f"⚠️ WARNING: No tiered lists found! Query should have found tier lists with HAS_TIER_1, HAS_TIER_2, etc. relationships.")
                    # Try a direct query to see what relationships exist
                    debug_result = session.run("""
                        MATCH (l:List {id: $list_id})-[r]->(tiered:List)
                        WHERE type(r) STARTS WITH 'HAS_TIER_'
                        RETURN type(r) as rel_type, tiered.id as id, tiered.name as name
                        ORDER BY type(r)
                    """, list_id=list_id)
                    debug_records = list(debug_result)
                    print(f"DEBUG: Direct query found {len(debug_records)} relationships:")
                    for dr in debug_records:
                        print(f"  - {dr.get('rel_type')}: {dr.get('name')} (id: {dr.get('id')})")
                
                # If no tiered lists found but tierNames are provided, create them now
                # This handles the case where user saves tieredListValues before saving list type config
                if not current_tiered_lists and list_data.tierNames and len(list_data.tierNames) > 0:
                    print(f"⚠️ No tiered lists found, but tierNames provided. Creating tier list nodes and relationships now...")
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
                    
                    # Build tieredListsList from tier list IDs - preserve order and include tier number
                    for index, tier_list_id in enumerate(tier_list_ids, start=1):
                        tier_result = session.run("""
                            MATCH (l:List {id: $tier_id})
                            RETURN l.name as name, l.set as set, l.grouping as grouping, l.tier as tier
                        """, tier_id=tier_list_id)
                        tier_record = tier_result.single()
                        if tier_record:
                            tier_number = tier_record.get("tier") or index  # Use tier property if available, otherwise use index
                            current_tiered_lists.append({
                                "listId": tier_list_id,
                                "set": tier_record["set"],
                                "grouping": tier_record["grouping"],
                                "list": tier_record["name"],
                                "tier": tier_number  # Include tier number for sorting
                            })
                    
                    # Sort current_tiered_lists by tier number to ensure correct order
                    current_tiered_lists.sort(key=lambda x: x.get("tier", 999))
                    
                    # Create tiered list relationships
                    if current_tiered_lists:
                        await create_tiered_list_relationships(session, list_id, current_tiered_lists)
                        print(f"✅ Created {len(current_tiered_lists)} tier list nodes and relationships")
                        print(f"DEBUG: current_tiered_lists after creation (ordered by tier): {current_tiered_lists}")
                    else:
                        print(f"⚠️ WARNING: Failed to create tier list nodes or build tieredListsList")
                
                if not current_tiered_lists:
                    print(f"⚠️ WARNING: No tiered lists found for list {list_id}. Cannot save tiered values.")
                    print(f"   Make sure you have saved the List Type configuration (Multi-Level with tier names) first.")
                    # Don't raise an error, just log a warning - the API call will succeed but no values will be saved
                else:
                    # Delete existing tiered value relationships
                    # For tiered lists, values are on tier lists, not parent list
                    # Delete all tiered value relationships (HAS_TIER_X_VALUE) from tier list values
                    tier1_list_id = current_tiered_lists[0].get("listId") if current_tiered_lists else None
                    if tier1_list_id:
                        delete_result = session.run("""
                            MATCH (tier1_list:List {id: $tier1_list_id})-[r1:HAS_LIST_VALUE]->(lv1:ListValue)
                            MATCH (lv1)-[r2]->(lv2:ListValue)
                            WHERE type(r2) STARTS WITH 'HAS_' AND type(r2) ENDS WITH '_VALUE'
                              AND type(r2) <> 'HAS_LIST_VALUE'
                            DELETE r2
                            RETURN count(r2) as deleted_count
                        """, tier1_list_id=tier1_list_id)
                    else:
                        # Fallback: delete from parent list (shouldn't happen for tiered lists)
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
            
            # Cascade changes to child lists (tier lists) if any relevant fields changed
            fields_that_cascade = [
                list_data.sector, list_data.domain, list_data.country,  # Drivers
                list_data.set, list_data.grouping,  # Ontology
                list_data.format, list_data.source, list_data.upkeep, list_data.graph, list_data.origin  # Metadata
            ]
            if any(field is not None for field in fields_that_cascade):
                print(f"Cascading parent list changes to child lists for list {list_id}")
                await cascade_parent_changes_to_children(session, list_id, list_data)
            
            # Return updated list
            print(f"DEBUG: Fetching updated list data for {list_id}")
            print(f"DEBUG: list_data.listType={list_data.listType}, list_data.tierNames={list_data.tierNames}, list_data.numberOfLevels={list_data.numberOfLevels}")
            # First get the list with basic info
            list_result = session.run("""
                MATCH (l:List {id: $id})
                RETURN l
            """, {"id": list_id})
            list_record = list_result.single()
            if not list_record:
                raise HTTPException(status_code=404, detail="List not found")
            
            # Get tiered lists separately, ordered by tier number
            tiered_result = session.run("""
                MATCH (l:List {id: $id})-[tier_rel:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
                RETURN tiered.id as id, tiered.set as set, tiered.grouping as grouping, tiered.name as list, type(tier_rel) as rel_type
                ORDER BY 
                    CASE type(tier_rel)
                        WHEN 'HAS_TIER_1' THEN 1
                        WHEN 'HAS_TIER_2' THEN 2
                        WHEN 'HAS_TIER_3' THEN 3
                        WHEN 'HAS_TIER_4' THEN 4
                        WHEN 'HAS_TIER_5' THEN 5
                        WHEN 'HAS_TIER_6' THEN 6
                        WHEN 'HAS_TIER_7' THEN 7
                        WHEN 'HAS_TIER_8' THEN 8
                        WHEN 'HAS_TIER_9' THEN 9
                        WHEN 'HAS_TIER_10' THEN 10
                        ELSE 99
                    END
            """, {"id": list_id})
            
            tiered_lists = []
            for tier_record in tiered_result:
                if tier_record["id"]:
                    tiered_lists.append({
                        "listId": tier_record["id"],
                        "set": tier_record["set"],
                        "grouping": tier_record["grouping"],
                        "list": tier_record["list"]
                    })
            
            # Get other data
            result = session.run("""
                MATCH (l:List {id: $id})
                OPTIONAL MATCH (s:Sector)-[:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (d:Domain)-[:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (c:Country)-[:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (l)-[:HAS_LIST_VALUE]->(lv:ListValue)
                OPTIONAL MATCH (l)-[:HAS_VARIATION]->(var:Variation)
                WITH l, 
                     collect(DISTINCT s.name) as sectors,
                     collect(DISTINCT d.name) as domains,
                     collect(DISTINCT c.name) as countries,
                     collect(DISTINCT lv.value) as list_values,
                     count(DISTINCT var) as variations_count,
                     collect(DISTINCT {id: var.id, name: var.name}) as variations
                RETURN l.id as id, l.name as list, l.set as set, l.grouping as grouping,
                       l.format as format, l.source as source, l.upkeep as upkeep,
                       l.graph as graph, l.origin as origin, l.status as status,
                       sectors, domains, countries, list_values, variations_count, variations
            """, {"id": list_id})
            
            record = result.single()
            if not record:
                raise HTTPException(status_code=404, detail="List not found")
            
            # Combine results
            record_dict = dict(record)
            record_dict["tiered_lists"] = tiered_lists
            record_dict["tiered_count"] = len(tiered_lists)
            
            # Create a mock record object
            class MockRecord:
                def __init__(self, data):
                    self._data = data
                def get(self, key, default=None):
                    return self._data.get(key, default)
                def __getitem__(self, key):
                    return self._data[key]
            
            record = MockRecord(record_dict)
            
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
                OPTIONAL MATCH (l)-[tier_rel:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
                WITH l, tiered, tier_rel
                ORDER BY 
                    CASE type(tier_rel)
                        WHEN 'HAS_TIER_1' THEN 1
                        WHEN 'HAS_TIER_2' THEN 2
                        WHEN 'HAS_TIER_3' THEN 3
                        WHEN 'HAS_TIER_4' THEN 4
                        WHEN 'HAS_TIER_5' THEN 5
                        WHEN 'HAS_TIER_6' THEN 6
                        WHEN 'HAS_TIER_7' THEN 7
                        WHEN 'HAS_TIER_8' THEN 8
                        WHEN 'HAS_TIER_9' THEN 9
                        WHEN 'HAS_TIER_10' THEN 10
                        ELSE 99
                    END
                RETURN l.name as parent_list_name, 
                       collect(DISTINCT {listId: tiered.id, listName: tiered.name, tierNumber: type(tier_rel)}) as tiered_lists
            """, {"list_id": list_id})
            
            tiered_structure_record = tiered_structure_result.single()
            if not tiered_structure_record:
                return {}
            
            tiered_lists = tiered_structure_record.get("tiered_lists", [])
            if not tiered_lists:
                return {}
            
            # Extract tier numbers from relationship types and sort by tier
            tiered_lists_with_numbers = []
            for tier_info in tiered_lists:
                tier_number_str = tier_info.get("tierNumber", "")
                tier_number = 999  # Default to high number if can't parse
                if tier_number_str and tier_number_str.startswith("HAS_TIER_"):
                    try:
                        tier_number = int(tier_number_str.replace("HAS_TIER_", ""))
                    except:
                        pass
                tiered_lists_with_numbers.append({
                    **tier_info,
                    "tier": tier_number
                })
            
            # Sort by tier number to ensure correct order
            tiered_lists_with_numbers.sort(key=lambda x: x.get("tier", 999))
            
            # Build relationship pattern dynamically based on tiered lists
            # We need to traverse: List -> ListValue (tier 1) -> ListValue (tier 2) -> ListValue (tier 3) -> ...
            # The relationship types are dynamic: HAS_STATE_VALUE, HAS_CITY_VALUE, etc.
            
            # Get tier 1 list ID first
            tier1_list_id = None
            if tiered_lists_with_numbers and len(tiered_lists_with_numbers) > 0:
                # Find the tier 1 list (first in the sorted list)
                tier1_list_info = tiered_lists_with_numbers[0]
                tier1_list_id = tier1_list_info.get("listId")
            
            if not tier1_list_id:
                print(f"No tier 1 list found for list {list_id}")
                return {}
            
            # Get all tier 1 list values from the tier 1 list (not the parent list)
            tier1_result = session.run("""
                MATCH (tier1_list:List {id: $tier1_list_id})-[r:HAS_LIST_VALUE]->(lv1:ListValue)
                RETURN lv1.value as tier1_value
                ORDER BY lv1.value
            """, {"tier1_list_id": tier1_list_id})
            
            tier1_values = [record["tier1_value"] for record in tier1_result if record["tier1_value"]]
            
            if not tier1_values:
                return {}
            
            # For each tier 1 value, traverse the tiered relationships
            result_data: Dict[str, List[List[str]]] = {}
            
            for tier1_value in tier1_values:
                # Find all complete paths from tier1_value through tiered relationships
                # The tier1_value is connected to the tier 1 list, and we need to find paths from it
                query = """
                    MATCH (tier1_list:List {id: $tier1_list_id})-[r1:HAS_LIST_VALUE]->(lv1:ListValue {value: $tier1_value})
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
                    "tier1_list_id": tier1_list_id, 
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

# Set and Grouping endpoints - MUST come before /lists/{list_id} to avoid route conflicts
class SetCreateRequest(BaseModel):
    set: str

class GroupingCreateRequest(BaseModel):
    set: str
    grouping: str

@router.post("/lists/set", response_model=Dict[str, Any])
async def create_set(set_data: SetCreateRequest):
    """
    Create a new Set node in Neo4j.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    if not set_data.set or not set_data.set.strip():
        raise HTTPException(status_code=400, detail="Set name cannot be empty")

    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            set_name = set_data.set.strip()
            
            # Check if Set already exists
            check_result = session.run("""
                MATCH (s:Set {name: $set_name})
                RETURN s.name AS name
            """, set_name=set_name)
            
            if check_result.single():
                return {
                    "success": True,
                    "set": set_name,
                    "message": f"Set '{set_name}' already exists"
                }
            
            # Create Set node
            session.run("""
                MERGE (s:Set {name: $set_name})
            """, set_name=set_name)
            
            return {
                "success": True,
                "set": set_name,
                "message": f"Successfully created Set '{set_name}'"
            }

    except Exception as e:
        print(f"Error creating Set: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create Set: {str(e)}")

@router.post("/lists/grouping", response_model=Dict[str, Any])
async def create_grouping(grouping_data: GroupingCreateRequest):
    """
    Create a new Grouping node in Neo4j with HAS_GROUPING relationship from Set.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    if not grouping_data.set or not grouping_data.set.strip():
        raise HTTPException(status_code=400, detail="Set name cannot be empty")
    if not grouping_data.grouping or not grouping_data.grouping.strip():
        raise HTTPException(status_code=400, detail="Grouping name cannot be empty")

    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            set_name = grouping_data.set.strip()
            grouping_name = grouping_data.grouping.strip()
            
            # Check if Grouping already exists for this Set
            check_result = session.run("""
                MATCH (s:Set {name: $set_name})-[:HAS_GROUPING]->(g:Grouping {name: $grouping_name})
                RETURN g.name AS name
            """, set_name=set_name, grouping_name=grouping_name)
            
            if check_result.single():
                return {
                    "success": True,
                    "set": set_name,
                    "grouping": grouping_name,
                    "message": f"Grouping '{grouping_name}' already exists for Set '{set_name}'"
                }
            
            # Create Set node if it doesn't exist, then create Grouping with relationship
            session.run("""
                MERGE (s:Set {name: $set_name})
                MERGE (g:Grouping {name: $grouping_name})
                MERGE (s)-[:HAS_GROUPING]->(g)
            """, set_name=set_name, grouping_name=grouping_name)
            
            return {
                "success": True,
                "set": set_name,
                "grouping": grouping_name,
                "message": f"Successfully created Grouping '{grouping_name}' for Set '{set_name}'"
            }

    except Exception as e:
        print(f"Error creating Grouping: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create Grouping: {str(e)}")

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
                OPTIONAL MATCH (l)-[tier_rel:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
                OPTIONAL MATCH (parent:List)-[parent_tier_rel:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(l)
                WITH l, 
                     collect(DISTINCT s.name) as sectors,
                     collect(DISTINCT d.name) as domains,
                     collect(DISTINCT c.name) as countries,
                     count(DISTINCT v) as variables_count,
                     collect(DISTINCT lv.value) as list_values,
                     collect(DISTINCT {listId: tiered.id, set: tiered.set, grouping: tiered.grouping, list: tiered.name}) as tiered_lists,
                     count(DISTINCT parent) > 0 as has_incoming_tier,
                     head(collect(DISTINCT type(parent_tier_rel))) as parent_tier_rel_type,
                     size(collect(DISTINCT tiered.id)) as tiered_count
                WITH l, sectors, domains, countries, variables_count, list_values, tiered_lists, 
                     has_incoming_tier, parent_tier_rel_type, tiered_count,
                     l.tier as list_tier_property,
                     CASE 
                       WHEN l.tier IS NOT NULL THEN 
                         toInteger(l.tier)
                       WHEN parent_tier_rel_type IS NOT NULL THEN 
                         toInteger(substring(parent_tier_rel_type, 9))  // Extract number from "HAS_TIER_X" (e.g., "HAS_TIER_1" -> 1)
                       ELSE NULL 
                     END as tier_number
                RETURN l.id as id, l.name as list, l.set as set, l.grouping as grouping,
                       l.format as format, l.source as source, l.upkeep as upkeep,
                       l.graph as graph, l.origin as origin, l.status as status,
                       sectors, domains, countries, variables_count, list_values, tiered_lists, has_incoming_tier, tiered_count, tier_number
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
            tier_number = record.get("tier_number")
            list_type = 'Multi-Level' if tiered_count > 0 else 'Single'
            number_of_levels = tiered_count if tiered_count > 0 else 2
            
            # Get tier names in correct order by querying tier lists with their tier property
            tier_names = []
            if tieredListsList:
                # Query each tier list to get its tier property and sort by it
                tier_list_info = []
                for tier in tieredListsList:
                    if tier and tier.get("listId"):
                        tier_info_result = session.run("""
                            MATCH (l:List {id: $tier_id})
                            RETURN l.name as name, l.tier as tier
                        """, tier_id=tier.get("listId"))
                        tier_info_record = tier_info_result.single()
                        if tier_info_record:
                            tier_list_info.append({
                                "name": tier_info_record.get("name", ""),
                                "tier": tier_info_record.get("tier") or 999
                            })
                
                # Sort by tier number and extract names
                tier_list_info.sort(key=lambda x: x.get("tier", 999))
                tier_names = [t["name"] for t in tier_list_info if t.get("name")]
            
            # Fallback to extracting from tieredListsList if query didn't work
            if not tier_names:
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
                "tierNumber": tier_number,
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

