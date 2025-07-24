import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { redisManager } from './config/redis';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { validateEnv } from './utils/validation';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import jobRoutes from './routes/jobs';
import mediaRoutes from './routes/media';
import gpuRoutes from './routes/gpu';
import personRoutes from './routes/persons';
import webhookRoutes from './routes/webhooks';

// Validate environment variables
validateEnv();
console.log('✓ Environment validation completed');

const app = express();
console.log('✓ Express app created');
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Initialize Prisma
console.log('⏳ Initializing Prisma client...');
export const db = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
console.log('✓ Prisma client initialized');

// Global rate limiting
console.log('⏳ Setting up rate limiting...');
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 1000 : 10000, // Limit each IP
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
console.log('✓ Rate limiting configured');

// Security middleware
console.log('⏳ Setting up security middleware...');
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));
console.log('✓ Security middleware configured');

// CORS configuration
console.log('⏳ Setting up CORS...');
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5175',
      'http://localhost:5176',
    ];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
console.log('✓ CORS configured');

// Basic middleware
console.log('⏳ Setting up basic middleware...');
app.use(compression());
console.log('✓ Compression middleware configured');
app.use(express.json({ limit: '50mb' }));
console.log('✓ JSON middleware configured');
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
console.log('✓ URL encoded middleware configured');
app.use(globalLimiter);
console.log('✓ Global limiter configured');
app.use(requestLogger);
console.log('✓ Request logger configured');

// Skip uploads directory setup for now to get server running
console.log('⏳ Setting up uploads directory...');
console.log('✓ Uploads directory setup skipped (will be configured later)');
console.log('✓ Static files skipped (will be configured later)');

// TODO: Re-enable uploads functionality after server is stable
// const uploadsDir = path.join(__dirname, '../uploads');
// app.use('/uploads', express.static(uploadsDir));

// Health check endpoint
console.log('⏳ Setting up health check endpoint...');
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await db.$queryRaw`SELECT 1`;
    
    // Check Redis connection (non-blocking)
    let redisHealth;
    try {
      redisHealth = await Promise.race([
        redisManager.healthCheck(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 2000))
      ]);
    } catch (error) {
      redisHealth = { status: 'unhealthy', error: 'Connection timeout or unavailable' };
    }
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: 'healthy',
        redis: redisHealth.status,
        memory: {
          used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
          total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
        },
      },
    };
    
    res.status(200).json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable',
    });
  }
});
console.log('✓ Health check endpoint configured');

// API routes
console.log('⏳ Setting up API routes...');
app.use('/api/auth', authRoutes);
console.log('✓ Auth routes configured');
app.use('/api/users', userRoutes);
console.log('✓ User routes configured');
app.use('/api/jobs', jobRoutes);
console.log('✓ Job routes configured');
app.use('/api/media', mediaRoutes);
console.log('✓ Media routes configured');
app.use('/api/gpu', gpuRoutes);
console.log('✓ GPU routes configured');
app.use('/api/persons', personRoutes);
console.log('✓ Person routes configured');
app.use('/api/webhooks', webhookRoutes);
console.log('✓ Webhook routes configured');

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'AIMA API',
    version: process.env.npm_package_version || '1.0.0',
    description: 'AI Media Analysis API',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      jobs: '/api/jobs',
      media: '/api/media',
      gpu: '/api/gpu',
      persons: '/api/persons',
      webhooks: '/api/webhooks',
    },
    documentation: 'https://docs.aima.local',
    support: 'support@aima.local',
  });
});

// Test endpoint without authentication
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API connection successful',
    timestamp: new Date().toISOString(),
    data: {
      mockJobs: [
        { id: 'job-1', status: 'completed', type: 'face_detection' },
        { id: 'job-2', status: 'processing', type: 'transcription' }
      ],
      mockGpuInstances: [
        { id: 'gpu-1', status: 'online', type: 'RTX 4090' },
        { id: 'gpu-2', status: 'busy', type: 'RTX 4090' }
      ],
      mockPersons: [
        { id: 'person-1', name: 'Test Person', recognitions: 5 }
      ]
    }
  });
});

// WebSocket handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  // Join user-specific room for notifications
  socket.on('join', (userId: string) => {
    socket.join(`user:${userId}`);
    logger.info(`User ${userId} joined their notification room`);
  });
  
  // Handle job progress updates
  socket.on('subscribe:job', (jobId: string) => {
    socket.join(`job:${jobId}`);
    logger.info(`Client subscribed to job updates: ${jobId}`);
  });
  
  // Handle GPU instance monitoring
  socket.on('subscribe:gpu', (instanceId: string) => {
    socket.join(`gpu:${instanceId}`);
    logger.info(`Client subscribed to GPU updates: ${instanceId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Export io for use in other modules
export { io };

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  try {
    await db.$disconnect();
    logger.info('Database connection closed');
    
    await redisManager.disconnect();
    logger.info('Redis connection closed');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  try {
    await db.$disconnect();
    logger.info('Database connection closed');
    
    await redisManager.disconnect();
    logger.info('Redis connection closed');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

// Start server
console.log('⏳ Starting server...');
server.listen(PORT, () => {
  console.log('✓ Server started successfully!');
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🔗 API URL: http://localhost:${PORT}/api`);
  logger.info(`💾 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  logger.info(`🔴 Redis: ${process.env.REDIS_URL ? 'Connected' : 'Not configured'}`);
});

export default app;