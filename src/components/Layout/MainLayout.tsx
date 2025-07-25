import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  Menu, 
  X, 
  Home, 
  Cpu, 
  Briefcase, 
  Users, 
  Settings, 
  Database,
  BarChart3,
  Bell,
  Search,
  Brain
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'GPU Management', href: '/gpu', icon: Cpu },
  { name: 'Jobs', href: '/jobs', icon: Briefcase, badge: 3 },
  { name: 'Person Dossiers', href: '/persons', icon: Users },
  { name: 'ML Pipeline', href: '/ml', icon: Brain },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Storage', href: '/storage', icon: Database },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={cn(
        "fixed inset-0 z-50 lg:hidden",
        sidebarOpen ? "block" : "hidden"
      )}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <span className="ml-2 text-xl font-bold text-gray-900">AIMA</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                        isActive
                          ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}
                    >
                      <item.icon className={cn(
                        "mr-3 h-5 w-5",
                        isActive ? "text-blue-700" : "text-gray-400"
                      )} />
                      {item.name}
                      {item.badge && (
                        <span className="ml-auto bg-red-100 text-red-600 text-xs font-medium px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200 shadow-sm">
          <div className="flex h-16 items-center px-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <span className="ml-2 text-xl font-bold text-gray-900">AIMA</span>
          </div>
          <nav className="flex-1 px-4 py-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={cn(
                        "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                        isActive
                          ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}
                    >
                      <item.icon className={cn(
                        "mr-3 h-5 w-5",
                        isActive ? "text-blue-700" : "text-gray-400"
                      )} />
                      {item.name}
                      {item.badge && (
                        <span className="ml-auto bg-red-100 text-red-600 text-xs font-medium px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top navigation */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-gray-400 hover:text-gray-600"
              >
                <Menu className="h-6 w-6" />
              </button>
              
              {/* Search bar */}
              <div className="hidden sm:block ml-4 lg:ml-0">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Jobs, Personen oder Medien suchen..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
              </button>

              {/* User menu */}
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center">
                  <span className="text-white font-medium text-sm">U</span>
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">User</p>
                  <p className="text-xs text-gray-500">Administrator</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}