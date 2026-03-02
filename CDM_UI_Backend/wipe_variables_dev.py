#!/usr/bin/env python3
"""
Wipe ALL Variable data from the DEV Neo4j instance (CDM_Dev) only.
Uses .env.dev so it never touches production.

Deletes: all Variable nodes and every relationship to/from them
(Part, Group, Drivers, Objects, Lists, Variations are left intact).

Usage (from CDM_UI_Backend):
  python wipe_variables_dev.py
  python wipe_variables_dev.py --yes   # skip confirmation
"""
import os
import sys

# Force dev: load .env.dev only
from dotenv import load_dotenv
load_dotenv(".env.dev", override=True)
# Prevent db.py from ever loading prod
os.environ.pop("RENDER", None)

def main():
    uri = os.getenv("NEO4J_URI")
    username = os.getenv("NEO4J_USERNAME", "neo4j")
    password = os.getenv("NEO4J_PASSWORD")
    instance = os.getenv("NEO4J_INSTANCE_NAME", "unknown")

    if not uri or not password:
        print("Error: NEO4J_URI and NEO4J_PASSWORD must be set in .env.dev", file=sys.stderr)
        sys.exit(1)

    if "prod" in uri.lower() or (instance and "prod" in instance.lower()):
        print("Refusing to run: .env.dev appears to point at production.", file=sys.stderr)
        print("URI or instance name contains 'prod'. Aborting.", file=sys.stderr)
        sys.exit(1)

    if "--yes" not in sys.argv:
        print(f"About to DETACH DELETE all Variable nodes on: {instance} ({uri})")
        print("This removes all Variables and their relationships. Part/Group/Drivers/Objects/Lists are NOT deleted.")
        r = input("Type 'yes' to proceed: ")
        if r.strip().lower() != "yes":
            print("Aborted.")
            sys.exit(0)

    from neo4j import GraphDatabase
    working_uri = uri.replace("neo4j+s://", "neo4j+ssc://")
    driver = GraphDatabase.driver(working_uri, auth=(username, password))

    with driver.session() as session:
        # Count first
        count_result = session.run("MATCH (v:Variable) RETURN count(v) AS c")
        n = count_result.single()["c"]
        if n == 0:
            print("No Variable nodes found. Nothing to delete.")
            driver.close()
            return
        print(f"Deleting {n} Variable node(s) and all their relationships...")
        session.run("MATCH (v:Variable) DETACH DELETE v")
        print("Done. Variable data has been wiped on dev.")

    driver.close()

if __name__ == "__main__":
    main()
