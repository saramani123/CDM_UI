import React, { useState } from 'react';
import { X, Save } from 'lucide-react';

interface AddSectionValueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (part: string, sectionValue: string) => Promise<void>;
  availableParts: string[];
  defaultPart?: string; // Optional: Part value to pre-fill
}

export const AddSectionValueModal: React.FC<AddSectionValueModalProps> = ({
  isOpen,
  onClose,
  onSave,
  availableParts,
  defaultPart = ''
}) => {
  const [selectedPart, setSelectedPart] = useState('');
  const [sectionValue, setSectionValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update selectedPart when defaultPart changes or modal opens
  React.useEffect(() => {
    if (isOpen && defaultPart) {
      setSelectedPart(defaultPart);
    } else if (isOpen && !defaultPart) {
      setSelectedPart('');
    }
  }, [isOpen, defaultPart]);

  // Reset form when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedPart('');
      setSectionValue('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!selectedPart.trim()) {
      setError('Please select a Part');
      return;
    }
    if (!sectionValue.trim()) {
      setError('Please enter a Section value');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(selectedPart.trim(), sectionValue.trim());
      setSelectedPart('');
      setSectionValue('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add section value');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSaving && selectedPart && sectionValue.trim()) {
      handleSave();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-ag-dark-surface border border-ag-dark-border rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ag-dark-text">
            Add Section Value
          </h3>
          <button
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
              Part <span className="text-ag-dark-error">*</span>
            </label>
            <select
              value={selectedPart}
              onChange={(e) => {
                setSelectedPart(e.target.value);
                setError(null);
              }}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
              disabled={isSaving}
            >
              <option value="">Select Part</option>
              {availableParts.map((part) => (
                <option key={part} value={part}>
                  {part}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              New Section Value <span className="text-ag-dark-error">*</span>
            </label>
            <input
              type="text"
              value={sectionValue}
              onChange={(e) => {
                setSectionValue(e.target.value);
                setError(null);
              }}
              onKeyPress={handleKeyPress}
              placeholder="Enter Section value..."
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
              disabled={isSaving}
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-400">{error}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !selectedPart.trim() || !sectionValue.trim()}
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
