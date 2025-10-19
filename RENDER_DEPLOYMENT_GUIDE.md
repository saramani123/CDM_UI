# Render Backend Deployment Guide

## Overview
This guide sets up the CDM backend on Render with auto-deploy from GitHub.

## Prerequisites
- Render account (free tier)
- GitHub repository: `saramani123/CDM_UI`
- Neo4j Aura credentials

## Render Service Configuration

### 1. Service Settings
- **Name**: `cdm-backend`
- **Type**: Web Service
- **Environment**: Python 3
- **Plan**: Starter (Free)
- **Region**: Oregon (US West)

### 2. Build & Deploy Settings
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `python main.py`
- **Root Directory**: `CDM_UI_Backend`

### 3. Environment Variables
Set these in Render dashboard:

```
ENVIRONMENT=production
NEO4J_INSTANCE_NAME=vulqan-cdm-prod
NEO4J_URI=neo4j+s://your-instance-id.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_aura_password_here
```

### 4. Auto-Deploy Configuration
- **Repository**: `saramani123/CDM_UI`
- **Branch**: `main`
- **Auto-Deploy**: Enabled
- **Root Directory**: `CDM_UI_Backend`

## Frontend Configuration

### Frontend Environment Variables
Set in Render dashboard for `cdm-frontend`:

```
VITE_API_BASE_URL=https://cdm-backend.onrender.com/api/v1
```

## Testing Deployment

### 1. Test Backend
```bash
python test_render_deployment.py
```

### 2. Test Frontend Connection
- Visit: https://cdm-frontend-8zl4.onrender.com
- Check browser console for API calls
- Verify data loads from Render backend

## Deployment Flow

### Backend Changes
1. Push to `main` branch
2. Render auto-detects changes
3. Builds and deploys automatically
4. Available at: https://cdm-backend.onrender.com

### Frontend Changes
1. Push to `main` branch
2. Render auto-detects changes
3. Builds and deploys automatically
4. Available at: https://cdm-frontend-8zl4.onrender.com

## Health Checks

### Backend Health
- **URL**: https://cdm-backend.onrender.com/health
- **Expected**: `{"status": "ok", "message": "CDM_U Backend is running"}`

### API Endpoints
- **Objects**: https://cdm-backend.onrender.com/api/v1/objects
- **Drivers**: https://cdm-backend.onrender.com/api/v1/drivers
- **Variables**: https://cdm-backend.onrender.com/api/v1/variables

## Troubleshooting

### Common Issues
1. **Backend not starting**: Check environment variables
2. **Neo4j connection failed**: Verify credentials and URI
3. **CORS errors**: Backend CORS is configured for all origins
4. **Frontend can't connect**: Check VITE_API_BASE_URL

### Render Logs
- View logs in Render dashboard
- Check for Python errors
- Verify environment variables

### Vercel Logs
- View deployment logs in Vercel dashboard
- Check build process
- Verify environment variables

## Cost Optimization

### Render (Backend)
- **Plan**: Starter (Free)
- **Limitations**: 750 hours/month, sleeps after 15min inactivity
- **Wake-up time**: ~30 seconds

### Vercel (Frontend)
- **Plan**: Hobby (Free)
- **Limitations**: 100GB bandwidth/month
- **Performance**: Global CDN

## Security Notes

- Neo4j credentials stored as environment variables
- CORS configured for production
- No hardcoded secrets in code
- HTTPS enforced on both services
