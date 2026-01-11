import React, { useState, useRef, useEffect } from 'react';
import { Settings, X, Trash2, Plus, Link, Upload, ChevronRight, ChevronDown, Database, Users, FileText, Layers, ArrowUpAZ, ArrowDownZA } from 'lucide-react';
import { getVariableFieldOptions, concatenateVariableDrivers } from '../data/variablesData';
import { useDrivers } from '../hooks/useDrivers';
import { CsvUploadModal } from './CsvUploadModal';
import { VariableObjectRelationshipModal } from './VariableObjectRelationshipModal';
import { AddSectionValueModal } from './AddSectionValueModal';
import { AddGroupValueModal } from './AddGroupValueModal';
import { AddFieldValueModal } from './AddFieldValueModal';
import { useObjects } from '../hooks/useObjects';
import { parseDriverField } from '../data/mockData';
import { buildValidationString, validateValidationInput, getOperatorsForValType, type ValidationComponents, type ValType, type Operator } from '../utils/validationUtils';
import { apiService } from '../services/api';

interface ObjectRelationship {
  id: string;
  toBeing: string;
  toAvatar: string;
  toObject: string;
}

interface AddVariablePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (variableData: any) => void;
  allData?: any[];
  objectsData?: any[];
}

export const AddVariablePanel: React.FC<AddVariablePanelProps> = ({
  isOpen,
  onClose,
  onAdd,
  allData = [],
  objectsData = []
}) => {
  // Basic form data
  const [formData, setFormData] = useState({
    part: '',
    section: '',
    group: '',
    variable: '',
    formatI: '',
    formatII: '',
    gType: '',
    validation: '',
    default: '',
    graph: ''
  });

  // Driver selections state
  const [driverSelections, setDriverSelections] = useState({
    sector: [],
    domain: [],
    country: [],
    variableClarifier: ''
  });

  // Validation components state
  const [validationComponents, setValidationComponents] = useState<ValidationComponents>({
    valType: '',
    operator: '',
    value: ''
  });
  const [validationError, setValidationError] = useState<string>('');

  const { drivers: driversData, loading: driversLoading } = useDrivers();

  // Object relationships - store selected object IDs from modal
  const [selectedObjectRelationships, setSelectedObjectRelationships] = useState<string[]>([]);
  
  // Modal state for object relationships
  const [isVariableObjectRelationshipModalOpen, setIsVariableObjectRelationshipModalOpen] = useState(false);
  const [isCsvUploadOpen, setIsCsvUploadOpen] = useState(false);
  const [pendingCsvData, setPendingCsvData] = useState<any[] | null>(null);
  
  // Modal state for add section/group values
  const [isAddSectionValueModalOpen, setIsAddSectionValueModalOpen] = useState(false);
  const [isAddGroupValueModalOpen, setIsAddGroupValueModalOpen] = useState(false);
  
  // Modal state for add field value (Format I, Format II, G-Type, Default)
  const [isAddFieldValueModalOpen, setIsAddFieldValueModalOpen] = useState(false);
  const [selectedFieldForAdd, setSelectedFieldForAdd] = useState<{ name: string; label: string } | null>(null);
  
  // Get objects data - use hook if not provided as prop
  const { objects: objectsFromHook } = useObjects();
  const allObjects = objectsData && objectsData.length > 0 ? objectsData : objectsFromHook;

  // Variations - using string for multiline input
  const [variationsText, setVariationsText] = useState('');
  const variationsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isTextareaFocusedRef = useRef<boolean>(false);
  const lastChangeTimeRef = useRef<number>(0);
  const [isVariationUploadOpen, setIsVariationUploadOpen] = useState(false);

  // Section input focus management
  const sectionInputRef = useRef<HTMLInputElement>(null);
  const isSectionInputFocusedRef = useRef<boolean>(false);
  const lastSectionChangeTimeRef = useRef<number>(0);

  // Validation value input focus management
  const validationValueInputRef = useRef<HTMLInputElement>(null);
  const isValidationValueInputFocusedRef = useRef<boolean>(false);
  const lastValidationValueChangeTimeRef = useRef<number>(0);

  // Storage key for part-group associations
  const PART_GROUP_STORAGE_KEY = 'cdm_variable_part_group_associations';

  // Get dynamic field options from existing variables data
  const [dynamicFieldOptions, setDynamicFieldOptions] = useState(getVariableFieldOptions(allData));

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

  // Get distinct parts from variables data
  const getDistinctParts = (): string[] => {
    const variablesData = allData.length > 0 ? allData : (window as any).variablesData || [];
    const parts = [...new Set(variablesData.map((item: any) => item.part))].filter(Boolean).sort() as string[];
    return parts.length > 0 ? parts : dynamicFieldOptions.part;
  };

  // Get distinct sections from all variables data (irrespective of part/group)
  const getDistinctSections = (): string[] => {
    const variablesData = allData.length > 0 ? allData : (window as any).variablesData || [];
    const sectionsFromData = [...new Set(variablesData.map((item: any) => item.section))].filter(Boolean).sort() as string[];
    
    // Combine with dynamic field options
    const allSections = [...new Set([...sectionsFromData, ...dynamicFieldOptions.section])].sort();
    return allSections;
  };

  const handleAddSectionValue = async (sectionValue: string) => {
    console.log('handleAddSectionValue - adding section:', sectionValue);
    
    // Update dynamic field options to include the new section
    setDynamicFieldOptions(prev => {
      const updated = {
        ...prev,
        section: [...new Set([...prev.section, sectionValue])].sort()
      };
      console.log('Updated dynamicFieldOptions.section:', updated.section);
      return updated;
    });
    
    // Also update the form data to select the newly added section
    // Use setFormData directly to ensure it's set immediately
    setFormData(prev => {
      const updated = {
        ...prev,
        section: sectionValue
      };
      console.log('Updated formData.section:', updated.section);
      return updated;
    });
  };

  const handleAddGroupValue = async (part: string, groupValue: string) => {
    // Save to localStorage
    const associations = getPartGroupAssociations();
    if (!associations[part]) {
      associations[part] = [];
    }
    if (!associations[part].includes(groupValue)) {
      associations[part].push(groupValue);
      associations[part].sort();
      localStorage.setItem(PART_GROUP_STORAGE_KEY, JSON.stringify(associations));
    }
    
    // Update dynamic field options if the current part is selected
    if (formData.part === part) {
      setDynamicFieldOptions(prev => ({
        ...prev,
        group: [...new Set([...prev.group, groupValue])].sort()
      }));
      
      // Also update the form data to select the newly added group
      handleChange('group', groupValue);
    }
  };

  const handleAddFieldValue = async (value: string) => {
    if (!selectedFieldForAdd) return;
    
    try {
      await apiService.addVariableFieldOption(selectedFieldForAdd.name, value);
      
      // Refresh field options from API
      const apiOptions = await apiService.getVariableFieldOptions() as {
        formatI: string[];
        formatII: string[];
        gType: string[];
        validation: string[];
        default: string[];
      };
      
      // Update dynamic field options
      const existingOptions = getVariableFieldOptions(allData);
      setDynamicFieldOptions({
        ...existingOptions,
        formatI: [...new Set([...existingOptions.formatI, ...(apiOptions.formatI || [])])].sort(),
        formatII: [...new Set([...existingOptions.formatII, ...(apiOptions.formatII || [])])].sort(),
        gType: [...new Set([...existingOptions.gType, ...(apiOptions.gType || [])])].sort(),
        validation: [...new Set([...existingOptions.validation, ...(apiOptions.validation || [])])].sort(),
        default: [...new Set([...existingOptions.default, ...(apiOptions.default || [])])].sort(),
      });
      
      // Also update the form data to select the newly added value
      handleChange(selectedFieldForAdd.name, value);
    } catch (error) {
      throw error;
    }
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

  // Update validation value when formatI changes (for Range type)
  useEffect(() => {
    if (validationComponents.valType === 'Range' && formData.formatI) {
      setValidationComponents(prev => ({
        ...prev,
        value: formData.formatI
      }));
    }
  }, [formData.formatI, validationComponents.valType]);

  // Update validation value when variable name changes (for Relative type)
  useEffect(() => {
    if (validationComponents.valType === 'Relative' && formData.variable) {
      setValidationComponents(prev => ({
        ...prev,
        value: formData.variable
      }));
    }
  }, [formData.variable, validationComponents.valType]);

  if (!isOpen) return null;

  // Get distinct values from data for object relationships
  const getDistinctBeings = (): string[] => {
    // Get distinct beings from objects data + ALL option
    const objectsData = (window as any).objectsData || [];
    const beings = [...new Set(objectsData.map((item: any) => item.being))].filter(Boolean) as string[];
    return ['ALL', ...beings];
  };

  const getDistinctAvatarsForBeing = (being: string) => {
    // Get distinct avatars for the selected being from objects data + ALL option
    const objectsData = (window as any).objectsData || [];
    let avatars: string[] = [];
    
    if (being === 'ALL') {
      avatars = [...new Set(objectsData.map((item: any) => item.avatar))].filter(Boolean) as string[];
    } else {
      avatars = [...new Set(objectsData
        .filter((item: any) => item.being === being)
        .map((item: any) => item.avatar)
      )].filter(Boolean) as string[];
    }
    
    return ['ALL', ...avatars];
  };

  const getDistinctObjectsForBeingAndAvatar = (being: string, avatar: string) => {
    // Get distinct objects for the selected being and avatar from objects data + ALL option
    const objectsData = (window as any).objectsData || [];
    let objects: string[] = [];
    
    if (being === 'ALL' && avatar === 'ALL') {
      objects = [...new Set(objectsData.map((item: any) => item.object))].filter(Boolean) as string[];
    } else if (being === 'ALL') {
      objects = [...new Set(objectsData
        .filter((item: any) => item.avatar === avatar)
        .map((item: any) => item.object)
      )].filter(Boolean) as string[];
    } else if (avatar === 'ALL') {
      objects = [...new Set(objectsData
        .filter((item: any) => item.being === being)
        .map((item: any) => item.object)
      )].filter(Boolean) as string[];
    } else {
      objects = [...new Set(objectsData
        .filter((item: any) => item.being === being && item.avatar === avatar)
        .map((item: any) => item.object)
      )].filter(Boolean) as string[];
    }
    
    return ['ALL', ...objects];
  };

  const handleChange = (key: string, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [key]: value };
      
      // When part changes, clear section and group (sequential dependency)
      if (key === 'part' && value !== prev.part) {
        newData.section = '';
        newData.group = '';
      }
      
      // When section changes, clear group (sequential dependency)
      if (key === 'section' && value !== prev.section) {
        newData.group = '';
      }
      
      return newData;
    });
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

  // Handler for when relationships are saved in the modal
  const handleRelationshipSave = (selectedObjectIds: string[]) => {
    setSelectedObjectRelationships(selectedObjectIds);
  };

  // Validation - all required fields must be filled
  const isFormValid = () => {
    // Required fields: Variable, Part, Section, Group (Ontology), Sector, Domain, Country (Drivers), Format I, Format II (Metadata)
    const hasVariable = formData.variable && formData.variable.trim();
    const hasOntologyFields = formData.part && formData.section && formData.section.trim() && formData.group;
    const hasDriverFields = driverSelections.sector.length > 0 && 
                           driverSelections.domain.length > 0 && 
                           driverSelections.country.length > 0;
    const hasMetadataFields = formData.formatI && formData.formatII;
    
    return hasVariable && hasOntologyFields && hasDriverFields && hasMetadataFields;
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

  const handleVariationsTextChange = (text: string) => {
    setVariationsText(text);
  };

  const handleVariationCsvUpload = (uploadedVariations: any[]) => {
    // Append new variations to textarea
    const existingNames = new Set(variationsText.split('\n').filter(line => line.trim()).map(name => name.toLowerCase()));
    const newVariations = uploadedVariations.filter((variation: any) => 
      !existingNames.has(variation.name.toLowerCase())
    );
    
    if (newVariations.length < uploadedVariations.length) {
      const skippedCount = uploadedVariations.length - newVariations.length;
      alert(`Uploaded ${newVariations.length} new variations. Skipped ${skippedCount} duplicates.`);
    }
    
    const newLines = newVariations.map(v => v.name).join('\n');
    setVariationsText(prev => prev ? `${prev}\n${newLines}` : newLines);
  };

  const handleAddVariable = () => {
    // Debug: Log form data before validation
    console.log('handleAddVariable - formData:', formData);
    
    // Validate required fields with specific error messages
    if (!formData.variable || !formData.variable.trim()) {
      alert('Please enter a Variable name');
      return;
    }
    if (!formData.part) {
      alert('Please select a Part');
      return;
    }
    if (!formData.section || !formData.section.trim()) {
      console.error('Section validation failed - formData.section:', formData.section);
      alert('Please select a Section');
      return;
    }
    if (!formData.group) {
      alert('Please select a Group');
      return;
    }
    if (driverSelections.sector.length === 0) {
      alert('Please select at least one Sector');
      return;
    }
    if (driverSelections.domain.length === 0) {
      alert('Please select at least one Domain');
      return;
    }
    if (driverSelections.country.length === 0) {
      alert('Please select at least one Country');
      return;
    }
    if (!formData.formatI) {
      alert('Please select a Format I');
      return;
    }
    if (!formData.formatII) {
      alert('Please select a Format II');
      return;
    }

    // Generate driver string from selections
    const driverString = concatenateVariableDrivers(
      driverSelections.sector,
      driverSelections.domain,
      driverSelections.country,
      driverSelections.variableClarifier
    );

    // Convert selected object IDs to relationship format
    const objectRelationshipsList = selectedObjectRelationships.map(objectId => {
      const obj = allObjects.find(o => o.id === objectId);
      if (!obj) return null;
      
      // Parse sector, domain, country from driver string
      let sector = '';
      let domain = '';
      let country = '';
      if (obj.driver && obj.driver.trim()) {
        try {
          const parsed = parseDriverField(obj.driver);
          sector = parsed.sector || '';
          domain = parsed.domain || '';
          country = parsed.country || '';
        } catch (error) {
          console.error(`Error parsing driver for object ${objectId}:`, error);
        }
      }
      
      return {
        id: objectId,
        toBeing: obj.being || '',
        toAvatar: obj.avatar || '',
        toObject: obj.object || '',
        toSector: sector,
        toDomain: domain,
        toCountry: country
      };
    }).filter(Boolean) as ObjectRelationship[];

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

    const newVariable = {
      id: Date.now().toString(),
      ...formData,
      validation: validationString,
      driver: driverString,
      objectRelationships: objectRelationshipsList.length,
      status: 'Active',
      objectRelationshipsList: objectRelationshipsList,
      selectedObjectIds: selectedObjectRelationships, // Store IDs for reference
      variationsList: variationsList
    };

    console.log('handleAddVariable - calling onAdd with:', newVariable);
    onAdd(newVariable);
    
    // Reset form
    setFormData({
      part: '',
      section: '',
      group: '',
      variable: '',
      formatI: '',
      formatII: '',
      gType: '',
      validation: '',
      default: '',
      graph: ''
    });
    setValidationComponents({ valType: '', operator: '', value: '' });
    setValidationError('');
    setDriverSelections({
      sector: [],
      domain: [],
      country: [],
      variableClarifier: ''
    });
    setSelectedObjectRelationships([]);
    setVariationsText('');
    
    onClose();
  };

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Multi-select component
  const MultiSelect: React.FC<{
    label: string;
    options: string[];
    values: string[];
    onChange: (values: string[]) => void;
  }> = ({ label, options, values, onChange }) => {
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
          className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent text-left"
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
          <h3 className="text-lg font-semibold text-ag-dark-text">Add</h3>
        </div>
        <button
          onClick={onClose}
          className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Variable Name Field - Outside collapsible sections */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-ag-dark-text mb-2">
          Variable <span className="text-ag-dark-error">*</span>
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
              placeholder="Enter variable name..."
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
              options={driversLoading && driversData.sectors.length === 0 ? ['Loading...'] : ['ALL', ...driversData.sectors]}
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
              options={driversLoading && driversData.domains.length === 0 ? ['Loading...'] : ['ALL', ...driversData.domains]}
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
              options={driversLoading && driversData.countries.length === 0 ? ['Loading...'] : ['ALL', ...driversData.countries]}
              values={driverSelections.country}
              onChange={(values) => handleDriverSelectionChange('country', values)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Variable Clarifier
            </label>
            <select
              value={driverSelections.variableClarifier}
              onChange={(e) => handleDriverSelectionChange('variableClarifier', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
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
              Part <span className="text-ag-dark-error">*</span>
            </label>
            <select
              value={formData.part}
              onChange={(e) => handleChange('part', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Part</option>
              {getDistinctParts().map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-ag-dark-text">
                Section <span className="text-ag-dark-error">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsAddSectionValueModalOpen(true);
                }}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors"
                title="Add new Section value"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.section}
              onChange={(e) => handleChange('section', e.target.value)}
              disabled={!formData.part}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !formData.part ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Section</option>
              {getDistinctSections().map((option) => {
                // Ensure the selected section value is in the options
                if (formData.section && !getDistinctSections().includes(formData.section) && option === formData.section) {
                  console.log('Section value not in options, but formData has it:', formData.section);
                }
                return (
                  <option key={option} value={option}>
                    {option}
                  </option>
                );
              })}
              {/* If formData.section is set but not in the options list, add it */}
              {formData.section && !getDistinctSections().includes(formData.section) && (
                <option key={formData.section} value={formData.section}>
                  {formData.section}
                </option>
              )}
            </select>
          </div>

          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-ag-dark-text">
                  Group <span className="text-ag-dark-error">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddGroupValueModalOpen(true);
                  }}
                  disabled={!formData.part}
                  className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Add new Group value"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <select
                value={formData.group}
                onChange={(e) => handleChange('group', e.target.value)}
                disabled={!formData.part || !formData.section}
                className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                  !formData.part || !formData.section ? 'opacity-50 cursor-not-allowed' : ''
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
            <div className="w-32 flex-shrink-0">
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                G-Type
              </label>
              <select
                value={formData.gType}
                onChange={(e) => handleChange('gType', e.target.value)}
                className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                <option value="">Select</option>
                <option value="L">L</option>
                <option value="T">T</option>
              </select>
            </div>
          </div>

        </div>
      </CollapsibleSection>

      {/* Metadata Section */}
      <CollapsibleSection title="Metadata" sectionKey="metadata" icon={<FileText className="w-4 h-4 text-ag-dark-text-secondary" />}>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-ag-dark-text">
                Format I <span className="text-ag-dark-error">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setSelectedFieldForAdd({ name: 'formatI', label: 'Format I' });
                  setIsAddFieldValueModalOpen(true);
                }}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors"
                title="Add new Format I value"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.formatI}
              onChange={(e) => handleChange('formatI', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
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
                Format II <span className="text-ag-dark-error">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setSelectedFieldForAdd({ name: 'formatII', label: 'Format II' });
                  setIsAddFieldValueModalOpen(true);
                }}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors"
                title="Add new Format II value"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.formatII}
              onChange={(e) => handleChange('formatII', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
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
                Default
              </label>
              <button
                type="button"
                onClick={() => {
                  setSelectedFieldForAdd({ name: 'default', label: 'Default' });
                  setIsAddFieldValueModalOpen(true);
                }}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors"
                title="Add new Default value"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.default}
              onChange={(e) => handleChange('default', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
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
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
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
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
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
                className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                  validationError && validationError.includes('Operator') ? 'border-red-500' : 'border-ag-dark-border'
                }`}
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
                    placeholder="Enter integer"
                    className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                      validationError ? 'border-red-500' : ''
                    }`}
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
                    placeholder="Enter alphanumeric character"
                    className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                      validationError ? 'border-red-500' : ''
                    }`}
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
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCsvUploadOpen(true)}
              className="text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors"
              title="Upload Relationships CSV"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsVariableObjectRelationshipModalOpen(true)}
              className="px-3 py-1.5 text-sm font-medium border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors"
              title="View and manage relationships"
            >
              View Relationships
            </button>
          </div>
        }
      >
        <div className="py-4">
          {selectedObjectRelationships.length === 0 ? (
            <div className="text-center py-6 text-ag-dark-text-secondary">
              <div className="text-sm">No object relationships defined</div>
            </div>
          ) : (
            <div className="text-sm text-ag-dark-text">
              {selectedObjectRelationships.length} object{selectedObjectRelationships.length !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>
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
              className="p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
              title="Sort A-Z"
            >
              <ArrowUpAZ className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleSortVariations('desc')}
              className="p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
              title="Sort Z-A"
            >
              <ArrowDownZA className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsVariationUploadOpen(true)}
              className="text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors"
              title="Upload Variations CSV"
            >
              <Upload className="w-4 h-4" />
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
            handleVariationsTextChange(e.target.value);
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
          placeholder="Type one variation per line. Press Enter to add more."
          rows={8}
          className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent resize-y"
        />
      </CollapsibleSection>

      {/* Add Variable Button */}
      <div className="mt-8 pt-6 border-t border-ag-dark-border">
        <button
          onClick={handleAddVariable}
          disabled={!isFormValid()}
          className={`w-full py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 ${
            isFormValid()
              ? 'bg-ag-dark-accent text-white hover:bg-ag-dark-accent-hover'
              : 'bg-ag-dark-text-secondary text-ag-dark-text-secondary cursor-not-allowed opacity-50'
          }`}
        >
          <Plus className="w-4 h-4" />
          Add Variable
        </button>
      </div>

      {/* Variable-Object Relationship Modal */}
      <VariableObjectRelationshipModal
        isOpen={isVariableObjectRelationshipModalOpen}
        onClose={() => {
          setIsVariableObjectRelationshipModalOpen(false);
          setPendingCsvData(null); // Clear pending CSV data when modal closes
        }}
        selectedVariable={{
          id: 'new-variable-temp-id',
          variable: formData.variable || 'New Variable'
        }}
        allObjects={allObjects}
        previewMode={true}
        onSelectionChange={(selectedObjectIds: string[]) => {
          setSelectedObjectRelationships(selectedObjectIds);
        }}
        initialCsvData={pendingCsvData}
      />

      {/* CSV Upload Modal */}
      <CsvUploadModal
        isOpen={isCsvUploadOpen}
        onClose={() => setIsCsvUploadOpen(false)}
        type="variable-object-relationships"
        onUpload={(data: any[] | File) => {
          // Store CSV data and open the relationship modal
          if (Array.isArray(data)) {
            setPendingCsvData(data);
            setIsCsvUploadOpen(false);
            setIsVariableObjectRelationshipModalOpen(true);
          }
        }}
      />

      {/* Add Section Value Modal */}
      <AddSectionValueModal
        isOpen={isAddSectionValueModalOpen}
        onClose={() => {
          setIsAddSectionValueModalOpen(false);
        }}
        onSave={handleAddSectionValue}
      />

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

      {/* Add Field Value Modal */}
      <AddFieldValueModal
        isOpen={isAddFieldValueModalOpen}
        onClose={() => {
          setIsAddFieldValueModalOpen(false);
          setSelectedFieldForAdd(null);
        }}
        onSave={handleAddFieldValue}
        fieldName={selectedFieldForAdd?.name || ''}
        fieldLabel={selectedFieldForAdd?.label || ''}
      />

      {/* Variations CSV Upload Modal */}
      <CsvUploadModal
        isOpen={isVariationUploadOpen}
        onClose={() => setIsVariationUploadOpen(false)}
        type="variations"
        onUpload={(data: any[] | File) => {
          if (data instanceof File) {
            // For file upload, parse it client-side
            const reader = new FileReader();
            reader.onload = (e) => {
              let csv = e.target?.result as string;
              
              // Remove BOM if present
              if (csv.charCodeAt(0) === 0xFEFF) {
                csv = csv.slice(1);
              }
              
              const lines = csv.split('\n').filter(line => line.trim());
              
              if (lines.length < 2) {
                alert('CSV must contain at least a header row and one data row');
                return;
              }

              // Skip header row and parse data rows
              const dataRows = lines.slice(1);
              const parsedData: any[] = [];

              dataRows.forEach((line, index) => {
                // Try different separators: comma, semicolon, tab
                let values = line.split(',').map(val => val.trim().replace(/"/g, ''));
                if (values.length === 1 && line.includes(';')) {
                  values = line.split(';').map(val => val.trim().replace(/"/g, ''));
                }
                if (values.length === 1 && line.includes('\t')) {
                  values = line.split('\t').map(val => val.trim().replace(/"/g, ''));
                }
                
                if (values.length >= 1 && values[0]) {
                  parsedData.push({
                    id: Date.now().toString() + index,
                    name: values[0]
                  });
                }
              });

              if (parsedData.length > 0) {
                handleVariationCsvUpload(parsedData);
              } else {
                alert('No valid variations found in CSV');
              }
            };
            reader.readAsText(data);
          } else {
            // Handle array of variations
            handleVariationCsvUpload(data);
          }
        }}
      />
    </div>
  );
};