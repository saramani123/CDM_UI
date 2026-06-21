#!/bin/bash

# CDM Platform Development Startup Script
# This script starts the development environment

echo "🔧 Starting CDM Platform Development Environment..."

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
echo "   🌐 Frontend: http://localhost:5178"
echo "   🔧 Backend: http://localhost:10000"
echo "   📊 Backend Health: http://localhost:10000/health"
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
echo "   3. When ready: git add -A && git commit && git push origin main"
echo "   4. Render auto-deploys both services from main"

# Keep script running
wait
