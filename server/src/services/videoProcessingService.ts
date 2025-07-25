import ffmpeg from 'fluent-ffmpeg';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';
import { faceDetectionService, FaceDetectionResult } from './faceDetectionService';
import { audioTranscriptionService, TranscriptionResult } from './audioTranscriptionService';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  format: string;
  hasAudio: boolean;
  audioCodec?: string;
  videoCodec: string;
  fileSize: number;
}

export interface VideoFrame {
  timestamp: number;
  frameNumber: number;
  imagePath: string;
  faces?: FaceDetectionResult;
}

export interface VideoProcessingResult {
  metadata: VideoMetadata;
  frames: VideoFrame[];
  transcription?: TranscriptionResult;
  processingTime: number;
  totalFrames: number;
  facesDetected: number;
}

export interface VideoProcessingOptions {
  extractFrames?: boolean;
  frameInterval?: number; // seconds
  maxFrames?: number;
  detectFaces?: boolean;
  transcribeAudio?: boolean;
  outputFormat?: 'jpg' | 'png';
  frameQuality?: number; // 1-100
}

class VideoProcessingService {
  private tempDir: string;
  private isInitialized = false;

  constructor() {
    this.tempDir = path.join(__dirname, '../../temp/video');
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Ensure temp directory exists
      await fs.mkdir(this.tempDir, { recursive: true });
      
      // Check FFmpeg availability
      await this.checkFFmpegAvailability();
      
      this.isInitialized = true;
      logger.info('Video processing service initialized');
    } catch (error) {
      logger.error('Failed to initialize video processing service:', error);
      throw error;
    }
  }

  private async checkFFmpegAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
          logger.warn('FFmpeg not available, using fallback methods');
          resolve(false);
        } else {
          logger.info('FFmpeg available with formats:', Object.keys(formats).length);
          resolve(true);
        }
      });
    });
  }

  async extractVideoMetadata(videoPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, async (err, metadata) => {
        if (err) {
          logger.error('Failed to extract video metadata:', err);
          reject(new Error(`Video metadata extraction failed: ${err.message}`));
          return;
        }

        try {
          const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
          const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
          
          if (!videoStream) {
            reject(new Error('No video stream found in file'));
            return;
          }

          // Get file size
          const stats = await fs.stat(videoPath);
          
          const videoMetadata: VideoMetadata = {
            duration: parseFloat(String(videoStream.duration || metadata.format.duration || '0')),
            width: videoStream.width || 0,
            height: videoStream.height || 0,
            fps: this.parseFPS(videoStream.r_frame_rate || videoStream.avg_frame_rate || '0'),
            bitrate: parseInt(String(metadata.format.bit_rate || '0')),
            format: metadata.format.format_name || 'unknown',
            hasAudio: !!audioStream,
            audioCodec: audioStream?.codec_name,
            videoCodec: videoStream.codec_name || 'unknown',
            fileSize: stats.size
          };

          resolve(videoMetadata);
        } catch (parseError) {
          reject(new Error(`Failed to parse video metadata: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`));
        }
      });
    });
  }

  private parseFPS(fpsString: string): number {
    try {
      if (fpsString.includes('/')) {
        const [num, den] = fpsString.split('/').map(Number);
        return den > 0 ? num / den : 0;
      }
      return parseFloat(fpsString) || 0;
    } catch {
      return 0;
    }
  }

  async extractFrames(
    videoPath: string, 
    options: VideoProcessingOptions = {}
  ): Promise<VideoFrame[]> {
    const {
      frameInterval = 1,
      maxFrames = 50,
      outputFormat = 'jpg',
      frameQuality = 80
    } = options;

    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const metadata = await this.extractVideoMetadata(videoPath);
      const frames: VideoFrame[] = [];
      
      // Calculate frame extraction parameters
      const totalDuration = metadata.duration;
      const frameCount = Math.min(maxFrames, Math.floor(totalDuration / frameInterval));
      
      logger.info(`Extracting ${frameCount} frames from video (${totalDuration}s duration)`);

      for (let i = 0; i < frameCount; i++) {
        const timestamp = i * frameInterval;
        const frameNumber = Math.floor(timestamp * metadata.fps);
        const outputPath = path.join(
          this.tempDir, 
          `frame_${Date.now()}_${i}.${outputFormat}`
        );

        try {
          await this.extractSingleFrame(videoPath, timestamp, outputPath, frameQuality);
          
          frames.push({
            timestamp,
            frameNumber,
            imagePath: outputPath
          });
        } catch (frameError) {
          logger.warn(`Failed to extract frame at ${timestamp}s:`, frameError);
        }
      }

      logger.info(`Successfully extracted ${frames.length} frames`);
      return frames;
    } catch (error) {
      logger.error('Frame extraction failed:', error);
      throw new Error(`Frame extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractSingleFrame(
    videoPath: string, 
    timestamp: number, 
    outputPath: string,
    quality: number = 80
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(timestamp)
        .frames(1)
        .outputOptions([
          '-q:v', quality.toString(),
          '-update', '1'
        ])
        .on('end', () => {
          resolve();
        })
        .on('error', (err) => {
          reject(new Error(`Frame extraction failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  async processVideo(
    videoPath: string, 
    options: VideoProcessingOptions = {}
  ): Promise<VideoProcessingResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info(`Starting video processing: ${videoPath}`);
      
      // Extract metadata
      const metadata = await this.extractVideoMetadata(videoPath);
      
      let frames: VideoFrame[] = [];
      let transcription: TranscriptionResult | undefined;
      let totalFacesDetected = 0;

      // Extract frames if requested
      if (options.extractFrames !== false) {
        frames = await this.extractFrames(videoPath, options);
        
        // Detect faces in frames if requested
        if (options.detectFaces) {
          for (const frame of frames) {
            try {
              const faceResult = await faceDetectionService.detectFaces(frame.imagePath);
              frame.faces = faceResult;
              totalFacesDetected += faceResult.totalFaces;
            } catch (faceError) {
              logger.warn(`Face detection failed for frame ${frame.frameNumber}:`, faceError);
            }
          }
        }
      }

      // Transcribe audio if requested and available
      if (options.transcribeAudio && metadata.hasAudio) {
        try {
          transcription = await audioTranscriptionService.transcribeVideo(videoPath);
        } catch (transcriptionError) {
          logger.warn('Audio transcription failed:', transcriptionError);
        }
      }

      const processingTime = Date.now() - startTime;
      
      const result: VideoProcessingResult = {
        metadata,
        frames,
        transcription,
        processingTime,
        totalFrames: frames.length,
        facesDetected: totalFacesDetected
      };

      logger.info(`Video processing completed in ${processingTime}ms`);
      return result;
    } catch (error) {
      logger.error('Video processing failed:', error);
      throw new Error(`Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async convertVideo(
    inputPath: string, 
    outputPath: string, 
    options: {
      format?: string;
      quality?: 'low' | 'medium' | 'high';
      resolution?: string; // e.g., '1280x720'
      fps?: number;
    } = {}
  ): Promise<void> {
    const { format = 'mp4', quality = 'medium', resolution, fps } = options;
    
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);
      
      // Set quality presets
      switch (quality) {
        case 'low':
          command = command.videoBitrate('500k').audioBitrate('64k');
          break;
        case 'high':
          command = command.videoBitrate('2000k').audioBitrate('192k');
          break;
        default: // medium
          command = command.videoBitrate('1000k').audioBitrate('128k');
      }
      
      // Set resolution if specified
      if (resolution) {
        command = command.size(resolution);
      }
      
      // Set FPS if specified
      if (fps) {
        command = command.fps(fps);
      }
      
      command
        .format(format)
        .on('progress', (progress) => {
          logger.debug(`Conversion progress: ${progress.percent}%`);
        })
        .on('end', () => {
          logger.info(`Video conversion completed: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          logger.error('Video conversion failed:', err);
          reject(new Error(`Video conversion failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  async createVideoThumbnail(
    videoPath: string, 
    outputPath: string, 
    timestamp: number = 1
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(timestamp)
        .frames(1)
        .size('320x240')
        .on('end', () => {
          logger.info(`Thumbnail created: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          logger.error('Thumbnail creation failed:', err);
          reject(new Error(`Thumbnail creation failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  async batchProcessVideos(
    videoPaths: string[], 
    options: VideoProcessingOptions = {}
  ): Promise<VideoProcessingResult[]> {
    const results: VideoProcessingResult[] = [];
    
    for (const videoPath of videoPaths) {
      try {
        const result = await this.processVideo(videoPath, options);
        results.push(result);
        logger.info(`Processed video: ${videoPath}`);
      } catch (error) {
        logger.error(`Failed to process video ${videoPath}:`, error);
        // Add error result
        results.push({
          metadata: {
            duration: 0,
            width: 0,
            height: 0,
            fps: 0,
            bitrate: 0,
            format: 'unknown',
            hasAudio: false,
            videoCodec: 'unknown',
            fileSize: 0
          },
          frames: [],
          processingTime: 0,
          totalFrames: 0,
          facesDetected: 0
        });
      }
    }
    
    return results;
  }

  async cleanupTempFiles(olderThanHours: number = 24): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          logger.debug(`Cleaned up temp file: ${file}`);
        }
      }
      
      logger.info(`Cleaned up temporary files older than ${olderThanHours} hours`);
    } catch (error) {
      logger.error('Failed to cleanup temp files:', error);
    }
  }

  async getVideoInfo(videoPath: string): Promise<{
    isValid: boolean;
    metadata?: VideoMetadata;
    error?: string;
  }> {
    try {
      const metadata = await this.extractVideoMetadata(videoPath);
      return {
        isValid: true,
        metadata
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const videoProcessingService = new VideoProcessingService();
export default videoProcessingService;