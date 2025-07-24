import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import mediaRoutes from './media';
import jobRoutes from './jobs';
import gpuRoutes from './gpu';
import personRoutes from './persons';
import webhookRoutes from './webhooks';
import mlRoutes from './ml';
import testMlRoutes from './test-ml';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Health check endpoint
router.get('/health', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    const dbStatus = 'healthy';
    const dbResponseTime = Date.now() - startTime;

    // Check Redis connection
    const redisStartTime = Date.now();
    await redis.ping();
    const redisStatus = 'healthy';
    const redisResponseTime = Date.now() - redisStartTime;

    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
      services: {
        database: {
          status: dbStatus,
          responseTime: `${dbResponseTime}ms`,
        },
        redis: {
          status: redisStatus,
          responseTime: `${redisResponseTime}ms`,
        },
      },
      system: {
        memory: {
          used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
        },
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    });
  } catch (error) {
    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

// API info endpoint
router.get('/info', (req, res) => {
  res.json({
    name: 'AIMAS API',
    version: '1.0.0',
    description: 'AI Media Analysis System API',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      media: '/api/media',
      jobs: '/api/jobs',
      gpu: '/api/gpu',
      persons: '/api/persons',
      webhooks: '/api/webhooks',
      ml: '/api/ml',
    },
    features: [
      'User Authentication & Authorization',
      'Media File Management',
      'AI Job Processing',
      'GPU Instance Management',
      'Person Recognition & Tracking',
      'Webhook Integration',
      'Face Detection & Recognition',
      'Audio Transcription',
      'ML Pipeline Processing',
      'Real-time Processing',
      'Multi-provider GPU Support',
    ],
  });
});

// Protected route to get current user info
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
  }

  // Get user statistics
  const [mediaCount, jobCount, personCount, gpuCount] = await Promise.all([
    prisma.mediaFile.count({ where: { userId: user.id } }),
    prisma.job.count({ where: { userId: user.id } }),
    prisma.personDossier.count({ where: { userId: user.id } }),
    prisma.gpuInstance.count({ where: { userId: user.id } }),
  ]);

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        preferences: user.preferences,
      },
      statistics: {
        mediaFiles: mediaCount,
        jobs: jobCount,
        personDossiers: personCount,
        gpuInstances: gpuCount,
      },
    },
  });
}));

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/media', mediaRoutes);
router.use('/jobs', jobRoutes);
router.use('/gpu', gpuRoutes);
router.use('/persons', personRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/ml', mlRoutes);
router.use('/test-ml', testMlRoutes);

export default router;