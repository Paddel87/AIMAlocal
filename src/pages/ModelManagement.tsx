import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Download, 
  Play, 
  Pause, 
  Trash2, 
  Settings, 
  Eye, 
  MoreVertical,
  Plus,
  Search,
  Filter,
  HardDrive,
  CheckCircle,
  AlertCircle,
  XCircle,
  Activity,
  TrendingUp
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { useJobStore } from '../stores/useJobStore';
import { useGpuStore } from '../stores/useGpuStore';

// Helper functions
const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'text-green-600 bg-green-100';
    case 'inactive': return 'text-gray-600 bg-gray-100';
    case 'loading': return 'text-blue-600 bg-blue-100';
    case 'error': return 'text-red-600 bg-red-100';
    default: return 'text-gray-600 bg-gray-100';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'active': return <CheckCircle className="h-4 w-4" />;
    case 'inactive': return <Pause className="h-4 w-4" />;
    case 'loading': return <Activity className="h-4 w-4 animate-spin" />;
    case 'error': return <XCircle className="h-4 w-4" />;
    default: return <AlertCircle className="h-4 w-4" />;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'vision': return 'bg-blue-100 text-blue-800';
    case 'llm': return 'bg-purple-100 text-purple-800';
    case 'audio': return 'bg-green-100 text-green-800';
    case 'multimodal': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

interface ModelInfo {
  id: string;
  name: string;
  type: 'vision' | 'llm' | 'audio' | 'multimodal';
  version: string;
  size: number; // in GB
  status: 'active' | 'inactive' | 'loading' | 'error';
  description: string;
  capabilities: string[];
  gpuRequirement: {
    minVram: number;
    recommendedVram: number;
    computeCapability: string;
  };
  performance: {
    accuracy: number;
    speed: number; // inferences per second
    powerConsumption: number; // watts
  };
  usage: {
    totalInferences: number;
    avgResponseTime: number;
    lastUsed: Date;
  };
  downloadUrl?: string;
  isDownloaded: boolean;
  downloadProgress?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ModelCardProps {
  model: ModelInfo;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
  onConfigure: (model: ModelInfo) => void;
  onViewDetails: (model: ModelInfo) => void;
}

function ModelCard({ model, onStart, onStop, onDownload, onDelete, onConfigure, onViewDetails }: ModelCardProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{model.name}</h3>
              <p className="text-sm text-gray-500">v{model.version}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={cn(
              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
              getTypeColor(model.type)
            )}>
              {model.type.toUpperCase()}
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
                      onViewDetails(model);
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </button>
                  <button
                    onClick={() => {
                      onConfigure(model);
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </button>
                  {!model.isDownloaded && (
                    <button
                      onClick={() => {
                        onDownload(model.id);
                        setShowActions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onDelete(model.id);
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between mb-4">
          <div className={cn(
            'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
            getStatusColor(model.status)
          )}>
            {getStatusIcon(model.status)}
            <span className="ml-2 capitalize">{model.status}</span>
          </div>
          <div className="text-sm text-gray-500">
            {model.size.toFixed(1)} GB
          </div>
        </div>

        {/* Download Progress */}
        {model.downloadProgress !== undefined && model.downloadProgress < 100 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>Downloading...</span>
              <span>{model.downloadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${model.downloadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{model.description}</p>

        {/* Capabilities */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Capabilities</h4>
          <div className="flex flex-wrap gap-1">
            {model.capabilities.slice(0, 3).map((capability, index) => (
              <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                {capability}
              </span>
            ))}
            {model.capabilities.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                +{model.capabilities.length - 3} more
              </span>
            )}
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">
              {(model.performance.accuracy * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-500">Accuracy</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">
              {model.performance.speed.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">Inf/sec</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orange-600">
              {model.performance.powerConsumption}W
            </div>
            <div className="text-xs text-gray-500">Power</div>
          </div>
        </div>

        {/* GPU Requirements */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">GPU Requirements</h4>
          <div className="text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Min VRAM:</span>
              <span>{model.gpuRequirement.minVram} GB</span>
            </div>
            <div className="flex justify-between">
              <span>Recommended:</span>
              <span>{model.gpuRequirement.recommendedVram} GB</span>
            </div>
          </div>
        </div>

        {/* Usage Stats */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Usage Statistics</h4>
          <div className="text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Total Inferences:</span>
              <span>{model.usage.totalInferences.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Avg Response:</span>
              <span>{model.usage.avgResponseTime}ms</span>
            </div>
            <div className="flex justify-between">
              <span>Last Used:</span>
              <span>{format(model.usage.lastUsed, 'MMM dd')}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-2">
          {model.isDownloaded ? (
            <>
              {model.status === 'active' ? (
                <button
                  onClick={() => onStop(model.id)}
                  className="flex-1 flex items-center justify-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={() => onStart(model.id)}
                  className="flex-1 flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </button>
              )}
              <button
                onClick={() => onConfigure(model)}
                className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Settings className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => onDownload(model.id)}
              disabled={model.downloadProgress !== undefined}
              className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ModelManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [configuringModel, setConfiguringModel] = useState<ModelInfo | null>(null);

  // Real data from stores
  const { jobs, fetchJobs } = useJobStore();
  const { gpuInstances, fetchGpuInstances } = useGpuStore();
  const [models, setModels] = useState<ModelInfo[]>([]);

  // Generate models based on real data
  const generateModels = (): ModelInfo[] => {
    const baseModels: ModelInfo[] = [
      {
        id: '1',
        name: 'YOLO v8 Ultra',
        type: 'vision',
        version: '8.0.1',
        size: 2.3,
        status: gpuInstances.length > 0 && gpuInstances[0].status === 'running' ? 'active' : 'inactive',
        description: 'State-of-the-art object detection model for real-time video analysis with high accuracy.',
        capabilities: ['Object Detection', 'Person Detection', 'Vehicle Detection', 'Real-time Processing'],
        gpuRequirement: {
          minVram: 4,
          recommendedVram: 8,
          computeCapability: '6.1+'
        },
        performance: {
          accuracy: 0.94,
          speed: 45.2,
          powerConsumption: 180
        },
        usage: {
          totalInferences: jobs.filter(j => j.type === 'face_detection').length * 100,
          avgResponseTime: 22,
          lastUsed: jobs.length > 0 ? new Date(jobs[0].createdAt) : new Date(Date.now() - 2 * 60 * 60 * 1000)
        },
        isDownloaded: true,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-20')
      },
      {
        id: '2',
        name: 'Llama 3 Uncensored',
        type: 'llm',
        version: '3.1',
        size: 14.2,
        status: gpuInstances.length > 1 && gpuInstances[1]?.status === 'running' ? 'active' : 'inactive',
        description: 'Advanced large language model for natural language understanding and generation without content restrictions.',
        capabilities: ['Text Generation', 'Content Analysis', 'NSFW Analysis', 'Multi-language Support'],
        gpuRequirement: {
          minVram: 16,
          recommendedVram: 24,
          computeCapability: '7.0+'
        },
        performance: {
          accuracy: 0.91,
          speed: 12.8,
          powerConsumption: 320
        },
        usage: {
          totalInferences: jobs.filter(j => j.type === 'content_analysis').length * 150,
          avgResponseTime: 78,
          lastUsed: jobs.length > 1 ? new Date(jobs[1]?.createdAt || Date.now()) : new Date(Date.now() - 30 * 60 * 1000)
        },
        isDownloaded: true,
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-18')
      },
      {
        id: '3',
        name: 'FaceNet Enhanced',
        type: 'vision',
        version: '2.1',
        size: 1.8,
        status: 'inactive',
        description: 'High-precision facial recognition and embedding model for person identification.',
        capabilities: ['Face Recognition', 'Face Embedding', 'Age Estimation', 'Gender Classification'],
        gpuRequirement: {
          minVram: 2,
          recommendedVram: 4,
          computeCapability: '6.0+'
        },
        performance: {
          accuracy: 0.97,
          speed: 89.5,
          powerConsumption: 95
        },
        usage: {
          totalInferences: jobs.filter(j => j.type === 'face_detection').length * 200,
          avgResponseTime: 11,
          lastUsed: jobs.length > 2 ? new Date(jobs[2]?.createdAt || Date.now()) : new Date(Date.now() - 4 * 60 * 60 * 1000)
        },
        isDownloaded: true,
        createdAt: new Date('2024-01-08'),
        updatedAt: new Date('2024-01-16')
      },
      {
        id: '4',
        name: 'Whisper Large v3',
        type: 'audio',
        version: '3.0',
        size: 3.1,
        status: jobs.some(j => j.status === 'processing' && j.type === 'audio_transcription') ? 'loading' : 'inactive',
        description: 'Advanced speech recognition model supporting multiple languages with high accuracy.',
        capabilities: ['Speech Recognition', 'Audio Transcription', 'Multi-language', 'Noise Reduction'],
        gpuRequirement: {
          minVram: 6,
          recommendedVram: 8,
          computeCapability: '6.1+'
        },
        performance: {
          accuracy: 0.96,
          speed: 2.3,
          powerConsumption: 140
        },
        usage: {
          totalInferences: jobs.filter(j => j.type === 'audio_transcription').length * 80,
          avgResponseTime: 435,
          lastUsed: jobs.find(j => j.type === 'audio_transcription') ? new Date(jobs.find(j => j.type === 'audio_transcription')!.createdAt) : new Date(Date.now() - 6 * 60 * 60 * 1000)
        },
        isDownloaded: true,
        downloadProgress: jobs.some(j => j.status === 'processing' && j.type === 'audio_transcription') ? 73 : undefined,
        createdAt: new Date('2024-01-12'),
        updatedAt: new Date('2024-01-19')
      }
    ];

    // Add additional models based on GPU instances
    if (gpuInstances.length > 2) {
      baseModels.push({
        id: '5',
        name: 'CLIP Vision-Language',
        type: 'multimodal',
        version: '1.5',
        size: 5.7,
        status: gpuInstances[2].status === 'running' ? 'active' : 'error',
        description: 'Multimodal model for understanding images and text together for comprehensive analysis.',
        capabilities: ['Image-Text Understanding', 'Content Description', 'Scene Analysis', 'Cross-modal Search'],
        gpuRequirement: {
          minVram: 8,
          recommendedVram: 12,
          computeCapability: '7.0+'
        },
        performance: {
          accuracy: 0.89,
          speed: 18.7,
          powerConsumption: 210
        },
        usage: {
          totalInferences: jobs.filter(j => j.type === 'content_analysis').length * 50,
          avgResponseTime: 53,
          lastUsed: new Date(Date.now() - 12 * 60 * 60 * 1000)
        },
        isDownloaded: gpuInstances[2].status !== 'error',
        createdAt: new Date('2024-01-14'),
        updatedAt: new Date('2024-01-21')
      });
    }

    return baseModels;
  };

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchJobs(),
        fetchGpuInstances()
      ]);
    };
    loadData();
  }, [fetchJobs, fetchGpuInstances]);

  // Update models when data changes
  useEffect(() => {
    setModels(generateModels());
  }, [jobs, gpuInstances]);

  // Filter models
  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         model.capabilities.some(cap => cap.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = selectedType === 'all' || model.type === selectedType;
    return matchesSearch && matchesType;
  });

  // Statistics
  const totalModels = models.length;
  const activeModels = models.filter(m => m.status === 'active').length;
  const downloadedModels = models.filter(m => m.isDownloaded).length;
  const totalSize = models.filter(m => m.isDownloaded).reduce((sum, m) => sum + m.size, 0);
  const avgAccuracy = models.reduce((sum, m) => sum + m.performance.accuracy, 0) / models.length;

  const handleStartModel = (id: string) => {
    console.log('Starting model:', id);
  };

  const handleStopModel = (id: string) => {
    console.log('Stopping model:', id);
  };

  const handleDownloadModel = (id: string) => {
    console.log('Downloading model:', id);
  };

  const handleDeleteModel = (id: string) => {
    console.log('Deleting model:', id);
  };

  const handleConfigureModel = (model: ModelInfo) => {
    setConfiguringModel(model);
  };

  const handleViewDetails = (model: ModelInfo) => {
    setSelectedModel(model);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Model Management</h1>
          <p className="text-gray-600 mt-1">Manage ML/LLM models for media analysis</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Model
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Models</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalModels}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Brain className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Models</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{activeModels}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Downloaded</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{downloadedModels}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Download className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Storage Used</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{totalSize.toFixed(1)} GB</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <HardDrive className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg. Accuracy</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1">
                {(avgAccuracy * 100).toFixed(0)}%
              </p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Modelle nach Name, Beschreibung oder Fähigkeiten suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              <option value="vision">Vision</option>
              <option value="llm">LLM</option>
              <option value="audio">Audio</option>
              <option value="multimodal">Multimodal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Models Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredModels.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            onStart={handleStartModel}
            onStop={handleStopModel}
            onDownload={handleDownloadModel}
            onDelete={handleDeleteModel}
            onConfigure={handleConfigureModel}
            onViewDetails={handleViewDetails}
          />
        ))}
      </div>

      {filteredModels.length === 0 && (
        <div className="text-center py-12">
          <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No models found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery || selectedType !== 'all'
              ? 'Try adjusting your search criteria or filters'
              : 'Add your first ML/LLM model to get started'
            }
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Model
          </button>
        </div>
      )}

      {/* Model Details Modal */}
      {selectedModel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Brain className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedModel.name}</h2>
                    <p className="text-gray-600">Version {selectedModel.version}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedModel(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Model Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Model Information</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className={cn(
                        'px-2 py-1 rounded text-xs font-medium',
                        getTypeColor(selectedModel.type)
                      )}>
                        {selectedModel.type.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Size:</span>
                      <span className="font-medium">{selectedModel.size.toFixed(1)} GB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={cn(
                        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                        getStatusColor(selectedModel.status)
                      )}>
                        {getStatusIcon(selectedModel.status)}
                        <span className="ml-1 capitalize">{selectedModel.status}</span>
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Downloaded:</span>
                      <span className="font-medium">{selectedModel.isDownloaded ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                  
                  <h4 className="text-md font-semibold text-gray-900 mt-6 mb-3">Description</h4>
                  <p className="text-gray-600">{selectedModel.description}</p>
                  
                  <h4 className="text-md font-semibold text-gray-900 mt-6 mb-3">Capabilities</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedModel.capabilities.map((capability, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Performance & Requirements */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Performance Metrics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Accuracy:</span>
                      <span className="font-medium">{(selectedModel.performance.accuracy * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Speed:</span>
                      <span className="font-medium">{selectedModel.performance.speed.toFixed(1)} inf/sec</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Power Consumption:</span>
                      <span className="font-medium">{selectedModel.performance.powerConsumption}W</span>
                    </div>
                  </div>
                  
                  <h4 className="text-md font-semibold text-gray-900 mt-6 mb-3">GPU Requirements</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Minimum VRAM:</span>
                      <span className="font-medium">{selectedModel.gpuRequirement.minVram} GB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Recommended VRAM:</span>
                      <span className="font-medium">{selectedModel.gpuRequirement.recommendedVram} GB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Compute Capability:</span>
                      <span className="font-medium">{selectedModel.gpuRequirement.computeCapability}</span>
                    </div>
                  </div>
                  
                  <h4 className="text-md font-semibold text-gray-900 mt-6 mb-3">Usage Statistics</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Inferences:</span>
                      <span className="font-medium">{selectedModel.usage.totalInferences.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg Response Time:</span>
                      <span className="font-medium">{selectedModel.usage.avgResponseTime}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Used:</span>
                      <span className="font-medium">{format(selectedModel.usage.lastUsed, 'MMM dd, yyyy HH:mm')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Model Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Add New Model</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Modellname
                  </label>
                  <input
                    type="text"
                    placeholder="Modellname eingeben..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Modelltyp
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option value="vision">Vision</option>
                    <option value="llm">LLM</option>
                    <option value="audio">Audio</option>
                    <option value="multimodal">Multimodal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Download-URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Model
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configure Model Modal */}
      {configuringModel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Configure {configuringModel.name}</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Batch Size
                  </label>
                  <input
                    type="number"
                    defaultValue={32}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Memory (GB)
                  </label>
                  <input
                    type="number"
                    defaultValue={configuringModel.gpuRequirement.recommendedVram}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Precision
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option value="fp32">FP32 (Full Precision)</option>
                    <option value="fp16">FP16 (Half Precision)</option>
                    <option value="int8">INT8 (Quantized)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Temperature
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    defaultValue={0.7}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setConfiguringModel(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setConfiguringModel(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}