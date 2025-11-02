import React, { useState, useEffect, useRef } from 'react';
import { X, Network } from 'lucide-react';
// @ts-ignore - vis-network doesn't have complete TypeScript definitions
import { Network as VisNetwork } from 'vis-network/standalone';
// @ts-ignore - vis-network types
import type { Data, Options, Node, Edge } from 'vis-network';
import { getOntologyView } from '../services/api';

interface OntologyModalProps {
  isOpen: boolean;
  onClose: () => void;
  objectName: string;
  sectionName: string;
  viewType: 'drivers' | 'ontology' | 'identifiers' | 'relationships' | 'variants';
}

export const OntologyModal: React.FC<OntologyModalProps> = ({
  isOpen,
  onClose,
  objectName,
  sectionName,
  viewType
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const networkRef = useRef<VisNetwork | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);

  // Detect environment and get Neo4j instance name
  const getEnvironmentInfo = () => {
    const isProduction = import.meta.env.PROD || 
                        (import.meta.env.VITE_API_BASE_URL?.includes('render.com') || 
                         import.meta.env.VITE_API_BASE_URL?.includes('onrender.com'));
    
    return {
      environment: isProduction ? 'production' : 'development',
      instanceName: isProduction ? 'CDM_Prod' : 'CDM_Dev'
    };
  };

  const envInfo = getEnvironmentInfo();

  // Color configurations for different views
  const getColorConfig = () => {
    switch (viewType) {
      case 'drivers':
        return {
          Sector: { background: '#10B981', border: '#059669', highlight: { background: '#34D399', border: '#10B981' } },
          Domain: { background: '#3B82F6', border: '#2563EB', highlight: { background: '#60A5FA', border: '#3B82F6' } },
          Country: { background: '#F59E0B', border: '#D97706', highlight: { background: '#FBBF24', border: '#F59E0B' } },
          ObjectClarifier: { background: '#6B7280', border: '#4B5563', highlight: { background: '#9CA3AF', border: '#6B7280' } },
          Object: { background: '#EF4444', border: '#DC2626', highlight: { background: '#F87171', border: '#EF4444' } } // Bold color for focus node
        };
      case 'ontology':
        return {
          Being: { background: '#3B82F6', border: '#2563EB', highlight: { background: '#60A5FA', border: '#3B82F6' } },
          Avatar: { background: '#F59E0B', border: '#D97706', highlight: { background: '#FBBF24', border: '#F59E0B' } },
          Object: { background: '#FFD700', border: '#D4AF37', highlight: { background: '#FFE55C', border: '#FFD700' } } // Gold for focal node
        };
      case 'identifiers':
        return {
          Object: { background: '#FFD700', border: '#D4AF37', highlight: { background: '#FFE55C', border: '#FFD700' } },
          Variable: { background: '#3B82F6', border: '#2563EB', highlight: { background: '#60A5FA', border: '#3B82F6' } },
          Group: { background: '#10B981', border: '#059669', highlight: { background: '#34D399', border: '#10B981' } },
          Part: { background: '#6B7280', border: '#4B5563', highlight: { background: '#9CA3AF', border: '#6B7280' } }
        };
      case 'relationships':
        return {
          Object: { background: '#3B82F6', border: '#2563EB', highlight: { background: '#60A5FA', border: '#3B82F6' } }
        };
      case 'variants':
        return {
          Object: { background: '#3B82F6', border: '#2563EB', highlight: { background: '#60A5FA', border: '#3B82F6' } },
          Variant: { background: '#A78BFA', border: '#8B5CF6', highlight: { background: '#C4B5FD', border: '#A78BFA' } } // Light purple
        };
      default:
        return {};
    }
  };

  // All edges in ontology modals are grey - color coding removed per user request
  const getEdgeColor = (edge: any) => {
    // All edges are grey in ontology modals
    return '#6B7280'; // Grey for all
  };

  const loadGraph = async () => {
    // Prevent concurrent loads
    if (isLoadingRef.current) {
      return;
    }
    
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Clean up previous visualization if it exists
      if (networkRef.current) {
        try {
          networkRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying previous network:', e);
        }
        networkRef.current = null;
      }

      // Wait a bit to ensure container is mounted
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if container exists after delay
      if (!containerRef.current) {
        setError('Graph container not found. Please try again.');
        setIsLoading(false);
        isLoadingRef.current = false;
        return;
      }

      // Don't clear innerHTML - vis-network's destroy() handles cleanup
      // If there's leftover content, vis-network will replace it anyway

      // Fetch ontology view data
      const graphData = await getOntologyView(objectName, viewType);

      if (graphData.nodeCount === 0) {
        setError('No nodes found. This object may not have relationships in this view.');
        setIsLoading(false);
        return;
      }

      const colorConfig = getColorConfig();

      // Map nodes with colors based on labels
      const nodes: Node[] = graphData.nodes.map((node: any) => {
        const group = node.group || 'Unknown';
        const colorConfigForNode = colorConfig[group as keyof typeof colorConfig] || { 
          background: '#6B7280', 
          border: '#4B5563', 
          highlight: { background: '#9CA3AF', border: '#6B7280' } 
        };
        
        // Highlight the selected object node
        const isSelectedObject = node.label === objectName || node.properties?.object === objectName;
        const nodeColor = isSelectedObject && viewType === 'drivers' 
          ? { background: '#EF4444', border: '#DC2626', highlight: { background: '#F87171', border: '#EF4444' } }
          : colorConfigForNode;
        
        return {
          id: String(node.id),
          label: String(node.label || node.id),
          group: group,
          color: nodeColor,
          font: { color: '#E5E7EB', size: 14 },
          size: isSelectedObject ? 20 : 16,
          properties: node.properties || {}
        };
      });

      // Map edges with colors and labels - dark purple font, grey arrows, thinner for better separation
      // Group edges by from/to to identify parallel edges
      const edgeGroups = new Map<string, number>();
      const getEdgeKey = (from: string, to: string) => `${from}->${to}`;
      
      const edges: Edge[] = graphData.edges.map((edge: any) => {
        const from = String(edge.from);
        const to = String(edge.to);
        const key = getEdgeKey(from, to);
        
        // Count how many edges share the same from/to (for parallel edge separation)
        const parallelIndex = edgeGroups.get(key) || 0;
        edgeGroups.set(key, parallelIndex + 1);
        
        // Calculate offset for parallel edges (alternate above/below center line)
        const offset = parallelIndex % 2 === 0 
          ? parallelIndex * 0.5  // Above center
          : -(Math.floor(parallelIndex / 2) + 1) * 0.5; // Below center
        
        return {
          id: String(edge.id),
          from: from,
          to: to,
          label: edge.label || '',
          color: {
            color: '#6B7280', // Grey for all edges in ontology modals
            highlight: '#FF6347',
            hover: '#9CA3AF'
          },
          font: { 
            color: '#7C3AED', // Dark purple for better visibility
            size: 10, // Smaller font
            align: 'middle',
            strokeWidth: 0, // No border
            strokeColor: 'transparent' // No stroke
          },
          width: 1, // Thinner arrows
          arrows: {
            to: {
              enabled: true,
              scaleFactor: 1.0
            }
          },
          smooth: false, // Straight edges - vis-network automatically offsets parallel edges
          // Note: vis-network automatically separates parallel edges when smooth is false
          properties: edge.properties || {}
        };
      });

      const data: Data = { nodes, edges };

      const options: Options = {
        nodes: {
          shape: 'dot',
          scaling: {
            min: 10,
            max: 30
          },
          font: {
            size: 14,
            face: 'Arial'
          }
        },
        edges: {
          width: 1, // Thinner edges to show multiple relationships separately
          font: {
            size: 10,
            color: '#7C3AED', // Dark purple for better visibility
            align: 'middle',
            strokeWidth: 0, // No white border
            strokeColor: 'transparent' // No stroke
          },
          smooth: {
            type: 'continuous',
            roundness: 0.1 // Minimal curvature to help separate parallel edges
          },
          selectionWidth: 2, // Slightly thicker on selection for better visibility
          hoverWidth: 1.5, // Slightly thicker on hover
          // Configuration for better parallel edge separation
          arrows: {
            to: {
              enabled: true
            }
          }
        },
        physics: {
          enabled: true,
          stabilization: {
            enabled: true,
            iterations: 200
          },
          // Help separate multiple edges between same nodes
          barnesHut: {
            gravitationalConstant: -3000, // Stronger repulsion
            centralGravity: 0.2,
            springLength: 150, // Longer springs for better separation
            springConstant: 0.06, // Stronger springs
            damping: 0.08,
            avoidOverlap: 0.5 // More overlap avoidance
          }
        },
        interaction: {
          hover: true,
          tooltipDelay: 300,
          zoomView: true,
          dragView: true
        }
      };

      // Double-check container exists before creating network
      if (!containerRef.current) {
        setError('Graph container not available.');
        setIsLoading(false);
        return;
      }

      try {
        // Ensure container is still available
        if (!containerRef.current) {
          setError('Graph container not available.');
          setIsLoading(false);
          return;
        }

        networkRef.current = new VisNetwork(containerRef.current, data, options);

        // Add click handler for tooltips
        networkRef.current.on('click', (params: any) => {
          if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const node = nodes.find(n => String(n.id) === String(nodeId));
            if (node) {
              // Tooltip information can be displayed here
              console.log('Node clicked:', node);
            }
          }
        });

        setIsLoading(false);
        isLoadingRef.current = false;
      } catch (networkError) {
        console.error('Error creating network:', networkError);
        setError('Failed to initialize graph visualization. Please try again.');
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    } catch (err) {
      console.error('Error loading ontology view:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ontology view');
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  // Cleanup function - must destroy vis-network before React unmounts
  const cleanupNetwork = () => {
    // Destroy network first - vis-network's destroy() cleans up its own DOM nodes
    if (networkRef.current) {
      try {
        networkRef.current.destroy();
      } catch (e) {
        console.warn('Error destroying network:', e);
      }
      networkRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      // Cleanup immediately when modal closes
      cleanupNetwork();
      return;
    }

    if (isOpen && objectName) {
      // Reset state when modal opens
      setError(null);
      setIsLoading(true);
      
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        loadGraph();
      }, 50);

      return () => {
        clearTimeout(timer);
        // Only cleanup if modal closes while loading
        if (isLoadingRef.current) {
          cleanupNetwork();
        }
      };
    }
  }, [isOpen, objectName, viewType]);

  // Separate effect for cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupNetwork();
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border w-[95vw] h-[90vh] max-w-7xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ag-dark-border">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-ag-dark-text-secondary" />
            <div>
              <h2 className="text-xl font-semibold text-ag-dark-text">
                Ontology View – {sectionName}
              </h2>
              <p className="text-sm text-ag-dark-text-secondary mt-1">
                Object: {objectName} | Instance: {envInfo.instanceName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-hidden relative">
          {/* Render container div - vis-network will manage its own children */}
          <div 
            ref={containerRef} 
            className="w-full h-full bg-ag-dark-bg border border-ag-dark-border rounded"
            style={{ minHeight: '500px', position: 'relative' }}
          />
          {/* Overlay loading/error states */}
          {isLoading && (
            <div className="absolute inset-6 flex items-center justify-center bg-ag-dark-bg/90 z-10 rounded border border-ag-dark-border">
              <div className="text-ag-dark-text-secondary">Loading ontology view...</div>
            </div>
          )}
          {error && (
            <div className="absolute inset-6 flex items-center justify-center bg-ag-dark-bg/90 z-10 rounded border border-ag-dark-border">
              <div className="text-red-400">{error}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-ag-dark-border">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

