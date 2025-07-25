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
import { GpuProviderManager, CreateGpuInstanceRequest } from '../services/gpuProviderManager';
import { BatchProcessingService } from '../services/batchProcessingService';

// Initialize GPU Provider Manager
const gpuManager = new GpuProviderManager({
  runpod: process.env.RUNPOD_API_KEY ? {
    apiKey: process.env.RUNPOD_API_KEY,
  } : undefined,
  vastai: process.env.VASTAI_API_KEY ? {
    apiKey: process.env.VASTAI_API_KEY,
  } : undefined,
});

// Initialize Batch Processing Service
const batchService = new BatchProcessingService(gpuManager);

// Get all GPU instances
export const getGpuInstances = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 10, provider, status, userId } = req.query;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  try {
    // Get instances from GPU providers
    let providerInstances = [];
    if (provider) {
      providerInstances = await gpuManager.getInstancesByProvider(provider as GpuProvider);
    } else {
      providerInstances = await gpuManager.getAllInstances();
    }

    // Get database instances for additional metadata
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

    const [dbInstances, total] = await Promise.all([
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

    // Merge provider data with database data
    const mergedInstances = dbInstances.map(dbInstance => {
      const providerInstance = providerInstances.find(pi => pi.id === dbInstance.externalId);
      return {
        ...dbInstance,
        providerData: providerInstance,
        realTimeStatus: providerInstance?.status || dbInstance.status,
        metrics: providerInstance?.metrics,
      };
    });

    const totalPages = Math.ceil(total / take);

    res.json({
      success: true,
      data: {
        instances: mergedInstances,
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
  } catch (error) {
    logger.error('Failed to get GPU instances:', error);
    throw new ExternalServiceError('Failed to retrieve GPU instances from providers');
  }
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

  try {
    // Get real-time data from provider
    let providerData = null;
    if (instance.externalId) {
      providerData = await gpuManager.getInstance(instance.provider as GpuProvider, instance.externalId);
    }

    res.json({
      success: true,
      data: {
        instance: {
          ...instance,
          providerData,
          realTimeStatus: providerData?.status || instance.status,
          metrics: providerData?.metrics,
        },
      },
    });
  } catch (error) {
    logger.warn('Failed to get provider data for instance:', error);
    // Return database data if provider call fails
    res.json({
      success: true,
      data: { instance },
    });
  }
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
    // Create instance using GPU provider manager
    const createRequest: CreateGpuInstanceRequest = {
      instanceType,
      configuration,
    };

    const providerInstance = await gpuManager.createInstance(provider as GpuProvider, createRequest);

    // Create instance record
    const instance = await prisma.gpuInstance.create({
      data: {
        provider,
        instanceType,
        status: GpuStatus.STARTING,
        externalId: providerInstance.id,
        ipAddress: providerInstance.ipAddress,
        configuration,
        costPerHour: providerInstance.costPerHour || 0,
        userId: currentUser.id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
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
      data: {
        instance,
        providerData: providerInstance,
      },
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
    if (instance.externalId) {
      await gpuManager.terminateInstance(instance.provider as GpuProvider, instance.externalId);
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
      const providerInstance = await gpuManager.getInstance(instance.provider as GpuProvider, instance.externalId);
      currentMetrics = providerInstance?.metrics;
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

// Batch Processing Endpoints

// Submit batch job
export const submitBatchJob = asyncHandler(async (req: Request, res: Response) => {
  const { jobs, priority = 'medium', estimatedDuration } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  try {
    const batchJob = await batchService.submitBatchJob({
      jobs,
      userId: currentUser.id,
      priority,
      estimatedDuration,
    });

    logger.info(`Batch job submitted: ${batchJob.id} for user ${currentUser.id}`);

    res.status(201).json({
      success: true,
      data: batchJob,
    });
  } catch (error) {
    logger.error('Failed to submit batch job:', error);
    throw new ExternalServiceError(`Failed to submit batch job: ${error.message}`);
  }
});

// Get batch job status
export const getBatchJobStatus = asyncHandler(async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  try {
    const status = await batchService.getBatchJobStatus(jobId);
    
    // Check access permissions
    if (currentUser.role !== UserRole.ADMIN && status.userId !== currentUser.id) {
      throw new AuthorizationError('Access denied to this batch job');
    }

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Failed to get batch job status:', error);
    throw new ExternalServiceError(`Failed to get batch job status: ${error.message}`);
  }
});

// Cancel batch job
export const cancelBatchJob = asyncHandler(async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  try {
    // First check if user has access to this job
    const status = await batchService.getBatchJobStatus(jobId);
    if (currentUser.role !== UserRole.ADMIN && status.userId !== currentUser.id) {
      throw new AuthorizationError('Access denied to this batch job');
    }

    await batchService.cancelBatchJob(jobId);

    logger.info(`Batch job cancelled: ${jobId} by user ${currentUser.id}`);

    res.json({
      success: true,
      message: 'Batch job cancelled successfully',
    });
  } catch (error) {
    logger.error('Failed to cancel batch job:', error);
    throw new ExternalServiceError(`Failed to cancel batch job: ${error.message}`);
  }
});

// Get batch processing statistics
export const getBatchStats = asyncHandler(async (req: Request, res: Response) => {
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  try {
    const stats = await batchService.getBatchStats(currentUser.id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get batch stats:', error);
    throw new ExternalServiceError(`Failed to get batch statistics: ${error.message}`);
  }
});

// Get available GPU offers
export const getGpuOffers = asyncHandler(async (req: Request, res: Response) => {
  const { provider, gpuType, maxPrice } = req.query;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  try {
    let offers = [];
    
    if (provider) {
      offers = await gpuManager.getAvailableOffers(provider as GpuProvider, {
        gpuType: gpuType as string,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
      });
    } else {
      // Get offers from all providers
      const runpodOffers = await gpuManager.getAvailableOffers(GpuProvider.RUNPOD, {
        gpuType: gpuType as string,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
      });
      const vastaiOffers = await gpuManager.getAvailableOffers(GpuProvider.VASTAI, {
        gpuType: gpuType as string,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
      });
      offers = [...runpodOffers, ...vastaiOffers];
    }

    res.json({
      success: true,
      data: offers,
    });
  } catch (error) {
    logger.error('Failed to get GPU offers:', error);
    throw new ExternalServiceError(`Failed to get GPU offers: ${error.message}`);
  }
});