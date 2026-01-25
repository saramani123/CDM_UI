import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

export interface MetadataData {
  id: string;
  layer: string;
  concept: string;
  number: string;
  examples: string;
}

export const useMetadata = () => {
  const [metadata, setMetadata] = useState<MetadataData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reorderState, setReorderState] = useState<MetadataData[] | null>(null);

  const fetchMetadata = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching metadata from API...');
      const data = await apiService.getMetadata();
      console.log('Metadata fetched:', data);
      // Ensure data is an array
      if (Array.isArray(data)) {
        setMetadata(data);
      } else {
        console.error('Metadata data is not an array:', data);
        setError('Invalid metadata format received from server');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch metadata';
      setError(errorMessage);
      console.error('Error fetching metadata:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch metadata on mount
  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  const createMetadataItem = async (item: MetadataData) => {
    try {
      const newItem = await apiService.createMetadataItem(item);
      setMetadata(prev => [...prev, newItem]);
      return newItem;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create metadata item');
      throw err;
    }
  };

  const updateMetadataItem = async (id: string, update: Partial<MetadataData>) => {
    try {
      const updatedItem = await apiService.updateMetadataItem(id, update);
      setMetadata(prev => prev.map(item => item.id === id ? updatedItem : item));
      return updatedItem;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update metadata item');
      throw err;
    }
  };

  const deleteMetadataItem = async (id: string) => {
    try {
      await apiService.deleteMetadataItem(id);
      setMetadata(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete metadata item');
      throw err;
    }
  };

  const reorderMetadata = useCallback((newOrder: MetadataData[]) => {
    setMetadata(newOrder);
  }, []);

  return {
    metadata,
    loading,
    error,
    fetchMetadata,
    createMetadataItem,
    updateMetadataItem,
    deleteMetadataItem,
    reorderMetadata,
  };
};

