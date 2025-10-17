import React, { useState, useMemo } from 'react';
import { Filter, Edit, Trash2, ArrowUpDown, GripVertical } from 'lucide-react';
import { ColumnFilterDropdown } from './ColumnFilterDropdown';

interface Column {
  key: string;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  width: string;
}

interface DataGridProps {
  columns: Column[];
  data: Record<string, any>[];
  onRowSelect?: (selectedRows: Record<string, any>[]) => void;
  onEdit?: (row: Record<string, any>) => void;
  onDelete?: (row: Record<string, any>) => void;
  selectedRows?: Record<string, any>[];
  onReorder?: (newData: Record<string, any>[]) => void;
  affectedIds?: Set<string>;
  deletedDriverType?: string | null;
  customSortRules?: Array<{
    id: string;
    column: string;
    sortOn: string;
    order: 'asc' | 'desc';
  }>;
  onClearCustomSort?: () => void;
  onColumnSort?: () => void;
  isCustomSortActive?: boolean;
  isColumnSortActive?: boolean;
}

export const DataGrid: React.FC<DataGridProps> = ({
  columns,
  data,
  onRowSelect,
  onEdit,
  onDelete,
  selectedRows = [],
  onReorder,
  affectedIds = new Set(),
  deletedDriverType = null,
  customSortRules = [],
  onClearCustomSort,
  onColumnSort,
  isCustomSortActive = false,
  isColumnSortActive = false
}) => {
  console.log('🔍 DataGrid - received affectedIds:', Array.from(affectedIds));
  console.log('🔍 DataGrid - received deletedDriverType:', deletedDriverType);
  const [sortConfig, setSortConfig] = useState<{
    key: string; 
    type: 'custom' | 'none';
    customOrder?: string[];
  } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [localSelectedRows, setLocalSelectedRows] = useState<Record<string, any>[]>(selectedRows);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [draggedRow, setDraggedRow] = useState<Record<string, any> | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Sync local selection state with prop changes
  React.useEffect(() => {
    setLocalSelectedRows(selectedRows);
  }, [selectedRows]);

  const handleColumnHeaderClick = (column: Column, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + window.scrollY + 5,
      left: rect.left + window.scrollX
    });
    setOpenDropdown(column.key);
    
    // Trigger column sort callback if provided
    if (onColumnSort) {
      onColumnSort();
    }
  };

  const handleColumnFilter = (columnKey: string, filterValues: string[]) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: filterValues
    }));
  };

  const handleColumnSort = (columnKey: string, type: 'custom' | 'none') => {
    if (type === 'none') {
      setSortConfig(null);
    } else {
      // For custom sort, don't overwrite the sortConfig - it should already be set by handleCustomSort
      if (type === 'custom') {
        console.log('🎯 HANDLE COLUMN SORT - CUSTOM:', { columnKey, currentSortConfig: sortConfig });
        // Don't modify the sortConfig for custom sort - it's already set by handleCustomSort
        return;
      }
      setSortConfig({
        key: columnKey,
        type,
        customOrder: sortConfig?.key === columnKey ? sortConfig.customOrder : undefined
      });
    }
  };

  const handleCustomSort = (columnKey: string, customOrder: string[]) => {
    console.log('📊 DATAGRID RECEIVED:', {
      columnKey,
      customOrder,
      customOrderLength: customOrder.length,
      previousSortConfig: sortConfig
    });
    
    const newSortConfig = {
      key: columnKey,
      type: 'custom' as const,
      customOrder
    };
    
    console.log('📊 SETTING SORT CONFIG:', newSortConfig);
    setSortConfig(newSortConfig);
    
    // Add a small delay to see if the state is being set correctly
    setTimeout(() => {
      console.log('📊 SORT CONFIG AFTER SET:', sortConfig);
    }, 100);
  };

  const handleFilter = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleClearAllFilters = () => {
    setFilters({});
    setColumnFilters({});
    setSortConfig(null);
    onClearCustomSort?.();
    // Note: Column sort state is managed by parent component
  };

  const hasActiveFilters = Object.keys(filters).length > 0 || Object.keys(columnFilters).length > 0 || sortConfig !== null || customSortRules.length > 0 || isCustomSortActive || isColumnSortActive;

  const filteredAndSortedData = useMemo(() => {
    console.log('🔄 USEMEMO TRIGGERED:', { sortConfig, dataLength: data.length, affectedIds: affectedIds.size, affectedIdsArray: Array.from(affectedIds), customSortRules: customSortRules.length });
    
    let processedData = [...data];

    // Apply text filters
    Object.entries(filters).forEach(([key, filterValue]) => {
      if (filterValue) {
        processedData = processedData.filter(item =>
          String(item[key]).toLowerCase().includes(filterValue.toLowerCase())
        );
      }
    });

    // Apply column filters
    Object.entries(columnFilters).forEach(([key, filterValues]) => {
      if (filterValues.length > 0) {
        // Special handling for Sector, Domain, Country columns
        if (['sector', 'domain', 'country'].includes(key)) {
          processedData = processedData.filter(item => {
            const itemValue = String(item[key] || '');
            
            // If "ALL" is selected, only show items with "ALL" value
            if (filterValues.includes('ALL')) {
              return itemValue === 'ALL';
            }
            
            // If specific values are selected, show items with those values OR "ALL"
            return filterValues.includes(itemValue) || itemValue === 'ALL';
          });
        } else {
          // Standard filtering for other columns
          processedData = processedData.filter(item =>
            filterValues.includes(String(item[key] || ''))
          );
        }
      }
    });

    // Prioritize affected items at the top
    console.log('🔍 DataGrid - affectedIds.size:', affectedIds.size);
    console.log('🔍 DataGrid - affectedIds:', Array.from(affectedIds));
    console.log('🔍 DataGrid - processedData count:', processedData.length);
    
    if (affectedIds.size > 0) {
      const affectedItems = processedData.filter(row => affectedIds.has(row.id));
      const nonAffectedItems = processedData.filter(row => !affectedIds.has(row.id));
      processedData = [...affectedItems, ...nonAffectedItems];
      console.log(`🎯 MOVED ${affectedItems.length} affected items to top`);
      console.log('🔍 DataGrid - affected items:', affectedItems.map(item => ({ id: item.id, object: item.object, driver: item.driver })));
    }

    // Apply custom sort rules (grid-level sort) - this takes priority over individual column sorts
    if (customSortRules.length > 0) {
      console.log('🎯 APPLYING CUSTOM SORT RULES:', customSortRules);
      
      processedData.sort((a, b) => {
        for (const rule of customSortRules) {
          if (!rule.column) continue;
          
          const aValue = String(a[rule.column] || '');
          const bValue = String(b[rule.column] || '');
          
          let comparison = 0;
          
          // Handle numeric columns
          if (['relationships', 'variants', 'variables'].includes(rule.column)) {
            const aNum = Number(aValue) || 0;
            const bNum = Number(bValue) || 0;
            comparison = aNum - bNum;
          } else {
            // Handle text columns
            comparison = aValue.localeCompare(bValue);
          }
          
          // Apply order (asc/desc)
          if (rule.order === 'desc') {
            comparison = -comparison;
          }
          
          // If this rule doesn't determine the order, continue to next rule
          if (comparison !== 0) {
            return comparison;
          }
        }
        
        return 0; // All rules are equal
      });
      
      console.log('✅ CUSTOM SORT APPLIED');
    }
    // Apply individual column sorting only if no custom sort rules
    else if (sortConfig) {
      console.log('🎯 SORT CONFIG EXISTS:', sortConfig);
      if (sortConfig.type === 'custom' && sortConfig.customOrder) {
        console.log('🔄 APPLYING CUSTOM SORT TO DATA:', {
          columnKey: sortConfig.key,
          customOrder: sortConfig.customOrder,
          customOrderLength: sortConfig.customOrder.length,
          dataCount: processedData.length,
          sampleData: processedData.slice(0, 3).map(item => item[sortConfig.key])
        });
        
        // Log the original order before sorting
        const originalOrder = processedData.map(item => item[sortConfig.key]);
        console.log('📋 ORIGINAL ORDER:', originalOrder);
        
        processedData.sort((a, b) => {
          const aValue = String(a[sortConfig.key] || '');
          const bValue = String(b[sortConfig.key] || '');
          const aIndex = sortConfig.customOrder!.indexOf(aValue);
          const bIndex = sortConfig.customOrder!.indexOf(bValue);
          
          console.log(`🔍 COMPARING: "${aValue}" (index ${aIndex}) vs "${bValue}" (index ${bIndex})`);
          
          // If a value is not found in custom order, put it at the end
          if (aIndex === -1 && bIndex === -1) {
            return aValue.localeCompare(bValue); // Alphabetical fallback
          }
          if (aIndex === -1) return 1; // a goes to end
          if (bIndex === -1) return -1; // b goes to end
          
          const result = aIndex - bIndex;
          console.log(`✅ RESULT: ${result} (${aValue} ${result < 0 ? 'comes before' : result > 0 ? 'comes after' : 'equals'} ${bValue})`);
          return result;
        });
        
        const finalOrder = processedData.map(item => item[sortConfig.key]);
        console.log('📋 FINAL SORTED ORDER:', finalOrder);
        console.log('🔄 ORDER CHANGED:', JSON.stringify(originalOrder) !== JSON.stringify(finalOrder));
      }
    }

    return processedData;
  }, [data, filters, columnFilters, sortConfig, affectedIds, customSortRules]);

  // Calculate available filter options for each column based on current filters
  const getAvailableFilterOptions = useMemo(() => {
    const options: Record<string, string[]> = {};
    
    // Start with all data
    let currentData = [...data];
    
    // Apply text filters first
    Object.entries(filters).forEach(([key, filterValue]) => {
      if (filterValue) {
        currentData = currentData.filter(item =>
          String(item[key]).toLowerCase().includes(filterValue.toLowerCase())
        );
      }
    });
    
    // For each column, calculate available options based on other column filters
    columns.forEach(column => {
      if (column.filterable) {
        let columnData = [...currentData];
        
        // Apply all column filters except the current one
        Object.entries(columnFilters).forEach(([key, filterValues]) => {
          if (key !== column.key && filterValues.length > 0) {
            columnData = columnData.filter(item =>
              filterValues.includes(String(item[key] || ''))
            );
          }
        });
        
        // Get distinct values for this column, sorted alphabetically
        const distinctValues = [...new Set(columnData.map(item => String(item[column.key] || '')))].filter(Boolean);
        options[column.key] = distinctValues.sort();
      }
    });
    
    return options;
  }, [data, filters, columnFilters, columns]);

  const handleRowDragStart = (row: Record<string, any>) => {
    setDraggedRow(row);
  };

  const handleRowDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleRowDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedRow && onReorder) {
      const currentData = [...filteredAndSortedData];
      const dragIndex = currentData.findIndex(item => item.id === draggedRow.id);
      
      if (dragIndex !== -1 && dragIndex !== dropIndex) {
        // Remove dragged item and insert at new position
        const [removed] = currentData.splice(dragIndex, 1);
        currentData.splice(dropIndex, 0, removed);
        onReorder(currentData);
      }
    }
    setDraggedRow(null);
    setDragOverIndex(null);
  };

  const handleRowDragEnd = () => {
    setDraggedRow(null);
    setDragOverIndex(null);
  };

  const getColumnIcon = (column: Column) => {
    const isNumeric = ['relationships', 'variants', 'variables'].includes(column.key);
    const hasSort = sortConfig?.key === column.key;
    const hasFilter = columnFilters[column.key]?.length > 0;
    
    if (isNumeric) {
      return <ArrowUpDown className="w-4 h-4" />;
    }
    
    if (hasSort && sortConfig?.type === 'custom') {
      return <GripVertical className="w-4 h-4 text-ag-dark-accent" />;
    }
    if (hasFilter) {
      return <Filter className="w-4 h-4 text-ag-dark-accent" />;
    }
    
    return <Filter className="w-4 h-4" />;
  };

  const getColumnHeaderClass = (column: Column) => {
    const hasFilter = columnFilters[column.key]?.length > 0;
    const hasSort = sortConfig?.key === column.key;
    
    if (hasFilter || hasSort) {
      return "bg-ag-dark-accent bg-opacity-10 border-ag-dark-accent border-opacity-50";
    }
    return "";
  };

  const getCurrentSort = (columnKey: string) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return { type: 'none' as const };
    }
    return {
      type: sortConfig.type,
      customOrder: sortConfig.customOrder
    };
  };

  const getCurrentFilters = (columnKey: string) => {
    return columnFilters[columnKey] || [];
  };

  function handleRowSelection(row: Record<string, any>, isSelected: boolean) {
    let newSelection;
    if (isSelected) {
      newSelection = [...localSelectedRows, row];
    } else {
      newSelection = localSelectedRows.filter(selectedRow => selectedRow.id !== row.id);
    }
    
    setLocalSelectedRows(newSelection);
    onRowSelect?.(newSelection);
  }

  function handleSelectAll(isSelected: boolean) {
    const newSelection = isSelected ? filteredAndSortedData : [];
    setLocalSelectedRows(newSelection);
    onRowSelect?.(newSelection);
  }

  function isRowSelected(row: Record<string, any>) {
    return localSelectedRows.some(selectedRow => selectedRow.id === row.id);
  }

  function isRowAffected(row: Record<string, any>) {
    // Check if row is in affectedIds (from driver deletion)
    const isAffectedByIds = affectedIds.has(row.id);
    
    // Also check if the driver field has any "-" (indicating deleted driver)
    const hasDeletedDriverValue = row.driver && hasDeletedDriver(row.driver);
    
    const isAffected = isAffectedByIds || hasDeletedDriverValue;
    
    if (isAffected) {
      console.log(`Row ${row.id} is affected (by IDs: ${isAffectedByIds}, by driver: ${hasDeletedDriverValue})`);
    }
    return isAffected;
  }

  function isColumnAffected(row: Record<string, any>, columnKey: string) {
    // Check if row is in affectedIds (from driver deletion)
    const isAffectedByIds = affectedIds.has(row.id);
    
    // Check if the specific column has a deleted driver
    const hasSpecificDeleted = row.driver && hasSpecificDeletedDriver(row.driver, columnKey);
    
    return isAffectedByIds || hasSpecificDeleted;
  }

  function formatDriverWithDeletedSector(value: string, deletedDriverType: string | null, columnKey: string) {
    if (!value) return value;
    
    // Only show '-' for the specific field that was deleted
    if (deletedDriverType === 'sectors' && columnKey === 'sector' && value !== 'ALL') {
      return '-';
    } else if (deletedDriverType === 'domains' && columnKey === 'domain' && value !== 'ALL') {
      return '-';
    } else if (deletedDriverType === 'countries' && columnKey === 'country' && value !== 'ALL') {
      return '-';
    }
    
    return value;
  }

  function hasDeletedDriver(driverString: string) {
    if (!driverString) return false;
    const parts = driverString.split(',').map(part => part.trim());
    if (parts.length >= 4) {
      // Check if any part is exactly "-" (indicating deleted driver)
      // Don't flag hyphens within names like "E-commerce"
      return parts[0] === '-' || parts[1] === '-' || parts[2] === '-' || parts[3] === '-';
    }
    return false;
  }

  function hasSpecificDeletedDriver(driverString: string, columnKey: string) {
    if (!driverString) return false;
    const parts = driverString.split(',').map(part => part.trim());
    if (parts.length >= 4) {
      // Check if the specific field is deleted
      if (columnKey === 'sector' && parts[0] === '-') return true;
      if (columnKey === 'domain' && parts[1] === '-') return true;
      if (columnKey === 'country' && parts[2] === '-') return true;
    }
    return false;
  }

  return (
    <>
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border overflow-hidden">
        {/* Grid Container with Horizontal Scroll */}
        <div className="overflow-x-auto">
          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <div className="bg-ag-dark-surface border-b border-ag-dark-border px-4 py-2">
              <button
                onClick={handleClearAllFilters}
                className="text-xs text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
              >
                Clear All Filters & Sorts
              </button>
            </div>
          )}
          
          {/* Grid Header */}
          <div className="bg-ag-dark-bg border-b border-ag-dark-border min-w-max">
            <div className="flex text-sm font-medium text-ag-dark-text">
              <div className="w-12 flex items-center justify-center p-4">
                <input
                  type="checkbox"
                  checked={localSelectedRows.length === filteredAndSortedData.length && filteredAndSortedData.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-ag-dark-border bg-ag-dark-surface text-ag-dark-accent focus:ring-ag-dark-accent focus:ring-2 focus:ring-offset-0"
                />
              </div>
              {columns.map((column) => (
                <div
                  key={column.key}
                  className={`flex items-center justify-between px-4 py-3 border-r border-ag-dark-border whitespace-nowrap ${getColumnHeaderClass(column)}`}
                  style={{ width: column.width }}
                >
                  <span className="text-ag-dark-text font-medium text-sm truncate pr-2">
                    {column.title}
                    {columnFilters[column.key]?.length > 0 && (
                      <span className="ml-1 text-xs text-ag-dark-accent">
                        ({columnFilters[column.key].length})
                      </span>
                    )}
                  </span>
                  {(column.sortable || column.filterable) && (
                    <button
                      onClick={(e) => handleColumnHeaderClick(column, e)}
                      className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors flex-shrink-0 ml-1"
                    >
                      {getColumnIcon(column)}
                    </button>
                  )}
                </div>
              ))}
              <div className="w-24 text-center text-ag-dark-text px-4 py-3">
                <span className="text-ag-dark-text font-medium text-sm">Actions</span>
              </div>
              {onReorder && (
                <div className="w-12 text-center text-ag-dark-text px-4 py-3">
                  <GripVertical className="w-4 h-4 mx-auto text-ag-dark-text-secondary" />
                </div>
              )}
            </div>
          </div>

          {/* Grid Body */}
          <div className="min-w-max">
            {filteredAndSortedData.map((row, index) => (
              <div
                key={row.id || index}
                draggable={onReorder ? true : false}
                onDragStart={() => onReorder && handleRowDragStart(row)}
                onDragOver={(e) => onReorder && handleRowDragOver(e, index)}
                onDrop={(e) => onReorder && handleRowDrop(e, index)}
                onDragEnd={handleRowDragEnd}
                className={`flex border-b border-ag-dark-border hover:bg-ag-dark-bg transition-colors ${
                  isRowSelected(row) ? 'bg-ag-dark-accent bg-opacity-20 border-ag-dark-accent border-opacity-50' : ''
                } ${
                  isRowAffected(row) ? 'bg-red-900 bg-opacity-30 border-red-500 border-opacity-50' : ''
                } ${
                  dragOverIndex === index ? 'border-t-2 border-t-ag-dark-accent' : ''
                } ${
                  draggedRow?.id === row.id ? 'opacity-50' : ''
                }`}
              >
                <div className="w-12 flex items-center justify-center p-2">
                  <input
                    type="checkbox"
                    checked={isRowSelected(row)}
                    onChange={(e) => handleRowSelection(row, e.target.checked)}
                    className="rounded border-ag-dark-border bg-ag-dark-surface text-ag-dark-accent focus:ring-ag-dark-accent focus:ring-2 focus:ring-offset-0"
                  />
                </div>
                {columns.map((column) => (
                  <div
                    key={`${row.id || index}-${column.key}`}
                    className={`flex items-center text-sm text-ag-dark-text px-4 py-2 border-r border-ag-dark-border ${
                      ['relationships', 'variants', 'variables', 'objectRelationships'].includes(column.key) 
                        ? 'justify-end' 
                        : 'justify-start'
                    }`}
                    style={{ width: column.width }}
                  >
                    <span className={`whitespace-nowrap overflow-hidden text-ellipsis ${
                      column.key === 'object' 
                        ? 'font-bold text-teal-600' 
                        : (column.key === 'variable' || column.key === 'list') 
                          ? 'font-semibold' 
                          : ''
                    } ${
                      (column.key === 'sector' || column.key === 'domain' || column.key === 'country') && isColumnAffected(row, column.key) ? 'text-red-400' : ''
                    }`}>
                      {(column.key === 'sector' || column.key === 'domain' || column.key === 'country') && isColumnAffected(row, column.key) ? 
                        formatDriverWithDeletedSector(row[column.key], deletedDriverType, column.key) : 
                        (row[column.key] || '-')
                      }
                    </span>
                  </div>
                ))}
                <div className="w-16 flex items-center justify-center gap-1 px-2 py-2">
                  <button
                    onClick={() => onDelete?.(row)}
                    className="text-ag-dark-error hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {onReorder && (
                  <div className="w-12 flex items-center justify-center px-4 py-2">
                    <GripVertical className="w-4 h-4 text-ag-dark-text-secondary cursor-move" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {filteredAndSortedData.length === 0 && (
          <div className="p-8 text-center text-ag-dark-text-secondary">
            <div className="text-lg font-medium mb-2">No data found</div>
            <div className="text-sm">Try adjusting your filters or add some data</div>
          </div>
        )}
      </div>

      {/* Column Filter Dropdown */}
      {openDropdown && (
        <ColumnFilterDropdown
          column={columns.find(col => col.key === openDropdown)!}
          data={data}
          isOpen={true}
          onClose={() => setOpenDropdown(null)}
          onFilter={(filters) => handleColumnFilter(openDropdown, filters)}
          onSort={(type) => handleColumnSort(openDropdown, type)}
          onCustomSort={(order) => handleCustomSort(openDropdown, order)}
          currentFilters={getCurrentFilters(openDropdown)}
          currentSort={getCurrentSort(openDropdown)}
          position={dropdownPosition}
          availableOptions={getAvailableFilterOptions[openDropdown] || []}
        />
      )}
    </>
  );
};

// Filter Panel Component (keeping existing functionality)
export const FilterPanel: React.FC<{
  columns: Column[];
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  isOpen: boolean;
  activeTab?: string;
  data?: Record<string, any>[];
}> = ({ columns, filters, onFilterChange, isOpen, activeTab, data }) => {
  if (!isOpen) return null;

  // Define which columns to show filters for based on active tab
  const getFilterableColumns = () => {
    if (activeTab === 'lists') {
      return columns.filter(col => ['driver', 'objectType', 'clarifier', 'variable', 'set', 'grouping'].includes(col.key));
    }
    if (activeTab === 'variables') {
      return columns.filter(col => ['driver', 'part', 'section', 'group'].includes(col.key));
    }
    // Default to all filterable columns for objects tab
    return columns.filter(col => col.filterable);
  };

  // Get distinct values for dropdown filters
  const getDistinctValues = (columnKey: string) => {
    return [...new Set(data.map(item => String(item[columnKey] || '')))].filter(Boolean);
  };

  // Check if column should be a dropdown filter
  const isDropdownFilter = (columnKey: string) => {
    return activeTab === 'lists' && ['driver', 'objectType', 'clarifier', 'variable', 'set', 'grouping'].includes(columnKey);
  };
  const filterableColumns = getFilterableColumns();
  return (
    <div className="bg-ag-dark-surface border border-ag-dark-border rounded-lg p-4 mb-4">
      <h3 className="text-sm font-medium text-ag-dark-text mb-3">Filters</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filterableColumns.map((column) => (
          <div key={`filter-${column.key}`}>
            <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
              {column.title}
            </label>
            {isDropdownFilter(column.key) ? (
              <select
                value={filters[column.key] || ''}
                onChange={(e) => onFilterChange(column.key, e.target.value)}
                className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                <option value="">All {column.title}</option>
                {getDistinctValues(column.key).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            ) : (
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ag-dark-text-secondary" />
                <input
                  type="text"
                  placeholder={`Filter ${column.title}`}
                  value={filters[column.key] || ''}
                  onChange={(e) => onFilterChange(column.key, e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={() => {
            filterableColumns.forEach(col => {
              if (col.filterable) onFilterChange(col.key, '');
            });
          }}
          className="text-sm text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
        >
          Clear All Filters
        </button>
      </div>
    </div>
  );
};