import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Upload, Save, Plus, Trash2, FileText, ArrowUpAZ, ArrowDownZA } from 'lucide-react';
import { ListData } from '../data/listsData';
import { getTieredListValues } from '../services/api';

interface TieredListValuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedList: ListData | null;
  allLists: ListData[];
  tierNames?: string[]; // Tier names from List Type section (Tier 2, Tier 3, etc.)
  onSave: (tieredValues: Record<string, string[][]>) => void;
}

interface TieredValueRow {
  id: string;
  values: string[]; // One value per tier column
}

export const TieredListValuesModal: React.FC<TieredListValuesModalProps> = ({
  isOpen,
  onClose,
  selectedList,
  allLists,
  tierNames = [],
  onSave
}) => {
  const [tieredValueRows, setTieredValueRows] = useState<TieredValueRow[]>([]);
  const [isCsvUploadOpen, setIsCsvUploadOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingCell, setEditingCell] = useState<{ rowId: string; colIndex: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build column headers: only tier names (no parent list name)
  const columnHeaders: string[] = React.useMemo(() => {
    const headers: string[] = [];
    // Add tier names from props (Tier 1, Tier 2, etc.)
    tierNames.forEach(tierName => {
      if (tierName && tierName.trim()) {
        headers.push(tierName.trim());
      }
    });
    return headers;
  }, [tierNames]);

  const loadTieredValues = useCallback(async () => {
    if (!selectedList) return;
    
    try {
      // Load existing tiered values from backend
      const existingValues = await getTieredListValues(selectedList.id);
      
      // Convert the backend format to rows
      // Backend format: { "Tier1Value": [["Tier2Value1", "Tier3Value1"], ["Tier2Value2", "Tier3Value2"]], ... }
      // We need: rows where each row is [Tier1Value, Tier2Value, Tier3Value, ...]
      const rows: TieredValueRow[] = [];
      
      if (existingValues && Object.keys(existingValues).length > 0) {
        // For each Tier 1 value, create rows for each tiered value array
        Object.entries(existingValues).forEach(([tier1Value, tieredArrays]) => {
          tieredArrays.forEach((tieredArray) => {
            // Create a row: [Tier1Value, Tier2Value, Tier3Value, ...]
            const rowValues = [tier1Value, ...tieredArray];
            // Pad with empty strings if needed to match column count
            while (rowValues.length < columnHeaders.length) {
              rowValues.push('');
            }
            rows.push({
              id: `row-${Date.now()}-${rows.length}`,
              values: rowValues.slice(0, columnHeaders.length)
            });
          });
        });
      }
      
      // Always ensure we have at least 100 rows for Excel-like experience
      while (rows.length < 100) {
        rows.push({
          id: `row-${Date.now()}-${rows.length}`,
          values: columnHeaders.map(() => '')
        });
      }
      
      setTieredValueRows(rows);
    } catch (error) {
      console.error('Error loading tiered values:', error);
      // On error, initialize with empty rows
      const initialRows: TieredValueRow[] = [];
      for (let i = 0; i < 100; i++) {
        initialRows.push({ 
          id: `row-${i + 1}`, 
          values: columnHeaders.map(() => '') 
        });
      }
      setTieredValueRows(initialRows);
    }
  }, [selectedList, columnHeaders]);

  // Load existing tiered values when modal opens
  useEffect(() => {
    if (isOpen && selectedList && columnHeaders.length >= 1) {
      loadTieredValues();
    } else if (!isOpen) {
      // Reset when modal closes
      setTieredValueRows([]);
      setEditingCell(null);
      setEditValue('');
    }
  }, [isOpen, selectedList, columnHeaders.length, loadTieredValues]);

  const handleAddRow = (index?: number) => {
    const newRow: TieredValueRow = {
      id: Date.now().toString(),
      values: columnHeaders.map(() => '')
    };
    if (index !== undefined) {
      setTieredValueRows(prev => [...prev.slice(0, index), newRow, ...prev.slice(index)]);
    } else {
      setTieredValueRows(prev => [...prev, newRow]);
    }
  };

  const handleDeleteRow = (rowId: string) => {
    setTieredValueRows(prev => prev.filter(row => row.id !== rowId));
  };

  const handleCellClick = (rowId: string, colIndex: number, currentValue: string) => {
    setEditingCell({ rowId, colIndex });
    setEditValue(currentValue);
  };

  const handleCellChange = (value: string) => {
    setEditValue(value);
  };

  const handlePaste = (e: React.ClipboardEvent, startRowId: string, startColIndex: number) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    
    // Parse pasted data (handles tab-separated values and newlines like Excel)
    const lines = pasteData.split(/\r?\n/).filter(line => line.trim() || line.includes('\t'));
    if (lines.length === 0) return;
    
    const rows = tieredValueRows;
    const startRowIndex = rows.findIndex(r => r.id === startRowId);
    if (startRowIndex === -1) return;
    
    const newRows = rows.map((row, rowIndex) => {
      if (rowIndex < startRowIndex) return row;
      
      const lineIndex = rowIndex - startRowIndex;
      if (lineIndex >= lines.length) return row;
      
      const line = lines[lineIndex];
      const values = line.split('\t');
      
      const newValues = [...row.values];
      values.forEach((value, colOffset) => {
        const colIndex = startColIndex + colOffset;
        if (colIndex < newValues.length) {
          newValues[colIndex] = value.trim();
        }
      });
      
      return { ...row, values: newValues };
    });
    
    // Add more rows if needed
    if (startRowIndex + lines.length > rows.length) {
      const additionalRows: TieredValueRow[] = [];
      for (let i = rows.length; i < startRowIndex + lines.length; i++) {
        const lineIndex = i - startRowIndex;
        const line = lines[lineIndex];
        const values = line.split('\t');
        const newValues = columnHeaders.map((_, colIndex) => {
          const colOffset = colIndex - startColIndex;
          return colOffset >= 0 && colOffset < values.length ? values[colOffset].trim() : '';
        });
        additionalRows.push({ id: `row-${i + 1}`, values: newValues });
      }
      setTieredValueRows([...newRows, ...additionalRows]);
    } else {
      setTieredValueRows(newRows);
    }
    
    setEditingCell(null);
    setEditValue('');
  };

  const handleCellBlur = () => {
    if (editingCell) {
      setTieredValueRows(prev => prev.map(row => {
        if (row.id === editingCell.rowId) {
          const newValues = [...row.values];
          newValues[editingCell.colIndex] = editValue;
          return { ...row, values: newValues };
        }
        return row;
      }));
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, rowId: string, colIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Move to next row, same column
      const currentRowIndex = tieredValueRows.findIndex(r => r.id === rowId);
      if (currentRowIndex < tieredValueRows.length - 1) {
        const nextRow = tieredValueRows[currentRowIndex + 1];
        setEditingCell({ rowId: nextRow.id, colIndex });
        setEditValue(nextRow.values[colIndex] || '');
      } else {
        handleCellBlur();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Move to next column, same row
      if (colIndex < columnHeaders.length - 1) {
        const currentRow = tieredValueRows.find(r => r.id === rowId);
        if (currentRow) {
          setEditingCell({ rowId, colIndex: colIndex + 1 });
          setEditValue(currentRow.values[colIndex + 1] || '');
        }
      } else {
        // Move to next row, first column
        const currentRowIndex = tieredValueRows.findIndex(r => r.id === rowId);
        if (currentRowIndex < tieredValueRows.length - 1) {
          const nextRow = tieredValueRows[currentRowIndex + 1];
          setEditingCell({ rowId: nextRow.id, colIndex: 0 });
          setEditValue(nextRow.values[0] || '');
        }
      }
    } else if (e.key === 'Escape') {
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

        // Parse header row to get column order
        const headerLine = lines[0];
        const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        
        // Verify headers match column headers (parent list name + tier names)
        if (headers.length !== columnHeaders.length || !headers.every((h, i) => h === columnHeaders[i])) {
          alert(`CSV headers must match column names in order: ${columnHeaders.join(', ')}`);
          return;
        }

        // Parse data rows
        const newRows: TieredValueRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const values: string[] = [];
          let currentValue = '';
          let inQuotes = false;
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(currentValue.trim().replace(/^"|"$/g, ''));
              currentValue = '';
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue.trim().replace(/^"|"$/g, ''));
          
          // Pad or truncate to match number of columns
          const paddedValues = [...values];
          while (paddedValues.length < columnHeaders.length) {
            paddedValues.push('');
          }
          paddedValues.length = columnHeaders.length;
          
          newRows.push({
            id: (Date.now() + i).toString(),
            values: paddedValues
          });
        }

        setTieredValueRows(newRows);
        setIsCsvUploadOpen(false);
        alert(`Successfully loaded ${newRows.length} rows from CSV`);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        alert('Error parsing CSV file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const handleSortColumn = (colIndex: number, direction: 'asc' | 'desc') => {
    // Separate rows with values and rows without values in the target column
    const rowsWithValues: TieredValueRow[] = [];
    const rowsWithoutValues: TieredValueRow[] = [];
    
    tieredValueRows.forEach(row => {
      const value = (row.values[colIndex] || '').trim();
      if (value.length > 0) {
        rowsWithValues.push(row);
      } else {
        rowsWithoutValues.push(row);
      }
    });
    
    // Sort only rows with values
    const sortedRowsWithValues = rowsWithValues.sort((a, b) => {
      const aValue = (a.values[colIndex] || '').trim().toLowerCase();
      const bValue = (b.values[colIndex] || '').trim().toLowerCase();
      if (direction === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });
    
    // Combine: sorted rows with values first, then rows without values
    setTieredValueRows([...sortedRowsWithValues, ...rowsWithoutValues]);
  };

  const handleSave = () => {
    // Convert rows to the format expected by backend
    // Group by Tier 1 value, then create arrays of [Tier2, Tier3, ...] values
    // Format: { "Tier1Value": [["Tier2Value1", "Tier3Value1"], ["Tier2Value2", "Tier3Value2"]], ... }
    const tieredValues: Record<string, string[][]> = {};
    
    tieredValueRows.forEach(row => {
      if (row.values[0] && row.values[0].trim()) { // Tier 1 value (first column)
        const tier1Value = row.values[0].trim();
        // Get remaining tier values (Tier 2, Tier 3, etc.)
        const remainingTierValues = row.values.slice(1).filter(v => v && v.trim());
        if (remainingTierValues.length > 0) {
          if (!tieredValues[tier1Value]) {
            tieredValues[tier1Value] = [];
          }
          // Add the array of tier values (Tier 2, Tier 3, etc.)
          tieredValues[tier1Value].push(remainingTierValues);
        }
      }
    });

    // Only save if there are values
    if (Object.keys(tieredValues).length > 0) {
      onSave(tieredValues);
    } else {
      // If no values, still save to clear existing tiered values
      onSave({});
    }
    onClose();
  };

  if (!isOpen || !selectedList || columnHeaders.length < 1) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]" onClick={onClose}>
      <div 
        className="bg-ag-dark-surface rounded-lg border border-ag-dark-border w-[95vw] h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ag-dark-border">
          <h2 className="text-xl font-semibold text-ag-dark-text">
            Tiered List Values: {selectedList.list}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsCsvUploadOpen(true);
                fileInputRef.current?.click();
              }}
              className="p-2 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
              title="Upload CSV"
            >
              <Upload className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleCsvUpload(file);
                }
              }}
              className="hidden"
            />
            <button
              onClick={onClose}
              className="p-2 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CSV Upload Instructions Modal */}
        {isCsvUploadOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
            <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-ag-dark-border sticky top-0 bg-ag-dark-surface">
                <h2 className="text-lg font-semibold text-ag-dark-text">Upload Tiered List Values</h2>
                <button
                  onClick={() => setIsCsvUploadOpen(false)}
                  className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                {/* CSV Format Specification */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-ag-dark-accent">CSV FORMAT</h3>
                  <div className="bg-ag-dark-bg rounded-lg border border-ag-dark-border overflow-hidden">
                    {columnHeaders.map((header, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between px-4 py-3 border-b border-ag-dark-border last:border-b-0"
                      >
                        <span className="text-sm text-ag-dark-text-secondary">
                          Column {index + 1}
                        </span>
                        <span className="text-sm font-medium text-ag-dark-text">
                          {header}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upload Area */}
                <div className="space-y-3">
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isDragOver
                        ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10'
                        : 'border-ag-dark-border hover:border-ag-dark-accent hover:bg-ag-dark-bg'
                    }`}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const file = e.dataTransfer.files[0];
                      if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
                        handleCsvUpload(file);
                        setIsCsvUploadOpen(false);
                      } else {
                        alert('Please drop a valid CSV file');
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                  >
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <FileText className="w-10 h-10 text-ag-dark-text-secondary" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-ag-dark-text">
                          Drop your CSV file here
                        </p>
                        <p className="text-xs text-ag-dark-text-secondary">
                          or click to browse
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors cursor-pointer">
                        <Upload className="w-4 h-4" />
                        UPLOAD CSV
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleCsvUpload(file);
                              setIsCsvUploadOpen(false);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Format Notes */}
                <div className="text-xs text-ag-dark-text-secondary space-y-1">
                  <p>• First row should contain column headers</p>
                  <p>• Column headers must match the column names in order: {columnHeaders.join(', ')}</p>
                  <p>• Each subsequent row represents one tiered value combination</p>
                  <p>• Values should be separated by commas</p>
                  <p>• You can also copy/paste directly from Excel into the grid</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table Content */}
        <div 
          className="flex-1 overflow-auto p-4"
          onPaste={(e) => {
            // Handle paste at table level if a cell is selected
            if (editingCell) {
              e.preventDefault();
              handlePaste(e, editingCell.rowId, editingCell.colIndex);
            }
          }}
        >
          <div className="border border-ag-dark-border rounded">
            {/* Table Header */}
            <div className="sticky top-0 bg-ag-dark-bg border-b border-ag-dark-border z-10">
              <div className="grid gap-2 p-2" style={{ gridTemplateColumns: `40px repeat(${columnHeaders.length}, 250px) auto` }}>
                <div className="text-xs font-medium text-ag-dark-text-secondary"></div>
                {columnHeaders.map((header, index) => (
                  <div key={index} className="flex items-center justify-between text-xs font-medium text-ag-dark-text-secondary text-left">
                    <span>{header}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSortColumn(index, 'asc')}
                        className="p-0.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded"
                        title="Sort A-Z"
                      >
                        <ArrowUpAZ className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleSortColumn(index, 'desc')}
                        className="p-0.5 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded"
                        title="Sort Z-A"
                      >
                        <ArrowDownZA className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="text-xs font-medium text-ag-dark-text-secondary"></div>
              </div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-ag-dark-border">
              {tieredValueRows.map((row, rowIndex) => (
                  <div 
                    key={row.id} 
                    className="grid gap-2 p-2 hover:bg-ag-dark-bg/50"
                    style={{ gridTemplateColumns: `40px repeat(${columnHeaders.length}, 250px) auto` }}
                  >
                    <div className="flex items-center text-xs text-ag-dark-text-secondary">
                      {rowIndex + 1}
                    </div>
                    {row.values.map((value, colIndex) => (
                      <div key={colIndex} className="flex items-center">
                        {editingCell?.rowId === row.id && editingCell?.colIndex === colIndex ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => handleCellChange(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={(e) => handleCellKeyDown(e, row.id, colIndex)}
                            onPaste={(e) => handlePaste(e, row.id, colIndex)}
                            autoFocus
                            className="w-full px-2 py-1 bg-ag-dark-bg border border-ag-dark-accent rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent text-left"
                          />
                        ) : (
                          <div
                            onClick={() => handleCellClick(row.id, colIndex, value)}
                            className="w-full px-2 py-1 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text cursor-text hover:border-ag-dark-accent min-h-[32px] flex items-center text-left"
                            tabIndex={0}
                            onFocus={() => handleCellClick(row.id, colIndex, value)}
                          >
                            {value || <span className="text-ag-dark-text-secondary opacity-0">Click to edit</span>}
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-1 text-ag-dark-error hover:text-red-400 transition-colors rounded hover:bg-red-900/20"
                        title="Delete row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-ag-dark-border">
          <button
            onClick={() => handleAddRow()}
            className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Row
          </button>
          <div className="flex items-center gap-2">
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

