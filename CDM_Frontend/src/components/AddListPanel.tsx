import React, { useState, useRef, useEffect } from 'react';
import { Settings, Save, X, Trash2, Plus, Link, Upload, List, Database, Users, FileText, ChevronRight, ChevronDown, Layers, Grid3x3, ArrowUpAZ, ArrowDownZA, Copy, Loader2 } from 'lucide-react';
import { listFieldOptions } from '../data/listsData';
import { ListCsvUploadModal } from './ListCsvUploadModal';
import { CsvUploadModal } from './CsvUploadModal';
import { useDrivers } from '../hooks/useDrivers';
import { useVariables } from '../hooks/useVariables';
import { VariableObjectRelationshipModal } from './VariableObjectRelationshipModal';
import { AddSetValueModal } from './AddSetValueModal';
import { AddGroupingValueModal } from './AddGroupingValueModal';
import { TieredListValuesModal } from './TieredListValuesModal';
import { SingleListValuesModal, type SingleListDraftRow } from './SingleListValuesModal';
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
  onAdd: (listData: any) => void | Promise<void>;
  allData?: any[];
  /** True while list is being created and grid is refetching */
  isSubmitting?: boolean;
}

export const AddListPanel: React.FC<AddListPanelProps> = ({
  isOpen,
  onClose,
  onAdd,
  allData = [],
  isSubmitting = false
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

  // Driver selections state - default to 'ALL' for sector, domain, and country
  const [driverSelections, setDriverSelections] = useState({
    sector: ['ALL'] as string[],
    domain: ['ALL'] as string[],
    country: ['ALL'] as string[]
  });

  // Relationship modal state
  const [isVariableRelationshipModalOpen, setIsVariableRelationshipModalOpen] = useState(false);
  const [selectedVariables, setSelectedVariables] = useState<any[]>([]);

  // Basic form data
  const [formData, setFormData] = useState({
    set: '',
    grouping: '',
    list: ''
  });

  // Variables attached and list values
  const [variablesAttached, setVariablesAttached] = useState<VariableAttached[]>([]);
  const [singleListDraftRows, setSingleListDraftRows] = useState<SingleListDraftRow[]>([]);
  const [isSingleListValuesModalOpen, setIsSingleListValuesModalOpen] = useState(false);

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

  const [listTypeSwitchDialog, setListTypeSwitchDialog] = useState<null | { newType: 'Single' | 'Multi-Level' }>(null);
  const [listTypeSwitchBusy, setListTypeSwitchBusy] = useState(false);
  
  // Refs for tier name input focus management
  const tierNameInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const tierNameInputFocusedRefs = useRef<Map<number, boolean>>(new Map());
  const tierNameLastChangeTimeRefs = useRef<Map<number, number>>(new Map());

  // CSV upload modal states
  const [isVariableAttachedUploadOpen, setIsVariableAttachedUploadOpen] = useState(false);
  
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

  // Reset to defaults when panel opens
  useEffect(() => {
    if (isOpen) {
      // Only reset if all driver selections are empty
      if (driverSelections.sector.length === 0 && 
          driverSelections.domain.length === 0 && 
          driverSelections.country.length === 0) {
        setDriverSelections({
          sector: ['ALL'],
          domain: ['ALL'],
          country: ['ALL']
        });
      }
    }
  }, [isOpen]);

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

  const handleVariableAttachedCsvUpload = (uploadedVariables: VariableAttached[]) => {
    setVariablesAttached(prev => [...prev, ...uploadedVariables]);
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
  const hasConfiguredDraftListValues = (): boolean => {
    if (singleListDraftRows.some(r => (r.value || '').trim())) return true;
    const loc = tieredListValues;
    const keys = Object.keys(loc).filter(k => k !== '_variations');
    if (
      keys.some(k => {
        const arr = (loc as Record<string, string[][]>)[k];
        return (
          Array.isArray(arr) &&
          arr.some(row => Array.isArray(row) && row.some(c => String(c || '').trim()))
        );
      })
    ) {
      return true;
    }
    const vars = (loc as { _variations?: Record<string, unknown> })._variations;
    return !!(vars && typeof vars === 'object' && Object.keys(vars).length > 0);
  };

  const mustConfirmAddListTypeSwitch = (
    prevType: 'Single' | 'Multi-Level',
    newType: 'Single' | 'Multi-Level'
  ): boolean => prevType !== newType && hasConfiguredDraftListValues();

  const applyAddListTypeLocally = (newType: 'Single' | 'Multi-Level') => {
    setListType(newType);
    if (newType === 'Single') {
      setNumberOfLevels(2);
      setTierNames(['', '']);
      setTieredListValues({});
      setSingleListDraftRows([]);
    } else {
      setNumberOfLevels(2);
      setTierNames(['', '']);
      setSingleListDraftRows([]);
      setTieredListValues({});
    }
  };

  const isFormValid = () => {
    const hasSector = driverSelections.sector.length > 0;
    const hasDomain = driverSelections.domain.length > 0;
    const hasCountry = driverSelections.country.length > 0;
    const hasSet = formData.set.trim() !== '';
    const hasGrouping = formData.grouping.trim() !== '';
    const hasListName = formData.list.trim() !== '';
    return hasSector && hasDomain && hasCountry && hasSet && hasGrouping && hasListName;
  };

  const handleAddList = async () => {
    if (isSubmitting) return;
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

    let listValuesArray: Array<{ id: string; value: string }> = [];
    let listValuesVariations: Record<string, string[]> | undefined;
    if (listType === 'Single') {
      const seen = new Set<string>();
      singleListDraftRows.forEach((row, index) => {
        const v = row.value.trim();
        if (!v) return;
        const k = v.toLowerCase();
        if (seen.has(k)) return;
        seen.add(k);
        listValuesArray.push({ id: `${Date.now()}-${index}`, value: v });
        const parts = row.variation.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length) {
          if (!listValuesVariations) listValuesVariations = {};
          listValuesVariations[v] = parts;
        }
      });
      const uniqueValues = new Set(listValuesArray.map(lv => lv.value.toLowerCase()));
      if (listValuesArray.length !== uniqueValues.size) {
        alert('Cannot add list: duplicate list values detected. Use the list values grid to fix duplicates.');
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
      format: '',
      source: '',
      upkeep: '',
      graph: '',
      origin: '',
      sector: driverSelections.sector.length === 1 && driverSelections.sector[0] === 'ALL' ? 'ALL' : driverSelections.sector.join(','),
      domain: driverSelections.domain.length === 1 && driverSelections.domain[0] === 'ALL' ? 'ALL' : driverSelections.domain.join(','),
      country: driverSelections.country.length === 1 && driverSelections.country[0] === 'ALL' ? 'ALL' : driverSelections.country.join(','),
      status: 'Active',
      variablesAttachedList: selectedVariables.length > 0 ? selectedVariables : variablesAttached,
      variationsList: variationsList,
      listType: listType
    };

    if (listType === 'Single') {
      newList.listValuesList = listValuesArray;
      if (listValuesVariations && Object.keys(listValuesVariations).length > 0) {
        newList.listValuesVariations = listValuesVariations;
      }
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

    try {
      await Promise.resolve(onAdd(newList));
    } catch {
      return;
    }

    setFormData({
      set: '',
      grouping: '',
      list: ''
    });
    setDriverSelections({
      sector: ['ALL'],
      domain: ['ALL'],
      country: ['ALL']
    });
    setVariablesAttached([]);
    setSingleListDraftRows([]);
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
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) {
              setIsOpen(!isOpen);
            }
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
            {options.map((option) => {
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
            })}
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
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors disabled:opacity-40 disabled:pointer-events-none"
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
          {/* List Type Dropdown */}
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              List Type
            </label>
            <select
              value={listType}
              onChange={(e) => {
                const newType = e.target.value as 'Single' | 'Multi-Level';
                if (newType === listType) return;
                if (mustConfirmAddListTypeSwitch(listType, newType)) {
                  setListTypeSwitchDialog({ newType });
                  return;
                }
                applyAddListTypeLocally(newType);
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

      {/* Applicability Section */}
      <CollapsibleSection 
        title="Applicability" 
        sectionKey="relationships"
        icon={<Link className="w-4 h-4 text-ag-dark-text-secondary" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              className="p-1.5 text-ag-dark-text-secondary rounded opacity-50 cursor-not-allowed"
              title="Save the list first to clone applicability from another list."
            >
              <Copy className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setIsVariableRelationshipModalOpen(true)}
              className="p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
              title="View and manage applicability"
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
          </div>
        }
      >
        <div className="mb-6">
          {selectedVariables.length === 0 ? (
            <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
              <div className="text-sm text-ag-dark-text-secondary">
                <span className="font-medium">No variables selected:</span> Use the grid icon above to select variables from the variables grid.
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
            {listType === 'Multi-Level' && (
              <button
                type="button"
                onClick={() => setIsTieredListValuesModalOpen(true)}
                className="p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
                title="Edit Tiered List Values"
              >
                <Grid3x3 className="w-5 h-5" />
              </button>
            )}
            {listType === 'Single' && (
              <button
                type="button"
                onClick={() => setIsSingleListValuesModalOpen(true)}
                className="p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
                title="Edit list values (grid and CSV)"
              >
                <Grid3x3 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {listType === 'Multi-Level' ? (
          <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
            <div className="text-sm text-ag-dark-text-secondary">
              This is a multi-level list. Use the grid icon above to edit tiered list values.
            </div>
          </div>
        ) : (
          <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
            <div className="text-sm text-ag-dark-text-secondary">
              This is a single-level list. Use the grid icon above to add or edit list values (including CSV upload).
            </div>
          </div>
        )}
      </div>

      {/* Add List Button */}
      <div className="mt-8 pt-6 border-t border-ag-dark-border">
        <button
          type="button"
          onClick={() => void handleAddList()}
          disabled={!isFormValid() || isSubmitting}
          className={`w-full py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 ${
            isFormValid() && !isSubmitting
              ? 'bg-ag-dark-accent text-white hover:bg-ag-dark-accent-hover'
              : 'bg-ag-dark-text-secondary text-ag-dark-text-secondary cursor-not-allowed opacity-50'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Add List
            </>
          )}
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

      <SingleListValuesModal
        isOpen={isSingleListValuesModalOpen}
        onClose={() => setIsSingleListValuesModalOpen(false)}
        selectedList={null}
        variant="draft"
        draftTitle={formData.list.trim() || 'New list'}
        draftInitialRows={singleListDraftRows}
        onDraftSave={setSingleListDraftRows}
      />

      {listTypeSwitchDialog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[120]"
          onClick={() => !listTypeSwitchBusy && setListTypeSwitchDialog(null)}
        >
          <div
            className="bg-ag-dark-surface rounded-lg border border-ag-dark-border max-w-md w-full mx-4 p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-ag-dark-text mb-3">Switch list type?</h3>
            <p className="text-sm text-ag-dark-text-secondary leading-relaxed mb-6">
              Are you sure you want to switch list type? You have list values configured for this list
              which will get cleared if you change the list type.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={listTypeSwitchBusy}
                onClick={() => setListTypeSwitchDialog(null)}
                className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={listTypeSwitchBusy}
                onClick={() => {
                  setListTypeSwitchBusy(true);
                  try {
                    applyAddListTypeLocally(listTypeSwitchDialog.newType);
                  } finally {
                    setListTypeSwitchBusy(false);
                    setListTypeSwitchDialog(null);
                  }
                }}
                className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};