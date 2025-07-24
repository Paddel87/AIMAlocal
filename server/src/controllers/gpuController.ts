import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { 
  NotFoundError, 
  AuthorizationError, 
  ValidationError,
  ExternalServiceError,
  asyncHandler 
} from '../middleware/errorHandler';
import { UserRole, GpuProvider, GpuStatus } from '@prisma/client';

// Mock GPU provider APIs (in real implementation, these would be actual API calls)
const mockGpuProviders = {
  RUNPOD: {
    createInstance: async (config: any) => {
      return {
        instanceId: `runpod_${Date.now()}`,
        status: 'starting',
        ipAddress: '192.168.1.100',
        cost: 0.5,
      };
    },
    getInstanceStatus: async (instanceId: string) => {
      return {
        status: 'running',
        uptime: 3600,
        metrics: {
          cpuUsage: 45,
          memoryUsage: 60,
          gpuUsage: 80,
        },
      };
    },
    terminateInstance: async (instanceId: string) => {
      return { success: true };
    },
  },
  VAST_AI: {
    createInstance: async (config: any) => {
      return {
        instanceId: `vast_${Date.now()}`,
        status: 'starting',
        ipAddress: '192.168.1.101',
        cost: 0.3,
      };
    },
    getInstanceStatus: async (instanceId: string) => {
      return {
        status: 'running',
        uptime: 1800,
        metrics: {
          cpuUsage: 30,
          memoryUsage: 40,
          gpuUsage: 90,
        },
      };
    },
    terminateInstance: async (instanceId: string) => {
      return { success: true };
    },
  },
  LAMBDA_LABS: {
    createInstance: async (config: any) => {
      return {
        instanceId: `lambda_${Date.now()}`,
        status: 'starting',
        ipAddress: '192.168.1.102',
        cost: 0.8,
      };
    },
    getInstanceStatus: async (instanceId: string) => {
      return {
        status: 'running',
        uptime: 7200,
        metrics: {
          cpuUsage: 55,
          memoryUsage: 70,
          gpuUsage: 95,
        },
      };
    },
    terminateInstance: async (instanceId: string) => {
      return { success: true };
    },
  },
  PAPERSPACE: {
    createInstance: async (config: any) => {
      return {
        instanceId: `paperspace_${Date.now()}`,
        status: 'starting',
        ipAddress: '192.168.1.103',
        cost: 0.6,
      };
    },
    getInstanceStatus: async (instanceId: string) => {
      return {
        status: 'running',
        uptime: 5400,
        metrics: {
          cpuUsage: 40,
          memoryUsage: 55,
          gpuUsage: 85,
        },
      };
    },
    terminateInstance: async (instanceId: string) => {
      return { success: true };
    },
  },
};

// Get all GPU instances
export const getGpuInstances = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 10, provider, status, userId } = req.query;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  // Build where clause
  const where: any = {};
  
  // Non-admin users can only see their own instances
  if (currentUser.role !== UserRole.ADMIN) {
    where.userId = currentUser.id;
  } else if (userId) {
    where.userId = userId as string;
  }

  if (provider) {
    where.provider = provider as GpuProvider;
  }

  if (status) {
    where.status = status as GpuStatus;
  }

  const [instances, total] = await Promise.all([
    prisma.gpuInstance.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        jobs: {
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            jobs: true,
          },
        },
      },
    }),
    prisma.gpuInstance.count({ where }),
  ]);

  const totalPages = Math.ceil(total / take);

  res.json({
    success: true,
    data: {
      instances,
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    },
  });
});

// Get GPU instance by ID
export const getGpuInstanceById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const instance = await prisma.gpuInstance.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      jobs: {
        select: {
          id: true,
          type: true,
          status: true,
          createdAt: true,
          completedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      metrics: {
        orderBy: { timestamp: 'desc' },
        take: 100, // Last 100 metrics
      },
    },
  });

  if (!instance) {
    throw new NotFoundError('GPU instance not found');
  }

  // Check if user can access this instance
  if (currentUser.role !== UserRole.ADMIN && instance.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  res.json({
    success: true,
    data: { instance },
  });
});

// Create new GPU instance
export const createGpuInstance = asyncHandler(async (req: Request, res: Response) => {
  const { provider, instanceType, configuration } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  // Check user limits based on role
  const userInstanceCount = await prisma.gpuInstance.count({
    where: {
      userId: currentUser.id,
      status: { in: [GpuStatus.STARTING, GpuStatus.RUNNING] },
    },
  });

  const maxInstances = {
    [UserRole.FREE]: 1,
    [UserRole.PRO]: 3,
    [UserRole.ENTERPRISE]: 10,
    [UserRole.ADMIN]: 50,
  };

  if (userInstanceCount >= maxInstances[currentUser.role]) {
    throw new ValidationError(`Maximum instances limit reached for ${currentUser.role} plan`);
  }

  try {
    // Create instance with provider
    const providerApi = mockGpuProviders[provider as keyof typeof mockGpuProviders];
    if (!providerApi) {
      throw new ValidationError('Unsupported GPU provider');
    }

    const providerResponse = await providerApi.createInstance({
      instanceType,
      configuration,
    });

    // Create instance record
    const instance = await prisma.gpuInstance.create({
      data: {
        provider,
        instanceType,
        status: GpuStatus.STARTING,
        externalId: providerResponse.instanceId,
        ipAddress: providerResponse.ipAddress,
        configuration,
        costPerHour: providerResponse.cost,
        userId: currentUser.id,
      },
    });

    // Cache instance data
    await redis.setex(`gpu_instance:${instance.id}`, 3600, JSON.stringify(instance));

    (logger as any).logSystem('gpu_instance_created', {
      instanceId: instance.id,
      provider,
      userId: currentUser.id,
    });

    res.status(201).json({
      success: true,
      message: 'GPU instance created successfully',
      data: { instance },
    });
  } catch (error) {
    logger.error('Failed to create GPU instance', { error, provider, userId: currentUser.id });
    throw new ExternalServiceError('Failed to create GPU instance');
  }
});

// Update GPU instance status
export const updateGpuInstanceStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const instance = await prisma.gpuInstance.findUnique({
    where: { id },
  });

  if (!instance) {
    throw new NotFoundError('GPU instance not found');
  }

  // Only admin or instance owner can update status
  if (currentUser.role !== UserRole.ADMIN && instance.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  const updatedInstance = await prisma.gpuInstance.update({
    where: { id },
    data: {
      status,
      ...(status === GpuStatus.RUNNING && { startedAt: new Date() }),
      ...(status === GpuStatus.TERMINATED && { terminatedAt: new Date() }),
      updatedAt: new Date(),
    },
  });

  // Invalidate cache
  await redis.del(`gpu_instance:${id}`);

  (logger as any).logSystem('gpu_instance_status_updated', {
    instanceId: id,
    status,
    userId: instance.userId,
  });

  res.json({
    success: true,
    message: 'GPU instance status updated successfully',
    data: { instance: updatedInstance },
  });
});

// Terminate GPU instance
export const terminateGpuInstance = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const instance = await prisma.gpuInstance.findUnique({
    where: { id },
    include: {
      jobs: {
        where: {
          status: { in: ['PENDING', 'RUNNING'] },
        },
      },
    },
  });

  if (!instance) {
    throw new NotFoundError('GPU instance not found');
  }

  // Only admin or instance owner can terminate
  if (currentUser.role !== UserRole.ADMIN && instance.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  // Check if instance has running jobs
  if (instance.jobs.length > 0) {
    throw new ValidationError('Cannot terminate instance with running jobs');
  }

  try {
    // Terminate with provider
    const providerApi = mockGpuProviders[instance.provider as keyof typeof mockGpuProviders];
    if (providerApi && instance.externalId) {
      await providerApi.terminateInstance(instance.externalId);
    }

    // Update instance status
    const updatedInstance = await prisma.gpuInstance.update({
      where: { id },
      data: {
        status: GpuStatus.TERMINATED,
        terminatedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Invalidate cache
    await redis.del(`gpu_instance:${id}`);

    (logger as any).logSystem('gpu_instance_terminated', {
      instanceId: id,
      userId: instance.userId,
    });

    res.json({
      success: true,
      message: 'GPU instance terminated successfully',
      data: { instance: updatedInstance },
    });
  } catch (error) {
    logger.error('Failed to terminate GPU instance', { error, instanceId: id });
    throw new ExternalServiceError('Failed to terminate GPU instance');
  }
});

// Get GPU instance metrics
export const getGpuInstanceMetrics = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { hours = 24 } = req.query;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const instance = await prisma.gpuInstance.findUnique({
    where: { id },
  });

  if (!instance) {
    throw new NotFoundError('GPU instance not found');
  }

  // Check access
  if (currentUser.role !== UserRole.ADMIN && instance.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  const hoursAgo = new Date(Date.now() - Number(hours) * 60 * 60 * 1000);

  const metrics = await prisma.gpuMetrics.findMany({
    where: {
      gpuInstanceId: id,
      timestamp: {
        gte: hoursAgo,
      },
    },
    orderBy: { timestamp: 'asc' },
  });

  // Get current status from provider if instance is running
  let currentMetrics = null;
  if (instance.status === GpuStatus.RUNNING && instance.externalId) {
    try {
      const providerApi = mockGpuProviders[instance.provider as keyof typeof mockGpuProviders];
      if (providerApi) {
        const status = await providerApi.getInstanceStatus(instance.externalId);
        currentMetrics = status.metrics;
      }
    } catch (error) {
      logger.warn('Failed to get current metrics from provider', { error, instanceId: id });
    }
  }

  res.json({
    success: true,
    data: {
      metrics,
      currentMetrics,
      timeRange: {
        from: hoursAgo,
        to: new Date(),
        hours: Number(hours),
      },
    },
  });
});

// Get GPU instance statistics
export const getGpuStats = asyncHandler(async (req: Request, res: Response) => {
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const where = currentUser.role === UserRole.ADMIN ? {} : { userId: currentUser.id };

  const [statusStats, providerStats, totalCost, activeInstances] = await Promise.all([
    prisma.gpuInstance.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    }),
    prisma.gpuInstance.groupBy({
      by: ['provider'],
      where,
      _count: { provider: true },
    }),
    prisma.gpuInstance.aggregate({
      where: {
        ...where,
        status: { in: [GpuStatus.RUNNING, GpuStatus.TERMINATED] },
      },
      _sum: { totalCost: true },
    }),
    prisma.gpuInstance.findMany({
      where: {
        ...where,
        status: GpuStatus.RUNNING,
      },
      select: {
        id: true,
        provider: true,
        instanceType: true,
        startedAt: true,
        costPerHour: true,
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      statusStats,
      providerStats,
      totalCost: totalCost._sum.totalCost || 0,
      activeInstances,
    },
  });
});

// Get available GPU providers and instance types
export const getGpuProviders = asyncHandler(async (req: Request, res: Response) => {
  const providers = [
    {
      name: 'RunPod',
      value: 'RUNPOD',
      instanceTypes: [
        { name: 'RTX 3080', value: 'rtx3080', costPerHour: 0.5, memory: '10GB' },
        { name: 'RTX 4090', value: 'rtx4090', costPerHour: 0.8, memory: '24GB' },
        { name: 'A100', value: 'a100', costPerHour: 1.2, memory: '40GB' },
      ],
    },
    {
      name: 'Vast.ai',
      value: 'VAST_AI',
      instanceTypes: [
        { name: 'RTX 3070', value: 'rtx3070', costPerHour: 0.3, memory: '8GB' },
        { name: 'RTX 3080', value: 'rtx3080', costPerHour: 0.4, memory: '10GB' },
        { name: 'RTX 4080', value: 'rtx4080', costPerHour: 0.6, memory: '16GB' },
      ],
    },
    {
      name: 'Lambda Labs',
      value: 'LAMBDA_LABS',
      instanceTypes: [
        { name: 'RTX 4090', value: 'rtx4090', costPerHour: 0.8, memory: '24GB' },
        { name: 'A100', value: 'a100', costPerHour: 1.0, memory: '40GB' },
        { name: 'H100', value: 'h100', costPerHour: 2.0, memory: '80GB' },
      ],
    },
    {
      name: 'Paperspace',
      value: 'PAPERSPACE',
      instanceTypes: [
        { name: 'RTX 4000', value: 'rtx4000', costPerHour: 0.6, memory: '8GB' },
        { name: 'RTX 5000', value: 'rtx5000', costPerHour: 0.8, memory: '16GB' },
        { name: 'A4000', value: 'a4000', costPerHour: 1.0, memory: '16GB' },
      ],
    },
  ];

  res.json({
    success: true,
    data: { providers },
  });
});