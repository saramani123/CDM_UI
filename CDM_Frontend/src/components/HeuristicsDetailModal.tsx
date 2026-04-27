import React, { useState } from 'react';
import { Save, X } from 'lucide-react';

export interface HeuroColumnDef {
  id: string;
  label: string;
  order: number;
}

export interface HeuroRuleRow {
  id: string;
  if: Record<string, string>;
  then: Record<string, string>;
}

interface HeuristicsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  ifColumns: HeuroColumnDef[];
  thenColumns: HeuroColumnDef[];
  rows: HeuroRuleRow[];
  onSave: (rows: HeuroRuleRow[]) => Promise<void>;
}

function mkEmptyRow(ifColumns: HeuroColumnDef[], thenColumns: HeuroColumnDef[]): HeuroRuleRow {
  const ifVals: Record<string, string> = {};
  const then: Record<string, string> = {};
  for (const c of ifColumns) ifVals[c.id] = '';
  for (const c of thenColumns) then[c.id] = '';
  return {
    id: `rule_${crypto.randomUUID()}`,
    if: ifVals,
    then,
  };
}

export const HeuristicsDetailModal: React.FC<HeuristicsDetailModalProps> = ({
  isOpen,
  onClose,
  agentName,
  ifColumns,
  thenColumns,
  rows,
  onSave,
}) => {
  const [draftRows, setDraftRows] = useState<HeuroRuleRow[]>(
    rows.length > 0 ? rows : Array.from({ length: 10 }, () => mkEmptyRow(ifColumns, thenColumns))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setDraftRows(
        rows.length > 0 ? rows : Array.from({ length: 10 }, () => mkEmptyRow(ifColumns, thenColumns))
      );
      setErrors({});
    }
  }, [isOpen, rows, ifColumns, thenColumns]);

  if (!isOpen) return null;

  const addRow = () => setDraftRows((prev) => [...prev, mkEmptyRow(ifColumns, thenColumns)]);

  const updateThen = (idx: number, thenId: string, value: string) => {
    setDraftRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, then: { ...r.then, [thenId]: value } } : r))
    );
  };

  const updateIf = (idx: number, ifId: string, value: string) => {
    setDraftRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, if: { ...r.if, [ifId]: value } } : r))
    );
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startRow: number, startCol: number) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    if (!text) return;
    const parsed = text
      .split(/\r?\n/)
      .filter((l) => l.length > 0)
      .map((l) => l.split('\t'));
    if (!parsed.length) return;

    const totalCols = thenColumns.length + ifColumns.length; // THEN cols + IF cols
    setDraftRows((prev) => {
      const next = [...prev];
      while (next.length < startRow + parsed.length) {
        next.push(mkEmptyRow(ifColumns, thenColumns));
      }
      parsed.forEach((rowVals, rOff) => {
        const rIdx = startRow + rOff;
        rowVals.forEach((cell, cOff) => {
          const cIdx = startCol + cOff;
          if (cIdx >= totalCols) return;
          if (cIdx < thenColumns.length) {
            const thenId = thenColumns[cIdx].id;
            next[rIdx] = { ...next[rIdx], then: { ...next[rIdx].then, [thenId]: cell.trim() } };
          } else {
            const ifId = ifColumns[cIdx - thenColumns.length].id;
            next[rIdx] = { ...next[rIdx], if: { ...next[rIdx].if, [ifId]: cell.trim() } };
          }
        });
      });
      return next;
    });
  };

  const validateRows = (): { cleaned: HeuroRuleRow[]; rowErrors: Record<string, string> } => {
    const rowErrors: Record<string, string> = {};
    const cleaned: HeuroRuleRow[] = [];

    for (const row of draftRows) {
      const ifValues = ifColumns.map((c) => (row.if?.[c.id] || '').trim());
      const thenValues = thenColumns.map((c) => (row.then?.[c.id] || '').trim());
      const allIfBlank = ifValues.every((v) => !v);
      const allThenBlank = thenValues.every((v) => !v);
      const hasAtLeastOneIf = ifValues.some((v) => !!v);
      const allThenFilled = thenValues.every((v) => !!v);
      const allBlank = allIfBlank && allThenBlank;

      if (allBlank) continue;

      if (!hasAtLeastOneIf) {
        rowErrors[row.id] = 'At least one IF condition value must be filled';
        continue;
      }
      if (!allThenFilled) {
        rowErrors[row.id] = 'All output values must be filled';
        continue;
      }

      cleaned.push({
        id: row.id,
        if: Object.fromEntries(ifColumns.map((c) => [c.id, (row.if?.[c.id] || '').trim()])),
        then: Object.fromEntries(thenColumns.map((c) => [c.id, (row.then?.[c.id] || '').trim()])),
      });
    }

    return { cleaned, rowErrors };
  };

  const onSaveClick = async () => {
    const { cleaned, rowErrors } = validateRows();
    setErrors(rowErrors);
    if (Object.keys(rowErrors).length > 0) return;
    setSaving(true);
    try {
      await onSave(cleaned);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border p-6 w-[96vw] max-w-[1500px] max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-ag-dark-text">Heuristic Rules - {agentName}</h3>
          <button onClick={onClose} disabled={saving} className="text-ag-dark-text-secondary hover:text-ag-dark-text">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center justify-end mb-3">
          <button onClick={addRow} className="px-3 py-1 text-sm bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover">+ Add Row</button>
        </div>

        <div className="flex-1 overflow-auto border border-ag-dark-border rounded">
          <div className="min-w-[1100px]">
            <div className="grid" style={{ gridTemplateColumns: `40px repeat(${thenColumns.length}, minmax(160px,1fr)) repeat(${ifColumns.length}, minmax(160px,1fr))` }}>
              <div className="p-2 border-b border-ag-dark-border bg-ag-dark-bg" />
              <div className="p-2 border-b border-ag-dark-border bg-ag-dark-bg text-center font-semibold text-ag-dark-text" style={{ gridColumn: `span ${thenColumns.length}` }}>THEN</div>
              <div className="p-2 border-b border-ag-dark-border bg-ag-dark-bg text-center font-semibold text-ag-dark-text" style={{ gridColumn: `span ${ifColumns.length}` }}>IF</div>

              <div className="p-2 border-b border-ag-dark-border bg-ag-dark-bg text-center text-ag-dark-text">#</div>
              {thenColumns.map((c) => (
                <div key={c.id} className="p-2 border-b border-r border-ag-dark-border bg-ag-dark-bg text-sm font-medium text-ag-dark-text">{c.label}</div>
              ))}
              {ifColumns.map((c) => (
                <div key={c.id} className="p-2 border-b border-r border-ag-dark-border bg-ag-dark-bg text-sm font-medium text-ag-dark-text">{c.label}</div>
              ))}

              {draftRows.map((row, idx) => (
                <React.Fragment key={row.id}>
                  <div className="p-2 border-b border-r border-ag-dark-border text-center text-ag-dark-text-secondary">{idx + 1}</div>
                  {thenColumns.map((c, ci) => (
                    <input
                      key={`${row.id}-${c.id}`}
                      value={row.then?.[c.id] || ''}
                      onChange={(e) => updateThen(idx, c.id, e.target.value)}
                      onPaste={(e) => handlePaste(e, idx, ci)}
                      className="p-2 border-b border-r border-ag-dark-border bg-ag-dark-surface text-ag-dark-text outline-none focus:ring-1 focus:ring-ag-dark-accent"
                    />
                  ))}
                  {ifColumns.map((c, ci) => (
                    <input
                      key={`${row.id}-${c.id}`}
                      value={row.if?.[c.id] || ''}
                      onChange={(e) => updateIf(idx, c.id, e.target.value)}
                      onPaste={(e) => handlePaste(e, idx, thenColumns.length + ci)}
                      className="p-2 border-b border-r border-ag-dark-border bg-ag-dark-surface text-ag-dark-text outline-none focus:ring-1 focus:ring-ag-dark-accent"
                    />
                  ))}
                  {errors[row.id] && (
                    <div className="col-span-full p-2 text-xs text-red-400 border-b border-ag-dark-border bg-red-900/10">Row {idx + 1}: {errors[row.id]}</div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 border border-ag-dark-border rounded text-ag-dark-text">Cancel</button>
          <button onClick={onSaveClick} disabled={saving} className="px-4 py-2 bg-ag-dark-accent text-white rounded flex items-center gap-2">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
