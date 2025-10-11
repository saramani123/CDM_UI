#!/usr/bin/env python3
"""
Test script to verify deployment configuration
"""
import os
import sys
from pathlib import Path

def test_environment_files():
    """Test that environment files exist and have correct structure"""
    backend_dir = Path("CDM_UI_Backend")
    
    # Check .env.dev
    env_dev = backend_dir / ".env.dev"
    if env_dev.exists():
        print("✅ .env.dev exists")
        with open(env_dev) as f:
            content = f.read()
            if "NEO4J_URI" in content and "ENVIRONMENT=development" in content:
                print("✅ .env.dev has correct structure")
            else:
                print("❌ .env.dev missing required fields")
    else:
        print("❌ .env.dev not found")
    
    # Check .env.prod
    env_prod = backend_dir / ".env.prod"
    if env_prod.exists():
        print("✅ .env.prod exists")
        with open(env_prod) as f:
            content = f.read()
            if "NEO4J_URI" in content and "ENVIRONMENT=production" in content:
                print("✅ .env.prod has correct structure")
            else:
                print("❌ .env.prod missing required fields")
    else:
        print("❌ .env.prod not found")

def test_vercel_config():
    """Test Vercel configuration files"""
    # Check root vercel.json
    if Path("vercel.json").exists():
        print("✅ Root vercel.json exists")
    else:
        print("❌ Root vercel.json not found")
    
    # Check frontend vercel.json
    if Path("CDM_Frontend/vercel.json").exists():
        print("✅ Frontend vercel.json exists")
    else:
        print("❌ Frontend vercel.json not found")
    
    # Check backend vercel.json
    if Path("CDM_UI_Backend/vercel.json").exists():
        print("✅ Backend vercel.json exists")
    else:
        print("❌ Backend vercel.json not found")

def test_gitignore():
    """Test .gitignore configuration"""
    if Path(".gitignore").exists():
        print("✅ .gitignore exists")
        with open(".gitignore") as f:
            content = f.read()
            if ".env" in content and "node_modules" in content:
                print("✅ .gitignore has correct exclusions")
            else:
                print("❌ .gitignore missing required exclusions")
    else:
        print("❌ .gitignore not found")

def test_backend_config():
    """Test backend environment loading logic"""
    backend_dir = Path("CDM_UI_Backend")
    db_py = backend_dir / "db.py"
    
    if db_py.exists():
        print("✅ db.py exists")
        with open(db_py) as f:
            content = f.read()
            if "VERCEL" in content and "ENVIRONMENT" in content:
                print("✅ db.py has environment detection logic")
            else:
                print("❌ db.py missing environment detection")
    else:
        print("❌ db.py not found")

def test_frontend_config():
    """Test frontend API configuration"""
    frontend_dir = Path("CDM_Frontend/src/services")
    api_ts = frontend_dir / "api.ts"
    
    if api_ts.exists():
        print("✅ api.ts exists")
        with open(api_ts) as f:
            content = f.read()
            if "import.meta.env.PROD" in content and "VITE_API_BASE_URL" in content:
                print("✅ api.ts has environment-based URL logic")
            else:
                print("❌ api.ts missing environment logic")
    else:
        print("❌ api.ts not found")

def main():
    print("🧪 Testing CDM Deployment Configuration")
    print("=" * 50)
    
    test_environment_files()
    print()
    test_vercel_config()
    print()
    test_gitignore()
    print()
    test_backend_config()
    print()
    test_frontend_config()
    
    print("\n" + "=" * 50)
    print("✅ Deployment configuration test complete!")
    print("\nNext steps:")
    print("1. Update .env.dev with your development Neo4j credentials")
    print("2. Deploy backend to Vercel and set production environment variables")
    print("3. Deploy frontend to Vercel with backend URL")
    print("4. Test the deployed application")

if __name__ == "__main__":
    main()
