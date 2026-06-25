/**
 * Format VI -> Format VII mapping (canonical allowed values).
 *
 * Values are user-managed via the "Format VI" / "Format VII" rows on the
 * Metadata tab and are the single source of truth. This module keeps a live
 * in-memory cache of that master, populated from the backend
 * (`/metadata/format-mapping`) at app startup and refreshed whenever the values
 * are edited. All consumers (Variables panels, Source LDM, validation) read
 * from this cache via the helper functions below.
 *
 * The built-in mapping is only a bootstrap fallback used before the master has
 * loaded; once loaded, `formatMappingLoaded` is true and the cache reflects the
 * metadata-defined values.
 */
import { apiService } from '../services/api';

const BUILTIN_FORMAT_I_TO_FORMAT_II_MAPPING: Record<string, string[]> = {
  Contact: ['Email', 'Phone', 'PostalCode', 'URL', 'Zip'],
  Freeform: ['Document', 'Label', 'Text'],
  ID: ['Private', 'Public', 'Vulqan'],
  List: ['Flag', 'Reference', 'Specific', 'Static', 'Vulqan'],
  Number: ['Amount', 'Any', 'Currency', 'Decimal', 'Integer', 'Percent'],
  Time: ['Date', 'DateTime', 'Month', 'Period'],
};

/**
 * Live cache of the Format VI -> [Format VII...] master. Mutable: replaced
 * wholesale by `loadFormatMappingFromServer()`. Exposed for callers that read it
 * directly, but prefer the helper functions.
 */
export let FORMAT_I_TO_FORMAT_II_MAPPING: Record<string, string[]> = {
  ...BUILTIN_FORMAT_I_TO_FORMAT_II_MAPPING,
};

/** Insertion order of Format VI values as defined in the metadata master. */
let FORMAT_I_ORDER: string[] = Object.keys(FORMAT_I_TO_FORMAT_II_MAPPING);

/** True once the master has been fetched from the backend at least once. */
export let formatMappingLoaded = false;

/**
 * Fetch the Format VI/VII master from the backend and replace the live cache.
 * Safe to call multiple times (e.g. on startup and after edits in the modal).
 */
export async function loadFormatMappingFromServer(): Promise<void> {
  try {
    const res = (await apiService.getFormatMapping()) as {
      mapping?: Record<string, string[]>;
      formatIValues?: string[];
    };
    const mapping = res?.mapping || {};
    // Keep order from formatIValues when provided, else from the mapping keys.
    const order =
      res?.formatIValues && res.formatIValues.length > 0
        ? res.formatIValues
        : Object.keys(mapping);
    if (order.length > 0) {
      const next: Record<string, string[]> = {};
      for (const vi of order) {
        next[vi] = Array.isArray(mapping[vi]) ? [...mapping[vi]] : [];
      }
      FORMAT_I_TO_FORMAT_II_MAPPING = next;
      FORMAT_I_ORDER = order;
    }
    formatMappingLoaded = true;
  } catch (err) {
    console.warn('Failed to load format mapping from server; using cached/built-in values', err);
  }
}

/** All allowed Format VI (base) values, in metadata-defined order. */
export const getAllFormatIValues = (): string[] => {
  return [...FORMAT_I_ORDER];
};

/** Allowed Format VII values for a given Format VI. */
export const getFormatIIValuesForFormatI = (formatI: string): string[] => {
  if (!formatI) return [];
  return FORMAT_I_TO_FORMAT_II_MAPPING[formatI] ? [...FORMAT_I_TO_FORMAT_II_MAPPING[formatI]] : [];
};

/** Check if a Format VII value is valid for a given Format VI value. */
export const isValidFormatIIForFormatI = (formatI: string, formatII: string): boolean => {
  if (!formatI || !formatII) return true; // Allow empty values
  const validFormatIIValues = getFormatIIValuesForFormatI(formatI);
  return validFormatIIValues.includes(formatII);
};

/**
 * Coerce stored values to allowed canonical pair (clears invalid values).
 *
 * NOTE: this is non-destructive until the master has loaded, so we never blank
 * out otherwise-valid stored values just because the cache hasn't arrived yet.
 */
export function sanitizeStoredFormatPair(
  formatI: string,
  formatII: string,
): { formatI: string; formatII: string } {
  const fi = (formatI || '').trim();
  const fii = (formatII || '').trim();
  if (!formatMappingLoaded) {
    return { formatI: fi, formatII: fii };
  }
  const allowedI = new Set(getAllFormatIValues());
  if (!fi || !allowedI.has(fi)) return { formatI: '', formatII: '' };
  const allowedII = getFormatIIValuesForFormatI(fi);
  if (!fii || !allowedII.includes(fii)) return { formatI: fi, formatII: '' };
  return { formatI: fi, formatII: fii };
}
