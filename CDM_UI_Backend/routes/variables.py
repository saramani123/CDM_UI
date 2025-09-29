from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Body
from typing import List, Dict, Any, Optional
import uuid
import csv
import io
import json
from pydantic import BaseModel
from db import get_driver
from schema import VariableCreateRequest, VariableResponse, CSVUploadResponse, CSVRowData

# Pydantic models for JSON body parameters
class ObjectRelationshipCreateRequest(BaseModel):
    to_being: str
    to_avatar: str
    to_object: str

router = APIRouter()

@router.get("/variables", response_model=List[Dict[str, Any]])
async def get_variables():
    """
    Get all variables from the CDM.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Get all variables with their object relationships count
            result = session.run("""
                MATCH (v:Variable)
                OPTIONAL MATCH (v)-[:RELEVANT_TO]->(o:Object)
                RETURN v.id as id, v.driver as driver, v.part as part, v.group as group,
                       v.section as section, v.variable as variable, v.formatI as formatI,
                       v.formatII as formatII, v.gType as gType, v.validation as validation,
                       v.default as default, v.graph as graph, v.status as status,
                       count(DISTINCT o) as objectRelationships
                ORDER BY v.id
            """)

            variables = []
            for record in result:
                var = {
                    "id": record["id"],
                    "driver": record["driver"],
                    "part": record["part"],
                    "group": record["group"],
                    "section": record["section"],
                    "variable": record["variable"],
                    "formatI": record["formatI"],
                    "formatII": record["formatII"],
                    "gType": record["gType"],
                    "validation": record["validation"] or "",
                    "default": record["default"] or "",
                    "graph": record["graph"] or "Y",
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
    Create a new variable in the CDM.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Generate unique ID
            variable_id = str(uuid.uuid4())
            
            # Create the variable node
            result = session.run("""
                CREATE (v:Variable {
                    id: $id,
                    driver: $driver,
                    part: $part,
                    group: $group,
                    section: $section,
                    variable: $variable,
                    formatI: $formatI,
                    formatII: $formatII,
                    gType: $gType,
                    validation: $validation,
                    default: $default,
                    graph: $graph,
                    status: $status
                })
                RETURN v.id as id, v.driver as driver, v.part as part, v.group as group,
                       v.section as section, v.variable as variable, v.formatI as formatI,
                       v.formatII as formatII, v.gType as gType, v.validation as validation,
                       v.default as default, v.graph as graph, v.status as status
            """, {
                "id": variable_id,
                "driver": variable_data.driver,
                "part": variable_data.part,
                "group": variable_data.group,
                "section": variable_data.section,
                "variable": variable_data.variable,
                "formatI": variable_data.formatI,
                "formatII": variable_data.formatII,
                "gType": variable_data.gType,
                "validation": variable_data.validation or "",
                "default": variable_data.default or "",
                "graph": variable_data.graph or "Y",
                "status": variable_data.status or "Active"
            })

            record = result.single()
            if not record:
                raise HTTPException(status_code=500, detail="Failed to create variable")

            return VariableResponse(
                id=record["id"],
                driver=record["driver"],
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

@router.put("/variables/{variable_id}", response_model=VariableResponse)
async def update_variable(variable_id: str, variable_data: VariableCreateRequest):
    """
    Update an existing variable in the CDM.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Update the variable node
            result = session.run("""
                MATCH (v:Variable {id: $id})
                SET v.driver = $driver,
                    v.part = $part,
                    v.group = $group,
                    v.section = $section,
                    v.variable = $variable,
                    v.formatI = $formatI,
                    v.formatII = $formatII,
                    v.gType = $gType,
                    v.validation = $validation,
                    v.default = $default,
                    v.graph = $graph,
                    v.status = $status
                RETURN v.id as id, v.driver as driver, v.part as part, v.group as group,
                       v.section as section, v.variable as variable, v.formatI as formatI,
                       v.formatII as formatII, v.gType as gType, v.validation as validation,
                       v.default as default, v.graph as graph, v.status as status
            """, {
                "id": variable_id,
                "driver": variable_data.driver,
                "part": variable_data.part,
                "group": variable_data.group,
                "section": variable_data.section,
                "variable": variable_data.variable,
                "formatI": variable_data.formatI,
                "formatII": variable_data.formatII,
                "gType": variable_data.gType,
                "validation": variable_data.validation or "",
                "default": variable_data.default or "",
                "graph": variable_data.graph or "Y",
                "status": variable_data.status or "Active"
            })

            record = result.single()
            if not record:
                raise HTTPException(status_code=404, detail="Variable not found")

            # Get object relationships count
            relationships_result = session.run("""
                MATCH (v:Variable {id: $id})-[:RELEVANT_TO]->(o:Object)
                RETURN count(o) as count
            """, {"id": variable_id})

            relationships_count = relationships_result.single()["count"] if relationships_result.single() else 0

            return VariableResponse(
                id=record["id"],
                driver=record["driver"],
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

@router.post("/variables/{variable_id}/object-relationships")
async def create_object_relationship(variable_id: str, relationship_data: ObjectRelationshipCreateRequest):
    """
    Create an object relationship for a variable.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
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
            else:
                # Connect to specific being, avatar, and object
                objects_result = session.run("MATCH (o:Object {being: $being, avatar: $avatar, object: $object}) RETURN o", 
                    {"being": relationship_data.to_being, "avatar": relationship_data.to_avatar, "object": relationship_data.to_object})

            # Create relationships
            relationships_created = 0
            for record in objects_result:
                session.run("""
                    MATCH (v:Variable {id: $variable_id})
                    MATCH (o:Object {id: $object_id})
                    MERGE (v)-[:RELEVANT_TO]->(o)
                """, {"variable_id": variable_id, "object_id": record["o"]["id"]})
                relationships_created += 1

            return {"message": f"Created {relationships_created} object relationships"}

    except Exception as e:
        print(f"Error creating object relationship: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create object relationship: {str(e)}")

@router.delete("/variables/{variable_id}/object-relationships/{relationship_id}")
async def delete_object_relationship(variable_id: str, relationship_id: str):
    """
    Delete an object relationship for a variable.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Delete the specific relationship
            result = session.run("""
                MATCH (v:Variable {id: $variable_id})-[r:RELEVANT_TO]->(o:Object {id: $object_id})
                DELETE r
                RETURN count(r) as deleted
            """, {"variable_id": variable_id, "object_id": relationship_id})

            deleted_count = result.single()["deleted"] if result.single() else 0
            if deleted_count == 0:
                raise HTTPException(status_code=404, detail="Object relationship not found")

            return {"message": "Object relationship deleted successfully"}

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
        # Read CSV content
        content = await file.read()
        csv_content = content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(csv_content))
        
        variables = []
        errors = []
        
        for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 because of header
            try:
                # Validate required fields
                required_fields = ['Sector', 'Domain', 'Country', 'Variable Clarifier', 'Part', 'Group', 'Section', 'Variable', 'Format I', 'Format II']
                missing_fields = [field for field in required_fields if not row.get(field, '').strip()]
                
                if missing_fields:
                    errors.append(f"Row {row_num}: Missing required fields: {', '.join(missing_fields)}")
                    continue

                # Parse driver selections
                sector = row['Sector'].strip() == 'ALL' ? ['ALL'] : [s.strip() for s in row['Sector'].split(',')]
                domain = row['Domain'].strip() == 'ALL' ? ['ALL'] : [d.strip() for d in row['Domain'].split(',')]
                country = row['Country'].strip() == 'ALL' ? ['ALL'] : [c.strip() for c in row['Country'].split(',')]
                variable_clarifier = row['Variable Clarifier'].strip() or 'None'
                
                # Create driver string
                sector_str = 'ALL' if 'ALL' in sector else ', '.join(sector)
                domain_str = 'ALL' if 'ALL' in domain else ', '.join(domain)
                country_str = 'ALL' if 'ALL' in country else ', '.join(country)
                driver_string = f"{sector_str}, {domain_str}, {country_str}, {variable_clarifier}"

                # Create variable data
                variable_data = {
                    "id": str(uuid.uuid4()),
                    "driver": driver_string,
                    "part": row['Part'].strip(),
                    "group": row['Group'].strip(),
                    "section": row['Section'].strip(),
                    "variable": row['Variable'].strip(),
                    "formatI": row['Format I'].strip(),
                    "formatII": row['Format II'].strip(),
                    "gType": row.get('G-Type', '').strip() or '',
                    "validation": row.get('Validation', '').strip() or '',
                    "default": row.get('Default', '').strip() or '',
                    "graph": row.get('Graph', 'Y').strip() or 'Y',
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
                    session.run("""
                        CREATE (v:Variable {
                            id: $id,
                            driver: $driver,
                            part: $part,
                            group: $group,
                            section: $section,
                            variable: $variable,
                            formatI: $formatI,
                            formatII: $formatII,
                            gType: $gType,
                            validation: $validation,
                            default: $default,
                            graph: $graph,
                            status: $status
                        })
                    """, var_data)
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

    except Exception as e:
        print(f"Error in bulk upload: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process CSV file: {str(e)}")