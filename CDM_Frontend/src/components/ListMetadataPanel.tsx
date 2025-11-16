import React, { useState, useRef, useEffect } from 'react';
import { Settings, Save, X, Trash2, Plus, Link, Upload, List, Database, Users, FileText, ChevronRight, ChevronDown, Network, Eye } from 'lucide-react';
import { listFieldOptions } from '../data/listsData';
import { ListCsvUploadModal } from './ListCsvUploadModal';
import { useDrivers } from '../hooks/useDrivers';
import { useVariables } from '../hooks/useVariables';
import { VariableListRelationshipModal } from './VariableListRelationshipModal';
import { ListsOntologyModal } from './ListsOntologyModal';
import { VariableListRelationshipsGraphModal } from './VariableListRelationshipsGraphModal';
import { apiService } from '../services/api';

interface ListMetadataField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number';
  options?: string[];
  value?: string | number;
  required?: boolean;
}

interface VariableAttached {
  id: string;
  part: string;
  section: string;
  group: string;
  variable: string;
}

interface ListValue {
  id: string;
  value: string;
}

interface ListMetadataPanelProps {
  title: string;
  fields: ListMetadataField[];
  onSave?: (data: Record<string, any>) => void;
  onClose?: () => void;
  selectedList?: any;
  allData?: any[];
  selectedCount?: number;
}

export const ListMetadataPanel: React.FC<ListMetadataPanelProps> = ({
  title,
  fields,
  onSave,
  onClose,
  selectedList,
  allData = [],
  selectedCount = 0
}) => {
  // Use API drivers data
  const { drivers: apiDrivers } = useDrivers();
  const { variables: variablesData } = useVariables();
  const driversData = apiDrivers || {
    sectors: [],
    domains: [],
    countries: [],
    objectClarifiers: [],
    variableClarifiers: []
  };

  // Driver selections state
  const [driverSelections, setDriverSelections] = useState({
    sector: [] as string[],
    domain: [] as string[],
    country: [] as string[]
  });

  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    // Initialize from selectedList if available, otherwise from fields
    if (selectedList) {
      // Populate all metadata fields from selectedList
      initial.format = selectedList.format || '';
      initial.source = selectedList.source || '';
      initial.upkeep = selectedList.upkeep || '';
      initial.graph = selectedList.graph || '';
      initial.origin = selectedList.origin || '';
      initial.set = selectedList.set || '';
      initial.grouping = selectedList.grouping || '';
      initial.list = selectedList.list || '';
      
      // Initialize driver selections from selectedList
      if (selectedList.sector) {
        const sectors = Array.isArray(selectedList.sector) ? selectedList.sector : [selectedList.sector];
        setDriverSelections(prev => ({ ...prev, sector: sectors }));
        initial.sector = sectors;
      }
      if (selectedList.domain) {
        const domains = Array.isArray(selectedList.domain) ? selectedList.domain : [selectedList.domain];
        setDriverSelections(prev => ({ ...prev, domain: domains }));
        initial.domain = domains;
      }
      if (selectedList.country) {
        const countries = Array.isArray(selectedList.country) ? selectedList.country : [selectedList.country];
        setDriverSelections(prev => ({ ...prev, country: countries }));
        initial.country = countries;
      }
    } else {
      // Fallback to fields if no selectedList
      fields.forEach(field => {
        initial[field.key] = field.value !== undefined ? field.value : '';
      });
    }
    return initial;
  });

  // Update form data when selectedList changes (when a new row is selected)
  React.useEffect(() => {
    if (!selectedList) {
      // Reset to empty if no selection
      const emptyData: Record<string, any> = {};
      fields.forEach(field => {
        emptyData[field.key] = '';
      });
      setFormData(emptyData);
      setDriverSelections({ sector: [], domain: [], country: [] });
      return;
    }

    const newFormData: Record<string, any> = {};
    
    // Populate all metadata fields from selectedList
    newFormData.format = selectedList.format || '';
    newFormData.source = selectedList.source || '';
    newFormData.upkeep = selectedList.upkeep || '';
    newFormData.graph = selectedList.graph || '';
    newFormData.origin = selectedList.origin || '';
    newFormData.set = selectedList.set || '';
    newFormData.grouping = selectedList.grouping || '';
    newFormData.list = selectedList.list || '';
    
    // Update driver selections from selectedList
    // Helper function to process driver values and detect if ALL is selected
    const processDriverValues = (value: string | string[] | undefined, allPossibleValues: string[]): string[] => {
      if (!value) return [];
      
      let valuesArray: string[];
      if (Array.isArray(value)) {
        // If it's an array, check if it contains a single comma-separated string
        if (value.length === 1 && typeof value[0] === 'string' && value[0].includes(',')) {
          // Single element that's a comma-separated string - split it
          if (value[0] === 'ALL') {
            valuesArray = ['ALL'];
          } else {
            valuesArray = value[0].split(',').map(v => v.trim()).filter(Boolean);
          }
        } else {
          // Use array as-is
          valuesArray = value;
        }
      } else if (typeof value === 'string') {
        // If it's a string, check if it's "ALL" or a comma-separated list
        if (value === 'ALL') {
          valuesArray = ['ALL'];
        } else {
          // Split by comma and trim each value
          valuesArray = value.split(',').map(v => v.trim()).filter(Boolean);
        }
      } else {
        return [];
      }
      
      // Check if "ALL" is already in the array
      if (valuesArray.includes('ALL')) {
        // Expand to include all individual values for proper multiselect display
        return ['ALL', ...allPossibleValues];
      }
      
      // Check if all possible values are selected
      if (allPossibleValues.length > 0) {
        const selectedSet = new Set(valuesArray);
        const allSet = new Set(allPossibleValues);
        const isAllSelected = selectedSet.size === allSet.size && 
                             [...selectedSet].every(val => allSet.has(val));
        
        if (isAllSelected) {
          // All values are selected, add "ALL" to the array
          return ['ALL', ...allPossibleValues];
        }
      }
      
      // Return the array as-is if not all values are selected
      return valuesArray;
    };
    
    const sectors = processDriverValues(selectedList.sector, driversData.sectors);
    const domains = processDriverValues(selectedList.domain, driversData.domains);
    const countries = processDriverValues(selectedList.country, driversData.countries);
    
    setDriverSelections({ sector: sectors, domain: domains, country: countries });
    newFormData.sector = sectors;
    newFormData.domain = domains;
    newFormData.country = countries;
    
    setFormData(newFormData);
  }, [selectedList, fields, driversData]);

  // Initialize variables attached state
  const [variablesAttached, setVariablesAttached] = useState<VariableAttached[]>(() => {
    return selectedList?.variablesAttachedList || [];
  });

  // Initialize list values state
  const [listValues, setListValues] = useState<ListValue[]>(() => {
    return selectedList?.listValuesList || [];
  });

  // CSV upload modal states
  const [isVariableAttachedUploadOpen, setIsVariableAttachedUploadOpen] = useState(false);
  const [isListValuesUploadOpen, setIsListValuesUploadOpen] = useState(false);
  
  // Relationship modal state
  const [isVariableRelationshipModalOpen, setIsVariableRelationshipModalOpen] = useState(false);
  const [selectedVariables, setSelectedVariables] = useState<any[]>([]);
  const [relationshipsGraphModalOpen, setRelationshipsGraphModalOpen] = useState(false);
  
  // Ontology modal state
  const [ontologyModalOpen, setOntologyModalOpen] = useState<{
    isOpen: boolean;
    viewType: 'drivers' | 'ontology' | 'metadata' | null;
  }>({ isOpen: false, viewType: null });

  const openOntologyModal = (viewType: 'drivers' | 'ontology' | 'metadata') => {
    setOntologyModalOpen({ isOpen: true, viewType });
  };

  const closeOntologyModal = () => {
    setOntologyModalOpen({ isOpen: false, viewType: null });
  };
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    drivers: false,
    ontology: false,
    metadata: false,
    relationships: false
  });

  // Update states when selectedList changes
  React.useEffect(() => {
    setVariablesAttached(selectedList?.variablesAttachedList || []);
    setListValues(selectedList?.listValuesList || []);
    // Load relationships from API
    if (selectedList?.id) {
      loadRelationships();
    } else {
      setSelectedVariables([]);
    }
  }, [selectedList]);

  // Load relationships from API
  const loadRelationships = async () => {
    if (!selectedList?.id) return;
    try {
      const relationships = await apiService.getListVariableRelationships(selectedList.id) as any;
      const variablesList = relationships.variables || [];
      setSelectedVariables(variablesList);
    } catch (error) {
      console.error('Failed to load relationships:', error);
      setSelectedVariables([]);
    }
  };

  // Get distinct values from variables data for cascading dropdowns
  const getDistinctParts = () => {
    const variablesData = (window as any).variablesData || [];
    return [...new Set(variablesData.map((item: any) => item.part))].filter(Boolean);
  };

  const getDistinctSectionsForPart = (part: string) => {
    const variablesData = (window as any).variablesData || [];
    return [...new Set(variablesData
      .filter((item: any) => item.part === part)
      .map((item: any) => item.section)
    )].filter(Boolean);
  };

  const getDistinctGroupsForPartAndSection = (part: string, section: string) => {
    const variablesData = (window as any).variablesData || [];
    return [...new Set(variablesData
      .filter((item: any) => item.part === part && item.section === section)
      .map((item: any) => item.group)
    )].filter(Boolean);
  };

  const getDistinctVariablesForPartSectionGroup = (part: string, section: string, group: string) => {
    const variablesData = (window as any).variablesData || [];
    return [...new Set(variablesData
      .filter((item: any) => item.part === part && item.section === section && item.group === group)
      .map((item: any) => item.variable)
    )].filter(Boolean);
  };
  // Check if panel should be enabled (exactly 1 list selected)
  const isPanelEnabled = selectedCount === 1;

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const handleChange = (key: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleDriverSelectionChange = (type: 'sector' | 'domain' | 'country', values: string[]) => {
    setDriverSelections(prev => ({
      ...prev,
      [type]: values
    }));
    setFormData(prev => ({
      ...prev,
      [type]: values
    }));
  };

  const handleVariableAttachedChange = (id: string, field: keyof VariableAttached, value: string) => {
    setVariablesAttached(prev => prev.map(variable => {
      if (variable.id === id) {
        const updated = { ...variable, [field]: value };
        
        // Handle cascading updates
        if (field === 'part') {
          updated.section = '';
          updated.group = '';
          updated.variable = '';
        } else if (field === 'section') {
          updated.group = '';
          updated.variable = '';
        } else if (field === 'group') {
          updated.variable = '';
        }
        
        return updated;
      }
      return variable;
    }));
  };

  const addVariableAttached = () => {
    const newVariable: VariableAttached = {
      id: Date.now().toString(),
      part: '',
      section: '',
      group: '',
      variable: ''
    };
    setVariablesAttached(prev => [...prev, newVariable]);
  };

  const deleteVariableAttached = (id: string) => {
    setVariablesAttached(prev => prev.filter(variable => variable.id !== id));
  };

  const handleListValueChange = (id: string, value: string) => {
    setListValues(prev => prev.map(listValue => 
      listValue.id === id ? { ...listValue, value } : listValue
    ));
  };

  const addListValue = () => {
    const newListValue: ListValue = {
      id: Date.now().toString(),
      value: ''
    };
    setListValues(prev => [...prev, newListValue]);
  };

  const deleteListValue = (id: string) => {
    setListValues(prev => prev.filter(listValue => listValue.id !== id));
  };

  const handleVariableAttachedCsvUpload = (uploadedVariables: VariableAttached[]) => {
    setVariablesAttached(prev => [...prev, ...uploadedVariables]);
  };

  const handleListValuesCsvUpload = (uploadedValues: ListValue[]) => {
    setListValues(prev => [...prev, ...uploadedValues]);
  };

  const handleSave = () => {
    const saveData = {
      ...formData,
      sector: driverSelections.sector,
      domain: driverSelections.domain,
      country: driverSelections.country,
      variablesAttachedList: selectedVariables.length > 0 ? selectedVariables : variablesAttached,
      listValuesList: listValues
    };
    onSave?.(saveData);
  };

  // Multi-select component
  const MultiSelect: React.FC<{
    label: string;
    options: string[];
    values: string[];
    onChange: (values: string[]) => void;
    disabled?: boolean;
  }> = ({ label, options, values, onChange, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
      if (!isOpen) return;

      // Use setTimeout to ensure the listener is attached after the state update
      // This prevents the dropdown from closing immediately when opened
      let handleClickOutside: ((event: MouseEvent) => void) | null = null;
      const timeoutId = setTimeout(() => {
        handleClickOutside = (event: MouseEvent) => {
          if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsOpen(false);
          }
        };

        document.addEventListener('click', handleClickOutside);
      }, 0);

      return () => {
        clearTimeout(timeoutId);
        if (handleClickOutside) {
          document.removeEventListener('click', handleClickOutside);
        }
      };
    }, [isOpen]);
    
    const handleToggle = (option: string) => {
      if (option === 'ALL') {
        if (values.includes('ALL')) {
          onChange([]);
        } else {
          const allIndividualValues = options.filter(opt => opt !== 'ALL');
          onChange(['ALL', ...allIndividualValues]);
        }
      } else {
        const newValues = values.includes(option)
          ? values.filter(v => v !== option && v !== 'ALL')
          : [...values.filter(v => v !== 'ALL'), option];
        
        const allIndividualValues = options.filter(opt => opt !== 'ALL');
        const allSelected = allIndividualValues.every(opt => newValues.includes(opt));
        if (allSelected && allIndividualValues.length > 0) {
          onChange(['ALL', ...newValues]);
        } else {
          onChange(newValues);
        }
      }
    };

    const displayText = values.length === 0 
      ? `Select ${label}` 
      : values.includes('ALL') 
        ? 'ALL' 
        : values.length === 1 
          ? values[0] 
          : `${values.length} selected`;

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent text-left ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: 'right 12px center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '16px'
          }}
        >
          {displayText}
        </button>
        
        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-ag-dark-surface border border-ag-dark-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {options.map((option) => (
              <label
                key={option}
                className="flex items-center gap-2 px-3 py-2 hover:bg-ag-dark-bg cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={values.includes(option)}
                  onChange={() => handleToggle(option)}
                  className="rounded border-ag-dark-border bg-ag-dark-bg text-ag-dark-accent focus:ring-ag-dark-accent focus:ring-2 focus:ring-offset-0"
                />
                <span className="text-sm text-ag-dark-text">{option}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  const CollapsibleSection: React.FC<{
    title: string;
    sectionKey: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    children: React.ReactNode;
    ontologyViewType?: 'drivers' | 'ontology' | 'metadata';
    showRelationshipsGraph?: boolean;
  }> = ({ title, sectionKey, icon, actions, children, ontologyViewType, showRelationshipsGraph }) => {
    const isExpanded = expandedSections[sectionKey];
    const isListSelected = !!selectedList;
    
    return (
      <div className="border-t border-ag-dark-border pt-8">
        <div 
          className="flex items-center justify-between cursor-pointer hover:bg-ag-dark-bg rounded p-3 -m-3 transition-colors mb-4"
          onClick={() => toggleSection(sectionKey)}
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-ag-dark-text-secondary" />
            ) : (
              <ChevronRight className="w-4 h-4 text-ag-dark-text-secondary" />
            )}
            {icon}
            <h4 className="text-md font-semibold text-ag-dark-text">{title}</h4>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {isExpanded && actions && <>{actions}</>}
            {showRelationshipsGraph && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isListSelected) {
                    setRelationshipsGraphModalOpen(true);
                  }
                }}
                disabled={!isListSelected}
                className={`p-1 transition-colors ${
                  isListSelected 
                    ? 'text-ag-dark-text-secondary hover:text-ag-dark-accent' 
                    : 'text-ag-dark-text-secondary/30 cursor-not-allowed opacity-50'
                }`}
                title={isListSelected ? "View Variable-List Applicability Graph" : "Select a list to view applicability graph"}
              >
                <Network className="w-4 h-4" />
              </button>
            )}
            {ontologyViewType && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isListSelected) {
                    openOntologyModal(ontologyViewType);
                  }
                }}
                disabled={!isListSelected}
                className={`p-1 transition-colors ${
                  isListSelected 
                    ? 'text-ag-dark-text-secondary hover:text-ag-dark-accent' 
                    : 'text-ag-dark-text-secondary/30 cursor-not-allowed opacity-50'
                }`}
                title={isListSelected ? "View Neo4j Ontology" : "Select a list to view ontology"}
              >
                {ontologyViewType === 'metadata' ? <Eye className="w-4 h-4" /> : <Network className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
        
        {isExpanded && (
          <div className="mt-6 ml-6 pb-6">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-ag-dark-text-secondary" />
          <h3 className="text-lg font-semibold text-ag-dark-text">{title}</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* List Name Field - Moved to header section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-ag-dark-text mb-2">
          List Name
        </label>
        <input
          type="text"
          value={formData.list || ''}
          onChange={(e) => handleChange('list', e.target.value)}
          disabled={!isPanelEnabled}
          placeholder="Enter list name..."
          className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
            !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
      </div>

      {/* Drivers Section */}
      <CollapsibleSection 
        title="Drivers" 
        sectionKey="drivers" 
        icon={<Database className="w-4 h-4 text-ag-dark-text-secondary" />}
        ontologyViewType="drivers"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Sector
            </label>
            <MultiSelect
              label="Sector"
              options={['ALL', ...driversData.sectors]}
              values={driverSelections.sector}
              onChange={(values) => handleDriverSelectionChange('sector', values)}
              disabled={!isPanelEnabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Domain
            </label>
            <MultiSelect
              label="Domain"
              options={['ALL', ...driversData.domains]}
              values={driverSelections.domain}
              onChange={(values) => handleDriverSelectionChange('domain', values)}
              disabled={!isPanelEnabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Country
            </label>
            <MultiSelect
              label="Country"
              options={['ALL', ...driversData.countries]}
              values={driverSelections.country}
              onChange={(values) => handleDriverSelectionChange('country', values)}
              disabled={!isPanelEnabled}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Ontology Section */}
      <CollapsibleSection 
        title="Ontology" 
        sectionKey="ontology" 
        icon={<Users className="w-4 h-4 text-ag-dark-text-secondary" />}
        ontologyViewType="ontology"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Set
            </label>
            <select
              value={formData.set}
              onChange={(e) => handleChange('set', e.target.value)}
              disabled={!isPanelEnabled}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Set</option>
              {listFieldOptions.set.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Grouping
            </label>
            <select
              value={formData.grouping}
              onChange={(e) => handleChange('grouping', e.target.value)}
              disabled={!isPanelEnabled}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Grouping</option>
              {listFieldOptions.grouping.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

        </div>
      </CollapsibleSection>

      {/* Metadata Section */}
      <CollapsibleSection 
        title="Metadata" 
        sectionKey="metadata" 
        icon={<FileText className="w-4 h-4 text-ag-dark-text-secondary" />}
        ontologyViewType="metadata"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Format
            </label>
            <input
              type="text"
              value={formData.format || ''}
              onChange={(e) => handleChange('format', e.target.value)}
              disabled={!isPanelEnabled}
              placeholder="Enter format..."
              className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Source
            </label>
            <input
              type="text"
              value={formData.source || ''}
              onChange={(e) => handleChange('source', e.target.value)}
              disabled={!isPanelEnabled}
              placeholder="Enter source..."
              className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Upkeep
            </label>
            <input
              type="text"
              value={formData.upkeep || ''}
              onChange={(e) => handleChange('upkeep', e.target.value)}
              disabled={!isPanelEnabled}
              placeholder="Enter upkeep..."
              className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Graph
            </label>
            <input
              type="text"
              value={formData.graph || ''}
              onChange={(e) => handleChange('graph', e.target.value)}
              disabled={!isPanelEnabled}
              placeholder="Enter graph..."
              className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Origin
            </label>
            <input
              type="text"
              value={formData.origin || ''}
              onChange={(e) => handleChange('origin', e.target.value)}
              disabled={!isPanelEnabled}
              placeholder="Enter origin..."
              className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Applicability Section */}
      <CollapsibleSection 
        title="Applicability" 
        sectionKey="relationships"
        icon={<Link className="w-4 h-4 text-ag-dark-text-secondary" />}
        showRelationshipsGraph={true}
        actions={
          <button
            onClick={() => setIsVariableRelationshipModalOpen(true)}
            disabled={!isPanelEnabled}
            className={`px-3 py-1.5 text-sm font-medium border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors ${
              !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title={!isPanelEnabled ? "Select a list to view applicability" : "View and manage applicability"}
          >
            View Applicability
          </button>
        }
      >
        <div className="mb-6">
          {selectedVariables.length === 0 ? (
            <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
              <div className="text-sm text-ag-dark-text-secondary">
                <span className="font-medium">No variables selected:</span> Click "View Applicability" to select variables from the variables grid.
              </div>
            </div>
          ) : (
            <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
              <div className="text-sm text-ag-dark-text">
                <span className="font-medium">{selectedVariables.length} variable{selectedVariables.length !== 1 ? 's' : ''} selected:</span>
                <div className="mt-2 space-y-1">
                  {selectedVariables.slice(0, 5).map((variable: any) => {
                    const part = variable.part || '';
                    const section = variable.section || '';
                    const group = variable.group || '';
                    const varName = variable.variable || variable.name || '';
                    const displayParts = [part, section, group, varName].filter(p => p);
                    return (
                      <div key={variable.id || variable.variableId} className="text-ag-dark-text-secondary">
                        {displayParts.length > 0 ? displayParts.join(' / ') : 'Unknown variable'}
                      </div>
                    );
                  })}
                  {selectedVariables.length > 5 && (
                    <div className="text-ag-dark-text-secondary">
                      ... and {selectedVariables.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* List Values Section */}
      <div className="border-t border-ag-dark-border pt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <List className="w-4 h-4 text-ag-dark-text-secondary" />
            <h4 className="text-md font-semibold text-ag-dark-text">List Values</h4>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsListValuesUploadOpen(true)}
              disabled={!isPanelEnabled}
              className={`text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Upload List Values CSV"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={addListValue}
              disabled={!isPanelEnabled}
              className={`text-ag-dark-accent hover:text-ag-dark-accent-hover transition-colors ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Add List Value"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {listValues.length === 0 ? (
          <div className="text-center py-6 text-ag-dark-text-secondary">
            <div className="text-sm">No list values defined</div>
            <button
              onClick={addListValue}
              disabled={!isPanelEnabled}
              className={`mt-2 text-ag-dark-accent hover:text-ag-dark-accent-hover text-sm ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              Add your first list value
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {listValues.map((listValue, index) => (
              <div key={listValue.id} className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-ag-dark-text">
                    List Value #{index + 1}
                  </span>
                  <button
                    onClick={() => deleteListValue(listValue.id)}
                    disabled={!isPanelEnabled}
                    className={`text-ag-dark-error hover:text-red-400 transition-colors ${
                      !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title="Delete List Value"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-ag-dark-text-secondary mb-1">
                    Value
                  </label>
                  <input
                    type="text"
                    placeholder="Enter value..."
                    value={listValue.value}
                    onChange={(e) => handleListValueChange(listValue.id, e.target.value)}
                    disabled={!isPanelEnabled}
                    className={`w-full px-2 py-1.5 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                      !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {onSave && (
        <div className="mt-8 pt-6 border-t border-ag-dark-border">
          <button
            onClick={handleSave}
            disabled={!isPanelEnabled}
            className={`w-full bg-ag-dark-accent text-white py-2 px-4 rounded hover:bg-ag-dark-accent-hover transition-colors flex items-center justify-center gap-2 ${
              !isPanelEnabled ? 'opacity-50 cursor-not-allowed bg-ag-dark-text-secondary hover:bg-ag-dark-text-secondary' : ''
            }`}
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      )}

      {/* CSV Upload Modals */}
      <ListCsvUploadModal
        isOpen={isVariableAttachedUploadOpen}
        onClose={() => setIsVariableAttachedUploadOpen(false)}
        type="variables-attached"
        onUpload={handleVariableAttachedCsvUpload}
      />
      
      <ListCsvUploadModal
        isOpen={isListValuesUploadOpen}
        onClose={() => setIsListValuesUploadOpen(false)}
        type="list-values"
        onUpload={handleListValuesCsvUpload}
      />

      {/* Variable List Applicability Modal */}
      <VariableListRelationshipModal
        isOpen={isVariableRelationshipModalOpen}
        onClose={() => setIsVariableRelationshipModalOpen(false)}
        selectedList={selectedList}
        allVariables={variablesData}
        onSave={async () => {
          // Reload relationships after saving
          await loadRelationships();
          // Refresh data after saving relationships
          if (onSave) {
            onSave({});
          }
        }}
        isBulkMode={false}
      />

      {/* Lists Ontology Modal */}
      {ontologyModalOpen.isOpen && ontologyModalOpen.viewType && selectedList && (
        <ListsOntologyModal
          isOpen={ontologyModalOpen.isOpen}
          onClose={closeOntologyModal}
          listId={selectedList.id}
          listName={selectedList.list}
          sectionName={ontologyModalOpen.viewType === 'drivers' ? 'Drivers' : ontologyModalOpen.viewType === 'ontology' ? 'Ontology' : 'Metadata'}
          viewType={ontologyModalOpen.viewType}
          isBulkMode={false}
        />
      )}

      {/* Variable-List Applicability Graph Modal */}
      {relationshipsGraphModalOpen && selectedList && (
        <VariableListRelationshipsGraphModal
          isOpen={relationshipsGraphModalOpen}
          onClose={() => setRelationshipsGraphModalOpen(false)}
          listId={selectedList.id}
          listName={selectedList.list}
          isBulkMode={false}
        />
      )}
    </div>
  );
};