#!/usr/bin/env python3

from neo4j import GraphDatabase

def check_relationships():
    """Check what relationships actually exist in Neo4j"""
    
    # Connect to Neo4j
    driver = GraphDatabase.driver("bolt://localhost:7687", auth=("neo4j", "password"))
    
    with driver.session() as session:
        print("🔍 Checking relationships in Neo4j...")
        
        # Check sector relationships
        result = session.run("""
            MATCH (s:Sector)-[:RELEVANT_TO]->(o:Object)
            RETURN s.name as sector, count(o) as object_count
            ORDER BY object_count DESC
        """)
        
        print("\n📊 Sector -> Object relationships:")
        for record in result:
            print(f"  {record['sector']}: {record['object_count']} objects")
        
        # Check if any objects have specific sector relationships
        result = session.run("""
            MATCH (s:Sector)-[:RELEVANT_TO]->(o:Object)
            WHERE s.name = 'Retail'
            RETURN o.id as id, o.driver as driver, o.object as object
            LIMIT 5
        """)
        
        retail_objects = list(result)
        print(f"\n🏪 Objects connected to 'Retail' sector: {len(retail_objects)}")
        for obj in retail_objects:
            print(f"  - {obj['object']}: {obj['driver']}")
        
        # Check total sector relationships
        result = session.run("""
            MATCH (s:Sector)-[:RELEVANT_TO]->(o:Object)
            RETURN count(*) as total_relationships
        """)
        
        total = result.single()['total_relationships']
        print(f"\n📈 Total sector->object relationships: {total}")
        
        # Check if any objects have "ALL" in their driver string
        result = session.run("""
            MATCH (o:Object)
            WHERE o.driver CONTAINS 'ALL'
            RETURN count(o) as all_objects
        """)
        
        all_count = result.single()['all_objects']
        print(f"📈 Objects with 'ALL' in driver: {all_count}")

if __name__ == "__main__":
    check_relationships()
