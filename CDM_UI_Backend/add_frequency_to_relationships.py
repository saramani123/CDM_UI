#!/usr/bin/env python3
"""
Migration script to add frequency="Critical" to all existing RELATES_TO relationships
that don't have a frequency property.

This script should be run once after deploying the frequency feature to ensure
all existing relationships have the frequency property set to "Critical" as the default.
"""

from db import get_driver

def add_frequency_to_existing_relationships():
    """Add frequency="Critical" to all existing relationships that don't have it"""
    driver = get_driver()
    if not driver:
        print("❌ Failed to connect to Neo4j database")
        return False
    
    try:
        with driver.session() as session:
            # Find all relationships without frequency property
            result = session.run("""
                MATCH ()-[r:RELATES_TO]->()
                WHERE r.frequency IS NULL
                RETURN count(r) as count
            """)
            
            count_record = result.single()
            total_count = count_record["count"] if count_record else 0
            
            if total_count == 0:
                print("✅ All relationships already have frequency property. No migration needed.")
                return True
            
            print(f"📊 Found {total_count} relationships without frequency property")
            print("🔄 Adding frequency='Critical' to all relationships...")
            
            # Update all relationships without frequency to have frequency="Critical"
            update_result = session.run("""
                MATCH ()-[r:RELATES_TO]->()
                WHERE r.frequency IS NULL
                SET r.frequency = 'Critical'
                RETURN count(r) as updated_count
            """)
            
            updated_record = update_result.single()
            updated_count = updated_record["updated_count"] if updated_record else 0
            
            print(f"✅ Successfully updated {updated_count} relationships with frequency='Critical'")
            
            # Verify the update
            verify_result = session.run("""
                MATCH ()-[r:RELATES_TO]->()
                WHERE r.frequency IS NULL
                RETURN count(r) as remaining_count
            """)
            
            remaining_record = verify_result.single()
            remaining_count = remaining_record["remaining_count"] if remaining_record else 0
            
            if remaining_count == 0:
                print("✅ Verification passed: All relationships now have frequency property")
                return True
            else:
                print(f"⚠️  Warning: {remaining_count} relationships still missing frequency property")
                return False
                
    except Exception as e:
        print(f"❌ Error updating relationships: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Migration: Adding frequency property to existing relationships")
    print("=" * 60)
    print()
    
    success = add_frequency_to_existing_relationships()
    
    print()
    print("=" * 60)
    if success:
        print("✅ Migration completed successfully!")
    else:
        print("❌ Migration completed with errors. Please review the output above.")
    print("=" * 60)

