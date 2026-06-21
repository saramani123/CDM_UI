from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Literal
from db import get_driver

router = APIRouter()

# Driver types
DriverType = Literal["sectors", "domains", "countries", "objectClarifiers", "variableClarifiers"]

def get_driver_label(driver_type: DriverType) -> str:
    """Convert driver type to Neo4j label"""
    label_map = {
        "sectors": "Sector",
        "domains": "Domain", 
        "countries": "Country",
        "objectClarifiers": "ObjectClarifier",
        "variableClarifiers": "VariableClarifier"
    }
    return label_map[driver_type]

@router.get("/drivers/{driver_type}")
async def get_drivers(driver_type: DriverType):
    """
    Get all drivers of a specific type.
    Returns list of driver names (used to populate dropdowns).
    """
    driver = get_driver()
    if not driver:
        # Return empty list if no Neo4j connection
        return []
    
    try:
        label = get_driver_label(driver_type)
        with driver.session() as session:
            result = session.run(f"MATCH (d:{label}) RETURN d.name as name, d.order as order ORDER BY COALESCE(d.order, 999999), d.name")
            drivers = [record["name"] for record in result]
            return drivers
            
    except Exception as e:
        print(f"Error querying {driver_type}: {e}")
        return []

@router.get("/drivers/{driver_type}/details")
async def get_driver_details(driver_type: DriverType):
    """
    Get all drivers of a specific type with their abbreviations.
    Abbreviation is an optional property stored on the driver node; when present
    it is what the grids display for that Sector/Domain/Country value.
    Returns: [{ "name": str, "abbreviation": str }]
    """
    driver = get_driver()
    if not driver:
        return []

    try:
        label = get_driver_label(driver_type)
        with driver.session() as session:
            result = session.run(
                f"MATCH (d:{label}) "
                f"RETURN d.name as name, coalesce(d.abbreviation, '') as abbreviation, d.order as order "
                f"ORDER BY COALESCE(d.order, 999999), d.name"
            )
            return [
                {"name": r["name"], "abbreviation": r["abbreviation"] or ""}
                for r in result
                if r.get("name")
            ]
    except Exception as e:
        print(f"Error querying {driver_type} details: {e}")
        return []

@router.post("/drivers/{driver_type}")
async def create_driver(driver_type: DriverType, driver_data: Dict[str, Any]):
    """
    Create a new driver value.
    """
    # Countries can now be added (matching Sector and Domain behavior)
    
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=503, detail="Neo4j connection not available")
    
    name = driver_data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Driver name is required")
    abbreviation = (driver_data.get("abbreviation") or "").strip()
    
    try:
        label = get_driver_label(driver_type)
        with driver.session() as session:
            # Check if driver already exists
            existing = session.run(f"MATCH (d:{label} {{name: $name}}) RETURN d", name=name)
            if existing.single():
                raise HTTPException(status_code=409, detail=f"{label} '{name}' already exists")
            
            # Create new driver at the bottom of current order.
            session.run(
                f"""
                OPTIONAL MATCH (existing:{label})
                WITH coalesce(max(existing.order), -1) + 1 as next_order
                CREATE (d:{label} {{name: $name, order: next_order, abbreviation: $abbreviation}})
                """,
                name=name, abbreviation=abbreviation
            )
            return {"message": f"{label} '{name}' created successfully", "name": name, "abbreviation": abbreviation}
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating {driver_type}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create {driver_type}")

@router.put("/drivers/{driver_type}/reorder/")
async def reorder_drivers(driver_type: DriverType, reorder_data: Dict[str, Any]):
    """
    Reorder drivers of a specific type.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=503, detail="Neo4j connection not available")
    
    try:
        ordered_names = reorder_data.get("orderedNames", [])
        if not ordered_names:
            raise HTTPException(status_code=400, detail="orderedNames is required")
        
        label = get_driver_label(driver_type)
        with driver.session() as session:
            # Update the order property for each driver
            for index, name in enumerate(ordered_names):
                session.run("""
                    MATCH (d:{label} {{name: $name}})
                    SET d.order = $order
                """.format(label=label), name=name, order=index)
            
            return {"message": f"Successfully reordered {len(ordered_names)} {driver_type}"}
            
    except Exception as e:
        print(f"Error reordering {driver_type}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reorder drivers: {str(e)}")

@router.put("/drivers/{driver_type}/{old_name}")
async def update_driver(driver_type: DriverType, old_name: str, driver_data: Dict[str, Any]):
    """
    Rename an existing driver value.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=503, detail="Neo4j connection not available")
    
    # Name is optional: an abbreviation-only update keeps the existing name.
    new_name = (driver_data.get("name") or "").strip() or old_name
    abbreviation_provided = "abbreviation" in driver_data
    abbreviation = (driver_data.get("abbreviation") or "").strip() if abbreviation_provided else None
    renamed = new_name != old_name

    if not renamed and not abbreviation_provided:
        return {"message": "No changes made", "name": new_name}
    
    try:
        label = get_driver_label(driver_type)
        with driver.session() as session:
            # Check if old driver exists
            old_driver = session.run(f"MATCH (d:{label} {{name: $old_name}}) RETURN d", old_name=old_name)
            if not old_driver.single():
                raise HTTPException(status_code=404, detail=f"{label} '{old_name}' not found")

            # Apply abbreviation update (matched on the current/old name).
            if abbreviation_provided:
                session.run(
                    f"MATCH (d:{label} {{name: $old_name}}) SET d.abbreviation = $abbreviation",
                    old_name=old_name, abbreviation=abbreviation,
                )

            if not renamed:
                return {"message": f"{label} '{old_name}' updated", "name": new_name, "abbreviation": abbreviation}

            # Check if new name already exists
            existing = session.run(f"MATCH (d:{label} {{name: $new_name}}) RETURN d", new_name=new_name)
            if existing.single():
                raise HTTPException(status_code=409, detail=f"{label} '{new_name}' already exists")
            
            # Update the driver name
            session.run(f"MATCH (d:{label} {{name: $old_name}}) SET d.name = $new_name", 
                       old_name=old_name, new_name=new_name)

            # Keep denormalized driver strings in sync so S/D/C grids immediately reflect renames.
            # Object driver string format: "Sector, Domain, Country, ObjectClarifier"
            session.run(
                """
                MATCH (o:Object)
                OPTIONAL MATCH (sec:Sector)-[:RELEVANT_TO]->(o)
                WITH o, [name IN collect(DISTINCT sec.name) WHERE name IS NOT NULL] AS sectors
                OPTIONAL MATCH (dom:Domain)-[:RELEVANT_TO]->(o)
                WITH o, sectors, [name IN collect(DISTINCT dom.name) WHERE name IS NOT NULL] AS domains
                OPTIONAL MATCH (cty:Country)-[:RELEVANT_TO]->(o)
                WITH o, sectors, domains, [name IN collect(DISTINCT cty.name) WHERE name IS NOT NULL] AS countries
                OPTIONAL MATCH (oc:ObjectClarifier)-[:RELEVANT_TO]->(o)
                WITH
                    o,
                    sectors,
                    domains,
                    countries,
                    coalesce(head([name IN collect(DISTINCT oc.name) WHERE name IS NOT NULL]), 'None') AS object_clarifier
                WITH
                    o,
                    CASE WHEN size(sectors) = 0 OR 'ALL' IN sectors
                        THEN 'ALL'
                        ELSE reduce(txt = '', name IN sectors | txt + CASE WHEN txt = '' THEN '' ELSE ', ' END + name)
                    END AS sector_display,
                    CASE WHEN size(domains) = 0 OR 'ALL' IN domains
                        THEN 'ALL'
                        ELSE reduce(txt = '', name IN domains | txt + CASE WHEN txt = '' THEN '' ELSE ', ' END + name)
                    END AS domain_display,
                    CASE WHEN size(countries) = 0 OR 'ALL' IN countries
                        THEN 'ALL'
                        ELSE reduce(txt = '', name IN countries | txt + CASE WHEN txt = '' THEN '' ELSE ', ' END + name)
                    END AS country_display,
                    object_clarifier
                SET o.driver = sector_display + ', ' + domain_display + ', ' + country_display + ', ' + object_clarifier
                """
            )

            # Variable driver string format: "Sector, Domain, Country, VariableClarifier"
            session.run(
                """
                MATCH (v:Variable)
                OPTIONAL MATCH (sec:Sector)-[:IS_RELEVANT_TO]->(v)
                WITH v, [name IN collect(DISTINCT sec.name) WHERE name IS NOT NULL] AS sectors
                OPTIONAL MATCH (dom:Domain)-[:IS_RELEVANT_TO]->(v)
                WITH v, sectors, [name IN collect(DISTINCT dom.name) WHERE name IS NOT NULL] AS domains
                OPTIONAL MATCH (cty:Country)-[:IS_RELEVANT_TO]->(v)
                WITH v, sectors, domains, [name IN collect(DISTINCT cty.name) WHERE name IS NOT NULL] AS countries
                OPTIONAL MATCH (vc:VariableClarifier)-[:IS_RELEVANT_TO]->(v)
                WITH
                    v,
                    sectors,
                    domains,
                    countries,
                    coalesce(head([name IN collect(DISTINCT vc.name) WHERE name IS NOT NULL]), 'None') AS variable_clarifier
                WITH
                    v,
                    CASE WHEN size(sectors) = 0 OR 'ALL' IN sectors
                        THEN 'ALL'
                        ELSE reduce(txt = '', name IN sectors | txt + CASE WHEN txt = '' THEN '' ELSE ', ' END + name)
                    END AS sector_display,
                    CASE WHEN size(domains) = 0 OR 'ALL' IN domains
                        THEN 'ALL'
                        ELSE reduce(txt = '', name IN domains | txt + CASE WHEN txt = '' THEN '' ELSE ', ' END + name)
                    END AS domain_display,
                    CASE WHEN size(countries) = 0 OR 'ALL' IN countries
                        THEN 'ALL'
                        ELSE reduce(txt = '', name IN countries | txt + CASE WHEN txt = '' THEN '' ELSE ', ' END + name)
                    END AS country_display,
                    variable_clarifier
                SET v.driver = sector_display + ', ' + domain_display + ', ' + country_display + ', ' + variable_clarifier
                """
            )
            
            return {"message": f"{label} renamed from '{old_name}' to '{new_name}'", "name": new_name, "abbreviation": abbreviation}
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating {driver_type}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update {driver_type}")

@router.delete("/drivers/{driver_type}/{name}")
async def delete_driver(driver_type: DriverType, name: str):
    """
    Delete a driver value and handle relationship cleanup.
    Returns information about affected Objects and Variables.
    """
    # Note: All driver types (sectors, domains, countries, objectClarifiers) can now be deleted
    # The deletion logic below handles all types consistently
    
    # ALL values cannot be deleted (UI convenience only)
    if name == "ALL":
        raise HTTPException(status_code=403, detail="'ALL' cannot be deleted - it's a UI convenience for multiselect")
    
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=503, detail="Neo4j connection not available")
    
    try:
        label = get_driver_label(driver_type)
        with driver.session() as session:
            # Check if driver exists
            existing = session.run(f"MATCH (d:{label} {{name: $name}}) RETURN d", name=name)
            if not existing.single():
                raise HTTPException(status_code=404, detail=f"{label} '{name}' not found")
            
            # Find all Objects and Variables that will be affected
            affected_objects = []
            affected_variables = []
            
            # Find affected Objects - relationships go FROM Driver TO Object
            print(f"DEBUG: Looking for objects with relationships to {label} '{name}'")
            
            # First check if the driver exists
            driver_check = session.run(f"MATCH (d:{label} {{name: $name}}) RETURN d", name=name)
            driver_exists = driver_check.single()
            print(f"DEBUG: Driver exists: {driver_exists is not None}")
            
            # Find objects that have the specific driver in their selection
            # These are the only objects that should be affected by deleting this driver
            # Objects with "ALL" should NOT be affected because they're connected to ALL drivers
            affected_objects_result = session.run(f"""
                MATCH (o:Object)
                WHERE o.driver IS NOT NULL
                RETURN o.id as id, o.driver as driver, o.being as being, 
                       o.avatar as avatar, o.object as object
            """)
            
            all_objects_list = list(affected_objects_result)
            print(f"DEBUG: Found {len(all_objects_list)} total objects")
            
            # Filter to only include objects that have the specific driver in their selection
            filtered_objects = []
            for obj in all_objects_list:
                driver_parts = obj["driver"].split(", ")
                if len(driver_parts) >= 4:
                    # Check if this object has the specific driver in its selection
                    has_specific_driver = False
                    if driver_type == "sectors" and driver_parts[0] != "ALL":
                        # Check if the specific sector is in the sector selection
                        sectors = [s.strip() for s in driver_parts[0].split(',')]
                        if name in sectors:
                            has_specific_driver = True
                    elif driver_type == "domains" and driver_parts[1] != "ALL":
                        # Check if the specific domain is in the domain selection
                        domains = [d.strip() for d in driver_parts[1].split(',')]
                        if name in domains:
                            has_specific_driver = True
                    elif driver_type == "countries" and driver_parts[2] != "ALL":
                        # Check if the specific country is in the country selection
                        countries = [c.strip() for c in driver_parts[2].split(',')]
                        if name in countries:
                            has_specific_driver = True
                    
                    if has_specific_driver:
                        filtered_objects.append(obj)
            
            print(f"DEBUG: Found {len(filtered_objects)} objects that have the specific {driver_type} driver")
            
            # These are the affected objects
            all_affected_objects = filtered_objects
            unique_objects = {}
            for obj in all_affected_objects:
                unique_objects[obj["id"]] = obj
            
            print(f"DEBUG: Total unique affected objects: {len(unique_objects)}")
            
            for obj_id, obj_data in unique_objects.items():
                print(f"DEBUG: Object {obj_data['id']} has driver: {obj_data['driver']}")
                affected_objects.append({
                    "id": obj_data["id"],
                    "driver": obj_data["driver"],
                    "being": obj_data["being"],
                    "avatar": obj_data["avatar"],
                    "object": obj_data["object"]
                })
            
            # Find variables that have the specific driver in their selection
            # These are the only variables that should be affected by deleting this driver
            # Variables with "ALL" should NOT be affected because they're connected to ALL drivers
            affected_variables_result = session.run(f"""
                MATCH (v:Variable)
                WHERE v.driver IS NOT NULL
                RETURN v.id as id, v.driver as driver, v.part as part,
                       v.group as group, v.variable as variable
            """)
            
            all_variables_list = list(affected_variables_result)
            print(f"DEBUG: Found {len(all_variables_list)} total variables")
            
            # Filter to only include variables that have the specific driver in their selection
            filtered_variables = []
            for var in all_variables_list:
                driver_parts = var["driver"].split(", ")
                if len(driver_parts) >= 3:  # Variables have 3 parts: sector, domain, country
                    # Check if this variable has the specific driver in its selection
                    has_specific_driver = False
                    if driver_type == "sectors" and driver_parts[0] != "ALL":
                        # Check if the specific sector is in the sector selection
                        sectors = [s.strip() for s in driver_parts[0].split(',')]
                        if name in sectors:
                            has_specific_driver = True
                    elif driver_type == "domains" and driver_parts[1] != "ALL":
                        # Check if the specific domain is in the domain selection
                        domains = [d.strip() for d in driver_parts[1].split(',')]
                        if name in domains:
                            has_specific_driver = True
                    elif driver_type == "countries" and driver_parts[2] != "ALL":
                        # Check if the specific country is in the country selection
                        countries = [c.strip() for c in driver_parts[2].split(',')]
                        if name in countries:
                            has_specific_driver = True
                    
                    if has_specific_driver:
                        filtered_variables.append(var)
            
            print(f"DEBUG: Found {len(filtered_variables)} variables that have the specific {driver_type} driver")
            
            # These are the affected variables
            all_affected_variables = filtered_variables
            unique_variables = {}
            for var in all_affected_variables:
                unique_variables[var["id"]] = var
            
            print(f"DEBUG: Total unique affected variables: {len(unique_variables)}")
            
            for var_id, var_data in unique_variables.items():
                print(f"DEBUG: Variable {var_data['id']} has driver: {var_data['driver']}")
                affected_variables.append({
                    "id": var_data["id"],
                    "driver": var_data["driver"],
                    "part": var_data["part"],
                    "group": var_data["group"],
                    "variable": var_data["variable"]
                })
            
            print(f"DEBUG: About to delete driver and update {len(affected_objects)} objects and {len(affected_variables)} variables")
            
            # Sector/Domain/Country are REQUIRED on every Object/Variable/List (each must
            # have at least one value). Before removing this driver value, any entity whose
            # ONLY value in this dimension is the one being deleted must default to ALL --
            # i.e. be connected to every remaining driver node of this type. Entities that
            # still have another value in this dimension simply lose this one when the node
            # is detached. (Clarifiers are single-value and handled by the denormalized
            # string recompute below, which falls back to "None".)
            defaulted_to_all = 0
            if driver_type in ("sectors", "domains", "countries"):
                # Objects: (driver)-[:RELEVANT_TO]->(Object)
                rec = session.run(f"""
                    MATCH (x:{label} {{name: $name}})-[:RELEVANT_TO]->(o:Object)
                    OPTIONAL MATCH (other:{label})-[:RELEVANT_TO]->(o)
                    WHERE other.name <> $name
                    WITH o, count(other) AS others
                    WHERE others = 0
                    WITH DISTINCT o
                    MATCH (rem:{label}) WHERE rem.name <> $name
                    MERGE (rem)-[:RELEVANT_TO]->(o)
                    RETURN count(DISTINCT o) AS c
                """, name=name).single()
                defaulted_to_all += int(rec["c"]) if rec and rec["c"] is not None else 0

                # Variables: (driver)-[:IS_RELEVANT_TO]->(Variable)
                rec = session.run(f"""
                    MATCH (x:{label} {{name: $name}})-[:IS_RELEVANT_TO]->(v:Variable)
                    OPTIONAL MATCH (other:{label})-[:IS_RELEVANT_TO]->(v)
                    WHERE other.name <> $name
                    WITH v, count(other) AS others
                    WHERE others = 0
                    WITH DISTINCT v
                    MATCH (rem:{label}) WHERE rem.name <> $name
                    MERGE (rem)-[:IS_RELEVANT_TO]->(v)
                    RETURN count(DISTINCT v) AS c
                """, name=name).single()
                defaulted_to_all += int(rec["c"]) if rec and rec["c"] is not None else 0

                # Lists: (driver)-[:IS_RELEVANT_TO]->(List)
                rec = session.run(f"""
                    MATCH (x:{label} {{name: $name}})-[:IS_RELEVANT_TO]->(l:List)
                    OPTIONAL MATCH (other:{label})-[:IS_RELEVANT_TO]->(l)
                    WHERE other.name <> $name
                    WITH l, count(other) AS others
                    WHERE others = 0
                    WITH DISTINCT l
                    MATCH (rem:{label}) WHERE rem.name <> $name
                    MERGE (rem)-[:IS_RELEVANT_TO]->(l)
                    RETURN count(DISTINCT l) AS c
                """, name=name).single()
                defaulted_to_all += int(rec["c"]) if rec and rec["c"] is not None else 0

            print(f"DEBUG: Defaulted {defaulted_to_all} entities to ALL for {label} '{name}'")

            # Delete the driver node and all its relationships
            session.run(f"MATCH (d:{label} {{name: $name}}) DETACH DELETE d", name=name)
            
            # Recompute denormalized driver strings from the (now-corrected) relationships
            # so multi-value selections and ALL defaults are reflected consistently.
            # Object driver string format: "Sector, Domain, Country, ObjectClarifier"
            session.run(
                """
                MATCH (o:Object)
                OPTIONAL MATCH (sec:Sector)-[:RELEVANT_TO]->(o)
                WITH o, [n IN collect(DISTINCT sec.name) WHERE n IS NOT NULL] AS sectors
                OPTIONAL MATCH (dom:Domain)-[:RELEVANT_TO]->(o)
                WITH o, sectors, [n IN collect(DISTINCT dom.name) WHERE n IS NOT NULL] AS domains
                OPTIONAL MATCH (cty:Country)-[:RELEVANT_TO]->(o)
                WITH o, sectors, domains, [n IN collect(DISTINCT cty.name) WHERE n IS NOT NULL] AS countries
                OPTIONAL MATCH (oc:ObjectClarifier)-[:RELEVANT_TO]->(o)
                WITH
                    o, sectors, domains, countries,
                    coalesce(head([n IN collect(DISTINCT oc.name) WHERE n IS NOT NULL]), 'None') AS object_clarifier
                WITH
                    o,
                    CASE WHEN size(sectors) = 0 OR 'ALL' IN sectors THEN 'ALL'
                        ELSE reduce(t = '', n IN sectors | t + CASE WHEN t = '' THEN '' ELSE ', ' END + n) END AS sector_display,
                    CASE WHEN size(domains) = 0 OR 'ALL' IN domains THEN 'ALL'
                        ELSE reduce(t = '', n IN domains | t + CASE WHEN t = '' THEN '' ELSE ', ' END + n) END AS domain_display,
                    CASE WHEN size(countries) = 0 OR 'ALL' IN countries THEN 'ALL'
                        ELSE reduce(t = '', n IN countries | t + CASE WHEN t = '' THEN '' ELSE ', ' END + n) END AS country_display,
                    object_clarifier
                SET o.driver = sector_display + ', ' + domain_display + ', ' + country_display + ', ' + object_clarifier
                """
            )

            # Variable driver string format: "Sector, Domain, Country, VariableClarifier"
            session.run(
                """
                MATCH (v:Variable)
                OPTIONAL MATCH (sec:Sector)-[:IS_RELEVANT_TO]->(v)
                WITH v, [n IN collect(DISTINCT sec.name) WHERE n IS NOT NULL] AS sectors
                OPTIONAL MATCH (dom:Domain)-[:IS_RELEVANT_TO]->(v)
                WITH v, sectors, [n IN collect(DISTINCT dom.name) WHERE n IS NOT NULL] AS domains
                OPTIONAL MATCH (cty:Country)-[:IS_RELEVANT_TO]->(v)
                WITH v, sectors, domains, [n IN collect(DISTINCT cty.name) WHERE n IS NOT NULL] AS countries
                OPTIONAL MATCH (vc:VariableClarifier)-[:IS_RELEVANT_TO]->(v)
                WITH
                    v, sectors, domains, countries,
                    coalesce(head([n IN collect(DISTINCT vc.name) WHERE n IS NOT NULL]), 'None') AS variable_clarifier
                WITH
                    v,
                    CASE WHEN size(sectors) = 0 OR 'ALL' IN sectors THEN 'ALL'
                        ELSE reduce(t = '', n IN sectors | t + CASE WHEN t = '' THEN '' ELSE ', ' END + n) END AS sector_display,
                    CASE WHEN size(domains) = 0 OR 'ALL' IN domains THEN 'ALL'
                        ELSE reduce(t = '', n IN domains | t + CASE WHEN t = '' THEN '' ELSE ', ' END + n) END AS domain_display,
                    CASE WHEN size(countries) = 0 OR 'ALL' IN countries THEN 'ALL'
                        ELSE reduce(t = '', n IN countries | t + CASE WHEN t = '' THEN '' ELSE ', ' END + n) END AS country_display,
                    variable_clarifier
                SET v.driver = sector_display + ', ' + domain_display + ', ' + country_display + ', ' + variable_clarifier
                """
            )
            # Lists derive Sector/Domain/Country from relationships at read time, so no
            # denormalized update is required for them.
            
            return {
                "message": f"{label} '{name}' deleted successfully",
                "affected_objects": affected_objects,
                "affected_variables": affected_variables,
                "affected_objects_count": len(affected_objects),
                "affected_variables_count": len(affected_variables),
                "defaulted_to_all_count": defaulted_to_all
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting {driver_type}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete {driver_type}")

@router.post("/drivers/{driver_type}/bulk")
async def bulk_create_drivers(driver_type: DriverType, drivers_data: Dict[str, Any]):
    """
    Bulk create driver values (for CSV upload).
    Skips duplicates and only creates new nodes.
    """
    # Countries can now be added (matching Sector and Domain behavior)
    
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=503, detail="Neo4j connection not available")
    
    names = drivers_data.get("names", [])
    if not names:
        raise HTTPException(status_code=400, detail="Driver names list is required")
    
    # Clean and validate names
    clean_names = [name.strip() for name in names if name.strip()]
    if not clean_names:
        raise HTTPException(status_code=400, detail="No valid driver names provided")
    
    try:
        label = get_driver_label(driver_type)
        with driver.session() as session:
            created_count = 0
            skipped_count = 0
            
            for name in clean_names:
                # Check if driver already exists
                existing = session.run(f"MATCH (d:{label} {{name: $name}}) RETURN d", name=name)
                if not existing.single():
                    # Create new driver
                    session.run(f"CREATE (d:{label} {{name: $name}})", name=name)
                    created_count += 1
                else:
                    skipped_count += 1
            
            return {
                "message": f"Bulk operation completed",
                "created": created_count,
                "skipped": skipped_count,
                "total_processed": len(clean_names)
            }
            
    except Exception as e:
        print(f"Error in bulk create {driver_type}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to bulk create {driver_type}")

@router.get("/drivers/{driver_type}/debug-query")
async def debug_driver_query(driver_type: DriverType, name: str):
    """
    Debug endpoint to test the query used in delete_driver
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=503, detail="Neo4j connection not available")
    
    try:
        label = get_driver_label(driver_type)
        with driver.session() as session:
            # Test the exact query used in delete_driver
            objects_result = session.run(f"""
                MATCH (d:{label} {{name: $name}})-[:RELEVANT_TO]->(o:Object)
                RETURN o.id as id, o.driver as driver, o.being as being, 
                       o.avatar as avatar, o.object as object
            """, name=name)
            
            objects_list = list(objects_result)
            return {
                "driver_name": name,
                "driver_type": label,
                "query": f"MATCH (d:{label} {{name: '{name}'}})-[:RELEVANT_TO]->(o:Object) RETURN o.id as id, o.driver as driver, o.being as being, o.avatar as avatar, o.object as object",
                "found_objects": objects_list,
                "count": len(objects_list)
            }
            
    except Exception as e:
        print(f"Error in debug query: {e}")
        raise HTTPException(status_code=500, detail=f"Debug query failed: {str(e)}")

@router.get("/drivers/{driver_type}/relationships")
async def get_driver_relationships(driver_type: DriverType, name: str):
    """
    Get relationships for a specific driver value.
    Useful for checking what Objects/Variables/Lists use this driver.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=503, detail="Neo4j connection not available")
    
    try:
        label = get_driver_label(driver_type)
        with driver.session() as session:
            # Find relationships to Objects, Variables, and Lists
            result = session.run(f"""
                MATCH (d:{label} {{name: $name}})
                OPTIONAL MATCH (d)-[r]-(related)
                WHERE related:Object OR related:Variable OR related:List
                RETURN type(r) as relationship_type, 
                       labels(related) as related_labels,
                       related.id as related_id,
                       related.object as object_name,
                       related.variable as variable_name,
                       related.list as list_name
            """, name=name)
            
            relationships = []
            for record in result:
                relationships.append({
                    "type": record["relationship_type"],
                    "related_type": record["related_labels"][0] if record["related_labels"] else "Unknown",
                    "related_id": record["related_id"],
                    "name": record["object_name"] or record["variable_name"] or record["list_name"]
                })
            
            return {
                "driver_name": name,
                "driver_type": label,
                "relationships": relationships,
                "count": len(relationships)
            }
            
    except Exception as e:
        print(f"Error getting relationships for {driver_type}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get relationships")
