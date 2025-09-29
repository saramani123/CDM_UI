import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { VariableData, ObjectRelationship } from '../data/variablesData';

export const useVariables = () => {
  const [variables, setVariables] = useState<VariableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVariables = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getVariables();
      setVariables(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch variables');
      console.error('Error fetching variables:', err);
    } finally {
      setLoading(false);
    }
  };

  const createVariable = async (variableData: Omit<VariableData, 'id' | 'objectRelationships' | 'objectRelationshipsList'>) => {
    try {
      const newVariable = await apiService.createVariable(variableData);
      setVariables(prev => [...prev, newVariable]);
      return newVariable;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create variable');
      throw err;
    }
  };

  const updateVariable = async (id: string, variableData: Partial<VariableData>) => {
    try {
      const updatedVariable = await apiService.updateVariable(id, variableData);
      setVariables(prev => prev.map(v => v.id === id ? updatedVariable : v));
      return updatedVariable;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update variable');
      throw err;
    }
  };

  const deleteVariable = async (id: string) => {
    try {
      await apiService.deleteVariable(id);
      setVariables(prev => prev.filter(v => v.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete variable');
      throw err;
    }
  };

  const createObjectRelationship = async (variableId: string, relationshipData: Omit<ObjectRelationship, 'id'>) => {
    try {
      await apiService.createVariableObjectRelationship(variableId, relationshipData);
      // Refresh the variable to get updated relationship count
      await fetchVariables();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create object relationship');
      throw err;
    }
  };

  const deleteObjectRelationship = async (variableId: string, relationshipId: string) => {
    try {
      await apiService.deleteVariableObjectRelationship(variableId, relationshipId);
      // Refresh the variable to get updated relationship count
      await fetchVariables();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete object relationship');
      throw err;
    }
  };

  const bulkUploadVariables = async (file: File) => {
    try {
      const result = await apiService.bulkUploadVariables(file);
      // Refresh variables after bulk upload
      await fetchVariables();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bulk upload variables');
      throw err;
    }
  };

  useEffect(() => {
    fetchVariables();
  }, []);

  return {
    variables,
    loading,
    error,
    fetchVariables,
    createVariable,
    updateVariable,
    deleteVariable,
    createObjectRelationship,
    deleteObjectRelationship,
    bulkUploadVariables,
  };
};