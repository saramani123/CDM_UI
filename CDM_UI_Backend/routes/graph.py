from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional
from pydantic import BaseModel
from db import get_driver
from neo4j.graph import Node, Relationship, Path

router = APIRouter()

class GraphQueryRequest(BaseModel):
    query: str

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

