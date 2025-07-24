import React, { useState } from 'react';
import { 
  HardDrive, 
  Folder, 
  File, 
  Image, 
  Video, 
  Music, 
  FileText, 
  Download, 
  Upload, 
  Trash2, 
  Search, 
  Filter, 
  MoreVertical, 
  Eye, 
  Share, 
  Cloud, 
  Server, 
  Database,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  Lock,
  Unlock
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface StorageItem {
  id: string;
  name: string;
  type: 'folder' | 'image' | 'video' | 'audio' | 'document' | 'other';
  size: number; // in bytes
  path: string;
  createdAt: Date;
  modifiedAt: Date;
  owner: string;
  permissions: 'read' | 'write' | 'admin';
  isShared: boolean;
  tags: string[];
  jobId?: string;
  analysisStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  thumbnail?: string;
  metadata?: {
    duration?: number;
    resolution?: string;
    format?: string;
    codec?: string;
  };
}

interface StorageLocation {
  id: string;
  name: string;
  type: 'local' | 'cloud' | 'network';
  totalSpace: number; // in bytes
  usedSpace: number; // in bytes
  status: 'online' | 'offline' | 'syncing' | 'error';
  mountPoint: string;
  isDefault: boolean;
}

interface FileItemProps {
  item: StorageItem;
  onSelect: (item: StorageItem) => void;
  onDownload: (item: StorageItem) => void;
  onDelete: (id: string) => void;
  onShare: (item: StorageItem) => void;
  isSelected: boolean;
}

function FileItem({ item, onSelect, onDownload, onDelete, onShare, isSelected }: FileItemProps) {
  const [showActions, setShowActions] = useState(false);

  const getFileIcon = (type: StorageItem['type']) => {
    switch (type) {
      case 'folder': return <Folder className="h-8 w-8 text-blue-600" />;
      case 'image': return <Image className="h-8 w-8 text-green-600" />;
      case 'video': return <Video className="h-8 w-8 text-red-600" />;
      case 'audio': return <Music className="h-8 w-8 text-purple-600" />;
      case 'document': return <FileText className="h-8 w-8 text-orange-600" />;
      default: return <File className="h-8 w-8 text-gray-600" />;
    }
  };

  const getStatusColor = (status?: StorageItem['analysisStatus']) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div 
      className={cn(
        'bg-white rounded-lg border-2 p-4 hover:shadow-md transition-all cursor-pointer',
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      )}
      onClick={() => onSelect(item)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {item.thumbnail ? (
            <img 
              src={item.thumbnail} 
              alt={item.name}
              className="h-8 w-8 rounded object-cover"
            />
          ) : (
            getFileIcon(item.type)
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate">{item.name}</h3>
            <p className="text-sm text-gray-500">{formatFileSize(item.size)}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {item.isShared && (
            <Share className="h-4 w-4 text-blue-600" />
          )}
          {item.permissions === 'admin' ? (
            <Lock className="h-4 w-4 text-red-600" />
          ) : (
            <Unlock className="h-4 w-4 text-green-600" />
          )}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(!showActions);
              }}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {showActions && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(item);
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(item);
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare(item);
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                >
                  <Share className="h-4 w-4 mr-2" />
                  Share
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.id);
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

      {/* Analysis Status */}
      {item.analysisStatus && (
        <div className="mb-3">
          <span className={cn(
            'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
            getStatusColor(item.analysisStatus)
          )}>
            {item.analysisStatus === 'processing' && <Clock className="h-3 w-3 mr-1" />}
            {item.analysisStatus === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
            {item.analysisStatus === 'failed' && <AlertTriangle className="h-3 w-3 mr-1" />}
            Analysis {item.analysisStatus}
          </span>
        </div>
      )}

      {/* Metadata */}
      {item.metadata && (
        <div className="mb-3 text-xs text-gray-500">
          {item.metadata.duration && (
            <span className="mr-3">Duration: {Math.floor(item.metadata.duration / 60)}:{(item.metadata.duration % 60).toString().padStart(2, '0')}</span>
          )}
          {item.metadata.resolution && (
            <span className="mr-3">Resolution: {item.metadata.resolution}</span>
          )}
          {item.metadata.format && (
            <span>Format: {item.metadata.format}</span>
          )}
        </div>
      )}

      {/* Tags */}
      {item.tags.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag, index) => (
              <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                {tag}
              </span>
            ))}
            {item.tags.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                +{item.tags.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Modified {format(item.modifiedAt, 'MMM dd, yyyy')}</span>
        <span>by {item.owner}</span>
      </div>
    </div>
  );
}

interface StorageLocationCardProps {
  location: StorageLocation;
  onSelect: (location: StorageLocation) => void;
  isSelected: boolean;
}

function StorageLocationCard({ location, onSelect, isSelected }: StorageLocationCardProps) {
  const getLocationIcon = (type: StorageLocation['type']) => {
    switch (type) {
      case 'local': return <HardDrive className="h-6 w-6 text-blue-600" />;
      case 'cloud': return <Cloud className="h-6 w-6 text-green-600" />;
      case 'network': return <Server className="h-6 w-6 text-purple-600" />;
      default: return <Database className="h-6 w-6 text-gray-600" />;
    }
  };

  const getStatusColor = (status: StorageLocation['status']) => {
    switch (status) {
      case 'online': return 'text-green-600 bg-green-100';
      case 'offline': return 'text-red-600 bg-red-100';
      case 'syncing': return 'text-blue-600 bg-blue-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const usagePercentage = (location.usedSpace / location.totalSpace) * 100;

  return (
    <div 
      className={cn(
        'bg-white rounded-xl shadow-sm border-2 p-6 cursor-pointer hover:shadow-md transition-all',
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      )}
      onClick={() => onSelect(location)}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {getLocationIcon(location.type)}
          <div>
            <h3 className="font-semibold text-gray-900">{location.name}</h3>
            <p className="text-sm text-gray-500 capitalize">{location.type} Storage</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {location.isDefault && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
              Default
            </span>
          )}
          <span className={cn(
            'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
            getStatusColor(location.status)
          )}>
            {location.status === 'syncing' && <Clock className="h-3 w-3 mr-1 animate-spin" />}
            {location.status === 'online' && <CheckCircle className="h-3 w-3 mr-1" />}
            {location.status === 'error' && <AlertTriangle className="h-3 w-3 mr-1" />}
            {location.status}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>Storage Usage</span>
          <span>{formatBytes(location.usedSpace)} / {formatBytes(location.totalSpace)}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={cn(
              'h-2 rounded-full transition-all duration-300',
              usagePercentage > 90 ? 'bg-red-500' : usagePercentage > 70 ? 'bg-yellow-500' : 'bg-green-500'
            )}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {usagePercentage.toFixed(1)}% used
        </div>
      </div>

      <div className="text-sm text-gray-600">
        <span className="font-medium">Mount Point:</span> {location.mountPoint}
      </div>
    </div>
  );
}

export default function StorageManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<StorageLocation | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StorageItem | null>(null);

  // Mock data - in real app this would come from stores
  const [storageLocations] = useState<StorageLocation[]>([
    {
      id: '1',
      name: 'Primary SSD',
      type: 'local',
      totalSpace: 2000000000000, // 2TB
      usedSpace: 1200000000000, // 1.2TB
      status: 'online',
      mountPoint: '/mnt/primary',
      isDefault: true
    },
    {
      id: '2',
      name: 'Cloud Storage',
      type: 'cloud',
      totalSpace: 5000000000000, // 5TB
      usedSpace: 800000000000, // 800GB
      status: 'syncing',
      mountPoint: '/mnt/cloud',
      isDefault: false
    },
    {
      id: '3',
      name: 'Network Archive',
      type: 'network',
      totalSpace: 10000000000000, // 10TB
      usedSpace: 7500000000000, // 7.5TB
      status: 'online',
      mountPoint: '/mnt/archive',
      isDefault: false
    }
  ]);

  const [storageItems] = useState<StorageItem[]>([
    {
      id: '1',
      name: 'Security_Camera_Feed_001.mp4',
      type: 'video',
      size: 2500000000, // 2.5GB
      path: '/media/videos/security/',
      createdAt: new Date('2024-01-20T10:30:00'),
      modifiedAt: new Date('2024-01-20T10:30:00'),
      owner: 'admin',
      permissions: 'admin',
      isShared: false,
      tags: ['security', 'surveillance', 'outdoor'],
      jobId: 'job_001',
      analysisStatus: 'completed',
      metadata: {
        duration: 3600, // 1 hour
        resolution: '1920x1080',
        format: 'MP4',
        codec: 'H.264'
      }
    },
    {
      id: '2',
      name: 'Person_Recognition_Dataset',
      type: 'folder',
      size: 15000000000, // 15GB
      path: '/datasets/persons/',
      createdAt: new Date('2024-01-18T14:20:00'),
      modifiedAt: new Date('2024-01-21T09:15:00'),
      owner: 'ml_engineer',
      permissions: 'write',
      isShared: true,
      tags: ['dataset', 'faces', 'training'],
      analysisStatus: 'processing'
    },
    {
      id: '3',
      name: 'Audio_Interview_001.wav',
      type: 'audio',
      size: 450000000, // 450MB
      path: '/media/audio/interviews/',
      createdAt: new Date('2024-01-19T16:45:00'),
      modifiedAt: new Date('2024-01-19T16:45:00'),
      owner: 'analyst',
      permissions: 'read',
      isShared: false,
      tags: ['interview', 'transcription', 'evidence'],
      jobId: 'job_003',
      analysisStatus: 'completed',
      metadata: {
        duration: 2700, // 45 minutes
        format: 'WAV',
        codec: 'PCM'
      }
    },
    {
      id: '4',
      name: 'Surveillance_Photos_Batch_A',
      type: 'folder',
      size: 8500000000, // 8.5GB
      path: '/media/images/surveillance/',
      createdAt: new Date('2024-01-17T11:30:00'),
      modifiedAt: new Date('2024-01-20T15:20:00'),
      owner: 'security_team',
      permissions: 'write',
      isShared: true,
      tags: ['surveillance', 'batch', 'analysis'],
      analysisStatus: 'pending'
    },
    {
      id: '5',
      name: 'Analysis_Report_Jan2024.pdf',
      type: 'document',
      size: 25000000, // 25MB
      path: '/reports/monthly/',
      createdAt: new Date('2024-01-21T08:00:00'),
      modifiedAt: new Date('2024-01-21T08:00:00'),
      owner: 'admin',
      permissions: 'admin',
      isShared: false,
      tags: ['report', 'analysis', 'monthly']
    }
  ]);

  // Filter items
  const filteredItems = storageItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = selectedType === 'all' || item.type === selectedType;
    return matchesSearch && matchesType;
  });

  // Statistics
  const totalFiles = storageItems.length;
  const totalSize = storageItems.reduce((sum, item) => sum + item.size, 0);
  const sharedFiles = storageItems.filter(item => item.isShared).length;
  const processingFiles = storageItems.filter(item => item.analysisStatus === 'processing').length;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleSelectItem = (item: StorageItem) => {
    setSelectedItem(item);
  };

  const handleDownloadItem = (item: StorageItem) => {
    console.log('Downloading:', item.name);
  };

  const handleDeleteItem = (id: string) => {
    console.log('Deleting item:', id);
  };

  const handleShareItem = (item: StorageItem) => {
    console.log('Sharing:', item.name);
  };

  const handleSelectLocation = (location: StorageLocation) => {
    setSelectedLocation(location);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Storage Management</h1>
          <p className="text-gray-600 mt-1">Manage media files and storage resources</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Files</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalFiles}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <File className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Size</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatBytes(totalSize)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <HardDrive className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Shared Files</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{sharedFiles}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Share className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Processing</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{processingFiles}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Storage Locations */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Storage Locations</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {storageLocations.map((location) => (
            <StorageLocationCard
              key={location.id}
              location={location}
              onSelect={handleSelectLocation}
              isSelected={selectedLocation?.id === location.id}
            />
          ))}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search files by name or tags..."
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
              <option value="folder">Folders</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="audio">Audio</option>
              <option value="document">Documents</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-lg transition-colors',
                viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <BarChart3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-lg transition-colors',
                viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <File className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Files Grid */}
      <div className={cn(
        'grid gap-6',
        viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'
      )}>
        {filteredItems.map((item) => (
          <FileItem
            key={item.id}
            item={item}
            onSelect={handleSelectItem}
            onDownload={handleDownloadItem}
            onDelete={handleDeleteItem}
            onShare={handleShareItem}
            isSelected={selectedItems.includes(item.id)}
          />
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <File className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery || selectedType !== 'all'
              ? 'Try adjusting your search criteria or filters'
              : 'Upload your first files to get started'
            }
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </button>
        </div>
      )}

      {/* File Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {selectedItem.thumbnail ? (
                    <img 
                      src={selectedItem.thumbnail} 
                      alt={selectedItem.name}
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
                      {selectedItem.type === 'folder' && <Folder className="h-6 w-6 text-blue-600" />}
                      {selectedItem.type === 'image' && <Image className="h-6 w-6 text-green-600" />}
                      {selectedItem.type === 'video' && <Video className="h-6 w-6 text-red-600" />}
                      {selectedItem.type === 'audio' && <Music className="h-6 w-6 text-purple-600" />}
                      {selectedItem.type === 'document' && <FileText className="h-6 w-6 text-orange-600" />}
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedItem.name}</h2>
                    <p className="text-gray-600 capitalize">{selectedItem.type}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">File Information</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Size:</span>
                      <span className="font-medium">{formatBytes(selectedItem.size)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium capitalize">{selectedItem.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Owner:</span>
                      <span className="font-medium">{selectedItem.owner}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Permissions:</span>
                      <span className="font-medium capitalize">{selectedItem.permissions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shared:</span>
                      <span className="font-medium">{selectedItem.isShared ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Created:</span>
                      <span className="font-medium">{format(selectedItem.createdAt, 'MMM dd, yyyy HH:mm')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Modified:</span>
                      <span className="font-medium">{format(selectedItem.modifiedAt, 'MMM dd, yyyy HH:mm')}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Analysis & Metadata</h3>
                  <div className="space-y-3">
                    {selectedItem.jobId && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Job ID:</span>
                        <span className="font-medium">{selectedItem.jobId}</span>
                      </div>
                    )}
                    {selectedItem.analysisStatus && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Analysis Status:</span>
                        <span className="font-medium capitalize">{selectedItem.analysisStatus}</span>
                      </div>
                    )}
                    {selectedItem.metadata?.duration && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Duration:</span>
                        <span className="font-medium">
                          {Math.floor(selectedItem.metadata.duration / 60)}:{(selectedItem.metadata.duration % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    )}
                    {selectedItem.metadata?.resolution && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Resolution:</span>
                        <span className="font-medium">{selectedItem.metadata.resolution}</span>
                      </div>
                    )}
                    {selectedItem.metadata?.format && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Format:</span>
                        <span className="font-medium">{selectedItem.metadata.format}</span>
                      </div>
                    )}
                    {selectedItem.metadata?.codec && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Codec:</span>
                        <span className="font-medium">{selectedItem.metadata.codec}</span>
                      </div>
                    )}
                  </div>

                  {selectedItem.tags.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-md font-semibold text-gray-900 mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.tags.map((tag, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleDownloadItem(selectedItem)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </button>
                  <button
                    onClick={() => handleShareItem(selectedItem)}
                    className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Share className="h-4 w-4 mr-2" />
                    Share
                  </button>
                  <button
                    onClick={() => {
                      handleDeleteItem(selectedItem.id);
                      setSelectedItem(null);
                    }}
                    className="flex items-center px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Upload Files</h2>
            </div>
            <div className="p-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Drop files here</h3>
                <p className="text-gray-500 mb-4">or click to browse</p>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Select Files
                </button>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}