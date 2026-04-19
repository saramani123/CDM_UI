import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

export interface SourceCatalogEntry {
  id: string;
  source_key: string;
  name: string;
  sector: string;
  domain: string;
  country: string;
  is_preset: boolean;
  table_count: number;
  variable_count: number;
}

export interface SourceLdmRow {
  id: string;
  source_id: string;
  source_name: string;
  source_table: string;
  /** External system column (UI: Source Column). */
  source_variable: string;
  /** CDM variable name (UI: Variable). */
  variable: string;
  being: string;
  avatar: string;
  object: string;
  part: string;
  section: string;
  group: string;
  format_vi: string;
  format_vii: string;
  validations: string;
}

export interface SourceDetail extends SourceCatalogEntry {
  ldm_rows: SourceLdmRow[];
}

export type SourceAutoMapRowKind =
  | 'primary'
  | 'extra'
  | 'unmatched_source'
  | 'unmatched_target';

/** One row in the Auto Map grid (paired source/target physical columns + shared LDM fields). */
export interface SourceAutoMapRow {
  id: string;
  map_row_kind: SourceAutoMapRowKind;
  match_group_index: number;
  pair_index: number;
  source_schema_table: string;
  source_schema_column: string;
  target_schema_table: string;
  target_schema_column: string;
  being: string;
  avatar: string;
  object: string;
  part: string;
  section: string;
  group: string;
  variable: string;
  format_vi: string;
  format_vii: string;
  validations: string;
}

export interface SourceAutoMapResponse {
  source_id: string;
  target_id: string;
  source_name: string;
  target_name: string;
  rows: SourceAutoMapRow[];
}

/** Coerce catalog rows from snake_case or camelCase API payloads. */
function normalizeSourceCatalogRow(raw: unknown): SourceCatalogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const source_key = String(r.source_key ?? r.sourceKey ?? '').trim();
  const id = String(r.id ?? '').trim();
  if (!id) return null;
  return {
    id,
    source_key,
    name: String(r.name ?? '').trim(),
    sector: String(r.sector ?? '').trim(),
    domain: String(r.domain ?? '').trim(),
    country: String(r.country ?? '').trim(),
    is_preset: Boolean(r.is_preset ?? r.isPreset),
    table_count: Number(r.table_count ?? r.tableCount ?? 0) || 0,
    variable_count: Number(r.variable_count ?? r.variableCount ?? 0) || 0,
  };
}

export const useSources = () => {
  const [catalog, setCatalog] = useState<SourceCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getSources();
      if (Array.isArray(data)) {
        const rows = data
          .map(normalizeSourceCatalogRow)
          .filter((x): x is SourceCatalogEntry => x !== null);
        setCatalog(rows);
      } else {
        setError('Invalid sources response');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sources');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const createSource = async (body: { name: string; sector?: string; domain?: string; country?: string }) => {
    const raw = await apiService.createSource(body);
    const created = normalizeSourceCatalogRow(raw);
    if (!created) throw new Error('Invalid create source response');
    setCatalog((prev) => [...prev, created]);
    return created;
  };

  const updateSource = async (
    id: string,
    update: { sector?: string; domain?: string; country?: string; name?: string }
  ) => {
    const raw = await apiService.updateSource(id, update);
    const updated = normalizeSourceCatalogRow(raw);
    if (!updated) throw new Error('Invalid update source response');
    setCatalog((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
    return updated;
  };

  return {
    catalog,
    loading,
    error,
    fetchCatalog,
    createSource,
    updateSource,
  };
};
