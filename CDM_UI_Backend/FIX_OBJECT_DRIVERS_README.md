# Fix Object Driver Relationships Script

## Overview

This script fixes driver relationships for objects in Neo4j. It checks all objects and ensures that the `RELEVANT_TO` relationships match what's specified in the object's `driver` string property.

## Problem

Some objects in production have driver values displayed in the grid (e.g., "All, All, All") but the corresponding relationships are not created in Neo4j. This script identifies and fixes these mismatches.

## What the Script Does

1. **Checks all objects** in Neo4j and reads their `driver` string property
2. **Parses the driver string** to extract sector, domain, country, and clarifier values
3. **Determines expected relationships** based on the driver string:
   - If a value is "ALL", it creates relationships to ALL existing sectors/domains/countries
   - If a value is a specific name, it creates a relationship to that specific driver node
4. **Compares expected vs actual** relationships in Neo4j
5. **Creates missing relationships** to fix any mismatches

## Important: "ALL" Handling

When the driver string contains "ALL" for sector, domain, or country:
- **DO NOT** create an "All" node in Neo4j
- **DO** create `RELEVANT_TO` relationships between the object and ALL existing sector/domain/country nodes

## Usage

### Dry Run (Recommended First)

Test what would be fixed without making any changes:

```bash
cd CDM_UI_Backend
python fix_object_driver_relationships.py --dry-run
```

### Production Fix

After reviewing the dry run output, run the script to actually fix the relationships:

```bash
# Make sure you're connected to production Neo4j
# Check your .env file or environment variables
python fix_object_driver_relationships.py
```

### Development Instance

To run on the development instance:

```bash
# Set environment variables for dev instance
export NEO4J_URI="neo4j+s://your-dev-instance"
export NEO4J_USERNAME="neo4j"
export NEO4J_PASSWORD="your-password"
export ENVIRONMENT="development"
export NEO4J_INSTANCE_NAME="CDM_Dev"

python fix_object_driver_relationships.py --dry-run
```

## Output

The script will:
- Show progress for each object being checked
- Display which objects were fixed and what relationships were created
- Provide a summary at the end with:
  - Total objects checked
  - Number of objects fixed
  - Total relationships created

## Example Output

```
Connected to Neo4j (prod instance)
DRY RUN MODE - No changes will be made

Found 150 objects to check

✅ Fixed Consolidation (ID: abc-123-def)
   - Created 3 sector relationship(s): Financial, Healthcare, Technology
   - Created 5 domain relationship(s): Banking, Insurance, ...
   - Created 2 country relationship(s): USA, UK

...

============================================================
Summary:
  Total objects checked: 150
  Objects fixed: 12
  Total relationships created: 45
```

## Related Code Changes

The following endpoints have been fixed to properly handle "ALL" values:

1. **CSV Upload** (`/objects/upload`): Now creates relationships to ALL sectors/domains/countries when "ALL" is specified
2. **Add Object** (`/objects`): Already handled "ALL" correctly
3. **Update Object** (`/objects/{object_id}`): Already handled "ALL" correctly

## Notes

- The script uses the same logic as the backend endpoints to parse driver strings
- It handles both simple cases (exactly 4 parts) and complex cases (multiple values with commas)
- The script is idempotent - running it multiple times won't create duplicate relationships
- Missing driver nodes (sectors/domains/countries that don't exist) will be skipped with a warning

