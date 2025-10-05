#!/usr/bin/env python3
"""
Script to upload objects from CSV one by one to debug which ones are failing.
"""

import csv
import requests
import json

def upload_objects_from_csv():
    """Upload objects from CSV one by one to identify failures"""
    csv_file = '/Users/romikapoor/CDM Screens/CDM_UI_Backend/Test_Obj_Upload.csv'
    
    successful = 0
    failed = 0
    failed_rows = []
    
    with open(csv_file, 'r') as f:
        reader = csv.DictReader(f)
        
        for row_num, row in enumerate(reader, start=2):  # Start at 2 because of header
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
                    failed_rows.append({
                        'row': row_num,
                        'data': row,
                        'error': error_msg,
                        'status_code': response.status_code
                    })
            except Exception as e:
                failed += 1
                print(f"❌ Row {row_num}: {row['Being']} - {row['Avatar']} - {row['Object']} - Exception: {e}")
                failed_rows.append({
                    'row': row_num,
                    'data': row,
                    'error': str(e),
                    'status_code': 'Exception'
                })
    
    print(f"\n=== SUMMARY ===")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    print(f"Total processed: {successful + failed}")
    
    if failed_rows:
        print(f"\n=== FAILED ROWS ===")
        for failure in failed_rows[:10]:  # Show first 10 failures
            print(f"Row {failure['row']}: {failure['data']['Being']} - {failure['data']['Avatar']} - {failure['data']['Object']}")
            print(f"  Error: {failure['error']}")
            print()

if __name__ == "__main__":
    upload_objects_from_csv()
