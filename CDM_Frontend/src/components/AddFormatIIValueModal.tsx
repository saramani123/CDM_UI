import React, { useEffect, useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';

interface AddFormatIIValueModalProps {
  isOpen: boolean;
  onClose: () => void;
  formatIOptions: string[];
  defaultFormatI?: string;
  onSave: (formatI: string, formatII: string) => Promise<void>;
}

export const AddFormatIIValueModal: React.FC<AddFormatIIValueModalProps> = ({
  isOpen,
  onClose,
  formatIOptions,
  defaultFormatI = '',
  onSave,
}) => {
  const [selectedFormatI, setSelectedFormatI] = useState(defaultFormatI);
  const [formatIIValue, setFormatIIValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedFormatIOptions = useMemo(
    () => [...new Set((formatIOptions || []).filter(Boolean))].sort(),
    [formatIOptions],
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedFormatI(defaultFormatI || '');
      setFormatIIValue('');
      setError(null);
    }
  }, [isOpen, defaultFormatI]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const formatI = selectedFormatI.trim();
    const formatII = formatIIValue.trim();
    if (!formatI) {
      setError('Please select a Format I value');
      return;
    }
    if (!formatII) {
      setError('Please enter a Format II value');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(formatI, formatII);
      setFormatIIValue('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add Format II value');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-ag-dark-surface border border-ag-dark-border rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ag-dark-text">Add Format II</h3>
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
            <label className="block text-sm font-medium text-ag-dark-text mb-2">Format I</label>
            <select
              value={selectedFormatI}
              onChange={(e) => {
                setSelectedFormatI(e.target.value);
                setError(null);
              }}
              disabled={isSaving}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")",
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px',
              }}
            >
              <option value="">Select Format I</option>
              {normalizedFormatIOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">New Format II Value</label>
            <input
              type="text"
              value={formatIIValue}
              onChange={(e) => {
                setFormatIIValue(e.target.value);
                setError(null);
              }}
              disabled={isSaving}
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
              placeholder="Enter Format II value..."
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
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
            disabled={isSaving || !selectedFormatI.trim() || !formatIIValue.trim()}
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
