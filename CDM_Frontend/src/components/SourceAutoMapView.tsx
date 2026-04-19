import React, { useCallback, useMemo, useState } from 'react';
import { ArrowUpDown, ChevronLeft, Plus, Upload } from 'lucide-react';
import type { SourceAutoMapResponse, SourceAutoMapRow } from '../hooks/useSources';
import { VariablesCustomSortModal } from './VariablesCustomSortModal';
import { SourceAutoMapRowMetadataPanel } from './SourceAutoMapRowMetadataPanel';

interface SortRule {
  id: string;
  column: string;
  sortOn: string;
  order: 'asc' | 'desc';
}

const SORT_COLUMN_KEYS = [
  'source_schema_table',
  'source_schema_column',
  'target_schema_table',
  'target_schema_column',
  'being',
  'avatar',
  'object',
  'part',
  'section',
  'group',
  'variable',
  'format_vi',
  'format_vii',
  'validations',
] as const;

const AUTO_MAP_SORT_COLUMNS: Array<{ key: string; title: string; sortable: boolean; filterable: boolean; width: string }> = [
  { key: 'source_schema_table', title: 'Source Table', sortable: true, filterable: false, width: '140px' },
  { key: 'source_schema_column', title: 'Source Column', sortable: true, filterable: false, width: '140px' },
  { key: 'target_schema_table', title: 'Source Table', sortable: true, filterable: false, width: '140px' },
  { key: 'target_schema_column', title: 'Source Column', sortable: true, filterable: false, width: '140px' },
  { key: 'being', title: 'Being', sortable: true, filterable: false, width: '120px' },
  { key: 'avatar', title: 'Avatar', sortable: true, filterable: false, width: '120px' },
  { key: 'object', title: 'Object', sortable: true, filterable: false, width: '120px' },
  { key: 'part', title: 'Part', sortable: true, filterable: false, width: '100px' },
  { key: 'section', title: 'Section', sortable: true, filterable: false, width: '120px' },
  { key: 'group', title: 'Group', sortable: true, filterable: false, width: '120px' },
  { key: 'variable', title: 'Variable', sortable: true, filterable: false, width: '140px' },
  { key: 'format_vi', title: 'Format VI', sortable: true, filterable: false, width: '110px' },
  { key: 'format_vii', title: 'Format VII', sortable: true, filterable: false, width: '110px' },
  { key: 'validations', title: 'Validations', sortable: true, filterable: false, width: '180px' },
];

const TD_BASE =
  'h-11 max-h-11 border-r border-ag-dark-border/40 px-2 align-middle overflow-hidden text-ellipsis whitespace-nowrap';

function CellText({ value }: { value: string }) {
  const v = value || '';
  return (
    <span className="block min-w-0 truncate" title={v}>
      {v}
    </span>
  );
}

function applyCustomSortRules(data: SourceAutoMapRow[], rules: SortRule[]): SourceAutoMapRow[] {
  const valid = rules.filter((r) => r.column);
  if (!valid.length) return [...data];
  const out = [...data];
  out.sort((a, b) => {
    for (const rule of valid) {
      const av = String((a as unknown as Record<string, string>)[rule.column] ?? '');
      const bv = String((b as unknown as Record<string, string>)[rule.column] ?? '');
      let cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
      if (rule.order === 'desc') cmp = -cmp;
      if (cmp !== 0) return cmp;
    }
    return (a.match_group_index - b.match_group_index) || (a.pair_index - b.pair_index);
  });
  return out;
}

function applyCanonicalOrder(data: SourceAutoMapRow[]): SourceAutoMapRow[] {
  return [...data].sort(
    (a, b) => (a.match_group_index - b.match_group_index) || (a.pair_index - b.pair_index)
  );
}

export interface SourceAutoMapViewProps {
  session: SourceAutoMapResponse;
  onBack: () => void;
}

export const SourceAutoMapView: React.FC<SourceAutoMapViewProps> = ({ session, onBack }) => {
  const [selectedRow, setSelectedRow] = useState<SourceAutoMapRow | null>(null);
  const [isCustomSortOpen, setIsCustomSortOpen] = useState(false);
  const [customSortRules, setCustomSortRules] = useState<SortRule[]>([]);
  const [isCustomSortActive, setIsCustomSortActive] = useState(false);
  const [canonicalOrderOn, setCanonicalOrderOn] = useState(true);

  const baseRows = useMemo(() => session.rows || [], [session.rows]);

  const displayedRows = useMemo(() => {
    if (isCustomSortActive && customSortRules.length > 0) {
      return applyCustomSortRules(baseRows, customSortRules);
    }
    if (canonicalOrderOn) {
      return applyCanonicalOrder(baseRows);
    }
    return [...baseRows];
  }, [baseRows, canonicalOrderOn, customSortRules, isCustomSortActive]);

  const handleCustomSortApply = useCallback((rules: SortRule[], _isDefault: boolean) => {
    const valid = rules.filter((r) => r.column);
    setCustomSortRules(valid);
    setIsCustomSortActive(valid.length > 0);
    if (valid.length === 0) {
      setCanonicalOrderOn(true);
    } else {
      setCanonicalOrderOn(false);
    }
    setIsCustomSortOpen(false);
  }, []);

  const handleToggleCanonicalOrder = useCallback(() => {
    setCanonicalOrderOn((prev) => {
      const next = !prev;
      if (next) {
        setCustomSortRules([]);
        setIsCustomSortActive(false);
      }
      return next;
    });
  }, []);

  const sourceBanner = `Source: ${session.source_name}`;
  const targetBanner = `Target: ${session.target_name}`;

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-ag-dark-border rounded bg-ag-dark-bg text-sm font-medium text-ag-dark-text hover:bg-ag-dark-surface transition-colors min-w-[120px]"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <button
          type="button"
          disabled
          title="Not available in Auto Map view"
          className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-ag-dark-border rounded bg-ag-dark-bg text-sm font-medium text-ag-dark-text-secondary opacity-50 cursor-not-allowed min-w-[140px]"
        >
          <Upload className="w-4 h-4" />
          Upload CSV
        </button>
        <button
          type="button"
          disabled
          title="Not available in Auto Map view"
          className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-ag-dark-border rounded bg-ag-dark-bg text-sm font-medium text-ag-dark-text-secondary opacity-50 cursor-not-allowed min-w-[120px]"
        >
          <Plus className="w-4 h-4" />
          Add Row
        </button>
        <button
          type="button"
          onClick={() => setIsCustomSortOpen(true)}
          className={`inline-flex items-center justify-center gap-2 px-3 py-2 border rounded text-sm font-medium transition-colors min-w-[140px] ${
            isCustomSortActive
              ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10 text-ag-dark-accent'
              : 'border-ag-dark-border bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface'
          }`}
        >
          <ArrowUpDown className="w-4 h-4" />
          Custom Sort
          {isCustomSortActive && (
            <span className="ml-1 text-xs bg-ag-dark-accent text-white px-1.5 py-0.5 rounded">Active</span>
          )}
        </button>
        <button
          type="button"
          onClick={handleToggleCanonicalOrder}
          className={`inline-flex items-center justify-center gap-2 px-3 py-2 border rounded text-sm font-medium transition-colors min-w-[140px] ${
            canonicalOrderOn
              ? 'border-ag-dark-accent bg-ag-dark-accent bg-opacity-10 text-ag-dark-accent'
              : 'border-ag-dark-border bg-ag-dark-bg text-ag-dark-text hover:bg-ag-dark-surface'
          }`}
          title="Sort by match groups (matched pairs first, then source-only and target-only rows)"
        >
          <ArrowUpDown className="w-4 h-4" />
          Default Sort
          {canonicalOrderOn && (
            <span className="ml-1 text-xs bg-ag-dark-accent text-white px-1.5 py-0.5 rounded">Active</span>
          )}
        </button>
      </div>

      <div className="relative flex-1 min-h-0 min-w-0 flex flex-col">
        <div className="flex flex-col min-h-0 flex-1 overflow-hidden rounded-lg border border-ag-dark-border bg-ag-dark-surface">
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full table-fixed border-collapse text-sm text-ag-dark-text min-w-0">
              <colgroup>
                {Array.from({ length: 14 }).map((_, i) => (
                  <col key={i} style={{ width: `${100 / 14}%` }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-[15] bg-ag-dark-bg border-b border-ag-dark-border shadow-sm">
                <tr className="border-b border-ag-dark-border/80">
                  <th
                    colSpan={2}
                    className="px-2 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-ag-dark-text bg-ag-dark-bg border-r border-ag-dark-border/60"
                  >
                    {sourceBanner}
                  </th>
                  <th
                    colSpan={2}
                    className="px-2 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-ag-dark-text bg-ag-dark-bg border-r border-ag-dark-border/60"
                  >
                    {targetBanner}
                  </th>
                  <th
                    colSpan={10}
                    className="px-2 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-ag-dark-text-secondary bg-ag-dark-bg"
                  >
                    LDM
                  </th>
                </tr>
                <tr className="text-xs font-medium text-ag-dark-text-secondary">
                  <th className="border border-ag-dark-border bg-ag-dark-surface px-2 py-2 text-left">Source Table</th>
                  <th className="border border-ag-dark-border bg-ag-dark-surface px-2 py-2 text-left border-r border-ag-dark-border">
                    Source Column
                  </th>
                  <th className="border border-ag-dark-border bg-ag-dark-surface px-2 py-2 text-left">Source Table</th>
                  <th className="border border-ag-dark-border bg-ag-dark-surface px-2 py-2 text-left border-r border-ag-dark-border">
                    Source Column
                  </th>
                  <th className="border border-ag-dark-border bg-ag-dark-surface px-2 py-2 text-left">Being</th>
                  <th className="border border-ag-dark-border bg-ag-dark-surface px-2 py-2 text-left">Avatar</th>
                  <th className="border border-ag-dark-border bg-ag-dark-surface px-2 py-2 text-left">Object</th>
                  <th className="border border-ag-dark-border bg-ag-dark-surface px-2 py-2 text-left">Part</th>
                  <th className="border border-ag-dark-border bg-ag-dark-surface px-2 py-2 text-left">Section</th>
                  <th className="border border-ag-dark-border bg-ag-dark-surface px-2 py-2 text-left">Group</th>
                  <th className="border border-ag-dark-border bg-ag-dark-surface px-2 py-2 text-left">Variable</th>
                  <th className="border border-ag-dark-border bg-ag-dark-surface px-2 py-2 text-left">Format VI</th>
                  <th className="border border-ag-dark-border bg-ag-dark-surface px-2 py-2 text-left">Format VII</th>
                  <th className="border border-ag-dark-border bg-ag-dark-surface px-2 py-2 text-left">Validations</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-12 text-center text-ag-dark-text-secondary">
                      No LDM rows are available for Auto Map. Add LDM rows on one or both sources, then run Auto Map
                      again.
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((row) => {
                    const isUnmatched =
                      row.map_row_kind === 'unmatched_source' || row.map_row_kind === 'unmatched_target';
                    const isMappedPair =
                      row.map_row_kind === 'primary' || row.map_row_kind === 'extra';
                    const isSel = selectedRow?.id === row.id;

                    let rowTone =
                      'cursor-pointer border-b border-ag-dark-border/60 text-ag-dark-text transition-colors ';
                    if (isSel) {
                      rowTone += 'bg-ag-dark-accent/25';
                    } else if (isMappedPair) {
                      rowTone += 'bg-teal-950/45 border-l-[3px] border-l-teal-400/50 ';
                    } else if (isUnmatched) {
                      rowTone += 'bg-ag-dark-bg/50 ';
                    } else {
                      rowTone += 'bg-ag-dark-surface ';
                    }
                    if (!isSel) {
                      rowTone += 'hover:bg-ag-dark-bg/45 ';
                    }

                    return (
                      <tr
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedRow(row)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedRow(row);
                          }
                        }}
                        className={rowTone}
                      >
                        <td className={`${TD_BASE} text-ag-dark-text`}>
                          <CellText value={row.source_schema_table} />
                        </td>
                        <td className={`${TD_BASE} text-ag-dark-text border-r border-ag-dark-border`}>
                          <CellText value={row.source_schema_column} />
                        </td>
                        <td className={`${TD_BASE} text-ag-dark-text`}>
                          <CellText value={row.target_schema_table} />
                        </td>
                        <td className={`${TD_BASE} text-ag-dark-text border-r border-ag-dark-border`}>
                          <CellText value={row.target_schema_column} />
                        </td>
                        <td className={TD_BASE}>
                          <CellText value={row.being} />
                        </td>
                        <td className={TD_BASE}>
                          <CellText value={row.avatar} />
                        </td>
                        <td className={TD_BASE}>
                          <span
                            className="block min-w-0 truncate font-bold text-yellow-400 text-base leading-tight"
                            title={row.object}
                          >
                            {row.object}
                          </span>
                        </td>
                        <td className={TD_BASE}>
                          <CellText value={row.part} />
                        </td>
                        <td className={TD_BASE}>
                          <CellText value={row.section} />
                        </td>
                        <td className={TD_BASE}>
                          <CellText value={row.group} />
                        </td>
                        <td className={TD_BASE}>
                          <span
                            className="block min-w-0 truncate font-bold text-green-400 text-base leading-tight"
                            title={row.variable}
                          >
                            {row.variable}
                          </span>
                        </td>
                        <td className={TD_BASE}>
                          <CellText value={row.format_vi} />
                        </td>
                        <td className={TD_BASE}>
                          <CellText value={row.format_vii} />
                        </td>
                        <td className={`${TD_BASE} border-r-0`}>
                          <CellText value={row.validations} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedRow && (
          <div
            className="absolute inset-y-0 right-0 z-20 flex min-w-[22rem] max-w-[40rem] pointer-events-none"
            style={{ width: 'clamp(22rem, 33vw, 36rem)' }}
          >
            <div className="pointer-events-auto flex h-full min-h-0 w-full flex-col pl-2">
              <SourceAutoMapRowMetadataPanel
                row={selectedRow}
                sourceSystemName={session.source_name}
                targetSystemName={session.target_name}
                onClose={() => setSelectedRow(null)}
              />
            </div>
          </div>
        )}
      </div>

      <VariablesCustomSortModal
        key={isCustomSortOpen ? 'auto-map-sort-open' : 'auto-map-sort-closed'}
        isOpen={isCustomSortOpen}
        onClose={() => setIsCustomSortOpen(false)}
        onApplySort={handleCustomSortApply}
        columns={AUTO_MAP_SORT_COLUMNS}
        currentSortRules={customSortRules}
        isDefaultOrderEnabled={false}
        hideInstructions
        hideDefaultOrderToggle
        hierarchyColumnKeysForDefaultOrder={[]}
        driverColumnKeys={[]}
        allowedCustomSortColumnKeys={[...SORT_COLUMN_KEYS]}
        sortTargetLabel="Auto Map rows"
      />
    </div>
  );
};
