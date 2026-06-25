"""
Part → Section → Variable helpers for Neo4j.

Relationships:
  (Part)-[:HAS_SECTION]->(Section)
  (Section)-[:HAS_VARIABLE]->(Variable)

Group is a *property* of the Variable node (v.group), NOT a node/relationship.
Section nodes use (part_name, name) as the composite identity.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def _norm(s: Optional[str]) -> str:
    return (s or "").strip()


def merge_part_section_tx(tx, part: str, section: str) -> str:
    """Managed-transaction variant of merge_part_section. Returns Section id."""
    part, section = _norm(part), _norm(section)
    if not part or not section:
        raise ValueError("Part and Section are required")
    rec = tx.run(
        """
        MERGE (p:Part {name: $part})
        MERGE (s:Section {part_name: $part, name: $section})
        MERGE (p)-[:HAS_SECTION]->(s)
        SET p.id = coalesce(p.id, randomUUID()),
            s.id = coalesce(s.id, randomUUID())
        RETURN s.id AS id
        """,
        part=part,
        section=section,
    ).single()
    sid = rec["id"] if rec else None
    if not sid:
        raise RuntimeError(f"Failed to merge Section for Part={part}, Section={section}")
    return str(sid)


def merge_part_section(session, part: str, section: str) -> str:
    """
    MERGE Part, Section and the HAS_SECTION relationship. Ensures Section has an id.
    Returns Section id.
    """
    part, section = _norm(part), _norm(section)
    if not part or not section:
        raise ValueError("Part and Section are required")

    rec = session.run(
        """
        MERGE (p:Part {name: $part})
        MERGE (s:Section {part_name: $part, name: $section})
        MERGE (p)-[:HAS_SECTION]->(s)
        SET p.id = coalesce(p.id, randomUUID()),
            s.id = coalesce(s.id, randomUUID())
        RETURN s.id AS id
        """,
        part=part,
        section=section,
    ).single()
    sid = rec["id"] if rec else None
    if not sid:
        raise RuntimeError(f"Failed to merge Section for Part={part}, Section={section}")
    return str(sid)


def resolve_section_id(session, part: str, section: str) -> Optional[str]:
    """MATCH only — returns Section id if the scoped section exists under the Part."""
    part, section = _norm(part), _norm(section)
    if not part or not section:
        return None
    rec = session.run(
        """
        MATCH (p:Part {name: $part})-[:HAS_SECTION]->(s:Section {part_name: $part, name: $section})
        RETURN s.id AS id
        LIMIT 1
        """,
        part=part,
        section=section,
    ).single()
    return str(rec["id"]) if rec and rec.get("id") else None


def get_variable_taxonomy(session, variable_id: str) -> Optional[Dict[str, Any]]:
    """Returns part, section, group (group from v.group property) and section id for a variable, or None.

    When duplicate Section→Variable links exist, returns one deterministic path (ordered by name)
    so callers never hit ResultNotSingleError from Result.single().
    """
    rows = list(
        session.run(
            """
            MATCH (p:Part)-[:HAS_SECTION]->(s:Section)-[:HAS_VARIABLE]->(v:Variable {id: $id})
            WHERE NOT s.name STARTS WITH '__PLACEHOLDER_'
            RETURN p.name AS part, s.name AS section, coalesce(v.group, '') AS grp, s.id AS section_id
            ORDER BY p.name, s.name
            LIMIT 1
            """,
            id=variable_id,
        )
    )
    if not rows:
        return None
    rec = rows[0]
    return {
        "part": rec.get("part") or "",
        "section": rec.get("section") or "",
        "group": rec.get("grp") or "",
        "section_id": rec.get("section_id"),
    }


def variable_name_exists_in_section(
    session,
    section_id: str,
    group: str,
    variable_name: str,
    exclude_variable_id: Optional[str] = None,
) -> bool:
    """Case-insensitive duplicate check: same Variable name + same Group (property) in the same Section."""
    group = _norm(group)
    if exclude_variable_id:
        rec = session.run(
            """
            MATCH (s:Section {id: $section_id})-[:HAS_VARIABLE]->(v:Variable)
            WHERE toLower(v.name) = toLower($name)
              AND toLower(coalesce(v.group, '')) = toLower($group)
              AND v.id <> $exclude_id
            RETURN count(v) AS c
            """,
            section_id=section_id,
            name=variable_name.strip(),
            group=group,
            exclude_id=exclude_variable_id,
        ).single()
    else:
        rec = session.run(
            """
            MATCH (s:Section {id: $section_id})-[:HAS_VARIABLE]->(v:Variable)
            WHERE toLower(v.name) = toLower($name)
              AND toLower(coalesce(v.group, '')) = toLower($group)
            RETURN count(v) AS c
            """,
            section_id=section_id,
            name=variable_name.strip(),
            group=group,
        ).single()
    return bool(rec and rec.get("c", 0) > 0)


def collect_csv_variable_duplicate_errors(rows: List[Dict[str, Any]]) -> List[str]:
    """
    Pre-ingestion duplicate detection for variable CSV rows.
    Each row dict must have keys: part, section, group, variable (and optionally row_num).
    Flags duplicate (Part, Section, Group, Variable) rows (case-insensitive match).
    """
    errors: List[str] = []
    seen: set = set()

    for idx, row in enumerate(rows):
        p = _norm(row.get("part"))
        s = _norm(row.get("section"))
        g = _norm(row.get("group"))
        v = _norm(row.get("variable"))
        row_label = row.get("row_num", idx + 2)

        if not p or not s or not v:
            continue

        key = (p.lower(), s.lower(), g.lower(), v.lower())
        if key in seen:
            errors.append(
                f"Row {row_label}: Duplicate taxonomy row — Variable \"{v}\" in Group \"{g}\" "
                f'(Section "{s}", Part "{p}")'
            )
        seen.add(key)

    return errors


def relink_variable_to_section(
    session,
    variable_id: str,
    new_section_id: str,
    delete_empty_old: bool = True,
) -> None:
    """Create the new Section→Variable link first, then drop any other Section→Variable
    links for this variable. Optionally DETACH DELETE an old Section that is left empty.
    """
    # Capture the old section node(s) for this variable BEFORE unlinking.
    old_section_eids = session.run(
        """
        MATCH (old_s:Section)-[:HAS_VARIABLE]->(v:Variable {id: $variable_id})
        WHERE (old_s.id IS NULL OR old_s.id <> $section_id)
        RETURN collect(DISTINCT elementId(old_s)) AS eids
        """,
        variable_id=variable_id,
        section_id=new_section_id,
    ).single()["eids"]

    session.run(
        """
        MATCH (s:Section {id: $section_id})
        MATCH (v:Variable {id: $variable_id})
        MERGE (s)-[:HAS_VARIABLE]->(v)
        """,
        section_id=new_section_id,
        variable_id=variable_id,
    )
    session.run(
        """
        MATCH (old_s:Section)-[r:HAS_VARIABLE]->(v:Variable {id: $variable_id})
        WHERE (old_s.id IS NULL OR old_s.id <> $section_id)
        DELETE r
        """,
        variable_id=variable_id,
        section_id=new_section_id,
    )

    if delete_empty_old and old_section_eids:
        session.run(
            """
            MATCH (old_s:Section)
            WHERE elementId(old_s) IN $eids
              AND NOT (old_s)-[:HAS_VARIABLE]->(:Variable)
            DETACH DELETE old_s
            """,
            eids=old_section_eids,
        )
