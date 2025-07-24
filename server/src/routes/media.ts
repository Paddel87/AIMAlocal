import { Router } from 'express';
import multer from 'multer';
import {
  getMediaFiles,
  getMediaFileById,
  uploadMediaFile,
  uploadMultipleMediaFiles,
  updateMediaFile,
  deleteMediaFile,
  downloadMediaFile,
  getMediaStats,
} from '../controllers/mediaController';
import { authenticate, selfOrAdmin } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { z } from 'zod';
// MediaType enum removed - using string literals instead
import path from 'path';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow images, videos, and audio files
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv',
    'video/flv',
    'video/webm',
    'audio/mp3',
    'audio/wav',
    'audio/flac',
    'audio/aac',
    'audio/ogg',
    'audio/mpeg',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, videos, and audio files are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
});

// Validation schemas
const getMediaFilesSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    search: z.string().optional(),
    type: z.enum(['image', 'video', 'audio']).optional(),
    userId: z.string().uuid().optional(),
  }),
});

const updateMediaFileSchema = z.object({
  body: z.object({
    filename: z.string().min(1).optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

const mediaFileIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid media file ID'),
  }),
});

const uploadSingleSchema = z.object({
  body: z.object({
    description: z.string().optional(),
    tags: z.string().optional(), // Will be parsed as JSON
    metadata: z.string().optional(), // Will be parsed as JSON
  }),
});

const uploadMultipleSchema = z.object({
  body: z.object({
    descriptions: z.string().optional(), // Will be parsed as JSON array
    tags: z.string().optional(), // Will be parsed as JSON
    metadata: z.string().optional(), // Will be parsed as JSON
  }),
});

// Routes
router.get('/', authenticate, validate(getMediaFilesSchema), getMediaFiles);
router.get('/stats', authenticate, getMediaStats);
router.get('/:id', authenticate, validate(mediaFileIdSchema), getMediaFileById);
router.get('/:id/download', authenticate, validate(mediaFileIdSchema), downloadMediaFile);

router.post('/upload/single', 
  authenticate, 
  upload.single('file'), 
  validate(uploadSingleSchema), 
  uploadMediaFile
);

router.post('/upload/multiple', 
  authenticate, 
  upload.array('files', 10), // Max 10 files
  validate(uploadMultipleSchema), 
  uploadMultipleMediaFiles
);

router.put('/:id', 
  authenticate, 
  selfOrAdmin, 
  validate(mediaFileIdSchema.merge(updateMediaFileSchema)), 
  updateMediaFile
);

router.delete('/:id', 
  authenticate, 
  selfOrAdmin, 
  validate(mediaFileIdSchema), 
  deleteMediaFile
);

export default router;