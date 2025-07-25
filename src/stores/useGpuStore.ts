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
  fetchGpuInstances: () => Promise<void>;
  selectInstance: (instance: GpuInstance) => void;
  updateInstanceStatus: (id: string, status: GpuInstance['status']) => void;
  addInstance: (instance: Omit<GpuInstance, 'id'>) => void;
  removeInstance: (id: string) => void;
  clearError: () => void;
  generateClusters: () => void;
}

export const useGpuStore = create<GpuStore>((set, get) => ({
  instances: [],
  clusters: [],
  selectedInstance: null,
  isLoading: false,
  error: null,

  fetchInstances: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.makeRequest('/gpu');
      if (response.success && response.data) {
        // Use real API data from /gpu endpoint
        const apiInstances: GpuInstance[] = response.data.instances?.map((instance: any) => ({
          id: instance.id,
          name: instance.name || `${instance.gpuType} Instance`,
          status: instance.status as 'online' | 'offline' | 'busy' | 'maintenance',
          type: instance.gpuType || instance.type || 'Unknown',
          memory: instance.memory || {
            total: instance.memoryInGb ? instance.memoryInGb * 1024 : 24576,
            used: instance.memoryUsed || 8192,
            available: (instance.memoryInGb ? instance.memoryInGb * 1024 : 24576) - (instance.memoryUsed || 8192)
          },
          utilization: instance.utilization || (instance.status === 'busy' ? 89 : 35),
          temperature: instance.temperature || (instance.status === 'busy' ? 78 : 72),
          powerUsage: instance.powerUsage || (instance.status === 'busy' ? 380 : 320),
          location: instance.location || instance.region || 'Unknown',
          cost: instance.cost || {
            perHour: instance.costPerHour || 2.50,
            currency: 'EUR'
          },
          capabilities: instance.capabilities || ['CUDA', 'ML Training', 'Video Processing', 'Face Recognition'],
          currentJobs: instance.currentJobs || [],
          lastHeartbeat: instance.lastHeartbeat ? new Date(instance.lastHeartbeat) : new Date()
        })) || [];
        set({ instances: apiInstances, isLoading: false });
        get().generateClusters();
      } else {
        // If no real data available, clear instances array
        set({ instances: [], isLoading: false });
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch instances' 
      });
    }
  },

  fetchGpuInstances: async () => {
    return get().fetchInstances();
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
  },

  generateClusters: () => {
    const { instances } = get();
    if (instances.length === 0) {
      set({ clusters: [] });
      return;
    }

    // Group instances by region/location
    const regionGroups = instances.reduce((groups, instance) => {
      const region = instance.location || 'Unknown Region';
      if (!groups[region]) {
        groups[region] = [];
      }
      groups[region].push(instance);
      return groups;
    }, {} as Record<string, GpuInstance[]>);

    // Create clusters from region groups
    const clusters: GpuCluster[] = Object.entries(regionGroups).map(([region, regionInstances], index) => {
      const totalCapacity = regionInstances.length * 100; // Assume 100 capacity per instance
      const busyInstances = regionInstances.filter(i => i.status === 'busy').length;
      const availableCapacity = totalCapacity - (busyInstances * 100);
      
      return {
        id: `cluster-${String(index + 1).padStart(3, '0')}`,
        name: `${region} Cluster`,
        instances: regionInstances,
        totalCapacity,
        availableCapacity,
        region,
        status: regionInstances.some(i => i.status === 'online' || i.status === 'busy') ? 'active' : 'inactive'
      };
    });

    set({ clusters });
  }
}));