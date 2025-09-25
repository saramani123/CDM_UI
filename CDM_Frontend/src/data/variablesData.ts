// Variables data structure and mock data
export interface VariableData {
  id: string;
  driver: string;
  clarifier: string;
  part: string;
  section: string;
  group: string;
  variable: string;
  formatI: string;
  formatII: string;
  gType: string;
  validation?: string;
  default?: string;
  graph?: string;
  objectRelationships: number;
  // Parsed metadata fields
  sector?: string;
  domain?: string;
  country?: string;
  classifier?: string;
  status?: string;
  objectRelationshipsList?: ObjectRelationship[];
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
    driver: '***, ***, ***, ***',
    clarifier: 'ANY',
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
    driver: '***, ***, ***, ***',
    clarifier: 'ANY',
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
    objectRelationshipsList: []
  },
  {
    id: '3',
    driver: '***, ***, ***, ***',
    clarifier: 'ANY',
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
    objectRelationshipsList: []
  },
  {
    id: '4',
    driver: '***, ***, ***, ***',
    clarifier: 'ANY',
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
    objectRelationshipsList: []
  },
  {
    id: '5',
    driver: '***, ***, ***, ***',
    clarifier: 'ANY',
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
    objectRelationshipsList: []
  },
  {
    id: '6',
    driver: '***, ***, ***, ***',
    clarifier: 'ANY',
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
    objectRelationshipsList: []
  },
  {
    id: '7',
    driver: '***, ***, ***, ***',
    clarifier: 'ANY',
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
    objectRelationshipsList: []
  },
  {
    id: '8',
    driver: '***, ***, ***, ***',
    clarifier: 'ANY',
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
    objectRelationshipsList: []
  },
  {
    id: '9',
    driver: '***, ***, ***, ***',
    clarifier: 'ANY',
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
    objectRelationshipsList: []
  },
  {
    id: '10',
    driver: '***, ***, ***, ***',
    clarifier: 'ANY',
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
    objectRelationshipsList: []
  }
];

export const variableColumns = [
  { key: 'driver', title: 'Driver', sortable: true, filterable: true, width: '160px' },
  { key: 'clarifier', title: 'Clarifier', sortable: true, filterable: true, width: '120px' },
  { key: 'part', title: 'Part', sortable: true, filterable: true, width: '140px' },
  { key: 'section', title: 'Section', sortable: true, filterable: true, width: '120px' },
  { key: 'group', title: 'Group', sortable: true, filterable: true, width: '160px' },
  { key: 'variable', title: 'Variable', sortable: true, filterable: true, width: '220px' },
  { key: 'formatI', title: 'Format I', sortable: true, filterable: true, width: '120px' },
  { key: 'formatII', title: 'Format II', sortable: true, filterable: true, width: '140px' },
  { key: 'gType', title: 'G-Type', sortable: true, filterable: true, width: '120px' },
  { key: 'objectRelationships', title: 'Object Relationships', sortable: true, filterable: false, width: '200px' }
];

// Dropdown options for variable fields
export const variableFieldOptions = {
  driver: ['***, ***, ***, ***'],
  clarifier: ['ANY', 'SPECIFIC', 'CONDITIONAL'],
  part: ['Identifier', 'Attribute', 'Measure', 'Reference'],
  section: ['CDM', 'Business', 'Technical', 'Operational'],
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

export const variableMetadataFields = [
  { 
    key: 'driver', 
    label: 'Driver', 
    type: 'select' as const, 
    options: variableFieldOptions.driver,
    required: true
  },
  { 
    key: 'clarifier', 
    label: 'Clarifier', 
    type: 'select' as const, 
    options: variableFieldOptions.clarifier,
    required: true
  },
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
    type: 'select' as const, 
    options: variableFieldOptions.section,
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