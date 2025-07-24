import { Router } from 'express';
import {
  getJobs,
  getJobById,
  createJob,
  updateJobStatus,
  cancelJob,
  deleteJob,
  getJobResults,
  getJobStats,
} from '../controllers/jobController';
import { authenticate, selfOrAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import { JobType, JobStatus } from '@prisma/client';

const router = Router();

// Validation schemas
const getJobsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    type: z.nativeEnum(JobType).optional(),
    status: z.nativeEnum(JobStatus).optional(),
    userId: z.string().uuid().optional(),
  }),
});

const createJobSchema = z.object({
  body: z.object({
    type: z.nativeEnum(JobType),
    mediaFileIds: z.array(z.string().uuid()).min(1, 'At least one media file is required'),
    configuration: z.record(z.any()).optional(),
    priority: z.number().int().min(1).max(10).optional(),
    scheduledFor: z.string().datetime().optional(),
  }),
});

const updateJobStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(JobStatus),
    progress: z.number().min(0).max(100).optional(),
    error: z.string().optional(),
    results: z.record(z.any()).optional(),
  }),
});

const jobIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid job ID'),
  }),
});

const getJobResultsSchema = z.object({
  query: z.object({
    format: z.enum(['json', 'csv', 'xml']).optional(),
    download: z.enum(['true', 'false']).optional(),
  }),
});

// Routes
router.get('/', authenticate, validate(getJobsSchema), getJobs);
router.get('/stats', authenticate, getJobStats);
router.get('/:id', authenticate, validate(jobIdSchema), getJobById);
router.get('/:id/results', authenticate, validate(jobIdSchema.merge(getJobResultsSchema)), getJobResults);

router.post('/', authenticate, validate(createJobSchema), createJob);

router.put('/:id/status', 
  authenticate, 
  selfOrAdmin, 
  validate(jobIdSchema.merge(updateJobStatusSchema)), 
  updateJobStatus
);

router.put('/:id/cancel', 
  authenticate, 
  selfOrAdmin, 
  validate(jobIdSchema), 
  cancelJob
);

router.delete('/:id', 
  authenticate, 
  selfOrAdmin, 
  validate(jobIdSchema), 
  deleteJob
);

export default router;