import { logger } from '../utils/logger';
import { RunPodService, RunPodConfig, RunPodInstance, CreateInstanceRequest as RunPodCreateRequest } from './gpuProviders/runpodService';
import { VastAiService, VastAiConfig, VastAiInstance, CreateInstanceRequest as VastAiCreateRequest } from './gpuProviders/vastaiService';
import { GpuProvider } from '@prisma/client';

export interface GpuProviderConfig {
  runpod?: RunPodConfig;
  vastai?: VastAiConfig;
}

export interface StandardGpuInstance {
  id: string;
  name: string;
  status: 'CREATED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'TERMINATED';
  provider: GpuProvider;
  gpuType: string;
  gpuCount: number;
  vcpuCount: number;
  memoryInGb: number;
  diskInGb: number;
  costPerHour: number;
  machineId: string;
  imageName: string;
  publicIp?: string;
  sshPort?: number;
  ports?: Array<{
    ip: string;
    isIpPublic: boolean;
    privatePort: number;
    publicPort: number;
    type: string;
  }>;
  runtime?: {
    uptimeInSeconds: number;
    ports: Array<{
      ip: string;
      isIpPublic: boolean;
      privatePort: number;
      publicPort: number;
      type: string;
    }>;
  };
  metrics?: {
    cpuUsage: number;
    memoryUsage: number;
    gpuUsage: number;
    gpuMemoryUsage: number;
    networkUp?: number;
    networkDown?: number;
  };
}

export interface CreateGpuInstanceRequest {
  provider: GpuProvider;
  name: string;
  imageName: string;
  gpuType: string;
  gpuCount?: number;
  vcpuCount?: number;
  memoryInGb?: number;
  diskInGb?: number;
  env?: Record<string, string>;
  ports?: string;
  startSsh?: boolean;
  startJupyter?: boolean;
}

export interface GpuOffer {
  id: string;
  provider: GpuProvider;
  gpuType: string;
  gpuCount: number;
  vcpuCount: number;
  memoryInGb: number;
  diskInGb: number;
  costPerHour: number;
  reliability?: number;
  available: boolean;
}

export class GpuProviderManager {
  private runpodService?: RunPodService;
  private vastaiService?: VastAiService;

  constructor(config: GpuProviderConfig) {
    if (config.runpod) {
      this.runpodService = new RunPodService(config.runpod);
    }
    if (config.vastai) {
      this.vastaiService = new VastAiService(config.vastai);
    }
  }

  /**
   * Get all instances from all providers
   */
  async getAllInstances(): Promise<StandardGpuInstance[]> {
    const instances: StandardGpuInstance[] = [];

    try {
      // Get RunPod instances
      if (this.runpodService) {
        try {
          const runpodInstances = await this.runpodService.getInstances();
          instances.push(...runpodInstances.map(instance => this.convertRunPodInstance(instance)));
        } catch (error) {
          logger.error('Failed to get RunPod instances:', error);
        }
      }

      // Get Vast.ai instances
      if (this.vastaiService) {
        try {
          const vastaiInstances = await this.vastaiService.getInstances();
          instances.push(...vastaiInstances.map(instance => this.convertVastAiInstance(instance)));
        } catch (error) {
          logger.error('Failed to get Vast.ai instances:', error);
        }
      }

      return instances;
    } catch (error) {
      logger.error('Failed to get all GPU instances:', error);
      throw new Error(`Failed to get GPU instances: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get instances from a specific provider
   */
  async getInstancesByProvider(provider: GpuProvider): Promise<StandardGpuInstance[]> {
    try {
      switch (provider) {
        case GpuProvider.RUNPOD:
          if (!this.runpodService) {
            throw new Error('RunPod service not configured');
          }
          const runpodInstances = await this.runpodService.getInstances();
          return runpodInstances.map(instance => this.convertRunPodInstance(instance));

        case GpuProvider.VAST_AI:
          if (!this.vastaiService) {
            throw new Error('Vast.ai service not configured');
          }
          const vastaiInstances = await this.vastaiService.getInstances();
          return vastaiInstances.map(instance => this.convertVastAiInstance(instance));

        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      logger.error(`Failed to get instances for provider ${provider}:`, error);
      throw new Error(`Failed to get instances for provider ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific instance by provider and ID
   */
  async getInstance(provider: GpuProvider, instanceId: string): Promise<StandardGpuInstance | null> {
    try {
      switch (provider) {
        case GpuProvider.RUNPOD:
          if (!this.runpodService) {
            throw new Error('RunPod service not configured');
          }
          const runpodInstance = await this.runpodService.getInstance(instanceId);
          return runpodInstance ? this.convertRunPodInstance(runpodInstance) : null;

        case GpuProvider.VAST_AI:
          if (!this.vastaiService) {
            throw new Error('Vast.ai service not configured');
          }
          const vastaiInstance = await this.vastaiService.getInstance(parseInt(instanceId));
          return vastaiInstance ? this.convertVastAiInstance(vastaiInstance) : null;

        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      logger.error(`Failed to get instance ${instanceId} from provider ${provider}:`, error);
      throw new Error(`Failed to get instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new GPU instance
   */
  async createInstance(request: CreateGpuInstanceRequest): Promise<StandardGpuInstance> {
    try {
      switch (request.provider) {
        case GpuProvider.RUNPOD:
          if (!this.runpodService) {
            throw new Error('RunPod service not configured');
          }
          return await this.createRunPodInstance(request);

        case GpuProvider.VAST_AI:
          if (!this.vastaiService) {
            throw new Error('Vast.ai service not configured');
          }
          return await this.createVastAiInstance(request);

        default:
          throw new Error(`Unsupported provider: ${request.provider}`);
      }
    } catch (error) {
      logger.error(`Failed to create instance on provider ${request.provider}:`, error);
      throw new Error(`Failed to create instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Terminate an instance
   */
  async terminateInstance(provider: GpuProvider, instanceId: string): Promise<boolean> {
    try {
      switch (provider) {
        case GpuProvider.RUNPOD:
          if (!this.runpodService) {
            throw new Error('RunPod service not configured');
          }
          return await this.runpodService.terminateInstance(instanceId);

        case GpuProvider.VAST_AI:
          if (!this.vastaiService) {
            throw new Error('Vast.ai service not configured');
          }
          return await this.vastaiService.destroyInstance(parseInt(instanceId));

        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      logger.error(`Failed to terminate instance ${instanceId} on provider ${provider}:`, error);
      throw new Error(`Failed to terminate instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop an instance
   */
  async stopInstance(provider: GpuProvider, instanceId: string): Promise<boolean> {
    try {
      switch (provider) {
        case GpuProvider.RUNPOD:
          if (!this.runpodService) {
            throw new Error('RunPod service not configured');
          }
          return await this.runpodService.stopInstance(instanceId);

        case GpuProvider.VAST_AI:
          if (!this.vastaiService) {
            throw new Error('Vast.ai service not configured');
          }
          return await this.vastaiService.stopInstance(parseInt(instanceId));

        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      logger.error(`Failed to stop instance ${instanceId} on provider ${provider}:`, error);
      throw new Error(`Failed to stop instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start/Resume an instance
   */
  async startInstance(provider: GpuProvider, instanceId: string): Promise<boolean> {
    try {
      switch (provider) {
        case GpuProvider.RUNPOD:
          if (!this.runpodService) {
            throw new Error('RunPod service not configured');
          }
          return await this.runpodService.resumeInstance(instanceId);

        case GpuProvider.VAST_AI:
          if (!this.vastaiService) {
            throw new Error('Vast.ai service not configured');
          }
          return await this.vastaiService.startInstance(parseInt(instanceId));

        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      logger.error(`Failed to start instance ${instanceId} on provider ${provider}:`, error);
      throw new Error(`Failed to start instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get instance metrics
   */
  async getInstanceMetrics(provider: GpuProvider, instanceId: string): Promise<any> {
    try {
      switch (provider) {
        case GpuProvider.RUNPOD:
          if (!this.runpodService) {
            throw new Error('RunPod service not configured');
          }
          return await this.runpodService.getInstanceMetrics(instanceId);

        case GpuProvider.VAST_AI:
          if (!this.vastaiService) {
            throw new Error('Vast.ai service not configured');
          }
          return await this.vastaiService.getInstanceMetrics(parseInt(instanceId));

        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      logger.error(`Failed to get metrics for instance ${instanceId} on provider ${provider}:`, error);
      throw new Error(`Failed to get instance metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available offers from all providers
   */
  async getAvailableOffers(filters?: {
    gpuType?: string;
    minGpuCount?: number;
    maxCostPerHour?: number;
    minMemoryGb?: number;
  }): Promise<GpuOffer[]> {
    const offers: GpuOffer[] = [];

    try {
      // Get RunPod GPU types
      if (this.runpodService) {
        try {
          const gpuTypes = await this.runpodService.getGpuTypes();
          offers.push(...gpuTypes.map(gpuType => ({
            id: `runpod-${gpuType.id}`,
            provider: GpuProvider.RUNPOD,
            gpuType: gpuType.displayName,
            gpuCount: 1,
            vcpuCount: 8, // Default values
            memoryInGb: gpuType.memoryInGb,
            diskInGb: 50,
            costPerHour: gpuType.lowestPrice.uninterruptablePrice,
            available: gpuType.communityCloud || gpuType.secureCloud,
          })));
        } catch (error) {
          logger.error('Failed to get RunPod offers:', error);
        }
      }

      // Get Vast.ai offers
      if (this.vastaiService) {
        try {
          const vastOffers = await this.vastaiService.getOffers({
            gpu_name: filters?.gpuType,
            num_gpus: filters?.minGpuCount,
            max_dph: filters?.maxCostPerHour,
            rentable: true,
            limit: 50,
          });
          offers.push(...vastOffers.map(offer => ({
            id: `vast-${offer.id}`,
            provider: GpuProvider.VAST_AI,
            gpuType: offer.gpu_name,
            gpuCount: offer.num_gpus,
            vcpuCount: offer.cpu_cores,
            memoryInGb: Math.round(offer.ram / 1024),
            diskInGb: Math.round(offer.disk_space / 1024),
            costPerHour: offer.dph_total,
            reliability: offer.reliability2,
            available: offer.rentable && !offer.rented,
          })));
        } catch (error) {
          logger.error('Failed to get Vast.ai offers:', error);
        }
      }

      // Apply filters
      let filteredOffers = offers;
      if (filters) {
        if (filters.gpuType) {
          filteredOffers = filteredOffers.filter(offer => 
            offer.gpuType.toLowerCase().includes(filters.gpuType!.toLowerCase())
          );
        }
        if (filters.minGpuCount) {
          filteredOffers = filteredOffers.filter(offer => offer.gpuCount >= filters.minGpuCount!);
        }
        if (filters.maxCostPerHour) {
          filteredOffers = filteredOffers.filter(offer => offer.costPerHour <= filters.maxCostPerHour!);
        }
        if (filters.minMemoryGb) {
          filteredOffers = filteredOffers.filter(offer => offer.memoryInGb >= filters.minMemoryGb!);
        }
      }

      // Sort by cost per hour
      filteredOffers.sort((a, b) => a.costPerHour - b.costPerHour);

      return filteredOffers;
    } catch (error) {
      logger.error('Failed to get available offers:', error);
      throw new Error(`Failed to get available offers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create RunPod instance
   */
  private async createRunPodInstance(request: CreateGpuInstanceRequest): Promise<StandardGpuInstance> {
    const runpodRequest: RunPodCreateRequest = {
      name: request.name,
      imageName: request.imageName,
      gpuTypeId: request.gpuType,
      cloudType: 'ALL',
      gpuCount: request.gpuCount || 1,
      minVcpuCount: request.vcpuCount || 2,
      minMemoryInGb: request.memoryInGb || 8,
      containerDiskInGb: request.diskInGb || 20,
      supportPublicIp: true,
      startSsh: request.startSsh ?? true,
      startJupyter: request.startJupyter ?? false,
      env: request.env ? Object.entries(request.env).map(([key, value]) => ({ key, value })) : [],
      ports: request.ports || '22/tcp',
    };

    const instance = await this.runpodService!.createInstance(runpodRequest);
    return this.convertRunPodInstance(instance);
  }

  /**
   * Create Vast.ai instance
   */
  private async createVastAiInstance(request: CreateGpuInstanceRequest): Promise<StandardGpuInstance> {
    // First, find a suitable offer
    const offers = await this.vastaiService!.getOffers({
      gpu_name: request.gpuType,
      rentable: true,
      limit: 1,
    });

    if (offers.length === 0) {
      throw new Error(`No available offers found for GPU type: ${request.gpuType}`);
    }

    const offer = offers[0];
    const vastRequest: VastAiCreateRequest = {
      client_id: 'me',
      image: request.imageName,
      label: request.name,
      runtype: 'ssh',
      disk: request.diskInGb || 50,
      env: request.env || {},
    };

    const instance = await this.vastaiService!.createInstance(offer.id, vastRequest);
    return this.convertVastAiInstance(instance);
  }

  /**
   * Convert RunPod instance to standard format
   */
  private convertRunPodInstance(instance: RunPodInstance): StandardGpuInstance {
    return {
      id: instance.id,
      name: instance.name,
      status: instance.status,
      provider: GpuProvider.RUNPOD,
      gpuType: instance.gpuType,
      gpuCount: instance.gpuCount,
      vcpuCount: instance.vcpuCount,
      memoryInGb: instance.memoryInGb,
      diskInGb: instance.diskInGb,
      costPerHour: instance.costPerHour,
      machineId: instance.machineId,
      imageName: instance.imageName,
      publicIp: instance.ports?.[0]?.ip,
      sshPort: instance.ports?.find(p => p.type === 'tcp')?.publicPort,
      ports: instance.ports,
      runtime: instance.runtime,
    };
  }

  /**
   * Convert Vast.ai instance to standard format
   */
  private convertVastAiInstance(instance: VastAiInstance): StandardGpuInstance {
    return {
      id: instance.id.toString(),
      name: instance.label || `vast-${instance.id}`,
      status: this.vastaiService!.mapStatus(instance.status),
      provider: GpuProvider.VAST_AI,
      gpuType: instance.gpu_name,
      gpuCount: instance.num_gpus,
      vcpuCount: instance.cpu_cores,
      memoryInGb: Math.round(instance.ram / 1024),
      diskInGb: Math.round(instance.disk_space / 1024),
      costPerHour: instance.dph_total,
      machineId: instance.machine_id.toString(),
      imageName: instance.image,
      publicIp: instance.public_ipaddr,
      sshPort: instance.ssh_port,
      ports: [{
        ip: instance.public_ipaddr,
        isIpPublic: true,
        privatePort: instance.ssh_port,
        publicPort: instance.ssh_port,
        type: 'ssh'
      }],
      runtime: instance.status === 'running' ? {
        uptimeInSeconds: instance.duration,
        ports: [{
          ip: instance.public_ipaddr,
          isIpPublic: true,
          privatePort: instance.ssh_port,
          publicPort: instance.ssh_port,
          type: 'ssh'
        }],
      } : undefined,
    };
  }
}

export default GpuProviderManager;