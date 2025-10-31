#!/usr/bin/env python3
"""
Script to check if there are variables in the dev database
"""

from db import get_driver

def check_variables():
    """Check what variable data exists in the database"""
    driver = get_driver()
    if not driver:
        print("❌ Failed to connect to Neo4j database")
        return
    
    try:
        with driver.session() as session:
            # Check 1: Count all Variable nodes
            print("\n1️⃣ Checking total Variable nodes...")
            result = session.run("MATCH (v:Variable) RETURN count(v) as count")
            record = result.single()
            total_variables = record["count"] if record else 0
            print(f"   Total Variable nodes: {total_variables}")
            
            # Check 2: Count variables with proper taxonomy structure
            print("\n2️⃣ Checking variables with proper taxonomy (Part->Group->Variable)...")
            result = session.run("""
                MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v:Variable)
                RETURN count(DISTINCT v) as count
            """)
            record = result.single()
            structured_variables = record["count"] if record else 0
            print(f"   Variables with proper taxonomy: {structured_variables}")
            
            # Check 3: Sample a few variables
            print("\n3️⃣ Sampling variables (first 5)...")
            result = session.run("""
                MATCH (v:Variable)
                RETURN v.id as id, v.name as name
                LIMIT 5
            """)
            variables = []
            for record in result:
                variables.append({
                    "id": record["id"],
                    "name": record["name"]
                })
            
            if variables:
                print(f"   Found {len(variables)} sample variables:")
                for var in variables:
                    print(f"   - ID: {var['id']}, Name: {var['name']}")
            else:
                print("   No variables found!")
            
            # Check 4: Check Part and Group nodes
            print("\n4️⃣ Checking taxonomy structure...")
            result = session.run("MATCH (p:Part) RETURN count(p) as count")
            record = result.single()
            parts_count = record["count"] if record else 0
            print(f"   Total Part nodes: {parts_count}")
            
            result = session.run("MATCH (g:Group) RETURN count(g) as count")
            record = result.single()
            groups_count = record["count"] if record else 0
            print(f"   Total Group nodes: {groups_count}")
            
            # Check 5: Check for variables without proper structure
            if total_variables > structured_variables:
                print("\n5️⃣ ⚠️  Checking variables without proper taxonomy...")
                result = session.run("""
                    MATCH (v:Variable)
                    WHERE NOT EXISTS {
                        MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v)
                    }
                    RETURN v.id as id, v.name as name
                    LIMIT 5
                """)
                orphaned = []
                for record in result:
                    orphaned.append({
                        "id": record["id"],
                        "name": record["name"]
                    })
                if orphaned:
                    print(f"   Found {len(orphaned)} variables without proper taxonomy:")
                    for var in orphaned:
                        print(f"   - ID: {var['id']}, Name: {var['name']}")
            
            # Summary
            print("\n" + "="*50)
            print("SUMMARY:")
            print(f"   Total Variables: {total_variables}")
            print(f"   Variables with proper taxonomy: {structured_variables}")
            print(f"   Parts: {parts_count}")
            print(f"   Groups: {groups_count}")
            
            if structured_variables == 0:
                print("\n❌ NO VARIABLES WITH PROPER TAXONOMY FOUND!")
                print("   The API query requires: Part -> Group -> Variable structure")
                print("   Variables need to be connected through this taxonomy to show up.")
            else:
                print(f"\n✅ Found {structured_variables} variables with proper taxonomy")
                
    except Exception as e:
        print(f"❌ Error checking variables: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_variables()

