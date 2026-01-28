#!/usr/bin/env python3
"""
Safe migration script: Add unique id to Part and Group nodes in Neo4j.
- Does NOT delete or merge nodes; does NOT change any relationships.
- Parts: one unique id per distinct Part name.
- Groups: one unique id per (Part name, Group name). Same group name in same part = same id;
  same group name in different parts = different ids.

COMMANDS (run from project root):

  # 1) Dev - dry run
  python3 add_part_group_ids.py CDM_UI_Backend/.env.dev

  # 2) Dev - apply
  python3 add_part_group_ids.py CDM_UI_Backend/.env.dev --execute

  # 3) Prod - dry run
  python3 add_part_group_ids.py CDM_UI_Backend/.env.prod

  # 4) Prod - apply
  python3 add_part_group_ids.py CDM_UI_Backend/.env.prod --execute
"""

import os
import sys
import uuid
from dotenv import load_dotenv
from neo4j import GraphDatabase

def get_driver(env_file):
    load_dotenv(env_file, override=True)
    uri = os.getenv("NEO4J_URI")
    user = os.getenv("NEO4J_USERNAME")
    password = os.getenv("NEO4J_PASSWORD")
    if not uri or not user or not password:
        raise ValueError("NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD must be set in env file")
    working_uri = uri.replace("neo4j+s://", "neo4j+ssc://")
    return GraphDatabase.driver(
        working_uri,
        auth=(user, password),
        max_connection_lifetime=15 * 60,
        connection_acquisition_timeout=30,
        connection_timeout=15,
    )


def run_migration(driver, execute=False):
    db_name = os.getenv("NEO4J_DATABASE") or "neo4j"
    if db_name == "neo4j":
        session = driver.session()
    else:
        session = driver.session(database=db_name)

    mode = "EXECUTE" if execute else "DRY RUN (use --execute to apply)"
    print(f"Mode: {mode}\n")

    with session:
        # --- PARTS ---
        # Get distinct Part names that have no id
        part_names = session.run("""
            MATCH (p:Part)
            WHERE p.id IS NULL AND p.name IS NOT NULL AND p.name <> ''
            RETURN DISTINCT p.name AS name
        """)
        part_list = [r["name"] for r in part_names]
        print(f"Parts without id: {len(part_list)}")
        if not part_list:
            print("  (none)\n")
        else:
            for name in part_list[:15]:
                print(f"  - {name}")
            if len(part_list) > 15:
                print(f"  ... and {len(part_list) - 15} more")
            print()

            if execute:
                for name in part_list:
                    new_id = str(uuid.uuid4())
                    result = session.run(
                        "MATCH (p:Part {name: $name}) WHERE p.id IS NULL SET p.id = $id RETURN count(p) AS c",
                        name=name, id=new_id
                    )
                    c = result.single()["c"]
                    print(f"  Set id on {c} Part node(s) for name '{name}'")
                print("Parts: ids assigned.\n")
            else:
                print("  [DRY RUN] Would assign one new id per distinct Part name (above).\n")

        # --- GROUPS ---
        # Uniqueness: (Part name, Group name). One id per such pair; all Group nodes
        # with that part+name get the same id.
        group_pairs = session.run("""
            MATCH (p:Part)-[:HAS_GROUP]->(g:Group)
            WHERE g.id IS NULL AND g.name IS NOT NULL AND g.name <> ''
            RETURN DISTINCT p.name AS part_name, g.name AS group_name
        """)
        pairs = [(r["part_name"], r["group_name"]) for r in group_pairs]
        print(f"Group (part, name) pairs without id: {len(pairs)}")
        if not pairs:
            print("  (none)\n")
        else:
            for (pname, gname) in pairs[:15]:
                print(f"  - Part '{pname}', Group '{gname}'")
            if len(pairs) > 15:
                print(f"  ... and {len(pairs) - 15} more")
            print()

            if execute:
                for (part_name, group_name) in pairs:
                    new_id = str(uuid.uuid4())
                    result = session.run("""
                        MATCH (p:Part {name: $part_name})-[:HAS_GROUP]->(g:Group {name: $group_name})
                        WHERE g.id IS NULL
                        SET g.id = $id
                        RETURN count(g) AS c
                    """, part_name=part_name, group_name=group_name, id=new_id)
                    c = result.single()["c"]
                    print(f"  Set id on {c} Group node(s) for Part '{part_name}', Group '{group_name}'")
                print("Groups: ids assigned.\n")
            else:
                print("  [DRY RUN] Would assign one new id per (Part, Group name) pair (above).\n")

    print("Done.")


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 add_part_group_ids.py <path_to_.env> [--execute]")
        print("  e.g. python3 add_part_group_ids.py CDM_UI_Backend/.env.dev")
        print("  e.g. python3 add_part_group_ids.py CDM_UI_Backend/.env.dev --execute")
        sys.exit(1)
    env_file = sys.argv[1]
    execute = "--execute" in sys.argv
    if not os.path.isfile(env_file):
        print(f"Env file not found: {env_file}")
        sys.exit(1)
    driver = get_driver(env_file)
    try:
        run_migration(driver, execute=execute)
    finally:
        driver.close()


if __name__ == "__main__":
    main()
