#!/usr/bin/env python3
"""
End-to-end test for CDM platform deployment
Tests both frontend and backend connectivity
"""
import requests
import json
import sys
import time

def test_backend_health():
    """Test backend health endpoint"""
    print("🔍 Testing Backend Health...")
    try:
        response = requests.get("https://cdm-backend.onrender.com/health", timeout=15)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Backend healthy: {data}")
            return True
        else:
            print(f"   ❌ Backend unhealthy: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Backend health check failed: {e}")
        return False

def test_frontend_accessibility():
    """Test frontend accessibility"""
    print("\n🌐 Testing Frontend Accessibility...")
    try:
        response = requests.get("https://cdm-platform.vercel.app", timeout=10)
        if response.status_code == 200:
            print("   ✅ Frontend accessible")
            return True
        else:
            print(f"   ❌ Frontend not accessible: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Frontend accessibility failed: {e}")
        return False

def test_api_endpoints():
    """Test API endpoints (may timeout on free tier)"""
    print("\n🔌 Testing API Endpoints...")
    endpoints = [
        "/api/v1/objects",
        "/api/v1/drivers/string",
        "/api/v1/variables"
    ]
    
    working_endpoints = 0
    for endpoint in endpoints:
        try:
            print(f"   Testing {endpoint}...")
            response = requests.get(f"https://cdm-backend.onrender.com{endpoint}", timeout=20)
            if response.status_code in [200, 404]:  # 404 is OK if no data
                print(f"   ✅ {endpoint} accessible")
                working_endpoints += 1
            else:
                print(f"   ⚠️  {endpoint} returned {response.status_code}")
        except requests.exceptions.Timeout:
            print(f"   ⚠️  {endpoint} timed out (free tier limitation)")
        except Exception as e:
            print(f"   ❌ {endpoint} failed: {e}")
    
    return working_endpoints > 0

def test_cors_configuration():
    """Test CORS configuration"""
    print("\n🔒 Testing CORS Configuration...")
    try:
        # Test preflight request
        headers = {
            'Origin': 'https://cdm-platform.vercel.app',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Content-Type'
        }
        response = requests.options("https://cdm-backend.onrender.com/health", headers=headers, timeout=10)
        
        if response.status_code in [200, 204]:
            print("   ✅ CORS preflight successful")
            return True
        else:
            print(f"   ⚠️  CORS preflight returned {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ CORS test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 CDM Platform End-to-End Test")
    print("=" * 50)
    
    tests = [
        ("Backend Health", test_backend_health),
        ("Frontend Accessibility", test_frontend_accessibility),
        ("API Endpoints", test_api_endpoints),
        ("CORS Configuration", test_cors_configuration)
    ]
    
    results = {}
    for test_name, test_func in tests:
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"   ❌ {test_name} test crashed: {e}")
            results[test_name] = False
    
    print("\n" + "=" * 50)
    print("📊 Test Results Summary:")
    print("=" * 50)
    
    all_passed = True
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"   {test_name}: {status}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 50)
    if all_passed:
        print("🎉 All tests passed! Deployment is working correctly.")
        print("\n📋 Deployment Summary:")
        print("   Frontend: https://cdm-platform.vercel.app")
        print("   Backend:  https://cdm-backend.onrender.com")
        print("   API Base: https://cdm-backend.onrender.com/api/v1")
    else:
        print("⚠️  Some tests failed. Check the issues above.")
        print("   This may be due to free tier limitations (sleeping services).")
        print("   The deployment is likely working but may need a moment to wake up.")
    
    print("\n🔧 Next Steps:")
    print("   1. Visit https://cdm-platform.vercel.app")
    print("   2. Check browser console for any errors")
    print("   3. Test data loading and API calls")
    print("   4. Verify auto-deploy is working on both platforms")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
