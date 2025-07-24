export interface FileWithPreview extends File {
  preview?: string;
}

export interface JobStatus {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress?: number;
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
  type: 'FACE_DETECTION' | 'FACE_RECOGNITION' | 'AUDIO_TRANSCRIPTION' | 'BATCH_PROCESSING';
}

export interface MLStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  activeJobs: number;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  jobId?: string;
}

export interface WebSocketMessage {
  type: 'JOB_UPDATE' | 'ML_PROGRESS' | 'SYSTEM_STATUS' | 'ERROR';
  data: any;
  timestamp: string;
}

export interface FaceDetectionResult {
  faces: Array<{
    bbox: [number, number, number, number];
    confidence: number;
    landmarks?: Array<[number, number]>;
    age?: number;
    gender?: string;
    emotion?: string;
  }>;
  processingTime: number;
  imageSize: {
    width: number;
    height: number;
  };
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
    confidence: number;
  }>;
  language?: string;
  processingTime: number;
  duration: number;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}