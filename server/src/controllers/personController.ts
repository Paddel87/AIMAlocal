import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { 
  NotFoundError, 
  AuthorizationError, 
  ValidationError,
  asyncHandler 
} from '../middleware/errorHandler';
import { UserRole } from '@prisma/client';

// Get all person dossiers
export const getPersonDossiers = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 10, search, userId } = req.query;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  // Build where clause
  const where: any = {};
  
  // Non-admin users can only see their own dossiers
  if (currentUser.role !== UserRole.ADMIN) {
    where.userId = currentUser.id;
  } else if (userId) {
    where.userId = userId as string;
  }

  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const [dossiers, total] = await Promise.all([
    prisma.personDossier.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            recognitions: true,
            transcriptions: true,
          },
        },
      },
    }),
    prisma.personDossier.count({ where }),
  ]);

  const totalPages = Math.ceil(total / take);

  res.json({
    success: true,
    data: {
      dossiers,
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

// Get person dossier by ID
export const getPersonDossierById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const dossier = await prisma.personDossier.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      recognitions: {
        include: {
          mediaFile: {
            select: {
              id: true,
              filename: true,
              originalName: true,
              url: true,
              thumbnailUrl: true,
            },
          },
        },
        orderBy: { detectedAt: 'desc' },
      },
      transcriptions: {
        include: {
          mediaFile: {
            select: {
              id: true,
              filename: true,
              originalName: true,
              url: true,
            },
          },
        },
        orderBy: { detectedAt: 'desc' },
      },
    },
  });

  if (!dossier) {
    throw new NotFoundError('Person dossier not found');
  }

  // Check if user can access this dossier
  if (currentUser.role !== UserRole.ADMIN && dossier.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  res.json({
    success: true,
    data: { dossier },
  });
});

// Create new person dossier
export const createPersonDossier = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, knownAliases, referenceImageUrl, metadata } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  // Check if person with same name already exists for this user
  const existingDossier = await prisma.personDossier.findFirst({
    where: {
      name,
      userId: currentUser.id,
    },
  });

  if (existingDossier) {
    throw new ValidationError('Person dossier with this name already exists');
  }

  const dossier = await prisma.personDossier.create({
    data: {
      name,
      description,
      knownAliases,
      referenceImageUrl,
      metadata,
      userId: currentUser.id,
    },
  });

  // Invalidate cache
  await redis.del(`user_dossiers:${currentUser.id}`);

  logger.info('Person dossier created', {
    dossierId: dossier.id,
    name,
    userId: currentUser.id,
  });

  res.status(201).json({
    success: true,
    message: 'Person dossier created successfully',
    data: { dossier },
  });
});

// Update person dossier
export const updatePersonDossier = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, knownAliases, referenceImageUrl, metadata } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const dossier = await prisma.personDossier.findUnique({
    where: { id },
  });

  if (!dossier) {
    throw new NotFoundError('Person dossier not found');
  }

  // Check if user can update this dossier
  if (currentUser.role !== UserRole.ADMIN && dossier.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  // Check if name is being changed and if it conflicts
  if (name && name !== dossier.name) {
    const existingDossier = await prisma.personDossier.findFirst({
      where: {
        name,
        userId: currentUser.id,
        id: { not: id },
      },
    });

    if (existingDossier) {
      throw new ValidationError('Person dossier with this name already exists');
    }
  }

  const updatedDossier = await prisma.personDossier.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(knownAliases && { knownAliases }),
      ...(referenceImageUrl !== undefined && { referenceImageUrl }),
      ...(metadata && { metadata }),
      updatedAt: new Date(),
    },
  });

  // Invalidate cache
  await redis.del(`person_dossier:${id}`);
  await redis.del(`user_dossiers:${dossier.userId}`);

  res.json({
    success: true,
    message: 'Person dossier updated successfully',
    data: { dossier: updatedDossier },
  });
});

// Delete person dossier
export const deletePersonDossier = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const dossier = await prisma.personDossier.findUnique({
    where: { id },
    include: {
      recognitions: true,
      transcriptions: true,
    },
  });

  if (!dossier) {
    throw new NotFoundError('Person dossier not found');
  }

  // Check if user can delete this dossier
  if (currentUser.role !== UserRole.ADMIN && dossier.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  // Delete dossier and related data (cascade delete)
  await prisma.personDossier.delete({
    where: { id },
  });

  // Invalidate cache
  await redis.del(`person_dossier:${id}`);
  await redis.del(`user_dossiers:${dossier.userId}`);

  logger.info('Person dossier deleted', {
    dossierId: id,
    name: dossier.name,
    userId: dossier.userId,
  });

  res.json({
    success: true,
    message: 'Person dossier deleted successfully',
  });
});

// Get person recognitions
export const getPersonRecognitions = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { page = 1, limit = 10, minConfidence = 0 } = req.query;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const dossier = await prisma.personDossier.findUnique({
    where: { id },
  });

  if (!dossier) {
    throw new NotFoundError('Person dossier not found');
  }

  // Check access
  if (currentUser.role !== UserRole.ADMIN && dossier.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const [recognitions, total] = await Promise.all([
    prisma.personRecognition.findMany({
      where: {
        personDossierId: id,
        confidence: {
          gte: Number(minConfidence),
        },
      },
      skip,
      take,
      orderBy: { detectedAt: 'desc' },
      include: {
        mediaFile: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            url: true,
            thumbnailUrl: true,
            type: true,
          },
        },
      },
    }),
    prisma.personRecognition.count({
      where: {
        personDossierId: id,
        confidence: {
          gte: Number(minConfidence),
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / take);

  res.json({
    success: true,
    data: {
      recognitions,
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

// Get person transcriptions
export const getPersonTranscriptions = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { page = 1, limit = 10, minConfidence = 0 } = req.query;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const dossier = await prisma.personDossier.findUnique({
    where: { id },
  });

  if (!dossier) {
    throw new NotFoundError('Person dossier not found');
  }

  // Check access
  if (currentUser.role !== UserRole.ADMIN && dossier.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const [transcriptions, total] = await Promise.all([
    prisma.personTranscription.findMany({
      where: {
        personDossierId: id,
        confidence: {
          gte: Number(minConfidence),
        },
      },
      skip,
      take,
      orderBy: { detectedAt: 'desc' },
      include: {
        mediaFile: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            url: true,
            type: true,
            duration: true,
          },
        },
      },
    }),
    prisma.personTranscription.count({
      where: {
        personDossierId: id,
        confidence: {
          gte: Number(minConfidence),
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / take);

  res.json({
    success: true,
    data: {
      transcriptions,
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

// Search across all person data
export const searchPersons = asyncHandler(async (req: Request, res: Response) => {
  const { q, type = 'all', page = 1, limit = 10 } = req.query;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  if (!q || (q as string).length < 2) {
    throw new ValidationError('Search query must be at least 2 characters');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);
  const searchTerm = q as string;

  const where = currentUser.role === UserRole.ADMIN ? {} : { userId: currentUser.id };

  let results: any = {};

  if (type === 'all' || type === 'dossiers') {
    const [dossiers, dossiersTotal] = await Promise.all([
      prisma.personDossier.findMany({
        where: {
          ...where,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { knownAliases: { has: searchTerm } },
          ],
        },
        skip: type === 'dossiers' ? skip : 0,
        take: type === 'dossiers' ? take : 5,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              recognitions: true,
              transcriptions: true,
            },
          },
        },
      }),
      prisma.personDossier.count({
        where: {
          ...where,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { knownAliases: { has: searchTerm } },
          ],
        },
      }),
    ]);
    results.dossiers = { items: dossiers, total: dossiersTotal };
  }

  if (type === 'all' || type === 'transcriptions') {
    const dossiersForTranscription = await prisma.personDossier.findMany({
      where,
      select: { id: true },
    });
    
    const dossierIds = dossiersForTranscription.map(d => d.id);
    
    const [transcriptions, transcriptionsTotal] = await Promise.all([
      prisma.personTranscription.findMany({
        where: {
          personDossierId: { in: dossierIds },
          OR: [
            { text: { contains: searchTerm, mode: 'insensitive' } },
            { speakerLabel: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        skip: type === 'transcriptions' ? skip : 0,
        take: type === 'transcriptions' ? take : 5,
        orderBy: { detectedAt: 'desc' },
        include: {
          personDossier: {
            select: {
              id: true,
              name: true,
            },
          },
          mediaFile: {
            select: {
              id: true,
              filename: true,
              originalName: true,
            },
          },
        },
      }),
      prisma.personTranscription.count({
        where: {
          personDossierId: { in: dossierIds },
          OR: [
            { text: { contains: searchTerm, mode: 'insensitive' } },
            { speakerLabel: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
      }),
    ]);
    results.transcriptions = { items: transcriptions, total: transcriptionsTotal };
  }

  const totalResults = Object.values(results).reduce((sum: number, result: any) => sum + result.total, 0);

  res.json({
    success: true,
    data: {
      results,
      query: searchTerm,
      type,
      totalResults,
      pagination: {
        page: Number(page),
        limit: take,
      },
    },
  });
});

// Get person statistics
export const getPersonStats = asyncHandler(async (req: Request, res: Response) => {
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const where = currentUser.role === UserRole.ADMIN ? {} : { userId: currentUser.id };

  const [totalDossiers, totalRecognitions, totalTranscriptions, recentActivity] = await Promise.all([
    prisma.personDossier.count({ where }),
    prisma.personRecognition.count({
      where: {
        personDossier: where,
      },
    }),
    prisma.personTranscription.count({
      where: {
        personDossier: where,
      },
    }),
    prisma.personDossier.findMany({
      where,
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        _count: {
          select: {
            recognitions: true,
            transcriptions: true,
          },
        },
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      totalDossiers,
      totalRecognitions,
      totalTranscriptions,
      recentActivity,
    },
  });
});