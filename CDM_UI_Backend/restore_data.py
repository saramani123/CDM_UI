#!/usr/bin/env python3
"""
Script to restore the database with the data that was there before the revert.
This will add drivers, objects, and variables to match the previous state.
"""

from neo4j import GraphDatabase
import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

URI = os.getenv("NEO4J_URI")
USERNAME = os.getenv("NEO4J_USERNAME")
PASSWORD = os.getenv("NEO4J_PASSWORD")
DATABASE = os.getenv("NEO4J_DATABASE")

print(f"Attempting to connect to Neo4j at {URI}")
print(f"Username: {USERNAME}")

try:
    driver = GraphDatabase.driver(URI, auth=(USERNAME, PASSWORD))
    driver.verify_connectivity()
    print("Successfully connected to Neo4j!")
except Exception as e:
    print(f"Failed to connect to Neo4j: {e}")
    exit(1)

print(f"Database: {DATABASE}")

def add_drivers(tx):
    """Add all the driver nodes"""
    sectors = [
        "Investment", "Education", "Financial Services", "Healthcare", "Manufacturing",
        "Professional Services", "Technology", "Retail", "Government", "Non-Profit",
        "Real Estate", "Energy", "Transportation", "Media", "Entertainment",
        "Sports", "Agriculture", "Mining", "Construction", "Utilities", "Telecommunications"
    ]
    domains = [
        "HR", "Operations", "Finance", "Marketing", "Sales", "IT", "Legal",
        "Compliance", "Risk Management", "Customer Service", "Product Management",
        "Research", "Development", "Quality Assurance", "Supply Chain"
    ]
    countries = [
        "US", "Canada", "UK", "Germany", "France", "Japan", "Australia", "Brazil",
        "India", "China", "Mexico", "Italy", "Spain", "Netherlands", "Sweden",
        "Norway", "Denmark", "Finland", "Switzerland", "Austria", "Belgium",
        "Ireland", "Portugal", "Poland", "Czech Republic", "Hungary", "Romania",
        "Bulgaria", "Croatia", "Slovenia", "Slovakia", "Estonia", "Latvia",
        "Lithuania", "Greece", "Cyprus", "Malta", "Luxembourg", "Iceland",
        "Liechtenstein", "Monaco", "San Marino", "Vatican City", "Andorra"
    ]
    variable_clarifiers = [
        "Tax ID", "Legal Entity", "Product", "Service", "Location", "Event",
        "Time", "Currency", "Quantity", "Status", "Type", "Category",
        "Sub-Category", "Flag", "Role", "Relationship", "Identifier",
        "Description", "Notes", "Source", "None"
    ]
    object_clarifiers = [
        "Employment Type", "Pay Type", "Hour Type", "None"
    ]

    for sector in sectors:
        tx.run("MERGE (:Sector {name: $name})", name=sector)
    for domain in domains:
        tx.run("MERGE (:Domain {name: $name})", name=domain)
    for country in countries:
        tx.run("MERGE (:Country {name: $name})", name=country)
    for clarifier in variable_clarifiers:
        tx.run("MERGE (:VariableClarifier {name: $name})", name=clarifier)
    for clarifier in object_clarifiers:
        tx.run("MERGE (:ObjectClarifier {name: $name})", name=clarifier)
    
    return len(sectors), len(domains), len(countries), len(variable_clarifiers), len(object_clarifiers)

def add_objects(tx):
    """Add the object nodes based on the mock data"""
    objects = [
        {
            "id": "1",
            "driver": "ALL, ALL, ALL, Employment Type",
            "being": "Master",
            "avatar": "Company",
            "object": "Company",
            "relationships": 13,
            "variants": 23,
            "variables": 54,
            "status": "Active"
        },
        {
            "id": "2", 
            "driver": "ALL, ALL, ALL, Pay Type",
            "being": "Master",
            "avatar": "Company Affiliate",
            "object": "Entity",
            "relationships": 1,
            "variants": 2,
            "variables": 45,
            "status": "Active"
        },
        {
            "id": "3",
            "driver": "Technology, Human Resources, United States, Employment Type",
            "being": "Master",
            "avatar": "Company Affiliate",
            "object": "Department",
            "relationships": 13,
            "variants": 23,
            "variables": 54,
            "status": "Active"
        },
        {
            "id": "4",
            "driver": "Healthcare, Finance & Accounting, Canada, Pay Type",
            "being": "Master",
            "avatar": "Company Affiliate",
            "object": "Team",
            "relationships": 30,
            "variants": 19,
            "variables": 54,
            "status": "Active"
        },
        {
            "id": "5",
            "driver": "Financial Services, Sales & Marketing, United Kingdom, Hour Type",
            "being": "Master",
            "avatar": "Company Affiliate",
            "object": "Region",
            "relationships": 39,
            "variants": 23,
            "variables": 54,
            "status": "Active"
        },
        {
            "id": "6",
            "driver": "Manufacturing, Operations, Germany, None",
            "being": "Master",
            "avatar": "Company Affiliate",
            "object": "Location",
            "relationships": 13,
            "variants": 23,
            "variables": 20,
            "status": "Active"
        },
        {
            "id": "7",
            "driver": "ALL, ALL, ALL, Employment Type",
            "being": "Master",
            "avatar": "Employee",
            "object": "Employee",
            "relationships": 6,
            "variants": 11,
            "variables": 54,
            "status": "Active"
        },
        {
            "id": "8",
            "driver": "Technology, Information Technology, United States, Pay Type",
            "being": "Master",
            "avatar": "Employee",
            "object": "Employee",
            "relationships": 13,
            "variants": 23,
            "variables": 54,
            "status": "Active"
        },
        {
            "id": "9",
            "driver": "Insurance, Legal & Compliance, United States, Hour Type",
            "being": "Master",
            "avatar": "Employee",
            "object": "Employee",
            "relationships": 34,
            "variants": 23,
            "variables": 35,
            "status": "Active"
        },
        {
            "id": "10",
            "driver": "ALL, ALL, ALL, None",
            "being": "Master",
            "avatar": "Product",
            "object": "Product",
            "relationships": 13,
            "variants": 23,
            "variables": 54,
            "status": "Active"
        }
    ]
    
    for obj in objects:
        tx.run("""
            MERGE (o:Object {id: $id})
            SET o.driver = $driver,
                o.being = $being,
                o.avatar = $avatar,
                o.object = $object,
                o.relationships = $relationships,
                o.variants = $variants,
                o.variables = $variables,
                o.status = $status
        """, **obj)
    
    return len(objects)

def create_object_relationships(tx):
    """Create driver relationships for objects"""
    # Get all objects
    result = tx.run("MATCH (o:Object) RETURN o.id as id, o.driver as driver")
    objects = result.data()
    
    for obj in objects:
        obj_id = obj['id']
        driver = obj['driver']
        
        if not driver:
            continue
            
        parts = driver.split(', ')
        if len(parts) >= 4:
            sector_str = parts[0].strip()
            domain_str = parts[1].strip()
            country_str = parts[2].strip()
            clarifier_str = parts[3].strip()
            
            # Create relationships for sectors
            if sector_str == "ALL":
                tx.run("""
                    MATCH (s:Sector)
                    MATCH (o:Object {id: $obj_id})
                    MERGE (s)-[:RELEVANT_TO]->(o)
                """, obj_id=obj_id)
            elif sector_str:
                tx.run("""
                    MATCH (s:Sector {name: $sector})
                    MATCH (o:Object {id: $obj_id})
                    MERGE (s)-[:RELEVANT_TO]->(o)
                """, sector=sector_str, obj_id=obj_id)
            
            # Create relationships for domains
            if domain_str == "ALL":
                tx.run("""
                    MATCH (d:Domain)
                    MATCH (o:Object {id: $obj_id})
                    MERGE (d)-[:RELEVANT_TO]->(o)
                """, obj_id=obj_id)
            elif domain_str:
                tx.run("""
                    MATCH (d:Domain {name: $domain})
                    MATCH (o:Object {id: $obj_id})
                    MERGE (d)-[:RELEVANT_TO]->(o)
                """, domain=domain_str, obj_id=obj_id)
            
            # Create relationships for countries
            if country_str == "ALL":
                tx.run("""
                    MATCH (c:Country)
                    MATCH (o:Object {id: $obj_id})
                    MERGE (c)-[:RELEVANT_TO]->(o)
                """, obj_id=obj_id)
            elif country_str:
                tx.run("""
                    MATCH (c:Country {name: $country})
                    MATCH (o:Object {id: $obj_id})
                    MERGE (c)-[:RELEVANT_TO]->(o)
                """, country=country_str, obj_id=obj_id)
            
            # Create relationships for object clarifiers
            if clarifier_str and clarifier_str != "None":
                tx.run("""
                    MATCH (oc:ObjectClarifier {name: $clarifier})
                    MATCH (o:Object {id: $obj_id})
                    MERGE (oc)-[:RELEVANT_TO]->(o)
                """, clarifier=clarifier_str, obj_id=obj_id)

def upload_variables():
    """Upload variables using the test CSV file"""
    try:
        with open('/Users/romikapoor/CDM Screens/CDM_UI_Backend/testvars.csv', 'rb') as f:
            files = {'file': f}
            response = requests.post('http://localhost:8000/api/v1/variables/bulk-upload', files=files)
            if response.status_code == 200:
                print("Successfully uploaded variables")
                return True
            else:
                print(f"Failed to upload variables: {response.status_code} - {response.text}")
                return False
    except Exception as e:
        print(f"Error uploading variables: {e}")
        return False

# Main execution
with driver.session(database=DATABASE) as session:
    print("Adding drivers...")
    num_sectors, num_domains, num_countries, num_var_clarifiers, num_obj_clarifiers = session.write_transaction(add_drivers)
    print(f"Added {num_sectors} sectors, {num_domains} domains, {num_countries} countries, {num_var_clarifiers} variable clarifiers, and {num_obj_clarifiers} object clarifiers")
    
    print("Adding objects...")
    num_objects = session.write_transaction(add_objects)
    print(f"Added {num_objects} objects")
    
    print("Creating object relationships...")
    session.write_transaction(create_object_relationships)
    print("Created object relationships")
    
    print("Uploading variables...")
    if upload_variables():
        print("Variables uploaded successfully")
    else:
        print("Failed to upload variables")

driver.close()
print("Data restoration complete!")
