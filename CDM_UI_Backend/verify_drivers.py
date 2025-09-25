#!/usr/bin/env python3
"""
Verification script for Drivers functionality
Provides queries to check Neo4j data after UI operations
"""

from db import get_driver

def run_verification_queries():
    """Run verification queries to check driver data"""
    driver = get_driver()
    if not driver:
        print("❌ No Neo4j connection available")
        return
    
    with driver.session() as session:
        print("🔍 CDM Drivers Verification Queries")
        print("=" * 50)
        
        # Query 1: Count all driver types
        print("\n1. Count all driver types:")
        result = session.run("""
            MATCH (s:Sector) WITH count(s) as sectors
            MATCH (d:Domain) WITH sectors, count(d) as domains  
            MATCH (c:Country) WITH sectors, domains, count(c) as countries
            MATCH (oc:ObjectClarifier) WITH sectors, domains, countries, count(oc) as object_clarifiers
            MATCH (vc:VariableClarifier) WITH sectors, domains, countries, object_clarifiers, count(vc) as variable_clarifiers
            RETURN sectors, domains, countries, object_clarifiers, variable_clarifiers
        """)
        
        for record in result:
            print(f"   Sectors: {record['sectors']}")
            print(f"   Domains: {record['domains']}")
            print(f"   Countries: {record['countries']}")
            print(f"   Object Clarifiers: {record['object_clarifiers']}")
            print(f"   Variable Clarifiers: {record['variable_clarifiers']}")
        
        # Query 2: List all sectors
        print("\n2. All Sectors:")
        result = session.run("MATCH (s:Sector) RETURN s.name as name ORDER BY name")
        sectors = [record["name"] for record in result]
        if sectors:
            for sector in sectors:
                print(f"   - {sector}")
        else:
            print("   (No sectors found)")
        
        # Query 3: List all domains
        print("\n3. All Domains:")
        result = session.run("MATCH (d:Domain) RETURN d.name as name ORDER BY name")
        domains = [record["name"] for record in result]
        if domains:
            for domain in domains:
                print(f"   - {domain}")
        else:
            print("   (No domains found)")
        
        # Query 4: List all object clarifiers
        print("\n4. All Object Clarifiers:")
        result = session.run("MATCH (oc:ObjectClarifier) RETURN oc.name as name ORDER BY name")
        clarifiers = [record["name"] for record in result]
        if clarifiers:
            for clarifier in clarifiers:
                print(f"   - {clarifier}")
        else:
            print("   (No object clarifiers found)")
        
        # Query 5: List all variable clarifiers
        print("\n6. All Variable Clarifiers:")
        result = session.run("MATCH (vc:VariableClarifier) RETURN vc.name as name ORDER BY name")
        clarifiers = [record["name"] for record in result]
        if clarifiers:
            for clarifier in clarifiers:
                print(f"   - {clarifier}")
        else:
            print("   (No variable clarifiers found)")
        
        # Query 6: Sample countries (first 10)
        print("\n7. Sample Countries (first 10):")
        result = session.run("MATCH (c:Country) RETURN c.name as name ORDER BY name LIMIT 10")
        countries = [record["name"] for record in result]
        for country in countries:
            print(f"   - {country}")
        
        # Query 7: Check for relationships
        print("\n8. Driver Relationships:")
        result = session.run("""
            MATCH (d)-[r]-(related)
            WHERE d:Sector OR d:Domain OR d:Country OR d:ObjectClarifier OR d:VariableClarifier
            RETURN labels(d)[0] as driver_type, d.name as driver_name, 
                   type(r) as relationship_type, labels(related)[0] as related_type,
                   related.id as related_id
            ORDER BY driver_type, driver_name
        """)
        
        relationships = list(result)
        if relationships:
            for rel in relationships:
                print(f"   {rel['driver_type']} '{rel['driver_name']}' -> {rel['relationship_type']} -> {rel['related_type']} (ID: {rel['related_id']})")
        else:
            print("   (No relationships found)")
        
        print("\n" + "=" * 50)
        print("✅ Verification complete!")

def print_manual_queries():
    """Print manual queries for direct Neo4j console use"""
    print("\n📋 Manual Verification Queries (for Neo4j console):")
    print("=" * 60)
    
    queries = [
        ("Count all driver types", """
            MATCH (s:Sector) WITH count(s) as sectors
            MATCH (d:Domain) WITH sectors, count(d) as domains  
            MATCH (c:Country) WITH sectors, domains, count(c) as countries
            MATCH (oc:ObjectClarifier) WITH sectors, domains, countries, count(oc) as object_clarifiers
            MATCH (vc:VariableClarifier) WITH sectors, domains, countries, object_clarifiers, count(vc) as variable_clarifiers
            RETURN sectors, domains, countries, object_clarifiers, variable_clarifiers
        """),
        
        ("List all sectors", "MATCH (s:Sector) RETURN s.name as name ORDER BY name"),
        
        ("List all domains", "MATCH (d:Domain) RETURN d.name as name ORDER BY name"),
        
        ("List all countries", "MATCH (c:Country) RETURN c.name as name ORDER BY name"),
        
        ("List all object clarifiers", "MATCH (oc:ObjectClarifier) RETURN oc.name as name ORDER BY name"),
        
        ("List all variable clarifiers", "MATCH (vc:VariableClarifier) RETURN vc.name as name ORDER BY name"),
        
        ("Check relationships", """
            MATCH (d)-[r]-(related)
            WHERE d:Sector OR d:Domain OR d:Country OR d:ObjectClarifier OR d:VariableClarifier
            RETURN labels(d)[0] as driver_type, d.name as driver_name, 
                   type(r) as relationship_type, labels(related)[0] as related_type,
                   related.id as related_id
            ORDER BY driver_type, driver_name
        """),
        
        ("Find specific sector", "MATCH (s:Sector {name: 'Technology'}) RETURN s"),
        
        ("Find specific domain", "MATCH (d:Domain {name: 'Human Resources'}) RETURN d"),
        
        ("Find specific country", "MATCH (c:Country {name: 'United States'}) RETURN c")
    ]
    
    for i, (description, query) in enumerate(queries, 1):
        print(f"\n{i}. {description}:")
        print(f"   {query.strip()}")

def main():
    print("CDM Drivers Verification Tool")
    print("=" * 40)
    
    # Run automated verification
    run_verification_queries()
    
    # Print manual queries
    print_manual_queries()
    
    print(f"\n💡 Tips:")
    print(f"   - Use the frontend Drivers tab to add/edit/delete drivers")
    print(f"   - Countries are pre-seeded and cannot be added/deleted")
    print(f"   - All driver operations are immediately reflected in Neo4j")
    print(f"   - Use the manual queries above in Neo4j console for detailed inspection")

if __name__ == "__main__":
    main()
