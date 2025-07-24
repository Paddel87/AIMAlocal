import React, { useState } from 'react';
import { 
  Cpu, 
  Plus, 
  Settings, 
  Power, 
  AlertTriangle, 
  Activity,
  Thermometer,
  Zap,
  HardDrive,
  Clock,
  DollarSign,
  MoreVertical,
  Pause,
  Square
} from 'lucide-react';
import { useGpuStore, type GpuInstance } from '../stores/useGpuStore';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface GpuCardProps {
  gpu: GpuInstance;
  onSelect: (gpu: GpuInstance) => void;
  onStatusChange: (id: string, status: GpuInstance['status']) => void;
}

function GpuCard({ gpu, onSelect, onStatusChange }: GpuCardProps) {
  const [showActions, setShowActions] = useState(false);

  const statusConfig = {
    online: { 
      color: 'bg-green-100 text-green-800 border-green-200', 
      dot: 'bg-green-400',
      bgColor: 'bg-green-50'
    },
    busy: { 
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
      dot: 'bg-yellow-400',
      bgColor: 'bg-yellow-50'
    },
    offline: { 
      color: 'bg-red-100 text-red-800 border-red-200', 
      dot: 'bg-red-400',
      bgColor: 'bg-red-50'
    },
    maintenance: { 
      color: 'bg-gray-100 text-gray-800 border-gray-200', 
      dot: 'bg-gray-400',
      bgColor: 'bg-gray-50'
    }
  };

  const config = statusConfig[gpu.status];
  const memoryUsagePercent = (gpu.memory.used / gpu.memory.total) * 100;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={cn("p-2 rounded-lg", config.bgColor)}>
              <Cpu className="h-6 w-6 text-gray-700" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{gpu.name}</h3>
              <p className="text-sm text-gray-500">{gpu.type} • {gpu.location}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={cn("h-3 w-3 rounded-full", config.dot)}></div>
            <span className={cn(
              "px-2 py-1 text-xs font-medium rounded-full border",
              config.color
            )}>
              {gpu.status}
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
                      onSelect(gpu);
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </button>
                  <button
                    onClick={() => {
                      onStatusChange(gpu.id, gpu.status === 'online' ? 'offline' : 'online');
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                  >
                    <Power className="h-4 w-4 mr-2" />
                    {gpu.status === 'online' ? 'Stop' : 'Start'}
                  </button>
                  <button
                    onClick={() => {
                      onStatusChange(gpu.id, 'maintenance');
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Maintenance
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Utilization</span>
              </div>
              <span className="text-lg font-bold text-gray-900">{gpu.utilization}%</span>
            </div>
            <div className="mt-2 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${gpu.utilization}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Thermometer className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-gray-700">Temperature</span>
              </div>
              <span className="text-lg font-bold text-gray-900">{gpu.temperature}°C</span>
            </div>
            <div className="mt-2 bg-gray-200 rounded-full h-2">
              <div 
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  gpu.temperature > 80 ? "bg-red-600" : 
                  gpu.temperature > 70 ? "bg-yellow-600" : "bg-green-600"
                )}
                style={{ width: `${Math.min(100, (gpu.temperature / 90) * 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-gray-700">Memory</span>
              </div>
              <span className="text-lg font-bold text-gray-900">{memoryUsagePercent.toFixed(0)}%</span>
            </div>
            <div className="mt-2 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${memoryUsagePercent}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {(gpu.memory.used / 1024).toFixed(1)}GB / {(gpu.memory.total / 1024).toFixed(1)}GB
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-gray-700">Power</span>
              </div>
              <span className="text-lg font-bold text-gray-900">{gpu.powerUsage}W</span>
            </div>
            <div className="mt-2 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (gpu.powerUsage / 450) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Current Jobs */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Current Jobs</h4>
          {gpu.currentJobs.length > 0 ? (
            <div className="space-y-1">
              {gpu.currentJobs.map((jobId) => (
                <div key={jobId} className="flex items-center justify-between bg-blue-50 rounded px-3 py-2">
                  <span className="text-sm font-medium text-blue-900">{jobId}</span>
                  <div className="flex items-center space-x-1">
                    <button className="p-1 text-blue-600 hover:text-blue-800">
                      <Pause className="h-3 w-3" />
                    </button>
                    <button className="p-1 text-red-600 hover:text-red-800">
                      <Square className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No active jobs</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>Last seen: {format(gpu.lastHeartbeat, 'HH:mm')}</span>
            </div>
            <div className="flex items-center space-x-1">
              <DollarSign className="h-4 w-4" />
              <span>{gpu.cost.currency} {gpu.cost.perHour}/h</span>
            </div>
          </div>
          <button
            onClick={() => onSelect(gpu)}
            className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GpuManagement() {
  const { instances, selectedInstance, selectInstance, updateInstanceStatus } = useGpuStore();
  const [, setShowAddModal] = useState(false);

  const totalInstances = instances.length;
  const onlineInstances = instances.filter(gpu => gpu.status === 'online').length;
  const busyInstances = instances.filter(gpu => gpu.status === 'busy').length;
  const totalUtilization = instances.reduce((sum, gpu) => sum + gpu.utilization, 0) / instances.length;
  const totalCost = instances.reduce((sum, gpu) => sum + gpu.cost.perHour, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GPU Management</h1>
          <p className="text-gray-600 mt-1">Monitor and manage your GPU instances</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add GPU Instance
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Instances</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalInstances}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Cpu className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Online</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{onlineInstances}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Power className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Utilization</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{totalUtilization.toFixed(0)}%</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Activity className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Cost/Hour</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">€{totalCost.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* GPU Instances Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {instances.map((gpu) => (
          <GpuCard
            key={gpu.id}
            gpu={gpu}
            onSelect={selectInstance}
            onStatusChange={updateInstanceStatus}
          />
        ))}
      </div>

      {/* Selected GPU Details Modal */}
      {selectedInstance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">{selectedInstance.name}</h2>
                <button
                  onClick={() => selectInstance(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Capabilities</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedInstance.capabilities.map((capability) => (
                      <span
                        key={capability}
                        className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Performance Metrics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-600">Memory Usage</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {((selectedInstance.memory.used / selectedInstance.memory.total) * 100).toFixed(1)}%
                      </p>
                      <p className="text-sm text-gray-500">
                        {(selectedInstance.memory.used / 1024).toFixed(1)}GB / {(selectedInstance.memory.total / 1024).toFixed(1)}GB
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-600">Power Efficiency</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {(selectedInstance.utilization / (selectedInstance.powerUsage / 100)).toFixed(1)}
                      </p>
                      <p className="text-sm text-gray-500">Util/Watt ratio</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}