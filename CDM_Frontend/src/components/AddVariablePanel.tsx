import React, { useState, useRef, useEffect } from 'react';
import { Settings, X, Trash2, Plus, Link, Upload, ChevronRight, ChevronDown, Database, Users, FileText, Layers, ArrowUpAZ, ArrowDownZA, Grid3x3 } from 'lucide-react';
import { getVariableFieldOptions, concatenateVariableDrivers } from '../data/variablesData';
import { useDrivers } from '../hooks/useDrivers';
import { CsvUploadModal } from './CsvUploadModal';
import { VariableObjectRelationshipModal } from './VariableObjectRelationshipModal';
import { AddSectionValueModal } from './AddSectionValueModal';
import { AddGroupValueModal } from './AddGroupValueModal';
import { AddFieldValueModal } from './AddFieldValueModal';
import { VariationsModal } from './VariationsModal';
import { useObjects } from '../hooks/useObjects';
import { parseDriverField } from '../data/mockData';
import { buildValidationString, validateValidationInput, getOperatorsForValType, RANGE_GREATER_OPERATORS, RANGE_LESS_OPERATORS, type ValidationComponents, type ValType, type Operator, type RangeOperator } from '../utils/validationUtils';
import { apiService } from '../services/api';
import { getAllFormatIValues, getFormatIIValuesForFormatI, isValidFormatIIForFormatI } from '../utils/formatMapping';

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

  // Driver selections state - default to 'ALL' for sector, domain, and country
  const [driverSelections, setDriverSelections] = useState({
    sector: ['ALL'] as string[],
    domain: ['ALL'] as string[],
    country: ['ALL'] as string[],
    variableClarifier: ''
  });

  // Validation components state - support multiple validations
  const [validationComponentsList, setValidationComponentsList] = useState<ValidationComponents[]>([{
    valType: '',
    operator: '',
    value: ''
  }]);
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
  const [isVariationsModalOpen, setIsVariationsModalOpen] = useState(false);

  // Section input focus management
  const sectionInputRef = useRef<HTMLInputElement>(null);
  const isSectionInputFocusedRef = useRef<boolean>(false);
  const lastSectionChangeTimeRef = useRef<number>(0);

  // Validation value input focus management
  const validationValueInputRef = useRef<HTMLInputElement>(null);
  const isValidationValueInputFocusedRef = useRef<boolean>(false);
  const lastValidationValueChangeTimeRef = useRef<number>(0);
  // Refs for Range validation input
  const rangeValidationInputRef = useRef<HTMLInputElement>(null);
  const isRangeValidationInputFocusedRef = useRef<boolean>(false);
  const lastRangeValidationValueChangeTimeRef = useRef<number>(0);

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
          setFormData(prev => ({ ...prev, section: '' }));
        }
        return;
      }
      setIsLoadingSections(true);
      try {
        const response = await apiService.getVariableSections(formData.part) as { sections: string[] };
        setSectionsList(response.sections || []);
        // Reset section if current section is not in the new list
        if (formData.section && !response.sections.includes(formData.section)) {
          setFormData(prev => ({ ...prev, section: '' }));
        }
      } catch (error) {
        console.error('Error loading sections:', error);
        setSectionsList([]);
        // Reset section on error
        if (formData.section) {
          setFormData(prev => ({ ...prev, section: '' }));
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

  // Get distinct sections filtered by selected Part
  const getDistinctSections = (): string[] => {
    // Only return sections from API (which are already filtered by Part)
    // Don't fallback to all sections - sections must be Part-specific
    return sectionsList;
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

  const handleAddSectionValue = async (part: string, sectionValue: string) => {
    console.log('handleAddSectionValue - adding section:', sectionValue, 'for part:', part);
    
    try {
      // Call API to add the section (creates placeholder variable in Neo4j)
      await apiService.addVariableSection(part, sectionValue);
      
      // Update dynamic field options to include the new section
      setDynamicFieldOptions(prev => {
        const updated = {
          ...prev,
          section: [...new Set([...prev.section, sectionValue])].sort()
        };
        console.log('Updated dynamicFieldOptions.section:', updated.section);
        return updated;
      });
      
      // If the part matches the current form's part, reload sections and select the new one
      if (formData.part === part) {
        // Reload sections from API to include the new one
        try {
          const response = await apiService.getVariableSections(part) as { sections: string[] };
          setSectionsList(response.sections || []);
          // Also update the form data to select the newly added section
          setFormData(prev => {
            const updated = {
              ...prev,
              section: sectionValue
            };
            console.log('Updated formData.section:', updated.section);
            return updated;
          });
        } catch (error) {
          console.error('Error reloading sections:', error);
          // Still update the form data even if API call fails
          setFormData(prev => {
            const updated = {
              ...prev,
              section: sectionValue
            };
            console.log('Updated formData.section:', updated.section);
            return updated;
          });
        }
      }
    } catch (error) {
      console.error('Error adding section:', error);
      alert(`Failed to add section: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error; // Re-throw so modal can handle it
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
      const associations = getPartGroupAssociations();
      if (!associations[part.trim()]) {
        associations[part.trim()] = [];
      }
      if (!associations[part.trim()].includes(groupValue.trim())) {
        associations[part.trim()].push(groupValue.trim());
        associations[part.trim()].sort();
        localStorage.setItem(PART_GROUP_STORAGE_KEY, JSON.stringify(associations));
      }
      
      // Refresh groups for this part if it's currently selected
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

  // Note: Range validation values are now freeform typing fields, not auto-populated from formatI
  // Removed auto-population logic to allow users to type freeform values

  // Relative value is chosen from variable dropdown, not auto-set

  // Reset to defaults when panel opens
  useEffect(() => {
    if (isOpen) {
      // Only reset if all driver selections are empty
      if (driverSelections.sector.length === 0 && 
          driverSelections.domain.length === 0 && 
          driverSelections.country.length === 0) {
        setDriverSelections(prev => ({
          ...prev,
          sector: ['ALL'],
          domain: ['ALL'],
          country: ['ALL']
        }));
      }
    }
  }, [isOpen]);

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
      
      // When Format V-I changes, reset Format V-II if it's not valid for the new Format V-I
      if (key === 'formatI' && value !== prev.formatI) {
        const newFormatI = String(value);
        const currentFormatII = String(newData.formatII || '');
        // If Format V-II is set and not valid for the new Format V-I, clear it
        if (currentFormatII && !isValidFormatIIForFormatI(newFormatI, currentFormatII)) {
          newData.formatII = '';
        }
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

    // Validate all validation components before saving
    for (let i = 0; i < validationComponentsList.length; i++) {
      const comp = validationComponentsList[i];
      if (!comp.valType) continue;
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
        const vg = validateValidationInput('Range', gVal, formData.formatI, formData.formatII);
        if (!vg.isValid) {
          alert(`Invalid Greater than Value for Validation #${i + 1}: ${vg.error}`);
          setValidationError(vg.error || 'Invalid value');
          return;
        }
        const vl = validateValidationInput('Range', lVal, formData.formatI, formData.formatII);
        if (!vl.isValid) {
          alert(`Invalid Less than Value for Validation #${i + 1}: ${vl.error}`);
          setValidationError(vl.error || 'Invalid value');
          return;
        }
      } else {
        const requiresOperator = ['Relative', 'Length'].includes(comp.valType);
        if (requiresOperator && !comp.operator) {
          alert(`Please select an operator for Validation #${i + 1} (${comp.valType}).`);
          setValidationError('Operator is required');
          return;
        }
        const requiresValue = ['Length', 'Character', 'Relative'].includes(comp.valType);
        if (requiresValue && !(comp.value ?? '').trim()) {
          alert(`Please enter or select a value for Validation #${i + 1} (${comp.valType}).`);
          setValidationError('Value is required');
          return;
        }
        if (comp.valType === 'Length' && comp.value.trim()) {
          const v = validateValidationInput('Length', comp.value);
          if (!v.isValid) {
            alert(`Invalid value for Validation #${i + 1}: ${v.error}`);
            setValidationError(v.error || 'Invalid value');
            return;
          }
        }
        if (comp.valType === 'Character' && comp.value.trim()) {
          const v = validateValidationInput('Character', comp.value);
          if (!v.isValid) {
            alert(`Invalid value for Validation #${i + 1}: ${v.error}`);
            setValidationError(v.error || 'Invalid value');
            return;
          }
        }
      }
    }

    // Build validation strings from all components
    const validationStrings = validationComponentsList
      .filter(comp => comp.valType)
      .map(comp => buildValidationString(comp));
    const validationData: Record<string, string> = {};
    if (validationStrings.length > 0) {
      validationData.validation = validationStrings[0];
      for (let i = 1; i < validationStrings.length; i++) {
        validationData[`Validation #${i + 1}`] = validationStrings[i];
      }
    }
    const validationDisplayString = validationStrings.join(', ');

    const newVariable = {
      id: Date.now().toString(),
      ...formData,
      ...validationData,
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
    setValidationComponentsList([{ valType: '', operator: '', value: '' }]);
    setValidationError('');
    setDriverSelections({
      sector: ['ALL'],
      domain: ['ALL'],
      country: ['ALL'],
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
      if (!isOpen) return;

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
          <div 
            className="absolute z-10 w-full mt-1 bg-ag-dark-surface border border-ag-dark-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-ag-dark-text-secondary italic">
                No values found — please add new items in Drivers tab
              </div>
            ) : (
              options.map((option) => {
                // If "ALL" is selected, show all individual options as checked
                const isChecked = option === 'ALL' 
                  ? values.includes('ALL')
                  : values.includes(option) || values.includes('ALL');
                
                return (
                  <label
                    key={option}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-ag-dark-bg cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggle(option)}
                      className="rounded border-ag-dark-border bg-ag-dark-bg text-ag-dark-accent focus:ring-ag-dark-accent focus:ring-2 focus:ring-offset-0"
                    />
                    <span className="text-sm text-ag-dark-text">{option}</span>
                  </label>
                );
              })
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
              disabled={isLoadingParts}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                isLoadingParts ? 'opacity-50 cursor-not-allowed' : ''
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
                Section <span className="text-ag-dark-error">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsAddSectionValueModalOpen(true);
                }}
                disabled={!formData.part}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={formData.part ? "Add new Section value" : "Please select a Part first"}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.section}
              onChange={(e) => handleChange('section', e.target.value)}
              disabled={!formData.part || isLoadingSections}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !formData.part || isLoadingSections ? 'opacity-50 cursor-not-allowed' : ''
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
                disabled={!formData.part || isLoadingGroups}
                className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                  !formData.part || !formData.section || isLoadingGroups ? 'opacity-50 cursor-not-allowed' : ''
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
                className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                <option value="">Select</option>
                <option value="Loose">Loose</option>
                <option value="Tight">Tight</option>
                <option value="T">T</option>
                <option value="Multi">Multi</option>
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
              {getAllFormatIValues().map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Format II <span className="text-ag-dark-error">*</span>
            </label>
            <select
              value={formData.formatII}
              onChange={(e) => handleChange('formatII', e.target.value)}
              disabled={!formData.formatI}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !formData.formatI ? 'opacity-50 cursor-not-allowed' : ''
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
      <CollapsibleSection
        title="Validations"
        sectionKey="validations"
        icon={<Settings className="w-4 h-4 text-ag-dark-text-secondary" />}
        actions={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setValidationComponentsList(prev => [...prev, { valType: '', operator: '', value: '' }]);
            }}
            className="p-1.5 text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors rounded hover:bg-ag-dark-bg"
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
                <h4 className="text-sm font-semibold text-ag-dark-text">Validation #{index + 1}</h4>
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
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">Val Type</label>
                <select
                  value={validationComponents.valType}
                  onChange={(e) => {
                    const newValType = e.target.value as ValType | '';
                    const newComponents: ValidationComponents = { valType: newValType, operator: newValType === 'Character' ? 'is' : '', value: '' };
                    if (newValType === 'List') newComponents.value = 'List';
                    else if (newValType === 'Range') {
                      newComponents.greaterThanOperator = '';
                      newComponents.greaterThanValue = '';
                      newComponents.lessThanOperator = '';
                      newComponents.lessThanValue = '';
                    }
                    setValidationComponentsList(prev => prev.map((comp, i) => i === index ? newComponents : comp));
                    setValidationError('');
                  }}
                  className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent appearance-none"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 12px center', backgroundRepeat: 'no-repeat', backgroundSize: '16px' }}
                >
                  <option value="">Select Val Type</option>
                  <option value="List">List</option>
                  <option value="Range">Range</option>
                  <option value="Relative">Relative</option>
                  <option value="Length">Length</option>
                  <option value="Character">Character</option>
                </select>
              </div>
              {validationComponents.valType && validationComponents.valType !== 'Character' && validationComponents.valType !== 'Range' && getOperatorsForValType(validationComponents.valType).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-ag-dark-text mb-2">Operator</label>
                  <select
                    value={validationComponents.operator}
                    onChange={(e) => { setValidationComponentsList(prev => prev.map((comp, i) => i === index ? { ...comp, operator: e.target.value as Operator } : comp)); setValidationError(''); }}
                    className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent appearance-none ${validationError && validationError.includes('Operator') ? 'border-red-500' : 'border-ag-dark-border'}`}
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 12px center', backgroundRepeat: 'no-repeat', backgroundSize: '16px' }}
                  >
                    <option value="">Select Operator</option>
                    {getOperatorsForValType(validationComponents.valType).map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                  {validationError && validationError.includes('Operator') && <p className="mt-1 text-sm text-red-500">{validationError}</p>}
                </div>
              )}
              {validationComponents.valType === 'Character' && (
                <div>
                  <label className="block text-sm font-medium text-ag-dark-text mb-2">Operator</label>
                  <input type="text" value="is" disabled className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text opacity-50 cursor-not-allowed" />
                </div>
              )}
              {validationComponents.valType === 'Range' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-ag-dark-text mb-2">Greater than Operator</label>
                    <select value={validationComponents.greaterThanOperator ?? ''} onChange={(e) => { setValidationComponentsList(prev => prev.map((comp, i) => i === index ? { ...comp, greaterThanOperator: e.target.value as RangeOperator | '' } : comp)); setValidationError(''); }} className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent appearance-none" style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 12px center', backgroundRepeat: 'no-repeat', backgroundSize: '16px' }}>
                      <option value="">Select</option>
                      {RANGE_GREATER_OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ag-dark-text mb-2">Greater than Value</label>
                    <input type="text" value={validationComponents.greaterThanValue ?? ''} onInput={(e) => { const v = (e.target as HTMLInputElement).value; const res = validateValidationInput('Range', v, formData.formatI, formData.formatII); setValidationError(res.isValid ? '' : (res.error || '')); setValidationComponentsList(prev => prev.map((comp, i) => i === index ? { ...comp, greaterThanValue: v } : comp)); }} placeholder={formData.formatI === 'Time' ? 'e.g. 12/5/2025' : 'Enter value'} className={`w-full px-3 py-2 bg-ag-dark-bg border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent ${validationError && validationError.includes('Value') ? 'border-red-500' : 'border-ag-dark-border'}`} />
                    {validationError && validationError.includes('Value') && <p className="mt-1 text-sm text-red-500">{validationError}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ag-dark-text mb-2">Less than Operator</label>
                    <select value={validationComponents.lessThanOperator ?? ''} onChange={(e) => { setValidationComponentsList(prev => prev.map((comp, i) => i === index ? { ...comp, lessThanOperator: e.target.value as RangeOperator | '' } : comp)); setValidationError(''); }} className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent appearance-none" style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 12px center', backgroundRepeat: 'no-repeat', backgroundSize: '16px' }}>
                      <option value="">Select</option>
                      {RANGE_LESS_OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ag-dark-text mb-2">Less than Value</label>
                    <input type="text" value={validationComponents.lessThanValue ?? ''} onInput={(e) => { const v = (e.target as HTMLInputElement).value; const res = validateValidationInput('Range', v, formData.formatI, formData.formatII); setValidationError(res.isValid ? '' : (res.error || '')); setValidationComponentsList(prev => prev.map((comp, i) => i === index ? { ...comp, lessThanValue: v } : comp)); }} placeholder="e.g. 3/8/2026" className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent ${validationError && validationError.includes('Value') ? 'border-red-500' : ''}`} />
                    {validationError && validationError.includes('Value') && <p className="mt-1 text-sm text-red-500">{validationError}</p>}
                  </div>
                </>
              )}
              {validationComponents.valType && validationComponents.valType !== 'Range' && (
                <div>
                  <label className="block text-sm font-medium text-ag-dark-text mb-2">Value</label>
                  {validationComponents.valType === 'List' ? (
                    <input type="text" value={validationComponents.value} disabled className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text opacity-50 cursor-not-allowed" />
                  ) : validationComponents.valType === 'Relative' ? (
                    <select value={validationComponents.value} onChange={(e) => { setValidationComponentsList(prev => prev.map((comp, i) => i === index ? { ...comp, value: e.target.value } : comp)); setValidationError(''); }} className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent appearance-none" style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 12px center', backgroundRepeat: 'no-repeat', backgroundSize: '16px' }}>
                      <option value="">Select variable</option>
                      {[...new Set((allData || []).map((v: any) => v.variable).filter(Boolean))].sort().map((name: string) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  ) : validationComponents.valType === 'Length' ? (
                    <input type="text" value={validationComponents.value} onChange={(e) => { const v = e.target.value; const res = validateValidationInput('Length', v); setValidationError(res.isValid ? '' : (res.error || '')); setValidationComponentsList(prev => prev.map((comp, i) => i === index ? { ...comp, value: v } : comp)); }} placeholder="Enter integer" className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent ${validationError ? 'border-red-500' : ''}`} />
                  ) : validationComponents.valType === 'Character' ? (
                    <input type="text" value={validationComponents.value} onChange={(e) => { const v = e.target.value; const res = validateValidationInput('Character', v); setValidationError(res.isValid ? '' : (res.error || '')); setValidationComponentsList(prev => prev.map((comp, i) => i === index ? { ...comp, value: v } : comp)); }} placeholder="Alpha, Numeric, AlphaNumeric" className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent ${validationError ? 'border-red-500' : ''}`} />
                  ) : null}
                  {validationError && (validationComponents.valType === 'Length' || validationComponents.valType === 'Character') && <p className="mt-1 text-sm text-red-500">{validationError}</p>}
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
              onClick={() => setIsVariationsModalOpen(true)}
              className="p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
              title="View and manage variations"
            >
              <Grid3x3 className="w-5 h-5" />
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
        availableParts={getDistinctParts()}
        defaultPart={formData.part || ''}
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

      {/* Variations Modal */}
      <VariationsModal
        isOpen={isVariationsModalOpen}
        onClose={() => setIsVariationsModalOpen(false)}
        initialVariationsText={variationsText}
        onVariationsChange={(variations) => {
          // Update variationsText state when variations are changed in modal
          // This will be used when the variable is created
          setVariationsText(variations.join('\n'));
        }}
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