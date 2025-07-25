import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 3000,
  commandTimeout: 2000,
  retryDelayOnClusterDown: 300,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
};

// Create Redis client
const redis = new Redis(redisConfig);

// Redis event handlers
redis.on('connect', () => {
  logger.info('Redis client connected');
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

redis.on('error', (error) => {
  logger.warn('Redis client error (non-critical)', { error: error.message });
});

redis.on('close', () => {
  logger.warn('Redis client connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis client reconnecting');
});

// Redis helper functions
export const redisHelpers = {
  // Cache with TTL
  setCache: async (key: string, value: any, ttl: number = 3600) => {
    try {
      const serialized = JSON.stringify(value);
      await redis.setex(key, ttl, serialized);
      logger.debug('Redis cache set', { key });
    } catch (error) {
      logger.error('Redis set error', { key, error });
      throw error;
    }
  },

  // Get from cache
  getCache: async <T>(key: string): Promise<T | null> => {
    try {
      const value = await redis.get(key);
      if (value) {
        logger.debug('Redis cache hit', { key });
        return JSON.parse(value) as T;
      }
      logger.debug('Redis cache miss', { key });
      return null;
    } catch (error) {
      logger.error('Redis get error', { key, error });
      return null;
    }
  },

  // Delete from cache
  deleteCache: async (key: string) => {
    try {
      await redis.del(key);
      logger.debug('Redis cache delete', { key });
    } catch (error) {
      logger.error('Redis delete error', { key, error });
      throw error;
    }
  },

  // Invalidate pattern
  invalidatePattern: async (pattern: string) => {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info('Cache pattern invalidated', { pattern, keysCount: keys.length });
      }
    } catch (error) {
      logger.error('Redis pattern invalidation error', { pattern, error });
      throw error;
    }
  },

  // Set with expiration
  setWithExpiry: async (key: string, value: any, seconds: number) => {
    try {
      const serialized = JSON.stringify(value);
      await redis.setex(key, seconds, serialized);
      logger.debug('Redis cache set with expiry', { key });
    } catch (error) {
      logger.error('Redis setex error', { key, error });
      throw error;
    }
  },

  // Increment counter
  increment: async (key: string, ttl?: number) => {
    try {
      const value = await redis.incr(key);
      if (ttl && value === 1) {
        await redis.expire(key, ttl);
      }
      return value;
    } catch (error) {
      logger.error('Redis increment error', { key, error });
      throw error;
    }
  },

  // Add to set
  addToSet: async (key: string, value: string, ttl?: number) => {
    try {
      await redis.sadd(key, value);
      if (ttl) {
        await redis.expire(key, ttl);
      }
    } catch (error) {
      logger.error('Redis sadd error', { key, error });
      throw error;
    }
  },

  // Check if member exists in set
  isInSet: async (key: string, value: string): Promise<boolean> => {
    try {
      const result = await redis.sismember(key, value);
      return result === 1;
    } catch (error) {
      logger.error('Redis sismember error', { key, error });
      return false;
    }
  },

  // Get all members of a set
  getSetMembers: async (key: string): Promise<string[]> => {
    try {
      return await redis.smembers(key);
    } catch (error) {
      logger.error('Redis smembers error', { key, error });
      return [];
    }
  },

  // Remove from set
  removeFromSet: async (key: string, value: string) => {
    try {
      await redis.srem(key, value);
    } catch (error) {
      logger.error('Redis srem error', { key, error });
      throw error;
    }
  },

  // Push to list
  pushToList: async (key: string, value: any, ttl?: number) => {
    try {
      const serialized = JSON.stringify(value);
      await redis.lpush(key, serialized);
      if (ttl) {
        await redis.expire(key, ttl);
      }
    } catch (error) {
      logger.error('Redis lpush error', { key, error });
      throw error;
    }
  },

  // Pop from list
  popFromList: async <T>(key: string): Promise<T | null> => {
    try {
      const value = await redis.rpop(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      logger.error('Redis rpop error', { key, error });
      return null;
    }
  },
};

// Redis health check
export const checkRedisHealth = async () => {
  try {
    await redis.ping();
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    logger.error('Redis health check failed', { error });
    return { status: 'unhealthy', error: (error as Error).message, timestamp: new Date().toISOString() };
  }
};

// Connect to Redis
export const connectRedis = async () => {
  try {
    await redis.connect();
    logger.info('Redis connected successfully');
    return true;
  } catch (error) {
    logger.error('Failed to connect to Redis', { error });
    return false;
  }
};

// Disconnect from Redis
export const disconnectRedis = async () => {
  try {
    await redis.disconnect();
    logger.info('Redis disconnected successfully');
  } catch (error) {
    logger.error('Failed to disconnect from Redis', { error });
  }
};

// Create redis manager object for compatibility
export const redisManager = {
  redis,
  ...redisHelpers,
  healthCheck: checkRedisHealth,
  connect: connectRedis,
  disconnect: disconnectRedis,
};

// Add invalidatePattern method to redis instance
(redis as any).invalidatePattern = redisHelpers.invalidatePattern;

export { redis };
export default redis;