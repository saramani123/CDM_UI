"""
Part → Section → Group → Variable helpers for Neo4j.

Relationships:
  (Part)-[:HAS_SECTION]->(Section)
  (Section)-[:HAS_GROUP]->(Group)
  (Group)-[:HAS_VARIABLE]->(Variable)

Section nodes use (part_name, name) as the composite identity.
Group nodes use (part_name, section_name, name) as the composite identity.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def _norm(s: Optional[str]) -> str:
    return (s or "").strip()


def merge_part_section_group_tx(tx, part: str, section: str, group: str) -> str:
    """Same as merge_part_section_group but for a managed transaction (tx.run)."""
    part, section, group = _norm(part), _norm(section), _norm(group)
    if not part or not section or not group:
        raise ValueError("Part, Section, and Group are required")
    rec = tx.run(
        """
        MERGE (p:Part {name: $part})
        MERGE (s:Section {part_name: $part, name: $section})
        MERGE (p)-[:HAS_SECTION]->(s)
        MERGE (g:Group {part_name: $part, section_name: $section, name: $group})
        MERGE (s)-[:HAS_GROUP]->(g)
        SET p.id = coalesce(p.id, randomUUID()),
            g.id = coalesce(g.id, randomUUID()),
            s.id = coalesce(s.id, randomUUID())
        RETURN g.id AS id
        """,
        part=part,
        section=section,
        group=group,
    ).single()
    gid = rec["id"] if rec else None
    if not gid:
        raise RuntimeError(f"Failed to merge Group for Part={part}, Section={section}, Group={group}")
    return str(gid)


def merge_part_section_group(session, part: str, section: str, group: str) -> str:
    """
    MERGE Part, Section, Group and all relationships. Ensures Group has an id.
    Returns Group id.
    """
    part, section, group = _norm(part), _norm(section), _norm(group)
    if not part or not section or not group:
        raise ValueError("Part, Section, and Group are required")

    rec = session.run(
        """
        MERGE (p:Part {name: $part})
        MERGE (s:Section {part_name: $part, name: $section})
        MERGE (p)-[:HAS_SECTION]->(s)
        MERGE (g:Group {part_name: $part, section_name: $section, name: $group})
        MERGE (s)-[:HAS_GROUP]->(g)
        SET p.id = coalesce(p.id, randomUUID()),
            g.id = coalesce(g.id, randomUUID()),
            s.id = coalesce(s.id, randomUUID())
        RETURN g.id AS id
        """,
        part=part,
        section=section,
        group=group,
    ).single()
    gid = rec["id"] if rec else None
    if not gid:
        raise RuntimeError(f"Failed to merge Group for Part={part}, Section={section}, Group={group}")
    return str(gid)


def resolve_group_id(session, part: str, section: str, group: str) -> Optional[str]:
    """MATCH only — returns Group id if the scoped group exists under Part → Section."""
    part, section, group = _norm(part), _norm(section), _norm(group)
    if not part or not section or not group:
        return None
    rec = session.run(
        """
        MATCH (p:Part {name: $part})-[:HAS_SECTION]->(s:Section {part_name: $part, name: $section})
              -[:HAS_GROUP]->(g:Group {part_name: $part, section_name: $section, name: $group})
        RETURN g.id AS id
        LIMIT 1
        """,
        part=part,
        section=section,
        group=group,
    ).single()
    return str(rec["id"]) if rec and rec.get("id") else None


def get_variable_taxonomy(session, variable_id: str) -> Optional[Dict[str, Any]]:
    """Returns part, section, group names and group id for a variable, or None.

    When duplicate Group→Variable links exist, returns one deterministic path (ordered by name)
    so callers never hit ResultNotSingleError from Result.single().
    """
    rows = list(
        session.run(
            """
            MATCH (p:Part)-[:HAS_SECTION]->(s:Section)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v:Variable {id: $id})
            WHERE NOT g.name STARTS WITH '__PLACEHOLDER_'
            RETURN p.name AS part, s.name AS section, g.name AS grp, g.id AS group_id
            ORDER BY p.name, s.name, g.name
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
        "group_id": rec.get("group_id"),
    }


def variable_name_exists_in_group(session, group_id: str, variable_name: str, exclude_variable_id: Optional[str] = None) -> bool:
    """Case-insensitive duplicate check: same Variable name in the same Group."""
    if exclude_variable_id:
        rec = session.run(
            """
            MATCH (g:Group {id: $group_id})-[:HAS_VARIABLE]->(v:Variable)
            WHERE toLower(v.name) = toLower($name) AND v.id <> $exclude_id
            RETURN count(v) AS c
            """,
            group_id=group_id,
            name=variable_name.strip(),
            exclude_id=exclude_variable_id,
        ).single()
    else:
        rec = session.run(
            """
            MATCH (g:Group {id: $group_id})-[:HAS_VARIABLE]->(v:Variable)
            WHERE toLower(v.name) = toLower($name)
            RETURN count(v) AS c
            """,
            group_id=group_id,
            name=variable_name.strip(),
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

        if not p or not s or not g or not v:
            continue

        key = (p.lower(), s.lower(), g.lower(), v.lower())
        if key in seen:
            errors.append(
                f"Row {row_label}: Duplicate taxonomy row — Variable \"{v}\" in Group \"{g}\" "
                f'(Section "{s}", Part "{p}")'
            )
        seen.add(key)

    return errors


def relink_variable_to_group(session, variable_id: str, new_group_id: str) -> None:
    """Create new Group→Variable link first, then delete other HAS_VARIABLE from other groups."""
    session.run(
        """
        MATCH (g:Group {id: $group_id})
        MATCH (v:Variable {id: $variable_id})
        MERGE (g)-[:HAS_VARIABLE]->(v)
        """,
        group_id=new_group_id,
        variable_id=variable_id,
    )
    session.run(
        """
        MATCH (old_g:Group)-[r:HAS_VARIABLE]->(v:Variable {id: $variable_id})
        WHERE old_g.id IS NULL OR old_g.id <> $group_id
        DELETE r
        """,
        variable_id=variable_id,
        group_id=new_group_id,
    )
    session.run(
        """
        MATCH (v:Variable {id: $id})
        REMOVE v.section
        """,
        id=variable_id,
    )
