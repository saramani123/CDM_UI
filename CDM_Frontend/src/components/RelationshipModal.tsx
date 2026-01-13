import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, Link, Check, Trash2, ArrowUpAZ, Upload, Plus } from 'lucide-react';
import { DataGrid } from './DataGrid';
import { objectColumns, parseDriverField } from '../data/mockData';
import { apiService } from '../services/api';
import type { ObjectData } from '../data/mockData';
import { RelationshipCustomSortModal } from './RelationshipCustomSortModal';
import { RelationshipCsvUploadModal, type ProcessedRelationship } from './RelationshipCsvUploadModal';
import { BulkEditRelationshipsModal } from './BulkEditRelationshipsModal';
import { getGridDriverDisplayValue } from '../utils/driverAbbreviations';
import { useDrivers } from '../hooks/useDrivers';

interface InitialRelationship {
  targetObject: ObjectData;
  relationshipType: 'Inter-Table' | 'Blood' | 'Subtype' | 'Intra-Table';
  role: string;
}

interface RelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedObject: ObjectData | null; // For single-object mode (backward compatibility)
  selectedObjects?: ObjectData[]; // For bulk mode (multiple source objects)
  allObjects: ObjectData[];
  onSave?: () => void; // Callback to refresh main data
  initialRelationships?: InitialRelationship[]; // Pre-selected relationships from CSV upload
  onRelationshipsChange?: (relationships: any[]) => void; // Callback to store relationships for temporary objects
  isBulkMode?: boolean; // Flag to indicate bulk edit mode
  objectsOrderSortOrder?: {
    beingOrder: string[];
    avatarOrders: Record<string, string[]>;
    objectOrders: Record<string, string[]>;
  };
  isObjectsOrderEnabled?: boolean;
}

interface RelationshipData {
  objectId: string;
  isSelected: boolean;
  relationshipType: 'Inter-Table' | 'Blood' | 'Subtype' | 'Intra-Table';
  roles: string; // User-added roles only (comma-separated), default role word is stored separately
  defaultRoleWord: string; // The default role word (source object name) - not shown in UI
  frequency: 'Critical' | 'Likely' | 'Possible';
  hasMixedTypes?: boolean; // Flag to indicate mixed relationship types
}

// New interface for grid-based relationship rows
interface RelationshipGridRow {
  id: string; // Unique ID for this row
  sector: string; // Selected sector (or "ALL")
  domain: string; // Selected domain (or "ALL")
  country: string; // Selected country (or "ALL")
  being: string; // Selected being
  avatar: string; // Selected avatar
  object: string; // Selected object
  relationshipType: 'Inter-Table' | 'Blood' | 'Subtype' | 'Intra-Table';
  frequency: 'Critical' | 'Likely' | 'Possible';
  roles: string; // Comma-separated role words
}

export const RelationshipModal: React.FC<RelationshipModalProps> = ({
  isOpen,
  onClose,
  selectedObject,
  selectedObjects = [],
  allObjects,
  onSave,
  initialRelationships = [],
  onRelationshipsChange,
  isBulkMode = false,
  objectsOrderSortOrder,
  isObjectsOrderEnabled = false
}) => {
  // Determine source objects: use selectedObjects if provided (bulk mode), otherwise use selectedObject (single mode)
  const sourceObjects = isBulkMode && selectedObjects.length > 0 
    ? selectedObjects 
    : selectedObject 
      ? [selectedObject] 
      : [];
  const [relationshipData, setRelationshipData] = useState<Record<string, RelationshipData>>({});
  const [initialRelationshipData, setInitialRelationshipData] = useState<Record<string, RelationshipData>>({}); // Track initial state to detect changes
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCustomSortOpen, setIsCustomSortOpen] = useState(false);
  const [customSortRules, setCustomSortRules] = useState<Array<{
    id: string;
    column: string;
    sortOn: string;
    order: 'asc' | 'desc';
  }>>([]);
  const [isRelationshipOrderEnabled, setIsRelationshipOrderEnabled] = useState(isObjectsOrderEnabled);
  const [isRelationshipCsvUploadOpen, setIsRelationshipCsvUploadOpen] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set()); // Track selected rows for bulk editing
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false); // Bulk edit modal state

  // NEW: Grid-based relationship rows (empty by default)
  const [relationshipRows, setRelationshipRows] = useState<RelationshipGridRow[]>([]);
  
  // Get drivers data for dropdowns
  const { drivers: driversData } = useDrivers();
  
  // Get distinct values for dropdowns from allObjects
  const distinctSectors = Array.from(new Set(allObjects.map(obj => {
    const parsed = parseDriverField(obj.driver || '');
    return parsed.sector || 'ALL';
  }))).sort();
  const distinctDomains = Array.from(new Set(allObjects.map(obj => {
    const parsed = parseDriverField(obj.driver || '');
    return parsed.domain || 'ALL';
  }))).sort();
  const distinctCountries = Array.from(new Set(allObjects.map(obj => {
    const parsed = parseDriverField(obj.driver || '');
    return parsed.country || 'ALL';
  }))).sort();
  const distinctBeings = Array.from(new Set(allObjects.map(obj => obj.being).filter(Boolean))).sort();
  
  // Helper function to get avatars for a specific being
  const getAvatarsForBeing = (being: string): string[] => {
    if (!being) return [];
    return Array.from(new Set(
      allObjects
        .filter(obj => obj.being === being)
        .map(obj => obj.avatar)
        .filter(Boolean)
    )).sort();
  };
  
  // Helper function to get objects for a specific being and avatar
  const getObjectsForBeingAndAvatar = (being: string, avatar: string): string[] => {
    if (!being || !avatar) return [];
    return Array.from(new Set(
      allObjects
        .filter(obj => obj.being === being && obj.avatar === avatar)
        .map(obj => obj.object)
        .filter(Boolean)
    )).sort();
  };

  // Track if initialization is in progress to prevent duplicate calls
  const isInitializingRef = useRef(false);
  const initializationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize relationship data when modal opens
  useEffect(() => {
    // Clear any pending initialization
    if (initializationTimerRef.current) {
      clearTimeout(initializationTimerRef.current);
      initializationTimerRef.current = null;
    }
    
    if (isOpen && sourceObjects.length > 0 && allObjects.length > 0) {
      // Set default sorting to Being, Avatar, Object (A-Z) when modal opens
      // Only set if customSortRules is empty (user hasn't set custom sort yet)
      if (customSortRules.length === 0) {
        setCustomSortRules([
          { id: '1', column: 'being', sortOn: 'being', order: 'asc' },
          { id: '2', column: 'avatar', sortOn: 'avatar', order: 'asc' },
          { id: '3', column: 'object', sortOn: 'object', order: 'asc' }
        ]);
      }
      
      // Use a small delay to allow any pending state updates to complete
      // Only initialize if not already initializing
      if (!isInitializingRef.current) {
        initializationTimerRef.current = setTimeout(() => {
          if (!isInitializingRef.current) {
            initializeRelationshipData();
          }
        }, 150);
      }
      
      return () => {
        if (initializationTimerRef.current) {
          clearTimeout(initializationTimerRef.current);
          initializationTimerRef.current = null;
        }
      };
    }
    // Reset relationship data when modal closes
    if (!isOpen) {
      setRelationshipData({});
      setInitialRelationshipData({}); // Reset initial state tracking
      setSelectedRowIds(new Set()); // Reset selected rows for bulk editing
      setIsBulkEditOpen(false); // Close bulk edit modal if open
      setRelationshipRows([]); // Reset grid rows
      // Don't reset customSortRules - keep them for next time modal opens
      // Only reset if user explicitly clears custom sort
      isInitializingRef.current = false;
      if (initializationTimerRef.current) {
        clearTimeout(initializationTimerRef.current);
        initializationTimerRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sourceObjects.length, allObjects.length]);

  const initializeRelationshipData = async () => {
    if (sourceObjects.length === 0) return;
    
    // Prevent duplicate calls - if already initializing, skip
    if (isInitializingRef.current) {
      return;
    }
    isInitializingRef.current = true;

    setLoading(true);
    try {
      // For bulk mode, we don't load existing relationships (they're just for reference)
      // In bulk mode, we're creating new relationships, not editing existing ones
      // For single mode, load existing relationships
      const isTemporaryObject = sourceObjects.length === 1 && 
        (sourceObjects[0].id === 'temp-new-object' || sourceObjects[0].id.startsWith('temp-'));
      
      // Check if this is a cloned unsaved object - use relationships from cloned data
      const isClonedObject = sourceObjects.length === 1 && 
        sourceObjects[0]._isCloned && 
        !sourceObjects[0]._isSaved;
      
      // Load existing relationships ONCE before the loop (not inside the loop)
      let allExistingRelationships: any[] = [];
      if (!isBulkMode && sourceObjects.length === 1 && !isTemporaryObject) {
        if (isClonedObject) {
          // For cloned objects, use relationships from the cloned data
          allExistingRelationships = sourceObjects[0].relationshipsList || [];
        } else {
          // For saved objects, load from API ONCE
          const existingRelationships = await apiService.getObjectRelationships(sourceObjects[0].id) as any;
          allExistingRelationships = existingRelationships.relationshipsList || [];
        }
      }
      
      // NEW BEHAVIOR: Load only ADDITIONAL relationships (non-default ones)
      // Default relationships have: role = source object name, type = Inter-Table (others) or Intra-Table (self), frequency = Possible
      const sourceObjectName = sourceObjects[0]?.object || '';
      const additionalRelationships: RelationshipGridRow[] = [];
      
      // Group relationships by target object (S, D, C, Being, Avatar, Object combination)
      const relationshipGroups = new Map<string, {
        sector: string;
        domain: string;
        country: string;
        being: string;
        avatar: string;
        object: string;
        types: Set<string>;
        frequencies: Set<string>;
        roles: Set<string>;
      }>();
      
      for (const rel of allExistingRelationships) {
        // Check if this is a default relationship
        const isDefault = rel.role?.toLowerCase() === sourceObjectName.toLowerCase() &&
                         rel.frequency === 'Possible' &&
                         (rel.type === 'Inter-Table' || rel.type === 'Intra-Table');
        
        // Skip default relationships - we only want additional ones
        if (isDefault) {
          continue;
        }
        
        // This is an additional relationship - add it to the grid
        const key = `${rel.toBeing || 'ALL'}|${rel.toAvatar || 'ALL'}|${rel.toObject || 'ALL'}`;
        
        if (!relationshipGroups.has(key)) {
          // Find the target object to get S, D, C values
          const targetObj = allObjects.find(obj => 
            obj.being === rel.toBeing && 
            obj.avatar === rel.toAvatar && 
            obj.object === rel.toObject
          );
          
          const parsed = targetObj ? parseDriverField(targetObj.driver || '') : { sector: 'ALL', domain: 'ALL', country: 'ALL' };
          
          relationshipGroups.set(key, {
            sector: parsed.sector || 'ALL',
            domain: parsed.domain || 'ALL',
            country: parsed.country || 'ALL',
            being: rel.toBeing || 'ALL',
            avatar: rel.toAvatar || 'ALL',
            object: rel.toObject || 'ALL',
            types: new Set(),
            frequencies: new Set(),
            roles: new Set()
          });
        }
        
        const group = relationshipGroups.get(key)!;
        if (rel.type) group.types.add(rel.type);
        if (rel.frequency) group.frequencies.add(rel.frequency);
        if (rel.role && rel.role.toLowerCase() !== sourceObjectName.toLowerCase()) {
          group.roles.add(rel.role.trim());
        }
      }
      
      // Convert grouped relationships to grid rows
      for (const [key, group] of relationshipGroups.entries()) {
        // Determine relationship type (use first type if multiple, or default)
        const relationshipType = group.types.size > 0 
          ? (Array.from(group.types)[0] as 'Inter-Table' | 'Blood' | 'Subtype' | 'Intra-Table')
          : 'Inter-Table';
        
        // Determine frequency (use first frequency if multiple, or default)
        const frequency = group.frequencies.size > 0
          ? (Array.from(group.frequencies)[0] as 'Critical' | 'Likely' | 'Possible')
          : 'Possible';
        
        // Combine all roles
        const roles = Array.from(group.roles).join(', ');
        
        additionalRelationships.push({
          id: `row-${Date.now()}-${Math.random()}`,
          sector: group.sector,
          domain: group.domain,
          country: group.country,
          being: group.being,
          avatar: group.avatar,
          object: group.object,
          relationshipType: relationshipType,
          frequency: frequency,
          roles: roles
        });
      }
      
      // Set the grid rows (empty by default, populated with additional relationships)
      setRelationshipRows(additionalRelationships);
      
      // Keep the old relationshipData structure for backward compatibility during transition
      // But initialize it as empty since we're using the new grid
      const initialData: Record<string, RelationshipData> = {};
      
      setRelationshipData(initialData);
      setInitialRelationshipData(JSON.parse(JSON.stringify(initialData)));

      // Apply initial relationships from CSV upload or stored relationships if any
      if (initialRelationships.length > 0) {
        for (const initialRel of initialRelationships) {
          const targetObjId = initialRel.targetObject.id;
          if (initialData[targetObjId]) {
            // If relationship already exists, separate default role word from user-added roles
            const existingUserRoles = initialData[targetObjId].roles || '';
            const newRoles = initialRel.role || '';
            // Combine user-added roles, avoiding duplicates and excluding default role word
            const roleSet = new Set<string>();
            if (existingUserRoles) {
              existingUserRoles.split(', ').forEach(r => { 
                if (r.trim() && r.trim().toLowerCase() !== defaultRoleWord.toLowerCase()) {
                  roleSet.add(r.trim());
                }
              });
            }
            if (newRoles) {
              newRoles.split(', ').forEach(r => { 
                if (r.trim() && r.trim().toLowerCase() !== defaultRoleWord.toLowerCase()) {
                  roleSet.add(r.trim());
                }
              });
            }
            const combinedUserRoles = Array.from(roleSet).join(', ');
            
            initialData[targetObjId] = {
              ...initialData[targetObjId],
              relationshipType: initialRel.relationshipType,
              roles: combinedUserRoles, // Only user-added roles
              frequency: initialRel.relationshipType === 'Blood' ? 'Critical' : 'Possible',
              hasMixedTypes: false
            };
          } else {
            // New relationship - separate default role word from user-added roles
            const userRoles = initialRel.role 
              ? initialRel.role.split(', ').filter(r => r.trim() && r.trim().toLowerCase() !== defaultRoleWord.toLowerCase()).join(', ')
              : '';
            
            initialData[targetObjId] = {
              objectId: targetObjId,
              isSelected: true,
              relationshipType: initialRel.relationshipType,
              roles: userRoles, // Only user-added roles
              defaultRoleWord: defaultRoleWord,
              frequency: initialRel.relationshipType === 'Blood' ? 'Critical' : 'Possible',
              hasMixedTypes: false
            };
          }
        }
      }

      setRelationshipData(initialData);
      setInitialRelationshipData(JSON.parse(JSON.stringify(initialData)));
    } catch (error) {
      console.error('Failed to load existing relationships:', error);
      // On error, start with empty grid
      setRelationshipRows([]);
      setRelationshipData({});
      setInitialRelationshipData({});
    } finally {
      setLoading(false);
      isInitializingRef.current = false;
    }
  };
  
  // Helper function to find objects matching S, D, C, Being, Avatar, Object criteria
  // This validates that the combination exists in the dataset
  const findMatchingObjects = (sector: string, domain: string, country: string, being: string, avatar: string, object: string): ObjectData[] => {
    if (!being || !avatar || !object) {
      return []; // Must have being, avatar, and object selected
    }
    
    return allObjects.filter(obj => {
      const parsed = parseDriverField(obj.driver || '');
      const objSector = parsed.sector || 'ALL';
      const objDomain = parsed.domain || 'ALL';
      const objCountry = parsed.country || 'ALL';
      
      return (sector === 'ALL' || objSector === sector || (sector === '' && objSector === 'ALL')) &&
             (domain === 'ALL' || objDomain === domain || (domain === '' && objDomain === 'ALL')) &&
             (country === 'ALL' || objCountry === country || (country === '' && objCountry === 'ALL')) &&
             obj.being === being &&
             obj.avatar === avatar &&
             obj.object === object;
    });
  };
  
  // Helper function to check if a row combination already exists
  const isRowDuplicate = (sector: string, domain: string, country: string, being: string, avatar: string, object: string, excludeRowId?: string): boolean => {
    return relationshipRows.some(row => {
      if (excludeRowId && row.id === excludeRowId) return false;
      return row.sector === sector &&
             row.domain === domain &&
             row.country === country &&
             row.being === being &&
             row.avatar === avatar &&
             row.object === object;
    });
  };
  
  // Add a new row to the grid
  const handleAddRow = () => {
    const newRow: RelationshipGridRow = {
      id: `row-${Date.now()}-${Math.random()}`,
      sector: 'ALL',
      domain: 'ALL',
      country: 'ALL',
      being: '',
      avatar: '',
      object: '',
      relationshipType: 'Inter-Table',
      frequency: 'Possible',
      roles: ''
    };
    setRelationshipRows(prev => [...prev, newRow]);
  };
  
  // Remove a row from the grid
  const handleRemoveRow = (rowId: string) => {
    setRelationshipRows(prev => prev.filter(row => row.id !== rowId));
  };
  
  // Update a row field
  const handleRowFieldChange = (rowId: string, field: keyof RelationshipGridRow, value: any) => {
    setRelationshipRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      
      const updatedRow = { ...row, [field]: value };
      
      // Cascading dropdowns: When being changes, clear avatar and object
      if (field === 'being') {
        updatedRow.avatar = '';
        updatedRow.object = '';
      }
      
      // Cascading dropdowns: When avatar changes, clear object
      if (field === 'avatar') {
        updatedRow.object = '';
      }
      
      // Preset: If same object as source → Intra-Table (auto, not editable)
      if (field === 'object' && value) {
        const sourceObjectName = sourceObjects[0]?.object || '';
        if (value === sourceObjectName) {
          updatedRow.relationshipType = 'Intra-Table';
        }
      }
      
      // Preset: If relationship type = Blood → frequency = Critical (auto, not editable)
      if (field === 'relationshipType' && value === 'Blood') {
        updatedRow.frequency = 'Critical';
      }
      
      // Validate for duplicates when key fields change (S, D, C, Being, Avatar, Object)
      // Only check against OTHER rows in the grid (exclude current row)
      const keyFields = ['sector', 'domain', 'country', 'being', 'avatar', 'object'];
      if (keyFields.includes(field) && updatedRow.being && updatedRow.avatar && updatedRow.object) {
        const isDuplicate = isRowDuplicate(
          updatedRow.sector,
          updatedRow.domain,
          updatedRow.country,
          updatedRow.being,
          updatedRow.avatar,
          updatedRow.object,
          rowId // Exclude current row from duplicate check
        );
        
        if (isDuplicate) {
          // Show error and revert the change
          setTimeout(() => {
            alert('A row with this S, D, C, Being, Avatar, Object combination already exists in the grid. Please use a different combination or edit the existing row.');
          }, 100);
          return row; // Revert to original row
        }
      }
      
      return updatedRow;
    }));
  };
  
  // Validate row before adding/updating
  // NOTE: This only checks for duplicates WITHIN the grid rows, NOT against Neo4j default relationships
  // Default relationships (role = object name) are separate and always exist
  const validateRow = (row: RelationshipGridRow, excludeRowId?: string): string | null => {
    if (!row.being || !row.avatar || !row.object) {
      return 'Please select Being, Avatar, and Object';
    }
    
    // Check for duplicate combination WITHIN THE GRID ONLY (not against Neo4j)
    // This ensures no two rows in the modal have the same S, D, C, Being, Avatar, Object combination
    if (isRowDuplicate(row.sector, row.domain, row.country, row.being, row.avatar, row.object, excludeRowId)) {
      return 'A row with this S, D, C, Being, Avatar, Object combination already exists in the grid. Please edit the existing row or use a different combination.';
    }
    
    // Check if the combination matches any objects
    const matchingObjects = findMatchingObjects(row.sector, row.domain, row.country, row.being, row.avatar, row.object);
    if (matchingObjects.length === 0) {
      return 'No objects match this combination';
    }
    
    return null;
  };

  const handleRowClick = (objectId: string) => {
    // Toggle selection for bulk editing
    setSelectedRowIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(objectId)) {
        newSet.delete(objectId);
      } else {
        newSet.add(objectId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRowIds(new Set(allObjects.map(obj => obj.id)));
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const handleRelationshipTypeChange = (objectId: string, type: 'Inter-Table' | 'Blood' | 'Subtype' | 'Intra-Table') => {
    // Prevent changing relationship type for self-relationships (must be Intra-Table)
    const isSourceObject = sourceObjects.some(so => so.id === objectId);
    if (isSourceObject && type !== 'Intra-Table') {
      return; // Don't allow changing self-relationship type
    }
    
    setRelationshipData(prev => ({
      ...prev,
      [objectId]: {
        ...prev[objectId],
        relationshipType: type,
        // If changing to Blood, automatically set frequency to Critical
        // If changing away from Blood and frequency was Critical, set to Possible
        frequency: type === 'Blood' 
          ? 'Critical' 
          : (prev[objectId]?.relationshipType === 'Blood' && prev[objectId]?.frequency === 'Critical')
            ? 'Possible'
            : (prev[objectId]?.frequency || 'Possible')
      }
    }));
  };

  const handleRolesChange = (objectId: string, roles: string) => {
    setRelationshipData(prev => ({
      ...prev,
      [objectId]: {
        ...prev[objectId],
        roles: roles
      }
    }));
  };

  const handleFrequencyChange = (objectId: string, frequency: 'Critical' | 'Likely' | 'Possible') => {
    setRelationshipData(prev => ({
      ...prev,
      [objectId]: {
        ...prev[objectId],
        frequency: frequency
      }
    }));
  };

  const handleBulkEdit = (bulkEditData: {
    relationshipType?: 'Inter-Table' | 'Blood' | 'Subtype';
    frequency: 'Critical' | 'Likely' | 'Possible';
    roles: string;
  }) => {
    // Update relationship data for all selected objects
    setRelationshipData(prev => {
      const updated = { ...prev };
      const sourceObjectName = sourceObjects[0]?.object || '';
      
      for (const objectId of selectedRowIds) {
        const isSourceObject = sourceObjects.some(so => so.id === objectId);
        const currentData = prev[objectId] || {
          objectId: objectId,
          isSelected: false,
          relationshipType: isSourceObject ? 'Intra-Table' : 'Inter-Table',
          roles: '',
          defaultRoleWord: sourceObjectName,
          frequency: 'Possible'
        };
        
        // Update relationship type (only if provided and not source object)
        let newRelationshipType = currentData.relationshipType;
        if (bulkEditData.relationshipType && !isSourceObject) {
          newRelationshipType = bulkEditData.relationshipType;
        }
        
        // Update frequency (if Blood, must be Critical)
        let newFrequency = bulkEditData.frequency;
        if (newRelationshipType === 'Blood') {
          newFrequency = 'Critical';
        }
        
        // Replace role words (exclude default role word)
        // IMPORTANT: This replaces ALL existing user-added role words with the new ones
        const newRoles = bulkEditData.roles.trim();
        // Filter out default role word from new roles - default role word is NEVER affected
        const filteredRoles = newRoles
          ? newRoles.split(',')
              .map(r => r.trim())
              .filter(r => r && r.toLowerCase() !== sourceObjectName.toLowerCase())
              .join(', ')
          : '';
        
        updated[objectId] = {
          ...currentData,
          relationshipType: newRelationshipType,
          frequency: newFrequency,
          roles: filteredRoles // Replace existing roles with new ones (default role word is never affected)
        };
      }
      
      return updated;
    });
    
    // Close the bulk edit modal
    setIsBulkEditOpen(false);
  };

  const validateRoles = (roles: string): string[] => {
    if (!roles.trim()) return [];
    
    // Split by comma, trim whitespace, filter out empty strings
    const roleList = roles.split(',')
      .map(role => role.trim())
      .filter(role => role.length > 0);
    
    // Remove duplicates (case-insensitive) while preserving original case
    const uniqueRoles = Array.from(new Set(roleList.map(role => role.toLowerCase())))
      .map(lowerRole => roleList.find(role => role.toLowerCase() === lowerRole)!);
    
    return uniqueRoles;
  };

  const handleSave = async () => {
    if (sourceObjects.length === 0) return;

    // Check if this is a temporary object (for new object creation) - only for single mode
    const isTemporaryObject = sourceObjects.length === 1 && 
      (sourceObjects[0].id === 'temp-new-object' || sourceObjects[0].id.startsWith('temp-'));
    
    // Check if this is a cloned unsaved object - need to store relationships locally
    const isClonedObject = sourceObjects.length === 1 && 
      sourceObjects[0]._isCloned && 
      !sourceObjects[0]._isSaved;
    
    // If temporary or cloned object, store relationships locally instead of saving to API
    if ((isTemporaryObject || isClonedObject) && onRelationshipsChange) {
      const relationshipsToStore: any[] = [];
      
      // Process each grid row
      for (const row of relationshipRows) {
        // Validate row
        const validationError = validateRow(row);
        if (validationError) {
          alert(`Row validation error: ${validationError}`);
          return;
        }
        
        // Find matching target objects
        const matchingObjects = findMatchingObjects(row.sector, row.domain, row.country, row.being, row.avatar, row.object);
        
        // Parse role words
        const roleWords = validateRoles(row.roles || '');
        
        // For each matching target object and each role word, create a relationship
        for (const targetObject of matchingObjects) {
          for (const role of roleWords) {
            if (!role || role.trim() === '') continue;
            
            relationshipsToStore.push({
              id: Date.now().toString() + Math.random(),
              type: row.relationshipType,
              role: role.trim(),
              frequency: row.relationshipType === 'Blood' ? 'Critical' : row.frequency,
              toBeing: targetObject.being || 'ALL',
              toAvatar: targetObject.avatar || 'ALL',
              toObject: targetObject.object || 'ALL'
            });
          }
        }
      }
      
      // Store relationships via callback
      onRelationshipsChange(relationshipsToStore);
      alert('Relationships configured successfully! They will be created when you save the object.');
      onClose();
      return;
    }

    setSaving(true);
    try {
      // NEW GRID-BASED SAVE LOGIC
      // Validate all rows (exclude each row when checking for duplicates)
      for (const row of relationshipRows) {
        const validationError = validateRow(row, row.id);
        if (validationError) {
          alert(`Row validation error: ${validationError}`);
          setSaving(false);
          return;
        }
      }
      
      // Process relationships from grid rows
      const relationshipsToCreate: Array<{
        sourceObjectId: string;
        targetObject: ObjectData;
        relationshipType: string;
        roles: string[];
        frequency: 'Critical' | 'Likely' | 'Possible';
      }> = [];
      
      // For each grid row, find matching target objects and create relationships
      for (const row of relationshipRows) {
        const matchingObjects = findMatchingObjects(row.sector, row.domain, row.country, row.being, row.avatar, row.object);
        
        if (matchingObjects.length === 0) {
          console.warn(`No matching objects found for row: ${row.sector}, ${row.domain}, ${row.country}, ${row.being}, ${row.avatar}, ${row.object}`);
          continue;
        }
        
        // Parse role words from the row
        const roleWords = validateRoles(row.roles || '');
        
        if (roleWords.length === 0) {
          console.warn(`No role words specified for row: ${row.sector}, ${row.domain}, ${row.country}, ${row.being}, ${row.avatar}, ${row.object}`);
          continue;
        }
        
        // For each source object and each matching target object, create relationships for each role word
        for (const sourceObject of sourceObjects) {
          const sourceObjectName = sourceObject.object || '';
          
          // Determine relationship type
          const isSelf = row.object === sourceObjectName;
          const relationshipType = isSelf ? 'Intra-Table' : row.relationshipType;
          
          // Determine frequency
          const frequency = relationshipType === 'Blood' ? 'Critical' : row.frequency;
          
          for (const targetObject of matchingObjects) {
            relationshipsToCreate.push({
              sourceObjectId: sourceObject.id,
              targetObject,
              relationshipType,
              roles: roleWords, // Only additional role words (not default)
              frequency
            });
          }
        }
      }
      
      if (relationshipsToCreate.length === 0) {
        alert('No additional relationships to create. The grid is empty.');
        setSaving(false);
        return;
      }
      
      // Create relationships using bulk API or individual API calls
      try {
        await apiService.bulkCreateRelationships(relationshipsToCreate);
      } catch (error: any) {
        console.error('Bulk relationship creation error:', error);
        // Fall back to individual creation
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          for (const rel of relationshipsToCreate) {
            for (const role of rel.roles) {
              if (!role || role.trim() === '') continue;
              
              try {
                await apiService.createRelationship(rel.sourceObjectId, {
                  type: rel.relationshipType,
                  role: role.trim(),
                  frequency: rel.frequency || 'Possible',
                  toBeing: rel.targetObject.being,
                  toAvatar: rel.targetObject.avatar,
                  toObject: rel.targetObject.object
                });
              } catch (err: any) {
                if (err.message?.includes('Duplicate') || err.message?.includes('already exists')) {
                  console.warn(`Duplicate relationship skipped: ${rel.sourceObjectId} -> ${rel.targetObject.object} with role "${role}"`);
                } else {
                  throw err;
                }
              }
            }
          }
        } else {
          throw error;
        }
      }
      
      // Call the callback to refresh main data
      if (onSave) {
        await onSave();
      }
      
      alert('Additional relationships created successfully!');
      onClose();
    } catch (error) {
      console.error('Failed to save relationships:', error);
      alert('Failed to save relationships. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setRelationshipData({});
    setSelectedRowIds(new Set()); // Reset selected rows
    setIsBulkEditOpen(false); // Close bulk edit modal if open
    onClose();
  };

  if (!isOpen || sourceObjects.length === 0) return null;

  // Prepare data for the grid with relationship controls
  let gridData = allObjects.map(obj => {
    const relData = relationshipData[obj.id];
    const isSourceObject = sourceObjects.some(so => so.id === obj.id);
    const currentType = relData?.relationshipType || (isSourceObject ? 'Intra-Table' : 'Inter-Table');
    const currentFrequency = relData?.frequency || 'Possible';
    
    return {
      ...obj,
      isCurrentObject: isSourceObject, // Highlight all source objects in bulk mode
      relationshipType: currentType,
      frequency: currentType === 'Blood' ? 'Critical' : currentFrequency, // Blood relationships must be Critical
      roles: relData?.roles || ''
    };
  });

  // Apply custom sort if rules exist
  if (customSortRules.length > 0) {
    gridData = [...gridData].sort((a, b) => {
      for (const rule of customSortRules) {
        if (!rule.column) continue;
        
        const aValue = String(a[rule.column] || '').toLowerCase();
        const bValue = String(b[rule.column] || '').toLowerCase();
        
        let comparison = aValue.localeCompare(bValue);
        
        // Apply order (asc/desc)
        if (rule.order === 'desc') {
          comparison = -comparison;
        }
        
        // If this rule doesn't determine the order, continue to next rule
        if (comparison !== 0) {
          return comparison;
        }
      }
      
      return 0; // All rules are equal
    });
  }

  // Custom columns for the relationship modal
  const relationshipColumns = [
    // Add S, D, C columns with abbreviations first
    {
      key: 'sector',
      title: 'S',
      width: '80px',
      render: (row: any) => {
        const parsed = parseDriverField(row.driver || '');
        const sectorValue = row.sector || parsed.sector || '';
        return (
          <span 
            className="text-sm text-ag-dark-text"
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
              display: 'block'
            }}
          >
            {getGridDriverDisplayValue('sector', sectorValue)}
          </span>
        );
      }
    },
    {
      key: 'domain',
      title: 'D',
      width: '80px',
      render: (row: any) => {
        const parsed = parseDriverField(row.driver || '');
        const domainValue = row.domain || parsed.domain || '';
        return (
          <span 
            className="text-sm text-ag-dark-text"
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
              display: 'block'
            }}
          >
            {getGridDriverDisplayValue('domain', domainValue)}
          </span>
        );
      }
    },
    {
      key: 'country',
      title: 'C',
      width: '80px',
      render: (row: any) => {
        const parsed = parseDriverField(row.driver || '');
        const countryValue = row.country || parsed.country || '';
        return (
          <span 
            className="text-sm text-ag-dark-text"
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
              display: 'block'
            }}
          >
            {getGridDriverDisplayValue('country', countryValue)}
          </span>
        );
      }
    },
    // Then Being, Avatar, Object columns
    ...objectColumns.filter(col => ['being', 'avatar', 'object'].includes(col.key)),
    {
      key: 'relationshipType',
      title: 'Relationship Type',
      width: '170px', // Narrowed to give more space to Roles column
      filterable: true,
      render: (row: any) => {
        const isSourceObject = sourceObjects.some(so => so.id === row.id);
        const currentType = relationshipData[row.id]?.relationshipType || (isSourceObject ? 'Intra-Table' : 'Inter-Table');
        const hasMixedTypes = relationshipData[row.id]?.hasMixedTypes || false;
        
        // NEW BEHAVIOR: Always disable type selection for self-relationships (must be Intra-Table)
        // For other objects, allow type selection
        const isDisabled = isSourceObject; // Disable for self-relationships (must be Intra-Table)
        
        return (
          <div className="relative w-full" style={{ marginLeft: '-12px', marginRight: '-12px', width: 'calc(100% + 24px)' }}>
            <select
              value={currentType}
              onChange={(e) => handleRelationshipTypeChange(row.id, e.target.value as any)}
              disabled={isDisabled}
              className={`w-full px-3 py-1.5 text-sm bg-ag-dark-bg border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50 disabled:cursor-not-allowed pr-8 appearance-none ${
                hasMixedTypes 
                  ? 'border-yellow-500 bg-yellow-900/20' 
                  : 'border-ag-dark-border'
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 8px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
            {isDisabled ? (
              <option value="Intra-Table">Intra-Table</option>
            ) : (
              <>
                <option value="Inter-Table">Inter-Table</option>
                <option value="Blood">Blood</option>
                <option value="Subtype">Subtype</option>
              </>
            )}
          </select>
          {hasMixedTypes && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full" title="Mixed relationship types detected">
              <div className="w-full h-full bg-yellow-400 rounded-full animate-pulse"></div>
            </div>
          )}
          </div>
        );
      }
    },
    {
      key: 'frequency',
      title: 'Frequency',
      width: '130px', // Narrowed to give more space to Roles column
      filterable: true,
      render: (row: any) => {
        const currentType = relationshipData[row.id]?.relationshipType || (sourceObjects.some(so => so.id === row.id) ? 'Intra-Table' : 'Inter-Table');
        const currentFrequency = relationshipData[row.id]?.frequency || 'Possible';
        // Disable frequency dropdown if relationship type is 'Blood' (must be Critical)
        const isFrequencyDisabled = currentType === 'Blood';
        
        return (
          <div className="relative w-full" style={{ marginLeft: '-12px', marginRight: '-12px', width: 'calc(100% + 24px)' }}>
            <select
              value={isFrequencyDisabled ? 'Critical' : currentFrequency}
              onChange={(e) => handleFrequencyChange(row.id, e.target.value as 'Critical' | 'Likely' | 'Possible')}
              disabled={isFrequencyDisabled}
              className={`w-full px-3 py-1.5 text-sm bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent pr-8 appearance-none ${
                isFrequencyDisabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 8px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="Critical">Critical</option>
              <option value="Likely">Likely</option>
              <option value="Possible">Possible</option>
            </select>
          </div>
        );
      }
    },
    {
      key: 'roles',
      title: 'Roles',
      width: '9999px', // Very large width to make it take remaining space and extend to right edge
      render: (row: any) => (
        <div className="w-full h-full flex items-center" style={{ marginLeft: '-12px', marginRight: '-16px', width: 'calc(100% + 28px)', paddingRight: 0 }}>
          <input
            type="text"
            value={relationshipData[row.id]?.roles || ''}
            onChange={(e) => handleRolesChange(row.id, e.target.value)}
            placeholder="Enter additional roles (comma-separated)"
            className="w-full px-2 py-1.5 text-sm bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            style={{ width: '100%', marginRight: 0 }}
            title="Enter additional role words. The default role word (object name) is automatically included."
          />
        </div>
      )
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border w-[99vw] h-[90vh] max-w-[120rem] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ag-dark-border">
          <div className="flex items-center gap-3">
            <Link className="w-5 h-5 text-ag-dark-text-secondary" />
            <h2 className="text-xl font-semibold text-ag-dark-text">
              {isBulkMode ? `Configuring Relationships (${sourceObjects.length} objects)` : 'Configuring Relationships'}
            </h2>
            <button
              onClick={() => setIsCustomSortOpen(true)}
              className="px-3 py-1.5 text-sm border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors flex items-center gap-2"
              title="Custom Sort"
            >
              <ArrowUpAZ className="w-4 h-4" />
              Custom Sort
            </button>
            {selectedRowIds.size >= 2 && (
              <button
                onClick={() => setIsBulkEditOpen(true)}
                className="px-3 py-1.5 text-sm border border-ag-dark-border rounded bg-ag-dark-accent text-white hover:bg-ag-dark-accent-hover transition-colors flex items-center gap-2"
                title="Edit Selected"
              >
                <Link className="w-4 h-4" />
                Edit Selected ({selectedRowIds.size})
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRelationshipCsvUploadOpen(true)}
              className="px-3 py-1.5 text-sm border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors flex items-center gap-2"
              title="Upload Relationships CSV"
            >
              <Upload className="w-4 h-4" />
              Upload CSV
            </button>
            <button
              onClick={handleClose}
              className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-ag-dark-text-secondary">Loading relationships...</div>
            </div>
          ) : (
            <div className="h-full bg-ag-dark-bg rounded-lg border border-ag-dark-border overflow-y-auto">
              {/* NEW GRID-BASED UI */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-ag-dark-text">Additional Relationships</h3>
                  <button
                    onClick={handleAddRow}
                    className="px-3 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Row
                  </button>
                </div>
                
                {/* Grid Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-ag-dark-border">
                        <th className="px-2 py-2 text-left text-sm font-medium text-ag-dark-text bg-ag-dark-surface" style={{ width: '60px' }}>S</th>
                        <th className="px-2 py-2 text-left text-sm font-medium text-ag-dark-text bg-ag-dark-surface" style={{ width: '60px' }}>D</th>
                        <th className="px-2 py-2 text-left text-sm font-medium text-ag-dark-text bg-ag-dark-surface" style={{ width: '60px' }}>C</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-ag-dark-text bg-ag-dark-surface" style={{ width: '150px' }}>Being</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-ag-dark-text bg-ag-dark-surface" style={{ width: '150px' }}>Avatar</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-ag-dark-text bg-ag-dark-surface" style={{ width: '150px' }}>Object</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-ag-dark-text bg-ag-dark-surface">Relationship Type</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-ag-dark-text bg-ag-dark-surface">Frequency</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-ag-dark-text bg-ag-dark-surface" style={{ minWidth: '300px' }}>Roles</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-ag-dark-text bg-ag-dark-surface">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relationshipRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-3 py-8 text-center text-ag-dark-text-secondary">
                            No additional relationships. Click "Add Row" to create one.
                          </td>
                        </tr>
                      ) : (
                        relationshipRows.map((row) => {
                          const sourceObjectName = sourceObjects[0]?.object || '';
                          const isSelf = row.object === sourceObjectName;
                          const isBlood = row.relationshipType === 'Blood';
                          
                          return (
                            <tr key={row.id} className="border-b border-ag-dark-border hover:bg-ag-dark-surface">
                              {/* Sector */}
                              <td className="px-2 py-2">
                                <select
                                  value={row.sector}
                                  onChange={(e) => handleRowFieldChange(row.id, 'sector', e.target.value)}
                                  className="w-full px-1.5 py-1 text-xs bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent"
                                  style={{ width: '60px' }}
                                >
                                  <option value="ALL">ALL</option>
                                  {distinctSectors.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                              </td>
                              
                              {/* Domain */}
                              <td className="px-2 py-2">
                                <select
                                  value={row.domain}
                                  onChange={(e) => handleRowFieldChange(row.id, 'domain', e.target.value)}
                                  className="w-full px-1.5 py-1 text-xs bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent"
                                  style={{ width: '60px' }}
                                >
                                  <option value="ALL">ALL</option>
                                  {distinctDomains.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                  ))}
                                </select>
                              </td>
                              
                              {/* Country */}
                              <td className="px-2 py-2">
                                <select
                                  value={row.country}
                                  onChange={(e) => handleRowFieldChange(row.id, 'country', e.target.value)}
                                  className="w-full px-1.5 py-1 text-xs bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent"
                                  style={{ width: '60px' }}
                                >
                                  <option value="ALL">ALL</option>
                                  {distinctCountries.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                              </td>
                              
                              {/* Being */}
                              <td className="px-3 py-2" style={{ width: '150px' }}>
                                <select
                                  value={row.being}
                                  onChange={(e) => handleRowFieldChange(row.id, 'being', e.target.value)}
                                  className="w-full px-2 py-1 text-sm bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent"
                                >
                                  <option value="">Select Being</option>
                                  {distinctBeings.map(b => (
                                    <option key={b} value={b}>{b}</option>
                                  ))}
                                </select>
                              </td>
                              
                              {/* Avatar */}
                              <td className="px-3 py-2" style={{ width: '150px' }}>
                                <select
                                  value={row.avatar}
                                  onChange={(e) => handleRowFieldChange(row.id, 'avatar', e.target.value)}
                                  disabled={!row.being}
                                  className={`w-full px-2 py-1 text-sm bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent ${
                                    !row.being ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                >
                                  <option value="">{row.being ? 'Select Avatar' : 'Select Being first'}</option>
                                  {row.being && getAvatarsForBeing(row.being).map(a => (
                                    <option key={a} value={a}>{a}</option>
                                  ))}
                                </select>
                              </td>
                              
                              {/* Object */}
                              <td className="px-3 py-2" style={{ width: '150px' }}>
                                <select
                                  value={row.object}
                                  onChange={(e) => handleRowFieldChange(row.id, 'object', e.target.value)}
                                  disabled={!row.being || !row.avatar}
                                  className={`w-full px-2 py-1 text-sm bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent ${
                                    !row.being || !row.avatar ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                >
                                  <option value="">{row.being && row.avatar ? 'Select Object' : 'Select Avatar First'}</option>
                                  {row.being && row.avatar && getObjectsForBeingAndAvatar(row.being, row.avatar).map(o => (
                                    <option key={o} value={o}>{o}</option>
                                  ))}
                                </select>
                              </td>
                              
                              {/* Relationship Type */}
                              <td className="px-3 py-2">
                                <select
                                  value={row.relationshipType}
                                  onChange={(e) => handleRowFieldChange(row.id, 'relationshipType', e.target.value)}
                                  disabled={isSelf}
                                  className={`w-full px-2 py-1 text-sm bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent ${
                                    isSelf ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                >
                                  {isSelf ? (
                                    <option value="Intra-Table">Intra-Table</option>
                                  ) : (
                                    <>
                                      <option value="Inter-Table">Inter-Table</option>
                                      <option value="Blood">Blood</option>
                                      <option value="Subtype">Subtype</option>
                                    </>
                                  )}
                                </select>
                              </td>
                              
                              {/* Frequency */}
                              <td className="px-3 py-2">
                                <select
                                  value={row.frequency}
                                  onChange={(e) => handleRowFieldChange(row.id, 'frequency', e.target.value)}
                                  disabled={isBlood}
                                  className={`w-full px-2 py-1 text-sm bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent ${
                                    isBlood ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                >
                                  <option value="Critical">Critical</option>
                                  <option value="Likely">Likely</option>
                                  <option value="Possible">Possible</option>
                                </select>
                              </td>
                              
                              {/* Roles */}
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={row.roles}
                                  onChange={(e) => handleRowFieldChange(row.id, 'roles', e.target.value)}
                                  placeholder="Comma-separated role words"
                                  className="w-full px-2 py-1 text-sm bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent"
                                  style={{ minWidth: '300px' }}
                                />
                              </td>
                              
                              {/* Actions */}
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => handleRemoveRow(row.id)}
                                  className="p-1 text-red-400 hover:text-red-300 transition-colors"
                                  title="Remove row"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-ag-dark-border">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Custom Sort Modal */}
      <RelationshipCustomSortModal
        isOpen={isCustomSortOpen}
        onClose={() => setIsCustomSortOpen(false)}
        onApplySort={(sortRules, isDefaultOrderEnabled = false) => {
          setCustomSortRules(sortRules);
          setIsRelationshipOrderEnabled(isDefaultOrderEnabled);
        }}
        currentSortRules={customSortRules}
        isDefaultOrderEnabled={isRelationshipOrderEnabled}
        onDefaultOrderToggle={(enabled) => {
          setIsRelationshipOrderEnabled(enabled);
        }}
      />

      {/* Bulk Edit Relationships Modal */}
      <BulkEditRelationshipsModal
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        onSave={handleBulkEdit}
        selectedCount={selectedRowIds.size}
        includeRelationshipType={!Array.from(selectedRowIds).some(id => sourceObjects.some(so => so.id === id))}
      />

      {/* Relationship CSV Upload Modal */}
      <RelationshipCsvUploadModal
        isOpen={isRelationshipCsvUploadOpen}
        onClose={() => setIsRelationshipCsvUploadOpen(false)}
        selectedObject={isBulkMode ? null : selectedObject}
        selectedObjects={isBulkMode ? sourceObjects : []}
        allObjects={allObjects}
        isBulkMode={isBulkMode}
        existingRows={relationshipRows}
        onProcessed={(processedRelationships: ProcessedRelationship[]) => {
          setIsRelationshipCsvUploadOpen(false);
          
          // Convert ProcessedRelationship[] to RelationshipGridRow[] and merge with existing rows
          const newRows: RelationshipGridRow[] = processedRelationships.map(rel => ({
            id: `row-${Date.now()}-${Math.random()}`,
            sector: rel.sector,
            domain: rel.domain,
            country: rel.country,
            being: rel.being,
            avatar: rel.avatar,
            object: rel.object,
            relationshipType: rel.relationshipType,
            frequency: rel.frequency,
            roles: rel.roles
          }));
          
          // Add new rows to existing rows
          setRelationshipRows(prev => [...prev, ...newRows]);
        }}
      />
    </div>
  );
};
