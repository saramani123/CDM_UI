import React, { useState, useEffect, useRef } from 'react';
import { X, GripVertical, Maximize2, Minimize2, ArrowUpAZ, ArrowDownZA } from 'lucide-react';
import type { VariableData } from '../data/variablesData';
import type { ObjectData } from '../data/mockData';
import { apiService } from '../services/api';

interface OrderSortOrder {
  partOrder: string[];
  sectionOrders: Record<string, string[]>; // key: part, value: array of sections
  groupOrders: Record<string, string[]>; // key: "part|section", value: array of groups
  variableOrders: Record<string, string[]>; // key: "part|section|group", value: array of variables
  sectorOrder?: string[]; // Independent S column order
  domainOrder?: string[]; // Independent D column order
  countryOrder?: string[]; // Independent C column order
  beingOrder?: string[];
  avatarOrders?: Record<string, string[]>;
  objectOrders?: Record<string, string[]>;
}

interface SourceLdmOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveOrder: (order: OrderSortOrder) => void; // Changed: only saves order, doesn't enable/disable
  variableData: VariableData[];
  objectData: ObjectData[];
  sortConfig?: any;
  orderSortOrder?: OrderSortOrder;
}

export const SourceLdmOrderModal: React.FC<SourceLdmOrderModalProps> = ({
  isOpen,
  onClose,
  onSaveOrder,
  variableData,
  objectData,
  orderSortOrder
}) => {
  const [workingPartOrder, setWorkingPartOrder] = useState<string[]>([]);
  const [workingSectionOrders, setWorkingSectionOrders] = useState<Record<string, string[]>>({});
  const [workingGroupOrders, setWorkingGroupOrders] = useState<Record<string, string[]>>({});
  const [workingVariableOrders, setWorkingVariableOrders] = useState<Record<string, string[]>>({});
  const [workingBeingOrder, setWorkingBeingOrder] = useState<string[]>([]);
  const [workingAvatarOrders, setWorkingAvatarOrders] = useState<Record<string, string[]>>({});
  const [workingObjectOrders, setWorkingObjectOrders] = useState<Record<string, string[]>>({});
  const [savedBeingOrder, setSavedBeingOrder] = useState<string[]>([]);
  const [savedAvatarOrders, setSavedAvatarOrders] = useState<Record<string, string[]>>({});
  const [savedObjectOrders, setSavedObjectOrders] = useState<Record<string, string[]>>({});
  // Click-based selections (cascading filters)
  const [selectedPart, setSelectedPart] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedBeing, setSelectedBeing] = useState<string>('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'part' | 'section' | 'group' | 'variable' | 'being' | 'avatar' | 'object' | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number>(-1);
  const [savedPartOrder, setSavedPartOrder] = useState<string[]>([]);
  const [savedSectionOrders, setSavedSectionOrders] = useState<Record<string, string[]>>({});
  const [savedGroupOrders, setSavedGroupOrders] = useState<Record<string, string[]>>({});
  const [savedVariableOrders, setSavedVariableOrders] = useState<Record<string, string[]>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  
  // State for API-based cascading data
  const [partsList, setPartsList] = useState<string[]>([]);
  const [sectionsList, setSectionsList] = useState<string[]>([]);
  const [groupsList, setGroupsList] = useState<string[]>([]);
  const [variablesList, setVariablesList] = useState<string[]>([]);
  const [isLoadingParts, setIsLoadingParts] = useState(false);
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingVariables, setIsLoadingVariables] = useState(false);

  // Load parts from API on mount
  useEffect(() => {
    if (!isOpen) return;
    
    const loadParts = async () => {
      setIsLoadingParts(true);
      try {
        const response = await apiService.getVariableParts() as { parts: string[] };
        setPartsList(response.parts || []);
      } catch (error) {
        console.error('Error loading parts:', error);
        // Fallback to local data
        const parts = Array.from(new Set(variableData.map(v => v.part).filter(Boolean))).sort();
        setPartsList(parts);
      } finally {
        setIsLoadingParts(false);
      }
    };
    loadParts();
  }, [isOpen]);

  // Load sections when part is selected
  useEffect(() => {
    const loadSections = async () => {
      if (!selectedPart) {
        setSectionsList([]);
        return;
      }
      setIsLoadingSections(true);
      try {
        const response = await apiService.getVariableSections(selectedPart) as { sections: string[] };
        setSectionsList(response.sections || []);
      } catch (error) {
        console.error('Error loading sections:', error);
        // Fallback to local data
        const sections = Array.from(new Set(variableData.filter(v => v.part === selectedPart).map(v => v.section).filter(Boolean))).sort();
        setSectionsList(sections);
      } finally {
        setIsLoadingSections(false);
      }
    };
    loadSections();
  }, [selectedPart, variableData]);

  // Load groups when part and section are selected
  useEffect(() => {
    const loadGroups = async () => {
      if (!selectedPart || !selectedSection) {
        setGroupsList([]);
        return;
      }
      setIsLoadingGroups(true);
      try {
        const response = await apiService.getVariableGroups(selectedPart, selectedSection) as { groups: string[] };
        setGroupsList(response.groups || []);
      } catch (error) {
        console.error('Error loading groups:', error);
        // Fallback to local data
        const groups = Array.from(new Set(variableData.filter(v => v.part === selectedPart && v.section === selectedSection).map(v => v.group).filter(Boolean))).sort();
        setGroupsList(groups);
      } finally {
        setIsLoadingGroups(false);
      }
    };
    loadGroups();
  }, [selectedPart, selectedSection, variableData]);

  // Load variables when part, section, and group are selected
  useEffect(() => {
    const loadVariables = async () => {
      if (!selectedPart || !selectedSection || !selectedGroup) {
        setVariablesList([]);
        return;
      }
      setIsLoadingVariables(true);
      try {
        const response = await apiService.getVariablesForSelection(selectedPart, selectedSection, selectedGroup) as { variables: Array<{ id: string; name: string }> };
        setVariablesList(response.variables?.map(v => v.name) || []);
      } catch (error) {
        console.error('Error loading variables:', error);
        // Fallback to local data
        const variables = Array.from(new Set(variableData.filter(v => 
          v.part === selectedPart && 
          v.section === selectedSection && 
          v.group === selectedGroup
        ).map(v => v.variable).filter(Boolean))).sort();
        setVariablesList(variables);
      } finally {
        setIsLoadingVariables(false);
      }
    };
    loadVariables();
  }, [selectedPart, selectedSection, selectedGroup, variableData]);

  // Get distinct values - dynamically updated when variableData changes
  const distinctParts = partsList.length > 0 ? partsList : Array.from(new Set(variableData.map(v => v.part).filter(Boolean))).sort();
  
  const distinctBeings = Array.from(new Set(objectData.map(o => o.being).filter(Boolean))).sort();
  const avatarsForBeing = selectedBeing
    ? Array.from(new Set(objectData.filter(o => o.being === selectedBeing).map(o => o.avatar).filter(Boolean))).sort()
    : [];
  const objectsForBeingAndAvatar = selectedBeing && selectedAvatar
    ? Array.from(new Set(objectData.filter(o => o.being === selectedBeing && o.avatar === selectedAvatar).map(o => o.object).filter(Boolean))).sort()
    : [];
  
  // Section values filtered by selected part (from Part column click) - use API data
  const sectionsForPart = selectedPart ? sectionsList : [];
  
  // Group values filtered by selected part and section (from Part and Section column clicks) - use API data
  const groupsForPartAndSection = selectedPart && selectedSection ? groupsList : [];
  
  // Variable values filtered by selected part, section, and group (from Part, Section, and Group column clicks) - use API data
  const variablesForPartSectionAndGroup = selectedPart && selectedSection && selectedGroup ? variablesList : [];

  // Initialize working orders from props or create defaults - only once when modal opens
  // CRITICAL: Order should NEVER change unless user explicitly modifies it via drag-and-drop
  // New items should be appended to the end, edits should stay in place, deletes should remove without affecting others
  useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false);
      return;
    }
    
    // Wait for parts to load before initializing
    if (!isInitialized && (partsList.length > 0 || isLoadingParts === false)) {
      const currentDistinctParts = partsList.length > 0 ? partsList : Array.from(new Set(variableData.map(v => v.part).filter(Boolean))).sort();
      
      if (orderSortOrder) {
        // Start with saved order - this is the source of truth
        const savedPartOrder = orderSortOrder.partOrder && orderSortOrder.partOrder.length > 0 
          ? [...orderSortOrder.partOrder] 
          : [];
        
        // Filter out deleted parts (parts that no longer exist in data)
        const validSavedParts = savedPartOrder.filter(part => currentDistinctParts.includes(part));
        
        // Find new parts that aren't in saved order - append to end
        const newParts = currentDistinctParts.filter(part => !savedPartOrder.includes(part));
        
        // Final order: valid saved parts (in saved order) + new parts (at end)
        const partOrder = [...validSavedParts, ...newParts];
        
        // Handle section orders - preserve existing order, append new sections
        // Note: We'll load sections from API when parts are selected, but for initialization
        // we use variableData as fallback
        let sectionOrders = orderSortOrder.sectionOrders || {};
        if (!orderSortOrder.sectionOrders && (orderSortOrder as any).sectionOrder) {
          // Migrate old flat sectionOrder to new structure - distribute across all parts
          const oldSectionOrder = (orderSortOrder as any).sectionOrder as string[];
          sectionOrders = {};
          currentDistinctParts.forEach(part => {
            // Use API data if available, otherwise fallback to variableData
            const sectionsForThisPart = Array.from(new Set(variableData.filter(v => v.part === part).map(v => v.section).filter(Boolean))).sort();
            // Preserve order from old sectionOrder if sections exist in both
            const orderedSections = oldSectionOrder.filter(s => sectionsForThisPart.includes(s));
            const remainingSections = sectionsForThisPart.filter(s => !orderedSections.includes(s));
            sectionOrders[part] = [...orderedSections, ...remainingSections];
          });
        } else {
          // For each part, preserve saved order and append new sections
          // When a part is clicked, sections will be loaded from API
          currentDistinctParts.forEach(part => {
            const sectionsForThisPart = Array.from(new Set(variableData.filter(v => v.part === part).map(v => v.section).filter(Boolean))).sort();
            const savedSectionOrder = sectionOrders[part] || [];
            
            // Filter out deleted sections, preserve order
            const validSavedSections = savedSectionOrder.filter(section => sectionsForThisPart.includes(section));
            
            // Find new sections - append to end
            const newSections = sectionsForThisPart.filter(section => !savedSectionOrder.includes(section));
            
            // Final order: valid saved sections (in saved order) + new sections (at end)
            sectionOrders[part] = [...validSavedSections, ...newSections];
          });
        }
        
        // Handle group orders - preserve existing order, append new groups
        const groupOrders: Record<string, string[]> = {};
        const savedGroupOrders = orderSortOrder.groupOrders || {};
        currentDistinctParts.forEach(part => {
          const sectionsForPart = Array.from(new Set(variableData.filter(v => v.part === part).map(v => v.section).filter(Boolean))).sort();
          sectionsForPart.forEach(section => {
            const key = `${part}|${section}`;
            const groupsForPartSection = Array.from(new Set(variableData.filter(v => v.part === part && v.section === section).map(v => v.group).filter(Boolean))).sort();
            const savedGroupOrder = savedGroupOrders[key] || [];
            
            // Filter out deleted groups, preserve order
            const validSavedGroups = savedGroupOrder.filter(group => groupsForPartSection.includes(group));
            
            // Find new groups - append to end
            const newGroups = groupsForPartSection.filter(group => !savedGroupOrder.includes(group));
            
            // Final order: valid saved groups (in saved order) + new groups (at end)
            groupOrders[key] = [...validSavedGroups, ...newGroups];
          });
        });
        
        // Handle variable orders - preserve existing order, append new variables
        const variableOrders: Record<string, string[]> = {};
        const savedVariableOrders = orderSortOrder.variableOrders || {};
        currentDistinctParts.forEach(part => {
          const sectionsForPart = Array.from(new Set(variableData.filter(v => v.part === part).map(v => v.section).filter(Boolean))).sort();
          sectionsForPart.forEach(section => {
            const groupsForPartSection = Array.from(new Set(variableData.filter(v => v.part === part && v.section === section).map(v => v.group).filter(Boolean))).sort();
            groupsForPartSection.forEach(group => {
              const key = `${part}|${section}|${group}`;
              const variablesForPartSectionGroup = Array.from(new Set(variableData.filter(v => v.part === part && v.section === section && v.group === group).map(v => v.variable).filter(Boolean))).sort();
              const savedVariableOrder = savedVariableOrders[key] || [];
              
              // Filter out deleted variables, preserve order
              const validSavedVariables = savedVariableOrder.filter(variable => variablesForPartSectionGroup.includes(variable));
              
              // Find new variables - append to end
              const newVariables = variablesForPartSectionGroup.filter(variable => !savedVariableOrder.includes(variable));
              
              // Final order: valid saved variables (in saved order) + new variables (at end)
              variableOrders[key] = [...validSavedVariables, ...newVariables];
            });
          });
        });
        
        setWorkingPartOrder(partOrder);
        setWorkingSectionOrders(sectionOrders);
        setSavedPartOrder(partOrder);
        setSavedSectionOrders(sectionOrders);
        setWorkingGroupOrders(groupOrders);
        setSavedGroupOrders(groupOrders);
        setWorkingVariableOrders(variableOrders);
        setSavedVariableOrders(variableOrders);

        const distinctBeingsLocal = Array.from(new Set(objectData.map(o => o.being).filter(Boolean))).sort();
        const savedBeingOrderInit = orderSortOrder.beingOrder && orderSortOrder.beingOrder.length > 0
          ? [...orderSortOrder.beingOrder]
          : [];
        const validSavedBeingsInit = savedBeingOrderInit.filter(being => distinctBeingsLocal.includes(being));
        const newBeingsInit = distinctBeingsLocal.filter(being => !savedBeingOrderInit.includes(being));
        const beingOrderMerged = [...validSavedBeingsInit, ...newBeingsInit];

        const avatarOrdersMerged: Record<string, string[]> = {};
        const savedAvatarOrdersInit = orderSortOrder.avatarOrders || {};
        distinctBeingsLocal.forEach(being => {
          const avatarsForBeingLocal = Array.from(new Set(objectData.filter(o => o.being === being).map(o => o.avatar).filter(Boolean))).sort();
          const savedAvatarOrderRow = savedAvatarOrdersInit[being] || [];
          const validSavedAvatarsRow = savedAvatarOrderRow.filter(avatar => avatarsForBeingLocal.includes(avatar));
          const newAvatarsRow = avatarsForBeingLocal.filter(avatar => !savedAvatarOrderRow.includes(avatar));
          avatarOrdersMerged[being] = [...validSavedAvatarsRow, ...newAvatarsRow];
        });

        const objectOrdersMerged: Record<string, string[]> = {};
        const savedObjectOrdersInit = orderSortOrder.objectOrders || {};
        distinctBeingsLocal.forEach(being => {
          const avatarsForBeingLocal = Array.from(new Set(objectData.filter(o => o.being === being).map(o => o.avatar).filter(Boolean))).sort();
          avatarsForBeingLocal.forEach(avatar => {
            const keyObj = `${being}|${avatar}`;
            const objectsForBeingAvatar = Array.from(new Set(objectData.filter(o => o.being === being && o.avatar === avatar).map(o => o.object).filter(Boolean))).sort();
            const savedObjectOrderRow = savedObjectOrdersInit[keyObj] || [];
            const validSavedObjectsRow = savedObjectOrderRow.filter(obj => objectsForBeingAvatar.includes(obj));
            const newObjectsRow = objectsForBeingAvatar.filter(obj => !savedObjectOrderRow.includes(obj));
            objectOrdersMerged[keyObj] = [...validSavedObjectsRow, ...newObjectsRow];
          });
        });

        setWorkingBeingOrder(beingOrderMerged);
        setSavedBeingOrder(beingOrderMerged);
        setWorkingAvatarOrders(avatarOrdersMerged);
        setSavedAvatarOrders(avatarOrdersMerged);
        setWorkingObjectOrders(objectOrdersMerged);
        setSavedObjectOrders(objectOrdersMerged);
      } else {
        // Create default alphabetical orders (only if no saved order exists)
        setWorkingPartOrder(currentDistinctParts);
        setWorkingSectionOrders({});
        setSavedPartOrder(currentDistinctParts);
        setSavedSectionOrders({});
        setWorkingGroupOrders({});
        setSavedGroupOrders({});
        setWorkingVariableOrders({});
        setSavedVariableOrders({});

        setWorkingBeingOrder(distinctBeings);
        setSavedBeingOrder(distinctBeings);
        setWorkingAvatarOrders({});
        setSavedAvatarOrders({});
        setWorkingObjectOrders({});
        setSavedObjectOrders({});
      }
      setIsInitialized(true);
    }
  }, [isOpen, orderSortOrder, isInitialized, variableData, objectData, distinctBeings, partsList, isLoadingParts]);

  // Initialize working order for sections when a part is selected (from Part column click)
  useEffect(() => {
    if (selectedPart) {
      const sectionsForSelectedPart = Array.from(new Set(variableData.filter(v => v.part === selectedPart).map(v => v.section).filter(Boolean))).sort();
      const savedOrder = savedSectionOrders[selectedPart];
      const currentOrder = workingSectionOrders[selectedPart];
      
      // If no working order exists, create one
      if (!currentOrder) {
        if (savedOrder && savedOrder.length > 0) {
          // Start with saved order, add any new sections that aren't in saved order
          const newSections = sectionsForSelectedPart.filter(s => !savedOrder.includes(s));
          setWorkingSectionOrders(prev => ({ ...prev, [selectedPart]: [...savedOrder, ...newSections] }));
        } else {
          setWorkingSectionOrders(prev => ({ ...prev, [selectedPart]: sectionsForSelectedPart }));
        }
      } else {
        // Update existing order to include any new sections
        const newSections = sectionsForSelectedPart.filter(s => !currentOrder.includes(s));
        if (newSections.length > 0) {
          setWorkingSectionOrders(prev => ({ ...prev, [selectedPart]: [...currentOrder, ...newSections] }));
        }
      }
    }
  }, [selectedPart, variableData, savedSectionOrders, workingSectionOrders]);

  // Initialize working order for groups when part+section are selected in Group column
  useEffect(() => {
    if (selectedPart && selectedSection) {
      const key = `${selectedPart}|${selectedSection}`;
      const groupsForSelected = Array.from(new Set(variableData.filter(v => v.part === selectedPart && v.section === selectedSection).map(v => v.group).filter(Boolean))).sort();
      const savedOrder = savedGroupOrders[key];
      const currentOrder = workingGroupOrders[key];
      
      if (!currentOrder) {
        if (savedOrder && savedOrder.length > 0) {
          // Start with saved order, add any new groups that aren't in saved order
          const newGroups = groupsForSelected.filter(g => !savedOrder.includes(g));
          setWorkingGroupOrders(prev => ({ ...prev, [key]: [...savedOrder, ...newGroups] }));
        } else {
          setWorkingGroupOrders(prev => ({ ...prev, [key]: groupsForSelected }));
        }
      } else {
        // Update existing order to include any new groups
        const newGroups = groupsForSelected.filter(g => !currentOrder.includes(g));
        if (newGroups.length > 0) {
          setWorkingGroupOrders(prev => ({ ...prev, [key]: [...currentOrder, ...newGroups] }));
        }
      }
    }
  }, [selectedPart, selectedSection, variableData, savedGroupOrders, workingGroupOrders]);

  // Initialize working order for variables when part+section+group are selected (from column clicks)
  useEffect(() => {
    if (selectedPart && selectedSection && selectedGroup) {
      const key = `${selectedPart}|${selectedSection}|${selectedGroup}`;
      const variablesForSelected = Array.from(new Set(variableData.filter(v => 
        v.part === selectedPart && 
        v.section === selectedSection && 
        v.group === selectedGroup
      ).map(v => v.variable).filter(Boolean))).sort();
      const savedOrder = savedVariableOrders[key];
      const currentOrder = workingVariableOrders[key];
      
      if (!currentOrder) {
        if (savedOrder && savedOrder.length > 0) {
          // Start with saved order, add any new variables that aren't in saved order
          const newVariables = variablesForSelected.filter(v => !savedOrder.includes(v));
          setWorkingVariableOrders(prev => ({ ...prev, [key]: [...savedOrder, ...newVariables] }));
        } else {
          setWorkingVariableOrders(prev => ({ ...prev, [key]: variablesForSelected }));
        }
      } else {
        // Update existing order to include any new variables
        const newVariables = variablesForSelected.filter(v => !currentOrder.includes(v));
        if (newVariables.length > 0) {
          setWorkingVariableOrders(prev => ({ ...prev, [key]: [...currentOrder, ...newVariables] }));
        }
      }
    }
  }, [selectedPart, selectedSection, selectedGroup, variableData, savedVariableOrders, workingVariableOrders]);

  // Initialize working order for avatars when a being is selected
  useEffect(() => {
    if (selectedBeing && !workingAvatarOrders[selectedBeing]) {
      const avatarsForSelectedBeing = Array.from(new Set(objectData.filter(o => o.being === selectedBeing).map(o => o.avatar).filter(Boolean))).sort();
      const savedOrder = savedAvatarOrders[selectedBeing];
      if (savedOrder && savedOrder.length > 0) {
        setWorkingAvatarOrders(prev => ({ ...prev, [selectedBeing]: [...savedOrder] }));
      } else {
        setWorkingAvatarOrders(prev => ({ ...prev, [selectedBeing]: avatarsForSelectedBeing }));
      }
    }
  }, [selectedBeing, objectData, savedAvatarOrders, workingAvatarOrders]);

  // Initialize working order for objects when being+avatar are selected
  useEffect(() => {
    if (selectedBeing && selectedAvatar) {
      const key = `${selectedBeing}|${selectedAvatar}`;
      if (!workingObjectOrders[key]) {
        const objectsForSelected = Array.from(new Set(objectData.filter(o => o.being === selectedBeing && o.avatar === selectedAvatar).map(o => o.object).filter(Boolean))).sort();
        const savedOrder = savedObjectOrders[key];
        if (savedOrder && savedOrder.length > 0) {
          setWorkingObjectOrders(prev => ({ ...prev, [key]: [...savedOrder] }));
        } else {
          setWorkingObjectOrders(prev => ({ ...prev, [key]: objectsForSelected }));
        }
      }
    }
  }, [selectedBeing, selectedAvatar, objectData, savedObjectOrders, workingObjectOrders]);


  const handleDragStart = (item: string, type: 'part' | 'section' | 'group' | 'variable' | 'being' | 'avatar' | 'object') => {
    setDraggedItem(item);
    setDragType(type);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number, type: 'part' | 'section' | 'group' | 'variable' | 'being' | 'avatar' | 'object') => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || dragType !== type) {
      setDraggedItem(null);
      setDragType(null);
      setDragOverIndex(-1);
      return;
    }

    if (type === 'being') {
      const newOrder = [...workingBeingOrder];
      const draggedIndex = newOrder.indexOf(draggedItem);
      if (draggedIndex === -1) {
        setDraggedItem(null);
        setDragType(null);
        setDragOverIndex(-1);
        return;
      }
      newOrder.splice(draggedIndex, 1);
      const insertIndex = draggedIndex < index ? index - 1 : index;
      newOrder.splice(insertIndex, 0, draggedItem);
      setWorkingBeingOrder(newOrder);
    } else if (type === 'avatar' && selectedBeing) {
      const currentAvatars = workingAvatarOrders[selectedBeing] || savedAvatarOrders[selectedBeing] || avatarsForBeing;
      const newOrder = [...currentAvatars];
      const draggedIndex = newOrder.indexOf(draggedItem);
      if (draggedIndex === -1) {
        setDraggedItem(null);
        setDragType(null);
        setDragOverIndex(-1);
        return;
      }
      newOrder.splice(draggedIndex, 1);
      const insertIndex = draggedIndex < index ? index - 1 : index;
      newOrder.splice(insertIndex, 0, draggedItem);
      setWorkingAvatarOrders({ ...workingAvatarOrders, [selectedBeing]: newOrder });
    } else if (type === 'object' && selectedBeing && selectedAvatar) {
      const key = `${selectedBeing}|${selectedAvatar}`;
      const currentObjects = workingObjectOrders[key] || savedObjectOrders[key] || objectsForBeingAndAvatar;
      const newOrder = [...currentObjects];
      const draggedIndex = newOrder.indexOf(draggedItem);
      if (draggedIndex === -1) {
        setDraggedItem(null);
        setDragType(null);
        setDragOverIndex(-1);
        return;
      }
      newOrder.splice(draggedIndex, 1);
      const insertIndex = draggedIndex < index ? index - 1 : index;
      newOrder.splice(insertIndex, 0, draggedItem);
      setWorkingObjectOrders({ ...workingObjectOrders, [key]: newOrder });

    } else if (type === 'part') {
      const newOrder = [...workingPartOrder];
      const draggedIndex = newOrder.indexOf(draggedItem);
      if (draggedIndex === -1) {
        setDraggedItem(null);
        setDragType(null);
        setDragOverIndex(-1);
        return;
      }
      // Remove from old position
      newOrder.splice(draggedIndex, 1);
      // Insert at new position (adjust index if dragging down)
      const insertIndex = draggedIndex < index ? index - 1 : index;
      newOrder.splice(insertIndex, 0, draggedItem);
      setWorkingPartOrder(newOrder);
    } else if (type === 'section' && selectedPart) {
      const currentSections = workingSectionOrders[selectedPart] || savedSectionOrders[selectedPart] || sectionsForPart;
      const newOrder = [...currentSections];
      const draggedIndex = newOrder.indexOf(draggedItem);
      if (draggedIndex === -1) {
        setDraggedItem(null);
        setDragType(null);
        setDragOverIndex(-1);
        return;
      }
      newOrder.splice(draggedIndex, 1);
      const insertIndex = draggedIndex < index ? index - 1 : index;
      newOrder.splice(insertIndex, 0, draggedItem);
      setWorkingSectionOrders({ ...workingSectionOrders, [selectedPart]: newOrder });
    } else if (type === 'group' && selectedPart && selectedSection) {
      const key = `${selectedPart}|${selectedSection}`;
      const currentGroups = workingGroupOrders[key] || savedGroupOrders[key] || groupsForPartAndSection;
      const newOrder = [...currentGroups];
      const draggedIndex = newOrder.indexOf(draggedItem);
      if (draggedIndex === -1) {
        setDraggedItem(null);
        setDragType(null);
        setDragOverIndex(-1);
        return;
      }
      newOrder.splice(draggedIndex, 1);
      const insertIndex = draggedIndex < index ? index - 1 : index;
      newOrder.splice(insertIndex, 0, draggedItem);
      setWorkingGroupOrders({ ...workingGroupOrders, [key]: newOrder });
    } else if (type === 'variable' && selectedPart && selectedSection && selectedGroup) {
      const key = `${selectedPart}|${selectedSection}|${selectedGroup}`;
      const currentVariables = workingVariableOrders[key] || savedVariableOrders[key] || variablesForPartSectionAndGroup;
      const newOrder = [...currentVariables];
      const draggedIndex = newOrder.indexOf(draggedItem);
      if (draggedIndex === -1) {
        setDraggedItem(null);
        setDragType(null);
        setDragOverIndex(-1);
        return;
      }
      newOrder.splice(draggedIndex, 1);
      const insertIndex = draggedIndex < index ? index - 1 : index;
      newOrder.splice(insertIndex, 0, draggedItem);
      setWorkingVariableOrders({ ...workingVariableOrders, [key]: newOrder });
    }

    setDraggedItem(null);
    setDragType(null);
    setDragOverIndex(-1);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragType(null);
    setDragOverIndex(-1);
  };

  const handleSaveChanges = () => {
    // Save all current working orders (including any changes made when switching between parts/sections/groups)
    // This captures all changes across all parts, sections, and groups
    const order: OrderSortOrder = {
      partOrder: workingPartOrder,
      sectionOrders: workingSectionOrders,
      groupOrders: workingGroupOrders,
      variableOrders: workingVariableOrders,
      beingOrder: workingBeingOrder,
      avatarOrders: workingAvatarOrders,
      objectOrders: workingObjectOrders,
      sectorOrder: [],
      domainOrder: [],
      countryOrder: [],
    };
    
    // Update saved orders to match working orders
    setSavedPartOrder([...workingPartOrder]);
    setSavedSectionOrders({ ...workingSectionOrders });
    setSavedGroupOrders({ ...workingGroupOrders });
    setSavedVariableOrders({ ...workingVariableOrders });
    setSavedBeingOrder([...workingBeingOrder]);
    setSavedAvatarOrders({ ...workingAvatarOrders });
    setSavedObjectOrders({ ...workingObjectOrders });
    
    // Save to parent (which will persist to localStorage)
    onSaveOrder(order);
    // Close modal after saving
    onClose();
  };

  const getGroupPosition = (part: string, section: string, group: string): number => {
    const key = `${part}|${section}`;
    const order = workingGroupOrders[key] || groupsForPartAndSection;
    const index = order.indexOf(group);
    return index === -1 ? order.length : index;
  };

  const getVariablePosition = (part: string, section: string, group: string, variable: string): number => {
    const key = `${part}|${section}|${group}`;
    const order = workingVariableOrders[key] || variablesForPartSectionAndGroup;
    const index = order.indexOf(variable);
    return index === -1 ? order.length : index;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
      <div 
        ref={modalRef}
        className={`bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6 transition-all duration-300 flex flex-col ${
          isExpanded 
            ? 'w-[95vw] h-[95vh]' 
            : 'max-w-[120rem] w-full mx-4 max-h-[90vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-ag-dark-text">Order</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
              title={isExpanded ? "Minimize" : "Maximize"}
            >
              {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>


        {/* Seven columns: Being, Avatar, Object, Part, Section, Group, Variable (S/D/C are not on the Source LDM grid). */}
        <div className={`grid grid-cols-7 gap-4 mb-6 ${isExpanded ? 'flex-1 min-h-0 overflow-hidden' : ''}`}>
          {/* Being Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">Being</h4>
            <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
              {workingBeingOrder.map((being, index) => (
                <div
                  key={being}
                  draggable
                  onDragStart={() => handleDragStart(being, 'being')}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index, 'being')}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => {
                    if (draggedItem === null) {
                      e.stopPropagation();
                      if (selectedBeing === being) {
                        setSelectedBeing('');
                        setSelectedAvatar('');
                      } else {
                        setSelectedBeing(being);
                        setSelectedAvatar('');
                      }
                    }
                  }}
                  className={`flex items-center gap-2 p-2 rounded text-sm cursor-pointer transition-colors ${
                    selectedBeing === being
                      ? 'bg-ag-dark-accent bg-opacity-30 border-2 border-ag-dark-accent'
                      : draggedItem === being && dragType === 'being'
                      ? 'bg-ag-dark-accent bg-opacity-20'
                      : dragOverIndex === index && dragType === 'being'
                      ? 'bg-ag-dark-accent bg-opacity-10'
                      : 'hover:bg-ag-dark-surface'
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                  <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                  <span className="text-ag-dark-text flex-1 truncate">{being}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Avatar Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">Avatar</h4>
            {selectedBeing ? (
              <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
                {(workingAvatarOrders[selectedBeing] || savedAvatarOrders[selectedBeing] || avatarsForBeing).map((avatar, index) => (
                  <div
                    key={avatar}
                    draggable
                  onDragStart={() => handleDragStart(avatar, 'avatar')}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index, 'avatar')}
                  onDragEnd={handleDragEnd}
                    onClick={(e) => {
                      if (draggedItem === null) {
                        e.stopPropagation();
                        if (selectedAvatar === avatar) {
                          setSelectedAvatar('');
                        } else {
                          setSelectedAvatar(avatar);
                        }
                      }
                    }}
                    className={`flex items-center gap-2 p-2 rounded text-sm cursor-pointer transition-colors ${
                      selectedAvatar === avatar
                        ? 'bg-ag-dark-accent bg-opacity-30 border-2 border-ag-dark-accent'
                        : draggedItem === avatar && dragType === 'avatar'
                        ? 'bg-ag-dark-accent bg-opacity-20'
                        : dragOverIndex === index && dragType === 'avatar'
                        ? 'bg-ag-dark-accent bg-opacity-10'
                        : 'hover:bg-ag-dark-surface'
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                    <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                    <span className="text-ag-dark-text flex-1 truncate">{avatar}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-ag-dark-text-secondary text-sm">
                Click a Being to see Avatars
              </div>
            )}
          </div>

          {/* Object Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">Object</h4>
            {selectedBeing && selectedAvatar ? (
              <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
                {(workingObjectOrders[`${selectedBeing}|${selectedAvatar}`] || savedObjectOrders[`${selectedBeing}|${selectedAvatar}`] || objectsForBeingAndAvatar).map((object, index) => (
                  <div
                    key={object}
                    draggable
                    onDragStart={() => handleDragStart(object, 'object')}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index, 'object')}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                      draggedItem === object && dragType === 'object'
                        ? 'bg-ag-dark-accent bg-opacity-20'
                        : dragOverIndex === index && dragType === 'object'
                        ? 'bg-ag-dark-accent bg-opacity-10'
                        : 'hover:bg-ag-dark-surface'
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                    <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                    <span className="text-ag-dark-text flex-1 truncate">{object}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-ag-dark-text-secondary text-sm">
                {!selectedBeing ? 'Click a Being to see Objects' : 'Click an Avatar to see Objects'}
              </div>
            )}
          </div>


          {/* Part Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">Part</h4>
            <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
              {workingPartOrder.map((part, index) => (
                <div
                  key={part}
                  draggable
                  onDragStart={() => handleDragStart(part, 'part')}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index, 'part')}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => {
                    // Only handle click if not dragging
                    if (draggedItem === null) {
                      e.stopPropagation();
                      if (selectedPart === part) {
                        // Deselect if clicking the same item
                        setSelectedPart('');
                        setSelectedSection('');
                        setSelectedGroup('');
                      } else {
                        // Select this part and reset dependent selections
                        setSelectedPart(part);
                        setSelectedSection('');
                        setSelectedGroup('');
                      }
                    }
                  }}
                  className={`flex items-center gap-2 p-2 rounded text-sm cursor-pointer transition-colors ${
                    selectedPart === part
                      ? 'bg-ag-dark-accent bg-opacity-30 border-2 border-ag-dark-accent'
                      : draggedItem === part && dragType === 'part'
                      ? 'bg-ag-dark-accent bg-opacity-20'
                      : dragOverIndex === index && dragType === 'part'
                      ? 'bg-ag-dark-accent bg-opacity-10'
                      : 'hover:bg-ag-dark-surface'
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                  <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                  <span className="text-ag-dark-text flex-1 truncate">{part}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">Section</h4>
            {selectedPart ? (
              <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
                {(workingSectionOrders[selectedPart] || savedSectionOrders[selectedPart] || sectionsForPart).map((section, index) => (
                  <div
                    key={section}
                    draggable
                    onDragStart={() => handleDragStart(section, 'section')}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index, 'section')}
                    onDragEnd={handleDragEnd}
                    onClick={(e) => {
                      // Only handle click if not dragging
                      if (draggedItem === null) {
                        e.stopPropagation();
                        if (selectedSection === section) {
                          // Deselect if clicking the same item
                          setSelectedSection('');
                          setSelectedGroup('');
                        } else {
                          // Select this section and reset dependent selections
                          setSelectedSection(section);
                          setSelectedGroup('');
                        }
                      }
                    }}
                    className={`flex items-center gap-2 p-2 rounded text-sm cursor-pointer transition-colors ${
                      selectedSection === section
                        ? 'bg-ag-dark-accent bg-opacity-30 border-2 border-ag-dark-accent'
                        : draggedItem === section && dragType === 'section'
                        ? 'bg-ag-dark-accent bg-opacity-20'
                        : dragOverIndex === index && dragType === 'section'
                        ? 'bg-ag-dark-accent bg-opacity-10'
                        : 'hover:bg-ag-dark-surface'
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                    <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                    <span className="text-ag-dark-text flex-1 truncate">{section}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-ag-dark-text-secondary text-sm">
                Click a Part to see Sections
              </div>
            )}
          </div>

          {/* Group Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">Group</h4>
            {selectedPart && selectedSection ? (
              <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
                {(workingGroupOrders[`${selectedPart}|${selectedSection}`] || savedGroupOrders[`${selectedPart}|${selectedSection}`] || groupsForPartAndSection).map((group, index) => (
                  <div
                    key={group}
                    draggable
                    onDragStart={() => handleDragStart(group, 'group')}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index, 'group')}
                    onDragEnd={handleDragEnd}
                    onClick={(e) => {
                      // Only handle click if not dragging
                      if (draggedItem === null) {
                        e.stopPropagation();
                        if (selectedGroup === group) {
                          // Deselect if clicking the same item
                          setSelectedGroup('');
                        } else {
                          // Select this group
                          setSelectedGroup(group);
                        }
                      }
                    }}
                    className={`flex items-center gap-2 p-2 rounded text-sm cursor-pointer transition-colors ${
                      selectedGroup === group
                        ? 'bg-ag-dark-accent bg-opacity-30 border-2 border-ag-dark-accent'
                        : draggedItem === group && dragType === 'group'
                        ? 'bg-ag-dark-accent bg-opacity-20'
                        : dragOverIndex === index && dragType === 'group'
                        ? 'bg-ag-dark-accent bg-opacity-10'
                        : 'hover:bg-ag-dark-surface'
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                    <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                    <span className="text-ag-dark-text flex-1 truncate">{group}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-ag-dark-text-secondary text-sm">
                {!selectedPart ? 'Click a Part to see Groups' : 'Click a Section to see Groups'}
              </div>
            )}
          </div>

          {/* Variable Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-ag-dark-text">Variable</h4>
              {selectedPart && selectedSection && selectedGroup && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const key = `${selectedPart}|${selectedSection}|${selectedGroup}`;
                      const currentVariables = workingVariableOrders[key] || savedVariableOrders[key] || variablesForPartSectionAndGroup;
                      // Sort A-Z (ascending)
                      const sortedAZ = [...currentVariables].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
                      setWorkingVariableOrders({ ...workingVariableOrders, [key]: sortedAZ });
                    }}
                    className="p-1 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors"
                    title="Sort A-Z"
                  >
                    <ArrowUpAZ className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      const key = `${selectedPart}|${selectedSection}|${selectedGroup}`;
                      const currentVariables = workingVariableOrders[key] || savedVariableOrders[key] || variablesForPartSectionAndGroup;
                      // Sort Z-A (descending)
                      const sortedZA = [...currentVariables].sort((a, b) => b.localeCompare(a, undefined, { sensitivity: 'base' }));
                      setWorkingVariableOrders({ ...workingVariableOrders, [key]: sortedZA });
                    }}
                    className="p-1 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors"
                    title="Sort Z-A"
                  >
                    <ArrowDownZA className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            {selectedPart && selectedSection && selectedGroup ? (
              <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
                {(workingVariableOrders[`${selectedPart}|${selectedSection}|${selectedGroup}`] || savedVariableOrders[`${selectedPart}|${selectedSection}|${selectedGroup}`] || variablesForPartSectionAndGroup).map((variable, index) => (
                  <div
                    key={variable}
                    draggable
                    onDragStart={() => handleDragStart(variable, 'variable')}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index, 'variable')}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                      draggedItem === variable && dragType === 'variable'
                        ? 'bg-ag-dark-accent bg-opacity-20'
                        : dragOverIndex === index && dragType === 'variable'
                        ? 'bg-ag-dark-accent bg-opacity-10'
                        : 'hover:bg-ag-dark-surface'
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                    <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                    <span className="text-ag-dark-text flex-1 truncate">{variable}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-ag-dark-text-secondary text-sm">
                {!selectedPart ? 'Click a Part to see Variables' : !selectedSection ? 'Click a Section to see Variables' : 'Click a Group to see Variables'}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-4 border-t border-ag-dark-border flex-shrink-0">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveChanges}
              className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
