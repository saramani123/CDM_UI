#!/usr/bin/env python3
"""
Migration script to normalize variable driver strings in production.

This script:
1. Finds all variables with driver relationships
2. Checks if all sectors/domains/countries are present
3. Normalizes driver strings to use "ALL" when all values are present
4. Updates the Variable.driver property (does NOT change relationships)

IMPORTANT: This script does NOT modify Neo4j relationships - it only updates
the driver string property on Variable nodes for display purposes.
"""

import os
import sys
from dotenv import load_dotenv
from db import get_driver

def normalize_driver_strings(dry_run=True):
    """
    Normalize driver strings for all variables.
    
    Args:
        dry_run: If True, only print what would be changed without making changes
    """
    # Load environment variables
    load_dotenv()
    
    driver = get_driver()
    if not driver:
        print("❌ Failed to connect to Neo4j database")
        return False
    
    print("🔍 Normalizing Variable Driver Strings")
    print("=" * 60)
    print(f"Mode: {'DRY RUN (no changes will be made)' if dry_run else 'LIVE (changes will be applied)'}")
    print()
    
    try:
        with driver.session() as session:
            # Get all possible driver values
            print("📊 Getting all driver values...")
            all_sectors_result = session.run("MATCH (s:Sector) WHERE s.name <> 'ALL' RETURN s.name as name")
            all_sectors = {record["name"] for record in all_sectors_result}
            
            all_domains_result = session.run("MATCH (d:Domain) WHERE d.name <> 'ALL' RETURN d.name as name")
            all_domains = {record["name"] for record in all_domains_result}
            
            all_countries_result = session.run("MATCH (c:Country) WHERE c.name <> 'ALL' RETURN c.name as name")
            all_countries = {record["name"] for record in all_countries_result}
            
            print(f"   Found {len(all_sectors)} sectors, {len(all_domains)} domains, {len(all_countries)} countries")
            print()
            
            # Get all variables with their driver relationships
            print("🔍 Finding variables with driver relationships...")
            result = session.run("""
                MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v:Variable)
                OPTIONAL MATCH (v)<-[:IS_RELEVANT_TO]-(s:Sector)
                OPTIONAL MATCH (v)<-[:IS_RELEVANT_TO]-(d:Domain)
                OPTIONAL MATCH (v)<-[:IS_RELEVANT_TO]-(c:Country)
                OPTIONAL MATCH (v)<-[:IS_RELEVANT_TO]-(vc:VariableClarifier)
                WITH v, p, g,
                     collect(DISTINCT s.name) as sectors,
                     collect(DISTINCT d.name) as domains,
                     collect(DISTINCT c.name) as countries,
                     collect(DISTINCT vc.name) as variableClarifiers
                RETURN v.id as id, v.name as variable, v.driver as current_driver,
                       p.name as part, g.name as group,
                       sectors, domains, countries, variableClarifiers
                ORDER BY v.id
            """)
            
            variables_to_update = []
            total_variables = 0
            
            for record in result:
                total_variables += 1
                variable_id = record["id"]
                variable_name = record["variable"]
                current_driver = record.get("current_driver") or ""
                sectors = record["sectors"] or []
                domains = record["domains"] or []
                countries = record["countries"] or []
                variable_clarifiers = record["variableClarifiers"] or []
                
                # Filter out "ALL" from the lists (it's not a real node)
                sectors_filtered = [s for s in sectors if s != "ALL"]
                domains_filtered = [d for d in domains if d != "ALL"]
                countries_filtered = [c for c in countries if c != "ALL"]
                
                # Check if all possible values are selected
                sectors_set = set(sectors_filtered)
                domains_set = set(domains_filtered)
                countries_set = set(countries_filtered)
                
                # Determine normalized values
                sector_str = "ALL" if ("ALL" in sectors or (len(all_sectors) > 0 and sectors_set == all_sectors)) else (", ".join(sectors_filtered) if sectors_filtered else "ALL")
                domain_str = "ALL" if ("ALL" in domains or (len(all_domains) > 0 and domains_set == all_domains)) else (", ".join(domains_filtered) if domains_filtered else "ALL")
                country_str = "ALL" if ("ALL" in countries or (len(all_countries) > 0 and countries_set == all_countries)) else (", ".join(countries_filtered) if countries_filtered else "ALL")
                clarifier_str = variable_clarifiers[0] if variable_clarifiers else "None"
                
                new_driver = f"{sector_str}, {domain_str}, {country_str}, {clarifier_str}"
                
                # Only update if the driver string has changed
                if current_driver != new_driver:
                    variables_to_update.append({
                        'id': variable_id,
                        'name': variable_name,
                        'part': record.get("part", ""),
                        'group': record.get("group", ""),
                        'current_driver': current_driver,
                        'new_driver': new_driver
                    })
            
            print(f"📈 Found {total_variables} total variables")
            print(f"🔄 {len(variables_to_update)} variables need driver string normalization")
            print()
            
            if len(variables_to_update) == 0:
                print("✅ All driver strings are already normalized!")
                return True
            
            # Show what will be changed
            print("📋 Variables to update:")
            print("-" * 60)
            for i, var in enumerate(variables_to_update[:10], 1):  # Show first 10
                print(f"{i}. {var['name']} ({var['part']} / {var['group']})")
                print(f"   Current: {var['current_driver']}")
                print(f"   New:     {var['new_driver']}")
                print()
            
            if len(variables_to_update) > 10:
                print(f"   ... and {len(variables_to_update) - 10} more")
                print()
            
            if dry_run:
                print("⚠️  DRY RUN MODE - No changes were made")
                print("   Run with --apply to apply these changes")
                return True
            
            # Apply changes
            print("💾 Applying changes...")
            updated_count = 0
            failed_count = 0
            
            for var in variables_to_update:
                try:
                    session.run("""
                        MATCH (v:Variable {id: $id})
                        SET v.driver = $new_driver
                    """, id=var['id'], new_driver=var['new_driver'])
                    updated_count += 1
                except Exception as e:
                    print(f"❌ Failed to update {var['name']} ({var['id']}): {e}")
                    failed_count += 1
            
            print()
            print("=" * 60)
            print(f"✅ Successfully updated {updated_count} variables")
            if failed_count > 0:
                print(f"❌ Failed to update {failed_count} variables")
            print()
            print("✅ Migration complete!")
            return True
            
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    # Check for --apply flag
    dry_run = "--apply" not in sys.argv
    
    if dry_run:
        print("⚠️  Running in DRY RUN mode")
        print("   Add --apply flag to actually make changes")
        print()
    
    success = normalize_driver_strings(dry_run=dry_run)
    sys.exit(0 if success else 1)

