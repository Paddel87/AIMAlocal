import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { 
  AuthenticationError, 
  ValidationError, 
  ConflictError,
  NotFoundError,
  asyncHandler 
} from '../middleware/errorHandler';
import { UserRole } from '@prisma/client';

// Generate JWT token
const generateToken = (userId: string, email: string, role: UserRole): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }
  
  return jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Generate refresh token
const generateRefreshToken = (userId: string): string => {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET not configured');
  }
  
  return jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

// Register new user
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, role = UserRole.FREE } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ConflictError('User already exists with this email');
  }

  // Hash password
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  // Generate tokens
  const accessToken = generateToken(user.id, user.email, user.role);
  const refreshToken = generateRefreshToken(user.id);

  // Store refresh token in Redis
  await redis.setex(`refresh_token:${user.id}`, 7 * 24 * 60 * 60, refreshToken);

  (logger as any).logAuth('user_registered', user.id, user.email, req.ip, true);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user,
      accessToken,
      refreshToken,
    },
  });
});

// Login user
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    (logger as any).logAuth('login_failed', undefined, email, req.ip, false);
    throw new AuthenticationError('Invalid credentials');
  }

  if (!user.isActive) {
    (logger as any).logAuth('login_failed_inactive', user.id, email, req.ip, false);
    throw new AuthenticationError('Account is deactivated');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    (logger as any).logAuth('login_failed', user.id, email, req.ip, false);
    throw new AuthenticationError('Invalid credentials');
  }

  // Generate tokens
  const accessToken = generateToken(user.id, user.email, user.role);
  const refreshToken = generateRefreshToken(user.id);

  // Store refresh token in Redis
  await redis.setex(`refresh_token:${user.id}`, 7 * 24 * 60 * 60, refreshToken);

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  (logger as any).logAuth('login_success', user.id, email, req.ip, true);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      accessToken,
      refreshToken,
    },
  });
});

// Refresh access token
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ValidationError('Refresh token is required');
  }

  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET not configured');
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET) as { userId: string };
    
    // Check if refresh token exists in Redis
    const storedToken = await redis.get(`refresh_token:${decoded.userId}`);
    if (!storedToken || storedToken !== refreshToken) {
      throw new AuthenticationError('Invalid refresh token');
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }

    // Generate new access token
    const newAccessToken = generateToken(user.id, user.email, user.role);

    (logger as any).logAuth('token_refreshed', user.id, user.email, req.ip, true);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid refresh token');
    }
    throw error;
  }
});

// Logout user
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (userId) {
    // Remove refresh token from Redis
    await redis.del(`refresh_token:${userId}`);
    (logger as any).logAuth('logout', userId, req.user?.email, req.ip, true);
  }

  res.json({
    success: true,
    message: 'Logout successful',
  });
});

// Get current user profile
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new AuthenticationError('User not authenticated');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      _count: {
        select: {
          jobs: true,
          mediaFiles: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.json({
    success: true,
    data: { user },
  });
});

// Update user profile
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { firstName, lastName } = req.body;

  if (!userId) {
    throw new AuthenticationError('User not authenticated');
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName,
      lastName,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      updatedAt: true,
    },
  });

  (logger as any).logAuth('profile_updated', userId, req.user?.email, req.ip, true);

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: { user },
  });
});

// Change password
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { currentPassword, newPassword } = req.body;

  if (!userId) {
    throw new AuthenticationError('User not authenticated');
  }

  // Get current user with password
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.password);
  if (!isValidPassword) {
    (logger as any).logAuth('password_change_failed', userId, req.user?.email, req.ip, false);
    throw new AuthenticationError('Current password is incorrect');
  }

  // Hash new password
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      updatedAt: new Date(),
    },
  });

  // Invalidate all refresh tokens
  await redis.del(`refresh_token:${userId}`);

  (logger as any).logAuth('password_changed', userId, req.user?.email, req.ip, true);

  res.json({
    success: true,
    message: 'Password changed successfully',
  });
});

// Verify email (placeholder for email verification feature)
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;

  // This would typically verify an email verification token
  // For now, just return success
  res.json({
    success: true,
    message: 'Email verified successfully',
  });
});

// Request password reset (placeholder)
export const requestPasswordReset = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  // This would typically send a password reset email
  // For now, just return success
  res.json({
    success: true,
    message: 'Password reset email sent',
  });
});

// Reset password (placeholder)
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  // This would typically verify the reset token and update password
  // For now, just return success
  res.json({
    success: true,
    message: 'Password reset successfully',
  });
});