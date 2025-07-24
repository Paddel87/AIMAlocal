import { describe, it, expect, vi } from 'vitest';
import { apiService } from '../apiService';

describe('API Service', () => {
  it('should have required methods', () => {
    expect(typeof apiService.detectFaces).toBe('function');
    expect(typeof apiService.transcribeAudio).toBe('function');
    expect(typeof apiService.uploadFile).toBe('function');
    expect(typeof apiService.getJobStatus).toBe('function');
    expect(typeof apiService.getJobs).toBe('function');
    expect(typeof apiService.getMLStats).toBe('function');
  });
  
  it('should handle basic API calls', async () => {
    // Mock fetch for a simple test
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: {} })
    });
    
    const result = await apiService.getMLStats();
    expect(result.success).toBe(true);
  });
});