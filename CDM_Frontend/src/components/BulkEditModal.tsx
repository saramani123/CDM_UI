import React, { useState } from 'react';
import { X, Download, Upload, Edit } from 'lucide-react';

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onApplyToSelected?: (action: string, value?: any) => void;
  onApplyToAll?: (action: string, value?: any) => void;
  onCsvUpload?: (file: File) => void;
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  onApplyToSelected,
  onApplyToAll,
  onCsvUpload
}) => {
  const [selectedAction, setSelectedAction] = useState('');
  const [actionValue, setActionValue] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onCsvUpload) {
      onCsvUpload(file);
      onClose();
    }
  };

  const handleApplyToSelected = () => {
    if (selectedAction && onApplyToSelected) {
      onApplyToSelected(selectedAction, actionValue);
      onClose();
    }
  };

  const handleApplyToAll = () => {
    if (selectedAction && onApplyToAll) {
      onApplyToAll(selectedAction, actionValue);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ag-dark-border">
          <h2 className="text-xl font-semibold text-ag-dark-text">Bulk Operations</h2>
          <button
            onClick={onClose}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* CSV Upload */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-ag-dark-text">Upload Data</h3>
            <label className="flex items-center justify-center w-full px-4 py-6 border-2 border-ag-dark-border border-dashed rounded-lg cursor-pointer hover:bg-ag-dark-bg transition-colors">
              <div className="space-y-2 text-center">
                <Upload className="w-8 h-8 text-ag-dark-text-secondary mx-auto" />
                <div className="text-sm text-ag-dark-text-secondary">
                  <span className="font-medium text-ag-dark-accent hover:text-ag-dark-accent-hover">
                    Choose CSV file
                  </span>
                  <span> or drag and drop</span>
                </div>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".csv"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {/* Bulk Edit Actions */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-ag-dark-text">Bulk Edit</h3>
            
            <div className="space-y-3">
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
              >
                <option value="">Select Action</option>
                <option value="updateStatus">Update Status</option>
                <option value="updateType">Update Type</option>
                <option value="addTag">Add Tag</option>
                <option value="removeTag">Remove Tag</option>
                <option value="delete">Delete Rows</option>
              </select>

              {selectedAction && selectedAction !== 'delete' && (
                <input
                  type="text"
                  placeholder="Enter value..."
                  value={actionValue}
                  onChange={(e) => setActionValue(e.target.value)}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                />
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {selectedAction && (
            <div className="flex gap-3">
              <button
                onClick={handleApplyToSelected}
                disabled={selectedCount === 0}
                className="flex-1 bg-ag-dark-accent text-white py-2 px-4 rounded hover:bg-ag-dark-accent-hover disabled:bg-ag-dark-text-secondary disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Apply to Selected ({selectedCount})
              </button>
              <button
                onClick={handleApplyToAll}
                className="flex-1 bg-ag-dark-warning text-white py-2 px-4 rounded hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Apply to All
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-ag-dark-bg rounded-b-lg border-t border-ag-dark-border">
          <div className="flex items-center gap-2 text-sm text-ag-dark-text-secondary">
            <Download className="w-4 h-4" />
            <span>You can also export current data as CSV for offline editing</span>
          </div>
        </div>
      </div>
    </div>
  );
};