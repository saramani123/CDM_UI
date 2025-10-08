#!/usr/bin/env python3

from neo4j import GraphDatabase

def fix_driver_strings():
    """Fix malformed driver strings in Neo4j (3-part to 4-part format)"""
    
    # Connect to Neo4j
    driver = GraphDatabase.driver("bolt://localhost:7687", auth=("neo4j", "password"))
    
    with driver.session() as session:
        print("🔧 Fixing driver strings in Neo4j...")
        
        # Fix Objects with 3-part driver strings
        print("\n📋 Fixing Objects...")
        result = session.run("""
            MATCH (o:Object)
            WHERE o.driver IS NOT NULL AND o.driver CONTAINS 'ALL, ALL, None'
            RETURN count(o) as count
        """)
        
        objects_count = result.single()['count']
        print(f"Found {objects_count} objects with 3-part driver strings")
        
        if objects_count > 0:
            # Update objects to have 4-part driver strings
            session.run("""
                MATCH (o:Object)
                WHERE o.driver IS NOT NULL AND o.driver CONTAINS 'ALL, ALL, None'
                SET o.driver = 'ALL, ALL, ALL, None'
            """)
            print(f"✅ Updated {objects_count} objects to 4-part driver strings")
        
        # Fix Variables with 3-part driver strings
        print("\n📊 Fixing Variables...")
        result = session.run("""
            MATCH (v:Variable)
            WHERE v.driver IS NOT NULL AND v.driver CONTAINS 'ALL, ALL, None'
            RETURN count(v) as count
        """)
        
        variables_count = result.single()['count']
        print(f"Found {variables_count} variables with 3-part driver strings")
        
        if variables_count > 0:
            # Update variables to have 4-part driver strings
            session.run("""
                MATCH (v:Variable)
                WHERE v.driver IS NOT NULL AND v.driver CONTAINS 'ALL, ALL, None'
                SET v.driver = 'ALL, ALL, ALL, None'
            """)
            print(f"✅ Updated {variables_count} variables to 4-part driver strings")
        
        # Verify the fix
        print("\n🔍 Verifying fix...")
        result = session.run("""
            MATCH (o:Object)
            WHERE o.driver IS NOT NULL
            RETURN o.driver as driver
            LIMIT 3
        """)
        
        print("Sample object driver strings after fix:")
        for record in result:
            print(f"  - {record['driver']}")
        
        result = session.run("""
            MATCH (v:Variable)
            WHERE v.driver IS NOT NULL
            RETURN v.driver as driver
            LIMIT 3
        """)
        
        print("Sample variable driver strings after fix:")
        for record in result:
            print(f"  - {record['driver']}")

if __name__ == "__main__":
    fix_driver_strings()
