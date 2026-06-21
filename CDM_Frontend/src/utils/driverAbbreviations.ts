// Utility functions for reading driver abbreviations.
//
// Abbreviations are OPTIONAL properties stored on the Sector/Domain/Country nodes
// in Neo4j (the source of truth). They are loaded into an in-memory cache at app
// startup (and refreshed after edits) so the grids can resolve them synchronously.
// When an abbreviation exists for a given value it is what the S/D/C columns show.

import { ColumnType } from '../data/driversData';
import { getDriversData } from '../data/mockData';
import { apiService } from '../services/api';

export interface DriverAbbreviations {
  sectors: Record<string, string>; // { "Transportation": "Transp.", ... }
  domains: Record<string, string>;
  countries: Record<string, string>;
}

// In-memory cache, populated from the backend node properties.
let abbreviationCache: DriverAbbreviations = {
  sectors: {},
  domains: {},
  countries: {}
};

// Get all abbreviations from the in-memory cache.
export const getDriverAbbreviations = (): DriverAbbreviations => {
  return {
    sectors: { ...abbreviationCache.sectors },
    domains: { ...abbreviationCache.domains },
    countries: { ...abbreviationCache.countries }
  };
};

// Replace the in-memory cache (used internally after loading from backend).
export const saveDriverAbbreviations = (abbreviations: DriverAbbreviations): void => {
  abbreviationCache = {
    sectors: { ...(abbreviations.sectors || {}) },
    domains: { ...(abbreviations.domains || {}) },
    countries: { ...(abbreviations.countries || {}) }
  };
};

// Load abbreviations from the Neo4j-backed driver nodes into the cache.
export const loadDriverAbbreviationsFromBackend = async (): Promise<DriverAbbreviations> => {
  const next: DriverAbbreviations = { sectors: {}, domains: {}, countries: {} };
  const types: ColumnType[] = ['sectors', 'domains', 'countries'];
  try {
    const results = await Promise.all(
      types.map(t => apiService.getDriverDetails(t).catch(() => []))
    );
    types.forEach((type, i) => {
      const list = Array.isArray(results[i]) ? (results[i] as any[]) : [];
      list.forEach(item => {
        if (item && item.name && item.abbreviation) {
          (next as any)[type][item.name] = item.abbreviation;
        }
      });
    });
  } catch (error) {
    console.error('Error loading driver abbreviations from backend:', error);
  }
  abbreviationCache = next;
  return getDriverAbbreviations();
};

// Get abbreviation for a specific driver
export const getDriverAbbreviation = (type: ColumnType, fullName: string): string | undefined => {
  const abbreviations = getDriverAbbreviations();
  
  switch (type) {
    case 'sectors':
      return abbreviations.sectors[fullName];
    case 'domains':
      return abbreviations.domains[fullName];
    case 'countries':
      return abbreviations.countries[fullName];
    default:
      return undefined;
  }
};

// Set abbreviation for a specific driver
export const setDriverAbbreviation = (type: ColumnType, fullName: string, abbreviation: string): void => {
  const abbreviations = getDriverAbbreviations();
  
  switch (type) {
    case 'sectors':
      abbreviations.sectors[fullName] = abbreviation.trim();
      break;
    case 'domains':
      abbreviations.domains[fullName] = abbreviation.trim();
      break;
    case 'countries':
      abbreviations.countries[fullName] = abbreviation.trim();
      break;
  }
  
  saveDriverAbbreviations(abbreviations);
};

// Remove abbreviation for a specific driver
export const removeDriverAbbreviation = (type: ColumnType, fullName: string): void => {
  const abbreviations = getDriverAbbreviations();
  
  switch (type) {
    case 'sectors':
      delete abbreviations.sectors[fullName];
      break;
    case 'domains':
      delete abbreviations.domains[fullName];
      break;
    case 'countries':
      delete abbreviations.countries[fullName];
      break;
  }
  
  saveDriverAbbreviations(abbreviations);
};

// Get display value (abbreviation if available, otherwise full name)
export const getDriverDisplayValue = (type: ColumnType, fullName: string): string => {
  if (!fullName || fullName === 'ALL' || fullName === '-') {
    return fullName || '-';
  }
  
  const abbreviation = getDriverAbbreviation(type, fullName);
  return abbreviation || fullName;
};

// Get display value for grid cells (sector, domain, country columns)
// Handles comma-separated values like "Finance, Healthcare, Retail"
// Shows "All" if all possible values are selected
export const getGridDriverDisplayValue = (columnKey: string, fullName: string): string => {
  if (!fullName || fullName === '-') {
    return fullName || '-';
  }
  
  // Handle 'ALL' case - display as 'ALL' in the grid
  if (fullName === 'ALL') {
    return 'ALL';
  }
  
  // Map column keys to ColumnType
  let type: ColumnType | null = null;
  if (columnKey === 'sector') {
    type = 'sectors';
  } else if (columnKey === 'domain') {
    type = 'domains';
  } else if (columnKey === 'country') {
    type = 'countries';
  }
  
  if (type) {
    // Get all possible values for this type from driversData
    // Filter out "ALL" as it's not an actual value, just a UI convenience
    const driversData = getDriversData();
    const allPossibleValues: string[] = (driversData[type] || []).filter(v => v !== 'ALL');
    
    // Check if the value contains commas (multiple values)
    if (fullName.includes(',')) {
      // Split by comma and process each value
      // Handle both "Value1, Value2" and "Value1,Value2" formats
      const values = fullName.split(',').map(v => v.trim()).filter(Boolean).filter(v => v !== 'ALL');
      
      // If no values remain after filtering, return "ALL"
      if (values.length === 0) {
        return 'ALL';
      }
      
      // Check if all possible values are selected (compare sets)
      // Only do this check if we have driver data loaded
      if (allPossibleValues.length > 0) {
        const selectedSet = new Set(values);
        const allSet = new Set(allPossibleValues);
        const isAllSelected = selectedSet.size === allSet.size && 
                             selectedSet.size > 0 &&
                             [...selectedSet].every(val => allSet.has(val));
        
        if (isAllSelected) {
          console.log(`[getGridDriverDisplayValue] Normalized ${columnKey} to ALL:`, { fullName, values: Array.from(selectedSet), allValues: Array.from(allSet) });
          return 'ALL';
        } else {
          console.log(`[getGridDriverDisplayValue] Not all selected for ${columnKey}:`, { fullName, selectedCount: selectedSet.size, allCount: allSet.size, selected: Array.from(selectedSet).slice(0, 5), all: Array.from(allSet).slice(0, 5) });
        }
      } else {
        console.warn(`[getGridDriverDisplayValue] No driver data available for ${columnKey}, cannot normalize. fullName:`, fullName);
      }
      
      // Not all values selected (or driver data not loaded yet) - show formatted comma-separated string
      const displayValues = values.map(value => {
        const abbreviation = getDriverAbbreviation(type!, value);
        return abbreviation || value;
      });
      return displayValues.join(', ');
    } else {
      // Single value - if it's "ALL", return "ALL", otherwise get abbreviation
      if (fullName === 'ALL') {
        return 'ALL';
      }
      const abbreviation = getDriverAbbreviation(type, fullName);
      return abbreviation || fullName;
    }
  }
  
  return fullName;
};

// Update abbreviation when a driver name is renamed
export const renameDriverAbbreviation = (
  type: ColumnType,
  oldName: string,
  newName: string
): void => {
  const abbreviations = getDriverAbbreviations();
  
  switch (type) {
    case 'sectors':
      if (abbreviations.sectors[oldName]) {
        abbreviations.sectors[newName] = abbreviations.sectors[oldName];
        delete abbreviations.sectors[oldName];
      }
      break;
    case 'domains':
      if (abbreviations.domains[oldName]) {
        abbreviations.domains[newName] = abbreviations.domains[oldName];
        delete abbreviations.domains[oldName];
      }
      break;
    case 'countries':
      if (abbreviations.countries[oldName]) {
        abbreviations.countries[newName] = abbreviations.countries[oldName];
        delete abbreviations.countries[oldName];
      }
      break;
  }
  
  saveDriverAbbreviations(abbreviations);
};

