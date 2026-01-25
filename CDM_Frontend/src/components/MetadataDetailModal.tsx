import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { MetadataData } from '../hooks/useMetadata';
import { apiService } from '../services/api';

// Required metadata concepts configuration
const REQUIRED_METADATA_CONCEPTS: Record<string, { levels: 1 | 2 | 3 | 4; columns: string[] }> = {
  "Vulqan": { levels: 3, columns: ["Format V-I", "Format V-II", "Definition"] },
  "Being": { levels: 2, columns: ["Being", "Definition"] },
  "Avatar": { levels: 3, columns: ["Being", "Avatar", "Definition"] },
  "Part": { levels: 2, columns: ["Part", "Definition"] },
  "Section": { levels: 3, columns: ["Part", "Section", "Definition"] },
  "Group": { levels: 4, columns: ["Part", "Section", "Group", "Definition"] },
  "G-Type": { levels: 2, columns: ["G-Type", "Definition"] },
  "Set": { levels: 2, columns: ["Set", "Definition"] },
  "Grouping": { levels: 3, columns: ["Set", "Grouping", "Definition"] }
};

function isRequiredConcept(concept: string): boolean {
  return concept in REQUIRED_METADATA_CONCEPTS;
}

interface MetadataDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadataItem: MetadataData | null;
  onSave: () => void;
}

interface ModalData {
  levels: 1 | 2 | 3 | 4;
  columns: string[];
  rows: string[][];
}

export const MetadataDetailModal: React.FC<MetadataDetailModalProps> = ({
  isOpen,
  onClose,
  metadataItem,
  onSave
}) => {
  const [levels, setLevels] = useState<1 | 2 | 3 | 4>(1);
  const [columnNames, setColumnNames] = useState<string[]>(['']);
  const [rows, setRows] = useState<string[][]>(Array(20).fill(null).map(() => ['']));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing data when modal opens or metadataItem changes
  useEffect(() => {
    if (isOpen && metadataItem) {
      loadMetadataDetail();
    }
  }, [isOpen, metadataItem]);

  const loadMetadataDetail = async () => {
    if (!metadataItem) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const isRequired = isRequiredConcept(metadataItem.concept);
      const isVulqan = metadataItem.concept === 'Vulqan' || metadataItem.concept?.toLowerCase() === 'vulqan';
      const isBeing = metadataItem.concept === 'Being' || metadataItem.concept?.toLowerCase() === 'being';
      const isAvatar = metadataItem.concept === 'Avatar' || metadataItem.concept?.toLowerCase() === 'avatar';
      const isPart = metadataItem.concept === 'Part' || metadataItem.concept?.toLowerCase() === 'part';
      const isSection = metadataItem.concept === 'Section' || metadataItem.concept?.toLowerCase() === 'section';
      const isGroup = metadataItem.concept === 'Group' || metadataItem.concept?.toLowerCase() === 'group';
      const isGType = metadataItem.concept === 'G-Type' || metadataItem.concept?.toLowerCase() === 'g-type';
      const isSet = metadataItem.concept === 'Set' || metadataItem.concept?.toLowerCase() === 'set';
      const isGrouping = metadataItem.concept === 'Grouping' || metadataItem.concept?.toLowerCase() === 'grouping';
      
      console.log('Loading metadata detail for concept:', metadataItem.concept, 'isVulqan:', isVulqan, 'isBeing:', isBeing, 'isAvatar:', isAvatar, 'isPart:', isPart, 'isSection:', isSection, 'isGroup:', isGroup, 'isGType:', isGType, 'isSet:', isSet, 'isGrouping:', isGrouping);
      
      // For Group, fetch Group values with their Part and Section values from Neo4j
      if (isGroup) {
        try {
          console.log('Fetching Group values with Part and Section values...');
          const groupData = await apiService.getGroupValues() as { groupTriplets: Array<{ group: string; part: string; section: string }> };
          console.log('Group data received:', groupData);
          const groupTriplets = groupData.groupTriplets || [];
          console.log('Group-Part-Section triplets count:', groupTriplets.length);
          
          if (groupTriplets.length === 0) {
            console.warn('No Group values found in Neo4j. Make sure Group nodes exist with Variables.');
            setError('No Group values found. Please ensure Group nodes exist in the Variables grid.');
          }
          
          // Set required config
          const requiredConfig = REQUIRED_METADATA_CONCEPTS['Group'];
          setLevels(requiredConfig.levels);
          setColumnNames([...requiredConfig.columns]);
          
          // Load existing detailData to preserve Definition values
          let existingDetailData: any = null;
          try {
            const item = await apiService.getMetadataItem(metadataItem.id);
            const detailDataStr = (item as any).detailData;
            console.log('Loading existing detailData for Group:', detailDataStr);
            if (detailDataStr) {
              existingDetailData = typeof detailDataStr === 'string' ? JSON.parse(detailDataStr) : detailDataStr;
              console.log('Parsed existing detailData:', existingDetailData);
            }
          } catch (e) {
            console.log('No existing detailData found, starting fresh:', e);
          }
          
          // Create a map of existing definitions by Part+Section+Group combination
          // Since the same Group can appear with different Part-Section combinations, we need to use all three as the key
          const existingDefinitions = new Map<string, string>();
          if (existingDetailData && existingDetailData.rows) {
            console.log('Processing existing rows for definitions:', existingDetailData.rows.length);
            existingDetailData.rows.forEach((row: string[]) => {
              if (row.length >= 4 && row[0] && row[1] && row[2]) { // row[0] is Part, row[1] is Section, row[2] is Group
                const key = `${row[0]}|${row[1]}|${row[2]}`; // Use Part|Section|Group as key
                existingDefinitions.set(key, row[3] || ''); // row[3] is Definition
                console.log(`Setting definition for Part "${row[0]}" + Section "${row[1]}" + Group "${row[2]}": "${row[3]}"`);
              }
            });
            console.log('Total definitions loaded:', existingDefinitions.size);
          }
          
          // Build rows: one per Group with Part, Section, and Definition
          // The backend already provides all Part-Section-Group triplets sorted by Part, then Section, then Group
          const newRows = groupTriplets.map(triplet => {
            const key = `${triplet.part}|${triplet.section}|${triplet.group}`; // Use Part|Section|Group as key
            const definition = existingDefinitions.get(key) || '';
            if (definition) {
              console.log(`Found saved definition for Part "${triplet.part}" + Section "${triplet.section}" + Group "${triplet.group}": "${definition}"`);
            }
            return [
              triplet.part || '',      // Part (read-only)
              triplet.section || '',    // Section (read-only)
              triplet.group || '',      // Group (read-only)
              definition // Definition (editable)
            ];
          });
          
          console.log('Built rows for Group:', newRows.length, 'rows');
          console.log('Sample rows with definitions:', newRows.slice(0, 5).map(row => ({ part: row[0], section: row[1], group: row[2], definition: row[3] })));
          
          if (newRows.length === 0) {
            console.warn('No rows to display - groupTriplets array was empty');
            setError('No Group values found. Please ensure Group nodes exist in the Variables grid.');
          }
          
          setRows(newRows);
        } catch (err) {
          console.error('Error fetching Group values:', err);
          setError(`Failed to load Group values: ${err instanceof Error ? err.message : 'Unknown error'}`);
          // Fall back to loading from detailData if API fails
          try {
            const item = await apiService.getMetadataItem(metadataItem.id);
            let detailData = (item as any).detailData;
            
            // Parse detailData if it's a string
            if (typeof detailData === 'string') {
              try {
                detailData = JSON.parse(detailData);
              } catch (e) {
                console.error('Failed to parse detailData:', e);
                detailData = null;
              }
            }
            
            const requiredConfig = REQUIRED_METADATA_CONCEPTS['Group'];
            setLevels(requiredConfig.levels);
            setColumnNames([...requiredConfig.columns]);
            
            if (detailData && typeof detailData === 'object' && detailData.rows) {
              setRows(detailData.rows || []);
            } else {
              setRows([]);
            }
          } catch (fallbackErr) {
            console.error('Error in fallback loading:', fallbackErr);
            setRows([]);
          }
        }
      } else if (isSection) {
        // For Section, fetch Section values with their Part values from Neo4j
        try {
          console.log('Fetching Section values with Part values...');
          const sectionData = await apiService.getSectionValues() as { sectionPairs: Array<{ section: string; part: string }> };
          console.log('Section data received:', sectionData);
          const sectionPairs = sectionData.sectionPairs || [];
          console.log('Section-Part pairs count:', sectionPairs.length);
          
          if (sectionPairs.length === 0) {
            console.warn('No Section values found in Neo4j. Make sure Variables have section properties set.');
            setError('No Section values found. Please ensure Variables have section properties set in the Variables grid.');
          }
          
          // Set required config
          const requiredConfig = REQUIRED_METADATA_CONCEPTS['Section'];
          setLevels(requiredConfig.levels);
          setColumnNames([...requiredConfig.columns]);
          
          // Load existing detailData to preserve Definition values
          let existingDetailData: any = null;
          try {
            const item = await apiService.getMetadataItem(metadataItem.id);
            const detailDataStr = (item as any).detailData;
            console.log('Loading existing detailData for Section:', detailDataStr);
            if (detailDataStr) {
              existingDetailData = typeof detailDataStr === 'string' ? JSON.parse(detailDataStr) : detailDataStr;
              console.log('Parsed existing detailData:', existingDetailData);
            }
          } catch (e) {
            console.log('No existing detailData found, starting fresh:', e);
          }
          
          // Create a map of existing definitions by Part+Section combination
          // Since the same Section can appear with different Part values, we need to use both as the key
          const existingDefinitions = new Map<string, string>();
          if (existingDetailData && existingDetailData.rows) {
            console.log('Processing existing rows for definitions:', existingDetailData.rows.length);
            existingDetailData.rows.forEach((row: string[]) => {
              if (row.length >= 3 && row[0] && row[1]) { // row[0] is Part, row[1] is Section
                const key = `${row[0]}|${row[1]}`; // Use Part|Section as key
                existingDefinitions.set(key, row[2] || ''); // row[2] is Definition
                console.log(`Setting definition for Part "${row[0]}" + Section "${row[1]}": "${row[2]}"`);
              }
            });
            console.log('Total definitions loaded:', existingDefinitions.size);
          }
          
          // Build rows: one per Section with Part and Definition
          // The backend already provides all Part-Section pairs sorted by Part, then Section
          const newRows = sectionPairs.map(pair => {
            const key = `${pair.part}|${pair.section}`; // Use Part|Section as key
            const definition = existingDefinitions.get(key) || '';
            if (definition) {
              console.log(`Found saved definition for Part "${pair.part}" + Section "${pair.section}": "${definition}"`);
            }
            return [
              pair.part || '',      // Part (read-only)
              pair.section || '',   // Section (read-only)
              definition // Definition (editable)
            ];
          });
          
          console.log('Built rows for Section:', newRows.length, 'rows');
          console.log('Sample rows with definitions:', newRows.slice(0, 5).map(row => ({ part: row[0], section: row[1], definition: row[2] })));
          
          if (newRows.length === 0) {
            console.warn('No rows to display - sectionPairs array was empty');
            setError('No Section values found. Please ensure Variables have section properties set in the Variables grid.');
          }
          
          setRows(newRows);
        } catch (err) {
          console.error('Error fetching Section values:', err);
          setError(`Failed to load Section values: ${err instanceof Error ? err.message : 'Unknown error'}`);
          // Fall back to loading from detailData if API fails
          try {
            const item = await apiService.getMetadataItem(metadataItem.id);
            let detailData = (item as any).detailData;
            
            // Parse detailData if it's a string
            if (typeof detailData === 'string') {
              try {
                detailData = JSON.parse(detailData);
              } catch (e) {
                console.error('Failed to parse detailData:', e);
                detailData = null;
              }
            }
            
            const requiredConfig = REQUIRED_METADATA_CONCEPTS['Section'];
            setLevels(requiredConfig.levels);
            setColumnNames([...requiredConfig.columns]);
            
            if (detailData && typeof detailData === 'object' && detailData.rows) {
              setRows(detailData.rows || []);
            } else {
              setRows([]);
            }
          } catch (fallbackErr) {
            console.error('Error in fallback loading:', fallbackErr);
            setRows([]);
          }
        }
      } else if (isPart) {
        // For Part, fetch Part values from Neo4j
        try {
          console.log('Fetching Part values...');
          const partData = await apiService.getPartValues() as { parts: string[] };
          console.log('Part data received:', partData);
          const parts = partData.parts || [];
          console.log('Part values count:', parts.length);
          
          if (parts.length === 0) {
            console.warn('No Part values found in Neo4j. Make sure Part nodes exist.');
            setError('No Part values found. Please ensure Part nodes exist in the Variables grid.');
          }
          
          // Set required config
          const requiredConfig = REQUIRED_METADATA_CONCEPTS['Part'];
          setLevels(requiredConfig.levels);
          setColumnNames([...requiredConfig.columns]);
          
          // Load existing detailData to preserve Definition values
          let existingDetailData: any = null;
          try {
            const item = await apiService.getMetadataItem(metadataItem.id);
            const detailDataStr = (item as any).detailData;
            console.log('Loading existing detailData for Part:', detailDataStr);
            if (detailDataStr) {
              existingDetailData = typeof detailDataStr === 'string' ? JSON.parse(detailDataStr) : detailDataStr;
              console.log('Parsed existing detailData:', existingDetailData);
            }
          } catch (e) {
            console.log('No existing detailData found, starting fresh:', e);
          }
          
          // Create a map of existing definitions by Part value
          const existingDefinitions = new Map<string, string>();
          if (existingDetailData && existingDetailData.rows) {
            console.log('Processing existing rows for definitions:', existingDetailData.rows.length);
            existingDetailData.rows.forEach((row: string[]) => {
              if (row.length >= 2 && row[0]) { // row[0] is Part
                existingDefinitions.set(row[0], row[1] || ''); // row[1] is Definition
                console.log(`Setting definition for Part "${row[0]}": "${row[1]}"`);
              }
            });
            console.log('Total definitions loaded:', existingDefinitions.size);
          }
          
          // Build rows: one per Part value with Definition
          // The backend already provides all Part values in alphabetical order
          const newRows = parts.map(part => {
            const definition = existingDefinitions.get(part) || '';
            if (definition) {
              console.log(`Found saved definition for Part "${part}": "${definition}"`);
            }
            return [
              part || '',      // Part (read-only)
              definition // Definition (editable)
            ];
          });
          
          console.log('Built rows for Part:', newRows.length, 'rows');
          console.log('Sample rows with definitions:', newRows.slice(0, 5).map(row => ({ part: row[0], definition: row[1] })));
          
          if (newRows.length === 0) {
            console.warn('No rows to display - parts array was empty');
            setError('No Part values found. Please ensure Part nodes exist in the Variables grid.');
          }
          
          setRows(newRows);
        } catch (err) {
          console.error('Error fetching Part values:', err);
          setError(`Failed to load Part values: ${err instanceof Error ? err.message : 'Unknown error'}`);
          // Fall back to loading from detailData if API fails
          try {
            const item = await apiService.getMetadataItem(metadataItem.id);
            let detailData = (item as any).detailData;
            
            // Parse detailData if it's a string
            if (typeof detailData === 'string') {
              try {
                detailData = JSON.parse(detailData);
              } catch (e) {
                console.error('Failed to parse detailData:', e);
                detailData = null;
              }
            }
            
            const requiredConfig = REQUIRED_METADATA_CONCEPTS['Part'];
            setLevels(requiredConfig.levels);
            setColumnNames([...requiredConfig.columns]);
            
            if (detailData && typeof detailData === 'object' && detailData.rows) {
              setRows(detailData.rows || []);
            } else {
              setRows([]);
            }
          } catch (fallbackErr) {
            console.error('Error in fallback loading:', fallbackErr);
            setRows([]);
          }
        }
      } else if (isGType) {
        // For G-Type, fetch G-Type values from Neo4j
        try {
          console.log('Fetching G-Type values...');
          const gTypeData = await apiService.getGTypeValues() as { gTypes: string[] };
          console.log('G-Type data received:', gTypeData);
          const gTypes = gTypeData.gTypes || [];
          console.log('G-Type values count:', gTypes.length);
          
          if (gTypes.length === 0) {
            console.warn('No G-Type values found in Neo4j. Make sure Variables have gType properties set.');
            setError('No G-Type values found. Please ensure Variables have G-Type properties set in the Variables grid.');
          }
          
          // Set required config
          const requiredConfig = REQUIRED_METADATA_CONCEPTS['G-Type'];
          setLevels(requiredConfig.levels);
          setColumnNames([...requiredConfig.columns]);
          
          // Load existing detailData to preserve Definition values
          let existingDetailData: any = null;
          try {
            const item = await apiService.getMetadataItem(metadataItem.id);
            const detailDataStr = (item as any).detailData;
            console.log('Loading existing detailData for G-Type:', detailDataStr);
            if (detailDataStr) {
              existingDetailData = typeof detailDataStr === 'string' ? JSON.parse(detailDataStr) : detailDataStr;
              console.log('Parsed existing detailData:', existingDetailData);
            }
          } catch (e) {
            console.log('No existing detailData found, starting fresh:', e);
          }
          
          // Create a map of existing definitions by G-Type value
          const existingDefinitions = new Map<string, string>();
          if (existingDetailData && existingDetailData.rows) {
            console.log('Processing existing rows for definitions:', existingDetailData.rows.length);
            existingDetailData.rows.forEach((row: string[]) => {
              if (row.length >= 2 && row[0]) { // row[0] is G-Type
                existingDefinitions.set(row[0], row[1] || ''); // row[1] is Definition
                console.log(`Setting definition for G-Type "${row[0]}": "${row[1]}"`);
              }
            });
            console.log('Total definitions loaded:', existingDefinitions.size);
          }
          
          // Build rows: one per G-Type value with Definition
          // The backend already provides all G-Type values in alphabetical order
          const newRows = gTypes.map(gType => {
            const definition = existingDefinitions.get(gType) || '';
            if (definition) {
              console.log(`Found saved definition for G-Type "${gType}": "${definition}"`);
            }
            return [
              gType || '',      // G-Type (read-only)
              definition // Definition (editable)
            ];
          });
          
          console.log('Built rows for G-Type:', newRows.length, 'rows');
          console.log('Sample rows with definitions:', newRows.slice(0, 5).map(row => ({ gType: row[0], definition: row[1] })));
          
          if (newRows.length === 0) {
            console.warn('No rows to display - gTypes array was empty');
            setError('No G-Type values found. Please ensure Variables have G-Type properties set in the Variables grid.');
          }
          
          setRows(newRows);
        } catch (err) {
          console.error('Error fetching G-Type values:', err);
          setError(`Failed to load G-Type values: ${err instanceof Error ? err.message : 'Unknown error'}`);
          // Fall back to loading from detailData if API fails
          try {
            const item = await apiService.getMetadataItem(metadataItem.id);
            let detailData = (item as any).detailData;
            
            // Parse detailData if it's a string
            if (typeof detailData === 'string') {
              try {
                detailData = JSON.parse(detailData);
              } catch (e) {
                console.error('Failed to parse detailData:', e);
                detailData = null;
              }
            }
            
            const requiredConfig = REQUIRED_METADATA_CONCEPTS['G-Type'];
            setLevels(requiredConfig.levels);
            setColumnNames([...requiredConfig.columns]);
            
            if (detailData && typeof detailData === 'object' && detailData.rows) {
              setRows(detailData.rows || []);
            } else {
              setRows([]);
            }
          } catch (fallbackErr) {
            console.error('Error in fallback loading:', fallbackErr);
            setRows([]);
          }
        }
      } else if (isSet) {
        // For Set, fetch Set values from Neo4j
        try {
          console.log('Fetching Set values...');
          const setData = await apiService.getSetValues() as { sets: string[] };
          console.log('Set data received:', setData);
          const sets = setData.sets || [];
          console.log('Set values count:', sets.length);
          
          if (sets.length === 0) {
            console.warn('No Set values found in Neo4j. Make sure Set nodes exist.');
            setError('No Set values found. Please ensure Set nodes exist in the Lists grid.');
          }
          
          // Set required config
          const requiredConfig = REQUIRED_METADATA_CONCEPTS['Set'];
          setLevels(requiredConfig.levels);
          setColumnNames([...requiredConfig.columns]);
          
          // Load existing detailData to preserve Definition values
          let existingDetailData: any = null;
          try {
            const item = await apiService.getMetadataItem(metadataItem.id);
            const detailDataStr = (item as any).detailData;
            console.log('Loading existing detailData for Set:', detailDataStr);
            if (detailDataStr) {
              existingDetailData = typeof detailDataStr === 'string' ? JSON.parse(detailDataStr) : detailDataStr;
              console.log('Parsed existing detailData:', existingDetailData);
            }
          } catch (e) {
            console.log('No existing detailData found, starting fresh:', e);
          }
          
          // Create a map of existing definitions by Set value
          const existingDefinitions = new Map<string, string>();
          if (existingDetailData && existingDetailData.rows) {
            console.log('Processing existing rows for definitions:', existingDetailData.rows.length);
            existingDetailData.rows.forEach((row: string[]) => {
              if (row.length >= 2 && row[0]) { // row[0] is Set
                existingDefinitions.set(row[0], row[1] || ''); // row[1] is Definition
                console.log(`Setting definition for Set "${row[0]}": "${row[1]}"`);
              }
            });
            console.log('Total definitions loaded:', existingDefinitions.size);
          }
          
          // Build rows: one per Set value with Definition
          // The backend already provides all Set values in alphabetical order
          const newRows = sets.map(set => {
            const definition = existingDefinitions.get(set) || '';
            if (definition) {
              console.log(`Found saved definition for Set "${set}": "${definition}"`);
            }
            return [
              set || '',      // Set (read-only)
              definition // Definition (editable)
            ];
          });
          
          console.log('Built rows for Set:', newRows.length, 'rows');
          console.log('Sample rows with definitions:', newRows.slice(0, 5).map(row => ({ set: row[0], definition: row[1] })));
          
          if (newRows.length === 0) {
            console.warn('No rows to display - sets array was empty');
            setError('No Set values found. Please ensure Set nodes exist in the Lists grid.');
          }
          
          setRows(newRows);
        } catch (err) {
          console.error('Error fetching Set values:', err);
          setError(`Failed to load Set values: ${err instanceof Error ? err.message : 'Unknown error'}`);
          // Fall back to loading from detailData if API fails
          try {
            const item = await apiService.getMetadataItem(metadataItem.id);
            let detailData = (item as any).detailData;
            
            // Parse detailData if it's a string
            if (typeof detailData === 'string') {
              try {
                detailData = JSON.parse(detailData);
              } catch (e) {
                console.error('Failed to parse detailData:', e);
                detailData = null;
              }
            }
            
            const requiredConfig = REQUIRED_METADATA_CONCEPTS['Set'];
            setLevels(requiredConfig.levels);
            setColumnNames([...requiredConfig.columns]);
            
            if (detailData && typeof detailData === 'object' && detailData.rows) {
              setRows(detailData.rows || []);
            } else {
              setRows([]);
            }
          } catch (fallbackErr) {
            console.error('Error in fallback loading:', fallbackErr);
            setRows([]);
          }
        }
      } else if (isAvatar) {
        // For Avatar, fetch Avatar values with their Being values from Neo4j
        try {
          console.log('Fetching Avatar values with Being values...');
          const avatarData = await apiService.getAvatarValues() as { avatarPairs: Array<{ avatar: string; being: string }> };
          console.log('Avatar data received:', avatarData);
          const avatarPairs = avatarData.avatarPairs || [];
          console.log('Avatar-Being pairs count:', avatarPairs.length);
          
          if (avatarPairs.length === 0) {
            console.warn('No Avatar values found in Neo4j. Make sure Avatar nodes exist with Being relationships.');
            setError('No Avatar values found. Please ensure Avatar nodes exist in the Objects grid.');
          }
          
          // Set required config
          const requiredConfig = REQUIRED_METADATA_CONCEPTS['Avatar'];
          setLevels(requiredConfig.levels);
          setColumnNames([...requiredConfig.columns]);
          
          // Load existing detailData to preserve Definition values
          let existingDetailData: any = null;
          try {
            const item = await apiService.getMetadataItem(metadataItem.id);
            const detailDataStr = (item as any).detailData;
            console.log('Loading existing detailData for Avatar:', detailDataStr);
            if (detailDataStr) {
              existingDetailData = typeof detailDataStr === 'string' ? JSON.parse(detailDataStr) : detailDataStr;
              console.log('Parsed existing detailData:', existingDetailData);
            }
          } catch (e) {
            console.log('No existing detailData found, starting fresh:', e);
          }
          
          // Create a map of existing definitions by Being+Avatar combination
          // Since the same Avatar can appear with different Being values, we need to use both as the key
          const existingDefinitions = new Map<string, string>();
          if (existingDetailData && existingDetailData.rows) {
            console.log('Processing existing rows for definitions:', existingDetailData.rows.length);
            existingDetailData.rows.forEach((row: string[]) => {
              if (row.length >= 3 && row[0] && row[1]) { // row[0] is Being, row[1] is Avatar
                const key = `${row[0]}|${row[1]}`; // Use Being|Avatar as key
                existingDefinitions.set(key, row[2] || ''); // row[2] is Definition
                console.log(`Setting definition for Being "${row[0]}" + Avatar "${row[1]}": "${row[2]}"`);
              }
            });
            console.log('Total definitions loaded:', existingDefinitions.size);
          }
          
          // Build rows: one per Avatar with Being and Definition
          // The backend already provides all Avatar-Being pairs sorted by Being, then Avatar
          const newRows = avatarPairs.map(pair => {
            const key = `${pair.being}|${pair.avatar}`; // Use Being|Avatar as key
            const definition = existingDefinitions.get(key) || '';
            if (definition) {
              console.log(`Found saved definition for Being "${pair.being}" + Avatar "${pair.avatar}": "${definition}"`);
            }
            return [
              pair.being || '',      // Being (read-only)
              pair.avatar || '',     // Avatar (read-only)
              definition // Definition (editable)
            ];
          });
          
          console.log('Built rows for Avatar:', newRows.length, 'rows');
          console.log('Sample rows with definitions:', newRows.slice(0, 5).map(row => ({ being: row[0], avatar: row[1], definition: row[2] })));
          
          if (newRows.length === 0) {
            console.warn('No rows to display - avatarPairs array was empty');
            setError('No Avatar values found. Please ensure Avatar nodes exist in the Objects grid.');
          }
          
          setRows(newRows);
        } catch (err) {
          console.error('Error fetching Avatar values:', err);
          setError(`Failed to load Avatar values: ${err instanceof Error ? err.message : 'Unknown error'}`);
          // Fall back to loading from detailData if API fails
          try {
            const item = await apiService.getMetadataItem(metadataItem.id);
            let detailData = (item as any).detailData;
            
            // Parse detailData if it's a string
            if (typeof detailData === 'string') {
              try {
                detailData = JSON.parse(detailData);
              } catch (e) {
                console.error('Failed to parse detailData:', e);
                detailData = null;
              }
            }
            
            const requiredConfig = REQUIRED_METADATA_CONCEPTS['Avatar'];
            setLevels(requiredConfig.levels);
            setColumnNames([...requiredConfig.columns]);
            
            if (detailData && typeof detailData === 'object' && detailData.rows) {
              setRows(detailData.rows || []);
            } else {
              setRows([]);
            }
          } catch (fallbackErr) {
            console.error('Error in fallback loading:', fallbackErr);
            setRows([]);
          }
        }
      } else if (isBeing) {
        // For Being, fetch Being values from Neo4j
        try {
          console.log('Fetching Being values...');
          const beingData = await apiService.getBeingValues() as { beings: string[] };
          console.log('Being data received:', beingData);
          const beings = beingData.beings || [];
          console.log('Being values count:', beings.length);
          
          if (beings.length === 0) {
            console.warn('No Being values found in Neo4j. Make sure Being nodes exist.');
            setError('No Being values found. Please ensure Being nodes exist in the Objects grid.');
          }
          
          // Set required config
          const requiredConfig = REQUIRED_METADATA_CONCEPTS['Being'];
          setLevels(requiredConfig.levels);
          setColumnNames([...requiredConfig.columns]);
          
          // Load existing detailData to preserve Definition values
          let existingDetailData: any = null;
          try {
            const item = await apiService.getMetadataItem(metadataItem.id);
            const detailDataStr = (item as any).detailData;
            if (detailDataStr) {
              existingDetailData = typeof detailDataStr === 'string' ? JSON.parse(detailDataStr) : detailDataStr;
            }
          } catch (e) {
            console.log('No existing detailData found, starting fresh');
          }
          
          // Create a map of existing definitions by Being value
          const existingDefinitions = new Map<string, string>();
          if (existingDetailData && existingDetailData.rows) {
            existingDetailData.rows.forEach((row: string[]) => {
              if (row.length >= 2 && row[0]) { // row[0] is Being
                existingDefinitions.set(row[0], row[1] || ''); // row[1] is Definition
              }
            });
          }
          
          // Build rows: one per Being value with Definition
          // The backend already provides all Being values in alphabetical order
          const newRows = beings.map(being => [
            being || '',      // Being (read-only)
            existingDefinitions.get(being) || '' // Definition (editable)
          ]);
          
          console.log('Built rows for Being:', newRows.length, 'rows');
          console.log('Sample rows:', newRows.slice(0, 3));
          
          if (newRows.length === 0) {
            console.warn('No rows to display - beings array was empty');
            setError('No Being values found. Please ensure Being nodes exist in the Objects grid.');
          }
          
          setRows(newRows);
        } catch (err) {
          console.error('Error fetching Being values:', err);
          setError(`Failed to load Being values: ${err instanceof Error ? err.message : 'Unknown error'}`);
          // Fall back to loading from detailData if API fails
          try {
            const item = await apiService.getMetadataItem(metadataItem.id);
            let detailData = (item as any).detailData;
            
            // Parse detailData if it's a string
            if (typeof detailData === 'string') {
              try {
                detailData = JSON.parse(detailData);
              } catch (e) {
                console.error('Failed to parse detailData:', e);
                detailData = null;
              }
            }
            
            const requiredConfig = REQUIRED_METADATA_CONCEPTS['Being'];
            setLevels(requiredConfig.levels);
            setColumnNames([...requiredConfig.columns]);
            
            if (detailData && typeof detailData === 'object' && detailData.rows) {
              setRows(detailData.rows || []);
            } else {
              setRows([]);
            }
          } catch (fallbackErr) {
            console.error('Error in fallback loading:', fallbackErr);
            setRows([]);
          }
        }
      } else if (isGrouping) {
        // For Grouping, fetch Grouping values with their Set values from Neo4j
        try {
          console.log('Fetching Grouping values with Set values...');
          const groupingData = await apiService.getGroupingValues() as { groupingPairs: Array<{ grouping: string; set: string }> };
          console.log('Grouping data received:', groupingData);
          const groupingPairs = groupingData.groupingPairs || [];
          console.log('Grouping-Set pairs count:', groupingPairs.length);
          
          if (groupingPairs.length === 0) {
            console.warn('No Grouping values found in Neo4j. Make sure Grouping nodes exist with Sets.');
            setError('No Grouping values found. Please ensure Grouping nodes exist in the Lists grid.');
          }
          
          // Set required config
          const requiredConfig = REQUIRED_METADATA_CONCEPTS['Grouping'];
          setLevels(requiredConfig.levels);
          setColumnNames([...requiredConfig.columns]);
          
          // Load existing detailData to preserve Definition values
          let existingDetailData: any = null;
          try {
            const item = await apiService.getMetadataItem(metadataItem.id);
            const detailDataStr = (item as any).detailData;
            console.log('Loading existing detailData for Grouping:', detailDataStr);
            if (detailDataStr) {
              existingDetailData = typeof detailDataStr === 'string' ? JSON.parse(detailDataStr) : detailDataStr;
              console.log('Parsed existing detailData:', existingDetailData);
            }
          } catch (e) {
            console.log('No existing detailData found, starting fresh:', e);
          }
          
          // Create a map of existing definitions by Set+Grouping combination
          // Since the same Grouping can appear with different Set values, we need to use both as the key
          const existingDefinitions = new Map<string, string>();
          if (existingDetailData && existingDetailData.rows) {
            console.log('Processing existing rows for definitions:', existingDetailData.rows.length);
            existingDetailData.rows.forEach((row: string[]) => {
              if (row.length >= 3 && row[0] && row[1]) { // row[0] is Set, row[1] is Grouping
                const key = `${row[0]}|${row[1]}`; // Use Set|Grouping as key
                existingDefinitions.set(key, row[2] || ''); // row[2] is Definition
                console.log(`Setting definition for Set "${row[0]}" + Grouping "${row[1]}": "${row[2]}"`);
              }
            });
            console.log('Total definitions loaded:', existingDefinitions.size);
          }
          
          // Build rows: one per Grouping with Set and Definition
          // The backend already provides all Set-Grouping pairs sorted by Set, then Grouping
          const newRows = groupingPairs.map(pair => {
            const key = `${pair.set}|${pair.grouping}`; // Use Set|Grouping as key
            const definition = existingDefinitions.get(key) || '';
            if (definition) {
              console.log(`Found saved definition for Set "${pair.set}" + Grouping "${pair.grouping}": "${definition}"`);
            }
            return [
              pair.set || '',      // Set (read-only)
              pair.grouping || '',   // Grouping (read-only)
              definition // Definition (editable)
            ];
          });
          
          console.log('Built rows for Grouping:', newRows.length, 'rows');
          console.log('Sample rows with definitions:', newRows.slice(0, 5).map(row => ({ set: row[0], grouping: row[1], definition: row[2] })));
          
          if (newRows.length === 0) {
            console.warn('No rows to display - groupingPairs array was empty');
            setError('No Grouping values found. Please ensure Grouping nodes exist in the Lists grid.');
          }
          
          setRows(newRows);
        } catch (err) {
          console.error('Error fetching Grouping values:', err);
          setError(`Failed to load Grouping values: ${err instanceof Error ? err.message : 'Unknown error'}`);
          // Fall back to loading from detailData if API fails
          try {
            const item = await apiService.getMetadataItem(metadataItem.id);
            let detailData = (item as any).detailData;
            
            // Parse detailData if it's a string
            if (typeof detailData === 'string') {
              try {
                detailData = JSON.parse(detailData);
              } catch (e) {
                console.error('Failed to parse detailData:', e);
                detailData = null;
              }
            }
            
            const requiredConfig = REQUIRED_METADATA_CONCEPTS['Grouping'];
            setLevels(requiredConfig.levels);
            setColumnNames([...requiredConfig.columns]);
            
            if (detailData && typeof detailData === 'object' && detailData.rows) {
              setRows(detailData.rows || []);
            } else {
              setRows([]);
            }
          } catch (fallbackErr) {
            console.error('Error in fallback loading:', fallbackErr);
            setRows([]);
          }
        }
      } else if (isVulqan) {
        try {
          console.log('Fetching Format V-I/V-II pairs for Vulqan...');
          const formatData = await apiService.getVulqanFormatValues() as { formatPairs: Array<{ formatI: string; formatII: string }> };
          console.log('Format V-I/V-II data received:', formatData);
          const formatPairs = formatData.formatPairs || [];
          console.log('Format pairs count:', formatPairs.length);
          
          if (formatPairs.length === 0) {
            console.warn('No Format V-I/V-II pairs found in Neo4j. Make sure Variables have formatI and formatII properties set.');
            setError('No Format V-I/V-II values found. Please ensure Variables have Format I and Format II values set.');
          }
          
          // Set required config
          const requiredConfig = REQUIRED_METADATA_CONCEPTS['Vulqan'];
          setLevels(requiredConfig.levels);
          setColumnNames([...requiredConfig.columns]);
          
          // Load existing detailData to preserve Definition values
          let existingDetailData: any = null;
          try {
            const item = await apiService.getMetadataItem(metadataItem.id);
            const detailDataStr = (item as any).detailData;
            if (detailDataStr) {
              existingDetailData = typeof detailDataStr === 'string' ? JSON.parse(detailDataStr) : detailDataStr;
            }
          } catch (e) {
            console.log('No existing detailData found, starting fresh');
          }
          
          // Create a map of existing definitions by Format V-II
          const existingDefinitions = new Map<string, string>();
          if (existingDetailData && existingDetailData.rows) {
            existingDetailData.rows.forEach((row: string[]) => {
              if (row.length >= 3 && row[1]) { // row[1] is Format V-II
                existingDefinitions.set(row[1], row[2] || ''); // row[2] is Definition
              }
            });
          }
          
          // Build rows: one per Format V-II with Format V-I and Definition
          // The backend already provides all combinations in the correct order (Format V-I, then Format V-II)
          const newRows = formatPairs.map(pair => [
            pair.formatI || '',      // Format V-I (read-only)
            pair.formatII || '',     // Format V-II (read-only)
            existingDefinitions.get(pair.formatII) || '' // Definition (editable)
          ]);
          
          console.log('Built rows for Vulqan:', newRows.length, 'rows');
          console.log('Sample rows:', newRows.slice(0, 3));
          
          if (newRows.length === 0) {
            console.warn('No rows to display - formatPairs was empty');
            setError('No Format V-I/V-II values found. Variables may not have Format I and Format II properties set yet.');
          }
          
          setRows(newRows);
        } catch (err) {
          console.error('Error fetching Format V-I/V-II pairs:', err);
          setError(`Failed to load Format V-I/V-II values: ${err instanceof Error ? err.message : 'Unknown error'}`);
          // Fall back to loading from detailData if API fails
          try {
            const item = await apiService.getMetadataItem(metadataItem.id);
            let detailData = (item as any).detailData;
            
            // Parse detailData if it's a string
            if (typeof detailData === 'string') {
              try {
                detailData = JSON.parse(detailData);
              } catch (e) {
                console.error('Failed to parse detailData:', e);
                detailData = null;
              }
            }
            
            const requiredConfig = REQUIRED_METADATA_CONCEPTS['Vulqan'];
            setLevels(requiredConfig.levels);
            setColumnNames([...requiredConfig.columns]);
            
            if (detailData && typeof detailData === 'object' && detailData.rows) {
              setRows(detailData.rows || []);
            } else {
              setRows([]);
            }
          } catch (fallbackErr) {
            console.error('Error in fallback loading:', fallbackErr);
            setRows([]);
          }
        }
      } else {
        // For non-Vulqan concepts, use existing logic
        const item = await apiService.getMetadataItem(metadataItem.id);
        let detailData = (item as any).detailData;
        
        if (detailData && typeof detailData === 'object') {
          // For required concepts, enforce the required levels and columns
          if (isRequired) {
            const requiredConfig = REQUIRED_METADATA_CONCEPTS[metadataItem.concept];
            setLevels(requiredConfig.levels);
            setColumnNames([...requiredConfig.columns]);
          } else {
            setLevels(detailData.levels || 1);
            setColumnNames(detailData.columns || ['']);
          }
          // If rows exist, use them; otherwise create 20 empty rows
          const loadedRows = detailData.rows || [];
          // Ensure at least 20 rows
          const currentLevels = isRequired ? REQUIRED_METADATA_CONCEPTS[metadataItem.concept].levels : (detailData.levels || 1);
          if (loadedRows.length < 20) {
            const emptyRows = Array(20 - loadedRows.length).fill(null).map(() => Array(currentLevels).fill(''));
            setRows([...loadedRows, ...emptyRows]);
          } else {
            setRows(loadedRows);
          }
        } else {
          // Initialize with default values - create 20 empty rows by default
          if (isRequired) {
            const requiredConfig = REQUIRED_METADATA_CONCEPTS[metadataItem.concept];
            setLevels(requiredConfig.levels);
            setColumnNames([...requiredConfig.columns]);
            setRows(Array(20).fill(null).map(() => Array(requiredConfig.levels).fill('')));
          } else {
            setLevels(1);
            setColumnNames([metadataItem.concept]);
            setRows(Array(20).fill(null).map(() => ['']));
          }
        }
      }
    } catch (err) {
      console.error('Error loading metadata detail:', err);
      // Initialize with defaults on error
      const isRequired = isRequiredConcept(metadataItem.concept);
      if (isRequired) {
        const requiredConfig = REQUIRED_METADATA_CONCEPTS[metadataItem.concept];
        setLevels(requiredConfig.levels);
        setColumnNames([...requiredConfig.columns]);
        setRows(Array(20).fill(null).map(() => Array(requiredConfig.levels).fill('')));
      } else {
        setLevels(1);
        setColumnNames([metadataItem.concept]);
        setRows(Array(20).fill(null).map(() => ['']));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Update columns when levels change (only for non-required concepts)
  useEffect(() => {
    const isRequired = metadataItem ? isRequiredConcept(metadataItem.concept) : false;
    if (!isRequired && levels !== columnNames.length) {
      const newColumns = Array(levels).fill('').map((_, index) => 
        columnNames[index] || ''
      );
      setColumnNames(newColumns);
      
      // Update rows to match new column count, ensure at least 20 rows
      setRows(prevRows => {
        const updatedRows = prevRows.map(row => {
          const newRow = Array(levels).fill('').map((_, index) => row[index] || '');
          return newRow;
        });
        
        // Ensure at least 20 rows
        if (updatedRows.length < 20) {
          const emptyRows = Array(20 - updatedRows.length).fill(null).map(() => Array(levels).fill(''));
          return [...updatedRows, ...emptyRows];
        }
        
        return updatedRows;
      });
    }
  }, [levels, metadataItem]);

  // Note: One of the columns should match the Concept value, but it doesn't have to be the first one
  // We'll validate this on save instead of enforcing it upfront

  const handleLevelChange = (newLevel: 1 | 2 | 3 | 4) => {
    const isRequired = metadataItem ? isRequiredConcept(metadataItem.concept) : false;
    if (!isRequired) {
      setLevels(newLevel);
    }
  };

  const handleColumnNameChange = (index: number, value: string) => {
    const isRequired = metadataItem ? isRequiredConcept(metadataItem.concept) : false;
    if (!isRequired) {
      const newColumns = [...columnNames];
      newColumns[index] = value;
      setColumnNames(newColumns);
    }
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const isVulqan = metadataItem?.concept === 'Vulqan' || metadataItem?.concept?.toLowerCase() === 'vulqan';
    const isBeing = metadataItem?.concept === 'Being' || metadataItem?.concept?.toLowerCase() === 'being';
    const isAvatar = metadataItem?.concept === 'Avatar' || metadataItem?.concept?.toLowerCase() === 'avatar';
    const isPart = metadataItem?.concept === 'Part' || metadataItem?.concept?.toLowerCase() === 'part';
    const isSection = metadataItem?.concept === 'Section' || metadataItem?.concept?.toLowerCase() === 'section';
    const isGroup = metadataItem?.concept === 'Group' || metadataItem?.concept?.toLowerCase() === 'group';
    const isGType = metadataItem?.concept === 'G-Type' || metadataItem?.concept?.toLowerCase() === 'g-type';
    const isSet = metadataItem?.concept === 'Set' || metadataItem?.concept?.toLowerCase() === 'set';
    const isGrouping = metadataItem?.concept === 'Grouping' || metadataItem?.concept?.toLowerCase() === 'grouping';
    
    // For Vulqan, only allow editing the Definition column (index 2)
    if (isVulqan && colIndex !== 2) {
      return; // Don't allow changes to Format V-I (0) or Format V-II (1)
    }
    
    // For Being, only allow editing the Definition column (index 1)
    if (isBeing && colIndex !== 1) {
      return; // Don't allow changes to Being (0)
    }
    
    // For Avatar, only allow editing the Definition column (index 2)
    if (isAvatar && colIndex !== 2) {
      return; // Don't allow changes to Being (0) or Avatar (1)
    }
    
    // For Part, only allow editing the Definition column (index 1)
    if (isPart && colIndex !== 1) {
      return; // Don't allow changes to Part (0)
    }
    
    // For Section, only allow editing the Definition column (index 2)
    if (isSection && colIndex !== 2) {
      return; // Don't allow changes to Part (0) or Section (1)
    }
    
    // For Group, only allow editing the Definition column (index 3)
    if (isGroup && colIndex !== 3) {
      return; // Don't allow changes to Part (0), Section (1), or Group (2)
    }
    
    // For G-Type, only allow editing the Definition column (index 1)
    if (isGType && colIndex !== 1) {
      return; // Don't allow changes to G-Type (0)
    }
    
    // For Set, only allow editing the Definition column (index 1)
    if (isSet && colIndex !== 1) {
      return; // Don't allow changes to Set (0)
    }
    
    // For Grouping, only allow editing the Definition column (index 2)
    if (isGrouping && colIndex !== 2) {
      return; // Don't allow changes to Set (0) or Grouping (1)
    }
    
    const newRows = [...rows];
    if (!newRows[rowIndex]) {
      newRows[rowIndex] = Array(levels).fill('');
    }
    newRows[rowIndex][colIndex] = value;
    console.log('handleCellChange for Avatar:', {
      rowIndex,
      colIndex,
      value,
      concept: metadataItem?.concept,
      isAvatar,
      updatedRow: newRows[rowIndex]
    });
    setRows(newRows);
  };

  const handleAddRow = () => {
    setRows([...rows, Array(levels).fill('')]);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startRowIndex: number, startColIndex: number) => {
    e.preventDefault();
    
    const pastedData = e.clipboardData.getData('text');
    if (!pastedData) return;

    // Parse the pasted data - Excel uses tabs for columns and newlines for rows
    const lines = pastedData.split(/\r?\n/).filter(line => line.trim() !== '');
    const parsedData: string[][] = lines.map(line => 
      line.split('\t').map(cell => cell.trim())
    );

    if (parsedData.length === 0) return;

    // Update rows starting from the clicked cell
    const newRows = [...rows];
    
    parsedData.forEach((pastedRow, rowOffset) => {
      const targetRowIndex = startRowIndex + rowOffset;
      
      // Ensure we have enough rows
      while (targetRowIndex >= newRows.length) {
        newRows.push(Array(levels).fill(''));
      }

      // Update cells in this row
      pastedRow.forEach((cellValue, colOffset) => {
        const targetColIndex = startColIndex + colOffset;
        if (targetColIndex < levels) {
          newRows[targetRowIndex][targetColIndex] = cellValue;
        }
      });
    });

    setRows(newRows);
  };

  const handleSave = async () => {
    if (!metadataItem) return;

    const isRequired = isRequiredConcept(metadataItem.concept);
    const isVulqan = metadataItem.concept === 'Vulqan' || metadataItem.concept?.toLowerCase() === 'vulqan';
    const isBeing = metadataItem.concept === 'Being' || metadataItem.concept?.toLowerCase() === 'being';
    const isAvatar = metadataItem.concept === 'Avatar' || metadataItem.concept?.toLowerCase() === 'avatar';
    const isPart = metadataItem.concept === 'Part' || metadataItem.concept?.toLowerCase() === 'part';
    const isSection = metadataItem.concept === 'Section' || metadataItem.concept?.toLowerCase() === 'section';
    const isGroup = metadataItem.concept === 'Group' || metadataItem.concept?.toLowerCase() === 'group';
    const isGType = metadataItem.concept === 'G-Type' || metadataItem.concept?.toLowerCase() === 'g-type';
    const isSet = metadataItem.concept === 'Set' || metadataItem.concept?.toLowerCase() === 'set';
    const isGrouping = metadataItem.concept === 'Grouping' || metadataItem.concept?.toLowerCase() === 'grouping';
    
    // Validate that at least one column matches the Concept (can be any column, not just the first)
    // Skip this validation for required concepts as they have fixed column names
    let conceptColumnIndex = -1;
    if (!isRequired) {
      conceptColumnIndex = columnNames.findIndex(
        col => col.toLowerCase() === metadataItem.concept.toLowerCase()
      );
      
      if (conceptColumnIndex === -1) {
        setError(`At least one column name must match the Concept value: "${metadataItem.concept}". Please name one of your columns "${metadataItem.concept}".`);
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      // Prepare detail data
      // For Vulqan, Being, Avatar, and Part, keep ALL rows (they're dynamically populated)
      // For other concepts, filter out completely empty rows
      console.log('Before filtering - rows count:', rows.length, 'concept:', metadataItem.concept);
      console.log('Sample rows before filtering:', rows.slice(0, 3));
      
      const filteredRows = (isVulqan || isBeing || isAvatar || isPart || isSection || isGroup || isGType || isSet || isGrouping)
        ? rows.filter(row => row && row.length > 0) // Keep all rows (they're dynamically populated)
        : rows.filter(row => row.some(cell => cell && cell.trim() !== '')); // Remove completely empty rows
      
      console.log('After filtering - filteredRows count:', filteredRows.length);
      console.log('Sample filteredRows:', filteredRows.slice(0, 3));
      
      const detailData: ModalData = {
        levels,
        columns: columnNames,
        rows: filteredRows
      };
      
      console.log('DetailData to save (first 3 rows):', {
        levels: detailData.levels,
        columns: detailData.columns,
        rowsCount: detailData.rows.length,
        firstThreeRows: detailData.rows.slice(0, 3)
      });

      // Calculate number and examples
      // Number: Always use the count of rows in the widget
      const number = filteredRows.length.toString();
      
      // Examples: Use values from the column that matches the Concept name
      // For Vulqan, use Format V-II column (index 1)
      // For other concepts, use the column whose name matches the Concept
      let examples = '';
      
      if (isVulqan) {
        // For Vulqan, use Format V-II column (index 1)
        const formatIIValues = filteredRows
          .map(row => row[1]?.trim())
          .filter(val => val !== '');
        const distinctValues = [...new Set(formatIIValues)];
        examples = distinctValues.join(', ');
      } else if (isBeing) {
        // For Being, use Being column (index 0)
        const beingValues = filteredRows
          .map(row => row[0]?.trim())
          .filter(val => val !== '');
        const distinctValues = [...new Set(beingValues)];
        examples = distinctValues.join(', ');
      } else if (isAvatar) {
        // For Avatar, use Avatar column (index 1)
        const avatarValues = filteredRows
          .map(row => row[1]?.trim())
          .filter(val => val !== '');
        const distinctValues = [...new Set(avatarValues)];
        examples = distinctValues.join(', ');
      } else if (isPart) {
        // For Part, use Part column (index 0)
        const partValues = filteredRows
          .map(row => row[0]?.trim())
          .filter(val => val !== '');
        const distinctValues = [...new Set(partValues)];
        examples = distinctValues.join(', ');
      } else if (isSection) {
        // For Section, use Section column (index 1)
        const sectionValues = filteredRows
          .map(row => row[1]?.trim())
          .filter(val => val !== '');
        const distinctValues = [...new Set(sectionValues)];
        examples = distinctValues.join(', ');
      } else if (isGroup) {
        // For Group, use Group column (index 2)
        const groupValues = filteredRows
          .map(row => row[2]?.trim())
          .filter(val => val !== '');
        const distinctValues = [...new Set(groupValues)];
        examples = distinctValues.join(', ');
      } else if (isGType) {
        // For G-Type, use G-Type column (index 0)
        const gTypeValues = filteredRows
          .map(row => row[0]?.trim())
          .filter(val => val !== '');
        const distinctValues = [...new Set(gTypeValues)];
        examples = distinctValues.join(', ');
      } else if (isSet) {
        // For Set, use Set column (index 0)
        const setValues = filteredRows
          .map(row => row[0]?.trim())
          .filter(val => val !== '');
        const distinctValues = [...new Set(setValues)];
        examples = distinctValues.join(', ');
      } else if (isGrouping) {
        // For Grouping, use Grouping column (index 1)
        const groupingValues = filteredRows
          .map(row => row[1]?.trim())
          .filter(val => val !== '');
        const distinctValues = [...new Set(groupingValues)];
        examples = distinctValues.join(', ');
      } else if (conceptColumnIndex >= 0) {
        // For other concepts, use the concept column
        const conceptColumnValues = filteredRows
          .map(row => row[conceptColumnIndex]?.trim())
          .filter(val => val !== '');
        const distinctValues = [...new Set(conceptColumnValues)];
        examples = distinctValues.join(', ');
      }

      // Save detail data to backend
      console.log('Saving metadata detail:', {
        itemId: metadataItem.id,
        concept: metadataItem.concept,
        filteredRowsCount: filteredRows.length,
        detailData: detailData,
        number,
        examples
      });
      
      await apiService.updateMetadataItem(metadataItem.id, {
        number,
        examples,
        detailData: JSON.stringify(detailData)
      });

      console.log('Metadata detail saved successfully');
      console.log('Saved detailData:', JSON.stringify(detailData, null, 2));
      
      // Close modal and refresh
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save metadata detail');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !metadataItem) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6 w-full max-w-6xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div>
            <h3 className="text-xl font-semibold text-ag-dark-text">Metadata Detail</h3>
            <p className="text-sm text-ag-dark-text-secondary mt-1">
              Layer: <span className="font-medium">{metadataItem.layer}</span> | 
              Concept: <span className="font-medium">{metadataItem.concept}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto mb-6 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-ag-dark-text-secondary">Loading...</div>
            </div>
          ) : (
            <>
              {/* Levels Radio Buttons */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-ag-dark-text mb-3">
                  Levels <span className="text-ag-dark-error">*</span>
                  {metadataItem && isRequiredConcept(metadataItem.concept) && (
                    <span className="ml-2 text-xs text-ag-dark-text-secondary">(Required - cannot be changed)</span>
                  )}
                </label>
                <div className="flex gap-6">
                  {[1, 2, 3, 4].map((level) => {
                    const isRequired = metadataItem ? isRequiredConcept(metadataItem.concept) : false;
                    const isSelected = levels === level;
                    const isDisabled = isRequired || isSaving;
                    return (
                      <label 
                        key={level} 
                        className={`flex items-center gap-2 ${isDisabled && !isSelected ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      >
                        <input
                          type="radio"
                          name="levels"
                          value={level}
                          checked={isSelected}
                          onChange={() => handleLevelChange(level as 1 | 2 | 3 | 4)}
                          disabled={isDisabled}
                          className="w-5 h-5 text-ag-dark-accent focus:ring-ag-dark-accent"
                        />
                        <span className={`text-ag-dark-text ${isDisabled && !isSelected ? 'opacity-50' : ''}`}>{level}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Column Headers */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-ag-dark-text">
                    Column Names <span className="text-ag-dark-error">*</span>
                    {metadataItem && isRequiredConcept(metadataItem.concept) && (
                      <span className="ml-2 text-xs text-ag-dark-text-secondary">(Required - cannot be changed)</span>
                    )}
                  </label>
                  {metadataItem?.concept !== 'Vulqan' && metadataItem?.concept?.toLowerCase() !== 'vulqan' &&
                   metadataItem?.concept !== 'Being' && metadataItem?.concept?.toLowerCase() !== 'being' &&
                   metadataItem?.concept !== 'Avatar' && metadataItem?.concept?.toLowerCase() !== 'avatar' &&
                   metadataItem?.concept !== 'Part' && metadataItem?.concept?.toLowerCase() !== 'part' &&
                   metadataItem?.concept !== 'Section' && metadataItem?.concept?.toLowerCase() !== 'section' &&
                   metadataItem?.concept !== 'Group' && metadataItem?.concept?.toLowerCase() !== 'group' &&
                   metadataItem?.concept !== 'G-Type' && metadataItem?.concept?.toLowerCase() !== 'g-type' &&
                   metadataItem?.concept !== 'Set' && metadataItem?.concept?.toLowerCase() !== 'set' &&
                   metadataItem?.concept !== 'Grouping' && metadataItem?.concept?.toLowerCase() !== 'grouping' && (
                    <button
                      onClick={handleAddRow}
                      disabled={isSaving}
                      className="px-3 py-1 text-sm bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors disabled:opacity-50"
                    >
                      + Add Row
                    </button>
                  )}
                </div>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${levels}, 1fr)` }}>
                  {columnNames.map((name, index) => {
                    const isRequired = metadataItem ? isRequiredConcept(metadataItem.concept) : false;
                    const matchesConcept = name.toLowerCase() === metadataItem.concept.toLowerCase();
                    return (
                      <div key={index}>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => handleColumnNameChange(index, e.target.value)}
                          placeholder={`Column ${index + 1}${matchesConcept ? ` (matches "${metadataItem.concept}")` : ''}`}
                          disabled={isSaving || isRequired}
                          className={`w-full px-3 py-2 bg-ag-dark-bg border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                            matchesConcept
                              ? 'border-green-500'
                              : 'border-ag-dark-border'
                          } ${isRequired ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                        {matchesConcept && (
                          <p className="text-xs text-green-500 mt-1">
                            ✓ Matches Concept: "{metadataItem.concept}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!isRequiredConcept(metadataItem.concept) && (
                  <p className="text-xs text-ag-dark-text-secondary mt-2">
                    Note: At least one column name must match the Concept value: "{metadataItem.concept}"
                  </p>
                )}
              </div>

              {/* Data Rows */}
              <div className="mb-4">
                
                <div className="border border-ag-dark-border rounded overflow-hidden">
                  {/* Header Row */}
                  <div 
                    className="grid gap-2 p-2 bg-ag-dark-bg border-b border-ag-dark-border font-medium text-sm text-ag-dark-text"
                    style={{ gridTemplateColumns: `40px repeat(${levels}, 1fr)` }}
                  >
                    <div className="text-center">#</div>
                    {columnNames.map((name, index) => (
                      <div key={index} className="px-2">
                        {name || `Column ${index + 1}`}
                      </div>
                    ))}
                  </div>

                  {/* Data Rows */}
                  <div className="max-h-[600px] overflow-y-auto overflow-x-visible" style={{ minHeight: '200px' }}>
                    {rows.length === 0 ? (
                      <div className="p-8 text-center text-ag-dark-text-secondary">
                        <p>No Format V-I/V-II values found.</p>
                        <p className="text-sm mt-2">This should not happen. Please refresh the page.</p>
                      </div>
                    ) : (
                      rows.map((row, rowIndex) => (
                      <div
                        key={rowIndex}
                        className="grid gap-2 p-2 border-b border-ag-dark-border hover:bg-ag-dark-bg/50"
                        style={{ gridTemplateColumns: `40px repeat(${levels}, 1fr)` }}
                      >
                        <div className="flex items-center justify-center text-sm text-ag-dark-text-secondary">
                          {rowIndex + 1}
                        </div>
                        {Array(levels).fill(0).map((_, colIndex) => {
                          const isVulqan = metadataItem?.concept === 'Vulqan' || metadataItem?.concept?.toLowerCase() === 'vulqan';
                          const isBeing = metadataItem?.concept === 'Being' || metadataItem?.concept?.toLowerCase() === 'being';
                          const isAvatar = metadataItem?.concept === 'Avatar' || metadataItem?.concept?.toLowerCase() === 'avatar';
                          const isPart = metadataItem?.concept === 'Part' || metadataItem?.concept?.toLowerCase() === 'part';
                          const isSection = metadataItem?.concept === 'Section' || metadataItem?.concept?.toLowerCase() === 'section';
                          const isGroup = metadataItem?.concept === 'Group' || metadataItem?.concept?.toLowerCase() === 'group';
                          const isGType = metadataItem?.concept === 'G-Type' || metadataItem?.concept?.toLowerCase() === 'g-type';
                          const isSet = metadataItem?.concept === 'Set' || metadataItem?.concept?.toLowerCase() === 'set';
                          const isGrouping = metadataItem?.concept === 'Grouping' || metadataItem?.concept?.toLowerCase() === 'grouping';
                          // For Vulqan: Format V-I (0) and Format V-II (1) are read-only, Definition (2) is editable
                          // For Being: Being (0) is read-only, Definition (1) is editable
                          // For Avatar: Being (0) and Avatar (1) are read-only, Definition (2) is editable
                          // For Part: Part (0) is read-only, Definition (1) is editable
                          // For Section: Part (0) and Section (1) are read-only, Definition (2) is editable
                          // For Group: Part (0), Section (1), and Group (2) are read-only, Definition (3) is editable
                          // For G-Type: G-Type (0) is read-only, Definition (1) is editable
                          // For Set: Set (0) is read-only, Definition (1) is editable
                          // For Grouping: Set (0) and Grouping (1) are read-only, Definition (2) is editable
                          const isReadOnly = (isVulqan && colIndex < 2) || (isBeing && colIndex < 1) || (isAvatar && colIndex < 2) || (isPart && colIndex < 1) || (isSection && colIndex < 2) || (isGroup && colIndex < 3) || (isGType && colIndex < 1) || (isSet && colIndex < 1) || (isGrouping && colIndex < 2);
                          return (
                            <input
                              key={colIndex}
                              type="text"
                              value={row[colIndex] || ''}
                              onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                              onPaste={isReadOnly ? undefined : (e) => handlePaste(e, rowIndex, colIndex)}
                              disabled={isSaving || isReadOnly}
                              className={`px-2 py-1 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                                isReadOnly ? 'opacity-60 cursor-not-allowed bg-ag-dark-bg' : ''
                              }`}
                              placeholder={isReadOnly ? `${columnNames[colIndex] || `column ${colIndex + 1}`} (read-only)` : `Enter ${columnNames[colIndex] || `column ${colIndex + 1}`} value`}
                              readOnly={isReadOnly}
                            />
                          );
                        })}
                      </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900 bg-opacity-20 border border-red-500 rounded text-red-400 text-sm flex-shrink-0">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 flex-shrink-0 border-t border-ag-dark-border pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-surface transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

