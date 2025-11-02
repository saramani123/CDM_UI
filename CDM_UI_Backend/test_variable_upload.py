#!/usr/bin/env python3
"""
Test script for variable CSV upload functionality
Tests the upload endpoint locally before deploying to production
"""

import csv
import io
import requests
import json
from pathlib import Path

def create_test_csv_file(num_rows=10):
    """Create a test CSV file with sample variable data"""
    csv_data = [
        "Sector,Domain,Country,Variable Clarifier,Part,Section,Group,Variable,Format I,Format II,G-Type,Validation,Default,Graph"
    ]
    
    # Add test rows
    for i in range(1, num_rows + 1):
        row = [
            "ALL",  # Sector
            "ALL",  # Domain
            "ALL",  # Country
            "None",  # Variable Clarifier
            f"Test Part {i % 3 + 1}",  # Part
            "Test Section",  # Section
            f"Test Group {i % 2 + 1}",  # Group
            f"Test Variable {i}",  # Variable
            "String",  # Format I
            "Text",  # Format II
            "Loose",  # G-Type
            "",  # Validation
            "",  # Default
            "Yes"  # Graph
        ]
        csv_data.append(",".join(row))
    
    return "\n".join(csv_data)

def test_upload_endpoint(csv_content, base_url="http://localhost:8000"):
    """Test the upload endpoint with the CSV content"""
    url = f"{base_url}/api/v1/variables/bulk-upload"
    
    # Create a file-like object from the CSV content
    files = {
        'file': ('test_variables.csv', io.StringIO(csv_content), 'text/csv')
    }
    
    print(f"📤 Uploading test CSV to {url}")
    print(f"   CSV contains {len(csv_content.split('\n')) - 1} data rows")
    
    try:
        response = requests.post(url, files=files, timeout=120)
        
        print(f"\n📊 Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Upload successful!")
            print(f"   Created: {result.get('created_count', 0)}")
            print(f"   Errors: {result.get('error_count', 0)}")
            
            if result.get('errors'):
                print(f"\n⚠️  Errors found:")
                for error in result['errors'][:10]:  # Show first 10 errors
                    print(f"   - {error}")
                if len(result['errors']) > 10:
                    print(f"   ... and {len(result['errors']) - 10} more errors")
            
            if result.get('error_count', 0) > 0:
                print(f"\n❌ Upload completed but with {result['error_count']} errors")
                return False
            else:
                print(f"\n✅ All variables created successfully!")
                return True
        else:
            print(f"❌ Upload failed with status {response.status_code}")
            try:
                error_detail = response.json()
                print(f"   Error: {error_detail}")
            except:
                print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print(f"❌ Request timed out after 120 seconds")
        return False
    except Exception as e:
        print(f"❌ Request failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_with_real_csv(csv_file_path, base_url="http://localhost:8000"):
    """Test upload with a real CSV file"""
    csv_path = Path(csv_file_path)
    
    if not csv_path.exists():
        print(f"❌ CSV file not found: {csv_file_path}")
        return False
    
    print(f"📂 Reading CSV file: {csv_file_path}")
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        csv_content = f.read()
    
    num_rows = len(csv_content.strip().split('\n')) - 1  # Exclude header
    print(f"   Found {num_rows} data rows")
    
    return test_upload_endpoint(csv_content, base_url)

if __name__ == "__main__":
    import sys
    
    print("🧪 Variable CSV Upload Test Script")
    print("=" * 50)
    
    # Check if a CSV file path was provided
    if len(sys.argv) > 1:
        csv_file = sys.argv[1]
        base_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000"
        print(f"\n🔍 Testing with real CSV file: {csv_file}")
        print(f"   Backend URL: {base_url}\n")
        success = test_with_real_csv(csv_file, base_url)
    else:
        # Test with generated CSV
        print(f"\n🔍 Testing with generated test data")
        print(f"   Backend URL: http://localhost:8000\n")
        csv_content = create_test_csv_file(num_rows=10)
        success = test_upload_endpoint(csv_content)
    
    print("\n" + "=" * 50)
    if success:
        print("✅ Test passed! Upload functionality is working.")
        sys.exit(0)
    else:
        print("❌ Test failed! Check the errors above.")
        sys.exit(1)

