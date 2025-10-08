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

def create_fresh_drivers():
    """Create fresh test drivers"""
    print("🏗️  Creating fresh test drivers...")
    
    # Test sectors
    sectors = ["Finance", "Healthcare", "Retail", "Technology", "Manufacturing"]
    for sector in sectors:
        try:
            response = requests.post(f"{BASE_URL}/drivers/sectors", json={"name": sector})
            if response.status_code == 200:
                print(f"✅ Created sector: {sector}")
        except Exception as e:
            print(f"⚠️  Error creating sector {sector}: {e}")
    
    # Test domains  
    domains = ["Banking", "Insurance", "E-commerce", "Software", "Production"]
    for domain in domains:
        try:
            response = requests.post(f"{BASE_URL}/drivers/domains", json={"name": domain})
            if response.status_code == 200:
                print(f"✅ Created domain: {domain}")
        except Exception as e:
            print(f"⚠️  Error creating domain {domain}: {e}")
    
    # Test countries
    countries = ["USA", "Canada", "UK", "Germany", "France"]
    for country in countries:
        try:
            response = requests.post(f"{BASE_URL}/drivers/countries", json={"name": country})
            if response.status_code == 200:
                print(f"✅ Created country: {country}")
        except Exception as e:
            print(f"⚠️  Error creating country {country}: {e}")

def create_fresh_objects():
    """Create fresh test objects with SPECIFIC driver selections"""
    print("🏗️  Creating fresh test objects...")
    
    test_objects = [
        # Finance sector objects
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
        
        # Healthcare sector objects
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
        
        # Retail sector objects
        {
            "sector": ["Retail"],
            "domain": ["E-commerce"],
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
        
        # Technology sector objects
        {
            "sector": ["Technology"],
            "domain": ["Software"],
            "country": ["USA"],
            "objectClarifier": "None",
            "being": "Process",
            "avatar": "Activity",
            "object": "Software Development",
            "status": "Active"
        },
        
        # Manufacturing sector objects
        {
            "sector": ["Manufacturing"],
            "domain": ["Production"],
            "country": ["Germany"],
            "objectClarifier": "None",
            "being": "Process",
            "avatar": "Activity",
            "object": "Production Line",
            "status": "Active"
        },
        
        # ALL sector objects (should not be affected by deletions)
        {
            "sector": ["ALL"],
            "domain": ["ALL"],
            "country": ["ALL"],
            "objectClarifier": "None",
            "being": "Process",
            "avatar": "Activity",
            "object": "Generic Process",
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

def verify_objects():
    """Verify that all objects have 4-part driver strings"""
    print("🔍 Verifying objects have 4-part driver strings...")
    
    try:
        response = requests.get(f"{BASE_URL}/objects")
        if response.status_code == 200:
            objects = response.json()
            print(f"📊 Found {len(objects)} objects in database")
            
            all_correct = True
            for obj in objects:
                driver_parts = obj['driver'].split(', ')
                if len(driver_parts) != 4:
                    print(f"❌ {obj['object']}: {obj['driver']} ({len(driver_parts)} parts)")
                    all_correct = False
                else:
                    print(f"✅ {obj['object']}: {obj['driver']} ({len(driver_parts)} parts)")
            
            if all_correct:
                print("🎉 All objects have correct 4-part driver strings!")
            else:
                print("⚠️  Some objects have incorrect driver string format")
            
            return objects
        else:
            print(f"❌ Failed to get objects: {response.text}")
            return []
    except Exception as e:
        print(f"❌ Error verifying objects: {e}")
        return []

def main():
    print("🚀 Setting up completely fresh test environment...")
    print("=" * 70)
    
    # Step 1: Clear existing data
    clear_database()
    time.sleep(3)  # Wait for cleanup
    
    # Step 2: Create fresh drivers
    create_fresh_drivers()
    time.sleep(3)  # Wait for drivers to be created
    
    # Step 3: Create fresh objects
    created_objects = create_fresh_objects()
    time.sleep(3)  # Wait for objects to be created
    
    # Step 4: Verify all objects have 4-part driver strings
    objects = verify_objects()
    
    print("\n" + "=" * 70)
    print("✅ Fresh test environment setup complete!")
    print(f"📊 Created {len(created_objects)} objects")
    print("\n🎯 Test scenarios:")
    print("1. Delete 'Finance' sector → Should affect 3 objects (Bank Transfer, Wire Transfer, Insurance Claim)")
    print("2. Delete 'Healthcare' sector → Should affect 2 objects (Patient Checkup, Medical Diagnosis)")
    print("3. Delete 'Retail' sector → Should affect 2 objects (Online Purchase, Store Sale)")
    print("4. Delete 'Technology' sector → Should affect 1 object (Software Development)")
    print("5. Delete 'Manufacturing' sector → Should affect 1 object (Production Line)")
    print("6. Objects with 'ALL' sectors should NOT be affected")
    print("\n🌐 Frontend URL: http://localhost:5182")
    print("🔧 Backend URL: http://localhost:8000")

if __name__ == "__main__":
    main()
