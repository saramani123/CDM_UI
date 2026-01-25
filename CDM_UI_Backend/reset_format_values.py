#!/usr/bin/env python3
"""
Migration script to reset formatI and formatII values for all Variables in Neo4j.
This script sets all Variables to default values: formatI = "Freeform", formatII = "Text".

This is necessary because Format V-I and Format V-II are now cascading, and existing
values may not be valid combinations. After running this script, users can update
the values through the UI.

Usage:
    python reset_format_values.py

This script:
1. Connects to Neo4j using environment variables from .env.dev (dev) or Render env vars (prod)
2. Finds all Variable nodes
3. Sets formatI = "Freeform" and formatII = "Text" for all Variables
4. Reports the number of nodes updated

⚠️  WARNING: This will overwrite all existing formatI and formatII values!
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

def reset_format_values():
    """Reset formatI and formatII to default values for all Variables"""
    driver = get_driver()
    
    DEFAULT_FORMAT_I = "Freeform"
    DEFAULT_FORMAT_II = "Text"
    
    try:
        with driver.session() as session:
            print("\n" + "="*60)
            print("Resetting formatI and formatII values for all Variables")
            print("="*60 + "\n")
            
            # Count total Variables
            total_result = session.run("""
                MATCH (v:Variable)
                RETURN count(v) as count
            """).single()
            
            total_variables = total_result["count"] if total_result else 0
            print(f"Found {total_variables} Variables in database")
            
            if total_variables == 0:
                print("\n⚠️  No Variables found in database!")
                return
            
            # Show current distribution of formatI values
            print("\nCurrent formatI distribution:")
            formatI_dist = session.run("""
                MATCH (v:Variable)
                WHERE v.formatI IS NOT NULL
                RETURN v.formatI as formatI, count(v) as count
                ORDER BY count DESC
            """)
            
            for record in formatI_dist:
                print(f"  {record['formatI']}: {record['count']} Variables")
            
            # Show current distribution of formatII values
            print("\nCurrent formatII distribution:")
            formatII_dist = session.run("""
                MATCH (v:Variable)
                WHERE v.formatII IS NOT NULL
                RETURN v.formatII as formatII, count(v) as count
                ORDER BY count DESC
            """)
            
            for record in formatII_dist:
                print(f"  {record['formatII']}: {record['count']} Variables")
            
            # Confirm before proceeding
            print("\n" + "⚠️"*30)
            print(f"⚠️  WARNING: This will set ALL {total_variables} Variables to:")
            print(f"⚠️    formatI = '{DEFAULT_FORMAT_I}'")
            print(f"⚠️    formatII = '{DEFAULT_FORMAT_II}'")
            print("⚠️"*30)
            
            response = input("\nType 'YES' to continue, or anything else to cancel: ")
            if response != "YES":
                print("\n❌ Operation cancelled by user")
                return
            
            # Update all Variables
            print(f"\nUpdating all {total_variables} Variables...")
            update_result = session.run("""
                MATCH (v:Variable)
                SET v.formatI = $formatI, v.formatII = $formatII
                RETURN count(v) as updated
            """, formatI=DEFAULT_FORMAT_I, formatII=DEFAULT_FORMAT_II).single()
            
            updated_count = update_result["updated"] if update_result else 0
            print(f"✅ Updated {updated_count} Variables")
            
            # Verify the updates
            print("\n" + "-"*60)
            print("Verification:")
            print("-"*60)
            
            # Count Variables with new values
            verify_result = session.run("""
                MATCH (v:Variable)
                WHERE v.formatI = $formatI AND v.formatII = $formatII
                RETURN count(v) as count
            """, formatI=DEFAULT_FORMAT_I, formatII=DEFAULT_FORMAT_II).single()
            
            verified_count = verify_result["count"] if verify_result else 0
            print(f"Variables with formatI='{DEFAULT_FORMAT_I}' and formatII='{DEFAULT_FORMAT_II}': {verified_count}")
            
            if verified_count == total_variables:
                print(f"✅ All {total_variables} Variables have been successfully updated!")
            else:
                print(f"⚠️  Warning: Expected {total_variables} Variables, but found {verified_count} with the new values")
            
            print("\n" + "="*60)
            print("✅ Migration completed successfully!")
            print("="*60)
            print(f"\nNext steps:")
            print(f"1. Users can now update Format V-I and Format V-II values through the UI")
            print(f"2. Format V-II values will be filtered based on Format V-I selection")
            print(f"3. Valid combinations are enforced by the cascading dropdowns")
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
    print("🚀 Starting formatI/formatII reset migration...")
    print("⚠️  This will reset ALL Variable formatI and formatII values to defaults")
    print("⚠️  Default: formatI = 'Freeform', formatII = 'Text'\n")
    
    reset_format_values()
