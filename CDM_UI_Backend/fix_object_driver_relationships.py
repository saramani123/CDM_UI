#!/usr/bin/env python3
"""
Script to fix driver relationships for objects in Neo4j.

This script:
1. Checks all objects and their driver strings (sector, domain, country)
2. Verifies that the correct RELEVANT_TO relationships exist in Neo4j
3. Creates missing relationships based on the driver string
4. Handles "All" specially - creates relationships to ALL sectors/domains/countries instead of creating an "All" node

Usage:
    python fix_object_driver_relationships.py [--dry-run] [--instance prod|dev]
"""

import os
import sys
import argparse
from typing import List, Set, Dict, Any
from neo4j import GraphDatabase

# Add parent directory to path to import db module
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import get_driver

def parse_driver_string(driver_string: str) -> Dict[str, List[str]]:
    """
    Parse driver string to extract sector, domain, country, and clarifier.
    
    Format: "sector, domain, country, clarifier"
    Can handle multiple values separated by commas, or "ALL"
    
    Returns:
        Dict with keys: 'sector', 'domain', 'country', 'clarifier'
    """
    parts = driver_string.split(', ')
    
    if len(parts) >= 4:
        if len(parts) == 4:
            # Normal case: exactly 4 parts
            sector_str = parts[0].strip()
            domain_str = parts[1].strip()
            country_str = parts[2].strip()
            clarifier_str = parts[3].strip()
        else:
            # Complex case: one of the first parts contains commas
            # The last part is always the object clarifier
            clarifier_str = parts[-1].strip()
            # The second to last part is always the country
            country_str = parts[-2].strip()
            # The third to last part is always the domain
            domain_str = parts[-3].strip()
            # Everything before that is the sector
            sector_str = ', '.join(parts[:-3]).strip()
    else:
        # Fallback: try to parse with fewer parts
        sector_str = parts[0].strip() if len(parts) > 0 else ""
        domain_str = parts[1].strip() if len(parts) > 1 else ""
        country_str = parts[2].strip() if len(parts) > 2 else ""
        clarifier_str = parts[3].strip() if len(parts) > 3 else "None"
    
    # Parse each part into a list (handle multiple values or "ALL")
    # If "ALL" is present anywhere in the list, treat the entire category as "ALL"
    sector_list = [s.strip() for s in sector_str.split(',') if s.strip()] if sector_str else []
    domain_list = [d.strip() for d in domain_str.split(',') if d.strip()] if domain_str else []
    country_list = [c.strip() for c in country_str.split(',') if c.strip()] if country_str else []
    
    # If "ALL" is in the list, replace the entire list with just ["ALL"]
    if "ALL" in sector_list:
        sector_list = ["ALL"]
    if "ALL" in domain_list:
        domain_list = ["ALL"]
    if "ALL" in country_list:
        country_list = ["ALL"]
    
    return {
        'sector': sector_list,
        'domain': domain_list,
        'country': country_list,
        'clarifier': clarifier_str
    }

def get_expected_relationships(driver_data: Dict[str, List[str]], session) -> Dict[str, Set[str]]:
    """
    Get the expected driver node names that should have relationships to the object.
    
    Returns:
        Dict with keys: 'sectors', 'domains', 'countries', 'clarifiers'
        Values are sets of node names
    """
    expected = {
        'sectors': set(),
        'domains': set(),
        'countries': set(),
        'clarifiers': set()
    }
    
    # Handle sectors
    if "ALL" in driver_data['sector']:
        # Get all sector names (exclude "ALL" as a literal node name)
        result = session.run("MATCH (s:Sector) WHERE s.name <> 'ALL' RETURN s.name as name")
        expected['sectors'] = {record['name'] for record in result}
    else:
        # Filter out "ALL" from the list if it somehow got in there
        expected['sectors'] = {s for s in driver_data['sector'] if s != "ALL"}
    
    # Handle domains
    if "ALL" in driver_data['domain']:
        # Get all domain names (exclude "ALL" as a literal node name)
        result = session.run("MATCH (d:Domain) WHERE d.name <> 'ALL' RETURN d.name as name")
        expected['domains'] = {record['name'] for record in result}
    else:
        # Filter out "ALL" from the list if it somehow got in there
        expected['domains'] = {d for d in driver_data['domain'] if d != "ALL"}
    
    # Handle countries
    if "ALL" in driver_data['country']:
        # Get all country names (exclude "ALL" as a literal node name)
        result = session.run("MATCH (c:Country) WHERE c.name <> 'ALL' RETURN c.name as name")
        expected['countries'] = {record['name'] for record in result}
    else:
        # Filter out "ALL" from the list if it somehow got in there
        expected['countries'] = {c for c in driver_data['country'] if c != "ALL"}
    
    # Handle clarifier
    if driver_data['clarifier'] and driver_data['clarifier'] != "None":
        expected['clarifiers'].add(driver_data['clarifier'])
    
    return expected

def get_actual_relationships(object_id: str, session) -> Dict[str, Set[str]]:
    """
    Get the actual driver relationships that exist in Neo4j for an object.
    
    Returns:
        Dict with keys: 'sectors', 'domains', 'countries', 'clarifiers'
        Values are sets of node names
    """
    actual = {
        'sectors': set(),
        'domains': set(),
        'countries': set(),
        'clarifiers': set()
    }
    
    # Get sector relationships
    result = session.run("""
        MATCH (s:Sector)-[:RELEVANT_TO]->(o:Object {id: $object_id})
        RETURN s.name as name
    """, object_id=object_id)
    actual['sectors'] = {record['name'] for record in result}
    
    # Get domain relationships
    result = session.run("""
        MATCH (d:Domain)-[:RELEVANT_TO]->(o:Object {id: $object_id})
        RETURN d.name as name
    """, object_id=object_id)
    actual['domains'] = {record['name'] for record in result}
    
    # Get country relationships
    result = session.run("""
        MATCH (c:Country)-[:RELEVANT_TO]->(o:Object {id: $object_id})
        RETURN c.name as name
    """, object_id=object_id)
    actual['countries'] = {record['name'] for record in result}
    
    # Get clarifier relationships
    result = session.run("""
        MATCH (oc:ObjectClarifier)-[:RELEVANT_TO]->(o:Object {id: $object_id})
        RETURN oc.name as name
    """, object_id=object_id)
    actual['clarifiers'] = {record['name'] for record in result}
    
    return actual

def fix_object_relationships(object_id: str, object_name: str, driver_string: str, session, dry_run: bool = False) -> Dict[str, Any]:
    """
    Fix driver relationships for a single object.
    
    Returns:
        Dict with information about what was fixed
    """
    result_info = {
        'object_id': object_id,
        'object_name': object_name,
        'driver_string': driver_string,
        'fixed': False,
        'missing_sectors': [],
        'missing_domains': [],
        'missing_countries': [],
        'missing_clarifiers': [],
        'created_relationships': 0
    }
    
    # Parse driver string
    driver_data = parse_driver_string(driver_string)
    
    # Get expected and actual relationships
    expected = get_expected_relationships(driver_data, session)
    actual = get_actual_relationships(object_id, session)
    
    # Find missing relationships
    missing_sectors = expected['sectors'] - actual['sectors']
    missing_domains = expected['domains'] - actual['domains']
    missing_countries = expected['countries'] - actual['countries']
    missing_clarifiers = expected['clarifiers'] - actual['clarifiers']
    
    result_info['missing_sectors'] = list(missing_sectors)
    result_info['missing_domains'] = list(missing_domains)
    result_info['missing_countries'] = list(missing_countries)
    result_info['missing_clarifiers'] = list(missing_clarifiers)
    
    # If there are missing relationships, create them
    if missing_sectors or missing_domains or missing_countries or missing_clarifiers:
        result_info['fixed'] = True
        
        if not dry_run:
            # Create missing sector relationships
            for sector_name in missing_sectors:
                session.run("""
                    MATCH (s:Sector {name: $sector})
                    MATCH (o:Object {id: $object_id})
                    WITH s, o
                    CREATE (s)-[:RELEVANT_TO]->(o)
                """, sector=sector_name, object_id=object_id)
                result_info['created_relationships'] += 1
            
            # Create missing domain relationships
            for domain_name in missing_domains:
                session.run("""
                    MATCH (d:Domain {name: $domain})
                    MATCH (o:Object {id: $object_id})
                    WITH d, o
                    CREATE (d)-[:RELEVANT_TO]->(o)
                """, domain=domain_name, object_id=object_id)
                result_info['created_relationships'] += 1
            
            # Create missing country relationships
            for country_name in missing_countries:
                session.run("""
                    MATCH (c:Country {name: $country})
                    MATCH (o:Object {id: $object_id})
                    WITH c, o
                    CREATE (c)-[:RELEVANT_TO]->(o)
                """, country=country_name, object_id=object_id)
                result_info['created_relationships'] += 1
            
            # Create missing clarifier relationships
            for clarifier_name in missing_clarifiers:
                session.run("""
                    MATCH (oc:ObjectClarifier {name: $clarifier})
                    MATCH (o:Object {id: $object_id})
                    WITH oc, o
                    CREATE (oc)-[:RELEVANT_TO]->(o)
                """, clarifier=clarifier_name, object_id=object_id)
                result_info['created_relationships'] += 1
    
    return result_info

def main():
    parser = argparse.ArgumentParser(description='Fix driver relationships for objects in Neo4j')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be fixed without making changes')
    parser.add_argument('--instance', choices=['prod', 'dev'], default='prod', help='Neo4j instance to use (default: prod)')
    args = parser.parse_args()
    
    # Get driver connection
    driver = get_driver()
    if not driver:
        print("ERROR: Failed to connect to Neo4j database")
        sys.exit(1)
    
    print(f"Connected to Neo4j ({args.instance} instance)")
    if args.dry_run:
        print("DRY RUN MODE - No changes will be made")
    print()
    
    try:
        with driver.session() as session:
            # Get all objects
            result = session.run("""
                MATCH (o:Object)
                RETURN o.id as id, o.name as name, o.object as object_name, o.driver as driver
                ORDER BY o.object
            """)
            
            objects = list(result)
            print(f"Found {len(objects)} objects to check")
            print()
            
            fixed_count = 0
            total_relationships_created = 0
            results = []
            
            for record in objects:
                object_id = record['id']
                object_name = record.get('object_name') or record.get('name') or 'Unknown'
                driver_string = record.get('driver') or ''
                
                if not driver_string:
                    print(f"⚠️  Skipping {object_name} (ID: {object_id}) - no driver string")
                    continue
                
                result_info = fix_object_relationships(object_id, object_name, driver_string, session, dry_run=args.dry_run)
                results.append(result_info)
                
                if result_info['fixed']:
                    fixed_count += 1
                    total_relationships_created += result_info['created_relationships']
                    
                    print(f"✅ Fixed {object_name} (ID: {object_id})")
                    if result_info['missing_sectors']:
                        print(f"   - Created {len(result_info['missing_sectors'])} sector relationship(s): {', '.join(result_info['missing_sectors'][:5])}{'...' if len(result_info['missing_sectors']) > 5 else ''}")
                    if result_info['missing_domains']:
                        print(f"   - Created {len(result_info['missing_domains'])} domain relationship(s): {', '.join(result_info['missing_domains'][:5])}{'...' if len(result_info['missing_domains']) > 5 else ''}")
                    if result_info['missing_countries']:
                        print(f"   - Created {len(result_info['missing_countries'])} country relationship(s): {', '.join(result_info['missing_countries'][:5])}{'...' if len(result_info['missing_countries']) > 5 else ''}")
                    if result_info['missing_clarifiers']:
                        print(f"   - Created {len(result_info['missing_clarifiers'])} clarifier relationship(s): {', '.join(result_info['missing_clarifiers'])}")
            
            print()
            print("=" * 60)
            print(f"Summary:")
            print(f"  Total objects checked: {len(objects)}")
            print(f"  Objects fixed: {fixed_count}")
            print(f"  Total relationships created: {total_relationships_created}")
            if args.dry_run:
                print()
                print("This was a DRY RUN - no changes were made")
                print("Run without --dry-run to apply changes")
            
    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        driver.close()

if __name__ == '__main__':
    main()
