#!/usr/bin/env python3
"""
One-time export: fetch Variables grid data from Neo4j and write to CSV.
Uses the same data shape as the production app Variables grid.

Usage:
  Development (CDM_Dev, uses .env.dev):
    python export_variables_to_csv.py
    python export_variables_to_csv.py -o my_variables.csv

  Production (CDM_Prod): use .env.prod or .env.production with NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD
    python export_variables_to_csv.py --production
    python export_variables_to_csv.py --production -o production_variables.csv
    python export_variables_to_csv.py --env-file .env.prod -o production_variables.csv
"""
import argparse
import csv
import os
import sys

# Parse args before importing db so we can load production env first
parser = argparse.ArgumentParser(description="Export Variables grid data to CSV")
parser.add_argument("--production", action="store_true", help="Use production Neo4j (CDM_Prod). Loads .env.production or .env.prod.")
parser.add_argument("--env-file", default=None, help="Path to env file (e.g. .env.prod). Overrides --production default.")
parser.add_argument("-o", "--output", default="variables_export.csv", help="Output CSV path (default: variables_export.csv)")
args = parser.parse_args()

if args.production or args.env_file:
    from dotenv import load_dotenv
    if args.env_file:
        load_dotenv(args.env_file, override=True)
    else:
        # Try .env.production first, then .env.prod
        if os.path.isfile(".env.production"):
            load_dotenv(".env.production", override=True)
        else:
            load_dotenv(".env.prod", override=True)
    os.environ["RENDER"] = "1"  # so db.py doesn't load .env.dev

from db import get_driver


def fetch_variables(session):
    """Same logic as routes/variables.py get_variables()."""
    all_sectors_result = session.run("MATCH (s:Sector) WHERE s.name <> 'ALL' RETURN s.name as name")
    all_sectors = {record["name"] for record in all_sectors_result}
    all_domains_result = session.run("MATCH (d:Domain) WHERE d.name <> 'ALL' RETURN d.name as name")
    all_domains = {record["name"] for record in all_domains_result}
    all_countries_result = session.run("MATCH (c:Country) WHERE c.name <> 'ALL' RETURN c.name as name")
    all_countries = {record["name"] for record in all_countries_result}

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
        if not record["id"] or not record["part"] or not record["group"] or not record["variable"]:
            continue
        sectors = record["sectors"] or []
        domains = record["domains"] or []
        countries = record["countries"] or []
        variable_clarifiers = record["variableClarifiers"] or []
        sectors_filtered = [s for s in sectors if s != "ALL"]
        domains_filtered = [d for d in domains if d != "ALL"]
        countries_filtered = [c for c in countries if c != "ALL"]
        sectors_set = set(sectors_filtered)
        domains_set = set(domains_filtered)
        countries_set = set(countries_filtered)
        sector_all_selected = len(all_sectors) > 0 and len(sectors_set) > 0 and sectors_set == all_sectors
        domain_all_selected = len(all_domains) > 0 and len(domains_set) > 0 and domains_set == all_domains
        country_all_selected = len(all_countries) > 0 and len(countries_set) > 0 and countries_set == all_countries
        sector_str = "ALL" if ("ALL" in sectors or sector_all_selected) else (", ".join(sectors_filtered) if sectors_filtered else "ALL")
        domain_str = "ALL" if ("ALL" in domains or domain_all_selected) else (", ".join(domains_filtered) if domains_filtered else "ALL")
        country_str = "ALL" if ("ALL" in countries or country_all_selected) else (", ".join(countries_filtered) if countries_filtered else "ALL")
        clarifier_str = variable_clarifiers[0] if variable_clarifiers else "None"
        driver_string = f"{sector_str}, {domain_str}, {country_str}, {clarifier_str}"

        all_props = record.get("allProps", {})
        validation_list = []
        if all_props.get("validation"):
            validation_list.append(str(all_props["validation"]))
        validation_keys = [k for k in all_props.keys() if k.startswith("Validation #")]
        validation_keys.sort(key=lambda x: int(x.split("#")[1].strip()) if "#" in x and x.split("#")[1].strip().isdigit() else 999)
        for key in validation_keys:
            if all_props.get(key):
                validation_list.append(str(all_props[key]))
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
            "variations": int(record["variations"]) if record["variations"] is not None else 0,
        }
        variables.append(var)
    return variables


def main():
    out_path = args.output
    driver = get_driver()
    if not driver:
        print("Failed to connect to Neo4j. Check NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD.", file=sys.stderr)
        sys.exit(1)
    try:
        with driver.session() as session:
            variables = fetch_variables(session)
    finally:
        driver.close()

    if not variables:
        print("No variables found.", file=sys.stderr)
        sys.exit(0)

    # CSV columns matching the grid (same order as API response)
    fieldnames = [
        "id", "driver", "sector", "domain", "country", "part", "group", "section",
        "variable", "formatI", "formatII", "gType", "validation", "default",
        "graph", "status", "is_meme", "is_group_key", "objectRelationships", "variations"
    ]
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for row in variables:
            # Convert booleans to strings for CSV
            row = {k: (str(v).lower() if isinstance(v, bool) else v) for k, v in row.items()}
            w.writerow(row)
    print(f"Exported {len(variables)} variables to {out_path}")


if __name__ == "__main__":
    main()
