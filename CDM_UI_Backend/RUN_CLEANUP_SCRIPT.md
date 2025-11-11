# How to Run the "ALL" Node Cleanup Script on Production

## Overview

The `fix_all_node_relationships.py` script needs to run **on the backend server** (or locally with production Neo4j credentials) because it connects directly to Neo4j. This is a **one-time cleanup script** - you don't need to deploy it, just run it once.

## Option 1: Run via Render Shell (Recommended)

This is the easiest way if you have access to Render dashboard.

### Steps:

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com
   - Navigate to your `cdm-backend` service

2. **Open Shell**
   - Click on the **"Shell"** tab (or look for "Open Shell" button)
   - This opens a terminal connected to your backend server

3. **Navigate to the script location**
   ```bash
   cd CDM_UI_Backend
   # Or if you're already in the root:
   ls -la  # Verify fix_all_node_relationships.py exists
   ```

4. **Run the script**
   ```bash
   python fix_all_node_relationships.py
   ```

5. **Review the output**
   - The script will show detailed progress
   - It will list what it's fixing
   - At the end, you'll see a summary

### Expected Output:
```
🔧 Starting safe 'ALL' node cleanup and relationship fix...
============================================================
Processing Sector nodes...
============================================================
⚠️  Found 'ALL' node for Sector
📊 Found 15 actual Sector nodes
...
✅ Cleanup complete!
```

## Option 2: Run Locally (Connect to Production Neo4j)

If you prefer to run it from your local machine, you can connect directly to production Neo4j.

### Steps:

1. **Get Production Neo4j Credentials**
   - From Render Dashboard → `cdm-backend` → Environment tab
   - Note down:
     - `NEO4J_URI` (e.g., `neo4j+s://abb4a9a8.databases.neo4j.io`)
     - `NEO4J_USERNAME` (usually `neo4j`)
     - `NEO4J_PASSWORD`

2. **Set Environment Variables Locally**
   ```bash
   export NEO4J_URI="neo4j+s://your-prod-instance.databases.neo4j.io"
   export NEO4J_USERNAME="neo4j"
   export NEO4J_PASSWORD="your_prod_password"
   ```

3. **Navigate to Backend Directory**
   ```bash
   cd CDM_UI_Backend
   ```

4. **Run the Script**
   ```bash
   python fix_all_node_relationships.py
   ```

## Option 3: Create a Temporary API Endpoint (Advanced)

If you want to trigger it via API call, you could temporarily add an endpoint. However, **Option 1 (Render Shell) is recommended** as it's simpler and safer.

## Important Notes

### ⚠️ Before Running:
- **Backup recommended**: While the script is safe, consider backing up your Neo4j database first
- **Test environment first**: If possible, test on a copy of production data
- **Read the output**: The script shows exactly what it's doing

### ✅ After Running:
1. **Verify in Neo4j Browser**:
   ```cypher
   // Check for any remaining "ALL" nodes
   MATCH (s:Sector {name: 'ALL'}) RETURN s
   MATCH (d:Domain {name: 'ALL'}) RETURN d
   MATCH (c:Country {name: 'ALL'}) RETURN c
   ```

2. **Verify Relationships**:
   ```cypher
   // Check that objects with "ALL" now have relationships to all sectors
   MATCH (o:Object)-[:RELEVANT_TO]->(s:Sector)
   WHERE o.driver CONTAINS 'ALL'
   RETURN o.name, collect(s.name) as sectors
   ```

3. **Check UI**: 
   - Verify "ALL" appears correctly in multiselects (as UI convenience)
   - Verify "ALL" doesn't appear as a node in the drivers list
   - Verify S, D, C columns show correct values

## Troubleshooting

### If Render Shell doesn't work:
- Make sure you're in the correct service (`cdm-backend`)
- Try refreshing the Render dashboard
- Check if the service is running

### If script fails:
- Check Neo4j connection (verify credentials)
- Check Neo4j logs for detailed errors
- Ensure you have write access to Neo4j
- The script will show detailed error messages

### If you see "No 'ALL' node found":
- ✅ This is good! It means your database is already clean
- The script is idempotent, so it's safe to run multiple times

## Safety Guarantees

- ✅ **Idempotent**: Safe to run multiple times
- ✅ **Non-destructive**: Only modifies "ALL"-related data
- ✅ **Verification**: Checks before making changes
- ✅ **Detailed logging**: Shows exactly what's happening
- ✅ **Transaction-safe**: Uses write transactions

## Next Steps After Cleanup

1. **Deploy the frontend fix** (driver reordering bug fix):
   - Push to `main` branch
   - Render will auto-deploy frontend
   - Driver order will now persist across deployments

2. **Monitor for a few days**:
   - Check that "ALL" doesn't reappear
   - Verify driver sorting persists
   - Check that relationships are correct

## Questions?

If you encounter any issues:
1. Check the script output for error messages
2. Verify Neo4j connection is working
3. Check Render logs for backend errors
4. The script provides detailed logging to help diagnose issues

