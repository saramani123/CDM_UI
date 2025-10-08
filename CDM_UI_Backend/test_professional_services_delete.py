#!/usr/bin/env python3

import requests
import json

def test_professional_services_delete():
    """Test deleting the Professional Services sector"""
    
    print("🧪 Testing delete logic for sector: Professional Services")
    print("=" * 60)
    
    # First, let's see what objects currently exist
    print("📋 Current objects in the system:")
    response = requests.get("http://localhost:8000/api/v1/objects")
    if response.status_code == 200:
        objects = response.json()
        print(f"Total objects: {len(objects)}")
        
        # Show first few objects with their driver strings
        for i, obj in enumerate(objects[:5]):
            print(f"  {i+1}. {obj['object']} - Driver: {obj['driver']}")
        
        print("  ...")
    else:
        print(f"❌ Failed to get objects: {response.status_code}")
        return
    
    print("\n" + "=" * 60)
    print(f"🗑️  Testing delete of sector: Professional Services")
    
    # Test the delete endpoint
    try:
        response = requests.delete("http://localhost:8000/api/v1/drivers/sectors/Professional%20Services")
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
                for i, obj in enumerate(result['affected_objects'][:10]):  # Show first 10
                    print(f"  {i+1}. {obj['object']} - Driver: {obj['driver']}")
                if len(result['affected_objects']) > 10:
                    print(f"  ... and {len(result['affected_objects']) - 10} more")
            else:
                print("  ✅ No affected objects found (this is correct since all objects use 'ALL')")
            
            if 'affected_variables' in result and result['affected_variables']:
                print(f"\n🎯 Affected variables:")
                for i, var in enumerate(result['affected_variables'][:10]):  # Show first 10
                    print(f"  {i+1}. {var['variable']} - Driver: {var['driver']}")
                if len(result['affected_variables']) > 10:
                    print(f"  ... and {len(result['affected_variables']) - 10} more")
            else:
                print("  ✅ No affected variables found (this is correct since all variables use 'ALL')")
        else:
            print(f"❌ Delete failed: {response.text}")
            
    except Exception as e:
        print(f"❌ Error during delete: {e}")

if __name__ == "__main__":
    test_professional_services_delete()
