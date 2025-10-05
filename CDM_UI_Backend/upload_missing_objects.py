#!/usr/bin/env python3
"""
Script to upload only the missing objects from CSV.
"""

import csv
import requests
import json

def get_existing_objects():
    """Get all existing objects to check for duplicates"""
    try:
        response = requests.get('http://localhost:8000/api/v1/objects')
        if response.status_code == 200:
            objects = response.json()
            # Create a set of existing Being/Avatar/Object combinations
            existing = set()
            for obj in objects:
                key = f"{obj['being']}|{obj['avatar']}|{obj['object']}"
                existing.add(key)
            return existing
        else:
            print(f"Failed to get existing objects: {response.status_code}")
            return set()
    except Exception as e:
        print(f"Error getting existing objects: {e}")
        return set()

def upload_missing_objects():
    """Upload only the missing objects from CSV"""
    csv_file = '/Users/romikapoor/CDM Screens/CDM_UI_Backend/Test_Obj_Upload.csv'
    
    # Get existing objects
    existing_objects = get_existing_objects()
    print(f"Found {len(existing_objects)} existing objects")
    
    successful = 0
    failed = 0
    skipped = 0
    
    with open(csv_file, 'r') as f:
        reader = csv.DictReader(f)
        
        for row_num, row in enumerate(reader, start=2):  # Start at 2 because of header
            # Check if this combination already exists
            key = f"{row['Being']}|{row['Avatar']}|{row['Object']}"
            if key in existing_objects:
                skipped += 1
                print(f"⏭️  Row {row_num}: {row['Being']} - {row['Avatar']} - {row['Object']} (already exists)")
                continue
            
            # Convert CSV row to API format
            object_data = {
                "sector": [row['Sector']] if row['Sector'] != 'ALL' else ['ALL'],
                "domain": [row['Domain']] if row['Domain'] != 'ALL' else ['ALL'],
                "country": [row['Country']] if row['Country'] != 'ALL' else ['ALL'],
                "objectClarifier": row['Object Clarifier'] if row['Object Clarifier'] != 'None' else None,
                "being": row['Being'],
                "avatar": row['Avatar'],
                "object": row['Object'],
                "relationships": [],
                "variants": [],
                "status": "Active"
            }
            
            try:
                response = requests.post('http://localhost:8000/api/v1/objects', json=object_data)
                if response.status_code == 201:
                    successful += 1
                    print(f"✅ Row {row_num}: {row['Being']} - {row['Avatar']} - {row['Object']}")
                else:
                    failed += 1
                    error_msg = response.text
                    print(f"❌ Row {row_num}: {row['Being']} - {row['Avatar']} - {row['Object']} - {response.status_code}: {error_msg}")
            except Exception as e:
                failed += 1
                print(f"❌ Row {row_num}: {row['Being']} - {row['Avatar']} - {row['Object']} - Exception: {e}")
    
    print(f"\n=== SUMMARY ===")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    print(f"Skipped (already exist): {skipped}")
    print(f"Total processed: {successful + failed + skipped}")
    
    # Check final count
    try:
        response = requests.get('http://localhost:8000/api/v1/objects')
        if response.status_code == 200:
            final_count = len(response.json())
            print(f"Final object count: {final_count}")
        else:
            print(f"Failed to get final count: {response.status_code}")
    except Exception as e:
        print(f"Error getting final count: {e}")

if __name__ == "__main__":
    upload_missing_objects()
