import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserRole,
  // updateUserStatus, // Function removed as status field not available
  deleteUser,
  getUserStats,
  getSystemStats,
} from '../controllers/userController';
import { authenticate, adminOnly, selfOrAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import { UserRole } from '@prisma/client';

const router = Router();

// Validation schemas
const getUsersSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    search: z.string().optional(),
    role: z.nativeEnum(UserRole).optional(),
    // status: z.nativeEnum(UserStatus).optional(), // UserStatus not available
  }),
});

const createUserSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    role: z.nativeEnum(UserRole).optional(),
  }),
});

const updateUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    preferences: z.record(z.any()).optional(),
  }),
});

const updateUserRoleSchema = z.object({
  body: z.object({
    role: z.nativeEnum(UserRole),
  }),
});

// updateUserStatusSchema removed as UserStatus not available

const userIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID'),
  }),
});

// Routes
router.get('/', authenticate, adminOnly, validate(getUsersSchema), getUsers);
router.get('/stats/system', authenticate, adminOnly, getSystemStats);
router.get('/:id', authenticate, selfOrAdmin, validate(userIdSchema), getUserById);
router.get('/:id/stats', authenticate, selfOrAdmin, validate(userIdSchema), getUserStats);
router.post('/', authenticate, adminOnly, validate(createUserSchema), createUser);
router.put('/:id', authenticate, selfOrAdmin, validate(userIdSchema.merge(updateUserSchema)), updateUser);
router.put('/:id/role', authenticate, adminOnly, validate(userIdSchema.merge(updateUserRoleSchema)), updateUserRole);
// Status update route removed as UserStatus not available
router.delete('/:id', authenticate, adminOnly, validate(userIdSchema), deleteUser);

export default router;