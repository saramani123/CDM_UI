#!/usr/bin/env python3
"""
Diagnostic script to check for Avatar "Attribute" and Being "Process" issues.

This script helps diagnose why adding "Attribute" to "Process" might be failing.
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

def diagnose_avatar_issue(driver, avatar_name="Attribute", being_name="Process"):
    """Diagnose why adding an avatar might be failing"""
    with driver.session() as session:
        print(f"🔍 Diagnosing Avatar '{avatar_name}' for Being '{being_name}':\n")
        
        # 1. Check if Avatar exists with this name
        print("1. Checking for Avatar nodes with this name...")
        avatar_nodes = session.run("""
            MATCH (a:Avatar {name: $avatar_name})
            RETURN a.name as name, a.id as id, a.being as being_property
            ORDER BY a.id
        """, avatar_name=avatar_name)
        
        avatars_found = []
        for record in avatar_nodes:
            avatars_found.append({
                "name": record["name"],
                "id": record.get("id"),
                "being_property": record.get("being_property")
            })
        
        if avatars_found:
            print(f"   Found {len(avatars_found)} Avatar node(s) with name '{avatar_name}':")
            for avatar in avatars_found:
                print(f"   - ID: {avatar['id']}, being property: '{avatar['being_property']}'")
        else:
            print(f"   ✅ No Avatar nodes found with name '{avatar_name}'")
        
        # 2. Check relationships from Process to Attribute
        print(f"\n2. Checking HAS_AVATAR relationships from '{being_name}' to '{avatar_name}'...")
        relationships = session.run("""
            MATCH (b:Being {name: $being_name})-[r:HAS_AVATAR]->(a:Avatar {name: $avatar_name})
            RETURN count(r) as relationship_count, collect(a.id) as avatar_ids
        """, being_name=being_name, avatar_name=avatar_name).single()
        
        rel_count = relationships["relationship_count"] if relationships else 0
        avatar_ids = relationships["avatar_ids"] if relationships else []
        
        if rel_count > 0:
            print(f"   ⚠️  Found {rel_count} relationship(s) from '{being_name}' to '{avatar_name}'")
            print(f"   Avatar IDs: {avatar_ids}")
        else:
            print(f"   ✅ No relationships found from '{being_name}' to '{avatar_name}'")
        
        # 3. Check all relationships for Avatar "Attribute"
        print(f"\n3. Checking all Being relationships for Avatar '{avatar_name}'...")
        all_relationships = session.run("""
            MATCH (b:Being)-[r:HAS_AVATAR]->(a:Avatar {name: $avatar_name})
            RETURN b.name as being_name, a.id as avatar_id, count(r) as count
            ORDER BY being_name
        """, avatar_name=avatar_name)
        
        all_rels = []
        for record in all_relationships:
            all_rels.append({
                "being": record["being_name"],
                "avatar_id": record.get("avatar_id"),
                "count": record["count"]
            })
        
        if all_rels:
            print(f"   Found relationships from {len(all_rels)} Being(s):")
            for rel in all_rels:
                print(f"   - Being '{rel['being']}' -> Avatar ID: {rel['avatar_id']} ({rel['count']} relationship(s))")
        else:
            print(f"   ✅ No relationships found for Avatar '{avatar_name}'")
        
        # 4. Check Objects with being="Process" and avatar="Attribute"
        print(f"\n4. Checking Object nodes with being='{being_name}' and avatar='{avatar_name}'...")
        objects = session.run("""
            MATCH (o:Object)
            WHERE o.being = $being_name AND o.avatar = $avatar_name
            RETURN o.id as object_id, o.name as object_name, count(*) as count
            LIMIT 10
        """, being_name=being_name, avatar_name=avatar_name)
        
        object_list = []
        for record in objects:
            object_list.append({
                "id": record["object_id"],
                "name": record["object_name"]
            })
        
        if object_list:
            print(f"   ⚠️  Found {len(object_list)} Object(s) with being='{being_name}' and avatar='{avatar_name}':")
            for obj in object_list[:5]:
                print(f"   - '{obj['name']}' (ID: {obj['id']})")
            if len(object_list) > 5:
                print(f"   ... and {len(object_list) - 5} more")
        else:
            print(f"   ✅ No Objects found with being='{being_name}' and avatar='{avatar_name}'")
        
        # 5. Summary
        print(f"\n📋 Summary:")
        print(f"   - Avatar nodes with name '{avatar_name}': {len(avatars_found)}")
        print(f"   - Relationships from '{being_name}' to '{avatar_name}': {rel_count}")
        print(f"   - Total relationships for '{avatar_name}': {len(all_rels)}")
        print(f"   - Objects with being='{being_name}' and avatar='{avatar_name}': {len(object_list)}")
        
        if rel_count > 0:
            print(f"\n   ⚠️  ISSUE: There IS a relationship from '{being_name}' to '{avatar_name}'")
            print(f"   This would cause the duplicate error. The dropdown should show '{avatar_name}'.")
        elif len(avatars_found) > 0 and any(a.get("being_property") == being_name for a in avatars_found):
            print(f"\n   ⚠️  ISSUE: Found Avatar node with being property='{being_name}' but no relationship")
            print(f"   This is an orphaned node that might cause issues.")
        elif len(object_list) > 0:
            print(f"\n   ⚠️  ISSUE: Found Objects with being='{being_name}' and avatar='{avatar_name}'")
            print(f"   But no graph relationships exist. This is a data inconsistency.")
        else:
            print(f"\n   ✅ No issues found. Avatar '{avatar_name}' should be creatable for '{being_name}'.")

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Diagnose avatar duplicate issues')
    parser.add_argument('--avatar', default='Attribute', help='Avatar name to check (default: Attribute)')
    parser.add_argument('--being', default='Process', help='Being name to check (default: Process)')
    args = parser.parse_args()
    
    try:
        driver = get_driver()
        diagnose_avatar_issue(driver, args.avatar, args.being)
        driver.close()
        print("\n✅ Diagnostic completed!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
