import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

export interface HeuristicsData {
  id: string;
  sector: string;
  domain: string;
  country: string;
  agent: string;
  procedure: string;
  rules: string;
  best: string;
}

export const useHeuristics = () => {
  const [heuristics, setHeuristics] = useState<HeuristicsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHeuristics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching heuristics from API...');
      const data = await apiService.getHeuristics();
      console.log('Heuristics fetched:', data);
      // Ensure data is an array
      if (Array.isArray(data)) {
        setHeuristics(data);
      } else {
        console.error('Heuristics data is not an array:', data);
        setError('Invalid heuristics format received from server');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch heuristics';
      setError(errorMessage);
      console.error('Error fetching heuristics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch heuristics on mount
  useEffect(() => {
    fetchHeuristics();
  }, [fetchHeuristics]);

  const createHeuristicItem = async (item: HeuristicsData) => {
    try {
      const newItem = await apiService.createHeuristicItem(item);
      setHeuristics(prev => [...prev, newItem]);
      return newItem;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create heuristic item');
      throw err;
    }
  };

  const updateHeuristicItem = async (id: string, update: Partial<HeuristicsData>) => {
    try {
      const updatedItem = await apiService.updateHeuristicItem(id, update);
      setHeuristics(prev => prev.map(item => item.id === id ? updatedItem : item));
      return updatedItem;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update heuristic item');
      throw err;
    }
  };

  const deleteHeuristicItem = async (id: string) => {
    try {
      await apiService.deleteHeuristicItem(id);
      setHeuristics(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete heuristic item');
      throw err;
    }
  };

  return {
    heuristics,
    loading,
    error,
    fetchHeuristics,
    createHeuristicItem,
    updateHeuristicItem,
    deleteHeuristicItem,
  };
};

