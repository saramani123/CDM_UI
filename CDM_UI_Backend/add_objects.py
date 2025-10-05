#!/usr/bin/env python3
"""
Script to add the missing objects to restore the database.
"""

import requests
import json

# Object data based on the mock data - converted to API format
objects_data = [
    {
        "sector": ["ALL"],
        "domain": ["ALL"],
        "country": ["ALL"],
        "objectClarifier": "Employment Type",
        "being": "Master",
        "avatar": "Company",
        "object": "Company",
        "relationships": [],
        "variants": [],
        "status": "Active"
    },
    {
        "sector": ["ALL"],
        "domain": ["ALL"],
        "country": ["ALL"],
        "objectClarifier": "Pay Type",
        "being": "Master",
        "avatar": "Company Affiliate",
        "object": "Entity",
        "relationships": [],
        "variants": [],
        "status": "Active"
    },
    {
        "sector": ["Technology"],
        "domain": ["Human Resources"],
        "country": ["United States"],
        "objectClarifier": "Employment Type",
        "being": "Master",
        "avatar": "Company Affiliate",
        "object": "Department",
        "relationships": [],
        "variants": [],
        "status": "Active"
    },
    {
        "sector": ["Healthcare"],
        "domain": ["Finance & Accounting"],
        "country": ["Canada"],
        "objectClarifier": "Pay Type",
        "being": "Master",
        "avatar": "Company Affiliate",
        "object": "Team",
        "relationships": [],
        "variants": [],
        "status": "Active"
    },
    {
        "sector": ["Financial Services"],
        "domain": ["Sales & Marketing"],
        "country": ["United Kingdom"],
        "objectClarifier": "Hour Type",
        "being": "Master",
        "avatar": "Company Affiliate",
        "object": "Region",
        "relationships": [],
        "variants": [],
        "status": "Active"
    },
    {
        "sector": ["Manufacturing"],
        "domain": ["Operations"],
        "country": ["Germany"],
        "objectClarifier": None,
        "being": "Master",
        "avatar": "Company Affiliate",
        "object": "Location",
        "relationships": [],
        "variants": [],
        "status": "Active"
    },
    {
        "sector": ["ALL"],
        "domain": ["ALL"],
        "country": ["ALL"],
        "objectClarifier": "Employment Type",
        "being": "Master",
        "avatar": "Employee",
        "object": "Employee",
        "relationships": [],
        "variants": [],
        "status": "Active"
    },
    {
        "sector": ["Technology"],
        "domain": ["Information Technology"],
        "country": ["United States"],
        "objectClarifier": "Pay Type",
        "being": "Master",
        "avatar": "Employee",
        "object": "Employee",
        "relationships": [],
        "variants": [],
        "status": "Active"
    },
    {
        "sector": ["Insurance"],
        "domain": ["Legal & Compliance"],
        "country": ["United States"],
        "objectClarifier": "Hour Type",
        "being": "Master",
        "avatar": "Employee",
        "object": "Employee",
        "relationships": [],
        "variants": [],
        "status": "Active"
    },
    {
        "sector": ["ALL"],
        "domain": ["ALL"],
        "country": ["ALL"],
        "objectClarifier": None,
        "being": "Master",
        "avatar": "Product",
        "object": "Product",
        "relationships": [],
        "variants": [],
        "status": "Active"
    }
]

def add_objects():
    """Add objects using the API"""
    created_count = 0
    failed_count = 0
    
    for obj in objects_data:
        try:
            response = requests.post('http://localhost:8000/api/v1/objects', json=obj)
            if response.status_code == 200:
                created_count += 1
                print(f"Created object: {obj['object']}")
            else:
                failed_count += 1
                print(f"Failed to create object {obj['object']}: {response.status_code} - {response.text}")
        except Exception as e:
            failed_count += 1
            print(f"Error creating object {obj['object']}: {e}")
    
    print(f"\nSummary: {created_count} objects created, {failed_count} failed")
    return created_count, failed_count

if __name__ == "__main__":
    print("Adding objects to restore the database...")
    created, failed = add_objects()
    print(f"Object restoration complete! Created: {created}, Failed: {failed}")
