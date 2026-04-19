"""Meme / Variant / Vulqan classification stored on Object, Variable, and List nodes (Neo4j property `Type`)."""

from __future__ import annotations

from typing import Any, Optional

ALLOWED_ONTOLOGY_TYPES = frozenset({"Meme", "Variant", "Vulqan"})
DEFAULT_ONTOLOGY_TYPE = "Variant"

# Neo4j property name (quoted in Cypher as `Type`)
NEO4J_TYPE_PROPERTY = "Type"


def normalize_ontology_type(raw: Any) -> Optional[str]:
    """Return canonical Meme|Variant|Vulqan, or None if empty/invalid."""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    for candidate in ALLOWED_ONTOLOGY_TYPES:
        if s.lower() == candidate.lower():
            return candidate
    return None


def coerce_legacy_to_string(is_meme: Any, explicit_type: Optional[str]) -> str:
    """Resolve final type string from new field or legacy boolean."""
    t = normalize_ontology_type(explicit_type)
    if t:
        return t
    try:
        if bool(is_meme):
            return "Meme"
    except Exception:
        pass
    return DEFAULT_ONTOLOGY_TYPE


def cypher_coalesce_type(alias: str) -> str:
    """Expression: prefer `Type`, else map legacy is_meme to Meme/Variant."""
    return (
        f"coalesce({alias}.`{NEO4J_TYPE_PROPERTY}`, "
        f"CASE WHEN coalesce({alias}.is_meme, false) THEN 'Meme' ELSE '{DEFAULT_ONTOLOGY_TYPE}' END)"
    )
