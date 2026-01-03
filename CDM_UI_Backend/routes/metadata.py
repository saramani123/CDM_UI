"""
API routes for managing Metadata.
Stores metadata data in PostgreSQL database for permanent persistence.
Falls back to JSON files if PostgreSQL is not available.
This ensures data survives Render deployments and redeploys.
"""

import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from pathlib import Path

# Try to import PostgreSQL, fall back to JSON if not available
try:
    from db_postgres import get_db_session, MetadataModel
    POSTGRES_AVAILABLE = True
except Exception as e:
    print(f"⚠️  PostgreSQL not available, using JSON files: {e}")
    POSTGRES_AVAILABLE = False

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
    render_env = os.getenv("RENDER")
    if render_env and render_env.strip():
        return "production"
    environment = os.getenv("ENVIRONMENT", "development")
    return environment

# JSON file fallback functions
def get_metadata_file_path():
    """Get the path to the metadata JSON file for the current environment"""
    backend_dir = Path(__file__).parent.parent
    environment = get_environment()
    metadata_file = backend_dir / f"metadata.{environment}.json"
    backend_dir.mkdir(parents=True, exist_ok=True)
    print(f"DEBUG: Metadata file path - Environment: {environment}, File: {metadata_file}", flush=True)
    return metadata_file

def load_metadata_json() -> List[dict]:
    """Load metadata from JSON file (fallback)"""
    file_path = get_metadata_file_path()
    environment = get_environment()
    
    if not file_path.exists():
        if environment == "development":
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
            save_metadata_json(default_data)
            return default_data
        else:
            save_metadata_json([])
            return []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading metadata: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load metadata: {str(e)}")

def save_metadata_json(data: List[dict]):
    """Save metadata to JSON file (fallback)"""
    file_path = get_metadata_file_path()
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving metadata: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save metadata: {str(e)}")

# PostgreSQL functions
def load_metadata_postgres() -> List[dict]:
    """Load metadata from PostgreSQL"""
    db = get_db_session()
    if not db:
        return load_metadata_json()  # Fallback to JSON
    
    try:
        items = db.query(MetadataModel).all()
        metadata = []
        for item in items:
            result = {
                "id": item.id,
                "layer": item.layer or "",
                "concept": item.concept or "",
                "number": item.number or "",
                "examples": item.examples or "",
            }
            if item.detailData:
                result["detailData"] = item.detailData
            metadata.append(result)
        return metadata
    except Exception as e:
        print(f"Error loading metadata from PostgreSQL: {e}")
        db.close()
        return load_metadata_json()  # Fallback to JSON
    finally:
        db.close()

def load_metadata() -> List[dict]:
    """Load metadata - tries PostgreSQL first, falls back to JSON"""
    if POSTGRES_AVAILABLE:
        try:
            return load_metadata_postgres()
        except:
            return load_metadata_json()
    return load_metadata_json()

@router.get("/metadata")
async def get_metadata():
    """Get all metadata items"""
    try:
        print("DEBUG: /api/v1/metadata endpoint called")
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
    """Get a specific metadata item by ID"""
    try:
        if POSTGRES_AVAILABLE:
            db = get_db_session()
            if db:
                try:
                    item = db.query(MetadataModel).filter(MetadataModel.id == item_id).first()
                    if item:
                        result = {
                            "id": item.id,
                            "layer": item.layer or "",
                            "concept": item.concept or "",
                            "number": item.number or "",
                            "examples": item.examples or "",
                        }
                        if item.detailData:
                            result["detailData"] = item.detailData
                        return result
                finally:
                    db.close()
        
        # Fallback to JSON
        metadata = load_metadata_json()
        item = next((m for m in metadata if m.get("id") == item_id), None)
        if not item:
            raise HTTPException(status_code=404, detail=f"Metadata item with id {item_id} not found")
        
        result = dict(item)
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
    """Create a new metadata item"""
    try:
        if POSTGRES_AVAILABLE:
            db = get_db_session()
            if db:
                try:
                    # Check if ID exists
                    existing = db.query(MetadataModel).filter(MetadataModel.id == item.id).first()
                    if existing:
                        raise HTTPException(status_code=400, detail=f"Metadata item with id {item.id} already exists")
                    
                    # Check uniqueness
                    duplicate = db.query(MetadataModel).filter(
                        MetadataModel.layer.ilike(item.layer),
                        MetadataModel.concept.ilike(item.concept)
                    ).first()
                    if duplicate:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Metadata item with Layer '{item.layer}' and Concept '{item.concept}' already exists."
                        )
                    
                    # Create new item
                    new_item = MetadataModel(
                        id=item.id,
                        layer=item.layer,
                        concept=item.concept,
                        number=item.number,
                        examples=item.examples,
                        detailData=None
                    )
                    db.add(new_item)
                    db.commit()
                    return item.dict()
                except HTTPException:
                    db.rollback()
                    raise
                except Exception as e:
                    db.rollback()
                    print(f"PostgreSQL error, falling back to JSON: {e}")
                finally:
                    db.close()
        
        # Fallback to JSON
        file_path = get_metadata_file_path()
        print(f"DEBUG: Creating metadata item - File: {file_path}, Environment: {get_environment()}", flush=True)
        metadata = load_metadata_json()
        print(f"DEBUG: Loaded {len(metadata)} metadata items from {file_path}", flush=True)
        
        if any(m.get("id") == item.id for m in metadata):
            raise HTTPException(status_code=400, detail=f"Metadata item with id {item.id} already exists")
        
        existing = next((
            m for m in metadata 
            if m.get("layer", "").lower() == item.layer.lower() and 
               m.get("concept", "").lower() == item.concept.lower()
        ), None)
        
        if existing:
            raise HTTPException(
                status_code=400, 
                detail=f"Metadata item with Layer '{item.layer}' and Concept '{item.concept}' already exists."
            )
        
        new_item = item.dict()
        metadata.append(new_item)
        save_metadata_json(metadata)
        return new_item
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating metadata item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create metadata item: {str(e)}")

@router.put("/metadata/{item_id}")
async def update_metadata_item(item_id: str, update: MetadataUpdateRequest):
    """Update a metadata item by ID"""
    try:
        if POSTGRES_AVAILABLE:
            db = get_db_session()
            if db:
                try:
                    item = db.query(MetadataModel).filter(MetadataModel.id == item_id).first()
                    if not item:
                        raise HTTPException(status_code=404, detail=f"Metadata item with id {item_id} not found")
                    
                    if update.layer is not None:
                        item.layer = update.layer
                    if update.concept is not None:
                        item.concept = update.concept
                    if update.number is not None:
                        item.number = update.number
                    if update.examples is not None:
                        item.examples = update.examples
                    if update.detailData is not None:
                        item.detailData = update.detailData
                    
                    db.commit()
                    return {
                        "id": item.id,
                        "layer": item.layer or "",
                        "concept": item.concept or "",
                        "number": item.number or "",
                        "examples": item.examples or "",
                        "detailData": item.detailData
                    }
                except HTTPException:
                    db.rollback()
                    raise
                except Exception as e:
                    db.rollback()
                    print(f"PostgreSQL error, falling back to JSON: {e}")
                finally:
                    db.close()
        
        # Fallback to JSON
        metadata = load_metadata_json()
        item_index = next((i for i, m in enumerate(metadata) if m.get("id") == item_id), None)
        if item_index is None:
            raise HTTPException(status_code=404, detail=f"Metadata item with id {item_id} not found")
        
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
            item["detailData"] = update.detailData
        
        save_metadata_json(metadata)
        return item
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating metadata item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update metadata item: {str(e)}")

@router.delete("/metadata/{item_id}")
async def delete_metadata_item(item_id: str):
    """Delete a metadata item by ID"""
    try:
        if POSTGRES_AVAILABLE:
            db = get_db_session()
            if db:
                try:
                    item = db.query(MetadataModel).filter(MetadataModel.id == item_id).first()
                    if not item:
                        raise HTTPException(status_code=404, detail=f"Metadata item with id {item_id} not found")
                    
                    deleted_item = {
                        "id": item.id,
                        "layer": item.layer or "",
                        "concept": item.concept or "",
                        "number": item.number or "",
                        "examples": item.examples or ""
                    }
                    db.delete(item)
                    db.commit()
                    return {"message": f"Metadata item {item_id} deleted successfully", "deleted": deleted_item}
                except HTTPException:
                    db.rollback()
                    raise
                except Exception as e:
                    db.rollback()
                    print(f"PostgreSQL error, falling back to JSON: {e}")
                finally:
                    db.close()
        
        # Fallback to JSON
        metadata = load_metadata_json()
        item_index = next((i for i, m in enumerate(metadata) if m.get("id") == item_id), None)
        if item_index is None:
            raise HTTPException(status_code=404, detail=f"Metadata item with id {item_id} not found")
        
        deleted_item = metadata.pop(item_index)
        save_metadata_json(metadata)
        return {"message": f"Metadata item {item_id} deleted successfully", "deleted": deleted_item}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting metadata item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete metadata item: {str(e)}")

@router.delete("/metadata")
async def clear_all_metadata():
    """Clear ALL metadata data - use with caution!"""
    try:
        deleted_count = 0
        
        if POSTGRES_AVAILABLE:
            db = get_db_session()
            if db:
                try:
                    deleted_count = db.query(MetadataModel).delete()
                    db.commit()
                    print(f"✅ Cleared {deleted_count} metadata entries from PostgreSQL")
                except Exception as e:
                    db.rollback()
                    print(f"⚠️  Error clearing PostgreSQL metadata: {e}")
                finally:
                    db.close()
        
        # Also clear JSON files
        file_path = get_metadata_file_path()
        if file_path.exists():
            metadata = load_metadata_json()
            json_count = len(metadata)
            save_metadata_json([])
            deleted_count += json_count
            print(f"✅ Cleared {json_count} metadata entries from JSON file")
        
        return {
            "message": "All metadata data cleared successfully",
            "deleted_count": deleted_count
        }
    except Exception as e:
        print(f"Error clearing metadata: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear metadata: {str(e)}")
