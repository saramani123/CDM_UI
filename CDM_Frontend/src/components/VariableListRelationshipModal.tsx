import React, { useState, useEffect, useCallback } from 'react';
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
  
  // Selection mode: 'manual' (default), 'any', or 'keyword'
  const [selectionMode, setSelectionMode] = useState<'manual' | 'any' | 'keyword'>('manual');
  const [keywordFilter, setKeywordFilter] = useState<string>('');
  // Track the keyword that was last saved (to detect changes)
  const [savedKeyword, setSavedKeyword] = useState<string>('');

  // Get storage key for persisting keyword filter per list
  const getKeywordStorageKey = () => {
    if (sourceLists.length === 1) {
      return `list_keyword_filter_${sourceLists[0].id}`;
    }
    return null; // Don't persist for bulk mode
  };

  // Get storage key for persisting saved keyword per list
  const getSavedKeywordStorageKey = () => {
    if (sourceLists.length === 1) {
      return `list_saved_keyword_${sourceLists[0].id}`;
    }
    return null;
  };

  // Load persisted keyword filter when modal opens or list changes
  useEffect(() => {
    if (isOpen && sourceLists.length > 0) {
      const storageKey = getKeywordStorageKey();
      const savedKeywordKey = getSavedKeywordStorageKey();
      if (storageKey) {
        const savedKeywordValue = localStorage.getItem(storageKey);
        if (savedKeywordValue && savedKeywordValue.trim()) {
          setKeywordFilter(savedKeywordValue);
          setSelectionMode('keyword');
        } else {
          // If no saved keyword filter, check for saved keyword (from previous save)
          // This ensures the keyword field always shows the last used keyword
          if (savedKeywordKey) {
            const lastSavedKeyword = localStorage.getItem(savedKeywordKey);
            if (lastSavedKeyword && lastSavedKeyword.trim()) {
              setKeywordFilter(lastSavedKeyword);
              setSelectionMode('keyword');
            } else {
              // Clear keyword if nothing is saved
              setKeywordFilter('');
              setSelectionMode('manual');
            }
          }
        }
      }
      // Load the last saved keyword
      if (savedKeywordKey) {
        const lastSavedKeyword = localStorage.getItem(savedKeywordKey);
        if (lastSavedKeyword) {
          setSavedKeyword(lastSavedKeyword);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sourceLists.length, sourceLists[0]?.id]); // Add list ID to dependencies

  // Initialize selected variables when modal opens or list changes
  useEffect(() => {
    if (isOpen && sourceLists.length > 0 && allVariables.length > 0) {
      initializeSelectedVariables();
    }
    // Reset when modal closes (but preserve keyword filter)
    if (!isOpen) {
      setSelectedVariables({});
      // Don't reset selectionMode and keywordFilter - they're persisted
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sourceLists.length, sourceLists[0]?.id, allVariables.length]); // Add list ID to dependencies

  const initializeSelectedVariables = async () => {
    if (sourceLists.length === 0) return;

    setLoading(true);
    try {
      // Get current keyword from localStorage (in case state hasn't updated yet)
      const storageKey = getKeywordStorageKey();
      const savedKeywordKey = getSavedKeywordStorageKey();
      let currentKeyword = keywordFilter;
      if (storageKey) {
        const savedKeywordValue = localStorage.getItem(storageKey);
        if (savedKeywordValue && savedKeywordValue.trim()) {
          currentKeyword = savedKeywordValue;
        } else if (savedKeywordKey) {
          const lastSavedKeyword = localStorage.getItem(savedKeywordKey);
          if (lastSavedKeyword && lastSavedKeyword.trim()) {
            currentKeyword = lastSavedKeyword;
          }
        }
      }
      
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
      
      // If keyword mode is active, use keyword to determine selection
      // Otherwise, use existing relationships
      if (selectionMode === 'keyword' && currentKeyword && currentKeyword.trim()) {
        // Apply keyword filter to determine selection
        const keywordParts = currentKeyword.trim().toLowerCase().split(/\s+/).filter(k => k.length > 0);
        for (const variable of allVariables) {
          const searchableText = [
            variable.variable || '',
            variable.part || '',
            variable.group || '',
            variable.section || ''
          ].join(' ').toLowerCase();
          
          const matches = keywordParts.every(keyword => searchableText.includes(keyword));
          
          initialData[variable.id] = {
            variableId: variable.id,
            isSelected: matches
          };
        }
      } else if (selectionMode === 'any') {
        // Select all variables
        for (const variable of allVariables) {
          initialData[variable.id] = {
            variableId: variable.id,
            isSelected: true
          };
        }
      } else {
        // Manual mode: use existing relationships
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
      }
      
      setSelectedVariables(initialData);
    } finally {
      setLoading(false);
    }
  };

  // Apply selection mode (Any or Keyword) to variables
  const applySelectionMode = useCallback(() => {
    if (selectionMode === 'any') {
      // Select ALL variables dynamically
      const newSelection: Record<string, SelectedVariableData> = {};
      for (const variable of allVariables) {
        newSelection[variable.id] = {
          variableId: variable.id,
          isSelected: true
        };
      }
      setSelectedVariables(newSelection);
    } else if (selectionMode === 'keyword' && keywordFilter.trim()) {
      // Select variables matching keywords (case-insensitive, preserves spacing)
      // Split by spaces to support multiple keywords (AND logic - all keywords must match)
      const keywordParts = keywordFilter.trim().toLowerCase().split(/\s+/).filter(k => k.length > 0);
      const newSelection: Record<string, SelectedVariableData> = {};
      
      for (const variable of allVariables) {
        // Search in variable name and other relevant fields
        const searchableText = [
          variable.variable || '',
          variable.part || '',
          variable.group || '',
          variable.section || ''
        ].join(' ').toLowerCase();
        
        // All keyword parts must be found in the searchable text (AND logic)
        const matches = keywordParts.every(keyword => searchableText.includes(keyword));
        
        newSelection[variable.id] = {
          variableId: variable.id,
          isSelected: matches
        };
      }
      setSelectedVariables(newSelection);
    }
    // For 'manual' mode, keep current selection
  }, [selectionMode, keywordFilter, allVariables]);

  // Update selection when mode changes or allVariables changes
  useEffect(() => {
    if (isOpen && allVariables.length > 0 && !loading) {
      if (selectionMode === 'any' || (selectionMode === 'keyword' && keywordFilter.trim())) {
        applySelectionMode();
      }
    }
  }, [selectionMode, keywordFilter, allVariables, isOpen, loading, applySelectionMode]);

  const handleAnyButtonClick = () => {
    setSelectionMode('any');
    // Don't clear keyword filter - keep it visible so user can see what was last used
    // The keyword will remain in the input field but won't be applied in "Any" mode
  };

  const handleKeywordChange = (value: string) => {
    setKeywordFilter(value);
    const storageKey = getKeywordStorageKey();
    const savedKeywordKey = getSavedKeywordStorageKey();
    if (value.trim()) {
      setSelectionMode('keyword');
      // Persist keyword filter (for immediate use)
      if (storageKey) {
        localStorage.setItem(storageKey, value);
      }
      // Also save to saved keyword (for persistence across sessions)
      if (savedKeywordKey) {
        localStorage.setItem(savedKeywordKey, value);
      }
    } else {
      // If keyword is cleared, revert to manual mode and remove from storage
      setSelectionMode('manual');
      if (storageKey) {
        localStorage.removeItem(storageKey);
      }
      // Don't remove savedKeyword - keep it so user can see what was last used
      // Only remove it if user explicitly clears it via the clear button
    }
  };

  const handleClearKeyword = () => {
    setKeywordFilter('');
    setSelectionMode('manual');
    const storageKey = getKeywordStorageKey();
    const savedKeywordKey = getSavedKeywordStorageKey();
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
    // Also clear saved keyword when user explicitly clears it
    if (savedKeywordKey) {
      localStorage.removeItem(savedKeywordKey);
      setSavedKeyword('');
    }
  };

  const handleManualSelection = () => {
    setSelectionMode('manual');
    // Don't clear keyword filter - keep it visible so user can see what was applied
    // User can clear it manually with the X button if needed
  };

  const handleRowClick = (variableId: string) => {
    // When manually clicking, switch to manual mode (but keep keyword visible)
    if (selectionMode !== 'manual') {
      setSelectionMode('manual');
      // Don't clear keyword filter - keep it visible so user can see what was applied
    }
    
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

      // SINGLE MODE: Handle mode switching and keyword changes
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

      // Determine current keyword (empty if not in keyword mode or keyword cleared)
      // For "any" mode, we don't track a keyword
      const currentKeyword = (selectionMode === 'keyword' && keywordFilter.trim()) ? keywordFilter.trim() : '';
      
      // Check if keyword changed or mode switched
      const keywordChanged = currentKeyword !== savedKeyword;

      // If keyword changed and we had a saved keyword, delete relationships for old keyword
      if (keywordChanged && savedKeyword) {
        // Find all variables that matched the old keyword
        const keywordParts = savedKeyword.toLowerCase().split(/\s+/).filter(k => k.length > 0);
        const variablesMatchingOldKeyword = allVariables.filter(variable => {
          const searchableText = [
            variable.variable || '',
            variable.part || '',
            variable.group || '',
            variable.section || ''
          ].join(' ').toLowerCase();
          return keywordParts.every(keyword => searchableText.includes(keyword));
        });

        // Delete relationships for variables that matched the old keyword
        for (const variable of variablesMatchingOldKeyword) {
          const existingRel = existingRelationships.find((rel: any) => 
            (rel.id === variable.id || rel.variableId === variable.id)
          );
          if (existingRel) {
            try {
              await apiService.deleteVariableListRelationship(variable.id, currentList.id);
              deletedVariableIds.add(variable.id);
              // Remove from existingRelationships to avoid duplicate deletion attempts
              existingRelationships = existingRelationships.filter((rel: any) => 
                rel.id !== variable.id && rel.variableId !== variable.id
              );
            } catch (error) {
              console.error(`Failed to delete relationship for variable ${variable.id}:`, error);
            }
          }
        }
      }

      // Track which variables should have relationships
      const selectedVariableIdSet = new Set(selectedVariableIds);
      const existingVariableIdSet = new Set(
        existingRelationships.map((rel: any) => rel.id || rel.variableId)
      );

      // Delete relationships for variables that should no longer be selected
      // (but skip if we already deleted them due to keyword change)
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

      // Update saved keyword - always save the current keyword if it exists
      // This ensures the keyword persists even if user switches modes
      const savedKeywordKey = getSavedKeywordStorageKey();
      const storageKey = getKeywordStorageKey();
      if (currentKeyword && currentKeyword.trim()) {
        setSavedKeyword(currentKeyword);
        if (savedKeywordKey) {
          localStorage.setItem(savedKeywordKey, currentKeyword);
        }
        // Also update the filter key to keep it in sync
        if (storageKey) {
          localStorage.setItem(storageKey, currentKeyword);
        }
      }
      // Don't clear saved keyword when switching modes - keep it for persistence

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
  // Increase variable column width to prevent truncation
  const relationshipColumns = variableColumns
    .filter(col => 
      ['sector', 'domain', 'country', 'part', 'group', 'section', 'variable'].includes(col.key)
    )
    .map(col => {
      if (col.key === 'variable') {
        return { ...col, width: '400px' }; // Increased from 200px to 400px
      }
      return col;
    });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border w-[95vw] h-[90vh] max-w-[120rem] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ag-dark-border">
          <div className="flex items-center gap-2">
            <Link className="w-5 h-5 text-ag-dark-text-secondary" />
            <h2 className="text-xl font-semibold text-ag-dark-text">
              {isBulkMode 
                ? `Configuring Variable Applicability (${sourceLists.length} lists)` 
                : `Configuring Variable Applicability for ${sourceLists[0]?.list || 'List'}`}
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
            <>
              {/* Selection Mode Controls */}
              <div className="mb-4 p-4 bg-ag-dark-bg rounded-lg border border-ag-dark-border">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ag-dark-text">Selection Mode:</span>
                    <button
                      onClick={handleAnyButtonClick}
                      className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                        selectionMode === 'any'
                          ? 'bg-ag-dark-accent text-white'
                          : 'bg-ag-dark-surface border border-ag-dark-border text-ag-dark-text hover:bg-ag-dark-bg'
                      }`}
                      title="Select all variables (dynamic - includes new variables automatically)"
                    >
                      Any
                    </button>
                    <div className="flex items-center gap-2 ml-2">
                      <label className="text-sm text-ag-dark-text-secondary">Keywords:</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={keywordFilter}
                          onChange={(e) => handleKeywordChange(e.target.value)}
                          placeholder="Enter keywords to match variables..."
                          className="px-3 py-2 pr-8 text-sm bg-ag-dark-surface border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent w-80"
                          title="Enter keywords to auto-select matching variables (case-insensitive, preserves spacing)"
                        />
                        {keywordFilter && (
                          <button
                            onClick={handleClearKeyword}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
                            title="Clear keyword filter"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {selectionMode === 'any' && (
                    <div className="text-xs text-ag-dark-text-secondary">
                      All {allVariables.length} variables will be selected
                    </div>
                  )}
                  {selectionMode === 'keyword' && keywordFilter.trim() && (
                    <div className="text-xs text-ag-dark-text-secondary">
                      {Object.values(selectedVariables).filter(v => v.isSelected).length} variable(s) match "{keywordFilter}"
                    </div>
                  )}
                </div>
              </div>
              
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
            </>
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

