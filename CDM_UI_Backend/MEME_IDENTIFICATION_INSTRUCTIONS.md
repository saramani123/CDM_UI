# Meme Identification Script - Deployment Instructions

## Overview
The `identify_memes.py` script automatically identifies and sets the `is_meme` property for Objects and Variables based on the naming pattern: names that start with `[[` and end with `]]` are considered memes.

## Script Location
`CDM_UI_Backend/identify_memes.py`

## How to Run on Render

### Option 1: Using Render Shell (Recommended)
1. Go to your Render dashboard: https://dashboard.render.com
2. Navigate to your **CDM_UI_Backend** service
3. Click on **Shell** tab (or look for "Open Shell" / "Console" option)
4. Once in the shell, run:
   ```bash
   cd /opt/render/project/src/CDM_UI_Backend
   python3 identify_memes.py
   ```

### Option 2: SSH into Render Service
If your Render service supports SSH:
1. Get SSH connection details from Render dashboard
2. SSH into the service
3. Navigate to the backend directory
4. Run: `python3 identify_memes.py`

### Option 3: Add as Post-Deploy Script
You can add this as a post-deploy command in your Render service settings:
1. Go to your Render service settings
2. Find "Build Command" or "Post-Deploy Command" section
3. Add: `cd CDM_UI_Backend && python3 identify_memes.py`
   - **Note:** This will run automatically after each deployment, which may not be desired

### Option 4: Manual Execution via Render API/CLI
If you have Render CLI installed:
```bash
render services:shell <service-id>
# Then run: python3 identify_memes.py
```

## What the Script Does
1. Connects to Neo4j using environment variables (automatically configured on Render)
2. Finds all Object and Variable nodes
3. Checks if their names match the pattern: starts with `[[` and ends with `]]`
4. Sets `is_meme = true` for matches, `is_meme = false` for non-matches
5. Reports the number of nodes updated

## Expected Output
```
🚀 Starting meme identification script...
📋 Pattern: Names starting with '[[' and ending with ']]' are memes
⚠️  This will update is_meme property for all Objects and Variables

Connecting to Neo4j...
  Environment: production
  Instance: CDM_Prod
  URI: neo4j+s://...
✅ Successfully connected to Neo4j!

============================================================
Identifying memes based on naming pattern: [[...]]
============================================================

Processing Objects...
  ✅ Processed 150 Objects
     - Set is_meme = true: 12
     - Set is_meme = false: 138

Processing Variables...
  ✅ Processed 230 Variables
     - Set is_meme = true: 8
     - Set is_meme = false: 222

------------------------------------------------------------
Verification:
------------------------------------------------------------
Objects with is_meme = true: 12
Variables with is_meme = true: 8

============================================================
✅ Meme identification completed successfully!
============================================================

Neo4j connection closed
```

## Important Notes
- The script uses environment variables that are automatically set by Render
- It works for both development and production environments
- The script is **idempotent** - you can run it multiple times safely
- It will update ALL Objects and Variables, not just new ones
- Make sure your Neo4j connection environment variables are set correctly in Render

## Troubleshooting
If you encounter connection issues:
1. Verify Neo4j environment variables are set in Render dashboard
2. Check that the Neo4j instance is accessible from Render
3. Review the error messages in the script output

