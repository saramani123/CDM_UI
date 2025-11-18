import React, { useState, useMemo } from 'react';
import { X, Copy } from 'lucide-react';
import { DataGrid } from './DataGrid';
import { listColumns } from '../data/listsData';
import { apiService } from '../services/api';
import type { ListData } from '../data/listsData';

interface CloneListApplicabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetList?: ListData; // Single target list (for single mode)
  targetLists?: ListData[]; // Multiple target lists (for bulk mode)
  allLists: ListData[];
  onCloneSuccess?: () => void; // Callback to refresh relationships
}

export const CloneListApplicabilityModal: React.FC<CloneListApplicabilityModalProps> = ({
  isOpen,
  onClose,
  targetList,
  targetLists = [],
  allLists,
  onCloneSuccess
}) => {
  const [selectedSourceList, setSelectedSourceList] = useState<ListData | null>(null);
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine if we're in bulk mode
  const isBulkMode = targetLists.length > 0;
  const effectiveTargetLists = isBulkMode ? targetLists : (targetList ? [targetList] : []);

  // Filter out target lists from the list (can't clone from themselves)
  // Also filter to only show lists that have applicability (variables with HAS_LIST relationships)
  const targetIds = new Set(effectiveTargetLists.map(l => l.id));
  const availableLists = allLists.filter(l => 
    !targetIds.has(l.id) && (l.variables || 0) > 0
  );

  // Columns for the clone modal - only show S, D, C, Set, Grouping, List
  const cloneColumns = listColumns.filter(col => 
    ['sector', 'domain', 'country', 'set', 'grouping', 'list'].includes(col.key)
  );

  // Prepare grid data
  const gridData = availableLists.map(l => ({
    ...l,
    isSelected: selectedSourceList?.id === l.id
  }));

  // Create a relationshipData object to enable onRelationshipRowClick behavior
  // This gives us non-toggle single-select behavior
  const relationshipData = useMemo(() => {
    return availableLists.reduce((acc, l) => {
      acc[l.id] = {
        isSelected: selectedSourceList?.id === l.id
      };
      return acc;
    }, {} as Record<string, { isSelected: boolean }>);
  }, [availableLists, selectedSourceList]);

  const handleRowClick = (listId: string) => {
    const clickedList = availableLists.find(l => l.id === listId);
    if (clickedList) {
      setSelectedSourceList(clickedList);
      setError(null);
    }
  };

  const handleClone = async () => {
    if (!selectedSourceList) {
      setError('Please select a list to clone applicability from');
      return;
    }

    if (effectiveTargetLists.length === 0) {
      setError('No target lists specified');
      return;
    }

    // Check that source list has applicability
    if ((selectedSourceList.variables || 0) === 0) {
      setError('Selected list has no applicability to clone');
      return;
    }

    setCloning(true);
    setError(null);

    try {
      if (isBulkMode) {
        // Bulk clone: clone to multiple target lists
        const targetIds = effectiveTargetLists.map(l => l.id);
        await apiService.bulkCloneListApplicability(selectedSourceList.id, targetIds);
      } else {
        // Single clone: clone to one target list
        await apiService.cloneListApplicability(effectiveTargetLists[0].id, selectedSourceList.id);
      }
      
      // Copy keyword/ANY mode from source list to target list(s)
      const sourceKeywordKey = `list_keyword_filter_${selectedSourceList.id}`;
      const sourceSavedKeywordKey = `list_saved_keyword_${selectedSourceList.id}`;
      const sourceKeyword = localStorage.getItem(sourceKeywordKey);
      const sourceSavedKeyword = localStorage.getItem(sourceSavedKeywordKey);
      
      // Check if source list has "ANY" mode (no keyword but has relationships)
      // We'll check if there's a selection mode indicator, or infer from keyword presence
      const hasKeyword = sourceKeyword && sourceKeyword.trim();
      
      effectiveTargetLists.forEach(targetList => {
        const targetKeywordKey = `list_keyword_filter_${targetList.id}`;
        const targetSavedKeywordKey = `list_saved_keyword_${targetList.id}`;
        
        if (hasKeyword) {
          // Copy keyword mode
          if (sourceKeyword) {
            localStorage.setItem(targetKeywordKey, sourceKeyword);
          }
          if (sourceSavedKeyword) {
            localStorage.setItem(targetSavedKeywordKey, sourceSavedKeyword);
          }
        } else {
          // If no keyword, it might be "ANY" mode or manual selection
          // For "ANY" mode, we don't need to store anything special - the relationships are enough
          // But we should clear any existing keyword filters for the target
          localStorage.removeItem(targetKeywordKey);
          localStorage.removeItem(targetSavedKeywordKey);
        }
      });
      
      // Call success callback to refresh relationships
      if (onCloneSuccess) {
        onCloneSuccess();
      }
      
      // Close modal
      onClose();
      setSelectedSourceList(null);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to clone applicability';
      setError(errorMessage);
      console.error('Error cloning list applicability:', err);
    } finally {
      setCloning(false);
    }
  };

  const handleClose = () => {
    setSelectedSourceList(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-ag-dark-surface border border-ag-dark-border rounded-lg shadow-xl w-full max-w-6xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ag-dark-border">
          <div className="flex items-center gap-3">
            <Copy className="w-5 h-5 text-ag-dark-accent" />
            <h2 className="text-xl font-semibold text-ag-dark-text">
              Clone Applicability
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-ag-dark-text-secondary hover:text-ag-dark-text hover:bg-ag-dark-bg rounded transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Section */}
        <div className="p-4 bg-ag-dark-bg border-b border-ag-dark-border">
          <div className="text-sm text-ag-dark-text-secondary">
            <span className="font-medium">
              {isBulkMode ? 'Target Lists:' : 'Target List:'}
            </span>{' '}
            <span className="text-ag-dark-text">
              {isBulkMode ? (
                <span>
                  {effectiveTargetLists.length} list{effectiveTargetLists.length !== 1 ? 's' : ''} selected
                  {effectiveTargetLists.length <= 5 && (
                    <span className="ml-2">
                      ({effectiveTargetLists.map(l => l.list).join(', ')})
                    </span>
                  )}
                </span>
              ) : (
                effectiveTargetLists[0]?.list || 'N/A'
              )}
            </span>
          </div>
          <div className="text-sm text-ag-dark-text-secondary mt-1">
            Select a list below to clone its applicability to the {isBulkMode ? 'selected lists' : 'target list'}.
            Only lists with existing applicability are shown.
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="h-full bg-ag-dark-bg rounded-lg border border-ag-dark-border overflow-y-auto">
            <DataGrid
              columns={cloneColumns}
              data={gridData}
              onRowSelect={() => {}} // Not used when relationshipData is provided
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
              relationshipData={relationshipData}
              onRelationshipRowClick={handleRowClick}
              selectionMode="row"
              gridType="lists"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-ag-dark-border">
          <div className="text-sm text-ag-dark-text-secondary">
            {selectedSourceList ? (
              <span>
                Selected: <span className="text-ag-dark-text font-medium">
                  {selectedSourceList.list} ({selectedSourceList.variables || 0} variables)
                </span>
              </span>
            ) : (
              <span>No list selected</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleClone}
              disabled={!selectedSourceList || cloning}
              className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Copy className="w-4 h-4" />
              {cloning ? 'Cloning...' : 'Clone'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

