import { vi } from 'vitest';

// Global mocks for testing
export const mockApiService = {
  detectFaces: vi.fn(),
  transcribeAudio: vi.fn(),
  uploadFile: vi.fn(),
  getMLStats: vi.fn().mockResolvedValue({ success: true, data: {} }),
  getJobs: vi.fn().mockResolvedValue({ success: true, data: { jobs: [], total: 0 } }),
  getJobStatus: vi.fn(),
  getAllJobs: vi.fn(),
  uploadMedia: vi.fn(),
  healthCheck: vi.fn(),
};

export const mockWebSocketService = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  isConnected: vi.fn().mockReturnValue(false),
  onJobUpdate: vi.fn(),
  onMLProgress: vi.fn(),
  onMLComplete: vi.fn(),
  onMLError: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

export const mockJobStore = {
  jobs: [],
  addJob: vi.fn(),
  updateJob: vi.fn(),
  removeJob: vi.fn(),
  clearJobs: vi.fn(),
};

export const mockNotificationStore = {
  notifications: [],
  addNotification: vi.fn(),
  removeNotification: vi.fn(),
  clearNotifications: vi.fn(),
};

// Setup global mocks
vi.mock('../services/apiService', () => ({
  apiService: mockApiService,
}));

vi.mock('../services/websocketService', () => ({
  websocketService: mockWebSocketService,
}));

vi.mock('../stores/useJobStore', () => ({
  useJobStore: () => mockJobStore,
}));

vi.mock('../stores/useNotificationStore', () => ({
  useNotificationStore: () => mockNotificationStore,
}));