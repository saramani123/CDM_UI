#!/usr/bin/env python3
"""
Quick script to check if Being and Avatar nodes have unique IDs in Neo4j.
- Being: one id per distinct name.
- Avatar: one id per (Being name, Avatar name). Same avatar name in same Being = same id;
  same avatar name in different Beings = different ids.

Run this against both dev and prod databases.
"""

from neo4j import GraphDatabase
import sys
import os
from dotenv import load_dotenv

def check_ids(uri, user, password, db_name="neo4j"):
    """Check Being and Avatar nodes for ID properties"""
    working_uri = uri.replace("neo4j+s://", "neo4j+ssc://")
    print(f"Connecting to: {working_uri}")
    driver = GraphDatabase.driver(
        working_uri,
        auth=(user, password),
        max_connection_lifetime=15 * 60,
        max_connection_pool_size=10,
        connection_acquisition_timeout=30,
        connection_timeout=15,
        keep_alive=True
    )
    try:
        if db_name and db_name != "neo4j":
            session = driver.session(database=db_name)
        else:
            session = driver.session()
        with session:
            print(f"\n{'='*60}")
            print(f"Checking database: {uri}")
            print(f"{'='*60}\n")
            # Beings
            result = session.run("""
                MATCH (b:Being)
                RETURN
                    count(b) as total_beings,
                    count(b.id) as beings_with_id,
                    count(b) - count(b.id) as beings_without_id
            """)
            record = result.single()
            print("BEING NODES:")
            print(f"  Total Beings: {record['total_beings']}")
            print(f"  Beings with ID: {record['beings_with_id']}")
            print(f"  Beings without ID: {record['beings_without_id']}")
            if record['beings_without_id'] > 0:
                sample = session.run("""
                    MATCH (b:Being)
                    WHERE b.id IS NULL AND b.name IS NOT NULL AND b.name <> ''
                    RETURN b.name as name
                    LIMIT 10
                """)
                print("\n  Sample Beings without ID:")
                for r in sample:
                    print(f"    - {r['name']}")
            # Avatars (via HAS_AVATAR from Being)
            result = session.run("""
                MATCH (b:Being)-[:HAS_AVATAR]->(a:Avatar)
                RETURN
                    count(a) as total_avatars,
                    count(a.id) as avatars_with_id,
                    count(a) - count(a.id) as avatars_without_id
            """)
            record = result.single()
            print("\nAVATAR NODES (linked via HAS_AVATAR):")
            print(f"  Total Avatars: {record['total_avatars']}")
            print(f"  Avatars with ID: {record['avatars_with_id']}")
            print(f"  Avatars without ID: {record['avatars_without_id']}")
            if record['avatars_without_id'] > 0:
                sample = session.run("""
                    MATCH (b:Being)-[:HAS_AVATAR]->(a:Avatar)
                    WHERE a.id IS NULL AND a.name IS NOT NULL AND a.name <> ''
                    RETURN b.name as being_name, a.name as avatar_name
                    LIMIT 10
                """)
                print("\n  Sample Avatars without ID (being, avatar):")
                for r in sample:
                    print(f"    - Being '{r['being_name']}', Avatar '{r['avatar_name']}'")
            # Orphan avatars (Avatar nodes not linked via HAS_AVATAR)
            orphan = session.run("""
                MATCH (a:Avatar)
                WHERE NOT EXISTS((:Being)-[:HAS_AVATAR]->(a))
                RETURN count(a) as c
            """)
            oc = orphan.single()["c"]
            print(f"\n  Avatars not linked from any Being (orphans): {oc}")
            print(f"\n{'='*60}\n")
    finally:
        driver.close()

if __name__ == "__main__":
    env_file = None
    if len(sys.argv) > 1:
        env_file = sys.argv[1]
    if env_file:
        load_dotenv(env_file, override=True)
    else:
        if os.path.exists("CDM_UI_Backend/.env.dev"):
            load_dotenv("CDM_UI_Backend/.env.dev", override=True)
        elif os.path.exists(".env.dev"):
            load_dotenv(".env.dev", override=True)
    uri = os.getenv("NEO4J_URI")
    user = os.getenv("NEO4J_USERNAME")
    password = os.getenv("NEO4J_PASSWORD")
    db_name = os.getenv("NEO4J_DATABASE", "neo4j")
    if not uri or not user or not password:
        print("Error: Missing Neo4j credentials in environment variables")
        print("\nUsage:")
        print("  python check_being_avatar_ids.py [path_to_.env_file]")
        print("  python check_being_avatar_ids.py CDM_UI_Backend/.env.dev")
        print("  python check_being_avatar_ids.py CDM_UI_Backend/.env.prod")
        sys.exit(1)
    check_ids(uri, user, password, db_name)
