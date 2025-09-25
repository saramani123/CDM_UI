#!/usr/bin/env python3
"""
Script to set up the CDM Neo4j database
Clears existing data and sets up the schema with countries
"""

from db import get_driver
from schema import setup_schema

def clear_database():
    """Clear all data from the Neo4j database"""
    driver = get_driver()
    if not driver:
        print("❌ No Neo4j connection available")
        return False
    
    with driver.session() as session:
        try:
            # Clear all nodes and relationships
            session.run("MATCH (n) DETACH DELETE n")
            print("🗑️  Cleared all data from Neo4j database")
            return True
        except Exception as e:
            print(f"❌ Error clearing database: {e}")
            return False

def main():
    print("CDM Neo4j Database Setup")
    print("=" * 40)
    
    # Clear existing data
    if not clear_database():
        print("❌ Failed to clear database")
        return
    
    # Set up schema
    if setup_schema():
        print("\n🎉 Database setup complete!")
        print("\nNext steps:")
        print("1. Start the backend server: python3 main.py")
        print("2. Use the Drivers tab in the frontend to add sectors, domains, etc.")
        print("3. Use the verification queries below to check your data")
    else:
        print("\n❌ Database setup failed")

if __name__ == "__main__":
    main()
