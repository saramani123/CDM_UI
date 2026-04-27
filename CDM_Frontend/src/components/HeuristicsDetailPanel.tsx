import React, { useEffect, useMemo, useState } from 'react';
import { Grid2X2, Save } from 'lucide-react';
import { HeuristicsData } from '../hooks/useHeuristics';
import { apiService } from '../services/api';
import { useDrivers } from '../hooks/useDrivers';
import { HeuristicsDetailModal, HeuroColumnDef, HeuroRuleRow } from './HeuristicsDetailModal';

interface HeuristicsDetailPanelProps {
  heuristicsItem: HeuristicsData | null;
  onSave: () => void;
  onClose?: () => void;
  onUnsavedChange?: (hasUnsaved: boolean) => void;
}

function buildColumns(prefix: 'if' | 'then', labels: string[]): HeuroColumnDef[] {
  return labels.map((label, idx) => ({ id: `${prefix}_${idx + 1}`, label: label.trim(), order: idx + 1 }));
}

function parseDetailDataForUi(raw: any): { ifColumns: HeuroColumnDef[]; thenColumns: HeuroColumnDef[]; rows: HeuroRuleRow[] } {
  if (!raw) return { ifColumns: [], thenColumns: [], rows: [] };

  let detail = raw;
  if (typeof detail === 'string') {
    try {
      detail = JSON.parse(detail);
    } catch {
      return { ifColumns: [], thenColumns: [], rows: [] };
    }
  }

  if (!detail || typeof detail !== 'object') return { ifColumns: [], thenColumns: [], rows: [] };

  const ifColumns = Array.isArray((detail as any).ifColumns) ? (detail as any).ifColumns : [];
  const thenColumns = Array.isArray((detail as any).thenColumns) ? (detail as any).thenColumns : [];
  const rawRows = Array.isArray((detail as any).rows)
    ? (detail as any).rows
    : Array.isArray((detail as any).rules)
      ? (detail as any).rules
      : [];

  const rows: HeuroRuleRow[] = rawRows.map((r: any) => {
    const ifMap: Record<string, string> =
      typeof r?.if === 'object' && r.if
        ? r.if
        : r?.if_condition
          ? { [String(r.if_condition)]: String(r.if_value || '') }
          : {};
    return {
      id: String(r?.id || `rule_${crypto.randomUUID()}`),
      if: ifMap,
      then: typeof r?.then === 'object' && r.then ? r.then : {},
    };
  });

  return { ifColumns, thenColumns, rows };
}

export const HeuristicsDetailPanel: React.FC<HeuristicsDetailPanelProps> = ({
  heuristicsItem,
  onSave,
  onUnsavedChange,
}) => {
  const { drivers: driversData, loading: driversLoading } = useDrivers();

  const [sector, setSector] = useState('ALL');
  const [domain, setDomain] = useState('ALL');
  const [country, setCountry] = useState('ALL');
  const [agent, setAgent] = useState('');
  const [procedure, setProcedure] = useState('');
  const [isHeuro, setIsHeuro] = useState(true);
  const [documentation, setDocumentation] = useState('');

  const [savedDefinition, setSavedDefinition] = useState<{ ifColumns: HeuroColumnDef[]; thenColumns: HeuroColumnDef[] }>({
    ifColumns: [],
    thenColumns: [],
  });
  const [savedRows, setSavedRows] = useState<HeuroRuleRow[]>([]);
  const [localDefinition, setLocalDefinition] = useState<{ ifColumns: HeuroColumnDef[]; thenColumns: HeuroColumnDef[] }>({
    ifColumns: [],
    thenColumns: [],
  });
  const [localRows, setLocalRows] = useState<HeuroRuleRow[]>([]);
  const [hiddenIfColumns, setHiddenIfColumns] = useState<HeuroColumnDef[]>([]);
  const [hiddenThenColumns, setHiddenThenColumns] = useState<HeuroColumnDef[]>([]);

  const [legacyNotice, setLegacyNotice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGridOpen, setIsGridOpen] = useState(false);
  const [pendingSaveConfirm, setPendingSaveConfirm] = useState<{
    title: string;
    body: string;
    deletedIfIds: string[];
    deletedThenIds: string[];
  } | null>(null);

  const sectorOptions = ['ALL', ...(driversData?.sectors || []).filter((s) => s !== 'ALL' && s !== 'All')];
  const domainOptions = ['ALL', ...(driversData?.domains || []).filter((d) => d !== 'ALL' && d !== 'All')];
  const countryOptions = ['ALL', ...(driversData?.countries || []).filter((c) => c !== 'ALL' && c !== 'All')];

  const ifColumns = localDefinition.ifColumns;
  const thenColumns = localDefinition.thenColumns;

  const normalizedSavedDefinition = useMemo(
    () => ({
      ifColumns: savedDefinition.ifColumns.map((c) => ({ id: c.id, label: c.label.trim(), order: c.order })),
      thenColumns: savedDefinition.thenColumns.map((c) => ({ id: c.id, label: c.label.trim(), order: c.order })),
    }),
    [savedDefinition]
  );
  const normalizedLocalDefinition = useMemo(
    () => ({
      ifColumns: localDefinition.ifColumns.map((c) => ({ id: c.id, label: c.label.trim(), order: c.order })),
      thenColumns: localDefinition.thenColumns.map((c) => ({ id: c.id, label: c.label.trim(), order: c.order })),
    }),
    [localDefinition]
  );
  const normalizeRowsForCompare = (rows: HeuroRuleRow[]) =>
    rows
      .map((r) => ({
        id: r.id,
        if: Object.keys(r.if || {})
          .sort()
          .reduce((acc, key) => ({ ...acc, [key]: String(r.if?.[key] || '').trim() }), {}),
        then: Object.keys(r.then || {})
          .sort()
          .reduce((acc, key) => ({ ...acc, [key]: String(r.then[key] || '').trim() }), {}),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  const hasUnsavedChanges = useMemo(() => {
    return (
      JSON.stringify(normalizedSavedDefinition) !== JSON.stringify(normalizedLocalDefinition) ||
      JSON.stringify(normalizeRowsForCompare(savedRows)) !== JSON.stringify(normalizeRowsForCompare(localRows))
    );
  }, [normalizedSavedDefinition, normalizedLocalDefinition, savedRows, localRows]);

  const isDefinitionValid = useMemo(() => {
    const ifLabels = ifColumns.map((c) => c.label.trim());
    const thenLabels = thenColumns.map((c) => c.label.trim());
    if (ifLabels.length === 0 || thenLabels.length === 0) return false;
    if (ifLabels.some((v) => !v) || thenLabels.some((v) => !v)) return false;
    if (new Set(ifLabels.map((v) => v.toLowerCase())).size !== ifLabels.length) return false;
    if (new Set(thenLabels.map((v) => v.toLowerCase())).size !== thenLabels.length) return false;
    return true;
  }, [ifColumns, thenColumns]);

  useEffect(() => {
    if (!heuristicsItem) return;
    setSector(heuristicsItem.sector || 'ALL');
    setDomain(heuristicsItem.domain || 'ALL');
    setCountry(heuristicsItem.country || 'ALL');
    setAgent(heuristicsItem.agent || '');
    setProcedure(heuristicsItem.procedure || '');
    setIsHeuro(heuristicsItem.is_heuro !== false);
    setDocumentation(heuristicsItem.documentation ?? '');
    loadHeuristic();
  }, [heuristicsItem?.id]);

  const loadHeuristic = async () => {
    if (!heuristicsItem) return;
    setIsLoading(true);
    setError(null);
    try {
      const item: any = await apiService.getHeuristicItem(heuristicsItem.id);
      setIsHeuro(item.is_heuro !== false);
      setDocumentation(item.documentation ?? '');
      setLegacyNotice(Boolean(item.has_legacy_detail_data));

      const parsedFromTopLevel = {
        ifColumns: Array.isArray(item.ifColumns) ? item.ifColumns : [],
        thenColumns: Array.isArray(item.thenColumns) ? item.thenColumns : [],
        rows: Array.isArray(item.rules)
          ? item.rules.map((r: any) => ({
              id: String(r.id || `rule_${crypto.randomUUID()}`),
              if:
                typeof r.if === 'object' && r.if
                  ? r.if
                  : r.if_condition
                    ? { [String(r.if_condition)]: String(r.if_value || '') }
                    : {},
              then: typeof r.then === 'object' && r.then ? r.then : {},
            }))
          : [],
      };
      const parsedFromDetail = parseDetailDataForUi(item.detailData);

      const loadedIf: HeuroColumnDef[] =
        parsedFromTopLevel.ifColumns.length > 0 ? parsedFromTopLevel.ifColumns : parsedFromDetail.ifColumns;
      const loadedThen: HeuroColumnDef[] =
        parsedFromTopLevel.thenColumns.length > 0 ? parsedFromTopLevel.thenColumns : parsedFromDetail.thenColumns;
      const loadedRules: HeuroRuleRow[] =
        parsedFromTopLevel.rows.length > 0 ? parsedFromTopLevel.rows : parsedFromDetail.rows;

      const safeIf = loadedIf.length > 0 ? loadedIf : [{ id: 'if_1', label: '', order: 1 }];
      const safeThen = loadedThen.length > 0 ? loadedThen : [{ id: 'then_1', label: '', order: 1 }];
      const definition = { ifColumns: safeIf, thenColumns: safeThen };

      setSavedDefinition(definition);
      setSavedRows(loadedRules);
      setLocalDefinition(definition);
      setLocalRows(loadedRules);
      setHiddenIfColumns([]);
      setHiddenThenColumns([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load heuristic detail');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!heuristicsItem) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges, heuristicsItem]);

  useEffect(() => {
    onUnsavedChange?.(hasUnsavedChanges);
    return () => onUnsavedChange?.(false);
  }, [hasUnsavedChanges, onUnsavedChange]);

  const updateLabelAt = (kind: 'if' | 'then', idx: number, value: string) => {
    setLocalDefinition((prev) => {
      const key = kind === 'if' ? 'ifColumns' : 'thenColumns';
      const cols = [...prev[key]];
      if (!cols[idx]) return prev;
      cols[idx] = { ...cols[idx], label: value };
      return { ...prev, [key]: cols };
    });
  };

  const setCountWithSafety = (kind: 'if' | 'then', nextCount: number) => {
    setError(null);
    const max = kind === 'if' ? 10 : 4;
    const next = Math.min(max, Math.max(1, nextCount));
    const key = kind === 'if' ? 'ifColumns' : 'thenColumns';

    const currentCols = [...localDefinition[key]];
    const hiddenCols = kind === 'if' ? [...hiddenIfColumns] : [...hiddenThenColumns];
    const currentCount = currentCols.length;

    if (next === currentCount) return;

    if (next < currentCount) {
      const removed = currentCols.slice(next);
      const kept = currentCols.slice(0, next);
      setLocalDefinition((prev) => ({ ...prev, [key]: kept }));
      if (kind === 'if') setHiddenIfColumns((prev) => [...removed, ...prev]);
      else setHiddenThenColumns((prev) => [...removed, ...prev]);
      return;
    }

    const needed = next - currentCount;
    const restored = hiddenCols.slice(0, needed);
    const remainingHidden = hiddenCols.slice(restored.length);

    const maxOrder = [...currentCols, ...restored, ...(kind === 'if' ? hiddenIfColumns : hiddenThenColumns)]
      .map((c) => c.order || 0)
      .reduce((a, b) => Math.max(a, b), 0);

    const created: HeuroColumnDef[] = [];
    for (let i = 1; i <= needed - restored.length; i++) {
      const order = maxOrder + i;
      created.push({
        id: `${kind}_${order}`,
        label: '',
        order,
      });
    }

    setLocalDefinition((prev) => ({ ...prev, [key]: [...currentCols, ...restored, ...created] }));
    if (kind === 'if') setHiddenIfColumns(remainingHidden);
    else setHiddenThenColumns(remainingHidden);
  };

  const validateDefinition = (): boolean => {
    const trimmedIf = ifColumns.map((c) => c.label.trim());
    const trimmedThen = thenColumns.map((c) => c.label.trim());
    if (trimmedIf.some((v) => !v)) {
      setError('Please fill in all IF condition fields before saving.');
      return false;
    }
    if (trimmedThen.some((v) => !v)) {
      setError('Please fill in all output fields before saving.');
      return false;
    }
    if (new Set(trimmedIf.map((x) => x.toLowerCase())).size !== trimmedIf.length) {
      setError('IF labels must be unique.');
      return false;
    }
    if (new Set(trimmedThen.map((x) => x.toLowerCase())).size !== trimmedThen.length) {
      setError('THEN labels must be unique.');
      return false;
    }
    return true;
  };

  const getDefinitionReduction = () => {
    const savedIfIds = savedDefinition.ifColumns.map((c) => c.id);
    const localIfIds = localDefinition.ifColumns.map((c) => c.id);
    const deletedIfIds = savedIfIds.filter((id) => !localIfIds.includes(id));
    const savedThenIds = savedDefinition.thenColumns.map((c) => c.id);
    const localThenIds = localDefinition.thenColumns.map((c) => c.id);
    const deletedThenIds = savedThenIds.filter((id) => !localThenIds.includes(id));
    return { deletedIfIds, deletedThenIds };
  };

  const persistPanel = async (deletedIfIds: string[], deletedThenIds: string[]) => {
    if (!heuristicsItem) return;
    if (!validateDefinition()) return;
    setIsSaving(true);
    setError(null);
    try {
      if (!isHeuro) {
        if (!documentation.trim()) {
          setError('Documentation is required when Is HEURO is FALSE.');
          return;
        }
        await apiService.updateHeuristicItem(heuristicsItem.id, {
          sector,
          domain,
          country,
          agent,
          procedure,
          is_heuro: false,
          documentation,
        });
      } else {
        const activeThenIds = new Set(localDefinition.thenColumns.map((c) => c.id));
        const activeIfIds = new Set(localDefinition.ifColumns.map((c) => c.id));
        let rowsToPersist = [...localRows];
        if (deletedIfIds.length > 0) {
          rowsToPersist = rowsToPersist.map((r) => ({
            ...r,
            if: Object.fromEntries(
              Object.entries(r.if || {}).filter(([k]) => activeIfIds.has(k))
            ),
          }));
        }
        rowsToPersist = rowsToPersist.map((r) => {
          const keptThen = Object.fromEntries(
            Object.entries(r.then || {}).filter(([k]) => activeThenIds.has(k))
          );
          for (const c of localDefinition.thenColumns) {
            if (!(c.id in keptThen)) keptThen[c.id] = '';
          }
          return {
            ...r,
            if: Object.fromEntries(
              localDefinition.ifColumns.map((c) => [c.id, String(r.if?.[c.id] || '')])
            ),
            then: keptThen,
          };
        });

        const detailData = {
          schemaVersion: 2,
          ifColumns: localDefinition.ifColumns.map((c) => ({ ...c, label: c.label.trim() })),
          thenColumns: localDefinition.thenColumns.map((c) => ({ ...c, label: c.label.trim() })),
          rows: rowsToPersist,
        };

        await apiService.updateHeuristicItem(heuristicsItem.id, {
          sector,
          domain,
          country,
          agent,
          procedure,
          is_heuro: true,
          detailData: JSON.stringify(detailData),
        });

        setLocalRows(rowsToPersist);
      }

      await onSave();
      await loadHeuristic();
      setPendingSaveConfirm(null);
      if (deletedThenIds.length > 0) {
        setHiddenThenColumns([]);
      }
      if (deletedIfIds.length > 0) {
        setHiddenIfColumns([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save heuristic detail');
    } finally {
      setIsSaving(false);
    }
  };

  const saveConfig = async () => {
    if (!heuristicsItem) return;
    const { deletedIfIds, deletedThenIds } = getDefinitionReduction();

    if ((deletedIfIds.length > 0 || deletedThenIds.length > 0) && isHeuro) {
      const removedIfLabels = savedDefinition.ifColumns
        .filter((c) => deletedIfIds.includes(c.id))
        .map((c) => c.label || c.id);
      const removedThenLabels = savedDefinition.thenColumns
        .filter((c) => deletedThenIds.includes(c.id))
        .map((c) => c.label || c.id);
      const ifReductionText =
        deletedIfIds.length > 0
          ? `You are reducing from ${savedDefinition.ifColumns.length} to ${localDefinition.ifColumns.length} IF conditions. This will permanently delete condition ${removedIfLabels.join(', ')} and all rule rows that use ${removedIfLabels.length > 1 ? 'them' : 'it'}.`
          : '';
      const thenReductionText =
        deletedThenIds.length > 0
          ? `You are reducing from ${savedDefinition.thenColumns.length} to ${localDefinition.thenColumns.length} THEN outputs. This will permanently delete output column ${removedThenLabels.join(', ')} from saved rules.`
          : '';
      setPendingSaveConfirm({
        title: deletedIfIds.length > 0 ? 'Remove heuristic conditions?' : 'Remove heuristic outputs?',
        body: `${ifReductionText}${ifReductionText && thenReductionText ? ' ' : ''}${thenReductionText} This cannot be undone after saving.`,
        deletedIfIds,
        deletedThenIds,
      });
      return;
    }

    await persistPanel([], []);
  };

  const saveRowsFromModal = async (rows: HeuroRuleRow[]) => {
    setLocalRows(rows);
  };

  if (!heuristicsItem) return null;

  return (
    <div className="bg-ag-dark-surface border-l border-ag-dark-border rounded-lg h-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-ag-dark-border flex-shrink-0">
        <h3 className="text-lg font-semibold text-ag-dark-text mb-4">Heuristics Detail</h3>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs text-ag-dark-text-secondary mb-1">Sector</label>
            <select value={sector} onChange={(e) => setSector(e.target.value)} disabled={isSaving || driversLoading} className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text">
              {sectorOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ag-dark-text-secondary mb-1">Domain</label>
            <select value={domain} onChange={(e) => setDomain(e.target.value)} disabled={isSaving || driversLoading} className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text">
              {domainOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ag-dark-text-secondary mb-1">Country</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)} disabled={isSaving || driversLoading} className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text">
              {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-ag-dark-text-secondary mb-1">Agent</label>
            <input value={agent} onChange={(e) => setAgent(e.target.value)} className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text" />
          </div>
          <div>
            <label className="block text-xs text-ag-dark-text-secondary mb-1">Procedure</label>
            <input value={procedure} onChange={(e) => setProcedure(e.target.value)} className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text" />
          </div>
          <div>
            <label className="block text-xs text-ag-dark-text-secondary mb-1">Is HEURO</label>
            <button type="button" role="switch" aria-checked={isHeuro} onClick={() => setIsHeuro((v) => !v)} className={`relative inline-flex h-6 w-11 items-center rounded-full ${isHeuro ? 'bg-ag-dark-accent' : 'bg-ag-dark-border'}`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${isHeuro ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 py-4 pb-6 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="text-ag-dark-text-secondary">Loading...</div>
        ) : !isHeuro ? (
          <div className="flex flex-col gap-2 h-full">
            <label className="text-sm font-medium text-ag-dark-text">Documentation</label>
            <textarea value={documentation} onChange={(e) => setDocumentation(e.target.value)} className="w-full flex-1 min-h-[220px] px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text" />
          </div>
        ) : (
          <>
            {legacyNotice && (
              <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500 rounded text-yellow-300 text-sm">
                This agent has legacy rule data that cannot be displayed. Please re-enter rules using the new format.
              </div>
            )}

            <div className="mb-4 flex items-center justify-between">
              <div className="font-semibold text-ag-dark-text">HEURISTICS <span className="text-xs font-normal text-ag-dark-text-secondary">({localRows.length} rules)</span></div>
              <button
                type="button"
                onClick={() => setIsGridOpen(true)}
                disabled={!isDefinitionValid || legacyNotice}
                title={!isDefinitionValid ? 'Complete IF/THEN fields first' : ''}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded text-sm ${!isDefinitionValid || legacyNotice ? 'bg-ag-dark-border text-ag-dark-text-secondary cursor-not-allowed' : 'bg-ag-dark-accent text-white hover:bg-ag-dark-accent-hover'}`}
              >
                <Grid2X2 className="w-4 h-4" />
                Grid
              </button>
            </div>

            <div className="mb-4">
              <div className="font-semibold text-ag-dark-text">IF</div>
              <div className="text-xs text-ag-dark-text-secondary mb-2">Define the heuristic conditions the LLM will evaluate</div>
              <div className="flex items-center gap-3 mb-2">
                <label className="text-sm font-medium text-ag-dark-text">Number of heuristics</label>
                <select value={ifColumns.length} onChange={(e) => setCountWithSafety('if', Number(e.target.value))} className="w-28 px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                {ifColumns.map((col, i) => (
                  <div key={col.id} className="flex items-center gap-2">
                    <span className="text-sm text-ag-dark-text-secondary w-5">{i + 1}.</span>
                    <input value={col.label || ''} onChange={(e) => updateLabelAt('if', i, e.target.value)} className="flex-1 px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="font-semibold text-ag-dark-text">THEN</div>
              <div className="text-xs text-ag-dark-text-secondary mb-2">Define the output values the LLM will select</div>
              <div className="flex items-center gap-3 mb-2">
                <label className="text-sm font-medium text-ag-dark-text">Number of outputs</label>
                <select value={thenColumns.length} onChange={(e) => setCountWithSafety('then', Number(e.target.value))} className="w-28 px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text">
                  {Array.from({ length: 4 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                {thenColumns.map((col, i) => (
                  <div key={col.id} className="flex items-center gap-2">
                    <span className="text-sm text-ag-dark-text-secondary w-5">{i + 1}.</span>
                    <input value={col.label || ''} onChange={(e) => updateLabelAt('then', i, e.target.value)} className="flex-1 px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text" />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {error && <div className="mt-3 p-3 bg-red-900/20 border border-red-500 rounded text-red-400 text-sm">{error}</div>}
      </div>

      <div className="px-6 py-4 border-t border-ag-dark-border flex-shrink-0 bg-ag-dark-surface">
        {hasUnsavedChanges && (
          <div className="mb-2 text-xs text-yellow-300">Unsaved changes</div>
        )}
        <button onClick={saveConfig} disabled={isSaving || isLoading} className="w-full bg-ag-dark-accent text-white py-2 px-4 rounded flex items-center justify-center gap-2">
          <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <HeuristicsDetailModal
        isOpen={isGridOpen}
        onClose={() => setIsGridOpen(false)}
        agentName={agent || heuristicsItem.agent || ''}
        ifColumns={ifColumns}
        thenColumns={thenColumns}
        rows={localRows}
        onSave={saveRowsFromModal}
      />
      {pendingSaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-[560px] max-w-[90vw] rounded-lg border border-ag-dark-border bg-ag-dark-surface p-5">
            <div className="text-lg font-semibold text-ag-dark-text mb-2">{pendingSaveConfirm.title}</div>
            <div className="text-sm text-ag-dark-text-secondary mb-4">{pendingSaveConfirm.body}</div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingSaveConfirm(null)}
                className="px-3 py-2 rounded border border-ag-dark-border text-ag-dark-text"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => persistPanel(pendingSaveConfirm.deletedIfIds, pendingSaveConfirm.deletedThenIds)}
                className="px-3 py-2 rounded bg-ag-dark-accent text-white"
              >
                Confirm and Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
