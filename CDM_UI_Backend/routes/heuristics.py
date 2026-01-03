"""
API routes for managing Heuristics.
Stores heuristics data in PostgreSQL database for permanent persistence.
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
    from db_postgres import get_db_session, HeuristicModel
    POSTGRES_AVAILABLE = True
except Exception as e:
    print(f"⚠️  PostgreSQL not available, using JSON files: {e}")
    POSTGRES_AVAILABLE = False

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

def get_environment():
    """Get the current environment (development or production)"""
    render_env = os.getenv("RENDER")
    if render_env and render_env.strip():
        return "production"
    environment = os.getenv("ENVIRONMENT", "development")
    return environment

# JSON file fallback functions
def get_heuristics_file_path():
    """Get the path to the heuristics JSON file for the current environment"""
    backend_dir = Path(__file__).parent.parent
    environment = get_environment()
    heuristics_file = backend_dir / f"heuristics.{environment}.json"
    backend_dir.mkdir(parents=True, exist_ok=True)
    print(f"DEBUG: Heuristics file path - Environment: {environment}, File: {heuristics_file}", flush=True)
    return heuristics_file

def load_heuristics_json() -> List[dict]:
    """Load heuristics from JSON file (fallback)"""
    file_path = get_heuristics_file_path()
    if not file_path.exists():
        save_heuristics_json([])
        return []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading heuristics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load heuristics: {str(e)}")

def save_heuristics_json(data: List[dict]):
    """Save heuristics to JSON file (fallback)"""
    file_path = get_heuristics_file_path()
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving heuristics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save heuristics: {str(e)}")

# PostgreSQL functions
def load_heuristics_postgres() -> List[dict]:
    """Load heuristics from PostgreSQL"""
    db = get_db_session()
    if not db:
        return load_heuristics_json()  # Fallback to JSON
    
    try:
        items = db.query(HeuristicModel).all()
        heuristics = []
        for item in items:
            result = {
                "id": item.id,
                "sector": item.sector or "",
                "domain": item.domain or "",
                "country": item.country or "",
                "agent": item.agent or "",
                "procedure": item.procedure or "",
                "rules": item.rules or "",
                "best": item.best or "",
            }
            if item.detailData:
                result["detailData"] = item.detailData
            heuristics.append(result)
        return heuristics
    except Exception as e:
        print(f"Error loading heuristics from PostgreSQL: {e}")
        db.close()
        return load_heuristics_json()  # Fallback to JSON
    finally:
        db.close()

def load_heuristics() -> List[dict]:
    """Load heuristics - tries PostgreSQL first, falls back to JSON"""
    if POSTGRES_AVAILABLE:
        try:
            return load_heuristics_postgres()
        except:
            return load_heuristics_json()
    return load_heuristics_json()

@router.get("/heuristics")
async def get_heuristics():
    """Get all heuristics items"""
    try:
        print("DEBUG: /api/v1/heuristics endpoint called")
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
    """Get a specific heuristic item by ID"""
    try:
        if POSTGRES_AVAILABLE:
            db = get_db_session()
            if db:
                try:
                    item = db.query(HeuristicModel).filter(HeuristicModel.id == item_id).first()
                    if item:
                        result = {
                            "id": item.id,
                            "sector": item.sector or "",
                            "domain": item.domain or "",
                            "country": item.country or "",
                            "agent": item.agent or "",
                            "procedure": item.procedure or "",
                            "rules": item.rules or "",
                            "best": item.best or "",
                        }
                        if item.detailData:
                            result["detailData"] = item.detailData
                        return result
                finally:
                    db.close()
        
        # Fallback to JSON
        heuristics = load_heuristics_json()
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
    """Create a new heuristic item"""
    try:
        if POSTGRES_AVAILABLE:
            db = get_db_session()
            if db:
                try:
                    # Check if ID exists
                    existing = db.query(HeuristicModel).filter(HeuristicModel.id == item.id).first()
                    if existing:
                        raise HTTPException(status_code=400, detail=f"Heuristic item with id {item.id} already exists")
                    
                    # Check uniqueness
                    duplicate = db.query(HeuristicModel).filter(
                        HeuristicModel.sector.ilike(item.sector),
                        HeuristicModel.domain.ilike(item.domain),
                        HeuristicModel.country.ilike(item.country),
                        HeuristicModel.agent.ilike(item.agent),
                        HeuristicModel.procedure.ilike(item.procedure)
                    ).first()
                    if duplicate:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Heuristic item with this combination already exists."
                        )
                    
                    # Create new item
                    new_item = HeuristicModel(
                        id=item.id,
                        sector=item.sector,
                        domain=item.domain,
                        country=item.country,
                        agent=item.agent,
                        procedure=item.procedure,
                        rules=item.rules,
                        best=item.best,
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
        heuristics = load_heuristics_json()
        
        if any(h.get("id") == item.id for h in heuristics):
            raise HTTPException(status_code=400, detail=f"Heuristic item with id {item.id} already exists")
        
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
                detail=f"Heuristic item with this combination already exists."
            )
        
        new_item = item.dict()
        heuristics.append(new_item)
        save_heuristics_json(heuristics)
        return new_item
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating heuristic item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create heuristic item: {str(e)}")

@router.put("/heuristics/{item_id}")
async def update_heuristic_item(item_id: str, update: HeuristicUpdateRequest):
    """Update a heuristic item by ID"""
    try:
        if POSTGRES_AVAILABLE:
            db = get_db_session()
            if db:
                try:
                    item = db.query(HeuristicModel).filter(HeuristicModel.id == item_id).first()
                    if not item:
                        raise HTTPException(status_code=404, detail=f"Heuristic item with id {item_id} not found")
                    
                    if update.sector is not None:
                        item.sector = update.sector
                    if update.domain is not None:
                        item.domain = update.domain
                    if update.country is not None:
                        item.country = update.country
                    if update.agent is not None:
                        item.agent = update.agent
                    if update.procedure is not None:
                        item.procedure = update.procedure
                    if update.rules is not None:
                        item.rules = update.rules
                    if update.best is not None:
                        item.best = update.best
                    if update.detailData is not None:
                        item.detailData = update.detailData
                    
                    db.commit()
                    return {
                        "id": item.id,
                        "sector": item.sector or "",
                        "domain": item.domain or "",
                        "country": item.country or "",
                        "agent": item.agent or "",
                        "procedure": item.procedure or "",
                        "rules": item.rules or "",
                        "best": item.best or "",
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
        heuristics = load_heuristics_json()
        item_index = next((i for i, h in enumerate(heuristics) if h.get("id") == item_id), None)
        if item_index is None:
            raise HTTPException(status_code=404, detail=f"Heuristic item with id {item_id} not found")
        
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
        
        save_heuristics_json(heuristics)
        return item
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating heuristic item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update heuristic item: {str(e)}")

@router.delete("/heuristics/{item_id}")
async def delete_heuristic_item(item_id: str):
    """Delete a heuristic item by ID"""
    try:
        if POSTGRES_AVAILABLE:
            db = get_db_session()
            if db:
                try:
                    item = db.query(HeuristicModel).filter(HeuristicModel.id == item_id).first()
                    if not item:
                        raise HTTPException(status_code=404, detail=f"Heuristic item with id {item_id} not found")
                    
                    deleted_item = {
                        "id": item.id,
                        "sector": item.sector or "",
                        "domain": item.domain or "",
                        "country": item.country or "",
                        "agent": item.agent or "",
                        "procedure": item.procedure or "",
                        "rules": item.rules or "",
                        "best": item.best or ""
                    }
                    db.delete(item)
                    db.commit()
                    return {"message": f"Heuristic item {item_id} deleted successfully", "deleted": deleted_item}
                except HTTPException:
                    db.rollback()
                    raise
                except Exception as e:
                    db.rollback()
                    print(f"PostgreSQL error, falling back to JSON: {e}")
                finally:
                    db.close()
        
        # Fallback to JSON
        heuristics = load_heuristics_json()
        item_index = next((i for i, h in enumerate(heuristics) if h.get("id") == item_id), None)
        if item_index is None:
            raise HTTPException(status_code=404, detail=f"Heuristic item with id {item_id} not found")
        
        deleted_item = heuristics.pop(item_index)
        save_heuristics_json(heuristics)
        return {"message": f"Heuristic item {item_id} deleted successfully", "deleted": deleted_item}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting heuristic item: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete heuristic item: {str(e)}")
