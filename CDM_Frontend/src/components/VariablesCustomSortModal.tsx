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
  /** Columns removed from custom sort when default order is enabled (conflict with predefined hierarchy). */
  hierarchyColumnKeysForDefaultOrder?: string[];
  /** Driver columns (S/D/C) allowed when default order is on. */
  driverColumnKeys?: string[];
  /** All column keys allowed in the Column dropdown when default order is off. */
  allowedCustomSortColumnKeys?: string[];
  /** Shown under "Enable default order" when that option is on (overrides the Variables-specific copy). */
  defaultOrderEnabledHelpText?: string;
  /** Hide the long "Define multi-column sorting rules…" instructions block (e.g. Source LDM). */
  hideInstructions?: boolean;
  /** Hide "Enable default order" (e.g. Auto Map grid uses a separate Default Sort control). */
  hideDefaultOrderToggle?: boolean;
  /** Shown in the instructions paragraph (e.g. "Variables", "Source LDM mappings"). */
  sortTargetLabel?: string;
}

const DEFAULT_DRIVER_KEYS = ['sector', 'domain', 'country'] as const;
const DEFAULT_VARIABLES_HIERARCHY_KEYS = ['part', 'section', 'group', 'variable'] as const;
const DEFAULT_VARIABLES_CUSTOM_OFF_KEYS = [
  ...DEFAULT_DRIVER_KEYS,
  ...DEFAULT_VARIABLES_HIERARCHY_KEYS,
] as const;

export const VariablesCustomSortModal: React.FC<VariablesCustomSortModalProps> = ({
  isOpen,
  onClose,
  onApplySort,
  columns,
  currentSortRules = [],
  isDefaultOrderEnabled = false,
  onDefaultOrderToggle,
  hierarchyColumnKeysForDefaultOrder,
  driverColumnKeys,
  allowedCustomSortColumnKeys,
  defaultOrderEnabledHelpText,
  hideInstructions = false,
  hideDefaultOrderToggle = false,
  sortTargetLabel = 'Variables',
}) => {
  const hierarchyKeys = hierarchyColumnKeysForDefaultOrder ?? [...DEFAULT_VARIABLES_HIERARCHY_KEYS];
  const driverKeys = driverColumnKeys ?? [...DEFAULT_DRIVER_KEYS];
  const keysWhenDefaultOff = allowedCustomSortColumnKeys ?? [...DEFAULT_VARIABLES_CUSTOM_OFF_KEYS];
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
      const hasConflictingRules = sortRules.some(
        (rule) => rule.column && hierarchyKeys.includes(rule.column)
      );
      if (hasConflictingRules) {
        setSortRulesBackup([...sortRules]);
        setSortRules((prev) =>
          prev.filter((rule) => !rule.column || !hierarchyKeys.includes(rule.column))
        );
      }
    }
  }, [isOpen, defaultOrderEnabled, hierarchyKeys]);

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
      setSortRules((prev) =>
        prev.filter((rule) => !rule.column || !hierarchyKeys.includes(rule.column))
      );
    } else {
      // When disabling default order, restore the backup if it exists
      // Only add new S, D, C rules that don't already exist in the backup (to avoid duplicates)
      if (sortRulesBackup) {
        const backupColumnSet = new Set(sortRulesBackup.map((rule) => rule.column));
        const newNonConflictingRules = sortRules.filter(
          (rule) =>
            rule.column &&
            driverKeys.includes(rule.column) &&
            !backupColumnSet.has(rule.column)
        );
        // Restore backup and add only truly new S, D, C rules
        setSortRules([...sortRulesBackup, ...newNonConflictingRules]);
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

  // When default order is enabled: only driver columns (e.g. S, D, C)
  // When default order is disabled: allowed custom-sort keys for this grid
  const availableColumns = columns.filter((col) => {
    if (!col.sortable) return false;
    if (defaultOrderEnabled) {
      return driverKeys.includes(col.key);
    }
    return keysWhenDefaultOff.includes(col.key);
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
            {!hideDefaultOrderToggle && (
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
                    {defaultOrderEnabledHelpText ??
                      'When enabled, sorting will be: Sector, Domain, Country (custom sort), then Part, Section, Group, Variable (default order). Part, Section, Group, and Variable columns are not available in custom sort when default order is enabled.'}
                  </p>
                )}
              </div>
            )}

            {!hideInstructions && (
              <div className="mb-6 p-4 bg-ag-dark-bg rounded-lg border border-ag-dark-border">
                <p className="text-sm text-ag-dark-text-secondary">
                  Define multi-column sorting rules for {sortTargetLabel}. The first rule will be the primary sort,
                  the second will be the secondary sort, and so on.
                  {defaultOrderEnabled
                    ? driverKeys.length > 0
                      ? ` Available columns: ${driverKeys.map((k) => columns.find((c) => c.key === k)?.title || k).join(', ')}. Default hierarchy order will be applied after these driver sorts.`
                      : ' Default order uses the hierarchy from the Default Sort dialog (Being → Avatar → Object → Part → Section → Group → Variable). Custom multi-column rules are disabled while this is on; turn it off to sort by grid columns such as Source Name, Source Table, and Source Column.'
                    : ` Available columns: ${keysWhenDefaultOff
                        .map((k) => columns.find((c) => c.key === k)?.title || k)
                        .join(', ')}.`}
                </p>
              </div>
            )}

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
