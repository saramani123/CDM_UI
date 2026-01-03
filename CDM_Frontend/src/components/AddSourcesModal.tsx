import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useDrivers } from '../hooks/useDrivers';

interface AddSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (sources: {
    sector: string;
    domain: string;
    country: string;
    system: string;
    sub_system: string;
    type: string;
    table: string;
    column: string;
    cdm_full_variable: string;
  }) => Promise<void>;
  existingTypes: string[];
  onAddType: (newType: string) => void;
}

const DEFAULT_TYPES = ['File', 'API', 'Database'];

export const AddSourcesModal: React.FC<AddSourcesModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  existingTypes,
  onAddType
}) => {
  const { drivers: driversData, loading: driversLoading } = useDrivers();
  const [formData, setFormData] = useState({
    sector: '',
    domain: '',
    country: '',
    system: '',
    sub_system: '',
    type: '',
    table: '',
    column: '',
    cdm_full_variable: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddTypeInput, setShowAddTypeInput] = useState(false);
  const [newTypeValue, setNewTypeValue] = useState('');
  const [localTypes, setLocalTypes] = useState<string[]>([]);

  // Get distinct values from drivers
  const sectors = driversData?.sectors || [];
  const domains = driversData?.domains || [];
  const countries = driversData?.countries || [];

  // Include "All" as first option, then distinct values from drivers (excluding "ALL" if it exists)
  const sectorOptions = ['All', ...sectors.filter(s => s !== 'ALL' && s !== 'All')];
  const domainOptions = ['All', ...domains.filter(d => d !== 'ALL' && d !== 'All')];
  const countryOptions = ['All', ...countries.filter(c => c !== 'ALL' && c !== 'All')];

  // Combine default types with existing types and locally added types
  const allTypes = [...new Set([...DEFAULT_TYPES, ...existingTypes, ...localTypes])].sort();

  if (!isOpen) return null;

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleAddNewType = () => {
    const trimmedValue = newTypeValue.trim();
    if (trimmedValue) {
      // Add to local types immediately so it appears in dropdown
      setLocalTypes(prev => {
        if (!prev.includes(trimmedValue) && !DEFAULT_TYPES.includes(trimmedValue) && !existingTypes.includes(trimmedValue)) {
          return [...prev, trimmedValue];
        }
        return prev;
      });
      // Also notify parent to persist it
      onAddType(trimmedValue);
      // Set the type in the form
      setFormData(prev => ({ ...prev, type: trimmedValue }));
      // Clear input and hide it
      setNewTypeValue('');
      setShowAddTypeInput(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.sector || !formData.domain || !formData.country || 
        !formData.system || !formData.sub_system || !formData.type || 
        !formData.table || !formData.column || !formData.cdm_full_variable.trim()) {
      setError('All fields are required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onAdd({
        sector: formData.sector,
        domain: formData.domain,
        country: formData.country,
        system: formData.system.trim(),
        sub_system: formData.sub_system.trim(),
        type: formData.type,
        table: formData.table.trim(),
        column: formData.column.trim(),
        cdm_full_variable: formData.cdm_full_variable.trim()
      });
      
      // Reset form and close
      setFormData({ 
        sector: '', 
        domain: '', 
        country: '', 
        system: '', 
        sub_system: '', 
        type: '', 
        table: '', 
        column: '', 
        cdm_full_variable: '' 
      });
      setLocalTypes([]); // Reset local types after successful add
      setShowAddTypeInput(false);
      setNewTypeValue('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({ 
        sector: '', 
        domain: '', 
        country: '', 
        system: '', 
        sub_system: '', 
        type: '', 
        table: '', 
        column: '', 
        cdm_full_variable: '' 
      });
      setError(null);
      setShowAddTypeInput(false);
      setNewTypeValue('');
      setLocalTypes([]); // Reset local types when closing
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50" data-modal="true">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-ag-dark-text">Add Source</h3>
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
          <div className="grid grid-cols-2 gap-4">
            {/* Sector Field */}
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Sector <span className="text-ag-dark-error">*</span>
              </label>
              <select
                value={formData.sector}
                onChange={(e) => handleChange('sector', e.target.value)}
                disabled={isSubmitting || driversLoading}
                className="w-full px-3 py-2 pr-8 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M6%209L1%204h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:12px_12px]"
                style={{ paddingRight: '2.5rem', backgroundPosition: 'right 0.85rem center' }}
                required
              >
                <option value="">Select Sector</option>
                {sectorOptions.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </div>

            {/* Domain Field */}
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Domain <span className="text-ag-dark-error">*</span>
              </label>
              <select
                value={formData.domain}
                onChange={(e) => handleChange('domain', e.target.value)}
                disabled={isSubmitting || driversLoading}
                className="w-full px-3 py-2 pr-8 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M6%209L1%204h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:12px_12px]"
                style={{ paddingRight: '2.5rem', backgroundPosition: 'right 0.85rem center' }}
                required
              >
                <option value="">Select Domain</option>
                {domainOptions.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
            </div>

            {/* Country Field */}
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Country <span className="text-ag-dark-error">*</span>
              </label>
              <select
                value={formData.country}
                onChange={(e) => handleChange('country', e.target.value)}
                disabled={isSubmitting || driversLoading}
                className="w-full px-3 py-2 pr-8 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M6%209L1%204h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:12px_12px]"
                style={{ paddingRight: '2.5rem', backgroundPosition: 'right 0.85rem center' }}
                required
              >
                <option value="">Select Country</option>
                {countryOptions.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </div>

            {/* System Field */}
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                System <span className="text-ag-dark-error">*</span>
              </label>
              <input
                type="text"
                value={formData.system}
                onChange={(e) => handleChange('system', e.target.value)}
                placeholder="Enter system name"
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                required
              />
            </div>

            {/* Sub-System Field */}
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Sub-System <span className="text-ag-dark-error">*</span>
              </label>
              <input
                type="text"
                value={formData.sub_system}
                onChange={(e) => handleChange('sub_system', e.target.value)}
                placeholder="Enter sub-system name"
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                required
              />
            </div>

            {/* Type Field */}
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Type <span className="text-ag-dark-error">*</span>
              </label>
              <div className="flex gap-2 items-center">
                <select
                  value={formData.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  disabled={isSubmitting}
                  className="flex-1 px-3 py-2 pr-8 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M6%209L1%204h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:12px_12px] bg-[right_0.75rem_center]"
                  style={{ paddingRight: '2.5rem' }}
                  required
                >
                  <option value="">Select Type</option>
                  {allTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddTypeInput(!showAddTypeInput)}
                  disabled={isSubmitting}
                  className="text-ag-dark-accent hover:text-ag-dark-accent-hover transition-colors disabled:opacity-50 flex items-center justify-center"
                  title="Add new type"
                  style={{ width: '24px', height: '24px' }}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              {showAddTypeInput && (
                <div className="mt-2 p-3 bg-ag-dark-bg border border-ag-dark-border rounded">
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={newTypeValue}
                      onChange={(e) => setNewTypeValue(e.target.value)}
                      placeholder="Enter new type"
                      className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNewType();
                        }
                      }}
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddTypeInput(false);
                          setNewTypeValue('');
                        }}
                        className="px-3 py-1.5 text-sm border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-surface transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddNewType}
                        className="px-3 py-1.5 text-sm bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Table Field */}
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Table <span className="text-ag-dark-error">*</span>
              </label>
              <input
                type="text"
                value={formData.table}
                onChange={(e) => handleChange('table', e.target.value)}
                placeholder="Enter table name"
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                required
              />
            </div>

            {/* Column Field */}
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Column <span className="text-ag-dark-error">*</span>
              </label>
              <input
                type="text"
                value={formData.column}
                onChange={(e) => handleChange('column', e.target.value)}
                placeholder="Enter column name"
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                required
              />
            </div>

            {/* CDM Full Variable Field */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                CDM Full Variable <span className="text-ag-dark-error">*</span>
              </label>
              <input
                type="text"
                value={formData.cdm_full_variable}
                onChange={(e) => handleChange('cdm_full_variable', e.target.value)}
                placeholder="Enter CDM full variable"
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                required
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-900 bg-opacity-20 border border-red-500 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 mt-6">
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
              disabled={isSubmitting || !formData.sector || !formData.domain || !formData.country || 
                       !formData.system || !formData.sub_system || !formData.type || 
                       !formData.table || !formData.column || !formData.cdm_full_variable.trim()}
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

