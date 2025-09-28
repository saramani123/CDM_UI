#!/usr/bin/env python3

import requests
import json

def test_relationship_creation():
    """Test the relationship creation API endpoint"""
    
    # Test data
    object_id = "ea6ca5d6-be9c-4be3-9fe4-c0d8e2bb40a0"
    url = f"http://localhost:8000/api/v1/objects/{object_id}/relationships"
    
    data = {
        'relationship_type': 'Inter-Table',
        'role': 'API Debug Test',
        'to_being': 'Master',
        'to_avatar': 'Company Affiliate',
        'to_object': 'ALL'
    }
    
    print(f"Testing relationship creation API...")
    print(f"URL: {url}")
    print(f"Data: {data}")
    
    try:
        response = requests.post(url, data=data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
        # Check the object after creation
        get_url = f"http://localhost:8000/api/v1/objects/{object_id}"
        get_response = requests.get(get_url)
        if get_response.status_code == 200:
            obj_data = get_response.json()
            print(f"\nObject after creation:")
            print(f"Total relationships: {obj_data['relationships']}")
            print("Relationships:")
            for rel in obj_data['relationshipsList']:
                print(f"  - {rel['role']} -> {rel['toBeing']} + {rel['toAvatar']} + {rel['toObject']}")
        else:
            print(f"Error getting object: {get_response.status_code}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_relationship_creation()
