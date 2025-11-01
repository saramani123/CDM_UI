// ==========================================
// QUERIES TO VERIFY RELATIONSHIPS IN NEO4J
// ==========================================
// Run these in Neo4j Browser (http://localhost:7474 or your Neo4j instance)

// 1. GET A VARIABLE ID TO TEST
// Run this first to get a variable ID
MATCH (v:Variable)
RETURN v.id as variable_id, v.variable as variable_name, v.part as part, v.section as section
LIMIT 10

// 2. COUNT ALL HAS_SPECIFIC_VARIABLE RELATIONSHIPS
MATCH ()-[r:HAS_SPECIFIC_VARIABLE]->()
RETURN count(r) as total_relationships

// 3. FIND RELATIONSHIPS FOR A SPECIFIC VARIABLE (replace with actual variable ID)
MATCH (v:Variable {id: 'YOUR_VARIABLE_ID_HERE'})<-[r:HAS_SPECIFIC_VARIABLE]-(o:Object)
RETURN v.id as variable_id, v.variable as variable_name, 
       o.id as object_id, o.being as being, o.avatar as avatar, o.object as object_name,
       o.driver as driver, r.createdBy as created_by, ID(r) as relationship_id
ORDER BY o.object

// 4. VISUAL GRAPH - Shows relationships as a graph (replace variable ID)
MATCH (v:Variable {id: 'YOUR_VARIABLE_ID_HERE'})<-[r:HAS_SPECIFIC_VARIABLE]-(o:Object)
RETURN v, o, r

// 5. CHECK ALL RECENT RELATIONSHIPS CREATED BY FRONTEND
MATCH (o:Object)-[r:HAS_SPECIFIC_VARIABLE]->(v:Variable)
WHERE r.createdBy = 'frontend'
RETURN v.id as variable_id, v.variable as variable_name,
       o.id as object_id, o.being as being, o.avatar as avatar, o.object as object_name,
       o.driver as driver, r.createdBy as created_by
ORDER BY v.variable, o.object
LIMIT 50

// 6. CHECK IF SPECIFIC OBJECTS EXIST (test with actual values)
MATCH (o:Object {being: 'bug', avatar: 'Account', object: 'Bank Account'})
RETURN o.id, o.being, o.avatar, o.object, o.driver

// 7. CHECK IF VARIABLE EXISTS
MATCH (v:Variable {id: 'YOUR_VARIABLE_ID_HERE'})
RETURN v.id, v.variable, v.part, v.section, v.group

// 8. FIND ALL OBJECTS THAT SHOULD HAVE RELATIONSHIPS (based on being/avatar/object)
MATCH (o:Object {being: 'bug', avatar: 'Account', object: 'Bank Account'})
MATCH (v:Variable {id: 'YOUR_VARIABLE_ID_HERE'})
OPTIONAL MATCH (o)-[r:HAS_SPECIFIC_VARIABLE]->(v)
RETURN o.id as object_id, o.being, o.avatar, o.object,
       CASE WHEN r IS NOT NULL THEN 'HAS RELATIONSHIP' ELSE 'NO RELATIONSHIP' END as status,
       ID(r) as relationship_id

// 9. DELETE ALL RELATIONSHIPS FOR TESTING (USE WITH CAUTION!)
// MATCH ()-[r:HAS_SPECIFIC_VARIABLE]->()
// DELETE r
// RETURN count(r) as deleted_count

