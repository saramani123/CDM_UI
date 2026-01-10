import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { HeuristicsData } from '../hooks/useHeuristics';
import { apiService } from '../services/api';

interface HeuristicsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  heuristicsItem: HeuristicsData | null;
  onSave: () => void;
}

interface ModalData {
  columns: string[];
  rows: string[][];
}

export const HeuristicsDetailModal: React.FC<HeuristicsDetailModalProps> = ({
  isOpen,
  onClose,
  heuristicsItem,
  onSave
}) => {
  const [columnNames, setColumnNames] = useState<string[]>(['', '']);
  const [rows, setRows] = useState<string[][]>(Array(20).fill(null).map(() => ['', '']));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing data when modal opens or heuristicsItem changes
  useEffect(() => {
    if (isOpen && heuristicsItem) {
      loadHeuristicsDetail();
    }
  }, [isOpen, heuristicsItem]);

  const loadHeuristicsDetail = async () => {
    if (!heuristicsItem) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const item = await apiService.getHeuristicItem(heuristicsItem.id);
      let detailData = (item as any).detailData;
      
      // Parse if it's a string
      if (typeof detailData === 'string') {
        try {
          detailData = JSON.parse(detailData);
        } catch (e) {
          console.error('Error parsing detailData:', e);
          detailData = null;
        }
      }
      
      if (detailData && typeof detailData === 'object') {
        // Ensure we have exactly 2 columns
        const loadedColumns = detailData.columns || ['', ''];
        setColumnNames([loadedColumns[0] || '', loadedColumns[1] || '']);
        // If rows exist, use them; otherwise create 20 empty rows
        const loadedRows = detailData.rows || [];
        // Ensure rows have exactly 2 columns
        const normalizedRows = loadedRows.map(row => [
          row[0] || '',
          row[1] || ''
        ]);
        // Ensure at least 20 rows
        if (normalizedRows.length < 20) {
          const emptyRows = Array(20 - normalizedRows.length).fill(null).map(() => ['', '']);
          setRows([...normalizedRows, ...emptyRows]);
        } else {
          setRows(normalizedRows);
        }
      } else {
        // Initialize with default values - create 20 empty rows with 2 columns
        setColumnNames(['', '']);
        setRows(Array(20).fill(null).map(() => ['', '']));
      }
    } catch (err) {
      console.error('Error loading heuristics detail:', err);
      // Initialize with defaults on error - 20 empty rows with 2 columns
      setColumnNames(['', '']);
      setRows(Array(20).fill(null).map(() => ['', '']));
    } finally {
      setIsLoading(false);
    }
  };

  const handleColumnNameChange = (index: number, value: string) => {
    const newColumns = [...columnNames];
    newColumns[index] = value;
    setColumnNames(newColumns);
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newRows = [...rows];
    if (!newRows[rowIndex]) {
      newRows[rowIndex] = ['', ''];
    }
    newRows[rowIndex][colIndex] = value;
    setRows(newRows);
  };

  const handleAddRow = () => {
    setRows([...rows, ['', '']]);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startRowIndex: number, startColIndex: number) => {
    e.preventDefault();
    
    const pastedData = e.clipboardData.getData('text');
    if (!pastedData) return;

    // Parse the pasted data - Excel uses tabs for columns and newlines for rows
    const lines = pastedData.split(/\r?\n/).filter(line => line.trim() !== '');
    const parsedData: string[][] = lines.map(line => 
      line.split('\t').map(cell => cell.trim())
    );

    if (parsedData.length === 0) return;

    // Update rows starting from the clicked cell
    const newRows = [...rows];
    
    parsedData.forEach((pastedRow, rowOffset) => {
      const targetRowIndex = startRowIndex + rowOffset;
      
      // Ensure we have enough rows
      while (targetRowIndex >= newRows.length) {
        newRows.push(['', '']);
      }

      // Update cells in this row (limit to 2 columns)
      pastedRow.forEach((cellValue, colOffset) => {
        const targetColIndex = startColIndex + colOffset;
        if (targetColIndex < 2) {
          if (!newRows[targetRowIndex]) {
            newRows[targetRowIndex] = ['', ''];
          }
          newRows[targetRowIndex][targetColIndex] = cellValue;
        }
      });
    });

    setRows(newRows);
  };

  const handleSave = async () => {
    if (!heuristicsItem) return;

    setIsSaving(true);
    setError(null);

    try {
      // Prepare detail data
      const nonEmptyRows = rows.filter(row => row.some(cell => cell.trim() !== '')); // Remove completely empty rows
      const detailData: ModalData = {
        columns: columnNames,
        rows: nonEmptyRows
      };

      // Count the number of rows (non-empty rows)
      const rowCount = nonEmptyRows.length.toString();

      // Save detail data to backend
      await apiService.updateHeuristicItem(heuristicsItem.id, {
        rules: rowCount,
        detailData: JSON.stringify(detailData)
      });

      // Close modal and refresh
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save heuristics detail');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !heuristicsItem) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6 w-full max-w-6xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div>
            <h3 className="text-xl font-semibold text-ag-dark-text">Heuristics Detail</h3>
            <p className="text-sm text-ag-dark-text-secondary mt-1">
              Agent: <span className="font-medium">{heuristicsItem.agent}</span> | 
              Procedure: <span className="font-medium">{heuristicsItem.procedure}</span>
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
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-ag-dark-text-secondary">Loading...</div>
            </div>
          ) : (
            <>
              {/* Instructional Text */}
              <div className="mb-4 p-4 bg-ag-dark-bg border border-ag-dark-border rounded">
                <p className="text-sm text-ag-dark-text-secondary">
                  <span className="font-medium text-ag-dark-text">First column (Then):</span> Header is the exact variable name being set. Values are what that variable is set to.
                </p>
                <p className="text-sm text-ag-dark-text-secondary mt-2">
                  <span className="font-medium text-ag-dark-text">Second column (If):</span> Contains the condition statements that trigger the rule.
                </p>
              </div>

              {/* Column Headers */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-ag-dark-text">
                    Column Names <span className="text-ag-dark-error">*</span>
                  </label>
                  <button
                    onClick={handleAddRow}
                    disabled={isSaving}
                    className="px-3 py-1 text-sm bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors disabled:opacity-50"
                  >
                    + Add Row
                  </button>
                </div>
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  <div>
                    <label className="block text-xs text-ag-dark-text-secondary mb-1">
                      Then (Variable to Set)
                    </label>
                    <input
                      type="text"
                      value={columnNames[0] || ''}
                      onChange={(e) => handleColumnNameChange(0, e.target.value)}
                      placeholder="Enter variable name (e.g., Key)"
                      disabled={isSaving}
                      className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-ag-dark-text-secondary mb-1">
                      If (Condition)
                    </label>
                    <input
                      type="text"
                      value={columnNames[1] || ''}
                      onChange={(e) => handleColumnNameChange(1, e.target.value)}
                      placeholder="Enter condition label (e.g., If documentation says that)"
                      disabled={isSaving}
                      className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                    />
                  </div>
                </div>
              </div>

              {/* Data Rows */}
              <div className="mb-4">
                <div className="border border-ag-dark-border rounded overflow-hidden">
                  {/* Header Row */}
                  <div 
                    className="grid gap-2 p-2 bg-ag-dark-bg border-b border-ag-dark-border font-medium text-sm text-ag-dark-text"
                    style={{ gridTemplateColumns: '40px repeat(2, 1fr)' }}
                  >
                    <div className="text-center">#</div>
                    <div className="px-2">
                      {columnNames[0] || 'Column 1 (Then)'}
                    </div>
                    <div className="px-2">
                      {columnNames[1] || 'Column 2 (If)'}
                    </div>
                  </div>

                  {/* Data Rows */}
                  <div className="max-h-[500px] overflow-y-auto">
                    {rows.map((row, rowIndex) => (
                      <div
                        key={rowIndex}
                        className="grid gap-2 p-2 border-b border-ag-dark-border hover:bg-ag-dark-bg/50"
                        style={{ gridTemplateColumns: '40px repeat(2, 1fr)' }}
                      >
                        <div className="flex items-center justify-center text-sm text-ag-dark-text-secondary">
                          {rowIndex + 1}
                        </div>
                        <input
                          type="text"
                          value={row[0] || ''}
                          onChange={(e) => handleCellChange(rowIndex, 0, e.target.value)}
                          onPaste={(e) => handlePaste(e, rowIndex, 0)}
                          disabled={isSaving}
                          className="px-2 py-1 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                          placeholder={`Enter ${columnNames[0] || 'column 1'} value`}
                        />
                        <input
                          type="text"
                          value={row[1] || ''}
                          onChange={(e) => handleCellChange(rowIndex, 1, e.target.value)}
                          onPaste={(e) => handlePaste(e, rowIndex, 1)}
                          disabled={isSaving}
                          className="px-2 py-1 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                          placeholder={`Enter ${columnNames[1] || 'column 2'} value`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900 bg-opacity-20 border border-red-500 rounded text-red-400 text-sm flex-shrink-0">
            {error}
          </div>
        )}

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
            disabled={isSaving || isLoading}
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

