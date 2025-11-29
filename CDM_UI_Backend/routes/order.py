"""
API routes for managing default sort order for Objects, Variables, and Lists grids.
Stores order data in Neo4j to ensure persistence across devices and sessions.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from db import get_driver

router = APIRouter()

# Pydantic models for order data
class ObjectsOrderRequest(BaseModel):
    beingOrder: List[str]
    avatarOrders: Dict[str, List[str]]  # key: being, value: array of avatars
    objectOrders: Dict[str, List[str]]  # key: "being|avatar", value: array of objects

class VariablesOrderRequest(BaseModel):
    partOrder: List[str]
    sectionOrders: Dict[str, List[str]]  # key: part, value: array of sections
    groupOrders: Dict[str, List[str]]  # key: "part|section", value: array of groups
    variableOrders: Dict[str, List[str]]  # key: "part|section|group", value: array of variables

class ListsOrderRequest(BaseModel):
    setOrder: List[str]
    groupingOrders: Dict[str, List[str]]  # key: set, value: array of groupings
    listOrders: Dict[str, List[str]]  # key: "set|grouping", value: array of lists

def get_or_create_order_node(session, grid_type: str):
    """Get or create the Order node for a specific grid type"""
    result = session.run(
        """
        MERGE (o:Order {gridType: $gridType})
        ON CREATE SET o.createdAt = datetime()
        ON MATCH SET o.updatedAt = datetime()
        RETURN o
        """,
        gridType=grid_type
    )
    return result.single()

@router.get("/order/objects")
async def get_objects_order():
    """
    Get the saved order for Objects grid (Being, Avatar, Object).
    Returns None if no order has been saved yet.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            result = session.run(
                """
                MATCH (o:Order {gridType: 'objects'})
                RETURN o.beingOrder as beingOrder,
                       o.avatarOrders as avatarOrders,
                       o.objectOrders as objectOrders
                LIMIT 1
                """
            )
            record = result.single()
            
            if record and (record.get("beingOrder") or record.get("avatarOrders") or record.get("objectOrders")):
                # Parse JSON strings if they're stored as strings
                being_order = record.get("beingOrder")
                avatar_orders = record.get("avatarOrders")
                object_orders = record.get("objectOrders")
                
                # If stored as strings, parse them
                if isinstance(being_order, str):
                    import json
                    being_order = json.loads(being_order) if being_order else []
                if isinstance(avatar_orders, str):
                    import json
                    avatar_orders = json.loads(avatar_orders) if avatar_orders else {}
                if isinstance(object_orders, str):
                    import json
                    object_orders = json.loads(object_orders) if object_orders else {}
                
                return {
                    "beingOrder": being_order or [],
                    "avatarOrders": avatar_orders or {},
                    "objectOrders": object_orders or {}
                }
            else:
                return None

    except Exception as e:
        print(f"Error retrieving objects order: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve objects order: {str(e)}")

@router.post("/order/objects")
async def save_objects_order(order: ObjectsOrderRequest):
    """
    Save the order for Objects grid (Being, Avatar, Object).
    This will overwrite any existing order.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Store as JSON strings in Neo4j (since Neo4j doesn't natively support nested objects)
            import json
            being_order_json = json.dumps(order.beingOrder)
            avatar_orders_json = json.dumps(order.avatarOrders)
            object_orders_json = json.dumps(order.objectOrders)
            
            session.run(
                """
                MERGE (o:Order {gridType: 'objects'})
                SET o.beingOrder = $beingOrder,
                    o.avatarOrders = $avatarOrders,
                    o.objectOrders = $objectOrders,
                    o.updatedAt = datetime()
                ON CREATE SET o.createdAt = datetime()
                """,
                beingOrder=being_order_json,
                avatarOrders=avatar_orders_json,
                objectOrders=object_orders_json
            )
            
            print(f"✅ Saved objects order: {len(order.beingOrder)} beings, {len(order.avatarOrders)} avatar contexts, {len(order.objectOrders)} object contexts")
            return {"success": True, "message": "Objects order saved successfully"}

    except Exception as e:
        print(f"Error saving objects order: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save objects order: {str(e)}")

@router.get("/order/variables")
async def get_variables_order():
    """
    Get the saved order for Variables grid (Part, Section, Group, Variable).
    Returns None if no order has been saved yet.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            result = session.run(
                """
                MATCH (o:Order {gridType: 'variables'})
                RETURN o.partOrder as partOrder,
                       o.sectionOrders as sectionOrders,
                       o.groupOrders as groupOrders,
                       o.variableOrders as variableOrders
                LIMIT 1
                """
            )
            record = result.single()
            
            if record and (record.get("partOrder") or record.get("sectionOrders") or record.get("groupOrders") or record.get("variableOrders")):
                # Parse JSON strings if they're stored as strings
                import json
                part_order = record.get("partOrder")
                section_orders = record.get("sectionOrders")
                group_orders = record.get("groupOrders")
                variable_orders = record.get("variableOrders")
                
                if isinstance(part_order, str):
                    part_order = json.loads(part_order) if part_order else []
                if isinstance(section_orders, str):
                    section_orders = json.loads(section_orders) if section_orders else {}
                if isinstance(group_orders, str):
                    group_orders = json.loads(group_orders) if group_orders else {}
                if isinstance(variable_orders, str):
                    variable_orders = json.loads(variable_orders) if variable_orders else {}
                
                return {
                    "partOrder": part_order or [],
                    "sectionOrders": section_orders or {},
                    "groupOrders": group_orders or {},
                    "variableOrders": variable_orders or {}
                }
            else:
                return None

    except Exception as e:
        print(f"Error retrieving variables order: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve variables order: {str(e)}")

@router.post("/order/variables")
async def save_variables_order(order: VariablesOrderRequest):
    """
    Save the order for Variables grid (Part, Section, Group, Variable).
    This will overwrite any existing order.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Store as JSON strings in Neo4j
            import json
            part_order_json = json.dumps(order.partOrder)
            section_orders_json = json.dumps(order.sectionOrders)
            group_orders_json = json.dumps(order.groupOrders)
            variable_orders_json = json.dumps(order.variableOrders)
            
            session.run(
                """
                MERGE (o:Order {gridType: 'variables'})
                SET o.partOrder = $partOrder,
                    o.sectionOrders = $sectionOrders,
                    o.groupOrders = $groupOrders,
                    o.variableOrders = $variableOrders,
                    o.updatedAt = datetime()
                ON CREATE SET o.createdAt = datetime()
                """,
                partOrder=part_order_json,
                sectionOrders=section_orders_json,
                groupOrders=group_orders_json,
                variableOrders=variable_orders_json
            )
            
            print(f"✅ Saved variables order: {len(order.partOrder)} parts, {len(order.sectionOrders)} section contexts, {len(order.groupOrders)} group contexts, {len(order.variableOrders)} variable contexts")
            return {"success": True, "message": "Variables order saved successfully"}

    except Exception as e:
        print(f"Error saving variables order: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save variables order: {str(e)}")

@router.get("/order/lists")
async def get_lists_order():
    """
    Get the saved order for Lists grid (Set, Grouping, List).
    Returns None if no order has been saved yet.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            result = session.run(
                """
                MATCH (o:Order {gridType: 'lists'})
                RETURN o.setOrder as setOrder,
                       o.groupingOrders as groupingOrders,
                       o.listOrders as listOrders
                LIMIT 1
                """
            )
            record = result.single()
            
            if record and (record.get("setOrder") or record.get("groupingOrders") or record.get("listOrders")):
                # Parse JSON strings if they're stored as strings
                import json
                set_order = record.get("setOrder")
                grouping_orders = record.get("groupingOrders")
                list_orders = record.get("listOrders")
                
                if isinstance(set_order, str):
                    set_order = json.loads(set_order) if set_order else []
                if isinstance(grouping_orders, str):
                    grouping_orders = json.loads(grouping_orders) if grouping_orders else {}
                if isinstance(list_orders, str):
                    list_orders = json.loads(list_orders) if list_orders else {}
                
                return {
                    "setOrder": set_order or [],
                    "groupingOrders": grouping_orders or {},
                    "listOrders": list_orders or {}
                }
            else:
                return None

    except Exception as e:
        print(f"Error retrieving lists order: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve lists order: {str(e)}")

@router.post("/order/lists")
async def save_lists_order(order: ListsOrderRequest):
    """
    Save the order for Lists grid (Set, Grouping, List).
    This will overwrite any existing order.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Store as JSON strings in Neo4j
            import json
            set_order_json = json.dumps(order.setOrder)
            grouping_orders_json = json.dumps(order.groupingOrders)
            list_orders_json = json.dumps(order.listOrders)
            
            session.run(
                """
                MERGE (o:Order {gridType: 'lists'})
                SET o.setOrder = $setOrder,
                    o.groupingOrders = $groupingOrders,
                    o.listOrders = $listOrders,
                    o.updatedAt = datetime()
                ON CREATE SET o.createdAt = datetime()
                """,
                setOrder=set_order_json,
                groupingOrders=grouping_orders_json,
                listOrders=list_orders_json
            )
            
            print(f"✅ Saved lists order: {len(order.setOrder)} sets, {len(order.groupingOrders)} grouping contexts, {len(order.listOrders)} list contexts")
            return {"success": True, "message": "Lists order saved successfully"}

    except Exception as e:
        print(f"Error saving lists order: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save lists order: {str(e)}")

