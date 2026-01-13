#!/usr/bin/env python3
"""
Script to update relationship counts for all objects in Neo4j.
This script counts all RELATES_TO relationships for each object and updates
the 'relationships' property on the object node.

IMPORTANT: This script is designed for PRODUCTION use.
Make sure you have the correct environment variables set for production Neo4j.

Usage:
    python update_object_relationship_counts.py [--dry-run]
    
    --dry-run: Show what would be updated without making changes
"""

import os
import sys
from neo4j import GraphDatabase
from dotenv import load_dotenv

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

def update_relationship_counts(dry_run=True):
    """
    Count all RELATES_TO relationships for each object and update the 'relationships' property.
    
    Args:
        dry_run: If True, only show what would be updated without making changes
    """
    driver = get_driver()
    
    try:
        with driver.session() as session:
            # Get all objects with their current relationship counts
            print("\n📊 Fetching all objects and their relationship counts...")
            print("   Using the same Cypher query you run directly in Neo4j...")
            
            # Use the EXACT same query the user provided - this counts relationships correctly
            result = session.run("""
                MATCH (o:Object)
                OPTIONAL MATCH (o)-[r:RELATES_TO]->(other:Object)
                RETURN o.id as object_id, 
                       o.object as object_name,
                       COALESCE(o.relationships, 0) as current_count,
                       count(r) as actual_count
                ORDER BY o.object
            """)
            
            objects_to_update = []
            total_objects = 0
            objects_needing_update = 0
            
            # Debug: Show some examples of stored vs actual
            print("\n🔍 Debug: Checking first 10 objects to see stored vs actual counts...")
            debug_shown = 0
            
            for record in result:
                total_objects += 1
                object_id = record["object_id"]
                object_name = record["object_name"]
                current_count = int(record["current_count"] or 0)
                actual_count = int(record["actual_count"] or 0)
                
                # Show first 10 for debugging
                if debug_shown < 10:
                    print(f"   {object_name}: stored={current_count}, actual={actual_count}")
                    debug_shown += 1
                
                # Compare stored count (from UI) vs actual count (from Neo4j query)
                if current_count != actual_count:
                    objects_needing_update += 1
                    objects_to_update.append({
                        "id": object_id,
                        "name": object_name,
                        "current": current_count,
                        "actual": actual_count
                    })
            
            print(f"\n📈 Summary:")
            print(f"   Total objects: {total_objects}")
            print(f"   Objects needing update: {objects_needing_update}")
            
            if objects_needing_update == 0:
                print("\n✅ All relationship counts are already correct!")
                return
            
            # Show what will be updated
            if objects_to_update:
                print(f"\n📋 Objects that will be updated:")
                print(f"   (Current = stored 'o.relationships' property, Actual = count from Neo4j query)")
                # Sort by difference to show biggest discrepancies first
                objects_to_update.sort(key=lambda x: abs(x['current'] - x['actual']), reverse=True)
                for obj in objects_to_update[:50]:  # Show first 50
                    print(f"   {obj['name']}: {obj['current']} → {obj['actual']} (diff: {obj['current'] - obj['actual']})")
                if len(objects_to_update) > 50:
                    print(f"   ... and {len(objects_to_update) - 50} more")
            
            # Also check if there are objects with very high stored counts
            print(f"\n🔍 Checking for objects with unusually high stored relationship counts...")
            high_count_result = session.run("""
                MATCH (o:Object)
                WHERE o.relationships IS NOT NULL AND o.relationships > 200
                RETURN o.object as object_name, o.relationships as stored_count
                ORDER BY o.relationships DESC
                LIMIT 20
            """)
            
            high_count_objects = []
            for record in high_count_result:
                high_count_objects.append({
                    "name": record["object_name"],
                    "stored": record["stored_count"]
                })
            
            if high_count_objects:
                print(f"   Found {len(high_count_objects)} objects with stored count > 200:")
                for obj in high_count_objects:
                    # Get actual count for these objects
                    actual_result = session.run("""
                        MATCH (o:Object {object: $object_name})
                        OPTIONAL MATCH (o)-[r:RELATES_TO]->(other:Object)
                        RETURN count(r) as actual_count
                    """, object_name=obj["name"]).single()
                    actual = actual_result["actual_count"] if actual_result else 0
                    print(f"   {obj['name']}: stored={obj['stored']}, actual={actual}")
            else:
                print("   No objects found with stored count > 200")
            
            # Also check what the get_objects endpoint would return (calculated count)
            print(f"\n🔍 Verifying: What does the get_objects endpoint calculate? (first 5 objects)")
            calc_result = session.run("""
                MATCH (o:Object)
                OPTIONAL MATCH (o)-[r:RELATES_TO]->(other:Object)
                WITH o, count(r) as relationships_count
                RETURN o.object as object_name, 
                       COALESCE(o.relationships, 0) as stored_property,
                       relationships_count as calculated_count
                ORDER BY o.object
                LIMIT 5
            """)
            for record in calc_result:
                print(f"   {record['object_name']}: stored={record['stored_property']}, calculated={record['calculated_count']}")
            
            # Show some examples of objects that are correct (for verification)
            if objects_needing_update < total_objects:
                print(f"\n✅ Sample objects with correct counts (showing first 5):")
                correct_count = 0
                result2 = session.run("""
                    MATCH (o:Object)
                    OPTIONAL MATCH (o)-[r:RELATES_TO]->(other:Object)
                    WITH o, COALESCE(o.relationships, 0) as current_count, count(r) as actual_count
                    WHERE current_count = actual_count
                    RETURN o.object as object_name, current_count, actual_count
                    ORDER BY o.object
                    LIMIT 5
                """)
                for record in result2:
                    print(f"   {record['object_name']}: {record['current_count']} (correct)")
            
            if dry_run:
                print("\n🔍 DRY RUN MODE - No changes will be made")
                print("   Run without --dry-run to apply changes")
                return
            
            # Confirm before proceeding
            print(f"\n⚠️  About to update {objects_needing_update} objects")
            response = input("   Continue? (yes/no): ")
            if response.lower() not in ['yes', 'y']:
                print("   Cancelled.")
                return
            
            # Update relationship counts
            print("\n🔄 Updating relationship counts...")
            updated_count = 0
            errors = []
            
            for obj in objects_to_update:
                try:
                    session.run("""
                        MATCH (o:Object {id: $object_id})
                        SET o.relationships = $count
                    """, object_id=obj["id"], count=obj["actual"])
                    updated_count += 1
                    if updated_count % 10 == 0:
                        print(f"   Updated {updated_count}/{objects_needing_update} objects...")
                except Exception as e:
                    error_msg = f"Error updating {obj['name']} ({obj['id']}): {str(e)}"
                    errors.append(error_msg)
                    print(f"   ❌ {error_msg}")
            
            print(f"\n✅ Update complete!")
            print(f"   Successfully updated: {updated_count} objects")
            if errors:
                print(f"   Errors: {len(errors)}")
                for error in errors[:5]:
                    print(f"      {error}")
                if len(errors) > 5:
                    print(f"      ... and {len(errors) - 5} more errors")
            
            # Verify the update
            print("\n🔍 Verifying updates...")
            verification_result = session.run("""
                MATCH (o:Object)
                OPTIONAL MATCH (o)-[r:RELATES_TO]->(other:Object)
                WITH o, count(r) as actual_count
                WHERE o.relationships <> actual_count
                RETURN count(o) as mismatched_count
            """).single()
            
            mismatched = verification_result["mismatched_count"] if verification_result else 0
            if mismatched == 0:
                print("   ✅ All relationship counts are now correct!")
            else:
                print(f"   ⚠️  Warning: {mismatched} objects still have mismatched counts")
                
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        driver.close()
        print("\n🔌 Connection closed")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Update relationship counts for all objects")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be updated without making changes"
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Object Relationship Count Update Script")
    print("=" * 60)
    
    update_relationship_counts(dry_run=args.dry_run)
    
    print("\n" + "=" * 60)
    print("Script completed")
    print("=" * 60)

