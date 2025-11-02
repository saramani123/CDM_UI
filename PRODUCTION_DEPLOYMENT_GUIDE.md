# Production Deployment Guide - Latest Changes

## Overview

This guide covers deploying the latest changes to production, including:
1. Variables Neo4j Knowledge Graph feature
2. Grid alignment fixes
3. Objects endpoint optimization
4. Ensuring variable-driver relationships migration is safe and idempotent
5. Verifying Neo4j Knowledge Graph uses CDM_Prod instance in production

## Pre-Deployment Checklist

### ✅ Code Changes (Already Committed & Pushed)
- [x] Variables Neo4j Knowledge Graph modal
- [x] Objects and Variables grid alignment fixes
- [x] Optimized objects endpoint (reverted to N+1 queries for reliability)
- [x] Tab switching improvements with proper remounting
- [x] All changes pushed to `main` branch

### ⚠️ Critical Items to Verify

1. **Environment Variables in Render (Backend)**
   - `NEO4J_URI` - Should point to CDM_Prod instance (e.g., `neo4j+s://your-prod-instance.databases.neo4j.io`)
   - `NEO4J_USERNAME` - Production Neo4j username
   - `NEO4J_PASSWORD` - Production Neo4j password
   - `ENVIRONMENT` - Should be set to `production`
   - `NEO4J_INSTANCE_NAME` - Should be set to `CDM_Prod`
   - `RENDER` - Automatically set by Render (used to detect production environment)

2. **Environment Variables in Render (Frontend)**
   - `VITE_API_BASE_URL` - Should point to production backend (e.g., `https://cdm-backend.onrender.com/api/v1`)
   - Frontend build should detect production via `import.meta.env.PROD` when built for production

## Deployment Steps

### Step 1: Deploy Backend (CDM_UI_Backend)

1. Go to Render Dashboard → `cdm-backend` service
2. Click **"Manual Deploy"** → **"Deploy latest commit"**
3. Select the latest commit from `main` branch (commit: `bb9e5a5`)
4. Wait for deployment to complete
5. Verify health check: Visit `https://your-backend-url.onrender.com/health`
   - Should return: `{"status": "ok", "message": "CDM_U Backend is running"}`

### Step 2: Verify Backend Neo4j Connection

The backend automatically connects to the Neo4j instance based on environment variables:
- **Production**: Uses `NEO4J_URI` from Render environment variables (CDM_Prod)
- **Development**: Uses `.env.dev` file (CDM_Dev)

**Verification:**
```bash
# Check backend logs in Render
# Should see: "✅ Connected to production Neo4j Aura - CDM_Prod"
# Should see: "Database: neo4j"
```

The backend uses `db.py` which:
- Detects production via `RENDER` environment variable
- Automatically uses the correct Neo4j URI from `NEO4J_URI`
- No code changes needed - works automatically based on environment

### Step 3: Run Variable-Driver Relationships Migration (ONE TIME ONLY)

**Important**: The migration script is **idempotent** - it's safe to run multiple times because:
- The `create_driver_relationships` function **deletes existing relationships first** (lines 28-49 in `routes/variables.py`)
- Then it creates new relationships using `MERGE` (which prevents duplicates)
- This means running it multiple times won't create duplicate relationships

**Option A: Via API Endpoint (Recommended)**
```bash
curl -X POST https://your-backend-url.onrender.com/api/v1/variables/backfill-driver-relationships
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Processed <N> variables",
  "total_variables": <N>,
  "relationships_created": <N>,
  "skipped": 0,
  "errors": 0,
  "error_details": []
}
```

**Option B: Via Render Shell**
1. Render Dashboard → `cdm-backend` → **Shell** tab
2. Run:
   ```bash
   python migrate_variable_driver_relationships.py
   ```
3. Type `yes` when prompted

**Why It's Safe to Run Multiple Times:**
- The function `create_driver_relationships` in `routes/variables.py` first deletes ALL existing `IS_RELEVANT_TO` relationships for each variable (lines 28-49)
- Then it creates new relationships using `MERGE`, which prevents duplicates
- Even if you run the backfill endpoint multiple times, it will clean up and recreate relationships correctly

**After Migration:**
- All existing variables will have `IS_RELEVANT_TO` relationships
- All new variables created after this will automatically get relationships (via backend endpoints)
- Future deployments won't need to run this migration again

### Step 4: Deploy Frontend (CDM_Frontend)

1. Go to Render Dashboard → `cdm-frontend` service (or Vercel if using Vercel)
2. Click **"Manual Deploy"** → **"Deploy latest commit"**
3. Select the latest commit from `main` branch (commit: `bb9e5a5`)
4. Wait for deployment to complete

### Step 5: Verify Frontend Environment Detection

The frontend Neo4j Knowledge Graph modal automatically detects the environment:

**Production Detection Logic** (`Neo4jGraphModal.tsx` lines 41-51):
```typescript
const getEnvironmentInfo = () => {
  const isProduction = import.meta.env.PROD || 
                      (import.meta.env.VITE_API_BASE_URL?.includes('render.com') || 
                       import.meta.env.VITE_API_BASE_URL?.includes('onrender.com'));
  
  return {
    environment: isProduction ? 'production' : 'development',
    instanceName: isProduction ? 'CDM_Prod' : 'CDM_Dev'
  };
};
```

**Verification:**
1. Open the production frontend
2. Navigate to **Objects** or **Variables** tab
3. Click **"View Neo4j Knowledge Graph"**
4. Check the modal header - should show:
   - Title: "Neo4j Knowledge Graph"
   - Subtitle: "Instance: **CDM_Prod**" (not CDM_Dev)

### Step 6: Verify Graph Endpoint Uses Correct Instance

The graph endpoint (`/api/v1/graph/query`) automatically uses the correct Neo4j instance:
- It calls `get_driver()` from `db.py`
- `db.py` uses environment variables from Render:
  - `NEO4J_URI` (points to CDM_Prod in production)
  - `NEO4J_USERNAME`
  - `NEO4J_PASSWORD`

**No additional configuration needed** - the backend automatically connects to the correct instance based on environment variables set in Render.

## Post-Deployment Verification

### 1. Test Objects Knowledge Graph
- [ ] Open production frontend
- [ ] Navigate to **Objects** tab
- [ ] Click **"View Neo4j Knowledge Graph"**
- [ ] Verify modal shows **"Instance: CDM_Prod"**
- [ ] Test **"Object Taxonomy"** view - should show Being → Avatar → Object → Variant hierarchy
- [ ] Test **"Object Model"** view - should show Object-to-Object relationships
- [ ] Verify graph loads and displays correctly

### 2. Test Variables Knowledge Graph
- [ ] Navigate to **Variables** tab
- [ ] Click **"View Neo4j Knowledge Graph"**
- [ ] Verify modal shows **"Instance: CDM_Prod"**
- [ ] Test **"Variable Taxonomy"** view - should show Part → Group → Variable hierarchy
- [ ] Test **"Variable-Object Model"** view - should show Variable-to-Object relationships
- [ ] Verify graph loads and displays correctly

### 3. Verify Variable-Driver Relationships
```cypher
// In Neo4j Browser (production instance)
MATCH (v:Variable)<-[r:IS_RELEVANT_TO]-(d)
RETURN count(r) as totalRelationships, count(DISTINCT v) as variablesWithRelationships
```

Expected: All variables should have relationships.

### 4. Test Grid Alignment
- [ ] Open **Objects** tab - verify columns align correctly
- [ ] Open **Variables** tab - verify columns align correctly
- [ ] Switch between tabs - verify no visual bleeding or misalignment

## Troubleshooting

### Issue: Graph shows "Instance: CDM_Dev" in production
**Solution**: 
- Verify `VITE_API_BASE_URL` environment variable in frontend Render service
- Should include `render.com` or `onrender.com`
- Rebuild frontend after updating environment variable

### Issue: Graph endpoint fails to connect
**Solution**:
- Check backend logs in Render
- Verify `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` are set correctly
- Verify they point to CDM_Prod instance

### Issue: Migration creates duplicate relationships
**Solution**:
- This shouldn't happen - the migration is idempotent
- If you see duplicates, the `create_driver_relationships` function deletes existing relationships first
- Re-run the migration - it will clean up duplicates

## Summary

✅ **Code is ready**: All changes committed and pushed to `main`

✅ **Migration is safe**: Variable-driver relationships migration is idempotent (safe to run multiple times)

✅ **Environment detection works**: Neo4j Knowledge Graph automatically detects production vs dev

✅ **No manual configuration needed**: Backend and frontend automatically use correct Neo4j instance based on environment variables

**Deployment Order:**
1. Deploy backend → Verify health check → Verify Neo4j connection
2. Run migration (one time) → Verify relationships created
3. Deploy frontend → Verify graph shows "Instance: CDM_Prod"
4. Test all features → Complete!

