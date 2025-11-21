from fastapi import APIRouter, HTTPException, Query, Body
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from db import get_driver
from neo4j.graph import Node, Relationship, Path

router = APIRouter()

class GraphQueryRequest(BaseModel):
    query: str

@router.get("/ontology/view")
async def get_ontology_view(
    object_id: Optional[str] = Query(None, description="ID of the object (preferred for distinct objects)"),
    object_name: Optional[str] = Query(None, description="Name of the object (fallback for backward compatibility)"),
    view: str = Query(..., description="Type of ontology view: drivers, ontology, identifiers, relationships, variants")
):
    """
    Get ontology view for a specific object and section.
    Maps view type to appropriate Cypher query.
    Uses object_id if provided (for distinct objects), otherwise falls back to object_name.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Neo4j driver not available")
    
    if not object_id and not object_name:
        raise HTTPException(status_code=400, detail="Either object_id or object_name must be provided")
    
    # Define Cypher queries for each view type - use object_id if available, otherwise object_name
    if object_id:
        # Match by distinct object ID - optimized for speed
        queries = {
            'drivers': """
                MATCH (o:Object {id: $object_id})
                WITH o
                OPTIONAL MATCH (s:Sector)-[r1:RELEVANT_TO]->(o)
                WITH o, s, r1
                OPTIONAL MATCH (d:Domain)-[r2:RELEVANT_TO]->(o)
                WITH o, s, r1, d, r2
                OPTIONAL MATCH (c:Country)-[r3:RELEVANT_TO]->(o)
                WITH o, s, r1, d, r2, c, r3
                OPTIONAL MATCH (oc:ObjectClarifier)-[r4:RELEVANT_TO]->(o)
                RETURN s, r1, d, r2, c, r3, oc, r4, o
            """,
            'ontology': """
                MATCH (b:Being)-[r1:HAS_AVATAR]->(a:Avatar)-[r2:HAS_OBJECT]->(o:Object {id: $object_id})
                RETURN b, r1, a, r2, o
            """,
            'identifiers': """
                MATCH (o:Object {id: $object_id})
                WITH o
                OPTIONAL MATCH (o)-[r1:HAS_DISCRETE_ID]->(v1:Variable)
                OPTIONAL MATCH (v1)<-[r4a:HAS_VARIABLE]-(g1:Group)
                OPTIONAL MATCH (g1)<-[r5a:HAS_GROUP]-(p1:Part)
                WITH o, v1, r1, g1, p1, r4a, r5a
                OPTIONAL MATCH (o)-[r2:HAS_COMPOSITE_ID_1|HAS_COMPOSITE_ID_2|HAS_COMPOSITE_ID_3|HAS_COMPOSITE_ID_4|HAS_COMPOSITE_ID_5]->(v2:Variable)
                OPTIONAL MATCH (v2)<-[r4b:HAS_VARIABLE]-(g2:Group)
                OPTIONAL MATCH (g2)<-[r5b:HAS_GROUP]-(p2:Part)
                WITH o, v1, r1, g1, p1, r4a, r5a, v2, r2, g2, p2, r4b, r5b
                OPTIONAL MATCH (o)-[r3:HAS_UNIQUE_ID]->(v3:Variable)
                OPTIONAL MATCH (v3)<-[r4c:HAS_VARIABLE]-(g3:Group)
                OPTIONAL MATCH (g3)<-[r5c:HAS_GROUP]-(p3:Part)
                RETURN o, v1, r1, g1, p1, r4a, r5a, v2, r2, g2, p2, r4b, r5b, v3, r3, g3, p3, r4c, r5c
            """,
            'relationships': """
                MATCH (o:Object {id: $object_id})-[r:RELATES_TO]->(o2:Object)
                RETURN o, r, o2
            """,
            'variants': """
                MATCH (o:Object {id: $object_id})
                OPTIONAL MATCH (o)-[r:HAS_VARIANT]->(v:Variant)
                RETURN o, r, v
                ORDER BY v.name
            """
        }
        query_param = object_id
        param_name = 'object_id'
    else:
        # Fallback to object name for backward compatibility - optimized
        queries = {
            'drivers': """
                MATCH (o:Object {object: $object_name})
                WITH o
                OPTIONAL MATCH (s:Sector)-[r1:RELEVANT_TO]->(o)
                WITH o, s, r1
                OPTIONAL MATCH (d:Domain)-[r2:RELEVANT_TO]->(o)
                WITH o, s, r1, d, r2
                OPTIONAL MATCH (c:Country)-[r3:RELEVANT_TO]->(o)
                WITH o, s, r1, d, r2, c, r3
                OPTIONAL MATCH (oc:ObjectClarifier)-[r4:RELEVANT_TO]->(o)
                RETURN s, r1, d, r2, c, r3, oc, r4, o
            """,
            'ontology': """
                MATCH (b:Being)-[r1:HAS_AVATAR]->(a:Avatar)-[r2:HAS_OBJECT]->(o:Object {object: $object_name})
                RETURN b, r1, a, r2, o
            """,
            'identifiers': """
                MATCH (o:Object {object: $object_name})
                WITH o
                OPTIONAL MATCH (o)-[r1:HAS_DISCRETE_ID]->(v1:Variable)
                OPTIONAL MATCH (v1)<-[r4a:HAS_VARIABLE]-(g1:Group)
                OPTIONAL MATCH (g1)<-[r5a:HAS_GROUP]-(p1:Part)
                WITH o, v1, r1, g1, p1, r4a, r5a
                OPTIONAL MATCH (o)-[r2:HAS_COMPOSITE_ID_1|HAS_COMPOSITE_ID_2|HAS_COMPOSITE_ID_3|HAS_COMPOSITE_ID_4|HAS_COMPOSITE_ID_5]->(v2:Variable)
                OPTIONAL MATCH (v2)<-[r4b:HAS_VARIABLE]-(g2:Group)
                OPTIONAL MATCH (g2)<-[r5b:HAS_GROUP]-(p2:Part)
                WITH o, v1, r1, g1, p1, r4a, r5a, v2, r2, g2, p2, r4b, r5b
                OPTIONAL MATCH (o)-[r3:HAS_UNIQUE_ID]->(v3:Variable)
                OPTIONAL MATCH (v3)<-[r4c:HAS_VARIABLE]-(g3:Group)
                OPTIONAL MATCH (g3)<-[r5c:HAS_GROUP]-(p3:Part)
                RETURN o, v1, r1, g1, p1, r4a, r5a, v2, r2, g2, p2, r4b, r5b, v3, r3, g3, p3, r4c, r5c
            """,
            'relationships': """
                MATCH (o:Object {object: $object_name})-[r:RELATES_TO]->(o2:Object)
                RETURN o, r, o2
            """,
            'variants': """
                MATCH (o:Object {object: $object_name})
                OPTIONAL MATCH (o)-[r:HAS_VARIANT]->(v:Variant)
                RETURN o, r, v
                ORDER BY v.name
            """
        }
        query_param = object_name
        param_name = 'object_name'
    
    if view not in queries:
        raise HTTPException(status_code=400, detail=f"Invalid view type: {view}. Must be one of: drivers, ontology, identifiers, relationships, variants")
    
    try:
        cypher_query = queries[view]
        
        nodes = {}
        edges = []
        node_ids = set()
        edge_ids = set()
        
        with driver.session() as session:
            # Execute query and process results directly (streaming is faster than converting to list)
            result = session.run(cypher_query, **{param_name: query_param})
            
            # Process records directly without converting to list (streaming is faster)
            for record in result:
                # Process each field in the record
                for key, value in record.items():
                    if value is None:
                        continue
                    
                    # Handle nodes using isinstance check
                    if isinstance(value, Node):
                        node_id = str(value.id)
                        if node_id not in node_ids:
                            node_ids.add(node_id)
                            labels = list(value.labels) if value.labels else []
                            label = labels[0] if labels else 'Unknown'
                            
                            # Get node properties - cache items() to avoid multiple calls
                            if hasattr(value, 'items'):
                                props = dict(value.items())
                            else:
                                props = {}
                            name = props.get('name') or props.get('object') or props.get('being') or props.get('avatar') or node_id
                            
                            nodes[node_id] = {
                                'id': node_id,
                                'label': name,
                                'group': label,
                                'properties': props
                            }
                    
                    # Handle relationships using isinstance check
                    elif isinstance(value, Relationship):
                        rel_id = str(value.id)
                        if rel_id not in edge_ids:
                            edge_ids.add(rel_id)
                            # Relationships use start_node and end_node properties
                            start_id = str(value.start_node.id)
                            end_id = str(value.end_node.id)
                            
                            # Get relationship properties - cache items() to avoid multiple calls
                            if hasattr(value, 'items'):
                                props = dict(value.items())
                            else:
                                props = {}
                            
                            # For RELATES_TO relationships, ensure frequency property exists (default to "Critical")
                            if value.type == 'RELATES_TO' and 'frequency' not in props:
                                props['frequency'] = 'Critical'
                            
                            # For RELATES_TO, use role property as label if available
                            edge_label = value.type
                            if value.type == 'RELATES_TO' and 'role' in props:
                                edge_label = props.get('role', value.type)
                            
                            # Only add non-null relationships
                            if start_id and end_id:
                                edges.append({
                                    'id': rel_id,
                                    'from': start_id,
                                    'to': end_id,
                                    'label': edge_label,
                                    'properties': props
                                })
        
        return {
            'nodes': list(nodes.values()),
            'edges': edges,
            'nodeCount': len(nodes),
            'edgeCount': len(edges)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query execution failed: {str(e)}")

@router.post("/ontology/view/bulk")
async def get_bulk_ontology_view(
    object_ids: Optional[List[str]] = Body(None, description="List of object IDs (preferred for distinct objects)"),
    object_names: Optional[List[str]] = Body(None, description="List of object names (fallback for backward compatibility)"),
    view: str = Body(..., description="Type of ontology view: drivers, ontology, identifiers, relationships, variants")
):
    """
    Get ontology view for multiple objects and section.
    Maps view type to appropriate Cypher query for bulk selection.
    Uses object_ids if provided (for distinct objects), otherwise falls back to object_names.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Neo4j driver not available")
    
    if not object_ids and not object_names:
        raise HTTPException(status_code=400, detail="Either object_ids or object_names must be provided")
    
    # Use object_ids if available, otherwise fall back to object_names
    if object_ids:
        if len(object_ids) == 0:
            raise HTTPException(status_code=400, detail="At least one object ID is required")
        identifiers = object_ids
        use_ids = True
    else:
        if len(object_names) == 0:
            raise HTTPException(status_code=400, detail="At least one object name is required")
        identifiers = object_names
        use_ids = False
    
    # Limit maximum objects for performance (as per spec)
    MAX_OBJECTS = 50
    if len(identifiers) > MAX_OBJECTS:
        raise HTTPException(
            status_code=400, 
            detail=f"Maximum {MAX_OBJECTS} objects allowed for bulk view. Please reduce selection."
        )
    
    # Define Cypher queries for each view type (bulk version) - use object_ids if available
    if use_ids:
        queries = {
            'drivers': """
                MATCH (o:Object)
                WHERE o.id IN $object_ids
                WITH o
                OPTIONAL MATCH (s:Sector)-[r1:RELEVANT_TO]->(o)
                WITH o, s, r1
                OPTIONAL MATCH (d:Domain)-[r2:RELEVANT_TO]->(o)
                WITH o, s, r1, d, r2
                OPTIONAL MATCH (c:Country)-[r3:RELEVANT_TO]->(o)
                WITH o, s, r1, d, r2, c, r3
                OPTIONAL MATCH (oc:ObjectClarifier)-[r4:RELEVANT_TO]->(o)
                RETURN s, r1, d, r2, c, r3, oc, r4, o
            """,
            'ontology': """
                MATCH (o:Object)
                WHERE o.id IN $object_ids
                OPTIONAL MATCH (b:Being)-[r1:HAS_AVATAR]->(a:Avatar)-[r2:HAS_OBJECT]->(o)
                RETURN b, r1, a, r2, o
            """,
            'identifiers': """
                MATCH (o:Object)
                WHERE o.id IN $object_ids
                WITH o
                OPTIONAL MATCH (o)-[r1:HAS_DISCRETE_ID]->(v1:Variable)
                OPTIONAL MATCH (v1)<-[r4a:HAS_VARIABLE]-(g1:Group)
                OPTIONAL MATCH (g1)<-[r5a:HAS_GROUP]-(p1:Part)
                WITH o, v1, r1, g1, p1, r4a, r5a
                OPTIONAL MATCH (o)-[r2:HAS_COMPOSITE_ID_1|HAS_COMPOSITE_ID_2|HAS_COMPOSITE_ID_3|HAS_COMPOSITE_ID_4|HAS_COMPOSITE_ID_5]->(v2:Variable)
                OPTIONAL MATCH (v2)<-[r4b:HAS_VARIABLE]-(g2:Group)
                OPTIONAL MATCH (g2)<-[r5b:HAS_GROUP]-(p2:Part)
                WITH o, v1, r1, g1, p1, r4a, r5a, v2, r2, g2, p2, r4b, r5b
                OPTIONAL MATCH (o)-[r3:HAS_UNIQUE_ID]->(v3:Variable)
                OPTIONAL MATCH (v3)<-[r4c:HAS_VARIABLE]-(g3:Group)
                OPTIONAL MATCH (g3)<-[r5c:HAS_GROUP]-(p3:Part)
                RETURN o, v1, r1, g1, p1, r4a, r5a, v2, r2, g2, p2, r4b, r5b, v3, r3, g3, p3, r4c, r5c
            """,
            'relationships': """
                MATCH (o:Object)
                WHERE o.id IN $object_ids
                OPTIONAL MATCH (o)-[r:RELATES_TO]->(o2:Object)
                OPTIONAL MATCH (o3:Object)-[r2:RELATES_TO]->(o)
                RETURN o, r, o2, r2, o3
            """,
            'variants': """
                MATCH (o:Object)
                WHERE o.id IN $object_ids
                OPTIONAL MATCH (o)-[r:HAS_VARIANT]->(v:Variant)
                RETURN o, r, v
                ORDER BY o.object, v.name
            """
        }
        param_name = 'object_ids'
    else:
        queries = {
            'drivers': """
                MATCH (o:Object)
                WHERE o.object IN $object_names
                WITH o
                OPTIONAL MATCH (s:Sector)-[r1:RELEVANT_TO]->(o)
                WITH o, s, r1
                OPTIONAL MATCH (d:Domain)-[r2:RELEVANT_TO]->(o)
                WITH o, s, r1, d, r2
                OPTIONAL MATCH (c:Country)-[r3:RELEVANT_TO]->(o)
                WITH o, s, r1, d, r2, c, r3
                OPTIONAL MATCH (oc:ObjectClarifier)-[r4:RELEVANT_TO]->(o)
                RETURN s, r1, d, r2, c, r3, oc, r4, o
            """,
            'ontology': """
                MATCH (o:Object)
                WHERE o.object IN $object_names
                OPTIONAL MATCH (b:Being)-[r1:HAS_AVATAR]->(a:Avatar)-[r2:HAS_OBJECT]->(o)
                RETURN b, r1, a, r2, o
            """,
            'identifiers': """
                MATCH (o:Object)
                WHERE o.object IN $object_names
                WITH o
                OPTIONAL MATCH (o)-[r1:HAS_DISCRETE_ID]->(v1:Variable)
                OPTIONAL MATCH (v1)<-[r4a:HAS_VARIABLE]-(g1:Group)
                OPTIONAL MATCH (g1)<-[r5a:HAS_GROUP]-(p1:Part)
                WITH o, v1, r1, g1, p1, r4a, r5a
                OPTIONAL MATCH (o)-[r2:HAS_COMPOSITE_ID_1|HAS_COMPOSITE_ID_2|HAS_COMPOSITE_ID_3|HAS_COMPOSITE_ID_4|HAS_COMPOSITE_ID_5]->(v2:Variable)
                OPTIONAL MATCH (v2)<-[r4b:HAS_VARIABLE]-(g2:Group)
                OPTIONAL MATCH (g2)<-[r5b:HAS_GROUP]-(p2:Part)
                WITH o, v1, r1, g1, p1, r4a, r5a, v2, r2, g2, p2, r4b, r5b
                OPTIONAL MATCH (o)-[r3:HAS_UNIQUE_ID]->(v3:Variable)
                OPTIONAL MATCH (v3)<-[r4c:HAS_VARIABLE]-(g3:Group)
                OPTIONAL MATCH (g3)<-[r5c:HAS_GROUP]-(p3:Part)
                RETURN o, v1, r1, g1, p1, r4a, r5a, v2, r2, g2, p2, r4b, r5b, v3, r3, g3, p3, r4c, r5c
            """,
            'relationships': """
                MATCH (o:Object)
                WHERE o.object IN $object_names
                OPTIONAL MATCH (o)-[r:RELATES_TO]->(o2:Object)
                OPTIONAL MATCH (o3:Object)-[r2:RELATES_TO]->(o)
                RETURN o, r, o2, r2, o3
            """,
            'variants': """
                MATCH (o:Object)
                WHERE o.object IN $object_names
                OPTIONAL MATCH (o)-[r:HAS_VARIANT]->(v:Variant)
                RETURN o, r, v
                ORDER BY o.object, v.name
            """
        }
        param_name = 'object_names'
    
    if view not in queries:
        raise HTTPException(status_code=400, detail=f"Invalid view type: {view}. Must be one of: drivers, ontology, identifiers, relationships, variants")
    
    try:
        cypher_query = queries[view]
        
        nodes = {}
        edges = []
        node_ids = set()
        edge_ids = set()
        
        with driver.session() as session:
            # Execute query and process results directly (streaming is faster than converting to list)
            result = session.run(cypher_query, **{param_name: identifiers})
            
            # Process records directly without converting to list (streaming is faster)
            for record in result:
                # Process each field in the record
                for key, value in record.items():
                    if value is None:
                        continue
                    
                    # Handle nodes using isinstance check
                    if isinstance(value, Node):
                        node_id = str(value.id)
                        if node_id not in node_ids:
                            node_ids.add(node_id)
                            labels = list(value.labels) if value.labels else []
                            label = labels[0] if labels else 'Unknown'
                            
                            # Get node properties - cache items() to avoid multiple calls
                            if hasattr(value, 'items'):
                                props = dict(value.items())
                            else:
                                props = {}
                            name = props.get('name') or props.get('object') or props.get('being') or props.get('avatar') or node_id
                            
                            nodes[node_id] = {
                                'id': node_id,
                                'label': name,
                                'group': label,
                                'properties': props
                            }
                    
                    # Handle relationships using isinstance check
                    elif isinstance(value, Relationship):
                        rel_id = str(value.id)
                        if rel_id not in edge_ids:
                            edge_ids.add(rel_id)
                            # Relationships use start_node and end_node properties
                            start_id = str(value.start_node.id)
                            end_id = str(value.end_node.id)
                            
                            # Get relationship properties - cache items() to avoid multiple calls
                            if hasattr(value, 'items'):
                                props = dict(value.items())
                            else:
                                props = {}
                            
                            # For RELATES_TO relationships, ensure frequency property exists (default to "Critical")
                            if value.type == 'RELATES_TO' and 'frequency' not in props:
                                props['frequency'] = 'Critical'
                            
                            # For RELATES_TO, use role property as label if available
                            edge_label = value.type
                            if value.type == 'RELATES_TO' and 'role' in props:
                                edge_label = props.get('role', value.type)
                            
                            # Only add non-null relationships
                            if start_id and end_id:
                                edges.append({
                                    'id': rel_id,
                                    'from': start_id,
                                    'to': end_id,
                                    'label': edge_label,
                                    'properties': props
                                })
        
        return {
            'nodes': list(nodes.values()),
            'edges': edges,
            'nodeCount': len(nodes),
            'edgeCount': len(edges)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query execution failed: {str(e)}")

@router.get("/ontology/view/variable")
async def get_variable_ontology_view(
    variable_id: Optional[str] = Query(None, description="ID of the variable (preferred)"),
    variable_name: Optional[str] = Query(None, description="Name of the variable (fallback)"),
    view: str = Query(..., description="Type of ontology view: drivers, ontology, metadata, objectRelationships, variations")
):
    """
    Get ontology view for a specific variable and section.
    Maps view type to appropriate Cypher query.
    Uses variable_id if provided, otherwise falls back to variable_name.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Neo4j driver not available")
    
    if not variable_id and not variable_name:
        raise HTTPException(status_code=400, detail="Either variable_id or variable_name must be provided")
    
    # Define Cypher queries for each view type
    if variable_id:
        queries = {
            'drivers': """
                MATCH (v:Variable {id: $variable_id})
                WITH v
                OPTIONAL MATCH (s:Sector)-[r1:IS_RELEVANT_TO]->(v)
                WITH v, s, r1
                OPTIONAL MATCH (d:Domain)-[r2:IS_RELEVANT_TO]->(v)
                WITH v, s, r1, d, r2
                OPTIONAL MATCH (c:Country)-[r3:IS_RELEVANT_TO]->(v)
                WITH v, s, r1, d, r2, c, r3
                OPTIONAL MATCH (vc:VariableClarifier)-[r4:IS_RELEVANT_TO]->(v)
                RETURN s, r1, d, r2, c, r3, vc, r4, v
            """,
            'ontology': """
                MATCH (p:Part)-[r1:HAS_GROUP]->(g:Group)-[r2:HAS_VARIABLE]->(v:Variable {id: $variable_id})
                RETURN p, r1, g, r2, v
            """,
            'metadata': """
                MATCH (v:Variable {id: $variable_id})
                RETURN v
            """,
            'objectRelationships': """
                MATCH (v:Variable {id: $variable_id})
                WITH v
                OPTIONAL MATCH (o:Object)-[r1:HAS_SPECIFIC_VARIABLE]->(v)
                WITH v, o, r1
                OPTIONAL MATCH (v)<-[r2:HAS_VARIABLE]-(g:Group)
                WITH v, o, r1, g, r2
                OPTIONAL MATCH (g)<-[r3:HAS_GROUP]-(p:Part)
                RETURN v, o, r1, g, r2, p, r3
            """,
            'variations': """
                MATCH (v:Variable {id: $variable_id})
                OPTIONAL MATCH (v)-[r:HAS_VARIATION]->(var:Variation)
                RETURN v, r, var
                ORDER BY var.name
            """
        }
        query_param = variable_id
        param_name = 'variable_id'
    else:
        queries = {
            'drivers': """
                MATCH (v:Variable {name: $variable_name})
                WITH v
                OPTIONAL MATCH (s:Sector)-[r1:IS_RELEVANT_TO]->(v)
                WITH v, s, r1
                OPTIONAL MATCH (d:Domain)-[r2:IS_RELEVANT_TO]->(v)
                WITH v, s, r1, d, r2
                OPTIONAL MATCH (c:Country)-[r3:IS_RELEVANT_TO]->(v)
                WITH v, s, r1, d, r2, c, r3
                OPTIONAL MATCH (vc:VariableClarifier)-[r4:IS_RELEVANT_TO]->(v)
                RETURN s, r1, d, r2, c, r3, vc, r4, v
            """,
            'ontology': """
                MATCH (p:Part)-[r1:HAS_GROUP]->(g:Group)-[r2:HAS_VARIABLE]->(v:Variable {name: $variable_name})
                RETURN p, r1, g, r2, v
            """,
            'metadata': """
                MATCH (v:Variable {name: $variable_name})
                RETURN v
            """,
            'objectRelationships': """
                MATCH (v:Variable {name: $variable_name})
                WITH v
                OPTIONAL MATCH (o:Object)-[r1:HAS_SPECIFIC_VARIABLE]->(v)
                WITH v, o, r1
                OPTIONAL MATCH (v)<-[r2:HAS_VARIABLE]-(g:Group)
                WITH v, o, r1, g, r2
                OPTIONAL MATCH (g)<-[r3:HAS_GROUP]-(p:Part)
                RETURN v, o, r1, g, r2, p, r3
            """,
            'variations': """
                MATCH (v:Variable {name: $variable_name})
                OPTIONAL MATCH (v)-[r:HAS_VARIATION]->(var:Variation)
                RETURN v, r, var
                ORDER BY var.name
            """
        }
        query_param = variable_name
        param_name = 'variable_name'
    
    if view not in queries:
        raise HTTPException(status_code=400, detail=f"Invalid view type: {view}. Must be one of: drivers, ontology, metadata, objectRelationships, variations")
    
    try:
        cypher_query = queries[view]
        
        nodes = {}
        edges = []
        node_ids = set()
        edge_ids = set()
        
        with driver.session() as session:
            result = session.run(cypher_query, **{param_name: query_param})
            
            for record in result:
                for key, value in record.items():
                    if value is None:
                        continue
                    
                    if isinstance(value, Node):
                        node_id = str(value.id)
                        if node_id not in node_ids:
                            node_ids.add(node_id)
                            labels = list(value.labels) if value.labels else []
                            label = labels[0] if labels else 'Unknown'
                            
                            if hasattr(value, 'items'):
                                props = dict(value.items())
                            else:
                                props = {}
                            name = props.get('name') or props.get('variable') or props.get('object') or node_id
                            
                            nodes[node_id] = {
                                'id': node_id,
                                'label': name,
                                'group': label,
                                'properties': props
                            }
                    
                    elif isinstance(value, Relationship):
                        rel_id = str(value.id)
                        if rel_id not in edge_ids:
                            edge_ids.add(rel_id)
                            start_id = str(value.start_node.id)
                            end_id = str(value.end_node.id)
                            
                            if hasattr(value, 'items'):
                                props = dict(value.items())
                            else:
                                props = {}
                            
                            edge_label = value.type
                            
                            if start_id and end_id:
                                edges.append({
                                    'id': rel_id,
                                    'from': start_id,
                                    'to': end_id,
                                    'label': edge_label,
                                    'properties': props
                                })
        
        return {
            'nodes': list(nodes.values()),
            'edges': edges,
            'nodeCount': len(nodes),
            'edgeCount': len(edges)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query execution failed: {str(e)}")

@router.post("/ontology/view/variable/bulk")
async def get_bulk_variable_ontology_view(
    variable_ids: Optional[List[str]] = Body(None, description="List of variable IDs (preferred)"),
    variable_names: Optional[List[str]] = Body(None, description="List of variable names (fallback)"),
    view: str = Body(..., description="Type of ontology view: drivers, ontology, metadata, objectRelationships, variations")
):
    """
    Get ontology view for multiple variables and section.
    Maps view type to appropriate Cypher query for bulk selection.
    Uses variable_ids if provided, otherwise falls back to variable_names.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Neo4j driver not available")
    
    if not variable_ids and not variable_names:
        raise HTTPException(status_code=400, detail="Either variable_ids or variable_names must be provided")
    
    # Use variable_ids if available, otherwise fall back to variable_names
    if variable_ids:
        if len(variable_ids) == 0:
            raise HTTPException(status_code=400, detail="At least one variable ID is required")
        identifiers = variable_ids
        use_ids = True
    else:
        if len(variable_names) == 0:
            raise HTTPException(status_code=400, detail="At least one variable name is required")
        identifiers = variable_names
        use_ids = False
    
    # Limit maximum variables for performance
    MAX_VARIABLES = 50
    if len(identifiers) > MAX_VARIABLES:
        raise HTTPException(
            status_code=400, 
            detail=f"Maximum {MAX_VARIABLES} variables allowed for bulk view. Please reduce selection."
        )
    
    # Define Cypher queries for each view type (bulk version)
    if use_ids:
        queries = {
            'drivers': """
                MATCH (v:Variable)
                WHERE v.id IN $variable_ids
                WITH v
                OPTIONAL MATCH (s:Sector)-[r1:IS_RELEVANT_TO]->(v)
                WITH v, s, r1
                OPTIONAL MATCH (d:Domain)-[r2:IS_RELEVANT_TO]->(v)
                WITH v, s, r1, d, r2
                OPTIONAL MATCH (c:Country)-[r3:IS_RELEVANT_TO]->(v)
                WITH v, s, r1, d, r2, c, r3
                OPTIONAL MATCH (vc:VariableClarifier)-[r4:IS_RELEVANT_TO]->(v)
                RETURN s, r1, d, r2, c, r3, vc, r4, v
            """,
            'ontology': """
                MATCH (v:Variable)
                WHERE v.id IN $variable_ids
                OPTIONAL MATCH (p:Part)-[r1:HAS_GROUP]->(g:Group)-[r2:HAS_VARIABLE]->(v)
                RETURN p, r1, g, r2, v
            """,
            'metadata': """
                MATCH (v:Variable)
                WHERE v.id IN $variable_ids
                RETURN v
            """,
            'objectRelationships': """
                MATCH (v:Variable)
                WHERE v.id IN $variable_ids
                WITH v
                OPTIONAL MATCH (o:Object)-[r1:HAS_SPECIFIC_VARIABLE]->(v)
                WITH v, o, r1
                OPTIONAL MATCH (v)<-[r2:HAS_VARIABLE]-(g:Group)
                WITH v, o, r1, g, r2
                OPTIONAL MATCH (g)<-[r3:HAS_GROUP]-(p:Part)
                RETURN v, o, r1, g, r2, p, r3
            """,
            'variations': """
                MATCH (v:Variable)
                WHERE v.id IN $variable_ids
                OPTIONAL MATCH (v)-[r:HAS_VARIATION]->(var:Variation)
                RETURN v, r, var
                ORDER BY var.name
            """
        }
        param_name = 'variable_ids'
    else:
        queries = {
            'drivers': """
                MATCH (v:Variable)
                WHERE v.name IN $variable_names
                WITH v
                OPTIONAL MATCH (s:Sector)-[r1:IS_RELEVANT_TO]->(v)
                WITH v, s, r1
                OPTIONAL MATCH (d:Domain)-[r2:IS_RELEVANT_TO]->(v)
                WITH v, s, r1, d, r2
                OPTIONAL MATCH (c:Country)-[r3:IS_RELEVANT_TO]->(v)
                WITH v, s, r1, d, r2, c, r3
                OPTIONAL MATCH (vc:VariableClarifier)-[r4:IS_RELEVANT_TO]->(v)
                RETURN s, r1, d, r2, c, r3, vc, r4, v
            """,
            'ontology': """
                MATCH (v:Variable)
                WHERE v.name IN $variable_names
                OPTIONAL MATCH (p:Part)-[r1:HAS_GROUP]->(g:Group)-[r2:HAS_VARIABLE]->(v)
                RETURN p, r1, g, r2, v
            """,
            'metadata': """
                MATCH (v:Variable)
                WHERE v.name IN $variable_names
                RETURN v
            """,
            'objectRelationships': """
                MATCH (v:Variable)
                WHERE v.name IN $variable_names
                WITH v
                OPTIONAL MATCH (o:Object)-[r1:HAS_SPECIFIC_VARIABLE]->(v)
                WITH v, o, r1
                OPTIONAL MATCH (v)<-[r2:HAS_VARIABLE]-(g:Group)
                WITH v, o, r1, g, r2
                OPTIONAL MATCH (g)<-[r3:HAS_GROUP]-(p:Part)
                RETURN v, o, r1, g, r2, p, r3
            """,
            'variations': """
                MATCH (v:Variable)
                WHERE v.name IN $variable_names
                OPTIONAL MATCH (v)-[r:HAS_VARIATION]->(var:Variation)
                RETURN v, r, var
                ORDER BY var.name
            """
        }
        param_name = 'variable_names'
    
    if view not in queries:
        raise HTTPException(status_code=400, detail=f"Invalid view type: {view}. Must be one of: drivers, ontology, metadata, objectRelationships, variations")
    
    try:
        cypher_query = queries[view]
        
        nodes = {}
        edges = []
        node_ids = set()
        edge_ids = set()
        
        with driver.session() as session:
            result = session.run(cypher_query, **{param_name: identifiers})
            
            for record in result:
                for key, value in record.items():
                    if value is None:
                        continue
                    
                    if isinstance(value, Node):
                        node_id = str(value.id)
                        if node_id not in node_ids:
                            node_ids.add(node_id)
                            labels = list(value.labels) if value.labels else []
                            label = labels[0] if labels else 'Unknown'
                            
                            if hasattr(value, 'items'):
                                props = dict(value.items())
                            else:
                                props = {}
                            name = props.get('name') or props.get('variable') or props.get('object') or node_id
                            
                            nodes[node_id] = {
                                'id': node_id,
                                'label': name,
                                'group': label,
                                'properties': props
                            }
                    
                    elif isinstance(value, Relationship):
                        rel_id = str(value.id)
                        if rel_id not in edge_ids:
                            edge_ids.add(rel_id)
                            start_id = str(value.start_node.id)
                            end_id = str(value.end_node.id)
                            
                            if hasattr(value, 'items'):
                                props = dict(value.items())
                            else:
                                props = {}
                            
                            edge_label = value.type
                            
                            if start_id and end_id:
                                edges.append({
                                    'id': rel_id,
                                    'from': start_id,
                                    'to': end_id,
                                    'label': edge_label,
                                    'properties': props
                                })
        
        return {
            'nodes': list(nodes.values()),
            'edges': edges,
            'nodeCount': len(nodes),
            'edgeCount': len(edges)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query execution failed: {str(e)}")

@router.get("/ontology/view/list")
async def get_list_ontology_view(
    list_id: Optional[str] = Query(None, description="ID of the list (preferred)"),
    list_name: Optional[str] = Query(None, description="Name of the list (fallback)"),
    view: str = Query(..., description="Type of ontology view: drivers, ontology, metadata, listValues, variations")
):
    """
    Get ontology view for a specific list and section.
    Maps view type to appropriate Cypher query.
    Uses list_id if provided, otherwise falls back to list_name.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Neo4j driver not available")
    
    if not list_id and not list_name:
        raise HTTPException(status_code=400, detail="Either list_id or list_name must be provided")
    
    # Define Cypher queries for each view type
    if list_id:
        queries = {
            'drivers': """
                MATCH (l:List {id: $list_id})
                OPTIONAL MATCH (s:Sector)-[r1:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (d:Domain)-[r2:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (c:Country)-[r3:IS_RELEVANT_TO]->(l)
                RETURN l, s, r1, d, r2, c, r3
            """,
            'ontology': """
                MATCH (l:List {id: $list_id})
                OPTIONAL MATCH (s:Set)-[r1:HAS_GROUPING]->(g:Grouping)-[r2:HAS_LIST]->(l)
                RETURN l, s, r1, g, r2
            """,
            'metadata': """
                MATCH (l:List {id: $list_id})
                RETURN l
            """,
            'listValues': """
                MATCH (l:List {id: $list_id})
                OPTIONAL MATCH (l)-[r:HAS_LIST_VALUE]->(lv:ListValue)
                RETURN l, r, lv
            """,
            'variations': """
                MATCH (l:List {id: $list_id})
                OPTIONAL MATCH (l)-[r:HAS_VARIATION]->(var:Variation)
                RETURN l, r, var
                ORDER BY var.name
            """
        }
        param_name = 'list_id'
        param_value = list_id
    else:
        queries = {
            'drivers': """
                MATCH (l:List {name: $list_name})
                OPTIONAL MATCH (s:Sector)-[r1:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (d:Domain)-[r2:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (c:Country)-[r3:IS_RELEVANT_TO]->(l)
                RETURN l, s, r1, d, r2, c, r3
            """,
            'ontology': """
                MATCH (l:List {name: $list_name})
                OPTIONAL MATCH (s:Set)-[r1:HAS_GROUPING]->(g:Grouping)-[r2:HAS_LIST]->(l)
                RETURN l, s, r1, g, r2
            """,
            'metadata': """
                MATCH (l:List {name: $list_name})
                RETURN l
            """,
            'listValues': """
                MATCH (l:List {name: $list_name})
                OPTIONAL MATCH (l)-[r:HAS_LIST_VALUE]->(lv:ListValue)
                RETURN l, r, lv
            """,
            'variations': """
                MATCH (l:List {name: $list_name})
                OPTIONAL MATCH (l)-[r:HAS_VARIATION]->(var:Variation)
                RETURN l, r, var
                ORDER BY var.name
            """
        }
        param_name = 'list_name'
        param_value = list_name
    
    if view not in queries:
        raise HTTPException(status_code=400, detail=f"Invalid view type: {view}. Must be one of: drivers, ontology, metadata, listValues, variations")
    
    try:
        with driver.session() as session:
            # For listValues view, check if it's a tiered list and build appropriate query
            if view == 'listValues':
                # First check if this is a parent or child list
                check_result = session.run("""
                    MATCH (l:List {id: $list_id})
                    OPTIONAL MATCH (l)-[tier_rel:HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
                    OPTIONAL MATCH (parent:List)-[parent_tier_rel:HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(l)
                    WITH l, count(DISTINCT tiered) as child_count, count(DISTINCT parent) as parent_count,
                         collect(DISTINCT type(parent_tier_rel))[0] as parent_tier_type
                    RETURN child_count > 0 as is_parent, parent_count > 0 as is_child, parent_tier_type
                """, {param_name: param_value})
                
                check_record = check_result.single()
                is_parent = check_record.get("is_parent", False) if check_record else False
                is_child = check_record.get("is_child", False) if check_record else False
                parent_tier_type = check_record.get("parent_tier_type") if check_record else None
                
                # Determine max tier for child lists
                max_tier = 1
                if is_child and parent_tier_type:
                    tier_num_str = parent_tier_type.replace('HAS_TIER_', '')
                    try:
                        max_tier = int(tier_num_str)
                    except:
                        max_tier = 1
                
                if is_parent:
                    # Parent list: Show tier hierarchy AND tiered values
                    query = """
                        MATCH (l:List {id: $list_id})
                        OPTIONAL MATCH (l)-[tier_rel:HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
                        OPTIONAL MATCH (l)-[r1:HAS_LIST_VALUE]->(lv1:ListValue)
                        OPTIONAL MATCH (lv1)-[r2]->(lv2:ListValue)
                        WHERE type(r2) STARTS WITH 'HAS_' AND type(r2) ENDS WITH '_VALUE'
                          AND type(r2) <> 'HAS_LIST_VALUE'
                        OPTIONAL MATCH (tiered)-[r3:HAS_LIST_VALUE]->(lv2)
                        RETURN l, tiered, tier_rel, lv1, r1, lv2, r2, r3
                    """
                elif is_child:
                    # Child list: Show parent, tier hierarchy, and tiered values up to this tier
                    # For tier 2, show up to tier 2 values (1 level of tiered values)
                    # For tier 3, show up to tier 3 values (2 levels of tiered values), etc.
                    query = """
                        MATCH (l:List {id: $list_id})
                        OPTIONAL MATCH (parent:List)-[parent_tier_rel:HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(l)
                        OPTIONAL MATCH (parent)-[r1:HAS_LIST_VALUE]->(lv1:ListValue)
                        OPTIONAL MATCH (lv1)-[r2]->(lv2:ListValue)
                        WHERE type(r2) STARTS WITH 'HAS_' AND type(r2) ENDS WITH '_VALUE'
                          AND type(r2) <> 'HAS_LIST_VALUE'
                        OPTIONAL MATCH (l)-[r3:HAS_LIST_VALUE]->(lv2)
                        RETURN l, parent, parent_tier_rel, lv1, r1, lv2, r2, r3
                    """
                else:
                    # Normal list: Just show direct list values
                    query = queries['listValues']
                
                result = session.run(query, {param_name: param_value})
            else:
                result = session.run(queries[view], {param_name: param_value})
            
            nodes = {}
            edges = []
            node_ids = set()
            edge_ids = set()
            
            for record in result:
                # Process list node first to ensure it's always included
                list_node = None
                for key, value in record.items():
                    if value is None:
                        continue
                    
                    # Handle nodes
                    if isinstance(value, Node):
                        node_id = str(value.id)
                        labels = list(value.labels) if value.labels else []
                        label = labels[0] if labels else 'Unknown'
                        
                        # Track the list node separately
                        if label == 'List':
                            list_node = value
                        
                        if node_id not in node_ids:
                            node_ids.add(node_id)
                            props = dict(value.items()) if hasattr(value, 'items') else {}
                            # For ListValue nodes, use 'value' property; for others, use 'name'
                            name = props.get('value') if label == 'ListValue' else props.get('name', node_id)
                            
                            nodes[node_id] = {
                                'id': node_id,
                                'label': name,
                                'group': label,
                                'properties': props
                            }
                    
                    # Handle relationships
                    elif isinstance(value, Relationship):
                        rel_id = str(value.id)
                        if rel_id not in edge_ids:
                            edge_ids.add(rel_id)
                            start_id = str(value.start_node.id)
                            end_id = str(value.end_node.id)
                            props = dict(value.items()) if hasattr(value, 'items') else {}
                            
                            edges.append({
                                'id': rel_id,
                                'from': start_id,
                                'to': end_id,
                                'label': value.type,
                                'properties': props
                            })
                
                # Ensure list node is always included even if no relationships
                if list_node and str(list_node.id) not in node_ids:
                    node_id = str(list_node.id)
                    node_ids.add(node_id)
                    props = dict(list_node.items()) if hasattr(list_node, 'items') else {}
                    name = props.get('name', node_id)
                    nodes[node_id] = {
                        'id': node_id,
                        'label': name,
                        'group': 'List',
                        'properties': props
                    }
            
            return {
                'nodes': list(nodes.values()),
                'edges': edges,
                'nodeCount': len(nodes),
                'edgeCount': len(edges)
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query execution failed: {str(e)}")

@router.post("/ontology/view/list/bulk")
async def get_bulk_list_ontology_view(
    list_ids: Optional[List[str]] = Body(None, description="List of list IDs (preferred)"),
    list_names: Optional[List[str]] = Body(None, description="List of list names (fallback)"),
    view: str = Body(..., description="Type of ontology view: drivers, ontology, metadata, listValues, variations")
):
    """
    Get ontology view for multiple lists and section.
    Maps view type to appropriate Cypher query for bulk selection.
    Uses list_ids if provided, otherwise falls back to list_names.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Neo4j driver not available")
    
    if not list_ids and not list_names:
        raise HTTPException(status_code=400, detail="Either list_ids or list_names must be provided")
    
    # Use list_ids if available, otherwise fall back to list_names
    if list_ids:
        if len(list_ids) == 0:
            raise HTTPException(status_code=400, detail="At least one list ID is required")
        identifiers = list_ids
        use_ids = True
    else:
        if len(list_names) == 0:
            raise HTTPException(status_code=400, detail="At least one list name is required")
        identifiers = list_names
        use_ids = False
    
    # Limit maximum lists for performance
    MAX_LISTS = 50
    if len(identifiers) > MAX_LISTS:
        raise HTTPException(
            status_code=400, 
            detail=f"Maximum {MAX_LISTS} lists allowed for bulk view. Please reduce selection."
        )
    
    # Define Cypher queries for each view type (bulk version)
    if use_ids:
        queries = {
            'drivers': """
                MATCH (l:List)
                WHERE l.id IN $list_ids
                OPTIONAL MATCH (s:Sector)-[r1:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (d:Domain)-[r2:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (c:Country)-[r3:IS_RELEVANT_TO]->(l)
                RETURN l, s, r1, d, r2, c, r3
            """,
            'ontology': """
                MATCH (l:List)
                WHERE l.id IN $list_ids
                OPTIONAL MATCH (s:Set)-[r1:HAS_GROUPING]->(g:Grouping)-[r2:HAS_LIST]->(l)
                RETURN l, s, r1, g, r2
            """,
            'metadata': """
                MATCH (l:List)
                WHERE l.id IN $list_ids
                RETURN l
            """,
            'listValues': """
                MATCH (l:List)
                WHERE l.id IN $list_ids
                OPTIONAL MATCH (l)-[r:HAS_LIST_VALUE]->(lv:ListValue)
                RETURN l, r, lv
            """,
            'variations': """
                MATCH (l:List)
                WHERE l.id IN $list_ids
                OPTIONAL MATCH (l)-[r:HAS_VARIATION]->(var:Variation)
                RETURN l, r, var
                ORDER BY var.name
            """
        }
        param_name = 'list_ids'
    else:
        queries = {
            'drivers': """
                MATCH (l:List)
                WHERE l.name IN $list_names
                OPTIONAL MATCH (s:Sector)-[r1:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (d:Domain)-[r2:IS_RELEVANT_TO]->(l)
                OPTIONAL MATCH (c:Country)-[r3:IS_RELEVANT_TO]->(l)
                RETURN l, s, r1, d, r2, c, r3
            """,
            'ontology': """
                MATCH (l:List)
                WHERE l.name IN $list_names
                OPTIONAL MATCH (s:Set)-[r1:HAS_GROUPING]->(g:Grouping)-[r2:HAS_LIST]->(l)
                RETURN l, s, r1, g, r2
            """,
            'metadata': """
                MATCH (l:List)
                WHERE l.name IN $list_names
                RETURN l
            """,
            'listValues': """
                MATCH (l:List)
                WHERE l.name IN $list_names
                OPTIONAL MATCH (l)-[r:HAS_LIST_VALUE]->(lv:ListValue)
                RETURN l, r, lv
            """,
            'variations': """
                MATCH (l:List)
                WHERE l.name IN $list_names
                OPTIONAL MATCH (l)-[r:HAS_VARIATION]->(var:Variation)
                RETURN l, r, var
                ORDER BY var.name
            """
        }
        param_name = 'list_names'
    
    if view not in queries:
        raise HTTPException(status_code=400, detail=f"Invalid view type: {view}. Must be one of: drivers, ontology, metadata, listValues, variations")
    
    try:
        with driver.session() as session:
            result = session.run(queries[view], {param_name: identifiers})
            
            nodes = {}
            edges = []
            node_ids = set()
            edge_ids = set()
            
            for record in result:
                # Process list nodes first to ensure they're always included
                list_nodes = []
                for key, value in record.items():
                    if value is None:
                        continue
                    
                    # Handle nodes
                    if isinstance(value, Node):
                        node_id = str(value.id)
                        labels = list(value.labels) if value.labels else []
                        label = labels[0] if labels else 'Unknown'
                        
                        # Track list nodes separately
                        if label == 'List':
                            list_nodes.append(value)
                        
                        if node_id not in node_ids:
                            node_ids.add(node_id)
                            props = dict(value.items()) if hasattr(value, 'items') else {}
                            # For ListValue nodes, use 'value' property; for others, use 'name'
                            name = props.get('value') if label == 'ListValue' else props.get('name', node_id)
                            
                            nodes[node_id] = {
                                'id': node_id,
                                'label': name,
                                'group': label,
                                'properties': props
                            }
                    
                    # Handle relationships
                    elif isinstance(value, Relationship):
                        rel_id = str(value.id)
                        if rel_id not in edge_ids:
                            edge_ids.add(rel_id)
                            start_id = str(value.start_node.id)
                            end_id = str(value.end_node.id)
                            props = dict(value.items()) if hasattr(value, 'items') else {}
                            
                            edges.append({
                                'id': rel_id,
                                'from': start_id,
                                'to': end_id,
                                'label': value.type,
                                'properties': props
                            })
                
                # Ensure list nodes are always included even if no relationships
                for list_node in list_nodes:
                    if str(list_node.id) not in node_ids:
                        node_id = str(list_node.id)
                        node_ids.add(node_id)
                        props = dict(list_node.items()) if hasattr(list_node, 'items') else {}
                        name = props.get('name', node_id)
                        nodes[node_id] = {
                            'id': node_id,
                            'label': name,
                            'group': 'List',
                            'properties': props
                        }
            
            return {
                'nodes': list(nodes.values()),
                'edges': edges,
                'nodeCount': len(nodes),
                'edgeCount': len(edges)
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query execution failed: {str(e)}")

@router.post("/graph/query")
async def execute_graph_query(request: GraphQueryRequest):
    """
    Execute a Cypher query and return graph data in a format compatible with vis-network.
    This endpoint proxies Neo4j queries from the frontend, as browsers cannot directly 
    connect to Neo4j via the Bolt protocol.
    """
    try:
        driver = get_driver()
        if not driver:
            raise HTTPException(status_code=500, detail="Neo4j driver not available")
        
        nodes = {}
        edges = []
        node_ids = set()
        edge_ids = set()
        
        with driver.session() as session:
            result = session.run(request.query)
            
            for record in result:
                # Process each field in the record
                for key, value in record.items():
                    if value is None:
                        continue
                    
                    # Handle nodes using isinstance check
                    if isinstance(value, Node):
                        node_id = str(value.id)
                        if node_id not in node_ids:
                            node_ids.add(node_id)
                            labels = list(value.labels) if value.labels else []
                            label = labels[0] if labels else 'Unknown'
                            
                            # Get node properties
                            props = dict(value.items()) if hasattr(value, 'items') else {}
                            name = props.get('name', node_id)
                            
                            nodes[node_id] = {
                                'id': node_id,
                                'label': name,
                                'group': label,
                                'properties': props
                            }
                    
                    # Handle relationships using isinstance check
                    elif isinstance(value, Relationship):
                        rel_id = str(value.id)
                        if rel_id not in edge_ids:
                            edge_ids.add(rel_id)
                            # Relationships use start_node and end_node properties
                            start_id = str(value.start_node.id)
                            end_id = str(value.end_node.id)
                            
                            # Get relationship properties
                            props = dict(value.items()) if hasattr(value, 'items') else {}
                            
                            edges.append({
                                'id': rel_id,
                                'from': start_id,
                                'to': end_id,
                                'label': value.type,
                                'properties': props
                            })
                    
                    # Handle paths
                    elif isinstance(value, Path):
                        for node in value.nodes:
                            node_id = str(node.id)
                            if node_id not in node_ids:
                                node_ids.add(node_id)
                                labels = list(node.labels) if node.labels else []
                                label = labels[0] if labels else 'Unknown'
                                props = dict(node.items()) if hasattr(node, 'items') else {}
                                name = props.get('name', node_id)
                                
                                nodes[node_id] = {
                                    'id': node_id,
                                    'label': name,
                                    'group': label,
                                    'properties': props
                                }
                        
                        for rel in value.relationships:
                            rel_id = str(rel.id)
                            if rel_id not in edge_ids:
                                edge_ids.add(rel_id)
                                start_id = str(rel.start_node.id)
                                end_id = str(rel.end_node.id)
                                props = dict(rel.items()) if hasattr(rel, 'items') else {}
                                
                                edges.append({
                                    'id': rel_id,
                                    'from': start_id,
                                    'to': end_id,
                                    'label': rel.type,
                                    'properties': props
                                })
        
        return {
            'nodes': list(nodes.values()),
            'edges': edges,
            'nodeCount': len(nodes),
            'edgeCount': len(edges)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query execution failed: {str(e)}")

