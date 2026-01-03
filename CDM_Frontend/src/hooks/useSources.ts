import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

export interface SourcesData {
  id: string;
  sector: string;
  domain: string;
  country: string;
  system: string;
  sub_system: string;
  type: string;
  table: string;
  column: string;
  cdm_full_variable: string;
}

export const useSources = () => {
  const [sources, setSources] = useState<SourcesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching sources from API...');
      const data = await apiService.getSources();
      console.log('Sources fetched:', data);
      // Ensure data is an array
      if (Array.isArray(data)) {
        setSources(data);
      } else {
        console.error('Sources data is not an array:', data);
        setError('Invalid sources format received from server');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch sources';
      setError(errorMessage);
      console.error('Error fetching sources:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch sources on mount
  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const createSourceItem = async (item: SourcesData) => {
    try {
      const newItem = await apiService.createSourceItem(item);
      setSources(prev => [...prev, newItem]);
      return newItem;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create source item');
      throw err;
    }
  };

  const updateSourceItem = async (id: string, update: Partial<SourcesData>) => {
    try {
      const updatedItem = await apiService.updateSourceItem(id, update);
      setSources(prev => prev.map(item => item.id === id ? updatedItem : item));
      return updatedItem;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update source item');
      throw err;
    }
  };

  const deleteSourceItem = async (id: string) => {
    try {
      await apiService.deleteSourceItem(id);
      setSources(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete source item');
      throw err;
    }
  };

  return {
    sources,
    loading,
    error,
    fetchSources,
    createSourceItem,
    updateSourceItem,
    deleteSourceItem,
  };
};

