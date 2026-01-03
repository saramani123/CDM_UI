import React, { useState } from 'react';
import { X } from 'lucide-react';
import { MetadataData } from '../hooks/useMetadata';

interface AddMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (metadata: { layer: string; concept: string }) => Promise<void>;
}

export const AddMetadataModal: React.FC<AddMetadataModalProps> = ({
  isOpen,
  onClose,
  onAdd
}) => {
  const [formData, setFormData] = useState({
    layer: '',
    concept: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChange = (field: 'layer' | 'concept', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.layer.trim() || !formData.concept.trim()) {
      setError('Both Layer and Concept are required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onAdd({
        layer: formData.layer.trim(),
        concept: formData.concept.trim()
      });
      
      // Reset form and close
      setFormData({ layer: '', concept: '' });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add metadata item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({ layer: '', concept: '' });
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-ag-dark-text">Add Metadata</h3>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Layer Field */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Layer <span className="text-ag-dark-error">*</span>
            </label>
            <input
              type="text"
              value={formData.layer}
              onChange={(e) => handleChange('layer', e.target.value)}
              placeholder="Enter layer (e.g., Format, Ontology)"
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
              required
            />
          </div>

          {/* Concept Field */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Concept <span className="text-ag-dark-error">*</span>
            </label>
            <input
              type="text"
              value={formData.concept}
              onChange={(e) => handleChange('concept', e.target.value)}
              placeholder="Enter concept name"
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
              required
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900 bg-opacity-20 border border-red-500 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-surface transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.layer.trim() || !formData.concept.trim()}
              className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

