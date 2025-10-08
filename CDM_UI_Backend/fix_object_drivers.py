#!/usr/bin/env python3

import requests
import json

# Configuration
BASE_URL = "http://localhost:8000/api/v1"

def fix_object_drivers():
    """Fix objects that have '-' in their driver strings"""
    print("🔧 Fixing object driver strings...")
    
    # Get all objects
    try:
        response = requests.get(f"{BASE_URL}/objects")
        if response.status_code == 200:
            objects = response.json()
            print(f"📊 Found {len(objects)} objects")
            
            # Fix objects with '-' in their driver strings
            for obj in objects:
                driver_parts = obj['driver'].split(', ')
                if len(driver_parts) == 4 and driver_parts[0] == '-':
                    # This object has a missing sector, let's fix it based on the object name
                    object_name = obj['object']
                    new_sector = None
                    
                    # Determine the correct sector based on object name
                    if object_name in ['Bank Transfer', 'Wire Transfer', 'Insurance Claim']:
                        new_sector = 'Finance'
                    elif object_name in ['Online Purchase', 'Store Sale']:
                        new_sector = 'Retail'
                    elif object_name in ['Patient Checkup', 'Medical Diagnosis']:
                        new_sector = 'Healthcare'
                    elif object_name == 'Software Development':
                        new_sector = 'Technology'
                    elif object_name == 'Production Line':
                        new_sector = 'Manufacturing'
                    
                    if new_sector:
                        # Update the driver string
                        new_driver = f"{new_sector}, {driver_parts[1]}, {driver_parts[2]}, {driver_parts[3]}"
                        
                        # Update the object in the database
                        update_data = {
                            "driver": new_driver
                        }
                        
                        try:
                            update_response = requests.put(f"{BASE_URL}/objects/{obj['id']}", json=update_data)
                            if update_response.status_code == 200:
                                print(f"✅ Fixed {object_name}: {obj['driver']} → {new_driver}")
                            else:
                                print(f"❌ Failed to update {object_name}: {update_response.text}")
                        except Exception as e:
                            print(f"❌ Error updating {object_name}: {e}")
                    else:
                        print(f"⚠️  Could not determine sector for {object_name}")
                else:
                    print(f"✅ {obj['object']}: {obj['driver']} (already correct)")
            
            print("\n🎉 Driver string fixes complete!")
            
        else:
            print(f"❌ Failed to get objects: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    fix_object_drivers()
