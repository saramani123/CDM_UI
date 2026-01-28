#!/usr/bin/env python3
"""
Cleanup Extraneous Object Relationships (Production Fix)

The ensure_default_object_relationships script inadvertently created duplicate or
additional relationships that look like defaults. This script:

1. For every (source object, target object) pair:
   - Keeps exactly ONE default relationship. Default = role = source object name,
     frequency = 'Possible', type = 'Inter-Table' (or 'Intra-Table' for self).
   - Deletes any relationship that is NOT default (wrong role, frequency, or type).
   - Deletes duplicate defaults (keeps one per pair).
   - Creates the default relationship if missing.
2. Sets o.relationships = 0 for all objects (additional count; only defaults remain).

Run on production so every object has only default relationships and the
Relationships column shows 0 for all.
"""

import os
import sys
import uuid
from dotenv import load_dotenv
from neo4j import GraphDatabase, WRITE_ACCESS

# Load environment variables
if os.getenv("RENDER") is None:
    load_dotenv(".env.dev")
else:
    pass


def get_driver():
    """Get Neo4j driver connection"""
    uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    username = os.getenv("NEO4J_USERNAME", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "password")
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


def cleanup_extraneous_relationships():
    """
    For every (source, target) pair: exactly one default relationship.
    Delete all non-default and duplicate relationships; create default if missing.
    Set o.relationships = 0 for every object.
    """
    driver = get_driver()

    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            print("📋 Fetching all objects...")
            objects_result = session.run("""
                MATCH (o:Object)
                RETURN o.id as id, o.object as object, o.being as being, o.avatar as avatar
                ORDER BY o.object
            """)
            objects = [dict(record) for record in objects_result]
            N = len(objects)
            if N == 0:
                print("❌ No objects found.")
                return

            print(f"✅ Found {N} objects. Each object should have exactly {N} default relationships.")
            print("   Cleaning every (source, target) pair to exactly one default...\n")

            total_deleted = 0
            total_created = 0
            objects_over_threshold = 0

            for i, source_obj in enumerate(objects, 1):
                source_id = source_obj["id"]
                source_name = source_obj["object"]
                source_being = source_obj.get("being", "ALL")
                source_avatar = source_obj.get("avatar", "ALL")

                count_result = session.run("""
                    MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object)
                    RETURN count(r) as c
                """, source_id=source_id).single()
                current_count = count_result["c"] if count_result else 0
                if current_count > 133:
                    objects_over_threshold += 1

                if i % 20 == 0 or current_count != N:
                    print(f"[{i}/{N}] {source_name}: {current_count} rels -> fixing...")

                for target_obj in objects:
                    target_id = target_obj["id"]
                    target_name = target_obj["object"]
                    target_being = target_obj.get("being", "ALL")
                    target_avatar = target_obj.get("avatar", "ALL")

                    is_self = source_id == target_id
                    default_role = source_name
                    default_frequency = "Possible"
                    default_type = "Intra-Table" if is_self else "Inter-Table"

                    rels_result = session.run("""
                        MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object {id: $target_id})
                        RETURN r.id as rel_id, r.role as role, r.type as type, r.frequency as frequency
                        ORDER BY r.id
                    """, source_id=source_id, target_id=target_id)
                    rels = [dict(r) for r in rels_result]

                    if not rels:
                        rel_id = str(uuid.uuid4())
                        session.run("""
                            MATCH (source:Object {id: $source_id})
                            MATCH (target:Object {id: $target_id})
                            CREATE (source)-[:RELATES_TO {
                                id: $rel_id, type: $type, role: $role, frequency: $frequency,
                                toBeing: $to_being, toAvatar: $to_avatar, toObject: $to_object
                            }]->(target)
                        """,
                            source_id=source_id, target_id=target_id,
                            rel_id=rel_id, type=default_type, role=default_role, frequency=default_frequency,
                            to_being=target_being, to_avatar=target_avatar, to_object=target_name,
                        )
                        total_created += 1
                        continue

                    def is_default(r):
                        return ((r.get("role") or "").strip() == default_role
                                and (r.get("frequency") or "").strip() == default_frequency
                                and (r.get("type") or "").strip() == default_type)

                    default_rels = [r for r in rels if is_default(r)]
                    non_default_rels = [r for r in rels if not is_default(r)]

                    for r in non_default_rels:
                        session.run("""
                            MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object {id: $target_id})
                            WHERE r.id = $rel_id
                            DELETE r
                        """, source_id=source_id, target_id=target_id, rel_id=r["rel_id"])
                        total_deleted += 1

                    if len(default_rels) > 1:
                        for dup in default_rels[1:]:
                            session.run("""
                                MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object {id: $target_id})
                                WHERE r.id = $rel_id
                                DELETE r
                            """, source_id=source_id, target_id=target_id, rel_id=dup["rel_id"])
                            total_deleted += 1

                session.run("""
                    MATCH (o:Object {id: $object_id})
                    SET o.relationships = 0
                """, object_id=source_id)

            print(f"\n{'='*60}")
            print("📊 Summary:")
            print(f"  ❌ Relationships deleted (extraneous/duplicates): {total_deleted}")
            print(f"  ✅ Default relationships created (missing): {total_created}")
            print(f"  📦 Objects with >133 relationships before cleanup: {objects_over_threshold}")
            print(f"  🔢 All objects now have o.relationships = 0.")
            print(f"{'='*60}\n")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        driver.close()
        print("🔌 Database connection closed.")


if __name__ == "__main__":
    print("=" * 60)
    print("🧹 Cleanup Extraneous Object Relationships")
    print("=" * 60)
    print("\nThis script will:")
    print("  - Delete any relationship that is NOT default (role = object name, frequency = Possible, type = Inter/Intra-Table)")
    print("  - Delete duplicate default relationships (keep one per source-target pair)")
    print("  - Create default relationship where missing")
    print("  - Set o.relationships = 0 for all objects.\n")

    env = os.getenv("ENVIRONMENT", "development")
    instance = os.getenv("NEO4J_INSTANCE_NAME", "unknown")
    print(f"📍 Environment: {env}")
    print(f"📍 Instance: {instance}\n")

    if env == "production":
        response = input("⚠️  PRODUCTION. Type 'YES' to continue: ")
        if response != "YES":
            print("❌ Aborted.")
            sys.exit(0)
    else:
        response = input("Continue? (yes/no): ")
        if response.lower() not in ("yes", "y"):
            print("❌ Aborted.")
            sys.exit(0)

    cleanup_extraneous_relationships()
    print("✅ Done.")
