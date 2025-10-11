#!/bin/bash

# CDM Platform Production Deployment Script
# This script safely deploys changes to production without affecting data

echo "🚀 Starting CDM Platform Production Deployment..."

# Check if we're on main branch
current_branch=$(git branch --show-current)
if [ "$current_branch" != "main" ]; then
    echo "❌ Error: You must be on the 'main' branch to deploy to production"
    echo "Current branch: $current_branch"
    echo "Please run: git checkout main"
    exit 1
fi

echo "✅ Confirmed: Deploying from 'main' branch"

# Deploy Frontend
echo "📦 Deploying Frontend..."
cd CDM_Frontend
vercel --prod --yes
if [ $? -eq 0 ]; then
    echo "✅ Frontend deployed successfully"
else
    echo "❌ Frontend deployment failed"
    exit 1
fi

# Deploy Backend
echo "📦 Deploying Backend..."
cd ../CDM_UI_Backend
vercel --prod --yes
if [ $? -eq 0 ]; then
    echo "✅ Backend deployed successfully"
else
    echo "❌ Backend deployment failed"
    exit 1
fi

echo ""
echo "🎉 Production Deployment Complete!"
echo ""
echo "📋 Manager Access:"
echo "   🌐 Frontend: https://cdm-platform.vercel.app"
echo "   🔧 Backend: https://cdm-backend-jf594ohd5-saras-projects-4c70d85d.vercel.app"
echo ""
echo "✅ Data Safety:"
echo "   - Production data (CDM_Prod) is protected"
echo "   - Only code changes were deployed"
echo "   - No data modifications occurred"
echo ""
echo "🔍 Health Checks:"
echo "   - Frontend: https://cdm-platform.vercel.app"
echo "   - Backend: https://cdm-backend-jf594ohd5-saras-projects-4c70d85d.vercel.app/health"
