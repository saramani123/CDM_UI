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
                MATCH (o:Object {id: $object_id})-[r:HAS_VARIANT]->(v:Variant)
                RETURN o, r, v
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
                MATCH (o:Object {object: $object_name})-[r:HAS_VARIANT]->(v:Variant)
                RETURN o, r, v
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

