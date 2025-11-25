import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Upload, Edit2, ArrowUpDown, Eye, Trash2, Network, Filter } from 'lucide-react';
import { TabNavigation } from './components/TabNavigation';
import { DataGrid, FilterPanel } from './components/DataGrid';
import { MetadataPanel } from './components/MetadataPanel';
import { AddObjectPanel } from './components/AddObjectPanel';
import { BulkEditPanel } from './components/BulkEditPanel';
import { BulkObjectUploadModal } from './components/BulkObjectUploadModal';
import { VariableMetadataPanel } from './components/VariableMetadataPanel';
import { AddVariablePanel } from './components/AddVariablePanel';
import { BulkVariableUploadModal } from './components/BulkVariableUploadModal';
import { BulkEditVariablesPanel } from './components/BulkEditVariablesPanel';
import { BulkListUploadModal } from './components/BulkListUploadModal';
import { AddListPanel } from './components/AddListPanel';
import { mockObjectData, objectColumns, metadataFields, parseDriverField, parseDriverString, type ObjectData } from './data/mockData';
import { mockVariableData, variableColumns, variableMetadataFields, type VariableData } from './data/variablesData';
import { mockListData, listColumns, listMetadataFields, type ListData } from './data/listsData';
import { driversData, type ColumnType, columnLabels } from './data/driversData';
import { removeDriverAbbreviation } from './utils/driverAbbreviations';
import { useObjects } from './hooks/useObjects';
import { useDrivers } from './hooks/useDrivers';
import { useVariables } from './hooks/useVariables';
import { apiService } from './services/api';
import { DriversColumn } from './components/DriversColumn';
import { DriversMetadataPanel } from './components/DriversMetadataPanel';
import { ListMetadataPanel } from './components/ListMetadataPanel';
import { DriverDeleteModal } from './components/DriverDeleteModal';
import { CustomSortModal } from './components/CustomSortModal';
import { VariablesCustomSortModal } from './components/VariablesCustomSortModal';
import { VariablesOrderModal } from './components/VariablesOrderModal';
import { ObjectsOrderModal } from './components/ObjectsOrderModal';
import { ListsCustomSortModal } from './components/ListsCustomSortModal';
import { ListsOrderModal } from './components/ListsOrderModal';
import { ViewsModal } from './components/ViewsModal';
import { RelationshipModal } from './components/RelationshipModal';
import { Neo4jGraphModal } from './components/Neo4jGraphModal';
import LoadingModal from './components/LoadingModal';

function App() {
  const [activeTab, setActiveTab] = useState('objects');
  const [selectedRows, setSelectedRows] = useState<ObjectData[]>([]);
  const [selectedRowForMetadata, setSelectedRowForMetadata] = useState<ObjectData | VariableData | ListData | null>(null);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  
  // Relationship modal state
  const [isRelationshipModalOpen, setIsRelationshipModalOpen] = useState(false);
  const [initialRelationships, setInitialRelationships] = useState<any[]>([]);
  // Load persisted state from localStorage
  const loadPersistedState = () => {
    try {
      const savedFilters = localStorage.getItem('cdm_objects_filters');
      const savedCustomSortRules = localStorage.getItem('cdm_objects_custom_sort_rules');
      const savedCustomSortActive = localStorage.getItem('cdm_objects_custom_sort_active');
      const savedColumnSortActive = localStorage.getItem('cdm_objects_column_sort_active');
      
      return {
        filters: savedFilters ? JSON.parse(savedFilters) : {},
        customSortRules: savedCustomSortRules ? JSON.parse(savedCustomSortRules) : [],
        isCustomSortActive: savedCustomSortActive === 'true',
        isColumnSortActive: savedColumnSortActive === 'true'
      };
    } catch (error) {
      console.error('Error loading persisted state:', error);
      return {
        filters: {},
        customSortRules: [],
        isCustomSortActive: false,
        isColumnSortActive: false
      };
    }
  };

  const persistedState = loadPersistedState();
  const [filters, setFilters] = useState<Record<string, string>>(persistedState.filters);
  
  // Use API hook for objects data
  const { objects: apiObjects, loading: objectsLoading, error: objectsError, createObject, updateObject, deleteObject, updateObjectWithRelationshipsAndVariants, fetchObjects } = useObjects();
  
  // Use API hook for drivers data
  const { drivers: apiDrivers, loading: driversLoading, error: driversError, createDriver, updateDriver, deleteDriver } = useDrivers();
  
  // Use API hook for variables data
  const { variables: apiVariables, loading: variablesLoading, error: variablesError, createVariable, updateVariable, deleteVariable, createObjectRelationship, bulkUploadVariables, bulkUpdateVariables, fetchVariables } = useVariables();
  
  // Fallback to mock data if API fails
  const [data, setData] = useState<ObjectData[]>([]);
  const [isAddObjectOpen, setIsAddObjectOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkObjectUploadOpen, setIsBulkObjectUploadOpen] = useState(false);
  const [isNeo4jGraphModalOpen, setIsNeo4jGraphModalOpen] = useState(true);
  const [isNeo4jVariablesGraphModalOpen, setIsNeo4jVariablesGraphModalOpen] = useState(true);
  const [isNeo4jListsGraphModalOpen, setIsNeo4jListsGraphModalOpen] = useState(true);
  const [variableData, setVariableData] = useState<VariableData[]>([]);
  const [isAddVariableOpen, setIsAddVariableOpen] = useState(false);
  const [isBulkVariableUploadOpen, setIsBulkVariableUploadOpen] = useState(false);
  const [isBulkVariableUploading, setIsBulkVariableUploading] = useState(false);
  const [isBulkEditVariablesOpen, setIsBulkEditVariablesOpen] = useState(false);
  const [listData, setListData] = useState(mockListData);
  const [isBulkListUploadOpen, setIsBulkListUploadOpen] = useState(false);
  const [isAddListOpen, setIsAddListOpen] = useState(false);
  
  // Custom Sort state
  const [isCustomSortOpen, setIsCustomSortOpen] = useState(false);
  const [customSortRules, setCustomSortRules] = useState<Array<{
    id: string;
    column: string;
    sortOn: string;
    order: 'asc' | 'desc';
  }>>(persistedState.customSortRules);
  const [isCustomSortActive, setIsCustomSortActive] = useState(persistedState.isCustomSortActive);
  const [isColumnSortActive, setIsColumnSortActive] = useState(persistedState.isColumnSortActive);

  // Variables Custom Sort state - load from localStorage
  const loadVariablesPersistedState = () => {
    try {
      const savedVariablesCustomSortRules = localStorage.getItem('cdm_variables_custom_sort_rules');
      const savedVariablesCustomSortActive = localStorage.getItem('cdm_variables_custom_sort_active');
      const savedVariablesColumnSortActive = localStorage.getItem('cdm_variables_column_sort_active');
      // Support both old key (predefined_sort) and new key (order) for backward compatibility
      const savedOrderEnabled = localStorage.getItem('cdm_variables_order_enabled') || localStorage.getItem('cdm_variables_predefined_sort_enabled');
      const savedOrderSortOrder = localStorage.getItem('cdm_variables_order_sort_order') || localStorage.getItem('cdm_variables_predefined_sort_order');
      
      return {
        variablesCustomSortRules: savedVariablesCustomSortRules ? JSON.parse(savedVariablesCustomSortRules) : [],
        isVariablesCustomSortActive: savedVariablesCustomSortActive === 'true',
        isVariablesColumnSortActive: savedVariablesColumnSortActive === 'true',
        isOrderEnabled: savedOrderEnabled === 'true',
        orderSortOrder: savedOrderSortOrder ? JSON.parse(savedOrderSortOrder) : undefined
      };
    } catch (error) {
      console.error('Error loading persisted variables state:', error);
      return {
        variablesCustomSortRules: [],
        isVariablesCustomSortActive: false,
        isVariablesColumnSortActive: false,
        isOrderEnabled: false,
        orderSortOrder: undefined
      };
    }
  };

  const variablesPersistedState = loadVariablesPersistedState();
  const [isVariablesCustomSortOpen, setIsVariablesCustomSortOpen] = useState(false);
  const [isVariablesOrderOpen, setIsVariablesOrderOpen] = useState(false);
  const [variablesCustomSortRules, setVariablesCustomSortRules] = useState<Array<{
    id: string;
    column: string;
    sortOn: string;
    order: 'asc' | 'desc';
  }>>(variablesPersistedState.variablesCustomSortRules);
  const [isVariablesCustomSortActive, setIsVariablesCustomSortActive] = useState(variablesPersistedState.isVariablesCustomSortActive);
  const [isVariablesColumnSortActive, setIsVariablesColumnSortActive] = useState(variablesPersistedState.isVariablesColumnSortActive);
  const [isVariablesOrderEnabled, setIsVariablesOrderEnabled] = useState(variablesPersistedState.isOrderEnabled);
  const [variablesOrderSortOrder, setVariablesOrderSortOrder] = useState<{
    partOrder: string[];
    sectionOrder: string[];
    groupOrders: Record<string, string[]>;
    variableOrders: Record<string, string[]>;
  } | undefined>(variablesPersistedState.orderSortOrder);

  // Lists Custom Sort state - load from localStorage
  const loadListsPersistedState = () => {
    try {
      const savedListsCustomSortRules = localStorage.getItem('cdm_lists_custom_sort_rules');
      const savedListsCustomSortActive = localStorage.getItem('cdm_lists_custom_sort_active');
      const savedListsColumnSortActive = localStorage.getItem('cdm_lists_column_sort_active');
      
      return {
        listsCustomSortRules: savedListsCustomSortRules ? JSON.parse(savedListsCustomSortRules) : [],
        isListsCustomSortActive: savedListsCustomSortActive === 'true',
        isListsColumnSortActive: savedListsColumnSortActive === 'true'
      };
    } catch (error) {
      console.error('Error loading persisted lists state:', error);
      return {
        listsCustomSortRules: [],
        isListsCustomSortActive: false,
        isListsColumnSortActive: false
      };
    }
  };

  const listsPersistedState = loadListsPersistedState();
  const [isListsCustomSortOpen, setIsListsCustomSortOpen] = useState(false);
  const [isListsOrderOpen, setIsListsOrderOpen] = useState(false);
  const [listsCustomSortRules, setListsCustomSortRules] = useState<Array<{
    id: string;
    column: string;
    sortOn: string;
    order: 'asc' | 'desc';
  }>>(listsPersistedState.listsCustomSortRules);
  const [isListsCustomSortActive, setIsListsCustomSortActive] = useState(listsPersistedState.isListsCustomSortActive);
  const [isListsColumnSortActive, setIsListsColumnSortActive] = useState(listsPersistedState.isListsColumnSortActive);
  
  // Objects Default Order state - load from localStorage
  const loadObjectsPersistedState = () => {
    try {
      const savedObjectsOrderEnabled = localStorage.getItem('cdm_objects_order_enabled');
      const savedObjectsOrderSortOrder = localStorage.getItem('cdm_objects_order_sort_order');
      
      return {
        isOrderEnabled: savedObjectsOrderEnabled === 'true',
        orderSortOrder: savedObjectsOrderSortOrder ? JSON.parse(savedObjectsOrderSortOrder) : undefined
      };
    } catch (error) {
      console.error('Error loading persisted objects order state:', error);
      return {
        isOrderEnabled: false,
        orderSortOrder: undefined
      };
    }
  };

  const objectsPersistedState = loadObjectsPersistedState();
  const [isObjectsOrderOpen, setIsObjectsOrderOpen] = useState(false);
  const [isObjectsOrderEnabled, setIsObjectsOrderEnabled] = useState(objectsPersistedState.isOrderEnabled);
  const [objectsOrderSortOrder, setObjectsOrderSortOrder] = useState<{
    beingOrder: string[];
    avatarOrders: Record<string, string[]>;
    objectOrders: Record<string, string[]>;
  } | undefined>(objectsPersistedState.orderSortOrder);

  // Lists Default Order state - load from localStorage
  const loadListsOrderPersistedState = () => {
    try {
      const savedListsOrderEnabled = localStorage.getItem('cdm_lists_order_enabled');
      const savedListsOrderSortOrder = localStorage.getItem('cdm_lists_order_sort_order');
      
      return {
        isOrderEnabled: savedListsOrderEnabled === 'true',
        orderSortOrder: savedListsOrderSortOrder ? JSON.parse(savedListsOrderSortOrder) : undefined
      };
    } catch (error) {
      console.error('Error loading persisted lists order state:', error);
      return {
        isOrderEnabled: false,
        orderSortOrder: undefined
      };
    }
  };

  const listsOrderPersistedState = loadListsOrderPersistedState();
  const [isListsOrderEnabled, setIsListsOrderEnabled] = useState(listsOrderPersistedState.isOrderEnabled);
  const [listsOrderSortOrder, setListsOrderSortOrder] = useState<{
    setOrder: string[];
    groupingOrders: Record<string, string[]>;
    listOrders: Record<string, string[]>;
  } | undefined>(listsOrderPersistedState.orderSortOrder);

  // Views state
  const [isViewsOpen, setIsViewsOpen] = useState(false);
  const [isVariablesViewsOpen, setIsVariablesViewsOpen] = useState(false);
  const [isListsViewsOpen, setIsListsViewsOpen] = useState(false);
  const [activeView, setActiveView] = useState<string>('None');
  
  // Reset handlers state for DataGrid
  const [objectsResetHandlers, setObjectsResetHandlers] = useState<{ clearFilters: () => void; resetSorting: () => void; hasActiveFilters: boolean; hasActiveSorting: boolean } | null>(null);
  const [variablesResetHandlers, setVariablesResetHandlers] = useState<{ clearFilters: () => void; resetSorting: () => void; hasActiveFilters: boolean; hasActiveSorting: boolean } | null>(null);
  const [listsResetHandlers, setListsResetHandlers] = useState<{ clearFilters: () => void; resetSorting: () => void; hasActiveFilters: boolean; hasActiveSorting: boolean } | null>(null);
  const [activeVariablesView, setActiveVariablesView] = useState<string>('None');
  const [activeListsView, setActiveListsView] = useState<string>('None');

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'drivers' | 'objects' | 'variables' | 'lists' | 'general'>('general');

  // Apply view filtering to data for Objects tab
  const filteredData = useMemo(() => {
    if (activeView === 'None' || activeTab !== 'objects') {
      return data;
    }
    
    if (activeView === 'Generic') {
      return data.filter(item => 
        item.sector === 'ALL' && 
        item.domain === 'ALL' && 
        item.country === 'ALL'
      );
    }
    
    return data;
  }, [data, activeView, activeTab]);

  // Apply view filtering to data for Variables tab
  const filteredVariableData = useMemo(() => {
    if (activeVariablesView === 'None' || activeTab !== 'variables') {
      return variableData;
    }
    
    if (activeVariablesView === 'Generic') {
      return variableData.filter(item => 
        item.sector === 'ALL' && 
        item.domain === 'ALL' && 
        item.country === 'ALL'
      );
    }
    
    return variableData;
  }, [variableData, activeVariablesView, activeTab]);

  // Apply view filtering to data for Lists tab
  const filteredListData = useMemo(() => {
    if (activeListsView === 'None' || activeTab !== 'lists') {
      return listData;
    }
    
    if (activeListsView === 'Generic') {
      return listData.filter(item => 
        item.sector === 'ALL' && 
        item.domain === 'ALL' && 
        item.country === 'ALL'
      );
    }
    
    return listData;
  }, [listData, activeListsView, activeTab]);

  // Drivers tab state - use API data with fallback to mock data
  const [driversState, setDriversState] = useState(driversData);
  const [selectedColumn, setSelectedColumn] = useState<ColumnType | undefined>();
  
  // Driver delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<{name: string, type: ColumnType} | null>(null);
  
  // Track affected items for highlighting
  const [affectedObjectIds, setAffectedObjectIds] = useState<Set<string>>(new Set());
  const [affectedVariableIds, setAffectedVariableIds] = useState<Set<string>>(new Set());
  
  // Track which driver was deleted to show specific warning messages
  const [deletedDriverType, setDeletedDriverType] = useState<ColumnType | null>(null);

  // Calculate dynamic tab counts
  const driversCount = useMemo(() => {
    if (apiDrivers) {
      return (apiDrivers.sectors?.length || 0) + 
             (apiDrivers.domains?.length || 0) + 
             (apiDrivers.countries?.length || 0) + 
             (apiDrivers.objectClarifiers?.length || 0) + 
             (apiDrivers.variableClarifiers?.length || 0);
    }
    return 15; // fallback to mock data count
  }, [apiDrivers]);

  const objectsCount = useMemo(() => {
    return apiObjects?.length || 0;
  }, [apiObjects]);

  const variablesCount = useMemo(() => {
    return apiVariables?.length || 0;
  }, [apiVariables]);

  // Dynamic tabs with calculated counts
  const dynamicTabs = useMemo(() => [
    { id: 'drivers', label: 'Drivers', count: driversCount },
    { id: 'objects', label: 'Objects', count: objectsCount },
    { id: 'variables', label: 'Variables', count: variablesCount },
    { id: 'lists', label: 'Lists', count: 45 }, // Keep lists as static for now
    { id: 'ledgers', label: 'Ledgers' },
    { id: 'sources', label: 'Sources' }
  ], [driversCount, objectsCount, variablesCount]);
  const [selectedItem, setSelectedItem] = useState<string | undefined>();

  // Sync API objects data with local state
  React.useEffect(() => {
    console.log('App - objectsLoading:', objectsLoading);
    console.log('App - objectsError:', objectsError);
    console.log('App - apiObjects length:', apiObjects?.length);
    console.log('App - apiObjects first item:', apiObjects?.[0]);
    console.log('App - affectedObjectIds:', affectedObjectIds);
    
    // Show loading when objects are loading
    if (objectsLoading && activeTab === 'objects') {
      setIsLoading(true);
      setLoadingType('objects');
    } else {
      setIsLoading(false);
    }
    
    if (!objectsLoading) {
      if (objectsError) {
        // Fallback to mock data if API fails
        console.log('Objects API failed, using mock data:', objectsError);
        setData(mockObjectData);
      } else {
        // Always use API data, even if empty
        // Ensure apiObjects is an array before setting
        const objectsArray = Array.isArray(apiObjects) ? apiObjects : (apiObjects ? [apiObjects] : []);
        console.log('App - Setting data to apiObjects:', objectsArray);
        console.log('App - Affected object IDs before data update:', Array.from(affectedObjectIds));
        
        // Preserve unsaved cloned objects when syncing API data
        setData(prevData => {
          // Find all unsaved cloned objects in current data
          const unsavedClones = prevData.filter(obj => 
            obj._isCloned && !obj._isSaved && obj.id?.startsWith('clone-')
          );
          
          // Merge API data with unsaved clones
          // Remove any saved clones from unsaved clones list (they're now in API data)
          const stillUnsavedClones = unsavedClones.filter(clone => {
            // Check if this clone was saved (has a real ID in API data)
            // We can't easily match by content, so we'll keep all unsaved clones
            // The save handler will remove them from the list
            return true;
          });
          
          // Combine API data with unsaved clones
          const mergedData = [...objectsArray, ...stillUnsavedClones];
          
          console.log('App - Preserved unsaved clones:', stillUnsavedClones.length);
          return mergedData;
        });
        
        // Check if any of the affected objects are in the new data
        if (affectedObjectIds.size > 0) {
          const affectedObjectsInNewData = objectsArray.filter(obj => affectedObjectIds.has(obj.id));
          console.log('App - Affected objects in new data:', affectedObjectsInNewData.map(obj => ({ id: obj.id, driver: obj.driver })));
        }
        
        console.log('App - Data updated, affected object IDs should still be:', Array.from(affectedObjectIds));
      }
    }
  }, [apiObjects, objectsError, objectsLoading, activeTab]);

  // Function to apply saved order from localStorage
  // The backend already returns drivers in order (respecting d.order property)
  // We use localStorage to preserve custom user reordering across sessions
  const applySavedOrder = (driversData: any) => {
    const orderedDrivers = { ...driversData };
    
    // Check for saved order for each column type
    Object.keys(driversData).forEach(columnType => {
      const storageKey = `cdm_drivers_order_${columnType}`;
      const savedOrder = localStorage.getItem(storageKey);
      const currentItems = driversData[columnType as keyof typeof driversData] || [];
      // Filter out "ALL" from current items as it's not an actual value
      const currentItemsFiltered = currentItems.filter((item: string) => item !== 'ALL');
      
      if (savedOrder && currentItemsFiltered.length > 0) {
        try {
          const parsedOrder = JSON.parse(savedOrder);
          
          if (Array.isArray(parsedOrder)) {
            // Filter out "ALL" from saved order as it's not an actual value
            const parsedOrderFiltered = parsedOrder.filter((item: string) => item !== 'ALL');
            
            // Filter out items that no longer exist (deleted items)
            const validSavedItems = parsedOrderFiltered.filter((item: string) => currentItemsFiltered.includes(item));
            
            // Find new items that weren't in the saved order
            // These should be added at the end to preserve existing order
            const newItems = currentItemsFiltered.filter((item: string) => !parsedOrderFiltered.includes(item));
            
            // Combine: valid saved items in their saved order + new items at the end
            const finalOrder = [...validSavedItems, ...newItems];
            
            // Always use the saved order (if we have valid saved items) to preserve user's custom ordering
            // Only fall back to API order if saved order is empty or invalid
            if (validSavedItems.length > 0) {
              orderedDrivers[columnType as keyof typeof orderedDrivers] = finalOrder;
              
              // Update localStorage with the new order (including new items, excluding "ALL")
              localStorage.setItem(storageKey, JSON.stringify(finalOrder));
              
              console.log(`✅ Applied saved custom order for ${columnType}:`, finalOrder);
              console.log(`  - Valid saved items: ${validSavedItems.length}`);
              console.log(`  - New items added at end: ${newItems.length}`);
            } else {
              // No valid saved items, use API order and save it
              orderedDrivers[columnType as keyof typeof orderedDrivers] = currentItemsFiltered;
              localStorage.setItem(storageKey, JSON.stringify(currentItemsFiltered));
              console.log(`📝 No saved order for ${columnType}, using API order:`, currentItemsFiltered);
            }
          }
        } catch (error) {
          console.error(`❌ Error parsing saved order for ${columnType}:`, error);
          // On error, use API order
          orderedDrivers[columnType as keyof typeof orderedDrivers] = currentItemsFiltered;
          localStorage.setItem(storageKey, JSON.stringify(currentItemsFiltered));
        }
      } else if (currentItemsFiltered.length > 0) {
        // No saved order, use API order (which respects backend d.order property) and save it
        orderedDrivers[columnType as keyof typeof orderedDrivers] = currentItemsFiltered;
        localStorage.setItem(storageKey, JSON.stringify(currentItemsFiltered));
        console.log(`📝 Initial order saved for ${columnType} from API:`, currentItemsFiltered);
      }
    });
    
    return orderedDrivers;
  };

  // Sync API drivers data with local state
  React.useEffect(() => {
    // Show loading when drivers are loading
    if (driversLoading && activeTab === 'drivers') {
      setIsLoading(true);
      setLoadingType('drivers');
    } else if (activeTab === 'drivers') {
      setIsLoading(false);
    }
    
    if (!driversLoading) {
      if (driversError) {
        // Keep mock data if API fails
        console.log('Drivers API failed, using mock data:', driversError);
      } else if (apiDrivers) {
        // Always use API data, even if empty
        // Filter out "ALL" from drivers data as it's not an actual value, just a UI convenience
        const filteredDrivers = {
          ...apiDrivers,
          sectors: (apiDrivers.sectors || []).filter(v => v !== 'ALL'),
          domains: (apiDrivers.domains || []).filter(v => v !== 'ALL'),
          countries: (apiDrivers.countries || []).filter(v => v !== 'ALL')
        };
        // Apply saved order from localStorage if available
        const orderedDrivers = applySavedOrder(filteredDrivers);
        setDriversState(orderedDrivers);
      }
    }
  }, [apiDrivers, driversError, driversLoading, activeTab]);

  // Apply saved order when switching to drivers tab
  React.useEffect(() => {
    if (activeTab === 'drivers' && apiDrivers && !driversLoading) {
      // Filter out "ALL" from drivers data as it's not an actual value, just a UI convenience
      const filteredDrivers = {
        ...apiDrivers,
        sectors: (apiDrivers.sectors || []).filter(v => v !== 'ALL'),
        domains: (apiDrivers.domains || []).filter(v => v !== 'ALL'),
        countries: (apiDrivers.countries || []).filter(v => v !== 'ALL')
      };
      const orderedDrivers = applySavedOrder(filteredDrivers);
      setDriversState(orderedDrivers);
    }
  }, [activeTab, apiDrivers, driversLoading]);

  // Handle variables loading - show loading immediately when switching to variables tab
  React.useEffect(() => {
    if (activeTab === 'variables') {
      if (variablesLoading) {
        setIsLoading(true);
        setLoadingType('variables');
      } else if (variableData.length === 0 && !variablesError && apiVariables === undefined) {
        // If no data and no error yet and API hasn't returned, still show loading (initial load)
        setIsLoading(true);
        setLoadingType('variables');
      } else {
        setIsLoading(false);
      }
    } else {
      // When switching away from variables tab, ensure loading is cleared
      if (loadingType === 'variables') {
        setIsLoading(false);
      }
    }
  }, [variablesLoading, activeTab, variableData.length, variablesError, apiVariables, loadingType]);

  // Auto-open bulk edit panel when 2+ objects are selected
  useEffect(() => {
    if (selectedRows.length >= 2) {
      if (activeTab === 'variables') {
        setIsBulkEditVariablesOpen(true);
      } else if (activeTab === 'objects' || activeTab === 'lists') {
        setIsBulkEditOpen(true);
      }
    } else if (selectedRows.length === 1) {
      // Close bulk edit panel when selection becomes single
      setIsBulkEditOpen(false);
      setIsBulkEditVariablesOpen(false);
    } else if (selectedRows.length === 0) {
      // Close bulk edit panel when no selection
      setIsBulkEditOpen(false);
      setIsBulkEditVariablesOpen(false);
    }
  }, [selectedRows.length, activeTab]);

  // Handle lists loading - fetch from API
  React.useEffect(() => {
    if (activeTab === 'lists') {
      // Fetch lists from API
      setIsLoading(true);
      setLoadingType('lists');
      fetchLists().finally(() => {
        setIsLoading(false);
      });
    }
  }, [activeTab]);

  // Sync selectedRowForMetadata with updated data
  React.useEffect(() => {
    if (selectedRowForMetadata && data.length > 0) {
      const updatedObject = data.find(obj => obj.id === selectedRowForMetadata.id);
      if (updatedObject && JSON.stringify(updatedObject) !== JSON.stringify(selectedRowForMetadata)) {
        console.log('App - Updating selectedRowForMetadata with fresh data:', updatedObject);
        setSelectedRowForMetadata(updatedObject);
      }
    }
  }, [data, selectedRowForMetadata]);

  // Sync API variables data with local state
  React.useEffect(() => {
    console.log('Variables effect triggered:', { 
      variablesLoading, 
      variablesError, 
      apiVariablesLength: apiVariables?.length,
      apiVariablesType: typeof apiVariables,
      apiVariablesIsArray: Array.isArray(apiVariables)
    });
    if (!variablesLoading) {
      if (variablesError) {
        // Fallback to mock data if API fails
        console.log('Variables API failed, using mock data:', variablesError);
        setVariableData(mockVariableData);
      } else {
        // Always use API data, even if empty
        // Ensure apiVariables is an array before setting
        const variablesArray = Array.isArray(apiVariables) ? apiVariables : (apiVariables ? [apiVariables] : []);
        
        // Preserve unsaved cloned variables when syncing API data
        setVariableData(prevData => {
          // Find all unsaved cloned variables in current data
          const unsavedClones = prevData.filter(v => 
            v._isCloned && !v._isSaved && v.id?.startsWith('clone-')
          );
          
          // Filter out any cloned unsaved rows from API data (they shouldn't be there, but just in case)
          const filteredArray = variablesArray.filter((v: any) => !v._isCloned || v._isSaved);
          
          // Remove duplicates by ID (in case of any duplicates)
          const uniqueArray = filteredArray.filter((v: any, index: number, self: any[]) => 
            index === self.findIndex((t: any) => t.id === v.id)
          );
          
          // Combine API data with unsaved clones
          const mergedData = [...uniqueArray, ...unsavedClones];
          
          console.log('App - Preserved unsaved variable clones:', unsavedClones.length);
          console.log('Using API variables data:', uniqueArray);
          console.log('Setting variableData to:', mergedData);
          return mergedData;
        });
      }
    }
  }, [apiVariables, variablesError, variablesLoading]);

  // Make objects data available globally for variable object relationships
  React.useEffect(() => {
    (window as any).objectsData = data;
    (window as any).variablesData = variableData;
  }, [data]);

  // Also update when variableData changes
  React.useEffect(() => {
    (window as any).variablesData = variableData;
  }, [variableData]);

  // Make drivers data available globally for variable driver selections
  React.useEffect(() => {
    (window as any).driversData = driversState;
  }, [driversState]);

  // Clear selection when switching tabs
  React.useEffect(() => {
    setSelectedRows([]);
    setSelectedRowForMetadata(null);
  }, [activeTab]);
  // Get current metadata fields with values from selected row
  const currentMetadataFields = useMemo(() => {
    if (activeTab === 'lists') {
      if (!selectedRowForMetadata) return listMetadataFields;
      
      const selectedList = selectedRowForMetadata as ListData;
      return listMetadataFields.map(field => ({
        ...field,
        value: (() => {
          switch (field.key) {
            case 'format':
              return selectedList.format || '';
            case 'source':
              return selectedList.source || '';
            case 'upkeep':
              return selectedList.upkeep || '';
            case 'graph':
              return selectedList.graph || '';
            case 'origin':
              return selectedList.origin || '';
            case 'set':
              return selectedList.set || '';
            case 'grouping':
              return selectedList.grouping || '';
            case 'list':
              return selectedList.list || '';
            default:
              return '';
          }
        })()
      }));
    }
    
    if (activeTab === 'variables') {
      if (!selectedRowForMetadata) return variableMetadataFields;
      
      const selectedVariable = selectedRowForMetadata as VariableData;
      return variableMetadataFields.map(field => ({
        ...field,
        value: (() => {
          switch (field.key) {
            case 'driver':
              return selectedVariable.driver || '';
            case 'part':
              return selectedVariable.part || '';
            case 'section':
              return selectedVariable.section || '';
            case 'group':
              return selectedVariable.group || '';
            case 'variable':
              return selectedVariable.variable || '';
            case 'formatI':
              return selectedVariable.formatI || '';
            case 'formatII':
              return selectedVariable.formatII || '';
            case 'gType':
              return selectedVariable.gType || '';
            case 'validation':
              return selectedVariable.validation || '';
            case 'default':
              return selectedVariable.default || '';
            case 'graph':
              return selectedVariable.graph || 'Yes';
            default:
              return '';
          }
        })()
      }));
    }
    
    if (!selectedRowForMetadata) return metadataFields;
    
    const selectedObject = selectedRowForMetadata as ObjectData;
    return metadataFields.map(field => ({
      ...field,
      value: (() => {
        switch (field.key) {
          case 'driver':
            return selectedObject.driver;
          case 'being':
            return selectedObject.being;
          case 'avatar':
            return selectedObject.avatar;
          case 'object':
            return selectedObject.object;
          case 'sector':
            return selectedObject.sector || '';
          case 'domain':
            return selectedObject.domain || '';
          case 'country':
            return selectedObject.country || '';
          case 'classifier':
            return selectedObject.classifier || '';
          case 'identifier':
            return selectedObject.identifier || '';
          case 'discret':
            return selectedObject.discret || '';
          case 'status':
            return selectedObject.status || 'Active';
          default:
            return '';
        }
      })()
    }));
  }, [selectedRowForMetadata, activeTab]);

  const handleRowSelect = (rows: Record<string, any>[]) => {
    setSelectedRows(rows as ObjectData[]);
    if (rows.length === 1) {
      const selectedRow = rows[0];
      // For lists, always use the latest data from listData to ensure hasIncomingTier is up to date
      if (activeTab === 'lists') {
        const latestListData = listData.find(l => l.id === selectedRow.id);
        if (latestListData) {
          setSelectedRowForMetadata(latestListData);
          return;
        }
      }
      // Clear clone flags if this is not actually a clone (doesn't have temporary clone ID)
      // This prevents the clone panel from showing for saved variables
      if (selectedRow.id && !selectedRow.id.startsWith('clone-')) {
        const cleanRow = {
          ...selectedRow,
          _isCloned: undefined,
          _isSaved: undefined,
          _sourceId: undefined
        } as ObjectData | VariableData | ListData;
        setSelectedRowForMetadata(cleanRow);
      } else {
        setSelectedRowForMetadata(selectedRow as ObjectData | VariableData | ListData);
      }
    } else {
      setSelectedRowForMetadata(null);
    }
  };


  const handleDelete = async (row: Record<string, any>) => {
    console.log('🔴 handleDelete called with row:', row);
    console.log('🔴 activeTab:', activeTab);
    
    // If it's a cloned unsaved row, just remove it from the grid
    if (row._isCloned && !row._isSaved) {
      if (activeTab === 'objects') {
        setData(prev => prev.filter(item => item.id !== row.id));
      } else if (activeTab === 'variables') {
        setVariableData(prev => prev.filter(item => item.id !== row.id));
      }
      if (selectedRowForMetadata?.id === row.id) {
        setSelectedRowForMetadata(null);
      }
      return;
    }
    
    if (confirm('Are you sure you want to delete this row?')) {
      try {
        if (activeTab === 'objects') {
          console.log('🔴 Deleting object with id:', row.id);
          await deleteObject(row.id);
          console.log('🔴 Object deleted successfully');
        } else if (activeTab === 'lists') {
          try {
            await apiService.deleteList(row.id);
            setListData(prev => prev.filter(item => item.id !== row.id));
            // Remove from selectedRows if it was selected
            setSelectedRows(prev => prev.filter(item => item.id !== row.id));
          } catch (error) {
            console.error('Error deleting list:', error);
            // Fallback to local state update
            setListData(prev => prev.filter(item => item.id !== row.id));
            setSelectedRows(prev => prev.filter(item => item.id !== row.id));
          }
        } else if (activeTab === 'variables') {
          try {
            await deleteVariable(row.id);
            // Remove from state immediately
            setVariableData(prev => prev.filter(item => item.id !== row.id));
            // Remove from selectedRows if it was selected
            setSelectedRows(prev => prev.filter(item => item.id !== row.id));
            // Refresh variable data from API to ensure UI is in sync and deleted variables are removed from all components
            try {
              await fetchVariables();
            } catch (error) {
              console.error('Error refreshing variables after deletion:', error);
              // Don't clear UI if refresh fails - keep what we have
            }
          } catch (error) {
            console.error('Error deleting variable:', error);
            alert('Failed to delete variable. Please try again.');
          }
        }
        
        if (selectedRowForMetadata?.id === row.id) {
          setSelectedRowForMetadata(null);
        }
      } catch (error) {
        console.error('🔴 Failed to delete object:', error);
        // Fallback to local state update
        if (activeTab === 'objects') {
          setData(prev => prev.filter(item => item.id !== row.id));
          setSelectedRows(prev => prev.filter(item => item.id !== row.id));
        } else if (activeTab === 'lists') {
          try {
            await apiService.deleteList(row.id);
            setListData(prev => prev.filter(item => item.id !== row.id));
            setSelectedRows(prev => prev.filter(item => item.id !== row.id));
          } catch (error) {
            console.error('Error deleting list:', error);
            // Fallback to local state update
            setListData(prev => prev.filter(item => item.id !== row.id));
            setSelectedRows(prev => prev.filter(item => item.id !== row.id));
          }
        } else if (activeTab === 'variables') {
          setVariableData(prev => prev.filter(item => item.id !== row.id));
          setSelectedRows(prev => prev.filter(item => item.id !== row.id));
        }
        
        if (selectedRowForMetadata?.id === row.id) {
          setSelectedRowForMetadata(null);
        }
      }
    }
  };

  const handleClone = async (row: Record<string, any>) => {
    console.log('🧬 handleClone called with row:', row);
    console.log('🧬 activeTab:', activeTab);
    
    try {
      if (activeTab === 'objects') {
        // Get full object data including relationships and variants
        const fullObjectData = await apiService.getObject(row.id);
        
        // Parse driver string to get sector, domain, country for grid display
        const parsedDriver = parseDriverString(fullObjectData.driver || '');
        
        // Create cloned object with all data except name
        const clonedObject: any = {
          ...fullObjectData,
          id: `clone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Temporary ID
          object: '', // Clear object name - user must provide new name
          // Ensure grid display fields are populated
          sector: parsedDriver.sector.length > 0 ? parsedDriver.sector[0] : (fullObjectData.sector || ''),
          domain: parsedDriver.domain.length > 0 ? parsedDriver.domain[0] : (fullObjectData.domain || ''),
          country: parsedDriver.country.length > 0 ? parsedDriver.country[0] : (fullObjectData.country || ''),
          _isCloned: true,
          _isSaved: false,
          _sourceId: row.id // Keep reference to source for tracking
        };
        
        console.log('🧬 Created cloned object:', {
          id: clonedObject.id,
          object: clonedObject.object,
          driver: clonedObject.driver,
          sector: clonedObject.sector,
          domain: clonedObject.domain,
          country: clonedObject.country,
          _isCloned: clonedObject._isCloned
        });
        
        // Insert cloned row immediately below source row
        const currentData = [...data];
        const sourceIndex = currentData.findIndex(item => item.id === row.id);
        if (sourceIndex !== -1) {
          currentData.splice(sourceIndex + 1, 0, clonedObject);
          setData(currentData);
          
          // Auto-select the cloned row (single selection to prevent bulk edit mode)
          setSelectedRowForMetadata(clonedObject);
          setSelectedRows([clonedObject]);
          
          console.log('🧬 Inserted cloned object at index:', sourceIndex + 1, 'new length:', currentData.length);
        } else {
          console.error('🧬 Source object not found in data, cannot insert clone');
          // Fallback: just add to the end
          setData(prev => [...prev, clonedObject]);
          setSelectedRowForMetadata(clonedObject);
          setSelectedRows([clonedObject]);
        }
      } else if (activeTab === 'variables') {
        // Get relationships for the variable (backend doesn't have GET /variables/{id})
        let objectRelationshipsList: any[] = [];
        try {
          const relationshipsData = await apiService.getVariableObjectRelationships(row.id) as any;
          objectRelationshipsList = relationshipsData.relationships || [];
        } catch (error) {
          console.error('Failed to fetch variable relationships:', error);
          // Continue without relationships - user can add them later
        }
        
        // Create cloned variable with all data except name
        // Use row data directly since backend doesn't have GET /variables/{id}
        const clonedVariable: any = {
          ...row,
          id: `clone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Temporary ID
          variable: '', // Clear variable name - user must provide new name
          name: '', // Also clear name field if it exists
          objectRelationshipsList: objectRelationshipsList, // Include relationships
          _isCloned: true,
          _isSaved: false,
          _sourceId: row.id // Keep reference to source for tracking
        };
        
        console.log('🧬 Created cloned variable:', {
          id: clonedVariable.id,
          variable: clonedVariable.variable,
          part: clonedVariable.part,
          group: clonedVariable.group,
          _isCloned: clonedVariable._isCloned
        });
        
        // Insert cloned row immediately below source row
        const currentData = [...variableData];
        const sourceIndex = currentData.findIndex(item => item.id === row.id);
        console.log('🧬 Cloning variable - sourceIndex:', sourceIndex, 'currentData length:', currentData.length);
        if (sourceIndex !== -1) {
          currentData.splice(sourceIndex + 1, 0, clonedVariable);
          console.log('🧬 Inserted cloned variable at index:', sourceIndex + 1, 'new length:', currentData.length);
          console.log('🧬 Cloned variable:', clonedVariable);
          setVariableData(currentData);
          
          // Auto-select the cloned row (single selection to prevent bulk edit mode)
          setSelectedRowForMetadata(clonedVariable);
          setSelectedRows([clonedVariable]);
        } else {
          console.error('🧬 Source variable not found in variableData, cannot insert clone');
          // Fallback: just add to the end
          setVariableData(prev => [...prev, clonedVariable]);
          setSelectedRowForMetadata(clonedVariable);
          setSelectedRows([clonedVariable]);
        }
      }
    } catch (error) {
      console.error('🧬 Failed to clone:', error);
      alert('Failed to clone. Please try again.');
    }
  };

  const handleAddObject = async (newObjectData: ObjectData) => {
    try {
      // Convert the UI format to API format
      const driverParts = newObjectData.driver.split(', ').map(part => part.trim());
      const sector = driverParts[0] === 'ALL' ? ['ALL'] : [driverParts[0]];
      const domain = driverParts[1] === 'ALL' ? ['ALL'] : [driverParts[1]];
      const country = driverParts[2] === 'ALL' ? ['ALL'] : [driverParts[2]];
      const objectClarifier = driverParts[3] === 'None' ? 'None' : driverParts[3];
      
      const apiObjectData: any = {
        sector: sector,
        domain: domain,
        country: country,
        objectClarifier: objectClarifier,
        being: newObjectData.being,
        avatar: newObjectData.avatar,
        object: newObjectData.object,
        status: newObjectData.status || 'Active',
        // Include relationships and variants if they exist
        relationships: newObjectData.relationshipsList || [],
        variants: (newObjectData.variantsList || []).map(v => v.name)
      };
      
      // Include identifier data if present
      if (newObjectData.identifier) {
        apiObjectData.identifier = newObjectData.identifier;
        console.log('Including identifier data in create:', newObjectData.identifier);
      }
      
      await createObject(apiObjectData);
      setIsAddObjectOpen(false);
    } catch (error) {
      console.error('Failed to create object:', error);
      // Fallback to local state update
      setData(prev => [...prev, newObjectData]);
      setIsAddObjectOpen(false);
    }
  };

  const handleAddVariable = async (newVariableData: VariableData) => {
    try {
      // Create variable via API
      const createdVariable = await createVariable({
        driver: newVariableData.driver,
        part: newVariableData.part,
        group: newVariableData.group,
        section: newVariableData.section,
        variable: newVariableData.variable,
        formatI: newVariableData.formatI,
        formatII: newVariableData.formatII,
        gType: newVariableData.gType || '',
        validation: newVariableData.validation || '',
        default: newVariableData.default || '',
        graph: newVariableData.graph || 'Y',
        status: newVariableData.status || 'Active'
      });
      
      // Create object relationships if any
      if (newVariableData.objectRelationshipsList && newVariableData.objectRelationshipsList.length > 0) {
        for (const relationship of newVariableData.objectRelationshipsList) {
          await createObjectRelationship(createdVariable.id, {
            toBeing: relationship.toBeing,
            toAvatar: relationship.toAvatar,
            toObject: relationship.toObject
          });
        }
      }
      
      setIsAddVariableOpen(false);
    } catch (error) {
      console.error('Error creating variable:', error);
      alert('Failed to create variable. Please try again.');
    }
  };

  const handleBulkDelete = async () => {
    if (confirm(`Are you sure you want to delete ${selectedRows.length} ${activeTab}?`)) {
      const selectedIds = selectedRows.map(row => row.id);
      
      if (activeTab === 'variables') {
        // Delete variables via API - track successful deletions
        const successfulDeletions: string[] = [];
        const failedDeletions: string[] = [];
        
        for (const id of selectedIds) {
          try {
            await deleteVariable(id);
            successfulDeletions.push(id);
          } catch (error) {
            console.error(`Error deleting variable ${id}:`, error);
            failedDeletions.push(id);
          }
        }
        
        // Only remove successfully deleted variables from state
        if (successfulDeletions.length > 0) {
          setVariableData(prev => prev.filter(item => !successfulDeletions.includes(item.id)));
        }
        
        // Show feedback about results
        if (failedDeletions.length > 0) {
          alert(`Successfully deleted ${successfulDeletions.length} variable(s), but failed to delete ${failedDeletions.length} variable(s). Please try again or check server logs.`);
        } else if (successfulDeletions.length > 0) {
          alert(`Successfully deleted ${successfulDeletions.length} variable(s).`);
        }
        
        // Clear selections for successfully deleted items
        if (successfulDeletions.length > 0) {
          setSelectedRows(prev => prev.filter(row => !successfulDeletions.includes(row.id)));
          // Clear metadata panel if the selected variable was deleted
          if (selectedRowForMetadata && successfulDeletions.includes(selectedRowForMetadata.id)) {
            setSelectedRowForMetadata(null);
          }
        }
        
        // Refresh variable data from API to ensure UI is in sync
        try {
          await fetchVariables();
        } catch (error) {
          console.error('Error refreshing variables after deletion:', error);
          // Don't clear UI if refresh fails - keep what we have
        }
      } else if (activeTab === 'lists') {
        // Delete lists via API
        const successfulDeletions: string[] = [];
        const failedDeletions: string[] = [];
        
        for (const id of selectedIds) {
          try {
            await apiService.deleteList(id);
            successfulDeletions.push(id);
          } catch (error) {
            console.error(`Error deleting list ${id}:`, error);
            failedDeletions.push(id);
          }
        }
        
        // Only remove successfully deleted lists from state
        if (successfulDeletions.length > 0) {
          setListData(prev => prev.filter(item => !successfulDeletions.includes(item.id)));
          // Clear selections for successfully deleted items
          setSelectedRows(prev => prev.filter(row => !successfulDeletions.includes(row.id)));
          // Clear metadata panel if the selected list was deleted
          if (selectedRowForMetadata && successfulDeletions.includes(selectedRowForMetadata.id)) {
            setSelectedRowForMetadata(null);
          }
        }
        
        // Show feedback about results
        if (failedDeletions.length > 0) {
          alert(`Successfully deleted ${successfulDeletions.length} list(s), but failed to delete ${failedDeletions.length} list(s). Please try again or check server logs.`);
        } else if (successfulDeletions.length > 0) {
          alert(`Successfully deleted ${successfulDeletions.length} list(s).`);
        }
        
        // Refresh lists from API to ensure UI is in sync
        try {
          await fetchLists();
        } catch (error) {
          console.error('Error refreshing lists after deletion:', error);
          // Don't clear UI if refresh fails - keep what we have
        }
      } else if (activeTab === 'objects') {
        // Delete objects via API - track successful deletions
        const successfulDeletions: string[] = [];
        const failedDeletions: string[] = [];
        
        for (const id of selectedIds) {
          try {
            await deleteObject(id);
            successfulDeletions.push(id);
          } catch (error) {
            console.error(`Error deleting object ${id}:`, error);
            failedDeletions.push(id);
          }
        }
        
        // Only remove successfully deleted objects from state
        if (successfulDeletions.length > 0) {
          setData(prev => prev.filter(item => !successfulDeletions.includes(item.id)));
          // Clear selections for successfully deleted items
          setSelectedRows(prev => prev.filter(row => !successfulDeletions.includes(row.id)));
          // Clear metadata panel if the selected object was deleted
          if (selectedRowForMetadata && successfulDeletions.includes(selectedRowForMetadata.id)) {
            setSelectedRowForMetadata(null);
          }
        }
        
        // Show feedback about results
        if (failedDeletions.length > 0) {
          alert(`Successfully deleted ${successfulDeletions.length} object(s), but failed to delete ${failedDeletions.length} object(s). Please try again or check server logs.`);
        } else if (successfulDeletions.length > 0) {
          alert(`Successfully deleted ${successfulDeletions.length} object(s).`);
        }
        
        // Refresh objects from API to ensure UI is in sync
        try {
          await fetchObjects();
        } catch (error) {
          console.error('Error refreshing objects after deletion:', error);
          // Don't clear UI if refresh fails - keep what we have
        }
      }
      
      setIsBulkDeleteOpen(false);
    }
  };

  const handleBulkEdit = async (updatedData: Record<string, any>) => {
    const selectedIds = selectedRows.map(row => row.id);
    
    // Handle variables bulk edit via API
    if (activeTab === 'variables') {
      try {
        // Prepare bulk update data
        const bulkUpdateData = {
          variable_ids: selectedIds,
          ...updatedData
        };
        
        // Call the bulk update API
        await bulkUpdateVariables(bulkUpdateData);
        
        // Close modal and clear selections
        setIsBulkEditVariablesOpen(false);
        setSelectedRows([]);
        setSelectedRowForMetadata(null);
        return;
      } catch (error) {
        console.error('Failed to bulk update variables:', error);
        alert('Failed to update variables. Please try again.');
        return;
      }
    }
    
    // Handle objects bulk edit via API
    if (activeTab === 'objects') {
      try {
        console.log('🔄 Bulk edit - selectedIds:', selectedIds);
        console.log('🔄 Bulk edit - updatedData:', updatedData);
        
        // Check for variant duplicates if variants are being added
        if (updatedData.variantsList && updatedData.variantsList.length > 0) {
          console.log('🔄 Checking for variant duplicates across selected objects...');
          
          const newVariantNames = updatedData.variantsList
            .filter((v: any) => v.name && v.name.trim())
            .map((v: any) => v.name.toLowerCase());
          
          console.log('🔄 New variant names to add:', newVariantNames);
          
          // Check each selected object for existing variants
          for (const objectId of selectedIds) {
            const selectedObject = data.find(obj => obj.id === objectId);
            if (selectedObject && selectedObject.variantsList) {
              const existingVariantNames = selectedObject.variantsList
                .map((v: any) => v.name.toLowerCase());
              
              console.log(`🔄 Object ${objectId} existing variants:`, existingVariantNames);
              
              // Check for duplicates
              const duplicates = newVariantNames.filter((newName: string) => 
                existingVariantNames.includes(newName)
              );
              
              if (duplicates.length > 0) {
                const duplicateNames = updatedData.variantsList
                  .filter((v: any) => duplicates.includes(v.name.toLowerCase()))
                  .map((v: any) => v.name);
                
                alert(`Cannot save: The following variant names conflict with existing variants in the selected objects: ${duplicateNames.join(', ')}. Please remove duplicates before saving.`);
                return;
              }
            }
          }
          
          console.log('✅ No variant duplicates found, proceeding with bulk edit...');
        }
        
        // Update each selected object via API
        for (const objectId of selectedIds) {
          // Prepare the update data for this object
          const objectUpdateData = { ...updatedData };
          
          // Map objectName to object for backend compatibility
          if (objectUpdateData.objectName) {
            objectUpdateData.object = objectUpdateData.objectName;
            delete objectUpdateData.objectName;
          }
          
          console.log(`🔄 Bulk edit - updating object ${objectId} with data:`, objectUpdateData);
          console.log(`🔄 Bulk edit - variantsList field:`, objectUpdateData.variantsList);
          
          // Call the updateObject API for each object
          await updateObject(objectId, objectUpdateData);
        }
        
        console.log('✅ Bulk edit completed successfully');
        
        // Force refresh the data to ensure UI shows updated values
        console.log('🔄 Forcing data refresh after bulk edit...');
        // Store current affected state before refresh
        const currentAffectedObjects = new Set(affectedObjectIds);
        const currentAffectedVariables = new Set(affectedVariableIds);
        const currentDeletedDriverType = deletedDriverType;
        
        await fetchObjects();
        
        // Restore affected state after refresh
        setAffectedObjectIds(currentAffectedObjects);
        setAffectedVariableIds(currentAffectedVariables);
        setDeletedDriverType(currentDeletedDriverType);
        
        // Close modal and clear selections
        setIsBulkEditOpen(false);
        setSelectedRows([]);
        setSelectedRowForMetadata(null);
        return;
      } catch (error) {
        console.error('❌ Failed to bulk update objects:', error);
        alert('Failed to update objects. Please try again.');
        return;
      }
    }
    
    const updateFunction = (prev: any[]) => prev.map((item: any) => {
      if (selectedIds.includes(item.id)) {
        const updated = { ...item };
        
        if (activeTab === 'lists') {
          // Update list fields - override existing values if they were changed
          // Skip relationships and list values for now (will be implemented later)
          Object.keys(updatedData).forEach(key => {
            if (updatedData[key] !== undefined && updatedData[key] !== '' && !['variablesAttachedList', 'listValuesList'].includes(key)) {
              updated[key] = updatedData[key];
            }
          });
          
          // Handle relationships - skip for now (will be implemented later)
          // Handle list values - skip for now (will be implemented later)
        } else {
          // Update object fields if they were changed
          if (updatedData.driver) updated.driver = updatedData.driver;
          if (updatedData.being) updated.being = updatedData.being;
          if (updatedData.avatar) updated.avatar = updatedData.avatar;
          if (updatedData.objectName) updated.object = updatedData.objectName;
          
          // Append new relationships if any were added
          if (updatedData.relationshipsList && updatedData.relationshipsList.length > 0) {
            const existingRelationships = updated.relationshipsList || [];
            updated.relationshipsList = [...existingRelationships, ...updatedData.relationshipsList];
            updated.relationships = updated.relationshipsList.length;
          }
          
          // Append new variants if any were added
          if (updatedData.variantsList && updatedData.variantsList.length > 0) {
            const existingVariants = updated.variantsList || [];
            updated.variantsList = [...existingVariants, ...updatedData.variantsList];
            updated.variants = updated.variantsList.length;
          }
        }
        
        return updated;
      }
      return item;
    });

    if (activeTab === 'lists') {
      // Update lists via API
      try {
        console.log('🔄 Bulk edit lists - selectedIds:', selectedIds);
        console.log('🔄 Bulk edit lists - updatedData:', updatedData);
        
        // Update each selected list via API
        for (const listId of selectedIds) {
          // Prepare the update data for this list
          const listUpdateData = { ...updatedData };
          console.log(`🔄 Bulk edit - updating list ${listId} with data:`, listUpdateData);
          
          // Call the updateList API for each list
          await apiService.updateList(listId, listUpdateData);
        }
        
        console.log('✅ Bulk edit lists completed successfully');
        
        // Force refresh the data to ensure UI shows updated values
        await fetchLists();
        
        // Close modal and clear selections
        setIsBulkEditOpen(false);
        setSelectedRows([]);
        setSelectedRowForMetadata(null);
        return;
      } catch (error) {
        console.error('❌ Failed to bulk update lists:', error);
        alert('Failed to update lists. Please try again.');
        return;
      }
    } else {
      setData(updateFunction);
    }
    
    setIsBulkEditOpen(false);
    setSelectedRows([]);
    setSelectedRowForMetadata(null);
  };
  const handleMetadataSave = async (updatedData: Record<string, any>) => {
    console.log('handleMetadataSave called with:', updatedData);
    
    // If this is a relationship refresh (from VariableObjectRelationshipModal), refresh variables and return
    if (updatedData._refreshRelationships && activeTab === 'variables') {
      await fetchVariables();
      return;
    }
    
    // If this is a relationship update for a cloned variable (not saving yet), just update local state
    if (updatedData._isRelationshipUpdate && activeTab === 'variables' && selectedRowForMetadata?._isCloned && !selectedRowForMetadata?._isSaved) {
      setVariableData(prev => prev.map(item => 
        item.id === selectedRowForMetadata.id 
          ? { ...item, objectRelationshipsList: updatedData.objectRelationshipsList }
          : item
      ));
      setSelectedRowForMetadata(prev => prev ? { ...prev, objectRelationshipsList: updatedData.objectRelationshipsList } : null);
      return;
    }
    
    if (selectedRowForMetadata) {
      let gridData = { ...updatedData };
      
      // Handle cloned rows - need to create new instead of update
      if (selectedRowForMetadata._isCloned && !selectedRowForMetadata._isSaved) {
        if (activeTab === 'objects') {
          // Validate that object name is provided
          if (!updatedData.object || !updatedData.object.trim()) {
            alert('Please define a new Object name to save this clone.');
            throw new Error('Object name is required');
          }
          
          // Check for duplicate object name (case-insensitive)
          // An object is unique by: sector, domain, country, objectClarifier, being, avatar, object
          const driverParts = updatedData.driver.split(', ').map(part => part.trim());
          const sector = driverParts[0] === 'ALL' ? ['ALL'] : [driverParts[0]];
          const domain = driverParts[1] === 'ALL' ? ['ALL'] : [driverParts[1]];
          const country = driverParts[2] === 'ALL' ? ['ALL'] : [driverParts[2]];
          const objectClarifier = driverParts[3] === 'None' ? 'None' : driverParts[3];
          
          // Check if an object with the same combination already exists
          const duplicateObject = data.find(obj => {
            if (obj.id === selectedRowForMetadata.id) return false; // Don't check against self
            const objDriverParts = (obj.driver || '').split(', ').map((p: string) => p.trim());
            const objSector = objDriverParts[0] === 'ALL' ? ['ALL'] : [objDriverParts[0]];
            const objDomain = objDriverParts[1] === 'ALL' ? ['ALL'] : [objDriverParts[1]];
            const objCountry = objDriverParts[2] === 'ALL' ? ['ALL'] : [objDriverParts[2]];
            const objClarifier = objDriverParts[3] === 'None' ? 'None' : objDriverParts[3];
            
            return obj.being === updatedData.being &&
                   obj.avatar === updatedData.avatar &&
                   obj.object?.toLowerCase() === updatedData.object?.toLowerCase() &&
                   JSON.stringify(objSector) === JSON.stringify(sector) &&
                   JSON.stringify(objDomain) === JSON.stringify(domain) &&
                   JSON.stringify(objCountry) === JSON.stringify(country) &&
                   objClarifier === objectClarifier;
          });
          
          if (duplicateObject) {
            alert(`Cannot save: An object with the same combination of Sector, Domain, Country, Object Clarifier, Being, Avatar, and Object name already exists. Please change the Object name or modify other fields to make it unique.`);
            throw new Error('Duplicate object detected');
          }
          
          try {
            
            // Use relationships and variants from updatedData (which includes user edits from metadata panel)
            // If not provided, fall back to cloned data
            const relationshipsToUse = updatedData.relationshipsList || selectedRowForMetadata.relationshipsList || [];
            const variantsToUse = updatedData.variantsList || selectedRowForMetadata.variantsList || [];
            
            // Process relationships - update intra-table relationships to point to new cloned object
            const processedRelationships = relationshipsToUse.map((rel: any) => {
              // Check if this is an intra-table relationship (points to the original object)
              const isIntraTable = rel.toBeing === selectedRowForMetadata.being &&
                                   rel.toAvatar === selectedRowForMetadata.avatar &&
                                   rel.toObject === selectedRowForMetadata.object;
              
              if (isIntraTable) {
                // Update to point to the new cloned object
                return {
                  ...rel,
                  toBeing: updatedData.being,
                  toAvatar: updatedData.avatar,
                  toObject: updatedData.object
                };
              }
              // For inter-table relationships, keep as-is
              return rel;
            });
            
            // Process variants - convert to array of names if needed
            const processedVariants = variantsToUse.map((v: any) => typeof v === 'string' ? v : (v.name || v));
            
            const apiObjectData: any = {
              sector: sector,
              domain: domain,
              country: country,
              objectClarifier: objectClarifier,
              being: updatedData.being,
              avatar: updatedData.avatar,
              object: updatedData.object,
              status: updatedData.status || 'Active',
              // Include processed relationships (with intra-table relationships updated)
              relationships: processedRelationships,
              variants: processedVariants
            };
            
            // Include identifier data if present
            if (selectedRowForMetadata.identifier) {
              apiObjectData.identifier = selectedRowForMetadata.identifier;
            }
            
            // Create new object via API (this will clone relationships and variants)
            const createdObject = await createObject(apiObjectData);
            const newObjectId = createdObject.id;
            
            // Remove the cloned row from local state immediately
            setData(prev => prev.filter(item => item.id !== selectedRowForMetadata.id));
            
            // Refresh objects to get updated data (this will add the new object)
            await fetchObjects();
            
            // Wait for the data sync to complete and find the new object
            // Use a retry mechanism to find the object after the sync
            let foundObject = null;
            for (let i = 0; i < 10; i++) {
              await new Promise(resolve => setTimeout(resolve, 150));
              
              // Check apiObjects from the hook (should be updated after fetchObjects)
              if (apiObjects && Array.isArray(apiObjects)) {
                foundObject = apiObjects.find((obj: any) => obj.id === newObjectId);
                if (foundObject) break;
              }
            }
            
            // If found in apiObjects, use it (it will be synced to data by useEffect)
            if (foundObject) {
              // Parse driver for grid display fields
              const parsed = parseDriverString(foundObject.driver || '');
              const parsedObject = {
                ...foundObject,
                sector: parsed.sector.length > 0 ? parsed.sector[0] : (foundObject.sector || ''),
                domain: parsed.domain.length > 0 ? parsed.domain[0] : (foundObject.domain || ''),
                country: parsed.country.length > 0 ? parsed.country[0] : (foundObject.country || '')
              };
              
              // Update selected row with the new object (without clone flags)
              setSelectedRowForMetadata(parsedObject);
              setSelectedRows([parsedObject]);
            } else {
              // Fallback: get fresh data from API and ensure it's in the data array
              const freshObjectData = await apiService.getObject(newObjectId) as any;
              // Parse driver for grid display
              const parsed = parseDriverString(freshObjectData.driver || '');
              const parsedObject = {
                ...freshObjectData,
                sector: parsed.sector.length > 0 ? parsed.sector[0] : '',
                domain: parsed.domain.length > 0 ? parsed.domain[0] : '',
                country: parsed.country.length > 0 ? parsed.country[0] : ''
              };
              
              // Ensure it's in the data array
              setData(prev => {
                const exists = prev.find(obj => obj.id === parsedObject.id);
                if (!exists) {
                  return [...prev, parsedObject];
                }
                return prev.map(obj => obj.id === parsedObject.id ? parsedObject : obj);
              });
              
              setSelectedRowForMetadata(parsedObject);
              setSelectedRows([parsedObject]);
            }
          } catch (error: any) {
            console.error('Error saving cloned object:', error);
            const errorMessage = error?.message || 'Failed to save clone. Please try again.';
            if (errorMessage.includes('Duplicate') || errorMessage.includes('already exists')) {
              alert(`Duplicate detected: ${errorMessage}`);
            } else {
              alert(errorMessage);
            }
            throw error;
          }
          return;
        } else if (activeTab === 'variables') {
          // Validate that variable name is provided
          if (!updatedData.variable || !updatedData.variable.trim()) {
            alert('Please define a new Variable name to save this clone.');
            throw new Error('Variable name is required');
          }
          
          // Check for duplicate variable name (case-insensitive)
          // A variable is unique by: sector, domain, country, variableClarifier, part, group, variable
          const driverParts = (updatedData.driver || selectedRowForMetadata.driver || 'ALL, ALL, ALL, None').split(', ').map((p: string) => p.trim());
          const sector = driverParts[0] === 'ALL' ? ['ALL'] : [driverParts[0]];
          const domain = driverParts[1] === 'ALL' ? ['ALL'] : [driverParts[1]];
          const country = driverParts[2] === 'ALL' ? ['ALL'] : [driverParts[2]];
          const variableClarifier = driverParts[3] === 'None' ? 'None' : driverParts[3];
          
          // Check if a variable with the same combination already exists
          const duplicateVariable = variableData.find(v => {
            if (v.id === selectedRowForMetadata.id) return false; // Don't check against self
            const vDriverParts = (v.driver || '').split(', ').map((p: string) => p.trim());
            const vSector = vDriverParts[0] === 'ALL' ? ['ALL'] : [vDriverParts[0]];
            const vDomain = vDriverParts[1] === 'ALL' ? ['ALL'] : [vDriverParts[1]];
            const vCountry = vDriverParts[2] === 'ALL' ? ['ALL'] : [vDriverParts[2]];
            const vClarifier = vDriverParts[3] === 'None' ? 'None' : vDriverParts[3];
            
            return v.part === (updatedData.part || selectedRowForMetadata.part) &&
                   v.group === (updatedData.group || selectedRowForMetadata.group) &&
                   v.variable?.toLowerCase() === updatedData.variable?.toLowerCase() &&
                   JSON.stringify(vSector) === JSON.stringify(sector) &&
                   JSON.stringify(vDomain) === JSON.stringify(domain) &&
                   JSON.stringify(vCountry) === JSON.stringify(country) &&
                   vClarifier === variableClarifier;
          });
          
          if (duplicateVariable) {
            alert(`Cannot save: A variable with the same combination of Sector, Domain, Country, Variable Clarifier, Part, Group, and Variable name already exists. Please change the Variable name or modify other fields to make it unique.`);
            throw new Error('Duplicate variable detected');
          }
          
          try {
            console.log('🧬 Creating cloned variable with data:', {
              driver: updatedData.driver,
              part: updatedData.part,
              group: updatedData.group,
              section: updatedData.section,
              variable: updatedData.variable
            });
            
            // Create new variable via API
            // Use formData values if available, otherwise fall back to selectedRowForMetadata
            const variableToCreate = {
              driver: updatedData.driver || selectedRowForMetadata.driver || 'ALL, ALL, ALL, None',
              part: updatedData.part || selectedRowForMetadata.part || '',
              group: updatedData.group || selectedRowForMetadata.group || '',
              section: updatedData.section || selectedRowForMetadata.section || '',
              variable: updatedData.variable || selectedRowForMetadata.variable || '',
              formatI: updatedData.formatI || selectedRowForMetadata.formatI || '',
              formatII: updatedData.formatII || selectedRowForMetadata.formatII || '',
              gType: updatedData.gType || selectedRowForMetadata.gType || '',
              validation: updatedData.validation || selectedRowForMetadata.validation || '',
              default: updatedData.default || selectedRowForMetadata.default || '',
              graph: updatedData.graph || selectedRowForMetadata.graph || 'Y',
              status: updatedData.status || selectedRowForMetadata.status || 'Active'
            };
            
            console.log('🧬 Variable data to create:', variableToCreate);
            
            const createdVariable = await createVariable(variableToCreate);
            
            console.log('🧬 Variable created successfully:', createdVariable);
            
            // Use relationships from updatedData (which includes user edits from metadata panel)
            // If not provided, fall back to cloned data
            const relationshipsToUse = updatedData.objectRelationshipsList || selectedRowForMetadata.objectRelationshipsList || [];
            
            console.log('🧬 Cloning relationships:', relationshipsToUse.length);
            
            // Clone object relationships if any
            if (relationshipsToUse.length > 0) {
              for (const relationship of relationshipsToUse) {
                try {
                  await createObjectRelationship(createdVariable.id, {
                    toBeing: relationship.toBeing,
                    toAvatar: relationship.toAvatar,
                    toObject: relationship.toObject
                  });
                  console.log('🧬 Relationship created:', relationship);
                } catch (relError) {
                  console.error('🧬 Failed to create relationship:', relError);
                  // Continue with other relationships even if one fails
                }
              }
            }
            
            // Remove the cloned row from local state BEFORE refreshing (to prevent duplicates)
            setVariableData(prev => prev.filter(item => item.id !== selectedRowForMetadata.id));
            
            console.log('🧬 Refreshing variables...');
            // Refresh variables to get updated data (this will include the newly created variable)
            await fetchVariables();
            
            // Wait for variablesLoading to complete
            let loadingAttempts = 0;
            while (variablesLoading && loadingAttempts < 50) { // 5 seconds max wait
              await new Promise(resolve => setTimeout(resolve, 100));
              loadingAttempts++;
            }
            
            // Now find the variable in apiVariables (which should be updated)
            let freshVariableData = null;
            let attempts = 0;
            const maxAttempts = 20; // 2 seconds total (20 * 100ms)
            
            while (!freshVariableData && attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Check apiVariables first (from hook, updated immediately after fetchVariables)
              if (apiVariables && Array.isArray(apiVariables)) {
                freshVariableData = apiVariables.find((v: any) => v.id === createdVariable.id);
                if (freshVariableData) {
                  console.log('🧬 Found in apiVariables:', freshVariableData);
                  break;
                }
              }
              
              attempts++;
            }
            
            // If still not found, wait a bit more for useEffect to sync to variableData
            if (!freshVariableData) {
              await new Promise(resolve => setTimeout(resolve, 300));
              // Check variableData one more time
              const currentData = variableData;
              freshVariableData = currentData.find((v: any) => v.id === createdVariable.id);
              if (freshVariableData) {
                console.log('🧬 Found in variableData after sync:', freshVariableData);
              }
            }
            
            if (freshVariableData) {
              console.log('🧬 Found fresh variable data:', freshVariableData);
              // Explicitly remove clone flags to ensure clean state
              const cleanVariableData = {
                ...freshVariableData,
                _isCloned: undefined,
                _isSaved: undefined,
                _sourceId: undefined
              };
              // Update selected row with fresh data (remove clone flags)
              setSelectedRowForMetadata(cleanVariableData);
              setSelectedRows([cleanVariableData]);
            } else {
              console.warn('🧬 Could not find fresh variable data after refresh, using created variable:', createdVariable);
              // Fallback: use the created variable data directly and add it to the grid
              // This ensures the variable appears even if the refresh didn't work
              const fallbackVariable = {
                ...createdVariable,
                objectRelationships: 0,
                objectRelationshipsList: relationshipsToUse,
                _isCloned: undefined,
                _isSaved: undefined,
                _sourceId: undefined
              };
              setVariableData(prev => {
                // Check if it's already there to avoid duplicates
                const exists = prev.find(v => v.id === createdVariable.id);
                if (!exists) {
                  return [...prev, fallbackVariable];
                }
                return prev;
              });
              setSelectedRowForMetadata(fallbackVariable);
              setSelectedRows([fallbackVariable]);
            }
          } catch (error: any) {
            console.error('🧬 Error saving cloned variable:', error);
            const errorMessage = error?.message || 'Failed to save clone. Please try again.';
            if (errorMessage.includes('Duplicate') || errorMessage.includes('already exists')) {
              alert(`Duplicate detected: ${errorMessage}`);
            } else {
              alert(`Failed to save clone: ${errorMessage}`);
            }
            throw error;
          }
          return;
        }
      }
      
      if (activeTab === 'variables') {
        // Handle variables update via API
        try {
          // Filter out objectRelationshipsList from the variable update data
          const { objectRelationshipsList, ...variableUpdateData } = updatedData;
          
          console.log('objectRelationshipsList:', objectRelationshipsList);
          console.log('variableUpdateData:', variableUpdateData);
          console.log('Validation field in update:', variableUpdateData.validation);
          
          const result = await updateVariable(selectedRowForMetadata.id, variableUpdateData);
          
          console.log('Update result from API:', result);
          console.log('Validation field in result:', result?.validation);
          
          // Handle object relationships if they exist
          if (objectRelationshipsList && objectRelationshipsList.length > 0) {
            console.log('Creating object relationships:', objectRelationshipsList);
            try {
              // Create object relationships in Neo4j
              for (const relationship of objectRelationshipsList) {
                console.log('Creating relationship:', relationship);
                if (relationship.toBeing && relationship.toAvatar && relationship.toObject) {
                  console.log('Calling createObjectRelationship with:', {
                    toBeing: relationship.toBeing,
                    toAvatar: relationship.toAvatar,
                    toObject: relationship.toObject
                  });
                  await createObjectRelationship(selectedRowForMetadata.id, {
                    toBeing: relationship.toBeing,
                    toAvatar: relationship.toAvatar,
                    toObject: relationship.toObject
                  });
                  console.log('Relationship created successfully');
                }
              }
            } catch (relationshipError) {
              console.error('Error creating object relationships:', relationshipError);
              // Show error to user but don't fail the entire save
              alert('Variable saved but failed to create some object relationships. Please check the relationships section.');
            }
          } else {
            console.log('No object relationships to create');
          }
          
          // Update local state with the result from API (which includes all updated fields like validation)
          if (result) {
            setVariableData(prev => prev.map(item => 
              item.id === selectedRowForMetadata.id 
                ? { ...item, ...result }
                : item
            ));
            
            // Update selectedRowForMetadata with the API response to ensure all fields (including validation) are synced
            setSelectedRowForMetadata({ ...selectedRowForMetadata, ...result });
          } else {
            // Fallback: update with variableUpdateData if result is not available
            setVariableData(prev => prev.map(item => 
              item.id === selectedRowForMetadata.id 
                ? { ...item, ...variableUpdateData }
                : item
            ));
            
            setSelectedRowForMetadata({ ...selectedRowForMetadata, ...gridData });
          }
          
          // Clear highlighting for this item if it was affected by driver deletion
          if (affectedVariableIds.has(selectedRowForMetadata.id)) {
            setAffectedVariableIds(prev => {
              const newSet = new Set(prev);
              newSet.delete(selectedRowForMetadata.id);
              return newSet;
            });
          }
          
          // Refresh variables list to get updated relationship counts
          await fetchVariables();
          
          // After fetchVariables, sync selectedRowForMetadata with the latest data from apiVariables
          // The result from updateVariable should already have the correct data, but we sync again
          // to ensure consistency after the full refresh
          if (apiVariables && Array.isArray(apiVariables)) {
            const freshVariable = apiVariables.find((v: any) => v.id === selectedRowForMetadata.id);
            if (freshVariable) {
              setSelectedRowForMetadata(freshVariable);
            }
          }
          
          // Return success to indicate the save was successful
          return result;
        } catch (error) {
          console.error('Error updating variable:', error);
          alert('Failed to update variable. Please try again.');
          throw error; // Re-throw the error so the calling function knows it failed
        }
      } else if (activeTab === 'objects') {
        // Create clean object with only basic fields for the API, including identifier
        const basicFields: any = {
          being: updatedData.being,
          avatar: updatedData.avatar,
          object: updatedData.object,
          driver: updatedData.driver
        };
        
        // Include identifier data if present
        if (updatedData.identifier) {
          basicFields.identifier = updatedData.identifier;
          console.log('Including identifier data in update:', updatedData.identifier);
        }
        
        try {
          // Update the object via API
          console.log('Updating object via API:', { id: selectedRowForMetadata.id, data: basicFields });
          await updateObject(selectedRowForMetadata.id, basicFields);
          console.log('Object updated successfully');
          
          // Reload the object to refresh identifier data
          const refreshedObject = await apiService.getObject(selectedRowForMetadata.id);
          setSelectedRowForMetadata(refreshedObject);
        } catch (error) {
          console.error('Error updating object:', error);
          alert('Failed to update object. Please try again.');
          throw error;
        }
        
        // Handle relationships and variants using bulk update
        if (updatedData.relationshipsList || updatedData.variantsList) {
          try {
            console.log('Saving relationships and variants:', { 
              relationshipsList: updatedData.relationshipsList, 
              variantsList: updatedData.variantsList,
              objectId: selectedRowForMetadata.id 
            });
            
            // Filter out empty relationships and variants
            const validRelationships = (updatedData.relationshipsList || []).filter((rel: any) => 
              rel.role && rel.toBeing && rel.toAvatar && rel.toObject
            );
            
            const validVariants = (updatedData.variantsList || []).filter((variant: any) => 
              variant.name && variant.name.trim()
            );
            
            console.log('Valid relationships:', validRelationships);
            console.log('Valid variants:', validVariants);
            
            // Use bulk update endpoint that handles both additions and deletions
            await updateObjectWithRelationshipsAndVariants(
              selectedRowForMetadata.id, 
              validRelationships, 
              validVariants
            );
          } catch (error) {
            console.error('Error saving relationships/variants:', error);
            // Still update local state even if API fails
          }
        }
        
        // Note: No need to manually update local state here - the useObjects hook will handle it
        // The useEffect in App.tsx will sync the data state with apiObjects from the hook
        
        // Clear highlighting for this item if it was affected by driver deletion
        if (affectedObjectIds.has(selectedRowForMetadata.id)) {
          setAffectedObjectIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(selectedRowForMetadata.id);
            return newSet;
          });
        }
      } else if (activeTab === 'lists') {
        // Update list via API
        try {
          // Convert to API format
          const apiListData: any = {};
          
          if (gridData.sector !== undefined) {
            apiListData.sector = Array.isArray(gridData.sector)
              ? (gridData.sector.length === 1 && gridData.sector[0] === 'ALL'
                  ? 'ALL'
                  : gridData.sector.join(','))
              : gridData.sector;
          }
          if (gridData.domain !== undefined) {
            apiListData.domain = Array.isArray(gridData.domain)
              ? (gridData.domain.length === 1 && gridData.domain[0] === 'ALL'
                  ? 'ALL'
                  : gridData.domain.join(','))
              : gridData.domain;
          }
          if (gridData.country !== undefined) {
            apiListData.country = Array.isArray(gridData.country)
              ? (gridData.country.length === 1 && gridData.country[0] === 'ALL'
                  ? 'ALL'
                  : gridData.country.join(','))
              : gridData.country;
          }
          if (gridData.set !== undefined) apiListData.set = gridData.set;
          if (gridData.grouping !== undefined) apiListData.grouping = gridData.grouping;
          if (gridData.list !== undefined) apiListData.list = gridData.list;
          if (gridData.format !== undefined) apiListData.format = gridData.format;
          if (gridData.source !== undefined) apiListData.source = gridData.source;
          if (gridData.upkeep !== undefined) apiListData.upkeep = gridData.upkeep;
          if (gridData.graph !== undefined) apiListData.graph = gridData.graph;
          if (gridData.origin !== undefined) apiListData.origin = gridData.origin;
          if (gridData.status !== undefined) apiListData.status = gridData.status;
          if (gridData.listValuesList !== undefined) apiListData.listValuesList = gridData.listValuesList;
          if (gridData.variablesAttachedList !== undefined) apiListData.variablesAttachedList = gridData.variablesAttachedList;
          if (gridData.tieredListsList !== undefined) apiListData.tieredListsList = gridData.tieredListsList;
          if (gridData.tieredListValues !== undefined) apiListData.tieredListValues = gridData.tieredListValues;
          if (gridData.variationsList !== undefined) apiListData.variationsList = gridData.variationsList;
          if (gridData.listType !== undefined) apiListData.listType = gridData.listType;
          if (gridData.numberOfLevels !== undefined) apiListData.numberOfLevels = gridData.numberOfLevels;
          if (gridData.tierNames !== undefined) apiListData.tierNames = gridData.tierNames;
          
          // Only update if there are fields to update
          if (Object.keys(apiListData).length > 0) {
            if (!selectedRowForMetadata.id) {
              console.error('❌ Cannot update list: No ID found in selectedRowForMetadata:', selectedRowForMetadata);
              alert('Error: List ID is missing. Please select a list again.');
              return;
            }
            
            console.log('🔄 Updating list - ID:', selectedRowForMetadata.id, 'Name:', selectedRowForMetadata.list, 'Data keys:', Object.keys(apiListData));
            console.log('🔄 Update data:', JSON.stringify(apiListData, null, 2));
            const updatedList = await apiService.updateList(selectedRowForMetadata.id, apiListData) as any;
            console.log('🔄 Updated list response:', JSON.stringify(updatedList, null, 2));
            
            // Convert API response to ListData format
            const listDataFormat: ListData = {
              id: updatedList.id,
              sector: Array.isArray(updatedList.sector) ? updatedList.sector : [updatedList.sector || 'ALL'],
              domain: Array.isArray(updatedList.domain) ? updatedList.domain : [updatedList.domain || 'ALL'],
              country: Array.isArray(updatedList.country) ? updatedList.country : [updatedList.country || 'ALL'],
              set: updatedList.set,
              grouping: updatedList.grouping,
              list: updatedList.list,
              format: updatedList.format || '',
              source: updatedList.source || '',
              upkeep: updatedList.upkeep || '',
              graph: updatedList.graph || '',
              origin: updatedList.origin || '',
              status: updatedList.status || 'Active',
              variablesAttachedList: updatedList.variablesAttachedList || [],
              listValuesList: updatedList.listValuesList || [],
              tieredListsList: updatedList.tieredListsList || [],
              variations: updatedList.variations || 0,
              variationsList: updatedList.variationsList || [],
              tiers: (updatedList.tieredListsList || []).map((tier: any) => tier.list).join(', '),
              hasIncomingTier: updatedList.hasIncomingTier || false,
              listType: updatedList.listType || (updatedList.tieredListsList && updatedList.tieredListsList.length > 0 ? 'Multi-Level' : 'Single'),
              numberOfLevels: updatedList.numberOfLevels || (updatedList.tieredListsList ? updatedList.tieredListsList.length + 1 : 2),
              tierNames: updatedList.tierNames || (updatedList.tieredListsList ? updatedList.tieredListsList.map((tier: any) => tier.list) : [])
            };
            
            // Update local state
            setListData(prev => prev.map(item => 
              item.id === selectedRowForMetadata.id 
                ? listDataFormat
                : item
            ));
            
            // Update selected row
            setSelectedRowForMetadata(listDataFormat);
            
            // Track what was actually changed (only for ListData)
            const isListData = selectedRowForMetadata && 'list' in selectedRowForMetadata;
            const listTypeChanged = apiListData.listType !== undefined;
            const tieredListsChanged = isListData && apiListData.tieredListsList !== undefined && 
              JSON.stringify((selectedRowForMetadata as any)?.tieredListsList || []) !== JSON.stringify(apiListData.tieredListsList);
            const tieredListValuesChanged = isListData && apiListData.tieredListValues !== undefined;
            
            // Refresh all lists if listType, tieredListsList, or tieredListValues were updated
            if (listTypeChanged || tieredListsChanged || tieredListValuesChanged) {
              // Refresh all lists to get updated data
              const refreshedLists = await fetchLists();
              setListData(refreshedLists);
              
              // Update the selected row with refreshed data (if it still exists)
              const refreshedSelectedList = refreshedLists.find(l => l.id === selectedRowForMetadata.id);
              if (refreshedSelectedList) {
                setSelectedRowForMetadata(refreshedSelectedList);
              }
            }
            
            const listValuesChanged = isListData && apiListData.listValuesList !== undefined && 
              JSON.stringify(((selectedRowForMetadata as any)?.listValuesList || []).map((lv: any) => lv.value).sort()) !== 
              JSON.stringify((apiListData.listValuesList || []).map((lv: any) => lv.value).sort());
            const isMultiLevelList = apiListData.listType === 'Multi-Level' || (selectedRowForMetadata as any)?.listType === 'Multi-Level' || 
              (apiListData.tieredListsList && apiListData.tieredListsList.length > 0) ||
              ((selectedRowForMetadata as any)?.tieredListsList && (selectedRowForMetadata as any).tieredListsList.length > 0);
            
            // Show success message if tiered list values were updated
            if (tieredListValuesChanged) {
              const tieredValues = apiListData.tieredListValues || {};
              const totalRows = Object.values(tieredValues).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
              if (totalRows > 0) {
                alert(`Tiered list values saved successfully! ${totalRows} row${totalRows !== 1 ? 's' : ''} saved.`);
              } else {
                alert('Tiered list values cleared successfully!');
              }
            }
            
            // Show success message if tiered lists were updated (only if tiered list values weren't updated)
            if (tieredListsChanged && !tieredListValuesChanged) {
              const tieredCount = Array.isArray(apiListData.tieredListsList) ? apiListData.tieredListsList.length : 0;
              if (tieredCount > 0) {
                const tierNumbers = apiListData.tieredListsList.map((_: any, index: number) => index + 2).join(', ');
                alert(`Tier ${tierNumbers} created for the list "${listDataFormat.list}" successfully!`);
              } else {
                alert(`Tiered lists cleared for the list "${listDataFormat.list}" successfully!`);
              }
            }
            
            // Show success message if list values were updated (only if not a multi-level list and tiered values weren't updated)
            if (listValuesChanged && !isMultiLevelList && !tieredListValuesChanged) {
              const valueCount = Array.isArray(apiListData.listValuesList) ? apiListData.listValuesList.length : 0;
              if (valueCount > 0) {
                alert(`List values saved successfully! ${valueCount} value${valueCount !== 1 ? 's' : ''} saved.`);
              } else {
                alert('List values cleared successfully!');
              }
            }
            
            // Show success message if both tiered lists and list values were updated (but not tiered list values)
            if (tieredListsChanged && listValuesChanged && !tieredListValuesChanged) {
              const tieredCount = Array.isArray(apiListData.tieredListsList) ? apiListData.tieredListsList.length : 0;
              const valueCount = Array.isArray(apiListData.listValuesList) ? apiListData.listValuesList.length : 0;
              const messages = [];
              if (tieredCount > 0) {
                const tierNumbers = apiListData.tieredListsList.map((_: any, index: number) => index + 2).join(', ');
                messages.push(`Tier ${tierNumbers} created`);
              }
              if (valueCount > 0) {
                messages.push(`${valueCount} list value${valueCount !== 1 ? 's' : ''} saved`);
              }
              if (messages.length > 0) {
                alert(`${messages.join(' and ')} for the list "${listDataFormat.list}" successfully!`);
              }
            }
          }
        } catch (error: any) {
          console.error('Error updating list:', error);
          const errorMessage = error?.message || 'Unknown error';
          if (errorMessage.includes('not found') || errorMessage.includes('404')) {
            alert(`Failed to update list: The list with ID "${selectedRowForMetadata?.id}" was not found. This may happen if the list was deleted. Please refresh the page and try again.`);
            // Refresh lists to get updated data
            await fetchLists();
            setSelectedRowForMetadata(null);
          } else {
            alert(`Failed to update list: ${errorMessage}. Please try again.`);
          }
          throw error;
        }
      } else if (activeTab === 'variables') {
        setVariableData(prev => prev.map(item => 
          item.id === selectedRowForMetadata.id 
            ? { ...item, ...gridData }
            : item
        ));
      }
      
      setSelectedRowForMetadata({ ...selectedRowForMetadata, ...gridData });
    }
  };


  const handleBulkObjectUpload = async (objects: ObjectData[]) => {
    // Parse driver fields for each object before adding to state
    const parsedObjects = objects.map(obj => {
      const parsed = parseDriverField(obj.driver);
      return {
        ...obj,
        sector: parsed.sector,
        domain: parsed.domain,
        country: parsed.country,
        classifier: parsed.classifier
      };
    });
    
    // Add objects to local state immediately for quick UI update
    setData(prev => [...prev, ...parsedObjects]);
    
    // Also refresh from API to ensure we have the latest data with correct counts
    try {
      await fetchObjects();
    } catch (error) {
      console.error('Error refreshing objects after upload:', error);
      // Don't fail the upload if refresh fails - we already updated local state
    }
    
    setIsBulkObjectUploadOpen(false);
  };

  const handleBulkVariableUpload = async (file: File) => {
    setIsBulkVariableUploading(true);
    try {
      const result = await bulkUploadVariables(file);
      console.log('Bulk upload result:', result);
      
      // Show success message
      const successMsg = result.message || `Successfully uploaded ${result.created_count || 0} variables`;
      if (result.error_count > 0) {
        alert(`${successMsg}. ${result.error_count} errors occurred. Check console for details.`);
        console.log('Upload errors:', result.errors);
      } else {
        alert(successMsg);
      }
      
      // Refresh variables to show newly uploaded ones
      await fetchVariables();
      
      setIsBulkVariableUploadOpen(false);
    } catch (error) {
      console.error('Bulk upload failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      alert(`Bulk upload failed: ${errorMsg}`);
    } finally {
      setIsBulkVariableUploading(false);
    }
  };

  const fetchLists = async (): Promise<ListData[]> => {
    try {
      const lists = await apiService.getLists() as any[];
      // Convert API response to ListData format
      const listsDataFormat: ListData[] = lists.map((list: any) => {
        // Calculate tiers string (comma-separated child lists)
        const tieredLists = list.tieredListsList || [];
        const tiersString = tieredLists.map((tier: any) => tier.list).join(', ');
        
        return {
          id: list.id,
          sector: Array.isArray(list.sector) ? list.sector : [list.sector || 'ALL'],
          domain: Array.isArray(list.domain) ? list.domain : [list.domain || 'ALL'],
          country: Array.isArray(list.country) ? list.country : [list.country || 'ALL'],
          set: list.set,
          grouping: list.grouping,
          list: list.list,
          format: list.format || '',
          source: list.source || '',
          upkeep: list.upkeep || '',
          graph: list.graph || '',
          origin: list.origin || '',
          status: list.status || 'Active',
          variables: list.variables || 0, // Include variables count from API
          variablesAttachedList: list.variablesAttachedList || [],
          listValuesList: list.listValuesList || [],
          tieredListsList: list.tieredListsList || [],
          variations: list.variations || 0,
          variationsList: list.variationsList || [],
          tiers: tiersString, // Add tiers column value
          hasIncomingTier: list.hasIncomingTier || false,
          listType: list.listType || (list.tieredListsList && list.tieredListsList.length > 0 ? 'Multi-Level' : 'Single'),
          numberOfLevels: list.numberOfLevels || (list.tieredListsList ? list.tieredListsList.length + 1 : 2),
          tierNames: list.tierNames || (list.tieredListsList ? list.tieredListsList.map((tier: any) => tier.list) : [])
        };
      });
      
      // Reorder lists so tiered lists appear beneath their parent
      // Build a map of parent list ID to tiered list IDs
      const parentToChildren = new Map<string, string[]>();
      const allListIds = new Set(listsDataFormat.map(l => l.id));
      
      listsDataFormat.forEach(list => {
        if (list.tieredListsList && list.tieredListsList.length > 0) {
          const childIds = list.tieredListsList.map(tier => tier.listId).filter((id): id is string => id !== undefined && allListIds.has(id));
          if (childIds.length > 0) {
            parentToChildren.set(list.id, childIds);
          }
        }
      });
      
      // Build ordered list: parents first, then their children in order
      const ordered: ListData[] = [];
      const added = new Set<string>();
      
      // First pass: add all lists that are not children of any other list
      listsDataFormat.forEach(list => {
        // Check if this list is a child of any other list
        const isChild = Array.from(parentToChildren.values()).some(children => children.includes(list.id));
        if (!isChild) {
          ordered.push(list);
          added.add(list.id);
          
          // Add children recursively
          const addChildren = (parentId: string) => {
            const children = parentToChildren.get(parentId) || [];
            children.forEach(childId => {
              if (!added.has(childId)) {
                const childList = listsDataFormat.find(l => l.id === childId);
                if (childList) {
                  ordered.push(childList);
                  added.add(childId);
                  // Recursively add grandchildren
                  addChildren(childId);
                }
              }
            });
          };
          addChildren(list.id);
        }
      });
      
      // Add any remaining lists that weren't added (shouldn't happen, but just in case)
      listsDataFormat.forEach(list => {
        if (!added.has(list.id)) {
          ordered.push(list);
        }
      });
      
      // Deduplicate by ID (in case API returns duplicates)
      const uniqueLists = ordered.filter((list, index, self) => 
        index === self.findIndex(l => l.id === list.id)
      );
      
      // Also deduplicate by composite key (sector, domain, country, set, grouping, list)
      const deduplicatedLists: ListData[] = [];
      const seenKeys = new Set<string>();
      
      for (const list of uniqueLists) {
        const sectorKey = Array.isArray(list.sector) 
          ? (list.sector.length === 1 && list.sector[0] === 'ALL' ? 'ALL' : list.sector.sort().join(','))
          : list.sector || 'ALL';
        const domainKey = Array.isArray(list.domain)
          ? (list.domain.length === 1 && list.domain[0] === 'ALL' ? 'ALL' : list.domain.sort().join(','))
          : list.domain || 'ALL';
        const countryKey = Array.isArray(list.country)
          ? (list.country.length === 1 && list.country[0] === 'ALL' ? 'ALL' : list.country.sort().join(','))
          : list.country || 'ALL';
        
        const compositeKey = `${sectorKey}|${domainKey}|${countryKey}|${list.set}|${list.grouping}|${list.list}`;
        
        if (!seenKeys.has(compositeKey)) {
          seenKeys.add(compositeKey);
          deduplicatedLists.push(list);
        }
      }
      
      setListData(deduplicatedLists);
      return deduplicatedLists;
    } catch (error) {
      console.error('Error fetching lists:', error);
      // Keep existing data on error
      return [];
    }
  };

  const handleBulkListUpload = async (lists: ListData[]) => {
    try {
      // Create each list via API
      const firstListInfo = lists.length > 0 ? {
        sector: Array.isArray(lists[0].sector) 
          ? (lists[0].sector.length === 1 && lists[0].sector[0] === 'ALL' 
              ? 'ALL' 
              : lists[0].sector.sort().join(','))
          : lists[0].sector || 'ALL',
        domain: Array.isArray(lists[0].domain)
          ? (lists[0].domain.length === 1 && lists[0].domain[0] === 'ALL'
              ? 'ALL'
              : lists[0].domain.sort().join(','))
          : lists[0].domain || 'ALL',
        country: Array.isArray(lists[0].country)
          ? (lists[0].country.length === 1 && lists[0].country[0] === 'ALL'
              ? 'ALL'
              : lists[0].country.sort().join(','))
          : lists[0].country || 'ALL',
        set: lists[0].set || '',
        grouping: lists[0].grouping || '',
        list: lists[0].list || ''
      } : null;
      
      for (const listData of lists) {
        const apiListData = {
          sector: Array.isArray(listData.sector) 
            ? (listData.sector.length === 1 && listData.sector[0] === 'ALL' 
                ? 'ALL' 
                : listData.sector.join(','))
            : listData.sector || 'ALL',
          domain: Array.isArray(listData.domain)
            ? (listData.domain.length === 1 && listData.domain[0] === 'ALL'
                ? 'ALL'
                : listData.domain.join(','))
            : listData.domain || 'ALL',
          country: Array.isArray(listData.country)
            ? (listData.country.length === 1 && listData.country[0] === 'ALL'
                ? 'ALL'
                : listData.country.join(','))
            : listData.country || 'ALL',
          set: listData.set || '',
          grouping: listData.grouping || '',
          list: listData.list || '',
          format: listData.format || '',
          source: listData.source || '',
          upkeep: listData.upkeep || '',
          graph: listData.graph || '',
          origin: listData.origin || '',
          status: listData.status || 'Active'
        };
        
        await apiService.createList(apiListData) as any;
      }
      
      // Refresh lists from API to avoid duplicates
      const refreshedLists = await fetchLists();
      
      // Select the first uploaded list to show in metadata panel
      if (firstListInfo && refreshedLists.length > 0) {
        // Find the first uploaded list in the refreshed data
        const firstCreatedList = refreshedLists.find(list => {
          const listSector = Array.isArray(list.sector) 
            ? (list.sector.length === 1 && list.sector[0] === 'ALL' 
                ? 'ALL' 
                : list.sector.sort().join(','))
            : list.sector || 'ALL';
          const listDomain = Array.isArray(list.domain)
            ? (list.domain.length === 1 && list.domain[0] === 'ALL'
                ? 'ALL'
                : list.domain.sort().join(','))
            : list.domain || 'ALL';
          const listCountry = Array.isArray(list.country)
            ? (list.country.length === 1 && list.country[0] === 'ALL'
                ? 'ALL'
                : list.country.sort().join(','))
            : list.country || 'ALL';
          
          return listSector === firstListInfo.sector &&
                 listDomain === firstListInfo.domain &&
                 listCountry === firstListInfo.country &&
                 list.set === firstListInfo.set &&
                 list.grouping === firstListInfo.grouping &&
                 list.list === firstListInfo.list;
        });
        
        if (firstCreatedList) {
          setSelectedRows([firstCreatedList]);
          setSelectedRowForMetadata(firstCreatedList);
        }
      }
      // Close modal after upload completes
      setIsBulkListUploadOpen(false);
    } catch (error: any) {
      console.error('Error uploading lists:', error);
      const errorMessage = error?.message || 'Failed to upload lists. Please try again.';
      alert(errorMessage);
      throw error;
    }
  };

  const handleAddList = async (newListData: ListData) => {
    try {
      // Convert to API format
      const apiListData: any = {
        sector: Array.isArray(newListData.sector) 
          ? (newListData.sector.length === 1 && newListData.sector[0] === 'ALL' 
              ? 'ALL' 
              : newListData.sector.join(','))
          : newListData.sector || 'ALL',
        domain: Array.isArray(newListData.domain)
          ? (newListData.domain.length === 1 && newListData.domain[0] === 'ALL'
              ? 'ALL'
              : newListData.domain.join(','))
          : newListData.domain || 'ALL',
        country: Array.isArray(newListData.country)
          ? (newListData.country.length === 1 && newListData.country[0] === 'ALL'
              ? 'ALL'
              : newListData.country.join(','))
          : newListData.country || 'ALL',
        set: newListData.set || '',
        grouping: newListData.grouping || '',
        list: newListData.list || '',
        format: newListData.format || '',
        source: newListData.source || '',
        upkeep: newListData.upkeep || '',
        graph: newListData.graph || '',
        origin: newListData.origin || '',
        status: newListData.status || 'Active'
      };
      
      // Include listValuesList if provided
      if (newListData.listValuesList !== undefined) {
        apiListData.listValuesList = newListData.listValuesList;
      }
      
      // Include tieredListsList if provided
      if (newListData.tieredListsList !== undefined) {
        apiListData.tieredListsList = newListData.tieredListsList;
      }
      
        const createdList = await apiService.createList(apiListData) as any;
        
        // Convert API response to ListData format
        const listDataFormat: ListData = {
          id: createdList.id,
          sector: Array.isArray(createdList.sector) ? createdList.sector : [createdList.sector || 'ALL'],
          domain: Array.isArray(createdList.domain) ? createdList.domain : [createdList.domain || 'ALL'],
          country: Array.isArray(createdList.country) ? createdList.country : [createdList.country || 'ALL'],
          set: createdList.set,
          grouping: createdList.grouping,
          list: createdList.list,
          format: createdList.format || '',
          source: createdList.source || '',
          upkeep: createdList.upkeep || '',
          graph: createdList.graph || '',
          origin: createdList.origin || '',
          status: createdList.status || 'Active',
          variablesAttachedList: createdList.variablesAttachedList || [],
          listValuesList: createdList.listValuesList || [],
          tieredListsList: createdList.tieredListsList || [],
          tiers: (createdList.tieredListsList || []).map((tier: any) => tier.list).join(', '),
          hasIncomingTier: createdList.hasIncomingTier || false
        };
        
        // Show success message if list values were included
        if (newListData.listValuesList !== undefined && Array.isArray(newListData.listValuesList)) {
          const valueCount = newListData.listValuesList.length;
          if (valueCount > 0) {
            alert(`List created successfully! ${valueCount} list value${valueCount !== 1 ? 's' : ''} saved.`);
          }
        }
        
        setListData(prev => [...prev, listDataFormat]);
      setIsAddListOpen(false);
    } catch (error: any) {
      console.error('Error creating list:', error);
      const errorMessage = error?.message || 'Failed to create list. Please try again.';
      if (errorMessage.includes('Duplicate') || errorMessage.includes('already exists')) {
        alert(`Duplicate detected: ${errorMessage}`);
      } else {
        alert(errorMessage);
      }
      throw error;
    }
  };
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Persist filters to localStorage
  React.useEffect(() => {
    localStorage.setItem('cdm_objects_filters', JSON.stringify(filters));
  }, [filters]);

  // Persist custom sort rules to localStorage
  React.useEffect(() => {
    localStorage.setItem('cdm_objects_custom_sort_rules', JSON.stringify(customSortRules));
  }, [customSortRules]);

  // Persist custom sort active state to localStorage
  React.useEffect(() => {
    localStorage.setItem('cdm_objects_custom_sort_active', isCustomSortActive.toString());
  }, [isCustomSortActive]);

  // Persist column sort active state to localStorage
  React.useEffect(() => {
    localStorage.setItem('cdm_objects_column_sort_active', isColumnSortActive.toString());
  }, [isColumnSortActive]);

  const handleColumnHeaderClick = (columnType: ColumnType) => {
    setSelectedColumn(columnType);
    setSelectedItem(undefined);
  };

  const handleItemClick = (columnType: ColumnType, item: string) => {
    setSelectedColumn(columnType);
    setSelectedItem(item);
  };

  const handleDriversSave = async (newValue: string) => {
    if (selectedColumn && selectedItem) {
      try {
        await updateDriver(selectedColumn, selectedItem, newValue);
        setSelectedItem(newValue);
        // The API call will trigger a refresh, which will handle the ordering
      } catch (error) {
        console.error('Failed to update driver:', error);
        // Fallback to local state update
        setDriversState(prev => ({
          ...prev,
          [selectedColumn]: prev[selectedColumn].map(item => 
            item === selectedItem ? newValue : item
          )
        }));
        setSelectedItem(newValue);
        
        // Update localStorage to reflect the name change
        const storageKey = `cdm_drivers_order_${selectedColumn}`;
        const currentOrder = driversState[selectedColumn] || [];
        const updatedOrder = currentOrder.map(item => 
          item === selectedItem ? newValue : item
        );
        localStorage.setItem(storageKey, JSON.stringify(updatedOrder));
      }
    }
  };

  const handleDriversAddNew = async (newValue: string) => {
    if (selectedColumn) {
      try {
        await createDriver(selectedColumn, newValue);
        // The API call will trigger a refresh, which will handle the ordering
      } catch (error) {
        console.error('Failed to create driver:', error);
        // Fallback to local state update
        setDriversState(prev => ({
          ...prev,
          [selectedColumn]: [...prev[selectedColumn], newValue]
        }));
        
        // Update localStorage to include the new item
        const storageKey = `cdm_drivers_order_${selectedColumn}`;
        const currentOrder = [...driversState[selectedColumn], newValue];
        localStorage.setItem(storageKey, JSON.stringify(currentOrder));
      }
    }
  };

  const handleDriversReorder = async (columnType: ColumnType, newOrder: string[]) => {
    // Update local state immediately for responsive UI
    setDriversState(prev => ({
      ...prev,
      [columnType]: newOrder
    }));
    
    // Persist the new order to localStorage
    const storageKey = `cdm_drivers_order_${columnType}`;
    localStorage.setItem(storageKey, JSON.stringify(newOrder));
    
    // Persist to backend to ensure it survives deployments
    try {
      // Backend expects the full columnType (sectors, domains, countries, etc.)
      await apiService.reorderDrivers(columnType, newOrder);
      console.log(`✅ Successfully persisted driver order for ${columnType} to backend`);
    } catch (error) {
      console.error(`❌ Failed to persist driver order for ${columnType} to backend:`, error);
      // Don't throw - we've already updated local state and localStorage
      // The order will still work locally, just won't persist across deployments
    }
  };

  const handleDriverDeleteClick = (driverName: string, columnType: ColumnType) => {
    setDriverToDelete({ name: driverName, type: columnType });
    setIsDeleteModalOpen(true);
  };

  const handleDriverDeleteConfirm = async () => {
    if (!driverToDelete) return;
    
    try {
      console.log(`Deleting driver: ${driverToDelete.name} of type: ${driverToDelete.type}`);
      
      // Remove abbreviation if it exists (only for sectors, domains, countries)
      if (['sectors', 'domains', 'countries'].includes(driverToDelete.type)) {
        removeDriverAbbreviation(driverToDelete.type, driverToDelete.name);
      }
      
      const response = await deleteDriver(driverToDelete.type, driverToDelete.name);
      
      console.log('🔍 DELETE RESPONSE:', response);
      console.log('🔍 RESPONSE TYPE:', typeof response);
      console.log('🔍 RESPONSE KEYS:', response ? Object.keys(response) : 'null');
      
      // Handle affected items for highlighting
      if (response && typeof response === 'object' && 'affected_objects' in response) {
        const affectedObjects = (response as any).affected_objects || [];
        const affectedVariables = (response as any).affected_variables || [];
        
        console.log('🔍 AFFECTED OBJECTS:', affectedObjects);
        console.log('🔍 AFFECTED VARIABLES:', affectedVariables);
        
        // Update affected IDs for highlighting
        const affectedObjectIds = new Set<string>(affectedObjects.map((obj: any) => String(obj.id)));
        const affectedVariableIds = new Set<string>(affectedVariables.map((var_: any) => String(var_.id)));
        
        console.log('🔍 AFFECTED OBJECT IDS:', Array.from(affectedObjectIds));
        console.log('🔍 AFFECTED VARIABLE IDS:', Array.from(affectedVariableIds));
        
        setAffectedObjectIds(affectedObjectIds);
        setAffectedVariableIds(affectedVariableIds);
        
        // Set the deleted driver type for specific warning messages
        setDeletedDriverType(driverToDelete.type);
        
        // Don't auto-clear highlighting - let it persist until user reassigns driver
        console.log('Highlighting will persist until user reassigns the deleted driver');
        
        console.log(`Driver deletion affected ${affectedObjects.length} objects and ${affectedVariables.length} variables`);
        
        // Add a small delay to ensure backend has processed the changes
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Refresh data to show updated driver strings
        console.log('🔄 Refreshing data after driver deletion...');
        if (activeTab === 'objects') {
          await fetchObjects();
          console.log('✅ Objects data refreshed');
          
          // Force a re-render to ensure the updated data is displayed
          console.log('🔄 Forcing re-render after data refresh...');
          setTimeout(() => {
            console.log('🔄 Re-render triggered');
          }, 100);
        } else if (activeTab === 'variables') {
          await fetchVariables();
          console.log('✅ Variables data refreshed');
        }
      }
      
      // Update localStorage to remove the deleted item
      const storageKey = `cdm_drivers_order_${driverToDelete.type}`;
      const currentOrder = driversState[driverToDelete.type] || [];
      const updatedOrder = currentOrder.filter(item => item !== driverToDelete.name);
      localStorage.setItem(storageKey, JSON.stringify(updatedOrder));
      
      // Close modal and clear selection
      setIsDeleteModalOpen(false);
      setDriverToDelete(null);
      
      // Clear selected item if it was the deleted one
      if (selectedItem === driverToDelete.name && selectedColumn === driverToDelete.type) {
        setSelectedItem(undefined);
        setSelectedColumn(undefined);
      }
    } catch (error) {
      console.error('Failed to delete driver:', error);
      alert(`Failed to delete driver: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDriverDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setDriverToDelete(null);
  };

  const handleCustomSortApply = (sortRules: Array<{
    id: string;
    column: string;
    sortOn: string;
    order: 'asc' | 'desc';
  }>, isDefaultOrderEnabled: boolean = false) => {
    // Update default order enabled state
    setIsObjectsOrderEnabled(isDefaultOrderEnabled);
    localStorage.setItem('cdm_objects_order_enabled', isDefaultOrderEnabled.toString());
    
    setCustomSortRules(sortRules);
    setIsCustomSortActive(sortRules.length > 0);
    setIsColumnSortActive(false); // Clear column sort when grid sort is applied
    // Clear localStorage for column sort
    localStorage.removeItem('cdm_objects_column_sort_active');
    localStorage.removeItem('cdm_objects_sort_config');
    console.log('Custom sort applied:', sortRules, 'Default order enabled:', isDefaultOrderEnabled);
  };

  const handleViewsApply = (viewName: string) => {
    console.log('🎯 APPLYING VIEW:', viewName, 'for tab:', activeTab);
    if (activeTab === 'objects') {
      setActiveView(viewName);
    } else if (activeTab === 'variables') {
      setActiveVariablesView(viewName);
    } else if (activeTab === 'lists') {
      setActiveListsView(viewName);
    }
  };


  const handleClearAllSorts = () => {
    setCustomSortRules([]);
    setIsCustomSortActive(false);
    setIsColumnSortActive(false);
    // Clear localStorage
    localStorage.removeItem('cdm_objects_custom_sort_rules');
    localStorage.removeItem('cdm_objects_custom_sort_active');
    localStorage.removeItem('cdm_objects_column_sort_active');
  };

  // Relationship modal handlers
  const handleEnterRelationshipView = () => {
    if (!selectedRowForMetadata) {
      alert('Please select an object first');
      return;
    }
    // Check for pending CSV relationships
    const pendingRels = (window as any).__pendingCsvRelationships;
    if (pendingRels) {
      setInitialRelationships(pendingRels);
      (window as any).__pendingCsvRelationships = undefined;
    } else {
      setInitialRelationships([]);
    }
    setIsRelationshipModalOpen(true);
  };


  const handleColumnSort = () => {
    // When a column sort is applied, clear grid-level sort
    if (isCustomSortActive) {
      setCustomSortRules([]);
      setIsCustomSortActive(false);
      // Clear localStorage for custom sort
      localStorage.removeItem('cdm_objects_custom_sort_rules');
      localStorage.removeItem('cdm_objects_custom_sort_active');
    }
    setIsColumnSortActive(true);
  };

  const handleVariablesCustomSortApply = (sortRules: Array<{
    id: string;
    column: string;
    sortOn: string;
    order: 'asc' | 'desc';
  }>, isDefaultOrderEnabled: boolean = false) => {
    // Update default order enabled state
    setIsVariablesOrderEnabled(isDefaultOrderEnabled);
    localStorage.setItem('cdm_variables_order_enabled', isDefaultOrderEnabled.toString());
    localStorage.setItem('cdm_variables_predefined_sort_enabled', isDefaultOrderEnabled.toString()); // Backward compatibility
    
    setVariablesCustomSortRules(sortRules);
    setIsVariablesCustomSortActive(sortRules.length > 0);
    setIsVariablesColumnSortActive(false); // Clear column sort when grid sort is applied
    // Clear localStorage for column sort
    localStorage.removeItem('cdm_variables_column_sort_active');
    localStorage.removeItem('cdm_variables_sort_config');
    console.log('Variables custom sort applied:', sortRules, 'Default order enabled:', isDefaultOrderEnabled);
  };

  const handleVariablesColumnSort = () => {
    // If order sort is enabled, turn it off (but preserve the order)
    if (isVariablesOrderEnabled) {
      setIsVariablesOrderEnabled(false);
      localStorage.setItem('cdm_variables_order_enabled', 'false');
      localStorage.setItem('cdm_variables_predefined_sort_enabled', 'false'); // Backward compatibility
      // Preserve the order - don't clear it!
    }
    
    // When a column sort is applied, clear grid-level custom sort
    if (isVariablesCustomSortActive) {
      setVariablesCustomSortRules([]);
      setIsVariablesCustomSortActive(false);
      // Clear localStorage for custom sort
      localStorage.removeItem('cdm_variables_custom_sort_rules');
      localStorage.removeItem('cdm_variables_custom_sort_active');
    }
    
    setIsVariablesColumnSortActive(true);
  };

  const handleVariablesOrderSave = (order: {
    partOrder: string[];
    sectionOrder: string[];
    groupOrders: Record<string, string[]>;
    variableOrders: Record<string, string[]>;
  }) => {
    // Save the order to localStorage - this is persistent and doesn't change unless user modifies it
    setVariablesOrderSortOrder(order);
    localStorage.setItem('cdm_variables_order_sort_order', JSON.stringify(order));
    // Also save to old key for backward compatibility during migration
    const oldOrder = {
      partOrder: order.partOrder,
      groupOrders: order.groupOrders,
      variableOrders: order.variableOrders
    };
    localStorage.setItem('cdm_variables_predefined_sort_order', JSON.stringify(oldOrder));
    console.log('Variables order saved:', order);
  };

  const handleVariablesDefaultOrderToggle = (enabled: boolean) => {
    setIsVariablesOrderEnabled(enabled);
    localStorage.setItem('cdm_variables_order_enabled', enabled.toString());
    // Also save to old key for backward compatibility
    localStorage.setItem('cdm_variables_predefined_sort_enabled', enabled.toString());
    
    // If enabling default order, clear column sort for Part, Section, Group, Variable
    if (enabled) {
      try {
        const savedSortConfig = localStorage.getItem('cdm_variables_sort_config');
        if (savedSortConfig) {
          const sortConfig = JSON.parse(savedSortConfig);
          // Clear column sort if it's for Part, Section, Group, or Variable
          if (sortConfig && ['part', 'section', 'group', 'variable'].includes(sortConfig.key)) {
            localStorage.removeItem('cdm_variables_sort_config');
            setIsVariablesColumnSortActive(false);
            localStorage.removeItem('cdm_variables_column_sort_active');
          }
        }
      } catch (error) {
        console.error('Error clearing column sort:', error);
      }
    }
    console.log('Variables default order toggled:', enabled);
  };

  const handleObjectsOrderSave = (order: {
    beingOrder: string[];
    avatarOrders: Record<string, string[]>;
    objectOrders: Record<string, string[]>;
  }) => {
    setObjectsOrderSortOrder(order);
    localStorage.setItem('cdm_objects_order_sort_order', JSON.stringify(order));
    console.log('Objects order saved:', order);
  };

  const handleObjectsDefaultOrderToggle = (enabled: boolean) => {
    setIsObjectsOrderEnabled(enabled);
    localStorage.setItem('cdm_objects_order_enabled', enabled.toString());
    
    // If enabling default order, clear column sort for Being, Avatar, Object
    if (enabled) {
      try {
        const savedSortConfig = localStorage.getItem('cdm_objects_sort_config');
        if (savedSortConfig) {
          const sortConfig = JSON.parse(savedSortConfig);
          if (sortConfig && ['being', 'avatar', 'object'].includes(sortConfig.key)) {
            localStorage.removeItem('cdm_objects_sort_config');
            setIsColumnSortActive(false);
            localStorage.removeItem('cdm_objects_column_sort_active');
          }
        }
      } catch (error) {
        console.error('Error clearing column sort:', error);
      }
    }
    console.log('Objects default order toggled:', enabled);
  };

  const handleListsOrderSave = (order: {
    setOrder: string[];
    groupingOrders: Record<string, string[]>;
    listOrders: Record<string, string[]>;
  }) => {
    setListsOrderSortOrder(order);
    localStorage.setItem('cdm_lists_order_sort_order', JSON.stringify(order));
    console.log('Lists order saved:', order);
  };

  const handleListsDefaultOrderToggle = (enabled: boolean) => {
    setIsListsOrderEnabled(enabled);
    localStorage.setItem('cdm_lists_order_enabled', enabled.toString());
    
    // If enabling default order, clear column sort for Set, Grouping, List
    if (enabled) {
      try {
        const savedSortConfig = localStorage.getItem('cdm_lists_sort_config');
        if (savedSortConfig) {
          const sortConfig = JSON.parse(savedSortConfig);
          if (sortConfig && ['set', 'grouping', 'list'].includes(sortConfig.key)) {
            localStorage.removeItem('cdm_lists_sort_config');
            setIsListsColumnSortActive(false);
            localStorage.removeItem('cdm_lists_column_sort_active');
          }
        }
      } catch (error) {
        console.error('Error clearing column sort:', error);
      }
    }
    console.log('Lists default order toggled:', enabled);
  };

  const handleClearVariablesSorts = () => {
    // Clear custom sort and column sort, but PRESERVE order sort order
    setVariablesCustomSortRules([]);
    setIsVariablesCustomSortActive(false);
    setIsVariablesColumnSortActive(false);
    setIsVariablesOrderEnabled(false);
    // DO NOT clear order sort order - it's sacred!
    
    // Clear localStorage for active sorts only
    localStorage.removeItem('cdm_variables_custom_sort_rules');
    localStorage.removeItem('cdm_variables_custom_sort_active');
    localStorage.removeItem('cdm_variables_column_sort_active');
    localStorage.setItem('cdm_variables_order_enabled', 'false');
    localStorage.setItem('cdm_variables_predefined_sort_enabled', 'false'); // Backward compatibility
    // Note: order sort order is preserved in localStorage
  };

  const handleListsCustomSortApply = (sortRules: Array<{
    id: string;
    column: string;
    sortOn: string;
    order: 'asc' | 'desc';
  }>, isDefaultOrderEnabled: boolean = false) => {
    // Update default order enabled state
    setIsListsOrderEnabled(isDefaultOrderEnabled);
    localStorage.setItem('cdm_lists_order_enabled', isDefaultOrderEnabled.toString());
    
    setListsCustomSortRules(sortRules);
    setIsListsCustomSortActive(sortRules.length > 0);
    setIsListsColumnSortActive(false); // Clear column sort when grid sort is applied
    // Clear localStorage for column sort
    localStorage.removeItem('cdm_lists_column_sort_active');
    localStorage.removeItem('cdm_lists_sort_config');
    console.log('Lists custom sort applied:', sortRules, 'Default order enabled:', isDefaultOrderEnabled);
  };

  const handleListsColumnSort = () => {
    // When a column sort is applied, clear grid-level sort
    if (isListsCustomSortActive) {
      setListsCustomSortRules([]);
      setIsListsCustomSortActive(false);
      // Clear localStorage for custom sort
      localStorage.removeItem('cdm_lists_custom_sort_rules');
      localStorage.removeItem('cdm_lists_custom_sort_active');
    }
    setIsListsColumnSortActive(true);
  };

  const handleClearListsSorts = () => {
    setListsCustomSortRules([]);
    setIsListsCustomSortActive(false);
    setIsListsColumnSortActive(false);
    // Clear localStorage
    localStorage.removeItem('cdm_lists_custom_sort_rules');
    localStorage.removeItem('cdm_lists_custom_sort_active');
    localStorage.removeItem('cdm_lists_column_sort_active');
  };

  // Persist variables custom sort rules to localStorage
  React.useEffect(() => {
    localStorage.setItem('cdm_variables_custom_sort_rules', JSON.stringify(variablesCustomSortRules));
  }, [variablesCustomSortRules]);

  // Persist variables custom sort active state to localStorage
  React.useEffect(() => {
    localStorage.setItem('cdm_variables_custom_sort_active', isVariablesCustomSortActive.toString());
  }, [isVariablesCustomSortActive]);

  // Persist variables column sort active state to localStorage
  React.useEffect(() => {
    localStorage.setItem('cdm_variables_column_sort_active', isVariablesColumnSortActive.toString());
  }, [isVariablesColumnSortActive]);

  // Persist lists custom sort rules to localStorage
  React.useEffect(() => {
    localStorage.setItem('cdm_lists_custom_sort_rules', JSON.stringify(listsCustomSortRules));
  }, [listsCustomSortRules]);

  // Persist lists custom sort active state to localStorage
  React.useEffect(() => {
    localStorage.setItem('cdm_lists_custom_sort_active', isListsCustomSortActive.toString());
  }, [isListsCustomSortActive]);

  // Persist lists column sort active state to localStorage
  React.useEffect(() => {
    localStorage.setItem('cdm_lists_column_sort_active', isListsColumnSortActive.toString());
  }, [isListsColumnSortActive]);


  return (
    <div className="h-screen bg-ag-dark-bg flex flex-col">
      {/* Header */}
      <div className="bg-ag-dark-surface border-b border-ag-dark-border px-6 py-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-ag-dark-text">Canonical Data Model</h1>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-6 bg-ag-dark-bg" style={{backgroundColor: '#1a1d23'}}>
        <TabNavigation 
          tabs={dynamicTabs} 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
        />
      </div>

      {/* Main Content */}
      <div className="px-6 py-6 flex-1 min-h-0 bg-ag-dark-bg overflow-hidden flex flex-col" style={{backgroundColor: '#1a1d23'}}>
        {/* Coming Soon Tabs */}
        {['ledgers', 'sources'].includes(activeTab) ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="text-6xl mb-4">🚧</div>
              <h2 className="text-2xl font-semibold text-ag-dark-text mb-2 capitalize">{activeTab}</h2>
              <p className="text-lg text-ag-dark-text-secondary">Coming Soon</p>
            </div>
          </div>
        ) : activeTab === 'drivers' ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full bg-ag-dark-bg" style={{backgroundColor: '#1a1d23'}}>
            {/* Drivers Columns */}
            <div className="lg:col-span-3 flex flex-col h-full bg-ag-dark-bg" style={{backgroundColor: '#1a1d23'}}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 flex-1 min-h-0 bg-ag-dark-bg" style={{backgroundColor: '#1a1d23'}}>
                <DriversColumn
                  title="Sector"
                  items={driversState.sectors}
                  onHeaderClick={() => handleColumnHeaderClick('sectors')}
                  onItemClick={(item) => handleItemClick('sectors', item)}
                  onReorder={(newOrder) => handleDriversReorder('sectors', newOrder)}
                  selectedItem={selectedColumn === 'sectors' ? selectedItem : undefined}
                  canAddNew={true}
                  onDeleteItem={(item) => handleDriverDeleteClick(item, 'sectors')}
                />
                <DriversColumn
                  title="Domain"
                  items={driversState.domains}
                  onHeaderClick={() => handleColumnHeaderClick('domains')}
                  onItemClick={(item) => handleItemClick('domains', item)}
                  onReorder={(newOrder) => handleDriversReorder('domains', newOrder)}
                  selectedItem={selectedColumn === 'domains' ? selectedItem : undefined}
                  canAddNew={true}
                  onDeleteItem={(item) => handleDriverDeleteClick(item, 'domains')}
                />
                <DriversColumn
                  title="Country"
                  items={driversState.countries}
                  onHeaderClick={() => handleColumnHeaderClick('countries')}
                  onItemClick={(item) => handleItemClick('countries', item)}
                  onReorder={(newOrder) => handleDriversReorder('countries', newOrder)}
                  selectedItem={selectedColumn === 'countries' ? selectedItem : undefined}
                  canAddNew={true}
                  onDeleteItem={(item) => handleDriverDeleteClick(item, 'countries')}
                />
                <DriversColumn
                  title=""
                  items={driversState.objectClarifiers}
                  onHeaderClick={() => handleColumnHeaderClick('objectClarifiers')}
                  onItemClick={(item) => handleItemClick('objectClarifiers', item)}
                  onReorder={(newOrder) => handleDriversReorder('objectClarifiers', newOrder)}
                  selectedItem={selectedColumn === 'objectClarifiers' ? selectedItem : undefined}
                  canAddNew={true}
                  onDeleteItem={(item) => handleDriverDeleteClick(item, 'objectClarifiers')}
                />
                <DriversColumn
                  title=""
                  items={driversState.variableClarifiers}
                  onHeaderClick={() => handleColumnHeaderClick('variableClarifiers')}
                  onItemClick={(item) => handleItemClick('variableClarifiers', item)}
                  onReorder={(newOrder) => handleDriversReorder('variableClarifiers', newOrder)}
                  selectedItem={selectedColumn === 'variableClarifiers' ? selectedItem : undefined}
                  canAddNew={true}
                  onDeleteItem={(item) => handleDriverDeleteClick(item, 'variableClarifiers')}
                />
              </div>
            </div>

            {/* Drivers Metadata Panel */}
            <div className="lg:col-span-1 bg-ag-dark-bg" style={{backgroundColor: '#1a1d23'}}>
              <DriversMetadataPanel
                title={selectedColumn ? `${columnLabels[selectedColumn]} Metadata` : 'Metadata'}
                selectedColumn={selectedColumn}
                selectedItem={selectedItem}
                onSave={handleDriversSave}
                onAddNew={handleDriversAddNew}
                canAddNew={true}
              />
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 relative" style={{ height: '100%' }}>
          {/* Data Grid */}
          <div className="lg:col-span-2 flex flex-col min-h-0 h-full">
            {/* Grid Header with Actions */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              {/* Left side: Add, Upload, Custom Sort (for Objects and Variables tabs) */}
              <div className="flex items-center gap-3">
                {(activeTab === 'objects' || activeTab === 'variables') && (
                  <>
                    {/* Add Object/Variable Button */}
                    <button
                      onClick={() => activeTab === 'variables' ? setIsAddVariableOpen(true) : setIsAddObjectOpen(true)}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-ag-dark-accent text-white rounded text-sm font-medium hover:bg-ag-dark-accent-hover transition-colors min-w-[140px]"
                      title={activeTab === 'variables' ? 'Add Variable' : 'Add Object'}
                    >
                      <Plus className="w-4 h-4" />
                      Add {activeTab === 'variables' ? 'Variable' : 'Object'}
                    </button>
                    
                    {/* Upload Button */}
                    <button
                      onClick={() => {
                        if (activeTab === 'variables') {
                          setIsBulkVariableUploadOpen(true);
                        } else {
                          setIsBulkObjectUploadOpen(true);
                        }
                      }}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-ag-dark-border rounded bg-ag-dark-bg text-sm font-medium text-ag-dark-text hover:bg-ag-dark-surface transition-colors min-w-[140px]"
                      title={activeTab === 'variables' ? 'Upload Variables' : 'Upload Objects'}
                    >
                      <Upload className="w-4 h-4" />
                      Upload
                    </button>
                    
                    {/* Custom Sort Button */}
                    <button
                      onClick={() => {
                        if (activeTab === 'objects') {
                          setIsCustomSortOpen(true);
                        } else if (activeTab === 'variables') {
                          setIsVariablesCustomSortOpen(true);
                        }
                      }}
                      className={`inline-flex items-center justify-center gap-2 px-3 py-2 border rounded text-sm font-medium transition-colors min-w-[140px] ${
                        (activeTab === 'objects' && isCustomSortActive) || (activeTab === 'variables' && isVariablesCustomSortActive)
                          ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10 text-ag-dark-accent' 
                          : 'border-ag-dark-border bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface'
                      }`}
                      title="Sort the grid by multiple columns"
                    >
                      <ArrowUpDown className="w-4 h-4" />
                      Custom Sort
                      {activeTab === 'objects' && isCustomSortActive && (
                        <span className="ml-1 text-xs bg-ag-dark-accent text-white px-1.5 py-0.5 rounded">
                          Grid Sort Active
                        </span>
                      )}
                      {activeTab === 'variables' && isVariablesCustomSortActive && (
                        <span className="ml-1 text-xs bg-ag-dark-accent text-white px-1.5 py-0.5 rounded">
                          Grid Sort Active
                        </span>
                      )}
                      {activeTab === 'objects' && isColumnSortActive && !isCustomSortActive && (
                        <span className="ml-1 text-xs bg-ag-dark-text-secondary text-white px-1.5 py-0.5 rounded">
                          Column Sort Active
                        </span>
                      )}
                      {activeTab === 'variables' && isVariablesColumnSortActive && !isVariablesCustomSortActive && (
                        <span className="ml-1 text-xs bg-ag-dark-text-secondary text-white px-1.5 py-0.5 rounded">
                          Column Sort Active
                        </span>
                      )}
                    </button>
                    
                    {/* Order Button (Variables only) */}
                    {activeTab === 'variables' && (
                      <button
                        onClick={() => setIsVariablesOrderOpen(true)}
                        className={`inline-flex items-center justify-center gap-2 px-3 py-2 border rounded text-sm font-medium transition-colors min-w-[140px] ${
                          isVariablesOrderEnabled
                            ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10 text-ag-dark-accent' 
                            : 'border-ag-dark-border bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface'
                        }`}
                        title="Define custom sort order for Part, Section, Group, and Variable columns"
                      >
                        <ArrowUpDown className="w-4 h-4" />
                        Default Order
                        {isVariablesOrderEnabled && (
                          <span className="ml-1 text-xs bg-ag-dark-accent text-white px-1.5 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </button>
                    )}
                    
                    {/* Order Button (Objects only) */}
                    {activeTab === 'objects' && (
                      <button
                        onClick={() => setIsObjectsOrderOpen(true)}
                        className={`inline-flex items-center justify-center gap-2 px-3 py-2 border rounded text-sm font-medium transition-colors min-w-[140px] ${
                          isObjectsOrderEnabled
                            ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10 text-ag-dark-accent' 
                            : 'border-ag-dark-border bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface'
                        }`}
                        title="Define custom sort order for Being, Avatar, and Object columns"
                      >
                        <ArrowUpDown className="w-4 h-4" />
                        Default Order
                        {isObjectsOrderEnabled && (
                          <span className="ml-1 text-xs bg-ag-dark-accent text-white px-1.5 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </button>
                    )}
                    
                    {/* Order Button (Lists only) */}
                    {activeTab === 'lists' && (
                      <button
                        onClick={() => setIsListsOrderOpen(true)}
                        className={`inline-flex items-center justify-center gap-2 px-3 py-2 border rounded text-sm font-medium transition-colors min-w-[140px] ${
                          isListsOrderEnabled
                            ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10 text-ag-dark-accent' 
                            : 'border-ag-dark-border bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface'
                        }`}
                        title="Define custom sort order for Set, Grouping, and List columns"
                      >
                        <ArrowUpDown className="w-4 h-4" />
                        Default Order
                        {isListsOrderEnabled && (
                          <span className="ml-1 text-xs bg-ag-dark-accent text-white px-1.5 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </button>
                    )}
                    
                    {/* Generic Button */}
                    {(activeTab === 'objects' || activeTab === 'variables' || activeTab === 'lists') && (
                      <button
                        onClick={() => {
                          if (activeTab === 'objects') {
                            if (activeView === 'Generic') {
                              handleViewsApply('None');
                            } else {
                              handleViewsApply('Generic');
                            }
                          } else if (activeTab === 'variables') {
                            if (activeVariablesView === 'Generic') {
                              handleViewsApply('None');
                            } else {
                              handleViewsApply('Generic');
                            }
                          } else if (activeTab === 'lists') {
                            if (activeListsView === 'Generic') {
                              handleViewsApply('None');
                            } else {
                              handleViewsApply('Generic');
                            }
                          }
                        }}
                        className={`inline-flex items-center justify-center gap-1 px-3 py-2 border rounded text-sm font-medium transition-colors min-w-[140px] ${
                          ((activeTab === 'objects' && activeView === 'Generic') || 
                           (activeTab === 'variables' && activeVariablesView === 'Generic') ||
                           (activeTab === 'lists' && activeListsView === 'Generic'))
                            ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10 text-ag-dark-accent' 
                            : 'border-ag-dark-border bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface'
                        }`}
                        title="Toggle Generic view (S/D/C = All)"
                      >
                        Generic
                      </button>
                    )}
                    
                    {/* Reset Filter Button (small box) */}
                    {((activeTab === 'objects' && objectsResetHandlers?.hasActiveFilters) || 
                      (activeTab === 'variables' && variablesResetHandlers?.hasActiveFilters)) && (
                      <button
                        onClick={() => {
                          if (activeTab === 'objects' && objectsResetHandlers) {
                            objectsResetHandlers.clearFilters();
                          } else if (activeTab === 'variables' && variablesResetHandlers) {
                            variablesResetHandlers.clearFilters();
                          }
                        }}
                        className="inline-flex items-center justify-center w-8 h-8 border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors"
                        title="Reset Filters"
                      >
                        <Filter className="w-4 h-4" />
                      </button>
                    )}
                    
                    {/* Reset Sort Button (small box) */}
                    {((activeTab === 'objects' && objectsResetHandlers?.hasActiveSorting) || 
                      (activeTab === 'variables' && variablesResetHandlers?.hasActiveSorting)) && (
                      <button
                        onClick={() => {
                          if (activeTab === 'objects' && objectsResetHandlers) {
                            objectsResetHandlers.resetSorting();
                          } else if (activeTab === 'variables' && variablesResetHandlers) {
                            variablesResetHandlers.resetSorting();
                          }
                        }}
                        className="inline-flex items-center justify-center w-8 h-8 border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors"
                        title="Reset Sorting"
                      >
                        <ArrowUpDown className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
                
                {/* Lists tab buttons */}
                {activeTab === 'lists' && (
                  <>
                    {/* Add List Button */}
                    <button
                      onClick={() => setIsAddListOpen(true)}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-ag-dark-accent text-white rounded text-sm font-medium hover:bg-ag-dark-accent-hover transition-colors min-w-[140px]"
                      title="Add List"
                    >
                      <Plus className="w-4 h-4" />
                      Add List
                    </button>
                    
                    {/* Upload Button */}
                    <button
                      onClick={() => setIsBulkListUploadOpen(true)}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-ag-dark-border rounded bg-ag-dark-bg text-sm font-medium text-ag-dark-text hover:bg-ag-dark-surface transition-colors min-w-[140px]"
                      title="Upload Lists"
                    >
                      <Upload className="w-4 h-4" />
                      Upload
                    </button>
                    
                    {/* Custom Sort Button */}
                    <button
                      onClick={() => setIsListsCustomSortOpen(true)}
                      className={`inline-flex items-center justify-center gap-2 px-3 py-2 border rounded text-sm font-medium transition-colors min-w-[140px] ${
                        isListsCustomSortActive
                          ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10 text-ag-dark-accent' 
                          : 'border-ag-dark-border bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface'
                      }`}
                      title="Sort the grid by multiple columns"
                    >
                      <ArrowUpDown className="w-4 h-4" />
                      Custom Sort
                      {isListsCustomSortActive && (
                        <span className="ml-1 text-xs bg-ag-dark-accent text-white px-1.5 py-0.5 rounded">
                          Grid Sort Active
                        </span>
                      )}
                      {isListsColumnSortActive && !isListsCustomSortActive && (
                        <span className="ml-1 text-xs bg-ag-dark-text-secondary text-white px-1.5 py-0.5 rounded">
                          Column Sort Active
                        </span>
                      )}
                    </button>
                    
                    {/* Order Button (Lists only) */}
                    <button
                      onClick={() => setIsListsOrderOpen(true)}
                      className={`inline-flex items-center justify-center gap-2 px-3 py-2 border rounded text-sm font-medium transition-colors min-w-[140px] ${
                        isListsOrderEnabled
                          ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10 text-ag-dark-accent' 
                          : 'border-ag-dark-border bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface'
                      }`}
                      title="Define custom sort order for Set, Grouping, and List columns"
                    >
                      <ArrowUpDown className="w-4 h-4" />
                      Default Order
                      {isListsOrderEnabled && (
                        <span className="ml-1 text-xs bg-ag-dark-accent text-white px-1.5 py-0.5 rounded">
                          Active
                        </span>
                      )}
                    </button>
                    
                    {/* Generic Button */}
                    <button
                      onClick={() => {
                        if (activeListsView === 'Generic') {
                          handleViewsApply('None');
                        } else {
                          handleViewsApply('Generic');
                        }
                      }}
                      className={`inline-flex items-center justify-center gap-1 px-3 py-2 border rounded text-sm font-medium transition-colors min-w-[140px] ${
                        activeListsView === 'Generic'
                          ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10 text-ag-dark-accent' 
                          : 'border-ag-dark-border bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface'
                      }`}
                      title="Toggle Generic view (S/D/C = All)"
                    >
                      Generic
                    </button>
                    
                    {/* Reset Filter Button (small box) */}
                    {listsResetHandlers?.hasActiveFilters && (
                      <button
                        onClick={() => listsResetHandlers?.clearFilters()}
                        className="inline-flex items-center justify-center w-8 h-8 border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors"
                        title="Reset Filters"
                      >
                        <Filter className="w-4 h-4" />
                      </button>
                    )}
                    
                    {/* Reset Sort Button (small box) */}
                    {listsResetHandlers?.hasActiveSorting && (
                      <button
                        onClick={() => listsResetHandlers?.resetSorting()}
                        className="inline-flex items-center justify-center w-8 h-8 border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors"
                        title="Reset Sorting"
                      >
                        <ArrowUpDown className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
                
                {selectedRows.length > 1 && (
                  <button
                    onClick={() => setIsBulkDeleteOpen(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-ag-dark-error text-white rounded text-sm font-medium hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Selected ({selectedRows.length})
                  </button>
                )}
              </div>
              
              {/* Right side: Empty for now - buttons moved to metadata panel */}
              <div></div>
            </div>
            
            {/* Grid Content Area - Relative container for graph modal */}
            <div className="relative flex-1 min-h-0 overflow-hidden flex flex-col">
              {/* Filter Panel */}
              <FilterPanel
                columns={activeTab === 'lists' ? listColumns : activeTab === 'variables' ? variableColumns : objectColumns}
                data={activeTab === 'lists' ? listData : activeTab === 'variables' ? variableData : filteredData}
                filters={filters}
                onFilterChange={handleFilterChange}
                isOpen={false}
                activeTab={activeTab}
              />
              
              {/* Data Grid */}
              <div className="flex-1 min-h-0">
              <DataGrid
                key={activeTab} // Force remount when switching tabs to prevent state bleeding
                columns={activeTab === 'lists' ? listColumns : activeTab === 'variables' ? variableColumns : objectColumns}
                data={activeTab === 'lists' ? filteredListData : activeTab === 'variables' ? filteredVariableData : filteredData}
                onRowSelect={handleRowSelect}
                onDelete={handleDelete}
                onClone={handleClone}
                selectionMode={activeTab === 'objects' || activeTab === 'variables' || activeTab === 'lists' ? 'row' : 'checkbox'}
                selectedRows={selectedRows}
                onReorder={activeTab === 'lists' ? (newData: Record<string, any>[]) => setListData(newData as ListData[]) : activeTab === 'variables' ? (newData: Record<string, any>[]) => setVariableData(newData as VariableData[]) : (newData: Record<string, any>[]) => setData(newData as ObjectData[])}
                affectedIds={activeTab === 'objects' ? affectedObjectIds : activeTab === 'variables' ? affectedVariableIds : new Set()}
                deletedDriverType={deletedDriverType}
                customSortRules={activeTab === 'objects' ? customSortRules : activeTab === 'variables' ? variablesCustomSortRules : activeTab === 'lists' ? listsCustomSortRules : []}
                onClearCustomSort={activeTab === 'objects' ? handleClearAllSorts : activeTab === 'variables' ? handleClearVariablesSorts : activeTab === 'lists' ? handleClearListsSorts : undefined}
                onColumnSort={activeTab === 'objects' ? handleColumnSort : activeTab === 'variables' ? handleVariablesColumnSort : activeTab === 'lists' ? handleListsColumnSort : undefined}
                isCustomSortActive={activeTab === 'objects' ? isCustomSortActive : activeTab === 'variables' ? isVariablesCustomSortActive : activeTab === 'lists' ? isListsCustomSortActive : false}
                isColumnSortActive={activeTab === 'objects' ? isColumnSortActive : activeTab === 'variables' ? isVariablesColumnSortActive : activeTab === 'lists' ? isListsColumnSortActive : false}
                gridType={activeTab === 'lists' ? 'lists' : activeTab === 'variables' ? 'variables' : 'objects'}
                isPredefinedSortEnabled={
                  activeTab === 'variables' ? isVariablesOrderEnabled :
                  activeTab === 'objects' ? isObjectsOrderEnabled :
                  activeTab === 'lists' ? isListsOrderEnabled : false
                }
                predefinedSortOrder={
                  activeTab === 'variables' ? variablesOrderSortOrder :
                  activeTab === 'objects' ? objectsOrderSortOrder :
                  activeTab === 'lists' ? listsOrderSortOrder : undefined
                }
                onResetHandlersReady={activeTab === 'objects' ? setObjectsResetHandlers : activeTab === 'variables' ? setVariablesResetHandlers : activeTab === 'lists' ? setListsResetHandlers : undefined}
              />
              </div>
            </div>
          </div>

          {/* Metadata Panel */}
          {(isAddObjectOpen && activeTab === 'objects') ? (
            <div className="lg:col-span-1">
              <AddObjectPanel
                isOpen={isAddObjectOpen}
                onClose={() => setIsAddObjectOpen(false)}
                onAdd={handleAddObject}
                allData={data}
              />
            </div>
          ) : (isAddVariableOpen && activeTab === 'variables') ? (
            <div className="lg:col-span-1">
              <AddVariablePanel
                isOpen={isAddVariableOpen}
                onClose={() => setIsAddVariableOpen(false)}
                onAdd={handleAddVariable}
                allData={variableData}
                objectsData={data}
              />
            </div>
          ) : (isAddListOpen && activeTab === 'lists') ? (
            <div className="lg:col-span-1">
              <AddListPanel
                isOpen={isAddListOpen}
                onClose={() => setIsAddListOpen(false)}
                onAdd={handleAddList}
                allData={listData}
              />
            </div>
          ) : isBulkEditOpen ? (
            <div className="lg:col-span-1">
              <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
                <BulkEditPanel
                  isOpen={isBulkEditOpen}
                  onClose={() => {}} // Not used - panel closes automatically when selection changes
                  onSave={handleBulkEdit}
                  selectedCount={selectedRows.length}
                  allData={activeTab === 'lists' ? listData : activeTab === 'variables' ? variableData : data}
                  activeTab={activeTab}
                  selectedObjects={selectedRows}
                  onObjectsRefresh={activeTab === 'objects' ? fetchObjects : undefined}
                />
              </div>
            </div>
          ) : (isBulkEditVariablesOpen && activeTab === 'variables') ? (
            <div className="lg:col-span-1">
              <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
                <BulkEditVariablesPanel
                  isOpen={isBulkEditVariablesOpen}
                  onClose={() => setIsBulkEditVariablesOpen(false)}
                  onSave={handleBulkEdit}
                  selectedCount={selectedRows.length}
                  allData={variableData}
                  objectsData={data}
                  selectedVariableIds={selectedRows.map(row => row.id).filter(Boolean) as string[]}
                  selectedVariableNames={selectedRows.map(row => row.variable).filter(Boolean) as string[]}
                />
              </div>
            </div>
          ) : (
            <div className="lg:col-span-1">
              <div className="sticky top-0 max-h-[calc(100vh-3rem)] overflow-y-auto">
                {/* Two equal-sized buttons: Graph View, Grid View (for Objects, Variables, and Lists tabs) */}
                {/* Position buttons to align with Custom Sort/Add buttons on the left - match the grid header height */}
                {(activeTab === 'objects' || activeTab === 'variables' || activeTab === 'lists') && (
                  <div className="mb-4 grid grid-cols-2 gap-2 flex-shrink-0" style={{ marginTop: '0' }}>
                    {/* Graph View Button */}
                    <button
                      onClick={() => {
                        if (activeTab === 'objects') {
                          setIsNeo4jGraphModalOpen(true);
                        } else if (activeTab === 'variables') {
                          setIsNeo4jVariablesGraphModalOpen(true);
                        } else if (activeTab === 'lists') {
                          setIsNeo4jListsGraphModalOpen(true);
                        }
                      }}
                      className={`inline-flex items-center justify-center gap-1 px-3 py-2 border rounded text-sm font-medium transition-colors ${
                        ((activeTab === 'objects' && isNeo4jGraphModalOpen) || 
                         (activeTab === 'variables' && isNeo4jVariablesGraphModalOpen) ||
                         (activeTab === 'lists' && isNeo4jListsGraphModalOpen))
                          ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10 text-ag-dark-accent' 
                          : 'border-ag-dark-border bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface'
                      }`}
                      title="Graph View"
                    >
                      <Network className="w-4 h-4" />
                      <span className="text-xs">Graph View</span>
                    </button>
                    
                    {/* Grid View Button */}
                    <button
                      onClick={() => {
                        if (activeTab === 'objects') {
                          setIsNeo4jGraphModalOpen(false);
                        } else if (activeTab === 'variables') {
                          setIsNeo4jVariablesGraphModalOpen(false);
                        } else if (activeTab === 'lists') {
                          setIsNeo4jListsGraphModalOpen(false);
                        }
                      }}
                      className={`inline-flex items-center justify-center gap-1 px-3 py-2 border rounded text-sm font-medium transition-colors ${
                        ((activeTab === 'objects' && !isNeo4jGraphModalOpen) || 
                         (activeTab === 'variables' && !isNeo4jVariablesGraphModalOpen) ||
                         (activeTab === 'lists' && !isNeo4jListsGraphModalOpen))
                          ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10 text-ag-dark-accent' 
                          : 'border-ag-dark-border bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface'
                      }`}
                      title="Grid View"
                    >
                      <span className="text-xs">Grid View</span>
                    </button>
                  </div>
                )}
                {activeTab === 'lists' ? (
                  <ListMetadataPanel
                    title="List Metadata"
                    fields={currentMetadataFields}
                    onSave={handleMetadataSave}
                    selectedList={selectedRowForMetadata}
                    allData={listData}
                    selectedCount={selectedRows.length}
                  />
                ) : activeTab === 'variables' ? (
                  <VariableMetadataPanel
                    title="Variable Metadata"
                    fields={currentMetadataFields}
                    onSave={handleMetadataSave}
                    selectedVariable={selectedRowForMetadata}
                    allData={variableData}
                    objectsData={data}
                    selectedCount={selectedRows.length}
                    onObjectsRefresh={fetchObjects}
                  />
                ) : (
                  <MetadataPanel
                    fields={currentMetadataFields}
                    onSave={handleMetadataSave}
                    selectedObject={selectedRowForMetadata}
                    allData={data}
                    selectedCount={selectedRows.length}
                    affectedObjectIds={affectedObjectIds}
                    deletedDriverType={deletedDriverType}
                    onEnterRelationshipView={handleEnterRelationshipView}
                    onObjectsRefresh={fetchObjects}
                  />
                )}
              </div>
            </div>
          )}
          
          {/* Graph Modal - Positioned absolutely to cover both grid and metadata panel */}
          {(activeTab === 'objects' && isNeo4jGraphModalOpen) && (
            <Neo4jGraphModal
              isOpen={isNeo4jGraphModalOpen}
              onClose={() => setIsNeo4jGraphModalOpen(false)}
              graphType="objects"
            />
          )}
          {(activeTab === 'variables' && isNeo4jVariablesGraphModalOpen) && (
            <Neo4jGraphModal
              isOpen={isNeo4jVariablesGraphModalOpen}
              onClose={() => setIsNeo4jVariablesGraphModalOpen(false)}
              graphType="variables"
            />
          )}
          {(activeTab === 'lists' && isNeo4jListsGraphModalOpen) && (
            <Neo4jGraphModal
              isOpen={isNeo4jListsGraphModalOpen}
              onClose={() => setIsNeo4jListsGraphModalOpen(false)}
              graphType="lists"
            />
          )}
        </div>
        )}
      </div>

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-ag-dark-text mb-4">Delete {activeTab === 'lists' ? 'Lists' : activeTab === 'variables' ? 'Variables' : 'Objects'}</h3>
            <p className="text-ag-dark-text-secondary mb-6">Are you sure you want to delete {selectedRows.length} {activeTab}? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setIsBulkDeleteOpen(false)} className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors">Cancel</button>
              <button onClick={handleBulkDelete} className="px-4 py-2 bg-ag-dark-error text-white rounded hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Object Upload Modal */}
      <BulkObjectUploadModal
        isOpen={isBulkObjectUploadOpen}
        onClose={() => setIsBulkObjectUploadOpen(false)}
        onUpload={handleBulkObjectUpload}
      />

      {/* Bulk Variable Upload Modal */}
      <BulkVariableUploadModal
        isOpen={isBulkVariableUploadOpen}
        onClose={() => !isBulkVariableUploading && setIsBulkVariableUploadOpen(false)}
        onUpload={handleBulkVariableUpload}
        isLoading={isBulkVariableUploading}
      />

      {/* Loading Modal for Bulk Variable Upload */}
      {isBulkVariableUploading && (
        <LoadingModal
          isOpen={true}
          loadingType="variables"
          message="Uploading variables from CSV... This may take a few minutes for large files."
        />
      )}

      {/* Bulk List Upload Modal */}
      <BulkListUploadModal
        isOpen={isBulkListUploadOpen}
        onClose={() => setIsBulkListUploadOpen(false)}
        onUpload={handleBulkListUpload}
        existingData={listData}
      />

      {/* Driver Delete Confirmation Modal */}
      <DriverDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={handleDriverDeleteCancel}
        onConfirm={handleDriverDeleteConfirm}
        driverName={driverToDelete?.name || ''}
        driverType={driverToDelete ? columnLabels[driverToDelete.type] : ''}
      />

      {/* Custom Sort Modal - Objects */}
      <CustomSortModal
        isOpen={isCustomSortOpen}
        onClose={() => setIsCustomSortOpen(false)}
        onApplySort={handleCustomSortApply}
        columns={objectColumns}
        currentSortRules={customSortRules}
        isDefaultOrderEnabled={isObjectsOrderEnabled}
        onDefaultOrderToggle={handleObjectsDefaultOrderToggle}
      />

      {/* Variables Custom Sort Modal */}
      <VariablesCustomSortModal
        isOpen={isVariablesCustomSortOpen}
        onClose={() => setIsVariablesCustomSortOpen(false)}
        onApplySort={handleVariablesCustomSortApply}
        columns={variableColumns}
        currentSortRules={variablesCustomSortRules}
        isDefaultOrderEnabled={isVariablesOrderEnabled}
        onDefaultOrderToggle={handleVariablesDefaultOrderToggle}
      />

      {/* Variables Order Modal */}
      <VariablesOrderModal
        isOpen={isVariablesOrderOpen}
        onClose={() => setIsVariablesOrderOpen(false)}
        onSaveOrder={handleVariablesOrderSave}
        variableData={variableData}
        sortConfig={(() => {
          try {
            const savedSortConfig = localStorage.getItem('cdm_variables_sort_config');
            return savedSortConfig ? JSON.parse(savedSortConfig) : null;
          } catch {
            return null;
          }
        })()}
        orderSortOrder={variablesOrderSortOrder}
      />

      {/* Objects Order Modal */}
      <ObjectsOrderModal
        isOpen={isObjectsOrderOpen}
        onClose={() => setIsObjectsOrderOpen(false)}
        onSaveOrder={handleObjectsOrderSave}
        objectData={data}
        orderSortOrder={objectsOrderSortOrder}
      />

      {/* Lists Order Modal */}
      <ListsOrderModal
        isOpen={isListsOrderOpen}
        onClose={() => setIsListsOrderOpen(false)}
        onSaveOrder={handleListsOrderSave}
        listData={listData}
        orderSortOrder={listsOrderSortOrder}
      />

      {/* Views Modal - Objects */}
      <ViewsModal
        isOpen={isViewsOpen}
        onClose={() => setIsViewsOpen(false)}
        onApplyView={handleViewsApply}
        activeView={activeView}
      />

      {/* Views Modal - Variables */}
      <ViewsModal
        isOpen={isVariablesViewsOpen}
        onClose={() => setIsVariablesViewsOpen(false)}
        onApplyView={handleViewsApply}
        activeView={activeVariablesView}
      />

      {/* Lists Custom Sort Modal */}
      <ListsCustomSortModal
        isOpen={isListsCustomSortOpen}
        onClose={() => setIsListsCustomSortOpen(false)}
        onApplySort={handleListsCustomSortApply}
        columns={listColumns}
        currentSortRules={listsCustomSortRules}
        isDefaultOrderEnabled={isListsOrderEnabled}
        onDefaultOrderToggle={handleListsDefaultOrderToggle}
      />

      {/* Lists Views Modal */}
      <ViewsModal
        isOpen={isListsViewsOpen}
        onClose={() => setIsListsViewsOpen(false)}
        onApplyView={handleViewsApply}
        activeView={activeListsView}
      />

      {/* Loading Modal */}
      <LoadingModal
        isOpen={isLoading}
        loadingType={loadingType}
      />


      {/* Relationship Modal */}
      <RelationshipModal
        isOpen={isRelationshipModalOpen}
        onClose={() => {
          setIsRelationshipModalOpen(false);
          setInitialRelationships([]); // Clear initial relationships after closing
        }}
        selectedObject={selectedRowForMetadata}
        allObjects={data}
        onSave={() => {
          setInitialRelationships([]); // Clear after saving
          fetchObjects();
        }}
        onRelationshipsChange={(relationships) => {
          // For cloned unsaved objects, update the relationshipsList in local state
          if (selectedRowForMetadata?._isCloned && !selectedRowForMetadata?._isSaved) {
            setData(prev => prev.map(item => 
              item.id === selectedRowForMetadata.id 
                ? { ...item, relationshipsList: relationships }
                : item
            ));
            setSelectedRowForMetadata(prev => prev ? { ...prev, relationshipsList: relationships } : null);
          }
        }}
        initialRelationships={initialRelationships}
      />

    </div>
  );
}

export default App;