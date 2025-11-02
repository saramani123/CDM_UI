// Verification queries for IS_RELEVANT_TO relationships

// 1. Count total relationships
MATCH (v:Variable)<-[r:IS_RELEVANT_TO]-(d)
RETURN 
  count(r) as totalRelationships,
  count(DISTINCT v) as variablesWithRelationships,
  count(DISTINCT d) as driverNodesWithRelationships;

// 2. Show relationships by driver type
MATCH (d)-[r:IS_RELEVANT_TO]->(v:Variable)
RETURN 
  type(d) as driverType,
  count(r) as relationshipCount
ORDER BY driverType;

// 3. Show sample relationships (first 20)
MATCH (d)-[r:IS_RELEVANT_TO]->(v:Variable)
RETURN 
  type(d) as driverType,
  d.name as driverName,
  v.name as variableName,
  v.id as variableId
ORDER BY driverType, driverName
LIMIT 20;

// 4. Check a specific variable (replace with actual variable name)
MATCH (v:Variable {name: "Purchase Price"})<-[r:IS_RELEVANT_TO]-(d)
RETURN 
  type(d) as driverType,
  d.name as driverName,
  type(r) as relationshipType;

// 5. Visualize relationships (graph view - run in Neo4j Browser)
MATCH path = (d)-[r:IS_RELEVANT_TO]->(v:Variable)
WHERE type(d) IN ['Sector', 'Domain', 'Country', 'VariableClarifier']
RETURN path
LIMIT 50;

// 6. Find variables WITHOUT relationships (should be 0 or 1 after migration)
MATCH (v:Variable)
WHERE NOT EXISTS {
  MATCH (v)<-[:IS_RELEVANT_TO]-()
}
RETURN 
  v.id as variableId,
  v.name as variableName,
  v.driver as driverString
ORDER BY v.name
LIMIT 10;


