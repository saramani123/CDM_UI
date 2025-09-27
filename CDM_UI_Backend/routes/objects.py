from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Body
from typing import List, Dict, Any, Optional
import uuid
import csv
import io
import json
from db import get_driver
from schema import ObjectCreateRequest, ObjectResponse, CSVUploadResponse, CSVRowData

router = APIRouter()

@router.get("/objects", response_model=List[Dict[str, Any]])
async def get_objects():
    """
    Get all objects from the CDM.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Get all objects with their relationships and variants counts
            result = session.run("""
                MATCH (o:Object)
                OPTIONAL MATCH (o)-[:RELATES_TO]->(other:Object)
                OPTIONAL MATCH (o)-[:HAS_VARIANT]->(v:Variant)
                RETURN o.id as id, o.driver as driver, o.being as being,
                       o.avatar as avatar, o.object as object, o.status as status,
                       count(DISTINCT other) as relationships,
                       count(DISTINCT v) as variants,
                       0 as variables
                ORDER BY o.id
            """)

            objects = []
            for record in result:
                obj = {
                    "id": record["id"],
                    "driver": record["driver"],
                    "being": record["being"],
                    "avatar": record["avatar"],
                    "object": record["object"],
                    "relationships": record["relationships"] or 0,
                    "variants": record["variants"] or 0,
                    "variables": record["variables"] or 0,
                    "status": record["status"] or "Active",
                    "relationshipsList": [],  # Will be populated separately
                    "variantsList": []        # Will be populated separately
                }
                objects.append(obj)

            # Get relationships for each object
            for obj in objects:
                # Get direct RELATES_TO relationships
                relationships_result = session.run("""
                    MATCH (o:Object {id: $object_id})-[r:RELATES_TO]->(other:Object)
                    RETURN r.type as type, r.role as role,
                           other.being as toBeing, other.avatar as toAvatar, other.object as toObject
                """, object_id=obj["id"])

                relationships = []
                for rel_record in relationships_result:
                    relationships.append({
                        "id": str(uuid.uuid4()),
                        "type": rel_record["type"],
                        "role": rel_record["role"],
                        "toBeing": rel_record["toBeing"],
                        "toAvatar": rel_record["toAvatar"],
                        "toObject": rel_record["toObject"]
                    })
                
                obj["relationshipsList"] = relationships

                # Get variants for each object
                variants_result = session.run("""
                    MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
                    RETURN v.name as name
                """, object_id=obj["id"])

                variants = []
                for var_record in variants_result:
                    variants.append({
                        "id": str(uuid.uuid4()),
                        "name": var_record["name"]
                    })
                obj["variantsList"] = variants

            print(f"Retrieved {len(objects)} objects from Neo4j")
            return objects

    except Exception as e:
        print(f"Error querying Neo4j: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@router.get("/objects/{object_id}", response_model=Dict[str, Any])
async def get_object(object_id: str):
    """
    Get a specific object by ID.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (o:Object {id: $object_id})
                RETURN o.id as id, o.driver as driver, o.being as being,
                       o.avatar as avatar, o.object as object, o.status as status
            """, object_id=object_id)

            record = result.single()
            if not record:
                raise HTTPException(status_code=404, detail="Object not found")

            # Get relationship count
            rel_count_result = session.run("""
                MATCH (o:Object {id: $object_id})-[:RELATES_TO]->(other:Object)
                RETURN count(other) as rel_count
            """, object_id=object_id).single()
            
            # Get variant count
            var_count_result = session.run("""
                MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
                RETURN count(v) as var_count
            """, object_id=object_id).single()

            obj = {
                "id": record["id"],
                "driver": record["driver"],
                "being": record["being"],
                "avatar": record["avatar"],
                "object": record["object"],
                "status": record["status"],
                "relationships": rel_count_result["rel_count"] if rel_count_result else 0,
                "variants": var_count_result["var_count"] if var_count_result else 0,
                "variables": 0,
                "relationshipsList": [],
                "variantsList": []
            }

            # Get relationships
            relationships_result = session.run("""
                MATCH (o:Object {id: $object_id})-[r:RELATES_TO]->(other:Object)
                RETURN r.type as type, r.role as role,
                       other.being as toBeing, other.avatar as toAvatar, other.object as toObject
            """, object_id=object_id)

            relationships = []
            for rel_record in relationships_result:
                relationships.append({
                    "id": str(uuid.uuid4()),
                    "type": rel_record["type"],
                    "role": rel_record["role"],
                    "toBeing": rel_record["toBeing"],
                    "toAvatar": rel_record["toAvatar"],
                    "toObject": rel_record["toObject"]
                })
            
            obj["relationshipsList"] = relationships

            # Get variants
            variants_result = session.run("""
                MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
                RETURN v.name as name
            """, object_id=object_id)

            variants = []
            for var_record in variants_result:
                variants.append({
                    "id": str(uuid.uuid4()),
                    "name": var_record["name"]
                })
            obj["variantsList"] = variants

            return obj

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error querying Neo4j: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@router.post("/objects", response_model=ObjectResponse, status_code=status.HTTP_201_CREATED)
async def create_object(object_data: ObjectCreateRequest):
    """
    Create a new object with proper Neo4j relationships.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")
    
    try:
        with driver.session() as session:
            # Validate required fields
            required_fields = ["sector", "domain", "country", "being", "avatar", "object"]
            for field in required_fields:
                value = getattr(object_data, field, None)
                if not value:
                    raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
            
            # Handle optional fields
            objectClarifier = getattr(object_data, 'objectClarifier', None)
            if objectClarifier is not None and not objectClarifier:
                objectClarifier = None
            
            # Generate unique ID
            new_id = str(uuid.uuid4())
            
            # Concatenate driver string
            sector_str = "ALL" if "ALL" in object_data.sector else ", ".join(object_data.sector)
            domain_str = "ALL" if "ALL" in object_data.domain else ", ".join(object_data.domain)
            country_str = "ALL" if "ALL" in object_data.country else ", ".join(object_data.country)
            clarifier_str = objectClarifier or "None"
            driver_string = f"{sector_str}, {domain_str}, {country_str}, {clarifier_str}"
            
            # Check for duplicate objects (same being, avatar, object combination)
            existing = session.run("""
                MATCH (o:Object {being: $being, avatar: $avatar, object: $object})
                RETURN o.id as id
            """, being=object_data.being, avatar=object_data.avatar, object=object_data.object)
            
            if existing.single():
                raise HTTPException(status_code=409, detail="Object with this Being/Avatar/Object combination already exists")
            
            # Create the Object node
            session.run("""
                CREATE (o:Object {
                    id: $id,
                    name: $object,
                    driver: $driver,
                    being: $being,
                    avatar: $avatar,
                    object: $object,
                    status: $status
                })
            """, 
            id=new_id,
            driver=driver_string,
            being=object_data.being,
            avatar=object_data.avatar,
            object=object_data.object,
            status=getattr(object_data, 'status', 'Active'))
            
            # Create Being, Avatar, Object taxonomy relationships if they don't exist
            session.run("""
                MERGE (b:Being {name: $being})
                MERGE (a:Avatar {name: $avatar})
                MERGE (o:Object {id: $object_id, name: $object_name})
                MERGE (b)-[:HAS_AVATAR]->(a)
                MERGE (a)-[:HAS_OBJECT]->(o)
            """, being=object_data.being, avatar=object_data.avatar, object_id=new_id, object_name=object_data.object)
            
            # Create driver relationships
            # Sector relationships
            if "ALL" not in object_data.sector:
                for sector in object_data.sector:
                    session.run("""
                        MATCH (s:Sector {name: $sector})
                        MATCH (o:Object {id: $object_id})
                        WITH s, o
                        CREATE (s)-[:RELEVANT_TO]->(o)
                    """, sector=sector, object_id=new_id)
            
            # Domain relationships
            if "ALL" not in object_data.domain:
                for domain in object_data.domain:
                    session.run("""
                        MATCH (d:Domain {name: $domain})
                        MATCH (o:Object {id: $object_id})
                        WITH d, o
                        CREATE (d)-[:RELEVANT_TO]->(o)
                    """, domain=domain, object_id=new_id)
            
            # Country relationships
            if "ALL" not in object_data.country:
                for country in object_data.country:
                    session.run("""
                        MATCH (c:Country {name: $country})
                        MATCH (o:Object {id: $object_id})
                        WITH c, o
                        CREATE (c)-[:RELEVANT_TO]->(o)
                    """, country=country, object_id=new_id)
            
            # Object Clarifier relationship
            if objectClarifier and objectClarifier != "None":
                session.run("""
                    MATCH (oc:ObjectClarifier {name: $clarifier})
                    MATCH (o:Object {id: $object_id})
                    WITH oc, o
                    CREATE (oc)-[:RELEVANT_TO]->(o)
                """, clarifier=objectClarifier, object_id=new_id)
            
            # Create variants if provided
            variants = getattr(object_data, 'variants', [])
            if variants:
                for variant_name in variants:
                    variant_id = str(uuid.uuid4())
                    session.run("""
                        CREATE (v:Variant {id: $variant_id, name: $name})
                        WITH v
                        MATCH (o:Object {id: $object_id})
                        CREATE (o)-[:HAS_VARIANT]->(v)
                    """, variant_id=variant_id, name=variant_name, object_id=new_id)
            
            # Create relationships if provided
            relationships = getattr(object_data, 'relationships', [])
            if relationships:
                for rel in relationships:
                    # Find the target object based on toBeing, toAvatar, toObject
                    target_result = session.run("""
                        MATCH (target:Object)
                        WHERE (target.being = $toBeing OR $toBeing = "ALL")
                          AND (target.avatar = $toAvatar OR $toAvatar = "ALL")
                          AND (target.object = $toObject OR $toObject = "ALL")
                        RETURN target.id as target_id
                        LIMIT 1
                    """, toBeing=rel.get("toBeing", "ALL"), 
                        toAvatar=rel.get("toAvatar", "ALL"), 
                        toObject=rel.get("toObject", "ALL")).single()
                    
                    if target_result:
                        target_id = target_result["target_id"]
                        session.run("""
                            MATCH (source:Object {id: $source_id})
                            MATCH (target:Object {id: $target_id})
                            CREATE (source)-[:RELATES_TO {
                                type: $type,
                                role: $role,
                                toBeing: $toBeing,
                                toAvatar: $toAvatar,
                                toObject: $toObject
                            }]->(target)
                        """, source_id=new_id, target_id=target_id,
                            type=rel.get("type", "Inter-Table"),
                            role=rel.get("role", ""),
                            toBeing=rel.get("toBeing", "ALL"),
                            toAvatar=rel.get("toAvatar", "ALL"),
                            toObject=rel.get("toObject", "ALL"))
            
            # Calculate actual relationship count
            rel_count_result = session.run("""
                MATCH (o:Object {id: $object_id})-[:RELATES_TO]->(other:Object)
                RETURN count(other) as rel_count
            """, object_id=new_id).single()
            
            rel_count = rel_count_result["rel_count"] if rel_count_result else 0
            
            # Update the object's relationship count in the database
            session.run("""
                MATCH (o:Object {id: $object_id})
                SET o.relationships = $rel_count
            """, object_id=new_id, rel_count=rel_count)
            
            return {
                "id": new_id,
                "driver": driver_string,
                "being": object_data.being,
                "avatar": object_data.avatar,
                "object": object_data.object,
                "status": getattr(object_data, 'status', 'Active'),
                "relationships": rel_count,
                "variants": len(variants),
                "variables": 0,
                "relationshipsList": relationships,
                "variantsList": [{"id": str(uuid.uuid4()), "name": v} for v in variants]
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating object in Neo4j: {e}")
        raise HTTPException(status_code=500, detail="Failed to create object")

@router.put("/objects/{object_id}/test", response_model=Dict[str, Any])
async def test_update_object(
    object_id: str, 
    relationships: Optional[str] = Form(None),
    variants: Optional[str] = Form(None)
):
    """Test endpoint for relationships and variants bulk update"""
    return {"message": "Test endpoint working", "relationships": relationships, "variants": variants}

@router.put("/objects/{object_id}", response_model=Dict[str, Any])
async def update_object(
    object_id: str, 
    request_data: Optional[Dict[str, Any]] = Body(None)
):
    """
    Update an existing object.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Check if object exists
            existing = session.run("MATCH (o:Object {id: $object_id}) RETURN o", object_id=object_id).single()
            if not existing:
                raise HTTPException(status_code=404, detail="Object not found")

            # Handle relationships and variants bulk update
            print(f"DEBUG: request_data={request_data}")
            has_relationships = request_data and 'relationships' in request_data
            has_variants = request_data and 'variants' in request_data
            print(f"DEBUG: has_relationships={has_relationships}, has_variants={has_variants}")
            if has_relationships or has_variants:
                # Get from request_data
                parsed_relationships = request_data.get('relationships', []) if request_data else []
                parsed_variants = request_data.get('variants', []) if request_data else []
                
                # Clear existing relationships and variants
                session.run("""
                    MATCH (o:Object {id: $object_id})-[r:RELATES_TO]->(other:Object)
                    DELETE r
                """, object_id=object_id)
                
                session.run("""
                    MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
                    DETACH DELETE v
                """, object_id=object_id)
                
                # Create new relationships
                if parsed_relationships:
                    for rel in parsed_relationships:
                        # Find the target object
                        target_result = session.run("""
                            MATCH (target:Object)
                            WHERE (target.being = $to_being OR $to_being = "ALL")
                              AND (target.avatar = $to_avatar OR $to_avatar = "ALL")
                              AND (target.object = $to_object OR $to_object = "ALL")
                            RETURN target.id as target_id
                            LIMIT 1
                        """, to_being=rel.get("toBeing", "ALL"), 
                            to_avatar=rel.get("toAvatar", "ALL"), 
                            to_object=rel.get("toObject", "ALL")).single()
                        
                        if target_result:
                            target_id = target_result["target_id"]
                            session.run("""
                                MATCH (source:Object {id: $source_id})
                                MATCH (target:Object {id: $target_id})
                                CREATE (source)-[:RELATES_TO {
                                    type: $relationship_type,
                                    role: $role,
                                    toBeing: $to_being,
                                    toAvatar: $to_avatar,
                                    toObject: $to_object
                                }]->(target)
                            """, source_id=object_id, target_id=target_id,
                                relationship_type=rel.get("type", "Inter-Table"),
                                role=rel.get("role", ""),
                                to_being=rel.get("toBeing", "ALL"),
                                to_avatar=rel.get("toAvatar", "ALL"),
                                to_object=rel.get("toObject", "ALL"))
                
                # Create new variants
                if parsed_variants:
                    for var in parsed_variants:
                        variant_id = str(uuid.uuid4())
                        session.run("""
                            CREATE (v:Variant {
                                id: $variant_id,
                                name: $variant_name
                            })
                        """, variant_id=variant_id, variant_name=var.get("name", ""))
                        
                        session.run("""
                            MATCH (o:Object {id: $object_id})
                            MATCH (v:Variant {id: $variant_id})
                            CREATE (o)-[:HAS_VARIANT]->(v)
                        """, object_id=object_id, variant_id=variant_id)
                
                # Update counts
                session.run("""
                    MATCH (o:Object {id: $object_id})
                    SET o.relationships = COUNT { (o)-[:RELATES_TO]->(:Object) },
                        o.variants = COUNT { (o)-[:HAS_VARIANT]->(:Variant) }
                """, object_id=object_id)
                
                return {"message": "Object relationships and variants updated successfully"}
            
            else:
                # If no relationships or variants provided, just clear them
                session.run("""
                    MATCH (o:Object {id: $object_id})-[r:RELATES_TO]->(other:Object)
                    DELETE r
                """, object_id=object_id)
                
                session.run("""
                    MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
                    DETACH DELETE v
                """, object_id=object_id)
                
                # Update counts
                session.run("""
                    MATCH (o:Object {id: $object_id})
                    SET o.relationships = COUNT { (o)-[:RELATES_TO]->(:Object) },
                        o.variants = COUNT { (o)-[:HAS_VARIANT]->(:Variant) }
                """, object_id=object_id)
                
                return {"message": "Object relationships and variants cleared successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating object in Neo4j: {e}")
        raise HTTPException(status_code=500, detail="Failed to update object")

@router.post("/objects/cleanup-relationships")
async def cleanup_old_relationships():
    """Clean up old Relationship nodes and convert them to RELATES_TO edges"""
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j.")
    
    try:
        with driver.session() as session:
            # Get all old Relationship nodes and their connections
            old_relationships = session.run("""
                MATCH (o:Object)-[:HAS_RELATIONSHIP]->(r:Relationship)
                RETURN o.id as source_id, r.type as type, r.role as role,
                       r.toBeing as toBeing, r.toAvatar as toAvatar, r.toObject as toObject
            """).data()
            
            print(f"Found {len(old_relationships)} old relationship nodes to convert")
            
            # Convert each old relationship to a RELATES_TO edge
            for rel in old_relationships:
                # Find the target object
                target_result = session.run("""
                    MATCH (target:Object)
                    WHERE (target.being = $toBeing OR $toBeing = "ALL")
                      AND (target.avatar = $toAvatar OR $toAvatar = "ALL")
                      AND (target.object = $toObject OR $toObject = "ALL")
                    RETURN target.id as target_id
                    LIMIT 1
                """, toBeing=rel["toBeing"], toAvatar=rel["toAvatar"], toObject=rel["toObject"]).single()
                
                if target_result:
                    # Create the new RELATES_TO relationship
                    session.run("""
                        MATCH (source:Object {id: $source_id})
                        MATCH (target:Object {id: $target_id})
                        CREATE (source)-[:RELATES_TO {
                            type: $type,
                            role: $role,
                            toBeing: $toBeing,
                            toAvatar: $toAvatar,
                            toObject: $toObject
                        }]->(target)
                    """, source_id=rel["source_id"], target_id=target_result["target_id"],
                        type=rel["type"], role=rel["role"],
                        toBeing=rel["toBeing"], toAvatar=rel["toAvatar"], toObject=rel["toObject"])
            
            # Delete all old Relationship nodes
            session.run("""
                MATCH (r:Relationship)
                DETACH DELETE r
            """)
            
            # Update all object relationship counts
            session.run("""
                MATCH (o:Object)
                SET o.relationships = COUNT { (o)-[:RELATES_TO]->(:Object) }
            """)
            
            return {"message": f"Converted {len(old_relationships)} old relationships to RELATES_TO edges"}
    except Exception as e:
        print(f"Error cleaning up relationships: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cleanup relationships: {e}")

@router.delete("/objects/{object_id}")
async def delete_object(object_id: str):
    """
    Delete an object and its variants, but preserve drivers and other entities.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Check if object exists
            existing = session.run("MATCH (o:Object {id: $object_id}) RETURN o", object_id=object_id).single()
            if not existing:
                raise HTTPException(status_code=404, detail="Object not found")

            # Delete object and its variants, but preserve relationships to drivers
            session.run("""
                MATCH (o:Object {id: $object_id})
                OPTIONAL MATCH (o)-[:HAS_VARIANT]->(v:Variant)
                OPTIONAL MATCH (o)-[r:RELATES_TO]->(other:Object)
                DELETE r
                DETACH DELETE v, o
            """, object_id=object_id)

            return {"message": f"Object {object_id} deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting object in Neo4j: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete object")

@router.post("/objects/upload", response_model=CSVUploadResponse)
async def upload_objects_csv(file: UploadFile = File(...)):
    """
    Upload objects from CSV file.
    CSV must have columns: Sector, Domain, Country, Object Clarifier, Being, Avatar, Object
    """
    print(f"DEBUG: CSV upload request received. File: {file.filename}, Content-Type: {file.content_type}")

    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        # Read CSV content
        content = await file.read()
        csv_content = content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(csv_content))

        # Validate required columns - support both formats
        required_columns = ['Sector', 'Domain', 'Country', 'Object Clarifier', 'Being', 'Avatar', 'Object']
        print(f"DEBUG: CSV fieldnames: {csv_reader.fieldnames}")

        if not csv_reader.fieldnames:
            raise HTTPException(
                status_code=400,
                detail="CSV file appears to be empty or has no headers"
            )

        # Check if all required columns are present
        missing_columns = [col for col in required_columns if col not in csv_reader.fieldnames]
        if missing_columns:
            print(f"DEBUG: Missing columns: {missing_columns}")
            raise HTTPException(
                status_code=400,
                detail=f"CSV must contain columns: {', '.join(required_columns)}. Missing: {', '.join(missing_columns)}"
            )

        created_objects = []
        errors = []

        with driver.session() as session:
            for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 because of header
                try:
                    # Validate row data using Pydantic schema
                    try:
                        csv_row = CSVRowData(**row)
                    except Exception as validation_error:
                        errors.append(f"Row {row_num}: Validation error - {str(validation_error)}")
                        continue

                    # Parse driver selections
                    sector = [s.strip() for s in csv_row.Sector.split(',') if s.strip()]
                    domain = [d.strip() for d in csv_row.Domain.split(',') if d.strip()]
                    country = [c.strip() for c in csv_row.Country.split(',') if c.strip()]
                    object_clarifier = csv_row.ObjectClarifier.strip() if csv_row.ObjectClarifier and csv_row.ObjectClarifier.strip() else None

                    # Validate driver values exist in database
                    for sector_name in sector:
                        if sector_name != "ALL":
                            exists = session.run("MATCH (s:Sector {name: $name}) RETURN s", name=sector_name).single()
                            if not exists:
                                errors.append(f"Row {row_num}: Sector '{sector_name}' not found in drivers")
                                continue

                    for domain_name in domain:
                        if domain_name != "ALL":
                            exists = session.run("MATCH (d:Domain {name: $name}) RETURN d", name=domain_name).single()
                            if not exists:
                                errors.append(f"Row {row_num}: Domain '{domain_name}' not found in drivers")
                                continue

                    for country_name in country:
                        if country_name != "ALL":
                            exists = session.run("MATCH (c:Country {name: $name}) RETURN c", name=country_name).single()
                            if not exists:
                                errors.append(f"Row {row_num}: Country '{country_name}' not found in drivers")
                                continue

                    if object_clarifier and object_clarifier != "None":
                        exists = session.run("MATCH (oc:ObjectClarifier {name: $name}) RETURN oc", name=object_clarifier).single()
                        if not exists:
                            errors.append(f"Row {row_num}: Object Clarifier '{object_clarifier}' not found in drivers")
                            continue

                    # Check for duplicate objects
                    existing = session.run("""
                        MATCH (o:Object {being: $being, avatar: $avatar, object: $object})
                        RETURN o.id as id
                    """, being=csv_row.Being, avatar=csv_row.Avatar, object=csv_row.Object).single()

                    if existing:
                        errors.append(f"Row {row_num}: Object with Being='{csv_row.Being}', Avatar='{csv_row.Avatar}', Object='{csv_row.Object}' already exists")
                        continue

                    # Create object
                    new_id = str(uuid.uuid4())

                    # Concatenate driver string
                    sector_str = "ALL" if "ALL" in sector else ", ".join(sector)
                    domain_str = "ALL" if "ALL" in domain else ", ".join(domain)
                    country_str = "ALL" if "ALL" in country else ", ".join(country)
                    clarifier_str = object_clarifier or "None"
                    driver_string = f"{sector_str}, {domain_str}, {country_str}, {clarifier_str}"

                    # Create the Object node
                    session.run("""
                        CREATE (o:Object {
                            id: $id,
                            name: $object,
                            driver: $driver,
                            being: $being,
                            avatar: $avatar,
                            object: $object,
                            status: $status
                        })
                    """, 
                    id=new_id,
                    object=csv_row.Object,
                    driver=driver_string,
                    being=csv_row.Being,
                    avatar=csv_row.Avatar,
                    status="Active")

                    # Create taxonomy relationships
                    session.run("""
                        MERGE (b:Being {name: $being})
                        MERGE (a:Avatar {name: $avatar})
                        MERGE (o:Object {id: $object_id})
                        MERGE (b)-[:HAS_AVATAR]->(a)
                        MERGE (a)-[:HAS_OBJECT]->(o)
                    """, being=csv_row.Being, avatar=csv_row.Avatar, object_id=new_id)

                    # Create driver relationships
                    if "ALL" not in sector:
                        for sector_name in sector:
                            session.run("""
                                MATCH (s:Sector {name: $sector})
                                MATCH (o:Object {id: $object_id})
                                WITH s, o
                                CREATE (s)-[:RELEVANT_TO]->(o)
                            """, sector=sector_name, object_id=new_id)

                    if "ALL" not in domain:
                        for domain_name in domain:
                            session.run("""
                                MATCH (d:Domain {name: $domain})
                                MATCH (o:Object {id: $object_id})
                                WITH d, o
                                CREATE (d)-[:RELEVANT_TO]->(o)
                            """, domain=domain_name, object_id=new_id)

                    if "ALL" not in country:
                        for country_name in country:
                            session.run("""
                                MATCH (c:Country {name: $country})
                                MATCH (o:Object {id: $object_id})
                                WITH c, o
                                CREATE (c)-[:RELEVANT_TO]->(o)
                            """, country=country_name, object_id=new_id)

                    if object_clarifier and object_clarifier != "None":
                        session.run("""
                            MATCH (oc:ObjectClarifier {name: $clarifier})
                            MATCH (o:Object {id: $object_id})
                            WITH oc, o
                            CREATE (oc)-[:RELEVANT_TO]->(o)
                        """, clarifier=object_clarifier, object_id=new_id)

                    print(f"DEBUG: Successfully created object {new_id}")
                    # Get relationships for the newly created object
                    relationships_result = session.run("""
                        MATCH (o:Object {id: $object_id})-[r:RELATES_TO]->(other:Object)
                        RETURN r.type as type, r.role as role,
                               other.being as toBeing, other.avatar as toAvatar, other.object as toObject
                    """, object_id=new_id)

                    relationships = []
                    for rel_record in relationships_result:
                        relationships.append({
                            "id": str(uuid.uuid4()),
                            "type": rel_record["type"],
                            "role": rel_record["role"],
                            "toBeing": rel_record["toBeing"],
                            "toAvatar": rel_record["toAvatar"],
                            "toObject": rel_record["toObject"]
                        })

                    # Get variants for the newly created object
                    variants_result = session.run("""
                        MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
                        RETURN v.name as name
                    """, object_id=new_id)

                    variants = []
                    for var_record in variants_result:
                        variants.append({
                            "id": str(uuid.uuid4()),
                            "name": var_record["name"]
                        })

                    created_objects.append({
                        "id": new_id,
                        "driver": driver_string,
                        "being": csv_row.Being,
                        "avatar": csv_row.Avatar,
                        "object": csv_row.Object,
                        "status": "Active",
                        "relationships": len(relationships),
                        "variants": len(variants),
                        "variables": 0,
                        "relationshipsList": relationships,
                        "variantsList": variants
                    })

                except Exception as e:
                    errors.append(f"Row {row_num}: {str(e)}")

        print(f"DEBUG: CSV upload completed. Created {len(created_objects)} objects.")
        print(f"DEBUG: Created objects: {created_objects}")
        print(f"DEBUG: Errors: {errors}")
        
        return {
            "message": f"CSV upload completed. Created {len(created_objects)} objects.",
            "created_objects": created_objects,
            "errors": errors
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing CSV upload: {e}")
        raise HTTPException(status_code=500, detail="Failed to process CSV upload")

@router.get("/objects/taxonomy/beings", response_model=List[str])
async def get_beings():
    """Get all available Beings for dropdowns"""
    driver = get_driver()
    if not driver:
        return ["Master", "Mate", "Process", "Adjunct", "Rule", "Roster"]
    
    try:
        with driver.session() as session:
            result = session.run("MATCH (b:Being) RETURN b.name as name ORDER BY name")
            return [record["name"] for record in result]
    except Exception as e:
        print(f"Error fetching beings: {e}")
        return ["Master", "Mate", "Process", "Adjunct", "Rule", "Roster"]

@router.get("/objects/taxonomy/avatars", response_model=List[str])
async def get_avatars(being: Optional[str] = None):
    """Get all available Avatars for dropdowns, optionally filtered by Being"""
    driver = get_driver()
    if not driver:
        return ["Company", "Company Affiliate", "Employee", "Product", "Customer", "Supplier"]
    
    try:
        with driver.session() as session:
            if being:
                result = session.run("""
                    MATCH (b:Being {name: $being})-[:HAS_AVATAR]->(a:Avatar)
                    RETURN a.name as name ORDER BY name
                """, being=being)
            else:
                result = session.run("MATCH (a:Avatar) RETURN a.name as name ORDER BY name")
            return [record["name"] for record in result]
    except Exception as e:
        print(f"Error fetching avatars: {e}")
        return ["Company", "Company Affiliate", "Employee", "Product", "Customer", "Supplier"]

@router.get("/objects/taxonomy/objects", response_model=List[str])
async def get_objects_by_taxonomy(being: Optional[str] = None, avatar: Optional[str] = None):
    """Get all available Objects for dropdowns, optionally filtered by Being and Avatar"""
    driver = get_driver()
    if not driver:
        return []
    
    try:
        with driver.session() as session:
            if being and avatar:
                result = session.run("""
                    MATCH (b:Being {name: $being})-[:HAS_AVATAR]->(a:Avatar {name: $avatar})-[:HAS_OBJECT]->(o:Object)
                    RETURN o.object as name ORDER BY name
                """, being=being, avatar=avatar)
            elif being:
                result = session.run("""
                    MATCH (b:Being {name: $being})-[:HAS_AVATAR]->(a:Avatar)-[:HAS_OBJECT]->(o:Object)
                    RETURN o.object as name ORDER BY name
                """, being=being)
            else:
                result = session.run("MATCH (o:Object) RETURN o.object as name ORDER BY name")
            return [record["name"] for record in result]
    except Exception as e:
        print(f"Error fetching objects: {e}")
        return []

# Relationship Management Endpoints
@router.post("/objects/{object_id}/relationships", response_model=Dict[str, Any])
async def create_relationship(
    object_id: str,
    relationship_type: str = Form(...),
    role: str = Form(...),
    to_being: str = Form(...),
    to_avatar: str = Form(...),
    to_object: str = Form(...)
):
    """Create a new relationship for an object"""
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j.")
    
    try:
        with driver.session() as session:
            # Find the target object based on to_being, to_avatar, to_object
            target_result = session.run("""
                MATCH (target:Object)
                WHERE (target.being = $to_being OR $to_being = "ALL")
                  AND (target.avatar = $to_avatar OR $to_avatar = "ALL")
                  AND (target.object = $to_object OR $to_object = "ALL")
                RETURN target.id as target_id
                LIMIT 1
            """, to_being=to_being, to_avatar=to_avatar, to_object=to_object).single()
            
            if not target_result:
                raise HTTPException(status_code=404, detail="Target object not found")
            
            target_id = target_result["target_id"]
            
            # Create direct RELATES_TO relationship between objects
            print(f"DEBUG: Creating direct RELATES_TO relationship from {object_id} to {target_id}")
            session.run("""
                MATCH (source:Object {id: $source_id})
                MATCH (target:Object {id: $target_id})
                CREATE (source)-[:RELATES_TO {
                    type: $relationship_type,
                    role: $role,
                    toBeing: $to_being,
                    toAvatar: $to_avatar,
                    toObject: $to_object
                }]->(target)
            """, source_id=object_id, target_id=target_id, relationship_type=relationship_type,
                role=role, to_being=to_being, to_avatar=to_avatar, to_object=to_object)
            
            # Update relationship count
            count_result = session.run("""
                MATCH (o:Object {id: $object_id})-[:RELATES_TO]->(other:Object)
                RETURN count(other) as rel_count
            """, object_id=object_id).single()
            
            rel_count = count_result["rel_count"] if count_result else 0
            
            session.run("""
                MATCH (o:Object {id: $object_id})
                SET o.relationships = $rel_count
            """, object_id=object_id, rel_count=rel_count)
            
            return {
                "id": str(uuid.uuid4()),  # Generate a new ID for the response
                "type": relationship_type,
                "role": role,
                "toBeing": to_being,
                "toAvatar": to_avatar,
                "toObject": to_object
            }
    except Exception as e:
        print(f"Error creating relationship: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create relationship: {e}")

@router.delete("/objects/{object_id}/relationships/{relationship_id}")
async def delete_relationship(object_id: str, relationship_id: str):
    """Delete a relationship from an object"""
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j.")
    
    try:
        with driver.session() as session:
            # Delete the RELATES_TO relationship
            session.run("""
                MATCH (o:Object {id: $object_id})-[r:RELATES_TO]->(other:Object)
                WHERE r.role = $relationship_id OR r.type = $relationship_id
                DELETE r
            """, object_id=object_id, relationship_id=relationship_id)
            
            # Update relationship count
            count_result = session.run("""
                MATCH (o:Object {id: $object_id})-[:RELATES_TO]->(other:Object)
                RETURN count(other) as rel_count
            """, object_id=object_id).single()
            
            rel_count = count_result["rel_count"] if count_result else 0
            
            session.run("""
                MATCH (o:Object {id: $object_id})
                SET o.relationships = $rel_count
            """, object_id=object_id, rel_count=rel_count)
            
            return {"message": "Relationship deleted successfully"}
    except Exception as e:
        print(f"Error deleting relationship: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete relationship: {e}")

# Variant Management Endpoints
@router.post("/objects/{object_id}/variants", response_model=Dict[str, Any])
async def create_variant(object_id: str, variant_name: str = Form(...)):
    """Create a new variant for an object"""
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j.")
    
    try:
        with driver.session() as session:
            # Create the variant
            variant_id = str(uuid.uuid4())
            
            # Create variant node
            session.run("""
                CREATE (v:Variant {
                    id: $variant_id,
                    name: $variant_name
                })
            """, variant_id=variant_id, variant_name=variant_name)
            
            # Connect variant to object
            session.run("""
                MATCH (o:Object {id: $object_id})
                MATCH (v:Variant {id: $variant_id})
                CREATE (o)-[:HAS_VARIANT]->(v)
            """, object_id=object_id, variant_id=variant_id)
            
            # Update variant count
            count_result = session.run("""
                MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
                RETURN count(v) as var_count
            """, object_id=object_id).single()
            
            var_count = count_result["var_count"] if count_result else 0
            
            session.run("""
                MATCH (o:Object {id: $object_id})
                SET o.variants = $var_count
            """, object_id=object_id, var_count=var_count)
            
            return {
                "id": variant_id,
                "name": variant_name
            }
    except Exception as e:
        print(f"Error creating variant: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create variant: {e}")

@router.delete("/objects/{object_id}/variants/{variant_id}")
async def delete_variant(object_id: str, variant_id: str):
    """Delete a variant from an object"""
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j.")
    
    try:
        with driver.session() as session:
            # Delete the variant
            session.run("""
                MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant {id: $variant_id})
                DETACH DELETE v
            """, object_id=object_id, variant_id=variant_id)
            
            # Update variant count
            count_result = session.run("""
                MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
                RETURN count(v) as var_count
            """, object_id=object_id).single()
            
            var_count = count_result["var_count"] if count_result else 0
            
            session.run("""
                MATCH (o:Object {id: $object_id})
                SET o.variants = $var_count
            """, object_id=object_id, var_count=var_count)
            
            return {"message": "Variant deleted successfully"}
    except Exception as e:
        print(f"Error deleting variant: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete variant: {e}")

