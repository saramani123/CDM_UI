import React, { useState, useMemo } from 'react';
import { Plus, Upload, Edit2, ArrowUpDown } from 'lucide-react';
import { Trash2 } from 'lucide-react';
import { TabNavigation } from './components/TabNavigation';
import { DataGrid, FilterPanel } from './components/DataGrid';
import { MetadataPanel } from './components/MetadataPanel';
import { AddObjectPanel } from './components/AddObjectPanel';
import { BulkEditModal } from './components/BulkEditModal';
import { BulkEditPanel } from './components/BulkEditPanel';
import { BulkObjectUploadModal } from './components/BulkObjectUploadModal';
import { VariableMetadataPanel } from './components/VariableMetadataPanel';
import { AddVariablePanel } from './components/AddVariablePanel';
import { BulkVariableUploadModal } from './components/BulkVariableUploadModal';
import { BulkEditVariablesPanel } from './components/BulkEditVariablesPanel';
import { BulkListUploadModal } from './components/BulkListUploadModal';
import { AddListPanel } from './components/AddListPanel';
import { mockObjectData, objectColumns, metadataFields, getAvatarOptions, type ObjectData } from './data/mockData';
import { mockVariableData, variableColumns, variableMetadataFields, type VariableData } from './data/variablesData';
import { mockListData, listColumns, listMetadataFields, type ListData } from './data/listsData';
import { driversData, type ColumnType, columnLabels } from './data/driversData';
import { useObjects } from './hooks/useObjects';
import { useDrivers } from './hooks/useDrivers';
import { useVariables } from './hooks/useVariables';
import { DriversColumn } from './components/DriversColumn';
import { DriversMetadataPanel } from './components/DriversMetadataPanel';
import { ListMetadataPanel } from './components/ListMetadataPanel';
import { DriverDeleteModal } from './components/DriverDeleteModal';
import { CustomSortModal } from './components/CustomSortModal';

function App() {
  const [activeTab, setActiveTab] = useState('objects');
  const [selectedRows, setSelectedRows] = useState<ObjectData[]>([]);
  const [selectedRowForMetadata, setSelectedRowForMetadata] = useState<ObjectData | null>(null);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  
  // Use API hook for objects data
  const { objects: apiObjects, loading: objectsLoading, error: objectsError, createObject, updateObject, deleteObject, updateObjectWithRelationshipsAndVariants, createRelationship, createVariant, fetchObjects } = useObjects();
  
  // Use API hook for drivers data
  const { drivers: apiDrivers, loading: driversLoading, error: driversError, createDriver, updateDriver, deleteDriver } = useDrivers();
  
  // Use API hook for variables data
  const { variables: apiVariables, loading: variablesLoading, error: variablesError, createVariable, updateVariable, deleteVariable, createObjectRelationship, deleteObjectRelationship, bulkUploadVariables, bulkUpdateVariables, fetchVariables } = useVariables();
  
  // Fallback to mock data if API fails
  const [data, setData] = useState<ObjectData[]>([]);
  const [isAddObjectOpen, setIsAddObjectOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkObjectUploadOpen, setIsBulkObjectUploadOpen] = useState(false);
  const [variableData, setVariableData] = useState<VariableData[]>([]);
  const [isAddVariableOpen, setIsAddVariableOpen] = useState(false);
  const [isBulkVariableUploadOpen, setIsBulkVariableUploadOpen] = useState(false);
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
  }>>([]);
  const [isCustomSortActive, setIsCustomSortActive] = useState(false);
  const [isColumnSortActive, setIsColumnSortActive] = useState(false);

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
    { id: 'functions', label: 'Functions' },
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
    
    if (!objectsLoading) {
      if (objectsError) {
        // Fallback to mock data if API fails
        console.log('Objects API failed, using mock data:', objectsError);
        setData(mockObjectData);
      } else {
        // Always use API data, even if empty
        console.log('App - Setting data to apiObjects:', apiObjects);
        console.log('App - Affected object IDs before data update:', Array.from(affectedObjectIds));
        
        // Check if any of the affected objects are in the new data
        if (affectedObjectIds.size > 0) {
          const affectedObjectsInNewData = apiObjects?.filter(obj => affectedObjectIds.has(obj.id)) || [];
          console.log('App - Affected objects in new data:', affectedObjectsInNewData.map(obj => ({ id: obj.id, driver: obj.driver })));
        }
        
        setData(apiObjects);
        console.log('App - Data updated, affected object IDs should still be:', Array.from(affectedObjectIds));
      }
    }
  }, [apiObjects, objectsError, objectsLoading]);

  // Sync API drivers data with local state
  React.useEffect(() => {
    if (!driversLoading) {
      if (driversError) {
        // Keep mock data if API fails
        console.log('Drivers API failed, using mock data:', driversError);
      } else if (apiDrivers) {
        // Always use API data, even if empty
        // Apply saved order from localStorage if available
        const orderedDrivers = { ...apiDrivers };
        
        // Check for saved order for each column type
        Object.keys(apiDrivers).forEach(columnType => {
          const storageKey = `cdm_drivers_order_${columnType}`;
          const savedOrder = localStorage.getItem(storageKey);
          
          if (savedOrder) {
            try {
              const parsedOrder = JSON.parse(savedOrder);
              const currentItems = apiDrivers[columnType as keyof typeof apiDrivers] || [];
              
              // Only apply saved order if it contains the same items (no additions/removals)
              if (Array.isArray(parsedOrder) && 
                  parsedOrder.length === currentItems.length &&
                  parsedOrder.every(item => currentItems.includes(item))) {
                orderedDrivers[columnType as keyof typeof orderedDrivers] = parsedOrder;
                console.log(`Applied saved order for ${columnType}:`, parsedOrder);
              } else {
                console.log(`Saved order for ${columnType} is outdated, using API order`);
              }
            } catch (error) {
              console.error(`Failed to parse saved order for ${columnType}:`, error);
            }
          }
        });
        
        setDriversState(orderedDrivers);
      }
    }
  }, [apiDrivers, driversError, driversLoading]);

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
        console.log('Using API variables data:', apiVariables);
        console.log('Setting variableData to:', apiVariables);
        setVariableData(apiVariables);
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
      
      return listMetadataFields.map(field => ({
        ...field,
        value: (() => {
          switch (field.key) {
            case 'driver':
              return selectedRowForMetadata.driver;
            case 'objectType':
              return selectedRowForMetadata.objectType;
            case 'clarifier':
              return selectedRowForMetadata.clarifier;
            case 'format':
              return selectedRowForMetadata.format;
            case 'variable':
              return selectedRowForMetadata.variable;
            case 'set':
              return selectedRowForMetadata.set;
            case 'grouping':
              return selectedRowForMetadata.grouping;
            case 'list':
              return selectedRowForMetadata.list;
            case 'source':
              return selectedRowForMetadata.source;
            case 'upkeep':
              return selectedRowForMetadata.upkeep;
            case 'graph':
              return selectedRowForMetadata.graph;
            case 'origin':
              return selectedRowForMetadata.origin;
            default:
              return '';
          }
        })()
      }));
    }
    
    if (activeTab === 'variables') {
      if (!selectedRowForMetadata) return variableMetadataFields;
      
      return variableMetadataFields.map(field => ({
        ...field,
        value: (() => {
          switch (field.key) {
            case 'driver':
              return selectedRowForMetadata.driver;
            case 'clarifier':
              return selectedRowForMetadata.clarifier;
            case 'part':
              return selectedRowForMetadata.part;
            case 'section':
              return selectedRowForMetadata.section;
            case 'group':
              return selectedRowForMetadata.group;
            case 'variable':
              return selectedRowForMetadata.variable;
            case 'formatI':
              return selectedRowForMetadata.formatI;
            case 'formatII':
              return selectedRowForMetadata.formatII;
            case 'gType':
              return selectedRowForMetadata.gType;
            case 'validation':
              return selectedRowForMetadata.validation;
            case 'default':
              return selectedRowForMetadata.default;
            case 'graph':
              return selectedRowForMetadata.graph;
            default:
              return '';
          }
        })()
      }));
    }
    
    if (!selectedRowForMetadata) return metadataFields;
    return metadataFields.map(field => ({
      ...field,
      value: (() => {
        switch (field.key) {
          case 'driver':
            return selectedRowForMetadata.driver;
          case 'being':
            return selectedRowForMetadata.being;
          case 'avatar':
            return selectedRowForMetadata.avatar;
          case 'object':
            return selectedRowForMetadata.object;
          case 'sector':
            return selectedRowForMetadata.sector || '';
          case 'domain':
            return selectedRowForMetadata.domain || '';
          case 'country':
            return selectedRowForMetadata.country || '';
          case 'classifier':
            return selectedRowForMetadata.classifier || '';
          case 'identifier':
            return selectedRowForMetadata.identifier || '';
          case 'discret':
            return selectedRowForMetadata.discret || '';
          case 'status':
            return selectedRowForMetadata.status || 'Active';
          default:
            return '';
        }
      })()
    }));
  }, [selectedRowForMetadata, activeTab]);

  const handleRowSelect = (rows: ObjectData[] | VariableData[]) => {
    setSelectedRows(rows);
    if (rows.length === 1) {
      setSelectedRowForMetadata(rows[0]);
    } else {
      setSelectedRowForMetadata(null);
    }
  };

  const handleEdit = (row: ObjectData | VariableData) => {
    // Edit functionality removed - only delete remains
  };

  const handleDelete = async (row: ObjectData | VariableData) => {
    if (confirm('Are you sure you want to delete this row?')) {
      try {
        if (activeTab === 'objects') {
          await deleteObject(row.id);
        } else if (activeTab === 'lists') {
          setListData(prev => prev.filter(item => item.id !== row.id));
        } else if (activeTab === 'variables') {
          setVariableData(prev => prev.filter(item => item.id !== row.id));
        }
        
        if (selectedRowForMetadata?.id === row.id) {
          setSelectedRowForMetadata(null);
        }
      } catch (error) {
        console.error('Failed to delete object:', error);
        // Fallback to local state update
        if (activeTab === 'objects') {
          setData(prev => prev.filter(item => item.id !== row.id));
        } else if (activeTab === 'lists') {
          setListData(prev => prev.filter(item => item.id !== row.id));
        } else if (activeTab === 'variables') {
          setVariableData(prev => prev.filter(item => item.id !== row.id));
        }
        
        if (selectedRowForMetadata?.id === row.id) {
          setSelectedRowForMetadata(null);
        }
      }
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
      
      const apiObjectData = {
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
        // Delete variables via API
        try {
          for (const id of selectedIds) {
            await deleteVariable(id);
          }
          setVariableData(prev => prev.filter(item => !selectedIds.includes(item.id)));
        } catch (error) {
          console.error('Error deleting variables:', error);
          alert('Failed to delete some variables. Please try again.');
        }
      } else if (activeTab === 'lists') {
        setListData(prev => prev.filter(item => !selectedIds.includes(item.id)));
      } else {
        setData(prev => prev.filter(item => !selectedIds.includes(item.id)));
      }
      
      setSelectedRows([]);
      setSelectedRowForMetadata(null);
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
              const duplicates = newVariantNames.filter(newName => 
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
          // Update list fields if they were changed
          Object.keys(updatedData).forEach(key => {
            if (updatedData[key] && !['variablesAttachedList', 'listValuesList'].includes(key)) {
              updated[key] = updatedData[key];
            }
          });
          
          // Append new variables attached if any were added
          if (updatedData.variablesAttachedList && updatedData.variablesAttachedList.length > 0) {
            const existingVariables = updated.variablesAttachedList || [];
            updated.variablesAttachedList = [...existingVariables, ...updatedData.variablesAttachedList];
          }
          
          // Append new list values if any were added
          if (updatedData.listValuesList && updatedData.listValuesList.length > 0) {
            const existingValues = updated.listValuesList || [];
            updated.listValuesList = [...existingValues, ...updatedData.listValuesList];
          }
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
      setListData(updateFunction);
    } else {
      setData(updateFunction);
    }
    
    setIsBulkEditOpen(false);
    setSelectedRows([]);
    setSelectedRowForMetadata(null);
  };
  const handleMetadataSave = async (updatedData: Record<string, any>) => {
    console.log('handleMetadataSave called with:', updatedData);
    if (selectedRowForMetadata) {
      let gridData = { ...updatedData };
      
      if (activeTab === 'variables') {
        // Handle variables update via API
        try {
          // Filter out objectRelationshipsList from the variable update data
          const { objectRelationshipsList, ...variableUpdateData } = updatedData;
          
          console.log('objectRelationshipsList:', objectRelationshipsList);
          console.log('variableUpdateData:', variableUpdateData);
          
          const result = await updateVariable(selectedRowForMetadata.id, variableUpdateData);
          
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
          
          // Update local state
          setVariableData(prev => prev.map(item => 
            item.id === selectedRowForMetadata.id 
              ? { ...item, ...variableUpdateData }
              : item
          ));
          
          setSelectedRowForMetadata({ ...selectedRowForMetadata, ...gridData });
          
          // Clear highlighting for this item if it was affected by driver deletion
          if (affectedVariableIds.has(selectedRowForMetadata.id)) {
            setAffectedVariableIds(prev => {
              const newSet = new Set(prev);
              newSet.delete(selectedRowForMetadata.id);
              return newSet;
            });
          }
          
          // Return success to indicate the save was successful
          return result;
        } catch (error) {
          console.error('Error updating variable:', error);
          alert('Failed to update variable. Please try again.');
          throw error; // Re-throw the error so the calling function knows it failed
        }
      } else if (activeTab === 'objects') {
        // Create clean object with only basic fields for the API
        const basicFields = {
          being: updatedData.being,
          avatar: updatedData.avatar,
          object: updatedData.object,
          driver: updatedData.driver
        };
        
        try {
          // Update the object via API
          console.log('Updating object via API:', { id: selectedRowForMetadata.id, data: basicFields });
          await updateObject(selectedRowForMetadata.id, basicFields);
          console.log('Object updated successfully');
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
            const validRelationships = (updatedData.relationshipsList || []).filter(rel => 
              rel.role && rel.toBeing && rel.toAvatar && rel.toObject
            );
            
            const validVariants = (updatedData.variantsList || []).filter(variant => 
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
        setListData(prev => prev.map(item => 
          item.id === selectedRowForMetadata.id 
            ? { ...item, ...gridData }
            : item
        ));
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

  const handleBulkAction = (action: string, value?: any) => {
    console.log('Bulk action:', action, 'Value:', value, 'Selected rows:', selectedRows.length);
    
    const currentData = activeTab === 'lists' ? listData : activeTab === 'variables' ? variableData : data;
    const setCurrentData = activeTab === 'lists' ? setListData : activeTab === 'variables' ? setVariableData : setData;
    
    // Here you would implement the actual bulk operations
    switch (action) {
      case 'updateStatus':
        setCurrentData(prev => prev.map(item => 
          selectedRows.some(selected => selected.id === item.id)
            ? { ...item, status: value }
            : item
        ));
        break;
      case 'delete':
        if (confirm(`Are you sure you want to delete ${selectedRows.length} rows?`)) {
          const selectedIds = selectedRows.map(row => row.id);
          setCurrentData(prev => prev.filter(item => !selectedIds.includes(item.id)));
          setSelectedRows([]);
        }
        break;
      default:
        break;
    }
  };

  const handleCsvUpload = (file: File) => {
    console.log('CSV upload:', file.name);
    // Here you would implement CSV parsing and data import
    // For now, just show a confirmation
    alert(`CSV file "${file.name}" would be processed and imported here.`);
  };

  const handleBulkObjectUpload = (objects: ObjectData[]) => {
    // Add objects to local state to refresh the UI
    setData(prev => [...prev, ...objects]);
    setIsBulkObjectUploadOpen(false);
  };

  const handleBulkVariableUpload = async (file: File) => {
    try {
      const result = await bulkUploadVariables(file);
      console.log('Bulk upload result:', result);
      setIsBulkVariableUploadOpen(false);
    } catch (error) {
      console.error('Bulk upload failed:', error);
      alert(`Bulk upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleBulkListUpload = (lists: ListData[]) => {
    setListData(prev => [...prev, ...lists]);
    setIsBulkListUploadOpen(false);
  };

  const handleAddList = (newListData: ListData) => {
    setListData(prev => [...prev, newListData]);
    setIsAddListOpen(false);
  };
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

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
      }
    }
  };

  const handleDriversAddNew = async (newValue: string) => {
    if (selectedColumn) {
      try {
        await createDriver(selectedColumn, newValue);
      } catch (error) {
        console.error('Failed to create driver:', error);
        // Fallback to local state update
        setDriversState(prev => ({
          ...prev,
          [selectedColumn]: [...prev[selectedColumn], newValue]
        }));
      }
    }
  };

  const handleDriversReorder = (columnType: ColumnType, newOrder: string[]) => {
    // Update local state
    setDriversState(prev => ({
      ...prev,
      [columnType]: newOrder
    }));
    
    // Persist the new order to localStorage
    const storageKey = `cdm_drivers_order_${columnType}`;
    localStorage.setItem(storageKey, JSON.stringify(newOrder));
  };

  const handleDriverDeleteClick = (driverName: string, columnType: ColumnType) => {
    setDriverToDelete({ name: driverName, type: columnType });
    setIsDeleteModalOpen(true);
  };

  const handleDriverDeleteConfirm = async () => {
    if (!driverToDelete) return;
    
    try {
      console.log(`Deleting driver: ${driverToDelete.name} of type: ${driverToDelete.type}`);
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
        const affectedObjectIds = new Set(affectedObjects.map((obj: any) => String(obj.id)));
        const affectedVariableIds = new Set(affectedVariables.map((var_: any) => String(var_.id)));
        
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
  }>) => {
    setCustomSortRules(sortRules);
    setIsCustomSortActive(sortRules.length > 0);
    setIsColumnSortActive(false); // Clear column sort when grid sort is applied
    console.log('Custom sort applied:', sortRules);
  };

  const handleClearCustomSort = () => {
    setCustomSortRules([]);
    setIsCustomSortActive(false);
  };

  const handleClearAllSorts = () => {
    setCustomSortRules([]);
    setIsCustomSortActive(false);
    setIsColumnSortActive(false);
  };

  const handleColumnSort = () => {
    // When a column sort is applied, clear grid-level sort
    if (isCustomSortActive) {
      setCustomSortRules([]);
      setIsCustomSortActive(false);
    }
    setIsColumnSortActive(true);
  };

  const exportToCsv = () => {
    const currentData = activeTab === 'variables' ? variableData : data;
    const currentColumns = activeTab === 'variables' ? variableColumns : objectColumns;
    
    // Simple CSV export implementation
    const csvContent = [
      currentColumns.map(col => col.title).join(','),
      ...currentData.map(row => currentColumns.map(col => row[col.key as keyof any]).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `${activeTab}-data.csv`);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen bg-ag-dark-bg flex flex-col">
      {/* Header */}
      <div className="bg-ag-dark-surface border-b border-ag-dark-border px-6 py-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-ag-dark-text">Canonical Data Model</h1>
          <p className="text-sm text-ag-dark-text-secondary mt-1">
            CDM Management Interface
          </p>
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
      <div className="px-6 py-6 flex-1 min-h-0 bg-ag-dark-bg" style={{backgroundColor: '#1a1d23'}}>
        {/* Coming Soon Tabs */}
        {['functions', 'ledgers', 'sources'].includes(activeTab) ? (
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
              <div className="flex items-center justify-between mb-4 flex-shrink-0 bg-ag-dark-bg" style={{backgroundColor: '#1a1d23'}}>
                <div>
                  <h2 className="text-lg font-semibold text-ag-dark-text">Drivers</h2>
                  <p className="text-sm text-ag-dark-text-secondary">
                    {driversLoading ? (
                      'Loading drivers...'
                    ) : driversError ? (
                      `Error: ${driversError} (using fallback data)`
                    ) : (
                      'Click on column headers to add new items, or click on items to edit them'
                    )}
                  </p>
                </div>
              </div>
              
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
                  canAddNew={false}
                  onDeleteItem={(item) => handleDriverDeleteClick(item, 'countries')}
                />
                <DriversColumn
                  title="Object Clarifier"
                  items={driversState.objectClarifiers}
                  onHeaderClick={() => handleColumnHeaderClick('objectClarifiers')}
                  onItemClick={(item) => handleItemClick('objectClarifiers', item)}
                  onReorder={(newOrder) => handleDriversReorder('objectClarifiers', newOrder)}
                  selectedItem={selectedColumn === 'objectClarifiers' ? selectedItem : undefined}
                  canAddNew={true}
                  onDeleteItem={(item) => handleDriverDeleteClick(item, 'objectClarifiers')}
                />
                <DriversColumn
                  title="Variable Clarifier"
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
                title={selectedColumn ? `${columnLabels[selectedColumn]} Metadata` : 'Column Metadata'}
                selectedColumn={selectedColumn}
                selectedItem={selectedItem}
                onSave={handleDriversSave}
                onAddNew={handleDriversAddNew}
                canAddNew={selectedColumn !== 'countries'}
              />
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Data Grid */}
          <div className="lg:col-span-2">
            {/* Grid Header with Actions */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-ag-dark-text capitalize">{activeTab}</h2>
                <p className="text-sm text-ag-dark-text-secondary">
                  {activeTab === 'objects' && objectsLoading ? (
                    'Loading objects...'
                  ) : activeTab === 'objects' && objectsError ? (
                    `Error: ${objectsError} (using fallback data)`
                  ) : selectedRows.length > 0 ? (
                    `${selectedRows.length} of ${activeTab === 'lists' ? listData.length : activeTab === 'variables' ? variableData.length : data.length} rows selected`
                  ) : (
                    `${activeTab === 'lists' ? listData.length : activeTab === 'variables' ? variableData.length : data.length} total rows`
                  )}
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Custom Sort Button - only show for Objects tab */}
                {activeTab === 'objects' && (
                  <button
                    onClick={() => setIsCustomSortOpen(true)}
                    className={`inline-flex items-center gap-2 px-3 py-2 border rounded text-sm font-medium transition-colors ${
                      isCustomSortActive 
                        ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10 text-ag-dark-accent' 
                        : 'border-ag-dark-border bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface'
                    }`}
                    title="Sort the grid by multiple columns"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                    Custom Sort
                    {isCustomSortActive && (
                      <span className="ml-1 text-xs bg-ag-dark-accent text-white px-1.5 py-0.5 rounded">
                        Grid Sort Active
                      </span>
                    )}
                    {isColumnSortActive && !isCustomSortActive && (
                      <span className="ml-1 text-xs bg-ag-dark-text-secondary text-white px-1.5 py-0.5 rounded">
                        Column Sort Active
                      </span>
                    )}
                  </button>
                )}
                
                <button
                  onClick={() => {
                    if (activeTab === 'lists') {
                      setIsBulkListUploadOpen(true);
                    } else if (activeTab === 'variables') {
                      setIsBulkVariableUploadOpen(true);
                    } else {
                      setIsBulkObjectUploadOpen(true);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-ag-dark-border rounded bg-ag-dark-bg text-sm font-medium text-ag-dark-text hover:bg-ag-dark-surface transition-colors"
                >
                  <Upload className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => activeTab === 'lists' ? setIsAddListOpen(true) : activeTab === 'variables' ? setIsAddVariableOpen(true) : setIsAddObjectOpen(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-ag-dark-accent text-white rounded text-sm font-medium hover:bg-ag-dark-accent-hover transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add {activeTab === 'lists' ? 'List' : activeTab === 'variables' ? 'Variable' : 'Object'}
                </button>
                
                {selectedRows.length > 1 && (
                  <>
                    <button
                      onClick={() => setIsBulkDeleteOpen(true)}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-ag-dark-error text-white rounded text-sm font-medium hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Selected ({selectedRows.length})
                    </button>
                    
                    <button
                     onClick={() => {
                       if (activeTab === 'variables') {
                         setIsBulkEditVariablesOpen(true);
                       } else {
                         setIsBulkEditOpen(true);
                       }
                     }}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-ag-dark-warning text-white rounded text-sm font-medium hover:bg-orange-600 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit Selected ({selectedRows.length})
                    </button>
                  </>
                )}
                
              </div>
            </div>
            
            {/* Filter Panel */}
            <FilterPanel
              columns={activeTab === 'lists' ? listColumns : activeTab === 'variables' ? variableColumns : objectColumns}
              data={activeTab === 'lists' ? listData : activeTab === 'variables' ? variableData : data}
              filters={filters}
              onFilterChange={handleFilterChange}
              isOpen={false}
              activeTab={activeTab}
            />
            
            {/* Data Grid */}
            <DataGrid
              columns={activeTab === 'lists' ? listColumns : activeTab === 'variables' ? variableColumns : objectColumns}
              data={activeTab === 'lists' ? listData : activeTab === 'variables' ? variableData : data}
              onRowSelect={handleRowSelect}
              onEdit={handleEdit}
              onDelete={handleDelete}
              selectedRows={selectedRows}
              onReorder={activeTab === 'lists' ? setListData : activeTab === 'variables' ? setVariableData : setData}
              affectedIds={activeTab === 'objects' ? affectedObjectIds : activeTab === 'variables' ? affectedVariableIds : new Set()}
              deletedDriverType={deletedDriverType}
              customSortRules={activeTab === 'objects' ? customSortRules : []}
              onClearCustomSort={activeTab === 'objects' ? handleClearAllSorts : undefined}
              onColumnSort={activeTab === 'objects' ? handleColumnSort : undefined}
              isCustomSortActive={activeTab === 'objects' ? isCustomSortActive : false}
              isColumnSortActive={activeTab === 'objects' ? isColumnSortActive : false}
            />
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
              <BulkEditPanel
                isOpen={isBulkEditOpen}
                onClose={() => setIsBulkEditOpen(false)}
                onSave={handleBulkEdit}
                selectedCount={selectedRows.length}
                allData={activeTab === 'variables' ? variableData : data}
                activeTab={activeTab}
              />
            </div>
          ) : (isBulkEditVariablesOpen && activeTab === 'variables') ? (
            <div className="lg:col-span-1">
              <BulkEditVariablesPanel
                isOpen={isBulkEditVariablesOpen}
                onClose={() => setIsBulkEditVariablesOpen(false)}
                onSave={handleBulkEdit}
                selectedCount={selectedRows.length}
                allData={variableData}
                objectsData={data}
              />
            </div>
          ) : (
            <div className="lg:col-span-1">
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
                />
              ) : (
                <MetadataPanel
                  title="Object Metadata"
                  fields={currentMetadataFields}
                  onSave={handleMetadataSave}
                  selectedObject={selectedRowForMetadata}
                  allData={data}
                  selectedCount={selectedRows.length}
                  affectedObjectIds={affectedObjectIds}
                  deletedDriverType={deletedDriverType}
                />
              )}
            </div>
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
        onClose={() => setIsBulkVariableUploadOpen(false)}
        onUpload={handleBulkVariableUpload}
      />

      {/* Bulk List Upload Modal */}
      <BulkListUploadModal
        isOpen={isBulkListUploadOpen}
        onClose={() => setIsBulkListUploadOpen(false)}
        onUpload={handleBulkListUpload}
      />

      {/* Driver Delete Confirmation Modal */}
      <DriverDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={handleDriverDeleteCancel}
        onConfirm={handleDriverDeleteConfirm}
        driverName={driverToDelete?.name || ''}
        driverType={driverToDelete ? columnLabels[driverToDelete.type] : ''}
      />

      {/* Custom Sort Modal */}
      <CustomSortModal
        isOpen={isCustomSortOpen}
        onClose={() => setIsCustomSortOpen(false)}
        onApplySort={handleCustomSortApply}
        columns={objectColumns}
        currentSortRules={customSortRules}
      />

    </div>
  );
}

export default App;