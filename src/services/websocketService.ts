import { toast } from 'sonner';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

interface JobUpdate {
  jobId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress?: number;
  result?: any;
  error?: string;
}

type EventCallback = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private isConnecting = false;
  private url: string;

  constructor(url: string = 'ws://localhost:3001') {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        reject(new Error('Connection already in progress'));
        return;
      }

      this.isConnecting = true;

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          toast.success('Real-time connection established');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.ws = null;

          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            toast.error('Failed to maintain real-time connection');
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, this.reconnectInterval * this.reconnectAttempts);
  }

  private handleMessage(message: WebSocketMessage): void {
    const listeners = this.eventListeners.get(message.type) || [];
    listeners.forEach(callback => {
      try {
        callback(message.data);
      } catch (error) {
        console.error('Error in WebSocket event listener:', error);
      }
    });
  }

  on(eventType: string, callback: EventCallback): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  off(eventType: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  send(type: string, data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type,
        data,
        timestamp: new Date().toISOString(),
      };
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Message not sent:', { type, data });
    }
  }

  // Convenience methods for specific events
  onJobUpdate(callback: (update: JobUpdate) => void): void {
    this.on('job_update', callback);
  }

  onMLProgress(callback: (progress: { jobId: string; progress: number }) => void): void {
    this.on('ml_progress', callback);
  }

  onMLComplete(callback: (result: { jobId: string; result: any }) => void): void {
    this.on('ml_complete', callback);
  }

  onMLError(callback: (error: { jobId: string; error: string }) => void): void {
    this.on('ml_error', callback);
  }

  // Subscribe to job updates
  subscribeToJob(jobId: string): void {
    this.send('subscribe_job', { jobId });
  }

  // Unsubscribe from job updates
  unsubscribeFromJob(jobId: string): void {
    this.send('unsubscribe_job', { jobId });
  }

  // Generic subscribe method
  subscribe(event: string, callback: EventCallback): void {
    this.on(event, callback);
  }

  // Generic unsubscribe method
  unsubscribe(event: string, callback?: EventCallback): void {
    this.off(event, callback);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.eventListeners.clear();
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get connectionState(): string {
    if (!this.ws) return 'DISCONNECTED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'CONNECTED';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'DISCONNECTED';
      default:
        return 'UNKNOWN';
    }
  }
}

export const websocketService = new WebSocketService();
export type { WebSocketMessage, JobUpdate, EventCallback };