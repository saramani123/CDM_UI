#!/usr/bin/env python3

import requests
import json

def create_test_objects():
    """Create some test objects with specific sector selections"""
    
    print("🧪 Creating test objects with specific sector selections...")
    
    # Create objects with specific sectors
    test_objects = [
        {
            "object": "Test Object 1",
            "being": "Master",
            "avatar": "Product",
            "driver": "Retail, ALL, ALL, None"  # Specific sector: Retail
        },
        {
            "object": "Test Object 2", 
            "being": "Master",
            "avatar": "Product",
            "driver": "Professional Services, ALL, ALL, None"  # Specific sector: Professional Services
        },
        {
            "object": "Test Object 3",
            "being": "Master", 
            "avatar": "Product",
            "driver": "ALL, ALL, ALL, None"  # ALL sectors
        }
    ]
    
    created_objects = []
    for obj_data in test_objects:
        try:
            response = requests.post("http://localhost:8000/api/v1/objects", json=obj_data)
            if response.status_code == 200:
                created_obj = response.json()
                created_objects.append(created_obj)
                print(f"✅ Created: {created_obj['object']} - Driver: {created_obj['driver']}")
            else:
                print(f"❌ Failed to create {obj_data['object']}: {response.status_code}")
        except Exception as e:
            print(f"❌ Error creating {obj_data['object']}: {e}")
    
    return created_objects

def test_delete_specific_sector():
    """Test deleting a specific sector and see which objects are affected"""
    
    print("\n" + "=" * 60)
    print("🗑️  Testing delete of 'Retail' sector...")
    
    try:
        response = requests.delete("http://localhost:8000/api/v1/drivers/sectors/Retail")
        print(f"Delete response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Delete successful!")
            print(f"📊 Response data:")
            print(f"  - Message: {result.get('message', 'N/A')}")
            print(f"  - Affected objects count: {result.get('affected_objects_count', 0)}")
            print(f"  - Affected variables count: {result.get('affected_variables_count', 0)}")
            
            if 'affected_objects' in result and result['affected_objects']:
                print(f"\n🎯 Affected objects:")
                for i, obj in enumerate(result['affected_objects']):
                    print(f"  {i+1}. {obj['object']} - Driver: {obj['driver']}")
            else:
                print("  No affected objects found")
        else:
            print(f"❌ Delete failed: {response.text}")
            
    except Exception as e:
        print(f"❌ Error during delete: {e}")

if __name__ == "__main__":
    # Create test objects first
    created_objects = create_test_objects()
    
    if created_objects:
        print(f"\n📋 Created {len(created_objects)} test objects")
        
        # Test the delete functionality
        test_delete_specific_sector()
    else:
        print("❌ No test objects created, skipping delete test")
