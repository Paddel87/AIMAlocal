import { Router } from 'express';
import {
  getGpuInstances,
  getGpuInstanceById,
  createGpuInstance,
  updateGpuInstanceStatus,
  terminateGpuInstance,
  getGpuInstanceMetrics,
  getGpuStats,
  submitBatchJob,
  getBatchJobStatus,
  cancelBatchJob,
  getBatchStats,
  getGpuOffers,
} from '../controllers/gpuController';
import { authenticate, selfOrAdmin, proAndAbove } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import { GpuProvider, GpuStatus } from '@prisma/client';

const router = Router();

// Validation schemas
const getGpuInstancesSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    provider: z.nativeEnum(GpuProvider).optional(),
    status: z.nativeEnum(GpuStatus).optional(),
    userId: z.string().uuid().optional(),
  }),
});

const createGpuInstanceSchema = z.object({
  body: z.object({
    provider: z.nativeEnum(GpuProvider),
    instanceType: z.string().min(1, 'Instance type is required'),
    region: z.string().min(1, 'Region is required'),
    configuration: z.object({
      gpuType: z.string().min(1, 'GPU type is required'),
      gpuCount: z.number().int().min(1, 'At least 1 GPU is required'),
      memory: z.number().int().min(1, 'Memory is required'),
      storage: z.number().int().min(1, 'Storage is required'),
      vcpus: z.number().int().min(1, 'vCPUs is required'),
    }),
    maxHours: z.number().int().min(1).max(168).optional(), // Max 1 week
    autoTerminate: z.boolean().optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

const updateGpuInstanceSchema = z.object({
  body: z.object({
    maxHours: z.number().int().min(1).max(168).optional(),
    autoTerminate: z.boolean().optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

const gpuInstanceIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid GPU instance ID'),
  }),
});

const getGpuMetricsSchema = z.object({
  query: z.object({
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    interval: z.enum(['1m', '5m', '15m', '1h', '1d']).optional(),
  }),
});

const submitBatchJobSchema = z.object({
  body: z.object({
    jobs: z.array(z.object({
      type: z.string().min(1, 'Job type is required'),
      data: z.record(z.any()),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      estimatedDuration: z.number().int().min(1).optional(),
    })).min(1, 'At least one job is required'),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    estimatedDuration: z.number().int().min(1).optional(),
  }),
});

const batchJobIdSchema = z.object({
  params: z.object({
    jobId: z.string().min(1, 'Job ID is required'),
  }),
});

const getGpuOffersSchema = z.object({
  query: z.object({
    provider: z.nativeEnum(GpuProvider).optional(),
    gpuType: z.string().optional(),
    maxPrice: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  }),
});

// Routes - Require PRO plan or above for GPU access
router.get('/', authenticate, proAndAbove, validate(getGpuInstancesSchema), getGpuInstances);
router.get('/stats', authenticate, proAndAbove, getGpuStats);
router.get('/offers', authenticate, proAndAbove, validate(getGpuOffersSchema), getGpuOffers);
router.get('/:id', authenticate, proAndAbove, validate(gpuInstanceIdSchema), getGpuInstanceById);
router.get('/:id/metrics', 
  authenticate, 
  proAndAbove, 
  validate(gpuInstanceIdSchema.merge(getGpuMetricsSchema)), 
  getGpuInstanceMetrics
);

router.post('/', authenticate, proAndAbove, validate(createGpuInstanceSchema), createGpuInstance);

router.put('/:id', 
  authenticate, 
  proAndAbove, 
  selfOrAdmin, 
  validate(gpuInstanceIdSchema.merge(updateGpuInstanceSchema)), 
  updateGpuInstanceStatus
);

router.delete('/:id', 
  authenticate, 
  proAndAbove, 
  selfOrAdmin, 
  validate(gpuInstanceIdSchema), 
  terminateGpuInstance
);

// Batch Processing Routes
router.post('/batch', authenticate, proAndAbove, validate(submitBatchJobSchema), submitBatchJob);
router.get('/batch/stats', authenticate, proAndAbove, getBatchStats);
router.get('/batch/:jobId', authenticate, proAndAbove, validate(batchJobIdSchema), getBatchJobStatus);
router.delete('/batch/:jobId', authenticate, proAndAbove, validate(batchJobIdSchema), cancelBatchJob);

export default router;