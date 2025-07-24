import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

// Custom error class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation error class
export class ValidationError extends AppError {
  public errors: any[];

  constructor(message: string, errors: any[] = []) {
    super(message, 400);
    this.errors = errors;
  }
}

// Authentication error class
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401);
  }
}

// Authorization error class
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403);
  }
}

// Not found error class
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

// Conflict error class
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409);
  }
}

// Rate limit error class
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
  }
}

// File upload error class
export class FileUploadError extends AppError {
  constructor(message: string = 'File upload failed') {
    super(message, 400);
  }
}

// External service error class
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string = 'External service error') {
    super(`${service}: ${message}`, 502);
  }
}

// Database error handler
function handleDatabaseError(error: any): AppError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        const field = error.meta?.target as string[];
        const fieldName = field ? field[0] : 'field';
        return new ConflictError(`${fieldName} already exists`);
      
      case 'P2025':
        // Record not found
        return new NotFoundError('Record');
      
      case 'P2003':
        // Foreign key constraint violation
        return new ValidationError('Invalid reference to related record');
      
      case 'P2014':
        // Required relation violation
        return new ValidationError('Required relation missing');
      
      case 'P2021':
        // Table does not exist
        return new AppError('Database table not found', 500);
      
      case 'P2022':
        // Column does not exist
        return new AppError('Database column not found', 500);
      
      default:
        return new AppError('Database operation failed', 500);
    }
  }
  
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return new AppError('Unknown database error', 500);
  }
  
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return new AppError('Database engine error', 500);
  }
  
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new AppError('Database connection failed', 500);
  }
  
  if (error instanceof Prisma.PrismaClientValidationError) {
    return new ValidationError('Invalid database query parameters');
  }
  
  return new AppError('Database error', 500);
}

// Validation error handler
function handleValidationError(error: ZodError): ValidationError {
  const errors = error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
  
  return new ValidationError('Validation failed', errors);
}

// JWT error handler
function handleJWTError(error: any): AppError {
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid token');
  }
  
  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('Token expired');
  }
  
  if (error.name === 'NotBeforeError') {
    return new AuthenticationError('Token not active');
  }
  
  return new AuthenticationError('Token verification failed');
}

// Multer error handler
function handleMulterError(error: any): AppError {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new FileUploadError('File too large');
  }
  
  if (error.code === 'LIMIT_FILE_COUNT') {
    return new FileUploadError('Too many files');
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return new FileUploadError('Unexpected file field');
  }
  
  if (error.code === 'LIMIT_PART_COUNT') {
    return new FileUploadError('Too many parts');
  }
  
  if (error.code === 'LIMIT_FIELD_KEY') {
    return new FileUploadError('Field name too long');
  }
  
  if (error.code === 'LIMIT_FIELD_VALUE') {
    return new FileUploadError('Field value too long');
  }
  
  if (error.code === 'LIMIT_FIELD_COUNT') {
    return new FileUploadError('Too many fields');
  }
  
  return new FileUploadError('File upload error');
}

// Cast error to AppError
function castErrorToAppError(error: any): AppError {
  // Handle known error types
  if (error instanceof AppError) {
    return error;
  }
  
  if (error instanceof ZodError) {
    return handleValidationError(error);
  }
  
  if (error.name?.includes('Prisma')) {
    return handleDatabaseError(error);
  }
  
  if (error.name?.includes('JsonWebToken') || error.name?.includes('Token')) {
    return handleJWTError(error);
  }
  
  if (error.code?.startsWith('LIMIT_')) {
    return handleMulterError(error);
  }
  
  // Handle system errors
  if (error.code === 'ENOENT') {
    return new NotFoundError('File');
  }
  
  if (error.code === 'EACCES') {
    return new AppError('Permission denied', 403);
  }
  
  if (error.code === 'ENOSPC') {
    return new AppError('No space left on device', 507);
  }
  
  if (error.code === 'EMFILE' || error.code === 'ENFILE') {
    return new AppError('Too many open files', 503);
  }
  
  if (error.code === 'ECONNREFUSED') {
    return new AppError('Connection refused', 503);
  }
  
  if (error.code === 'ETIMEDOUT') {
    return new AppError('Request timeout', 408);
  }
  
  // Handle validation errors from express-validator
  if (error.array && typeof error.array === 'function') {
    const errors = error.array().map((err: any) => ({
      field: err.param || err.path,
      message: err.msg,
      value: err.value,
    }));
    return new ValidationError('Validation failed', errors);
  }
  
  // Default to internal server error
  return new AppError(
    process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : error.message || 'Internal server error',
    500,
    false
  );
}

// Send error response
function sendErrorResponse(error: AppError, req: Request, res: Response) {
  const { statusCode, message, isOperational } = error;
  
  // Base error response
  const errorResponse: any = {
    status: 'error',
    statusCode,
    message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
  };
  
  // Add validation errors if present
  if (error instanceof ValidationError && error.errors.length > 0) {
    errorResponse.errors = error.errors;
  }
  
  // Add stack trace in development
  if (process.env.NODE_ENV === 'development' && !isOperational) {
    errorResponse.stack = error.stack;
  }
  
  // Add request ID if present
  if (req.headers['x-request-id']) {
    errorResponse.requestId = req.headers['x-request-id'];
  }
  
  res.status(statusCode).json(errorResponse);
}

// Main error handler middleware
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Cast error to AppError
  const appError = castErrorToAppError(error);
  
  // Log error
  logger.logError(appError, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
    body: req.body,
    params: req.params,
    query: req.query,
  });
  
  // Send error response
  sendErrorResponse(appError, req, res);
};

// Async error handler wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
};

// Global exception handlers
export const setupGlobalErrorHandlers = () => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    
    // Graceful shutdown
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection:', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString(),
      timestamp: new Date().toISOString(),
    });
    
    // Graceful shutdown
    process.exit(1);
  });
};

// Error factory functions
export const createValidationError = (message: string, errors: any[] = []) => {
  return new ValidationError(message, errors);
};

export const createAuthenticationError = (message?: string) => {
  return new AuthenticationError(message);
};

export const createAuthorizationError = (message?: string) => {
  return new AuthorizationError(message);
};

export const createNotFoundError = (resource?: string) => {
  return new NotFoundError(resource);
};

export const createConflictError = (message?: string) => {
  return new ConflictError(message);
};

export const createRateLimitError = (message?: string) => {
  return new RateLimitError(message);
};

export const createFileUploadError = (message?: string) => {
  return new FileUploadError(message);
};

export const createExternalServiceError = (service: string, message?: string) => {
  return new ExternalServiceError(service, message);
};