#!/usr/bin/env python3
"""
Test script to verify the delete functionality works correctly.
"""

import requests
import json

def test_delete_driver():
    """Test deleting a driver and verify the relationships are removed."""
    
    # Test deleting "Manufacturing" sector
    driver_type = "sectors"
    driver_name = "Manufacturing"
    
    print(f"Testing deletion of {driver_name} from {driver_type}")
    
    # Make the delete request
    url = f"http://localhost:8000/api/v1/drivers/{driver_type}/{driver_name}"
    
    try:
        response = requests.delete(url)
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Delete successful: {result.get('message', 'No message')}")
            print(f"Affected objects: {result.get('affected_objects_count', 0)}")
            print(f"Affected variables: {result.get('affected_variables_count', 0)}")
            
            if result.get('affected_objects'):
                print("Affected objects details:")
                for obj in result['affected_objects'][:3]:  # Show first 3
                    print(f"  - {obj.get('object', 'Unknown')} (ID: {obj.get('id', 'Unknown')})")
        else:
            print(f"Delete failed: {response.text}")
            
    except Exception as e:
        print(f"Error making request: {e}")

if __name__ == "__main__":
    test_delete_driver()
