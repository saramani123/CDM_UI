import React, { useState, useRef, useEffect } from 'react';
import { Settings, Save, X, Link, ChevronRight, ChevronDown, Database, Users, FileText, Plus } from 'lucide-react';
import { getVariableFieldOptions, concatenateVariableDrivers, parseVariableDriverString } from '../data/variablesData';
import { useDrivers } from '../hooks/useDrivers';
import { apiService } from '../services/api';
import { VariableObjectRelationshipModal } from './VariableObjectRelationshipModal';
import { CsvUploadModal } from './CsvUploadModal';
import { AddFieldValueModal } from './AddFieldValueModal';

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
  }, [selectedVariable?.id, driversData]); // Reset when variable changes or drivers data loads

  // Variable-object relationship modal state
  const [isVariableObjectRelationshipModalOpen, setIsVariableObjectRelationshipModalOpen] = useState(false);
  const [pendingCsvData, setPendingCsvData] = useState<any[] | null>(null);


  // Check if panel should be enabled (exactly 1 variable selected)
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
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen]);
    
    const handleToggle = (option: string) => {
      if (option === 'ALL') {
        if (values.includes('ALL')) {
          onChange([]);
        } else {
          onChange(['ALL']);
        }
      } else {
        const newValues = values.includes(option)
          ? values.filter(v => v !== option && v !== 'ALL')
          : [...values.filter(v => v !== 'ALL'), option];
        onChange(newValues);
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
  }> = ({ title, sectionKey, icon, actions, children }) => {
    const isExpanded = expandedSections[sectionKey];
    
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
          {isExpanded && actions && (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {actions}
            </div>
          )}
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
          onChange={(e) => handleChange('variable', e.target.value)}
          disabled={!isPanelEnabled}
          onClick={(e) => e.stopPropagation()}
          className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
            !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
      </div>

      {/* Drivers Section */}
      <CollapsibleSection title="Drivers" sectionKey="drivers" icon={<Database className="w-4 h-4 text-ag-dark-text-secondary" />}>
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
      <CollapsibleSection title="Ontology" sectionKey="ontology" icon={<Users className="w-4 h-4 text-ag-dark-text-secondary" />}>
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
              type="text"
              value={formData.section}
              onChange={(e) => handleChange('section', e.target.value)}
              disabled={!isPanelEnabled}
              placeholder="Enter section..."
              className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Group
            </label>
            <select
              value={formData.group}
              onChange={(e) => handleChange('group', e.target.value)}
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
              <option value="">Select Group</option>
              {dynamicFieldOptions.group.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

        </div>
      </CollapsibleSection>

      {/* Metadata Section */}
      <CollapsibleSection title="Metadata" sectionKey="metadata" icon={<FileText className="w-4 h-4 text-ag-dark-text-secondary" />}>
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
          // Refresh variable data if needed
          if (onSave) {
            await onSave({});
          }
          // Refresh objects data to update the variables count
          if (onObjectsRefresh) {
            await onObjectsRefresh();
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
    </div>
  );
};