#!/usr/bin/env python3
"""
Script to fix avatar nodes with multiple Being relationships.

This script:
1. Identifies all avatar nodes that have more than one HAS_AVATAR relationship from different Being nodes
2. For each such avatar, keeps only one relationship (the first one found) and deletes the rest
3. Verifies that each avatar now has exactly one Being relationship

Run this script on dev or production to fix the data integrity issue.
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

def find_avatars_with_multiple_beings(driver):
    """Find all avatars that have multiple Being relationships"""
    with driver.session() as session:
        result = session.run("""
            MATCH (b:Being)-[r:HAS_AVATAR]->(a:Avatar)
            WITH a, collect({being: b.name, relationship: r}) as relationships
            WHERE size(relationships) > 1
            RETURN a.name as avatar_name, 
                   a.id as avatar_id,
                   relationships,
                   size(relationships) as relationship_count
            ORDER BY avatar_name
        """)
        
        avatars_with_issues = []
        for record in result:
            avatar_name = record["avatar_name"]
            avatar_id = record.get("avatar_id")
            relationships = record["relationships"]
            count = record["relationship_count"]
            
            beings = [rel["being"] for rel in relationships]
            avatars_with_issues.append({
                "avatar_name": avatar_name,
                "avatar_id": avatar_id,
                "beings": beings,
                "count": count,
                "relationships": relationships
            })
        
        return avatars_with_issues

def fix_avatar_relationships(driver, dry_run=True):
    """Fix avatar relationships by keeping only one Being relationship per avatar"""
    avatars_with_issues = find_avatars_with_multiple_beings(driver)
    
    if not avatars_with_issues:
        print("✅ No avatars with multiple Being relationships found. Database is clean!")
        return
    
    print(f"\n🔍 Found {len(avatars_with_issues)} avatar(s) with multiple Being relationships:\n")
    
    for issue in avatars_with_issues:
        print(f"  Avatar: '{issue['avatar_name']}'" + (f" (ID: {issue['avatar_id']})" if issue['avatar_id'] else ""))
        print(f"  Has relationships from {issue['count']} Being(s): {', '.join(issue['beings'])}")
    
    if dry_run:
        print("\n⚠️  DRY RUN MODE - No changes will be made")
        print("   Run with --execute to apply fixes")
        return
    
    print("\n🔧 Fixing relationships...")
    
    with driver.session() as session:
        fixed_count = 0
        
        for issue in avatars_with_issues:
            avatar_name = issue["avatar_name"]
            avatar_id = issue.get("avatar_id")
            beings = issue["beings"]
            
            # Keep the first being, delete relationships from all others
            being_to_keep = beings[0]
            beings_to_remove = beings[1:]
            
            print(f"\n  Fixing avatar '{avatar_name}':")
            print(f"    Keeping relationship from Being: '{being_to_keep}'")
            print(f"    Removing relationships from Being(s): {', '.join(beings_to_remove)}")
            
            # Delete relationships from beings we don't want to keep
            for being_to_remove in beings_to_remove:
                if avatar_id:
                    # Use ID if available (more precise)
                    result = session.run("""
                        MATCH (b:Being {name: $being_name})-[r:HAS_AVATAR]->(a:Avatar {id: $avatar_id})
                        DELETE r
                        RETURN count(r) as deleted_count
                    """, being_name=being_to_remove, avatar_id=avatar_id)
                else:
                    # Fallback to name matching
                    result = session.run("""
                        MATCH (b:Being {name: $being_name})-[r:HAS_AVATAR]->(a:Avatar {name: $avatar_name})
                        DELETE r
                        RETURN count(r) as deleted_count
                    """, being_name=being_to_remove, avatar_name=avatar_name)
                
                deleted = result.single()["deleted_count"]
                if deleted > 0:
                    print(f"      ✅ Deleted relationship from '{being_to_remove}'")
                    fixed_count += 1
                else:
                    print(f"      ⚠️  No relationship found from '{being_to_remove}' (may have been already deleted)")
        
        print(f"\n✅ Fixed {fixed_count} relationship(s)")
    
    # Verify the fix
    print("\n🔍 Verifying fix...")
    remaining_issues = find_avatars_with_multiple_beings(driver)
    
    if remaining_issues:
        print(f"⚠️  WARNING: {len(remaining_issues)} avatar(s) still have multiple Being relationships:")
        for issue in remaining_issues:
            print(f"  - '{issue['avatar_name']}' still has relationships from: {', '.join(issue['beings'])}")
    else:
        print("✅ Verification passed! All avatars now have exactly one Being relationship.")

def verify_all_avatars(driver):
    """Verify that all avatars have exactly one Being relationship"""
    with driver.session() as session:
        # Get all avatars
        all_avatars_result = session.run("""
            MATCH (a:Avatar)
            RETURN a.name as avatar_name, a.id as avatar_id
            ORDER BY avatar_name
        """)
        
        all_avatars = [(record["avatar_name"], record.get("avatar_id")) for record in all_avatars_result]
        
        print(f"\n🔍 Verifying all {len(all_avatars)} avatar(s)...")
        
        issues_found = []
        for avatar_name, avatar_id in all_avatars:
            if avatar_id:
                result = session.run("""
                    MATCH (b:Being)-[r:HAS_AVATAR]->(a:Avatar {id: $avatar_id})
                    RETURN collect(b.name) as beings, count(r) as relationship_count
                """, avatar_id=avatar_id)
            else:
                result = session.run("""
                    MATCH (b:Being)-[r:HAS_AVATAR]->(a:Avatar {name: $avatar_name})
                    RETURN collect(b.name) as beings, count(r) as relationship_count
                """, avatar_name=avatar_name)
            
            record = result.single()
            beings = record["beings"]
            count = record["relationship_count"]
            
            if count == 0:
                issues_found.append({
                    "avatar": avatar_name,
                    "issue": "No Being relationship",
                    "beings": []
                })
            elif count > 1:
                issues_found.append({
                    "avatar": avatar_name,
                    "issue": f"Multiple Being relationships ({count})",
                    "beings": beings
                })
        
        if issues_found:
            print(f"\n⚠️  Found {len(issues_found)} avatar(s) with issues:")
            for issue in issues_found:
                print(f"  - '{issue['avatar']}': {issue['issue']}")
                if issue['beings']:
                    print(f"    Beings: {', '.join(issue['beings'])}")
        else:
            print("✅ All avatars have exactly one Being relationship!")

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Fix avatar nodes with multiple Being relationships')
    parser.add_argument('--execute', action='store_true', help='Actually execute the fixes (default is dry run)')
    parser.add_argument('--verify-only', action='store_true', help='Only verify, do not fix')
    args = parser.parse_args()
    
    try:
        driver = get_driver()
        
        if args.verify_only:
            verify_all_avatars(driver)
        else:
            dry_run = not args.execute
            fix_avatar_relationships(driver, dry_run=dry_run)
            
            if args.execute:
                verify_all_avatars(driver)
        
        driver.close()
        print("\n✅ Script completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
