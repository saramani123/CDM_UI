# Metadata & Heuristics Data Persistence Solution

## Problem
Render's filesystem is **ephemeral** - any files written to disk get wiped on redeploy. This means:
- JSON files written in production are lost on every deployment
- Data added through the UI disappears after redeploy
- Production JSON files can't be committed to git (they're in .gitignore)

## Solution: PostgreSQL Database
We've implemented a **hybrid solution** that:
1. **Uses PostgreSQL** when available (permanent storage)
2. **Falls back to JSON files** if PostgreSQL is not configured (for local dev)

This ensures data **permanently persists** in production while maintaining compatibility with local development.

## Setup Instructions

### Step 1: Add PostgreSQL Database on Render

1. Go to your Render dashboard
2. Click "New +" → "PostgreSQL"
3. Configure:
   - **Name**: `cdm-metadata-db` (or any name)
   - **Database**: `cdm_metadata`
   - **User**: (auto-generated)
   - **Plan**: Free tier is fine
4. Click "Create Database"
5. Copy the **Internal Database URL** (starts with `postgresql://`)

### Step 2: Update render.yaml

Add the PostgreSQL connection to your web service:

```yaml
services:
  - type: web
    name: cdm-backend
    env: python
    plan: starter
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port 10000 --timeout-keep-alive 600 --timeout-graceful-shutdown 600
    healthCheckPath: /health
    envVars:
      - key: ENVIRONMENT
        value: production
      - key: NEO4J_URI
        value: neo4j+s://abb4a9a8.databases.neo4j.io
      - key: NEO4J_USERNAME
        value: neo4j
      - key: NEO4J_PASSWORD
        value: y79sZZXCcA-Jb26aeqjeYl2z4HAt9CWE5cYWQg8wxP8
      - key: DATABASE_URL
        fromDatabase:
          name: cdm-metadata-db  # Name of your PostgreSQL service
          property: connectionString
```

### Step 3: Deploy

1. Commit and push the changes
2. Render will automatically:
   - Install PostgreSQL dependencies (sqlalchemy, psycopg2-binary)
   - Connect to PostgreSQL
   - Create the metadata and heuristics tables
   - Start using PostgreSQL for storage

### Step 4: Verify

After deployment, check the logs:
- You should see: `✅ PostgreSQL database connected and tables created`
- Metadata and Heuristics data will now persist permanently!

## Clearing Data

To clear all metadata and heuristics data, run:

```bash
python clear_metadata_heuristics.py
```

This script will:
- Clear all metadata entries
- Clear all heuristics entries
- Work for both PostgreSQL and JSON file storage

## How It Works

### Production (Render)
- Uses PostgreSQL database
- Data persists permanently across deployments
- No data loss on redeploy

### Development (Local)
- Uses JSON files (`metadata.development.json`, `heuristics.development.json`)
- No database setup required
- Easy to test and develop

### Fallback Behavior
- If PostgreSQL is not available, automatically falls back to JSON files
- Ensures the app always works, even if database setup is incomplete

## Important Notes

1. **PostgreSQL is separate from Neo4j** - Metadata and Heuristics are NOT part of the graph database
2. **Data migration**: Existing JSON data will be used until you add new items (which will go to PostgreSQL)
3. **Backup**: PostgreSQL on Render includes automatic backups
4. **Free tier**: Render's free PostgreSQL tier is sufficient for metadata and heuristics

## Troubleshooting

### "PostgreSQL not available" warning
- Check that `DATABASE_URL` is set in Render environment variables
- Verify PostgreSQL service is running
- Check database connection string format

### Data not persisting
- Verify PostgreSQL connection in logs
- Check that tables were created (look for "tables created" message)
- Ensure `DATABASE_URL` is correctly configured

### Local development
- JSON files will be used automatically
- No PostgreSQL setup needed for local dev
- Data stored in `metadata.development.json` and `heuristics.development.json`

