import React, { useEffect } from 'react';
import { 
  Activity, 
  Cpu, 
  Users, 
  Briefcase, 
  TrendingUp, 
  Clock, 
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useGpuStore } from '../stores/useGpuStore';
import { useJobStore } from '../stores/useJobStore';
import { usePersonStore } from '../stores/usePersonStore';
import { cn } from '../lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

function StatCard({ title, value, change, changeType, icon: Icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change && (
            <p className={cn(
              "text-sm mt-1 flex items-center",
              changeType === 'positive' && "text-green-600",
              changeType === 'negative' && "text-red-600",
              changeType === 'neutral' && "text-gray-600"
            )}>
              <TrendingUp className="h-4 w-4 mr-1" />
              {change}
            </p>
          )}
        </div>
        <div className={cn(
          "p-3 rounded-lg",
          color
        )}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
}

interface ActivityItemProps {
  title: string;
  description: string;
  time: string;
  status: 'success' | 'error' | 'warning' | 'info';
}

function ActivityItem({ title, description, time, status }: ActivityItemProps) {
  const statusConfig = {
    success: { icon: CheckCircle, color: 'text-green-500' },
    error: { icon: XCircle, color: 'text-red-500' },
    warning: { icon: AlertTriangle, color: 'text-yellow-500' },
    info: { icon: Clock, color: 'text-blue-500' }
  };

  const { icon: StatusIcon, color } = statusConfig[status];

  return (
    <div className="flex items-start space-x-3 py-3">
      <StatusIcon className={cn("h-5 w-5 mt-0.5", color)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <p className="text-xs text-gray-400">{time}</p>
    </div>
  );
}

export default function Dashboard() {
  const { instances, fetchInstances } = useGpuStore();
  const { jobs, fetchJobs } = useJobStore();
  const { persons, fetchPersons } = usePersonStore();

  // Load data from API when component mounts
  useEffect(() => {
    fetchInstances();
    fetchJobs();
    fetchPersons();
  }, [fetchInstances, fetchJobs, fetchPersons]);

  // Calculate statistics
  const activeGpus = instances.filter(gpu => gpu.status === 'online').length;
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter(job => job.status === 'completed').length;
  const processingJobs = jobs.filter(job => job.status === 'processing').length;
  const totalPersons = persons.length;
  const totalCost = jobs.reduce((sum, job) => {
    const cost = job.cost?.actual || job.cost?.estimated || 0;
    return sum + cost;
  }, 0);

  const recentActivities = [
    {
      title: 'Video Analysis Completed',
      description: 'Job "Sample Video Analysis" finished successfully',
      time: '2 min ago',
      status: 'success' as const
    },
    {
      title: 'New Person Detected',
      description: 'Person_003 identified in batch processing job',
      time: '5 min ago',
      status: 'info' as const
    },
    {
      title: 'GPU Instance Online',
      description: 'RTX 4090 #3 came back online after maintenance',
      time: '12 min ago',
      status: 'success' as const
    },
    {
      title: 'High GPU Temperature',
      description: 'RTX 4090 #2 temperature reached 82°C',
      time: '18 min ago',
      status: 'warning' as const
    },
    {
      title: 'Batch Job Started',
      description: 'Processing 15 images for person recognition',
      time: '25 min ago',
      status: 'info' as const
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome to AIMA - AI Media Analysis System</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active GPUs"
          value={`${activeGpus}/${instances.length}`}
          change="+2 since yesterday"
          changeType="positive"
          icon={Cpu}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
        />
        <StatCard
          title="Total Jobs"
          value={totalJobs}
          change={`${processingJobs} processing`}
          changeType="neutral"
          icon={Briefcase}
          color="bg-gradient-to-br from-green-500 to-green-600"
        />
        <StatCard
          title="Person Dossiers"
          value={totalPersons}
          change="+3 this week"
          changeType="positive"
          icon={Users}
          color="bg-gradient-to-br from-purple-500 to-purple-600"
        />
        <StatCard
          title="Total Cost"
          value={`€${totalCost.toFixed(2)}`}
          change="-12% vs last month"
          changeType="positive"
          icon={DollarSign}
          color="bg-gradient-to-br from-orange-500 to-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GPU Status Overview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Cpu className="h-5 w-5 mr-2 text-blue-600" />
                GPU Instance Status
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {instances.map((gpu) => {
                  const statusConfig = {
                    online: { color: 'bg-green-100 text-green-800', dot: 'bg-green-400' },
                    busy: { color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-400' },
                    offline: { color: 'bg-red-100 text-red-800', dot: 'bg-red-400' },
                    maintenance: { color: 'bg-gray-100 text-gray-800', dot: 'bg-gray-400' }
                  };

                  const config = statusConfig[gpu.status];

                  return (
                    <div key={gpu.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={cn("h-3 w-3 rounded-full", config.dot)}></div>
                        <div>
                          <p className="font-medium text-gray-900">{gpu.name}</p>
                          <p className="text-sm text-gray-500">{gpu.location}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">{gpu.utilization}%</p>
                          <p className="text-xs text-gray-500">Utilization</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">{gpu.temperature}°C</p>
                          <p className="text-xs text-gray-500">Temperature</p>
                        </div>
                        <span className={cn(
                          "px-2 py-1 text-xs font-medium rounded-full",
                          config.color
                        )}>
                          {gpu.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Activity className="h-5 w-5 mr-2 text-green-600" />
                Recent Activity
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-1">
                {recentActivities.map((activity, index) => (
                  <ActivityItem
                    key={index}
                    title={activity.title}
                    description={activity.description}
                    time={activity.time}
                    status={activity.status}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button className="flex items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group">
              <div className="text-center">
                <Briefcase className="h-8 w-8 text-blue-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-medium text-blue-900">Create New Job</p>
              </div>
            </button>
            <button className="flex items-center justify-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors group">
              <div className="text-center">
                <Users className="h-8 w-8 text-green-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-medium text-green-900">Add Person</p>
              </div>
            </button>
            <button className="flex items-center justify-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors group">
              <div className="text-center">
                <Cpu className="h-8 w-8 text-purple-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-medium text-purple-900">Manage GPUs</p>
              </div>
            </button>
            <button className="flex items-center justify-center p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors group">
              <div className="text-center">
                <Activity className="h-8 w-8 text-orange-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-medium text-orange-900">View Analytics</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}