#!/usr/bin/env python3

import requests
import json

# Test Neo4j update directly
def test_neo4j_update():
    url = "http://localhost:8000/api/v1/objects/obj_002"
    
    # First, get the current object
    print("=== Getting current object ===")
    response = requests.get(url)
    print(f"Status: {response.status_code}")
    print(f"Current object: {response.json()}")
    
    # Update the object
    print("\n=== Updating object ===")
    update_data = {
        "being": "Master",
        "avatar": "Company", 
        "object": "Direct Neo4j Test",
        "driver": "Banking, Claims, Algeria, None"
    }
    
    response = requests.put(url, json=update_data)
    print(f"Status: {response.status_code}")
    print(f"Update response: {response.json()}")
    
    # Get the object again to verify
    print("\n=== Verifying update ===")
    response = requests.get(url)
    print(f"Status: {response.status_code}")
    print(f"Updated object: {response.json()}")

if __name__ == "__main__":
    test_neo4j_update()
