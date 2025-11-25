import React, { useState, useRef, useEffect } from 'react';
import { Settings, Save, Trash2, Plus, Link, Layers, Upload, ChevronRight, ChevronDown, Database, Users, Key, ArrowUpAZ, ArrowDownZA, Network, FileText, List, Eye, Copy, Grid3x3 } from 'lucide-react';
import { concatenateDrivers } from '../data/mockData';
import { CsvUploadModal } from './CsvUploadModal';
import { OntologyModal } from './OntologyModal';
import { RelationshipModal } from './RelationshipModal';
import { CloneRelationshipsModal } from './CloneRelationshipsModal';
import { CloneIdentifiersModal } from './CloneIdentifiersModal';
import { AddBeingValueModal } from './AddBeingValueModal';
import { AddAvatarValueModal } from './AddAvatarValueModal';
import { useDrivers } from '../hooks/useDrivers';
import { useVariables } from '../hooks/useVariables';
import { VariableListRelationshipModal } from './VariableListRelationshipModal';
import { ListsOntologyModal } from './ListsOntologyModal';
import { VariableListRelationshipsGraphModal } from './VariableListRelationshipsGraphModal';
import { CloneListApplicabilityModal } from './CloneListApplicabilityModal';
import { ListCsvUploadModal } from './ListCsvUploadModal';
import { apiService } from '../services/api';

interface CompositeKey {
  id: string;
  part: string;
  group: string;
  variables: string[];
}

interface Variant {
  id: string;
  name: string;
}

interface Relationship {
  id: string;
  type: 'Blood' | 'Intra-Table' | 'Inter-Table';
  role: string;
  toBeing: string;
  toAvatar: string;
  toObject: string;
}

interface BulkEditPanelProps {
  isOpen: boolean;
  onClose: () => void; // Still needed for internal cleanup, but not exposed to user
  onSave: (data: Record<string, any>) => void;
  selectedCount: number;
  allData?: any[];
  activeTab?: string;
  selectedObjects?: any[]; // Array of selected objects for bulk ontology view
  onObjectsRefresh?: () => void | Promise<void>; // Callback to refresh objects data
}

export const BulkEditPanel: React.FC<BulkEditPanelProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedCount,
  allData = [],
  activeTab = 'objects',
  selectedObjects = [],
  onObjectsRefresh
}) => {
  // Basic form data - Objects
  const [formData, setFormData] = useState({
    being: '',
    avatar: '',
    objectName: ''
  });

  // Lists form data
  const [listFormData, setListFormData] = useState({
    list: '',
    set: '',
    grouping: '',
    format: '',
    source: '',
    upkeep: '',
    graph: '',
    origin: ''
  });

  // Driver selections state
  const [driverSelections, setDriverSelections] = useState({
    sector: [] as string[],
    domain: [] as string[],
    country: [] as string[],
    objectClarifier: ''
  });

  // Lists driver selections state (same structure as Objects)
  const [listDriverSelections, setListDriverSelections] = useState({
    sector: [] as string[],
    domain: [] as string[],
    country: [] as string[]
  });

  // Use only API drivers data
  const { drivers: apiDrivers } = useDrivers();
  const { variables: variablesData } = useVariables();
  const driversData = apiDrivers || {
    sectors: [],
    domains: [],
    countries: [],
    objectClarifiers: [],
    variableClarifiers: []
  };

  // Identifier data - changed to support multiple unique IDs
  interface UniqueIdEntry {
    id: string;
    variableId: string;
  }
  const [uniqueIdEntries, setUniqueIdEntries] = useState<UniqueIdEntry[]>([{ id: 'unique-1', variableId: '' }]);
  const [compositeKeys, setCompositeKeys] = useState<CompositeKey[]>([
    { id: '1', part: '', group: '', variables: [] },
    { id: '2', part: '', group: '', variables: [] },
    { id: '3', part: '', group: '', variables: [] },
    { id: '4', part: '', group: '', variables: [] },
    { id: '5', part: '', group: '', variables: [] }
  ]);

  // Relationships and variants - using string for multiline input
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [variantsText, setVariantsText] = useState('');
  const [variantsArray, setVariantsArray] = useState<Variant[]>([]);
  
  // List values textarea state (for bulk edit - always starts empty)
  const [listValuesText, setListValuesText] = useState<string>('');
  const listValuesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isListValuesTextareaFocusedRef = useRef(false);
  const lastListValuesChangeTimeRef = useRef(0);

  // Variations state for lists (for bulk edit - always starts empty)
  const [variationsText, setVariationsText] = useState<string>('');
  const variationsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isVariationsTextareaFocusedRef = useRef(false);
  const lastVariationsChangeTimeRef = useRef(0);
  const [isVariationUploadOpen, setIsVariationUploadOpen] = useState(false);
  const [isVariationsGraphModalOpen, setIsVariationsGraphModalOpen] = useState(false);

  // State for add being/avatar value modals
  const [isAddBeingValueModalOpen, setIsAddBeingValueModalOpen] = useState(false);
  const [isAddAvatarValueModalOpen, setIsAddAvatarValueModalOpen] = useState(false);
  const [beingAvatarUpdateTrigger, setBeingAvatarUpdateTrigger] = useState(0);
  const variantsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isTextareaFocusedRef = useRef<boolean>(false);
  const lastChangeTimeRef = useRef<number>(0);

  // List metadata input fields focus management (for lists tab)
  const listFormatInputRef = useRef<HTMLInputElement>(null);
  const listSourceInputRef = useRef<HTMLInputElement>(null);
  const listUpkeepInputRef = useRef<HTMLInputElement>(null);
  const listGraphInputRef = useRef<HTMLInputElement>(null);
  const listOriginInputRef = useRef<HTMLInputElement>(null);
  const isListFormatInputFocusedRef = useRef<boolean>(false);
  const isListSourceInputFocusedRef = useRef<boolean>(false);
  const isListUpkeepInputFocusedRef = useRef<boolean>(false);
  const isListGraphInputFocusedRef = useRef<boolean>(false);
  const isListOriginInputFocusedRef = useRef<boolean>(false);
  const lastListFormatChangeTimeRef = useRef<number>(0);
  const lastListSourceChangeTimeRef = useRef<number>(0);
  const lastListUpkeepChangeTimeRef = useRef<number>(0);
  const lastListGraphChangeTimeRef = useRef<number>(0);
  const lastListOriginChangeTimeRef = useRef<number>(0);

  const handleSortVariants = (direction: 'asc' | 'desc') => {
    const lines = variantsText.split('\n').filter(line => line.trim() !== '');
    const sortedLines = [...lines].sort((a, b) => {
      const aTrimmed = a.trim().toLowerCase();
      const bTrimmed = b.trim().toLowerCase();
      if (direction === 'asc') {
        return aTrimmed.localeCompare(bTrimmed);
      } else {
        return bTrimmed.localeCompare(aTrimmed);
      }
    });
    setVariantsText(sortedLines.join('\n') + (variantsText.endsWith('\n') ? '\n' : ''));
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

  // Handle list values CSV upload
  const handleListValuesCsvUpload = (uploadedValues: any[]) => {
    // Append uploaded values to existing textarea text
    const existingLines = listValuesText.split('\n').filter(line => line.trim());
    const existingSet = new Set(existingLines.map(line => line.trim().toLowerCase()));
    
    // Filter out duplicates (case-insensitive)
    const newValues = uploadedValues
      .map((lv: any) => lv.value?.trim() || lv.name?.trim() || '')
      .filter((val: string) => val && !existingSet.has(val.toLowerCase()));
    
    if (newValues.length < uploadedValues.length) {
      const skippedCount = uploadedValues.length - newValues.length;
      alert(`Uploaded ${newValues.length} new list values. Skipped ${skippedCount} duplicates.`);
    }
    
    // Append new values to textarea
    const newLines = newValues.join('\n');
    setListValuesText(prev => prev ? `${prev}\n${newLines}` : newLines);
  };

  // Variations handlers for lists
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

  // CSV upload modal states
  const [isRelationshipUploadOpen, setIsRelationshipUploadOpen] = useState(false);
  const [isVariantUploadOpen, setIsVariantUploadOpen] = useState(false);
  const [isListValuesUploadOpen, setIsListValuesUploadOpen] = useState(false);
  
  // Relationship modal state
  const [isRelationshipModalOpen, setIsRelationshipModalOpen] = useState(false);
  const [isCloneRelationshipsModalOpen, setIsCloneRelationshipsModalOpen] = useState(false);
  
  // Clone identifiers modal state
  const [isCloneIdentifiersModalOpen, setIsCloneIdentifiersModalOpen] = useState(false);
  
  // Check if any selected objects have relationships
  const [hasExistingRelationships, setHasExistingRelationships] = useState(false);
  const [objectsWithRelationships, setObjectsWithRelationships] = useState<string[]>([]);
  
  // Check if any selected objects have identifiers
  const [hasExistingIdentifiers, setHasExistingIdentifiers] = useState(false);
  const [objectsWithIdentifiers, setObjectsWithIdentifiers] = useState<string[]>([]);
  
  // Lists relationships state
  const [selectedVariables, setSelectedVariables] = useState<any[]>([]);
  const [isVariableRelationshipModalOpen, setIsVariableRelationshipModalOpen] = useState(false);
  const [isCloneListApplicabilityModalOpen, setIsCloneListApplicabilityModalOpen] = useState(false);
  const [relationshipsGraphModalOpen, setRelationshipsGraphModalOpen] = useState(false);
  
  // Check if any selected lists are part of a tiered structure
  const hasTieredLists = activeTab === 'lists' && allData.some((list: any) => {
    if (!list) return false;
    // Check if list is a parent (has tieredListsList) or child (hasIncomingTier)
    return (list.tieredListsList && list.tieredListsList.length > 0) || list.hasIncomingTier;
  });
  
  // Lists ontology modal state
  const [listsOntologyModalOpen, setListsOntologyModalOpen] = useState<{
    isOpen: boolean;
    viewType: 'drivers' | 'ontology' | 'metadata' | 'listValues' | 'variations' | null;
  }>({ isOpen: false, viewType: null });
  
  // List values graph modal state
  const [listValuesGraphModalOpen, setListValuesGraphModalOpen] = useState(false);

  const openListsOntologyModal = (viewType: 'drivers' | 'ontology' | 'metadata' | 'listValues' | 'variations') => {
    setListsOntologyModalOpen({ isOpen: true, viewType });
  };

  const closeListsOntologyModal = () => {
    setListsOntologyModalOpen({ isOpen: false, viewType: null });
  };

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    drivers: false,
    ontology: false,
    identifiers: false,
    relationships: false,
    variants: false,
    metadata: false,
    listValues: false,
    variations: false
  });

  // Ontology modal state
  const [ontologyModalOpen, setOntologyModalOpen] = useState<{
    isOpen: boolean;
    viewType: 'drivers' | 'ontology' | 'identifiers' | 'relationships' | 'variants' | null;
  }>({ isOpen: false, viewType: null });

  const openBulkOntologyModal = (viewType: 'drivers' | 'ontology' | 'identifiers' | 'relationships' | 'variants') => {
    setOntologyModalOpen({ isOpen: true, viewType });
  };

  const closeBulkOntologyModal = () => {
    setOntologyModalOpen({ isOpen: false, viewType: null });
  };

  // Storage keys for Being and Avatar values
  const BEING_STORAGE_KEY = 'cdm_object_being_values';
  const BEING_AVATAR_STORAGE_KEY = 'cdm_object_being_avatar_associations';

  // Helper functions to manage Being and Avatar values in localStorage
  const getBeingValues = (): string[] => {
    try {
      const stored = localStorage.getItem(BEING_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error reading being values from localStorage:', error);
    }
    return [];
  };

  const saveBeingValue = (value: string): void => {
    try {
      const existing = getBeingValues();
      if (!existing.includes(value)) {
        const updated = [...existing, value].sort();
        localStorage.setItem(BEING_STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Error saving being value to localStorage:', error);
    }
  };

  const getBeingAvatarAssociations = (): Record<string, string[]> => {
    try {
      const stored = localStorage.getItem(BEING_AVATAR_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error reading being-avatar associations from localStorage:', error);
    }
    return {};
  };

  const saveBeingAvatarAssociation = (being: string, avatar: string): void => {
    try {
      const associations = getBeingAvatarAssociations();
      if (!associations[being]) {
        associations[being] = [];
      }
      if (!associations[being].includes(avatar)) {
        associations[being] = [...associations[being], avatar].sort();
        localStorage.setItem(BEING_AVATAR_STORAGE_KEY, JSON.stringify(associations));
      }
    } catch (error) {
      console.error('Error saving being-avatar association to localStorage:', error);
    }
  };

  // Get distinct values from data for relationships
  const getDistinctBeings = () => {
    const beingsFromData = [...new Set(allData.map(item => item.being))];
    const beingsFromStorage = getBeingValues();
    const allBeings = [...new Set([...beingsFromData, ...beingsFromStorage])];
    return ['ALL', ...allBeings];
  };

  const getDistinctAvatarsForBeing = (being: string) => {
    if (being === 'ALL') return ['ALL'];
    const avatarsFromData = [...new Set(allData.filter(item => item.being === being).map(item => item.avatar))];
    const associations = getBeingAvatarAssociations();
    const avatarsFromStorage = associations[being] || [];
    const allAvatars = [...new Set([...avatarsFromData, ...avatarsFromStorage])];
    return ['ALL', ...allAvatars];
  };

  // Handlers for adding Being and Avatar values
  const handleAddBeingValue = async (value: string): Promise<void> => {
    saveBeingValue(value);
    setBeingAvatarUpdateTrigger(prev => prev + 1); // Trigger re-render
  };

  const handleAddAvatarValue = async (being: string, avatar: string): Promise<void> => {
    saveBeingAvatarAssociation(being, avatar);
    setBeingAvatarUpdateTrigger(prev => prev + 1); // Trigger re-render
  };

  if (!isOpen) return null;

  // Get dynamic avatar options based on current being from grid data
  // Include beingAvatarUpdateTrigger dependency to force re-render when values are added
  const avatarOptions = React.useMemo(() => {
    return getDistinctAvatarsForBeing(formData.being || '');
  }, [formData.being, beingAvatarUpdateTrigger, allData]);

  const getDistinctObjectsForBeingAndAvatar = (being: string, avatar: string) => {
    if (being === 'ALL' || avatar === 'ALL') return ['ALL'];
    const objects = [...new Set(allData.filter(item => 
      item.being === being && item.avatar === avatar
    ).map(item => item.object))];
    return ['ALL', ...objects];
  };

  // Helper functions to get filtered data from variables
  const getAllParts = () => {
    const parts = [...new Set(variablesData.map(v => v.part))].filter(Boolean).sort();
    return parts;
  };

  const getGroupsForPart = (part: string) => {
    if (!part) return [];
    const groups = [...new Set(
      variablesData.filter(v => v.part === part).map(v => v.group)
    )].filter(Boolean).sort();
    return groups;
  };

  const getVariablesForPartAndGroup = (part: string, group: string) => {
    if (!part || !group) return [];
    return variablesData
      .filter(v => v.part === part && v.group === group)
      .map(v => ({ id: v.id, name: v.variable }));
  };

  const getUniqueIdVariables = () => {
    return variablesData
      .filter(v => v.part === 'Identifier' && v.group === 'Public ID')
      .map(v => ({ id: v.id, name: v.variable }));
  };
  
  // Add a new unique ID entry
  const handleAddUniqueIdEntry = () => {
    const newId = `unique-${Date.now()}`;
    setUniqueIdEntries(prev => [...prev, { id: newId, variableId: '' }]);
  };
  
  // Remove a unique ID entry
  const handleRemoveUniqueIdEntry = (entryId: string) => {
    setUniqueIdEntries(prev => prev.filter(entry => entry.id !== entryId));
  };
  
  // Update variable selection for a specific unique ID entry
  const handleUniqueIdVariableChange = (entryId: string, variableId: string) => {
    setUniqueIdEntries(prev => prev.map(entry => 
      entry.id === entryId ? { ...entry, variableId } : entry
    ));
  };
  
  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Get distinct Set values from actual lists data
  const getDistinctSets = (): string[] => {
    if (activeTab !== 'lists') return [];
    const listsData = allData as any[];
    const sets = [...new Set(listsData.map((list: any) => list.set))].filter(Boolean).sort() as string[];
    return sets;
  };

  // Get groupings for a specific set from lists data
  const getGroupingsForSet = (set: string): string[] => {
    if (!set || activeTab !== 'lists') return [];
    
    // Get groupings from existing lists data for this set
    const listsData = allData as any[];
    const groupings = [...new Set(
      listsData
        .filter((list: any) => list.set === set && list.grouping)
        .map((list: any) => list.grouping)
    )].filter(Boolean) as string[];
    
    return groupings;
  };

  const handleChange = (key: string, value: string) => {
    if (activeTab === 'lists') {
      setListFormData(prev => {
        const newData = {
          ...prev,
          [key]: value
        };
        
        // If set is changed, reset grouping if it doesn't belong to the new set
        if (key === 'set') {
          const groupingsForNewSet = getGroupingsForSet(value);
          if (prev.grouping && !groupingsForNewSet.includes(prev.grouping)) {
            newData.grouping = '';
          }
        }
        
        return newData;
      });
    } else {
      setFormData(prev => {
        const newFormData = {
          ...prev,
          [key]: value
        };
        
        // If being is changed, reset avatar since avatars are specific to each being
        if (key === 'being') {
          newFormData.avatar = '';
        }
        
        return newFormData;
      });
    }
  };

  const handleDriverSelectionChange = (type: 'sector' | 'domain' | 'country', values: string[]) => {
    if (activeTab === 'lists') {
      setListDriverSelections(prev => ({
        ...prev,
        [type]: values
      }));
    } else {
      setDriverSelections(prev => ({
        ...prev,
        [type]: values
      }));
    }
  };

  const handleObjectClarifierChange = (value: string) => {
    setDriverSelections(prev => ({
      ...prev,
      objectClarifier: value
    }));
  };

  const handleCompositeKeyChange = (id: string, field: 'part' | 'group', value: string) => {
    setCompositeKeys(prev => prev.map(key => {
      if (key.id === id) {
        const updated = { ...key, [field]: value };
        if (field === 'part') {
          updated.group = '';
          updated.variables = [];
        } else if (field === 'group') {
          updated.variables = [];
        }
        return updated;
      }
      return key;
    }));
  };

  const handleCompositeKeyVariablesChange = (id: string, variables: string[]) => {
    setCompositeKeys(prev => prev.map(key => 
      key.id === id ? { ...key, variables } : key
    ));
  };

  const handleDeleteCompositeKey = (id: string) => {
    setCompositeKeys(prev => prev.map(key => 
      key.id === id ? { id: key.id, part: '', group: '', variables: [] } : key
    ));
  };

  const handleRelationshipChange = (id: string, field: keyof Relationship, value: string) => {
    setRelationships(prev => prev.map(rel => {
      if (rel.id === id) {
        const updated = { ...rel, [field]: value };
        
        // Handle Intra-Table logic
        if (field === 'type' && value === 'Intra-Table') {
          // Auto-populate with current form data
          updated.toBeing = formData.being;
          updated.toAvatar = formData.avatar;
          updated.toObject = formData.objectName;
        } else if (field === 'type' && value !== 'Intra-Table') {
          // Reset fields when switching away from Intra-Table
          updated.toBeing = '';
          updated.toAvatar = '';
          updated.toObject = '';
        } else if (updated.type !== 'Intra-Table') {
          // Handle cascading updates for non-Intra-Table types
          if (field === 'toBeing' && value === 'ALL') {
            updated.toAvatar = 'ALL';
            updated.toObject = 'ALL';
          } else if (field === 'toAvatar' && value === 'ALL') {
            updated.toObject = 'ALL';
          } else if (field === 'toBeing' && value !== 'ALL') {
            updated.toAvatar = '';
            updated.toObject = '';
          } else if (field === 'toAvatar' && value !== 'ALL') {
            updated.toObject = '';
          }
        }
        
        return updated;
      }
      return rel;
    }));
  };

  const addRelationship = () => {
    const newRelationship: Relationship = {
      id: Date.now().toString(),
      type: 'Inter-Table',
      role: '',
      toBeing: '',
      toAvatar: '',
      toObject: ''
    };
    setRelationships(prev => [...prev, newRelationship]);
  };

  const deleteRelationship = (id: string) => {
    setRelationships(prev => prev.filter(rel => rel.id !== id));
  };

  const handleVariantsTextChange = (text: string) => {
    setVariantsText(text);
  };

  const handleRelationshipCsvUpload = (data: any[] | File) => {
    if (data instanceof File) {
      // Handle file upload if needed in the future
      console.warn('File upload not yet supported for relationships in bulk edit');
    } else {
      // Handle array of relationships
      setRelationships(prev => [...prev, ...data as Relationship[]]);
    }
  };

  const handleVariantCsvUpload = async (data: any[] | File) => {
    // Check if it's a File (new API-based upload) or array (old client-side parsing)
    if (data instanceof File) {
      try {
        // For bulk edit, we need to handle the file upload differently
        // We'll parse the CSV client-side and add to the variants textarea
        const reader = new FileReader();
        reader.onload = (e) => {
          let csv = e.target?.result as string;
          if (!csv) return;
          
          // Parse CSV
          const lines = csv.split('\n').filter(line => line.trim());
          if (lines.length < 2) {
            alert('CSV file must have at least a header and one data row');
            return;
          }
          
          const header = lines[0].toLowerCase();
          if (!header.includes('variant')) {
            alert('CSV file must have a "Variant" column');
            return;
          }
          
          const variantIndex = lines[0].split(',').findIndex(col => 
            col.toLowerCase().trim().replace(/"/g, '') === 'variant'
          );
          
          if (variantIndex === -1) {
            alert('Could not find "Variant" column in CSV');
            return;
          }
          
          const newVariants: Variant[] = [];
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(val => val.trim().replace(/"/g, ''));
            if (values[variantIndex] && values[variantIndex].trim()) {
              newVariants.push({
                id: Date.now().toString() + i,
                name: values[variantIndex].trim()
              });
            }
          }
          
          if (newVariants.length > 0) {
            // Append to textarea
            const newLines = newVariants.map(v => v.name).join('\n');
            setVariantsText(prev => prev ? `${prev}\n${newLines}` : newLines);
            alert(`Successfully added ${newVariants.length} variants from CSV`);
          } else {
            alert('No valid variants found in CSV');
          }
        };
        reader.readAsText(data);
      } catch (error) {
        console.error('CSV variants upload failed:', error);
        alert(`Variants upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Handle array of variants - append to textarea
      const newLines = data.map((v: any) => v.name).join('\n');
      setVariantsText(prev => prev ? `${prev}\n${newLines}` : newLines);
    }
  };

  const handleSaveBulkEdit = () => {
    if (activeTab === 'lists') {
      // Handle Lists bulk edit
      const saveData: Record<string, any> = {};
      
      // Add list name if changed
      if (listFormData.list.trim() !== '') {
        saveData.list = listFormData.list;
      }
      
      // Add driver selections if any are selected
      // Convert "ALL" to all individual values before saving (filter out "ALL" itself)
      const getDriverValuesForSave = (values: string[], allPossibleValues: string[]): string => {
        const filteredValues = values.filter(v => v !== 'ALL');
        if (values.includes('ALL')) {
          // If "ALL" is selected, return all individual values (excluding "ALL")
          const allValues = allPossibleValues.filter(v => v !== 'ALL');
          return allValues.join(',');
        }
        return filteredValues.join(',');
      };
      
      if (listDriverSelections.sector.length > 0) {
        saveData.sector = getDriverValuesForSave(listDriverSelections.sector, driversData.sectors);
      }
      if (listDriverSelections.domain.length > 0) {
        saveData.domain = getDriverValuesForSave(listDriverSelections.domain, driversData.domains);
      }
      if (listDriverSelections.country.length > 0) {
        saveData.country = getDriverValuesForSave(listDriverSelections.country, driversData.countries);
      }
      
      // Add ontology fields if changed
      if (listFormData.set.trim() !== '') {
        saveData.set = listFormData.set;
      }
      if (listFormData.grouping.trim() !== '') {
        saveData.grouping = listFormData.grouping;
      }
      
      // Add metadata fields if changed
      if (listFormData.format.trim() !== '') {
        saveData.format = listFormData.format;
      }
      if (listFormData.source.trim() !== '') {
        saveData.source = listFormData.source;
      }
      if (listFormData.upkeep.trim() !== '') {
        saveData.upkeep = listFormData.upkeep;
      }
      if (listFormData.graph.trim() !== '') {
        saveData.graph = listFormData.graph;
      }
      if (listFormData.origin.trim() !== '') {
        saveData.origin = listFormData.origin;
      }
      
      // Add relationships if selected (for future implementation)
      if (selectedVariables.length > 0) {
        saveData.variablesAttachedList = selectedVariables;
      }
      
      // Add list values if entered (will be appended to each selected list)
      if (listValuesText.trim() !== '') {
        const listValuesArray = listValuesText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map((value, index) => ({
            id: (Date.now() + index).toString(),
            value
          }));
        
        // Check for duplicate values (case-insensitive) within the entered values
        const uniqueValues = new Set(listValuesArray.map(lv => lv.value.toLowerCase()));
        if (listValuesArray.length !== uniqueValues.size) {
          const duplicateValues = listValuesArray.filter((lv, index) => 
            listValuesArray.findIndex(v => v.value.toLowerCase() === lv.value.toLowerCase()) !== index
          ).map(lv => lv.value);
          
          alert(`Cannot save: Duplicate list values found: ${duplicateValues.join(', ')}. Please remove duplicates before saving.`);
          return;
        }
        
        saveData.listValuesList = listValuesArray;
      }
      
      // Handle variationsList - parse from textarea and check for duplicates
      if (variationsText.trim() !== '') {
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
        
        saveData.variationsList = variationsArray;
      }
      
      console.log('🔄 BulkEditPanel (Lists) - saveData:', saveData);
      onSave(saveData);
      return;
    }
    
    // Handle Objects bulk edit (existing logic)
    // Generate driver string from selections if any driver fields are selected
    const hasDriverSelections = driverSelections.sector.length > 0 || 
                               driverSelections.domain.length > 0 || 
                               driverSelections.country.length > 0 || 
                               driverSelections.objectClarifier;
    
    const driverString = hasDriverSelections ? concatenateDrivers(
      driverSelections.sector,
      driverSelections.domain,
      driverSelections.country,
      driverSelections.objectClarifier
    ) : '';
    
    // Remove duplicate relationships based on unique combination of properties
    const uniqueRelationships = relationships.reduce((acc, rel) => {
      if (!acc.some(existing => 
        existing.role === rel.role && 
        existing.toBeing === rel.toBeing && 
        existing.toAvatar === rel.toAvatar && 
        existing.toObject === rel.toObject && 
        existing.type === rel.type
      )) {
        acc.push(rel);
      }
      return acc;
    }, [] as Relationship[]);
    
    console.log('DEBUG: Original relationships count:', relationships.length);
    console.log('DEBUG: Unique relationships count:', uniqueRelationships.length);
    console.log('DEBUG: Duplicate relationships removed:', relationships.length - uniqueRelationships.length);

    // Convert multiline text to variants array
    const variantsList = variantsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map((name, index) => ({
        id: (Date.now() + index).toString(),
        name
      }));

    // Check for duplicate variant names (case-insensitive)
    const uniqueVariantNames = new Set(variantsList.map(v => v.name.toLowerCase()));
    
    if (variantsList.length !== uniqueVariantNames.size) {
      const duplicateNames = variantsList.filter((variant, index) => 
        variantsList.findIndex(v => v.name.toLowerCase() === variant.name.toLowerCase()) !== index
      ).map(v => v.name);
      
      alert(`Cannot save: Duplicate variant names found: ${duplicateNames.join(', ')}. Please remove duplicates before saving.`);
      return;
    }

    // Validate unique IDs - check for duplicates
    const uniqueIdVariableIds = uniqueIdEntries
      .map(entry => entry.variableId)
      .filter(Boolean);
    const duplicateVariableIds = uniqueIdVariableIds.filter((id, index) => 
      uniqueIdVariableIds.indexOf(id) !== index
    );
    
    if (duplicateVariableIds.length > 0) {
      const duplicateNames = duplicateVariableIds.map(id => {
        const varData = getUniqueIdVariables().find(v => v.id === id);
        return varData?.name || id;
      });
      alert(`Cannot save: You have added duplicate unique IDs. Duplicate variables: ${duplicateNames.join(', ')}. Please remove duplicates before saving.`);
      return;
    }
    
    // Extract unique ID variable IDs list
    const uniqueIdVariableIdsList = uniqueIdEntries
      .map(entry => entry.variableId)
      .filter(Boolean);
    
    const hasIdentifiers = uniqueIdVariableIdsList.length > 0 || compositeKeys.some(key => key.part && key.group);
    const identifierData = hasIdentifiers ? {
      discreteId: {
        variables: uniqueIdVariableIdsList
      },
      compositeIds: compositeKeys.reduce((acc, key) => {
        if (key.part && key.group) {
          acc[key.id] = {
            part: key.part,
            group: key.group,
            variables: key.variables
          };
        }
        return acc;
      }, {} as Record<string, { part: string; group: string; variables: string[] }>)
    } : undefined;

    const saveData = {
      ...(formData.being && formData.being.trim() !== '' && { being: formData.being }),
      ...(formData.avatar && formData.avatar.trim() !== '' && { avatar: formData.avatar }),
      ...(formData.objectName && formData.objectName.trim() !== '' && { objectName: formData.objectName }),
      ...(driverString && { driver: driverString }),
      ...(identifierData && { identifier: identifierData }),
      relationshipsList: uniqueRelationships,
      variantsList: variantsList
    };
    
    console.log('🔄 BulkEditPanel - saveData:', saveData);
    console.log('🔄 BulkEditPanel - variants array:', variantsList);
    console.log('🔄 BulkEditPanel - variantsList field:', saveData.variantsList);
    
    onSave(saveData);
    // Note: onClose() is called automatically when selection changes via useEffect in App.tsx
    // No need to call it here explicitly as the panel closes when selection becomes single
  };

    // Check if any selected objects have existing relationships
    useEffect(() => {
      const checkRelationships = async () => {
        if (activeTab !== 'objects' || selectedObjects.length === 0) {
          setHasExistingRelationships(false);
          setObjectsWithRelationships([]);
          return;
        }

        const objectsWithRels: string[] = [];
        for (const obj of selectedObjects) {
          if (obj.relationships && obj.relationships > 0) {
            objectsWithRels.push(obj.object || obj.id);
          }
        }

        setHasExistingRelationships(objectsWithRels.length > 0);
        setObjectsWithRelationships(objectsWithRels);
      };

      checkRelationships();
    }, [selectedObjects, activeTab]);

    // Check if any selected objects have existing identifiers
    useEffect(() => {
      const checkIdentifiers = async () => {
        if (activeTab !== 'objects' || selectedObjects.length === 0) {
          setHasExistingIdentifiers(false);
          setObjectsWithIdentifiers([]);
          return;
        }

        const objectsWithIds: string[] = [];
        for (const obj of selectedObjects) {
          // Check if object has identifiers by loading its data
          try {
            const objectData = await apiService.getObject(obj.id) as any;
            const hasUniqueIds = (objectData?.discreteIds || []).length > 0;
            const hasCompositeIds = Object.values(objectData?.compositeIds || {}).some((compIds: any) => 
              Array.isArray(compIds) && compIds.length > 0
            );
            
            if (hasUniqueIds || hasCompositeIds) {
              objectsWithIds.push(obj.object || obj.id);
            }
          } catch (error) {
            console.error(`Error checking identifiers for object ${obj.id}:`, error);
          }
        }

        setHasExistingIdentifiers(objectsWithIds.length > 0);
        setObjectsWithIdentifiers(objectsWithIds);
      };

      checkIdentifiers();
    }, [selectedObjects, activeTab]);

  // Multi-select component
  const MultiSelect: React.FC<{
    label: string;
    options: string[];
    values: string[];
    onChange: (values: string[]) => void;
    disabled?: boolean;
    compact?: boolean;
  }> = ({ label, options, values, onChange, disabled = false, compact = false }) => {
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
      ? `Keep Current ${label}` 
      : values.includes('ALL') 
        ? 'ALL' 
        : values.length === 1 
          ? values[0] 
          : `${values.length} selected`;

    const buttonClass = compact
      ? `w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent text-left ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`
      : `w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent text-left ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`;

    const iconSize = compact ? '12px' : '16px';
    const iconPosition = compact ? 'right 8px center' : 'right 12px center';

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={buttonClass}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: iconPosition,
            backgroundRepeat: 'no-repeat',
            backgroundSize: iconSize
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
    ontologyViewType?: 'drivers' | 'ontology' | 'identifiers' | 'relationships' | 'variants' | 'metadata';
    listsOntologyViewType?: 'drivers' | 'ontology' | 'metadata' | 'variations';
    showRelationshipsGraph?: boolean;
  }> = ({ title, sectionKey, icon, actions, children, ontologyViewType, listsOntologyViewType, showRelationshipsGraph }) => {
    const isExpanded = expandedSections[sectionKey];
    const hasSelectedObjects = selectedObjects && selectedObjects.length > 0;
    const isListsMode = activeTab === 'lists';
    
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
            {isListsMode && showRelationshipsGraph && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasSelectedObjects) {
                    setRelationshipsGraphModalOpen(true);
                  }
                }}
                disabled={!hasSelectedObjects}
                className={`p-1 transition-colors ${
                  hasSelectedObjects 
                    ? 'text-ag-dark-text-secondary hover:text-ag-dark-accent' 
                    : 'text-ag-dark-text-secondary/30 cursor-not-allowed opacity-50'
                }`}
                title={hasSelectedObjects ? "View Variable-List Applicability Graph" : "Select lists to view applicability graph"}
              >
                <Network className="w-4 h-4" />
              </button>
            )}
            {isListsMode && listsOntologyViewType && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasSelectedObjects) {
                    openListsOntologyModal(listsOntologyViewType);
                  }
                }}
                disabled={!hasSelectedObjects}
                className={`p-1 transition-colors ${
                  hasSelectedObjects 
                    ? 'text-ag-dark-text-secondary hover:text-ag-dark-accent' 
                    : 'text-ag-dark-text-secondary/30 cursor-not-allowed opacity-50'
                }`}
                title={hasSelectedObjects ? "View Neo4j Ontology" : "Select lists to view ontology"}
              >
                {listsOntologyViewType === 'metadata' ? <Eye className="w-4 h-4" /> : <Network className="w-4 h-4" />}
              </button>
            )}
            {!isListsMode && ontologyViewType && ontologyViewType !== 'metadata' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasSelectedObjects) {
                    openBulkOntologyModal(ontologyViewType as 'drivers' | 'ontology' | 'identifiers' | 'relationships' | 'variants');
                  }
                }}
                disabled={!hasSelectedObjects}
                className={`p-1 transition-colors ${
                  hasSelectedObjects 
                    ? 'text-ag-dark-text-secondary hover:text-ag-dark-accent' 
                    : 'text-ag-dark-text-secondary/30 cursor-not-allowed opacity-50'
                }`}
                title={hasSelectedObjects ? "View Neo4j Ontology" : "Select objects to view ontology"}
              >
                <Network className="w-4 h-4" />
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
    <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-ag-dark-text-secondary" />
          <h3 className="text-lg font-semibold text-ag-dark-text">Edit Selected</h3>
        </div>
        {/* Close button removed - panel closes automatically when selection becomes single */}
      </div>

      {/* Bulk Edit Mode Notice - Always Visible */}
      <div className="bg-ag-dark-bg rounded-lg border border-ag-dark-border p-4 mb-6">
        <div className="text-sm text-ag-dark-text">
          <span className="font-semibold text-ag-dark-accent">Bulk Edit Mode:</span> Changes will be applied to all {selectedCount} selected {activeTab === 'lists' ? 'lists' : 'objects'}. {activeTab === 'lists' ? 'Setting any field to a different value will override existing values for those lists.' : 'New relationships and variants will be appended to existing ones.'}
        </div>
      </div>

      {/* Conditional rendering based on activeTab */}
      {activeTab === 'lists' ? (
        <>
          {/* List Name Field */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              List Name
            </label>
            <input
              type="text"
              value={listFormData.list}
              onChange={(e) => handleChange('list', e.target.value)}
              placeholder="Keep current list names"
              onClick={(e) => e.stopPropagation()}
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
          </div>

          {/* Drivers Section - Lists */}
          <CollapsibleSection 
            title="Drivers" 
            sectionKey="drivers" 
            icon={<Database className="w-4 h-4 text-ag-dark-text-secondary" />}
            listsOntologyViewType="drivers"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Sector
                </label>
                <MultiSelect
                  label="Sector"
                  options={['ALL', ...driversData.sectors]}
                  values={listDriverSelections.sector}
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
                  values={listDriverSelections.domain}
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
                  values={listDriverSelections.country}
                  onChange={(values) => handleDriverSelectionChange('country', values)}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Ontology Section - Lists */}
          <CollapsibleSection 
            title="Ontology" 
            sectionKey="ontology" 
            icon={<Users className="w-4 h-4 text-ag-dark-text-secondary" />}
            listsOntologyViewType="ontology"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Set
                </label>
                <select
                  value={listFormData.set}
                  onChange={(e) => handleChange('set', e.target.value)}
                  className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 12px center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '16px'
                  }}
                >
                  <option value="">Keep Current Set</option>
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
                  value={listFormData.grouping}
                  onChange={(e) => handleChange('grouping', e.target.value)}
                  disabled={!listFormData.set || listFormData.set.trim() === ''}
                  className={`w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                    !listFormData.set || listFormData.set.trim() === '' 
                      ? 'opacity-50 cursor-not-allowed' 
                      : ''
                  }`}
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 12px center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '16px'
                  }}
                  title={!listFormData.set || listFormData.set.trim() === '' 
                    ? 'Please select a Set first' 
                    : ''}
                >
                  <option value="">Keep Current Grouping</option>
                  {(() => {
                    const groupingsForSet = listFormData.set 
                      ? getGroupingsForSet(listFormData.set)
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

          {/* Metadata Section - Lists */}
          <CollapsibleSection 
            title="Metadata" 
            sectionKey="metadata" 
            icon={<FileText className="w-4 h-4 text-ag-dark-text-secondary" />}
            listsOntologyViewType="metadata"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Format
                </label>
                <input
                  ref={listFormatInputRef}
                  type="text"
                  value={listFormData.format}
                  onInput={(e) => {
                    e.stopPropagation();
                    const input = e.target as HTMLInputElement;
                    const cursorPosition = input.selectionStart;
                    const newValue = input.value;
                    lastListFormatChangeTimeRef.current = Date.now();
                    handleChange('format', newValue);
                    const restoreFocus = () => {
                      if (listFormatInputRef.current) {
                        listFormatInputRef.current.focus();
                        const maxPos = listFormatInputRef.current.value.length;
                        const safePos = Math.min(cursorPosition, maxPos);
                        listFormatInputRef.current.setSelectionRange(safePos, safePos);
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
                  onFocus={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); isListFormatInputFocusedRef.current = true; }}
                  onBlur={(e) => {
                    const timeSinceLastChange = Date.now() - lastListFormatChangeTimeRef.current;
                    const wasRecentTyping = timeSinceLastChange < 300;
                    const relatedTarget = e.relatedTarget as HTMLElement;
                    const clickedOnInput = relatedTarget && (relatedTarget.tagName === 'INPUT' || relatedTarget.tagName === 'TEXTAREA' || relatedTarget.isContentEditable);
                    if (wasRecentTyping && !clickedOnInput && listFormatInputRef.current && isListFormatInputFocusedRef.current) {
                      e.preventDefault();
                      e.stopPropagation();
                      setTimeout(() => { if (listFormatInputRef.current) listFormatInputRef.current.focus(); }, 0);
                    } else if (!wasRecentTyping) {
                      isListFormatInputFocusedRef.current = false;
                    }
                  }}
                  placeholder="Keep current format"
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Source
                </label>
                <input
                  ref={listSourceInputRef}
                  type="text"
                  value={listFormData.source}
                  onInput={(e) => {
                    e.stopPropagation();
                    const input = e.target as HTMLInputElement;
                    const cursorPosition = input.selectionStart;
                    const newValue = input.value;
                    lastListSourceChangeTimeRef.current = Date.now();
                    handleChange('source', newValue);
                    const restoreFocus = () => {
                      if (listSourceInputRef.current) {
                        listSourceInputRef.current.focus();
                        const maxPos = listSourceInputRef.current.value.length;
                        const safePos = Math.min(cursorPosition, maxPos);
                        listSourceInputRef.current.setSelectionRange(safePos, safePos);
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
                  onFocus={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); isListSourceInputFocusedRef.current = true; }}
                  onBlur={(e) => {
                    const timeSinceLastChange = Date.now() - lastListSourceChangeTimeRef.current;
                    const wasRecentTyping = timeSinceLastChange < 300;
                    const relatedTarget = e.relatedTarget as HTMLElement;
                    const clickedOnInput = relatedTarget && (relatedTarget.tagName === 'INPUT' || relatedTarget.tagName === 'TEXTAREA' || relatedTarget.isContentEditable);
                    if (wasRecentTyping && !clickedOnInput && listSourceInputRef.current && isListSourceInputFocusedRef.current) {
                      e.preventDefault();
                      e.stopPropagation();
                      setTimeout(() => { if (listSourceInputRef.current) listSourceInputRef.current.focus(); }, 0);
                    } else if (!wasRecentTyping) {
                      isListSourceInputFocusedRef.current = false;
                    }
                  }}
                  placeholder="Keep current source"
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Upkeep
                </label>
                <input
                  ref={listUpkeepInputRef}
                  type="text"
                  value={listFormData.upkeep}
                  onInput={(e) => {
                    e.stopPropagation();
                    const input = e.target as HTMLInputElement;
                    const cursorPosition = input.selectionStart;
                    const newValue = input.value;
                    lastListUpkeepChangeTimeRef.current = Date.now();
                    handleChange('upkeep', newValue);
                    const restoreFocus = () => {
                      if (listUpkeepInputRef.current) {
                        listUpkeepInputRef.current.focus();
                        const maxPos = listUpkeepInputRef.current.value.length;
                        const safePos = Math.min(cursorPosition, maxPos);
                        listUpkeepInputRef.current.setSelectionRange(safePos, safePos);
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
                  onFocus={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); isListUpkeepInputFocusedRef.current = true; }}
                  onBlur={(e) => {
                    const timeSinceLastChange = Date.now() - lastListUpkeepChangeTimeRef.current;
                    const wasRecentTyping = timeSinceLastChange < 300;
                    const relatedTarget = e.relatedTarget as HTMLElement;
                    const clickedOnInput = relatedTarget && (relatedTarget.tagName === 'INPUT' || relatedTarget.tagName === 'TEXTAREA' || relatedTarget.isContentEditable);
                    if (wasRecentTyping && !clickedOnInput && listUpkeepInputRef.current && isListUpkeepInputFocusedRef.current) {
                      e.preventDefault();
                      e.stopPropagation();
                      setTimeout(() => { if (listUpkeepInputRef.current) listUpkeepInputRef.current.focus(); }, 0);
                    } else if (!wasRecentTyping) {
                      isListUpkeepInputFocusedRef.current = false;
                    }
                  }}
                  placeholder="Keep current upkeep"
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Graph
                </label>
                <input
                  ref={listGraphInputRef}
                  type="text"
                  value={listFormData.graph}
                  onInput={(e) => {
                    e.stopPropagation();
                    const input = e.target as HTMLInputElement;
                    const cursorPosition = input.selectionStart;
                    const newValue = input.value;
                    lastListGraphChangeTimeRef.current = Date.now();
                    handleChange('graph', newValue);
                    const restoreFocus = () => {
                      if (listGraphInputRef.current) {
                        listGraphInputRef.current.focus();
                        const maxPos = listGraphInputRef.current.value.length;
                        const safePos = Math.min(cursorPosition, maxPos);
                        listGraphInputRef.current.setSelectionRange(safePos, safePos);
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
                  onFocus={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); isListGraphInputFocusedRef.current = true; }}
                  onBlur={(e) => {
                    const timeSinceLastChange = Date.now() - lastListGraphChangeTimeRef.current;
                    const wasRecentTyping = timeSinceLastChange < 300;
                    const relatedTarget = e.relatedTarget as HTMLElement;
                    const clickedOnInput = relatedTarget && (relatedTarget.tagName === 'INPUT' || relatedTarget.tagName === 'TEXTAREA' || relatedTarget.isContentEditable);
                    if (wasRecentTyping && !clickedOnInput && listGraphInputRef.current && isListGraphInputFocusedRef.current) {
                      e.preventDefault();
                      e.stopPropagation();
                      setTimeout(() => { if (listGraphInputRef.current) listGraphInputRef.current.focus(); }, 0);
                    } else if (!wasRecentTyping) {
                      isListGraphInputFocusedRef.current = false;
                    }
                  }}
                  placeholder="Keep current graph"
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  Origin
                </label>
                <input
                  ref={listOriginInputRef}
                  type="text"
                  value={listFormData.origin}
                  onInput={(e) => {
                    e.stopPropagation();
                    const input = e.target as HTMLInputElement;
                    const cursorPosition = input.selectionStart;
                    const newValue = input.value;
                    lastListOriginChangeTimeRef.current = Date.now();
                    handleChange('origin', newValue);
                    const restoreFocus = () => {
                      if (listOriginInputRef.current) {
                        listOriginInputRef.current.focus();
                        const maxPos = listOriginInputRef.current.value.length;
                        const safePos = Math.min(cursorPosition, maxPos);
                        listOriginInputRef.current.setSelectionRange(safePos, safePos);
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
                  onFocus={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); isListOriginInputFocusedRef.current = true; }}
                  onBlur={(e) => {
                    const timeSinceLastChange = Date.now() - lastListOriginChangeTimeRef.current;
                    const wasRecentTyping = timeSinceLastChange < 300;
                    const relatedTarget = e.relatedTarget as HTMLElement;
                    const clickedOnInput = relatedTarget && (relatedTarget.tagName === 'INPUT' || relatedTarget.tagName === 'TEXTAREA' || relatedTarget.isContentEditable);
                    if (wasRecentTyping && !clickedOnInput && listOriginInputRef.current && isListOriginInputFocusedRef.current) {
                      e.preventDefault();
                      e.stopPropagation();
                      setTimeout(() => { if (listOriginInputRef.current) listOriginInputRef.current.focus(); }, 0);
                    } else if (!wasRecentTyping) {
                      isListOriginInputFocusedRef.current = false;
                    }
                  }}
                  placeholder="Keep current origin"
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Applicability Section - Lists */}
          <CollapsibleSection 
            title="Applicability" 
            sectionKey="relationships"
            icon={<Link className="w-4 h-4 text-ag-dark-text-secondary" />}
            showRelationshipsGraph={true}
            actions={
              <div className="flex items-center gap-2">
                {/* Clone Applicability Button - Only show if no selected lists have applicability */}
                {(() => {
                  const hasExistingApplicability = activeTab === 'lists' && selectedObjects.length > 0 && 
                    selectedObjects.some((list: any) => (list.variables || 0) > 0);
                  const listsWithApplicability = activeTab === 'lists' && selectedObjects.length > 0
                    ? selectedObjects.filter((list: any) => (list.variables || 0) > 0).map((list: any) => list.list).filter(Boolean)
                    : [];
                  
                  return (
                    <button
                      onClick={() => setIsCloneListApplicabilityModalOpen(true)}
                      disabled={selectedCount === 0 || hasExistingApplicability}
                      className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                        selectedCount === 0 || hasExistingApplicability ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
                      }`}
                      title={
                        selectedCount === 0 
                          ? "Select lists to clone applicability" 
                          : hasExistingApplicability 
                            ? `Please delete existing applicability for: ${listsWithApplicability.join(', ')}` 
                            : "Clone applicability from another list"
                      }
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  );
                })()}
                <button
                  onClick={() => setIsVariableRelationshipModalOpen(true)}
                  className="px-3 py-1.5 text-sm font-medium border border-ag-dark-border rounded bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface transition-colors"
                  title="View and manage applicability"
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
                      {selectedVariables.slice(0, 5).map((variable, idx) => {
                        const part = variable.part || '';
                        const section = variable.section || '';
                        const group = variable.group || '';
                        const varName = variable.variable || variable.name || '';
                        const displayParts = [part, section, group, varName].filter(p => p);
                        return (
                          <div key={idx} className="text-xs text-ag-dark-text-secondary">
                            • {displayParts.length > 0 ? displayParts.join(' / ') : 'Unknown variable'}
                          </div>
                        );
                      })}
                      {selectedVariables.length > 5 && (
                        <div className="text-xs text-ag-dark-text-secondary">
                          ... and {selectedVariables.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* List Values Section - Lists */}
          <CollapsibleSection 
            title="List Values" 
            sectionKey="listValues"
            icon={<List className="w-4 h-4 text-ag-dark-text-secondary" />}
            actions={
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
                <button
                  onClick={() => setListValuesGraphModalOpen(true)}
                  disabled={selectedObjects.length === 0}
                  className={`p-1 transition-colors ${
                    selectedObjects.length > 0
                      ? 'text-ag-dark-text-secondary hover:text-ag-dark-accent' 
                      : 'text-ag-dark-text-secondary/30 cursor-not-allowed opacity-50'
                  }`}
                  title={selectedObjects.length > 0 ? "View List Values Graph" : "Select lists to view list values graph"}
                >
                  <Network className="w-4 h-4" />
                </button>
              </div>
            }
          >
            <div className="mb-4">
              <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
                <div className="text-sm text-ag-dark-text-secondary">
                  <span className="font-medium">Bulk list values editing:</span> Enter list values below to append them to all selected lists. Each list value should be on a new line.
                </div>
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
              placeholder={listValuesText.trim() === '' ? "Type one list value per line. Press Enter to add more. These values will be appended to all selected lists. Use the upload icon to import from CSV." : undefined}
              rows={8}
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent resize-y"
            />
          </CollapsibleSection>

          {/* Variations Section - Lists */}
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
                  disabled={selectedObjects.length === 0}
                  className={`text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors ${
                    selectedObjects.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title={selectedObjects.length === 0 ? "Select lists to view variations graph" : "View Variations Graph"}
                >
                  <Network className="w-4 h-4" />
                </button>
              </div>
            }
          >
            <div className="mb-4">
              <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
                <div className="text-sm text-ag-dark-text-secondary">
                  <span className="font-medium">Bulk variations editing:</span> Enter variations below to append them to all selected lists. Each variation should be on a new line.
                </div>
              </div>
            </div>
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
              placeholder={variationsText.trim() === '' ? "Type one variation per line. Press Enter to add more. These variations will be appended to all selected lists. Use the upload icon to import from CSV." : undefined}
              rows={8}
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent resize-y"
            />
          </CollapsibleSection>
        </>
      ) : (
        <>
          {/* Object Name Field - Moved out of collapsible section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Object Name
            </label>
            <input
              type="text"
              value={formData.objectName}
              onChange={(e) => handleChange('objectName', e.target.value)}
              placeholder="Keep current object names"
              onClick={(e) => e.stopPropagation()}
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
              Object Clarifier
            </label>
            <select
              value={driverSelections.objectClarifier}
              onChange={(e) => handleObjectClarifierChange(e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Keep Current Object Clarifier</option>
              <option value="">None</option>
              {driversData.objectClarifiers.map((option) => (
                <option key={option} value={option}>
                  {option}
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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-ag-dark-text">
                Being
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsAddBeingValueModalOpen(true);
                }}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors"
                title="Add new Being value"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.being}
              onChange={(e) => handleChange('being', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Keep Current Being</option>
              {getDistinctBeings().filter(being => being !== 'ALL').map(being => (
                <option key={being} value={being}>{being}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-ag-dark-text">
                Avatar
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsAddAvatarValueModalOpen(true);
                }}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors"
                title="Add new Avatar value"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.avatar}
              onChange={(e) => handleChange('avatar', e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px'
              }}
            >
              <option value="">Keep Current Avatar</option>
              {(() => {
                // Get distinct avatars from grid data, ensuring current value is included
                const options = avatarOptions.filter(opt => opt !== 'ALL');
                const merged = new Set<string>(options);
                if (formData.avatar && !merged.has(formData.avatar)) {
                  merged.add(formData.avatar);
                }
                return Array.from(merged).map(option => (
                  <option key={option} value={option}>{option}</option>
                ));
              })()}
            </select>
          </div>

        </div>
      </CollapsibleSection>

      {/* Identifiers Section */}
      <CollapsibleSection 
        title="Identifiers" 
        sectionKey="identifiers" 
        icon={<Key className="w-4 h-4 text-ag-dark-text-secondary" />} 
        ontologyViewType="identifiers"
        actions={
          <div className="flex items-center gap-2">
            {/* Clone Identifiers Button */}
            <button
              onClick={() => setIsCloneIdentifiersModalOpen(true)}
              disabled={selectedObjects.length === 0 || hasExistingIdentifiers}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                selectedObjects.length === 0 || hasExistingIdentifiers ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title={
                selectedObjects.length === 0 
                  ? "Select objects to clone identifiers" 
                  : hasExistingIdentifiers 
                    ? `Please delete existing identifiers for: ${objectsWithIdentifiers.join(', ')}` 
                    : "Clone identifiers from another object"
              }
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Unique ID - Multiple entries support */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-medium text-ag-dark-text">Unique ID</h5>
              <button
                onClick={handleAddUniqueIdEntry}
                className="flex items-center justify-center text-ag-dark-accent hover:text-ag-dark-accent-hover transition-colors"
                title="Add Unique ID"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="border border-ag-dark-border rounded">
              {/* Table Header */}
              <div className="grid grid-cols-[0.7fr_0.7fr_1.6fr] gap-2 bg-ag-dark-bg border-b border-ag-dark-border p-2">
                <div className="text-xs font-medium text-ag-dark-text-secondary">Part</div>
                <div className="text-xs font-medium text-ag-dark-text-secondary">Group</div>
                <div className="text-xs font-medium text-ag-dark-text-secondary">Variable</div>
              </div>
              {/* Table Rows - Multiple entries */}
              <div className="divide-y divide-ag-dark-border">
                {uniqueIdEntries.map((entry, index) => (
                  <div key={entry.id} className={`grid gap-2 items-center p-2 hover:bg-ag-dark-bg/50 ${index > 0 ? 'grid-cols-[0.7fr_0.7fr_1.6fr_auto]' : 'grid-cols-[0.7fr_0.7fr_1.6fr]'}`}>
                    <input
                      type="text"
                      value="Identifier"
                      disabled
                      className="w-full px-2 py-1.5 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text-secondary opacity-50 cursor-not-allowed"
                    />
                    <input
                      type="text"
                      value="Public ID"
                      disabled
                      className="w-full px-2 py-1.5 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text-secondary opacity-50 cursor-not-allowed"
                    />
                    <select
                      value={entry.variableId}
                      onChange={(e) => handleUniqueIdVariableChange(entry.id, e.target.value)}
                      className="w-full pl-2 pr-8 py-1.5 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 8px center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '16px'
                      }}
                    >
                      <option value="">Select Variable</option>
                      {getUniqueIdVariables().map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                    {index > 0 && (
                      <button
                        onClick={() => handleRemoveUniqueIdEntry(entry.id)}
                        className="flex items-center justify-center w-6 h-6 rounded text-ag-dark-error hover:bg-red-900/20 transition-colors"
                        title="Remove Unique ID"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Composite IDs - Matrix Layout */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-medium text-ag-dark-text">Composite IDs</h5>
            </div>
            <div className="border border-ag-dark-border rounded">
              {/* Table Header */}
              <div className="grid grid-cols-[25px_0.7fr_0.7fr_1.6fr] gap-1 bg-ag-dark-bg border-b border-ag-dark-border p-2">
                <div className="text-xs font-medium text-ag-dark-text-secondary"></div>
                <div className="text-xs font-medium text-ag-dark-text-secondary">Part</div>
                <div className="text-xs font-medium text-ag-dark-text-secondary">Group</div>
                <div className="text-xs font-medium text-ag-dark-text-secondary">Variable</div>
              </div>
              {/* Table Rows */}
              <div className="divide-y divide-ag-dark-border">
                {compositeKeys.map((compositeKey) => {
                  const variableOptions = compositeKey.part && compositeKey.group
                    ? getVariablesForPartAndGroup(compositeKey.part, compositeKey.group)
                    : [];
                  
                  return (
                    <div key={compositeKey.id} className="grid grid-cols-[25px_0.7fr_0.7fr_1.6fr] gap-1 items-center p-2 hover:bg-ag-dark-bg/50">
                      {/* Row Label */}
                      <div className="flex items-center">
                        <span className="text-[10px] font-medium text-ag-dark-text">{compositeKey.id}</span>
                      </div>
                      
                      {/* Part Dropdown */}
                      <select
                        value={compositeKey.part}
                        onChange={(e) => handleCompositeKeyChange(compositeKey.id, 'part', e.target.value)}
                        className="w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 8px center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '12px'
                        }}
                      >
                        <option value="">Select Part</option>
                        {getAllParts().map((part) => (
                          <option key={part} value={part}>
                            {part}
                          </option>
                        ))}
                      </select>

                      {/* Group Dropdown */}
                      <select
                        value={compositeKey.group}
                        onChange={(e) => handleCompositeKeyChange(compositeKey.id, 'group', e.target.value)}
                        disabled={!compositeKey.part}
                        className={`w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                          !compositeKey.part ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 8px center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '12px'
                        }}
                      >
                        <option value="">Select Group</option>
                        {getGroupsForPart(compositeKey.part).map((group) => (
                          <option key={group} value={group}>
                            {group}
                          </option>
                        ))}
                      </select>

                      {/* Variable Multi-select */}
                      <MultiSelect
                        label="Variable"
                        options={['ALL', ...variableOptions.map(v => v.name)]}
                        values={compositeKey.variables.map(id => {
                          const varData = variableOptions.find(v => v.id === id);
                          return varData?.name || id;
                        })}
                        onChange={(values) => {
                          const ids = values.map(val => {
                            if (val === 'ALL') return 'ALL';
                            const varData = variableOptions.find(v => v.name === val);
                            return varData?.id || val;
                          });
                          handleCompositeKeyVariablesChange(compositeKey.id, ids);
                        }}
                        disabled={!compositeKey.part || !compositeKey.group}
                        compact={true}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Relationships Section */}
      <CollapsibleSection 
        title="New Relationships" 
        sectionKey="relationships"
        icon={<Link className="w-4 h-4 text-ag-dark-text-secondary" />}
        ontologyViewType="relationships"
        actions={
          <div className="flex items-center gap-2">
            {/* Clone Relationships Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsCloneRelationshipsModalOpen(true);
              }}
              disabled={selectedObjects.length === 0 || hasExistingRelationships}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                selectedObjects.length === 0 || hasExistingRelationships ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title={
                selectedObjects.length === 0 
                  ? "Select objects to clone relationships" 
                  : hasExistingRelationships 
                    ? `Please delete existing relationships for: ${objectsWithRelationships.join(', ')}` 
                    : "Clone relationships from another object"
              }
            >
              <Copy className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsRelationshipModalOpen(true);
              }}
              disabled={selectedObjects.length === 0}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                selectedObjects.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title={selectedObjects.length === 0 ? "Select objects to view relationships" : "View and manage relationships"}
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
          </div>
        }
      >
        <div className="mb-6">
          <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
            <div className="text-sm text-ag-dark-text-secondary">
              <span className="font-medium">Bulk relationship management:</span> Create relationships from all selected objects to target objects. 
              Relationships will be appended to existing ones.
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Variants Section */}
      <CollapsibleSection 
        title="New Variants" 
        sectionKey="variants"
        icon={<Layers className="w-4 h-4 text-ag-dark-text-secondary" />}
        ontologyViewType="variants"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSortVariants('asc')}
              className="p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
              title="Sort A-Z"
            >
              <ArrowUpAZ className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleSortVariants('desc')}
              className="p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
              title="Sort Z-A"
            >
              <ArrowDownZA className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsVariantUploadOpen(true)}
              className="text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors"
              title="Upload Variants CSV"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        }
      >
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <textarea
            ref={variantsTextareaRef}
            value={variantsText}
            onChange={(e) => {
              const textarea = e.target as HTMLTextAreaElement;
              const cursorPosition = textarea.selectionStart;
              lastChangeTimeRef.current = Date.now();
              handleVariantsTextChange(e.target.value);
              // Restore cursor position and focus after state update
              requestAnimationFrame(() => {
                if (variantsTextareaRef.current && isTextareaFocusedRef.current) {
                  variantsTextareaRef.current.focus();
                  // Try to restore cursor position, but if it's out of bounds, put it at the end
                  const maxPos = variantsTextareaRef.current.value.length;
                  const safePos = Math.min(cursorPosition, maxPos);
                  variantsTextareaRef.current.setSelectionRange(safePos, safePos);
                }
              });
            }}
            onKeyDown={(e) => {
              // Prevent Enter key from propagating to parent components
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              // Prevent default only for Escape, not Enter
              if (e.key === 'Escape') {
                variantsTextareaRef.current?.blur();
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
              if (wasRecentTyping && clickedOutside && variantsTextareaRef.current && isTextareaFocusedRef.current) {
                // Restore focus after a brief delay to let React finish its render cycle
                setTimeout(() => {
                  if (variantsTextareaRef.current && document.activeElement !== variantsTextareaRef.current) {
                    variantsTextareaRef.current.focus();
                  }
                }, 10);
              } else if (!wasRecentTyping) {
                // User intentionally blurred, don't restore
                isTextareaFocusedRef.current = false;
              }
            }}
            placeholder="Type one variant per line. Press Enter to add more."
            rows={8}
            className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent resize-y"
          />
        </div>
      </CollapsibleSection>
        </>
      )}

      {/* Apply Changes Button */}
      <div className="mt-8 pt-6 border-t border-ag-dark-border">
        <button
          onClick={handleSaveBulkEdit}
          className="w-full bg-ag-dark-accent text-white py-2 px-4 rounded hover:bg-ag-dark-accent-hover transition-colors flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          Apply to {selectedCount} {activeTab === 'lists' ? 'Lists' : 'Objects'}
        </button>
      </div>

      {/* Add Being Value Modal */}
      <AddBeingValueModal
        isOpen={isAddBeingValueModalOpen}
        onClose={() => {
          setIsAddBeingValueModalOpen(false);
        }}
        onSave={handleAddBeingValue}
      />

      {/* Add Avatar Value Modal */}
      <AddAvatarValueModal
        isOpen={isAddAvatarValueModalOpen}
        onClose={() => {
          setIsAddAvatarValueModalOpen(false);
        }}
        onSave={handleAddAvatarValue}
        availableBeings={getDistinctBeings().filter(being => being !== 'ALL')}
      />

      {/* CSV Upload Modals */}
      <CsvUploadModal
        isOpen={isRelationshipUploadOpen}
        onClose={() => setIsRelationshipUploadOpen(false)}
        type="relationships"
        onUpload={handleRelationshipCsvUpload}
      />
      
      <CsvUploadModal
        isOpen={isVariantUploadOpen}
        onClose={() => setIsVariantUploadOpen(false)}
        type="variants"
        onUpload={handleVariantCsvUpload}
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

      {/* Relationship Modal - Objects */}
      {activeTab === 'objects' && (
        <RelationshipModal
          isOpen={isRelationshipModalOpen}
          onClose={() => setIsRelationshipModalOpen(false)}
          selectedObject={null}
          selectedObjects={selectedObjects}
          allObjects={allData}
          onSave={() => {
            // Refresh data after saving relationships
            if (onSave) {
              onSave({});
            }
          }}
          isBulkMode={true}
        />
      )}

      {/* Variable List Applicability Modal - Lists */}
      {activeTab === 'lists' && (
        <>
          <CloneListApplicabilityModal
            isOpen={isCloneListApplicabilityModalOpen}
            onClose={() => setIsCloneListApplicabilityModalOpen(false)}
            targetLists={selectedObjects}
            allLists={allData}
            onCloneSuccess={async () => {
              // Refresh data after cloning
              if (onSave) {
                await onSave({ _refreshRelationships: true });
              }
              // Open the applicability modal to show the cloned relationships
              setIsVariableRelationshipModalOpen(true);
            }}
          />
          <VariableListRelationshipModal
            isOpen={isVariableRelationshipModalOpen}
            onClose={() => setIsVariableRelationshipModalOpen(false)}
            selectedList={null}
            selectedLists={selectedObjects}
            allVariables={variablesData}
            onSave={async () => {
              // Refresh data after saving relationships
              if (onSave) {
                onSave({});
              }
            }}
            isBulkMode={true}
          />
        </>
      )}

      {/* Variable-List Applicability Graph Modal - Lists */}
      {activeTab === 'lists' && relationshipsGraphModalOpen && selectedObjects.length > 0 && (
        <VariableListRelationshipsGraphModal
          isOpen={relationshipsGraphModalOpen}
          onClose={() => setRelationshipsGraphModalOpen(false)}
          listIds={selectedObjects.map(list => list.id).filter(Boolean)}
          listNames={selectedObjects.map(list => list.list || list.name).filter(Boolean)}
          isBulkMode={true}
        />
      )}

      {/* Ontology Modal - Objects */}
      {activeTab === 'objects' && ontologyModalOpen.isOpen && ontologyModalOpen.viewType && selectedObjects.length > 0 && (
        <OntologyModal
          isOpen={ontologyModalOpen.isOpen}
          onClose={closeBulkOntologyModal}
          objectIds={selectedObjects.map(obj => obj.id).filter(Boolean)}
          objectNames={selectedObjects.map(obj => obj.object || obj.name).filter(Boolean)}
          sectionName={
            ontologyModalOpen.viewType === 'drivers' ? 'Drivers' :
            ontologyModalOpen.viewType === 'ontology' ? 'Ontology' :
            ontologyModalOpen.viewType === 'identifiers' ? 'Identifiers' :
            ontologyModalOpen.viewType === 'relationships' ? 'Relationships' :
            'Variants'
          }
          viewType={ontologyModalOpen.viewType}
          isBulkMode={true}
        />
      )}

      {/* List Values Graph Modal - Lists */}
      {activeTab === 'lists' && listValuesGraphModalOpen && selectedObjects.length > 0 && (
        <ListsOntologyModal
          isOpen={listValuesGraphModalOpen}
          onClose={() => setListValuesGraphModalOpen(false)}
          listIds={selectedObjects.map(list => list.id).filter(Boolean)}
          listNames={selectedObjects.map(list => list.list || list.name).filter(Boolean)}
          sectionName="List Values"
          viewType="listValues"
          isBulkMode={true}
        />
      )}

      {/* Lists Ontology Modal */}
      {activeTab === 'lists' && listsOntologyModalOpen.isOpen && listsOntologyModalOpen.viewType && selectedObjects.length > 0 && (
        <ListsOntologyModal
          isOpen={listsOntologyModalOpen.isOpen}
          onClose={closeListsOntologyModal}
          listIds={selectedObjects.map(list => list.id).filter(Boolean)}
          listNames={selectedObjects.map(list => list.list || list.name).filter(Boolean)}
          sectionName={
            listsOntologyModalOpen.viewType === 'drivers' ? 'Drivers' :
            listsOntologyModalOpen.viewType === 'ontology' ? 'Ontology' :
            'Metadata'
          }
          viewType={listsOntologyModalOpen.viewType}
          isBulkMode={true}
        />
      )}

      {activeTab === 'lists' && isVariationsGraphModalOpen && selectedObjects.length > 0 && (
        <ListsOntologyModal
          isOpen={isVariationsGraphModalOpen}
          onClose={() => setIsVariationsGraphModalOpen(false)}
          listIds={selectedObjects.map(list => list.id).filter(Boolean)}
          listNames={selectedObjects.map(list => list.list || list.name).filter(Boolean)}
          sectionName="Variations"
          viewType="variations"
          isBulkMode={true}
        />
      )}

      {/* Clone Relationships Modal - Only for objects tab */}
      {activeTab === 'objects' && selectedObjects.length > 0 && (
        <CloneRelationshipsModal
          isOpen={isCloneRelationshipsModalOpen}
          onClose={() => setIsCloneRelationshipsModalOpen(false)}
          targetObjects={selectedObjects}
          allObjects={allData}
          onCloneSuccess={async () => {
            // Refresh objects data to update the relationships count immediately
            if (onObjectsRefresh) {
              await onObjectsRefresh();
            }
          }}
        />
      )}

      {/* Clone Identifiers Modal - Only for objects tab */}
      {activeTab === 'objects' && selectedObjects.length > 0 && (
        <CloneIdentifiersModal
          isOpen={isCloneIdentifiersModalOpen}
          onClose={() => setIsCloneIdentifiersModalOpen(false)}
          targetObjects={selectedObjects}
          allObjects={allData}
          onCloneSuccess={async () => {
            // Refresh objects data after cloning identifiers
            if (onObjectsRefresh) {
              await onObjectsRefresh();
            }
          }}
        />
      )}
    </div>
  );
};