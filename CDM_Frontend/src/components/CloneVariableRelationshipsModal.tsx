import React, { useState, useMemo } from 'react';
import { X, Copy } from 'lucide-react';
import { DataGrid } from './DataGrid';
import { variableColumns } from '../data/variablesData';
import { apiService } from '../services/api';
import type { VariableData } from '../data/variablesData';

interface CloneVariableRelationshipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetVariable?: VariableData; // Single target variable (for single mode)
  targetVariables?: VariableData[]; // Multiple target variables (for bulk mode)
  allVariables: VariableData[];
  onCloneSuccess?: () => void; // Callback to refresh relationships
}

export const CloneVariableRelationshipsModal: React.FC<CloneVariableRelationshipsModalProps> = ({
  isOpen,
  onClose,
  targetVariable,
  targetVariables = [],
  allVariables,
  onCloneSuccess
}) => {
  const [selectedSourceVariable, setSelectedSourceVariable] = useState<VariableData | null>(null);
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine if we're in bulk mode
  const isBulkMode = targetVariables.length > 0;
  const effectiveTargetVariables = isBulkMode ? targetVariables : (targetVariable ? [targetVariable] : []);

  // Filter out target variables from the list (can't clone from themselves).
  // With default relevance-to-all-objects, every variable has edges; list all other variables as sources.
  const targetIds = new Set(effectiveTargetVariables.map(v => v.id).filter(Boolean));
  const availableVariables = allVariables.filter(v => v.id && !targetIds.has(v.id));

  // Columns for the clone modal - only show Variable column
  const cloneColumns = variableColumns.filter(col => 
    ['variable'].includes(col.key)
  );

  // Prepare grid data
  const gridData = availableVariables.map(v => ({
    ...v,
    isSelected: selectedSourceVariable?.id === v.id
  }));

  // Create a relationshipData object to enable onRelationshipRowClick behavior
  // This gives us non-toggle single-select behavior
  const relationshipData = useMemo(() => {
    return availableVariables.reduce((acc, v) => {
      acc[v.id] = {
        isSelected: selectedSourceVariable?.id === v.id
      };
      return acc;
    }, {} as Record<string, { isSelected: boolean }>);
  }, [availableVariables, selectedSourceVariable]);

  const handleRowClick = (variableId: string) => {
    const clickedVariable = availableVariables.find(v => v.id === variableId);
    if (clickedVariable) {
      setSelectedSourceVariable(clickedVariable);
      setError(null);
    }
  };

  const handleClone = async () => {
    if (!selectedSourceVariable) {
      setError('Please select a variable to clone relationships from');
      return;
    }

    if (effectiveTargetVariables.length === 0) {
      setError('No target variables specified');
      return;
    }

    setCloning(true);
    setError(null);

    try {
      if (isBulkMode) {
        // Bulk clone: clone to multiple target variables
        const targetIds = effectiveTargetVariables.map(v => v.id);
        await apiService.bulkCloneVariableRelationships(selectedSourceVariable.id, targetIds);
      } else {
        // Single clone: clone to one target variable
        await apiService.cloneVariableRelationships(effectiveTargetVariables[0].id, selectedSourceVariable.id);
      }
      
      // Call success callback to refresh relationships
      if (onCloneSuccess) {
        onCloneSuccess();
      }
      
      // Close modal
      onClose();
      setSelectedSourceVariable(null);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to clone relationships';
      setError(errorMessage);
      console.error('Error cloning variable relationships:', err);
    } finally {
      setCloning(false);
    }
  };

  const handleClose = () => {
    setSelectedSourceVariable(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-ag-dark-surface border border-ag-dark-border rounded-lg shadow-xl w-full max-w-6xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ag-dark-border">
          <div className="flex items-center gap-3">
            <Copy className="w-5 h-5 text-ag-dark-accent" />
            <h2 className="text-xl font-semibold text-ag-dark-text">
              Clone Relevance
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
              {isBulkMode ? 'Target Variables:' : 'Target Variable:'}
            </span>{' '}
            <span className="text-ag-dark-text">
              {isBulkMode ? (
                <span>
                  {effectiveTargetVariables.length} variable{effectiveTargetVariables.length !== 1 ? 's' : ''} selected
                  {effectiveTargetVariables.length <= 5 && (
                    <span className="ml-2">
                      ({effectiveTargetVariables.map(v => v.variable).join(', ')})
                    </span>
                  )}
                </span>
              ) : (
                effectiveTargetVariables[0]?.variable || 'N/A'
              )}
            </span>
          </div>
          <div className="text-sm text-ag-dark-text-secondary mt-1">
            {
              "Select a variable below. Each target variable's relevance to objects will be updated to match the source (only the edges that differ are removed or added)."
            }
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
          {availableVariables.length === 0 ? (
            <div className="rounded-lg border border-ag-dark-border bg-ag-dark-bg p-6 text-sm text-ag-dark-text-secondary">
              No other variables are available to use as a source (every variable in the dataset may be in your
              current selection). Deselect some variables or pick a smaller set of targets.
            </div>
          ) : (
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
              gridType="variables"
              persistState={false}
            />
          </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-ag-dark-border">
          <div className="text-sm text-ag-dark-text-secondary">
            {selectedSourceVariable ? (
              <span>
                Selected: <span className="text-ag-dark-text font-medium">
                  {selectedSourceVariable.variable} ({selectedSourceVariable.objectRelationships ?? 0} objects)
                </span>
              </span>
            ) : (
              <span>No variable selected</span>
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
              disabled={!selectedSourceVariable || cloning}
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

