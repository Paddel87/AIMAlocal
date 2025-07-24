import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which level to log based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define format for file logs (without colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format,
    level: level(),
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(logsDir, 'app.log'),
    format: fileFormat,
    level: 'info',
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    tailable: true,
  }),
  
  // File transport for error logs
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    format: fileFormat,
    level: 'error',
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    tailable: true,
  }),
];

// Add daily rotate file transport for production
if (process.env.NODE_ENV === 'production') {
  const DailyRotateFile = require('winston-daily-rotate-file');
  
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: fileFormat,
      level: 'info',
    })
  );
  
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat,
      level: 'error',
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format: fileFormat,
  transports,
  exitOnError: false,
});

// Extend logger interface
interface ExtendedLogger extends winston.Logger {
  httpStream?: { write: (message: string) => void };
  logRequest?: (req: any, res: any, duration?: number) => void;
  logError?: (error: Error, context?: any) => void;
  logDatabase?: (operation: string, table: string, duration?: number, error?: Error) => void;
  logAuth?: (event: string, userId?: string, email?: string, ip?: string, success?: boolean) => void;
  logJob?: (jobId: string, status: string, type?: string, userId?: string, duration?: number, error?: Error) => void;
  logSecurity?: (event: string, severity: 'low' | 'medium' | 'high' | 'critical', details: any) => void;
  logPerformance?: (operation: string, duration: number, metadata?: any) => void;
  logSystem?: (event: string, details?: any) => void;
  logWebhook?: (provider: string, event: string, success: boolean, duration?: number, error?: Error) => void;
  logCache?: (operation: 'hit' | 'miss' | 'set' | 'del', key: string, duration?: number) => void;
  logFile?: (operation: string, filename: string, size?: number, duration?: number, error?: Error) => void;
}

// Create a stream object for Morgan HTTP logger
(logger as any).httpStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Add request logging helper
(logger as any).logRequest = (req: any, res: any, duration?: number) => {
  const { method, url, ip } = req;
  const { statusCode } = res;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const userId = req.user?.id || 'Anonymous';
  
  logger.info('HTTP Request', {
    method,
    url,
    statusCode,
    ip,
    userAgent,
    userId,
    duration: duration ? `${duration}ms` : undefined,
    timestamp: new Date().toISOString(),
  });
};

// Add error logging helper
(logger as any).logError = (error: Error, context?: any) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    context,
    timestamp: new Date().toISOString(),
  });
};

// Add database logging helper
(logger as any).logDatabase = (operation: string, table: string, duration?: number, error?: Error) => {
  if (error) {
    logger.error('Database Error', {
      operation,
      table,
      error: error.message,
      duration: duration ? `${duration}ms` : undefined,
      timestamp: new Date().toISOString(),
    });
  } else {
    logger.debug('Database Operation', {
      operation,
      table,
      duration: duration ? `${duration}ms` : undefined,
      timestamp: new Date().toISOString(),
    });
  }
};

// Add authentication logging helper
(logger as any).logAuth = (event: string, userId?: string, email?: string, ip?: string, success: boolean = true) => {
  const level = success ? 'info' : 'warn';
  logger.log(level, 'Authentication Event', {
    event,
    userId,
    email,
    ip,
    success,
    timestamp: new Date().toISOString(),
  });
};

// Add job logging helper
(logger as any).logJob = (jobId: string, status: string, type?: string, userId?: string, duration?: number, error?: Error) => {
  if (error) {
    logger.error('Job Error', {
      jobId,
      status,
      type,
      userId,
      error: error.message,
      duration: duration ? `${duration}ms` : undefined,
      timestamp: new Date().toISOString(),
    });
  } else {
    logger.info('Job Update', {
      jobId,
      status,
      type,
      userId,
      duration: duration ? `${duration}ms` : undefined,
      timestamp: new Date().toISOString(),
    });
  }
};

// Add security logging helper
(logger as any).logSecurity = (event: string, severity: 'low' | 'medium' | 'high' | 'critical', details: any) => {
  const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
  logger.log(level, 'Security Event', {
    event,
    severity,
    details,
    timestamp: new Date().toISOString(),
  });
};

// Add performance logging helper
(logger as any).logPerformance = (operation: string, duration: number, metadata?: any) => {
  const level = duration > 5000 ? 'warn' : 'info'; // Warn if operation takes more than 5 seconds
  logger.log(level, 'Performance Metric', {
    operation,
    duration: `${duration}ms`,
    metadata,
    timestamp: new Date().toISOString(),
  });
};

// Add system logging helper
(logger as any).logSystem = (event: string, details?: any) => {
  logger.info('System Event', {
    event,
    details,
    timestamp: new Date().toISOString(),
  });
};

// Add webhook logging helper
(logger as any).logWebhook = (provider: string, event: string, success: boolean, duration?: number, error?: Error) => {
  const level = success ? 'info' : 'error';
  logger.log(level, 'Webhook Event', {
    provider,
    event,
    success,
    duration: duration ? `${duration}ms` : undefined,
    error: error?.message,
    timestamp: new Date().toISOString(),
  });
};

// Add cache logging helper
(logger as any).logCache = (operation: 'hit' | 'miss' | 'set' | 'del', key: string, duration?: number) => {
  logger.debug('Cache Operation', {
    operation,
    key,
    duration: duration ? `${duration}ms` : undefined,
    timestamp: new Date().toISOString(),
  });
};

// Add file operation logging helper
(logger as any).logFile = (operation: string, filename: string, size?: number, duration?: number, error?: Error) => {
  if (error) {
    logger.error('File Operation Error', {
      operation,
      filename,
      size,
      error: error.message,
      duration: duration ? `${duration}ms` : undefined,
      timestamp: new Date().toISOString(),
    });
  } else {
    logger.info('File Operation', {
      operation,
      filename,
      size,
      duration: duration ? `${duration}ms` : undefined,
      timestamp: new Date().toISOString(),
    });
  }
};

// Handle uncaught exceptions and unhandled rejections
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'exceptions.log'),
    format: fileFormat,
  })
);

logger.rejections.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'rejections.log'),
    format: fileFormat,
  })
);

// Export the logger
export { logger };
export default logger as ExtendedLogger;