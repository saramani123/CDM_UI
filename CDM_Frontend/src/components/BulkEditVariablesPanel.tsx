import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Settings, Save, X, Trash2, Plus, Link, Layers, Upload, ChevronRight, ChevronDown, Database, Users, Key, Network, Copy, ArrowUpAZ, ArrowDownZA } from 'lucide-react';
import { getDriversData, concatenateDrivers, parseDriverField } from '../data/mockData';
import { CsvUploadModal } from './CsvUploadModal';
import { VariableObjectRelationshipModal } from './VariableObjectRelationshipModal';
import { useObjects } from '../hooks/useObjects';
import { OntologyModal } from './OntologyModal';
import { CloneVariableRelationshipsModal } from './CloneVariableRelationshipsModal';
import { buildValidationString, validateValidationInput, getOperatorsForValType, type ValidationComponents, type ValType, type Operator } from '../utils/validationUtils';

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

  // Validation components state for bulk edit
  const [validationComponents, setValidationComponents] = useState<ValidationComponents>({
    valType: '',
    operator: '',
    value: ''
  });
  const [validationError, setValidationError] = useState<string>('');

  const driversData = getDriversData();

  // Object relationships - store selected object IDs from modal
  const [selectedObjectRelationships, setSelectedObjectRelationships] = useState<string[]>([]);
  
  // Modal state for object relationships
  const [isVariableObjectRelationshipModalOpen, setIsVariableObjectRelationshipModalOpen] = useState(false);
  const [pendingCsvData, setPendingCsvData] = useState<any[] | null>(null);
  const [isCloneVariableRelationshipsModalOpen, setIsCloneVariableRelationshipsModalOpen] = useState(false);
  
  // Confirmation dialog state
  const [showOverrideConfirmation, setShowOverrideConfirmation] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<any>(null);

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

  // Section input focus management
  const sectionInputRef = useRef<HTMLInputElement>(null);
  const isSectionInputFocusedRef = useRef<boolean>(false);
  const lastSectionChangeTimeRef = useRef<number>(0);

  // Validation value input focus management
  const validationValueInputRef = useRef<HTMLInputElement>(null);
  const isValidationValueInputFocusedRef = useRef<boolean>(false);
  const lastValidationValueChangeTimeRef = useRef<number>(0);

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

  // Get distinct parts and groups from variables data
  const getDistinctParts = () => {
    const parts = [...new Set(allData.map(item => item.part))];
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
    
    // Get groups from existing variables data for this part
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
    const sections = [...new Set(allData.map(item => item.section))];
    return ['Keep Current Section', ...sections];
  };

  const getDistinctVariables = () => {
    const variables = [...new Set(allData.map(item => item.variable))];
    return ['Keep Current Variable', ...variables];
  };

  // Get distinct values for metadata dropdowns
  const getDistinctFormatI = () => {
    const formatIValues = [...new Set(allData.map(item => item.formatI).filter(val => val && val.trim() !== ''))];
    return ['Keep Current Format I', ...formatIValues];
  };

  const getDistinctFormatII = () => {
    const formatIIValues = [...new Set(allData.map(item => item.formatII).filter(val => val && val.trim() !== ''))];
    return ['Keep Current Format II', ...formatIIValues];
  };

  const getDistinctValidation = () => {
    const validationValues = [...new Set(allData.map(item => item.validation).filter(val => val && val.trim() !== ''))];
    return ['Keep Current Validation', ...validationValues];
  };

  const getDistinctGraph = () => {
    const graphValues = [...new Set(allData.map(item => item.graph).filter(val => val && val.trim() !== ''))];
    return ['Keep Current Graph', ...graphValues];
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
      
      // When part changes, clear group (groups are part-specific)
      if (key === 'part' && value !== prev.part) {
        newData.group = '';
      }
      
      return newData;
    });
  };

  const handleMetadataChange = (key: string, value: string) => {
    setMetadata(prev => ({
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
    // Validate that if Part or Group is being changed, BOTH must be provided
    const partProvided = formData.part && formData.part.trim() !== '' && formData.part !== 'Keep Current Part';
    const groupProvided = formData.group && formData.group.trim() !== '' && formData.group !== 'Keep Current Group';
    
    if (partProvided && !groupProvided) {
      alert('When changing Part in bulk edit, you must also specify Group. Please select both Part and Group.');
      return;
    }
    
    if (groupProvided && !partProvided) {
      alert('When changing Group in bulk edit, you must also specify Part. Please select both Part and Group.');
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

    // Only include fields that have actual values (not empty strings or "Keep Current" placeholders)
    const saveData: Record<string, any> = {
      // Only include formData fields that have values
      ...(formData.part && formData.part.trim() !== '' && formData.part !== 'Keep Current Part' && { part: formData.part }),
      ...(formData.section && formData.section.trim() !== '' && formData.section !== 'Keep current section' && { section: formData.section }),
      ...(formData.group && formData.group.trim() !== '' && formData.group !== 'Keep Current Group' && { group: formData.group }),
      ...(formData.variable && formData.variable.trim() !== '' && formData.variable !== 'Keep current variable' && { variable: formData.variable }),
      // Only include driver if it has a value
      ...(driverString && driverString.trim() !== '' && { driver: driverString }),
      // Only include metadata fields that have values
      ...(metadata.formatI && metadata.formatI.trim() !== '' && metadata.formatI !== 'Keep Current Format I' && { formatI: metadata.formatI }),
      ...(metadata.formatII && metadata.formatII.trim() !== '' && metadata.formatII !== 'Keep Current Format II' && { formatII: metadata.formatII }),
      ...(metadata.gType && metadata.gType.trim() !== '' && metadata.gType !== 'Keep Current G-Type' && { gType: metadata.gType }),
      // Build validation string from components
      // For Range and Relative in bulk edit, we use a special format that backend can interpret
      ...(validationComponents.valType && (() => {
        if (validationComponents.valType === 'Range' && validationComponents.operator) {
          // Pass special format: _BULK_RANGE_<operator> so backend can use each variable's formatI
          return { validation: `_BULK_RANGE_${validationComponents.operator}` };
        } else if (validationComponents.valType === 'Relative' && validationComponents.operator) {
          // Pass special format: _BULK_RELATIVE_<operator> so backend can use each variable's name
          return { validation: `_BULK_RELATIVE_${validationComponents.operator}` };
        } else if (validationComponents.valType) {
          // For List, Length, Character - build normally (but we need a dummy value for Range/Relative)
          // Actually, for bulk edit, we can't build a complete string for Range/Relative
          // So we only include if it's not Range or Relative
          if (validationComponents.valType !== 'Range' && validationComponents.valType !== 'Relative') {
            // For List, Length, Character - we need to build with the actual value
            // But we don't have a specific variable, so we'll use a placeholder
            // Actually, for List we can build it, for Length/Character we need the value
            if (validationComponents.valType === 'List') {
              return { validation: 'List' };
            } else if (validationComponents.valType === 'Length' && validationComponents.operator && validationComponents.value) {
              return { validation: `${validationComponents.operator}${validationComponents.value}` };
            } else if (validationComponents.valType === 'Character' && validationComponents.value) {
              return { validation: validationComponents.value };
            }
          }
        }
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
    
    // If relationships are being changed, show confirmation
    if (selectedObjectRelationships.length > 0) {
      setPendingSaveData(saveData);
      setShowOverrideConfirmation(true);
    } else {
      // No relationships to change, save directly
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
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Keep Current Part</option>
              {getDistinctParts().filter(p => p !== 'Keep Current Part').map((option) => (
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
              ref={sectionInputRef}
              type="text"
              value={formData.section}
              onInput={(e) => {
                e.stopPropagation();
                const input = e.target as HTMLInputElement;
                const cursorPosition = input.selectionStart;
                const newValue = input.value;
                lastSectionChangeTimeRef.current = Date.now();
                
                // Update state
                handleChange('section', newValue);
                
                // Aggressively maintain focus - use multiple strategies
                const restoreFocus = () => {
                  if (sectionInputRef.current) {
                    sectionInputRef.current.focus();
                    const maxPos = sectionInputRef.current.value.length;
                    const safePos = Math.min(cursorPosition, maxPos);
                    sectionInputRef.current.setSelectionRange(safePos, safePos);
                  }
                };
                
                // Try immediately
                restoreFocus();
                
                // Also try after microtask
                Promise.resolve().then(restoreFocus);
                
                // Also try after animation frame
                requestAnimationFrame(restoreFocus);
              }}
              onChange={(e) => {
                // Also handle onChange as fallback
                e.stopPropagation();
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
              onKeyPress={(e) => {
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
                isSectionInputFocusedRef.current = true;
              }}
              onBlur={(e) => {
                // Prevent blur if it happened right after typing
                const timeSinceLastChange = Date.now() - lastSectionChangeTimeRef.current;
                const wasRecentTyping = timeSinceLastChange < 300; // 300ms window
                
                // Check if blur was intentional
                const relatedTarget = e.relatedTarget as HTMLElement;
                const clickedOnInput = relatedTarget && 
                  (relatedTarget.tagName === 'INPUT' || 
                   relatedTarget.tagName === 'TEXTAREA' || 
                   relatedTarget.isContentEditable);
                
                // If it was recent typing and user didn't click on another input, prevent blur
                if (wasRecentTyping && !clickedOnInput && sectionInputRef.current && isSectionInputFocusedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  // Force focus back immediately
                  setTimeout(() => {
                    if (sectionInputRef.current) {
                      sectionInputRef.current.focus();
                    }
                  }, 0);
                } else if (!wasRecentTyping) {
                  isSectionInputFocusedRef.current = false;
                }
              }}
              placeholder="Keep current section"
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Group
            </label>
            <select
              value={formData.group}
              onChange={(e) => handleChange('group', e.target.value)}
              disabled={!formData.part || formData.part === 'Keep Current Part'}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !formData.part || formData.part === 'Keep Current Part' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Keep Current Group</option>
              {getDistinctGroups().filter(g => g !== 'Keep Current Group').map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

        </div>
      </CollapsibleSection>

      {/* Metadata Section */}
      <CollapsibleSection title="Metadata" sectionKey="metadata" icon={<Key className="w-4 h-4 text-ag-dark-text-secondary" />} ontologyViewType="metadata">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Format I
              </label>
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
                className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px'
                }}
              >
                <option value="">Keep Current Format II</option>
                {getDistinctFormatII().filter(f => f !== 'Keep Current Format II').map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                G-Type
              </label>
              <input
                type="text"
                value={metadata.gType}
                onChange={(e) => handleMetadataChange('gType', e.target.value)}
                placeholder="Keep current G-Type"
                onClick={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Default
              </label>
              <input
                type="text"
                value={metadata.default}
                onChange={(e) => handleMetadataChange('default', e.target.value)}
                placeholder="Keep current Default"
                onClick={(e) => e.stopPropagation()}
                className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
              />
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
                // For Range and Relative in bulk edit, value will be "Same as Variables'"
                else if (newValType === 'Range' || newValType === 'Relative') {
                  newComponents.value = "Same as Variables'";
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
                // For Range and Relative in bulk edit, value will be "Same as Variables'"
                else if (newValType === 'Range' || newValType === 'Relative') {
                  newComponents.value = "Same as Variables'";
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
          placeholder="Type one variation per line. Press Enter to add more. Variations will be appended to existing ones for all selected variables."
          rows={8}
          className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent resize-y"
        />
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
