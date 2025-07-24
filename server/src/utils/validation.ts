import { z } from 'zod';
import { logger } from './logger';

// Environment variables schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).default('0'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Session
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_DURATION: z.string().transform(Number).default('86400'),
  
  // Frontend
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  
  // File Upload
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.string().transform(Number).default('524288000'), // 500MB
  MAX_FILES_PER_USER: z.string().transform(Number).default('1000'),
  
  // ML Models
  FACE_RECOGNITION_THRESHOLD: z.string().transform(Number).default('0.8'),
  VOICE_RECOGNITION_THRESHOLD: z.string().transform(Number).default('0.7'),
  OBJECT_DETECTION_THRESHOLD: z.string().transform(Number).default('0.5'),
  
  // Rate Limiting
  API_RATE_LIMIT_WINDOW: z.string().transform(Number).default('900000'), // 15 minutes
  API_RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  API_RATE_LIMIT_AUTH_MAX: z.string().transform(Number).default('5'),
  API_RATE_LIMIT_UPLOAD_MAX: z.string().transform(Number).default('10'),
  
  // Webhooks
  WEBHOOK_SECRET: z.string().min(16, 'WEBHOOK_SECRET must be at least 16 characters').optional(),
  WEBHOOK_TIMEOUT: z.string().transform(Number).default('30000'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('./logs/app.log'),
  ENABLE_REQUEST_LOGGING: z.string().transform(val => val === 'true').default('true'),
  
  // Job Queue
  JOB_QUEUE_CONCURRENCY: z.string().transform(Number).default('5'),
  JOB_TIMEOUT: z.string().transform(Number).default('3600000'), // 1 hour
  JOB_RETRY_ATTEMPTS: z.string().transform(Number).default('3'),
  JOB_RETRY_DELAY: z.string().transform(Number).default('5000'),
  
  // Cache
  CACHE_TTL: z.string().transform(Number).default('3600'),
  CACHE_MAX_SIZE: z.string().transform(Number).default('1000'),
  
  // Security
  BCRYPT_ROUNDS: z.string().transform(Number).default('12'),
  PASSWORD_MIN_LENGTH: z.string().transform(Number).default('8'),
  PASSWORD_REQUIRE_UPPERCASE: z.string().transform(val => val === 'true').default('true'),
  PASSWORD_REQUIRE_LOWERCASE: z.string().transform(val => val === 'true').default('true'),
  PASSWORD_REQUIRE_NUMBERS: z.string().transform(val => val === 'true').default('true'),
  PASSWORD_REQUIRE_SYMBOLS: z.string().transform(val => val === 'true').default('false'),
  
  // Development
  ENABLE_CORS: z.string().transform(val => val === 'true').default('true'),
  ENABLE_SWAGGER: z.string().transform(val => val === 'true').default('true'),
  ENABLE_PLAYGROUND: z.string().transform(val => val === 'true').default('true'),
  
  // Production
  TRUST_PROXY: z.string().transform(val => val === 'true').default('false'),
  SECURE_COOKIES: z.string().transform(val => val === 'true').default('false'),
  HTTPS_ONLY: z.string().transform(val => val === 'true').default('false'),
  
  // Optional Cloud Provider Keys
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().optional(),
  
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  GOOGLE_CLOUD_STORAGE_BUCKET: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  
  AZURE_STORAGE_ACCOUNT: z.string().optional(),
  AZURE_STORAGE_KEY: z.string().optional(),
  AZURE_STORAGE_CONTAINER: z.string().optional(),
  
  // GPU Providers (Optional)
  RUNPOD_API_KEY: z.string().optional(),
  RUNPOD_ENDPOINT: z.string().url().default('https://api.runpod.ai/graphql'),
  
  VAST_API_KEY: z.string().optional(),
  VAST_ENDPOINT: z.string().url().default('https://console.vast.ai/api/v0'),
  
  LAMBDA_API_KEY: z.string().optional(),
  LAMBDA_ENDPOINT: z.string().url().default('https://cloud.lambdalabs.com/api/v1'),
  
  PAPERSPACE_API_KEY: z.string().optional(),
  PAPERSPACE_ENDPOINT: z.string().url().default('https://api.paperspace.io'),
  
  // Email (Optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).default('587'),
  SMTP_SECURE: z.string().transform(val => val === 'true').default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@aima.local'),
  
  // MinIO (for local development)
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.string().transform(Number).default('9000'),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_BUCKET: z.string().default('aima-storage'),
  MINIO_USE_SSL: z.string().transform(val => val === 'true').default('false'),
  
  // Feature Flags
  ENABLE_FACE_RECOGNITION: z.string().transform(val => val === 'true').default('true'),
  ENABLE_VOICE_RECOGNITION: z.string().transform(val => val === 'true').default('true'),
  ENABLE_OBJECT_DETECTION: z.string().transform(val => val === 'true').default('true'),
  ENABLE_TRANSCRIPTION: z.string().transform(val => val === 'true').default('true'),
  ENABLE_GPU_INSTANCES: z.string().transform(val => val === 'true').default('true'),
  ENABLE_WEBHOOKS: z.string().transform(val => val === 'true').default('true'),
  ENABLE_API_KEYS: z.string().transform(val => val === 'true').default('true'),
  
  // User Limits
  FREE_USER_MAX_FILES: z.string().transform(Number).default('100'),
  FREE_USER_MAX_STORAGE: z.string().transform(Number).default('1073741824'), // 1GB
  FREE_USER_MAX_GPU_INSTANCES: z.string().transform(Number).default('0'),
  FREE_USER_MAX_CONCURRENT_JOBS: z.string().transform(Number).default('1'),
  
  PRO_USER_MAX_FILES: z.string().transform(Number).default('1000'),
  PRO_USER_MAX_STORAGE: z.string().transform(Number).default('10737418240'), // 10GB
  PRO_USER_MAX_GPU_INSTANCES: z.string().transform(Number).default('3'),
  PRO_USER_MAX_CONCURRENT_JOBS: z.string().transform(Number).default('5'),
  
  ENTERPRISE_USER_MAX_FILES: z.string().transform(Number).default('10000'),
  ENTERPRISE_USER_MAX_STORAGE: z.string().transform(Number).default('107374182400'), // 100GB
  ENTERPRISE_USER_MAX_GPU_INSTANCES: z.string().transform(Number).default('10'),
  ENTERPRISE_USER_MAX_CONCURRENT_JOBS: z.string().transform(Number).default('20'),
});

export type EnvConfig = z.infer<typeof envSchema>;

// Validate environment variables
export function validateEnv(): EnvConfig {
  try {
    const env = envSchema.parse(process.env);
    
    logger.info('Environment validation successful', {
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      logLevel: env.LOG_LEVEL,
    });
    
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      );
      
      logger.error('Environment validation failed:', {
        errors: errorMessages,
      });
      
      console.error('❌ Environment validation failed:');
      errorMessages.forEach((msg) => console.error(`  - ${msg}`));
      
      process.exit(1);
    }
    
    logger.error('Unexpected error during environment validation:', error);
    console.error('❌ Unexpected error during environment validation:', error);
    process.exit(1);
  }
}

// Password validation schema
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// Email validation schema
export const emailSchema = z.string().email('Invalid email address');

// UUID validation schema
export const uuidSchema = z.string().uuid('Invalid UUID format');

// File validation schemas
export const imageFileSchema = z.object({
  mimetype: z.string().regex(/^image\/(jpeg|jpg|png|gif|webp|bmp|tiff)$/i, 'Invalid image format'),
  size: z.number().max(50 * 1024 * 1024, 'Image file too large (max 50MB)'),
});

export const videoFileSchema = z.object({
  mimetype: z.string().regex(/^video\/(mp4|avi|mov|wmv|flv|webm|mkv|m4v)$/i, 'Invalid video format'),
  size: z.number().max(500 * 1024 * 1024, 'Video file too large (max 500MB)'),
});

export const audioFileSchema = z.object({
  mimetype: z.string().regex(/^audio\/(mp3|wav|flac|aac|ogg|m4a|wma|mpeg)$/i, 'Invalid audio format'),
  size: z.number().max(100 * 1024 * 1024, 'Audio file too large (max 100MB)'),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Search schema
export const searchSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  type: z.enum(['all', 'name', 'description', 'content']).default('all'),
});

// Date range schema
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Job configuration schemas
export const faceRecognitionConfigSchema = z.object({
  threshold: z.number().min(0).max(1).default(0.8),
  maxFaces: z.number().min(1).max(100).default(10),
  includeEmbeddings: z.boolean().default(true),
  detectAge: z.boolean().default(false),
  detectGender: z.boolean().default(false),
  detectEmotion: z.boolean().default(false),
});

export const voiceRecognitionConfigSchema = z.object({
  threshold: z.number().min(0).max(1).default(0.7),
  speakerDiarization: z.boolean().default(true),
  includeEmbeddings: z.boolean().default(true),
  windowSize: z.number().min(0.5).max(10).default(3.0),
  overlapRatio: z.number().min(0).max(0.9).default(0.5),
});

export const transcriptionConfigSchema = z.object({
  language: z.string().default('auto'),
  model: z.enum(['whisper-tiny', 'whisper-base', 'whisper-small', 'whisper-medium', 'whisper-large']).default('whisper-base'),
  temperature: z.number().min(0).max(1).default(0.0),
  includeTimestamps: z.boolean().default(true),
  includeSpeakerLabels: z.boolean().default(true),
});

export const objectDetectionConfigSchema = z.object({
  confidence: z.number().min(0).max(1).default(0.5),
  iouThreshold: z.number().min(0).max(1).default(0.45),
  maxDetections: z.number().min(1).max(1000).default(100),
  classes: z.array(z.string()).optional(),
  includeSegmentation: z.boolean().default(false),
});

// GPU instance configuration schema
export const gpuInstanceConfigSchema = z.object({
  gpuCount: z.number().min(1).max(8).default(1),
  cpuCores: z.number().min(1).max(64).default(4),
  ramGb: z.number().min(1).max(512).default(16),
  storageGb: z.number().min(10).max(2000).default(50),
  dockerImage: z.string().min(1, 'Docker image is required'),
  environmentVariables: z.record(z.string()).optional(),
  ports: z.array(z.number().min(1).max(65535)).optional(),
  sshKeys: z.array(z.string()).optional(),
});

// Webhook validation schema
export const webhookSchema = z.object({
  signature: z.string().min(1, 'Webhook signature is required'),
  timestamp: z.string().datetime('Invalid timestamp format'),
  event: z.string().min(1, 'Event type is required'),
  data: z.record(z.any()),
});

// API key validation schema
export const apiKeySchema = z.object({
  name: z.string().min(1, 'API key name is required').max(100, 'Name too long'),
  permissions: z.array(z.enum(['read', 'write', 'admin'])).default(['read']),
  expiresAt: z.string().datetime().optional(),
  ipWhitelist: z.array(z.string().ip()).optional(),
});

// Rate limiting validation
export const rateLimitSchema = z.object({
  windowMs: z.number().min(1000).max(3600000).default(900000), // 15 minutes max
  max: z.number().min(1).max(10000).default(100),
  skipSuccessfulRequests: z.boolean().default(false),
  skipFailedRequests: z.boolean().default(false),
});

// Health check schema
export const healthCheckSchema = z.object({
  status: z.enum(['healthy', 'unhealthy', 'degraded']),
  timestamp: z.string().datetime(),
  uptime: z.number().min(0),
  version: z.string(),
  environment: z.string(),
  services: z.record(z.enum(['healthy', 'unhealthy', 'unknown'])),
  memory: z.object({
    used: z.number(),
    total: z.number(),
    percentage: z.number().min(0).max(100),
  }).optional(),
});

// Export commonly used validation functions
export const validatePassword = (password: string) => {
  return passwordSchema.safeParse(password);
};

export const validateEmail = (email: string) => {
  return emailSchema.safeParse(email);
};

export const validateUUID = (uuid: string) => {
  return uuidSchema.safeParse(uuid);
};

export const validatePagination = (query: any) => {
  return paginationSchema.safeParse(query);
};

export const validateSearch = (query: any) => {
  return searchSchema.safeParse(query);
};

export const validateDateRange = (query: any) => {
  return dateRangeSchema.safeParse(query);
};