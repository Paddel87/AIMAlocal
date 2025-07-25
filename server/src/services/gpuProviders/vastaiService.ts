import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';

export interface VastAiConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface VastAiInstance {
  id: number;
  status: 'created' | 'loading' | 'running' | 'stopped' | 'exited';
  label: string;
  image: string;
  gpu_name: string;
  num_gpus: number;
  cpu_cores: number;
  cpu_cores_effective: number;
  ram: number;
  disk_space: number;
  dlperf: number;
  dlperf_per_dphtotal: number;
  dph_total: number;
  dph_base: number;
  machine_id: number;
  hostname: string;
  ssh_host: string;
  ssh_port: number;
  ssh_idx: number;
  direct_port_start: number;
  direct_port_end: number;
  direct_port_count: number;
  ports: string;
  actual_status: string;
  intended_status: string;
  start_date: number;
  end_date?: number;
  duration: number;
  cur_state: string;
  next_state: string;
  public_ipaddr: string;
  inet_up: number;
  inet_down: number;
  reliability2: number;
  rentable: boolean;
  compute_cap: number;
  driver_version: string;
  cuda_max_good: number;
  mobo_id: string;
  gpu_frac: number;
  has_avx: number;
  pci_gen: number;
  pcie_bw: number;
  logo: string;
  verification: string;
  rented: boolean;
  bundled_results: number;
  pending_count: number;
  jupyter_token?: string;
}

export interface CreateInstanceRequest {
  client_id: string;
  image: string;
  label?: string;
  onstart?: string;
  runtype?: 'ssh' | 'jupyter' | 'docker';
  image_login?: string;
  python_utf8?: boolean;
  lang_utf8?: boolean;
  use_jupyter_lab?: boolean;
  jupyter_dir?: string;
  create_from?: string;
  force?: boolean;
  disk?: number;
  env?: Record<string, string>;
}

export interface VastAiOffer {
  id: number;
  machine_id: number;
  hostname: string;
  gpu_name: string;
  num_gpus: number;
  cpu_cores: number;
  cpu_cores_effective: number;
  ram: number;
  disk_space: number;
  dlperf: number;
  dlperf_per_dphtotal: number;
  dph_total: number;
  dph_base: number;
  reliability2: number;
  rentable: boolean;
  compute_cap: number;
  driver_version: string;
  cuda_max_good: number;
  inet_up: number;
  inet_down: number;
  direct_port_count: number;
  gpu_frac: number;
  has_avx: number;
  pci_gen: number;
  pcie_bw: number;
  verification: string;
  rented: boolean;
  bundled_results: number;
  pending_count: number;
  logo: string;
  mobo_id: string;
}

export class VastAiService {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(config: VastAiConfig) {
    this.apiKey = config.apiKey;
    this.client = axios.create({
      baseURL: config.baseUrl || 'https://console.vast.ai/api/v0',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Get all instances
   */
  async getInstances(): Promise<VastAiInstance[]> {
    try {
      const response = await this.client.get('/instances/');
      
      if (!response.data.success) {
        throw new Error(`Vast.ai API Error: ${response.data.msg || 'Unknown error'}`);
      }

      return response.data.instances || [];
    } catch (error) {
      logger.error('Failed to get Vast.ai instances:', error);
      throw new Error(`Failed to get Vast.ai instances: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific instance by ID
   */
  async getInstance(instanceId: number): Promise<VastAiInstance | null> {
    try {
      const response = await this.client.get(`/instances/${instanceId}/`);
      
      if (!response.data.success) {
        if (response.data.msg?.includes('not found')) {
          return null;
        }
        throw new Error(`Vast.ai API Error: ${response.data.msg || 'Unknown error'}`);
      }

      return response.data.instance;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      logger.error(`Failed to get Vast.ai instance ${instanceId}:`, error);
      throw new Error(`Failed to get Vast.ai instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new instance
   */
  async createInstance(offerId: number, request: CreateInstanceRequest): Promise<VastAiInstance> {
    try {
      const response = await this.client.put(`/asks/${offerId}/`, request);
      
      if (!response.data.success) {
        throw new Error(`Vast.ai API Error: ${response.data.msg || 'Unknown error'}`);
      }

      const instanceId = response.data.new_contract;
      
      // Wait a moment for the instance to be created
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get the full instance details
      const instance = await this.getInstance(instanceId);
      if (!instance) {
        throw new Error('Failed to retrieve created instance details');
      }

      logger.info(`Created Vast.ai instance: ${instanceId}`);
      return instance;
    } catch (error) {
      logger.error('Failed to create Vast.ai instance:', error);
      throw new Error(`Failed to create Vast.ai instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Destroy an instance
   */
  async destroyInstance(instanceId: number): Promise<boolean> {
    try {
      const response = await this.client.delete(`/instances/${instanceId}/`);
      
      if (!response.data.success) {
        throw new Error(`Vast.ai API Error: ${response.data.msg || 'Unknown error'}`);
      }

      logger.info(`Destroyed Vast.ai instance: ${instanceId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to destroy Vast.ai instance ${instanceId}:`, error);
      throw new Error(`Failed to destroy Vast.ai instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop an instance
   */
  async stopInstance(instanceId: number): Promise<boolean> {
    try {
      const response = await this.client.put(`/instances/${instanceId}/`, {
        intended_status: 'stopped'
      });
      
      if (!response.data.success) {
        throw new Error(`Vast.ai API Error: ${response.data.msg || 'Unknown error'}`);
      }

      logger.info(`Stopped Vast.ai instance: ${instanceId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to stop Vast.ai instance ${instanceId}:`, error);
      throw new Error(`Failed to stop Vast.ai instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start an instance
   */
  async startInstance(instanceId: number): Promise<boolean> {
    try {
      const response = await this.client.put(`/instances/${instanceId}/`, {
        intended_status: 'running'
      });
      
      if (!response.data.success) {
        throw new Error(`Vast.ai API Error: ${response.data.msg || 'Unknown error'}`);
      }

      logger.info(`Started Vast.ai instance: ${instanceId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to start Vast.ai instance ${instanceId}:`, error);
      throw new Error(`Failed to start Vast.ai instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available offers (machines available for rent)
   */
  async getOffers(filters?: {
    gpu_name?: string;
    num_gpus?: number;
    min_dlperf?: number;
    max_dph?: number;
    verified?: boolean;
    rentable?: boolean;
    order?: string;
    limit?: number;
  }): Promise<VastAiOffer[]> {
    try {
      const params = new URLSearchParams();
      
      if (filters) {
        if (filters.gpu_name) params.append('q', `gpu_name=${filters.gpu_name}`);
        if (filters.num_gpus) params.append('q', `num_gpus>=${filters.num_gpus}`);
        if (filters.min_dlperf) params.append('q', `dlperf>=${filters.min_dlperf}`);
        if (filters.max_dph) params.append('q', `dph_total<=${filters.max_dph}`);
        if (filters.verified !== undefined) params.append('q', `verified=${filters.verified}`);
        if (filters.rentable !== undefined) params.append('q', `rentable=${filters.rentable}`);
        if (filters.order) params.append('order', filters.order);
        if (filters.limit) params.append('limit', filters.limit.toString());
      }

      const response = await this.client.get(`/bundles/?${params.toString()}`);
      
      if (!response.data.success) {
        throw new Error(`Vast.ai API Error: ${response.data.msg || 'Unknown error'}`);
      }

      return response.data.offers || [];
    } catch (error) {
      logger.error('Failed to get Vast.ai offers:', error);
      throw new Error(`Failed to get Vast.ai offers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get instance metrics
   */
  async getInstanceMetrics(instanceId: number): Promise<any> {
    try {
      const instance = await this.getInstance(instanceId);
      
      if (!instance) {
        return null;
      }

      // Vast.ai doesn't provide detailed real-time metrics via API
      // This would typically require SSH access to the instance
      return {
        uptime: instance.duration,
        status: instance.status,
        actualStatus: instance.actual_status,
        intendedStatus: instance.intended_status,
        reliability: instance.reliability2,
        // Mock metrics - in real implementation, these would come from monitoring agents
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 100,
        gpuUsage: Math.random() * 100,
        gpuMemoryUsage: Math.random() * 100,
        networkUp: instance.inet_up,
        networkDown: instance.inet_down,
      };
    } catch (error) {
      logger.error(`Failed to get Vast.ai instance metrics ${instanceId}:`, error);
      throw new Error(`Failed to get Vast.ai instance metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<any> {
    try {
      const response = await this.client.get('/users/current/');
      
      if (!response.data.success) {
        throw new Error(`Vast.ai API Error: ${response.data.msg || 'Unknown error'}`);
      }

      return response.data.user;
    } catch (error) {
      logger.error('Failed to get Vast.ai account info:', error);
      throw new Error(`Failed to get Vast.ai account info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get billing information
   */
  async getBillingInfo(): Promise<any> {
    try {
      const response = await this.client.get('/users/current/');
      
      if (!response.data.success) {
        throw new Error(`Vast.ai API Error: ${response.data.msg || 'Unknown error'}`);
      }

      return {
        credit: response.data.user.credit,
        balance: response.data.user.balance,
      };
    } catch (error) {
      logger.error('Failed to get Vast.ai billing info:', error);
      throw new Error(`Failed to get Vast.ai billing info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map Vast.ai status to our standard status
   */
  mapStatus(status: string): 'CREATED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'TERMINATED' {
    switch (status?.toLowerCase()) {
      case 'created':
        return 'CREATED';
      case 'loading':
        return 'STARTING';
      case 'running':
        return 'RUNNING';
      case 'stopped':
        return 'STOPPED';
      case 'exited':
        return 'TERMINATED';
      default:
        return 'CREATED';
    }
  }

  /**
   * Convert Vast.ai instance to our standard format
   */
  toStandardInstance(instance: VastAiInstance) {
    return {
      id: instance.id.toString(),
      name: instance.label || `vast-${instance.id}`,
      status: this.mapStatus(instance.status),
      gpuType: instance.gpu_name,
      gpuCount: instance.num_gpus,
      vcpuCount: instance.cpu_cores,
      memoryInGb: Math.round(instance.ram / 1024), // Convert MB to GB
      diskInGb: Math.round(instance.disk_space / 1024), // Convert MB to GB
      costPerHour: instance.dph_total,
      machineId: instance.machine_id.toString(),
      podId: instance.id.toString(),
      imageName: instance.image,
      ports: instance.ports ? [{
        ip: instance.public_ipaddr,
        isIpPublic: true,
        privatePort: instance.ssh_port,
        publicPort: instance.ssh_port,
        type: 'ssh'
      }] : [],
      runtime: instance.status === 'running' ? {
        uptimeInSeconds: instance.duration,
        ports: instance.ports ? [{
          ip: instance.public_ipaddr,
          isIpPublic: true,
          privatePort: instance.ssh_port,
          publicPort: instance.ssh_port,
          type: 'ssh'
        }] : [],
      } : undefined,
    };
  }
}

export default VastAiService;