import React from 'react';

// Real data structure based on your sample data
export interface ObjectData {
  id: string;
  driver: string; // Keep for backend compatibility
  being: string;
  avatar: string;
  object: string;
  relationships: number;
  variants: number;
  variables: number;
  // Parsed metadata fields for display
  sector?: string;
  domain?: string;
  country?: string;
  classifier?: string;
  identifier?: string;
  discret?: string;
  status?: string;
  relationshipsList?: Relationship[];
  variantsList?: Variant[];
  isMeme?: boolean; // Meme flag
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

export const mockObjectData: ObjectData[] = [];

export const objectColumns = [
  { key: 'sector', title: 'S', sortable: true, filterable: true, width: '140px' },
  { key: 'domain', title: 'D', sortable: true, filterable: true, width: '140px' },
  { key: 'country', title: 'C', sortable: true, filterable: true, width: '140px' },
  { key: 'being', title: 'Being', sortable: true, filterable: true, width: '120px' },
  { key: 'avatar', title: 'Avatar', sortable: true, filterable: true, width: '180px' },
  { key: 'object', title: 'Object', sortable: true, filterable: true, width: '140px' },
  { key: 'isMeme', title: 'Meme', sortable: true, filterable: true, width: '100px' },
  { key: 'relationships', title: 'Relationships', sortable: true, filterable: false, width: '160px' },
  { key: 'variants', title: 'Variants', sortable: true, filterable: false, width: '120px' },
  { 
    key: 'variantsEx', 
    title: 'Variants ex.', 
    sortable: true, 
    filterable: false, 
    width: '200px',
    render: (row: any) => {
      const variantsList = row.variantsList || [];
      if (!variantsList || variantsList.length === 0) {
        return <span>-</span>;
      }
      
      // Get variant names (handle both string and object formats)
      const variantNames = variantsList
        .map((v: any) => typeof v === 'string' ? v : v.name)
        .filter((name: string) => name && name.trim());
      
      if (variantNames.length === 0) {
        return <span>-</span>;
      }
      
      // Limit to first 3 variants
      const displayValues = variantNames.slice(0, 3);
      const displayText = displayValues.join(', ');
      
      return <span>{displayText}</span>;
    }
  },
  { key: 'variables', title: 'Variables', sortable: true, filterable: false, width: '140px' }
];

// Helper function to parse driver field into metadata components
const parseDriverSelections = (driver: string): { sectorValues: string[]; domainValues: string[]; countryValues: string[] } => {
  if (!driver || !driver.trim()) {
    return { sectorValues: [], domainValues: [], countryValues: [] };
  }

  const { sectors, domains, countries } = getDriversData();
  const sectorSet = new Set(sectors);
  const domainSet = new Set(domains);
  const countrySet = new Set(countries);

  const tokens = driver
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  // Driver string format is "Sector, Domain, Country, None"
  // Keep backward compatibility with trailing clarifier-like segment.
  const coreTokens =
    tokens.length > 0 && tokens[tokens.length - 1].toLowerCase() === 'none'
      ? tokens.slice(0, -1)
      : tokens;

  const isValidField = (fieldTokens: string[], allowed: Set<string>): boolean => {
    if (fieldTokens.length === 0) return false;
    if (fieldTokens.length === 1 && fieldTokens[0] === 'ALL') return true;
    if (fieldTokens.includes('ALL')) return false;
    return fieldTokens.every((t) => allowed.has(t));
  };

  if (coreTokens.length >= 3) {
    for (let i = 1; i <= coreTokens.length - 2; i++) {
      for (let j = i + 1; j <= coreTokens.length - 1; j++) {
        const sectorTokens = coreTokens.slice(0, i);
        const domainTokens = coreTokens.slice(i, j);
        const countryTokens = coreTokens.slice(j);

        if (
          isValidField(sectorTokens, sectorSet) &&
          isValidField(domainTokens, domainSet) &&
          isValidField(countryTokens, countrySet)
        ) {
          return {
            sectorValues: sectorTokens,
            domainValues: domainTokens,
            countryValues: countryTokens
          };
        }
      }
    }
  }

  // Fallback for legacy/invalid strings.
  return {
    sectorValues: coreTokens.length > 0 ? [coreTokens[0]] : [],
    domainValues: coreTokens.length > 1 ? [coreTokens[1]] : [],
    countryValues: coreTokens.length > 2 ? [coreTokens[2]] : []
  };
};

export const parseDriverField = (driver: string) => {
  if (!driver) {
    return {
      sector: '',
      domain: '',
      country: '',
      classifier: ''
    };
  }

  const { sectorValues, domainValues, countryValues } = parseDriverSelections(driver);
  return {
    sector: sectorValues.join(', '),
    domain: domainValues.join(', '),
    country: countryValues.join(', '),
    classifier: ''
  };
};

// Dropdown options based on actual data from objects
export const getAvatarOptions = (being: string, _driver: string, allData: any[] = []): string[] => {
  // If we have actual data, use it to get distinct avatars for the selected being
  if (allData && allData.length > 0 && being) {
    const distinctAvatars = [...new Set(
      allData
        .filter(obj => obj.being === being)
        .map(obj => obj.avatar)
        .filter(Boolean)
    )];
    return distinctAvatars.length > 0 ? distinctAvatars : [];
  }
  
  // Fallback to hardcoded values if no data available
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
  
  // In production, return empty arrays to show empty dropdowns
  if (import.meta.env.PROD) {
    return {
      sectors: [],
      domains: [],
      countries: [],
      objectClarifiers: [],
      variableClarifiers: []
    };
  }
  
  // Fallback to mock data only in development
  return {
    sectors: ['Technology', 'Healthcare', 'Financial Services', 'Manufacturing', 'Retail', 'Energy', 'Transportation', 'Real Estate', 'Education', 'Government', 'Agriculture', 'Entertainment', 'Telecommunications', 'Construction', 'Hospitality'],
    domains: ['Human Resources', 'Finance & Accounting', 'Sales & Marketing', 'Operations', 'Information Technology', 'Legal & Compliance', 'Research & Development', 'Customer Service', 'Supply Chain', 'Quality Assurance', 'Business Intelligence', 'Risk Management', 'Strategic Planning', 'Project Management', 'Data Management'],
    countries: ['United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Japan', 'Australia', 'Brazil', 'India', 'China', 'Mexico', 'Italy', 'Spain', 'Netherlands', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Switzerland'],
    objectClarifiers: ['Employment Type', 'Pay Type', 'Hour Type'],
    variableClarifiers: ['Employment Type', 'Pay Type', 'Hour Type', 'None']
  };
};

// Helper function to concatenate driver selections
export const concatenateDrivers = (sector: string[], domain: string[], country: string[]) => {
  const sectorStr = sector.includes('ALL') || sector.length === 0 ? 'ALL' : sector.join(', ');
  const domainStr = domain.includes('ALL') || domain.length === 0 ? 'ALL' : domain.join(', ');
  const countryStr = country.includes('ALL') || country.length === 0 ? 'ALL' : country.join(', ');
  
  return `${sectorStr}, ${domainStr}, ${countryStr}, None`;
};

// Helper function to parse driver string into components
export const parseDriverString = (driverString: string) => {
  if (!driverString) {
    return {
      sector: [],
      domain: [],
      country: []
    };
  }

  const { sectorValues, domainValues, countryValues } = parseDriverSelections(driverString);
  return {
    sector: sectorValues.filter((v) => v && v !== '-'),
    domain: domainValues.filter((v) => v && v !== '-'),
    country: countryValues.filter((v) => v && v !== '-')
  };
};

// Metadata fields for object editing
export const metadataFields = [
  { key: 'object', label: 'Object', type: 'text' as const, required: true },
  { key: 'being', label: 'Being', type: 'text' as const, required: true },
  { key: 'avatar', label: 'Avatar', type: 'text' as const, required: true },
  { key: 'sector', label: 'Sector', type: 'text' as const, required: false },
  { key: 'domain', label: 'Domain', type: 'text' as const, required: false },
  { key: 'country', label: 'Country', type: 'text' as const, required: false },
  { key: 'classifier', label: 'Classifier', type: 'text' as const, required: false },
  { key: 'identifier', label: 'Identifier', type: 'text' as const, required: false },
  { key: 'discret', label: 'Discret', type: 'text' as const, required: false },
  { key: 'status', label: 'Status', type: 'select' as const, options: ['Active', 'Inactive', 'Draft'], required: false }
];

// Helper function to get metadata fields for a specific object
export const getMetadataFields = (object: ObjectData) => {
  return metadataFields.map(field => ({
    ...field,
    value: object[field.key as keyof ObjectData] || ''
  }));
};