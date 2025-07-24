import React, { useState, useEffect } from 'react';
import { Upload, Camera, Mic, Users, Brain, FileImage, FileAudio, Activity, Zap, X, Eye } from 'lucide-react';
import { toast } from 'sonner';
import DragDropUpload from '../components/FileUpload/DragDropUpload';
import JobStatusCard from '../components/JobStatus/JobStatusCard';
import NotificationCenter from '../components/Notifications/NotificationCenter';
import { apiService } from '../services/apiService';
import { websocketService } from '../services/websocketService';
import type { 
  FileWithPreview, 
  JobStatus, 
  MLStats, 
  FaceDetectionResult, 
  TranscriptionResult 
} from '../types/common';

const MLDashboard: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([]);
  const [faceResults, setFaceResults] = useState<any>(null);
  const [transcriptionResults, setTranscriptionResults] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'face' | 'audio'>('face');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [mlStats, setMlStats] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('DISCONNECTED');

  useEffect(() => {
    // Initialize WebSocket connection
    const initializeWebSocket = async () => {
      try {
        await websocketService.connect();
        setConnectionStatus(websocketService.connectionState);
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setConnectionStatus('DISCONNECTED');
      }
    };

    // Load ML stats
    const loadMLStats = async () => {
      const response = await apiService.getMLStats();
      if (response.success) {
        setMlStats(response.data);
      }
    };

    initializeWebSocket();
    loadMLStats();

    // Monitor connection status
    const statusInterval = setInterval(() => {
      setConnectionStatus(websocketService.connectionState);
    }, 5000);

    return () => {
      clearInterval(statusInterval);
      websocketService.disconnect();
    };
  }, []);

  const handleFilesSelected = (files: FileWithPreview[]) => {
    setSelectedFiles(files);
    setFaceResults(null);
    setTranscriptionResults(null);
    setCurrentJobId(null);
  };

  const processFaceDetection = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select a file first');
      return;
    }

    const file = selectedFiles[0];
    setIsProcessing(true);
    
    try {
      const response = await apiService.detectFaces(file);
      
      if (response.success && response.data) {
        setFaceResults(response.data);
        toast.success('Face detection completed successfully!');
      } else {
        toast.error(response.error || 'Face detection failed');
      }
    } catch (error) {
      toast.error('Error processing face detection');
    } finally {
      setIsProcessing(false);
    }
  };

  const processAudioTranscription = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select a file first');
      return;
    }

    const file = selectedFiles[0];
    setIsProcessing(true);
    
    try {
      const response = await apiService.transcribeAudio(file);
      
      if (response.success && response.data) {
        setTranscriptionResults(response.data);
        toast.success('Audio transcription completed successfully!');
      } else {
        toast.error(response.error || 'Audio transcription failed');
      }
    } catch (error) {
      toast.error('Error processing audio transcription');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleJobStatusChange = (status: JobStatus) => {
    if (status.status === 'COMPLETED' && status.result) {
      if (activeTab === 'face') {
        setFaceResults(status.result);
      } else {
        setTranscriptionResults(status.result);
      }
    }
    setIsProcessing(status.status === 'PROCESSING');
  };

  const getAcceptedTypes = () => {
    return activeTab === 'face' ? ['image/*'] : ['audio/*', 'video/*'];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4 flex items-center justify-center gap-3">
            <Brain className="text-purple-600" size={40} />
            ML Dashboard
          </h1>
          <p className="text-gray-600 text-lg">
            Advanced Machine Learning Pipeline for Face Detection &amp; Audio Transcription
          </p>
          
          {/* Connection Status */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                connectionStatus === 'CONNECTED' ? 'bg-green-500' : 
                connectionStatus === 'CONNECTING' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
              }`}></div>
              <span className="text-sm text-gray-600">
                WebSocket: {connectionStatus}
              </span>
            </div>
            
            {mlStats && (
              <div className="flex items-center gap-2">
                <Activity className="text-blue-500" size={16} />
                <span className="text-sm text-gray-600">
                  {mlStats.totalJobs || 0} jobs processed
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-md">
            <button
              onClick={() => setActiveTab('face')}
              className={`px-6 py-3 rounded-md font-medium transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'face'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              <Camera size={20} />
              Face Detection
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`px-6 py-3 rounded-md font-medium transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'audio'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              <Mic size={20} />
              Audio Transcription
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Upload className="text-indigo-600" size={24} />
              Upload File
            </h2>
            
            <DragDropUpload
               onFilesSelected={handleFilesSelected}
               acceptedTypes={getAcceptedTypes()}
               maxFiles={activeTab === 'face' ? 5 : 1}
               maxSize={50}
             />
            
            {selectedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {file.preview && (
                        <img src={file.preview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-800">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const newFiles = selectedFiles.filter((_, i) => i !== index);
                        setSelectedFiles(newFiles);
                      }}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedFiles.length > 0 && (
              <button
                onClick={activeTab === 'face' ? processFaceDetection : processAudioTranscription}
                disabled={isProcessing}
                className={`w-full mt-4 py-3 px-6 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                  activeTab === 'face'
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    {activeTab === 'face' ? <Camera size={20} /> : <Mic size={20} />}
                    {activeTab === 'face' ? 'Detect Faces' : 'Transcribe Audio'}
                  </>
                )}
              </button>
            )}
            
            {/* Job Status Card */}
            {currentJobId && (
              <div className="mt-6">
                <JobStatusCard
                  jobId={currentJobId}
                  onStatusChange={handleJobStatusChange}
                />
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Users className="text-green-600" size={24} />
              Results
            </h2>

            {activeTab === 'face' && faceResults && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-2">Face Detection Results</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Faces Detected:</span>
                      <span className="ml-2 font-semibold text-green-700">{faceResults?.faces?.length || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Processing Time:</span>
                      <span className="ml-2 font-semibold text-green-700">{faceResults.processingTime}ms</span>
                    </div>
                  </div>
                </div>

                {faceResults?.faces?.map((face: any, index: number) => (
                  <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">Face {index + 1}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Bounding Box:</span>
                        <span className="ml-2 text-blue-700">
                          [{face.bbox?.join(', ') || 'N/A'}]
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Confidence:</span>
                        <span className="ml-2 text-blue-700">{((face.confidence || 0) * 100).toFixed(1)}%</span>
                      </div>
                      {face.age && (
                        <div>
                          <span className="text-gray-600">Age:</span>
                          <span className="ml-2 text-blue-700">{face.age}</span>
                        </div>
                      )}
                      {face.gender && (
                        <div>
                          <span className="text-gray-600">Gender:</span>
                          <span className="ml-2 text-blue-700">{face.gender}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )) || []}
              </div>
            )}

            {activeTab === 'audio' && transcriptionResults && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-2">Transcription Results</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-600">Language:</span>
                      <span className="ml-2 font-semibold text-green-700">{transcriptionResults?.language || 'Unknown'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Confidence:</span>
                      <span className="ml-2 font-semibold text-green-700">
                        {transcriptionResults?.confidence ? (transcriptionResults.confidence * 100).toFixed(1) + '%' : 'N/A'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-600">Processing Time:</span>
                      <span className="ml-2 font-semibold text-green-700">{transcriptionResults?.processingTime || 'N/A'}ms</span>
                    </div>
                    {transcriptionResults?.duration && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Duration:</span>
                        <span className="ml-2 font-semibold text-green-700">{transcriptionResults.duration.toFixed(2)}s</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-white p-4 rounded border">
                    <h4 className="font-semibold text-gray-800 mb-2">Transcribed Text:</h4>
                    <p className="text-gray-700 leading-relaxed">{transcriptionResults?.text || 'No transcription available'}</p>
                  </div>
                </div>
              </div>
            )}

            {!faceResults && !transcriptionResults && (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  {activeTab === 'face' ? <Camera size={48} /> : <Mic size={48} />}
                </div>
                <p className="text-gray-500">
                  {activeTab === 'face'
                    ? 'Upload an image and click "Detect Faces" to see results'
                    : 'Upload audio/video and click "Transcribe Audio" to see results'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-purple-600 mb-2">
              <Camera size={32} className="mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Face Detection</h3>
            <p className="text-gray-600 text-sm mt-2">
              Advanced AI-powered face detection with high accuracy
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-blue-600 mb-2">
              <Mic size={32} className="mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Audio Transcription</h3>
            <p className="text-gray-600 text-sm mt-2">
              Speech-to-text conversion with multi-language support
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-green-600 mb-2">
              <Brain size={32} className="mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">ML Pipeline</h3>
            <p className="text-gray-600 text-sm mt-2">
              Scalable machine learning processing infrastructure
            </p>
          </div>
        </div>
        
        {/* Notification Center */}
        <NotificationCenter />
      </div>
    </div>
  );
};

export default MLDashboard;