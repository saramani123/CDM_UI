from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Literal
from db import get_driver

router = APIRouter()

# Driver types
DriverType = Literal["sectors", "domains", "countries", "objectClarifiers", "variableClarifiers"]

def get_driver_label(driver_type: DriverType) -> str:
    """Convert driver type to Neo4j label"""
    label_map = {
        "sectors": "Sector",
        "domains": "Domain", 
        "countries": "Country",
        "objectClarifiers": "ObjectClarifier",
        "variableClarifiers": "VariableClarifier"
    }
    return label_map[driver_type]

@router.get("/drivers/{driver_type}")
async def get_drivers(driver_type: DriverType):
    """
    Get all drivers of a specific type.
    Returns list of driver names.
    """
    driver = get_driver()
    if not driver:
        # Return empty list if no Neo4j connection
        return []
    
    try:
        label = get_driver_label(driver_type)
        with driver.session() as session:
            result = session.run(f"MATCH (d:{label}) RETURN d.name as name, d.order as order ORDER BY COALESCE(d.order, 999999), d.name")
            drivers = [record["name"] for record in result]
            return drivers
            
    except Exception as e:
        print(f"Error querying {driver_type}: {e}")
        return []

@router.post("/drivers/{driver_type}")
async def create_driver(driver_type: DriverType, driver_data: Dict[str, Any]):
    """
    Create a new driver value.
    """
    # Countries cannot be added (pre-defined)
    if driver_type == "countries":
        raise HTTPException(status_code=403, detail="Countries cannot be added - they are pre-defined")
    
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=503, detail="Neo4j connection not available")
    
    name = driver_data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Driver name is required")
    
    try:
        label = get_driver_label(driver_type)
        with driver.session() as session:
            # Check if driver already exists
            existing = session.run(f"MATCH (d:{label} {{name: $name}}) RETURN d", name=name)
            if existing.single():
                raise HTTPException(status_code=409, detail=f"{label} '{name}' already exists")
            
            # Create new driver
            session.run(f"CREATE (d:{label} {{name: $name}})", name=name)
            return {"message": f"{label} '{name}' created successfully", "name": name}
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating {driver_type}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create {driver_type}")

@router.put("/drivers/{driver_type}/reorder/")
async def reorder_drivers(driver_type: DriverType, reorder_data: Dict[str, Any]):
    """
    Reorder drivers of a specific type.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=503, detail="Neo4j connection not available")
    
    try:
        ordered_names = reorder_data.get("orderedNames", [])
        if not ordered_names:
            raise HTTPException(status_code=400, detail="orderedNames is required")
        
        label = get_driver_label(driver_type)
        with driver.session() as session:
            # Update the order property for each driver
            for index, name in enumerate(ordered_names):
                session.run("""
                    MATCH (d:{label} {{name: $name}})
                    SET d.order = $order
                """.format(label=label), name=name, order=index)
            
            return {"message": f"Successfully reordered {len(ordered_names)} {driver_type}"}
            
    except Exception as e:
        print(f"Error reordering {driver_type}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reorder drivers: {str(e)}")

@router.put("/drivers/{driver_type}/{old_name}")
async def update_driver(driver_type: DriverType, old_name: str, driver_data: Dict[str, Any]):
    """
    Rename an existing driver value.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=503, detail="Neo4j connection not available")
    
    new_name = driver_data.get("name", "").strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="New driver name is required")
    
    if new_name == old_name:
        return {"message": "No changes made", "name": new_name}
    
    try:
        label = get_driver_label(driver_type)
        with driver.session() as session:
            # Check if old driver exists
            old_driver = session.run(f"MATCH (d:{label} {{name: $old_name}}) RETURN d", old_name=old_name)
            if not old_driver.single():
                raise HTTPException(status_code=404, detail=f"{label} '{old_name}' not found")
            
            # Check if new name already exists
            existing = session.run(f"MATCH (d:{label} {{name: $new_name}}) RETURN d", new_name=new_name)
            if existing.single():
                raise HTTPException(status_code=409, detail=f"{label} '{new_name}' already exists")
            
            # Update the driver name
            session.run(f"MATCH (d:{label} {{name: $old_name}}) SET d.name = $new_name", 
                       old_name=old_name, new_name=new_name)
            
            return {"message": f"{label} renamed from '{old_name}' to '{new_name}'", "name": new_name}
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating {driver_type}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update {driver_type}")

@router.delete("/drivers/{driver_type}/{name}")
async def delete_driver(driver_type: DriverType, name: str):
    """
    Delete a driver value.
    """
    # Countries cannot be deleted (pre-defined)
    if driver_type == "countries":
        raise HTTPException(status_code=403, detail="Countries cannot be deleted - they are pre-defined")
    
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=503, detail="Neo4j connection not available")
    
    try:
        label = get_driver_label(driver_type)
        with driver.session() as session:
            # Check if driver exists
            existing = session.run(f"MATCH (d:{label} {{name: $name}}) RETURN d", name=name)
            if not existing.single():
                raise HTTPException(status_code=404, detail=f"{label} '{name}' not found")
            
            # Delete the driver node (relationships will be automatically severed)
            result = session.run(f"MATCH (d:{label} {{name: $name}}) DETACH DELETE d", name=name)
            
            return {"message": f"{label} '{name}' deleted successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting {driver_type}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete {driver_type}")

@router.post("/drivers/{driver_type}/bulk")
async def bulk_create_drivers(driver_type: DriverType, drivers_data: Dict[str, Any]):
    """
    Bulk create driver values (for CSV upload).
    Skips duplicates and only creates new nodes.
    """
    # Countries cannot be added (pre-defined)
    if driver_type == "countries":
        raise HTTPException(status_code=403, detail="Countries cannot be added - they are pre-defined")
    
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=503, detail="Neo4j connection not available")
    
    names = drivers_data.get("names", [])
    if not names:
        raise HTTPException(status_code=400, detail="Driver names list is required")
    
    # Clean and validate names
    clean_names = [name.strip() for name in names if name.strip()]
    if not clean_names:
        raise HTTPException(status_code=400, detail="No valid driver names provided")
    
    try:
        label = get_driver_label(driver_type)
        with driver.session() as session:
            created_count = 0
            skipped_count = 0
            
            for name in clean_names:
                # Check if driver already exists
                existing = session.run(f"MATCH (d:{label} {{name: $name}}) RETURN d", name=name)
                if not existing.single():
                    # Create new driver
                    session.run(f"CREATE (d:{label} {{name: $name}})", name=name)
                    created_count += 1
                else:
                    skipped_count += 1
            
            return {
                "message": f"Bulk operation completed",
                "created": created_count,
                "skipped": skipped_count,
                "total_processed": len(clean_names)
            }
            
    except Exception as e:
        print(f"Error in bulk create {driver_type}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to bulk create {driver_type}")

@router.get("/drivers/{driver_type}/relationships")
async def get_driver_relationships(driver_type: DriverType, name: str):
    """
    Get relationships for a specific driver value.
    Useful for checking what Objects/Variables/Lists use this driver.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=503, detail="Neo4j connection not available")
    
    try:
        label = get_driver_label(driver_type)
        with driver.session() as session:
            # Find relationships to Objects, Variables, and Lists
            result = session.run(f"""
                MATCH (d:{label} {{name: $name}})
                OPTIONAL MATCH (d)-[r]-(related)
                WHERE related:Object OR related:Variable OR related:List
                RETURN type(r) as relationship_type, 
                       labels(related) as related_labels,
                       related.id as related_id,
                       related.object as object_name,
                       related.variable as variable_name,
                       related.list as list_name
            """, name=name)
            
            relationships = []
            for record in result:
                relationships.append({
                    "type": record["relationship_type"],
                    "related_type": record["related_labels"][0] if record["related_labels"] else "Unknown",
                    "related_id": record["related_id"],
                    "name": record["object_name"] or record["variable_name"] or record["list_name"]
                })
            
            return {
                "driver_name": name,
                "driver_type": label,
                "relationships": relationships,
                "count": len(relationships)
            }
            
    except Exception as e:
        print(f"Error getting relationships for {driver_type}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get relationships")
