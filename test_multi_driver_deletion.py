#!/usr/bin/env python3
"""
Test script for multi-driver deletion functionality
This script tests the complete functionality for deleting sectors, domains, and object clarifiers
and verifies that the frontend correctly highlights affected objects.
"""

import requests
import json
import time

def test_multi_driver_deletion():
    print("🧪 Testing Multi-Driver Deletion Functionality")
    print("=" * 70)
    
    base_url = "http://localhost:8000/api/v1"
    
    # Step 1: Reset to clean state
    print("1. Resetting to clean state...")
    try:
        # Add back missing drivers
        drivers_to_add = [
            ("sectors", "Insurance"),
            ("domains", "Finance"),
            ("objectClarifiers", "Primary")
        ]
        
        for driver_type, name in drivers_to_add:
            response = requests.post(f"{base_url}/drivers/{driver_type}", json={"name": name})
            if response.status_code == 200:
                print(f"   ✅ Added {name} to {driver_type}")
            else:
                print(f"   ⚠️  {name} already exists in {driver_type}")
        
        # Reset objects to clean state
        clean_objects = [
            {"object": "Bank Transfer", "driver": "Insurance, Finance, USA, None"},
            {"object": "Wire Transfer", "driver": "Insurance, Finance, Canada, None"},
            {"object": "Store Sale", "driver": "Insurance, ALL, Canada, None"},
            {"object": "Insurance Claim", "driver": "Insurance, Claims, USA, None"},
            {"object": "Production Line", "driver": "Manufacturing, Production, Germany, Primary"},
            {"object": "Online Purchase", "driver": "Healthcare, E-commerce, USA, None"}
        ]
        
        for obj_data in clean_objects:
            response = requests.put(f"{base_url}/objects/{obj_data['object']}", json={"driver": obj_data['driver']})
            if response.status_code == 200:
                print(f"   ✅ Reset {obj_data['object']}: {obj_data['driver']}")
        
    except Exception as e:
        print(f"   ❌ Error resetting: {e}")
        return
    
    # Step 2: Test sector deletion
    print("\n2. Testing sector deletion (Insurance)...")
    try:
        response = requests.delete(f"{base_url}/drivers/sectors/Insurance")
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Insurance sector deleted")
            print(f"   📊 Affected objects: {result['affected_objects_count']}")
            for obj in result['affected_objects']:
                print(f"      - {obj['object']}: {obj['driver']}")
        else:
            print(f"   ❌ Failed to delete sector: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error deleting sector: {e}")
    
    # Step 3: Test domain deletion
    print("\n3. Testing domain deletion (Finance)...")
    try:
        response = requests.delete(f"{base_url}/drivers/domains/Finance")
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Finance domain deleted")
            print(f"   📊 Affected objects: {result['affected_objects_count']}")
            for obj in result['affected_objects']:
                print(f"      - {obj['object']}: {obj['driver']}")
        else:
            print(f"   ❌ Failed to delete domain: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error deleting domain: {e}")
    
    # Step 4: Test object clarifier deletion
    print("\n4. Testing object clarifier deletion (Primary)...")
    try:
        response = requests.delete(f"{base_url}/drivers/objectClarifiers/Primary")
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Primary object clarifier deleted")
            print(f"   📊 Affected objects: {result['affected_objects_count']}")
            for obj in result['affected_objects']:
                print(f"      - {obj['object']}: {obj['driver']}")
        else:
            print(f"   ❌ Failed to delete object clarifier: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error deleting object clarifier: {e}")
    
    # Step 5: Verify final state
    print("\n5. Verifying final state...")
    try:
        response = requests.get(f"{base_url}/objects")
        if response.status_code == 200:
            updated_objects = response.json()
            print(f"   ✅ Found {len(updated_objects)} objects")
            
            # Check for objects with dashes
            objects_with_dash = [obj for obj in updated_objects if '-' in obj['driver']]
            print(f"   📊 Objects with dashes: {len(objects_with_dash)}")
            for obj in objects_with_dash:
                print(f"      - {obj['object']}: {obj['driver']}")
            
            # Analyze the dashes
            print(f"\n   🔍 Analysis of dashes:")
            for obj in objects_with_dash:
                parts = obj['driver'].split(', ')
                if len(parts) >= 4:
                    dash_positions = []
                    if parts[0] == '-': dash_positions.append('sector')
                    if parts[1] == '-': dash_positions.append('domain')
                    if parts[2] == '-': dash_positions.append('country')
                    if parts[3] == '-': dash_positions.append('objectClarifier')
                    print(f"      - {obj['object']}: Missing {', '.join(dash_positions)}")
            
        else:
            print(f"   ❌ Failed to get updated objects: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error verifying objects: {e}")
    
    print("\n" + "=" * 70)
    print("✅ Backend test completed!")
    print("\n🎯 Frontend Verification Checklist:")
    print("   1. Open http://localhost:5183 in your browser")
    print("   2. Go to the Objects tab")
    print("   3. Verify that objects with dashes are highlighted in red at the top")
    print("   4. Check that the Driver column shows dashes for deleted drivers")
    print("   5. Click on an affected object to open the metadata panel")
    print("   6. Verify that deleted driver fields show:")
    print("      - Red asterisk (*) next to the field name")
    print("      - 'Please reselect [driver type]' warning message")
    print("      - Empty selection (cleared values)")
    print("   7. Test that multiple driver types can be deleted simultaneously")
    print("   8. Verify that the highlighting works for all driver types:")
    print("      - Sectors (first position)")
    print("      - Domains (second position)")
    print("      - Object Clarifiers (fourth position)")

if __name__ == "__main__":
    test_multi_driver_deletion()
