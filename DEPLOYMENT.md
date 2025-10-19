# CDM Platform Deployment Guide

## Overview
This guide covers deploying the Canonical Data Model (CDM) platform to Render with proper environment separation.

## Environment Configuration

### Development Environment (.env.dev)
```bash
# Neo4j Development Database (cdm-dev)
NEO4J_URI=neo4j+s://your-dev-instance-id.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_dev_password_here
ENVIRONMENT=development
NEO4J_INSTANCE_NAME=cdm-dev
```

### Production Environment (Render Environment Variables)
Set these in your Render dashboard for both services:

**Backend Service:**
```bash
NEO4J_URI=neo4j+s://your-prod-instance-id.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_prod_password_here
ENVIRONMENT=production
NEO4J_INSTANCE_NAME=vulqan-cdm-prod
```

**Frontend Service:**
```bash
VITE_API_BASE_URL=https://cdm-backend.onrender.com/api/v1
```

## Deployment Steps

### 1. Backend Deployment (Render)
1. Create a new Web Service in Render:
   - Connect to `saramani123/CDM_UI` repository
   - Set Root Directory to `CDM_UI_Backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port 10000`

2. Set environment variables in Render dashboard:
   - Add the production Neo4j credentials
   - Set `ENVIRONMENT=production`
   - Set `NEO4J_INSTANCE_NAME=vulqan-cdm-prod`

### 2. Frontend Deployment (Render)
1. Create a new Static Site in Render:
   - Connect to `saramani123/CDM_UI` repository
   - Set Root Directory to `CDM_Frontend`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`

2. Set environment variables:
   - `VITE_API_BASE_URL` = your backend URL from step 1

### 3. Branch Configuration
- `main` branch → Production deployment (auto-deploys to Render)
- `dev` branch → Development (local only)

## Testing Checklist

Before pushing to production:

1. ✅ Backend connection test:
   ```bash
   cd CDM_UI_Backend
   python -c "from db import neo4j_conn; print('✅ Connected' if neo4j_conn.connect() else '❌ Failed')"
   ```

2. ✅ Frontend-backend connection test:
   - Start backend: `cd CDM_UI_Backend && python main.py`
   - Start frontend: `cd CDM_Frontend && npm run dev`
   - Test API calls in browser

3. ✅ Production environment indicator:
   - Should show "Environment: Production | Connected to Neo4j Aura (vulqan-cdm-prod)" in bottom-right corner

## Security Notes

- Never commit `.env` files to git
- Use Vercel environment variables for production secrets
- Keep development and production databases completely separate
- No automatic data migrations or schema changes

## Troubleshooting

### Backend Connection Issues
- Check Neo4j Aura instance is running
- Verify credentials in Vercel environment variables
- Check network connectivity

### Frontend API Issues
- Verify `VITE_API_BASE_URL` is set correctly
- Check CORS configuration in backend
- Ensure backend is deployed and accessible

### Environment Indicator Not Showing
- Check `import.meta.env.PROD` is true in production
- Verify Vite build configuration
- Check browser console for errors
