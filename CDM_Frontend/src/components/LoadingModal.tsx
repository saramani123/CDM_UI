import React from 'react';
import { Loader2, Database, FileText, List, BarChart3 } from 'lucide-react';

interface LoadingModalProps {
  isOpen: boolean;
  loadingType: 'drivers' | 'objects' | 'variables' | 'lists' | 'general';
  message?: string;
}

const LoadingModal: React.FC<LoadingModalProps> = ({ 
  isOpen, 
  loadingType, 
  message 
}) => {
  if (!isOpen) return null;

  const getLoadingConfig = () => {
    switch (loadingType) {
      case 'drivers':
        return {
          icon: <Database className="w-8 h-8 text-blue-400" />,
          title: 'Loading Drivers',
          description: 'Fetching sector, domain, country, and clarifier data...',
          color: 'blue'
        };
      case 'objects':
        return {
          icon: <FileText className="w-8 h-8 text-green-400" />,
          title: 'Loading Objects',
          description: 'Retrieving object definitions and metadata...',
          color: 'green'
        };
      case 'variables':
        return {
          icon: <BarChart3 className="w-8 h-8 text-purple-400" />,
          title: 'Loading Variables',
          description: 'Fetching variable definitions and relationships...',
          color: 'purple'
        };
      case 'lists':
        return {
          icon: <List className="w-8 h-8 text-orange-400" />,
          title: 'Loading Lists',
          description: 'Retrieving list configurations and data...',
          color: 'orange'
        };
      default:
        return {
          icon: <Loader2 className="w-8 h-8 text-gray-400" />,
          title: 'Loading',
          description: 'Please wait while we fetch your data...',
          color: 'gray'
        };
    }
  };

  const config = getLoadingConfig();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-ag-dark-surface border border-ag-dark-border rounded-xl p-8 max-w-md mx-4 shadow-2xl">
        {/* Header with icon and title */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="relative">
              {config.icon}
              <div className="absolute -top-1 -right-1">
                <Loader2 className="w-4 h-4 text-ag-dark-accent animate-spin" />
              </div>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-ag-dark-text mb-2">
            {message || config.title}
          </h3>
          <p className="text-sm text-ag-dark-text-secondary">
            {config.description}
          </p>
        </div>

        {/* Animated loading bar */}
        <div className="w-full bg-ag-dark-bg rounded-full h-2 mb-4">
          <div 
            className={`h-2 rounded-full bg-gradient-to-r from-ag-dark-accent to-${config.color}-400 animate-pulse`}
            style={{
              width: '100%',
              background: `linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4, #10b981)`,
              backgroundSize: '200% 100%',
              animation: 'gradient 2s ease-in-out infinite'
            }}
          />
        </div>

        {/* Loading dots animation */}
        <div className="flex justify-center space-x-1">
          <div className="w-2 h-2 bg-ag-dark-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-ag-dark-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-ag-dark-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>

        {/* Fun loading message */}
        <div className="text-center mt-4">
          <p className="text-xs text-ag-dark-text-secondary">
            {loadingType === 'drivers' && 'Organizing your data drivers...'}
            {loadingType === 'objects' && 'Structuring your object definitions...'}
            {loadingType === 'variables' && 'Calculating variable relationships...'}
            {loadingType === 'lists' && 'Compiling your data lists...'}
            {loadingType === 'general' && 'Almost ready...'}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
};

export default LoadingModal;
