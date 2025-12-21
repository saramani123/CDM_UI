# Normalize Variable Driver Strings - Migration Guide

## Problem
On production, variables with all sectors/domains/countries sometimes show a concatenated list (e.g., "Sector1, Sector2, Sector3") instead of "ALL" in the S, D, C columns. The metadata panel dropdowns should also auto-select "ALL" when all values are present.

## Solution
This migration normalizes driver strings in the database to use "ALL" when all values are present, without modifying any Neo4j relationships.

## Changes Made

### Backend (`routes/variables.py`)
- Updated `get_variables()` endpoint to normalize driver strings when all sectors/domains/countries are present
- Checks if all possible values are selected and converts comma-separated lists to "ALL"
- Does NOT modify Neo4j relationships - only normalizes the driver string for display

### Frontend (`data/variablesData.ts`)
- Improved `parseVariableDriverString()` to better detect when all values are present
- Ensures metadata panel auto-selects "ALL" when all values are present

### Migration Script (`normalize_variable_driver_strings.py`)
- Script to normalize existing driver strings in production database
- Updates `Variable.driver` property only (does NOT change relationships)
- Safe to run multiple times (idempotent)

## Running the Migration on Render

### Option 1: SSH into Render Service (Recommended)

1. **SSH into your backend service on Render:**
   ```bash
   # Get SSH command from Render dashboard
   # Or use: ssh <service-name>@<render-instance>
   ```

2. **Navigate to the backend directory:**
   ```bash
   cd /opt/render/project/src/CDM_UI_Backend
   ```

3. **Run the migration script in DRY RUN mode first:**
   ```bash
   python3 normalize_variable_driver_strings.py
   ```
   
   This will show you what would be changed without making any changes.

4. **Review the output** to ensure it looks correct.

5. **Apply the changes:**
   ```bash
   python3 normalize_variable_driver_strings.py --apply
   ```

### Option 2: Run via Render Shell (Alternative)

1. **Open Render Shell** from your Render dashboard
2. **Navigate to backend directory:**
   ```bash
   cd CDM_UI_Backend
   ```
3. **Run the migration:**
   ```bash
   python3 normalize_variable_driver_strings.py --apply
   ```

### Option 3: Add as One-Time Script in Render

You can also add this as a one-time script in your Render service settings:

1. Go to your backend service settings in Render
2. Add a new "One-Time Script" with:
   ```bash
   cd CDM_UI_Backend && python3 normalize_variable_driver_strings.py --apply
   ```
3. Run it once, then remove it

## What the Script Does

1. **Connects to Neo4j** using your existing database connection
2. **Gets all driver values** (sectors, domains, countries) from Neo4j
3. **Finds all variables** with their current driver relationships
4. **Checks each variable** to see if all sectors/domains/countries are present
5. **Normalizes driver strings** to use "ALL" when all values are present
6. **Updates Variable.driver property** (does NOT modify relationships)

## Safety

- ✅ **Safe**: Only updates the `driver` property on Variable nodes
- ✅ **No relationship changes**: Does NOT modify any Neo4j relationships
- ✅ **Idempotent**: Safe to run multiple times
- ✅ **Dry run mode**: Test first with `--apply` flag omitted

## Verification

After running the migration, verify the changes:

1. **Check a few variables** in the frontend to see if "ALL" displays correctly
2. **Open metadata panel** for a variable with all drivers - "ALL" should be selected
3. **Verify relationships** are still intact (they should be, as we don't modify them)

## Rollback

If needed, you can rollback by:
1. Restoring from a Neo4j backup (if you have one)
2. Or manually updating driver strings back (not recommended unless necessary)

## Notes

- The backend code changes will automatically normalize driver strings for new queries
- The migration script is only needed to fix existing data
- After running the migration, new variables will automatically have normalized driver strings

