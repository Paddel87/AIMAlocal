import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';

export interface RunPodConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface RunPodInstance {
  id: string;
  name: string;
  status: 'CREATED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'TERMINATED';
  gpuType: string;
  gpuCount: number;
  vcpuCount: number;
  memoryInGb: number;
  diskInGb: number;
  costPerHour: number;
  machineId: string;
  podId: string;
  imageName: string;
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
}

export interface CreateInstanceRequest {
  name: string;
  imageName: string;
  gpuTypeId: string;
  cloudType: 'ALL' | 'COMMUNITY' | 'SECURE';
  supportPublicIp?: boolean;
  startJupyter?: boolean;
  startSsh?: boolean;
  volumeInGb?: number;
  containerDiskInGb?: number;
  minVcpuCount?: number;
  minMemoryInGb?: number;
  gpuCount?: number;
  bidPerGpu?: number;
  countryCode?: string;
  env?: Array<{
    key: string;
    value: string;
  }>;
  ports?: string;
  volumeMountPath?: string;
  dockerArgs?: string;
}

export interface RunPodGpuType {
  id: string;
  displayName: string;
  memoryInGb: number;
  secureCloud: boolean;
  communityCloud: boolean;
  lowestPrice: {
    minimumBidPrice: number;
    uninterruptablePrice: number;
  };
}

export class RunPodService {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(config: RunPodConfig) {
    this.apiKey = config.apiKey;
    this.client = axios.create({
      baseURL: config.baseUrl || 'https://api.runpod.io/graphql',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Get all GPU instances
   */
  async getInstances(): Promise<RunPodInstance[]> {
    try {
      const query = `
        query {
          myself {
            pods {
              id
              name
              runtime {
                uptimeInSeconds
                ports {
                  ip
                  isIpPublic
                  privatePort
                  publicPort
                  type
                }
              }
              machine {
                podHostId
              }
              imageName
              env
              memoryInGb
              vcpuCount
              costPerHour
              gpuCount
              lastStatusChange
              desiredStatus
            }
          }
        }
      `;

      const response = await this.client.post('', { query });
      
      if (response.data.errors) {
        throw new Error(`RunPod API Error: ${response.data.errors[0].message}`);
      }

      const pods = response.data.data.myself.pods;
      return pods.map((pod: any) => this.mapPodToInstance(pod));
    } catch (error) {
      logger.error('Failed to get RunPod instances:', error);
      throw new Error(`Failed to get RunPod instances: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific GPU instance by ID
   */
  async getInstance(instanceId: string): Promise<RunPodInstance | null> {
    try {
      const query = `
        query {
          pod(input: { podId: "${instanceId}" }) {
            id
            name
            runtime {
              uptimeInSeconds
              ports {
                ip
                isIpPublic
                privatePort
                publicPort
                type
              }
            }
            machine {
              podHostId
            }
            imageName
            env
            memoryInGb
            vcpuCount
            costPerHour
            gpuCount
            lastStatusChange
            desiredStatus
          }
        }
      `;

      const response = await this.client.post('', { query });
      
      if (response.data.errors) {
        throw new Error(`RunPod API Error: ${response.data.errors[0].message}`);
      }

      const pod = response.data.data.pod;
      return pod ? this.mapPodToInstance(pod) : null;
    } catch (error) {
      logger.error(`Failed to get RunPod instance ${instanceId}:`, error);
      throw new Error(`Failed to get RunPod instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new GPU instance
   */
  async createInstance(request: CreateInstanceRequest): Promise<RunPodInstance> {
    try {
      const mutation = `
        mutation {
          podFindAndDeployOnDemand(
            input: {
              cloudType: ${request.cloudType}
              gpuCount: ${request.gpuCount || 1}
              volumeInGb: ${request.volumeInGb || 50}
              containerDiskInGb: ${request.containerDiskInGb || 20}
              minVcpuCount: ${request.minVcpuCount || 2}
              minMemoryInGb: ${request.minMemoryInGb || 8}
              gpuTypeId: "${request.gpuTypeId}"
              name: "${request.name}"
              imageName: "${request.imageName}"
              dockerArgs: "${request.dockerArgs || ''}"
              ports: "${request.ports || '8888/http'}"
              volumeMountPath: "${request.volumeMountPath || '/workspace'}"
              env: ${JSON.stringify(request.env || [])}
              supportPublicIp: ${request.supportPublicIp || true}
              startJupyter: ${request.startJupyter || false}
              startSsh: ${request.startSsh || true}
            }
          ) {
            id
            imageName
            env
            machineId
            machine {
              podHostId
            }
          }
        }
      `;

      const response = await this.client.post('', { query: mutation });
      
      if (response.data.errors) {
        throw new Error(`RunPod API Error: ${response.data.errors[0].message}`);
      }

      const pod = response.data.data.podFindAndDeployOnDemand;
      
      // Get the full instance details
      const instance = await this.getInstance(pod.id);
      if (!instance) {
        throw new Error('Failed to retrieve created instance details');
      }

      logger.info(`Created RunPod instance: ${pod.id}`);
      return instance;
    } catch (error) {
      logger.error('Failed to create RunPod instance:', error);
      throw new Error(`Failed to create RunPod instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Terminate a GPU instance
   */
  async terminateInstance(instanceId: string): Promise<boolean> {
    try {
      const mutation = `
        mutation {
          podTerminate(input: { podId: "${instanceId}" }) {
            id
          }
        }
      `;

      const response = await this.client.post('', { query: mutation });
      
      if (response.data.errors) {
        throw new Error(`RunPod API Error: ${response.data.errors[0].message}`);
      }

      logger.info(`Terminated RunPod instance: ${instanceId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to terminate RunPod instance ${instanceId}:`, error);
      throw new Error(`Failed to terminate RunPod instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop a GPU instance
   */
  async stopInstance(instanceId: string): Promise<boolean> {
    try {
      const mutation = `
        mutation {
          podStop(input: { podId: "${instanceId}" }) {
            id
            desiredStatus
          }
        }
      `;

      const response = await this.client.post('', { query: mutation });
      
      if (response.data.errors) {
        throw new Error(`RunPod API Error: ${response.data.errors[0].message}`);
      }

      logger.info(`Stopped RunPod instance: ${instanceId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to stop RunPod instance ${instanceId}:`, error);
      throw new Error(`Failed to stop RunPod instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Resume a stopped GPU instance
   */
  async resumeInstance(instanceId: string): Promise<boolean> {
    try {
      const mutation = `
        mutation {
          podResume(input: { podId: "${instanceId}" }) {
            id
            desiredStatus
          }
        }
      `;

      const response = await this.client.post('', { query: mutation });
      
      if (response.data.errors) {
        throw new Error(`RunPod API Error: ${response.data.errors[0].message}`);
      }

      logger.info(`Resumed RunPod instance: ${instanceId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to resume RunPod instance ${instanceId}:`, error);
      throw new Error(`Failed to resume RunPod instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available GPU types
   */
  async getGpuTypes(): Promise<RunPodGpuType[]> {
    try {
      const query = `
        query {
          gpuTypes {
            id
            displayName
            memoryInGb
            secureCloud
            communityCloud
            lowestPrice {
              minimumBidPrice
              uninterruptablePrice
            }
          }
        }
      `;

      const response = await this.client.post('', { query });
      
      if (response.data.errors) {
        throw new Error(`RunPod API Error: ${response.data.errors[0].message}`);
      }

      return response.data.data.gpuTypes;
    } catch (error) {
      logger.error('Failed to get RunPod GPU types:', error);
      throw new Error(`Failed to get RunPod GPU types: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get instance metrics
   */
  async getInstanceMetrics(instanceId: string): Promise<any> {
    try {
      // RunPod doesn't provide detailed metrics via GraphQL API
      // This would typically require SSH access to the instance
      // For now, return basic runtime information
      const instance = await this.getInstance(instanceId);
      
      if (!instance || !instance.runtime) {
        return null;
      }

      return {
        uptime: instance.runtime.uptimeInSeconds,
        status: instance.status,
        ports: instance.runtime.ports,
        // Mock metrics - in real implementation, these would come from monitoring agents
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 100,
        gpuUsage: Math.random() * 100,
        gpuMemoryUsage: Math.random() * 100,
      };
    } catch (error) {
      logger.error(`Failed to get RunPod instance metrics ${instanceId}:`, error);
      throw new Error(`Failed to get RunPod instance metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map RunPod API response to our instance format
   */
  private mapPodToInstance(pod: any): RunPodInstance {
    return {
      id: pod.id,
      name: pod.name,
      status: this.mapStatus(pod.desiredStatus),
      gpuType: 'Unknown', // RunPod doesn't return GPU type in pod details
      gpuCount: pod.gpuCount || 1,
      vcpuCount: pod.vcpuCount || 2,
      memoryInGb: pod.memoryInGb || 8,
      diskInGb: pod.containerDiskInGb || 20,
      costPerHour: pod.costPerHour || 0,
      machineId: pod.machine?.podHostId || '',
      podId: pod.id,
      imageName: pod.imageName,
      ports: pod.runtime?.ports || [],
      runtime: pod.runtime ? {
        uptimeInSeconds: pod.runtime.uptimeInSeconds,
        ports: pod.runtime.ports || [],
      } : undefined,
    };
  }

  /**
   * Map RunPod status to our standard status
   */
  private mapStatus(status: string): RunPodInstance['status'] {
    switch (status?.toUpperCase()) {
      case 'CREATED':
        return 'CREATED';
      case 'STARTING':
        return 'STARTING';
      case 'RUNNING':
        return 'RUNNING';
      case 'STOPPING':
        return 'STOPPING';
      case 'STOPPED':
        return 'STOPPED';
      case 'TERMINATED':
        return 'TERMINATED';
      default:
        return 'CREATED';
    }
  }
}

export default RunPodService;