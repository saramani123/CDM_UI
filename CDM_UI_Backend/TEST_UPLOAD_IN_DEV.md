# Testing Variable CSV Upload in Development

This guide helps you test the variable CSV upload functionality in the dev environment before deploying to production.

## Prerequisites

1. ✅ `.env.dev` file exists in `CDM_UI_Backend/` directory
2. ✅ Dev environment connects to `CDM_Dev` Neo4j instance
3. ✅ Local development servers can be started

## Step 1: Start Development Environment

```bash
# From the root directory
./start_dev.sh
```

Or manually:
```bash
# Terminal 1: Backend
cd CDM_UI_Backend
python main.py

# Terminal 2: Frontend
cd CDM_Frontend
npm run dev
```

## Step 2: Test with Generated CSV (Quick Test)

```bash
cd CDM_UI_Backend
python test_variable_upload.py
```

This will:
- Create a test CSV with 10 sample variables
- Upload to `http://localhost:8000/api/v1/variables/bulk-upload`
- Show results and any errors

## Step 3: Test with Your Real CSV File

```bash
cd CDM_UI_Backend
python test_variable_upload.py /path/to/your/variables.csv
```

Example:
```bash
python test_variable_upload.py ~/Downloads/variables_200_rows.csv
```

## Step 4: Check the Backend Logs

Watch the terminal where the backend is running. You should see:
- `CSV Headers found: [...]`
- `First few rows sample: [...]`
- `Processing X variables in Y batches of 250`
- `✅ Batch 1/Y completed: X variables created`
- Any error messages with details

## Step 5: Verify in Neo4j Browser (Optional)

1. Connect to `CDM_Dev` Neo4j instance
2. Run query:
```cypher
MATCH (v:Variable)
RETURN count(v) as variable_count
```

## What to Look For

### ✅ Success Indicators:
- `created_count` > 0
- `error_count` = 0
- Backend logs show successful batch completion
- Variables appear in frontend

### ❌ Error Indicators:
- `created_count` = 0
- `error_count` > 0
- Check error messages in response
- Check backend logs for specific row errors

## Common Issues

### 1. Missing Required Fields
**Error**: `Row X: Missing required fields: Sector, Domain, ...`
**Fix**: Ensure CSV has all required columns:
- Sector, Domain, Country, Variable Clarifier
- Part, Section, Group, Variable

### 2. CSV Parsing Errors
**Error**: `Row X: CSV parsing error - ...`
**Fix**: 
- Check for unescaped commas in fields
- Ensure proper CSV format (quoted fields if needed)
- Check file encoding (should be UTF-8)

### 3. Header Mismatch
**Error**: Missing required fields (but CSV has them)
**Fix**: Check header names match exactly:
- Case sensitive: `Variable Clarifier` not `variable clarifier`
- Exact spacing: `Format I` not `FormatI` or `Format I `

## Testing Checklist

- [ ] Dev backend running on `localhost:8000`
- [ ] Connected to `CDM_Dev` Neo4j instance
- [ ] Test with 10 rows: ✅ Success
- [ ] Test with 50 rows: ✅ Success
- [ ] Test with 200 rows: ✅ Success
- [ ] Check error messages are helpful
- [ ] Verify variables created in Neo4j
- [ ] Variables appear in frontend

## Once Tests Pass in Dev

1. ✅ All tests passing
2. ✅ No data corruption
3. ✅ Error messages are clear
4. ✅ Ready to deploy to production!

Then you can:
- Commit and push changes
- Deploy backend to Render
- Test in production with small batch first (50-100 rows)
- Then scale up to larger batches (200 rows)

