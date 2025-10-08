#!/usr/bin/env python3
"""
Debug script to test the delete endpoint logic directly.
"""

from db import get_driver
from routes.drivers import get_driver_label

def debug_delete_endpoint():
    """Debug the delete endpoint logic step by step."""
    
    driver = get_driver()
    if not driver:
        print("❌ No Neo4j connection")
        return
    
    # Test with a sector that should have relationships
    driver_type = "sectors"
    name = "Transportation"
    
    print(f"🔍 Debugging delete endpoint logic for {driver_type} '{name}'")
    print("=" * 60)
    
    try:
        label = get_driver_label(driver_type)
        print(f"1️⃣ Driver label: {label}")
        
        with driver.session() as session:
            # Check if driver exists
            existing = session.run(f"MATCH (d:{label} {{name: $name}}) RETURN d", name=name)
            if not existing.single():
                print(f"❌ {label} '{name}' not found")
                return
            
            print(f"2️⃣ {label} '{name}' exists")
            
            # Find all Objects and Variables that will be affected
            affected_objects = []
            affected_variables = []
            
            # Find affected Objects - relationships go FROM Driver TO Object
            print(f"3️⃣ Looking for objects with relationships to {label} '{name}'")
            
            # Find objects that have direct relationships to this specific driver
            objects_result = session.run(f"""
                MATCH (d:{label} {{name: $name}})-[:RELEVANT_TO]->(o:Object)
                RETURN o.id as id, o.driver as driver, o.being as being, 
                       o.avatar as avatar, o.object as object
            """, name=name)
            
            objects_list = list(objects_result)
            print(f"4️⃣ Found {len(objects_list)} objects with direct relationships")
            
            # Also find objects that use "ALL" for this driver type (they should be affected too)
            all_objects_result = session.run(f"""
                MATCH (o:Object)
                WHERE o.driver CONTAINS 'ALL'
                RETURN o.id as id, o.driver as driver, o.being as being, 
                       o.avatar as avatar, o.object as object
            """)
            
            all_objects_list = list(all_objects_result)
            print(f"5️⃣ Found {len(all_objects_list)} objects using ALL")
            
            # Combine both lists, avoiding duplicates
            all_affected_objects = objects_list + all_objects_list
            unique_objects = {}
            for obj in all_affected_objects:
                unique_objects[obj["id"]] = obj
            
            print(f"6️⃣ Total unique affected objects: {len(unique_objects)}")
            
            for obj_id, obj_data in unique_objects.items():
                print(f"   - Object {obj_data['id']}: {obj_data['object']} (Driver: {obj_data['driver']})")
                affected_objects.append({
                    "id": obj_data["id"],
                    "driver": obj_data["driver"],
                    "being": obj_data["being"],
                    "avatar": obj_data["avatar"],
                    "object": obj_data["object"]
                })
            
            # Find affected Variables
            variables_result = session.run(f"""
                MATCH (d:{label} {{name: $name}})-[:RELEVANT_TO]->(v:Variable)
                RETURN v.id as id, v.driver as driver, v.part as part,
                       v.group as group, v.variable as variable
            """, name=name)
            
            variables_list = list(variables_result)
            print(f"7️⃣ Found {len(variables_list)} variables with direct relationships")
            
            # Also find variables that use "ALL" for this driver type
            all_variables_result = session.run(f"""
                MATCH (v:Variable)
                WHERE v.driver CONTAINS 'ALL'
                RETURN v.id as id, v.driver as driver, v.part as part,
                       v.group as group, v.variable as variable
            """)
            
            all_variables_list = list(all_variables_result)
            print(f"8️⃣ Found {len(all_variables_list)} variables using ALL")
            
            # Combine both lists, avoiding duplicates
            all_affected_variables = variables_list + all_variables_list
            unique_variables = {}
            for var in all_affected_variables:
                unique_variables[var["id"]] = var
            
            print(f"9️⃣ Total unique affected variables: {len(unique_variables)}")
            
            for var_id, var_data in unique_variables.items():
                print(f"   - Variable {var_data['id']}: {var_data['variable']} (Driver: {var_data['driver']})")
                affected_variables.append({
                    "id": var_data["id"],
                    "driver": var_data["driver"],
                    "part": var_data["part"],
                    "group": var_data["group"],
                    "variable": var_data["variable"]
                })
            
            print(f"🔟 About to delete driver and update {len(affected_objects)} objects and {len(affected_variables)} variables")
            
            # Simulate the return statement
            return_data = {
                "message": f"{label} '{name}' deleted successfully",
                "affected_objects": affected_objects,
                "affected_variables": affected_variables,
                "affected_objects_count": len(affected_objects),
                "affected_variables_count": len(affected_variables)
            }
            
            print(f"✅ Return data structure:")
            print(f"   - Message: {return_data['message']}")
            print(f"   - Affected objects count: {return_data['affected_objects_count']}")
            print(f"   - Affected variables count: {return_data['affected_variables_count']}")
            print(f"   - Sample affected object: {affected_objects[0] if affected_objects else 'None'}")
            
    except Exception as e:
        print(f"❌ Error in delete logic: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_delete_endpoint()
