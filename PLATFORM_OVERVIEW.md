# 🏗️ CDM Platform Architecture & Workflow Overview

## 📋 **Project Structure**

```
CDM Screens/
├── CDM_Frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── hooks/        # API hooks (useObjects, useDrivers, useVariables)
│   │   ├── services/     # API service layer
│   │   └── data/         # Data types and mock data (now empty for production)
│   └── render.yaml       # Render deployment config (frontend static site)
├── CDM_UI_Backend/       # FastAPI backend
│   ├── routes/           # API endpoints (objects, drivers, variables)
│   ├── db.py            # Neo4j connection logic
│   └── render.yaml      # Render deployment config (backend web service)
├── render.yaml           # Root Render blueprint (frontend + backend services)
└── start_dev.sh          # Local development startup script
```

---

## 🗄️ **Database Architecture**

### **Neo4j Aura Instances:**
- **CDM_Dev** (Development): `neo4j+s://fbb04c5f.databases.neo4j.io`
- **CDM_Prod** (Production): `neo4j+s://abb4a9a8.databases.neo4j.io`

### **PostgreSQL (Metadata / Heuristics / Sources persistence):**
- Configured via `DATABASE_URL` env var on Render
- Local/dev fallback: JSON files (`metadata.development.json`, `heuristics.development.json`, `cdm_sources_store.development.json`)

### **Data Model:**
```
Nodes: Object, Variable, List, Driver (Sector/Domain/Country/Clarifier)
Relationships: RELEVANT_TO, IS_RELEVANT_TO, HAS_VARIABLE, etc.
```
> Drivers (Sector/Domain/Country) are now defined and managed in the **Metadata** tab.

### **Environment Separation:**
- **Development**: Uses CDM_Dev instance (safe for testing)
- **Production**: Uses CDM_Prod instance (manager's data)
- **No data mixing** between environments

---

## 🌐 **Deployment Architecture**

Deployment is hosted on **Render** (we no longer use Vercel). Render auto-deploys on
push to `main`, or you can trigger a **Manual Deploy** from the Render dashboard.

### **Production URLs:**
- **Frontend**: `https://cdm-frontend-8zl4.onrender.com`
- **Backend**: `https://cdm-backend.onrender.com`
- **Backend health**: `https://cdm-backend.onrender.com/health`

### **Development URLs:**
- **Frontend**: `http://localhost:5173` (Vite dev server)
- **Backend**: `http://localhost:10000`

### **Environment Detection:**
- **Production**: Detected via the `RENDER` env var (backend) and `onrender.com` in
  `VITE_API_BASE_URL` (frontend). Neo4j instance resolves to **CDM_Prod**.
- **Development**: No `RENDER` env var → **CDM_Dev**.

---

## 🔄 **Development Workflow**

### **Branch Strategy:**
- **`main`** → active development + production deployment (push to `main` deploys to Render)

### **Daily Development Process:**
```bash
# 1. Start the local development environment
./start_dev.sh
# Starts backend (localhost:10000) and frontend (localhost:5173)

# 2. Make changes and test locally
# 3. Commit and push to main when ready
git add -A && git commit -m "..." && git push origin main
# Render auto-deploys both services from main
```

---

## 🛡️ **Data Safety & Environment Configuration**

### **Environment Variables:**

#### **Development (`CDM_UI_Backend/.env.dev`, not committed):**
```bash
NEO4J_URI=neo4j+s://fbb04c5f.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=<set-locally>
ENVIRONMENT=development
NEO4J_INSTANCE_NAME=CDM_Dev
```

#### **Production (Render Environment Variables):**
```bash
NEO4J_URI=neo4j+s://abb4a9a8.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=<set-in-render-dashboard>
ENVIRONMENT=production
NEO4J_INSTANCE_NAME=CDM_Prod
DATABASE_URL=<postgres-connection-string>
```
> Secrets should live in Render's dashboard env vars (and local, gitignored `.env` files),
> not in committed source.

### **Data Safety Guarantees:**
- ✅ **No automatic data migrations** or schema changes
- ✅ **Environment separation** - dev and prod databases are completely separate
- ✅ **Code-only deployments** - only UI/UX and logic changes, never data changes
- ✅ **Production data protection** - CDM_Prod instance is never modified by deployments

---

## 🎯 **Key Components & APIs**

### **Frontend Architecture:**
- **React + TypeScript + Vite**
- **API Hooks**: `useObjects`, `useDrivers`, `useVariables`
- **Components**: DataGrid, MetadataPanel, AddObjectPanel, etc.
- **No fallback data** in production (shows empty state when no data)

### **Backend Architecture:**
- **FastAPI + Python**
- **Routes**: `/api/v1/objects`, `/api/v1/drivers`, `/api/v1/variables`, `/api/v1/lists`,
  `/api/v1/graph`, `/api/v1/metadata`, `/api/v1/heuristics`, `/api/v1/sources`, `/api/v1/order`
- **Neo4j Integration**: Direct connection to Aura instances
- **Environment Detection**: Automatically uses correct database based on environment

### **API Endpoints (sample):**
```
GET    /api/v1/objects              # Get all objects
POST   /api/v1/objects              # Create object
PUT    /api/v1/objects/{id}         # Update object
DELETE /api/v1/objects/{id}         # Delete object

GET    /api/v1/drivers/{type}       # Get drivers by type
GET    /api/v1/drivers/{type}/details # Get drivers with abbreviations
POST   /api/v1/drivers/{type}       # Create driver
PUT    /api/v1/drivers/{type}/{name} # Update driver
DELETE /api/v1/drivers/{type}/{name} # Delete driver

GET    /api/v1/variables            # Get all variables
POST   /api/v1/variables            # Create variable
PUT    /api/v1/variables/{id}       # Update variable
DELETE /api/v1/variables/{id}       # Delete variable
```

---

## 🔧 **Development Commands**

### **Start Development:**
```bash
./start_dev.sh
```

### **Deploy to Production:**
```bash
git checkout main
git add -A && git commit -m "..."
git push origin main
# Render auto-deploys both services (or use Manual Deploy in the Render dashboard)
```

### **Check Production Health:**
- Frontend: `https://cdm-frontend-8zl4.onrender.com`
- Backend: `https://cdm-backend.onrender.com/health`

### **View Logs:**
- Render Dashboard → service → **Logs** tab

---

## 🚨 **Important Notes for Development**

### **What's Safe to Change:**
- ✅ UI/UX components and styling
- ✅ API logic and endpoints
- ✅ Frontend state management
- ✅ Backend business logic
- ✅ Relationship logic (without changing existing data)

### **What's NOT Safe:**
- ❌ Database schema modifications
- ❌ Data migration scripts
- ❌ Automatic data seeding
- ❌ Changes that affect existing data structure

### **Empty State Handling:**
- **Production**: Shows "No values found — please add new items in the Metadata tab"
- **Development**: May show fallback data for testing

---

## 📞 **Troubleshooting**

### **Common Issues:**
1. **"No values found" in dropdowns** → Correct behavior for empty database
2. **Environment indicator not showing** → Check if on production URL
3. **API connection issues** → Check backend health endpoint
4. **Build failures** → Check for missing imports or TypeScript errors

### **Debug Steps:**
```bash
# Test local build
cd CDM_Frontend && npm run build

# Check backend locally
cd CDM_UI_Backend && python main.py
```
- Deployment status & logs: Render Dashboard → service → **Events** / **Logs**

---

## 🎯 **Quick Reference for New Chats**

**When starting a new chat, tell Cursor:**

> "I have a CDM platform with a React frontend and FastAPI backend deployed on Render.
> Production uses Neo4j Aura CDM_Prod instance; development uses CDM_Dev. Frontend is at
> https://cdm-frontend-8zl4.onrender.com and backend at https://cdm-backend.onrender.com.
> I develop and deploy from the 'main' branch (push to main auto-deploys via Render). The
> platform has Objects, Variables, Lists, and Drivers (Sectors/Domains/Countries/Clarifiers)
> — drivers are managed in the Metadata tab. All data is protected; only code changes are
> deployed, never data changes. Reference PLATFORM_OVERVIEW.md for full details."

**Key Files to Check:**
- `CDM_Frontend/src/App.tsx` - Main frontend component
- `CDM_UI_Backend/routes/objects.py` - Main backend logic
- `CDM_UI_Backend/db.py` - Database connection
- `PRODUCTION_DEPLOYMENT_GUIDE.md` - Deployment process
- `PLATFORM_OVERVIEW.md` - This overview

**Environment URLs:**
- Production frontend: `https://cdm-frontend-8zl4.onrender.com`
- Production backend: `https://cdm-backend.onrender.com`
- Development: `http://localhost:5173` (frontend) / `http://localhost:10000` (backend)
