import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { 
  NotFoundError, 
  AuthorizationError, 
  ValidationError,
  FileUploadError,
  asyncHandler 
} from '../middleware/errorHandler';
import { UserRole } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';

// Helper function to determine media type
const getMediaType = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  return 'IMAGE'; // default
};

// Helper function to generate thumbnail
const generateThumbnail = async (filePath: string, mimeType: string): Promise<string | null> => {
  try {
    const thumbnailDir = path.join(process.env.UPLOAD_DIR || 'uploads', 'thumbnails');
    await fs.mkdir(thumbnailDir, { recursive: true });
    
    const filename = path.basename(filePath, path.extname(filePath));
    const thumbnailPath = path.join(thumbnailDir, `${filename}_thumb.jpg`);

    if (mimeType.startsWith('image/')) {
      await sharp(filePath)
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);
      return thumbnailPath;
    }

    if (mimeType.startsWith('video/')) {
      return new Promise((resolve, reject) => {
        ffmpeg(filePath)
          .screenshots({
            count: 1,
            folder: thumbnailDir,
            filename: `${filename}_thumb.jpg`,
            size: '200x200'
          })
          .on('end', () => resolve(thumbnailPath))
          .on('error', reject);
      });
    }

    return null;
  } catch (error) {
    logger.error('Thumbnail generation failed', { error, filePath });
    return null;
  }
};

// Get all media files
export const getMediaFiles = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 10, type, search } = req.query;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  // Build where clause
  const where: any = {};
  
  // Non-admin users can only see their own files
  if (currentUser.role !== UserRole.ADMIN) {
    where.userId = currentUser.id;
  }

  if (type) {
    where.mimeType = { startsWith: type as string };
  }

  if (search) {
    where.OR = [
      { filename: { contains: search as string, mode: 'insensitive' } },
      { originalName: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const [mediaFiles, total] = await Promise.all([
    prisma.mediaFile.findMany({
      where,
      skip,
      take,
      orderBy: { uploadedAt: 'desc' },
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
            jobs: true,
          },
        },
      },
    }),
    prisma.mediaFile.count({ where }),
  ]);

  const totalPages = Math.ceil(total / take);

  res.json({
    success: true,
    data: {
      mediaFiles,
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

// Get media file by ID
export const getMediaFileById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const mediaFile = await prisma.mediaFile.findUnique({
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
      jobs: {
        select: {
          id: true,
          type: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!mediaFile) {
    throw new NotFoundError('Media file not found');
  }

  // Check if user can access this file
  if (currentUser.role !== UserRole.ADMIN && mediaFile.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  res.json({
    success: true,
    data: { mediaFile },
  });
});

// Upload media file
export const uploadMediaFile = asyncHandler(async (req: Request, res: Response) => {
  const currentUser = req.user;
  const file = req.file;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  if (!file) {
    throw new FileUploadError('No file uploaded');
  }

  try {
    // Determine media type
    const mediaType = getMediaType(file.mimetype);
    
    // Generate thumbnail
    const thumbnailPath = await generateThumbnail(file.path, file.mimetype);
    const thumbnailUrl = thumbnailPath ? `/uploads/thumbnails/${path.basename(thumbnailPath)}` : null;

    // Get file duration for video/audio
    let duration: number | null = null;
    if (mediaType === 'VIDEO' || mediaType === 'AUDIO') {
      duration = await new Promise((resolve) => {
        ffmpeg.ffprobe(file.path, (err, metadata) => {
          if (err || !metadata.format.duration) {
            resolve(null);
          } else {
            resolve(Math.round(metadata.format.duration));
          }
        });
      });
    }

    // Create media file record
    const mediaFile = await prisma.mediaFile.create({
      data: {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: `/uploads/${file.filename}`,
        thumbnailUrl,
        type: mediaType,
        duration,
        userId: currentUser.id,
        metadata: {
          uploadedFrom: req.ip,
          userAgent: req.get('User-Agent'),
        },
      },
    });

    // Invalidate user's media cache
    await redis.del(`user_media:${currentUser.id}`);

    (logger as any).logFile('upload', file.originalname, file.size, undefined, undefined);

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: { mediaFile },
    });
  } catch (error) {
    // Clean up uploaded file on error
    try {
      await fs.unlink(file.path);
    } catch (unlinkError) {
      logger.error('Failed to clean up uploaded file', { error: unlinkError });
    }
    throw error;
  }
});

// Upload multiple media files
export const uploadMultipleMediaFiles = asyncHandler(async (req: Request, res: Response) => {
  const currentUser = req.user;
  const files = req.files as Express.Multer.File[];

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  if (!files || files.length === 0) {
    throw new FileUploadError('No files uploaded');
  }

  const uploadedFiles = [];
  const errors = [];

  for (const file of files) {
    try {
      const mediaType = getMediaType(file.mimetype);
      const thumbnailPath = await generateThumbnail(file.path, file.mimetype);
      const thumbnailUrl = thumbnailPath ? `/uploads/thumbnails/${path.basename(thumbnailPath)}` : null;

      let duration: number | null = null;
      if (mediaType === 'VIDEO' || mediaType === 'AUDIO') {
        duration = await new Promise((resolve) => {
          ffmpeg.ffprobe(file.path, (err, metadata) => {
            if (err || !metadata.format.duration) {
              resolve(null);
            } else {
              resolve(Math.round(metadata.format.duration));
            }
          });
        });
      }

      const mediaFile = await prisma.mediaFile.create({
        data: {
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: `/uploads/${file.filename}`,
          thumbnailUrl,
          type: mediaType,
          duration,
          userId: currentUser.id,
          metadata: {
            uploadedFrom: req.ip,
            userAgent: req.get('User-Agent'),
          },
        },
      });

      uploadedFiles.push(mediaFile);
      (logger as any).logFile('upload', file.originalname, file.size, undefined, undefined);
    } catch (error) {
      errors.push({
        filename: file.originalname,
        error: (error as Error).message,
      });
      
      // Clean up file on error
      try {
        await fs.unlink(file.path);
      } catch (unlinkError) {
        logger.error('Failed to clean up uploaded file', { error: unlinkError });
      }
    }
  }

  // Invalidate user's media cache
  await redis.del(`user_media:${currentUser.id}`);

  res.status(201).json({
    success: true,
    message: `${uploadedFiles.length} files uploaded successfully`,
    data: {
      uploadedFiles,
      errors: errors.length > 0 ? errors : undefined,
    },
  });
});

// Update media file metadata
export const updateMediaFile = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { originalName, metadata } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const mediaFile = await prisma.mediaFile.findUnique({
    where: { id },
  });

  if (!mediaFile) {
    throw new NotFoundError('Media file not found');
  }

  // Check if user can update this file
  if (currentUser.role !== UserRole.ADMIN && mediaFile.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  const updatedMediaFile = await prisma.mediaFile.update({
    where: { id },
    data: {
      ...(originalName && { originalName }),
      ...(metadata && { metadata }),
      updatedAt: new Date(),
    },
  });

  // Invalidate cache
  await redis.del(`media_file:${id}`);
  await redis.del(`user_media:${mediaFile.userId}`);

  res.json({
    success: true,
    message: 'Media file updated successfully',
    data: { mediaFile: updatedMediaFile },
  });
});

// Delete media file
export const deleteMediaFile = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const mediaFile = await prisma.mediaFile.findUnique({
    where: { id },
    include: {
      jobs: {
        where: {
          status: { in: ['PENDING', 'RUNNING'] },
        },
      },
    },
  });

  if (!mediaFile) {
    throw new NotFoundError('Media file not found');
  }

  // Check if user can delete this file
  if (currentUser.role !== UserRole.ADMIN && mediaFile.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  // Check if file is being used in active jobs
  if (mediaFile.jobs.length > 0) {
    throw new ValidationError('Cannot delete file that is being used in active jobs');
  }

  // Delete physical files
  try {
    const filePath = path.join(process.env.UPLOAD_DIR || 'uploads', mediaFile.filename);
    await fs.unlink(filePath);
    
    if (mediaFile.thumbnailUrl) {
      const thumbnailPath = path.join(process.cwd(), 'public', mediaFile.thumbnailUrl);
      await fs.unlink(thumbnailPath).catch(() => {}); // Ignore thumbnail deletion errors
    }
  } catch (error) {
    logger.warn('Failed to delete physical file', { error, filename: mediaFile.filename });
  }

  // Delete database record
  await prisma.mediaFile.delete({
    where: { id },
  });

  // Invalidate cache
  await redis.del(`media_file:${id}`);
  await redis.del(`user_media:${mediaFile.userId}`);

  (logger as any).logFile('delete', mediaFile.originalName, mediaFile.size, undefined, undefined);

  res.json({
    success: true,
    message: 'Media file deleted successfully',
  });
});

// Get media file statistics
export const getMediaStats = asyncHandler(async (req: Request, res: Response) => {
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const where = currentUser.role === UserRole.ADMIN ? {} : { userId: currentUser.id };

  const [typeStats, totalSize, totalCount, recentFiles] = await Promise.all([
    prisma.mediaFile.groupBy({
      by: ['type'],
      where,
      _count: { type: true },
      _sum: { size: true },
    }),
    prisma.mediaFile.aggregate({
      where,
      _sum: { size: true },
    }),
    prisma.mediaFile.count({ where }),
    prisma.mediaFile.findMany({
      where,
      take: 5,
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        filename: true,
        originalName: true,
        type: true,
        size: true,
        uploadedAt: true,
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      typeStats,
      totalSize: totalSize._sum.size || 0,
      totalCount,
      recentFiles,
    },
  });
});

// Download media file
export const downloadMediaFile = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  const mediaFile = await prisma.mediaFile.findUnique({
    where: { id },
  });

  if (!mediaFile) {
    throw new NotFoundError('Media file not found');
  }

  // Check if user can access this file
  if (currentUser.role !== UserRole.ADMIN && mediaFile.userId !== currentUser.id) {
    throw new AuthorizationError('Access denied');
  }

  const filePath = path.join(process.env.UPLOAD_DIR || 'uploads', mediaFile.filename);
  
  try {
    await fs.access(filePath);
    res.download(filePath, mediaFile.originalName);
  } catch (error) {
    throw new NotFoundError('Physical file not found');
  }
});