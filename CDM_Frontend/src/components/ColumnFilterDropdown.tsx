import React, { useState, useRef, useEffect } from 'react';
import { Filter, ArrowUpDown, X, Check, GripVertical } from 'lucide-react';

interface ColumnFilterDropdownProps {
  column: {
    key: string;
    title: string;
    sortable?: boolean;
    filterable?: boolean;
  };
  data: Record<string, any>[];
  isOpen: boolean;
  onClose: () => void;
  onFilter: (filters: string[]) => void;
  onSort: (type: 'custom' | 'none') => void;
  onCustomSort?: (order: string[]) => void;
  currentFilters: string[];
  currentSort: { type: 'custom' | 'none'; customOrder?: string[] };
  position: { top: number; left: number };
  availableOptions?: string[];
}

export const ColumnFilterDropdown: React.FC<ColumnFilterDropdownProps> = ({
  column,
  data,
  isOpen,
  onClose,
  onFilter,
  onSort,
  onCustomSort,
  currentFilters,
  currentSort,
  position,
  availableOptions
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'filter' | 'sort'>('filter');
  const [tempFilters, setTempFilters] = useState<string[]>(currentFilters);
  const [customSortOrder, setCustomSortOrder] = useState<string[]>(
    currentSort.customOrder || []
  );
  const [workingSortOrder, setWorkingSortOrder] = useState<string[]>(
    currentSort.customOrder || []
  );
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [searchText, setSearchText] = useState<string>('');

  // Get distinct values for the column - use availableOptions if provided, otherwise calculate from data
  const allDistinctValues = availableOptions && availableOptions.length > 0 
    ? availableOptions 
    : [...new Set(data.map(item => String(item[column.key] || '')))].filter(Boolean);
  
  // Filter distinct values based on search text
  const distinctValues = searchText.trim() === ''
    ? allDistinctValues
    : allDistinctValues.filter(value => 
        value.toLowerCase().includes(searchText.toLowerCase())
      );
  

  // Initialize custom sort order if empty
  useEffect(() => {
    if (customSortOrder.length === 0 && allDistinctValues.length > 0) {
      setCustomSortOrder([...allDistinctValues]);
      setWorkingSortOrder([...allDistinctValues]);
    }
  }, [allDistinctValues, customSortOrder.length]);

  // Initialize working sort order when dropdown opens (only once per session)
  useEffect(() => {
    if (isOpen && workingSortOrder.length === 0) {
      const initialOrder = customSortOrder.length > 0 ? customSortOrder : allDistinctValues;
      console.log('🚀 INITIALIZING WORKING ORDER:', {
        customOrder: customSortOrder,
        distinctValues: allDistinctValues,
        initialOrder: initialOrder,
        column: column.key
      });
      setWorkingSortOrder([...initialOrder]);
    }
  }, [isOpen, customSortOrder, allDistinctValues, workingSortOrder.length]);

  // Reset search text when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchText('');
    }
  }, [isOpen]);

  // Reset temp filters when dropdown opens
  useEffect(() => {
    setTempFilters(currentFilters);
  }, [currentFilters, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isNumericColumn = ['relationships', 'variants', 'variables'].includes(column.key);

  const handleFilterChange = (value: string, checked: boolean) => {
    if (checked) {
      setTempFilters([...tempFilters, value]);
    } else {
      setTempFilters(tempFilters.filter(f => f !== value));
    }
  };

  const handleApplyFilters = () => {
    onFilter(tempFilters);
    onClose();
  };

  const handleClearFilters = () => {
    setTempFilters([]);
    onFilter([]);
  };

  const handleSelectAll = () => {
    setTempFilters([...allDistinctValues]);
  };

  const handleToggleSelectAll = () => {
    if (tempFilters.length === allDistinctValues.length) {
      handleClearFilters();
    } else {
      handleSelectAll();
    }
  };

  const handleSort = (type: 'custom' | 'none') => {
    if (type === 'custom' && onCustomSort) {
      // Use working order if it has been modified, otherwise use custom order
      const orderToUse = workingSortOrder.length > 0 ? workingSortOrder : customSortOrder;
      onCustomSort([...orderToUse]);
    }
    onSort(type);
    onClose();
  };

  const handleApplyCustomSort = () => {
    console.log('🎯 APPLYING CUSTOM SORT:', {
      workingOrder: workingSortOrder,
      customOrder: customSortOrder,
      column: column.key,
      workingOrderLength: workingSortOrder.length,
      customOrderLength: customSortOrder.length
    });
    
    // Ensure we have a valid working order
    if (workingSortOrder.length === 0) {
      console.error('❌ Working order is empty!');
      return;
    }
    
    if (onCustomSort) {
      console.log('📤 Sending to DataGrid:', [...workingSortOrder]);
      onCustomSort([...workingSortOrder]); // Use working order, not the original
    }
    setCustomSortOrder([...workingSortOrder]); // Update the actual custom order
    onSort('custom');
    onClose();
  };

  const handleDragStart = (value: string) => {
    setDraggedItem(value);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedItem) {
      const draggedIndex = workingSortOrder.indexOf(draggedItem);
      
      console.log('🎯 DRAG DROP:', {
        draggedItem,
        draggedIndex,
        dropIndex,
        currentOrder: workingSortOrder
      });
      
      if (draggedIndex !== -1 && draggedIndex !== dropIndex) {
        const newOrder = [...workingSortOrder];
        const [removed] = newOrder.splice(draggedIndex, 1);
        newOrder.splice(dropIndex, 0, removed);
        
        console.log('🔄 NEW ORDER:', newOrder);
        setWorkingSortOrder(newOrder); // Only update working order, not the actual custom order
      }
    }
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  return (
    <div
      ref={dropdownRef}
      className="fixed bg-ag-dark-surface border border-ag-dark-border rounded-lg shadow-lg z-50 w-80"
      style={{
        top: position.top,
        left: Math.max(0, Math.min(position.left, window.innerWidth - 320))
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-ag-dark-border">
        <h3 className="text-sm font-medium text-ag-dark-text">{column.title}</h3>
        <button
          onClick={onClose}
          className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      {!isNumericColumn && (
        <div className="flex border-b border-ag-dark-border">
          <button
            onClick={() => setActiveTab('filter')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'filter'
                ? 'text-ag-dark-accent border-b-2 border-ag-dark-accent'
                : 'text-ag-dark-text-secondary hover:text-ag-dark-text'
            }`}
          >
            Filter
          </button>
          <button
            onClick={() => setActiveTab('sort')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'sort'
                ? 'text-ag-dark-accent border-b-2 border-ag-dark-accent'
                : 'text-ag-dark-text-secondary hover:text-ag-dark-text'
            }`}
          >
            Sort
          </button>
        </div>
      )}

      {/* Content */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {/* Filter Tab */}
        {!isNumericColumn && activeTab === 'filter' && (
          <div className="space-y-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search values..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
              />
              <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ag-dark-text-secondary" />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-ag-dark-text">
                {searchText.trim() ? `${distinctValues.length} matches` : `${allDistinctValues.length} values`}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleToggleSelectAll}
                  className="text-xs text-ag-dark-text-secondary hover:text-ag-dark-text"
                >
                  {tempFilters.length === allDistinctValues.length ? 'Clear All' : 'Select All'}
                </button>
                <button
                  onClick={handleClearFilters}
                  className="text-xs text-ag-dark-text-secondary hover:text-ag-dark-text"
                >
                  Clear All
                </button>
              </div>
            </div>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {distinctValues.map((value) => (
                <label
                  key={value}
                  className="flex items-center gap-2 text-sm text-ag-dark-text hover:bg-ag-dark-bg p-2 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={tempFilters.includes(value)}
                    onChange={(e) => handleFilterChange(value, e.target.checked)}
                    className="rounded border-ag-dark-border bg-ag-dark-bg text-ag-dark-accent focus:ring-ag-dark-accent focus:ring-2 focus:ring-offset-0"
                  />
                  <span className="truncate">{value}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2 pt-2 border-t border-ag-dark-border">
              <button
                onClick={handleApplyFilters}
                className="flex-1 bg-ag-dark-accent text-white py-2 px-3 rounded text-sm hover:bg-ag-dark-accent-hover transition-colors"
              >
                Apply Filter
              </button>
            </div>
          </div>
        )}

        {/* Sort Tab */}
        {(isNumericColumn || activeTab === 'sort') && (
          <div className="space-y-3">
            <span className="text-sm text-ag-dark-text">Custom Sort</span>
            
            <div className="space-y-2">
              {!isNumericColumn && (
                <div className="border-t border-ag-dark-border pt-3">

                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    <span className="text-xs text-ag-dark-text-secondary">Drag to reorder:</span>
                    {console.log('🎨 RENDERING WORKING ORDER:', { workingSortOrder, column: column.key })}
                    {workingSortOrder.map((value, index) => (
                      <div
                        key={value}
                        draggable
                        onDragStart={() => handleDragStart(value)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                          draggedItem === value
                            ? 'bg-ag-dark-accent bg-opacity-20'
                            : dragOverIndex === index
                            ? 'bg-ag-dark-accent bg-opacity-10'
                            : 'hover:bg-ag-dark-bg'
                        }`}
                      >
                        <GripVertical className="w-3 h-3 text-ag-dark-text-secondary" />
                        <span className="text-xs text-ag-dark-text-secondary w-4">{index + 1}.</span>
                        <span className="text-ag-dark-text truncate flex-1">{value}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleApplyCustomSort}
                    className="w-full mt-3 bg-ag-dark-accent text-white py-2 px-3 rounded text-sm hover:bg-ag-dark-accent-hover transition-colors"
                  >
                    Apply Custom Order
                  </button>
                </div>
              )}

              <button
                onClick={() => handleSort('none')}
                className={`w-full flex items-center justify-center gap-2 p-2 rounded text-sm transition-colors ${
                  currentSort.type === 'none'
                    ? 'bg-ag-dark-accent text-white'
                    : 'text-ag-dark-text hover:bg-ag-dark-bg'
                }`}
              >
                <X className="w-4 h-4" />
                Remove Sort
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};