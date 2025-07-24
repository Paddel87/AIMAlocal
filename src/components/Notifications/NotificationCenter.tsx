import React, { useEffect, useState } from 'react';
import { Bell, X, CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react';
import { websocketService } from '../../services/websocketService';
import { toast } from 'sonner';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  actionText?: string;
}

interface NotificationCenterProps {
  className?: string;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ className = '' }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Connect to WebSocket for real-time notifications
    const connectWebSocket = async () => {
      try {
        await websocketService.connect();
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
      }
    };

    connectWebSocket();

    // Listen for different types of notifications
    const handleJobUpdate = (data: any) => {
      const notification: Notification = {
        id: `job-${data.jobId}-${Date.now()}`,
        type: data.status === 'COMPLETED' ? 'success' : data.status === 'FAILED' ? 'error' : 'info',
        title: 'Job Update',
        message: `Job ${data.jobId.slice(0, 8)} is now ${data.status.toLowerCase()}`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      addNotification(notification);
    };

    const handleMLProgress = (data: any) => {
      const notification: Notification = {
        id: `ml-progress-${data.jobId}-${Date.now()}`,
        type: 'info',
        title: 'ML Processing',
        message: `Processing progress: ${Math.round(data.progress * 100)}%`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      addNotification(notification);
    };

    const handleMLComplete = (data: any) => {
      const notification: Notification = {
        id: `ml-complete-${data.jobId}-${Date.now()}`,
        type: 'success',
        title: 'ML Processing Complete',
        message: `Analysis completed successfully for job ${data.jobId.slice(0, 8)}`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      addNotification(notification);
      toast.success('ML processing completed!');
    };

    const handleMLError = (data: any) => {
      const notification: Notification = {
        id: `ml-error-${data.jobId}-${Date.now()}`,
        type: 'error',
        title: 'ML Processing Error',
        message: `Error in job ${data.jobId.slice(0, 8)}: ${data.error}`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      addNotification(notification);
      toast.error('ML processing failed!');
    };

    const handleSystemNotification = (data: any) => {
      const notification: Notification = {
        id: `system-${Date.now()}`,
        type: data.type || 'info',
        title: data.title || 'System Notification',
        message: data.message,
        timestamp: new Date().toISOString(),
        read: false,
        actionUrl: data.actionUrl,
        actionText: data.actionText,
      };
      addNotification(notification);
    };

    // Subscribe to WebSocket events
    websocketService.onJobUpdate(handleJobUpdate);
    websocketService.onMLProgress(handleMLProgress);
    websocketService.onMLComplete(handleMLComplete);
    websocketService.onMLError(handleMLError);
    websocketService.on('system_notification', handleSystemNotification);

    return () => {
      websocketService.off('job_update', handleJobUpdate);
      websocketService.off('ml_progress', handleMLProgress);
      websocketService.off('ml_complete', handleMLComplete);
      websocketService.off('ml_error', handleMLError);
      websocketService.off('system_notification', handleSystemNotification);
    };
  }, []);

  const addNotification = (notification: Notification) => {
    setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep only last 50 notifications
    setUnreadCount(prev => prev + 1);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
    setUnreadCount(0);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === id);
      if (notification && !notification.read) {
        setUnreadCount(count => Math.max(0, count - 1));
      }
      return prev.filter(notif => notif.id !== id);
    });
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'error':
        return <XCircle className="text-red-500" size={20} />;
      case 'warning':
        return <AlertCircle className="text-yellow-500" size={20} />;
      case 'info':
      default:
        return <Info className="text-blue-500" size={20} />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const now = new Date();
    const notifTime = new Date(timestamp);
    const diffMs = now.getTime() - notifTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return notifTime.toLocaleDateString();
  };

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-lg border z-50 max-h-96 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                <div className="flex items-center space-x-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={clearAllNotifications}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Clear all
                  </button>
                </div>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="mx-auto mb-2 text-gray-300" size={32} />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        !notification.read ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                      onClick={() => !notification.read && markAsRead(notification.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {notification.title}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNotification(notification.id);
                              }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500">
                              {formatTimestamp(notification.timestamp)}
                            </span>
                            
                            {notification.actionUrl && notification.actionText && (
                              <a
                                href={notification.actionUrl}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {notification.actionText}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;