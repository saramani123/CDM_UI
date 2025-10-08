#!/usr/bin/env python3

import requests
import json

def fix_driver_strings_via_api():
    """Fix malformed driver strings using the backend API"""
    
    print("🔧 Fixing driver strings via API...")
    
    # Get all objects
    response = requests.get("http://localhost:8000/api/v1/objects")
    if response.status_code != 200:
        print(f"❌ Failed to get objects: {response.status_code}")
        return
    
    objects = response.json()
    print(f"📋 Found {len(objects)} objects")
    
    # Check how many have 3-part driver strings
    three_part_objects = [obj for obj in objects if obj['driver'] and obj['driver'].count(',') == 2]
    print(f"🔍 Found {len(three_part_objects)} objects with 3-part driver strings")
    
    if len(three_part_objects) > 0:
        print("📝 Sample 3-part driver strings:")
        for i, obj in enumerate(three_part_objects[:3]):
            print(f"  {i+1}. {obj['object']} - Driver: {obj['driver']}")
    
    # Fix objects with 3-part driver strings
    fixed_count = 0
    for obj in three_part_objects:
        if obj['driver'] == "ALL, ALL, None":
            # Update to 4-part driver string
            update_data = {
                "driver": "ALL, ALL, ALL, None"
            }
            
            try:
                response = requests.put(f"http://localhost:8000/api/v1/objects/{obj['id']}", json=update_data)
                if response.status_code == 200:
                    fixed_count += 1
                    print(f"✅ Fixed object: {obj['object']}")
                else:
                    print(f"❌ Failed to fix object {obj['object']}: {response.status_code}")
            except Exception as e:
                print(f"❌ Error fixing object {obj['object']}: {e}")
    
    print(f"\n🎉 Fixed {fixed_count} objects with 3-part driver strings")
    
    # Verify the fix
    print("\n🔍 Verifying fix...")
    response = requests.get("http://localhost:8000/api/v1/objects")
    if response.status_code == 200:
        objects = response.json()
        print("Sample object driver strings after fix:")
        for i, obj in enumerate(objects[:3]):
            print(f"  {i+1}. {obj['object']} - Driver: {obj['driver']}")
    
    # Also fix variables
    print("\n📊 Fixing Variables...")
    response = requests.get("http://localhost:8000/api/v1/variables")
    if response.status_code == 200:
        variables = response.json()
        print(f"📋 Found {len(variables)} variables")
        
        # Check how many have 3-part driver strings
        three_part_variables = [var for var in variables if var['driver'] and var['driver'].count(',') == 2]
        print(f"🔍 Found {len(three_part_variables)} variables with 3-part driver strings")
        
        if len(three_part_variables) > 0:
            print("📝 Sample 3-part variable driver strings:")
            for i, var in enumerate(three_part_variables[:3]):
                print(f"  {i+1}. {var['variable']} - Driver: {var['driver']}")
        
        # Fix variables with 3-part driver strings
        fixed_var_count = 0
        for var in three_part_variables:
            if var['driver'] == "ALL, ALL, None":
                # Update to 4-part driver string
                update_data = {
                    "driver": "ALL, ALL, ALL, None"
                }
                
                try:
                    response = requests.put(f"http://localhost:8000/api/v1/variables/{var['id']}", json=update_data)
                    if response.status_code == 200:
                        fixed_var_count += 1
                        if fixed_var_count <= 5:  # Only show first 5
                            print(f"✅ Fixed variable: {var['variable']}")
                    else:
                        print(f"❌ Failed to fix variable {var['variable']}: {response.status_code}")
                except Exception as e:
                    print(f"❌ Error fixing variable {var['variable']}: {e}")
        
        print(f"\n🎉 Fixed {fixed_var_count} variables with 3-part driver strings")

if __name__ == "__main__":
    fix_driver_strings_via_api()
