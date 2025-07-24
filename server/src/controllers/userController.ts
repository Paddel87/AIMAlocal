import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';
import { 
  NotFoundError, 
  AuthorizationError, 
  ValidationError,
  ConflictError,
  asyncHandler 
} from '../middleware/errorHandler';
import { UserRole } from '@prisma/client';

// Get all users (Admin only)
export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 10, search, role, status } = req.query;
  const currentUser = req.user;

  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    throw new AuthorizationError('Admin access required');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  // Build where clause
  const where: any = {};
  
  if (search) {
    where.OR = [
      { email: { contains: search as string, mode: 'insensitive' } },
      { firstName: { contains: search as string, mode: 'insensitive' } },
      { lastName: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  if (role && Object.values(UserRole).includes(role as UserRole)) {
    where.role = role as UserRole;
  }

  // Status filtering removed as status field is not defined in User model

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        // status: true, // Field not available in User model
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            mediaFiles: true,
            jobs: true,
            personDossiers: true,
            gpuInstances: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / take);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1,
      },
    },
  });
});

// Get user by ID
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  // Users can only view their own profile unless they're admin
  if (currentUser.role !== UserRole.ADMIN && currentUser.id !== id) {
    throw new AuthorizationError('Access denied');
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      // status: true, // Field not available in User model
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      preferences: true,
      _count: {
        select: {
          mediaFiles: true,
          jobs: true,
          personDossiers: true,
          gpuInstances: true,
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

// Create new user (Admin only)
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, role = UserRole.FREE } = req.body;
  const currentUser = req.user;

  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    throw new AuthorizationError('Admin access required');
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ConflictError('User with this email already exists');
  }

  // Validate role
  if (!Object.values(UserRole).includes(role)) {
    throw new ValidationError('Invalid user role');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      // status: UserStatus.ACTIVE, // Field not available in User model
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      // status: true, // Field not available in User model
      createdAt: true,
    },
  });

  logger.info('User created by admin', {
    userId: user.id,
    email: user.email,
    role: user.role,
    createdBy: currentUser.id,
  });

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: { user },
  });
});

// Update user
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { firstName, lastName, preferences } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  // Users can only update their own profile unless they're admin
  if (currentUser.role !== UserRole.ADMIN && currentUser.id !== id) {
    throw new AuthorizationError('Access denied');
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(preferences && { preferences }),
      updatedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      preferences: true,
      updatedAt: true,
    },
  });

  // Invalidate cache
  await redis.del(`user:${id}`);

  res.json({
    success: true,
    message: 'User updated successfully',
    data: { user: updatedUser },
  });
});

// Update user role (Admin only)
export const updateUserRole = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;
  const currentUser = req.user;

  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    throw new AuthorizationError('Admin access required');
  }

  if (!Object.values(UserRole).includes(role)) {
    throw new ValidationError('Invalid user role');
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Prevent admin from changing their own role
  if (currentUser.id === id) {
    throw new AuthorizationError('Cannot change your own role');
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      role,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
    },
  });

  // Invalidate cache
  await redis.del(`user:${id}`);

  logger.info('User role updated', {
    userId: id,
    oldRole: user.role,
    newRole: role,
    updatedBy: currentUser.id,
  });

  res.json({
    success: true,
    message: 'User role updated successfully',
    data: { user: updatedUser },
  });
});

// Update user status function removed as status field is not available in User model

// Delete user (Admin only)
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user;

  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    throw new AuthorizationError('Admin access required');
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          mediaFiles: true,
          jobs: true,
          personDossiers: true,
          gpuInstances: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Prevent admin from deleting themselves
  if (currentUser.id === id) {
    throw new AuthorizationError('Cannot delete your own account');
  }

  // Check if user has associated data
  const hasData = Object.values(user._count).some(count => count > 0);
  if (hasData) {
    throw new ValidationError('Cannot delete user with associated data. Please transfer or delete user data first.');
  }

  // Delete user
  await prisma.user.delete({
    where: { id },
  });

  // Clean up cache and sessions
  await redis.del(`user:${id}`);
  await redis.del(`refresh_token:${id}:*`);

  logger.info('User deleted', {
    userId: id,
    email: user.email,
    deletedBy: currentUser.id,
  });

  res.json({
    success: true,
    message: 'User deleted successfully',
  });
});

// Get user statistics
export const getUserStats = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  // Users can only view their own stats unless they're admin
  if (currentUser.role !== UserRole.ADMIN && currentUser.id !== id) {
    throw new AuthorizationError('Access denied');
  }

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const [mediaStats, jobStats, personStats, gpuStats] = await Promise.all([
    prisma.mediaFile.aggregate({
      where: { userId: id },
      _count: { id: true },
      _sum: { size: true },
    }),
    prisma.job.groupBy({
      by: ['status'],
      where: { userId: id },
      _count: { id: true },
    }),
    prisma.personDossier.count({
      where: { userId: id },
    }),
    prisma.gpuInstance.groupBy({
      by: ['status'],
      where: { userId: id },
      _count: { id: true },
    }),
  ]);

  // Get recent activity
  const recentJobs = await prisma.job.findMany({
    where: { userId: id },
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      status: true,
      createdAt: true,
      completedAt: true,
    },
  });

  const recentMedia = await prisma.mediaFile.findMany({
    where: { userId: id },
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      filename: true,
      type: true,
      size: true,
      createdAt: true,
    },
  });

  res.json({
    success: true,
    data: {
      mediaStats: {
        totalFiles: mediaStats._count.id || 0,
        totalSize: mediaStats._sum.size || 0,
      },
      jobStats: jobStats.reduce((acc, stat) => {
        acc[stat.status] = stat._count.id;
        return acc;
      }, {} as Record<string, number>),
      personStats: {
        totalDossiers: personStats,
      },
      gpuStats: gpuStats.reduce((acc, stat) => {
        acc[stat.status] = stat._count.id;
        return acc;
      }, {} as Record<string, number>),
      recentActivity: {
        jobs: recentJobs,
        media: recentMedia,
      },
    },
  });
});

// Get system statistics (Admin only)
export const getSystemStats = asyncHandler(async (req: Request, res: Response) => {
  const currentUser = req.user;

  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    throw new AuthorizationError('Admin access required');
  }

  const [userStats, mediaStats, jobStats, gpuStats] = await Promise.all([
    prisma.user.groupBy({
      by: ['role', 'status'],
      _count: { id: true },
    }),
    prisma.mediaFile.aggregate({
      _count: { id: true },
      _sum: { size: true },
    }),
    prisma.job.groupBy({
      by: ['status', 'type'],
      _count: { id: true },
    }),
    prisma.gpuInstance.groupBy({
      by: ['status', 'provider'],
      _count: { id: true },
    }),
  ]);

  // Get recent registrations
  const recentUsers = await prisma.user.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  res.json({
    success: true,
    data: {
      userStats: userStats.reduce((acc, stat) => {
        const key = `${stat.role}_${stat.status}`;
        acc[key] = stat._count.id;
        return acc;
      }, {} as Record<string, number>),
      mediaStats: {
        totalFiles: mediaStats._count.id || 0,
        totalSize: mediaStats._sum.size || 0,
      },
      jobStats: jobStats.reduce((acc, stat) => {
        const key = `${stat.type}_${stat.status}`;
        acc[key] = stat._count.id;
        return acc;
      }, {} as Record<string, number>),
      gpuStats: gpuStats.reduce((acc, stat) => {
        const key = `${stat.provider}_${stat.status}`;
        acc[key] = stat._count.id;
        return acc;
      }, {} as Record<string, number>),
      recentUsers,
    },
  });
});