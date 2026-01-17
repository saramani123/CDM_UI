#!/usr/bin/env python3
"""
Update Object Relationship Counts Script

This script updates the 'relationships' property on each Object node to match
the actual count of RELATES_TO relationships to other Object nodes (including itself).

After running the cleanup script, all objects should have exactly N relationships
(where N = total number of objects). This script ensures the 'relationships' property
on each Object node reflects the actual count in Neo4j.
    
IMPORTANT: This script ONLY updates the 'relationships' property on Object nodes.
It does NOT create, delete, or modify any relationships.
"""

import os
import sys
from dotenv import load_dotenv
from neo4j import GraphDatabase, WRITE_ACCESS

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
    
    return driver

def update_object_relationship_counts():
    """
    Update the 'relationships' property on each Object node to match
    the actual count of RELATES_TO relationships to other Object nodes.
    """
    driver = get_driver()
    
    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            # Get all objects
            print("📋 Fetching all objects...")
            objects_result = session.run("""
                MATCH (o:Object)
                RETURN o.id as id, o.object as object, o.relationships as current_count
                ORDER BY o.object
            """)
            
            objects = [record for record in objects_result]
            total_objects = len(objects)
            
            if total_objects == 0:
                print("❌ No objects found in the database.")
                return
            
            print(f"✅ Found {total_objects} objects")
            print(f"\n🔄 Starting relationship count update...\n")
            
            total_updated = 0
            total_unchanged = 0
            errors = []
            
            # Process each object
            for i, obj in enumerate(objects, 1):
                obj_id = obj["id"]
                obj_name = obj["object"]
                current_count = obj.get("current_count")
                
                # Count actual RELATES_TO relationships to other Object nodes
                count_result = session.run("""
                    MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object)
                    RETURN count(r) as count
                """, source_id=obj_id).single()
                
                actual_count = count_result["count"] if count_result else 0
                
                # Update the relationships property if it doesn't match
                if current_count != actual_count:
                    session.run("""
                        MATCH (o:Object {id: $object_id})
                        SET o.relationships = $count
                    """, object_id=obj_id, count=actual_count)
                    total_updated += 1
                    print(f"[{i}/{total_objects}] {obj_name}: Updated {current_count} → {actual_count}")
                else:
                    total_unchanged += 1
                    if actual_count != total_objects:
                        print(f"[{i}/{total_objects}] {obj_name}: Count is {actual_count} (expected {total_objects}) ⚠️")
                    else:
                        print(f"[{i}/{total_objects}] {obj_name}: Count is {actual_count} ✓")
            
            print(f"\n{'='*60}")
            print(f"📊 Update Summary:")
            print(f"  🔧 Objects updated: {total_updated}")
            print(f"  ✓ Objects unchanged: {total_unchanged}")
            print(f"  📦 Total objects processed: {total_objects}")
            print(f"  🎯 Expected count per object: {total_objects}")
            print(f"{'='*60}\n")
            
            # Final verification: Check all objects have correct counts
            print("🔍 Final verification...")
            verification_errors = []
            correct_count = 0
            
            for obj in objects:
                obj_id = obj["id"]
                obj_name = obj["object"]
                
                # Get the updated count from the node property
                node_result = session.run("""
                    MATCH (o:Object {id: $object_id})
                    RETURN o.relationships as count
                """, object_id=obj_id).single()
                
                stored_count = node_result["count"] if node_result else None
                
                # Count actual relationships
                count_result = session.run("""
                    MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object)
                    RETURN count(r) as count
                """, source_id=obj_id).single()
                
                actual_count = count_result["count"] if count_result else 0
                
                if stored_count != actual_count:
                    verification_errors.append(f"{obj_name}: stored={stored_count}, actual={actual_count}")
                elif actual_count == total_objects:
                    correct_count += 1
                else:
                    verification_errors.append(f"{obj_name}: count={actual_count} (expected {total_objects})")
            
            if verification_errors:
                print(f"❌ Verification failed for {len(verification_errors)} objects:")
                for error in verification_errors[:10]:  # Show first 10 errors
                    print(f"  - {error}")
                if len(verification_errors) > 10:
                    print(f"  ... and {len(verification_errors) - 10} more")
            else:
                print(f"✅ All {total_objects} objects have correct relationship counts!")
                print(f"✅ All objects have exactly {total_objects} relationships")
                print(f"✅ All 'relationships' properties match actual counts")
            
            print(f"\n📈 Statistics:")
            print(f"  ✓ Objects with correct count ({total_objects}): {correct_count}")
            print(f"  ⚠️  Objects with incorrect count: {len(verification_errors)}")
                
    except Exception as e:
        print(f"❌ Error during update: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        driver.close()
        print("\n🔌 Database connection closed")

if __name__ == "__main__":
    print("="*60)
    print("🔢 Object Relationship Counts Update Script")
    print("="*60)
    print("\n⚠️  This script will update the 'relationships' property on Object nodes")
    print("   to match the actual count of RELATES_TO relationships.")
    print("\n   This script ONLY updates node properties.")
    print("   It does NOT create, delete, or modify any relationships.\n")
    
    # Confirm before proceeding
    environment = os.getenv("ENVIRONMENT", "development")
    instance_name = os.getenv("NEO4J_INSTANCE_NAME", "unknown")
    
    print(f"📍 Environment: {environment}")
    print(f"📍 Instance: {instance_name}\n")
    
    if environment == "production":
        response = input("⚠️  You are about to modify PRODUCTION data. Type 'YES' to continue: ")
        if response != "YES":
            print("❌ Aborted.")
            sys.exit(0)
    else:
        response = input("Continue with update? (yes/no): ")
        if response.lower() not in ["yes", "y"]:
            print("❌ Aborted.")
            sys.exit(0)
    
    print("\n🚀 Starting update...\n")
    update_object_relationship_counts()
    print("\n✅ Update complete!")
