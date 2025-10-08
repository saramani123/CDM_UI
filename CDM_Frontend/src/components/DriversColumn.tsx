import React from 'react';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DriversColumnProps {
  title: string;
  items: string[];
  onHeaderClick: () => void;
  onItemClick: (item: string) => void;
  onReorder?: (newItems: string[]) => void;
  selectedItem?: string;
  canAddNew: boolean;
  onDeleteItem?: (item: string) => void;
}

interface SortableItemProps {
  item: string;
  index: number;
  onItemClick: (item: string) => void;
  selectedItem?: string;
  onDeleteItem?: (item: string) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ item, index, onItemClick, selectedItem, onDeleteItem }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteItem?.(item);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group p-2 border-b border-ag-dark-border last:border-b-0 cursor-pointer hover:bg-ag-dark-bg transition-colors flex items-center gap-2 ${
        selectedItem === item ? 'bg-ag-dark-accent bg-opacity-20 border-l-4 border-l-ag-dark-accent' : ''
      } ${isDragging ? 'opacity-50' : ''}`}
      onClick={() => onItemClick(item)}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab hover:cursor-grabbing text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <span className="text-sm text-ag-dark-text flex-1">{item}</span>
      {onDeleteItem && (
        <button
          onClick={handleDeleteClick}
          className="opacity-30 group-hover:opacity-100 hover:opacity-100 text-ag-dark-text-secondary hover:text-red-400 transition-all duration-200 p-1 rounded hover:bg-red-900/20"
          title="Delete driver"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export const DriversColumn: React.FC<DriversColumnProps> = ({
  title,
  items,
  onHeaderClick,
  onItemClick,
  onReorder,
  selectedItem,
  canAddNew,
  onDeleteItem
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);

      const newItems = arrayMove(items, oldIndex, newIndex);
      onReorder?.(newItems);
    }
  };
  return (
    <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border overflow-hidden flex flex-col h-full">
      {/* Column Header - Fixed at top */}
      <div 
        className="bg-ag-dark-bg border-b border-ag-dark-border p-3 cursor-pointer hover:bg-ag-dark-surface transition-colors flex items-center justify-between flex-shrink-0"
        onClick={onHeaderClick}
      >
        <h3 className="text-sm font-medium text-ag-dark-text">{title}</h3>
        {canAddNew && (
          <Plus className="w-4 h-4 text-ag-dark-text-secondary" />
        )}
      </div>

      {/* Column Items - Scrollable area that takes remaining height */}
      <div className="flex-1 overflow-y-auto bg-ag-dark-surface">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            {items.map((item, index) => (
              <SortableItem
                key={item}
                item={item}
                index={index}
                onItemClick={onItemClick}
                selectedItem={selectedItem}
                onDeleteItem={onDeleteItem}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};