# Deployment Plan: Default Relationships Feature

## Overview
This deployment adds the new default relationships functionality where every object has relationships to ALL other objects (including itself) by default.

## Pre-Deployment Checklist

- [x] All code changes committed to `main` branch
- [x] Migration script created (`migrate_default_relationships.py`)
- [x] Migration documentation created (`MIGRATION_DEFAULT_RELATIONSHIPS.md`)
- [ ] **Backup Neo4j database** (recommended before running migration)

## Deployment Steps

### Step 1: Deploy Backend (CDM_UI_Backend)

1. Go to Render dashboard: https://dashboard.render.com
2. Navigate to your **CDM_UI_Backend** service
3. Click **"Manual Deploy"** → **"Deploy latest commit"**
4. Wait for deployment to complete (usually 2-5 minutes)
5. Verify the service is running and healthy

**What this deploys:**
- Updated relationship creation logic
- Updated relationship count calculation (counts distinct target objects)
- Migration script (available but not yet run)

### Step 2: Deploy Frontend (CDM_Frontend)

1. Go to Render dashboard
2. Navigate to your **CDM_Frontend** service (or Vercel if that's where it's hosted)
3. Click **"Manual Deploy"** → **"Deploy latest commit"**
4. Wait for deployment to complete

**What this deploys:**
- Updated RelationshipModal with default relationships UI
- All objects selected by default
- Default role word handling
- UI improvements (ALL caps, buttons, filters, etc.)

### Step 3: Run Migration Script (CRITICAL)

**⚠️ IMPORTANT: You MUST run the migration script after deploying both frontend and backend to create all the default relationships in Neo4j.**

#### Option A: Run via Render Shell (Recommended)

1. In Render dashboard, go to your **CDM_UI_Backend** service
2. Click on **"Shell"** tab (or use SSH if enabled)
3. Navigate to the project directory:
   ```bash
   cd /opt/render/project/src/CDM_UI_Backend
   ```
4. Run the migration script:
   ```bash
   python migrate_default_relationships.py
   ```
5. Review the output - it will show progress for each object
6. Wait for completion (may take several minutes for 100+ objects)

#### Option B: Run Locally (if you have production Neo4j access)

1. Set environment variables to point to **PRODUCTION** Neo4j:
   ```bash
   export NEO4J_URI="your_production_neo4j_uri"
   export NEO4J_USERNAME="your_production_username"
   export NEO4J_PASSWORD="your_production_password"
   ```
2. Navigate to backend directory:
   ```bash
   cd CDM_UI_Backend
   ```
3. Run the migration:
   ```bash
   python migrate_default_relationships.py
   ```

#### Option C: Create One-Time Job in Render

1. In Render dashboard, create a new **"One-off Job"**
2. Set the command to:
   ```bash
   cd /opt/render/project/src/CDM_UI_Backend && python migrate_default_relationships.py
   ```
3. Run the job manually

### Step 4: Verify Deployment

After migration completes, verify:

1. **Check Relationships Count in UI:**
   - Open the Objects grid
   - The "Relationships" column should show the total number of objects for each object
   - Example: If there are 150 objects, each should show "150" relationships

2. **Test Relationships Modal:**
   - Click on any object to open the relationships modal
   - All objects should be selected/highlighted by default
   - Default role word should be the source object name (not visible in UI)
   - Users should be able to add additional role words
   - Self-relationship should be locked to "Intra-Table"

3. **Verify in Neo4j Browser (optional):**
   ```cypher
   MATCH (o:Object)-[r:RELATES_TO]->(other:Object)
   RETURN o.object as source, count(DISTINCT other) as relationship_count
   ORDER BY relationship_count DESC
   ```
   - Each object should have relationships to all other objects
   - Count should equal total number of objects

## What the Migration Does

The migration script will:
1. Get all objects from Neo4j
2. For each object, create relationships to ALL other objects (including itself)
3. Set default properties:
   - **To other objects**: Type = `Inter-Table`, Frequency = `Possible`, Role = source object name
   - **To self**: Type = `Intra-Table`, Frequency = `Possible`, Role = object name
4. Skip relationships that already exist (idempotent - safe to run multiple times)
5. Update relationship counts for each object

## Expected Timeline

- **Backend deployment**: 2-5 minutes
- **Frontend deployment**: 2-5 minutes
- **Migration script**: 
  - For 100 objects: ~5-10 minutes
  - For 150 objects: ~10-15 minutes
  - (Depends on Neo4j performance)

## Rollback Plan (if needed)

If something goes wrong:

1. **Frontend rollback**: Deploy previous commit from Render dashboard
2. **Backend rollback**: Deploy previous commit from Render dashboard
3. **Data rollback**: The migration script doesn't delete existing relationships, so old data should still be intact. However, if you need to remove the new default relationships:
   ```cypher
   // Remove all relationships with default role word (source object name)
   // This would need to be done per object - contact support if needed
   ```

## Post-Deployment

After successful deployment and migration:

1. Monitor the application for any errors
2. Test creating/editing relationships to ensure everything works
3. Verify relationship counts are correct
4. Check that users can add additional role words correctly

## Support

If you encounter any issues:
1. Check Render logs for backend errors
2. Check browser console for frontend errors
3. Verify Neo4j connection is working
4. Review migration script output for any errors

## Summary

**Deployment Order:**
1. ✅ Deploy Backend → Wait for completion
2. ✅ Deploy Frontend → Wait for completion  
3. ⚠️ **Run Migration Script** → This is critical!
4. ✅ Verify everything works

**Key Point:** The migration script MUST be run after deployment, otherwise the relationships won't exist in Neo4j and the UI will show all objects as selected but without actual relationships in the database.

