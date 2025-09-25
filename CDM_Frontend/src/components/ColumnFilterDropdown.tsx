import React, { useState, useRef, useEffect } from 'react';
import { Filter, ArrowUpDown, ArrowUp, ArrowDown, X, Check, GripVertical } from 'lucide-react';

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
  onSort: (type: 'asc' | 'desc' | 'custom' | 'none') => void;
  onCustomSort?: (order: string[]) => void;
  currentFilters: string[];
  currentSort: { type: 'asc' | 'desc' | 'custom' | 'none'; customOrder?: string[] };
  position: { top: number; left: number };
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
  position
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'filter' | 'sort'>('filter');
  const [tempFilters, setTempFilters] = useState<string[]>(currentFilters);
  const [customSortOrder, setCustomSortOrder] = useState<string[]>(
    currentSort.customOrder || []
  );
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  // Get distinct values for the column
  const distinctValues = [...new Set(data.map(item => String(item[column.key] || '')))].filter(Boolean);

  // Initialize custom sort order if empty
  useEffect(() => {
    if (customSortOrder.length === 0 && distinctValues.length > 0) {
      setCustomSortOrder(distinctValues);
    }
  }, [distinctValues, customSortOrder.length]);

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

  const handleSort = (type: 'asc' | 'desc' | 'custom' | 'none') => {
    if (type === 'custom' && onCustomSort) {
      onCustomSort(customSortOrder);
    }
    onSort(type);
    onClose();
  };

  const handleDragStart = (value: string) => {
    setDraggedItem(value);
  };

  const handleDragOver = (e: React.DragEvent, targetValue: string) => {
    e.preventDefault();
    if (draggedItem && draggedItem !== targetValue) {
      const draggedIndex = customSortOrder.indexOf(draggedItem);
      const targetIndex = customSortOrder.indexOf(targetValue);
      
      const newOrder = [...customSortOrder];
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedItem);
      
      setCustomSortOrder(newOrder);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
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
      <div className="p-4 max-h-80 overflow-y-auto">
        {/* Filter Tab */}
        {!isNumericColumn && activeTab === 'filter' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ag-dark-text">Select values to show:</span>
              <button
                onClick={handleClearFilters}
                className="text-xs text-ag-dark-text-secondary hover:text-ag-dark-text"
              >
                Clear All
              </button>
            </div>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {distinctValues.map((value) => (
                <label
                  key={value}
                  className="flex items-center gap-2 text-sm text-ag-dark-text hover:bg-ag-dark-bg p-2 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={tempFilters.length === 0 || tempFilters.includes(value)}
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
            <span className="text-sm text-ag-dark-text">Sort options:</span>
            
            <div className="space-y-2">
              <button
                onClick={() => handleSort('asc')}
                className={`w-full flex items-center gap-2 p-2 rounded text-sm transition-colors ${
                  currentSort.type === 'asc'
                    ? 'bg-ag-dark-accent text-white'
                    : 'text-ag-dark-text hover:bg-ag-dark-bg'
                }`}
              >
                <ArrowUp className="w-4 h-4" />
                {isNumericColumn ? 'Low to High' : 'A to Z'}
              </button>
              
              <button
                onClick={() => handleSort('desc')}
                className={`w-full flex items-center gap-2 p-2 rounded text-sm transition-colors ${
                  currentSort.type === 'desc'
                    ? 'bg-ag-dark-accent text-white'
                    : 'text-ag-dark-text hover:bg-ag-dark-bg'
                }`}
              >
                <ArrowDown className="w-4 h-4" />
                {isNumericColumn ? 'High to Low' : 'Z to A'}
              </button>

              {!isNumericColumn && (
                <div className="border-t border-ag-dark-border pt-3">
                  <button
                    onClick={() => handleSort('custom')}
                    className={`w-full flex items-center gap-2 p-2 rounded text-sm transition-colors mb-3 ${
                      currentSort.type === 'custom'
                        ? 'bg-ag-dark-accent text-white'
                        : 'text-ag-dark-text hover:bg-ag-dark-bg'
                    }`}
                  >
                    <GripVertical className="w-4 h-4" />
                    Custom Order
                  </button>

                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    <span className="text-xs text-ag-dark-text-secondary">Drag to reorder:</span>
                    {customSortOrder.map((value, index) => (
                      <div
                        key={value}
                        draggable
                        onDragStart={() => handleDragStart(value)}
                        onDragOver={(e) => handleDragOver(e, value)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                          draggedItem === value
                            ? 'bg-ag-dark-accent bg-opacity-20'
                            : 'hover:bg-ag-dark-bg'
                        }`}
                      >
                        <GripVertical className="w-3 h-3 text-ag-dark-text-secondary" />
                        <span className="text-xs text-ag-dark-text-secondary">{index + 1}.</span>
                        <span className="text-ag-dark-text truncate">{value}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleSort('custom')}
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