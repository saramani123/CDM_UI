import React, { useState, useEffect } from 'react';
import { X, Upload, Save, Plus, Trash2, ArrowUpAZ, ArrowDownZA } from 'lucide-react';
import { ListData } from '../data/listsData';
import { ListCsvUploadModal } from './ListCsvUploadModal';
import { apiService } from '../services/api';

export type SingleListValuesModalVariant = 'persist' | 'draft';

export interface SingleListDraftRow {
  value: string;
  variation: string;
}

interface SingleListValuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Required for Neo4j sync mode; may be null in draft mode. */
  selectedList: ListData | null;
  /** After a successful Neo4j sync — refresh list detail in the parent. */
  onAfterSync?: () => void | Promise<void>;
  /** `draft` = add-list flow (no API); `persist` = edit existing list (default). */
  variant?: SingleListValuesModalVariant;
  /** List name shown in title / column header when `variant` is `draft`. */
  draftTitle?: string;
  /** Seed rows when opening the draft modal (value + optional variation per row). */
  draftInitialRows?: SingleListDraftRow[];
  /** Called when user saves in draft mode with deduped rows. */
  onDraftSave?: (rows: SingleListDraftRow[]) => void;
}

interface ListValueRow {
  id: string;
  value: string;
  variation: string;
}

const MIN_ROWS = 100;

function padRows(data: ListValueRow[]): ListValueRow[] {
  const rows = [...data];
  let i = 0;
  while (rows.length < MIN_ROWS) {
    rows.push({
      id: `row-empty-${Date.now()}-${i++}`,
      value: '',
      variation: ''
    });
  }
  return rows;
}

export const SingleListValuesModal: React.FC<SingleListValuesModalProps> = ({
  isOpen,
  onClose,
  selectedList,
  onAfterSync,
  variant = 'persist',
  draftTitle,
  draftInitialRows,
  onDraftSave
}) => {
  const isDraft = variant === 'draft';
  const [listValueRows, setListValueRows] = useState<ListValueRow[]>([]);
  const [isCsvUploadOpen, setIsCsvUploadOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{ rowId: string; isVariation?: boolean } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setListValueRows([]);
      setEditingCell(null);
      setEditValue('');
      setLoadError(null);
      setIsLoadingList(false);
      return;
    }
    if (isDraft) {
      setLoadError(null);
      setIsLoadingList(false);
      const rows: ListValueRow[] = (draftInitialRows || [])
        .filter(r => (r.value || '').trim())
        .map((r, idx) => ({
          id: `draft-${idx}-${Date.now()}`,
          value: String(r.value || '').trim(),
          variation: String(r.variation || '').trim()
        }));
      setListValueRows(padRows(rows));
      return;
    }
    if (!selectedList?.id) return;

    let cancelled = false;
    (async () => {
      setIsLoadingList(true);
      setLoadError(null);
      try {
        const detail: any = await apiService.getList(selectedList.id);
        if (cancelled) return;
        const rows: ListValueRow[] = [];
        const lvals = detail.listValuesList || [];
        const varMap: Record<string, string[]> = detail.listValueVariations || {};
        lvals.forEach((lv: any, idx: number) => {
          const value = (lv.value || '').trim() ? String(lv.value) : '';
          if (!value) return;
          const arr = varMap[value] || [];
          const variationText = Array.isArray(arr) ? arr.join(', ') : '';
          rows.push({
            id: lv.id ? String(lv.id) : `row-${idx}-${Date.now()}`,
            value,
            variation: variationText
          });
        });
        setListValueRows(padRows(rows));
      } catch (e: any) {
        if (!cancelled) {
          setLoadError(e?.message || 'Failed to load list values');
          setListValueRows(padRows([]));
        }
      } finally {
        if (!cancelled) setIsLoadingList(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, isDraft, selectedList?.id, JSON.stringify(draftInitialRows || [])]);

  const handleAddRow = (index?: number) => {
    const newRow: ListValueRow = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
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
      const currentEditValue = editValue;
      const currentEditingCell = editingCell;
      setListValueRows(prev =>
        prev.map(row =>
          row.id === currentEditingCell.rowId
            ? currentEditingCell.isVariation
              ? { ...row, variation: currentEditValue }
              : { ...row, value: currentEditValue }
            : row
        )
      );
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, rowId: string, isVariation: boolean = false) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingCell) {
        setListValueRows(prev =>
          prev.map(row =>
            row.id === editingCell.rowId
              ? editingCell.isVariation
                ? { ...row, variation: editValue }
                : { ...row, value: editValue }
              : row
          )
        );
      }
      const currentRowIndex = listValueRows.findIndex(r => r.id === rowId);
      if (currentRowIndex < listValueRows.length - 1) {
        const nextRow = listValueRows[currentRowIndex + 1];
        setEditingCell({ rowId: nextRow.id, isVariation });
        setEditValue(isVariation ? nextRow.variation || '' : nextRow.value || '');
      } else {
        const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        setListValueRows(prev => [...prev, { id: newId, value: '', variation: '' }]);
        setEditingCell({ rowId: newId, isVariation });
        setEditValue('');
      }
    } else if (e.key === 'Escape') {
      if (editingCell) {
        setListValueRows(prev =>
          prev.map(row =>
            row.id === editingCell.rowId
              ? editingCell.isVariation
                ? { ...row, variation: editValue }
                : { ...row, value: editValue }
              : row
          )
        );
      }
      setEditingCell(null);
      setEditValue('');
    }
  };

  const mergeImportedRows = (
    imported: { value: string; variation?: string }[]
  ) => {
    const map = new Map<string, { value: string; variation: string }>();
    const order: string[] = [];
    const add = (value: string, variation: string) => {
      const v = value.trim();
      if (!v) return;
      const k = v.toLowerCase();
      if (map.has(k)) return;
      map.set(k, { value: v, variation: (variation || '').trim() });
      order.push(k);
    };
    listValueRows.forEach(row => add(row.value, row.variation));
    imported.forEach(row => add(row.value, row.variation || ''));
    const dataRows = order.map((k, i) => {
      const item = map.get(k)!;
      return {
        id: `row-${Date.now()}-${i}`,
        value: item.value,
        variation: item.variation
      };
    });
    setListValueRows(padRows(dataRows));
    setIsCsvUploadOpen(false);
  };

  const buildOrderedRowsForSave = (): { value: string; variation: string }[] => {
    const ordered: { value: string; variation: string }[] = [];
    const seen = new Set<string>();
    for (const row of listValueRows) {
      const v = row.value.trim();
      if (!v) continue;
      const k = v.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      ordered.push({ value: v, variation: row.variation.trim() });
    }
    return ordered;
  };

  const handleSave = async () => {
    if (saving) return;

    const badRows: number[] = [];
    listValueRows.forEach((row, index) => {
      if (row.variation.trim() && !row.value.trim()) {
        badRows.push(index + 1);
      }
    });
    if (badRows.length > 0) {
      alert(
        `Cannot save: row(s) ${badRows.join(', ')} have a List Value Variation but no List Value. Enter a value or clear the variation.`
      );
      return;
    }

    const rawCount = listValueRows.filter(r => r.value.trim()).length;
    const ordered = buildOrderedRowsForSave();
    if (rawCount > ordered.length) {
      setListValueRows(padRows(
        ordered.map((item, i) => ({
          id: `row-${Date.now()}-${i}`,
          value: item.value,
          variation: item.variation
        }))
      ));
    }

    if (isDraft) {
      if (!onDraftSave) return;
      onDraftSave(ordered);
      onClose();
      return;
    }

    if (!selectedList?.id) return;

    setSaving(true);
    try {
      await apiService.syncSingleListValues(selectedList.id, {
        rows: ordered.map(r => ({ value: r.value, variation: r.variation || '' }))
      });
      await onAfterSync?.();
      onClose();
    } catch (e: any) {
      const msg =
        e?.message ||
        (typeof e === 'string' ? e : '') ||
        'Failed to save list values. Please try again.';
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSortColumn = (direction: 'asc' | 'desc') => {
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
    const sortedRowsWithValues = [...rowsWithValues].sort((a, b) => {
      const aValue = (a.value || '').trim().toLowerCase();
      const bValue = (b.value || '').trim().toLowerCase();
      if (direction === 'asc') {
        return aValue.localeCompare(bValue);
      }
      return bValue.localeCompare(aValue);
    });
    setListValueRows([...sortedRowsWithValues, ...rowsWithoutValues]);
  };

  const handlePaste = (e: React.ClipboardEvent, startRowId: string) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
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

    if (startRowIndex + lines.length > rows.length) {
      const additionalRows: ListValueRow[] = [];
      for (let i = rows.length; i < startRowIndex + lines.length; i++) {
        const lineIndex = i - startRowIndex;
        const value = lines[lineIndex] ? lines[lineIndex].trim() : '';
        additionalRows.push({
          id: `row-${Date.now()}-${i}`,
          value,
          variation: ''
        });
      }
      setListValueRows([...newRows, ...additionalRows]);
    } else {
      setListValueRows(newRows);
    }
    setEditingCell(null);
    setEditValue('');
  };

  if (!isOpen) return null;
  if (!isDraft && !selectedList?.id) return null;
  if (isDraft && !onDraftSave) return null;

  const listName =
    (isDraft ? draftTitle || selectedList?.list : selectedList?.list) || 'List';

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]"
        onClick={onClose}
      >
        <div
          className="bg-ag-dark-surface rounded-lg border border-ag-dark-border w-[50vw] max-w-[600px] h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-ag-dark-border flex-shrink-0">
            <h3 className="text-lg font-semibold text-ag-dark-text">List Values: {listName}</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCsvUploadOpen(true)}
                disabled={!isDraft && (isLoadingList || !!loadError)}
                className="p-2 text-ag-dark-text-secondary hover:text-ag-dark-accent hover:bg-ag-dark-bg rounded transition-colors disabled:opacity-40"
                title="Upload CSV"
              >
                <Upload className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {isLoadingList && (
              <div className="text-sm text-ag-dark-text-secondary py-8 text-center">Loading list values…</div>
            )}
            {loadError && !isLoadingList && (
              <div className="text-sm text-ag-dark-error py-4">{loadError}</div>
            )}
            {!isLoadingList && !loadError && (
              <div className="min-w-full">
                <div className="grid grid-cols-[50px_1fr_1fr_80px] gap-2 mb-2 pb-2 border-b border-ag-dark-border sticky top-0 bg-ag-dark-surface z-10">
                  <div className="text-sm font-medium text-ag-dark-text-secondary">#</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ag-dark-text">{listName}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSortColumn('asc')}
                        className="p-1 text-ag-dark-text-secondary hover:text-ag-dark-accent transition-colors rounded"
                        title="Sort A-Z"
                      >
                        <ArrowUpAZ className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
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

                <div className="space-y-1">
                  {listValueRows.map((row, index) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[50px_1fr_1fr_80px] gap-2 items-center p-2 hover:bg-ag-dark-bg rounded"
                    >
                      <div className="text-sm text-ag-dark-text-secondary">{index + 1}</div>

                      <div
                        className="min-h-[32px] px-2 py-1 bg-ag-dark-bg border border-ag-dark-border rounded cursor-text focus-within:border-ag-dark-accent focus-within:ring-1 focus-within:ring-ag-dark-accent"
                        onClick={e => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (editingCell && editingCell.rowId !== row.id) {
                            const currentEditValue = editValue;
                            const currentEditingCell = editingCell;
                            setListValueRows(prev =>
                              prev.map(r =>
                                r.id === currentEditingCell.rowId
                                  ? currentEditingCell.isVariation
                                    ? { ...r, variation: currentEditValue }
                                    : { ...r, value: currentEditValue }
                                  : r
                              )
                            );
                          }
                          handleCellClick(row.id, row.value);
                        }}
                        onMouseDown={e => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        onPaste={e => {
                          e.stopPropagation();
                          handlePaste(e, row.id);
                        }}
                      >
                        {editingCell?.rowId === row.id && !editingCell?.isVariation ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={e => handleCellChange(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={e => handleCellKeyDown(e, row.id, false)}
                            onPaste={e => {
                              e.stopPropagation();
                              handlePaste(e, row.id);
                            }}
                            className="w-full bg-transparent text-ag-dark-text outline-none"
                            autoFocus
                            onClick={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                          />
                        ) : (
                          <div className="min-h-[20px] text-ag-dark-text">
                            {row.value || (
                              <span className="text-ag-dark-text-secondary italic">Click to edit</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div
                        className="min-h-[32px] px-2 py-1 bg-ag-dark-bg border border-ag-dark-border rounded cursor-text focus-within:border-ag-dark-accent focus-within:ring-1 focus-within:ring-ag-dark-accent"
                        onClick={e => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (editingCell && editingCell.rowId !== row.id) {
                            const currentEditValue = editValue;
                            const currentEditingCell = editingCell;
                            setListValueRows(prev =>
                              prev.map(r =>
                                r.id === currentEditingCell.rowId
                                  ? currentEditingCell.isVariation
                                    ? { ...r, variation: currentEditValue }
                                    : { ...r, value: currentEditValue }
                                  : r
                              )
                            );
                          }
                          handleCellClick(row.id, row.variation, true);
                        }}
                        onMouseDown={e => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                      >
                        {editingCell?.rowId === row.id && editingCell?.isVariation ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={e => handleCellChange(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={e => handleCellKeyDown(e, row.id, true)}
                            className="w-full bg-transparent text-ag-dark-text outline-none"
                            autoFocus
                            onClick={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                          />
                        ) : (
                          <div className="min-h-[20px] text-ag-dark-text">
                            {row.variation || (
                              <span className="text-ag-dark-text-secondary italic">Click to edit</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-center">
                        <button
                          type="button"
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
            )}
          </div>

          <div className="flex items-center justify-between p-4 border-t border-ag-dark-border flex-shrink-0">
            <button
              type="button"
              onClick={() => handleAddRow()}
              disabled={!isDraft && (isLoadingList || !!loadError)}
              className="px-4 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-surface transition-colors flex items-center gap-2 disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
              Add Row
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text hover:bg-ag-dark-bg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || (!isDraft && (isLoadingList || !!loadError))}
                className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : isDraft ? 'Apply' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ListCsvUploadModal
        isOpen={isCsvUploadOpen}
        onClose={() => setIsCsvUploadOpen(false)}
        type="list-values"
        onUpload={(data: any[]) => {
          mergeImportedRows(
            data.map((d: any) => ({
              value: String(d.value || '').trim(),
              variation: d.variation != null ? String(d.variation) : ''
            }))
          );
        }}
      />
    </>
  );
};
