#!/usr/bin/env python3
"""
Simple test script to verify the CDM_U Backend API endpoints
"""

import requests
import json
from typing import Dict, Any

BASE_URL = "http://localhost:8000"

def test_health_endpoint():
    """Test the health check endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"Health endpoint: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  Status: {data.get('status')}")
            print(f"  Message: {data.get('message')}")
            return True
        else:
            print(f"  Error: {response.text}")
            return False
    except requests.exceptions.ConnectionError:
        print("Health endpoint: Connection failed - is the server running?")
        return False

def test_objects_endpoint():
    """Test the objects endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/api/v1/objects")
        print(f"Objects endpoint: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  Returned {len(data)} objects")
            if data:
                first_obj = data[0]
                print(f"  First object: {first_obj.get('object')} ({first_obj.get('being')} - {first_obj.get('avatar')})")
            return True
        else:
            print(f"  Error: {response.text}")
            return False
    except requests.exceptions.ConnectionError:
        print("Objects endpoint: Connection failed - is the server running?")
        return False

def test_cors_headers():
    """Test CORS headers for frontend compatibility"""
    try:
        response = requests.options(f"{BASE_URL}/api/v1/objects", 
                                  headers={"Origin": "http://localhost:5173"})
        print(f"CORS test: {response.status_code}")
        
        cors_headers = {
            "Access-Control-Allow-Origin": response.headers.get("Access-Control-Allow-Origin"),
            "Access-Control-Allow-Methods": response.headers.get("Access-Control-Allow-Methods"),
            "Access-Control-Allow-Headers": response.headers.get("Access-Control-Allow-Headers")
        }
        
        print(f"  CORS headers: {cors_headers}")
        return True
    except requests.exceptions.ConnectionError:
        print("CORS test: Connection failed - is the server running?")
        return False

def main():
    """Run all tests"""
    print("CDM_U Backend API Tests")
    print("=" * 40)
    
    tests = [
        ("Health Check", test_health_endpoint),
        ("Objects Endpoint", test_objects_endpoint),
        ("CORS Headers", test_cors_headers)
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n{test_name}:")
        result = test_func()
        results.append((test_name, result))
    
    print("\n" + "=" * 40)
    print("Test Results:")
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"  {test_name}: {status}")
    
    all_passed = all(result for _, result in results)
    print(f"\nOverall: {'PASS' if all_passed else 'FAIL'}")
    
    if all_passed:
        print("\n✅ Backend is ready for frontend connection!")
        print("   Frontend can now connect to http://localhost:8000")
    else:
        print("\n❌ Some tests failed. Check the server status.")

if __name__ == "__main__":
    main()
