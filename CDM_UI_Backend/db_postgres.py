"""
PostgreSQL database connection for Metadata and Heuristics.
This is separate from Neo4j and ensures data persists permanently.
"""

import os
from sqlalchemy import create_engine, Column, String, Text, Boolean, text, ForeignKey
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


# Sources tab: logical data model catalog + per-source grid rows (separate from Neo4j)
class SourceCatalogModel(Base):
    __tablename__ = "source_catalog"

    id = Column(String, primary_key=True)
    source_key = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    sector = Column(String, default="")
    domain = Column(String, default="")
    country = Column(String, default="")
    is_preset = Column(Boolean, nullable=False, default=False)


class SourceLdmRowModel(Base):
    __tablename__ = "source_ldm_rows"

    id = Column(String, primary_key=True)
    source_id = Column(String, ForeignKey("source_catalog.id", ondelete="CASCADE"), nullable=False, index=True)
    source_name = Column(String, default="")
    source_table = Column(String, default="")
    source_variable = Column(String, default="")
    cdm_variable = Column("cdm_variable", String, default="")
    being = Column(String, default="")
    avatar = Column(String, default="")
    cdm_object = Column("cdm_object", String, default="")
    part = Column(String, default="")
    section = Column(String, default="")
    cdm_group = Column("cdm_group", String, default="")
    format_vi = Column(String, default="")
    format_vii = Column(String, default="")
    validations = Column(Text, default="")


# Database connection
def get_postgres_url():
    """Get PostgreSQL connection URL from environment variables.

    PostgreSQL is used when ``DATABASE_URL`` is set and any of:
    - ``RENDER`` is set (native Render Web Services), or
    - ``FORCE_POSTGRES`` is ``1`` / ``true`` / ``yes`` (explicit opt-in, e.g. custom Docker).

    Otherwise returns ``None`` so Sources / Metadata / Heuristics use JSON files locally.
    """
    database_url = os.getenv("DATABASE_URL")
    if not database_url or not str(database_url).strip():
        print("ℹ️  No DATABASE_URL — using JSON files for Sources / Metadata / Heuristics")
        return None

    render_on = bool(os.getenv("RENDER", "").strip())
    force_pg = os.getenv("FORCE_POSTGRES", "").strip().lower() in ("1", "true", "yes")

    if not (render_on or force_pg):
        print("ℹ️  DATABASE_URL present but RENDER / FORCE_POSTGRES not set — using JSON files (local dev)")
        return None

    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    return database_url

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
        
        # Lightweight migrations: create_all() does not add new columns to existing tables.
        with engine.connect() as conn:
            for stmt in [
                # Heuristics: hero vs documentation-only agents
                "ALTER TABLE heuristics ADD COLUMN IF NOT EXISTS is_hero BOOLEAN NOT NULL DEFAULT TRUE",
                "ALTER TABLE heuristics ADD COLUMN IF NOT EXISTS documentation TEXT",
                # Metadata: S/D/C columns were added after some prod DBs were created
                "ALTER TABLE metadata ADD COLUMN IF NOT EXISTS sector VARCHAR DEFAULT ''",
                "ALTER TABLE metadata ADD COLUMN IF NOT EXISTS domain VARCHAR DEFAULT ''",
                "ALTER TABLE metadata ADD COLUMN IF NOT EXISTS country VARCHAR DEFAULT ''",
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

