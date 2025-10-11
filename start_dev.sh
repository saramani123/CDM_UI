#!/bin/bash

# CDM Platform Development Startup Script
# This script starts the development environment

echo "🔧 Starting CDM Platform Development Environment..."

# Check if we're on dev branch
current_branch=$(git branch --show-current)
if [ "$current_branch" != "dev" ]; then
    echo "⚠️  Warning: You're not on the 'dev' branch"
    echo "Current branch: $current_branch"
    echo "For development, run: git checkout dev"
fi

echo "✅ Starting development servers..."

# Start Backend (in background)
echo "🚀 Starting Backend Server..."
cd CDM_UI_Backend
python main.py &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start Frontend
echo "🚀 Starting Frontend Server..."
cd ../CDM_Frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "🎉 Development Environment Started!"
echo ""
echo "📋 Development URLs:"
echo "   🌐 Frontend: http://localhost:5173"
echo "   🔧 Backend: http://localhost:8000"
echo "   📊 Backend Health: http://localhost:8000/health"
echo ""
echo "🗄️  Database: CDM_Dev (Development Neo4j instance)"
echo "🔧 Environment: Development (no environment indicator)"
echo ""
echo "🛑 To stop development servers:"
echo "   Press Ctrl+C or run: kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "📝 Development Workflow:"
echo "   1. Make changes in your code"
echo "   2. Test locally"
echo "   3. When ready: git checkout main && git merge dev"
echo "   4. Deploy: ./deploy_to_production.sh"

# Keep script running
wait
