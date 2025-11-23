import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, Save, X, Trash2, Plus, Link, Layers, Upload, ChevronRight, ChevronDown, Database, Users, Key, ArrowUpAZ, ArrowDownZA, Network, Info, Copy, Grid3x3 } from 'lucide-react';
import { concatenateDrivers, parseDriverString } from '../data/mockData';
import { useDrivers } from '../hooks/useDrivers';
import { useVariables } from '../hooks/useVariables';
import { CsvUploadModal } from './CsvUploadModal';
import { OntologyModal } from './OntologyModal';
import { CloneRelationshipsModal } from './CloneRelationshipsModal';
import { CloneIdentifiersModal } from './CloneIdentifiersModal';
import { AddBeingValueModal } from './AddBeingValueModal';
import { AddAvatarValueModal } from './AddAvatarValueModal';
import { apiService } from '../services/api';
import { VariableData } from '../data/variablesData';

interface MetadataField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number';
  options?: string[];
  value?: string | number;
}

interface CompositeKey {
  id: string;
  part: string;
  group: string;
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

interface MetadataPanelProps {
  fields: MetadataField[];
  onSave?: (data: Record<string, any>) => void;
  onClose?: () => void;
  selectedObject?: any;
  allData?: any[];
  selectedCount?: number;
  affectedObjectIds?: Set<string>;
  deletedDriverType?: string | null;
  onEnterRelationshipView?: () => void;
  onObjectsRefresh?: () => void | Promise<void>; // Callback to refresh objects data
}

export const MetadataPanel: React.FC<MetadataPanelProps> = ({
  fields,
  onSave,
  onClose,
  selectedObject,
  allData = [],
  selectedCount = 0,
  affectedObjectIds = new Set(),
  deletedDriverType = null,
  onEnterRelationshipView,
  onObjectsRefresh
}) => {
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    // Initialize form data from selected object if available
    if (selectedObject) {
      return {
        being: selectedObject.being || '',
        avatar: selectedObject.avatar || '',
        object: selectedObject.object || ''
      };
    }
    // Fallback to empty values
    return {
      being: '',
      avatar: '',
      object: ''
    };
  });

  // Driver selections state - will be expanded when driversData loads
  const [driverSelections, setDriverSelections] = useState(() => {
    if (selectedObject?.driver) {
      const parsed = parseDriverString(selectedObject.driver);
      // Note: We can't expand ALL here because driversData might not be loaded yet
      // This will be handled in the useEffect below
      return parsed;
    }
    return {
      sector: [],
      domain: [],
      country: [],
      objectClarifier: ''
    };
  });

  const { drivers: driversData } = useDrivers();
  const { variables: variablesData } = useVariables();
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    drivers: false,
    ontology: false,
    identifiers: false,
    relationships: false,
    variants: false
  });

  // Ontology modal state
  const [ontologyModalOpen, setOntologyModalOpen] = useState<{
    isOpen: boolean;
    viewType: 'drivers' | 'ontology' | 'identifiers' | 'relationships' | 'variants' | null;
  }>({ isOpen: false, viewType: null });

  const openOntologyModal = (viewType: 'drivers' | 'ontology' | 'identifiers' | 'relationships' | 'variants') => {
    setOntologyModalOpen({ isOpen: true, viewType });
  };

  const closeOntologyModal = () => {
    setOntologyModalOpen({ isOpen: false, viewType: null });
  };

  // Track the previous selected object ID to detect actual object changes
  const prevSelectedObjectId = useRef<string | null>(null);
  const isUserTyping = useRef(false);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Update form data when a new object is selected (not on every field change)
  React.useEffect(() => {
    const currentObjectId = selectedObject?.id;
    
    // Only reset form data when the selected object actually changes AND we have a valid object AND user is not typing
    if (currentObjectId && currentObjectId !== prevSelectedObjectId.current && !isUserTyping.current) {
      console.log('MetadataPanel: selected object changed from', prevSelectedObjectId.current, 'to', currentObjectId);
      prevSelectedObjectId.current = currentObjectId;
      
      // Initialize form data from the selected object, not from fields
      const newFormData: Record<string, any> = {
        being: selectedObject?.being || '',
        avatar: selectedObject?.avatar || '',
        object: selectedObject?.object || ''
      };
      console.log('MetadataPanel: newFormData for new object', newFormData);
      setFormData(newFormData);
    }
    
    // Update driver selections when selected object changes
    if (selectedObject?.driver) {
      const parsed = parseDriverString(selectedObject.driver);
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
        objectClarifier: parsed.objectClarifier
      };
      setDriverSelections(expanded);
    } else {
      setDriverSelections({
        sector: [],
        domain: [],
        country: [],
        objectClarifier: ''
      });
    }
  }, [selectedObject?.id, driversData]); // Reset when object changes or drivers data loads

  // State for add being/avatar value modals
  const [isAddBeingValueModalOpen, setIsAddBeingValueModalOpen] = useState(false);
  const [isAddAvatarValueModalOpen, setIsAddAvatarValueModalOpen] = useState(false);
  const [beingAvatarUpdateTrigger, setBeingAvatarUpdateTrigger] = useState(0);

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

  // Get distinct values from data
  // Use beingAvatarUpdateTrigger to force re-computation when values are added
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

  // Get dynamic avatar options based on current being from grid data
  // Include beingAvatarUpdateTrigger dependency to force re-render when values are added
  const avatarOptions = React.useMemo(() => {
    return getDistinctAvatarsForBeing(formData.being || '');
  }, [formData.being, beingAvatarUpdateTrigger, allData]);

  // Initialize identifiers state - changed from array of IDs to array of objects with unique IDs
  interface UniqueIdEntry {
    id: string; // Unique identifier for this entry
    variableId: string; // The selected variable ID
  }
  const [uniqueIdEntries, setUniqueIdEntries] = useState<UniqueIdEntry[]>([]);
  const [compositeKeys, setCompositeKeys] = useState<{
    id: string;
    part: string;
    group: string;
    variables: string[];
  }[]>([
    { id: '1', part: '', group: '', variables: [] },
    { id: '2', part: '', group: '', variables: [] },
    { id: '3', part: '', group: '', variables: [] },
    { id: '4', part: '', group: '', variables: [] },
    { id: '5', part: '', group: '', variables: [] }
  ]);

  // Initialize relationships state
  const [relationships, setRelationships] = useState<Relationship[]>([]);

  // Initialize variants state - using string for multiline input
  const [variantsText, setVariantsText] = useState('');

  // CSV upload modal states
  const [isRelationshipUploadOpen, setIsRelationshipUploadOpen] = useState(false);
  const [isVariantUploadOpen, setIsVariantUploadOpen] = useState(false);
  
  // Clone relationships modal state
  const [isCloneRelationshipsModalOpen, setIsCloneRelationshipsModalOpen] = useState(false);
  
  // Clone identifiers modal state
  const [isCloneIdentifiersModalOpen, setIsCloneIdentifiersModalOpen] = useState(false);

  // Load relationships when selectedObject changes
  React.useEffect(() => {
    if (selectedObject?.id) {
      console.log('MetadataPanel: Loading relationships for object:', selectedObject.object, 'id:', selectedObject.id);
      
      // If this is a cloned unsaved object, use the relationships from the cloned data
      if (selectedObject._isCloned && !selectedObject._isSaved) {
        console.log('MetadataPanel: Using relationships from cloned object data:', selectedObject.relationshipsList);
        setRelationships(selectedObject.relationshipsList || []);
        return;
      }
      
      const loadRelationships = async () => {
        try {
          const relationshipData = await apiService.getObjectRelationships(selectedObject.id);
          console.log('MetadataPanel: API relationship data:', relationshipData);
          const relationshipsList = relationshipData?.relationshipsList || [];
          console.log('MetadataPanel: loaded relationships from API:', relationshipsList);
          setRelationships(relationshipsList);
        } catch (error) {
          console.error('MetadataPanel: failed to load relationships:', error);
          setRelationships([]);
        }
      };
      
      loadRelationships();
    } else {
      setRelationships([]);
    }
  }, [selectedObject?.id, selectedObject?._isCloned, selectedObject?._isSaved, selectedObject?.relationshipsList]);

  // Load variants when selectedObject changes
  React.useEffect(() => {
    if (selectedObject?.id) {
      console.log('MetadataPanel: Loading variants for object:', selectedObject.object, 'id:', selectedObject.id);
      
      // If this is a cloned unsaved object, use the variants from the cloned data
      if (selectedObject._isCloned && !selectedObject._isSaved) {
        console.log('MetadataPanel: Using variants from cloned object data:', selectedObject.variantsList);
        const variantsTextContent = (selectedObject.variantsList || []).map((v: any) => typeof v === 'string' ? v : v.name).join('\n');
        setVariantsText(variantsTextContent);
        return;
      }
      
      const loadVariants = async () => {
        try {
          const variantData = await apiService.getObjectVariants(selectedObject.id);
          console.log('MetadataPanel: API variant data:', variantData);
          const variantsList = variantData?.variantsList || [];
          console.log('MetadataPanel: loaded variants from API:', variantsList);
          // Convert variants array to multiline text
          const variantsTextContent = variantsList.map(v => v.name).join('\n');
          setVariantsText(variantsTextContent);
        } catch (error) {
          console.error('MetadataPanel: failed to load variants:', error);
          setVariantsText('');
        }
      };
      
      loadVariants();
    } else {
      setVariantsText('');
    }
  }, [selectedObject?.id, selectedObject?._isCloned, selectedObject?._isSaved, selectedObject?.variantsList]);

  // Load identifier relationships when selectedObject changes
  React.useEffect(() => {
    if (selectedObject?.id) {
      // If this is a cloned unsaved object, use the identifier data from the cloned object
      if (selectedObject._isCloned && !selectedObject._isSaved && selectedObject.identifier) {
        console.log('MetadataPanel: Using identifier data from cloned object:', selectedObject.identifier);
        try {
          const identifierData = selectedObject.identifier;
          
          // Load unique IDs (previously discrete IDs)
          const discreteIds = identifierData?.discreteIds || [];
          const uniqueIdEntriesList = discreteIds.map((di: any, index: number) => ({
            id: `unique-${index + 1}`,
            variableId: di.variableId || ''
          }));
          if (uniqueIdEntriesList.length === 0) {
            setUniqueIdEntries([{ id: 'unique-1', variableId: '' }]);
          } else {
            setUniqueIdEntries(uniqueIdEntriesList);
          }
          
          // Load composite IDs
          const compositeIds = identifierData?.compositeIds || {};
          const newCompositeKeys = compositeKeys.map(key => {
            const compositeIdData = compositeIds[key.id];
            if (compositeIdData && Array.isArray(compositeIdData) && compositeIdData.length > 0) {
              const variableIds = compositeIdData.map((ci: any) => ci.variableId).filter(Boolean);
              return {
                id: key.id,
                part: compositeIdData[0].part || '',
                group: compositeIdData[0].group || '',
                variables: variableIds
              };
            }
            return { id: key.id, part: '', group: '', variables: [] };
          });
          setCompositeKeys(newCompositeKeys);
        } catch (error) {
          console.error('MetadataPanel: failed to load identifiers from cloned data:', error);
          setUniqueIdEntries([{ id: 'unique-1', variableId: '' }]);
          setCompositeKeys([
            { id: '1', part: '', group: '', variables: [] },
            { id: '2', part: '', group: '', variables: [] },
            { id: '3', part: '', group: '', variables: [] },
            { id: '4', part: '', group: '', variables: [] },
            { id: '5', part: '', group: '', variables: [] }
          ]);
        }
        return;
      }
      
      const loadIdentifiers = async () => {
        try {
          const objectData = await apiService.getObject(selectedObject.id);
          console.log('MetadataPanel: Loaded identifier data:', objectData);
          console.log('MetadataPanel: discreteIds:', objectData?.discreteIds);
          console.log('MetadataPanel: compositeIds:', objectData?.compositeIds);
          
          // Load unique IDs (previously discrete IDs)
          // Keep all entries visible, even if empty (user can clear selection to remove)
          const discreteIds = objectData?.discreteIds || [];
          const uniqueIdEntriesList = discreteIds.map((di: any, index: number) => ({
            id: `unique-${index + 1}`,
            variableId: di.variableId || ''
          }));
          // If no entries exist, add one empty entry
          if (uniqueIdEntriesList.length === 0) {
            setUniqueIdEntries([{ id: 'unique-1', variableId: '' }]);
          } else {
            setUniqueIdEntries(uniqueIdEntriesList);
          }
          console.log('MetadataPanel: Set uniqueIdEntries:', uniqueIdEntriesList);
          
          // Load composite IDs
          const compositeIds = objectData?.compositeIds || {};
          const newCompositeKeys = compositeKeys.map(key => {
            const compositeIdData = compositeIds[key.id];
            if (compositeIdData && Array.isArray(compositeIdData) && compositeIdData.length > 0) {
              const variableIds = compositeIdData.map((ci: any) => ci.variableId).filter(Boolean);
              return {
                id: key.id,
                part: compositeIdData[0].part || '',
                group: compositeIdData[0].group || '',
                variables: variableIds
              };
            }
            return { id: key.id, part: '', group: '', variables: [] };
          });
          setCompositeKeys(newCompositeKeys);
          console.log('MetadataPanel: Set compositeKeys:', newCompositeKeys);
        } catch (error) {
          console.error('MetadataPanel: failed to load identifiers:', error);
          setUniqueIdEntries([{ id: 'unique-1', variableId: '' }]);
          setCompositeKeys([
            { id: '1', part: '', group: '', variables: [] },
            { id: '2', part: '', group: '', variables: [] },
            { id: '3', part: '', group: '', variables: [] },
            { id: '4', part: '', group: '', variables: [] },
            { id: '5', part: '', group: '', variables: [] }
          ]);
        }
      };
      
      loadIdentifiers();
    } else {
      setUniqueIdEntries([{ id: 'unique-1', variableId: '' }]);
      setCompositeKeys([
        { id: '1', part: '', group: '', variables: [] },
        { id: '2', part: '', group: '', variables: [] },
        { id: '3', part: '', group: '', variables: [] },
        { id: '4', part: '', group: '', variables: [] },
        { id: '5', part: '', group: '', variables: [] }
      ]);
    }
  }, [selectedObject?.id, selectedObject?._isCloned, selectedObject?._isSaved, selectedObject?.identifier]);

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

  // Get variables for unique ID (Part = "Identifier", Group = "Public ID")
  const getUniqueIdVariables = () => {
    return variablesData
      .filter(v => v.part === 'Identifier' && v.group === 'Public ID')
      .map(v => ({ id: v.id, name: v.variable }));
  };
  
  // Add a new unique ID entry
  // Check if object has any identifiers defined
  const hasIdentifiers = () => {
    // Check unique IDs
    const hasUniqueIds = uniqueIdEntries.some(entry => entry.variableId && entry.variableId.trim() !== '');
    
    // Check composite IDs
    const hasCompositeIds = compositeKeys.some(key => 
      (key.part && key.part.trim() !== '') || 
      (key.group && key.group.trim() !== '') || 
      (key.variables && key.variables.length > 0)
    );
    
    return hasUniqueIds || hasCompositeIds;
  };

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

  // Helper to convert variable IDs to names for display
  const getVariableNameFromId = (id: string) => {
    const variable = variablesData.find(v => v.id === id);
    return variable?.variable || id;
  };

  // Check if panel should be enabled (exactly 1 object selected)
  const isPanelEnabled = selectedCount === 1;
  
  // Check if the selected object is affected by driver deletion
  const isSelectedObjectAffected = selectedObject && affectedObjectIds.has(selectedObject.id);
  
  // Check which specific drivers are deleted
  const getDeletedDrivers = (driverString: string) => {
    if (!driverString) return [];
    const parts = driverString.split(', ');
    const deleted = [];
    if (parts.length >= 4) {
      // Check if any part is exactly "-" (indicating deleted driver)
      // Don't flag hyphens within names like "E-commerce"
      if (parts[0] === '-') deleted.push('sectors');
      if (parts[1] === '-') deleted.push('domains');
      if (parts[2] === '-') deleted.push('countries');
      if (parts[3] === '-') deleted.push('objectClarifiers');
    }
    return deleted;
  };
  
  const deletedDrivers = selectedObject ? getDeletedDrivers(selectedObject.driver) : [];
  const isSectorDeleted = deletedDrivers.includes('sectors') || (isSelectedObjectAffected && deletedDriverType === 'sectors');
  const isDomainDeleted = deletedDrivers.includes('domains') || (isSelectedObjectAffected && deletedDriverType === 'domains');
  const isCountryDeleted = deletedDrivers.includes('countries') || (isSelectedObjectAffected && deletedDriverType === 'countries');
  const isObjectClarifierDeleted = deletedDrivers.includes('objectClarifiers') || (isSelectedObjectAffected && deletedDriverType === 'objectClarifiers');

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const handleChange = (key: string, value: string | number) => {
    console.log('MetadataPanel handleChange called:', { key, value });
    
    // Mark user as typing
    isUserTyping.current = true;
    
    // Clear existing timeout
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    
    // Set timeout to mark user as no longer typing
    typingTimeout.current = setTimeout(() => {
      isUserTyping.current = false;
    }, 500); // 500ms delay after last keystroke
    
    setFormData(prev => {
      const newFormData = {
        ...prev,
        [key]: value
      };
      
      // If being is changed, reset avatar since avatars are specific to each being
      if (key === 'being') {
        newFormData.avatar = '';
      }
      
      console.log('MetadataPanel newFormData after change:', newFormData);
      return newFormData;
    });
  };

  const handleDriverSelectionChange = (type: 'sector' | 'domain' | 'country', values: string[]) => {
    setDriverSelections(prev => ({
      ...prev,
      [type]: values
    }));
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
        // Reset dependent fields when part or group changes
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

  const handleRelationshipChange = useCallback((id: string, field: keyof Relationship, value: string) => {
    console.log(`DEBUG: handleRelationshipChange called with id=${id}, field=${field}, value="${value}"`);
    
    setRelationships(prev => prev.map(rel => {
      if (rel.id === id) {
        const updated = { ...rel, [field]: value };
        
        // Handle Intra-Table logic
        if (field === 'type' && value === 'Intra-Table' && selectedObject) {
          // Auto-populate with selected object's values and make unchangeable
          updated.toBeing = selectedObject.being;
          updated.toAvatar = selectedObject.avatar;
          updated.toObject = selectedObject.object;
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
            // Reset avatar and object when being changes
            updated.toAvatar = '';
            updated.toObject = '';
          } else if (field === 'toAvatar' && value !== 'ALL') {
            // Reset object when avatar changes
            updated.toObject = '';
          }
        }
        
        console.log(`DEBUG: Updated relationship:`, updated);
        return updated;
      }
      return rel;
    }));
  }, [selectedObject]);

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

  const handleRelationshipCsvUpload = async (data: any[] | File) => {
    if (!selectedObject?.id) {
      alert('No object selected for relationship upload');
      return;
    }

    // Check if it's a File (new API-based upload) or array (old client-side parsing)
    if (data instanceof File) {
      try {
        const result = await apiService.bulkUploadRelationships(selectedObject.id, data);
        console.log('Bulk relationships upload result:', result);
        
        const response = result as any;
        
        // Check if there were errors (including duplicates)
        if (!response.success || (response.errors && response.errors.length > 0)) {
          // Show detailed error message with all issues
          const errorMessages = response.errors ? response.errors.join('\n') : 'Unknown errors occurred';
          alert(`Relationships upload completed with issues:\n\n${response.message}\n\nErrors:\n${errorMessages}`);
        } else {
          // Show success message
          alert(response.message || `Successfully uploaded ${response.created_count} relationships`);
        }
        
        // Refresh the relationships list by fetching the updated object data
        // This will trigger a re-render with the new relationships
        window.location.reload(); // Simple refresh for now
      } catch (error) {
        console.error('Bulk relationships upload failed:', error);
        alert(`Relationships upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Old client-side parsing logic (for backward compatibility)
      setRelationships(prev => [...prev, ...data]);
    }
  };

  const handleVariantCsvUpload = async (data: any[] | File) => {
    if (!selectedObject?.id) {
      alert('No object selected for variant upload');
      return;
    }

    // Check if it's a File (new API-based upload) or array (old client-side parsing)
    if (data instanceof File) {
      try {
        const result = await apiService.bulkUploadVariants(selectedObject.id, data);
        console.log('Bulk variants upload result:', result);
        
        // Show success message
        const response = result as any;
        alert(response.message || `Successfully uploaded ${response.created_count} variants`);
        
        // Refresh the variants list by fetching the updated variants
        try {
          const variantData = await apiService.getObjectVariants(selectedObject.id);
          const variantsList = variantData?.variantsList || [];
          // Convert variants array to multiline text
          const variantsTextContent = variantsList.map(v => v.name).join('\n');
          setVariantsText(variantsTextContent);
          console.log('MetadataPanel: refreshed variants after upload:', variantsList);
        } catch (error) {
          console.error('MetadataPanel: failed to refresh variants after upload:', error);
        }
      } catch (error) {
        console.error('Bulk variants upload failed:', error);
        alert(`Variants upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Old client-side parsing logic - append to textarea
      const existingNames = new Set(variantsText.split('\n').filter(line => line.trim()).map(name => name.toLowerCase()));
      const newVariants = data.filter((variant: any) => 
        !existingNames.has(variant.name.toLowerCase())
      );
      
      if (newVariants.length < data.length) {
        const skippedCount = data.length - newVariants.length;
        alert(`Uploaded ${newVariants.length} new variants. Skipped ${skippedCount} duplicates.`);
      }
      
      // Append new variants to textarea
      const newLines = newVariants.map((v: any) => v.name).join('\n');
      setVariantsText(prev => prev ? `${prev}\n${newLines}` : newLines);
    }
  };

  // Handlers for adding Being and Avatar values
  const handleAddBeingValue = async (value: string): Promise<void> => {
    saveBeingValue(value);
    setBeingAvatarUpdateTrigger(prev => prev + 1); // Trigger re-render to update dropdowns
    // Force component to re-render by updating state
    window.dispatchEvent(new Event('storage')); // Trigger storage event for cross-component updates
  };

  const handleAddAvatarValue = async (being: string, avatar: string): Promise<void> => {
    saveBeingAvatarAssociation(being, avatar);
    setBeingAvatarUpdateTrigger(prev => prev + 1); // Trigger re-render to update dropdowns
    // Force component to re-render by updating state
    window.dispatchEvent(new Event('storage')); // Trigger storage event for cross-component updates
  };

  const handleSave = () => {
    console.log('🔴 MetadataPanel handleSave called');
    console.log('🔴 Current formData:', formData);
    console.log('🔴 Current driverSelections:', driverSelections);
    console.log('🔴 Selected object:', selectedObject);
    
    // Generate driver string from selections
    const driverString = concatenateDrivers(
      driverSelections.sector,
      driverSelections.domain,
      driverSelections.country,
      driverSelections.objectClarifier
    );
    
    console.log('🔴 Generated driverString:', driverString);
    
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
    
    // Prepare identifier data - use unique IDs instead of discrete IDs
    const uniqueIdVariableIdsList = uniqueIdEntries
      .map(entry => entry.variableId)
      .filter(Boolean);
    
    const identifierData = {
      discreteId: {
        variables: uniqueIdVariableIdsList
      },
      compositeIds: {} as Record<string, { part: string; group: string; variables: string[] }>
    };

    // Add composite IDs (only those with part and group)
    compositeKeys.forEach(key => {
      if (key.part && key.group) {
        identifierData.compositeIds[key.id] = {
          part: key.part,
          group: key.group,
          variables: key.variables
        };
      }
    });

    const saveData = {
      ...formData,
      // Use the form data object value (user input)
      object: formData.object,
      driver: driverString,
      identifier: identifierData,
      relationshipsList: uniqueRelationships,
      variantsList: variantsList
    };
    console.log('🔴 MetadataPanel saving data:', saveData);
    console.log('🔴 Relationships:', uniqueRelationships);
    console.log('🔴 Variants:', variantsList);
    console.log('🔴 Calling onSave with:', saveData);
    onSave?.(saveData);
    
    // After saving, remove entries with empty variableId (user cleared them)
    // Keep at least one empty entry if all were cleared
    setUniqueIdEntries(prev => {
      const filtered = prev.filter(entry => entry.variableId.trim() !== '');
      return filtered.length > 0 ? filtered : [{ id: 'unique-1', variableId: '' }];
    });
  };

  // Multi-select component
  const MultiSelect: React.FC<{
    label: string;
    options: string[];
    values: string[];
    onChange: (values: string[]) => void;
    disabled?: boolean;
    compact?: boolean;
  }> = ({ label, options, values, onChange, disabled, compact = false }) => {
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
      ? (options.length === 0 ? `No values found — please add new items in Drivers tab` : `Select ${label}`)
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
    ontologyViewType?: 'drivers' | 'ontology' | 'identifiers' | 'relationships' | 'variants';
  }> = ({ title, sectionKey, icon, actions, children, ontologyViewType }) => {
    const isExpanded = expandedSections[sectionKey];
    const isObjectSelected = !!selectedObject?.object;
    
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
                  if (isObjectSelected) {
                    openOntologyModal(ontologyViewType);
                  }
                }}
                disabled={!isObjectSelected}
                className={`p-1 transition-colors ${
                  isObjectSelected 
                    ? 'text-ag-dark-text-secondary hover:text-ag-dark-accent' 
                    : 'text-ag-dark-text-secondary/30 cursor-not-allowed opacity-50'
                }`}
                title={isObjectSelected ? "View Neo4j Ontology" : "Select an object to view ontology"}
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
      <div className="flex-1 overflow-y-auto px-6">
      {/* Object Name Field - Moved out of collapsible section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-ag-dark-text mb-2">
          Object Name
        </label>
        <input
          type="text"
          value={formData.object}
          onChange={(e) => handleChange('object', e.target.value)}
          disabled={!isPanelEnabled}
          onClick={(e) => e.stopPropagation()}
          className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
            !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
        {/* Alert for cloned rows */}
        {selectedObject?._isCloned && !selectedObject?._isSaved && (
          <div className="mt-2 p-3 bg-orange-900 bg-opacity-20 border border-orange-500 border-opacity-50 rounded text-sm">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-orange-400 font-medium mb-1">
                  Please define a new Object name to save this clone.
                </div>
                <div className="text-orange-300 text-xs">
                  Each Object must have a unique combination of Sector, Domain, Country, and other identifying attributes. Please edit the name or adjust another field to make it distinct.
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
              {(driverSelections.sector.length === 0 || isSectorDeleted) && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </label>
            {isSectorDeleted ? (
              <div className="text-red-400 text-sm mb-2">
                Please reselect sector
              </div>
            ) : driverSelections.sector.length === 0 ? (
              <div className="text-red-400 text-sm mb-2">
                Please select a relevant Sector
              </div>
            ) : null}
            <MultiSelect
              label="Sector"
              options={['ALL', ...driversData.sectors]}
              values={isSectorDeleted ? [] : driverSelections.sector}
              onChange={(values) => handleDriverSelectionChange('sector', values)}
              disabled={!isPanelEnabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Domain
              {(driverSelections.domain.length === 0 || isDomainDeleted) && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </label>
            {isDomainDeleted ? (
              <div className="text-red-400 text-sm mb-2">
                Please reselect domain
              </div>
            ) : driverSelections.domain.length === 0 ? (
              <div className="text-red-400 text-sm mb-2">
                Please select a relevant Domain
              </div>
            ) : null}
            <MultiSelect
              label="Domain"
              options={['ALL', ...driversData.domains]}
              values={isDomainDeleted ? [] : driverSelections.domain}
              onChange={(values) => handleDriverSelectionChange('domain', values)}
              disabled={!isPanelEnabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Country
              {(driverSelections.country.length === 0 || isCountryDeleted) && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </label>
            {isCountryDeleted ? (
              <div className="text-red-400 text-sm mb-2">
                Please reselect country
              </div>
            ) : driverSelections.country.length === 0 ? (
              <div className="text-red-400 text-sm mb-2">
                Please select a relevant Country
              </div>
            ) : null}
            <MultiSelect
              label="Country"
              options={['ALL', ...driversData.countries]}
              values={isCountryDeleted ? [] : driverSelections.country}
              onChange={(values) => handleDriverSelectionChange('country', values)}
              disabled={!isPanelEnabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Object Clarifier
              {isObjectClarifierDeleted && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </label>
            {isObjectClarifierDeleted && (
              <div className="text-red-400 text-sm mb-2">
                Please reselect object clarifier
              </div>
            )}
            <select
              value={isObjectClarifierDeleted ? "" : driverSelections.objectClarifier}
              onChange={(e) => handleObjectClarifierChange(e.target.value)}
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
                disabled={!isPanelEnabled}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Add new Being value"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.being}
              onChange={(e) => handleChange('being', e.target.value)}
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
              <option value="">Select Being</option>
              {(() => {
                // Get distinct beings from grid data, ensuring current value is included
                const options = getDistinctBeings().filter(being => being !== 'ALL');
                const merged = new Set<string>(options);
                if (formData.being && !merged.has(formData.being)) {
                  merged.add(formData.being);
                }
                return Array.from(merged).map(option => (
                  <option key={option} value={option}>{option}</option>
                ));
              })()}
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
                disabled={!isPanelEnabled}
                className="text-ag-dark-accent hover:text-ag-dark-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Add new Avatar value"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={formData.avatar}
              onChange={(e) => handleChange('avatar', e.target.value)}
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
              <option value="">Select Avatar</option>
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
            {/* Clone Identifiers Button - Hide for cloned objects (they already have identifiers) */}
            {!(selectedObject?._isCloned && !selectedObject?._isSaved) && (
              <button
                onClick={() => setIsCloneIdentifiersModalOpen(true)}
                disabled={!isPanelEnabled || hasIdentifiers()}
                className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                  !isPanelEnabled || hasIdentifiers() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
                }`}
                title={hasIdentifiers() ? "Please delete existing identifiers to use clone" : "Clone identifiers from another object"}
              >
                <Copy className="w-5 h-5" />
              </button>
            )}
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
                disabled={!isPanelEnabled}
                className="flex items-center justify-center text-ag-dark-accent hover:text-ag-dark-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                {uniqueIdEntries.length === 0 ? (
                  <div className="grid grid-cols-[0.7fr_0.7fr_1.6fr] gap-2 items-center p-2">
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
                    <div className="text-xs text-ag-dark-text-secondary px-2 py-1.5">
                      Click + to add a Unique ID
                    </div>
                  </div>
                ) : (
                  uniqueIdEntries.map((entry, index) => (
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
                        disabled={!isPanelEnabled}
                        className="w-full pl-2 pr-8 py-1.5 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
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
                          disabled={!isPanelEnabled}
                          className="flex items-center justify-center w-6 h-6 rounded text-ag-dark-error hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Remove Unique ID"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))
                )}
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
                        disabled={!isPanelEnabled}
                        className={`w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                          !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
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
                        disabled={!isPanelEnabled || !compositeKey.part}
                        className={`w-full px-2 py-1.5 pr-8 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent appearance-none ${
                          !isPanelEnabled || !compositeKey.part ? 'opacity-50 cursor-not-allowed' : ''
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
                          // Convert names back to IDs
                          const ids = values.map(val => {
                            if (val === 'ALL') return 'ALL';
                            const varData = variableOptions.find(v => v.name === val);
                            return varData?.id || val;
                          });
                          handleCompositeKeyVariablesChange(compositeKey.id, ids);
                        }}
                        disabled={!isPanelEnabled || !compositeKey.part || !compositeKey.group}
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
        title="Relationships" 
        sectionKey="relationships"
        icon={<Link className="w-4 h-4 text-ag-dark-text-secondary" />}
        ontologyViewType="relationships"
        actions={
          <div className="flex items-center gap-2">
            {/* Clone Relationships Button - Hide for cloned objects (they already have relationships) */}
            {!(selectedObject?._isCloned && !selectedObject?._isSaved) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCloneRelationshipsModalOpen(true);
                }}
                disabled={!isPanelEnabled || relationships.length > 0}
                className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                  !isPanelEnabled || relationships.length > 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
                }`}
                title={relationships.length > 0 ? "Please delete existing relationships to use clone" : "Clone relationships from another object"}
              >
                <Copy className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEnterRelationshipView();
              }}
              disabled={!isPanelEnabled || (selectedObject?._isCloned && !selectedObject?._isSaved)}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                !isPanelEnabled || (selectedObject?._isCloned && !selectedObject?._isSaved) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title={
                selectedObject?._isCloned && !selectedObject?._isSaved 
                  ? "Please save the cloned object before viewing relationships graph" 
                  : selectedCount > 1 
                    ? "View relationships (bulk edit not yet supported)" 
                    : "View and manage relationships"
              }
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
          </div>
        }
      >
        {/* Relationship Summary - Only show for single object selection */}
        {console.log('MetadataPanel: rendering relationships summary, relationships.length:', relationships.length, 'relationships:', relationships)}
        {!isPanelEnabled && selectedCount > 1 && (
          <div className="mb-6">
            <div className="bg-ag-dark-bg rounded-lg p-4 border border-ag-dark-border">
              <div className="text-sm text-ag-dark-text-secondary">
                <span className="font-medium">Bulk relationship management</span> is not yet supported. 
                Please select a single object to view and manage relationships.
              </div>
            </div>
          </div>
        )}
        {isPanelEnabled && relationships.length > 0 && (
          <div className="mb-6">
            <h5 className="text-sm font-medium text-ag-dark-text mb-3">Current Relationships</h5>
            <div className="space-y-2">
              {(() => {
                // Group relationships by object (toBeing, toAvatar, toObject) and combine roles
                const groupedRelationships = relationships.reduce((acc, relationship) => {
                  const key = `${relationship.toBeing}-${relationship.toAvatar}-${relationship.toObject}`;
                  if (!acc[key]) {
                    acc[key] = {
                      toBeing: relationship.toBeing,
                      toAvatar: relationship.toAvatar,
                      toObject: relationship.toObject,
                      type: relationship.type,
                      roles: []
                    };
                  }
                  acc[key].roles.push(relationship.role);
                  return acc;
                }, {} as Record<string, any>);

                // Convert to array and sort roles
                return Object.values(groupedRelationships).map((groupedRel: any, index) => (
                  <div key={`${groupedRel.toBeing}-${groupedRel.toAvatar}-${groupedRel.toObject}`} className="bg-ag-dark-bg rounded-lg p-3 border border-ag-dark-border">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-sm text-ag-dark-text">
                          <span className="font-medium">{groupedRel.toBeing} - {groupedRel.toAvatar} - {groupedRel.toObject}</span>
                        </div>
                        <div className="text-xs text-ag-dark-text-secondary mt-1">
                          <span className="font-medium">Type:</span> {groupedRel.type} | <span className="font-medium">Roles:</span> {groupedRel.roles.join(', ')}
                        </div>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Variants Section */}
      <CollapsibleSection 
        title="Variants" 
        sectionKey="variants"
        icon={<Layers className="w-4 h-4 text-ag-dark-text-secondary" />}
        ontologyViewType="variants"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSortVariants('asc')}
              disabled={!isPanelEnabled}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title="Sort A-Z"
            >
              <ArrowUpAZ className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleSortVariants('desc')}
              disabled={!isPanelEnabled}
              className={`p-1.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-ag-dark-bg'
              }`}
              title="Sort Z-A"
            >
              <ArrowDownZA className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsVariantUploadOpen(true)}
              disabled={!isPanelEnabled}
              className={`text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors ${
                !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Upload Variants CSV"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        }
      >
        <textarea
          ref={variantsTextareaRef}
          value={variantsText}
          onChange={(e) => {
            const textarea = e.target as HTMLTextAreaElement;
            const cursorPosition = textarea.selectionStart;
            lastChangeTimeRef.current = Date.now();
            setVariantsText(e.target.value);
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
          disabled={!isPanelEnabled}
          placeholder="Type one variant per line. Press Enter to add more."
          rows={8}
          className={`w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-1 focus:ring-ag-dark-accent focus:border-ag-dark-accent resize-y ${
            !isPanelEnabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
      </CollapsibleSection>

      </div>

      {/* Actions - Fixed at bottom */}
      {onSave && (
        <div className="mt-6 pt-4 border-t border-ag-dark-border flex-shrink-0 px-6 pb-6">
          <button
            onClick={handleSave}
            disabled={!isPanelEnabled || (selectedObject?._isCloned && !selectedObject?._isSaved && !formData.object?.trim())}
            className={`w-full bg-ag-dark-accent text-white py-2 px-4 rounded hover:bg-ag-dark-accent-hover transition-colors flex items-center justify-center gap-2 ${
              !isPanelEnabled || (selectedObject?._isCloned && !selectedObject?._isSaved && !formData.object?.trim()) ? 'opacity-50 cursor-not-allowed bg-ag-dark-text-secondary hover:bg-ag-dark-text-secondary' : ''
            }`}
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      )}

      {/* Relationship CSV Upload Modal removed - moved to RelationshipModal */}

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

      {/* Ontology Modal */}
      {ontologyModalOpen.isOpen && ontologyModalOpen.viewType && (selectedObject?.id || selectedObject?.object) && (
        <OntologyModal
          isOpen={ontologyModalOpen.isOpen}
          onClose={closeOntologyModal}
          objectId={
            // For cloned unsaved objects, don't use the temporary ID - it won't exist in Neo4j
            // Only use objectId if it's a real saved object (not a clone ID)
            // Also ensure we don't use clone- prefixed IDs even if _isCloned flag is missing
            (selectedObject?.id?.startsWith('clone-') || (selectedObject?._isCloned && !selectedObject?._isSaved))
              ? undefined
              : (selectedObject?.id && !selectedObject?.id.startsWith('clone-')) ? selectedObject.id : undefined
          }
          objectName={
            // Always pass object name for display in header (even if we use objectId for query)
            selectedObject?.object || undefined
          }
          sectionName={
            ontologyModalOpen.viewType === 'drivers' ? 'Drivers' :
            ontologyModalOpen.viewType === 'ontology' ? 'Ontology' :
            ontologyModalOpen.viewType === 'identifiers' ? 'Identifiers' :
            ontologyModalOpen.viewType === 'relationships' ? 'Relationships' :
            'Variants'
          }
          viewType={ontologyModalOpen.viewType}
        />
      )}

      {/* Clone Relationships Modal */}
      {selectedObject && (
        <CloneRelationshipsModal
          isOpen={isCloneRelationshipsModalOpen}
          onClose={() => setIsCloneRelationshipsModalOpen(false)}
          targetObject={selectedObject}
          allObjects={allData}
          onCloneSuccess={async () => {
            // Refresh relationships after cloning
            if (selectedObject?.id) {
              try {
                const relationshipData = await apiService.getObjectRelationships(selectedObject.id) as any;
                const relationshipsList = relationshipData?.relationshipsList || [];
                setRelationships(relationshipsList);
                
                // Refresh objects data to update the relationships count immediately
                if (onObjectsRefresh) {
                  await onObjectsRefresh();
                }
              } catch (error) {
                console.error('Failed to refresh relationships after cloning:', error);
              }
            }
          }}
        />
      )}

      {/* Clone Identifiers Modal */}
      {selectedObject && (
        <CloneIdentifiersModal
          isOpen={isCloneIdentifiersModalOpen}
          onClose={() => setIsCloneIdentifiersModalOpen(false)}
          targetObject={selectedObject}
          allObjects={allData}
          onCloneSuccess={async () => {
            // Refresh identifiers after cloning
            if (selectedObject?.id) {
              try {
                const objectData = await apiService.getObject(selectedObject.id) as any;
                
                // Load unique IDs
                const discreteIds = objectData?.discreteIds || [];
                const uniqueIdEntriesList = discreteIds.map((di: any, index: number) => ({
                  id: `unique-${index + 1}`,
                  variableId: di.variableId || ''
                }));
                if (uniqueIdEntriesList.length === 0) {
                  setUniqueIdEntries([{ id: 'unique-1', variableId: '' }]);
                } else {
                  setUniqueIdEntries(uniqueIdEntriesList);
                }
                
                // Load composite IDs
                const compositeIds = objectData?.compositeIds || {};
                const newCompositeKeys = compositeKeys.map(key => {
                  const compositeIdData = compositeIds[key.id];
                  if (compositeIdData && Array.isArray(compositeIdData) && compositeIdData.length > 0) {
                    const variableIds = compositeIdData.map((ci: any) => ci.variableId).filter(Boolean);
                    return {
                      id: key.id,
                      part: compositeIdData[0].part || '',
                      group: compositeIdData[0].group || '',
                      variables: variableIds
                    };
                  }
                  return { id: key.id, part: '', group: '', variables: [] };
                });
                setCompositeKeys(newCompositeKeys);
                
                // Refresh objects data
                if (onObjectsRefresh) {
                  await onObjectsRefresh();
                }
              } catch (error) {
                console.error('Failed to refresh identifiers after cloning:', error);
              }
            }
          }}
        />
      )}

    </div>
  );
};