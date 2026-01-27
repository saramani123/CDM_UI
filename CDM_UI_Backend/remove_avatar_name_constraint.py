#!/usr/bin/env python3
"""
Script to remove the unique constraint on Avatar.name.

Since we're now using Avatar IDs for uniqueness and allowing multiple
Avatar nodes with the same name for different Beings, we need to remove
the unique constraint on Avatar.name.
"""

import os
import sys
from dotenv import load_dotenv
from neo4j import GraphDatabase

# Load environment variables
if os.getenv("RENDER") is None:  # Not in Render (local development)
    load_dotenv(".env.dev")
else:  # In Render (production)
    pass

def get_driver():
    """Get Neo4j driver connection"""
    uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    username = os.getenv("NEO4J_USERNAME", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "password")
    environment = os.getenv("ENVIRONMENT", "development")
    instance_name = os.getenv("NEO4J_INSTANCE_NAME", "unknown")
    
    print(f"Connecting to Neo4j...")
    print(f"Environment: {environment}")
    print(f"Instance: {instance_name}")
    print(f"URI: {uri}")
    
    # For Neo4j Aura, use neo4j+ssc scheme
    working_uri = uri.replace("neo4j+s://", "neo4j+ssc://")
    
    driver = GraphDatabase.driver(
        working_uri,
        auth=(username, password),
        max_connection_lifetime=15 * 60,
        max_connection_pool_size=10,
        connection_acquisition_timeout=30,
        connection_timeout=15,
        keep_alive=True
    )
    
    # Test connection
    with driver.session() as session:
        result = session.run("RETURN 1 as test")
        record = result.single()
        if record:
            print(f"✅ Connected to Neo4j successfully!\n")
    
    return driver

def remove_avatar_name_constraint(driver, dry_run=True):
    """Remove the unique constraint on Avatar.name"""
    with driver.session() as session:
        # First, check if the constraint exists
        print("🔍 Checking for existing constraints on Avatar.name...")
        constraints_result = session.run("""
            SHOW CONSTRAINTS
            YIELD name, type, entityType, properties
            WHERE entityType = 'NODE' AND 'Avatar' IN labels(node)
            RETURN name, type, properties
        """)
        
        constraints = []
        for record in constraints_result:
            constraints.append({
                "name": record.get("name"),
                "type": record.get("type"),
                "properties": record.get("properties")
            })
        
        avatar_name_constraint = None
        for constraint in constraints:
            if constraint.get("properties") and "name" in constraint.get("properties", []):
                avatar_name_constraint = constraint
                break
        
        if avatar_name_constraint:
            print(f"✅ Found constraint: {avatar_name_constraint['name']}")
            print(f"   Type: {avatar_name_constraint['type']}")
            print(f"   Properties: {avatar_name_constraint['properties']}")
        else:
            print("⚠️  No unique constraint found on Avatar.name")
            print("   The constraint may have already been removed or doesn't exist.")
            return
        
        if dry_run:
            print("\n⚠️  DRY RUN MODE - No changes will be made")
            print("   Run with --execute to remove the constraint")
            return
        
        print("\n🔧 Removing constraint...")
        
        # Try to drop the constraint by name
        constraint_name = avatar_name_constraint['name']
        try:
            result = session.run(f"DROP CONSTRAINT {constraint_name} IF EXISTS")
            result.consume()  # Consume the result
            print(f"✅ Successfully removed constraint: {constraint_name}")
        except Exception as e:
            print(f"⚠️  Error removing constraint by name: {e}")
            # Try alternative method - drop by property
            try:
                result = session.run("""
                    DROP CONSTRAINT avatar_name_unique IF EXISTS
                """)
                result.consume()
                print("✅ Successfully removed constraint using property-based drop")
            except Exception as e2:
                print(f"❌ Error with alternative method: {e2}")
                print("\n⚠️  You may need to remove the constraint manually in Neo4j Browser:")
                print(f"   DROP CONSTRAINT {constraint_name}")
                raise

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Remove unique constraint on Avatar.name')
    parser.add_argument('--execute', action='store_true', help='Actually remove the constraint (default is dry run)')
    args = parser.parse_args()
    
    try:
        driver = get_driver()
        dry_run = not args.execute
        remove_avatar_name_constraint(driver, dry_run=dry_run)
        driver.close()
        print("\n✅ Script completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
