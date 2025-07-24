import { toast } from 'sonner';

const API_BASE_URL = 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface FaceDetectionResult {
  faces: {
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }[];
  totalFaces: number;
  processingTime: number;
}

interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  processingTime: number;
}

interface JobStatus {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress?: number;
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export class ApiService {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`API Error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private async uploadFileToEndpoint<T>(
    endpoint: string,
    file: File,
    fieldName: string = 'file'
  ): Promise<ApiResponse<T>> {
    try {
      const formData = new FormData();
      formData.append(fieldName, file);

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'File upload failed');
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Upload Error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // ML API Methods
  async detectFaces(file: File): Promise<ApiResponse<FaceDetectionResult>> {
    return this.uploadFileToEndpoint<FaceDetectionResult>('/ml/faces/detect', file, 'image');
  }

  async recognizeFaces(file: File): Promise<ApiResponse<any>> {
    return this.uploadFileToEndpoint('/ml/faces/recognize', file, 'image');
  }

  async transcribeAudio(file: File): Promise<ApiResponse<TranscriptionResult>> {
    return this.uploadFileToEndpoint<TranscriptionResult>('/ml/transcribe', file, 'audio');
  }

  async processBatch(mediaIds: string[]): Promise<ApiResponse<any>> {
    return this.makeRequest('/ml/batch', {
      method: 'POST',
      body: JSON.stringify({ mediaIds }),
    });
  }

  async getAnalysisResults(mediaId: string, type?: string): Promise<ApiResponse<any>> {
    const queryParam = type ? `?type=${type}` : '';
    return this.makeRequest(`/ml/results/${mediaId}${queryParam}`);
  }

  async getMLStatus(): Promise<ApiResponse<any>> {
    return this.makeRequest('/ml/status');
  }

  async getMLStats(): Promise<ApiResponse<any>> {
    return this.makeRequest('/ml/admin/stats');
  }

  // Job Management
  async getJobStatus(jobId: string): Promise<ApiResponse<JobStatus>> {
    return this.makeRequest<JobStatus>(`/jobs/${jobId}`);
  }

  async getAllJobs(): Promise<ApiResponse<JobStatus[]>> {
    return this.makeRequest<JobStatus[]>('/jobs');
  }

  async getJobs(params?: { page?: number; limit?: number; status?: string }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    
    const queryString = queryParams.toString();
    return this.makeRequest(`/jobs${queryString ? '?' + queryString : ''}`);
  }

  // File Upload with Progress
  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<ApiResponse<any>> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({
            success: xhr.status === 200,
            data: response.data || response,
            error: xhr.status !== 200 ? response.error : undefined,
          });
        } catch (error) {
          resolve({
            success: false,
            error: 'Failed to parse response',
          });
        }
      });

      xhr.addEventListener('error', () => {
        resolve({
          success: false,
          error: 'Upload failed',
        });
      });

      xhr.open('POST', `${API_BASE_URL}/upload`);
      xhr.send(formData);
    });
  }

  // File Upload
  async uploadMedia(file: File): Promise<ApiResponse<{ id: string; url: string }>> {
    return this.uploadFile<{ id: string; url: string }>('/upload', file, 'media');
  }

  // Health Check
  async healthCheck(): Promise<ApiResponse<any>> {
    return this.makeRequest('/health');
  }
}

export const apiService = new ApiService();
export default apiService;
export type { FaceDetectionResult, TranscriptionResult, JobStatus, ApiResponse };