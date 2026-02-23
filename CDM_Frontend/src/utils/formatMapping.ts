/**
 * Format V-I to Format V-II cascading mapping
 * Format V-II values are dependent on Format V-I. (blank) values excluded.
 */
export const FORMAT_I_TO_FORMAT_II_MAPPING: Record<string, string[]> = {
  'Contact': ['Email', 'Phone', 'PostalCode', 'URL', 'Zip'],
  'Freeform': ['Document', 'Label', 'Text'],
  'ID': ['Private', 'Public', 'Vulqan'],
  'List': ['Flag', 'Reference', 'Specific', 'Static', 'Vulqan'],
  'Number': ['Amount', 'Any', 'Currency', 'Decimal', 'Integer', 'Percent'],
  'Time': ['Date', 'DateTime', 'Month', 'Period']
};

/**
 * Get all Format V-I values
 */
export const getAllFormatIValues = (): string[] => {
  return Object.keys(FORMAT_I_TO_FORMAT_II_MAPPING).sort();
};

/**
 * Get Format V-II values for a given Format V-I value
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
