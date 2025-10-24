import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, Link, Check, Trash2 } from 'lucide-react';
import { DataGrid } from './DataGrid';
import { objectColumns } from '../data/mockData';
import { apiService } from '../services/api';
import type { ObjectData } from '../data/mockData';

interface RelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedObject: ObjectData | null;
  allObjects: ObjectData[];
  onSave?: () => void; // Callback to refresh main data
}

interface RelationshipData {
  objectId: string;
  isSelected: boolean;
  relationshipType: 'Inter-Table' | 'Blood' | 'Intra-Table';
  roles: string;
}

export const RelationshipModal: React.FC<RelationshipModalProps> = ({
  isOpen,
  onClose,
  selectedObject,
  allObjects,
  onSave
}) => {
  const [relationshipData, setRelationshipData] = useState<Record<string, RelationshipData>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize relationship data when modal opens
  useEffect(() => {
    if (isOpen && selectedObject && allObjects.length > 0) {
      initializeRelationshipData();
    }
  }, [isOpen, selectedObject, allObjects]);

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

        initialData[obj.id] = {
          objectId: obj.id,
          isSelected: existingRels.length > 0,
          relationshipType: isSelf ? 'Intra-Table' : 'Inter-Table',
          roles: existingRels.map((rel: any) => rel.role).join(', ')
        };
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
      setRelationshipData(initialData);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (objectId: string, checked: boolean) => {
    setRelationshipData(prev => ({
      ...prev,
      [objectId]: {
        ...prev[objectId],
        isSelected: checked,
        roles: checked ? (prev[objectId]?.roles || selectedObject?.object || '') : prev[objectId]?.roles || ''
      }
    }));
  };

  const handleRelationshipTypeChange = (objectId: string, type: 'Inter-Table' | 'Blood' | 'Intra-Table') => {
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
      // Process each object's relationship data
      for (const [objectId, relData] of Object.entries(relationshipData)) {
        const targetObject = allObjects.find(obj => obj.id === objectId);
        if (!targetObject) continue;

        const isSelf = objectId === selectedObject.id;
        const validRoles = validateRoles(relData.roles);

        if (relData.isSelected && validRoles.length > 0) {
          // Create or update relationships
          for (const role of validRoles) {
            try {
              await apiService.createRelationship(selectedObject.id, {
                type: relData.relationshipType,
                role: role,
                toBeing: targetObject.being,
                toAvatar: targetObject.avatar,
                toObject: targetObject.object
              });
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
  const gridData = allObjects.map(obj => {
    const relData = relationshipData[obj.id];
    const isSelf = obj.id === selectedObject.id;
    
    return {
      ...obj,
      isCurrentObject: isSelf,
      relationshipType: relData?.relationshipType || (isSelf ? 'Intra-Table' : 'Inter-Table'),
      roles: relData?.roles || ''
    };
  });

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
        
        return (
          <select
            value={currentType}
            onChange={(e) => handleRelationshipTypeChange(row.id, e.target.value as any)}
            disabled={isSelf}
            className="w-full px-3 py-1.5 text-sm bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50 disabled:cursor-not-allowed pr-8 appearance-none"
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
              </>
            )}
          </select>
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
              Configuring Relationships for: {selectedObject.sector} - {selectedObject.domain} - {selectedObject.country} - {selectedObject.being} - {selectedObject.avatar} - {selectedObject.object}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-ag-dark-text-secondary">Loading relationships...</div>
            </div>
          ) : (
            <div className="h-full bg-ag-dark-bg rounded-lg border border-ag-dark-border overflow-hidden">
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
                onRelationshipCheckboxChange={handleCheckboxChange}
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
  );
};
