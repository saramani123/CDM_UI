import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface DriverDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  driverName: string;
  driverType: string;
}

export const DriverDeleteModal: React.FC<DriverDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  driverName,
  driverType
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
          <h3 className="text-lg font-semibold text-ag-dark-text">Delete Driver</h3>
        </div>
        
        <p className="text-ag-dark-text-secondary mb-6">
          Deleting this driver will remove its connections and may leave certain Objects or Variables untagged.
          You will need to reassign new values from the Objects or Variables tabs.
        </p>
        
        <div className="bg-ag-dark-bg rounded border border-ag-dark-border p-3 mb-6">
          <p className="text-sm text-ag-dark-text">
            <span className="font-medium">{driverType}:</span> {driverName}
          </p>
        </div>
        
        <p className="text-sm text-red-400 mb-6">
          Are you sure you want to delete this driver?
        </p>
        
        <div className="flex gap-3 justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
};
