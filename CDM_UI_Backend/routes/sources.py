"""
Sources tab API: catalog of external systems (Quickbooks, Stripe, …) and per-source
Logical Data Model rows. PostgreSQL on Render when available; JSON store locally.
"""

from __future__ import annotations

import json
import os
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple

from collections import defaultdict

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

try:
    from db_postgres import get_db_session, SourceCatalogModel, SourceLdmRowModel

    POSTGRES_AVAILABLE = True
except Exception as e:  # pragma: no cover
    print(f"⚠️  Sources PostgreSQL import failed, JSON only: {e}")
    POSTGRES_AVAILABLE = False
    get_db_session = None  # type: ignore

StorageBackend = Literal["postgres", "json"]

router = APIRouter()

# Preset integrations (stable ids for UI)
PRESET_SOURCES: List[Tuple[str, str]] = [
    ("quickbooks", "QuickBooks"),
    ("netsuite", "Oracle NetSuite"),
    ("square", "Square"),
    ("stripe", "Stripe"),
    ("xero", "Xero"),
    ("evernest", "Evernest"),
    ("northpoint", "Northpoint"),
    ("darwin", "Darwin"),
    ("hrg", "HRG"),
    ("mynd", "Mynd"),
    ("sap_s4hana", "SAP S/4HANA"),
    ("dynamics_365_finance", "Microsoft Dynamics 365 Finance"),
    ("sage_intacct", "Sage Intacct"),
    ("sap_ecc", "SAP ECC"),
    ("salesforce", "Salesforce"),
    ("hubspot", "HubSpot"),
    ("adyen", "Adyen"),
    ("paypal", "PayPal"),
    ("workiva", "Workiva"),
    ("active_disclosure", "Active Disclosure (Thomson Reuters)"),
    ("blackline", "BlackLine"),
    ("coupa", "Coupa"),
    ("bill_com", "Bill.com"),
    ("bloomberg", "Bloomberg"),
    ("blackrock_aladdin", "BlackRock Aladdin"),
    ("morningstar_direct", "Morningstar Direct"),
    ("factset", "FactSet"),
    ("guidewire", "Guidewire"),
    ("duck_creek", "Duck Creek"),
    ("cority", "Cority"),
    ("metricstream", "MetricStream"),
    ("energysys", "EnergySys"),
    ("energy_components", "Energy Components"),
    ("cority_iir", "Cority II&R"),
    ("synergi", "Synergi"),
    ("prometheus_suite", "Prometheus Suite"),
    ("prometheus_pm", "Prometheus PM"),
    ("prometheus_scheduler", "Prometheus Scheduler"),
    ("docuflow", "DocuFlow"),
]


def get_environment() -> str:
    render_env = os.getenv("RENDER")
    if render_env and render_env.strip():
        return "production"
    return os.getenv("ENVIRONMENT", "development")


def _store_path() -> Path:
    backend_dir = Path(__file__).parent.parent
    backend_dir.mkdir(parents=True, exist_ok=True)
    return backend_dir / f"cdm_sources_store.{get_environment()}.json"


def _empty_store() -> Dict[str, List]:
    return {"catalog": [], "ldm_rows": []}


def _row_model_to_dict(r: Any) -> dict:
    return {
        "id": r.id,
        "source_id": r.source_id,
        "source_name": r.source_name or "",
        "source_table": r.source_table or "",
        "source_variable": r.source_variable or "",
        "variable": getattr(r, "cdm_variable", None) or "",
        "being": r.being or "",
        "avatar": r.avatar or "",
        "object": getattr(r, "cdm_object", None) or "",
        "part": r.part or "",
        "section": r.section or "",
        "group": getattr(r, "cdm_group", None) or "",
        "format_vi": r.format_vi or "",
        "format_vii": r.format_vii or "",
        "validations": r.validations or "",
    }


def _ldm_cdm_variable_from_payload(d: dict) -> str:
    """CDM variable name: accept API/JSON `variable` or DB-style `cdm_variable`."""
    for key in ("variable", "cdm_variable", "cdmVariable"):
        v = d.get(key)
        if v is None:
            continue
        s = str(v).strip()
        if s:
            return s
    return ""


def _row_dict_normalize(d: dict) -> dict:
    return {
        "id": d.get("id") or "",
        "source_id": d.get("source_id") or "",
        "source_name": d.get("source_name") or "",
        "source_table": d.get("source_table") or "",
        "source_variable": d.get("source_variable") or "",
        "variable": _ldm_cdm_variable_from_payload(d),
        "being": d.get("being") or "",
        "avatar": d.get("avatar") or "",
        "object": d.get("object") or "",
        "part": d.get("part") or "",
        "section": d.get("section") or "",
        "group": d.get("group") or "",
        "format_vi": d.get("format_vi") or "",
        "format_vii": d.get("format_vii") or "",
        "validations": d.get("validations") or "",
    }


def _counts_for_source(rows: List[dict], source_id: str) -> Tuple[int, int]:
    sub = [r for r in rows if r.get("source_id") == source_id]
    tables = {((r.get("source_table") or "").strip()) for r in sub}
    tables.discard("")
    return len(tables), len(sub)


def _canonical_match_key(row: dict) -> Tuple[str, ...]:
    """Ontology + CDM variable — used to pair source/target LDM rows (same as grid LDM columns)."""
    return (
        (row.get("being") or "").strip(),
        (row.get("avatar") or "").strip(),
        (row.get("object") or "").strip(),
        (row.get("part") or "").strip(),
        (row.get("section") or "").strip(),
        (row.get("group") or "").strip(),
        (row.get("variable") or "").strip(),
    )


def _ldm_row_identity(r: dict) -> str:
    """Stable id for tracking which LDM rows participated in a pair."""
    rid = (r.get("id") or "").strip()
    if rid:
        return rid
    return "anon|" + "|".join(
        [
            (r.get("source_id") or ""),
            (r.get("source_table") or ""),
            (r.get("source_variable") or ""),
            *_canonical_match_key(r),
        ]
    )


def _row_payload_from_ref(
    ref: dict,
    *,
    map_row_kind: str,
    match_group_index: int,
    pair_index: int,
    source_schema_table: str,
    source_schema_column: str,
    target_schema_table: str,
    target_schema_column: str,
    row_id: str,
) -> dict:
    return {
        "id": row_id,
        "map_row_kind": map_row_kind,
        "match_group_index": match_group_index,
        "pair_index": pair_index,
        "source_schema_table": source_schema_table,
        "source_schema_column": source_schema_column,
        "target_schema_table": target_schema_table,
        "target_schema_column": target_schema_column,
        "being": ref.get("being") or "",
        "avatar": ref.get("avatar") or "",
        "object": ref.get("object") or "",
        "part": ref.get("part") or "",
        "section": ref.get("section") or "",
        "group": ref.get("group") or "",
        "variable": ref.get("variable") or "",
        "format_vi": ref.get("format_vi") or "",
        "format_vii": ref.get("format_vii") or "",
        "validations": ref.get("validations") or "",
    }


def _compute_auto_map_rows(rows_src: List[dict], rows_tgt: List[dict]) -> List[dict]:
    """
    Pair rows that share the same Being/Avatar/Object/Part/Section/Group/Variable.
    First pair per key is `primary`; additional pairs are `extra`.
    Rows with no counterpart appear as `unmatched_source` or `unmatched_target` with empty opposite columns.
    """
    tgt_by_key: Dict[Tuple[str, ...], List[dict]] = defaultdict(list)
    for r in rows_tgt:
        tgt_by_key[_canonical_match_key(r)].append(r)
    for k in tgt_by_key:
        tgt_by_key[k].sort(
            key=lambda x: (
                (x.get("source_table") or "").lower(),
                (x.get("source_variable") or "").lower(),
            )
        )

    pairs: List[Tuple[dict, dict]] = []
    for a in rows_src:
        ka = _canonical_match_key(a)
        if ka not in tgt_by_key:
            continue
        for b in tgt_by_key[ka]:
            pairs.append((a, b))

    by_key: Dict[Tuple[str, ...], List[Tuple[dict, dict]]] = defaultdict(list)
    for a, b in pairs:
        by_key[_canonical_match_key(a)].append((a, b))

    source_ids_in_pairs: set[str] = set()
    target_ids_in_pairs: set[str] = set()
    for a, b in pairs:
        source_ids_in_pairs.add(_ldm_row_identity(a))
        target_ids_in_pairs.add(_ldm_row_identity(b))

    sorted_keys = sorted(by_key.keys(), key=lambda t: (tuple(x.lower() for x in t)))
    out: List[dict] = []
    for gi, key in enumerate(sorted_keys):
        plist = by_key[key]
        plist.sort(
            key=lambda ab: (
                (ab[0].get("source_table") or "").lower(),
                (ab[0].get("source_variable") or "").lower(),
                (ab[1].get("source_table") or "").lower(),
                (ab[1].get("source_variable") or "").lower(),
            )
        )
        for i, (a, b) in enumerate(plist):
            ref = a
            out.append(
                _row_payload_from_ref(
                    ref,
                    map_row_kind="primary" if i == 0 else "extra",
                    match_group_index=gi,
                    pair_index=i,
                    source_schema_table=a.get("source_table") or "",
                    source_schema_column=a.get("source_variable") or "",
                    target_schema_table=b.get("source_table") or "",
                    target_schema_column=b.get("source_variable") or "",
                    row_id=f"am-{uuid.uuid4().hex[:20]}",
                )
            )

    # Unmatched source rows (no target row with same LDM key)
    unmatched_src = [r for r in rows_src if _ldm_row_identity(r) not in source_ids_in_pairs]
    unmatched_src.sort(
        key=lambda r: (
            _canonical_match_key(r),
            (r.get("source_table") or "").lower(),
            (r.get("source_variable") or "").lower(),
        )
    )
    base_gi = 1_000_000
    for j, a in enumerate(unmatched_src):
        rid = (a.get("id") or "").strip() or uuid.uuid4().hex[:16]
        out.append(
            _row_payload_from_ref(
                a,
                map_row_kind="unmatched_source",
                match_group_index=base_gi + j,
                pair_index=0,
                source_schema_table=a.get("source_table") or "",
                source_schema_column=a.get("source_variable") or "",
                target_schema_table="",
                target_schema_column="",
                row_id=f"am-us-{rid}",
            )
        )

    # Unmatched target rows (no source row with same LDM key)
    unmatched_tgt = [r for r in rows_tgt if _ldm_row_identity(r) not in target_ids_in_pairs]
    unmatched_tgt.sort(
        key=lambda r: (
            _canonical_match_key(r),
            (r.get("source_table") or "").lower(),
            (r.get("source_variable") or "").lower(),
        )
    )
    base_tgi = 2_000_000
    for j, b in enumerate(unmatched_tgt):
        rid = (b.get("id") or "").strip() or uuid.uuid4().hex[:16]
        out.append(
            _row_payload_from_ref(
                b,
                map_row_kind="unmatched_target",
                match_group_index=base_tgi + j,
                pair_index=0,
                source_schema_table="",
                source_schema_column="",
                target_schema_table=b.get("source_table") or "",
                target_schema_column=b.get("source_variable") or "",
                row_id=f"am-ut-{rid}",
            )
        )

    return out


_PRESET_PATH_RE = re.compile(r"^src-preset-([a-z0-9_-]+)$", re.IGNORECASE)


def _resolve_catalog_row(catalog: List[dict], source_id: str) -> Optional[dict]:
    """Match by primary id, or treat `src-preset-{source_key}` as an alias for the row with that source_key."""
    sid = (source_id or "").strip()
    if not sid:
        return None
    for c in catalog:
        if c.get("id") == sid:
            return c
    m = _PRESET_PATH_RE.match(sid)
    if not m:
        return None
    want_key = m.group(1).lower()
    for c in catalog:
        sk = (c.get("source_key") or "").strip().lower()
        if sk == want_key:
            return c
    return None


def _ensure_presets_catalog(catalog: List[dict]) -> List[dict]:
    by_key = {c.get("source_key"): c for c in catalog}
    out = list(catalog)
    for key, name in PRESET_SOURCES:
        if key not in by_key:
            out.append(
                {
                    "id": f"src-preset-{key}",
                    "source_key": key,
                    "name": name,
                    "sector": "",
                    "domain": "",
                    "country": "",
                    "is_preset": True,
                }
            )
            by_key[key] = out[-1]
    return out


def _load_json_store() -> Dict[str, List]:
    path = _store_path()
    if not path.exists():
        data = _empty_store()
        data["catalog"] = _ensure_presets_catalog([])
        _save_json_store(data)
        return data
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = json.load(f)
        if isinstance(raw, list):
            # Legacy / unexpected format — reset to presets only
            data = _empty_store()
            data["catalog"] = _ensure_presets_catalog([])
            _save_json_store(data)
            return data
        catalog = raw.get("catalog") or []
        rows = raw.get("ldm_rows") or []
        if not isinstance(catalog, list):
            catalog = []
        if not isinstance(rows, list):
            rows = []
        catalog = _ensure_presets_catalog(catalog)
        data = {"catalog": catalog, "ldm_rows": [_row_dict_normalize(r) for r in rows]}
        return data
    except Exception as e:
        print(f"Error loading sources JSON store: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load sources store: {e}")


def _save_json_store(data: Dict[str, List]) -> None:
    path = _store_path()
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving sources JSON store: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save sources store: {e}")


def _ensure_presets_postgres(db) -> None:
    existing = {r.source_key: r for r in db.query(SourceCatalogModel).all()}
    for key, name in PRESET_SOURCES:
        if key not in existing:
            db.add(
                SourceCatalogModel(
                    id=f"src-preset-{key}",
                    source_key=key,
                    name=name,
                    sector="",
                    domain="",
                    country="",
                    is_preset=True,
                )
            )
    db.commit()


def _load_from_postgres() -> Optional[Dict[str, List]]:
    if not POSTGRES_AVAILABLE or not get_db_session:
        return None
    db = get_db_session()
    if not db:
        return None
    try:
        _ensure_presets_postgres(db)
        cats = db.query(SourceCatalogModel).all()
        rows_db = db.query(SourceLdmRowModel).all()
        catalog = [
            {
                "id": c.id,
                "source_key": c.source_key,
                "name": c.name,
                "sector": c.sector or "",
                "domain": c.domain or "",
                "country": c.country or "",
                "is_preset": bool(c.is_preset),
            }
            for c in cats
        ]
        rows = [_row_model_to_dict(r) for r in rows_db]
        return {"catalog": catalog, "ldm_rows": rows}
    except Exception as e:
        print(f"Sources PostgreSQL load error: {e}")
        db.rollback()
        return None
    finally:
        db.close()


def _load_store() -> Tuple[Dict[str, List], StorageBackend]:
    pg = _load_from_postgres()
    if pg is not None:
        return pg, "postgres"
    return _load_json_store(), "json"


def _catalog_summaries(store: Dict[str, List]) -> List[dict]:
    rows = store.get("ldm_rows") or []
    out = []
    for c in store.get("catalog") or []:
        tc, vc = _counts_for_source(rows, c["id"])
        out.append(
            {
                **c,
                "table_count": tc,
                "variable_count": vc,
            }
        )
    # Presets first (fixed order), then others by name
    preset_order = {k: i for i, (k, _) in enumerate(PRESET_SOURCES)}
    out.sort(
        key=lambda x: (
            preset_order.get(x.get("source_key"), 999),
            (x.get("name") or "").lower(),
        )
    )
    return out


def _slug(name: str) -> str:
    s = (name or "").lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "source"


class SourceCreateRequest(BaseModel):
    name: str = Field(..., min_length=1)
    sector: str = ""
    domain: str = ""
    country: str = ""


class SourceUpdateRequest(BaseModel):
    sector: Optional[str] = None
    domain: Optional[str] = None
    country: Optional[str] = None
    name: Optional[str] = None


@router.get("/sources")
async def list_sources_catalog():
    try:
        store, backend = _load_store()
        if backend == "json":
            store["catalog"] = _ensure_presets_catalog(store.get("catalog") or [])
            _save_json_store(store)
        return _catalog_summaries(store)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sources/auto-map")
async def get_sources_auto_map(
    source_id: str = Query(..., description="Source schema (left) catalog id"),
    target_id: str = Query(..., description="Target schema (right) catalog id"),
):
    """
    Build merged rows for the Auto Map grid: pair LDM rows that share
    Being, Avatar, Object, Part, Section, Group, Variable, Format VI/VII, and Validations.
    """
    try:
        store, backend = _load_store()
        if backend == "json":
            store["catalog"] = _ensure_presets_catalog(store.get("catalog") or [])
        src_cat = _resolve_catalog_row(store["catalog"], source_id)
        tgt_cat = _resolve_catalog_row(store["catalog"], target_id)
        if not src_cat or not tgt_cat:
            raise HTTPException(status_code=404, detail="Source or target not found")
        sid = (src_cat.get("id") or "").strip()
        tid = (tgt_cat.get("id") or "").strip()
        if sid == tid:
            raise HTTPException(status_code=400, detail="Source and target must be different")
        rows_all = store.get("ldm_rows") or []
        rows_src = [_row_dict_normalize(r) for r in rows_all if (r.get("source_id") or "") == sid]
        rows_tgt = [_row_dict_normalize(r) for r in rows_all if (r.get("source_id") or "") == tid]
        computed = _compute_auto_map_rows(rows_src, rows_tgt)
        payload = {
            "source_id": sid,
            "target_id": tid,
            "source_name": (src_cat.get("name") or src_cat.get("source_key") or "").strip() or "Source",
            "target_name": (tgt_cat.get("name") or tgt_cat.get("source_key") or "").strip() or "Target",
            "rows": computed,
        }
        # Always recompute from current LDM store; tell caches not to reuse this GET.
        return JSONResponse(
            payload,
            headers={
                "Cache-Control": "no-store, no-cache, must-revalidate",
                "Pragma": "no-cache",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sources/{source_id}")
async def get_source_detail(source_id: str):
    try:
        store, backend = _load_store()
        if backend == "json":
            store["catalog"] = _ensure_presets_catalog(store.get("catalog") or [])
        cat = _resolve_catalog_row(store["catalog"], source_id)
        if not cat:
            raise HTTPException(status_code=404, detail="Source not found")
        canonical_id = cat.get("id") or source_id
        rows = [_row_dict_normalize(r) for r in store.get("ldm_rows") or [] if r.get("source_id") == canonical_id]
        tc, vc = _counts_for_source(store.get("ldm_rows") or [], canonical_id)
        return {
            **cat,
            "table_count": tc,
            "variable_count": vc,
            "ldm_rows": rows,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/sources/{source_id}")
async def update_source(source_id: str, body: SourceUpdateRequest):
    try:
        store, backend = _load_store()
        if backend == "json":
            store["catalog"] = _ensure_presets_catalog(store.get("catalog") or [])
        cat_row = _resolve_catalog_row(store["catalog"], source_id)
        if not cat_row:
            raise HTTPException(status_code=404, detail="Source not found")
        canonical_id = cat_row.get("id") or source_id
        idx = next((i for i, c in enumerate(store["catalog"]) if c.get("id") == canonical_id), None)
        if idx is None:
            raise HTTPException(status_code=404, detail="Source not found")
        item = dict(store["catalog"][idx])
        if body.sector is not None:
            item["sector"] = body.sector
        if body.domain is not None:
            item["domain"] = body.domain
        if body.country is not None:
            item["country"] = body.country
        if body.name is not None:
            if item.get("is_preset"):
                raise HTTPException(status_code=400, detail="Cannot rename preset sources")
            item["name"] = body.name.strip()
        store["catalog"][idx] = item

        if backend == "postgres" and POSTGRES_AVAILABLE and get_db_session:
            db = get_db_session()
            if not db:
                raise HTTPException(status_code=500, detail="Database unavailable")
            try:
                row = db.query(SourceCatalogModel).filter(SourceCatalogModel.id == canonical_id).one_or_none()
                if not row:
                    raise HTTPException(status_code=404, detail="Source not found")
                if body.sector is not None:
                    row.sector = body.sector
                if body.domain is not None:
                    row.domain = body.domain
                if body.country is not None:
                    row.country = body.country
                if body.name is not None:
                    row.name = body.name.strip()
                db.commit()
            finally:
                db.close()
        else:
            _save_json_store(store)

        rows_all = store.get("ldm_rows") or []
        tc, vc = _counts_for_source(rows_all, canonical_id)
        return {**item, "table_count": tc, "variable_count": vc}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sources")
async def create_source(body: SourceCreateRequest):
    try:
        store, backend = _load_store()
        if backend == "json":
            store["catalog"] = _ensure_presets_catalog(store.get("catalog") or [])
        sid = f"src-{uuid.uuid4().hex[:12]}"
        base_key = _slug(body.name)
        keys = {c.get("source_key") for c in store["catalog"]}
        sk = base_key
        n = 1
        while sk in keys:
            sk = f"{base_key}-{n}"
            n += 1
        new_c = {
            "id": sid,
            "source_key": sk,
            "name": body.name.strip(),
            "sector": body.sector or "",
            "domain": body.domain or "",
            "country": body.country or "",
            "is_preset": False,
        }
        store["catalog"].append(new_c)

        if backend == "postgres" and POSTGRES_AVAILABLE and get_db_session:
            db = get_db_session()
            if not db:
                raise HTTPException(status_code=500, detail="Database unavailable")
            try:
                db.add(
                    SourceCatalogModel(
                        id=new_c["id"],
                        source_key=new_c["source_key"],
                        name=new_c["name"],
                        sector=new_c["sector"],
                        domain=new_c["domain"],
                        country=new_c["country"],
                        is_preset=False,
                    )
                )
                db.commit()
            finally:
                db.close()
        else:
            _save_json_store(store)

        return {**new_c, "table_count": 0, "variable_count": 0}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/sources/{source_id}/ldm-rows")
async def replace_ldm_rows(source_id: str, payload: Dict[str, Any]):
    """Replace all LDM rows for a source (used when wiring CSV / grid saves)."""
    rows_in = payload.get("rows")
    if not isinstance(rows_in, list):
        raise HTTPException(status_code=400, detail="Expected { rows: [...] }")
    try:
        store, backend = _load_store()
        if backend == "json":
            store["catalog"] = _ensure_presets_catalog(store.get("catalog") or [])
        cat_row = _resolve_catalog_row(store["catalog"], source_id)
        if not cat_row:
            raise HTTPException(status_code=404, detail="Source not found")
        canonical_id = cat_row.get("id") or source_id

        others = [r for r in store.get("ldm_rows") or [] if r.get("source_id") != canonical_id]
        new_rows = []
        for r in rows_in:
            nr = _row_dict_normalize(r if isinstance(r, dict) else {})
            if not nr["id"]:
                nr["id"] = f"ldm-{uuid.uuid4().hex[:16]}"
            nr["source_id"] = canonical_id
            new_rows.append(nr)
        store["ldm_rows"] = others + new_rows

        if backend == "postgres" and POSTGRES_AVAILABLE and get_db_session:
            db = get_db_session()
            if not db:
                raise HTTPException(status_code=500, detail="Database unavailable")
            try:
                db.query(SourceLdmRowModel).filter(SourceLdmRowModel.source_id == canonical_id).delete()
                for nr in new_rows:
                    db.add(
                        SourceLdmRowModel(
                            id=nr["id"],
                            source_id=nr["source_id"],
                            source_name=nr["source_name"],
                            source_table=nr["source_table"],
                            source_variable=nr["source_variable"],
                            cdm_variable=nr.get("variable") or "",
                            being=nr["being"],
                            avatar=nr["avatar"],
                            cdm_object=nr["object"],
                            part=nr["part"],
                            section=nr["section"],
                            cdm_group=nr["group"],
                            format_vi=nr["format_vi"],
                            format_vii=nr["format_vii"],
                            validations=nr["validations"],
                        )
                    )
                db.commit()
            finally:
                db.close()
        else:
            _save_json_store(store)

        return {"ok": True, "count": len(new_rows)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
