"""
One-time migration script to ensure ALL existing variables have IS_RELEVANT_TO driver relationships.

This script:
1. Finds all variables in the database
2. For each variable, checks if it has a driver string stored
3. If no driver string, tries to reconstruct it from existing IS_RELEVANT_TO relationships
4. If no relationships exist either, uses default "ALL, ALL, ALL, None"
5. Stores the driver string on the variable node
6. Creates IS_RELEVANT_TO relationships for Sector, Domain, Country, and VariableClarifier

Usage:
    # On local dev (with .env.dev file):
    python migrate_variable_driver_relationships.py
    
    # On Render production (via shell):
    python migrate_variable_driver_relationships.py
    
    # Or via API endpoint after deployment:
    curl -X POST https://your-backend-url/api/v1/variables/backfill-driver-relationships

This should be run once on both dev and prod servers to migrate existing variables.

For Production on Render:
- Environment variables are automatically injected by Render
- No .env file needed - script will use os.getenv() which Render provides
"""

import sys
import os
import asyncio

# Add the current directory to the path so we can import db and routes
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import get_driver
from neo4j import WRITE_ACCESS

# Import the create_driver_relationships function from routes.variables
from routes.variables import create_driver_relationships

async def migrate_all_variables():
    """Migrate all existing variables to have driver relationships"""
    # Check environment
    environment = os.getenv("ENVIRONMENT", "development")
    is_render = os.getenv("RENDER") is not None
    
    if environment == "production" or is_render:
        print("🔧 Running in PRODUCTION mode (Render)")
        print("   Environment variables should be injected by Render")
    else:
        print("🔧 Running in DEVELOPMENT mode")
        print("   Using .env.dev file for configuration")
    
    driver = get_driver()
    if not driver:
        print("❌ Failed to connect to Neo4j database")
        if environment == "production" or is_render:
            print("Please check your Render environment variables:")
            print("  - NEO4J_URI")
            print("  - NEO4J_USERNAME")
            print("  - NEO4J_PASSWORD")
        else:
            print("Please check your .env.dev file and ensure Neo4j is running")
        return False

    try:
        with driver.session(default_access_mode=WRITE_ACCESS) as session:
            # Get all variables
            print("\n🔍 Finding all variables in the database...")
            result = session.run("""
                MATCH (v:Variable)
                RETURN v.id as id, v.name as variable, v.driver as driver
                ORDER BY v.id
            """)
            
            variables = []
            for record in result:
                variables.append({
                    "id": record["id"],
                    "variable": record["variable"],
                    "driver": record.get("driver")
                })
            
            print(f"✅ Found {len(variables)} variables to process\n")
            
            created_count = 0
            skipped_count = 0
            error_count = 0
            errors = []
            
            # For each variable, create driver relationships
            for i, var in enumerate(variables, 1):
                variable_id = var["id"]
                variable_name = var["variable"]
                driver_string = var.get("driver")
                
                print(f"[{i}/{len(variables)}] Processing: {variable_name} ({variable_id})")
                
                # If no driver string stored, try to reconstruct from existing relationships
                if not driver_string or driver_string.strip() == "":
                    print(f"  ⚠️  No driver string found, checking for existing relationships...")
                    
                    # Try to get driver string from existing IS_RELEVANT_TO relationships
                    rel_result = session.run("""
                        MATCH (v:Variable {id: $variable_id})
                        OPTIONAL MATCH (s:Sector)-[:IS_RELEVANT_TO]->(v)
                        OPTIONAL MATCH (d:Domain)-[:IS_RELEVANT_TO]->(v)
                        OPTIONAL MATCH (c:Country)-[:IS_RELEVANT_TO]->(v)
                        OPTIONAL MATCH (vc:VariableClarifier)-[:IS_RELEVANT_TO]->(v)
                        WITH v, 
                             collect(DISTINCT s.name) as sectors,
                             collect(DISTINCT d.name) as domains,
                             collect(DISTINCT c.name) as countries,
                             collect(DISTINCT vc.name) as clarifiers
                        RETURN sectors, domains, countries, clarifiers
                    """, variable_id=variable_id)
                    
                    rel_record = rel_result.single()
                    if rel_record:
                        sectors = rel_record.get("sectors") or []
                        domains = rel_record.get("domains") or []
                        countries = rel_record.get("countries") or []
                        clarifiers = rel_record.get("clarifiers") or []
                        
                        # Reconstruct driver string
                        sector_str = "ALL" if "ALL" in sectors else (", ".join(sectors) if sectors else "ALL")
                        domain_str = "ALL" if "ALL" in domains else (", ".join(domains) if domains else "ALL")
                        country_str = "ALL" if "ALL" in countries else (", ".join(countries) if countries else "ALL")
                        clarifier_str = clarifiers[0] if clarifiers else "None"
                        
                        driver_string = f"{sector_str}, {domain_str}, {country_str}, {clarifier_str}"
                        
                        # Store reconstructed driver string on the variable node
                        session.run("""
                            MATCH (v:Variable {id: $variable_id})
                            SET v.driver = $driver
                        """, variable_id=variable_id, driver=driver_string)
                        print(f"  📝 Reconstructed and stored driver string: {driver_string}")
                    else:
                        # No driver string and no existing relationships - use default
                        driver_string = "ALL, ALL, ALL, None"
                        session.run("""
                            MATCH (v:Variable {id: $variable_id})
                            SET v.driver = $driver
                        """, variable_id=variable_id, driver=driver_string)
                        print(f"  📝 Using default driver string: {driver_string}")
                else:
                    print(f"  ✓ Driver string found: {driver_string}")
                
                # Create driver relationships
                if driver_string and driver_string.strip():
                    try:
                        await create_driver_relationships(session, variable_id, driver_string)
                        created_count += 1
                        print(f"  ✅ Created driver relationships\n")
                    except Exception as e:
                        error_count += 1
                        error_msg = f"Failed to create relationships for {variable_id} ({variable_name}): {str(e)}"
                        errors.append(error_msg)
                        print(f"  ❌ {error_msg}\n")
                else:
                    skipped_count += 1
                    print(f"  ⚠️  Skipped - no driver string available\n")
            
            # Print summary
            print("\n" + "="*60)
            print("MIGRATION SUMMARY")
            print("="*60)
            print(f"Total variables processed: {len(variables)}")
            print(f"✅ Relationships created: {created_count}")
            print(f"⚠️  Skipped: {skipped_count}")
            print(f"❌ Errors: {error_count}")
            
            if errors:
                print(f"\nErrors encountered ({len(errors)}):")
                for error in errors[:10]:  # Show first 10 errors
                    print(f"  - {error}")
                if len(errors) > 10:
                    print(f"  ... and {len(errors) - 10} more errors")
            
            print("\n" + "="*60)
            print("✅ Migration complete!")
            print("="*60 + "\n")
            
            return error_count == 0
    
    except Exception as e:
        print(f"\n❌ Error in migration: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        driver.close()

if __name__ == "__main__":
    print("\n" + "="*60)
    print("VARIABLE DRIVER RELATIONSHIPS MIGRATION")
    print("="*60)
    print("\nThis script will ensure ALL existing variables have IS_RELEVANT_TO")
    print("relationships with their Sector, Domain, Country, and VariableClarifier nodes.")
    print("\n⚠️  This is a one-time migration script.")
    print("   After running this, all new variables will automatically have")
    print("   driver relationships created when they are added/updated.\n")
    
    response = input("Continue with migration? (yes/no): ")
    if response.lower() not in ['yes', 'y']:
        print("Migration cancelled.")
        sys.exit(0)
    
    success = asyncio.run(migrate_all_variables())
    sys.exit(0 if success else 1)

