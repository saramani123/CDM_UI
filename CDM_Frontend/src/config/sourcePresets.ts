import type { SourceCatalogEntry } from '../hooks/useSources';

/**
 * Canonical Sources tab cards (order matches backend `PRESET_SOURCES`).
 * Tier 1–3 integrations plus existing property / ops sources at the end.
 */
export const PRESET_SOURCE_DISPLAY: Array<{ source_key: string; name: string }> = [
  { source_key: 'quickbooks', name: 'QuickBooks' },
  { source_key: 'netsuite', name: 'Oracle NetSuite' },
  { source_key: 'square', name: 'Square' },
  { source_key: 'stripe', name: 'Stripe' },
  { source_key: 'xero', name: 'Xero' },
  { source_key: 'evernest', name: 'Evernest' },
  { source_key: 'northpoint', name: 'Northpoint' },
  { source_key: 'darwin', name: 'Darwin' },
  { source_key: 'hrg', name: 'HRG' },
  { source_key: 'mynd', name: 'Mynd' },
  { source_key: 'sap_s4hana', name: 'SAP S/4HANA' },
  { source_key: 'dynamics_365_finance', name: 'Microsoft Dynamics 365 Finance' },
  { source_key: 'sage_intacct', name: 'Sage Intacct' },
  { source_key: 'sap_ecc', name: 'SAP ECC' },
  { source_key: 'salesforce', name: 'Salesforce' },
  { source_key: 'hubspot', name: 'HubSpot' },
  { source_key: 'adyen', name: 'Adyen' },
  { source_key: 'paypal', name: 'PayPal' },
  { source_key: 'workiva', name: 'Workiva' },
  { source_key: 'active_disclosure', name: 'Active Disclosure (Thomson Reuters)' },
  { source_key: 'blackline', name: 'BlackLine' },
  { source_key: 'coupa', name: 'Coupa' },
  { source_key: 'bill_com', name: 'Bill.com' },
  { source_key: 'bloomberg', name: 'Bloomberg' },
  { source_key: 'blackrock_aladdin', name: 'BlackRock Aladdin' },
  { source_key: 'morningstar_direct', name: 'Morningstar Direct' },
  { source_key: 'factset', name: 'FactSet' },
  { source_key: 'guidewire', name: 'Guidewire' },
  { source_key: 'duck_creek', name: 'Duck Creek' },
  { source_key: 'cority', name: 'Cority' },
  { source_key: 'metricstream', name: 'MetricStream' },
  { source_key: 'energysys', name: 'EnergySys' },
  { source_key: 'energy_components', name: 'Energy Components' },
  { source_key: 'cority_iir', name: 'Cority II&R' },
  { source_key: 'synergi', name: 'Synergi' },
  { source_key: 'prometheus_suite', name: 'Prometheus Suite' },
  { source_key: 'prometheus_pm', name: 'Prometheus PM' },
  { source_key: 'prometheus_scheduler', name: 'Prometheus Scheduler' },
  { source_key: 'docuflow', name: 'DocuFlow' },
];

const PRESET_KEYS = new Set(PRESET_SOURCE_DISPLAY.map((p) => p.source_key));

/**
 * Always show preset cards first (with API ids/counts when available),
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
