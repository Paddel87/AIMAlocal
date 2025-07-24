import { Router } from 'express';
import {
  detectFaces,
  transcribeAudio,
  recognizeFaces,
  processBatch,
  getAnalysisResults,
  getMLStatus
} from '../controllers/mlController';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

// Validation schemas
const batchProcessingSchema = z.object({
  body: z.object({
    mediaIds: z.array(z.string().uuid()).min(1).max(50),
    operations: z.array(z.enum(['face_detection', 'transcription', 'face_recognition'])).min(1)
  })
});

const transcriptionQuerySchema = z.object({
  query: z.object({
    language: z.string().optional()
  })
});

const recognitionQuerySchema = z.object({
  query: z.object({
    threshold: z.string().regex(/^0\.[0-9]+$|^1\.0$/).optional()
  })
});

const analysisQuerySchema = z.object({
  query: z.object({
    type: z.enum(['FACE_DETECTION', 'TRANSCRIPTION', 'FACE_RECOGNITION']).optional()
  })
});

// Face Detection Routes
/**
 * @route POST /api/ml/faces/detect/:mediaId
 * @desc Detect faces in an image or video
 * @access Private
 */
router.post('/faces/detect/:mediaId', authenticate, detectFaces);

/**
 * @route POST /api/ml/faces/recognize/:mediaId
 * @desc Recognize faces against person dossiers
 * @access Private
 */
router.post(
  '/faces/recognize/:mediaId',
  authenticate,
  validate(recognitionQuerySchema),
  recognizeFaces
);

// Audio Transcription Routes
/**
 * @route POST /api/ml/transcribe/:mediaId
 * @desc Transcribe audio from audio or video file
 * @access Private
 */
router.post(
  '/transcribe/:mediaId',
  authenticate,
  validate(transcriptionQuerySchema),
  transcribeAudio
);

// Batch Processing Routes
/**
 * @route POST /api/ml/batch
 * @desc Process multiple media files with specified operations
 * @access Private
 */
router.post(
  '/batch',
  authenticate,
  validate(batchProcessingSchema),
  processBatch
);

// Analysis Results Routes
/**
 * @route GET /api/ml/results/:mediaId
 * @desc Get analysis results for a media file
 * @access Private
 */
router.get(
  '/results/:mediaId',
  authenticate,
  validate(analysisQuerySchema),
  getAnalysisResults
);

// ML Pipeline Status
/**
 * @route GET /api/ml/status
 * @desc Get ML pipeline status and statistics
 * @access Private
 */
router.get('/status', authenticate, getMLStatus);

// Admin Routes
/**
 * @route GET /api/ml/admin/stats
 * @desc Get system-wide ML statistics (Admin only)
 * @access Admin
 */
router.get('/admin/stats', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { prisma } = require('../config/database');
    
    // Get system-wide statistics
    const totalAnalyses = await prisma.analysisResult.count();
    const analysesByType = await prisma.analysisResult.groupBy({
      by: ['type'],
      _count: { id: true },
      _avg: { confidence: true, processingTime: true }
    });
    
    const totalJobs = await prisma.job.count({
      where: {
        type: {
          in: ['FACE_DETECTION', 'TRANSCRIPTION', 'BATCH_PROCESSING']
        }
      }
    });
    
    const jobsByStatus = await prisma.job.groupBy({
      by: ['status'],
      where: {
        type: {
          in: ['FACE_DETECTION', 'TRANSCRIPTION', 'BATCH_PROCESSING']
        }
      },
      _count: { id: true }
    });
    
    // Get recent activity
    const recentAnalyses = await prisma.analysisResult.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        mediaFile: {
          select: {
            filename: true,
            type: true,
            user: {
              select: {
                email: true
              }
            }
          }
        }
      }
    });
    
    res.json({
      success: true,
      data: {
        overview: {
          totalAnalyses,
          totalJobs,
          analysesByType,
          jobsByStatus
        },
        recentActivity: recentAnalyses
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get admin statistics'
    });
  }
});

export default router;