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
│   └── vercel.json       # Vercel deployment config
├── CDM_UI_Backend/       # FastAPI backend
│   ├── routes/           # API endpoints (objects, drivers, variables)
│   ├── db.py            # Neo4j connection logic
│   └── vercel.json      # Vercel deployment config
└── Production Scripts/
    ├── deploy_to_production.sh
    ├── start_dev.sh
    └── PRODUCTION_WORKFLOW.md
```

---

## 🗄️ **Database Architecture**

### **Neo4j Aura Instances:**
- **CDM_Dev** (Development): `neo4j+s://fbb04c5f.databases.neo4j.io`
- **CDM_Prod** (Production): `neo4j+s://abb4a9a8.databases.neo4j.io`

### **Data Model:**
```
Nodes: Object, Variable, List, Driver (Sector/Domain/Country/Clarifier)
Relationships: RELEVANT_TO, HAS_VARIABLE, etc.
```

### **Environment Separation:**
- **Development**: Uses CDM_Dev instance (safe for testing)
- **Production**: Uses CDM_Prod instance (manager's data)
- **No data mixing** between environments

---

## 🌐 **Deployment Architecture**

### **Production URLs (Stable for Manager):**
- **Frontend**: `https://cdm-platform.vercel.app` (custom domain)
- **Backend**: `https://cdm-backend-jf594ohd5-saras-projects-4c70d85d.vercel.app`

### **Development URLs:**
- **Frontend**: `http://localhost:5173`
- **Backend**: `http://localhost:8000`

### **Environment Detection:**
- **Production**: Shows blue indicator "Environment: Production | Connected to Neo4j Aura (CDM_Prod)"
- **Development**: No environment indicator

---

## 🔄 **Development Workflow**

### **Branch Strategy:**
- **`main`** → Production deployment
- **`dev`** → Development work

### **Daily Development Process:**
```bash
# 1. Switch to dev branch
git checkout dev

# 2. Start development environment
./start_dev.sh
# This starts both frontend (localhost:5173) and backend (localhost:8000)

# 3. Make changes and test locally
# 4. When ready to deploy...
```

### **Production Deployment Process:**
```bash
# 1. Switch to main branch
git checkout main

# 2. Merge dev changes
git merge dev

# 3. Deploy to production
./deploy_to_production.sh
# This deploys both frontend and backend to Vercel
```

---

## 🛡️ **Data Safety & Environment Configuration**

### **Environment Variables:**

#### **Development (.env.dev):**
```bash
NEO4J_URI=neo4j+s://fbb04c5f.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=myL_IZIr6KbqlJNcXZVqqVQW4Qh9wXnH4nTZp_elcqk
ENVIRONMENT=development
NEO4J_INSTANCE_NAME=CDM_Dev
```

#### **Production (Vercel Environment Variables):**
```bash
NEO4J_URI=neo4j+s://abb4a9a8.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=y79sZZXCcA-Jb26aeqjeYl2z4HAt9CWE5cYWQg8wxP8
ENVIRONMENT=production
NEO4J_INSTANCE_NAME=CDM_Prod
```

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
- **Routes**: `/api/v1/objects`, `/api/v1/drivers`, `/api/v1/variables`
- **Neo4j Integration**: Direct connection to Aura instances
- **Environment Detection**: Automatically uses correct database based on environment

### **API Endpoints:**
```
GET    /api/v1/objects              # Get all objects
POST   /api/v1/objects              # Create object
PUT    /api/v1/objects/{id}         # Update object
DELETE /api/v1/objects/{id}         # Delete object

GET    /api/v1/drivers/{type}       # Get drivers by type
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
git checkout dev
./start_dev.sh
```

### **Deploy to Production:**
```bash
git checkout main
git merge dev
./deploy_to_production.sh
```

### **Check Production Health:**
- Frontend: `https://cdm-platform.vercel.app`
- Backend: `https://cdm-backend-jf594ohd5-saras-projects-4c70d85d.vercel.app/health`

### **View Logs:**
```bash
vercel logs --follow
```

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

### **Environment Indicators:**
- **Production**: Blue indicator in bottom-right corner
- **Development**: No indicator (clean UI)

### **Empty State Handling:**
- **Production**: Shows "No values found — please add new items in Drivers tab"
- **Development**: May show fallback data for testing

---

## 📞 **Troubleshooting**

### **Common Issues:**
1. **"No values found" in dropdowns** → Correct behavior for empty database
2. **Environment indicator not showing** → Check if on production URL
3. **API connection issues** → Check backend health endpoint
4. **Build failures** → Check for missing imports or TypeScript errors

### **Debug Commands:**
```bash
# Check deployment status
vercel ls

# View logs
vercel logs

# Check environment variables
vercel env ls

# Test local build
cd CDM_Frontend && npm run build
```

---

## 🎯 **Quick Reference for New Chats**

**When starting a new chat, tell Cursor:**

> "I have a CDM platform with React frontend and FastAPI backend deployed on Vercel. Production uses Neo4j Aura CDM_Prod instance, development uses CDM_Dev. The manager accesses via https://cdm-platform.vercel.app. I develop on 'dev' branch and deploy from 'main' branch. The platform has Objects, Variables, Lists, and Drivers (Sectors/Domains/Countries/Clarifiers) with relationship management. All data is protected - only code changes are deployed, never data changes. Reference PLATFORM_OVERVIEW.md for full details."

**Key Files to Check:**
- `CDM_Frontend/src/App.tsx` - Main frontend component
- `CDM_UI_Backend/routes/objects.py` - Main backend logic
- `CDM_UI_Backend/db.py` - Database connection
- `PRODUCTION_WORKFLOW.md` - Deployment process
- `PLATFORM_OVERVIEW.md` - This overview

**Environment URLs:**
- Production: `https://cdm-platform.vercel.app`
- Development: `http://localhost:5173`
- Backend: `http://localhost:8000` (dev) / Vercel URL (prod)
