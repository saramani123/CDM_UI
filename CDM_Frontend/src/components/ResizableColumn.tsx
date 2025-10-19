import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ResizableColumnProps {
  children: React.ReactNode;
  initialWidth: string;
  minWidth?: number;
  maxWidth?: number;
  onResize?: (newWidth: number) => void;
  className?: string;
}

export const ResizableColumn: React.FC<ResizableColumnProps> = ({
  children,
  initialWidth,
  minWidth = 80,
  maxWidth = 1000,
  onResize,
  className = ''
}) => {
  const [width, setWidth] = useState(() => {
    const parsed = parseInt(initialWidth);
    return isNaN(parsed) ? 140 : parsed;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  // Update width when initialWidth prop changes
  useEffect(() => {
    const parsed = parseInt(initialWidth);
    if (!isNaN(parsed)) {
      setWidth(parsed);
    }
  }, [initialWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const deltaX = e.clientX - startXRef.current;
    const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + deltaX));
    
    setWidth(newWidth);
    onResize?.(newWidth);
  }, [minWidth, maxWidth, onResize]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [handleMouseMove]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  return (
    <div
      ref={columnRef}
      className={`relative ${className}`}
      style={{ width: `${width}px` }}
    >
      {children}
      {/* Resize handle - positioned at the right edge */}
      <div
        className={`absolute top-0 right-0 h-full cursor-col-resize transition-all duration-150 ${
          isResizing 
            ? 'bg-ag-dark-accent bg-opacity-30' 
            : isHovering 
              ? 'bg-ag-dark-accent bg-opacity-10' 
              : 'bg-transparent hover:bg-ag-dark-accent hover:bg-opacity-5'
        }`}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title="Drag to resize column"
        style={{ 
          right: '-2px',
          width: '4px',
          zIndex: 10
        }}
      />
      {/* Visual indicator during resize */}
      {isResizing && (
        <div className="absolute top-0 right-0 h-full w-0.5 bg-ag-dark-accent pointer-events-none z-30" />
      )}
    </div>
  );
};