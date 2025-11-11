# Quick Start: Run "ALL" Node Cleanup

## 🚀 Fastest Way (Render Shell)

1. **Go to Render Dashboard** → `cdm-backend` service
2. **Click "Shell" tab** (opens terminal)
3. **Run:**
   ```bash
   python fix_all_node_relationships.py
   ```
4. **Done!** Review the output to see what was fixed

## 📋 What You'll See

The script will show:
- ✅ Entities it's fixing
- ✅ Relationships being created
- ✅ "ALL" nodes being deleted
- ✅ Summary at the end

## ⚠️ Important

- **This is a one-time script** - you don't need to deploy it
- **It's safe to run multiple times** (idempotent)
- **It only fixes "ALL" node issues** - won't touch other data

## ✅ After Running

1. Check that "ALL" doesn't appear as a node in drivers list
2. Verify S, D, C columns show correct values
3. Verify "ALL" still works in multiselects (as UI convenience)

## 🐛 Troubleshooting

**Can't find Shell tab?**
- Make sure you're in the `cdm-backend` service (not frontend)
- Try refreshing the Render dashboard

**Script not found?**
- Make sure you're in the `CDM_UI_Backend` directory
- The script should be in the root of that directory

**Connection errors?**
- The script uses the same Neo4j credentials as your backend
- If backend works, script should work too

## 📚 Full Guide

See `RUN_CLEANUP_SCRIPT.md` for detailed instructions and alternative methods.

