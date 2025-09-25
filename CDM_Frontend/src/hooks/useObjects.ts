import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { ObjectData } from '../data/mockData';

export const useObjects = () => {
  const [objects, setObjects] = useState<ObjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchObjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getObjects();
      setObjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch objects');
      console.error('Error fetching objects:', err);
    } finally {
      setLoading(false);
    }
  };

  const createObject = async (objectData: Omit<ObjectData, 'id'>) => {
    try {
      const newObject = await apiService.createObject(objectData);
      setObjects(prev => [...prev, newObject]);
      return newObject;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create object');
      throw err;
    }
  };

  const updateObject = async (id: string, objectData: Partial<ObjectData>) => {
    try {
      const updatedObject = await apiService.updateObject(id, objectData);
      setObjects(prev => prev.map(obj => obj.id === id ? updatedObject : obj));
      return updatedObject;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update object');
      throw err;
    }
  };

  const deleteObject = async (id: string) => {
    try {
      await apiService.deleteObject(id);
      setObjects(prev => prev.filter(obj => obj.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete object');
      throw err;
    }
  };

  useEffect(() => {
    fetchObjects();
  }, []);

  return {
    objects,
    loading,
    error,
    fetchObjects,
    createObject,
    updateObject,
    deleteObject,
  };
};
