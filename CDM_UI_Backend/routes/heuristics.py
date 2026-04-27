"""
API routes for managing Heuristics (HEURO naming in API/UI).
Stores heuristics in PostgreSQL with JSON fallback for local development.
"""

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

try:
    from db_postgres import get_db_session, HeuristicModel

    POSTGRES_AVAILABLE = True
except Exception as e:  # pragma: no cover
    print(f"⚠️  PostgreSQL not available, using JSON files: {e}")
    POSTGRES_AVAILABLE = False


router = APIRouter()

UUID_V4_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
)


class HeuristicItem(BaseModel):
    id: str
    sector: str
    domain: str
    country: str
    agent: str
    procedure: str
    rules: str
    best: str
    is_hero: Optional[bool] = None
    is_heuro: Optional[bool] = None
    documentation: Optional[str] = None


class HeuristicUpdateRequest(BaseModel):
    sector: Optional[str] = None
    domain: Optional[str] = None
    country: Optional[str] = None
    agent: Optional[str] = None
    procedure: Optional[str] = None
    rules: Optional[str] = None
    best: Optional[str] = None
    detailData: Optional[Any] = None
    is_hero: Optional[bool] = None
    is_heuro: Optional[bool] = None
    documentation: Optional[str] = None


def get_environment() -> str:
    render_env = os.getenv("RENDER")
    if render_env and render_env.strip():
        return "production"
    return os.getenv("ENVIRONMENT", "development")


def get_heuristics_file_path() -> Path:
    backend_dir = Path(__file__).parent.parent
    heuristics_file = backend_dir / f"heuristics.{get_environment()}.json"
    backend_dir.mkdir(parents=True, exist_ok=True)
    return heuristics_file


def load_heuristics_json() -> List[dict]:
    file_path = get_heuristics_file_path()
    if not file_path.exists():
        save_heuristics_json([])
        return []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load heuristics: {str(e)}")


def save_heuristics_json(data: List[dict]):
    file_path = get_heuristics_file_path()
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save heuristics: {str(e)}")


def _resolve_is_heuro(raw: dict) -> Optional[bool]:
    if raw.get("is_heuro") is not None:
        return bool(raw.get("is_heuro"))
    if raw.get("is_hero") is not None:
        return bool(raw.get("is_hero"))
    return None


def _parse_detail_data(raw_detail: Any) -> Tuple[List[dict], List[dict], List[dict], bool]:
    """
    Returns (ifColumns, thenColumns, rules, has_legacy_detail_data).

    V1/legacy detailData (schema missing or !=2) is intentionally unreadable and returned
    as empty arrays with legacy flag true.
    """
    if raw_detail is None:
        return [], [], [], False

    detail = raw_detail
    if isinstance(detail, str):
        detail = detail.strip()
        if not detail:
            return [], [], [], False
        try:
            detail = json.loads(detail)
        except Exception:
            return [], [], [], True

    if not isinstance(detail, dict):
        return [], [], [], True

    if int(detail.get("schemaVersion") or 0) != 2:
        return [], [], [], True

    if_columns = detail.get("ifColumns") or []
    then_columns = detail.get("thenColumns") or []
    rows = detail.get("rows") or []

    if not isinstance(if_columns, list) or not isinstance(then_columns, list) or not isinstance(rows, list):
        return [], [], [], True

    parsed_rules: List[dict] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        if_values = r.get("if") if isinstance(r.get("if"), dict) else {}

        # Backward compatibility for pre-matrix row shape.
        if not if_values and r.get("if_condition"):
            if_values = {str(r.get("if_condition")): str(r.get("if_value") or "")}

        parsed_rules.append(
            {
                "id": r.get("id") or "",
                "if": if_values,
                "then": r.get("then") or {},
            }
        )

    return if_columns, then_columns, parsed_rules, False


def _normalize_and_validate_v2(detail_raw: Any) -> Tuple[dict, int]:
    if isinstance(detail_raw, str):
        try:
            detail = json.loads(detail_raw)
        except Exception:
            raise HTTPException(status_code=400, detail="detailData must be valid JSON")
    else:
        detail = detail_raw

    if not isinstance(detail, dict):
        raise HTTPException(status_code=400, detail="detailData must be an object")

    if int(detail.get("schemaVersion") or 0) != 2:
        raise HTTPException(status_code=400, detail="detailData.schemaVersion must equal 2")

    if_columns = detail.get("ifColumns")
    then_columns = detail.get("thenColumns")
    rows = detail.get("rows") or []

    if not isinstance(if_columns, list) or not (1 <= len(if_columns) <= 10):
        raise HTTPException(status_code=400, detail="ifColumns must be an array of length 1 to 10")
    if not isinstance(then_columns, list) or not (1 <= len(then_columns) <= 4):
        raise HTTPException(status_code=400, detail="thenColumns must be an array of length 1 to 4")
    if not isinstance(rows, list):
        raise HTTPException(status_code=400, detail="rows must be an array")

    def _validate_columns(cols: List[dict], prefix: str):
        labels: List[str] = []
        ids: List[str] = []
        for c in cols:
            if not isinstance(c, dict):
                raise HTTPException(status_code=400, detail=f"{prefix} columns must contain objects")
            cid = str(c.get("id") or "").strip()
            lbl = str(c.get("label") or "").strip()
            if not re.fullmatch(rf"{prefix}_\d+", cid):
                raise HTTPException(status_code=400, detail=f"{prefix} column ids must match {prefix}_<number>")
            if not lbl:
                raise HTTPException(status_code=400, detail=f"{prefix} column labels must be non-empty")
            ids.append(cid)
            labels.append(lbl.lower())
        if len(set(labels)) != len(labels):
            raise HTTPException(status_code=400, detail=f"{prefix} column labels must be unique")
        return ids

    valid_if_ids = _validate_columns(if_columns, "if")
    valid_then_ids = _validate_columns(then_columns, "then")

    normalized_rows: List[dict] = []
    for row in rows:
        if not isinstance(row, dict):
            continue

        row_id = str(row.get("id") or "").strip()
        if_obj = row.get("if") if isinstance(row.get("if"), dict) else {}
        # Backward compatibility for older row shape from previous UI.
        if not if_obj and row.get("if_condition"):
            if_obj = {str(row.get("if_condition")): str(row.get("if_value") or "")}
        then_obj = row.get("then") if isinstance(row.get("then"), dict) else {}

        if_values = {k: str(if_obj.get(k) or "").strip() for k in valid_if_ids}
        then_values = {k: str(then_obj.get(k) or "").strip() for k in valid_then_ids}
        all_if_blank = all(not v for v in if_values.values())
        all_then_blank = all(not v for v in then_values.values())

        # fully blank rows are skipped
        if all_if_blank and all_then_blank:
            continue

        if not row_id.startswith("rule_"):
            raise HTTPException(status_code=400, detail=f"Invalid rule id format: {row_id}")
        uuid_part = row_id[5:]
        if not UUID_V4_RE.fullmatch(uuid_part):
            raise HTTPException(status_code=400, detail=f"Invalid rule id format: {row_id}")

        for then_id in valid_then_ids:
            if then_id not in then_obj:
                raise HTTPException(status_code=400, detail=f"Rule {row_id}: missing output field {then_id}")

        if all_if_blank:
            raise HTTPException(status_code=400, detail=f"Rule {row_id}: at least one IF condition value must be filled")
        if any(not v for v in then_values.values()):
            raise HTTPException(status_code=400, detail=f"Rule {row_id}: all output values must be filled")

        normalized_rows.append(
            {
                "id": row_id,
                "if": if_values,
                "then": then_values,
            }
        )

    normalized = {
        "schemaVersion": 2,
        "ifColumns": if_columns,
        "thenColumns": then_columns,
        "rows": normalized_rows,
    }
    return normalized, len(normalized_rows)


def _serialize_item_for_response(item: dict) -> dict:
    if_columns, then_columns, parsed_rules, has_legacy = _parse_detail_data(item.get("detailData"))
    is_heuro = bool(item.get("is_heuro") if item.get("is_heuro") is not None else item.get("is_hero", True))

    return {
        "id": item.get("id", ""),
        "sector": item.get("sector", ""),
        "domain": item.get("domain", ""),
        "country": item.get("country", ""),
        "agent": item.get("agent", ""),
        "procedure": item.get("procedure", ""),
        "best": item.get("best", ""),
        "is_heuro": is_heuro,
        "documentation": item.get("documentation", None),
        "ifColumns": if_columns,
        "thenColumns": then_columns,
        "rules": parsed_rules,
        "rules_count": len(parsed_rules),
        "detailData": {
            "schemaVersion": 2,
            "ifColumns": if_columns,
            "thenColumns": then_columns,
            "rows": parsed_rules,
        }
        if if_columns or then_columns or parsed_rules
        else None,
        "has_legacy_detail_data": has_legacy,
    }


def _load_heuristics_rows() -> List[dict]:
    if POSTGRES_AVAILABLE:
        db = get_db_session()
        if db:
            try:
                items = db.query(HeuristicModel).all()
                return [
                    {
                        "id": i.id,
                        "sector": i.sector or "",
                        "domain": i.domain or "",
                        "country": i.country or "",
                        "agent": i.agent or "",
                        "procedure": i.procedure or "",
                        "rules": i.rules or "",
                        "best": i.best or "",
                        "is_hero": getattr(i, "is_hero", True),
                        "documentation": getattr(i, "documentation", None),
                        "detailData": i.detailData,
                    }
                    for i in items
                ]
            except Exception:
                pass
            finally:
                db.close()
    return load_heuristics_json()


@router.get("/heuristics")
async def get_heuristics():
    try:
        rows = _load_heuristics_rows()
        return [_serialize_item_for_response(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve heuristics: {str(e)}")


@router.get("/heuristics/{item_id}")
async def get_heuristic_item(item_id: str):
    try:
        rows = _load_heuristics_rows()
        item = next((r for r in rows if r.get("id") == item_id), None)
        if not item:
            raise HTTPException(status_code=404, detail=f"Heuristic item with id {item_id} not found")
        return _serialize_item_for_response(item)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve heuristic item: {str(e)}")


@router.post("/heuristics")
async def create_heuristic_item(item: HeuristicItem):
    try:
        raw = item.model_dump()
        is_heuro = _resolve_is_heuro(raw)
        if is_heuro is None:
            is_heuro = True

        if POSTGRES_AVAILABLE:
            db = get_db_session()
            if db:
                try:
                    existing = db.query(HeuristicModel).filter(HeuristicModel.id == item.id).first()
                    if existing:
                        raise HTTPException(status_code=400, detail=f"Heuristic item with id {item.id} already exists")

                    duplicate = db.query(HeuristicModel).filter(
                        HeuristicModel.sector.ilike(item.sector),
                        HeuristicModel.domain.ilike(item.domain),
                        HeuristicModel.country.ilike(item.country),
                        HeuristicModel.agent.ilike(item.agent),
                        HeuristicModel.procedure.ilike(item.procedure),
                    ).first()
                    if duplicate:
                        raise HTTPException(status_code=400, detail="Heuristic item with this combination already exists.")

                    new_item = HeuristicModel(
                        id=item.id,
                        sector=item.sector,
                        domain=item.domain,
                        country=item.country,
                        agent=item.agent,
                        procedure=item.procedure,
                        rules=item.rules,
                        best=item.best,
                        detailData=None,
                        is_hero=is_heuro,
                        documentation=None if is_heuro else ((item.documentation or "").strip() or ""),
                    )
                    db.add(new_item)
                    db.commit()
                    return _serialize_item_for_response(
                        {
                            "id": new_item.id,
                            "sector": new_item.sector,
                            "domain": new_item.domain,
                            "country": new_item.country,
                            "agent": new_item.agent,
                            "procedure": new_item.procedure,
                            "rules": new_item.rules,
                            "best": new_item.best,
                            "is_hero": new_item.is_hero,
                            "documentation": new_item.documentation,
                            "detailData": new_item.detailData,
                        }
                    )
                except HTTPException:
                    db.rollback()
                    raise
                finally:
                    db.close()

        heuristics = load_heuristics_json()
        if any(h.get("id") == item.id for h in heuristics):
            raise HTTPException(status_code=400, detail=f"Heuristic item with id {item.id} already exists")

        entry = {
            "id": item.id,
            "sector": item.sector,
            "domain": item.domain,
            "country": item.country,
            "agent": item.agent,
            "procedure": item.procedure,
            "rules": item.rules,
            "best": item.best,
            "is_hero": is_heuro,
            "documentation": None if is_heuro else ((item.documentation or "").strip() or ""),
            "detailData": None,
        }
        heuristics.append(entry)
        save_heuristics_json(heuristics)
        return _serialize_item_for_response(entry)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create heuristic item: {str(e)}")


@router.put("/heuristics/{item_id}")
async def update_heuristic_item(item_id: str, update: HeuristicUpdateRequest):
    try:
        update_raw = update.model_dump(exclude_unset=True)
        is_heuro_update = _resolve_is_heuro(update_raw)

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
                    if update.best is not None:
                        item.best = update.best

                    if is_heuro_update is not None:
                        item.is_hero = is_heuro_update

                    current_is_heuro = bool(getattr(item, "is_hero", True))
                    if current_is_heuro:
                        item.documentation = None
                        if update.detailData is not None:
                            normalized, row_count = _normalize_and_validate_v2(update.detailData)
                            item.detailData = json.dumps(normalized, ensure_ascii=False)
                            item.rules = str(row_count)
                    else:
                        doc_value = (update.documentation if update.documentation is not None else item.documentation) or ""
                        if not str(doc_value).strip():
                            raise HTTPException(status_code=400, detail="When Is HEURO is FALSE, Documentation must not be empty.")
                        item.documentation = str(doc_value)
                        item.detailData = None
                        item.rules = ""

                    if update.rules is not None and update.detailData is None:
                        item.rules = str(update.rules)

                    db.commit()
                    return _serialize_item_for_response(
                        {
                            "id": item.id,
                            "sector": item.sector,
                            "domain": item.domain,
                            "country": item.country,
                            "agent": item.agent,
                            "procedure": item.procedure,
                            "rules": item.rules,
                            "best": item.best,
                            "is_hero": item.is_hero,
                            "documentation": item.documentation,
                            "detailData": item.detailData,
                        }
                    )
                except HTTPException:
                    db.rollback()
                    raise
                finally:
                    db.close()

        heuristics = load_heuristics_json()
        idx = next((i for i, h in enumerate(heuristics) if h.get("id") == item_id), None)
        if idx is None:
            raise HTTPException(status_code=404, detail=f"Heuristic item with id {item_id} not found")

        item = heuristics[idx]
        for field in ["sector", "domain", "country", "agent", "procedure", "best"]:
            val = getattr(update, field)
            if val is not None:
                item[field] = val

        if is_heuro_update is not None:
            item["is_hero"] = is_heuro_update

        current_is_heuro = bool(item.get("is_hero", True))
        if current_is_heuro:
            item["documentation"] = None
            if update.detailData is not None:
                normalized, row_count = _normalize_and_validate_v2(update.detailData)
                item["detailData"] = json.dumps(normalized, ensure_ascii=False)
                item["rules"] = str(row_count)
        else:
            doc_value = update.documentation if update.documentation is not None else item.get("documentation", "")
            if not str(doc_value or "").strip():
                raise HTTPException(status_code=400, detail="When Is HEURO is FALSE, Documentation must not be empty.")
            item["documentation"] = str(doc_value)
            item["detailData"] = None
            item["rules"] = ""

        if update.rules is not None and update.detailData is None:
            item["rules"] = str(update.rules)

        heuristics[idx] = item
        save_heuristics_json(heuristics)
        return _serialize_item_for_response(item)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update heuristic item: {str(e)}")


@router.delete("/heuristics/{item_id}")
async def delete_heuristic_item(item_id: str):
    try:
        if POSTGRES_AVAILABLE:
            db = get_db_session()
            if db:
                try:
                    item = db.query(HeuristicModel).filter(HeuristicModel.id == item_id).first()
                    if not item:
                        raise HTTPException(status_code=404, detail=f"Heuristic item with id {item_id} not found")
                    db.delete(item)
                    db.commit()
                    return {"message": f"Heuristic item {item_id} deleted successfully"}
                except HTTPException:
                    db.rollback()
                    raise
                finally:
                    db.close()

        heuristics = load_heuristics_json()
        item_index = next((i for i, h in enumerate(heuristics) if h.get("id") == item_id), None)
        if item_index is None:
            raise HTTPException(status_code=404, detail=f"Heuristic item with id {item_id} not found")
        heuristics.pop(item_index)
        save_heuristics_json(heuristics)
        return {"message": f"Heuristic item {item_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete heuristic item: {str(e)}")


@router.delete("/heuristics")
async def clear_all_heuristics():
    try:
        deleted_count = 0
        if POSTGRES_AVAILABLE:
            db = get_db_session()
            if db:
                try:
                    deleted_count = db.query(HeuristicModel).delete()
                    db.commit()
                finally:
                    db.close()

        file_path = get_heuristics_file_path()
        if file_path.exists():
            heuristics = load_heuristics_json()
            deleted_count += len(heuristics)
            save_heuristics_json([])

        return {"message": "All heuristics data cleared successfully", "deleted_count": deleted_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear heuristics: {str(e)}")
