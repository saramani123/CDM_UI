#!/usr/bin/env python3
"""
Script to fix group nodes with multiple Part relationships.

This script:
1. Identifies all group nodes that have more than one HAS_GROUP relationship from different Part nodes
2. For each such group, keeps only one relationship (the first one found) and deletes the rest
3. Verifies that each group now has exactly one Part relationship

Run this script on DEV to fix the data integrity issue.
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
            print(f"✅ Connected to Neo4j successfully!")
    
    return driver

def find_groups_with_multiple_parts(driver):
    """Find all groups that have multiple Part relationships"""
    with driver.session() as session:
        result = session.run("""
            MATCH (p:Part)-[r:HAS_GROUP]->(g:Group)
            WITH g, collect({part: p.name, relationship: r}) as relationships
            WHERE size(relationships) > 1
            RETURN g.name as group_name, 
                   g.id as group_id,
                   relationships,
                   size(relationships) as relationship_count
            ORDER BY group_name
        """)
        
        groups_with_issues = []
        for record in result:
            group_name = record["group_name"]
            group_id = record.get("group_id")
            relationships = record["relationships"]
            count = record["relationship_count"]
            
            parts = [rel["part"] for rel in relationships]
            groups_with_issues.append({
                "group_name": group_name,
                "group_id": group_id,
                "parts": parts,
                "count": count,
                "relationships": relationships
            })
        
        return groups_with_issues

def fix_group_relationships(driver, dry_run=True):
    """Fix group relationships by keeping only one Part relationship per group"""
    groups_with_issues = find_groups_with_multiple_parts(driver)
    
    if not groups_with_issues:
        print("✅ No groups with multiple Part relationships found. Database is clean!")
        return
    
    print(f"\n🔍 Found {len(groups_with_issues)} group(s) with multiple Part relationships:\n")
    
    for issue in groups_with_issues:
        print(f"  Group: '{issue['group_name']}'" + (f" (ID: {issue['group_id']})" if issue['group_id'] else ""))
        print(f"  Has relationships from {issue['count']} Part(s): {', '.join(issue['parts'])}")
    
    if dry_run:
        print("\n⚠️  DRY RUN MODE - No changes will be made")
        print("   Run with --execute to apply fixes")
        return
    
    print("\n🔧 Fixing relationships...")
    
    with driver.session() as session:
        fixed_count = 0
        
        for issue in groups_with_issues:
            group_name = issue["group_name"]
            group_id = issue.get("group_id")
            parts = issue["parts"]
            
            # Keep the first part, delete relationships from all others
            part_to_keep = parts[0]
            parts_to_remove = parts[1:]
            
            print(f"\n  Fixing group '{group_name}':")
            print(f"    Keeping relationship from Part: '{part_to_keep}'")
            print(f"    Removing relationships from Part(s): {', '.join(parts_to_remove)}")
            
            # Delete relationships from parts we don't want to keep
            for part_to_remove in parts_to_remove:
                if group_id:
                    # Use ID if available (more precise)
                    result = session.run("""
                        MATCH (p:Part {name: $part_name})-[r:HAS_GROUP]->(g:Group {id: $group_id})
                        DELETE r
                        RETURN count(r) as deleted_count
                    """, part_name=part_to_remove, group_id=group_id)
                else:
                    # Fallback to name matching - just delete the relationship directly
                    # We know this part is in the parts_to_remove list, so it's safe to delete
                    result = session.run("""
                        MATCH (p:Part {name: $part_name})-[r:HAS_GROUP]->(g:Group {name: $group_name})
                        WHERE p.name = $part_name
                        DELETE r
                        RETURN count(r) as deleted_count
                    """, part_name=part_to_remove, group_name=group_name)
                
                deleted = result.single()["deleted_count"]
                if deleted > 0:
                    print(f"      ✅ Deleted relationship from '{part_to_remove}'")
                    fixed_count += 1
                else:
                    print(f"      ⚠️  No relationship found from '{part_to_remove}' (may have been already deleted)")
        
        print(f"\n✅ Fixed {fixed_count} relationship(s)")
    
    # Verify the fix
    print("\n🔍 Verifying fix...")
    remaining_issues = find_groups_with_multiple_parts(driver)
    
    if remaining_issues:
        print(f"⚠️  WARNING: {len(remaining_issues)} group(s) still have multiple Part relationships:")
        for issue in remaining_issues:
            print(f"  - '{issue['group_name']}' still has relationships from: {', '.join(issue['parts'])}")
    else:
        print("✅ Verification passed! All groups now have exactly one Part relationship.")

def verify_all_groups(driver):
    """Verify that all groups have exactly one Part relationship"""
    with driver.session() as session:
        # Get all groups
        all_groups_result = session.run("""
            MATCH (g:Group)
            RETURN g.name as group_name, g.id as group_id
            ORDER BY group_name
        """)
        
        all_groups = [(record["group_name"], record.get("group_id")) for record in all_groups_result]
        
        print(f"\n🔍 Verifying all {len(all_groups)} group(s)...")
        
        issues_found = []
        for group_name, group_id in all_groups:
            if group_id:
                result = session.run("""
                    MATCH (p:Part)-[r:HAS_GROUP]->(g:Group {id: $group_id})
                    RETURN collect(p.name) as parts, count(r) as relationship_count
                """, group_id=group_id)
            else:
                result = session.run("""
                    MATCH (p:Part)-[r:HAS_GROUP]->(g:Group {name: $group_name})
                    RETURN collect(p.name) as parts, count(r) as relationship_count
                """, group_name=group_name)
            
            record = result.single()
            parts = record["parts"]
            count = record["relationship_count"]
            
            if count == 0:
                issues_found.append({
                    "group": group_name,
                    "issue": "No Part relationship",
                    "parts": []
                })
            elif count > 1:
                issues_found.append({
                    "group": group_name,
                    "issue": f"Multiple Part relationships ({count})",
                    "parts": parts
                })
        
        if issues_found:
            print(f"\n⚠️  Found {len(issues_found)} group(s) with issues:")
            for issue in issues_found:
                print(f"  - '{issue['group']}': {issue['issue']}")
                if issue['parts']:
                    print(f"    Parts: {', '.join(issue['parts'])}")
        else:
            print("✅ All groups have exactly one Part relationship!")

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Fix group nodes with multiple Part relationships')
    parser.add_argument('--execute', action='store_true', help='Actually execute the fixes (default is dry run)')
    parser.add_argument('--verify-only', action='store_true', help='Only verify, do not fix')
    args = parser.parse_args()
    
    try:
        driver = get_driver()
        
        if args.verify_only:
            verify_all_groups(driver)
        else:
            dry_run = not args.execute
            fix_group_relationships(driver, dry_run=dry_run)
            
            if args.execute:
                verify_all_groups(driver)
        
        driver.close()
        print("\n✅ Script completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
