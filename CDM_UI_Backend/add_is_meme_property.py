#!/usr/bin/env python3
"""
Migration script to add is_meme property to all existing Objects, Variables, and Lists in Neo4j.
This script safely adds is_meme = False to all nodes that don't already have this property.

Usage:
    python add_is_meme_property.py

This script:
1. Connects to Neo4j using environment variables from .env.dev (dev) or Render env vars (prod)
2. Finds all Object, Variable, and List nodes without is_meme property
3. Sets is_meme = False for all such nodes
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

def add_is_meme_property():
    """Add is_meme = False to all Objects, Variables, and Lists that don't have it"""
    driver = get_driver()
    
    try:
        with driver.session() as session:
            print("\n" + "="*60)
            print("Adding is_meme property to Objects, Variables, and Lists")
            print("="*60 + "\n")
            
            # Count Objects without is_meme
            objects_count_result = session.run("""
                MATCH (o:Object)
                WHERE o.is_meme IS NULL
                RETURN count(o) as count
            """).single()
            
            objects_count = objects_count_result["count"] if objects_count_result else 0
            print(f"Found {objects_count} Objects without is_meme property")
            
            # Count Variables without is_meme
            variables_count_result = session.run("""
                MATCH (v:Variable)
                WHERE v.is_meme IS NULL
                RETURN count(v) as count
            """).single()
            
            variables_count = variables_count_result["count"] if variables_count_result else 0
            print(f"Found {variables_count} Variables without is_meme property")
            
            # Count Lists without is_meme (IS NULL catches both NULL and missing properties in Neo4j)
            lists_count_result = session.run("""
                MATCH (l:List)
                WHERE l.is_meme IS NULL
                RETURN count(l) as count
            """).single()
            
            lists_count = lists_count_result["count"] if lists_count_result else 0
            print(f"Found {lists_count} Lists without is_meme property")
            
            # Also check total Lists to see if any exist
            total_lists_result = session.run("""
                MATCH (l:List)
                RETURN count(l) as count
            """).single()
            total_lists = total_lists_result["count"] if total_lists_result else 0
            print(f"Total Lists in database: {total_lists}")
            
            if objects_count == 0 and variables_count == 0 and lists_count == 0:
                print("\n✅ All Objects, Variables, and Lists already have is_meme property!")
                return
            
            # Update Objects
            if objects_count > 0:
                print(f"\nUpdating {objects_count} Objects...")
                objects_result = session.run("""
                    MATCH (o:Object)
                    WHERE o.is_meme IS NULL
                    SET o.is_meme = false
                    RETURN count(o) as updated
                """).single()
                
                objects_updated = objects_result["updated"] if objects_result else 0
                print(f"✅ Updated {objects_updated} Objects with is_meme = false")
            
            # Update Variables
            if variables_count > 0:
                print(f"\nUpdating {variables_count} Variables...")
                variables_result = session.run("""
                    MATCH (v:Variable)
                    WHERE v.is_meme IS NULL
                    SET v.is_meme = false
                    RETURN count(v) as updated
                """).single()
                
                variables_updated = variables_result["updated"] if variables_result else 0
                print(f"✅ Updated {variables_updated} Variables with is_meme = false")
            
            # Update Lists - use a more aggressive approach to ensure all Lists have the property
            if total_lists > 0:
                print(f"\nEnsuring all {total_lists} Lists have is_meme property...")
                # First, set is_meme = false for Lists where it's NULL or missing
                lists_result = session.run("""
                    MATCH (l:List)
                    WHERE l.is_meme IS NULL
                    SET l.is_meme = false
                    RETURN count(l) as updated
                """).single()
                
                lists_updated = lists_result["updated"] if lists_result else 0
                
                # Also set it for any Lists that might not have been caught by the NULL check
                # This uses a different approach: set default for all, then only keep existing true values
                lists_result2 = session.run("""
                    MATCH (l:List)
                    WHERE NOT (l.is_meme IS NOT NULL AND l.is_meme = true)
                    SET l.is_meme = COALESCE(l.is_meme, false)
                    RETURN count(l) as updated
                """).single()
                
                lists_updated2 = lists_result2["updated"] if lists_result2 else 0
                total_updated = max(lists_updated, lists_updated2)
                
                if total_updated > 0:
                    print(f"✅ Updated {total_updated} Lists with is_meme = false")
                else:
                    print(f"✅ All {total_lists} Lists already have is_meme property set")
            
            # Verify the updates
            print("\n" + "-"*60)
            print("Verification:")
            print("-"*60)
            
            # Count Objects with is_meme
            objects_with_meme = session.run("""
                MATCH (o:Object)
                WHERE o.is_meme IS NOT NULL
                RETURN count(o) as count
            """).single()
            
            objects_total = session.run("""
                MATCH (o:Object)
                RETURN count(o) as count
            """).single()
            
            # Count Variables with is_meme
            variables_with_meme = session.run("""
                MATCH (v:Variable)
                WHERE v.is_meme IS NOT NULL
                RETURN count(v) as count
            """).single()
            
            variables_total = session.run("""
                MATCH (v:Variable)
                RETURN count(v) as count
            """).single()
            
            # Count Lists with is_meme
            lists_with_meme = session.run("""
                MATCH (l:List)
                WHERE l.is_meme IS NOT NULL
                RETURN count(l) as count
            """).single()
            
            lists_total = session.run("""
                MATCH (l:List)
                RETURN count(l) as count
            """).single()
            
            print(f"Objects: {objects_with_meme['count'] if objects_with_meme else 0} / {objects_total['count'] if objects_total else 0} have is_meme property")
            print(f"Variables: {variables_with_meme['count'] if variables_with_meme else 0} / {variables_total['count'] if variables_total else 0} have is_meme property")
            print(f"Lists: {lists_with_meme['count'] if lists_with_meme else 0} / {lists_total['count'] if lists_total else 0} have is_meme property")
            
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
    print("🚀 Starting is_meme property migration...")
    print("⚠️  This will add is_meme = False to all Objects, Variables, and Lists")
    print("⚠️  This is safe and will not modify existing data\n")
    
    add_is_meme_property()

