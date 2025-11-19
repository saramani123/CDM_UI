from fastapi import APIRouter, HTTPException, status, Body
from typing import List, Dict, Any, Optional
import uuid
from pydantic import BaseModel
from neo4j import WRITE_ACCESS
from db import get_driver

router = APIRouter()

class ListValueRequest(BaseModel):
    id: Optional[str] = None
    value: str

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
                WITH l, s, g, 
                     collect(DISTINCT sector.name) as sectors,
                     collect(DISTINCT domain.name) as domains,
                     collect(DISTINCT country.name) as countries,
                     count(DISTINCT v) as variables_count,
                     collect(DISTINCT lv.value) as list_values
                RETURN l.id as id, l.name as list, l.set as set, l.grouping as grouping,
                       l.format as format, l.source as source, l.upkeep as upkeep,
                       l.graph as graph, l.origin as origin, l.status as status,
                       s.name as set_name, g.name as grouping_name,
                       sectors, domains, countries, variables_count, list_values
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
                    "listValuesList": listValuesList
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
                "listValuesList": list_data.listValuesList if list_data.listValuesList else []
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
            
            # Update list values if provided (replace all existing with new ones)
            # Note: Even if listValuesList is an empty array, we still want to replace (clear all values)
            if list_data.listValuesList is not None:
                await create_list_values(session, list_id, list_data.listValuesList, replace=True)
            
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
                
                sector_str = list_data.sector if list_data.sector is not None else (", ".join(current["sectors"]) if current["sectors"] else "ALL")
                domain_str = list_data.domain if list_data.domain is not None else (", ".join(current["domains"]) if current["domains"] else "ALL")
                country_str = list_data.country if list_data.country is not None else (", ".join(current["countries"]) if current["countries"] else "ALL")
                
                await create_list_driver_relationships(session, list_id, sector_str, domain_str, country_str)
            
            # Return updated list
            result = session.run("""
                MATCH (l:List {id: $id})
                OPTIONAL MATCH (s:Sector)-[:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (d:Domain)-[:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (c:Country)-[:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (l)-[:HAS_LIST_VALUE]->(lv:ListValue)
                WITH l, 
                     collect(DISTINCT s.name) as sectors,
                     collect(DISTINCT d.name) as domains,
                     collect(DISTINCT c.name) as countries,
                     collect(DISTINCT lv.value) as list_values
                RETURN l.id as id, l.name as list, l.set as set, l.grouping as grouping,
                       l.format as format, l.source as source, l.upkeep as upkeep,
                       l.graph as graph, l.origin as origin, l.status as status,
                       sectors, domains, countries, list_values
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
                "listValuesList": listValuesList
            }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating list: {e}")
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
                WITH l, 
                     collect(DISTINCT s.name) as sectors,
                     collect(DISTINCT d.name) as domains,
                     collect(DISTINCT c.name) as countries,
                     count(DISTINCT v) as variables_count,
                     collect(DISTINCT lv.value) as list_values
                RETURN l.id as id, l.name as list, l.set as set, l.grouping as grouping,
                       l.format as format, l.source as source, l.upkeep as upkeep,
                       l.graph as graph, l.origin as origin, l.status as status,
                       sectors, domains, countries, variables_count, list_values
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
                "listValuesList": listValuesList
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

