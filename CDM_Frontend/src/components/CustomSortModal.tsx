import React, { useState } from 'react';
import { X, Plus, Trash2, RotateCcw, Check } from 'lucide-react';

interface SortRule {
  id: string;
  column: string;
  sortOn: string;
  order: 'asc' | 'desc';
}

interface CustomSortModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySort: (sortRules: SortRule[]) => void;
  columns: Array<{ key: string; title: string; sortable?: boolean }>;
  currentSortRules?: SortRule[];
}

export const CustomSortModal: React.FC<CustomSortModalProps> = ({
  isOpen,
  onClose,
  onApplySort,
  columns,
  currentSortRules = []
}) => {
  const [sortRules, setSortRules] = useState<SortRule[]>(
    currentSortRules.length > 0 ? currentSortRules : [
      { id: '1', column: '', sortOn: 'cellValues', order: 'asc' }
    ]
  );

  const addSortRule = () => {
    const newId = (sortRules.length + 1).toString();
    setSortRules(prev => [
      ...prev,
      { id: newId, column: '', sortOn: 'cellValues', order: 'asc' }
    ]);
  };

  const removeSortRule = (id: string) => {
    if (sortRules.length > 1) {
      setSortRules(prev => prev.filter(rule => rule.id !== id));
    }
  };

  const updateSortRule = (id: string, field: keyof SortRule, value: string) => {
    setSortRules(prev => prev.map(rule => 
      rule.id === id ? { ...rule, [field]: value } : rule
    ));
  };

  const clearAllRules = () => {
    setSortRules([{ id: '1', column: '', sortOn: 'cellValues', order: 'asc' }]);
  };

  const handleApplySort = () => {
    // Filter out rules with no column selected
    const validRules = sortRules.filter(rule => rule.column);
    onApplySort(validRules);
    onClose();
  };

  const handleCancel = () => {
    // Reset to current rules if they exist, otherwise reset to default
    if (currentSortRules.length > 0) {
      setSortRules(currentSortRules);
    } else {
      setSortRules([{ id: '1', column: '', sortOn: 'cellValues', order: 'asc' }]);
    }
    onClose();
  };

  // Get available columns (Being, Avatar, Object, Sector, Domain, Country for custom sort)
  const availableColumns = columns.filter(col => 
    col.sortable && ['being', 'avatar', 'object', 'sector', 'domain', 'country'].includes(col.key)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-ag-dark-text">Custom Sort</h3>
          <button
            onClick={handleCancel}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions */}
        <div className="mb-6 p-4 bg-ag-dark-bg rounded-lg border border-ag-dark-border">
          <p className="text-sm text-ag-dark-text-secondary">
            Define multi-column sorting rules. The first rule will be the primary sort, 
            the second will be the secondary sort, and so on.
          </p>
        </div>

        {/* Sort Rules */}
        <div className="space-y-4 mb-6">
          {sortRules.map((rule, index) => (
            <div key={rule.id} className="flex items-center gap-4 p-4 bg-ag-dark-bg rounded-lg border border-ag-dark-border">
              <div className="flex-shrink-0 w-8 h-8 bg-ag-dark-accent text-white rounded-full flex items-center justify-center text-sm font-medium">
                {index + 1}
              </div>
              
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Column Selection */}
                <div>
                  <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                    Column
                  </label>
                  <select
                    value={rule.column}
                    onChange={(e) => updateSortRule(rule.id, 'column', e.target.value)}
                    className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                      backgroundPosition: 'right 8px center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '16px',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none'
                    }}
                  >
                    <option value="">Select column...</option>
                    {availableColumns.map(col => (
                      <option key={col.key} value={col.key}>
                        {col.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort On Selection */}
                <div>
                  <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                    Sort On
                  </label>
                  <select
                    value={rule.sortOn}
                    onChange={(e) => updateSortRule(rule.id, 'sortOn', e.target.value)}
                    className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                      backgroundPosition: 'right 8px center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '16px',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none'
                    }}
                  >
                    <option value="cellValues">Cell Values</option>
                  </select>
                </div>

                {/* Order Selection */}
                <div>
                  <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                    Order
                  </label>
                  <select
                    value={rule.order}
                    onChange={(e) => updateSortRule(rule.id, 'order', e.target.value as 'asc' | 'desc')}
                    className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                      backgroundPosition: 'right 8px center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '16px',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none'
                    }}
                  >
                    <option value="asc">A→Z</option>
                    <option value="desc">Z→A</option>
                  </select>
                </div>
              </div>

              {/* Delete Button */}
              {sortRules.length > 1 && (
                <button
                  onClick={() => removeSortRule(rule.id)}
                  className="flex-shrink-0 text-ag-dark-error hover:text-red-400 transition-colors p-2"
                  title="Delete Level"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={addSortRule}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-ag-dark-text border border-ag-dark-border rounded hover:bg-ag-dark-bg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Level
            </button>
            
            <button
              onClick={clearAllRules}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-ag-dark-text border border-ag-dark-border rounded hover:bg-ag-dark-bg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Clear All
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-ag-dark-text border border-ag-dark-border rounded hover:bg-ag-dark-bg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplySort}
              className="inline-flex items-center gap-2 px-4 py-2 bg-ag-dark-accent text-white rounded text-sm font-medium hover:bg-ag-dark-accent-hover transition-colors"
            >
              <Check className="w-4 h-4" />
              Apply Sort
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
