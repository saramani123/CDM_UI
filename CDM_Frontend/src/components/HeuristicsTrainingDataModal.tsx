import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface HeuristicsTrainingDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (trainingData: TrainingData) => Promise<void>;
  thenColumnName: string;
  thenColumnValue: string;
  ifColumnValue: string; // The "If" condition value from the clicked row
  ruleNumber: number;
  populatedRows: number[]; // Array of row indices that have been populated
  existingTrainingData?: TrainingData | null; // Existing training data to load
}

interface TrainingData {
  numberOfColumns: number;
  columns: string[];
  rows: string[][];
}

export const HeuristicsTrainingDataModal: React.FC<HeuristicsTrainingDataModalProps> = ({
  isOpen,
  onClose,
  onSave,
  thenColumnName,
  thenColumnValue,
  ifColumnValue,
  ruleNumber,
  populatedRows,
  existingTrainingData
}) => {
  const [numberOfColumns, setNumberOfColumns] = useState(2);
  const [columnHeaders, setColumnHeaders] = useState<string[]>(['', '']); // Starts with 2 empty for additional columns
  const [rows, setRows] = useState<string[][]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing training data when modal opens
  useEffect(() => {
    if (isOpen) {
      if (existingTrainingData) {
        console.log('Loading existing training data:', existingTrainingData);
        // Load existing data
        setNumberOfColumns(existingTrainingData.numberOfColumns);
        // Extract column headers (skip first two: Then variable and Rule)
        const additionalHeaders = existingTrainingData.columns.slice(2);
        setColumnHeaders(['', '', ...additionalHeaders]);
        // Load rows - use all saved rows, regardless of populatedRows
        if (existingTrainingData.rows && Array.isArray(existingTrainingData.rows) && existingTrainingData.rows.length > 0) {
          console.log('Loading rows:', existingTrainingData.rows);
          const loadedRows = existingTrainingData.rows.map((row, idx) => {
            // Ensure row is an array
            if (!Array.isArray(row)) {
              console.warn(`Row ${idx} is not an array:`, row);
              return null;
            }
            // Ensure row has correct structure: [thenValue, ruleNumber, ...additionalColumns]
            const newRow = [row[0] || thenColumnValue, row[1] || ruleNumber.toString()];
            // Add additional columns
            for (let i = 2; i < row.length; i++) {
              newRow.push(row[i] || '');
            }
            // Ensure we have enough columns
            while (newRow.length < 2 + existingTrainingData.numberOfColumns) {
              newRow.push('');
            }
            return newRow;
          }).filter(row => row !== null); // Filter out any null rows
          console.log('Loaded rows:', loadedRows);
          setRows(loadedRows);
        } else {
          console.log('No existing rows found, creating empty rows');
          // No existing rows, create empty rows based on populatedRows or default to 1 row
          const rowCount = populatedRows.length > 0 ? populatedRows.length : 1;
          const initialRows = Array(rowCount).fill(null).map(() => {
            const row = [thenColumnValue, ruleNumber.toString()];
            for (let i = 0; i < existingTrainingData.numberOfColumns; i++) {
              row.push('');
            }
            return row;
          });
          setRows(initialRows);
        }
      } else {
        // Initialize with empty data
        setNumberOfColumns(2);
        setColumnHeaders(['', '']);
        // Always create at least 1 row, even if populatedRows is empty
        const rowCount = populatedRows.length > 0 ? populatedRows.length : 1;
        const initialRows = Array(rowCount).fill(null).map(() => {
          const row = [thenColumnValue, ruleNumber.toString()];
          for (let i = 0; i < 2; i++) {
            row.push('');
          }
          return row;
        });
        setRows(initialRows);
      }
    }
  }, [isOpen, existingTrainingData, thenColumnValue, ruleNumber, populatedRows]);

  // Update column headers when numberOfColumns changes (only if not loading existing data)
  useEffect(() => {
    if (isOpen && !existingTrainingData) {
      // First two columns are fixed (Then variable and Rule), so we need numberOfColumns additional columns
      const additionalColumns = Array(numberOfColumns).fill('').map((_, index) => 
        columnHeaders[index + 2] || ''
      );
      setColumnHeaders(['', '', ...additionalColumns]); // First two are empty since they're fixed
    }
  }, [numberOfColumns, isOpen, existingTrainingData]);

  // Update rows when numberOfColumns changes (only if not loading existing data)
  useEffect(() => {
    // Don't update rows if we have existing training data - it's already loaded
    if (existingTrainingData) {
      return;
    }
    
    if (isOpen && populatedRows.length > 0) {
      const updatedRows = populatedRows.map(() => {
        const newRow = [thenColumnValue, ruleNumber.toString()]; // Keep first two columns (Then value and Rule)
        // Adjust additional columns
        for (let i = 0; i < numberOfColumns; i++) {
          newRow.push('');
        }
        return newRow;
      });
      setRows(updatedRows);
    } else if (isOpen && rows.length > 0 && numberOfColumns > 0) {
      // If numberOfColumns changed and we have existing rows, adjust them
      const updatedRows = rows.map(row => {
        const newRow = [row[0] || thenColumnValue, row[1] || ruleNumber.toString()];
        // Keep existing additional columns up to new numberOfColumns
        for (let i = 2; i < 2 + numberOfColumns; i++) {
          newRow.push(row[i] || '');
        }
        return newRow;
      });
      setRows(updatedRows);
    }
  }, [numberOfColumns, isOpen, populatedRows, thenColumnValue, ruleNumber]);

  const handleColumnHeaderChange = (index: number, value: string) => {
    const newHeaders = [...columnHeaders];
    newHeaders[index + 2] = value; // +2 because first two are fixed
    setColumnHeaders(newHeaders);
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newRows = [...rows];
    if (!newRows[rowIndex]) {
      newRows[rowIndex] = Array(2 + numberOfColumns).fill('');
      newRows[rowIndex][0] = thenColumnValue;
      newRows[rowIndex][1] = ruleNumber.toString();
    }
    newRows[rowIndex][colIndex + 2] = value; // +2 because first two columns are fixed
    setRows(newRows);
  };

  const handlePaste = (e: React.ClipboardEvent, startRowIndex: number, startColIndex: number) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    
    // Parse the pasted data (Excel uses tab-separated values with newlines for rows)
    const lines = pastedData.split(/\r?\n/).filter(line => line.trim() !== '');
    const pastedRows = lines.map(line => line.split('\t'));

    if (pastedRows.length === 0) return;

    const newRows = [...rows];
    
    // Ensure we have enough rows
    const maxRowIndex = startRowIndex + pastedRows.length - 1;
    while (newRows.length <= maxRowIndex) {
      const newRow = Array(2 + numberOfColumns).fill('');
      newRow[0] = thenColumnValue;
      newRow[1] = ruleNumber.toString();
      newRows.push(newRow);
    }

    // Fill in the pasted data (only into editable columns, starting from startColIndex)
    pastedRows.forEach((pastedRow, rowOffset) => {
      const targetRowIndex = startRowIndex + rowOffset;
      if (!newRows[targetRowIndex]) {
        newRows[targetRowIndex] = Array(2 + numberOfColumns).fill('');
        newRows[targetRowIndex][0] = thenColumnValue;
        newRows[targetRowIndex][1] = ruleNumber.toString();
      }

      pastedRow.forEach((cellValue, colOffset) => {
        const targetColIndex = startColIndex + colOffset;
        // Only paste into editable columns (skip fixed columns 0 and 1)
        if (targetColIndex >= 0 && targetColIndex < numberOfColumns) {
          newRows[targetRowIndex][targetColIndex + 2] = cellValue; // +2 because first two columns are fixed
        }
      });
    });

    setRows(newRows);
  };

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);

    try {
      // Prepare training data - save ALL rows, including empty ones
      const trainingData: TrainingData = {
        numberOfColumns,
        columns: [thenColumnName, 'Rule', ...columnHeaders.slice(2)],
        rows: rows.map(row => {
          // Ensure row structure: [thenValue, ruleNumber, ...additionalColumns]
          const savedRow = [
            row[0] || thenColumnValue,
            row[1] || ruleNumber.toString(),
            ...row.slice(2)
          ];
          // Ensure we have the right number of columns
          while (savedRow.length < 2 + numberOfColumns) {
            savedRow.push('');
          }
          return savedRow;
        })
      };

      console.log('Saving training data:', trainingData);
      await onSave(trainingData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save training data');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // Grid template columns - consistent for both header inputs and grid
  const gridTemplateColumns = `50px 200px 120px repeat(${numberOfColumns}, 250px)`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6 w-full max-w-[95vw] max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div>
            <h3 className="text-xl font-semibold text-ag-dark-text">Training Data</h3>
            <p className="text-sm text-ag-dark-text-secondary mt-1">
              Rule #{ruleNumber} - {thenColumnName}: {thenColumnValue} | If: {ifColumnValue}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto mb-6">
          {/* Number of Columns Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              No. Columns <span className="text-ag-dark-error">*</span>
            </label>
            <select
              value={numberOfColumns}
              onChange={(e) => setNumberOfColumns(parseInt(e.target.value))}
              disabled={isSaving}
              className="w-32 px-3 py-2 pr-10 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>

          {/* Column Headers - Independently scrollable */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-ag-dark-text mb-2">
              Column Headers
            </label>
            <div className="overflow-x-auto">
              <div className="grid gap-4" style={{ gridTemplateColumns: `250px 250px repeat(${numberOfColumns}, 250px)`, minWidth: 'max-content' }}>
                {/* Fixed columns - read-only */}
                <div>
                  <label className="block text-xs text-ag-dark-text-secondary mb-1">
                    {thenColumnName} (Fixed)
                  </label>
                  <input
                    type="text"
                    value={thenColumnName}
                    disabled
                    className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text opacity-60 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ag-dark-text-secondary mb-1">
                    Rule (Fixed)
                  </label>
                  <input
                    type="text"
                    value="Rule"
                    disabled
                    className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text opacity-60 cursor-not-allowed"
                  />
                </div>
                {/* Additional columns */}
                {Array.from({ length: numberOfColumns }, (_, i) => (
                  <div key={i}>
                    <label className="block text-xs text-ag-dark-text-secondary mb-1">
                      Column {i + 3}
                    </label>
                    <input
                      type="text"
                      value={columnHeaders[i + 2] || ''}
                      onChange={(e) => handleColumnHeaderChange(i, e.target.value)}
                      placeholder={`Enter column ${i + 3} header`}
                      disabled={isSaving}
                      className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Data Rows - Independently scrollable */}
          <div className="mb-4">
            <div className="border border-ag-dark-border rounded overflow-hidden">
              {/* Scrollable container for grid */}
              <div className="overflow-x-auto">
                <div style={{ minWidth: 'max-content' }}>
                  {/* Header Row */}
                  <div 
                    className="grid gap-4 p-2 bg-ag-dark-bg border-b border-ag-dark-border font-medium text-sm text-ag-dark-text"
                    style={{ gridTemplateColumns }}
                  >
                    <div className="text-center">#</div>
                    <div className="px-2">{thenColumnName}</div>
                    <div className="px-2">Rule</div>
                    {Array.from({ length: numberOfColumns }, (_, i) => (
                      <div key={i} className="px-2">
                        {columnHeaders[i + 2] || `Column ${i + 3}`}
                      </div>
                    ))}
                  </div>

                  {/* Data Rows */}
                  <div className="max-h-[500px] overflow-y-auto">
                    {rows.length === 0 ? (
                      <div className="p-4 text-center text-ag-dark-text-secondary">
                        No populated rows available. Please add data to the Then or If columns first.
                      </div>
                    ) : (
                      rows.map((row, rowIndex) => (
                        <div
                          key={rowIndex}
                          className="grid gap-4 p-2 border-b border-ag-dark-border hover:bg-ag-dark-bg/50"
                          style={{ gridTemplateColumns }}
                        >
                          <div className="flex items-center justify-center text-sm text-ag-dark-text-secondary">
                            {populatedRows[rowIndex] !== undefined ? populatedRows[rowIndex] + 1 : rowIndex + 1}
                          </div>
                          {/* Fixed Then column - read-only */}
                          <input
                            type="text"
                            value={row[0] || thenColumnValue}
                            disabled
                            className="px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text opacity-60 cursor-not-allowed"
                          />
                          {/* Fixed Rule column - read-only */}
                          <input
                            type="text"
                            value={row[1] || ruleNumber.toString()}
                            disabled
                            className="px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text opacity-60 cursor-not-allowed"
                          />
                          {/* Additional columns - editable */}
                          {Array.from({ length: numberOfColumns }, (_, colIndex) => (
                            <input
                              key={colIndex}
                              type="text"
                              value={row[colIndex + 2] || ''}
                              onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                              onPaste={(e) => handlePaste(e, rowIndex, colIndex)}
                              disabled={isSaving}
                              className="px-3 py-2 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                              placeholder={`Enter ${columnHeaders[colIndex + 2] || `column ${colIndex + 3}`} value`}
                            />
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900 bg-opacity-20 border border-red-500 rounded text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 flex-shrink-0 border-t border-ag-dark-border pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-surface transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

