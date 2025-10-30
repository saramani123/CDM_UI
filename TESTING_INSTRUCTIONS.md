# Testing the Identifiers Enhancement

## 🚀 Quick Start Guide

### Step 1: Start the Backend Server

Open Terminal 1 and run:
```bash
cd "/Users/romikapoor/CDM Screens/CDM_UI_Backend"
python3 main.py
```

You should see:
- ✅ Server starting on `http://localhost:8000`
- ✅ API docs at `http://localhost:8000/docs`
- ✅ Health check at `http://localhost:8000/health`

**Verify backend is running:**
- Open browser: http://localhost:8000/health
- Should return: `{"status":"ok","message":"CDM_U Backend is running"}`

---

### Step 2: Start the Frontend Server

Open Terminal 2 and run:
```bash
cd "/Users/romikapoor/CDM Screens/CDM_Frontend"
npm run dev
```

You should see:
- ✅ Vite dev server starting
- ✅ Frontend available at: `http://localhost:5173` (or similar port)

**Note:** If port 5173 is busy, Vite will use the next available port (like 5178, 5179, etc.)

---

### Step 3: Access the Application

1. **Frontend URL:** Open `http://localhost:5173` in your browser
   - (Check terminal output for exact port if different)

2. **Backend API:** Verify it's running at `http://localhost:8000`

---

## 🧪 Testing the Identifiers Feature

### Where to Test:

1. **Metadata Panel** (Single Object Edit):
   - Select any object from the Objects tab
   - Click on the object row to open Metadata panel
   - Expand the **"Identifiers"** section
   - You should see:
     - **Discrete ID** section with fixed Part="Identifier", Group="Public ID"
     - **Variable** multi-select dropdown
     - **Composite IDs** section with 5 rows

2. **Add Object Panel**:
   - Click "Add" button in Objects tab
   - Fill in required fields (Being, Avatar, Object Name, Drivers)
   - Expand the **"Identifiers"** section
   - Configure Discrete ID and/or Composite IDs

3. **Bulk Edit Panel**:
   - Select multiple objects (checkboxes)
   - Click "Edit Selected"
   - Expand the **"Identifiers"** section
   - Set identifiers that will override all selected objects

---

## 🔍 Troubleshooting "No Data" Issue

If you're seeing no data:

### Check Backend Connection:
1. Open browser console (F12)
2. Go to Network tab
3. Check if API calls to `localhost:8000` are failing
4. Look for CORS errors or connection errors

### Verify Backend is Running:
```bash
curl http://localhost:8000/health
```

Should return: `{"status":"ok","message":"CDM_U Backend is running"}`

### Check Neo4j Connection:
- Ensure Neo4j is running
- Check `.env` file has correct Neo4j credentials:
  ```
  NEO4J_URI=bolt://localhost:7687
  NEO4J_USER=neo4j
  NEO4J_PASSWORD=your_password
  ```

### Check Frontend Console:
- Open browser DevTools (F12)
- Look for errors in Console tab
- Check if variables/objects are loading

---

## 📝 Expected Behavior

### Discrete ID Section:
- Part field: Shows "Identifier" (disabled/non-editable)
- Group field: Shows "Public ID" (disabled/non-editable)
- Variable dropdown: Shows all variables where Part="Identifier" and Group="Public ID"
- "ALL" option: When selected, automatically selects all matching variables

### Composite IDs Section:
- Part dropdown: Shows all unique Part values from Variables tab
- Group dropdown: Only enabled after Part is selected, shows Groups for that Part
- Variable dropdown: Only enabled after Part and Group selected, shows Variables for that Part/Group combo
- Each row (1-5) is independent
- "ALL" option in Variable dropdown: Selects all variables for chosen Part/Group

---

## 🐛 Common Issues

1. **Port 5173 already in use:**
   - Vite will automatically use next available port (5174, 5175, etc.)
   - Check terminal output for actual port number

2. **Backend not responding:**
   - Make sure Python backend is running
   - Check if port 8000 is already in use
   - Verify `.env` file has correct Neo4j settings

3. **No variables shown in dropdowns:**
   - Ensure you have Variables created in the Variables tab
   - At least one Variable with Part="Identifier" and Group="Public ID" for Discrete ID
   - Variables with different Parts/Groups for Composite IDs

---

## 🔗 Key URLs

- **Frontend:** http://localhost:5173 (or port shown in terminal)
- **Backend API:** http://localhost:8000
- **Backend Docs:** http://localhost:8000/docs
- **Health Check:** http://localhost:8000/health


