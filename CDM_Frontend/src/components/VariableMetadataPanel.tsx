import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Settings, Save, X, Link, ChevronRight, ChevronDown, Database, Users, FileText, Plus, Network, Info } from 'lucide-react';
import { getVariableFieldOptions, concatenateVariableDrivers, parseVariableDriverString } from '../data/variablesData';
import { useDrivers } from '../hooks/useDrivers';
import { apiService } from '../services/api';
import { VariableObjectRelationshipModal } from './VariableObjectRelationshipModal';
import { CsvUploadModal } from './CsvUploadModal';
import { AddFieldValueModal } from './AddFieldValueModal';
import { AddGroupValueModal } from './AddGroupValueModal';
import { OntologyModal } from './OntologyModal';

interface VariableMetadataField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number';
  options?: string[];
  value?: string | number;
  required?: boolean;
}


interface VariableMetadataPanelProps {
  title: string;
  fields: VariableMetadataField[];
  onSave?: (data: Record<string, any>) => void | Promise<any>;
  onClose?: () => void;
  selectedVariable?: any;
  allData?: any[];
  objectsData?: any[];
  selectedCount?: number;
  onObjectsRefresh?: () => void | Promise<void>; // Callback to refresh objects data
}

export const VariableMetadataPanel: React.FC<VariableMetadataPanelProps> = ({
  title,
  fields,
  onSave,
  onClose,
  selectedVariable,
  allData = [],
  objectsData = [],
  selectedCount = 0,
  onObjectsRefresh
}) => {
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    fields.forEach(field => {
      initial[field.key] = field.value !== undefined ? field.value : '';
    });
    return initial;
  });

  // Driver selections state - will be expanded when driversData loads
  const [driverSelections, setDriverSelections] = useState(() => {
    if (selectedVariable?.driver) {
      const parsed = parseVariableDriverString(selectedVariable.driver);
      // Note: We can't expand ALL here because driversData might not be loaded yet
      // This will be handled in the useEffect below
      return parsed;
    }
    return {
      sector: [],
      domain: [],
      country: [],
      variableClarifier: ''
    };
  });

  const { drivers: driversData } = useDrivers();
  
  // Debug: Log objects data
  console.log('VariableMetadataPanel - objectsData:', objectsData);
  console.log('VariableMetadataPanel - objectsData length:', objectsData?.length);
  console.log('VariableMetadataPanel - first object:', objectsData?.[0]);

  
  // Get dynamic field options from existing variables data
  const [dynamicFieldOptions, setDynamicFieldOptions] = useState(getVariableFieldOptions(allData));
  
  // State for add field value modal
  const [isAddFieldValueModalOpen, setIsAddFieldValueModalOpen] = useState(false);
  const [selectedFieldForAdd, setSelectedFieldForAdd] = useState<{ name: string; label: string } | null>(null);
  
  // State for add group value modal
  const [isAddGroupValueModalOpen, setIsAddGroupValueModalOpen] = useState(false);
  
  // Storage key for part-group associations
  const PART_GROUP_STORAGE_KEY = 'cdm_variable_part_group_associations';

  // Fetch field options from API on mount and when allData changes
  useEffect(() => {
    const fetchFieldOptions = async () => {
      try {
        const apiOptions = await apiService.getVariableFieldOptions() as {
          formatI: string[];
          formatII: string[];
          gType: string[];
          validation: string[];
          default: string[];
        };
        
        // Merge API options with existing variable options
        const existingOptions = getVariableFieldOptions(allData);
        setDynamicFieldOptions({
          ...existingOptions,
          formatI: [...new Set([...existingOptions.formatI, ...(apiOptions.formatI || [])])].sort(),
          formatII: [...new Set([...existingOptions.formatII, ...(apiOptions.formatII || [])])].sort(),
          gType: [...new Set([...existingOptions.gType, ...(apiOptions.gType || [])])].sort(),
          validation: [...new Set([...existingOptions.validation, ...(apiOptions.validation || [])])].sort(),
          default: [...new Set([...existingOptions.default, ...(apiOptions.default || [])])].sort(),
        });
      } catch (error) {
        console.error('Error fetching field options:', error);
        // Fall back to existing options if API fails
        setDynamicFieldOptions(getVariableFieldOptions(allData));
      }
    };

    fetchFieldOptions();
  }, [allData]);

  // Helper functions for part-group associations
  const getPartGroupAssociations = (): Record<string, string[]> => {
    try {
      const stored = localStorage.getItem(PART_GROUP_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading part-group associations:', error);
    }
    return {};
  };

  const savePartGroupAssociation = (part: string, group: string) => {
    try {
      const associations = getPartGroupAssociations();
      if (!associations[part]) {
        associations[part] = [];
      }
      if (!associations[part].includes(group)) {
        associations[part].push(group);
        associations[part].sort();
        localStorage.setItem(PART_GROUP_STORAGE_KEY, JSON.stringify(associations));
      }
    } catch (error) {
      console.error('Error saving part-group association:', error);
    }
  };

  // Get groups filtered by part
  const getGroupsForPart = (part: string): string[] => {
    if (!part) return [];
    
    // Get groups from existing variables data for this part
    const variablesData = allData.length > 0 ? allData : (window as any).variablesData || [];
    const groupsFromData = [...new Set(
      variablesData
        .filter((item: any) => item.part === part && item.group)
        .map((item: any) => item.group)
    )].filter(Boolean) as string[];
    
    // Get groups from localStorage associations
    const associations = getPartGroupAssociations();
    const groupsFromStorage = associations[part] || [];
    
    // Combine and deduplicate
    const allGroups = [...new Set([...groupsFromData, ...groupsFromStorage])].sort();
    return allGroups;
  };

  const handleAddFieldValue = async (value: string) => {
    if (!selectedFieldForAdd) return;
    
    try {
      await apiService.addVariableFieldOption(selectedFieldForAdd.name, value);
      
      // Refresh field options
      const apiOptions = await apiService.getVariableFieldOptions() as {
        formatI: string[];
        formatII: string[];
        gType: string[];
        validation: string[];
        default: string[];
      };
      
      const existingOptions = getVariableFieldOptions(allData);
      setDynamicFieldOptions({
        ...existingOptions,
        formatI: [...new Set([...existingOptions.formatI, ...(apiOptions.formatI || [])])].sort(),
        formatII: [...new Set([...existingOptions.formatII, ...(apiOptions.formatII || [])])].sort(),
        gType: [...new Set([...existingOptions.gType, ...(apiOptions.gType || [])])].sort(),
        validation: [...new Set([...existingOptions.validation, ...(apiOptions.validation || [])])].sort(),
        default: [...new Set([...existingOptions.default, ...(apiOptions.default || [])])].sort(),
      });
    } catch (error) {
      throw error;
    }
  };

  const handleAddGroupValue = async (part: string, groupValue: string) => {
    // Save to localStorage
    savePartGroupAssociation(part, groupValue);
    
    // Update dynamic field options if the current part is selected
    // This will trigger a re-render and the Group dropdown will update via getGroupsForPart
    if (formData.part === part) {
      setDynamicFieldOptions(prev => ({
        ...prev,
        group: [...new Set([...prev.group, groupValue])].sort()
      }));
    }
  };

  // Get distinct parts from variables data
  const getDistinctParts = (): string[] => {
    const variablesData = allData.length > 0 ? allData : (window as any).variablesData || [];
    const parts = [...new Set(variablesData.map((item: any) => item.part))].filter(Boolean).sort() as string[];
    return parts.length > 0 ? parts : dynamicFieldOptions.part;
  };

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    drivers: false,
    ontology: false,
    metadata: false,
    objectRelationships: false
  });

  // Track previous selected variable ID to detect actual variable changes
  const prevSelectedVariableId = useRef<string | null>(null);

  // Update form data when a new variable is selected (not on every field change)
  React.useEffect(() => {
    const currentVariableId = selectedVariable?.id;
    
    // Only reset form data when the selected variable actually changes
    if (currentVariableId && currentVariableId !== prevSelectedVariableId.current) {
      console.log('VariableMetadataPanel: selected variable changed from', prevSelectedVariableId.current, 'to', currentVariableId);
      prevSelectedVariableId.current = currentVariableId;
      
      // Initialize form data from the selected variable, not from fields
      const newFormData: Record<string, any> = {
        part: selectedVariable?.part || '',
        section: selectedVariable?.section || '',
        group: selectedVariable?.group || '',
        variable: selectedVariable?.variable || '',
        formatI: selectedVariable?.formatI || '',
        formatII: selectedVariable?.formatII || '',
        gType: selectedVariable?.gType || '',
        validation: selectedVariable?.validation || '',
        default: selectedVariable?.default || '',
        graph: selectedVariable?.graph || 'Yes',
        status: selectedVariable?.status || 'Active'
      };
      console.log('VariableMetadataPanel: newFormData for new variable', newFormData);
      setFormData(newFormData);
    }
    
    // Update driver selections when selected variable changes
    if (selectedVariable?.driver) {
      const parsed = parseVariableDriverString(selectedVariable.driver);
      // Expand "ALL" to include all individual values for proper multiselect display
      const expanded: typeof parsed = {
        sector: parsed.sector.includes('ALL') && driversData.sectors.length > 0 
          ? ['ALL', ...driversData.sectors] 
          : parsed.sector,
        domain: parsed.domain.includes('ALL') && driversData.domains.length > 0 
          ? ['ALL', ...driversData.domains] 
          : parsed.domain,
        country: parsed.country.includes('ALL') && driversData.countries.length > 0 
          ? ['ALL', ...driversData.countries] 
          : parsed.country,
        variableClarifier: parsed.variableClarifier
      };
      setDriverSelections(expanded);
    } else {
      setDriverSelections({
        sector: [],
        domain: [],
        country: [],
        variableClarifier: ''
      });
    }
  }, [selectedVariable?.id]); // Reset when variable changes only - don't reset when drivers data loads

  // Update driver selections separately when drivers data is available
  React.useEffect(() => {
    if (selectedVariable?.driver && driversData.sectors.length > 0) {
      const parsed = parseVariableDriverString(selectedVariable.driver);
      const expanded: typeof parsed = {
        sector: parsed.sector.includes('ALL') && driversData.sectors.length > 0 
          ? ['ALL', ...driversData.sectors] 
          : parsed.sector,
        domain: parsed.domain.includes('ALL') && driversData.domains.length > 0 
          ? ['ALL', ...driversData.domains] 
          : parsed.domain,
        country: parsed.country.includes('ALL') && driversData.countries.length > 0 
          ? ['ALL', ...driversData.countries] 
          : parsed.country,
        variableClarifier: parsed.variableClarifier
      };
      setDriverSelections(expanded);
    }
  }, [selectedVariable?.driver, driversData.sectors.length, driversData.domains.length, driversData.countries.length]);

  // Variable-object relationship modal state
  const [isVariableObjectRelationshipModalOpen, setIsVariableObjectRelationshipModalOpen] = useState(false);
  const [pendingCsvData, setPendingCsvData] = useState<any[] | null>(null);

  // Ontology modal state
  const [ontologyModalOpen, setOntologyModalOpen] = useState<{
    isOpen: boolean;
    viewType: 'drivers' | 'ontology' | 'metadata' | 'objectRelationships' | null;
  }>({ isOpen: false, viewType: null });

  const openOntologyModal = (viewType: 'drivers' | 'ontology' | 'metadata' | 'objectRelationships') => {
    setOntologyModalOpen({ isOpen: true, viewType });
  };

  const closeOntologyModal = () => {
    setOntologyModalOpen({ isOpen: false, viewType: null });
  };


  // Check if panel should be enabled (exactly 1 variable selected)
  const isPanelEnabled = selectedCount === 1;

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const handleChange = React.useCallback((key: string, value: string | number) => {
    setFormData(prev => {
      const newData = { ...prev, [key]: value };
      
      // When part changes, clear group (groups are part-specific)
      if (key === 'part' && value !== prev.part) {
        newData.group = '';
      }
      
      return newData;
    });
  }, []);

  const handleDriverSelectionChange = (field: 'sector' | 'domain' | 'country' | 'variableClarifier', value: string[] | string) => {
    if (field === 'variableClarifier') {
      setDriverSelections(prev => ({
        ...prev,
        variableClarifier: value as string
      }));
    } else {
      setDriverSelections(prev => ({
        ...prev,
        [field]: value as string[]
      }));
    }
  };


  const handleSave = async () => {
    try {
      // Generate driver string from selections
      const driverString = concatenateVariableDrivers(
        driverSelections.sector,
        driverSelections.domain,
        driverSelections.country,
        driverSelections.variableClarifier
      );

      const saveData = {
        ...formData,
        driver: driverString
      };

      // Call the main save operation (which will handle object relationships)
      await onSave?.(saveData);
    } catch (error) {
      console.error('Error saving variable:', error);
      alert('Failed to update variable. Please try again.');
    }
  };

  // Multi-select component
  const MultiSelect: React.FC<{
    label: string;
    options: string[];
    values: string[];
    onChange: (values: string[]) => void;
    disabled?: boolean;
  }> = ({ label, options, values, onChange, disabled }) => {
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
          // When ALL is selected, select ALL individual values too
          const allIndividualValues = options.filter(opt => opt !== 'ALL');
          onChange(['ALL', ...allIndividualValues]);
        }
      } else {
        const newValues = values.includes(option)
          ? values.filter(v => v !== option && v !== 'ALL')
          : [...values.filter(v => v !== 'ALL'), option];
        
        // If all individual values are selected, also select ALL
        const allIndividualValues = options.filter(opt => opt !== 'ALL');
        const allSelected = allIndividualValues.every(opt => newValues.includes(opt));
        if (allSelected && allIndividualValues.length > 0) {
          onChange(['ALL', ...newValues]);
        } else {
          onChange(newValues);
        }
      }
      // Keep dropdown open for multiple selections
    };

    const displayText = values.length === 0 
      ? (options.length === 0 ? `No values found — please add new items in Drivers tab` : `Select ${label}`)
      : values.includes('ALL') 
        ? 'ALL' 
        : values.length === 1 
          ? values[0] 
          : `${values.length} selected`;

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
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
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-ag-dark-text-secondary italic">
                No values found — please add new items in Drivers tab
              </div>
            ) : (
              options.map((option) => (
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
              ))
            )}
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
    ontologyViewType?: 'drivers' | 'ontology' | 'metadata' | 'objectRelationships';
  }> = ({ title, sectionKey, icon, actions, children, ontologyViewType }) => {
    const isExpanded = expandedSections[sectionKey];
    const isVariableSelected = !!selectedVariable?.variable || !!selectedVariable?.id;
    
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
            {ontologyViewType && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isVariableSelected) {
                    openOntologyModal(ontologyViewType);
                  }
                }}
                disabled={!isVariableSelected}
                className={`p-1 transition-colors ${
                  isVariableSelected 
                    ? 'text-ag-dark-text-secondary hover:text-ag-dark-accent' 
                    : 'text-ag-dark-text-secondary/30 cursor-not-allowed opacity-50'
                }`}
                title={isVariableSelected ? "View Neo4j Ontology" : "Select a variable to view ontology"}
              >
                <Network className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        
        {isExpanded && (
          <div 
            className="mt-6 ml-6 pb-6"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
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
          <h3 className="text-lg font-semibold text-ag-dark-text">Metadata</h3>
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

      {/* Variable Name Field - Moved out of collapsible section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-ag-dark-text mb-2">
          Variable Name
        </label>
        <input
          type="text"
          value={formData.variable}
          onChange={(e) => {
            e.stopPropagation();
            handleChange('variable', e.target.value);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={!isPanelEnabled}
          className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
            !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
        {/* Alert for cloned rows */}
        {selectedVariable?._isCloned && !selectedVariable?._isSaved && (
          <div className="mt-2 p-3 bg-orange-900 bg-opacity-20 border border-orange-500 border-opacity-50 rounded text-sm">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-orange-400 font-medium mb-1">
                  Please define a new Variable name to save this clone.
                </div>
                <div className="text-orange-300 text-xs">
                  Each Variable must have a unique combination of Sector, Domain, Country, and other identifying attributes. Please edit the name or adjust another field to make it distinct.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drivers Section */}
      <CollapsibleSection title="Drivers" sectionKey="drivers" icon={<Database className="w-4 h-4 text-ag-dark-text-secondary" />} ontologyViewType="drivers">
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

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Variable Clarifier
            </label>
            <select
              value={driverSelections.variableClarifier}
              onChange={(e) => handleDriverSelectionChange('variableClarifier', e.target.value)}
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
              <option value="">None</option>
              {driversData.variableClarifiers.map((clarifier) => (
                <option key={clarifier} value={clarifier}>
                  {clarifier}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CollapsibleSection>

      {/* Ontology Section */}
      <CollapsibleSection title="Ontology" sectionKey="ontology" icon={<Users className="w-4 h-4 text-ag-dark-text-secondary" />} ontologyViewType="ontology">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Part
            </label>
            <select
              value={formData.part}
              onChange={(e) => handleChange('part', e.target.value)}
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
              <option value="">Select Part</option>
              {dynamicFieldOptions.part.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Section
            </label>
            <input
              key={`section-input-${selectedVariable?.id || 'new'}`}
              type="text"
              value={formData.section}
              onChange={(e) => {
                e.stopPropagation();
                handleChange('section', e.target.value);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
              onFocus={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
              disabled={!isPanelEnabled}
              placeholder="Enter section..."
              className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-ag-dark-text">
                Group
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsAddGroupValueModalOpen(true);
                }}
                disabled={!isPanelEnabled}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Add new Group value"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.group}
              onChange={(e) => handleChange('group', e.target.value)}
              disabled={!isPanelEnabled || !formData.part}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !isPanelEnabled || !formData.part ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Group</option>
              {formData.part ? (
                getGroupsForPart(formData.part).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))
              ) : (
                dynamicFieldOptions.group.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))
              )}
            </select>
          </div>

        </div>
      </CollapsibleSection>

      {/* Metadata Section */}
      <CollapsibleSection title="Metadata" sectionKey="metadata" icon={<FileText className="w-4 h-4 text-ag-dark-text-secondary" />} ontologyViewType="metadata">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-ag-dark-text">
                Format I
              </label>
              <button
                type="button"
                onClick={() => {
                  setSelectedFieldForAdd({ name: 'formatI', label: 'Format I' });
                  setIsAddFieldValueModalOpen(true);
                }}
                disabled={!isPanelEnabled}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Add new Format I value"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.formatI}
              onChange={(e) => handleChange('formatI', e.target.value)}
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
              <option value="">Select Format I</option>
              {dynamicFieldOptions.formatI.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-ag-dark-text">
                Format II
              </label>
              <button
                type="button"
                onClick={() => {
                  setSelectedFieldForAdd({ name: 'formatII', label: 'Format II' });
                  setIsAddFieldValueModalOpen(true);
                }}
                disabled={!isPanelEnabled}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Add new Format II value"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.formatII}
              onChange={(e) => handleChange('formatII', e.target.value)}
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
              <option value="">Select Format II</option>
              {dynamicFieldOptions.formatII.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-ag-dark-text">
                G-Type
              </label>
              <button
                type="button"
                onClick={() => {
                  setSelectedFieldForAdd({ name: 'gType', label: 'G-Type' });
                  setIsAddFieldValueModalOpen(true);
                }}
                disabled={!isPanelEnabled}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Add new G-Type value"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.gType}
              onChange={(e) => handleChange('gType', e.target.value)}
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
              <option value="">Select G-Type</option>
              {dynamicFieldOptions.gType.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-ag-dark-text">
                Validation
              </label>
              <button
                type="button"
                onClick={() => {
                  setSelectedFieldForAdd({ name: 'validation', label: 'Validation' });
                  setIsAddFieldValueModalOpen(true);
                }}
                disabled={!isPanelEnabled}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Add new Validation value"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.validation}
              onChange={(e) => handleChange('validation', e.target.value)}
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
              <option value="">Select Validation</option>
              {dynamicFieldOptions.validation.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-ag-dark-text">
                Default
              </label>
              <button
                type="button"
                onClick={() => {
                  setSelectedFieldForAdd({ name: 'default', label: 'Default' });
                  setIsAddFieldValueModalOpen(true);
                }}
                disabled={!isPanelEnabled}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Add new Default value"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.default}
              onChange={(e) => handleChange('default', e.target.value)}
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
              <option value="">Select Default</option>
              {dynamicFieldOptions.default.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Graph
            </label>
            <select
              value={formData.graph}
              onChange={(e) => handleChange('graph', e.target.value)}
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
              <option value="">Select Graph</option>
              {dynamicFieldOptions.graph.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CollapsibleSection>

      {/* Object Relationships Section */}
      <CollapsibleSection 
        title="Object Relationships" 
        sectionKey="objectRelationships"
        icon={<Link className="w-4 h-4 text-ag-dark-text-secondary" />}
        ontologyViewType="objectRelationships"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsVariableObjectRelationshipModalOpen(true)}
              disabled={!isPanelEnabled}
              className={`px-3 py-1.5 text-sm font-medium border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title={selectedCount > 1 ? "View relationships (bulk edit not yet supported)" : "View and manage relationships"}
            >
              View Relationships
            </button>
          </div>
        }
      >
        <div></div>
      </CollapsibleSection>

      {/* Actions */}
      {onSave && (
        <div className="mt-8 pt-6 border-t border-ag-dark-border">
          <button
            onClick={handleSave}
            disabled={!isPanelEnabled || (selectedVariable?._isCloned && !selectedVariable?._isSaved && !formData.variable?.trim())}
            className={`w-full bg-ag-dark-accent text-white py-2 px-4 rounded hover:bg-ag-dark-accent-hover transition-colors flex items-center justify-center gap-2 ${
              !isPanelEnabled || (selectedVariable?._isCloned && !selectedVariable?._isSaved && !formData.variable?.trim()) ? 'opacity-50 cursor-not-allowed bg-ag-dark-text-secondary hover:bg-ag-dark-text-secondary' : ''
            }`}
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      )}

      {/* Variable-Object Relationship Modal */}
      <VariableObjectRelationshipModal
        isOpen={isVariableObjectRelationshipModalOpen}
        onClose={() => {
          setIsVariableObjectRelationshipModalOpen(false);
          setPendingCsvData(null); // Clear pending CSV data when modal closes
        }}
        selectedVariable={selectedVariable}
        allObjects={objectsData}
        onSave={async () => {
          // When relationships are saved, we need to refresh the variables list
          // to get the updated relationship count. The onSave callback will handle this.
          // We pass a special flag to indicate this is a relationship update
          if (onSave) {
            await onSave({ _refreshRelationships: true });
          }
          // Refresh objects data to update the variables count
          if (onObjectsRefresh) {
            await onObjectsRefresh();
          }
        }}
        onRelationshipsChange={(relationships) => {
          // For cloned unsaved variables, update the objectRelationshipsList in local state
          // Pass through onSave so App.tsx can update the cloned variable's state
          if (selectedVariable?._isCloned && !selectedVariable?._isSaved && onSave) {
            onSave({ objectRelationshipsList: relationships, _isRelationshipUpdate: true });
          }
        }}
        initialCsvData={pendingCsvData}
      />

      {/* CSV Upload Modal removed - moved to VariableObjectRelationshipModal */}

      {/* Add Field Value Modal */}
      {selectedFieldForAdd && (
        <AddFieldValueModal
          isOpen={isAddFieldValueModalOpen}
          onClose={() => {
            setIsAddFieldValueModalOpen(false);
            setSelectedFieldForAdd(null);
          }}
          fieldName={selectedFieldForAdd.name}
          fieldLabel={selectedFieldForAdd.label}
          onSave={handleAddFieldValue}
        />
      )}

      {/* Add Group Value Modal */}
      <AddGroupValueModal
        isOpen={isAddGroupValueModalOpen}
        onClose={() => {
          setIsAddGroupValueModalOpen(false);
        }}
        onSave={handleAddGroupValue}
        availableParts={getDistinctParts()}
      />

      {/* Ontology Modal */}
      {ontologyModalOpen.isOpen && ontologyModalOpen.viewType && (selectedVariable?.id || selectedVariable?.variable) && (
        <OntologyModal
          isOpen={ontologyModalOpen.isOpen}
          onClose={closeOntologyModal}
          variableId={
            // For cloned unsaved variables, don't use the temporary ID - it won't exist in Neo4j
            // Only use variableId if it's a real saved variable (not a clone ID)
            (selectedVariable?.id?.startsWith('clone-') || (selectedVariable?._isCloned && !selectedVariable?._isSaved))
              ? undefined
              : (selectedVariable?.id && !selectedVariable?.id.startsWith('clone-')) ? selectedVariable.id : undefined
          }
          variableName={
            // Always pass variable name for display in header (even if we use variableId for query)
            selectedVariable?.variable || undefined
          }
          sectionName={
            ontologyModalOpen.viewType === 'drivers' ? 'Drivers' :
            ontologyModalOpen.viewType === 'ontology' ? 'Ontology' :
            ontologyModalOpen.viewType === 'metadata' ? 'Metadata' :
            'Object Relationships'
          }
          viewType={ontologyModalOpen.viewType}
          mode="variable"
        />
      )}
    </div>
  );
};