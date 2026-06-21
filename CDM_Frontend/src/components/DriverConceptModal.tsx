import React, { useEffect, useState } from 'react';
import { X, Save } from 'lucide-react';
import { apiService } from '../services/api';
import { useDrivers } from '../hooks/useDrivers';
import { ColumnType } from '../data/driversData';
import { loadDriverAbbreviationsFromBackend } from '../utils/driverAbbreviations';

interface DriverConceptModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Synthetic driver metadata row: { concept: 'Sector'|'Domain'|'Country', driverType, ... }
  metadataItem: any | null;
  // Called after a successful save so the parent can refresh the metadata grid.
  onSaved?: () => void | Promise<void>;
}

interface DriverRow {
  key: string; // stable React key
  originalName: string | null; // null = newly added row
  name: string;
  abbreviation: string;
}

const conceptToType = (concept: string): ColumnType | null => {
  switch ((concept || '').toLowerCase()) {
    case 'sector':
      return 'sectors';
    case 'domain':
      return 'domains';
    case 'country':
      return 'countries';
    default:
      return null;
  }
};

let rowKeySeq = 0;
const nextKey = () => `dr-${Date.now()}-${rowKeySeq++}`;

// Drivers behave like a "required" metadata concept: levels are fixed at 2 and the
// column names cannot be changed. The two columns are [<Concept>, "Abbreviation"].
const LEVELS = 2;

export const DriverConceptModal: React.FC<DriverConceptModalProps> = ({
  isOpen,
  onClose,
  metadataItem,
  onSaved,
}) => {
  const { deleteDriver, fetchDrivers } = useDrivers();

  const concept: string = metadataItem?.concept || '';
  const driverType: ColumnType | null =
    (metadataItem?.driverType as ColumnType) || conceptToType(concept);

  const columnNames = [concept, 'Abbreviation'];

  const [rows, setRows] = useState<DriverRow[]>([]);
  const [seededNames, setSeededNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed rows from the Neo4j-backed driver nodes (name + abbreviation) whenever opened.
  useEffect(() => {
    if (!isOpen || !driverType) return;
    let cancelled = false;
    setError(null);
    setIsLoading(true);
    apiService
      .getDriverDetails(driverType)
      .then((details: any) => {
        if (cancelled) return;
        const list = Array.isArray(details) ? details : [];
        const seeded = list.filter((d) => d && d.name && d.name !== 'ALL');
        const seededRows: DriverRow[] = seeded.map((d) => ({
          key: nextKey(),
          originalName: d.name,
          name: d.name,
          abbreviation: d.abbreviation || '',
        }));
        // Always show at least 10 rows by default (pad with empty editable rows).
        const padCount = Math.max(0, 10 - seededRows.length);
        const emptyRows: DriverRow[] = Array.from({ length: padCount }, () => ({
          key: nextKey(),
          originalName: null,
          name: '',
          abbreviation: '',
        }));
        setRows([...seededRows, ...emptyRows]);
        setSeededNames(seeded.map((d) => d.name));
      })
      .catch(() => {
        if (!cancelled) setError(`Failed to load ${concept} values.`);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, driverType]);

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIndex) return r;
        if (colIndex === 0) return { ...r, name: value };
        return { ...r, abbreviation: value };
      }),
    );
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, { key: nextKey(), originalName: null, name: '', abbreviation: '' }]);
  };

  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    startRowIndex: number,
    startColIndex: number,
  ) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    if (!pastedData) return;

    const lines = pastedData.split(/\r?\n/).filter((line) => line.trim() !== '');
    const parsed = lines.map((line) => line.split('\t').map((cell) => cell.trim()));
    if (parsed.length === 0) return;

    setRows((prev) => {
      const next = [...prev];
      parsed.forEach((pastedRow, rowOffset) => {
        const targetRow = startRowIndex + rowOffset;
        while (targetRow >= next.length) {
          next.push({ key: nextKey(), originalName: null, name: '', abbreviation: '' });
        }
        pastedRow.forEach((cellValue, colOffset) => {
          const targetCol = startColIndex + colOffset;
          if (targetCol === 0) next[targetRow] = { ...next[targetRow], name: cellValue };
          else if (targetCol === 1) next[targetRow] = { ...next[targetRow], abbreviation: cellValue };
        });
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (!driverType) return;

    const trimmed = rows.map((r) => ({
      ...r,
      name: r.name.trim(),
      abbreviation: r.abbreviation.trim(),
    }));

    // Rows whose value (first column) is empty are treated as removed.
    const kept = trimmed.filter((r) => r.name !== '');

    const lowerNames = kept.map((r) => r.name.toLowerCase());
    const dupe = lowerNames.find((n, i) => lowerNames.indexOf(n) !== i);
    if (dupe) {
      setError(`Duplicate value "${dupe}". Each ${concept} value must be unique.`);
      return;
    }

    const keptOriginalNames = new Set(
      kept.filter((r) => r.originalName).map((r) => r.originalName as string),
    );
    const deletions = seededNames.filter((n) => !keptOriginalNames.has(n));

    if (deletions.length > 0) {
      const confirmed = window.confirm(
        `This will delete the following ${concept} value(s):\n\n${deletions.join(', ')}\n\n` +
          `Any Objects, Variables, or Lists referencing them will have those references removed. Continue?`,
      );
      if (!confirmed) return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // 1) Deletions first.
      for (const name of deletions) {
        await deleteDriver(driverType, name);
      }

      // 2) Existing rows: rename and/or update abbreviation (both persisted to the node).
      for (const r of kept) {
        if (r.originalName) {
          await apiService.updateDriver(driverType, r.originalName, {
            name: r.name,
            abbreviation: r.abbreviation,
          });
        }
      }

      // 3) Additions (rows with no original name) carry their abbreviation on create.
      for (const r of kept) {
        if (!r.originalName) {
          await apiService.createDriver(driverType, {
            name: r.name,
            abbreviation: r.abbreviation,
          });
        }
      }

      // 4) Persist ordering (Neo4j order + localStorage so dropdowns/grids match).
      const orderedNames = kept.map((r) => r.name);
      try {
        await apiService.reorderDrivers(driverType, orderedNames);
      } catch (e) {
        console.warn('Failed to persist driver order to backend:', e);
      }
      try {
        localStorage.setItem(`cdm_drivers_order_${driverType}`, JSON.stringify(orderedNames));
      } catch (e) {
        console.warn('Failed to persist driver order to localStorage:', e);
      }

      // Refresh the global drivers cache + abbreviation cache so every dropdown/grid reflects changes.
      await fetchDrivers();
      await loadDriverAbbreviationsFromBackend();

      if (onSaved) {
        await onSaved();
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || `Failed to save ${concept} values.`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !metadataItem || !driverType) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6 w-full max-w-6xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div>
            <h3 className="text-xl font-semibold text-ag-dark-text">Metadata Detail</h3>
            <p className="text-sm text-ag-dark-text-secondary mt-1">
              Layer: <span className="font-medium">{metadataItem.layer || 'Drivers'}</span> | Concept:{' '}
              <span className="font-medium">{concept}</span>
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
        <div className="flex-1 overflow-y-auto mb-6 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-ag-dark-text-secondary">Loading...</div>
            </div>
          ) : (
            <>
              {/* Levels Radio Buttons (fixed at 2, not editable) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-ag-dark-text mb-3">
                  Levels <span className="text-ag-dark-error">*</span>
                  <span className="ml-2 text-xs text-ag-dark-text-secondary">(Required - cannot be changed)</span>
                </label>
                <div className="flex gap-6">
                  {[1, 2, 3, 4].map((level) => {
                    const isSelected = level === LEVELS;
                    return (
                      <label
                        key={level}
                        className={`flex items-center gap-2 ${!isSelected ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        <input
                          type="radio"
                          name="levels"
                          value={level}
                          checked={isSelected}
                          disabled
                          readOnly
                          className="w-5 h-5 text-ag-dark-accent focus:ring-ag-dark-accent"
                        />
                        <span className={`text-ag-dark-text ${!isSelected ? 'opacity-50' : ''}`}>{level}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Column Headers (fixed: <Concept> + Abbreviation) */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-ag-dark-text">
                    Column Names <span className="text-ag-dark-error">*</span>
                    <span className="ml-2 text-xs text-ag-dark-text-secondary">(Required - cannot be changed)</span>
                  </label>
                  <button
                    onClick={handleAddRow}
                    disabled={isSaving}
                    className="px-3 py-1 text-sm bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors disabled:opacity-50"
                  >
                    + Add Row
                  </button>
                </div>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${LEVELS}, 1fr)` }}>
                  {columnNames.map((name, index) => {
                    const matchesConcept = name.toLowerCase() === concept.toLowerCase();
                    return (
                      <div key={index}>
                        <input
                          type="text"
                          value={name}
                          disabled
                          readOnly
                          className={`w-full px-3 py-2 bg-ag-dark-bg border rounded text-ag-dark-text placeholder-ag-dark-text-secondary opacity-60 cursor-not-allowed ${
                            matchesConcept ? 'border-green-500' : 'border-ag-dark-border'
                          }`}
                        />
                        {matchesConcept && (
                          <p className="text-xs text-green-500 mt-1">✓ Matches Concept: "{concept}"</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Data Rows */}
              <div className="mb-4">
                <div className="border border-ag-dark-border rounded overflow-hidden">
                  {/* Header Row */}
                  <div
                    className="grid gap-2 p-2 bg-ag-dark-bg border-b border-ag-dark-border font-medium text-sm text-ag-dark-text"
                    style={{ gridTemplateColumns: `40px repeat(${LEVELS}, 1fr)` }}
                  >
                    <div className="text-center">#</div>
                    {columnNames.map((name, index) => (
                      <div key={index} className="px-2">
                        {name || `Column ${index + 1}`}
                      </div>
                    ))}
                  </div>

                  {/* Data Rows */}
                  <div className="max-h-[600px] overflow-y-auto overflow-x-visible" style={{ minHeight: '200px' }}>
                    {rows.length === 0 ? (
                      <div className="p-8 text-center text-ag-dark-text-secondary">
                        <p>No {concept} values yet.</p>
                        <p className="text-sm mt-2">Use "+ Add Row" to create one.</p>
                      </div>
                    ) : (
                      rows.map((row, rowIndex) => (
                        <div
                          key={row.key}
                          className="grid gap-2 p-2 border-b border-ag-dark-border hover:bg-ag-dark-bg/50"
                          style={{ gridTemplateColumns: `40px repeat(${LEVELS}, 1fr)` }}
                        >
                          <div className="flex items-center justify-center text-sm text-ag-dark-text-secondary">
                            {rowIndex + 1}
                          </div>
                          {[0, 1].map((colIndex) => (
                            <input
                              key={colIndex}
                              type="text"
                              value={colIndex === 0 ? row.name : row.abbreviation}
                              onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                              onPaste={(e) => handlePaste(e, rowIndex, colIndex)}
                              disabled={isSaving}
                              placeholder={
                                colIndex === 0
                                  ? `Enter ${concept} value`
                                  : 'Abbreviation (optional)'
                              }
                              className="px-2 py-1 bg-ag-dark-surface border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent"
                            />
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <p className="text-xs text-ag-dark-text-secondary mt-2">
                  These {concept} values are the single source of truth for the Object, Variable, and List
                  dropdowns. The optional Abbreviation is stored on the {concept} node and, when present, is
                  what the grids display. To remove a value, clear its {concept} cell and save.
                </p>
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

export default DriverConceptModal;
