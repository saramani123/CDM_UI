#!/usr/bin/env python3
"""
Test script to verify the CDM_U Backend server is working correctly
"""

import requests
import time
import subprocess
import sys
import os

def start_server():
    """Start the server in the background"""
    print("Starting CDM_U Backend server...")
    process = subprocess.Popen([
        sys.executable, "main.py"
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    # Wait for server to start
    time.sleep(3)
    return process

def test_endpoints():
    """Test all endpoints"""
    base_url = "http://localhost:8000"
    
    tests = [
        ("/", "Root endpoint"),
        ("/health", "Health check"),
        ("/api/v1/objects", "Objects endpoint"),
        ("/docs", "API documentation")
    ]
    
    results = []
    
    for endpoint, description in tests:
        try:
            response = requests.get(f"{base_url}{endpoint}", timeout=5)
            status = "✅ PASS" if response.status_code == 200 else f"❌ FAIL ({response.status_code})"
            results.append((description, status, response.status_code))
            print(f"{description}: {status}")
            
            if endpoint == "/api/v1/objects" and response.status_code == 200:
                data = response.json()
                print(f"  Returned {len(data)} objects")
                if data:
                    print(f"  First object: {data[0].get('object', 'N/A')}")
                    
        except requests.exceptions.RequestException as e:
            results.append((description, f"❌ ERROR: {e}", 0))
            print(f"{description}: ❌ ERROR: {e}")
    
    return results

def main():
    print("CDM_U Backend Server Test")
    print("=" * 40)
    
    # Start server
    process = start_server()
    
    try:
        # Test endpoints
        results = test_endpoints()
        
        # Summary
        print("\n" + "=" * 40)
        print("Test Summary:")
        for description, status, code in results:
            print(f"  {description}: {status}")
        
        passed = sum(1 for _, status, _ in results if "✅" in status)
        total = len(results)
        print(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! Backend is working correctly.")
        else:
            print("❌ Some tests failed. Check the server configuration.")
            
    finally:
        # Clean up
        process.terminate()
        process.wait()
        print("\nServer stopped.")

if __name__ == "__main__":
    main()
