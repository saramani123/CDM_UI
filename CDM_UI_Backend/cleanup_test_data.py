#!/usr/bin/env python3
"""
Clean up test data from Neo4j database.
This script will delete all nodes and relationships for:
- Drivers (Sector, Domain, Country, Object Clarifier, Variable Clarifier)
- Objects (Beings, Avatars, Objects)
- Variables (Parts, Groups, Variables)

It will NOT delete:
- Database schema definitions or constraints
- Backend API logic or route definitions
- UI components or state files
"""

import os
from dotenv import load_dotenv
from db import get_session

def cleanup_test_data():
    """Delete all test data nodes and relationships from Neo4j"""
    
    # Load environment variables
    load_dotenv()
    
    print("🧹 Starting Neo4j test data cleanup...")
    print("=" * 50)
    
    # Get database session
    session = get_session()
    if not session:
        print("❌ Failed to connect to Neo4j database")
        return False
    
    try:
        # First, let's see what we have before deletion
        print("📊 Current node count by type:")
        result = session.run("""
            MATCH (n)
            RETURN labels(n) as node_types, count(n) as count
            ORDER BY count DESC
        """)
        
        for record in result:
            node_types = record['node_types']
            count = record['count']
            print(f"  {node_types}: {count}")
        
        print("\n🗑️  Deleting test data nodes...")
        
        # Delete all test data nodes and their relationships
        delete_result = session.run("""
            MATCH (n)
            WHERE n:Driver OR n:Being OR n:Avatar OR n:Object OR n:Part OR n:Group OR n:Variable 
               OR n:Country OR n:Sector OR n:Domain OR n:ObjectClarifier OR n:VariableClarifier
            DETACH DELETE n
        """)
        
        # Get the number of deleted nodes
        deleted_count = delete_result.consume().counters.nodes_deleted
        deleted_relationships = delete_result.consume().counters.relationships_deleted
        
        print(f"✅ Deleted {deleted_count} nodes and {deleted_relationships} relationships")
        
        # Verify deletion by counting remaining nodes
        print("\n🔍 Verifying deletion...")
        result = session.run("MATCH (n) RETURN COUNT(n) as total_nodes")
        total_nodes = result.single()['total_nodes']
        
        print(f"📊 Remaining nodes in database: {total_nodes}")
        
        # Show what's left
        print("\n📋 Remaining node types:")
        result = session.run("""
            MATCH (n)
            RETURN labels(n) as node_types, count(n) as count
            ORDER BY count DESC
        """)
        
        remaining_types = []
        for record in result:
            node_types = record['node_types']
            count = record['count']
            remaining_types.append(f"  {node_types}: {count}")
            print(f"  {node_types}: {count}")
        
        if total_nodes == 0:
            print("\n✅ Database is now completely empty")
        elif len(remaining_types) == 0:
            print("\n✅ All test data has been successfully deleted")
        else:
            print(f"\n✅ Cleanup complete. {total_nodes} system/metadata nodes remain")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        return False
    
    finally:
        session.close()

if __name__ == "__main__":
    print("🚀 Neo4j Test Data Cleanup Script")
    print("This will delete all test data nodes and relationships")
    print("Proceeding with cleanup...")
    
    try:
        success = cleanup_test_data()
        
        if success:
            print("\n🎉 Cleanup completed successfully!")
        else:
            print("\n💥 Cleanup failed. Please check the error messages above.")
            
    except KeyboardInterrupt:
        print("\n❌ Cleanup cancelled by user")
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
