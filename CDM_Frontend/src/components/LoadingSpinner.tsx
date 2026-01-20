import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message, 
  size = 'md',
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-8 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} text-ag-dark-accent animate-spin`} />
      {message && (
        <p className="text-sm text-ag-dark-text-secondary">{message}</p>
      )}
    </div>
  );
};
