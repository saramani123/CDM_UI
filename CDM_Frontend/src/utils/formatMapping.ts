/**
 * Format V-I to Format V-II cascading mapping (canonical allowed values).
 * Matches the product spreadsheet: Format V-I options and allowed Format V-II per V-I.
 * Used by Variables (Format I/II), Source LDM (Format VI/VII), Add/Bulk edit.
 */
export const FORMAT_I_TO_FORMAT_II_MAPPING: Record<string, string[]> = {
  Date: ['Date', 'Datetime'],
  Number: ['Decimal', 'Currency', 'Percent', 'Integer'],
  ID: ['Numeric ID', 'Custom ID', 'Alphanumeric ID'],
  List: ['Static List', 'Flag', 'Reference List', 'Specific List'],
  Directory: ['Phone', 'Email', 'URL', 'Zip'],
  Freeform: ['Text', 'JSON'],
};

/**
 * All allowed Format V-I (Format VI on Source LDM) values — no API/grid merge.
 */
export const getAllFormatIValues = (): string[] => {
  return Object.keys(FORMAT_I_TO_FORMAT_II_MAPPING).sort();
};

/**
 * Allowed Format V-II (Format VII) values for a given Format V-I — canonical only.
 */
export const getFormatIIValuesForFormatI = (formatI: string): string[] => {
  if (!formatI) return [];
  return FORMAT_I_TO_FORMAT_II_MAPPING[formatI] || [];
};

/**
 * Check if a Format V-II value is valid for a given Format V-I value
 */
export const isValidFormatIIForFormatI = (formatI: string, formatII: string): boolean => {
  if (!formatI || !formatII) return true; // Allow empty values
  const validFormatIIValues = getFormatIIValuesForFormatI(formatI);
  return validFormatIIValues.includes(formatII);
};

/** Coerce stored values to allowed canonical pair (clears invalid legacy/API values). */
export function sanitizeStoredFormatPair(formatI: string, formatII: string): { formatI: string; formatII: string } {
  const fi = (formatI || '').trim();
  const fii = (formatII || '').trim();
  const allowedI = new Set(getAllFormatIValues());
  if (!fi || !allowedI.has(fi)) return { formatI: '', formatII: '' };
  const allowedII = getFormatIIValuesForFormatI(fi);
  if (!fii || !allowedII.includes(fii)) return { formatI: fi, formatII: '' };
  return { formatI: fi, formatII: fii };
}
