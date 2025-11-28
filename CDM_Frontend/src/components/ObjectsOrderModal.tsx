import React, { useState, useEffect, useRef } from 'react';
import { X, GripVertical, Maximize2, Minimize2 } from 'lucide-react';
import type { ObjectData } from '../data/mockData';

interface OrderSortOrder {
  beingOrder: string[];
  avatarOrders: Record<string, string[]>; // key: being, value: array of avatars
  objectOrders: Record<string, string[]>; // key: "being|avatar", value: array of objects
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
  // Click-based selections (cascading filters)
  const [selectedBeing, setSelectedBeing] = useState<string>('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'being' | 'avatar' | 'object' | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number>(-1);
  const [savedBeingOrder, setSavedBeingOrder] = useState<string[]>([]);
  const [savedAvatarOrders, setSavedAvatarOrders] = useState<Record<string, string[]>>({});
  const [savedObjectOrders, setSavedObjectOrders] = useState<Record<string, string[]>>({});
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

  // Initialize working orders from props or create defaults - only once when modal opens
  useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false);
      return;
    }
    
    if (!isInitialized) {
      if (orderSortOrder) {
        const beingOrder = orderSortOrder.beingOrder && orderSortOrder.beingOrder.length > 0 ? orderSortOrder.beingOrder : distinctBeings;
        setWorkingBeingOrder(beingOrder);
        setSavedBeingOrder(beingOrder);
        setWorkingAvatarOrders(orderSortOrder.avatarOrders || {});
        setSavedAvatarOrders(orderSortOrder.avatarOrders || {});
        setWorkingObjectOrders(orderSortOrder.objectOrders || {});
        setSavedObjectOrders(orderSortOrder.objectOrders || {});
      } else {
        // Create default alphabetical orders
        setWorkingBeingOrder(distinctBeings);
        setSavedBeingOrder(distinctBeings);
        setWorkingAvatarOrders({});
        setSavedAvatarOrders({});
        setWorkingObjectOrders({});
        setSavedObjectOrders({});
      }
      setIsInitialized(true);
    }
  }, [isOpen, orderSortOrder, distinctBeings, isInitialized]);

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

  const handleDragStart = (item: string, type: 'being' | 'avatar' | 'object') => {
    setDraggedItem(item);
    setDragType(type);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number, type: 'being' | 'avatar' | 'object') => {
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
      objectOrders: workingObjectOrders
    };
    
    // Update saved orders to match working orders
    setSavedBeingOrder([...workingBeingOrder]);
    setSavedAvatarOrders({ ...workingAvatarOrders });
    setSavedObjectOrders({ ...workingObjectOrders });
    
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
            Define the sort order for Being, Avatar, and Object columns. Click on values to filter columns to the right. Drag items to reorder them. The order will be applied when enabled.
          </p>
        </div>

        {/* Three Column Layout */}
        <div className={`grid grid-cols-3 gap-4 mb-6 ${isExpanded ? 'flex-1 min-h-0 overflow-hidden' : ''}`}>
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

