import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { MetadataData } from '../hooks/useMetadata';
import { apiService } from '../services/api';

interface MetadataDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadataItem: MetadataData | null;
  onSave: () => void;
}

interface ModalData {
  levels: 1 | 2 | 3;
  columns: string[];
  rows: string[][];
}

export const MetadataDetailModal: React.FC<MetadataDetailModalProps> = ({
  isOpen,
  onClose,
  metadataItem,
  onSave
}) => {
  const [levels, setLevels] = useState<1 | 2 | 3>(1);
  const [columnNames, setColumnNames] = useState<string[]>(['']);
  const [rows, setRows] = useState<string[][]>(Array(20).fill(null).map(() => ['']));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing data when modal opens or metadataItem changes
  useEffect(() => {
    if (isOpen && metadataItem) {
      loadMetadataDetail();
    }
  }, [isOpen, metadataItem]);

  const loadMetadataDetail = async () => {
    if (!metadataItem) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const item = await apiService.getMetadataItem(metadataItem.id);
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
        setLevels(detailData.levels || 1);
        setColumnNames(detailData.columns || ['']);
        // If rows exist, use them; otherwise create 20 empty rows
        const loadedRows = detailData.rows || [];
        // Ensure at least 20 rows
        if (loadedRows.length < 20) {
          const emptyRows = Array(20 - loadedRows.length).fill(null).map(() => Array(detailData.levels || 1).fill(''));
          setRows([...loadedRows, ...emptyRows]);
        } else {
          setRows(loadedRows);
        }
      } else {
        // Initialize with default values - create 20 empty rows by default
        // First column defaults to concept name, but user can change it
        setLevels(1);
        setColumnNames([metadataItem.concept]);
        setRows(Array(20).fill(null).map(() => ['']));
      }
    } catch (err) {
      console.error('Error loading metadata detail:', err);
      // Initialize with defaults on error - 20 empty rows
      // First column defaults to concept name, but user can change it
      setLevels(1);
      setColumnNames([metadataItem.concept]);
      setRows(Array(20).fill(null).map(() => ['']));
    } finally {
      setIsLoading(false);
    }
  };

  // Update columns when levels change
  useEffect(() => {
    if (levels !== columnNames.length) {
      const newColumns = Array(levels).fill('').map((_, index) => 
        columnNames[index] || ''
      );
      setColumnNames(newColumns);
      
      // Update rows to match new column count, ensure at least 20 rows
      setRows(prevRows => {
        const updatedRows = prevRows.map(row => {
          const newRow = Array(levels).fill('').map((_, index) => row[index] || '');
          return newRow;
        });
        
        // Ensure at least 20 rows
        if (updatedRows.length < 20) {
          const emptyRows = Array(20 - updatedRows.length).fill(null).map(() => Array(levels).fill(''));
          return [...updatedRows, ...emptyRows];
        }
        
        return updatedRows;
      });
    }
  }, [levels]);

  // Note: One of the columns should match the Concept value, but it doesn't have to be the first one
  // We'll validate this on save instead of enforcing it upfront

  const handleLevelChange = (newLevel: 1 | 2 | 3) => {
    setLevels(newLevel);
  };

  const handleColumnNameChange = (index: number, value: string) => {
    const newColumns = [...columnNames];
    newColumns[index] = value;
    setColumnNames(newColumns);
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newRows = [...rows];
    if (!newRows[rowIndex]) {
      newRows[rowIndex] = Array(levels).fill('');
    }
    newRows[rowIndex][colIndex] = value;
    setRows(newRows);
  };

  const handleAddRow = () => {
    setRows([...rows, Array(levels).fill('')]);
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
        newRows.push(Array(levels).fill(''));
      }

      // Update cells in this row
      pastedRow.forEach((cellValue, colOffset) => {
        const targetColIndex = startColIndex + colOffset;
        if (targetColIndex < levels) {
          newRows[targetRowIndex][targetColIndex] = cellValue;
        }
      });
    });

    setRows(newRows);
  };

  const handleSave = async () => {
    if (!metadataItem) return;

    // Validate that at least one column matches the Concept (can be any column, not just the first)
    const conceptColumnIndex = columnNames.findIndex(
      col => col.toLowerCase() === metadataItem.concept.toLowerCase()
    );
    
    if (conceptColumnIndex === -1) {
      setError(`At least one column name must match the Concept value: "${metadataItem.concept}". Please name one of your columns "${metadataItem.concept}".`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Prepare detail data
      const detailData: ModalData = {
        levels,
        columns: columnNames,
        rows: rows.filter(row => row.some(cell => cell.trim() !== '')) // Remove completely empty rows
      };

      // Get distinct values from the concept column
      const conceptColumnValues = detailData.rows
        .map(row => row[conceptColumnIndex]?.trim())
        .filter(val => val !== '');
      const distinctValues = [...new Set(conceptColumnValues)];
      const number = distinctValues.length.toString();
      const examples = distinctValues.join(', ');

      // Save detail data to backend
      await apiService.updateMetadataItem(metadataItem.id, {
        number,
        examples,
        detailData: JSON.stringify(detailData)
      });

      // Close modal and refresh
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save metadata detail');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !metadataItem) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6 w-full max-w-6xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div>
            <h3 className="text-xl font-semibold text-ag-dark-text">Metadata Detail</h3>
            <p className="text-sm text-ag-dark-text-secondary mt-1">
              Layer: <span className="font-medium">{metadataItem.layer}</span> | 
              Concept: <span className="font-medium">{metadataItem.concept}</span>
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
              {/* Levels Radio Buttons */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-ag-dark-text mb-3">
                  Levels <span className="text-ag-dark-error">*</span>
                </label>
                <div className="flex gap-6">
                  {[1, 2, 3].map((level) => (
                    <label key={level} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="levels"
                        value={level}
                        checked={levels === level}
                        onChange={() => handleLevelChange(level as 1 | 2 | 3)}
                        disabled={isSaving}
                        className="w-5 h-5 text-ag-dark-accent focus:ring-ag-dark-accent"
                      />
                      <span className="text-ag-dark-text">{level}</span>
                    </label>
                  ))}
                </div>
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
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${levels}, 1fr)` }}>
                  {columnNames.map((name, index) => {
                    const matchesConcept = name.toLowerCase() === metadataItem.concept.toLowerCase();
                    return (
                      <div key={index}>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => handleColumnNameChange(index, e.target.value)}
                          placeholder={`Column ${index + 1}${matchesConcept ? ` (matches "${metadataItem.concept}")` : ''}`}
                          disabled={isSaving}
                          className={`w-full px-3 py-2 bg-ag-dark-bg border rounded text-ag-dark-text placeholder-ag-dark-text-secondary focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent ${
                            matchesConcept
                              ? 'border-green-500'
                              : 'border-ag-dark-border'
                          }`}
                        />
                        {matchesConcept && (
                          <p className="text-xs text-green-500 mt-1">
                            ✓ Matches Concept: "{metadataItem.concept}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-ag-dark-text-secondary mt-2">
                  Note: At least one column name must match the Concept value: "{metadataItem.concept}"
                </p>
              </div>

              {/* Data Rows */}
              <div className="mb-4">
                
                <div className="border border-ag-dark-border rounded overflow-hidden">
                  {/* Header Row */}
                  <div 
                    className="grid gap-2 p-2 bg-ag-dark-bg border-b border-ag-dark-border font-medium text-sm text-ag-dark-text"
                    style={{ gridTemplateColumns: `40px repeat(${levels}, 1fr)` }}
                  >
                    <div className="text-center">#</div>
                    {columnNames.map((name, index) => (
                      <div key={index} className="px-2">
                        {name || `Column ${index + 1}`}
                      </div>
                    ))}
                  </div>

                  {/* Data Rows */}
                  <div className="max-h-[500px] overflow-y-auto">
                    {rows.map((row, rowIndex) => (
                      <div
                        key={rowIndex}
                        className="grid gap-2 p-2 border-b border-ag-dark-border hover:bg-ag-dark-bg/50"
                        style={{ gridTemplateColumns: `40px repeat(${levels}, 1fr)` }}
                      >
                        <div className="flex items-center justify-center text-sm text-ag-dark-text-secondary">
                          {rowIndex + 1}
                        </div>
                        {Array(levels).fill(0).map((_, colIndex) => (
                          <input
                            key={colIndex}
                            type="text"
                            value={row[colIndex] || ''}
                            onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                            onPaste={(e) => handlePaste(e, rowIndex, colIndex)}
                            disabled={isSaving}
                            className="px-2 py-1 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                            placeholder={`Enter ${columnNames[colIndex] || `column ${colIndex + 1}`} value`}
                          />
                        ))}
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

