// Utility functions for parsing and formatting validation strings

export type ValType = 'List' | 'Range' | 'Relative' | 'Length' | 'Character';
export type Operator = '=' | '>' | '<' | '>=' | '<=';

export interface ValidationComponents {
  valType: ValType | '';
  operator: Operator | '';
  value: string;
}

/**
 * Parse a validation string into its components
 * Examples:
 * - "List" -> { valType: 'List', operator: '', value: 'List' }
 * - "> Number" -> { valType: 'Range', operator: '>', value: 'Number' }
 * - "= Is Open" -> { valType: 'Relative', operator: '=', value: 'Is Open' }
 * - ">4" -> { valType: 'Length', operator: '>', value: '4' }
 * - "Delta" -> { valType: 'Character', operator: '', value: 'Delta' }
 */
export function parseValidation(validationString: string): ValidationComponents {
  if (!validationString || validationString.trim() === '') {
    return { valType: '', operator: '', value: '' };
  }

  const trimmed = validationString.trim();

  // Check for "List"
  if (trimmed === 'List') {
    return { valType: 'List', operator: '', value: 'List' };
  }

  // Check for operators: =, >, <, >=, <=
  const operatorPattern = /^(>=|<=|=|>|<)\s*(.+)$/;
  const match = trimmed.match(operatorPattern);

  if (match) {
    const operator = match[1] as Operator;
    const value = match[2].trim();

    // Check if it's a number (Length)
    if (/^\d+$/.test(value)) {
      return { valType: 'Length', operator, value };
    }

    // Check if it's a variable name (Relative) - typically starts with capital letter
    // For now, we'll check if it looks like a variable name (not a format type)
    // Common format types: Number, Date, String, etc.
    const commonFormats = ['Number', 'Date', 'String', 'Text', 'Boolean', 'Flag', 'List', 'Currency'];
    if (!commonFormats.includes(value)) {
      // Likely a Relative validation
      return { valType: 'Relative', operator, value };
    } else {
      // Likely a Range validation
      return { valType: 'Range', operator, value };
    }
  }

  // If no operator, it's likely a Character validation
  return { valType: 'Character', operator: '', value: trimmed };
}

/**
 * Build a validation string from components
 */
export function buildValidationString(components: ValidationComponents, variableName?: string, formatI?: string): string {
  const { valType, operator, value } = components;

  if (!valType) {
    return '';
  }

  switch (valType) {
    case 'List':
      return 'List';

    case 'Range':
      if (!operator || !value) return '';
      // For Range, use formatI if provided, otherwise use value
      const rangeValue = formatI || value;
      return `${operator} ${rangeValue}`;

    case 'Relative':
      if (!operator || !value) return '';
      // For Relative, use variableName if provided, otherwise use value
      const relativeValue = variableName || value;
      return `${operator} ${relativeValue}`;

    case 'Length':
      if (!operator || !value) return '';
      return `${operator}${value}`; // No space for length (e.g., ">4")

    case 'Character':
      return value || '';

    default:
      return '';
  }
}

/**
 * Validate input based on valType
 */
export function validateValidationInput(valType: ValType, value: string): { isValid: boolean; error?: string } {
  switch (valType) {
    case 'Length':
      if (!/^\d+$/.test(value)) {
        return { isValid: false, error: 'Length must be a positive integer' };
      }
      return { isValid: true };

    case 'Character':
      if (!/^[a-zA-Z0-9]+$/.test(value)) {
        return { isValid: false, error: 'Character must be alphanumeric' };
      }
      return { isValid: true };

    default:
      return { isValid: true };
  }
}

/**
 * Get available operators for a valType
 */
export function getOperatorsForValType(valType: ValType): Operator[] {
  if (valType === 'List' || valType === 'Character') {
    return [];
  }
  return ['=', '>', '<', '>=', '<='];
}

