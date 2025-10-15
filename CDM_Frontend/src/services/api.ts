// API service for connecting to CDM_U Backend

// Determine API base URL based on environment
const getApiBaseUrl = () => {
  // In production (Vercel), use the backend URL from environment
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_API_BASE_URL || 'https://cdm-backend.onrender.com/api/v1';
  }
  // In development, use localhost
  return 'http://localhost:8000/api/v1';
};

const API_BASE_URL = getApiBaseUrl();

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

    const response = await fetch(url, mergedOptions);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
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
    return this.request(`/objects/${id}`, {
      method: 'DELETE',
    });
  }

  // Relationship API
  async createRelationship(objectId: string, relationshipData: any) {
    return this.request(`/objects/${objectId}/relationships`, {
      method: 'POST',
      body: JSON.stringify({
        relationship_type: relationshipData.type || 'Inter-Table',
        role: relationshipData.role || '',
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
    return this.request('/lists', {
      method: 'POST',
      body: JSON.stringify(listData),
    });
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
      to_being: relationshipData.toBeing,
      to_avatar: relationshipData.toAvatar,
      to_object: relationshipData.toObject
    };
    
    return this.request(`/variables/${variableId}/object-relationships`, {
      method: 'POST',
      body: JSON.stringify(backendData),
    });
  }

  async deleteVariableObjectRelationship(variableId: string, relationshipData: any) {
    // Convert frontend field names to backend field names
    const backendData = {
      to_being: relationshipData.toBeing,
      to_avatar: relationshipData.toAvatar,
      to_object: relationshipData.toObject
    };
    
    return this.request(`/variables/${variableId}/object-relationships`, {
      method: 'DELETE',
      body: JSON.stringify(backendData),
    });
  }

  async bulkUploadVariables(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request('/variables/bulk-upload', {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type, let browser set it with boundary for FormData
      },
    });
  }

  async bulkUpdateVariables(bulkData: any) {
    return this.request('/variables/bulk-update', {
      method: 'PUT',
      body: JSON.stringify(bulkData),
    });
  }

  // Health check
  async healthCheck() {
    return this.request('/health', { method: 'GET' });
  }
}

export const apiService = new ApiService();
