from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Body, Request
from typing import List, Dict, Any, Optional
import uuid
import io
import json
import csv
from pydantic import BaseModel, Field
from neo4j import WRITE_ACCESS
from db import get_driver
from schema import VariableCreateRequest, VariableUpdateRequest, VariableResponse, CSVUploadResponse, CSVRowData, BulkVariableUpdateRequest, BulkVariableUpdateResponse, ObjectRelationshipCreateRequest, VariableFieldOptionRequest, VariableFieldOptionsResponse, VariableSectionRequest

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

router = APIRouter()

async def create_driver_relationships(session, variable_id: str, driver_string: str):
    """
    Create driver relationships for a variable based on the driver string.
    Driver string format: "Sector, Domain, Country, VariableClarifier" (or 3-part: "Sector, Domain, VariableClarifier")
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
        
        # Parse driver string
        parts = [part.strip() for part in driver_string.split(',')]
        
        # Handle both 3-part (old format: Sector, Domain, Clarifier) and 4-part (new format: Sector, Domain, Country, Clarifier)
        if len(parts) == 3:
            # Old format: Sector, Domain, Clarifier (missing Country)
            sector_str, domain_str, variable_clarifier = parts
            country_str = "ALL"  # Default to ALL if country is missing
            print(f"Parsed 3-part driver string (missing Country, defaulting to ALL): {driver_string}")
        elif len(parts) == 4:
            # New format: Sector, Domain, Country, Clarifier
            sector_str, domain_str, country_str, variable_clarifier = parts
            print(f"Parsed 4-part driver string: {driver_string}")
        else:
            print(f"Invalid driver string format (expected 3 or 4 parts, got {len(parts)}): {driver_string}")
            return
        
        # Handle Sector relationships
        if sector_str == "ALL":
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
            sectors = [s.strip() for s in sector_str.split(',')]
            for sector in sectors:
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
        if domain_str == "ALL":
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
            domains = [d.strip() for d in domain_str.split(',')]
            for domain in domains:
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
        if country_str == "ALL":
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
            countries = [c.strip() for c in country_str.split(',')]
            for country in countries:
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
        
        # Handle Variable Clarifier relationship (single select)
        # Skip if "None" or empty
        if variable_clarifier and variable_clarifier != "None" and variable_clarifier != "":
            result = session.run("""
                MERGE (vc:VariableClarifier {name: $clarifier})
                WITH vc
                MATCH (v:Variable {id: $variable_id})
                MERGE (vc)-[:IS_RELEVANT_TO]->(v)
                RETURN vc.name as clarifier
            """, clarifier=variable_clarifier, variable_id=variable_id)
            record = result.single()
            if record:
                print(f"Created IS_RELEVANT_TO relationship: VariableClarifier({record['clarifier']}) -> Variable({variable_id})")
            else:
                print(f"⚠️  Failed to create relationship for VariableClarifier({variable_clarifier}) -> Variable({variable_id})")
        else:
            print(f"Skipping VariableClarifier relationship (value: '{variable_clarifier}')")
            
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
            # Include sections from placeholder variables so newly added sections appear in dropdown
            result = session.run("""
                MATCH (p:Part {name: $part})-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v:Variable)
                WHERE v.section IS NOT NULL AND v.section <> ''
                RETURN DISTINCT v.section as section
                ORDER BY v.section
            """, part=part)
            
            sections = [record["section"] for record in result if record.get("section")]
            return {"sections": sections}
    except Exception as e:
        print(f"Error fetching sections for part {part}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch sections: {str(e)}")


@router.post("/variables/sections")
async def add_variable_section(section_data: VariableSectionRequest):
    """
    Add a new section value for a specific part.
    Creates a minimal placeholder Group and Variable (with __PLACEHOLDER_ names) so the
    section appears in the Section dropdown. Placeholder groups are filtered out of the
    Group dropdown; placeholder variables are filtered out of the main Variables grid.
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
            # Check if section already exists for this part
            existing_check = session.run("""
                MATCH (p:Part {name: $part})-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v:Variable)
                WHERE v.section = $section
                RETURN count(v) as count
            """, part=part, section=section)
            
            existing_count = existing_check.single()["count"]
            if existing_count > 0:
                return {"success": True, "message": f"Section '{section}' already exists for part '{part}'"}
            
            # Create a placeholder Group and Variable so this section appears in the Section dropdown.
            # Group name uses __PLACEHOLDER_ so it is filtered out of get_variable_groups (Group dropdown).
            # Variable name uses __PLACEHOLDER_ so it is filtered out of get_variables (main grid).
            # get_variable_sections includes these so the new section appears in the Section dropdown.
            placeholder_group = f"__PLACEHOLDER_{uuid.uuid4().hex[:8]}"
            placeholder_variable_id = str(uuid.uuid4())
            placeholder_variable_name = f"__PLACEHOLDER_SECTION_{section.strip()}"
            group_id = str(uuid.uuid4())
            
            # Ensure Part exists, create Group and Variable, link Part -> Group -> Variable
            session.run("""
                MERGE (p:Part {name: $part})
                CREATE (g:Group { id: $group_id, name: $group, part: $part })
                CREATE (v:Variable {
                    id: $variable_id,
                    name: $variable_name,
                    section: $section,
                    driver: "ALL, ALL, ALL, None",
                    formatI: "",
                    formatII: "",
                    gType: "",
                    validation: "",
                    default: "",
                    graph: "Yes",
                    status: "Placeholder"
                })
                MERGE (p)-[:HAS_GROUP]->(g)
                MERGE (g)-[:HAS_VARIABLE]->(v)
            """, part=part, group_id=group_id, group=placeholder_group, variable_id=placeholder_variable_id,
                variable_name=placeholder_variable_name, section=section)
            
            return {"success": True, "message": f"Section '{section}' added for part '{part}'"}
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding section {section} for part {part}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add section: {str(e)}")


@router.post("/variables/groups", response_model=Dict[str, Any])
async def create_variable_group(part: str = Body(...), group: str = Body(...)):
    """
    Create a new Group node and link it to a Part.
    This ensures that:
    1. If a group with the same name exists for a different part, create a NEW group node
    2. If a group with the same name exists for the same part, return an error
    3. The group is properly linked to the specified part only
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")
    
    if not part or not part.strip():
        raise HTTPException(status_code=400, detail="Part name is required")
    
    if not group or not group.strip():
        raise HTTPException(status_code=400, detail="Group name is required")
    
    part = part.strip()
    group = group.strip()
    
    try:
        with driver.session() as session:
            # Check if group with same name already exists for the same part
            existing_check = session.run("""
                MATCH (p:Part {name: $part})-[:HAS_GROUP]->(g:Group {name: $group})
                RETURN g.name as group_name
            """, part=part, group=group).single()
            
            if existing_check:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Group '{group}' already exists for Part '{part}'. Please use a different name."
                )
            
            # Check if group with same name exists for a different part
            different_part_check = session.run("""
                MATCH (p:Part)-[:HAS_GROUP]->(g:Group {name: $group})
                WHERE p.name <> $part
                RETURN p.name as part_name, g.name as group_name, g.id as group_id
                LIMIT 1
            """, part=part, group=group).single()
            
            # Ensure Part exists
            session.run("""
                MERGE (p:Part {name: $part})
            """, part=part)
            
            # Generate unique ID for the new group node
            group_id = str(uuid.uuid4())
            
            if different_part_check:
                # Group with same name exists for different part - create a NEW group node with unique ID
                print(f"Note: Group '{group}' exists for Part '{different_part_check['part_name']}', creating NEW group node with ID '{group_id}' for Part '{part}'")
                
                # Create a NEW Group node with unique ID and part property
                session.run("""
                    CREATE (g:Group {
                        id: $group_id,
                        name: $group,
                        part: $part
                    })
                """, group_id=group_id, group=group, part=part)
            else:
                # No existing group with this name for a different part
                # Check if one exists for the same part (should have been caught above, but double-check)
                same_part_check = session.run("""
                    MATCH (p:Part {name: $part})-[:HAS_GROUP]->(g:Group {name: $group})
                    RETURN g.id as group_id
                    LIMIT 1
                """, part=part, group=group).single()
                
                if same_part_check:
                    # This should not happen due to earlier check, but handle it
                    raise HTTPException(
                        status_code=400,
                        detail=f"Group '{group}' is already linked to Part '{part}'"
                    )
                
                # Create new Group node with unique ID
                # Check if there's an existing Group with this name but no ID (legacy data)
                existing_group_no_id = session.run("""
                    MATCH (g:Group {name: $group})
                    WHERE g.id IS NULL
                    RETURN g LIMIT 1
                """, group=group).single()
                
                if existing_group_no_id:
                    # There's a legacy group without an ID - create a new one
                    print(f"Note: Found legacy Group '{group}' without ID, creating new Group node with ID '{group_id}' for Part '{part}'")
                    session.run("""
                        CREATE (g:Group {
                            id: $group_id,
                            name: $group,
                            part: $part
                        })
                    """, group_id=group_id, group=group, part=part)
                else:
                    # No existing group at all - create new one
                    session.run("""
                        CREATE (g:Group {
                            id: $group_id,
                            name: $group,
                            part: $part
                        })
                    """, group_id=group_id, group=group, part=part)
            
            # Create the relationship from Part to Group
            session.run("""
                MATCH (p:Part {name: $part})
                MATCH (g:Group {id: $group_id})
                MERGE (p)-[:HAS_GROUP]->(g)
            """, part=part, group_id=group_id)
            
            return {
                "success": True,
                "message": f"Group '{group}' created and linked to Part '{part}'",
                "part": part,
                "group": group
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
    Get all distinct Group values that belong to the specified Part (via HAS_GROUP relationship).
    Groups are filtered only by Part, not by Section, since Part -> Group -> Variable relationships
    are independent of the Variable's section property.
    
    Used for cascading dropdown: Part -> Section -> Group -> Variable
    
    Args:
        part: The Part name to filter groups by (required)
        section: Optional - kept for backward compatibility but not used in filtering
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    if not part:
        raise HTTPException(status_code=400, detail="Part parameter is required")

    try:
        with driver.session() as session:
            # Get all groups for the part, regardless of section
            # Part -> HAS_GROUP -> Group relationship is independent of Variable section property
            # Filter out PLACEHOLDER groups
            result = session.run("""
                MATCH (p:Part {name: $part})-[:HAS_GROUP]->(g:Group)
                WHERE NOT g.name STARTS WITH '__PLACEHOLDER_'
                RETURN DISTINCT g.name as group
                ORDER BY g.name
            """, part=part)
            
            groups = [record["group"] for record in result if record.get("group")]
            return {"groups": groups}
    except Exception as e:
        print(f"Error fetching groups for part {part}: {e}")
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
                MATCH (p:Part {name: $part})-[:HAS_GROUP]->(g:Group {name: $group})-[:HAS_VARIABLE]->(v:Variable)
                WHERE v.section = $section
                AND NOT g.name STARTS WITH '__PLACEHOLDER_'
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
                MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v:Variable)
                WHERE NOT g.name STARTS WITH '__PLACEHOLDER_'
                AND NOT v.name STARTS WITH '__PLACEHOLDER_'
                OPTIONAL MATCH (o:Object)-[:HAS_SPECIFIC_VARIABLE]->(v)
                OPTIONAL MATCH (v)<-[:IS_RELEVANT_TO]-(s:Sector)
                OPTIONAL MATCH (v)<-[:IS_RELEVANT_TO]-(d:Domain)
                OPTIONAL MATCH (v)<-[:IS_RELEVANT_TO]-(c:Country)
                OPTIONAL MATCH (v)<-[:IS_RELEVANT_TO]-(vc:VariableClarifier)
                OPTIONAL MATCH (v)-[:HAS_VARIATION]->(var:Variation)
                WITH v, p, g, count(DISTINCT o) as objectRelationships,
                     count(DISTINCT var) as variations,
                     collect(DISTINCT s.name) as sectors,
                     collect(DISTINCT d.name) as domains,
                     collect(DISTINCT c.name) as countries,
                     collect(DISTINCT vc.name) as variableClarifiers
                RETURN v.id as id, v.name as variable, v.section as section,
                       v.formatI as formatI, v.formatII as formatII, v.gType as gType,
                       v.validation as validation, v.default as default, v.graph as graph,
                       v.status as status, COALESCE(v.is_meme, false) as is_meme,
                       COALESCE(v.is_group_key, false) as is_group_key,
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
                variable_clarifiers = record["variableClarifiers"] or []
                
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
                clarifier_str = variable_clarifiers[0] if variable_clarifiers else "None"
                
                driver_string = f"{sector_str}, {domain_str}, {country_str}, {clarifier_str}"
                
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
            # Generate unique ID
            variable_id = str(uuid.uuid4())
            
            # Create taxonomy structure: Part -> Group -> Variable
            # Check if group already has relationship from a different part before creating
            existing_part_check = session.run("""
                MATCH (p:Part)-[:HAS_GROUP]->(g:Group {name: $group})
                WHERE p.name <> $part
                RETURN p.name as part_name
                LIMIT 1
            """, part=variable_data.part, group=variable_data.group).single()
            
            if existing_part_check:
                # Group already exists for a different part - this is a data integrity issue
                existing_part = existing_part_check["part_name"]
                print(f"WARNING: Group '{variable_data.group}' already has relationship from Part '{existing_part}'")
                print(f"Attempting to create relationship from Part '{variable_data.part}' - this will create duplicate!")
                print(f"This should be fixed by ensuring unique group names per part or running a fix script")
            
            # Ensure Part exists
            session.run("MERGE (p:Part {name: $part})", part=variable_data.part)
            
            # Find or create Group for this specific Part
            # First, check if a Group with this name already exists for this Part
            existing_group = session.run("""
                MATCH (p:Part {name: $part})-[:HAS_GROUP]->(g:Group {name: $group})
                WHERE NOT g.name STARTS WITH '__PLACEHOLDER_'
                RETURN g.id as group_id
                LIMIT 1
            """, part=variable_data.part, group=variable_data.group).single()
            
            if existing_group:
                # Group already exists for this Part - use it
                group_id = existing_group["group_id"]
            else:
                # Check if group with same name exists for a different part
                different_part_group = session.run("""
                    MATCH (p:Part)-[:HAS_GROUP]->(g:Group {name: $group})
                    WHERE p.name <> $part
                    AND NOT g.name STARTS WITH '__PLACEHOLDER_'
                    RETURN g.id as group_id
                    LIMIT 1
                """, part=variable_data.part, group=variable_data.group).single()
                
                if different_part_group:
                    # Group exists for different part - create NEW group node with unique ID
                    group_id = str(uuid.uuid4())
                    print(f"Note: Group '{variable_data.group}' exists for different Part, creating NEW group node with ID '{group_id}' for Part '{variable_data.part}'")
                    session.run("""
                        CREATE (g:Group {
                            id: $group_id,
                            name: $group,
                            part: $part
                        })
                    """, group_id=group_id, group=variable_data.group, part=variable_data.part)
                    
                    # Create relationship from Part to new Group
                    session.run("""
                        MATCH (p:Part {name: $part})
                        MATCH (g:Group {id: $group_id})
                        MERGE (p)-[:HAS_GROUP]->(g)
                    """, part=variable_data.part, group_id=group_id)
                else:
                    # No existing group with this name - create new one
                    group_id = str(uuid.uuid4())
                    session.run("""
                        CREATE (g:Group {
                            id: $group_id,
                            name: $group,
                            part: $part
                        })
                    """, group_id=group_id, group=variable_data.group, part=variable_data.part)
                    
                    # Create relationship from Part to new Group
                    session.run("""
                        MATCH (p:Part {name: $part})
                        MATCH (g:Group {id: $group_id})
                        MERGE (p)-[:HAS_GROUP]->(g)
                    """, part=variable_data.part, group_id=group_id)
            
            # Create Variable and link to Group (use group_id if we have it, otherwise fallback to name)
            # Get the group_id we just created/found
            group_for_variable = session.run("""
                MATCH (p:Part {name: $part})-[:HAS_GROUP]->(g:Group {name: $group})
                RETURN g.id as group_id
                LIMIT 1
            """, part=variable_data.part, group=variable_data.group).single()
            
            if not group_for_variable:
                raise HTTPException(status_code=500, detail=f"Failed to find Group '{variable_data.group}' for Part '{variable_data.part}'")
            
            group_id_for_variable = group_for_variable["group_id"]
            
            # Create Variable and link to Group using group ID
            result = session.run("""
                MATCH (g:Group {id: $group_id})
                
                // Create Variable node with all properties (including driver string)
                CREATE (v:Variable {
                    id: $id,
                    name: $variable,
                    section: $section,
                    formatI: $formatI,
                    formatII: $formatII,
                    gType: $gType,
                    validation: $validation,
                    default: $default,
                    graph: $graph,
                    status: $status,
                    driver: $driver,
                    is_meme: $is_meme,
                    is_group_key: $is_group_key
                })
                
                // Create relationship Group -> Variable
                MERGE (g)-[:HAS_VARIABLE]->(v)
                
                // Return the variable data for response
                RETURN v.id as id, v.name as variable, v.section as section,
                       v.formatI as formatI, v.formatII as formatII, v.gType as gType,
                       v.validation as validation, v.default as default, v.graph as graph,
                       v.status as status, COALESCE(v.is_meme, false) as is_meme,
                       COALESCE(v.is_group_key, false) as is_group_key,
                       $part as part, $group as group
            """, {
                "id": variable_id,
                "group_id": group_id_for_variable,
                "part": variable_data.part,
                "group": variable_data.group,
                "variable": variable_data.variable,
                "section": variable_data.section,
                "formatI": variable_data.formatI,
                "formatII": variable_data.formatII,
                "gType": variable_data.gType,
                "validation": variable_data.validation or "",
                "default": variable_data.default or "",
                "graph": variable_data.graph or "Yes",
                "status": variable_data.status or "Active",
                "driver": variable_data.driver or "ALL, ALL, ALL, None",
                "is_meme": getattr(variable_data, 'isMeme', False) or False,
                "is_group_key": getattr(variable_data, 'isGroupKey', False) or False
            })

            record = result.single()
            if not record:
                raise HTTPException(status_code=500, detail="Failed to create variable")

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
                objectRelationships=0,
                objectRelationshipsList=[],
                variations=variations_count,
                variationsList=variations_list
            )

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
                    if should_update_field(bulk_data.section, "Keep current section"):
                        set_clauses.append("v.section = $section")
                        params["section"] = bulk_data.section
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

                    # Handle Part/Group relationship updates BEFORE updating node properties
                    # This is similar to the logic in update_variable
                    part_provided = should_update_field(bulk_data.part, "Keep Current Part")
                    group_provided = should_update_field(bulk_data.group, "Keep Current Group")
                    section_provided = should_update_field(bulk_data.section, "Keep current section")
                    
                    if part_provided or group_provided:
                        # Both Part and Group must be provided for bulk edit
                        if not (part_provided and group_provided):
                            errors.append(f"Variable {variable_id_str}: Both Part and Group must be provided when changing Part/Group in bulk edit")
                            continue
                        
                        print(f"DEBUG: Bulk edit - Processing Part/Group update for variable {variable_id_str}", flush=True)
                        
                        # Get current Part/Group from Neo4j
                        current_part_group_result = session.run("""
                            MATCH (v:Variable {id: $id})
                            OPTIONAL MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v)
                            RETURN p.name as part, g.name as group, v.section as section
                        """, {"id": variable_id_str})
                        
                        current_part_group_record = current_part_group_result.single()
                        current_part = current_part_group_record["part"] if current_part_group_record and current_part_group_record.get("part") else ""
                        current_group = current_part_group_record["group"] if current_part_group_record and current_part_group_record.get("group") else ""
                        current_section = current_part_group_record["section"] if current_part_group_record and current_part_group_record.get("section") else ""
                        
                        new_part = bulk_data.part.strip() if part_provided else current_part
                        new_group = bulk_data.group.strip() if group_provided else current_group
                        new_section = bulk_data.section.strip() if section_provided else current_section
                        
                        # Normalize for comparison
                        current_part_normalized = current_part.strip() if current_part else ""
                        current_group_normalized = current_group.strip() if current_group else ""
                        part_value_normalized = new_part.strip() if new_part else ""
                        group_value_normalized = new_group.strip() if new_group else ""
                        
                        part_changed = part_value_normalized != current_part_normalized
                        group_changed = group_value_normalized != current_group_normalized
                        
                        print(f"DEBUG: Bulk edit - Variable {variable_id_str}: current_part='{current_part}', current_group='{current_group}', current_section='{current_section}'", flush=True)
                        print(f"DEBUG: Bulk edit - Variable {variable_id_str}: new_part='{new_part}', new_group='{new_group}', new_section='{new_section}'", flush=True)
                        print(f"DEBUG: Bulk edit - Variable {variable_id_str}: part_changed={part_changed}, group_changed={group_changed}", flush=True)
                        
                        # Always update if both part and group are provided (even if they match current values)
                        # This ensures the relationship is properly set even if it was missing or incorrect
                        if part_provided and group_provided and new_part and new_group:
                            print(f"DEBUG: Bulk edit - Part/Group update for variable {variable_id_str}. Current: Part={current_part}, Group={current_group}. New: Part={new_part}, Group={new_group}", flush=True)
                            
                            # VALIDATION: Check if the group already belongs to a different part
                            # Groups must be exclusive to a single part - this prevents the bug where
                            # selecting a new part but keeping current group creates duplicate relationships
                            check_group_part_result = session.run("""
                                MATCH (g:Group {name: $group_name})
                                MATCH (p:Part)-[:HAS_GROUP]->(g)
                                RETURN collect(DISTINCT p.name) as existing_parts
                            """, group_name=new_group)
                            
                            check_record = check_group_part_result.single()
                            existing_parts = check_record["existing_parts"] if check_record else []
                            
                            # If group already belongs to parts, check if new_part is in the list
                            if existing_parts:
                                if new_part not in existing_parts:
                                    # Group belongs to a different part - this is an error
                                    error_msg = f"Variable {variable_id_str}: Group '{new_group}' already belongs to Part(s) {', '.join(existing_parts)}. Cannot assign it to Part '{new_part}'. Groups must be exclusive to a single part. Please select a different group that belongs to '{new_part}' or select 'Keep Current Group' only if keeping the current part."
                                    errors.append(error_msg)
                                    print(f"DEBUG: Bulk edit - ❌ VALIDATION ERROR: {error_msg}", flush=True)
                                    continue
                                # If new_part is already in existing_parts, the relationship already exists - proceed
                            # If existing_parts is empty, group doesn't belong to any part yet - proceed
                            
                            try:
                                # Execute all operations in a single transaction to ensure atomicity
                                # This query:
                                # 1. Ensures Variable exists (will fail if it doesn't)
                                # 2. Deletes ALL existing Group -> Variable relationships for this variable
                                # 3. Ensures Part node exists (MERGE - won't delete if exists)
                                # 4. Ensures Group node exists (MERGE - won't delete if exists)
                                # 5. Ensures Part -> Group relationship exists (MERGE - won't delete if exists)
                                # 6. Creates new Group -> Variable relationship
                                # 7. Updates section property if provided
                                
                                update_params = {
                                    "variable_id": variable_id_str,
                                    "new_part": new_part,
                                    "new_group": new_group
                                }
                                
                                # Build the query dynamically to include section update if needed
                                section_set_clause = ""
                                if section_provided and new_section:
                                    section_set_clause = "\n                                    SET v.section = $new_section"
                                    update_params["new_section"] = new_section
                                    # Also add to set_clauses for consistency
                                    if "v.section = $section" not in set_clauses:
                                        set_clauses.append("v.section = $section")
                                        params["section"] = new_section
                                
                                # Find or create Group for this specific Part
                                # First, check if a Group with this name already exists for this Part (exclude placeholder groups)
                                existing_group = session.run("""
                                    MATCH (p:Part {name: $new_part})-[:HAS_GROUP]->(g:Group {name: $new_group})
                                    WHERE NOT g.name STARTS WITH '__PLACEHOLDER_'
                                    RETURN g.id as group_id
                                    LIMIT 1
                                """, new_part=new_part, new_group=new_group).single()
                                
                                if existing_group:
                                    # Group already exists for this Part - use it
                                    group_id = existing_group["group_id"]
                                else:
                                    # Check if group with same name exists for a different part (exclude placeholder groups)
                                    different_part_group = session.run("""
                                        MATCH (p:Part)-[:HAS_GROUP]->(g:Group {name: $new_group})
                                        WHERE p.name <> $new_part
                                        AND NOT g.name STARTS WITH '__PLACEHOLDER_'
                                        RETURN g.id as group_id
                                        LIMIT 1
                                    """, new_part=new_part, new_group=new_group).single()
                                    
                                    if different_part_group:
                                        # Group exists for different part - create NEW group node with unique ID
                                        group_id = str(uuid.uuid4())
                                        session.run("""
                                            CREATE (g:Group {
                                                id: $group_id,
                                                name: $group,
                                                part: $part
                                            })
                                        """, group_id=group_id, group=new_group, part=new_part)
                                        
                                        # Create relationship from Part to new Group
                                        session.run("""
                                            MATCH (p:Part {name: $part})
                                            MATCH (g:Group {id: $group_id})
                                            MERGE (p)-[:HAS_GROUP]->(g)
                                        """, part=new_part, group_id=group_id)
                                    else:
                                        # No existing group with this name - create new one
                                        group_id = str(uuid.uuid4())
                                        session.run("""
                                            CREATE (g:Group {
                                                id: $group_id,
                                                name: $group,
                                                part: $part
                                            })
                                        """, group_id=group_id, group=new_group, part=new_part)
                                        
                                        # Create relationship from Part to new Group
                                        session.run("""
                                            MATCH (p:Part {name: $part})
                                            MATCH (g:Group {id: $group_id})
                                            MERGE (p)-[:HAS_GROUP]->(g)
                                        """, part=new_part, group_id=group_id)
                                
                                bulk_update_query = f"""
                                    // Ensure Variable exists (will fail if it doesn't)
                                    MATCH (v:Variable {{id: $variable_id}})
                                    
                                    // Delete ALL existing Group -> Variable relationships for this variable
                                    // This severs the old relationships without deleting any nodes
                                    OPTIONAL MATCH (old_g:Group)-[old_r:HAS_VARIABLE]->(v)
                                    DELETE old_r
                                    
                                    // WITH clause required after DELETE before MATCH (Neo4j syntax requirement)
                                    WITH v
                                    
                                    // Match Group by ID (ensures we use the correct Group node for this Part)
                                    MATCH (g:Group {{id: $group_id}})
                                    
                                    // Create new Group -> Variable relationship
                                    MERGE (g)-[:HAS_VARIABLE]->(v)
                                    {section_set_clause}
                                    
                                    // Return confirmation
                                    RETURN v.id as var_id, g.name as group_name, v.section as section
                                """
                                
                                update_params["group_id"] = group_id
                                
                                result = session.run(bulk_update_query, update_params)
                                record = result.single()
                                
                                if record:
                                    print(f"DEBUG: Bulk edit - ✅ Successfully updated Part/Group relationships for variable {variable_id_str}", flush=True)
                                    print(f"DEBUG: Bulk edit -   New Part: {record.get('part_name')}, New Group: {record.get('group_name')}, Section: {record.get('section')}", flush=True)
                                else:
                                    print(f"DEBUG: Bulk edit - ⚠️ WARNING - Query executed but no record returned for variable {variable_id_str}", flush=True)
                                    errors.append(f"Variable {variable_id_str}: Bulk update query executed but no confirmation returned")
                                    
                            except Exception as e:
                                print(f"DEBUG: Bulk edit - ❌ ERROR updating Part/Group relationships for variable {variable_id_str}: {e}", flush=True)
                                import traceback
                                traceback.print_exc()
                                errors.append(f"Variable {variable_id_str}: Failed to update Part/Group relationships: {str(e)}")
                                continue  # Skip to next variable

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
                MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v:Variable {id: $id})
                RETURN v, p.name as part, g.name as group
            """, {"id": variable_id})

            current_record = current_result.single()
            print(f"DEBUG: Query result - current_record is None: {current_record is None}")
            if not current_record:
                print(f"DEBUG: ERROR - Variable {variable_id} not found or has no Part/Group relationship!")
                raise HTTPException(status_code=404, detail="Variable not found")

            current_variable = current_record["v"]
            current_part = current_record["part"] if current_record["part"] else ""
            current_group = current_record["group"] if current_record["group"] else ""
            # Get driver from current variable node
            current_driver = current_variable.get("driver", "") if hasattr(current_variable, 'get') else getattr(current_variable, 'driver', "")
            # Get is_meme and is_group_key from node properties
            current_is_meme = current_variable.get("is_meme", False) if hasattr(current_variable, 'get') else getattr(current_variable, 'is_meme', False)
            current_is_group_key = current_variable.get("is_group_key", False) if hasattr(current_variable, 'get') else getattr(current_variable, 'is_group_key', False)
            
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
            if variable_data.section is not None:
                set_clauses.append("v.section = $section")
                params["section"] = variable_data.section
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
            
            # Handle isGroupKey with validation - only one per group
            # Check both camelCase and snake_case (similar to isMeme handling)
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
                print(f"DEBUG: 🔑 Processing is_group_key update: {is_group_key_value} for variable {variable_id}")
                
                # If setting to true, first uncheck all other variables in the same group
                if is_group_key_value:
                    # Get the current group for this variable
                    group_result = session.run("""
                        MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v:Variable {id: $id})
                        RETURN g.name as group_name
                    """, {"id": variable_id})
                    
                    group_record = group_result.single()
                    if group_record and group_record.get("group_name"):
                        group_name = group_record["group_name"]
                        print(f"DEBUG: 🔑 Found group '{group_name}' for variable {variable_id}")
                        
                        # Uncheck all other variables in the same group
                        uncheck_result = session.run("""
                            MATCH (p:Part)-[:HAS_GROUP]->(g:Group {name: $group_name})-[:HAS_VARIABLE]->(v:Variable)
                            WHERE v.id <> $variable_id AND v.is_group_key = true
                            SET v.is_group_key = false
                            RETURN count(v) as unchecked_count
                        """, {"group_name": group_name, "variable_id": variable_id})
                        
                        unchecked_record = uncheck_result.single()
                        if unchecked_record:
                            unchecked_count = unchecked_record["unchecked_count"]
                            if unchecked_count > 0:
                                print(f"DEBUG: 🔑 Unchecked {unchecked_count} other variables in group '{group_name}'")
                            else:
                                print(f"DEBUG: 🔑 No other variables in group '{group_name}' had is_group_key = true")
                    else:
                        print(f"DEBUG: 🔑 WARNING: Could not find group for variable {variable_id}, but will still set is_group_key")
                
                # Now set this variable's is_group_key
                set_clauses.append("v.is_group_key = $is_group_key")
                params["is_group_key"] = is_group_key_value
                print(f"DEBUG: 🔑 Added is_group_key = {is_group_key_value} to update query for variable {variable_id}")

            # Only update if there are fields to update
            if set_clauses:
                update_query = f"""
                    MATCH (v:Variable {{id: $id}})
                    SET {', '.join(set_clauses)}
                    RETURN v.id as id, v.name as variable, v.section as section,
                           v.formatI as formatI, v.formatII as formatII, v.gType as gType,
                           v.validation as validation, v.default as default, v.graph as graph,
                           v.status as status, COALESCE(v.driver, '') as driver,
                           COALESCE(v.is_meme, false) as is_meme,
                           COALESCE(v.is_group_key, false) as is_group_key
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
                    "section": current_variable.get("section", "") if hasattr(current_variable, 'get') else getattr(current_variable, 'section', ""),
                    "formatI": current_variable.get("formatI", "") if hasattr(current_variable, 'get') else getattr(current_variable, 'formatI', ""),
                    "formatII": current_variable.get("formatII", "") if hasattr(current_variable, 'get') else getattr(current_variable, 'formatII', ""),
                    "gType": current_variable.get("gType", "") if hasattr(current_variable, 'get') else getattr(current_variable, 'gType', ""),
                    "validation": current_variable.get("validation", "") if hasattr(current_variable, 'get') else getattr(current_variable, 'validation', ""),
                    "default": current_variable.get("default", "") if hasattr(current_variable, 'get') else getattr(current_variable, 'default', ""),
                    "graph": current_variable.get("graph", "") if hasattr(current_variable, 'get') else getattr(current_variable, 'graph', ""),
                    "status": current_variable.get("status", "") if hasattr(current_variable, 'get') else getattr(current_variable, 'status', ""),
                    "is_meme": current_is_meme,
                    "is_group_key": current_is_group_key
                }

            # Handle Part/Group changes - only update Group -> Variable relationship
            # NEVER touch Part -> Group relationships (they are managed elsewhere)
            import sys
            sys.stdout.flush()  # Force flush before Part/Group section
            print(f"DEBUG: ===== ENTERING Part/Group update section =====", flush=True)
            print(f"DEBUG: variable_data.part={variable_data.part}, variable_data.group={variable_data.group}", flush=True)
            
            new_part = variable_data.part if variable_data.part is not None else current_part
            new_group = variable_data.group if variable_data.group is not None else current_group
            new_part_normalized = (new_part or "").strip()
            new_group_normalized = (new_group or "").strip()
            
            print(f"DEBUG: After assignment - new_part='{new_part}', new_group='{new_group}'")
            
            # Check if part or group changed
            # Treat empty strings as "not provided" (same as None)
            part_provided = variable_data.part is not None and variable_data.part != ""
            group_provided = variable_data.group is not None and variable_data.group != ""
            
            # Normalize strings for comparison (strip whitespace, handle None)
            current_part_normalized = (current_part or "").strip()
            current_group_normalized = (current_group or "").strip()
            part_value_normalized = (variable_data.part or "").strip() if variable_data.part is not None else ""
            group_value_normalized = (variable_data.group or "").strip() if variable_data.group is not None else ""
            
            part_changed = part_provided and part_value_normalized != current_part_normalized
            group_changed = group_provided and group_value_normalized != current_group_normalized
            
            import sys
            sys.stdout.flush()
            print(f"DEBUG: Part/Group update check.", flush=True)
            print(f"DEBUG:   variable_data.part='{variable_data.part}' (normalized: '{part_value_normalized}')", flush=True)
            print(f"DEBUG:   variable_data.group='{variable_data.group}' (normalized: '{group_value_normalized}')", flush=True)
            print(f"DEBUG:   current_part='{current_part}' (normalized: '{current_part_normalized}')", flush=True)
            print(f"DEBUG:   current_group='{current_group}' (normalized: '{current_group_normalized}')", flush=True)
            print(f"DEBUG:   new_part='{new_part}'", flush=True)
            print(f"DEBUG:   new_group='{new_group}'", flush=True)
            print(f"DEBUG:   part_provided={part_provided}, group_provided={group_provided}", flush=True)
            print(f"DEBUG:   part_changed={part_changed} (comparison: '{part_value_normalized}' != '{current_part_normalized}')", flush=True)
            print(f"DEBUG:   group_changed={group_changed} (comparison: '{group_value_normalized}' != '{current_group_normalized}')", flush=True)
            
            if part_changed or group_changed:
                print(f"DEBUG: Part/Group changed. Old: Part={current_part}, Group={current_group}. New: Part={new_part}, Group={new_group}")
                
                # Delete ALL existing Group -> Variable relationships for this variable
                # (in case there are multiple or orphaned relationships)
                # First, count how many relationships exist
                try:
                    count_result = session.run("""
                        MATCH (g:Group)-[gv:HAS_VARIABLE]->(v:Variable {id: $variable_id})
                        RETURN count(gv) as count
                    """, variable_id=variable_id)
                    count_record = count_result.single()
                    count_before = count_record["count"] if count_record else 0
                    print(f"DEBUG: Found {count_before} existing Group -> Variable relationship(s) to delete", flush=True)
                except Exception as e:
                    print(f"DEBUG: Error counting relationships: {e}", flush=True)
                    count_before = 0
                
                # Now delete all of them
                try:
                    session.run("""
                        MATCH (g:Group)-[gv:HAS_VARIABLE]->(v:Variable {id: $variable_id})
                        DELETE gv
                    """, variable_id=variable_id)
                    print(f"DEBUG: Deleted Group -> Variable relationship(s) for variable {variable_id} (counted {count_before} before deletion)", flush=True)
                except Exception as e:
                    print(f"DEBUG: Error deleting relationships: {e}", flush=True)
                    import traceback
                    traceback.print_exc()
                    # Continue anyway - the deletion might have partially succeeded
                
                # Ensure Part node exists (if new part is provided)
                if new_part:
                    session.run("""
                        MERGE (p:Part {name: $part})
                    """, part=new_part)
                
                # Find or create Group for this specific Part
                if new_part and new_group:
                    # First, check if a Group with this name already exists for this Part
                    existing_group = session.run("""
                        MATCH (p:Part {name: $part})-[:HAS_GROUP]->(g:Group {name: $group})
                        WHERE NOT g.name STARTS WITH '__PLACEHOLDER_'
                        RETURN g.id as group_id
                        LIMIT 1
                    """, part=new_part, group=new_group).single()
                    
                    if existing_group:
                        # Group already exists for this Part - use it
                        group_id = existing_group["group_id"]
                    else:
                        # Check if group with same name exists for a different part
                        different_part_group = session.run("""
                            MATCH (p:Part)-[:HAS_GROUP]->(g:Group {name: $group})
                            WHERE p.name <> $part
                            AND NOT g.name STARTS WITH '__PLACEHOLDER_'
                            RETURN g.id as group_id
                            LIMIT 1
                        """, part=new_part, group=new_group).single()
                        
                        if different_part_group:
                            # Group exists for different part - create NEW group node with unique ID
                            group_id = str(uuid.uuid4())
                            print(f"Note: Group '{new_group}' exists for different Part, creating NEW group node with ID '{group_id}' for Part '{new_part}'")
                            session.run("""
                                CREATE (g:Group {
                                    id: $group_id,
                                    name: $group,
                                    part: $part
                                })
                            """, group_id=group_id, group=new_group, part=new_part)
                            
                            # Create relationship from Part to new Group
                            session.run("""
                                MATCH (p:Part {name: $part})
                                MATCH (g:Group {id: $group_id})
                                MERGE (p)-[:HAS_GROUP]->(g)
                            """, part=new_part, group_id=group_id)
                        else:
                            # No existing group with this name - create new one
                            group_id = str(uuid.uuid4())
                            session.run("""
                                CREATE (g:Group {
                                    id: $group_id,
                                    name: $group,
                                    part: $part
                                })
                            """, group_id=group_id, group=new_group, part=new_part)
                            
                            # Create relationship from Part to new Group
                            session.run("""
                                MATCH (p:Part {name: $part})
                                MATCH (g:Group {id: $group_id})
                                MERGE (p)-[:HAS_GROUP]->(g)
                            """, part=new_part, group_id=group_id)
                    
                    # Create new Group -> Variable relationship using group ID
                    try:
                        create_result = session.run("""
                            MATCH (g:Group {id: $group_id})
                            MATCH (v:Variable {id: $variable_id})
                            MERGE (g)-[r:HAS_VARIABLE]->(v)
                            RETURN r, g.name as group_name, v.id as var_id
                        """, group_id=group_id, variable_id=variable_id)
                        create_record = create_result.single()
                        if create_record and create_record.get("group_name"):
                            print(f"DEBUG: Created Group -> Variable relationship: {create_record['group_name']} -> Variable {create_record['var_id']}", flush=True)
                        else:
                            print(f"DEBUG: WARNING - Failed to create Group -> Variable relationship for group={new_group}, variable_id={variable_id}", flush=True)
                    except Exception as e:
                        print(f"DEBUG: ERROR creating Group -> Variable relationship: {e}", flush=True)
                        import traceback
                        traceback.print_exc()
                        raise  # Re-raise to see the full error
                elif new_group and not new_part:
                    print(f"DEBUG: WARNING - new_group provided but new_part is empty, cannot create relationship", flush=True)
                
                print(f"DEBUG: Successfully updated Group -> Variable relationship for variable {variable_id}", flush=True)

            # Update driver relationships ONLY if driver field is provided AND it actually changed
            if variable_data.driver is not None:
                # Get current driver from the variable node
                current_driver_result = session.run("""
                    MATCH (v:Variable {id: $id})
                    RETURN v.driver as driver
                """, {"id": variable_id})
                current_driver_record = current_driver_result.single()
                current_driver = current_driver_record["driver"] if current_driver_record and current_driver_record["driver"] else ""
                new_driver = variable_data.driver.strip() if variable_data.driver else ""
                
                # Only update driver relationships if the driver actually changed
                if new_driver != current_driver:
                    print(f"DEBUG: Driver changed from '{current_driver}' to '{new_driver}', updating relationships")
                    await create_driver_relationships(session, variable_id, variable_data.driver)
                else:
                    print(f"DEBUG: Driver unchanged ('{current_driver}'), skipping driver relationship update")

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

            # Query Neo4j again to get the actual current part/group after relationship updates
            # This ensures we return the correct values that are actually in the database
            # Use OPTIONAL MATCH in case the relationship doesn't exist yet
            updated_result = session.run("""
                MATCH (v:Variable {id: $id})
                OPTIONAL MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v)
                RETURN p.name as part, g.name as group, v.section as section
            """, {"id": variable_id})

            updated_record = updated_result.single()
            if updated_record:
                # Use the actual values from Neo4j after relationship update
                final_part = updated_record.get("part") or (new_part if new_part else current_part)
                final_group = updated_record.get("group") or (new_group if new_group else current_group)
                final_section = updated_record.get("section") or record.get("section") or ""
                print(f"DEBUG: Retrieved updated part/group/section from Neo4j: Part={final_part}, Group={final_group}, Section={final_section}", flush=True)
            else:
                # Fallback to computed values if query fails or relationship doesn't exist
                final_part = new_part if new_part else current_part
                final_group = new_group if new_group else current_group
                final_section = record.get("section") or ""
                print(f"DEBUG: Using computed part/group (relationship query returned None or missing values): Part={final_part}, Group={final_group}, Section={final_section}", flush=True)
            
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
                objectRelationships=relationships_count,
                objectRelationshipsList=[],
                variations=variations_count,
                variationsList=variations_list
            )

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
        
        # Parse data rows using csv module to properly handle quoted fields with commas
        rows = []
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
                errors.append(f"Row {i}: CSV parsing error - {str(e)}")
                continue
                    
        print(f"Successfully parsed {len(rows)} rows from CSV")
    except Exception as e:
        print(f"Error in CSV parsing: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"CSV parsing error: {str(e)}")
    
    variables = []
    errors = []
    
    print(f"CSV Headers found: {headers}")
    print(f"First few rows sample: {rows[:3] if len(rows) >= 3 else rows}")
    
    for row_num, row in enumerate(rows, start=2):  # Start at 2 because of header
        try:
            # Validate required fields
            required_fields = ['Sector', 'Domain', 'Country', 'Variable Clarifier', 'Part', 'Section', 'Group', 'Variable']
            missing_fields = [field for field in required_fields if not row.get(field, '').strip()]
            
            if missing_fields:
                error_msg = f"Row {row_num}: Missing required fields: {', '.join(missing_fields)}"
                print(f"❌ {error_msg}")
                print(f"   Row data: {row}")
                errors.append(error_msg)
                continue

            # Parse driver selections
            sector = ['ALL'] if row['Sector'].strip() == 'ALL' else [s.strip() for s in row['Sector'].split(',')]
            domain = ['ALL'] if row['Domain'].strip() == 'ALL' else [d.strip() for d in row['Domain'].split(',')]
            country = ['ALL'] if row['Country'].strip() == 'ALL' else [c.strip() for c in row['Country'].split(',')]
            variable_clarifier = row['Variable Clarifier'].strip() if row['Variable Clarifier'].strip() else 'None'
            
            # Create driver string
            sector_str = 'ALL' if 'ALL' in sector else ', '.join(sector)
            domain_str = 'ALL' if 'ALL' in domain else ', '.join(domain)
            country_str = 'ALL' if 'ALL' in country else ', '.join(country)
            driver_string = f"{sector_str}, {domain_str}, {country_str}, {variable_clarifier}"

            # Create variable data with proper handling of optional fields
            variable_data = {
                "id": str(uuid.uuid4()),
                "driver": driver_string,
                "part": row['Part'].strip(),
                "section": row['Section'].strip(),
                "group": row['Group'].strip(),
                "variable": row['Variable'].strip(),
                "formatI": row.get('Format I', '').strip() or '',
                "formatII": row.get('Format II', '').strip() or '',
                "gType": row.get('G-Type', '').strip() or '',
                "validation": row.get('Validation', '').strip() or '',
                "default": row.get('Default', '').strip() or '',
                "graph": row.get('Graph', 'Yes').strip() or 'Yes',
                "status": "Active"
            }
            
            variables.append(variable_data)
            
        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")
            continue

    # Insert variables into database in batches
    # Batch size: 250 rows per transaction (safe for Neo4j, prevents memory issues)
    BATCH_SIZE = 250
    created_count = 0
    
    # Process variables in batches
    total_batches = (len(variables) + BATCH_SIZE - 1) // BATCH_SIZE
    print(f"Processing {len(variables)} variables in {total_batches} batches of {BATCH_SIZE}")
    
    with driver.session(default_access_mode=WRITE_ACCESS) as session:
        for batch_idx in range(0, len(variables), BATCH_SIZE):
            batch = variables[batch_idx:batch_idx + BATCH_SIZE]
            batch_num = (batch_idx // BATCH_SIZE) + 1
            print(f"Processing batch {batch_num}/{total_batches} ({len(batch)} variables)")
            
            # Use a single transaction for each batch
            def process_batch_tx(tx):
                batch_created = []
                batch_errors = []
                
                for var_data in batch:
                    try:
                        # Create taxonomy structure: Part -> Group -> Variable
                        # Ensure Part exists
                        tx.run("MERGE (p:Part {name: $part})", part=var_data["part"])
                        
                        # Find or create Group for this specific Part
                        # First, check if a Group with this name already exists for this Part
                        existing_group = tx.run("""
                            MATCH (p:Part {name: $part})-[:HAS_GROUP]->(g:Group {name: $group})
                            RETURN g.id as group_id
                            LIMIT 1
                        """, part=var_data["part"], group=var_data["group"]).single()
                        
                        if existing_group:
                            # Group already exists for this Part - use it
                            group_id = existing_group["group_id"]
                        else:
                            # Check if group with same name exists for a different part
                            different_part_group = tx.run("""
                                MATCH (p:Part)-[:HAS_GROUP]->(g:Group {name: $group})
                                WHERE p.name <> $part
                                RETURN g.id as group_id
                                LIMIT 1
                            """, part=var_data["part"], group=var_data["group"]).single()
                            
                            if different_part_group:
                                # Group exists for different part - create NEW group node with unique ID
                                group_id = str(uuid.uuid4())
                                tx.run("""
                                    CREATE (g:Group {
                                        id: $group_id,
                                        name: $group,
                                        part: $part
                                    })
                                """, group_id=group_id, group=var_data["group"], part=var_data["part"])
                                
                                # Create relationship from Part to new Group
                                tx.run("""
                                    MATCH (p:Part {name: $part})
                                    MATCH (g:Group {id: $group_id})
                                    MERGE (p)-[:HAS_GROUP]->(g)
                                """, part=var_data["part"], group_id=group_id)
                            else:
                                # No existing group with this name - create new one
                                group_id = str(uuid.uuid4())
                                tx.run("""
                                    CREATE (g:Group {
                                        id: $group_id,
                                        name: $group,
                                        part: $part
                                    })
                                """, group_id=group_id, group=var_data["group"], part=var_data["part"])
                                
                                # Create relationship from Part to new Group
                                tx.run("""
                                    MATCH (p:Part {name: $part})
                                    MATCH (g:Group {id: $group_id})
                                    MERGE (p)-[:HAS_GROUP]->(g)
                                """, part=var_data["part"], group_id=group_id)
                        
                        # Create Variable and link to Group using group ID
                        result = tx.run("""
                            MATCH (g:Group {id: $group_id})
                            
                            // Create Variable node with all properties (including driver string)
                            CREATE (v:Variable {
                                id: $id,
                                name: $variable,
                                section: $section,
                                formatI: $formatI,
                                formatII: $formatII,
                                gType: $gType,
                                validation: $validation,
                                default: $default,
                                graph: $graph,
                                status: $status,
                                driver: $driver
                            })
                            
                            // Create relationship Group -> Variable
                            MERGE (g)-[:HAS_VARIABLE]->(v)
                            
                            // Return variable ID to verify creation
                            RETURN v.id as id
                        """, {
                            **var_data,
                            "group_id": group_id
                        })
                        
                        # Verify variable was created
                        record = result.single()
                        if record and record["id"]:
                            batch_created.append(var_data)
                        else:
                            batch_errors.append(f"Variable {var_data['variable']} creation returned no result")
                    except Exception as e:
                        batch_errors.append(f"Failed to create variable {var_data['variable']}: {str(e)}")
                
                return {"created": batch_created, "errors": batch_errors}
            
            try:
                # Execute batch transaction (using execute_write for Neo4j driver 5.0+)
                batch_result = session.execute_write(process_batch_tx)
                created_vars = batch_result["created"]
                created_count += len(created_vars)
                errors.extend(batch_result["errors"])
                
                # Create driver relationships only for successfully created variables
                # Process in smaller sub-batches to avoid overwhelming Neo4j
                driver_batch_size = 50
                for driver_batch_idx in range(0, len(created_vars), driver_batch_size):
                    driver_batch = created_vars[driver_batch_idx:driver_batch_idx + driver_batch_size]
                    
                    for var_data in driver_batch:
                        try:
                            await create_driver_relationships(session, var_data['id'], var_data['driver'])
                        except Exception as e:
                            # If driver relationships fail, still count as created but log error
                            errors.append(f"Variable {var_data['variable']} created but driver relationships failed: {str(e)}")
                            print(f"⚠️ Driver relationships failed for variable {var_data['variable']}: {str(e)}")
                
                print(f"✅ Batch {batch_num}/{total_batches} completed: {len(created_vars)} variables created")
            except Exception as e:
                # If entire batch fails, add all variables to errors
                print(f"❌ Batch {batch_num}/{total_batches} failed: {str(e)}")
                for var_data in batch:
                    errors.append(f"Batch {batch_num} failed for variable {var_data['variable']}: {str(e)}")
                continue

    return CSVUploadResponse(
        success=True,
        message=f"Successfully created {created_count} variables",
        created_count=created_count,
        error_count=len(errors),
        errors=errors
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
                RETURN vfo[$field_name] AS current_values
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

            # Add new value if not already present
            new_value = option_data.value.strip()
            if new_value not in current_values:
                current_values.append(new_value)
                current_values.sort()  # Keep sorted

                # Update the node - create it if it doesn't exist
                session.run("""
                    MERGE (vfo:VariableFieldOptions {id: 'variable_field_options'})
                    ON CREATE SET vfo.formatI = $default_array, vfo.formatII = $default_array, 
                                 vfo.gType = $default_array, vfo.validation = $default_array, 
                                 vfo.default = $default_array
                    SET vfo[$field_name] = $values
                """, {
                    "field_name": option_data.field_name,
                    "values": current_values,
                    "default_array": []
                })

                return {
                    "success": True,
                    "field_name": option_data.field_name,
                    "value": new_value,
                    "message": f"Successfully added '{new_value}' to {option_data.field_name} options"
                }
            else:
                return {
                    "success": True,
                    "field_name": option_data.field_name,
                    "value": new_value,
                    "message": f"'{new_value}' already exists in {option_data.field_name} options"
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
                       vfo.validation AS validation, vfo.default AS default
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