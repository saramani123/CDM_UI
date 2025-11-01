// Utility functions for managing driver abbreviations
// Abbreviations are stored in localStorage (frontend-only, not persisted to Neo4j)

import { ColumnType } from '../data/driversData';

export interface DriverAbbreviations {
  sectors: Record<string, string>; // { "Transportation": "Transp.", ... }
  domains: Record<string, string>;
  countries: Record<string, string>;
}

const STORAGE_KEY = 'cdm_driver_abbreviations';

// Get all abbreviations from localStorage
export const getDriverAbbreviations = (): DriverAbbreviations => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        sectors: parsed.sectors || {},
        domains: parsed.domains || {},
        countries: parsed.countries || {}
      };
    }
  } catch (error) {
    console.error('Error loading driver abbreviations:', error);
  }
  
  return {
    sectors: {},
    domains: {},
    countries: {}
  };
};

// Save abbreviations to localStorage
export const saveDriverAbbreviations = (abbreviations: DriverAbbreviations): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(abbreviations));
  } catch (error) {
    console.error('Error saving driver abbreviations:', error);
  }
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
export const getGridDriverDisplayValue = (columnKey: string, fullName: string): string => {
  if (!fullName || fullName === 'ALL' || fullName === '-') {
    return fullName || '-';
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
    // Check if the value contains commas (multiple values)
    if (fullName.includes(',')) {
      // Split by comma and process each value
      const values = fullName.split(',').map(v => v.trim()).filter(Boolean);
      const displayValues = values.map(value => {
        const abbreviation = getDriverAbbreviation(type!, value);
        return abbreviation || value;
      });
      return displayValues.join(', ');
    } else {
      // Single value - just get abbreviation if available
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

