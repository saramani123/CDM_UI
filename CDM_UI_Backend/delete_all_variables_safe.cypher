// ==========================================
// SAFE DELETE: Variables Only (CDM_Prod)
// ==========================================
// This query safely deletes ONLY Variables and their relationships
// WITHOUT touching Objects, Drivers, Part, Group, or other nodes
//
// SAFETY CHECKLIST:
// ✅ Only targets (:Variable) nodes
// ✅ Removes relationships FROM Variables only
// ✅ Preserves Objects, Drivers, Part, Group nodes
// ✅ Idempotent (safe to run multiple times)
// ✅ Uses DETACH DELETE to remove relationships automatically
//
// IMPORTANT: Run this in Neo4j Browser connected to CDM_Prod
// ==========================================

// STEP 1: Count variables before deletion (for verification)
MATCH (v:Variable)
RETURN count(v) as variables_to_delete;

// STEP 2: Count relationships that will be deleted
MATCH (v:Variable)
OPTIONAL MATCH (v)<-[r1:IS_RELEVANT_TO]-()
OPTIONAL MATCH (v)<-[r2:HAS_SPECIFIC_VARIABLE]-()
OPTIONAL MATCH (v)<-[r3:HAS_VARIABLE]-()
OPTIONAL MATCH (g:Group)-[r4:HAS_VARIABLE]->(v)
RETURN 
  count(DISTINCT v) as variable_nodes,
  count(r1) as driver_relationships,
  count(r2) as object_specific_relationships,
  count(r3) as object_general_relationships,
  count(r4) as group_relationships;

// STEP 3: SAFE DELETE - Remove all Variables and their relationships
// This query:
// - Deletes all Variable nodes
// - Automatically deletes ALL relationships connected to Variables (DETACH DELETE)
// - Does NOT delete Part, Group, Object, Driver nodes
// - Does NOT delete relationships between other node types
MATCH (v:Variable)
DETACH DELETE v;

// STEP 4: Verify deletion (should return 0)
MATCH (v:Variable)
RETURN count(v) as remaining_variables;

// STEP 5: Verify other nodes are intact
MATCH (o:Object)
RETURN count(o) as object_count;
MATCH (s:Sector)
RETURN count(s) as sector_count;
MATCH (d:Domain)
RETURN count(d) as domain_count;
MATCH (c:Country)
RETURN count(c) as country_count;
MATCH (p:Part)
RETURN count(p) as part_count;
MATCH (g:Group)
RETURN count(g) as group_count;
