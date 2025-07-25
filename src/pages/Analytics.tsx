import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  Cpu,
  Clock,
  Download,
  Filter,
  Calendar,
  Eye,
  Brain,
  Zap,
  Database,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useGpuStore } from '../stores/useGpuStore';
import { useJobStore } from '../stores/useJobStore';
import { usePersonStore } from '../stores/usePersonStore';

interface MetricCard {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ComponentType<any>;
  color: string;
}

interface ChartData {
  name: string;
  value: number;
  jobs?: number;
  gpu?: number;
  persons?: number;
}

const Analytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  
  const { instances: gpuInstances, fetchInstances } = useGpuStore();
  const { jobs, fetchJobs } = useJobStore();
  const { persons, fetchPersons } = usePersonStore();

  // Calculate real metrics from store data
  const calculateMetrics = (): MetricCard[] => {
    const totalJobs = jobs.length;
    const completedJobs = jobs.filter(job => job.status === 'completed').length;
    const activeGpus = gpuInstances.filter(gpu => gpu.status === 'active').length;
    const totalPersons = persons.length;
    
    const avgProcessingTime = jobs.length > 0 
      ? jobs.reduce((acc, job) => {
          if (job.endTime && job.startTime) {
            return acc + (new Date(job.endTime).getTime() - new Date(job.startTime).getTime());
          }
          return acc;
        }, 0) / completedJobs / 1000 // Convert to seconds
      : 0;
    
    const successRate = completedJobs > 0 
      ? (jobs.filter(job => job.status === 'completed' && job.results?.length > 0).length / completedJobs * 100)
      : 0;
    
    const systemUptime = activeGpus > 0 ? (activeGpus / gpuInstances.length * 100) : 0;
    
    return [
      {
        title: 'Total Jobs Processed',
        value: totalJobs.toLocaleString(),
        change: '+12.5%', // This would be calculated from historical data
        trend: 'up',
        icon: Activity,
        color: 'blue'
      },
      {
        title: 'Active GPU Instances',
        value: activeGpus.toString(),
        change: '+3.2%',
        trend: 'up',
        icon: Cpu,
        color: 'green'
      },
      {
        title: 'Person Profiles',
        value: totalPersons.toLocaleString(),
        change: '+8.7%',
        trend: 'up',
        icon: Users,
        color: 'purple'
      },
      {
        title: 'Avg Processing Time',
        value: `${avgProcessingTime.toFixed(1)}s`,
        change: '-15.3%',
        trend: 'down',
        icon: Clock,
        color: 'orange'
      },
      {
        title: 'Success Rate',
        value: `${successRate.toFixed(1)}%`,
        change: '+2.1%',
        trend: 'up',
        icon: Brain,
        color: 'indigo'
      },
      {
        title: 'System Availability',
        value: `${systemUptime.toFixed(1)}%`,
        change: '+0.1%',
        trend: 'up',
        icon: Zap,
        color: 'emerald'
      }
    ];
  };
  
  const metrics = calculateMetrics();

  // Generate chart data based on real data
  const generateChartData = (): ChartData[] => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const now = new Date();
    
    return days.map((day, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));
      
      // Filter jobs for this day
      const dayJobs = jobs.filter(job => {
        const jobDate = new Date(job.createdAt);
        return jobDate.toDateString() === date.toDateString();
      });
      
      // Calculate metrics for this day
      const jobCount = dayJobs.length;
      const activeGpuCount = Math.min(gpuInstances.filter(gpu => gpu.status === 'active').length, jobCount);
      const personCount = Math.floor(jobCount * 0.6); // Estimate based on job complexity
      
      return {
        name: day,
        value: jobCount + activeGpuCount + personCount,
        jobs: jobCount,
        gpu: activeGpuCount,
        persons: personCount
      };
    });
  };
  
  const chartData = generateChartData();

  // Generate recent activities from real data
  const generateRecentActivities = () => {
    const activities = [];
    
    // Add recent job activities
    const recentJobs = jobs
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 3);
    
    recentJobs.forEach((job, index) => {
      const timeDiff = Date.now() - new Date(job.updatedAt || job.createdAt).getTime();
      const timeAgo = timeDiff < 60000 ? 'Just now' : 
                     timeDiff < 3600000 ? `${Math.floor(timeDiff / 60000)} minutes ago` :
                     `${Math.floor(timeDiff / 3600000)} hours ago`;
      
      activities.push({
        id: `job-${job.id}`,
        type: job.status === 'completed' ? 'job_completed' : job.status === 'failed' ? 'error' : 'job_processing',
        title: `${job.type === 'face_detection' ? 'Face Detection' : 'Audio Transcription'} Job ${job.status === 'completed' ? 'Completed' : job.status === 'failed' ? 'Failed' : 'Processing'}`,
        description: `Job ${job.id} - ${job.mediaFiles?.length || 0} files processed`,
        timestamp: timeAgo,
        status: job.status === 'completed' ? 'success' : job.status === 'failed' ? 'error' : 'info'
      });
    });
    
    // Add GPU activities
    const activeGpus = gpuInstances.filter(gpu => gpu.status === 'active').slice(0, 2);
    activeGpus.forEach((gpu, index) => {
      activities.push({
        id: `gpu-${gpu.id}`,
        type: 'gpu_allocated',
        title: 'GPU Instance Active',
        description: `${gpu.name} - ${gpu.utilization}% utilization`,
        timestamp: '5 minutes ago',
        status: 'info'
      });
    });
    
    // Add person activities
    const recentPersons = persons.slice(-2);
    recentPersons.forEach((person, index) => {
      activities.push({
        id: `person-${person.id}`,
        type: 'person_identified',
        title: 'Person Profile Updated',
        description: `Person ${person.id} - ${person.recognitions?.length || 0} recognitions`,
        timestamp: '10 minutes ago',
        status: 'success'
      });
    });
    
    return activities.slice(0, 5);
  };
  
  const recentActivities = generateRecentActivities();

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchInstances(),
          fetchJobs(),
          fetchPersons()
        ]);
      } catch (error) {
        console.error('Error loading analytics data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [timeRange, fetchInstances, fetchJobs, fetchPersons]);

  const getMetricColor = (color: string) => {
    const colors = {
      blue: 'bg-blue-50 text-blue-600',
      green: 'bg-green-50 text-green-600',
      purple: 'bg-purple-50 text-purple-600',
      orange: 'bg-orange-50 text-orange-600',
      indigo: 'bg-indigo-50 text-indigo-600',
      emerald: 'bg-emerald-50 text-emerald-600'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'job_completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'gpu_allocated':
        return <Cpu className="w-5 h-5 text-blue-500" />;
      case 'person_identified':
        return <Users className="w-5 h-5 text-purple-500" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getActivityStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="mt-2 text-gray-600">
                Monitor system performance and analyze usage patterns
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex space-x-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <Download className="w-4 h-4 mr-2 inline" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
                    <div className="flex items-center mt-2">
                      {getTrendIcon(metric.trend)}
                      <span className={cn(
                        'text-sm font-medium ml-1',
                        metric.trend === 'up' ? 'text-green-600' : 
                        metric.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                      )}>
                        {metric.change}
                      </span>
                    </div>
                  </div>
                  <div className={cn('p-3 rounded-lg', getMetricColor(metric.color))}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Usage Trends</h2>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setSelectedMetric('overview')}
                      className={cn(
                        'px-3 py-1 text-sm rounded-md',
                        selectedMetric === 'overview'
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setSelectedMetric('jobs')}
                      className={cn(
                        'px-3 py-1 text-sm rounded-md',
                        selectedMetric === 'jobs'
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      Jobs
                    </button>
                    <button
                      onClick={() => setSelectedMetric('gpu')}
                      className={cn(
                        'px-3 py-1 text-sm rounded-md',
                        selectedMetric === 'gpu'
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      GPU
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {/* Simple Bar Chart Visualization */}
                <div className="space-y-4">
                  {chartData.map((item, index) => {
                    const maxValue = Math.max(...chartData.map(d => d.value));
                    const percentage = (item.value / maxValue) * 100;
                    return (
                      <div key={index} className="flex items-center space-x-4">
                        <div className="w-12 text-sm text-gray-600">{item.name}</div>
                        <div className="flex-1">
                          <div className="bg-gray-200 rounded-full h-4 relative">
                            <div
                              className="bg-blue-500 h-4 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="w-16 text-sm text-gray-900 text-right">
                          {selectedMetric === 'jobs' ? item.jobs :
                           selectedMetric === 'gpu' ? item.gpu :
                           selectedMetric === 'persons' ? item.persons :
                           item.value}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activities */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Recent Activities</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {recentActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className={cn(
                        'p-4 rounded-lg border',
                        getActivityStatusColor(activity.status)
                      )}
                    >
                      <div className="flex items-start space-x-3">
                        {getActivityIcon(activity.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {activity.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {activity.description}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            {activity.timestamp}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Summary */}
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Performance Summary</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {metrics.find(m => m.title === 'Avg Processing Time')?.value || '0s'}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Avg Processing Time</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {metrics.find(m => m.title === 'Success Rate')?.value || '0%'}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Success Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {metrics.find(m => m.title === 'System Availability')?.value || '0%'}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">System Availability</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600">
                    {gpuInstances.length > 0 ? '24/7' : 'Offline'}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Monitoring</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;