from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routes import objects, drivers, variables, graph

app = FastAPI(
    title="CDM_U Backend API",
    description="Backend API for Canonical Data Model (CDM) management interface",
    version="1.0.0"
)

# Configure CORS to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(objects.router, prefix="/api/v1")
app.include_router(drivers.router, prefix="/api/v1")
app.include_router(variables.router, prefix="/api/v1")
app.include_router(graph.router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "message": "CDM_U Backend is running"}

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "CDM_U Backend API", 
        "version": "1.0.0",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    # Increased timeout for bulk uploads (600 seconds = 10 minutes)
    # This allows enough time for 1,400+ variable uploads with batching
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=10000,
        timeout_keep_alive=600,
        timeout_graceful_shutdown=600
    )
