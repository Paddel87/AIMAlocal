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
  deleteJob: (jobId: string) => void;
  clearError: () => void;
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: [],
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



  fetchJobs: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.getJobs();
      if (response.success && response.data) {
        // Use real API data from /jobs endpoint
        const apiJobs: Job[] = response.data.jobs?.map((job: any) => ({
          id: job.id,
          name: job.name || `${job.type} Job`,
          type: job.type || 'single' as const,
          status: job.status as 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',
          priority: job.priority || 'normal' as const,
          progress: job.progress || (job.status === 'completed' ? 100 : job.status === 'processing' ? 75 : 0),
          mediaFiles: job.mediaFiles || [],
          results: job.results || [],
          createdAt: new Date(job.createdAt),
          startedAt: job.startedAt ? new Date(job.startedAt) : undefined,
          completedAt: job.completedAt ? new Date(job.completedAt) : undefined,
          estimatedDuration: job.estimatedDuration || 300,
          actualDuration: job.actualDuration,
          cost: job.cost || {
            estimated: 0.25,
            currency: 'EUR'
          },
          settings: job.settings || {
            enablePersonRecognition: true,
            enableObjectDetection: false,
            enableTranscription: false,
            enableNsfwAnalysis: false,
            confidenceThreshold: 0.8
          },
          gpuInstanceId: job.gpuInstanceId
        })) || [];
        set({ jobs: apiJobs, isLoading: false });
      } else {
        // If no real data available, clear jobs array
        set({ jobs: [], isLoading: false });
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
  },

  addJob: (job) => {
    const newJob: Job = {
      ...job,
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date()
    };
    set((state) => ({
      jobs: [...state.jobs, newJob]
    }));
  },

  deleteJob: (jobId: string) => {
    set((state) => ({
      jobs: state.jobs.filter(job => job.id !== jobId),
      selectedJob: state.selectedJob?.id === jobId ? null : state.selectedJob
    }));
  }
}));