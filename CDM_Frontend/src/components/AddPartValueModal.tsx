import React, { useState } from 'react';
import { X, Save } from 'lucide-react';

interface AddPartValueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (partName: string) => Promise<void>;
}

export const AddPartValueModal: React.FC<AddPartValueModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [partValue, setPartValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setPartValue('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!partValue.trim()) {
      setError('Please enter a Part name');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave(partValue.trim());
      setPartValue('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add Part');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-ag-dark-surface border border-ag-dark-border rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ag-dark-text">Add Part</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Part name <span className="text-ag-dark-error">*</span>
            </label>
            <input
              type="text"
              value={partValue}
              onChange={(e) => {
                setPartValue(e.target.value);
                setError(null);
              }}
              placeholder="New Part name..."
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
              disabled={isSaving}
              autoFocus
            />
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !partValue.trim()}
            className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
