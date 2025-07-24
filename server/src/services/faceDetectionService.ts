import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

export interface FaceDetectionResult {
  faces: {
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    encoding?: number[];
  }[];
  totalFaces: number;
  processingTime: number;
}

export interface FaceRecognitionResult {
  personId?: string;
  confidence: number;
  isNewPerson: boolean;
  encoding: number[];
}

class FaceDetectionService {
  private faceRecognitionModel: tf.LayersModel | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize TensorFlow.js
      await tf.ready();
      
      this.isInitialized = true;
      logger.info('Face detection service initialized');
    } catch (error) {
      logger.error('Failed to initialize face detection service:', error);
      throw error;
    }
  }

  async detectFaces(imagePath: string): Promise<FaceDetectionResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Use basic face detection for now
      const faces = await this.basicFaceDetection(imagePath);
      const processingTime = Date.now() - startTime;

      logger.info(`Detected ${faces.length} faces in ${processingTime}ms`);

      return {
        faces,
        totalFaces: faces.length,
        processingTime
      };
    } catch (error) {
      logger.error('Face detection failed:', error);
      throw new Error(`Face detection failed: ${error.message}`);
    }
  }

  private async basicFaceDetection(imagePath: string): Promise<any[]> {
    try {
      // Get image metadata
      const metadata = await sharp(imagePath).metadata();
      const { width = 640, height = 480 } = metadata;
      
      // For demonstration, create mock face detections
      // In a real implementation, this would use a proper face detection model
      const mockFaces = [];
      
      // Generate 1-3 random face detections for demo purposes
      const numFaces = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < numFaces; i++) {
        const faceWidth = Math.floor(Math.random() * 100) + 80; // 80-180px
        const faceHeight = Math.floor(faceWidth * 1.2); // Slightly taller than wide
        
        const x = Math.floor(Math.random() * (width - faceWidth));
        const y = Math.floor(Math.random() * (height - faceHeight));
        
        mockFaces.push({
          x,
          y,
          width: faceWidth,
          height: faceHeight,
          confidence: 0.7 + Math.random() * 0.3 // 0.7-1.0
        });
      }
      
      return mockFaces;
    } catch (error) {
      logger.warn('Basic face detection failed:', error);
      return [];
    }
  }

  async extractFaceEncoding(imagePath: string, faceRect: { x: number; y: number; width: number; height: number }): Promise<number[]> {
    try {
      // Extract face region using Sharp
      const faceBuffer = await sharp(imagePath)
        .extract({
          left: faceRect.x,
          top: faceRect.y,
          width: faceRect.width,
          height: faceRect.height
        })
        .resize(128, 128)
        .raw()
        .toBuffer();

      // Convert to tensor and create a simple encoding
      const tensor = tf.tensor3d(new Uint8Array(faceBuffer), [128, 128, 3]);
      const normalized = tensor.div(255.0);
      
      // Create a simple 128-dimensional encoding by averaging regions
      const encoding = [];
      const regionSize = 16; // 128/8 = 16x16 regions
      
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const region = normalized.slice(
            [i * regionSize, j * regionSize, 0],
            [regionSize, regionSize, 3]
          );
          const mean = region.mean().dataSync()[0];
          encoding.push(mean);
          region.dispose();
        }
      }
      
      // Pad to 128 dimensions
      while (encoding.length < 128) {
        encoding.push(0);
      }

      tensor.dispose();
      normalized.dispose();

      return encoding.slice(0, 128);
    } catch (error) {
      logger.error('Face encoding extraction failed:', error);
      throw new Error(`Face encoding failed: ${error.message}`);
    }
  }

  async compareFaces(encoding1: number[], encoding2: number[], threshold: number = 0.6): Promise<number> {
    try {
      // Calculate cosine similarity
      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;
      
      for (let i = 0; i < Math.min(encoding1.length, encoding2.length); i++) {
        dotProduct += encoding1[i] * encoding2[i];
        norm1 += encoding1[i] * encoding1[i];
        norm2 += encoding2[i] * encoding2[i];
      }
      
      const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
      return Math.max(0, Math.min(1, similarity));
    } catch (error) {
      logger.error('Face comparison failed:', error);
      return 0;
    }
  }

  async recognizeFace(imagePath: string, faceRect: { x: number; y: number; width: number; height: number }): Promise<FaceRecognitionResult> {
    try {
      const encoding = await this.extractFaceEncoding(imagePath, faceRect);
      
      // For now, return as new person (would compare against database in real implementation)
      return {
        confidence: 0.8,
        isNewPerson: true,
        encoding
      };
    } catch (error) {
      logger.error('Face recognition failed:', error);
      throw new Error(`Face recognition failed: ${error.message}`);
    }
  }

  async processVideoFrames(videoPath: string, frameInterval: number = 1000): Promise<FaceDetectionResult[]> {
    try {
      // For now, return mock results
      // In real implementation, would extract frames and process each
      logger.info(`Processing video frames from ${videoPath}`);
      
      return [
        {
          faces: [{
            x: 100,
            y: 100,
            width: 120,
            height: 140,
            confidence: 0.85
          }],
          totalFaces: 1,
          processingTime: 150
        }
      ];
    } catch (error) {
      logger.error('Video frame processing failed:', error);
      throw new Error(`Video processing failed: ${error.message}`);
    }
  }
}

export default new FaceDetectionService();