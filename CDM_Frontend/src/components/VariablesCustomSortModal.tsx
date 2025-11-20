import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, RotateCcw, Check, GripVertical } from 'lucide-react';
import type { VariableData } from '../data/variablesData';

interface SortRule {
  id: string;
  column: string;
  sortOn: string;
  order: 'asc' | 'desc';
}

interface PredefinedSortOrder {
  partOrder: string[];
  groupOrders: Record<string, string[]>; // key: part, value: array of groups
  variableOrders: Record<string, string[]>; // key: "part|group", value: array of variables
}

interface VariablesCustomSortModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySort: (sortRules: SortRule[]) => void;
  onApplyPredefinedSort: (enabled: boolean, order: PredefinedSortOrder) => void;
  columns: Array<{ key: string; title: string; sortable?: boolean }>;
  currentSortRules?: SortRule[];
  variableData?: VariableData[];
  sortConfig?: { key: string; type: 'custom' | 'none'; customOrder?: string[] } | null;
  isPredefinedSortEnabled?: boolean;
  predefinedSortOrder?: PredefinedSortOrder;
}

export const VariablesCustomSortModal: React.FC<VariablesCustomSortModalProps> = ({
  isOpen,
  onClose,
  onApplySort,
  onApplyPredefinedSort,
  columns,
  currentSortRules = [],
  variableData = [],
  sortConfig = null,
  isPredefinedSortEnabled = false,
  predefinedSortOrder
}) => {
  const [activeTab, setActiveTab] = useState<'custom' | 'predefined'>('custom');
  const [sortRules, setSortRules] = useState<SortRule[]>(
    currentSortRules.length > 0 ? currentSortRules : [
      { id: '1', column: '', sortOn: 'cellValues', order: 'asc' }
    ]
  );

  // Pre-defined Sort state
  const [predefinedEnabled, setPredefinedEnabled] = useState(isPredefinedSortEnabled);
  const [partOrder, setPartOrder] = useState<string[]>([]);
  const [groupOrders, setGroupOrders] = useState<Record<string, string[]>>({});
  const [variableOrders, setVariableOrders] = useState<Record<string, string[]>>({});
  
  // Working state for unsaved changes
  const [workingPartOrder, setWorkingPartOrder] = useState<string[]>([]);
  const [workingGroupOrders, setWorkingGroupOrders] = useState<Record<string, string[]>>({});
  const [workingVariableOrders, setWorkingVariableOrders] = useState<Record<string, string[]>>({});
  
  // Selected Part/Group for Group and Variable sections
  const [selectedPartForGroup, setSelectedPartForGroup] = useState<string>('');
  const [selectedPartForVariable, setSelectedPartForVariable] = useState<string>('');
  const [selectedGroupForVariable, setSelectedGroupForVariable] = useState<string>('');
  
  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragType, setDragType] = useState<'part' | 'group' | 'variable' | null>(null);

  // Get distinct values from variableData
  const distinctParts = useMemo(() => {
    const parts = new Set<string>();
    variableData.forEach(v => {
      if (v.part) parts.add(v.part);
    });
    return Array.from(parts).sort();
  }, [variableData]);

  const distinctGroupsByPart = useMemo(() => {
    const groupsByPart: Record<string, Set<string>> = {};
    variableData.forEach(v => {
      if (v.part && v.group) {
        if (!groupsByPart[v.part]) {
          groupsByPart[v.part] = new Set<string>();
        }
        groupsByPart[v.part].add(v.group);
      }
    });
    const result: Record<string, string[]> = {};
    Object.keys(groupsByPart).forEach(part => {
      result[part] = Array.from(groupsByPart[part]).sort();
    });
    return result;
  }, [variableData]);

  const distinctVariablesByPartGroup = useMemo(() => {
    const varsByPartGroup: Record<string, Set<string>> = {};
    variableData.forEach(v => {
      if (v.part && v.group && v.variable) {
        const key = `${v.part}|${v.group}`;
        if (!varsByPartGroup[key]) {
          varsByPartGroup[key] = new Set<string>();
        }
        varsByPartGroup[key].add(v.variable);
      }
    });
    const result: Record<string, string[]> = {};
    Object.keys(varsByPartGroup).forEach(key => {
      result[key] = Array.from(varsByPartGroup[key]).sort();
    });
    return result;
  }, [variableData]);

  // Initialize predefined sort order from props or create default
  // Only re-initialize when modal opens or when predefinedSortOrder prop changes
  useEffect(() => {
    if (!isOpen) return; // Don't initialize when modal is closed
    
    // Check if we have a valid saved order
    const hasSavedOrder = predefinedSortOrder && 
      predefinedSortOrder.partOrder && 
      predefinedSortOrder.partOrder.length > 0;
    
    if (hasSavedOrder) {
      // We have a saved order - preserve it exactly, only append truly new values
      
      // For Parts: preserve saved order exactly, append any new parts that don't exist
      const savedPartOrder = [...predefinedSortOrder.partOrder];
      const savedPartSet = new Set(savedPartOrder);
      const newParts = distinctParts.filter(p => !savedPartSet.has(p));
      const mergedPartOrder = [...savedPartOrder, ...newParts];
      
      setPartOrder(mergedPartOrder);
      setWorkingPartOrder(mergedPartOrder);
      
      // For Groups: preserve saved orders exactly, merge with any new groups per part
      const mergedGroupOrders: Record<string, string[]> = {};
      // First, copy all saved group orders
      if (predefinedSortOrder.groupOrders) {
        Object.keys(predefinedSortOrder.groupOrders).forEach(part => {
          mergedGroupOrders[part] = [...predefinedSortOrder.groupOrders[part]];
        });
      }
      // Then, for each part in the merged part order, ensure we have groups
      mergedPartOrder.forEach(part => {
        if (!mergedGroupOrders[part]) {
          mergedGroupOrders[part] = [];
        }
        const savedGroupSet = new Set(mergedGroupOrders[part]);
        const currentGroups = distinctGroupsByPart[part] || [];
        const newGroups = currentGroups.filter(g => !savedGroupSet.has(g));
        mergedGroupOrders[part] = [...mergedGroupOrders[part], ...newGroups];
      });
      setGroupOrders(mergedGroupOrders);
      setWorkingGroupOrders(mergedGroupOrders);
      
      // For Variables: preserve saved orders exactly, merge with any new variables per part|group
      const mergedVariableOrders: Record<string, string[]> = {};
      // First, copy all saved variable orders
      if (predefinedSortOrder.variableOrders) {
        Object.keys(predefinedSortOrder.variableOrders).forEach(key => {
          mergedVariableOrders[key] = [...predefinedSortOrder.variableOrders[key]];
        });
      }
      // Then, for each part|group combination, ensure we have variables
      mergedPartOrder.forEach(part => {
        const groups = mergedGroupOrders[part] || [];
        groups.forEach(group => {
          const key = `${part}|${group}`;
          if (!mergedVariableOrders[key]) {
            mergedVariableOrders[key] = [];
          }
          const savedVarSet = new Set(mergedVariableOrders[key]);
          const currentVars = distinctVariablesByPartGroup[key] || [];
          const newVars = currentVars.filter(v => !savedVarSet.has(v));
          mergedVariableOrders[key] = [...mergedVariableOrders[key], ...newVars];
        });
      });
      setVariableOrders(mergedVariableOrders);
      setWorkingVariableOrders(mergedVariableOrders);
    } else {
      // No saved order - create default alphabetical order
      const defaultPartOrder = [...distinctParts];
      setPartOrder(defaultPartOrder);
      setWorkingPartOrder(defaultPartOrder);
      
      const defaultGroupOrders: Record<string, string[]> = {};
      distinctParts.forEach(part => {
        if (distinctGroupsByPart[part]) {
          defaultGroupOrders[part] = [...distinctGroupsByPart[part]];
        }
      });
      setGroupOrders(defaultGroupOrders);
      setWorkingGroupOrders(defaultGroupOrders);
      
      const defaultVariableOrders: Record<string, string[]> = {};
      distinctParts.forEach(part => {
        if (distinctGroupsByPart[part]) {
          distinctGroupsByPart[part].forEach(group => {
            const key = `${part}|${group}`;
            if (distinctVariablesByPartGroup[key]) {
              defaultVariableOrders[key] = [...distinctVariablesByPartGroup[key]];
            }
          });
        }
      });
      setVariableOrders(defaultVariableOrders);
      setWorkingVariableOrders(defaultVariableOrders);
    }
  }, [isOpen, predefinedSortOrder]); // Only depend on isOpen and predefinedSortOrder, not on computed distinct values

  // Initialize selected Part/Group when data changes
  useEffect(() => {
    if (distinctParts.length > 0 && !selectedPartForGroup) {
      setSelectedPartForGroup(distinctParts[0]);
    }
    if (distinctParts.length > 0 && !selectedPartForVariable) {
      setSelectedPartForVariable(distinctParts[0]);
    }
    if (selectedPartForVariable && distinctGroupsByPart[selectedPartForVariable]?.length > 0 && !selectedGroupForVariable) {
      setSelectedGroupForVariable(distinctGroupsByPart[selectedPartForVariable][0]);
    }
  }, [distinctParts, distinctGroupsByPart, selectedPartForGroup, selectedPartForVariable, selectedGroupForVariable]);

  // Check if column sorting is active for Part, Group, or Variable
  const hasColumnSorting = useMemo(() => {
    if (!sortConfig || sortConfig.type === 'none') return false;
    return ['part', 'group', 'variable'].includes(sortConfig.key);
  }, [sortConfig]);

  // Toggle predefined sort - automatically clear column sort if needed
  const handleTogglePredefinedSort = () => {
    const newEnabled = !predefinedEnabled;
    
    // If enabling predefined sort and column sort is active for Part/Group/Variable, 
    // we'll clear it automatically (handled by parent via onApplyPredefinedSort)
    // Just toggle the state - the parent will handle clearing column sort
    setPredefinedEnabled(newEnabled);
  };

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
    onApplySort(validRules);
    onClose();
  };

  // Pre-defined Sort handlers
  const handleDragStart = (item: string, type: 'part' | 'group' | 'variable') => {
    setDraggedItem(item);
    setDragType(type);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number, type: 'part' | 'group' | 'variable') => {
    e.preventDefault();
    if (!draggedItem || dragType !== type) return;

    if (type === 'part') {
      const newOrder = [...workingPartOrder];
      const dragIndex = newOrder.indexOf(draggedItem);
      if (dragIndex !== -1 && dragIndex !== dropIndex) {
        newOrder.splice(dragIndex, 1);
        newOrder.splice(dropIndex, 0, draggedItem);
        setWorkingPartOrder(newOrder);
      }
    } else if (type === 'group' && selectedPartForGroup) {
      const newOrder = [...(workingGroupOrders[selectedPartForGroup] || [])];
      const dragIndex = newOrder.indexOf(draggedItem);
      if (dragIndex !== -1 && dragIndex !== dropIndex) {
        newOrder.splice(dragIndex, 1);
        newOrder.splice(dropIndex, 0, draggedItem);
        setWorkingGroupOrders(prev => ({
          ...prev,
          [selectedPartForGroup]: newOrder
        }));
      }
    } else if (type === 'variable' && selectedPartForVariable && selectedGroupForVariable) {
      const key = `${selectedPartForVariable}|${selectedGroupForVariable}`;
      const newOrder = [...(workingVariableOrders[key] || [])];
      const dragIndex = newOrder.indexOf(draggedItem);
      if (dragIndex !== -1 && dragIndex !== dropIndex) {
        newOrder.splice(dragIndex, 1);
        newOrder.splice(dropIndex, 0, draggedItem);
        setWorkingVariableOrders(prev => ({
          ...prev,
          [key]: newOrder
        }));
      }
    }

    setDraggedItem(null);
    setDragOverIndex(null);
    setDragType(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
    setDragType(null);
  };

  const handleSavePartOrder = () => {
    setPartOrder([...workingPartOrder]);
    // Update group enumerations when part order changes
    const newGroupOrders: Record<string, string[]> = {};
    workingPartOrder.forEach((part, partIndex) => {
      if (workingGroupOrders[part]) {
        newGroupOrders[part] = [...workingGroupOrders[part]];
      }
    });
    setGroupOrders(newGroupOrders);
    setWorkingGroupOrders(newGroupOrders);
  };

  const handleSaveGroupOrder = () => {
    if (!selectedPartForGroup) return;
    setGroupOrders(prev => ({
      ...prev,
      [selectedPartForGroup]: [...(workingGroupOrders[selectedPartForGroup] || [])]
    }));
  };

  const handleSaveVariableOrder = () => {
    if (!selectedPartForVariable || !selectedGroupForVariable) return;
    const key = `${selectedPartForVariable}|${selectedGroupForVariable}`;
    setVariableOrders(prev => ({
      ...prev,
      [key]: [...(workingVariableOrders[key] || [])]
    }));
  };

  const handlePartChangeForGroup = (part: string) => {
    // Don't save changes if switching parts
    setSelectedPartForGroup(part);
  };

  const handlePartChangeForVariable = (part: string) => {
    // Don't save changes if switching parts
    setSelectedPartForVariable(part);
    // Reset group selection
    if (distinctGroupsByPart[part]?.length > 0) {
      setSelectedGroupForVariable(distinctGroupsByPart[part][0]);
    } else {
      setSelectedGroupForVariable('');
    }
  };

  const handleGroupChangeForVariable = (group: string) => {
    // Don't save changes if switching groups
    setSelectedGroupForVariable(group);
  };

  const handleApplyPredefinedSort = () => {
    // Use working state (what user is currently seeing) when applying
    // This ensures any unsaved changes are also applied
    const order: PredefinedSortOrder = {
      partOrder: [...workingPartOrder],
      groupOrders: { ...workingGroupOrders },
      variableOrders: { ...workingVariableOrders }
    };
    // Also update saved state to match working state
    setPartOrder([...workingPartOrder]);
    setGroupOrders({ ...workingGroupOrders });
    setVariableOrders({ ...workingVariableOrders });
    // Always pass the order, even if disabled - the order is sacred and must be preserved
    onApplyPredefinedSort(predefinedEnabled, order);
    onClose();
  };

  const handleCancel = () => {
    // Reset to current state from props
    if (currentSortRules.length > 0) {
      setSortRules(currentSortRules);
    } else {
      setSortRules([{ id: '1', column: '', sortOn: 'cellValues', order: 'asc' }]);
    }
    setPredefinedEnabled(isPredefinedSortEnabled);
    // Reset working state to match saved state (will be re-initialized when modal reopens)
    // Don't reset here - let the useEffect handle it when modal reopens
    onClose();
  };

  // Get available columns for Variables custom sort (only Sector, Domain, Country - NOT Part, Group, Variable)
  const availableColumns = columns.filter(col => 
    col.sortable && ['sector', 'domain', 'country'].includes(col.key)
  );

  // Get part position for enumeration
  const getPartPosition = (part: string) => {
    return workingPartOrder.indexOf(part) + 1;
  };

  // Get group position for enumeration (with part prefix)
  const getGroupPosition = (group: string, part: string) => {
    const partPos = getPartPosition(part);
    const groupIndex = (workingGroupOrders[part] || []).indexOf(group);
    return `${partPos}.${groupIndex + 1}`;
  };

  // Get variable position for enumeration (with part.group prefix)
  const getVariablePosition = (variable: string, part: string, group: string) => {
    const partPos = getPartPosition(part);
    const groupIndex = (workingGroupOrders[part] || []).indexOf(group);
    const key = `${part}|${group}`;
    const varIndex = (workingVariableOrders[key] || []).indexOf(variable);
    return `${partPos}.${groupIndex + 1}.${varIndex + 1}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
      <div className={`bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6 ${activeTab === 'predefined' ? 'max-w-7xl' : 'max-w-4xl'} w-full mx-4 max-h-[90vh] overflow-y-auto`}>
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

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-ag-dark-border">
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'custom'
                ? 'text-ag-dark-accent border-b-2 border-ag-dark-accent'
                : 'text-ag-dark-text-secondary hover:text-ag-dark-text'
            }`}
          >
            Custom Sort
          </button>
          <button
            onClick={() => setActiveTab('predefined')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'predefined'
                ? 'text-ag-dark-accent border-b-2 border-ag-dark-accent'
                : 'text-ag-dark-text-secondary hover:text-ag-dark-text'
            }`}
          >
            Pre-defined Sort
          </button>
        </div>

        {/* Custom Sort Tab */}
        {activeTab === 'custom' && (
          <>
            {/* Instructions */}
            <div className="mb-6 p-4 bg-ag-dark-bg rounded-lg border border-ag-dark-border">
              <p className="text-sm text-ag-dark-text-secondary">
                Define multi-column sorting rules for Variables. The first rule will be the primary sort, 
                the second will be the secondary sort, and so on. Available columns: Sector, Domain, Country.
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

        {/* Pre-defined Sort Tab */}
        {activeTab === 'predefined' && (
          <>
            {/* Toggle */}
            <div className="mb-6 p-4 bg-ag-dark-bg rounded-lg border border-ag-dark-border">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-ag-dark-text mb-1">Pre-defined Sort</h4>
                  <p className="text-xs text-ag-dark-text-secondary">
                    Define custom sort order for Part, Group, and Variable columns. This will be applied before Custom Sort.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={predefinedEnabled}
                    onChange={handleTogglePredefinedSort}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-ag-dark-border peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ag-dark-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ag-dark-accent"></div>
                  <span className="ml-3 text-sm text-ag-dark-text">
                    {predefinedEnabled ? 'On' : 'Off'}
                  </span>
                </label>
              </div>
            </div>

            {/* Part, Group, and Variable Sections - Side by Side */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {/* Part Section */}
              <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none">
                <h4 className="text-sm font-medium text-ag-dark-text mb-3">Part</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto mb-3 flex-1 border-0 outline-none">
                  {workingPartOrder.map((part, index) => (
                    <div
                      key={part}
                      draggable
                      onDragStart={() => handleDragStart(part, 'part')}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index, 'part')}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                        draggedItem === part && dragType === 'part'
                          ? 'bg-ag-dark-accent bg-opacity-20'
                          : dragOverIndex === index && dragType === 'part'
                          ? 'bg-ag-dark-accent bg-opacity-10'
                          : 'hover:bg-ag-dark-surface'
                      }`}
                    >
                      <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                      <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                      <span className="text-ag-dark-text flex-1 truncate">{part}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleSavePartOrder}
                  className="w-full px-4 py-2 bg-ag-dark-accent text-white rounded text-sm font-medium hover:bg-ag-dark-accent-hover transition-colors mt-auto"
                >
                  Save Changes
                </button>
              </div>

              {/* Group Section */}
              <div className="p-4 bg-ag-dark-bg flex flex-col">
                <h4 className="text-sm font-medium text-ag-dark-text mb-3">Group</h4>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                    Select Part
                  </label>
                  <select
                    value={selectedPartForGroup}
                    onChange={(e) => handlePartChangeForGroup(e.target.value)}
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
                    {workingPartOrder.map(part => (
                      <option key={part} value={part}>{part}</option>
                    ))}
                  </select>
                </div>
                {selectedPartForGroup && (
                  <>
                    <div className="space-y-2 max-h-96 overflow-y-auto mb-3 flex-1">
                      {(workingGroupOrders[selectedPartForGroup] || []).map((group, index) => (
                        <div
                          key={group}
                          draggable
                          onDragStart={() => handleDragStart(group, 'group')}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDrop={(e) => handleDrop(e, index, 'group')}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                            draggedItem === group && dragType === 'group'
                              ? 'bg-ag-dark-accent bg-opacity-20'
                              : dragOverIndex === index && dragType === 'group'
                              ? 'bg-ag-dark-accent bg-opacity-10'
                              : 'hover:bg-ag-dark-surface'
                          }`}
                        >
                          <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                          <span className="text-xs text-ag-dark-text-secondary w-10 flex-shrink-0">
                            {getGroupPosition(group, selectedPartForGroup)}.
                          </span>
                          <span className="text-ag-dark-text flex-1 truncate">{group}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleSaveGroupOrder}
                      className="w-full px-4 py-2 bg-ag-dark-accent text-white rounded text-sm font-medium hover:bg-ag-dark-accent-hover transition-colors mt-auto"
                    >
                      Save Changes
                    </button>
                  </>
                )}
              </div>

              {/* Variable Section */}
              <div className="p-4 bg-ag-dark-bg flex flex-col">
                <h4 className="text-sm font-medium text-ag-dark-text mb-3">Variable</h4>
                <div className="space-y-2 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                      Select Part
                    </label>
                    <select
                      value={selectedPartForVariable}
                      onChange={(e) => handlePartChangeForVariable(e.target.value)}
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
                      {workingPartOrder.map(part => (
                        <option key={part} value={part}>{part}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                      Select Group
                    </label>
                    <select
                      value={selectedGroupForVariable}
                      onChange={(e) => handleGroupChangeForVariable(e.target.value)}
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
                      {selectedPartForVariable && (distinctGroupsByPart[selectedPartForVariable] || []).map(group => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {selectedPartForVariable && selectedGroupForVariable && (
                  <>
                    <div className="space-y-2 max-h-96 overflow-y-auto mb-3 flex-1">
                      {(() => {
                        const key = `${selectedPartForVariable}|${selectedGroupForVariable}`;
                        return (workingVariableOrders[key] || []).map((variable, index) => (
                          <div
                            key={variable}
                            draggable
                            onDragStart={() => handleDragStart(variable, 'variable')}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index, 'variable')}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                              draggedItem === variable && dragType === 'variable'
                                ? 'bg-ag-dark-accent bg-opacity-20'
                                : dragOverIndex === index && dragType === 'variable'
                                ? 'bg-ag-dark-accent bg-opacity-10'
                                : 'hover:bg-ag-dark-surface'
                            }`}
                          >
                            <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                            <span className="text-xs text-ag-dark-text-secondary w-14 flex-shrink-0">
                              {getVariablePosition(variable, selectedPartForVariable, selectedGroupForVariable)}.
                            </span>
                            <span className="text-ag-dark-text flex-1 truncate">{variable}</span>
                          </div>
                        ));
                      })()}
                    </div>
                    <button
                      onClick={handleSaveVariableOrder}
                      className="w-full px-4 py-2 bg-ag-dark-accent text-white rounded text-sm font-medium hover:bg-ag-dark-accent-hover transition-colors mt-auto"
                    >
                      Save Changes
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-ag-dark-text border border-ag-dark-border rounded hover:bg-ag-dark-bg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyPredefinedSort}
                className="inline-flex items-center gap-2 px-4 py-2 bg-ag-dark-accent text-white rounded text-sm font-medium hover:bg-ag-dark-accent-hover transition-colors"
              >
                <Check className="w-4 h-4" />
                Apply Sort
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
