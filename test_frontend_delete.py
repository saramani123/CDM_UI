#!/usr/bin/env python3
"""
Test script to verify the complete driver deletion functionality.
This script tests the backend API and verifies that the frontend
should display the affected objects correctly.
"""

import requests
import json
import time

def test_driver_deletion():
    """Test the complete driver deletion functionality"""
    base_url = "http://localhost:8000/api/v1"
    
    print("🧪 Testing Driver Deletion Functionality")
    print("=" * 50)
    
    # Step 1: Get initial state
    print("\n1. Getting initial objects...")
    try:
        response = requests.get(f"{base_url}/objects")
        if response.status_code == 200:
            initial_objects = response.json()
            print(f"   ✅ Found {len(initial_objects)} objects")
            
            # Show objects with Retail sector
            retail_objects = [obj for obj in initial_objects if 'Retail' in obj['driver']]
            print(f"   📊 Objects with Retail sector: {len(retail_objects)}")
            for obj in retail_objects:
                print(f"      - {obj['object']}: {obj['driver']}")
        else:
            print(f"   ❌ Failed to get objects: {response.status_code}")
            return
    except Exception as e:
        print(f"   ❌ Error getting objects: {e}")
        return
    
    # Step 2: Get available sectors
    print("\n2. Getting available sectors...")
    try:
        response = requests.get(f"{base_url}/drivers/sectors")
        if response.status_code == 200:
            sectors = response.json()
            print(f"   ✅ Available sectors: {sectors}")
        else:
            print(f"   ❌ Failed to get sectors: {response.status_code}")
            return
    except Exception as e:
        print(f"   ❌ Error getting sectors: {e}")
        return
    
    # Step 3: Delete a sector (if available)
    if sectors:
        sector_to_delete = sectors[0]
        print(f"\n3. Deleting sector '{sector_to_delete}'...")
        try:
            response = requests.delete(f"{base_url}/drivers/sectors/{sector_to_delete}")
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Sector deleted successfully")
                print(f"   📊 Affected objects: {result['affected_objects_count']}")
                print(f"   📊 Affected variables: {result['affected_variables_count']}")
                
                # Show affected objects
                for obj in result['affected_objects']:
                    print(f"      - {obj['object']}: {obj['driver']}")
            else:
                print(f"   ❌ Failed to delete sector: {response.status_code}")
                print(f"   Response: {response.text}")
                return
        except Exception as e:
            print(f"   ❌ Error deleting sector: {e}")
            return
    else:
        print("\n3. No sectors available to delete")
        return
    
    # Step 4: Verify objects were updated
    print("\n4. Verifying objects were updated...")
    try:
        response = requests.get(f"{base_url}/objects")
        if response.status_code == 200:
            updated_objects = response.json()
            print(f"   ✅ Found {len(updated_objects)} objects")
            
            # Check for objects with "-" in driver
            affected_objects = [obj for obj in updated_objects if '-' in obj['driver']]
            print(f"   📊 Objects with '-' in driver: {len(affected_objects)}")
            for obj in affected_objects:
                print(f"      - {obj['object']}: {obj['driver']}")
                
            # Verify the objects are highlighted (this would be visible in frontend)
            print(f"\n   🎯 Frontend should show:")
            print(f"      - {len(affected_objects)} objects highlighted in red at the top")
            print(f"      - Driver column showing '-' for deleted sector")
            print(f"      - Metadata panel showing 'Please reselect sector' with red star")
            
        else:
            print(f"   ❌ Failed to get updated objects: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error verifying objects: {e}")
    
    print("\n" + "=" * 50)
    print("✅ Test completed! Check the frontend at http://localhost:5173")
    print("   - Go to Objects tab")
    print("   - Look for red-highlighted objects at the top")
    print("   - Check that Driver column shows '-' for deleted sector")
    print("   - Select an affected object and check metadata panel")

if __name__ == "__main__":
    test_driver_deletion()