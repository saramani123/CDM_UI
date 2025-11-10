import React, { useState, useEffect } from 'react';
import { X, Save, Link } from 'lucide-react';
import { DataGrid } from './DataGrid';
import { variableColumns } from '../data/variablesData';
import { apiService } from '../services/api';
import type { VariableData } from '../data/variablesData';

interface VariableListRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedList: any; // For single-list mode
  selectedLists?: any[]; // For bulk mode (multiple lists)
  allVariables: VariableData[];
  onSave?: () => void; // Callback to refresh main data
  isBulkMode?: boolean; // Flag to indicate bulk edit mode
}

interface SelectedVariableData {
  variableId: string;
  isSelected: boolean;
}

export const VariableListRelationshipModal: React.FC<VariableListRelationshipModalProps> = ({
  isOpen,
  onClose,
  selectedList,
  selectedLists = [],
  allVariables,
  onSave,
  isBulkMode = false
}) => {
  // Determine source lists: use selectedLists if provided (bulk mode), otherwise use selectedList (single mode)
  const sourceLists = isBulkMode && selectedLists.length > 0 
    ? selectedLists 
    : selectedList 
      ? [selectedList] 
      : [];
  
  const [selectedVariables, setSelectedVariables] = useState<Record<string, SelectedVariableData>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize selected variables when modal opens
  useEffect(() => {
    if (isOpen && sourceLists.length > 0 && allVariables.length > 0) {
      initializeSelectedVariables();
    }
    // Reset when modal closes
    if (!isOpen) {
      setSelectedVariables({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sourceLists.length, allVariables.length]);

  const initializeSelectedVariables = async () => {
    if (sourceLists.length === 0) return;

    setLoading(true);
    try {
      let allExistingRelationships: any[] = [];
      
      if (!isBulkMode && sourceLists.length === 1) {
        // For single list, load existing relationships
        try {
          const listId = sourceLists[0].id;
          const existingRelationships = await apiService.getListVariableRelationships(listId) as any;
          allExistingRelationships = existingRelationships.variables || [];
        } catch (error) {
          console.error('Failed to load existing relationships:', error);
        }
      } else if (isBulkMode) {
        // Bulk mode: load existing relationships for all source lists
        for (const list of sourceLists) {
          try {
            const existingRelationships = await apiService.getListVariableRelationships(list.id) as any;
            const variablesList = existingRelationships.variables || [];
            allExistingRelationships.push(...variablesList.map((var_: any) => ({ ...var_, listId: list.id })));
          } catch (error) {
            console.error(`Failed to load relationships for list ${list.id}:`, error);
          }
        }
      }

      // Initialize selection data for all variables
      const initialData: Record<string, SelectedVariableData> = {};
      
      for (const variable of allVariables) {
        // Check if this variable has a relationship with any of the source lists
        const hasRelationship = allExistingRelationships.some((rel: any) => {
          // Match by variable ID or by composite key (part, group, section, variable)
          if (rel.id === variable.id) return true;
          if (rel.variableId === variable.id) return true;
          if (rel.part === variable.part && 
              rel.group === variable.group && 
              rel.section === variable.section && 
              rel.variable === variable.variable) {
            return true;
          }
          return false;
        });
        
        initialData[variable.id] = {
          variableId: variable.id,
          isSelected: hasRelationship
        };
      }
      
      setSelectedVariables(initialData);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (variableId: string) => {
    setSelectedVariables(prev => {
      const currentData = prev[variableId];
      const currentlySelected = currentData?.isSelected || false;
      
      return {
        ...prev,
        [variableId]: {
          variableId: variableId,
          isSelected: !currentlySelected
        }
      };
    });
  };

  const handleSave = async () => {
    if (sourceLists.length === 0) return;

    setSaving(true);
    try {
      if (isBulkMode) {
        // BULK MODE: Create relationships from each selected variable to each source list
        const selectedVariableIds = Object.entries(selectedVariables)
          .filter(([_, data]) => data.isSelected)
          .map(([id, _]) => id);
        
        if (selectedVariableIds.length === 0) {
          alert('Please select at least one variable to create relationships.');
          setSaving(false);
          return;
        }

        // Collect all relationships to create
        const relationshipsToCreate: Array<{
          variableId: string;
          listId: string;
          variable: VariableData;
        }> = [];

        // Check for duplicates before creating
        const duplicates: Array<{ variableName: string; listName: string }> = [];

        for (const list of sourceLists) {
          // Get existing relationships for this list
          let existingRelationships: any[] = [];
          try {
            const existing = await apiService.getListVariableRelationships(list.id) as any;
            existingRelationships = existing.variables || [];
          } catch (error) {
            console.error(`Failed to load relationships for list ${list.id}:`, error);
          }
          
          // Create a set of existing variable IDs for this list
          const existingVariableIds = new Set(
            existingRelationships.map((rel: any) => rel.id || rel.variableId)
          );

          for (const variableId of selectedVariableIds) {
            const variable = allVariables.find(v => v.id === variableId);
            if (!variable) continue;

            // Check if relationship already exists
            if (existingVariableIds.has(variableId)) {
              duplicates.push({
                variableName: variable.variable || variable.id,
                listName: list.list || list.name || list.id
              });
            } else {
              relationshipsToCreate.push({
                variableId: variableId,
                listId: list.id,
                variable: variable
              });
            }
          }
        }

        // If duplicates found, show error and abort
        if (duplicates.length > 0) {
          const duplicateMessages = duplicates.map(dup => 
            `${dup.variableName} → ${dup.listName}`
          );
          alert(`Duplicate relationships detected. The following relationships already exist:\n\n${duplicateMessages.slice(0, 10).join('\n')}${duplicateMessages.length > 10 ? `\n... and ${duplicateMessages.length - 10} more` : ''}\n\nPlease remove duplicates before saving.`);
          setSaving(false);
          return;
        }

        // Create relationships
        for (const rel of relationshipsToCreate) {
          try {
            await apiService.createVariableListRelationship(rel.variableId, rel.listId);
          } catch (error: any) {
            // Check if it's a duplicate error
            if (error.message?.includes('Duplicate') || error.message?.includes('already exists')) {
              console.warn(`Duplicate relationship skipped: ${rel.variableId} -> ${rel.listId}`);
            } else {
              console.error(`Failed to create relationship:`, error);
              throw error;
            }
          }
        }

        // Call the callback to refresh main data
        if (onSave) {
          await onSave();
        }
        
        alert(`Bulk relationships created successfully! Created ${relationshipsToCreate.length} relationship(s) for ${sourceLists.length} list(s).`);
        onClose();
        return;
      }

      // SINGLE MODE: Original logic for single list
      const currentList = sourceLists[0];
      const selectedVariableIds = Object.entries(selectedVariables)
        .filter(([_, data]) => data.isSelected)
        .map(([id, _]) => id);
      
      // Get current relationships
      let existingRelationships: any[] = [];
      try {
        const existing = await apiService.getListVariableRelationships(currentList.id) as any;
        existingRelationships = existing.variables || [];
      } catch (error) {
        console.error('Failed to load existing relationships:', error);
      }

      // Track which variables should have relationships
      const selectedVariableIdSet = new Set(selectedVariableIds);
      const existingVariableIdSet = new Set(
        existingRelationships.map((rel: any) => rel.id || rel.variableId)
      );

      // Delete relationships for variables that should no longer be selected
      for (const existingRel of existingRelationships) {
        const variableId = existingRel.id || existingRel.variableId;
        if (!selectedVariableIdSet.has(variableId)) {
          try {
            await apiService.deleteVariableListRelationship(variableId, currentList.id);
          } catch (error) {
            console.error(`Failed to delete relationship:`, error);
          }
        }
      }

      // Create relationships for newly selected variables
      for (const variableId of selectedVariableIds) {
        if (!existingVariableIdSet.has(variableId)) {
          try {
            await apiService.createVariableListRelationship(variableId, currentList.id);
          } catch (error: any) {
            console.error(`Failed to create relationship:`, error);
            const errorMessage = error?.message || error?.toString() || 'Unknown error';
            alert(`Failed to create relationship: ${errorMessage}`);
          }
        }
      }

      // Call the callback to refresh main data
      if (onSave) {
        await onSave();
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
    setSelectedVariables({});
    onClose();
  };

  if (!isOpen || sourceLists.length === 0) return null;

  // Prepare data for the grid - deduplicate by ID
  const seenIds = new Set<string>();
  const gridData = allVariables
    .filter(variable => {
      if (seenIds.has(variable.id)) {
        return false; // Skip duplicates
      }
      seenIds.add(variable.id);
      return true;
    })
    .map(variable => {
      const varData = selectedVariables[variable.id];
      return {
        ...variable,
        isSelected: varData?.isSelected || false
      };
    });

  // Custom columns for the variable-list relationship modal
  const relationshipColumns = variableColumns.filter(col => 
    ['sector', 'domain', 'country', 'part', 'group', 'section', 'variable'].includes(col.key)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border w-[95vw] h-[90vh] max-w-7xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ag-dark-border">
          <div className="flex items-center gap-2">
            <Link className="w-5 h-5 text-ag-dark-text-secondary" />
            <h2 className="text-xl font-semibold text-ag-dark-text">
              {isBulkMode 
                ? `Configuring Variable Relationships (${sourceLists.length} lists)` 
                : `Configuring Variable Relationships for ${sourceLists[0]?.list || 'List'}`}
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
                highlightCurrentObject={false}
                showActionsColumn={false}
                relationshipData={selectedVariables}
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
  );
};

