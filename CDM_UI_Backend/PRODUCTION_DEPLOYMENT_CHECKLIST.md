# Production Deployment Checklist - Driver Relationships Migration

## Overview

This checklist ensures that after deploying the new driver relationships functionality to production, all existing variables will have `IS_RELEVANT_TO` relationships created.

## Pre-Deployment (Current State)

- ✅ Code changes are complete:
  - Variables now store `driver` property on creation/update
  - `create_driver_relationships` function creates `IS_RELEVANT_TO` relationships
  - Backfill endpoint available: `POST /api/v1/variables/backfill-driver-relationships`
  - Migration script ready: `migrate_variable_driver_relationships.py`

## Deployment Steps

### 1. Push to Main Branch (You'll do this manually)
```bash
# Make sure all changes are committed
git add .
git commit -m "Add driver relationships functionality and migration tools"
git push origin main
```

### 2. Deploy Backend to Render

1. Go to Render dashboard → Your `cdm-backend` service
2. Click "Manual Deploy" → "Deploy latest commit"
3. Wait for deployment to complete
4. Verify health check passes: Check `/health` endpoint

### 3. Run Migration on Production

You have **two options** to run the migration:

#### Option A: Via API Endpoint (Recommended - Easiest)

After backend is deployed, call the backfill endpoint:

```bash
curl -X POST https://your-backend-render-url.onrender.com/api/v1/variables/backfill-driver-relationships
```

Or use the API docs at: `https://your-backend-render-url.onrender.com/docs`

The endpoint will:
- Process all variables
- Create relationships
- Return a summary JSON response

**Expected Response:**
```json
{
  "success": true,
  "message": "Processed 1173 variables",
  "total_variables": 1173,
  "relationships_created": 1173,
  "skipped": 0,
  "errors": 0,
  "error_details": []
}
```

#### Option B: Via Render Shell (Alternative)

1. Go to Render dashboard → Your `cdm-backend` service
2. Click "Shell" tab
3. Run:
   ```bash
   cd /opt/render/project/src  # Or wherever your code is
   python migrate_variable_driver_relationships.py
   ```
4. Type `yes` when prompted
5. Wait for completion

### 4. Verify Migration Success

#### Check via Neo4j Browser (Recommended)

Connect to your production Neo4j Aura instance and run:

```cypher
// Count total relationships created
MATCH (v:Variable)<-[r:IS_RELEVANT_TO]-(d)
RETURN 
  count(r) as totalRelationships, 
  count(DISTINCT v) as variablesWithRelationships,
  count(DISTINCT d) as driverNodes

// Check a specific variable
MATCH (v:Variable {name: "Purchase Price"})<-[r:IS_RELEVANT_TO]-(d)
RETURN type(d) as driverType, d.name as driverName, type(r) as relationshipType
```

#### Check via API

```bash
# Get a variable and check its driver relationships are included
curl https://your-backend-render-url.onrender.com/api/v1/variables | jq '.[0] | {id, name, driver, sector, domain, country}'
```

### 5. Deploy Frontend to Render (If Needed)

If there are frontend changes:
1. Go to Render dashboard → Your `cdm-frontend` service
2. Click "Manual Deploy" → "Deploy latest commit"
3. Wait for deployment to complete

## Post-Deployment Verification

### ✅ Checklist

- [ ] Backend deployed successfully
- [ ] Migration completed (via API or shell)
- [ ] No errors in migration output
- [ ] Variables have `driver` property stored
- [ ] `IS_RELEVANT_TO` relationships exist in Neo4j
- [ ] New variables created via UI get relationships automatically
- [ ] Existing variables updated via UI maintain relationships

### Quick Verification Queries

**In Neo4j Browser:**
```cypher
// 1. Count relationships
MATCH ()-[r:IS_RELEVANT_TO]->(:Variable)
RETURN count(r) as totalRelationships

// 2. Check variables without relationships (should be 0 after migration)
MATCH (v:Variable)
WHERE NOT EXISTS {
  MATCH (v)<-[:IS_RELEVANT_TO]-()
}
RETURN count(v) as variablesWithoutRelationships

// 3. Sample relationships
MATCH (d)-[r:IS_RELEVANT_TO]->(v:Variable)
RETURN type(d) as driverType, d.name as driverName, v.name as variableName
LIMIT 10
```

**Via API:**
```bash
# Check health
curl https://your-backend-render-url.onrender.com/health

# Check variables endpoint
curl https://your-backend-render-url.onrender.com/api/v1/variables | jq 'length'
```

## Important Notes

1. **One-Time Migration**: The migration only needs to be run once per environment
2. **Idempotent**: Safe to re-run if needed - it cleans existing relationships before creating new ones
3. **Production Database**: The migration connects to your production Neo4j Aura instance (configured in Render environment variables)
4. **No Data Loss**: This migration only **adds** relationships - it doesn't delete any existing variable data

## Troubleshooting

### If Migration Fails

1. **Check Render Logs**: View logs in Render dashboard for error messages
2. **Verify Neo4j Connection**: Check that environment variables are correct in Render
3. **Check Neo4j Browser**: Verify database is accessible
4. **Re-run Migration**: The migration is safe to re-run

### Common Issues

**Issue**: "Failed to connect to Neo4j database"
- **Solution**: Verify `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` in Render environment variables

**Issue**: "No driver nodes found"
- **Solution**: Ensure Sector, Domain, Country, VariableClarifier nodes exist in database

**Issue**: Migration times out
- **Solution**: For large databases, the API endpoint has a timeout. Use the shell method instead, or run in batches

## Rollback Plan (If Needed)

If something goes wrong, you can remove all `IS_RELEVANT_TO` relationships:

```cypher
MATCH ()-[r:IS_RELEVANT_TO]->(:Variable)
DELETE r
```

**⚠️ Warning**: This will remove ALL driver relationships. Only do this if absolutely necessary.

## Support

If you encounter issues:
1. Check Render deployment logs
2. Check Neo4j Aura instance status
3. Verify environment variables match Neo4j credentials
4. Review the migration output for specific error messages

---

**After successful migration:**
- ✅ All existing variables will have driver relationships
- ✅ Future variables will automatically get relationships
- ✅ No further action needed

