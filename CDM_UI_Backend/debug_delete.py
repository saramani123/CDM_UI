#!/usr/bin/env python3
"""
Debug script to test the delete logic directly.
"""

from db import get_driver

def debug_delete_logic():
    """Debug the delete logic step by step."""
    
    driver = get_driver()
    if not driver:
        print("❌ No Neo4j connection")
        return
    
    with driver.session() as session:
        # Test with a sector that should have relationships
        label = "Sector"
        name = "Tech, Telecom & Media"
        
        print(f"🔍 Debugging delete logic for {label} '{name}'")
        print("=" * 50)
        
        # Step 1: Check if driver exists
        driver_check = session.run(f"MATCH (d:{label} {{name: $name}}) RETURN d", name=name)
        driver_exists = driver_check.single()
        print(f"1️⃣ Driver exists: {driver_exists is not None}")
        
        # Step 2: Find objects with direct relationships
        objects_result = session.run(f"""
            MATCH (d:{label} {{name: $name}})-[:RELEVANT_TO]->(o:Object)
            RETURN o.id as id, o.driver as driver, o.being as being, 
                   o.avatar as avatar, o.object as object
        """, name=name)
        
        objects_list = list(objects_result)
        print(f"2️⃣ Objects with direct relationships: {len(objects_list)}")
        
        # Step 3: Find objects using ALL
        all_objects_result = session.run(f"""
            MATCH (o:Object)
            WHERE o.driver CONTAINS 'ALL'
            RETURN o.id as id, o.driver as driver, o.being as being, 
                   o.avatar as avatar, o.object as object
        """)
        
        all_objects_list = list(all_objects_result)
        print(f"3️⃣ Objects using ALL: {len(all_objects_list)}")
        
        # Step 4: Show sample data
        if objects_list:
            print(f"   Sample direct relationship object: {objects_list[0]}")
        
        if all_objects_list:
            print(f"   Sample ALL object: {all_objects_list[0]}")
        
        # Step 5: Check total relationships
        total_rel_result = session.run(f"""
            MATCH (d:{label} {{name: $name}})-[:RELEVANT_TO]->(o:Object)
            RETURN count(o) as count
        """, name=name)
        total_rels = total_rel_result.single()['count']
        print(f"4️⃣ Total relationships for {name}: {total_rels}")

if __name__ == "__main__":
    debug_delete_logic()
