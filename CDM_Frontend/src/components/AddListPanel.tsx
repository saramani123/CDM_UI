import React, { useState, useRef, useEffect } from 'react';
import { Settings, Save, X, Trash2, Plus, Link, Upload, List, Database, Users, FileText, ChevronRight, ChevronDown, ArrowUpAZ, ArrowDownZA } from 'lucide-react';
import { listFieldOptions } from '../data/listsData';
import { ListCsvUploadModal } from './ListCsvUploadModal';
import { useDrivers } from '../hooks/useDrivers';
import { useVariables } from '../hooks/useVariables';
import { VariableObjectRelationshipModal } from './VariableObjectRelationshipModal';

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

interface AddListPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (listData: any) => void;
  allData?: any[];
}

export const AddListPanel: React.FC<AddListPanelProps> = ({
  isOpen,
  onClose,
  onAdd,
  allData = []
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

  // Relationship modal state
  const [isVariableRelationshipModalOpen, setIsVariableRelationshipModalOpen] = useState(false);
  const [selectedVariables, setSelectedVariables] = useState<any[]>([]);

  // Basic form data
  const [formData, setFormData] = useState({
    format: '',
    set: '',
    grouping: '',
    list: '',
    source: '',
    upkeep: '',
    graph: '',
    origin: ''
  });

  // Variables attached and list values
  const [variablesAttached, setVariablesAttached] = useState<VariableAttached[]>([]);
  const [listValuesText, setListValuesText] = useState<string>('');
  
  // Refs for textarea management
  const listValuesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isListValuesTextareaFocusedRef = useRef(false);
  const lastListValuesChangeTimeRef = useRef(0);

  // CSV upload modal states
  const [isVariableAttachedUploadOpen, setIsVariableAttachedUploadOpen] = useState(false);
  const [isListValuesUploadOpen, setIsListValuesUploadOpen] = useState(false);
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    drivers: false,
    ontology: false,
    metadata: false,
    relationships: false
  });

  if (!isOpen) return null;

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

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const handleChange = (key: string, value: string) => {
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

  // Handle list values textarea changes
  const handleListValuesTextChange = (text: string) => {
    const textarea = listValuesTextareaRef.current;
    const cursorPosition = textarea?.selectionStart || 0;
    lastListValuesChangeTimeRef.current = Date.now();
    setListValuesText(text);
    // Restore cursor position after state update
    requestAnimationFrame(() => {
      if (listValuesTextareaRef.current && isListValuesTextareaFocusedRef.current) {
        listValuesTextareaRef.current.focus();
        const maxPos = listValuesTextareaRef.current.value.length;
        const safePos = Math.min(cursorPosition, maxPos);
        listValuesTextareaRef.current.setSelectionRange(safePos, safePos);
      }
    });
  };

  // Sort list values A-Z or Z-A
  const handleSortListValues = (direction: 'asc' | 'desc') => {
    const lines = listValuesText.split('\n').filter(line => line.trim());
    const sorted = direction === 'asc' 
      ? lines.sort((a, b) => a.trim().localeCompare(b.trim()))
      : lines.sort((a, b) => b.trim().localeCompare(a.trim()));
    setListValuesText(sorted.join('\n'));
  };

  const handleVariableAttachedCsvUpload = (uploadedVariables: VariableAttached[]) => {
    setVariablesAttached(prev => [...prev, ...uploadedVariables]);
  };

  const handleListValuesCsvUpload = (uploadedValues: ListValue[]) => {
    // Append uploaded values to existing textarea text
    const existingLines = listValuesText.split('\n').filter(line => line.trim());
    const existingSet = new Set(existingLines.map(line => line.trim().toLowerCase()));
    
    // Filter out duplicates (case-insensitive)
    const newValues = uploadedValues
      .map(lv => lv.value.trim())
      .filter(val => val && !existingSet.has(val.toLowerCase()));
    
    if (newValues.length < uploadedValues.length) {
      const skippedCount = uploadedValues.length - newValues.length;
      alert(`Uploaded ${newValues.length} new list values. Skipped ${skippedCount} duplicates.`);
    }
    
    // Append new values to textarea
    const newLines = newValues.join('\n');
    setListValuesText(prev => prev ? `${prev}\n${newLines}` : newLines);
  };

  // Helper function to check if a list already exists
  const checkDuplicate = (sector: string[], domain: string[], country: string[], set: string, grouping: string, list: string): boolean => {
    // Normalize new values to strings for comparison
    const newSector = sector.length === 1 && sector[0] === 'ALL' ? 'ALL' : sector.sort().join(',');
    const newDomain = domain.length === 1 && domain[0] === 'ALL' ? 'ALL' : domain.sort().join(',');
    const newCountry = country.length === 1 && country[0] === 'ALL' ? 'ALL' : country.sort().join(',');
    
    return allData.some(existingList => {
      // Normalize existing values to strings for comparison
      const existingSector = Array.isArray(existingList.sector) 
        ? (existingList.sector.length === 1 && existingList.sector[0] === 'ALL' ? 'ALL' : existingList.sector.sort().join(','))
        : existingList.sector || '';
      const existingDomain = Array.isArray(existingList.domain)
        ? (existingList.domain.length === 1 && existingList.domain[0] === 'ALL' ? 'ALL' : existingList.domain.sort().join(','))
        : existingList.domain || '';
      const existingCountry = Array.isArray(existingList.country)
        ? (existingList.country.length === 1 && existingList.country[0] === 'ALL' ? 'ALL' : existingList.country.sort().join(','))
        : existingList.country || '';
      
      return existingSector === newSector &&
             existingDomain === newDomain &&
             existingCountry === newCountry &&
             existingList.set === set &&
             existingList.grouping === grouping &&
             existingList.list === list;
    });
  };

  // Validation - all required fields must be filled
  const isFormValid = () => {
    const hasSector = driverSelections.sector.length > 0;
    const hasDomain = driverSelections.domain.length > 0;
    const hasCountry = driverSelections.country.length > 0;
    const hasSet = formData.set.trim() !== '';
    const hasGrouping = formData.grouping.trim() !== '';
    const hasListName = formData.list.trim() !== '';
    return hasSector && hasDomain && hasCountry && hasSet && hasGrouping && hasListName;
  };

  const handleAddList = () => {
    if (!isFormValid()) {
      alert('Please fill in all required fields:\n• Sector\n• Domain\n• Country\n• Set\n• Grouping\n• List Name');
      return;
    }

    // Check for duplicate
    if (checkDuplicate(
      driverSelections.sector,
      driverSelections.domain,
      driverSelections.country,
      formData.set,
      formData.grouping,
      formData.list
    )) {
      alert('A list with the same Sector, Domain, Country, Set, Grouping, and List Name already exists in the dataset.');
      return;
    }

    // Convert textarea text to list values array
    const listValuesArray = listValuesText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map((value, index) => ({
        id: (Date.now() + index).toString(),
        value
      }));
    
    // Check for duplicate values (case-insensitive) within the same list
    const uniqueValues = new Set(listValuesArray.map(lv => lv.value.toLowerCase()));
    if (listValuesArray.length !== uniqueValues.size) {
      const duplicateValues = listValuesArray.filter((lv, index) => 
        listValuesArray.findIndex(v => v.value.toLowerCase() === lv.value.toLowerCase()) !== index
      ).map(lv => lv.value);
      
      alert(`Cannot save: Duplicate list values found: ${duplicateValues.join(', ')}. Please remove duplicates before saving.`);
      return;
    }

    const newList = {
      id: `list-${Date.now()}`,
      ...formData,
      sector: driverSelections.sector.length === 1 && driverSelections.sector[0] === 'ALL' ? 'ALL' : driverSelections.sector.join(','),
      domain: driverSelections.domain.length === 1 && driverSelections.domain[0] === 'ALL' ? 'ALL' : driverSelections.domain.join(','),
      country: driverSelections.country.length === 1 && driverSelections.country[0] === 'ALL' ? 'ALL' : driverSelections.country.join(','),
      status: 'Active',
      variablesAttachedList: selectedVariables.length > 0 ? selectedVariables : variablesAttached,
      listValuesList: listValuesArray
    };

    onAdd(newList);
    
    // Reset form
    setFormData({
      format: '',
      set: '',
      grouping: '',
      list: '',
      source: '',
      upkeep: '',
      graph: '',
      origin: ''
    });
    setDriverSelections({
      sector: [],
      domain: [],
      country: []
    });
    setVariablesAttached([]);
    setListValuesText('');
    setSelectedVariables([]);
    
    onClose();
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
          <h3 className="text-lg font-semibold text-ag-dark-text">Add New List</h3>
        </div>
        <button
          onClick={onClose}
          className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* List Name Field - Moved to header section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-ag-dark-text mb-2">
          List Name <span className="text-ag-dark-error">*</span>
        </label>
        <input
          type="text"
          value={formData.list}
          onChange={(e) => handleChange('list', e.target.value)}
          placeholder="Enter list name..."
          className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
        />
      </div>

      {/* Drivers Section */}
      <CollapsibleSection title="Drivers" sectionKey="drivers" icon={<Database className="w-4 h-4 text-ag-dark-text-secondary" />}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Sector <span className="text-ag-dark-error">*</span>
            </label>
            <MultiSelect
              label="Sector"
              options={['ALL', ...driversData.sectors]}
              values={driverSelections.sector}
              onChange={(values) => handleDriverSelectionChange('sector', values)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Domain <span className="text-ag-dark-error">*</span>
            </label>
            <MultiSelect
              label="Domain"
              options={['ALL', ...driversData.domains]}
              values={driverSelections.domain}
              onChange={(values) => handleDriverSelectionChange('domain', values)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Country <span className="text-ag-dark-error">*</span>
            </label>
            <MultiSelect
              label="Country"
              options={['ALL', ...driversData.countries]}
              values={driverSelections.country}
              onChange={(values) => handleDriverSelectionChange('country', values)}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Ontology Section */}
      <CollapsibleSection title="Ontology" sectionKey="ontology" icon={<Users className="w-4 h-4 text-ag-dark-text-secondary" />}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Set <span className="text-ag-dark-error">*</span>
            </label>
            <select
              value={formData.set}
              onChange={(e) => handleChange('set', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
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
              Grouping <span className="text-ag-dark-error">*</span>
            </label>
            <select
              value={formData.grouping}
              onChange={(e) => handleChange('grouping', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
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
      <CollapsibleSection title="Metadata" sectionKey="metadata" icon={<FileText className="w-4 h-4 text-ag-dark-text-secondary" />}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Format
            </label>
            <input
              type="text"
              value={formData.format}
              onChange={(e) => handleChange('format', e.target.value)}
              placeholder="Enter format..."
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Source
            </label>
            <input
              type="text"
              value={formData.source}
              onChange={(e) => handleChange('source', e.target.value)}
              placeholder="Enter source..."
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Upkeep
            </label>
            <input
              type="text"
              value={formData.upkeep}
              onChange={(e) => handleChange('upkeep', e.target.value)}
              placeholder="Enter upkeep..."
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Graph
            </label>
            <input
              type="text"
              value={formData.graph}
              onChange={(e) => handleChange('graph', e.target.value)}
              placeholder="Enter graph..."
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Origin
            </label>
            <input
              type="text"
              value={formData.origin}
              onChange={(e) => handleChange('origin', e.target.value)}
              placeholder="Enter origin..."
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Relationships Section */}
      <CollapsibleSection 
        title="Relationships" 
        sectionKey="relationships"
        icon={<Link className="w-4 h-4 text-ag-dark-text-secondary" />}
        actions={
          <button
            onClick={() => setIsVariableRelationshipModalOpen(true)}
            className="px-3 py-1.5 text-sm font-medium border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors"
            title="View and manage relationships"
          >
            View Relationships
          </button>
        }
      >
        <div className="mb-6">
          {selectedVariables.length === 0 ? (
            <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
              <div className="text-sm text-ag-dark-text-secondary">
                <span className="font-medium">No variables selected:</span> Click "View Relationships" to select variables from the variables grid.
              </div>
            </div>
          ) : (
            <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
              <div className="text-sm text-ag-dark-text">
                <span className="font-medium">{selectedVariables.length} variable{selectedVariables.length !== 1 ? 's' : ''} selected:</span>
                <div className="mt-2 space-y-1">
                  {selectedVariables.slice(0, 5).map((variable: any) => (
                    <div key={variable.id} className="text-ag-dark-text-secondary">
                      {variable.part} / {variable.section} / {variable.group} / {variable.variable}
                    </div>
                  ))}
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
              onClick={() => handleSortListValues('asc')}
              className="p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
              title="Sort A-Z"
            >
              <ArrowUpAZ className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleSortListValues('desc')}
              className="p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
              title="Sort Z-A"
            >
              <ArrowDownZA className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsListValuesUploadOpen(true)}
              className="text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors"
              title="Upload List Values CSV"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <textarea
          ref={listValuesTextareaRef}
          value={listValuesText}
          onChange={(e) => {
            handleListValuesTextChange(e.target.value);
          }}
          onKeyDown={(e) => {
            // Prevent Enter key from propagating to parent components
            e.stopPropagation();
            // Prevent default only for Escape, not Enter
            if (e.key === 'Escape') {
              listValuesTextareaRef.current?.blur();
            }
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
            isListValuesTextareaFocusedRef.current = true;
          }}
          onBlur={(e) => {
            // Only restore focus if blur happened very recently after typing (likely accidental)
            const timeSinceLastChange = Date.now() - lastListValuesChangeTimeRef.current;
            const wasRecentTyping = timeSinceLastChange < 200; // 200ms window
            
            // Check if blur was intentional (user clicked on another focusable element)
            const relatedTarget = e.relatedTarget as HTMLElement;
            const clickedOutside = !relatedTarget || 
              (relatedTarget.tagName !== 'TEXTAREA' && 
               relatedTarget.tagName !== 'INPUT' && 
               !relatedTarget.isContentEditable);
            
            // Only restore focus if it was recent typing and user didn't click on another input
            if (wasRecentTyping && clickedOutside && listValuesTextareaRef.current && isListValuesTextareaFocusedRef.current) {
              // Restore focus after a brief delay to let React finish its render cycle
              setTimeout(() => {
                if (listValuesTextareaRef.current && document.activeElement !== listValuesTextareaRef.current) {
                  listValuesTextareaRef.current.focus();
                }
              }, 10);
            } else if (!wasRecentTyping) {
              // User intentionally blurred, don't restore
              isListValuesTextareaFocusedRef.current = false;
            }
          }}
          placeholder={listValuesText.trim() === '' ? "Type one list value per line. Press Enter to add more. Use the upload icon to import from CSV." : undefined}
          rows={8}
          className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent resize-y"
        />
      </div>

      {/* Add List Button */}
      <div className="mt-8 pt-6 border-t border-ag-dark-border">
        <button
          onClick={handleAddList}
          disabled={!isFormValid()}
          className={`w-full py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 ${
            isFormValid()
              ? 'bg-ag-dark-accent text-white hover:bg-ag-dark-accent-hover'
              : 'bg-ag-dark-text-secondary text-ag-dark-text-secondary cursor-not-allowed opacity-50'
          }`}
        >
          <Plus className="w-4 h-4" />
          Add List
        </button>
      </div>

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

      {/* Variable Relationship Modal */}
      <VariableObjectRelationshipModal
        isOpen={isVariableRelationshipModalOpen}
        onClose={() => setIsVariableRelationshipModalOpen(false)}
        selectedVariable={null}
        allObjects={variablesData}
        onSave={() => {
          // Relationships saved
        }}
        onRelationshipsChange={(relationships) => {
          // Update selected variables when relationships change
          setSelectedVariables(relationships);
        }}
      />
    </div>
  );
};