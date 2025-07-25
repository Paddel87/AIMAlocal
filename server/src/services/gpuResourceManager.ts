import { GpuProvider, GpuStatus } from '@prisma/client';
import { logger } from '../utils/logger';
import { gpuProviderManager } from './gpuProviderManager';
import { costTrackingService } from './costTrackingService';

export interface ResourceAllocation {
  instanceId: string;
  provider: GpuProvider;
  gpuType: string;
  allocatedAt: Date;
  estimatedDuration: number; // in minutes
  priority: 'low' | 'medium' | 'high';
  userId: string;
  jobId?: string;
}

export interface ResourceOptimization {
  recommendation: 'scale_up' | 'scale_down' | 'migrate' | 'terminate' | 'no_action';
  reason: string;
  estimatedSavings?: number;
  suggestedAction?: {
    provider?: GpuProvider;
    instanceType?: string;
    region?: string;
  };
}

export interface ResourceMetrics {
  totalInstances: number;
  runningInstances: number;
  idleInstances: number;
  utilizationRate: number;
  totalCostPerHour: number;
  efficiency: number; // 0-1 scale
}

class GpuResourceManager {
  private allocations: Map<string, ResourceAllocation> = new Map();
  private optimizationInterval: NodeJS.Timeout | null = null;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startOptimizationLoop();
    this.startMetricsCollection();
  }

  /**
   * Allocate GPU resources for a job
   */
  async allocateResources(params: {
    userId: string;
    jobId?: string;
    requirements: {
      gpuType: string;
      minGpuCount: number;
      maxCostPerHour?: number;
      preferredProvider?: GpuProvider;
      region?: string;
    };
    priority: 'low' | 'medium' | 'high';
    estimatedDuration: number; // in minutes
  }): Promise<ResourceAllocation | null> {
    try {
      logger.info(`Allocating resources for user ${params.userId}`, {
        requirements: params.requirements,
        priority: params.priority,
      });

      // Find best available instance
      const bestOffer = await this.findBestOffer(params.requirements);
      if (!bestOffer) {
        logger.warn('No suitable GPU offers found', { requirements: params.requirements });
        return null;
      }

      // Create instance
      const instance = await gpuProviderManager.createInstance(bestOffer.provider, {
        gpuType: params.requirements.gpuType,
        region: params.requirements.region || bestOffer.region,
        name: `job-${params.jobId || 'manual'}-${Date.now()}`,
      });

      const allocation: ResourceAllocation = {
        instanceId: instance.id,
        provider: bestOffer.provider,
        gpuType: params.requirements.gpuType,
        allocatedAt: new Date(),
        estimatedDuration: params.estimatedDuration,
        priority: params.priority,
        userId: params.userId,
        jobId: params.jobId,
      };

      this.allocations.set(instance.id, allocation);

      logger.info(`Resources allocated: ${instance.id} for user ${params.userId}`);
      return allocation;
    } catch (error) {
      logger.error('Failed to allocate resources:', error);
      throw error;
    }
  }

  /**
   * Deallocate GPU resources
   */
  async deallocateResources(instanceId: string, userId: string): Promise<void> {
    try {
      const allocation = this.allocations.get(instanceId);
      if (!allocation) {
        logger.warn(`No allocation found for instance ${instanceId}`);
        return;
      }

      if (allocation.userId !== userId) {
        throw new Error('Unauthorized to deallocate this resource');
      }

      // Terminate instance
      await gpuProviderManager.terminateInstance(allocation.provider, instanceId);

      // Record cost
      const endTime = new Date();
      const duration = Math.ceil((endTime.getTime() - allocation.allocatedAt.getTime()) / (1000 * 60));
      
      // Get instance details for cost calculation
      const instance = await gpuProviderManager.getInstance(allocation.provider, instanceId);
      if (instance && instance.costPerHour) {
        await costTrackingService.recordCost({
          userId: allocation.userId,
          instanceId,
          provider: allocation.provider,
          costPerHour: instance.costPerHour,
          startTime: allocation.allocatedAt,
          endTime,
          description: `Job: ${allocation.jobId || 'manual'}`,
          metadata: {
            gpuType: allocation.gpuType,
            priority: allocation.priority,
          },
        });
      }

      this.allocations.delete(instanceId);
      logger.info(`Resources deallocated: ${instanceId}`);
    } catch (error) {
      logger.error('Failed to deallocate resources:', error);
      throw error;
    }
  }

  /**
   * Get resource metrics
   */
  async getResourceMetrics(userId?: string): Promise<ResourceMetrics> {
    try {
      const allInstances = await gpuProviderManager.getAllInstances();
      const userInstances = userId 
        ? allInstances.filter(instance => {
            const allocation = this.allocations.get(instance.id);
            return allocation?.userId === userId;
          })
        : allInstances;

      const totalInstances = userInstances.length;
      const runningInstances = userInstances.filter(i => i.status === 'running').length;
      const idleInstances = userInstances.filter(i => {
        return i.status === 'running' && (!i.metrics || i.metrics.gpuUtilization < 10);
      }).length;

      const utilizationRate = runningInstances > 0 
        ? userInstances.reduce((sum, i) => sum + (i.metrics?.gpuUtilization || 0), 0) / runningInstances
        : 0;

      const totalCostPerHour = userInstances.reduce((sum, i) => sum + (i.costPerHour || 0), 0);
      
      // Efficiency based on utilization and cost optimization
      const efficiency = runningInstances > 0 
        ? Math.max(0, (utilizationRate / 100) - (idleInstances / runningInstances))
        : 0;

      return {
        totalInstances,
        runningInstances,
        idleInstances,
        utilizationRate,
        totalCostPerHour,
        efficiency,
      };
    } catch (error) {
      logger.error('Failed to get resource metrics:', error);
      throw error;
    }
  }

  /**
   * Get optimization recommendations
   */
  async getOptimizationRecommendations(userId: string): Promise<ResourceOptimization[]> {
    try {
      const recommendations: ResourceOptimization[] = [];
      const userAllocations = Array.from(this.allocations.values())
        .filter(allocation => allocation.userId === userId);

      for (const allocation of userAllocations) {
        const instance = await gpuProviderManager.getInstance(allocation.provider, allocation.instanceId);
        if (!instance) continue;

        // Check for idle instances
        if (instance.status === 'running' && instance.metrics) {
          const utilization = instance.metrics.gpuUtilization || 0;
          const runningTime = Date.now() - allocation.allocatedAt.getTime();
          const runningMinutes = runningTime / (1000 * 60);

          if (utilization < 5 && runningMinutes > 30) {
            recommendations.push({
              recommendation: 'terminate',
              reason: `Instance ${allocation.instanceId} has been idle (${utilization}% utilization) for ${Math.round(runningMinutes)} minutes`,
              estimatedSavings: (instance.costPerHour || 0) * (runningMinutes / 60),
            });
          } else if (utilization > 90 && allocation.priority === 'high') {
            // Check for better alternatives
            const alternatives = await this.findBetterAlternatives(allocation, instance);
            if (alternatives.length > 0) {
              const bestAlternative = alternatives[0];
              recommendations.push({
                recommendation: 'migrate',
                reason: `Better performance/cost option available`,
                estimatedSavings: (instance.costPerHour || 0) - bestAlternative.costPerHour,
                suggestedAction: {
                  provider: bestAlternative.provider,
                  instanceType: bestAlternative.gpuType,
                  region: bestAlternative.region,
                },
              });
            }
          }
        }

        // Check for long-running instances that exceed estimated duration
        const runningTime = Date.now() - allocation.allocatedAt.getTime();
        const runningMinutes = runningTime / (1000 * 60);
        if (runningMinutes > allocation.estimatedDuration * 1.5) {
          recommendations.push({
            recommendation: 'scale_down',
            reason: `Instance ${allocation.instanceId} has been running ${Math.round(runningMinutes)} minutes, exceeding estimated duration of ${allocation.estimatedDuration} minutes`,
          });
        }
      }

      return recommendations;
    } catch (error) {
      logger.error('Failed to get optimization recommendations:', error);
      return [];
    }
  }

  /**
   * Find best offer based on requirements
   */
  private async findBestOffer(requirements: {
    gpuType: string;
    minGpuCount: number;
    maxCostPerHour?: number;
    preferredProvider?: GpuProvider;
    region?: string;
  }) {
    try {
      const providers = requirements.preferredProvider 
        ? [requirements.preferredProvider]
        : [GpuProvider.RUNPOD, GpuProvider.VASTAI];

      let bestOffer = null;
      let bestScore = -1;

      for (const provider of providers) {
        const offers = await gpuProviderManager.getAvailableOffers(provider, {
          gpuType: requirements.gpuType,
          maxPrice: requirements.maxCostPerHour,
        });

        for (const offer of offers) {
          if (offer.gpuCount < requirements.minGpuCount) continue;
          if (requirements.maxCostPerHour && offer.costPerHour > requirements.maxCostPerHour) continue;
          if (requirements.region && offer.region !== requirements.region) continue;

          // Score based on cost, availability, and performance
          const costScore = requirements.maxCostPerHour 
            ? (requirements.maxCostPerHour - offer.costPerHour) / requirements.maxCostPerHour
            : 1 - (offer.costPerHour / 10); // Normalize to reasonable range
          
          const availabilityScore = offer.available ? 1 : 0;
          const performanceScore = offer.gpuCount / requirements.minGpuCount;
          
          const score = (costScore * 0.4) + (availabilityScore * 0.4) + (performanceScore * 0.2);

          if (score > bestScore) {
            bestScore = score;
            bestOffer = offer;
          }
        }
      }

      return bestOffer;
    } catch (error) {
      logger.error('Failed to find best offer:', error);
      return null;
    }
  }

  /**
   * Find better alternatives for an existing allocation
   */
  private async findBetterAlternatives(allocation: ResourceAllocation, currentInstance: any) {
    try {
      const alternatives = [];
      const providers = [GpuProvider.RUNPOD, GpuProvider.VASTAI];

      for (const provider of providers) {
        if (provider === allocation.provider) continue;

        const offers = await gpuProviderManager.getAvailableOffers(provider, {
          gpuType: allocation.gpuType,
        });

        for (const offer of offers) {
          if (offer.costPerHour < (currentInstance.costPerHour || 0) && offer.available) {
            alternatives.push(offer);
          }
        }
      }

      return alternatives.sort((a, b) => a.costPerHour - b.costPerHour);
    } catch (error) {
      logger.error('Failed to find better alternatives:', error);
      return [];
    }
  }

  /**
   * Start optimization loop
   */
  private startOptimizationLoop(): void {
    const interval = parseInt(process.env.GPU_OPTIMIZATION_INTERVAL || '300000'); // 5 minutes
    
    this.optimizationInterval = setInterval(async () => {
      try {
        await this.performAutomaticOptimization();
      } catch (error) {
        logger.error('Error in optimization loop:', error);
      }
    }, interval);

    logger.info('GPU resource optimization loop started');
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    const interval = parseInt(process.env.METRICS_COLLECTION_INTERVAL || '30000'); // 30 seconds
    
    this.metricsCollectionInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        logger.error('Error in metrics collection:', error);
      }
    }, interval);

    logger.info('GPU metrics collection started');
  }

  /**
   * Perform automatic optimization
   */
  private async performAutomaticOptimization(): Promise<void> {
    try {
      const allAllocations = Array.from(this.allocations.values());
      
      for (const allocation of allAllocations) {
        const instance = await gpuProviderManager.getInstance(allocation.provider, allocation.instanceId);
        if (!instance) continue;

        // Auto-terminate idle instances after 1 hour
        if (instance.status === 'running' && instance.metrics) {
          const utilization = instance.metrics.gpuUtilization || 0;
          const runningTime = Date.now() - allocation.allocatedAt.getTime();
          const runningHours = runningTime / (1000 * 60 * 60);

          if (utilization < 5 && runningHours > 1) {
            logger.info(`Auto-terminating idle instance: ${allocation.instanceId}`);
            await this.deallocateResources(allocation.instanceId, allocation.userId);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to perform automatic optimization:', error);
    }
  }

  /**
   * Collect metrics from all instances
   */
  private async collectMetrics(): Promise<void> {
    try {
      const allInstances = await gpuProviderManager.getAllInstances();
      
      for (const instance of allInstances) {
        if (instance.status === 'running') {
          // Metrics are already collected by the provider manager
          // This is a placeholder for additional custom metrics collection
        }
      }
    } catch (error) {
      logger.error('Failed to collect metrics:', error);
    }
  }

  /**
   * Stop all background processes
   */
  stop(): void {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }
    
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }
    
    logger.info('GPU resource manager stopped');
  }
}

export const gpuResourceManager = new GpuResourceManager();