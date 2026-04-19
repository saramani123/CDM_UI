import React, { useEffect, useRef, useState } from 'react';
import { Save, Settings, X, Table2 } from 'lucide-react';
import { apiService } from '../services/api';
import type { SourceDetail } from '../hooks/useSources';
import { useDrivers } from '../hooks/useDrivers';

interface SourceMetadataPanelProps {
  sourceId: string | null;
  onClose: () => void;
  onDetailLoaded: (detail: SourceDetail | null) => void;
  onViewLogicalDataModel: () => void;
  onCatalogRefresh: () => Promise<void>;
}

export const SourceMetadataPanel: React.FC<SourceMetadataPanelProps> = ({
  sourceId,
  onClose,
  onDetailLoaded,
  onViewLogicalDataModel,
  onCatalogRefresh,
}) => {
  const onDetailLoadedRef = useRef(onDetailLoaded);
  onDetailLoadedRef.current = onDetailLoaded;

  const { drivers: driversData, loading: driversLoading } = useDrivers();
  const [detail, setDetail] = useState<SourceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sector, setSector] = useState('');
  const [domain, setDomain] = useState('');
  const [country, setCountry] = useState('');
  const [name, setName] = useState('');
  /** When the grid used a synthetic `src-preset-*` id but the API stores a different id for the same source_key. */
  const [resolvedDetailId, setResolvedDetailId] = useState<string | null>(null);

  const sectors = driversData?.sectors || [];
  const domains = driversData?.domains || [];
  const countries = driversData?.countries || [];
  const sectorOptions = ['ALL', ...sectors.filter((s) => s !== 'ALL' && s !== 'All')];
  const domainOptions = ['ALL', ...domains.filter((d) => d !== 'ALL' && d !== 'All')];
  const countryOptions = ['ALL', ...countries.filter((c) => c !== 'ALL' && c !== 'All')];

  useEffect(() => {
    setResolvedDetailId(null);
  }, [sourceId]);

  const detailFetchId = resolvedDetailId ?? sourceId;

  useEffect(() => {
    if (!sourceId) {
      setDetail(null);
      onDetailLoadedRef.current(null);
      return;
    }
    const idToLoad = detailFetchId;
    if (!idToLoad) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = (await apiService.getSourceDetail(idToLoad)) as SourceDetail;
        if (cancelled) return;
        setDetail(d);
        onDetailLoadedRef.current(d);
        setSector(d.sector || 'ALL');
        setDomain(d.domain || 'ALL');
        setCountry(d.country || 'ALL');
        setName(d.name || '');
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Failed to load source';
        const presetKeyMatch = /^src-preset-(.+)$/.exec(idToLoad);
        const looksNotFound =
          /not\s*found/i.test(msg) || /\b404\b/.test(msg) || msg.toLowerCase().includes('source not found');
        if (presetKeyMatch && looksNotFound) {
          try {
            const list = (await apiService.getSources()) as unknown[];
            const wantKey = presetKeyMatch[1];
            let foundId = '';
            for (const raw of list) {
              if (!raw || typeof raw !== 'object') continue;
              const r = raw as Record<string, unknown>;
              const k = String(r.source_key ?? r.sourceKey ?? '').trim();
              if (k === wantKey) {
                foundId = String(r.id ?? '').trim();
                if (foundId) break;
              }
            }
            if (foundId && foundId !== idToLoad) {
              setResolvedDetailId(foundId);
              return;
            }
          } catch {
            /* fall through to error below */
          }
        }
        setError(msg);
        setDetail(null);
        onDetailLoadedRef.current(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceId, detailFetchId]);

  const handleSave = async () => {
    if (!sourceId || !detail?.id) return;
    setSaving(true);
    setError(null);
    try {
      const payload: { sector: string; domain: string; country: string; name?: string } = {
        sector,
        domain,
        country,
      };
      if (!detail.is_preset) {
        payload.name = name.trim();
      }
      await apiService.updateSource(detail.id, payload);
      const refreshed = (await apiService.getSourceDetail(detail.id)) as SourceDetail;
      setDetail(refreshed);
      onDetailLoadedRef.current(refreshed);
      await onCatalogRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!sourceId) return null;

  return (
    <div
      className="bg-ag-dark-surface rounded-lg border border-ag-dark-border flex flex-col h-full"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <div className="flex items-center justify-between mb-4 flex-shrink-0 p-6 pb-2">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-ag-dark-text-secondary" />
          <h3 className="text-lg font-semibold text-ag-dark-text">Source metadata</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
          aria-label="Close panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6">
        {loading ? (
          <div className="text-sm text-ag-dark-text-secondary py-8">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs text-ag-dark-text-secondary mb-1">Sector</label>
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  disabled={saving || driversLoading}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                >
                  {sectorOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-ag-dark-text-secondary mb-1">Domain</label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  disabled={saving || driversLoading}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                >
                  {domainOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-ag-dark-text-secondary mb-1">Country</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  disabled={saving || driversLoading}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                >
                  {countryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-ag-dark-text mb-2">Source</label>
              {detail?.is_preset ? (
                <div className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text opacity-90">
                  {detail.name}
                </div>
              ) : (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                  className="w-full px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text focus:ring-2 focus:ring-ag-dark-accent focus:border-ag-dark-accent disabled:opacity-50"
                  placeholder="Source name"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="block text-xs text-ag-dark-text-secondary mb-1">Tables</label>
                <div className="px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text">
                  {detail?.table_count ?? 0}
                </div>
              </div>
              <div>
                <label className="block text-xs text-ag-dark-text-secondary mb-1">Variables</label>
                <div className="px-3 py-2 bg-ag-dark-bg border border-ag-dark-border rounded text-sm text-ag-dark-text">
                  {detail?.variable_count ?? 0}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onViewLogicalDataModel}
              disabled={!detail}
              className="w-full mb-6 inline-flex items-center justify-center gap-2 py-3 px-4 rounded border border-ag-dark-border bg-ag-dark-bg text-ag-dark-text text-sm font-medium hover:bg-ag-dark-surface transition-colors disabled:opacity-50"
            >
              <Table2 className="w-4 h-4" />
              View Logical Data Model
            </button>

            {error && (
              <div className="mb-4 p-3 bg-red-900 bg-opacity-20 border border-red-500 rounded text-red-400 text-sm">
                {error}
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-6 py-4 border-t border-ag-dark-border flex-shrink-0 bg-ag-dark-surface">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading || !detail}
          className="w-full bg-ag-dark-accent text-white py-2 px-4 rounded hover:bg-ag-dark-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};
