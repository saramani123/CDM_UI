import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { X, Save, Link, ArrowUpAZ, Loader2 } from 'lucide-react';
import { DataGrid } from './DataGrid';
import { variableColumns } from '../data/variablesData';
import { apiService } from '../services/api';
import type { VariableData } from '../data/variablesData';
import { VariablesCustomSortModal } from './VariablesCustomSortModal';

/** Lowercased text for keyword applicability (`variable` + optional API `name`; spacing preserved). */
function variableKeywordHaystack(v: { variable?: string; name?: string }): string {
  return `${v.variable ?? ''} ${v.name ?? ''}`.trim().toLowerCase();
}

export type ListApplicabilityDraftPayload = {
  variables: VariableData[];
  selectionMode: 'manual' | 'any' | 'keyword';
  keyword: string;
};

interface VariableListRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedList: any; // For single-list mode
  selectedLists?: any[]; // For bulk mode (multiple lists)
  allVariables: VariableData[];
  onSave?: () => void; // Callback to refresh main data
  isBulkMode?: boolean; // Flag to indicate bulk edit mode
  /** When true, do not call list APIs; commit selection via onDraftSave (e.g. Add List panel). */
  isDraftMode?: boolean;
  /** Variable IDs to show as selected when opening draft (manual baseline). */
  draftInitialVariableIds?: string[];
  onDraftSave?: (payload: ListApplicabilityDraftPayload) => void;
  variablesOrderSortOrder?: {
    partOrder: string[];
    sectionOrders: Record<string, string[]>;
    groupOrders: Record<string, string[]>;
    variableOrders: Record<string, string[]>;
  };
  isVariablesOrderEnabled?: boolean;
}

interface SelectedVariableData {
  variableId: string;
  isSelected: boolean;
}

/** Stable fallback so default `= []` is not re-created every render (that was re-firing init effects). */
const EMPTY_DRAFT_VARIABLE_IDS: readonly string[] = [];

export const VariableListRelationshipModal: React.FC<VariableListRelationshipModalProps> = ({
  isOpen,
  onClose,
  selectedList,
  selectedLists = [],
  allVariables,
  onSave,
  isBulkMode = false,
  isDraftMode = false,
  draftInitialVariableIds,
  onDraftSave,
  variablesOrderSortOrder,
  isVariablesOrderEnabled = false
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
  const [isCustomSortOpen, setIsCustomSortOpen] = useState(false);
  const [customSortRules, setCustomSortRules] = useState<Array<{
    id: string;
    column: string;
    sortOn: string;
    order: 'asc' | 'desc';
  }>>([]);
  const [isApplicabilityOrderEnabled, setIsApplicabilityOrderEnabled] = useState(isVariablesOrderEnabled);

  /** Avoid effect churn when the variables array reference changes but contents are stable. */
  const allVariablesRef = useRef<VariableData[]>(allVariables);
  allVariablesRef.current = allVariables;

  const resolvedDraftVariableIds = draftInitialVariableIds ?? EMPTY_DRAFT_VARIABLE_IDS;
  /** Content-based key — stable when parent omits prop or passes a fresh `[]` each render. */
  const draftVariableIdsKey = [...resolvedDraftVariableIds].filter(Boolean).sort().join('\x1e');

  const initGenerationRef = useRef(0);

  /** Set loading before first paint when opening so we never flash the grid at wrong state. */
  useLayoutEffect(() => {
    if (!isOpen) {
      setLoading(false);
      return;
    }
    if (sourceLists.length === 0 || allVariables.length === 0) {
      return;
    }
    setLoading(true);
  }, [isOpen, sourceLists.length, sourceLists[0]?.id, allVariables.length, draftVariableIdsKey]);
  
  // Selection mode: 'manual' (default), 'any', or 'keyword'
  const [selectionMode, setSelectionMode] = useState<'manual' | 'any' | 'keyword'>('manual');
  const [keywordFilter, setKeywordFilter] = useState<string>('');
  // Track the keyword that was last saved (to detect changes)
  const [savedKeyword, setSavedKeyword] = useState<string>('');

  // Get storage key for persisting keyword filter per list
  const getKeywordStorageKey = () => {
    if (isDraftMode) {
      return 'cdm_add_list_applicability_keyword';
    }
    if (sourceLists.length === 1) {
      return `list_keyword_filter_${sourceLists[0].id}`;
    }
    return null; // Don't persist for bulk mode
  };

  // Get storage key for persisting saved keyword per list
  const getSavedKeywordStorageKey = () => {
    if (isDraftMode) {
      return 'cdm_add_list_applicability_saved_keyword';
    }
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
    if (!isOpen) {
      setSelectedVariables({});
      initGenerationRef.current++;
      return;
    }
    if (sourceLists.length === 0 || allVariables.length === 0) {
      return;
    }

    const generation = ++initGenerationRef.current;

    const initializeSelectedVariables = async () => {
      if (sourceLists.length === 0) return;

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
      
      if (!isDraftMode) {
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
          // Bulk mode: load existing relationships for all source lists (union for display)
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
      }

      const draftIdSet = new Set(resolvedDraftVariableIds.filter(Boolean));

      // Initialize selection data for all variables
      const initialData: Record<string, SelectedVariableData> = {};
      
      // Keyword selection: use storage-resolved keyword even if React hasn't committed
      // `selectionMode === 'keyword'` yet (keyword effect runs in the same tick as this effect).
      // "Any" still wins when explicitly selected.
      const useKeywordInit =
        selectionMode !== 'any' && Boolean((currentKeyword || '').trim());
      if (useKeywordInit) {
        const keywordParts = currentKeyword.trim().toLowerCase().split(/\s+/).filter(k => k.length > 0);
        for (const variable of allVariables) {
          const haystack = variableKeywordHaystack(variable);
          const matches = keywordParts.every(keyword => haystack.includes(keyword));
          
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
        // Manual mode: use existing relationships (or draft IDs for Add List)
        for (const variable of allVariables) {
          const hasRelationship = isDraftMode
            ? draftIdSet.has(variable.id)
            : allExistingRelationships.some((rel: any) => {
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
      
      if (generation !== initGenerationRef.current) return;
      setSelectedVariables(initialData);
    } finally {
      if (generation === initGenerationRef.current) {
        setLoading(false);
      }
    }
    };

    void initializeSelectedVariables();

    return () => {
      initGenerationRef.current++;
    };
  }, [
    isOpen,
    sourceLists.length,
    sourceLists[0]?.id,
    allVariables.length,
    isDraftMode,
    draftVariableIdsKey
  ]);

  // Apply selection mode (Any or Keyword) to variables
  const applySelectionMode = useCallback(() => {
    const vars = allVariablesRef.current;
    if (selectionMode === 'any') {
      // Select ALL variables dynamically
      const newSelection: Record<string, SelectedVariableData> = {};
      for (const variable of vars) {
        newSelection[variable.id] = {
          variableId: variable.id,
          isSelected: true
        };
      }
      setSelectedVariables(newSelection);
    } else if (selectionMode === 'keyword' && keywordFilter.trim()) {
      // Select variables matching keywords (name + variable label; case-insensitive)
      const keywordParts = keywordFilter.trim().toLowerCase().split(/\s+/).filter(k => k.length > 0);
      const newSelection: Record<string, SelectedVariableData> = {};
      
      for (const variable of vars) {
        const haystack = variableKeywordHaystack(variable);
        const matches = keywordParts.every(keyword => haystack.includes(keyword));
        
        newSelection[variable.id] = {
          variableId: variable.id,
          isSelected: matches
        };
      }
      setSelectedVariables(newSelection);
    }
    // For 'manual' mode, keep current selection
  }, [selectionMode, keywordFilter]);

  // Update selection when mode / keyword changes (variables read from ref to avoid dependency loops)
  useEffect(() => {
    if (isOpen && allVariablesRef.current.length > 0 && !loading) {
      if (selectionMode === 'any' || (selectionMode === 'keyword' && keywordFilter.trim())) {
        applySelectionMode();
      }
    }
  }, [selectionMode, keywordFilter, isOpen, loading, applySelectionMode, allVariables.length]);

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
      const resolveVariablesToRelate = (): string[] => {
        const currentKeyword =
          selectionMode === 'keyword' && keywordFilter.trim() ? keywordFilter.trim() : '';
        if (selectionMode === 'keyword' && currentKeyword) {
          const keywordParts = currentKeyword.toLowerCase().split(/\s+/).filter(k => k.length > 0);
          return allVariables
            .filter(variable => {
              const hay = variableKeywordHaystack(variable);
              return keywordParts.every(keyword => hay.includes(keyword));
            })
            .map(v => v.id);
        }
        if (selectionMode === 'any') {
          return allVariables.map(v => v.id);
        }
        return Object.entries(selectedVariables)
          .filter(([_, data]) => data.isSelected)
          .map(([id]) => id);
      };

      if (isDraftMode) {
        const variablesToRelate = resolveVariablesToRelate();
        const variables = allVariables.filter(v => variablesToRelate.includes(v.id));
        onDraftSave?.({
          variables,
          selectionMode,
          keyword: keywordFilter.trim(),
        });
        if (onSave) {
          await onSave();
        }
        onClose();
        return;
      }

      if (isBulkMode) {
        const variablesToRelate = resolveVariablesToRelate();
        const targetSet = new Set(variablesToRelate);

        for (const list of sourceLists) {
          let existingRelationships: any[] = [];
          try {
            const existing = await apiService.getListVariableRelationships(list.id) as any;
            existingRelationships = existing.variables || [];
          } catch (error) {
            console.error(`Failed to load relationships for list ${list.id}:`, error);
          }
          const existingVariableIdSet = new Set(
            existingRelationships.map((rel: any) => rel.id || rel.variableId),
          );

          for (const existingRel of existingRelationships) {
            const variableId = existingRel.id || existingRel.variableId;
            if (!targetSet.has(variableId)) {
              try {
                await apiService.deleteVariableListRelationship(variableId, list.id);
              } catch (error) {
                console.error(`Failed to delete relationship:`, error);
              }
            }
          }

          for (const variableId of variablesToRelate) {
            if (!existingVariableIdSet.has(variableId)) {
              try {
                await apiService.createVariableListRelationship(variableId, list.id);
              } catch (error: any) {
                const msg = error?.message || String(error);
                if (!msg.includes('already exists') && !msg.includes('Duplicate')) {
                  console.error(`Failed to create relationship:`, error);
                  throw error;
                }
              }
            }
          }
        }

        if (onSave) {
          await onSave();
        }
        alert(`Applicability updated for ${sourceLists.length} list(s).`);
        onClose();
        return;
      }

      // SINGLE MODE: Handle mode switching and keyword changes
      const currentList = sourceLists[0];
      
      // Get current relationships
      let existingRelationships: any[] = [];
      try {
        const existing = await apiService.getListVariableRelationships(currentList.id) as any;
        existingRelationships = existing.variables || [];
      } catch (error) {
        console.error('Failed to load existing relationships:', error);
      }

      const currentKeyword =
        selectionMode === 'keyword' && keywordFilter.trim() ? keywordFilter.trim() : '';
      const variablesToRelate = resolveVariablesToRelate();

      // Get all existing variable IDs
      const existingVariableIdSet = new Set(
        existingRelationships.map((rel: any) => rel.id || rel.variableId)
      );
      const variablesToRelateSet = new Set(variablesToRelate);

      // Delete relationships for variables that should no longer be related
      // This includes:
      // 1. Variables that matched old keyword (if keyword changed or removed)
      // 2. Variables that were manually selected but are not in the new keyword match (if keyword mode)
      // 3. Variables that are not in the new selection set
      for (const existingRel of existingRelationships) {
        const variableId = existingRel.id || existingRel.variableId;
        if (!variablesToRelateSet.has(variableId)) {
          try {
            await apiService.deleteVariableListRelationship(variableId, currentList.id);
          } catch (error) {
            console.error(`Failed to delete relationship:`, error);
          }
        }
      }

      // Create relationships ONLY for variables that match the keyword (if keyword mode)
      // or for selected variables (if manual/any mode)
      for (const variableId of variablesToRelate) {
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

      // Update saved keyword
      const savedKeywordKey = getSavedKeywordStorageKey();
      const storageKey = getKeywordStorageKey();
      if (currentKeyword && currentKeyword.trim()) {
        // Save the current keyword
        setSavedKeyword(currentKeyword);
        if (savedKeywordKey) {
          localStorage.setItem(savedKeywordKey, currentKeyword);
        }
        if (storageKey) {
          localStorage.setItem(storageKey, currentKeyword);
        }
      } else {
        // Clear saved keyword if keyword is removed
        setSavedKeyword('');
        if (savedKeywordKey) {
          localStorage.removeItem(savedKeywordKey);
        }
        if (storageKey) {
          localStorage.removeItem(storageKey);
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

  // Prepare data for the grid - deduplicate by ID
  // Must be before early return to follow Rules of Hooks
  const gridData = useMemo(() => {
    const seenIds = new Set<string>();
    return allVariables
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
  }, [allVariables, selectedVariables]);

  // Custom columns for the variable-list relationship modal
  // Show sector, domain, country, part, section, group, and variable columns
  // Part, section, group are needed for DSO but may be hidden in display
  // Increase variable column width to prevent truncation
  // Must be before early return to follow Rules of Hooks
  const relationshipColumns = useMemo(() => {
    return variableColumns
      .filter(col => 
        ['sector', 'domain', 'country', 'part', 'section', 'group', 'variable'].includes(col.key)
      )
      .map(col => {
        if (col.key === 'variable') {
          return { ...col, width: '400px' }; // Increased from 200px to 400px
        }
        return col;
      });
  }, []);
  
  // Filter data based on keyword - ONLY match in variable name
  // Must be before early return to follow Rules of Hooks
  const filteredGridData = useMemo(() => {
    if (selectionMode === 'keyword' && keywordFilter.trim()) {
      const keywordParts = keywordFilter.trim().toLowerCase().split(/\s+/).filter(k => k.length > 0);
      return gridData.filter(variable => {
        const haystack = variableKeywordHaystack(variable);
        return keywordParts.every(keyword => haystack.includes(keyword));
      });
    }
    return gridData;
  }, [gridData, selectionMode, keywordFilter]);

  if (!isOpen || sourceLists.length === 0) return null;

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
            <button
              onClick={() => setIsCustomSortOpen(true)}
              className="px-3 py-1.5 text-sm border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors flex items-center gap-2"
              title="Custom Sort"
            >
              <ArrowUpAZ className="w-4 h-4" />
              Custom Sort
            </button>
          </div>
          <button
            onClick={handleClose}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content: keep layout stable — overlay while relationships load instead of swapping the whole pane */}
        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          {allVariables.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[200px]">
              <div className="text-ag-dark-text-secondary">Loading variables data...</div>
            </div>
          ) : (
            <div className="relative h-full min-h-[280px]">
              <div
                className={`h-full bg-ag-dark-bg rounded-lg border border-ag-dark-border overflow-y-auto transition-opacity duration-150 ${
                  loading ? 'opacity-45 pointer-events-none' : 'opacity-100'
                }`}
              >
                {/* Selection Mode Controls - Positioned above Variables column */}
                <div className="mb-4 p-4 bg-ag-dark-bg rounded-lg border border-ag-dark-border flex justify-end">
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
                            title="Enter keywords to filter and auto-select matching variables (case-insensitive, preserves spacing)"
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
                        {filteredGridData.length} variable(s) match "{keywordFilter}"
                      </div>
                    )}
                  </div>
                </div>
                
                <DataGrid
                columns={relationshipColumns}
                data={filteredGridData}
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
                relationshipData={selectedVariables}
                onRelationshipRowClick={handleRowClick}
                selectionMode="row"
                isPredefinedSortEnabled={isApplicabilityOrderEnabled}
                predefinedSortOrder={variablesOrderSortOrder}
                gridType="variables"
                persistState={false}
              />
              </div>
              {loading && (
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-lg bg-ag-dark-surface/55 pointer-events-none z-10"
                  aria-busy="true"
                  aria-live="polite"
                >
                  <div className="flex items-center gap-2 px-4 py-2 rounded-md bg-ag-dark-bg/90 border border-ag-dark-border text-sm text-ag-dark-text shadow-lg">
                    <Loader2 className="w-4 h-4 animate-spin text-ag-dark-accent shrink-0" />
                    <span>Loading relationships…</span>
                  </div>
                </div>
              )}
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
      <VariablesCustomSortModal
        isOpen={isCustomSortOpen}
        onClose={() => setIsCustomSortOpen(false)}
        onApplySort={(sortRules, isDefaultOrderEnabled = false) => {
          setCustomSortRules(sortRules);
          setIsApplicabilityOrderEnabled(isDefaultOrderEnabled);
        }}
        columns={relationshipColumns}
        currentSortRules={customSortRules}
        isDefaultOrderEnabled={isApplicabilityOrderEnabled}
        onDefaultOrderToggle={(enabled) => {
          setIsApplicabilityOrderEnabled(enabled);
        }}
      />
    </div>
  );
};

