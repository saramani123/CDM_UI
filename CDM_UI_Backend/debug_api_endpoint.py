#!/usr/bin/env python3

import requests
import json

def test_api_endpoint():
    # Test the API endpoint directly
    url = "http://localhost:8000/api/v1/objects/ea6ca5d6-be9c-4be3-9fe4-c0d8e2bb40a0/relationships"
    
    data = {
        "relationship_type": "Inter-Table",
        "role": "API Debug Test",
        "to_being": "Master",
        "to_avatar": "Company Affiliate",
        "to_object": "ALL"
    }
    
    print(f"Testing API endpoint: {url}")
    print(f"Data: {data}")
    
    try:
        response = requests.post(url, data=data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        # Check the relationships after the API call
        get_url = "http://localhost:8000/api/v1/objects/ea6ca5d6-be9c-4be3-9fe4-c0d8e2bb40a0"
        get_response = requests.get(get_url)
        
        if get_response.status_code == 200:
            obj_data = get_response.json()
            print(f"\nObject relationships after API call: {obj_data['relationships']}")
            print("Relationships list:")
            for rel in obj_data['relationshipsList']:
                print(f"  - {rel['toBeing']} + {rel['toAvatar']} + {rel['toObject']} (Role: {rel['role']})")
        else:
            print(f"Failed to get object data: {get_response.status_code}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_api_endpoint()
