from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Body
from typing import List, Dict, Any, Optional
import uuid
import csv
import io
import json
from pydantic import BaseModel
from neo4j import WRITE_ACCESS
from db import get_driver
from schema import ObjectCreateRequest, ObjectResponse, CSVUploadResponse, CSVRowData

# Pydantic models for JSON body parameters
class RelationshipCreateRequest(BaseModel):
    relationship_type: str
    role: str
    frequency: Optional[str] = "Critical"
    to_being: str
    to_avatar: str
    to_object: str

class VariantCreateRequest(BaseModel):
    variant_name: str

class BulkRelationshipItem(BaseModel):
    source_object_id: str
    target_being: str
    target_avatar: str
    target_object: str
    relationship_type: str
    roles: List[str]
    frequency: Optional[str] = "Critical"

class BulkRelationshipCreateRequest(BaseModel):
    relationships: List[BulkRelationshipItem]

router = APIRouter()

def create_default_relationships_for_object(session, source_object_id: str, source_object_name: str):
    """
    Create default relationships for a new object.
    Creates relationships to ALL existing objects (including itself) with:
    - Inter-Table for other objects, Intra-Table for self
    - Frequency = Possible
    - Role = source object name (default role word)
    """
    # Get all existing objects
    result = session.run("""
        MATCH (o:Object)
        RETURN o.id as id, o.object as object, o.being as being, o.avatar as avatar
    """)
    
    all_objects = [record for record in result]
    
    relationships_created = 0
    
    for target_obj in all_objects:
        target_id = target_obj["id"]
        target_being = target_obj.get("being", "ALL")
        target_avatar = target_obj.get("avatar", "ALL")
        target_object_name = target_obj.get("object", "ALL")
        
        # Determine relationship type
        is_self = source_object_id == target_id
        relationship_type = "Intra-Table" if is_self else "Inter-Table"
        frequency = "Possible"
        role = source_object_name  # Default role word is source object name
        
        # Check if relationship already exists (shouldn't for new objects, but be safe)
        existing_check = session.run("""
            MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object {id: $target_id})
            WHERE r.role = $role
            RETURN count(r) as count
        """, source_id=source_object_id, target_id=target_id, role=role).single()
        
        if existing_check and existing_check["count"] > 0:
            continue  # Skip if already exists
        
        # Create default relationship
        relationship_id = str(uuid.uuid4())
        session.run("""
            MATCH (source:Object {id: $source_id})
            MATCH (target:Object {id: $target_id})
            CREATE (source)-[:RELATES_TO {
                id: $relationship_id,
                type: $relationship_type,
                role: $role,
                frequency: $frequency,
                toBeing: $to_being,
                toAvatar: $to_avatar,
                toObject: $to_object
            }]->(target)
        """, 
            source_id=source_object_id,
            target_id=target_id,
            relationship_id=relationship_id,
            relationship_type=relationship_type,
            role=role,
            frequency=frequency,
            to_being=target_being,
            to_avatar=target_avatar,
            to_object=target_object_name
        )
        relationships_created += 1
    
    return relationships_created

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
            # Optimized single query to get all objects with relationships, variants, and variables
            # This avoids N+1 query problem by fetching everything in one query
            result = session.run("""
                MATCH (o:Object)
                OPTIONAL MATCH (o)-[r:RELATES_TO]->(other:Object)
                OPTIONAL MATCH (o)-[:HAS_VARIANT]->(v:Variant)
                OPTIONAL MATCH (o)-[:HAS_SPECIFIC_VARIABLE]->(var:Variable)
                WITH o, 
                     collect(DISTINCT {
                         id: r.id,
                         type: r.type,
                         role: r.role,
                         toBeing: other.being,
                         toAvatar: other.avatar,
                         toObject: other.object
                     }) as relationships,
                     collect(DISTINCT v.name) as variant_names,
                     count(DISTINCT var) as variables_count,
                     count(r) as relationships_count
                RETURN o.id as id, 
                       o.driver as driver, 
                       o.being as being,
                       o.avatar as avatar, 
                       o.object as object, 
                       o.status as status,
                       COALESCE(o.is_meme, false) as is_meme,
                       COALESCE(o.relationships, 0) as stored_relationships,
                       relationships,
                       variant_names,
                       variables_count,
                       relationships_count
                ORDER BY o.id
            """)
            
            objects = []
            for record in result:
                # Filter out null relationships (from OPTIONAL MATCH when no relationships exist)
                # The collect() may include entries with all None values when no relationships exist
                relationships_raw = record["relationships"] if record["relationships"] else []
                relationships = []
                for rel in relationships_raw:
                    # Skip entries where type is None (meaning no relationship was matched)
                    if rel.get("type") is not None:
                        relationships.append({
                            "id": rel.get("id") or str(uuid.uuid4()),
                            "type": rel.get("type"),
                            "role": rel.get("role"),
                            "toBeing": rel.get("toBeing"),
                            "toAvatar": rel.get("toAvatar"),
                            "toObject": rel.get("toObject")
                        })
                
                # Filter out null variant names
                variant_names = [name for name in record["variant_names"] if name is not None]
                variants = [
                    {
                        "id": str(uuid.uuid4()),
                        "name": name
                    }
                    for name in variant_names
                ]
                
                # Get variables count from the query result
                variables_count = record.get("variables_count", 0) or 0
                
                # Get relationships count - use stored property (kept in sync by update script)
                # This ensures the UI shows exactly what's stored in Neo4j
                stored_relationships = record.get("stored_relationships")
                if stored_relationships is not None:
                    relationships_count = int(stored_relationships)
                else:
                    # Fallback to calculated count if stored property doesn't exist
                    relationships_count = record.get("relationships_count", 0) or 0
                
                obj = {
                    "id": record["id"],
                    "driver": record["driver"],
                    "being": record["being"],
                    "avatar": record["avatar"],
                    "object": record["object"],
                    "relationships": relationships_count,  # Use stored property (matches Neo4j)
                    "variants": len(variants),
                    "variables": variables_count,
                    "status": record["status"] or "Active",
                    "is_meme": record.get("is_meme", False),
                    "relationshipsList": relationships,
                    "variantsList": variants
                }
                objects.append(obj)

            print(f"Retrieved {len(objects)} objects from Neo4j (optimized query)")
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
                       o.avatar as avatar, o.object as object, o.status as status,
                       COALESCE(o.is_meme, false) as is_meme
            """, object_id=object_id)

            record = result.single()
            if not record:
                raise HTTPException(status_code=404, detail="Object not found")

            # Get relationship count - count total relationships (not distinct targets)
            # Multiple role words to same target = multiple relationships
            rel_count_result = session.run("""
                MATCH (o:Object {id: $object_id})-[:RELATES_TO]->(other:Object)
                RETURN count(*) as rel_count
            """, object_id=object_id).single()
            
            # Get variant count
            var_count_result = session.run("""
                MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
                RETURN count(v) as var_count
            """, object_id=object_id).single()
            
            # Get variables count (HAS_SPECIFIC_VARIABLE relationships)
            variables_count_result = session.run("""
                MATCH (o:Object {id: $object_id})-[:HAS_SPECIFIC_VARIABLE]->(var:Variable)
                RETURN count(var) as variables_count
            """, object_id=object_id).single()

            obj = {
                "id": record["id"],
                "driver": record["driver"],
                "being": record["being"],
                "avatar": record["avatar"],
                "object": record["object"],
                "status": record["status"],
                "is_meme": record.get("is_meme", False),
                "relationships": rel_count_result["rel_count"] if rel_count_result else 0,
                "variants": var_count_result["var_count"] if var_count_result else 0,
                "variables": variables_count_result["variables_count"] if variables_count_result else 0,
                "relationshipsList": [],
                "variantsList": []
            }

            # Get relationships
            relationships_result = session.run("""
                MATCH (o:Object {id: $object_id})-[r:RELATES_TO]->(other:Object)
                RETURN r.id as id, r.type as type, r.role as role, r.frequency as frequency,
                       other.being as toBeing, other.avatar as toAvatar, other.object as toObject
            """, object_id=object_id)

            relationships = []
            for rel_record in relationships_result:
                relationships.append({
                    "id": rel_record["id"] or str(uuid.uuid4()),  # Use existing ID or generate new one
                    "type": rel_record["type"],
                    "role": rel_record["role"],
                    "frequency": rel_record.get("frequency") or "Critical",  # Default to Critical if not present
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

            # Get unique ID relationships (HAS_UNIQUE_ID, previously HAS_DISCRETE_ID)
            # Support both for backward compatibility
            discrete_id_result = session.run("""
                MATCH (o:Object {id: $object_id})-[:HAS_UNIQUE_ID|HAS_DISCRETE_ID]->(v:Variable)
                MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v)
                RETURN v.id as variableId, v.name as variableName, p.name as part, g.name as group
            """, object_id=object_id)
            
            discrete_ids = []
            for record in discrete_id_result:
                discrete_ids.append({
                    "variableId": record["variableId"],
                    "variableName": record["variableName"],
                    "part": record["part"],
                    "group": record["group"]
                })
            obj["discreteIds"] = discrete_ids

            # Get composite ID relationships (HAS_COMPOSITE_ID_1 through HAS_COMPOSITE_ID_5)
            composite_ids = {str(i): [] for i in range(1, 6)}
            for i in range(1, 6):
                composite_result = session.run(f"""
                    MATCH (o:Object {{id: $object_id}})-[:HAS_COMPOSITE_ID_{i}]->(v:Variable)
                    MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v)
                    RETURN v.id as variableId, v.name as variableName, p.name as part, g.name as group
                """, object_id=object_id)
                
                for record in composite_result:
                    composite_ids[str(i)].append({
                        "variableId": record["variableId"],
                        "variableName": record["variableName"],
                        "part": record["part"],
                        "group": record["group"]
                    })
            obj["compositeIds"] = composite_ids

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
            
            # Get is_meme value (default to False)
            is_meme = getattr(object_data, 'isMeme', False) or False
            
            # Create the Object node
            session.run("""
                CREATE (o:Object {
                    id: $id,
                    name: $object,
                    driver: $driver,
                    being: $being,
                    avatar: $avatar,
                    object: $object,
                    status: $status,
                    is_meme: $is_meme
                })
            """, 
            id=new_id,
            driver=driver_string,
            being=object_data.being,
            avatar=object_data.avatar,
            object=object_data.object,
            status=getattr(object_data, 'status', 'Active'),
            is_meme=is_meme)
            
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
                                frequency: $frequency,
                                toBeing: $to_being,
                                toAvatar: $to_avatar,
                                toObject: $to_object
                            }]->(target)
                        """, source_id=new_id, target_id=target_id, relationship_id=relationship_id,
                            relationship_type=rel.get("type", "Inter-Table"),
                            role=rel.get("role", ""),
                            frequency=rel.get("frequency", "Critical"),
                            to_being=rel.get("toBeing", "ALL"),
                            to_avatar=rel.get("toAvatar", "ALL"),
                            to_object=rel.get("toObject", "ALL"))
            
            # Create default relationships to ALL existing objects (including itself)
            # This ensures every object has default relationships with role = object name
            print(f"Creating default relationships for new object: {object_data.object}")
            default_rels_created = create_default_relationships_for_object(
                session, 
                new_id, 
                object_data.object
            )
            print(f"Created {default_rels_created} default relationships")
            
            # Calculate actual relationship count (includes default + any user-provided relationships)
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
            
            # Handle identifier relationships (discrete and composite IDs)
            # Note: object_data is a Pydantic model, so we access attributes directly
            identifier_data = getattr(object_data, 'identifier', None)
            if identifier_data:
                # Check if it's a dict (from JSON) or an object (from Pydantic)
                if isinstance(identifier_data, dict):
                    identifier_dict = identifier_data
                else:
                    identifier_dict = identifier_data.dict() if hasattr(identifier_data, 'dict') else {}
                
                # Handle unique ID (previously discrete ID)
                discrete_id_data = identifier_dict.get('discreteId', {})
                if isinstance(discrete_id_data, dict):
                    variable_ids = discrete_id_data.get('variables', [])
                    if variable_ids:
                        # If "ALL" is selected, get all variables where Part = "Identifier" and Group = "Public ID"
                        if 'ALL' in variable_ids:
                            all_vars_result = session.run("""
                                MATCH (p:Part {name: 'Identifier'})-[:HAS_GROUP]->(g:Group {name: 'Public ID'})-[:HAS_VARIABLE]->(v:Variable)
                                RETURN v.id as variableId
                            """, object_id=new_id)
                            variable_ids = [record['variableId'] for record in all_vars_result]
                            variable_ids = [v for v in variable_ids if v != 'ALL']
                        
                        # Create relationships to selected variables - use HAS_UNIQUE_ID
                        for var_id in variable_ids:
                            if var_id:
                                session.run("""
                                    MATCH (o:Object {id: $object_id})
                                    MATCH (v:Variable {id: $var_id})
                                    MERGE (o)-[:HAS_UNIQUE_ID]->(v)
                                """, object_id=new_id, var_id=var_id)
                
                # Handle composite IDs (1-5)
                composite_ids_data = identifier_dict.get('compositeIds', {})
                if isinstance(composite_ids_data, dict):
                    for composite_index in range(1, 6):
                        composite_id_data = composite_ids_data.get(str(composite_index), {})
                        if isinstance(composite_id_data, dict):
                            part = composite_id_data.get('part')
                            group = composite_id_data.get('group')
                            variable_ids = composite_id_data.get('variables', [])
                            
                            if part and group and variable_ids:
                                # If "ALL" is selected, get all variables for that Part and Group
                                if 'ALL' in variable_ids:
                                    all_vars_result = session.run("""
                                        MATCH (p:Part {name: $part})-[:HAS_GROUP]->(g:Group {name: $group})-[:HAS_VARIABLE]->(v:Variable)
                                        RETURN v.id as variableId
                                    """, part=part, group=group)
                                    variable_ids = [record['variableId'] for record in all_vars_result]
                                    variable_ids = [v for v in variable_ids if v != 'ALL']
                                
                                # Create relationships to selected variables
                                for var_id in variable_ids:
                                    if var_id:
                                        session.run(f"""
                                            MATCH (o:Object {{id: $object_id}})
                                            MATCH (v:Variable {{id: $var_id}})
                                            MERGE (o)-[:HAS_COMPOSITE_ID_{composite_index}]->(v)
                                        """, object_id=new_id, var_id=var_id)
            
            return {
                "id": new_id,
                "driver": driver_string,
                "being": object_data.being,
                "avatar": object_data.avatar,
                "object": object_data.object,
                "status": getattr(object_data, 'status', 'Active'),
                "is_meme": is_meme,
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
    print(f"🎭 update_object called with object_id={object_id}, request_data={request_data}")
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
                print(f"DEBUG: isMeme field: {request_data.get('isMeme', 'NOT_FOUND')} (type: {type(request_data.get('isMeme'))})")
                
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
                
                # Handle isMeme - check if key exists (even if value is False)
                if 'isMeme' in request_data:
                    is_meme_value = bool(request_data['isMeme'])
                    set_clauses.append("o.is_meme = $is_meme")
                    params["is_meme"] = is_meme_value
                    print(f"DEBUG: 🎭 Adding is_meme update: {is_meme_value} for object {object_id}")
                
                # Update basic fields if any
                if set_clauses:
                    update_query = f"""
                        MATCH (o:Object {{id: $object_id}})
                        SET {', '.join(set_clauses)}
                        RETURN o.id as id, o.is_meme as is_meme
                    """
                    print(f"DEBUG: Executing update query: {update_query}")
                    print(f"DEBUG: With parameters: {params}")
                    result = session.run(update_query, params)
                    updated_record = result.single()
                    if updated_record:
                        print(f"DEBUG: ✅ Update successful - is_meme is now: {updated_record.get('is_meme')}")
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
                    
                    # Update taxonomy relationships if being or avatar changed
                    being_changed = 'being' in request_data and request_data['being']
                    avatar_changed = 'avatar' in request_data and request_data['avatar']
                    object_changed = ('object' in request_data and request_data['object']) or ('objectName' in request_data and request_data['objectName'])
                    
                    if being_changed or avatar_changed or object_changed:
                        # Get the final values (after update)
                        final_result = session.run("""
                            MATCH (o:Object {id: $object_id})
                            RETURN o.being as being, o.avatar as avatar, o.object as object
                        """, object_id=object_id).single()
                        
                        if final_result:
                            final_being = final_result['being']
                            final_avatar = final_result['avatar']
                            final_object = final_result['object']
                            
                            # Delete old taxonomy relationships
                            session.run("""
                                MATCH (b:Being)-[:HAS_AVATAR]->(a:Avatar)-[r:HAS_OBJECT]->(o:Object {id: $object_id})
                                DELETE r
                            """, object_id=object_id)
                            
                            # Create new taxonomy relationships
                            if final_being and final_avatar:
                                session.run("""
                                    MATCH (o:Object {id: $object_id})
                                    MERGE (b:Being {name: $being})
                                    MERGE (a:Avatar {name: $avatar})
                                    MERGE (b)-[:HAS_AVATAR]->(a)
                                    MERGE (a)-[:HAS_OBJECT]->(o)
                                """, object_id=object_id, being=final_being, avatar=final_avatar)
                                print(f"DEBUG: Updated taxonomy relationships - Being: {final_being}, Avatar: {final_avatar}")

            # Handle relationships and variants bulk update
            print(f"DEBUG: request_data={request_data}")
            print(f"DEBUG: request_data keys: {list(request_data.keys()) if request_data else 'None'}")
            has_relationships = request_data and 'relationships' in request_data and request_data['relationships']
            has_variants = request_data and 'variants' in request_data and request_data['variants']
            has_variants_list = request_data and 'variantsList' in request_data and request_data['variantsList']
            print(f"DEBUG: has_relationships={has_relationships}, has_variants={has_variants}, has_variants_list={has_variants_list}")
            if has_variants_list:
                print(f"DEBUG: variantsList content: {request_data['variantsList']}")
                print(f"DEBUG: variantsList length: {len(request_data['variantsList']) if request_data['variantsList'] else 0}")
            
            # Only process relationships/variants if they are explicitly provided
            if has_relationships or has_variants or has_variants_list:
                print(f"DEBUG: Processing relationships and variants update")
                # Get from request_data
                parsed_relationships = request_data.get('relationships', []) if request_data else []
                parsed_variants = request_data.get('variants', []) if request_data else []
                parsed_variants_list = request_data.get('variantsList', []) if request_data else []
                
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
                
                # Clear existing relationships (always clear for relationships)
                if has_relationships:
                    session.run("""
                        MATCH (o:Object {id: $object_id})-[r:RELATES_TO]->(other:Object)
                        DELETE r
                    """, object_id=object_id)
                
                # Only clear existing variants if using 'variants' field (replace mode)
                # For 'variantsList' field (bulk edit), we append variants instead of replacing
                if has_variants:
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
                                        frequency: $frequency,
                                        toBeing: $to_being,
                                        toAvatar: $to_avatar,
                                        toObject: $to_object
                                    }]->(target)
                                """, source_id=object_id, target_id=target_id, relationship_id=relationship_id,
                                    relationship_type=rel.get("type", "Inter-Table"),
                                    role=rel.get("role", ""),
                                    frequency=rel.get("frequency", "Critical"),
                                    to_being=rel.get("toBeing", "ALL"),
                                    to_avatar=rel.get("toAvatar", "ALL"),
                                    to_object=rel.get("toObject", "ALL"))
                                print(f"DEBUG: Successfully created relationship {j+1}")
                            except Exception as e:
                                print(f"DEBUG: Error creating relationship {j+1}: {e}")
                
                # Create new variants (handle both 'variants' and 'variantsList')
                variants_to_create = []
                if parsed_variants:
                    variants_to_create.extend(parsed_variants)
                if parsed_variants_list:
                    variants_to_create.extend(parsed_variants_list)
                
                if variants_to_create:
                    print(f"DEBUG: Processing {len(variants_to_create)} variants")
                    for var in variants_to_create:
                        variant_name = var.get("name", "").strip()
                        if not variant_name:
                            continue
                            
                        print(f"DEBUG: Processing variant: {variant_name}")
                        
                        # Check if variant already exists for this object (case-insensitive)
                        existing_variant_for_object = session.run("""
                            MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
                            WHERE toLower(v.name) = toLower($variant_name)
                            RETURN v.id as id, v.name as name
                        """, object_id=object_id, variant_name=variant_name).single()
                        
                        if existing_variant_for_object:
                            print(f"DEBUG: Variant '{variant_name}' already exists for object {object_id}, skipping")
                            continue
                        
                        # Check if variant exists globally (case-insensitive)
                        existing_variant = session.run("""
                            MATCH (v:Variant)
                            WHERE toLower(v.name) = toLower($variant_name)
                            RETURN v.id as id, v.name as name
                        """, variant_name=variant_name).single()
                        
                        if existing_variant:
                            # Variant exists globally, connect it to this object
                            variant_id = existing_variant["id"]
                            print(f"DEBUG: Connecting existing global variant '{variant_name}' to object {object_id}")
                            
                            session.run("""
                                MATCH (o:Object {id: $object_id})
                                MATCH (v:Variant {id: $variant_id})
                                CREATE (o)-[:HAS_VARIANT]->(v)
                            """, object_id=object_id, variant_id=variant_id)
                        else:
                            # Create new variant
                            variant_id = str(uuid.uuid4())
                            print(f"DEBUG: Creating new variant '{variant_name}' for object {object_id}")
                            
                            session.run("""
                                CREATE (v:Variant {
                                    id: $variant_id,
                                    name: $variant_name
                                })
                            """, variant_id=variant_id, variant_name=variant_name)
                            
                            session.run("""
                                MATCH (o:Object {id: $object_id})
                                MATCH (v:Variant {id: $variant_id})
                                CREATE (o)-[:HAS_VARIANT]->(v)
                            """, object_id=object_id, variant_id=variant_id)
                
            # Handle identifier relationships (discrete and composite IDs)
            has_identifier = request_data and 'identifier' in request_data and request_data['identifier']
            if has_identifier:
                identifier_data = request_data['identifier']
                
                # Handle unique ID (previously discrete ID)
                # Clear existing unique ID relationships (support both old and new relationship types for migration)
                session.run("""
                    MATCH (o:Object {id: $object_id})-[r:HAS_UNIQUE_ID|HAS_DISCRETE_ID]->(:Variable)
                    DELETE r
                """, object_id=object_id)
                
                # Get discrete ID variable selections
                discrete_id_data = identifier_data.get('discreteId', {})
                if discrete_id_data and 'variables' in discrete_id_data:
                    variable_ids = discrete_id_data['variables']
                    if variable_ids:
                        # If "ALL" is selected, get all variables where Part = "Identifier" and Group = "Public ID"
                        if 'ALL' in variable_ids:
                            all_vars_result = session.run("""
                                MATCH (p:Part {name: 'Identifier'})-[:HAS_GROUP]->(g:Group {name: 'Public ID'})-[:HAS_VARIABLE]->(v:Variable)
                                RETURN v.id as variableId
                            """, object_id=object_id)
                            variable_ids = [record['variableId'] for record in all_vars_result]
                            # Remove 'ALL' from the list
                            variable_ids = [v for v in variable_ids if v != 'ALL']
                        
                        # Create relationships to selected variables - use HAS_UNIQUE_ID
                        for var_id in variable_ids:
                            if var_id:  # Skip empty strings
                                session.run("""
                                    MATCH (o:Object {id: $object_id})
                                    MATCH (v:Variable {id: $var_id})
                                    MERGE (o)-[:HAS_UNIQUE_ID]->(v)
                                """, object_id=object_id, var_id=var_id)
                
                # Handle composite IDs (1-5)
                # Clear existing composite ID relationships
                for i in range(1, 6):
                    session.run(f"""
                        MATCH (o:Object {{id: $object_id}})-[r:HAS_COMPOSITE_ID_{i}]->(:Variable)
                        DELETE r
                    """, object_id=object_id)
                
                # Get composite IDs data
                composite_ids_data = identifier_data.get('compositeIds', {})
                for composite_index in range(1, 6):
                    composite_id_data = composite_ids_data.get(str(composite_index), {})
                    if composite_id_data and 'part' in composite_id_data and 'group' in composite_id_data and 'variables' in composite_id_data:
                        part = composite_id_data['part']
                        group = composite_id_data['group']
                        variable_ids = composite_id_data['variables']
                        
                        if part and group and variable_ids:
                            # If "ALL" is selected, get all variables for that Part and Group
                            if 'ALL' in variable_ids:
                                all_vars_result = session.run("""
                                    MATCH (p:Part {name: $part})-[:HAS_GROUP]->(g:Group {name: $group})-[:HAS_VARIABLE]->(v:Variable)
                                    RETURN v.id as variableId
                                """, part=part, group=group)
                                variable_ids = [record['variableId'] for record in all_vars_result]
                                variable_ids = [v for v in variable_ids if v != 'ALL']
                            
                            # Create relationships to selected variables
                            for var_id in variable_ids:
                                if var_id:  # Skip empty strings
                                    session.run(f"""
                                        MATCH (o:Object {{id: $object_id}})
                                        MATCH (v:Variable {{id: $var_id}})
                                        MERGE (o)-[:HAS_COMPOSITE_ID_{composite_index}]->(v)
                                    """, object_id=object_id, var_id=var_id)

                # Update counts
                session.run("""
                    MATCH (o:Object {id: $object_id})
                    SET o.relationships = COUNT { (o)-[:RELATES_TO]->(:Object) },
                        o.variants = COUNT { (o)-[:HAS_VARIANT]->(:Variant) }
                """, object_id=object_id)
                
                # Return the updated object data instead of just a message
                updated_object = session.run("""
                    MATCH (o:Object {id: $object_id})
                    RETURN o.id as id, o.being as being, o.avatar as avatar, o.object as object, 
                           o.driver as driver, o.relationships as relationships, o.variants as variants,
                           COALESCE(o.is_meme, false) as is_meme
                """, object_id=object_id).single()
                
                if updated_object:
                    return {
                        "id": updated_object["id"],
                        "being": updated_object["being"],
                        "avatar": updated_object["avatar"], 
                        "object": updated_object["object"],
                        "driver": updated_object["driver"],
                        "relationships": updated_object["relationships"],
                        "variants": updated_object["variants"],
                        "is_meme": updated_object.get("is_meme", False)
                    }
                else:
                    return {"message": "Object relationships and variants updated successfully"}
            
            # Return the updated object data
            updated_object = session.run("""
                MATCH (o:Object {id: $object_id})
                RETURN o.id as id, o.being as being, o.avatar as avatar, o.object as object, 
                       o.driver as driver, o.relationships as relationships, o.variants as variants,
                       COALESCE(o.is_meme, false) as is_meme
            """, object_id=object_id).single()
            
            if updated_object:
                return {
                    "id": updated_object["id"],
                    "being": updated_object["being"],
                    "avatar": updated_object["avatar"], 
                    "object": updated_object["object"],
                    "driver": updated_object["driver"],
                    "relationships": updated_object["relationships"],
                    "variants": updated_object["variants"],
                    "is_meme": updated_object.get("is_meme", False)
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
                RETURN o.id as source_id, r.type as type, r.role as role, r.frequency as frequency,
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
                            frequency: $frequency,
                            toBeing: $toBeing,
                            toAvatar: $toAvatar,
                            toObject: $toObject
                        }]->(target)
                    """, source_id=rel["source_id"], target_id=target_result["target_id"], relationship_id=relationship_id,
                        type=rel["type"], role=rel["role"],
                        frequency=rel.get("frequency", "Critical"),
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
    Delete an object and all its relationships.
    This will delete the object node, its variants, and all relationships (both incoming and outgoing).
    Connected nodes (like drivers, other objects, variables) will NOT be deleted, only the relationships.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            # Check if object exists first
            check_result = session.run("""
                MATCH (o:Object {id: $object_id})
                RETURN o.id as id
            """, {"object_id": object_id})
            
            check_record = check_result.single()
            if not check_record:
                raise HTTPException(status_code=404, detail="Object not found")
            
            # Delete the object and all its relationships using write transaction
            # DETACH DELETE will delete the node and all relationships (both incoming and outgoing)
            # but will NOT delete the connected nodes themselves
            def delete_tx(tx):
                # First, capture the ID before deletion since we can't access the node after DETACH DELETE
                check = tx.run("""
                    MATCH (o:Object {id: $object_id})
                    RETURN o.id as id
                """, {"object_id": object_id})
                check_record = check.single()
                if not check_record:
                    return None
                
                # Then delete (can't return the node after deletion)
                tx.run("""
                    MATCH (o:Object {id: $object_id})
                    OPTIONAL MATCH (o)-[:HAS_VARIANT]->(v:Variant)
                    DETACH DELETE v, o
                """, {"object_id": object_id})
                
                return check_record
            
            record = session.execute_write(delete_tx)
            if not record:
                raise HTTPException(status_code=404, detail="Object not found")

            print(f"✅ Successfully deleted object {object_id}")
            return {"message": f"Object {object_id} deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting object in Neo4j: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to delete object: {str(e)}")

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
        optional_columns = ['Variants']
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
        
        # Note: Variants column is optional, so we don't check for it

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
                            status: $status,
                            is_meme: false
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
                    # Sector relationships
                    if "ALL" in sector:
                        # Create relationships to ALL existing sectors
                        session.run("""
                            MATCH (s:Sector)
                            MATCH (o:Object {id: $object_id})
                            WITH s, o
                            CREATE (s)-[:RELEVANT_TO]->(o)
                        """, object_id=new_id)
                    else:
                        # Create relationships to selected sectors only
                        for sector_name in sector:
                            session.run("""
                                MATCH (s:Sector {name: $sector})
                                MATCH (o:Object {id: $object_id})
                                WITH s, o
                                CREATE (s)-[:RELEVANT_TO]->(o)
                            """, sector=sector_name, object_id=new_id)

                    # Domain relationships
                    if "ALL" in domain:
                        # Create relationships to ALL existing domains
                        session.run("""
                            MATCH (d:Domain)
                            MATCH (o:Object {id: $object_id})
                            WITH d, o
                            CREATE (d)-[:RELEVANT_TO]->(o)
                        """, object_id=new_id)
                    else:
                        # Create relationships to selected domains only
                        for domain_name in domain:
                            session.run("""
                                MATCH (d:Domain {name: $domain})
                                MATCH (o:Object {id: $object_id})
                                WITH d, o
                                CREATE (d)-[:RELEVANT_TO]->(o)
                            """, domain=domain_name, object_id=new_id)

                    # Country relationships
                    if "ALL" in country:
                        # Create relationships to ALL existing countries
                        session.run("""
                            MATCH (c:Country)
                            MATCH (o:Object {id: $object_id})
                            WITH c, o
                            CREATE (c)-[:RELEVANT_TO]->(o)
                        """, object_id=new_id)
                    else:
                        # Create relationships to selected countries only
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

                    # Create variants if provided in CSV
                    variants_list = []
                    if hasattr(csv_row, 'Variants') and csv_row.Variants:
                        # Parse comma-separated variants
                        variants_str = csv_row.Variants.strip()
                        if variants_str:
                            variants_list = [v.strip() for v in variants_str.split(',') if v.strip()]
                    
                    variants_created = False
                    if variants_list:
                        print(f"DEBUG: Processing {len(variants_list)} variants for object {new_id}")
                        for variant_name in variants_list:
                            if not variant_name:
                                continue
                            
                            # Check if variant already exists globally (case-insensitive)
                            existing_variant = session.run("""
                                MATCH (v:Variant)
                                WHERE toLower(v.name) = toLower($variant_name)
                                RETURN v.id as id, v.name as name
                            """, variant_name=variant_name).single()
                            
                            if existing_variant:
                                # Variant exists globally, connect it to this object
                                variant_id = existing_variant["id"]
                                print(f"DEBUG: Connecting existing variant '{variant_name}' to object {new_id}")
                                
                                # Check if already connected to avoid duplicates
                                already_connected = session.run("""
                                    MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant {id: $variant_id})
                                    RETURN v.id as id
                                """, object_id=new_id, variant_id=variant_id).single()
                                
                                if not already_connected:
                                    session.run("""
                                        MATCH (o:Object {id: $object_id})
                                        MATCH (v:Variant {id: $variant_id})
                                        CREATE (o)-[:HAS_VARIANT]->(v)
                                    """, object_id=new_id, variant_id=variant_id)
                                    variants_created = True
                            else:
                                # Create new variant
                                variant_id = str(uuid.uuid4())
                                print(f"DEBUG: Creating new variant '{variant_name}' for object {new_id}")
                                
                                session.run("""
                                    CREATE (v:Variant {
                                        id: $variant_id,
                                        name: $variant_name
                                    })
                                """, variant_id=variant_id, variant_name=variant_name)
                                
                                session.run("""
                                    MATCH (o:Object {id: $object_id})
                                    MATCH (v:Variant {id: $variant_id})
                                    CREATE (o)-[:HAS_VARIANT]->(v)
                                """, object_id=new_id, variant_id=variant_id)
                                variants_created = True
                        
                        # Update variant count after creating all variants
                        var_count_result = session.run("""
                            MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
                            RETURN count(v) as var_count
                        """, object_id=new_id).single()
                        
                        var_count = var_count_result["var_count"] if var_count_result else 0
                        
                        session.run("""
                            MATCH (o:Object {id: $object_id})
                            SET o.variants = $var_count
                        """, object_id=new_id, var_count=var_count)
                        print(f"DEBUG: Updated variant count to {var_count} for object {new_id}")

                    # Create default relationships to ALL existing objects (including itself)
                    print(f"Creating default relationships for new object from CSV: {csv_row.Object}")
                    default_rels_created = create_default_relationships_for_object(
                        session, 
                        new_id, 
                        csv_row.Object
                    )
                    print(f"Created {default_rels_created} default relationships")

                    print(f"DEBUG: Successfully created object {new_id}")
                    # Get relationships for the newly created object
                    relationships_result = session.run("""
                        MATCH (o:Object {id: $object_id})-[r:RELATES_TO]->(other:Object)
                        RETURN r.id as id, r.type as type, r.role as role, r.frequency as frequency,
                               other.being as toBeing, other.avatar as toAvatar, other.object as toObject
                    """, object_id=new_id)

                    relationships = []
                    for rel_record in relationships_result:
                        relationships.append({
                            "id": rel_record["id"] or str(uuid.uuid4()),  # Use existing ID or generate new one
                            "type": rel_record["type"],
                            "role": rel_record["role"],
                            "frequency": rel_record.get("frequency") or "Critical",
                            "toBeing": rel_record["toBeing"],
                            "toAvatar": rel_record["toAvatar"],
                            "toObject": rel_record["toObject"]
                        })

                    # Get variants for the newly created object (already retrieved above if variants were created)
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
                    
                    # Get variant count (if not already set above when creating variants)
                    if not variants_created:
                        var_count_result = session.run("""
                            MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
                            RETURN count(v) as var_count
                        """, object_id=new_id).single()
                        
                        var_count = var_count_result["var_count"] if var_count_result else 0
                        
                        # Set variant count on object
                        session.run("""
                            MATCH (o:Object {id: $object_id})
                            SET o.variants = $var_count
                        """, object_id=new_id, var_count=var_count)
                    else:
                        # var_count was already set above when creating variants, just retrieve it
                        var_count_result = session.run("""
                            MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
                            RETURN count(v) as var_count
                        """, object_id=new_id).single()
                        var_count = var_count_result["var_count"] if var_count_result else 0

                    created_objects.append({
                        "id": new_id,
                        "driver": driver_string,
                        "being": csv_row.Being,
                        "avatar": csv_row.Avatar,
                        "object": csv_row.Object,
                        "status": "Active",
                        "relationships": len(relationships),
                        "variants": var_count,
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
                
                # Check for existing relationship to prevent duplicates
                existing_relationship = session.run("""
                    MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object {id: $target_id})
                    WHERE r.role = $role
                    RETURN r.id as relationship_id
                """, source_id=object_id, target_id=target_id, role=request.role).single()
                
                if existing_relationship:
                    print(f"DEBUG: Skipping duplicate relationship with role '{request.role}' to {target_result['object']}")
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Duplicate relationship detected. A relationship with role '{request.role}' to {target_result['object']} already exists."
                    )
                
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
                            frequency: $frequency,
                            toBeing: $to_being,
                            toAvatar: $to_avatar,
                            toObject: $to_object
                        }]->(target)
                    """, source_id=object_id, target_id=target_id, relationship_id=relationship_id,
                        relationship_type=request.relationship_type, role=request.role, frequency=request.frequency or "Critical",
                        to_being=request.to_being, to_avatar=request.to_avatar, to_object=request.to_object)
                    print(f"DEBUG: Successfully created relationship to {target_result['object']}")
                except Exception as e:
                    print(f"DEBUG: Error creating relationship to {target_result['object']}: {e}")
            
            # Update relationship count - count total relationships (not distinct targets)
            # Multiple role words to same target = multiple relationships
            count_result = session.run("""
                MATCH (o:Object {id: $object_id})-[:RELATES_TO]->(other:Object)
                RETURN count(*) as rel_count
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

@router.put("/objects/{object_id}/relationships/update-target", response_model=Dict[str, Any])
async def update_relationships_to_target(
    object_id: str,
    target_being: str = Body(...),
    target_avatar: str = Body(...),
    target_object: str = Body(...),
    relationship_type: str = Body(...),
    frequency: str = Body(...)
):
    """Update type and frequency for all relationships from source object to a specific target object
    EXCEPT the default role word relationship (which always maintains its original properties)
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j.")
    
    try:
        with driver.session() as session:
            # Get source object name to identify default role word relationship
            source_obj = session.run("""
                MATCH (o:Object {id: $object_id})
                RETURN o.object as object_name
            """, object_id=object_id).single()
            
            source_object_name = source_obj["object_name"] if source_obj else ""
            default_role_word = source_object_name  # Default role word is the source object name
            
            # Find target object(s) matching the criteria
            where_conditions = []
            params = {"source_id": object_id, "relationship_type": relationship_type, "frequency": frequency, "default_role": default_role_word}
            
            if target_being != "ALL":
                where_conditions.append("target.being = $target_being")
                params["target_being"] = target_being
            
            if target_avatar != "ALL":
                where_conditions.append("target.avatar = $target_avatar")
                params["target_avatar"] = target_avatar
            
            if target_object != "ALL":
                where_conditions.append("target.object = $target_object")
                params["target_object"] = target_object
            
            where_clause = " AND ".join(where_conditions) if where_conditions else "true"
            
            # Update all relationships from source to target(s) with new type and frequency
            # CRITICAL: Exclude the default role word relationship - it should never be modified
            # The default role word relationship always maintains its original properties
            result = session.run(f"""
                MATCH (source:Object {{id: $source_id}})-[r:RELATES_TO]->(target:Object)
                WHERE {where_clause} AND r.role <> $default_role
                SET r.type = $relationship_type, r.frequency = $frequency
                RETURN count(r) as updated_count
            """, **params).single()
            
            updated_count = result["updated_count"] if result else 0
            
            # Update relationship count - count total relationships (not distinct targets)
            # Multiple role words to same target = multiple relationships
            count_result = session.run("""
                MATCH (o:Object {id: $object_id})-[:RELATES_TO]->(other:Object)
                RETURN count(*) as rel_count
            """, object_id=object_id).single()
            
            rel_count = count_result["rel_count"] if count_result else 0
            
            session.run("""
                MATCH (o:Object {id: $object_id})
                SET o.relationships = $rel_count
            """, object_id=object_id, rel_count=rel_count)
            
            return {
                "message": f"Successfully updated {updated_count} relationship(s)",
                "updated_count": updated_count
            }
    except Exception as e:
        print(f"Error updating relationships to target: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update relationships: {e}")

@router.post("/objects/bulk-relationships", response_model=Dict[str, Any])
async def bulk_create_relationships(request: BulkRelationshipCreateRequest = Body(...)):
    """Create multiple relationships for multiple source objects in bulk"""
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j.")
    
    try:
        with driver.session() as session:
            # First, validate all relationships and check for duplicates
            duplicates = []
            source_object_ids = set()
            relationships_to_create = []
            
            # Collect all source object IDs
            for rel in request.relationships:
                source_object_ids.add(rel.source_object_id)
            
            # Check for duplicates before creating
            # Duplicate = same (source object + target object + role word) combination
            # Multiple role words to the same target are allowed (each role word = separate relationship)
            for rel in request.relationships:
                # Find target objects matching the criteria
                where_conditions = []
                params = {}
                
                if rel.target_being != "ALL":
                    where_conditions.append("target.being = $to_being")
                    params["to_being"] = rel.target_being
                
                if rel.target_avatar != "ALL":
                    where_conditions.append("target.avatar = $to_avatar")
                    params["to_avatar"] = rel.target_avatar
                
                if rel.target_object != "ALL":
                    where_conditions.append("target.object = $to_object")
                    params["to_object"] = rel.target_object
                
                where_clause = " AND ".join(where_conditions) if where_conditions else "true"
                
                # Check for existing relationships with the SAME role words
                # We need to check each role word individually
                for role in rel.roles:
                    if not role or not role.strip():
                        continue
                    
                    check_query = f"""
                        MATCH (source:Object {{id: $source_id}})-[r:RELATES_TO]->(target:Object)
                        WHERE {where_clause} AND r.role = $role
                        RETURN source.id as source_id, target.object as target_object, target.being as target_being, 
                               target.avatar as target_avatar, r.role as existing_role
                        LIMIT 1
                    """
                    params_check = {**params, "source_id": rel.source_object_id, "role": role.strip()}
                    existing = session.run(check_query, **params_check).single()
                    
                    if existing:
                        duplicates.append({
                            "source_object_id": rel.source_object_id,
                            "target_object": f"{existing.get('target_being', '')} - {existing.get('target_avatar', '')} - {existing.get('target_object', 'Unknown')}",
                            "duplicate_role": existing.get("existing_role", role)
                        })
            
            # If duplicates found, return error with full list
            if duplicates:
                duplicate_messages = [
                    f"{dup['source_object_id']} → {dup['target_object']} (duplicate role: '{dup.get('duplicate_role', 'Unknown')}')"
                    for dup in duplicates
                ]
                raise HTTPException(
                    status_code=400,
                    detail=f"Duplicate relationship detected. The following relationships already exist:\n" + "\n".join(duplicate_messages)
                )
            
            # Validate that all target objects exist
            missing_objects = []
            for rel in request.relationships:
                where_conditions = []
                params = {}
                
                if rel.target_being != "ALL":
                    where_conditions.append("target.being = $to_being")
                    params["to_being"] = rel.target_being
                
                if rel.target_avatar != "ALL":
                    where_conditions.append("target.avatar = $to_avatar")
                    params["to_avatar"] = rel.target_avatar
                
                if rel.target_object != "ALL":
                    where_conditions.append("target.object = $to_object")
                    params["to_object"] = rel.target_object
                
                where_clause = " AND ".join(where_conditions) if where_conditions else "true"
                
                check_query = f"""
                    MATCH (target:Object)
                    WHERE {where_clause}
                    RETURN count(target) as count
                """
                result = session.run(check_query, **params).single()
                count = result["count"] if result else 0
                
                if count == 0:
                    missing_objects.append(f"{rel.target_being} - {rel.target_avatar} - {rel.target_object}")
            
            if missing_objects:
                raise HTTPException(
                    status_code=404,
                    detail=f"One or more objects in your CSV do not exist in the dataset:\n" + "\n".join(missing_objects)
                )
            
            # Create all relationships in a single transaction
            created_count = 0
            for rel in request.relationships:
                # Find target objects matching the criteria
                where_conditions = []
                params = {}
                
                if rel.target_being != "ALL":
                    where_conditions.append("target.being = $to_being")
                    params["to_being"] = rel.target_being
                
                if rel.target_avatar != "ALL":
                    where_conditions.append("target.avatar = $to_avatar")
                    params["to_avatar"] = rel.target_avatar
                
                if rel.target_object != "ALL":
                    where_conditions.append("target.object = $to_object")
                    params["to_object"] = rel.target_object
                
                where_clause = " AND ".join(where_conditions) if where_conditions else "true"
                
                query = f"""
                    MATCH (target:Object)
                    WHERE {where_clause}
                    RETURN target.id as target_id, target.being as being, target.avatar as avatar, target.object as object
                """
                
                target_results = session.run(query, **params).data()
                
                # Create relationships for each target and each role
                for target_result in target_results:
                    target_id = target_result["target_id"]
                    
                    # Determine relationship type based on Intra-Table logic
                    # If source and target are the same, use Intra-Table
                    # Otherwise use the specified type (default to Inter-Table if empty)
                    final_type = rel.relationship_type if rel.relationship_type else "Inter-Table"
                    if rel.source_object_id == target_id:
                        final_type = "Intra-Table"
                    
                    for role in rel.roles:
                        relationship_id = str(uuid.uuid4())
                        try:
                            session.run("""
                                MATCH (source:Object {id: $source_id})
                                MATCH (target:Object {id: $target_id})
                                CREATE (source)-[:RELATES_TO {
                                    id: $relationship_id,
                                    type: $relationship_type,
                                    role: $role,
                                    frequency: $frequency,
                                    toBeing: $to_being,
                                    toAvatar: $to_avatar,
                                    toObject: $to_object
                                }]->(target)
                            """, source_id=rel.source_object_id, target_id=target_id, relationship_id=relationship_id,
                                relationship_type=final_type, role=role, frequency=rel.frequency or "Critical",
                                to_being=rel.target_being, to_avatar=rel.target_avatar, to_object=rel.target_object)
                            created_count += 1
                        except Exception as e:
                            print(f"DEBUG: Error creating relationship: {e}")
            
            # Update relationship counts for all affected source objects
            # Count total relationships (not distinct targets) since multiple role words = multiple relationships
            for source_id in source_object_ids:
                count_result = session.run("""
                    MATCH (o:Object {id: $object_id})-[:RELATES_TO]->(other:Object)
                    RETURN count(*) as rel_count
                """, object_id=source_id).single()
                
                rel_count = count_result["rel_count"] if count_result else 0
                
                session.run("""
                    MATCH (o:Object {id: $object_id})
                    SET o.relationships = $rel_count
                """, object_id=source_id, rel_count=rel_count)
            
            return {
                "message": f"Successfully created {created_count} relationship(s)",
                "created_count": created_count
            }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating bulk relationships: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create bulk relationships: {e}")

@router.post("/objects/{target_object_id}/clone-relationships/{source_object_id}", response_model=Dict[str, Any])
async def clone_relationships(target_object_id: str, source_object_id: str):
    """
    Clone all relationships from a source object to a target object.
    Only works if the target object has no existing relationships.
    Handles intra-table relationships (self-referential) correctly.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j.")
    
    try:
        with driver.session() as session:
            # Check if target object exists
            target_check = session.run("""
                MATCH (o:Object {id: $object_id})
                RETURN o.id as id, o.object as object_name
            """, object_id=target_object_id).single()
            
            if not target_check:
                raise HTTPException(status_code=404, detail=f"Target object with ID {target_object_id} not found")
            
            # Check if source object exists
            source_check = session.run("""
                MATCH (o:Object {id: $object_id})
                RETURN o.id as id, o.object as object_name
            """, object_id=source_object_id).single()
            
            if not source_check:
                raise HTTPException(status_code=404, detail=f"Source object with ID {source_object_id} not found")
            
            # Check if target object already has relationships
            existing_rels_count = session.run("""
                MATCH (o:Object {id: $object_id})-[:RELATES_TO]->(other:Object)
                RETURN count(other) as rel_count
            """, object_id=target_object_id).single()
            
            if existing_rels_count and existing_rels_count["rel_count"] > 0:
                raise HTTPException(
                    status_code=400, 
                    detail="Target object already has relationships. Please delete existing relationships before cloning."
                )
            
            # Get all relationships from source object
            source_relationships = session.run("""
                MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object)
                RETURN r.id as relationship_id, r.type as type, r.role as role,
                       r.toBeing as toBeing, r.toAvatar as toAvatar, r.toObject as toObject,
                       target.id as target_object_id, target.being as target_being,
                       target.avatar as target_avatar, target.object as target_object
            """, source_id=source_object_id).data()
            
            if not source_relationships:
                return {
                    "message": "Source object has no relationships to clone",
                    "cloned_count": 0
                }
            
            print(f"DEBUG: Found {len(source_relationships)} relationships to clone from source object {source_object_id}")
            for i, rel in enumerate(source_relationships, 1):
                role_value = rel.get('role')
                role_type = type(role_value).__name__
                role_repr = repr(role_value)
                print(f"DEBUG: Relationship {i}/{len(source_relationships)}: {rel['type']} -> {rel['target_being']} - {rel['target_avatar']} - {rel['target_object']} (ID: {rel['target_object_id']})")
                print(f"DEBUG:   Role value: {role_repr} (type: {role_type}, is None: {role_value is None}, is empty string: {role_value == ''})")
            
            # Clone relationships
            cloned_count = 0
            failed_relationships = []
            for rel in source_relationships:
                relationship_type = rel["type"]
                role = rel.get("role") or ""  # Handle None/empty roles
                to_being = rel["toBeing"]
                to_avatar = rel["toAvatar"]
                to_object = rel["toObject"]
                target_obj_id = rel["target_object_id"]
                
                # Debug log to see role value
                print(f"DEBUG: Processing relationship with role: '{role}' (type: {type(role)}, is_empty: {not role})")
                
                # Check if this is an intra-table relationship (source relates to itself)
                is_intra_table = (source_object_id == target_obj_id)
                
                if is_intra_table:
                    # For intra-table relationships, create a self-referential relationship for the target object
                    relationship_id = str(uuid.uuid4())
                    try:
                        session.run("""
                            MATCH (target:Object {id: $target_id})
                            CREATE (target)-[:RELATES_TO {
                                id: $relationship_id,
                                type: $relationship_type,
                                role: $role,
                                frequency: $frequency,
                                toBeing: $to_being,
                                toAvatar: $to_avatar,
                                toObject: $to_object
                            }]->(target)
                        """, target_id=target_object_id, relationship_id=relationship_id,
                            relationship_type=relationship_type, role=role,
                            frequency=rel.get("frequency", "Critical"),
                            to_being=to_being, to_avatar=to_avatar, to_object=to_object)
                        cloned_count += 1
                    except Exception as e:
                        print(f"DEBUG: Error cloning intra-table relationship: {e}")
                else:
                    # For non-intra-table relationships, create relationship from target to the same target object
                    relationship_id = str(uuid.uuid4())
                    try:
                        # First verify both objects exist
                        target_check = session.run("""
                            MATCH (target:Object {id: $target_id})
                            RETURN target.id as id, target.object as object_name
                        """, target_id=target_object_id).single()
                        
                        if not target_check:
                            print(f"DEBUG: Target object {target_object_id} not found, skipping relationship")
                            continue
                        
                        target_obj_check = session.run("""
                            MATCH (target_obj:Object {id: $target_obj_id})
                            RETURN target_obj.id as id, target_obj.being as being, target_obj.avatar as avatar, target_obj.object as object_name
                        """, target_obj_id=target_obj_id).single()
                        
                        if not target_obj_check:
                            error_msg = f"Target object {target_obj_id} ({to_being} - {to_avatar} - {to_object}) not found, skipping relationship"
                            print(f"DEBUG: {error_msg}")
                            failed_relationships.append({
                                "target": f"{to_being} - {to_avatar} - {to_object}",
                                "reason": "Target object not found in database"
                            })
                            continue
                        
                        # Create the relationship and verify it was created
                        result = session.run("""
                            MATCH (target:Object {id: $target_id})
                            MATCH (target_obj:Object {id: $target_obj_id})
                            CREATE (target)-[r:RELATES_TO {
                                id: $relationship_id,
                                type: $relationship_type,
                                role: $role,
                                frequency: $frequency,
                                toBeing: $to_being,
                                toAvatar: $to_avatar,
                                toObject: $to_object
                            }]->(target_obj)
                            RETURN r.id as relationship_id
                        """, target_id=target_object_id, target_obj_id=target_obj_id,
                            relationship_id=relationship_id, relationship_type=relationship_type,
                            role=role, frequency=rel.get("frequency", "Critical"),
                            to_being=to_being, to_avatar=to_avatar, to_object=to_object)
                        
                        created_rel = result.single()
                        if created_rel and created_rel.get("relationship_id"):
                            cloned_count += 1
                            print(f"DEBUG: Successfully cloned relationship from {target_object_id} to {target_obj_id} ({to_being} - {to_avatar} - {to_object}) with role '{role}'")
                        else:
                            error_msg = f"Failed to create relationship from {target_object_id} to {target_obj_id} ({to_being} - {to_avatar} - {to_object}) - CREATE returned no result"
                            print(f"DEBUG: {error_msg}")
                            failed_relationships.append({
                                "target": f"{to_being} - {to_avatar} - {to_object}",
                                "reason": "CREATE query returned no result"
                            })
                    except Exception as e:
                        error_msg = f"Error cloning relationship to {target_obj_id} ({to_being} - {to_avatar} - {to_object}): {e}"
                        print(f"DEBUG: {error_msg}")
                        failed_relationships.append({
                            "target": f"{to_being} - {to_avatar} - {to_object}",
                            "reason": str(e)
                        })
                        import traceback
                        traceback.print_exc()
            
            # Update relationship count for target object
            count_result = session.run("""
                MATCH (o:Object {id: $object_id})-[:RELATES_TO]->(other:Object)
                RETURN count(other) as rel_count
            """, object_id=target_object_id).single()
            
            rel_count = count_result["rel_count"] if count_result else 0
            
            session.run("""
                MATCH (o:Object {id: $object_id})
                SET o.relationships = $rel_count
            """, object_id=target_object_id, rel_count=rel_count)
            
            response = {
                "message": f"Successfully cloned {cloned_count} relationship(s)",
                "cloned_count": cloned_count,
                "total_source_relationships": len(source_relationships)
            }
            
            if failed_relationships:
                response["failed_relationships"] = failed_relationships
                response["message"] += f" ({len(failed_relationships)} failed)"
            
            return response
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error cloning relationships: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clone relationships: {e}")

@router.post("/objects/bulk-clone-relationships/{source_object_id}", response_model=Dict[str, Any])
async def bulk_clone_relationships(source_object_id: str, target_object_ids: List[str] = Body(...)):
    """
    Clone all relationships from a source object to multiple target objects.
    Only works if all target objects have no existing relationships.
    Handles intra-table relationships (self-referential) correctly for each target.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j.")
    
    try:
        with driver.session() as session:
            # Check if source object exists
            source_check = session.run("""
                MATCH (o:Object {id: $object_id})
                RETURN o.id as id, o.object as object_name
            """, object_id=source_object_id).single()
            
            if not source_check:
                raise HTTPException(status_code=404, detail=f"Source object with ID {source_object_id} not found")
            
            if not target_object_ids:
                raise HTTPException(status_code=400, detail="At least one target object ID must be provided")
            
            # Check if all target objects exist and have no relationships
            target_objects_info = []
            for target_id in target_object_ids:
                target_check = session.run("""
                    MATCH (o:Object {id: $object_id})
                    RETURN o.id as id, o.object as object_name
                """, object_id=target_id).single()
                
                if not target_check:
                    raise HTTPException(status_code=404, detail=f"Target object with ID {target_id} not found")
                
                # Check if target object already has relationships
                existing_rels_count = session.run("""
                    MATCH (o:Object {id: $object_id})-[:RELATES_TO]->(other:Object)
                    RETURN count(other) as rel_count
                """, object_id=target_id).single()
                
                if existing_rels_count and existing_rels_count["rel_count"] > 0:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Target object '{target_check['object_name']}' (ID: {target_id}) already has relationships. Please delete existing relationships before cloning."
                    )
                
                target_objects_info.append({
                    "id": target_id,
                    "name": target_check["object_name"]
                })
            
            # Get all relationships from source object
            source_relationships = session.run("""
                MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object)
                RETURN r.id as relationship_id, r.type as type, r.role as role, r.frequency as frequency,
                       r.toBeing as toBeing, r.toAvatar as toAvatar, r.toObject as toObject,
                       target.id as target_object_id, target.being as target_being,
                       target.avatar as target_avatar, target.object as target_object
            """, source_id=source_object_id).data()
            
            if not source_relationships:
                return {
                    "message": "Source object has no relationships to clone",
                    "cloned_count": 0,
                    "total_targets": len(target_object_ids)
                }
            
            print(f"DEBUG: Bulk cloning {len(source_relationships)} relationships from source {source_object_id} to {len(target_object_ids)} target objects")
            
            # Clone relationships to each target object
            total_cloned = 0
            failed_relationships = []
            results_by_target = {}
            
            for target_info in target_objects_info:
                target_object_id = target_info["id"]
                target_name = target_info["name"]
                cloned_count = 0
                target_failed = []
                
                for rel in source_relationships:
                    relationship_type = rel["type"]
                    role = rel.get("role") or ""
                    to_being = rel["toBeing"]
                    to_avatar = rel["toAvatar"]
                    to_object = rel["toObject"]
                    target_obj_id = rel["target_object_id"]
                    
                    # Check if this is an intra-table relationship (source relates to itself)
                    is_intra_table = (source_object_id == target_obj_id)
                    
                    if is_intra_table:
                        # For intra-table relationships, create a self-referential relationship for each target object
                        relationship_id = str(uuid.uuid4())
                        try:
                            result = session.run("""
                                MATCH (target:Object {id: $target_id})
                                CREATE (target)-[r:RELATES_TO {
                                    id: $relationship_id,
                                    type: $relationship_type,
                                    role: $role,
                                    frequency: $frequency,
                                    toBeing: $to_being,
                                    toAvatar: $to_avatar,
                                    toObject: $to_object
                                }]->(target)
                                RETURN r.id as relationship_id
                            """, target_id=target_object_id, relationship_id=relationship_id,
                                relationship_type=relationship_type, role=role,
                                frequency=rel.get("frequency", "Critical"),
                                to_being=to_being, to_avatar=to_avatar, to_object=to_object)
                            
                            created_rel = result.single()
                            if created_rel and created_rel.get("relationship_id"):
                                cloned_count += 1
                            else:
                                target_failed.append({
                                    "target": f"{to_being} - {to_avatar} - {to_object}",
                                    "reason": "CREATE returned no result (intra-table)"
                                })
                        except Exception as e:
                            target_failed.append({
                                "target": f"{to_being} - {to_avatar} - {to_object}",
                                "reason": str(e)
                            })
                            print(f"DEBUG: Error cloning intra-table relationship for {target_name}: {e}")
                    else:
                        # For non-intra-table relationships, create relationship from target to the same target object
                        relationship_id = str(uuid.uuid4())
                        try:
                            # Verify target object exists
                            target_obj_check = session.run("""
                                MATCH (target_obj:Object {id: $target_obj_id})
                                RETURN target_obj.id as id
                            """, target_obj_id=target_obj_id).single()
                            
                            if not target_obj_check:
                                target_failed.append({
                                    "target": f"{to_being} - {to_avatar} - {to_object}",
                                    "reason": "Target object not found in database"
                                })
                                continue
                            
                            result = session.run("""
                                MATCH (target:Object {id: $target_id})
                                MATCH (target_obj:Object {id: $target_obj_id})
                                CREATE (target)-[r:RELATES_TO {
                                    id: $relationship_id,
                                    type: $relationship_type,
                                    role: $role,
                                    frequency: $frequency,
                                    toBeing: $to_being,
                                    toAvatar: $to_avatar,
                                    toObject: $to_object
                                }]->(target_obj)
                                RETURN r.id as relationship_id
                            """, target_id=target_object_id, target_obj_id=target_obj_id,
                                relationship_id=relationship_id, relationship_type=relationship_type,
                                role=role, frequency=rel.get("frequency", "Critical"),
                                to_being=to_being, to_avatar=to_avatar, to_object=to_object)
                            
                            created_rel = result.single()
                            if created_rel and created_rel.get("relationship_id"):
                                cloned_count += 1
                            else:
                                target_failed.append({
                                    "target": f"{to_being} - {to_avatar} - {to_object}",
                                    "reason": "CREATE returned no result"
                                })
                        except Exception as e:
                            target_failed.append({
                                "target": f"{to_being} - {to_avatar} - {to_object}",
                                "reason": str(e)
                            })
                            print(f"DEBUG: Error cloning relationship for {target_name}: {e}")
                
                # Update relationship count for this target object
                count_result = session.run("""
                    MATCH (o:Object {id: $object_id})-[:RELATES_TO]->(other:Object)
                    RETURN count(other) as rel_count
                """, object_id=target_object_id).single()
                
                rel_count = count_result["rel_count"] if count_result else 0
                
                session.run("""
                    MATCH (o:Object {id: $object_id})
                    SET o.relationships = $rel_count
                """, object_id=target_object_id, rel_count=rel_count)
                
                total_cloned += cloned_count
                results_by_target[target_name] = {
                    "cloned_count": cloned_count,
                    "failed_count": len(target_failed)
                }
                
                if target_failed:
                    failed_relationships.extend([{**f, "target_object": target_name} for f in target_failed])
            
            response = {
                "message": f"Successfully cloned relationships to {len(target_object_ids)} object(s). Total relationships created: {total_cloned}",
                "cloned_count": total_cloned,
                "total_targets": len(target_object_ids),
                "total_source_relationships": len(source_relationships),
                "results_by_target": results_by_target
            }
            
            if failed_relationships:
                response["failed_relationships"] = failed_relationships
                response["message"] += f" ({len(failed_relationships)} failed)"
            
            return response
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error bulk cloning relationships: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to bulk clone relationships: {e}")

@router.post("/objects/{target_object_id}/clone-identifiers/{source_object_id}", response_model=Dict[str, Any])
async def clone_identifiers(target_object_id: str, source_object_id: str):
    """
    Clone all identifiers (unique IDs and composite IDs) from a source object to a target object.
    Only works if the target object has no existing identifiers.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j.")
    
    try:
        with driver.session() as session:
            # Check if target object exists
            target_check = session.run("""
                MATCH (o:Object {id: $object_id})
                RETURN o.id as id, o.object as object_name
            """, object_id=target_object_id).single()
            
            if not target_check:
                raise HTTPException(status_code=404, detail=f"Target object with ID {target_object_id} not found")
            
            # Check if source object exists
            source_check = session.run("""
                MATCH (o:Object {id: $object_id})
                RETURN o.id as id, o.object as object_name
            """, object_id=source_object_id).single()
            
            if not source_check:
                raise HTTPException(status_code=404, detail=f"Source object with ID {source_object_id} not found")
            
            # Check if target object already has identifiers
            unique_id_count = session.run("""
                MATCH (o:Object {id: $object_id})-[:HAS_UNIQUE_ID|HAS_DISCRETE_ID]->(:Variable)
                RETURN count(*) as count
            """, object_id=target_object_id).single()
            
            composite_id_count = session.run("""
                MATCH (o:Object {id: $object_id})-[r:HAS_COMPOSITE_ID_1|HAS_COMPOSITE_ID_2|HAS_COMPOSITE_ID_3|HAS_COMPOSITE_ID_4|HAS_COMPOSITE_ID_5]->(:Variable)
                RETURN count(*) as count
            """, object_id=target_object_id).single()
            
            total_existing = (unique_id_count["count"] if unique_id_count else 0) + (composite_id_count["count"] if composite_id_count else 0)
            
            if total_existing > 0:
                raise HTTPException(
                    status_code=400, 
                    detail="Target object already has identifiers. Please delete existing identifiers before cloning."
                )
            
            # Get unique ID relationships from source object
            unique_id_result = session.run("""
                MATCH (source:Object {id: $source_id})-[:HAS_UNIQUE_ID|HAS_DISCRETE_ID]->(v:Variable)
                RETURN v.id as variableId
            """, source_id=source_object_id).data()
            
            # Get composite ID relationships from source object
            composite_ids_data = {}
            for i in range(1, 6):
                composite_result = session.run(f"""
                    MATCH (source:Object {{id: $source_id}})-[:HAS_COMPOSITE_ID_{i}]->(v:Variable)
                    MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v)
                    RETURN v.id as variableId, p.name as part, g.name as group
                """, source_id=source_object_id).data()
                
                if composite_result:
                    # Get the part and group from the first result (they should all be the same for a given composite ID)
                    first_record = composite_result[0]
                    part = first_record.get("part", "")
                    group = first_record.get("group", "")
                    variable_ids = [record["variableId"] for record in composite_result]
                    composite_ids_data[str(i)] = {
                        "part": part,
                        "group": group,
                        "variables": variable_ids
                    }
            
            cloned_unique_count = 0
            cloned_composite_count = 0
            
            # Clone unique IDs
            for record in unique_id_result:
                variable_id = record["variableId"]
                if variable_id:
                    try:
                        session.run("""
                            MATCH (target:Object {id: $target_id})
                            MATCH (v:Variable {id: $var_id})
                            MERGE (target)-[:HAS_UNIQUE_ID]->(v)
                        """, target_id=target_object_id, var_id=variable_id)
                        cloned_unique_count += 1
                    except Exception as e:
                        print(f"DEBUG: Error cloning unique ID {variable_id}: {e}")
            
            # Clone composite IDs
            for composite_index, composite_data in composite_ids_data.items():
                part = composite_data["part"]
                group = composite_data["group"]
                variable_ids = composite_data["variables"]
                
                if part and group and variable_ids:
                    for var_id in variable_ids:
                        if var_id:
                            try:
                                session.run(f"""
                                    MATCH (target:Object {{id: $target_id}})
                                    MATCH (v:Variable {{id: $var_id}})
                                    MERGE (target)-[:HAS_COMPOSITE_ID_{composite_index}]->(v)
                                """, target_id=target_object_id, var_id=var_id)
                                cloned_composite_count += 1
                            except Exception as e:
                                print(f"DEBUG: Error cloning composite ID {composite_index} variable {var_id}: {e}")
            
            return {
                "message": f"Successfully cloned identifiers: {cloned_unique_count} unique ID(s), {cloned_composite_count} composite ID relationship(s)",
                "cloned_unique_count": cloned_unique_count,
                "cloned_composite_count": cloned_composite_count,
                "total_cloned": cloned_unique_count + cloned_composite_count
            }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error cloning identifiers: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clone identifiers: {e}")

@router.post("/objects/bulk-clone-identifiers/{source_object_id}", response_model=Dict[str, Any])
async def bulk_clone_identifiers(source_object_id: str, target_object_ids: List[str] = Body(...)):
    """
    Clone all identifiers (unique IDs and composite IDs) from a source object to multiple target objects.
    Only works if all target objects have no existing identifiers.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j.")
    
    try:
        with driver.session() as session:
            # Check if source object exists
            source_check = session.run("""
                MATCH (o:Object {id: $object_id})
                RETURN o.id as id, o.object as object_name
            """, object_id=source_object_id).single()
            
            if not source_check:
                raise HTTPException(status_code=404, detail=f"Source object with ID {source_object_id} not found")
            
            if not target_object_ids:
                raise HTTPException(status_code=400, detail="At least one target object ID must be provided")
            
            # Check if all target objects exist and have no identifiers
            target_objects_info = []
            for target_id in target_object_ids:
                target_check = session.run("""
                    MATCH (o:Object {id: $object_id})
                    RETURN o.id as id, o.object as object_name
                """, object_id=target_id).single()
                
                if not target_check:
                    raise HTTPException(status_code=404, detail=f"Target object with ID {target_id} not found")
                
                # Check if target object already has identifiers
                unique_id_count = session.run("""
                    MATCH (o:Object {id: $object_id})-[:HAS_UNIQUE_ID|HAS_DISCRETE_ID]->(:Variable)
                    RETURN count(*) as count
                """, object_id=target_id).single()
                
                composite_id_count = session.run("""
                    MATCH (o:Object {id: $object_id})-[r:HAS_COMPOSITE_ID_1|HAS_COMPOSITE_ID_2|HAS_COMPOSITE_ID_3|HAS_COMPOSITE_ID_4|HAS_COMPOSITE_ID_5]->(:Variable)
                    RETURN count(*) as count
                """, object_id=target_id).single()
                
                total_existing = (unique_id_count["count"] if unique_id_count else 0) + (composite_id_count["count"] if composite_id_count else 0)
                
                if total_existing > 0:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Target object '{target_check['object_name']}' (ID: {target_id}) already has identifiers. Please delete existing identifiers before cloning."
                    )
                
                target_objects_info.append({
                    "id": target_id,
                    "name": target_check["object_name"]
                })
            
            # Get unique ID relationships from source object
            unique_id_result = session.run("""
                MATCH (source:Object {id: $source_id})-[:HAS_UNIQUE_ID|HAS_DISCRETE_ID]->(v:Variable)
                RETURN v.id as variableId
            """, source_id=source_object_id).data()
            
            # Get composite ID relationships from source object
            composite_ids_data = {}
            for i in range(1, 6):
                composite_result = session.run(f"""
                    MATCH (source:Object {{id: $source_id}})-[:HAS_COMPOSITE_ID_{i}]->(v:Variable)
                    MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v)
                    RETURN v.id as variableId, p.name as part, g.name as group
                """, source_id=source_object_id).data()
                
                if composite_result:
                    # Get the part and group from the first result (they should all be the same for a given composite ID)
                    first_record = composite_result[0]
                    part = first_record.get("part", "")
                    group = first_record.get("group", "")
                    variable_ids = [record["variableId"] for record in composite_result]
                    composite_ids_data[str(i)] = {
                        "part": part,
                        "group": group,
                        "variables": variable_ids
                    }
            
            print(f"DEBUG: Bulk cloning identifiers from source {source_object_id} to {len(target_object_ids)} target objects")
            print(f"DEBUG: Source has {len(unique_id_result)} unique IDs and {len(composite_ids_data)} composite ID types")
            
            # Clone identifiers to each target object
            total_cloned_unique = 0
            total_cloned_composite = 0
            results_by_target = {}
            
            for target_info in target_objects_info:
                target_object_id = target_info["id"]
                target_name = target_info["name"]
                cloned_unique_count = 0
                cloned_composite_count = 0
                
                # Clone unique IDs
                for record in unique_id_result:
                    variable_id = record["variableId"]
                    if variable_id:
                        try:
                            session.run("""
                                MATCH (target:Object {id: $target_id})
                                MATCH (v:Variable {id: $var_id})
                                MERGE (target)-[:HAS_UNIQUE_ID]->(v)
                            """, target_id=target_object_id, var_id=variable_id)
                            cloned_unique_count += 1
                        except Exception as e:
                            print(f"DEBUG: Error cloning unique ID {variable_id} for {target_name}: {e}")
                
                # Clone composite IDs
                for composite_index, composite_data in composite_ids_data.items():
                    part = composite_data["part"]
                    group = composite_data["group"]
                    variable_ids = composite_data["variables"]
                    
                    if part and group and variable_ids:
                        for var_id in variable_ids:
                            if var_id:
                                try:
                                    session.run(f"""
                                        MATCH (target:Object {{id: $target_id}})
                                        MATCH (v:Variable {{id: $var_id}})
                                        MERGE (target)-[:HAS_COMPOSITE_ID_{composite_index}]->(v)
                                    """, target_id=target_object_id, var_id=var_id)
                                    cloned_composite_count += 1
                                except Exception as e:
                                    print(f"DEBUG: Error cloning composite ID {composite_index} variable {var_id} for {target_name}: {e}")
                
                total_cloned_unique += cloned_unique_count
                total_cloned_composite += cloned_composite_count
                results_by_target[target_name] = {
                    "cloned_unique_count": cloned_unique_count,
                    "cloned_composite_count": cloned_composite_count
                }
            
            response = {
                "message": f"Successfully cloned identifiers to {len(target_object_ids)} object(s). Total: {total_cloned_unique} unique ID(s), {total_cloned_composite} composite ID relationship(s)",
                "cloned_unique_count": total_cloned_unique,
                "cloned_composite_count": total_cloned_composite,
                "total_cloned": total_cloned_unique + total_cloned_composite,
                "total_targets": len(target_object_ids),
                "results_by_target": results_by_target
            }
            
            return response
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error bulk cloning identifiers: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to bulk clone identifiers: {e}")

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
            
            global_variants = {record["name"].lower(): {"id": record["id"], "original_name": record["name"]} for record in global_variants_result}
            print(f"DEBUG: Found {len(global_variants)} global variants: {list(global_variants.keys())}")
            
            # Track variants within this CSV upload to detect duplicates within the file
            csv_variant_names = set()
            
            for row_num, row in enumerate(rows, start=2):
                # Get variant name from the row
                variant_name = row.get('Variant', '').strip()
                if not variant_name:
                    errors.append(f"Row {row_num}: Variant name is required")
                    continue
                
                # Check for duplicates within the CSV file itself (case-insensitive)
                if variant_name.lower() in csv_variant_names:
                    errors.append(f"Row {row_num}: Duplicate variant name '{variant_name}' found within the CSV file")
                    continue
                
                # Check for duplicates (case-insensitive) - only for this specific object
                if variant_name.lower() in existing_variant_names:
                    skipped_count += 1
                    print(f"Skipping duplicate variant for this object: {variant_name}")
                    continue
                
                # Add to CSV tracking set
                csv_variant_names.add(variant_name.lower())
                
                # Check if variant exists globally using our pre-loaded data (case-insensitive)
                if variant_name.lower() in global_variants:
                    # Variant exists globally, just connect it to this object
                    print(f"Connecting existing global variant to object: {variant_name}")
                    
                    variant_id = global_variants[variant_name.lower()]["id"]
                    
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

@router.post("/objects/{object_id}/relationships/upload", response_model=CSVUploadResponse)
async def bulk_upload_relationships(object_id: str, file: UploadFile = File(...)):
    """Bulk upload relationships for an object from CSV file"""
    print(f"DEBUG: bulk_upload_relationships called with object_id={object_id}, file={file.filename}")
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
        print(f"DEBUG: CSV headers: {headers}")
        
        # Validate required columns
        required_columns = ['Type', 'Role', 'to Being', 'to Avatar', 'to Object']
        missing_columns = [col for col in required_columns if col not in headers]
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"CSV must contain columns: {', '.join(required_columns)}. Missing: {', '.join(missing_columns)}"
            )
        
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
                    
        print(f"DEBUG: Parsed {len(rows)} relationship rows from CSV")
        
    except Exception as e:
        print(f"Error in CSV parsing: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"CSV parsing error: {str(e)}")
    
    # Database operations
    created_relationships = []
    errors = []
    skipped_count = 0
    
    try:
        with driver.session() as session:
            print(f"DEBUG: Starting session for object {object_id}")
            
            # Verify the source object exists
            source_check = session.run("""
                MATCH (o:Object {id: $object_id})
                RETURN o.id as id, o.being as being, o.avatar as avatar, o.object as object
            """, object_id=object_id).single()
            
            if not source_check:
                raise HTTPException(status_code=404, detail=f"Object with ID {object_id} not found")
            
            print(f"DEBUG: Source object: {source_check['being']}, {source_check['avatar']}, {source_check['object']}")
            
            # First, deduplicate CSV rows to prevent processing identical relationships multiple times
            unique_rows = []
            seen_relationships = set()
            duplicate_csv_rows = 0
            
            for row_num, row in enumerate(rows, start=2):
                # Create a unique key for this relationship
                relationship_key = (
                    row.get('Type', '').strip(),
                    row.get('Role', '').strip(),
                    row.get('to Being', '').strip(),
                    row.get('to Avatar', '').strip(),
                    row.get('to Object', '').strip()
                )
                
                if relationship_key not in seen_relationships:
                    seen_relationships.add(relationship_key)
                    unique_rows.append((row_num, row))
                else:
                    duplicate_csv_rows += 1
                    print(f"DEBUG: Row {row_num}: Skipping duplicate CSV row")
            
            if duplicate_csv_rows > 0:
                print(f"DEBUG: Found {duplicate_csv_rows} duplicate CSV rows, processing {len(unique_rows)} unique rows")
            
            # Process each unique relationship row
            for row_num, row in unique_rows:
                try:
                    # Validate required fields
                    relationship_type = row.get('Type', '').strip()
                    role = row.get('Role', '').strip()
                    to_being = row.get('to Being', '').strip()
                    to_avatar = row.get('to Avatar', '').strip()
                    to_object = row.get('to Object', '').strip()
                    
                    # Basic field validation
                    print(f"DEBUG: Row {row_num}: Processing relationship - Type: '{relationship_type}', Role: '{role}', To Being: '{to_being}', To Avatar: '{to_avatar}', To Object: '{to_object}'")
                    
                    if relationship_type not in ['Blood', 'Inter-Table', 'Intra-Table']:
                        errors.append(f"Row {row_num}: Type must be 'Blood', 'Inter-Table', or 'Intra-Table'. Got: '{relationship_type}'")
                        continue
                    
                    if not role:
                        errors.append(f"Row {row_num}: Role cannot be empty")
                        continue
                    
                    if not to_being or not to_avatar or not to_object:
                        errors.append(f"Row {row_num}: To Being, To Avatar, and To Object cannot be empty")
                        continue
                    
                    # ✅ 1. Type-Specific Validation Rules
                    if relationship_type == 'Intra-Table':
                        print(f"DEBUG: Row {row_num}: Intra-Table validation - Source: {source_check['being']}, {source_check['avatar']}, {source_check['object']}")
                        print(f"DEBUG: Row {row_num}: Intra-Table validation - Target: {to_being}, {to_avatar}, {to_object}")
                        
                        # Intra-Table: Must match the current object's own details
                        if (to_being != source_check['being'] or 
                            to_avatar != source_check['avatar'] or 
                            to_object != source_check['object']):
                            error_msg = f"Row {row_num}: Invalid Intra-Table relationship: self-references must match the object's own Being, Avatar, and Object. Expected: {source_check['being']}, {source_check['avatar']}, {source_check['object']}. Got: {to_being}, {to_avatar}, {to_object}"
                            print(f"DEBUG: {error_msg}")
                            errors.append(error_msg)
                            continue
                        
                        # For Intra-Table, target is the source object itself
                        target_id = object_id
                        target_being = source_check['being']
                        target_avatar = source_check['avatar']
                        target_object = source_check['object']
                        
                    elif relationship_type == 'Inter-Table':
                        # Inter-Table: Must NOT match the current object's own values
                        if (to_being == source_check['being'] and 
                            to_avatar == source_check['avatar'] and 
                            to_object == source_check['object']):
                            errors.append(f"Row {row_num}: Invalid Inter-Table relationship: relationship points to itself. Use Intra-Table instead.")
                            continue
                        
                        # Find target objects that match the criteria
                        target_results = session.run("""
                            MATCH (target:Object)
                            WHERE target.being = $to_being 
                            AND target.avatar = $to_avatar 
                            AND target.object = $to_object
                            RETURN target.id as target_id, target.being as being, target.avatar as avatar, target.object as object
                        """, to_being=to_being, to_avatar=to_avatar, to_object=to_object).data()
                        
                        if not target_results:
                            errors.append(f"Row {row_num}: Target object '{to_object}' (Being = {to_being}, Avatar = {to_avatar}) not found in graph.")
                            continue
                        
                        # Use first match and ensure it's not the same object
                        target_result = target_results[0]
                        if target_result['target_id'] == object_id:
                            errors.append(f"Row {row_num}: Invalid Inter-Table relationship: cannot create relationship to itself. Use Intra-Table instead.")
                            continue
                        
                        target_id = target_result['target_id']
                        target_being = target_result['being']
                        target_avatar = target_result['avatar']
                        target_object = target_result['object']
                        
                    elif relationship_type == 'Blood':
                        # Blood: Must correspond to existing, distinct nodes (not itself)
                        target_results = session.run("""
                            MATCH (target:Object)
                            WHERE target.being = $to_being 
                            AND target.avatar = $to_avatar 
                            AND target.object = $to_object
                            RETURN target.id as target_id, target.being as being, target.avatar as avatar, target.object as object
                        """, to_being=to_being, to_avatar=to_avatar, to_object=to_object).data()
                        
                        if not target_results:
                            errors.append(f"Row {row_num}: Target object '{to_object}' (Being = {to_being}, Avatar = {to_avatar}) not found in graph.")
                            continue
                        
                        # Use first match and ensure it's not the same object
                        target_result = target_results[0]
                        if target_result['target_id'] == object_id:
                            errors.append(f"Row {row_num}: Invalid Blood relationship: cannot create relationship to itself.")
                            continue
                        
                        target_id = target_result['target_id']
                        target_being = target_result['being']
                        target_avatar = target_result['avatar']
                        target_object = target_result['object']
                    
                    # ✅ 2. General Relationship Integrity Rules
                    # Check for existing relationship to prevent duplicates
                    existing_relationship = session.run("""
                        MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object {id: $target_id})
                        WHERE r.role = $role
                        RETURN r.id as relationship_id
                    """, source_id=object_id, target_id=target_id, role=role).single()
                    
                    if existing_relationship:
                        print(f"DEBUG: Row {row_num}: Skipping duplicate relationship with role '{role}' to {target_object}")
                        errors.append(f"Row {row_num}: Duplicate relationship detected. A relationship with role '{role}' to {target_object} already exists.")
                        skipped_count += 1
                        continue
                    
                    # Create the relationship
                    relationship_id = str(uuid.uuid4())
                    print(f"DEBUG: Row {row_num}: Creating {relationship_type} relationship from {source_check['object']} to {target_object} with role '{role}'")
                    
                    session.run("""
                        MATCH (source:Object {id: $source_id})
                        MATCH (target:Object {id: $target_id})
                        CREATE (source)-[:RELATES_TO {
                            id: $relationship_id,
                            type: $relationship_type,
                            role: $role,
                            frequency: $frequency,
                            toBeing: $to_being,
                            toAvatar: $to_avatar,
                            toObject: $to_object
                        }]->(target)
                    """, source_id=object_id, target_id=target_id, relationship_id=relationship_id,
                        relationship_type=relationship_type, role=role, frequency="Critical",
                        to_being=to_being, to_avatar=to_avatar, to_object=to_object)
                    
                    created_relationships.append({
                        "id": relationship_id,
                        "type": relationship_type,
                        "role": role,
                        "toBeing": target_being,
                        "toAvatar": target_avatar,
                        "toObject": target_object
                    })
                    
                    print(f"DEBUG: Row {row_num}: Successfully created relationship")
                    
                except Exception as row_error:
                    print(f"DEBUG: Row {row_num}: Error processing row: {row_error}")
                    errors.append(f"Row {row_num}: Error processing relationship - {str(row_error)}")
                    continue
            
            # Update relationship count for the source object
            count_result = session.run("""
                MATCH (o:Object {id: $object_id})-[:RELATES_TO]->(other:Object)
                RETURN count(other) as rel_count
            """, object_id=object_id).single()
            
            rel_count = count_result["rel_count"] if count_result else 0
            
            session.run("""
                MATCH (o:Object {id: $object_id})
                SET o.relationships = $rel_count
            """, object_id=object_id, rel_count=rel_count)
            
            print(f"DEBUG: Updated relationship count to {rel_count}")
            
    except Exception as session_error:
        print(f"Error in database session: {session_error}")
        import traceback
        traceback.print_exc()
        errors.append(f"Database session error: {str(session_error)}")

    # Build success message with all relevant information
    message_parts = [f"Successfully created {len(created_relationships)} relationships"]
    
    if skipped_count > 0:
        message_parts.append(f"Skipped {skipped_count} existing duplicates")
    
    if duplicate_csv_rows > 0:
        message_parts.append(f"Removed {duplicate_csv_rows} duplicate CSV rows")
    
    success_message = ". ".join(message_parts) + "."
    
    # If there are errors (including duplicates), we should still return success=False
    # to ensure the frontend shows the error messages
    if errors:
        return CSVUploadResponse(
            success=False,
            message=success_message + f" However, {len(errors)} issues were encountered.",
            created_count=len(created_relationships),
            error_count=len(errors),
            errors=errors
        )
    
    return CSVUploadResponse(
        success=True,
        message=success_message,
        created_count=len(created_relationships),
        error_count=len(errors),
        errors=errors
    )

