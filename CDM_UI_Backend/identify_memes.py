#!/usr/bin/env python3
"""
Script to automatically identify and set is_meme property for Variables based on naming pattern.
Variables are considered memes if:
1. Their name starts with "[" and ends with "]" (single brackets), OR
2. Their section property equals "[Meme]"

Usage:
    python identify_memes.py

This script:
1. Connects to Neo4j using environment variables from .env.dev (dev) or Render env vars (prod)
2. Finds all Variable nodes
3. Checks if they match the meme criteria (name pattern or section = "[Meme]")
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

def is_meme_variable(name, section):
    """
    Check if a Variable is a meme based on:
    1. Name starts with "[" and ends with "]" (single brackets), OR
    2. Section equals "[Meme]"
    """
    if not name:
        name_str = ""
    else:
        name_str = str(name).strip()
    
    # Check name pattern: starts with "[" and ends with "]"
    name_is_meme = name_str.startswith("[") and name_str.endswith("]")
    
    # Check section pattern: equals "[Meme]"
    section_is_meme = False
    if section:
        section_str = str(section).strip()
        section_is_meme = section_str == "[Meme]"
    
    return name_is_meme or section_is_meme

def identify_memes():
    """Identify and set is_meme property for Variables based on naming pattern or section"""
    driver = get_driver()
    
    try:
        with driver.session() as session:
            print("\n" + "="*60)
            print("Identifying Variable memes based on:")
            print("  1. Name pattern: starts with '[' and ends with ']'")
            print("  2. Section equals '[Meme]'")
            print("="*60 + "\n")
            
            # Process Variables
            print("Processing Variables...")
            variables_result = session.run("""
                MATCH (v:Variable)
                RETURN v.id as id, v.name as name, v.section as section
            """)
            
            variables_processed = 0
            variables_set_to_meme = 0
            variables_set_to_not_meme = 0
            meme_by_name = 0
            meme_by_section = 0
            
            for record in variables_result:
                var_id = record["id"]
                var_name = record["name"]
                var_section = record.get("section")
                is_meme = is_meme_variable(var_name, var_section)
                
                # Track why it's a meme
                if is_meme:
                    name_str = str(var_name).strip() if var_name else ""
                    if name_str.startswith("[") and name_str.endswith("]"):
                        meme_by_name += 1
                    if var_section and str(var_section).strip() == "[Meme]":
                        meme_by_section += 1
                
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
            print(f"       • By name pattern [...]: {meme_by_name}")
            print(f"       • By section = '[Meme]': {meme_by_section}")
            print(f"     - Set is_meme = false: {variables_set_to_not_meme}")
            
            # Verification
            print("\n" + "-"*60)
            print("Verification:")
            print("-"*60)
            
            variables_meme_count = session.run("""
                MATCH (v:Variable)
                WHERE v.is_meme = true
                RETURN count(v) as count
            """).single()
            
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
    print("🚀 Starting Variable meme identification script...")
    print("📋 Criteria for Variables:")
    print("  1. Name starts with '[' and ends with ']' (single brackets), OR")
    print("  2. Section property equals '[Meme]'")
    print("⚠️  This will update is_meme property for all Variables\n")
    
    identify_memes()

