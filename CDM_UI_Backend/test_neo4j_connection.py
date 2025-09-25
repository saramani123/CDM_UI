#!/usr/bin/env python3
"""
Test script to diagnose Neo4j Aura connection issues
"""

import os
import sys
from dotenv import load_dotenv
import neo4j

def test_neo4j_connection():
    """Test Neo4j connection with detailed diagnostics"""
    load_dotenv()
    
    uri = os.getenv('NEO4J_URI')
    username = os.getenv('NEO4J_USERNAME')
    password = os.getenv('NEO4J_PASSWORD')
    
    print("🔍 Neo4j Aura Connection Diagnostics")
    print("=" * 50)
    print(f"URI: {uri}")
    print(f"Username: {username}")
    print(f"Password: {'*' * len(password) if password else 'NOT SET'}")
    print(f"Python Neo4j Driver Version: {neo4j.__version__}")
    print()
    
    if not all([uri, username, password]):
        print("❌ Missing environment variables!")
        print("Please check your .env file contains:")
        print("NEO4J_URI=neo4j+s://fbb04c5f.databases.neo4j.io")
        print("NEO4J_USERNAME=neo4j")
        print("NEO4J_PASSWORD=your_password")
        return False
    
    # Test 1: Basic connection
    print("🧪 Test 1: Basic Connection")
    try:
        driver = neo4j.GraphDatabase.driver(uri, auth=(username, password))
        print("✅ Driver created successfully")
        
        # Test 2: Session creation
        print("🧪 Test 2: Session Creation")
        with driver.session() as session:
            print("✅ Session created successfully")
            
            # Test 3: Simple query
            print("🧪 Test 3: Simple Query")
            result = session.run("RETURN 1 as test")
            record = result.single()
            print(f"✅ Query successful: {record['test']}")
            
            # Test 4: Database info
            print("🧪 Test 4: Database Information")
            try:
                result = session.run("CALL db.info()")
                info = result.single()
                print(f"✅ Database: {info['name']}")
                print(f"✅ Version: {info.get('version', 'Unknown')}")
            except Exception as e:
                print(f"⚠️  Could not get database info: {e}")
            
            # Test 5: Node count
            print("🧪 Test 5: Node Count")
            result = session.run("MATCH (n) RETURN count(n) as total")
            count = result.single()['total']
            print(f"✅ Total nodes: {count}")
        
        driver.close()
        print("\n🎉 All tests passed! Neo4j connection is working.")
        return True
        
    except neo4j.exceptions.ServiceUnavailable as e:
        print(f"❌ Service Unavailable: {e}")
        print("\n🔧 Troubleshooting suggestions:")
        print("1. Check if your Neo4j Aura instance is running")
        print("2. Verify the instance is not paused or suspended")
        print("3. Check if the password is correct")
        print("4. Try resetting the password in Neo4j Aura console")
        print("5. Check firewall settings")
        return False
        
    except neo4j.exceptions.AuthError as e:
        print(f"❌ Authentication Error: {e}")
        print("\n🔧 Troubleshooting suggestions:")
        print("1. Verify username and password are correct")
        print("2. Try resetting the password in Neo4j Aura console")
        print("3. Check if the user has proper permissions")
        return False
        
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        print(f"Error type: {type(e).__name__}")
        return False

if __name__ == "__main__":
    success = test_neo4j_connection()
    sys.exit(0 if success else 1)
