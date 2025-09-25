#!/bin/bash

# CDM_U Backend Startup Script

echo "Starting CDM_U Backend..."
echo "Make sure you have configured your .env file with Neo4j credentials"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Warning: .env file not found. Copy env.example to .env and configure your Neo4j credentials."
    echo "cp env.example .env"
    echo ""
fi

# Start the FastAPI server
echo "Starting server on http://localhost:8000"
echo "API docs available at http://localhost:8000/docs"
echo "Health check at http://localhost:8000/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python3 main.py
