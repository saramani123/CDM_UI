import React, { useState, useEffect, useRef } from 'react';
import { X, GripVertical, Maximize2, Minimize2 } from 'lucide-react';
import type { ObjectData } from '../data/mockData';

interface OrderSortOrder {
  beingOrder: string[];
  avatarOrders: Record<string, string[]>; // key: being, value: array of avatars
  objectOrders: Record<string, string[]>; // key: "being|avatar", value: array of objects
  sectorOrder?: string[]; // Independent S column order
  domainOrder?: string[]; // Independent D column order
  countryOrder?: string[]; // Independent C column order
}

interface ObjectsOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveOrder: (order: OrderSortOrder) => void;
  objectData: ObjectData[];
  orderSortOrder?: OrderSortOrder;
}

export const ObjectsOrderModal: React.FC<ObjectsOrderModalProps> = ({
  isOpen,
  onClose,
  onSaveOrder,
  objectData,
  orderSortOrder
}) => {
  const [workingBeingOrder, setWorkingBeingOrder] = useState<string[]>([]);
  const [workingAvatarOrders, setWorkingAvatarOrders] = useState<Record<string, string[]>>({});
  const [workingObjectOrders, setWorkingObjectOrders] = useState<Record<string, string[]>>({});
  const [workingSectorOrder, setWorkingSectorOrder] = useState<string[]>([]);
  const [workingDomainOrder, setWorkingDomainOrder] = useState<string[]>([]);
  const [workingCountryOrder, setWorkingCountryOrder] = useState<string[]>([]);
  // Click-based selections (cascading filters)
  const [selectedBeing, setSelectedBeing] = useState<string>('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'being' | 'avatar' | 'object' | 'sector' | 'domain' | 'country' | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number>(-1);
  const [savedBeingOrder, setSavedBeingOrder] = useState<string[]>([]);
  const [savedAvatarOrders, setSavedAvatarOrders] = useState<Record<string, string[]>>({});
  const [savedObjectOrders, setSavedObjectOrders] = useState<Record<string, string[]>>({});
  const [savedSectorOrder, setSavedSectorOrder] = useState<string[]>([]);
  const [savedDomainOrder, setSavedDomainOrder] = useState<string[]>([]);
  const [savedCountryOrder, setSavedCountryOrder] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  

  // Get distinct values
  const distinctBeings = Array.from(new Set(objectData.map(o => o.being).filter(Boolean))).sort();
  const avatarsForBeing = selectedBeing
    ? Array.from(new Set(objectData.filter(o => o.being === selectedBeing).map(o => o.avatar).filter(Boolean))).sort()
    : [];
  const objectsForBeingAndAvatar = selectedBeing && selectedAvatar
    ? Array.from(new Set(objectData.filter(o => o.being === selectedBeing && o.avatar === selectedAvatar).map(o => o.object).filter(Boolean))).sort()
    : [];
  
  // Get S, D, C values from grid data (including "ALL" and multiple values like "Finance, Healthcare")
  // Extract unique values exactly as they appear in the grid
  const distinctSectors = Array.from(new Set(objectData.map(o => String(o.sector || '').trim()).filter(Boolean))).sort();
  const distinctDomains = Array.from(new Set(objectData.map(o => String(o.domain || '').trim()).filter(Boolean))).sort();
  const distinctCountries = Array.from(new Set(objectData.map(o => String(o.country || '').trim()).filter(Boolean))).sort();

  // Initialize working orders from props or create defaults - only once when modal opens
  // CRITICAL: Order should NEVER change unless user explicitly modifies it via drag-and-drop
  // New items should be appended to the end, edits should stay in place, deletes should remove without affecting others
  useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false);
      return;
    }
    
    if (!isInitialized) {
      if (orderSortOrder) {
        // Preserve saved being order, append new beings
        const savedBeingOrder = orderSortOrder.beingOrder && orderSortOrder.beingOrder.length > 0 
          ? [...orderSortOrder.beingOrder] 
          : [];
        const validSavedBeings = savedBeingOrder.filter(being => distinctBeings.includes(being));
        const newBeings = distinctBeings.filter(being => !savedBeingOrder.includes(being));
        const beingOrder = [...validSavedBeings, ...newBeings];
        
        // Preserve saved avatar orders, append new avatars
        const avatarOrders: Record<string, string[]> = {};
        const savedAvatarOrders = orderSortOrder.avatarOrders || {};
        distinctBeings.forEach(being => {
          const avatarsForBeing = Array.from(new Set(objectData.filter(o => o.being === being).map(o => o.avatar).filter(Boolean))).sort();
          const savedAvatarOrder = savedAvatarOrders[being] || [];
          const validSavedAvatars = savedAvatarOrder.filter(avatar => avatarsForBeing.includes(avatar));
          const newAvatars = avatarsForBeing.filter(avatar => !savedAvatarOrder.includes(avatar));
          avatarOrders[being] = [...validSavedAvatars, ...newAvatars];
        });
        
        // Preserve saved object orders, append new objects
        const objectOrders: Record<string, string[]> = {};
        const savedObjectOrders = orderSortOrder.objectOrders || {};
        distinctBeings.forEach(being => {
          const avatarsForBeing = Array.from(new Set(objectData.filter(o => o.being === being).map(o => o.avatar).filter(Boolean))).sort();
          avatarsForBeing.forEach(avatar => {
            const key = `${being}|${avatar}`;
            const objectsForBeingAvatar = Array.from(new Set(objectData.filter(o => o.being === being && o.avatar === avatar).map(o => o.object).filter(Boolean))).sort();
            const savedObjectOrder = savedObjectOrders[key] || [];
            const validSavedObjects = savedObjectOrder.filter(obj => objectsForBeingAvatar.includes(obj));
            const newObjects = objectsForBeingAvatar.filter(obj => !savedObjectOrder.includes(obj));
            objectOrders[key] = [...validSavedObjects, ...newObjects];
          });
        });
        
        setWorkingBeingOrder(beingOrder);
        setSavedBeingOrder(beingOrder);
        setWorkingAvatarOrders(avatarOrders);
        setSavedAvatarOrders(avatarOrders);
        setWorkingObjectOrders(objectOrders);
        setSavedObjectOrders(objectOrders);
        
        // Handle S, D, C orders - preserve existing order, append new values from grid data
        // Use values exactly as they appear in the grid (including "ALL" and multiple values)
        const currentDistinctSectors = Array.from(new Set(objectData.map(o => String(o.sector || '').trim()).filter(Boolean))).sort();
        const currentDistinctDomains = Array.from(new Set(objectData.map(o => String(o.domain || '').trim()).filter(Boolean))).sort();
        const currentDistinctCountries = Array.from(new Set(objectData.map(o => String(o.country || '').trim()).filter(Boolean))).sort();
        
        // Sector order
        const savedSectorOrder = orderSortOrder.sectorOrder && orderSortOrder.sectorOrder.length > 0 
          ? [...orderSortOrder.sectorOrder] 
          : [];
        const validSavedSectors = savedSectorOrder.filter(sector => currentDistinctSectors.includes(sector));
        const newSectors = currentDistinctSectors.filter(sector => !savedSectorOrder.includes(sector));
        const sectorOrder = [...validSavedSectors, ...newSectors];
        
        // Domain order
        const savedDomainOrder = orderSortOrder.domainOrder && orderSortOrder.domainOrder.length > 0 
          ? [...orderSortOrder.domainOrder] 
          : [];
        const validSavedDomains = savedDomainOrder.filter(domain => currentDistinctDomains.includes(domain));
        const newDomains = currentDistinctDomains.filter(domain => !savedDomainOrder.includes(domain));
        const domainOrder = [...validSavedDomains, ...newDomains];
        
        // Country order
        const savedCountryOrder = orderSortOrder.countryOrder && orderSortOrder.countryOrder.length > 0 
          ? [...orderSortOrder.countryOrder] 
          : [];
        const validSavedCountries = savedCountryOrder.filter(country => currentDistinctCountries.includes(country));
        const newCountries = currentDistinctCountries.filter(country => !savedCountryOrder.includes(country));
        const countryOrder = [...validSavedCountries, ...newCountries];
        
        setWorkingSectorOrder(sectorOrder);
        setSavedSectorOrder(sectorOrder);
        setWorkingDomainOrder(domainOrder);
        setSavedDomainOrder(domainOrder);
        setWorkingCountryOrder(countryOrder);
        setSavedCountryOrder(countryOrder);
      } else {
        // Create default alphabetical orders (only if no saved order exists)
        setWorkingBeingOrder(distinctBeings);
        setSavedBeingOrder(distinctBeings);
        setWorkingAvatarOrders({});
        setSavedAvatarOrders({});
        setWorkingObjectOrders({});
        setSavedObjectOrders({});
        
        // Initialize S, D, C with values from grid data (including "ALL" and multiple values)
        setWorkingSectorOrder(distinctSectors);
        setSavedSectorOrder(distinctSectors);
        setWorkingDomainOrder(distinctDomains);
        setSavedDomainOrder(distinctDomains);
        setWorkingCountryOrder(distinctCountries);
        setSavedCountryOrder(distinctCountries);
      }
      setIsInitialized(true);
    }
  }, [isOpen, orderSortOrder, isInitialized, objectData, distinctSectors, distinctDomains, distinctCountries]);

  // Initialize working order for a being when it's selected (if not already in working orders)
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

  // Initialize working order for objects when being+avatar are selected (from column clicks)
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

  const handleDragStart = (item: string, type: 'being' | 'avatar' | 'object' | 'sector' | 'domain' | 'country') => {
    setDraggedItem(item);
    setDragType(type);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number, type: 'being' | 'avatar' | 'object' | 'sector' | 'domain' | 'country') => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || dragType !== type) {
      setDraggedItem(null);
      setDragType(null);
      setDragOverIndex(-1);
      return;
    }

    if (type === 'sector') {
      const newOrder = [...workingSectorOrder];
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
      setWorkingSectorOrder(newOrder);
    } else if (type === 'domain') {
      const newOrder = [...workingDomainOrder];
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
      setWorkingDomainOrder(newOrder);
    } else if (type === 'country') {
      const newOrder = [...workingCountryOrder];
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
      setWorkingCountryOrder(newOrder);
    } else if (type === 'being') {
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
    // Save all current working orders (including any changes made when switching between beings/avatars)
    const order: OrderSortOrder = {
      beingOrder: workingBeingOrder,
      avatarOrders: workingAvatarOrders,
      objectOrders: workingObjectOrders,
      sectorOrder: workingSectorOrder,
      domainOrder: workingDomainOrder,
      countryOrder: workingCountryOrder
    };
    
    // Update saved orders to match working orders
    setSavedBeingOrder([...workingBeingOrder]);
    setSavedAvatarOrders({ ...workingAvatarOrders });
    setSavedObjectOrders({ ...workingObjectOrders });
    setSavedSectorOrder([...workingSectorOrder]);
    setSavedDomainOrder([...workingDomainOrder]);
    setSavedCountryOrder([...workingCountryOrder]);
    
    // Save to parent (which will persist to localStorage)
    onSaveOrder(order);
    // Close modal after saving
    onClose();
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


        {/* Six Column Layout (S, D, C, Being, Avatar, Object) */}
        <div className={`grid grid-cols-6 gap-4 mb-6 ${isExpanded ? 'flex-1 min-h-0 overflow-hidden' : ''}`}>
          {/* Sector Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">S</h4>
            <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
              {workingSectorOrder.map((sector, index) => (
                <div
                  key={sector}
                  draggable
                  onDragStart={() => handleDragStart(sector, 'sector')}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index, 'sector')}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                    draggedItem === sector && dragType === 'sector'
                      ? 'bg-ag-dark-accent bg-opacity-20'
                      : dragOverIndex === index && dragType === 'sector'
                      ? 'bg-ag-dark-accent bg-opacity-10'
                      : 'hover:bg-ag-dark-surface'
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                  <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                  <span className="text-ag-dark-text flex-1 truncate">{sector}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Domain Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">D</h4>
            <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
              {workingDomainOrder.map((domain, index) => (
                <div
                  key={domain}
                  draggable
                  onDragStart={() => handleDragStart(domain, 'domain')}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index, 'domain')}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                    draggedItem === domain && dragType === 'domain'
                      ? 'bg-ag-dark-accent bg-opacity-20'
                      : dragOverIndex === index && dragType === 'domain'
                      ? 'bg-ag-dark-accent bg-opacity-10'
                      : 'hover:bg-ag-dark-surface'
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                  <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                  <span className="text-ag-dark-text flex-1 truncate">{domain}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Country Column */}
          <div className="p-4 bg-ag-dark-bg flex flex-col border-0 outline-none h-full">
            <h4 className="text-sm font-medium text-ag-dark-text mb-3">C</h4>
            <div className={`space-y-2 overflow-y-auto mb-3 flex-1 border-0 outline-none ${isExpanded ? 'min-h-0' : 'max-h-96'}`}>
              {workingCountryOrder.map((country, index) => (
                <div
                  key={country}
                  draggable
                  onDragStart={() => handleDragStart(country, 'country')}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index, 'country')}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 p-2 rounded text-sm cursor-move transition-colors ${
                    draggedItem === country && dragType === 'country'
                      ? 'bg-ag-dark-accent bg-opacity-20'
                      : dragOverIndex === index && dragType === 'country'
                      ? 'bg-ag-dark-accent bg-opacity-10'
                      : 'hover:bg-ag-dark-surface'
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-ag-dark-text-secondary flex-shrink-0" />
                  <span className="text-xs text-ag-dark-text-secondary w-6 flex-shrink-0">{index + 1}.</span>
                  <span className="text-ag-dark-text flex-1 truncate">{country}</span>
                </div>
              ))}
            </div>
          </div>

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
                    // Only handle click if not dragging
                    if (draggedItem === null) {
                      e.stopPropagation();
                      if (selectedBeing === being) {
                        // Deselect if clicking the same item
                        setSelectedBeing('');
                        setSelectedAvatar('');
                      } else {
                        // Select this being and reset dependent selections
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
                      // Only handle click if not dragging
                      if (draggedItem === null) {
                        e.stopPropagation();
                        if (selectedAvatar === avatar) {
                          // Deselect if clicking the same item
                          setSelectedAvatar('');
                        } else {
                          // Select this avatar
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

