"""
API routes for managing Sources.
Stores sources data in a JSON file (not in Neo4j as this is not graph data).
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
class SourceItem(BaseModel):
    id: str
    sector: str
    domain: str
    country: str
    system: str
    sub_system: str
    type: str
    table: str
    column: str
    cdm_full_variable: str

class SourceUpdateRequest(BaseModel):
    sector: Optional[str] = None
    domain: Optional[str] = None
    country: Optional[str] = None
    system: Optional[str] = None
    sub_system: Optional[str] = None
    type: Optional[str] = None
    table: Optional[str] = None
    column: Optional[str] = None
    cdm_full_variable: Optional[str] = None
    detailData: Optional[str] = None

def get_environment():
    """Get the current environment (development or production)"""
    # Check if running on Render (production)
    # RENDER env var is set by Render platform, so if it exists and is not empty, we're in production
    render_env = os.getenv("RENDER")
    if render_env and render_env.strip():
        return "production"
    # Otherwise check ENVIRONMENT variable (set in render.yaml)
    environment = os.getenv("ENVIRONMENT", "development")
    return environment

# Path to sources JSON file (environment-specific)
def get_sources_file_path():
    """Get the path to the sources JSON file for the current environment"""
    # Get the backend directory (parent of routes directory)
    backend_dir = Path(__file__).parent.parent
    environment = get_environment()
    # Use environment-specific filename: sources.development.json or sources.production.json
    sources_file = backend_dir / f"sources.{environment}.json"
    # Ensure the directory exists
    backend_dir.mkdir(parents=True, exist_ok=True)
    # Debug logging
    print(f"DEBUG: Sources file path - Environment: {environment}, File: {sources_file}", flush=True)
    return sources_file

def load_sources() -> List[dict]:
    """Load sources from JSON file"""
    file_path = get_sources_file_path()
    environment = get_environment()
    
    if not file_path.exists():
        # Only initialize with default data in development
        # Production should start with empty data
        if environment == "development":
            # Mock data for dev with detailData
            default_data = [
                {
                    "id": "1",
                    "sector": "Finance",
                    "domain": "Banking",
                    "country": "US",
                    "system": "Core Banking System",
                    "sub_system": "Account Management",
                    "type": "Database",
                    "table": "accounts",
                    "column": "account_id",
                    "cdm_full_variable": "Account.AccountID",
                    "detailData": json.dumps({
                        "drivers": {
                            "sector": "Finance",
                            "domain": "Banking",
                            "country": "US"
                        },
                        "map": {
                            "object": "Account",
                            "variable": "AccountID",
                            "list": "",
                            "transformation": ""
                        },
                        "format": {
                            "format_s_i": "String",
                            "format_s_ii": "Identifier",
                            "format_v_i": "Text",
                            "format_v_ii": "Static"
                        },
                        "ontology": {
                            "being": "Entity",
                            "avatar": "Account",
                            "tier": "1",
                            "part": "Identification",
                            "section": "Primary",
                            "group": "Keys",
                            "group_type": "Primary Key",
                            "group_key": "AccountID"
                        },
                        "validation": {
                            "source": "accounts.account_id",
                            "vulqan": ""
                        }
                    })
                }
            ]
            save_sources(default_data)
            return default_data
        else:
            # Production: start with empty array
            save_sources([])
            return []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading sources: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load sources: {str(e)}")

def save_sources(data: List[dict]):
    """Save sources to JSON file"""
    file_path = get_sources_file_path()
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving sources: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save sources: {str(e)}")

@router.get("/sources")
async def get_sources():
    """
    Get all sources items.
    """
    try:
        print("DEBUG: /api/v1/sources endpoint called")
        file_path = get_sources_file_path()
        print(f"DEBUG: Sources file path: {file_path}")
        print(f"DEBUG: File exists: {file_path.exists()}")
        sources = load_sources()
        print(f"DEBUG: Loaded {len(sources)} sources items")
        return sources
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error retrieving sources: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to retrieve sources: {str(e)}")

@router.get("/sources/{item_id}")
async def get_source_item(item_id: str):
    """
    Get a specific source item by ID.
    """
    try:
        sources = load_sources()
        item = next((s for s in sources if s.get("id") == item_id), None)
        if not item:
            raise HTTPException(status_code=404, detail=f"Source item with id {item_id} not found")
        
        # Ensure detailData is included in response
        result = dict(item)  # Create a copy
        if "detailData" not in result:
            result["detailData"] = None
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error retrieving source item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve source item: {str(e)}")

@router.post("/sources")
async def create_source_item(item: SourceItem):
    """
    Create a new source item.
    """
    try:
        sources = load_sources()
        
        # Check if ID already exists
        if any(s.get("id") == item.id for s in sources):
            raise HTTPException(status_code=400, detail=f"Source item with id {item.id} already exists")
        
        # Check for uniqueness: All fields combination must be unique
        existing = next((
            s for s in sources 
            if s.get("sector", "").lower() == item.sector.lower() and 
               s.get("domain", "").lower() == item.domain.lower() and
               s.get("country", "").lower() == item.country.lower() and
               s.get("system", "").lower() == item.system.lower() and
               s.get("sub_system", "").lower() == item.sub_system.lower() and
               s.get("type", "").lower() == item.type.lower() and
               s.get("table", "").lower() == item.table.lower() and
               s.get("column", "").lower() == item.column.lower() and
               s.get("cdm_full_variable", "").lower() == item.cdm_full_variable.lower()
        ), None)
        
        if existing:
            raise HTTPException(
                status_code=400, 
                detail=f"Source item with this combination of all fields already exists. Each combination must be unique."
            )
        
        new_item = item.dict()
        new_item["detailData"] = None
        sources.append(new_item)
        save_sources(sources)
        return new_item
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating source item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create source item: {str(e)}")

@router.put("/sources/{item_id}")
async def update_source_item(item_id: str, update: SourceUpdateRequest):
    """
    Update a source item by ID.
    """
    try:
        sources = load_sources()
        item_index = next((i for i, s in enumerate(sources) if s.get("id") == item_id), None)
        
        if item_index is None:
            raise HTTPException(status_code=404, detail=f"Source item with id {item_id} not found")
        
        # Update only provided fields
        item = sources[item_index]
        if update.sector is not None:
            item["sector"] = update.sector
        if update.domain is not None:
            item["domain"] = update.domain
        if update.country is not None:
            item["country"] = update.country
        if update.system is not None:
            item["system"] = update.system
        if update.sub_system is not None:
            item["sub_system"] = update.sub_system
        if update.type is not None:
            item["type"] = update.type
        if update.table is not None:
            item["table"] = update.table
        if update.column is not None:
            item["column"] = update.column
        if update.cdm_full_variable is not None:
            item["cdm_full_variable"] = update.cdm_full_variable
        if update.detailData is not None:
            item["detailData"] = update.detailData
        
        save_sources(sources)
        return item
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating source item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update source item: {str(e)}")

@router.delete("/sources/{item_id}")
async def delete_source_item(item_id: str):
    """
    Delete a source item by ID.
    """
    try:
        sources = load_sources()
        item_index = next((i for i, s in enumerate(sources) if s.get("id") == item_id), None)
        
        if item_index is None:
            raise HTTPException(status_code=404, detail=f"Source item with id {item_id} not found")
        
        deleted_item = sources.pop(item_index)
        save_sources(sources)
        return {"message": f"Source item {item_id} deleted successfully", "deleted": deleted_item}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting source item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete source item: {str(e)}")

