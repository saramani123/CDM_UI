// Variables data structure and mock data
export interface VariableData {
  id: string;
  // Drivers (concatenated from individual selections)
  driver: string;
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
  // Parsed driver fields for UI
  sector?: string[];
  domain?: string[];
  country?: string[];
  variableClarifier?: string;
  status?: string;
}

export interface ObjectRelationship {
  id: string;
  toBeing: string;
  toAvatar: string;
  toObject: string;
}

export const mockVariableData: VariableData[] = [
  {
    id: '1',
    driver: 'ALL, ALL, ALL, Employment Type',
    part: 'Identifier',
    section: 'CDM',
    group: '[Identifier]',
    variable: '[Identifier]',
    formatI: 'Special',
    formatII: 'Custom',
    gType: 'Loose',
    validation: 'Length',
    default: '',
    graph: 'Y',
    objectRelationships: 2,
    status: 'Active',
    variableClarifier: 'Employment Type',
    objectRelationshipsList: [
      {
        id: '1',
        toBeing: 'Master',
        toAvatar: 'Company',
        toObject: 'Company'
      }
    ]
  },
  {
    id: '2',
    driver: 'ALL, ALL, ALL, Pay Type',
    part: 'Identifier',
    section: 'CDM',
    group: '[Identifier]',
    variable: '[Identifier] #',
    formatI: 'List',
    formatII: 'Static',
    gType: 'Loose',
    validation: '',
    default: '',
    graph: '',
    objectRelationships: 1,
    status: 'Active',
    variableClarifier: 'Pay Type',
    objectRelationshipsList: []
  },
  {
    id: '3',
    driver: 'Technology, Human Resources, United States, Employment Type',
    part: 'Identifier',
    section: 'CDM',
    group: '[Identifier]',
    variable: '[Identifier] Variable Special',
    formatI: 'Text',
    formatII: 'Custom',
    gType: 'Loose',
    validation: '',
    default: '',
    graph: '',
    objectRelationships: 0,
    status: 'Active',
    variableClarifier: 'Employment Type',
    objectRelationshipsList: []
  },
  {
    id: '4',
    driver: 'Healthcare, Finance & Accounting, Canada, Pay Type',
    part: 'Identifier',
    section: 'CDM',
    group: 'Vulqan ID',
    variable: 'DB ID',
    formatI: 'Special',
    formatII: 'Custom',
    gType: 'Loose',
    validation: 'Length',
    default: '',
    graph: '',
    objectRelationships: 3,
    status: 'Active',
    variableClarifier: 'Pay Type',
    objectRelationshipsList: []
  },
  {
    id: '5',
    driver: 'Financial Services, Sales & Marketing, United Kingdom, Hour Type',
    part: 'Identifier',
    section: 'CDM',
    group: 'Vulqan ID',
    variable: 'Caption',
    formatI: 'Special',
    formatII: 'Custom',
    gType: 'Loose',
    validation: '',
    default: '',
    graph: '',
    objectRelationships: 1,
    status: 'Active',
    variableClarifier: 'Hour Type',
    objectRelationshipsList: []
  },
  {
    id: '6',
    driver: 'Manufacturing, Operations, Germany, None',
    part: 'Identifier',
    section: 'CDM',
    group: 'Vulqan ID',
    variable: 'Z ID',
    formatI: 'Special',
    formatII: 'Custom',
    gType: 'Loose',
    validation: '',
    default: '',
    graph: '',
    objectRelationships: 0,
    status: 'Active',
    variableClarifier: '',
    objectRelationshipsList: []
  },
  {
    id: '7',
    driver: 'ALL, ALL, ALL, None',
    part: 'Identifier',
    section: 'CDM',
    group: 'Name',
    variable: 'Name',
    formatI: 'Text',
    formatII: 'Free',
    gType: 'Loose',
    validation: '',
    default: '',
    graph: '',
    objectRelationships: 2,
    status: 'Active',
    variableClarifier: '',
    objectRelationshipsList: []
  },
  {
    id: '8',
    driver: 'Technology, Information Technology, United States, Pay Type',
    part: 'Identifier',
    section: 'CDM',
    group: 'Name Individual',
    variable: 'Name Prefix',
    formatI: 'List',
    formatII: 'Static',
    gType: 'Loose',
    validation: '',
    default: '',
    graph: '',
    objectRelationships: 1,
    status: 'Active',
    variableClarifier: 'Pay Type',
    objectRelationshipsList: []
  },
  {
    id: '9',
    driver: 'Insurance, Legal & Compliance, United States, Hour Type',
    part: 'Identifier',
    section: 'CDM',
    group: 'Name Individual',
    variable: 'First Name',
    formatI: 'Text',
    formatII: 'Free',
    gType: 'Loose',
    validation: '',
    default: '',
    graph: '',
    objectRelationships: 0,
    status: 'Active',
    variableClarifier: 'Hour Type',
    objectRelationshipsList: []
  },
  {
    id: '10',
    driver: 'ALL, ALL, ALL, None',
    part: 'Identifier',
    section: 'CDM',
    group: 'Name Individual',
    variable: 'Middle Name',
    formatI: 'Text',
    formatII: 'Free',
    gType: 'Loose',
    validation: '',
    default: '',
    graph: '',
    objectRelationships: 1,
    status: 'Active',
    variableClarifier: '',
    objectRelationshipsList: []
  }
];

export const variableColumns = [
  { key: 'driver', title: 'Drivers', sortable: true, filterable: true, width: '200px' },
  { key: 'part', title: 'Part', sortable: true, filterable: true, width: '120px' },
  { key: 'group', title: 'Group', sortable: true, filterable: true, width: '140px' },
  { key: 'section', title: 'Section', sortable: true, filterable: true, width: '120px' },
  { key: 'variable', title: 'Variable', sortable: true, filterable: true, width: '200px' },
  { key: 'formatI', title: 'Format I', sortable: true, filterable: true, width: '120px' },
  { key: 'formatII', title: 'Format II', sortable: true, filterable: true, width: '140px' },
  { key: 'gType', title: 'G-Type', sortable: true, filterable: true, width: '120px' },
  { key: 'objectRelationships', title: 'Relationships', sortable: true, filterable: false, width: '150px' }
];

// Dropdown options for variable fields
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
export const parseVariableDriverString = (driverString: string) => {
  const parts = driverString.split(', ').map(part => part.trim());
  
  return {
    sector: parts[0] === 'ALL' ? ['ALL'] : parts[0] ? [parts[0]] : [],
    domain: parts[1] === 'ALL' ? ['ALL'] : parts[1] ? [parts[1]] : [],
    country: parts[2] === 'ALL' ? ['ALL'] : parts[2] ? [parts[2]] : [],
    variableClarifier: parts[3] === 'None' ? '' : parts[3] || ''
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