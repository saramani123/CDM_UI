import React, { useState, useEffect, useRef } from 'react';
import { X, GripVertical, Maximize2, Minimize2 } from 'lucide-react';
import type { VariableData } from '../data/variablesData';

interface OrderSortOrder {
  partOrder: string[];
  sectionOrders: Record<string, string[]>; // key: part, value: array of sections
  groupOrders: Record<string, string[]>; // key: "part|section", value: array of groups
  variableOrders: Record<string, string[]>; // key: "part|section|group", value: array of variables
}

interface VariablesOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveOrder: (order: OrderSortOrder) => void; // Changed: only saves order, doesn't enable/disable
  variableData: VariableData[];
  sortConfig?: any;
  orderSortOrder?: OrderSortOrder;
}

export const VariablesOrderModal: React.FC<VariablesOrderModalProps> = ({
  isOpen,
  onClose,
  onSaveOrder,
  variableData,
  orderSortOrder
}) => {
  const [workingPartOrder, setWorkingPartOrder] = useState<string[]>([]);
  const [workingSectionOrders, setWorkingSectionOrders] = useState<Record<string, string[]>>({});
  const [workingGroupOrders, setWorkingGroupOrders] = useState<Record<string, string[]>>({});
  const [workingVariableOrders, setWorkingVariableOrders] = useState<Record<string, string[]>>({});
  // Section column: needs Part dropdown
  const [selectedSectionPart, setSelectedSectionPart] = useState<string>('');
  // Group column: needs Part and Section dropdowns
  const [selectedPart, setSelectedPart] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  // Variable column: needs Part, Section, and Group dropdowns
  const [selectedVariablePart, setSelectedVariablePart] = useState<string>('');
  const [selectedVariableSection, setSelectedVariableSection] = useState<string>('');
  const [selectedVariableGroup, setSelectedVariableGroup] = useState<string>('');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'part' | 'section' | 'group' | 'variable' | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number>(-1);
  const [savedPartOrder, setSavedPartOrder] = useState<string[]>([]);
  const [savedSectionOrders, setSavedSectionOrders] = useState<Record<string, string[]>>({});
  const [savedGroupOrders, setSavedGroupOrders] = useState<Record<string, string[]>>({});
  const [savedVariableOrders, setSavedVariableOrders] = useState<Record<string, string[]>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Get distinct values - dynamically updated when variableData changes
  const distinctParts = Array.from(new Set(variableData.map(v => v.part).filter(Boolean))).sort();
  
  // Section values filtered by selected part
  const sectionsForPart = selectedSectionPart
    ? Array.from(new Set(variableData.filter(v => v.part === selectedSectionPart).map(v => v.section).filter(Boolean))).sort()
    : [];
  
  // Group values filtered by selected part and section
  const groupsForPartAndSection = selectedPart && selectedSection
    ? Array.from(new Set(variableData.filter(v => v.part === selectedPart && v.section === selectedSection).map(v => v.group).filter(Boolean))).sort()
    : [];
  
  // Variable values filtered by selected part, section, and group
  const variablesForPartSectionAndGroup = selectedVariablePart && selectedVariableSection && selectedVariableGroup
    ? Array.from(new Set(variableData.filter(v => 
        v.part === selectedVariablePart && 
        v.section === selectedVariableSection && 
        v.group === selectedVariableGroup
      ).map(v => v.variable).filter(Boolean))).sort()
    : [];

  // Initialize working orders from props or create defaults - only once when modal opens
  // Also re-initialize when variableData changes significantly (new parts/sections/groups added)
  useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false);
      return;
    }
    
    // Check if we need to update part order (new parts added)
    const currentDistinctParts = Array.from(new Set(variableData.map(v => v.part).filter(Boolean))).sort();
    const hasNewParts = currentDistinctParts.some(part => !distinctParts.includes(part));
    
    if (!isInitialized || hasNewParts) {
      if (orderSortOrder) {
        const partOrder = orderSortOrder.partOrder && orderSortOrder.partOrder.length > 0 
          ? [...orderSortOrder.partOrder] // Start with saved order
          : currentDistinctParts;
        
        // Add any new parts that aren't in the saved order
        currentDistinctParts.forEach(part => {
          if (!partOrder.includes(part)) {
            partOrder.push(part);
          }
        });
        
        // Handle migration from old format (sectionOrder: string[]) to new format (sectionOrders: Record<string, string[]>)
        let sectionOrders = orderSortOrder.sectionOrders || {};
        if (!orderSortOrder.sectionOrders && (orderSortOrder as any).sectionOrder) {
          // Migrate old flat sectionOrder to new structure - distribute across all parts
          const oldSectionOrder = (orderSortOrder as any).sectionOrder as string[];
          sectionOrders = {};
          currentDistinctParts.forEach(part => {
            const sectionsForThisPart = Array.from(new Set(variableData.filter(v => v.part === part).map(v => v.section).filter(Boolean))).sort();
            // Preserve order from old sectionOrder if sections exist in both
            const orderedSections = oldSectionOrder.filter(s => sectionsForThisPart.includes(s));
            const remainingSections = sectionsForThisPart.filter(s => !orderedSections.includes(s));
            sectionOrders[part] = [...orderedSections, ...remainingSections];
          });
        } else {
          // Update sectionOrders for new parts
          currentDistinctParts.forEach(part => {
            if (!sectionOrders[part]) {
              const sectionsForThisPart = Array.from(new Set(variableData.filter(v => v.part === part).map(v => v.section).filter(Boolean))).sort();
              sectionOrders[part] = sectionsForThisPart;
            }
          });
        }
        
        setWorkingPartOrder(partOrder);
        setWorkingSectionOrders(sectionOrders);
        setSavedPartOrder(partOrder);
        setSavedSectionOrders(sectionOrders);
        setWorkingGroupOrders(orderSortOrder.groupOrders || {});
        setSavedGroupOrders(orderSortOrder.groupOrders || {});
        setWorkingVariableOrders(orderSortOrder.variableOrders || {});
        setSavedVariableOrders(orderSortOrder.variableOrders || {});
      } else {
        // Create default alphabetical orders
        setWorkingPartOrder(currentDistinctParts);
        setWorkingSectionOrders({});
        setSavedPartOrder(currentDistinctParts);
        setSavedSectionOrders({});
        setWorkingGroupOrders({});
        setSavedGroupOrders({});
        setWorkingVariableOrders({});
        setSavedVariableOrders({});
      }
      setIsInitialized(true);
    }
  }, [isOpen, orderSortOrder, variableData, isInitialized]);

  // Initialize working order for sections when a part is selected in Section column
  useEffect(() => {
    if (selectedSectionPart) {
      const sectionsForSelectedPart = Array.from(new Set(variableData.filter(v => v.part === selectedSectionPart).map(v => v.section).filter(Boolean))).sort();
      const savedOrder = savedSectionOrders[selectedSectionPart];
      const currentOrder = workingSectionOrders[selectedSectionPart];
      
      // If no working order exists, create one
      if (!currentOrder) {
        if (savedOrder && savedOrder.length > 0) {
          // Start with saved order, add any new sections that aren't in saved order
          const newSections = sectionsForSelectedPart.filter(s => !savedOrder.includes(s));
          setWorkingSectionOrders(prev => ({ ...prev, [selectedSectionPart]: [...savedOrder, ...newSections] }));
        } else {
          setWorkingSectionOrders(prev => ({ ...prev, [selectedSectionPart]: sectionsForSelectedPart }));
        }
      } else {
        // Update existing order to include any new sections
        const newSections = sectionsForSelectedPart.filter(s => !currentOrder.includes(s));
        if (newSections.length > 0) {
          setWorkingSectionOrders(prev => ({ ...prev, [selectedSectionPart]: [...currentOrder, ...newSections] }));
        }
      }
    }
  }, [selectedSectionPart, variableData, savedSectionOrders, workingSectionOrders]);

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

  // Initialize working order for variables when part+section+group are selected in Variable column
  useEffect(() => {
    if (selectedVariablePart && selectedVariableSection && selectedVariableGroup) {
      const key = `${selectedVariablePart}|${selectedVariableSection}|${selectedVariableGroup}`;
      const variablesForSelected = Array.from(new Set(variableData.filter(v => 
        v.part === selectedVariablePart && 
        v.section === selectedVariableSection && 
        v.group === selectedVariableGroup
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
  }, [selectedVariablePart, selectedVariableSection, selectedVariableGroup, variableData, savedVariableOrders, workingVariableOrders]);

  const handleDragStart = (item: string, type: 'part' | 'section' | 'group' | 'variable') => {
    setDraggedItem(item);
    setDragType(type);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number, type: 'part' | 'section' | 'group' | 'variable') => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || dragType !== type) {
      setDraggedItem(null);
      setDragType(null);
      setDragOverIndex(-1);
      return;
    }

    if (type === 'part') {
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
    } else if (type === 'section' && selectedSectionPart) {
      const currentSections = workingSectionOrders[selectedSectionPart] || savedSectionOrders[selectedSectionPart] || sectionsForPart;
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
      setWorkingSectionOrders({ ...workingSectionOrders, [selectedSectionPart]: newOrder });
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
    } else if (type === 'variable' && selectedVariablePart && selectedVariableSection && selectedVariableGroup) {
      const key = `${selectedVariablePart}|${selectedVariableSection}|${selectedVariableGroup}`;
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
      variableOrders: workingVariableOrders
    };
    
    // Update saved orders to match working orders
    setSavedPartOrder([...workingPartOrder]);
    setSavedSectionOrders({ ...workingSectionOrders });
    setSavedGroupOrders({ ...workingGroupOrders });
    setSavedVariableOrders({ ...workingVariableOrders });
    
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
            : 'max-w-[90rem] w-full mx-4 max-h-[90vh]'
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

        {/* Instructions */}
        <div className="mb-6 p-4 bg-ag-dark-bg rounded-lg border border-ag-dark-border flex-shrink-0">
          <p className="text-sm text-ag-dark-text-secondary">
            Define the sort order for Part, Section, Group, and Variable columns. Drag items to reorder them.
            The order will be applied when enabled.
          </p>
        </div>

        {/* Four Column Layout */}
        <div className={`grid grid-cols-4 gap-4 mb-6 ${isExpanded ? 'flex-1 min-h-0 overflow-hidden' : ''}`}>
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
                  className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                    draggedItem === part && dragType === 'part'
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
            <div className="mb-3 flex-shrink-0">
              <select
                value={selectedSectionPart}
                onChange={(e) => {
                  setSelectedSectionPart(e.target.value);
                }}
                className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text"
              >
                <option value="">Select Part</option>
                {distinctParts.map(part => (
                  <option key={part} value={part}>{part}</option>
                ))}
              </select>
            </div>
            {selectedSectionPart && (
              <>
                <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
                  {(workingSectionOrders[selectedSectionPart] || savedSectionOrders[selectedSectionPart] || sectionsForPart).map((section, index) => (
                    <div
                      key={section}
                      draggable
                      onDragStart={() => handleDragStart(section, 'section')}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index, 'section')}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                        draggedItem === section && dragType === 'section'
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
              </>
            )}
          </div>

          {/* Group Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">Group</h4>
            <div className="mb-3 flex-shrink-0">
              <select
                value={selectedPart}
                onChange={(e) => {
                  setSelectedPart(e.target.value);
                  setSelectedSection(''); // Reset section when part changes
                }}
                className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text mb-2"
              >
                <option value="">Select Part</option>
                {distinctParts.map(part => (
                  <option key={part} value={part}>{part}</option>
                ))}
              </select>
              {selectedPart && (
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text"
                >
                  <option value="">Select Section</option>
                  {Array.from(new Set(variableData.filter(v => v.part === selectedPart).map(v => v.section).filter(Boolean))).sort().map(section => (
                    <option key={section} value={section}>{section}</option>
                  ))}
                </select>
              )}
            </div>
            {selectedPart && selectedSection && (
              <>
                <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
                  {(workingGroupOrders[`${selectedPart}|${selectedSection}`] || savedGroupOrders[`${selectedPart}|${selectedSection}`] || groupsForPartAndSection).map((group, index) => (
                    <div
                      key={group}
                      draggable
                      onDragStart={() => handleDragStart(group, 'group')}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index, 'group')}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                        draggedItem === group && dragType === 'group'
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
              </>
            )}
          </div>

          {/* Variable Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">Variable</h4>
            <div className="mb-3 flex-shrink-0">
              <select
                value={selectedVariablePart}
                onChange={(e) => {
                  const newPart = e.target.value;
                  setSelectedVariablePart(newPart);
                  setSelectedVariableSection(''); // Reset section when part changes
                  setSelectedVariableGroup(''); // Reset group when part changes
                }}
                className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text mb-2"
              >
                <option value="">Select Part</option>
                {distinctParts.map(part => (
                  <option key={part} value={part}>{part}</option>
                ))}
              </select>
              {selectedVariablePart && (
                <select
                  value={selectedVariableSection}
                  onChange={(e) => {
                    setSelectedVariableSection(e.target.value);
                    setSelectedVariableGroup(''); // Reset group when section changes
                  }}
                  className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text mb-2"
                >
                  <option value="">Select Section</option>
                  {Array.from(new Set(variableData.filter(v => v.part === selectedVariablePart).map(v => v.section).filter(Boolean))).sort().map(section => (
                    <option key={section} value={section}>{section}</option>
                  ))}
                </select>
              )}
              {selectedVariablePart && selectedVariableSection && (
                <select
                  value={selectedVariableGroup}
                  onChange={(e) => setSelectedVariableGroup(e.target.value)}
                  className="w-full px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text"
                >
                  <option value="">Select Group</option>
                  {Array.from(new Set(variableData.filter(v => v.part === selectedVariablePart && v.section === selectedVariableSection).map(v => v.group).filter(Boolean))).sort().map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              )}
            </div>
            {selectedVariablePart && selectedVariableSection && selectedVariableGroup && (
              <>
                <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
                  {(workingVariableOrders[`${selectedVariablePart}|${selectedVariableSection}|${selectedVariableGroup}`] || savedVariableOrders[`${selectedVariablePart}|${selectedVariableSection}|${selectedVariableGroup}`] || variablesForPartSectionAndGroup).map((variable, index) => (
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
              </>
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
