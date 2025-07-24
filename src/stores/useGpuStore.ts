import { create } from 'zustand';
import { apiService } from '../services/apiService';

export interface GpuInstance {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy' | 'maintenance';
  type: string;
  memory: {
    total: number;
    used: number;
    available: number;
  };
  utilization: number;
  temperature: number;
  powerUsage: number;
  location: string;
  cost: {
    perHour: number;
    currency: string;
  };
  capabilities: string[];
  currentJobs: string[];
  lastHeartbeat: Date;
}

export interface GpuCluster {
  id: string;
  name: string;
  instances: GpuInstance[];
  totalCapacity: number;
  availableCapacity: number;
  region: string;
  status: 'active' | 'inactive' | 'scaling';
}

interface GpuStore {
  instances: GpuInstance[];
  clusters: GpuCluster[];
  selectedInstance: GpuInstance | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchInstances: () => Promise<void>;
  selectInstance: (instance: GpuInstance) => void;
  updateInstanceStatus: (id: string, status: GpuInstance['status']) => void;
  addInstance: (instance: Omit<GpuInstance, 'id'>) => void;
  removeInstance: (id: string) => void;
  clearError: () => void;
}

export const useGpuStore = create<GpuStore>((set, get) => ({
  instances: [
    {
      id: 'gpu-001',
      name: 'NVIDIA RTX 4090 #1',
      status: 'online',
      type: 'RTX 4090',
      memory: {
        total: 24576,
        used: 8192,
        available: 16384
      },
      utilization: 35,
      temperature: 72,
      powerUsage: 320,
      location: 'EU-West-1',
      cost: {
        perHour: 2.50,
        currency: 'EUR'
      },
      capabilities: ['CUDA', 'ML Training', 'Video Processing', 'Face Recognition'],
      currentJobs: ['job-123', 'job-456'],
      lastHeartbeat: new Date()
    },
    {
      id: 'gpu-002',
      name: 'NVIDIA RTX 4090 #2',
      status: 'busy',
      type: 'RTX 4090',
      memory: {
        total: 24576,
        used: 22000,
        available: 2576
      },
      utilization: 89,
      temperature: 78,
      powerUsage: 380,
      location: 'EU-West-1',
      cost: {
        perHour: 2.50,
        currency: 'EUR'
      },
      capabilities: ['CUDA', 'ML Training', 'Video Processing', 'Face Recognition'],
      currentJobs: ['job-789'],
      lastHeartbeat: new Date()
    }
  ],
  clusters: [
    {
      id: 'cluster-001',
      name: 'EU Production Cluster',
      instances: [],
      totalCapacity: 100,
      availableCapacity: 65,
      region: 'EU-West-1',
      status: 'active'
    }
  ],
  selectedInstance: null,
  isLoading: false,
  error: null,

  fetchInstances: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.makeRequest('/test');
      if (response.success && response.data?.mockGpuInstances) {
        // Convert API data to our format
        const apiInstances = response.data.mockGpuInstances.map((instance: any) => ({
          id: instance.id,
          name: `${instance.type} Instance`,
          status: instance.status,
          type: instance.type,
          memory: { total: 24576, used: 8192, available: 16384 },
          utilization: instance.status === 'busy' ? 89 : 35,
          temperature: instance.status === 'busy' ? 78 : 72,
          powerUsage: instance.status === 'busy' ? 380 : 320,
          location: 'EU-West-1',
          cost: { perHour: 2.50, currency: 'EUR' },
          capabilities: ['CUDA', 'ML Training', 'Video Processing', 'Face Recognition'],
          currentJobs: instance.status === 'busy' ? ['job-789'] : ['job-123', 'job-456'],
          lastHeartbeat: new Date()
        }));
        set({ instances: apiInstances, isLoading: false });
      } else {
        // Fallback to existing mock data if API fails
        set({ isLoading: false });
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch instances' 
      });
    }
  },

  selectInstance: (instance) => {
    set({ selectedInstance: instance });
  },

  updateInstanceStatus: (id, status) => {
    set((state) => ({
      instances: state.instances.map(instance =>
        instance.id === id ? { ...instance, status } : instance
      )
    }));
  },

  addInstance: (instanceData) => {
    const newInstance: GpuInstance = {
      ...instanceData,
      id: `gpu-${Date.now()}`,
      lastHeartbeat: new Date()
    };
    set((state) => ({
      instances: [...state.instances, newInstance]
    }));
  },

  removeInstance: (id) => {
    set((state) => ({
      instances: state.instances.filter(instance => instance.id !== id),
      selectedInstance: state.selectedInstance?.id === id ? null : state.selectedInstance
    }));
  },

  clearError: () => {
    set({ error: null });
  }
}));