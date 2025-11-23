import React, { useState, useEffect, useRef } from 'react';
import { X, GripVertical, Maximize2, Minimize2 } from 'lucide-react';
import type { VariableData } from '../data/variablesData';

interface OrderSortOrder {
  partOrder: string[];
  sectionOrder: string[];
  groupOrders: Record<string, string[]>;
  variableOrders: Record<string, string[]>;
}

interface VariablesOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyOrder: (enabled: boolean, order: OrderSortOrder) => void;
  variableData: VariableData[];
  sortConfig?: any;
  isOrderEnabled: boolean;
  orderSortOrder?: OrderSortOrder;
}

export const VariablesOrderModal: React.FC<VariablesOrderModalProps> = ({
  isOpen,
  onClose,
  onApplyOrder,
  variableData,
  isOrderEnabled,
  orderSortOrder
}) => {
  const [workingPartOrder, setWorkingPartOrder] = useState<string[]>([]);
  const [workingSectionOrder, setWorkingSectionOrder] = useState<string[]>([]);
  const [workingGroupOrders, setWorkingGroupOrders] = useState<Record<string, string[]>>({});
  const [workingVariableOrders, setWorkingVariableOrders] = useState<Record<string, string[]>>({});
  const [selectedPart, setSelectedPart] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'part' | 'section' | 'group' | 'variable' | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number>(-1);
  const [savedPartOrder, setSavedPartOrder] = useState<string[]>([]);
  const [savedSectionOrder, setSavedSectionOrder] = useState<string[]>([]);
  const [savedGroupOrders, setSavedGroupOrders] = useState<Record<string, string[]>>({});
  const [savedVariableOrders, setSavedVariableOrders] = useState<Record<string, string[]>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Get distinct values
  const distinctParts = Array.from(new Set(variableData.map(v => v.part).filter(Boolean))).sort();
  const distinctSections = Array.from(new Set(variableData.map(v => v.section).filter(Boolean))).sort();
  const groupsForPart = selectedPart
    ? Array.from(new Set(variableData.filter(v => v.part === selectedPart).map(v => v.group).filter(Boolean))).sort()
    : [];
  const variablesForPartAndGroup = selectedPart && selectedGroup
    ? Array.from(new Set(variableData.filter(v => v.part === selectedPart && v.group === selectedGroup).map(v => v.variable).filter(Boolean))).sort()
    : [];

  // Initialize working orders from props or create defaults - only once when modal opens
  useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false);
      return;
    }
    
    if (!isInitialized) {
      if (orderSortOrder) {
        const partOrder = orderSortOrder.partOrder && orderSortOrder.partOrder.length > 0 ? orderSortOrder.partOrder : distinctParts;
        const sectionOrder = orderSortOrder.sectionOrder && orderSortOrder.sectionOrder.length > 0 ? orderSortOrder.sectionOrder : distinctSections;
        setWorkingPartOrder(partOrder);
        setWorkingSectionOrder(sectionOrder);
        setSavedPartOrder(partOrder);
        setSavedSectionOrder(sectionOrder);
        setWorkingGroupOrders(orderSortOrder.groupOrders || {});
        setSavedGroupOrders(orderSortOrder.groupOrders || {});
        setWorkingVariableOrders(orderSortOrder.variableOrders || {});
        setSavedVariableOrders(orderSortOrder.variableOrders || {});
      } else {
        // Create default alphabetical orders
        setWorkingPartOrder(distinctParts);
        setWorkingSectionOrder(distinctSections);
        setSavedPartOrder(distinctParts);
        setSavedSectionOrder(distinctSections);
        setWorkingGroupOrders({});
        setSavedGroupOrders({});
        setWorkingVariableOrders({});
        setSavedVariableOrders({});
      }
      setIsInitialized(true);
    }
  }, [isOpen, orderSortOrder, distinctParts, distinctSections, isInitialized]);

  const handleDragStart = (item: string, type: 'part' | 'section' | 'group' | 'variable') => {
    setDraggedItem(item);
    setDragType(type);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number, type: 'part' | 'section' | 'group' | 'variable') => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || dragType !== type) {
      setDraggedItem(null);
      setDragType(null);
      setDragOverIndex(-1);
      return;
    }

    if (type === 'part') {
      const newOrder = [...workingPartOrder];
      const draggedIndex = newOrder.indexOf(draggedItem);
      if (draggedIndex === -1) {
        setDraggedItem(null);
        setDragType(null);
        setDragOverIndex(-1);
        return;
      }
      // Remove from old position
      newOrder.splice(draggedIndex, 1);
      // Insert at new position (adjust index if dragging down)
      const insertIndex = draggedIndex < index ? index - 1 : index;
      newOrder.splice(insertIndex, 0, draggedItem);
      setWorkingPartOrder(newOrder);
    } else if (type === 'section') {
      const newOrder = [...workingSectionOrder];
      const draggedIndex = newOrder.indexOf(draggedItem);
      if (draggedIndex === -1) {
        setDraggedItem(null);
        setDragType(null);
        setDragOverIndex(-1);
        return;
      }
      // Remove from old position
      newOrder.splice(draggedIndex, 1);
      // Insert at new position (adjust index if dragging down)
      const insertIndex = draggedIndex < index ? index - 1 : index;
      newOrder.splice(insertIndex, 0, draggedItem);
      setWorkingSectionOrder(newOrder);
    } else if (type === 'group' && selectedPart) {
      const currentGroups = workingGroupOrders[selectedPart] || savedGroupOrders[selectedPart] || groupsForPart;
      const newOrder = [...currentGroups];
      const draggedIndex = newOrder.indexOf(draggedItem);
      if (draggedIndex === -1) {
        setDraggedItem(null);
        setDragType(null);
        setDragOverIndex(-1);
        return;
      }
      // Remove from old position
      newOrder.splice(draggedIndex, 1);
      // Insert at new position (adjust index if dragging down)
      const insertIndex = draggedIndex < index ? index - 1 : index;
      newOrder.splice(insertIndex, 0, draggedItem);
      setWorkingGroupOrders({ ...workingGroupOrders, [selectedPart]: newOrder });
    } else if (type === 'variable' && selectedPart && selectedGroup) {
      const key = `${selectedPart}|${selectedGroup}`;
      const currentVariables = workingVariableOrders[key] || savedVariableOrders[key] || variablesForPartAndGroup;
      const newOrder = [...currentVariables];
      const draggedIndex = newOrder.indexOf(draggedItem);
      if (draggedIndex === -1) {
        setDraggedItem(null);
        setDragType(null);
        setDragOverIndex(-1);
        return;
      }
      // Remove from old position
      newOrder.splice(draggedIndex, 1);
      // Insert at new position (adjust index if dragging down)
      const insertIndex = draggedIndex < index ? index - 1 : index;
      newOrder.splice(insertIndex, 0, draggedItem);
      setWorkingVariableOrders({ ...workingVariableOrders, [key]: newOrder });
    }

    setDraggedItem(null);
    setDragType(null);
    setDragOverIndex(-1);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragType(null);
    setDragOverIndex(-1);
  };

  const handleSavePartOrder = () => {
    // Persist the current working order as the saved order
    setSavedPartOrder([...workingPartOrder]);
  };

  const handleSaveSectionOrder = () => {
    // Persist the current working order as the saved order
    setSavedSectionOrder([...workingSectionOrder]);
  };

  const handleSaveGroupOrder = () => {
    if (!selectedPart) return;
    const currentGroups = workingGroupOrders[selectedPart] || groupsForPart;
    const newGroupOrders = { ...workingGroupOrders, [selectedPart]: [...currentGroups] };
    setWorkingGroupOrders(newGroupOrders);
    setSavedGroupOrders(newGroupOrders);
  };

  const handleSaveVariableOrder = () => {
    if (!selectedPart || !selectedGroup) return;
    const key = `${selectedPart}|${selectedGroup}`;
    const currentVariables = workingVariableOrders[key] || variablesForPartAndGroup;
    const newVariableOrders = { ...workingVariableOrders, [key]: [...currentVariables] };
    setWorkingVariableOrders(newVariableOrders);
    setSavedVariableOrders(newVariableOrders);
  };

  const handleApply = () => {
    // Use saved orders if available, otherwise use working orders
    const order: OrderSortOrder = {
      partOrder: savedPartOrder.length > 0 ? savedPartOrder : workingPartOrder,
      sectionOrder: savedSectionOrder.length > 0 ? savedSectionOrder : workingSectionOrder,
      groupOrders: Object.keys(savedGroupOrders).length > 0 ? savedGroupOrders : workingGroupOrders,
      variableOrders: Object.keys(savedVariableOrders).length > 0 ? savedVariableOrders : workingVariableOrders
    };
    onApplyOrder(isOrderEnabled, order);
    onClose();
  };

  const getGroupPosition = (part: string, group: string): number => {
    const order = workingGroupOrders[part] || groupsForPart;
    const index = order.indexOf(group);
    return index === -1 ? order.length : index;
  };

  const getVariablePosition = (part: string, group: string, variable: string): number => {
    const key = `${part}|${group}`;
    const order = workingVariableOrders[key] || variablesForPartAndGroup;
    const index = order.indexOf(variable);
    return index === -1 ? order.length : index;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
      <div 
        ref={modalRef}
        className={`bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6 transition-all duration-300 flex flex-col ${
          isExpanded 
            ? 'w-[95vw] h-[95vh]' 
            : 'max-w-[90rem] w-full mx-4 max-h-[90vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-ag-dark-text">Order</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
              title={isExpanded ? "Minimize" : "Maximize"}
            >
              {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-6 p-4 bg-ag-dark-bg rounded-lg border border-ag-dark-border flex-shrink-0">
          <p className="text-sm text-ag-dark-text-secondary">
            Define the sort order for Part, Section, Group, and Variable columns. Drag items to reorder them.
            The order will be applied when enabled.
          </p>
        </div>

        {/* Four Column Layout */}
        <div className={`grid grid-cols-4 gap-4 mb-6 ${isExpanded ? 'flex-1 min-h-0 overflow-hidden' : ''}`}>
          {/* Part Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">Part</h4>
            <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
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

          {/* Section Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">Section</h4>
            <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
              {workingSectionOrder.map((section, index) => (
                <div
                  key={section}
                  draggable
                  onDragStart={() => handleDragStart(section, 'section')}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index, 'section')}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                    draggedItem === section && dragType === 'section'
                      ? 'bg-ag-dark-accent bg-opacity-20'
                      : dragOverIndex === index && dragType === 'section'
                      ? 'bg-ag-dark-accent bg-opacity-10'
                      : 'hover:bg-ag-dark-surface'
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                  <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                  <span className="text-ag-dark-text flex-1 truncate">{section}</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleSaveSectionOrder}
              className="w-full px-4 py-2 bg-ag-dark-accent text-white rounded text-sm font-medium hover:bg-ag-dark-accent-hover transition-colors mt-auto"
            >
              Save Changes
            </button>
          </div>

          {/* Group Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">Group</h4>
            <div className="mb-3 flex-shrink-0">
              <select
                value={selectedPart}
                onChange={(e) => {
                  setSelectedPart(e.target.value);
                  setSelectedGroup('');
                }}
                className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text mb-3"
              >
                <option value="">Select Part</option>
                {distinctParts.map(part => (
                  <option key={part} value={part}>{part}</option>
                ))}
              </select>
            </div>
            {selectedPart && (
              <>
                <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
                  {(workingGroupOrders[selectedPart] || savedGroupOrders[selectedPart] || groupsForPart).map((group, index) => (
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
                      <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
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

          {/* Variable Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">Variable</h4>
            <div className="mb-3 flex-shrink-0">
              <select
                value={selectedPart}
                onChange={(e) => {
                  setSelectedPart(e.target.value);
                  setSelectedGroup('');
                }}
                className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text mb-2"
              >
                <option value="">Select Part</option>
                {distinctParts.map(part => (
                  <option key={part} value={part}>{part}</option>
                ))}
              </select>
              {selectedPart && (
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text"
                >
                  <option value="">Select Group</option>
                  {groupsForPart.map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              )}
            </div>
            {selectedPart && selectedGroup && (
              <>
                <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
                  {(workingVariableOrders[`${selectedPart}|${selectedGroup}`] || savedVariableOrders[`${selectedPart}|${selectedGroup}`] || variablesForPartAndGroup).map((variable, index) => (
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
                      <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                      <span className="text-ag-dark-text flex-1 truncate">{variable}</span>
                    </div>
                  ))}
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

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-ag-dark-border flex-shrink-0">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isOrderEnabled}
              onChange={(e) => {
                // Use saved orders if available, otherwise use working orders
                const order: OrderSortOrder = {
                  partOrder: savedPartOrder.length > 0 ? savedPartOrder : workingPartOrder,
                  sectionOrder: savedSectionOrder.length > 0 ? savedSectionOrder : workingSectionOrder,
                  groupOrders: Object.keys(savedGroupOrders).length > 0 ? savedGroupOrders : workingGroupOrders,
                  variableOrders: Object.keys(savedVariableOrders).length > 0 ? savedVariableOrders : workingVariableOrders
                };
                onApplyOrder(e.target.checked, order);
              }}
              className="w-4 h-4 text-ag-dark-accent bg-ag-dark-bg border-ag-dark-border rounded focus:ring-ag-dark-accent"
            />
            <span className="text-sm text-ag-dark-text">Enable default order</span>
          </label>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
