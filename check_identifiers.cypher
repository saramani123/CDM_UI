// Neo4j Query to Check All Objects with Identifier Relationships
// VISUAL GRAPH QUERIES - These return nodes and relationships for graph visualization in Neo4j Browser

// Option 1 (GRAPH VIEW): Visualize all objects with their discrete IDs
// Returns: Objects, Variables, Parts, Groups, and their relationships
MATCH (o:Object)-[:HAS_DISCRETE_ID]->(v:Variable)
MATCH (p:Part {name: 'Identifier'})-[:HAS_GROUP]->(g:Group {name: 'Public ID'})-[:HAS_VARIABLE]->(v)
RETURN o, v, p, g;

// Option 2 (GRAPH VIEW): Visualize all objects with their composite IDs (all 5 types)
// Returns: Objects, Variables, Parts, Groups, and all composite ID relationships
MATCH (o:Object)-[r:HAS_COMPOSITE_ID_1|HAS_COMPOSITE_ID_2|HAS_COMPOSITE_ID_3|HAS_COMPOSITE_ID_4|HAS_COMPOSITE_ID_5]->(v:Variable)
MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v)
RETURN o, v, p, g, r;

// Option 1B: Visualize discrete IDs for a specific object (replace OBJECT_ID_HERE)
// MATCH (o:Object {id: 'OBJECT_ID_HERE'})-[:HAS_DISCRETE_ID]->(v:Variable)
// MATCH (p:Part {name: 'Identifier'})-[:HAS_GROUP]->(g:Group {name: 'Public ID'})-[:HAS_VARIABLE]->(v)
// RETURN o, v, p, g;

// Option 2B: Visualize composite IDs for a specific object (replace OBJECT_ID_HERE)
// MATCH (o:Object {id: 'OBJECT_ID_HERE'})-[r:HAS_COMPOSITE_ID_1|HAS_COMPOSITE_ID_2|HAS_COMPOSITE_ID_3|HAS_COMPOSITE_ID_4|HAS_COMPOSITE_ID_5]->(v:Variable)
// MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v)
// RETURN o, v, p, g, r;

// ========================================
// TABLE VIEW QUERIES (if you need tabular data)
// ========================================

// Option 3: Get a specific object's identifiers in table form (replace OBJECT_ID_HERE)
// MATCH (o:Object {id: 'OBJECT_ID_HERE'})
// OPTIONAL MATCH (o)-[:HAS_DISCRETE_ID]->(v1:Variable)
// OPTIONAL MATCH (p1:Part)-[:HAS_GROUP]->(g1:Group)-[:HAS_VARIABLE]->(v1)
// WHERE p1.name = 'Identifier' AND g1.name = 'Public ID'
// OPTIONAL MATCH (o)-[r:HAS_COMPOSITE_ID_1|HAS_COMPOSITE_ID_2|HAS_COMPOSITE_ID_3|HAS_COMPOSITE_ID_4|HAS_COMPOSITE_ID_5]->(v2:Variable)
// OPTIONAL MATCH (p2:Part)-[:HAS_GROUP]->(g2:Group)-[:HAS_VARIABLE]->(v2)
// RETURN o.id as objectId, o.being, o.avatar, o.object,
//        collect(DISTINCT {
//          type: 'DISCRETE_ID',
//          variableId: v1.id,
//          variableName: v1.name,
//          part: p1.name,
//          group: g1.name
//        }) as discreteIds,
//        collect(DISTINCT {
//          type: type(r),
//          variableId: v2.id,
//          variableName: v2.name,
//          part: p2.name,
//          group: g2.name
//        }) as compositeIds;

// Option 4: Count relationships per object (table view)
// MATCH (o:Object)
// OPTIONAL MATCH (o)-[:HAS_DISCRETE_ID]->(v1:Variable)
// OPTIONAL MATCH (o)-[r:HAS_COMPOSITE_ID_1|HAS_COMPOSITE_ID_2|HAS_COMPOSITE_ID_3|HAS_COMPOSITE_ID_4|HAS_COMPOSITE_ID_5]->(v2:Variable)
// RETURN o.id as objectId, o.being, o.avatar, o.object,
//        count(DISTINCT v1) as discreteIdCount,
//        count(DISTINCT r) as compositeIdCount
// ORDER BY o.id;

