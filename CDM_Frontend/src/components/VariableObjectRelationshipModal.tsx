import React, { useState, useEffect } from 'react';
import { X, Save, Link, Upload, ArrowUpAZ } from 'lucide-react';
import { DataGrid } from './DataGrid';
import { objectColumns, parseDriverField } from '../data/mockData';
import { apiService } from '../services/api';
import type { ObjectData } from '../data/mockData';
import { CsvUploadModal } from './CsvUploadModal';
import { RelationshipCustomSortModal } from './RelationshipCustomSortModal';

interface VariableObjectRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVariable: any; // For single-variable mode (backward compatibility)
  selectedVariables?: any[]; // For bulk mode (multiple variables)
  allObjects: ObjectData[];
  onSave?: () => void; // Callback to refresh main data
  onRelationshipsChange?: (relationships: any[]) => void; // Callback to store relationships for temporary/cloned variables
  initialCsvData?: any[] | null; // CSV data to process when modal opens
  isBulkMode?: boolean; // Flag to indicate bulk edit mode
}

interface SelectedObjectData {
  objectId: string;
  isSelected: boolean;
  isAllSelected?: boolean; // Flag for "ALL" selection
}

export const VariableObjectRelationshipModal: React.FC<VariableObjectRelationshipModalProps> = ({
  isOpen,
  onClose,
  selectedVariable,
  selectedVariables = [],
  allObjects,
  onSave,
  onRelationshipsChange,
  initialCsvData,
  isBulkMode = false
}) => {
  // Determine source variables: use selectedVariables if provided (bulk mode), otherwise use selectedVariable (single mode)
  const sourceVariables = isBulkMode && selectedVariables.length > 0 
    ? selectedVariables 
    : selectedVariable 
      ? [selectedVariable] 
      : [];
  const [selectedObjects, setSelectedObjects] = useState<Record<string, SelectedObjectData>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [isCsvUploadOpen, setIsCsvUploadOpen] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [isCustomSortOpen, setIsCustomSortOpen] = useState(false);
  const [customSortRules, setCustomSortRules] = useState<Array<{
    id: string;
    column: string;
    sortOn: string;
    order: 'asc' | 'desc';
  }>>([]);

  // Initialize selected objects when modal opens
  useEffect(() => {
    if (isOpen && sourceVariables.length > 0 && allObjects.length > 0) {
      initializeSelectedObjects().then(() => {
        // Process initial CSV data if provided (after initialization)
        if (initialCsvData && initialCsvData.length > 0) {
          // Use setTimeout to ensure state is initialized first
          setTimeout(() => {
            handleCsvUpload(initialCsvData);
          }, 100);
        }
      });
    }
    // Reset when modal closes
    if (!isOpen) {
      setSelectedObjects({});
      setIsAllSelected(false);
      setUploadErrors([]);
      setCustomSortRules([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sourceVariables.length, allObjects.length]);

  // Force refresh when modal opens (to catch bulk relationship updates)
  // This ensures that when you open an individual variable's modal after bulk operations,
  // it always shows the latest relationships from Neo4j
  useEffect(() => {
    if (isOpen && sourceVariables.length > 0 && allObjects.length > 0) {
      // Force refresh when modal opens to ensure latest relationships are shown
      // Use a small delay to allow any pending state updates to complete
      const refreshTimer = setTimeout(() => {
        initializeSelectedObjects();
      }, 150);
      return () => clearTimeout(refreshTimer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const initializeSelectedObjects = async () => {
    if (sourceVariables.length === 0) return;

    setLoading(true);
    try {
      // In bulk mode, we don't load existing relationships (they're just for reference)
      // In bulk mode, we're creating new relationships, not editing existing ones
      // For single mode, load existing relationships
      let allExistingRelationships: any[] = [];
      
      // Check if this is a cloned unsaved variable - use relationships from cloned data
      const isClonedVariable = sourceVariables.length === 1 && 
        sourceVariables[0]._isCloned && 
        !sourceVariables[0]._isSaved;
      
      if (!isBulkMode && sourceVariables.length === 1) {
        if (isClonedVariable) {
          // For cloned variables, use relationships from the cloned data
          const clonedRelationships = sourceVariables[0].objectRelationshipsList || [];
          allExistingRelationships = clonedRelationships;
        } else {
          // For saved variables, load from API
          const existingRelationships = await apiService.getVariableObjectRelationships(sourceVariables[0].id) as any;
          allExistingRelationships = existingRelationships.relationships || [];
        }
      } else if (isBulkMode) {
        // Bulk mode: load existing relationships for all source variables to show what's already selected
        // This helps prevent duplicates
        for (const variable of sourceVariables) {
          try {
            const existingRelationships = await apiService.getVariableObjectRelationships(variable.id) as any;
            const relationshipsList = existingRelationships.relationships || [];
            allExistingRelationships.push(...relationshipsList.map((rel: any) => ({ ...rel, variableId: variable.id })));
          } catch (error) {
            console.error(`Failed to load relationships for variable ${variable.id}:`, error);
          }
        }
      }

      // Initialize selection data for all objects
      const initialData: Record<string, SelectedObjectData> = {};
      
      // Check if "ALL" is selected (HAS_VARIABLE relationship exists) - only for single mode
      let hasAllRelationship = false;
      
      if (!isBulkMode && sourceVariables.length === 1) {
        // Check for HAS_VARIABLE relationship first (single mode only)
        hasAllRelationship = allExistingRelationships.some((rel: any) => rel.relationshipType === 'HAS_VARIABLE');
      }

      console.log('🔄 Initializing relationships. Found', allExistingRelationships.length, 'relationships');
      console.log('🔄 AllObjects count:', allObjects.length);
      console.log('🔄 Bulk mode:', isBulkMode, 'Source variables:', sourceVariables.length);
      
      for (const obj of allObjects) {
        // In bulk mode, check if ANY of the source variables has a relationship with this object
        // In single mode, check if the selected variable has a relationship with this object
        let hasSpecificRel = false;
        
        if (isBulkMode) {
          // Check if any source variable has a relationship with this object
          hasSpecificRel = allExistingRelationships.some((rel: any) => 
            rel.relationshipType === 'HAS_SPECIFIC_VARIABLE' &&
            rel.toBeing === obj.being &&
            rel.toAvatar === obj.avatar &&
            rel.toObject === obj.object
          );
        } else {
          // Single mode: check if the selected variable has a relationship with this object
          hasSpecificRel = allExistingRelationships.some((rel: any) => 
            rel.relationshipType === 'HAS_SPECIFIC_VARIABLE' &&
            rel.toBeing === obj.being &&
            rel.toAvatar === obj.avatar &&
            rel.toObject === obj.object
          );
        }

        if (hasSpecificRel) {
          console.log(`✓ Found relationship for: ${obj.being} - ${obj.avatar} - ${obj.object}`);
        }

        initialData[obj.id] = {
          objectId: obj.id,
          isSelected: hasSpecificRel,
          isAllSelected: false
        };
      }
      
      console.log('🔄 Initialized', Object.values(initialData).filter(d => d.isSelected).length, 'selected objects');

      setSelectedObjects(initialData);
      setIsAllSelected(hasAllRelationship);
    } catch (error) {
      console.error('Failed to load existing relationships:', error);
      // Initialize with empty data
      const initialData: Record<string, SelectedObjectData> = {};
      for (const obj of allObjects) {
        initialData[obj.id] = {
          objectId: obj.id,
          isSelected: false,
          isAllSelected: false
        };
      }
      setSelectedObjects(initialData);
      setIsAllSelected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (objectId: string) => {
    // If "ALL" is selected, deselect it first
    if (isAllSelected) {
      setIsAllSelected(false);
    }

    setSelectedObjects(prev => {
      const currentData = prev[objectId];
      const currentlySelected = currentData?.isSelected || false;
      
      return {
        ...prev,
        [objectId]: {
          ...prev[objectId],
          isSelected: !currentlySelected,
          isAllSelected: false
        }
      };
    });
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      // Deselect "ALL"
      setIsAllSelected(false);
      // Also deselect all individual selections
      const updated: Record<string, SelectedObjectData> = {};
      for (const obj of allObjects) {
        updated[obj.id] = {
          objectId: obj.id,
          isSelected: false,
          isAllSelected: false
        };
      }
      setSelectedObjects(updated);
    } else {
      // Select "ALL"
      setIsAllSelected(true);
      // Select all rows so they appear highlighted
      const updated: Record<string, SelectedObjectData> = {};
      for (const obj of allObjects) {
        updated[obj.id] = {
          objectId: obj.id,
          isSelected: true, // Set to true so rows are highlighted
          isAllSelected: true
        };
      }
      setSelectedObjects(updated);
    }
  };

  const handleCsvUpload = (csvData: any[]) => {
    const errors: string[] = [];
    const matchedObjects: Set<string> = new Set();
    const updatedSelections: Record<string, SelectedObjectData> = { ...selectedObjects };

    // If "ALL" is selected, deselect it
    if (isAllSelected) {
      setIsAllSelected(false);
    }

    csvData.forEach((row, index) => {
      // Match object by all columns: Sector, Domain, Country, Object Clarifier, Being, Avatar, Object
      const matchingObject = allObjects.find(obj => {
        const sectorMatch = (row.Sector || row.sector || '') === (obj.sector || '');
        const domainMatch = (row.Domain || row.domain || '') === (obj.domain || '');
        const countryMatch = (row.Country || row.country || '') === (obj.country || '');
        const clarifierMatch = (row['Object Clarifier'] || row['ObjectClarifier'] || row.objectClarifier || '') === (obj.classifier || '');
        const beingMatch = (row.Being || row.being || '') === obj.being;
        const avatarMatch = (row.Avatar || row.avatar || '') === obj.avatar;
        const objectMatch = (row.Object || row.object || '') === obj.object;

        return sectorMatch && domainMatch && countryMatch && clarifierMatch && beingMatch && avatarMatch && objectMatch;
      });

      if (!matchingObject) {
        const rowValues = [
          row.Sector || row.sector || '',
          row.Domain || row.domain || '',
          row.Country || row.country || '',
          row['Object Clarifier'] || row['ObjectClarifier'] || row.objectClarifier || '',
          row.Being || row.being || '',
          row.Avatar || row.avatar || '',
          row.Object || row.object || ''
        ].filter(Boolean).join(' - ');
        errors.push(`Row ${index + 1}: No matching object found for [${rowValues}].`);
      } else if (matchedObjects.has(matchingObject.id)) {
        errors.push(`Row ${index + 1}: Duplicate object entry found in upload; duplicates ignored.`);
      } else if (updatedSelections[matchingObject.id]?.isSelected) {
        // In bulk mode, we still allow this but warn - it will be checked on save
        // In single mode, this is a duplicate
        if (!isBulkMode) {
          errors.push(`Row ${index + 1}: Object ${matchingObject.object} already selected; skipping duplicate.`);
        } else {
          // In bulk mode, auto-highlight it anyway (will be checked for duplicates on save)
          matchedObjects.add(matchingObject.id);
          updatedSelections[matchingObject.id] = {
            objectId: matchingObject.id,
            isSelected: true,
            isAllSelected: false
          };
        }
      } else {
        matchedObjects.add(matchingObject.id);
        updatedSelections[matchingObject.id] = {
          objectId: matchingObject.id,
          isSelected: true,
          isAllSelected: false
        };
      }
    });

    setSelectedObjects(updatedSelections);
    setUploadErrors(errors);

    if (errors.length > 0) {
      // Show error popup
      alert(`Upload completed with ${errors.length} error(s):\n\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more errors` : ''}`);
    } else {
      // Show success message
      alert(`Successfully uploaded ${matchedObjects.size} object(s) from CSV. Objects are now highlighted in the modal.`);
    }
  };

  const handleSave = async () => {
    if (sourceVariables.length === 0) return;

    // Check if this is a cloned unsaved variable - need to store relationships locally
    const isClonedVariable = sourceVariables.length === 1 && 
      sourceVariables[0]._isCloned && 
      !sourceVariables[0]._isSaved;
    
    // If cloned variable, store relationships locally instead of saving to API
    if (isClonedVariable && onRelationshipsChange) {
      const relationshipsToStore: any[] = [];
      
      // Process each object's relationship data
      for (const [objectId, objData] of Object.entries(selectedObjects)) {
        const targetObject = allObjects.find(obj => obj.id === objectId);
        if (!targetObject) continue;

        if (objData.isSelected) {
          // Create relationship entry
          relationshipsToStore.push({
            id: Date.now().toString() + Math.random(),
            toBeing: targetObject.being || 'ALL',
            toAvatar: targetObject.avatar || 'ALL',
            toObject: targetObject.object || 'ALL',
            relationshipType: objData.isAllSelected ? 'HAS_VARIABLE' : 'HAS_SPECIFIC_VARIABLE'
          });
        }
      }
      
      // Store relationships via callback
      onRelationshipsChange(relationshipsToStore);
      alert('Relationships configured successfully! They will be created when you save the variable.');
      onClose();
      return;
    }

    setSaving(true);
    try {
      if (isBulkMode) {
        // BULK MODE: Create relationships from each source variable to each selected object
        const selectedObjectIds = Object.entries(selectedObjects)
          .filter(([_, data]) => data.isSelected)
          .map(([id, _]) => id);
        
        if (selectedObjectIds.length === 0) {
          alert('Please select at least one object to create relationships.');
          setSaving(false);
          return;
        }

        // Collect all relationships to create
        const relationshipsToCreate: Array<{
          variableId: string;
          objectId: string;
          object: ObjectData;
        }> = [];

        // Check for duplicates before creating
        const duplicates: Array<{ variableId: string; variableName: string; objectName: string }> = [];

        for (const variable of sourceVariables) {
          // Get existing relationships for this variable
          const existingRelationships = await apiService.getVariableObjectRelationships(variable.id) as any;
          const relationshipsList = existingRelationships.relationships || [];
          
          // Create a set of existing object keys for this variable
          const existingObjectKeys = new Set(
            relationshipsList
              .filter((rel: any) => rel.relationshipType === 'HAS_SPECIFIC_VARIABLE')
              .map((rel: any) => `${rel.toBeing}::${rel.toAvatar}::${rel.toObject}`)
          );

          for (const objectId of selectedObjectIds) {
            const obj = allObjects.find(o => o.id === objectId);
            if (!obj) continue;

            const objectKey = `${obj.being}::${obj.avatar}::${obj.object}`;
            
            // Check if relationship already exists
            if (existingObjectKeys.has(objectKey)) {
              duplicates.push({
                variableId: variable.id,
                variableName: variable.variable || variable.name || variable.id,
                objectName: `${obj.being} - ${obj.avatar} - ${obj.object}`
              });
            } else {
              relationshipsToCreate.push({
                variableId: variable.id,
                objectId: objectId,
                object: obj
              });
            }
          }
        }

        // If duplicates found, show error and abort
        if (duplicates.length > 0) {
          const duplicateMessages = duplicates.map(dup => 
            `${dup.variableName} → ${dup.objectName}`
          );
          alert(`Duplicate relationships detected. The following relationships already exist:\n\n${duplicateMessages.slice(0, 10).join('\n')}${duplicateMessages.length > 10 ? `\n... and ${duplicateMessages.length - 10} more` : ''}\n\nPlease remove duplicates before saving.`);
          setSaving(false);
          return;
        }

        // Use bulk API endpoint if available, otherwise create individually
        try {
          await apiService.bulkCreateVariableObjectRelationships(relationshipsToCreate);
        } catch (error: any) {
          // If bulk endpoint doesn't exist or fails, fall back to individual creation
          if (error.message?.includes('404') || error.message?.includes('not found')) {
            // Fall back to individual creation
            for (const rel of relationshipsToCreate) {
              try {
                await apiService.createVariableObjectRelationship(rel.variableId, {
                  relationshipType: 'HAS_SPECIFIC_VARIABLE',
                  toSector: rel.object.sector || '',
                  toDomain: rel.object.domain || '',
                  toCountry: rel.object.country || '',
                  toObjectClarifier: rel.object.classifier || '',
                  toBeing: rel.object.being,
                  toAvatar: rel.object.avatar,
                  toObject: rel.object.object
                });
              } catch (err: any) {
                // Check if it's a duplicate error
                if (err.message?.includes('Duplicate') || err.message?.includes('already exists')) {
                  console.warn(`Duplicate relationship skipped: ${rel.variableId} -> ${rel.object.object}`);
                } else {
                  throw err;
                }
              }
            }
          } else {
            throw error;
          }
        }

        // Call the callback to refresh main grid data
        if (onSave) {
          await onSave();
        }
        
        alert(`Bulk relationships created successfully! Created ${relationshipsToCreate.length} relationship(s) for ${sourceVariables.length} variable(s).`);
        onClose();
        return;
      }

      // SINGLE MODE: Original logic for single variable
      const selectedVariable = sourceVariables[0];
      console.log('💾 Saving relationships for variable:', selectedVariable.id);
      console.log('💾 Selected objects:', Object.entries(selectedObjects).filter(([_, data]) => data.isSelected).map(([id, _]) => id));
      console.log('💾 isAllSelected:', isAllSelected);
      
      // Get current relationships
      const existingRelationships = await apiService.getVariableObjectRelationships(selectedVariable.id) as any;
      const relationshipsList = existingRelationships.relationships || [];
      console.log('💾 Existing relationships:', relationshipsList.length);

      if (isAllSelected) {
        // Create HAS_VARIABLE relationship for all objects
        // First, delete all existing HAS_SPECIFIC_VARIABLE relationships
        for (const rel of relationshipsList) {
          if (rel.relationshipType === 'HAS_SPECIFIC_VARIABLE') {
            try {
              await apiService.deleteVariableObjectRelationship(selectedVariable.id, {
                toSector: rel.toSector,
                toDomain: rel.toDomain,
                toCountry: rel.toCountry,
                toObjectClarifier: rel.toObjectClarifier,
                toBeing: rel.toBeing,
                toAvatar: rel.toAvatar,
                toObject: rel.toObject
              });
            } catch (error) {
              console.error(`Failed to delete relationship:`, error);
            }
          }
        }

        // Create HAS_VARIABLE relationship (one relationship that applies to all objects)
        // This should be handled by the backend - creating a single relationship with special flag
        try {
          await apiService.createVariableObjectRelationship(selectedVariable.id, {
            relationshipType: 'HAS_VARIABLE',
            toSector: 'ALL',
            toDomain: 'ALL',
            toCountry: 'ALL',
            toObjectClarifier: '',
            toBeing: 'ALL',
            toAvatar: 'ALL',
            toObject: 'ALL'
          });
        } catch (error) {
          console.error('Failed to create HAS_VARIABLE relationship:', error);
        }
      } else {
        // Delete HAS_VARIABLE relationship if it exists
        const hasVariableRel = relationshipsList.find((rel: any) => rel.relationshipType === 'HAS_VARIABLE');
        if (hasVariableRel) {
          try {
            await apiService.deleteVariableObjectRelationship(selectedVariable.id, {
              toSector: 'ALL',
              toDomain: 'ALL',
              toCountry: 'ALL',
              toObjectClarifier: '',
              toBeing: 'ALL',
              toAvatar: 'ALL',
              toObject: 'ALL'
            });
          } catch (error) {
            console.error('Failed to delete HAS_VARIABLE relationship:', error);
          }
        }

        // Track which objects should have relationships (by being/avatar/object combo)
        const selectedObjectKeys = new Set(
          Object.entries(selectedObjects)
            .filter(([_, objData]) => objData.isSelected)
            .map(([objectId, _]) => {
              const obj = allObjects.find(o => o.id === objectId);
              return obj ? `${obj.being}::${obj.avatar}::${obj.object}` : null;
            })
            .filter(Boolean) as string[]
        );
        
        console.log('💾 Selected object keys:', Array.from(selectedObjectKeys));

        // Get all objects that currently have relationships (by being/avatar/object combo)
        const objectsWithRelationships = new Map<string, any>(); // key -> relationship data
        for (const rel of relationshipsList) {
          if (rel.relationshipType === 'HAS_SPECIFIC_VARIABLE') {
            const key = `${rel.toBeing}::${rel.toAvatar}::${rel.toObject}`;
            // Find matching object by being, avatar, object
            const matchingObj = allObjects.find(o => 
              o.being === rel.toBeing &&
              o.avatar === rel.toAvatar &&
              o.object === rel.toObject
            );
            if (matchingObj) {
              objectsWithRelationships.set(key, { rel, obj: matchingObj });
            }
          }
        }

        console.log('💾 Objects with existing relationships:', objectsWithRelationships.size);

        // Delete relationships for objects that should no longer be selected
        for (const [key, { rel, obj }] of objectsWithRelationships.entries()) {
          if (!selectedObjectKeys.has(key)) {
            console.log(`🗑️ Deleting relationship for: ${obj.being} - ${obj.avatar} - ${obj.object}`);
            try {
              await apiService.deleteVariableObjectRelationship(selectedVariable.id, {
                relationshipType: 'HAS_SPECIFIC_VARIABLE',
                toSector: obj.sector || '',
                toDomain: obj.domain || '',
                toCountry: obj.country || '',
                toObjectClarifier: obj.classifier || '',
                toBeing: obj.being,
                toAvatar: obj.avatar,
                toObject: obj.object
              });
            } catch (error) {
              console.error(`❌ Failed to delete relationship for ${obj.object}:`, error);
            }
          }
        }

        // Create relationships for newly selected objects
        for (const [objectId, objData] of Object.entries(selectedObjects)) {
          if (!objData.isSelected) continue;
          
          const obj = allObjects.find(o => o.id === objectId);
          if (!obj) {
            console.warn(`⚠️ Object not found for ID: ${objectId}`);
            continue;
          }

          const key = `${obj.being}::${obj.avatar}::${obj.object}`;
          
          // Check if relationship already exists
          if (!objectsWithRelationships.has(key)) {
            console.log(`➕ Creating relationship for: ${obj.being} - ${obj.avatar} - ${obj.object}`);
            try {
              await apiService.createVariableObjectRelationship(selectedVariable.id, {
                relationshipType: 'HAS_SPECIFIC_VARIABLE',
                toSector: obj.sector || '',
                toDomain: obj.domain || '',
                toCountry: obj.country || '',
                toObjectClarifier: obj.classifier || '',
                toBeing: obj.being,
                toAvatar: obj.avatar,
                toObject: obj.object
              });
            } catch (error: any) {
              console.error(`❌ Failed to create relationship for ${obj.object}:`, error);
              const errorMessage = error?.message || error?.toString() || 'Unknown error';
              alert(`Failed to create relationship for ${obj.object}: ${errorMessage}`);
            }
          } else {
            console.log(`✓ Relationship already exists for: ${obj.being} - ${obj.avatar} - ${obj.object}`);
          }
        }
      }

      // Call the callback to refresh main grid data FIRST (before closing)
      // This ensures the main grid is updated with new relationship counts
      if (onSave) {
        await onSave();
      }
      
      // Refresh the data after saving (for single mode, to show updated relationships)
      // In bulk mode, we close immediately since we're not editing existing relationships
      if (!isBulkMode) {
        // Refresh the data to verify relationships were saved
        await initializeSelectedObjects();
        
        // Verify relationships were actually created
        const verifyRelationships = await apiService.getVariableObjectRelationships(selectedVariable.id) as any;
        const verifyList = verifyRelationships.relationships || [];
        const expectedCount = Object.values(selectedObjects).filter(d => d.isSelected).length;
        console.log('✅ Verification: Found', verifyList.length, 'relationships after save (expected:', expectedCount, ')');
        
        if (verifyList.length === 0 && expectedCount > 0) {
          alert('Warning: Relationships may not have been saved. Please check the console for errors.');
          setSaving(false);
          return; // Don't close modal or refresh if save failed
        }
      }
      
      alert(isBulkMode ? 'Bulk relationships created successfully!' : 'Relationships updated successfully!');
      onClose();
    } catch (error) {
      console.error('Failed to save relationships:', error);
      alert('Failed to save relationships. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedObjects({});
    setIsAllSelected(false);
    setUploadErrors([]);
    onClose();
  };

  if (!isOpen || sourceVariables.length === 0) return null;

  // Prepare data for the grid - include all object columns
  // Ensure sector, domain, country are preserved from parsed driver field
  let gridData = allObjects.map(obj => {
    const objData = selectedObjects[obj.id];
    // Preserve parsed sector, domain, country values (they come from parseDriverField)
    // If they're missing, parse from driver string
    let sector = obj.sector;
    let domain = obj.domain;
    let country = obj.country;
    
    if (!sector && obj.driver) {
      const parsed = parseDriverField(obj.driver);
      sector = parsed.sector || '-';
      domain = parsed.domain || '-';
      country = parsed.country || '-';
    }
    
    return {
      ...obj,
      sector: sector || '-',
      domain: domain || '-',
      country: country || '-',
      isSelected: objData?.isSelected || (isAllSelected && objData?.isAllSelected) || false
    };
  });

  // Apply custom sort if rules exist - only sort by Being, Avatar, Object
  if (customSortRules.length > 0) {
    gridData = [...gridData].sort((a, b) => {
      for (const rule of customSortRules) {
        if (!rule.column) continue;
        
        // Only allow sorting by Being, Avatar, Object
        if (!['being', 'avatar', 'object'].includes(rule.column)) continue;
        
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

  // Custom columns for the variable-object relationship modal
  const relationshipColumns = [
    ...objectColumns.filter(col => ['sector', 'domain', 'country', 'being', 'avatar', 'object'].includes(col.key)),
    // Add Object Clarifier column
    {
      key: 'classifier',
      title: 'Object Clarifier',
      sortable: true,
      filterable: true,
      width: '140px'
    }
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
        <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border w-[95vw] h-[90vh] max-w-7xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-ag-dark-border">
            <div className="flex items-center gap-2">
              <Link className="w-5 h-5 text-ag-dark-text-secondary" />
              <h2 className="text-xl font-semibold text-ag-dark-text">
                {isBulkMode 
                  ? `Configuring Object Relationships (${sourceVariables.length} variables)` 
                  : `Configuring Object Relationships for ${sourceVariables[0]?.variable || 'Variable'}`}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsCsvUploadOpen(true)}
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
                onClick={handleSelectAll}
                className={`px-4 py-2 border rounded text-sm transition-colors ${
                  isAllSelected
                    ? 'bg-ag-dark-accent text-white border-ag-dark-accent'
                    : 'bg-ag-dark-bg text-ag-dark-text border-ag-dark-border hover:bg-ag-dark-bg'
                }`}
              >
                {isAllSelected ? 'Deselect ALL' : 'Select ALL'}
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
                  onClearCustomSort={() => setCustomSortRules([])}
                  onColumnSort={() => {}}
                  isCustomSortActive={customSortRules.length > 0}
                  isColumnSortActive={false}
                  highlightCurrentObject={false}
                  showActionsColumn={false}
                  relationshipData={selectedObjects}
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
      </div>

      {/* CSV Upload Modal */}
      <CsvUploadModal
        isOpen={isCsvUploadOpen}
        onClose={() => setIsCsvUploadOpen(false)}
        type="variable-object-relationships"
        onUpload={handleCsvUpload}
      />

      {/* Custom Sort Modal */}
      <RelationshipCustomSortModal
        isOpen={isCustomSortOpen}
        onClose={() => setIsCustomSortOpen(false)}
        onApplySort={(sortRules) => {
          setCustomSortRules(sortRules);
        }}
        currentSortRules={customSortRules}
      />
    </>
  );
};

