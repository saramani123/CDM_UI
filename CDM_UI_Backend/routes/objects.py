from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Body
from typing import List, Dict, Any, Optional
import uuid
import csv
import io
import json
from pydantic import BaseModel
from db import get_driver
from schema import ObjectCreateRequest, ObjectResponse, CSVUploadResponse, CSVRowData

# Pydantic models for JSON body parameters
class RelationshipCreateRequest(BaseModel):
    relationship_type: str
    role: str
    to_being: str
    to_avatar: str
    to_object: str

class VariantCreateRequest(BaseModel):
    variant_name: str

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
                    RETURN r.id as id, r.type as type, r.role as role,
                           other.being as toBeing, other.avatar as toAvatar, other.object as toObject
                """, object_id=obj["id"])

                relationships = []
                for rel_record in relationships_result:
                    relationships.append({
                        "id": rel_record["id"] or str(uuid.uuid4()),  # Use existing ID or generate new one
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
                RETURN r.id as id, r.type as type, r.role as role,
                       other.being as toBeing, other.avatar as toAvatar, other.object as toObject
            """, object_id=object_id)

            relationships = []
            for rel_record in relationships_result:
                relationships.append({
                    "id": rel_record["id"] or str(uuid.uuid4()),  # Use existing ID or generate new one
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
            
            # Check for duplicate objects (same being, avatar, object, AND driver combination)
            existing = session.run("""
                MATCH (o:Object {being: $being, avatar: $avatar, object: $object, driver: $driver})
                RETURN o.id as id
            """, being=object_data.being, avatar=object_data.avatar, object=object_data.object, driver=driver_string)
            
            if existing.single():
                raise HTTPException(status_code=409, detail="Object with this Being/Avatar/Object/Driver combination already exists")
            
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
            if "ALL" in object_data.sector:
                # Create relationships to ALL existing sectors
                session.run("""
                    MATCH (s:Sector)
                    MATCH (o:Object {id: $object_id})
                    WITH s, o
                    CREATE (s)-[:RELEVANT_TO]->(o)
                """, object_id=new_id)
            else:
                # Create relationships to selected sectors only
                for sector in object_data.sector:
                    session.run("""
                        MATCH (s:Sector {name: $sector})
                        MATCH (o:Object {id: $object_id})
                        WITH s, o
                        CREATE (s)-[:RELEVANT_TO]->(o)
                    """, sector=sector, object_id=new_id)
            
            # Domain relationships
            if "ALL" in object_data.domain:
                # Create relationships to ALL existing domains
                session.run("""
                    MATCH (d:Domain)
                    MATCH (o:Object {id: $object_id})
                    WITH d, o
                    CREATE (d)-[:RELEVANT_TO]->(o)
                """, object_id=new_id)
            else:
                # Create relationships to selected domains only
                for domain in object_data.domain:
                    session.run("""
                        MATCH (d:Domain {name: $domain})
                        MATCH (o:Object {id: $object_id})
                        WITH d, o
                        CREATE (d)-[:RELEVANT_TO]->(o)
                    """, domain=domain, object_id=new_id)
            
            # Country relationships
            if "ALL" in object_data.country:
                # Create relationships to ALL existing countries
                session.run("""
                    MATCH (c:Country)
                    MATCH (o:Object {id: $object_id})
                    WITH c, o
                    CREATE (c)-[:RELEVANT_TO]->(o)
                """, object_id=new_id)
            else:
                # Create relationships to selected countries only
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
                    # Find ALL target objects that match the criteria
                    to_being = rel.get("toBeing", "ALL")
                    to_avatar = rel.get("toAvatar", "ALL")
                    to_object = rel.get("toObject", "ALL")
                    
                    # Build the query dynamically based on the criteria
                    where_conditions = []
                    params = {}
                    
                    if to_being != "ALL":
                        where_conditions.append("target.being = $to_being")
                        params["to_being"] = to_being
                    
                    if to_avatar != "ALL":
                        where_conditions.append("target.avatar = $to_avatar")
                        params["to_avatar"] = to_avatar
                    
                    if to_object != "ALL":
                        where_conditions.append("target.object = $to_object")
                        params["to_object"] = to_object
                    
                    where_clause = " AND ".join(where_conditions) if where_conditions else "true"
                    
                    query = f"""
                        MATCH (target:Object)
                        WHERE {where_clause}
                        RETURN target.id as target_id, target.being as being, target.avatar as avatar, target.object as object
                    """
                    
                    target_results = session.run(query, **params).data()
                    
                    print(f"DEBUG: Found {len(target_results)} matching objects for relationship:")
                    print(f"  toBeing: {rel.get('toBeing', 'ALL')}, toAvatar: {rel.get('toAvatar', 'ALL')}, toObject: {rel.get('toObject', 'ALL')}")
                    for result in target_results:
                        print(f"  - {result['being']}, {result['avatar']}, {result['object']} (ID: {result['target_id']})")
                    
                    # Create relationships to ALL matching objects
                    for target_result in target_results:
                        target_id = target_result["target_id"]
                        # Generate unique relationship ID
                        relationship_id = str(uuid.uuid4())
                        session.run("""
                            MATCH (source:Object {id: $source_id})
                            MATCH (target:Object {id: $target_id})
                            CREATE (source)-[:RELATES_TO {
                                id: $relationship_id,
                                type: $relationship_type,
                                role: $role,
                                toBeing: $to_being,
                                toAvatar: $to_avatar,
                                toObject: $to_object
                            }]->(target)
                        """, source_id=new_id, target_id=target_id, relationship_id=relationship_id,
                            relationship_type=rel.get("type", "Inter-Table"),
                            role=rel.get("role", ""),
                            to_being=rel.get("toBeing", "ALL"),
                            to_avatar=rel.get("toAvatar", "ALL"),
                            to_object=rel.get("toObject", "ALL"))
            
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

            # Handle driver updates
            has_driver = request_data and 'driver' in request_data
            if has_driver:
                print(f"DEBUG: Processing driver update")
                driver_string = request_data.get('driver', '')
                
                # Update the driver string on the object
                session.run("""
                    MATCH (o:Object {id: $object_id})
                    SET o.driver = $driver
                """, object_id=object_id, driver=driver_string)
                
                # Clear existing driver relationships
                session.run("""
                    MATCH (o:Object {id: $object_id})<-[r:RELEVANT_TO]-(d)
                    WHERE d:Sector OR d:Domain OR d:Country OR d:ObjectClarifier
                    DELETE r
                """, object_id=object_id)
                
                # Parse driver string to recreate relationships
                parts = driver_string.split(', ')
                print(f"DEBUG: Driver string parts: {parts} (length: {len(parts)})")
                
                if len(parts) >= 4:
                    # Handle cases where we have more than 4 parts (multiple sectors/domains)
                    if len(parts) == 4:
                        # Normal case: exactly 4 parts
                        sector_str = parts[0].strip()
                        domain_str = parts[1].strip()
                        country_str = parts[2].strip()
                        clarifier_str = parts[3].strip()
                    else:
                        # Complex case: one of the first parts contains commas
                        # The last part is always the object clarifier
                        clarifier_str = parts[-1].strip()
                        
                        # The second to last part is always the country
                        country_str = parts[-2].strip()
                        
                        # The third to last part is always the domain
                        domain_str = parts[-3].strip()
                        
                        # Everything before that is the sector
                        sector_str = ', '.join(parts[:-3]).strip()
                    
                    print(f"DEBUG: Parsed - Sector: '{sector_str}', Domain: '{domain_str}', Country: '{country_str}', Clarifier: '{clarifier_str}'")
                    
                    # Create new driver relationships
                    # Sector relationships
                    if sector_str == "ALL":
                        # Create relationships to ALL existing sectors
                        session.run("""
                            MATCH (s:Sector)
                            MATCH (o:Object {id: $object_id})
                            WITH s, o
                            CREATE (s)-[:RELEVANT_TO]->(o)
                        """, object_id=object_id)
                    else:
                        # Create relationships to selected sectors only
                        sectors = [s.strip() for s in sector_str.split(',')]
                        print(f"DEBUG: Creating relationships to sectors: {sectors}")
                        for sector in sectors:
                            if sector:  # Skip empty strings
                                result = session.run("""
                                    MATCH (s:Sector {name: $sector})
                                    MATCH (o:Object {id: $object_id})
                                    WITH s, o
                                    CREATE (s)-[:RELEVANT_TO]->(o)
                                    RETURN s.name as name
                                """, sector=sector, object_id=object_id)
                                created = result.single()
                                print(f"DEBUG: Created relationship to sector: {created['name'] if created else 'NOT FOUND'}")
                    
                    # Domain relationships
                    if domain_str == "ALL":
                        # Create relationships to ALL existing domains
                        session.run("""
                            MATCH (d:Domain)
                            MATCH (o:Object {id: $object_id})
                            WITH d, o
                            CREATE (d)-[:RELEVANT_TO]->(o)
                        """, object_id=object_id)
                    else:
                        # Create relationships to selected domains only
                        domains = [d.strip() for d in domain_str.split(',')]
                        print(f"DEBUG: Creating relationships to domains: {domains}")
                        for domain in domains:
                            if domain:  # Skip empty strings
                                result = session.run("""
                                    MATCH (d:Domain {name: $domain})
                                    MATCH (o:Object {id: $object_id})
                                    WITH d, o
                                    CREATE (d)-[:RELEVANT_TO]->(o)
                                    RETURN d.name as name
                                """, domain=domain, object_id=object_id)
                                created = result.single()
                                print(f"DEBUG: Created relationship to domain: {created['name'] if created else 'NOT FOUND'}")
                    
                    # Country relationships
                    if country_str == "ALL":
                        # Create relationships to ALL existing countries
                        session.run("""
                            MATCH (c:Country)
                            MATCH (o:Object {id: $object_id})
                            WITH c, o
                            CREATE (c)-[:RELEVANT_TO]->(o)
                        """, object_id=object_id)
                    else:
                        # Create relationships to selected countries only
                        countries = [c.strip() for c in country_str.split(',')]
                        for country in countries:
                            session.run("""
                                MATCH (c:Country {name: $country})
                                MATCH (o:Object {id: $object_id})
                                WITH c, o
                                CREATE (c)-[:RELEVANT_TO]->(o)
                            """, country=country, object_id=object_id)
                    
                    # Object Clarifier relationship
                    if clarifier_str and clarifier_str != "None":
                        session.run("""
                            MATCH (oc:ObjectClarifier {name: $clarifier})
                            MATCH (o:Object {id: $object_id})
                            WITH oc, o
                            CREATE (oc)-[:RELEVANT_TO]->(o)
                        """, clarifier=clarifier_str, object_id=object_id)
                
                # Don't return here - continue to process basic field updates

            # Handle basic field updates (being, avatar, object, etc.)
            if request_data:
                print(f"DEBUG: Processing basic field updates: {request_data}")
                print(f"DEBUG: Being field: {request_data.get('being', 'NOT_FOUND')}")
                print(f"DEBUG: Avatar field: {request_data.get('avatar', 'NOT_FOUND')}")
                print(f"DEBUG: Object field: {request_data.get('object', 'NOT_FOUND')}")
                print(f"DEBUG: ObjectName field: {request_data.get('objectName', 'NOT_FOUND')}")
                
                # Build dynamic SET clause for basic fields
                set_clauses = []
                params = {"object_id": object_id}
                
                if 'being' in request_data and request_data['being']:
                    set_clauses.append("o.being = $being")
                    params["being"] = request_data['being']
                
                if 'avatar' in request_data and request_data['avatar']:
                    set_clauses.append("o.avatar = $avatar")
                    params["avatar"] = request_data['avatar']
                
                if 'object' in request_data and request_data['object']:
                    set_clauses.append("o.object = $object")
                    params["object"] = request_data['object']
                elif 'objectName' in request_data and request_data['objectName']:
                    set_clauses.append("o.object = $objectName")
                    params["objectName"] = request_data['objectName']
                
                if 'discreteId' in request_data and request_data['discreteId']:
                    set_clauses.append("o.discreteId = $discreteId")
                    params["discreteId"] = request_data['discreteId']
                
                # Update basic fields if any
                if set_clauses:
                    update_query = f"""
                        MATCH (o:Object {{id: $object_id}})
                        SET {', '.join(set_clauses)}
                    """
                    print(f"DEBUG: Executing update query: {update_query}")
                    print(f"DEBUG: With parameters: {params}")
                    session.run(update_query, params)
                    print(f"DEBUG: Updated basic fields: {set_clauses}")
                    
                    # Verify the update was successful
                    verify_result = session.run("""
                        MATCH (o:Object {id: $object_id})
                        RETURN o.being as being, o.avatar as avatar, o.object as object
                    """, object_id=object_id).single()
                    
                    if verify_result:
                        print(f"DEBUG: Verification - Being: {verify_result['being']}, Avatar: {verify_result['avatar']}, Object: {verify_result['object']}")
                    else:
                        print("DEBUG: Verification failed - object not found")

            # Handle relationships and variants bulk update
            print(f"DEBUG: request_data={request_data}")
            has_relationships = request_data and 'relationships' in request_data and request_data['relationships']
            has_variants = request_data and 'variants' in request_data and request_data['variants']
            print(f"DEBUG: has_relationships={has_relationships}, has_variants={has_variants}")
            
            # Only process relationships/variants if they are explicitly provided
            if has_relationships or has_variants:
                print(f"DEBUG: Processing relationships and variants update")
                # Get from request_data
                parsed_relationships = request_data.get('relationships', []) if request_data else []
                parsed_variants = request_data.get('variants', []) if request_data else []
                
                # First, deduplicate relationships in the request data
                unique_relationships = []
                seen_relationships = set()
                
                if parsed_relationships:
                    for rel in parsed_relationships:
                        # Create a unique key for this relationship
                        rel_key = (
                            rel.get("role", ""),
                            rel.get("toBeing", "ALL"),
                            rel.get("toAvatar", "ALL"),
                            rel.get("toObject", "ALL"),
                            rel.get("type", "Inter-Table")
                        )
                        
                        if rel_key not in seen_relationships:
                            seen_relationships.add(rel_key)
                            unique_relationships.append(rel)
                        else:
                            print(f"DEBUG: Skipping duplicate relationship: {rel}")
                
                print(f"DEBUG: Original relationships: {len(parsed_relationships)}, Unique relationships: {len(unique_relationships)}")
                
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
                if unique_relationships:
                    print(f"DEBUG: Processing {len(unique_relationships)} unique relationships")
                    for i, rel in enumerate(unique_relationships):
                        print(f"DEBUG: Processing relationship {i+1}: {rel}")
                        # Find ALL target objects that match the criteria
                        to_being = rel.get("toBeing", "ALL")
                        to_avatar = rel.get("toAvatar", "ALL")
                        to_object = rel.get("toObject", "ALL")
                        
                        # Build the query dynamically based on the criteria
                        where_conditions = []
                        params = {}
                        
                        if to_being != "ALL":
                            where_conditions.append("target.being = $to_being")
                            params["to_being"] = to_being
                        
                        if to_avatar != "ALL":
                            where_conditions.append("target.avatar = $to_avatar")
                            params["to_avatar"] = to_avatar
                        
                        if to_object != "ALL":
                            where_conditions.append("target.object = $to_object")
                            params["to_object"] = to_object
                        
                        where_clause = " AND ".join(where_conditions) if where_conditions else "true"
                        
                        query = f"""
                            MATCH (target:Object)
                            WHERE {where_clause}
                            RETURN target.id as target_id, target.being as being, target.avatar as avatar, target.object as object
                        """
                        
                        target_results = session.run(query, **params).data()
                        
                        print(f"DEBUG: Found {len(target_results)} matching objects for relationship:")
                        print(f"  toBeing: {rel.get('toBeing', 'ALL')}, toAvatar: {rel.get('toAvatar', 'ALL')}, toObject: {rel.get('toObject', 'ALL')}")
                        for result in target_results:
                            print(f"  - {result['being']}, {result['avatar']}, {result['object']} (ID: {result['target_id']})")
                        
                        # Create relationships to ALL matching objects
                        for j, target_result in enumerate(target_results):
                            target_id = target_result["target_id"]
                            
                            # Generate unique relationship ID
                            relationship_id = str(uuid.uuid4())
                            print(f"DEBUG: Creating relationship {j+1}/{len(target_results)} from {object_id} to {target_id} with ID {relationship_id}")
                            try:
                                session.run("""
                                    MATCH (source:Object {id: $source_id})
                                    MATCH (target:Object {id: $target_id})
                                    CREATE (source)-[:RELATES_TO {
                                        id: $relationship_id,
                                        type: $relationship_type,
                                        role: $role,
                                        toBeing: $to_being,
                                        toAvatar: $to_avatar,
                                        toObject: $to_object
                                    }]->(target)
                                """, source_id=object_id, target_id=target_id, relationship_id=relationship_id,
                                    relationship_type=rel.get("type", "Inter-Table"),
                                    role=rel.get("role", ""),
                                    to_being=rel.get("toBeing", "ALL"),
                                    to_avatar=rel.get("toAvatar", "ALL"),
                                    to_object=rel.get("toObject", "ALL"))
                                print(f"DEBUG: Successfully created relationship {j+1}")
                            except Exception as e:
                                print(f"DEBUG: Error creating relationship {j+1}: {e}")
                
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
            
            # Return the updated object data
            updated_object = session.run("""
                MATCH (o:Object {id: $object_id})
                RETURN o.id as id, o.being as being, o.avatar as avatar, o.object as object, 
                       o.driver as driver, o.relationships as relationships, o.variants as variants
            """, object_id=object_id).single()
            
            if updated_object:
                return {
                    "id": updated_object["id"],
                    "being": updated_object["being"],
                    "avatar": updated_object["avatar"], 
                    "object": updated_object["object"],
                    "driver": updated_object["driver"],
                    "relationships": updated_object["relationships"],
                    "variants": updated_object["variants"]
                }
            else:
                return {"message": "Object updated successfully"}

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
                # Find ALL target objects that match the criteria (remove LIMIT 1)
                target_results = session.run("""
                    MATCH (target:Object)
                    WHERE (target.being = $toBeing OR $toBeing = "ALL")
                      AND (target.avatar = $toAvatar OR $toAvatar = "ALL")
                      AND (target.object = $toObject OR $toObject = "ALL")
                    RETURN target.id as target_id
                """, toBeing=rel["toBeing"], toAvatar=rel["toAvatar"], toObject=rel["toObject"]).data()
                
                # Create relationships to ALL matching objects
                for target_result in target_results:
                    # Generate unique relationship ID
                    relationship_id = str(uuid.uuid4())
                    # Create the new RELATES_TO relationship
                    session.run("""
                        MATCH (source:Object {id: $source_id})
                        MATCH (target:Object {id: $target_id})
                        CREATE (source)-[:RELATES_TO {
                            id: $relationship_id,
                            type: $type,
                            role: $role,
                            toBeing: $toBeing,
                            toAvatar: $toAvatar,
                            toObject: $toObject
                        }]->(target)
                    """, source_id=rel["source_id"], target_id=target_result["target_id"], relationship_id=relationship_id,
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

                    # Check for duplicate objects (full combination check)
                    # First, get the driver string to check for exact duplicates
                    sector_str = "ALL" if "ALL" in sector else ", ".join(sector)
                    domain_str = "ALL" if "ALL" in domain else ", ".join(domain)
                    country_str = "ALL" if "ALL" in country else ", ".join(country)
                    clarifier_str = object_clarifier or "None"
                    driver_string = f"{sector_str}, {domain_str}, {country_str}, {clarifier_str}"
                    
                    existing = session.run("""
                        MATCH (o:Object {being: $being, avatar: $avatar, object: $object, driver: $driver})
                        RETURN o.id as id
                    """, being=csv_row.Being, avatar=csv_row.Avatar, object=csv_row.Object, driver=driver_string).single()

                    if existing:
                        errors.append(f"Row {row_num}: Object with Being='{csv_row.Being}', Avatar='{csv_row.Avatar}', Object='{csv_row.Object}' already exists")
                        continue

                    # Create object
                    new_id = str(uuid.uuid4())

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
                        RETURN r.id as id, r.type as type, r.role as role,
                               other.being as toBeing, other.avatar as toAvatar, other.object as toObject
                    """, object_id=new_id)

                    relationships = []
                    for rel_record in relationships_result:
                        relationships.append({
                            "id": rel_record["id"] or str(uuid.uuid4()),  # Use existing ID or generate new one
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
        
        return CSVUploadResponse(
            success=True,
            message=f"CSV upload completed. Created {len(created_objects)} objects.",
            created_count=len(created_objects),
            error_count=len(errors),
            errors=errors,
            created_objects=created_objects
        )

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
    request: RelationshipCreateRequest = Body(...)
):
    """Create a new relationship for an object"""
    # Debug request data
    print(f"DEBUG: create_relationship called with:")
    print(f"  object_id: {object_id}")
    print(f"  relationship_type: '{request.relationship_type}' (type: {type(request.relationship_type)}, len: {len(request.relationship_type)})")
    print(f"  role: '{request.role}' (type: {type(request.role)}, len: {len(request.role)})")
    print(f"  to_being: '{request.to_being}' (type: {type(request.to_being)}, len: {len(request.to_being)})")
    print(f"  to_avatar: '{request.to_avatar}' (type: {type(request.to_avatar)}, len: {len(request.to_avatar)})")
    print(f"  to_object: '{request.to_object}' (type: {type(request.to_object)}, len: {len(request.to_object)})")
    
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j.")
    
    try:
        with driver.session() as session:
            # Find ALL target objects that match the criteria
            where_conditions = []
            params = {}
            
            if request.to_being != "ALL":
                where_conditions.append("target.being = $to_being")
                params["to_being"] = request.to_being
            
            if request.to_avatar != "ALL":
                where_conditions.append("target.avatar = $to_avatar")
                params["to_avatar"] = request.to_avatar
            
            if request.to_object != "ALL":
                where_conditions.append("target.object = $to_object")
                params["to_object"] = request.to_object
            
            where_clause = " AND ".join(where_conditions) if where_conditions else "true"
            
            query = f"""
                MATCH (target:Object)
                WHERE {where_clause}
                RETURN target.id as target_id, target.being as being, target.avatar as avatar, target.object as object
            """
            
            target_results = session.run(query, **params).data()
            
            if not target_results:
                raise HTTPException(status_code=404, detail="No target objects found matching criteria")
            
            print(f"DEBUG: Found {len(target_results)} matching objects for relationship:")
            print(f"  toBeing: {request.to_being}, toAvatar: {request.to_avatar}, toObject: {request.to_object}")
            for result in target_results:
                print(f"  - {result['being']}, {result['avatar']}, {result['object']} (ID: {result['target_id']})")
            
            # Create relationships to ALL matching objects
            for i, target_result in enumerate(target_results):
                target_id = target_result["target_id"]
                # Generate unique relationship ID
                relationship_id = str(uuid.uuid4())
                print(f"DEBUG: Creating relationship {i+1}/{len(target_results)} from {object_id} to {target_id} ({target_result['being']}, {target_result['avatar']}, {target_result['object']}) with ID {relationship_id}")
                try:
                    result = session.run("""
                        MATCH (source:Object {id: $source_id})
                        MATCH (target:Object {id: $target_id})
                        CREATE (source)-[:RELATES_TO {
                            id: $relationship_id,
                            type: $relationship_type,
                            role: $role,
                            toBeing: $to_being,
                            toAvatar: $to_avatar,
                            toObject: $to_object
                        }]->(target)
                    """, source_id=object_id, target_id=target_id, relationship_id=relationship_id,
                        relationship_type=request.relationship_type, role=request.role, to_being=request.to_being, 
                        to_avatar=request.to_avatar, to_object=request.to_object)
                    print(f"DEBUG: Successfully created relationship to {target_result['object']}")
                except Exception as e:
                    print(f"DEBUG: Error creating relationship to {target_result['object']}: {e}")
            
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
                "type": request.relationship_type,
                "role": request.role,
                "toBeing": request.to_being,
                "toAvatar": request.to_avatar,
                "toObject": request.to_object
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
            # Delete the RELATES_TO relationship by unique identifier
            session.run("""
                MATCH (o:Object {id: $object_id})-[r:RELATES_TO]->(other:Object)
                WHERE r.id = $relationship_id
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
async def create_variant(object_id: str, request: VariantCreateRequest = Body(...)):
    """Create a new variant for an object"""
    # Debug request data
    print(f"DEBUG: create_variant called with:")
    print(f"  object_id: {object_id}")
    print(f"  variant_name: '{request.variant_name}' (type: {type(request.variant_name)}, len: {len(request.variant_name)})")
    
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j.")
    
    try:
        with driver.session() as session:
            # First check if variant already exists for this specific object (case-insensitive)
            existing_variant_for_object = session.run("""
                MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
                WHERE toLower(v.name) = toLower($variant_name)
                RETURN v.id as id, v.name as name
            """, object_id=object_id, variant_name=request.variant_name).single()
            
            if existing_variant_for_object:
                raise HTTPException(status_code=409, detail="Variant already exists for this object")
            
            # Check if variant already exists globally (case-insensitive)
            existing_variant = session.run("""
                MATCH (v:Variant)
                WHERE toLower(v.name) = toLower($variant_name)
                RETURN v.id as id, v.name as name
            """, variant_name=request.variant_name).single()
            
            if existing_variant:
                # Variant exists globally, connect it to this object
                variant_id = existing_variant["id"]
                
                # Connect existing variant to object
                session.run("""
                    MATCH (o:Object {id: $object_id})
                    MATCH (v:Variant {id: $variant_id})
                    CREATE (o)-[:HAS_VARIANT]->(v)
                """, object_id=object_id, variant_id=variant_id)
            else:
                # Create new variant
                variant_id = str(uuid.uuid4())
                
                # Create variant node
                session.run("""
                    CREATE (v:Variant {
                        id: $variant_id,
                        name: $variant_name
                    })
                """, variant_id=variant_id, variant_name=request.variant_name)
                
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
                "name": request.variant_name
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

@router.post("/objects/{object_id}/variants/upload", response_model=CSVUploadResponse)
async def bulk_upload_variants(object_id: str, file: UploadFile = File(...)):
    """Bulk upload variants for an object from CSV file"""
    print(f"DEBUG: bulk_upload_variants called with object_id={object_id}, file={file.filename}")
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
    
    # Database operations are outside the CSV parsing try-catch
    created_variants = []
    errors = []
    skipped_count = 0
    
    try:
        with driver.session() as session:
            print(f"DEBUG: Starting session for object {object_id}")
            # Get existing variants for this object to check for duplicates
            existing_variants_result = session.run("""
                MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
                RETURN v.name as name
            """, object_id=object_id)
            
            existing_variant_names = {record["name"].lower() for record in existing_variants_result}
            
            # Get all global variants to check for existing ones
            global_variants_result = session.run("""
                MATCH (v:Variant)
                RETURN v.name as name, v.id as id
            """)
            
            global_variants = {record["name"].lower(): record["id"] for record in global_variants_result}
            print(f"DEBUG: Found {len(global_variants)} global variants: {list(global_variants.keys())}")
            
            for row_num, row in enumerate(rows, start=2):
                # Get variant name from the row
                variant_name = row.get('Variant', '').strip()
                if not variant_name:
                    errors.append(f"Row {row_num}: Variant name is required")
                    continue
                
                # Check for duplicates (case-insensitive) - only for this specific object
                if variant_name.lower() in existing_variant_names:
                    skipped_count += 1
                    print(f"Skipping duplicate variant for this object: {variant_name}")
                    continue
                
                # Check if variant exists globally by querying it directly (case-insensitive)
                existing_variant = session.run("""
                    MATCH (v:Variant)
                    WHERE toLower(v.name) = toLower($variant_name)
                    RETURN v.id as id, v.name as name
                """, variant_name=variant_name).single()
                
                if existing_variant:
                    # Variant exists globally, just connect it to this object
                    print(f"Connecting existing global variant to object: {variant_name}")
                    
                    variant_id = existing_variant["id"]
                    
                    # Check if this variant is already connected to this object
                    already_connected = session.run("""
                        MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant {id: $variant_id})
                        RETURN v.id as id
                    """, object_id=object_id, variant_id=variant_id).single()
                    
                    if not already_connected:
                        # Connect existing variant to object (MERGE to avoid duplicate relationships)
                        session.run("""
                            MATCH (o:Object {id: $object_id})
                            MATCH (v:Variant {id: $variant_id})
                            MERGE (o)-[:HAS_VARIANT]->(v)
                        """, object_id=object_id, variant_id=variant_id)
                        
                        # Add to existing variants set to avoid duplicates within the same upload
                        existing_variant_names.add(variant_name.lower())
                        
                        created_variants.append({
                            "id": variant_id,
                            "name": variant_name
                        })
                    else:
                        print(f"Variant {variant_name} already connected to this object, skipping")
                        skipped_count += 1
                else:
                    # Create new variant
                    print(f"Creating new variant: {variant_name}")
                    variant_id = str(uuid.uuid4())
                    
                    try:
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
                        
                        # Add to existing variants set to avoid duplicates within the same upload
                        existing_variant_names.add(variant_name.lower())
                        
                        created_variants.append({
                            "id": variant_id,
                            "name": variant_name
                        })
                    except Exception as create_error:
                        print(f"Error creating variant {variant_name}: {create_error}")
                        errors.append(f"Row {row_num}: Failed to create variant '{variant_name}': {str(create_error)}")
            
            # Update variant count for the object
            if created_variants:
                count_result = session.run("""
                    MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
                    RETURN count(v) as var_count
                """, object_id=object_id).single()
                
                var_count = count_result["var_count"] if count_result else 0
                
                session.run("""
                    MATCH (o:Object {id: $object_id})
                    SET o.variants = $var_count
                """, object_id=object_id, var_count=var_count)
    
    except Exception as session_error:
        print(f"DEBUG: Session error: {str(session_error)}")
        errors.append(f"Database session error: {str(session_error)}")

    return CSVUploadResponse(
        success=True,
        message=f"Successfully created {len(created_variants)} variants. Skipped {skipped_count} duplicates.",
        created_count=len(created_variants),
        error_count=len(errors),
        errors=errors
    )

