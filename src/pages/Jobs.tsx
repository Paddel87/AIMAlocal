import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Play, 
  Square, 
  Eye, 
  Download, 
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Upload,
  FileVideo,
  FileImage,
  FileAudio,
  MoreVertical
} from 'lucide-react';
import { useJobStore, type Job } from '../stores/useJobStore';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface JobCardProps {
  job: Job;
  onSelect: (job: Job) => void;
  onStatusChange: (id: string, status: Job['status']) => void;
  onDelete: (id: string) => void;
}

function JobCard({ job, onSelect, onStatusChange, onDelete }: JobCardProps) {
  const [showActions, setShowActions] = useState(false);

  const statusConfig = {
    pending: { 
      icon: Clock, 
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      bgColor: 'bg-yellow-50'
    },
    processing: { 
      icon: Play, 
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      bgColor: 'bg-blue-50'
    },
    completed: { 
      icon: CheckCircle, 
      color: 'bg-green-100 text-green-800 border-green-200',
      bgColor: 'bg-green-50'
    },
    failed: { 
      icon: XCircle, 
      color: 'bg-red-100 text-red-800 border-red-200',
      bgColor: 'bg-red-50'
    },
    cancelled: { 
      icon: AlertCircle, 
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      bgColor: 'bg-gray-50'
    }
  };

  const config = statusConfig[job.status];
  const StatusIcon = config.icon;

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'video': return FileVideo;
      case 'image': return FileImage;
      case 'audio': return FileAudio;
      default: return FileImage;
    }
  };

  const priorityColors = {
    low: 'text-gray-600',
    normal: 'text-blue-600',
    high: 'text-orange-600',
    urgent: 'text-red-600'
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start space-x-3">
            <div className={cn("p-2 rounded-lg", config.bgColor)}>
              <StatusIcon className="h-5 w-5 text-gray-700" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">{job.name}</h3>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span className="flex items-center">
                  <span className={cn("font-medium", priorityColors[job.priority])}>
                    {job.priority.toUpperCase()}
                  </span>
                </span>
                <span>{job.type === 'batch' ? 'Batch Job' : 'Single Job'}</span>
                <span>{format(job.createdAt, 'MMM dd, HH:mm')}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={cn(
              "px-2 py-1 text-xs font-medium rounded-full border",
              config.color
            )}>
              {job.status}
            </span>
            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {showActions && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                  <button
                    onClick={() => {
                      onSelect(job);
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </button>
                  {job.status === 'processing' && (
                    <button
                      onClick={() => {
                        onStatusChange(job.id, 'cancelled');
                        setShowActions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Cancel Job
                    </button>
                  )}
                  {job.status === 'completed' && (
                    <button
                      onClick={() => setShowActions(false)}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Results
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onDelete(job.id);
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Job
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Media Files */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Media Files ({job.mediaFiles.length})</h4>
          <div className="space-y-2">
            {job.mediaFiles.slice(0, 2).map((file) => {
              const MediaIcon = getMediaIcon(file.type);
              return (
                <div key={file.id} className="flex items-center space-x-3 bg-gray-50 rounded-lg p-3">
                  <MediaIcon className="h-5 w-5 text-gray-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {file.type} • {(file.size / (1024 * 1024)).toFixed(1)} MB
                      {file.duration && ` • ${Math.floor(file.duration / 60)}:${(file.duration % 60).toString().padStart(2, '0')}`}
                    </p>
                  </div>
                </div>
              );
            })}
            {job.mediaFiles.length > 2 && (
              <p className="text-sm text-gray-500 text-center py-2">
                +{job.mediaFiles.length - 2} more files
              </p>
            )}
          </div>
        </div>

        {/* Progress */}
        {job.status === 'processing' && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm text-gray-600">{job.progress}%</span>
            </div>
            <div className="bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Results Summary */}
        {job.results.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Results</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-blue-50 rounded-lg p-2">
                <p className="text-xs text-blue-600 font-medium">Person Recognition</p>
                <p className="text-lg font-bold text-blue-900">
                  {job.results.filter(r => r.type === 'person_recognition').length}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-2">
                <p className="text-xs text-green-600 font-medium">Transcriptions</p>
                <p className="text-lg font-bold text-green-900">
                  {job.results.filter(r => r.type === 'transcription').length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            {job.gpuInstanceId && (
              <span>GPU: {job.gpuInstanceId}</span>
            )}
            <span>Cost: €{(job.cost.actual || job.cost.estimated).toFixed(2)}</span>
            {job.actualDuration && (
              <span>Duration: {Math.floor(job.actualDuration / 60)}m {job.actualDuration % 60}s</span>
            )}
          </div>
          <button
            onClick={() => onSelect(job)}
            className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Jobs() {
  const { jobs, selectedJob, selectJob, updateJobStatus, deleteJob } = useJobStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Job['status'] | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.mediaFiles.some(file => file.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Statistics
  const totalJobs = jobs.length;
  const processingJobs = jobs.filter(job => job.status === 'processing').length;
  const completedJobs = jobs.filter(job => job.status === 'completed').length;
  const failedJobs = jobs.filter(job => job.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-gray-600 mt-1">Manage and monitor your media analysis jobs</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Job
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Jobs</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalJobs}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Processing</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{processingJobs}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Play className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{completedJobs}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{failedJobs}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Jobs suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as Job['status'] | 'all')}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredJobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onSelect={selectJob}
            onStatusChange={updateJobStatus}
            onDelete={deleteJob}
          />
        ))}
      </div>

      {filteredJobs.length === 0 && (
        <div className="text-center py-12">
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Create your first job to get started with media analysis'
            }
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Job
          </button>
        </div>
      )}

      {/* Job Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">{selectedJob.name}</h2>
                <button
                  onClick={() => selectJob(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Settings</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Person Recognition</p>
                      <p className="text-sm text-gray-900">
                        {selectedJob.settings.enablePersonRecognition ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Transcription</p>
                      <p className="text-sm text-gray-900">
                        {selectedJob.settings.enableTranscription ? 'Enabled' : 'Disabled'}
                        {selectedJob.settings.transcriptionLanguage && ` (${selectedJob.settings.transcriptionLanguage})`}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">NSFW Analysis</p>
                      <p className="text-sm text-gray-900">
                        {selectedJob.settings.enableNsfwAnalysis ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Confidence Threshold</p>
                      <p className="text-sm text-gray-900">{selectedJob.settings.confidenceThreshold}</p>
                    </div>
                  </div>
                </div>
                
                {selectedJob.results.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Results</h3>
                    <div className="space-y-2">
                      {selectedJob.results.slice(0, 5).map((result) => (
                        <div key={result.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">
                              {result.type.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className="text-sm text-gray-600">
                              Confidence: {(result.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                          {result.timestamp && (
                            <p className="text-xs text-gray-500 mt-1">
                              Timestamp: {Math.floor(result.timestamp / 60)}:{(result.timestamp % 60).toString().padStart(2, '0')}
                            </p>
                          )}
                        </div>
                      ))}
                      {selectedJob.results.length > 5 && (
                        <p className="text-sm text-gray-500 text-center py-2">
                          +{selectedJob.results.length - 5} more results
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}