import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Settings, Save, X, Trash2, Plus, Link, Layers, Upload, ChevronRight, ChevronDown, Database, Users, Key, Network, Copy, ArrowUpAZ, ArrowDownZA, Grid3x3 } from 'lucide-react';
import { getDriversData, concatenateDrivers, parseDriverField } from '../data/mockData';
import { CsvUploadModal } from './CsvUploadModal';
import { VariableObjectRelationshipModal } from './VariableObjectRelationshipModal';
import { AddSectionValueModal } from './AddSectionValueModal';
import { AddFieldValueModal } from './AddFieldValueModal';
import { useObjects } from '../hooks/useObjects';
import { OntologyModal } from './OntologyModal';
import { CloneVariableRelationshipsModal } from './CloneVariableRelationshipsModal';
import { VariationsModal } from './VariationsModal';
import { buildValidationString, validateValidationInput, getOperatorsForValType, type ValidationComponents, type ValType, type Operator } from '../utils/validationUtils';
import { apiService } from '../services/api';
import { getAllFormatIValues, getFormatIIValuesForFormatI, isValidFormatIIForFormatI } from '../utils/formatMapping';

interface ObjectRelationship {
  id: string;
  to_being: string;
  to_avatar: string;
  to_object: string;
}

interface BulkEditVariablesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Record<string, any>) => void;
  selectedCount: number;
  allData?: any[];
  objectsData?: any[];
  selectedVariableIds?: string[]; // IDs of selected variables for bulk ontology views
  selectedVariableNames?: string[]; // Names of selected variables for bulk ontology views (fallback)
}

export const BulkEditVariablesPanel: React.FC<BulkEditVariablesPanelProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedCount,
  allData = [],
  objectsData = [],
  selectedVariableIds,
  selectedVariableNames
}) => {
  // Basic form data for variables
  const [formData, setFormData] = useState({
    part: '',
    section: '',
    group: '',
    variable: ''
  });

  // Driver selections state
  const [driverSelections, setDriverSelections] = useState({
    sector: [] as string[],
    domain: [] as string[],
    country: [] as string[],
    variableClarifier: ''
  });

  // Metadata fields
  const [metadata, setMetadata] = useState({
    formatI: '',
    formatII: '',
    gType: '',
    validation: '',
    default: '',
    graph: ''
  });

  // Validation components state for bulk edit - now supports multiple entries
  const [validationComponentsList, setValidationComponentsList] = useState<ValidationComponents[]>([{
    valType: '',
    operator: '',
    value: ''
  }]);
  const [validationError, setValidationError] = useState<string>('');

  const driversData = getDriversData();

  // Object relationships - store selected object IDs from modal
  const [selectedObjectRelationships, setSelectedObjectRelationships] = useState<string[]>([]);
  
  // Modal state for object relationships
  const [isVariableObjectRelationshipModalOpen, setIsVariableObjectRelationshipModalOpen] = useState(false);
  const [pendingCsvData, setPendingCsvData] = useState<any[] | null>(null);
  const [isCloneVariableRelationshipsModalOpen, setIsCloneVariableRelationshipsModalOpen] = useState(false);
  
  // Modal state for add section value
  const [isAddSectionValueModalOpen, setIsAddSectionValueModalOpen] = useState(false);
  
  // Modal state for add field value (Format I, Format II, G-Type, Default)
  const [isAddFieldValueModalOpen, setIsAddFieldValueModalOpen] = useState(false);
  const [selectedFieldForAdd, setSelectedFieldForAdd] = useState<{ name: string; label: string } | null>(null);
  
  // Confirmation dialog state
  const [showOverrideConfirmation, setShowOverrideConfirmation] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<any>(null);

  // Refs for Range validation inputs (one per validation in the list)
  const rangeValidationInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const isRangeValidationInputFocusedRefs = useRef<Map<number, boolean>>(new Map());
  const lastRangeValidationValueChangeTimeRefs = useRef<Map<number, number>>(new Map());

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

  // Get selected variable IDs/names for bulk ontology views
  // Prefer passed props, otherwise derive from allData if we can determine selection
  const getSelectedVariableIds = (): string[] | undefined => {
    if (selectedVariableIds && selectedVariableIds.length > 0) {
      return selectedVariableIds;
    }
    // If not provided, return undefined - bulk mode will need IDs from parent
    return undefined;
  };

  const getSelectedVariableNames = (): string[] | undefined => {
    if (selectedVariableNames && selectedVariableNames.length > 0) {
      return selectedVariableNames;
    }
    // If IDs not available and names not provided, try to derive from allData
    // But this is tricky without knowing which are selected, so return undefined
    return undefined;
  };

  const hasSelectedVariables = selectedCount > 0 && (getSelectedVariableIds() || getSelectedVariableNames());
  
  // Get selected variables for clone modal
  const selectedVariables = useMemo(() => {
    if (!selectedVariableIds || selectedVariableIds.length === 0) return [];
    return allData.filter(v => selectedVariableIds.includes(v.id));
  }, [selectedVariableIds, allData]);

  // Check if all selected variables have no object relationships
  const hasExistingRelationships = useMemo(() => {
    if (selectedVariables.length === 0) return false;
    return selectedVariables.some(v => (v.objectRelationships || 0) > 0);
  }, [selectedVariables]);

  // Get list of variables with relationships for error message
  const variablesWithRelationships = useMemo(() => {
    return selectedVariables
      .filter(v => (v.objectRelationships || 0) > 0)
      .map(v => v.variable)
      .filter(Boolean);
  }, [selectedVariables]);
  
  // Get objects data - use hook if not provided as prop
  const { objects: objectsFromHook } = useObjects();
  const allObjects = objectsData && objectsData.length > 0 ? objectsData : objectsFromHook;
  
  // Variations - using string for multiline input
  const [variationsText, setVariationsText] = useState('');
  const variationsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isTextareaFocusedRef = useRef<boolean>(false);
  const lastChangeTimeRef = useRef<number>(0);
  const [isVariationUploadOpen, setIsVariationUploadOpen] = useState(false);
  const [isVariationsGraphModalOpen, setIsVariationsGraphModalOpen] = useState(false);
  const [isVariationsModalOpen, setIsVariationsModalOpen] = useState(false);

  // Section input focus management
  const sectionInputRef = useRef<HTMLInputElement>(null);
  const isSectionInputFocusedRef = useRef<boolean>(false);
  const lastSectionChangeTimeRef = useRef<number>(0);

  // Validation value input focus management
  // Note: Removed validationValueInputRef, isValidationValueInputFocusedRef, lastValidationValueChangeTimeRef
  // as they're no longer needed with the multi-entry validation system

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    drivers: false,
    ontology: false,
    metadata: false,
    validations: false,
    relationships: false,
    variations: false
  });

  if (!isOpen) return null;

  // Get distinct values from data for relationships
  const getDistinctBeings = () => {
    const beings = [...new Set(objectsData.map(item => item.being))];
    return ['ALL', ...beings];
  };

  const getDistinctAvatarsForBeing = (being: string) => {
    if (being === 'ALL') return ['ALL'];
    const avatars = [...new Set(objectsData.filter(item => item.being === being).map(item => item.avatar))];
    return ['ALL', ...avatars];
  };

  const getDistinctObjectsForBeingAndAvatar = (being: string, avatar: string) => {
    if (being === 'ALL' || avatar === 'ALL') return ['ALL'];
    const objects = [...new Set(objectsData.filter(item => 
      item.being === being && item.avatar === avatar
    ).map(item => item.object))];
    return ['ALL', ...objects];
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
        const parts = [...new Set(allData.map(item => item.part))];
        setPartsList(parts);
      } finally {
        setIsLoadingParts(false);
      }
    };
    loadParts();
  }, []);

  // Load sections when part changes
  useEffect(() => {
    const loadSections = async () => {
      if (!formData.part || formData.part === 'Keep Current Part') {
        setSectionsList([]);
        // Reset section when part is cleared or set to "Keep Current Part"
        if (formData.section && formData.section !== 'Keep Current Section') {
          handleChange('section', 'Keep Current Section');
        }
        return;
      }
      setIsLoadingSections(true);
      try {
        const response = await apiService.getVariableSections(formData.part) as { sections: string[] };
        setSectionsList(response.sections || []);
        // Reset section if current section is not in the new list and not "Keep Current Section"
        if (formData.section && formData.section !== 'Keep Current Section' && !response.sections.includes(formData.section)) {
          handleChange('section', 'Keep Current Section');
        }
      } catch (error) {
        console.error('Error loading sections:', error);
        setSectionsList([]);
        // Reset section on error
        if (formData.section && formData.section !== 'Keep Current Section') {
          handleChange('section', 'Keep Current Section');
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
      if (!formData.part || formData.part === 'Keep Current Part') {
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

  // Get distinct parts and groups from variables data
  const getDistinctParts = () => {
    // If we have parts from API, use those
    const parts = partsList.length > 0 ? partsList : [...new Set(allData.map(item => item.part))];
    return ['Keep Current Part', ...parts];
  };

  // Get part-group associations from localStorage
  const getPartGroupAssociations = (): Record<string, string[]> => {
    try {
      const stored = localStorage.getItem('cdm_variable_part_group_associations');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error reading part-group associations:', error);
    }
    return {};
  };

  // Get groups for a specific part
  const getGroupsForPart = (part: string): string[] => {
    if (!part || part === 'Keep Current Part') return [];
    
    // If we have groups from API (based on part only), use those
    if (groupsList.length > 0 && formData.part === part) {
      return groupsList;
    }
    
    // Otherwise fallback to local data
    const groupsFromData = [...new Set(
      allData
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

  const getDistinctGroups = () => {
    // If a part is selected, return groups for that part only
    if (formData.part && formData.part !== 'Keep Current Part') {
      const groupsForPart = getGroupsForPart(formData.part);
      return ['Keep Current Group', ...groupsForPart];
    }
    
    // Otherwise, return all groups
    const groups = [...new Set(allData.map(item => item.group))];
    return ['Keep Current Group', ...groups];
  };

  const getDistinctSections = () => {
    // Only return sections from API (which are already filtered by Part)
    // Don't fallback to all sections - sections must be Part-specific
    return ['Keep Current Section', ...sectionsList.sort()];
  };

  const handleAddSectionValue = async (part: string, sectionValue: string) => {
    try {
      // Call API to add the section (creates placeholder variable in Neo4j)
      await apiService.addVariableSection(part, sectionValue);
      
      // If the part matches the current form's part, reload sections and select the new one
      if (formData.part === part || formData.part === 'Keep Current Part') {
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

  const getDistinctVariables = () => {
    const variables = [...new Set(allData.map(item => item.variable))];
    return ['Keep Current Variable', ...variables];
  };


  const getDistinctValidation = () => {
    const validationValues = [...new Set(allData.map(item => item.validation).filter(val => val && val.trim() !== ''))];
    return ['Keep Current Validation', ...validationValues];
  };

  const getDistinctGraph = () => {
    const graphValues = [...new Set(allData.map(item => item.graph).filter(val => val && val.trim() !== ''))];
    return ['Keep Current Graph', ...graphValues];
  };

  // State to track field options from API (for Format I, Format II, G-Type, Default)
  const [fieldOptions, setFieldOptions] = useState<{
    formatI: string[];
    formatII: string[];
    gType: string[];
    default: string[];
  }>({
    formatI: [],
    formatII: [],
    gType: [],
    default: []
  });

  // Fetch field options from API on mount
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
        setFieldOptions({
          formatI: apiOptions.formatI || [],
          formatII: apiOptions.formatII || [],
          gType: apiOptions.gType || [],
          default: apiOptions.default || []
        });
      } catch (error) {
        console.error('Error fetching field options:', error);
      }
    };
    fetchFieldOptions();
  }, []);

  const getDistinctGType = () => {
    const gTypeValuesFromData = [...new Set(allData.map(item => item.gType).filter(val => val && val.trim() !== ''))];
    const allGTypes = [...new Set([...gTypeValuesFromData, ...fieldOptions.gType])];
    return ['Keep Current G-Type', ...allGTypes.sort()];
  };

  const getDistinctDefault = () => {
    const defaultValuesFromData = [...new Set(allData.map(item => item.default).filter(val => val && val.trim() !== ''))];
    const allDefaults = [...new Set([...defaultValuesFromData, ...fieldOptions.default])];
    return ['Keep Current Default', ...allDefaults.sort()];
  };

  const getDistinctFormatI = () => {
    // Use the predefined Format V-I values from the mapping
    return ['Keep Current Format I', ...getAllFormatIValues()];
  };

  const getDistinctFormatII = () => {
    // Filter Format V-II values based on selected Format V-I
    if (!metadata.formatI || metadata.formatI === 'Keep Current Format I') {
      return ['Keep Current Format II'];
    }
    return ['Keep Current Format II', ...getFormatIIValuesForFormatI(metadata.formatI)];
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
      
      // Update field options state to include the new value
      setFieldOptions(prev => ({
        formatI: apiOptions.formatI || prev.formatI,
        formatII: apiOptions.formatII || prev.formatII,
        gType: apiOptions.gType || prev.gType,
        default: apiOptions.default || prev.default
      }));
      
      // Update the metadata state to include the new value in the dropdown
      // This ensures the new value appears in the dropdown immediately
      if (selectedFieldForAdd.name === 'formatI') {
        handleMetadataChange('formatI', value);
      } else if (selectedFieldForAdd.name === 'formatII') {
        handleMetadataChange('formatII', value);
      } else if (selectedFieldForAdd.name === 'gType') {
        handleMetadataChange('gType', value);
      } else if (selectedFieldForAdd.name === 'default') {
        handleMetadataChange('default', value);
      }
    } catch (error) {
      throw error;
    }
  };
  
  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
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

  const handleMetadataChange = (key: string, value: string) => {
    setMetadata(prev => {
      const newMetadata = { ...prev, [key]: value };
      
      // When Format V-I changes, reset Format V-II if it's not valid for the new Format V-I
      if (key === 'formatI' && value !== prev.formatI) {
        const newFormatI = String(value);
        const currentFormatII = String(newMetadata.formatII || '');
        // If Format V-II is set and not valid for the new Format V-I (and not "Keep Current"), clear it
        if (currentFormatII && currentFormatII !== 'Keep Current Format II' && !isValidFormatIIForFormatI(newFormatI, currentFormatII)) {
          newMetadata.formatII = 'Keep Current Format II';
        }
      }
      
      return newMetadata;
    });
  };

  const handleDriverSelectionChange = (type: 'sector' | 'domain' | 'country', values: string[]) => {
    setDriverSelections(prev => ({
      ...prev,
      [type]: values
    }));
  };

  const handleVariableClarifierChange = (value: string) => {
    setDriverSelections(prev => ({
      ...prev,
      variableClarifier: value
    }));
  };

  const handleObjectRelationshipChange = (id: string, field: keyof ObjectRelationship, value: string) => {
    setObjectRelationships(prev => prev.map(rel => {
      if (rel.id === id) {
        const updated = { ...rel, [field]: value };
        
        // Handle cascading updates
        if (field === 'to_being' && value === 'ALL') {
          updated.to_avatar = 'ALL';
          updated.to_object = 'ALL';
        } else if (field === 'to_avatar' && value === 'ALL') {
          updated.to_object = 'ALL';
        } else if (field === 'to_being' && value !== 'ALL') {
          updated.to_avatar = '';
          updated.to_object = '';
        } else if (field === 'to_avatar' && value !== 'ALL') {
          updated.to_object = '';
        }
        
        return updated;
      }
      return rel;
    }));
  };

  const addObjectRelationship = () => {
    const newRelationship: ObjectRelationship = {
      id: Date.now().toString(),
      to_being: '',
      to_avatar: '',
      to_object: ''
    };
    setObjectRelationships(prev => [...prev, newRelationship]);
  };

  const deleteObjectRelationship = (id: string) => {
    setObjectRelationships(prev => prev.filter(rel => rel.id !== id));
  };

  // Handler for when relationships are saved in the modal
  const handleRelationshipSave = (selectedObjectIds: string[]) => {
    setSelectedObjectRelationships(selectedObjectIds);
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

  const handleVariationCsvUpload = async (data: any[] | File) => {
    // For bulk edit, we parse CSV client-side and append to textarea
    if (data instanceof File) {
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
          // We'll parse the CSV client-side and add to the variations textarea
          const existingNames = new Set(variationsText.split('\n').filter(line => line.trim()).map(name => name.toLowerCase()));
          const newVariations = parsedData.filter((variation: any) => 
            !existingNames.has(variation.name.toLowerCase())
          );
          
          if (newVariations.length < parsedData.length) {
            const skippedCount = parsedData.length - newVariations.length;
            alert(`Uploaded ${newVariations.length} new variations. Skipped ${skippedCount} duplicates.`);
          } else {
            alert(`Successfully added ${newVariations.length} variations from CSV`);
          }
          
          // Append new variations to textarea
          const newLines = newVariations.map(v => v.name).join('\n');
          setVariationsText(prev => prev ? `${prev}\n${newLines}` : newLines);
        } else {
          alert('No valid variations found in CSV');
        }
      };
      reader.readAsText(data);
    } else {
      // Handle array of variations - append to textarea
      const existingNames = new Set(variationsText.split('\n').filter(line => line.trim()).map(name => name.toLowerCase()));
      const newVariations = data.filter((variation: any) => 
        !existingNames.has(variation.name.toLowerCase())
      );
      
      if (newVariations.length < data.length) {
        const skippedCount = data.length - newVariations.length;
        alert(`Uploaded ${newVariations.length} new variations. Skipped ${skippedCount} duplicates.`);
      }
      
      const newLines = newVariations.map((v: any) => v.name).join('\n');
      setVariationsText(prev => prev ? `${prev}\n${newLines}` : newLines);
    }
  };

  const handleSaveBulkEdit = () => {
    console.log('🔵 handleSaveBulkEdit called');
    console.log('🔵 validationComponentsList:', validationComponentsList);
    
    // Cascading validation: Part -> Section -> Group
    // If Part is being changed, Section and Group must be provided
    // If Section is being changed, Group must be provided
    const partProvided = formData.part && formData.part.trim() !== '' && formData.part !== 'Keep Current Part';
    const sectionProvided = formData.section && formData.section.trim() !== '' && formData.section !== 'Keep Current Section';
    const groupProvided = formData.group && formData.group.trim() !== '' && formData.group !== 'Keep Current Group';
    
    if (partProvided && !sectionProvided) {
      alert('Error: When changing Part, you must also select a Section. Please select both Part and Section.');
      return;
    }
    
    if (partProvided && !groupProvided) {
      alert('Error: When changing Part, you must also select a Group. Please select Part, Section, and Group.');
      return;
    }
    
    if (sectionProvided && !groupProvided) {
      alert('Error: When changing Section, you must also select a Group. Please select both Section and Group.');
      return;
    }
    
    // Generate driver string from selections if any driver fields are selected
    const hasDriverSelections = driverSelections.sector.length > 0 || 
                               driverSelections.domain.length > 0 || 
                               driverSelections.country.length > 0 || 
                               driverSelections.variableClarifier;
    
    const driverString = hasDriverSelections ? concatenateDrivers(
      driverSelections.sector,
      driverSelections.domain,
      driverSelections.country,
      driverSelections.variableClarifier
    ) : '';
    
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
        to_being: obj.being || '',
        to_avatar: obj.avatar || '',
        to_object: obj.object || '',
        to_sector: sector,
        to_domain: domain,
        to_country: country
      };
    }).filter(Boolean) as any[];

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

    // Validate Format V-I and Format V-II: both must be selected together or both must be "Keep Current"
    const formatIValue = metadata.formatI?.trim() || '';
    const formatIIValue = metadata.formatII?.trim() || '';
    const formatIChanged = formatIValue && formatIValue !== 'Keep Current Format I';
    const formatIIChanged = formatIIValue && formatIIValue !== 'Keep Current Format II';
    
    if (formatIChanged && !formatIIChanged) {
      alert('Please select both Format V-I and Format V-II together, or keep both as "Keep Current".');
      return;
    }
    
    if (!formatIChanged && formatIIChanged) {
      alert('Please select both Format V-I and Format V-II together, or keep both as "Keep Current".');
      return;
    }
    
    // If both are selected, validate that Format V-II is valid for Format V-I
    if (formatIChanged && formatIIChanged) {
      if (!isValidFormatIIForFormatI(formatIValue, formatIIValue)) {
        alert(`Format V-II "${formatIIValue}" is not valid for Format V-I "${formatIValue}". Please select a valid Format V-II value.`);
        return;
      }
    }

    // Validate validation components before saving
    for (let i = 0; i < validationComponentsList.length; i++) {
      const validationComponents = validationComponentsList[i];
      if (!validationComponents.valType) continue; // Skip empty entries
      
      // Check if operator is required and selected
      const requiresOperator = ['Range', 'Relative', 'Length'].includes(validationComponents.valType);
      if (requiresOperator && !validationComponents.operator) {
        alert(`Please select an operator for Validation #${i + 1} (${validationComponents.valType}).`);
        setValidationError('Operator is required');
        return;
      }
      
      // Check if value is required and entered
      const requiresValue = ['Length', 'Character', 'Range'].includes(validationComponents.valType);
      if (requiresValue && !validationComponents.value.trim()) {
        alert(`Please enter a value for Validation #${i + 1} (${validationComponents.valType}).`);
        setValidationError('Value is required');
        return;
      }
      
      // Validate Range value if all selected variables have same format
      if (validationComponents.valType === 'Range' && validationComponents.value.trim()) {
        const selectedVars = allData.filter(v => selectedVariableIds?.includes(v.id));
        const formatIs = [...new Set(selectedVars.map(v => v.formatI).filter(Boolean))];
        const formatIIs = [...new Set(selectedVars.map(v => v.formatII).filter(Boolean))];
        
        // Only validate if all variables have same format
        if (formatIs.length === 1 && formatIIs.length === 1) {
          const validation = validateValidationInput('Range', validationComponents.value.trim(), formatIs[0], formatIIs[0]);
          if (!validation.isValid) {
            alert(`Invalid value for Validation #${i + 1}: ${validation.error}`);
            setValidationError(validation.error || 'Invalid value');
            return;
          }
        }
        // If formats differ, no validation (user can enter any value)
      }
    }

    // Only include fields that have actual values (not empty strings or "Keep Current" placeholders)
    const saveData: Record<string, any> = {
      // Only include formData fields that have values
      ...(formData.part && formData.part.trim() !== '' && formData.part !== 'Keep Current Part' && { part: formData.part }),
      ...(formData.section && formData.section.trim() !== '' && formData.section !== 'Keep Current Section' && { section: formData.section }),
      ...(formData.group && formData.group.trim() !== '' && formData.group !== 'Keep Current Group' && { group: formData.group }),
      ...(formData.variable && formData.variable.trim() !== '' && formData.variable !== 'Keep current variable' && { variable: formData.variable }),
      // Only include driver if it has a value
      ...(driverString && driverString.trim() !== '' && { driver: driverString }),
      // Only include metadata fields that have values
      ...(metadata.formatI && metadata.formatI.trim() !== '' && metadata.formatI !== 'Keep Current Format I' && { formatI: metadata.formatI }),
      ...(metadata.formatII && metadata.formatII.trim() !== '' && metadata.formatII !== 'Keep Current Format II' && { formatII: metadata.formatII }),
      ...(metadata.gType && metadata.gType.trim() !== '' && metadata.gType !== 'Keep Current G-Type' && { gType: metadata.gType }),
      // Build validation strings from all validation entries
      // For bulk edit, we append validations to existing ones (comma-separated)
      ...(validationComponentsList.some(comp => comp.valType) && (() => {
        const validationStrings: string[] = [];
        
        for (const validationComponents of validationComponentsList) {
          if (!validationComponents.valType) continue;
          
          // Validate required fields
          const requiresOperator = ['Range', 'Relative', 'Length'].includes(validationComponents.valType);
          if (requiresOperator && !validationComponents.operator) {
            continue; // Skip invalid entries
          }
          
          const requiresValue = ['Length', 'Character', 'Range'].includes(validationComponents.valType);
          if (requiresValue && !validationComponents.value.trim()) {
            continue; // Skip invalid entries
          }
          
          // Build validation string
          if (validationComponents.valType === 'Range' && validationComponents.operator && validationComponents.value.trim()) {
            // For Range, use the typed value (not formatI)
            validationStrings.push(`Range ${validationComponents.operator} ${validationComponents.value.trim()}`);
          } else if (validationComponents.valType === 'Relative' && validationComponents.operator) {
            // Pass special format: _BULK_RELATIVE_<operator> so backend can use each variable's name
            validationStrings.push(`_BULK_RELATIVE_${validationComponents.operator}`);
          } else if (validationComponents.valType) {
            // For List, Length, Character - build with Val Type prefix
            const validationString = buildValidationString(validationComponents);
            if (validationString) {
              validationStrings.push(validationString);
            }
          }
        }
        
        if (validationStrings.length > 0) {
          // Join all validation strings with comma and space
          // Backend will append this to existing validations
          console.log('🔵 Building validation strings:', validationStrings);
          return { 
            validation: validationStrings.join(', '),
            shouldAppendValidations: true // Flag to indicate we should append instead of replace
          };
        }
        console.log('🔵 No valid validation strings to save');
        return null;
      })()),
      ...(metadata.default && metadata.default.trim() !== '' && metadata.default !== 'Keep Current Default' && { default: metadata.default }),
      ...(metadata.graph && metadata.graph.trim() !== '' && metadata.graph !== 'Keep Current Graph' && { graph: metadata.graph }),
      // Object relationships
      ...(objectRelationshipsList.length > 0 && { objectRelationshipsList: objectRelationshipsList }),
      ...(objectRelationshipsList.length > 0 && { shouldOverrideRelationships: true }), // Flag to indicate we should delete existing relationships
      // Variations
      ...(variationsList.length > 0 && { variationsList: variationsList })
    };
    
    console.log('🔵 BulkEditVariablesPanel - saveData:', saveData);
    console.log('🔵 BulkEditVariablesPanel - validationComponentsList:', validationComponentsList);
    console.log('🔵 BulkEditVariablesPanel - validation in saveData:', saveData.validation);
    console.log('🔵 BulkEditVariablesPanel - shouldAppendValidations:', saveData.shouldAppendValidations);
    console.log('🔵 BulkEditVariablesPanel - saveData keys:', Object.keys(saveData));
    
    // Check if saveData is empty (no fields to update)
    const hasDataToSave = Object.keys(saveData).length > 0;
    if (!hasDataToSave) {
      alert('No changes to save. Please make at least one change before saving.');
      return;
    }
    
    // If relationships are being changed, show confirmation
    if (selectedObjectRelationships.length > 0) {
      setPendingSaveData(saveData);
      setShowOverrideConfirmation(true);
    } else {
      // No relationships to change, save directly
      console.log('🔵 BulkEditVariablesPanel - Calling onSave with:', saveData);
      onSave(saveData);
      onClose();
    }
  };

  const handleConfirmOverride = () => {
    setShowOverrideConfirmation(false);
    if (pendingSaveData) {
      onSave(pendingSaveData);
      onClose();
    }
    setPendingSaveData(null);
  };

  const handleCancelOverride = () => {
    setShowOverrideConfirmation(false);
    setPendingSaveData(null);
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
      ? (options.length === 0 ? `No values found — please add new items in Drivers tab` : `Keep Current ${label}`)
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
                  if (hasSelectedVariables) {
                    openOntologyModal(ontologyViewType);
                  }
                }}
                disabled={!hasSelectedVariables}
                className={`p-1 transition-colors ${
                  hasSelectedVariables 
                    ? 'text-ag-dark-text-secondary hover:text-ag-dark-accent' 
                    : 'text-ag-dark-text-secondary/30 cursor-not-allowed opacity-50'
                }`}
                title={hasSelectedVariables ? "View Neo4j Ontology" : "Select variables to view ontology"}
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
          <h3 className="text-lg font-semibold text-ag-dark-text">Bulk Edit Variables</h3>
        </div>
        <button
          onClick={onClose}
          className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Bulk Edit Mode Notice - Always Visible */}
      <div className="bg-ag-dark-bg rounded-lg border border-ag-dark-border p-4 mb-6">
        <div className="text-sm text-ag-dark-text">
          <span className="font-semibold text-ag-dark-accent">Bulk Edit Mode:</span> Changes will be applied to all {selectedCount} selected variables. New relationships will be appended to existing ones.
        </div>
      </div>

      {/* Variable Name Field - Outside collapsible sections */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-ag-dark-text mb-2">
          Variable
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
          placeholder="Keep current variable"
          className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
        />
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
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Variable Clarifier
            </label>
            <select
              value={driverSelections.variableClarifier}
              onChange={(e) => handleVariableClarifierChange(e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Keep Current Variable Clarifier</option>
              <option value="">None</option>
              {driversData.variableClarifiers.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CollapsibleSection>

      {/* Ontology Section */}
      <CollapsibleSection title="Ontology (Taxonomy)" sectionKey="ontology" icon={<Users className="w-4 h-4 text-ag-dark-text-secondary" />} ontologyViewType="ontology">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Part
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
              <option value="">Keep Current Part</option>
              {isLoadingParts ? (
                <option value="">Loading...</option>
              ) : (
                getDistinctParts().filter(p => p !== 'Keep Current Part').map((option) => (
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
                disabled={!formData.part || formData.part === 'Keep Current Part'}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={formData.part && formData.part !== 'Keep Current Part' ? "Add new Section value" : "Please select a Part first"}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.section}
              onChange={(e) => handleChange('section', e.target.value)}
              disabled={!formData.part || formData.part === 'Keep Current Part' || isLoadingSections}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !formData.part || formData.part === 'Keep Current Part' || isLoadingSections ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              {isLoadingSections ? (
                <option value="">Loading...</option>
              ) : (
                getDistinctSections().map((option) => (
                  <option key={option} value={option === 'Keep Current Section' ? '' : option}>
                    {option}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Group
              </label>
              <select
                value={formData.group}
                onChange={(e) => handleChange('group', e.target.value)}
                disabled={!formData.part || formData.part === 'Keep Current Part' || isLoadingGroups}
                className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                  !formData.part || formData.part === 'Keep Current Part' || !formData.section || formData.section === 'Keep Current Section' || isLoadingGroups ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                <option value="">Keep Current Group</option>
                {isLoadingGroups ? (
                  <option value="">Loading...</option>
                ) : (
                  getDistinctGroups().filter(g => g !== 'Keep Current Group').map((option) => (
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
                value={metadata.gType}
                onChange={(e) => handleMetadataChange('gType', e.target.value)}
                className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                <option value="">Keep Current</option>
                <option value="L">L</option>
                <option value="T">T</option>
              </select>
            </div>
          </div>

        </div>
      </CollapsibleSection>

      {/* Metadata Section */}
      <CollapsibleSection title="Metadata" sectionKey="metadata" icon={<Key className="w-4 h-4 text-ag-dark-text-secondary" />} ontologyViewType="metadata">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
                  className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors"
                  title="Add new Format I value"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <select
                value={metadata.formatI}
                onChange={(e) => handleMetadataChange('formatI', e.target.value)}
                className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                <option value="">Keep Current Format I</option>
                {getDistinctFormatI().filter(f => f !== 'Keep Current Format I').map((option) => (
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
                value={metadata.formatII}
                onChange={(e) => handleMetadataChange('formatII', e.target.value)}
                disabled={!metadata.formatI || metadata.formatI === 'Keep Current Format I'}
                className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                  !metadata.formatI || metadata.formatI === 'Keep Current Format I' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                <option value="">Keep Current Format II</option>
                {metadata.formatI && metadata.formatI !== 'Keep Current Format I' ? getDistinctFormatII().filter(f => f !== 'Keep Current Format II').map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                )) : null}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">

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
                value={metadata.default}
                onChange={(e) => handleMetadataChange('default', e.target.value)}
                className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                <option value="">Keep Current Default</option>
                {getDistinctDefault().filter(d => d !== 'Keep Current Default').map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Graph
              </label>
              <select
                value={metadata.graph}
                onChange={(e) => handleMetadataChange('graph', e.target.value)}
                className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                <option value="">Keep Current Graph</option>
                {getDistinctGraph().filter(g => g !== 'Keep Current Graph').map((option) => (
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
                <h4 className="text-sm font-semibold text-ag-dark-text">
                  Validation #{index + 1}
                </h4>
                {validationComponentsList.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setValidationComponentsList(prev => prev.filter((_, i) => i !== index));
                    }}
                    className="text-red-400 hover:text-red-300 transition-colors"
                    title="Remove this validation"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
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
                    
                    // Auto-set value for List
                    if (newValType === 'List') {
                      newComponents.value = 'List';
                    }
                    // For Range in bulk edit, check if all selected variables have same format
                    else if (newValType === 'Range') {
                      const selectedVars = allData.filter(v => selectedVariableIds?.includes(v.id));
                      const formatIs = [...new Set(selectedVars.map(v => v.formatI).filter(Boolean))];
                      const formatIIs = [...new Set(selectedVars.map(v => v.formatII).filter(Boolean))];
                      
                      // If all variables have same formatI and formatII, allow typing with validation
                      // Otherwise, just allow typing without restrictions
                      if (formatIs.length === 1 && formatIIs.length === 1) {
                        newComponents.value = ''; // User will type it
                      } else {
                        newComponents.value = ''; // User will type it (no restrictions)
                      }
                    }
                    // For Relative in bulk edit, value will be "Same as Variables'"
                    else if (newValType === 'Relative') {
                      newComponents.value = "Same as Variables'";
                    }
                    
                    setValidationComponentsList(prev => prev.map((comp, i) => i === index ? newComponents : comp));
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

              {/* Operator Dropdown - Hidden for Character (always 'is'), shown for others */}
              {validationComponents.valType && validationComponents.valType !== 'Character' && getOperatorsForValType(validationComponents.valType).length > 0 && (
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

              {/* Character type shows operator as 'is' (non-editable) */}
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
                    (() => {
                      // Check if all selected variables have same formatI and formatII
                      const selectedVars = allData.filter(v => selectedVariableIds?.includes(v.id));
                      const formatIs = [...new Set(selectedVars.map(v => v.formatI).filter(Boolean))];
                      const formatIIs = [...new Set(selectedVars.map(v => v.formatII).filter(Boolean))];
                      const hasSameFormat = formatIs.length === 1 && formatIIs.length === 1;
                      const commonFormatI = hasSameFormat ? formatIs[0] : undefined;
                      const commonFormatII = hasSameFormat ? formatIIs[0] : undefined;
                      
                      return (
                        <div>
                          <input
                            ref={(el) => {
                              if (el) {
                                rangeValidationInputRefs.current.set(index, el);
                              } else {
                                rangeValidationInputRefs.current.delete(index);
                              }
                            }}
                            type="text"
                            value={validationComponents.value}
                            onInput={(e) => {
                              e.stopPropagation();
                              const input = e.target as HTMLInputElement;
                              const cursorPosition = input.selectionStart;
                              const newValue = input.value;
                              lastRangeValidationValueChangeTimeRefs.current.set(index, Date.now());
                              // Only validate if all variables have same format
                              if (hasSameFormat && commonFormatI && commonFormatII) {
                                const validation = validateValidationInput('Range', newValue, commonFormatI, commonFormatII);
                                setValidationError(validation.isValid ? '' : (validation.error || ''));
                              } else {
                                // No validation if formats differ
                                setValidationError('');
                              }
                              setValidationComponentsList(prev => prev.map((comp, i) => 
                                i === index ? { ...comp, value: newValue } : comp
                              ));
                              const restoreFocus = () => {
                                const ref = rangeValidationInputRefs.current.get(index);
                                if (ref) {
                                  ref.focus();
                                  const maxPos = ref.value.length;
                                  const safePos = Math.min(cursorPosition || 0, maxPos);
                                  ref.setSelectionRange(safePos, safePos);
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
                            onFocus={(e) => { 
                              e.stopPropagation(); 
                              e.nativeEvent.stopImmediatePropagation(); 
                              isRangeValidationInputFocusedRefs.current.set(index, true);
                            }}
                            onBlur={(e) => {
                              const timeSinceLastChange = Date.now() - (lastRangeValidationValueChangeTimeRefs.current.get(index) || 0);
                              const wasRecentTyping = timeSinceLastChange < 300;
                              const relatedTarget = e.relatedTarget as HTMLElement;
                              const clickedOnInput = relatedTarget && (relatedTarget.tagName === 'INPUT' || relatedTarget.tagName === 'TEXTAREA' || relatedTarget.isContentEditable);
                              if (wasRecentTyping && !clickedOnInput && rangeValidationInputRefs.current.get(index) && isRangeValidationInputFocusedRefs.current.get(index)) {
                                e.preventDefault();
                                e.stopPropagation();
                                setTimeout(() => { 
                                  const ref = rangeValidationInputRefs.current.get(index);
                                  if (ref) ref.focus(); 
                                }, 0);
                              } else if (!wasRecentTyping) {
                                isRangeValidationInputFocusedRefs.current.set(index, false);
                              }
                            }}
                            placeholder={hasSameFormat && commonFormatI === 'Time' 
                              ? 'Enter date/time (e.g., YYYY-MM-DD, MM/DD/YYYY, YYYY-MM-DD HH:MM:SS, or Unix timestamp)'
                              : hasSameFormat && commonFormatI === 'Number' && commonFormatII
                                ? commonFormatII === 'Integer'
                                  ? 'Enter integer (e.g., 42)'
                                  : commonFormatII === 'Decimal'
                                    ? 'Enter decimal (e.g., 3.14)'
                                    : commonFormatII === 'Currency'
                                      ? 'Enter currency (e.g., $100, €50.00)'
                                      : commonFormatII === 'Percentage'
                                        ? 'Enter percentage (e.g., 50%, 12.5%)'
                                        : 'Enter value'
                                : 'Enter value (no format restrictions - selected variables have different formats)'}
                            className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                              validationError && validationError.includes('Value') ? 'border-red-500' : ''
                            }`}
                          />
                          {validationError && validationError.includes('Value') && (
                            <p className="mt-1 text-sm text-red-500">{validationError}</p>
                          )}
                          {!hasSameFormat && (
                            <p className="mt-1 text-xs text-ag-dark-text-secondary">
                              Note: Selected variables have different Format V-I or Format V-II values. No format restrictions applied.
                            </p>
                          )}
                        </div>
                      );
                    })()
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
                        type="text"
                        value={validationComponents.value}
                        onInput={(e) => {
                          e.stopPropagation();
                          const input = e.target as HTMLInputElement;
                          const newValue = input.value;
                          const validation = validateValidationInput('Length', newValue);
                          setValidationError(validation.isValid ? '' : (validation.error || ''));
                          setValidationComponentsList(prev => prev.map((comp, i) => 
                            i === index ? { ...comp, value: newValue } : comp
                          ));
                        }}
                        onChange={(e) => { e.stopPropagation(); }}
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
                        type="text"
                        value={validationComponents.value}
                        onInput={(e) => {
                          e.stopPropagation();
                          const input = e.target as HTMLInputElement;
                          const newValue = input.value;
                          const validation = validateValidationInput('Character', newValue);
                          setValidationError(validation.isValid ? '' : (validation.error || ''));
                          setValidationComponentsList(prev => prev.map((comp, i) => 
                            i === index ? { ...comp, value: newValue } : comp
                          ));
                        }}
                        onChange={(e) => { e.stopPropagation(); }}
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
          ))}
        </div>
      </CollapsibleSection>

      {/* Object Relationships Section */}
      <CollapsibleSection 
        title="Relevance" 
        sectionKey="relationships"
        icon={<Link className="w-4 h-4 text-ag-dark-text-secondary" />}
        ontologyViewType="objectRelationships"
        actions={
          <div className="flex items-center gap-2">
            {/* Clone Relationships Button */}
            <button
              onClick={() => setIsCloneVariableRelationshipsModalOpen(true)}
              disabled={selectedCount === 0 || hasExistingRelationships}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                selectedCount === 0 || hasExistingRelationships ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title={
                selectedCount === 0 
                  ? "Select variables to clone relationships" 
                  : hasExistingRelationships 
                    ? `Please delete existing relationships for: ${variablesWithRelationships.join(', ')}` 
                    : "Clone object relationships from another variable"
              }
            >
              <Copy className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsVariableObjectRelationshipModalOpen(true)}
              disabled={selectedCount === 0}
              className={`px-3 py-1.5 text-sm font-medium border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors ${
                selectedCount === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title={selectedCount === 0 ? "Select variables to view relationships" : "View and manage relationships"}
            >
              View Relationships
            </button>
          </div>
        }
      >
        <div className="py-4">
          <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
            <div className="text-sm text-ag-dark-text-secondary">
              <span className="font-medium">Bulk relationship management:</span> Create relationships from all selected variables to target objects. 
              Relationships will be appended to existing ones.
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Variations Section */}
      <CollapsibleSection 
        title="New Variations" 
        sectionKey="variations"
        icon={<Layers className="w-4 h-4 text-ag-dark-text-secondary" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsVariationsModalOpen(true)}
              disabled={selectedCount === 0}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg ${
                selectedCount === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title={selectedCount === 0 ? "Select variables to manage variations" : "View and manage variations"}
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsVariationsGraphModalOpen(true)}
              disabled={selectedCount === 0}
              className={`text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors ${
                selectedCount === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title={selectedCount === 0 ? "Select variables to view variations graph" : "View Variations Graph"}
            >
              <Network className="w-4 h-4" />
            </button>
          </div>
        }
      >
        {/* Variations display removed - use the grid icon button to view variations in the modal */}
        <div className="mb-6">
          <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
            <div className="text-sm text-ag-dark-text-secondary">
              <span className="font-medium">Bulk variations management:</span> Click the grid icon above to add variations. These variations will be appended to each selected variable's existing variations.
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Apply Changes Button */}
      <div className="mt-8 pt-6 border-t border-ag-dark-border">
        <button
          onClick={handleSaveBulkEdit}
          className="w-full bg-ag-dark-accent text-white py-2 px-4 rounded hover:bg-ag-dark-accent-hover transition-colors flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          Apply to {selectedCount} Variables
        </button>
      </div>

      {/* Clone Variable Relationships Modal */}
      <CloneVariableRelationshipsModal
        isOpen={isCloneVariableRelationshipsModalOpen}
        onClose={() => setIsCloneVariableRelationshipsModalOpen(false)}
        targetVariables={selectedVariables}
        allVariables={allData}
        onCloneSuccess={async () => {
          // Refresh data after cloning relationships
          if (onSave) {
            await onSave({ _refreshRelationships: true });
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
        selectedVariable={null}
        selectedVariables={selectedVariableIds && selectedVariableIds.length > 0 
          ? allData.filter(v => selectedVariableIds.includes(v.id))
          : allData.slice(0, selectedCount)}
        allObjects={allObjects}
        onSave={() => {
          // Refresh data after saving relationships
          if (onSave) {
            onSave({});
          }
        }}
        initialCsvData={pendingCsvData}
        isBulkMode={true}
      />

      {/* Variations Modal */}
      {selectedVariableIds && selectedVariableIds.length > 0 && (
        <VariationsModal
          isOpen={isVariationsModalOpen}
          onClose={() => setIsVariationsModalOpen(false)}
          selectedVariables={allData.filter((v: any) => selectedVariableIds.includes(v.id))}
          isBulkMode={true}
          onSave={async () => {
            // Refresh variables data after saving
            // The modal's onSave callback will trigger a refresh via onSave
            if (onSave) {
              // Call onSave to trigger parent refresh, but variations are already saved
              await onSave({});
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
        variableIds={getSelectedVariableIds()}
        variableNames={getSelectedVariableNames()}
        sectionName="Variations"
        viewType="variations"
        mode="variable"
        isBulkMode={true}
      />

      {/* Confirmation Dialog */}
      {showOverrideConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
          <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-ag-dark-text mb-4">
              Override Existing Relationships?
            </h3>
            <p className="text-ag-dark-text-secondary mb-6">
              This will delete all existing object relationships for the {selectedCount} selected variable{selectedCount !== 1 ? 's' : ''} and replace them with the new relationship{selectedObjectRelationships.length !== 1 ? 's' : ''} you've selected.
              <br /><br />
              This action cannot be undone. Are you sure?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleCancelOverride}
                className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOverride}
                className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors"
              >
                Yes, Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ontology Modal */}
      {/* Add Section Value Modal */}
      <AddSectionValueModal
        isOpen={isAddSectionValueModalOpen}
        onClose={() => {
          setIsAddSectionValueModalOpen(false);
        }}
        onSave={handleAddSectionValue}
        availableParts={getDistinctParts().filter(p => p !== 'Keep Current Part')}
        defaultPart={formData.part && formData.part !== 'Keep Current Part' ? formData.part : ''}
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

      {ontologyModalOpen.isOpen && ontologyModalOpen.viewType && hasSelectedVariables && (
        <OntologyModal
          isOpen={ontologyModalOpen.isOpen}
          onClose={closeOntologyModal}
          variableIds={getSelectedVariableIds()}
          variableNames={getSelectedVariableNames()}
          sectionName={
            ontologyModalOpen.viewType === 'drivers' ? 'Drivers' :
            ontologyModalOpen.viewType === 'ontology' ? 'Ontology' :
            ontologyModalOpen.viewType === 'metadata' ? 'Metadata' :
            'Relevance'
          }
          viewType={ontologyModalOpen.viewType}
          mode="variable"
          isBulkMode={true}
        />
      )}
    </div>
  );
};
