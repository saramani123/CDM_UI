import React, { useState, useMemo } from 'react';
import { Plus, Upload, Download, Edit2, Filter, ArrowUpDown } from 'lucide-react';
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
import { BulkListUploadModal } from './components/BulkListUploadModal';
import { AddListPanel } from './components/AddListPanel';
import { mockObjectData, tabs, objectColumns, metadataFields, getAvatarOptions, type ObjectData } from './data/mockData';
import { mockVariableData, variableColumns, variableMetadataFields, type VariableData } from './data/variablesData';
import { mockListData, listColumns, listMetadataFields, type ListData } from './data/listsData';
import { driversData, type ColumnType, columnLabels } from './data/driversData';
import { useObjects } from './hooks/useObjects';
import { useDrivers } from './hooks/useDrivers';
import { useVariables } from './hooks/useVariables';
import { DriversColumn } from './components/DriversColumn';
import { DriversMetadataPanel } from './components/DriversMetadataPanel';
import { ListMetadataPanel } from './components/ListMetadataPanel';

function App() {
  const [activeTab, setActiveTab] = useState('objects');
  const [selectedRows, setSelectedRows] = useState<ObjectData[]>([]);
  const [selectedRowForMetadata, setSelectedRowForMetadata] = useState<ObjectData | null>(null);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  
  // Use API hook for objects data
  const { objects: apiObjects, loading: objectsLoading, error: objectsError, createObject, updateObject, deleteObject, updateObjectWithRelationshipsAndVariants, createRelationship, createVariant } = useObjects();
  
  // Use API hook for drivers data
  const { drivers: apiDrivers, loading: driversLoading, error: driversError, createDriver, updateDriver, deleteDriver } = useDrivers();
  
  // Use API hook for variables data
  const { variables: apiVariables, loading: variablesLoading, error: variablesError, createVariable, updateVariable, deleteVariable, createObjectRelationship, deleteObjectRelationship, bulkUploadVariables } = useVariables();
  
  // Fallback to mock data if API fails
  const [data, setData] = useState<ObjectData[]>([]);
  const [isAddObjectOpen, setIsAddObjectOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkObjectUploadOpen, setIsBulkObjectUploadOpen] = useState(false);
  const [variableData, setVariableData] = useState<VariableData[]>([]);
  const [isAddVariableOpen, setIsAddVariableOpen] = useState(false);
  const [isBulkVariableUploadOpen, setIsBulkVariableUploadOpen] = useState(false);
  const [listData, setListData] = useState(mockListData);
  const [isBulkListUploadOpen, setIsBulkListUploadOpen] = useState(false);
  const [isAddListOpen, setIsAddListOpen] = useState(false);

  // Drivers tab state - use API data with fallback to mock data
  const [driversState, setDriversState] = useState(driversData);
  const [selectedColumn, setSelectedColumn] = useState<ColumnType | undefined>();
  const [selectedItem, setSelectedItem] = useState<string | undefined>();

  // Sync API objects data with local state
  React.useEffect(() => {
    if (!objectsLoading) {
      if (objectsError) {
        // Fallback to mock data if API fails
        console.log('Objects API failed, using mock data:', objectsError);
        setData(mockObjectData);
      } else {
        // Always use API data, even if empty
        setData(apiObjects);
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
        setDriversState(apiDrivers);
      }
    }
  }, [apiDrivers, driversError, driversLoading]);

  // Sync API variables data with local state
  React.useEffect(() => {
    if (!variablesLoading) {
      if (variablesError) {
        // Fallback to mock data if API fails
        console.log('Variables API failed, using mock data:', variablesError);
        setVariableData(mockVariableData);
      } else {
        // Always use API data, even if empty
        console.log('Using API variables data:', apiVariables);
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
          case 'objectName':
            return selectedRowForMetadata.object;
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
    
    // If this is for objects and we have relationships or variants, call the backend API
    if (activeTab === 'objects' && (updatedData.relationshipsList || updatedData.variantsList)) {
      try {
        for (const objectId of selectedIds) {
          await updateObjectWithRelationshipsAndVariants(
            objectId, 
            updatedData.relationshipsList || [], 
            updatedData.variantsList || []
          );
        }
      } catch (error) {
        console.error('Failed to update objects with relationships and variants:', error);
        // Fall back to local state update
      }
    }
    
    const updateFunction = (prev: any[]) => prev.map((item: any) => {
      if (selectedIds.includes(item.id)) {
        const updated = { ...item };
        
        if (activeTab === 'variables') {
          // Update variable fields if they were changed
          Object.keys(updatedData).forEach(key => {
            if (updatedData[key] && key !== 'objectRelationshipsList') {
              updated[key] = updatedData[key];
            }
          });
          
          // Append new object relationships if any were added
          if (updatedData.objectRelationshipsList && updatedData.objectRelationshipsList.length > 0) {
            const existingRelationships = updated.objectRelationshipsList || [];
            updated.objectRelationshipsList = [...existingRelationships, ...updatedData.objectRelationshipsList];
            updated.objectRelationships = updated.objectRelationshipsList.length;
          }
        } else if (activeTab === 'lists') {
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
    } else if (activeTab === 'variables') {
      setVariableData(updateFunction);
    } else {
      setData(updateFunction);
    }
    
    setIsBulkEditOpen(false);
    setSelectedRows([]);
    setSelectedRowForMetadata(null);
  };
  const handleMetadataSave = async (updatedData: Record<string, any>) => {
    if (selectedRowForMetadata) {
      let gridData = { ...updatedData };
      
      if (activeTab === 'variables') {
        // Handle variables update via API
        try {
          await updateVariable(selectedRowForMetadata.id, updatedData);
          
          // Update local state
          setVariableData(prev => prev.map(item => 
            item.id === selectedRowForMetadata.id 
              ? { ...item, ...updatedData }
              : item
          ));
          
          setSelectedRowForMetadata({ ...selectedRowForMetadata, ...gridData });
        } catch (error) {
          console.error('Error updating variable:', error);
          alert('Failed to update variable. Please try again.');
        }
      } else if (activeTab === 'objects') {
        // Map objectName back to object field for the grid
        gridData.object = updatedData.objectName || updatedData.object;
        delete gridData.objectName;
        
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
        
        // Update local state with the new data
        setData(prev => prev.map(item => 
          item.id === selectedRowForMetadata.id 
            ? { ...item, ...gridData }
            : item
        ));
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
    <div className="min-h-screen bg-ag-dark-bg">
      {/* Header */}
      <div className="bg-ag-dark-surface border-b border-ag-dark-border px-6 py-6">
        <div>
          <h1 className="text-2xl font-bold text-ag-dark-text">Canonical Data Model</h1>
          <p className="text-sm text-ag-dark-text-secondary mt-1">
            CDM Management Interface
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-6">
        <TabNavigation 
          tabs={tabs} 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
        />
      </div>

      {/* Main Content */}
      <div className="px-6 py-6">
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
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Drivers Columns */}
            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-4">
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <DriversColumn
                  title="Sector"
                  items={driversState.sectors}
                  onHeaderClick={() => handleColumnHeaderClick('sectors')}
                  onItemClick={(item) => handleItemClick('sectors', item)}
                  selectedItem={selectedColumn === 'sectors' ? selectedItem : undefined}
                  canAddNew={true}
                />
                <DriversColumn
                  title="Domain"
                  items={driversState.domains}
                  onHeaderClick={() => handleColumnHeaderClick('domains')}
                  onItemClick={(item) => handleItemClick('domains', item)}
                  selectedItem={selectedColumn === 'domains' ? selectedItem : undefined}
                  canAddNew={true}
                />
                <DriversColumn
                  title="Country"
                  items={driversState.countries}
                  onHeaderClick={() => handleColumnHeaderClick('countries')}
                  onItemClick={(item) => handleItemClick('countries', item)}
                  selectedItem={selectedColumn === 'countries' ? selectedItem : undefined}
                  canAddNew={false}
                />
                <DriversColumn
                  title="Object Clarifier"
                  items={driversState.objectClarifiers}
                  onHeaderClick={() => handleColumnHeaderClick('objectClarifiers')}
                  onItemClick={(item) => handleItemClick('objectClarifiers', item)}
                  selectedItem={selectedColumn === 'objectClarifiers' ? selectedItem : undefined}
                  canAddNew={true}
                />
                <DriversColumn
                  title="Variable Clarifier"
                  items={driversState.variableClarifiers}
                  onHeaderClick={() => handleColumnHeaderClick('variableClarifiers')}
                  onItemClick={(item) => handleItemClick('variableClarifiers', item)}
                  selectedItem={selectedColumn === 'variableClarifiers' ? selectedItem : undefined}
                  canAddNew={true}
                />
              </div>
            </div>

            {/* Drivers Metadata Panel */}
            <div className="lg:col-span-1">
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
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`inline-flex items-center gap-2 px-3 py-2 border border-ag-dark-border rounded text-sm font-medium transition-colors ${
                    isFilterOpen ? 'bg-ag-dark-accent text-white' : 'bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                </button>
                
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
                     onClick={() => setIsBulkEditOpen(true)}
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
              isOpen={isFilterOpen}
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
    </div>
  );
}

export default App;