import React, { useState, useEffect, useRef } from 'react';
import { X, Network, Eye, Copy, Plus, Minus, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
// @ts-ignore - vis-network doesn't have complete TypeScript definitions
import { Network as VisNetwork } from 'vis-network/standalone';
// @ts-ignore - vis-network types
import type { Data, Options, Node, Edge } from 'vis-network';
import { executeGraphQuery } from '../services/api';

interface VariableListRelationshipsGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  // List mode props
  listId?: string; // Optional - for single list mode (preferred)
  listName?: string; // Optional - for single list mode (fallback)
  listIds?: string[]; // Optional - for bulk mode (preferred)
  listNames?: string[]; // Optional - for bulk mode (fallback)
  isBulkMode?: boolean; // Flag to indicate bulk mode
}

export const VariableListRelationshipsGraphModal: React.FC<VariableListRelationshipsGraphModalProps> = ({
  isOpen,
  onClose,
  listId,
  listName,
  listIds,
  listNames,
  isBulkMode = false
}) => {
  // Detect mode (single vs bulk) - prefer IDs if available
  const isBulk = isBulkMode && (listIds?.length > 0 || listNames?.length > 0);
  const hasListIds = isBulk ? (listIds?.length > 0) : !!listId;
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [showCypherQuery, setShowCypherQuery] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [cypherQuery, setCypherQuery] = useState('');
  const networkRef = useRef<VisNetwork | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);
  const allNodesData = useRef<any[]>([]);
  const allEdgesData = useRef<any[]>([]);

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

  // Color configurations
  const getColorConfig = () => {
    return {
      Variable: { background: '#3B82F6', border: '#2563EB', highlight: { background: '#60A5FA', border: '#3B82F6' } },
      List: { background: '#FFD700', border: '#D4AF37', highlight: { background: '#FFE55C', border: '#FFD700' } }
    };
  };

  // All edges are grey
  const getEdgeColor = (edge: any) => {
    return '#6B7280'; // Grey for all
  };

  const loadGraph = async () => {
    // Prevent concurrent loads
    if (isLoadingRef.current) {
      console.log('loadGraph: Already loading, skipping...');
      return;
    }
    
    console.log('loadGraph: Starting load', { isBulk, listName, listNames: listNames?.length });
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

      // Build Cypher query for variable-list relationships
      let query = '';
      if (isBulk) {
        if (listIds && listIds.length > 0) {
          const listIdParams = listIds.map(id => `'${id}'`).join(', ');
          query = `MATCH (v:Variable)-[r:HAS_LIST]->(l:List)
WHERE l.id IN [${listIdParams}]
RETURN v, r, l`;
        } else if (listNames && listNames.length > 0) {
          const listNameParams = listNames.map(name => `'${name.replace(/'/g, "\\'")}'`).join(', ');
          query = `MATCH (v:Variable)-[r:HAS_LIST]->(l:List)
WHERE l.list IN [${listNameParams}]
RETURN v, r, l`;
        }
      } else {
        if (listId) {
          query = `MATCH (v:Variable)-[r:HAS_LIST]->(l:List)
WHERE l.id = '${listId}'
RETURN v, r, l`;
        } else if (listName) {
          query = `MATCH (v:Variable)-[r:HAS_LIST]->(l:List)
WHERE l.list = '${listName.replace(/'/g, "\\'")}'
RETURN v, r, l`;
        }
      }

      if (!query) {
        setError('No list ID or name provided.');
        setIsLoading(false);
        isLoadingRef.current = false;
        return;
      }

      setCypherQuery(query);

      // Execute query
      const graphData = await executeGraphQuery(query);

      if (graphData.nodeCount === 0) {
        setError('No relationships found. This list may not have any variables attached.');
        setIsLoading(false);
        isLoadingRef.current = false;
        return;
      }

      const colorConfig = getColorConfig();

      // Store node and edge data for click handlers
      allNodesData.current = graphData.nodes;
      allEdgesData.current = graphData.edges;

      // Map nodes with colors based on labels
      const nodes: Node[] = graphData.nodes.map((node: any) => {
        const group = node.group || 'Unknown';
        const colorConfigForNode = colorConfig[group as keyof typeof colorConfig] || { 
          background: '#6B7280', 
          border: '#4B5563', 
          highlight: { background: '#9CA3AF', border: '#6B7280' } 
        };
        
        // Highlight selected nodes (lists)
        let isSelected = false;
        if (isBulk) {
          isSelected = (listIds && listIds.some(id => node.properties?.id === id)) || 
                      (listNames && listNames.some(name => node.label === name || node.properties?.list === name));
        } else {
          isSelected = (listId && node.properties?.id === listId) ||
                      (listName && (node.label === listName || node.properties?.list === listName));
        }
        const nodeColor = isSelected 
          ? { background: '#FFD700', border: '#D4AF37', highlight: { background: '#FFE55C', border: '#FFD700' } }
          : colorConfigForNode;
        
        return {
          id: String(node.id),
          label: String(node.label || node.id),
          group: group,
          color: nodeColor,
          font: { color: '#E5E7EB', size: 14 },
          size: isSelected ? 20 : 16,
          properties: node.properties || {}
        };
      });

      // Map edges with colors and labels
      const edges: Edge[] = graphData.edges.map((edge: any) => ({
        id: String(edge.id),
        from: String(edge.from),
        to: String(edge.to),
        label: edge.label || edge.type || 'HAS_LIST',
        color: { color: getEdgeColor(edge), highlight: getEdgeColor(edge) },
        font: { color: '#9333EA', size: 12, align: 'middle' },
        arrows: { to: { enabled: true, scaleFactor: 0.8 } },
        width: 2
      }));

      // Create vis-network data structure
      const data: Data = { nodes, edges };

      // Configure vis-network options
      const options: Options = {
        nodes: {
          shape: 'dot',
          font: {
            color: '#E5E7EB',
            size: 14
          },
          borderWidth: 2,
          shadow: true
        },
        edges: {
          color: {
            color: '#6B7280',
            highlight: '#6B7280'
          },
          font: {
            color: '#9333EA',
            size: 12,
            align: 'middle'
          },
          arrows: {
            to: {
              enabled: true,
              scaleFactor: 0.8
            }
          },
          width: 2,
          smooth: {
            type: 'continuous',
            roundness: 0.5
          }
        },
        physics: {
          enabled: true,
          stabilization: {
            iterations: 200
          },
          barnesHut: {
            gravitationalConstant: -2000,
            centralGravity: 0.1,
            springLength: 200,
            springConstant: 0.04,
            damping: 0.09
          }
        },
        interaction: {
          hover: true,
          tooltipDelay: 200,
          zoomView: true,
          dragView: true
        }
      };

      // Create network visualization
      networkRef.current = new VisNetwork(containerRef.current, data, options);

      // Handle node click
      networkRef.current.on('click', (params: any) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          const node = allNodesData.current.find((n: any) => String(n.id) === String(nodeId));
          if (node) {
            setSelectedNode({
              ...node,
              label: node.label || node.properties?.name || node.properties?.variable || node.properties?.list || String(node.id),
              group: node.group || 'Unknown'
            });
            setSelectedEdge(null);
            // Don't auto-open panel - user will click eye icon
          }
        } else if (params.edges.length > 0) {
          const edgeId = params.edges[0];
          const edge = allEdgesData.current.find((e: any) => String(e.id) === String(edgeId));
          if (edge) {
            setSelectedEdge(edge);
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

      setIsLoading(false);
      isLoadingRef.current = false;
    } catch (err: any) {
      console.error('Error loading graph:', err);
      setError(err.message || 'Failed to load graph');
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  // Load graph when modal opens
  useEffect(() => {
    if (isOpen && (hasListIds || listName || (listNames && listNames.length > 0))) {
      loadGraph();
    }
    
    // Cleanup on close
    return () => {
      if (networkRef.current) {
        try {
          networkRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying network on cleanup:', e);
        }
        networkRef.current = null;
      }
      setSelectedNode(null);
      setSelectedEdge(null);
      setShowDetailsPanel(false);
      setShowCypherQuery(false);
      setError(null);
    };
  }, [isOpen, listId, listName, listIds, listNames]);

  const copyCypherToClipboard = () => {
    navigator.clipboard.writeText(cypherQuery).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const openNeo4jConsole = () => {
    const encodedQuery = encodeURIComponent(cypherQuery);
    const neo4jUrl = `https://console.neo4j.org/?query=${encodedQuery}`;
    window.open(neo4jUrl, '_blank');
  };

  if (!isOpen) return null;

  // Get list name(s) for display
  const displayListName = isBulk 
    ? (listNames && listNames.length > 0 ? listNames.join(', ') : `${listIds?.length || 0} lists`)
    : (listName || 'List');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-ag-dark-surface rounded-lg border border-ag-dark-border w-[90vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-ag-dark-border">
          <div>
            <h2 className="text-xl font-semibold text-ag-dark-text">Variable-List Applicability</h2>
            <p className="text-sm text-ag-dark-text-secondary mt-1">
              List: {displayListName} | Instance: {envInfo.instanceName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Graph Container */}
        <div className="flex-1 relative bg-ag-dark-bg p-6">
          {isLoading && (
            <div className="absolute inset-6 flex items-center justify-center bg-ag-dark-bg/90 z-10 rounded border border-ag-dark-border">
              <div className="text-ag-dark-text">Loading graph...</div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-6 flex items-center justify-center bg-ag-dark-bg/90 z-10 rounded border border-ag-dark-border">
              <div className="text-red-400">{error}</div>
            </div>
          )}

          <div 
            ref={containerRef}
            className="w-full h-full bg-ag-dark-bg border border-ag-dark-border rounded"
            style={{ minHeight: '400px' }}
          />

          {/* Eye Icon - Show details panel - appears in top right of graph view when node/edge is selected */}
          {(selectedNode || selectedEdge) && (
            <div className="absolute top-12 right-12 z-30">
              <button
                onClick={() => setShowDetailsPanel(!showDetailsPanel)}
                className={`bg-ag-dark-surface border border-ag-dark-border rounded p-2 text-ag-dark-text hover:bg-ag-dark-bg transition-colors shadow-lg ${
                  showDetailsPanel ? 'bg-ag-dark-accent bg-opacity-20 border-ag-dark-accent' : ''
                }`}
                title={showDetailsPanel ? "Hide Details" : "Show Details"}
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Zoom Controls - Adjust position when details panel is open */}
          <div 
            className={`absolute bottom-10 flex flex-col gap-2 z-20 transition-all ${
              showDetailsPanel ? 'right-[22rem]' : 'right-10'
            }`}
          >
            <button
              onClick={() => networkRef.current?.moveTo({ scale: (networkRef.current?.getScale() || 1) * 1.2 })}
              className="bg-ag-dark-surface border border-ag-dark-border rounded p-2 text-ag-dark-text hover:bg-ag-dark-bg transition-colors shadow-lg"
              title="Zoom In"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => networkRef.current?.moveTo({ scale: (networkRef.current?.getScale() || 1) * 0.8 })}
              className="bg-ag-dark-surface border border-ag-dark-border rounded p-2 text-ag-dark-text hover:bg-ag-dark-bg transition-colors shadow-lg"
              title="Zoom Out"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>


          {/* Details Side Panel - Positioned on the right */}
          {showDetailsPanel && (selectedNode || selectedEdge) && (
            <div className="absolute top-6 right-6 bottom-6 w-80 bg-ag-dark-surface border border-ag-dark-border rounded shadow-xl z-30 flex flex-col">
              {/* Panel Header */}
              <div className="flex items-center justify-between p-4 border-b border-ag-dark-border">
                <h3 className="text-sm font-semibold text-ag-dark-text">
                  {selectedNode ? 'Node Properties' : 'Edge Properties'}
                </h3>
                <button
                  onClick={() => setShowDetailsPanel(false)}
                  className="p-1 text-ag-dark-text-secondary hover:text-ag-dark-text hover:bg-ag-dark-bg rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {selectedNode && (
                  <div className="space-y-4">
                    {selectedNode.group && (
                      <div className="mb-4">
                        <span className="inline-block px-3 py-1 rounded text-xs font-medium bg-ag-dark-accent/20 text-ag-dark-accent border border-ag-dark-accent/30">
                          {selectedNode.group}
                        </span>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-ag-dark-text-secondary uppercase mb-3 block">
                        Properties
                      </label>
                      {selectedNode.label && (
                        <div className="border-b border-ag-dark-border pb-2">
                          <div className="text-xs font-medium text-ag-dark-text-secondary mb-1">Label</div>
                          <div className="text-sm text-ag-dark-text break-words">{selectedNode.label}</div>
                        </div>
                      )}
                      {selectedNode.properties && Object.entries(selectedNode.properties).map(([key, value]) => (
                        <div key={key} className="border-b border-ag-dark-border pb-2 last:border-b-0">
                          <div className="text-xs font-medium text-ag-dark-text-secondary mb-1">{key}</div>
                          <div className="text-sm text-ag-dark-text break-words">{String(value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedEdge && (
                  <div className="space-y-4">
                    {selectedEdge.label && (
                      <div className="mb-4">
                        <span className="inline-block px-3 py-1 rounded text-xs font-medium bg-ag-dark-accent/20 text-ag-dark-accent border border-ag-dark-accent/30">
                          {selectedEdge.label || selectedEdge.type || 'Unknown'}
                        </span>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-ag-dark-text-secondary uppercase mb-3 block">
                        Properties
                      </label>
                      {selectedEdge.properties && Object.entries(selectedEdge.properties).map(([key, value]) => (
                        <div key={key} className="border-b border-ag-dark-border pb-2 last:border-b-0">
                          <div className="text-xs font-medium text-ag-dark-text-secondary mb-1">{key}</div>
                          <div className="text-sm text-ag-dark-text break-words">{String(value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Cypher Query Section - Always visible at bottom, expands upwards */}
        <div className="relative flex-shrink-0">
          {/* Action Buttons - Always visible at bottom */}
          <div className="px-6 py-3 flex items-center justify-between border-t border-ag-dark-border bg-ag-dark-surface">
            <div className="flex gap-2">
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
            </div>
            <div className="flex gap-2">
              <button
                onClick={openNeo4jConsole}
                className="inline-flex items-center gap-2 px-3 py-2 border border-ag-dark-accent text-ag-dark-accent rounded text-sm font-medium hover:bg-ag-dark-accent hover:text-white transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View in Neo4j Console
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          {/* Cypher Query Display - Expandable upwards from bottom */}
          {showCypherQuery && (
            <div className="absolute bottom-full left-0 right-0 px-6 pb-4 border-t border-ag-dark-border bg-ag-dark-bg overflow-y-auto shadow-lg" style={{ maxHeight: '20vh', minHeight: '120px' }}>
              <div className="flex items-center justify-between mb-2 pt-4">
                <label className="text-xs font-medium text-ag-dark-text-secondary uppercase">
                  Cypher Query
                </label>
                <button
                  onClick={copyCypherToClipboard}
                  className={`text-xs transition-colors px-2 py-1 rounded ${
                    copySuccess ? 'text-ag-dark-success' : 'text-ag-dark-accent hover:text-ag-dark-accent-hover hover:bg-ag-dark-surface'
                  }`}
                  title="Copy Cypher Query"
                >
                  <Copy className="w-4 h-4 inline mr-1" />
                  {copySuccess ? 'Copied!' : 'Copy Query'}
                </button>
              </div>
              <pre className="text-xs text-ag-dark-text font-mono bg-ag-dark-surface p-3 rounded overflow-x-auto border border-ag-dark-border whitespace-pre-wrap break-words">
                {cypherQuery}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
