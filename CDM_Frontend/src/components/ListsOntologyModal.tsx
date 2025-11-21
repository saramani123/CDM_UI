import React, { useState, useEffect, useRef } from 'react';
import { X, Network, Eye, Copy, Plus, Minus, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
// @ts-ignore - vis-network doesn't have complete TypeScript definitions
import { Network as VisNetwork } from 'vis-network/standalone';
// @ts-ignore - vis-network types
import type { Data, Options, Node, Edge } from 'vis-network';
import { getListOntologyView, getBulkListOntologyView } from '../services/api';

interface ListsOntologyModalProps {
  isOpen: boolean;
  onClose: () => void;
  // List mode props
  listId?: string; // Optional - for single list mode (preferred)
  listName?: string; // Optional - for single list mode (fallback)
  listIds?: string[]; // Optional - for bulk mode (preferred)
  listNames?: string[]; // Optional - for bulk mode (fallback)
  sectionName: string;
  viewType: 'drivers' | 'ontology' | 'metadata' | 'listValues' | 'variations';
  isBulkMode?: boolean; // Flag to indicate bulk mode
}

export const ListsOntologyModal: React.FC<ListsOntologyModalProps> = ({
  isOpen,
  onClose,
  listId,
  listName,
  listIds,
  listNames,
  sectionName,
  viewType,
  isBulkMode = false
}) => {
  // Detect mode (single vs bulk) - prefer IDs if available
  const isBulk = isBulkMode && (listIds?.length > 0 || listNames?.length > 0);
  const hasListIds = isBulk ? (listIds?.length > 0) : !!listId;
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  // For metadata view, auto-expand properties panel
  const [showDetailsPanel, setShowDetailsPanel] = useState(viewType === 'metadata');
  const [showCypherQuery, setShowCypherQuery] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
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

  // Color configurations for different views
  const getColorConfig = () => {
    switch (viewType) {
      case 'drivers':
        return {
          Sector: { background: '#10B981', border: '#059669', highlight: { background: '#34D399', border: '#10B981' } },
          Domain: { background: '#3B82F6', border: '#2563EB', highlight: { background: '#60A5FA', border: '#3B82F6' } },
          Country: { background: '#F59E0B', border: '#D97706', highlight: { background: '#FBBF24', border: '#F59E0B' } },
          List: { background: '#EF4444', border: '#DC2626', highlight: { background: '#F87171', border: '#EF4444' } } // Bold color for focus node
        };
      case 'ontology':
        return {
          Set: { background: '#3B82F6', border: '#2563EB', highlight: { background: '#60A5FA', border: '#3B82F6' } },
          Grouping: { background: '#F59E0B', border: '#D97706', highlight: { background: '#FBBF24', border: '#F59E0B' } },
          List: { background: '#FFD700', border: '#D4AF37', highlight: { background: '#FFE55C', border: '#FFD700' } } // Gold for focal node
        };
      case 'metadata':
        return {
          List: { background: '#FFD700', border: '#D4AF37', highlight: { background: '#FFE55C', border: '#FFD700' } } // Gold for focal node
        };
      case 'listValues':
        return {
          List: { background: '#FFD700', border: '#D4AF37', highlight: { background: '#FFE55C', border: '#FFD700' } }, // Gold for focal node
          ListValue: { background: '#8B5CF6', border: '#7C3AED', highlight: { background: '#A78BFA', border: '#8B5CF6' } } // Purple for list values
        };
      case 'variations':
        return {
          List: { background: '#FFD700', border: '#D4AF37', highlight: { background: '#FFE55C', border: '#FFD700' } }, // Gold for focal node
          Variation: { background: '#32CD32', border: '#28A745', highlight: { background: '#6EE7B7', border: '#32CD32' } } // Green for variations
        };
      default:
        return {};
    }
  };

  // All edges in ontology modals are grey
  const getEdgeColor = (edge: any) => {
    return '#6B7280'; // Grey for all
  };

  const loadGraph = async () => {
    // Prevent concurrent loads
    if (isLoadingRef.current) {
      console.log('loadGraph: Already loading, skipping...');
      return;
    }
    
    console.log('loadGraph: Starting load', { isBulk, listName, listNames: listNames?.length, viewType });
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

      // Fetch ontology view data (bulk or single) - prefer IDs if available
      let graphData;
      if (isBulk) {
        graphData = await getBulkListOntologyView(listIds || null, listNames || null, viewType);
      } else {
        graphData = await getListOntologyView(listId || null, listName || null, viewType);
      }

      if (graphData.nodeCount === 0) {
        setError('No nodes found. This list may not have relationships in this view.');
        setIsLoading(false);
        isLoadingRef.current = false;
        return;
      }

      // For metadata, listValues, or variations view, auto-select the first list node and expand panel
      if ((viewType === 'metadata' || viewType === 'listValues' || viewType === 'variations') && graphData.nodes.length > 0) {
        const firstList = graphData.nodes.find((n: any) => n.group === 'List') || graphData.nodes[0];
        if (firstList) {
          setSelectedNode({
            ...firstList,
            label: firstList.label || firstList.properties?.name || firstList.properties?.list || 'List',
            group: firstList.group || 'List'
          });
          setShowDetailsPanel(true);
        }
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
        
        // Highlight selected nodes (lists) in bulk mode, or single in single mode
        let isSelected = false;
        if (isBulk) {
          isSelected = (listIds && listIds.some(id => node.properties?.id === id)) || 
                      (listNames && listNames.some(name => node.label === name || node.properties?.list === name));
        } else {
          isSelected = (listId && node.properties?.id === listId) ||
                      (listName && (node.label === listName || node.properties?.list === listName));
        }
        const nodeColor = isSelected && (viewType === 'drivers' || viewType === 'metadata' || viewType === 'listValues' || viewType === 'variations') 
          ? (viewType === 'metadata' || viewType === 'listValues' || viewType === 'variations'
              ? { background: '#FFD700', border: '#D4AF37', highlight: { background: '#FFE55C', border: '#FFD700' } }
              : { background: '#EF4444', border: '#DC2626', highlight: { background: '#F87171', border: '#EF4444' } })
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
        label: edge.label || edge.type || '',
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
              label: node.label || node.properties?.name || node.properties?.list || 'Unknown',
              group: node.group || 'Unknown'
            });
            setSelectedEdge(null);
            setShowDetailsPanel(true);
          }
        } else if (params.edges.length > 0) {
          const edgeId = params.edges[0];
          const edge = allEdgesData.current.find((e: any) => String(e.id) === String(edgeId));
          if (edge) {
            setSelectedEdge(edge);
            setSelectedNode(null);
            setShowDetailsPanel(true);
          }
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
      setShowDetailsPanel(viewType === 'metadata');
      setShowCypherQuery(false);
      setError(null);
    };
  }, [isOpen, listId, listName, listIds, listNames, viewType]);

  // Get Cypher query for current view
  const getCypherQuery = () => {
    if (isBulk) {
      if (listIds && listIds.length > 0) {
        const idsList = listIds.map(id => `'${id}'`).join(', ');
        if (viewType === 'listValues') {
          return `MATCH (l:List)-[r:HAS_LIST_VALUE]->(lv:ListValue)\nWHERE l.id IN [${idsList}]\nRETURN l, r, lv`;
        }
      } else if (listNames && listNames.length > 0) {
        const namesList = listNames.map(name => `'${name}'`).join(', ');
        if (viewType === 'listValues') {
          return `MATCH (l:List)-[r:HAS_LIST_VALUE]->(lv:ListValue)\nWHERE l.name IN [${namesList}]\nRETURN l, r, lv`;
        }
      }
    } else {
      if (listId) {
        if (viewType === 'listValues') {
          return `MATCH (l:List {id: '${listId}'})-[r:HAS_LIST_VALUE]->(lv:ListValue)\nRETURN l, r, lv`;
        }
      } else if (listName) {
        if (viewType === 'listValues') {
          return `MATCH (l:List {name: '${listName}'})-[r:HAS_LIST_VALUE]->(lv:ListValue)\nRETURN l, r, lv`;
        }
      }
    }
    return 'Cypher query will be displayed here';
  };

  const copyCypherToClipboard = () => {
    const query = getCypherQuery();
    navigator.clipboard.writeText(query).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const openNeo4jConsole = () => {
    const query = getCypherQuery();
    const encodedQuery = encodeURIComponent(query);
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
            <h2 className="text-xl font-semibold text-ag-dark-text">
              {viewType === 'listValues' ? 'List Values Graph' : `Ontology View - ${sectionName}`}
            </h2>
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
        <div className="flex-1 relative bg-ag-dark-bg">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-ag-dark-bg bg-opacity-75 z-10">
              <div className="text-ag-dark-text">Loading graph...</div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-ag-dark-bg bg-opacity-75 z-10">
              <div className="text-red-400">{error}</div>
            </div>
          )}

          <div 
            ref={containerRef}
            className="w-full h-full"
            style={{ minHeight: '400px' }}
          />

          {/* Zoom Controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            <button
              onClick={() => networkRef.current?.moveTo({ scale: (networkRef.current?.getScale() || 1) * 1.2 })}
              className="bg-ag-dark-surface border border-ag-dark-border rounded p-2 text-ag-dark-text hover:bg-ag-dark-bg transition-colors"
              title="Zoom In"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => networkRef.current?.moveTo({ scale: (networkRef.current?.getScale() || 1) * 0.8 })}
              className="bg-ag-dark-surface border border-ag-dark-border rounded p-2 text-ag-dark-text hover:bg-ag-dark-bg transition-colors"
              title="Zoom Out"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          {/* Eye Icon - Show details panel */}
          {(selectedNode || selectedEdge) && (
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setShowDetailsPanel(!showDetailsPanel)}
                className={`bg-ag-dark-surface border border-ag-dark-border rounded p-2 text-ag-dark-text hover:bg-ag-dark-bg transition-colors ${
                  showDetailsPanel ? 'bg-ag-dark-accent bg-opacity-20 border-ag-dark-accent' : ''
                }`}
                title={showDetailsPanel ? "Hide Details" : "Show Details"}
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Details Panel */}
        {showDetailsPanel && (selectedNode || selectedEdge) && (
          <div className="border-t border-ag-dark-border p-4 bg-ag-dark-surface max-h-64 overflow-y-auto">
            {selectedNode && (
              <div>
                <h3 className="text-sm font-semibold text-ag-dark-text mb-2">Node Properties</h3>
                <div className="space-y-1 text-sm">
                  <div><span className="text-ag-dark-text-secondary">Label:</span> <span className="text-ag-dark-text">{selectedNode.label}</span></div>
                  <div><span className="text-ag-dark-text-secondary">Type:</span> <span className="text-ag-dark-text">{selectedNode.group}</span></div>
                  {selectedNode.properties && Object.entries(selectedNode.properties).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-ag-dark-text-secondary">{key}:</span> <span className="text-ag-dark-text">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedEdge && (
              <div>
                <h3 className="text-sm font-semibold text-ag-dark-text mb-2">Edge Properties</h3>
                <div className="space-y-1 text-sm">
                  <div><span className="text-ag-dark-text-secondary">Type:</span> <span className="text-ag-dark-text">{selectedEdge.label || selectedEdge.type || 'Unknown'}</span></div>
                  {selectedEdge.properties && Object.entries(selectedEdge.properties).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-ag-dark-text-secondary">{key}:</span> <span className="text-ag-dark-text">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer with Cypher Query Section */}
        <div className="flex-shrink-0 border-t border-ag-dark-border bg-ag-dark-surface flex flex-col min-h-0" style={{ maxHeight: showCypherQuery ? '40vh' : 'auto' }}>
          {/* Action Buttons - Side by side */}
          <div className="px-6 py-3 flex gap-3 flex-shrink-0">
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
              onClick={openNeo4jConsole}
              className="inline-flex items-center gap-2 px-3 py-2 border border-ag-dark-accent text-ag-dark-accent rounded text-sm font-medium hover:bg-ag-dark-accent hover:text-white transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View in Neo4j Console
            </button>

            <div className="flex-1" /> {/* Spacer */}

            <button
              onClick={onClose}
              className="px-4 py-2 bg-ag-dark-accent text-white rounded hover:bg-ag-dark-accent-hover transition-colors"
            >
              Close
            </button>
          </div>

          {/* Cypher Query - Expandable below buttons with scrolling */}
          {showCypherQuery && (
            <div className="px-6 pb-4 border-t border-ag-dark-border bg-ag-dark-bg overflow-y-auto flex-1 min-h-0">
              <div className="flex items-center justify-between mb-2 pt-4">
                <label className="text-xs font-medium text-ag-dark-text-secondary uppercase">
                  Cypher Query
                </label>
                <button
                  onClick={() => {
                    const query = getCypherQuery();
                    copyCypherToClipboard();
                  }}
                  className={`text-xs transition-colors px-2 py-1 rounded ${
                    copySuccess ? 'text-ag-dark-success' : 'text-ag-dark-accent hover:text-ag-dark-accent-hover hover:bg-ag-dark-surface'
                  }`}
                >
                  {copySuccess ? 'Copied!' : 'Copy Query'}
                </button>
              </div>
              <pre className="text-xs text-ag-dark-text font-mono bg-ag-dark-surface p-3 rounded overflow-x-auto overflow-y-auto border border-ag-dark-border whitespace-pre-wrap break-words">
                {getCypherQuery()}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

