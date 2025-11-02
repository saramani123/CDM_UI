import React, { useState, useEffect, useRef } from 'react';
import { X, Info, Network, RefreshCw, ExternalLink, AlertTriangle, Plus, Minus, ChevronDown, ChevronUp, Copy, Eye } from 'lucide-react';
// @ts-ignore - vis-network doesn't have complete TypeScript definitions
import { Network as VisNetwork } from 'vis-network/standalone';
// @ts-ignore - vis-network types
import type { Data, Options, Node, Edge } from 'vis-network';
import { executeGraphQuery } from '../services/api';

interface Neo4jGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  graphType?: 'objects' | 'variables'; // Default to 'objects' for backward compatibility
}

type GraphView = 'taxonomy' | 'model';

export const Neo4jGraphModal: React.FC<Neo4jGraphModalProps> = ({
  isOpen,
  onClose,
  graphType = 'objects'
}) => {
  const [activeView, setActiveView] = useState<GraphView>('taxonomy');
  const [isLoading, setIsLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState<number | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [showCypherQuery, setShowCypherQuery] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const networkRef = useRef<VisNetwork | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const allNodesData = useRef<any[]>([]);
  const allEdgesData = useRef<any[]>([]);
  
  // Use a unique container ID that changes with the active view and graph type
  const getContainerId = () => `graph-container-${graphType}-${activeView}`;

  // Detect environment and get Neo4j instance name
  const getEnvironmentInfo = () => {
    // Check if we're in production based on the API base URL or environment
    const isProduction = import.meta.env.PROD || 
                        (import.meta.env.VITE_API_BASE_URL?.includes('render.com') || 
                         import.meta.env.VITE_API_BASE_URL?.includes('onrender.com'));
    
    return {
      environment: isProduction ? 'production' : 'development',
      instanceName: isProduction ? 'CDM_Prod' : 'CDM_Dev'
    };
  };

  const envInfo = getEnvironmentInfo();

  // Cypher queries for each view - different for objects vs variables
  const cypherQueries = graphType === 'variables' ? {
    taxonomy: `MATCH (p:Part)-[r1:HAS_GROUP]->(g:Group)-[r2:HAS_VARIABLE]->(v:Variable)
RETURN p, r1, g, r2, v`,
    model: `MATCH (b:Being)-[r1:HAS_AVATAR]->(a:Avatar)
MATCH (a)-[r2:HAS_OBJECT]->(o:Object)
OPTIONAL MATCH (o)-[r3:HAS_SPECIFIC_VARIABLE]->(v:Variable)
OPTIONAL MATCH (v)<-[r4:HAS_VARIABLE]-(g:Group)<-[r5:HAS_GROUP]-(p:Part)
RETURN b, r1, a, r2, o, r3, v, r4, g, r5, p`
  } : {
    taxonomy: `MATCH (b:Being)-[ha:HAS_AVATAR]->(a:Avatar)-[ho:HAS_OBJECT]->(o:Object)
OPTIONAL MATCH (o)-[hv:HAS_VARIANT]->(v:Variant)
RETURN b, ha, a, ho, o, hv, v`,
    model: `MATCH (b:Being)-[ha:HAS_AVATAR]->(a:Avatar)-[ho:HAS_OBJECT]->(o:Object)
OPTIONAL MATCH (o)-[hv:HAS_VARIANT]->(v:Variant)
OPTIONAL MATCH (o)-[r:RELATES_TO]->(o2:Object)
RETURN b, ha, a, ho, o, hv, v, r, o2`
  };

  // Run graph query using API endpoint and vis-network
  const runGraphQuery = async (query: string) => {
    const containerId = getContainerId();
    // Check if container exists
    const container = document.getElementById(containerId);
    if (!container) {
      setError('Graph container not found. Please refresh the page.');
      setShowFallback(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    setShowFallback(false);

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

      // Execute query via API endpoint (proxies to Neo4j)
      console.log('Executing graph query via API...');
      const graphData = await executeGraphQuery(query);
      
      console.log('Graph data received:', {
        nodeCount: graphData.nodeCount,
        edgeCount: graphData.edgeCount
      });

      if (graphData.nodeCount === 0) {
        setError('No nodes found. The query may not have returned any results.');
        setIsLoading(false);
        return;
      }

      // Map nodes with colors based on labels - different colors for objects vs variables
      const labelColors: Record<string, { background: string; border: string; highlight: { background: string; border: string } }> = graphType === 'variables' ? {
        Part: { background: '#3B82F6', border: '#2563EB', highlight: { background: '#60A5FA', border: '#3B82F6' } },
        Group: { background: '#FFD700', border: '#D4AF37', highlight: { background: '#FFE55C', border: '#FFD700' } },
        Variable: { background: '#10B981', border: '#059669', highlight: { background: '#34D399', border: '#10B981' } },
        Being: { background: '#8B5CF6', border: '#7C3AED', highlight: { background: '#A78BFA', border: '#8B5CF6' } },
        Avatar: { background: '#F59E0B', border: '#D97706', highlight: { background: '#FBBF24', border: '#F59E0B' } },
        Object: { background: '#14B8A6', border: '#0D9488', highlight: { background: '#5EEAD4', border: '#14B8A6' } }
      } : {
        Being: { background: '#3B82F6', border: '#2563EB', highlight: { background: '#60A5FA', border: '#3B82F6' } },
        Avatar: { background: '#FFD700', border: '#D4AF37', highlight: { background: '#FFE55C', border: '#FFD700' } },
        Object: { background: '#10B981', border: '#059669', highlight: { background: '#34D399', border: '#10B981' } },
        Variant: { background: '#32CD32', border: '#28A745', highlight: { background: '#6EE7B7', border: '#32CD32' } }
      };

      const nodes: Node[] = graphData.nodes.map((node: any) => {
        const group = node.group || 'Unknown';
        const colorConfig = labelColors[group as string] || { 
          background: '#6B7280', 
          border: '#4B5563', 
          highlight: { background: '#9CA3AF', border: '#6B7280' } 
        };
        
        return {
          id: String(node.id),
          label: String(node.label || node.id),
          group: group,
          color: colorConfig,
          font: { color: '#E5E7EB', size: 14 },
          size: 16,
          properties: node.properties || {}
        };
      });

      // Store original data for details panel
      allNodesData.current = graphData.nodes;
      allEdgesData.current = graphData.edges;

      // Map edges - ensure IDs are strings, make labels smaller and navy blue
      const edges: Edge[] = graphData.edges.map((edge: any) => ({
        id: String(edge.id),
        from: String(edge.from),
        to: String(edge.to),
        label: edge.label || '',
        color: {
          color: '#6B7280',
          highlight: '#FF6347'
        },
        arrows: { to: { enabled: true } },
        smooth: false,
        font: { 
          color: '#1E3A8A', // Navy blue for better visibility
          size: 10, // Smaller font size
          strokeWidth: 0, // No stroke/border
          strokeColor: 'transparent' // Ensure no border
        },
        width: 2
      }));

      // Create vis-network data
      const data: Data = { nodes, edges };

      // Configure vis-network options
      const options: Options = {
        nodes: {
          shape: 'dot',
          size: 12,
          font: { size: 14, color: '#E5E7EB' },
        },
        edges: {
          arrows: { to: { enabled: true } },
          smooth: false,
          font: { 
            size: 10, // Smaller font
            color: '#1E3A8A', // Navy blue for better visibility
            strokeWidth: 0, // No white border
            strokeColor: 'transparent' // No stroke
          },
        },
        physics: {
          stabilization: {
            enabled: true,
            iterations: 100
          }
        },
        interaction: {
          hover: true,
          tooltipDelay: 200,
        },
      };

      // Log data for debugging
      console.log('Graph data:', {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        firstNode: nodes[0],
        firstEdge: edges[0],
        containerId,
        containerExists: !!container
      });

      // Create and render the network
      networkRef.current = new VisNetwork(container, data, options);
      
      // Force network to resize to fill container
      setTimeout(() => {
        if (networkRef.current && container) {
          networkRef.current.setSize(`${container.clientWidth}px`, `${container.clientHeight}px`);
          networkRef.current.redraw();
        }
      }, 100);
      
      // Add click handlers for nodes and edges
      if (networkRef.current) {
        // Handle node clicks
        networkRef.current.on('click', (params: any) => {
          if (params.nodes.length > 0) {
            // Node clicked - select but don't auto-open panel
            const nodeId = params.nodes[0];
            const node = allNodesData.current.find(n => String(n.id) === String(nodeId));
            if (node) {
              // Also get the vis-network node data for label
              const visNode = nodes.find(n => String(n.id) === String(nodeId));
              setSelectedNode({
                ...node,
                label: visNode?.label || node.label || node.group || 'Node',
                group: visNode?.group || node.group || 'Unknown'
              });
              setSelectedEdge(null);
              // Don't auto-open panel - user will click eye icon
            }
          } else if (params.edges.length > 0) {
            // Edge clicked - select but don't auto-open panel
            const edgeId = params.edges[0];
            const edge = allEdgesData.current.find(e => String(e.id) === String(edgeId));
            if (edge) {
              // Also get the vis-network edge data for label
              const visEdge = edges.find(e => String(e.id) === String(edgeId));
              setSelectedEdge({
                ...edge,
                label: visEdge?.label || edge.label || edge.type || 'Relationship'
              });
              setSelectedNode(null);
              // Don't auto-open panel - user will click eye icon
            }
          } else {
            // Clicked on empty space - deselect and close panel
            setSelectedNode(null);
            setSelectedEdge(null);
            setShowDetailsPanel(false);
          }
        });
      }
      
      // Store network reference for zoom controls and set default zoom/center
      if (networkRef.current) {
        // Wait for graph to stabilize, then zoom and center
        networkRef.current.on('stabilizationEnd', () => {
          console.log('Graph stabilized, zooming and centering...');
          
          // Force another resize to ensure canvas is correct size
          if (networkRef.current && container) {
            networkRef.current.setSize(`${container.clientWidth}px`, `${container.clientHeight}px`);
          }
          
          // Use fit() to center and fit the graph to the viewport
          networkRef.current?.fit({
            padding: 10, // Very minimal padding for tight fit
            animation: {
              duration: 600,
              easingFunction: 'easeInOutQuad'
            }
          });
          
          // Then aggressively zoom in after a short delay
          setTimeout(() => {
            if (networkRef.current) {
              const currentScale = networkRef.current.getScale() || 1;
              const targetScale = Math.min(currentScale * 4, 6); // Very aggressive zoom (up to 6x)
              
              console.log('Zooming in from', currentScale, 'to', targetScale);
              
              networkRef.current.moveTo({
                scale: targetScale,
                animation: {
                  duration: 400,
                  easingFunction: 'easeInOutQuad'
                }
              });
              
              // Final resize check
              setTimeout(() => {
                if (networkRef.current && container) {
                  networkRef.current.setSize(`${container.clientWidth}px`, `${container.clientHeight}px`);
                }
              }, 500);
            }
          }, 700);
        });
      }
      
      setNodeCount(graphData.nodeCount);
      if (graphData.nodeCount > 300) {
        setError(`Large graph detected: ${graphData.nodeCount} nodes. Performance may be affected.`);
      } else {
        // Clear any previous error if we successfully loaded nodes
        setError(null);
      }
      
      setIsLoading(false);
      console.log('Graph rendered successfully with', nodes.length, 'nodes and', edges.length, 'edges');
    } catch (err: any) {
      console.error('Error rendering graph:', err);
      setIsLoading(false);
      setError(err.message || 'Failed to render graph. Please check your backend connection and try again.');
      setShowFallback(true);
      
      // Clean up on error
      if (networkRef.current) {
        try {
          networkRef.current.destroy();
        } catch (e) {
          // Ignore cleanup errors
        }
        networkRef.current = null;
      }
    }
  };

  // Handle window resize to keep graph sized correctly
  useEffect(() => {
    const handleResize = () => {
      if (networkRef.current && containerRef.current) {
        const container = containerRef.current;
        networkRef.current.setSize(`${container.clientWidth}px`, `${container.clientHeight}px`);
        networkRef.current.redraw();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Render graph when view changes or modal opens
  useEffect(() => {
    if (isOpen) {
      // Clean up previous visualization first
      if (networkRef.current) {
        try {
          networkRef.current.destroy();
        } catch (e) {
          // Ignore cleanup errors
        }
        networkRef.current = null;
      }

      const query = activeView === 'taxonomy' ? cypherQueries.taxonomy : cypherQueries.model;
      // Small delay to ensure DOM is ready and previous viz is cleared
      const timeoutId = setTimeout(() => {
        runGraphQuery(query);
      }, 200);
      
      return () => {
        clearTimeout(timeoutId);
        if (networkRef.current) {
          try {
            networkRef.current.destroy();
          } catch (e) {
            // Ignore cleanup errors
          }
          networkRef.current = null;
        }
      };
    } else {
      // Clean up when modal closes
      if (networkRef.current) {
        try {
          networkRef.current.destroy();
        } catch (e) {
          // Ignore cleanup errors
        }
        networkRef.current = null;
      }
    }
  }, [isOpen, activeView]);

  // Reset copy success when switching tabs
  useEffect(() => {
    setCopySuccess(false);
  }, [activeView]);

  const handleRefresh = () => {
    const query = activeView === 'taxonomy' ? cypherQueries.taxonomy : cypherQueries.model;
    runGraphQuery(query);
  };

  const copyQueryToClipboard = (query: string) => {
    navigator.clipboard.writeText(query).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(err => {
      console.error('Failed to copy query:', err);
    });
  };

  const handleOpenInNeo4jConsole = () => {
    // Open Neo4j Console - user can connect to CDM_Dev instance manually
    // Note: Direct linking to a specific Neo4j instance requires the neo4j:// protocol
    // which only works when Neo4j Browser is installed. For web, we'll open the console.
    window.open('https://console.neo4j.io', '_blank');
  };

  const handleZoomIn = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale * 1.2 });
    }
  };

  const handleZoomOut = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale * 0.8 });
    }
  };

  const handleCopyProperty = (value: string) => {
    navigator.clipboard.writeText(String(value)).then(() => {
      // Could show a toast notification here
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  const formatPropertyKey = (key: string): string => {
    // Convert camelCase or snake_case to Title Case
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border w-[95vw] h-[90vh] max-w-[95vw] max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-ag-dark-border">
          <div className="flex items-center gap-3">
            <Network className="w-6 h-6 text-ag-dark-accent" />
            <div>
              <h3 className="text-lg font-semibold text-ag-dark-text">
                Neo4j Knowledge Graph
              </h3>
              <p className="text-xs text-ag-dark-text-secondary mt-1">
                Instance: <span className="font-medium">{envInfo.instanceName}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 text-ag-dark-text-secondary hover:text-ag-dark-text hover:bg-ag-dark-bg rounded transition-colors disabled:opacity-50"
              title="Refresh graph"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-ag-dark-text-secondary hover:text-ag-dark-text hover:bg-ag-dark-bg rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error/Warning Banner */}
        {error && (
          <div className="px-6 pt-4 pb-2">
            <div className={`flex items-start gap-2 p-3 rounded-lg border ${
              nodeCount && nodeCount > 300 
                ? 'bg-yellow-900/20 border-yellow-700/50' 
                : 'bg-red-900/20 border-red-700/50'
            }`}>
              <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                nodeCount && nodeCount > 300 ? 'text-yellow-400' : 'text-red-400'
              }`} />
              <p className={`text-sm ${
                nodeCount && nodeCount > 300 ? 'text-yellow-300' : 'text-red-300'
              }`}>
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-ag-dark-border px-6">
          <div className="flex">
            <button
              onClick={() => setActiveView('taxonomy')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeView === 'taxonomy'
                  ? 'text-ag-dark-accent border-ag-dark-accent'
                  : 'text-ag-dark-text-secondary hover:text-ag-dark-text border-transparent'
              }`}
            >
              {graphType === 'variables' ? 'Variable Taxonomy' : 'Object Taxonomy'}
            </button>
            <button
              onClick={() => setActiveView('model')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeView === 'model'
                  ? 'text-ag-dark-accent border-ag-dark-accent'
                  : 'text-ag-dark-text-secondary hover:text-ag-dark-text border-transparent'
              }`}
            >
              {graphType === 'variables' ? 'Variable-Object Model' : 'Object Model'}
            </button>
          </div>
          {/* Eye Icon - Show details panel (far right of tabs bar) */}
          {(selectedNode || selectedEdge) && (
            <button
              onClick={() => setShowDetailsPanel(true)}
              className="p-2 text-ag-dark-accent hover:text-ag-dark-accent-hover hover:bg-ag-dark-bg rounded transition-colors"
              title={selectedNode ? 'View node details' : 'View relationship details'}
            >
              <Eye className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Area - Graph takes full height, query scrollable below */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {/* Graph Visualization Area - Takes remaining space */}
          <div className="flex-1 bg-ag-dark-bg border-x border-ag-dark-border relative min-h-0 overflow-hidden" style={{ flex: '1 1 auto', minHeight: 'calc(90vh - 180px)' }}>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-ag-dark-bg/80 z-10">
                <div className="text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-ag-dark-accent mx-auto animate-spin" />
                  <p className="text-sm text-ag-dark-text-secondary">Loading graph...</p>
                </div>
              </div>
            )}
            {showFallback && error && (
              <div className="absolute inset-0 flex items-center justify-center bg-ag-dark-bg z-10">
                <div className="text-center space-y-4 p-8">
                  <Network className="w-16 h-16 text-ag-dark-text-secondary mx-auto opacity-50" />
                  <div>
                    <p className="text-sm text-ag-dark-text-secondary mb-2">
                      {error}
                    </p>
                    <button
                      onClick={handleOpenInNeo4jConsole}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-ag-dark-accent text-ag-dark-accent rounded hover:bg-ag-dark-accent hover:text-white transition-colors text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View in Neo4j Console
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div 
              id={getContainerId()} 
              ref={containerRef}
              className="w-full h-full"
              style={{ 
                backgroundColor: '#0e1621',
                position: 'relative',
                width: '100%',
                height: '100%',
                minHeight: 0 // Remove minHeight to let flexbox control sizing
              }} 
            />
            

            {/* Zoom Controls - Positioned in bottom-right corner */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
              <button
                onClick={handleZoomIn}
                className="p-2 bg-ag-dark-surface border border-ag-dark-border rounded shadow-lg text-ag-dark-text hover:text-ag-dark-accent hover:border-ag-dark-accent transition-colors"
                title="Zoom In"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-2 bg-ag-dark-surface border border-ag-dark-border rounded shadow-lg text-ag-dark-text hover:text-ag-dark-accent hover:border-ag-dark-accent transition-colors"
                title="Zoom Out"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Details Side Panel */}
          {showDetailsPanel && (
            <div className="absolute top-0 right-0 w-80 h-full bg-ag-dark-surface border-l border-ag-dark-border shadow-xl z-30 flex flex-col">
              {/* Panel Header */}
              <div className="flex items-center justify-between p-4 border-b border-ag-dark-border">
                <h3 className="text-sm font-semibold text-ag-dark-text">
                  {selectedNode ? 'Node details' : 'Relationship details'}
                </h3>
                <button
                  onClick={() => {
                    setShowDetailsPanel(false);
                    // Don't clear selectedNode/selectedEdge - keep them selected so eye icon stays
                  }}
                  className="p-1 text-ag-dark-text-secondary hover:text-ag-dark-text hover:bg-ag-dark-bg rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {selectedNode && (
                  <div className="space-y-4">
                    {/* Node Type/Label */}
                    {selectedNode.group && (
                      <div className="mb-4">
                        <span className="inline-block px-3 py-1 rounded text-xs font-medium bg-ag-dark-accent/20 text-ag-dark-accent border border-ag-dark-accent/30">
                          {selectedNode.group}
                        </span>
                      </div>
                    )}

                    {/* Node Properties */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-ag-dark-text-secondary uppercase mb-3 block">
                        Properties
                      </label>
                      {selectedNode.properties && Object.entries(selectedNode.properties).map(([key, value]) => (
                        <div key={key} className="border-b border-ag-dark-border pb-2 last:border-b-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-ag-dark-text-secondary mb-1">
                                {formatPropertyKey(key)}
                              </div>
                              <div className="text-sm text-ag-dark-text break-words">
                                {String(value)}
                              </div>
                            </div>
                            <button
                              onClick={() => handleCopyProperty(String(value))}
                              className="p-1 text-ag-dark-text-secondary hover:text-ag-dark-accent hover:bg-ag-dark-bg rounded transition-colors flex-shrink-0"
                              title="Copy value"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {selectedNode.label && !selectedNode.properties?.label && (
                        <div className="border-b border-ag-dark-border pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-ag-dark-text-secondary mb-1">
                                Label
                              </div>
                              <div className="text-sm text-ag-dark-text break-words">
                                {selectedNode.label}
                              </div>
                            </div>
                            <button
                              onClick={() => handleCopyProperty(selectedNode.label)}
                              className="p-1 text-ag-dark-text-secondary hover:text-ag-dark-accent hover:bg-ag-dark-bg rounded transition-colors flex-shrink-0"
                              title="Copy value"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedEdge && (
                  <div className="space-y-4">
                    {/* Relationship Type */}
                    {selectedEdge.label && (
                      <div className="mb-4">
                        <span className="inline-block px-3 py-1 rounded text-xs font-medium bg-ag-dark-accent/20 text-ag-dark-accent border border-ag-dark-accent/30">
                          {selectedEdge.label}
                        </span>
                      </div>
                    )}

                    {/* Relationship Properties */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-ag-dark-text-secondary uppercase mb-3 block">
                        Properties
                      </label>
                      {selectedEdge.properties && Object.entries(selectedEdge.properties).map(([key, value]) => (
                        <div key={key} className="border-b border-ag-dark-border pb-2 last:border-b-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-ag-dark-text-secondary mb-1">
                                {formatPropertyKey(key)}
                              </div>
                              <div className="text-sm text-ag-dark-text break-words">
                                {String(value)}
                              </div>
                            </div>
                            <button
                              onClick={() => handleCopyProperty(String(value))}
                              className="p-1 text-ag-dark-text-secondary hover:text-ag-dark-accent hover:bg-ag-dark-bg rounded transition-colors flex-shrink-0"
                              title="Copy value"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {selectedEdge.label && (!selectedEdge.properties || !selectedEdge.properties.type) && (
                        <div className="border-b border-ag-dark-border pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-ag-dark-text-secondary mb-1">
                                Type
                              </div>
                              <div className="text-sm text-ag-dark-text break-words">
                                {selectedEdge.label}
                              </div>
                            </div>
                            <button
                              onClick={() => handleCopyProperty(selectedEdge.label)}
                              className="p-1 text-ag-dark-text-secondary hover:text-ag-dark-accent hover:bg-ag-dark-bg rounded transition-colors flex-shrink-0"
                              title="Copy value"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scrollable Content Below Graph - Fixed position at bottom */}
          <div className="flex-shrink-0 border-t border-ag-dark-border bg-ag-dark-surface">
            {/* Action Buttons - Side by side */}
            <div className="px-6 py-3 flex gap-3">
              <button
                onClick={() => setShowCypherQuery(!showCypherQuery)}
                className="inline-flex items-center gap-2 px-3 py-2 border border-ag-dark-border rounded text-sm font-medium text-ag-dark-text hover:bg-ag-dark-bg transition-colors"
              >
                {showCypherQuery ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Hide Cypher Query
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    View Cypher Query
                  </>
                )}
              </button>
              
              <button
                onClick={handleOpenInNeo4jConsole}
                className="inline-flex items-center gap-2 px-3 py-2 border border-ag-dark-accent text-ag-dark-accent rounded text-sm font-medium hover:bg-ag-dark-accent hover:text-white transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View in Neo4j Console
              </button>
            </div>

            {/* Cypher Query - Expandable below buttons */}
            {showCypherQuery && (
              <div className="px-6 pb-4 border-t border-ag-dark-border bg-ag-dark-bg">
                <div className="flex items-center justify-between mb-2 pt-4">
                  <label className="text-xs font-medium text-ag-dark-text-secondary uppercase">
                    Cypher Query
                  </label>
                  <button
                    onClick={() => copyQueryToClipboard(activeView === 'taxonomy' ? cypherQueries.taxonomy : cypherQueries.model)}
                    className={`text-xs transition-colors px-2 py-1 rounded ${
                      copySuccess ? 'text-ag-dark-success' : 'text-ag-dark-accent hover:text-ag-dark-accent-hover hover:bg-ag-dark-surface'
                    }`}
                  >
                    {copySuccess ? 'Copied!' : 'Copy Query'}
                  </button>
                </div>
                <pre className="text-xs text-ag-dark-text font-mono bg-ag-dark-surface p-3 rounded overflow-x-auto border border-ag-dark-border">
                  {activeView === 'taxonomy' ? cypherQueries.taxonomy : cypherQueries.model}
                </pre>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
