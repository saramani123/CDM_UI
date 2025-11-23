import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, Link, Check, Trash2, ArrowUpAZ, Upload } from 'lucide-react';
import { DataGrid } from './DataGrid';
import { objectColumns, parseDriverField } from '../data/mockData';
import { apiService } from '../services/api';
import type { ObjectData } from '../data/mockData';
import { RelationshipCustomSortModal } from './RelationshipCustomSortModal';
import { RelationshipCsvUploadModal, type ProcessedRelationship } from './RelationshipCsvUploadModal';
import { getGridDriverDisplayValue } from '../utils/driverAbbreviations';

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

export const RelationshipModal: React.FC<RelationshipModalProps> = ({
  isOpen,
  onClose,
  selectedObject,
  selectedObjects = [],
  allObjects,
  onSave,
  initialRelationships = [],
  onRelationshipsChange,
  isBulkMode = false
}) => {
  // Determine source objects: use selectedObjects if provided (bulk mode), otherwise use selectedObject (single mode)
  const sourceObjects = isBulkMode && selectedObjects.length > 0 
    ? selectedObjects 
    : selectedObject 
      ? [selectedObject] 
      : [];
  const [relationshipData, setRelationshipData] = useState<Record<string, RelationshipData>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCustomSortOpen, setIsCustomSortOpen] = useState(false);
  const [customSortRules, setCustomSortRules] = useState<Array<{
    id: string;
    column: string;
    sortOn: string;
    order: 'asc' | 'desc';
  }>>([]);
  const [isRelationshipCsvUploadOpen, setIsRelationshipCsvUploadOpen] = useState(false);

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
      
      // Initialize relationship data for all objects
      // NEW BEHAVIOR: All objects are selected by default with default role word = source object name
      const initialData: Record<string, RelationshipData> = {};
      const sourceObjectName = sourceObjects[0]?.object || '';
      
      for (const obj of allObjects) {
        // Check if this object is one of the source objects (for Intra-Table logic)
        const isSourceObject = sourceObjects.some(so => so.id === obj.id);
        
        // Filter existing relationships for this specific object (no API call in loop)
        const existingRels = allExistingRelationships.filter((rel: any) => 
          rel.toBeing === obj.being && 
          rel.toAvatar === obj.avatar && 
          rel.toObject === obj.object
        );

        // Default values: ALL objects are selected by default
        let relationshipType: 'Inter-Table' | 'Blood' | 'Subtype' | 'Intra-Table' = isSourceObject ? 'Intra-Table' : 'Inter-Table';
        let frequency: 'Critical' | 'Likely' | 'Possible' = 'Possible';
        const defaultRoleWord = sourceObjectName; // Default role word is always the source object name
        let userAddedRoles: string[] = []; // User-added roles (excluding default role word)
        let hasMixedTypes = false;

        if (existingRels.length > 0) {
          // Load existing relationship data
          const relationshipTypes = new Set<string>();
          const frequencies = new Set<string>();
          const allRoles = new Set<string>();
          
          for (const rel of existingRels) {
            // Collect all roles
            if (rel.role && rel.role.trim() !== '') {
              allRoles.add(rel.role.trim());
            }
            relationshipTypes.add(rel.type);
            frequencies.add(rel.frequency || 'Possible');
          }
          
          // Determine relationship type
          if (relationshipTypes.size === 1) {
            relationshipType = relationshipTypes.values().next().value;
          } else if (relationshipTypes.size > 1) {
            hasMixedTypes = true;
            relationshipType = isSourceObject ? 'Intra-Table' : 'Inter-Table'; // Default based on source
          }
          
          // Determine frequency
          if (frequencies.size === 1) {
            const freqValue = frequencies.values().next().value;
            if (relationshipType === 'Blood') {
              frequency = 'Critical';
            } else if (['Critical', 'Likely', 'Possible'].includes(freqValue)) {
              frequency = freqValue === 'Critical' ? 'Possible' : (freqValue as 'Likely' | 'Possible');
            }
          } else if (relationshipType === 'Blood') {
            frequency = 'Critical';
          }
          
          // Separate default role word from user-added roles
          // The default role word should be the source object name
          // User-added roles are all other roles
          const allRolesArray = Array.from(allRoles);
          userAddedRoles = allRolesArray.filter(role => role.toLowerCase() !== defaultRoleWord.toLowerCase());
        }
        
        // ALL objects are selected by default
        initialData[obj.id] = {
          objectId: obj.id,
          isSelected: true, // Always selected - users cannot deselect
          relationshipType: relationshipType,
          roles: userAddedRoles.join(', '), // Only user-added roles shown in UI
          defaultRoleWord: defaultRoleWord, // Default role word stored separately
          frequency: frequency,
          hasMixedTypes: hasMixedTypes
        };
      }

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
    } catch (error) {
      console.error('Failed to load existing relationships:', error);
      // Initialize with default data: ALL objects selected
      const initialData: Record<string, RelationshipData> = {};
      const sourceObjectName = sourceObjects[0]?.object || '';
      for (const obj of allObjects) {
        const isSourceObject = sourceObjects.some(so => so.id === obj.id);
        initialData[obj.id] = {
          objectId: obj.id,
          isSelected: true, // Always selected by default
          relationshipType: isSourceObject ? 'Intra-Table' : 'Inter-Table',
          roles: '', // User-added roles only (empty by default)
          defaultRoleWord: sourceObjectName, // Default role word is source object name
          frequency: 'Possible'
        };
      }
      
      // Apply initial relationships from CSV upload if any (fallback path)
      if (initialRelationships.length > 0) {
        const sourceObjectName = sourceObjects[0]?.object || '';
        for (const initialRel of initialRelationships) {
          const targetObjId = initialRel.targetObject.id;
          if (initialData[targetObjId]) {
            // Separate default role word from user-added roles
            const userRoles = initialRel.role 
              ? initialRel.role.split(', ').filter(r => r.trim() && r.trim().toLowerCase() !== sourceObjectName.toLowerCase()).join(', ')
              : '';
            
            initialData[targetObjId] = {
              ...initialData[targetObjId],
              relationshipType: initialRel.relationshipType,
              roles: userRoles, // Only user-added roles
              frequency: initialRel.relationshipType === 'Blood' ? 'Critical' : 'Possible',
              hasMixedTypes: false
            };
          }
        }
      }
      
      setRelationshipData(initialData);
    } finally {
      setLoading(false);
      isInitializingRef.current = false;
    }
  };

  const handleRowClick = (objectId: string) => {
    // NEW BEHAVIOR: Users cannot deselect objects - all objects must remain selected
    // This function is now a no-op for deselection, but we keep it for potential future use
    // The checkbox will be disabled in the UI
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
      const sourceObjectName = sourceObjects[0]?.object || '';
      
      // Process each object's relationship data
      for (const [objectId, relData] of Object.entries(relationshipData)) {
        const targetObject = allObjects.find(obj => obj.id === objectId);
        if (!targetObject) continue;

        // All objects are selected by default
        // Get user-added roles and combine with default role word
        const userAddedRoles = validateRoles(relData.roles || '');
        const defaultRoleWord = relData.defaultRoleWord || sourceObjectName;
        const allRoles = [defaultRoleWord, ...userAddedRoles.filter(role => role.toLowerCase() !== defaultRoleWord.toLowerCase())];

        // Create relationship entries for each role (default + user-added)
        for (const role of allRoles) {
          if (!role || role.trim() === '') continue;
          
          relationshipsToStore.push({
            id: Date.now().toString() + Math.random(),
            type: relData.relationshipType,
            role: role.trim(),
            // Blood relationships MUST always be Critical
            frequency: relData.relationshipType === 'Blood' ? 'Critical' : (relData.frequency || 'Possible'),
            toBeing: targetObject.being || 'ALL', // Note: backend expects "toBeing" (camelCase)
            toAvatar: targetObject.avatar || 'ALL',
            toObject: targetObject.object || 'ALL'
          });
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
      
      // Validation 1: Check for improper role format (user-added roles only)
      for (const [objectId, relData] of Object.entries(relationshipData)) {
        const targetObject = allObjects.find(obj => obj.id === objectId);
        if (!targetObject) continue;

        if (relData.roles && relData.roles.trim().length > 0) {
          // Check for improper format - should contain commas for multiple roles
          const roleText = relData.roles.trim();
          const hasComma = roleText.includes(',');
          const hasSemicolon = roleText.includes(';');
          const hasSpace = roleText.includes(' ') && !hasComma;
          
          // If it has multiple words but no comma, it's probably wrong format
          if (roleText.split(' ').length > 1 && !hasComma && !hasSemicolon) {
            alert(`Please enter roles in proper comma-separated format for "${targetObject.being} - ${targetObject.avatar} - ${targetObject.object}". Example: "Role1, Role2, Role3"`);
            setSaving(false);
            return;
          }
          
          // If it has semicolon instead of comma
          if (hasSemicolon && !hasComma) {
            alert(`Please enter roles in proper comma-separated format for "${targetObject.being} - ${targetObject.avatar} - ${targetObject.object}". Example: "Role1, Role2, Role3"`);
            setSaving(false);
            return;
          }
        }
      }

      // Note: All objects are selected by default, so no need to check for deselection
      // Default role word is always the source object name and is stored separately

      // Process relationships
      if (isBulkMode) {
        // BULK MODE: Create relationships from each source object to each target object
        // All objects are selected by default with default role word = source object name
        const relationshipsToCreate: Array<{
          sourceObjectId: string;
          targetObject: ObjectData;
          relationshipType: string;
          roles: string[];
          frequency: 'Critical' | 'Likely' | 'Possible';
        }> = [];

        // Collect all relationships to create
        for (const [objectId, relData] of Object.entries(relationshipData)) {
          const targetObject = allObjects.find(obj => obj.id === objectId);
          if (!targetObject) continue;

          const isTargetAlsoSource = sourceObjects.some(so => so.id === objectId);

          // All objects are selected by default
          // Get user-added roles and combine with default role word for each source
          const userAddedRoles = validateRoles(relData.roles || '');

          // Determine relationship type based on Intra-Table logic
          // If target is also a source, use Intra-Table for that source, Inter-Table for others
          const relationshipType = isTargetAlsoSource ? 'Intra-Table' : (relData.relationshipType || 'Inter-Table');

          // For each source object, create relationships to this target
          for (const sourceObject of sourceObjects) {
            const sourceIsTarget = sourceObject.id === objectId;
            // For self-relationships, always use Intra-Table
            const finalType = sourceIsTarget ? 'Intra-Table' : relationshipType;
            
            // Default role word is the source object name
            const defaultRoleWord = sourceObject.object || '';
            
            // Combine default role word with user-added roles (excluding default if it appears in user roles)
            const allRoles = [defaultRoleWord, ...userAddedRoles.filter(role => role.toLowerCase() !== defaultRoleWord.toLowerCase())];

            relationshipsToCreate.push({
              sourceObjectId: sourceObject.id,
              targetObject,
              relationshipType: finalType,
              roles: allRoles,
              // Blood relationships MUST always be Critical
              frequency: finalType === 'Blood' ? 'Critical' : (relData.frequency || 'Possible')
            });
          }
        }

        if (relationshipsToCreate.length === 0) {
          alert('No relationships to create.');
          setSaving(false);
          return;
        }

        // Use bulk API endpoint if available, otherwise create individually
        try {
          await apiService.bulkCreateRelationships(relationshipsToCreate);
        } catch (error: any) {
          console.error('Bulk relationship creation error:', error);
          // If bulk endpoint doesn't exist or fails, fall back to individual creation
          if (error.message?.includes('404') || error.message?.includes('not found')) {
            // Fall back to individual creation
            for (const rel of relationshipsToCreate) {
              for (const role of rel.roles) {
                if (!role || role.trim() === '') continue; // Skip empty roles
                
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
                  // Check if it's a duplicate error - ignore duplicates
                  if (err.message?.includes('Duplicate') || err.message?.includes('already exists')) {
                    console.warn(`Duplicate relationship skipped: ${rel.sourceObjectId} -> ${rel.targetObject.object} with role "${role}"`);
                  } else {
                    throw err;
                  }
                }
              }
            }
          } else {
            // Log the full error for debugging
            console.error('Full error details:', error);
            throw error;
          }
        }
      } else {
        // SINGLE MODE: All objects are selected by default
        // Users cannot delete relationships - only update properties and add new role words
        const selectedObject = sourceObjects[0];
        const defaultRoleWord = selectedObject.object || '';
        
        // Get all existing relationships to check which role words already exist
        let existingRelationships: any[] = [];
        try {
          const relationshipsResponse = await apiService.getObjectRelationships(selectedObject.id) as any;
          existingRelationships = relationshipsResponse.relationshipsList || [];
        } catch (error) {
          console.error('Failed to fetch existing relationships:', error);
        }
        
        // Step 1: Update all existing relationships with new type and frequency
        // Process each target object to update properties
        for (const [objectId, relData] of Object.entries(relationshipData)) {
          const targetObject = allObjects.find(obj => obj.id === objectId);
          if (!targetObject) continue;

          // All objects are selected by default - always process them
          const isSelf = objectId === selectedObject.id;
          
          // Determine relationship type - self-relationships must be Intra-Table
          const relationshipType = isSelf ? 'Intra-Table' : relData.relationshipType;
          
          // Blood relationships MUST always be Critical
          const frequency = relationshipType === 'Blood' ? 'Critical' : (relData.frequency || 'Possible');
          
          // Update all existing relationships to this target with new type and frequency
          try {
            await apiService.updateRelationshipsToTarget(
              selectedObject.id,
              targetObject.being || 'ALL',
              targetObject.avatar || 'ALL',
              targetObject.object || 'ALL',
              relationshipType,
              frequency
            );
            console.log(`Updated relationships to ${targetObject.object} with type=${relationshipType}, frequency=${frequency}`);
          } catch (error) {
            console.error(`Failed to update relationships to ${targetObject.object}:`, error);
            // Continue to next target even if update fails
          }
        }
        
        // Step 2: Collect all new relationships to create (batch operation)
        const relationshipsToCreate: Array<{
          sourceObjectId: string;
          targetObject: ObjectData;
          relationshipType: string;
          roles: string[];
          frequency: 'Critical' | 'Likely' | 'Possible';
        }> = [];
        
        for (const [objectId, relData] of Object.entries(relationshipData)) {
          const targetObject = allObjects.find(obj => obj.id === objectId);
          if (!targetObject) continue;

          // All objects are selected by default - always process them
          const isSelf = objectId === selectedObject.id;
          
          // Determine relationship type - self-relationships must be Intra-Table
          const relationshipType = isSelf ? 'Intra-Table' : relData.relationshipType;
          
          // Blood relationships MUST always be Critical
          const frequency = relationshipType === 'Blood' ? 'Critical' : (relData.frequency || 'Possible');
          
          // Get existing role words for relationships to this target
          const existingRolesForTarget = existingRelationships
            .filter((rel: any) => 
              rel.toBeing === targetObject.being && 
              rel.toAvatar === targetObject.avatar && 
              rel.toObject === targetObject.object
            )
            .map((rel: any) => (rel.role || '').trim().toLowerCase())
            .filter((role: string) => role.length > 0);
          
          // Get user-added roles (excluding default role word)
          const userAddedRoles = validateRoles(relData.roles || '');
          
          // Collect role words that don't exist yet
          // Always ensure default role word relationship exists
          const allRolesToCheck = [defaultRoleWord, ...userAddedRoles.filter(role => role.toLowerCase() !== defaultRoleWord.toLowerCase())];
          const newRoles = allRolesToCheck
            .filter(role => role && role.trim() !== '')
            .filter(role => !existingRolesForTarget.includes(role.trim().toLowerCase()));
          
          // If there are new roles to create, add them to the batch
          if (newRoles.length > 0) {
            relationshipsToCreate.push({
              sourceObjectId: selectedObject.id,
              targetObject,
              relationshipType,
              roles: newRoles,
              frequency
            });
          }
        }
        
        // Step 3: Bulk create all new relationships at once
        if (relationshipsToCreate.length > 0) {
          try {
            await apiService.bulkCreateRelationships(relationshipsToCreate);
            console.log(`Successfully created new relationships via bulk operation for ${relationshipsToCreate.length} target(s)`);
          } catch (error: any) {
            console.error('Bulk relationship creation error:', error);
            // If bulk endpoint fails, fall back to individual creation
            if (error.message?.includes('404') || error.message?.includes('not found')) {
              // Fall back to individual creation for each new role
              for (const rel of relationshipsToCreate) {
                for (const role of rel.roles) {
                  try {
                    await apiService.createRelationship(rel.sourceObjectId, {
                      type: rel.relationshipType,
                      role: role.trim(),
                      frequency: rel.frequency,
                      toBeing: rel.targetObject.being,
                      toAvatar: rel.targetObject.avatar,
                      toObject: rel.targetObject.object
                    });
                  } catch (err: any) {
                    if (err.message?.includes('Duplicate') || err.message?.includes('already exists')) {
                      console.warn(`Duplicate relationship skipped: ${rel.sourceObjectId} -> ${rel.targetObject.object} with role "${role}"`);
                    } else {
                      console.error(`Failed to create relationship: ${err}`);
                    }
                  }
                }
              }
            } else {
              throw error;
            }
          }
        }
      }

      // Call the callback to refresh main grid data FIRST (before closing)
      // This ensures the main grid is updated with new relationship counts
      if (onSave) {
        onSave();
      }
      
      // Refresh the data after saving (for single mode, to show updated relationships)
      // In bulk mode, we close immediately since we're not editing existing relationships
      if (!isBulkMode) {
        await initializeRelationshipData();
      }
      
      alert(isBulkMode ? 'Bulk relationships created successfully!' : 'Relationships updated successfully!');
      onClose();
    } catch (error: any) {
      console.error('Failed to save relationships:', error);
      const errorMessage = error.message || 'Failed to save relationships. Please try again.';
      if (errorMessage.includes('Duplicate')) {
        alert(`Duplicate relationship detected: ${errorMessage}`);
      } else {
        alert(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setRelationshipData({});
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
              <DataGrid
                columns={relationshipColumns}
                data={gridData}
                onRowSelect={() => {}} // No row selection needed in modal
                selectedRows={[]}
                affectedIds={new Set()}
                deletedDriverType={null}
                customSortRules={customSortRules}
                onClearCustomSort={() => {
                  // Reset to default sort when user clears custom sort
                  setCustomSortRules([
                    { id: '1', column: 'being', sortOn: 'being', order: 'asc' },
                    { id: '2', column: 'avatar', sortOn: 'avatar', order: 'asc' },
                    { id: '3', column: 'object', sortOn: 'object', order: 'asc' }
                  ]);
                }}
                onColumnSort={() => {}}
                isCustomSortActive={customSortRules.length > 0}
                isColumnSortActive={false}
                highlightCurrentObject={true}
                showActionsColumn={false}
                relationshipData={relationshipData}
                onRelationshipRowClick={handleRowClick}
                selectionMode="row"
              />
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
        onApplySort={(sortRules) => {
          setCustomSortRules(sortRules);
        }}
        currentSortRules={customSortRules}
      />

      {/* Relationship CSV Upload Modal */}
      <RelationshipCsvUploadModal
        isOpen={isRelationshipCsvUploadOpen}
        onClose={() => setIsRelationshipCsvUploadOpen(false)}
        selectedObject={isBulkMode ? null : selectedObject}
        selectedObjects={isBulkMode ? sourceObjects : []}
        allObjects={allObjects}
        isBulkMode={isBulkMode}
        onProcessed={(processedRelationships: ProcessedRelationship[]) => {
          setIsRelationshipCsvUploadOpen(false);
          // Apply the processed relationships to the modal
          // Convert ProcessedRelationship[] to InitialRelationship[] format
          const initialRels: InitialRelationship[] = processedRelationships.map(rel => ({
            targetObject: rel.targetObject,
            relationshipType: rel.relationshipType,
            role: rel.role
          }));
          
          // Update relationship data with CSV uploaded relationships
          // Ensure all objects are initialized first
          const updatedData: Record<string, RelationshipData> = { ...relationshipData };
          
          // Initialize any missing objects
          for (const obj of allObjects) {
            if (!updatedData[obj.id]) {
              const isSelf = obj.id === selectedObject?.id;
              updatedData[obj.id] = {
                objectId: obj.id,
                isSelected: false,
                relationshipType: isSelf ? 'Intra-Table' : 'Inter-Table',
                roles: '',
                hasMixedTypes: false
              };
            }
          }
          
          // Apply CSV uploaded relationships
          for (const rel of processedRelationships) {
            const targetObjId = rel.targetObject.id;
            const existingData = updatedData[targetObjId];
            
            if (existingData) {
              // If relationship already exists, append roles
              const existingRoles = existingData.roles ? existingData.roles.split(', ').filter(Boolean) : [];
              const newRoles = rel.role ? [rel.role] : [];
              const combinedRoles = [...new Set([...existingRoles, ...newRoles])].join(', ');
              
              updatedData[targetObjId] = {
                ...existingData,
                isSelected: true,
                relationshipType: rel.relationshipType,
                roles: combinedRoles,
                hasMixedTypes: false
              };
            } else {
              // New relationship (shouldn't happen if we initialized above, but just in case)
              updatedData[targetObjId] = {
                objectId: targetObjId,
                isSelected: true,
                relationshipType: rel.relationshipType,
                roles: rel.role || '',
                hasMixedTypes: false
              };
            }
          }
          
          setRelationshipData(updatedData);
        }}
      />
    </div>
  );
};
