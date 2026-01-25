/**
 * Format V-I to Format V-II cascading mapping
 * Based on the specification provided by the user
 */
export const FORMAT_I_TO_FORMAT_II_MAPPING: Record<string, string[]> = {
  'ID': ['Public', 'Private', 'Name'],
  'Reference': ['Blood', 'Intra', 'Inter'],
  'Time': ['Date', 'DateTime'],
  'List': ['Static', 'Specific', 'Flag'],
  'Number': ['Integer', 'Decimal', 'Currency', 'Percentage'],
  'Directory': ['Phone', 'Email', 'URL', 'Zip'],
  'Freeform': ['Text', 'Binary', 'JSON', 'CSV', 'XLS', 'PDF']
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
