/**
 * Format V-I to Format V-II cascading mapping (canonical allowed values).
 * Format V-II values depend on Format V-I. Used by Add Variable, Edit Metadata, and Bulk Edit.
 */
export const FORMAT_I_TO_FORMAT_II_MAPPING: Record<string, string[]> = {
  Date: ['Date', 'Datetime'],
  Directory: ['Phone', 'Email', 'URL', 'Zip'],
  Freeform: ['Text', 'JSON'],
  ID: ['Numeric ID', 'Alphanumeric ID', 'Custom ID', 'Reference List'],
  List: ['Static List', 'Flag', 'Reference List', 'Specific List'],
  Number: ['Decimal', 'Currency', 'Percent', 'Integer'],
};

/** Legacy UI / graph values: still resolve Format II when editing older variables. */
const LEGACY_FORMAT_I_TO_FORMAT_II: Record<string, string[]> = {
  Contact: ['Email', 'Phone', 'PostalCode', 'URL', 'Zip'],
  Time: ['Date', 'DateTime', 'Month', 'Period'],
};

/**
 * Get all Format V-I values (canonical keys only; panels also merge API / grid data).
 */
export const getAllFormatIValues = (): string[] => {
  return Object.keys(FORMAT_I_TO_FORMAT_II_MAPPING).sort();
};

/**
 * Get Format V-II values for a given Format V-I value (canonical + legacy keys).
 */
export const getFormatIIValuesForFormatI = (formatI: string): string[] => {
  if (!formatI) return [];
  return (
    FORMAT_I_TO_FORMAT_II_MAPPING[formatI] ||
    LEGACY_FORMAT_I_TO_FORMAT_II[formatI] ||
    []
  );
};

/**
 * Check if a Format V-II value is valid for a given Format V-I value
 */
export const isValidFormatIIForFormatI = (formatI: string, formatII: string): boolean => {
  if (!formatI || !formatII) return true; // Allow empty values
  const validFormatIIValues = getFormatIIValuesForFormatI(formatI);
  return validFormatIIValues.includes(formatII);
};
