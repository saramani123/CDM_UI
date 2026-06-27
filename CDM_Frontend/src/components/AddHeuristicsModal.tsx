import React, { useState } from 'react';
import { X } from 'lucide-react';

interface AddHeuristicsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (heuristics: {
    agent: string;
    procedure: string;
    is_heuro: boolean;
  }) => Promise<void>;
}

export const AddHeuristicsModal: React.FC<AddHeuristicsModalProps> = ({
  isOpen,
  onClose,
  onAdd
}) => {
  const [formData, setFormData] = useState({
    agent: '',
    procedure: '',
    is_heuro: false  // Default FALSE = non-HEURO (documentation-only)
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChange = (field: 'agent' | 'procedure', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleToggleIsHero = () => {
    setFormData(prev => ({ ...prev, is_heuro: !prev.is_heuro }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.agent.trim() || !formData.procedure.trim()) {
      setError('All fields are required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onAdd({
        agent: formData.agent.trim(),
        procedure: formData.procedure.trim(),
        is_heuro: formData.is_heuro
      });
      
      // Reset form and close
      setFormData({ agent: '', procedure: '', is_heuro: false });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add heuristic item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({ agent: '', procedure: '', is_heuro: false });
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-ag-dark-text">Add Heuristic</h3>
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
          {/* Agent Field - plain text; agent names are unique, type directly */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Agent <span className="text-ag-dark-error">*</span>
            </label>
            <input
              type="text"
              value={formData.agent}
              onChange={(e) => handleChange('agent', e.target.value)}
              placeholder="Enter agent name"
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
              required
            />
          </div>

          {/* Procedure Field */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Procedure <span className="text-ag-dark-error">*</span>
            </label>
            <input
              type="text"
              value={formData.procedure}
              onChange={(e) => handleChange('procedure', e.target.value)}
              placeholder="Enter procedure name"
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
              required
            />
          </div>

          {/* Is HEURO Field - Toggle */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Is HEURO <span className="text-ag-dark-error">*</span>
            </label>
            <div className="flex items-center">
              <button
                type="button"
                role="switch"
                aria-checked={formData.is_heuro}
                onClick={handleToggleIsHero}
                disabled={isSubmitting}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ag-dark-accent focus:ring-offset-2 focus:ring-offset-ag-dark-surface disabled:opacity-50 ${
                  formData.is_heuro ? 'bg-ag-dark-accent' : 'bg-ag-dark-border'
                }`}
              >
                <span
                  className={`pointer-events-none block h-5 w-5 shrink-0 rounded-full bg-white shadow ring-0 transition ${
                    formData.is_heuro ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
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
              disabled={isSubmitting || !formData.agent.trim() || !formData.procedure.trim()}
              className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isSubmitting ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

