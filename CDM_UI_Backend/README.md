# CDM_U Backend

Backend API for the Canonical Data Model (CDM) management interface.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment variables:
```bash
cp env.example .env
# Edit .env with your Neo4j credentials
```

3. Run the development server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

## API Documentation

- Interactive API docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

## Environment Variables

- `NEO4J_URI`: Neo4j database URI (default: bolt://localhost:7687)
- `NEO4J_USERNAME`: Neo4j username (default: neo4j)
- `NEO4J_PASSWORD`: Neo4j password

## Current Endpoints

- `GET /api/v1/objects` - Get all objects (dummy data)
- `GET /api/v1/objects/{id}` - Get specific object
- `POST /api/v1/objects` - Create new object
- `PUT /api/v1/objects/{id}` - Update object
- `DELETE /api/v1/objects/{id}` - Delete object

## Next Steps

- Replace dummy data with actual Neo4j queries
- Add endpoints for Variables, Lists, Drivers, etc.
- Implement CSV upload functionality
- Add graph visualization endpoints
