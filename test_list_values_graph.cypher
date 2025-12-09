// ============================================
// TEST QUERY FOR LIST VALUES GRAPH
// Replace 'YOUR_LIST_ID' with your actual list ID
// ============================================

// This query mimics what the graph modal should show
MATCH (l:List {id: 'YOUR_LIST_ID'})
// Get tier list relationships
OPTIONAL MATCH (l)-[tier_rel:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tiered:List)
WITH l, tiered, tier_rel
// Get tier list values (Tier 1 values)
OPTIONAL MATCH (tiered)-[r1:HAS_LIST_VALUE]->(lv1:ListValue)
WITH l, tiered, tier_rel, lv1, r1
// Get tier value relationships (Tier 1 -> Tier 2, Tier 2 -> Tier 3, etc.)
OPTIONAL MATCH (lv1)-[r2:HAS_TIER_1_VALUE|HAS_TIER_2_VALUE|HAS_TIER_3_VALUE|HAS_TIER_4_VALUE|HAS_TIER_5_VALUE|HAS_TIER_6_VALUE|HAS_TIER_7_VALUE|HAS_TIER_8_VALUE|HAS_TIER_9_VALUE|HAS_TIER_10_VALUE]->(lv2:ListValue)
// Also get any further tier relationships (Tier 2 -> Tier 3, etc.)
OPTIONAL MATCH (lv2)-[r3:HAS_TIER_2_VALUE|HAS_TIER_3_VALUE|HAS_TIER_4_VALUE|HAS_TIER_5_VALUE|HAS_TIER_6_VALUE|HAS_TIER_7_VALUE|HAS_TIER_8_VALUE|HAS_TIER_9_VALUE|HAS_TIER_10_VALUE]->(lv3:ListValue)
RETURN 
  l.name as parent_list,
  type(tier_rel) as tier_relationship,
  tiered.name as tier_list,
  tiered.tier as tier_list_tier,
  lv1.value as tier1_value,
  lv1.tier as tier1_value_tier,
  type(r2) as tier_value_relationship_1_to_2,
  lv2.value as tier2_value,
  lv2.tier as tier2_value_tier,
  type(r3) as tier_value_relationship_2_to_3,
  lv3.value as tier3_value,
  lv3.tier as tier3_value_tier
ORDER BY 
  CASE type(tier_rel)
    WHEN 'HAS_TIER_1' THEN 1
    WHEN 'HAS_TIER_2' THEN 2
    WHEN 'HAS_TIER_3' THEN 3
    WHEN 'HAS_TIER_4' THEN 4
    WHEN 'HAS_TIER_5' THEN 5
    WHEN 'HAS_TIER_6' THEN 6
    WHEN 'HAS_TIER_7' THEN 7
    WHEN 'HAS_TIER_8' THEN 8
    WHEN 'HAS_TIER_9' THEN 9
    WHEN 'HAS_TIER_10' THEN 10
    ELSE 99
  END,
  lv1.value;

// Alternative: Simpler query to see all nodes and relationships
MATCH (l:List {id: 'YOUR_LIST_ID'})
OPTIONAL MATCH path = (l)-[*1..5]-(connected)
WHERE ANY(rel in relationships(path) WHERE type(rel) STARTS WITH 'HAS_TIER_' OR type(rel) = 'HAS_LIST_VALUE')
RETURN path
LIMIT 50;

