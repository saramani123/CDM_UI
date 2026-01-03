"""
Script to clear all metadata and heuristics data.
This will delete all entries from both PostgreSQL database and JSON files.
"""

import json
import os
from pathlib import Path

# Try to import PostgreSQL
try:
    from db_postgres import get_db_session, MetadataModel, HeuristicModel
    POSTGRES_AVAILABLE = True
except Exception as e:
    POSTGRES_AVAILABLE = False
    print(f"⚠️  PostgreSQL not available, will only clear JSON files: {e}")

def clear_metadata():
    """Clear all metadata data"""
    # Try PostgreSQL first
    if POSTGRES_AVAILABLE:
        db = get_db_session()
        if db:
            try:
                count = db.query(MetadataModel).delete()
                db.commit()
                print(f"✅ Cleared {count} metadata entries from PostgreSQL")
            except Exception as e:
                print(f"⚠️  Error clearing PostgreSQL metadata: {e}")
                db.rollback()
            finally:
                db.close()
    
    # Also clear JSON files
    backend_dir = Path(__file__).parent
    
    # Clear development file
    dev_file = backend_dir / "metadata.development.json"
    if dev_file.exists():
        with open(dev_file, 'w', encoding='utf-8') as f:
            json.dump([], f, indent=2)
        print(f"✅ Cleared metadata.development.json")
    else:
        print(f"⚠️  metadata.development.json does not exist")
    
    # Clear production file
    prod_file = backend_dir / "metadata.production.json"
    if prod_file.exists():
        with open(prod_file, 'w', encoding='utf-8') as f:
            json.dump([], f, indent=2)
        print(f"✅ Cleared metadata.production.json")
    else:
        print(f"⚠️  metadata.production.json does not exist")

def clear_heuristics():
    """Clear all heuristics data"""
    # Try PostgreSQL first
    if POSTGRES_AVAILABLE:
        db = get_db_session()
        if db:
            try:
                count = db.query(HeuristicModel).delete()
                db.commit()
                print(f"✅ Cleared {count} heuristics entries from PostgreSQL")
            except Exception as e:
                print(f"⚠️  Error clearing PostgreSQL heuristics: {e}")
                db.rollback()
            finally:
                db.close()
    
    # Also clear JSON files
    backend_dir = Path(__file__).parent
    
    # Clear development file
    dev_file = backend_dir / "heuristics.development.json"
    if dev_file.exists():
        with open(dev_file, 'w', encoding='utf-8') as f:
            json.dump([], f, indent=2)
        print(f"✅ Cleared heuristics.development.json")
    else:
        print(f"⚠️  heuristics.development.json does not exist")
    
    # Clear production file
    prod_file = backend_dir / "heuristics.production.json"
    if prod_file.exists():
        with open(prod_file, 'w', encoding='utf-8') as f:
            json.dump([], f, indent=2)
        print(f"✅ Cleared heuristics.production.json")
    else:
        print(f"⚠️  heuristics.production.json does not exist")

if __name__ == "__main__":
    print("=" * 60)
    print("Clearing Metadata and Heuristics Data")
    print("=" * 60)
    
    response = input("\n⚠️  WARNING: This will delete ALL metadata and heuristics data!\nAre you sure you want to continue? (yes/no): ")
    
    if response.lower() != "yes":
        print("❌ Operation cancelled.")
        exit(0)
    
    print("\nClearing metadata...")
    clear_metadata()
    
    print("\nClearing heuristics...")
    clear_heuristics()
    
    print("\n" + "=" * 60)
    print("✅ All metadata and heuristics data has been cleared!")
    print("=" * 60)

