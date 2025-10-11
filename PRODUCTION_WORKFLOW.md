# 🚀 CDM Platform Production Workflow

## 📋 **Manager Access**

### **Stable Production URL for Manager:**
**`https://cdm-platform.vercel.app`**

This URL will **NEVER change** - it's your manager's permanent access point to the production CDM platform.

---

## 🔄 **Development Workflow**

### **Branch Strategy:**
- **`main`** → Production (auto-deploys to `cdm-platform.vercel.app`)
- **`dev`** → Development (local testing only)

### **Development Process:**

#### **1. Local Development:**
```bash
# Work on dev branch
git checkout dev

# Start local development
cd CDM_Frontend
npm run dev

# Start backend (separate terminal)
cd CDM_UI_Backend
python main.py
```

#### **2. Test Changes Locally:**
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Uses development Neo4j instance (CDM_Dev)

#### **3. Deploy to Production:**
```bash
# Switch to main branch
git checkout main

# Merge dev changes
git merge dev

# Deploy to production
cd CDM_Frontend
vercel --prod --yes

cd ../CDM_UI_Backend
vercel --prod --yes
```

---

## 🛡️ **Data Safety Guarantees**

### **✅ What's Protected:**
- **Production Neo4j data** (CDM_Prod) is never modified by deployments
- **Only code changes** are deployed, not data changes
- **Environment separation** ensures dev and prod databases stay separate

### **✅ What Updates Safely:**
- UI/UX improvements
- Bug fixes
- New features
- Performance optimizations
- Relationship logic (without changing existing data)

### **❌ What Never Happens:**
- No automatic data migrations
- No schema changes
- No data deletion or modification
- No mixing of dev and prod data

---

## 🔧 **Environment Configuration**

### **Development Environment:**
- **Frontend**: `http://localhost:5173`
- **Backend**: `http://localhost:8000`
- **Database**: CDM_Dev (Neo4j Aura)
- **Environment**: Development

### **Production Environment:**
- **Frontend**: `https://cdm-platform.vercel.app`
- **Backend**: `https://cdm-backend-jf594ohd5-saras-projects-4c70d85d.vercel.app`
- **Database**: CDM_Prod (Neo4j Aura)
- **Environment**: Production

---

## 📝 **Deployment Checklist**

### **Before Deploying to Production:**

1. **✅ Test Locally:**
   ```bash
   # Test frontend
   cd CDM_Frontend
   npm run build
   npm run preview
   
   # Test backend
   cd CDM_UI_Backend
   python main.py
   ```

2. **✅ Verify Environment Variables:**
   - Production uses CDM_Prod credentials
   - Development uses CDM_Dev credentials

3. **✅ Check Data Safety:**
   - No data migration scripts
   - No schema changes
   - Only code updates

### **Deployment Commands:**
```bash
# Deploy frontend
cd CDM_Frontend
vercel --prod --yes

# Deploy backend
cd CDM_UI_Backend
vercel --prod --yes
```

---

## 🚨 **Emergency Procedures**

### **If Production Issues Occur:**

1. **Rollback Frontend:**
   ```bash
   cd CDM_Frontend
   vercel rollback
   ```

2. **Rollback Backend:**
   ```bash
   cd CDM_UI_Backend
   vercel rollback
   ```

3. **Check Logs:**
   ```bash
   vercel logs --follow
   ```

---

## 📊 **Monitoring & Health Checks**

### **Production Health Check:**
- **Frontend**: `https://cdm-platform.vercel.app`
- **Backend**: `https://cdm-backend-jf594ohd5-saras-projects-4c70d85d.vercel.app/health`

### **Environment Indicators:**
- Production shows: "Environment: Production | Connected to Neo4j Aura (CDM_Prod)"
- Development shows: No environment indicator

---

## 🔐 **Security & Access**

### **Manager Access:**
- **URL**: `https://cdm-platform.vercel.app`
- **Database**: CDM_Prod (read/write access)
- **Environment**: Production

### **Developer Access:**
- **Local Development**: `http://localhost:5173`
- **Database**: CDM_Dev (separate instance)
- **Environment**: Development

---

## 📞 **Support & Troubleshooting**

### **Common Issues:**

1. **"No values found" in dropdowns:**
   - This is correct behavior for empty database
   - Add drivers in the Drivers tab to populate dropdowns

2. **Environment indicator not showing:**
   - Check if you're on production URL
   - Verify environment variables are set

3. **API connection issues:**
   - Check backend health: `/health` endpoint
   - Verify Neo4j credentials in Vercel dashboard

### **Debug Commands:**
```bash
# Check deployment status
vercel ls

# View logs
vercel logs

# Check environment variables
vercel env ls
```

---

## 🎯 **Summary**

**For Your Manager:**
- **Stable URL**: `https://cdm-platform.vercel.app`
- **Never changes** - always points to latest production
- **Safe data** - only code updates, never data changes

**For You (Developer):**
- **Local development** on `dev` branch
- **Test thoroughly** before merging to `main`
- **Deploy to production** when ready
- **Data stays safe** - no accidental modifications

**This workflow ensures your manager always has a stable, working platform while you can safely develop and deploy improvements without affecting production data.**
