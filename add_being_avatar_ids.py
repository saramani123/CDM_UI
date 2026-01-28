#!/usr/bin/env python3
"""
Safe migration script: Add unique id to Being and Avatar nodes in Neo4j.
- Does NOT delete or merge nodes; does NOT change any relationships.
- Beings: one unique id per distinct Being name.
- Avatars: one unique id per (Being name, Avatar name). Same avatar name in same Being = same id;
  same avatar name in different Beings = different ids.

COMMANDS (run from project root):

  # 1) Dev - dry run
  python3 add_being_avatar_ids.py CDM_UI_Backend/.env.dev

  # 2) Dev - apply
  python3 add_being_avatar_ids.py CDM_UI_Backend/.env.dev --execute

  # 3) Prod - dry run
  python3 add_being_avatar_ids.py CDM_UI_Backend/.env.prod

  # 4) Prod - apply
  python3 add_being_avatar_ids.py CDM_UI_Backend/.env.prod --execute
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
        # --- BEINGS ---
        being_names = session.run("""
            MATCH (b:Being)
            WHERE b.id IS NULL AND b.name IS NOT NULL AND b.name <> ''
            RETURN DISTINCT b.name AS name
        """)
        being_list = [r["name"] for r in being_names]
        print(f"Beings without id: {len(being_list)}")
        if not being_list:
            print("  (none)\n")
        else:
            for name in being_list[:15]:
                print(f"  - {name}")
            if len(being_list) > 15:
                print(f"  ... and {len(being_list) - 15} more")
            print()
            if execute:
                for name in being_list:
                    new_id = str(uuid.uuid4())
                    result = session.run(
                        "MATCH (b:Being {name: $name}) WHERE b.id IS NULL SET b.id = $id RETURN count(b) AS c",
                        name=name, id=new_id
                    )
                    c = result.single()["c"]
                    print(f"  Set id on {c} Being node(s) for name '{name}'")
                print("Beings: ids assigned.\n")
            else:
                print("  [DRY RUN] Would assign one new id per distinct Being name (above).\n")

        # --- AVATARS ---
        # Uniqueness: (Being name, Avatar name). One id per such pair via HAS_AVATAR.
        avatar_pairs = session.run("""
            MATCH (b:Being)-[:HAS_AVATAR]->(a:Avatar)
            WHERE a.id IS NULL AND a.name IS NOT NULL AND a.name <> ''
            RETURN DISTINCT b.name AS being_name, a.name AS avatar_name
        """)
        pairs = [(r["being_name"], r["avatar_name"]) for r in avatar_pairs]
        print(f"Avatar (being, name) pairs without id: {len(pairs)}")
        if not pairs:
            print("  (none)\n")
        else:
            for (bname, aname) in pairs[:15]:
                print(f"  - Being '{bname}', Avatar '{aname}'")
            if len(pairs) > 15:
                print(f"  ... and {len(pairs) - 15} more")
            print()
            if execute:
                for (being_name, avatar_name) in pairs:
                    new_id = str(uuid.uuid4())
                    result = session.run("""
                        MATCH (b:Being {name: $being_name})-[:HAS_AVATAR]->(a:Avatar {name: $avatar_name})
                        WHERE a.id IS NULL
                        SET a.id = $id
                        RETURN count(a) AS c
                    """, being_name=being_name, avatar_name=avatar_name, id=new_id)
                    c = result.single()["c"]
                    print(f"  Set id on {c} Avatar node(s) for Being '{being_name}', Avatar '{avatar_name}'")
                print("Avatars: ids assigned.\n")
            else:
                print("  [DRY RUN] Would assign one new id per (Being, Avatar name) pair (above).\n")

    print("Done.")


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 add_being_avatar_ids.py <path_to_.env> [--execute]")
        print("  e.g. python3 add_being_avatar_ids.py CDM_UI_Backend/.env.dev")
        print("  e.g. python3 add_being_avatar_ids.py CDM_UI_Backend/.env.dev --execute")
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
