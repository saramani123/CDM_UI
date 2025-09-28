#!/usr/bin/env python3

from db import get_driver

def debug_relationship_creation():
    driver = get_driver()
    if not driver:
        print("Failed to connect to Neo4j database")
        return
    
    try:
        with driver.session() as session:
            # Test the exact same query that should be running in the API
            to_being = "Master"
            to_avatar = "Company Affiliate" 
            to_object = "ALL"
            
            # Build the query dynamically based on the criteria
            where_conditions = []
            params = {}
            
            if to_being != "ALL":
                where_conditions.append("target.being = $to_being")
                params["to_being"] = to_being
            
            if to_avatar != "ALL":
                where_conditions.append("target.avatar = $to_avatar")
                params["to_avatar"] = to_avatar
            
            if to_object != "ALL":
                where_conditions.append("target.object = $to_object")
                params["to_object"] = to_object
            
            where_clause = " AND ".join(where_conditions) if where_conditions else "true"
            
            query = f"""
                MATCH (target:Object)
                WHERE {where_clause}
                RETURN target.id as target_id, target.being as being, target.avatar as avatar, target.object as object
            """
            
            print(f"Query: {query}")
            print(f"Params: {params}")
            
            target_results = session.run(query, **params).data()
            
            print(f"Found {len(target_results)} matching objects:")
            for result in target_results:
                print(f"  - {result['being']}, {result['avatar']}, {result['object']} (ID: {result['target_id']})")
            
            # Check what relationships currently exist for the Company object
            company_id = "ea6ca5d6-be9c-4be3-9fe4-c0d8e2bb40a0"
            existing_rels = session.run("""
                MATCH (o:Object {id: $object_id})-[r:RELATES_TO]->(other:Object)
                RETURN other.being as being, other.avatar as avatar, other.object as object, r.role as role
            """, object_id=company_id).data()
            
            print(f"\nCurrent relationships for Company object:")
            for rel in existing_rels:
                print(f"  - {rel['being']} + {rel['avatar']} + {rel['object']} (Role: {rel['role']})")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_relationship_creation()
