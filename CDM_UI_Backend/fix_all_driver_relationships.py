#!/usr/bin/env python3
"""
Complete fix script to create missing RELEVANT_TO relationships for ALL existing Objects and Variables.
This script processes all existing objects and variables to create proper driver relationships.
"""

from db import get_driver
import uuid

def create_driver_relationships_for_object(session, object_id: str, driver_string: str):
    """
    Create driver relationships for an object based on the driver string.
    Driver string format: "Sector, Domain, Country, ObjectClarifier"
    """
    try:
        # Handle None or empty driver string
        if not driver_string or driver_string == "None" or driver_string.strip() == "":
            return True
        
        # Parse driver string
        parts = [part.strip() for part in driver_string.split(',')]
        if len(parts) != 4:
            return False
        
        sector_str, domain_str, country_str, object_clarifier = parts
        
        # Handle Sector relationships
        if sector_str == "ALL":
            # Create relationships to ALL existing sectors
            session.run("""
                MATCH (s:Sector)
                MATCH (o:Object {id: $object_id})
                WITH s, o
                MERGE (s)-[:RELEVANT_TO]->(o)
            """, object_id=object_id)
        else:
            # Create relationships to individual sectors
            sectors = [s.strip() for s in sector_str.split(',')]
            for sector in sectors:
                if sector and sector != "None":
                    session.run("""
                        MERGE (s:Sector {name: $sector})
                        WITH s
                        MATCH (o:Object {id: $object_id})
                        MERGE (s)-[:RELEVANT_TO]->(o)
                    """, sector=sector, object_id=object_id)
        
        # Handle Domain relationships
        if domain_str == "ALL":
            # Create relationships to ALL existing domains
            session.run("""
                MATCH (d:Domain)
                MATCH (o:Object {id: $object_id})
                WITH d, o
                MERGE (d)-[:RELEVANT_TO]->(o)
            """, object_id=object_id)
        else:
            # Create relationships to individual domains
            domains = [d.strip() for d in domain_str.split(',')]
            for domain in domains:
                if domain and domain != "None":
                    session.run("""
                        MERGE (d:Domain {name: $domain})
                        WITH d
                        MATCH (o:Object {id: $object_id})
                        MERGE (d)-[:RELEVANT_TO]->(o)
                    """, domain=domain, object_id=object_id)
        
        # Handle Country relationships
        if country_str == "ALL":
            # Create relationships to ALL existing countries
            session.run("""
                MATCH (c:Country)
                MATCH (o:Object {id: $object_id})
                WITH c, o
                MERGE (c)-[:RELEVANT_TO]->(o)
            """, object_id=object_id)
        else:
            # Create relationships to individual countries
            countries = [c.strip() for c in country_str.split(',')]
            for country in countries:
                if country and country != "None":
                    session.run("""
                        MERGE (c:Country {name: $country})
                        WITH c
                        MATCH (o:Object {id: $object_id})
                        MERGE (c)-[:RELEVANT_TO]->(o)
                    """, country=country, object_id=object_id)
        
        # Handle Object Clarifier relationship
        if object_clarifier and object_clarifier != "None" and object_clarifier != "":
            session.run("""
                MERGE (oc:ObjectClarifier {name: $clarifier})
                WITH oc
                MATCH (o:Object {id: $object_id})
                MERGE (oc)-[:RELEVANT_TO]->(o)
            """, clarifier=object_clarifier, object_id=object_id)
        
        return True
        
    except Exception as e:
        print(f"  ❌ Error creating driver relationships for object {object_id}: {e}")
        return False

def create_driver_relationships_for_variable(session, variable_id: str, driver_string: str):
    """
    Create driver relationships for a variable based on the driver string.
    Driver string format: "Sector, Domain, Country, VariableClarifier"
    """
    try:
        # Handle None or empty driver string
        if not driver_string or driver_string == "None" or driver_string.strip() == "":
            return True
        
        # Parse driver string
        parts = [part.strip() for part in driver_string.split(',')]
        if len(parts) != 4:
            return False
        
        sector_str, domain_str, country_str, variable_clarifier = parts
        
        # Handle Sector relationships
        if sector_str == "ALL":
            # Create relationships to ALL existing sectors
            session.run("""
                MATCH (s:Sector)
                MATCH (v:Variable {id: $variable_id})
                WITH s, v
                MERGE (s)-[:RELEVANT_TO]->(v)
            """, variable_id=variable_id)
        else:
            # Create relationships to individual sectors
            sectors = [s.strip() for s in sector_str.split(',')]
            for sector in sectors:
                if sector and sector != "None":
                    session.run("""
                        MERGE (s:Sector {name: $sector})
                        WITH s
                        MATCH (v:Variable {id: $variable_id})
                        MERGE (s)-[:RELEVANT_TO]->(v)
                    """, sector=sector, variable_id=variable_id)
        
        # Handle Domain relationships
        if domain_str == "ALL":
            # Create relationships to ALL existing domains
            session.run("""
                MATCH (d:Domain)
                MATCH (v:Variable {id: $variable_id})
                WITH d, v
                MERGE (d)-[:RELEVANT_TO]->(v)
            """, variable_id=variable_id)
        else:
            # Create relationships to individual domains
            domains = [d.strip() for d in domain_str.split(',')]
            for domain in domains:
                if domain and domain != "None":
                    session.run("""
                        MERGE (d:Domain {name: $domain})
                        WITH d
                        MATCH (v:Variable {id: $variable_id})
                        MERGE (d)-[:RELEVANT_TO]->(v)
                    """, domain=domain, variable_id=variable_id)
        
        # Handle Country relationships
        if country_str == "ALL":
            # Create relationships to ALL existing countries
            session.run("""
                MATCH (c:Country)
                MATCH (v:Variable {id: $variable_id})
                WITH c, v
                MERGE (c)-[:RELEVANT_TO]->(v)
            """, variable_id=variable_id)
        else:
            # Create relationships to individual countries
            countries = [c.strip() for c in country_str.split(',')]
            for country in countries:
                if country and country != "None":
                    session.run("""
                        MERGE (c:Country {name: $country})
                        WITH c
                        MATCH (v:Variable {id: $variable_id})
                        MERGE (c)-[:RELEVANT_TO]->(v)
                    """, country=country, variable_id=variable_id)
        
        # Handle Variable Clarifier relationship
        if variable_clarifier and variable_clarifier != "None" and variable_clarifier != "":
            session.run("""
                MERGE (vc:VariableClarifier {name: $clarifier})
                WITH vc
                MATCH (v:Variable {id: $variable_id})
                MERGE (vc)-[:RELEVANT_TO]->(v)
            """, clarifier=variable_clarifier, variable_id=variable_id)
        
        return True
        
    except Exception as e:
        print(f"  ❌ Error creating driver relationships for variable {variable_id}: {e}")
        return False

def fix_all_objects():
    """Fix driver relationships for all existing objects"""
    driver = get_driver()
    if not driver:
        print("❌ No Neo4j connection available")
        return False
    
    with driver.session() as session:
        try:
            # Get all objects with their driver strings
            result = session.run("""
                MATCH (o:Object)
                RETURN o.id as id, o.driver as driver, o.being as being, o.avatar as avatar, o.object as object
                ORDER BY o.id
            """)
            
            objects = list(result)
            print(f"🔍 Found {len(objects)} objects to process")
            
            success_count = 0
            error_count = 0
            skipped_count = 0
            
            for i, record in enumerate(objects, 1):
                object_id = record["id"]
                driver_string = record["driver"]
                being = record["being"]
                avatar = record["avatar"]
                object_name = record["object"]
                
                if i % 50 == 0 or i <= 10:  # Show progress every 50 items or first 10
                    print(f"[{i}/{len(objects)}] Processing Object: {being} -> {avatar} -> {object_name}")
                
                # Skip if already processed (has relationships)
                existing_rels = session.run("""
                    MATCH (d)-[r:RELEVANT_TO]->(o:Object {id: $object_id})
                    WHERE labels(d)[0] IN ['Sector', 'Domain', 'Country', 'ObjectClarifier']
                    RETURN count(r) as rel_count
                """, object_id=object_id).single()["rel_count"]
                
                if existing_rels > 0:
                    skipped_count += 1
                    continue
                
                if create_driver_relationships_for_object(session, object_id, driver_string):
                    success_count += 1
                else:
                    error_count += 1
            
            print(f"\n✅ Objects processing complete: {success_count} successful, {error_count} errors, {skipped_count} already processed")
            return True
            
        except Exception as e:
            print(f"❌ Error processing objects: {e}")
            return False

def fix_all_variables():
    """Fix driver relationships for all existing variables"""
    driver = get_driver()
    if not driver:
        print("❌ No Neo4j connection available")
        return False
    
    with driver.session() as session:
        try:
            # Get all variables with their driver strings
            result = session.run("""
                MATCH (v:Variable)
                WHERE v.driver IS NOT NULL AND v.driver <> 'None'
                RETURN v.id as id, v.driver as driver, v.part as part, v.group as group, v.section as section, v.variable as variable
                ORDER BY v.id
            """)
            
            variables = list(result)
            print(f"🔍 Found {len(variables)} variables with valid driver strings to process")
            
            success_count = 0
            error_count = 0
            skipped_count = 0
            
            for i, record in enumerate(variables, 1):
                variable_id = record["id"]
                driver_string = record["driver"]
                part = record["part"]
                group = record["group"]
                section = record["section"]
                variable_name = record["variable"]
                
                if i % 100 == 0 or i <= 10:  # Show progress every 100 items or first 10
                    print(f"[{i}/{len(variables)}] Processing Variable: {part} -> {group} -> {section} -> {variable_name}")
                
                # Skip if already processed (has relationships)
                existing_rels = session.run("""
                    MATCH (d)-[r:RELEVANT_TO]->(v:Variable {id: $variable_id})
                    WHERE labels(d)[0] IN ['Sector', 'Domain', 'Country', 'VariableClarifier']
                    RETURN count(r) as rel_count
                """, variable_id=variable_id).single()["rel_count"]
                
                if existing_rels > 0:
                    skipped_count += 1
                    continue
                
                if create_driver_relationships_for_variable(session, variable_id, driver_string):
                    success_count += 1
                else:
                    error_count += 1
            
            print(f"\n✅ Variables processing complete: {success_count} successful, {error_count} errors, {skipped_count} already processed")
            return True
            
        except Exception as e:
            print(f"❌ Error processing variables: {e}")
            return False

def verify_relationships():
    """Verify that RELEVANT_TO relationships were created correctly"""
    driver = get_driver()
    if not driver:
        print("❌ No Neo4j connection available")
        return False
    
    with driver.session() as session:
        try:
            # Check object relationships (correct direction: Driver -> Object)
            object_result = session.run("""
                MATCH (d)-[r:RELEVANT_TO]->(o:Object)
                WHERE labels(d)[0] IN ['Sector', 'Domain', 'Country', 'ObjectClarifier']
                RETURN count(r) as relationship_count
            """)
            object_count = object_result.single()["relationship_count"]
            
            # Check variable relationships (correct direction: Driver -> Variable)
            variable_result = session.run("""
                MATCH (d)-[r:RELEVANT_TO]->(v:Variable)
                WHERE labels(d)[0] IN ['Sector', 'Domain', 'Country', 'VariableClarifier']
                RETURN count(r) as relationship_count
            """)
            variable_count = variable_result.single()["relationship_count"]
            
            print(f"📊 Final RELEVANT_TO relationships:")
            print(f"  Objects: {object_count}")
            print(f"  Variables: {variable_count}")
            
            return object_count > 0 or variable_count > 0
                
        except Exception as e:
            print(f"❌ Error during verification: {e}")
            return False

if __name__ == "__main__":
    print("🔧 Fixing ALL driver relationships for existing Objects and Variables...")
    print("=" * 80)
    
    # Fix all objects
    print("\n🏢 Processing ALL Objects...")
    print("-" * 40)
    fix_all_objects()
    
    # Fix all variables
    print("\n📊 Processing ALL Variables...")
    print("-" * 40)
    fix_all_variables()
    
    # Verify results
    print("\n🔍 Final verification...")
    print("-" * 40)
    verify_relationships()
    
    print("\n🎉 Driver relationship fix complete!")
