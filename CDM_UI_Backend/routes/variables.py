from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Body
from typing import List, Dict, Any, Optional
import uuid
import io
import json
import csv
from pydantic import BaseModel, Field
from db import get_driver
from schema import VariableCreateRequest, VariableUpdateRequest, VariableResponse, CSVUploadResponse, CSVRowData, BulkVariableUpdateRequest, BulkVariableUpdateResponse, ObjectRelationshipCreateRequest

# Pydantic models for JSON body parameters

router = APIRouter()

async def create_driver_relationships(session, variable_id: str, driver_string: str):
    """
    Create driver relationships for a variable based on the driver string.
    Driver string format: "Sector, Domain, Country, VariableClarifier"
    """
    try:
        print(f"Creating driver relationships for variable {variable_id} with driver string: {driver_string}")
        # Parse driver string
        parts = [part.strip() for part in driver_string.split(',')]
        if len(parts) != 4:
            print(f"Invalid driver string format: {driver_string}")
            return
        
        sector_str, domain_str, country_str, variable_clarifier = parts
        
        # Handle Sector relationships
        if sector_str == "ALL":
            # Create relationships to ALL existing sectors
            session.run("""
                MATCH (s:Sector)
                MATCH (v:Variable {id: $variable_id})
                WITH s, v
                MERGE (s)-[:RELEVANT_TO]->(v)
            """, variable_id=variable_id)
        else:
            # Create relationships to individual sectors
            sectors = [s.strip() for s in sector_str.split(',')]
            for sector in sectors:
                session.run("""
                    MERGE (s:Sector {name: $sector})
                    WITH s
                    MATCH (v:Variable {id: $variable_id})
                    MERGE (s)-[:RELEVANT_TO]->(v)
                """, sector=sector, variable_id=variable_id)
        
        # Handle Domain relationships
        if domain_str == "ALL":
            # Create relationships to ALL existing domains
            session.run("""
                MATCH (d:Domain)
                MATCH (v:Variable {id: $variable_id})
                WITH d, v
                MERGE (d)-[:RELEVANT_TO]->(v)
            """, variable_id=variable_id)
        else:
            domains = [d.strip() for d in domain_str.split(',')]
            for domain in domains:
                session.run("""
                    MERGE (d:Domain {name: $domain})
                    WITH d
                    MATCH (v:Variable {id: $variable_id})
                    MERGE (d)-[:RELEVANT_TO]->(v)
                """, domain=domain, variable_id=variable_id)
        
        # Handle Country relationships
        if country_str == "ALL":
            # Create relationships to ALL existing countries
            session.run("""
                MATCH (c:Country)
                MATCH (v:Variable {id: $variable_id})
                WITH c, v
                MERGE (c)-[:RELEVANT_TO]->(v)
            """, variable_id=variable_id)
        else:
            countries = [c.strip() for c in country_str.split(',')]
            for country in countries:
                session.run("""
                    MERGE (c:Country {name: $country})
                    WITH c
                    MATCH (v:Variable {id: $variable_id})
                    MERGE (c)-[:RELEVANT_TO]->(v)
                """, country=country, variable_id=variable_id)
        
        # Handle Variable Clarifier relationship (single select)
        # Skip if "None" or empty
        if variable_clarifier and variable_clarifier != "None" and variable_clarifier != "":
            session.run("""
                MERGE (vc:VariableClarifier {name: $clarifier})
                WITH vc
                MATCH (v:Variable {id: $variable_id})
                MERGE (vc)-[:RELEVANT_TO]->(v)
            """, clarifier=variable_clarifier, variable_id=variable_id)
            
    except Exception as e:
        print(f"Error creating driver relationships: {e}")
        raise e

@router.get("/variables", response_model=List[Dict[str, Any]])
async def get_variables():
    """
    Get all variables from the CDM with proper taxonomy structure.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Get all variables with their taxonomy and relationships
            result = session.run("""
                MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v:Variable)
                OPTIONAL MATCH (o:Object)-[:HAS_SPECIFIC_VARIABLE]->(v)
                OPTIONAL MATCH (v)<-[:RELEVANT_TO]-(s:Sector)
                OPTIONAL MATCH (v)<-[:RELEVANT_TO]-(d:Domain)
                OPTIONAL MATCH (v)<-[:RELEVANT_TO]-(c:Country)
                OPTIONAL MATCH (v)<-[:RELEVANT_TO]-(vc:VariableClarifier)
                WITH v, p, g, count(DISTINCT o) as objectRelationships,
                     collect(DISTINCT s.name) as sectors,
                     collect(DISTINCT d.name) as domains,
                     collect(DISTINCT c.name) as countries,
                     collect(DISTINCT vc.name) as variableClarifiers
                RETURN v.id as id, v.name as variable, v.section as section,
                       v.formatI as formatI, v.formatII as formatII, v.gType as gType,
                       v.validation as validation, v.default as default, v.graph as graph,
                       v.status as status, p.name as part, g.name as group,
                       objectRelationships, sectors, domains, countries, variableClarifiers
                ORDER BY v.id
            """)

            variables = []
            for record in result:
                # Get driver data from the query results
                sectors = record["sectors"] or []
                domains = record["domains"] or []
                countries = record["countries"] or []
                variable_clarifiers = record["variableClarifiers"] or []
                
                # Create driver string in the expected format: "Sector, Domain, Country, VariableClarifier"
                sector_str = "ALL" if "ALL" in sectors else (", ".join(sectors) if sectors else "ALL")
                domain_str = "ALL" if "ALL" in domains else (", ".join(domains) if domains else "ALL")
                country_str = "ALL" if "ALL" in countries else (", ".join(countries) if countries else "ALL")
                clarifier_str = variable_clarifiers[0] if variable_clarifiers else "None"
                
                driver_string = f"{sector_str}, {domain_str}, {country_str}, {clarifier_str}"
                
                var = {
                    "id": record["id"],
                    "driver": driver_string,
                    "part": record["part"],
                    "group": record["group"],
                    "section": record["section"],
                    "variable": record["variable"],
                    "formatI": record["formatI"],
                    "formatII": record["formatII"],
                    "gType": record["gType"],
                    "validation": record["validation"] or "",
                    "default": record["default"] or "",
                    "graph": record["graph"] or "Yes",
                    "status": record["status"] or "Active",
                    "objectRelationships": record["objectRelationships"],
                    "objectRelationshipsList": []
                }
                variables.append(var)

            return variables

    except Exception as e:
        print(f"Error fetching variables: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch variables: {str(e)}")

@router.post("/variables", response_model=VariableResponse)
async def create_variable(variable_data: VariableCreateRequest):
    """
    Create a new variable in the CDM with proper taxonomy structure.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Generate unique ID
            variable_id = str(uuid.uuid4())
            
            # Create taxonomy structure: Part -> Group -> Variable
            result = session.run("""
                // MERGE Part node (avoid duplicates)
                MERGE (p:Part {name: $part})
                
                // MERGE Group node (avoid duplicates)
                MERGE (g:Group {name: $group})
                
                // Create relationship Part -> Group
                MERGE (p)-[:HAS_GROUP]->(g)
                
                // Create Variable node with all properties
                CREATE (v:Variable {
                    id: $id,
                    name: $variable,
                    section: $section,
                    formatI: $formatI,
                    formatII: $formatII,
                    gType: $gType,
                    validation: $validation,
                    default: $default,
                    graph: $graph,
                    status: $status
                })
                
                // Create relationship Group -> Variable
                MERGE (g)-[:HAS_VARIABLE]->(v)
                
                // Return the variable data for response
                RETURN v.id as id, v.name as variable, v.section as section,
                       v.formatI as formatI, v.formatII as formatII, v.gType as gType,
                       v.validation as validation, v.default as default, v.graph as graph,
                       v.status as status, $part as part, $group as group
            """, {
                "id": variable_id,
                "part": variable_data.part,
                "group": variable_data.group,
                "variable": variable_data.variable,
                "section": variable_data.section,
                "formatI": variable_data.formatI,
                "formatII": variable_data.formatII,
                "gType": variable_data.gType,
                "validation": variable_data.validation or "",
                "default": variable_data.default or "",
                "graph": variable_data.graph or "Yes",
                "status": variable_data.status or "Active"
            })

            record = result.single()
            if not record:
                raise HTTPException(status_code=500, detail="Failed to create variable")

            # Create driver relationships
            print(f"About to create driver relationships for variable {variable_id}")
            await create_driver_relationships(session, variable_id, variable_data.driver)
            print(f"Driver relationships creation completed for variable {variable_id}")

            return VariableResponse(
                id=record["id"],
                driver=variable_data.driver,
                part=record["part"],
                group=record["group"],
                section=record["section"],
                variable=record["variable"],
                formatI=record["formatI"],
                formatII=record["formatII"],
                gType=record["gType"],
                validation=record["validation"],
                default=record["default"],
                graph=record["graph"],
                status=record["status"],
                objectRelationships=0,
                objectRelationshipsList=[]
            )

    except Exception as e:
        print(f"Error creating variable: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create variable: {str(e)}")

@router.put("/variables/bulk-update", response_model=BulkVariableUpdateResponse)
async def bulk_update_variables(bulk_data: BulkVariableUpdateRequest):
    """
    Bulk update multiple variables with the same changes.
    Only updates fields that are provided (not None) and not "Keep Current" values.
    Applies validation rules: overwrites only where new value chosen, leaves Keep Current fields untouched.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    updated_count = 0
    errors = []

    try:
        with driver.session() as session:
            for variable_id in bulk_data.variable_ids:
                try:
                    print(f"Processing variable ID: {variable_id}")
                    # Get current variable data - first check if variable exists
                    print(f"Running query for variable {variable_id}")
                    current_result = session.run("""
                        MATCH (v:Variable {id: $id})
                        RETURN v
                    """, {"id": variable_id})

                    print(f"Query executed, getting single record")
                    current_record = current_result.single()
                    print(f"Record result: {current_record}")
                    if not current_record:
                        print(f"Variable {variable_id} not found in database")
                        errors.append(f"Variable {variable_id} not found")
                        continue
                    
                    print(f"Variable {variable_id} found, proceeding with update")

                    current_variable = current_record["v"]

                    # Build dynamic SET clause for only provided fields that are not "Keep Current"
                    set_clauses = []
                    params = {"id": variable_id}
                    
                    # Only update fields that are provided and not "Keep Current" values
                    if bulk_data.variable is not None and bulk_data.variable.strip() != "Keep Current":
                        set_clauses.append("v.name = $variable")
                        params["variable"] = bulk_data.variable
                    if bulk_data.section is not None and bulk_data.section.strip() != "Keep Current":
                        set_clauses.append("v.section = $section")
                        params["section"] = bulk_data.section
                    if bulk_data.formatI is not None and bulk_data.formatI.strip() != "Keep Current":
                        set_clauses.append("v.formatI = $formatI")
                        params["formatI"] = bulk_data.formatI
                    if bulk_data.formatII is not None and bulk_data.formatII.strip() != "Keep Current":
                        set_clauses.append("v.formatII = $formatII")
                        params["formatII"] = bulk_data.formatII
                    if bulk_data.gType is not None and bulk_data.gType.strip() != "Keep Current":
                        set_clauses.append("v.gType = $gType")
                        params["gType"] = bulk_data.gType
                    if bulk_data.validation is not None and bulk_data.validation.strip() != "Keep Current":
                        set_clauses.append("v.validation = $validation")
                        params["validation"] = bulk_data.validation
                    if bulk_data.default is not None and bulk_data.default.strip() != "Keep Current":
                        set_clauses.append("v.default = $default")
                        params["default"] = bulk_data.default
                    if bulk_data.graph is not None and bulk_data.graph.strip() != "Keep Current":
                        set_clauses.append("v.graph = $graph")
                        params["graph"] = bulk_data.graph
                    if bulk_data.status is not None and bulk_data.status.strip() != "Keep Current":
                        set_clauses.append("v.status = $status")
                        params["status"] = bulk_data.status

                    # Only update if there are fields to update
                    if set_clauses:
                        update_query = f"""
                            MATCH (v:Variable {{id: $id}})
                            SET {', '.join(set_clauses)}
                        """
                        session.run(update_query, params)

                    # Update driver relationships if driver field is provided and not "Keep Current"
                    if bulk_data.driver is not None and bulk_data.driver.strip() != "Keep Current":
                        print(f"Updating driver relationships with: {bulk_data.driver}")
                        await create_driver_relationships(session, variable_id, bulk_data.driver)

                    # Handle object relationships if provided
                    if bulk_data.objectRelationshipsList is not None and len(bulk_data.objectRelationshipsList) > 0:
                        print(f"Processing {len(bulk_data.objectRelationshipsList)} object relationships")
                        for relationship in bulk_data.objectRelationshipsList:
                            try:
                                # Create object relationship for this variable (append new relationships with deduplication)
                                await create_object_relationship_for_variable(session, variable_id, relationship)
                            except Exception as e:
                                print(f"Error creating object relationship for variable {variable_id}: {str(e)}")
                                errors.append(f"Failed to create object relationship for variable {variable_id}: {str(e)}")

                    updated_count += 1

                except Exception as e:
                    print(f"Error updating variable {variable_id}: {str(e)}")
                    errors.append(f"Failed to update variable {variable_id}: {str(e)}")
                    continue

        return BulkVariableUpdateResponse(
            success=updated_count > 0,
            message=f"Updated {updated_count} variables successfully",
            updated_count=updated_count,
            error_count=len(errors),
            errors=errors
        )

    except Exception as e:
        print(f"Error in bulk update: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to bulk update variables: {str(e)}")

@router.put("/variables/{variable_id}", response_model=VariableResponse)
async def update_variable(variable_id: str, variable_data: VariableUpdateRequest):
    """
    Update an existing variable in the CDM with proper taxonomy structure.
    Supports partial updates - only updates fields that are provided.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # First, get the current variable data
            current_result = session.run("""
                MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v:Variable {id: $id})
                RETURN v, p.name as part, g.name as group
            """, {"id": variable_id})

            current_record = current_result.single()
            if not current_record:
                raise HTTPException(status_code=404, detail="Variable not found")

            current_variable = current_record["v"]
            current_part = current_record["part"]
            current_group = current_record["group"]

            # Build dynamic SET clause for only provided fields
            set_clauses = []
            params = {"id": variable_id}
            
            # Only update fields that are provided in the request
            if variable_data.variable is not None:
                set_clauses.append("v.name = $variable")
                params["variable"] = variable_data.variable
            if variable_data.section is not None:
                set_clauses.append("v.section = $section")
                params["section"] = variable_data.section
            if variable_data.formatI is not None:
                set_clauses.append("v.formatI = $formatI")
                params["formatI"] = variable_data.formatI
            if variable_data.formatII is not None:
                set_clauses.append("v.formatII = $formatII")
                params["formatII"] = variable_data.formatII
            if variable_data.gType is not None:
                set_clauses.append("v.gType = $gType")
                params["gType"] = variable_data.gType
            if variable_data.validation is not None:
                set_clauses.append("v.validation = $validation")
                params["validation"] = variable_data.validation
            if variable_data.default is not None:
                set_clauses.append("v.default = $default")
                params["default"] = variable_data.default
            if variable_data.graph is not None:
                set_clauses.append("v.graph = $graph")
                params["graph"] = variable_data.graph
            if variable_data.status is not None:
                set_clauses.append("v.status = $status")
                params["status"] = variable_data.status

            # Only update if there are fields to update
            if set_clauses:
                update_query = f"""
                    MATCH (v:Variable {{id: $id}})
                    SET {', '.join(set_clauses)}
                    RETURN v.id as id, v.name as variable, v.section as section,
                           v.formatI as formatI, v.formatII as formatII, v.gType as gType,
                           v.validation as validation, v.default as default, v.graph as graph,
                           v.status as status
                """
                
                result = session.run(update_query, params)
                record = result.single()
            else:
                # No fields to update, use current data
                record = {
                    "id": current_variable["id"],
                    "variable": current_variable["name"],
                    "section": current_variable["section"],
                    "formatI": current_variable["formatI"],
                    "formatII": current_variable["formatII"],
                    "gType": current_variable["gType"],
                    "validation": current_variable["validation"],
                    "default": current_variable["default"],
                    "graph": current_variable["graph"],
                    "status": current_variable["status"]
                }

            # Update driver relationships if driver field is provided
            if variable_data.driver is not None:
                await create_driver_relationships(session, variable_id, variable_data.driver)

            # Get object relationships count
            relationships_result = session.run("""
                MATCH (o:Object)-[:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $id})
                RETURN count(o) as count
            """, {"id": variable_id})

            relationships_record = relationships_result.single()
            relationships_count = relationships_record["count"] if relationships_record else 0

            # Use provided values or fall back to current values
            final_part = variable_data.part if variable_data.part is not None else current_part
            final_group = variable_data.group if variable_data.group is not None else current_group
            final_driver = variable_data.driver if variable_data.driver is not None else ""

            return VariableResponse(
                id=record["id"],
                driver=final_driver,
                part=final_part,
                group=final_group,
                section=record["section"],
                variable=record["variable"],
                formatI=record["formatI"],
                formatII=record["formatII"],
                gType=record["gType"],
                validation=record["validation"],
                default=record["default"],
                graph=record["graph"],
                status=record["status"],
                objectRelationships=relationships_count,
                objectRelationshipsList=[]
            )

    except Exception as e:
        print(f"Error updating variable: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update variable: {str(e)}")

@router.delete("/variables/{variable_id}")
async def delete_variable(variable_id: str):
    """
    Delete a variable from the CDM.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Delete the variable and all its relationships
            result = session.run("""
                MATCH (v:Variable {id: $id})
                DETACH DELETE v
                RETURN v.id as id
            """, {"id": variable_id})

            record = result.single()
            if not record:
                raise HTTPException(status_code=404, detail="Variable not found")

            return {"message": "Variable deleted successfully"}

    except Exception as e:
        print(f"Error deleting variable: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete variable: {str(e)}")

@router.get("/variables/{variable_id}/object-relationships")
async def get_object_relationships(variable_id: str):
    """
    Get all object relationships for a variable.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Get all object relationships for this variable
            result = session.run("""
                MATCH (o:Object)-[r:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $variable_id})
                RETURN o.being as being, o.avatar as avatar, o.object as object, r.createdBy as createdBy
            """, {"variable_id": variable_id})
            
            relationships = []
            for record in result:
                relationships.append({
                    "toBeing": record["being"],
                    "toAvatar": record["avatar"], 
                    "toObject": record["object"],
                    "createdBy": record["createdBy"]
                })
            
            print(f"Found {len(relationships)} object relationships for variable {variable_id}")
            return {"relationships": relationships}
            
    except Exception as e:
        print(f"Error getting object relationships: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get object relationships: {str(e)}")

@router.post("/variables/{variable_id}/object-relationships")
async def create_object_relationship(variable_id: str, relationship_data: ObjectRelationshipCreateRequest):
    """
    Create an object relationship for a variable with role property.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        print(f"Creating object relationship for variable {variable_id} with data: {relationship_data}")
        with driver.session() as session:
            # Find the variable
            variable_result = session.run("""
                MATCH (v:Variable {id: $id})
                RETURN v
            """, {"id": variable_id})

            if not variable_result.single():
                raise HTTPException(status_code=404, detail="Variable not found")

            # Find matching objects based on the relationship criteria
            if relationship_data.to_being == "ALL" and relationship_data.to_avatar == "ALL" and relationship_data.to_object == "ALL":
                # Connect to all objects
                objects_result = session.run("MATCH (o:Object) RETURN o")
            elif relationship_data.to_being == "ALL" and relationship_data.to_avatar == "ALL":
                # Connect to all objects with specific object name
                objects_result = session.run("MATCH (o:Object {object: $object}) RETURN o", {"object": relationship_data.to_object})
            elif relationship_data.to_being == "ALL":
                # Connect to all objects with specific avatar and object
                objects_result = session.run("MATCH (o:Object {avatar: $avatar, object: $object}) RETURN o", 
                    {"avatar": relationship_data.to_avatar, "object": relationship_data.to_object})
            elif relationship_data.to_object == "ALL":
                # Connect to all objects with specific being and avatar (regardless of object name)
                objects_result = session.run("MATCH (o:Object {being: $being, avatar: $avatar}) RETURN o", 
                    {"being": relationship_data.to_being, "avatar": relationship_data.to_avatar})
            else:
                # Connect to specific being, avatar, and object
                objects_result = session.run("MATCH (o:Object {being: $being, avatar: $avatar, object: $object}) RETURN o", 
                    {"being": relationship_data.to_being, "avatar": relationship_data.to_avatar, "object": relationship_data.to_object})

            # Create relationships with HAS_SPECIFIC_VARIABLE relationship name
            relationships_created = 0
            for record in objects_result:
                print(f"Creating relationship between variable {variable_id} and object {record['o']['id']}")
                session.run("""
                    MATCH (v:Variable {id: $variable_id})
                    MATCH (o:Object {id: $object_id})
                    MERGE (o)-[:HAS_SPECIFIC_VARIABLE {createdBy: "frontend"}]->(v)
                """, {
                    "variable_id": variable_id, 
                    "object_id": record["o"]["id"]
                })
                relationships_created += 1

            print(f"Successfully created {relationships_created} object relationships")
            return {"message": f"Created {relationships_created} object relationships"}

    except Exception as e:
        print(f"Error creating object relationship: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create object relationship: {str(e)}")

@router.delete("/variables/{variable_id}/object-relationships")
async def delete_object_relationship(variable_id: str, relationship_data: ObjectRelationshipCreateRequest):
    """
    Delete object relationships for a variable by criteria.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        print(f"Deleting object relationships for variable {variable_id} with criteria: {relationship_data}")
        with driver.session() as session:
            # Find matching objects based on the relationship criteria
            if relationship_data.to_being == "ALL" and relationship_data.to_avatar == "ALL" and relationship_data.to_object == "ALL":
                # Delete all relationships for this variable
                objects_result = session.run("MATCH (o:Object)-[r:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $variable_id}) RETURN o", {"variable_id": variable_id})
            elif relationship_data.to_being == "ALL" and relationship_data.to_avatar == "ALL":
                # Delete relationships to all objects with specific object name
                objects_result = session.run("MATCH (o:Object {object: $object})-[r:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $variable_id}) RETURN o", {"object": relationship_data.to_object, "variable_id": variable_id})
            elif relationship_data.to_being == "ALL":
                # Delete relationships to all objects with specific avatar and object
                objects_result = session.run("MATCH (o:Object {avatar: $avatar, object: $object})-[r:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $variable_id}) RETURN o", 
                    {"avatar": relationship_data.to_avatar, "object": relationship_data.to_object, "variable_id": variable_id})
            elif relationship_data.to_object == "ALL":
                # Delete relationships to all objects with specific being and avatar (regardless of object name)
                objects_result = session.run("MATCH (o:Object {being: $being, avatar: $avatar})-[r:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $variable_id}) RETURN o", 
                    {"being": relationship_data.to_being, "avatar": relationship_data.to_avatar, "variable_id": variable_id})
            else:
                # Delete relationships to specific being, avatar, and object
                objects_result = session.run("MATCH (o:Object {being: $being, avatar: $avatar, object: $object})-[r:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $variable_id}) RETURN o", 
                    {"being": relationship_data.to_being, "avatar": relationship_data.to_avatar, "object": relationship_data.to_object, "variable_id": variable_id})

            # Delete relationships
            relationships_deleted = 0
            for record in objects_result:
                print(f"Deleting relationship between variable {variable_id} and object {record['o']['id']}")
                session.run("""
                    MATCH (o:Object {id: $object_id})-[r:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $variable_id})
                    DELETE r
                """, {
                    "variable_id": variable_id, 
                    "object_id": record["o"]["id"]
                })
                relationships_deleted += 1

            print(f"Successfully deleted {relationships_deleted} object relationships")
            return {"message": f"Deleted {relationships_deleted} object relationships"}

    except Exception as e:
        print(f"Error deleting object relationship: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete object relationship: {str(e)}")

@router.post("/variables/bulk-upload", response_model=CSVUploadResponse)
async def bulk_upload_variables(file: UploadFile = File(...)):
    """
    Bulk upload variables from CSV file.
    """
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
        # Normalize line endings first to handle Windows-style (\r\n) and Unix-style (\n) newlines
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
            
            # Simple split by comma - this handles unquoted fields with spaces
            values = [v.strip() for v in line.split(',')]
            
            # Create row dictionary
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
    
    variables = []
    errors = []
    
    for row_num, row in enumerate(rows, start=2):  # Start at 2 because of header
        try:
            # Validate required fields
            required_fields = ['Sector', 'Domain', 'Country', 'Variable Clarifier', 'Part', 'Section', 'Group', 'Variable']
            missing_fields = [field for field in required_fields if not row.get(field, '').strip()]
            
            if missing_fields:
                errors.append(f"Row {row_num}: Missing required fields: {', '.join(missing_fields)}")
                continue

            # Parse driver selections
            sector = ['ALL'] if row['Sector'].strip() == 'ALL' else [s.strip() for s in row['Sector'].split(',')]
            domain = ['ALL'] if row['Domain'].strip() == 'ALL' else [d.strip() for d in row['Domain'].split(',')]
            country = ['ALL'] if row['Country'].strip() == 'ALL' else [c.strip() for c in row['Country'].split(',')]
            variable_clarifier = row['Variable Clarifier'].strip() if row['Variable Clarifier'].strip() else 'None'
            
            # Create driver string
            sector_str = 'ALL' if 'ALL' in sector else ', '.join(sector)
            domain_str = 'ALL' if 'ALL' in domain else ', '.join(domain)
            country_str = 'ALL' if 'ALL' in country else ', '.join(country)
            driver_string = f"{sector_str}, {domain_str}, {country_str}, {variable_clarifier}"

            # Create variable data with proper handling of optional fields
            variable_data = {
                "id": str(uuid.uuid4()),
                "driver": driver_string,
                "part": row['Part'].strip(),
                "section": row['Section'].strip(),
                "group": row['Group'].strip(),
                "variable": row['Variable'].strip(),
                "formatI": row.get('Format I', '').strip() or '',
                "formatII": row.get('Format II', '').strip() or '',
                "gType": row.get('G-Type', '').strip() or '',
                "validation": row.get('Validation', '').strip() or '',
                "default": row.get('Default', '').strip() or '',
                "graph": row.get('Graph', 'Yes').strip() or 'Yes',
                "status": "Active"
            }
            
            variables.append(variable_data)
            
        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")
            continue

    # Insert variables into database
    created_count = 0
    with driver.session() as session:
        for var_data in variables:
            try:
                # Create taxonomy structure: Part -> Group -> Variable
                session.run("""
                    // MERGE Part node (avoid duplicates)
                    MERGE (p:Part {name: $part})
                    
                    // MERGE Group node (avoid duplicates)
                    MERGE (g:Group {name: $group})
                    
                    // Create relationship Part -> Group
                    MERGE (p)-[:HAS_GROUP]->(g)
                    
                    // Create Variable node with all properties
                    CREATE (v:Variable {
                        id: $id,
                        name: $variable,
                        section: $section,
                        formatI: $formatI,
                        formatII: $formatII,
                        gType: $gType,
                        validation: $validation,
                        default: $default,
                        graph: $graph,
                        status: $status
                    })
                    
                    // Create relationship Group -> Variable
                    MERGE (g)-[:HAS_VARIABLE]->(v)
                """, var_data)
                
                # Create driver relationships
                await create_driver_relationships(session, var_data['id'], var_data['driver'])
                created_count += 1
            except Exception as e:
                errors.append(f"Failed to create variable {var_data['variable']}: {str(e)}")

    return CSVUploadResponse(
        success=True,
        message=f"Successfully created {created_count} variables",
        created_count=created_count,
        error_count=len(errors),
        errors=errors
    )

@router.get("/variables/test/{variable_id}")
async def test_variable_lookup(variable_id: str):
    """Test endpoint to check if variable lookup works"""
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")
    
    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (v:Variable {id: $id})
                RETURN v
            """, {"id": variable_id})
            
            record = result.single()
            if not record:
                return {"found": False, "message": "Variable not found"}
            else:
                return {"found": True, "variable": dict(record["v"])}
    except Exception as e:
        return {"error": str(e)}

@router.put("/variables/bulk-update", response_model=BulkVariableUpdateResponse)
async def bulk_update_variables(bulk_data: BulkVariableUpdateRequest):
    """
    Bulk update multiple variables with the same changes.
    Only updates fields that are provided (not None) and not "Keep Current" values.
    Applies validation rules: overwrites only where new value chosen, leaves Keep Current fields untouched.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    updated_count = 0
    errors = []

    try:
        with driver.session() as session:
            for variable_id in bulk_data.variable_ids:
                try:
                    print(f"Processing variable ID: {variable_id}")
                    # Get current variable data - first check if variable exists
                    print(f"Running query for variable {variable_id}")
                    current_result = session.run("""
                        MATCH (v:Variable {id: $id})
                        RETURN v
                    """, {"id": variable_id})

                    print(f"Query executed, getting single record")
                    current_record = current_result.single()
                    print(f"Record result: {current_record}")
                    if not current_record:
                        print(f"Variable {variable_id} not found in database")
                        errors.append(f"Variable {variable_id} not found")
                        continue
                    
                    print(f"Variable {variable_id} found, proceeding with update")

                    current_variable = current_record["v"]

                    # Build dynamic SET clause for only provided fields that are not "Keep Current"
                    set_clauses = []
                    params = {"id": variable_id}
                    
                    # Only update fields that are provided and not "Keep Current" values
                    if bulk_data.variable is not None and bulk_data.variable.strip() != "Keep Current":
                        set_clauses.append("v.name = $variable")
                        params["variable"] = bulk_data.variable
                    if bulk_data.section is not None and bulk_data.section.strip() != "Keep Current":
                        set_clauses.append("v.section = $section")
                        params["section"] = bulk_data.section
                    if bulk_data.formatI is not None and bulk_data.formatI.strip() != "Keep Current":
                        set_clauses.append("v.formatI = $formatI")
                        params["formatI"] = bulk_data.formatI
                    if bulk_data.formatII is not None and bulk_data.formatII.strip() != "Keep Current":
                        set_clauses.append("v.formatII = $formatII")
                        params["formatII"] = bulk_data.formatII
                    if bulk_data.gType is not None and bulk_data.gType.strip() != "Keep Current":
                        set_clauses.append("v.gType = $gType")
                        params["gType"] = bulk_data.gType
                    if bulk_data.validation is not None and bulk_data.validation.strip() != "Keep Current":
                        set_clauses.append("v.validation = $validation")
                        params["validation"] = bulk_data.validation
                    if bulk_data.default is not None and bulk_data.default.strip() != "Keep Current":
                        set_clauses.append("v.default = $default")
                        params["default"] = bulk_data.default
                    if bulk_data.graph is not None and bulk_data.graph.strip() != "Keep Current":
                        set_clauses.append("v.graph = $graph")
                        params["graph"] = bulk_data.graph
                    if bulk_data.status is not None and bulk_data.status.strip() != "Keep Current":
                        set_clauses.append("v.status = $status")
                        params["status"] = bulk_data.status

                    # Only update if there are fields to update
                    if set_clauses:
                        update_query = f"""
                            MATCH (v:Variable {{id: $id}})
                            SET {', '.join(set_clauses)}
                        """
                        session.run(update_query, params)

                    # Update driver relationships if driver field is provided and not "Keep Current"
                    if bulk_data.driver is not None and bulk_data.driver.strip() != "Keep Current":
                        print(f"Updating driver relationships with: {bulk_data.driver}")
                        await create_driver_relationships(session, variable_id, bulk_data.driver)

                    # Handle object relationships if provided
                    if bulk_data.objectRelationshipsList is not None and len(bulk_data.objectRelationshipsList) > 0:
                        print(f"Processing {len(bulk_data.objectRelationshipsList)} object relationships")
                        for relationship in bulk_data.objectRelationshipsList:
                            try:
                                # Create object relationship for this variable (append new relationships with deduplication)
                                await create_object_relationship_for_variable(session, variable_id, relationship)
                            except Exception as e:
                                print(f"Error creating object relationship for variable {variable_id}: {str(e)}")
                                errors.append(f"Failed to create object relationship for variable {variable_id}: {str(e)}")

                    updated_count += 1

                except Exception as e:
                    print(f"Error updating variable {variable_id}: {str(e)}")
                    errors.append(f"Failed to update variable {variable_id}: {str(e)}")
                    continue

        return BulkVariableUpdateResponse(
            success=updated_count > 0,
            message=f"Updated {updated_count} variables successfully",
            updated_count=updated_count,
            error_count=len(errors),
            errors=errors
        )

    except Exception as e:
        print(f"Error in bulk update: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to bulk update variables: {str(e)}")

async def create_object_relationship_for_variable(session, variable_id: str, relationship_data: ObjectRelationshipCreateRequest):
    """
    Create an object relationship for a variable.
    Note: Variable existence is already verified in the calling function.
    """
    try:
        # Find matching objects based on the relationship criteria
        if relationship_data.to_being == "ALL" and relationship_data.to_avatar == "ALL" and relationship_data.to_object == "ALL":
            # Connect to all objects
            objects_result = session.run("MATCH (o:Object) RETURN o")
        elif relationship_data.to_being == "ALL" and relationship_data.to_avatar == "ALL":
            # Connect to all objects with specific object name
            objects_result = session.run("MATCH (o:Object {object: $object}) RETURN o", {"object": relationship_data.to_object})
        elif relationship_data.to_being == "ALL":
            # Connect to all objects with specific avatar and object
            objects_result = session.run("MATCH (o:Object {avatar: $avatar, object: $object}) RETURN o", 
                {"avatar": relationship_data.to_avatar, "object": relationship_data.to_object})
        elif relationship_data.to_object == "ALL":
            # Connect to all objects with specific being and avatar (regardless of object name)
            objects_result = session.run("MATCH (o:Object {being: $being, avatar: $avatar}) RETURN o", 
                {"being": relationship_data.to_being, "avatar": relationship_data.to_avatar})
        else:
            # Connect to specific being, avatar, and object
            objects_result = session.run("MATCH (o:Object {being: $being, avatar: $avatar, object: $object}) RETURN o", 
                {"being": relationship_data.to_being, "avatar": relationship_data.to_avatar, "object": relationship_data.to_object})

        # Create relationships with HAS_SPECIFIC_VARIABLE relationship name
        relationships_created = 0
        for record in objects_result:
            # Check if relationship already exists to avoid duplicates
            existing_rel = session.run("""
                MATCH (o:Object {id: $object_id})-[r:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $variable_id})
                RETURN r
            """, {
                "variable_id": variable_id, 
                "object_id": record["o"]["id"]
            }).single()
            
            if not existing_rel:
                session.run("""
                    MATCH (v:Variable {id: $variable_id})
                    MATCH (o:Object {id: $object_id})
                    MERGE (o)-[:HAS_SPECIFIC_VARIABLE {createdBy: "frontend"}]->(v)
                """, {
                    "variable_id": variable_id, 
                    "object_id": record["o"]["id"]
                })
                relationships_created += 1

        return relationships_created

    except Exception as e:
        print(f"Error creating object relationship: {e}")
        raise e