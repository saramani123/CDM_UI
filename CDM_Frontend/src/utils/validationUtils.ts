// Utility functions for parsing and formatting validation strings

export type ValType = 'List' | 'Range' | 'Relative' | 'Length' | 'Character';
export type Operator = '=' | '>' | '<' | '>=' | '<=' | 'is';

/** For Range: greater-than side and less-than side (each has operator + value). */
export type RangeOperator = '>' | '>=' | '<' | '<=';

export interface ValidationComponents {
  valType: ValType | '';
  operator: Operator | '';
  value: string;
  /** Range only: greater-than operator (> or >=) */
  greaterThanOperator?: RangeOperator | '';
  /** Range only: greater-than value (typing field) */
  greaterThanValue?: string;
  /** Range only: less-than operator (< or <=) */
  lessThanOperator?: RangeOperator | '';
  /** Range only: less-than value (typing field) */
  lessThanValue?: string;
}

/**
 * Parse a validation string into its components
 * Examples:
 * - "List" -> { valType: 'List', operator: '', value: 'List' }
 * - "> 12/5/2025, <= 3/8/2026" -> Range with greaterThanOperator '>', greaterThanValue '12/5/2025', lessThanOperator '<=', lessThanValue '3/8/2026'
 * - "< Transaction end date" -> { valType: 'Relative', operator: '<', value: 'Transaction end date' }
 * - "Range < Datetime" (legacy) -> Range with single less-than bound
 * - "Length >4" -> { valType: 'Length', operator: '>', value: '4' }
 * - "Character is Alpha" -> { valType: 'Character', operator: 'is', value: 'Alpha' }
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

  // Range format: "> 12/5/2025, <= 3/8/2026" (two parts: "op value, op value")
  const rangeTwoPartPattern = /^(>|>=)\s+(.+?)\s*,\s*(<|<=)\s+(.+)$/;
  const rangeTwoMatch = trimmed.match(rangeTwoPartPattern);
  if (rangeTwoMatch) {
    return {
      valType: 'Range',
      operator: '',
      value: '',
      greaterThanOperator: rangeTwoMatch[1] as RangeOperator,
      greaterThanValue: rangeTwoMatch[2].trim(),
      lessThanOperator: rangeTwoMatch[3] as RangeOperator,
      lessThanValue: rangeTwoMatch[4].trim()
    };
  }

  // Relative format (no prefix): "< Transaction end date", "= Var Name"
  const relativePattern = /^(>=|<=|=|>|<)\s+(.+)$/;
  const relativeMatch = trimmed.match(relativePattern);
  if (relativeMatch) {
    const op = relativeMatch[1] as Operator;
    const val = relativeMatch[2].trim();
    // Variable names are typically Title Case words; dates/numbers are not
    const looksLikeDateOrNumber = /^\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}/.test(val) || /^-?\d+(\.\d+)?%?$/.test(val) || /^\d+$/.test(val);
    const commonFormats = ['Number', 'Date', 'String', 'Text', 'Boolean', 'Flag', 'List', 'Currency', 'Datetime', 'Integer', 'Decimal', 'Special', 'Time'];
    if (!commonFormats.includes(val) && !looksLikeDateOrNumber) {
      return { valType: 'Relative', operator: op, value: val };
    }
    // Otherwise legacy Range single bound - fall through
  }

  // Check for Val Type prefix: "Range < x", "Relative = Is Open", "Length >4", "Character is ABC123"
  const valTypePrefixPattern = /^(Range|Relative|Length|Character)\s+(.+)$/;
  const valTypeMatch = trimmed.match(valTypePrefixPattern);

  if (valTypeMatch) {
    const valType = valTypeMatch[1] as ValType;
    const rest = valTypeMatch[2].trim();

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

    if (valType === 'Character') {
      const charOpMatch = rest.match(/^is\s+(.+)$/);
      if (charOpMatch) {
        return { valType: 'Character', operator: 'is', value: charOpMatch[1].trim() };
      }
      return { valType: 'Character', operator: '', value: rest };
    }

    if (valType === 'Relative') {
      const operatorPattern = /^(>=|<=|=|>|<)\s+(.+)$/;
      const operatorMatch = rest.match(operatorPattern);
      if (operatorMatch) {
        return {
          valType: 'Relative',
          operator: operatorMatch[1] as Operator,
          value: operatorMatch[2].trim()
        };
      }
    }

    if (valType === 'Range') {
      const operatorPattern = /^(>=|<=|=|>|<)\s+(.+)$/;
      const operatorMatch = rest.match(operatorPattern);
      if (operatorMatch) {
        const op = operatorMatch[1];
        const val = operatorMatch[2].trim();
        if (op === '>' || op === '>=') {
          return {
            valType: 'Range',
            operator: '',
            value: '',
            greaterThanOperator: op as RangeOperator,
            greaterThanValue: val,
            lessThanOperator: '',
            lessThanValue: ''
          };
        }
        return {
          valType: 'Range',
          operator: '',
          value: '',
          greaterThanOperator: '',
          greaterThanValue: '',
          lessThanOperator: op as RangeOperator,
          lessThanValue: val
        };
      }
    }
  }

  // Legacy: single operator + value (e.g. "> Number", ">4", "= Var Name", "> 12/5/2025")
  const operatorPattern = /^(>=|<=|=|>|<)\s*(.+)$/;
  const match = trimmed.match(operatorPattern);
  if (match) {
    const operator = match[1] as Operator;
    const value = match[2].trim();
    if (/^\d+$/.test(value)) {
      return { valType: 'Length', operator, value };
    }
    const commonFormats = ['Number', 'Date', 'String', 'Text', 'Boolean', 'Flag', 'List', 'Currency', 'Datetime', 'Integer', 'Decimal'];
    const looksLikeDateOrNumber = /^\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}/.test(value) || /^-?\d+(\.\d+)?%?$/.test(value);
    if (commonFormats.includes(value) || looksLikeDateOrNumber) {
      // Range (single bound)
      if (operator === '>' || operator === '>=') {
        return { valType: 'Range', operator: '', value: '', greaterThanOperator: operator as RangeOperator, greaterThanValue: value, lessThanOperator: '', lessThanValue: '' };
      }
      return { valType: 'Range', operator: '', value: '', greaterThanOperator: '', greaterThanValue: '', lessThanOperator: operator as RangeOperator, lessThanValue: value };
    }
    return { valType: 'Relative', operator, value };
  }

  return { valType: 'Character', operator: '', value: trimmed };
}

/**
 * Build a validation string from components
 * Format:
 * - List: "List"
 * - Range (4-field): "> 12/5/2025, <= 3/8/2026" (greaterOp greaterValue, lessOp lessValue)
 * - Relative: "< Transaction end date" (operator + variable name, no prefix)
 * - Length: "Length >4"
 * - Character: "Character is Alpha"
 */
export function buildValidationString(components: ValidationComponents, _variableName?: string, _formatI?: string): string {
  const { valType, operator, value, greaterThanOperator, greaterThanValue, lessThanOperator, lessThanValue } = components;

  if (!valType) {
    return '';
  }

  switch (valType) {
    case 'List':
      return 'List';

    case 'Range': {
      const hasGreater = (greaterThanOperator === '>' || greaterThanOperator === '>=') && (greaterThanValue ?? '').trim();
      const hasLess = (lessThanOperator === '<' || lessThanOperator === '<=') && (lessThanValue ?? '').trim();
      if (hasGreater && hasLess) {
        return `${greaterThanOperator} ${(greaterThanValue ?? '').trim()}, ${lessThanOperator} ${(lessThanValue ?? '').trim()}`;
      }
      if (hasGreater) return `${greaterThanOperator} ${(greaterThanValue ?? '').trim()}`;
      if (hasLess) return `${lessThanOperator} ${(lessThanValue ?? '').trim()}`;
      // Legacy single operator + value
      if (operator && value) return `${operator} ${value}`;
      return '';
    }

    case 'Relative':
      if (!operator) return '';
      const relativeValue = (components.value ?? '').trim();
      if (!relativeValue) return '';
      return `${operator} ${relativeValue}`;

    case 'Length':
      if (!operator || !value) return '';
      return `Length ${operator}${value}`;

    case 'Character':
      if (!value) return '';
      return `Character is ${value}`;

    default:
      return '';
  }
}

/**
 * Validate input based on valType
 */
export function validateValidationInput(valType: ValType, value: string, formatI?: string, formatII?: string): { isValid: boolean; error?: string } {
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

    case 'Range':
      // For Range, validate based on Format V-I and Format V-II (Format-V mapping)
      if (formatI === 'Time') {
        return validateTimeFormat(value, formatII);
      } else if (formatI === 'Number' && formatII) {
        return validateNumberFormat(value, formatII);
      }
      // If no format restrictions, allow any value
      return { isValid: true };

    default:
      return { isValid: true };
  }
}

/**
 * Validate Time format (date/datetime) based on Format V-I = Time and Format V-II = Date | DateTime.
 * Format II "Date" → date only. Format II "DateTime" → datetime (and date-only allowed).
 */
function validateTimeFormat(value: string, formatII?: string): { isValid: boolean; error?: string } {
  if (!value || value.trim() === '') {
    return { isValid: false, error: 'Value cannot be empty' };
  }

  const trimmed = value.trim();

  // Date formats (Format V-II = Date): YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD (ISO 8601)
    /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY or DD/MM/YYYY
  ];

  // Datetime formats (Format V-II = DateTime): YYYY-MM-DD HH:MM:SS, YYYY-MM-DDTHH:MM:SSZ, YYYY-MM-DDTHH:MM:SS.SSSZ
  const datetimePatterns = [
    /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(:\d{2})?$/, // YYYY-MM-DD HH:MM:SS or HH:MM
    /^\d{4}-\d{2}-\d{2}T\d{1,2}:\d{2}(:\d{2})?(\.\d{1,3})?Z?$/, // YYYY-MM-DDTHH:MM:SSZ, .SSSZ optional
  ];

  // Timestamp (numeric)
  const timestampPattern = /^\d+$/;

  if (formatII === 'Date') {
    const valid = datePatterns.some(p => p.test(trimmed)) || timestampPattern.test(trimmed);
    if (valid) return { isValid: true };
    return {
      isValid: false,
      error: 'Invalid date format. Use YYYY-MM-DD (e.g. 2025-01-26), MM/DD/YYYY (e.g. 01/26/2025), or DD/MM/YYYY (e.g. 26/01/2025).',
    };
  }

  if (formatII === 'DateTime') {
    const valid =
      datePatterns.some(p => p.test(trimmed)) ||
      datetimePatterns.some(p => p.test(trimmed)) ||
      timestampPattern.test(trimmed);
    if (valid) return { isValid: true };
    return {
      isValid: false,
      error: 'Invalid datetime format. Use YYYY-MM-DD HH:MM:SS (e.g. 2025-01-26 14:30:00), YYYY-MM-DDTHH:MM:SSZ (e.g. 2025-01-26T14:30:00Z), or YYYY-MM-DDTHH:MM:SS.SSSZ.',
    };
  }

  // Time but no Format II or other: allow any date/datetime/timestamp
  const isValidDate = datePatterns.some(p => p.test(trimmed));
  const isValidDatetime = datetimePatterns.some(p => p.test(trimmed));
  const isValidTimestamp = timestampPattern.test(trimmed);
  if (isValidDate || isValidDatetime || isValidTimestamp) {
    return { isValid: true };
  }
  return {
    isValid: false,
    error: 'Invalid date/time format. Valid: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD HH:MM:SS, YYYY-MM-DDTHH:MM:SSZ, YYYY-MM-DDTHH:MM:SS.SSSZ, or Unix timestamp.',
  };
}

/**
 * Validate Number format based on Format V-II
 */
function validateNumberFormat(value: string, formatII: string): { isValid: boolean; error?: string } {
  if (!value || value.trim() === '') {
    return { isValid: false, error: 'Value cannot be empty' };
  }

  const trimmed = value.trim();

  switch (formatII) {
    case 'Integer':
      if (!/^-?\d+$/.test(trimmed)) {
        return { isValid: false, error: 'Value must be an integer (whole number)' };
      }
      return { isValid: true };

    case 'Decimal':
      if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return { isValid: false, error: 'Value must be a decimal number' };
      }
      return { isValid: true };

    case 'Currency':
      // Currency: number with currency sign (e.g., $100, €50, £25, ¥1000)
      // Common currency symbols: $, €, £, ¥, ₹, ₽, ₩, ₪, ₨, ₦, ₨, ₫, ₭, ₮, ₯, ₰, ₱, ₲, ₳, ₴, ₵, ₶, ₷, ₸, ₹, ₺, ₻, ₼, ₽, ₾, ₿
      // Also supports common currency codes: USD, EUR, GBP, etc.
      const currencyPattern = /^[$\u20AC\u00A3\u00A5\u20B9\u20BD\u20A9\u20AA\u20A8\u20A6\u20A8\u20AB\u20AD\u20AE\u20AF\u20B0\u20B1\u20B2\u20B3\u20B4\u20B5\u20B6\u20B7\u20B8\u20B9\u20BA\u20BB\u20BC\u20BD\u20BE\u20BF]?\s*\d+(\.\d{2})?$|^[A-Z]{3}\s*\d+(\.\d{2})?$/i;
      if (!currencyPattern.test(trimmed)) {
        return { isValid: false, error: 'Value must be a valid currency format (e.g., $100, €50.00, USD 100)' };
      }
      return { isValid: true };

    case 'Percentage':
      // Percentage: number with % at the end
      if (!/^-?\d+(\.\d+)?%$/.test(trimmed)) {
        return { isValid: false, error: 'Value must be a number with percentage sign (e.g., 50%, 12.5%)' };
      }
      return { isValid: true };

    default:
      // If formatII is not one of the expected values, allow any number
      if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return { isValid: false, error: 'Value must be a number' };
      }
      return { isValid: true };
  }
}

/**
 * Get available operators for a valType (used for single Operator field: Relative, Length)
 */
export function getOperatorsForValType(valType: ValType): Operator[] {
  if (valType === 'List') {
    return [];
  }
  if (valType === 'Character') {
    return ['is'];
  }
  if (valType === 'Range') {
    // Range uses separate greater/less dropdowns; this is for legacy/fallback
    return ['=', '>', '<', '>=', '<='];
  }
  return ['=', '>', '<', '>=', '<='];
}

/** Greater-than operators for Range: > and >= */
export const RANGE_GREATER_OPERATORS: RangeOperator[] = ['>', '>='];

/** Less-than operators for Range: < and <= */
export const RANGE_LESS_OPERATORS: RangeOperator[] = ['<', '<='];

/**
 * Split a combined validation string (e.g. "> 12/5/2025, <= 3/8/2026, Character is Alpha")
 * into individual validation strings. Range validations contain ", " so we merge
 * "> or >=" part with "< or <=" part when they appear consecutively.
 */
export function splitValidationString(combined: string): string[] {
  const parts = combined.split(', ').map(s => s.trim()).filter(Boolean);
  const result: string[] = [];
  let i = 0;
  while (i < parts.length) {
    const part = parts[i];
    const next = parts[i + 1];
    const isGreaterPart = /^(>|>=)\s+.+$/.test(part);
    const isLessPart = /^(<|<=)\s+.+$/.test(part);
    const isNextLessPart = next && /^(<|<=)\s+.+$/.test(next);
    if (isGreaterPart && isNextLessPart) {
      result.push(`${part}, ${next}`);
      i += 2;
    } else {
      result.push(part);
      i += 1;
    }
  }
  return result;
}

