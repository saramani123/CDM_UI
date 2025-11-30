#!/usr/bin/env python3
"""
Diagnostic script to check tiered list structure in Neo4j.
This script helps diagnose issues with tiered lists, particularly the Currency list.

Usage:
    python diagnose_tiered_lists.py [list_name]
    
If list_name is not provided, it will check all multi-level lists.
"""

import os
import sys
from neo4j import GraphDatabase
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_driver():
    """Get Neo4j driver from environment variables."""
    neo4j_uri = os.getenv("NEO4J_URI")
    neo4j_user = os.getenv("NEO4J_USER")
    neo4j_password = os.getenv("NEO4J_PASSWORD")
    
    if not all([neo4j_uri, neo4j_user, neo4j_password]):
        print("Error: Missing Neo4j environment variables")
        print("Required: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD")
        return None
    
    try:
        driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_user, neo4j_password))
        driver.verify_connectivity()
        return driver
    except Exception as e:
        print(f"Error connecting to Neo4j: {e}")
        return None

def diagnose_list(driver, list_name=None):
    """Diagnose a specific list or all multi-level lists."""
    with driver.session() as session:
        if list_name:
            # Find the specific list
            result = session.run("""
                MATCH (l:List {name: $list_name})
                RETURN l.id as id, l.name as name, l.set as set, l.grouping as grouping
            """, {"list_name": list_name})
            
            record = result.single()
            if not record:
                print(f"List '{list_name}' not found in Neo4j")
                return
            
            list_id = record["id"]
            print(f"\n{'='*80}")
            print(f"Diagnosing List: {list_name} (ID: {list_id})")
            print(f"{'='*80}\n")
            diagnose_single_list(session, list_id, list_name)
        else:
            # Find all multi-level lists
            result = session.run("""
                MATCH (l:List)-[r:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5]->(tier:List)
                RETURN DISTINCT l.id as id, l.name as name, l.set as set, l.grouping as grouping
                ORDER BY l.name
            """)
            
            lists = list(result)
            if not lists:
                print("No multi-level lists found in Neo4j")
                return
            
            print(f"\nFound {len(lists)} multi-level list(s):\n")
            for record in lists:
                list_id = record["id"]
                list_name = record["name"]
                print(f"\n{'='*80}")
                print(f"Diagnosing List: {list_name} (ID: {list_id})")
                print(f"{'='*80}\n")
                diagnose_single_list(session, list_id, list_name)

def diagnose_single_list(session, list_id, list_name):
    """Diagnose a single list's tiered structure."""
    
    # 1. Check if list exists and get basic info
    result = session.run("""
        MATCH (l:List {id: $list_id})
        RETURN l.id as id, l.name as name, l.set as set, l.grouping as grouping
    """, {"list_id": list_id})
    
    record = result.single()
    if not record:
        print(f"ERROR: List with ID {list_id} not found!")
        return
    
    print(f"List Name: {record['name']}")
    print(f"Set: {record['set']}")
    print(f"Grouping: {record['grouping']}")
    print()
    
    # 2. Check for tier relationships
    tier_result = session.run("""
        MATCH (l:List {id: $list_id})-[r:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tier:List)
        RETURN type(r) as rel_type, tier.id as tier_id, tier.name as tier_name, tier.tier as tier_number
        ORDER BY type(r)
    """, {"list_id": list_id})
    
    tiers = list(tier_result)
    if not tiers:
        print("⚠️  WARNING: No tier relationships found. This is not a multi-level list.")
        return
    
    print(f"Found {len(tiers)} tier relationship(s):")
    for tier in tiers:
        print(f"  - {tier['rel_type']}: {tier['tier_name']} (ID: {tier['tier_id']}, tier property: {tier['tier_number']})")
    print()
    
    # 3. Check for values on each tier list
    for tier in tiers:
        tier_id = tier['tier_id']
        tier_name = tier['tier_name']
        rel_type = tier['rel_type']
        
        print(f"Checking values for {rel_type}: {tier_name} (ID: {tier_id})")
        
        # Count direct values
        values_result = session.run("""
            MATCH (tier:List {id: $tier_id})-[r:HAS_LIST_VALUE]->(lv:ListValue)
            RETURN count(lv) as count, collect(lv.value)[0..10] as sample_values
        """, {"tier_id": tier_id})
        
        values_record = values_result.single()
        if values_record:
            count = values_record["count"] or 0
            sample_values = values_record["sample_values"] or []
            print(f"  Direct values (HAS_LIST_VALUE): {count}")
            if sample_values:
                print(f"  Sample values: {', '.join(sample_values[:10])}")
                if count > 10:
                    print(f"  ... and {count - 10} more")
            else:
                print(f"  ⚠️  WARNING: No direct values found!")
        else:
            print(f"  ⚠️  WARNING: No direct values found!")
        
        # Check for nested values via tier relationships
        nested_result = session.run("""
            MATCH (tier:List {id: $tier_id})-[r:HAS_LIST_VALUE]->(lv1:ListValue)
            MATCH (lv1)-[tier_rel]->(lv2:ListValue)
            WHERE type(tier_rel) STARTS WITH 'HAS_' AND type(tier_rel) ENDS WITH '_VALUE'
            RETURN count(DISTINCT lv2) as count, collect(DISTINCT lv2.value)[0..10] as sample_values
        """, {"tier_id": tier_id})
        
        nested_record = nested_result.single()
        if nested_record:
            nested_count = nested_record["count"] or 0
            nested_samples = nested_record["sample_values"] or []
            if nested_count > 0:
                print(f"  Nested values (via tier relationships): {nested_count}")
                if nested_samples:
                    print(f"  Sample nested values: {', '.join(nested_samples[:10])}")
                    if nested_count > 10:
                        print(f"  ... and {nested_count - 10} more")
        
        print()
    
    # 4. Check for tier value relationships (HAS_TIER_X_VALUE)
    print("Checking tier value relationships (HAS_TIER_X_VALUE):")
    tier_value_result = session.run("""
        MATCH (l:List {id: $list_id})-[tier_rel:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tier:List)
        MATCH (tier)-[:HAS_LIST_VALUE]->(lv1:ListValue)
        MATCH (lv1)-[tier_val_rel]->(lv2:ListValue)
        WHERE type(tier_val_rel) STARTS WITH 'HAS_' AND type(tier_val_rel) ENDS WITH '_VALUE'
        RETURN type(tier_val_rel) as rel_type, count(DISTINCT lv1) as tier1_count, count(DISTINCT lv2) as tier2_count
        ORDER BY rel_type
    """, {"list_id": list_id})
    
    tier_value_records = list(tier_value_result)
    if tier_value_records:
        for record in tier_value_records:
            print(f"  {record['rel_type']}: {record['tier1_count']} tier 1 values -> {record['tier2_count']} tier 2 values")
    else:
        print("  ⚠️  WARNING: No tier value relationships found!")
    print()
    
    # 5. Get a sample of the actual data structure
    print("Sample data structure (first 5 tier 1 values and their tiered values):")
    sample_result = session.run("""
        MATCH (l:List {id: $list_id})-[tier_rel:HAS_TIER_1]->(tier1:List)
        MATCH (tier1)-[:HAS_LIST_VALUE]->(lv1:ListValue)
        OPTIONAL MATCH (lv1)-[tier_val_rel]->(lv2:ListValue)
        WHERE type(tier_val_rel) STARTS WITH 'HAS_' AND type(tier_val_rel) ENDS WITH '_VALUE'
        WITH lv1, collect(lv2.value) as tier2_values
        RETURN lv1.value as tier1_value, tier2_values
        ORDER BY lv1.value
        LIMIT 5
    """, {"list_id": list_id})
    
    sample_records = list(sample_result)
    if sample_records:
        for record in sample_records:
            tier1_val = record["tier1_value"]
            tier2_vals = record["tier2_values"] or []
            print(f"  {tier1_val}: {', '.join(tier2_vals[:5])}")
            if len(tier2_vals) > 5:
                print(f"    ... and {len(tier2_vals) - 5} more")
    else:
        print("  ⚠️  WARNING: No tier 1 values found!")
    print()

def main():
    """Main entry point."""
    list_name = sys.argv[1] if len(sys.argv) > 1 else None
    
    print("Neo4j Tiered List Diagnostic Script")
    print("=" * 80)
    
    driver = get_driver()
    if not driver:
        sys.exit(1)
    
    try:
        diagnose_list(driver, list_name)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        driver.close()

if __name__ == "__main__":
    main()

