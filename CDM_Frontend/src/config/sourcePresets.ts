import type { SourceCatalogEntry } from '../hooks/useSources';

/** Canonical Sources tab cards (matches backend `PRESET_SOURCES` order). */
export const PRESET_SOURCE_DISPLAY: Array<{ source_key: string; name: string }> = [
  { source_key: 'quickbooks', name: 'Quickbooks' },
  { source_key: 'netsuite', name: 'Netsuite' },
  { source_key: 'square', name: 'Square' },
  { source_key: 'stripe', name: 'Stripe' },
  { source_key: 'xero', name: 'Xero' },
  { source_key: 'evernest', name: 'Evernest' },
  { source_key: 'northpoint', name: 'Northpoint' },
  { source_key: 'darwin', name: 'Darwin' },
  { source_key: 'hrg', name: 'HRG' },
  { source_key: 'mynd', name: 'Mynd' },
];

const PRESET_KEYS = new Set(PRESET_SOURCE_DISPLAY.map((p) => p.source_key));

/**
 * Always show the ten preset cards first (with API ids/counts when available),
 * then any additional catalog rows the user added.
 */
export function mergePresetSourcesWithCatalog(catalog: SourceCatalogEntry[]): SourceCatalogEntry[] {
  const byKey = new Map<string, SourceCatalogEntry>();
  for (const c of catalog) {
    const k = (c.source_key ?? '').trim();
    if (k) byKey.set(k, c);
  }

  const presetRows: SourceCatalogEntry[] = PRESET_SOURCE_DISPLAY.map((p) => {
    const found = byKey.get(p.source_key);
    if (found) {
      return {
        ...found,
        name: (found.name ?? '').trim() || p.name,
        source_key: p.source_key,
      };
    }
    return {
      id: `src-preset-${p.source_key}`,
      source_key: p.source_key,
      name: p.name,
      sector: '',
      domain: '',
      country: '',
      is_preset: true,
      table_count: 0,
      variable_count: 0,
    };
  });

  const extras = catalog.filter((c) => {
    const k = (c.source_key ?? '').trim();
    return k && !PRESET_KEYS.has(k);
  });
  extras.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

  return [...presetRows, ...extras];
}
