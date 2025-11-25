from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Body
from typing import List, Dict, Any, Optional
import uuid
import io
import json
import csv
from pydantic import BaseModel, Field
from neo4j import WRITE_ACCESS
from db import get_driver
from schema import VariableCreateRequest, VariableUpdateRequest, VariableResponse, CSVUploadResponse, CSVRowData, BulkVariableUpdateRequest, BulkVariableUpdateResponse, ObjectRelationshipCreateRequest, VariableFieldOptionRequest, VariableFieldOptionsResponse

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
            # Get all variables with their taxonomy and relationships
            result = session.run("""
                MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v:Variable)
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
                       v.status as status, p.name as part, g.name as group,
                       objectRelationships, variations, sectors, domains, countries, variableClarifiers
                ORDER BY v.id
            """)

            variables = []
            for record in result:
                # Get driver data from the query results
                sectors = record["sectors"] or []
                domains = record["domains"] or []
                countries = record["countries"] or []
                variable_clarifiers = record["variableClarifiers"] or []
                
                # Create driver string in the expected format: "Sector, Domain, Country, VariableClarifier"
                sector_str = "ALL" if "ALL" in sectors else (", ".join(sectors) if sectors else "ALL")
                domain_str = "ALL" if "ALL" in domains else (", ".join(domains) if domains else "ALL")
                country_str = "ALL" if "ALL" in countries else (", ".join(countries) if countries else "ALL")
                clarifier_str = variable_clarifiers[0] if variable_clarifiers else "None"
                
                driver_string = f"{sector_str}, {domain_str}, {country_str}, {clarifier_str}"
                
                var = {
                    "id": record["id"],
                    "driver": driver_string,
                    "sector": sector_str,
                    "domain": domain_str,
                    "country": country_str,
                    "part": record["part"],
                    "group": record["group"],
                    "section": record["section"],
                    "variable": record["variable"],
                    "formatI": record["formatI"],
                    "formatII": record["formatII"],
                    "gType": record["gType"],
                    "validation": record["validation"] or "",
                    "default": record["default"] or "",
                    "graph": record["graph"] or "Yes",
                    "status": record["status"] or "Active",
                    "objectRelationships": record["objectRelationships"],
                    "objectRelationshipsList": [],
                    "variations": record["variations"] or 0
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
            result = session.run("""
                // MERGE Part node (avoid duplicates)
                MERGE (p:Part {name: $part})
                
                // MERGE Group node (avoid duplicates)
                MERGE (g:Group {name: $group})
                
                // Create relationship Part -> Group
                MERGE (p)-[:HAS_GROUP]->(g)
                
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
                
                // Return the variable data for response
                RETURN v.id as id, v.name as variable, v.section as section,
                       v.formatI as formatI, v.formatII as formatII, v.gType as gType,
                       v.validation as validation, v.default as default, v.graph as graph,
                       v.status as status, $part as part, $group as group
            """, {
                "id": variable_id,
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
                "driver": variable_data.driver or "ALL, ALL, ALL, None"
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
                objectRelationships=0,
                objectRelationshipsList=[],
                variations=variations_count,
                variationsList=variations_list
            )

    except Exception as e:
        print(f"Error creating variable: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create variable: {str(e)}")

@router.put("/variables/bulk-update", response_model=BulkVariableUpdateResponse)
async def bulk_update_variables(bulk_data: BulkVariableUpdateRequest):
    """
    Bulk update multiple variables with the same changes.
    Only updates fields that are provided (not None) and not "Keep Current" values.
    Applies validation rules: overwrites only where new value chosen, leaves Keep Current fields untouched.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    updated_count = 0
    errors = []

    try:
        with driver.session() as session:
            for variable_id in bulk_data.variable_ids:
                try:
                    print(f"Processing variable ID: {variable_id}")
                    # Get current variable data - first check if variable exists
                    print(f"Running query for variable {variable_id}")
                    current_result = session.run("""
                        MATCH (v:Variable {id: $id})
                        RETURN v
                    """, {"id": variable_id})

                    print(f"Query executed, getting single record")
                    current_record = current_result.single()
                    print(f"Record result: {current_record}")
                    if not current_record:
                        print(f"Variable {variable_id} not found in database")
                        errors.append(f"Variable {variable_id} not found")
                        continue
                    
                    print(f"Variable {variable_id} found, proceeding with update")

                    current_variable = current_record["v"]

                    # Build dynamic SET clause for only provided fields that are not "Keep Current"
                    set_clauses = []
                    params = {"id": variable_id}
                    
                    # Helper function to check if a field should be updated
                    def should_update_field(value: Optional[str], keep_current_text: str = "Keep Current") -> bool:
                        if value is None:
                            return False
                        stripped = value.strip()
                        return stripped != "" and stripped != keep_current_text and not stripped.startswith("Keep Current") and not stripped.startswith("Keep current")
                    
                    # Only update fields that are provided, not empty, and not "Keep Current" values
                    if should_update_field(bulk_data.variable, "Keep current variable"):
                        set_clauses.append("v.name = $variable")
                        params["variable"] = bulk_data.variable
                    if should_update_field(bulk_data.part, "Keep Current Part"):
                        set_clauses.append("v.part = $part")
                        params["part"] = bulk_data.part
                    if should_update_field(bulk_data.section, "Keep current section"):
                        set_clauses.append("v.section = $section")
                        params["section"] = bulk_data.section
                    if should_update_field(bulk_data.group, "Keep Current Group"):
                        set_clauses.append("v.group = $group")
                        params["group"] = bulk_data.group
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
                        set_clauses.append("v.validation = $validation")
                        params["validation"] = bulk_data.validation
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

                    # Only update if there are fields to update
                    if set_clauses:
                        update_query = f"""
                            MATCH (v:Variable {{id: $id}})
                            SET {', '.join(set_clauses)}
                        """
                        session.run(update_query, params)

                    # Update driver relationships if driver field is provided, not empty, and not "Keep Current"
                    if bulk_data.driver is not None and bulk_data.driver.strip() != "" and bulk_data.driver.strip() != "Keep Current":
                        print(f"Updating driver relationships with: {bulk_data.driver}")
                        await create_driver_relationships(session, variable_id, bulk_data.driver)

                    # Handle object relationships if provided
                    if bulk_data.objectRelationshipsList is not None and len(bulk_data.objectRelationshipsList) > 0:
                        # If shouldOverrideRelationships is true, delete all existing relationships first
                        if bulk_data.shouldOverrideRelationships:
                            print(f"🗑️ Deleting all existing relationships for variable {variable_id} (override mode)")
                            try:
                                # Delete all HAS_SPECIFIC_VARIABLE relationships
                                delete_specific = session.run("""
                                    MATCH (o:Object)-[r:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $variable_id})
                                    DELETE r
                                    RETURN count(r) as deleted_count
                                """, {"variable_id": variable_id})
                                specific_count = delete_specific.single()["deleted_count"] if delete_specific.single() else 0
                                
                                # Delete all HAS_VARIABLE relationships
                                delete_all = session.run("""
                                    MATCH (o:Object)-[r:HAS_VARIABLE]->(v:Variable {id: $variable_id})
                                    DELETE r
                                    RETURN count(r) as deleted_count
                                """, {"variable_id": variable_id})
                                all_count = delete_all.single()["deleted_count"] if delete_all.single() else 0
                                
                                print(f"✅ Deleted {specific_count} HAS_SPECIFIC_VARIABLE and {all_count} HAS_VARIABLE relationships")
                            except Exception as e:
                                print(f"⚠️ Error deleting existing relationships for variable {variable_id}: {str(e)}")
                                errors.append(f"Failed to delete existing relationships for variable {variable_id}: {str(e)}")
                        
                        print(f"Processing {len(bulk_data.objectRelationshipsList)} object relationships")
                        for relationship in bulk_data.objectRelationshipsList:
                            try:
                                # Create object relationship for this variable
                                await create_object_relationship_for_variable(session, variable_id, relationship)
                            except Exception as e:
                                print(f"Error creating object relationship for variable {variable_id}: {str(e)}")
                                errors.append(f"Failed to create object relationship for variable {variable_id}: {str(e)}")

                    # Handle variationsList if provided (append variations to each variable)
                    if bulk_data.variationsList is not None and len(bulk_data.variationsList) > 0:
                        print(f"Processing {len(bulk_data.variationsList)} variations for variable {variable_id}")
                        for var in bulk_data.variationsList:
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

                    updated_count += 1

                except Exception as e:
                    print(f"Error updating variable {variable_id}: {str(e)}")
                    errors.append(f"Failed to update variable {variable_id}: {str(e)}")
                    continue

        return BulkVariableUpdateResponse(
            success=updated_count > 0,
            message=f"Updated {updated_count} variables successfully",
            updated_count=updated_count,
            error_count=len(errors),
            errors=errors
        )

    except Exception as e:
        print(f"Error in bulk update: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to bulk update variables: {str(e)}")

@router.put("/variables/{variable_id}", response_model=VariableResponse)
async def update_variable(variable_id: str, variable_data: VariableUpdateRequest):
    """
    Update an existing variable in the CDM with proper taxonomy structure.
    Supports partial updates - only updates fields that are provided.
    Also handles variationsList for variations management.
    """
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
            if not current_record:
                raise HTTPException(status_code=404, detail="Variable not found")

            current_variable = current_record["v"]
            current_part = current_record["part"]
            current_group = current_record["group"]

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
            if variable_data.validation is not None:
                set_clauses.append("v.validation = $validation")
                params["validation"] = variable_data.validation
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

            # Only update if there are fields to update
            if set_clauses:
                update_query = f"""
                    MATCH (v:Variable {{id: $id}})
                    SET {', '.join(set_clauses)}
                    RETURN v.id as id, v.name as variable, v.section as section,
                           v.formatI as formatI, v.formatII as formatII, v.gType as gType,
                           v.validation as validation, v.default as default, v.graph as graph,
                           v.status as status
                """
                
                result = session.run(update_query, params)
                record = result.single()
            else:
                # No fields to update, use current data
                record = {
                    "id": current_variable["id"],
                    "variable": current_variable["name"],
                    "section": current_variable["section"],
                    "formatI": current_variable["formatI"],
                    "formatII": current_variable["formatII"],
                    "gType": current_variable["gType"],
                    "validation": current_variable["validation"],
                    "default": current_variable["default"],
                    "graph": current_variable["graph"],
                    "status": current_variable["status"]
                }

            # Update driver relationships if driver field is provided
            if variable_data.driver is not None:
                await create_driver_relationships(session, variable_id, variable_data.driver)

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

            # Use provided values or fall back to current values
            final_part = variable_data.part if variable_data.part is not None else current_part
            final_group = variable_data.group if variable_data.group is not None else current_group
            final_driver = variable_data.driver if variable_data.driver is not None else ""

            return VariableResponse(
                id=record["id"],
                driver=final_driver,
                part=final_part,
                group=final_group,
                section=record["section"],
                variable=record["variable"],
                formatI=record["formatI"],
                formatII=record["formatII"],
                gType=record["gType"],
                validation=record["validation"],
                default=record["default"],
                graph=record["graph"],
                status=record["status"],
                objectRelationships=relationships_count,
                objectRelationshipsList=[],
                variations=variations_count,
                variationsList=variations_list
            )

    except Exception as e:
        print(f"Error updating variable: {e}")
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
                        result = tx.run("""
                            // MERGE Part node (avoid duplicates)
                            MERGE (p:Part {name: $part})
                            
                            // MERGE Group node (avoid duplicates)
                            MERGE (g:Group {name: $group})
                            
                            // Create relationship Part -> Group
                            MERGE (p)-[:HAS_GROUP]->(g)
                            
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
                        """, var_data)
                        
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

@router.put("/variables/bulk-update", response_model=BulkVariableUpdateResponse)
async def bulk_update_variables(bulk_data: BulkVariableUpdateRequest):
    """
    Bulk update multiple variables with the same changes.
    Only updates fields that are provided (not None) and not "Keep Current" values.
    Applies validation rules: overwrites only where new value chosen, leaves Keep Current fields untouched.
    """
    driver = get_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Failed to connect to Neo4j database")

    updated_count = 0
    errors = []

    try:
        with driver.session() as session:
            for variable_id in bulk_data.variable_ids:
                try:
                    print(f"Processing variable ID: {variable_id}")
                    # Get current variable data - first check if variable exists
                    print(f"Running query for variable {variable_id}")
                    current_result = session.run("""
                        MATCH (v:Variable {id: $id})
                        RETURN v
                    """, {"id": variable_id})

                    print(f"Query executed, getting single record")
                    current_record = current_result.single()
                    print(f"Record result: {current_record}")
                    if not current_record:
                        print(f"Variable {variable_id} not found in database")
                        errors.append(f"Variable {variable_id} not found")
                        continue
                    
                    print(f"Variable {variable_id} found, proceeding with update")

                    current_variable = current_record["v"]

                    # Build dynamic SET clause for only provided fields that are not "Keep Current"
                    set_clauses = []
                    params = {"id": variable_id}
                    
                    # Helper function to check if a field should be updated
                    def should_update_field(value: Optional[str], keep_current_text: str = "Keep Current") -> bool:
                        if value is None:
                            return False
                        stripped = value.strip()
                        return stripped != "" and stripped != keep_current_text and not stripped.startswith("Keep Current") and not stripped.startswith("Keep current")
                    
                    # Only update fields that are provided, not empty, and not "Keep Current" values
                    if should_update_field(bulk_data.variable, "Keep current variable"):
                        set_clauses.append("v.name = $variable")
                        params["variable"] = bulk_data.variable
                    if should_update_field(bulk_data.part, "Keep Current Part"):
                        set_clauses.append("v.part = $part")
                        params["part"] = bulk_data.part
                    if should_update_field(bulk_data.section, "Keep current section"):
                        set_clauses.append("v.section = $section")
                        params["section"] = bulk_data.section
                    if should_update_field(bulk_data.group, "Keep Current Group"):
                        set_clauses.append("v.group = $group")
                        params["group"] = bulk_data.group
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
                        set_clauses.append("v.validation = $validation")
                        params["validation"] = bulk_data.validation
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

                    # Only update if there are fields to update
                    if set_clauses:
                        update_query = f"""
                            MATCH (v:Variable {{id: $id}})
                            SET {', '.join(set_clauses)}
                        """
                        session.run(update_query, params)

                    # Update driver relationships if driver field is provided, not empty, and not "Keep Current"
                    if bulk_data.driver is not None and bulk_data.driver.strip() != "" and bulk_data.driver.strip() != "Keep Current":
                        print(f"Updating driver relationships with: {bulk_data.driver}")
                        await create_driver_relationships(session, variable_id, bulk_data.driver)

                    # Handle object relationships if provided
                    if bulk_data.objectRelationshipsList is not None and len(bulk_data.objectRelationshipsList) > 0:
                        # If shouldOverrideRelationships is true, delete all existing relationships first
                        if bulk_data.shouldOverrideRelationships:
                            print(f"🗑️ Deleting all existing relationships for variable {variable_id} (override mode)")
                            try:
                                # Delete all HAS_SPECIFIC_VARIABLE relationships
                                delete_specific = session.run("""
                                    MATCH (o:Object)-[r:HAS_SPECIFIC_VARIABLE]->(v:Variable {id: $variable_id})
                                    DELETE r
                                    RETURN count(r) as deleted_count
                                """, {"variable_id": variable_id})
                                specific_count = delete_specific.single()["deleted_count"] if delete_specific.single() else 0
                                
                                # Delete all HAS_VARIABLE relationships
                                delete_all = session.run("""
                                    MATCH (o:Object)-[r:HAS_VARIABLE]->(v:Variable {id: $variable_id})
                                    DELETE r
                                    RETURN count(r) as deleted_count
                                """, {"variable_id": variable_id})
                                all_count = delete_all.single()["deleted_count"] if delete_all.single() else 0
                                
                                print(f"✅ Deleted {specific_count} HAS_SPECIFIC_VARIABLE and {all_count} HAS_VARIABLE relationships")
                            except Exception as e:
                                print(f"⚠️ Error deleting existing relationships for variable {variable_id}: {str(e)}")
                                errors.append(f"Failed to delete existing relationships for variable {variable_id}: {str(e)}")
                        
                        print(f"Processing {len(bulk_data.objectRelationshipsList)} object relationships")
                        for relationship in bulk_data.objectRelationshipsList:
                            try:
                                # Create object relationship for this variable
                                await create_object_relationship_for_variable(session, variable_id, relationship)
                            except Exception as e:
                                print(f"Error creating object relationship for variable {variable_id}: {str(e)}")
                                errors.append(f"Failed to create object relationship for variable {variable_id}: {str(e)}")

                    updated_count += 1

                except Exception as e:
                    print(f"Error updating variable {variable_id}: {str(e)}")
                    errors.append(f"Failed to update variable {variable_id}: {str(e)}")
                    continue

        return BulkVariableUpdateResponse(
            success=updated_count > 0,
            message=f"Updated {updated_count} variables successfully",
            updated_count=updated_count,
            error_count=len(errors),
            errors=errors
        )

    except Exception as e:
        print(f"Error in bulk update: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to bulk update variables: {str(e)}")

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