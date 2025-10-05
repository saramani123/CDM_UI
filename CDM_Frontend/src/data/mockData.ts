// Real data structure based on your sample data
export interface ObjectData {
  id: string;
  driver: string;
  being: string;
  avatar: string;
  object: string;
  relationships: number;
  variants: number;
  variables: number;
  // Parsed metadata fields
  sector?: string;
  domain?: string;
  country?: string;
  classifier?: string;
  identifier?: string;
  discret?: string;
  status?: string;
  relationshipsList?: Relationship[];
  variantsList?: Variant[];
}

export interface Relationship {
  id: string;
  type: 'Blood' | 'Intra-Table' | 'Inter-Table';
  role: string;
  toBeing: string;
  toAvatar: string;
  toObject: string;
}

export interface Variant {
  id: string;
  name: string;
}

export const mockObjectData: ObjectData[] = [
  {
    id: '1',
    driver: 'ALL, ALL, ALL, Employment Type',
    being: 'Master',
    avatar: 'Company',
    object: 'Company',
    relationships: 13,
    variants: 23,
    variables: 54,
    status: 'Active',
    relationshipsList: [
      {
        id: '1',
        type: 'Inter-Table',
        role: 'Employer',
        toBeing: 'Master',
        toAvatar: 'Employee',
        toObject: 'Employee'
      },
      {
        id: '2',
        type: 'Inter-Table',
        role: 'Owner',
        toBeing: 'Master',
        toAvatar: 'Product',
        toObject: 'Product'
      }
    ],
    variantsList: [
      {
        id: '1',
        name: 'Public Company'
      },
      {
        id: '2',
        name: 'Private Company'
      }
    ]
  },
  {
    id: '2',
    driver: 'ALL, ALL, ALL, Pay Type',
    being: 'Employee',
    avatar: 'Company Affiliate',
    object: 'Entity',
    relationships: 1,
    variants: 2,
    variables: 45,
    status: 'Active',
    relationshipsList: [],
    variantsList: []
  },
  {
    id: '3',
    driver: 'Technology, Human Resources, United States, Employment Type',
    being: 'Master',
    avatar: 'Company Affiliate',
    object: 'Department',
    relationships: 13,
    variants: 23,
    variables: 54,
    status: 'Active',
    relationshipsList: []
  },
  {
    id: '4',
    driver: 'Healthcare, Finance & Accounting, Canada, Pay Type',
    being: 'Customer',
    avatar: 'Company Affiliate',
    object: 'Team',
    relationships: 30,
    variants: 19,
    variables: 54,
    status: 'Active',
    relationshipsList: []
  },
  {
    id: '5',
    driver: 'Financial Services, Sales & Marketing, United Kingdom, Hour Type',
    being: 'Supplier',
    avatar: 'Company Affiliate',
    object: 'Region',
    relationships: 39,
    variants: 23,
    variables: 54,
    status: 'Active',
    relationshipsList: []
  },
  {
    id: '6',
    driver: 'Manufacturing, Operations, Germany, None',
    being: 'Product',
    avatar: 'Company Affiliate',
    object: 'Location',
    relationships: 13,
    variants: 23,
    variables: 20,
    status: 'Active',
    relationshipsList: []
  },
  {
    id: '7',
    driver: 'ALL, ALL, ALL, Employment Type',
    being: 'Master',
    avatar: 'Employee',
    object: 'Employee',
    relationships: 6,
    variants: 11,
    variables: 54,
    status: 'Active',
    relationshipsList: []
  },
  {
    id: '8',
    driver: 'Technology, Information Technology, United States, Pay Type',
    being: 'Master',
    avatar: 'Employee',
    object: 'Employee',
    relationships: 13,
    variants: 23,
    variables: 54,
    status: 'Active',
    relationshipsList: []
  },
  {
    id: '9',
    driver: 'Insurance, Legal & Compliance, United States, Hour Type',
    being: 'Master',
    avatar: 'Employee',
    object: 'Employee',
    relationships: 34,
    variants: 23,
    variables: 35,
    status: 'Active',
    relationshipsList: []
  },
  {
    id: '10',
    driver: 'ALL, ALL, ALL, None',
    being: 'Master',
    avatar: 'Product',
    object: 'Product',
    relationships: 13,
    variants: 23,
    variables: 54,
    status: 'Active',
    relationshipsList: [],
    variantsList: []
  }
];

export const tabs = [
  { id: 'drivers', label: 'Drivers', count: 15 },
  { id: 'objects', label: 'Objects', count: 23 },
  { id: 'variables', label: 'Variables', count: 156 },
  { id: 'lists', label: 'Lists', count: 45 },
  { id: 'functions', label: 'Functions' },
  { id: 'ledgers', label: 'Ledgers' },
  { id: 'sources', label: 'Sources' }
];

export const objectColumns = [
  { key: 'driver', title: 'Driver', sortable: true, filterable: true, width: '200px' },
  { key: 'being', title: 'Being', sortable: true, filterable: true, width: '120px' },
  { key: 'avatar', title: 'Avatar', sortable: true, filterable: true, width: '180px' },
  { key: 'object', title: 'Object', sortable: true, filterable: true, width: '140px' },
  { key: 'relationships', title: 'Relationships', sortable: true, filterable: false, width: '160px' },
  { key: 'variants', title: 'Variants', sortable: true, filterable: false, width: '120px' },
  { key: 'variables', title: 'Variables', sortable: true, filterable: false, width: '140px' }
];

// Helper function to parse driver field into metadata components
export const parseDriverField = (driver: string) => {
  const parts = driver.split(',').map(part => part.trim());
  return {
    sector: parts[0] !== '***' ? parts[0] : '',
    domain: parts[1] !== '***' ? parts[1] : '',
    country: parts[2] !== '***' ? parts[2] : '',
    classifier: parts[3] !== '***' ? parts[3] : ''
  };
};

// Dropdown options based on your data patterns
export const getAvatarOptions = (being: string, driver: string): string[] => {
  // For now, only handle the default driver case
  if (driver === '***, ***, ***, ***') {
    switch (being) {
      case 'Master':
        return ['Company', 'Company Affiliate', 'Employee', 'Product', 'Customer', 'Supplier'];
      case 'Mate':
        return ['Person', 'Thing', 'Reference', 'Register'];
      case 'Process':
        return ['Activity', 'Transaction', 'Payment', 'Posting'];
      case 'Adjunct':
        return ['Account', 'Attribute'];
      case 'Rule':
        return ['Trigger', 'Validator'];
      case 'Roster':
        return ['List'];
      default:
        return ['Company', 'Company Affiliate', 'Employee', 'Product', 'Customer', 'Supplier'];
    }
  }
  
  // Default fallback for other drivers
  return ['Company', 'Company Affiliate', 'Employee', 'Product', 'Customer', 'Supplier'];
};

// Helper function to get drivers data for dropdowns
export const getDriversData = (): { sectors: string[]; domains: string[]; countries: string[]; objectClarifiers: string[]; variableClarifiers: string[] } => {
  // Get the real drivers data from the global state
  const driversData = (window as any).driversData;
  
  if (driversData && driversData.sectors && driversData.sectors.length > 0) {
    return {
      sectors: driversData.sectors,
      domains: driversData.domains,
      countries: driversData.countries,
      objectClarifiers: driversData.objectClarifiers,
      variableClarifiers: driversData.variableClarifiers
    };
  }
  
  // Fallback to mock data if real data is not available
  return {
    sectors: ['Technology', 'Healthcare', 'Financial Services', 'Manufacturing', 'Retail', 'Energy', 'Transportation', 'Real Estate', 'Education', 'Government', 'Agriculture', 'Entertainment', 'Telecommunications', 'Construction', 'Hospitality'],
    domains: ['Human Resources', 'Finance & Accounting', 'Sales & Marketing', 'Operations', 'Information Technology', 'Legal & Compliance', 'Research & Development', 'Customer Service', 'Supply Chain', 'Quality Assurance', 'Business Intelligence', 'Risk Management', 'Strategic Planning', 'Project Management', 'Data Management'],
    countries: ['United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Japan', 'Australia', 'Brazil', 'India', 'China', 'Mexico', 'Italy', 'Spain', 'Netherlands', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Switzerland'],
    objectClarifiers: ['Employment Type', 'Pay Type', 'Hour Type'],
    variableClarifiers: ['Employment Type', 'Pay Type', 'Hour Type', 'None']
  };
};

// Helper function to concatenate driver selections
export const concatenateDrivers = (sector: string[], domain: string[], country: string[], objectClarifier: string) => {
  const sectorStr = sector.includes('ALL') || sector.length === 0 ? 'ALL' : sector.join(', ');
  const domainStr = domain.includes('ALL') || domain.length === 0 ? 'ALL' : domain.join(', ');
  const countryStr = country.includes('ALL') || country.length === 0 ? 'ALL' : country.join(', ');
  const clarifierStr = objectClarifier || 'None';
  
  return `${sectorStr}, ${domainStr}, ${countryStr}, ${clarifierStr}`;
};

// Helper function to parse driver string back to selections
export const parseDriverString = (driverString: string) => {
  const parts = driverString.split(', ').map(part => part.trim());
  
  // Get all available driver options to determine what "ALL" should include
  const driversData = getDriversData();
  
  return {
    sector: parts[0] === 'ALL' ? ['ALL', ...driversData.sectors] : parts[0] ? [parts[0]] : [],
    domain: parts[1] === 'ALL' ? ['ALL', ...driversData.domains] : parts[1] ? [parts[1]] : [],
    country: parts[2] === 'ALL' ? ['ALL', ...driversData.countries] : parts[2] ? [parts[2]] : [],
    objectClarifier: parts[3] === 'None' ? '' : parts[3] || ''
  };
};

export const metadataFields = [
  { 
    key: 'being', 
    label: 'Being', 
    type: 'select' as const, 
    options: ['Master', 'Mate', 'Process', 'Adjunct', 'Rule', 'Roster'] 
  },
  { 
    key: 'avatar', 
    label: 'Avatar', 
    type: 'select' as const, 
    options: [] // Will be populated dynamically based on being + driver
  },
  { 
    key: 'objectName', 
    label: 'Object Name', 
    type: 'text' as const 
  }
]