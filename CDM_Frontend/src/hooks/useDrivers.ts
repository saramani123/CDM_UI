import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { DriversData, ColumnType } from '../data/driversData';

export const useDrivers = () => {
  const [drivers, setDrivers] = useState<DriversData>({
    sectors: [],
    domains: [],
    countries: [],
    objectClarifiers: [],
    variableClarifiers: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all driver types in parallel
      const [sectors, domains, countries, objectClarifiers, variableClarifiers] = await Promise.all([
        apiService.getDrivers('sectors'),
        apiService.getDrivers('domains'),
        apiService.getDrivers('countries'),
        apiService.getDrivers('objectClarifiers'),
        apiService.getDrivers('variableClarifiers')
      ]);
      
      setDrivers({
        sectors: sectors || [],
        domains: domains || [],
        countries: countries || [],
        objectClarifiers: objectClarifiers || [],
        variableClarifiers: variableClarifiers || []
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch drivers');
      console.error('Error fetching drivers:', err);
    } finally {
      setLoading(false);
    }
  };

  const createDriver = async (type: ColumnType, name: string) => {
    try {
      await apiService.createDriver(type, { name });
      // Refresh the specific driver type
      const updatedDrivers = await apiService.getDrivers(type);
      setDrivers(prev => ({
        ...prev,
        [type]: updatedDrivers || []
      }));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to create ${type}`);
      throw err;
    }
  };

  const updateDriver = async (type: ColumnType, oldName: string, newName: string) => {
    try {
      await apiService.updateDriver(type, oldName, { name: newName });
      // Refresh the specific driver type
      const updatedDrivers = await apiService.getDrivers(type);
      setDrivers(prev => ({
        ...prev,
        [type]: updatedDrivers || []
      }));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to update ${type}`);
      throw err;
    }
  };

  const deleteDriver = async (type: ColumnType, name: string) => {
    try {
      const response = await apiService.deleteDriver(type, name);
      // Refresh the specific driver type
      const updatedDrivers = await apiService.getDrivers(type);
      setDrivers(prev => ({
        ...prev,
        [type]: updatedDrivers || []
      }));
      return response; // Return the full response with affected objects/variables
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to delete ${type}`);
      throw err;
    }
  };

  const bulkCreateDrivers = async (type: ColumnType, names: string[]) => {
    try {
      await apiService.bulkCreateDrivers(type, { names });
      // Refresh the specific driver type
      const updatedDrivers = await apiService.getDrivers(type);
      setDrivers(prev => ({
        ...prev,
        [type]: updatedDrivers || []
      }));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to bulk create ${type}`);
      throw err;
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  return {
    drivers,
    loading,
    error,
    fetchDrivers,
    createDriver,
    updateDriver,
    deleteDriver,
    bulkCreateDrivers,
  };
};
