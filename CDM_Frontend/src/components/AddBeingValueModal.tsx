import React, { useState } from 'react';
import { X, Save } from 'lucide-react';

interface AddBeingValueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (value: string) => Promise<void>;
}

export const AddBeingValueModal: React.FC<AddBeingValueModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [value, setValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!value.trim()) {
      setError('Please enter a value');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(value.trim());
      setValue('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add being value');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSaving) {
      handleSave();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-ag-dark-surface border border-ag-dark-border rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ag-dark-text">
            Add Being Value
          </h3>
          <button
            onClick={onClose}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-ag-dark-text mb-2">
            New Value
          </label>
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyPress={handleKeyPress}
            placeholder="Enter Being value..."
            className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            disabled={isSaving}
            autoFocus
          />
          {error && (
            <p className="mt-2 text-sm text-red-400">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !value.trim()}
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

