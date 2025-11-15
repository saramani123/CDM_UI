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
  roles: string;
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
      setCustomSortRules([]);
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
      const initialData: Record<string, RelationshipData> = {};
      
      for (const obj of allObjects) {
        // Check if this object is one of the source objects (for Intra-Table logic)
        const isSourceObject = sourceObjects.some(so => so.id === obj.id);
        
        // Filter existing relationships for this specific object (no API call in loop)
        const existingRels = allExistingRelationships.filter((rel: any) => 
          rel.toBeing === obj.being && 
          rel.toAvatar === obj.avatar && 
          rel.toObject === obj.object
        );

        if (existingRels.length > 0) {
          // Handle legacy relationships with proper role fallbacks
          const roles = new Set<string>();
          const relationshipTypes = new Set<string>();
          const frequencies = new Set<string>();
          
          for (const rel of existingRels) {
            // Add explicit role if it exists and is not empty
            if (rel.role && rel.role.trim() !== '') {
              roles.add(rel.role.trim());
            }
            
            // For legacy relationships without explicit roles, use target object name as fallback
            if (!rel.role || rel.role.trim() === '') {
              roles.add(obj.object);
            }
            
            relationshipTypes.add(rel.type);
            // Collect frequencies, defaulting to Critical if not present
            frequencies.add(rel.frequency || 'Critical');
          }
          
          // Determine relationship type
          let relationshipType: 'Inter-Table' | 'Blood' | 'Subtype' | 'Intra-Table';
          const hasMixedTypes = relationshipTypes.size > 1;
          if (relationshipTypes.size === 1) {
            relationshipType = relationshipTypes.values().next().value;
          } else {
            // Mixed types - default to Inter-Table and highlight in UI
            relationshipType = 'Inter-Table';
          }
          
          // Determine frequency (use first one if all are the same, otherwise default to Possible)
          // Exception: Blood relationships MUST always be Critical
          let frequency: 'Critical' | 'Likely' | 'Possible' = relationshipType === 'Blood' ? 'Critical' : 'Possible';
          if (frequencies.size === 1) {
            const freqValue = frequencies.values().next().value;
            if (['Critical', 'Likely', 'Possible'].includes(freqValue)) {
              // Blood relationships must always be Critical, regardless of stored value
              frequency = relationshipType === 'Blood' ? 'Critical' : (freqValue as 'Critical' | 'Likely' | 'Possible');
            }
          } else if (relationshipType === 'Blood') {
            // If multiple frequencies exist but type is Blood, force Critical
            frequency = 'Critical';
          }
          
          // Convert roles set to comma-separated string, deduplicated
          const rolesArray = Array.from(roles);
          const rolesString = rolesArray.join(', ');
          
          initialData[obj.id] = {
            objectId: obj.id,
            isSelected: true,
            relationshipType: relationshipType,
            roles: rolesString,
            frequency: frequency,
            hasMixedTypes: hasMixedTypes
          };
        } else {
          // No existing relationships
          // In bulk mode, no default role word (per spec requirement 1)
          // In single mode, default role = object name for self-relationships
          const defaultRoles = isBulkMode 
            ? '' 
            : (isSourceObject ? sourceObjects[0]?.object || '' : '');
          
          initialData[obj.id] = {
            objectId: obj.id,
            isSelected: false,
            relationshipType: isSourceObject ? 'Intra-Table' : 'Inter-Table',
            roles: defaultRoles,
            frequency: 'Possible'
          };
        }
      }

      // Apply initial relationships from CSV upload or stored relationships if any
      if (initialRelationships.length > 0) {
        for (const initialRel of initialRelationships) {
          const targetObjId = initialRel.targetObject.id;
          if (initialData[targetObjId]) {
            // If relationship already exists, append roles
            const existingRoles = initialData[targetObjId].roles || '';
            const newRoles = initialRel.role || '';
            // Combine roles, avoiding duplicates
            const roleSet = new Set<string>();
            if (existingRoles) {
              existingRoles.split(', ').forEach(r => { if (r.trim()) roleSet.add(r.trim()); });
            }
            if (newRoles) {
              newRoles.split(', ').forEach(r => { if (r.trim()) roleSet.add(r.trim()); });
            }
            const combinedRoles = Array.from(roleSet).join(', ');
            
            initialData[targetObjId] = {
              objectId: targetObjId,
              isSelected: true,
              relationshipType: initialRel.relationshipType,
              roles: combinedRoles,
              frequency: initialRel.relationshipType === 'Blood' ? 'Critical' : 'Possible',
              hasMixedTypes: false
            };
          } else {
            // New relationship
            initialData[targetObjId] = {
              objectId: targetObjId,
              isSelected: true,
              relationshipType: initialRel.relationshipType,
              roles: initialRel.role,
              frequency: initialRel.relationshipType === 'Blood' ? 'Critical' : 'Possible',
              hasMixedTypes: false
            };
          }
        }
      }

      setRelationshipData(initialData);
    } catch (error) {
      console.error('Failed to load existing relationships:', error);
      // Initialize with empty data
      const initialData: Record<string, RelationshipData> = {};
      for (const obj of allObjects) {
        const isSourceObject = sourceObjects.some(so => so.id === obj.id);
        // In bulk mode, no default role word
        const defaultRoles = isBulkMode ? '' : (isSourceObject ? sourceObjects[0]?.object || '' : '');
        initialData[obj.id] = {
          objectId: obj.id,
          isSelected: false,
          relationshipType: isSourceObject ? 'Intra-Table' : 'Inter-Table',
          roles: defaultRoles,
          frequency: 'Possible'
        };
      }
      
      // Apply initial relationships from CSV upload if any (fallback path)
      if (initialRelationships.length > 0) {
        for (const initialRel of initialRelationships) {
          const targetObjId = initialRel.targetObject.id;
          if (initialData[targetObjId]) {
            initialData[targetObjId] = {
              objectId: targetObjId,
              isSelected: true,
              relationshipType: initialRel.relationshipType,
              roles: initialRel.role,
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
    setRelationshipData(prev => {
      const currentData = prev[objectId];
      const currentlySelected = currentData?.isSelected || false;
      
      // In bulk mode, no default role word (per spec requirement 1)
      // In single mode, default role = object name when selecting
      const defaultRole = isBulkMode 
        ? '' 
        : (!currentlySelected ? (sourceObjects[0]?.object || '') : '');
      
      const currentType = prev[objectId]?.relationshipType || (sourceObjects.some(so => so.id === objectId) ? 'Intra-Table' : 'Inter-Table');
      // If selecting a row and relationship type is Blood, frequency must be Critical
      // Otherwise, use existing frequency or default to Possible
      const defaultFrequency = currentType === 'Blood' ? 'Critical' : (prev[objectId]?.frequency || 'Possible');
      
      return {
        ...prev,
        [objectId]: {
          ...prev[objectId],
          isSelected: !currentlySelected,
          roles: !currentlySelected 
            ? (prev[objectId]?.roles || defaultRole) 
            : prev[objectId]?.roles || '',
          // Ensure frequency is set correctly when selecting (Blood must be Critical)
          frequency: !currentlySelected ? defaultFrequency : prev[objectId]?.frequency
        }
      };
    });
  };

  const handleRelationshipTypeChange = (objectId: string, type: 'Inter-Table' | 'Blood' | 'Subtype' | 'Intra-Table') => {
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
      
      // Process each object's relationship data
      for (const [objectId, relData] of Object.entries(relationshipData)) {
        const targetObject = allObjects.find(obj => obj.id === objectId);
        if (!targetObject) continue;

        const validRoles = validateRoles(relData.roles);

        if (relData.isSelected && validRoles.length > 0) {
          // Create relationship entries for each role
          for (const role of validRoles) {
            relationshipsToStore.push({
              id: Date.now().toString() + Math.random(),
              type: relData.relationshipType,
              role: role,
              // Blood relationships MUST always be Critical
              frequency: relData.relationshipType === 'Blood' ? 'Critical' : (relData.frequency || 'Possible'),
              toBeing: targetObject.being || 'ALL', // Note: backend expects "toBeing" (camelCase)
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
      
      // Validation 1: Check for roles entered without checkbox selected
      for (const [objectId, relData] of Object.entries(relationshipData)) {
        const targetObject = allObjects.find(obj => obj.id === objectId);
        if (!targetObject) continue;

        const hasRoles = relData.roles && relData.roles.trim().length > 0;
        const isSelected = relData.isSelected;

        // Check if user entered roles but didn't check the box
        if (hasRoles && !isSelected) {
          alert(`Please select the checkbox for "${targetObject.being} - ${targetObject.avatar} - ${targetObject.object}" to establish a relationship before adding roles.`);
          setSaving(false);
          return;
        }
        
        // Additional check: if roles are entered but checkbox is not selected
        if (relData.roles && relData.roles.trim() !== '' && !relData.isSelected) {
          alert(`Please select the checkbox for "${targetObject.being} - ${targetObject.avatar} - ${targetObject.object}" to establish a relationship before adding roles.`);
          setSaving(false);
          return;
        }
      }

      // Validation 2: Check for improper role format
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

      // Validation 3: Check if user deleted the auto-created role (object name) - only for single mode
      if (!isBulkMode && sourceObjects.length === 1) {
        for (const [objectId, relData] of Object.entries(relationshipData)) {
          const targetObject = allObjects.find(obj => obj.id === objectId);
          if (!targetObject) continue;

          const isSelf = objectId === sourceObjects[0].id;
          if (isSelf && relData.roles && relData.roles.trim().length > 0) {
            const validRoles = validateRoles(relData.roles);
            const objectName = sourceObjects[0].object;
            
            // Check if the object name is missing from the roles
            if (!validRoles.includes(objectName)) {
              alert(`Please do not delete the automatically created role name "${objectName}" which is the name of the object we are configuring relationships for.`);
              setSaving(false);
              return;
            }
          }
        }
      }

      // Validation 4: Check for empty role list (warn but allow for bulk mode)
      if (isBulkMode) {
        let hasSelectedButNoRoles = false;
        for (const [objectId, relData] of Object.entries(relationshipData)) {
          if (relData.isSelected) {
            const validRoles = validateRoles(relData.roles);
            if (validRoles.length === 0) {
              hasSelectedButNoRoles = true;
              break;
            }
          }
        }
        if (hasSelectedButNoRoles) {
          const proceed = window.confirm('Some selected relationships have no roles. They will be created without roles. Continue?');
          if (!proceed) {
            setSaving(false);
            return;
          }
        }
      }

      // Process relationships
      if (isBulkMode) {
        // BULK MODE: Create relationships from each source object to each target object
        const relationshipsToCreate: Array<{
          sourceObjectId: string;
          targetObject: ObjectData;
          relationshipType: string;
          roles: string[];
        }> = [];

        // Collect all relationships to create
        for (const [objectId, relData] of Object.entries(relationshipData)) {
          const targetObject = allObjects.find(obj => obj.id === objectId);
          if (!targetObject) continue;

          const validRoles = validateRoles(relData.roles);
          const isTargetAlsoSource = sourceObjects.some(so => so.id === objectId);

          if (relData.isSelected) {
            // Skip if no valid roles (per spec: empty role list is allowed but we need at least one role to create)
            // If user confirmed to proceed with empty roles, we'll create with empty role
            if (validRoles.length === 0) {
              // User already confirmed to proceed with empty roles, so create with empty string
              // But we need at least one role entry, so use empty string
              validRoles.push('');
            }

            // Determine relationship type based on Intra-Table logic (requirement 4)
            // If target is also a source, use Intra-Table for that source, Inter-Table for others
            const relationshipType = isTargetAlsoSource ? 'Intra-Table' : (relData.relationshipType || 'Inter-Table');

            // For each source object, create relationships to this target
            for (const sourceObject of sourceObjects) {
              const sourceIsTarget = sourceObject.id === objectId;
              // For self-relationships, always use Intra-Table
              const finalType = sourceIsTarget ? 'Intra-Table' : relationshipType;

              relationshipsToCreate.push({
                sourceObjectId: sourceObject.id,
                targetObject,
                relationshipType: finalType,
                roles: validRoles,
                // Blood relationships MUST always be Critical
                frequency: finalType === 'Blood' ? 'Critical' : (relData.frequency || 'Possible')
              });
            }
          }
        }

        // Filter out relationships with completely empty roles (no roles at all)
        // But keep relationships with empty string roles if user confirmed
        const finalRelationshipsToCreate = relationshipsToCreate.filter(rel => {
          // Must have at least one role (even if empty string)
          return rel.roles && rel.roles.length > 0;
        });

        if (finalRelationshipsToCreate.length === 0) {
          alert('No relationships to create. Please select at least one target object.');
          setSaving(false);
          return;
        }

        // Use bulk API endpoint if available, otherwise create individually
        try {
          await apiService.bulkCreateRelationships(finalRelationshipsToCreate);
        } catch (error: any) {
          console.error('Bulk relationship creation error:', error);
          // If bulk endpoint doesn't exist or fails, fall back to individual creation
          if (error.message?.includes('404') || error.message?.includes('not found')) {
            // Fall back to individual creation
            for (const rel of finalRelationshipsToCreate) {
              for (const role of rel.roles) {
                try {
                  await apiService.createRelationship(rel.sourceObjectId, {
                    type: rel.relationshipType,
                    role: role || '',
                    frequency: rel.frequency || 'Critical',
                    toBeing: rel.targetObject.being,
                    toAvatar: rel.targetObject.avatar,
                    toObject: rel.targetObject.object
                  });
                } catch (err: any) {
                  // Check if it's a duplicate error
                  if (err.message?.includes('Duplicate') || err.message?.includes('already exists')) {
                    console.warn(`Duplicate relationship skipped: ${rel.sourceObjectId} -> ${rel.targetObject.object}`);
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
        // SINGLE MODE: Original logic for single object
        const selectedObject = sourceObjects[0];
        for (const [objectId, relData] of Object.entries(relationshipData)) {
          const targetObject = allObjects.find(obj => obj.id === objectId);
          if (!targetObject) continue;

          const isSelf = objectId === selectedObject.id;
          const validRoles = validateRoles(relData.roles);

          if (relData.isSelected && validRoles.length > 0) {
            // First, delete existing relationships for this object to handle type changes
            try {
              const existingRelationships = await apiService.getObjectRelationships(selectedObject.id) as any;
              const relationshipsToDelete = (existingRelationships.relationshipsList || []).filter((rel: any) => 
                rel.toBeing === targetObject.being && 
                rel.toAvatar === targetObject.avatar && 
                rel.toObject === targetObject.object
              );

              for (const rel of relationshipsToDelete) {
                await apiService.deleteRelationship(selectedObject.id, rel.id);
              }
            } catch (error) {
              console.error(`Failed to delete existing relationships for ${targetObject.object}:`, error);
            }

            // Create new relationships with updated type
            for (const role of validRoles) {
              try {
                // Check if this role already exists in Neo4j
                const existingRelationships = await apiService.getObjectRelationships(selectedObject.id) as any;
                const existingRels = (existingRelationships.relationshipsList || []).filter((rel: any) => 
                  rel.toBeing === targetObject.being && 
                  rel.toAvatar === targetObject.avatar && 
                  rel.toObject === targetObject.object &&
                  rel.role === role
                );
                
                // Only create if it doesn't already exist
                if (existingRels.length === 0) {
                  await apiService.createRelationship(selectedObject.id, {
                    type: relData.relationshipType,
                    role: role,
                    // Blood relationships MUST always be Critical
                    frequency: relData.relationshipType === 'Blood' ? 'Critical' : (relData.frequency || 'Possible'),
                    toBeing: targetObject.being,
                    toAvatar: targetObject.avatar,
                    toObject: targetObject.object
                  });
                }
              } catch (error) {
                console.error(`Failed to create relationship for ${targetObject.object}:`, error);
              }
            }
          } else if (!relData.isSelected) {
            // Delete all relationships for this object
            try {
              const existingRelationships = await apiService.getObjectRelationships(selectedObject.id) as any;
              const relationshipsToDelete = (existingRelationships.relationshipsList || []).filter((rel: any) => 
                rel.toBeing === targetObject.being && 
                rel.toAvatar === targetObject.avatar && 
                rel.toObject === targetObject.object
              );

              for (const rel of relationshipsToDelete) {
                await apiService.deleteRelationship(selectedObject.id, rel.id);
              }
            } catch (error) {
              console.error(`Failed to delete relationships for ${targetObject.object}:`, error);
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
    
    return {
      ...obj,
      isCurrentObject: isSourceObject, // Highlight all source objects in bulk mode
      relationshipType: relData?.relationshipType || (isSourceObject ? 'Intra-Table' : 'Inter-Table'),
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
      width: 80,
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
      width: 80,
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
      width: 80,
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
      width: 200, // Expanded from 150
      render: (row: any) => {
        const isSourceObject = sourceObjects.some(so => so.id === row.id);
        const currentType = relationshipData[row.id]?.relationshipType || (isSourceObject ? 'Intra-Table' : 'Inter-Table');
        const hasMixedTypes = relationshipData[row.id]?.hasMixedTypes || false;
        
        // In bulk mode, if target is also a source, disable type selection (will be Intra-Table)
        // In single mode, disable for self-relationships
        const isDisabled = isBulkMode 
          ? isSourceObject // In bulk mode, disable if this is a source object
          : isSourceObject && sourceObjects.length === 1; // In single mode, disable for self
        
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
      width: 150,
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
      width: 400, // Expanded from 250 to use freed space from removed columns
      render: (row: any) => (
        <div className="w-full h-full flex items-center" style={{ marginLeft: '-12px', marginRight: '-12px', width: 'calc(100% + 24px)' }}>
          <input
            type="text"
            value={relationshipData[row.id]?.roles || ''}
            onChange={(e) => handleRolesChange(row.id, e.target.value)}
            placeholder="Enter roles (comma-separated)"
            className="w-full px-2 py-1.5 text-sm bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
          />
        </div>
      )
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border w-[95vw] h-[90vh] max-w-7xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ag-dark-border">
          <div className="flex items-center gap-2">
            <Link className="w-5 h-5 text-ag-dark-text-secondary" />
            <h2 className="text-xl font-semibold text-ag-dark-text">
              {isBulkMode ? `Configuring Relationships (${sourceObjects.length} objects)` : 'Configuring Relationships'}
            </h2>
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
              onClick={() => setIsCustomSortOpen(true)}
              className="px-3 py-1.5 text-sm border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors flex items-center gap-2"
              title="Custom Sort"
            >
              <ArrowUpAZ className="w-4 h-4" />
              Custom Sort
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
                customSortRules={[]}
                onClearCustomSort={() => {}}
                onColumnSort={() => {}}
                isCustomSortActive={false}
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
