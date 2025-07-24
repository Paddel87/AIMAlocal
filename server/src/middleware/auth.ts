import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { AuthenticationError, AuthorizationError } from './errorHandler';
import { logger } from '../utils/logger';
import { UserRole } from '@prisma/client';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        isActive: boolean;
      };
    }
  }
}

interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

// Authentication middleware
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JWTPayload;
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    if (!user.isActive) {
      throw new AuthenticationError('Account is deactivated');
    }

    // Attach user to request
    req.user = user;
    
    (logger as any).logAuth('token_verified', user.id, user.email, req.ip, true);
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      (logger as any).logAuth('invalid_token', undefined, undefined, req.ip, false);
      next(new AuthenticationError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      (logger as any).logAuth('token_expired', undefined, undefined, req.ip, false);
      next(new AuthenticationError('Token expired'));
    } else {
      next(error);
    }
  }
};

// Optional authentication middleware (doesn't throw error if no token)
export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without user
    }

    const token = authHeader.substring(7);
    
    if (!process.env.JWT_SECRET) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JWTPayload;
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (user && user.isActive) {
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Ignore authentication errors in optional auth
    next();
  }
};

// Role-based authorization middleware
export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      (logger as any).logAuth('unauthorized_access', req.user.id, req.user.email, req.ip, false);
      return next(new AuthorizationError('Insufficient permissions'));
    }

    next();
  };
};

// Admin only middleware
export const adminOnly = authorize(UserRole.ADMIN);

// Pro and above middleware
export const proAndAbove = authorize(UserRole.PRO, UserRole.ENTERPRISE, UserRole.ADMIN);

// Enterprise and admin middleware
export const enterpriseAndAdmin = authorize(UserRole.ENTERPRISE, UserRole.ADMIN);

// Self or admin middleware (user can access their own resources or admin can access any)
export const selfOrAdmin = (userIdParam: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    const targetUserId = req.params[userIdParam] || req.body[userIdParam] || req.query[userIdParam];
    
    if (req.user.role === UserRole.ADMIN || req.user.id === targetUserId) {
      return next();
    }

    (logger as any).logAuth('unauthorized_resource_access', req.user.id, req.user.email, req.ip, false);
    return next(new AuthorizationError('Access denied'));
  };
};

// Rate limiting by user
export const rateLimitByUser = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    
    const userRequests = requests.get(userId);
    
    if (!userRequests || now > userRequests.resetTime) {
      requests.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (userRequests.count >= maxRequests) {
      (logger as any).logSecurity('rate_limit_exceeded', 'medium', {
        userId: req.user?.id,
        ip: req.ip,
        endpoint: req.path,
      });
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil((userRequests.resetTime - now) / 1000),
      });
    }
    
    userRequests.count++;
    next();
  };
};