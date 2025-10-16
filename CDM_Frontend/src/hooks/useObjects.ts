import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { ObjectData, parseDriverField } from '../data/mockData';

export const useObjects = () => {
  const [objects, setObjects] = useState<ObjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cache for taxonomy data
  const [beingsCache, setBeingsCache] = useState<string[]>([]);
  const [avatarsCache, setAvatarsCache] = useState<Record<string, string[]>>({});

  const fetchObjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getObjects();
      console.log('🔄 fetchObjects - API response:', data.slice(0, 3).map(obj => ({ id: obj.id, driver: obj.driver })));
      
      // Parse driver strings and add parsed fields to each object
      const parsedData = data.map(obj => {
        const parsed = parseDriverField(obj.driver);
        return {
          ...obj,
          sector: parsed.sector,
          domain: parsed.domain,
          country: parsed.country,
          classifier: parsed.classifier
        };
      });
      
      setObjects(parsedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch objects');
      console.error('Error fetching objects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch objects on mount
  useEffect(() => {
    fetchObjects();
  }, [fetchObjects]);

  const createObject = async (objectData: any) => {
    try {
      const newObject = await apiService.createObject(objectData);
      
      // Parse driver string and add parsed fields
      const parsed = parseDriverField(newObject.driver);
      const parsedObject = {
        ...newObject,
        sector: parsed.sector,
        domain: parsed.domain,
        country: parsed.country,
        classifier: parsed.classifier
      };
      
      setObjects(prev => [...prev, parsedObject]);
      return parsedObject;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create object');
      throw err;
    }
  };

  const updateObject = async (id: string, objectData: Partial<ObjectData>) => {
    try {
      console.log('🔄 updateObject called:', { id, objectData });
      console.log('🔄 Current objects before update:', objects.find(obj => obj.id === id));
      const updatedObject = await apiService.updateObject(id, objectData);
      console.log('✅ updateObject response:', updatedObject);
      
      // Parse driver string and add parsed fields
      const parsed = parseDriverField(updatedObject.driver);
      const parsedObject = {
        ...updatedObject,
        sector: parsed.sector,
        domain: parsed.domain,
        country: parsed.country,
        classifier: parsed.classifier
      };
      
      setObjects(prev => {
        console.log('🔄 Previous objects state before update:', prev.find(obj => obj.id === id));
        const newObjects = prev.map(obj => obj.id === id ? parsedObject : obj);
        console.log('🔄 Updated objects state:', newObjects.find(obj => obj.id === id));
        console.log('🔄 Full updated objects array length:', newObjects.length);
        console.log('🔄 Updated object being set:', parsedObject);
        return newObjects;
      });
      return parsedObject;
    } catch (err) {
      console.error('❌ updateObject error:', err);
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

  // Relationship methods
  const createRelationship = async (objectId: string, relationshipData: any) => {
    try {
      const newRelationship = await apiService.createRelationship(objectId, relationshipData);
      // Refresh objects to get updated counts
      await fetchObjects();
      return newRelationship;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create relationship');
      throw err;
    }
  };

  const deleteRelationship = async (objectId: string, relationshipId: string) => {
    try {
      await apiService.deleteRelationship(objectId, relationshipId);
      // Refresh objects to get updated counts
      await fetchObjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete relationship');
      throw err;
    }
  };

  // Variant methods
  const createVariant = async (objectId: string, variantName: string) => {
    try {
      const newVariant = await apiService.createVariant(objectId, variantName);
      // Refresh objects to get updated counts
      await fetchObjects();
      return newVariant;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create variant');
      throw err;
    }
  };

  const deleteVariant = async (objectId: string, variantId: string) => {
    try {
      await apiService.deleteVariant(objectId, variantId);
      // Refresh objects to get updated counts
      await fetchObjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete variant');
      throw err;
    }
  };

  // Update object with relationships and variants
  const updateObjectWithRelationshipsAndVariants = async (objectId: string, relationships: any[], variants: any[]) => {
    try {
      await apiService.updateObjectWithRelationshipsAndVariants(objectId, relationships, variants);
      // Refresh objects to get updated counts
      await fetchObjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update object with relationships and variants');
      throw err;
    }
  };

  const uploadObjectsCSV = async (file: File) => {
    try {
      const result = await apiService.uploadObjectsCSV(file);
      // Refresh objects after successful upload
      await fetchObjects();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload CSV');
      throw err;
    }
  };

  // Taxonomy functions with caching
  const getBeings = async () => {
    try {
      if (beingsCache.length > 0) {
        return beingsCache;
      }
      const data = await apiService.getBeings();
      setBeingsCache(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch beings');
      throw err;
    }
  };

  const getAvatars = async (being?: string) => {
    try {
      if (being && avatarsCache[being]) {
        return avatarsCache[being];
      }
      const data = await apiService.getAvatars(being);
      if (being) {
        setAvatarsCache(prev => ({ ...prev, [being]: data }));
      }
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch avatars');
      throw err;
    }
  };

  const getObjectsByTaxonomy = async (being?: string, avatar?: string) => {
    try {
      return await apiService.getObjectsByTaxonomy(being, avatar);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch objects by taxonomy');
      throw err;
    }
  };

  useEffect(() => {
    fetchObjects();
  }, []);

  // Retry API call when error occurs (with a delay)
  useEffect(() => {
    if (error) {
      const retryTimer = setTimeout(() => {
        console.log('Retrying API call due to previous error...');
        fetchObjects();
      }, 2000); // Retry after 2 seconds

      return () => clearTimeout(retryTimer);
    }
  }, [error, fetchObjects]);

  return {
    objects,
    loading,
    error,
    fetchObjects,
    createObject,
    updateObject,
    deleteObject,
    uploadObjectsCSV,
    getBeings,
    getAvatars,
    getObjectsByTaxonomy,
    // Relationship methods
    createRelationship,
    deleteRelationship,
    // Variant methods
    createVariant,
    deleteVariant,
    // Update object with relationships and variants
    updateObjectWithRelationshipsAndVariants,
  };
};
