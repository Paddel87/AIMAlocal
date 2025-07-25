import { describe, it, expect, vi } from 'vitest';
import { websocketService } from '../websocketService';

describe('WebSocket Service', () => {
  it('should have basic methods', () => {
    expect(typeof websocketService.connect).toBe('function');
    expect(typeof websocketService.disconnect).toBe('function');
    expect(typeof websocketService.subscribe).toBe('function');
    expect(typeof websocketService.unsubscribe).toBe('function');
    expect(typeof websocketService.isConnected).toBe('boolean');
  });
  
  it('should return false for isConnected initially', () => {
    expect(websocketService.isConnected).toBe(false);
  });
});