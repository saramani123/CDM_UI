import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Filter, Edit, Trash2, ArrowUpDown, GripVertical, Copy } from 'lucide-react';
import { ColumnFilterDropdown } from './ColumnFilterDropdown';
import { ResizableColumn } from './ResizableColumn';
import { getGridDriverDisplayValue } from '../utils/driverAbbreviations';
import { parseDriverField, getDriversData } from '../data/mockData';

interface Column {
  key: string;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  width: string;
  render?: (row: any) => React.ReactNode;
}

interface PredefinedSortOrder {
  // Variables
  partOrder?: string[];
  sectionOrders?: Record<string, string[]>; // key: part, value: array of sections
  sectionOrder?: string[]; // Legacy support for old format
  groupOrders?: Record<string, string[]>; // key: "part|section", value: array of groups
  variableOrders?: Record<string, string[]>; // key: "part|section|group", value: array of variables
  // Objects
  beingOrder?: string[];
  avatarOrders?: Record<string, string[]>; // key: being, value: array of avatars
  objectOrders?: Record<string, string[]>; // key: "being|avatar", value: array of objects
  // Lists
  setOrder?: string[];
  groupingOrders?: Record<string, string[]>; // key: set, value: array of groupings
  listOrders?: Record<string, string[]>; // key: "set|grouping", value: array of lists
  // S, D, C (independent across all grids)
  sectorOrder?: string[]; // Independent S column order
  domainOrder?: string[]; // Independent D column order
  countryOrder?: string[]; // Independent C column order
}

interface DataGridProps {
  columns: Column[];
  data: Record<string, any>[];
  onRowSelect?: (selectedRows: Record<string, any>[]) => void;
  onEdit?: (row: Record<string, any>) => void;
  onDelete?: (row: Record<string, any>) => void;
  onClone?: (row: Record<string, any>) => void;
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
  highlightCurrentObject?: boolean;
  showActionsColumn?: boolean;
  selectionMode?: 'checkbox' | 'row';
  relationshipData?: Record<string, any>;
  onRelationshipCheckboxChange?: (objectId: string, checked: boolean) => void;
  onRelationshipRowClick?: (objectId: string) => void; // Handler for row clicks in relationship mode
  onIsMemeChange?: (rowId: string, checked: boolean) => void; // Handler for isMeme checkbox changes
  onIsGroupKeyChange?: (rowId: string, checked: boolean) => void; // Handler for isGroupKey checkbox changes
  gridType?: 'objects' | 'variables' | 'lists' | 'metadata'; // Add grid type to separate localStorage keys
  isPredefinedSortEnabled?: boolean;
  predefinedSortOrder?: PredefinedSortOrder;
  onResetHandlersReady?: (handlers: { clearFilters: () => void; resetSorting: () => void; hasActiveFilters: boolean; hasActiveSorting: boolean }) => void;
}

export const DataGrid: React.FC<DataGridProps> = ({
  columns,
  data,
  onRowSelect,
  onEdit,
  onDelete,
  onClone,
  selectedRows = [],
  onReorder,
  affectedIds = new Set(),
  deletedDriverType = null,
  customSortRules = [],
  onClearCustomSort,
  onColumnSort,
  isCustomSortActive = false,
  isColumnSortActive = false,
  highlightCurrentObject = false,
  showActionsColumn = true,
  selectionMode = 'checkbox',
  relationshipData,
  onRelationshipCheckboxChange,
  onRelationshipRowClick,
  onIsMemeChange,
  onIsGroupKeyChange,
  gridType = 'objects', // Default to 'objects' for backward compatibility
  isPredefinedSortEnabled = false,
  predefinedSortOrder,
  onResetHandlersReady
}) => {
  console.log('🔍 DataGrid - received affectedIds:', Array.from(affectedIds));
  console.log('🔍 DataGrid - received deletedDriverType:', deletedDriverType);
  
  // Helper function to check if a metadata row is required
  const isRequiredMetadataRow = (row: Record<string, any>): boolean => {
    if (gridType !== 'metadata') return false;
    const concept = (row as any).concept;
    if (!concept) return false;
    const requiredConcepts = ['Vulqan', 'Being', 'Avatar', 'Part', 'Section', 'Group', 'G-Type', 'Group-Type', 'Set', 'List Set', 'Grouping', 'List Grouping'];
    return (row as any).isRequired || requiredConcepts.includes(concept);
  };
  // Load persisted state from localStorage - use grid-specific keys
  const loadPersistedDataGridState = () => {
    try {
      const filterKey = gridType === 'variables' ? 'cdm_variables_column_filters' : 
                       gridType === 'lists' ? 'cdm_lists_column_filters' : 
                       gridType === 'metadata' ? 'cdm_metadata_column_filters' :
                       gridType === 'heuristics' ? 'cdm_heuristics_column_filters' :
                       gridType === 'sources' ? 'cdm_sources_column_filters' :
                       'cdm_objects_column_filters';
      const sortKey = gridType === 'variables' ? 'cdm_variables_sort_config' : 
                     gridType === 'lists' ? 'cdm_lists_sort_config' : 
                     gridType === 'metadata' ? 'cdm_metadata_sort_config' :
                     gridType === 'heuristics' ? 'cdm_heuristics_sort_config' :
                     gridType === 'sources' ? 'cdm_sources_sort_config' :
                     'cdm_objects_sort_config';
      const savedColumnFilters = localStorage.getItem(filterKey);
      const savedSortConfig = localStorage.getItem(sortKey);
      
      return {
        columnFilters: savedColumnFilters ? JSON.parse(savedColumnFilters) : {},
        sortConfig: savedSortConfig ? JSON.parse(savedSortConfig) : null
      };
    } catch (error) {
      console.error('Error loading persisted DataGrid state:', error);
      return {
        columnFilters: {},
        sortConfig: null
      };
    }
  };

  const persistedDataGridState = loadPersistedDataGridState();
  const [sortConfig, setSortConfig] = useState<{
    key: string; 
    type: 'custom' | 'none';
    customOrder?: string[];
  } | null>(persistedDataGridState.sortConfig);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>(persistedDataGridState.columnFilters);
  const [localSelectedRows, setLocalSelectedRows] = useState<Record<string, any>[]>(selectedRows);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [draggedRow, setDraggedRow] = useState<Record<string, any> | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [lastSelectedRowIndex, setLastSelectedRowIndex] = useState<number | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    // Load persisted column widths from localStorage - use grid-specific key
    const storageKey = `cdm_column_widths_${gridType}`;
    const loadPersistedColumnWidths = () => {
      try {
        const savedWidths = localStorage.getItem(storageKey);
        if (savedWidths) {
          return JSON.parse(savedWidths);
        }
      } catch (error) {
        console.error('Error loading persisted column widths:', error);
      }
      return null;
    };

    const persistedWidths = loadPersistedColumnWidths();
    if (persistedWidths) {
      return persistedWidths;
    }

    // Initialize column widths from column definitions
    const initialWidths: Record<string, number> = {};
    columns.forEach(col => {
      initialWidths[col.key] = parseInt(col.width) || 140;
    });
    return initialWidths;
  });

  // Sync local selection state with prop changes
  React.useEffect(() => {
    setLocalSelectedRows(selectedRows);
  }, [selectedRows]);

  // Persist column filters to localStorage - use grid-specific key
  React.useEffect(() => {
    const filterKey = gridType === 'variables' ? 'cdm_variables_column_filters' : 
                     gridType === 'lists' ? 'cdm_lists_column_filters' : 
                     'cdm_objects_column_filters';
    localStorage.setItem(filterKey, JSON.stringify(columnFilters));
  }, [columnFilters, gridType]);

  // Clear sortConfig when custom sort is applied (grid-level sort takes priority)
  React.useEffect(() => {
    if (isCustomSortActive && customSortRules.length > 0 && sortConfig !== null) {
      console.log('🧹 Clearing sortConfig because custom sort is active');
      setSortConfig(null);
      const sortKey = gridType === 'variables' ? 'cdm_variables_sort_config' : 
                     gridType === 'lists' ? 'cdm_lists_sort_config' : 
                     'cdm_objects_sort_config';
      localStorage.removeItem(sortKey);
    }
  }, [isCustomSortActive, customSortRules.length, gridType]);

  // Persist sort config to localStorage - use grid-specific key
  React.useEffect(() => {
    const sortKey = gridType === 'variables' ? 'cdm_variables_sort_config' : 
                   gridType === 'lists' ? 'cdm_lists_sort_config' : 
                   'cdm_objects_sort_config';
    localStorage.setItem(sortKey, JSON.stringify(sortConfig));
  }, [sortConfig, gridType]);

  const handleColumnHeaderClick = (column: Column, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + window.scrollY + 5,
      left: rect.left + window.scrollX
    });
    setOpenDropdown(column.key);
    
    // Don't trigger column sort callback here - only trigger when actually applying a sort
    // Opening the dropdown should not activate sorting
  };

  const handleColumnFilter = (columnKey: string, filterValues: string[]) => {
    // Preserve sort when applying filters - filters and sorts should coexist
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: filterValues
    }));
    // Explicitly preserve sortConfig - do not clear it when filters change
  };

  const handleColumnSort = (columnKey: string, type: 'custom' | 'none') => {
    // Trigger column sort callback when actually applying a sort (not when opening dropdown)
    if (onColumnSort && type !== 'none') {
      onColumnSort();
    }
    
    // If custom sort is active, clear it before applying column sort (mutual exclusivity)
    if (isCustomSortActive && type !== 'none') {
      onClearCustomSort?.();
    }
    
    if (type === 'none') {
      setSortConfig(null);
    } else {
      // For custom sort, don't overwrite the sortConfig - it should already be set by handleCustomSort
      if (type === 'custom') {
        console.log('🎯 HANDLE COLUMN SORT - CUSTOM:', { columnKey, currentSortConfig: sortConfig });
        // Don't modify the sortConfig for custom sort - it's already set by handleCustomSort
        return;
      }
      // Apply per-column sort (mutually exclusive with custom sort)
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
    
    // If grid-level custom sort is active, clear it when applying per-column custom sort
    if (isCustomSortActive && customSortRules.length > 0) {
      onClearCustomSort?.();
    }
    
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
    // Only clear filters, preserve ALL sorting (including predefined sort order)
    // This should NOT touch predefined sort order at all - it's "sacred"
    setFilters({});
    setColumnFilters({});
    // Don't clear sortConfig - filters and sorts should coexist
    // Don't call onClearCustomSort - preserve sorting (including predefined sort)
    // Clear only filter-related localStorage
    const filterKey = gridType === 'variables' ? 'cdm_variables_column_filters' : 
                     gridType === 'lists' ? 'cdm_lists_column_filters' : 
                     'cdm_objects_column_filters';
    localStorage.removeItem(filterKey);
    // Note: Sorting state is preserved - this includes predefined sort order which is "sacred"
    // Reset Filters should ONLY clear filtering logic, never sorting
  };

  const handleResetSorting = () => {
    // Clear sorting only, preserve filters
    setSortConfig(null);
    onClearCustomSort?.();
    // Clear only sort-related localStorage
    const sortKey = gridType === 'variables' ? 'cdm_variables_sort_config' : 
                   gridType === 'lists' ? 'cdm_lists_sort_config' : 
                   'cdm_objects_sort_config';
    localStorage.removeItem(sortKey);
    localStorage.removeItem(gridType === 'variables' ? 'cdm_variables_column_sort_active' : 
                           gridType === 'lists' ? 'cdm_lists_column_sort_active' : 
                           'cdm_objects_column_sort_active');
    localStorage.removeItem(gridType === 'variables' ? 'cdm_variables_custom_sort_rules' : 
                           gridType === 'lists' ? 'cdm_lists_custom_sort_rules' : 
                           'cdm_objects_custom_sort_rules');
    localStorage.removeItem(gridType === 'variables' ? 'cdm_variables_custom_sort_active' : 
                           gridType === 'lists' ? 'cdm_lists_custom_sort_active' : 
                           'cdm_objects_custom_sort_active');
    setIsCustomSortActive(false);
    setIsColumnSortActive(false);
  };


  // Initialize CSS variables for large grids
  const gridContainerRef = React.useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  
  // Sync horizontal scroll between header and body
  useEffect(() => {
    const headerEl = headerScrollRef.current;
    const bodyEl = bodyScrollRef.current;
    
    if (!headerEl || !bodyEl) return;
    
    let isSyncing = false;
    
    const handleBodyScroll = () => {
      if (isSyncing) return;
      isSyncing = true;
      headerEl.scrollLeft = bodyEl.scrollLeft;
      requestAnimationFrame(() => {
        isSyncing = false;
      });
    };
    
    const handleHeaderScroll = () => {
      if (isSyncing) return;
      isSyncing = true;
      bodyEl.scrollLeft = headerEl.scrollLeft;
      requestAnimationFrame(() => {
        isSyncing = false;
      });
    };
    
    bodyEl.addEventListener('scroll', handleBodyScroll);
    headerEl.addEventListener('scroll', handleHeaderScroll);
    
    return () => {
      bodyEl.removeEventListener('scroll', handleBodyScroll);
      headerEl.removeEventListener('scroll', handleHeaderScroll);
    };
  }, []);
  const isLargeGrid = data.length > 500;
  
  // Initialize CSS variables on mount and when columnWidths change (for large grids)
  // Also reset when gridType changes to prevent CSS bleeding between tabs
  React.useEffect(() => {
    if (gridContainerRef.current) {
      // Clear all existing CSS variables for this grid type
      columns.forEach(col => {
        gridContainerRef.current?.style.removeProperty(`--column-width-${col.key}`);
      });
      
      // Set new CSS variables
      if (isLargeGrid) {
        columns.forEach(col => {
          const width = columnWidths[col.key] || parseInt(col.width) || 140;
          gridContainerRef.current?.style.setProperty(`--column-width-${col.key}`, `${width}px`);
        });
      }
    }
  }, [isLargeGrid, columns, columnWidths, gridType]);

  const handleColumnResize = (columnKey: string, newWidth: number) => {
    setColumnWidths(prev => {
      const newWidths = {
        ...prev,
        [columnKey]: newWidth
      };
      
      // Update CSS variable for large grids (for React state sync)
      if (isLargeGrid && gridContainerRef.current) {
        gridContainerRef.current.style.setProperty(`--column-width-${columnKey}`, `${newWidth}px`);
      }
      
      // Persist column widths to localStorage - use grid-specific key
      const storageKey = `cdm_column_widths_${gridType}`;
      // For large grids, this is throttled by ResizableColumn
      if (!isLargeGrid) {
        // Small grids: write immediately
        try {
          localStorage.setItem(storageKey, JSON.stringify(newWidths));
        } catch (error) {
          console.error('Error persisting column widths:', error);
        }
      }
      
      return newWidths;
    });
  };

  // Debounced localStorage write for large grids
  const throttledLocalStorageWrite = React.useRef<NodeJS.Timeout | null>(null);
  
  React.useEffect(() => {
    if (isLargeGrid) {
      // For large grids, debounce localStorage writes
      if (throttledLocalStorageWrite.current) {
        clearTimeout(throttledLocalStorageWrite.current);
      }
      
      const storageKey = `cdm_column_widths_${gridType}`;
      throttledLocalStorageWrite.current = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(columnWidths));
        } catch (error) {
          console.error('Error persisting column widths:', error);
        }
      }, 300); // Write 300ms after last update
      
      return () => {
        if (throttledLocalStorageWrite.current) {
          clearTimeout(throttledLocalStorageWrite.current);
        }
      };
    }
  }, [columnWidths, isLargeGrid]);

  // Note: hasActiveFilters is now calculated inline in the render to show separate buttons for filters and sorting

  const filteredAndSortedData = useMemo(() => {
    console.log('🔄 USEMEMO TRIGGERED:', { sortConfig, dataLength: data.length, affectedIds: affectedIds.size, affectedIdsArray: Array.from(affectedIds), customSortRules: customSortRules.length });
    
    // Filter out any undefined/null items first to prevent errors
    let processedData = [...data].filter(item => item && typeof item === 'object' && item.id);

    // Apply text filters
    Object.entries(filters).forEach(([key, filterValue]) => {
      if (filterValue) {
        processedData = processedData.filter(item => {
          if (!item || typeof item !== 'object') return false;
          return String(item[key] || '').toLowerCase().includes(filterValue.toLowerCase());
        });
      }
    });

    // Apply column filters
    Object.entries(columnFilters).forEach(([key, filterValues]) => {
      if (filterValues.length > 0) {
        // Special handling for Sector, Domain, Country columns (which may have comma-separated values)
        if (['sector', 'domain', 'country'].includes(key)) {
          processedData = processedData.filter(item => {
            if (!item || typeof item !== 'object') return false;
            const itemValue = String(item[key] || '');
            
            // If "ALL" is selected, only show items with "ALL" value
            if (filterValues.includes('ALL')) {
              return itemValue === 'ALL';
            }
            
            // For specific values, check if any of the filter values appear in the item's value
            // This handles comma-separated values like "Finance, Healthcare, Retail"
            const itemValues = itemValue.split(',').map(v => v.trim());
            const hasMatch = filterValues.some(filterValue => itemValues.includes(filterValue));
            
            // Show items that match OR have "ALL" value
            return hasMatch || itemValue === 'ALL';
          });
        } else {
          // Standard filtering for other columns
          processedData = processedData.filter(item => {
            if (!item || typeof item !== 'object') return false;
            return filterValues.includes(String(item[key] || ''));
          });
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

    // Apply custom sort rules (grid-level sort) - S, D, C sorting comes FIRST
    // When default order is enabled, it will be applied AFTER custom sort
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

    // Apply predefined sort (default order) - This is applied AFTER custom sort (S, D, C) when default order is enabled
    if (isPredefinedSortEnabled && predefinedSortOrder) {
      if (gridType === 'variables' && predefinedSortOrder.partOrder) {
        console.log('🎯 APPLYING DEFAULT ORDER FOR VARIABLES:', predefinedSortOrder);
        console.log('📋 SECTOR ORDER:', predefinedSortOrder.sectorOrder);
        console.log('📋 DOMAIN ORDER:', predefinedSortOrder.domainOrder);
        console.log('📋 COUNTRY ORDER:', predefinedSortOrder.countryOrder);
        
        processedData.sort((a, b) => {
          // First sort by Part
          const aPart = String(a.part || '');
          const bPart = String(b.part || '');
          const aPartIndex = predefinedSortOrder.partOrder!.indexOf(aPart);
          const bPartIndex = predefinedSortOrder.partOrder!.indexOf(bPart);
          
          if (aPartIndex !== bPartIndex) {
            if (aPartIndex === -1) return 1;
            if (bPartIndex === -1) return -1;
            return aPartIndex - bPartIndex;
          }
          
          // If parts are the same, sort by Section (if sectionOrders exists for this part)
          const aSection = String(a.section || '');
          const bSection = String(b.section || '');
          // Support both new format (sectionOrders) and legacy format (sectionOrder)
          let sectionOrder: string[] = [];
          if (predefinedSortOrder.sectionOrders && predefinedSortOrder.sectionOrders[aPart]) {
            sectionOrder = predefinedSortOrder.sectionOrders[aPart];
          } else if (predefinedSortOrder.sectionOrder) {
            // Legacy support: use flat sectionOrder
            sectionOrder = predefinedSortOrder.sectionOrder;
          }
          
          if (sectionOrder.length > 0) {
            const aSectionIndex = sectionOrder.indexOf(aSection);
            const bSectionIndex = sectionOrder.indexOf(bSection);
            
            if (aSectionIndex !== bSectionIndex) {
              if (aSectionIndex === -1) return 1;
              if (bSectionIndex === -1) return -1;
              return aSectionIndex - bSectionIndex;
            }
          }
          
          // If sections are the same, sort by Group
          const aGroup = String(a.group || '');
          const bGroup = String(b.group || '');
          const groupKey = `${aPart}|${aSection}`;
          const groupOrder = predefinedSortOrder.groupOrders?.[groupKey] || [];
          const aGroupIndex = groupOrder.indexOf(aGroup);
          const bGroupIndex = groupOrder.indexOf(bGroup);
          
          if (aGroupIndex !== bGroupIndex) {
            if (aGroupIndex === -1) return 1;
            if (bGroupIndex === -1) return -1;
            return aGroupIndex - bGroupIndex;
          }
          
          // If groups are the same, sort by Variable
          const aVariable = String(a.variable || '');
          const bVariable = String(b.variable || '');
          const variableKey = `${aPart}|${aSection}|${aGroup}`;
          const variableOrder = predefinedSortOrder.variableOrders?.[variableKey] || [];
          const aVariableIndex = variableOrder.indexOf(aVariable);
          const bVariableIndex = variableOrder.indexOf(bVariable);
          
          if (aVariableIndex !== bVariableIndex) {
            if (aVariableIndex === -1) return 1;
            if (bVariableIndex === -1) return -1;
            return aVariableIndex - bVariableIndex;
          }
          
          // After Variable, sort by Sector, Domain, Country
          // Helper to check if value is ALL, multiple, or single
          const getValueType = (value: string): 'ALL' | 'multiple' | 'single' => {
            const strValue = String(value || '').trim();
            if (!strValue) return 'single';
            if (strValue === 'ALL') return 'ALL';
            const values = strValue.split(',').map(v => v.trim()).filter(Boolean);
            return values.length > 1 ? 'multiple' : 'single';
          };
          
          // Helper to get sort index respecting the order: ALL at top, then multiple, then individual in order
          // The order array defines the exact order in the modal - we need to respect it while prioritizing ALL
          const getSortIndex = (value: string, valueType: 'ALL' | 'multiple' | 'single', order: string[]): number => {
            const allIndex = order.indexOf('ALL');
            
            if (valueType === 'ALL') {
              // ALL should respect its position in the order array
              // If ALL is at position 4, values at positions 1-3 should come first
              const allIndex = order.indexOf('ALL');
              if (allIndex === -1) {
                // ALL not in order - put it first
                return -1000000;
              }
              // ALL is in the order - use its position, but ensure it comes before values after it
              // Values before ALL (index < allIndex) will have negative offsets, so they come first
              // ALL gets its index, values after ALL get positive offsets
              return allIndex;
            } else if (valueType === 'multiple') {
              // Multiple values come after ALL, sorted by first value's position in order
              const values = value.split(',').map(v => v.trim()).filter(Boolean);
              const firstIndex = order.indexOf(values[0] || '');
              
              // Use offset to ensure multiples come after ALL but before singles
              return firstIndex === -1 ? 1000000 : 100000 + firstIndex;
            } else {
              // Single values - respect the order array exactly
              // Values before ALL in the order come first, then ALL, then values after ALL
              const index = order.indexOf(value);
              
              if (index === -1) return 2000000;
              
              // If ALL exists in order and this value comes before ALL, it should come first
              // Otherwise, ALL comes first, then this value
              if (allIndex !== -1 && index < allIndex) {
                // This value comes before ALL in the order - it should appear first
                // Use negative offset to ensure it comes before ALL (-1000000)
                return index - 10000;
              } else if (allIndex !== -1 && index > allIndex) {
                // This value comes after ALL in the order - ALL comes first, then this
                // Use positive offset to ensure it comes after ALL
                return index + 10000;
              }
              
              // No ALL in order, or index === allIndex (shouldn't happen for single)
              return index;
            }
          };
          
          // Sort by Sector
          const aSector = String(a.sector || '');
          const bSector = String(b.sector || '');
          const sectorOrder = predefinedSortOrder.sectorOrder || [];
          const aSectorType = getValueType(aSector);
          const bSectorType = getValueType(bSector);
          
          const aSectorIndex = getSortIndex(aSector, aSectorType, sectorOrder);
          const bSectorIndex = getSortIndex(bSector, bSectorType, sectorOrder);
          
          // Debug logging for ALL and Technology
          if ((aSector === 'ALL' || bSector === 'ALL') && (aSector === 'Technology' || bSector === 'Technology')) {
            console.log('🔍 SECTOR SORT DEBUG:', {
              aSector,
              bSector,
              aSectorType,
              bSectorType,
              aSectorIndex,
              bSectorIndex,
              sectorOrder,
              result: aSectorIndex - bSectorIndex
            });
          }
          
          if (aSectorIndex !== bSectorIndex) {
            return aSectorIndex - bSectorIndex;
          }
          
          // Sort by Domain
          const aDomain = String(a.domain || '');
          const bDomain = String(b.domain || '');
          const domainOrder = predefinedSortOrder.domainOrder || [];
          const aDomainType = getValueType(aDomain);
          const bDomainType = getValueType(bDomain);
          
          const aDomainIndex = getSortIndex(aDomain, aDomainType, domainOrder);
          const bDomainIndex = getSortIndex(bDomain, bDomainType, domainOrder);
          
          if (aDomainIndex !== bDomainIndex) {
            return aDomainIndex - bDomainIndex;
          }
          
          // Sort by Country
          const aCountry = String(a.country || '');
          const bCountry = String(b.country || '');
          const countryOrder = predefinedSortOrder.countryOrder || [];
          const aCountryType = getValueType(aCountry);
          const bCountryType = getValueType(bCountry);
          
          const aCountryIndex = getSortIndex(aCountry, aCountryType, countryOrder);
          const bCountryIndex = getSortIndex(bCountry, bCountryType, countryOrder);
          
          if (aCountryIndex !== bCountryIndex) {
            return aCountryIndex - bCountryIndex;
          }
          
          return 0;
        });
        
        console.log('✅ DEFAULT ORDER FOR VARIABLES APPLIED');
      } else if (gridType === 'objects' && predefinedSortOrder.beingOrder) {
        console.log('🎯 APPLYING DEFAULT ORDER FOR OBJECTS:', predefinedSortOrder);
        console.log('📋 SECTOR ORDER:', predefinedSortOrder.sectorOrder);
        console.log('📋 DOMAIN ORDER:', predefinedSortOrder.domainOrder);
        console.log('📋 COUNTRY ORDER:', predefinedSortOrder.countryOrder);
        
        processedData.sort((a, b) => {
          // First sort by Being
          const aBeing = String(a.being || '');
          const bBeing = String(b.being || '');
          const aBeingIndex = predefinedSortOrder.beingOrder!.indexOf(aBeing);
          const bBeingIndex = predefinedSortOrder.beingOrder!.indexOf(bBeing);
          
          if (aBeingIndex !== bBeingIndex) {
            if (aBeingIndex === -1) return 1;
            if (bBeingIndex === -1) return -1;
            return aBeingIndex - bBeingIndex;
          }
          
          // If beings are the same, sort by Avatar
          const aAvatar = String(a.avatar || '');
          const bAvatar = String(b.avatar || '');
          const avatarOrder = predefinedSortOrder.avatarOrders?.[aBeing] || [];
          const aAvatarIndex = avatarOrder.indexOf(aAvatar);
          const bAvatarIndex = avatarOrder.indexOf(bAvatar);
          
          if (aAvatarIndex !== bAvatarIndex) {
            if (aAvatarIndex === -1) return 1;
            if (bAvatarIndex === -1) return -1;
            return aAvatarIndex - bAvatarIndex;
          }
          
          // If avatars are the same, sort by Object
          const aObject = String(a.object || '');
          const bObject = String(b.object || '');
          const key = `${aBeing}|${aAvatar}`;
          const objectOrder = predefinedSortOrder.objectOrders?.[key] || [];
          const aObjectIndex = objectOrder.indexOf(aObject);
          const bObjectIndex = objectOrder.indexOf(bObject);
          
          if (aObjectIndex !== bObjectIndex) {
            if (aObjectIndex === -1) return 1;
            if (bObjectIndex === -1) return -1;
            return aObjectIndex - bObjectIndex;
          }
          
          // After Object, sort by Sector, Domain, Country
          // Helper to check if value is ALL, multiple, or single
          const getValueType = (value: string): 'ALL' | 'multiple' | 'single' => {
            const strValue = String(value || '').trim();
            if (!strValue) return 'single';
            if (strValue === 'ALL') return 'ALL';
            const values = strValue.split(',').map(v => v.trim()).filter(Boolean);
            return values.length > 1 ? 'multiple' : 'single';
          };
          
          // Helper to get sort index respecting the order: ALL at top, then multiple, then individual in order
          // The order array defines the exact order in the modal - we need to respect it while prioritizing ALL
          const getSortIndex = (value: string, valueType: 'ALL' | 'multiple' | 'single', order: string[]): number => {
            const allIndex = order.indexOf('ALL');
            
            if (valueType === 'ALL') {
              // ALL should respect its position in the order array
              // If ALL is at position 4, values at positions 1-3 should come first
              const allIndex = order.indexOf('ALL');
              if (allIndex === -1) {
                // ALL not in order - put it first
                return -1000000;
              }
              // ALL is in the order - use its position, but ensure it comes before values after it
              // Values before ALL (index < allIndex) will have negative offsets, so they come first
              // ALL gets its index, values after ALL get positive offsets
              return allIndex;
            } else if (valueType === 'multiple') {
              // Multiple values come after ALL, sorted by first value's position in order
              const values = value.split(',').map(v => v.trim()).filter(Boolean);
              const firstIndex = order.indexOf(values[0] || '');
              
              // Use offset to ensure multiples come after ALL but before singles
              return firstIndex === -1 ? 1000000 : 100000 + firstIndex;
            } else {
              // Single values - respect the order array exactly
              // Values before ALL in the order come first, then ALL, then values after ALL
              const index = order.indexOf(value);
              
              if (index === -1) return 2000000;
              
              // If ALL exists in order and this value comes before ALL, it should come first
              // Otherwise, ALL comes first, then this value
              if (allIndex !== -1 && index < allIndex) {
                // This value comes before ALL in the order - it should appear first
                // Use negative offset to ensure it comes before ALL (-1000000)
                return index - 10000;
              } else if (allIndex !== -1 && index > allIndex) {
                // This value comes after ALL in the order - ALL comes first, then this
                // Use positive offset to ensure it comes after ALL
                return index + 10000;
              }
              
              // No ALL in order, or index === allIndex (shouldn't happen for single)
              return index;
            }
          };
          
          // Sort by Sector
          const aSector = String(a.sector || '');
          const bSector = String(b.sector || '');
          const sectorOrder = predefinedSortOrder.sectorOrder || [];
          const aSectorType = getValueType(aSector);
          const bSectorType = getValueType(bSector);
          
          const aSectorIndex = getSortIndex(aSector, aSectorType, sectorOrder);
          const bSectorIndex = getSortIndex(bSector, bSectorType, sectorOrder);
          
          // Debug logging for ALL and Technology
          if ((aSector === 'ALL' || bSector === 'ALL') && (aSector === 'Technology' || bSector === 'Technology')) {
            console.log('🔍 SECTOR SORT DEBUG:', {
              aSector,
              bSector,
              aSectorType,
              bSectorType,
              aSectorIndex,
              bSectorIndex,
              sectorOrder,
              result: aSectorIndex - bSectorIndex
            });
          }
          
          if (aSectorIndex !== bSectorIndex) {
            return aSectorIndex - bSectorIndex;
          }
          
          // Sort by Domain
          const aDomain = String(a.domain || '');
          const bDomain = String(b.domain || '');
          const domainOrder = predefinedSortOrder.domainOrder || [];
          const aDomainType = getValueType(aDomain);
          const bDomainType = getValueType(bDomain);
          
          const aDomainIndex = getSortIndex(aDomain, aDomainType, domainOrder);
          const bDomainIndex = getSortIndex(bDomain, bDomainType, domainOrder);
          
          if (aDomainIndex !== bDomainIndex) {
            return aDomainIndex - bDomainIndex;
          }
          
          // Sort by Country
          const aCountry = String(a.country || '');
          const bCountry = String(b.country || '');
          const countryOrder = predefinedSortOrder.countryOrder || [];
          const aCountryType = getValueType(aCountry);
          const bCountryType = getValueType(bCountry);
          
          const aCountryIndex = getSortIndex(aCountry, aCountryType, countryOrder);
          const bCountryIndex = getSortIndex(bCountry, bCountryType, countryOrder);
          
          if (aCountryIndex !== bCountryIndex) {
            return aCountryIndex - bCountryIndex;
          }
          
          return 0;
        });
        
        console.log('✅ DEFAULT ORDER FOR OBJECTS APPLIED');
      } else if (gridType === 'lists' && predefinedSortOrder.setOrder) {
        console.log('🎯 APPLYING DEFAULT ORDER FOR LISTS:', predefinedSortOrder);
        console.log('📋 SECTOR ORDER:', predefinedSortOrder.sectorOrder);
        console.log('📋 DOMAIN ORDER:', predefinedSortOrder.domainOrder);
        console.log('📋 COUNTRY ORDER:', predefinedSortOrder.countryOrder);
        
        processedData.sort((a, b) => {
          // First sort by Set
          const aSet = String(a.set || '');
          const bSet = String(b.set || '');
          const aSetIndex = predefinedSortOrder.setOrder!.indexOf(aSet);
          const bSetIndex = predefinedSortOrder.setOrder!.indexOf(bSet);
          
          if (aSetIndex !== bSetIndex) {
            if (aSetIndex === -1) return 1;
            if (bSetIndex === -1) return -1;
            return aSetIndex - bSetIndex;
          }
          
          // If sets are the same, sort by Grouping
          const aGrouping = String(a.grouping || '');
          const bGrouping = String(b.grouping || '');
          const groupingOrder = predefinedSortOrder.groupingOrders?.[aSet] || [];
          const aGroupingIndex = groupingOrder.indexOf(aGrouping);
          const bGroupingIndex = groupingOrder.indexOf(bGrouping);
          
          if (aGroupingIndex !== bGroupingIndex) {
            if (aGroupingIndex === -1) return 1;
            if (bGroupingIndex === -1) return -1;
            return aGroupingIndex - bGroupingIndex;
          }
          
          // If groupings are the same, sort by List
          const aList = String(a.list || '');
          const bList = String(b.list || '');
          const key = `${aSet}|${aGrouping}`;
          const listOrder = predefinedSortOrder.listOrders?.[key] || [];
          const aListIndex = listOrder.indexOf(aList);
          const bListIndex = listOrder.indexOf(bList);
          
          if (aListIndex !== bListIndex) {
            if (aListIndex === -1) return 1;
            if (bListIndex === -1) return -1;
            return aListIndex - bListIndex;
          }
          
          // After List, sort by Sector, Domain, Country
          // Helper to check if value is ALL, multiple, or single
          const getValueType = (value: string): 'ALL' | 'multiple' | 'single' => {
            const strValue = String(value || '').trim();
            if (!strValue) return 'single';
            if (strValue === 'ALL') return 'ALL';
            const values = strValue.split(',').map(v => v.trim()).filter(Boolean);
            return values.length > 1 ? 'multiple' : 'single';
          };
          
          // Helper to get sort index respecting the order: ALL at top, then multiple, then individual in order
          // The order array defines the exact order in the modal - we need to respect it while prioritizing ALL
          const getSortIndex = (value: string, valueType: 'ALL' | 'multiple' | 'single', order: string[]): number => {
            const allIndex = order.indexOf('ALL');
            
            if (valueType === 'ALL') {
              // ALL should respect its position in the order array
              // If ALL is at position 4, values at positions 1-3 should come first
              const allIndex = order.indexOf('ALL');
              if (allIndex === -1) {
                // ALL not in order - put it first
                return -1000000;
              }
              // ALL is in the order - use its position, but ensure it comes before values after it
              // Values before ALL (index < allIndex) will have negative offsets, so they come first
              // ALL gets its index, values after ALL get positive offsets
              return allIndex;
            } else if (valueType === 'multiple') {
              // Multiple values come after ALL, sorted by first value's position in order
              const values = value.split(',').map(v => v.trim()).filter(Boolean);
              const firstIndex = order.indexOf(values[0] || '');
              
              // Use offset to ensure multiples come after ALL but before singles
              return firstIndex === -1 ? 1000000 : 100000 + firstIndex;
            } else {
              // Single values - respect the order array exactly
              // Values before ALL in the order come first, then ALL, then values after ALL
              const index = order.indexOf(value);
              
              if (index === -1) return 2000000;
              
              // If ALL exists in order and this value comes before ALL, it should come first
              // Otherwise, ALL comes first, then this value
              if (allIndex !== -1 && index < allIndex) {
                // This value comes before ALL in the order - it should appear first
                // Use negative offset to ensure it comes before ALL (-1000000)
                return index - 10000;
              } else if (allIndex !== -1 && index > allIndex) {
                // This value comes after ALL in the order - ALL comes first, then this
                // Use positive offset to ensure it comes after ALL
                return index + 10000;
              }
              
              // No ALL in order, or index === allIndex (shouldn't happen for single)
              return index;
            }
          };
          
          // Sort by Sector
          const aSector = String(a.sector || '');
          const bSector = String(b.sector || '');
          const sectorOrder = predefinedSortOrder.sectorOrder || [];
          const aSectorType = getValueType(aSector);
          const bSectorType = getValueType(bSector);
          
          const aSectorIndex = getSortIndex(aSector, aSectorType, sectorOrder);
          const bSectorIndex = getSortIndex(bSector, bSectorType, sectorOrder);
          
          // Debug logging for ALL and Technology
          if ((aSector === 'ALL' || bSector === 'ALL') && (aSector === 'Technology' || bSector === 'Technology')) {
            console.log('🔍 SECTOR SORT DEBUG:', {
              aSector,
              bSector,
              aSectorType,
              bSectorType,
              aSectorIndex,
              bSectorIndex,
              sectorOrder,
              result: aSectorIndex - bSectorIndex
            });
          }
          
          if (aSectorIndex !== bSectorIndex) {
            return aSectorIndex - bSectorIndex;
          }
          
          // Sort by Domain
          const aDomain = String(a.domain || '');
          const bDomain = String(b.domain || '');
          const domainOrder = predefinedSortOrder.domainOrder || [];
          const aDomainType = getValueType(aDomain);
          const bDomainType = getValueType(bDomain);
          
          const aDomainIndex = getSortIndex(aDomain, aDomainType, domainOrder);
          const bDomainIndex = getSortIndex(bDomain, bDomainType, domainOrder);
          
          if (aDomainIndex !== bDomainIndex) {
            return aDomainIndex - bDomainIndex;
          }
          
          // Sort by Country
          const aCountry = String(a.country || '');
          const bCountry = String(b.country || '');
          const countryOrder = predefinedSortOrder.countryOrder || [];
          const aCountryType = getValueType(aCountry);
          const bCountryType = getValueType(bCountry);
          
          const aCountryIndex = getSortIndex(aCountry, aCountryType, countryOrder);
          const bCountryIndex = getSortIndex(bCountry, bCountryType, countryOrder);
          
          if (aCountryIndex !== bCountryIndex) {
            return aCountryIndex - bCountryIndex;
          }
          
          return 0;
        });
        
        console.log('✅ DEFAULT ORDER FOR LISTS APPLIED');
      }
    }
    
    // Apply individual column sorting only if no custom sort rules
    if (!customSortRules.length && sortConfig) {
      console.log('🎯 SORT CONFIG EXISTS:', sortConfig);
      if (sortConfig.type === 'custom' && sortConfig.customOrder) {
        console.log('🔄 APPLYING CUSTOM SORT TO DATA:', {
          columnKey: sortConfig.key,
          customOrder: sortConfig.customOrder,
          customOrderLength: sortConfig.customOrder.length,
          dataCount: processedData.length,
          sampleData: processedData.slice(0, 3).map(item => item && typeof item === 'object' ? item[sortConfig.key] : '')
        });
        
        // Log the original order before sorting
        const originalOrder = processedData.map(item => item && typeof item === 'object' ? item[sortConfig.key] : '');
        console.log('📋 ORIGINAL ORDER:', originalOrder);
        
        processedData.sort((a, b) => {
          if (!a || typeof a !== 'object' || !b || typeof b !== 'object') return 0;
          const aValue = String(a[sortConfig.key] || '');
          const bValue = String(b[sortConfig.key] || '');
          
          // Special handling for sector, domain, country columns which may have comma-separated values
          let aSearchValue = aValue;
          let bSearchValue = bValue;
          
          if (['sector', 'domain', 'country'].includes(sortConfig.key)) {
            // For comma-separated values, use the first value for sorting
            // This helps when values are like "Finance, Healthcare, Retail"
            aSearchValue = aValue.split(',')[0].trim();
            bSearchValue = bValue.split(',')[0].trim();
          }
          
          const aIndex = sortConfig.customOrder!.indexOf(aSearchValue);
          const bIndex = sortConfig.customOrder!.indexOf(bSearchValue);
          
          console.log(`🔍 COMPARING: "${aValue}" (search: "${aSearchValue}", index ${aIndex}) vs "${bValue}" (search: "${bSearchValue}", index ${bIndex})`);
          
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
        
        const finalOrder = processedData.map(item => item && typeof item === 'object' ? item[sortConfig.key] : '');
        console.log('📋 FINAL SORTED ORDER:', finalOrder);
        console.log('🔄 ORDER CHANGED:', JSON.stringify(originalOrder) !== JSON.stringify(finalOrder));
      }
    }

    return processedData;
  }, [data, filters, columnFilters, sortConfig, affectedIds, customSortRules, gridType, isPredefinedSortEnabled, predefinedSortOrder]);

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
            // Special handling for sector, domain, country columns
            if (['sector', 'domain', 'country'].includes(key)) {
              columnData = columnData.filter(item => {
                const itemValue = String(item[key] || '');
                const itemValues = itemValue.split(',').map(v => v.trim());
                const hasMatch = filterValues.some(filterValue => itemValues.includes(filterValue));
                return hasMatch || itemValue === 'ALL';
              });
            } else {
              columnData = columnData.filter(item =>
                filterValues.includes(String(item[key] || ''))
              );
            }
          }
        });
        
        // Get distinct values for this column
        let distinctValues: string[] = [];
        
        // Special handling for sector, domain, country columns which may have comma-separated values
        if (['sector', 'domain', 'country'].includes(column.key)) {
          const valuesSet = new Set<string>();
          columnData.forEach(item => {
            if (!item || typeof item !== 'object') return;
            const itemValue = String(item[column.key] || '');
            if (itemValue === 'ALL') {
              valuesSet.add('ALL');
            } else {
              // Split comma-separated values and add each one
              const individualValues = itemValue.split(',').map(v => v.trim()).filter(Boolean);
              individualValues.forEach(v => valuesSet.add(v));
            }
          });
          distinctValues = Array.from(valuesSet);
        } else {
          // Standard extraction for other columns
          distinctValues = [...new Set(columnData.filter(item => item && typeof item === 'object').map(item => String(item[column.key] || '')))].filter(Boolean);
        }
        
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
      // Use the original data array, not filteredAndSortedData, to preserve the actual order
      const currentData = [...data];
      const dragIndex = currentData.findIndex(item => item.id === draggedRow.id);
      
      if (dragIndex !== -1 && dragIndex !== dropIndex) {
        // Remove dragged item and insert at new position
        const [removed] = currentData.splice(dragIndex, 1);
        currentData.splice(dropIndex, 0, removed);
        console.log('🔄 Reordering metadata:', { dragIndex, dropIndex, newOrder: currentData.map(r => ({ id: r.id, concept: (r as any).concept })) });
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

  function isCurrentObject(row: Record<string, any>) {
    return highlightCurrentObject && row.isCurrentObject === true;
  }

  function isColumnAffected(row: Record<string, any>, columnKey: string) {
    // Check if row is in affectedIds (from driver deletion)
    const isAffectedByIds = affectedIds.has(row.id);
    
    // Check if the specific column has a deleted driver
    const hasSpecificDeleted = row.driver && hasSpecificDeletedDriver(row.driver, columnKey);
    
    return isAffectedByIds || hasSpecificDeleted;
  }

  function formatDriverWithDeletedSector(value: string | string[], deletedDriverType: string | null, columnKey: string) {
    if (!value) return value;
    
    // Handle Lists data where value might be an array
    let stringValue: string;
    if (Array.isArray(value)) {
      if (value.length === 1 && value[0] === 'ALL') {
        stringValue = 'ALL';
      } else if (value.includes('ALL')) {
        stringValue = 'ALL';
      } else {
        stringValue = value.join(', ');
      }
    } else {
      stringValue = value;
    }
    
    // Only show '-' for the specific field that was deleted
    if (deletedDriverType === 'sectors' && columnKey === 'sector' && stringValue !== 'ALL') {
      return '-';
    } else if (deletedDriverType === 'domains' && columnKey === 'domain' && stringValue !== 'ALL') {
      return '-';
    } else if (deletedDriverType === 'countries' && columnKey === 'country' && stringValue !== 'ALL') {
      return '-';
    }
    
    // Display 'All' instead of 'ALL' in the grid
    if (stringValue === 'ALL') {
      return 'All';
    }
    
    return stringValue;
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
      <div 
        ref={gridContainerRef}
        className="bg-ag-dark-surface rounded-lg border border-ag-dark-border flex flex-col h-full"
        data-grid-container
        style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Grid Header - Fixed at top */}
        <div 
          ref={headerScrollRef}
          className={`bg-ag-dark-bg border-b border-ag-dark-border flex-shrink-0 ${gridType === 'metadata' ? 'overflow-x-hidden' : 'overflow-x-auto'}`}
          style={{ overflowY: 'hidden' }}
        >
          <div className={`flex text-sm font-medium text-ag-dark-text ${gridType === 'metadata' ? 'w-full' : 'min-w-max'}`}>
              {selectionMode === 'checkbox' && !relationshipData && (
                <div className="w-10 flex items-center justify-center p-2 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={localSelectedRows.length === filteredAndSortedData.length && filteredAndSortedData.length > 0}
                    onChange={(e) => {
                      handleSelectAll(e.target.checked);
                    }}
                    className="rounded border-ag-dark-border bg-ag-dark-surface text-ag-dark-accent focus:ring-ag-dark-accent focus:ring-2 focus:ring-offset-0"
                  />
                </div>
              )}
              {columns.map((column, colIndex) => {
                // Use smaller minWidth for sector, domain, country columns (S, D, C) since they use abbreviations
                const isShortColumn = ['sector', 'domain', 'country'].includes(column.key);
                const minWidth = isShortColumn ? 60 : 80;
                
                // Calculate column width - use same calculation as data cells for consistency
                const parsedWidth = parseInt(column.width) || 140;
                const columnWidth = columnWidths[column.key] || parsedWidth;
                
                // Check if this column should be flexible (width >= 9999 indicates flexible)
                const isFlexibleColumn = parsedWidth >= 9999;
                // For metadata, the actions column is part of columns array, so last column check is simpler
                const isLastColumn = colIndex === columns.length - 1;
                
                // For flexible columns, render a regular div instead of ResizableColumn
                if (isFlexibleColumn && isLastColumn) {
                  return (
                    <div
                      key={`${gridType}-${column.key}`}
                      className={`flex items-center justify-between px-4 py-2 box-border ${
                        colIndex < columns.length - 1 ? 'border-r border-ag-dark-border' : ''
                      } whitespace-nowrap ${getColumnHeaderClass(column)} flex-1`}
                      style={{ flex: '1 1 auto', minWidth: 0 }}
                    >
                      <span className="text-ag-dark-text font-medium text-xs pr-2 flex-1" style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        minWidth: 0
                      }}>
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
                          className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors flex-shrink-0 ml-2 mr-1"
                        >
                          {getColumnIcon(column)}
                        </button>
                      )}
                    </div>
                  );
                }
                
                return (
                <ResizableColumn
                  key={`${gridType}-${column.key}`} // Add gridType to force remount when switching tabs
                  columnKey={column.key}
                  initialWidth={`${columnWidth}px`}
                  minWidth={minWidth}
                  maxWidth={1000}
                  onResize={(newWidth) => handleColumnResize(column.key, newWidth)}
                  throttleUpdates={isLargeGrid}
                  className={`flex items-center justify-between px-4 py-2 box-border flex-shrink-0 ${
                    colIndex < columns.length - 1 ? 'border-r border-ag-dark-border' : ''
                  } whitespace-nowrap ${getColumnHeaderClass(column)}`}
                >
                  <span className="text-ag-dark-text font-medium text-xs pr-2 flex-1" style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minWidth: 0
                  }}>
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
                      className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors flex-shrink-0 ml-2 mr-1"
                    >
                      {getColumnIcon(column)}
                    </button>
                  )}
                </ResizableColumn>
                );
              })}
              {showActionsColumn && (
                <div className="w-20 text-center text-ag-dark-text px-4 py-2 flex-shrink-0">
                  <span className="text-ag-dark-text font-medium text-xs">Actions</span>
                </div>
              )}
              {onReorder && (
                <div className="w-12 text-center text-ag-dark-text px-4 py-3 flex-shrink-0">
                  <GripVertical className="w-4 h-4 mx-auto text-ag-dark-text-secondary" />
                </div>
              )}
            </div>
          </div>
        
        {/* Grid Body - Scrollable */}
        <div 
          ref={bodyScrollRef}
          className={`flex-1 ${gridType === 'metadata' ? 'overflow-auto' : 'overflow-x-auto overflow-y-auto'}`} 
          style={{ minHeight: 0 }}
        >
          <div className={gridType === 'metadata' ? 'w-full' : 'min-w-max'}>
            {filteredAndSortedData.map((row, index) => (
              <div
                key={row.id || index}
                draggable={onReorder && !isRequiredMetadataRow(row) ? true : false}
                onDragStart={() => onReorder && !isRequiredMetadataRow(row) && handleRowDragStart(row)}
                onDragOver={(e) => onReorder && !isRequiredMetadataRow(row) && handleRowDragOver(e, index)}
                onDrop={(e) => onReorder && !isRequiredMetadataRow(row) && handleRowDrop(e, index)}
                onDragEnd={handleRowDragEnd}
                onClick={(e) => {
                  // Prevent row click for tier lists (lists with hasIncomingTier)
                  if (gridType === 'lists' && (row as any).hasIncomingTier) {
                    return; // Don't allow clicking on tier lists
                  }
                  
                  // Prevent row click when clicking on inputs or selects
                  const target = e.target as HTMLElement;
                  if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.closest('input') || target.closest('select')) {
                    return;
                  }
                  
                  if (relationshipData && onRelationshipRowClick) {
                    // Click-to-select mode for relationship data
                    onRelationshipRowClick(row.id);
                  } else if (selectionMode === 'row' && !relationshipData) {
                    // Excel-like selection behavior
                    if (e.shiftKey && lastSelectedRowIndex !== null) {
                      // Shift+click: select all rows between last selected and current (inclusive)
                      const currentIndex = filteredAndSortedData.findIndex(r => r.id === row.id);
                      if (currentIndex !== -1) {
                        const startIndex = Math.min(lastSelectedRowIndex, currentIndex);
                        const endIndex = Math.max(lastSelectedRowIndex, currentIndex);
                        const rangeRows = filteredAndSortedData.slice(startIndex, endIndex + 1);
                        setLocalSelectedRows(rangeRows);
                        onRowSelect?.(rangeRows);
                        setLastSelectedRowIndex(currentIndex);
                      }
                    } else if (e.metaKey || e.ctrlKey) {
                      // Command/Ctrl+click: toggle individual row (non-adjacent selection)
                      const currentlySelected = isRowSelected(row);
                      if (currentlySelected) {
                        const newSelection = localSelectedRows.filter(selectedRow => selectedRow.id !== row.id);
                        setLocalSelectedRows(newSelection);
                        onRowSelect?.(newSelection);
                      } else {
                        const newSelection = [...localSelectedRows, row];
                        setLocalSelectedRows(newSelection);
                        onRowSelect?.(newSelection);
                      }
                      const currentIndex = filteredAndSortedData.findIndex(r => r.id === row.id);
                      if (currentIndex !== -1) {
                        setLastSelectedRowIndex(currentIndex);
                      }
                    } else {
                      // Normal click: single select (replace selection with just this row)
                      setLocalSelectedRows([row]);
                      onRowSelect?.([row]);
                      const currentIndex = filteredAndSortedData.findIndex(r => r.id === row.id);
                      if (currentIndex !== -1) {
                        setLastSelectedRowIndex(currentIndex);
                      }
                    }
                  }
                }}
                className={`flex border-b border-ag-dark-border transition-colors ${gridType === 'metadata' ? 'w-full' : 'min-w-full'} ${
                  // Required metadata rows - darker background (inverse: required = darker, non-required = lighter)
                  isRequiredMetadataRow(row)
                    ? 'bg-gray-800 bg-opacity-70 cursor-default'
                    : // Non-required metadata rows - lighter background
                  gridType === 'metadata'
                    ? 'bg-ag-dark-surface hover:bg-ag-dark-bg cursor-pointer'
                    : // Tier lists (lists with hasIncomingTier) - grey background, not clickable
                  gridType === 'lists' && (row as any).hasIncomingTier
                    ? 'bg-gray-800 bg-opacity-40 cursor-not-allowed opacity-75'
                    : 'hover:bg-ag-dark-bg cursor-pointer'
                } ${
                  // Priority: Cloned (unsaved) > Selected current object (intra-table) > Selected > Current object > Affected
                  // But skip if it's a tier list
                  gridType === 'lists' && (row as any).hasIncomingTier
                    ? ''
                    : row._isCloned && !row._isSaved
                      ? 'bg-orange-900 bg-opacity-20 border-orange-500 border-opacity-50' 
                      : isCurrentObject(row) && relationshipData?.[row.id]?.isSelected 
                        ? 'bg-blue-700 bg-opacity-60 border-blue-400 border-opacity-80 shadow-md' 
                        : relationshipData?.[row.id]?.isSelected 
                          ? 'bg-ag-dark-accent bg-opacity-20 border-ag-dark-accent border-opacity-50' 
                          : isRowSelected(row) 
                            ? 'bg-ag-dark-accent bg-opacity-20 border-ag-dark-accent border-opacity-50' 
                            : ''
                } ${
                  gridType === 'lists' && (row as any).hasIncomingTier
                    ? ''
                    : isCurrentObject(row) && !relationshipData?.[row.id]?.isSelected ? 'bg-blue-900 bg-opacity-30 border-blue-500 border-opacity-50' : ''
                } ${
                  isRowAffected(row) ? 'bg-red-900 bg-opacity-30 border-red-500 border-opacity-50' : ''
                } ${
                  dragOverIndex === index ? 'border-t-2 border-t-ag-dark-accent' : ''
                } ${
                  draggedRow?.id === row.id ? 'opacity-50' : ''
                }`}
              >
                {selectionMode === 'checkbox' && !relationshipData && (
                  <div className="w-10 flex items-center justify-center p-1.5 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={isRowSelected(row)}
                      onChange={(e) => {
                        handleRowSelection(row, e.target.checked);
                      }}
                      className="rounded border-ag-dark-border bg-ag-dark-surface text-ag-dark-accent focus:ring-ag-dark-accent focus:ring-2 focus:ring-offset-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
                {columns.map((column, colIndex) => {
                  // Calculate cell width - use same calculation as header for consistency
                  const parsedWidth = parseInt(column.width) || 140;
                  const columnWidth = columnWidths[column.key] || parsedWidth;
                  
                  // Check if this column should be flexible (width >= 9999 indicates flexible)
                  const isFlexibleColumn = parsedWidth >= 9999;
                  // For metadata, the actions column is part of columns array, so last column check is simpler
                  const isLastColumn = colIndex === columns.length - 1;
                  
                  const cellWidth = isFlexibleColumn && isLastColumn
                    ? undefined // Let flex handle it
                    : (isLargeGrid 
                      ? `var(--column-width-${column.key}, ${columnWidth}px)`
                      : `${columnWidth}px`);
                  
                  return (
                  <div
                    key={`${row.id || index}-${column.key}`}
                    className={`flex items-center text-xs text-ag-dark-text px-4 py-1.5 box-border ${
                      colIndex < columns.length - 1 ? 'border-r border-ag-dark-border' : ''
                    } ${
                      ['relationships', 'variants', 'variables'].includes(column.key) 
                        ? 'justify-end' 
                        : 'justify-start'
                    } ${isFlexibleColumn && isLastColumn ? 'flex-1' : 'flex-shrink-0'}`}
                    style={{  
                      ...(cellWidth ? { width: cellWidth } : { flex: '1 1 auto', minWidth: 0 }), 
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      minWidth: 0
                    }}
                  >
                    {column.render ? (
                      column.render(row)
                    ) : column.key === 'isMeme' ? (
                      // Only show checkbox for parent lists (not tiered lists)
                      gridType === 'lists' && (row as any).hasIncomingTier ? (
                        <div className="flex items-center justify-center w-4 h-4"></div>
                      ) : (
                        <div className="flex items-center justify-center">
                          {row._isMemeLoading ? (
                            <div className="w-4 h-4 border-2 border-ag-dark-accent border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <input
                              type="checkbox"
                              checked={!!row.isMeme}
                              onChange={(e) => {
                                e.stopPropagation();
                                // Prevent clicks on tier lists
                                if (gridType === 'lists' && (row as any).hasIncomingTier) {
                                  return;
                                }
                                onIsMemeChange?.(row.id, e.target.checked);
                              }}
                              className="rounded border-ag-dark-border bg-ag-dark-surface text-ag-dark-accent focus:ring-ag-dark-accent focus:ring-2 focus:ring-offset-0 cursor-pointer w-4 h-4"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Prevent clicks on tier lists
                                if (gridType === 'lists' && (row as any).hasIncomingTier) {
                                  e.preventDefault();
                                }
                              }}
                              disabled={row._isMemeLoading || (gridType === 'lists' && (row as any).hasIncomingTier)}
                            />
                          )}
                        </div>
                      )
                    ) : column.key === 'isGroupKey' ? (
                      // Only show for variables tab
                      gridType === 'variables' ? (
                        <div className="flex items-center justify-center">
                          {row._isGroupKeyLoading ? (
                            <div className="w-4 h-4 border-2 border-ag-dark-accent border-t-transparent rounded-full animate-spin"></div>
                          ) : (() => {
                            // Check if another variable in the same group has isGroupKey = true
                            const currentGroup = (row as any).group;
                            const isGroupKeyChecked = !!row.isGroupKey;
                            const anotherInGroupHasKey = data.some((otherRow: any) => 
                              otherRow.id !== row.id && 
                              otherRow.group === currentGroup && 
                              otherRow.isGroupKey === true
                            );
                            const isDisabled = anotherInGroupHasKey && !isGroupKeyChecked;
                            
                            return (
                              <input
                                type="checkbox"
                                checked={isGroupKeyChecked}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  onIsGroupKeyChange?.(row.id, e.target.checked);
                                }}
                                className={`rounded border-ag-dark-border bg-ag-dark-surface text-ag-dark-accent focus:ring-ag-dark-accent focus:ring-2 focus:ring-offset-0 w-4 h-4 ${
                                  isDisabled 
                                    ? 'opacity-50 cursor-not-allowed' 
                                    : 'cursor-pointer'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                disabled={isDisabled || row._isGroupKeyLoading}
                              />
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-4 h-4"></div>
                      )
                    ) : (
                      <span className={`flex-1 ${
                        column.key === 'object' 
                          ? 'font-bold text-yellow-400 text-base' 
                          : column.key === 'variable'
                            ? 'font-bold text-green-400 text-base'
                            : (column.key === 'list') 
                              ? 'font-bold text-purple-400 text-base' 
                              : ''
                      } ${
                        (column.key === 'sector' || column.key === 'domain' || column.key === 'country') && isColumnAffected(row, column.key) ? 'text-red-400' : ''
                      }`}
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        minWidth: 0,
                        maxWidth: '100%'
                      }}>
                        {(column.key === 'sector' || column.key === 'domain' || column.key === 'country') && isColumnAffected(row, column.key) ? 
                          formatDriverWithDeletedSector(row[column.key], deletedDriverType, column.key) : 
                          (column.key === 'sector' || column.key === 'domain' || column.key === 'country') ? 
                            (() => {
                              // Always parse from driver string if available - it's the source of truth
                              // This ensures values persist even after updates when parsed values might be missing
                              let value = row[column.key] || '';
                              
                              // Handle Lists data where sector/domain/country might be arrays
                              if (Array.isArray(value)) {
                                // Filter out "ALL" from array as it's not an actual value
                                const filteredArray = value.filter(v => v !== 'ALL');
                                
                                if (filteredArray.length === 0) {
                                  // Empty array or only "ALL" was in array
                                  value = 'ALL';
                                } else {
                                  // Check if all possible values are selected
                                  const driversData = getDriversData();
                                  let allPossibleValues: string[] = [];
                                  if (column.key === 'sector') {
                                    allPossibleValues = (driversData.sectors || []).filter(v => v !== 'ALL');
                                  } else if (column.key === 'domain') {
                                    allPossibleValues = (driversData.domains || []).filter(v => v !== 'ALL');
                                  } else if (column.key === 'country') {
                                    allPossibleValues = (driversData.countries || []).filter(v => v !== 'ALL');
                                  }
                                  
                                  // Check if all values are selected
                                  if (allPossibleValues.length > 0) {
                                    const selectedSet = new Set(filteredArray);
                                    const allSet = new Set(allPossibleValues);
                                    const isAllSelected = selectedSet.size === allSet.size && 
                                                         [...selectedSet].every(val => allSet.has(val));
                                    if (isAllSelected) {
                                      value = 'ALL';
                                    } else {
                                      // Join multiple values with comma (getGridDriverDisplayValue will handle trimming)
                                      // Use comma without space to match the format expected by getGridDriverDisplayValue
                                      value = filteredArray.join(',');
                                    }
                                  } else {
                                    // No possible values to compare, just join
                                    value = filteredArray.join(',');
                                  }
                                }
                              }
                              
                              if ((!value || value === '-') && row.driver) {
                                const parsed = parseDriverField(row.driver);
                                if (column.key === 'sector') {
                                  value = parsed.sector || '-';
                                } else if (column.key === 'domain') {
                                  value = parsed.domain || '-';
                                } else if (column.key === 'country') {
                                  value = parsed.country || '-';
                                }
                              }
                              return getGridDriverDisplayValue(column.key, value || '');
                            })() : 
                            (['relationships', 'variants', 'variables'].includes(column.key) 
                              ? (row && typeof row === 'object' && (row[column.key] === 0 || row[column.key] === null || row[column.key] === undefined) ? '-' : (row && typeof row === 'object' ? row[column.key] : '-'))
                              : (column.key === 'relevance')
                                ? (row && typeof row === 'object' ? (row['objectRelationships'] ?? 0) : 0)
                              : (column.key === 'list' && gridType === 'lists' && (row as any).hasIncomingTier && (row as any).tierNumber)
                                ? `Tier ${(row as any).tierNumber}: ${(row && typeof row === 'object' ? (row[column.key] || '-') : '-')}`
                                : (column.key === 'totalValuesCount')
                                  ? (row && typeof row === 'object' ? String(row[column.key] ?? 0) : '0')
                                  : (column.key === 'sampleValues')
                                    ? (() => {
                                        if (!row || typeof row !== 'object') return '-';
                                        const sampleVals = row[column.key];
                                        if (!Array.isArray(sampleVals) || sampleVals.length === 0) return '-';
                                        // Filter out empty values and show all distinct values (ordered by tier)
                                        // For multi-level lists, values are already ordered by tier (Tier 1, Tier 2, etc.)
                                        const filtered = sampleVals.filter(v => v && String(v).trim());
                                        // Show up to 50 values to avoid extremely long strings, add "..." if more
                                        const displayValues = filtered.slice(0, 50);
                                        const displayText = displayValues.join(', ');
                                        return displayText.length > 0 
                                          ? (filtered.length > 50 ? displayText + '...' : displayText)
                                          : '-';
                                      })()
                                    : (row && typeof row === 'object' ? (row[column.key] || '-') : '-'))
                        }
                      </span>
                    )}
                  </div>
                  );
                })}
                {showActionsColumn && (
                  <div className="w-20 flex items-center justify-center gap-2 px-2 py-1.5 flex-shrink-0">
                    {onClone && (gridType === 'objects' || gridType === 'variables') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onClone?.(row); }}
                        className="text-ag-dark-accent hover:text-ag-dark-accent-hover transition-colors"
                        title={`Clone this ${gridType === 'objects' ? 'Object' : 'Variable'}`}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete?.(row); }}
                      className={`text-ag-dark-error hover:text-red-400 transition-colors ${
                        isRequiredMetadataRow(row)
                          ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''
                      }`}
                      disabled={isRequiredMetadataRow(row)}
                      title={isRequiredMetadataRow(row)
                        ? 'Cannot delete required row' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {onReorder && (
                  <div className="w-12 flex items-center justify-center px-4 py-2 flex-shrink-0">
                    <GripVertical className={`w-4 h-4 text-ag-dark-text-secondary ${
                      isRequiredMetadataRow(row)
                        ? 'opacity-30 cursor-not-allowed' : 'cursor-move'
                    }`} />
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {filteredAndSortedData.length === 0 && (
            <div className="p-8 text-center text-ag-dark-text-secondary">
              <div className="text-lg font-medium mb-2">No data found</div>
              <div className="text-sm">Try adjusting your filters or add some data</div>
            </div>
          )}
        </div>
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
          gridType={gridType}
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
    if (!data) return [];
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