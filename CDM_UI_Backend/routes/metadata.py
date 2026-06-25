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
from typing import List, Optional, Dict, Any
from pathlib import Path
from db import get_driver

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
                {"id": "2", "layer": "Format", "concept": "Format VII", "sector": "ALL", "domain": "ALL", "country": "ALL", "number": "", "examples": ""},
                {"id": "3", "layer": "Format", "concept": "Metric", "sector": "", "domain": "", "country": "", "number": "", "examples": ""},
                {"id": "4", "layer": "Ontology", "concept": "Element", "sector": "", "domain": "", "country": "", "number": "", "examples": ""},
                {"id": "5", "layer": "Ontology", "concept": "Being", "sector": "ALL", "domain": "ALL", "country": "ALL", "number": "", "examples": ""},
                {"id": "6", "layer": "Ontology", "concept": "Avatar", "sector": "ALL", "domain": "ALL", "country": "ALL", "number": "", "examples": ""},
                {"id": "7", "layer": "Ontology", "concept": "Tier", "sector": "", "domain": "", "country": "", "number": "", "examples": ""},
                {"id": "8", "layer": "Ontology", "concept": "Variant", "sector": "", "domain": "", "country": "", "number": "", "examples": ""},
                {"id": "9", "layer": "Ontology", "concept": "Universal", "sector": "", "domain": "", "country": "", "number": "", "examples": ""},
                {"id": "10", "layer": "Ontology", "concept": "Part", "sector": "ALL", "domain": "ALL", "country": "ALL", "number": "", "examples": ""},
                {"id": "11", "layer": "Ontology", "concept": "Section", "sector": "ALL", "domain": "ALL", "country": "ALL", "number": "", "examples": ""},
                {"id": "13", "layer": "Ontology", "concept": "List Set", "sector": "ALL", "domain": "ALL", "country": "ALL", "number": "", "examples": ""}
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
            required_concepts_alt = {"List Set", "List Grouping"}  # Alternative names
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
        required_concepts_alt = {"List Set", "List Grouping"}  # Alternative names
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
            # Always include key so clients can distinguish null vs missing (matches JSON path).
            result["detailData"] = getattr(item, "detailData", None)
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
        "concept": "Source Format",
        "layer": "Format",
        "sector": "ALL",
        "domain": "ALL",
        "country": "ALL",
        "levels": 2,
        "columns": ["Source Format", "Definition"]
    },
    {
        "concept": "Format VI",
        "layer": "Format",
        "sector": "ALL",
        "domain": "ALL",
        "country": "ALL",
        "levels": 2,
        "columns": ["Format VI", "Definition"]
    },
    {
        "concept": "Format VII",
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
# "Vulqan" is the legacy name for the "Format VII" concept (one-time rename on load).
CONCEPT_NAME_MAP = {
    "List Set": "Set",
    "List Grouping": "Grouping",
    "Vulqan": "Format VII"
}

# Concepts that were removed from the metadata grid entirely. Any persisted rows
# with these concept names are hidden on load and never re-created.
REMOVED_METADATA_CONCEPTS = {"Group", "G-Type", "Group-Type"}

def normalize_concept_name(concept: str) -> str:
    """Normalize concept name to handle variations"""
    return CONCEPT_NAME_MAP.get(concept, concept)

# ---------------------------------------------------------------------------
# Driver concepts (Sector / Domain / Country)
#
# These three metadata rows are special: their VALUES live exclusively as
# Neo4j nodes (labels Sector/Domain/Country) so Objects/Variables/Lists can
# have relationships to them. They are surfaced in the Metadata tab as
# synthetic rows but are NEVER persisted to PostgreSQL/JSON. Editing happens
# through the /drivers endpoints, not through the metadata store.
# ---------------------------------------------------------------------------
DRIVER_CONCEPTS = [
    {"id": "drivers-sector", "concept": "Sector", "label": "Sector", "driverType": "sectors"},
    {"id": "drivers-domain", "concept": "Domain", "label": "Domain", "driverType": "domains"},
    {"id": "drivers-country", "concept": "Country", "label": "Country", "driverType": "countries"},
]
DRIVER_LAYER = "Drivers"
DRIVER_CONCEPT_IDS = {dc["id"] for dc in DRIVER_CONCEPTS}
DRIVER_CONCEPT_NAMES = {dc["concept"] for dc in DRIVER_CONCEPTS}


def is_driver_metadata_id(item_id: str) -> bool:
    """True if the given metadata id is one of the synthetic driver concept rows."""
    return item_id in DRIVER_CONCEPT_IDS


def get_driver_metadata_rows() -> List[dict]:
    """
    Build the three synthetic Sector/Domain/Country metadata rows from Neo4j.

    The values shown in the detail modal (column 1) come straight from the
    Neo4j driver nodes; column 2 (Abbreviation) is left blank here because
    abbreviations are stored client-side (localStorage). These rows are
    returned to the client for display but are never written to Postgres/JSON.
    """
    label_map = {"sectors": "Sector", "domains": "Domain", "countries": "Country"}
    driver = get_driver()
    rows: List[dict] = []

    for dc in DRIVER_CONCEPTS:
        items: List[tuple] = []  # (name, abbreviation)
        if driver:
            try:
                label = label_map[dc["driverType"]]
                with driver.session() as session:
                    result = session.run(
                        f"MATCH (d:{label}) "
                        f"RETURN d.name as name, coalesce(d.abbreviation, '') as abbreviation "
                        f"ORDER BY COALESCE(d.order, 999999), d.name"
                    )
                    items = [
                        (r["name"], r["abbreviation"] or "")
                        for r in result
                        if r.get("name") and r["name"] != "ALL"
                    ]
            except Exception as e:
                print(f"Error loading driver values for {dc['driverType']}: {e}")
                items = []

        names = [name for name, _ in items]
        detail_data = {
            "levels": 2,
            "columns": [dc["label"], "Abbreviation"],
            "rows": [[name, abbr] for name, abbr in items],
        }

        rows.append({
            "id": dc["id"],
            "layer": DRIVER_LAYER,
            "concept": dc["concept"],
            "sector": "",
            "domain": "",
            "country": "",
            "number": str(len(names)),
            "examples": ", ".join(names),
            "isRequired": True,
            "isDriverConcept": True,
            "driverType": dc["driverType"],
            "detailData": json.dumps(detail_data),
        })

    return rows

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
    
    # Ensure required rows exist (persisted concepts only)
    metadata = ensure_required_metadata_rows()

    # Hide concepts that were removed from the metadata grid entirely
    # (Group / G-Type / Grouping). Stale persisted rows are filtered out here.
    metadata = [
        m for m in metadata
        if m.get("concept", "") not in REMOVED_METADATA_CONCEPTS
    ]

    # Surface the synthetic Sector/Domain/Country driver rows (Neo4j-backed,
    # never persisted to Postgres/JSON). Guard against any stale persisted
    # copies that may exist from earlier states.
    metadata = [m for m in metadata if m.get("id") not in DRIVER_CONCEPT_IDS]
    return get_driver_metadata_rows() + metadata

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

# Format V-I to Format V-II mapping (must match frontend formatMapping.ts exactly)
# Format V-II values are dependent on Format V-I. (blank) values excluded.
FORMAT_I_TO_FORMAT_II_MAPPING = {
    'Contact': ['Email', 'Phone', 'PostalCode', 'URL', 'Zip'],
    'Freeform': ['Document', 'Label', 'Text'],
    'ID': ['Private', 'Public', 'Vulqan'],
    'List': ['Flag', 'Reference', 'Specific', 'Static', 'Vulqan'],
    'Number': ['Amount', 'Any', 'Currency', 'Decimal', 'Integer', 'Percent'],
    'Time': ['Date', 'DateTime', 'Month', 'Period']
}

# Valid Format V-I values in sorted order (matches frontend getAllFormatIValues())
VALID_FORMAT_I_VALUES = sorted(FORMAT_I_TO_FORMAT_II_MAPPING.keys())

# ---------------------------------------------------------------------------
# Format VI / Format VII master (single source of truth)
#
# Format VI / VII values are user-managed via their metadata rows. The master
# list lives in each row's detailData:
#   Format VI  -> rows: [[formatVI, definition], ...]
#   Format VII -> rows: [[parentFormatVI, formatVII, definition], ...]
# Variables keep denormalized v.formatI / v.formatII string properties; editing
# or deleting a value here cascades down to those properties.
# ---------------------------------------------------------------------------

FORMAT_VI_CONCEPTS = {"format vi"}
FORMAT_VII_CONCEPTS = {"format vii", "vulqan"}


def _load_all_metadata_items() -> List[dict]:
    """Load all metadata items from the active store (Postgres or JSON)."""
    if POSTGRES_AVAILABLE:
        return load_metadata_postgres()
    return load_metadata_json()


def _parse_detail_data(item: Optional[dict]) -> Optional[dict]:
    if not item:
        return None
    dd = item.get("detailData")
    if not dd:
        return None
    if isinstance(dd, str):
        try:
            return json.loads(dd)
        except Exception:
            return None
    if isinstance(dd, dict):
        return dd
    return None


def _find_item_by_concept(items: List[dict], concept_names: set) -> Optional[dict]:
    for it in items:
        if (it.get("concept") or "").strip().lower() in concept_names:
            return it
    return None


def _detail_rows(item: Optional[dict]) -> List[List[str]]:
    dd = _parse_detail_data(item)
    if dd and isinstance(dd.get("rows"), list):
        return [list(r) for r in dd["rows"] if isinstance(r, list)]
    return []


def _persist_detaildata_by_id(item_id: str, detail_data: dict) -> bool:
    """Persist a metadata item's detailData to the active store."""
    dd_str = json.dumps(detail_data)
    if POSTGRES_AVAILABLE:
        db = get_db_session()
        if db:
            try:
                m = db.query(MetadataModel).filter(MetadataModel.id == item_id).first()
                if not m:
                    return False
                m.detailData = dd_str
                db.commit()
                return True
            except Exception as e:
                db.rollback()
                print(f"Error persisting detailData for {item_id}: {e}")
                return False
            finally:
                db.close()
    metadata = load_metadata_json()
    for m in metadata:
        if m.get("id") == item_id:
            m["detailData"] = dd_str
            save_metadata_json(metadata)
            return True
    return False


def _distinct_variable_format_pairs() -> List[tuple]:
    """Distinct (formatI, formatII) pairs currently present on Variable nodes."""
    driver = get_driver()
    if not driver:
        return []
    pairs: List[tuple] = []
    try:
        with driver.session() as session:
            result = session.run(
                """
                MATCH (v:Variable)
                WHERE v.formatI IS NOT NULL AND trim(v.formatI) <> ''
                RETURN DISTINCT trim(v.formatI) AS fi, coalesce(trim(v.formatII), '') AS fii
                """
            )
            for record in result:
                fi = (record.get("fi") or "").strip()
                fii = (record.get("fii") or "").strip()
                if fi:
                    pairs.append((fi, fii))
    except Exception as e:
        print(f"Error reading variable format pairs: {e}")
    return pairs


def _build_seed_master() -> tuple:
    """
    Build the initial Format VI / VII master from the built-in mapping plus any
    values already present on Variable nodes (so existing data is preserved).
    Returns (vi_values: List[str], pairs: List[(vi, vii)]).
    """
    vi_values: List[str] = []
    pairs: List[tuple] = []
    seen_vi: set = set()
    seen_pair: set = set()

    def add_vi(vi: str):
        key = vi.lower()
        if vi and key not in seen_vi:
            seen_vi.add(key)
            vi_values.append(vi)

    def add_pair(vi: str, vii: str):
        if not vi or not vii:
            return
        key = (vi.lower(), vii.lower())
        if key not in seen_pair:
            seen_pair.add(key)
            pairs.append((vi, vii))

    # Built-in mapping first (canonical order)
    for vi in VALID_FORMAT_I_VALUES:
        add_vi(vi)
        for vii in sorted(FORMAT_I_TO_FORMAT_II_MAPPING.get(vi, [])):
            add_pair(vi, vii)

    # Merge values already on Variable nodes so nothing breaks
    for fi, fii in _distinct_variable_format_pairs():
        add_vi(fi)
        if fii:
            add_pair(fi, fii)

    return vi_values, pairs


def ensure_format_master_seeded() -> None:
    """
    Make sure the Format VI/VII master exists and is internally consistent.
    Idempotent: full-seeds when empty, otherwise just reconciles so that every
    Format VII parent is also materialized as a Format VI row (needed for
    rename/delete to work).
    """
    items = _load_all_metadata_items()
    vi_item = _find_item_by_concept(items, FORMAT_VI_CONCEPTS)
    vii_item = _find_item_by_concept(items, FORMAT_VII_CONCEPTS)

    vi_rows = _detail_rows(vi_item)
    vii_rows = _detail_rows(vii_item)

    has_vi = any(r and str(r[0]).strip() for r in vi_rows)
    has_vii = any(len(r) >= 2 and str(r[0]).strip() and str(r[1]).strip() for r in vii_rows)

    if not has_vi and not has_vii:
        vi_values, pairs = _build_seed_master()
        if vi_item:
            _persist_detaildata_by_id(vi_item["id"], {
                "levels": 2,
                "columns": ["Format VI", "Definition"],
                "rows": [[vi, ""] for vi in vi_values],
            })
        if vii_item:
            _persist_detaildata_by_id(vii_item["id"], {
                "levels": 3,
                "columns": ["Format V-I", "Format V-II", "Definition"],
                "rows": [[vi, vii, ""] for (vi, vii) in pairs],
            })
        return

    # Reconcile: ensure every Format VII parent is present as a Format VI row.
    if vi_item:
        existing_vi = {str(r[0]).strip().lower() for r in vi_rows if r and str(r[0]).strip()}
        missing: List[str] = []
        seen: set = set()
        for r in vii_rows:
            if len(r) >= 2 and str(r[0]).strip():
                parent = str(r[0]).strip()
                key = parent.lower()
                if key not in existing_vi and key not in seen:
                    seen.add(key)
                    missing.append(parent)
        if missing:
            _persist_detaildata_by_id(vi_item["id"], {
                "levels": 2,
                "columns": ["Format VI", "Definition"],
                "rows": vi_rows + [[p, ""] for p in missing],
            })


def get_format_mapping() -> Dict[str, List[str]]:
    """
    Canonical Format VI -> [Format VII...] mapping sourced from the metadata
    master. Falls back to the built-in mapping merged with existing variable
    values when the master has not been seeded yet.
    """
    items = _load_all_metadata_items()
    vi_item = _find_item_by_concept(items, FORMAT_VI_CONCEPTS)
    vii_item = _find_item_by_concept(items, FORMAT_VII_CONCEPTS)

    mapping: Dict[str, List[str]] = {}

    for row in _detail_rows(vi_item):
        if row and str(row[0]).strip():
            mapping.setdefault(str(row[0]).strip(), [])

    for row in _detail_rows(vii_item):
        if len(row) >= 2 and str(row[0]).strip() and str(row[1]).strip():
            parent = str(row[0]).strip()
            vii = str(row[1]).strip()
            mapping.setdefault(parent, [])
            if vii not in mapping[parent]:
                mapping[parent].append(vii)

    if not mapping:
        vi_values, pairs = _build_seed_master()
        for vi in vi_values:
            mapping.setdefault(vi, [])
        for vi, vii in pairs:
            if vii not in mapping[vi]:
                mapping[vi].append(vii)

    return mapping


def _get_format_items():
    items = _load_all_metadata_items()
    return (
        _find_item_by_concept(items, FORMAT_VI_CONCEPTS),
        _find_item_by_concept(items, FORMAT_VII_CONCEPTS),
    )


def _vi_detail(vi_item) -> dict:
    return {"levels": 2, "columns": ["Format VI", "Definition"], "rows": _detail_rows(vi_item)}


def _vii_detail(vii_item) -> dict:
    return {
        "levels": 3,
        "columns": ["Format V-I", "Format V-II", "Definition"],
        "rows": _detail_rows(vii_item),
    }


def _run_variable_format_update(cypher: str, params: dict) -> int:
    """Run a cascade update on Variable nodes; returns number of properties set."""
    driver = get_driver()
    if not driver:
        return 0
    try:
        with driver.session() as session:
            result = session.run(cypher, **params)
            return result.consume().counters.properties_set
    except Exception as e:
        print(f"Error cascading format update to variables: {e}")
        return 0

@router.get("/metadata/being-values")
async def get_being_values():
    """
    Get all distinct Being values from Being nodes in Neo4j.
    Returns all Being values that are used in the Objects grid.
    Used for populating the Being metadata concept widget.
    
    Results are sorted alphabetically.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")
    
    try:
        with driver.session() as session:
            # Get all distinct Being values from Being nodes
            # These are the same values shown in the Objects grid's Being column
            result = session.run("""
                MATCH (b:Being)
                WHERE b.name IS NOT NULL AND b.name <> ''
                RETURN DISTINCT b.name as being
                ORDER BY b.name
            """)
            
            beings = []
            for record in result:
                being = record.get("being", "").strip()
                if being:
                    beings.append(being)
            
            print(f"Found {len(beings)} distinct Being values from Neo4j")
            
            return {
                "beings": beings,
                "count": len(beings)
            }
    except Exception as e:
        print(f"Error fetching Being values: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch Being values: {str(e)}")

@router.get("/metadata/group-values")
async def get_group_values():
    """
    Get all distinct Part–Section–Group triplets from the same graph path as the Variables grid:
    Part -[:HAS_SECTION]-> Section -[:HAS_VARIABLE]-> Variable (Group is the v.group property).

    Used for populating the Group metadata concept widget (ontology hierarchy).
    Results are sorted by Part, then Section, then Group.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")
    
    try:
        with driver.session() as session:
            # Same lineage as variables: only groups that appear under a section with at least one variable.
            result = session.run("""
                MATCH (p:Part)-[:HAS_SECTION]->(s:Section)-[:HAS_VARIABLE]->(v:Variable)
                WHERE p.name IS NOT NULL AND p.name <> ''
                  AND s.name IS NOT NULL AND s.name <> ''
                  AND coalesce(v.group, '') <> ''
                  AND NOT v.name STARTS WITH '__PLACEHOLDER_'
                RETURN DISTINCT p.name as part, s.name as section, v.group as group
                ORDER BY p.name, s.name, v.group
            """)
            
            group_triplets = []
            for record in result:
                part = record.get("part", "").strip()
                section = record.get("section", "").strip()
                group = record.get("group", "").strip()
                if part and section and group:
                    group_triplets.append({
                        "part": part,
                        "section": section,
                        "group": group
                    })
            
            print(f"Found {len(group_triplets)} distinct Part-Section-Group triplets from Neo4j")
            
            return {
                "groupTriplets": group_triplets,
                "count": len(group_triplets)
            }
    except Exception as e:
        print(f"Error fetching Group values: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch Group values: {str(e)}")

@router.get("/metadata/section-values")
async def get_section_values():
    """
    Get distinct Part–Section pairs from the Variables ontology:
    Part -[:HAS_SECTION]-> Section (Group is the v.group property).

    Includes sections with no variables yet so metadata-managed/empty sections still appear.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")
    
    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (p:Part)-[:HAS_SECTION]->(s:Section)
                WHERE p.name IS NOT NULL AND p.name <> ''
                  AND s.name IS NOT NULL AND s.name <> ''
                  AND NOT s.name STARTS WITH '__PLACEHOLDER_'
                RETURN DISTINCT p.name as part, s.name as section
                ORDER BY p.name, s.name
            """)
            
            section_pairs = []
            for record in result:
                part = record.get("part", "").strip()
                section = record.get("section", "").strip()
                if part and section:
                    section_pairs.append({
                        "part": part,
                        "section": section
                    })
            
            print(f"Found {len(section_pairs)} distinct Part-Section pairs from Neo4j")
            
            return {
                "sectionPairs": section_pairs,
                "count": len(section_pairs)
            }
    except Exception as e:
        print(f"Error fetching Section values: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch Section values: {str(e)}")

@router.get("/metadata/part-values")
async def get_part_values():
    """
    Distinct Part values (all Part nodes managed in metadata).

    Used for populating the Part metadata concept widget so it matches live grid taxonomy.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")
    
    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (p:Part)
                WHERE p.name IS NOT NULL AND p.name <> ''
                RETURN DISTINCT p.name AS part
                ORDER BY p.name
            """)
            
            parts = []
            for record in result:
                part = record.get("part", "").strip()
                if part:
                    parts.append(part)
            
            print(f"Found {len(parts)} distinct Part values from Neo4j")
            
            return {
                "parts": parts,
                "count": len(parts)
            }
    except Exception as e:
        print(f"Error fetching Part values: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch Part values: {str(e)}")

@router.get("/metadata/avatar-values")
async def get_avatar_values():
    """
    Get all distinct Avatar values with their associated Being values from Neo4j.
    Returns all Avatar-Being pairs that are used in the Objects grid.
    Used for populating the Avatar metadata concept widget.
    
    Results are sorted by Being first, then Avatar alphabetically.
    This ensures proper grouping: all Avatars for a Being are together.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")
    
    try:
        with driver.session() as session:
            # Get all distinct Avatar values with their associated Being values
            # These are the same values shown in the Objects grid's Avatar column
            # The relationship is: Being-[:HAS_AVATAR]->Avatar
            result = session.run("""
                MATCH (b:Being)-[:HAS_AVATAR]->(a:Avatar)
                WHERE a.name IS NOT NULL AND a.name <> ''
                  AND b.name IS NOT NULL AND b.name <> ''
                RETURN DISTINCT a.name as avatar, b.name as being
                ORDER BY b.name, a.name
            """)
            
            avatar_pairs = []
            for record in result:
                avatar = record.get("avatar", "").strip()
                being = record.get("being", "").strip()
                if avatar and being:
                    avatar_pairs.append({
                        "avatar": avatar,
                        "being": being
                    })
            
            print(f"Found {len(avatar_pairs)} distinct Avatar-Being pairs from Neo4j")
            
            return {
                "avatarPairs": avatar_pairs,
                "count": len(avatar_pairs)
            }
    except Exception as e:
        print(f"Error fetching Avatar values: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch Avatar values: {str(e)}")

@router.get("/metadata/vulqan-format-values")
async def get_vulqan_format_values():
    """
    Get all valid Format VI / Format VII pairs from the metadata master.
    Powers the Format VII (Vulqan) metadata widget; uses the same source of
    truth that the Variables grid dropdowns read from.
    """
    try:
        ensure_format_master_seeded()
        mapping = get_format_mapping()
        format_pairs = []
        for format_i in mapping:
            for format_ii in mapping[format_i]:
                format_pairs.append({"formatI": format_i, "formatII": format_ii})
        return {"formatPairs": format_pairs, "count": len(format_pairs)}
    except Exception as e:
        print(f"Error generating Format VI/VII pairs: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate format values: {str(e)}")


@router.get("/metadata/format-vi-values")
async def get_format_vi_values():
    """All Format VI (base) values from the metadata master, in order."""
    try:
        ensure_format_master_seeded()
        mapping = get_format_mapping()
        values = list(mapping.keys())
        return {"formatVIValues": values, "count": len(values)}
    except Exception as e:
        print(f"Error getting Format VI values: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get Format VI values: {str(e)}")


@router.get("/metadata/format-mapping")
async def get_format_mapping_endpoint():
    """
    Canonical Format VI -> [Format VII...] mapping (single source of truth).
    Consumed by the Variables panels, Source LDM and CSV validation.
    """
    try:
        ensure_format_master_seeded()
        mapping = get_format_mapping()
        format_i_values = list(mapping.keys())
        pairs = [
            {"formatI": vi, "formatII": vii}
            for vi in format_i_values
            for vii in mapping[vi]
        ]
        return {"mapping": mapping, "formatIValues": format_i_values, "formatPairs": pairs}
    except Exception as e:
        print(f"Error getting format mapping: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get format mapping: {str(e)}")


# ----- Format VI cascade endpoints -----

class FormatVIAddRequest(BaseModel):
    value: str
    definition: Optional[str] = ""


class FormatVIRenameRequest(BaseModel):
    oldValue: str
    newValue: str


@router.post("/metadata/format-vi")
async def add_format_vi(req: FormatVIAddRequest):
    ensure_format_master_seeded()
    value = (req.value or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="Format VI value is required")
    vi_item, _ = _get_format_items()
    if not vi_item:
        raise HTTPException(status_code=404, detail="Format VI metadata row not found")
    dd = _vi_detail(vi_item)
    if any(r and str(r[0]).strip().lower() == value.lower() for r in dd["rows"]):
        raise HTTPException(status_code=400, detail=f"Format VI '{value}' already exists")
    dd["rows"].append([value, req.definition or ""])
    _persist_detaildata_by_id(vi_item["id"], dd)
    return {"success": True, "value": value}


@router.put("/metadata/format-vi")
async def rename_format_vi(req: FormatVIRenameRequest):
    ensure_format_master_seeded()
    old = (req.oldValue or "").strip()
    new = (req.newValue or "").strip()
    if not old or not new:
        raise HTTPException(status_code=400, detail="Both oldValue and newValue are required")
    vi_item, vii_item = _get_format_items()
    if not vi_item:
        raise HTTPException(status_code=404, detail="Format VI metadata row not found")
    vi_dd = _vi_detail(vi_item)
    if not any(r and str(r[0]).strip().lower() == old.lower() for r in vi_dd["rows"]):
        raise HTTPException(status_code=404, detail=f"Format VI '{old}' not found")
    if new.lower() != old.lower() and any(
        r and str(r[0]).strip().lower() == new.lower() for r in vi_dd["rows"]
    ):
        raise HTTPException(status_code=400, detail=f"Format VI '{new}' already exists")
    for r in vi_dd["rows"]:
        if r and str(r[0]).strip().lower() == old.lower():
            r[0] = new
    _persist_detaildata_by_id(vi_item["id"], vi_dd)
    if vii_item:
        vii_dd = _vii_detail(vii_item)
        for r in vii_dd["rows"]:
            if r and str(r[0]).strip().lower() == old.lower():
                r[0] = new
        _persist_detaildata_by_id(vii_item["id"], vii_dd)
    count = _run_variable_format_update(
        "MATCH (v:Variable) WHERE toLower(trim(v.formatI)) = toLower($old) SET v.formatI = $new",
        {"old": old, "new": new},
    )
    return {"success": True, "variablesUpdated": count}


@router.delete("/metadata/format-vi")
async def delete_format_vi(value: str):
    ensure_format_master_seeded()
    value = (value or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="Format VI value is required")
    vi_item, vii_item = _get_format_items()
    if vi_item:
        vi_dd = _vi_detail(vi_item)
        vi_dd["rows"] = [
            r for r in vi_dd["rows"] if not (r and str(r[0]).strip().lower() == value.lower())
        ]
        _persist_detaildata_by_id(vi_item["id"], vi_dd)
    if vii_item:
        vii_dd = _vii_detail(vii_item)
        vii_dd["rows"] = [
            r for r in vii_dd["rows"] if not (r and str(r[0]).strip().lower() == value.lower())
        ]
        _persist_detaildata_by_id(vii_item["id"], vii_dd)
    count = _run_variable_format_update(
        "MATCH (v:Variable) WHERE toLower(trim(v.formatI)) = toLower($value) "
        "SET v.formatI = '', v.formatII = ''",
        {"value": value},
    )
    return {"success": True, "variablesBlanked": count}


# ----- Format VII cascade endpoints -----

class FormatVIIAddRequest(BaseModel):
    parent: str
    value: str
    definition: Optional[str] = ""


class FormatVIIRenameRequest(BaseModel):
    parent: str
    oldValue: str
    newValue: str


@router.post("/metadata/format-vii")
async def add_format_vii(req: FormatVIIAddRequest):
    ensure_format_master_seeded()
    parent = (req.parent or "").strip()
    value = (req.value or "").strip()
    if not parent or not value:
        raise HTTPException(
            status_code=400, detail="Both parent (Format VI) and value (Format VII) are required"
        )
    vi_item, vii_item = _get_format_items()
    vi_dd = _vi_detail(vi_item)
    if not any(r and str(r[0]).strip().lower() == parent.lower() for r in vi_dd["rows"]):
        raise HTTPException(status_code=400, detail=f"Format VI '{parent}' does not exist")
    if not vii_item:
        raise HTTPException(status_code=404, detail="Format VII metadata row not found")
    vii_dd = _vii_detail(vii_item)
    if any(
        len(r) >= 2
        and str(r[0]).strip().lower() == parent.lower()
        and str(r[1]).strip().lower() == value.lower()
        for r in vii_dd["rows"]
    ):
        raise HTTPException(
            status_code=400, detail=f"Format VII '{value}' already exists under '{parent}'"
        )
    vii_dd["rows"].append([parent, value, req.definition or ""])
    _persist_detaildata_by_id(vii_item["id"], vii_dd)
    return {"success": True, "parent": parent, "value": value}


@router.put("/metadata/format-vii")
async def rename_format_vii(req: FormatVIIRenameRequest):
    ensure_format_master_seeded()
    parent = (req.parent or "").strip()
    old = (req.oldValue or "").strip()
    new = (req.newValue or "").strip()
    if not parent or not old or not new:
        raise HTTPException(status_code=400, detail="parent, oldValue and newValue are required")
    _, vii_item = _get_format_items()
    if not vii_item:
        raise HTTPException(status_code=404, detail="Format VII metadata row not found")
    vii_dd = _vii_detail(vii_item)

    def is_target(r):
        return (
            len(r) >= 2
            and str(r[0]).strip().lower() == parent.lower()
            and str(r[1]).strip().lower() == old.lower()
        )

    if not any(is_target(r) for r in vii_dd["rows"]):
        raise HTTPException(status_code=404, detail=f"Format VII '{old}' under '{parent}' not found")
    if new.lower() != old.lower() and any(
        len(r) >= 2
        and str(r[0]).strip().lower() == parent.lower()
        and str(r[1]).strip().lower() == new.lower()
        for r in vii_dd["rows"]
    ):
        raise HTTPException(
            status_code=400, detail=f"Format VII '{new}' already exists under '{parent}'"
        )
    for r in vii_dd["rows"]:
        if is_target(r):
            r[1] = new
    _persist_detaildata_by_id(vii_item["id"], vii_dd)
    count = _run_variable_format_update(
        "MATCH (v:Variable) WHERE toLower(trim(v.formatI)) = toLower($parent) "
        "AND toLower(trim(v.formatII)) = toLower($old) SET v.formatII = $new",
        {"parent": parent, "old": old, "new": new},
    )
    return {"success": True, "variablesUpdated": count}


@router.delete("/metadata/format-vii")
async def delete_format_vii(parent: str, value: str):
    ensure_format_master_seeded()
    parent = (parent or "").strip()
    value = (value or "").strip()
    if not parent or not value:
        raise HTTPException(status_code=400, detail="parent and value are required")
    _, vii_item = _get_format_items()
    if vii_item:
        vii_dd = _vii_detail(vii_item)
        vii_dd["rows"] = [
            r
            for r in vii_dd["rows"]
            if not (
                len(r) >= 2
                and str(r[0]).strip().lower() == parent.lower()
                and str(r[1]).strip().lower() == value.lower()
            )
        ]
        _persist_detaildata_by_id(vii_item["id"], vii_dd)
    count = _run_variable_format_update(
        "MATCH (v:Variable) WHERE toLower(trim(v.formatI)) = toLower($parent) "
        "AND toLower(trim(v.formatII)) = toLower($value) SET v.formatI = '', v.formatII = ''",
        {"parent": parent, "value": value},
    )
    return {"success": True, "variablesBlanked": count}

@router.get("/metadata/g-type-values")
async def get_g_type_values():
    """
    Get all distinct G-Type values from Variable nodes in Neo4j.
    Returns all G-Type values that are used in the Variables grid.
    Used for populating the G-Type metadata concept widget.
    
    G-Type values are properties on Variable nodes (v.gType).
    Results are sorted alphabetically.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")
    
    try:
        with driver.session() as session:
            # Get all distinct G-Type values from Variable nodes
            # These are the same values shown in the Variables grid's G-Type column
            result = session.run("""
                MATCH (v:Variable)
                WHERE v.gType IS NOT NULL AND v.gType <> ''
                RETURN DISTINCT v.gType as gType
                ORDER BY v.gType
            """)
            
            g_types = []
            for record in result:
                g_type = record.get("gType", "").strip()
                if g_type:
                    g_types.append(g_type)
            
            print(f"Found {len(g_types)} distinct G-Type values from Neo4j")
            
            return {
                "gTypes": g_types,
                "count": len(g_types)
            }
    except Exception as e:
        print(f"Error fetching G-Type values: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch G-Type values: {str(e)}")

@router.get("/metadata/set-values")
async def get_set_values():
    """
    Get all distinct Set values from Set nodes in Neo4j.
    Returns all Set values that are used in the Lists grid.
    Used for populating the Set metadata concept widget.
    
    Set values are nodes in Neo4j (Set nodes).
    Results are sorted alphabetically.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")
    
    try:
        with driver.session() as session:
            # Get all distinct Set values from Set nodes
            # These are the same values shown in the Lists grid's Set column
            result = session.run("""
                MATCH (s:Set)
                WHERE s.name IS NOT NULL AND s.name <> ''
                RETURN DISTINCT s.name as set
                ORDER BY s.name
            """)
            
            sets = []
            for record in result:
                set_name = record.get("set", "").strip()
                if set_name:
                    sets.append(set_name)
            
            print(f"Found {len(sets)} distinct Set values from Neo4j")
            
            return {
                "sets": sets,
                "count": len(sets)
            }
    except Exception as e:
        print(f"Error fetching Set values: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch Set values: {str(e)}")

@router.get("/metadata/grouping-values")
async def get_grouping_values():
    """
    Get all distinct Grouping values with their associated Set values from Neo4j.
    Returns all Set-Grouping pairs that are used in the Lists grid.
    Used for populating the Grouping metadata concept widget.
    
    Grouping values are nodes in Neo4j (Grouping nodes) connected to Sets via HAS_GROUPING relationship.
    Results are sorted by Set name, then Grouping name.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")
    
    try:
        with driver.session() as session:
            # Get all distinct Grouping values with their associated Set values
            # These are the same values shown in the Lists grid's Set and Grouping columns
            # Relationship: Set-[:HAS_GROUPING]->Grouping
            result = session.run("""
                MATCH (s:Set)-[:HAS_GROUPING]->(g:Grouping)
                WHERE s.name IS NOT NULL AND s.name <> '' AND g.name IS NOT NULL AND g.name <> ''
                RETURN DISTINCT s.name as set, g.name as grouping
                ORDER BY s.name, g.name
            """)
            
            groupingPairs = []
            for record in result:
                set_name = record.get("set", "").strip()
                grouping_name = record.get("grouping", "").strip()
                if set_name and grouping_name:
                    groupingPairs.append({
                        "set": set_name,
                        "grouping": grouping_name
                    })
            
            print(f"Found {len(groupingPairs)} distinct Set-Grouping pairs from Neo4j")
            
            return {
                "groupingPairs": groupingPairs,
                "count": len(groupingPairs)
            }
    except Exception as e:
        print(f"Error fetching Grouping values: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch Grouping values: {str(e)}")

@router.get("/metadata/{item_id}")
async def get_metadata_item(item_id: str):
    """Get a specific metadata item by ID"""
    try:
        # Driver concept rows are synthetic and Neo4j-backed (not in Postgres/JSON).
        if is_driver_metadata_id(item_id):
            row = next((r for r in get_driver_metadata_rows() if r["id"] == item_id), None)
            if not row:
                raise HTTPException(status_code=404, detail=f"Metadata item with id {item_id} not found")
            return row

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
                            "detailData": getattr(item, "detailData", None),
                        }
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
                    print(f"PostgreSQL error creating metadata item: {e}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to create metadata item in database: {str(e)}",
                    ) from e
                finally:
                    db.close()
        
        # Fallback to JSON (no DB session)
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
        # Driver concept rows are not editable through the metadata store;
        # their values are managed via the /drivers endpoints (Neo4j nodes).
        if is_driver_metadata_id(item_id):
            raise HTTPException(
                status_code=400,
                detail="Sector/Domain/Country values are managed via the Drivers editor and are not stored in metadata.",
            )

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
                    print(f"PostgreSQL error updating metadata item: {e}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to update metadata item in database: {str(e)}",
                    ) from e
                finally:
                    db.close()
        
        # Fallback to JSON (no DB session)
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
        # Driver concept rows are required and cannot be deleted.
        if is_driver_metadata_id(item_id):
            raise HTTPException(
                status_code=400,
                detail="Cannot delete required metadata item. Sector/Domain/Country are managed via the Drivers editor.",
            )

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
                    print(f"PostgreSQL error deleting metadata item: {e}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to delete metadata item in database: {str(e)}",
                    ) from e
                finally:
                    db.close()
        
        # Fallback to JSON (no DB session)
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
