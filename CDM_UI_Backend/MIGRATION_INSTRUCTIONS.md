# Variable Driver Relationships Migration

## Overview

This migration ensures that **ALL existing variables** in the database have `IS_RELEVANT_TO` relationships with their Sector, Domain, Country, and VariableClarifier driver nodes.

## Why This Migration?

Previously, when variables were created, their driver relationships (Sector, Domain, Country, VariableClarifier) were not always persisted to Neo4j as `IS_RELEVANT_TO` relationships. This migration:

1. Finds all existing variables
2. Checks if they have a `driver` property stored
3. If no `driver` property exists, tries to reconstruct it from existing relationships
4. If no relationships exist, uses default "ALL, ALL, ALL, None"
5. Stores the `driver` property on the Variable node
6. Creates `IS_RELEVANT_TO` relationships for Sector, Domain, Country, and VariableClarifier

## Important Notes

- **This is a one-time migration** - it should be run once on each environment (dev and prod)
- **After this migration**, all new variables added/updated will automatically have driver relationships created
- **This migration is safe** - it will not delete existing data, only add missing relationships
- **The migration uses transactions** - if it fails partway through, you can re-run it safely

## Prerequisites

1. Ensure you have access to the Neo4j database (dev or prod)
2. Ensure your `.env.dev` file (for dev) or environment variables (for prod) are correctly configured
3. Ensure the Python environment has all required dependencies installed

## Running the Migration

### On Development Server

1. Navigate to the backend directory:
   ```bash
   cd CDM_UI_Backend
   ```

2. Activate your virtual environment (if using one):
   ```bash
   source venv_neo4j/bin/activate  # On Linux/Mac
   # or
   venv_neo4j\Scripts\activate  # On Windows
   ```

3. Run the migration script:
   ```bash
   python migrate_variable_driver_relationships.py
   ```

4. When prompted, type `yes` to continue

5. The script will:
   - Show progress for each variable processed
   - Display a summary at the end
   - Show any errors encountered

### On Production Server (Render)

1. **Option A: Run via Render Shell**
   - Go to your Render dashboard
   - Open a shell session for your backend service
   - Navigate to the project directory
   - Run the migration script:
     ```bash
     python migrate_variable_driver_relationships.py
     ```

2. **Option B: Run via API Endpoint** (if you've deployed the endpoint)
   - Call the POST endpoint:
     ```bash
     curl -X POST https://your-backend-url/api/v1/variables/backfill-driver-relationships
     ```

3. **Option C: SSH into Render instance** (if configured)
   - SSH into your Render instance
   - Run the migration script as above

## Expected Output

The migration will show:
- Progress for each variable: `[1/1173] Processing: Variable Name (variable-id)`
- Whether a driver string was found or reconstructed
- Whether relationships were successfully created
- A summary at the end with:
  - Total variables processed
  - Relationships created
  - Skipped variables
  - Errors encountered

Example output:
```
============================================================
[1/1173] Processing: Purchase Price (abc-123-def)
  ✓ Driver string found: Finance, Insurance, USA, None
  ✅ Created driver relationships

[2/1173] Processing: Another Variable (xyz-456-ghi)
  ⚠️  No driver string found, checking for existing relationships...
  📝 Reconstructed and stored driver string: ALL, ALL, ALL, None
  ✅ Created driver relationships

...

============================================================
MIGRATION SUMMARY
============================================================
Total variables processed: 1173
✅ Relationships created: 1173
⚠️  Skipped: 0
❌ Errors: 0

============================================================
✅ Migration complete!
============================================================
```

## Verifying the Migration

After running the migration, you can verify it worked by:

1. **Using Neo4j Browser**:
   ```cypher
   MATCH (v:Variable)<-[r:IS_RELEVANT_TO]-(d)
   RETURN count(r) as totalRelationships, count(DISTINCT v) as variablesWithRelationships
   ```

2. **Checking a specific variable**:
   ```cypher
   MATCH (v:Variable {name: "Purchase Price"})<-[r:IS_RELEVANT_TO]-(d)
   RETURN type(d) as driverType, d.name as driverName, type(r) as relationshipType
   ```

3. **Using the API endpoint**:
   ```bash
   curl http://localhost:8000/api/v1/variables | jq '.[] | {id, name, driver}' | head -20
   ```

## Troubleshooting

### Connection Errors
- Verify your `.env.dev` file has correct Neo4j credentials
- Check that Neo4j Aura instance is running
- Verify network connectivity

### Relationship Creation Errors
- Check Neo4j logs for more details
- Verify that Sector, Domain, Country, and VariableClarifier nodes exist in the database
- Check if there are any constraint violations

### Script Hangs
- The migration processes variables one at a time, so large databases may take time
- Check Neo4j connection pool settings if the script hangs

## Post-Migration

After successful migration:
- ✅ All existing variables will have `IS_RELEVANT_TO` relationships
- ✅ All variables will have a `driver` property stored
- ✅ New variables added via the UI will automatically have relationships created
- ✅ Variables updated via the UI will maintain their relationships

## Rollback

If needed, you can remove all `IS_RELEVANT_TO` relationships with:
```cypher
MATCH ()-[r:IS_RELEVANT_TO]->(:Variable)
DELETE r
```

However, this is **NOT recommended** as it will remove all driver relationships.

## Support

If you encounter issues:
1. Check the error messages in the migration output
2. Review Neo4j logs
3. Verify database connectivity
4. Check that all required driver nodes (Sector, Domain, Country, VariableClarifier) exist

