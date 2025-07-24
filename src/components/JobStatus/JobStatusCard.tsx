import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, Play, Pause } from 'lucide-react';
import { websocketService, JobUpdate } from '../../services/websocketService';
import { apiService, JobStatus } from '../../services/apiService';

interface JobStatusCardProps {
  jobId: string;
  onStatusChange?: (status: JobStatus) => void;
  showDetails?: boolean;
  className?: string;
}

const JobStatusCard: React.FC<JobStatusCardProps> = ({
  jobId,
  onStatusChange,
  showDetails = true,
  className = '',
}) => {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initial job status fetch
    const fetchJobStatus = async () => {
      setIsLoading(true);
      try {
        const response = await apiService.getJobStatus(jobId);
        if (response.success && response.data) {
          setJobStatus(response.data);
          onStatusChange?.(response.data);
        } else {
          setError(response.error || 'Failed to fetch job status');
        }
      } catch (err) {
        setError('Failed to fetch job status');
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobStatus();

    // Subscribe to real-time updates
    const handleJobUpdate = (update: JobUpdate) => {
      if (update.jobId === jobId) {
        setJobStatus(prev => {
          if (!prev) return null;
          const updatedStatus: JobStatus = {
            ...prev,
            status: update.status,
            progress: update.progress,
            result: update.result,
            error: update.error,
            updatedAt: new Date().toISOString(),
          };
          onStatusChange?.(updatedStatus);
          return updatedStatus;
        });
      }
    };

    websocketService.onJobUpdate(handleJobUpdate);
    websocketService.subscribeToJob(jobId);

    return () => {
      websocketService.off('job_update', handleJobUpdate);
      websocketService.unsubscribeFromJob(jobId);
    };
  }, [jobId, onStatusChange]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="text-yellow-500" size={20} />;
      case 'PROCESSING':
        return <Play className="text-blue-500 animate-pulse" size={20} />;
      case 'COMPLETED':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'FAILED':
        return <XCircle className="text-red-500" size={20} />;
      default:
        return <AlertCircle className="text-gray-500" size={20} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'FAILED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getProgressPercentage = () => {
    if (jobStatus?.progress !== undefined) {
      return Math.round(jobStatus.progress * 100);
    }
    
    switch (jobStatus?.status) {
      case 'PENDING':
        return 0;
      case 'PROCESSING':
        return 50;
      case 'COMPLETED':
        return 100;
      case 'FAILED':
        return 0;
      default:
        return 0;
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg border p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 bg-gray-300 rounded"></div>
            <div className="h-4 bg-gray-300 rounded w-24"></div>
          </div>
          <div className="mt-3 h-2 bg-gray-300 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2">
          <XCircle className="text-red-500" size={20} />
          <span className="text-red-700 text-sm font-medium">Error</span>
        </div>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!jobStatus) {
    return null;
  }

  const progressPercentage = getProgressPercentage();

  return (
    <div className={`bg-white rounded-lg border shadow-sm p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          {getStatusIcon(jobStatus.status)}
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              Job {jobId.slice(0, 8)}...
            </h3>
            <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full border ${
              getStatusColor(jobStatus.status)
            }`}>
              {jobStatus.status}
            </span>
          </div>
        </div>
        
        {showDetails && (
          <div className="text-xs text-gray-500">
            {formatTimestamp(jobStatus.updatedAt)}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>Progress</span>
          <span>{progressPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              jobStatus.status === 'COMPLETED'
                ? 'bg-green-500'
                : jobStatus.status === 'FAILED'
                ? 'bg-red-500'
                : jobStatus.status === 'PROCESSING'
                ? 'bg-blue-500'
                : 'bg-yellow-500'
            }`}
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Details */}
      {showDetails && (
        <div className="space-y-2">
          {jobStatus.error && (
            <div className="bg-red-50 border border-red-200 rounded p-2">
              <p className="text-red-700 text-xs font-medium">Error:</p>
              <p className="text-red-600 text-xs">{jobStatus.error}</p>
            </div>
          )}
          
          {jobStatus.result && jobStatus.status === 'COMPLETED' && (
            <div className="bg-green-50 border border-green-200 rounded p-2">
              <p className="text-green-700 text-xs font-medium">Result:</p>
              <div className="text-green-600 text-xs">
                {typeof jobStatus.result === 'object' ? (
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(jobStatus.result, null, 2)}
                  </pre>
                ) : (
                  <p>{String(jobStatus.result)}</p>
                )}
              </div>
            </div>
          )}
          
          <div className="flex justify-between text-xs text-gray-500">
            <span>Created: {formatTimestamp(jobStatus.createdAt)}</span>
            <span>Updated: {formatTimestamp(jobStatus.updatedAt)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobStatusCard;