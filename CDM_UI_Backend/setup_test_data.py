#!/usr/bin/env python3

import requests
import json
import time

# Configuration
BASE_URL = "http://localhost:8000/api/v1"

def clear_database():
    """Clear all existing objects and drivers"""
    print("🧹 Clearing existing data...")
    
    # Get all objects and delete them
    try:
        response = requests.get(f"{BASE_URL}/objects")
        if response.status_code == 200:
            objects = response.json()
            for obj in objects:
                requests.delete(f"{BASE_URL}/objects/{obj['id']}")
            print(f"✅ Deleted {len(objects)} existing objects")
    except Exception as e:
        print(f"⚠️  Error clearing objects: {e}")
    
    # Clear drivers (sectors, domains, countries)
    driver_types = ['sectors', 'domains', 'countries', 'objectClarifiers', 'variableClarifiers']
    for driver_type in driver_types:
        try:
            response = requests.get(f"{BASE_URL}/drivers/{driver_type}")
            if response.status_code == 200:
                drivers = response.json()
                for driver in drivers:
                    requests.delete(f"{BASE_URL}/drivers/{driver_type}/{driver}")
                print(f"✅ Cleared {driver_type}: {len(drivers)} drivers")
        except Exception as e:
            print(f"⚠️  Error clearing {driver_type}: {e}")

def create_test_drivers():
    """Create 5 test drivers"""
    print("🏗️  Creating test drivers...")
    
    # Test sectors
    sectors = ["Finance", "Healthcare", "Retail"]
    for sector in sectors:
        try:
            response = requests.post(f"{BASE_URL}/drivers/sectors", json={"name": sector})
            if response.status_code == 200:
                print(f"✅ Created sector: {sector}")
        except Exception as e:
            print(f"⚠️  Error creating sector {sector}: {e}")
    
    # Test domains  
    domains = ["Banking", "Insurance"]
    for domain in domains:
        try:
            response = requests.post(f"{BASE_URL}/drivers/domains", json={"name": domain})
            if response.status_code == 200:
                print(f"✅ Created domain: {domain}")
        except Exception as e:
            print(f"⚠️  Error creating domain {domain}: {e}")
    
    # Test countries
    countries = ["USA", "Canada"]
    for country in countries:
        try:
            response = requests.post(f"{BASE_URL}/drivers/countries", json={"name": country})
            if response.status_code == 200:
                print(f"✅ Created country: {country}")
        except Exception as e:
            print(f"⚠️  Error creating country {country}: {e}")

def create_test_objects():
    """Create 10 test objects with specific driver relationships"""
    print("🏗️  Creating test objects...")
    
    test_objects = [
        # Objects with Finance sector
        {
            "sector": ["Finance"],
            "domain": ["Banking"],
            "country": ["USA"],
            "objectClarifier": "None",
            "being": "Process",
            "avatar": "Transaction",
            "object": "Bank Transfer",
            "status": "Active"
        },
        {
            "sector": ["Finance"],
            "domain": ["Banking"],
            "country": ["Canada"],
            "objectClarifier": "None",
            "being": "Process",
            "avatar": "Transaction",
            "object": "Wire Transfer",
            "status": "Active"
        },
        {
            "sector": ["Finance"],
            "domain": ["Insurance"],
            "country": ["USA"],
            "objectClarifier": "None",
            "being": "Process",
            "avatar": "Transaction",
            "object": "Insurance Claim",
            "status": "Active"
        },
        
        # Objects with Healthcare sector
        {
            "sector": ["Healthcare"],
            "domain": ["ALL"],
            "country": ["USA"],
            "objectClarifier": "None",
            "being": "Process",
            "avatar": "Activity",
            "object": "Patient Checkup",
            "status": "Active"
        },
        {
            "sector": ["Healthcare"],
            "domain": ["ALL"],
            "country": ["Canada"],
            "objectClarifier": "None",
            "being": "Process",
            "avatar": "Activity",
            "object": "Medical Diagnosis",
            "status": "Active"
        },
        
        # Objects with Retail sector
        {
            "sector": ["Retail"],
            "domain": ["ALL"],
            "country": ["USA"],
            "objectClarifier": "None",
            "being": "Process",
            "avatar": "Transaction",
            "object": "Online Purchase",
            "status": "Active"
        },
        {
            "sector": ["Retail"],
            "domain": ["ALL"],
            "country": ["Canada"],
            "objectClarifier": "None",
            "being": "Process",
            "avatar": "Transaction",
            "object": "Store Sale",
            "status": "Active"
        },
        
        # Objects with ALL sectors (should not be affected by sector deletion)
        {
            "sector": ["ALL"],
            "domain": ["ALL"],
            "country": ["ALL"],
            "objectClarifier": "None",
            "being": "Process",
            "avatar": "Activity",
            "object": "Generic Process",
            "status": "Active"
        },
        {
            "sector": ["ALL"],
            "domain": ["ALL"],
            "country": ["ALL"],
            "objectClarifier": "None",
            "being": "Master",
            "avatar": "Product",
            "object": "Generic Product",
            "status": "Active"
        },
        {
            "sector": ["ALL"],
            "domain": ["ALL"],
            "country": ["ALL"],
            "objectClarifier": "None",
            "being": "Mate",
            "avatar": "Person",
            "object": "Generic Person",
            "status": "Active"
        }
    ]
    
    created_objects = []
    for i, obj_data in enumerate(test_objects, 1):
        try:
            response = requests.post(f"{BASE_URL}/objects", json=obj_data)
            if response.status_code == 200:
                created_obj = response.json()
                created_objects.append(created_obj)
                print(f"✅ Created object {i}/10: {created_obj['object']} (Driver: {created_obj['driver']})")
            else:
                print(f"❌ Failed to create object {i}: {response.text}")
        except Exception as e:
            print(f"❌ Error creating object {i}: {e}")
    
    return created_objects

def verify_relationships():
    """Verify that objects have proper relationships in Neo4j"""
    print("🔍 Verifying relationships...")
    
    try:
        # Get all objects
        response = requests.get(f"{BASE_URL}/objects")
        if response.status_code == 200:
            objects = response.json()
            print(f"📊 Found {len(objects)} objects in database")
            
            # Show driver strings
            for obj in objects:
                print(f"  - {obj['object']}: {obj['driver']}")
            
            return objects
        else:
            print(f"❌ Failed to get objects: {response.text}")
            return []
    except Exception as e:
        print(f"❌ Error verifying relationships: {e}")
        return []

def main():
    print("🚀 Setting up clean test environment...")
    print("=" * 50)
    
    # Step 1: Clear existing data
    clear_database()
    time.sleep(2)  # Wait for cleanup
    
    # Step 2: Create test drivers
    create_test_drivers()
    time.sleep(2)  # Wait for drivers to be created
    
    # Step 3: Create test objects
    created_objects = create_test_objects()
    time.sleep(2)  # Wait for objects to be created
    
    # Step 4: Verify relationships
    objects = verify_relationships()
    
    print("\n" + "=" * 50)
    print("✅ Test environment setup complete!")
    print(f"📊 Created {len(created_objects)} objects")
    print("\n🎯 Test scenarios:")
    print("1. Delete 'Finance' sector → Should affect 3 objects (Bank Transfer, Wire Transfer, Insurance Claim)")
    print("2. Delete 'Healthcare' sector → Should affect 2 objects (Patient Checkup, Medical Diagnosis)")
    print("3. Delete 'Retail' sector → Should affect 2 objects (Online Purchase, Store Sale)")
    print("4. Objects with 'ALL' sectors should NOT be affected")
    print("\n🌐 Frontend URL: http://localhost:5182")
    print("🔧 Backend URL: http://localhost:8000")

if __name__ == "__main__":
    main()
