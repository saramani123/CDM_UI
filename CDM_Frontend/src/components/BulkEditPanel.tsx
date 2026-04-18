import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ObjectIdentifiersBulkSection,
  type ObjectIdentifiersBulkRef,
  type IdentifierSavePayload,
} from './ObjectIdentifiersBulkSection';
import { Settings, Save, Trash2, Plus, Link, Layers, Upload, ChevronRight, ChevronDown, Database, Users, Key, ArrowUpAZ, ArrowDownZA, Network, FileText, List, Eye, Copy, Grid3x3 } from 'lucide-react';
import { concatenateDrivers } from '../data/mockData';
import { CsvUploadModal } from './CsvUploadModal';
import { OntologyModal } from './OntologyModal';
import { RelationshipModal } from './RelationshipModal';
import { CloneRelationshipsModal } from './CloneRelationshipsModal';
import { CloneIdentifiersModal } from './CloneIdentifiersModal';
import { AddBeingValueModal } from './AddBeingValueModal';
import { AddAvatarValueModal } from './AddAvatarValueModal';
import { AddSetValueModal } from './AddSetValueModal';
import { AddGroupingValueModal } from './AddGroupingValueModal';
import { VariantsModal } from './VariantsModal';
import { apiService } from '../services/api';
import { useDrivers } from '../hooks/useDrivers';
import { useVariables } from '../hooks/useVariables';
import { VariableListRelationshipModal } from './VariableListRelationshipModal';
import { ListsOntologyModal } from './ListsOntologyModal';
import { VariableListRelationshipsGraphModal } from './VariableListRelationshipsGraphModal';
import { CloneListApplicabilityModal } from './CloneListApplicabilityModal';
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
  variablesOrderSortOrder?: {
    partOrder: string[];
    sectionOrders: Record<string, string[]>;
    groupOrders: Record<string, string[]>;
    variableOrders: Record<string, string[]>;
  };
  isVariablesOrderEnabled?: boolean;
}

export const BulkEditPanel: React.FC<BulkEditPanelProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedCount,
  allData = [],
  activeTab = 'objects',
  selectedObjects = [],
  onObjectsRefresh,
  variablesOrderSortOrder,
  isVariablesOrderEnabled = false
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
    grouping: ''
  });

  // Driver selections state
  const [driverSelections, setDriverSelections] = useState({
    sector: [] as string[],
    domain: [] as string[],
    country: [] as string[]
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
  const identifiersBulkRef = useRef<ObjectIdentifiersBulkRef>(null);
  /** Latest identifier builder from child (avoids ref timing where imperative handle lags one frame behind state). */
  const identifierPrepareFnRef = useRef<(() => IdentifierSavePayload) | null>(null);
  const registerIdentifierPrepare = useCallback((fn: (() => IdentifierSavePayload) | null) => {
    identifierPrepareFnRef.current = fn;
  }, []);
  const driversData = apiDrivers || {
    sectors: [],
    domains: [],
    countries: [],
    objectClarifiers: [],
    variableClarifiers: []
  };

  // Relationships and variants - using string for multiline input
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [variantsText, setVariantsText] = useState('');
  const [variantsArray, setVariantsArray] = useState<Variant[]>([]);
  
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
  
  // Modal state for add set/grouping values (lists)
  const [isAddSetValueModalOpen, setIsAddSetValueModalOpen] = useState(false);
  const [isAddGroupingValueModalOpen, setIsAddGroupingValueModalOpen] = useState(false);
  
  // Local state to track Sets and Groupings for lists (for immediate UI updates)
  const [localSets, setLocalSets] = useState<string[]>([]);
  const [localGroupings, setLocalGroupings] = useState<Record<string, string[]>>({});
  
  // Initialize local Sets and Groupings from allData (for lists tab)
  useEffect(() => {
    if (activeTab === 'lists') {
      const listsData = allData as any[];
      const sets = [...new Set(listsData.map((list: any) => list.set))].filter(Boolean).sort() as string[];
      setLocalSets(sets);
      
      const groupingsMap: Record<string, string[]> = {};
      listsData.forEach((list: any) => {
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
    }
  }, [allData, activeTab]);
  const variantsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isTextareaFocusedRef = useRef<boolean>(false);
  const lastChangeTimeRef = useRef<number>(0);

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
  const [isVariantsModalOpen, setIsVariantsModalOpen] = useState(false);
  // Relationship modal state
  const [isRelationshipModalOpen, setIsRelationshipModalOpen] = useState(false);
  const [isCloneRelationshipsModalOpen, setIsCloneRelationshipsModalOpen] = useState(false);
  
  // Clone identifiers modal state
  const [isCloneIdentifiersModalOpen, setIsCloneIdentifiersModalOpen] = useState(false);
  
  // Note: hasExistingRelationships check removed - clone now works for all objects
  // (preserves default relationships and only replaces non-default ones)
  
  // Check if any selected objects have identifiers (GET /objects/:id → discreteIds / compositeIds)
  const [hasExistingIdentifiers, setHasExistingIdentifiers] = useState(false);
  const [objectsWithIdentifiers, setObjectsWithIdentifiers] = useState<string[]>([]);
  /** False until per-object identifier probe finishes (avoid showing editable IDs before we know). */
  const [identifiersSelectionReady, setIdentifiersSelectionReady] = useState(false);
  
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
    identifiers: true,
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

  const [avatarsForBeing, setAvatarsForBeing] = useState<Record<string, string[]>>({});

  // Fetch avatars from backend API when being changes
  useEffect(() => {
    const fetchAvatarsForBeing = async (being: string) => {
      if (!being || being === 'ALL') {
        setAvatarsForBeing(prev => ({ ...prev, [being]: ['ALL'] }));
        return;
      }
      
      try {
        const avatars = await apiService.getAvatars(being);
        setAvatarsForBeing(prev => ({ ...prev, [being]: avatars }));
      } catch (error) {
        console.error('Error fetching avatars for being:', error);
        // Fallback to local data
        const avatarsFromData = [...new Set(allData.filter(item => item.being === being).map(item => item.avatar))];
        setAvatarsForBeing(prev => ({ ...prev, [being]: avatarsFromData }));
      }
    };

    if (formData.being) {
      fetchAvatarsForBeing(formData.being);
    }
  }, [formData.being, allData]);

  const getDistinctAvatarsForBeing = (being: string) => {
    if (being === 'ALL') return ['ALL'];
    
    // First try to get from API-fetched data
    if (avatarsForBeing[being]) {
      return avatarsForBeing[being];
    }
    
    // Fallback to local data
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
    if (!being || !being.trim()) {
      throw new Error('Please select a Being first');
    }
    
    if (!avatar || !avatar.trim()) {
      throw new Error('Please enter an Avatar name');
    }
    
    try {
      // Call backend API to create avatar
      await apiService.createAvatar(being.trim(), avatar.trim());
      
      // Also save to localStorage for backward compatibility
      saveBeingAvatarAssociation(being.trim(), avatar.trim());
      
      // Refresh avatars for this being
      const avatars = await apiService.getAvatars(being.trim());
      setAvatarsForBeing(prev => ({ ...prev, [being.trim()]: avatars }));
      
      setBeingAvatarUpdateTrigger(prev => prev + 1); // Trigger re-render
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create avatar';
      if (errorMessage.includes('already exists')) {
        throw new Error(`Avatar '${avatar}' already exists for Being '${being}'. Please use a different name.`);
      }
      throw error;
    }
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

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Get distinct Set values from actual lists data + local state
  const getDistinctSets = (): string[] => {
    if (activeTab !== 'lists') return [];
    const listsData = allData as any[];
    const setsFromData = [...new Set(listsData.map((list: any) => list.set))].filter(Boolean) as string[];
    const allSets = [...new Set([...setsFromData, ...localSets])].sort();
    return allSets;
  };

  // Get groupings for a specific set from lists data + local state
  const getGroupingsForSet = (set: string): string[] => {
    if (!set || activeTab !== 'lists') return [];
    
    // Get groupings from existing lists data for this set
    const listsData = allData as any[];
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
      if (activeTab === 'lists') {
        handleChange('set', setValue);
      }
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
      if (activeTab === 'lists') {
        handleChange('grouping', groupingValue);
      }
    } catch (error) {
      throw error;
    }
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
          // Fetch avatars for the new being
          if (value && value !== 'ALL') {
            apiService.getAvatars(value).then(avatars => {
              setAvatarsForBeing(prev => ({ ...prev, [value]: avatars }));
            }).catch(error => {
              console.error('Error fetching avatars:', error);
            });
          }
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
    // Validate that avatar is selected when being is selected (for objects tab)
    if (activeTab === 'objects' && formData.being && formData.being !== 'ALL' && (!formData.avatar || formData.avatar === '')) {
      alert('Please select an Avatar. Avatar is required when Being is selected.');
      return;
    }
    if (activeTab === 'lists') {
      // Handle Lists bulk edit
      const saveData: Record<string, any> = {};
      
      // List names cannot be bulk-edited (avoids duplicate-name collisions)
      
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
      
      // Add relationships if selected (for future implementation)
      if (selectedVariables.length > 0) {
        saveData.variablesAttachedList = selectedVariables;
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
                               driverSelections.country.length > 0;
    
    const driverString = hasDriverSelections ? concatenateDrivers(
      driverSelections.sector,
      driverSelections.domain,
      driverSelections.country
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

    let idResult: IdentifierSavePayload = {};
    if (identifiersSelectionReady && !hasExistingIdentifiers) {
      if (identifierPrepareFnRef.current) {
        idResult = identifierPrepareFnRef.current();
      } else if (identifiersBulkRef.current) {
        idResult = identifiersBulkRef.current.prepareIdentifierForSave();
      }
    }
    if (idResult?.error) {
      alert(idResult.error);
      return;
    }

    const saveData: Record<string, any> = {
      ...(formData.being && formData.being.trim() !== '' && { being: formData.being }),
      ...(formData.avatar && formData.avatar.trim() !== '' && { avatar: formData.avatar }),
      ...(driverString && { driver: driverString }),
      ...(uniqueRelationships.length > 0 && { relationshipsList: uniqueRelationships }),
      ...(variantsList.length > 0 && { variantsList: variantsList }),
    };
    if (idResult?.identifier) {
      saveData.identifier = idResult.identifier;
    }
    
    console.log('🔄 BulkEditPanel - saveData:', saveData);
    console.log('🔄 BulkEditPanel - variants array:', variantsList);
    console.log('🔄 BulkEditPanel - variantsList field:', saveData.variantsList);
    
    onSave(saveData);
    // Note: onClose() is called automatically when selection changes via useEffect in App.tsx
    // No need to call it here explicitly as the panel closes when selection becomes single
  };

    // Note: Relationship checking removed - clone now works for all objects
    // (preserves default relationships and only replaces non-default ones)

    // Check if any selected objects have existing identifiers
    useEffect(() => {
      let cancelled = false;

      const checkIdentifiers = async () => {
        if (activeTab !== 'objects' || selectedObjects.length === 0) {
          setHasExistingIdentifiers(false);
          setObjectsWithIdentifiers([]);
          setIdentifiersSelectionReady(true);
          return;
        }

        setIdentifiersSelectionReady(false);
        const objectsWithIds: string[] = [];
        for (const obj of selectedObjects) {
          if (cancelled) return;
          try {
            const objectData = (await apiService.getObject(obj.id)) as any;
            const hasUniqueIds = (objectData?.discreteIds || []).length > 0;
            const hasCompositeIds = Object.values(objectData?.compositeIds || {}).some(
              (compIds: any) => Array.isArray(compIds) && compIds.length > 0
            );

            if (hasUniqueIds || hasCompositeIds) {
              objectsWithIds.push(obj.object || obj.name || obj.id);
            }
          } catch (error) {
            console.error(`Error checking identifiers for object ${obj.id}:`, error);
          }
        }

        if (!cancelled) {
          setHasExistingIdentifiers(objectsWithIds.length > 0);
          setObjectsWithIdentifiers(objectsWithIds);
          setIdentifiersSelectionReady(true);
        }
      };

      void checkIdentifiers();
      return () => {
        cancelled = true;
      };
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
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) {
              setIsOpen(!isOpen);
            }
          }}
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
          <div 
            className="absolute z-10 w-full mt-1 bg-ag-dark-surface border border-ag-dark-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
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
    /** Applied to the outer section wrapper (e.g. muted bulk-edit state) */
    wrapperClassName?: string;
    /** When true, children stay mounted while collapsed (hidden) so refs/state used on save still work */
    keepMountedWhenCollapsed?: boolean;
  }> = ({
    title,
    sectionKey,
    icon,
    actions,
    children,
    ontologyViewType,
    listsOntologyViewType,
    showRelationshipsGraph,
    wrapperClassName,
    keepMountedWhenCollapsed = false,
  }) => {
    const isExpanded = expandedSections[sectionKey];
    const hasSelectedObjects = selectedObjects && selectedObjects.length > 0;
    const isListsMode = activeTab === 'lists';
    
    return (
      <div className={`border-t border-ag-dark-border pt-8 ${wrapperClassName ?? ''}`}>
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
        
        {keepMountedWhenCollapsed ? (
          <div className={`mt-6 ml-6 pb-6 ${isExpanded ? '' : 'hidden'}`} aria-hidden={!isExpanded}>
            {children}
          </div>
        ) : (
          isExpanded && (
            <div className="mt-6 ml-6 pb-6">
              {children}
            </div>
          )
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
          {/* List Name — not editable in bulk (prevents duplicate list names) */}
          <div className="mb-6 opacity-60">
            <label className="block text-sm font-medium text-ag-dark-text-secondary mb-2">
              List Name
            </label>
            <input
              type="text"
              value=""
              readOnly
              disabled
              title="List names cannot be changed in bulk edit."
              placeholder="Names are unchanged in bulk edit"
              onClick={(e) => e.stopPropagation()}
              className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-ag-dark-text-secondary cursor-not-allowed"
            />
            <p className="mt-1.5 text-xs text-ag-dark-text-secondary">
              Bulk edit does not rename lists, to avoid duplicate names across your selection.
            </p>
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
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-ag-dark-text">
                    Set
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
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-ag-dark-text">
                    Grouping
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddGroupingValueModalOpen(true);
                    }}
                    disabled={!listFormData.set || listFormData.set.trim() === ''}
                    className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Add new Grouping value"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
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
                  List Type
                </label>
                <div
                  className="rounded-lg border border-ag-dark-border bg-ag-dark-bg/60 p-4 opacity-60 pointer-events-none select-none"
                  aria-disabled="true"
                >
                  <p className="text-sm text-ag-dark-text-secondary">
                    List type can only be changed when editing a single list, not in bulk edit.
                  </p>
                </div>
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
                  type="button"
                  onClick={() => setIsVariableRelationshipModalOpen(true)}
                  disabled={selectedCount === 0}
                  className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg ${
                    selectedCount === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title={selectedCount === 0 ? "Select lists to view applicability" : "View and manage applicability"}
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

          {/* List Values Section - Lists (not configurable in bulk edit) */}
          <CollapsibleSection 
            title="List Values" 
            sectionKey="listValues"
            icon={<List className="w-4 h-4 text-ag-dark-text-secondary" />}
            actions={
              <button
                type="button"
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
            }
          >
            <div
              className="rounded-lg border border-ag-dark-border bg-ag-dark-bg/60 p-4 opacity-60 pointer-events-none select-none"
              aria-disabled="true"
            >
              <p className="text-sm text-ag-dark-text-secondary">
                List values cannot be configured in bulk edit.
              </p>
            </div>
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
          {/* Object Name — not editable in bulk (prevents duplicate object names) */}
          <div className="mb-6 opacity-60">
            <label className="block text-sm font-medium text-ag-dark-text-secondary mb-2">
              Object Name
            </label>
            <input
              type="text"
              value=""
              readOnly
              disabled
              title="Object names cannot be changed in bulk edit."
              placeholder="Names are unchanged in bulk edit"
              onClick={(e) => e.stopPropagation()}
              className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-ag-dark-text-secondary cursor-not-allowed"
            />
            <p className="mt-1.5 text-xs text-ag-dark-text-secondary">
              Bulk edit does not rename objects, to avoid duplicate names across your selection.
            </p>
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
        keepMountedWhenCollapsed
        wrapperClassName={
          hasExistingIdentifiers || !identifiersSelectionReady ? 'opacity-55' : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            {/* Clone Identifiers Button */}
            <button
              onClick={() => setIsCloneIdentifiersModalOpen(true)}
              disabled={
                selectedObjects.length === 0 ||
                hasExistingIdentifiers ||
                !identifiersSelectionReady
              }
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                selectedObjects.length === 0 || hasExistingIdentifiers || !identifiersSelectionReady
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-ag-dark-bg'
              }`}
              title={
                selectedObjects.length === 0
                  ? 'Select objects to clone identifiers'
                  : !identifiersSelectionReady
                    ? 'Checking existing identifiers…'
                    : hasExistingIdentifiers
                      ? `Please delete existing identifiers for: ${objectsWithIdentifiers.join(', ')}`
                      : 'Clone identifiers from another object'
              }
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          {!identifiersSelectionReady ? (
            <div className="rounded-lg border border-ag-dark-border bg-ag-dark-bg/80 p-4 text-sm text-ag-dark-text-secondary">
              Checking which objects already have identifiers…
            </div>
          ) : hasExistingIdentifiers ? (
            <div className="rounded-lg border border-ag-dark-border bg-ag-dark-bg/80 p-4 text-sm text-ag-dark-text-secondary">
              <p className="mb-0 text-ag-dark-text">
                {
                  "Identifiers can only be configured in bulk edit if all select Objects don't already have Identifiers configured. If 1 or more Object has Identifiers configured then bulk editing Identifiers may lead to duplicates."
                }
              </p>
            </div>
          ) : (
            <ObjectIdentifiersBulkSection
              key={selectedObjects.map((o: any) => o.id).join('-')}
              ref={identifiersBulkRef}
              readOnly={false}
              onRegisterPrepareIdentifier={registerIdentifierPrepare}
            />
          )}
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
              disabled={selectedObjects.length === 0}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                selectedObjects.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title={
                selectedObjects.length === 0 
                  ? "Select objects to clone relationships" 
                  : "Clone non-default relationships from another object (default relationships will be preserved)"
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
              onClick={() => setIsVariantsModalOpen(true)}
              className="p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
              title="View and manage variants"
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
          </div>
        }
      >
        {/* Variants display removed - use the grid icon button to view variants in the modal */}
        <div className="mb-6">
          <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
            <div className="text-sm text-ag-dark-text-secondary">
              <span className="font-medium">Bulk variants management:</span> Click the grid icon above to add variants. These variants will be appended to each selected object's existing variants.
            </div>
          </div>
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
        defaultSet={listFormData.set || ''}
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
      
      {/* Variants Modal */}
      {activeTab === 'objects' && selectedObjects.length > 0 && (
        <VariantsModal
          isOpen={isVariantsModalOpen}
          onClose={() => setIsVariantsModalOpen(false)}
          selectedObjects={selectedObjects}
          isBulkMode={true}
          onSave={async () => {
            // Refresh objects data after saving
            if (onObjectsRefresh) {
              await onObjectsRefresh();
            }
          }}
        />
      )}

      <CsvUploadModal
        isOpen={isVariantUploadOpen}
        onClose={() => setIsVariantUploadOpen(false)}
        type="variants"
        onUpload={handleVariantCsvUpload}
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
            variablesOrderSortOrder={variablesOrderSortOrder}
            isVariablesOrderEnabled={isVariablesOrderEnabled}
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