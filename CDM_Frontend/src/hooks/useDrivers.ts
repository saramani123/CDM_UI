import { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import { DriversData, ColumnType } from '../data/driversData';

// Global cache for drivers data to avoid redundant API calls
let globalDriversCache: DriversData | null = null;
let globalLoadingState = false;
let globalErrorState: string | null = null;
let fetchPromise: Promise<void> | null = null;
let subscribers: Set<() => void> = new Set();

const notifySubscribers = () => {
  subscribers.forEach(subscriber => subscriber());
};

const fetchDriversGlobal = async (): Promise<void> => {
  // If already fetching, return the existing promise
  if (fetchPromise) {
    return fetchPromise;
  }

  // If already cached, return immediately
  if (globalDriversCache) {
    return Promise.resolve();
  }

  fetchPromise = (async () => {
    try {
      globalLoadingState = true;
      globalErrorState = null;
      notifySubscribers();
      
      // Fetch all driver types in parallel
      const [sectors, domains, countries, objectClarifiers, variableClarifiers] = await Promise.all([
        apiService.getDrivers('sectors'),
        apiService.getDrivers('domains'),
        apiService.getDrivers('countries'),
        apiService.getDrivers('objectClarifiers'),
        apiService.getDrivers('variableClarifiers')
      ]);
      
      // Filter out "ALL" from drivers data as it's not an actual value, just a UI convenience
      globalDriversCache = {
        sectors: Array.isArray(sectors) ? sectors.filter(v => v !== 'ALL') : [],
        domains: Array.isArray(domains) ? domains.filter(v => v !== 'ALL') : [],
        countries: Array.isArray(countries) ? countries.filter(v => v !== 'ALL') : [],
        objectClarifiers: Array.isArray(objectClarifiers) ? objectClarifiers : [],
        variableClarifiers: Array.isArray(variableClarifiers) ? variableClarifiers : []
      };
    } catch (err) {
      globalErrorState = err instanceof Error ? err.message : 'Failed to fetch drivers';
      console.error('Error fetching drivers:', err);
    } finally {
      globalLoadingState = false;
      fetchPromise = null;
      notifySubscribers();
    }
  })();

  return fetchPromise;
};

export const useDrivers = () => {
  const [drivers, setDrivers] = useState<DriversData>(globalDriversCache || {
    sectors: [],
    domains: [],
    countries: [],
    objectClarifiers: [],
    variableClarifiers: []
  });
  const [loading, setLoading] = useState(globalLoadingState);
  const [error, setError] = useState<string | null>(globalErrorState);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const updateState = () => {
      if (isMountedRef.current) {
        if (globalDriversCache) {
          setDrivers(globalDriversCache);
        }
        setLoading(globalLoadingState);
        setError(globalErrorState);
      }
    };

    // Subscribe to global state changes
    subscribers.add(updateState);

    // If data is already cached, use it immediately
    if (globalDriversCache) {
      setDrivers(globalDriversCache);
      setLoading(false);
      setError(null);
    } else {
      // Start fetching if not already cached
      fetchDriversGlobal();
    }

    return () => {
      isMountedRef.current = false;
      subscribers.delete(updateState);
    };
  }, []);

  const fetchDrivers = async () => {
    // Clear cache and refetch
    globalDriversCache = null;
    await fetchDriversGlobal();
    if (isMountedRef.current) {
      if (globalDriversCache) {
        setDrivers(globalDriversCache);
      }
      setLoading(globalLoadingState);
      setError(globalErrorState);
    }
  };

  const createDriver = async (type: ColumnType, name: string) => {
    try {
      await apiService.createDriver(type, { name });
      // Refresh the specific driver type and update global cache
      const updatedDrivers = await apiService.getDrivers(type);
      if (globalDriversCache) {
        globalDriversCache = {
          ...globalDriversCache,
          [type]: updatedDrivers || []
        };
      }
      notifySubscribers();
      if (isMountedRef.current) {
        setDrivers(globalDriversCache || drivers);
      }
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : `Failed to create ${type}`;
      if (isMountedRef.current) {
        setError(errorMsg);
      }
      throw err;
    }
  };

  const updateDriver = async (type: ColumnType, oldName: string, newName: string) => {
    try {
      await apiService.updateDriver(type, oldName, { name: newName });
      // Refresh the specific driver type and update global cache
      const updatedDrivers = await apiService.getDrivers(type);
      if (globalDriversCache) {
        globalDriversCache = {
          ...globalDriversCache,
          [type]: updatedDrivers || []
        };
      }
      notifySubscribers();
      if (isMountedRef.current) {
        setDrivers(globalDriversCache || drivers);
      }
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : `Failed to update ${type}`;
      if (isMountedRef.current) {
        setError(errorMsg);
      }
      throw err;
    }
  };

  const deleteDriver = async (type: ColumnType, name: string) => {
    try {
      const response = await apiService.deleteDriver(type, name);
      // Refresh the specific driver type and update global cache
      const updatedDrivers = await apiService.getDrivers(type);
      if (globalDriversCache) {
        globalDriversCache = {
          ...globalDriversCache,
          [type]: updatedDrivers || []
        };
      }
      notifySubscribers();
      if (isMountedRef.current) {
        setDrivers(globalDriversCache || drivers);
      }
      return response; // Return the full response with affected objects/variables
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : `Failed to delete ${type}`;
      if (isMountedRef.current) {
        setError(errorMsg);
      }
      throw err;
    }
  };

  const bulkCreateDrivers = async (type: ColumnType, names: string[]) => {
    try {
      await apiService.bulkCreateDrivers(type, { names });
      // Refresh the specific driver type and update global cache
      const updatedDrivers = await apiService.getDrivers(type);
      if (globalDriversCache) {
        globalDriversCache = {
          ...globalDriversCache,
          [type]: updatedDrivers || []
        };
      }
      notifySubscribers();
      if (isMountedRef.current) {
        setDrivers(globalDriversCache || drivers);
      }
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : `Failed to bulk create ${type}`;
      if (isMountedRef.current) {
        setError(errorMsg);
      }
      throw err;
    }
  };

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
