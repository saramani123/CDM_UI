"""
API routes for managing Heuristics.
Stores heuristics data in a JSON file (not in Neo4j as this is not graph data).
"""

import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from pathlib import Path

router = APIRouter()

# Pydantic models
class HeuristicItem(BaseModel):
    id: str
    sector: str
    domain: str
    country: str
    agent: str
    procedure: str
    rules: str
    best: str

class HeuristicUpdateRequest(BaseModel):
    sector: Optional[str] = None
    domain: Optional[str] = None
    country: Optional[str] = None
    agent: Optional[str] = None
    procedure: Optional[str] = None
    rules: Optional[str] = None
    best: Optional[str] = None
    detailData: Optional[str] = None

# Path to heuristics JSON file
def get_heuristics_file_path():
    """Get the path to the heuristics JSON file"""
    # Get the backend directory (parent of routes directory)
    backend_dir = Path(__file__).parent.parent
    heuristics_file = backend_dir / "heuristics.json"
    # Ensure the directory exists
    backend_dir.mkdir(parents=True, exist_ok=True)
    return heuristics_file

def load_heuristics() -> List[dict]:
    """Load heuristics from JSON file"""
    file_path = get_heuristics_file_path()
    if not file_path.exists():
        # Initialize with empty data if file doesn't exist
        save_heuristics([])
        return []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading heuristics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load heuristics: {str(e)}")

def save_heuristics(data: List[dict]):
    """Save heuristics to JSON file"""
    file_path = get_heuristics_file_path()
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving heuristics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save heuristics: {str(e)}")

@router.get("/heuristics")
async def get_heuristics():
    """
    Get all heuristics items.
    """
    try:
        print("DEBUG: /api/v1/heuristics endpoint called")
        file_path = get_heuristics_file_path()
        print(f"DEBUG: Heuristics file path: {file_path}")
        print(f"DEBUG: File exists: {file_path.exists()}")
        heuristics = load_heuristics()
        print(f"DEBUG: Loaded {len(heuristics)} heuristics items")
        return heuristics
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error retrieving heuristics: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to retrieve heuristics: {str(e)}")

@router.get("/heuristics/{item_id}")
async def get_heuristic_item(item_id: str):
    """
    Get a specific heuristic item by ID.
    """
    try:
        heuristics = load_heuristics()
        item = next((h for h in heuristics if h.get("id") == item_id), None)
        if not item:
            raise HTTPException(status_code=404, detail=f"Heuristic item with id {item_id} not found")
        return item
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error retrieving heuristic item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve heuristic item: {str(e)}")

@router.post("/heuristics")
async def create_heuristic_item(item: HeuristicItem):
    """
    Create a new heuristic item.
    """
    try:
        heuristics = load_heuristics()
        
        # Check if ID already exists
        if any(h.get("id") == item.id for h in heuristics):
            raise HTTPException(status_code=400, detail=f"Heuristic item with id {item.id} already exists")
        
        # Check for uniqueness: S + D + C + Agent + Procedure combination must be unique
        existing = next((
            h for h in heuristics 
            if h.get("sector", "").lower() == item.sector.lower() and 
               h.get("domain", "").lower() == item.domain.lower() and
               h.get("country", "").lower() == item.country.lower() and
               h.get("agent", "").lower() == item.agent.lower() and
               h.get("procedure", "").lower() == item.procedure.lower()
        ), None)
        
        if existing:
            raise HTTPException(
                status_code=400, 
                detail=f"Heuristic item with this combination of Sector, Domain, Country, Agent, and Procedure already exists. Each combination must be unique."
            )
        
        new_item = item.dict()
        heuristics.append(new_item)
        save_heuristics(heuristics)
        return new_item
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating heuristic item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create heuristic item: {str(e)}")

@router.put("/heuristics/{item_id}")
async def update_heuristic_item(item_id: str, update: HeuristicUpdateRequest):
    """
    Update a heuristic item by ID.
    """
    try:
        heuristics = load_heuristics()
        item_index = next((i for i, h in enumerate(heuristics) if h.get("id") == item_id), None)
        
        if item_index is None:
            raise HTTPException(status_code=404, detail=f"Heuristic item with id {item_id} not found")
        
        # Update only provided fields
        item = heuristics[item_index]
        if update.sector is not None:
            item["sector"] = update.sector
        if update.domain is not None:
            item["domain"] = update.domain
        if update.country is not None:
            item["country"] = update.country
        if update.agent is not None:
            item["agent"] = update.agent
        if update.procedure is not None:
            item["procedure"] = update.procedure
        if update.rules is not None:
            item["rules"] = update.rules
        if update.best is not None:
            item["best"] = update.best
        if update.detailData is not None:
            item["detailData"] = update.detailData
        
        save_heuristics(heuristics)
        return item
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating heuristic item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update heuristic item: {str(e)}")

@router.delete("/heuristics/{item_id}")
async def delete_heuristic_item(item_id: str):
    """
    Delete a heuristic item by ID.
    """
    try:
        heuristics = load_heuristics()
        item_index = next((i for i, h in enumerate(heuristics) if h.get("id") == item_id), None)
        
        if item_index is None:
            raise HTTPException(status_code=404, detail=f"Heuristic item with id {item_id} not found")
        
        deleted_item = heuristics.pop(item_index)
        save_heuristics(heuristics)
        return {"message": f"Heuristic item {item_id} deleted successfully", "deleted": deleted_item}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting heuristic item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete heuristic item: {str(e)}")

