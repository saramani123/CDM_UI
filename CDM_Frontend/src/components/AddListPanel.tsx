import React, { useState, useRef, useEffect } from 'react';
import { Settings, Save, X, Trash2, Plus, Link, Upload, List, Database, Users, FileText, ChevronRight, ChevronDown, ArrowUpAZ, ArrowDownZA, Layers, Grid } from 'lucide-react';
import { listFieldOptions } from '../data/listsData';
import { ListCsvUploadModal } from './ListCsvUploadModal';
import { CsvUploadModal } from './CsvUploadModal';
import { useDrivers } from '../hooks/useDrivers';
import { useVariables } from '../hooks/useVariables';
import { VariableObjectRelationshipModal } from './VariableObjectRelationshipModal';
import { AddSetValueModal } from './AddSetValueModal';
import { AddGroupingValueModal } from './AddGroupingValueModal';
import { TieredListValuesModal } from './TieredListValuesModal';
import { apiService } from '../services/api';

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

  // Local state to track Sets and Groupings (for immediate UI updates)
  const [localSets, setLocalSets] = useState<string[]>([]);
  const [localGroupings, setLocalGroupings] = useState<Record<string, string[]>>({});
  
  // Initialize local Sets and Groupings from allData
  useEffect(() => {
    const sets = [...new Set(allData.map((list: any) => list.set))].filter(Boolean).sort() as string[];
    setLocalSets(sets);
    
    const groupingsMap: Record<string, string[]> = {};
    allData.forEach((list: any) => {
      if (list.set && list.grouping) {
        if (!groupingsMap[list.set]) {
          groupingsMap[list.set] = [];
        }
        if (!groupingsMap[list.set].includes(list.grouping)) {
          groupingsMap[list.set].push(list.grouping);
        }
      }
    });
    Object.keys(groupingsMap).forEach(set => {
      groupingsMap[set].sort();
    });
    setLocalGroupings(groupingsMap);
  }, [allData]);

  // Get distinct Set values from actual lists data + local state
  const getDistinctSets = (): string[] => {
    const listsData = allData.length > 0 ? allData : [];
    const setsFromData = [...new Set(listsData.map((list: any) => list.set))].filter(Boolean) as string[];
    const allSets = [...new Set([...setsFromData, ...localSets])].sort();
    return allSets;
  };

  // Get distinct Grouping values for a specific Set from actual lists data + local state
  const getGroupingsForSet = (set: string): string[] => {
    if (!set) return [];
    const listsData = allData.length > 0 ? allData : [];
    const groupingsFromData = [...new Set(
      listsData
        .filter((list: any) => list.set === set && list.grouping)
        .map((list: any) => list.grouping)
    )].filter(Boolean) as string[];
    const groupingsFromLocal = localGroupings[set] || [];
    const allGroupings = [...new Set([...groupingsFromData, ...groupingsFromLocal])].sort();
    return allGroupings;
  };

  const handleAddSetValue = async (setValue: string) => {
    try {
      await apiService.addSetValue(setValue);
      // Update local state immediately so it appears in dropdown
      setLocalSets(prev => {
        if (!prev.includes(setValue)) {
          return [...prev, setValue].sort();
        }
        return prev;
      });
      // Also update formData to select the newly added Set
      handleChange('set', setValue);
    } catch (error) {
      throw error;
    }
  };

  const handleAddGroupingValue = async (set: string, groupingValue: string) => {
    try {
      await apiService.addGroupingValue(set, groupingValue);
      // Update local state immediately so it appears in dropdown
      setLocalGroupings(prev => {
        const currentGroupings = prev[set] || [];
        if (!currentGroupings.includes(groupingValue)) {
          return {
            ...prev,
            [set]: [...currentGroupings, groupingValue].sort()
          };
        }
        return prev;
      });
      // Also update formData to select the newly added Grouping
      handleChange('grouping', groupingValue);
    } catch (error) {
      throw error;
    }
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

  // Variations state
  const [variationsText, setVariationsText] = useState<string>('');
  const variationsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isVariationsTextareaFocusedRef = useRef(false);
  const lastVariationsChangeTimeRef = useRef(0);

  // List Type state - Single or Multi-Level
  const [listType, setListType] = useState<'Single' | 'Multi-Level'>('Single');
  
  // Number of tiers for Multi-Level lists (2-10)
  const [numberOfLevels, setNumberOfLevels] = useState<number>(2);
  
  // Tier names for Multi-Level lists (Tier 1, Tier 2, etc.)
  const [tierNames, setTierNames] = useState<string[]>(['', '']);
  
  // Tiered list values state
  const [tieredListValues, setTieredListValues] = useState<Record<string, string[][]>>({});
  const [isTieredListValuesModalOpen, setIsTieredListValuesModalOpen] = useState(false);
  
  // Refs for tier name input focus management
  const tierNameInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const tierNameInputFocusedRefs = useRef<Map<number, boolean>>(new Map());
  const tierNameLastChangeTimeRefs = useRef<Map<number, number>>(new Map());

  // Metadata input fields focus management
  const formatInputRef = useRef<HTMLInputElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const upkeepInputRef = useRef<HTMLInputElement>(null);
  const graphInputRef = useRef<HTMLInputElement>(null);
  const originInputRef = useRef<HTMLInputElement>(null);
  const isFormatInputFocusedRef = useRef<boolean>(false);
  const isSourceInputFocusedRef = useRef<boolean>(false);
  const isUpkeepInputFocusedRef = useRef<boolean>(false);
  const isGraphInputFocusedRef = useRef<boolean>(false);
  const isOriginInputFocusedRef = useRef<boolean>(false);
  const lastFormatChangeTimeRef = useRef<number>(0);
  const lastSourceChangeTimeRef = useRef<number>(0);
  const lastUpkeepChangeTimeRef = useRef<number>(0);
  const lastGraphChangeTimeRef = useRef<number>(0);
  const lastOriginChangeTimeRef = useRef<number>(0);

  // CSV upload modal states
  const [isVariableAttachedUploadOpen, setIsVariableAttachedUploadOpen] = useState(false);
  const [isListValuesUploadOpen, setIsListValuesUploadOpen] = useState(false);
  
  // Modal state for add set/grouping values
  const [isAddSetValueModalOpen, setIsAddSetValueModalOpen] = useState(false);
  const [isAddGroupingValueModalOpen, setIsAddGroupingValueModalOpen] = useState(false);
  const [isVariationUploadOpen, setIsVariationUploadOpen] = useState(false);
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    drivers: false,
    ontology: false,
    metadata: false,
    relationships: false,
    variations: false
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

  // Variations handlers
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
    const textarea = variationsTextareaRef.current;
    const cursorPosition = textarea?.selectionStart || 0;
    lastVariationsChangeTimeRef.current = Date.now();
    setVariationsText(text);
    requestAnimationFrame(() => {
      if (variationsTextareaRef.current && isVariationsTextareaFocusedRef.current) {
        variationsTextareaRef.current.focus();
        const maxPos = variationsTextareaRef.current.value.length;
        const safePos = Math.min(cursorPosition, maxPos);
        variationsTextareaRef.current.setSelectionRange(safePos, safePos);
      }
    });
  };

  const handleVariationCsvUpload = (data: any[] | File) => {
    if (Array.isArray(data)) {
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

    // Validate Multi-Level list configuration
    if (listType === 'Multi-Level') {
      const validTierNames = tierNames.filter(name => name.trim() !== '');
      if (validTierNames.length !== numberOfLevels) {
        alert(`Please provide names for all ${numberOfLevels} tier(s).`);
        return;
      }
    }

    // Convert textarea text to list values array (only for Single lists)
    let listValuesArray: Array<{ id: string; value: string }> = [];
    if (listType === 'Single') {
      listValuesArray = listValuesText
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
    }

    // Convert variations text to variationsList array
    let variationsList: Array<{ name: string }> = [];
    if (variationsText.trim() !== '') {
      const variationsArray = variationsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map((name) => ({ name }));
      
      // Check for duplicate variations (case-insensitive)
      const uniqueVariations = new Set(variationsArray.map(v => v.name.toLowerCase()));
      if (variationsArray.length !== uniqueVariations.size) {
        const duplicateVariations = variationsArray.filter((v, index) => 
          variationsArray.findIndex(v2 => v2.name.toLowerCase() === v.name.toLowerCase()) !== index
        ).map(v => v.name);
        
        alert(`Cannot add list: Duplicate variations found: ${duplicateVariations.join(', ')}. Please remove duplicates before adding.`);
        return;
      }
      
      variationsList = variationsArray;
    }

    const newList: any = {
      id: `list-${Date.now()}`,
      ...formData,
      sector: driverSelections.sector.length === 1 && driverSelections.sector[0] === 'ALL' ? 'ALL' : driverSelections.sector.join(','),
      domain: driverSelections.domain.length === 1 && driverSelections.domain[0] === 'ALL' ? 'ALL' : driverSelections.domain.join(','),
      country: driverSelections.country.length === 1 && driverSelections.country[0] === 'ALL' ? 'ALL' : driverSelections.country.join(','),
      status: 'Active',
      variablesAttachedList: selectedVariables.length > 0 ? selectedVariables : variablesAttached,
      variationsList: variationsList,
      listType: listType
    };

    // Include list values only for Single lists
    if (listType === 'Single') {
      newList.listValuesList = listValuesArray;
    }

    // Include tiered list configuration for Multi-Level lists
    if (listType === 'Multi-Level') {
      newList.numberOfLevels = numberOfLevels;
      newList.tierNames = tierNames.filter(name => name.trim() !== '');
      // Include tiered list values if user has entered them
      // Check if tieredListValues has actual data (not just empty dict or only _variations)
      const tieredValuesKeys = Object.keys(tieredListValues);
      const hasActualValues = tieredValuesKeys.some(key => {
        if (key === '_variations') return false;
        const value = tieredListValues[key];
        return Array.isArray(value) && value.length > 0;
      });
      
      console.log('AddListPanel handleAddList: Checking tieredListValues:', {
        listType,
        tieredValuesKeys,
        hasActualValues,
        tieredListValuesLength: tieredValuesKeys.length,
        hasVariations: !!(tieredListValues as any)._variations,
        sampleKeys: tieredValuesKeys.slice(0, 3)
      });
      
      // Always include tieredListValues if it exists (even if empty, to clear existing values)
      // The backend will check if it's empty and skip processing
      if (tieredValuesKeys.length > 0 || hasActualValues) {
        console.log('AddListPanel: Including tieredListValues in newList');
        newList.tieredListValues = tieredListValues;
      } else {
        console.log('AddListPanel: tieredListValues is empty, not including in newList');
      }
    }

    console.log('AddListPanel: Final newList being passed to onAdd:', {
      listType: newList.listType,
      numberOfLevels: newList.numberOfLevels,
      tierNames: newList.tierNames,
      hasTieredListValues: 'tieredListValues' in newList,
      tieredListValuesKeys: newList.tieredListValues ? Object.keys(newList.tieredListValues) : 'N/A'
    });

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
    setVariationsText('');
    setSelectedVariables([]);
    setListType('Single');
    setNumberOfLevels(2);
    setTierNames(['', '']);
    setTieredListValues({});
    
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
    <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border flex flex-col h-full max-h-[calc(100vh-8rem)] overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex items-center justify-between p-6 pb-4 border-b border-ag-dark-border flex-shrink-0">
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

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6" style={{ minHeight: 0 }}>

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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-ag-dark-text">
                Set <span className="text-ag-dark-error">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsAddSetValueModalOpen(true);
                }}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors"
                title="Add new Set value"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
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
              {getDistinctSets().map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-ag-dark-text">
                Grouping <span className="text-ag-dark-error">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsAddGroupingValueModalOpen(true);
                }}
                disabled={!formData.set}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Add new Grouping value"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.grouping}
              onChange={(e) => handleChange('grouping', e.target.value)}
              disabled={!formData.set}
              className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                !formData.set ? 'opacity-50 cursor-not-allowed' : ''
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
                  ? getGroupingsForSet(formData.set)
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
      <CollapsibleSection title="Metadata" sectionKey="metadata" icon={<FileText className="w-4 h-4 text-ag-dark-text-secondary" />}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Format
            </label>
            <input
              ref={formatInputRef}
              type="text"
              value={formData.format}
              onInput={(e) => {
                e.stopPropagation();
                const input = e.target as HTMLInputElement;
                const cursorPosition = input.selectionStart;
                const newValue = input.value;
                lastFormatChangeTimeRef.current = Date.now();
                handleChange('format', newValue);
                const restoreFocus = () => {
                  if (formatInputRef.current) {
                    formatInputRef.current.focus();
                    const maxPos = formatInputRef.current.value.length;
                    const safePos = Math.min(cursorPosition, maxPos);
                    formatInputRef.current.setSelectionRange(safePos, safePos);
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
              onFocus={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); isFormatInputFocusedRef.current = true; }}
              onBlur={(e) => {
                const timeSinceLastChange = Date.now() - lastFormatChangeTimeRef.current;
                const wasRecentTyping = timeSinceLastChange < 300;
                const relatedTarget = e.relatedTarget as HTMLElement;
                const clickedOnInput = relatedTarget && (relatedTarget.tagName === 'INPUT' || relatedTarget.tagName === 'TEXTAREA' || relatedTarget.isContentEditable);
                if (wasRecentTyping && !clickedOnInput && formatInputRef.current && isFormatInputFocusedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  setTimeout(() => { if (formatInputRef.current) formatInputRef.current.focus(); }, 0);
                } else if (!wasRecentTyping) {
                  isFormatInputFocusedRef.current = false;
                }
              }}
              placeholder="Enter format..."
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Source
            </label>
            <input
              ref={sourceInputRef}
              type="text"
              value={formData.source}
              onInput={(e) => {
                e.stopPropagation();
                const input = e.target as HTMLInputElement;
                const cursorPosition = input.selectionStart;
                const newValue = input.value;
                lastSourceChangeTimeRef.current = Date.now();
                handleChange('source', newValue);
                const restoreFocus = () => {
                  if (sourceInputRef.current) {
                    sourceInputRef.current.focus();
                    const maxPos = sourceInputRef.current.value.length;
                    const safePos = Math.min(cursorPosition, maxPos);
                    sourceInputRef.current.setSelectionRange(safePos, safePos);
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
              onFocus={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); isSourceInputFocusedRef.current = true; }}
              onBlur={(e) => {
                const timeSinceLastChange = Date.now() - lastSourceChangeTimeRef.current;
                const wasRecentTyping = timeSinceLastChange < 300;
                const relatedTarget = e.relatedTarget as HTMLElement;
                const clickedOnInput = relatedTarget && (relatedTarget.tagName === 'INPUT' || relatedTarget.tagName === 'TEXTAREA' || relatedTarget.isContentEditable);
                if (wasRecentTyping && !clickedOnInput && sourceInputRef.current && isSourceInputFocusedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  setTimeout(() => { if (sourceInputRef.current) sourceInputRef.current.focus(); }, 0);
                } else if (!wasRecentTyping) {
                  isSourceInputFocusedRef.current = false;
                }
              }}
              placeholder="Enter source..."
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Upkeep
            </label>
            <input
              ref={upkeepInputRef}
              type="text"
              value={formData.upkeep}
              onInput={(e) => {
                e.stopPropagation();
                const input = e.target as HTMLInputElement;
                const cursorPosition = input.selectionStart;
                const newValue = input.value;
                lastUpkeepChangeTimeRef.current = Date.now();
                handleChange('upkeep', newValue);
                const restoreFocus = () => {
                  if (upkeepInputRef.current) {
                    upkeepInputRef.current.focus();
                    const maxPos = upkeepInputRef.current.value.length;
                    const safePos = Math.min(cursorPosition, maxPos);
                    upkeepInputRef.current.setSelectionRange(safePos, safePos);
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
              onFocus={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); isUpkeepInputFocusedRef.current = true; }}
              onBlur={(e) => {
                const timeSinceLastChange = Date.now() - lastUpkeepChangeTimeRef.current;
                const wasRecentTyping = timeSinceLastChange < 300;
                const relatedTarget = e.relatedTarget as HTMLElement;
                const clickedOnInput = relatedTarget && (relatedTarget.tagName === 'INPUT' || relatedTarget.tagName === 'TEXTAREA' || relatedTarget.isContentEditable);
                if (wasRecentTyping && !clickedOnInput && upkeepInputRef.current && isUpkeepInputFocusedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  setTimeout(() => { if (upkeepInputRef.current) upkeepInputRef.current.focus(); }, 0);
                } else if (!wasRecentTyping) {
                  isUpkeepInputFocusedRef.current = false;
                }
              }}
              placeholder="Enter upkeep..."
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Graph
            </label>
            <input
              ref={graphInputRef}
              type="text"
              value={formData.graph}
              onInput={(e) => {
                e.stopPropagation();
                const input = e.target as HTMLInputElement;
                const cursorPosition = input.selectionStart;
                const newValue = input.value;
                lastGraphChangeTimeRef.current = Date.now();
                handleChange('graph', newValue);
                const restoreFocus = () => {
                  if (graphInputRef.current) {
                    graphInputRef.current.focus();
                    const maxPos = graphInputRef.current.value.length;
                    const safePos = Math.min(cursorPosition, maxPos);
                    graphInputRef.current.setSelectionRange(safePos, safePos);
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
              onFocus={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); isGraphInputFocusedRef.current = true; }}
              onBlur={(e) => {
                const timeSinceLastChange = Date.now() - lastGraphChangeTimeRef.current;
                const wasRecentTyping = timeSinceLastChange < 300;
                const relatedTarget = e.relatedTarget as HTMLElement;
                const clickedOnInput = relatedTarget && (relatedTarget.tagName === 'INPUT' || relatedTarget.tagName === 'TEXTAREA' || relatedTarget.isContentEditable);
                if (wasRecentTyping && !clickedOnInput && graphInputRef.current && isGraphInputFocusedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  setTimeout(() => { if (graphInputRef.current) graphInputRef.current.focus(); }, 0);
                } else if (!wasRecentTyping) {
                  isGraphInputFocusedRef.current = false;
                }
              }}
              placeholder="Enter graph..."
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Origin
            </label>
            <input
              ref={originInputRef}
              type="text"
              value={formData.origin}
              onInput={(e) => {
                e.stopPropagation();
                const input = e.target as HTMLInputElement;
                const cursorPosition = input.selectionStart;
                const newValue = input.value;
                lastOriginChangeTimeRef.current = Date.now();
                handleChange('origin', newValue);
                const restoreFocus = () => {
                  if (originInputRef.current) {
                    originInputRef.current.focus();
                    const maxPos = originInputRef.current.value.length;
                    const safePos = Math.min(cursorPosition, maxPos);
                    originInputRef.current.setSelectionRange(safePos, safePos);
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
              onFocus={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); isOriginInputFocusedRef.current = true; }}
              onBlur={(e) => {
                const timeSinceLastChange = Date.now() - lastOriginChangeTimeRef.current;
                const wasRecentTyping = timeSinceLastChange < 300;
                const relatedTarget = e.relatedTarget as HTMLElement;
                const clickedOnInput = relatedTarget && (relatedTarget.tagName === 'INPUT' || relatedTarget.tagName === 'TEXTAREA' || relatedTarget.isContentEditable);
                if (wasRecentTyping && !clickedOnInput && originInputRef.current && isOriginInputFocusedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  setTimeout(() => { if (originInputRef.current) originInputRef.current.focus(); }, 0);
                } else if (!wasRecentTyping) {
                  isOriginInputFocusedRef.current = false;
                }
              }}
              placeholder="Enter origin..."
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
          </div>

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
                  setTierNames(['', '']);
                  setTieredListValues({});
                } else {
                  // Initialize with 2 tiers (Tier 1 and Tier 2)
                  setNumberOfLevels(2);
                  setTierNames(['', '']);
                  // Clear list values when switching to Multi-Level
                  // (they will be managed via grid modal instead)
                  setListValuesText('');
                }
              }}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
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
                    // Adjust tier names array to match new number of tiers
                    const newTierNames = [...tierNames];
                    const tiersNeeded = newLevels;
                    while (newTierNames.length < tiersNeeded) {
                      newTierNames.push('');
                    }
                    while (newTierNames.length > tiersNeeded) {
                      newTierNames.pop();
                    }
                    setTierNames(newTierNames);
                  }}
                  className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
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
              {numberOfLevels > 0 && (
                <div className="space-y-3">
                  {Array.from({ length: numberOfLevels }, (_, index) => (
                    <div key={`tier-input-${index}`}>
                      <label className="block text-sm font-medium text-ag-dark-text mb-2">
                        Tier {index + 1} Name
                      </label>
                      <input
                        ref={(el) => {
                          if (el) {
                            tierNameInputRefs.current.set(index, el);
                          } else {
                            tierNameInputRefs.current.delete(index);
                          }
                        }}
                        type="text"
                        value={tierNames[index] || ''}
                        onInput={(e) => {
                          e.stopPropagation();
                          const input = e.target as HTMLInputElement;
                          const cursorPosition = input.selectionStart;
                          const newValue = input.value;
                          tierNameLastChangeTimeRefs.current.set(index, Date.now());
                          const newTierNames = [...tierNames];
                          newTierNames[index] = newValue;
                          setTierNames(newTierNames);
                          const restoreFocus = () => {
                            const inputRef = tierNameInputRefs.current.get(index);
                            if (inputRef) {
                              inputRef.focus();
                              const maxPos = inputRef.value.length;
                              const safePos = Math.min(cursorPosition, maxPos);
                              inputRef.setSelectionRange(safePos, safePos);
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
                          tierNameInputFocusedRefs.current.set(index, true);
                        }}
                        onBlur={(e) => {
                          const lastChangeTime = tierNameLastChangeTimeRefs.current.get(index) || 0;
                          const timeSinceLastChange = Date.now() - lastChangeTime;
                          const wasRecentTyping = timeSinceLastChange < 300;
                          const relatedTarget = e.relatedTarget as HTMLElement;
                          const clickedOnInput = relatedTarget && (relatedTarget.tagName === 'INPUT' || relatedTarget.tagName === 'TEXTAREA' || relatedTarget.isContentEditable);
                          const inputRef = tierNameInputRefs.current.get(index);
                          const isFocused = tierNameInputFocusedRefs.current.get(index) || false;
                          if (wasRecentTyping && !clickedOnInput && inputRef && isFocused) {
                            e.preventDefault();
                            e.stopPropagation();
                            setTimeout(() => {
                              const ref = tierNameInputRefs.current.get(index);
                              if (ref) ref.focus();
                            }, 0);
                          } else if (!wasRecentTyping) {
                            tierNameInputFocusedRefs.current.set(index, false);
                          }
                        }}
                        placeholder={`Enter Tier ${index + 1} name...`}
                        className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
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
            {/* For Multi-Level lists, show only grid icon */}
            {listType === 'Multi-Level' && (
              <button
                onClick={() => setIsTieredListValuesModalOpen(true)}
                className="p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
                title="Edit Tiered List Values"
              >
                <Grid className="w-5 h-5" />
              </button>
            )}
            {/* For Single lists, show sort and upload buttons */}
            {listType === 'Single' && (
              <>
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
              </>
            )}
          </div>
        </div>
        
        {/* For Multi-Level lists, show message instead of textarea */}
        {listType === 'Multi-Level' ? (
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
            placeholder={listValuesText.trim() === '' ? "Type one list value per line. Press Enter to add more. Use the upload icon to import from CSV." : undefined}
            rows={8}
            className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent resize-y"
          />
        )}
      </div>

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
            handleVariationsTextChange(e.target.value);
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
               !relatedTarget.isContentEditable);
            
            if (wasRecentTyping && clickedOutside && variationsTextareaRef.current && isVariationsTextareaFocusedRef.current) {
              setTimeout(() => {
                if (variationsTextareaRef.current && document.activeElement !== variationsTextareaRef.current) {
                  variationsTextareaRef.current.focus();
                }
              }, 10);
            } else if (!wasRecentTyping) {
              isVariationsTextareaFocusedRef.current = false;
            }
          }}
          placeholder={variationsText.trim() === '' ? "Type one variation per line. Press Enter to add more. Use the upload icon to import from CSV." : undefined}
          rows={8}
          className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent resize-y"
        />
      </CollapsibleSection>

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
      </div>

      {/* CSV Upload Modals */}
      <ListCsvUploadModal
        isOpen={isVariableAttachedUploadOpen}
        onClose={() => setIsVariableAttachedUploadOpen(false)}
        type="variables-attached"
        onUpload={handleVariableAttachedCsvUpload}
      />
      
      {/* Add Set Value Modal */}
      <AddSetValueModal
        isOpen={isAddSetValueModalOpen}
        onClose={() => {
          setIsAddSetValueModalOpen(false);
        }}
        onSave={handleAddSetValue}
      />

      {/* Add Grouping Value Modal */}
      <AddGroupingValueModal
        isOpen={isAddGroupingValueModalOpen}
        onClose={() => {
          setIsAddGroupingValueModalOpen(false);
        }}
        onSave={handleAddGroupingValue}
        availableSets={getDistinctSets()}
        defaultSet={formData.set || ''}
      />

      <ListCsvUploadModal
        isOpen={isListValuesUploadOpen}
        onClose={() => setIsListValuesUploadOpen(false)}
        type="list-values"
        onUpload={handleListValuesCsvUpload}
      />

      <CsvUploadModal
        isOpen={isVariationUploadOpen}
        onClose={() => setIsVariationUploadOpen(false)}
        type="variations"
        onUpload={handleVariationCsvUpload}
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

      {/* Tiered List Values Modal */}
      <TieredListValuesModal
        isOpen={isTieredListValuesModalOpen}
        onClose={() => setIsTieredListValuesModalOpen(false)}
        selectedList={formData.list ? {
          id: '',
          list: formData.list,
          set: formData.set,
          grouping: formData.grouping,
          sector: driverSelections.sector,
          domain: driverSelections.domain,
          country: driverSelections.country
        } as any : null}
        allLists={allData}
        tierNames={tierNames}
        initialValues={tieredListValues}
        onSave={(tieredValues) => {
          console.log('AddListPanel: Received tiered values from modal:', {
            type: typeof tieredValues,
            keys: Object.keys(tieredValues),
            hasVariations: !!(tieredValues as any)._variations,
            sampleData: Object.keys(tieredValues).slice(0, 2).reduce((acc, key) => {
              if (key !== '_variations') {
                acc[key] = Array.isArray(tieredValues[key]) ? `${tieredValues[key].length} arrays` : typeof tieredValues[key];
              }
              return acc;
            }, {} as any)
          });
          setTieredListValues(tieredValues);
        }}
      />
    </div>
  );
};