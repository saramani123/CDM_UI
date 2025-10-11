#!/usr/bin/env python3

import requests

# Test which database the API is connected to
def test_db_connection():
    print("=== Testing API Database Connection ===")
    
    # Get all objects to see what's in the database
    response = requests.get("http://localhost:8000/api/v1/objects")
    if response.status_code == 200:
        objects = response.json()
        print(f"Found {len(objects)} objects in the database")
        
        # Look for our test object
        test_objects = [obj for obj in objects if "Direct Neo4j Test" in obj.get("object", "")]
        if test_objects:
            print(f"✅ Found test object: {test_objects[0]}")
        else:
            print("❌ Test object not found")
            
        # Look for the obj_002 object
        obj_002 = [obj for obj in objects if obj.get("id") == "obj_002"]
        if obj_002:
            print(f"✅ Found obj_002: {obj_002[0]}")
        else:
            print("❌ obj_002 not found")
            
        # Show all object names
        print("\n=== All Object Names ===")
        for obj in objects:
            print(f"ID: {obj.get('id')} | Object: {obj.get('object')}")
    else:
        print(f"❌ Failed to get objects: {response.status_code}")

if __name__ == "__main__":
    test_db_connection()
