#!/usr/bin/env python3
"""
Quick verification script to check if RELEVANT_TO relationships exist.
"""

from db import get_driver

def verify_relationships():
    """Check if RELEVANT_TO relationships exist"""
    driver = get_driver()
    if not driver:
        print("❌ No Neo4j connection available")
        return False
    
    with driver.session() as session:
        try:
            # Check object relationships (correct direction: Driver -> Object)
            object_result = session.run("""
                MATCH (d)-[r:RELEVANT_TO]->(o:Object)
                WHERE labels(d)[0] IN ['Sector', 'Domain', 'Country', 'ObjectClarifier']
                RETURN count(r) as relationship_count
            """)
            object_count = object_result.single()["relationship_count"]
            
            # Check variable relationships (correct direction: Driver -> Variable)
            variable_result = session.run("""
                MATCH (d)-[r:RELEVANT_TO]->(v:Variable)
                WHERE labels(d)[0] IN ['Sector', 'Domain', 'Country', 'VariableClarifier']
                RETURN count(r) as relationship_count
            """)
            variable_count = variable_result.single()["relationship_count"]
            
            print(f"📊 Current RELEVANT_TO relationships:")
            print(f"  Objects: {object_count}")
            print(f"  Variables: {variable_count}")
            
            # Show some examples
            if object_count > 0:
                print("\n🔍 Sample Object relationships:")
                sample_result = session.run("""
                    MATCH (d)-[r:RELEVANT_TO]->(o:Object)
                    WHERE labels(d)[0] IN ['Sector', 'Domain', 'Country', 'ObjectClarifier']
                    RETURN o.object as object_name, labels(d)[0] as driver_type, d.name as driver_name
                    LIMIT 5
                """)
                for record in sample_result:
                    print(f"  {record['driver_type']}: {record['driver_name']} -> {record['object_name']}")
            
            if variable_count > 0:
                print("\n🔍 Sample Variable relationships:")
                sample_result = session.run("""
                    MATCH (d)-[r:RELEVANT_TO]->(v:Variable)
                    WHERE labels(d)[0] IN ['Sector', 'Domain', 'Country', 'VariableClarifier']
                    RETURN v.variable as variable_name, labels(d)[0] as driver_type, d.name as driver_name
                    LIMIT 5
                """)
                for record in sample_result:
                    print(f"  {record['driver_type']}: {record['driver_name']} -> {record['variable_name']}")
            
            return object_count > 0 or variable_count > 0
                
        except Exception as e:
            print(f"❌ Error during verification: {e}")
            return False

if __name__ == "__main__":
    print("🔍 Verifying RELEVANT_TO relationships...")
    print("=" * 50)
    verify_relationships()
