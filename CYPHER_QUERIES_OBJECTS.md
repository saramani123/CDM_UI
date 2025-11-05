# Cypher Queries for Objects - Metadata Panel & Bulk Edit Panel

## Frontend Dev Link
**URL:** `http://localhost:5178`

---

## Metadata Panel - GET /objects/{object_id}

### 1. Get Object Basic Data
```cypher
MATCH (o:Object {id: $object_id})
RETURN o.id as id, o.driver as driver, o.being as being,
       o.avatar as avatar, o.object as object, o.status as status
```

### 2. Get Relationship Count
```cypher
MATCH (o:Object {id: $object_id})-[:RELATES_TO]->(other:Object)
RETURN count(other) as rel_count
```

### 3. Get Variant Count
```cypher
MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
RETURN count(v) as var_count
```

### 4. Get Variables Count
```cypher
MATCH (o:Object {id: $object_id})-[:HAS_SPECIFIC_VARIABLE]->(var:Variable)
RETURN count(var) as variables_count
```

### 5. Get Relationships List
```cypher
MATCH (o:Object {id: $object_id})-[r:RELATES_TO]->(other:Object)
RETURN r.id as id, r.type as type, r.role as role,
       other.being as toBeing, other.avatar as toAvatar, other.object as toObject
```

### 6. Get Variants List
```cypher
MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
RETURN v.name as name
```

### 7. Get Discrete/Unique ID Relationships
```cypher
MATCH (o:Object {id: $object_id})-[:HAS_UNIQUE_ID|HAS_DISCRETE_ID]->(v:Variable)
MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v)
RETURN v.id as variableId, v.name as variableName, p.name as part, g.name as group
```

### 8. Get Composite ID Relationships (1-5)
```cypher
MATCH (o:Object {id: $object_id})-[:HAS_COMPOSITE_ID_{i}]->(v:Variable)
MATCH (p:Part)-[:HAS_GROUP]->(g:Group)-[:HAS_VARIABLE]->(v)
RETURN v.id as variableId, v.name as variableName, p.name as part, g.name as group
```
*Note: `{i}` is replaced with 1, 2, 3, 4, or 5*

---

## Metadata Panel - PUT /objects/{object_id}

### 1. Check Object Exists
```cypher
MATCH (o:Object {id: $object_id})
RETURN o
```

### 2. Update Driver String
```cypher
MATCH (o:Object {id: $object_id})
SET o.driver = $driver
```

### 3. Clear Existing Driver Relationships
```cypher
MATCH (o:Object {id: $object_id})<-[r:RELEVANT_TO]-(d)
WHERE d:Sector OR d:Domain OR d:Country OR d:ObjectClarifier
DELETE r
```

### 4. Create Sector Relationships (ALL)
```cypher
MATCH (s:Sector)
MATCH (o:Object {id: $object_id})
WITH s, o
CREATE (s)-[:RELEVANT_TO]->(o)
```

### 5. Create Sector Relationships (Specific)
```cypher
MATCH (s:Sector {name: $sector})
MATCH (o:Object {id: $object_id})
WITH s, o
CREATE (s)-[:RELEVANT_TO]->(o)
RETURN s.name as name
```

### 6. Create Domain Relationships (ALL)
```cypher
MATCH (d:Domain)
MATCH (o:Object {id: $object_id})
WITH d, o
CREATE (d)-[:RELEVANT_TO]->(o)
```

### 7. Create Domain Relationships (Specific)
```cypher
MATCH (d:Domain {name: $domain})
MATCH (o:Object {id: $object_id})
WITH d, o
CREATE (d)-[:RELEVANT_TO]->(o)
RETURN d.name as name
```

### 8. Create Country Relationships (ALL)
```cypher
MATCH (c:Country)
MATCH (o:Object {id: $object_id})
WITH c, o
CREATE (c)-[:RELEVANT_TO]->(o)
```

### 9. Create Country Relationships (Specific)
```cypher
MATCH (c:Country {name: $country})
MATCH (o:Object {id: $object_id})
WITH c, o
CREATE (c)-[:RELEVANT_TO]->(o)
```

### 10. Create Object Clarifier Relationship
```cypher
MATCH (oc:ObjectClarifier {name: $clarifier})
MATCH (o:Object {id: $object_id})
WITH oc, o
CREATE (oc)-[:RELEVANT_TO]->(o)
```

### 11. Update Basic Fields (being, avatar, object, etc.)
```cypher
MATCH (o:Object {id: $object_id})
SET o.being = $being, o.avatar = $avatar, o.object = $object
```
*Note: Fields are dynamically added based on what's provided*

### 12. Verify Update
```cypher
MATCH (o:Object {id: $object_id})
RETURN o.being as being, o.avatar as avatar, o.object as object
```

### 13. Delete Existing Relationships
```cypher
MATCH (o:Object {id: $object_id})-[r:RELATES_TO]->(other:Object)
DELETE r
```

### 14. Delete Existing Variants
```cypher
MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
DETACH DELETE v
```

### 15. Find Target Objects for Relationship
```cypher
MATCH (target:Object)
WHERE target.being = $to_being AND target.avatar = $to_avatar AND target.object = $to_object
RETURN target.id as target_id, target.being as being, target.avatar as avatar, target.object as object
```
*Note: WHERE clause is built dynamically - "ALL" values are omitted*

### 16. Create RELATES_TO Relationship
```cypher
MATCH (source:Object {id: $source_id})
MATCH (target:Object {id: $target_id})
CREATE (source)-[:RELATES_TO {
    id: $relationship_id,
    type: $relationship_type,
    role: $role,
    toBeing: $to_being,
    toAvatar: $to_avatar,
    toObject: $to_object
}]->(target)
```

### 17. Check Variant Exists for Object
```cypher
MATCH (o:Object {id: $object_id})-[:HAS_VARIANT]->(v:Variant)
WHERE toLower(v.name) = toLower($variant_name)
RETURN v.id as id, v.name as name
```

### 18. Check Variant Exists Globally
```cypher
MATCH (v:Variant)
WHERE toLower(v.name) = toLower($variant_name)
RETURN v.id as id, v.name as name
```

### 19. Connect Existing Variant to Object
```cypher
MATCH (o:Object {id: $object_id})
MATCH (v:Variant {id: $variant_id})
CREATE (o)-[:HAS_VARIANT]->(v)
```

### 20. Create New Variant
```cypher
CREATE (v:Variant {
    id: $variant_id,
    name: $variant_name
})
```

### 21. Connect New Variant to Object
```cypher
MATCH (o:Object {id: $object_id})
MATCH (v:Variant {id: $variant_id})
CREATE (o)-[:HAS_VARIANT]->(v)
```

### 22. Clear Unique/Discrete ID Relationships
```cypher
MATCH (o:Object {id: $object_id})-[r:HAS_UNIQUE_ID|HAS_DISCRETE_ID]->(:Variable)
DELETE r
```

### 23. Get All Variables for ALL Selection (Discrete ID)
```cypher
MATCH (p:Part {name: 'Identifier'})-[:HAS_GROUP]->(g:Group {name: 'Public ID'})-[:HAS_VARIABLE]->(v:Variable)
RETURN v.id as variableId
```

### 24. Create HAS_UNIQUE_ID Relationship
```cypher
MATCH (o:Object {id: $object_id})
MATCH (v:Variable {id: $var_id})
MERGE (o)-[:HAS_UNIQUE_ID]->(v)
```

### 25. Clear Composite ID Relationships
```cypher
MATCH (o:Object {id: $object_id})-[r:HAS_COMPOSITE_ID_{i}]->(:Variable)
DELETE r
```
*Note: `{i}` is replaced with 1, 2, 3, 4, or 5*

### 26. Get All Variables for ALL Selection (Composite ID)
```cypher
MATCH (p:Part {name: $part})-[:HAS_GROUP]->(g:Group {name: $group})-[:HAS_VARIABLE]->(v:Variable)
RETURN v.id as variableId
```

### 27. Create HAS_COMPOSITE_ID Relationship
```cypher
MATCH (o:Object {id: $object_id})
MATCH (v:Variable {id: $var_id})
MERGE (o)-[:HAS_COMPOSITE_ID_{composite_index}]->(v)
```
*Note: `{composite_index}` is replaced with 1, 2, 3, 4, or 5*

### 28. Update Relationship and Variant Counts
```cypher
MATCH (o:Object {id: $object_id})
SET o.relationships = COUNT { (o)-[:RELATES_TO]->(:Object) },
    o.variants = COUNT { (o)-[:HAS_VARIANT]->(:Variant) }
```

### 29. Get Updated Object Data
```cypher
MATCH (o:Object {id: $object_id})
RETURN o.id as id, o.being as being, o.avatar as avatar, o.object as object, 
       o.driver as driver, o.relationships as relationships, o.variants as variants
```

---

## Bulk Edit Panel

**Uses the same PUT /objects/{object_id} endpoint**, called multiple times (once per selected object). All 29 queries above are executed in a loop for each object ID.

---

## Ontology View Queries (Used in Modals)

### Single Object - Drivers View
```cypher
MATCH (o:Object {id: $object_id})
WITH o
OPTIONAL MATCH (s:Sector)-[r1:RELEVANT_TO]->(o)
WITH o, s, r1
OPTIONAL MATCH (d:Domain)-[r2:RELEVANT_TO]->(o)
WITH o, s, r1, d, r2
OPTIONAL MATCH (c:Country)-[r3:RELEVANT_TO]->(o)
WITH o, s, r1, d, r2, c, r3
OPTIONAL MATCH (oc:ObjectClarifier)-[r4:RELEVANT_TO]->(o)
RETURN s, r1, d, r2, c, r3, oc, r4, o
```

### Single Object - Ontology View
```cypher
MATCH (b:Being)-[r1:HAS_AVATAR]->(a:Avatar)-[r2:HAS_OBJECT]->(o:Object {id: $object_id})
RETURN b, r1, a, r2, o
```

### Single Object - Identifiers View
```cypher
MATCH (o:Object {id: $object_id})
WITH o
OPTIONAL MATCH (o)-[r1:HAS_DISCRETE_ID]->(v1:Variable)
OPTIONAL MATCH (v1)<-[r4a:HAS_VARIABLE]-(g1:Group)
OPTIONAL MATCH (g1)<-[r5a:HAS_GROUP]-(p1:Part)
WITH o, v1, r1, g1, p1, r4a, r5a
OPTIONAL MATCH (o)-[r2:HAS_COMPOSITE_ID_1|HAS_COMPOSITE_ID_2|HAS_COMPOSITE_ID_3|HAS_COMPOSITE_ID_4|HAS_COMPOSITE_ID_5]->(v2:Variable)
OPTIONAL MATCH (v2)<-[r4b:HAS_VARIABLE]-(g2:Group)
OPTIONAL MATCH (g2)<-[r5b:HAS_GROUP]-(p2:Part)
WITH o, v1, r1, g1, p1, r4a, r5a, v2, r2, g2, p2, r4b, r5b
OPTIONAL MATCH (o)-[r3:HAS_UNIQUE_ID]->(v3:Variable)
OPTIONAL MATCH (v3)<-[r4c:HAS_VARIABLE]-(g3:Group)
OPTIONAL MATCH (g3)<-[r5c:HAS_GROUP]-(p3:Part)
RETURN o, v1, r1, g1, p1, r4a, r5a, v2, r2, g2, p2, r4b, r5b, v3, r3, g3, p3, r4c, r5c
```

### Single Object - Relationships View
```cypher
MATCH (o:Object {id: $object_id})
OPTIONAL MATCH (o)-[r:RELATES_TO]->(o2:Object)
OPTIONAL MATCH (o3:Object)-[r2:RELATES_TO]->(o)
RETURN o, r, o2, r2, o3
```

### Bulk Objects - Drivers View
```cypher
MATCH (o:Object)
WHERE o.id IN $object_ids
WITH o
OPTIONAL MATCH (s:Sector)-[r1:RELEVANT_TO]->(o)
WITH o, s, r1
OPTIONAL MATCH (d:Domain)-[r2:RELEVANT_TO]->(o)
WITH o, s, r1, d, r2
OPTIONAL MATCH (c:Country)-[r3:RELEVANT_TO]->(o)
WITH o, s, r1, d, r2, c, r3
OPTIONAL MATCH (oc:ObjectClarifier)-[r4:RELEVANT_TO]->(o)
RETURN s, r1, d, r2, c, r3, oc, r4, o
```

### Bulk Objects - Ontology View
```cypher
MATCH (o:Object)
WHERE o.id IN $object_ids
OPTIONAL MATCH (b:Being)-[r1:HAS_AVATAR]->(a:Avatar)-[r2:HAS_OBJECT]->(o)
RETURN b, r1, a, r2, o
```

### Bulk Objects - Identifiers View
```cypher
MATCH (o:Object)
WHERE o.id IN $object_ids
WITH o
OPTIONAL MATCH (o)-[r1:HAS_DISCRETE_ID]->(v1:Variable)
OPTIONAL MATCH (v1)<-[r4a:HAS_VARIABLE]-(g1:Group)
OPTIONAL MATCH (g1)<-[r5a:HAS_GROUP]-(p1:Part)
WITH o, v1, r1, g1, p1, r4a, r5a
OPTIONAL MATCH (o)-[r2:HAS_COMPOSITE_ID_1|HAS_COMPOSITE_ID_2|HAS_COMPOSITE_ID_3|HAS_COMPOSITE_ID_4|HAS_COMPOSITE_ID_5]->(v2:Variable)
OPTIONAL MATCH (v2)<-[r4b:HAS_VARIABLE]-(g2:Group)
OPTIONAL MATCH (g2)<-[r5b:HAS_GROUP]-(p2:Part)
WITH o, v1, r1, g1, p1, r4a, r5a, v2, r2, g2, p2, r4b, r5b
OPTIONAL MATCH (o)-[r3:HAS_UNIQUE_ID]->(v3:Variable)
OPTIONAL MATCH (v3)<-[r4c:HAS_VARIABLE]-(g3:Group)
OPTIONAL MATCH (g3)<-[r5c:HAS_GROUP]-(p3:Part)
RETURN o, v1, r1, g1, p1, r4a, r5a, v2, r2, g2, p2, r4b, r5b, v3, r3, g3, p3, r4c, r5c
```

### Bulk Objects - Relationships View
```cypher
MATCH (o:Object)
WHERE o.id IN $object_ids
OPTIONAL MATCH (o)-[r:RELATES_TO]->(o2:Object)
OPTIONAL MATCH (o3:Object)-[r2:RELATES_TO]->(o)
RETURN o, r, o2, r2, o3
```

---

## Summary

- **Total Queries:** 37 unique Cypher queries
  - 8 GET queries (metadata panel)
  - 29 PUT queries (metadata panel)
  - 8 ontology view queries (modals)
- **Bulk Edit Panel:** Uses the same PUT queries in a loop for each object
- **Parameterized:** All queries use `$parameter_name` syntax for security
- **WITH Clauses:** Used in ontology queries to optimize performance

