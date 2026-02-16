"""
PostgreSQL database connection for Metadata and Heuristics.
This is separate from Neo4j and ensures data persists permanently.
"""

import os
from sqlalchemy import create_engine, Column, String, Text, Boolean, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables
if os.getenv("RENDER") is None:  # Not in Render (local development)
    load_dotenv(".env.dev")
else:  # In Render (production)
    pass

Base = declarative_base()

# Metadata table model
class MetadataModel(Base):
    __tablename__ = "metadata"
    
    id = Column(String, primary_key=True)
    layer = Column(String, nullable=False)
    concept = Column(String, nullable=False)
    sector = Column(String, default="")
    domain = Column(String, default="")
    country = Column(String, default="")
    number = Column(Text, default="")
    examples = Column(Text, default="")
    detailData = Column(Text, nullable=True)

# Heuristics table model
class HeuristicModel(Base):
    __tablename__ = "heuristics"
    
    id = Column(String, primary_key=True)
    sector = Column(String, nullable=False)
    domain = Column(String, nullable=False)
    country = Column(String, nullable=False)
    agent = Column(String, nullable=False)
    procedure = Column(String, nullable=False)
    rules = Column(Text, default="")
    best = Column(Text, default="")
    detailData = Column(Text, nullable=True)
    # TRUE = RCPO agent (Datamaia runtime); FALSE = non-RCPO (documentation-only)
    is_hero = Column(Boolean, nullable=False, default=True)
    # Free-text documentation when is_hero = FALSE; NULL when is_hero = TRUE
    documentation = Column(Text, nullable=True)

# Database connection
def get_postgres_url():
    """Get PostgreSQL connection URL from environment variables"""
    # IMPORTANT: Only use PostgreSQL in production (Render)
    # For local development, we use JSON files to keep dev/prod data separate
    
    # Check if we're in production (Render)
    render_env = os.getenv("RENDER")
    is_production = render_env and render_env.strip()
    
    # Only use PostgreSQL in production
    if is_production:
        # Check for Render PostgreSQL connection string
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            # Render provides DATABASE_URL in format: postgresql://user:pass@host:port/dbname
            # SQLAlchemy needs postgresql:// (not postgres://)
            if database_url.startswith("postgres://"):
                database_url = database_url.replace("postgres://", "postgresql://", 1)
            return database_url
    
    # For local development, return None to force JSON fallback
    # This ensures dev and prod data are completely separate
    print("ℹ️  Local development detected - using JSON files instead of PostgreSQL")
    return None

# Create engine and session
engine = None
SessionLocal = None

def init_db():
    """Initialize PostgreSQL database connection and create tables"""
    global engine, SessionLocal
    
    try:
        database_url = get_postgres_url()
        
        # If no database URL (local dev), skip PostgreSQL initialization
        if database_url is None:
            print("ℹ️  Skipping PostgreSQL initialization - using JSON files for local development")
            return False
        
        print(f"Connecting to PostgreSQL database...")
        engine = create_engine(database_url, pool_pre_ping=True)
        
        # Create tables if they don't exist
        Base.metadata.create_all(bind=engine)
        
        # Migrate existing heuristics table: add is_hero and documentation if missing
        with engine.connect() as conn:
            for stmt in [
                "ALTER TABLE heuristics ADD COLUMN IF NOT EXISTS is_hero BOOLEAN NOT NULL DEFAULT TRUE",
                "ALTER TABLE heuristics ADD COLUMN IF NOT EXISTS documentation TEXT",
            ]:
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                except Exception as e:
                    # Column may already exist or table may not exist yet
                    print(f"Migration note: {e}")
        
        # Create session factory
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        print("✅ PostgreSQL database connected and tables created")
        return True
    except Exception as e:
        print(f"⚠️  Failed to connect to PostgreSQL: {e}")
        print("⚠️  Metadata and Heuristics will fall back to JSON files")
        return False

def get_db_session():
    """Get a database session"""
    if SessionLocal is None:
        if not init_db():
            return None
    return SessionLocal()

# Initialize on import
init_db()

