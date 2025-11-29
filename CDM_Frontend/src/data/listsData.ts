// Lists data structure and mock data
export interface ListData {
  id: string;
  sector: string;
  domain: string;
  country: string;
  set: string;
  grouping: string;
  list: string;
  // Metadata fields
  format?: string;
  source?: string;
  upkeep?: string;
  graph?: string;
  origin?: string;
  // Parsed metadata fields
  status?: string;
  variables?: number; // Count of variables with HAS_LIST relationships (applicability)
  variablesAttachedList?: VariableAttached[];
  listValuesList?: ListValue[];
  tieredListsList?: TieredList[]; // Lists that are tiered under this list
  tiers?: string; // Comma-separated string of child tiered lists (for display in grid)
  variations?: number; // Count of variations
  variationsList?: Array<{ id?: string; name: string }>; // List of variations
  hasIncomingTier?: boolean; // True if this list is already a child of another list
  tierNumber?: number; // Tier number (1, 2, 3, etc.) if this is a tier list
  listType?: 'Single' | 'Multi-Level'; // Type of list
  numberOfLevels?: number; // Number of levels for Multi-Level lists
  tierNames?: string[]; // Names of tier lists (Tier 2, Tier 3, etc.)
  totalValuesCount?: number; // Total count of values (for single lists) or across all tiers (for multi-level)
  sampleValues?: string[]; // First 3 values for display (single lists) or first 3 tier 1 values (multi-level)
}

export interface VariableAttached {
  id: string;
  part: string;
  section: string;
  group: string;
  variable: string;
}

export interface ListValue {
  id: string;
  value: string;
}

export interface TieredList {
  id: string;
  set: string;
  grouping: string;
  list: string;
  listId?: string; // ID of the tiered list node
}

export const mockListData: ListData[] = [
  {
    id: '1',
    sector: 'ALL',
    domain: 'ALL',
    country: 'ALL',
    set: 'Geography',
    grouping: 'GICS',
    list: 'Country',
    format: 'Text',
    source: 'Internal',
    upkeep: 'Monthly',
    graph: 'Y',
    origin: 'System'
  },
  {
    id: '2',
    sector: 'ALL',
    domain: 'ALL',
    country: 'ALL',
    set: 'Geography',
    grouping: 'GICS',
    list: 'State',
    format: 'Text',
    source: 'Internal',
    upkeep: 'Monthly',
    graph: 'Y',
    origin: 'System'
  },
  {
    id: '3',
    sector: 'Technology',
    domain: 'Information Technology',
    country: 'United States',
    set: 'Industry',
    grouping: 'NAICS',
    list: 'Software Categories',
    format: 'List',
    source: 'External',
    upkeep: 'Quarterly',
    graph: 'N',
    origin: 'User'
  },
  {
    id: '4',
    sector: 'Healthcare',
    domain: 'Research & Development',
    country: 'United States',
    set: 'Rating',
    grouping: '-',
    list: 'Medical Specialties',
    format: 'Text',
    source: 'API',
    upkeep: 'Annually',
    graph: 'Conditional',
    origin: 'Import'
  },
  {
    id: '5',
    sector: 'Financial Services',
    domain: 'Finance & Accounting',
    country: 'ALL',
    set: 'Flag',
    grouping: 'ICB',
    list: 'Account Types',
    format: 'Special',
    source: 'Internal',
    upkeep: 'As Needed',
    graph: 'Y',
    origin: 'System'
  },
  {
    id: '6',
    sector: 'ALL',
    domain: 'ALL',
    country: 'Canada',
    set: 'Geography',
    grouping: 'GICS',
    list: 'Province',
    format: 'Text',
    source: 'Internal',
    upkeep: 'Monthly',
    graph: 'Y',
    origin: 'System'
  },
  {
    id: '7',
    sector: 'Manufacturing',
    domain: 'Operations',
    country: 'Germany',
    set: 'Industry',
    grouping: 'SIC',
    list: 'Product Categories',
    format: 'List',
    source: 'Manual',
    upkeep: 'Weekly',
    graph: 'N',
    origin: 'User'
  },
  {
    id: '8',
    sector: 'Retail',
    domain: 'Sales & Marketing',
    country: 'United Kingdom',
    set: 'Timing',
    grouping: '-',
    list: 'Seasonal Periods',
    format: 'Date',
    source: 'Calculated',
    upkeep: 'Quarterly',
    graph: 'Conditional',
    origin: 'Generated'
  },
  {
    id: '9',
    sector: 'ALL',
    domain: 'ALL',
    country: 'ALL',
    set: 'Lexicon',
    grouping: 'GICS',
    list: 'Status Codes',
    format: 'Flag',
    source: 'Internal',
    upkeep: 'As Needed',
    graph: 'Y',
    origin: 'System'
  },
  {
    id: '10',
    sector: 'Energy',
    domain: 'Operations',
    country: 'United States',
    set: 'Industry',
    grouping: 'NAICS',
    list: 'Energy Sources',
    format: 'Text',
    source: 'External',
    upkeep: 'Annually',
    graph: 'N',
    origin: 'Import'
  }
];

export const listColumns = [
  { key: 'sector', title: 'S', sortable: true, filterable: true, width: '80px' },
  { key: 'domain', title: 'D', sortable: true, filterable: true, width: '80px' },
  { key: 'country', title: 'C', sortable: true, filterable: true, width: '80px' },
  { key: 'set', title: 'Set', sortable: true, filterable: true, width: '140px' },
  { key: 'grouping', title: 'Grouping', sortable: true, filterable: true, width: '120px' },
  { key: 'list', title: 'List', sortable: true, filterable: true, width: '180px' },
  { key: 'tiers', title: 'Tiers', sortable: false, filterable: false, width: '200px' },
  { key: 'totalValuesCount', title: '# Values', sortable: true, filterable: false, width: '100px' },
  { key: 'sampleValues', title: 'Values', sortable: false, filterable: false, width: '200px' }
];

// Dropdown options for list fields
export const listFieldOptions = {
  set: ['Flag', 'Geography', 'Rating', 'Timing', 'Industry', 'Lexicon'],
  grouping: ['-', 'GICS', 'NAICS', 'SIC', 'ICB']
};

export const listMetadataFields = [
  { 
    key: 'format', 
    label: 'Format', 
    type: 'text' as const,
    required: false
  },
  { 
    key: 'source', 
    label: 'Source', 
    type: 'text' as const,
    required: false
  },
  { 
    key: 'upkeep', 
    label: 'Upkeep', 
    type: 'text' as const,
    required: false
  },
  { 
    key: 'graph', 
    label: 'Graph', 
    type: 'text' as const,
    required: false
  },
  { 
    key: 'origin', 
    label: 'Origin', 
    type: 'text' as const,
    required: false
  },
  { 
    key: 'set', 
    label: 'Set', 
    type: 'select' as const,
    options: listFieldOptions.set,
    required: false
  },
  { 
    key: 'grouping', 
    label: 'Grouping', 
    type: 'select' as const,
    options: listFieldOptions.grouping,
    required: false
  },
  { 
    key: 'list', 
    label: 'List', 
    type: 'text' as const,
    required: true
  }
];
