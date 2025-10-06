#!/usr/bin/env python3
"""
Fix script to create missing RELEVANT_TO relationships for existing Objects and Variables.
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
        print(f"Creating driver relationships for object {object_id} with driver string: {driver_string}")
        
        # Parse driver string
        parts = [part.strip() for part in driver_string.split(',')]
        if len(parts) != 4:
            print(f"Invalid driver string format: {driver_string}")
            return False
        
        sector_str, domain_str, country_str, object_clarifier = parts
        
        # Handle Sector relationships
        if sector_str == "ALL":
            # Create relationships to ALL existing sectors
            result = session.run("""
                MATCH (s:Sector)
                MATCH (o:Object {id: $object_id})
                WITH s, o
                MERGE (s)-[:RELEVANT_TO]->(o)
                RETURN count(s) as relationships_created
            """, object_id=object_id)
            count = result.single()["relationships_created"]
            print(f"  Created {count} sector relationships")
        else:
            # Create relationships to individual sectors
            sectors = [s.strip() for s in sector_str.split(',')]
            for sector in sectors:
                session.run("""
                    MERGE (s:Sector {name: $sector})
                    WITH s
                    MATCH (o:Object {id: $object_id})
                    MERGE (s)-[:RELEVANT_TO]->(o)
                """, sector=sector, object_id=object_id)
            print(f"  Created relationships to {len(sectors)} specific sectors")
        
        # Handle Domain relationships
        if domain_str == "ALL":
            # Create relationships to ALL existing domains
            result = session.run("""
                MATCH (d:Domain)
                MATCH (o:Object {id: $object_id})
                WITH d, o
                MERGE (d)-[:RELEVANT_TO]->(o)
                RETURN count(d) as relationships_created
            """, object_id=object_id)
            count = result.single()["relationships_created"]
            print(f"  Created {count} domain relationships")
        else:
            # Create relationships to individual domains
            domains = [d.strip() for d in domain_str.split(',')]
            for domain in domains:
                session.run("""
                    MERGE (d:Domain {name: $domain})
                    WITH d
                    MATCH (o:Object {id: $object_id})
                    MERGE (d)-[:RELEVANT_TO]->(o)
                """, domain=domain, object_id=object_id)
            print(f"  Created relationships to {len(domains)} specific domains")
        
        # Handle Country relationships
        if country_str == "ALL":
            # Create relationships to ALL existing countries
            result = session.run("""
                MATCH (c:Country)
                MATCH (o:Object {id: $object_id})
                WITH c, o
                MERGE (c)-[:RELEVANT_TO]->(o)
                RETURN count(c) as relationships_created
            """, object_id=object_id)
            count = result.single()["relationships_created"]
            print(f"  Created {count} country relationships")
        else:
            # Create relationships to individual countries
            countries = [c.strip() for c in country_str.split(',')]
            for country in countries:
                session.run("""
                    MERGE (c:Country {name: $country})
                    WITH c
                    MATCH (o:Object {id: $object_id})
                    MERGE (c)-[:RELEVANT_TO]->(o)
                """, country=country, object_id=object_id)
            print(f"  Created relationships to {len(countries)} specific countries")
        
        # Handle Object Clarifier relationship
        if object_clarifier and object_clarifier != "None" and object_clarifier != "":
            session.run("""
                MERGE (oc:ObjectClarifier {name: $clarifier})
                WITH oc
                MATCH (o:Object {id: $object_id})
                MERGE (oc)-[:RELEVANT_TO]->(o)
            """, clarifier=object_clarifier, object_id=object_id)
            print(f"  Created relationship to ObjectClarifier: {object_clarifier}")
        
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
        print(f"Creating driver relationships for variable {variable_id} with driver string: {driver_string}")
        
        # Parse driver string
        parts = [part.strip() for part in driver_string.split(',')]
        if len(parts) != 4:
            print(f"Invalid driver string format: {driver_string}")
            return False
        
        sector_str, domain_str, country_str, variable_clarifier = parts
        
        # Handle Sector relationships
        if sector_str == "ALL":
            # Create relationships to ALL existing sectors
            result = session.run("""
                MATCH (s:Sector)
                MATCH (v:Variable {id: $variable_id})
                WITH s, v
                MERGE (s)-[:RELEVANT_TO]->(v)
                RETURN count(s) as relationships_created
            """, variable_id=variable_id)
            count = result.single()["relationships_created"]
            print(f"  Created {count} sector relationships")
        else:
            # Create relationships to individual sectors
            sectors = [s.strip() for s in sector_str.split(',')]
            for sector in sectors:
                session.run("""
                    MERGE (s:Sector {name: $sector})
                    WITH s
                    MATCH (v:Variable {id: $variable_id})
                    MERGE (s)-[:RELEVANT_TO]->(v)
                """, sector=sector, variable_id=variable_id)
            print(f"  Created relationships to {len(sectors)} specific sectors")
        
        # Handle Domain relationships
        if domain_str == "ALL":
            # Create relationships to ALL existing domains
            result = session.run("""
                MATCH (d:Domain)
                MATCH (v:Variable {id: $variable_id})
                WITH d, v
                MERGE (d)-[:RELEVANT_TO]->(v)
                RETURN count(d) as relationships_created
            """, variable_id=variable_id)
            count = result.single()["relationships_created"]
            print(f"  Created {count} domain relationships")
        else:
            # Create relationships to individual domains
            domains = [d.strip() for d in domain_str.split(',')]
            for domain in domains:
                session.run("""
                    MERGE (d:Domain {name: $domain})
                    WITH d
                    MATCH (v:Variable {id: $variable_id})
                    MERGE (d)-[:RELEVANT_TO]->(v)
                """, domain=domain, variable_id=variable_id)
            print(f"  Created relationships to {len(domains)} specific domains")
        
        # Handle Country relationships
        if country_str == "ALL":
            # Create relationships to ALL existing countries
            result = session.run("""
                MATCH (c:Country)
                MATCH (v:Variable {id: $variable_id})
                WITH c, v
                MERGE (c)-[:RELEVANT_TO]->(v)
                RETURN count(c) as relationships_created
            """, variable_id=variable_id)
            count = result.single()["relationships_created"]
            print(f"  Created {count} country relationships")
        else:
            # Create relationships to individual countries
            countries = [c.strip() for c in country_str.split(',')]
            for country in countries:
                session.run("""
                    MERGE (c:Country {name: $country})
                    WITH c
                    MATCH (v:Variable {id: $variable_id})
                    MERGE (c)-[:RELEVANT_TO]->(v)
                """, country=country, variable_id=variable_id)
            print(f"  Created relationships to {len(countries)} specific countries")
        
        # Handle Variable Clarifier relationship
        if variable_clarifier and variable_clarifier != "None" and variable_clarifier != "":
            session.run("""
                MERGE (vc:VariableClarifier {name: $clarifier})
                WITH vc
                MATCH (v:Variable {id: $variable_id})
                MERGE (vc)-[:RELEVANT_TO]->(v)
            """, clarifier=variable_clarifier, variable_id=variable_id)
            print(f"  Created relationship to VariableClarifier: {variable_clarifier}")
        
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
            
            for i, record in enumerate(objects, 1):
                object_id = record["id"]
                driver_string = record["driver"]
                being = record["being"]
                avatar = record["avatar"]
                object_name = record["object"]
                
                print(f"\n[{i}/{len(objects)}] Processing Object: {being} -> {avatar} -> {object_name} (ID: {object_id})")
                
                if create_driver_relationships_for_object(session, object_id, driver_string):
                    success_count += 1
                else:
                    error_count += 1
            
            print(f"\n✅ Objects processing complete: {success_count} successful, {error_count} errors")
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
                RETURN v.id as id, v.driver as driver, v.part as part, v.group as group, v.section as section, v.variable as variable
                ORDER BY v.id
            """)
            
            variables = list(result)
            print(f"🔍 Found {len(variables)} variables to process")
            
            success_count = 0
            error_count = 0
            
            for i, record in enumerate(variables, 1):
                variable_id = record["id"]
                driver_string = record["driver"]
                part = record["part"]
                group = record["group"]
                section = record["section"]
                variable_name = record["variable"]
                
                print(f"\n[{i}/{len(variables)}] Processing Variable: {part} -> {group} -> {section} -> {variable_name} (ID: {variable_id})")
                
                if create_driver_relationships_for_variable(session, variable_id, driver_string):
                    success_count += 1
                else:
                    error_count += 1
            
            print(f"\n✅ Variables processing complete: {success_count} successful, {error_count} errors")
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
            # Check object relationships
            object_result = session.run("""
                MATCH (o:Object)-[r:RELEVANT_TO]->(d)
                WHERE labels(d)[0] IN ['Sector', 'Domain', 'Country', 'ObjectClarifier']
                RETURN count(r) as relationship_count
            """)
            object_count = object_result.single()["relationship_count"]
            
            # Check variable relationships
            variable_result = session.run("""
                MATCH (v:Variable)-[r:RELEVANT_TO]->(d)
                WHERE labels(d)[0] IN ['Sector', 'Domain', 'Country', 'VariableClarifier']
                RETURN count(r) as relationship_count
            """)
            variable_count = variable_result.single()["relationship_count"]
            
            print(f"📊 Verification Results:")
            print(f"  Object RELEVANT_TO relationships: {object_count}")
            print(f"  Variable RELEVANT_TO relationships: {variable_count}")
            
            if object_count > 0 or variable_count > 0:
                print("✅ SUCCESS: RELEVANT_TO relationships found!")
                return True
            else:
                print("❌ ERROR: No RELEVANT_TO relationships found!")
                return False
                
        except Exception as e:
            print(f"❌ Error during verification: {e}")
            return False

if __name__ == "__main__":
    print("🔧 Fixing missing RELEVANT_TO relationships for existing Objects and Variables...")
    print("=" * 80)
    
    # Fix objects
    print("\n🏢 Processing Objects...")
    print("-" * 40)
    fix_all_objects()
    
    # Fix variables
    print("\n📊 Processing Variables...")
    print("-" * 40)
    fix_all_variables()
    
    # Verify results
    print("\n🔍 Verifying relationships...")
    print("-" * 40)
    verify_relationships()
    
    print("\n🎉 Driver relationship fix complete!")
