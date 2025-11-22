# Migration Guide: Default Relationships for All Objects

## Overview

This migration adds default relationships for all existing objects in the database. After deploying the new relationship functionality, run this migration script to update all existing objects.

## What This Migration Does

1. **Creates relationships from each object to ALL other objects** (including itself)
2. **Sets default relationship properties**:
   - **For relationships to other objects**: Type = `Inter-Table`, Frequency = `Possible`, Role = source object name
   - **For self-relationships**: Type = `Intra-Table`, Frequency = `Possible`, Role = object name
3. **Skips existing relationships** with the same role to avoid duplicates
4. **Updates relationship counts** for each object

## How to Run the Migration

### Option 1: Run Locally (for testing)

1. Make sure you have the correct environment variables set in `.env.dev`:
   ```
   NEO4J_URI=your_neo4j_uri
   NEO4J_USERNAME=your_username
   NEO4J_PASSWORD=your_password
   ```

2. Run the migration script:
   ```bash
   cd CDM_UI_Backend
   python migrate_default_relationships.py
   ```

3. Review the output to confirm all objects were processed successfully.

### Option 2: Run on Production (via Render)

1. **SSH into your Render instance** (if SSH is enabled), or
2. **Use Render's Shell** feature in the dashboard, or
3. **Add a one-time job** in Render to run the script

**Recommended approach for Render:**

1. Go to your Render dashboard
2. Navigate to your backend service
3. Use the "Shell" feature (if available) or create a one-time job
4. Run:
   ```bash
   cd /opt/render/project/src/CDM_UI_Backend
   python migrate_default_relationships.py
   ```

**Alternative: Add as a one-time script in Render**

You can also add this as a one-time script that runs after deployment:

1. In your `render.yaml`, add a one-time job:
   ```yaml
   services:
     - type: web
       name: cdm-backend
       # ... your existing config
   
   jobs:
     - type: script
       name: migrate-default-relationships
       plan: free
       buildCommand: echo "Migration will run manually"
       startCommand: python CDM_UI_Backend/migrate_default_relationships.py
   ```

2. Run the job manually from the Render dashboard after deployment.

## What to Expect

The script will:
- Print progress for each object being processed
- Show how many relationships were created vs skipped (already exist)
- Display total relationship counts for each object
- Complete with a summary

**Example output:**
```
[1/150] Processing object: Company (ID: abc123...)
  Created 150 relationships, skipped 0 (already exist)
  Total relationships for Company: 150

[2/150] Processing object: Person (ID: def456...)
  Created 149 relationships, skipped 1 (already exist)
  Total relationships for Person: 150

...

✅ Migration completed successfully!
   Processed 150 objects
```

## Important Notes

1. **This migration is idempotent**: Running it multiple times is safe. It will skip relationships that already exist.

2. **Performance**: For 100+ objects, this will create 10,000+ relationships. The script processes them sequentially to avoid overwhelming the database.

3. **Backup**: Consider backing up your Neo4j database before running this migration in production.

4. **Timing**: Run this migration **after** deploying the new code to production, so the UI matches the new data structure.

## Troubleshooting

- **Connection errors**: Verify your Neo4j credentials are correct
- **Timeout errors**: The script processes relationships sequentially. For very large datasets, you may need to increase timeout values
- **Duplicate errors**: These are expected and will be skipped automatically

## After Migration

After running the migration:
1. Verify relationships in Neo4j Browser
2. Test the relationships modal in the UI - all objects should be selected by default
3. Verify that default role words are working correctly

