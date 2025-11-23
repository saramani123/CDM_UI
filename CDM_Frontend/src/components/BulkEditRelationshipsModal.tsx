import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface BulkEditRelationshipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    relationshipType?: 'Inter-Table' | 'Blood' | 'Subtype';
    frequency: 'Critical' | 'Likely' | 'Possible';
    roles: string;
  }) => void;
  selectedCount: number;
  includeRelationshipType: boolean; // If false, hide relationship type (when source object is selected)
}

export const BulkEditRelationshipsModal: React.FC<BulkEditRelationshipsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedCount,
  includeRelationshipType
}) => {
  const [relationshipType, setRelationshipType] = useState<'Inter-Table' | 'Blood' | 'Subtype'>('Inter-Table');
  const [frequency, setFrequency] = useState<'Critical' | 'Likely' | 'Possible'>('Possible');
  const [roles, setRoles] = useState('');

  // When relationship type changes to Blood, automatically set frequency to Critical
  useEffect(() => {
    if (relationshipType === 'Blood') {
      setFrequency('Critical');
    }
  }, [relationshipType]);

  const handleSave = () => {
    onSave({
      ...(includeRelationshipType ? { relationshipType } : {}),
      frequency,
      roles: roles.trim()
    });
    // Reset form
    setRelationshipType('Inter-Table');
    setFrequency('Possible');
    setRoles('');
    onClose();
  };

  const handleClose = () => {
    // Reset form
    setRelationshipType('Inter-Table');
    setFrequency('Possible');
    setRoles('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[200]">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border w-[90vw] max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ag-dark-border">
          <h2 className="text-xl font-semibold text-ag-dark-text">
            Bulk Edit Relationships ({selectedCount} objects)
          </h2>
          <button
            onClick={handleClose}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {includeRelationshipType && (
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Relationship Type
              </label>
              <select
                value={relationshipType}
                onChange={(e) => setRelationshipType(e.target.value as 'Inter-Table' | 'Blood' | 'Subtype')}
                className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
              >
                <option value="Inter-Table">Inter-Table</option>
                <option value="Blood">Blood</option>
                <option value="Subtype">Subtype</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as 'Critical' | 'Likely' | 'Possible')}
              disabled={relationshipType === 'Blood'} // Disabled when Blood is selected
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="Critical">Critical</option>
              <option value="Likely">Likely</option>
              <option value="Possible">Possible</option>
            </select>
            {relationshipType === 'Blood' && (
              <p className="mt-1 text-xs text-ag-dark-text-secondary">
                Frequency is automatically set to Critical for Blood relationships
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Role Words (comma-separated)
            </label>
            <input
              type="text"
              value={roles}
              onChange={(e) => setRoles(e.target.value)}
              placeholder="Enter role words (comma-separated)"
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
            <p className="mt-1 text-xs text-ag-dark-text-secondary">
              These role words will replace existing role words for the selected objects. The default role word will not be affected.
            </p>
          </div>
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
            className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Apply to Selected
          </button>
        </div>
      </div>
    </div>
  );
};

