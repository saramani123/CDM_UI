// Check Part nodes for ID property
MATCH (p:Part)
RETURN 
    count(p) as total_parts,
    count(p.id) as parts_with_id,
    count(p) - count(p.id) as parts_without_id,
    collect(DISTINCT p.name)[0..10] as sample_part_names;

// Check Group nodes for ID property
MATCH (g:Group)
RETURN 
    count(g) as total_groups,
    count(g.id) as groups_with_id,
    count(g) - count(g.id) as groups_without_id,
    collect(DISTINCT g.name)[0..10] as sample_group_names;

// Show Part nodes without IDs (first 20)
MATCH (p:Part)
WHERE p.id IS NULL
RETURN p.name as part_name, labels(p) as labels
LIMIT 20;

// Show Group nodes without IDs (first 20)
MATCH (g:Group)
WHERE g.id IS NULL
RETURN g.name as group_name, g.part as part, labels(g) as labels
LIMIT 20;

// Check for duplicate Group names across different Parts (potential issue)
MATCH (p1:Part)-[:HAS_GROUP]->(g1:Group)
MATCH (p2:Part)-[:HAS_GROUP]->(g2:Group)
WHERE p1 <> p2 AND g1.name = g2.name
RETURN g1.name as group_name, 
       collect(DISTINCT p1.name) as parts_with_this_group,
       collect(DISTINCT g1.id) as group_ids
LIMIT 20;
