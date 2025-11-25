import React, { useState, useEffect, useRef } from 'react';
import { X, GripVertical, Maximize2, Minimize2 } from 'lucide-react';
import type { ListData } from '../data/listsData';

interface OrderSortOrder {
  setOrder: string[];
  groupingOrders: Record<string, string[]>; // key: set, value: array of groupings
  listOrders: Record<string, string[]>; // key: "set|grouping", value: array of lists
}

interface ListsOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveOrder: (order: OrderSortOrder) => void;
  listData: ListData[];
  orderSortOrder?: OrderSortOrder;
}

export const ListsOrderModal: React.FC<ListsOrderModalProps> = ({
  isOpen,
  onClose,
  onSaveOrder,
  listData,
  orderSortOrder
}) => {
  const [workingSetOrder, setWorkingSetOrder] = useState<string[]>([]);
  const [workingGroupingOrders, setWorkingGroupingOrders] = useState<Record<string, string[]>>({});
  const [workingListOrders, setWorkingListOrders] = useState<Record<string, string[]>>({});
  const [selectedSet, setSelectedSet] = useState<string>('');
  // Separate state for List column set/grouping selection
  const [selectedListSet, setSelectedListSet] = useState<string>('');
  const [selectedListGrouping, setSelectedListGrouping] = useState<string>('');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'set' | 'grouping' | 'list' | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number>(-1);
  const [savedSetOrder, setSavedSetOrder] = useState<string[]>([]);
  const [savedGroupingOrders, setSavedGroupingOrders] = useState<Record<string, string[]>>({});
  const [savedListOrders, setSavedListOrders] = useState<Record<string, string[]>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Get distinct values
  const distinctSets = Array.from(new Set(listData.map(l => l.set).filter(Boolean))).sort();
  const groupingsForSet = selectedSet
    ? Array.from(new Set(listData.filter(l => l.set === selectedSet).map(l => l.grouping).filter(Boolean))).sort()
    : [];
  const listsForSetAndGrouping = selectedListSet && selectedListGrouping
    ? Array.from(new Set(listData.filter(l => l.set === selectedListSet && l.grouping === selectedListGrouping).map(l => l.list).filter(Boolean))).sort()
    : [];

  // Initialize working orders from props or create defaults - only once when modal opens
  useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false);
      return;
    }
    
    if (!isInitialized) {
      if (orderSortOrder) {
        const setOrder = orderSortOrder.setOrder && orderSortOrder.setOrder.length > 0 ? orderSortOrder.setOrder : distinctSets;
        setWorkingSetOrder(setOrder);
        setSavedSetOrder(setOrder);
        setWorkingGroupingOrders(orderSortOrder.groupingOrders || {});
        setSavedGroupingOrders(orderSortOrder.groupingOrders || {});
        setWorkingListOrders(orderSortOrder.listOrders || {});
        setSavedListOrders(orderSortOrder.listOrders || {});
      } else {
        // Create default alphabetical orders
        setWorkingSetOrder(distinctSets);
        setSavedSetOrder(distinctSets);
        setWorkingGroupingOrders({});
        setSavedGroupingOrders({});
        setWorkingListOrders({});
        setSavedListOrders({});
      }
      setIsInitialized(true);
    }
  }, [isOpen, orderSortOrder, distinctSets, isInitialized]);

  // Initialize working order for a set when it's selected (if not already in working orders)
  useEffect(() => {
    if (selectedSet && !workingGroupingOrders[selectedSet]) {
      const groupingsForSelectedSet = Array.from(new Set(listData.filter(l => l.set === selectedSet).map(l => l.grouping).filter(Boolean))).sort();
      const savedOrder = savedGroupingOrders[selectedSet];
      if (savedOrder && savedOrder.length > 0) {
        setWorkingGroupingOrders(prev => ({ ...prev, [selectedSet]: [...savedOrder] }));
      } else {
        setWorkingGroupingOrders(prev => ({ ...prev, [selectedSet]: groupingsForSelectedSet }));
      }
    }
  }, [selectedSet, listData, savedGroupingOrders, workingGroupingOrders]);

  // Initialize working order for a set+grouping when they're selected (if not already in working orders)
  useEffect(() => {
    if (selectedListSet && selectedListGrouping) {
      const key = `${selectedListSet}|${selectedListGrouping}`;
      if (!workingListOrders[key]) {
        const listsForSelected = Array.from(new Set(listData.filter(l => l.set === selectedListSet && l.grouping === selectedListGrouping).map(l => l.list).filter(Boolean))).sort();
        const savedOrder = savedListOrders[key];
        if (savedOrder && savedOrder.length > 0) {
          setWorkingListOrders(prev => ({ ...prev, [key]: [...savedOrder] }));
        } else {
          setWorkingListOrders(prev => ({ ...prev, [key]: listsForSelected }));
        }
      }
    }
  }, [selectedListSet, selectedListGrouping, listData, savedListOrders, workingListOrders]);

  const handleDragStart = (item: string, type: 'set' | 'grouping' | 'list') => {
    setDraggedItem(item);
    setDragType(type);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number, type: 'set' | 'grouping' | 'list') => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || dragType !== type) {
      setDraggedItem(null);
      setDragType(null);
      setDragOverIndex(-1);
      return;
    }

    if (type === 'set') {
      const newOrder = [...workingSetOrder];
      const draggedIndex = newOrder.indexOf(draggedItem);
      if (draggedIndex === -1) {
        setDraggedItem(null);
        setDragType(null);
        setDragOverIndex(-1);
        return;
      }
      newOrder.splice(draggedIndex, 1);
      const insertIndex = draggedIndex < index ? index - 1 : index;
      newOrder.splice(insertIndex, 0, draggedItem);
      setWorkingSetOrder(newOrder);
    } else if (type === 'grouping' && selectedSet) {
      const currentGroupings = workingGroupingOrders[selectedSet] || savedGroupingOrders[selectedSet] || groupingsForSet;
      const newOrder = [...currentGroupings];
      const draggedIndex = newOrder.indexOf(draggedItem);
      if (draggedIndex === -1) {
        setDraggedItem(null);
        setDragType(null);
        setDragOverIndex(-1);
        return;
      }
      newOrder.splice(draggedIndex, 1);
      const insertIndex = draggedIndex < index ? index - 1 : index;
      newOrder.splice(insertIndex, 0, draggedItem);
      setWorkingGroupingOrders({ ...workingGroupingOrders, [selectedSet]: newOrder });
    } else if (type === 'list' && selectedListSet && selectedListGrouping) {
      const key = `${selectedListSet}|${selectedListGrouping}`;
      const currentLists = workingListOrders[key] || savedListOrders[key] || listsForSetAndGrouping;
      const newOrder = [...currentLists];
      const draggedIndex = newOrder.indexOf(draggedItem);
      if (draggedIndex === -1) {
        setDraggedItem(null);
        setDragType(null);
        setDragOverIndex(-1);
        return;
      }
      newOrder.splice(draggedIndex, 1);
      const insertIndex = draggedIndex < index ? index - 1 : index;
      newOrder.splice(insertIndex, 0, draggedItem);
      setWorkingListOrders({ ...workingListOrders, [key]: newOrder });
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
    // Save all current working orders (including any changes made when switching between sets/groupings)
    const order: OrderSortOrder = {
      setOrder: workingSetOrder,
      groupingOrders: workingGroupingOrders,
      listOrders: workingListOrders
    };
    
    // Update saved orders to match working orders
    setSavedSetOrder([...workingSetOrder]);
    setSavedGroupingOrders({ ...workingGroupingOrders });
    setSavedListOrders({ ...workingListOrders });
    
    // Save to parent (which will persist to localStorage)
    onSaveOrder(order);
    // Close modal after saving
    onClose();
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
            Define the sort order for Set, Grouping, and List columns. Drag items to reorder them.
            The order will be applied when enabled.
          </p>
        </div>

        {/* Three Column Layout */}
        <div className={`grid grid-cols-3 gap-4 mb-6 ${isExpanded ? 'flex-1 min-h-0 overflow-hidden' : ''}`}>
          {/* Set Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">Set</h4>
            <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
              {workingSetOrder.map((set, index) => (
                <div
                  key={set}
                  draggable
                  onDragStart={() => handleDragStart(set, 'set')}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index, 'set')}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                    draggedItem === set && dragType === 'set'
                      ? 'bg-ag-dark-accent bg-opacity-20'
                      : dragOverIndex === index && dragType === 'set'
                      ? 'bg-ag-dark-accent bg-opacity-10'
                      : 'hover:bg-ag-dark-surface'
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                  <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                  <span className="text-ag-dark-text flex-1 truncate">{set}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Grouping Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">Grouping</h4>
            <div className="mb-3 flex-shrink-0">
              <select
                value={selectedSet}
                onChange={(e) => {
                  setSelectedSet(e.target.value);
                }}
                className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text"
              >
                <option value="">Select Set</option>
                {distinctSets.map(set => (
                  <option key={set} value={set}>{set}</option>
                ))}
              </select>
            </div>
            {selectedSet && (
              <>
                <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
                  {(workingGroupingOrders[selectedSet] || savedGroupingOrders[selectedSet] || groupingsForSet).map((grouping, index) => (
                    <div
                      key={grouping}
                      draggable
                      onDragStart={() => handleDragStart(grouping, 'grouping')}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index, 'grouping')}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                        draggedItem === grouping && dragType === 'grouping'
                          ? 'bg-ag-dark-accent bg-opacity-20'
                          : dragOverIndex === index && dragType === 'grouping'
                          ? 'bg-ag-dark-accent bg-opacity-10'
                          : 'hover:bg-ag-dark-surface'
                      }`}
                    >
                      <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                      <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                      <span className="text-ag-dark-text flex-1 truncate">{grouping}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* List Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">List</h4>
            <div className="mb-3 flex-shrink-0">
              <select
                value={selectedListSet}
                onChange={(e) => {
                  const newSet = e.target.value;
                  setSelectedListSet(newSet);
                  setSelectedListGrouping('');
                }}
                className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text mb-2"
              >
                <option value="">Select Set</option>
                {distinctSets.map(set => (
                  <option key={set} value={set}>{set}</option>
                ))}
              </select>
              {selectedListSet && (
                <select
                  value={selectedListGrouping}
                  onChange={(e) => setSelectedListGrouping(e.target.value)}
                  className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text"
                >
                  <option value="">Select Grouping</option>
                  {Array.from(new Set(listData.filter(l => l.set === selectedListSet).map(l => l.grouping).filter(Boolean))).sort().map(grouping => (
                    <option key={grouping} value={grouping}>{grouping}</option>
                  ))}
                </select>
              )}
            </div>
            {selectedListSet && selectedListGrouping && (
              <>
                <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
                  {(workingListOrders[`${selectedListSet}|${selectedListGrouping}`] || savedListOrders[`${selectedListSet}|${selectedListGrouping}`] || listsForSetAndGrouping).map((list, index) => (
                    <div
                      key={list}
                      draggable
                      onDragStart={() => handleDragStart(list, 'list')}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index, 'list')}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                        draggedItem === list && dragType === 'list'
                          ? 'bg-ag-dark-accent bg-opacity-20'
                          : dragOverIndex === index && dragType === 'list'
                          ? 'bg-ag-dark-accent bg-opacity-10'
                          : 'hover:bg-ag-dark-surface'
                      }`}
                    >
                      <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                      <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                      <span className="text-ag-dark-text flex-1 truncate">{list}</span>
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

