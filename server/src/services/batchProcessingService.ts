import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { GpuProviderManager, StandardGpuInstance } from './gpuProviderManager';
import { faceDetectionService } from './faceDetectionService';
import { audioTranscriptionService } from './audioTranscriptionService';
import { videoProcessingService } from './videoProcessingService';
import { JobType, JobStatus, GpuProvider } from '@prisma/client';
import Bull, { Queue, Job } from 'bull';
import path from 'path';
import fs from 'fs/promises';
import { io } from '../server';

export interface BatchJobConfig {
  id: string;
  userId: string;
  type: JobType;
  files: string[];
  options: {
    enableFaceDetection?: boolean;
    enableObjectDetection?: boolean;
    enableTranscription?: boolean;
    enableNsfwAnalysis?: boolean;
    transcriptionLanguage?: string;
    confidenceThreshold?: number;
    batchSize?: number;
    maxConcurrentJobs?: number;
    preferredProvider?: GpuProvider;
    gpuType?: string;
    autoScale?: boolean;
  };
  priority?: number;
}

export interface BatchJobResult {
  jobId: string;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  results: Array<{
    file: string;
    status: 'success' | 'failed';
    result?: any;
    error?: string;
    processingTime: number;
  }>;
  totalProcessingTime: number;
  averageProcessingTime: number;
  costEstimate: number;
}

export interface GpuResourceAllocation {
  instanceId: string;
  provider: GpuProvider;
  status: 'allocated' | 'busy' | 'idle' | 'error';
  currentJob?: string;
  queuedJobs: string[];
  lastActivity: Date;
  metrics: {
    totalJobsProcessed: number;
    totalProcessingTime: number;
    averageJobTime: number;
    errorRate: number;
  };
}

export class BatchProcessingService {
  private batchQueue: Queue;
  private gpuManager: GpuProviderManager;
  private allocatedResources: Map<string, GpuResourceAllocation> = new Map();
  private jobMetrics: Map<string, any> = new Map();

  constructor(gpuManager: GpuProviderManager) {
    this.gpuManager = gpuManager;
    this.batchQueue = new Bull('batch-processing', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.setupQueueProcessors();
    this.startResourceMonitoring();
  }

  /**
   * Submit a batch job for processing
   */
  async submitBatchJob(config: BatchJobConfig): Promise<string> {
    try {
      // Validate job configuration
      await this.validateJobConfig(config);

      // Create job record in database
      const job = await prisma.job.create({
        data: {
          id: config.id,
          userId: config.userId,
          type: config.type,
          status: JobStatus.PENDING,
          priority: config.priority || 1,
          metadata: {
            files: config.files,
            options: config.options,
            batchSize: config.options.batchSize || 10,
            maxConcurrentJobs: config.options.maxConcurrentJobs || 3,
          },
          estimatedDuration: this.estimateJobDuration(config),
          estimatedCost: await this.estimateJobCost(config),
        },
      });

      // Add job to processing queue
      await this.batchQueue.add('process-batch', config, {
        priority: config.priority || 1,
        jobId: config.id,
      });

      logger.info(`Submitted batch job ${config.id} with ${config.files.length} files`);
      return config.id;
    } catch (error) {
      logger.error('Failed to submit batch job:', error);
      throw new Error(`Failed to submit batch job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get batch job status
   */
  async getBatchJobStatus(jobId: string): Promise<any> {
    try {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          results: true,
        },
      });

      if (!job) {
        throw new Error('Job not found');
      }

      const queueJob = await this.batchQueue.getJob(jobId);
      const metrics = this.jobMetrics.get(jobId);

      return {
        id: job.id,
        status: job.status,
        progress: queueJob?.progress() || 0,
        totalFiles: job.metadata?.files?.length || 0,
        processedFiles: job.results.length,
        failedFiles: job.results.filter(r => r.status === 'FAILED').length,
        estimatedDuration: job.estimatedDuration,
        estimatedCost: job.estimatedCost,
        actualDuration: job.completedAt ? 
          new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime() : null,
        metrics: metrics || {},
        allocatedResources: this.getAllocatedResourcesForJob(jobId),
      };
    } catch (error) {
      logger.error(`Failed to get batch job status for ${jobId}:`, error);
      throw new Error(`Failed to get batch job status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cancel a batch job
   */
  async cancelBatchJob(jobId: string): Promise<boolean> {
    try {
      const queueJob = await this.batchQueue.getJob(jobId);
      if (queueJob) {
        await queueJob.remove();
      }

      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.CANCELLED,
          completedAt: new Date(),
        },
      });

      // Release allocated resources
      await this.releaseJobResources(jobId);

      logger.info(`Cancelled batch job ${jobId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to cancel batch job ${jobId}:`, error);
      throw new Error(`Failed to cancel batch job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get batch processing statistics
   */
  async getBatchStatistics(): Promise<any> {
    try {
      const [totalJobs, activeJobs, completedJobs, failedJobs] = await Promise.all([
        prisma.job.count(),
        prisma.job.count({ where: { status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] } } }),
        prisma.job.count({ where: { status: JobStatus.COMPLETED } }),
        prisma.job.count({ where: { status: JobStatus.FAILED } }),
      ]);

      const queueStats = await this.batchQueue.getJobCounts();
      const allocatedResourcesCount = this.allocatedResources.size;
      const busyResourcesCount = Array.from(this.allocatedResources.values())
        .filter(r => r.status === 'busy').length;

      return {
        totalJobs,
        activeJobs,
        completedJobs,
        failedJobs,
        successRate: totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0,
        queueStats,
        resources: {
          allocated: allocatedResourcesCount,
          busy: busyResourcesCount,
          idle: allocatedResourcesCount - busyResourcesCount,
        },
      };
    } catch (error) {
      logger.error('Failed to get batch statistics:', error);
      throw new Error(`Failed to get batch statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Setup queue processors
   */
  private setupQueueProcessors(): void {
    this.batchQueue.process('process-batch', async (job: Job<BatchJobConfig>) => {
      const config = job.data;
      logger.info(`Processing batch job ${config.id}`);

      try {
        // Update job status
        await prisma.job.update({
          where: { id: config.id },
          data: { status: JobStatus.PROCESSING, startedAt: new Date() },
        });

        // Allocate GPU resources if needed
        const resources = await this.allocateResources(config);
        
        // Process files in batches
        const results = await this.processBatchFiles(config, job);

        // Update job completion
        await prisma.job.update({
          where: { id: config.id },
          data: {
            status: JobStatus.COMPLETED,
            completedAt: new Date(),
            metadata: {
              ...config,
              results: results,
            },
          },
        });

        // Release resources
        await this.releaseJobResources(config.id);

        // Emit completion event
        io.emit('job-completed', {
          jobId: config.id,
          results: results,
        });

        logger.info(`Completed batch job ${config.id}`);
        return results;
      } catch (error) {
        logger.error(`Failed to process batch job ${config.id}:`, error);
        
        await prisma.job.update({
          where: { id: config.id },
          data: {
            status: JobStatus.FAILED,
            completedAt: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        await this.releaseJobResources(config.id);
        throw error;
      }
    });

    // Setup event listeners
    this.batchQueue.on('completed', (job, result) => {
      logger.info(`Batch job ${job.id} completed`);
    });

    this.batchQueue.on('failed', (job, err) => {
      logger.error(`Batch job ${job.id} failed:`, err);
    });

    this.batchQueue.on('progress', (job, progress) => {
      io.emit('job-progress', {
        jobId: job.id,
        progress: progress,
      });
    });
  }

  /**
   * Process batch files
   */
  private async processBatchFiles(config: BatchJobConfig, job: Job): Promise<BatchJobResult> {
    const startTime = Date.now();
    const results: BatchJobResult['results'] = [];
    const batchSize = config.options.batchSize || 10;
    const files = config.files;
    
    let processedCount = 0;
    let failedCount = 0;

    // Process files in batches
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      // Process batch concurrently
      const batchPromises = batch.map(async (file) => {
        const fileStartTime = Date.now();
        try {
          const result = await this.processFile(file, config);
          const processingTime = Date.now() - fileStartTime;
          
          processedCount++;
          return {
            file,
            status: 'success' as const,
            result,
            processingTime,
          };
        } catch (error) {
          const processingTime = Date.now() - fileStartTime;
          failedCount++;
          
          return {
            file,
            status: 'failed' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
            processingTime,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Update progress
      const progress = Math.round(((i + batch.length) / files.length) * 100);
      await job.progress(progress);

      // Emit progress event
      io.emit('job-progress', {
        jobId: config.id,
        progress,
        processedFiles: processedCount,
        failedFiles: failedCount,
      });
    }

    const totalProcessingTime = Date.now() - startTime;
    const averageProcessingTime = results.length > 0 ? 
      results.reduce((sum, r) => sum + r.processingTime, 0) / results.length : 0;

    return {
      jobId: config.id,
      totalFiles: files.length,
      processedFiles: processedCount,
      failedFiles: failedCount,
      results,
      totalProcessingTime,
      averageProcessingTime,
      costEstimate: await this.calculateActualCost(config, totalProcessingTime),
    };
  }

  /**
   * Process a single file
   */
  private async processFile(filePath: string, config: BatchJobConfig): Promise<any> {
    const fileExtension = path.extname(filePath).toLowerCase();
    const options = config.options;

    switch (config.type) {
      case JobType.FACE_DETECTION:
        if (['.jpg', '.jpeg', '.png', '.bmp'].includes(fileExtension)) {
          return await faceDetectionService.detectFaces(filePath, {
            confidenceThreshold: options.confidenceThreshold || 0.8,
          });
        } else if (['.mp4', '.avi', '.mov', '.mkv'].includes(fileExtension)) {
          return await videoProcessingService.processVideo(filePath, {
            enableFaceDetection: true,
            confidenceThreshold: options.confidenceThreshold || 0.8,
          });
        }
        break;

      case JobType.AUDIO_TRANSCRIPTION:
        if (['.mp3', '.wav', '.m4a', '.flac'].includes(fileExtension)) {
          return await audioTranscriptionService.transcribeAudio(filePath, {
            language: options.transcriptionLanguage || 'auto',
          });
        } else if (['.mp4', '.avi', '.mov', '.mkv'].includes(fileExtension)) {
          return await videoProcessingService.processVideo(filePath, {
            enableTranscription: true,
            transcriptionLanguage: options.transcriptionLanguage || 'auto',
          });
        }
        break;

      case JobType.VIDEO_ANALYSIS:
        if (['.mp4', '.avi', '.mov', '.mkv'].includes(fileExtension)) {
          return await videoProcessingService.processVideo(filePath, {
            enableFaceDetection: options.enableFaceDetection,
            enableObjectDetection: options.enableObjectDetection,
            enableTranscription: options.enableTranscription,
            enableNsfwAnalysis: options.enableNsfwAnalysis,
            transcriptionLanguage: options.transcriptionLanguage,
            confidenceThreshold: options.confidenceThreshold,
          });
        }
        break;

      default:
        throw new Error(`Unsupported job type: ${config.type}`);
    }

    throw new Error(`Unsupported file type: ${fileExtension}`);
  }

  /**
   * Allocate GPU resources for a job
   */
  private async allocateResources(config: BatchJobConfig): Promise<StandardGpuInstance[]> {
    if (!config.options.autoScale) {
      return [];
    }

    try {
      const requiredInstances = Math.min(
        config.options.maxConcurrentJobs || 1,
        Math.ceil(config.files.length / (config.options.batchSize || 10))
      );

      const instances: StandardGpuInstance[] = [];
      
      for (let i = 0; i < requiredInstances; i++) {
        const instance = await this.gpuManager.createInstance({
          provider: config.options.preferredProvider || GpuProvider.VAST_AI,
          name: `batch-${config.id}-${i}`,
          imageName: 'pytorch/pytorch:latest',
          gpuType: config.options.gpuType || 'RTX 3080',
          gpuCount: 1,
          startSsh: true,
        });

        instances.push(instance);
        
        this.allocatedResources.set(instance.id, {
          instanceId: instance.id,
          provider: instance.provider,
          status: 'allocated',
          currentJob: config.id,
          queuedJobs: [],
          lastActivity: new Date(),
          metrics: {
            totalJobsProcessed: 0,
            totalProcessingTime: 0,
            averageJobTime: 0,
            errorRate: 0,
          },
        });
      }

      logger.info(`Allocated ${instances.length} GPU instances for job ${config.id}`);
      return instances;
    } catch (error) {
      logger.error(`Failed to allocate resources for job ${config.id}:`, error);
      return [];
    }
  }

  /**
   * Release job resources
   */
  private async releaseJobResources(jobId: string): Promise<void> {
    const resourcesToRelease = Array.from(this.allocatedResources.entries())
      .filter(([_, resource]) => resource.currentJob === jobId);

    for (const [instanceId, resource] of resourcesToRelease) {
      try {
        await this.gpuManager.terminateInstance(resource.provider, instanceId);
        this.allocatedResources.delete(instanceId);
        logger.info(`Released GPU instance ${instanceId} for job ${jobId}`);
      } catch (error) {
        logger.error(`Failed to release GPU instance ${instanceId}:`, error);
      }
    }
  }

  /**
   * Get allocated resources for a job
   */
  private getAllocatedResourcesForJob(jobId: string): GpuResourceAllocation[] {
    return Array.from(this.allocatedResources.values())
      .filter(resource => resource.currentJob === jobId);
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    setInterval(async () => {
      try {
        await this.monitorResources();
      } catch (error) {
        logger.error('Resource monitoring error:', error);
      }
    }, 30000); // Monitor every 30 seconds
  }

  /**
   * Monitor allocated resources
   */
  private async monitorResources(): Promise<void> {
    for (const [instanceId, resource] of this.allocatedResources.entries()) {
      try {
        const instance = await this.gpuManager.getInstance(resource.provider, instanceId);
        
        if (!instance || instance.status === 'TERMINATED') {
          this.allocatedResources.delete(instanceId);
          continue;
        }

        // Update resource status based on instance status
        if (instance.status === 'RUNNING') {
          resource.status = resource.currentJob ? 'busy' : 'idle';
        } else {
          resource.status = 'error';
        }

        resource.lastActivity = new Date();
      } catch (error) {
        logger.error(`Failed to monitor resource ${instanceId}:`, error);
        resource.status = 'error';
      }
    }
  }

  /**
   * Validate job configuration
   */
  private async validateJobConfig(config: BatchJobConfig): Promise<void> {
    if (!config.id || !config.userId || !config.type) {
      throw new Error('Missing required job configuration fields');
    }

    if (!config.files || config.files.length === 0) {
      throw new Error('No files specified for processing');
    }

    // Check if files exist
    for (const file of config.files) {
      try {
        await fs.access(file);
      } catch (error) {
        throw new Error(`File not found: ${file}`);
      }
    }
  }

  /**
   * Estimate job duration
   */
  private estimateJobDuration(config: BatchJobConfig): number {
    const baseTimePerFile = {
      [JobType.FACE_DETECTION]: 30, // 30 seconds per file
      [JobType.AUDIO_TRANSCRIPTION]: 60, // 1 minute per file
      [JobType.VIDEO_ANALYSIS]: 120, // 2 minutes per file
    };

    const timePerFile = baseTimePerFile[config.type] || 60;
    const concurrency = config.options.maxConcurrentJobs || 1;
    
    return Math.ceil((config.files.length * timePerFile) / concurrency);
  }

  /**
   * Estimate job cost
   */
  private async estimateJobCost(config: BatchJobConfig): Promise<number> {
    const estimatedDuration = this.estimateJobDuration(config);
    const hourlyRate = 0.5; // Default rate per hour
    
    return (estimatedDuration / 3600) * hourlyRate;
  }

  /**
   * Calculate actual job cost
   */
  private async calculateActualCost(config: BatchJobConfig, processingTime: number): Promise<number> {
    const hourlyRate = 0.5; // This should come from the actual GPU instance cost
    return (processingTime / (1000 * 3600)) * hourlyRate;
  }
}

export default BatchProcessingService;