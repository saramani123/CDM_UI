# CDM Platform Migration: Vercel → Render

## 🎯 **Migration Overview**
This guide safely migrates both frontend and backend from Vercel to Render while preserving all Neo4j data and maintaining production stability.

## 📋 **Pre-Migration Checklist**

### ✅ **Data Safety Verification**
- [ ] Neo4j Aura instance is accessible and healthy
- [ ] All existing data is backed up (optional but recommended)
- [ ] No schema changes will be made during migration
- [ ] Environment variables are documented

### ✅ **Current State**
- **Frontend**: Currently on Vercel (https://cdm-platform.vercel.app)
- **Backend**: Currently on Render (https://cdm-backend.onrender.com)
- **Database**: Neo4j Aura (production data preserved)

## 🚀 **Migration Steps**

### **Step 1: Deploy Backend to Render**
1. **Go to Render Dashboard**
2. **Create New Web Service**
3. **Connect to GitHub**: `saramani123/CDM_UI`
4. **Configure Backend Service**:
   - **Name**: `cdm-backend`
   - **Root Directory**: `CDM_UI_Backend`
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port 10000`
   - **Health Check Path**: `/health`

5. **Set Environment Variables**:
   ```
   ENVIRONMENT=production
   NEO4J_URI=neo4j+s://abb4a9a8.databases.neo4j.io
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=y79sZZXCcA-Jb26aeqjeYl2z4HAt9CWE5cYWQg8wxP8
   ```

6. **Deploy and Test**:
   - Wait for deployment to complete
   - Test health endpoint: `https://cdm-backend.onrender.com/health`
   - Verify Neo4j connection works
   - Test API endpoints

### **Step 2: Deploy Frontend to Render**
1. **Create New Static Web Service**
2. **Connect to GitHub**: `saramani123/CDM_UI`
3. **Configure Frontend Service**:
   - **Name**: `cdm-frontend`
   - **Root Directory**: `CDM_Frontend`
   - **Environment**: Static Site
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

4. **Set Environment Variables**:
   ```
   VITE_API_BASE_URL=https://cdm-backend.onrender.com/api/v1
   ```

5. **Configure Routes**:
   - Add rewrite rule: `/*` → `/index.html` (for React Router)

6. **Deploy and Test**:
   - Wait for deployment to complete
   - Test frontend loads correctly
   - Verify API calls work
   - Test all features (grid sort, driver columns, etc.)

### **Step 3: Update Domain Configuration**
1. **Update Custom Domain** (if applicable)
2. **Update DNS Records** to point to new Render services
3. **Test End-to-End** functionality

### **Step 4: Cleanup Vercel**
1. **Verify Render deployment is working**
2. **Update any external references**
3. **Remove Vercel deployments** (optional)

## 🔒 **Data Safety Guarantees**

### ✅ **What's Preserved**
- All Neo4j nodes and relationships
- Database schema and structure
- Production environment variables
- All existing data and relationships

### ❌ **What's NOT Changed**
- No database initialization code
- No schema migrations
- No data model changes
- No Neo4j configuration changes

### 🛡️ **Safety Measures**
- Backend uses same Neo4j credentials
- Environment set to `production`
- No database seeding or migration scripts
- Health checks verify connectivity

## 🧪 **Testing Checklist**

### **Backend Tests**
- [ ] Health endpoint: `/health`
- [ ] Root endpoint: `/`
- [ ] API endpoints: `/api/v1/objects`, `/api/v1/drivers`, `/api/v1/variables`
- [ ] Neo4j connection working
- [ ] CORS configuration correct

### **Frontend Tests**
- [ ] Page loads correctly
- [ ] API calls to backend work
- [ ] Grid wide sort functionality
- [ ] Driver column splits (Sector, Domain, Country)
- [ ] All CRUD operations work
- [ ] No console errors

### **End-to-End Tests**
- [ ] Data loads from Neo4j
- [ ] All features work as expected
- [ ] Performance is acceptable
- [ ] No data loss or corruption

## 📊 **Expected Results**

### **New URLs**
- **Frontend**: `https://cdm-frontend.onrender.com`
- **Backend**: `https://cdm-backend.onrender.com`
- **API Base**: `https://cdm-backend.onrender.com/api/v1`

### **Benefits**
- ✅ Unified deployment platform
- ✅ Better cost control
- ✅ Simplified management
- ✅ Consistent environment
- ✅ Auto-deploy from GitHub

## 🚨 **Rollback Plan**

If issues occur:
1. **Keep Vercel deployments active** until fully verified
2. **Update DNS** to point back to Vercel
3. **Investigate and fix** issues on Render
4. **Re-deploy** once issues are resolved

## 📞 **Support**

If you encounter any issues:
1. Check Render deployment logs
2. Verify environment variables
3. Test Neo4j connectivity
4. Check CORS configuration
5. Verify all endpoints are accessible

The migration is designed to be safe and reversible. All data and functionality will be preserved.
