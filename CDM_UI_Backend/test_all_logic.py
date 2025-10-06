#!/usr/bin/env python3
"""
Test script to verify that "ALL" driver selection creates relationships 
to all existing driver nodes instead of creating "ALL" nodes.
"""

import requests
import json
from db import get_driver

def test_variable_creation_with_all_drivers():
    """Test creating a variable with ALL drivers"""
    
    # Test data for a variable with ALL drivers
    test_variable = {
        "driver": "ALL, ALL, ALL, None",
        "part": "Test",
        "group": "Test Group",
        "section": "Test Section", 
        "variable": "Test Variable ALL Drivers",
        "formatI": "Text",
        "formatII": "String",
        "gType": "Test",
        "validation": "",
        "default": "",
        "graph": "Y",
        "status": "Active"
    }
    
    print("🧪 Testing variable creation with ALL drivers...")
    print(f"Test data: {json.dumps(test_variable, indent=2)}")
    
    try:
        # Create the variable via API
        response = requests.post("http://localhost:8000/api/v1/variables", json=test_variable)
        
        if response.status_code in [200, 201]:
            result = response.json()
            variable_id = result["id"]
            print(f"✅ Variable created successfully with ID: {variable_id}")
            
            # Verify relationships were created correctly
            verify_driver_relationships(variable_id)
            
            # Clean up test variable
            cleanup_test_variable(variable_id)
            
        else:
            print(f"❌ Failed to create variable: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"❌ Error during test: {e}")

def verify_driver_relationships(variable_id):
    """Verify that relationships were created to all existing driver nodes"""
    driver = get_driver()
    if not driver:
        print("❌ No Neo4j connection available")
        return False
    
    with driver.session() as session:
        try:
            # Check sector relationships
            sector_result = session.run("""
                MATCH (v:Variable {id: $variable_id})-[:RELEVANT_TO]-(s:Sector)
                RETURN s.name as sector_name
                ORDER BY s.name
            """, variable_id=variable_id)
            
            sectors = [record["sector_name"] for record in sector_result]
            print(f"📊 Variable connected to {len(sectors)} sectors: {sectors}")
            
            # Check domain relationships  
            domain_result = session.run("""
                MATCH (v:Variable {id: $variable_id})-[:RELEVANT_TO]-(d:Domain)
                RETURN d.name as domain_name
                ORDER BY d.name
            """, variable_id=variable_id)
            
            domains = [record["domain_name"] for record in domain_result]
            print(f"📊 Variable connected to {len(domains)} domains: {domains}")
            
            # Check country relationships
            country_result = session.run("""
                MATCH (v:Variable {id: $variable_id})-[:RELEVANT_TO]-(c:Country)
                RETURN c.name as country_name
                ORDER BY c.name
                LIMIT 10
            """, variable_id=variable_id)
            
            countries = [record["country_name"] for record in country_result]
            print(f"📊 Variable connected to {len(countries)} countries (showing first 10): {countries}")
            
            # Verify no "ALL" nodes were created
            all_nodes_result = session.run("""
                MATCH (n)
                WHERE n.name = "ALL" AND (n:Sector OR n:Domain OR n:Country)
                RETURN labels(n) as labels, n.name as name
            """)
            
            all_nodes = list(all_nodes_result)
            if all_nodes:
                print(f"❌ ERROR: Found 'ALL' nodes in database: {all_nodes}")
                return False
            else:
                print("✅ SUCCESS: No 'ALL' nodes found in database")
                return True
                
        except Exception as e:
            print(f"❌ Error verifying relationships: {e}")
            return False

def cleanup_test_variable(variable_id):
    """Clean up the test variable"""
    try:
        response = requests.delete(f"http://localhost:8000/api/v1/variables/{variable_id}")
        if response.status_code == 200:
            print(f"🧹 Test variable {variable_id} cleaned up successfully")
        else:
            print(f"⚠️  Failed to clean up test variable: {response.status_code}")
    except Exception as e:
        print(f"⚠️  Error cleaning up test variable: {e}")

if __name__ == "__main__":
    print("🧪 Testing 'ALL' driver logic fix...")
    print("=" * 60)
    test_variable_creation_with_all_drivers()
