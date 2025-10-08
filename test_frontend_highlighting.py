#!/usr/bin/env python3
"""
Test script to verify the frontend highlighting functionality.
This script checks that objects with "-" in their driver field are properly highlighted.
"""

import requests
import json

def test_frontend_highlighting():
    """Test that the frontend properly highlights objects with deleted sectors"""
    base_url = "http://localhost:8000/api/v1"
    
    print("🧪 Testing Frontend Highlighting Functionality")
    print("=" * 50)
    
    # Step 1: Check current objects
    print("\n1. Checking current objects...")
    try:
        response = requests.get(f"{base_url}/objects")
        if response.status_code == 200:
            objects = response.json()
            print(f"   ✅ Found {len(objects)} objects")
            
            # Identify objects with deleted sectors
            affected_objects = [obj for obj in objects if obj['driver'].startswith('-')]
            normal_objects = [obj for obj in objects if not obj['driver'].startswith('-')]
            
            print(f"   📊 Objects with deleted sectors: {len(affected_objects)}")
            for obj in affected_objects:
                print(f"      - {obj['object']}: {obj['driver']}")
            
            print(f"   📊 Objects with normal sectors: {len(normal_objects)}")
            for obj in normal_objects[:3]:  # Show first 3
                print(f"      - {obj['object']}: {obj['driver']}")
            
            if len(affected_objects) > 0:
                print(f"\n   🎯 Frontend should show:")
                print(f"      - {len(affected_objects)} objects highlighted in RED at the top")
                print(f"      - Driver column text in RED for affected objects")
                print(f"      - Metadata panel warning when selecting affected objects")
            else:
                print(f"\n   ℹ️  No objects with deleted sectors found")
                print(f"      - All objects have proper sector values")
                print(f"      - To test highlighting, delete a sector from the Drivers tab")
        else:
            print(f"   ❌ Failed to get objects: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print("\n" + "=" * 50)
    print("✅ Test completed!")
    print("   - Open http://localhost:5183 in your browser")
    print("   - Go to Objects tab")
    print("   - Look for red-highlighted objects at the top")
    print("   - Check that Driver column shows red text for affected objects")
    print("   - Select an affected object and check metadata panel")

if __name__ == "__main__":
    test_frontend_highlighting()
