#!/usr/bin/env python3
"""
Quick script to check if Part and Group nodes have unique IDs in Neo4j.
Run this against both dev and prod databases.
"""

from neo4j import GraphDatabase
import sys
import os
from dotenv import load_dotenv

def check_ids(uri, user, password, db_name="neo4j"):
    """Check Part and Group nodes for ID properties"""
    # For Neo4j Aura, use neo4j+ssc scheme for self-signed certificates
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
        # For Neo4j Aura, don't specify database parameter (uses default)
        # Only specify if it's explicitly set and not "neo4j"
        if db_name and db_name != "neo4j":
            session = driver.session(database=db_name)
        else:
            session = driver.session()
        
        with session:
            print(f"\n{'='*60}")
            print(f"Checking database: {uri}")
            print(f"{'='*60}\n")
            
            # Check Parts
            result = session.run("""
                MATCH (p:Part)
                RETURN 
                    count(p) as total_parts,
                    count(p.id) as parts_with_id,
                    count(p) - count(p.id) as parts_without_id
            """)
            record = result.single()
            print("PART NODES:")
            print(f"  Total Parts: {record['total_parts']}")
            print(f"  Parts with ID: {record['parts_with_id']}")
            print(f"  Parts without ID: {record['parts_without_id']}")
            
            if record['parts_without_id'] > 0:
                print("\n  Sample Parts without ID:")
                sample = session.run("""
                    MATCH (p:Part)
                    WHERE p.id IS NULL
                    RETURN p.name as name
                    LIMIT 10
                """)
                for r in sample:
                    print(f"    - {r['name']}")
            
            # Check Groups
            result = session.run("""
                MATCH (g:Group)
                RETURN 
                    count(g) as total_groups,
                    count(g.id) as groups_with_id,
                    count(g) - count(g.id) as groups_without_id
            """)
            record = result.single()
            print("\nGROUP NODES:")
            print(f"  Total Groups: {record['total_groups']}")
            print(f"  Groups with ID: {record['groups_with_id']}")
            print(f"  Groups without ID: {record['groups_without_id']}")
            
            if record['groups_without_id'] > 0:
                print("\n  Sample Groups without ID:")
                sample = session.run("""
                    MATCH (g:Group)
                    WHERE g.id IS NULL
                    RETURN g.name as name, g.part as part
                    LIMIT 10
                """)
                for r in sample:
                    print(f"    - {r['name']} (part: {r.get('part', 'N/A')})")
            
            # Check for duplicate group names across parts
            result = session.run("""
                MATCH (p1:Part)-[:HAS_GROUP]->(g1:Group)
                MATCH (p2:Part)-[:HAS_GROUP]->(g2:Group)
                WHERE p1 <> p2 AND g1.name = g2.name
                RETURN count(DISTINCT g1.name) as duplicate_group_names
            """)
            dup_count = result.single()['duplicate_group_names']
            print(f"\nDUPLICATE GROUP NAMES (same name, different parts): {dup_count}")
            
            if dup_count > 0:
                print("\n  Sample duplicate group names:")
                sample = session.run("""
                    MATCH (p1:Part)-[:HAS_GROUP]->(g1:Group)
                    MATCH (p2:Part)-[:HAS_GROUP]->(g2:Group)
                    WHERE p1 <> p2 AND g1.name = g2.name
                    RETURN DISTINCT g1.name as group_name, 
                           collect(DISTINCT p1.name) as parts
                    LIMIT 5
                """)
                for r in sample:
                    print(f"    - '{r['group_name']}' appears in parts: {r['parts']}")
            
            print(f"\n{'='*60}\n")
            
    finally:
        driver.close()

if __name__ == "__main__":
    # Check if .env file path provided, otherwise try to auto-detect
    env_file = None
    if len(sys.argv) > 1:
        env_file = sys.argv[1]
    
    # Load environment variables from .env file
    if env_file:
        load_dotenv(env_file, override=True)
    else:
        # Try default locations
        if os.path.exists("CDM_UI_Backend/.env.dev"):
            load_dotenv("CDM_UI_Backend/.env.dev", override=True)
        elif os.path.exists(".env.dev"):
            load_dotenv(".env.dev", override=True)
    
    # Get credentials from environment
    uri = os.getenv("NEO4J_URI")
    user = os.getenv("NEO4J_USERNAME")
    password = os.getenv("NEO4J_PASSWORD")
    db_name = os.getenv("NEO4J_DATABASE", "neo4j")
    
    if not uri or not user or not password:
        print("Error: Missing Neo4j credentials in environment variables")
        print("\nUsage:")
        print("  python check_part_group_ids.py [path_to_.env_file]")
        print("\nOr set environment variables:")
        print("  export NEO4J_URI=bolt://localhost:7687")
        print("  export NEO4J_USERNAME=neo4j")
        print("  export NEO4J_PASSWORD=your_password")
        print("\nOr provide .env file path:")
        print("  python check_part_group_ids.py CDM_UI_Backend/.env.dev")
        print("  python check_part_group_ids.py CDM_UI_Backend/.env.prod")
        sys.exit(1)
    
    check_ids(uri, user, password, db_name)
