import { create } from 'zustand';
import { apiService } from '../services/apiService';

export interface MediaFile {
  id: string;
  name: string;
  type: 'video' | 'image' | 'audio';
  size: number;
  duration?: number; // for video/audio
  format: string;
  uploadedAt: Date;
  thumbnailUrl?: string;
  url: string;
}

export interface JobResult {
  id: string;
  type: 'person_recognition' | 'object_detection' | 'transcription' | 'nsfw_analysis';
  confidence: number;
  data: Record<string, unknown>;
  timestamp?: number; // for video results
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface Job {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  type: 'single' | 'batch';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  mediaFiles: MediaFile[];
  results: JobResult[];
  progress: number;
  gpuInstanceId?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number;
  actualDuration?: number;
  cost: {
    estimated: number;
    actual?: number;
    currency: string;
  };
  settings: {
    enablePersonRecognition: boolean;
    enableObjectDetection: boolean;
    enableTranscription: boolean;
    enableNsfwAnalysis: boolean;
    transcriptionLanguage?: string;
    confidenceThreshold: number;
  };
  error?: string;
}

export interface BatchJob {
  id: string;
  name: string;
  jobs: Job[];
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  createdAt: Date;
  estimatedCost: number;
  actualCost?: number;
}

interface JobStore {
  jobs: Job[];
  batchJobs: BatchJob[];
  selectedJob: Job | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchJobs: () => Promise<void>;
  selectJob: (job: Job) => void;
  addJob: (job: Omit<Job, 'id' | 'createdAt'>) => void;
  updateJobStatus: (id: string, status: Job['status'], progress?: number) => void;
  removeJob: (id: string) => void;
  clearError: () => void;
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [
    {
      id: 'job-123',
      name: 'Video Analysis - Sample.mp4',
      status: 'completed',
      type: 'single',
      priority: 'normal',
      mediaFiles: [
        {
          id: 'media-001',
          name: 'sample.mp4',
          type: 'video',
          size: 157286400, // ~150MB
          duration: 1800, // 30 minutes
          format: 'mp4',
          uploadedAt: new Date('2024-01-15T10:30:00'),
          thumbnailUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=video%20thumbnail%20preview%20frame&image_size=landscape_16_9',
          url: '/uploads/sample.mp4'
        }
      ],
      results: [
        {
          id: 'result-001',
          type: 'person_recognition',
          confidence: 0.95,
          data: {
            personId: 'person-001',
            name: 'Person_001',
            detectedFeatures: ['face', 'body', 'clothing']
          },
          timestamp: 120,
          boundingBox: { x: 100, y: 50, width: 200, height: 300 }
        }
      ],
      progress: 100,
      gpuInstanceId: 'gpu-001',
      createdAt: new Date('2024-01-15T10:30:00'),
      startedAt: new Date('2024-01-15T10:31:00'),
      completedAt: new Date('2024-01-15T10:45:00'),
      estimatedDuration: 900,
      actualDuration: 840,
      cost: {
        estimated: 0.35,
        actual: 0.32,
        currency: 'EUR'
      },
      settings: {
        enablePersonRecognition: true,
        enableObjectDetection: true,
        enableTranscription: true,
        enableNsfwAnalysis: true,
        transcriptionLanguage: 'de',
        confidenceThreshold: 0.8
      }
    },
    {
      id: 'job-456',
      name: 'Batch Processing - Photo Set',
      status: 'processing',
      type: 'batch',
      priority: 'high',
      mediaFiles: [
        {
          id: 'media-002',
          name: 'photo1.jpg',
          type: 'image',
          size: 5242880, // 5MB
          format: 'jpg',
          uploadedAt: new Date('2024-01-15T11:00:00'),
          thumbnailUrl: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=portrait%20photo%20thumbnail&image_size=square',
          url: '/uploads/photo1.jpg'
        }
      ],
      results: [],
      progress: 45,
      gpuInstanceId: 'gpu-001',
      createdAt: new Date('2024-01-15T11:00:00'),
      startedAt: new Date('2024-01-15T11:02:00'),
      estimatedDuration: 600,
      cost: {
        estimated: 0.25,
        currency: 'EUR'
      },
      settings: {
        enablePersonRecognition: true,
        enableObjectDetection: false,
        enableTranscription: false,
        enableNsfwAnalysis: true,
        confidenceThreshold: 0.85
      }
    }
  ],
  batchJobs: [],
  selectedJob: null,
  isLoading: false,
  error: null,

  createJob: (jobData) => {
    const newJob: Job = {
      ...jobData,
      id: `job-${Date.now()}`,
      createdAt: new Date(),
      progress: 0,
      results: []
    };
    set((state) => ({
      jobs: [...state.jobs, newJob]
    }));
    return newJob.id;
  },

  createBatchJob: (name, jobs) => {
    const newBatchJob: BatchJob = {
      id: `batch-${Date.now()}`,
      name,
      jobs,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      estimatedCost: jobs.reduce((sum, job) => sum + job.cost.estimated, 0)
    };
    set((state) => ({
      batchJobs: [...state.batchJobs, newBatchJob]
    }));
    return newBatchJob.id;
  },

  updateJobStatus: (id, status) => {
    set((state) => ({
      jobs: state.jobs.map(job => {
        if (job.id === id) {
          const updatedJob = { ...job, status };
          if (status === 'processing' && !job.startedAt) {
            updatedJob.startedAt = new Date();
          }
          if (status === 'completed' && !job.completedAt) {
            updatedJob.completedAt = new Date();
            if (job.startedAt) {
              updatedJob.actualDuration = Math.floor(
                (updatedJob.completedAt.getTime() - job.startedAt.getTime()) / 1000
              );
            }
          }
          return updatedJob;
        }
        return job;
      })
    }));
  },

  updateJobProgress: (id, progress) => {
    set((state) => ({
      jobs: state.jobs.map(job =>
        job.id === id ? { ...job, progress: Math.min(100, Math.max(0, progress)) } : job
      )
    }));
  },

  addJobResult: (jobId, result) => {
    set((state) => ({
      jobs: state.jobs.map(job =>
        job.id === jobId 
          ? { ...job, results: [...job.results, result] }
          : job
      )
    }));
  },

  selectJob: (job) => {
    set({ selectedJob: job });
  },

  cancelJob: (id) => {
    set((state) => ({
      jobs: state.jobs.map(job =>
        job.id === id ? { ...job, status: 'cancelled' as const } : job
      )
    }));
  },

  deleteJob: (id) => {
    set((state) => ({
      jobs: state.jobs.filter(job => job.id !== id),
      selectedJob: state.selectedJob?.id === id ? null : state.selectedJob
    }));
  },

  fetchJobs: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.makeRequest('/test');
      if (response.success && response.data?.mockJobs) {
        // Convert API data to our format
        const apiJobs = response.data.mockJobs.map((job: any) => ({
          id: job.id,
          type: job.type,
          status: job.status,
          progress: job.status === 'completed' ? 100 : job.status === 'processing' ? 75 : 0,
          mediaFiles: [{
            id: `media-${job.id}`,
            filename: `${job.type}_sample.mp4`,
            originalName: `${job.type}_sample.mp4`,
            mimeType: 'video/mp4',
            size: 15728640,
            uploadedAt: new Date().toISOString()
          }],
          results: job.status === 'completed' ? [{
            id: `result-${job.id}`,
            type: job.type,
            confidence: 0.95,
            data: { detected: true },
            createdAt: new Date().toISOString()
          }] : [],
          createdAt: new Date(),
          estimatedCompletion: job.status === 'processing' ? new Date(Date.now() + 300000) : undefined
        }));
        set({ jobs: apiJobs, isLoading: false });
      } else {
        // Fallback to existing mock data if API fails
        set({ isLoading: false });
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch jobs' 
      });
    }
  },

  removeJob: (id) => {
    set((state) => ({
      jobs: state.jobs.filter(job => job.id !== id),
      selectedJob: state.selectedJob?.id === id ? null : state.selectedJob
    }));
  },

  clearError: () => {
    set({ error: null });
  }
}));