import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Database,
  Palette,
  Globe,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  description: string;
}

const settingsSections: SettingsSection[] = [
  {
    id: 'profile',
    title: 'Profile Settings',
    icon: User,
    description: 'Manage your personal information and preferences'
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: Bell,
    description: 'Configure notification preferences and alerts'
  },
  {
    id: 'security',
    title: 'Security & Privacy',
    icon: Shield,
    description: 'Manage security settings and privacy controls'
  },
  {
    id: 'data',
    title: 'Data Management',
    icon: Database,
    description: 'Control data storage and processing settings'
  },
  {
    id: 'appearance',
    title: 'Appearance',
    icon: Palette,
    description: 'Customize the look and feel of the application'
  },
  {
    id: 'system',
    title: 'System Settings',
    icon: Globe,
    description: 'Configure system-wide preferences and integrations'
  }
];

const Settings: React.FC = () => {
  const [activeSection, setActiveSection] = useState('profile');
  const [settings, setSettings] = useState({
    profile: {
      name: '',
      email: '',
      role: 'User',
      timezone: 'UTC+0'
    },
    notifications: {
      emailNotifications: true,
      pushNotifications: true,
      jobAlerts: true,
      systemAlerts: false,
      weeklyReports: true
    },
    security: {
      twoFactorAuth: false,
      sessionTimeout: '30',
      passwordExpiry: '90',
      loginAlerts: true
    },
    data: {
      dataRetention: '365',
      autoBackup: true,
      compressionLevel: 'medium',
      encryptionEnabled: true
    },
    appearance: {
      theme: 'light',
      language: 'en',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h'
    },
    system: {
      apiRateLimit: '1000',
      maxConcurrentJobs: '10',
      debugMode: false,
      maintenanceMode: false
    }
  });
  const [showPassword, setShowPassword] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSettingChange = (section: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [key]: value
      }
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // Simulate API call
    toast.success('Settings saved successfully!');
    setHasChanges(false);
  };

  const handleReset = () => {
    // Reset to default values
    toast.info('Settings reset to defaults');
    setHasChanges(false);
  };

  const renderProfileSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name
          </label>
          <input
            type="text"
            value={settings.profile.name}
            onChange={(e) => handleSettingChange('profile', 'name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={settings.profile.email}
            onChange={(e) => handleSettingChange('profile', 'email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Role
          </label>
          <select
            value={settings.profile.role}
            onChange={(e) => handleSettingChange('profile', 'role', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Administrator">Administrator</option>
            <option value="User">User</option>
            <option value="Viewer">Viewer</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Timezone
          </label>
          <select
            value={settings.profile.timezone}
            onChange={(e) => handleSettingChange('profile', 'timezone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="UTC+1">UTC+1 (Central European Time)</option>
            <option value="UTC+0">UTC+0 (Greenwich Mean Time)</option>
            <option value="UTC-5">UTC-5 (Eastern Standard Time)</option>
            <option value="UTC-8">UTC-8 (Pacific Standard Time)</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      {Object.entries(settings.notifications).map(([key, value]) => (
        <div key={key} className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900 capitalize">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </h4>
            <p className="text-sm text-gray-500">
              {key === 'emailNotifications' && 'Receive notifications via email'}
              {key === 'pushNotifications' && 'Receive push notifications in browser'}
              {key === 'jobAlerts' && 'Get alerts when jobs complete or fail'}
              {key === 'systemAlerts' && 'Receive system maintenance notifications'}
              {key === 'weeklyReports' && 'Get weekly summary reports'}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={value as boolean}
              onChange={(e) => handleSettingChange('notifications', key, e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      ))}
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h4>
          <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.security.twoFactorAuth}
            onChange={(e) => handleSettingChange('security', 'twoFactorAuth', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Session Timeout (minutes)
          </label>
          <input
            type="number"
            value={settings.security.sessionTimeout}
            onChange={(e) => handleSettingChange('security', 'sessionTimeout', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Password Expiry (days)
          </label>
          <input
            type="number"
            value={settings.security.passwordExpiry}
            onChange={(e) => handleSettingChange('security', 'passwordExpiry', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );

  const renderCurrentSection = () => {
    switch (activeSection) {
      case 'profile':
        return renderProfileSettings();
      case 'notifications':
        return renderNotificationSettings();
      case 'security':
        return renderSecuritySettings();
      default:
        return (
          <div className="text-center py-12">
            <SettingsIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Settings Section</h3>
            <p className="mt-1 text-sm text-gray-500">
              This settings section is under development.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
              <p className="mt-2 text-gray-600">
                Manage your account settings and preferences
              </p>
            </div>
            {hasChanges && (
              <div className="flex space-x-3">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <RefreshCw className="w-4 h-4 mr-2 inline" />
                  Reset
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <Save className="w-4 h-4 mr-2 inline" />
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-1/4">
            <nav className="space-y-1">
              {settingsSections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 rounded-lg transition-colors',
                      activeSection === section.id
                        ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <div className="flex items-center">
                      <Icon className="w-5 h-5 mr-3" />
                      <div>
                        <div className="font-medium">{section.title}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {section.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:w-3/4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  {settingsSections.find(s => s.id === activeSection)?.title}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {settingsSections.find(s => s.id === activeSection)?.description}
                </p>
              </div>
              <div className="px-6 py-6">
                {renderCurrentSection()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;