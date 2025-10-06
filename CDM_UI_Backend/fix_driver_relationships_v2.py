#!/usr/bin/env python3
"""
Simplified fix script to create missing RELEVANT_TO relationships for existing Objects and Variables.
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
        
        # Handle None or empty driver string
        if not driver_string or driver_string == "None" or driver_string.strip() == "":
            print(f"  Skipping object {object_id} - no valid driver string")
            return True
        
        # Parse driver string
        parts = [part.strip() for part in driver_string.split(',')]
        if len(parts) != 4:
            print(f"  Invalid driver string format: {driver_string}")
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
                if sector and sector != "None":
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
                if domain and domain != "None":
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
                if country and country != "None":
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

def fix_objects():
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
                LIMIT 5
            """)
            
            objects = list(result)
            print(f"🔍 Processing first 5 objects as test...")
            
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
            
            print(f"📊 Current RELEVANT_TO relationships:")
            print(f"  Objects: {object_count}")
            
            if object_count > 0:
                print("\n🔍 Sample Object relationships:")
                sample_result = session.run("""
                    MATCH (o:Object)-[r:RELEVANT_TO]->(d)
                    WHERE labels(d)[0] IN ['Sector', 'Domain', 'Country', 'ObjectClarifier']
                    RETURN o.object as object_name, labels(d)[0] as driver_type, d.name as driver_name
                    LIMIT 5
                """)
                for record in sample_result:
                    print(f"  {record['object_name']} -> {record['driver_type']}: {record['driver_name']}")
            
            return object_count > 0
                
        except Exception as e:
            print(f"❌ Error during verification: {e}")
            return False

if __name__ == "__main__":
    print("🔧 Testing driver relationship fix with first 5 objects...")
    print("=" * 60)
    
    # Fix first 5 objects as test
    print("\n🏢 Processing Objects (test with first 5)...")
    print("-" * 40)
    fix_objects()
    
    # Verify results
    print("\n🔍 Verifying relationships...")
    print("-" * 40)
    verify_relationships()
    
    print("\n🎉 Test complete!")
