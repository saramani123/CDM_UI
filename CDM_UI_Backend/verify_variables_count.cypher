// Verification queries to check if all data exists in Neo4j Aura
// Run these to verify the actual counts vs what's displayed

// 1. Count total Parts
MATCH (p:Part)
RETURN count(p) as totalParts;

// 2. Count total Groups
MATCH (g:Group)
RETURN count(g) as totalGroups;

// 3. Count total Variables
MATCH (v:Variable)
RETURN count(v) as totalVariables;

// 4. Count Parts with their Groups and Variables
MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v:Variable)
RETURN p.name as Part, count(DISTINCT g) as Groups, count(DISTINCT v) as Variables
ORDER BY Part;

// 5. List all Part names
MATCH (p:Part)
RETURN p.name as Part
ORDER BY Part;

// 6. Check if all Parts are connected
MATCH (p:Part)
OPTIONAL MATCH (p)-[:HAS_GROUP]->(g:Group)
RETURN p.name as Part, count(g) as GroupCount
ORDER BY Part;

