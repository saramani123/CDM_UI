import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, RotateCcw, Check } from 'lucide-react';

interface SortRule {
  id: string;
  column: string;
  sortOn: string;
  order: 'asc' | 'desc';
}

interface RelationshipCustomSortModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySort: (sortRules: SortRule[], isDefaultOrderEnabled?: boolean) => void;
  currentSortRules?: SortRule[];
  isDefaultOrderEnabled?: boolean;
  onDefaultOrderToggle?: (enabled: boolean) => void;
}

export const RelationshipCustomSortModal: React.FC<RelationshipCustomSortModalProps> = ({
  isOpen,
  onClose,
  onApplySort,
  currentSortRules = [],
  isDefaultOrderEnabled = false,
  onDefaultOrderToggle
}) => {
  const [sortRules, setSortRules] = useState<SortRule[]>(
    currentSortRules.length > 0 ? currentSortRules : [
      { id: '1', column: '', sortOn: 'cellValues', order: 'asc' }
    ]
  );
  const [defaultOrderEnabled, setDefaultOrderEnabled] = useState(isDefaultOrderEnabled);

  // Sync defaultOrderEnabled with prop when it changes
  useEffect(() => {
    setDefaultOrderEnabled(isDefaultOrderEnabled);
  }, [isDefaultOrderEnabled]);

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
    onApplySort(validRules, defaultOrderEnabled);
    onClose();
  };

  const handleDefaultOrderToggle = (enabled: boolean) => {
    setDefaultOrderEnabled(enabled);
    if (onDefaultOrderToggle) {
      onDefaultOrderToggle(enabled);
    }
    // When enabling default order, remove any rules that use Being, Avatar, or Object
    if (enabled) {
      setSortRules(prev => prev.filter(rule => 
        !rule.column || !['being', 'avatar', 'object'].includes(rule.column)
      ));
    }
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

  // Available columns: Being, Avatar, Object
  // When default order is enabled: only Sector, Domain, Country
  // When default order is disabled: Sector, Domain, Country, Being, Avatar, Object
  const availableColumns = defaultOrderEnabled
    ? [
        { key: 'sector', title: 'Sector' },
        { key: 'domain', title: 'Domain' },
        { key: 'country', title: 'Country' }
      ]
    : [
        { key: 'sector', title: 'Sector' },
        { key: 'domain', title: 'Domain' },
        { key: 'country', title: 'Country' },
        { key: 'being', title: 'Being' },
        { key: 'avatar', title: 'Avatar' },
        { key: 'object', title: 'Object' }
      ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
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

        {/* Enable Default Order Toggle */}
        <div className="mb-6 p-4 bg-ag-dark-bg rounded-lg border border-ag-dark-border">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={defaultOrderEnabled}
              onChange={(e) => handleDefaultOrderToggle(e.target.checked)}
              className="w-5 h-5 text-ag-dark-accent bg-ag-dark-surface border-ag-dark-border rounded focus:ring-ag-dark-accent"
            />
            <span className="text-sm font-medium text-ag-dark-text">Enable default order</span>
          </label>
          {defaultOrderEnabled && (
            <p className="text-xs text-ag-dark-text-secondary mt-2 ml-8">
              When enabled, sorting will be: Sector, Domain, Country (custom sort), then Being, Avatar, Object (default order).
              Being, Avatar, and Object columns are not available in custom sort when default order is enabled.
            </p>
          )}
        </div>

        {/* Instructions */}
        <div className="mb-6 p-4 bg-ag-dark-bg rounded-lg border border-ag-dark-border">
          <p className="text-sm text-ag-dark-text-secondary">
            Define multi-column sorting rules. The first rule will be the primary sort, 
            the second will be the secondary sort, and so on.
            {defaultOrderEnabled 
              ? ' Available columns: Sector, Domain, Country. Default order (Being, Avatar, Object) will be applied after custom sort.'
              : ' Available columns: Sector, Domain, Country, Being, Avatar, Object.'
            }
          </p>
        </div>

        {/* Sort Rules */}
        <div className="space-y-4 mb-6">
          {sortRules.map((rule, index) => (
            <div key={rule.id} className="flex items-center gap-3 p-4 bg-ag-dark-bg rounded-lg border border-ag-dark-border">
              <div className="text-sm text-ag-dark-text-secondary font-medium w-8">
                {index === 0 ? 'Then' : index === 1 ? 'Then' : `${index + 1}.`}
              </div>

              {/* Column Select */}
              <div className="flex-1">
                <label className="block text-xs text-ag-dark-text-secondary mb-1">Column</label>
                <select
                  value={rule.column}
                  onChange={(e) => updateSortRule(rule.id, 'column', e.target.value)}
                  className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                >
                  <option value="">Select column</option>
                  {availableColumns.map(col => (
                    <option key={col.key} value={col.key}>{col.title}</option>
                  ))}
                </select>
              </div>

              {/* Sort On Select */}
              <div className="flex-1">
                <label className="block text-xs text-ag-dark-text-secondary mb-1">Sort on</label>
                <select
                  value={rule.sortOn}
                  onChange={(e) => updateSortRule(rule.id, 'sortOn', e.target.value)}
                  className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                >
                  <option value="cellValues">Cell values</option>
                </select>
              </div>

              {/* Order Select */}
              <div className="flex-1">
                <label className="block text-xs text-ag-dark-text-secondary mb-1">Order</label>
                <select
                  value={rule.order}
                  onChange={(e) => updateSortRule(rule.id, 'order', e.target.value as 'asc' | 'desc')}
                  className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                >
                  <option value="asc">A → Z</option>
                  <option value="desc">Z → A</option>
                </select>
              </div>

              {/* Remove Button */}
              {sortRules.length > 1 && (
                <button
                  onClick={() => removeSortRule(rule.id)}
                  className="p-2 text-red-400 hover:text-red-300 transition-colors"
                  title="Remove sort rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={addSortRule}
              className="px-3 py-2 text-sm border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Level
            </button>
            <button
              onClick={clearAllRules}
              className="px-3 py-2 text-sm border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Clear All
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplySort}
              className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors flex items-center gap-2"
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

