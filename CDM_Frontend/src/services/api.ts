// API service for connecting to CDM_U Backend

// Determine API base URL based on environment
const getApiBaseUrl = () => {
  // In production (Vercel), use the backend URL from environment
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_API_BASE_URL || 'https://cdm-backend.onrender.com/api/v1';
  }
  // In development, use localhost
  return 'http://localhost:10000/api/v1';
};

const API_BASE_URL = getApiBaseUrl();

// Graph query function
export const executeGraphQuery = async (query: string): Promise<{ nodes: any[], edges: any[], nodeCount: number, edgeCount: number }> => {
  const response = await fetch(`${API_BASE_URL}/graph/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to execute graph query');
  }

  return await response.json();
};

// Ontology view function
export const getOntologyView = async (
  objectId: string | null,
  objectName: string | null,
  view: 'drivers' | 'ontology' | 'identifiers' | 'relationships' | 'variants'
): Promise<{ nodes: any[], edges: any[], nodeCount: number, edgeCount: number }> => {
  // Build query params - prefer object_id if available, otherwise fall back to object_name
  const params = new URLSearchParams();
  if (objectId) {
    params.append('object_id', objectId);
  } else if (objectName) {
    params.append('object_name', objectName);
  } else {
    throw new Error('Either objectId or objectName must be provided');
  }
  params.append('view', view);

  const response = await fetch(`${API_BASE_URL}/ontology/view?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get ontology view');
  }

  return await response.json();
};

// Bulk ontology view function
export const getBulkOntologyView = async (
  objectIds: string[] | null,
  objectNames: string[] | null,
  viewType: 'drivers' | 'ontology' | 'identifiers' | 'relationships' | 'variants'
): Promise<{ nodes: any[], edges: any[], nodeCount: number, edgeCount: number }> => {
  // Build request body - prefer object_ids if available, otherwise fall back to object_names
  const body: any = { view: viewType };
  if (objectIds && objectIds.length > 0) {
    body.object_ids = objectIds;
  } else if (objectNames && objectNames.length > 0) {
    body.object_names = objectNames;
  } else {
    throw new Error('Either objectIds or objectNames must be provided');
  }

  const response = await fetch(`${API_BASE_URL}/ontology/view/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `Failed to fetch bulk ontology view: ${response.statusText}` }));
    throw new Error(error.detail || `Failed to fetch bulk ontology view: ${response.statusText}`);
  }
  
  return response.json();
};

// Variable ontology view function
export const getVariableOntologyView = async (
  variableId: string | null,
  variableName: string | null,
  view: 'drivers' | 'ontology' | 'metadata' | 'objectRelationships' | 'variations'
): Promise<{ nodes: any[], edges: any[], nodeCount: number, edgeCount: number }> => {
  // Build query params - prefer variable_id if available, otherwise fall back to variable_name
  const params = new URLSearchParams();
  if (variableId) {
    params.append('variable_id', variableId);
  } else if (variableName) {
    params.append('variable_name', variableName);
  } else {
    throw new Error('Either variableId or variableName must be provided');
  }
  params.append('view', view);

  const response = await fetch(`${API_BASE_URL}/ontology/view/variable?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get variable ontology view');
  }

  return await response.json();
};

// Bulk variable ontology view function
export const getBulkVariableOntologyView = async (
  variableIds: string[] | null,
  variableNames: string[] | null,
  viewType: 'drivers' | 'ontology' | 'metadata' | 'objectRelationships' | 'variations'
): Promise<{ nodes: any[], edges: any[], nodeCount: number, edgeCount: number }> => {
  // Build request body - prefer variable_ids if available, otherwise fall back to variable_names
  const body: any = { view: viewType };
  if (variableIds && variableIds.length > 0) {
    body.variable_ids = variableIds;
  } else if (variableNames && variableNames.length > 0) {
    body.variable_names = variableNames;
  } else {
    throw new Error('Either variableIds or variableNames must be provided');
  }

  const response = await fetch(`${API_BASE_URL}/ontology/view/variable/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `Failed to fetch bulk variable ontology view: ${response.statusText}` }));
    throw new Error(error.detail || `Failed to fetch bulk variable ontology view: ${response.statusText}`);
  }
  
  return response.json();
};

// Get tiered list values
export const getTieredListValues = async (listId: string): Promise<Record<string, string[][]>> => {
  const response = await fetch(`${API_BASE_URL}/lists/${listId}/tiered-values`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `Failed to get tiered list values: ${response.statusText}` }));
    throw new Error(error.detail || 'Failed to get tiered list values');
  }

  return await response.json();
};

// List ontology view function
export const getListOntologyView = async (
  listId: string | null,
  listName: string | null,
  view: 'drivers' | 'ontology' | 'metadata' | 'listValues' | 'variations'
): Promise<{ nodes: any[], edges: any[], nodeCount: number, edgeCount: number, cypherQuery?: string }> => {
  // Build query params - prefer list_id if available, otherwise fall back to list_name
  const params = new URLSearchParams();
  if (listId) {
    params.append('list_id', listId);
  } else if (listName) {
    params.append('list_name', listName);
  } else {
    throw new Error('Either listId or listName must be provided');
  }
  params.append('view', view);

  const response = await fetch(`${API_BASE_URL}/ontology/view/list?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get list ontology view');
  }

  return await response.json();
};

// Bulk list ontology view function
export const getBulkListOntologyView = async (
  listIds: string[] | null,
  listNames: string[] | null,
  viewType: 'drivers' | 'ontology' | 'metadata' | 'listValues' | 'variations'
): Promise<{ nodes: any[], edges: any[], nodeCount: number, edgeCount: number, cypherQuery?: string }> => {
  // Build request body - prefer list_ids if available, otherwise fall back to list_names
  const body: any = { view: viewType };
  if (listIds && listIds.length > 0) {
    body.list_ids = listIds;
  } else if (listNames && listNames.length > 0) {
    body.list_names = listNames;
  } else {
    throw new Error('Either listIds or listNames must be provided');
  }

  const response = await fetch(`${API_BASE_URL}/ontology/view/list/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `Failed to fetch bulk list ontology view: ${response.statusText}` }));
    throw new Error(error.detail || `Failed to fetch bulk list ontology view: ${response.statusText}`);
  }
  
  return response.json();
};

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Prepare headers - only add Content-Type if not explicitly set
    let headers: HeadersInit = {};
    if (options.headers !== undefined) {
      // Use provided headers as-is (even if empty object)
      headers = options.headers;
    } else {
      // Use default Content-Type only if no headers provided at all
      headers = {
        'Content-Type': 'application/json',
      };
    }

    const mergedOptions: RequestInit = {
      ...options,
      headers,
    };

    // Add timeout to prevent hanging requests (90 seconds for regular requests, longer for bulk operations)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout for regular API calls
    
    try {
      // Log POST requests to /lists endpoint
      if (endpoint === '/lists' && mergedOptions.method === 'POST') {
        console.log('🔵 API request: POST /lists', {
          url,
          hasBody: !!mergedOptions.body,
          bodyPreview: mergedOptions.body ? (typeof mergedOptions.body === 'string' ? mergedOptions.body.substring(0, 200) : 'not a string') : 'no body'
        });
      }
      
      const response = await fetch(url, {
        ...mergedOptions,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Log response for POST /lists
      if (endpoint === '/lists' && mergedOptions.method === 'POST') {
        console.log('🔵 API response: POST /lists', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });
      }
      
      if (!response.ok) {
        // Try to get error details from response
        let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.error('API Error Response:', errorData);
          if (errorData.detail) {
            // Handle both string and object detail
            if (typeof errorData.detail === 'string') {
              errorMessage = errorData.detail;
            } else if (Array.isArray(errorData.detail)) {
              // Pydantic validation errors come as arrays
              errorMessage = errorData.detail.map((err: any) => {
                if (typeof err === 'string') return err;
                if (err.msg) return `${err.loc?.join('.') || 'field'}: ${err.msg}`;
                return JSON.stringify(err);
              }).join(', ');
            } else if (typeof errorData.detail === 'object') {
              errorMessage = JSON.stringify(errorData.detail);
            } else {
              errorMessage = String(errorData.detail);
            }
          } else if (errorData.message) {
            errorMessage = typeof errorData.message === 'string' ? errorData.message : JSON.stringify(errorData.message);
          }
        } catch (e) {
          // If JSON parsing fails, use default message
          console.error('Failed to parse error response:', e);
        }
        throw new Error(errorMessage);
      }
      
      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout: The server took too long to respond. Please try again.');
      }
      throw error;
    }
  }

  // Objects API
  async getObjects() {
    return this.request('/objects');
  }

  async getObject(id: string) {
    return this.request(`/objects/${id}`);
  }

  async createObject(objectData: any) {
    return this.request('/objects', {
      method: 'POST',
      body: JSON.stringify(objectData),
    });
  }

  async updateObject(id: string, objectData: any) {
    return this.request(`/objects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(objectData),
    });
  }

  async deleteObject(id: string) {
    console.log('🔴 API deleteObject called with id:', id);
    const result = await this.request(`/objects/${id}`, {
      method: 'DELETE',
    });
    console.log('🔴 API deleteObject result:', result);
    return result;
  }

  // Relationship API
  async createRelationship(objectId: string, relationshipData: any) {
    return this.request(`/objects/${objectId}/relationships`, {
      method: 'POST',
      body: JSON.stringify({
        relationship_type: relationshipData.type || 'Inter-Table',
        role: relationshipData.role || '',
        frequency: relationshipData.frequency || 'Critical',
        to_being: relationshipData.toBeing || 'ALL',
        to_avatar: relationshipData.toAvatar || 'ALL',
        to_object: relationshipData.toObject || 'ALL'
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async deleteRelationship(objectId: string, relationshipId: string) {
    return this.request(`/objects/${objectId}/relationships/${relationshipId}`, {
      method: 'DELETE',
    });
  }

  async updateRelationshipsToTarget(
    objectId: string,
    targetBeing: string,
    targetAvatar: string,
    targetObject: string,
    relationshipType: string,
    frequency: string
  ) {
    return this.request(`/objects/${objectId}/relationships/update-target`, {
      method: 'PUT',
      body: JSON.stringify({
        target_being: targetBeing,
        target_avatar: targetAvatar,
        target_object: targetObject,
        relationship_type: relationshipType,
        frequency: frequency
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getObjectRelationships(objectId: string) {
    return this.request(`/objects/${objectId}`);
  }

  async cloneRelationships(targetObjectId: string, sourceObjectId: string) {
    return this.request(`/objects/${targetObjectId}/clone-relationships/${sourceObjectId}`, {
      method: 'POST',
    });
  }

  async bulkCloneRelationships(sourceObjectId: string, targetObjectIds: string[]) {
    return this.request(`/objects/bulk-clone-relationships/${sourceObjectId}`, {
      method: 'POST',
      body: JSON.stringify(targetObjectIds),
    });
  }

  async cloneIdentifiers(targetObjectId: string, sourceObjectId: string) {
    return this.request(`/objects/${targetObjectId}/clone-identifiers/${sourceObjectId}`, {
      method: 'POST',
    });
  }

  async bulkCloneIdentifiers(sourceObjectId: string, targetObjectIds: string[]) {
    return this.request(`/objects/bulk-clone-identifiers/${sourceObjectId}`, {
      method: 'POST',
      body: JSON.stringify(targetObjectIds),
    });
  }

  async bulkCreateRelationships(relationships: Array<{
    sourceObjectId: string;
    targetObject: any;
    relationshipType: string;
    roles: string[];
    frequency?: string;
  }>) {
    return this.request('/objects/bulk-relationships', {
      method: 'POST',
      body: JSON.stringify({
        relationships: relationships.map(rel => ({
          source_object_id: rel.sourceObjectId,
          target_being: rel.targetObject.being,
          target_avatar: rel.targetObject.avatar,
          target_object: rel.targetObject.object,
          relationship_type: rel.relationshipType,
          roles: rel.roles,
          frequency: rel.frequency || 'Critical'
        }))
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getObjectVariants(objectId: string) {
    return this.request(`/objects/${objectId}`);
  }

  async bulkUploadRelationships(objectId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request(`/objects/${objectId}/relationships/upload`, {
      method: 'POST',
      body: formData,
    });
  }

  // Variant API
  async createVariant(objectId: string, variantName: string) {
    return this.request(`/objects/${objectId}/variants`, {
      method: 'POST',
      body: JSON.stringify({
        variant_name: variantName
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async deleteVariant(objectId: string, variantId: string) {
    return this.request(`/objects/${objectId}/variants/${variantId}`, {
      method: 'DELETE',
    });
  }

  async bulkUploadVariants(objectId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request(`/objects/${objectId}/variants/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type, let browser set it with boundary for FormData
      },
    });
  }

  // Variation API (for Variables)
  async getVariableVariations(variableId: string) {
    return this.request(`/variables/${variableId}/variations`);
  }

  async getListVariations(listId: string) {
    return this.request(`/lists/${listId}/variations`);
  }

  async bulkUploadVariations(variableId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request(`/variables/${variableId}/variations/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type, let browser set it with boundary for FormData
      },
    });
  }

  async bulkUploadListVariations(listId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    const url = `${API_BASE_URL}/lists/${listId}/variations/upload`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for bulk uploads
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {
          // Don't set Content-Type, let browser set it with boundary for FormData
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: `API request failed: ${response.status} ${response.statusText}` }));
        throw new Error(errorData.detail || `API request failed: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout: The server took too long to respond. This may happen with large CSV files. Please try again or upload a smaller batch.');
      }
      throw error;
    }
  }

  // Update object with relationships and variants
  async updateObjectWithRelationshipsAndVariants(objectId: string, relationships: any[], variants: any[]) {
    return this.request(`/objects/${objectId}`, {
      method: 'PUT',
      body: JSON.stringify({
        relationships: relationships || [],
        variants: variants || []
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async uploadObjectsCSV(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request('/objects/upload', {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type, let browser set it with boundary for FormData
      },
    });
  }

  // Objects Taxonomy API
  async getBeings() {
    return this.request('/objects/taxonomy/beings');
  }

  async getAvatars(being?: string) {
    const url = being ? `/objects/taxonomy/avatars?being=${encodeURIComponent(being)}` : '/objects/taxonomy/avatars';
    return this.request(url);
  }

  async createAvatar(being: string, avatar: string) {
    return this.request('/objects/taxonomy/avatars', {
      method: 'POST',
      body: JSON.stringify({ being, avatar }),
    });
  }

  async getObjectsByTaxonomy(being?: string, avatar?: string) {
    let url = '/objects/taxonomy/objects';
    const params = new URLSearchParams();
    if (being) params.append('being', being);
    if (avatar) params.append('avatar', avatar);
    if (params.toString()) url += `?${params.toString()}`;
    return this.request(url);
  }

  // Variables API (to be implemented)
  async getVariable(id: string) {
    return this.request(`/variables/${id}`);
  }

  // Lists API (to be implemented)
  async getLists() {
    return this.request('/lists');
  }

  async getList(id: string) {
    return this.request(`/lists/${id}`);
  }

  async createList(listData: any) {
    console.log('🔵 API createList called with data:', {
      list: listData.list,
      listType: listData.listType,
      numberOfLevels: listData.numberOfLevels,
      tierNames: listData.tierNames,
      hasTieredListValues: 'tieredListValues' in listData,
      tieredListValuesKeys: listData.tieredListValues ? Object.keys(listData.tieredListValues) : 'N/A'
    });
    const result = await this.request('/lists', {
      method: 'POST',
      body: JSON.stringify(listData),
    });
    console.log('🔵 API createList result received');
    return result;
  }

  async updateList(id: string, listData: any) {
    return this.request(`/lists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(listData),
    });
  }

  async deleteList(id: string) {
    return this.request(`/lists/${id}`, {
      method: 'DELETE',
    });
  }

  // Variable-List Relationships
  async getListVariableRelationships(listId: string) {
    return this.request(`/lists/${listId}/variable-relationships`, {
      method: 'GET',
    });
  }

  async createVariableListRelationship(variableId: string, listId: string) {
    return this.request(`/variables/${variableId}/list-relationships`, {
      method: 'POST',
      body: JSON.stringify({ list_id: listId }),
    });
  }

  async deleteVariableListRelationship(variableId: string, listId: string) {
    return this.request(`/variables/${variableId}/list-relationships/${listId}`, {
      method: 'DELETE',
    });
  }

  async cloneListApplicability(targetListId: string, sourceListId: string) {
    return this.request(`/lists/${targetListId}/clone-applicability/${sourceListId}`, {
      method: 'POST',
    });
  }

  async bulkCloneListApplicability(sourceListId: string, targetListIds: string[]) {
    return this.request(`/lists/bulk-clone-applicability/${sourceListId}`, {
      method: 'POST',
      body: JSON.stringify(targetListIds),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Drivers API
  async getDrivers(type: string) {
    return this.request(`/drivers/${type}`);
  }

  async createDriver(type: string, driverData: any) {
    return this.request(`/drivers/${type}`, {
      method: 'POST',
      body: JSON.stringify(driverData),
    });
  }

  async updateDriver(type: string, oldName: string, driverData: any) {
    return this.request(`/drivers/${type}/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      body: JSON.stringify(driverData),
    });
  }

  async deleteDriver(type: string, name: string) {
    return this.request(`/drivers/${type}/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  }

  async reorderDrivers(type: string, orderedNames: string[]) {
    return this.request(`/drivers/${type}/reorder/`, {
      method: 'PUT',
      body: JSON.stringify({ orderedNames }),
    });
  }

  async bulkCreateDrivers(type: string, driversData: any) {
    return this.request(`/drivers/${type}/bulk`, {
      method: 'POST',
      body: JSON.stringify(driversData),
    });
  }


  async getDriverRelationships(type: string, name: string) {
    return this.request(`/drivers/${type}/relationships?name=${encodeURIComponent(name)}`);
  }

  // Variables API
  async getVariables() {
    return this.request('/variables');
  }

  async createVariable(variableData: any) {
    return this.request('/variables', {
      method: 'POST',
      body: JSON.stringify(variableData),
    });
  }

  async updateVariable(id: string, variableData: any) {
    return this.request(`/variables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(variableData),
    });
  }

  async deleteVariable(id: string) {
    return this.request(`/variables/${id}`, {
      method: 'DELETE',
    });
  }

  async getVariableObjectRelationships(variableId: string) {
    return this.request(`/variables/${variableId}/object-relationships`, {
      method: 'GET',
    });
  }

  async createVariableObjectRelationship(variableId: string, relationshipData: any) {
    // Convert frontend field names to backend field names
    const backendData = {
      relationship_type: relationshipData.relationshipType || 'HAS_SPECIFIC_VARIABLE',
      to_sector: relationshipData.toSector || '',
      to_domain: relationshipData.toDomain || '',
      to_country: relationshipData.toCountry || '',
      to_object_clarifier: relationshipData.toObjectClarifier || '',
      to_being: relationshipData.toBeing || '',
      to_avatar: relationshipData.toAvatar || '',
      to_object: relationshipData.toObject || ''
    };
    
    return this.request(`/variables/${variableId}/object-relationships`, {
      method: 'POST',
      body: JSON.stringify(backendData),
    });
  }

  async deleteVariableObjectRelationship(variableId: string, relationshipData: any) {
    // Convert frontend field names to backend field names
    const backendData = {
      relationship_type: relationshipData.relationshipType || 'HAS_SPECIFIC_VARIABLE',
      to_sector: relationshipData.toSector || '',
      to_domain: relationshipData.toDomain || '',
      to_country: relationshipData.toCountry || '',
      to_object_clarifier: relationshipData.toObjectClarifier || '',
      to_being: relationshipData.toBeing || '',
      to_avatar: relationshipData.toAvatar || '',
      to_object: relationshipData.toObject || ''
    };
    
    return this.request(`/variables/${variableId}/object-relationships`, {
      method: 'DELETE',
      body: JSON.stringify(backendData),
    });
  }

  async bulkCreateVariableObjectRelationships(relationships: Array<{
    variableId: string;
    objectId: string;
    object: any;
  }>) {
    return this.request('/variables/bulk-object-relationships', {
      method: 'POST',
      body: JSON.stringify({
        relationships: relationships.map(rel => ({
          variable_id: rel.variableId,
          target_being: rel.object.being,
          target_avatar: rel.object.avatar,
          target_object: rel.object.object,
          target_sector: rel.object.sector || '',
          target_domain: rel.object.domain || '',
          target_country: rel.object.country || '',
          target_object_clarifier: rel.object.classifier || ''
        }))
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async cloneVariableRelationships(targetVariableId: string, sourceVariableId: string) {
    return this.request(`/variables/${targetVariableId}/clone-object-relationships/${sourceVariableId}`, {
      method: 'POST',
    });
  }

  async bulkCloneVariableRelationships(sourceVariableId: string, targetVariableIds: string[]) {
    return this.request(`/variables/bulk-clone-object-relationships/${sourceVariableId}`, {
      method: 'POST',
      body: JSON.stringify(targetVariableIds),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Parse CSV text into headers and row objects. Handles quoted fields.
   */
  private parseVariableCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
    if (lines.length < 2) return { headers: [], rows: [] };
    const headerLine = lines[0];
    const headers = this.parseCSVLine(headerLine).map((h) => h.trim());
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, j) => { row[h.trim()] = (values[j] ?? '').trim(); });
      rows.push(row);
    }
    return { headers, rows };
  }

  private parseCSVLine(line: string): string[] {
    const out: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        i++;
        let s = '';
        while (i < line.length && line[i] !== '"') {
          s += line[i++];
        }
        if (i < line.length) i++;
        out.push(s);
      } else {
        let s = '';
        while (i < line.length && line[i] !== ',') {
          s += line[i++];
        }
        out.push(s.trim());
        i++;
      }
    }
    return out;
  }

  async bulkUploadVariablesChunk(rows: Record<string, string>[], startRowIndex: number): Promise<{ created_count: number; error_count: number; errors: string[]; message: string }> {
    const url = `${API_BASE_URL}/variables/bulk-upload-chunk`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min per chunk
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({ rows, start_row_index: startRowIndex }),
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(err.detail || String(response.status));
      }
      return await response.json();
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error('Chunk upload timed out. Try a smaller file or try again.');
      }
      throw e;
    }
  }

  async bulkUploadVariables(file: File) {
    const CHUNK_THRESHOLD = 80;
    const CHUNK_SIZE = 80;

    const text = await file.text();
    const { headers, rows } = this.parseVariableCSV(text);
    const required = ['Sector', 'Domain', 'Country', 'Part', 'Section', 'Group', 'Variable'];
    const missingCols = required.filter((c) => !headers.includes(c));
    if (missingCols.length > 0) {
      throw new Error(`CSV missing required columns: ${missingCols.join(', ')}. Required: ${required.join(', ')}.`);
    }

    if (rows.length <= CHUNK_THRESHOLD) {
      const formData = new FormData();
      formData.append('file', file);
      const url = `${API_BASE_URL}/variables/bulk-upload`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);
      try {
        const response = await fetch(url, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: `${response.status} ${response.statusText}` }));
          throw new Error(errorData.detail || 'Upload failed');
        }
        return await response.json();
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Request timeout: The server took too long to respond. Try again or use a smaller file.');
        }
        throw error;
      }
    }

    let totalCreated = 0;
    const allErrors: string[] = [];
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const startRowIndex = i + 2;
      const result = await this.bulkUploadVariablesChunk(chunk, startRowIndex);
      totalCreated += result.created_count ?? 0;
      if (result.errors?.length) allErrors.push(...result.errors);
    }
    return {
      success: true,
      message: `Successfully created ${totalCreated} variables${allErrors.length ? `. ${allErrors.length} errors.` : ''}`,
      created_count: totalCreated,
      error_count: allErrors.length,
      errors: allErrors,
    };
  }

  async bulkUpdateVariables(bulkData: any) {
    return this.request('/variables/bulk-update', {
      method: 'POST',
      body: JSON.stringify(bulkData),
    });
  }

  // Health check
  async healthCheck() {
    return this.request('/health', { method: 'GET' });
  }

  // Variable field options
  async addVariableFieldOption(fieldName: string, value: string) {
    return this.request('/variables/field-options', {
      method: 'POST',
      body: JSON.stringify({
        field_name: fieldName,
        value: value
      }),
    });
  }

  async getVariableFieldOptions() {
    return this.request('/variables/field-options', { method: 'GET' });
  }

  // Variable cascading dropdown API
  async getVariableParts() {
    return this.request('/variables/parts', { method: 'GET' });
  }

  async getVariableSections(part: string) {
    const params = new URLSearchParams({ part });
    return this.request(`/variables/sections?${params.toString()}`, { method: 'GET' });
  }

  async getVariableGroups(part: string, section?: string) {
    // Groups are filtered only by part, not by section
    // Section parameter is kept for backward compatibility but not used
    const params = new URLSearchParams({ part });
    if (section) {
      params.append('section', section);
    }
    return this.request(`/variables/groups?${params.toString()}`, { method: 'GET' });
  }

  async addVariableSection(part: string, section: string) {
    return this.request('/variables/sections', {
      method: 'POST',
      body: JSON.stringify({ part, section }),
    });
  }

  async createVariableGroup(part: string, group: string) {
    return this.request('/variables/groups', {
      method: 'POST',
      body: JSON.stringify({ part, group }),
    });
  }

  async getVariablesForSelection(part: string, section: string, group: string) {
    const params = new URLSearchParams({ part, section, group });
    return this.request(`/variables/variables?${params.toString()}`, { method: 'GET' });
  }

  // Lists API - Set and Grouping
  async addSetValue(setValue: string) {
    return this.request('/lists/set', {
      method: 'POST',
      body: JSON.stringify({
        set: setValue
      }),
    });
  }

  async addGroupingValue(set: string, groupingValue: string) {
    return this.request('/lists/grouping', {
      method: 'POST',
      body: JSON.stringify({
        set: set,
        grouping: groupingValue
      }),
    });
  }

  // Order API - for default sort order persistence
  async getObjectsOrder() {
    return this.request('/order/objects', { method: 'GET' });
  }

  async saveObjectsOrder(order: {
    beingOrder: string[];
    avatarOrders: Record<string, string[]>;
    objectOrders: Record<string, string[]>;
    sectorOrder?: string[];
    domainOrder?: string[];
    countryOrder?: string[];
  }) {
    return this.request('/order/objects', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async getVariablesOrder() {
    return this.request('/order/variables', { method: 'GET' });
  }

  async saveVariablesOrder(order: {
    partOrder: string[];
    sectionOrders: Record<string, string[]>;
    groupOrders: Record<string, string[]>;
    variableOrders: Record<string, string[]>;
    sectorOrder?: string[];
    domainOrder?: string[];
    countryOrder?: string[];
  }) {
    return this.request('/order/variables', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async getListsOrder() {
    return this.request('/order/lists', { method: 'GET' });
  }

  async saveListsOrder(order: {
    setOrder: string[];
    groupingOrders: Record<string, string[]>;
    listOrders: Record<string, string[]>;
    sectorOrder?: string[];
    domainOrder?: string[];
    countryOrder?: string[];
  }) {
    return this.request('/order/lists', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  // Metadata API
  async getMetadata() {
    return this.request('/metadata', { method: 'GET' });
  }

  async getMetadataItem(id: string) {
    return this.request(`/metadata/${id}`, { method: 'GET' });
  }

  async createMetadataItem(item: {
    id: string;
    layer: string;
    concept: string;
    number: string;
    examples: string;
  }) {
    return this.request('/metadata', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  async updateMetadataItem(id: string, update: {
    layer?: string;
    concept?: string;
    number?: string;
    examples?: string;
    detailData?: string;
  }) {
    return this.request(`/metadata/${id}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    });
  }

  async deleteMetadataItem(id: string) {
    return this.request(`/metadata/${id}`, {
      method: 'DELETE',
    });
  }

  async getVulqanFormatValues() {
    return this.request('/metadata/vulqan-format-values', { method: 'GET' });
  }

  async getBeingValues() {
    return this.request('/metadata/being-values', { method: 'GET' });
  }

  async getAvatarValues() {
    return this.request('/metadata/avatar-values', { method: 'GET' });
  }

  async getPartValues() {
    return this.request('/metadata/part-values', { method: 'GET' });
  }

  async getSectionValues() {
    return this.request('/metadata/section-values', { method: 'GET' });
  }

  async getGroupValues() {
    return this.request('/metadata/group-values', { method: 'GET' });
  }

  async getGTypeValues() {
    return this.request('/metadata/g-type-values', { method: 'GET' });
  }

  async getSetValues() {
    return this.request('/metadata/set-values', { method: 'GET' });
  }

  async getGroupingValues() {
    return this.request('/metadata/grouping-values', { method: 'GET' });
  }

  // Heuristics API
  async getHeuristics() {
    return this.request('/heuristics', { method: 'GET' });
  }

  async getHeuristicItem(id: string) {
    return this.request(`/heuristics/${id}`, { method: 'GET' });
  }

  async createHeuristicItem(item: {
    id: string;
    sector: string;
    domain: string;
    country: string;
    agent: string;
    procedure: string;
    rules: string;
    best: string;
    is_hero?: boolean;
    documentation?: string | null;
  }) {
    return this.request('/heuristics', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  async updateHeuristicItem(id: string, update: {
    sector?: string;
    domain?: string;
    country?: string;
    agent?: string;
    procedure?: string;
    rules?: string;
    best?: string;
    detailData?: string;
    is_hero?: boolean;
    documentation?: string | null;
  }) {
    return this.request(`/heuristics/${id}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    });
  }

  async deleteHeuristicItem(id: string) {
    return this.request(`/heuristics/${id}`, {
      method: 'DELETE',
    });
  }

  // Sources API
  async getSources() {
    return this.request('/sources', { method: 'GET' });
  }

  async getSourceItem(id: string) {
    return this.request(`/sources/${id}`, { method: 'GET' });
  }

  async createSourceItem(item: {
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
  }) {
    return this.request('/sources', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  async updateSourceItem(id: string, update: {
    sector?: string;
    domain?: string;
    country?: string;
    system?: string;
    sub_system?: string;
    type?: string;
    table?: string;
    column?: string;
    cdm_full_variable?: string;
    detailData?: string;
  }) {
    return this.request(`/sources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    });
  }

  async deleteSourceItem(id: string) {
    return this.request(`/sources/${id}`, {
      method: 'DELETE',
    });
  }
}

export const apiService = new ApiService();
