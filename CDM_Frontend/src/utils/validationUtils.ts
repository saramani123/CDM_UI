// Utility functions for parsing and formatting validation strings

export type ValType = 'List' | 'Range' | 'Relative' | 'Length' | 'Character';
export type Operator = '=' | '>' | '<' | '>=' | '<=' | 'is';

export interface ValidationComponents {
  valType: ValType | '';
  operator: Operator | '';
  value: string;
}

/**
 * Parse a validation string into its components
 * Examples:
 * - "List" -> { valType: 'List', operator: '', value: 'List' }
 * - "Range < Datetime" -> { valType: 'Range', operator: '<', value: 'Datetime' }
 * - "Relative = Is Open" -> { valType: 'Relative', operator: '=', value: 'Is Open' }
 * - "Length >4" -> { valType: 'Length', operator: '>', value: '4' }
 * - "Character = ABC123" -> { valType: 'Character', operator: '=', value: 'ABC123' }
 * 
 * Also supports legacy format (without Val Type prefix) for backward compatibility:
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

  // Check for new format with Val Type prefix: "Range < Datetime", "Relative = Is Open", "Length >4", "Character = ABC123"
  const valTypePrefixPattern = /^(Range|Relative|Length|Character)\s+(.+)$/;
  const valTypeMatch = trimmed.match(valTypePrefixPattern);
  
  if (valTypeMatch) {
    const valType = valTypeMatch[1] as ValType;
    const rest = valTypeMatch[2].trim();
    
    // For Length, operator and value are concatenated without space (e.g., "Length >4")
    if (valType === 'Length') {
      const lengthMatch = rest.match(/^(>=|<=|=|>|<)(\d+)$/);
      if (lengthMatch) {
        return {
          valType: 'Length',
          operator: lengthMatch[1] as Operator,
          value: lengthMatch[2]
        };
      }
    }
    
    // For Range, Relative, and Character: "Range < Datetime", "Relative = Is Open", "Character = ABC123"
    const operatorPattern = /^(>=|<=|=|>|<)\s+(.+)$/;
    const operatorMatch = rest.match(operatorPattern);
    
    if (operatorMatch) {
      return {
        valType,
        operator: operatorMatch[1] as Operator,
        value: operatorMatch[2].trim()
      };
    }
    
    // If no operator found but we have a val type prefix, it might be Character without operator
    if (valType === 'Character') {
      return { valType: 'Character', operator: '', value: rest };
    }
  }

  // Legacy format support (backward compatibility): check for operators without Val Type prefix
  const operatorPattern = /^(>=|<=|=|>|<)\s*(.+)$/;
  const match = trimmed.match(operatorPattern);

  if (match) {
    const operator = match[1] as Operator;
    const value = match[2].trim();

    // Check if it's a number (Length) - no space between operator and number
    if (/^\d+$/.test(value)) {
      return { valType: 'Length', operator, value };
    }

    // Check if it's a variable name (Relative) - typically starts with capital letter
    // Common format types: Number, Date, String, etc.
    const commonFormats = ['Number', 'Date', 'String', 'Text', 'Boolean', 'Flag', 'List', 'Currency', 'Datetime', 'Integer', 'Decimal'];
    if (!commonFormats.includes(value)) {
      // Likely a Relative validation
      return { valType: 'Relative', operator, value };
    } else {
      // Likely a Range validation
      return { valType: 'Range', operator, value };
    }
  }

  // If no operator and no prefix, it's likely a Character validation (legacy format)
  return { valType: 'Character', operator: '', value: trimmed };
}

/**
 * Build a validation string from components
 * Format:
 * - List: "List"
 * - Range: "Range < Datetime" (Val Type + operator + formatI)
 * - Relative: "Relative = Is Open" (Val Type + operator + variableName)
 * - Length: "Length >4" (Val Type + operator + integer, no space between operator and value)
 * - Character: "Character = ABC123" (Val Type + operator + alphanumeric)
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
      if (!operator) return '';
      // For Range, use formatI if provided, otherwise use value
      const rangeValue = formatI || value;
      if (!rangeValue) return '';
      return `Range ${operator} ${rangeValue}`;

    case 'Relative':
      if (!operator) return '';
      // For Relative, use variableName if provided, otherwise use value
      const relativeValue = variableName || value;
      if (!relativeValue) return '';
      return `Relative ${operator} ${relativeValue}`;

    case 'Length':
      if (!operator || !value) return '';
      // No space between operator and value for Length (e.g., "Length >4")
      return `Length ${operator}${value}`;

    case 'Character':
      if (!value) return '';
      // Character always uses 'is' operator
      return `Character is ${value}`;

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
  if (valType === 'List') {
    return [];
  }
  if (valType === 'Character') {
    // Character only supports 'is' operator
    return ['is'];
  }
  // Range, Relative, Length support standard operators
  return ['=', '>', '<', '>=', '<='];
}

