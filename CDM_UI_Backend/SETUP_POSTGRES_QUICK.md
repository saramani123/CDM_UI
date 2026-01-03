# Quick PostgreSQL Setup on Render (5 minutes, FREE)

## Step-by-Step Instructions

### Step 1: Go to Render Dashboard
1. Log in to [render.com](https://render.com)
2. You should see your existing services (like `cdm-backend`)

### Step 2: Create PostgreSQL Database
1. Click the **"New +"** button (top right)
2. Select **"PostgreSQL"** from the dropdown
3. Fill in the form:
   - **Name**: `cdm-metadata-db` (or any name you like)
   - **Database**: `cdm_metadata` (or leave default)
   - **User**: Leave default (auto-generated)
   - **Region**: Choose same region as your backend
   - **PostgreSQL Version**: Leave default (latest)
   - **Plan**: Select **"Free"** (completely free!)
4. Click **"Create Database"**

### Step 3: Get the Connection String
1. Wait ~30 seconds for the database to be created
2. Click on your new database service (`cdm-metadata-db`)
3. Go to the **"Connections"** tab
4. Copy the **"Internal Database URL"** (starts with `postgresql://...`)
   - This is the connection string you need

### Step 4: Update Your Backend Service
1. Go to your **`cdm-backend`** service
2. Click **"Environment"** tab
3. Click **"Add Environment Variable"**
4. Add:
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the Internal Database URL you copied
5. Click **"Save Changes"**

### Step 5: Redeploy
1. Render will automatically redeploy your service
2. Check the logs - you should see: `✅ PostgreSQL database connected and tables created`
3. Done! Your data will now persist permanently.

## That's It!

- ✅ **No credit card required**
- ✅ **Completely free** (Render's free PostgreSQL tier)
- ✅ **Takes 5 minutes**
- ✅ **Data persists forever**

## Alternative: If You Don't Want PostgreSQL

If you really don't want to set up PostgreSQL, I can create a solution that uses:
- **Render Disk Storage** (if available on your plan)
- **External API** to store data
- **Git-based storage** (commits data to git repo)

But PostgreSQL is the **recommended solution** because:
- It's free
- It's reliable
- It's standard
- It's what most apps use

Let me know if you want help with the PostgreSQL setup or prefer an alternative!

