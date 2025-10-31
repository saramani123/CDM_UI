import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ResizableColumnProps {
  children: React.ReactNode;
  initialWidth: string;
  minWidth?: number;
  maxWidth?: number;
  onResize?: (newWidth: number) => void;
  throttleUpdates?: boolean; // If true, throttle state updates (for large grids)
  columnKey?: string; // Column key for CSS variable updates
  className?: string;
}

export const ResizableColumn: React.FC<ResizableColumnProps> = ({
  children,
  initialWidth,
  minWidth = 80,
  maxWidth = 1000,
  onResize,
  throttleUpdates = false,
  columnKey,
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
  const pendingWidthRef = useRef<number | null>(null);
  const gridContainerRef = useRef<HTMLElement | null>(null);

  // Find grid container for CSS variable updates (large grids only)
  useEffect(() => {
    if (throttleUpdates && columnRef.current && columnKey) {
      // Find the grid container element
      let parent = columnRef.current.parentElement;
      while (parent && !parent.hasAttribute('data-grid-container')) {
        parent = parent.parentElement;
      }
      if (parent) {
        gridContainerRef.current = parent as HTMLElement;
      } else {
        // Fallback: use document root
        gridContainerRef.current = document.documentElement;
      }
    }
  }, [throttleUpdates, columnKey]);

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
    
    // Always update local width for immediate visual feedback in header
    setWidth(newWidth);
    
    if (throttleUpdates && columnKey && gridContainerRef.current) {
      // For large grids: ONLY update CSS variable (zero React re-renders during resize)
      gridContainerRef.current.style.setProperty(`--column-width-${columnKey}`, `${newWidth}px`);
      pendingWidthRef.current = newWidth; // Store for mouseUp
      // DO NOT call onResize during resize - wait for mouseUp
    } else {
      // For small grids, update immediately (original behavior)
      onResize?.(newWidth);
    }
  }, [minWidth, maxWidth, onResize, throttleUpdates, columnKey]);

  const handleMouseUp = useCallback(() => {
    // For large grids, update React state ONLY on resize end (after CSS variable updates)
    if (throttleUpdates && pendingWidthRef.current !== null) {
      onResize?.(pendingWidthRef.current);
      pendingWidthRef.current = null;
    }
    
    setIsResizing(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [handleMouseMove, onResize, throttleUpdates]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    
    // Initialize CSS variable if needed (large grids)
    if (throttleUpdates && columnKey && gridContainerRef.current) {
      gridContainerRef.current.style.setProperty(`--column-width-${columnKey}`, `${width}px`);
    }
    
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

  // For large grids, use CSS variable during resize for synchronization with cells
  const headerWidthStyle = throttleUpdates && columnKey && isResizing
    ? { width: `var(--column-width-${columnKey}, ${width}px)` }
    : { width: `${width}px` };

  return (
    <div
      ref={columnRef}
      className={`relative ${className}`}
      style={headerWidthStyle}
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
