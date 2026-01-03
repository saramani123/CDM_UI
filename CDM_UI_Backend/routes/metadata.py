"""
API routes for managing Metadata.
Stores metadata data in a JSON file (not in Neo4j as this is not graph data).
Uses environment-specific files to separate dev and prod data.
"""

import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from pathlib import Path

router = APIRouter()

# Pydantic models
class MetadataItem(BaseModel):
    id: str
    layer: str
    concept: str
    number: str
    examples: str

class MetadataUpdateRequest(BaseModel):
    layer: Optional[str] = None
    concept: Optional[str] = None
    number: Optional[str] = None
    examples: Optional[str] = None
    detailData: Optional[str] = None  # JSON string storing modal data

def get_environment():
    """Get the current environment (development or production)"""
    # Check if running on Render (production)
    # RENDER env var is set by Render platform, so if it exists and is not empty, we're in production
    render_env = os.getenv("RENDER")
    if render_env and render_env.strip():
        return "production"
    # Otherwise check ENVIRONMENT variable
    return os.getenv("ENVIRONMENT", "development")

# Path to metadata JSON file - use absolute path based on current file location
# Uses environment-specific filename to separate dev and prod data
def get_metadata_file_path():
    """Get the path to the metadata JSON file for the current environment"""
    # Get the backend directory (parent of routes directory)
    backend_dir = Path(__file__).parent.parent
    environment = get_environment()
    # Use environment-specific filename: metadata.dev.json or metadata.prod.json
    metadata_file = backend_dir / f"metadata.{environment}.json"
    # Ensure the directory exists
    backend_dir.mkdir(parents=True, exist_ok=True)
    return metadata_file

def load_metadata() -> List[dict]:
    """Load metadata from JSON file"""
    file_path = get_metadata_file_path()
    if not file_path.exists():
        # Initialize with default data if file doesn't exist
        default_data = [
            {"id": "1", "layer": "Format", "concept": "Source", "number": "", "examples": ""},
            {"id": "2", "layer": "Format", "concept": "Vulqan", "number": "", "examples": ""},
            {"id": "3", "layer": "Format", "concept": "Metric", "number": "", "examples": ""},
            {"id": "4", "layer": "Ontology", "concept": "Element", "number": "", "examples": ""},
            {"id": "5", "layer": "Ontology", "concept": "Being", "number": "", "examples": ""},
            {"id": "6", "layer": "Ontology", "concept": "Avatar", "number": "", "examples": ""},
            {"id": "7", "layer": "Ontology", "concept": "Tier", "number": "", "examples": ""},
            {"id": "8", "layer": "Ontology", "concept": "Variant", "number": "", "examples": ""},
            {"id": "9", "layer": "Ontology", "concept": "Universal", "number": "", "examples": ""},
            {"id": "10", "layer": "Ontology", "concept": "Part", "number": "", "examples": ""},
            {"id": "11", "layer": "Ontology", "concept": "Section", "number": "", "examples": ""},
            {"id": "12", "layer": "Ontology", "concept": "Group-Type", "number": "", "examples": ""},
            {"id": "13", "layer": "Ontology", "concept": "List Set", "number": "", "examples": ""},
            {"id": "14", "layer": "Ontology", "concept": "List Grouping", "number": "", "examples": ""}
        ]
        save_metadata(default_data)
        return default_data
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading metadata: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load metadata: {str(e)}")

def save_metadata(data: List[dict]):
    """Save metadata to JSON file"""
    file_path = get_metadata_file_path()
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving metadata: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save metadata: {str(e)}")

@router.get("/metadata")
async def get_metadata():
    """
    Get all metadata items.
    """
    try:
        print("DEBUG: /api/v1/metadata endpoint called")
        file_path = get_metadata_file_path()
        print(f"DEBUG: Metadata file path: {file_path}")
        print(f"DEBUG: File exists: {file_path.exists()}")
        metadata = load_metadata()
        print(f"DEBUG: Loaded {len(metadata)} metadata items")
        return metadata
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error retrieving metadata: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to retrieve metadata: {str(e)}")

@router.get("/metadata/{item_id}")
async def get_metadata_item(item_id: str):
    """
    Get a specific metadata item by ID.
    """
    try:
        metadata = load_metadata()
        item = next((m for m in metadata if m.get("id") == item_id), None)
        if not item:
            raise HTTPException(status_code=404, detail=f"Metadata item with id {item_id} not found")
        
        # Ensure detailData is included in response
        result = dict(item)  # Create a copy
        if "detailData" not in result:
            result["detailData"] = None
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error retrieving metadata item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve metadata item: {str(e)}")

@router.post("/metadata")
async def create_metadata_item(item: MetadataItem):
    """
    Create a new metadata item.
    """
    try:
        metadata = load_metadata()
        
        # Check if ID already exists
        if any(m.get("id") == item.id for m in metadata):
            raise HTTPException(status_code=400, detail=f"Metadata item with id {item.id} already exists")
        
        # Check for uniqueness: Layer + Concept combination must be unique
        existing = next((
            m for m in metadata 
            if m.get("layer", "").lower() == item.layer.lower() and 
               m.get("concept", "").lower() == item.concept.lower()
        ), None)
        
        if existing:
            raise HTTPException(
                status_code=400, 
                detail=f"Metadata item with Layer '{item.layer}' and Concept '{item.concept}' already exists. Each combination must be unique."
            )
        
        new_item = item.dict()
        metadata.append(new_item)
        save_metadata(metadata)
        return new_item
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating metadata item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create metadata item: {str(e)}")

@router.put("/metadata/{item_id}")
async def update_metadata_item(item_id: str, update: MetadataUpdateRequest):
    """
    Update a metadata item by ID.
    """
    try:
        metadata = load_metadata()
        item_index = next((i for i, m in enumerate(metadata) if m.get("id") == item_id), None)
        
        if item_index is None:
            raise HTTPException(status_code=404, detail=f"Metadata item with id {item_id} not found")
        
        # Update only provided fields
        item = metadata[item_index]
        if update.layer is not None:
            item["layer"] = update.layer
        if update.concept is not None:
            item["concept"] = update.concept
        if update.number is not None:
            item["number"] = update.number
        if update.examples is not None:
            item["examples"] = update.examples
        if update.detailData is not None:
            # Parse and store detailData
            try:
                detail_data = json.loads(update.detailData) if isinstance(update.detailData, str) else update.detailData
                item["detailData"] = detail_data
            except json.JSONDecodeError:
                # If invalid JSON, store as string
                item["detailData"] = update.detailData
        
        save_metadata(metadata)
        return item
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating metadata item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update metadata item: {str(e)}")

@router.delete("/metadata/{item_id}")
async def delete_metadata_item(item_id: str):
    """
    Delete a metadata item by ID.
    """
    try:
        metadata = load_metadata()
        item_index = next((i for i, m in enumerate(metadata) if m.get("id") == item_id), None)
        
        if item_index is None:
            raise HTTPException(status_code=404, detail=f"Metadata item with id {item_id} not found")
        
        deleted_item = metadata.pop(item_index)
        save_metadata(metadata)
        return {"message": f"Metadata item {item_id} deleted successfully", "deleted": deleted_item}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting metadata item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete metadata item: {str(e)}")

