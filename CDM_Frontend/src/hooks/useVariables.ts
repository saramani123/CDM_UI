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
      console.log('Fetching variables from API...');
      
      // Add timeout wrapper for extra safety (in addition to API service timeout)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout: Variables fetch took too long')), 35000);
      });
      
      const data = await Promise.race([
        apiService.getVariables() as Promise<VariableData[]>,
        timeoutPromise
      ]);
      
      console.log('Variables API response:', data);
      console.log('Variables count:', data?.length || 0);
      console.log('First variable:', data?.[0]);
      console.log('Data type:', typeof data);
      console.log('Is array:', Array.isArray(data));
      setVariables(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch variables';
      setError(errorMessage);
      console.error('Error fetching variables:', err);
      // Set empty array on error to prevent infinite loading state
      setVariables([]);
    } finally {
      setLoading(false);
    }
  };

  const createVariable = async (variableData: Omit<VariableData, 'id' | 'objectRelationships' | 'objectRelationshipsList'>) => {
    try {
      const newVariable = await apiService.createVariable(variableData) as VariableData;
      setVariables(prev => [...prev, newVariable]);
      return newVariable;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create variable');
      throw err;
    }
  };

  const updateVariable = async (id: string, variableData: Partial<VariableData>) => {
    try {
      const updatedVariable = await apiService.updateVariable(id, variableData) as VariableData;
      setVariables(prev => prev.map(v => v.id === id ? updatedVariable : v));
      return updatedVariable;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update variable');
      // Refresh data to ensure consistency after error
      await fetchVariables();
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

  const bulkUploadVariables = async (file: File, onProgress?: (progress: { chunk: number; total: number; progress: number }) => void) => {
    try {
      // Read the CSV file and chunk it into batches of 500 rows
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length <= 1) {
        throw new Error('CSV file must contain at least a header row and one data row');
      }
      
      const header = lines[0];
      const dataRows = lines.slice(1);
      const CHUNK_SIZE = 500; // Chunk size to stay under 60-second timeout
      const chunks: string[] = [];
      
      // Split into chunks
      for (let i = 0; i < dataRows.length; i += CHUNK_SIZE) {
        const chunk = [header, ...dataRows.slice(i, i + CHUNK_SIZE)].join('\n');
        chunks.push(chunk);
      }
      
      console.log(`Uploading ${dataRows.length} rows in ${chunks.length} chunk(s)`);
      
      // Upload chunks sequentially
      let totalCreated = 0;
      let totalErrors = 0;
      const allErrors: string[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunkNum = i + 1;
        const chunkBlob = new Blob([chunks[i]], { type: 'text/csv' });
        const chunkFile = new File([chunkBlob], file.name, { type: 'text/csv' });
        
        console.log(`Uploading chunk ${chunkNum}/${chunks.length} (${dataRows.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, dataRows.length)).length} rows)`);
        
        try {
          const result = await apiService.bulkUploadVariables(chunkFile, 120000); // 2 minute timeout per chunk
          
          if (result.created_count) {
            totalCreated += result.created_count;
          }
          if (result.error_count) {
            totalErrors += result.error_count;
          }
          if (result.errors && Array.isArray(result.errors)) {
            allErrors.push(...result.errors.map((e: string) => `Chunk ${chunkNum}: ${e}`));
          }
          
          console.log(`Chunk ${chunkNum}/${chunks.length} completed: ${result.created_count || 0} created, ${result.error_count || 0} errors`);
          
          // Update progress after chunk completes
          if (onProgress) {
            onProgress({
              chunk: chunkNum,
              total: chunks.length,
              progress: Math.round(((i + 1) / chunks.length) * 100)
            });
          }
        } catch (chunkError) {
          const errorMsg = chunkError instanceof Error ? chunkError.message : 'Unknown error';
          console.error(`Chunk ${chunkNum} failed:`, errorMsg);
          allErrors.push(`Chunk ${chunkNum} failed: ${errorMsg}`);
          
          // Update progress even on error
          if (onProgress) {
            onProgress({
              chunk: chunkNum,
              total: chunks.length,
              progress: Math.round(((i + 1) / chunks.length) * 100)
            });
          }
          // Continue with next chunk even if one fails
        }
        
        // Small delay between chunks to avoid overwhelming the server
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Refresh variables after bulk upload
      await fetchVariables();
      
      return {
        success: totalCreated > 0,
        message: `Uploaded ${chunks.length} chunk(s): ${totalCreated} variables created, ${totalErrors} errors`,
        created_count: totalCreated,
        error_count: totalErrors,
        errors: allErrors.slice(0, 50) // Limit to first 50 errors
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bulk upload variables');
      throw err;
    }
  };

  const bulkUpdateVariables = async (bulkData: any) => {
    try {
      const result = await apiService.bulkUpdateVariables(bulkData);
      // Refresh variables after bulk update
      await fetchVariables();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bulk update variables');
      throw err;
    }
  };

  useEffect(() => {
    // Fetch variables on mount
    fetchVariables();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    bulkUpdateVariables,
  };
};