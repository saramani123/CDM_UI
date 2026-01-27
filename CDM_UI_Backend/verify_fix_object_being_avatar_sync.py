#!/usr/bin/env python3
"""
Script to verify and fix Object node properties to match Neo4j relationships.

This script:
1. Checks all Object nodes and verifies their 'being' and 'avatar' properties match the actual graph relationships
2. For each Object, finds its Being and Avatar through: Object <-[:HAS_OBJECT]- Avatar <-[:HAS_AVATAR]- Being
3. Updates Object properties if they don't match
4. Reports any Objects that have no Being/Avatar relationships

Run this script on DEV to ensure data consistency.
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

def find_objects_with_mismatched_properties(driver):
    """Find all Objects where properties don't match graph relationships"""
    with driver.session() as session:
        # Get all objects with their relationships
        result = session.run("""
            MATCH (o:Object)
            OPTIONAL MATCH (a:Avatar)-[:HAS_OBJECT]->(o)
            OPTIONAL MATCH (b:Being)-[:HAS_AVATAR]->(a)
            RETURN o.id as object_id,
                   o.name as object_name,
                   o.being as stored_being,
                   o.avatar as stored_avatar,
                   b.name as actual_being,
                   a.name as actual_avatar,
                   a.id as actual_avatar_id
            ORDER BY object_name
        """)
        
        mismatches = []
        objects_without_relationships = []
        
        for record in result:
            object_id = record["object_id"]
            object_name = record["object_name"]
            stored_being = record.get("stored_being")
            stored_avatar = record.get("stored_avatar")
            actual_being = record.get("actual_being")
            actual_avatar = record.get("actual_avatar")
            actual_avatar_id = record.get("actual_avatar_id")
            
            if actual_being is None or actual_avatar is None:
                # Object has no Being/Avatar relationships
                objects_without_relationships.append({
                    "object_id": object_id,
                    "object_name": object_name,
                    "stored_being": stored_being,
                    "stored_avatar": stored_avatar
                })
            elif stored_being != actual_being or stored_avatar != actual_avatar:
                # Properties don't match relationships
                mismatches.append({
                    "object_id": object_id,
                    "object_name": object_name,
                    "stored_being": stored_being,
                    "stored_avatar": stored_avatar,
                    "actual_being": actual_being,
                    "actual_avatar": actual_avatar,
                    "actual_avatar_id": actual_avatar_id
                })
        
        return mismatches, objects_without_relationships

def fix_object_properties(driver, dry_run=True):
    """Fix Object properties to match graph relationships"""
    mismatches, objects_without_relationships = find_objects_with_mismatched_properties(driver)
    
    if objects_without_relationships:
        print(f"\n⚠️  Found {len(objects_without_relationships)} object(s) with no Being/Avatar relationships:")
        for obj in objects_without_relationships:
            print(f"  - Object '{obj['object_name']}' (ID: {obj['object_id']})")
            print(f"    Stored: Being='{obj['stored_being']}', Avatar='{obj['stored_avatar']}'")
        print("  These objects need manual attention - they have no graph relationships.\n")
    
    if not mismatches:
        print("✅ No mismatches found! All Object properties match their graph relationships.")
        return
    
    print(f"\n🔍 Found {len(mismatches)} object(s) with mismatched properties:\n")
    
    for mismatch in mismatches:
        print(f"  Object: '{mismatch['object_name']}' (ID: {mismatch['object_id']})")
        print(f"    Stored:  Being='{mismatch['stored_being']}', Avatar='{mismatch['stored_avatar']}'")
        print(f"    Actual:  Being='{mismatch['actual_being']}', Avatar='{mismatch['actual_avatar']}'")
    
    if dry_run:
        print("\n⚠️  DRY RUN MODE - No changes will be made")
        print("   Run with --execute to apply fixes")
        return
    
    print("\n🔧 Fixing object properties...")
    
    with driver.session() as session:
        fixed_count = 0
        
        for mismatch in mismatches:
            object_id = mismatch["object_id"]
            object_name = mismatch["object_name"]
            actual_being = mismatch["actual_being"]
            actual_avatar = mismatch["actual_avatar"]
            
            result = session.run("""
                MATCH (o:Object {id: $object_id})
                SET o.being = $being,
                    o.avatar = $avatar
                RETURN o.name as object_name
            """, object_id=object_id, being=actual_being, avatar=actual_avatar)
            
            updated = result.single()
            if updated:
                print(f"  ✅ Updated '{object_name}': Being='{actual_being}', Avatar='{actual_avatar}'")
                fixed_count += 1
        
        print(f"\n✅ Fixed {fixed_count} object(s)")
    
    # Verify the fix
    print("\n🔍 Verifying fix...")
    remaining_mismatches, _ = find_objects_with_mismatched_properties(driver)
    
    if remaining_mismatches:
        print(f"⚠️  WARNING: {len(remaining_mismatches)} object(s) still have mismatched properties")
    else:
        print("✅ Verification passed! All Object properties now match their graph relationships.")

def find_orphaned_avatars(driver):
    """Find Avatar nodes that have no Being relationships or incorrect being property"""
    with driver.session() as session:
        # Find avatars with no Being relationships
        no_relationship_result = session.run("""
            MATCH (a:Avatar)
            WHERE NOT EXISTS((:Being)-[:HAS_AVATAR]->(a))
            RETURN a.name as avatar_name, a.id as avatar_id, a.being as avatar_being
            ORDER BY avatar_name
        """)
        
        orphaned = []
        for record in no_relationship_result:
            orphaned.append({
                "avatar_name": record["avatar_name"],
                "avatar_id": record.get("avatar_id"),
                "avatar_being": record.get("avatar_being"),
                "issue": "No Being relationship"
            })
        
        # Find avatars where being property doesn't match actual relationship
        mismatched_being_result = session.run("""
            MATCH (b:Being)-[:HAS_AVATAR]->(a:Avatar)
            WHERE a.being IS NOT NULL AND a.being <> b.name
            RETURN a.name as avatar_name, a.id as avatar_id, a.being as stored_being, b.name as actual_being
            ORDER BY avatar_name
        """)
        
        for record in mismatched_being_result:
            orphaned.append({
                "avatar_name": record["avatar_name"],
                "avatar_id": record.get("avatar_id"),
                "avatar_being": record.get("stored_being"),
                "actual_being": record.get("actual_being"),
                "issue": "Being property mismatch"
            })
        
        return orphaned

def verify_all_objects(driver):
    """Verify that all Objects have correct properties"""
    mismatches, objects_without_relationships = find_objects_with_mismatched_properties(driver)
    orphaned_avatars = find_orphaned_avatars(driver)
    
    total_objects_result = driver.session().run("MATCH (o:Object) RETURN count(o) as total")
    total_objects = total_objects_result.single()["total"]
    
    print(f"\n🔍 Verifying all {total_objects} object(s)...")
    
    if objects_without_relationships:
        print(f"\n⚠️  Found {len(objects_without_relationships)} object(s) with no Being/Avatar relationships:")
        for obj in objects_without_relationships[:10]:  # Show first 10
            print(f"  - '{obj['object_name']}' (ID: {obj['object_id']})")
        if len(objects_without_relationships) > 10:
            print(f"  ... and {len(objects_without_relationships) - 10} more")
    
    if mismatches:
        print(f"\n⚠️  Found {len(mismatches)} object(s) with mismatched properties:")
        for mismatch in mismatches[:10]:  # Show first 10
            print(f"  - '{mismatch['object_name']}': Stored Being='{mismatch['stored_being']}', Actual Being='{mismatch['actual_being']}'")
        if len(mismatches) > 10:
            print(f"  ... and {len(mismatches) - 10} more")
    
    if orphaned_avatars:
        print(f"\n⚠️  Found {len(orphaned_avatars)} avatar(s) with issues:")
        for avatar in orphaned_avatars[:10]:  # Show first 10
            if avatar["issue"] == "No Being relationship":
                print(f"  - '{avatar['avatar_name']}': {avatar['issue']} (stored being: '{avatar['avatar_being']}')")
            else:
                print(f"  - '{avatar['avatar_name']}': {avatar['issue']} (stored: '{avatar['avatar_being']}', actual: '{avatar['actual_being']}')")
        if len(orphaned_avatars) > 10:
            print(f"  ... and {len(orphaned_avatars) - 10} more")
    
    if not mismatches and not objects_without_relationships and not orphaned_avatars:
        print("✅ All objects have correct properties matching their graph relationships!")
    elif not mismatches and not orphaned_avatars:
        print("✅ All objects with relationships have correct properties!")
    else:
        print(f"\n⚠️  Total issues: {len(mismatches)} mismatches, {len(objects_without_relationships)} without relationships, {len(orphaned_avatars)} orphaned avatars")

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Verify and fix Object properties to match Neo4j relationships')
    parser.add_argument('--execute', action='store_true', help='Actually execute the fixes (default is dry run)')
    parser.add_argument('--verify-only', action='store_true', help='Only verify, do not fix')
    args = parser.parse_args()
    
    try:
        driver = get_driver()
        
        if args.verify_only:
            verify_all_objects(driver)
            # Also show orphaned avatars
            orphaned = find_orphaned_avatars(driver)
            if orphaned:
                print(f"\n📋 Orphaned Avatar Summary:")
                print(f"   Total: {len(orphaned)}")
                for avatar in orphaned[:5]:
                    print(f"   - {avatar['avatar_name']}: {avatar['issue']}")
        else:
            dry_run = not args.execute
            fix_object_properties(driver, dry_run=dry_run)
            
            if args.execute:
                verify_all_objects(driver)
        
        driver.close()
        print("\n✅ Script completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
