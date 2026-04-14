from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Body, Request
from typing import List, Dict, Any, Optional
import uuid
import io
import json
import csv
from pydantic import BaseModel, Field
from neo4j import WRITE_ACCESS
from db import get_driver
from schema import (
    VariableCreateRequest,
    VariableUpdateRequest,
    VariableResponse,
    CSVUploadResponse,
    CSVRowData,
    BulkVariableUpdateRequest,
    BulkVariableUpdateResponse,
    ObjectRelationshipCreateRequest,
    VariableFieldOptionRequest,
    VariableFieldOptionsResponse,
    VariableSectionRequest,
    VariablePartCreateRequest,
    VariableGroupCreateRequest,
)
from routes.variable_ontology import (
    get_variable_taxonomy,
    merge_part_section_group,
    merge_part_section_group_tx,
    relink_variable_to_group,
    resolve_group_id,
    variable_name_exists_in_group,
)

# Pydantic models for JSON body parameters
class BulkVariableObjectRelationshipItem(BaseModel):
    variable_id: str
    target_being: str
    target_avatar: str
    target_object: str
    target_sector: Optional[str] = ""
    target_domain: Optional[str] = ""
    target_country: Optional[str] = ""
    target_object_clarifier: Optional[str] = ""

class BulkVariableObjectRelationshipCreateRequest(BaseModel):
    relationships: List[BulkVariableObjectRelationshipItem]


class BulkUploadVariablesChunkRequest(BaseModel):
    """JSON body for chunked variable upload (avoids long request timeouts on Render)."""
    rows: List[Dict[str, Any]] = Field(
        ...,
        description=(
            "Array of row objects with keys: Sector, Domain, Country, Part, Section, Group, Variable, "
            "and optional Format I, Format II, G-Type, Type, Default, Graph."
        ),
    )
    start_row_index: int = Field(2, description="1-based row index of first row (for error messages)")

router = APIRouter()

IS_GROUP_KEY_PROP = "`Is Group Key`"
GROUP_KEY_PROP = "`Group Key`"

CSV_FORMAT_II_BY_FORMAT_I: Dict[str, List[str]] = {
    "ID": ["Public", "Private", "Vulqan"],
    "Time": ["Date", "DateTime"],
    "List": ["Static", "Specific", "Flag"],
    "Number": ["Integer", "Decimal", "Currency", "Percent"],
    "Directory": ["Phone", "Email", "URL", "Zip"],
    "Freeform": ["Text", "Binary", "JSON", "CSV", "XLS", "PDF"],
}
CSV_ALLOWED_GTYPE = {"Loose", "Tight"}
CSV_ALLOWED_TYPE = {"Meme", "Variant"}
CSV_ALLOWED_GRAPH = {"Yes", "No"}


def _coalesced_is_group_key_expr(alias: str = "v") -> str:
    return f"coalesce({alias}.{IS_GROUP_KEY_PROP}, {alias}.is_group_key, false)"


def _normalize_allowed_value(value: str, allowed_values: List[str] | set[str]) -> str:
    """Case-insensitive value normalization against an allowed set."""
    allowed = list(allowed_values)
    for candidate in allowed:
        if value.lower() == candidate.lower():
            return candidate
    return ""


def _extract_variable_csv_metadata(row: Dict[str, Any], row_num: int, errors: List[str]) -> Optional[Dict[str, Any]]:
    def push_error(message: str) -> None:
        errors.append(message)
        print(f"❌ CSV validation error: {message}")

    """
    Validate and normalize optional variable CSV metadata columns.
    Returns normalized dict or None if row is invalid.
    """
    format_i_raw = (row.get("Format I") or "").strip()
    format_ii_raw = (row.get("Format II") or "").strip()
    g_type_raw = (row.get("G-Type") or "").strip()
    type_raw = (row.get("Type") or "").strip()
    default_raw = (row.get("Default") or "").strip()
    graph_raw = (row.get("Graph") or "Yes").strip() or "Yes"

    format_i = ""
    format_ii = ""
    g_type = ""
    graph = ""
    var_type = "Variant"

    if format_i_raw:
        format_i = _normalize_allowed_value(format_i_raw, list(CSV_FORMAT_II_BY_FORMAT_I.keys()))
        if not format_i:
            push_error(
                f"Row {row_num}: Invalid Format I '{format_i_raw}'. "
                f"Allowed values: {', '.join(CSV_FORMAT_II_BY_FORMAT_I.keys())}."
            )
            return None

    if format_ii_raw:
        if not format_i:
            push_error(
                f"Row {row_num}: Format II '{format_ii_raw}' requires Format I to be provided."
            )
            return None
        format_ii = _normalize_allowed_value(format_ii_raw, CSV_FORMAT_II_BY_FORMAT_I[format_i])
        if not format_ii:
            push_error(
                f"Row {row_num}: Invalid Format II '{format_ii_raw}' for Format I '{format_i}'. "
                f"Allowed values: {', '.join(CSV_FORMAT_II_BY_FORMAT_I[format_i])}."
            )
            return None
    elif format_i:
        push_error(
            f"Row {row_num}: Format II is required when Format I '{format_i}' is provided."
        )
        return None

    if g_type_raw:
        g_type = _normalize_allowed_value(g_type_raw, CSV_ALLOWED_GTYPE)
        if not g_type:
            push_error(
                f"Row {row_num}: Invalid G-Type '{g_type_raw}'. Allowed values: Loose, Tight."
            )
            return None

    if type_raw:
        normalized_type = _normalize_allowed_value(type_raw, CSV_ALLOWED_TYPE)
        if not normalized_type:
            push_error(
                f"Row {row_num}: Invalid Type '{type_raw}'. Allowed values: Meme, Variant."
            )
            return None
        var_type = normalized_type

    graph = _normalize_allowed_value(graph_raw, CSV_ALLOWED_GRAPH)
    if not graph:
        push_error(
            f"Row {row_num}: Invalid Graph '{graph_raw}'. Allowed values: Yes, No."
        )
        return None

    return {
        "formatI": format_i,
        "formatII": format_ii,
        "gType": g_type,
        "default": default_raw,
        "graph": graph,
        "is_meme": var_type == "Meme",
    }


def _ensure_group_key_defaults(session) -> None:
    """Backfill literal Group Key properties for existing Variables."""
    session.run(f"""
        MATCH (v:Variable)
        WHERE v.{IS_GROUP_KEY_PROP} IS NULL OR v.{GROUP_KEY_PROP} IS NULL OR v.is_group_key IS NULL
        SET v.{IS_GROUP_KEY_PROP} = coalesce(v.{IS_GROUP_KEY_PROP}, coalesce(v.is_group_key, false)),
            v.{GROUP_KEY_PROP} = coalesce(v.{GROUP_KEY_PROP}, ''),
            v.is_group_key = coalesce(v.{IS_GROUP_KEY_PROP}, v.is_group_key, false)
    """)


def _apply_group_key_selection_by_group_name(session, variable_id: str, is_selected: bool) -> None:
    """
    Apply Group Key rules globally by Group *name* (not Group node ID):
    - selected=True: all Variables under any Group with same name get Group Key=<variable_id>;
      only selected variable has Is Group Key=true.
    - selected=False: all Variables under that group-name bucket get Is Group Key=false and Group Key=''.
    """
    group_rec = session.run("""
        MATCH (g:Group)-[:HAS_VARIABLE]->(v:Variable {id: $variable_id})
        RETURN g.name AS group_name
        LIMIT 1
    """, {"variable_id": variable_id}).single()

    if not group_rec or not group_rec.get("group_name"):
        raise HTTPException(status_code=400, detail=f"Could not resolve Group for variable {variable_id}.")

    group_name = str(group_rec["group_name"]).strip()
    if not group_name:
        raise HTTPException(status_code=400, detail=f"Variable {variable_id} has an empty Group name.")

    if is_selected:
        session.run(f"""
            MATCH (g:Group)-[:HAS_VARIABLE]->(v:Variable)
            WHERE toLower(g.name) = toLower($group_name)
            SET v.{GROUP_KEY_PROP} = $group_key_id,
                v.{IS_GROUP_KEY_PROP} = CASE WHEN v.id = $group_key_id THEN true ELSE false END,
                v.is_group_key = CASE WHEN v.id = $group_key_id THEN true ELSE false END
        """, {"group_name": group_name, "group_key_id": variable_id})
    else:
        session.run(f"""
            MATCH (g:Group)-[:HAS_VARIABLE]->(v:Variable)
            WHERE toLower(g.name) = toLower($group_name)
            SET v.{GROUP_KEY_PROP} = '',
                v.{IS_GROUP_KEY_PROP} = false,
                v.is_group_key = false
        """, {"group_name": group_name})

def _scoped_taxonomy_conflict_messages(runner, part: str, section: str, group: str) -> List[str]:
    """
    Return DB conflict messages for Part/Section/Group uniqueness and case-insensitive collisions.
    Reuse of existing taxonomy with the same canonical names is allowed.
    """
    messages: List[str] = []
    part = (part or "").strip()
    section = (section or "").strip()
    group = (group or "").strip()

    if not part or not section or not group:
        return messages

    part_rec = runner.run(
        """
        MATCH (p:Part)
        WHERE toLower(p.name) = toLower($part)
        RETURN count(p) AS c, collect(DISTINCT p.name) AS names
        """,
        part=part,
    ).single()
    part_count = int(part_rec["c"] or 0) if part_rec else 0
    part_names = [n for n in (part_rec["names"] or []) if n] if part_rec else []
    if part_count > 1:
        messages.append(
            f"Part conflict: found multiple Part nodes matching '{part}' in DB. Clean duplicates before upload."
        )
    elif part_count == 1 and part_names and part_names[0] != part:
        messages.append(
            f"Part conflict: '{part}' differs only by case from existing Part '{part_names[0]}'."
        )

    sec_rec = runner.run(
        """
        MATCH (p:Part)
        WHERE toLower(p.name) = toLower($part)
        OPTIONAL MATCH (p)-[:HAS_SECTION]->(s:Section)
        WHERE toLower(s.name) = toLower($section)
        RETURN count(s) AS c, collect(DISTINCT s.name) AS names
        """,
        part=part,
        section=section,
    ).single()
    sec_count = int(sec_rec["c"] or 0) if sec_rec else 0
    sec_names = [n for n in (sec_rec["names"] or []) if n] if sec_rec else []
    if sec_count > 1:
        messages.append(
            f"Section conflict: found multiple Section nodes named '{section}' within Part '{part}'."
        )
    elif sec_count == 1 and sec_names and sec_names[0] != section:
        messages.append(
            f"Section conflict: '{section}' differs only by case from existing Section '{sec_names[0]}' within Part '{part}'."
        )

    grp_rec = runner.run(
        """
        MATCH (p:Part)-[:HAS_SECTION]->(s:Section)-[:HAS_GROUP]->(g:Group)
        WHERE toLower(p.name) = toLower($part)
          AND toLower(s.name) = toLower($section)
          AND toLower(g.name) = toLower($group)
        RETURN count(g) AS c, collect(DISTINCT g.name) AS names
        """,
        part=part,
        section=section,
        group=group,
    ).single()
    grp_count = int(grp_rec["c"] or 0) if grp_rec else 0
    grp_names = [n for n in (grp_rec["names"] or []) if n] if grp_rec else []
    if grp_count > 1:
        messages.append(
            f"Group conflict: found multiple Group nodes named '{group}' within Section '{section}' (Part '{part}')."
        )
    elif grp_count == 1 and grp_names and grp_names[0] != group:
        messages.append(
            f"Group conflict: '{group}' differs only by case from existing Group '{grp_names[0]}' within Section '{section}' (Part '{part}')."
        )

    return messages

async def create_driver_relationships(session, variable_id: str, driver_string: str):
    """
    Create driver relationships for a variable based on the driver string.
    Driver string format: "Sector, Domain, Country, None"
    Creates IS_RELEVANT_TO relationships from driver nodes to the variable.
    
    This function is idempotent - it deletes existing relationships first, then creates new ones.
    Safe to call multiple times without duplicating relationships.
    """
    try:
        print(f"Creating driver relationships for variable {variable_id} with driver string: {driver_string}")
        
        # First, delete all existing driver relationships for this variable
        print(f"Deleting existing driver relationships for variable {variable_id}")
        session.run("""
            MATCH (v:Variable {id: $variable_id})
            MATCH (s:Sector)-[r:IS_RELEVANT_TO]->(v)
            DELETE r
        """, variable_id=variable_id)
        session.run("""
            MATCH (v:Variable {id: $variable_id})
            MATCH (d:Domain)-[r:IS_RELEVANT_TO]->(v)
            DELETE r
        """, variable_id=variable_id)
        session.run("""
            MATCH (v:Variable {id: $variable_id})
            MATCH (c:Country)-[r:IS_RELEVANT_TO]->(v)
            DELETE r
        """, variable_id=variable_id)
        session.run("""
            MATCH (v:Variable {id: $variable_id})
            MATCH (vc:VariableClarifier)-[r:IS_RELEVANT_TO]->(v)
            DELETE r
        """, variable_id=variable_id)
        print(f"Deleted existing driver relationships for variable {variable_id}")
        
        # Parse driver string with category-aware splitting.
        tokens = [part.strip() for part in driver_string.split(",") if part.strip()]
        if tokens and tokens[-1].lower() == "none":
            tokens = tokens[:-1]

        sector_names = {r["name"] for r in session.run("MATCH (s:Sector) RETURN s.name as name") if r.get("name")}
        domain_names = {r["name"] for r in session.run("MATCH (d:Domain) RETURN d.name as name") if r.get("name")}
        country_names = {r["name"] for r in session.run("MATCH (c:Country) RETURN c.name as name") if r.get("name")}

        def valid(bucket: List[str], allowed: set) -> bool:
            if not bucket:
                return False
            if len(bucket) == 1 and bucket[0] == "ALL":
                return True
            if "ALL" in bucket:
                return False
            return all(item in allowed for item in bucket)

        parsed = None
        if len(tokens) >= 3:
            for i in range(1, len(tokens) - 1):
                for j in range(i + 1, len(tokens)):
                    sec = tokens[:i]
                    dom = tokens[i:j]
                    cou = tokens[j:]
                    if valid(sec, sector_names) and valid(dom, domain_names) and valid(cou, country_names):
                        parsed = (sec, dom, cou)
                        break
                if parsed:
                    break

        if parsed:
            sector_values, domain_values, country_values = parsed
        else:
            print(f"Warning: could not fully parse driver string '{driver_string}', applying fallback")
            sector_values = [tokens[0]] if len(tokens) > 0 else ["ALL"]
            domain_values = [tokens[1]] if len(tokens) > 1 else ["ALL"]
            country_values = [tokens[2]] if len(tokens) > 2 else ["ALL"]

        print(
            f"Parsed driver buckets for variable {variable_id}: sectors={sector_values}, domains={domain_values}, countries={country_values}"
        )
        
        # Handle Sector relationships
        if len(sector_values) == 1 and sector_values[0] == "ALL":
            # Create relationships to ALL existing sectors
            result = session.run("""
                MATCH (s:Sector)
                MATCH (v:Variable {id: $variable_id})
                WITH s, v
                MERGE (s)-[:IS_RELEVANT_TO]->(v)
                RETURN count(s) as count
            """, variable_id=variable_id)
            record = result.single()
            count = record["count"] if record else 0
            print(f"Created {count} Sector relationships (ALL)")
        else:
            # Create relationships to individual sectors
            for sector in sector_values:
                if sector and sector != "None":  # Skip empty or None sectors
                    result = session.run("""
                        MERGE (s:Sector {name: $sector})
                        WITH s
                        MATCH (v:Variable {id: $variable_id})
                        MERGE (s)-[:IS_RELEVANT_TO]->(v)
                        RETURN s.name as sector
                    """, sector=sector, variable_id=variable_id)
                    record = result.single()
                    if record:
                        print(f"Created IS_RELEVANT_TO relationship: Sector({record['sector']}) -> Variable({variable_id})")
                    else:
                        print(f"⚠️  Failed to create relationship for Sector({sector}) -> Variable({variable_id})")
        
        # Handle Domain relationships
        if len(domain_values) == 1 and domain_values[0] == "ALL":
            # Create relationships to ALL existing domains
            result = session.run("""
                MATCH (d:Domain)
                MATCH (v:Variable {id: $variable_id})
                WITH d, v
                MERGE (d)-[:IS_RELEVANT_TO]->(v)
                RETURN count(d) as count
            """, variable_id=variable_id)
            record = result.single()
            count = record["count"] if record else 0
            print(f"Created {count} Domain relationships (ALL)")
        else:
            for domain in domain_values:
                if domain and domain != "None":  # Skip empty or None domains
                    result = session.run("""
                        MERGE (d:Domain {name: $domain})
                        WITH d
                        MATCH (v:Variable {id: $variable_id})
                        MERGE (d)-[:IS_RELEVANT_TO]->(v)
                        RETURN d.name as domain
                    """, domain=domain, variable_id=variable_id)
                    record = result.single()
                    if record:
                        print(f"Created IS_RELEVANT_TO relationship: Domain({record['domain']}) -> Variable({variable_id})")
                    else:
                        print(f"⚠️  Failed to create relationship for Domain({domain}) -> Variable({variable_id})")
        
        # Handle Country relationships
        if len(country_values) == 1 and country_values[0] == "ALL":
            # Create relationships to ALL existing countries
            result = session.run("""
                MATCH (c:Country)
                MATCH (v:Variable {id: $variable_id})
                WITH c, v
                MERGE (c)-[:IS_RELEVANT_TO]->(v)
                RETURN count(c) as count
            """, variable_id=variable_id)
            record = result.single()
            count = record["count"] if record else 0
            print(f"Created {count} Country relationships (ALL)")
        else:
            for country in country_values:
                if country and country != "None":  # Skip empty or None countries
                    result = session.run("""
                        MERGE (c:Country {name: $country})
                        WITH c
                        MATCH (v:Variable {id: $variable_id})
                        MERGE (c)-[:IS_RELEVANT_TO]->(v)
                        RETURN c.name as country
                    """, country=country, variable_id=variable_id)
                    record = result.single()
                    if record:
                        print(f"Created IS_RELEVANT_TO relationship: Country({record['country']}) -> Variable({variable_id})")
                    else:
                        print(f"⚠️  Failed to create relationship for Country({country}) -> Variable({variable_id})")
        
        print(f"✅ Successfully created driver relationships for variable {variable_id}")
            
    except Exception as e:
        print(f"Error creating driver relationships: {e}")
        import traceback
        traceback.print_exc()
        raise e

# Cascading dropdown routes - must be defined BEFORE /variables to ensure proper route matching
@router.get("/variables/parts")
async def get_variable_parts():
    """
    Get all distinct Part values from Variables.
    Used for cascading dropdown: Part -> Section -> Group -> Variable
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (p:Part)
                RETURN DISTINCT p.name as part
                ORDER BY p.name
            """)
            
            parts = [record["part"] for record in result if record.get("part")]
            return {"parts": parts}
    except Exception as e:
        print(f"Error fetching parts: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch parts: {str(e)}")


@router.post("/variables/parts")
async def create_variable_part(body: VariablePartCreateRequest):
    """Create a new Part node (MERGE by name — globally unique part names)."""
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Part name is required")
    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            dup = session.run(
                """
                MATCH (p:Part)
                WHERE toLower(p.name) = toLower($name)
                RETURN p.name AS n
                LIMIT 1
                """,
                name=name,
            ).single()
            if dup:
                raise HTTPException(
                    status_code=400,
                    detail=f"Part '{name}' already exists (conflicts with '{dup['n']}'). Choose a different name.",
                )
            session.run(
                "CREATE (p:Part {name: $name, id: $id})",
                name=name,
                id=str(uuid.uuid4()),
            )
            return {"success": True, "message": f"Part '{name}' created", "part": name}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating part: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create part: {str(e)}")


@router.get("/variables/sections")
async def get_variable_sections(part: str = None):
    """
    Get all distinct Section values for Variables that belong to the specified Part.
    Used for cascading dropdown: Part -> Section -> Group -> Variable
    
    Args:
        part: The Part name to filter sections by
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    if not part:
        raise HTTPException(status_code=400, detail="Part parameter is required")

    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (p:Part {name: $part})-[:HAS_SECTION]->(s:Section)
                RETURN DISTINCT s.name AS section
                ORDER BY section
            """, part=part)
            
            sections = [record["section"] for record in result if record.get("section")]
            return {"sections": sections}
    except Exception as e:
        print(f"Error fetching sections for part {part}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch sections: {str(e)}")


@router.post("/variables/sections")
async def add_variable_section(section_data: VariableSectionRequest):
    """
    Add a Section node linked to the Part via HAS_SECTION (no placeholder variables).
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    part = section_data.part.strip()
    section = section_data.section.strip()

    if not part:
        raise HTTPException(status_code=400, detail="Part parameter is required")
    
    if not section:
        raise HTTPException(status_code=400, detail="Section parameter is required")

    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            conflicts = _scoped_taxonomy_conflict_messages(session, part, section, "__GROUP_PLACEHOLDER__")
            if conflicts:
                raise HTTPException(status_code=400, detail=conflicts[0])
            existing = session.run("""
                MATCH (p:Part {name: $part})-[:HAS_SECTION]->(s:Section {part_name: $part, name: $section})
                RETURN s.name AS name
            """, part=part, section=section).single()
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Section '{section}' already exists for Part '{part}'.",
                )

            session.run("""
                MERGE (p:Part {name: $part})
                MERGE (s:Section {part_name: $part, name: $section})
                MERGE (p)-[:HAS_SECTION]->(s)
                SET p.id = coalesce(p.id, randomUUID()),
                    s.id = coalesce(s.id, randomUUID())
            """, part=part, section=section)
            
            return {"success": True, "message": f"Section '{section}' added for part '{part}'"}
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding section {section} for part {part}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add section: {str(e)}")


@router.post("/variables/groups", response_model=Dict[str, Any])
async def create_variable_group(body: VariableGroupCreateRequest):
    """
    Create a Group under Part → Section (HAS_GROUP from Section to Group).
    Duplicate: same name in the same Section is not allowed.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    part = body.part.strip()
    section = body.section.strip()
    group = body.group.strip()

    if not part or not section or not group:
        raise HTTPException(status_code=400, detail="Part, Section, and Group are required")

    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            conflicts = _scoped_taxonomy_conflict_messages(session, part, section, group)
            if conflicts:
                raise HTTPException(status_code=400, detail=conflicts[0])
            exists = session.run("""
                MATCH (p:Part {name: $part})-[:HAS_SECTION]->(s:Section {part_name: $part, name: $section})
                      -[:HAS_GROUP]->(g:Group {part_name: $part, section_name: $section, name: $group})
                RETURN g.id AS id
            """, part=part, section=section, group=group).single()
            if exists:
                raise HTTPException(
                    status_code=400,
                    detail=f"Group '{group}' already exists under Section '{section}' (Part '{part}').",
                )

            sec = session.run("""
                MATCH (p:Part {name: $part})-[:HAS_SECTION]->(s:Section {part_name: $part, name: $section})
                RETURN s.name AS sn
            """, part=part, section=section).single()
            if not sec:
                raise HTTPException(
                    status_code=400,
                    detail=f"Section '{section}' does not exist for Part '{part}'. Add the Section first.",
                )

            merge_part_section_group(session, part, section, group)
            return {
                "success": True,
                "message": f"Group '{group}' created under Section '{section}' (Part '{part}')",
                "part": part,
                "section": section,
                "group": group,
            }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating group: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create group: {str(e)}")

@router.get("/variables/groups")
async def get_variable_groups(part: str = None, section: str = None):
    """
    Groups under Part → Section (Section is required).
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    if not part or not str(part).strip():
        raise HTTPException(status_code=400, detail="Part parameter is required")
    if not section or not str(section).strip():
        raise HTTPException(status_code=400, detail="Section parameter is required")

    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (p:Part {name: $part})-[:HAS_SECTION]->(s:Section {part_name: $part, name: $section})
                      -[:HAS_GROUP]->(g:Group)
                WHERE NOT g.name STARTS WITH '__PLACEHOLDER_'
                RETURN DISTINCT g.name AS group
                ORDER BY group
            """, part=part.strip(), section=section.strip())
            
            groups = [record["group"] for record in result if record.get("group")]
            return {"groups": groups}
    except Exception as e:
        print(f"Error fetching groups for part {part}, section {section}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch groups: {str(e)}")


@router.get("/variables/variables")
async def get_variables_for_selection(part: str = None, section: str = None, group: str = None):
    """
    Get all Variables that:
    1. Belong to the specified Group (via HAS_VARIABLE relationship)
    2. Have the specified Section property
    3. The Group belongs to the specified Part
    
    Used for cascading dropdown: Part -> Section -> Group -> Variable
    
    Args:
        part: The Part name
        section: The Section property value
        group: The Group name
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    if not part or not section or not group:
        raise HTTPException(status_code=400, detail="Part, Section, and Group parameters are required")

    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (p:Part {name: $part})-[:HAS_SECTION]->(s:Section {part_name: $part, name: $section})
                      -[:HAS_GROUP]->(g:Group {part_name: $part, section_name: $section, name: $group})
                      -[:HAS_VARIABLE]->(v:Variable)
                WHERE NOT g.name STARTS WITH '__PLACEHOLDER_'
                AND NOT v.name STARTS WITH '__PLACEHOLDER_'
                RETURN v.id as id, v.name as variable
                ORDER BY v.name
            """, part=part, section=section, group=group)
            
            variables = [{"id": record["id"], "name": record["variable"]} for record in result if record.get("id")]
            return {"variables": variables}
    except Exception as e:
        print(f"Error fetching variables for part {part}, section {section}, group {group}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch variables: {str(e)}")


@router.get("/variables", response_model=List[Dict[str, Any]])
async def get_variables():
    """
    Get all variables from the CDM with proper taxonomy structure.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            _ensure_group_key_defaults(session)

            # First, get all possible driver values to check if "ALL" should be used
            all_sectors_result = session.run("MATCH (s:Sector) WHERE s.name <> 'ALL' RETURN s.name as name")
            all_sectors = {record["name"] for record in all_sectors_result}
            
            all_domains_result = session.run("MATCH (d:Domain) WHERE d.name <> 'ALL' RETURN d.name as name")
            all_domains = {record["name"] for record in all_domains_result}
            
            all_countries_result = session.run("MATCH (c:Country) WHERE c.name <> 'ALL' RETURN c.name as name")
            all_countries = {record["name"] for record in all_countries_result}
            
            # Get all variables with their taxonomy and relationships
            # Filter out PLACEHOLDER variables and groups
            result = session.run("""
                MATCH (p:Part)-[:HAS_SECTION]->(s:Section)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v:Variable)
                WHERE NOT g.name STARTS WITH '__PLACEHOLDER_'
                AND NOT v.name STARTS WITH '__PLACEHOLDER_'
                OPTIONAL MATCH (o:Object)-[:HAS_SPECIFIC_VARIABLE]->(v)
                OPTIONAL MATCH (v)<-[:IS_RELEVANT_TO]-(sec:Sector)
                OPTIONAL MATCH (v)<-[:IS_RELEVANT_TO]-(d:Domain)
                OPTIONAL MATCH (v)<-[:IS_RELEVANT_TO]-(c:Country)
                OPTIONAL MATCH (v)<-[:IS_RELEVANT_TO]-(vc:VariableClarifier)
                OPTIONAL MATCH (v)-[:HAS_VARIATION]->(var:Variation)
                WITH v, p, g, s, count(DISTINCT o) as objectRelationships,
                     count(DISTINCT var) as variations,
                     collect(DISTINCT sec.name) as sectors,
                     collect(DISTINCT d.name) as domains,
                     collect(DISTINCT c.name) as countries,
                     collect(DISTINCT vc.name) as variableClarifiers
                RETURN v.id as id, v.name as variable, s.name as section,
                       v.formatI as formatI, v.formatII as formatII, v.gType as gType,
                       v.validation as validation, v.default as default, v.graph as graph,
                       v.status as status, COALESCE(v.is_meme, false) as is_meme,
                       coalesce(v.`Is Group Key`, v.is_group_key, false) as is_group_key,
                       coalesce(v.`Group Key`, '') as group_key,
                       p.name as part, g.name as group,
                       objectRelationships, variations, sectors, domains, countries, variableClarifiers,
                       properties(v) as allProps
                ORDER BY v.id
            """)

            variables = []
            for record in result:
                # Validate required fields - skip variables with missing critical data
                if not record["id"] or not record["part"] or not record["group"] or not record["variable"]:
                    print(f"⚠️  Skipping variable with missing required fields: id={record.get('id')}, part={record.get('part')}, group={record.get('group')}, variable={record.get('variable')}")
                    continue
                
                # Get driver data from the query results
                sectors = record["sectors"] or []
                domains = record["domains"] or []
                countries = record["countries"] or []
                
                # Normalize driver strings: if all values are present, use "ALL"
                # Filter out "ALL" from the lists (it's not a real node, just a UI convenience)
                sectors_filtered = [s for s in sectors if s != "ALL"]
                domains_filtered = [d for d in domains if d != "ALL"]
                countries_filtered = [c for c in countries if c != "ALL"]
                
                # Check if all possible values are selected
                sectors_set = set(sectors_filtered)
                domains_set = set(domains_filtered)
                countries_set = set(countries_filtered)
                
                # Use "ALL" if all values are present, or if "ALL" was explicitly in the list
                # Check if sets match (all values selected)
                sector_all_selected = len(all_sectors) > 0 and len(sectors_set) > 0 and sectors_set == all_sectors
                domain_all_selected = len(all_domains) > 0 and len(domains_set) > 0 and domains_set == all_domains
                country_all_selected = len(all_countries) > 0 and len(countries_set) > 0 and countries_set == all_countries
                
                sector_str = "ALL" if ("ALL" in sectors or sector_all_selected) else (", ".join(sectors_filtered) if sectors_filtered else "ALL")
                domain_str = "ALL" if ("ALL" in domains or domain_all_selected) else (", ".join(domains_filtered) if domains_filtered else "ALL")
                country_str = "ALL" if ("ALL" in countries or country_all_selected) else (", ".join(countries_filtered) if countries_filtered else "ALL")
                driver_string = f"{sector_str}, {domain_str}, {country_str}, None"
                
                # Collect all validation properties and combine into comma-separated string
                all_props = record.get("allProps", {})
                validation_list = []
                if all_props.get("validation"):
                    validation_list.append(str(all_props["validation"]))
                # Get all Validation #N properties and sort them numerically
                validation_keys = [k for k in all_props.keys() if k.startswith("Validation #")]
                # Sort by the number after "#"
                validation_keys.sort(key=lambda x: int(x.split("#")[1].strip()) if "#" in x and x.split("#")[1].strip().isdigit() else 999)
                for key in validation_keys:
                    if all_props.get(key):
                        validation_list.append(str(all_props[key]))
                # Combine into comma-separated string, or use original validation if no additional validations
                combined_validation = ", ".join(validation_list) if validation_list else (str(record.get("validation", "")) if record.get("validation") else "")
                
                var = {
                    "id": str(record["id"]) if record["id"] else "",
                    "driver": driver_string,
                    "sector": sector_str,
                    "domain": domain_str,
                    "country": country_str,
                    "part": str(record["part"]) if record["part"] else "",
                    "group": str(record["group"]) if record["group"] else "",
                    "section": str(record["section"]) if record["section"] else "",
                    "variable": str(record["variable"]) if record["variable"] else "",
                    "formatI": str(record["formatI"]) if record["formatI"] else "",
                    "formatII": str(record["formatII"]) if record["formatII"] else "",
                    "gType": str(record["gType"]) if record["gType"] else "",
                    "validation": combined_validation,
                    "default": str(record["default"]) if record["default"] else "",
                    "graph": str(record["graph"]) if record["graph"] else "Yes",
                    "status": str(record["status"]) if record["status"] else "Active",
                    "is_meme": record.get("is_meme", False),
                    "is_group_key": record.get("is_group_key", False),
                    "group_key": str(record.get("group_key") or ""),
                    "objectRelationships": int(record["objectRelationships"]) if record["objectRelationships"] is not None else 0,
                    "objectRelationshipsList": [],
                    "variations": int(record["variations"]) if record["variations"] is not None else 0
                }
                variables.append(var)

            return variables

    except Exception as e:
        print(f"Error fetching variables: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch variables: {str(e)}")

@router.post("/variables", response_model=VariableResponse)
async def create_variable(variable_data: VariableCreateRequest):
    """
    Create a new variable in the CDM with proper taxonomy structure.
    Also handles variationsList for variations management.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            variable_id = str(uuid.uuid4())

            group_id = merge_part_section_group(
                session,
                variable_data.part,
                variable_data.section,
                variable_data.group,
            )
            if variable_name_exists_in_group(session, group_id, variable_data.variable, exclude_variable_id=None):
                raise HTTPException(
                    status_code=400,
                    detail=f"Variable '{variable_data.variable}' already exists in Group '{variable_data.group}' "
                    f"(Section '{variable_data.section}', Part '{variable_data.part}').",
                )

            result = session.run(
                """
                MATCH (g:Group {id: $group_id})
                CREATE (v:Variable {
                    id: $id,
                    name: $variable,
                    formatI: $formatI,
                    formatII: $formatII,
                    gType: $gType,
                    validation: $validation,
                    default: $default,
                    graph: $graph,
                    status: $status,
                    driver: $driver,
                    is_meme: $is_meme,
                    is_group_key: $is_group_key,
                    `Is Group Key`: $is_group_key,
                    `Group Key`: CASE WHEN $is_group_key THEN $id ELSE '' END
                })
                MERGE (g)-[:HAS_VARIABLE]->(v)
                RETURN v.id AS id, v.name AS variable,
                       v.formatI AS formatI, v.formatII AS formatII, v.gType AS gType,
                       v.validation AS validation, v.default AS default, v.graph AS graph,
                       v.status AS status, COALESCE(v.is_meme, false) AS is_meme,
                       coalesce(v.`Is Group Key`, v.is_group_key, false) AS is_group_key,
                       coalesce(v.`Group Key`, '') AS group_key,
                       $section AS section, $part AS part, $group AS group
                """,
                {
                    "id": variable_id,
                    "group_id": group_id,
                    "part": variable_data.part,
                    "group": variable_data.group,
                    "section": variable_data.section,
                    "variable": variable_data.variable,
                    "formatI": variable_data.formatI,
                    "formatII": variable_data.formatII,
                    "gType": variable_data.gType,
                    "validation": variable_data.validation or "",
                    "default": variable_data.default or "",
                    "graph": variable_data.graph or "Yes",
                    "status": variable_data.status or "Active",
                    "driver": variable_data.driver or "ALL, ALL, ALL, None",
                    "is_meme": getattr(variable_data, "isMeme", False) or False,
                    "is_group_key": getattr(variable_data, "isGroupKey", False) or False,
                },
            )

            record = result.single()
            if not record:
                raise HTTPException(status_code=500, detail="Failed to create variable")

            if bool(getattr(variable_data, "isGroupKey", False) or False):
                _apply_group_key_selection_by_group_name(session, variable_id, True)
                refreshed = session.run("""
                    MATCH (v:Variable {id: $id})
                    RETURN coalesce(v.`Is Group Key`, v.is_group_key, false) AS is_group_key,
                           coalesce(v.`Group Key`, '') AS group_key
                """, {"id": variable_id}).single()
                if refreshed:
                    record = {**record, "is_group_key": refreshed.get("is_group_key", False), "group_key": refreshed.get("group_key", "")}

            # Create driver relationships
            print(f"About to create driver relationships for variable {variable_id}")
            await create_driver_relationships(session, variable_id, variable_data.driver)
            print(f"Driver relationships creation completed for variable {variable_id}")

            # Handle variationsList if provided
            has_variations_list = variable_data.variationsList is not None and len(variable_data.variationsList) > 0
            if has_variations_list:
                parsed_variations_list = variable_data.variationsList
                print(f"DEBUG: Processing {len(parsed_variations_list)} variations for new variable")
                
                for var in parsed_variations_list:
                    variation_name = var.get("name", "").strip()
                    if not variation_name:
                        continue
                    
                    print(f"DEBUG: Processing variation: {variation_name}")
                    
                    # Check if variation exists globally (case-insensitive)
                    existing_variation = session.run("""
                        MATCH (var:Variation)
                        WHERE toLower(var.name) = toLower($variation_name)
                        RETURN var.id as id, var.name as name
                    """, variation_name=variation_name).single()
                    
                    if existing_variation:
                        # Variation exists globally, connect it to this variable
                        variation_id = existing_variation["id"]
                        print(f"DEBUG: Connecting existing global variation '{variation_name}' to variable {variable_id}")
                        
                        session.run("""
                            MATCH (v:Variable {id: $variable_id})
                            MATCH (var:Variation {id: $variation_id})
                            CREATE (v)-[:HAS_VARIATION]->(var)
                        """, variable_id=variable_id, variation_id=variation_id)
                    else:
                        # Create new variation
                        variation_id = str(uuid.uuid4())
                        print(f"DEBUG: Creating new variation '{variation_name}' for variable {variable_id}")
                        
                        session.run("""
                            CREATE (var:Variation {
                                id: $variation_id,
                                name: $variation_name
                            })
                        """, variation_id=variation_id, variation_name=variation_name)
                        
                        session.run("""
                            MATCH (v:Variable {id: $variable_id})
                            MATCH (var:Variation {id: $variation_id})
                            CREATE (v)-[:HAS_VARIATION]->(var)
                        """, variable_id=variable_id, variation_id=variation_id)

            # Get variations count and list for the newly created variable
            variations_result = session.run("""
                MATCH (v:Variable {id: $id})-[:HAS_VARIATION]->(var:Variation)
                RETURN count(var) as count, collect(DISTINCT {id: var.id, name: var.name}) as variations
            """, {"id": record["id"]})

            variations_record = variations_result.single()
            variations_count = variations_record["count"] if variations_record else 0
            variations_list = variations_record["variations"] if variations_record and variations_record["variations"] else []

            return VariableResponse(
                id=record["id"],
                driver=variable_data.driver,
                part=record["part"],
                group=record["group"],
                section=record["section"],
                variable=record["variable"],
                formatI=record["formatI"],
                formatII=record["formatII"],
                gType=record["gType"],
                validation=record["validation"],
                default=record["default"],
                graph=record["graph"],
                status=record["status"],
                is_meme=record.get("is_meme", False),
                is_group_key=record.get("is_group_key", False),
                group_key=record.get("group_key", ""),
                objectRelationships=0,
                objectRelationshipsList=[],
                variations=variations_count,
                variationsList=variations_list
            )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating variable: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create variable: {str(e)}")


@router.post("/variables/bulk-update", response_model=BulkVariableUpdateResponse)
async def bulk_update_variables(bulk_data: BulkVariableUpdateRequest):
    """
    Bulk update multiple variables with the same changes.
    Only updates fields that are provided (not None) and not "Keep Current" values.
    Applies validation rules: overwrites only where new value chosen, leaves Keep Current fields untouched.
    """
    print("=" * 80, flush=True)
    print("🚀🚀🚀 BULK_UPDATE_VARIABLES ENDPOINT CALLED 🚀🚀🚀", flush=True)
    print(f"Received bulk_data: {bulk_data}", flush=True)
    print("=" * 80, flush=True)
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    # Validate that variable_ids is provided and not empty
    if not bulk_data.variable_ids or len(bulk_data.variable_ids) == 0:
        raise HTTPException(status_code=400, detail="No variable IDs provided for bulk update")
    
    # Filter out any None or empty string IDs
    valid_variable_ids = [vid for vid in bulk_data.variable_ids if vid and str(vid).strip()]
    if len(valid_variable_ids) == 0:
        raise HTTPException(status_code=400, detail="No valid variable IDs provided for bulk update")
    
    if len(valid_variable_ids) != len(bulk_data.variable_ids):
        print(f"WARNING: Filtered out {len(bulk_data.variable_ids) - len(valid_variable_ids)} invalid variable IDs")

    updated_count = 0
    errors = []

    try:
        print(f"DEBUG: Bulk update - Processing {len(valid_variable_ids)} variables", flush=True)
        print(f"DEBUG: Bulk update - Variable IDs: {valid_variable_ids}", flush=True)
        print(f"DEBUG: Bulk update - Update fields provided: {[k for k, v in bulk_data.model_dump().items() if k != 'variable_ids' and v is not None]}", flush=True)
        print(f"DEBUG: Bulk update - validation field: {bulk_data.validation}", flush=True)
        print(f"DEBUG: Bulk update - shouldAppendValidations: {bulk_data.shouldAppendValidations}", flush=True)
        
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            for variable_id in valid_variable_ids:
                try:
                    variable_id_str = str(variable_id).strip()
                    if not variable_id_str:
                        print(f"WARNING: Empty variable ID in list, skipping", flush=True)
                        errors.append("Empty variable ID provided")
                        continue
                    
                    print(f"DEBUG: Processing variable ID: {variable_id_str}", flush=True)
                    
                    # Get current variable data - first check if variable exists
                    # Use a simple query that doesn't require relationships
                    current_result = session.run("""
                        MATCH (v:Variable {id: $id})
                        RETURN v.id as id, v.name as name, v.section as section
                    """, {"id": variable_id_str})

                    current_record = current_result.single()
                    if not current_record:
                        error_msg = f"Variable {variable_id_str} not found in database"
                        print(f"DEBUG: {error_msg}", flush=True)
                        errors.append(error_msg)
                        continue
                    
                    print(f"DEBUG: Variable {variable_id_str} found: {current_record.get('name', 'N/A')}", flush=True)
                    
                    # Get the full variable node for property access
                    variable_node_result = session.run("""
                        MATCH (v:Variable {id: $id})
                        RETURN v
                    """, {"id": variable_id_str})
                    variable_node_record = variable_node_result.single()
                    if not variable_node_record:
                        error_msg = f"Variable {variable_id_str} node not found (second query)"
                        print(f"DEBUG: {error_msg}", flush=True)
                        errors.append(error_msg)
                        continue
                    
                    current_variable = variable_node_record["v"]
                    print(f"DEBUG: Variable {variable_id_str} node retrieved successfully", flush=True)

                    # Build dynamic SET clause for only provided fields that are not "Keep Current"
                    set_clauses = []
                    params = {"id": variable_id_str}  # Use variable_id_str instead of variable_id
                    
                    # Helper function to check if a field should be updated
                    def should_update_field(value: Optional[str], keep_current_text: str = "Keep Current") -> bool:
                        if value is None:
                            return False
                        stripped = value.strip()
                        return stripped != "" and stripped != keep_current_text and not stripped.startswith("Keep Current") and not stripped.startswith("Keep current")
                    
                    # Only update fields that are provided, not empty, and not "Keep Current" values
                    # NOTE: Part and Group are NOT properties on Variable nodes - they are relationships
                    # Part/Group updates are handled separately in the relationship update section below
                    if should_update_field(bulk_data.variable, "Keep current variable"):
                        set_clauses.append("v.name = $variable")
                        params["variable"] = bulk_data.variable
                    if should_update_field(bulk_data.formatI, "Keep Current Format I"):
                        set_clauses.append("v.formatI = $formatI")
                        params["formatI"] = bulk_data.formatI
                    if should_update_field(bulk_data.formatII, "Keep Current Format II"):
                        set_clauses.append("v.formatII = $formatII")
                        params["formatII"] = bulk_data.formatII
                    if should_update_field(bulk_data.gType, "Keep Current G-Type"):
                        set_clauses.append("v.gType = $gType")
                        params["gType"] = bulk_data.gType
                    if should_update_field(bulk_data.validation, "Keep Current Validation"):
                        print(f"DEBUG: Processing validation field for variable {variable_id_str}: {bulk_data.validation}", flush=True)
                        print(f"DEBUG: shouldAppendValidations flag: {bulk_data.shouldAppendValidations}", flush=True)
                        # Handle special bulk validation formats
                        # The validation_value may contain multiple validations separated by commas
                        # Each validation might be a special format (_BULK_RANGE_<operator> or _BULK_RELATIVE_<operator>)
                        validation_parts = [v.strip() for v in bulk_data.validation.split(',') if v.strip()]
                        print(f"DEBUG: Split validation into {len(validation_parts)} parts: {validation_parts}", flush=True)
                        processed_validations = []
                        
                        for part in validation_parts:
                            # Check if it's a bulk Range validation (format: _BULK_RANGE_<operator>)
                            if part.startswith("_BULK_RANGE_"):
                                operator = part.replace("_BULK_RANGE_", "")
                                # Use the variable's formatI as the value, with Val Type prefix
                                formatI_value = current_variable.get('formatI', '')
                                if formatI_value:
                                    processed_validations.append(f"Range {operator} {formatI_value}")
                            
                            # Check if it's a bulk Relative validation (format: _BULK_RELATIVE_<operator>)
                            elif part.startswith("_BULK_RELATIVE_"):
                                operator = part.replace("_BULK_RELATIVE_", "")
                                # Use the variable's name as the value, with Val Type prefix
                                variable_name = current_variable.get('name', '')
                                if variable_name:
                                    processed_validations.append(f"Relative {operator} {variable_name}")
                            
                            # Regular validation (already in correct format)
                            else:
                                processed_validations.append(part)
                        
                        validation_value = ', '.join(processed_validations)
                        print(f"DEBUG: Processed validation value: {validation_value}", flush=True)
                        
                        # Check if we should append validations instead of replacing
                        if bulk_data.shouldAppendValidations:
                            # Get current validation value
                            current_validation = current_variable.get('validation', '') or ''
                            current_validation = str(current_validation).strip()
                            print(f"DEBUG: Current validation for variable {variable_id_str}: '{current_validation}'", flush=True)
                            
                            # Append new validations to existing ones (comma-separated)
                            if current_validation:
                                # Combine with existing
                                validation_value = f"{current_validation}, {validation_value}"
                                print(f"DEBUG: Appended validation: '{validation_value}'", flush=True)
                            else:
                                print(f"DEBUG: No existing validation, using new validation: '{validation_value}'", flush=True)
                            # If no existing validation, just use the new one
                            # (validation_value is already set above)
                        else:
                            print(f"DEBUG: Replacing validation (not appending): '{validation_value}'", flush=True)
                        
                        set_clauses.append("v.validation = $validation")
                        params["validation"] = validation_value
                        print(f"DEBUG: Final validation value to save: '{validation_value}'", flush=True)
                    if should_update_field(bulk_data.default, "Keep Current Default"):
                        set_clauses.append("v.default = $default")
                        params["default"] = bulk_data.default
                    if should_update_field(bulk_data.graph, "Keep Current Graph"):
                        set_clauses.append("v.graph = $graph")
                        params["graph"] = bulk_data.graph
                    if should_update_field(bulk_data.status, "Keep Current Status"):
                        set_clauses.append("v.status = $status")
                        params["status"] = bulk_data.status
                    if should_update_field(bulk_data.driver):
                        set_clauses.append("v.driver = $driver")
                        params["driver"] = bulk_data.driver

                    # Ontology (Part → Section → Group) — resolve existing group only (no auto-create in bulk edit)
                    part_provided = should_update_field(bulk_data.part, "Keep Current Part")
                    section_provided = should_update_field(bulk_data.section, "Keep current section")
                    group_provided = should_update_field(bulk_data.group, "Keep Current Group")

                    if part_provided or section_provided or group_provided:
                        tax = get_variable_taxonomy(session, variable_id_str)
                        if not tax:
                            errors.append(
                                f"Variable {variable_id_str}: Missing Part/Section/Group linkage in graph"
                            )
                            continue
                        cp, cs, cg = tax["part"], tax["section"], tax["group"]
                        np = bulk_data.part.strip() if part_provided else cp
                        ns = bulk_data.section.strip() if section_provided else cs
                        ng = bulk_data.group.strip() if group_provided else cg

                        if np != cp:
                            if not (section_provided and group_provided):
                                errors.append(
                                    f"Variable {variable_id_str}: When changing Part, select new Section and Group."
                                )
                                continue
                        elif ns != cs:
                            if not group_provided:
                                errors.append(
                                    f"Variable {variable_id_str}: When changing Section, select a Group."
                                )
                                continue
                        elif ng != cg:
                            if not group_provided:
                                errors.append(
                                    f"Variable {variable_id_str}: When changing Group, pick the new Group value."
                                )
                                continue

                        if (np, ns, ng) != (cp, cs, cg):
                            gid = resolve_group_id(session, np, ns, ng)
                            if not gid:
                                errors.append(
                                    f"Variable {variable_id_str}: No Group '{ng}' under Part '{np}', Section '{ns}'. "
                                    "Create the taxonomy first or choose an existing Group."
                                )
                                continue
                            try:
                                relink_variable_to_group(session, variable_id_str, gid)
                            except Exception as e:
                                errors.append(
                                    f"Variable {variable_id_str}: Failed to relink ontology: {str(e)}"
                                )
                                continue

                    # Only update if there are fields to update
                    if set_clauses:
                        update_query = f"""
                            MATCH (v:Variable {{id: $id}})
                            SET {', '.join(set_clauses)}
                        """
                        session.run(update_query, params)
                        print(f"DEBUG: Bulk edit - Updated variable {variable_id_str} properties: {', '.join(set_clauses)}", flush=True)

                    # Update driver relationships if driver field is provided, not empty, and not "Keep Current"
                    if bulk_data.driver is not None and bulk_data.driver.strip() != "" and bulk_data.driver.strip() != "Keep Current":
                        try:
                            print(f"Updating driver relationships with: {bulk_data.driver}")
                            await create_driver_relationships(session, variable_id_str, bulk_data.driver)
                        except Exception as e:
                            print(f"Error creating driver relationships for variable {variable_id_str}: {str(e)}")
                            errors.append(f"Failed to create driver relationships for variable {variable_id_str}: {str(e)}")

                    # Handle object relationships if provided
                    if bulk_data.objectRelationshipsList is not None and len(bulk_data.objectRelationshipsList) > 0:
                        # If shouldOverrideRelationships is true, delete all existing relationships first
                        if bulk_data.shouldOverrideRelationships:
                            print(f"🗑️ Deleting all existing relationships for variable {variable_id_str} (override mode)")
                            try:
                                # Delete all HAS_SPECIFIC_VARIABLE relationships
                                delete_specific = session.run("""
                                    MATCH (o:Object)-[r:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $variable_id})
                                    DELETE r
                                    RETURN count(r) as deleted_count
                                """, {"variable_id": variable_id_str})
                                specific_count = delete_specific.single()["deleted_count"] if delete_specific.single() else 0
                                
                                # Delete all HAS_VARIABLE relationships
                                delete_all = session.run("""
                                    MATCH (o:Object)-[r:HAS_VARIABLE]->(v:Variable {id: $variable_id})
                                    DELETE r
                                    RETURN count(r) as deleted_count
                                """, {"variable_id": variable_id_str})
                                all_count = delete_all.single()["deleted_count"] if delete_all.single() else 0
                                
                                print(f"✅ Deleted {specific_count} HAS_SPECIFIC_VARIABLE and {all_count} HAS_VARIABLE relationships")
                            except Exception as e:
                                print(f"⚠️ Error deleting existing relationships for variable {variable_id_str}: {str(e)}")
                                errors.append(f"Failed to delete existing relationships for variable {variable_id_str}: {str(e)}")
                        
                        print(f"Processing {len(bulk_data.objectRelationshipsList)} object relationships")
                        for relationship in bulk_data.objectRelationshipsList:
                            try:
                                # Create object relationship for this variable
                                await create_object_relationship_for_variable(session, variable_id_str, relationship)
                            except Exception as e:
                                print(f"Error creating object relationship for variable {variable_id_str}: {str(e)}")
                                errors.append(f"Failed to create object relationship for variable {variable_id_str}: {str(e)}")

                    updated_count += 1

                except HTTPException as e:
                    # Catch HTTPExceptions (like 404) and add them to errors instead of re-raising
                    error_msg = f"Variable {variable_id_str}: {e.detail}"
                    print(f"HTTPException for variable {variable_id_str}: {error_msg}", flush=True)
                    errors.append(error_msg)
                    continue
                except Exception as e:
                    # Catch all other exceptions and add them to errors
                    error_msg = str(e)
                    print(f"Error updating variable {variable_id_str}: {error_msg}", flush=True)
                    import traceback
                    traceback.print_exc()
                    # Check if the error message contains "404" or "not found" to provide better context
                    if "404" in error_msg or "not found" in error_msg.lower():
                        errors.append(f"Variable {variable_id_str}: {error_msg}")
                    else:
                        errors.append(f"Failed to update variable {variable_id_str}: {error_msg}")
                    continue

        # Always return 200, even if there are errors - errors are in the response body
        return BulkVariableUpdateResponse(
            success=updated_count > 0,
            message=f"Updated {updated_count} variables successfully" + (f" ({len(errors)} errors)" if errors else ""),
            updated_count=updated_count,
            error_count=len(errors),
            errors=errors
        )

    except HTTPException as e:
        # If an HTTPException escapes the inner try blocks, it means something went wrong
        # Log it and return a response with the error instead of re-raising
        print(f"HTTPException in bulk update (outer catch): {e.status_code} - {e.detail}", flush=True)
        import traceback
        traceback.print_exc()
        return BulkVariableUpdateResponse(
            success=False,
            message=f"Bulk update failed: {e.detail}",
            updated_count=updated_count,
            error_count=len(errors) + 1,
            errors=errors + [str(e.detail)]
        )
    except Exception as e:
        print(f"Error in bulk update: {e}", flush=True)
        import traceback
        traceback.print_exc()
        # Return error response instead of raising 500
        return BulkVariableUpdateResponse(
            success=False,
            message=f"Bulk update failed: {str(e)}",
            updated_count=updated_count,
            error_count=len(errors) + 1,
            errors=errors + [f"Unexpected error: {str(e)}"]
        )


@router.put("/variables/{variable_id}", response_model=VariableResponse)
async def update_variable(variable_id: str, request: Request):
    """
    Update an existing variable in the CDM with proper taxonomy structure.
    Supports partial updates - only updates fields that are provided.
    Also handles variationsList for variations management.
    """
    # Read raw body to get extra fields like "Validation #2", "Validation #3", etc.
    body_bytes = await request.body()
    raw_data = json.loads(body_bytes.decode('utf-8'))
    print(f"🔍 DEBUG: Raw request body keys: {list(raw_data.keys())}", flush=True)
    print(f"🔍 DEBUG: Raw request body: {raw_data}", flush=True)
    
    # Create Pydantic model from raw data to preserve extra fields
    # Use model_construct to bypass validation and preserve extra fields
    variable_data = VariableUpdateRequest.model_construct(**raw_data)
    
    # Log the parsed Pydantic model
    print(f"🎭 update_variable called with variable_id={variable_id}, variable_data={variable_data}")
    print(f"🎭 variable_data.isMeme={variable_data.isMeme}, type={type(variable_data.isMeme)}")
    
    # Check if isGroupKey exists as an attribute
    print(f"🔑 hasattr(variable_data, 'isGroupKey'): {hasattr(variable_data, 'isGroupKey')}")
    if hasattr(variable_data, 'isGroupKey'):
        print(f"🔑 variable_data.isGroupKey={variable_data.isGroupKey}, type={type(variable_data.isGroupKey)}")
    else:
        print(f"🔑 ERROR: isGroupKey attribute does not exist on variable_data!")
    
    # Use model_dump() to see all fields
    try:
        model_dict = variable_data.model_dump()
        print(f"🔑 variable_data.model_dump() keys: {list(model_dict.keys())}")
        print(f"🔑 isGroupKey in model_dump: {model_dict.get('isGroupKey')}")
        print(f"🔑 Full model_dump: {model_dict}")
    except Exception as e:
        print(f"🔑 Could not get model_dump: {e}")
        try:
            print(f"🔑 variable_data.__dict__: {variable_data.__dict__}")
        except:
            print(f"🔑 Could not get __dict__ either")
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        print(f"DEBUG: Updating variable {variable_id}")
        print(f"DEBUG: variable_data type: {type(variable_data)}")
        print(f"DEBUG: variable_data: {variable_data}")
        print(f"DEBUG: variationsList: {variable_data.variationsList}")
        print(f"DEBUG: variationsList type: {type(variable_data.variationsList)}")
        
        with driver.session() as session:
            # First, get the current variable data
            current_result = session.run("""
                MATCH (p:Part)-[:HAS_SECTION]->(s:Section)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v:Variable {id: $id})
                RETURN v, p.name as part, s.name as section, g.name as group, g.id as group_id
            """, {"id": variable_id})

            current_record = current_result.single()
            print(f"DEBUG: Query result - current_record is None: {current_record is None}")
            if not current_record:
                print(f"DEBUG: ERROR - Variable {variable_id} not found or has no Part/Section/Group linkage!")
                raise HTTPException(status_code=404, detail="Variable not found")

            current_variable = current_record["v"]
            current_part = current_record["part"] if current_record["part"] else ""
            current_section = current_record["section"] if current_record.get("section") else ""
            current_group = current_record["group"] if current_record["group"] else ""
            # Get driver from current variable node
            current_driver = current_variable.get("driver", "") if hasattr(current_variable, 'get') else getattr(current_variable, 'driver', "")
            # Get is_meme and group key flags from node properties
            current_is_meme = current_variable.get("is_meme", False) if hasattr(current_variable, 'get') else getattr(current_variable, 'is_meme', False)
            current_is_group_key = (
                current_variable.get("Is Group Key", None) if hasattr(current_variable, 'get') else getattr(current_variable, "Is Group Key", None)
            )
            if current_is_group_key is None:
                current_is_group_key = current_variable.get("is_group_key", False) if hasattr(current_variable, 'get') else getattr(current_variable, 'is_group_key', False)
            current_group_key = (
                current_variable.get("Group Key", "") if hasattr(current_variable, 'get') else getattr(current_variable, "Group Key", "")
            )
            
            import sys
            sys.stdout.flush()
            print(f"DEBUG: Retrieved current values from Neo4j - Part='{current_part}', Group='{current_group}'", flush=True)
            print(f"DEBUG: About to process Part/Group updates...", flush=True)

            # Build dynamic SET clause for only provided fields
            set_clauses = []
            params = {"id": variable_id}
            
            # Only update fields that are provided in the request
            if variable_data.variable is not None:
                set_clauses.append("v.name = $variable")
                params["variable"] = variable_data.variable
            if variable_data.formatI is not None:
                set_clauses.append("v.formatI = $formatI")
                params["formatI"] = variable_data.formatI
            if variable_data.formatII is not None:
                set_clauses.append("v.formatII = $formatII")
                params["formatII"] = variable_data.formatII
            if variable_data.gType is not None:
                set_clauses.append("v.gType = $gType")
                params["gType"] = variable_data.gType
            # Handle validation and additional validation properties (Validation #2, Validation #3, etc.)
            if variable_data.validation is not None:
                set_clauses.append("v.validation = $validation")
                params["validation"] = variable_data.validation
            
            # Get all fields from the raw request data to check for additional validation properties
            # Use raw_data directly since it contains all fields including extra ones
            print(f"🔍 DEBUG: Looking for Validation # properties in raw_data...", flush=True)
            
            # Collect Validation #N properties to add from raw_data
            validation_props_to_add = {}
            for key, value in raw_data.items():
                if key.startswith("Validation #") and value is not None:
                    print(f"🔍 DEBUG: Found validation property: {key} = {value}", flush=True)
                    validation_props_to_add[key] = value
            
            print(f"🔍 DEBUG: validation_props_to_add: {validation_props_to_add}", flush=True)
            
            # If we have Validation #N properties, first remove all existing ones, then add new ones
            if validation_props_to_add:
                # Get current variable node to find all Validation #N properties to remove
                current_props_result = session.run("""
                    MATCH (v:Variable {id: $id})
                    RETURN keys(v) as keys
                """, {"id": variable_id})
                current_props_record = current_props_result.single()
                if current_props_record:
                    current_keys = current_props_record.get("keys", [])
                    # Build REMOVE clause for all Validation #N properties
                    remove_keys = [k for k in current_keys if k.startswith("Validation #")]
                    if remove_keys:
                        # Remove old Validation #N properties
                        remove_clause = ", ".join([f"v.`{k}`" for k in remove_keys])
                        session.run(f"""
                            MATCH (v:Variable {{id: $id}})
                            REMOVE {remove_clause}
                        """, {"id": variable_id})
                
                # Add new Validation #N properties
                for key, value in validation_props_to_add.items():
                    # Escape the property name for Neo4j (property names with spaces and # need backticks)
                    param_key = key.replace(' ', '_').replace('#', 'num').replace('`', '')
                    set_clauses.append(f"v.`{key}` = ${param_key}")
                    params[param_key] = value
            if variable_data.default is not None:
                set_clauses.append("v.default = $default")
                params["default"] = variable_data.default
            if variable_data.graph is not None:
                set_clauses.append("v.graph = $graph")
                params["graph"] = variable_data.graph
            if variable_data.status is not None:
                set_clauses.append("v.status = $status")
                params["status"] = variable_data.status
            if variable_data.driver is not None:
                set_clauses.append("v.driver = $driver")
                params["driver"] = variable_data.driver
            if variable_data.isMeme is not None:
                is_meme_value = bool(variable_data.isMeme)
                set_clauses.append("v.is_meme = $is_meme")
                params["is_meme"] = is_meme_value
                print(f"DEBUG: 🎭 Adding is_meme update: {is_meme_value} for variable {variable_id}")
            
            # Track isGroupKey (processed after ontology moves using Group *name* scope).
            is_group_key_provided = False
            is_group_key_value = None
            
            # First, check what attributes the variable_data object actually has
            print(f"DEBUG: 🔑 Checking isGroupKey - hasattr isGroupKey: {hasattr(variable_data, 'isGroupKey')}")
            print(f"DEBUG: 🔑 Checking isGroupKey - hasattr is_group_key: {hasattr(variable_data, 'is_group_key')}")
            if hasattr(variable_data, 'isGroupKey'):
                print(f"DEBUG: 🔑 variable_data.isGroupKey value: {variable_data.isGroupKey}, type: {type(variable_data.isGroupKey)}")
            if hasattr(variable_data, 'is_group_key'):
                print(f"DEBUG: 🔑 variable_data.is_group_key value: {variable_data.is_group_key}, type: {type(variable_data.is_group_key)}")
            
            # Check if isGroupKey is provided (camelCase from frontend)
            if hasattr(variable_data, 'isGroupKey') and variable_data.isGroupKey is not None:
                is_group_key_value = bool(variable_data.isGroupKey)
                is_group_key_provided = True
                print(f"DEBUG: 🔑 Received isGroupKey (camelCase): {is_group_key_value} for variable {variable_id}")
            # Also check for snake_case (in case it comes through that way)
            elif hasattr(variable_data, 'is_group_key') and variable_data.is_group_key is not None:
                is_group_key_value = bool(variable_data.is_group_key)
                is_group_key_provided = True
                print(f"DEBUG: 🔑 Received is_group_key (snake_case): {is_group_key_value} for variable {variable_id}")
            else:
                print(f"DEBUG: 🔑 WARNING: isGroupKey not found or is None in variable_data")
            
            if is_group_key_provided:
                print(f"DEBUG: 🔑 Queued is_group_key update: {is_group_key_value} for variable {variable_id}")

            # Ontology moves (must run before property SET so duplicate-name checks use final group)
            part_provided = variable_data.part is not None and str(variable_data.part).strip() != ""
            section_provided = variable_data.section is not None and str(variable_data.section).strip() != ""
            group_provided = variable_data.group is not None and str(variable_data.group).strip() != ""

            if part_provided or section_provided or group_provided:
                np = variable_data.part.strip() if part_provided else current_part
                ns = variable_data.section.strip() if section_provided else current_section
                ng = variable_data.group.strip() if group_provided else current_group

                if np != current_part:
                    if not (section_provided and group_provided):
                        raise HTTPException(
                            status_code=400,
                            detail="When changing Part, you must provide Section and Group.",
                        )
                elif ns != current_section:
                    if not group_provided:
                        raise HTTPException(
                            status_code=400,
                            detail="When changing Section, you must provide Group.",
                        )
                elif ng != current_group:
                    if not group_provided:
                        raise HTTPException(
                            status_code=400,
                            detail="When changing Group, select the new Group value.",
                        )

                if (np, ns, ng) != (current_part, current_section, current_group):
                    gid = resolve_group_id(session, np, ns, ng)
                    if not gid:
                        raise HTTPException(
                            status_code=400,
                            detail=f"No Group '{ng}' under Part '{np}', Section '{ns}'. Create the taxonomy first.",
                        )
                    relink_variable_to_group(session, variable_id, gid)

            if variable_data.variable is not None:
                new_nm = variable_data.variable.strip()
                old_nm = (current_variable.get("name") or "").strip()
                if new_nm != old_nm:
                    tax = get_variable_taxonomy(session, variable_id)
                    if tax:
                        tg = resolve_group_id(session, tax["part"], tax["section"], tax["group"])
                        if tg and variable_name_exists_in_group(
                            session, tg, new_nm, exclude_variable_id=variable_id
                        ):
                            raise HTTPException(
                                status_code=400,
                                detail=f"Variable name '{new_nm}' already exists in this Group.",
                            )

            # Only update if there are fields to update
            if set_clauses:
                update_query = f"""
                    MATCH (v:Variable {{id: $id}})
                    SET {', '.join(set_clauses)}
                    RETURN v.id as id, v.name as variable,
                           v.formatI as formatI, v.formatII as formatII, v.gType as gType,
                           v.validation as validation, v.default as default, v.graph as graph,
                           v.status as status, COALESCE(v.driver, '') as driver,
                           COALESCE(v.is_meme, false) as is_meme,
                           coalesce(v.`Is Group Key`, v.is_group_key, false) as is_group_key,
                           coalesce(v.`Group Key`, '') as group_key
                """
                
                print(f"DEBUG: 🎭 Executing variable update query with is_meme: {params.get('is_meme', 'NOT_SET')}, is_group_key: {params.get('is_group_key', 'NOT_SET')}")
                result = session.run(update_query, params)
                record = result.single()
                if record:
                    print(f"DEBUG: 🎭 ✅ Variable update successful - is_meme: {record.get('is_meme')}, is_group_key: {record.get('is_group_key')}")
            else:
                # No fields to update, use current data
                record = {
                    "id": current_variable["id"],
                    "variable": current_variable["name"],
                    "section": current_section,
                    "formatI": current_variable.get("formatI", "") if hasattr(current_variable, 'get') else getattr(current_variable, 'formatI', ""),
                    "formatII": current_variable.get("formatII", "") if hasattr(current_variable, 'get') else getattr(current_variable, 'formatII', ""),
                    "gType": current_variable.get("gType", "") if hasattr(current_variable, 'get') else getattr(current_variable, 'gType', ""),
                    "validation": current_variable.get("validation", "") if hasattr(current_variable, 'get') else getattr(current_variable, 'validation', ""),
                    "default": current_variable.get("default", "") if hasattr(current_variable, 'get') else getattr(current_variable, 'default', ""),
                    "graph": current_variable.get("graph", "") if hasattr(current_variable, 'get') else getattr(current_variable, 'graph', ""),
                    "status": current_variable.get("status", "") if hasattr(current_variable, 'get') else getattr(current_variable, 'status', ""),
                    "is_meme": current_is_meme,
                    "is_group_key": current_is_group_key,
                    "group_key": current_group_key or ""
                }

            if is_group_key_provided:
                _apply_group_key_selection_by_group_name(session, variable_id, bool(is_group_key_value))
                refreshed_group_key = session.run("""
                    MATCH (v:Variable {id: $id})
                    RETURN coalesce(v.`Is Group Key`, v.is_group_key, false) AS is_group_key,
                           coalesce(v.`Group Key`, '') AS group_key
                """, {"id": variable_id}).single()
                if refreshed_group_key:
                    record = {**record, "is_group_key": refreshed_group_key.get("is_group_key", False), "group_key": refreshed_group_key.get("group_key", "")}

            # Update driver relationships ONLY if driver field is provided AND it actually changed.
            # Compare against the pre-update value we loaded at the start of this request.
            if variable_data.driver is not None:
                new_driver = variable_data.driver.strip() if variable_data.driver else ""
                previous_driver = current_driver.strip() if current_driver else ""
                
                # Only update driver relationships if the driver actually changed
                if new_driver != previous_driver:
                    print(f"DEBUG: Driver changed from '{previous_driver}' to '{new_driver}', updating relationships")
                    await create_driver_relationships(session, variable_id, variable_data.driver)
                else:
                    print(f"DEBUG: Driver unchanged ('{previous_driver}'), skipping driver relationship update")

            # Handle variationsList if provided
            has_variations_list = variable_data.variationsList is not None and len(variable_data.variationsList) > 0
            if has_variations_list:
                parsed_variations_list = variable_data.variationsList
                print(f"DEBUG: Processing {len(parsed_variations_list)} variations")
                
                for var in parsed_variations_list:
                    variation_name = var.get("name", "").strip()
                    if not variation_name:
                        continue
                    
                    print(f"DEBUG: Processing variation: {variation_name}")
                    
                    # Check if variation already exists for this variable (case-insensitive)
                    existing_variation_for_variable = session.run("""
                        MATCH (v:Variable {id: $variable_id})-[:HAS_VARIATION]->(var:Variation)
                        WHERE toLower(var.name) = toLower($variation_name)
                        RETURN var.id as id, var.name as name
                    """, variable_id=variable_id, variation_name=variation_name).single()
                    
                    if existing_variation_for_variable:
                        print(f"DEBUG: Variation '{variation_name}' already exists for variable {variable_id}, skipping")
                        continue
                    
                    # Check if variation exists globally (case-insensitive)
                    existing_variation = session.run("""
                        MATCH (var:Variation)
                        WHERE toLower(var.name) = toLower($variation_name)
                        RETURN var.id as id, var.name as name
                    """, variation_name=variation_name).single()
                    
                    if existing_variation:
                        # Variation exists globally, connect it to this variable
                        variation_id = existing_variation["id"]
                        print(f"DEBUG: Connecting existing global variation '{variation_name}' to variable {variable_id}")
                        
                        session.run("""
                            MATCH (v:Variable {id: $variable_id})
                            MATCH (var:Variation {id: $variation_id})
                            CREATE (v)-[:HAS_VARIATION]->(var)
                        """, variable_id=variable_id, variation_id=variation_id)
                    else:
                        # Create new variation
                        variation_id = str(uuid.uuid4())
                        print(f"DEBUG: Creating new variation '{variation_name}' for variable {variable_id}")
                        
                        session.run("""
                            CREATE (var:Variation {
                                id: $variation_id,
                                name: $variation_name
                            })
                        """, variation_id=variation_id, variation_name=variation_name)
                        
                        session.run("""
                            MATCH (v:Variable {id: $variable_id})
                            MATCH (var:Variation {id: $variation_id})
                            CREATE (v)-[:HAS_VARIATION]->(var)
                        """, variable_id=variable_id, variation_id=variation_id)

            # Get object relationships count
            relationships_result = session.run("""
                MATCH (o:Object)-[:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $id})
                RETURN count(o) as count
            """, {"id": variable_id})

            relationships_record = relationships_result.single()
            relationships_count = relationships_record["count"] if relationships_record else 0

            # Get variations count and list
            variations_result = session.run("""
                MATCH (v:Variable {id: $id})-[:HAS_VARIATION]->(var:Variation)
                RETURN count(var) as count, collect(DISTINCT {id: var.id, name: var.name}) as variations
            """, {"id": variable_id})

            variations_record = variations_result.single()
            variations_count = variations_record["count"] if variations_record else 0
            variations_list = variations_record["variations"] if variations_record and variations_record["variations"] else []

            updated_result = session.run("""
                MATCH (v:Variable {id: $id})
                OPTIONAL MATCH (p:Part)-[:HAS_SECTION]->(s:Section)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v)
                RETURN p.name AS part, s.name AS section, g.name AS grp
            """, {"id": variable_id})

            updated_record = updated_result.single()
            if updated_record:
                final_part = updated_record.get("part") or current_part
                final_section = updated_record.get("section") or current_section
                final_group = updated_record.get("grp") or current_group
                print(f"DEBUG: Retrieved taxonomy from Neo4j: Part={final_part}, Section={final_section}, Group={final_group}", flush=True)
            else:
                final_part = current_part
                final_section = current_section
                final_group = current_group
            
            # Get driver: use provided value, or fall back to current driver from Neo4j, or from record if available
            final_driver = variable_data.driver if variable_data.driver is not None else (record.get("driver") if record and record.get("driver") is not None else current_driver)

            # Get all validation properties and combine them into comma-separated string
            # Query the variable node again to get all properties including Validation #2, #3, etc.
            final_validation_result = session.run("""
                MATCH (v:Variable {id: $id})
                RETURN properties(v) as allProps
            """, {"id": variable_id})
            final_validation_record = final_validation_result.single()
            combined_validation = record.get("validation", "") or ""
            if final_validation_record:
                all_props = final_validation_record.get("allProps", {})
                validation_list = []
                if all_props.get("validation"):
                    validation_list.append(str(all_props["validation"]))
                # Get all Validation #N properties and sort them numerically
                validation_keys = [k for k in all_props.keys() if k.startswith("Validation #")]
                validation_keys.sort(key=lambda x: int(x.split("#")[1].strip()) if "#" in x and x.split("#")[1].strip().isdigit() else 999)
                for key in validation_keys:
                    if all_props.get(key):
                        validation_list.append(str(all_props[key]))
                # Combine into comma-separated string
                if validation_list:
                    combined_validation = ", ".join(validation_list)
                print(f"🔍 DEBUG: Combined validation for response: {combined_validation}", flush=True)

            return VariableResponse(
                id=record["id"],
                driver=final_driver,
                part=final_part,
                group=final_group,
                section=final_section,
                variable=record["variable"],
                formatI=record["formatI"],
                formatII=record["formatII"],
                gType=record["gType"],
                validation=combined_validation,
                default=record["default"],
                graph=record["graph"],
                status=record["status"],
                is_meme=record.get("is_meme", False),
                is_group_key=record.get("is_group_key", False),
                group_key=record.get("group_key", ""),
                objectRelationships=relationships_count,
                objectRelationshipsList=[],
                variations=variations_count,
                variationsList=variations_list
            )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating variable: {e}", flush=True)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update variable: {str(e)}")

@router.delete("/variables/{variable_id}")
async def delete_variable(variable_id: str):
    """
    Delete a variable from the CDM.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            # Check if variable exists first
            check_result = session.run("""
                MATCH (v:Variable {id: $id})
                RETURN v.id as id
            """, {"id": variable_id})
            
            check_record = check_result.single()
            if not check_record:
                raise HTTPException(status_code=404, detail="Variable not found")
            
            # Delete the variable and all its relationships using write transaction
            # Capture the ID before deletion since we can't access the node after DETACH DELETE
            def delete_tx(tx):
                # First, capture the ID
                check = tx.run("""
                    MATCH (v:Variable {id: $id})
                    RETURN v.id as id
                """, {"id": variable_id})
                check_record = check.single()
                if not check_record:
                    return None
                
                # Then delete (can't return the node after deletion)
                tx.run("""
                    MATCH (v:Variable {id: $id})
                    DETACH DELETE v
                """, {"id": variable_id})
                
                return check_record
            
            record = session.execute_write(delete_tx)
            if not record:
                raise HTTPException(status_code=404, detail="Variable not found")

            print(f"✅ Successfully deleted variable {variable_id}")
            return {"message": "Variable deleted successfully"}

    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        print(f"Error deleting variable {variable_id}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to delete variable: {str(e)}")

@router.get("/variables/{variable_id}/object-relationships")
async def get_object_relationships(variable_id: str):
    """
    Get all object relationships for a variable.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            relationships = []
            
            # Get HAS_SPECIFIC_VARIABLE relationships
            # Note: sector, domain, country are in the driver string, not as separate properties
            result = session.run("""
                MATCH (o:Object)-[r:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $variable_id})
                RETURN o.driver as driver, o.classifier as classifier,
                       o.being as being, o.avatar as avatar, o.object as object, r.createdBy as createdBy, 
                       "HAS_SPECIFIC_VARIABLE" as relationshipType
            """, {"variable_id": variable_id})
            
            for record in result:
                # Parse driver string to extract sector, domain, country
                driver = record.get("driver", "") or ""
                sector = ""
                domain = ""
                country = ""
                
                if driver:
                    parts = [p.strip() for p in driver.split(",")]
                    if len(parts) >= 1:
                        sector = parts[0] if parts[0] else ""
                    if len(parts) >= 2:
                        domain = parts[1] if parts[1] else ""
                    if len(parts) >= 3:
                        country = parts[2] if parts[2] else ""
                
                relationships.append({
                    "relationshipType": record["relationshipType"],
                    "toSector": sector,
                    "toDomain": domain,
                    "toCountry": country,
                    "toObjectClarifier": record.get("classifier", "") or "",
                    "toBeing": record["being"],
                    "toAvatar": record["avatar"], 
                    "toObject": record["object"],
                    "createdBy": record.get("createdBy")
                })
            
            # Get HAS_VARIABLE relationships (one relationship that applies to all objects)
            has_variable_result = session.run("""
                MATCH (v:Variable {id: $variable_id})-[r:HAS_VARIABLE]-(obj:Object)
                RETURN DISTINCT "HAS_VARIABLE" as relationshipType
                LIMIT 1
            """, {"variable_id": variable_id})
            
            if has_variable_result.single():
                relationships.append({
                    "relationshipType": "HAS_VARIABLE",
                    "toSector": "ALL",
                    "toDomain": "ALL",
                    "toCountry": "ALL",
                    "toObjectClarifier": "",
                    "toBeing": "ALL",
                    "toAvatar": "ALL",
                    "toObject": "ALL"
                })
            
            print(f"Found {len(relationships)} object relationships for variable {variable_id}")
            return {"relationships": relationships}
            
    except Exception as e:
        print(f"Error getting object relationships: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get object relationships: {str(e)}")

@router.post("/variables/{variable_id}/object-relationships")
async def create_object_relationship(variable_id: str, relationship_data: ObjectRelationshipCreateRequest):
    """
    Create an object relationship for a variable with role property.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        print(f"🔵 Creating object relationship for variable {variable_id} with data: {relationship_data}")
        # Use explicit write transaction to ensure commits
        # Neo4j Python driver requires explicit transaction handling for writes
        def create_relationships_tx(tx):
            """Transaction function to create relationships"""
            # Find the variable
            variable_result = tx.run("""
                MATCH (v:Variable {id: $id})
                RETURN v.id as id
            """, {"id": variable_id})

            variable_record = variable_result.single()
            if not variable_record:
                raise HTTPException(status_code=404, detail="Variable not found")

            relationship_type = relationship_data.relationship_type or "HAS_SPECIFIC_VARIABLE"
            
            # For HAS_SPECIFIC_VARIABLE, find matching objects by being, avatar, object
            params = {
                "being": relationship_data.to_being,
                "avatar": relationship_data.to_avatar,
                "object": relationship_data.to_object
            }
            
            # Match objects by being, avatar, and object
            print(f"🔵 Matching objects with: being={params['being']}, avatar={params['avatar']}, object={params['object']}")
            objects_result = tx.run("""
                MATCH (o:Object {being: $being, avatar: $avatar, object: $object})
                RETURN o.id as id, o.being as being, o.avatar as avatar, o.object as object
            """, params)
            
            relationships_created = 0
            records_list = list(objects_result)
            print(f"🔵 Found {len(records_list)} matching objects")
            
            if len(records_list) == 0:
                error_msg = f"No objects found matching: {params['being']} - {params['avatar']} - {params['object']}"
                print(f"⚠️ {error_msg}")
                raise HTTPException(status_code=404, detail=error_msg)
            
            for record in records_list:
                object_id = record["id"]
                print(f"🔵 Processing object {object_id} ({record['being']} - {record['avatar']} - {record['object']})")
                
                # Create the relationship using MERGE
                result = tx.run("""
                    MATCH (v:Variable {id: $variable_id})
                    MATCH (o:Object {id: $object_id})
                    MERGE (o)-[r:HAS_SPECIFIC_VARIABLE]->(v)
                    ON CREATE SET r.createdBy = "frontend"
                    RETURN r, o.id as object_id, v.id as variable_id, ID(r) as rel_id
                """, {
                    "variable_id": variable_id, 
                    "object_id": object_id
                })
                
                # Consume ALL results to ensure transaction processes
                records = list(result)
                if records:
                    result_record = records[0]
                    relationships_created += 1
                    print(f"✅ Created/verified relationship for object {object_id} -> variable {variable_id}")
                    print(f"   Relationship ID: {result_record.get('rel_id', 'N/A')}")
                else:
                    print(f"⚠️ MERGE returned no result for object {object_id}")
                    raise HTTPException(status_code=500, detail=f"Failed to create relationship: MERGE returned no result")
            
            print(f"✅ Transaction: Created {relationships_created} relationships")
            
            # Verify in same transaction
            final_check = tx.run("""
                MATCH (v:Variable {id: $variable_id})<-[r:HAS_SPECIFIC_VARIABLE]-(o:Object)
                RETURN count(r) as count
            """, {"variable_id": variable_id})
            
            final_result = final_check.single()
            final_count = final_result["count"] if final_result else 0
            
            print(f"🔍 Transaction verification: Found {final_count} relationships in transaction")
            return {"created": relationships_created, "verified": final_count}
        
        # Execute transaction with explicit write mode
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            result = session.execute_write(create_relationships_tx)
            relationships_created = result["created"]
            final_count = result["verified"]
            
            print(f"✅ Transaction completed: Created {relationships_created}, Verified {final_count}")
            
            if relationships_created > 0 and final_count < relationships_created:
                print(f"⚠️ WARNING: Created {relationships_created} relationships but only {final_count} found!")
            else:
                print(f"✅ SUCCESS: All {relationships_created} relationships verified and committed")
            
            # Update the variable's objectRelationships count
            session.run("""
                MATCH (v:Variable {id: $variable_id})
                SET v.objectRelationships = size([(o:Object)-[:HAS_SPECIFIC_VARIABLE]->(v) | o])
            """, {"variable_id": variable_id})
            
            return {"message": f"Created {relationships_created} object relationships", "created": relationships_created, "verified": final_count}

    except Exception as e:
        print(f"Error creating object relationship: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create object relationship: {str(e)}")

@router.delete("/variables/{variable_id}/object-relationships")
async def delete_object_relationship(variable_id: str, relationship_data: ObjectRelationshipCreateRequest):
    """
    Delete object relationships for a variable by criteria.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        print(f"Deleting object relationships for variable {variable_id} with criteria: {relationship_data}")
        with driver.session() as session:
            relationship_type = relationship_data.relationship_type or "HAS_SPECIFIC_VARIABLE"
            
            # If deleting HAS_VARIABLE, delete all HAS_VARIABLE relationships
            if relationship_type == "HAS_VARIABLE":
                result = session.run("""
                    MATCH (o:Object)-[r:HAS_VARIABLE]->(v:Variable {id: $variable_id})
                    DELETE r
                    RETURN count(r) as deleted_count
                """, {"variable_id": variable_id})
                
                deleted_count = result.single()["deleted_count"]
                print(f"Successfully deleted {deleted_count} HAS_VARIABLE relationships")
                return {"message": f"Deleted {deleted_count} HAS_VARIABLE relationships"}
            
            # For HAS_SPECIFIC_VARIABLE, find matching objects by being, avatar, object
            # These are the core identifying fields
            params = {
                "variable_id": variable_id,
                "being": relationship_data.to_being,
                "avatar": relationship_data.to_avatar,
                "object": relationship_data.to_object
            }
            
            # Match objects by being, avatar, and object that have relationships to this variable
            objects_result = session.run("""
                MATCH (o:Object {being: $being, avatar: $avatar, object: $object})-[r:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $variable_id})
                RETURN o
            """, params)
            
            # Delete relationships
            relationships_deleted = 0
            for record in objects_result:
                object_id = record["o"]["id"]
                print(f"Deleting relationship between variable {variable_id} and object {object_id}")
                session.run("""
                    MATCH (o:Object {id: $object_id})-[r:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $variable_id})
                    DELETE r
                """, {
                    "variable_id": variable_id, 
                    "object_id": object_id
                })
                relationships_deleted += 1

            # Update the variable's objectRelationships count
            session.run("""
                MATCH (v:Variable {id: $variable_id})
                SET v.objectRelationships = size([(o:Object)-[:HAS_SPECIFIC_VARIABLE]->(v) | o])
            """, {"variable_id": variable_id})

            print(f"Successfully deleted {relationships_deleted} object relationships")
            return {"message": f"Deleted {relationships_deleted} object relationships"}

    except Exception as e:
        print(f"Error deleting object relationship: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete object relationship: {str(e)}")

@router.post("/variables/bulk-object-relationships", response_model=Dict[str, Any])
async def bulk_create_variable_object_relationships(request: BulkVariableObjectRelationshipCreateRequest = Body(...)):
    """Create multiple variable-object relationships in bulk"""
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")
    
    try:
        with driver.session() as session:
            # First, validate all relationships and check for duplicates
            duplicates = []
            variable_ids = set()
            relationships_to_create = []
            
            # Collect all variable IDs
            for rel in request.relationships:
                variable_ids.add(rel.variable_id)
            
            # Check for duplicates before creating
            # Duplicate = same (variable + object) pair, regardless of other fields
            for rel in request.relationships:
                # Find target objects matching the criteria
                where_conditions = []
                params = {}
                
                if rel.target_being != "ALL":
                    where_conditions.append("target.being = $to_being")
                    params["to_being"] = rel.target_being
                
                if rel.target_avatar != "ALL":
                    where_conditions.append("target.avatar = $to_avatar")
                    params["to_avatar"] = rel.target_avatar
                
                if rel.target_object != "ALL":
                    where_conditions.append("target.object = $to_object")
                    params["to_object"] = rel.target_object
                
                where_clause = " AND ".join(where_conditions) if where_conditions else "true"
                
                # Check for existing relationships (any relationship between variable and target)
                # Per spec: duplicate = same (variable + object) pair, regardless of other fields
                check_query = f"""
                    MATCH (v:Variable {{id: $variable_id}})<-[r:HAS_SPECIFIC_VARIABLE]-(target:Object)
                    WHERE {where_clause}
                    RETURN v.id as variable_id, target.object as target_object, target.being as target_being, 
                           target.avatar as target_avatar
                    LIMIT 1
                """
                params_check = {**params, "variable_id": rel.variable_id}
                existing = session.run(check_query, **params_check).single()
                
                if existing:
                    duplicates.append({
                        "variable_id": rel.variable_id,
                        "target_object": f"{existing.get('target_being', '')} - {existing.get('target_avatar', '')} - {existing.get('target_object', 'Unknown')}"
                    })
            
            # If duplicates found, return error with full list
            if duplicates:
                duplicate_messages = [
                    f"Variable {dup['variable_id']} → {dup['target_object']}"
                    for dup in duplicates
                ]
                raise HTTPException(
                    status_code=400,
                    detail=f"Duplicate relationship detected. The following variable-object pairs already exist:\n" + "\n".join(duplicate_messages)
                )
            
            # Validate that all target objects exist
            missing_objects = []
            for rel in request.relationships:
                where_conditions = []
                params = {}
                
                if rel.target_being != "ALL":
                    where_conditions.append("target.being = $to_being")
                    params["to_being"] = rel.target_being
                
                if rel.target_avatar != "ALL":
                    where_conditions.append("target.avatar = $to_avatar")
                    params["to_avatar"] = rel.target_avatar
                
                if rel.target_object != "ALL":
                    where_conditions.append("target.object = $to_object")
                    params["to_object"] = rel.target_object
                
                where_clause = " AND ".join(where_conditions) if where_conditions else "true"
                
                check_query = f"""
                    MATCH (target:Object)
                    WHERE {where_clause}
                    RETURN count(target) as count
                """
                result = session.run(check_query, **params).single()
                count = result["count"] if result else 0
                
                if count == 0:
                    missing_objects.append(f"{rel.target_being} - {rel.target_avatar} - {rel.target_object}")
            
            if missing_objects:
                raise HTTPException(
                    status_code=404,
                    detail=f"One or more objects in your CSV do not exist in the dataset:\n" + "\n".join(missing_objects)
                )
            
            # Create all relationships in a single transaction
            created_count = 0
            for rel in request.relationships:
                # Find target objects matching the criteria
                where_conditions = []
                params = {}
                
                if rel.target_being != "ALL":
                    where_conditions.append("target.being = $to_being")
                    params["to_being"] = rel.target_being
                
                if rel.target_avatar != "ALL":
                    where_conditions.append("target.avatar = $to_avatar")
                    params["to_avatar"] = rel.target_avatar
                
                if rel.target_object != "ALL":
                    where_conditions.append("target.object = $to_object")
                    params["to_object"] = rel.target_object
                
                where_clause = " AND ".join(where_conditions) if where_conditions else "true"
                
                query = f"""
                    MATCH (target:Object)
                    WHERE {where_clause}
                    RETURN target.id as target_id, target.being as being, target.avatar as avatar, target.object as object
                """
                
                target_results = session.run(query, **params).data()
                
                # Create relationships for each target
                for target_result in target_results:
                    target_id = target_result["target_id"]
                    
                    try:
                        session.run("""
                            MATCH (v:Variable {id: $variable_id})
                            MATCH (o:Object {id: $target_id})
                            MERGE (o)-[r:HAS_SPECIFIC_VARIABLE]->(v)
                            ON CREATE SET r.createdBy = "frontend"
                        """, variable_id=rel.variable_id, target_id=target_id)
                        created_count += 1
                    except Exception as e:
                        print(f"DEBUG: Error creating relationship: {e}")
            
            # Update relationship counts for all affected variables
            for variable_id in variable_ids:
                count_result = session.run("""
                    MATCH (v:Variable {id: $variable_id})<-[r:HAS_SPECIFIC_VARIABLE]-(o:Object)
                    RETURN count(r) as rel_count
                """, variable_id=variable_id).single()
                
                rel_count = count_result["rel_count"] if count_result else 0
                
                session.run("""
                    MATCH (v:Variable {id: $variable_id})
                    SET v.objectRelationships = $rel_count
                """, variable_id=variable_id, rel_count=rel_count)
            
            # Update variables count for all affected objects
            # Get all unique object IDs that were affected
            affected_object_ids = set()
            for rel in request.relationships:
                where_conditions = []
                params = {}
                
                if rel.target_being != "ALL":
                    where_conditions.append("target.being = $to_being")
                    params["to_being"] = rel.target_being
                
                if rel.target_avatar != "ALL":
                    where_conditions.append("target.avatar = $to_avatar")
                    params["to_avatar"] = rel.target_avatar
                
                if rel.target_object != "ALL":
                    where_conditions.append("target.object = $to_object")
                    params["to_object"] = rel.target_object
                
                where_clause = " AND ".join(where_conditions) if where_conditions else "true"
                
                query = f"""
                    MATCH (target:Object)
                    WHERE {where_clause}
                    RETURN target.id as target_id
                """
                
                target_results = session.run(query, **params).data()
                for target_result in target_results:
                    affected_object_ids.add(target_result["target_id"])
            
            # Update variables count for each affected object
            for object_id in affected_object_ids:
                count_result = session.run("""
                    MATCH (o:Object {id: $object_id})-[r:HAS_SPECIFIC_VARIABLE]->(v:Variable)
                    RETURN count(v) as var_count
                """, object_id=object_id).single()
                
                var_count = count_result["var_count"] if count_result else 0
                
                session.run("""
                    MATCH (o:Object {id: $object_id})
                    SET o.variables = $var_count
                """, object_id=object_id, var_count=var_count)
            
            return {
                "message": f"Successfully created {created_count} relationship(s)",
                "created_count": created_count
            }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating bulk variable-object relationships: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create bulk variable-object relationships: {e}")

async def _process_variables_to_db(driver, variables: list, errors: list) -> int:
    """Insert variables into Neo4j in batches and create driver relationships. Modifies errors in place. Returns created_count."""
    BATCH_SIZE = 250
    created_count = 0
    total_batches = (len(variables) + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"Processing {len(variables)} variables in {total_batches} batches of {BATCH_SIZE}")
    with driver.session(default_access_mode=WRITE_ACCESS) as session:
        for batch_idx in range(0, len(variables), BATCH_SIZE):
            batch = variables[batch_idx:batch_idx + BATCH_SIZE]
            batch_num = (batch_idx // BATCH_SIZE) + 1
            print(f"Processing batch {batch_num}/{total_batches} ({len(batch)} variables)")

            def process_batch_tx(tx):
                batch_created = []
                batch_errors = []
                for var_data in batch:
                    try:
                        group_id = merge_part_section_group_tx(
                            tx,
                            var_data["part"],
                            var_data["section"],
                            var_data["group"],
                        )
                        existing_var = tx.run("""
                            MATCH (g:Group {id: $group_id})-[:HAS_VARIABLE]->(v:Variable)
                            WHERE toLower(v.name) = toLower($variable)
                            RETURN v.id as id
                            LIMIT 1
                        """, group_id=group_id, variable=var_data["variable"]).single()
                        if existing_var:
                            batch_errors.append(
                                f"Variable '{var_data['variable']}' already exists in Group '{var_data['group']}' "
                                f"(Section '{var_data['section']}', Part '{var_data['part']}'); skipped"
                            )
                            continue
                        result = tx.run("""
                            MATCH (g:Group {id: $group_id})
                            CREATE (v:Variable {
                                id: $id, name: $variable,
                                formatI: $formatI, formatII: $formatII, gType: $gType,
                                validation: $validation, default: $default, graph: $graph,
                                status: $status, driver: $driver,
                                is_meme: coalesce($is_meme, false),
                                is_group_key: false,
                                `Is Group Key`: false,
                                `Group Key`: ''
                            })
                            MERGE (g)-[:HAS_VARIABLE]->(v)
                            RETURN v.id as id
                        """, {**var_data, "group_id": group_id})
                        record = result.single()
                        if record and record["id"]:
                            batch_created.append(var_data)
                        else:
                            batch_errors.append(f"Variable {var_data['variable']} creation returned no result")
                    except Exception as e:
                        batch_errors.append(f"Failed to create variable {var_data['variable']}: {str(e)}")
                return {"created": batch_created, "errors": batch_errors}

            try:
                batch_result = session.execute_write(process_batch_tx)
                created_vars = batch_result["created"]
                created_count += len(created_vars)
                errors.extend(batch_result["errors"])
                driver_batch_size = 50
                for driver_batch_idx in range(0, len(created_vars), driver_batch_size):
                    driver_batch = created_vars[driver_batch_idx:driver_batch_idx + driver_batch_size]
                    for var_data in driver_batch:
                        try:
                            await create_driver_relationships(session, var_data['id'], var_data['driver'])
                        except Exception as e:
                            errors.append(f"Variable {var_data['variable']} created but driver relationships failed: {str(e)}")
                print(f"✅ Batch {batch_num}/{total_batches} completed: {len(created_vars)} variables created")
            except Exception as e:
                print(f"❌ Batch {batch_num}/{total_batches} failed: {str(e)}")
                for var_data in batch:
                    errors.append(f"Batch {batch_num} failed for variable {var_data['variable']}: {str(e)}")
    return created_count


@router.post("/variables/bulk-upload", response_model=CSVUploadResponse)
async def bulk_upload_variables(file: UploadFile = File(...)):
    """
    Bulk upload variables from CSV file.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV file")

    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        # Read CSV content and parse it robustly
        content = await file.read()
        print(f"CSV content length: {len(content)}")
        
        # Decode content and handle BOM
        try:
            text_content = content.decode('utf-8-sig')
        except UnicodeDecodeError:
            text_content = content.decode('utf-8')
        
        # Parse CSV manually to handle unquoted fields with spaces
        # Normalize line endings first to handle Windows-style (\r\n) and Unix-style (\n) newlines
        text_content = text_content.replace('\r\n', '\n').replace('\r', '\n')
        
        lines = text_content.strip().split('\n')
        if not lines:
            raise HTTPException(status_code=400, detail="Empty CSV file")
        
        # Get headers from first line - use csv module to handle quoted fields
        import csv as csv_module
        header_reader = csv_module.reader([lines[0]])
        headers = next(header_reader)
        headers = [h.strip() for h in headers]
        
        # Validate required column names exist exactly (CSV must have these headers)
        required_columns = ['Sector', 'Domain', 'Country', 'Part', 'Section', 'Group', 'Variable']
        missing_columns = [col for col in required_columns if col not in headers]
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"CSV must contain these exact column headers (required): {', '.join(required_columns)}. "
                    f"Missing: {', '.join(missing_columns)}. "
                    "Optional: Format I, Format II, G-Type, Type, Default, Graph."
                )
            )
        
        # Parse data rows using csv module to properly handle quoted fields with commas
        rows = []
        parse_errors = []
        for i, line in enumerate(lines[1:], start=2):
            if not line.strip():
                continue
            
            try:
                # Use csv module to parse line (handles quoted fields correctly)
                line_reader = csv_module.reader([line])
                values = next(line_reader)
                values = [v.strip() for v in values]
                
                # Create row dictionary
                row = {}
                for j, header in enumerate(headers):
                    row[header] = values[j] if j < len(values) else ""
                rows.append(row)
            except Exception as e:
                print(f"⚠️  Error parsing row {i}: {str(e)}")
                print(f"   Line content: {line[:100]}...")  # First 100 chars
                parse_errors.append(f"Row {i}: CSV parsing error - {str(e)}")
                continue
                    
        print(f"Successfully parsed {len(rows)} rows from CSV")
    except Exception as e:
        print(f"Error in CSV parsing: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"CSV parsing error: {str(e)}")
    
    variables = []
    errors = list(parse_errors)  # Carry over any CSV parse errors
    seen_taxonomy_keys: set = set()

    print(f"CSV Headers found: {headers}")
    print(f"First few rows sample: {rows[:3] if len(rows) >= 3 else rows}")
    
    for row_num, row in enumerate(rows, start=2):  # Start at 2 because of header
        try:
            # Validate required fields
            required_fields = ['Sector', 'Domain', 'Country', 'Part', 'Section', 'Group', 'Variable']
            missing_fields = [field for field in required_fields if not row.get(field, '').strip()]
            
            if missing_fields:
                error_msg = f"Row {row_num}: Missing required fields: {', '.join(missing_fields)}"
                print(f"❌ {error_msg}")
                print(f"   Row data: {row}")
                errors.append(error_msg)
                continue

            p, s, g, v = (
                row["Part"].strip(),
                row["Section"].strip(),
                row["Group"].strip(),
                row["Variable"].strip(),
            )

            dup_key = (p.lower(), s.lower(), g.lower(), v.lower())
            if dup_key in seen_taxonomy_keys:
                errors.append(
                    f"Row {row_num}: Variable conflict — Variable \"{v}\" already exists in Group \"{g}\" "
                    f'(Section "{s}", Part "{p}").'
                )
                continue
            seen_taxonomy_keys.add(dup_key)

            metadata = _extract_variable_csv_metadata(row, row_num, errors)
            if metadata is None:
                continue

            # Parse driver selections
            sector = ['ALL'] if row['Sector'].strip() == 'ALL' else [s.strip() for s in row['Sector'].split(',') if s.strip()]
            domain = ['ALL'] if row['Domain'].strip() == 'ALL' else [d.strip() for d in row['Domain'].split(',') if d.strip()]
            country = ['ALL'] if row['Country'].strip() == 'ALL' else [c.strip() for c in row['Country'].split(',') if c.strip()]
            
            # Create driver string
            sector_str = 'ALL' if 'ALL' in sector else ', '.join(sector)
            domain_str = 'ALL' if 'ALL' in domain else ', '.join(domain)
            country_str = 'ALL' if 'ALL' in country else ', '.join(country)
            driver_string = f"{sector_str}, {domain_str}, {country_str}, None"

            # Create variable data with proper handling of optional fields
            variable_data = {
                "id": str(uuid.uuid4()),
                "driver": driver_string,
                "part": p,
                "section": s,
                "group": g,
                "variable": v,
                "formatI": metadata["formatI"],
                "formatII": metadata["formatII"],
                "gType": metadata["gType"],
                "validation": "",
                "default": metadata["default"],
                "graph": metadata["graph"],
                "is_meme": metadata["is_meme"],
                "status": "Active"
            }
            
            variables.append(variable_data)
            
        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")
            continue

    created_count = await _process_variables_to_db(driver, variables, errors)
    if errors:
        print(f"⚠️ Variable CSV upload completed with {len(errors)} error(s)")
        for err in errors[:20]:
            print(f"   - {err}")
        if len(errors) > 20:
            print(f"   - ... and {len(errors) - 20} more")

    return CSVUploadResponse(
        success=True,
        message=f"Successfully created {created_count} variables",
        created_count=created_count,
        error_count=len(errors),
        errors=errors
    )


@router.post("/variables/bulk-upload-chunk", response_model=CSVUploadResponse)
async def bulk_upload_variables_chunk(body: BulkUploadVariablesChunkRequest):
    """
    Upload a chunk of variable rows as JSON. Use this for large CSVs to avoid request timeouts
    (e.g. Render 30–60s limit). Frontend should parse CSV, split into chunks of ~80–100 rows,
    and call this endpoint per chunk.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    variables = []
    errors = []
    start = body.start_row_index
    required_fields = ['Sector', 'Domain', 'Country', 'Part', 'Section', 'Group', 'Variable']
    seen_chunk: set = set()

    for i, row in enumerate(body.rows):
        row_num = start + i
        if not isinstance(row, dict):
            errors.append(f"Row {row_num}: Invalid row (expected object)")
            continue
        missing = [f for f in required_fields if not (row.get(f) or '').strip()]
        if missing:
            errors.append(f"Row {row_num}: Missing required fields: {', '.join(missing)}")
            continue
        p = (row.get('Part') or '').strip()
        s = (row.get('Section') or '').strip()
        g = (row.get('Group') or '').strip()
        v = (row.get('Variable') or '').strip()

        dup_key = (p.lower(), s.lower(), g.lower(), v.lower())
        if dup_key in seen_chunk:
            errors.append(
                f"Row {row_num}: Variable conflict — Variable \"{v}\" already exists in Group \"{g}\" "
                f'(Section "{s}", Part "{p}").'
            )
            continue
        seen_chunk.add(dup_key)
        metadata = _extract_variable_csv_metadata(row, row_num, errors)
        if metadata is None:
            continue

        sector = ['ALL'] if (row.get('Sector') or '').strip() == 'ALL' else [s.strip() for s in (row.get('Sector') or '').split(',') if s.strip()]
        domain = ['ALL'] if (row.get('Domain') or '').strip() == 'ALL' else [d.strip() for d in (row.get('Domain') or '').split(',') if d.strip()]
        country = ['ALL'] if (row.get('Country') or '').strip() == 'ALL' else [c.strip() for c in (row.get('Country') or '').split(',') if c.strip()]
        sector_str = 'ALL' if 'ALL' in sector else ', '.join(sector)
        domain_str = 'ALL' if 'ALL' in domain else ', '.join(domain)
        country_str = 'ALL' if 'ALL' in country else ', '.join(country)
        driver_string = f"{sector_str}, {domain_str}, {country_str}, None"
        variable_data = {
            "id": str(uuid.uuid4()),
            "driver": driver_string,
            "part": p,
            "section": s,
            "group": g,
            "variable": v,
            "formatI": metadata["formatI"],
            "formatII": metadata["formatII"],
            "gType": metadata["gType"],
            "validation": "",
            "default": metadata["default"],
            "graph": metadata["graph"],
            "is_meme": metadata["is_meme"],
            "status": "Active",
        }
        variables.append(variable_data)

    created_count = await _process_variables_to_db(driver, variables, errors)
    if errors:
        print(f"⚠️ Variable CSV chunk upload completed with {len(errors)} error(s)")
        for err in errors[:20]:
            print(f"   - {err}")
        if len(errors) > 20:
            print(f"   - ... and {len(errors) - 20} more")
    return CSVUploadResponse(
        success=True,
        message=f"Chunk: created {created_count} variables",
        created_count=created_count,
        error_count=len(errors),
        errors=errors,
    )


@router.get("/variables/test/{variable_id}")
async def test_variable_lookup(variable_id: str):
    """Test endpoint to check if variable lookup works"""
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")
    
    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (v:Variable {id: $id})
                RETURN v
            """, {"id": variable_id})
            
            record = result.single()
            if not record:
                return {"found": False, "message": "Variable not found"}
            else:
                return {"found": True, "variable": dict(record["v"])}
    except Exception as e:
        return {"error": str(e)}

async def create_object_relationship_for_variable(session, variable_id: str, relationship_data: ObjectRelationshipCreateRequest):
    """
    Create an object relationship for a variable.
    Note: Variable existence is already verified in the calling function.
    """
    try:
        # Find matching objects based on the relationship criteria
        if relationship_data.to_being == "ALL" and relationship_data.to_avatar == "ALL" and relationship_data.to_object == "ALL":
            # Connect to all objects
            objects_result = session.run("MATCH (o:Object) RETURN o")
        elif relationship_data.to_being == "ALL" and relationship_data.to_avatar == "ALL":
            # Connect to all objects with specific object name
            objects_result = session.run("MATCH (o:Object {object: $object}) RETURN o", {"object": relationship_data.to_object})
        elif relationship_data.to_being == "ALL":
            # Connect to all objects with specific avatar and object
            objects_result = session.run("MATCH (o:Object {avatar: $avatar, object: $object}) RETURN o", 
                {"avatar": relationship_data.to_avatar, "object": relationship_data.to_object})
        elif relationship_data.to_object == "ALL":
            # Connect to all objects with specific being and avatar (regardless of object name)
            objects_result = session.run("MATCH (o:Object {being: $being, avatar: $avatar}) RETURN o", 
                {"being": relationship_data.to_being, "avatar": relationship_data.to_avatar})
        else:
            # Connect to specific being, avatar, and object
            objects_result = session.run("MATCH (o:Object {being: $being, avatar: $avatar, object: $object}) RETURN o", 
                {"being": relationship_data.to_being, "avatar": relationship_data.to_avatar, "object": relationship_data.to_object})

        # Create relationships with HAS_SPECIFIC_VARIABLE relationship name
        relationships_created = 0
        for record in objects_result:
            # Check if relationship already exists to avoid duplicates
            existing_rel = session.run("""
                MATCH (o:Object {id: $object_id})-[r:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $variable_id})
                RETURN r
            """, {
                "variable_id": variable_id, 
                "object_id": record["o"]["id"]
            }).single()
            
            if not existing_rel:
                session.run("""
                    MATCH (v:Variable {id: $variable_id})
                    MATCH (o:Object {id: $object_id})
                    MERGE (o)-[:HAS_SPECIFIC_VARIABLE {createdBy: "frontend"}]->(v)
                """, {
                    "variable_id": variable_id, 
                    "object_id": record["o"]["id"]
                })
                relationships_created += 1

        return relationships_created

    except Exception as e:
        print(f"Error creating object relationship: {e}")
        raise e

@router.post("/variables/backfill-driver-relationships", response_model=Dict[str, Any])
async def backfill_driver_relationships():
    """
    ONE-TIME backfill endpoint to create IS_RELEVANT_TO relationships for ALL existing variables.
    
    This endpoint:
    - Processes all existing variables in the database
    - Creates relationships based on each variable's driver string property
    - Reconstructs driver string from existing relationships if not stored
    - Uses default "ALL, ALL, ALL, None" if no driver info exists
    
    IMPORTANT: This is a ONE-TIME migration endpoint. The create_driver_relationships
    function is idempotent (deletes existing relationships first), so it's safe to
    call multiple times, but this endpoint should only be run once per environment.
    
    After running this, all new variables created/updated will automatically get
    driver relationships created via create_driver_relationships in their respective endpoints.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            # Get all variables
            result = session.run("""
                MATCH (v:Variable)
                RETURN v.id as id, v.name as variable, v.driver as driver
                ORDER BY v.id
            """)
            
            variables = []
            for record in result:
                variables.append({
                    "id": record["id"],
                    "variable": record["variable"],
                    "driver": record.get("driver")
                })
            
            print(f"Found {len(variables)} variables to process")
            
            created_count = 0
            skipped_count = 0
            error_count = 0
            errors = []
            
            # For each variable, create driver relationships
            for var in variables:
                variable_id = var["id"]
                variable_name = var["variable"]
                driver_string = var.get("driver")
                
                # If no driver string stored, try to reconstruct from existing relationships
                if not driver_string or driver_string.strip() == "":
                    # Try to get driver string from existing IS_RELEVANT_TO relationships
                    rel_result = session.run("""
                        MATCH (v:Variable {id: $variable_id})
                        OPTIONAL MATCH (s:Sector)-[:IS_RELEVANT_TO]->(v)
                        OPTIONAL MATCH (d:Domain)-[:IS_RELEVANT_TO]->(v)
                        OPTIONAL MATCH (c:Country)-[:IS_RELEVANT_TO]->(v)
                        OPTIONAL MATCH (vc:VariableClarifier)-[:IS_RELEVANT_TO]->(v)
                        WITH v, 
                             collect(DISTINCT s.name) as sectors,
                             collect(DISTINCT d.name) as domains,
                             collect(DISTINCT c.name) as countries,
                             collect(DISTINCT vc.name) as clarifiers
                        RETURN sectors, domains, countries, clarifiers
                    """, variable_id=variable_id)
                    
                    rel_record = rel_result.single()
                    if rel_record:
                        sectors = rel_record.get("sectors") or []
                        domains = rel_record.get("domains") or []
                        countries = rel_record.get("countries") or []
                        clarifiers = rel_record.get("clarifiers") or []
                        
                        # Reconstruct driver string
                        sector_str = "ALL" if "ALL" in sectors else (", ".join(sectors) if sectors else "ALL")
                        domain_str = "ALL" if "ALL" in domains else (", ".join(domains) if domains else "ALL")
                        country_str = "ALL" if "ALL" in countries else (", ".join(countries) if countries else "ALL")
                        clarifier_str = clarifiers[0] if clarifiers else "None"
                        
                        driver_string = f"{sector_str}, {domain_str}, {country_str}, {clarifier_str}"
                        
                        # Store reconstructed driver string on the variable node
                        session.run("""
                            MATCH (v:Variable {id: $variable_id})
                            SET v.driver = $driver
                        """, variable_id=variable_id, driver=driver_string)
                        print(f"📝 Reconstructed and stored driver string for variable {variable_id}: {driver_string}")
                    else:
                        # No driver string and no existing relationships - use default "ALL, ALL, ALL, None"
                        driver_string = "ALL, ALL, ALL, None"
                        session.run("""
                            MATCH (v:Variable {id: $variable_id})
                            SET v.driver = $driver
                        """, variable_id=variable_id, driver=driver_string)
                        print(f"📝 Using default driver string for variable {variable_id}: {driver_string}")
                
                # Create driver relationships
                if driver_string and driver_string.strip():
                    try:
                        await create_driver_relationships(session, variable_id, driver_string)
                        created_count += 1
                        print(f"✅ Created driver relationships for variable {variable_id} ({variable_name})")
                    except Exception as e:
                        error_count += 1
                        error_msg = f"Failed to create relationships for variable {variable_id} ({variable_name}): {str(e)}"
                        errors.append(error_msg)
                        print(f"❌ {error_msg}")
                else:
                    skipped_count += 1
                    print(f"⚠️ Skipped variable {variable_id} ({variable_name}) - no driver string available")
            
            return {
                "success": True,
                "message": f"Processed {len(variables)} variables",
                "total_variables": len(variables),
                "relationships_created": created_count,
                "skipped": skipped_count,
                "errors": error_count,
                "error_details": errors[:50]  # Limit to first 50 errors
            }
    
    except Exception as e:
        print(f"Error in backfill: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to backfill driver relationships: {str(e)}")

@router.post("/variables/field-options", response_model=Dict[str, Any])
async def add_variable_field_option(option_data: VariableFieldOptionRequest):
    """
    Add a new option value for a variable field (formatI, formatII, gType, validation, default).
    Stores the option in Neo4j so it's available for all variables.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    valid_fields = ['formatI', 'formatII', 'gType', 'validation', 'default']
    if option_data.field_name not in valid_fields:
        raise HTTPException(status_code=400, detail=f"Invalid field name. Must be one of: {', '.join(valid_fields)}")

    if not option_data.value or not option_data.value.strip():
        raise HTTPException(status_code=400, detail="Value cannot be empty")

    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            # First, get current values
            get_result = session.run("""
                MATCH (vfo:VariableFieldOptions {id: 'variable_field_options'})
                RETURN vfo[$field_name] AS current_values,
                       vfo.formatIIByFormatIJson AS formatIIByFormatIJson
            """, {
                "field_name": option_data.field_name
            })

            record = get_result.single()
            current_values = []
            
            if record and record.get("current_values"):
                values = record["current_values"]
                if isinstance(values, list):
                    current_values = [str(v).strip() for v in values if v and str(v).strip()]
                elif isinstance(values, str):
                    current_values = [v.strip() for v in values.split(',') if v.strip()]

            scoped_map: Dict[str, List[str]] = {}
            if record and record.get("formatIIByFormatIJson"):
                raw_map = record.get("formatIIByFormatIJson")
                try:
                    parsed = json.loads(raw_map) if isinstance(raw_map, str) else {}
                    if isinstance(parsed, dict):
                        for k, vals in parsed.items():
                            key = str(k).strip()
                            if not key:
                                continue
                            if isinstance(vals, list):
                                cleaned = sorted({str(v).strip() for v in vals if str(v).strip()})
                                scoped_map[key] = cleaned
                except Exception:
                    scoped_map = {}

            # Add new value if not already present
            new_value = option_data.value.strip()
            parent_value = (option_data.parent_value or "").strip()
            existed_in_flat = new_value in current_values
            if new_value not in current_values:
                current_values.append(new_value)
                current_values.sort()  # Keep sorted

            if option_data.field_name == "formatII":
                if not parent_value:
                    raise HTTPException(
                        status_code=400,
                        detail="parent_value (Format I) is required when adding a Format II option."
                    )
                existing_scoped = scoped_map.get(parent_value, [])
                if new_value not in existing_scoped:
                    existing_scoped.append(new_value)
                    existing_scoped.sort()
                scoped_map[parent_value] = existing_scoped

            # Update the node - create it if it doesn't exist
            session.run("""
                MERGE (vfo:VariableFieldOptions {id: 'variable_field_options'})
                ON CREATE SET vfo.formatI = $default_array, vfo.formatII = $default_array, 
                             vfo.gType = $default_array, vfo.validation = $default_array, 
                             vfo.default = $default_array, vfo.formatIIByFormatIJson = '{}'
                SET vfo[$field_name] = $values,
                    vfo.formatIIByFormatIJson = $formatIIByFormatIJson
            """, {
                "field_name": option_data.field_name,
                "values": current_values,
                "default_array": [],
                "formatIIByFormatIJson": json.dumps(scoped_map),
            })

            action_msg = "already exists in" if existed_in_flat and option_data.field_name != "formatII" else "added to"
            scoped_msg = f" under Format I '{parent_value}'" if option_data.field_name == "formatII" else ""
            return {
                "success": True,
                "field_name": option_data.field_name,
                "value": new_value,
                "parent_value": parent_value if option_data.field_name == "formatII" else None,
                "message": f"'{new_value}' {action_msg} {option_data.field_name} options{scoped_msg}"
            }

    except Exception as e:
        print(f"Error adding field option: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to add field option: {str(e)}")

@router.get("/variables/field-options", response_model=VariableFieldOptionsResponse)
async def get_variable_field_options():
    """
    Get all custom field options for variables (formatI, formatII, gType, validation, default).
    Returns merged list of options from existing variables and custom additions.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Get custom options from VariableFieldOptions node
            result = session.run("""
                MATCH (vfo:VariableFieldOptions {id: 'variable_field_options'})
                RETURN vfo.formatI AS formatI, vfo.formatII AS formatII, vfo.gType AS gType, 
                       vfo.validation AS validation, vfo.default AS default,
                       vfo.formatIIByFormatIJson AS formatIIByFormatIJson
            """)

            record = result.single()
            custom_options = {
                "formatI": [],
                "formatII": [],
                "gType": [],
                "validation": [],
                "default": []
            }

            if record:
                for field in ["formatI", "formatII", "gType", "validation", "default"]:
                    values = record.get(field)
                    if values:
                        if isinstance(values, list):
                            custom_options[field] = [v for v in values if v]
                        elif isinstance(values, str):
                            custom_options[field] = [v.strip() for v in values.split(',') if v.strip()]

            custom_format_ii_by_format_i: Dict[str, List[str]] = {}
            if record and record.get("formatIIByFormatIJson"):
                raw_map = record.get("formatIIByFormatIJson")
                try:
                    parsed = json.loads(raw_map) if isinstance(raw_map, str) else {}
                    if isinstance(parsed, dict):
                        for key, values in parsed.items():
                            k = str(key).strip()
                            if not k:
                                continue
                            if isinstance(values, list):
                                custom_format_ii_by_format_i[k] = sorted(
                                    {str(v).strip() for v in values if str(v).strip()}
                                )
                except Exception:
                    custom_format_ii_by_format_i = {}

            # Get options from existing variables
            existing_options = {
                "formatI": set(),
                "formatII": set(),
                "gType": set(),
                "validation": set(),
                "default": set()
            }

            result = session.run("""
                MATCH (v:Variable)
                RETURN DISTINCT v.formatI AS formatI, v.formatII AS formatII, v.gType AS gType,
                       v.validation AS validation, v.default AS default
            """)

            for record in result:
                for field in ["formatI", "formatII", "gType", "validation", "default"]:
                    value = record.get(field)
                    if value and str(value).strip():
                        existing_options[field].add(str(value).strip())

            # Merge custom options with existing options
            merged_options = {}
            for field in ["formatI", "formatII", "gType", "validation", "default"]:
                merged = set(custom_options[field]) | existing_options[field]
                merged_options[field] = sorted(list(merged))

            existing_format_ii_by_format_i: Dict[str, set] = {}
            result_pairs = session.run("""
                MATCH (v:Variable)
                WHERE v.formatI IS NOT NULL AND trim(v.formatI) <> ''
                  AND v.formatII IS NOT NULL AND trim(v.formatII) <> ''
                RETURN DISTINCT trim(v.formatI) AS formatI, trim(v.formatII) AS formatII
            """)
            for rec in result_pairs:
                fi = rec.get("formatI")
                fii = rec.get("formatII")
                if not fi or not fii:
                    continue
                existing_format_ii_by_format_i.setdefault(fi, set()).add(fii)

            merged_format_ii_by_format_i: Dict[str, List[str]] = {}
            all_keys = set(custom_format_ii_by_format_i.keys()) | set(existing_format_ii_by_format_i.keys())
            for key in all_keys:
                merged_set = set(custom_format_ii_by_format_i.get(key, [])) | set(existing_format_ii_by_format_i.get(key, set()))
                merged_format_ii_by_format_i[key] = sorted(list(merged_set))

            merged_options["formatIIByFormatI"] = merged_format_ii_by_format_i

            return VariableFieldOptionsResponse(**merged_options)

    except Exception as e:
        print(f"Error getting field options: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to get field options: {str(e)}")

class VariableListRelationshipCreateRequest(BaseModel):
    list_id: str

@router.post("/variables/{variable_id}/list-relationships")
async def create_variable_list_relationship(variable_id: str, request: VariableListRelationshipCreateRequest):
    """
    Create a HAS_LIST relationship from a variable to a list.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Check if variable exists
            var_result = session.run("""
                MATCH (v:Variable {id: $variable_id})
                RETURN v.id as id
            """, {"variable_id": variable_id})
            
            if not var_result.single():
                raise HTTPException(status_code=404, detail=f"Variable with id {variable_id} not found")
            
            # Check if list exists
            list_result = session.run("""
                MATCH (l:List {id: $list_id})
                RETURN l.id as id
            """, {"list_id": request.list_id})
            
            if not list_result.single():
                raise HTTPException(status_code=404, detail=f"List with id {request.list_id} not found")
            
            # Check if relationship already exists
            existing_result = session.run("""
                MATCH (v:Variable {id: $variable_id})-[r:HAS_LIST]->(l:List {id: $list_id})
                RETURN r
            """, {"variable_id": variable_id, "list_id": request.list_id})
            
            if existing_result.single():
                raise HTTPException(status_code=400, detail="Relationship already exists")
            
            # Create relationship
            session.run("""
                MATCH (v:Variable {id: $variable_id})
                MATCH (l:List {id: $list_id})
                MERGE (v)-[:HAS_LIST]->(l)
            """, {"variable_id": variable_id, "list_id": request.list_id})
            
            return {"success": True, "message": "Relationship created successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating variable-list relationship: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create variable-list relationship: {str(e)}")

@router.delete("/variables/{variable_id}/list-relationships/{list_id}")
async def delete_variable_list_relationship(variable_id: str, list_id: str):
    """
    Delete a HAS_LIST relationship from a variable to a list.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Check if relationship exists
            result = session.run("""
                MATCH (v:Variable {id: $variable_id})-[r:HAS_LIST]->(l:List {id: $list_id})
                DELETE r
                RETURN count(r) as deleted
            """, {"variable_id": variable_id, "list_id": list_id})
            
            record = result.single()
            deleted = record["deleted"] if record else 0
            
            if deleted == 0:
                raise HTTPException(status_code=404, detail="Relationship not found")
            
            return {"success": True, "message": "Relationship deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting variable-list relationship: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to delete variable-list relationship: {str(e)}")

@router.post("/variables/{target_variable_id}/clone-object-relationships/{source_variable_id}")
async def clone_variable_object_relationships(target_variable_id: str, source_variable_id: str):
    """
    Clone all object relationships from a source variable to a target variable.
    Only works if the target variable has no existing relationships.
    Creates HAS_SPECIFIC_VARIABLE relationships from objects to the target variable.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j.")
    
    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            # Check if target variable exists
            target_check = session.run("""
                MATCH (v:Variable {id: $variable_id})
                RETURN v.id as id, v.variable as variable_name
            """, variable_id=target_variable_id).single()
            
            if not target_check:
                raise HTTPException(status_code=404, detail=f"Target variable with ID {target_variable_id} not found")
            
            # Check if source variable exists
            source_check = session.run("""
                MATCH (v:Variable {id: $variable_id})
                RETURN v.id as id, v.variable as variable_name
            """, variable_id=source_variable_id).single()
            
            if not source_check:
                raise HTTPException(status_code=404, detail=f"Source variable with ID {source_variable_id} not found")
            
            # Check if target variable already has relationships
            existing_rels_count = session.run("""
                MATCH (o:Object)-[:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $variable_id})
                RETURN count(o) as rel_count
            """, variable_id=target_variable_id).single()
            
            has_variable_count = session.run("""
                MATCH (o:Object)-[:HAS_VARIABLE]->(v:Variable {id: $variable_id})
                RETURN count(DISTINCT o) as rel_count
            """, variable_id=target_variable_id).single()
            
            total_existing = (existing_rels_count["rel_count"] if existing_rels_count else 0) + (has_variable_count["rel_count"] if has_variable_count else 0)
            
            if total_existing > 0:
                raise HTTPException(
                    status_code=400, 
                    detail="Target variable already has object relationships. Please delete existing relationships before cloning."
                )
            
            # Get all objects that have relationships to source variable
            # Get HAS_SPECIFIC_VARIABLE relationships
            specific_relationships = session.run("""
                MATCH (o:Object)-[:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $source_id})
                RETURN DISTINCT o.id as object_id, o.being as being, o.avatar as avatar, o.object as object
            """, source_id=source_variable_id).data()
            
            # Get HAS_VARIABLE relationships (one relationship that applies to all objects)
            has_variable_exists = session.run("""
                MATCH (o:Object)-[:HAS_VARIABLE]->(v:Variable {id: $source_id})
                RETURN count(DISTINCT o) as count
            """, source_id=source_variable_id).single()
            
            has_variable_relationship = (has_variable_exists["count"] if has_variable_exists else 0) > 0
            
            if not specific_relationships and not has_variable_relationship:
                return {
                    "message": "Source variable has no object relationships to clone",
                    "cloned_count": 0
                }
            
            cloned_count = 0
            
            # Clone HAS_SPECIFIC_VARIABLE relationships
            for rel in specific_relationships:
                object_id = rel["object_id"]
                try:
                    # Create HAS_SPECIFIC_VARIABLE relationship from object to target variable
                    result = session.run("""
                        MATCH (o:Object {id: $object_id})
                        MATCH (v:Variable {id: $target_id})
                        MERGE (o)-[r:HAS_SPECIFIC_VARIABLE]->(v)
                        ON CREATE SET r.createdBy = "clone"
                        RETURN r
                    """, object_id=object_id, target_id=target_variable_id)
                    
                    if result.single():
                        cloned_count += 1
                        print(f"✅ Cloned HAS_SPECIFIC_VARIABLE relationship: Object {object_id} -> Variable {target_variable_id}")
                except Exception as e:
                    print(f"⚠️ Error cloning relationship for object {object_id}: {e}")
            
            # Clone HAS_VARIABLE relationship if it exists
            if has_variable_relationship:
                # Get all objects and create HAS_VARIABLE relationship to target variable
                all_objects = session.run("""
                    MATCH (o:Object)
                    RETURN o.id as object_id
                """).data()
                
                for obj in all_objects:
                    object_id = obj["object_id"]
                    try:
                        result = session.run("""
                            MATCH (o:Object {id: $object_id})
                            MATCH (v:Variable {id: $target_id})
                            MERGE (o)-[r:HAS_VARIABLE]->(v)
                            ON CREATE SET r.createdBy = "clone"
                            RETURN r
                        """, object_id=object_id, target_id=target_variable_id)
                        
                        if result.single():
                            cloned_count += 1
                    except Exception as e:
                        print(f"⚠️ Error cloning HAS_VARIABLE relationship for object {object_id}: {e}")
            
            # Update the target variable's objectRelationships count
            final_count = session.run("""
                MATCH (v:Variable {id: $variable_id})
                SET v.objectRelationships = size([(o:Object)-[:HAS_SPECIFIC_VARIABLE]->(v) | o])
                RETURN v.objectRelationships as count
            """, variable_id=target_variable_id).single()
            
            return {
                "message": f"Successfully cloned {cloned_count} object relationship(s)",
                "cloned_count": cloned_count
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error cloning variable object relationships: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to clone variable object relationships: {str(e)}")

@router.post("/variables/bulk-clone-object-relationships/{source_variable_id}")
async def bulk_clone_variable_object_relationships(source_variable_id: str, target_variable_ids: List[str] = Body(...)):
    """
    Clone all object relationships from a source variable to multiple target variables.
    Only works if all target variables have no existing relationships.
    Creates HAS_SPECIFIC_VARIABLE relationships from objects to each target variable.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j.")
    
    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            # Check if source variable exists
            source_check = session.run("""
                MATCH (v:Variable {id: $variable_id})
                RETURN v.id as id, v.variable as variable_name
            """, variable_id=source_variable_id).single()
            
            if not source_check:
                raise HTTPException(status_code=404, detail=f"Source variable with ID {source_variable_id} not found")
            
            # Check if all target variables exist and have no relationships
            for target_id in target_variable_ids:
                target_check = session.run("""
                    MATCH (v:Variable {id: $variable_id})
                    RETURN v.id as id, v.variable as variable_name
                """, variable_id=target_id).single()
                
                if not target_check:
                    raise HTTPException(status_code=404, detail=f"Target variable with ID {target_id} not found")
                
                # Check if target variable already has relationships
                existing_rels_count = session.run("""
                    MATCH (o:Object)-[:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $variable_id})
                    RETURN count(o) as rel_count
                """, variable_id=target_id).single()
                
                has_variable_count = session.run("""
                    MATCH (o:Object)-[:HAS_VARIABLE]->(v:Variable {id: $variable_id})
                    RETURN count(DISTINCT o) as rel_count
                """, variable_id=target_id).single()
                
                total_existing = (existing_rels_count["rel_count"] if existing_rels_count else 0) + (has_variable_count["rel_count"] if has_variable_count else 0)
                
                if total_existing > 0:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Target variable {target_id} already has object relationships. Please delete existing relationships before cloning."
                    )
            
            # Get all objects that have relationships to source variable
            # Get HAS_SPECIFIC_VARIABLE relationships
            specific_relationships = session.run("""
                MATCH (o:Object)-[:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $source_id})
                RETURN DISTINCT o.id as object_id, o.being as being, o.avatar as avatar, o.object as object
            """, source_id=source_variable_id).data()
            
            # Get HAS_VARIABLE relationships
            has_variable_exists = session.run("""
                MATCH (o:Object)-[:HAS_VARIABLE]->(v:Variable {id: $source_id})
                RETURN count(DISTINCT o) as count
            """, source_id=source_variable_id).single()
            
            has_variable_relationship = (has_variable_exists["count"] if has_variable_exists else 0) > 0
            
            if not specific_relationships and not has_variable_relationship:
                return {
                    "message": "Source variable has no object relationships to clone",
                    "cloned_count": 0,
                    "targets_processed": len(target_variable_ids)
                }
            
            total_cloned = 0
            
            # Clone to each target variable
            for target_id in target_variable_ids:
                target_cloned = 0
                
                # Clone HAS_SPECIFIC_VARIABLE relationships
                for rel in specific_relationships:
                    object_id = rel["object_id"]
                    try:
                        result = session.run("""
                            MATCH (o:Object {id: $object_id})
                            MATCH (v:Variable {id: $target_id})
                            MERGE (o)-[r:HAS_SPECIFIC_VARIABLE]->(v)
                            ON CREATE SET r.createdBy = "clone"
                            RETURN r
                        """, object_id=object_id, target_id=target_id)
                        
                        if result.single():
                            target_cloned += 1
                    except Exception as e:
                        print(f"⚠️ Error cloning relationship for object {object_id} to variable {target_id}: {e}")
                
                # Clone HAS_VARIABLE relationship if it exists
                if has_variable_relationship:
                    all_objects = session.run("""
                        MATCH (o:Object)
                        RETURN o.id as object_id
                    """).data()
                    
                    for obj in all_objects:
                        object_id = obj["object_id"]
                        try:
                            result = session.run("""
                                MATCH (o:Object {id: $object_id})
                                MATCH (v:Variable {id: $target_id})
                                MERGE (o)-[r:HAS_VARIABLE]->(v)
                                ON CREATE SET r.createdBy = "clone"
                                RETURN r
                            """, object_id=object_id, target_id=target_id)
                            
                            if result.single():
                                target_cloned += 1
                        except Exception as e:
                            print(f"⚠️ Error cloning HAS_VARIABLE relationship for object {object_id} to variable {target_id}: {e}")
                
                # Update the target variable's objectRelationships count
                session.run("""
                    MATCH (v:Variable {id: $variable_id})
                    SET v.objectRelationships = size([(o:Object)-[:HAS_SPECIFIC_VARIABLE]->(v) | o])
                """, variable_id=target_id)
                
                total_cloned += target_cloned
            
            return {
                "message": f"Successfully cloned relationships to {len(target_variable_ids)} variable(s)",
                "cloned_count": total_cloned,
                "targets_processed": len(target_variable_ids)
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error bulk cloning variable object relationships: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to bulk clone variable object relationships: {str(e)}")

@router.get("/variables/{variable_id}/variations")
async def get_variable_variations(variable_id: str):
    """Get all variations for a variable"""
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        with driver.session() as session:
            # Check if variable exists
            var_check = session.run("""
                MATCH (v:Variable {id: $variable_id})
                RETURN v.id as id
            """, variable_id=variable_id).single()
            
            if not var_check:
                raise HTTPException(status_code=404, detail="Variable not found")

            # Get variations
            variations_result = session.run("""
                MATCH (v:Variable {id: $variable_id})-[:HAS_VARIATION]->(var:Variation)
                RETURN var.id as id, var.name as name
                ORDER BY var.name
            """, variable_id=variable_id)

            variations = []
            for var_record in variations_result:
                variations.append({
                    "id": var_record["id"],
                    "name": var_record["name"]
                })

            return {
                "variationsList": variations,
                "variations": len(variations)
            }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching variable variations: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch variable variations: {str(e)}")

@router.post("/variables/{variable_id}/variations/upload", response_model=CSVUploadResponse)
async def bulk_upload_variations(variable_id: str, file: UploadFile = File(...)):
    """Bulk upload variations for a variable from CSV file"""
    print(f"DEBUG: bulk_upload_variations called with variable_id={variable_id}, file={file.filename}")
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV file")

    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    try:
        # Read CSV content and parse it robustly
        content = await file.read()
        print(f"CSV content length: {len(content)}")
        
        # Decode content and handle BOM
        try:
            text_content = content.decode('utf-8-sig')
        except UnicodeDecodeError:
            text_content = content.decode('utf-8')
        
        # Parse CSV manually to handle unquoted fields with spaces
        text_content = text_content.replace('\r\n', '\n').replace('\r', '\n')
        
        lines = text_content.strip().split('\n')
        if not lines:
            raise HTTPException(status_code=400, detail="Empty CSV file")
        
        # Get headers from first line
        headers = [h.strip() for h in lines[0].split(',')]
        
        # Parse data rows
        rows = []
        for i, line in enumerate(lines[1:], start=2):
            if not line.strip():
                continue
            
            values = [v.strip() for v in line.split(',')]
            
            row = {}
            for j, header in enumerate(headers):
                row[header] = values[j] if j < len(values) else ""
            rows.append(row)
                    
        print(f"Successfully parsed {len(rows)} rows from CSV")
    except Exception as e:
        print(f"Error in CSV parsing: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"CSV parsing error: {str(e)}")
    
    created_variations = []
    errors = []
    skipped_count = 0
    
    try:
        with driver.session() as session:
            print(f"DEBUG: Starting session for variable {variable_id}")
            # Check if variable exists
            var_check = session.run("""
                MATCH (v:Variable {id: $variable_id})
                RETURN v.id as id
            """, variable_id=variable_id).single()
            
            if not var_check:
                raise HTTPException(status_code=404, detail="Variable not found")

            # Get existing variations for this variable to check for duplicates
            existing_variations_result = session.run("""
                MATCH (v:Variable {id: $variable_id})-[:HAS_VARIATION]->(var:Variation)
                RETURN var.name as name
            """, variable_id=variable_id)
            
            existing_variation_names = {record["name"].lower() for record in existing_variations_result}
            
            # Get all global variations to check for existing ones
            global_variations_result = session.run("""
                MATCH (var:Variation)
                RETURN var.name as name, var.id as id
            """)
            
            global_variations = {record["name"].lower(): {"id": record["id"], "original_name": record["name"]} for record in global_variations_result}
            print(f"DEBUG: Found {len(global_variations)} global variations")
            
            # Track variations within this CSV upload to detect duplicates within the file
            csv_variation_names = set()
            
            for row_num, row in enumerate(rows, start=2):
                # Get variation name from the row
                variation_name = row.get('Variation', '').strip()
                if not variation_name:
                    errors.append(f"Row {row_num}: Variation name is required")
                    continue
                
                # Check for duplicates within the CSV file itself (case-insensitive)
                if variation_name.lower() in csv_variation_names:
                    errors.append(f"Row {row_num}: Duplicate variation name '{variation_name}' found within the CSV file")
                    continue
                
                # Check for duplicates (case-insensitive) - only for this specific variable
                if variation_name.lower() in existing_variation_names:
                    skipped_count += 1
                    print(f"Skipping duplicate variation for this variable: {variation_name}")
                    continue
                
                # Add to CSV tracking set
                csv_variation_names.add(variation_name.lower())
                
                # Check if variation exists globally using our pre-loaded data (case-insensitive)
                if variation_name.lower() in global_variations:
                    # Variation exists globally, just connect it to this variable
                    print(f"Connecting existing global variation to variable: {variation_name}")
                    
                    variation_id = global_variations[variation_name.lower()]["id"]
                    
                    # Check if this variation is already connected to this variable
                    already_connected = session.run("""
                        MATCH (v:Variable {id: $variable_id})-[:HAS_VARIATION]->(var:Variation {id: $variation_id})
                        RETURN var.id as id
                    """, variable_id=variable_id, variation_id=variation_id).single()
                    
                    if not already_connected:
                        # Connect existing variation to variable (MERGE to avoid duplicate relationships)
                        session.run("""
                            MATCH (v:Variable {id: $variable_id})
                            MATCH (var:Variation {id: $variation_id})
                            MERGE (v)-[:HAS_VARIATION]->(var)
                        """, variable_id=variable_id, variation_id=variation_id)
                        
                        existing_variation_names.add(variation_name.lower())
                        
                        created_variations.append({
                            "id": variation_id,
                            "name": variation_name
                        })
                    else:
                        print(f"Variation {variation_name} already connected to this variable, skipping")
                        skipped_count += 1
                else:
                    # Create new variation
                    print(f"Creating new variation: {variation_name}")
                    variation_id = str(uuid.uuid4())
                    
                    try:
                        # Create variation node
                        session.run("""
                            CREATE (var:Variation {
                                id: $variation_id,
                                name: $variation_name
                            })
                        """, variation_id=variation_id, variation_name=variation_name)
                        
                        # Connect variation to variable
                        session.run("""
                            MATCH (v:Variable {id: $variable_id})
                            MATCH (var:Variation {id: $variation_id})
                            CREATE (v)-[:HAS_VARIATION]->(var)
                        """, variable_id=variable_id, variation_id=variation_id)
                        
                        existing_variation_names.add(variation_name.lower())
                        
                        created_variations.append({
                            "id": variation_id,
                            "name": variation_name
                        })
                    except Exception as create_error:
                        print(f"Error creating variation {variation_name}: {create_error}")
                        errors.append(f"Row {row_num}: Failed to create variation '{variation_name}': {str(create_error)}")
    
    except HTTPException:
        raise
    except Exception as session_error:
        print(f"DEBUG: Session error: {str(session_error)}")
        errors.append(f"Database session error: {str(session_error)}")

    return CSVUploadResponse(
        success=True,
        message=f"Successfully created {len(created_variations)} variations. Skipped {skipped_count} duplicates.",
        created_count=len(created_variations),
        error_count=len(errors),
        errors=errors
    )