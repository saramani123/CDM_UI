#!/usr/bin/env python3
"""
Fix Groups with Multiple Parts - Data Integrity Script

This script diagnoses and fixes the issue where groups have multiple parts
attached to them, which violates the constraint that groups should be
exclusive to a single part.

The issue occurred when users bulk-edited variables and selected a new Part
but kept the current Group, causing MERGE to create a new Part->Group
relationship without checking if the group already belonged to another part.

Usage:
    python fix_group_part_relationships.py [--dry-run] [--verbose]

Options:
    --dry-run: Only diagnose, don't make changes
    --verbose: Show detailed information about each fix
"""

import sys
import os
from typing import List, Dict, Tuple, Any
from neo4j import GraphDatabase, WRITE_ACCESS

# Add parent directory to path to import db module
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import get_driver

def find_groups_with_multiple_parts(session) -> List[Dict[str, Any]]:
    """
    Find all groups that have relationships to more than one part.
    
    Returns:
        List of dicts with group name and list of parts it's connected to
    """
    query = """
        MATCH (g:Group)
        MATCH (p:Part)-[:HAS_GROUP]->(g)
        WITH g, collect(DISTINCT p.name) as parts
        WHERE size(parts) > 1
        RETURN g.name as group_name, parts
        ORDER BY g.name
    """
    
    result = session.run(query)
    groups_with_multiple_parts = []
    
    for record in result:
        groups_with_multiple_parts.append({
            'group_name': record['group_name'],
            'parts': record['parts']
        })
    
    return groups_with_multiple_parts

def get_variable_count_by_part_for_group(session, group_name: str, part_name: str) -> int:
    """
    Count how many variables are connected to a group through a specific part.
    
    Args:
        group_name: Name of the group
        part_name: Name of the part
        
    Returns:
        Number of variables connected through this part-group relationship
    """
    query = """
        MATCH (p:Part {name: $part_name})-[:HAS_GROUP]->(g:Group {name: $group_name})-[:HAS_VARIABLE]->(v:Variable)
        RETURN count(DISTINCT v) as var_count
    """
    
    result = session.run(query, part_name=part_name, group_name=group_name)
    record = result.single()
    return record['var_count'] if record else 0

def determine_primary_part(session, group_name: str, parts: List[str]) -> Tuple[str, Dict[str, int]]:
    """
    Determine which part should be the primary one for a group.
    
    Strategy:
    1. Count variables connected through each part
    2. If counts are equal, prefer the first alphabetically
    3. Otherwise, prefer the part with more variables
    
    Returns:
        Tuple of (primary_part_name, dict of part_name -> variable_count)
    """
    part_counts = {}
    
    for part_name in parts:
        count = get_variable_count_by_part_for_group(session, group_name, part_name)
        part_counts[part_name] = count
    
    # Sort by count (descending), then by name (ascending) for tie-breaking
    sorted_parts = sorted(part_counts.items(), key=lambda x: (-x[1], x[0]))
    primary_part = sorted_parts[0][0]
    
    return primary_part, part_counts

def fix_group_part_relationships(session, group_name: str, primary_part: str, other_parts: List[str], dry_run: bool = False, verbose: bool = False) -> Dict[str, Any]:
    """
    Fix a group with multiple parts by severing relationships to non-primary parts.
    
    Args:
        session: Neo4j session
        group_name: Name of the group to fix
        primary_part: The part to keep
        other_parts: List of parts to remove relationships from
        dry_run: If True, don't make changes
        verbose: If True, show detailed information
        
    Returns:
        Dict with fix results
    """
    result = {
        'group_name': group_name,
        'primary_part': primary_part,
        'removed_parts': other_parts,
        'relationships_removed': 0,
        'dry_run': dry_run
    }
    
    if dry_run:
        if verbose:
            print(f"  [DRY RUN] Would remove HAS_GROUP relationships from parts: {', '.join(other_parts)}")
        return result
    
    # Remove HAS_GROUP relationships from non-primary parts
    for part_name in other_parts:
        query = """
            MATCH (p:Part {name: $part_name})-[r:HAS_GROUP]->(g:Group {name: $group_name})
            DELETE r
            RETURN count(r) as removed_count
        """
        
        delete_result = session.run(query, part_name=part_name, group_name=group_name)
        record = delete_result.single()
        removed = record['removed_count'] if record else 0
        result['relationships_removed'] += removed
        
        if verbose:
            print(f"  Removed {removed} HAS_GROUP relationship(s) from Part '{part_name}' to Group '{group_name}'")
    
    return result

def verify_variable_integrity(session) -> Dict[str, Any]:
    """
    Verify that all variables are properly connected:
    - Each variable should have exactly one group
    - Each group should have exactly one part
    
    Returns:
        Dict with verification results
    """
    # Check for variables with multiple groups
    query1 = """
        MATCH (v:Variable)
        MATCH (g:Group)-[:HAS_VARIABLE]->(v)
        WITH v, collect(DISTINCT g.name) as groups
        WHERE size(groups) > 1
        RETURN count(v) as multi_group_vars
    """
    
    result1 = session.run(query1)
    record1 = result1.single()
    multi_group_vars = record1['multi_group_vars'] if record1 else 0
    
    # Check for groups with multiple parts
    query2 = """
        MATCH (g:Group)
        MATCH (p:Part)-[:HAS_GROUP]->(g)
        WITH g, collect(DISTINCT p.name) as parts
        WHERE size(parts) > 1
        RETURN count(g) as multi_part_groups
    """
    
    result2 = session.run(query2)
    record2 = result2.single()
    multi_part_groups = record2['multi_part_groups'] if record2 else 0
    
    # Check for variables with no group
    query3 = """
        MATCH (v:Variable)
        WHERE NOT (g:Group)-[:HAS_VARIABLE]->(v)
        RETURN count(v) as orphaned_vars
    """
    
    result3 = session.run(query3)
    record3 = result3.single()
    orphaned_vars = record3['orphaned_vars'] if record3 else 0
    
    return {
        'variables_with_multiple_groups': multi_group_vars,
        'groups_with_multiple_parts': multi_part_groups,
        'orphaned_variables': orphaned_vars
    }

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Fix groups with multiple parts')
    parser.add_argument('--dry-run', action='store_true', help='Only diagnose, don\'t make changes')
    parser.add_argument('--verbose', action='store_true', help='Show detailed information')
    args = parser.parse_args()
    
    driver = get_driver()
    if not driver:
        print("ERROR: Failed to connect to Neo4j database")
        sys.exit(1)
    
    print("=" * 80)
    print("FIX GROUP-PART RELATIONSHIPS - Data Integrity Script")
    print("=" * 80)
    print()
    
    if args.dry_run:
        print("🔍 DRY RUN MODE - No changes will be made")
        print()
    
    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            # Step 1: Find groups with multiple parts
            print("Step 1: Finding groups with multiple parts...")
            groups_with_multiple_parts = find_groups_with_multiple_parts(session)
            
            if not groups_with_multiple_parts:
                print("✅ No groups with multiple parts found. Database is clean!")
                return
            
            print(f"⚠️  Found {len(groups_with_multiple_parts)} group(s) with multiple parts:")
            print()
            
            # Step 2: Analyze each group and determine primary part
            print("Step 2: Analyzing each group to determine primary part...")
            print()
            
            fixes = []
            for group_info in groups_with_multiple_parts:
                group_name = group_info['group_name']
                parts = group_info['parts']
                
                print(f"Group: {group_name}")
                print(f"  Parts: {', '.join(parts)}")
                
                # Count variables for each part
                primary_part, part_counts = determine_primary_part(session, group_name, parts)
                other_parts = [p for p in parts if p != primary_part]
                
                print(f"  Variable counts by part:")
                for part_name, count in sorted(part_counts.items(), key=lambda x: (-x[1], x[0])):
                    marker = " ← PRIMARY" if part_name == primary_part else " (will remove)"
                    print(f"    {part_name}: {count} variables{marker}")
                
                # Step 3: Fix the relationships
                print(f"  Fixing: Keeping Part '{primary_part}', removing relationships from: {', '.join(other_parts)}")
                fix_result = fix_group_part_relationships(
                    session, 
                    group_name, 
                    primary_part, 
                    other_parts,
                    dry_run=args.dry_run,
                    verbose=args.verbose
                )
                fixes.append(fix_result)
                print()
            
            # Step 4: Verify integrity
            print("Step 3: Verifying data integrity...")
            verification = verify_variable_integrity(session)
            
            print(f"  Variables with multiple groups: {verification['variables_with_multiple_groups']}")
            print(f"  Groups with multiple parts: {verification['groups_with_multiple_parts']}")
            print(f"  Orphaned variables (no group): {verification['orphaned_variables']}")
            print()
            
            # Summary
            print("=" * 80)
            print("SUMMARY")
            print("=" * 80)
            print(f"Groups fixed: {len(fixes)}")
            total_relationships_removed = sum(f['relationships_removed'] for f in fixes)
            print(f"Total relationships removed: {total_relationships_removed}")
            
            if verification['groups_with_multiple_parts'] == 0:
                print("✅ All groups now have exactly one part!")
            else:
                print(f"⚠️  Warning: {verification['groups_with_multiple_parts']} groups still have multiple parts")
            
            if verification['variables_with_multiple_groups'] > 0:
                print(f"⚠️  Warning: {verification['variables_with_multiple_groups']} variables have multiple groups")
            
            if verification['orphaned_variables'] > 0:
                print(f"⚠️  Warning: {verification['orphaned_variables']} variables are orphaned (no group)")
            
            if args.dry_run:
                print()
                print("🔍 This was a dry run. Run without --dry-run to apply fixes.")
            else:
                print()
                print("✅ Fixes applied successfully!")
            
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        driver.close()

if __name__ == '__main__':
    main()
