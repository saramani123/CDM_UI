#!/usr/bin/env python3
"""
Script to fix relationship counts for all objects in production.

This script:
1. Counts the actual number of relationships for each object
2. Updates the relationship count property to match the actual count
3. Identifies objects with incorrect counts

By default, each object should have 1 relationship to each other object (with default role word).
If there are 119 objects, each object should have 119 relationships (or 118 if excluding self, depending on setup).
"""

from db import get_driver

def fix_relationship_counts():
    """Fix relationship counts for all objects"""
    driver = get_driver()
    if not driver:
        print("❌ Failed to connect to Neo4j database")
        return False
    
    try:
        with driver.session() as session:
            # Get all objects
            objects_result = session.run("""
                MATCH (o:Object)
                RETURN o.id as id, o.object as object_name, o.relationships as current_count
                ORDER BY o.object
            """)
            
            objects = list(objects_result)
            total_objects = len(objects)
            
            print(f"📊 Found {total_objects} objects in database")
            print("=" * 80)
            
            fixed_count = 0
            incorrect_objects = []
            correct_count = 0
            
            print("Checking and fixing relationship counts...\n")
            
            for obj in objects:
                object_id = obj["id"]
                object_name = obj["object_name"]
                current_count = obj.get("current_count", 0) or 0
                
                # Count actual relationships
                count_result = session.run("""
                    MATCH (o:Object {id: $object_id})-[:RELATES_TO]->(other:Object)
                    RETURN count(*) as actual_count
                """, object_id=object_id).single()
                
                actual_count = count_result["actual_count"] if count_result else 0
                
                # Update if count is incorrect
                if actual_count != current_count:
                    session.run("""
                        MATCH (o:Object {id: $object_id})
                        SET o.relationships = $actual_count
                    """, object_id=object_id, actual_count=actual_count)
                    
                    incorrect_objects.append({
                        "name": object_name,
                        "id": object_id,
                        "old_count": current_count,
                        "new_count": actual_count
                    })
                    fixed_count += 1
                    print(f"✅ Fixed {object_name}: {current_count} → {actual_count} relationships")
                else:
                    correct_count += 1
                    # Only print correct ones if there are few objects, otherwise just show progress
                    if total_objects <= 50:
                        print(f"✓ {object_name}: {actual_count} relationships (correct)")
            
            # Show progress for large datasets
            if total_objects > 50:
                print(f"\n✓ {correct_count} objects already have correct counts")
            
            print("=" * 80)
            print(f"📊 Summary:")
            print(f"   Total objects: {total_objects}")
            print(f"   Objects with incorrect counts: {fixed_count}")
            print(f"   Objects with correct counts: {total_objects - fixed_count}")
            
            if incorrect_objects:
                print(f"\n📋 Objects that were fixed:")
                for obj in incorrect_objects:
                    print(f"   - {obj['name']}: {obj['old_count']} → {obj['new_count']}")
            
            # Show statistics
            if total_objects > 0:
                # Count distinct target objects (should be close to total_objects if default relationships exist)
                distinct_targets_result = session.run("""
                    MATCH (o:Object)-[:RELATES_TO]->(target:Object)
                    WITH o, count(DISTINCT target) as distinct_targets
                    RETURN avg(distinct_targets) as avg_distinct_targets,
                           min(distinct_targets) as min_distinct_targets,
                           max(distinct_targets) as max_distinct_targets
                """).single()
                
                avg_distinct = distinct_targets_result["avg_distinct_targets"] if distinct_targets_result else 0
                min_distinct = distinct_targets_result["min_distinct_targets"] if distinct_targets_result else 0
                max_distinct = distinct_targets_result["max_distinct_targets"] if distinct_targets_result else 0
                
                print(f"\n📈 Relationship Statistics:")
                print(f"   Average distinct target objects per source: {avg_distinct:.1f}")
                print(f"   Min distinct target objects: {min_distinct}")
                print(f"   Max distinct target objects: {max_distinct}")
                print(f"   Expected (if all objects relate to all others): ~{total_objects}")
            
            return True
                
    except Exception as e:
        print(f"❌ Error fixing relationship counts: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 80)
    print("🔧 Relationship Count Fix Script")
    print("=" * 80)
    print("\nThis script will:")
    print("1. Count actual relationships for each object")
    print("2. Update the relationship count property to match")
    print("3. Show statistics about relationships")
    print("\n⚠️  This will modify the database. Make sure you're connected to the correct instance.")
    print("=" * 80)
    
    response = input("\nContinue? (yes/no): ")
    if response.lower() in ['yes', 'y']:
        success = fix_relationship_counts()
        if success:
            print("\n✅ Relationship counts fixed successfully!")
        else:
            print("\n❌ Failed to fix relationship counts")
    else:
        print("\n❌ Cancelled")

