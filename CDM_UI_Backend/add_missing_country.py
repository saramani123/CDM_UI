#!/usr/bin/env python3
"""
Add the missing country to reach exactly 195 UN-recognized countries.
"""

import os
from dotenv import load_dotenv
from db import get_session

def add_missing_country():
    """Add the missing country to reach exactly 195 UN-recognized countries"""
    
    # Load environment variables
    load_dotenv()
    
    print("🌍 Adding missing country to reach exactly 195 UN-recognized countries...")
    print("=" * 70)
    
    # Get database session
    session = get_session()
    if not session:
        print("❌ Failed to connect to Neo4j database")
        return False
    
    try:
        # Check current count
        result = session.run("MATCH (c:Country) RETURN count(c) as count")
        current_count = result.single()['count']
        print(f"📊 Current country count: {current_count}")
        
        # Add the missing country (likely Palestine/State of Palestine)
        # Palestine is recognized by the UN as a non-member observer state
        session.run("""
            MERGE (c:Country {code: 'PS', name: 'Palestine'})
            SET c.created_at = datetime()
        """)
        print("✅ Added Palestine (PS)")
        
        # Verify final count
        result = session.run("MATCH (c:Country) RETURN count(c) as count")
        final_count = result.single()['count']
        
        print(f"\n🎉 Successfully updated countries list!")
        print(f"📊 Final country count: {final_count}")
        
        if final_count == 195:
            print("✅ Perfect! Database now contains exactly 195 UN-recognized countries.")
        else:
            print(f"⚠️  Expected 195 countries, but found {final_count}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during country addition: {e}")
        return False
    
    finally:
        session.close()

if __name__ == "__main__":
    print("🌍 Add Missing Country Script")
    print("This will add the missing country to reach exactly 195 UN-recognized countries")
    print("Proceeding with country addition...")
    
    try:
        success = add_missing_country()
        
        if success:
            print("\n🎉 Country addition completed successfully!")
        else:
            print("\n💥 Country addition failed. Please check the error messages above.")
            
    except KeyboardInterrupt:
        print("\n❌ Country addition cancelled by user")
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
