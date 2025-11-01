import React, { useState, useEffect, useRef } from 'react';
import { X, Info, Network, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
// @ts-ignore - vis-network doesn't have complete TypeScript definitions
import { Network as VisNetwork } from 'vis-network/standalone';
// @ts-ignore - vis-network types
import type { Data, Options, Node, Edge } from 'vis-network';
import { executeGraphQuery } from '../services/api';

interface Neo4jGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GraphView = 'taxonomy' | 'model';

export const Neo4jGraphModal: React.FC<Neo4jGraphModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeView, setActiveView] = useState<GraphView>('taxonomy');
  const [isLoading, setIsLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState<number | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const networkRef = useRef<VisNetwork | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Use a unique container ID that changes with the active view
  const getContainerId = () => `graph-container-${activeView}`;

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

  // Cypher queries for each view
  // neovis.js works best when we return paths or all nodes/relationships
  // Returning individual nodes and relationships works well
  const cypherQueries = {
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

      // Map nodes with colors based on labels
      const labelColors: Record<string, { background: string; border: string; highlight: { background: string; border: string } }> = {
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

      // Map edges - ensure IDs are strings
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
        font: { color: '#9CA3AF', size: 12 },
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
          font: { size: 12, color: '#9CA3AF' },
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

  const handleOpenInNeo4jBrowser = (view: GraphView) => {
    const query = cypherQueries[view];
    copyQueryToClipboard(query);
    // Open Neo4j Console in a new tab
    window.open('https://console.neo4j.io', '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col">
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

        {/* Info Banner */}
        {!error && (
          <div className="px-6 pt-4 pb-2">
            <div className="flex items-start gap-2 p-3 bg-ag-dark-bg border border-ag-dark-border rounded-lg">
              <Info className="w-4 h-4 text-ag-dark-accent mt-0.5 flex-shrink-0" />
              <p className="text-sm text-ag-dark-text-secondary">
                Explore Object relationships and taxonomy directly from Neo4j. 
                {nodeCount && (
                  <span className="ml-1 font-medium">Graph contains {nodeCount} nodes.</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-ag-dark-border px-6">
          <button
            onClick={() => setActiveView('taxonomy')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeView === 'taxonomy'
                ? 'text-ag-dark-accent border-ag-dark-accent'
                : 'text-ag-dark-text-secondary hover:text-ag-dark-text border-transparent'
            }`}
          >
            Object Taxonomy
          </button>
          <button
            onClick={() => setActiveView('model')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeView === 'model'
                ? 'text-ag-dark-accent border-ag-dark-accent'
                : 'text-ag-dark-text-secondary hover:text-ag-dark-text border-transparent'
            }`}
          >
            Object Model
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeView === 'taxonomy' ? (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-ag-dark-text mb-2">
                  Object Taxonomy View
                </h4>
                <p className="text-sm text-ag-dark-text-secondary mb-4">
                  Displays the hierarchical structure: <strong>Being → Avatar → Object → Variant</strong>
                </p>
              </div>

              {/* Graph Visualization Area */}
              <div className="bg-ag-dark-bg border border-ag-dark-border rounded-lg relative min-h-[500px]">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-ag-dark-bg/80 z-10 rounded-lg">
                    <div className="text-center space-y-3">
                      <RefreshCw className="w-8 h-8 text-ag-dark-accent mx-auto animate-spin" />
                      <p className="text-sm text-ag-dark-text-secondary">Loading graph...</p>
                    </div>
                  </div>
                )}
                {showFallback && error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-ag-dark-bg z-10 rounded-lg">
                    <div className="text-center space-y-4 p-8">
                      <Network className="w-16 h-16 text-ag-dark-text-secondary mx-auto opacity-50" />
                      <div>
                        <p className="text-sm text-ag-dark-text-secondary mb-2">
                          {error}
                        </p>
                        <button
                          onClick={() => handleOpenInNeo4jBrowser('taxonomy')}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-ag-dark-accent text-ag-dark-accent rounded hover:bg-ag-dark-accent hover:text-white transition-colors text-sm"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open in Neo4j Browser
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div 
                  id={getContainerId()} 
                  ref={containerRef}
                  style={{ height: '500px', width: '100%', backgroundColor: '#0e1621' }} 
                />
              </div>

              {/* Cypher Query Display */}
              <div className="bg-ag-dark-bg border border-ag-dark-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-ag-dark-text-secondary uppercase">
                    Cypher Query
                  </label>
                  <button
                    onClick={() => copyQueryToClipboard(cypherQueries.taxonomy)}
                    className={`text-xs transition-colors ${
                      copySuccess ? 'text-ag-dark-success' : 'text-ag-dark-accent hover:text-ag-dark-accent-hover'
                    }`}
                  >
                    {copySuccess ? 'Copied!' : 'Copy Query'}
                  </button>
                </div>
                <pre className="text-xs text-ag-dark-text font-mono bg-ag-dark-surface p-3 rounded overflow-x-auto">
                  {cypherQueries.taxonomy}
                </pre>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleOpenInNeo4jBrowser('taxonomy')}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 border border-ag-dark-accent text-ag-dark-accent rounded hover:bg-ag-dark-accent hover:text-white transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open Object Taxonomy in Neo4j Browser
                <span className="text-xs opacity-75">(Query will be copied to clipboard)</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-ag-dark-text mb-2">
                  Object Model View
                </h4>
                <p className="text-sm text-ag-dark-text-secondary mb-4">
                  Expands the Taxonomy to include <strong>Object-to-Object relationships</strong> with role properties.
                </p>
              </div>

              {/* Graph Visualization Area */}
              <div className="bg-ag-dark-bg border border-ag-dark-border rounded-lg relative min-h-[500px]">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-ag-dark-bg/80 z-10 rounded-lg">
                    <div className="text-center space-y-3">
                      <RefreshCw className="w-8 h-8 text-ag-dark-accent mx-auto animate-spin" />
                      <p className="text-sm text-ag-dark-text-secondary">Loading graph...</p>
                    </div>
                  </div>
                )}
                {showFallback && error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-ag-dark-bg z-10 rounded-lg">
                    <div className="text-center space-y-4 p-8">
                      <Network className="w-16 h-16 text-ag-dark-text-secondary mx-auto opacity-50" />
                      <div>
                        <p className="text-sm text-ag-dark-text-secondary mb-2">
                          {error}
                        </p>
                        <button
                          onClick={() => handleOpenInNeo4jBrowser('model')}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-ag-dark-accent text-ag-dark-accent rounded hover:bg-ag-dark-accent hover:text-white transition-colors text-sm"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open in Neo4j Browser
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div 
                  id={getContainerId()} 
                  ref={containerRef}
                  style={{ height: '500px', width: '100%', backgroundColor: '#0e1621' }} 
                />
              </div>

              {/* Cypher Query Display */}
              <div className="bg-ag-dark-bg border border-ag-dark-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-ag-dark-text-secondary uppercase">
                    Cypher Query
                  </label>
                  <button
                    onClick={() => copyQueryToClipboard(cypherQueries.model)}
                    className={`text-xs transition-colors ${
                      copySuccess ? 'text-ag-dark-success' : 'text-ag-dark-accent hover:text-ag-dark-accent-hover'
                    }`}
                  >
                    {copySuccess ? 'Copied!' : 'Copy Query'}
                  </button>
                </div>
                <pre className="text-xs text-ag-dark-text font-mono bg-ag-dark-surface p-3 rounded overflow-x-auto">
                  {cypherQueries.model}
                </pre>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleOpenInNeo4jBrowser('model')}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 border border-ag-dark-accent text-ag-dark-accent rounded hover:bg-ag-dark-accent hover:text-white transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open Object Model in Neo4j Browser
                <span className="text-xs opacity-75">(Query will be copied to clipboard)</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-ag-dark-border bg-ag-dark-bg rounded-b-lg">
          <p className="text-xs text-ag-dark-text-secondary text-center">
            Graph visualization limited to ~300 nodes for performance. Use Neo4j Browser for full view.
          </p>
        </div>
      </div>
    </div>
  );
};
