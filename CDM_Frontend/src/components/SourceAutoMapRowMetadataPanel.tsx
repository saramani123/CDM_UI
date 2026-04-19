import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import type { SourceAutoMapRow } from '../hooks/useSources';

export interface SourceAutoMapRowMetadataPanelProps {
  row: SourceAutoMapRow | null;
  sourceSystemName: string;
  targetSystemName: string;
  onClose: () => void;
}

const inputReadonlyCls =
  'w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text opacity-90 cursor-default';

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block mb-1 text-xs text-ag-dark-text-secondary">{label}</label>
      <input type="text" readOnly className={inputReadonlyCls} value={value || '—'} title={value || ''} />
    </div>
  );
}

export const SourceAutoMapRowMetadataPanel: React.FC<SourceAutoMapRowMetadataPanelProps> = ({
  row,
  sourceSystemName,
  targetSystemName,
  onClose,
}) => {
  const panelTitle = useMemo(() => {
    if (!row) return 'Source − Target mapping';
    const parts = [
      [row.source_schema_table, row.source_schema_column].filter(Boolean).join(' ').trim(),
      [row.target_schema_table, row.target_schema_column].filter(Boolean).join(' ').trim(),
    ].filter(Boolean);
    if (parts.length === 0) return 'Source − Target mapping';
    if (parts.length === 1) return `${parts[0]} mapping`;
    return `${parts[0]} ↔ ${parts[1]} mapping`;
  }, [row]);

  if (!row) return null;

  return (
    <div className="flex flex-col h-full min-h-0 border border-ag-dark-border rounded-lg bg-ag-dark-surface shadow-sm">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-ag-dark-border flex-shrink-0">
        <h3 className="text-base font-semibold text-ag-dark-text leading-snug min-w-0">{panelTitle}</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded text-ag-dark-text-secondary hover:text-ag-dark-text hover:bg-ag-dark-bg transition-colors flex-shrink-0"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-ag-dark-border">
          <ReadonlyField label="Source system" value={sourceSystemName} />
          <ReadonlyField label="Target system" value={targetSystemName} />
        </div>

        <p className="text-xs font-semibold text-ag-dark-text-secondary uppercase tracking-wide">
          Source ({sourceSystemName})
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReadonlyField label="Source table" value={row.source_schema_table} />
          <ReadonlyField label="Source column" value={row.source_schema_column} />
        </div>

        <p className="text-xs font-semibold text-ag-dark-text-secondary uppercase tracking-wide pt-1">
          Target ({targetSystemName})
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReadonlyField label="Source table" value={row.target_schema_table} />
          <ReadonlyField label="Source column" value={row.target_schema_column} />
        </div>

        <div className="border-t border-ag-dark-border pt-4 space-y-3">
          <p className="text-xs font-semibold text-ag-dark-text-secondary uppercase tracking-wide">LDM</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReadonlyField label="Being" value={row.being} />
            <ReadonlyField label="Avatar" value={row.avatar} />
            <div className="md:col-span-2">
              <ReadonlyField label="Object" value={row.object} />
            </div>
            <ReadonlyField label="Part" value={row.part} />
            <ReadonlyField label="Section" value={row.section} />
            <ReadonlyField label="Group" value={row.group} />
            <ReadonlyField label="Variable" value={row.variable} />
            <ReadonlyField label="Format VI" value={row.format_vi} />
            <ReadonlyField label="Format VII" value={row.format_vii} />
            <div className="md:col-span-2">
              <label className="block mb-1 text-xs text-ag-dark-text-secondary">Validations</label>
              <textarea
                readOnly
                rows={3}
                className={`${inputReadonlyCls} resize-none min-h-[72px] placeholder:text-ag-dark-text-secondary`}
                value={row.validations || ''}
                placeholder="—"
                title={row.validations || ''}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
