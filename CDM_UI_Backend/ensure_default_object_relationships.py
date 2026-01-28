#!/usr/bin/env python3
"""
Ensure Default Object Relationships (Production-Safe Script)

This script checks if any object is missing one or more default relationships and
adds only the missing ones. It does NOT delete or modify any existing relationships.

Default relationship: from object O to object T (including O itself), with:
- Role = O's name (source object name)
- Frequency = "Possible"
- Type = "Inter-Table" (or "Intra-Table" when O = T)

Run on production (CDM_Prod) to backfill missing defaults after deployment.
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
        keep_alive=True,
    )

    return driver


def ensure_default_relationships():
    """
    For each object, ensure it has exactly one default relationship to every other
    object (including itself). Only CREATE missing ones; never delete or update.
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
            print("\n🔄 Checking for missing default relationships (add-only, no deletes)...\n")

            total_created = 0

            for i, source_obj in enumerate(objects, 1):
                source_id = source_obj["id"]
                source_object_name = source_obj["object"]
                source_being = source_obj.get("being", "ALL")
                source_avatar = source_obj.get("avatar", "ALL")

                # For each target object (including self), check if default relationship exists
                for target_obj in objects:
                    target_id = target_obj["id"]
                    target_object_name = target_obj["object"]
                    target_being = target_obj.get("being", "ALL")
                    target_avatar = target_obj.get("avatar", "ALL")

                    expected_role = source_object_name  # Default role = source object name
                    is_self = source_id == target_id
                    expected_type = "Intra-Table" if is_self else "Inter-Table"
                    expected_frequency = "Possible"

                    # Check if default relationship already exists
                    existing = session.run("""
                        MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object {id: $target_id})
                        WHERE r.role = $role AND r.frequency = $frequency
                        RETURN count(r) as count
                    """, source_id=source_id, target_id=target_id, role=expected_role, frequency=expected_frequency).single()

                    if existing and existing["count"] > 0:
                        continue  # Default already exists, skip

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
                    """,
                        source_id=source_id,
                        target_id=target_id,
                        relationship_id=relationship_id,
                        type=expected_type,
                        role=expected_role,
                        frequency=expected_frequency,
                        to_being=target_being,
                        to_avatar=target_avatar,
                        to_object=target_object_name,
                    )
                    total_created += 1
                    print(f"  ✅ [{i}/{total_objects}] {source_object_name} → {target_object_name}: created default (role={expected_role})")

            print(f"\n{'='*60}")
            print("📊 Summary:")
            print(f"  ✅ Default relationships created: {total_created}")
            print(f"  📦 Objects checked: {total_objects}")
            print(f"{'='*60}\n")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        driver.close()
        print("🔌 Database connection closed")


if __name__ == "__main__":
    print("=" * 60)
    print("🔗 Ensure Default Object Relationships (Add-Only)")
    print("=" * 60)
    print("\nThis script ONLY adds missing default relationships.")
    print("It does NOT delete or modify any existing relationships.\n")

    environment = os.getenv("ENVIRONMENT", "development")
    instance_name = os.getenv("NEO4J_INSTANCE_NAME", "unknown")

    print(f"📍 Environment: {environment}")
    print(f"📍 Instance: {instance_name}\n")

    if environment == "production":
        response = input("⚠️  You are about to run on PRODUCTION. Type 'YES' to continue: ")
        if response != "YES":
            print("❌ Aborted.")
            sys.exit(0)
    else:
        response = input("Continue? (yes/no): ")
        if response.lower() not in ["yes", "y"]:
            print("❌ Aborted.")
            sys.exit(0)

    print("\n🚀 Running...\n")
    ensure_default_relationships()
    print("\n✅ Done.")
