import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, RotateCcw, Check } from 'lucide-react';

interface SortRule {
  id: string;
  column: string;
  sortOn: string;
  order: 'asc' | 'desc';
}

interface VariablesCustomSortModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySort: (sortRules: SortRule[], isDefaultOrderEnabled: boolean) => void;
  columns: Array<{ key: string; title: string; sortable?: boolean }>;
  currentSortRules?: SortRule[];
  isDefaultOrderEnabled?: boolean;
  onDefaultOrderToggle?: (enabled: boolean) => void;
}

export const VariablesCustomSortModal: React.FC<VariablesCustomSortModalProps> = ({
  isOpen,
  onClose,
  onApplySort,
  columns,
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
  // Backup of sort rules before default order was enabled (to restore when disabled)
  const [sortRulesBackup, setSortRulesBackup] = useState<SortRule[] | null>(null);

  // Sync defaultOrderEnabled with prop when it changes
  useEffect(() => {
    setDefaultOrderEnabled(isDefaultOrderEnabled);
  }, [isDefaultOrderEnabled]);

  // Handle initial state: if modal opens with default order enabled, filter and backup rules
  useEffect(() => {
    if (isOpen && defaultOrderEnabled && sortRules.length > 0 && !sortRulesBackup) {
      // Check if we have rules that would be filtered out
      const hasConflictingRules = sortRules.some(rule => 
        rule.column && ['part', 'section', 'group', 'variable'].includes(rule.column)
      );
      if (hasConflictingRules) {
        setSortRulesBackup([...sortRules]);
        setSortRules(prev => prev.filter(rule => 
          !rule.column || !['part', 'section', 'group', 'variable'].includes(rule.column)
        ));
      }
    }
  }, [isOpen]);

  // Custom Sort handlers
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

  const handleApplyCustomSort = () => {
    const validRules = sortRules.filter(rule => rule.column);
    onApplySort(validRules, defaultOrderEnabled);
    onClose();
  };

  const handleDefaultOrderToggle = (enabled: boolean) => {
    if (enabled) {
      // When enabling default order, backup current rules and filter out conflicting ones
      setSortRulesBackup([...sortRules]);
      setSortRules(prev => prev.filter(rule => 
        !rule.column || !['part', 'section', 'group', 'variable'].includes(rule.column)
      ));
    } else {
      // When disabling default order, restore the backup if it exists
      // Merge backup with any new S, D, C rules that were added while default order was enabled
      if (sortRulesBackup) {
        const currentNonConflictingRules = sortRules.filter(rule => 
          rule.column && ['sector', 'domain', 'country'].includes(rule.column)
        );
        // Restore backup and add any new S, D, C rules that were added
        setSortRules([...sortRulesBackup, ...currentNonConflictingRules]);
        setSortRulesBackup(null);
      }
    }
    setDefaultOrderEnabled(enabled);
    if (onDefaultOrderToggle) {
      onDefaultOrderToggle(enabled);
    }
  };

  const handleCancel = () => {
    // Reset to current state from props
    if (currentSortRules.length > 0) {
      setSortRules(currentSortRules);
    } else {
      setSortRules([{ id: '1', column: '', sortOn: 'cellValues', order: 'asc' }]);
    }
    onClose();
  };

  // Get available columns for Variables custom sort
  // When default order is enabled: only Sector, Domain, Country
  // When default order is disabled: Sector, Domain, Country, Part, Section, Group, Variable
  const availableColumns = columns.filter(col => {
    if (!col.sortable) return false;
    if (defaultOrderEnabled) {
      // Only S, D, C when default order is enabled
      return ['sector', 'domain', 'country'].includes(col.key);
    } else {
      // All columns when default order is disabled
      return ['sector', 'domain', 'country', 'part', 'section', 'group', 'variable'].includes(col.key);
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
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

        {/* Custom Sort Content */}
        {(
          <>
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
                  When enabled, sorting will be: Sector, Domain, Country (custom sort), then Part, Section, Group, Variable (default order).
                  Part, Section, Group, and Variable columns are not available in custom sort when default order is enabled.
                </p>
              )}
            </div>

            {/* Instructions */}
            <div className="mb-6 p-4 bg-ag-dark-bg rounded-lg border border-ag-dark-border">
              <p className="text-sm text-ag-dark-text-secondary">
                Define multi-column sorting rules for Variables. The first rule will be the primary sort, 
                the second will be the secondary sort, and so on. 
                {defaultOrderEnabled 
                  ? ' Available columns: Sector, Domain, Country. Default order (Part, Section, Group, Variable) will be applied after custom sort.'
                  : ' Available columns: Sector, Domain, Country, Part, Section, Group, Variable.'
                }
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
                        disabled={defaultOrderEnabled}
                        className={`w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                          defaultOrderEnabled 
                            ? 'text-ag-dark-text-secondary cursor-not-allowed opacity-50' 
                            : 'text-ag-dark-text'
                        }`}
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
                        disabled={defaultOrderEnabled}
                        className={`w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                          defaultOrderEnabled 
                            ? 'text-ag-dark-text-secondary cursor-not-allowed opacity-50' 
                            : 'text-ag-dark-text'
                        }`}
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
                        disabled={defaultOrderEnabled}
                        className={`w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                          defaultOrderEnabled 
                            ? 'text-ag-dark-text-secondary cursor-not-allowed opacity-50' 
                            : 'text-ag-dark-text'
                        }`}
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
                      disabled={defaultOrderEnabled}
                      className={`flex-shrink-0 transition-colors p-2 ${
                        defaultOrderEnabled
                          ? 'text-ag-dark-text-secondary cursor-not-allowed opacity-50'
                          : 'text-ag-dark-error hover:text-red-400'
                      }`}
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
                  disabled={defaultOrderEnabled}
                  className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-ag-dark-border rounded transition-colors ${
                    defaultOrderEnabled
                      ? 'text-ag-dark-text-secondary cursor-not-allowed opacity-50'
                      : 'text-ag-dark-text hover:bg-ag-dark-bg'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Add Level
                </button>
                
                <button
                  onClick={clearAllRules}
                  disabled={defaultOrderEnabled}
                  className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-ag-dark-border rounded transition-colors ${
                    defaultOrderEnabled
                      ? 'text-ag-dark-text-secondary cursor-not-allowed opacity-50'
                      : 'text-ag-dark-text hover:bg-ag-dark-bg'
                  }`}
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
                  onClick={handleApplyCustomSort}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-ag-dark-accent text-white rounded text-sm font-medium hover:bg-ag-dark-accent-hover transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Apply Sort
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
