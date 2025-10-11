#!/usr/bin/env python3
"""
Script to fix Object-Driver relationships in Neo4j.
This script ensures all objects have proper RELEVANT_TO relationships 
to their corresponding Sectors, Domains, Countries, and Object Clarifiers.
"""

import os
import sys
from neo4j import GraphDatabase
from dotenv import load_dotenv

# Load environment variables
if os.getenv("VERCEL") is None:
    load_dotenv(".env.dev")
else:
    pass

class Neo4jRelationshipFixer:
    def __init__(self):
        self.uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self.username = os.getenv("NEO4J_USERNAME", "neo4j")
        self.password = os.getenv("NEO4J_PASSWORD", "password")
        self.driver = None

    def connect(self):
        """Connect to Neo4j database"""
        try:
            # Use neo4j+ssc scheme for self-signed certificates
            working_uri = self.uri.replace("neo4j+s://", "neo4j+ssc://")
            print(f"Connecting to Neo4j at {working_uri}")
            
            self.driver = GraphDatabase.driver(
                working_uri,
                auth=(self.username, self.password),
                max_connection_lifetime=30 * 60,
                max_connection_pool_size=50,
                connection_acquisition_timeout=60,
                connection_timeout=30,
                keep_alive=True
            )
            
            # Test connection
            with self.driver.session() as session:
                result = session.run("RETURN 1 as test")
                record = result.single()
                print(f"✅ Connected to Neo4j! Test result: {record['test']}")
                return True
                
        except Exception as e:
            print(f"❌ Failed to connect to Neo4j: {e}")
            return False

    def get_all_objects(self):
        """Get all objects with their driver information"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (o:Object)
                RETURN o.id as id, o.driver as driver, o.being as being, 
                       o.avatar as avatar, o.object as object
            """)
            return [record for record in result]

    def parse_driver_string(self, driver_string):
        """Parse driver string to extract sector, domain, country, clarifier"""
        if not driver_string:
            return None
            
        parts = driver_string.split(', ')
        if len(parts) < 4:
            return None
            
        return {
            'sector': parts[0] if parts[0] != '-' else None,
            'domain': parts[1] if parts[1] != '-' else None,
            'country': parts[2] if parts[2] != '-' else None,
            'clarifier': parts[3] if parts[3] != '-' and parts[3] != 'None' else None
        }

    def create_driver_node_if_not_exists(self, session, driver_type, name):
        """Create driver node if it doesn't exist"""
        # Check if node exists
        result = session.run(f"MATCH (d:{driver_type} {{name: $name}}) RETURN d", name=name)
        if result.single():
            return True
            
        # Create node if it doesn't exist
        try:
            session.run(f"CREATE (d:{driver_type} {{name: $name}})", name=name)
            print(f"✅ Created {driver_type}: {name}")
            return True
        except Exception as e:
            print(f"❌ Failed to create {driver_type} '{name}': {e}")
            return False

    def create_relevant_to_relationship(self, session, driver_type, driver_name, object_id):
        """Create RELEVANT_TO relationship between driver and object"""
        try:
            # Check if relationship already exists
            result = session.run("""
                MATCH (d)-[r:RELEVANT_TO]->(o:Object {id: $object_id})
                WHERE d.name = $driver_name AND labels(d) = [$driver_type]
                RETURN r
            """, driver_type=driver_type, driver_name=driver_name, object_id=object_id)
            
            if result.single():
                return True  # Relationship already exists
                
            # Create the relationship
            session.run("""
                MATCH (d), (o:Object {id: $object_id})
                WHERE d.name = $driver_name AND labels(d) = [$driver_type]
                CREATE (d)-[:RELEVANT_TO]->(o)
            """, driver_type=driver_type, driver_name=driver_name, object_id=object_id)
            
            print(f"✅ Created RELEVANT_TO: {driver_type} '{driver_name}' -> Object {object_id}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to create RELEVANT_TO relationship: {e}")
            return False

    def fix_object_relationships(self):
        """Fix all object-driver relationships"""
        print("🔍 Getting all objects...")
        objects = self.get_all_objects()
        print(f"Found {len(objects)} objects")
        
        with self.driver.session() as session:
            for obj in objects:
                print(f"\n📝 Processing Object: {obj['object']} (ID: {obj['id']})")
                print(f"   Driver string: {obj['driver']}")
                
                # Parse driver string
                driver_parts = self.parse_driver_string(obj['driver'])
                if not driver_parts:
                    print(f"   ⚠️  Skipping - invalid driver string")
                    continue
                
                # Process each driver type
                driver_types = [
                    ('Sector', driver_parts['sector']),
                    ('Domain', driver_parts['domain']),
                    ('Country', driver_parts['country']),
                    ('ObjectClarifier', driver_parts['clarifier'])
                ]
                
                for driver_type, driver_name in driver_types:
                    if driver_name:
                        print(f"   🔗 Processing {driver_type}: {driver_name}")
                        
                        # Create driver node if it doesn't exist
                        if self.create_driver_node_if_not_exists(session, driver_type, driver_name):
                            # Create RELEVANT_TO relationship
                            self.create_relevant_to_relationship(session, driver_type, driver_name, obj['id'])
                        else:
                            print(f"   ❌ Failed to create {driver_type} node")
                    else:
                        print(f"   ⏭️  Skipping {driver_type} (empty)")

    def verify_relationships(self):
        """Verify that relationships were created correctly"""
        print("\n🔍 Verifying relationships...")
        
        with self.driver.session() as session:
            # Check total relationships
            result = session.run("""
                MATCH ()-[r:RELEVANT_TO]->()
                RETURN count(r) as total_relationships
            """)
            total = result.single()['total_relationships']
            print(f"Total RELEVANT_TO relationships: {total}")
            
            # Check relationships by type
            driver_types = ['Sector', 'Domain', 'Country', 'ObjectClarifier']
            for driver_type in driver_types:
                result = session.run(f"""
                    MATCH (d:{driver_type})-[r:RELEVANT_TO]->(o:Object)
                    RETURN count(r) as count
                """)
                count = result.single()['count']
                print(f"{driver_type} -> Object relationships: {count}")
            
            # Show some examples
            print("\n📋 Sample relationships:")
            result = session.run("""
                MATCH (d)-[r:RELEVANT_TO]->(o:Object)
                RETURN labels(d)[0] as driver_type, d.name as driver_name, o.object as object_name
                LIMIT 10
            """)
            for record in result:
                print(f"   {record['driver_type']} '{record['driver_name']}' -> Object '{record['object_name']}'")

    def close(self):
        """Close database connection"""
        if self.driver:
            self.driver.close()

def main():
    print("🚀 Starting Object-Driver Relationship Fixer")
    print("=" * 50)
    
    fixer = Neo4jRelationshipFixer()
    
    if not fixer.connect():
        print("❌ Failed to connect to Neo4j. Exiting.")
        sys.exit(1)
    
    try:
        # Fix relationships
        fixer.fix_object_relationships()
        
        # Verify results
        fixer.verify_relationships()
        
        print("\n✅ Relationship fixing completed!")
        
    except Exception as e:
        print(f"❌ Error during relationship fixing: {e}")
        sys.exit(1)
    finally:
        fixer.close()

if __name__ == "__main__":
    main()
