#!/usr/bin/env python3

import requests
import json

# Test bulk edit functionality
def test_bulk_edit():
    base_url = "http://localhost:8000"
    
    print("🧪 Testing Bulk Edit Functionality")
    print("=" * 50)
    
    # First, get all objects to see what we have
    print("1. Getting current objects...")
    try:
        response = requests.get(f"{base_url}/api/v1/objects")
        if response.status_code == 200:
            objects = response.json()
            print(f"   ✅ Found {len(objects)} objects")
            
            # Show first few objects
            for i, obj in enumerate(objects[:3]):
                print(f"   {i+1}. {obj.get('object', 'N/A')} - Being: {obj.get('being', 'N/A')}")
        else:
            print(f"   ❌ Failed to get objects: {response.status_code}")
            return
    except Exception as e:
        print(f"   ❌ Error getting objects: {e}")
        return
    
    # Test updating a single object's being field
    if objects:
        test_object = objects[0]
        object_id = test_object['id']
        current_being = test_object.get('being', 'N/A')
        
        print(f"\n2. Testing single object update...")
        print(f"   Object: {test_object.get('object', 'N/A')}")
        print(f"   Current Being: {current_being}")
        
        # Update the being field
        update_data = {
            "being": "Mate"
        }
        
        print(f"   Sending update data: {update_data}")
        
        try:
            response = requests.put(f"{base_url}/api/v1/objects/{object_id}", json=update_data)
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Update successful: {result.get('message', 'N/A')}")
                
                # Verify the update
                print("\n3. Verifying update...")
                response = requests.get(f"{base_url}/api/v1/objects/{object_id}")
                if response.status_code == 200:
                    updated_obj = response.json()
                    new_being = updated_obj.get('being', 'N/A')
                    print(f"   ✅ Object Being updated from '{current_being}' to '{new_being}'")
                else:
                    print(f"   ❌ Failed to verify update: {response.status_code}")
            else:
                print(f"   ❌ Update failed: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"   ❌ Error updating object: {e}")
    
    print("\n" + "=" * 50)
    print("✅ Bulk edit test completed!")

if __name__ == "__main__":
    test_bulk_edit()
