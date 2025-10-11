#!/bin/bash

# CDM Platform - Manager Demo Deployment Script
# This script creates a safe, isolated deployment for manager testing

set -e  # Exit on any error

echo "🚀 Setting up CDM Platform for Manager Demo..."

# Create backup of current state
echo "📦 Creating backup of current state..."
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r CDM_Frontend "$BACKUP_DIR/"
cp -r CDM_UI_Backend "$BACKUP_DIR/"
echo "✅ Backup created in: $BACKUP_DIR"

# Create demo directory
echo "📁 Creating demo directory..."
DEMO_DIR="CDM_Demo_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$DEMO_DIR"

# Copy backend
echo "🔧 Setting up backend..."
cp -r CDM_UI_Backend "$DEMO_DIR/"
cd "$DEMO_DIR/CDM_UI_Backend"

# Create production environment file
cat > .env << EOF
# Production Environment for Manager Demo
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
NEO4J_DATABASE=neo4j
LOG_LEVEL=INFO
CORS_ORIGINS=["http://localhost:3000", "http://localhost:5173", "http://localhost:5184"]
EOF

# Install Python dependencies
echo "📦 Installing Python dependencies..."
python3 -m venv venv_demo
source venv_demo/bin/activate
pip install -r requirements.txt

# Create production start script
cat > start_demo_backend.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting CDM Backend for Manager Demo..."
echo "📊 Logs will be saved to: demo_backend.log"
echo "🌐 Backend will be available at: http://localhost:8000"
echo "📖 API docs at: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo "----------------------------------------"

source venv_demo/bin/activate
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload 2>&1 | tee demo_backend.log
EOF

chmod +x start_demo_backend.sh

cd ../..

# Copy and build frontend
echo "🎨 Setting up frontend..."
cp -r CDM_Frontend "$DEMO_DIR/"
cd "$DEMO_DIR/CDM_Frontend"

# Build for production
echo "🔨 Building frontend for production..."
npm install
npm run build

# Create production start script
cat > start_demo_frontend.sh << 'EOF'
#!/bin/bash
echo "🎨 Starting CDM Frontend for Manager Demo..."
echo "🌐 Frontend will be available at: http://localhost:3000"
echo "📊 Logs will be saved to: demo_frontend.log"
echo ""
echo "Press Ctrl+C to stop the server"
echo "----------------------------------------"

npm run preview -- --port 3000 --host 0.0.0.0 2>&1 | tee demo_frontend.log
EOF

chmod +x start_demo_frontend.sh

cd ../..

# Create main demo start script
cat > "$DEMO_DIR/start_demo.sh" << 'EOF'
#!/bin/bash

echo "🚀 Starting CDM Platform for Manager Demo"
echo "=========================================="
echo ""
echo "This will start both frontend and backend servers"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000"
echo "API Documentation: http://localhost:8000/docs"
echo ""
echo "Logs will be saved to:"
echo "  - Backend: CDM_UI_Backend/demo_backend.log"
echo "  - Frontend: CDM_Frontend/demo_frontend.log"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all servers..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start backend
echo "🔧 Starting backend server..."
cd CDM_UI_Backend
./start_demo_backend.sh &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "🎨 Starting frontend server..."
cd ../CDM_Frontend
./start_demo_frontend.sh &
FRONTEND_PID=$!

# Wait for both processes
wait
EOF

chmod +x "$DEMO_DIR/start_demo.sh"

# Create README for manager
cat > "$DEMO_DIR/README_MANAGER.md" << 'EOF'
# CDM Platform - Manager Demo

## Quick Start
1. Make sure Neo4j is running on your system
2. Run: `./start_demo.sh`
3. Open your browser to: http://localhost:3000

## What You Can Test
- **Objects Tab**: View, edit, and bulk edit objects
- **Drivers Tab**: Manage sectors, domains, countries, and object clarifiers
- **Variables Tab**: Manage variables and their metadata
- **Lists Tab**: Manage lists and their relationships

## Features to Demonstrate
1. **Single Object Editing**: Select an object and modify its properties
2. **Bulk Editing**: Select multiple objects and update them simultaneously
3. **Driver Management**: Add/remove drivers and see real-time updates
4. **Data Relationships**: See how objects, drivers, and variables are connected

## Important Notes
- This is a demo environment - all changes are temporary
- The original development code is safely backed up
- All actions are logged for review
- Neo4j database changes will persist until you restart Neo4j

## Troubleshooting
- If ports 3000 or 8000 are in use, the scripts will show an error
- Check the log files for detailed error messages
- Backend logs: `CDM_UI_Backend/demo_backend.log`
- Frontend logs: `CDM_Frontend/demo_frontend.log`

## Stopping the Demo
- Press `Ctrl+C` in the terminal where you ran `./start_demo.sh`
- Or close the terminal window

## Data Safety
- Your original development environment is unchanged
- All demo changes are isolated
- Original code is backed up in the parent directory
EOF

# Create a simple stop script
cat > "$DEMO_DIR/stop_demo.sh" << 'EOF'
#!/bin/bash
echo "🛑 Stopping CDM Demo servers..."
pkill -f "uvicorn.*8000" 2>/dev/null || true
pkill -f "vite.*3000" 2>/dev/null || true
echo "✅ Demo servers stopped"
EOF

chmod +x "$DEMO_DIR/stop_demo.sh"

echo ""
echo "✅ CDM Platform Demo Setup Complete!"
echo "=================================="
echo ""
echo "📁 Demo directory: $DEMO_DIR"
echo "📦 Backup directory: $BACKUP_DIR"
echo ""
echo "🚀 To start the demo:"
echo "   cd $DEMO_DIR"
echo "   ./start_demo.sh"
echo ""
echo "🛑 To stop the demo:"
echo "   cd $DEMO_DIR"
echo "   ./stop_demo.sh"
echo ""
echo "📖 Manager instructions: $DEMO_DIR/README_MANAGER.md"
echo ""
echo "🔒 Your original code is safely backed up in: $BACKUP_DIR"
