// Lists data structure and mock data
export interface ListData {
  id: string;
  driver: string;
  objectType: string;
  clarifier: string;
  variable: string;
  set: string;
  grouping: string;
  list: string;
  // Parsed metadata fields
  status?: string;
  variablesAttachedList?: VariableAttached[];
  listValuesList?: ListValue[];
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

export const mockListData: ListData[] = [];

export const listColumns = [
  { key: 'driver', title: 'Driver', sortable: true, filterable: true, width: '160px' },
  { key: 'objectType', title: 'Object Type', sortable: true, filterable: true, width: '140px' },
  { key: 'clarifier', title: 'Clarifier', sortable: true, filterable: true, width: '120px' },
  { key: 'set', title: 'Set', sortable: true, filterable: true, width: '140px' },
  { key: 'grouping', title: 'Grouping', sortable: true, filterable: true, width: '120px' },
  { key: 'list', title: 'List', sortable: true, filterable: true, width: '180px' }
];

// Dropdown options for list fields
export const listFieldOptions = {
  driver: ['***, ***, ***, ***'],
  objectType: ['*', 'ANY', 'Security', 'Person', 'Company', 'Product'],
  clarifier: ['*', 'ANY', 'Bond', 'Stock', 'Option', 'Future'],
  set: ['Flag', 'Geography', 'Rating', 'Timing', 'Industry', 'Lexicon'],
  grouping: ['-', 'GICS', 'NAICS', 'SIC', 'ICB']
};

export const listMetadataFields = [
  { 
    key: 'driver', 
    label: 'Driver', 
    type: 'select' as const, 
    options: listFieldOptions.driver,
    required: true
  },
  { 
    key: 'objectType', 
    label: 'Object Type', 
    type: 'select' as const, 
    options: listFieldOptions.objectType,
    required: true
  },
  { 
    key: 'clarifier', 
    label: 'Clarifier', 
    type: 'select' as const, 
    options: listFieldOptions.clarifier,
    required: true
  },
  { 
    key: 'format', 
    label: 'Format', 
    type: 'select' as const, 
    options: ['Text', 'Number', 'Date', 'Boolean', 'List', 'Special'],
    required: true
  },
  { 
    key: 'set', 
    label: 'Set', 
    type: 'select' as const,
    options: listFieldOptions.set,
    required: true
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
  },
  { 
    key: 'source', 
    label: 'Source', 
    type: 'select' as const,
    options: ['Internal', 'External', 'API', 'Manual', 'Calculated'],
    required: false
  },
  { 
    key: 'upkeep', 
    label: 'Upkeep', 
    type: 'select' as const,
    options: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually', 'As Needed'],
    required: false
  },
  { 
    key: 'graph', 
    label: 'Graph', 
    type: 'select' as const,
    options: ['Y', 'N', 'Conditional'],
    required: false
  },
  { 
    key: 'origin', 
    label: 'Origin', 
    type: 'select' as const,
    options: ['System', 'User', 'Import', 'Migration', 'Generated'],
    required: false
  }
];
