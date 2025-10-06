#!/usr/bin/env python3
"""
Cleanup script to remove "ALL" nodes from Neo4j database.
This script removes any Sector, Domain, Country, ObjectClarifier, or VariableClarifier 
nodes that have the name "ALL" since these should not exist in the database.
"""

from db import get_driver

def cleanup_all_nodes():
    """Remove all 'ALL' nodes from driver categories"""
    driver = get_driver()
    if not driver:
        print("❌ No Neo4j connection available")
        return False
    
    with driver.session() as session:
        try:
            # List of driver node types to clean up
            driver_types = ["Sector", "Domain", "Country", "ObjectClarifier", "VariableClarifier"]
            
            total_deleted = 0
            
            for driver_type in driver_types:
                # Count existing "ALL" nodes
                count_result = session.run(f"MATCH (n:{driver_type} {{name: 'ALL'}}) RETURN count(n) as count")
                count = count_result.single()["count"]
                
                if count > 0:
                    print(f"🗑️  Found {count} '{driver_type}' nodes with name 'ALL'")
                    
                    # Delete the "ALL" nodes and their relationships
                    delete_result = session.run(f"""
                        MATCH (n:{driver_type} {{name: 'ALL'}})
                        DETACH DELETE n
                        RETURN count(n) as deleted
                    """)
                    
                    deleted = delete_result.single()["deleted"]
                    total_deleted += deleted
                    print(f"✅ Deleted {deleted} '{driver_type}' nodes with name 'ALL'")
                else:
                    print(f"✅ No '{driver_type}' nodes with name 'ALL' found")
            
            print(f"\n🎉 Cleanup complete! Total nodes deleted: {total_deleted}")
            return True
            
        except Exception as e:
            print(f"❌ Error during cleanup: {e}")
            return False

def verify_cleanup():
    """Verify that no 'ALL' nodes remain"""
    driver = get_driver()
    if not driver:
        print("❌ No Neo4j connection available")
        return False
    
    with driver.session() as session:
        try:
            driver_types = ["Sector", "Domain", "Country", "ObjectClarifier", "VariableClarifier"]
            remaining_all_nodes = []
            
            for driver_type in driver_types:
                result = session.run(f"MATCH (n:{driver_type} {{name: 'ALL'}}) RETURN n.name as name")
                for record in result:
                    remaining_all_nodes.append(f"{driver_type}: {record['name']}")
            
            if remaining_all_nodes:
                print("⚠️  Warning: Some 'ALL' nodes still remain:")
                for node in remaining_all_nodes:
                    print(f"   - {node}")
                return False
            else:
                print("✅ Verification passed: No 'ALL' nodes found in any driver category")
                return True
                
        except Exception as e:
            print(f"❌ Error during verification: {e}")
            return False

if __name__ == "__main__":
    print("🧹 Starting cleanup of 'ALL' nodes from Neo4j database...")
    print("=" * 60)
    
    if cleanup_all_nodes():
        print("\n🔍 Verifying cleanup...")
        print("=" * 60)
        verify_cleanup()
    else:
        print("❌ Cleanup failed")
