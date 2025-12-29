#!/usr/bin/env python3
"""
Script to automatically identify and set is_meme property based on naming pattern.
Objects and Variables whose names start with "[[" and end with "]]" are considered memes.

Usage:
    python identify_memes.py

This script:
1. Connects to Neo4j using environment variables from .env.dev (dev) or Render env vars (prod)
2. Finds all Object and Variable nodes
3. Checks if their names match the pattern: starts with "[[" and ends with "]]"
4. Sets is_meme = true for matches, false for non-matches
5. Reports the number of nodes updated

This can be run on Render after deployment by:
1. SSH into the Render service, OR
2. Add it as a build command, OR
3. Run it via Render's shell/console feature
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

def is_meme_name(name):
    """Check if a name matches the meme pattern: starts with '[[' and ends with ']]'"""
    if not name:
        return False
    name_str = str(name).strip()
    return name_str.startswith("[[") and name_str.endswith("]]")

def identify_memes():
    """Identify and set is_meme property based on naming pattern"""
    driver = get_driver()
    
    try:
        with driver.session() as session:
            print("\n" + "="*60)
            print("Identifying memes based on naming pattern: [[...]]")
            print("="*60 + "\n")
            
            # Process Objects
            print("Processing Objects...")
            objects_result = session.run("""
                MATCH (o:Object)
                RETURN o.id as id, o.object as name
            """)
            
            objects_processed = 0
            objects_set_to_meme = 0
            objects_set_to_not_meme = 0
            
            for record in objects_result:
                obj_id = record["id"]
                obj_name = record["name"]
                is_meme = is_meme_name(obj_name)
                
                session.run("""
                    MATCH (o:Object {id: $id})
                    SET o.is_meme = $is_meme
                """, id=obj_id, is_meme=is_meme)
                
                objects_processed += 1
                if is_meme:
                    objects_set_to_meme += 1
                else:
                    objects_set_to_not_meme += 1
            
            print(f"  ✅ Processed {objects_processed} Objects")
            print(f"     - Set is_meme = true: {objects_set_to_meme}")
            print(f"     - Set is_meme = false: {objects_set_to_not_meme}")
            
            # Process Variables
            print("\nProcessing Variables...")
            variables_result = session.run("""
                MATCH (v:Variable)
                RETURN v.id as id, v.name as name
            """)
            
            variables_processed = 0
            variables_set_to_meme = 0
            variables_set_to_not_meme = 0
            
            for record in variables_result:
                var_id = record["id"]
                var_name = record["name"]
                is_meme = is_meme_name(var_name)
                
                session.run("""
                    MATCH (v:Variable {id: $id})
                    SET v.is_meme = $is_meme
                """, id=var_id, is_meme=is_meme)
                
                variables_processed += 1
                if is_meme:
                    variables_set_to_meme += 1
                else:
                    variables_set_to_not_meme += 1
            
            print(f"  ✅ Processed {variables_processed} Variables")
            print(f"     - Set is_meme = true: {variables_set_to_meme}")
            print(f"     - Set is_meme = false: {variables_set_to_not_meme}")
            
            # Verification
            print("\n" + "-"*60)
            print("Verification:")
            print("-"*60)
            
            objects_meme_count = session.run("""
                MATCH (o:Object)
                WHERE o.is_meme = true
                RETURN count(o) as count
            """).single()
            
            variables_meme_count = session.run("""
                MATCH (v:Variable)
                WHERE v.is_meme = true
                RETURN count(v) as count
            """).single()
            
            print(f"Objects with is_meme = true: {objects_meme_count['count'] if objects_meme_count else 0}")
            print(f"Variables with is_meme = true: {variables_meme_count['count'] if variables_meme_count else 0}")
            
            print("\n" + "="*60)
            print("✅ Meme identification completed successfully!")
            print("="*60 + "\n")
            
    except Exception as e:
        print(f"\n❌ Error during meme identification: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        driver.close()
        print("Neo4j connection closed")

if __name__ == "__main__":
    print("🚀 Starting meme identification script...")
    print("📋 Pattern: Names starting with '[[' and ending with ']]' are memes")
    print("⚠️  This will update is_meme property for all Objects and Variables\n")
    
    identify_memes()

