#!/usr/bin/env python3
"""
Cleanup Object Relationships Script

This script cleans up object relationships in Neo4j to ensure each object has exactly
one default relationship to every other object (including itself) with:
- Role = source object's name
- Frequency = "Possible" (default)
- Relationship Type = "Inter-Table" (except self-referential which is "Intra-Table")

The script:
1. Loops through each object
2. Checks relationships to other Object nodes (not Being, Avatar, Variables, etc.)
3. Ensures exactly one relationship exists to each object with role = source object name
4. Deletes any relationships with other role names
5. Creates missing default relationships

IMPORTANT: This script ONLY handles RELATES_TO relationships between Object nodes.
It does NOT touch relationships to Being, Avatar, Variables, or any other node types.
"""

import os
import sys
import uuid
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

def cleanup_object_relationships():
    """
    Clean up object relationships to ensure each object has exactly one default
    relationship to every other object (including itself).
    """
    driver = get_driver()
    
    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            # Get all objects
            print("📋 Fetching all objects...")
            objects_result = session.run("""
                MATCH (o:Object)
                RETURN o.id as id, o.object as object, o.being as being, o.avatar as avatar
                ORDER BY o.object
            """)
            
            objects = [record for record in objects_result]
            total_objects = len(objects)
            
            if total_objects == 0:
                print("❌ No objects found in the database.")
                return
            
            print(f"✅ Found {total_objects} objects")
            print(f"\n🔄 Starting cleanup process...\n")
            
            # Create a map of object IDs to object names for quick lookup
            object_map = {obj["id"]: obj for obj in objects}
            
            total_created = 0
            total_deleted = 0
            total_updated = 0
            
            # Process each object
            for i, source_obj in enumerate(objects, 1):
                source_id = source_obj["id"]
                source_object_name = source_obj["object"]
                source_being = source_obj.get("being", "ALL")
                source_avatar = source_obj.get("avatar", "ALL")
                
                print(f"[{i}/{total_objects}] Processing: {source_object_name} (ID: {source_id})")
                
                # Get all RELATES_TO relationships from this object to other Object nodes
                relationships_result = session.run("""
                    MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object)
                    RETURN r.id as rel_id, r.role as role, r.type as type, r.frequency as frequency,
                           target.id as target_id, target.object as target_object, 
                           target.being as target_being, target.avatar as target_avatar
                    ORDER BY target.object
                """, source_id=source_id)
                
                existing_relationships = {}
                for rel in relationships_result:
                    target_id = rel["target_id"]
                    role = rel["role"]
                    
                    if target_id not in existing_relationships:
                        existing_relationships[target_id] = []
                    
                    existing_relationships[target_id].append({
                        "rel_id": rel["rel_id"],
                        "role": role,
                        "type": rel.get("type"),
                        "frequency": rel.get("frequency"),
                        "target_object": rel["target_object"]
                    })
                
                # Process each target object
                for target_obj in objects:
                    target_id = target_obj["id"]
                    target_object_name = target_obj["object"]
                    target_being = target_obj.get("being", "ALL")
                    target_avatar = target_obj.get("avatar", "ALL")
                    
                    # Determine relationship type
                    is_self = source_id == target_id
                    expected_type = "Intra-Table" if is_self else "Inter-Table"
                    expected_frequency = "Possible"
                    expected_role = source_object_name  # Default role is source object name
                    
                    # Get existing relationships to this target
                    target_rels = existing_relationships.get(target_id, [])
                    
                    # Find the correct relationship (with expected role)
                    correct_rel = None
                    incorrect_rels = []
                    
                    for rel in target_rels:
                        if rel["role"] == expected_role:
                            correct_rel = rel
                        else:
                            incorrect_rels.append(rel)
                    
                    # Delete incorrect relationships (those with wrong role)
                    for incorrect_rel in incorrect_rels:
                        session.run("""
                            MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object {id: $target_id})
                            WHERE r.id = $rel_id
                            DELETE r
                        """, source_id=source_id, target_id=target_id, rel_id=incorrect_rel["rel_id"])
                        total_deleted += 1
                        print(f"  ❌ Deleted relationship with role '{incorrect_rel['role']}' to {target_object_name}")
                    
                    # Check if correct relationship exists and is correct
                    if correct_rel:
                        # Check if type and frequency are correct
                        needs_update = False
                        if correct_rel.get("type") != expected_type:
                            needs_update = True
                        if correct_rel.get("frequency") != expected_frequency:
                            needs_update = True
                        
                        if needs_update:
                            # Update the relationship properties
                            session.run("""
                                MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object {id: $target_id})
                                WHERE r.id = $rel_id
                                SET r.type = $type, r.frequency = $frequency
                            """, source_id=source_id, target_id=target_id, rel_id=correct_rel["rel_id"],
                                type=expected_type, frequency=expected_frequency)
                            total_updated += 1
                            print(f"  🔧 Updated relationship to {target_object_name} (type: {expected_type}, frequency: {expected_frequency})")
                    else:
                        # Create missing default relationship
                        relationship_id = str(uuid.uuid4())
                        session.run("""
                            MATCH (source:Object {id: $source_id})
                            MATCH (target:Object {id: $target_id})
                            CREATE (source)-[:RELATES_TO {
                                id: $relationship_id,
                                type: $type,
                                role: $role,
                                frequency: $frequency,
                                toBeing: $to_being,
                                toAvatar: $to_avatar,
                                toObject: $to_object
                            }]->(target)
                        """, source_id=source_id, target_id=target_id,
                            relationship_id=relationship_id,
                            type=expected_type,
                            role=expected_role,
                            frequency=expected_frequency,
                            to_being=target_being,
                            to_avatar=target_avatar,
                            to_object=target_object_name)
                        total_created += 1
                        print(f"  ✅ Created default relationship to {target_object_name} (role: {expected_role})")
                
                # Verify the count
                count_result = session.run("""
                    MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object)
                    RETURN count(r) as count
                """, source_id=source_id).single()
                
                actual_count = count_result["count"] if count_result else 0
                
                if actual_count != total_objects:
                    print(f"  ⚠️  WARNING: Expected {total_objects} relationships, but found {actual_count}")
                else:
                    print(f"  ✓ Verified: {actual_count} relationships (matches total objects)")
            
            print(f"\n{'='*60}")
            print(f"📊 Cleanup Summary:")
            print(f"  ✅ Relationships created: {total_created}")
            print(f"  ❌ Relationships deleted: {total_deleted}")
            print(f"  🔧 Relationships updated: {total_updated}")
            print(f"  📦 Total objects processed: {total_objects}")
            print(f"{'='*60}\n")
            
            # Final verification: Check all objects have correct relationship counts
            print("🔍 Final verification...")
            verification_errors = []
            for obj in objects:
                obj_id = obj["id"]
                obj_name = obj["object"]
                
                count_result = session.run("""
                    MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object)
                    RETURN count(r) as count
                """, source_id=obj_id).single()
                
                actual_count = count_result["count"] if count_result else 0
                
                if actual_count != total_objects:
                    verification_errors.append(f"{obj_name}: expected {total_objects}, found {actual_count}")
            
            if verification_errors:
                print(f"❌ Verification failed for {len(verification_errors)} objects:")
                for error in verification_errors[:10]:  # Show first 10 errors
                    print(f"  - {error}")
                if len(verification_errors) > 10:
                    print(f"  ... and {len(verification_errors) - 10} more")
            else:
                print(f"✅ All {total_objects} objects have exactly {total_objects} relationships each!")
                print(f"✅ Total relationship count: {total_objects * total_objects}")
            
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        driver.close()
        print("\n🔌 Database connection closed")

if __name__ == "__main__":
    print("="*60)
    print("🧹 Object Relationships Cleanup Script")
    print("="*60)
    print("\n⚠️  WARNING: This script will modify relationships in Neo4j!")
    print("   It will:")
    print("   - Delete relationships with non-default role names")
    print("   - Create missing default relationships")
    print("   - Update relationship properties to match defaults")
    print("\n   This script ONLY affects RELATES_TO relationships between Object nodes.")
    print("   It will NOT touch relationships to Being, Avatar, Variables, etc.\n")
    
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
        response = input("Continue with cleanup? (yes/no): ")
        if response.lower() not in ["yes", "y"]:
            print("❌ Aborted.")
            sys.exit(0)
    
    print("\n🚀 Starting cleanup...\n")
    cleanup_object_relationships()
    print("\n✅ Cleanup complete!")

