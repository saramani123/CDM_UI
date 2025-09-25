import React from 'react';
import { Plus } from 'lucide-react';

interface DriversColumnProps {
  title: string;
  items: string[];
  onHeaderClick: () => void;
  onItemClick: (item: string) => void;
  selectedItem?: string;
  canAddNew: boolean;
}

export const DriversColumn: React.FC<DriversColumnProps> = ({
  title,
  items,
  onHeaderClick,
  onItemClick,
  selectedItem,
  canAddNew
}) => {
  return (
    <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border overflow-hidden">
      {/* Column Header */}
      <div 
        className="bg-ag-dark-bg border-b border-ag-dark-border p-3 cursor-pointer hover:bg-ag-dark-surface transition-colors flex items-center justify-between"
        onClick={onHeaderClick}
      >
        <h3 className="text-sm font-medium text-ag-dark-text">{title}</h3>
        {canAddNew && (
          <Plus className="w-4 h-4 text-ag-dark-text-secondary" />
        )}
      </div>

      {/* Column Items */}
      <div className="max-h-96 overflow-y-auto">
        {items.map((item, index) => (
          <div
            key={index}
            className={`p-2 border-b border-ag-dark-border last:border-b-0 cursor-pointer hover:bg-ag-dark-bg transition-colors ${
              selectedItem === item ? 'bg-ag-dark-accent bg-opacity-20 border-l-4 border-l-ag-dark-accent' : ''
            }`}
            onClick={() => onItemClick(item)}
          >
            <span className="text-sm text-ag-dark-text">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
};