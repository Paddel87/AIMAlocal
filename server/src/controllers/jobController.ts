import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { 
  NotFoundError, 
  AuthorizationError, 
  ValidationError,
  asyncHandler 
} from '../middleware/errorHandler';
import { JobStatus, JobType, UserRole } from '@prisma/client';

// Get all jobs (with pagination and filtering)
export const getJobs = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 10, status, type, userId } = req.query;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  // Build where clause
  const where: any = {};
  
  // Non-admin users can only see their own jobs
  if (currentUser.role !== UserRole.ADMIN) {
    where.userId = currentUser.id;
  } else if (userId) {
    where.userId = userId as string;
  }

  if (status) {
    where.status = status as JobStatus;
  }

  if (type) {
    where.type = type as JobType;
  }

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
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
        mediaFiles: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            mimeType: true,
            size: true,
          },
        },
        results: {
          select: {
            id: true,
            type: true,
            confidence: true,
            metadata: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            results: true,
          },
        },
      },
    }),
    prisma.job.count({ where }),
  ]);

  const totalPages = Math.ceil(total / take);

  res.json({
    success: true,
    data: {
      jobs,
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

// Get job by ID
export const getJobById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const job = await prisma.job.findUnique({
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
      mediaFiles: {
        select: {
          id: true,
          filename: true,
          originalName: true,
          mimeType: true,
          size: true,
          url: true,
          thumbnailUrl: true,
        },
      },
      results: {
        orderBy: { createdAt: 'desc' },
      },
      gpuInstance: {
        select: {
          id: true,
          provider: true,
          instanceType: true,
          status: true,
        },
      },
    },
  });

  if (!job) {
    throw new NotFoundError('Job not found');
  }

  // Check if user can access this job
  if (currentUser.role !== UserRole.ADMIN && job.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  res.json({
    success: true,
    data: { job },
  });
});

// Create new job
export const createJob = asyncHandler(async (req: Request, res: Response) => {
  const { type, configuration, mediaFileIds, priority = 1 } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  // Validate media files belong to user
  if (mediaFileIds && mediaFileIds.length > 0) {
    const mediaFiles = await prisma.mediaFile.findMany({
      where: {
        id: { in: mediaFileIds },
        userId: currentUser.id,
      },
    });

    if (mediaFiles.length !== mediaFileIds.length) {
      throw new ValidationError('Some media files not found or access denied');
    }
  }

  // Create job
  const job = await prisma.job.create({
    data: {
      type,
      status: JobStatus.PENDING,
      configuration,
      priority,
      userId: currentUser.id,
      mediaFiles: mediaFileIds ? {
        connect: mediaFileIds.map((id: string) => ({ id })),
      } : undefined,
    },
    include: {
      mediaFiles: {
        select: {
          id: true,
          filename: true,
          originalName: true,
          mimeType: true,
        },
      },
    },
  });

  // Add job to queue (Redis)
  await redis.lpush('job_queue', JSON.stringify({
    jobId: job.id,
    type: job.type,
    priority: job.priority,
    userId: job.userId,
    createdAt: job.createdAt,
  }));

  (logger as any).logJob(job.id, 'created', job.type, currentUser.id);

  res.status(201).json({
    success: true,
    message: 'Job created successfully',
    data: { job },
  });
});

// Update job status
export const updateJobStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, progress, errorMessage } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const job = await prisma.job.findUnique({
    where: { id },
  });

  if (!job) {
    throw new NotFoundError('Job not found');
  }

  // Only admin or job owner can update status
  if (currentUser.role !== UserRole.ADMIN && job.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  const updatedJob = await prisma.job.update({
    where: { id },
    data: {
      status,
      progress,
      errorMessage,
      ...(status === JobStatus.COMPLETED && { completedAt: new Date() }),
      ...(status === JobStatus.FAILED && { failedAt: new Date() }),
      updatedAt: new Date(),
    },
  });

  // Invalidate cache
  await redis.del(`job:${id}`);
  await redis.del(`user_jobs:${job.userId}`);

  (logger as any).logJob(job.id, status, job.type, job.userId);

  res.json({
    success: true,
    message: 'Job status updated successfully',
    data: { job: updatedJob },
  });
});

// Cancel job
export const cancelJob = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const job = await prisma.job.findUnique({
    where: { id },
  });

  if (!job) {
    throw new NotFoundError('Job not found');
  }

  // Only admin or job owner can cancel
  if (currentUser.role !== UserRole.ADMIN && job.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  // Can only cancel pending or running jobs
  if (![JobStatus.PENDING, JobStatus.RUNNING].includes(job.status)) {
    throw new ValidationError('Job cannot be cancelled in current status');
  }

  const updatedJob = await prisma.job.update({
    where: { id },
    data: {
      status: JobStatus.CANCELLED,
      cancelledAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Remove from queue if pending
  if (job.status === JobStatus.PENDING) {
    // This would require more sophisticated queue management
    // For now, just log the cancellation
    (logger as any).logJob(job.id, 'cancelled', job.type, job.userId);
  }

  // Invalidate cache
  await redis.del(`job:${id}`);
  await redis.del(`user_jobs:${job.userId}`);

  res.json({
    success: true,
    message: 'Job cancelled successfully',
    data: { job: updatedJob },
  });
});

// Delete job
export const deleteJob = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      results: true,
    },
  });

  if (!job) {
    throw new NotFoundError('Job not found');
  }

  // Only admin or job owner can delete
  if (currentUser.role !== UserRole.ADMIN && job.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  // Cannot delete running jobs
  if (job.status === JobStatus.RUNNING) {
    throw new ValidationError('Cannot delete running job');
  }

  // Delete job and related data
  await prisma.job.delete({
    where: { id },
  });

  // Invalidate cache
  await redis.del(`job:${id}`);
  await redis.del(`user_jobs:${job.userId}`);

  (logger as any).logJob(job.id, 'deleted', job.type, job.userId);

  res.json({
    success: true,
    message: 'Job deleted successfully',
  });
});

// Get job results
export const getJobResults = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const job = await prisma.job.findUnique({
    where: { id },
  });

  if (!job) {
    throw new NotFoundError('Job not found');
  }

  // Check access
  if (currentUser.role !== UserRole.ADMIN && job.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const [results, total] = await Promise.all([
    prisma.jobResult.findMany({
      where: { jobId: id },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.jobResult.count({ where: { jobId: id } }),
  ]);

  const totalPages = Math.ceil(total / take);

  res.json({
    success: true,
    data: {
      results,
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

// Get job statistics
export const getJobStats = asyncHandler(async (req: Request, res: Response) => {
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const where = currentUser.role === UserRole.ADMIN ? {} : { userId: currentUser.id };

  const [statusStats, typeStats, recentJobs] = await Promise.all([
    prisma.job.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    }),
    prisma.job.groupBy({
      by: ['type'],
      where,
      _count: { type: true },
    }),
    prisma.job.findMany({
      where,
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      statusStats,
      typeStats,
      recentJobs,
    },
  });
});