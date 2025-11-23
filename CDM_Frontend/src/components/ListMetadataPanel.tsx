import React, { useState, useRef, useEffect } from 'react';
import { Settings, Save, X, Trash2, Plus, Link, Upload, List, Database, Users, FileText, ChevronRight, ChevronDown, Network, Eye, Copy, ArrowUpAZ, ArrowDownZA, Grid3x3, Layers } from 'lucide-react';
import { listFieldOptions } from '../data/listsData';
import { ListCsvUploadModal } from './ListCsvUploadModal';
import { CsvUploadModal } from './CsvUploadModal';
import { useDrivers } from '../hooks/useDrivers';
import { useVariables } from '../hooks/useVariables';
import { VariableListRelationshipModal } from './VariableListRelationshipModal';
import { ListsOntologyModal } from './ListsOntologyModal';
import { VariableListRelationshipsGraphModal } from './VariableListRelationshipsGraphModal';
import { CloneListApplicabilityModal } from './CloneListApplicabilityModal';
import { TieredListValuesModal } from './TieredListValuesModal';
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

interface TieredList {
  id: string;
  set: string;
  grouping: string;
  list: string;
  listId?: string; // ID of the tiered list node
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

  // Initialize list values as textarea text (newline-separated)
  const [listValuesText, setListValuesText] = useState<string>(() => {
    if (selectedList?.listValuesList && selectedList.listValuesList.length > 0) {
      return selectedList.listValuesList.map((lv: ListValue) => lv.value).join('\n');
    }
    return '';
  });
  
  // Refs for textarea management
  const listValuesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isListValuesTextareaFocusedRef = useRef(false);
  const lastListValuesChangeTimeRef = useRef(0);

  // CSV upload modal states
  const [isVariableAttachedUploadOpen, setIsVariableAttachedUploadOpen] = useState(false);
  const [isListValuesUploadOpen, setIsListValuesUploadOpen] = useState(false);
  const [listValuesGraphModalOpen, setListValuesGraphModalOpen] = useState(false);
  const [isTieredListValuesModalOpen, setIsTieredListValuesModalOpen] = useState(false);
  
  // Variations state - using string for multiline input
  const [variationsText, setVariationsText] = useState('');
  const variationsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isVariationsTextareaFocusedRef = useRef<boolean>(false);
  const lastVariationsChangeTimeRef = useRef<number>(0);
  const [isVariationUploadOpen, setIsVariationUploadOpen] = useState(false);
  const [isVariationsGraphModalOpen, setIsVariationsGraphModalOpen] = useState(false);
  
  // Relationship modal state
  const [isVariableRelationshipModalOpen, setIsVariableRelationshipModalOpen] = useState(false);
  const [isCloneListApplicabilityModalOpen, setIsCloneListApplicabilityModalOpen] = useState(false);
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
    variations: false,
    tiered: false,
    relationships: false
  });
  
  // List Type state - Single or Multi-Level
  const [listType, setListType] = useState<'Single' | 'Multi-Level'>(() => {
    // Check if list has tiered lists to determine if it's Multi-Level
    if (selectedList?.tieredListsList && selectedList.tieredListsList.length > 0) {
      return 'Multi-Level';
    }
    return 'Single';
  });
  
  // Number of levels for Multi-Level lists (2-10)
  const [numberOfLevels, setNumberOfLevels] = useState<number>(() => {
    if (selectedList?.tieredListsList && selectedList.tieredListsList.length > 0) {
      return selectedList.tieredListsList.length + 1; // +1 for parent list
    }
    return 2;
  });
  
  // Tier names for Multi-Level lists (Tier 2, Tier 3, etc.)
  const [tierNames, setTierNames] = useState<string[]>(() => {
    if (selectedList?.tieredListsList && selectedList.tieredListsList.length > 0) {
      return selectedList.tieredListsList.map((tier: any) => tier.list || '');
    }
    return [];
  });

  // Load variations when selectedList changes
  React.useEffect(() => {
    if (selectedList?.id) {
      console.log('ListMetadataPanel: Loading variations for list:', selectedList.list, 'id:', selectedList.id);
      
      // If variationsList is available in selectedList, use it
      if (selectedList.variationsList && selectedList.variationsList.length > 0) {
        const variationsTextContent = selectedList.variationsList.map((v: any) => typeof v === 'string' ? v : v.name).join('\n');
        setVariationsText(variationsTextContent);
      } else {
        // Otherwise, fetch from API
        apiService.getListVariations(selectedList.id)
          .then((response: any) => {
            if (response && response.variationsList && response.variationsList.length > 0) {
              const variationsTextContent = response.variationsList.map((v: any) => typeof v === 'string' ? v : v.name).join('\n');
              setVariationsText(variationsTextContent);
            } else {
              setVariationsText('');
            }
          })
          .catch((error) => {
            console.error('Error loading variations:', error);
            setVariationsText('');
          });
      }
    } else {
      setVariationsText('');
    }
  }, [selectedList?.id]);

  // Update states when selectedList changes
  React.useEffect(() => {
    setVariablesAttached(selectedList?.variablesAttachedList || []);
    // Update list values text from selectedList
    if (selectedList?.listValuesList && selectedList.listValuesList.length > 0) {
      setListValuesText(selectedList.listValuesList.map((lv: ListValue) => lv.value).join('\n'));
    } else {
      setListValuesText('');
    }
    // Update list type and tier names
    if (selectedList) {
      // Check if list has listType property (new structure) or tieredListsList (old structure)
      if (selectedList.listType === 'Multi-Level' || (selectedList.tieredListsList && selectedList.tieredListsList.length > 0)) {
        setListType('Multi-Level');
        // If we have tierNames from the new structure, use those; otherwise use old tieredListsList
        if (selectedList.tierNames && selectedList.tierNames.length > 0) {
          setNumberOfLevels(selectedList.tierNames.length + 1);
          setTierNames(selectedList.tierNames);
        } else if (selectedList.tieredListsList && selectedList.tieredListsList.length > 0) {
          setNumberOfLevels(selectedList.tieredListsList.length + 1);
          setTierNames(selectedList.tieredListsList.map((tier: any) => tier.list || ''));
        } else {
          setNumberOfLevels(2);
          setTierNames([]);
        }
      } else {
        setListType('Single');
        setNumberOfLevels(2);
        setTierNames([]);
      }
    } else {
      setListType('Single');
      setNumberOfLevels(2);
      setTierNames([]);
    }
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

  // Get distinct Set values from actual lists data
  const getDistinctSets = (): string[] => {
    const listsData = allData.length > 0 ? allData : [];
    const sets = [...new Set(listsData.map((list: any) => list.set))].filter(Boolean).sort() as string[];
    return sets;
  };

  // Get distinct Grouping values for a specific Set from actual lists data
  const getGroupingsForSet = (set: string): string[] => {
    if (!set) return [];
    const listsData = allData.length > 0 ? allData : [];
    const groupings = [...new Set(
      listsData
        .filter((list: any) => list.set === set && list.grouping)
        .map((list: any) => list.grouping)
    )].filter(Boolean).sort() as string[];
    return groupings;
  };
  
  // Get lists for a specific Set and Grouping, excluding current list and previously selected tiered lists
  const getListsForSetAndGrouping = (set: string, grouping: string, excludeListIds: string[]): any[] => {
    if (!set || !grouping) return [];
    const listsData = allData.length > 0 ? allData : [];
    return listsData.filter((list: any) => 
      list.set === set && 
      list.grouping === grouping &&
      !excludeListIds.includes(list.id)
    );
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
    setFormData(prev => {
      const newData = {
        ...prev,
        [key]: value
      };
      
      // If set is changed, reset grouping if it doesn't belong to the new set
      if (key === 'set') {
        const groupingsForNewSet = getGroupingsForSet(value as string);
        if (prev.grouping && !groupingsForNewSet.includes(prev.grouping as string)) {
          newData.grouping = '';
        }
      }
      
      return newData;
    });
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
    const lines = listValuesText.split('\n').filter(line => line.trim() !== '');
    const sortedLines = [...lines].sort((a, b) => {
      const aTrimmed = a.trim().toLowerCase();
      const bTrimmed = b.trim().toLowerCase();
      if (direction === 'asc') {
        return aTrimmed.localeCompare(bTrimmed);
      } else {
        return bTrimmed.localeCompare(aTrimmed);
      }
    });
    setListValuesText(sortedLines.join('\n') + (listValuesText.endsWith('\n') ? '\n' : ''));
  };

  const handleVariableAttachedCsvUpload = (uploadedVariables: VariableAttached[]) => {
    setVariablesAttached(prev => [...prev, ...uploadedVariables]);
  };

  const handleListValuesCsvUpload = (uploadedValues: ListValue[]) => {
    // Append uploaded values to textarea text
    const uploadedText = uploadedValues.map(lv => lv.value).join('\n');
    setListValuesText(prev => prev ? `${prev}\n${uploadedText}` : uploadedText);
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
    if (data instanceof File && selectedList?.id) {
      try {
        await apiService.bulkUploadListVariations(selectedList.id, data);
        // Refresh variations text after upload
        const variationsResponse: any = await apiService.getListVariations(selectedList.id);
        if (variationsResponse && variationsResponse.variationsList) {
          const variationsTextContent = variationsResponse.variationsList.map((v: any) => typeof v === 'string' ? v : v.name).join('\n');
          setVariationsText(variationsTextContent);
        }
      } catch (error) {
        console.error('Error uploading variations CSV:', error);
        alert('Failed to upload variations CSV. Please try again.');
      }
    } else if (Array.isArray(data)) {
      // Handle array of variations - append to textarea
      const existingNames = new Set(variationsText.split('\n').filter(line => line.trim()).map(name => name.toLowerCase()));
      const newVariations = data.filter((variation: any) => 
        !existingNames.has((typeof variation === 'string' ? variation : variation.name).toLowerCase())
      );
      
      if (newVariations.length < data.length) {
        const skippedCount = data.length - newVariations.length;
        alert(`Uploaded ${newVariations.length} new variations. Skipped ${skippedCount} duplicates.`);
      }
      
      const newLines = newVariations.map((v: any) => typeof v === 'string' ? v : v.name).join('\n');
      setVariationsText(prev => prev ? `${prev}\n${newLines}` : newLines);
    }
  };

  const handleSave = () => {
    console.log('ListMetadataPanel: handleSave called');
    console.log('ListMetadataPanel: listType =', listType);
    console.log('ListMetadataPanel: numberOfLevels =', numberOfLevels);
    console.log('ListMetadataPanel: tierNames =', tierNames);
    
    // Convert "ALL" to all individual values before saving (filter out "ALL" itself)
    const getDriverValuesForSave = (values: string[], allPossibleValues: string[]): string[] => {
      if (values.includes('ALL')) {
        // If "ALL" is selected, return all individual values (excluding "ALL")
        return allPossibleValues.filter(v => v !== 'ALL');
      }
      // Otherwise, filter out "ALL" if it somehow got in there
      return values.filter(v => v !== 'ALL');
    };
    
    const saveData: any = {
      ...formData,
      sector: getDriverValuesForSave(driverSelections.sector, driversData.sectors),
      domain: getDriverValuesForSave(driverSelections.domain, driversData.domains),
      country: getDriverValuesForSave(driverSelections.country, driversData.countries),
      variablesAttachedList: selectedVariables.length > 0 ? selectedVariables : variablesAttached
    };
    
    // Handle list type and tiered lists
    if (listType === 'Single') {
      // Single list - include list values and clear any tiered lists
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
      
      saveData.listValuesList = listValuesArray;
      saveData.tieredListsList = [];
      saveData.listType = 'Single';
      // Clear tiered list values if switching from Multi-Level to Single
      saveData.tieredListValues = {};
    } else if (listType === 'Multi-Level') {
      // Multi-Level list - validate tier names and prepare for backend
      const validTierNames = tierNames.filter(name => name.trim() !== '');
      if (validTierNames.length !== numberOfLevels - 1) {
        alert(`Please provide names for all ${numberOfLevels - 1} tier(s).`);
        return;
      }
      
      // Clear existing list values when switching to Multi-Level
      // (they will be managed via grid modal instead)
      saveData.listValuesList = [];
      saveData.listType = 'Multi-Level';
      saveData.numberOfLevels = numberOfLevels;
      saveData.tierNames = validTierNames;
      console.log('ListMetadataPanel: Saving Multi-Level configuration:', {
        listType: saveData.listType,
        numberOfLevels: saveData.numberOfLevels,
        tierNames: saveData.tierNames
      });
      // Backend will create the tier list nodes and relationships
      // Note: tieredListValues can be saved separately via grid modal or together here
    }
    
    // Handle variationsList - parse from textarea and check for duplicates
    const variationsArray = variationsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map((name) => ({ name }));
    
    // Check for duplicate variations (case-insensitive) within the same list
    const uniqueVariations = new Set(variationsArray.map(v => v.name.toLowerCase()));
    if (variationsArray.length !== uniqueVariations.size) {
      const duplicateVariations = variationsArray.filter((v, index) => 
        variationsArray.findIndex(v2 => v2.name.toLowerCase() === v.name.toLowerCase()) !== index
      ).map(v => v.name);
      
      alert(`Cannot save: Duplicate variations found: ${duplicateVariations.join(', ')}. Please remove duplicates before saving.`);
      return;
    }
    
    if (variationsArray.length > 0) {
      saveData.variationsList = variationsArray;
    }
    
    console.log('ListMetadataPanel: Calling onSave with data:', saveData);
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
    <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border flex flex-col relative" style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
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

      {/* Scrollable Content Area - with bottom padding to account for button */}
      <div className="flex-1 overflow-y-auto px-6" style={{ minHeight: 0, paddingBottom: onSave ? '90px' : '24px' }}>
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
              {getDistinctSets().map((option) => (
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
              disabled={!isPanelEnabled || !formData.set}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !isPanelEnabled || !formData.set ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
              title={!formData.set ? 'Please select a Set first' : ''}
            >
              <option value="">Select Grouping</option>
              {(() => {
                const groupingsForSet = formData.set 
                  ? getGroupingsForSet(formData.set as string)
                  : [];
                return groupingsForSet.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ));
              })()}
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
              disabled={!isPanelEnabled || !selectedList?.id}
              className={`text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors ${
                !isPanelEnabled || !selectedList?.id ? 'opacity-50 cursor-not-allowed' : ''
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
            lastVariationsChangeTimeRef.current = Date.now();
            handleVariationsTextChange(e.target.value);
            // Restore cursor position and focus after state update
            requestAnimationFrame(() => {
              if (variationsTextareaRef.current && isVariationsTextareaFocusedRef.current) {
                variationsTextareaRef.current.focus();
                const maxPos = variationsTextareaRef.current.value.length;
                const safePos = Math.min(cursorPosition, maxPos);
                variationsTextareaRef.current.setSelectionRange(safePos, safePos);
              }
            });
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
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
            isVariationsTextareaFocusedRef.current = true;
          }}
          onBlur={(e) => {
            const timeSinceLastChange = Date.now() - lastVariationsChangeTimeRef.current;
            const wasRecentTyping = timeSinceLastChange < 200;
            const relatedTarget = e.relatedTarget as HTMLElement;
            const clickedOutside = !relatedTarget || 
              (relatedTarget.tagName !== 'TEXTAREA' && 
               relatedTarget.tagName !== 'INPUT' && 
               relatedTarget.tagName !== 'BUTTON');
            
            if (wasRecentTyping && clickedOutside) {
              setTimeout(() => {
                if (variationsTextareaRef.current && document.activeElement !== variationsTextareaRef.current) {
                  variationsTextareaRef.current.focus();
                }
              }, 10);
            } else {
              isVariationsTextareaFocusedRef.current = false;
            }
          }}
          disabled={!isPanelEnabled}
          placeholder="Enter variations, one per line..."
          className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent min-h-[120px] resize-y ${
            !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
      </CollapsibleSection>

      {/* List Type Section */}
      <CollapsibleSection 
        title="List Type" 
        sectionKey="tiered"
        icon={<List className="w-4 h-4 text-ag-dark-text-secondary" />}
      >
        <div className="space-y-4">
          {/* List Type Dropdown */}
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              List Type
            </label>
            <select
              value={listType}
              onChange={(e) => {
                const newType = e.target.value as 'Single' | 'Multi-Level';
                setListType(newType);
                if (newType === 'Single') {
                  setNumberOfLevels(2);
                  setTierNames([]);
                } else {
                  // Initialize with 2 levels (parent + 1 tier)
                  setNumberOfLevels(2);
                  setTierNames(['']);
                  // Clear list values when switching to Multi-Level
                  // (they will be managed via grid modal instead)
                  setListValuesText('');
                }
              }}
              disabled={!isPanelEnabled || selectedList?.hasIncomingTier}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !isPanelEnabled || selectedList?.hasIncomingTier ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="Single">Single</option>
              <option value="Multi-Level">Multi-Level</option>
            </select>
          </div>

          {/* Multi-Level Options */}
          {listType === 'Multi-Level' && (
            <>
              {/* Number of Levels Dropdown */}
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  No. Levels
                </label>
                <select
                  value={numberOfLevels}
                  onChange={(e) => {
                    const newLevels = parseInt(e.target.value);
                    setNumberOfLevels(newLevels);
                    // Adjust tier names array to match new number of levels
                    const newTierNames = [...tierNames];
                    const tiersNeeded = newLevels - 1; // -1 because parent is level 1
                    while (newTierNames.length < tiersNeeded) {
                      newTierNames.push('');
                    }
                    while (newTierNames.length > tiersNeeded) {
                      newTierNames.pop();
                    }
                    setTierNames(newTierNames);
                  }}
                  disabled={!isPanelEnabled || selectedList?.hasIncomingTier}
                  className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                    !isPanelEnabled || selectedList?.hasIncomingTier ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 12px center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '16px'
                  }}
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tier Name Input Fields */}
              {numberOfLevels > 1 && (
                <div className="space-y-3">
                  {Array.from({ length: numberOfLevels - 1 }, (_, index) => (
                    <div key={index}>
                      <label className="block text-sm font-medium text-ag-dark-text mb-2">
                        Tier {index + 2} Name
                      </label>
                      <input
                        type="text"
                        value={tierNames[index] || ''}
                        onChange={(e) => {
                          const newTierNames = [...tierNames];
                          newTierNames[index] = e.target.value;
                          setTierNames(newTierNames);
                        }}
                        disabled={!isPanelEnabled || selectedList?.hasIncomingTier}
                        placeholder={`Enter Tier ${index + 2} name...`}
                        className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                          !isPanelEnabled || selectedList?.hasIncomingTier ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </CollapsibleSection>

      {/* Applicability Section */}
      <CollapsibleSection 
        title="Applicability" 
        sectionKey="relationships"
        icon={<Link className="w-4 h-4 text-ag-dark-text-secondary" />}
        showRelationshipsGraph={true}
        actions={
          <div className="flex items-center gap-2">
            {/* Clone Applicability Button - Only show if list has no applicability */}
            <button
              onClick={() => setIsCloneListApplicabilityModalOpen(true)}
              disabled={!isPanelEnabled || (selectedList?.variables || 0) > 0}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                !isPanelEnabled || (selectedList?.variables || 0) > 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title={(selectedList?.variables || 0) > 0 ? "Please delete existing applicability to use clone" : "Clone applicability from another list"}
            >
              <Copy className="w-5 h-5" />
            </button>
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
          </div>
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
            {/* For Multi-Level lists, show only grid icon and graph icon */}
            {listType === 'Multi-Level' && !selectedList?.hasIncomingTier && (
              <button
                onClick={() => setIsTieredListValuesModalOpen(true)}
                disabled={!isPanelEnabled}
                className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg ${
                  !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title="Edit Tiered List Values"
              >
                <Grid3x3 className="w-5 h-5" />
              </button>
            )}
            {/* For Single lists, show sort and upload buttons */}
            {listType === 'Single' && !selectedList?.hasIncomingTier && (
              <>
                <button
                  onClick={() => handleSortListValues('asc')}
                  disabled={!isPanelEnabled}
                  className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg ${
                    !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title="Sort A-Z"
                >
                  <ArrowUpAZ className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleSortListValues('desc')}
                  disabled={!isPanelEnabled}
                  className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg ${
                    !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title="Sort Z-A"
                >
                  <ArrowDownZA className="w-5 h-5" />
                </button>
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
              </>
            )}
            {/* Graph icon - always show */}
            <button
              onClick={() => setListValuesGraphModalOpen(true)}
              disabled={!isPanelEnabled}
              className={`p-1 transition-colors ${
                isPanelEnabled 
                  ? 'text-ag-dark-text-secondary hover:text-ag-dark-accent' 
                  : 'text-ag-dark-text-secondary/30 cursor-not-allowed opacity-50'
              }`}
              title={isPanelEnabled ? "View List Values Graph" : "Select a list to view list values graph"}
            >
              <Network className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* For child lists (hasIncomingTier), show message instead of textarea */}
        {selectedList?.hasIncomingTier ? (
          <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
            <div className="text-sm text-ag-dark-text-secondary">
              This list is a tiered child list. List values are managed through the parent list's tiered values editor.
            </div>
          </div>
        ) : listType === 'Multi-Level' ? (
          <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
            <div className="text-sm text-ag-dark-text-secondary">
              This is a multi-level list. Use the grid icon above to edit tiered list values.
            </div>
          </div>
        ) : (
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
            placeholder={
              listValuesText.trim() === '' ? "Type one list value per line. Press Enter to add more. Use the upload icon to import from CSV." : undefined
            }
            rows={8}
            disabled={!isPanelEnabled}
            className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent resize-y ${
              !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
        )}
      </div>
      </div>

      {/* Actions - Fixed at bottom of panel, always visible */}
      {onSave && (
        <div className="flex-shrink-0 border-t border-ag-dark-border bg-ag-dark-surface px-6 py-4" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20 }}>
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

      {/* Variations CSV Upload Modal */}
      <CsvUploadModal
        isOpen={isVariationUploadOpen}
        onClose={() => setIsVariationUploadOpen(false)}
        type="variations"
        onUpload={handleVariationCsvUpload}
      />

      {/* Clone List Applicability Modal */}
      <CloneListApplicabilityModal
        isOpen={isCloneListApplicabilityModalOpen}
        onClose={() => setIsCloneListApplicabilityModalOpen(false)}
        targetList={selectedList}
        allLists={allData}
        onCloneSuccess={async () => {
          // Reload relationships after cloning
          await loadRelationships();
          // Refresh data after cloning
          if (onSave) {
            await onSave({ _refreshRelationships: true });
          }
          // Open the applicability modal to show the cloned relationships
          setIsVariableRelationshipModalOpen(true);
        }}
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

      {/* Variations Graph Modal */}
      {isVariationsGraphModalOpen && selectedList && (
        <ListsOntologyModal
          isOpen={isVariationsGraphModalOpen}
          onClose={() => setIsVariationsGraphModalOpen(false)}
          listId={selectedList.id}
          listName={selectedList.list}
          sectionName="Variations"
          viewType="variations"
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

      {/* List Values Graph Modal */}
      {listValuesGraphModalOpen && selectedList && (
        <ListsOntologyModal
          isOpen={listValuesGraphModalOpen}
          onClose={() => setListValuesGraphModalOpen(false)}
          listId={selectedList.id}
          listName={selectedList.list}
          sectionName="List Values"
          viewType="listValues"
          isBulkMode={false}
        />
      )}

      {/* Tiered List Values Modal */}
      <TieredListValuesModal
        isOpen={isTieredListValuesModalOpen}
        onClose={() => setIsTieredListValuesModalOpen(false)}
        selectedList={selectedList || null}
        allLists={allData}
        tierNames={tierNames}
        onSave={async (tieredValues) => {
          // Save tiered values - include all current form data to preserve list type and tier configuration
          if (onSave) {
            // Convert "ALL" to all individual values before saving (filter out "ALL" itself)
            const getDriverValuesForSave = (values: string[], allPossibleValues: string[]): string[] => {
              if (values.includes('ALL')) {
                return allPossibleValues.filter(v => v !== 'ALL');
              }
              return values.filter(v => v !== 'ALL');
            };
            
            const saveData: any = {
              ...formData,
              sector: getDriverValuesForSave(driverSelections.sector, driversData.sectors),
              domain: getDriverValuesForSave(driverSelections.domain, driversData.domains),
              country: getDriverValuesForSave(driverSelections.country, driversData.countries),
              variablesAttachedList: selectedVariables.length > 0 ? selectedVariables : variablesAttached,
              tieredListValues: tieredValues
            };
            
            // Always preserve Multi-Level configuration when saving from grid
            if (listType === 'Multi-Level') {
              const validTierNames = tierNames.filter(name => name.trim() !== '');
              saveData.listType = 'Multi-Level';
              saveData.numberOfLevels = numberOfLevels;
              saveData.tierNames = validTierNames;
              // Clear regular list values for multi-level lists
              saveData.listValuesList = [];
            }
            
            // Handle variationsList
            const variationsArray = variationsText
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0)
              .map((name) => ({ name }));
            
            if (variationsArray.length > 0) {
              saveData.variationsList = variationsArray;
            }
            
            // Save immediately
            await onSave(saveData);
            setIsTieredListValuesModalOpen(false);
          }
        }}
      />
    </div>
  );
};