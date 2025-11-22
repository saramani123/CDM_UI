"""
Migration script to add default relationships for all existing objects.

This script creates relationships from each object to ALL other objects (and itself) with:
- Default role word = source object name
- Relationship type: Inter-Table for other objects, Intra-Table for self
- Frequency: Possible

Run this script after deploying the new relationship functionality to production.
"""

import os
import sys
from neo4j import GraphDatabase
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_driver():
    """Get Neo4j driver connection"""
    # Load environment variables (same as db.py)
    if os.getenv("RENDER") is None:  # Not in Render (local development)
        load_dotenv(".env.dev")
    else:  # In Render (production)
        # Environment variables are automatically injected by Render
        pass
    
    uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    username = os.getenv("NEO4J_USERNAME", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "password")
    
    if not password or password == "password":
        print("Error: NEO4J_PASSWORD must be set in environment")
        sys.exit(1)
    
    try:
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
        driver.verify_connectivity()
        return driver
    except Exception as e:
        print(f"Error connecting to Neo4j: {e}")
        sys.exit(1)

def migrate_default_relationships():
    """Create default relationships for all objects"""
    driver = get_driver()
    
    try:
        with driver.session() as session:
            # Get all objects
            result = session.run("""
                MATCH (o:Object)
                RETURN o.id as id, o.object as object, o.being as being, o.avatar as avatar
                ORDER BY o.object
            """)
            
            objects = [record for record in result]
            total_objects = len(objects)
            
            print(f"Found {total_objects} objects to process")
            
            if total_objects == 0:
                print("No objects found. Nothing to migrate.")
                return
            
            # Process each object
            for i, source_obj in enumerate(objects, 1):
                source_id = source_obj["id"]
                source_object_name = source_obj["object"]
                
                print(f"\n[{i}/{total_objects}] Processing object: {source_object_name} (ID: {source_id})")
                
                relationships_created = 0
                relationships_skipped = 0
                
                # Create relationships to all objects (including self)
                for target_obj in objects:
                    target_id = target_obj["id"]
                    target_being = target_obj["being"]
                    target_avatar = target_obj["avatar"]
                    target_object_name = target_obj["object"]
                    
                    # Determine relationship type
                    is_self = source_id == target_id
                    relationship_type = "Intra-Table" if is_self else "Inter-Table"
                    frequency = "Possible"
                    role = source_object_name  # Default role word is source object name
                    
                    # Check if relationship already exists
                    existing_check = session.run("""
                        MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object {id: $target_id})
                        WHERE r.role = $role
                        RETURN count(r) as count
                    """, source_id=source_id, target_id=target_id, role=role).single()
                    
                    if existing_check and existing_check["count"] > 0:
                        relationships_skipped += 1
                        continue
                    
                    # Create relationship
                    try:
                        import uuid
                        relationship_id = str(uuid.uuid4())
                        
                        session.run("""
                            MATCH (source:Object {id: $source_id})
                            MATCH (target:Object {id: $target_id})
                            CREATE (source)-[:RELATES_TO {
                                id: $relationship_id,
                                type: $relationship_type,
                                role: $role,
                                frequency: $frequency,
                                toBeing: $to_being,
                                toAvatar: $to_avatar,
                                toObject: $to_object
                            }]->(target)
                        """, 
                            source_id=source_id,
                            target_id=target_id,
                            relationship_id=relationship_id,
                            relationship_type=relationship_type,
                            role=role,
                            frequency=frequency,
                            to_being=target_being,
                            to_avatar=target_avatar,
                            to_object=target_object_name
                        )
                        
                        relationships_created += 1
                    except Exception as e:
                        print(f"  Error creating relationship to {target_object_name}: {e}")
                
                # Update relationship count for source object
                # Count should equal total number of objects (since each object relates to all objects including itself)
                count_result = session.run("""
                    MATCH (o:Object {id: $object_id})-[:RELATES_TO]->(other:Object)
                    RETURN count(DISTINCT other) as rel_count
                """, object_id=source_id).single()
                
                rel_count = count_result["rel_count"] if count_result else 0
                
                session.run("""
                    MATCH (o:Object {id: $object_id})
                    SET o.relationships = $rel_count
                """, object_id=source_id, rel_count=rel_count)
                
                print(f"  Created {relationships_created} relationships, skipped {relationships_skipped} (already exist)")
                print(f"  Total relationships for {source_object_name}: {rel_count}")
            
            print(f"\n✅ Migration completed successfully!")
            print(f"   Processed {total_objects} objects")
            
    except Exception as e:
        print(f"Error during migration: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        driver.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Default Relationships Migration Script")
    print("=" * 60)
    print("\nThis script will create default relationships for all objects:")
    print("  - Each object will have relationships to ALL other objects")
    print("  - Each object will have a self-referential (Intra-Table) relationship")
    print("  - Default role word = source object name")
    print("  - Relationship type: Inter-Table (others), Intra-Table (self)")
    print("  - Frequency: Possible")
    print("\n⚠️  WARNING: This will create many relationships in Neo4j.")
    print("   Existing relationships with the same role will be skipped.")
    print("\nPress Ctrl+C to cancel, or Enter to continue...")
    
    try:
        input()
    except KeyboardInterrupt:
        print("\nMigration cancelled.")
        sys.exit(0)
    
    migrate_default_relationships()

