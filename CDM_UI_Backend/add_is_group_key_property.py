#!/usr/bin/env python3
"""
Migration script to add is_group_key property to all existing Variables in Neo4j.
This script safely adds is_group_key = False to all Variable nodes that don't already have this property.

Usage:
    python add_is_group_key_property.py

This script:
1. Connects to Neo4j using environment variables from .env.dev (dev) or Render env vars (prod)
2. Finds all Variable nodes without is_group_key property
3. Sets is_group_key = False for all such nodes
4. Reports the number of nodes updated
"""

import os
import sys
from dotenv import load_dotenv
from neo4j import GraphDatabase

# Load environment variables
if os.getenv("RENDER") is None:  # Not in Render (local development)
    load_dotenv(".env.dev")
else:  # In Render (production)
    pass  # Environment variables are automatically injected by Render

def get_driver():
    """Get Neo4j driver instance"""
    uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    username = os.getenv("NEO4J_USERNAME", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "password")
    environment = os.getenv("ENVIRONMENT", "development")
    instance_name = os.getenv("NEO4J_INSTANCE_NAME", "unknown")
    
    print(f"Connecting to Neo4j...")
    print(f"  Environment: {environment}")
    print(f"  Instance: {instance_name}")
    print(f"  URI: {uri}")
    
    # For Neo4j Aura, use neo4j+ssc scheme for self-signed certificates
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
            print(f"✅ Successfully connected to Neo4j!")
        else:
            print("❌ Failed to connect to Neo4j")
            sys.exit(1)
    
    return driver

def add_is_group_key_property():
    """Add is_group_key = False to all Variables that don't have it"""
    driver = get_driver()
    
    try:
        with driver.session() as session:
            print("\n" + "="*60)
            print("Adding is_group_key property to Variables")
            print("="*60 + "\n")
            
            # Count Variables without is_group_key
            variables_count_result = session.run("""
                MATCH (v:Variable)
                WHERE v.is_group_key IS NULL
                RETURN count(v) as count
            """).single()
            
            variables_count = variables_count_result["count"] if variables_count_result else 0
            print(f"Found {variables_count} Variables without is_group_key property")
            
            # Count total Variables
            total_variables_result = session.run("""
                MATCH (v:Variable)
                RETURN count(v) as count
            """).single()
            total_variables = total_variables_result["count"] if total_variables_result else 0
            print(f"Total Variables in database: {total_variables}")
            
            if variables_count == 0:
                print("\n✅ All Variables already have is_group_key property!")
                return
            
            # Update Variables
            if variables_count > 0:
                print(f"\nUpdating {variables_count} Variables...")
                variables_result = session.run("""
                    MATCH (v:Variable)
                    WHERE v.is_group_key IS NULL
                    SET v.is_group_key = false
                    RETURN count(v) as updated
                """).single()
                
                variables_updated = variables_result["updated"] if variables_result else 0
                print(f"✅ Updated {variables_updated} Variables with is_group_key = false")
            
            # Verify the updates
            print("\n" + "-"*60)
            print("Verification:")
            print("-"*60)
            
            # Count Variables with is_group_key
            variables_with_key = session.run("""
                MATCH (v:Variable)
                WHERE v.is_group_key IS NOT NULL
                RETURN count(v) as count
            """).single()
            
            variables_total = session.run("""
                MATCH (v:Variable)
                RETURN count(v) as count
            """).single()
            
            print(f"Variables: {variables_with_key['count'] if variables_with_key else 0} / {variables_total['count'] if variables_total else 0} have is_group_key property")
            
            # Count Variables with is_group_key = true
            variables_with_key_true = session.run("""
                MATCH (v:Variable)
                WHERE v.is_group_key = true
                RETURN count(v) as count
            """).single()
            
            print(f"Variables with is_group_key = true: {variables_with_key_true['count'] if variables_with_key_true else 0}")
            
            print("\n" + "="*60)
            print("✅ Migration completed successfully!")
            print("="*60 + "\n")
            
    except Exception as e:
        print(f"\n❌ Error during migration: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        driver.close()
        print("Neo4j connection closed")

if __name__ == "__main__":
    print("🚀 Starting is_group_key property migration...")
    print("⚠️  This will add is_group_key = False to all Variables")
    print("⚠️  This is safe and will not modify existing data\n")
    
    add_is_group_key_property()

