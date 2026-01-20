import React, { useState, useEffect, useRef } from 'react';
import { X, GripVertical, Maximize2, Minimize2 } from 'lucide-react';
import type { ListData } from '../data/listsData';

interface OrderSortOrder {
  setOrder: string[];
  groupingOrders: Record<string, string[]>; // key: set, value: array of groupings
  listOrders: Record<string, string[]>; // key: "set|grouping", value: array of lists
  sectorOrder?: string[]; // Independent S column order
  domainOrder?: string[]; // Independent D column order
  countryOrder?: string[]; // Independent C column order
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
  const [workingSectorOrder, setWorkingSectorOrder] = useState<string[]>([]);
  const [workingDomainOrder, setWorkingDomainOrder] = useState<string[]>([]);
  const [workingCountryOrder, setWorkingCountryOrder] = useState<string[]>([]);
  // Click-based selections (cascading filters)
  const [selectedSet, setSelectedSet] = useState<string>('');
  const [selectedGrouping, setSelectedGrouping] = useState<string>('');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'set' | 'grouping' | 'list' | 'sector' | 'domain' | 'country' | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number>(-1);
  const [savedSetOrder, setSavedSetOrder] = useState<string[]>([]);
  const [savedGroupingOrders, setSavedGroupingOrders] = useState<Record<string, string[]>>({});
  const [savedListOrders, setSavedListOrders] = useState<Record<string, string[]>>({});
  const [savedSectorOrder, setSavedSectorOrder] = useState<string[]>([]);
  const [savedDomainOrder, setSavedDomainOrder] = useState<string[]>([]);
  const [savedCountryOrder, setSavedCountryOrder] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  

  // Get distinct values
  const distinctSets = Array.from(new Set(listData.map(l => l.set).filter(Boolean))).sort();
  const groupingsForSet = selectedSet
    ? Array.from(new Set(listData.filter(l => l.set === selectedSet).map(l => l.grouping).filter(Boolean))).sort()
    : [];
  const listsForSetAndGrouping = selectedSet && selectedGrouping
    ? Array.from(new Set(listData.filter(l => l.set === selectedSet && l.grouping === selectedGrouping).map(l => l.list).filter(Boolean))).sort()
    : [];
  
  // Get S, D, C values from grid data (including "ALL" and multiple values like "Finance, Healthcare")
  // Extract unique values exactly as they appear in the grid
  const distinctSectors = Array.from(new Set(listData.map(l => String(l.sector || '').trim()).filter(Boolean))).sort();
  const distinctDomains = Array.from(new Set(listData.map(l => String(l.domain || '').trim()).filter(Boolean))).sort();
  const distinctCountries = Array.from(new Set(listData.map(l => String(l.country || '').trim()).filter(Boolean))).sort();

  // Initialize working orders from props or create defaults - only once when modal opens
  // CRITICAL: Order should NEVER change unless user explicitly modifies it via drag-and-drop
  // New items should be appended to the end, edits should stay in place, deletes should remove without affecting others
  useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false);
      return;
    }
    
    if (!isInitialized) {
      if (orderSortOrder) {
        // Preserve saved set order, append new sets
        const savedSetOrder = orderSortOrder.setOrder && orderSortOrder.setOrder.length > 0 
          ? [...orderSortOrder.setOrder] 
          : [];
        const validSavedSets = savedSetOrder.filter(set => distinctSets.includes(set));
        const newSets = distinctSets.filter(set => !savedSetOrder.includes(set));
        const setOrder = [...validSavedSets, ...newSets];
        
        // Preserve saved grouping orders, append new groupings
        const groupingOrders: Record<string, string[]> = {};
        const savedGroupingOrders = orderSortOrder.groupingOrders || {};
        distinctSets.forEach(set => {
          const groupingsForSet = Array.from(new Set(listData.filter(l => l.set === set).map(l => l.grouping).filter(Boolean))).sort();
          const savedGroupingOrder = savedGroupingOrders[set] || [];
          const validSavedGroupings = savedGroupingOrder.filter(grouping => groupingsForSet.includes(grouping));
          const newGroupings = groupingsForSet.filter(grouping => !savedGroupingOrder.includes(grouping));
          groupingOrders[set] = [...validSavedGroupings, ...newGroupings];
        });
        
        // Preserve saved list orders, append new lists
        const listOrders: Record<string, string[]> = {};
        const savedListOrders = orderSortOrder.listOrders || {};
        distinctSets.forEach(set => {
          const groupingsForSet = Array.from(new Set(listData.filter(l => l.set === set).map(l => l.grouping).filter(Boolean))).sort();
          groupingsForSet.forEach(grouping => {
            const key = `${set}|${grouping}`;
            const listsForSetGrouping = Array.from(new Set(listData.filter(l => l.set === set && l.grouping === grouping).map(l => l.list).filter(Boolean))).sort();
            const savedListOrder = savedListOrders[key] || [];
            const validSavedLists = savedListOrder.filter(list => listsForSetGrouping.includes(list));
            const newLists = listsForSetGrouping.filter(list => !savedListOrder.includes(list));
            listOrders[key] = [...validSavedLists, ...newLists];
          });
        });
        
        setWorkingSetOrder(setOrder);
        setSavedSetOrder(setOrder);
        setWorkingGroupingOrders(groupingOrders);
        setSavedGroupingOrders(groupingOrders);
        setWorkingListOrders(listOrders);
        setSavedListOrders(listOrders);
        
        // Handle S, D, C orders - preserve existing order, append new values from grid data
        // Use values exactly as they appear in the grid (including "ALL" and multiple values)
        const currentDistinctSectors = Array.from(new Set(listData.map(l => String(l.sector || '').trim()).filter(Boolean))).sort();
        const currentDistinctDomains = Array.from(new Set(listData.map(l => String(l.domain || '').trim()).filter(Boolean))).sort();
        const currentDistinctCountries = Array.from(new Set(listData.map(l => String(l.country || '').trim()).filter(Boolean))).sort();
        
        // Sector order
        const savedSectorOrder = orderSortOrder.sectorOrder && orderSortOrder.sectorOrder.length > 0 
          ? [...orderSortOrder.sectorOrder] 
          : [];
        const validSavedSectors = savedSectorOrder.filter(sector => currentDistinctSectors.includes(sector));
        const newSectors = currentDistinctSectors.filter(sector => !savedSectorOrder.includes(sector));
        const sectorOrder = [...validSavedSectors, ...newSectors];
        
        // Domain order
        const savedDomainOrder = orderSortOrder.domainOrder && orderSortOrder.domainOrder.length > 0 
          ? [...orderSortOrder.domainOrder] 
          : [];
        const validSavedDomains = savedDomainOrder.filter(domain => currentDistinctDomains.includes(domain));
        const newDomains = currentDistinctDomains.filter(domain => !savedDomainOrder.includes(domain));
        const domainOrder = [...validSavedDomains, ...newDomains];
        
        // Country order
        const savedCountryOrder = orderSortOrder.countryOrder && orderSortOrder.countryOrder.length > 0 
          ? [...orderSortOrder.countryOrder] 
          : [];
        const validSavedCountries = savedCountryOrder.filter(country => currentDistinctCountries.includes(country));
        const newCountries = currentDistinctCountries.filter(country => !savedCountryOrder.includes(country));
        const countryOrder = [...validSavedCountries, ...newCountries];
        
        setWorkingSectorOrder(sectorOrder);
        setSavedSectorOrder(sectorOrder);
        setWorkingDomainOrder(domainOrder);
        setSavedDomainOrder(domainOrder);
        setWorkingCountryOrder(countryOrder);
        setSavedCountryOrder(countryOrder);
      } else {
        // Create default alphabetical orders (only if no saved order exists)
        setWorkingSetOrder(distinctSets);
        setSavedSetOrder(distinctSets);
        setWorkingGroupingOrders({});
        setSavedGroupingOrders({});
        setWorkingListOrders({});
        setSavedListOrders({});
        
        // Initialize S, D, C with values from grid data (including "ALL" and multiple values)
        setWorkingSectorOrder(distinctSectors);
        setSavedSectorOrder(distinctSectors);
        setWorkingDomainOrder(distinctDomains);
        setSavedDomainOrder(distinctDomains);
        setWorkingCountryOrder(distinctCountries);
        setSavedCountryOrder(distinctCountries);
      }
      setIsInitialized(true);
    }
  }, [isOpen, orderSortOrder, isInitialized, listData, distinctSectors, distinctDomains, distinctCountries]);

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

  // Initialize working order for lists when set+grouping are selected (from column clicks)
  useEffect(() => {
    if (selectedSet && selectedGrouping) {
      const key = `${selectedSet}|${selectedGrouping}`;
      if (!workingListOrders[key]) {
        const listsForSelected = Array.from(new Set(listData.filter(l => l.set === selectedSet && l.grouping === selectedGrouping).map(l => l.list).filter(Boolean))).sort();
        const savedOrder = savedListOrders[key];
        if (savedOrder && savedOrder.length > 0) {
          setWorkingListOrders(prev => ({ ...prev, [key]: [...savedOrder] }));
        } else {
          setWorkingListOrders(prev => ({ ...prev, [key]: listsForSelected }));
        }
      }
    }
  }, [selectedSet, selectedGrouping, listData, savedListOrders, workingListOrders]);

  const handleDragStart = (item: string, type: 'set' | 'grouping' | 'list' | 'sector' | 'domain' | 'country') => {
    setDraggedItem(item);
    setDragType(type);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number, type: 'set' | 'grouping' | 'list' | 'sector' | 'domain' | 'country') => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || dragType !== type) {
      setDraggedItem(null);
      setDragType(null);
      setDragOverIndex(-1);
      return;
    }

    if (type === 'sector') {
      const newOrder = [...workingSectorOrder];
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
      setWorkingSectorOrder(newOrder);
    } else if (type === 'domain') {
      const newOrder = [...workingDomainOrder];
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
      setWorkingDomainOrder(newOrder);
    } else if (type === 'country') {
      const newOrder = [...workingCountryOrder];
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
      setWorkingCountryOrder(newOrder);
    } else if (type === 'set') {
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
    } else if (type === 'list' && selectedSet && selectedGrouping) {
      const key = `${selectedSet}|${selectedGrouping}`;
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
      listOrders: workingListOrders,
      sectorOrder: workingSectorOrder,
      domainOrder: workingDomainOrder,
      countryOrder: workingCountryOrder
    };
    
    // Update saved orders to match working orders
    setSavedSetOrder([...workingSetOrder]);
    setSavedGroupingOrders({ ...workingGroupingOrders });
    setSavedListOrders({ ...workingListOrders });
    setSavedSectorOrder([...workingSectorOrder]);
    setSavedDomainOrder([...workingDomainOrder]);
    setSavedCountryOrder([...workingCountryOrder]);
    
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
            : 'max-w-[120rem] w-full mx-4 max-h-[90vh]'
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


        {/* Six Column Layout (S, D, C, Set, Grouping, List) */}
        <div className={`grid grid-cols-6 gap-4 mb-6 ${isExpanded ? 'flex-1 min-h-0 overflow-hidden' : ''}`}>
          {/* Sector Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">S</h4>
            <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
              {workingSectorOrder.map((sector, index) => (
                <div
                  key={sector}
                  draggable
                  onDragStart={() => handleDragStart(sector, 'sector')}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index, 'sector')}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                    draggedItem === sector && dragType === 'sector'
                      ? 'bg-ag-dark-accent bg-opacity-20'
                      : dragOverIndex === index && dragType === 'sector'
                      ? 'bg-ag-dark-accent bg-opacity-10'
                      : 'hover:bg-ag-dark-surface'
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                  <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                  <span className="text-ag-dark-text flex-1 truncate">{sector}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Domain Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">D</h4>
            <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
              {workingDomainOrder.map((domain, index) => (
                <div
                  key={domain}
                  draggable
                  onDragStart={() => handleDragStart(domain, 'domain')}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index, 'domain')}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                    draggedItem === domain && dragType === 'domain'
                      ? 'bg-ag-dark-accent bg-opacity-20'
                      : dragOverIndex === index && dragType === 'domain'
                      ? 'bg-ag-dark-accent bg-opacity-10'
                      : 'hover:bg-ag-dark-surface'
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                  <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                  <span className="text-ag-dark-text flex-1 truncate">{domain}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Country Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">C</h4>
            <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
              {workingCountryOrder.map((country, index) => (
                <div
                  key={country}
                  draggable
                  onDragStart={() => handleDragStart(country, 'country')}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index, 'country')}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                    draggedItem === country && dragType === 'country'
                      ? 'bg-ag-dark-accent bg-opacity-20'
                      : dragOverIndex === index && dragType === 'country'
                      ? 'bg-ag-dark-accent bg-opacity-10'
                      : 'hover:bg-ag-dark-surface'
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                  <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                  <span className="text-ag-dark-text flex-1 truncate">{country}</span>
                </div>
              ))}
            </div>
          </div>

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
                  onClick={(e) => {
                    // Only handle click if not dragging
                    if (draggedItem === null) {
                      e.stopPropagation();
                      if (selectedSet === set) {
                        // Deselect if clicking the same item
                        setSelectedSet('');
                        setSelectedGrouping('');
                      } else {
                        // Select this set and reset dependent selections
                        setSelectedSet(set);
                        setSelectedGrouping('');
                      }
                    }
                  }}
                  className={`flex items-center gap-2 p-2 rounded text-sm cursor-pointer transition-colors ${
                    selectedSet === set
                      ? 'bg-ag-dark-accent bg-opacity-30 border-2 border-ag-dark-accent'
                      : draggedItem === set && dragType === 'set'
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
            {selectedSet ? (
              <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
                {(workingGroupingOrders[selectedSet] || savedGroupingOrders[selectedSet] || groupingsForSet).map((grouping, index) => (
                  <div
                    key={grouping}
                    draggable
                    onDragStart={() => handleDragStart(grouping, 'grouping')}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index, 'grouping')}
                    onDragEnd={handleDragEnd}
                    onClick={(e) => {
                      // Only handle click if not dragging
                      if (draggedItem === null) {
                        e.stopPropagation();
                        if (selectedGrouping === grouping) {
                          // Deselect if clicking the same item
                          setSelectedGrouping('');
                        } else {
                          // Select this grouping
                          setSelectedGrouping(grouping);
                        }
                      }
                    }}
                    className={`flex items-center gap-2 p-2 rounded text-sm cursor-pointer transition-colors ${
                      selectedGrouping === grouping
                        ? 'bg-ag-dark-accent bg-opacity-30 border-2 border-ag-dark-accent'
                        : draggedItem === grouping && dragType === 'grouping'
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
            ) : (
              <div className="flex-1 flex items-center justify-center text-ag-dark-text-secondary text-sm">
                Click a Set to see Groupings
              </div>
            )}
          </div>

          {/* List Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">List</h4>
            {selectedSet && selectedGrouping ? (
              <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
                {(workingListOrders[`${selectedSet}|${selectedGrouping}`] || savedListOrders[`${selectedSet}|${selectedGrouping}`] || listsForSetAndGrouping).map((list, index) => (
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
            ) : (
              <div className="flex-1 flex items-center justify-center text-ag-dark-text-secondary text-sm">
                {!selectedSet ? 'Click a Set to see Lists' : 'Click a Grouping to see Lists'}
              </div>
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

