// API service for connecting to CDM_U Backend

const API_BASE_URL = 'http://localhost:8000/api/v1';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const response = await fetch(url, { ...defaultOptions, ...options });
    
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

  // Variables API (to be implemented)
  async getVariables() {
    return this.request('/variables');
  }

  async getVariable(id: string) {
    return this.request(`/variables/${id}`);
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

  // Health check
  async healthCheck() {
    return this.request('/health', { method: 'GET' });
  }
}

export const apiService = new ApiService();
