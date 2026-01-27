#!/usr/bin/env python3
"""
Script to clean up PLACEHOLDER groups and variables from Neo4j.

This script:
1. Finds all Group nodes with names starting with '__PLACEHOLDER_'
2. Finds all Variable nodes with names starting with '__PLACEHOLDER_'
3. Deletes these nodes and their relationships
4. Verifies cleanup

Run this script on dev and prod to remove unwanted placeholder data.
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

def find_placeholder_groups_and_variables(driver):
    """Find all PLACEHOLDER groups and variables"""
    with driver.session() as session:
        # Find PLACEHOLDER groups
        groups_result = session.run("""
            MATCH (g:Group)
            WHERE g.name STARTS WITH '__PLACEHOLDER_'
            RETURN g.name as name, g.id as id
            ORDER BY g.name
        """)
        
        placeholder_groups = []
        for record in groups_result:
            placeholder_groups.append({
                "name": record["name"],
                "id": record.get("id")
            })
        
        # Find PLACEHOLDER variables
        variables_result = session.run("""
            MATCH (v:Variable)
            WHERE v.name STARTS WITH '__PLACEHOLDER_'
            RETURN v.name as name, v.id as id, v.section as section
            ORDER BY v.name
        """)
        
        placeholder_variables = []
        for record in variables_result:
            placeholder_variables.append({
                "name": record["name"],
                "id": record.get("id"),
                "section": record.get("section")
            })
        
        return placeholder_groups, placeholder_variables

def cleanup_placeholders(driver, dry_run=True):
    """Clean up PLACEHOLDER groups and variables"""
    placeholder_groups, placeholder_variables = find_placeholder_groups_and_variables(driver)
    
    if not placeholder_groups and not placeholder_variables:
        print("✅ No PLACEHOLDER groups or variables found. Database is clean!")
        return
    
    print(f"🔍 Found {len(placeholder_groups)} PLACEHOLDER group(s) and {len(placeholder_variables)} PLACEHOLDER variable(s):\n")
    
    if placeholder_groups:
        print("  PLACEHOLDER Groups:")
        for group in placeholder_groups:
            print(f"    - '{group['name']}' (ID: {group.get('id', 'N/A')})")
    
    if placeholder_variables:
        print("\n  PLACEHOLDER Variables:")
        for var in placeholder_variables:
            print(f"    - '{var['name']}' (ID: {var.get('id', 'N/A')}, Section: {var.get('section', 'N/A')})")
    
    if dry_run:
        print("\n⚠️  DRY RUN MODE - No changes will be made")
        print("   Run with --execute to delete these placeholders")
        return
    
    print("\n🔧 Cleaning up PLACEHOLDER nodes...")
    
    with driver.session() as session:
        deleted_groups = 0
        deleted_variables = 0
        
        # Delete PLACEHOLDER variables first (they have relationships)
        for var in placeholder_variables:
            var_id = var.get("id")
            var_name = var["name"]
            
            if var_id:
                result = session.run("""
                    MATCH (v:Variable {id: $var_id})
                    DETACH DELETE v
                    RETURN count(v) as deleted_count
                """, var_id=var_id)
            else:
                result = session.run("""
                    MATCH (v:Variable {name: $var_name})
                    DETACH DELETE v
                    RETURN count(v) as deleted_count
                """, var_name=var_name)
            
            deleted = result.single()["deleted_count"]
            if deleted > 0:
                print(f"  ✅ Deleted variable '{var_name}'")
                deleted_variables += 1
        
        # Delete PLACEHOLDER groups
        for group in placeholder_groups:
            group_id = group.get("id")
            group_name = group["name"]
            
            if group_id:
                result = session.run("""
                    MATCH (g:Group {id: $group_id})
                    DETACH DELETE g
                    RETURN count(g) as deleted_count
                """, group_id=group_id)
            else:
                result = session.run("""
                    MATCH (g:Group {name: $group_name})
                    DETACH DELETE g
                    RETURN count(g) as deleted_count
                """, group_name=group_name)
            
            deleted = result.single()["deleted_count"]
            if deleted > 0:
                print(f"  ✅ Deleted group '{group_name}'")
                deleted_groups += 1
        
        print(f"\n✅ Cleanup completed: {deleted_variables} variable(s) and {deleted_groups} group(s) deleted")
    
    # Verify cleanup
    print("\n🔍 Verifying cleanup...")
    remaining_groups, remaining_variables = find_placeholder_groups_and_variables(driver)
    
    if remaining_groups or remaining_variables:
        print(f"⚠️  WARNING: {len(remaining_groups)} group(s) and {len(remaining_variables)} variable(s) still remain")
    else:
        print("✅ Verification passed! All PLACEHOLDER nodes have been removed.")

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Clean up PLACEHOLDER groups and variables from Neo4j')
    parser.add_argument('--execute', action='store_true', help='Actually delete the placeholders (default is dry run)')
    parser.add_argument('--verify-only', action='store_true', help='Only verify, do not delete')
    args = parser.parse_args()
    
    try:
        driver = get_driver()
        
        if args.verify_only:
            placeholder_groups, placeholder_variables = find_placeholder_groups_and_variables(driver)
            print(f"\n📋 Verification Results:")
            print(f"   PLACEHOLDER Groups: {len(placeholder_groups)}")
            print(f"   PLACEHOLDER Variables: {len(placeholder_variables)}")
            if placeholder_groups or placeholder_variables:
                print("\n⚠️  PLACEHOLDER nodes found - run without --verify-only to see details")
        else:
            dry_run = not args.execute
            cleanup_placeholders(driver, dry_run=dry_run)
        
        driver.close()
        print("\n✅ Script completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
