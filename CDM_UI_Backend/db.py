import os
import ssl
from neo4j import GraphDatabase
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Neo4jConnection:
    def __init__(self):
        self.uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self.username = os.getenv("NEO4J_USERNAME", "neo4j")
        self.password = os.getenv("NEO4J_PASSWORD", "password")
        self.driver = None
        
    def connect(self):
        """Initialize connection to Neo4j database"""
        try:
            print(f"Attempting to connect to Neo4j at {self.uri}")
            print(f"Username: {self.username}")
            
            # For Neo4j Aura, the neo4j+s:// scheme handles SSL automatically
            # We just need to use the correct connection parameters
            self.driver = GraphDatabase.driver(
                self.uri, 
                auth=(self.username, self.password),
                max_connection_lifetime=30 * 60,  # 30 minutes
                max_connection_pool_size=50,
                connection_acquisition_timeout=60,  # 1 minute
                connection_timeout=30,  # 30 seconds
                keep_alive=True
            )
            
            # Test the connection with a simple query
            with self.driver.session() as session:
                result = session.run("RETURN 1 as test")
                record = result.single()
                print(f"Successfully connected to Neo4j! Test result: {record['test']}")
                
                # Get database info
                try:
                    db_info = session.run("CALL db.info()")
                    info = db_info.single()
                    print(f"Database: {info['name']}")
                except:
                    print("Could not retrieve database info (this is normal for some Neo4j versions)")
            
            return True
        except Exception as e:
            print(f"Failed to connect to Neo4j: {e}")
            print("Please check:")
            print("1. Network connectivity")
            print("2. Neo4j Aura instance is running")
            print("3. Credentials are correct")
            print("4. URI format is correct (neo4j+s:// for Aura)")
            print("\nFor now, the API will use dummy data until Neo4j connection is resolved.")
            return False
    
    def get_driver(self):
        """Get the Neo4j driver instance"""
        if not self.driver:
            self.connect()
        return self.driver
    
    def close(self):
        """Close the database connection"""
        if self.driver:
            self.driver.close()
            print("Neo4j connection closed")

# Global connection instance
neo4j_conn = Neo4jConnection()

def get_driver():
    """Helper function to get Neo4j driver for queries"""
    return neo4j_conn.get_driver()

def get_session():
    """Helper function to get a Neo4j session"""
    driver = get_driver()
    if driver:
        return driver.session()
    return None
