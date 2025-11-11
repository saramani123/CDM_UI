#!/usr/bin/env python3
"""
Safe script to fix "ALL" node issues in Neo4j.

This script:
1. Detects "ALL" nodes for Sector, Domain, Country
2. Finds objects/variables/lists that have relationships to "ALL" nodes
3. Checks if they already have relationships to all actual values
4. Creates missing relationships to all actual values
5. Safely deletes relationships to "ALL" nodes
6. Deletes "ALL" nodes

IMPORTANT: This script is designed to be safe and idempotent.
It will NOT delete or modify any data unless "ALL" nodes are found.
"""

from db import get_driver
from neo4j import WRITE_ACCESS

def get_all_driver_nodes(session, driver_type: str):
    """Get all actual driver nodes (excluding 'ALL')"""
    result = session.run(f"MATCH (d:{driver_type}) WHERE d.name <> 'ALL' RETURN d.name as name ORDER BY d.name")
    return [record["name"] for record in result]

def find_all_node(session, driver_type: str):
    """Find the 'ALL' node for a driver type"""
    result = session.run(f"MATCH (d:{driver_type} {{name: 'ALL'}}) RETURN d")
    return result.single()

def get_entities_with_all_relationship(session, driver_type: str, entity_type: str, relationship_type: str):
    """
    Find entities that have relationships to 'ALL' node.
    
    Args:
        driver_type: 'Sector', 'Domain', or 'Country'
        entity_type: 'Object', 'Variable', or 'List'
        relationship_type: 'RELEVANT_TO' or 'IS_RELEVANT_TO'
    """
    query = f"""
        MATCH (d:{driver_type} {{name: 'ALL'}})-[r:{relationship_type}]->(e:{entity_type})
        RETURN e.id as id, e.name as name, type(e) as type
    """
    result = session.run(query)
    return [{"id": record["id"], "name": record.get("name", ""), "type": record["type"]} for record in result]

def check_entity_has_all_relationships(session, entity_id: str, entity_type: str, driver_type: str, relationship_type: str):
    """
    Check if an entity has relationships to ALL actual driver nodes.
    
    Returns:
        (has_all, missing_drivers) - tuple of (bool, list of missing driver names)
    """
    # Get all actual driver nodes
    all_drivers = get_all_driver_nodes(session, driver_type)
    
    if not all_drivers:
        # No actual drivers exist, so entity can't have all relationships
        return (False, all_drivers)
    
    # Get drivers that entity currently has relationships to
    query = f"""
        MATCH (d:{driver_type})-[:{relationship_type}]->(e:{entity_type} {{id: $entity_id}})
        WHERE d.name <> 'ALL'
        RETURN d.name as name
    """
    result = session.run(query, entity_id=entity_id)
    current_drivers = {record["name"] for record in result}
    
    # Find missing drivers
    missing_drivers = [d for d in all_drivers if d not in current_drivers]
    
    # Entity has all relationships if no drivers are missing
    has_all = len(missing_drivers) == 0
    
    return (has_all, missing_drivers)

def create_missing_relationships(session, entity_id: str, entity_type: str, driver_type: str, 
                                 relationship_type: str, missing_drivers: list):
    """Create relationships from missing drivers to entity"""
    if not missing_drivers:
        return 0
    
    created = 0
    for driver_name in missing_drivers:
        try:
            query = f"""
                MATCH (d:{driver_type} {{name: $driver_name}})
                MATCH (e:{entity_type} {{id: $entity_id}})
                MERGE (d)-[:{relationship_type}]->(e)
                RETURN count(*) as created
            """
            result = session.run(query, driver_name=driver_name, entity_id=entity_id)
            if result.single()["created"] > 0:
                created += 1
        except Exception as e:
            print(f"  ⚠️  Error creating relationship {driver_type}({driver_name}) -> {entity_type}({entity_id}): {e}")
    
    return created

def delete_all_relationships(session, entity_id: str, entity_type: str, driver_type: str, relationship_type: str):
    """Delete relationships from 'ALL' node to entity"""
    query = f"""
        MATCH (d:{driver_type} {{name: 'ALL'}})-[r:{relationship_type}]->(e:{entity_type} {{id: $entity_id}})
        DELETE r
        RETURN count(r) as deleted
    """
    result = session.run(query, entity_id=entity_id)
    return result.single()["deleted"]

def fix_all_node_for_driver_type(session, driver_type: str):
    """
    Fix 'ALL' node issues for a specific driver type.
    
    Handles:
    - Objects (RELEVANT_TO relationship)
    - Variables (IS_RELEVANT_TO relationship)
    - Lists (IS_RELEVANT_TO relationship)
    """
    print(f"\n{'='*60}")
    print(f"Processing {driver_type} nodes...")
    print(f"{'='*60}")
    
    # Check if 'ALL' node exists
    all_node = find_all_node(session, driver_type)
    if not all_node:
        print(f"✅ No 'ALL' node found for {driver_type} - nothing to fix")
        return {"fixed": 0, "deleted": 0, "skipped": 0}
    
    print(f"⚠️  Found 'ALL' node for {driver_type}")
    
    # Get all actual driver nodes
    all_drivers = get_all_driver_nodes(session, driver_type)
    print(f"📊 Found {len(all_drivers)} actual {driver_type} nodes")
    
    if not all_drivers:
        print(f"⚠️  No actual {driver_type} nodes found - cannot create relationships")
        print(f"   Deleting 'ALL' node without creating relationships...")
        session.run(f"MATCH (d:{driver_type} {{name: 'ALL'}}) DETACH DELETE d")
        print(f"✅ Deleted 'ALL' node for {driver_type}")
        return {"fixed": 0, "deleted": 1, "skipped": 0}
    
    stats = {"fixed": 0, "deleted": 0, "skipped": 0}
    
    # Process Objects
    print(f"\n📦 Processing Objects...")
    objects_with_all = get_entities_with_all_relationship(session, driver_type, "Object", "RELEVANT_TO")
    print(f"   Found {len(objects_with_all)} objects with 'ALL' relationship")
    
    for obj in objects_with_all:
        entity_id = obj["id"]
        entity_name = obj.get("name", entity_id)
        
        # Check if object already has all relationships
        has_all, missing = check_entity_has_all_relationships(session, entity_id, "Object", driver_type, "RELEVANT_TO")
        
        if has_all:
            print(f"   ✅ Object {entity_name} ({entity_id}) already has all {driver_type} relationships")
            # Just delete the 'ALL' relationship
            deleted = delete_all_relationships(session, entity_id, "Object", driver_type, "RELEVANT_TO")
            if deleted > 0:
                stats["deleted"] += deleted
                print(f"      Deleted {deleted} 'ALL' relationship(s)")
        else:
            print(f"   🔧 Fixing Object {entity_name} ({entity_id})")
            print(f"      Missing relationships to {len(missing)} {driver_type} nodes")
            # Create missing relationships
            created = create_missing_relationships(session, entity_id, "Object", driver_type, "RELEVANT_TO", missing)
            print(f"      Created {created} missing relationship(s)")
            # Delete 'ALL' relationship
            deleted = delete_all_relationships(session, entity_id, "Object", driver_type, "RELEVANT_TO")
            if deleted > 0:
                stats["deleted"] += deleted
                print(f"      Deleted {deleted} 'ALL' relationship(s)")
            stats["fixed"] += 1
    
    # Process Variables
    print(f"\n📊 Processing Variables...")
    variables_with_all = get_entities_with_all_relationship(session, driver_type, "Variable", "IS_RELEVANT_TO")
    print(f"   Found {len(variables_with_all)} variables with 'ALL' relationship")
    
    for var in variables_with_all:
        entity_id = var["id"]
        entity_name = var.get("name", entity_id)
        
        # Check if variable already has all relationships
        has_all, missing = check_entity_has_all_relationships(session, entity_id, "Variable", driver_type, "IS_RELEVANT_TO")
        
        if has_all:
            print(f"   ✅ Variable {entity_name} ({entity_id}) already has all {driver_type} relationships")
            # Just delete the 'ALL' relationship
            deleted = delete_all_relationships(session, entity_id, "Variable", driver_type, "IS_RELEVANT_TO")
            if deleted > 0:
                stats["deleted"] += deleted
                print(f"      Deleted {deleted} 'ALL' relationship(s)")
        else:
            print(f"   🔧 Fixing Variable {entity_name} ({entity_id})")
            print(f"      Missing relationships to {len(missing)} {driver_type} nodes")
            # Create missing relationships
            created = create_missing_relationships(session, entity_id, "Variable", driver_type, "IS_RELEVANT_TO", missing)
            print(f"      Created {created} missing relationship(s)")
            # Delete 'ALL' relationship
            deleted = delete_all_relationships(session, entity_id, "Variable", driver_type, "IS_RELEVANT_TO")
            if deleted > 0:
                stats["deleted"] += deleted
                print(f"      Deleted {deleted} 'ALL' relationship(s)")
            stats["fixed"] += 1
    
    # Process Lists
    print(f"\n📋 Processing Lists...")
    lists_with_all = get_entities_with_all_relationship(session, driver_type, "List", "IS_RELEVANT_TO")
    print(f"   Found {len(lists_with_all)} lists with 'ALL' relationship")
    
    for lst in lists_with_all:
        entity_id = lst["id"]
        entity_name = lst.get("name", entity_id)
        
        # Check if list already has all relationships
        has_all, missing = check_entity_has_all_relationships(session, entity_id, "List", driver_type, "IS_RELEVANT_TO")
        
        if has_all:
            print(f"   ✅ List {entity_name} ({entity_id}) already has all {driver_type} relationships")
            # Just delete the 'ALL' relationship
            deleted = delete_all_relationships(session, entity_id, "List", driver_type, "IS_RELEVANT_TO")
            if deleted > 0:
                stats["deleted"] += deleted
                print(f"      Deleted {deleted} 'ALL' relationship(s)")
        else:
            print(f"   🔧 Fixing List {entity_name} ({entity_id})")
            print(f"      Missing relationships to {len(missing)} {driver_type} nodes")
            # Create missing relationships
            created = create_missing_relationships(session, entity_id, "List", driver_type, "IS_RELEVANT_TO", missing)
            print(f"      Created {created} missing relationship(s)")
            # Delete 'ALL' relationship
            deleted = delete_all_relationships(session, entity_id, "List", driver_type, "IS_RELEVANT_TO")
            if deleted > 0:
                stats["deleted"] += deleted
                print(f"      Deleted {deleted} 'ALL' relationship(s)")
            stats["fixed"] += 1
    
    # Finally, delete the 'ALL' node itself if no relationships remain
    remaining_rels = session.run(f"""
        MATCH (d:{driver_type} {{name: 'ALL'}})-[r]-()
        RETURN count(r) as count
    """).single()["count"]
    
    if remaining_rels == 0:
        session.run(f"MATCH (d:{driver_type} {{name: 'ALL'}}) DETACH DELETE d")
        print(f"\n✅ Deleted 'ALL' node for {driver_type} (no remaining relationships)")
    else:
        print(f"\n⚠️  'ALL' node for {driver_type} still has {remaining_rels} relationship(s) - not deleted")
        print(f"   This may indicate relationships to other entity types or unexpected relationships")
    
    return stats

def main():
    """Main execution function"""
    print("🔧 Starting safe 'ALL' node cleanup and relationship fix...")
    print("=" * 60)
    print("⚠️  This script will:")
    print("   1. Find 'ALL' nodes for Sector, Domain, Country")
    print("   2. Check entities with 'ALL' relationships")
    print("   3. Create missing relationships to all actual values")
    print("   4. Delete 'ALL' relationships")
    print("   5. Delete 'ALL' nodes")
    print("=" * 60)
    
    driver = get_driver()
    if not driver:
        print("❌ No Neo4j connection available")
        return False
    
    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            total_stats = {"fixed": 0, "deleted": 0, "skipped": 0}
            
            # Process each driver type
            for driver_type in ["Sector", "Domain", "Country"]:
                stats = fix_all_node_for_driver_type(session, driver_type)
                total_stats["fixed"] += stats["fixed"]
                total_stats["deleted"] += stats["deleted"]
                total_stats["skipped"] += stats["skipped"]
            
            print("\n" + "=" * 60)
            print("📊 Summary:")
            print(f"   Entities fixed: {total_stats['fixed']}")
            print(f"   'ALL' relationships deleted: {total_stats['deleted']}")
            print(f"   Entities skipped (already correct): {total_stats['skipped']}")
            print("=" * 60)
            print("✅ Cleanup complete!")
            
            return True
            
    except Exception as e:
        print(f"\n❌ Error during cleanup: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)

