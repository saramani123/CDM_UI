from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import uuid
from db import get_driver

router = APIRouter()

# Dummy data that matches the frontend ObjectData interface
dummy_objects = [
    {
        "id": "1",
        "driver": "ALL, ALL, ALL, Employment Type",
        "being": "Master",
        "avatar": "Company",
        "object": "Company",
        "relationships": 13,
        "variants": 23,
        "variables": 54,
        "status": "Active",
        "relationshipsList": [
            {
                "id": "1",
                "type": "Inter-Table",
                "role": "Employer",
                "toBeing": "Master",
                "toAvatar": "Employee",
                "toObject": "Employee"
            },
            {
                "id": "2",
                "type": "Inter-Table",
                "role": "Owner",
                "toBeing": "Master",
                "toAvatar": "Product",
                "toObject": "Product"
            }
        ],
        "variantsList": [
            {
                "id": "1",
                "name": "Public Company"
            },
            {
                "id": "2",
                "name": "Private Company"
            }
        ]
    },
    {
        "id": "2",
        "driver": "ALL, ALL, ALL, Pay Type",
        "being": "Master",
        "avatar": "Company Affiliate",
        "object": "Entity",
        "relationships": 1,
        "variants": 2,
        "variables": 45,
        "status": "Active",
        "relationshipsList": [],
        "variantsList": []
    },
    {
        "id": "3",
        "driver": "Technology, Human Resources, United States, Employment Type",
        "being": "Master",
        "avatar": "Company Affiliate",
        "object": "Department",
        "relationships": 13,
        "variants": 23,
        "variables": 54,
        "status": "Active",
        "relationshipsList": []
    },
    {
        "id": "4",
        "driver": "Healthcare, Finance & Accounting, Canada, Pay Type",
        "being": "Master",
        "avatar": "Company Affiliate",
        "object": "Team",
        "relationships": 30,
        "variants": 19,
        "variables": 54,
        "status": "Active",
        "relationshipsList": []
    },
    {
        "id": "5",
        "driver": "Financial Services, Sales & Marketing, United Kingdom, Hour Type",
        "being": "Master",
        "avatar": "Company Affiliate",
        "object": "Region",
        "relationships": 39,
        "variants": 23,
        "variables": 54,
        "status": "Active",
        "relationshipsList": []
    }
]

@router.get("/objects", response_model=List[Dict[str, Any]])
async def get_objects():
    """
    Get all objects from the CDM.
    Uses Neo4j if available, otherwise returns dummy data.
    """
    driver = get_driver()
    if not driver:
        print("No Neo4j connection, returning dummy data")
        return dummy_objects
    
    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (o:Object)
                RETURN o.id as id, o.driver as driver, o.being as being, 
                       o.avatar as avatar, o.object as object, o.relationships as relationships,
                       o.variants as variants, o.variables as variables, o.status as status
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
                    "relationships": record["relationships"],
                    "variants": record["variants"],
                    "variables": record["variables"],
                    "status": record["status"],
                    "relationshipsList": [],  # TODO: Add relationship queries
                    "variantsList": []        # TODO: Add variant queries
                }
                objects.append(obj)
            
            print(f"Retrieved {len(objects)} objects from Neo4j")
            return objects
            
    except Exception as e:
        print(f"Error querying Neo4j: {e}")
        print("Falling back to dummy data")
        return dummy_objects

@router.get("/objects/{object_id}", response_model=Dict[str, Any])
async def get_object(object_id: str):
    """
    Get a specific object by ID.
    """
    for obj in dummy_objects:
        if obj["id"] == object_id:
            return obj
    
    raise HTTPException(status_code=404, detail="Object not found")

@router.post("/objects", response_model=Dict[str, Any])
async def create_object(object_data: Dict[str, Any]):
    """
    Create a new object.
    This is a placeholder for future implementation with Neo4j.
    """
    # Generate a new ID
    new_id = str(uuid.uuid4())
    object_data["id"] = new_id
    
    # Add to dummy data (in real implementation, this would be saved to Neo4j)
    dummy_objects.append(object_data)
    
    return object_data

@router.put("/objects/{object_id}", response_model=Dict[str, Any])
async def update_object(object_id: str, object_data: Dict[str, Any]):
    """
    Update an existing object.
    This is a placeholder for future implementation with Neo4j.
    """
    for i, obj in enumerate(dummy_objects):
        if obj["id"] == object_id:
            # Update the object
            object_data["id"] = object_id
            dummy_objects[i] = object_data
            return object_data
    
    raise HTTPException(status_code=404, detail="Object not found")

@router.delete("/objects/{object_id}")
async def delete_object(object_id: str):
    """
    Delete an object.
    This is a placeholder for future implementation with Neo4j.
    """
    for i, obj in enumerate(dummy_objects):
        if obj["id"] == object_id:
            deleted_obj = dummy_objects.pop(i)
            return {"message": f"Object {object_id} deleted successfully", "deleted_object": deleted_obj}
    
    raise HTTPException(status_code=404, detail="Object not found")
