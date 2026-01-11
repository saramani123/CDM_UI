# Dev/Prod Data Separation Guide

## Overview
This guide explains how to safely separate development and production data for Metadata, Heuristics, and Sources.

## Current Setup

### ✅ **Production (Render)**
- **Uses**: PostgreSQL database (`cdm-metadata-heuristics-sources-db`)
- **Location**: Render PostgreSQL instance
- **Data**: All production data is stored here
- **Connection**: Via `DATABASE_URL` environment variable (automatically set by Render)

### ✅ **Development (Local)**
- **Uses**: JSON files (fallback)
- **Location**: `CDM_UI_Backend/` directory
  - `heuristics.development.json`
  - `metadata.development.json`
  - `sources.development.json`
- **Data**: All development/test data is stored here
- **Connection**: No PostgreSQL connection (uses JSON files)

## How It Works

The system automatically detects the environment:

1. **Production Detection**: 
   - Checks for `RENDER` environment variable (set by Render platform)
   - If present → uses PostgreSQL
   - If not present → uses JSON files

2. **Data Storage**:
   - **Production**: All data goes to PostgreSQL
   - **Development**: All data goes to JSON files

## ✅ **What You Need to Do**

### **Nothing!** The setup is already configured correctly:

1. **Local Development**:
   - When you run `./start_dev.sh` locally
   - The system detects you're NOT on Render
   - Automatically uses JSON files (`*.development.json`)
   - Your changes stay local and never touch production

2. **Production (Render)**:
   - When code runs on Render
   - The system detects the `RENDER` environment variable
   - Automatically uses PostgreSQL
   - All production data is safely stored there

## Verification Steps

### 1. Verify Local Dev Uses JSON Files

When you start the backend locally, you should see:
```
ℹ️  Local development detected - using JSON files instead of PostgreSQL
ℹ️  Skipping PostgreSQL initialization - using JSON files for local development
```

### 2. Verify Production Uses PostgreSQL

When the backend runs on Render, you should see in the logs:
```
Connecting to PostgreSQL database...
✅ PostgreSQL database connected and tables created
```

### 3. Check Your Data Files

**Local Development Files** (safe to modify):
- `CDM_UI_Backend/heuristics.development.json`
- `CDM_UI_Backend/metadata.development.json`
- `CDM_UI_Backend/sources.development.json`

**Production Files** (DO NOT modify manually):
- `CDM_UI_Backend/heuristics.production.json` (fallback only)
- `CDM_UI_Backend/metadata.production.json` (fallback only)
- `CDM_UI_Backend/sources.production.json` (fallback only)

## Important Notes

1. **✅ Safe**: 
   - Making changes locally only affects JSON files
   - Production data in PostgreSQL is completely isolated
   - No risk of accidentally modifying production data

2. **✅ Automatic**:
   - No manual configuration needed
   - Environment detection is automatic
   - JSON files are created automatically if they don't exist

3. **✅ Separate**:
   - Dev data: JSON files (local)
   - Prod data: PostgreSQL (Render)
   - They never mix

## Troubleshooting

### If you see PostgreSQL connection errors locally:
**This is normal!** The system will automatically fall back to JSON files.

### If you want to test PostgreSQL locally:
1. Don't set `DATABASE_URL` in `.env.dev` (keep it unset)
2. The system will use JSON files automatically
3. This keeps your dev data separate from production

### If production isn't using PostgreSQL:
1. Check Render environment variables
2. Ensure `DATABASE_URL` is set (Render sets this automatically)
3. Check backend logs for connection messages

## Summary

- **Local Dev** → JSON files → Safe to experiment
- **Production** → PostgreSQL → Protected production data
- **Automatic** → No configuration needed
- **Separate** → Dev and prod never mix

Your production data is safe! 🛡️

