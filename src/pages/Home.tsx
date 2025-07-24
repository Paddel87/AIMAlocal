import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Brain, 
  Cpu, 
  Users, 
  HardDrive, 
  Play, 
  ArrowRight,
  Shield,
  Zap,
  Globe
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                AIMA
              </span>
            </h1>
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-800 mb-4">
              Artificial Intelligence Media Analysis
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Advanced ML/LLM-powered video and photo analysis system with person recognition, 
              audio transcription, and comprehensive media intelligence.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/dashboard"
                className="inline-flex items-center px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg"
              >
                <Play className="h-5 w-5 mr-2" />
                Launch Dashboard
                <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
              <Link
                to="/gpu"
                className="inline-flex items-center px-8 py-4 border-2 border-blue-600 text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-colors"
              >
                <Cpu className="h-5 w-5 mr-2" />
                GPU Management
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">Powerful AI-Driven Analysis</h3>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Leverage cutting-edge machine learning models for comprehensive media analysis
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Person Recognition */}
          <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <h4 className="text-xl font-semibold text-gray-900 mb-4">Person Recognition</h4>
            <p className="text-gray-600 mb-4">
              Advanced facial recognition and person tracking across video and image content with comprehensive dossier management.
            </p>
            <Link 
              to="/persons" 
              className="text-blue-600 font-medium hover:text-blue-700 inline-flex items-center"
            >
              Explore Dossiers <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          {/* GPU Management */}
          <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center mb-6">
              <Cpu className="h-6 w-6 text-green-600" />
            </div>
            <h4 className="text-xl font-semibold text-gray-900 mb-4">GPU Clusters</h4>
            <p className="text-gray-600 mb-4">
              Manage and monitor AIMA-administered GPU instances for optimal ML model performance and resource allocation.
            </p>
            <Link 
              to="/gpu" 
              className="text-green-600 font-medium hover:text-green-700 inline-flex items-center"
            >
              Manage GPUs <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          {/* Model Management */}
          <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
              <Brain className="h-6 w-6 text-purple-600" />
            </div>
            <h4 className="text-xl font-semibold text-gray-900 mb-4">ML Models</h4>
            <p className="text-gray-600 mb-4">
              Deploy and manage open-source ML/LLM models including YOLO, FaceNet, Llama, and Whisper for comprehensive analysis.
            </p>
            <Link 
              to="/models" 
              className="text-purple-600 font-medium hover:text-purple-700 inline-flex items-center"
            >
              View Models <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          {/* Storage Management */}
          <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="h-12 w-12 bg-orange-100 rounded-xl flex items-center justify-center mb-6">
              <HardDrive className="h-6 w-6 text-orange-600" />
            </div>
            <h4 className="text-xl font-semibold text-gray-900 mb-4">Storage Systems</h4>
            <p className="text-gray-600 mb-4">
              Centralized media storage with cloud integration, automated organization, and intelligent file management.
            </p>
            <Link 
              to="/storage" 
              className="text-orange-600 font-medium hover:text-orange-700 inline-flex items-center"
            >
              Manage Storage <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          {/* Job Processing */}
          <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="h-12 w-12 bg-red-100 rounded-xl flex items-center justify-center mb-6">
              <Zap className="h-6 w-6 text-red-600" />
            </div>
            <h4 className="text-xl font-semibold text-gray-900 mb-4">Job Processing</h4>
            <p className="text-gray-600 mb-4">
              Automated batch processing with real-time monitoring, priority queuing, and comprehensive result analysis.
            </p>
            <Link 
              to="/jobs" 
              className="text-red-600 font-medium hover:text-red-700 inline-flex items-center"
            >
              View Jobs <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>

          {/* Security & Privacy */}
          <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
              <Shield className="h-6 w-6 text-indigo-600" />
            </div>
            <h4 className="text-xl font-semibold text-gray-900 mb-4">Security & Privacy</h4>
            <p className="text-gray-600 mb-4">
              Self-hosted infrastructure with uncensored models, ensuring complete data privacy and security control.
            </p>
            <div className="text-indigo-600 font-medium inline-flex items-center">
              Enterprise Ready <Shield className="h-4 w-4 ml-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Technical Specifications */}
      <div className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4">Technical Foundation</h3>
            <p className="text-gray-300 text-lg max-w-2xl mx-auto">
              Built on cutting-edge open-source technologies for maximum flexibility and performance
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400 mb-2">YOLO v8</div>
              <div className="text-gray-300">Object Detection</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">FaceNet</div>
              <div className="text-gray-300">Face Recognition</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400 mb-2">Llama 3</div>
              <div className="text-gray-300">Language Models</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-400 mb-2">Whisper</div>
              <div className="text-gray-300">Speech Recognition</div>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 text-center text-white">
          <h3 className="text-3xl font-bold mb-4">Ready to Get Started?</h3>
          <p className="text-xl mb-8 opacity-90">
            Launch the AIMA dashboard and begin analyzing your media with advanced AI capabilities
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
          >
            <Play className="h-5 w-5 mr-2" />
            Open Dashboard
            <ArrowRight className="h-5 w-5 ml-2" />
          </Link>
        </div>
      </div>
    </div>
  );
}