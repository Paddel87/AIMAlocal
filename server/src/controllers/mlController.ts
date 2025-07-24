import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { 
  NotFoundError, 
  ValidationError,
  FileUploadError,
  asyncHandler 
} from '../middleware/errorHandler';
import { faceDetectionService, FaceDetectionResult } from '../services/faceDetectionService';
import { audioTranscriptionService, TranscriptionResult } from '../services/audioTranscriptionService';
import { JobStatus, JobType } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';

// Face Detection API
export const detectFaces = asyncHandler(async (req: Request, res: Response) => {
  const { mediaId } = req.params;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  // Get media file from database
  const mediaFile = await prisma.mediaFile.findUnique({
    where: { id: mediaId },
    include: { user: true }
  });

  if (!mediaFile) {
    throw new NotFoundError('Media file not found');
  }

  // Check if user has access to this media file
  if (mediaFile.userId !== currentUser.id && currentUser.role !== 'ADMIN') {
    throw new NotFoundError('Access denied');
  }

  // Check if it's an image or video
  if (!['IMAGE', 'VIDEO'].includes(mediaFile.type)) {
    throw new ValidationError('Face detection only supports images and videos');
  }

  try {
    let result: FaceDetectionResult | FaceDetectionResult[];
    
    if (mediaFile.type === 'IMAGE') {
      // Detect faces in image
      result = await faceDetectionService.detectFaces(mediaFile.filePath);
    } else {
      // Process video frames
      result = await faceDetectionService.processVideoFrames(mediaFile.filePath);
    }

    // Store results in database
    const analysisResult = await prisma.analysisResult.create({
      data: {
        mediaFileId: mediaFile.id,
        type: 'FACE_DETECTION',
        result: JSON.stringify(result),
        confidence: Array.isArray(result) 
          ? result.reduce((sum, r) => sum + r.faces.length, 0) / result.length
          : result.faces.reduce((sum, f) => sum + f.confidence, 0) / result.faces.length || 0,
        processingTime: Array.isArray(result)
          ? result.reduce((sum, r) => sum + r.processingTime, 0)
          : result.processingTime
      }
    });

    // Cache result in Redis for quick access
    await redis.setex(
      `face_detection:${mediaId}`,
      3600, // 1 hour
      JSON.stringify(result)
    );

    logger.info(`Face detection completed for media ${mediaId}`);

    res.json({
      success: true,
      data: {
        analysisId: analysisResult.id,
        result,
        mediaFile: {
          id: mediaFile.id,
          filename: mediaFile.filename,
          type: mediaFile.type
        }
      }
    });
  } catch (error) {
    logger.error('Face detection failed:', error);
    throw new ValidationError(`Face detection failed: ${error.message}`);
  }
});

// Audio Transcription API
export const transcribeAudio = asyncHandler(async (req: Request, res: Response) => {
  const { mediaId } = req.params;
  const { language } = req.query;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  // Get media file from database
  const mediaFile = await prisma.mediaFile.findUnique({
    where: { id: mediaId },
    include: { user: true }
  });

  if (!mediaFile) {
    throw new NotFoundError('Media file not found');
  }

  // Check if user has access to this media file
  if (mediaFile.userId !== currentUser.id && currentUser.role !== 'ADMIN') {
    throw new NotFoundError('Access denied');
  }

  // Check if it's an audio or video file
  if (!['AUDIO', 'VIDEO'].includes(mediaFile.type)) {
    throw new ValidationError('Transcription only supports audio and video files');
  }

  try {
    let result: TranscriptionResult;
    
    if (mediaFile.type === 'AUDIO') {
      // Transcribe audio file
      result = await audioTranscriptionService.transcribeAudio(
        mediaFile.filePath, 
        language as string
      );
    } else {
      // Extract and transcribe audio from video
      result = await audioTranscriptionService.transcribeVideo(
        mediaFile.filePath, 
        language as string
      );
    }

    // Store results in database
    const analysisResult = await prisma.analysisResult.create({
      data: {
        mediaFileId: mediaFile.id,
        type: 'TRANSCRIPTION',
        result: JSON.stringify(result),
        confidence: result.confidence,
        processingTime: result.processingTime
      }
    });

    // Cache result in Redis
    await redis.setex(
      `transcription:${mediaId}`,
      3600, // 1 hour
      JSON.stringify(result)
    );

    logger.info(`Audio transcription completed for media ${mediaId}`);

    res.json({
      success: true,
      data: {
        analysisId: analysisResult.id,
        result,
        mediaFile: {
          id: mediaFile.id,
          filename: mediaFile.filename,
          type: mediaFile.type
        }
      }
    });
  } catch (error) {
    logger.error('Audio transcription failed:', error);
    throw new ValidationError(`Audio transcription failed: ${error.message}`);
  }
});

// Face Recognition (match against person dossiers)
export const recognizeFaces = asyncHandler(async (req: Request, res: Response) => {
  const { mediaId } = req.params;
  const { threshold = 0.6 } = req.query;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  // Get media file
  const mediaFile = await prisma.mediaFile.findUnique({
    where: { id: mediaId }
  });

  if (!mediaFile) {
    throw new NotFoundError('Media file not found');
  }

  // Check access
  if (mediaFile.userId !== currentUser.id && currentUser.role !== 'ADMIN') {
    throw new NotFoundError('Access denied');
  }

  try {
    // First detect faces
    const faceDetection = await faceDetectionService.detectFaces(mediaFile.filePath);
    
    if (faceDetection.faces.length === 0) {
      return res.json({
        success: true,
        data: {
          faces: [],
          matches: [],
          totalFaces: 0
        }
      });
    }

    // Get all person dossiers for comparison
    const persons = await prisma.person.findMany({
      where: { userId: currentUser.id },
      include: { faceEncodings: true }
    });

    const matches = [];
    
    for (const face of faceDetection.faces) {
      // Extract face encoding
      const faceEncoding = await faceDetectionService.extractFaceEncoding(
        mediaFile.filePath,
        face
      );

      let bestMatch = null;
      let bestSimilarity = 0;

      // Compare with known persons
      for (const person of persons) {
        for (const knownEncoding of person.faceEncodings) {
          const similarity = await faceDetectionService.compareFaces(
            faceEncoding,
            JSON.parse(knownEncoding.encoding),
            Number(threshold)
          );

          if (similarity > bestSimilarity && similarity > Number(threshold)) {
            bestSimilarity = similarity;
            bestMatch = {
              personId: person.id,
              personName: person.name,
              similarity,
              confidence: similarity
            };
          }
        }
      }

      matches.push({
        face,
        match: bestMatch,
        encoding: faceEncoding
      });
    }

    // Store recognition results
    const analysisResult = await prisma.analysisResult.create({
      data: {
        mediaFileId: mediaFile.id,
        type: 'FACE_RECOGNITION',
        result: JSON.stringify({ faces: faceDetection.faces, matches }),
        confidence: matches.reduce((sum, m) => sum + (m.match?.confidence || 0), 0) / matches.length || 0,
        processingTime: faceDetection.processingTime
      }
    });

    logger.info(`Face recognition completed for media ${mediaId}`);

    res.json({
      success: true,
      data: {
        analysisId: analysisResult.id,
        faces: faceDetection.faces,
        matches,
        totalFaces: faceDetection.totalFaces,
        recognizedFaces: matches.filter(m => m.match).length
      }
    });
  } catch (error) {
    logger.error('Face recognition failed:', error);
    throw new ValidationError(`Face recognition failed: ${error.message}`);
  }
});

// Batch Processing API
export const processBatch = asyncHandler(async (req: Request, res: Response) => {
  const { mediaIds, operations } = req.body;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
    throw new ValidationError('Media IDs array is required');
  }

  if (!Array.isArray(operations) || operations.length === 0) {
    throw new ValidationError('Operations array is required');
  }

  try {
    // Create a batch job
    const batchJob = await prisma.job.create({
      data: {
        userId: currentUser.id,
        type: 'BATCH_PROCESSING',
        status: 'PENDING',
        metadata: JSON.stringify({
          mediaIds,
          operations,
          totalFiles: mediaIds.length
        })
      }
    });

    // Process in background (you might want to use a job queue here)
    setImmediate(async () => {
      try {
        await prisma.job.update({
          where: { id: batchJob.id },
          data: { status: 'PROCESSING', startedAt: new Date() }
        });

        const results = [];
        
        for (const mediaId of mediaIds) {
          const mediaFile = await prisma.mediaFile.findUnique({
            where: { id: mediaId }
          });

          if (!mediaFile || (mediaFile.userId !== currentUser.id && currentUser.role !== 'ADMIN')) {
            continue;
          }

          for (const operation of operations) {
            try {
              let result;
              
              switch (operation) {
                case 'face_detection':
                  if (['IMAGE', 'VIDEO'].includes(mediaFile.type)) {
                    result = await faceDetectionService.detectFaces(mediaFile.filePath);
                  }
                  break;
                  
                case 'transcription':
                  if (['AUDIO', 'VIDEO'].includes(mediaFile.type)) {
                    result = mediaFile.type === 'AUDIO'
                      ? await audioTranscriptionService.transcribeAudio(mediaFile.filePath)
                      : await audioTranscriptionService.transcribeVideo(mediaFile.filePath);
                  }
                  break;
              }

              if (result) {
                await prisma.analysisResult.create({
                  data: {
                    mediaFileId: mediaFile.id,
                    type: operation.toUpperCase(),
                    result: JSON.stringify(result),
                    confidence: Array.isArray(result) ? 0.8 : (result as any).confidence || 0.8,
                    processingTime: Array.isArray(result) ? 1000 : (result as any).processingTime || 1000
                  }
                });

                results.push({
                  mediaId: mediaFile.id,
                  operation,
                  success: true,
                  result
                });
              }
            } catch (error) {
              logger.error(`Batch operation ${operation} failed for media ${mediaId}:`, error);
              results.push({
                mediaId: mediaFile.id,
                operation,
                success: false,
                error: error.message
              });
            }
          }
        }

        // Update job with results
        await prisma.job.update({
          where: { id: batchJob.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            result: JSON.stringify({
              processedFiles: results.length,
              successfulOperations: results.filter(r => r.success).length,
              failedOperations: results.filter(r => !r.success).length,
              results
            })
          }
        });

        logger.info(`Batch job ${batchJob.id} completed successfully`);
      } catch (error) {
        logger.error(`Batch job ${batchJob.id} failed:`, error);
        await prisma.job.update({
          where: { id: batchJob.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            error: error.message
          }
        });
      }
    });

    res.json({
      success: true,
      data: {
        jobId: batchJob.id,
        status: 'PENDING',
        message: 'Batch processing started',
        totalFiles: mediaIds.length,
        operations
      }
    });
  } catch (error) {
    logger.error('Batch processing failed:', error);
    throw new ValidationError(`Batch processing failed: ${error.message}`);
  }
});

// Get Analysis Results
export const getAnalysisResults = asyncHandler(async (req: Request, res: Response) => {
  const { mediaId } = req.params;
  const { type } = req.query;
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  // Get media file to check access
  const mediaFile = await prisma.mediaFile.findUnique({
    where: { id: mediaId }
  });

  if (!mediaFile) {
    throw new NotFoundError('Media file not found');
  }

  if (mediaFile.userId !== currentUser.id && currentUser.role !== 'ADMIN') {
    throw new NotFoundError('Access denied');
  }

  // Build query
  const whereClause: any = { mediaFileId: mediaId };
  if (type) {
    whereClause.type = (type as string).toUpperCase();
  }

  const results = await prisma.analysisResult.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      mediaFile: {
        select: {
          id: true,
          filename: true,
          type: true
        }
      }
    }
  });

  res.json({
    success: true,
    data: results.map(result => ({
      ...result,
      result: JSON.parse(result.result)
    }))
  });
});

// ML Pipeline Status
export const getMLStatus = asyncHandler(async (req: Request, res: Response) => {
  const currentUser = req.user;

  if (!currentUser) {
    throw new NotFoundError('User not authenticated');
  }

  try {
    // Get processing statistics
    const stats = await prisma.analysisResult.groupBy({
      by: ['type'],
      where: {
        mediaFile: {
          userId: currentUser.id
        }
      },
      _count: {
        id: true
      },
      _avg: {
        confidence: true,
        processingTime: true
      }
    });

    // Get recent jobs
    const recentJobs = await prisma.job.findMany({
      where: {
        userId: currentUser.id,
        type: {
          in: ['FACE_DETECTION', 'TRANSCRIPTION', 'BATCH_PROCESSING']
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    res.json({
      success: true,
      data: {
        statistics: stats,
        recentJobs,
        services: {
          faceDetection: 'available',
          audioTranscription: 'available',
          batchProcessing: 'available'
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get ML status:', error);
    throw new ValidationError(`Failed to get ML status: ${error.message}`);
  }
});