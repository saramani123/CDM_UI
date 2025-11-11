import React, { useState } from 'react';
import { Settings, Save, X, Plus } from 'lucide-react';
import { ColumnType, columnLabels } from '../data/driversData';
import { 
  getDriverAbbreviation, 
  setDriverAbbreviation, 
  removeDriverAbbreviation,
  renameDriverAbbreviation 
} from '../utils/driverAbbreviations';

interface DriversMetadataPanelProps {
  title: string;
  selectedColumn?: ColumnType;
  selectedItem?: string;
  onSave?: (newValue: string) => void;
  onAddNew?: (newValue: string) => void;
  canAddNew: boolean;
}

export const DriversMetadataPanel: React.FC<DriversMetadataPanelProps> = ({
  title,
  selectedColumn,
  selectedItem,
  onSave,
  onAddNew,
  canAddNew
}) => {
  const [inputValue, setInputValue] = useState(selectedItem || '');
  const [abbreviationValue, setAbbreviationValue] = useState('');
  const [initialAbbreviationValue, setInitialAbbreviationValue] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Check if abbreviation field should be shown (only for sectors, domains, countries)
  const showAbbreviationField = selectedColumn && ['sectors', 'domains', 'countries'].includes(selectedColumn);

  React.useEffect(() => {
    setInputValue(selectedItem || '');
    setIsAddingNew(false);
    setErrorMessage('');
    
    // Load abbreviation if editing an existing item
    if (selectedItem && selectedColumn && showAbbreviationField) {
      const abbreviation = getDriverAbbreviation(selectedColumn, selectedItem);
      const abbrevValue = abbreviation || '';
      setAbbreviationValue(abbrevValue);
      setInitialAbbreviationValue(abbrevValue); // Store initial value for comparison
    } else {
      setAbbreviationValue('');
      setInitialAbbreviationValue('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem, selectedColumn]);

  const handleSave = () => {
    setErrorMessage('');
    
    // Validation: If abbreviation is provided, name must be provided
    if (abbreviationValue.trim() && !inputValue.trim()) {
      const columnLabel = selectedColumn ? columnLabels[selectedColumn] : 'Driver';
      setErrorMessage(`${columnLabel} name is required before adding an abbreviation.`);
      return;
    }
    
    if (inputValue.trim() && onSave) {
      const oldName = selectedItem || '';
      const newName = inputValue.trim();
      
      // Update abbreviation if name changed
      if (oldName && oldName !== newName && selectedColumn && showAbbreviationField) {
        // Rename the abbreviation mapping
        renameDriverAbbreviation(selectedColumn, oldName, newName);
      }
      
      // Save/update abbreviation if provided
      if (selectedColumn && showAbbreviationField) {
        if (abbreviationValue.trim()) {
          setDriverAbbreviation(selectedColumn, newName, abbreviationValue.trim());
        } else {
          // Remove abbreviation if cleared
          removeDriverAbbreviation(selectedColumn, newName);
        }
      }
      
      onSave(newName);
      
      // Update abbreviation value if it exists and sync initial value
      if (selectedColumn && showAbbreviationField) {
        const updatedAbbreviation = getDriverAbbreviation(selectedColumn, newName);
        const abbrevValue = updatedAbbreviation || '';
        setAbbreviationValue(abbrevValue);
        setInitialAbbreviationValue(abbrevValue); // Sync initial value after save
      }
    }
  };

  const handleAddNew = () => {
    setErrorMessage('');
    
    // Validation: If abbreviation is provided, name must be provided
    if (abbreviationValue.trim() && !inputValue.trim()) {
      const columnLabel = selectedColumn ? columnLabels[selectedColumn] : 'Driver';
      setErrorMessage(`${columnLabel} name is required before adding an abbreviation.`);
      return;
    }
    
    if (inputValue.trim() && onAddNew) {
      const newName = inputValue.trim();
      
      // Save abbreviation if provided
      if (selectedColumn && showAbbreviationField && abbreviationValue.trim()) {
        setDriverAbbreviation(selectedColumn, newName, abbreviationValue.trim());
      }
      
      onAddNew(newName);
      setInputValue('');
      setAbbreviationValue('');
      setIsAddingNew(false);
    }
  };

  const isHeaderSelected = selectedColumn && !selectedItem;
  const isItemSelected = selectedColumn && selectedItem;

  return (
    <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-ag-dark-text-secondary" />
          <h3 className="text-lg font-semibold text-ag-dark-text">{title}</h3>
        </div>
      </div>

      {/* Content */}
      {!selectedColumn ? (
        <div className="text-center py-8 text-ag-dark-text-secondary">
          <div className="text-sm">Click on a column header or item to edit</div>
        </div>
      ) : isHeaderSelected ? (
        // Column Header Selected - Add New Item
        <div className="space-y-4">
          <div className="text-sm text-ag-dark-text-secondary mb-4">
            Add a new {columnLabels[selectedColumn].toLowerCase()} to the list
          </div>
          
          {canAddNew ? (
            <>
              <div>
                <label className="block text-sm font-medium text-ag-dark-text mb-2">
                  New {columnLabels[selectedColumn]}
                </label>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder={`Enter new ${columnLabels[selectedColumn].toLowerCase()}...`}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                />
              </div>

              {showAbbreviationField && (
                <div>
                  <label className="block text-sm font-medium text-ag-dark-text mb-2">
                    Abbreviation
                  </label>
                  <input
                    type="text"
                    value={abbreviationValue}
                    onChange={(e) => {
                      setAbbreviationValue(e.target.value);
                      setErrorMessage('');
                    }}
                    placeholder={`Enter abbreviation (optional)...`}
                    className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                  />
                </div>
              )}

              {errorMessage && (
                <div className="text-sm text-red-400 bg-red-900 bg-opacity-20 border border-red-500 border-opacity-50 rounded p-2">
                  {errorMessage}
                </div>
              )}

              <button
                onClick={handleAddNew}
                disabled={!inputValue.trim()}
                className={`w-full py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 ${
                  inputValue.trim()
                    ? 'bg-ag-dark-accent text-white hover:bg-ag-dark-accent-hover'
                    : 'bg-ag-dark-text-secondary text-ag-dark-text-secondary cursor-not-allowed opacity-50'
                }`}
              >
                <Plus className="w-4 h-4" />
                Add {columnLabels[selectedColumn]}
              </button>
            </>
          ) : (
            <div className="text-center py-6 text-ag-dark-text-secondary">
              <div className="text-sm">Adding new {columnLabels[selectedColumn].toLowerCase()}s is disabled</div>
            </div>
          )}
        </div>
      ) : isItemSelected ? (
        // Item Selected - Edit Item
        <div className="space-y-4">
          <div className="text-sm text-ag-dark-text-secondary mb-4">
            Edit the selected {columnLabels[selectedColumn!].toLowerCase()}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              {columnLabels[selectedColumn!]} Name
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setErrorMessage('');
              }}
              placeholder={`Enter ${columnLabels[selectedColumn!].toLowerCase()} name...`}
              className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
            />
          </div>

          {showAbbreviationField && (
            <div>
              <label className="block text-sm font-medium text-ag-dark-text mb-2">
                Abbreviation
              </label>
              <input
                type="text"
                value={abbreviationValue}
                onChange={(e) => {
                  setAbbreviationValue(e.target.value);
                  setErrorMessage('');
                }}
                placeholder={`Enter abbreviation (optional)...`}
                className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
              />
            </div>
          )}

          {errorMessage && (
            <div className="text-sm text-red-400 bg-red-900 bg-opacity-20 border border-red-500 border-opacity-50 rounded p-2">
              {errorMessage}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={
              !inputValue.trim() || 
              (inputValue.trim() === (selectedItem || '').trim() && abbreviationValue.trim() === (initialAbbreviationValue || '').trim())
            }
            className={`w-full py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 ${
              inputValue.trim() && 
              (inputValue.trim() !== (selectedItem || '').trim() || abbreviationValue.trim() !== (initialAbbreviationValue || '').trim())
                ? 'bg-ag-dark-accent text-white hover:bg-ag-dark-accent-hover'
                : 'bg-ag-dark-text-secondary text-ag-dark-text-secondary cursor-not-allowed opacity-50'
            }`}
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      ) : null}
    </div>
  );
};