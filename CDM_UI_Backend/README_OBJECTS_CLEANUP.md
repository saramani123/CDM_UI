# Objects Cleanup Script

This script helps you clean up Objects from your Neo4j database for fresh testing.

## What it does

- **Deletes all Objects** and their related Variants and Relationships
- **Preserves driver data** (Sectors, Domains, Countries, ObjectClarifiers)
- **Preserves taxonomy structure** (Beings, Avatars)
- **Safe operation** with confirmation prompts

## Usage

### List current Objects
```bash
cd CDM_UI_Backend
source venv_neo4j/bin/activate
python delete_all_objects.py --list
```

### Delete all Objects
```bash
cd CDM_UI_Backend
source venv_neo4j/bin/activate
python delete_all_objects.py
```

## What gets deleted

- ✅ All Object nodes
- ✅ All Variant nodes connected to Objects
- ✅ All Relationship nodes connected to Objects
- ✅ All relationships between Objects and other entities

## What gets preserved

- ✅ Sectors, Domains, Countries, ObjectClarifiers (driver data)
- ✅ Beings and Avatars (taxonomy structure)
- ✅ Variables and Lists (other CDM entities)

## Safety features

- Shows you exactly what will be deleted before proceeding
- Requires explicit confirmation ("yes") to proceed
- Provides detailed feedback on what was deleted
- Verifies successful deletion

## Example output

```
🧹 Neo4j Objects Cleanup Script
==================================================

📋 Current Objects (3):
--------------------------------------------------------------------------------
ID: 969a0070-1299-473b-825e-f7600e1981f3
  Being: Master | Avatar: Company | Object: TestHospital
  Driver: ALL, ALL, ALL, Employment Type
--------------------------------------------------------------------------------
ID: d0c79f73-5187-4fc2-a9ad-6734aefb5d37
  Being: Master | Avatar: Company | Object: TestBank
  Driver: ALL, ALL, ALL, Pay Type
--------------------------------------------------------------------------------
ID: dbee6301-793c-4e92-b235-d8a36af95b72
  Being: Master | Avatar: Company | Object: TestTech
  Driver: ALL, ALL, ALL, Hour Type
--------------------------------------------------------------------------------

🗑️  Found 3 Objects to delete
   - 0 Variants will be deleted
   - 0 Relationships will be deleted

⚠️  Are you sure you want to delete ALL Objects? (yes/no): yes

🗑️  Deleting Objects and related data...
✅ Successfully deleted all Objects and related data
ℹ️  Driver data (Sectors, Domains, Countries, ObjectClarifiers) preserved
ℹ️  Taxonomy structure (Beings, Avatars) preserved
```

## After cleanup

Your database will be clean and ready for fresh Object uploads. You can:

1. Upload new Objects via the UI
2. Upload Objects via CSV
3. Create Objects programmatically

The driver data and taxonomy structure will remain intact for your new Objects to use.
