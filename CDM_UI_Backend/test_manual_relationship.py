#!/usr/bin/env python3

from db import get_driver

def test_manual_relationship_creation():
    driver = get_driver()
    if not driver:
        print("Failed to connect to Neo4j database")
        return
    
    try:
        with driver.session() as session:
            # Test the exact same logic as the API
            source_id = "ea6ca5d6-be9c-4be3-9fe4-c0d8e2bb40a0"  # Company
            to_being = "Master"
            to_avatar = "Company Affiliate" 
            to_object = "ALL"
            relationship_type = "Inter-Table"
            role = "Manual Test"
            
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
            
            # Create relationships to ALL matching objects
            for target_result in target_results:
                target_id = target_result["target_id"]
                print(f"Creating relationship from {source_id} to {target_id}")
                
                # Check if relationship already exists
                existing = session.run("""
                    MATCH (source:Object {id: $source_id})-[r:RELATES_TO]->(target:Object {id: $target_id})
                    WHERE r.role = $role
                    RETURN r
                """, source_id=source_id, target_id=target_id, role=role).single()
                
                if existing:
                    print(f"  Relationship already exists, skipping")
                    continue
                
                # Create the relationship
                session.run("""
                    MATCH (source:Object {id: $source_id})
                    MATCH (target:Object {id: $target_id})
                    CREATE (source)-[:RELATES_TO {
                        type: $relationship_type,
                        role: $role,
                        toBeing: $to_being,
                        toAvatar: $to_avatar,
                        toObject: $to_object
                    }]->(target)
                """, source_id=source_id, target_id=target_id, relationship_type=relationship_type,
                    role=role, to_being=to_being, to_avatar=to_avatar, to_object=to_object)
                
                print(f"  Relationship created successfully")
            
            # Check the final relationship count
            count_result = session.run("""
                MATCH (o:Object {id: $object_id})-[:RELATES_TO]->(other:Object)
                RETURN count(other) as rel_count
            """, object_id=source_id).single()
            
            print(f"Final relationship count for Company: {count_result['rel_count']}")
            
            # List all relationships
            relationships = session.run("""
                MATCH (o:Object {id: $object_id})-[r:RELATES_TO]->(other:Object)
                RETURN other.being as being, other.avatar as avatar, other.object as object, r.role as role
            """, object_id=source_id).data()
            
            print(f"All relationships for Company:")
            for rel in relationships:
                print(f"  - {rel['being']} + {rel['avatar']} + {rel['object']} (Role: {rel['role']})")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_manual_relationship_creation()
