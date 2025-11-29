#!/usr/bin/env python3
"""
Script to find and report variables with missing required fields in production database.
This helps identify why the frontend might be crashing.
"""

from db import get_driver

def find_bad_variables():
    """Find variables with missing required fields"""
    driver = get_driver()
    if not driver:
        print("❌ Failed to connect to Neo4j database")
        return
    
    try:
        with driver.session() as session:
            print("\n🔍 Checking for variables with missing required fields...\n")
            
            # Find variables with missing part, group, or variable name
            result = session.run("""
                MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v:Variable)
                WHERE v.id IS NULL OR p.name IS NULL OR g.name IS NULL OR v.name IS NULL
                RETURN v.id as id, v.name as variable, p.name as part, g.name as group
                LIMIT 20
            """)
            
            bad_variables = []
            for record in result:
                bad_variables.append({
                    "id": record.get("id"),
                    "variable": record.get("variable"),
                    "part": record.get("part"),
                    "group": record.get("group")
                })
            
            if bad_variables:
                print(f"⚠️  Found {len(bad_variables)} variables with missing required fields:\n")
                for var in bad_variables:
                    print(f"   - ID: {var['id']}")
                    print(f"     Variable: {var['variable']}")
                    print(f"     Part: {var['part']}")
                    print(f"     Group: {var['group']}")
                    print()
            else:
                print("✅ No variables with missing required fields found!")
            
            # Also check for variables without proper taxonomy structure
            print("\n🔍 Checking for orphaned variables (without Part->Group structure)...\n")
            result = session.run("""
                MATCH (v:Variable)
                WHERE NOT EXISTS {
                    MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v)
                }
                RETURN v.id as id, v.name as name
                LIMIT 10
            """)
            
            orphaned = []
            for record in result:
                orphaned.append({
                    "id": record.get("id"),
                    "name": record.get("name")
                })
            
            if orphaned:
                print(f"⚠️  Found {len(orphaned)} orphaned variables (not connected to Part->Group):\n")
                for var in orphaned:
                    print(f"   - ID: {var['id']}, Name: {var['name']}")
            else:
                print("✅ No orphaned variables found!")
            
            print("\n" + "="*50)
            print("SUMMARY:")
            print(f"   Variables with missing fields: {len(bad_variables)}")
            print(f"   Orphaned variables: {len(orphaned)}")
            print("\n💡 The backend API now filters out invalid variables,")
            print("   but these should be fixed in the database for data integrity.")
            print("="*50)
                
    except Exception as e:
        print(f"❌ Error checking variables: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    find_bad_variables()

