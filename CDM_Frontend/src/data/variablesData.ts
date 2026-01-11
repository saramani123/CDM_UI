// Variables data structure and mock data
import { getDriversData } from './mockData';

export interface VariableData {
  id: string;
  // Drivers (concatenated from individual selections)
  driver: string;
  // Separate driver fields for filtering
  sector: string;
  domain: string;
  country: string;
  // Taxonomy
  part: string;
  group: string;
  section: string; // Property of Variable node
  variable: string; // Name of the Variable
  // Variable properties
  formatI: string;
  formatII: string;
  gType: string;
  validation?: string;
  default?: string;
  graph?: string; // Yes/No; default Yes
  // Relationships
  objectRelationships: number;
  objectRelationshipsList?: ObjectRelationship[];
  // Variations
  variationsList?: Array<{ id: string; name: string }>;
  // Parsed driver fields for UI (legacy for metadata panel)
  variableClarifier?: string;
  status?: string;
  isMeme?: boolean; // Meme flag
  isGroupKey?: boolean; // Group Key flag
}

export interface ObjectRelationship {
  id: string;
  toBeing: string;
  toAvatar: string;
  toObject: string;
  toSector?: string;
  toDomain?: string;
  toCountry?: string;
  toObjectClarifier?: string;
}

export const mockVariableData: VariableData[] = [];

export const variableColumns = [
  { key: 'sector', title: 'S', sortable: true, filterable: true, width: '140px' },
  { key: 'domain', title: 'D', sortable: true, filterable: true, width: '140px' },
  { key: 'country', title: 'C', sortable: true, filterable: true, width: '140px' },
  { key: 'relevance', title: 'Relevance', sortable: true, filterable: false, width: '120px' },
  { key: 'part', title: 'Part', sortable: true, filterable: true, width: '120px' },
  { key: 'section', title: 'Section', sortable: true, filterable: true, width: '120px' },
  { key: 'group', title: 'Group', sortable: true, filterable: true, width: '140px' },
  { key: 'variable', title: 'Variable', sortable: true, filterable: true, width: '200px' },
  { key: 'isMeme', title: 'Is Meme', sortable: true, filterable: true, width: '100px' },
  { key: 'isGroupKey', title: 'Is Group Key', sortable: true, filterable: true, width: '120px' },
  { key: 'formatI', title: 'Format I', sortable: true, filterable: true, width: '120px' },
  { key: 'formatII', title: 'Format II', sortable: true, filterable: true, width: '140px' },
  { key: 'gType', title: 'G-Type', sortable: true, filterable: true, width: '120px' },
  { key: 'validation', title: 'Validation', sortable: true, filterable: true, width: '150px' }
];

// Function to get distinct values from existing variables data
export const getVariableFieldOptions = (allData: VariableData[] = []) => {
  const variablesData = allData.length > 0 ? allData : (window as any).variablesData || [];
  
  return {
    part: [...new Set(variablesData.map((item: VariableData) => item.part))].filter(Boolean).sort() as string[],
    section: [...new Set(variablesData.map((item: VariableData) => item.section))].filter(Boolean).sort() as string[],
    group: [...new Set(variablesData.map((item: VariableData) => item.group))].filter(Boolean).sort() as string[],
    formatI: [...new Set(variablesData.map((item: VariableData) => item.formatI))].filter(Boolean).sort() as string[],
    formatII: [...new Set(variablesData.map((item: VariableData) => item.formatII))].filter(Boolean).sort() as string[],
    gType: [...new Set(variablesData.map((item: VariableData) => item.gType))].filter(Boolean).sort() as string[],
    validation: [...new Set(variablesData.map((item: VariableData) => item.validation))].filter(Boolean).sort() as string[],
    default: [...new Set(variablesData.map((item: VariableData) => item.default))].filter(Boolean).sort() as string[],
    graph: [...new Set(variablesData.map((item: VariableData) => item.graph))].filter(Boolean).sort() as string[]
  };
};

// Fallback static options (used when no data is available)
export const variableFieldOptions = {
  part: ['Identifier', 'Attribute', 'Measure', 'Reference'],
  group: [
    '[Identifier]', 'Vulqan ID', 'Name', 'Name Individual', 'Name Institution', 
    'Name DBA', 'Name Thing', 'Public ID', 'Address', 'Contact', 'Financial'
  ],
  formatI: ['Special', 'List', 'Text', 'Number', 'Date', 'Boolean'],
  formatII: ['Custom', 'Static', 'Free', 'Calculated', 'Derived'],
  gType: ['Loose', 'Strict', 'Flexible', 'Fixed'],
  validation: ['Length', 'Range', 'Pattern', 'Required', 'Unique'],
  default: ['None', 'System', 'User', 'Calculated'],
  graph: ['Y', 'N', 'Conditional']
};

// Helper function to concatenate variable driver selections
export const concatenateVariableDrivers = (sector: string[], domain: string[], country: string[], variableClarifier: string) => {
  const sectorStr = sector.includes('ALL') || sector.length === 0 ? 'ALL' : sector.join(', ');
  const domainStr = domain.includes('ALL') || domain.length === 0 ? 'ALL' : domain.join(', ');
  const countryStr = country.includes('ALL') || country.length === 0 ? 'ALL' : country.join(', ');
  const clarifierStr = variableClarifier || 'None';
  
  return `${sectorStr}, ${domainStr}, ${countryStr}, ${clarifierStr}`;
};

// Helper function to parse variable driver string back to selections
// Driver string format: "Sector, Domain, Country, VariableClarifier"
// Where Sector/Domain/Country can be "ALL" or comma-separated values like "Finance, Healthcare"
export const parseVariableDriverString = (driverString: string) => {
  if (!driverString) {
    return {
      sector: [],
      domain: [],
      country: [],
      variableClarifier: ''
    };
  }
  
  // Get all available driver options to determine what "ALL" should include
  const driversData = getDriversData();
  
  // Helper to check if a comma-separated string contains all values
  const containsAllValues = (value: string, allValues: string[]): boolean => {
    if (value === 'ALL') return true;
    if (!value || allValues.length === 0) return false;
    const selectedValues = value.split(',').map(v => v.trim()).filter(Boolean);
    const selectedSet = new Set(selectedValues);
    const allSet = new Set(allValues);
    return selectedSet.size === allSet.size && [...selectedSet].every(val => allSet.has(val));
  };
  
  // The driver string format is: "Sector, Domain, Country, VariableClarifier"
  // Where each field can be "ALL" or comma-separated values like "Finance, Healthcare"
  // Example: "Finance, Healthcare, ALL, ALL, None"
  // We need to intelligently split by identifying field boundaries
  
  const allParts = driverString.split(',').map(p => p.trim()).filter(Boolean);
  
  // Helper to extract field values by identifying where the field ends
  const extractFieldValues = (
    allParts: string[], 
    startIndex: number, 
    currentFieldValues: string[],
    nextFieldValues: string[],
    fieldName: string
  ): { values: string[], nextIndex: number } => {
    if (startIndex >= allParts.length) {
      return { values: [], nextIndex: startIndex };
    }
    
    // If the first part is "ALL", this field is ALL
    if (allParts[startIndex] === 'ALL') {
      return { values: ['ALL'], nextIndex: startIndex + 1 };
    }
    
    // Collect consecutive parts that match current field values
    const values: string[] = [];
    let index = startIndex;
    
    while (index < allParts.length) {
      const part = allParts[index];
      
      // Stop if we hit "ALL" - it means we've moved to the next field
      if (part === 'ALL') {
        break;
      }
      
      // Check if this part belongs to current field
      const belongsToCurrentField = currentFieldValues.includes(part);
      
      // Check if this part belongs to next field (indicates we've moved to next field)
      const belongsToNextField = nextFieldValues && nextFieldValues.length > 0 && nextFieldValues.includes(part);
      
      // Check if it's "None" (usually indicates clarifier field, only for country->clarifier boundary)
      const isNone = part === 'None' && fieldName === 'country';
      
      if (belongsToCurrentField) {
        values.push(part);
        index++;
      } else if (belongsToNextField || isNone) {
        // We've hit the next field
        break;
      } else if (values.length === 0) {
        // First value doesn't match - might be invalid data, but include it to avoid losing data
        // This could happen if a driver value was deleted or renamed
        values.push(part);
        index++;
      } else {
        // Unknown value after collecting some valid ones - likely moved to next field
        break;
      }
    }
    
    return { values, nextIndex: index };
  };
  
  // Extract sector values (next field would be domains)
  const sectorResult = extractFieldValues(allParts, 0, driversData.sectors, driversData.domains, 'sector');
  const sectorValues = sectorResult.values;
  const sectorIndex = sectorResult.nextIndex;
  
  // Extract domain values (next field would be countries)
  const domainResult = extractFieldValues(allParts, sectorIndex, driversData.domains, driversData.countries, 'domain');
  const domainValues = domainResult.values;
  const domainIndex = domainResult.nextIndex;
  
  // Extract country values (next field would be clarifier, indicated by "None")
  const countryResult = extractFieldValues(allParts, domainIndex, driversData.countries, [], 'country');
  const countryValues = countryResult.values;
  const countryIndex = countryResult.nextIndex;
  
  // The remaining part should be VariableClarifier (could be multiple parts if clarifier has commas, but typically just one)
  const clarifier = countryIndex < allParts.length ? allParts[countryIndex] : '';
  
  // Process each field to check if all values are selected, then format for multi-select
  const processField = (values: string[], allValues: string[]): string[] => {
    if (values.length === 0) return [];
    
    // Filter out "ALL" from values (it's not a real node, just a UI convenience)
    const filteredValues = values.filter(v => v !== 'ALL');
    
    // If "ALL" was in the original values, or if all possible values are selected, return ALL + all values
    const hasAll = values.includes('ALL');
    const allSelected = filteredValues.length > 0 && 
                       allValues.length > 0 && 
                       filteredValues.length === allValues.length &&
                       new Set(filteredValues).size === new Set(allValues).size &&
                       filteredValues.every(v => allValues.includes(v));
    
    if (hasAll || allSelected) {
      return ['ALL', ...allValues];
    }
    
    // Otherwise return the actual selected values
    return filteredValues;
  };
  
  return {
    sector: processField(sectorValues, driversData.sectors),
    domain: processField(domainValues, driversData.domains),
    country: processField(countryValues, driversData.countries),
    variableClarifier: clarifier === 'None' || !clarifier ? '' : clarifier
  };
};

export const variableMetadataFields = [
  { 
    key: 'part', 
    label: 'Part', 
    type: 'select' as const, 
    options: variableFieldOptions.part,
    required: true
  },
  { 
    key: 'section', 
    label: 'Section', 
    type: 'text' as const,
    required: true
  },
  { 
    key: 'group', 
    label: 'Group', 
    type: 'select' as const, 
    options: variableFieldOptions.group,
    required: true
  },
  { 
    key: 'variable', 
    label: 'Variable', 
    type: 'text' as const,
    required: true
  },
  { 
    key: 'formatI', 
    label: 'Format I', 
    type: 'select' as const, 
    options: variableFieldOptions.formatI,
    required: true
  },
  { 
    key: 'formatII', 
    label: 'Format II', 
    type: 'select' as const, 
    options: variableFieldOptions.formatII,
    required: true
  },
  { 
    key: 'gType', 
    label: 'G-Type', 
    type: 'select' as const, 
    options: variableFieldOptions.gType,
    required: false
  },
  { 
    key: 'validation', 
    label: 'Validation', 
    type: 'select' as const, 
    options: variableFieldOptions.validation,
    required: false
  },
  { 
    key: 'default', 
    label: 'Default', 
    type: 'select' as const, 
    options: variableFieldOptions.default,
    required: false
  },
  { 
    key: 'graph', 
    label: 'Graph', 
    type: 'select' as const, 
    options: variableFieldOptions.graph,
    required: false
  }
];