// ============================================
// DIAGNOSTIC QUERIES FOR TIERED LISTS
// ============================================

// 1. Check all HAS_TIER_X relationships for a specific list
// Replace 'YOUR_LIST_ID' with the actual list ID
MATCH (parent:List {id: 'YOUR_LIST_ID'})-[r]->(tiered:List)
WHERE type(r) STARTS WITH 'HAS_TIER_'
RETURN parent.name as parent_list, 
       type(r) as relationship_type, 
       tiered.name as tier_list, 
       tiered.id as tier_list_id,
       tiered.tier as tier_number
ORDER BY 
  CASE type(r)
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
  END;

// 2. Check all HAS_TIER_X relationships for a list by name
// Replace 'YOUR_LIST_NAME' with the actual list name
MATCH (parent:List {name: 'YOUR_LIST_NAME'})-[r]->(tiered:List)
WHERE type(r) STARTS WITH 'HAS_TIER_'
RETURN parent.name as parent_list, 
       type(r) as relationship_type, 
       tiered.name as tier_list, 
       tiered.id as tier_list_id,
       tiered.tier as tier_number
ORDER BY 
  CASE type(r)
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
  END;

// 3. Check all HAS_TIER_X_VALUE relationships for tiered list values
// This shows relationships between ListValue nodes
MATCH (lv1:ListValue)-[r]->(lv2:ListValue)
WHERE type(r) STARTS WITH 'HAS_TIER_' AND type(r) ENDS WITH '_VALUE'
RETURN lv1.value as tier1_value, 
       type(r) as relationship_type, 
       lv2.value as tier2_value,
       lv1.tier as tier1_number,
       lv2.tier as tier2_number,
       lv1.listName as tier1_list_name,
       lv2.listName as tier2_list_name
ORDER BY lv1.value, 
  CASE type(r)
    WHEN 'HAS_TIER_1_VALUE' THEN 1
    WHEN 'HAS_TIER_2_VALUE' THEN 2
    WHEN 'HAS_TIER_3_VALUE' THEN 3
    WHEN 'HAS_TIER_4_VALUE' THEN 4
    WHEN 'HAS_TIER_5_VALUE' THEN 5
    WHEN 'HAS_TIER_6_VALUE' THEN 6
    WHEN 'HAS_TIER_7_VALUE' THEN 7
    WHEN 'HAS_TIER_8_VALUE' THEN 8
    WHEN 'HAS_TIER_9_VALUE' THEN 9
    WHEN 'HAS_TIER_10_VALUE' THEN 10
    ELSE 99
  END
LIMIT 100;

// 4. Check tiered list values for a specific parent list
// Replace 'YOUR_LIST_ID' with the actual list ID
MATCH (parent:List {id: 'YOUR_LIST_ID'})-[tier_rel:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tier_list:List)
MATCH (tier_list)-[:HAS_LIST_VALUE]->(lv1:ListValue)
OPTIONAL MATCH (lv1)-[tier_value_rel:HAS_TIER_1_VALUE|HAS_TIER_2_VALUE|HAS_TIER_3_VALUE|HAS_TIER_4_VALUE|HAS_TIER_5_VALUE|HAS_TIER_6_VALUE|HAS_TIER_7_VALUE|HAS_TIER_8_VALUE|HAS_TIER_9_VALUE|HAS_TIER_10_VALUE]->(lv2:ListValue)
RETURN parent.name as parent_list,
       type(tier_rel) as tier_relationship,
       tier_list.name as tier_list_name,
       tier_list.tier as tier_number,
       lv1.value as tier_value,
       lv1.tier as value_tier_number,
       type(tier_value_rel) as value_relationship,
       lv2.value as next_tier_value,
       lv2.tier as next_tier_number
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

// 5. Check if ListValue nodes have tier properties
MATCH (lv:ListValue)
WHERE lv.tier IS NOT NULL
RETURN lv.value as value, 
       lv.tier as tier_number, 
       lv.listName as list_name
ORDER BY lv.tier, lv.value
LIMIT 50;

// 6. Check complete tiered list structure for a parent list
// Replace 'YOUR_LIST_ID' with the actual list ID
MATCH (parent:List {id: 'YOUR_LIST_ID'})
OPTIONAL MATCH (parent)-[tier_rel:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tier_list:List)
OPTIONAL MATCH (tier_list)-[:HAS_LIST_VALUE]->(lv1:ListValue)
OPTIONAL MATCH (lv1)-[tier_value_rel:HAS_TIER_1_VALUE|HAS_TIER_2_VALUE|HAS_TIER_3_VALUE|HAS_TIER_4_VALUE|HAS_TIER_5_VALUE|HAS_TIER_6_VALUE|HAS_TIER_7_VALUE|HAS_TIER_8_VALUE|HAS_TIER_9_VALUE|HAS_TIER_10_VALUE]->(lv2:ListValue)
RETURN parent.name as parent_list,
       type(tier_rel) as tier_relationship,
       tier_list.name as tier_list_name,
       tier_list.tier as tier_list_tier,
       lv1.value as tier1_value,
       lv1.tier as tier1_value_tier,
       type(tier_value_rel) as value_relationship,
       lv2.value as tier2_value,
       lv2.tier as tier2_value_tier
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

// 7. Count relationships by type
MATCH ()-[r]->()
WHERE type(r) STARTS WITH 'HAS_TIER_'
RETURN type(r) as relationship_type, count(*) as count
ORDER BY relationship_type;

// 8. Check for any tier relationships (including malformed ones)
MATCH ()-[r]->()
WHERE type(r) CONTAINS 'TIER'
RETURN type(r) as relationship_type, count(*) as count
ORDER BY relationship_type;

// 9. Find all lists that should have tier relationships but don't
// (Lists with listType = 'Multi-Level' but no HAS_TIER relationships)
// Note: This assumes listType is stored as a property
MATCH (l:List)
WHERE l.listType = 'Multi-Level'
OPTIONAL MATCH (l)-[r:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->()
WITH l, count(r) as tier_count
WHERE tier_count = 0
RETURN l.id as list_id, l.name as list_name, l.listType as list_type;

// 10. Check if tier lists have the tier property set correctly
MATCH (parent:List)-[r:HAS_TIER_1|HAS_TIER_2|HAS_TIER_3|HAS_TIER_4|HAS_TIER_5|HAS_TIER_6|HAS_TIER_7|HAS_TIER_8|HAS_TIER_9|HAS_TIER_10]->(tier_list:List)
RETURN parent.name as parent_list,
       type(r) as relationship_type,
       tier_list.name as tier_list_name,
       tier_list.tier as tier_property,
       CASE 
         WHEN type(r) = 'HAS_TIER_1' AND tier_list.tier = 1 THEN '✓ Correct'
         WHEN type(r) = 'HAS_TIER_2' AND tier_list.tier = 2 THEN '✓ Correct'
         WHEN type(r) = 'HAS_TIER_3' AND tier_list.tier = 3 THEN '✓ Correct'
         WHEN type(r) = 'HAS_TIER_4' AND tier_list.tier = 4 THEN '✓ Correct'
         WHEN type(r) = 'HAS_TIER_5' AND tier_list.tier = 5 THEN '✓ Correct'
         WHEN type(r) = 'HAS_TIER_6' AND tier_list.tier = 6 THEN '✓ Correct'
         WHEN type(r) = 'HAS_TIER_7' AND tier_list.tier = 7 THEN '✓ Correct'
         WHEN type(r) = 'HAS_TIER_8' AND tier_list.tier = 8 THEN '✓ Correct'
         WHEN type(r) = 'HAS_TIER_9' AND tier_list.tier = 9 THEN '✓ Correct'
         WHEN type(r) = 'HAS_TIER_10' AND tier_list.tier = 10 THEN '✓ Correct'
         ELSE '✗ Mismatch'
       END as status
ORDER BY parent.name, 
  CASE type(r)
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
  END;

