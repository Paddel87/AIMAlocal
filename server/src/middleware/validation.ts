import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError } from './errorHandler';
import { logger } from '../utils/logger';

// Generic validation middleware factory
export const validate = (schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      // Validate query parameters
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }

      // Validate route parameters
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }

      // Validate headers
      if (schema.headers) {
        req.headers = schema.headers.parse(req.headers);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = new ValidationError(
          'Validation failed',
          error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          }))
        );
        
        logger.warn('Validation error', {
          path: req.path,
          method: req.method,
          errors: validationError.details,
          userId: req.user?.id,
        });
        
        next(validationError);
      } else {
        next(error);
      }
    }
  };
};

// Validate body only
export const validateBody = (schema: ZodSchema) => {
  return validate({ body: schema });
};

// Validate query only
export const validateQuery = (schema: ZodSchema) => {
  return validate({ query: schema });
};

// Validate params only
export const validateParams = (schema: ZodSchema) => {
  return validate({ params: schema });
};

// Validate headers only
export const validateHeaders = (schema: ZodSchema) => {
  return validate({ headers: schema });
};

// Common validation schemas
export const commonSchemas = {
  // UUID parameter validation
  uuidParam: z.object({
    id: z.string().uuid('Invalid UUID format'),
  }),

  // Pagination query validation
  pagination: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 10),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),

  // Search query validation
  search: z.object({
    q: z.string().min(1, 'Search query is required').max(100, 'Search query too long'),
    type: z.string().optional(),
    category: z.string().optional(),
  }),

  // Date range validation
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),

  // File upload validation
  fileUpload: z.object({
    maxSize: z.number().positive().optional(),
    allowedTypes: z.array(z.string()).optional(),
    required: z.boolean().optional().default(false),
  }),
};

// Middleware for common validations
export const validateUuidParam = validateParams(commonSchemas.uuidParam);
export const validatePagination = validateQuery(commonSchemas.pagination);
export const validateSearch = validateQuery(commonSchemas.search);
export const validateDateRange = validateQuery(commonSchemas.dateRange);

// Custom validation helpers
export const validateFileSize = (maxSize: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.file && req.file.size > maxSize) {
      return next(new ValidationError(
        'File too large',
        [{ field: 'file', message: `File size must be less than ${maxSize} bytes`, code: 'too_big' }]
      ));
    }
    next();
  };
};

export const validateFileType = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.file && !allowedTypes.includes(req.file.mimetype)) {
      return next(new ValidationError(
        'Invalid file type',
        [{ field: 'file', message: `File type must be one of: ${allowedTypes.join(', ')}`, code: 'invalid_type' }]
      ));
    }
    next();
  };
};

// Sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Remove potentially dangerous characters from string inputs
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.trim().replace(/[<>"'&]/g, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

// Content type validation
export const validateContentType = (expectedType: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.get('Content-Type');
    if (!contentType || !contentType.includes(expectedType)) {
      return next(new ValidationError(
        'Invalid content type',
        [{ field: 'content-type', message: `Expected ${expectedType}`, code: 'invalid_type' }]
      ));
    }
    next();
  };
};

// JSON validation middleware
export const validateJSON = validateContentType('application/json');

// Multipart form data validation
export const validateMultipart = validateContentType('multipart/form-data');