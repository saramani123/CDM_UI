import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Settings, Save, X, Link, ChevronRight, ChevronDown, Database, Users, FileText, Plus, Network, Info, Copy, Upload, Layers, ArrowUpAZ, ArrowDownZA, Grid3x3 } from 'lucide-react';
import { getVariableFieldOptions, concatenateVariableDrivers, parseVariableDriverString } from '../data/variablesData';
import { useDrivers } from '../hooks/useDrivers';
import { apiService } from '../services/api';
import { VariableObjectRelationshipModal } from './VariableObjectRelationshipModal';
import { CsvUploadModal } from './CsvUploadModal';
import { AddFieldValueModal } from './AddFieldValueModal';
import { AddGroupValueModal } from './AddGroupValueModal';
import { AddSectionValueModal } from './AddSectionValueModal';
import { OntologyModal } from './OntologyModal';
import { CloneVariableRelationshipsModal } from './CloneVariableRelationshipsModal';
import { parseValidation, buildValidationString, validateValidationInput, getOperatorsForValType, type ValidationComponents, type ValType, type Operator } from '../utils/validationUtils';

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
  
  // State for add section value modal
  const [isAddSectionValueModalOpen, setIsAddSectionValueModalOpen] = useState(false);
  
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

  const handleAddSectionValue = async (sectionValue: string) => {
    // Update dynamic field options to include the new section
    setDynamicFieldOptions(prev => ({
      ...prev,
      section: [...new Set([...prev.section, sectionValue])].sort()
    }));
    
    // Also update the form data to select the newly added section
    handleChange('section', sectionValue);
  };

  // Get distinct sections from all variables data (irrespective of part/group)
  const getDistinctSections = (): string[] => {
    const variablesData = allData.length > 0 ? allData : (window as any).variablesData || [];
    const sectionsFromData = [...new Set(variablesData.map((item: any) => item.section))].filter(Boolean).sort() as string[];
    
    // Combine with dynamic field options
    const allSections = [...new Set([...sectionsFromData, ...dynamicFieldOptions.section])].sort();
    return allSections;
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
    validations: false,
    objectRelationships: false,
    variations: false
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
      
      // Parse validation string into components
      const parsed = parseValidation(selectedVariable?.validation || '');
      setValidationComponents(parsed);
      setValidationError('');
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
  const [isCloneVariableRelationshipsModalOpen, setIsCloneVariableRelationshipsModalOpen] = useState(false);

  // Variations state - using string for multiline input
  const [variationsText, setVariationsText] = useState('');
  const variationsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isTextareaFocusedRef = useRef<boolean>(false);
  const lastChangeTimeRef = useRef<number>(0);
  const [isVariationUploadOpen, setIsVariationUploadOpen] = useState(false);
  const [isVariationsGraphModalOpen, setIsVariationsGraphModalOpen] = useState(false);

  // Validation components state
  const [validationComponents, setValidationComponents] = useState<ValidationComponents>({
    valType: '',
    operator: '',
    value: ''
  });
  const [validationError, setValidationError] = useState<string>('');

  // Section input focus management
  const sectionInputRef = useRef<HTMLInputElement>(null);
  const isSectionInputFocusedRef = useRef<boolean>(false);
  const lastSectionChangeTimeRef = useRef<number>(0);

  // Validation value input focus management
  const validationValueInputRef = useRef<HTMLInputElement>(null);
  const isValidationValueInputFocusedRef = useRef<boolean>(false);
  const lastValidationValueChangeTimeRef = useRef<number>(0);

  // Update validation value when formatI changes (for Range type)
  React.useEffect(() => {
    if (validationComponents.valType === 'Range' && formData.formatI) {
      setValidationComponents(prev => ({
        ...prev,
        value: formData.formatI
      }));
    }
  }, [formData.formatI, validationComponents.valType]);

  // Update validation value when variable name changes (for Relative type)
  React.useEffect(() => {
    if (validationComponents.valType === 'Relative' && formData.variable) {
      setValidationComponents(prev => ({
        ...prev,
        value: formData.variable
      }));
    }
  }, [formData.variable, validationComponents.valType]);

  // Load variations when selectedVariable changes
  React.useEffect(() => {
    if (selectedVariable?.id) {
      console.log('VariableMetadataPanel: Loading variations for variable:', selectedVariable.variable, 'id:', selectedVariable.id);
      
      // If this is a cloned unsaved variable, use the variations from the cloned data
      if (selectedVariable._isCloned && !selectedVariable._isSaved) {
        console.log('VariableMetadataPanel: Using variations from cloned variable data:', selectedVariable.variationsList);
        const variationsTextContent = (selectedVariable.variationsList || []).map((v: any) => typeof v === 'string' ? v : v.name).join('\n');
        setVariationsText(variationsTextContent);
        return;
      }
      
      const loadVariations = async () => {
        try {
          const variationData = await apiService.getVariableVariations(selectedVariable.id);
          console.log('VariableMetadataPanel: API variation data:', variationData);
          const variationsList = variationData?.variationsList || [];
          console.log('VariableMetadataPanel: loaded variations from API:', variationsList);
          // Convert variations array to multiline text
          const variationsTextContent = variationsList.map(v => v.name).join('\n');
          setVariationsText(variationsTextContent);
        } catch (error) {
          console.error('VariableMetadataPanel: failed to load variations:', error);
          setVariationsText('');
        }
      };
      
      loadVariations();
    } else {
      setVariationsText('');
    }
  }, [selectedVariable?.id, selectedVariable?._isCloned, selectedVariable?._isSaved, selectedVariable?.variationsList]);

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
    console.log(`🟢 handleChange called: ${key} = ${value}`);
    setFormData(prev => {
      const newData = { ...prev, [key]: value };
      
      // When part changes, clear section and group (sequential dependency)
      if (key === 'part' && value !== prev.part) {
        console.log(`🟡 Part changed from ${prev.part} to ${value}, clearing section and group`);
        newData.section = '';
        newData.group = '';
      }
      
      // When section changes, clear group (sequential dependency)
      if (key === 'section' && value !== prev.section) {
        console.log(`🟡 Section changed from ${prev.section} to ${value}, clearing group`);
        newData.group = '';
      }
      
      console.log(`🟢 New formData after change:`, newData);
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


  const handleSortVariations = (direction: 'asc' | 'desc') => {
    const lines = variationsText.split('\n').filter(line => line.trim() !== '');
    const sortedLines = [...lines].sort((a, b) => {
      const aTrimmed = a.trim().toLowerCase();
      const bTrimmed = b.trim().toLowerCase();
      if (direction === 'asc') {
        return aTrimmed.localeCompare(bTrimmed);
      } else {
        return bTrimmed.localeCompare(aTrimmed);
      }
    });
    setVariationsText(sortedLines.join('\n') + (variationsText.endsWith('\n') ? '\n' : ''));
  };

  const handleVariationCsvUpload = async (data: any[] | File) => {
    if (!selectedVariable?.id) {
      alert('No variable selected for variation upload');
      return;
    }

    // Check if it's a File (new API-based upload) or array (old client-side parsing)
    if (data instanceof File) {
      try {
        const result = await apiService.bulkUploadVariations(selectedVariable.id, data);
        console.log('Bulk variations upload result:', result);
        
        // Show success message
        const response = result as any;
        alert(response.message || `Successfully uploaded ${response.created_count} variations`);
        
        // Refresh the variations list by fetching the updated variations
        try {
          const variationData = await apiService.getVariableVariations(selectedVariable.id);
          const variationsList = variationData?.variationsList || [];
          // Convert variations array to multiline text
          const variationsTextContent = variationsList.map(v => v.name).join('\n');
          setVariationsText(variationsTextContent);
          console.log('VariableMetadataPanel: refreshed variations after upload:', variationsList);
        } catch (error) {
          console.error('VariableMetadataPanel: failed to refresh variations after upload:', error);
        }
      } catch (error) {
        console.error('Bulk variations upload failed:', error);
        alert(`Variations upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Old client-side parsing logic - append to textarea
      const existingNames = new Set(variationsText.split('\n').filter(line => line.trim()).map(name => name.toLowerCase()));
      const newVariations = data.filter((variation: any) => 
        !existingNames.has(variation.name.toLowerCase())
      );
      
      if (newVariations.length < data.length) {
        const skippedCount = data.length - newVariations.length;
        alert(`Uploaded ${newVariations.length} new variations. Skipped ${skippedCount} duplicates.`);
      }
      
      // Append new variations to textarea
      const newLines = newVariations.map((v: any) => v.name).join('\n');
      setVariationsText(prev => prev ? `${prev}\n${newLines}` : newLines);
    }
  };

  const handleSave = async () => {
    console.log('🔵 handleSave CALLED');
    console.log('🔵 Current formData:', formData);
    console.log('🔵 formData.part:', formData.part);
    console.log('🔵 formData.group:', formData.group);
    
    try {
      // Generate driver string from selections
      const driverString = concatenateVariableDrivers(
        driverSelections.sector,
        driverSelections.domain,
        driverSelections.country,
        driverSelections.variableClarifier
      );

      // Convert multiline text to variations array
      const variationsList = variationsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map((name, index) => ({
          id: (Date.now() + index).toString(),
          name
        }));
      
      // Check for duplicate variation names (case-insensitive)
      const uniqueVariationNames = new Set(variationsList.map(v => v.name.toLowerCase()));
      
      if (variationsList.length !== uniqueVariationNames.size) {
        const duplicateNames = variationsList.filter((variation, index) => 
          variationsList.findIndex(v => v.name.toLowerCase() === variation.name.toLowerCase()) !== index
        ).map(v => v.name);
        
        alert(`Cannot save: Duplicate variation names found: ${duplicateNames.join(', ')}. Please remove duplicates before saving.`);
        return;
      }

      // Validate validation components before saving
      if (validationComponents.valType) {
        // Check if operator is required and selected
        const requiresOperator = ['Range', 'Relative', 'Length'].includes(validationComponents.valType);
        if (requiresOperator && !validationComponents.operator) {
          alert('Please select an operator for the selected validation type.');
          setValidationError('Operator is required');
          return;
        }
        
        // Check if value is required and entered
        const requiresValue = ['Length', 'Character'].includes(validationComponents.valType);
        if (requiresValue && !validationComponents.value.trim()) {
          alert('Please enter a value for the selected validation type.');
          setValidationError('Value is required');
          return;
        }
      }

      // Build validation string from components
      const validationString = buildValidationString(
        validationComponents,
        formData.variable, // variable name for Relative type
        formData.formatI  // formatI for Range type
      );

      const saveData = {
        ...formData,
        driver: driverString,
        validation: validationString,
        variationsList: variationsList
      };

      console.log('VariableMetadataPanel - saveData being sent:', saveData);
      console.log('VariableMetadataPanel - part in saveData:', saveData.part);
      console.log('VariableMetadataPanel - group in saveData:', saveData.group);

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
            {actions && <>{actions}</>}
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
    <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border flex flex-col h-full" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0 p-6 pb-4">
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

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-6">
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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-ag-dark-text">
                Section
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsAddSectionValueModalOpen(true);
                }}
                disabled={!isPanelEnabled}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Add new Section value"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.section}
              onChange={(e) => handleChange('section', e.target.value)}
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
              <option value="">Select Section</option>
              {getDistinctSections().map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
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
                disabled={!isPanelEnabled || !formData.part}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Add new Group value"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.group}
              onChange={(e) => handleChange('group', e.target.value)}
              disabled={!isPanelEnabled || !formData.part || !formData.section}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !isPanelEnabled || !formData.part || !formData.section ? 'opacity-50 cursor-not-allowed' : ''
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

      {/* Validations Section */}
      <CollapsibleSection title="Validations" sectionKey="validations" icon={<Settings className="w-4 h-4 text-ag-dark-text-secondary" />}>
        <div className="space-y-4">
          {/* Val Type Dropdown */}
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Val Type
            </label>
            <select
              value={validationComponents.valType}
              onChange={(e) => {
                const newValType = e.target.value as ValType | '';
                const newComponents: ValidationComponents = {
                  valType: newValType,
                  operator: '',
                  value: ''
                };
                
                // Auto-set value for List
                if (newValType === 'List') {
                  newComponents.value = 'List';
                }
                // Auto-set value for Range (use formatI)
                else if (newValType === 'Range') {
                  newComponents.value = formData.formatI || '';
                }
                // Auto-set value for Relative (use variable name)
                else if (newValType === 'Relative') {
                  newComponents.value = formData.variable || '';
                }
                
                setValidationComponents(newComponents);
                setValidationError('');
              }}
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
              <option value="">Select Val Type</option>
              <option value="List">List</option>
              <option value="Range">Range</option>
              <option value="Relative">Relative</option>
              <option value="Length">Length</option>
              <option value="Character">Character</option>
            </select>
          </div>

          {/* Operator Dropdown */}
          {validationComponents.valType && getOperatorsForValType(validationComponents.valType).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Operator
              </label>
              <select
                value={validationComponents.operator}
                onChange={(e) => {
                  setValidationComponents(prev => ({
                    ...prev,
                    operator: e.target.value as Operator
                  }));
                  setValidationError('');
                }}
                disabled={!isPanelEnabled}
                className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                  validationError && validationError.includes('Operator') ? 'border-red-500' : 'border-ag-dark-border'
                } ${!isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                <option value="">Select Operator</option>
                {getOperatorsForValType(validationComponents.valType).map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
              {validationError && validationError.includes('Operator') && (
                <p className="mt-1 text-sm text-red-500">{validationError}</p>
              )}
            </div>
          )}

          {/* Value Field */}
          {validationComponents.valType && (
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Value
              </label>
              {validationComponents.valType === 'List' ? (
                <input
                  type="text"
                  value={validationComponents.value}
                  disabled
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text opacity-50 cursor-not-allowed"
                />
              ) : validationComponents.valType === 'Range' ? (
                <input
                  type="text"
                  value={validationComponents.value}
                  disabled
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text opacity-50 cursor-not-allowed"
                />
              ) : validationComponents.valType === 'Relative' ? (
                <input
                  type="text"
                  value={validationComponents.value}
                  disabled
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text opacity-50 cursor-not-allowed"
                />
              ) : validationComponents.valType === 'Length' ? (
                <div>
                  <input
                    ref={validationValueInputRef}
                    type="text"
                    value={validationComponents.value}
                    onInput={(e) => {
                      e.stopPropagation();
                      const input = e.target as HTMLInputElement;
                      const cursorPosition = input.selectionStart;
                      const newValue = input.value;
                      lastValidationValueChangeTimeRef.current = Date.now();
                      const validation = validateValidationInput('Length', newValue);
                      setValidationError(validation.isValid ? '' : (validation.error || ''));
                      setValidationComponents(prev => ({
                        ...prev,
                        value: newValue
                      }));
                      const restoreFocus = () => {
                        if (validationValueInputRef.current) {
                          validationValueInputRef.current.focus();
                          const maxPos = validationValueInputRef.current.value.length;
                          const safePos = Math.min(cursorPosition, maxPos);
                          validationValueInputRef.current.setSelectionRange(safePos, safePos);
                        }
                      };
                      restoreFocus();
                      Promise.resolve().then(restoreFocus);
                      requestAnimationFrame(restoreFocus);
                    }}
                    onChange={(e) => { e.stopPropagation(); }}
                    onKeyDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                    onKeyPress={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                    onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                    onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                    onFocus={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); isValidationValueInputFocusedRef.current = true; }}
                    onBlur={(e) => {
                      const timeSinceLastChange = Date.now() - lastValidationValueChangeTimeRef.current;
                      const wasRecentTyping = timeSinceLastChange < 300;
                      const relatedTarget = e.relatedTarget as HTMLElement;
                      const clickedOnInput = relatedTarget && (relatedTarget.tagName === 'INPUT' || relatedTarget.tagName === 'TEXTAREA' || relatedTarget.isContentEditable);
                      if (wasRecentTyping && !clickedOnInput && validationValueInputRef.current && isValidationValueInputFocusedRef.current) {
                        e.preventDefault();
                        e.stopPropagation();
                        setTimeout(() => { if (validationValueInputRef.current) validationValueInputRef.current.focus(); }, 0);
                      } else if (!wasRecentTyping) {
                        isValidationValueInputFocusedRef.current = false;
                      }
                    }}
                    disabled={!isPanelEnabled}
                    placeholder="Enter integer"
                    className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                      validationError ? 'border-red-500' : ''
                    } ${!isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                  {validationError && (
                    <p className="mt-1 text-sm text-red-500">{validationError}</p>
                  )}
                </div>
              ) : validationComponents.valType === 'Character' ? (
                <div>
                  <input
                    ref={validationValueInputRef}
                    type="text"
                    value={validationComponents.value}
                    onInput={(e) => {
                      e.stopPropagation();
                      const input = e.target as HTMLInputElement;
                      const cursorPosition = input.selectionStart;
                      const newValue = input.value;
                      lastValidationValueChangeTimeRef.current = Date.now();
                      const validation = validateValidationInput('Character', newValue);
                      setValidationError(validation.isValid ? '' : (validation.error || ''));
                      setValidationComponents(prev => ({
                        ...prev,
                        value: newValue
                      }));
                      const restoreFocus = () => {
                        if (validationValueInputRef.current) {
                          validationValueInputRef.current.focus();
                          const maxPos = validationValueInputRef.current.value.length;
                          const safePos = Math.min(cursorPosition, maxPos);
                          validationValueInputRef.current.setSelectionRange(safePos, safePos);
                        }
                      };
                      restoreFocus();
                      Promise.resolve().then(restoreFocus);
                      requestAnimationFrame(restoreFocus);
                    }}
                    onChange={(e) => { e.stopPropagation(); }}
                    onKeyDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                    onKeyPress={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                    onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                    onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                    onFocus={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); isValidationValueInputFocusedRef.current = true; }}
                    onBlur={(e) => {
                      const timeSinceLastChange = Date.now() - lastValidationValueChangeTimeRef.current;
                      const wasRecentTyping = timeSinceLastChange < 300;
                      const relatedTarget = e.relatedTarget as HTMLElement;
                      const clickedOnInput = relatedTarget && (relatedTarget.tagName === 'INPUT' || relatedTarget.tagName === 'TEXTAREA' || relatedTarget.isContentEditable);
                      if (wasRecentTyping && !clickedOnInput && validationValueInputRef.current && isValidationValueInputFocusedRef.current) {
                        e.preventDefault();
                        e.stopPropagation();
                        setTimeout(() => { if (validationValueInputRef.current) validationValueInputRef.current.focus(); }, 0);
                      } else if (!wasRecentTyping) {
                        isValidationValueInputFocusedRef.current = false;
                      }
                    }}
                    disabled={!isPanelEnabled}
                    placeholder="Enter alphanumeric character"
                    className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                      validationError ? 'border-red-500' : ''
                    } ${!isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                  {validationError && (
                    <p className="mt-1 text-sm text-red-500">{validationError}</p>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Object Relationships Section */}
      <CollapsibleSection 
        title="Relevance" 
        sectionKey="objectRelationships"
        icon={<Link className="w-4 h-4 text-ag-dark-text-secondary" />}
        ontologyViewType="objectRelationships"
        actions={
          <div className="flex items-center gap-2">
            {/* Clone Relationships Button - Only show if variable has no relationships */}
            {!(selectedVariable?._isCloned && !selectedVariable?._isSaved) && (
              <button
                onClick={() => setIsCloneVariableRelationshipsModalOpen(true)}
                disabled={!isPanelEnabled || (selectedVariable?.objectRelationships || 0) > 0}
                className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                  !isPanelEnabled || (selectedVariable?.objectRelationships || 0) > 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
                }`}
                title={(selectedVariable?.objectRelationships || 0) > 0 ? "Please delete existing relationships to use clone" : "Clone object relationships from another variable"}
              >
                <Copy className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setIsVariableObjectRelationshipModalOpen(true)}
              disabled={!isPanelEnabled}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title={selectedCount > 1 ? "View relationships (bulk edit not yet supported)" : "View and manage relationships"}
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
          </div>
        }
      >
        <div></div>
      </CollapsibleSection>

      {/* Variations Section */}
      <CollapsibleSection 
        title="Variations" 
        sectionKey="variations"
        icon={<Layers className="w-4 h-4 text-ag-dark-text-secondary" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSortVariations('asc')}
              disabled={!isPanelEnabled}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title="Sort A-Z"
            >
              <ArrowUpAZ className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleSortVariations('desc')}
              disabled={!isPanelEnabled}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title="Sort Z-A"
            >
              <ArrowDownZA className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsVariationUploadOpen(true)}
              disabled={!isPanelEnabled}
              className={`text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Upload Variations CSV"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsVariationsGraphModalOpen(true)}
              disabled={!isPanelEnabled || !selectedVariable?.id}
              className={`text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors ${
                !isPanelEnabled || !selectedVariable?.id ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="View Variations Graph"
            >
              <Network className="w-4 h-4" />
            </button>
          </div>
        }
      >
        <textarea
          ref={variationsTextareaRef}
          value={variationsText}
          onChange={(e) => {
            const textarea = e.target as HTMLTextAreaElement;
            const cursorPosition = textarea.selectionStart;
            lastChangeTimeRef.current = Date.now();
            setVariationsText(e.target.value);
            // Restore cursor position and focus after state update
            requestAnimationFrame(() => {
              if (variationsTextareaRef.current && isTextareaFocusedRef.current) {
                variationsTextareaRef.current.focus();
                // Try to restore cursor position, but if it's out of bounds, put it at the end
                const maxPos = variationsTextareaRef.current.value.length;
                const safePos = Math.min(cursorPosition, maxPos);
                variationsTextareaRef.current.setSelectionRange(safePos, safePos);
              }
            });
          }}
          onKeyDown={(e) => {
            // Prevent Enter key from propagating to parent components
            e.stopPropagation();
            // Prevent default only for Escape, not Enter
            if (e.key === 'Escape') {
              variationsTextareaRef.current?.blur();
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
            isTextareaFocusedRef.current = true;
          }}
          onBlur={(e) => {
            // Only restore focus if blur happened very recently after typing (likely accidental)
            const timeSinceLastChange = Date.now() - lastChangeTimeRef.current;
            const wasRecentTyping = timeSinceLastChange < 200; // 200ms window
            
            // Check if blur was intentional (user clicked on another focusable element)
            const relatedTarget = e.relatedTarget as HTMLElement;
            const clickedOutside = !relatedTarget || 
              (relatedTarget.tagName !== 'TEXTAREA' && 
               relatedTarget.tagName !== 'INPUT' && 
               !relatedTarget.isContentEditable);
            
            // Only restore focus if it was recent typing and user didn't click on another input
            if (wasRecentTyping && clickedOutside && variationsTextareaRef.current && isTextareaFocusedRef.current) {
              // Restore focus after a brief delay to let React finish its render cycle
              setTimeout(() => {
                if (variationsTextareaRef.current && document.activeElement !== variationsTextareaRef.current) {
                  variationsTextareaRef.current.focus();
                }
              }, 10);
            } else if (!wasRecentTyping) {
              // User intentionally blurred, don't restore
              isTextareaFocusedRef.current = false;
            }
          }}
          disabled={!isPanelEnabled}
          placeholder="Type one variation per line. Press Enter to add more."
          rows={8}
          className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent resize-y ${
            !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
      </CollapsibleSection>

      </div>

      {/* Actions - Fixed at bottom */}
      {onSave && (
        <div className="mt-8 pt-6 border-t border-ag-dark-border flex-shrink-0 px-6 pb-6">
          <button
            onClick={(e) => {
              console.log('🔴 Save button clicked');
              console.log('🔴 isPanelEnabled:', isPanelEnabled);
              console.log('🔴 formData at click:', formData);
              e.preventDefault();
              e.stopPropagation();
              handleSave();
            }}
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

      {/* Clone Variable Relationships Modal */}
      <CloneVariableRelationshipsModal
        isOpen={isCloneVariableRelationshipsModalOpen}
        onClose={() => setIsCloneVariableRelationshipsModalOpen(false)}
        targetVariable={selectedVariable}
        allVariables={allData}
        onCloneSuccess={async () => {
          // Refresh the variable to get updated relationship count
          if (selectedVariable?.id && onSave) {
            await onSave({ _refreshRelationships: true });
          }
          // Refresh objects data to update the variables count
          if (onObjectsRefresh) {
            await onObjectsRefresh();
          }
          // Open the relationship modal to show the cloned relationships
          setIsVariableObjectRelationshipModalOpen(true);
        }}
      />

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

      {/* Variations CSV Upload Modal */}
      <CsvUploadModal
        isOpen={isVariationUploadOpen}
        onClose={() => setIsVariationUploadOpen(false)}
        type="variations"
        onUpload={handleVariationCsvUpload}
      />

      {/* Variations Graph Modal */}
      <OntologyModal
        isOpen={isVariationsGraphModalOpen}
        onClose={() => setIsVariationsGraphModalOpen(false)}
        variableId={
          // For cloned unsaved variables, don't use the temporary ID - it won't exist in Neo4j
          (selectedVariable?.id?.startsWith('clone-') || (selectedVariable?._isCloned && !selectedVariable?._isSaved))
            ? undefined
            : selectedVariable?.id
        }
        variableName={
          // For cloned unsaved variables, use the variable name
          (selectedVariable?.id?.startsWith('clone-') || (selectedVariable?._isCloned && !selectedVariable?._isSaved))
            ? selectedVariable?.variable
            : undefined
        }
        sectionName="Variations"
        viewType="variations"
        mode="variable"
      />

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
        defaultPart={formData.part || ''}
      />

      {/* Add Section Value Modal */}
      <AddSectionValueModal
        isOpen={isAddSectionValueModalOpen}
        onClose={() => {
          setIsAddSectionValueModalOpen(false);
        }}
        onSave={handleAddSectionValue}
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
            'Relevance'
          }
          viewType={ontologyModalOpen.viewType}
          mode="variable"
        />
      )}
    </div>
  );
};