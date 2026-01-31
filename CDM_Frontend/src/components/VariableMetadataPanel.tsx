import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Settings, Save, X, Link, ChevronRight, ChevronDown, Database, Users, FileText, Plus, Network, Info, Copy, Upload, Layers, ArrowUpAZ, ArrowDownZA, Grid3x3, Trash2 } from 'lucide-react';
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
import { VariationsModal } from './VariationsModal';
import { parseValidation, buildValidationString, validateValidationInput, getOperatorsForValType, RANGE_GREATER_OPERATORS, RANGE_LESS_OPERATORS, splitValidationString, type ValidationComponents, type ValType, type Operator, type RangeOperator } from '../utils/validationUtils';
import { LoadingSpinner } from './LoadingSpinner';
import { getAllFormatIValues, getFormatIIValuesForFormatI, isValidFormatIIForFormatI } from '../utils/formatMapping';

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
  objectsOrderSortOrder?: {
    beingOrder: string[];
    avatarOrders: Record<string, string[]>;
    objectOrders: Record<string, string[]>;
  };
  isObjectsOrderEnabled?: boolean;
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
  onObjectsRefresh,
  objectsOrderSortOrder,
  isObjectsOrderEnabled = false
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
    if (!part || !part.trim()) {
      throw new Error('Please select a Part first');
    }
    
    if (!groupValue || !groupValue.trim()) {
      throw new Error('Please enter a Group name');
    }
    
    try {
      // Call backend API to create group
      await apiService.createVariableGroup(part.trim(), groupValue.trim());
      
      // Also save to localStorage for backward compatibility
      savePartGroupAssociation(part.trim(), groupValue.trim());
      
      // Refresh groups for this part
      if (formData.part === part.trim()) {
        try {
          const response = await apiService.getVariableGroups(part.trim()) as { groups: string[] };
          setGroupsList(response.groups || []);
          // Also update the form data to select the newly added group
          handleChange('group', groupValue.trim());
        } catch (error) {
          console.error('Error reloading groups:', error);
          // Still update the form data even if API call fails
          handleChange('group', groupValue.trim());
        }
      }
      
      // Update dynamic field options if the current part is selected
      if (formData.part === part.trim()) {
        setDynamicFieldOptions(prev => ({
          ...prev,
          group: [...new Set([...prev.group, groupValue.trim()])].sort()
        }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create group';
      if (errorMessage.includes('already exists')) {
        throw new Error(`Group '${groupValue}' already exists for Part '${part}'. Please use a different name.`);
      }
      throw error;
    }
  };

  const handleAddSectionValue = async (part: string, sectionValue: string) => {
    try {
      // Call API to add the section (creates placeholder variable in Neo4j)
      await apiService.addVariableSection(part, sectionValue);
      
      // Update dynamic field options to include the new section
      setDynamicFieldOptions(prev => ({
        ...prev,
        section: [...new Set([...prev.section, sectionValue])].sort()
      }));
      
      // If the part matches the current form's part, reload sections and select the new one
      if (formData.part === part) {
        // Reload sections from API to include the new one
        try {
          const response = await apiService.getVariableSections(part) as { sections: string[] };
          setSectionsList(response.sections || []);
          // Also update the form data to select the newly added section
          handleChange('section', sectionValue);
        } catch (error) {
          console.error('Error reloading sections:', error);
          // Still update the form data even if API call fails
          handleChange('section', sectionValue);
        }
      }
    } catch (error) {
      console.error('Error adding section:', error);
      alert(`Failed to add section: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error; // Re-throw so modal can handle it
    }
  };

  // State for cascading dropdowns
  const [partsList, setPartsList] = useState<string[]>([]);
  const [sectionsList, setSectionsList] = useState<string[]>([]);
  const [groupsList, setGroupsList] = useState<string[]>([]);
  const [isLoadingParts, setIsLoadingParts] = useState(false);
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  // Load parts from API on mount
  useEffect(() => {
    const loadParts = async () => {
      setIsLoadingParts(true);
      try {
        const response = await apiService.getVariableParts() as { parts: string[] };
        setPartsList(response.parts || []);
      } catch (error) {
        console.error('Error loading parts:', error);
        // Fallback to local data
        const variablesData = allData.length > 0 ? allData : (window as any).variablesData || [];
        const parts = [...new Set(variablesData.map((item: any) => item.part))].filter(Boolean).sort() as string[];
        setPartsList(parts.length > 0 ? parts : dynamicFieldOptions.part);
      } finally {
        setIsLoadingParts(false);
      }
    };
    loadParts();
  }, []);

  // Load sections when part changes
  useEffect(() => {
    const loadSections = async () => {
      if (!formData.part) {
        setSectionsList([]);
        // Reset section when part is cleared
        if (formData.section) {
          handleChange('section', '');
        }
        return;
      }
      setIsLoadingSections(true);
      try {
        const response = await apiService.getVariableSections(formData.part) as { sections: string[] };
        setSectionsList(response.sections || []);
        // Reset section if current section is not in the new list
        if (formData.section && !response.sections.includes(formData.section)) {
          handleChange('section', '');
        }
      } catch (error) {
        console.error('Error loading sections:', error);
        setSectionsList([]);
        // Reset section on error
        if (formData.section) {
          handleChange('section', '');
        }
      } finally {
        setIsLoadingSections(false);
      }
    };
    loadSections();
  }, [formData.part]);

  // Load groups when part changes (groups are filtered only by part, not by section)
  useEffect(() => {
    const loadGroups = async () => {
      if (!formData.part) {
        setGroupsList([]);
        return;
      }
      setIsLoadingGroups(true);
      try {
        const response = await apiService.getVariableGroups(formData.part) as { groups: string[] };
        setGroupsList(response.groups || []);
      } catch (error) {
        console.error('Error loading groups:', error);
        setGroupsList([]);
      } finally {
        setIsLoadingGroups(false);
      }
    };
    loadGroups();
  }, [formData.part]);

  // Get distinct sections filtered by selected Part
  const getDistinctSections = (): string[] => {
    // Only return sections from API (which are already filtered by Part)
    // Don't fallback to all sections - sections must be Part-specific
    return sectionsList;
  };

  // Get distinct parts from variables data - fallback
  const getDistinctParts = (): string[] => {
    // If we have parts from API, use those
    if (partsList.length > 0) {
      return partsList;
    }
    // Otherwise fallback to local data
    const variablesData = allData.length > 0 ? allData : (window as any).variablesData || [];
    const parts = [...new Set(variablesData.map((item: any) => item.part))].filter(Boolean).sort() as string[];
    return parts.length > 0 ? parts : dynamicFieldOptions.part;
  };

  // Get groups for part - updated to use API data
  const getGroupsForPart = (part: string): string[] => {
    // If we have groups from API (based on part only), use those
    if (groupsList.length > 0 && formData.part === part) {
      return groupsList;
    }
    // Otherwise fallback to local data
    if (!part) return [];
    
    const variablesData = allData.length > 0 ? allData : (window as any).variablesData || [];
    const groupsFromData = [...new Set(
      variablesData
        .filter((item: any) => item.part === part && item.group)
        .map((item: any) => item.group)
    )].filter(Boolean) as string[];
    
    const associations = getPartGroupAssociations();
    const groupsFromStorage = associations[part] || [];
    
    const allGroups = [...new Set([...groupsFromData, ...groupsFromStorage])].sort();
    return allGroups;
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
  
  // Loading state for metadata panel
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  // Update form data when a new variable is selected (not on every field change)
  React.useEffect(() => {
    const currentVariableId = selectedVariable?.id;
    
    // Only reset form data when the selected variable actually changes
    if (currentVariableId && currentVariableId !== prevSelectedVariableId.current) {
      console.log('VariableMetadataPanel: selected variable changed from', prevSelectedVariableId.current, 'to', currentVariableId);
      
      // Set loading state immediately and clear form data
      setIsLoadingMetadata(true);
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
        graph: 'Yes',
        status: 'Active'
      });
      setDriverSelections({
        sector: [],
        domain: [],
        country: [],
        variableClarifier: ''
      });
      setValidationComponentsList([{ valType: '', operator: '', value: '' }]);
      setValidationError('');
      
      prevSelectedVariableId.current = currentVariableId;
      
      // Use setTimeout to allow React to render the loading state first, then populate data
      setTimeout(() => {
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
        // Validation string is comma-separated, so split and parse each one
        const validationString = selectedVariable?.validation || '';
        if (validationString) {
          const validationStrings = splitValidationString(validationString);
          const parsedValidations = validationStrings.map(vs => parseValidation(vs));
          setValidationComponentsList(parsedValidations.length > 0 ? parsedValidations : [{ valType: '', operator: '', value: '' }]);
        } else {
          setValidationComponentsList([{ valType: '', operator: '', value: '' }]);
        }
        setValidationError('');
        
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
        
        // Clear loading state after data is populated
        setIsLoadingMetadata(false);
      }, 0);
    } else if (!currentVariableId) {
      // No variable selected - clear loading state
      setIsLoadingMetadata(false);
    } else if (currentVariableId === prevSelectedVariableId.current) {
      // Same variable, just update driver selections if drivers data changed
      if (selectedVariable?.driver) {
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
    }
  }, [selectedVariable?.id, driversData]); // Reset when variable changes or drivers data loads

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
  const [isVariationsModalOpen, setIsVariationsModalOpen] = useState(false);

  // Validation components state - now supports multiple validations
  const [validationComponentsList, setValidationComponentsList] = useState<ValidationComponents[]>([{
    valType: '',
    operator: '',
    value: ''
  }]);
  const [validationError, setValidationError] = useState<string>('');

  // Section input focus management
  const sectionInputRef = useRef<HTMLInputElement>(null);
  const isSectionInputFocusedRef = useRef<boolean>(false);
  const lastSectionChangeTimeRef = useRef<number>(0);

  // Validation value input focus management
  const validationValueInputRef = useRef<HTMLInputElement>(null);
  const isValidationValueInputFocusedRef = useRef<boolean>(false);
  const lastValidationValueChangeTimeRef = useRef<number>(0);
  // Refs for Range validation inputs (one per validation in the list)
  const rangeValidationInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const isRangeValidationInputFocusedRefs = useRef<Map<number, boolean>>(new Map());
  const lastRangeValidationValueChangeTimeRefs = useRef<Map<number, number>>(new Map());
  const validationComponentsListRef = useRef(validationComponentsList);
  validationComponentsListRef.current = validationComponentsList;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pendingValidationFocusRef = useRef<{ scrollTop: number; inputKey: string; cursorPosition?: number } | null>(null);

  // Restore scroll position and focus after validation input updates (prevents panel jumping and focus loss when typing)
  useEffect(() => {
    const pending = pendingValidationFocusRef.current;
    if (!pending) return;
    pendingValidationFocusRef.current = null;
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = pending.scrollTop;
      const el = document.querySelector(`[data-validation-key="${pending.inputKey}"]`) as HTMLInputElement;
      if (el) {
        el.focus();
        const pos = pending.cursorPosition != null ? Math.min(pending.cursorPosition, el.value.length) : el.value.length;
        el.setSelectionRange(pos, pos);
      }
    });
  }, [validationComponentsList, validationError]);

  // Relative value is now chosen from dropdown (variable names), not auto-set from current variable name

  // Auto-set operator to 'is' for Character type (stable deps)
  const valTypesKey = validationComponentsList.map(c => c.valType).join(',');
  React.useEffect(() => {
    setValidationComponentsList(prev => prev.map(comp => {
      if (comp.valType === 'Character' && comp.operator !== 'is') {
        return { ...comp, operator: 'is' };
      }
      return comp;
    }));
  }, [valTypesKey]);

  // Re-validate Range validation values only when formatI or formatII changes (not on every keystroke, to avoid focus loss in Character/Length inputs)
  useEffect(() => {
    const list = validationComponentsListRef.current;
    list.forEach((comp) => {
      if (comp.valType === 'Range') {
        const gVal = (comp.greaterThanValue ?? '').trim();
        const lVal = (comp.lessThanValue ?? '').trim();
        if (gVal) {
          const v = validateValidationInput('Range', gVal, formData.formatI, formData.formatII);
          if (!v.isValid) setValidationError(v.error || 'Invalid value');
        }
        if (lVal) {
          const v = validateValidationInput('Range', lVal, formData.formatI, formData.formatII);
          if (!v.isValid) setValidationError(v.error || 'Invalid value');
        }
        if (!gVal && !lVal) setValidationError(prev => prev && prev.includes('Value') ? '' : prev);
      }
    });
  }, [formData.formatI, formData.formatII]);

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
      
      // When Format V-I changes, reset Format V-II if it's not valid for the new Format V-I
      if (key === 'formatI' && value !== prev.formatI) {
        console.log(`🟡 Format V-I changed from ${prev.formatI} to ${value}, checking Format V-II validity`);
        const newFormatI = String(value);
        const currentFormatII = String(newData.formatII || '');
        // If Format V-II is set and not valid for the new Format V-I, clear it
        if (currentFormatII && !isValidFormatIIForFormatI(newFormatI, currentFormatII)) {
          console.log(`🟡 Format V-II "${currentFormatII}" is not valid for Format V-I "${newFormatI}", clearing Format V-II`);
          newData.formatII = '';
        }
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

      // Validate all validation components before saving
      for (let i = 0; i < validationComponentsList.length; i++) {
        const comp = validationComponentsList[i];
        if (comp.valType) {
          if (comp.valType === 'Range') {
            const gOp = comp.greaterThanOperator === '>' || comp.greaterThanOperator === '>=';
            const lOp = comp.lessThanOperator === '<' || comp.lessThanOperator === '<=';
            const gVal = (comp.greaterThanValue ?? '').trim();
            const lVal = (comp.lessThanValue ?? '').trim();
            if (!gOp || !gVal) {
              alert(`Please select Greater than Operator and enter Greater than Value for Validation #${i + 1} (Range).`);
              setValidationError('Greater than Operator and Value are required');
              return;
            }
            if (!lOp || !lVal) {
              alert(`Please select Less than Operator and enter Less than Value for Validation #${i + 1} (Range).`);
              setValidationError('Less than Operator and Value are required');
              return;
            }
            const validationG = validateValidationInput('Range', gVal, formData.formatI, formData.formatII);
            if (!validationG.isValid) {
              alert(`Invalid Greater than Value for Validation #${i + 1}: ${validationG.error}`);
              setValidationError(validationG.error || 'Invalid value');
              return;
            }
            const validationL = validateValidationInput('Range', lVal, formData.formatI, formData.formatII);
            if (!validationL.isValid) {
              alert(`Invalid Less than Value for Validation #${i + 1}: ${validationL.error}`);
              setValidationError(validationL.error || 'Invalid value');
              return;
            }
          } else {
            const requiresOperator = ['Relative', 'Length'].includes(comp.valType);
            if (requiresOperator && !comp.operator) {
              alert(`Please select an operator for Validation #${i + 1}.`);
              setValidationError('Operator is required');
              return;
            }
            const requiresValue = ['Length', 'Character', 'Relative'].includes(comp.valType);
            if (requiresValue && !(comp.value ?? '').trim()) {
              alert(`Please enter or select a value for Validation #${i + 1}.`);
              setValidationError('Value is required');
              return;
            }
            if (comp.valType === 'Length' && comp.value.trim()) {
              const validation = validateValidationInput('Length', comp.value);
              if (!validation.isValid) {
                alert(`Invalid value for Validation #${i + 1}: ${validation.error}`);
                setValidationError(validation.error || 'Invalid value');
                return;
              }
            }
            if (comp.valType === 'Character' && comp.value.trim()) {
              const validation = validateValidationInput('Character', comp.value);
              if (!validation.isValid) {
                alert(`Invalid value for Validation #${i + 1}: ${validation.error}`);
                setValidationError(validation.error || 'Invalid value');
                return;
              }
            }
          }
        }
      }

      // Build validation strings from all components
      const validationStrings = validationComponentsList
        .filter(comp => comp.valType) // Only include validations with a valType
        .map(comp => buildValidationString(
          comp,
          formData.variable, // variable name for Relative type
          formData.formatI  // formatI for Range type
        ));

      // First validation goes to 'validation' property, rest go to 'Validation #2', 'Validation #3', etc.
      const validationData: Record<string, string> = {};
      if (validationStrings.length > 0) {
        // Store first validation in 'validation' property for Neo4j
        validationData.validation = validationStrings[0];
        // Store additional validations in 'Validation #2', 'Validation #3', etc.
        for (let i = 1; i < validationStrings.length; i++) {
          validationData[`Validation #${i + 1}`] = validationStrings[i];
        }
      }

      // Build comma-separated string for display in grid
      const validationDisplayString = validationStrings.join(', ');

      // Cascading validation: Part -> Section -> Group
      // If part is changed, section and group must be selected
      // If section is changed, group must be selected
      const originalPart = selectedVariable?.part || '';
      const originalSection = selectedVariable?.section || '';
      
      // Check if part was changed
      if (formData.part && formData.part !== originalPart) {
        if (!formData.section) {
          alert('Error: When changing Part, you must also select a Section.');
          return;
        }
        if (!formData.group) {
          alert('Error: When changing Part, you must also select a Group.');
          return;
        }
      }
      
      // Check if section was changed
      if (formData.section && formData.section !== originalSection) {
        if (!formData.group) {
          alert('Error: When changing Section, you must also select a Group.');
          return;
        }
      }
      
      // If part is selected but section or group is missing, show error
      if (formData.part && (!formData.section || !formData.group)) {
        if (!formData.section) {
          alert('Error: When Part is selected, Section is required.');
          return;
        }
        if (!formData.group) {
          alert('Error: When Part and Section are selected, Group is required.');
          return;
        }
      }

      const saveData = {
        ...formData,
        driver: driverString,
        // Send comma-separated string for grid display, but backend will also get individual properties
        validation: validationDisplayString,
        // Spread individual validation properties for backend Neo4j storage
        // Note: This will overwrite 'validation' with just the first validation string,
        // but the backend will combine them when reading, so the grid will show the comma-separated version
        ...validationData,
        variationsList: variationsList
      };

      console.log('VariableMetadataPanel - saveData being sent:', saveData);
      console.log('VariableMetadataPanel - part in saveData:', saveData.part);
      console.log('VariableMetadataPanel - group in saveData:', saveData.group);
      console.log('VariableMetadataPanel - validationData:', validationData);
      console.log('VariableMetadataPanel - validationStrings:', validationStrings);
      console.log('VariableMetadataPanel - validationDisplayString:', validationDisplayString);
      // Log all keys in saveData to see if Validation #2, etc. are included
      console.log('VariableMetadataPanel - saveData keys:', Object.keys(saveData));
      console.log('VariableMetadataPanel - Validation properties in saveData:', 
        Object.keys(saveData).filter(k => k.startsWith('Validation')));

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

      // Use mousedown instead of click to avoid conflicts with button click
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      // Use a small delay to ensure the click event that opened the dropdown has finished
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);

      return () => {
        clearTimeout(timeoutId);
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
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
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
          <div 
            className="absolute z-10 w-full mt-1 bg-ag-dark-surface border border-ag-dark-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
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
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6">
      {/* Loading Indicator */}
      {isLoadingMetadata ? (
        <LoadingSpinner message="Loading variable metadata..." />
      ) : (
        <>
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
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              disabled={!isPanelEnabled || isLoadingParts}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !isPanelEnabled || isLoadingParts ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Part</option>
              {isLoadingParts ? (
                <option value="">Loading...</option>
              ) : (
                getDistinctParts().map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))
              )}
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
                disabled={!isPanelEnabled || !formData.part}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={formData.part ? "Add new Section value" : "Please select a Part first"}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.section}
              onChange={(e) => handleChange('section', e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              disabled={!isPanelEnabled || !formData.part || isLoadingSections}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !isPanelEnabled || !formData.part || isLoadingSections ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Section</option>
              {isLoadingSections ? (
                <option value="">Loading...</option>
              ) : (
                getDistinctSections().map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex gap-4 items-end">
            <div className="flex-1">
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
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                disabled={!isPanelEnabled || !formData.part || isLoadingGroups}
                className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                  !isPanelEnabled || !formData.part || !formData.section || isLoadingGroups ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                <option value="">Select Group</option>
                {isLoadingGroups ? (
                  <option value="">Loading...</option>
                ) : formData.part && formData.section ? (
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
                <option value="">Select</option>
                <option value="L">L</option>
                <option value="T">T</option>
              </select>
            </div>
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
              {getAllFormatIValues().map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Format II
            </label>
            <select
              value={formData.formatII}
              onChange={(e) => handleChange('formatII', e.target.value)}
              disabled={!isPanelEnabled || !formData.formatI}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !isPanelEnabled || !formData.formatI ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Select Format II</option>
              {formData.formatI ? getFormatIIValuesForFormatI(formData.formatI).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              )) : null}
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
      <CollapsibleSection 
        title="Validations" 
        sectionKey="validations" 
        icon={<Settings className="w-4 h-4 text-ag-dark-text-secondary" />}
        actions={
          <button
            onClick={(e) => {
              e.stopPropagation();
              setValidationComponentsList(prev => [...prev, { valType: '', operator: '', value: '' }]);
            }}
            disabled={!isPanelEnabled}
            className="p-1.5 text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors rounded hover:bg-ag-dark-bg disabled:opacity-50 disabled:cursor-not-allowed"
            title="Add another validation"
          >
            <Plus className="w-5 h-5" />
          </button>
        }
      >
        <div className="space-y-6">
          {validationComponentsList.map((validationComponents, index) => (
            <div key={index} className="space-y-4 border-b border-ag-dark-border pb-4 last:border-b-0 last:pb-0">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-ag-dark-text">
                  Validation #{index + 1}
                </h4>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setValidationComponentsList(prev => {
                      const next = prev.filter((_, i) => i !== index);
                      return next.length > 0 ? next : [{ valType: '', operator: '', value: '' }];
                    });
                    setValidationError('');
                  }}
                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
                  title="Remove this validation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

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
                      operator: newValType === 'Character' ? 'is' : '',
                      value: ''
                    };
                    if (newValType === 'List') {
                      newComponents.value = 'List';
                    } else if (newValType === 'Range') {
                      newComponents.greaterThanOperator = '';
                      newComponents.greaterThanValue = '';
                      newComponents.lessThanOperator = '';
                      newComponents.lessThanValue = '';
                    }
                    // Relative: value is chosen from variable dropdown, leave empty
                    setValidationComponentsList(prev => prev.map((comp, i) => i === index ? newComponents : comp));
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

              {/* Operator Dropdown - Hidden for Character (always 'is') and Range (uses Greater/Less operators) */}
              {validationComponents.valType && validationComponents.valType !== 'Character' && validationComponents.valType !== 'Range' && getOperatorsForValType(validationComponents.valType).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-ag-dark-text mb-2">
                    Operator
                  </label>
                  <select
                    value={validationComponents.operator}
                    onChange={(e) => {
                      setValidationComponentsList(prev => prev.map((comp, i) => 
                        i === index ? { ...comp, operator: e.target.value as Operator } : comp
                      ));
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

              {validationComponents.valType === 'Character' && (
                <div>
                  <label className="block text-sm font-medium text-ag-dark-text mb-2">
                    Operator
                  </label>
                  <input
                    type="text"
                    value="is"
                    disabled
                    className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text opacity-50 cursor-not-allowed"
                  />
                </div>
              )}

              {/* Range: Greater than Operator + Value, Less than Operator + Value */}
              {validationComponents.valType === 'Range' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-ag-dark-text mb-2">
                      Greater than Operator
                    </label>
                    <select
                      value={validationComponents.greaterThanOperator ?? ''}
                      onChange={(e) => {
                        setValidationComponentsList(prev => prev.map((comp, i) =>
                          i === index ? { ...comp, greaterThanOperator: e.target.value as RangeOperator | '' } : comp
                        ));
                        setValidationError('');
                      }}
                      disabled={!isPanelEnabled}
                      className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 12px center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '16px'
                      }}
                    >
                      <option value="">Select</option>
                      {RANGE_GREATER_OPERATORS.map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ag-dark-text mb-2">
                      Greater than Value
                    </label>
                    <input
                      ref={(el) => {
                        if (el) rangeValidationInputRefs.current.set(index, el);
                        else rangeValidationInputRefs.current.delete(index);
                      }}
                      data-validation-key={`validation-${index}-range-greater`}
                      type="text"
                      value={validationComponents.greaterThanValue ?? ''}
                      onInput={(e) => {
                        const input = e.target as HTMLInputElement;
                        const newValue = input.value;
                        const cursorPosition = (input.selectionStart ?? 0);
                        pendingValidationFocusRef.current = { scrollTop: scrollContainerRef.current?.scrollTop ?? 0, inputKey: `validation-${index}-range-greater`, cursorPosition };
                        lastRangeValidationValueChangeTimeRefs.current.set(index, Date.now());
                        const validation = validateValidationInput('Range', newValue, formData.formatI, formData.formatII);
                        setValidationError(validation.isValid ? '' : (validation.error || ''));
                        setValidationComponentsList(prev => prev.map((comp, i) =>
                          i === index ? { ...comp, greaterThanValue: newValue } : comp
                        ));
                      }}
                      onChange={() => {}}
                      disabled={!isPanelEnabled}
                      placeholder={formData.formatI === 'Time' ? 'e.g. 12/5/2025' : formData.formatI === 'Number' && formData.formatII ? (formData.formatII === 'Integer' ? 'e.g. 42' : formData.formatII === 'Decimal' ? 'e.g. 3.14' : formData.formatII === 'Percentage' ? 'e.g. 50%' : 'Enter value') : 'Enter value'}
                      className={`w-full px-3 py-2 bg-ag-dark-bg border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${validationError && validationError.includes('Value') ? 'border-red-500' : 'border-ag-dark-border'} ${!isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    {validationError && validationError.includes('Value') && (
                      <p className="mt-1 text-sm text-red-500">{validationError}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ag-dark-text mb-2">
                      Less than Operator
                    </label>
                    <select
                      value={validationComponents.lessThanOperator ?? ''}
                      onChange={(e) => {
                        setValidationComponentsList(prev => prev.map((comp, i) =>
                          i === index ? { ...comp, lessThanOperator: e.target.value as RangeOperator | '' } : comp
                        ));
                        setValidationError('');
                      }}
                      disabled={!isPanelEnabled}
                      className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 12px center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '16px'
                      }}
                    >
                      <option value="">Select</option>
                      {RANGE_LESS_OPERATORS.map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ag-dark-text mb-2">
                      Less than Value
                    </label>
                    <input
                      data-validation-key={`validation-${index}-range-less`}
                      type="text"
                      value={validationComponents.lessThanValue ?? ''}
                      onInput={(e) => {
                        const input = e.target as HTMLInputElement;
                        const newValue = input.value;
                        const cursorPosition = (input.selectionStart ?? 0);
                        pendingValidationFocusRef.current = { scrollTop: scrollContainerRef.current?.scrollTop ?? 0, inputKey: `validation-${index}-range-less`, cursorPosition };
                        const validation = validateValidationInput('Range', newValue, formData.formatI, formData.formatII);
                        setValidationError(validation.isValid ? '' : (validation.error || ''));
                        setValidationComponentsList(prev => prev.map((comp, i) =>
                          i === index ? { ...comp, lessThanValue: newValue } : comp
                        ));
                      }}
                      onChange={() => {}}
                      disabled={!isPanelEnabled}
                      placeholder={formData.formatI === 'Time' ? 'e.g. 3/8/2026' : 'Enter value'}
                      className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${validationError && validationError.includes('Value') ? 'border-red-500' : ''} ${!isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    {validationError && validationError.includes('Value') && (
                      <p className="mt-1 text-sm text-red-500">{validationError}</p>
                    )}
                  </div>
                </>
              )}

              {/* Value Field - for List, Relative (variable dropdown), Length, Character */}
              {validationComponents.valType && validationComponents.valType !== 'Range' && (
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
                  ) : validationComponents.valType === 'Relative' ? (
                    <select
                      value={validationComponents.value}
                      onChange={(e) => {
                        setValidationComponentsList(prev => prev.map((comp, i) =>
                          i === index ? { ...comp, value: e.target.value } : comp
                        ));
                        setValidationError('');
                      }}
                      disabled={!isPanelEnabled}
                      className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 12px center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '16px'
                      }}
                    >
                      <option value="">Select variable</option>
                      {[...new Set((allData || []).map((v: any) => v.variable).filter(Boolean))].sort().map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  ) : validationComponents.valType === 'Length' ? (
                    <div>
                      <input
                        data-validation-key={`validation-${index}-length-value`}
                        type="text"
                        value={validationComponents.value}
                        onChange={(e) => {
                          e.stopPropagation();
                          const input = e.target as HTMLInputElement;
                          const newValue = input.value;
                          const cursorPosition = input.selectionStart ?? newValue.length;
                          pendingValidationFocusRef.current = { scrollTop: scrollContainerRef.current?.scrollTop ?? 0, inputKey: `validation-${index}-length-value`, cursorPosition };
                          const validation = validateValidationInput('Length', newValue);
                          setValidationError(validation.isValid ? '' : (validation.error || ''));
                          setValidationComponentsList(prev => prev.map((comp, i) => 
                            i === index ? { ...comp, value: newValue } : comp
                          ));
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
                        data-validation-key={`validation-${index}-character-value`}
                        type="text"
                        value={validationComponents.value}
                        onChange={(e) => {
                          e.stopPropagation();
                          const input = e.target as HTMLInputElement;
                          const newValue = input.value;
                          const cursorPosition = input.selectionStart ?? newValue.length;
                          pendingValidationFocusRef.current = { scrollTop: scrollContainerRef.current?.scrollTop ?? 0, inputKey: `validation-${index}-character-value`, cursorPosition };
                          const validation = validateValidationInput('Character', newValue);
                          setValidationError(validation.isValid ? '' : (validation.error || ''));
                          setValidationComponentsList(prev => prev.map((comp, i) => 
                            i === index ? { ...comp, value: newValue } : comp
                          ));
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
          ))}
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
              onClick={() => setIsVariationsModalOpen(true)}
              disabled={!isPanelEnabled || selectedCount > 1}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                !isPanelEnabled || selectedCount > 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title={
                selectedCount > 1 
                  ? "Please select a single variable to view variations" 
                  : "View and manage variations"
              }
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsVariationsGraphModalOpen(true)}
              disabled={!isPanelEnabled || !selectedVariable?.id || (selectedVariable?._isCloned && !selectedVariable?._isSaved) || selectedCount > 1}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                !isPanelEnabled || !selectedVariable?.id || (selectedVariable?._isCloned && !selectedVariable?._isSaved) || selectedCount > 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title={
                selectedVariable?._isCloned && !selectedVariable?._isSaved 
                  ? "Please save the cloned variable before viewing variations graph" 
                  : selectedCount > 1 
                    ? "View variations graph (bulk edit not yet supported)" 
                    : "View variations graph"
              }
            >
              <Network className="w-5 h-5" />
            </button>
          </div>
        }
      >
        {/* Variations display removed - use the grid icon button to view variations in the modal */}
        <div className="mb-6">
          <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
            <div className="text-sm text-ag-dark-text-secondary">
              <span className="font-medium">Variations management:</span> Click the grid icon above to view and manage variations.
            </div>
          </div>
        </div>
      </CollapsibleSection>
        </>
      )}

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
        objectsOrderSortOrder={objectsOrderSortOrder}
        isObjectsOrderEnabled={isObjectsOrderEnabled}
      />

      {/* CSV Upload Modal removed - moved to VariableObjectRelationshipModal */}

      {/* Variations Modal */}
      {selectedVariable && (
        <VariationsModal
          isOpen={isVariationsModalOpen}
          onClose={() => setIsVariationsModalOpen(false)}
          selectedVariable={selectedVariable}
          initialVariationsText={variationsText}
          onSave={async () => {
            // Refresh variations after saving
            if (selectedVariable?.id && !selectedVariable?._isCloned) {
              try {
                const variationData = await apiService.getVariableVariations(selectedVariable.id);
                const variationsList = variationData?.variationsList || [];
                const variationsTextContent = variationsList.map((v: any) => v.name).join('\n');
                setVariationsText(variationsTextContent);
                // Update selectedVariable's variationsList for display
                if (selectedVariable) {
                  selectedVariable.variationsList = variationsList;
                }
              } catch (error) {
                console.error('Failed to refresh variations after save:', error);
              }
            }
            // Trigger a data refresh by calling onSave with empty data (just to trigger refresh)
            // The actual variations were already saved by the modal
            if (onSave) {
              // Call onSave to trigger parent refresh, but variations are already saved
              await onSave({});
            }
          }}
          onVariationsChange={(variations) => {
            // For cloned unsaved variables, store variations in the variable data
            if (selectedVariable?._isCloned && !selectedVariable?._isSaved) {
              const variationsList = variations.map(name => ({ id: Date.now().toString(), name }));
              // Update the selectedVariable's variationsList
              if (selectedVariable) {
                selectedVariable.variationsList = variationsList;
              }
              // Also update variationsText for display
              setVariationsText(variations.join('\n'));
            }
          }}
        />
      )}

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
        availableParts={getDistinctParts()}
        defaultPart={formData.part || ''}
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