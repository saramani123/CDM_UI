import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Upload, Save, Plus, Trash2, FileText, ArrowUpAZ, ArrowDownZA } from 'lucide-react';
import { ListData } from '../data/listsData';
import { getEquivalentListValues } from '../services/api';

export interface EquivalentValueRowPayload {
  value1: string;
  variations1: string[];
  value2: string;
  variations2: string[];
}

export interface EquivalentValuesPayload {
  rows: EquivalentValueRowPayload[];
}

interface EquivalentListValuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedList: ListData | null;
  equivalentNames: string[]; // exactly 2 names: [equivalent 1, equivalent 2]
  initialValues?: EquivalentValuesPayload | null; // unsaved local values from parent
  onSave: (equivalentValues: EquivalentValuesPayload) => void;
}

interface EquivalentValueRow {
  id: string;
  values: string[]; // [value1, value2]
  variations: string[]; // [variations1 (comma-sep), variations2 (comma-sep)]
}

const EMPTY_ROW_COUNT = 100;

export const EquivalentListValuesModal: React.FC<EquivalentListValuesModalProps> = ({
  isOpen,
  onClose,
  selectedList,
  equivalentNames,
  initialValues,
  onSave,
}) => {
  const [rows, setRows] = useState<EquivalentValueRow[]>([]);
  const [isCsvUploadOpen, setIsCsvUploadOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingCell, setEditingCell] = useState<{ rowId: string; colIndex: number; isVariation?: boolean } | null>(null);
  const [editValue, setEditValue] = useState('');
  const hasLoadedInitialData = useRef(false);
  const rowsRef = useRef<EquivalentValueRow[]>([]);

  const columnHeaders: string[] = React.useMemo(() => {
    return (equivalentNames || []).slice(0, 2).map((n) => (n || '').trim());
  }, [equivalentNames]);

  const variationColumnHeaders: string[] = React.useMemo(() => {
    return columnHeaders.map((header) => `${header} Value Variations`);
  }, [columnHeaders]);

  const makeEmptyRow = useCallback((suffix: number | string): EquivalentValueRow => ({
    id: `eq-row-${Date.now()}-${suffix}`,
    values: ['', ''],
    variations: ['', ''],
  }), []);

  const padToEmptyRows = useCallback((built: EquivalentValueRow[]): EquivalentValueRow[] => {
    const out = [...built];
    while (out.length < EMPTY_ROW_COUNT) {
      out.push(makeEmptyRow(out.length));
    }
    return out;
  }, [makeEmptyRow]);

  const loadValues = useCallback(async () => {
    if (!selectedList) return;
    if (hasLoadedInitialData.current) return;

    const currentRows = rowsRef.current;
    const hasData = currentRows.some((row) =>
      row.values.some((v) => v && v.trim()) || row.variations.some((v) => v && v.trim())
    );
    if (hasData) {
      hasLoadedInitialData.current = true;
      return;
    }

    try {
      let payload: EquivalentValuesPayload | null = null;
      if (initialValues && Array.isArray(initialValues.rows) && initialValues.rows.length > 0) {
        payload = initialValues;
      } else {
        payload = await getEquivalentListValues(selectedList.id);
      }

      const built: EquivalentValueRow[] = [];
      (payload?.rows || []).forEach((r, idx) => {
        const value1 = (r.value1 || '').trim();
        const value2 = (r.value2 || '').trim();
        const var1 = Array.isArray(r.variations1) ? r.variations1.filter(Boolean).join(', ') : (r.variations1 || '');
        const var2 = Array.isArray(r.variations2) ? r.variations2.filter(Boolean).join(', ') : (r.variations2 || '');
        if (!value1 && !value2 && !var1 && !var2) return;
        built.push({
          id: `eq-row-${Date.now()}-${idx}`,
          values: [value1, value2],
          variations: [String(var1), String(var2)],
        });
      });

      setRows(padToEmptyRows(built));
    } catch (error) {
      console.error('Error loading equivalent values:', error);
      if (rowsRef.current.length === 0) {
        setRows(padToEmptyRows([]));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedList?.id, initialValues, padToEmptyRows]);

  useEffect(() => {
    if (isOpen && selectedList && columnHeaders.length >= 2) {
      if (!hasLoadedInitialData.current) {
        loadValues();
        hasLoadedInitialData.current = true;
      }
    } else if (!isOpen) {
      hasLoadedInitialData.current = false;
      setEditingCell(null);
      setEditValue('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedList?.id, columnHeaders.length]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const handleAddRow = () => {
    setRows((prev) => [...prev, makeEmptyRow(prev.length)]);
  };

  const handleDeleteRow = (rowId: string) => {
    setRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  const handleCellClick = (rowId: string, colIndex: number, currentValue: string, isVariation = false) => {
    setEditingCell({ rowId, colIndex, isVariation });
    setEditValue(currentValue);
  };

  const commitEditingCell = () => {
    if (!editingCell) return;
    const value = editValue;
    const cell = editingCell;
    setRows((prev) => prev.map((row) => {
      if (row.id !== cell.rowId) return row;
      if (cell.isVariation) {
        const newVariations = [...row.variations];
        newVariations[cell.colIndex] = value;
        return { ...row, variations: newVariations };
      }
      const newValues = [...row.values];
      newValues[cell.colIndex] = value;
      return { ...row, values: newValues };
    }));
  };

  const handleCellBlur = () => {
    commitEditingCell();
    setEditingCell(null);
    setEditValue('');
  };

  const switchToCell = (rowId: string, colIndex: number, currentValue: string, isVariation = false) => {
    if (editingCell) {
      commitEditingCell();
      setEditingCell(null);
      setEditValue('');
    }
    setTimeout(() => handleCellClick(rowId, colIndex, currentValue, isVariation), 0);
  };

  const handlePaste = (e: React.ClipboardEvent, startRowId: string, startColIndex: number, isVariation = false) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    const lines = pasteData.split(/\r?\n/).filter((line) => line.trim() || line.includes('\t'));
    if (lines.length === 0) return;

    const current = rowsRef.current;
    const startRowIndex = current.findIndex((r) => r.id === startRowId);
    if (startRowIndex === -1) return;

    const applyLine = (row: EquivalentValueRow, line: string): EquivalentValueRow => {
      const cells = line.split('\t');
      const newValues = [...row.values];
      const newVariations = [...row.variations];
      cells.forEach((cell, colOffset) => {
        const target = startColIndex + colOffset;
        if (target < 0 || target >= columnHeaders.length) return;
        if (isVariation) {
          newVariations[target] = cell.trim();
        } else {
          newValues[target] = cell.trim();
        }
      });
      return { ...row, values: newValues, variations: newVariations };
    };

    const newRows = current.map((row, rowIndex) => {
      if (rowIndex < startRowIndex) return row;
      const lineIndex = rowIndex - startRowIndex;
      if (lineIndex >= lines.length) return row;
      return applyLine(row, lines[lineIndex]);
    });

    if (startRowIndex + lines.length > current.length) {
      for (let i = current.length; i < startRowIndex + lines.length; i++) {
        const line = lines[i - startRowIndex];
        newRows.push(applyLine(makeEmptyRow(i), line));
      }
    }

    setRows(newRows);
    setEditingCell(null);
    setEditValue('');
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, rowId: string, colIndex: number, isVariation = false) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEditingCell();
      const idx = rowsRef.current.findIndex((r) => r.id === rowId);
      if (idx >= 0 && idx < rowsRef.current.length - 1) {
        const nextRow = rowsRef.current[idx + 1];
        const nextVal = isVariation ? nextRow.variations[colIndex] : nextRow.values[colIndex];
        setEditingCell({ rowId: nextRow.id, colIndex, isVariation });
        setEditValue(nextVal || '');
      } else {
        setEditingCell(null);
        setEditValue('');
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleSortColumn = (colIndex: number, direction: 'asc' | 'desc') => {
    const withValues: EquivalentValueRow[] = [];
    const without: EquivalentValueRow[] = [];
    rowsRef.current.forEach((row) => {
      if ((row.values[colIndex] || '').trim().length > 0) withValues.push(row);
      else without.push(row);
    });
    withValues.sort((a, b) => {
      const av = (a.values[colIndex] || '').trim().toLowerCase();
      const bv = (b.values[colIndex] || '').trim().toLowerCase();
      return direction === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    setRows([...withValues, ...without]);
  };

  const handleCsvUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split('\n').filter((line) => line.trim());
        if (lines.length < 2) {
          alert('CSV must contain at least a header row and one data row');
          return;
        }
        const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
        // Expected columns: value1, value1 variations, value2, value2 variations
        const expected = [columnHeaders[0], variationColumnHeaders[0], columnHeaders[1], variationColumnHeaders[1]];
        if (headers.length !== expected.length || !headers.every((h, i) => h === expected[i])) {
          alert(`CSV headers must match column names in order: ${expected.join(', ')}`);
          return;
        }
        const built: EquivalentValueRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const cells: string[] = [];
          let cur = '';
          let inQuotes = false;
          for (let j = 0; j < line.length; j++) {
            const ch = line[j];
            if (ch === '"') inQuotes = !inQuotes;
            else if (ch === ',' && !inQuotes) {
              cells.push(cur.trim().replace(/^"|"$/g, ''));
              cur = '';
            } else cur += ch;
          }
          cells.push(cur.trim().replace(/^"|"$/g, ''));
          built.push({
            id: `eq-row-${Date.now()}-${i}`,
            values: [cells[0] || '', cells[2] || ''],
            variations: [cells[1] || '', cells[3] || ''],
          });
        }
        setRows(padToEmptyRows(built));
        setIsCsvUploadOpen(false);
        alert(`Successfully loaded ${built.length} rows from CSV`);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        alert('Error parsing CSV file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const handleSave = () => {
    const payloadRows: EquivalentValueRowPayload[] = [];
    rowsRef.current.forEach((row) => {
      const value1 = (row.values[0] || '').trim();
      const value2 = (row.values[1] || '').trim();
      const variations1 = (row.variations[0] || '').split(',').map((v) => v.trim()).filter(Boolean);
      const variations2 = (row.variations[1] || '').split(',').map((v) => v.trim()).filter(Boolean);
      if (!value1 && !value2) return;
      payloadRows.push({ value1, variations1, value2, variations2 });
    });

    onSave({ rows: payloadRows });

    const totalRows = payloadRows.length;
    if (totalRows > 0) {
      alert(`Equivalent values saved locally (${totalRows} row${totalRows !== 1 ? 's' : ''}). Click "Save Changes" on the metadata panel to save to Neo4j.`);
    }
    setTimeout(() => onClose(), 100);
  };

  if (!isOpen || !selectedList || columnHeaders.length < 2) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]" onClick={onClose}>
      <div
        className="bg-ag-dark-surface rounded-lg border border-ag-dark-border w-[95vw] h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ag-dark-border">
          <h2 className="text-xl font-semibold text-ag-dark-text">
            Equivalent List Values: {selectedList.list}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCsvUploadOpen(true)}
              className="p-2 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded hover:bg-ag-dark-bg"
              title="Upload CSV"
            >
              <Upload className="w-5 h-5" />
            </button>
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
              <div className="flex items-center justify-between p-4 border-b border-ag-dark-border sticky top-0 bg-ag-dark-surface">
                <h2 className="text-lg font-semibold text-ag-dark-text">Upload Equivalent List Values</h2>
                <button
                  onClick={() => setIsCsvUploadOpen(false)}
                  className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-ag-dark-accent">CSV FORMAT</h3>
                  <div className="bg-ag-dark-bg rounded-lg border border-ag-dark-border overflow-hidden">
                    {[columnHeaders[0], variationColumnHeaders[0], columnHeaders[1], variationColumnHeaders[1]].map((header, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between px-4 py-3 border-b border-ag-dark-border last:border-b-0"
                      >
                        <span className="text-sm text-ag-dark-text-secondary">Column {index + 1}</span>
                        <span className="text-sm font-medium text-red-400">{header} *</span>
                      </div>
                    ))}
                  </div>
                </div>
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
                        <p className="text-sm font-medium text-ag-dark-text">Drop your CSV file here</p>
                        <p className="text-xs text-ag-dark-text-secondary">or click to browse</p>
                      </div>
                      <label className="inline-flex items-center gap-2 px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors cursor-pointer">
                        <Upload className="w-4 h-4" />
                        UPLOAD CSV
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleCsvUpload(file);
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-ag-dark-text-secondary space-y-1">
                  <p>• First row should contain column headers</p>
                  <p>• Column headers must match, in order: {[columnHeaders[0], variationColumnHeaders[0], columnHeaders[1], variationColumnHeaders[1]].join(', ')}</p>
                  <p>• Each subsequent row pairs an "{columnHeaders[0]}" value with an "{columnHeaders[1]}" value</p>
                  <p>• Variations can be comma-separated within a cell</p>
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
            if (editingCell) {
              e.preventDefault();
              handlePaste(e, editingCell.rowId, editingCell.colIndex, editingCell.isVariation || false);
            }
          }}
        >
          <div className="border border-ag-dark-border rounded">
            {/* Table Header */}
            <div className="sticky top-0 bg-ag-dark-bg border-b border-ag-dark-border z-10">
              <div className="grid gap-2 p-2" style={{ gridTemplateColumns: `40px repeat(${columnHeaders.length * 2}, 250px) auto` }}>
                <div className="text-xs font-medium text-ag-dark-text-secondary"></div>
                {columnHeaders.map((header, index) => (
                  <React.Fragment key={index}>
                    <div className="flex items-center justify-between text-xs font-medium text-ag-dark-text-secondary text-left">
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
                    <div className="flex items-center justify-between text-xs font-medium text-ag-dark-text-secondary text-left">
                      <span>{variationColumnHeaders[index]}</span>
                    </div>
                  </React.Fragment>
                ))}
                <div className="text-xs font-medium text-ag-dark-text-secondary"></div>
              </div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-ag-dark-border">
              {rows.map((row, rowIndex) => (
                <div
                  key={row.id}
                  className="grid gap-2 p-2 hover:bg-ag-dark-bg/50"
                  style={{ gridTemplateColumns: `40px repeat(${columnHeaders.length * 2}, 250px) auto` }}
                >
                  <div className="flex items-center text-xs text-ag-dark-text-secondary">{rowIndex + 1}</div>
                  {columnHeaders.map((_, colIndex) => (
                    <React.Fragment key={colIndex}>
                      {/* Value Column */}
                      <div className="flex items-center">
                        {editingCell?.rowId === row.id && editingCell?.colIndex === colIndex && !editingCell?.isVariation ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={(e) => handleCellKeyDown(e, row.id, colIndex, false)}
                            onPaste={(e) => handlePaste(e, row.id, colIndex, false)}
                            autoFocus
                            className="w-full px-2 py-1 bg-ag-dark-bg border border-ag-dark-accent rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent text-left"
                          />
                        ) : (
                          <div
                            onClick={() => switchToCell(row.id, colIndex, row.values[colIndex] || '', false)}
                            className="w-full px-2 py-1 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text cursor-text hover:border-ag-dark-accent min-h-[32px] flex items-center text-left"
                            tabIndex={0}
                          >
                            {row.values[colIndex] || <span className="text-ag-dark-text-secondary opacity-0">Click to edit</span>}
                          </div>
                        )}
                      </div>
                      {/* Variation Column */}
                      <div className="flex items-center">
                        {editingCell?.rowId === row.id && editingCell?.colIndex === colIndex && editingCell?.isVariation ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={(e) => handleCellKeyDown(e, row.id, colIndex, true)}
                            onPaste={(e) => handlePaste(e, row.id, colIndex, true)}
                            autoFocus
                            className="w-full px-2 py-1 bg-ag-dark-bg border border-ag-dark-accent rounded text-sm text-ag-dark-text focus:ring-1 focus:ring-ag-dark-accent text-left"
                          />
                        ) : (
                          <div
                            onClick={() => switchToCell(row.id, colIndex, row.variations[colIndex] || '', true)}
                            className="w-full px-2 py-1 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text cursor-text hover:border-ag-dark-accent min-h-[32px] flex items-center text-left"
                            tabIndex={0}
                          >
                            {row.variations[colIndex] || <span className="text-ag-dark-text-secondary opacity-0">Click to edit</span>}
                          </div>
                        )}
                      </div>
                    </React.Fragment>
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
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-ag-dark-border">
          <button
            onClick={handleAddRow}
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
