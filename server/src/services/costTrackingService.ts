import { PrismaClient, GpuProvider } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface CostEntry {
  id: string;
  userId: string;
  instanceId: string;
  provider: GpuProvider;
  costPerHour: number;
  duration: number; // in minutes
  totalCost: number;
  startTime: Date;
  endTime: Date;
  description?: string;
  metadata?: Record<string, any>;
}

export interface CostSummary {
  totalCost: number;
  costByProvider: Record<GpuProvider, number>;
  costByDay: Array<{
    date: string;
    cost: number;
  }>;
  costByInstance: Array<{
    instanceId: string;
    instanceName: string;
    cost: number;
    duration: number;
  }>;
}

export interface CostAlert {
  id: string;
  userId: string;
  threshold: number;
  currentCost: number;
  period: 'daily' | 'weekly' | 'monthly';
  triggered: boolean;
  createdAt: Date;
}

class CostTrackingService {
  private costAlertThreshold: number;
  private trackingEnabled: boolean;

  constructor() {
    this.costAlertThreshold = parseFloat(process.env.COST_ALERT_THRESHOLD || '100.00');
    this.trackingEnabled = process.env.COST_TRACKING_ENABLED === 'true';
  }

  /**
   * Record cost for GPU instance usage
   */
  async recordCost(params: {
    userId: string;
    instanceId: string;
    provider: GpuProvider;
    costPerHour: number;
    startTime: Date;
    endTime: Date;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<CostEntry> {
    if (!this.trackingEnabled) {
      logger.warn('Cost tracking is disabled');
      return null;
    }

    const duration = Math.ceil((params.endTime.getTime() - params.startTime.getTime()) / (1000 * 60)); // minutes
    const totalCost = (params.costPerHour / 60) * duration; // cost per minute * duration

    try {
      const costEntry = await prisma.costEntry.create({
        data: {
          userId: params.userId,
          instanceId: params.instanceId,
          provider: params.provider,
          costPerHour: params.costPerHour,
          duration,
          totalCost,
          startTime: params.startTime,
          endTime: params.endTime,
          description: params.description,
          metadata: params.metadata || {},
        },
      });

      logger.info(`Cost recorded: $${totalCost.toFixed(4)} for instance ${params.instanceId}`);

      // Check for cost alerts
      await this.checkCostAlerts(params.userId);

      return costEntry as CostEntry;
    } catch (error) {
      logger.error('Failed to record cost:', error);
      throw error;
    }
  }

  /**
   * Get cost summary for a user
   */
  async getCostSummary(userId: string, startDate?: Date, endDate?: Date): Promise<CostSummary> {
    const where: any = { userId };
    
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = startDate;
      if (endDate) where.startTime.lte = endDate;
    }

    try {
      const costEntries = await prisma.costEntry.findMany({
        where,
        include: {
          instance: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { startTime: 'desc' },
      });

      const totalCost = costEntries.reduce((sum, entry) => sum + entry.totalCost, 0);

      // Group by provider
      const costByProvider = costEntries.reduce((acc, entry) => {
        acc[entry.provider] = (acc[entry.provider] || 0) + entry.totalCost;
        return acc;
      }, {} as Record<GpuProvider, number>);

      // Group by day
      const costByDay = costEntries.reduce((acc, entry) => {
        const date = entry.startTime.toISOString().split('T')[0];
        const existing = acc.find(item => item.date === date);
        if (existing) {
          existing.cost += entry.totalCost;
        } else {
          acc.push({ date, cost: entry.totalCost });
        }
        return acc;
      }, [] as Array<{ date: string; cost: number }>);

      // Group by instance
      const costByInstance = costEntries.reduce((acc, entry) => {
        const existing = acc.find(item => item.instanceId === entry.instanceId);
        if (existing) {
          existing.cost += entry.totalCost;
          existing.duration += entry.duration;
        } else {
          acc.push({
            instanceId: entry.instanceId,
            instanceName: entry.instance?.name || 'Unknown',
            cost: entry.totalCost,
            duration: entry.duration,
          });
        }
        return acc;
      }, [] as Array<{ instanceId: string; instanceName: string; cost: number; duration: number }>);

      return {
        totalCost,
        costByProvider,
        costByDay: costByDay.sort((a, b) => a.date.localeCompare(b.date)),
        costByInstance: costByInstance.sort((a, b) => b.cost - a.cost),
      };
    } catch (error) {
      logger.error('Failed to get cost summary:', error);
      throw error;
    }
  }

  /**
   * Estimate cost for a GPU instance
   */
  estimateCost(params: {
    costPerHour: number;
    durationHours: number;
  }): number {
    return params.costPerHour * params.durationHours;
  }

  /**
   * Get current running costs for a user
   */
  async getCurrentRunningCosts(userId: string): Promise<{
    totalHourlyCost: number;
    runningInstances: Array<{
      instanceId: string;
      instanceName: string;
      costPerHour: number;
      runningTime: number; // in minutes
      estimatedCost: number;
    }>;
  }> {
    try {
      const runningInstances = await prisma.gpuInstance.findMany({
        where: {
          userId,
          status: 'RUNNING',
        },
        select: {
          id: true,
          name: true,
          costPerHour: true,
          createdAt: true,
        },
      });

      const totalHourlyCost = runningInstances.reduce((sum, instance) => sum + instance.costPerHour, 0);

      const instancesWithCosts = runningInstances.map(instance => {
        const runningTime = Math.ceil((Date.now() - instance.createdAt.getTime()) / (1000 * 60)); // minutes
        const estimatedCost = (instance.costPerHour / 60) * runningTime;
        
        return {
          instanceId: instance.id,
          instanceName: instance.name,
          costPerHour: instance.costPerHour,
          runningTime,
          estimatedCost,
        };
      });

      return {
        totalHourlyCost,
        runningInstances: instancesWithCosts,
      };
    } catch (error) {
      logger.error('Failed to get current running costs:', error);
      throw error;
    }
  }

  /**
   * Check for cost alerts
   */
  private async checkCostAlerts(userId: string): Promise<void> {
    try {
      // Get daily costs
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const dailyCostSummary = await this.getCostSummary(userId, today, tomorrow);

      if (dailyCostSummary.totalCost >= this.costAlertThreshold) {
        // Check if alert already exists for today
        const existingAlert = await prisma.costAlert.findFirst({
          where: {
            userId,
            period: 'daily',
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
          },
        });

        if (!existingAlert) {
          await prisma.costAlert.create({
            data: {
              userId,
              threshold: this.costAlertThreshold,
              currentCost: dailyCostSummary.totalCost,
              period: 'daily',
              triggered: true,
            },
          });

          logger.warn(`Cost alert triggered for user ${userId}: $${dailyCostSummary.totalCost.toFixed(2)} >= $${this.costAlertThreshold}`);
        }
      }
    } catch (error) {
      logger.error('Failed to check cost alerts:', error);
    }
  }

  /**
   * Get cost alerts for a user
   */
  async getCostAlerts(userId: string, limit = 10): Promise<CostAlert[]> {
    try {
      const alerts = await prisma.costAlert.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return alerts as CostAlert[];
    } catch (error) {
      logger.error('Failed to get cost alerts:', error);
      throw error;
    }
  }

  /**
   * Set cost alert threshold for a user
   */
  async setCostAlertThreshold(userId: string, threshold: number): Promise<void> {
    try {
      await prisma.userSettings.upsert({
        where: { userId },
        update: {
          costAlertThreshold: threshold,
        },
        create: {
          userId,
          costAlertThreshold: threshold,
        },
      });

      logger.info(`Cost alert threshold set to $${threshold} for user ${userId}`);
    } catch (error) {
      logger.error('Failed to set cost alert threshold:', error);
      throw error;
    }
  }
}

export const costTrackingService = new CostTrackingService();