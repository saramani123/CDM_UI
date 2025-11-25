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
  onSaveOrder: (order: OrderSortOrder) => void; // Changed: only saves order, doesn't enable/disable
  variableData: VariableData[];
  sortConfig?: any;
  orderSortOrder?: OrderSortOrder;
}

export const VariablesOrderModal: React.FC<VariablesOrderModalProps> = ({
  isOpen,
  onClose,
  onSaveOrder,
  variableData,
  orderSortOrder
}) => {
  const [workingPartOrder, setWorkingPartOrder] = useState<string[]>([]);
  const [workingSectionOrder, setWorkingSectionOrder] = useState<string[]>([]);
  const [workingGroupOrders, setWorkingGroupOrders] = useState<Record<string, string[]>>({});
  const [workingVariableOrders, setWorkingVariableOrders] = useState<Record<string, string[]>>({});
  const [selectedPart, setSelectedPart] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  // Separate state for Variable column part/group selection
  const [selectedVariablePart, setSelectedVariablePart] = useState<string>('');
  const [selectedVariableGroup, setSelectedVariableGroup] = useState<string>('');
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
  const variablesForPartAndGroup = selectedVariablePart && selectedVariableGroup
    ? Array.from(new Set(variableData.filter(v => v.part === selectedVariablePart && v.group === selectedVariableGroup).map(v => v.variable).filter(Boolean))).sort()
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

  // Initialize working order for a part when it's selected (if not already in working orders)
  useEffect(() => {
    if (selectedPart && !workingGroupOrders[selectedPart]) {
      const groupsForSelectedPart = Array.from(new Set(variableData.filter(v => v.part === selectedPart).map(v => v.group).filter(Boolean))).sort();
      const savedOrder = savedGroupOrders[selectedPart];
      if (savedOrder && savedOrder.length > 0) {
        // Use saved order if available
        setWorkingGroupOrders(prev => ({ ...prev, [selectedPart]: [...savedOrder] }));
      } else {
        // Use alphabetical order
        setWorkingGroupOrders(prev => ({ ...prev, [selectedPart]: groupsForSelectedPart }));
      }
    }
  }, [selectedPart, variableData, savedGroupOrders, workingGroupOrders]);

  // Initialize working order for a part+group when they're selected (if not already in working orders)
  useEffect(() => {
    if (selectedVariablePart && selectedVariableGroup) {
      const key = `${selectedVariablePart}|${selectedVariableGroup}`;
      if (!workingVariableOrders[key]) {
        const variablesForSelected = Array.from(new Set(variableData.filter(v => v.part === selectedVariablePart && v.group === selectedVariableGroup).map(v => v.variable).filter(Boolean))).sort();
        const savedOrder = savedVariableOrders[key];
        if (savedOrder && savedOrder.length > 0) {
          // Use saved order if available
          setWorkingVariableOrders(prev => ({ ...prev, [key]: [...savedOrder] }));
        } else {
          // Use alphabetical order
          setWorkingVariableOrders(prev => ({ ...prev, [key]: variablesForSelected }));
        }
      }
    }
  }, [selectedVariablePart, selectedVariableGroup, variableData, savedVariableOrders, workingVariableOrders]);

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
    } else if (type === 'variable' && selectedVariablePart && selectedVariableGroup) {
      const key = `${selectedVariablePart}|${selectedVariableGroup}`;
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

  const handleSaveChanges = () => {
    // Save all current working orders (including any changes made when switching between parts/groups)
    // This captures all changes across all parts and groups
    const order: OrderSortOrder = {
      partOrder: workingPartOrder,
      sectionOrder: workingSectionOrder,
      groupOrders: workingGroupOrders,
      variableOrders: workingVariableOrders
    };
    
    // Update saved orders to match working orders
    setSavedPartOrder([...workingPartOrder]);
    setSavedSectionOrder([...workingSectionOrder]);
    setSavedGroupOrders({ ...workingGroupOrders });
    setSavedVariableOrders({ ...workingVariableOrders });
    
    // Save to parent (which will persist to localStorage)
    onSaveOrder(order);
    // Close modal after saving
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
              </>
            )}
          </div>

          {/* Variable Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">Variable</h4>
            <div className="mb-3 flex-shrink-0">
              <select
                value={selectedVariablePart}
                onChange={(e) => {
                  const newPart = e.target.value;
                  setSelectedVariablePart(newPart);
                  setSelectedVariableGroup(''); // Reset group when part changes
                }}
                className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text mb-2"
              >
                <option value="">Select Part</option>
                {distinctParts.map(part => (
                  <option key={part} value={part}>{part}</option>
                ))}
              </select>
              {selectedVariablePart && (
                <select
                  value={selectedVariableGroup}
                  onChange={(e) => setSelectedVariableGroup(e.target.value)}
                  className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text"
                >
                  <option value="">Select Group</option>
                  {Array.from(new Set(variableData.filter(v => v.part === selectedVariablePart).map(v => v.group).filter(Boolean))).sort().map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              )}
            </div>
            {selectedVariablePart && selectedVariableGroup && (
              <>
                <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
                  {(workingVariableOrders[`${selectedVariablePart}|${selectedVariableGroup}`] || savedVariableOrders[`${selectedVariablePart}|${selectedVariableGroup}`] || variablesForPartAndGroup).map((variable, index) => (
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
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-4 border-t border-ag-dark-border flex-shrink-0">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveChanges}
              className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
