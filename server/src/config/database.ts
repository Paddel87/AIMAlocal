import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Create a global variable to store the Prisma client instance
declare global {
  var __prisma: PrismaClient | undefined;
}

// Create Prisma client instance
const createPrismaClient = () => {
  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'info',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
    errorFormat: 'pretty',
  });

  // Log database queries in development
  if (process.env.NODE_ENV === 'development') {
    prisma.$on('query', (e) => {
      (logger as any).logDatabase('query', 'unknown', e.duration, undefined);
    });
  }

  // Log database errors
  prisma.$on('error', (e) => {
    (logger as any).logDatabase('error', 'unknown', undefined, new Error(e.message));
  });

  // Log database info
  prisma.$on('info', (e) => {
    logger.info('Database Info', { message: e.message, timestamp: e.timestamp });
  });

  // Log database warnings
  prisma.$on('warn', (e) => {
    logger.warn('Database Warning', { message: e.message, timestamp: e.timestamp });
  });

  return prisma;
};

// Use global variable in development to prevent multiple instances
const prisma = globalThis.__prisma || createPrismaClient();

if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
}

// Database connection helper
export const connectDatabase = async () => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
    return true;
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    return false;
  }
};

// Database disconnection helper
export const disconnectDatabase = async () => {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Failed to disconnect from database', { error });
  }
};

// Database health check
export const checkDatabaseHealth = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    logger.error('Database health check failed', { error });
    return { status: 'unhealthy', error: (error as Error).message, timestamp: new Date().toISOString() };
  }
};

// Transaction helper
export const withTransaction = async <T>(
  callback: (prisma: PrismaClient) => Promise<T>
): Promise<T> => {
  return await prisma.$transaction(callback);
};

export { prisma };
export default prisma;