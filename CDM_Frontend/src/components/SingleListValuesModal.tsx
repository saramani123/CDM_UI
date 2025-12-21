import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Save, Plus, Trash2, ArrowUpAZ, ArrowDownZA } from 'lucide-react';
import { ListData } from '../data/listsData';

interface SingleListValuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedList: ListData | null;
  initialVariations?: Record<string, string[]>; // Saved variations from parent component
  onSave: (values: string[], variations?: Record<string, string[]>) => void;
}

interface ListValueRow {
  id: string;
  value: string;
  variation: string; // Abbreviated version of the value
}

export const SingleListValuesModal: React.FC<SingleListValuesModalProps> = ({
  isOpen,
  onClose,
  selectedList,
  initialVariations,
  onSave
}) => {
  const [listValueRows, setListValueRows] = useState<ListValueRow[]>([]);
  const [isCsvUploadOpen, setIsCsvUploadOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{ rowId: string; isVariation?: boolean } | null>(null);
  const [editValue, setEditValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadListValues = () => {
    if (!selectedList) return;
    
    // Convert listValuesList from selectedList to rows
    const rows: ListValueRow[] = [];
    if (selectedList.listValuesList && selectedList.listValuesList.length > 0) {
      selectedList.listValuesList.forEach((lv: any) => {
        const value = lv.value || '';
        // Load variations for this value from initialVariations (saved locally)
        let variationText = '';
        if (initialVariations && initialVariations[value] && Array.isArray(initialVariations[value])) {
          variationText = initialVariations[value].join(', ');
        }
        
        rows.push({
          id: lv.id || `row-${Date.now()}-${rows.length}`,
          value: value,
          variation: variationText
        });
      });
    }
    
    // Always ensure we have at least 100 rows for Excel-like experience
    while (rows.length < 100) {
      rows.push({
        id: `row-${Date.now()}-${rows.length}`,
        value: '',
        variation: ''
      });
    }
    
    setListValueRows(rows);
  };

  // Load existing list values when modal opens or when variations are updated
  useEffect(() => {
    if (isOpen && selectedList) {
      loadListValues();
    } else if (!isOpen) {
      // Reset when modal closes
      setListValueRows([]);
      setEditingCell(null);
      setEditValue('');
    }
  }, [isOpen, selectedList?.id, selectedList?.listValuesList, initialVariations]);

  const handleAddRow = (index?: number) => {
    const newRow: ListValueRow = {
      id: Date.now().toString(),
      value: '',
      variation: ''
    };
    if (index !== undefined) {
      setListValueRows(prev => [...prev.slice(0, index), newRow, ...prev.slice(index)]);
    } else {
      setListValueRows(prev => [...prev, newRow]);
    }
  };

  const handleDeleteRow = (rowId: string) => {
    setListValueRows(prev => prev.filter(row => row.id !== rowId));
  };

  const handleCellClick = (rowId: string, currentValue: string, isVariation: boolean = false) => {
    setEditingCell({ rowId, isVariation });
    setEditValue(currentValue);
  };

  const handleCellChange = (value: string) => {
    setEditValue(value);
  };

  const handleCellBlur = () => {
    if (editingCell) {
      const currentEditValue = editValue; // Capture current value
      const currentEditingCell = editingCell; // Capture current cell info
      setListValueRows(prev => prev.map(row => 
        row.id === currentEditingCell.rowId 
          ? currentEditingCell.isVariation 
            ? { ...row, variation: currentEditValue }
            : { ...row, value: currentEditValue }
          : row
      ));
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, rowId: string, isVariation: boolean = false) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Save current cell first before moving
      if (editingCell) {
        setListValueRows(prev => prev.map(row => 
          row.id === editingCell.rowId 
            ? editingCell.isVariation 
              ? { ...row, variation: editValue }
              : { ...row, value: editValue }
            : row
        ));
      }
      // Move to next row
      const currentRowIndex = listValueRows.findIndex(r => r.id === rowId);
      if (currentRowIndex < listValueRows.length - 1) {
        const nextRow = listValueRows[currentRowIndex + 1];
        setEditingCell({ rowId: nextRow.id, isVariation });
        setEditValue(isVariation ? (nextRow.variation || '') : (nextRow.value || ''));
      } else {
        // Add new row if at the end
        handleAddRow();
        const newRowId = Date.now().toString();
        setEditingCell({ rowId: newRowId, isVariation });
        setEditValue('');
      }
    } else if (e.key === 'Escape') {
      // Save before canceling
      if (editingCell) {
        setListValueRows(prev => prev.map(row => 
          row.id === editingCell.rowId 
            ? editingCell.isVariation 
              ? { ...row, variation: editValue }
              : { ...row, value: editValue }
            : row
        ));
      }
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleCsvUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          alert('CSV must contain at least a header row and one data row');
          return;
        }

        // Parse header row - should match the list name
        const headerLine = lines[0];
        const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        
        // For single column, we expect just the list name as header
        const listName = selectedList?.list || '';
        if (headers.length !== 1 || (listName && headers[0] !== listName)) {
          alert(`CSV header should be: ${listName || 'List Name'}`);
          return;
        }

        // Parse data rows
        const newRows: ListValueRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          let currentValue = '';
          let inQuotes = false;
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              // Skip commas within quotes, but for single column we just take everything
              break;
            } else {
              currentValue += char;
            }
          }
          
          const trimmedValue = currentValue.trim().replace(/^"|"$/g, '');
          if (trimmedValue) {
            newRows.push({
              id: (Date.now() + i).toString(),
              value: trimmedValue
            });
          }
        }

        // Replace existing rows with new ones, but keep empty rows at the end
        const emptyRows = listValueRows.filter(row => !row.value.trim());
        setListValueRows([...newRows, ...emptyRows.slice(0, Math.max(0, 100 - newRows.length))]);
        setIsCsvUploadOpen(false);
        alert(`Successfully loaded ${newRows.length} values from CSV`);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        alert('Error parsing CSV file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const handleSave = () => {
    // Extract non-empty values
    const values = listValueRows
      .map(row => row.value.trim())
      .filter(value => value.length > 0);
    
    // Check for duplicates (case-insensitive)
    const uniqueValues = new Set(values.map(v => v.toLowerCase()));
    if (values.length !== uniqueValues.size) {
      const duplicateValues = values.filter((value, index) => 
        values.findIndex(v => v.toLowerCase() === value.toLowerCase()) !== index
      );
      alert(`Cannot save: Duplicate values found: ${duplicateValues.join(', ')}. Please remove duplicates before saving.`);
      return;
    }

    // Validate that variations only exist for rows with values
    const rowsWithVariationsButNoValue: number[] = [];
    listValueRows.forEach((row, index) => {
      if (row.variation.trim() && !row.value.trim()) {
        rowsWithVariationsButNoValue.push(index + 1);
      }
    });
    
    if (rowsWithVariationsButNoValue.length > 0) {
      const rowNumbers = rowsWithVariationsButNoValue.join(', ');
      alert(`Cannot save: Rows ${rowNumbers} have variations but are missing values. Please enter values before adding variations.`);
      return;
    }

    // Extract variations for values that have them (can be comma-separated for multiple variations)
    // Aggregate variations for the same value across multiple rows
    const variations: Record<string, string[]> = {};
    listValueRows.forEach(row => {
      if (row.value.trim() && row.variation.trim()) {
        const valueKey = row.value.trim();
        // Parse comma-separated variations
        const varList = row.variation.split(',').map(v => v.trim()).filter(v => v);
        if (varList.length > 0) {
          if (!variations[valueKey]) {
            variations[valueKey] = [];
          }
          // Add variations, avoiding duplicates
          varList.forEach(v => {
            if (!variations[valueKey].includes(v)) {
              variations[valueKey].push(v);
            }
          });
        }
      }
    });

    // Update parent component's state (local only, no backend call)
    onSave(values, Object.keys(variations).length > 0 ? variations : undefined);
    
    // Show success message - variations are saved locally in modal
    const variationCount = Object.values(variations).reduce((sum, vars) => sum + vars.length, 0);
    if (variationCount > 0) {
      alert(`Variations saved locally (${variationCount} variation${variationCount !== 1 ? 's' : ''}). Click "Save Changes" on the metadata panel to save to Neo4j.`);
    } else if (values.length > 0) {
      alert(`List values saved locally (${values.length} value${values.length !== 1 ? 's' : ''}). Click "Save Changes" on the metadata panel to save to Neo4j.`);
    }
    
    // DO NOT close the modal - keep it open so variations persist in UI
    // Modal will only close when user clicks "Cancel" or the X button
  };

  if (!isOpen || !selectedList) return null;

  const listName = selectedList.list || 'List';

  const handleSortColumn = (direction: 'asc' | 'desc') => {
    // Separate rows with values and rows without values
    const rowsWithValues: ListValueRow[] = [];
    const rowsWithoutValues: ListValueRow[] = [];
    
    listValueRows.forEach(row => {
      const value = (row.value || '').trim();
      if (value.length > 0) {
        rowsWithValues.push(row);
      } else {
        rowsWithoutValues.push(row);
      }
    });
    
    // Sort only rows with values
    const sortedRowsWithValues = rowsWithValues.sort((a, b) => {
      const aValue = (a.value || '').trim().toLowerCase();
      const bValue = (b.value || '').trim().toLowerCase();
      if (direction === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });
    
    // Combine: sorted rows with values first, then rows without values
    setListValueRows([...sortedRowsWithValues, ...rowsWithoutValues]);
  };

  const handlePaste = (e: React.ClipboardEvent, startRowId: string) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    
    // Parse pasted data (handles newlines like Excel)
    const lines = pasteData.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return;
    
    const rows = listValueRows;
    const startRowIndex = rows.findIndex(r => r.id === startRowId);
    if (startRowIndex === -1) return;
    
    const newRows = rows.map((row, rowIndex) => {
      if (rowIndex < startRowIndex) return row;
      
      const lineIndex = rowIndex - startRowIndex;
      if (lineIndex >= lines.length) return row;
      
      const value = lines[lineIndex].trim();
      return { ...row, value };
    });
    
    // Add more rows if needed
    if (startRowIndex + lines.length > rows.length) {
      const additionalRows: ListValueRow[] = [];
      for (let i = rows.length; i < startRowIndex + lines.length; i++) {
        const lineIndex = i - startRowIndex;
        const value = lines[lineIndex] ? lines[lineIndex].trim() : '';
        additionalRows.push({ id: `row-${Date.now()}-${i}`, value, variation: '' });
      }
      setListValueRows([...newRows, ...additionalRows]);
    } else {
      setListValueRows(newRows);
    }
    
    setEditingCell(null);
    setEditValue('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]" onClick={onClose}>
      <div 
        className="bg-ag-dark-surface rounded-lg border border-ag-dark-border w-[50vw] max-w-[600px] h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ag-dark-border flex-shrink-0">
          <h3 className="text-lg font-semibold text-ag-dark-text">List Values: {listName}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fileInputRef.current?.click();
              }}
              className="p-2 text-ag-dark-text-secondary hover:text-ag-dark-accent hover:bg-ag-dark-bg rounded transition-colors"
              title="Upload CSV"
            >
              <Upload className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleCsvUpload(file);
                }
                // Reset input
                e.target.value = '';
              }}
            />
            <button
              onClick={onClose}
              className="p-2 text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="min-w-full">
            {/* Table Header */}
            <div className="grid grid-cols-[50px_1fr_1fr_80px] gap-2 mb-2 pb-2 border-b border-ag-dark-border sticky top-0 bg-ag-dark-surface z-10">
              <div className="text-sm font-medium text-ag-dark-text-secondary">#</div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ag-dark-text">{listName}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleSortColumn('asc')}
                    className="p-1 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded"
                    title="Sort A-Z"
                  >
                    <ArrowUpAZ className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleSortColumn('desc')}
                    className="p-1 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded"
                    title="Sort Z-A"
                  >
                    <ArrowDownZA className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-sm font-medium text-ag-dark-text">{listName} Value Variations</div>
              <div className="text-sm font-medium text-ag-dark-text-secondary">Actions</div>
            </div>

            {/* Table Rows */}
            <div className="space-y-1">
              {listValueRows.map((row, index) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[50px_1fr_1fr_80px] gap-2 items-center p-2 hover:bg-ag-dark-bg rounded"
                >
                  {/* Row Number */}
                  <div className="text-sm text-ag-dark-text-secondary">{index + 1}</div>

                  {/* Value Cell */}
                  <div
                    className="min-h-[32px] px-2 py-1 bg-ag-dark-bg border border-ag-dark-border rounded cursor-text focus-within:border-ag-dark-accent focus-within:ring-1 focus-within:ring-ag-dark-accent"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      // Save any currently editing cell before switching
                      if (editingCell && editingCell.rowId !== row.id) {
                        const currentEditValue = editValue;
                        const currentEditingCell = editingCell;
                        setListValueRows(prev => prev.map(r => 
                          r.id === currentEditingCell.rowId 
                            ? currentEditingCell.isVariation 
                              ? { ...r, variation: currentEditValue }
                              : { ...r, value: currentEditValue }
                            : r
                        ));
                      }
                      // Start editing this cell
                      handleCellClick(row.id, row.value, false);
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onPaste={(e) => {
                      e.stopPropagation();
                      handlePaste(e, row.id);
                    }}
                  >
                    {editingCell?.rowId === row.id && !editingCell?.isVariation ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => handleCellChange(e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={(e) => handleCellKeyDown(e, row.id, false)}
                        onPaste={(e) => {
                          e.stopPropagation();
                          handlePaste(e, row.id);
                        }}
                        className="w-full bg-transparent text-ag-dark-text outline-none"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="min-h-[20px] text-ag-dark-text">
                        {row.value || <span className="text-ag-dark-text-secondary italic">Click to edit</span>}
                      </div>
                    )}
                  </div>

                  {/* Variation Cell */}
                  <div
                    className="min-h-[32px] px-2 py-1 bg-ag-dark-bg border border-ag-dark-border rounded cursor-text focus-within:border-ag-dark-accent focus-within:ring-1 focus-within:ring-ag-dark-accent"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      // Save any currently editing cell before switching
                      if (editingCell && editingCell.rowId !== row.id) {
                        const currentEditValue = editValue;
                        const currentEditingCell = editingCell;
                        setListValueRows(prev => prev.map(r => 
                          r.id === currentEditingCell.rowId 
                            ? currentEditingCell.isVariation 
                              ? { ...r, variation: currentEditValue }
                              : { ...r, value: currentEditValue }
                            : r
                        ));
                      }
                      // Start editing this cell
                      handleCellClick(row.id, row.variation, true);
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  >
                    {editingCell?.rowId === row.id && editingCell?.isVariation ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => handleCellChange(e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={(e) => handleCellKeyDown(e, row.id, true)}
                        className="w-full bg-transparent text-ag-dark-text outline-none"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="min-h-[20px] text-ag-dark-text">
                        {row.variation || <span className="text-ag-dark-text-secondary italic">Click to edit</span>}
                      </div>
                    )}
                  </div>

                  {/* Delete Button */}
                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => handleDeleteRow(row.id)}
                      className="p-1 text-ag-dark-error hover:text-red-400 transition-colors"
                      title="Delete row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-ag-dark-border flex-shrink-0">
          <button
            onClick={() => handleAddRow()}
            className="px-4 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-surface transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Row
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

