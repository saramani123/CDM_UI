import React, { useState, useMemo } from 'react';
import { X, Copy } from 'lucide-react';
import { DataGrid } from './DataGrid';
import { objectColumns } from '../data/mockData';
import { apiService } from '../services/api';
import type { ObjectData } from '../data/mockData';

interface CloneIdentifiersModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetObject?: ObjectData; // Single target object (for single mode)
  targetObjects?: ObjectData[]; // Multiple target objects (for bulk mode)
  allObjects: ObjectData[];
  onCloneSuccess?: () => void; // Callback to refresh identifiers
}

export const CloneIdentifiersModal: React.FC<CloneIdentifiersModalProps> = ({
  isOpen,
  onClose,
  targetObject,
  targetObjects = [],
  allObjects,
  onCloneSuccess
}) => {
  const [selectedSourceObject, setSelectedSourceObject] = useState<ObjectData | null>(null);
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine if we're in bulk mode
  const isBulkMode = targetObjects.length > 0;
  const effectiveTargetObjects = isBulkMode ? targetObjects : (targetObject ? [targetObject] : []);

  // Filter out target objects from the list (can't clone from themselves)
  const targetIds = new Set(effectiveTargetObjects.map(obj => obj.id));
  const availableObjects = allObjects.filter(obj => !targetIds.has(obj.id));

  // Columns for the clone modal - only show S, D, C, Being, Avatar, Object
  const cloneColumns = objectColumns.filter(col => 
    ['sector', 'domain', 'country', 'being', 'avatar', 'object'].includes(col.key)
  );

  // Prepare grid data
  const gridData = availableObjects.map(obj => ({
    ...obj,
    isSelected: selectedSourceObject?.id === obj.id
  }));

  // Create a relationshipData object to enable onRelationshipRowClick behavior
  // This gives us non-toggle single-select behavior
  const relationshipData = useMemo(() => {
    return availableObjects.reduce((acc, obj) => {
      acc[obj.id] = {
        isSelected: selectedSourceObject?.id === obj.id
      };
      return acc;
    }, {} as Record<string, { isSelected: boolean }>);
  }, [availableObjects, selectedSourceObject]);

  const handleRowClick = (objectId: string) => {
    const clickedObject = availableObjects.find(obj => obj.id === objectId);
    if (clickedObject) {
      setSelectedSourceObject(clickedObject);
      setError(null);
    }
  };

  const handleClone = async () => {
    if (!selectedSourceObject) {
      setError('Please select an object to clone identifiers from');
      return;
    }

    if (effectiveTargetObjects.length === 0) {
      setError('No target objects specified');
      return;
    }

    setCloning(true);
    setError(null);

    try {
      if (isBulkMode) {
        // Bulk clone: clone to multiple target objects
        const targetIds = effectiveTargetObjects.map(obj => obj.id);
        await apiService.bulkCloneIdentifiers(selectedSourceObject.id, targetIds);
      } else {
        // Single clone: clone to one target object
        await apiService.cloneIdentifiers(effectiveTargetObjects[0].id, selectedSourceObject.id);
      }
      
      // Call success callback to refresh identifiers
      if (onCloneSuccess) {
        onCloneSuccess();
      }
      
      // Close modal
      onClose();
      setSelectedSourceObject(null);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to clone identifiers';
      setError(errorMessage);
      console.error('Error cloning identifiers:', err);
    } finally {
      setCloning(false);
    }
  };

  const handleClose = () => {
    setSelectedSourceObject(null);
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
              Clone Identifiers
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
              {isBulkMode ? 'Target Objects:' : 'Target Object:'}
            </span>{' '}
            <span className="text-ag-dark-text">
              {isBulkMode ? (
                <span>
                  {effectiveTargetObjects.length} object{effectiveTargetObjects.length !== 1 ? 's' : ''} selected
                  {effectiveTargetObjects.length <= 5 && (
                    <span className="ml-2">
                      ({effectiveTargetObjects.map(obj => `${obj.being} - ${obj.avatar} - ${obj.object}`).join(', ')})
                    </span>
                  )}
                </span>
              ) : (
                `${effectiveTargetObjects[0]?.being} - ${effectiveTargetObjects[0]?.avatar} - ${effectiveTargetObjects[0]?.object}`
              )}
            </span>
          </div>
          <div className="text-sm text-ag-dark-text-secondary mt-1">
            Select an object below to clone its identifiers (unique IDs and composite IDs) to the {isBulkMode ? 'selected objects' : 'target object'}.
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
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-ag-dark-border">
          <div className="text-sm text-ag-dark-text-secondary">
            {selectedSourceObject ? (
              <span>
                Selected: <span className="text-ag-dark-text font-medium">
                  {selectedSourceObject.being} - {selectedSourceObject.avatar} - {selectedSourceObject.object}
                </span>
              </span>
            ) : (
              <span>No object selected</span>
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
              disabled={!selectedSourceObject || cloning}
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

