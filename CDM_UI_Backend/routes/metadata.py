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
                {"id": "1", "layer": "Format", "concept": "Source", "sector": "", "domain": "", "country": "", "number": "", "examples": ""},
                {"id": "2", "layer": "Format", "concept": "Vulqan", "sector": "ALL", "domain": "ALL", "country": "ALL", "number": "", "examples": ""},
                {"id": "3", "layer": "Format", "concept": "Metric", "sector": "", "domain": "", "country": "", "number": "", "examples": ""},
                {"id": "4", "layer": "Ontology", "concept": "Element", "sector": "", "domain": "", "country": "", "number": "", "examples": ""},
                {"id": "5", "layer": "Ontology", "concept": "Being", "sector": "ALL", "domain": "ALL", "country": "ALL", "number": "", "examples": ""},
                {"id": "6", "layer": "Ontology", "concept": "Avatar", "sector": "ALL", "domain": "ALL", "country": "ALL", "number": "", "examples": ""},
                {"id": "7", "layer": "Ontology", "concept": "Tier", "sector": "", "domain": "", "country": "", "number": "", "examples": ""},
                {"id": "8", "layer": "Ontology", "concept": "Variant", "sector": "", "domain": "", "country": "", "number": "", "examples": ""},
                {"id": "9", "layer": "Ontology", "concept": "Universal", "sector": "", "domain": "", "country": "", "number": "", "examples": ""},
                {"id": "10", "layer": "Ontology", "concept": "Part", "sector": "ALL", "domain": "ALL", "country": "ALL", "number": "", "examples": ""},
                {"id": "11", "layer": "Ontology", "concept": "Section", "sector": "ALL", "domain": "ALL", "country": "ALL", "number": "", "examples": ""},
                {"id": "11a", "layer": "Ontology", "concept": "Group", "sector": "ALL", "domain": "ALL", "country": "ALL", "number": "", "examples": ""},
                {"id": "12", "layer": "Ontology", "concept": "Group-Type", "sector": "ALL", "domain": "ALL", "country": "ALL", "number": "", "examples": ""},
                {"id": "13", "layer": "Ontology", "concept": "List Set", "sector": "ALL", "domain": "ALL", "country": "ALL", "number": "", "examples": ""},
                {"id": "14", "layer": "Ontology", "concept": "List Grouping", "sector": "ALL", "domain": "ALL", "country": "ALL", "number": "", "examples": ""}
            ]
            save_metadata_json(default_data)
            return default_data
        else:
            save_metadata_json([])
            return []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            required_concepts = {req["concept"] for req in REQUIRED_METADATA_CONCEPTS}
            required_concepts_alt = {"Group-Type", "List Set", "List Grouping"}  # Alternative names
            # Ensure all items have S/D/C fields and isRequired flag
            for item in data:
                if "sector" not in item:
                    item["sector"] = ""
                if "domain" not in item:
                    item["domain"] = ""
                if "country" not in item:
                    item["country"] = ""
                # Mark required rows
                concept = item.get("concept", "")
                normalized_concept = normalize_concept_name(concept)
                item["isRequired"] = normalized_concept in required_concepts or concept in required_concepts_alt
            return data
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
        required_concepts = {req["concept"] for req in REQUIRED_METADATA_CONCEPTS}
        required_concepts_alt = {"Group-Type", "List Set", "List Grouping"}  # Alternative names
        for item in items:
            concept = item.concept or ""
            normalized_concept = normalize_concept_name(concept)
            is_required = normalized_concept in required_concepts or concept in required_concepts_alt
            result = {
                "id": item.id,
                "layer": item.layer or "",
                "concept": concept,
                "sector": getattr(item, 'sector', '') or "",
                "domain": getattr(item, 'domain', '') or "",
                "country": getattr(item, 'country', '') or "",
                "number": item.number or "",
                "examples": item.examples or "",
                "isRequired": is_required  # Mark required rows
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

# Required metadata concepts configuration
# Note: Handle both "G-Type" and "Group-Type", "Set" and "List Set", "Grouping" and "List Grouping"
REQUIRED_METADATA_CONCEPTS = [
    {
        "concept": "Vulqan",
        "layer": "Format",
        "sector": "ALL",
        "domain": "ALL",
        "country": "ALL",
        "levels": 3,
        "columns": ["Format V-I", "Format V-II", "Definition"]
    },
    {
        "concept": "Being",
        "layer": "Ontology",
        "sector": "ALL",
        "domain": "ALL",
        "country": "ALL",
        "levels": 2,
        "columns": ["Being", "Definition"]
    },
    {
        "concept": "Avatar",
        "layer": "Ontology",
        "sector": "ALL",
        "domain": "ALL",
        "country": "ALL",
        "levels": 3,
        "columns": ["Being", "Avatar", "Definition"]
    },
    {
        "concept": "Part",
        "layer": "Ontology",
        "sector": "ALL",
        "domain": "ALL",
        "country": "ALL",
        "levels": 2,
        "columns": ["Part", "Definition"]
    },
    {
        "concept": "Section",
        "layer": "Ontology",
        "sector": "ALL",
        "domain": "ALL",
        "country": "ALL",
        "levels": 3,
        "columns": ["Part", "Section", "Definition"]
    },
    {
        "concept": "Group",
        "layer": "Ontology",
        "sector": "ALL",
        "domain": "ALL",
        "country": "ALL",
        "levels": 4,
        "columns": ["Part", "Section", "Group", "Definition"]
    },
    {
        "concept": "G-Type",
        "layer": "Ontology",
        "sector": "ALL",
        "domain": "ALL",
        "country": "ALL",
        "levels": 2,
        "columns": ["G-Type", "Definition"]
    },
    {
        "concept": "Set",
        "layer": "Ontology",
        "sector": "ALL",
        "domain": "ALL",
        "country": "ALL",
        "levels": 2,
        "columns": ["Set", "Definition"]
    },
    {
        "concept": "Grouping",
        "layer": "Ontology",
        "sector": "ALL",
        "domain": "ALL",
        "country": "ALL",
        "levels": 3,
        "columns": ["Set", "Grouping", "Definition"]
    }
]

# Map alternative concept names to canonical names
CONCEPT_NAME_MAP = {
    "Group-Type": "G-Type",
    "List Set": "Set",
    "List Grouping": "Grouping"
}

def normalize_concept_name(concept: str) -> str:
    """Normalize concept name to handle variations"""
    return CONCEPT_NAME_MAP.get(concept, concept)

def ensure_required_metadata_rows():
    """Ensure all required metadata rows exist with proper configuration"""
    # Load metadata without calling ensure_required_metadata_rows to avoid recursion
    if POSTGRES_AVAILABLE:
        try:
            metadata = load_metadata_postgres()
        except:
            metadata = load_metadata_json()
    else:
        metadata = load_metadata_json()
    
    # Build a map of existing concepts, handling name variations
    existing_concepts = {}
    for item in metadata:
        concept = item.get("concept", "")
        normalized = normalize_concept_name(concept)
        key = (item.get("layer", ""), normalized)
        # Store with normalized key, but keep original concept name in item
        if key not in existing_concepts:
            existing_concepts[key] = item
    
    updated = False
    for req_concept in REQUIRED_METADATA_CONCEPTS:
        key = (req_concept["layer"], req_concept["concept"])
        # Check if this required concept exists (using normalized names)
        # Also check for alternative names
        existing_item = existing_concepts.get(key)
        if not existing_item:
            # Try to find by alternative names
            alt_names = {
                "G-Type": "Group-Type",
                "Set": "List Set",
                "Grouping": "List Grouping"
            }
            alt_name = alt_names.get(req_concept["concept"])
            if alt_name:
                # Check all items to find one with alternative name
                for item in metadata:
                    if item.get("layer") == req_concept["layer"] and item.get("concept") == alt_name:
                        existing_item = item
                        # Update it to use canonical name
                        existing_item["concept"] = req_concept["concept"]
                        # Update the map
                        existing_concepts[key] = existing_item
                        # Remove old key from map
                        old_key = (req_concept["layer"], normalize_concept_name(alt_name))
                        if old_key in existing_concepts:
                            del existing_concepts[old_key]
                        break
        
        if not existing_item:
            # Create new required row
            new_id = f"required-{req_concept['concept'].lower().replace('-', '_')}"
            # Check if ID already exists, if so generate a new one
            while any(m.get("id") == new_id for m in metadata):
                new_id = f"{new_id}-{len(metadata)}"
            
            # Create detailData with levels and columns
            detail_data = {
                "levels": req_concept["levels"],
                "columns": req_concept["columns"],
                "rows": []  # Empty rows for now
            }
            
            new_item = {
                "id": new_id,
                "layer": req_concept["layer"],
                "concept": req_concept["concept"],
                "sector": req_concept["sector"],
                "domain": req_concept["domain"],
                "country": req_concept["country"],
                "number": "",
                "examples": "",
                "detailData": json.dumps(detail_data),
                "isRequired": True  # Mark as required
            }
            
            metadata.append(new_item)
            existing_concepts[key] = new_item
            updated = True
        else:
            # Update existing row to ensure it has correct S/D/C values and detailData
            existing = existing_item
            needs_update = False
            
            # Mark as required
            existing["isRequired"] = True
            
            # Update concept name if it's an alternative name (e.g., "Group-Type" -> "G-Type")
            normalized_existing = normalize_concept_name(existing.get("concept", ""))
            if normalized_existing != existing.get("concept", ""):
                existing["concept"] = normalized_existing
                needs_update = True
            
            # Ensure S/D/C are set to ALL
            if existing.get("sector", "").upper() != "ALL":
                existing["sector"] = "ALL"
                needs_update = True
            if existing.get("domain", "").upper() != "ALL":
                existing["domain"] = "ALL"
                needs_update = True
            if existing.get("country", "").upper() != "ALL":
                existing["country"] = "ALL"
                needs_update = True
            
            # Ensure detailData has correct levels and columns
            detail_data_str = existing.get("detailData")
            if detail_data_str:
                try:
                    if isinstance(detail_data_str, str):
                        detail_data = json.loads(detail_data_str)
                    else:
                        detail_data = detail_data_str
                except:
                    detail_data = None
            else:
                detail_data = None
            
            if not detail_data or detail_data.get("levels") != req_concept["levels"] or detail_data.get("columns") != req_concept["columns"]:
                detail_data = {
                    "levels": req_concept["levels"],
                    "columns": req_concept["columns"],
                    "rows": detail_data.get("rows", []) if detail_data else []
                }
                existing["detailData"] = json.dumps(detail_data)
                needs_update = True
            
            if needs_update:
                updated = True
    
    if updated:
        if POSTGRES_AVAILABLE:
            try:
                db = get_db_session()
                if db:
                    try:
                        for item in metadata:
                            # Check if item exists in DB by ID first, then by layer+concept
                            existing = db.query(MetadataModel).filter(MetadataModel.id == item["id"]).first()
                            if not existing:
                                # Try to find by layer+concept (for existing items that need updating)
                                existing = db.query(MetadataModel).filter(
                                    MetadataModel.layer == item.get("layer", ""),
                                    MetadataModel.concept == item.get("concept", "")
                                ).first()
                            
                            if existing:
                                # Update existing
                                existing.layer = item.get("layer", "")
                                existing.concept = item.get("concept", "")
                                existing.sector = item.get("sector", "") or ""
                                existing.domain = item.get("domain", "") or ""
                                existing.country = item.get("country", "") or ""
                                existing.number = item.get("number", "")
                                existing.examples = item.get("examples", "")
                                if item.get("detailData"):
                                    existing.detailData = item.get("detailData")
                            else:
                                # Create new
                                new_item = MetadataModel(
                                    id=item["id"],
                                    layer=item.get("layer", ""),
                                    concept=item.get("concept", ""),
                                    sector=item.get("sector", "") or "",
                                    domain=item.get("domain", "") or "",
                                    country=item.get("country", "") or "",
                                    number=item.get("number", ""),
                                    examples=item.get("examples", ""),
                                    detailData=item.get("detailData")
                                )
                                db.add(new_item)
                        db.commit()
                    except Exception as e:
                        db.rollback()
                        print(f"Error updating required rows in PostgreSQL: {e}")
                    finally:
                        db.close()
            except Exception as e:
                print(f"PostgreSQL error, falling back to JSON: {e}")
        
        # Also save to JSON (for dev or as fallback)
        save_metadata_json(metadata)
    
    return metadata

def load_metadata() -> List[dict]:
    """Load metadata - tries PostgreSQL first, falls back to JSON"""
    if POSTGRES_AVAILABLE:
        try:
            metadata = load_metadata_postgres()
        except:
            metadata = load_metadata_json()
    else:
        metadata = load_metadata_json()
    
    # Ensure required rows exist
    return ensure_required_metadata_rows()

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
                            "sector": getattr(item, 'sector', '') or "",
                            "domain": getattr(item, 'domain', '') or "",
                            "country": getattr(item, 'country', '') or "",
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
                        sector=getattr(item, 'sector', '') or "",
                        domain=getattr(item, 'domain', '') or "",
                        country=getattr(item, 'country', '') or "",
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

def is_required_metadata_item(layer: str, concept: str) -> bool:
    """Check if a metadata item is one of the 9 required items"""
    required_concepts = {req["concept"] for req in REQUIRED_METADATA_CONCEPTS}
    return concept in required_concepts

@router.delete("/metadata/{item_id}")
async def delete_metadata_item(item_id: str):
    """Delete a metadata item by ID - prevents deletion of required items"""
    try:
        if POSTGRES_AVAILABLE:
            db = get_db_session()
            if db:
                try:
                    item = db.query(MetadataModel).filter(MetadataModel.id == item_id).first()
                    if not item:
                        raise HTTPException(status_code=404, detail=f"Metadata item with id {item_id} not found")
                    
                    # Check if this is a required item
                    if is_required_metadata_item(item.layer or "", item.concept or ""):
                        raise HTTPException(
                            status_code=400,
                            detail=f"Cannot delete required metadata item: {item.concept}. This item is required for the platform to function."
                        )
                    
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
        
        item = metadata[item_index]
        # Check if this is a required item
        if is_required_metadata_item(item.get("layer", ""), item.get("concept", "")):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete required metadata item: {item.get('concept')}. This item is required for the platform to function."
            )
        
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
