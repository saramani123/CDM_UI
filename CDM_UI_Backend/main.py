from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routes import objects, drivers, variables

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
    uvicorn.run(app, host="0.0.0.0", port=10000)
