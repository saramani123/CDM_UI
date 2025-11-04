import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, Link, Check, Trash2, ArrowUpAZ, Upload } from 'lucide-react';
import { DataGrid } from './DataGrid';
import { objectColumns } from '../data/mockData';
import { apiService } from '../services/api';
import type { ObjectData } from '../data/mockData';
import { RelationshipCustomSortModal } from './RelationshipCustomSortModal';
import { RelationshipCsvUploadModal, type ProcessedRelationship } from './RelationshipCsvUploadModal';

interface InitialRelationship {
  targetObject: ObjectData;
  relationshipType: 'Inter-Table' | 'Blood' | 'Subtype' | 'Intra-Table';
  role: string;
}

interface RelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedObject: ObjectData | null;
  allObjects: ObjectData[];
  onSave?: () => void; // Callback to refresh main data
  initialRelationships?: InitialRelationship[]; // Pre-selected relationships from CSV upload
}

interface RelationshipData {
  objectId: string;
  isSelected: boolean;
  relationshipType: 'Inter-Table' | 'Blood' | 'Subtype' | 'Intra-Table';
  roles: string;
  hasMixedTypes?: boolean; // Flag to indicate mixed relationship types
}

export const RelationshipModal: React.FC<RelationshipModalProps> = ({
  isOpen,
  onClose,
  selectedObject,
  allObjects,
  onSave,
  initialRelationships = []
}) => {
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

  // Initialize relationship data when modal opens
  useEffect(() => {
    if (isOpen && selectedObject && allObjects.length > 0) {
      initializeRelationshipData();
    }
    // Reset relationship data when modal closes
    if (!isOpen) {
      setRelationshipData({});
      setCustomSortRules([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedObject?.id, allObjects.length, initialRelationships.length]);

  const initializeRelationshipData = async () => {
    if (!selectedObject) return;

    setLoading(true);
    try {
      // Load existing relationships for the selected object
      const existingRelationships = await apiService.getObjectRelationships(selectedObject.id) as any;
      const relationshipsList = existingRelationships.relationshipsList || [];

      // Initialize relationship data for all objects
      const initialData: Record<string, RelationshipData> = {};
      
      for (const obj of allObjects) {
        const isSelf = obj.id === selectedObject.id;
        const existingRels = relationshipsList.filter((rel: any) => 
          rel.toBeing === obj.being && 
          rel.toAvatar === obj.avatar && 
          rel.toObject === obj.object
        );

        if (existingRels.length > 0) {
          // Handle legacy relationships with proper role fallbacks
          const roles = new Set<string>();
          const relationshipTypes = new Set<string>();
          
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
          
          // Convert roles set to comma-separated string, deduplicated
          const rolesArray = Array.from(roles);
          const rolesString = rolesArray.join(', ');
          
          initialData[obj.id] = {
            objectId: obj.id,
            isSelected: true,
            relationshipType: relationshipType,
            roles: rolesString,
            hasMixedTypes: hasMixedTypes
          };
        } else {
          // No existing relationships
          initialData[obj.id] = {
            objectId: obj.id,
            isSelected: false,
            relationshipType: isSelf ? 'Intra-Table' : 'Inter-Table',
            roles: ''
          };
        }
      }

      // Apply initial relationships from CSV upload if any
      if (initialRelationships.length > 0) {
        for (const initialRel of initialRelationships) {
          const targetObjId = initialRel.targetObject.id;
          if (initialData[targetObjId]) {
            // If relationship already exists, append roles
            const existingRoles = initialData[targetObjId].roles;
            const newRoles = initialRel.role;
            // Combine roles, avoiding duplicates
            const roleSet = new Set<string>();
            existingRoles.split(', ').forEach(r => { if (r.trim()) roleSet.add(r.trim()); });
            newRoles.split(', ').forEach(r => { if (r.trim()) roleSet.add(r.trim()); });
            const combinedRoles = Array.from(roleSet).join(', ');
            
            initialData[targetObjId] = {
              objectId: targetObjId,
              isSelected: true,
              relationshipType: initialRel.relationshipType,
              roles: combinedRoles,
              hasMixedTypes: false
            };
          } else {
            // New relationship
            initialData[targetObjId] = {
              objectId: targetObjId,
              isSelected: true,
              relationshipType: initialRel.relationshipType,
              roles: initialRel.role,
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
        const isSelf = obj.id === selectedObject.id;
        initialData[obj.id] = {
          objectId: obj.id,
          isSelected: false,
          relationshipType: isSelf ? 'Intra-Table' : 'Inter-Table',
          roles: ''
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
              hasMixedTypes: false
            };
          }
        }
      }
      
      setRelationshipData(initialData);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (objectId: string) => {
    setRelationshipData(prev => {
      const currentData = prev[objectId];
      const currentlySelected = currentData?.isSelected || false;
      
      return {
        ...prev,
        [objectId]: {
          ...prev[objectId],
          isSelected: !currentlySelected,
          roles: !currentlySelected ? (prev[objectId]?.roles || selectedObject?.object || '') : prev[objectId]?.roles || ''
        }
      };
    });
  };

  const handleRelationshipTypeChange = (objectId: string, type: 'Inter-Table' | 'Blood' | 'Subtype' | 'Intra-Table') => {
    setRelationshipData(prev => ({
      ...prev,
      [objectId]: {
        ...prev[objectId],
        relationshipType: type
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
    if (!selectedObject) return;

    setSaving(true);
    try {
      
      // Validation 1: Check for roles entered without checkbox selected
      for (const [objectId, relData] of Object.entries(relationshipData)) {
        const targetObject = allObjects.find(obj => obj.id === objectId);
        if (!targetObject) continue;

        const isSelf = objectId === selectedObject.id;
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

      // Validation 3: Check if user deleted the auto-created role (object name)
      for (const [objectId, relData] of Object.entries(relationshipData)) {
        const targetObject = allObjects.find(obj => obj.id === objectId);
        if (!targetObject) continue;

        const isSelf = objectId === selectedObject.id;
        if (isSelf && relData.roles && relData.roles.trim().length > 0) {
          const validRoles = validateRoles(relData.roles);
          const objectName = selectedObject.object;
          
          // Check if the object name is missing from the roles
          if (!validRoles.includes(objectName)) {
            alert(`Please do not delete the automatically created role name "${objectName}" which is the name of the object we are configuring relationships for.`);
            setSaving(false);
            return;
          }
        }
      }

      // Process each object's relationship data
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

      // Refresh the data after saving
      await initializeRelationshipData();
      
      // Call the callback to refresh main grid data
      if (onSave) {
        onSave();
      }
      
      alert('Relationships updated successfully!');
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
    onClose();
  };

  if (!isOpen || !selectedObject) return null;

  // Prepare data for the grid with relationship controls
  let gridData = allObjects.map(obj => {
    const relData = relationshipData[obj.id];
    const isSelf = obj.id === selectedObject.id;
    
    return {
      ...obj,
      isCurrentObject: isSelf,
      relationshipType: relData?.relationshipType || (isSelf ? 'Intra-Table' : 'Inter-Table'),
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
    // Filter out sector, domain, country from objectColumns and keep only being, avatar, object
    ...objectColumns.filter(col => ['being', 'avatar', 'object'].includes(col.key)),
    {
      key: 'relationshipType',
      title: 'Relationship Type',
      width: 200, // Expanded from 150
      render: (row: any) => {
        const isSelf = row.id === selectedObject.id;
        const currentType = relationshipData[row.id]?.relationshipType || (isSelf ? 'Intra-Table' : 'Inter-Table');
        const hasMixedTypes = relationshipData[row.id]?.hasMixedTypes || false;
        
        return (
          <div className="relative">
            <select
              value={currentType}
              onChange={(e) => handleRelationshipTypeChange(row.id, e.target.value as any)}
              disabled={isSelf}
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
      key: 'roles',
      title: 'Roles',
      width: 400, // Expanded from 250 to use freed space from removed columns
      render: (row: any) => (
        <div className="w-full h-full flex items-center">
          <input
            type="text"
            value={relationshipData[row.id]?.roles || ''}
            onChange={(e) => handleRolesChange(row.id, e.target.value)}
            placeholder="Enter roles (comma-separated)"
            className="w-full px-2 py-1.5 text-sm bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            style={{ 
              width: 'calc(100% + 400px)',
              marginRight: '-400px'
            }}
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
              Configuring Relationships
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
        selectedObject={selectedObject}
        allObjects={allObjects}
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
