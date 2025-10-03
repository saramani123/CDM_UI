// Visual graph query for Variable taxonomy structure
// Shows Parts -> Groups -> Variables relationships for Neo4j Browser visualization

MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v:Variable)
RETURN p, g, v;
