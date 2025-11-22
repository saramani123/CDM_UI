// Drivers data structure and mock data
export interface DriversData {
  sectors: string[];
  domains: string[];
  countries: string[];
  objectClarifiers: string[];
  variableClarifiers: string[];
}

export const driversData: DriversData = {
  sectors: [],
  domains: [],
  countries: [],
  objectClarifiers: [],
  variableClarifiers: []
};

export type ColumnType = 'sectors' | 'domains' | 'countries' | 'objectClarifiers' | 'variableClarifiers';

export const columnLabels: Record<ColumnType, string> = {
  sectors: 'Sector',
  domains: 'Domain', 
  countries: 'Country',
  objectClarifiers: '',
  variableClarifiers: ''
};