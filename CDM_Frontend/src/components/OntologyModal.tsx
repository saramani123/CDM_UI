import React, { useState, useEffect, useRef } from 'react';
import { X, Network, Eye, Copy, Plus, Minus } from 'lucide-react';
// @ts-ignore - vis-network doesn't have complete TypeScript definitions
import { Network as VisNetwork } from 'vis-network/standalone';
// @ts-ignore - vis-network types
import type { Data, Options, Node, Edge } from 'vis-network';
import { getOntologyView, getBulkOntologyView } from '../services/api';

interface OntologyModalProps {
  isOpen: boolean;
  onClose: () => void;
  objectName?: string; // Optional - for single object mode
  objectNames?: string[]; // Optional - for bulk mode
  sectionName: string;
  viewType: 'drivers' | 'ontology' | 'identifiers' | 'relationships' | 'variants';
  isBulkMode?: boolean; // New flag to indicate bulk mode
}

export const OntologyModal: React.FC<OntologyModalProps> = ({
  isOpen,
  onClose,
  objectName,
  objectNames,
  sectionName,
  viewType,
  isBulkMode = false
}) => {
  // Detect mode (single vs bulk)
  const isBulk = isBulkMode && objectNames && objectNames.length > 0;
  const displayObjects = isBulk ? objectNames! : [objectName!];
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
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
      console.log('loadGraph: Already loading, skipping...');
      return;
    }
    
    console.log('loadGraph: Starting load', { isBulk, objectName, objectNames: objectNames?.length, viewType });
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

      // Fetch ontology view data (bulk or single)
      let graphData;
      if (isBulk) {
        graphData = await getBulkOntologyView(displayObjects, viewType);
      } else {
        graphData = await getOntologyView(displayObjects[0], viewType);
      }

      if (graphData.nodeCount === 0) {
        setError('No nodes found. This object may not have relationships in this view.');
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
        
        // Highlight all selected objects in bulk mode, or single object in single mode
        const isSelectedObject = isBulk 
          ? displayObjects.includes(node.label) || displayObjects.some(obj => node.properties?.object === obj)
          : node.label === displayObjects[0] || node.properties?.object === displayObjects[0];
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
      // Group edges by from/to to identify parallel edges and alternate their properties
      const edgeGroups = new Map<string, number>();
      const getEdgeKey = (from: string, to: string) => `${from}->${to}`;
      
      // First pass: count parallel edges
      graphData.edges.forEach((edge: any) => {
        const from = String(edge.from);
        const to = String(edge.to);
        const key = getEdgeKey(from, to);
        edgeGroups.set(key, (edgeGroups.get(key) || 0) + 1);
      });
      
      // Debug: Log parallel edge groups for relationships view
      if (viewType === 'relationships') {
        console.log('Parallel edge groups:', Array.from(edgeGroups.entries()).filter(([_, count]) => count > 1));
      }
      
      // Second pass: create edges with alternating properties for parallel edges
      const edgeIndices = new Map<string, number>();
      const edges: Edge[] = graphData.edges.map((edge: any) => {
        const from = String(edge.from);
        const to = String(edge.to);
        const key = getEdgeKey(from, to);
        
        // Get index of this edge among parallel edges
        const parallelIndex = edgeIndices.get(key) || 0;
        edgeIndices.set(key, parallelIndex + 1);
        
        // Get total number of parallel edges for this pair
        const totalParallel = edgeGroups.get(key) || 1;
        
        // Calculate offset for spreading parallel edges
        // Center the edges around the middle, spreading them out
        const offsetIndex = parallelIndex - Math.floor((totalParallel - 1) / 2);
        
        // For parallel edges, alternate between curvedCW and curvedCCW with varying roundness
        // This creates clear separation similar to Neo4j
        // Default to straight edges (false) - only curve when there are multiple parallel edges
        let smoothConfig: any = false;
        const isSelfLoop = from === to;
        
        // CRITICAL DEBUG: Log what we're checking
        if (viewType === 'relationships') {
          console.log(`[DEBUG] Processing edge: from=${from}, to=${to}, totalParallel=${totalParallel}, isSelfLoop=${isSelfLoop}`);
        }
        
        if (totalParallel > 1) {
          // For non-self-loops between different nodes, use extremely aggressive separation
          if (!isSelfLoop) {
            // Special handling for relationships view: create outward-bowing curves like Neo4j
            if (viewType === 'relationships') {
              console.log(`[RELATIONSHIPS PARALLEL] Creating curved config for edge ${parallelIndex} of ${totalParallel}`);
              // For relationships view, make ALL parallel edges curve outward in a pronounced bow
              // This creates the Neo4j-like fan effect where edges bow outward from the straight line
              // Goal: each relationship label (role property) should be visually readable and not overlap
              
              // Use MAXIMUM roundness values to create the most pronounced outward bows possible
              // All parallel edges should bow significantly to create clear fan separation
              
              // Alternate curve direction based on parallel index to create clean fan
              // Even indices curve counter-clockwise, odd indices curve clockwise
              // This ensures edges alternate and fan out in both directions from center
              const isClockwise = parallelIndex % 2 === 1; // Odd indices = clockwise (curvedCW)
              const curveType = isClockwise ? 'curvedCW' : 'curvedCCW';
              
              // Use moderate roundness values for subtle but clearly visible outward bows
              // Strategy: Use a moderate range (0.25 to 0.45) for visible separation without being too dramatic
              // This creates Neo4j-like curved edges that are distinguishable but not overly curved
              
              // Calculate roundness using moderate values for subtle but visible bows
              // For 2 edges: 0.25 and 0.4 (subtle but clearly separated)
              // For 3 edges: 0.25, 0.325, 0.4
              // For 4+ edges: distribute across range up to 0.45 for maximum
              const minRoundness = 0.25; // Subtle base curvature
              const maxRoundness = 0.45; // Moderate maximum for visible separation without being too dramatic
              
              // Calculate how much to increment per edge
              const roundnessRange = maxRoundness - minRoundness;
              const numIncrements = Math.max(1, totalParallel - 1); // At least 1 increment
              const roundnessIncrement = roundnessRange / numIncrements;
              
              // Calculate roundness based on position in the parallel edges set
              // This ensures each edge gets a distinct roundness value for clear separation
              let finalRoundness: number;
              if (totalParallel === 2) {
                // For exactly 2 edges, use minimum and maximum for clear separation
                finalRoundness = parallelIndex === 0 ? minRoundness : maxRoundness;
              } else {
                // For 3+ edges, distribute across the range
                finalRoundness = minRoundness + (parallelIndex * roundnessIncrement);
                finalRoundness = Math.min(maxRoundness, finalRoundness);
              }
              
              // Ensure we're using values within the range
              finalRoundness = Math.max(minRoundness, Math.min(maxRoundness, finalRoundness));
              
              smoothConfig = {
                type: curveType,
                roundness: finalRoundness
              };
              
              // CRITICAL DEBUG: Log that we're creating curved config
              console.log(`[RELATIONSHIPS CURVED] Edge ${parallelIndex}/${totalParallel}: from=${from}, to=${to}, type=${curveType}, roundness=${finalRoundness.toFixed(3)}`);
            } else {
              // For other views, use the existing aggressive separation
              // For parallel edges between different nodes, create a strong fan effect
              // Strategy: Alternate curve direction AND use distinct roundness for each edge
              // This ensures each edge follows a different path, preventing overlap
              
              // Alternate curve direction based on edge index for consistent separation
              // Even indices = counter-clockwise (curvedCCW), odd indices = clockwise (curvedCW)
              // This creates a clear alternating pattern that fans out from center
              const isClockwise = parallelIndex % 2 === 1; // Odd indices = clockwise
              const curveType = isClockwise ? 'curvedCW' : 'curvedCCW';
              
              // Use extremely aggressive roundness values for maximum separation
              // Strategy: Use index-based roundness with very large gaps between edges
              // This ensures even 2 edges get strong separation
              const baseRoundness = 0.5; // Base roundness for first edge
              const roundnessStep = 0.4; // Very large step between each edge for clear separation
              
              // Calculate roundness directly from index to ensure each edge is distinct
              // Use index to create progressive roundness values
              const indexBasedRoundness = baseRoundness + parallelIndex * roundnessStep;
              
              // Also factor in offsetIndex to add variation based on position
              // This creates additional separation for edges at different positions
              const offsetVariation = Math.abs(offsetIndex) * 0.2; // Increased variation
              
              // Combine both for maximum uniqueness, ensuring minimum of 0.5 for visibility
              const rawRoundness = indexBasedRoundness + offsetVariation;
              const finalRoundness = Math.max(0.5, Math.min(1.0, rawRoundness));
              
              smoothConfig = {
                type: curveType,
                roundness: finalRoundness
              };
            }
          } else {
            // For self-loops, use aggressive separation similar to Neo4j
            // Alternate curve direction for visual separation
            const isClockwise = parallelIndex % 2 === 0;
            const curveType = isClockwise ? 'curvedCW' : 'curvedCCW';
            
            // Use more aggressive roundness for self-loops to create clear separation
            // The further from center, the more curved the loop
            const baseRoundness = 0.5; // Higher base for better initial separation
            const roundnessIncrement = 0.3; // Larger increments for clear visual separation
            const rawRoundness = baseRoundness + Math.abs(offsetIndex) * roundnessIncrement;
            // Add slight alternation factor for additional separation
            const edgeSeparationFactor = 1 + (parallelIndex % 2) * 0.15;
            const roundness = Math.min(1.0, rawRoundness * edgeSeparationFactor);
            
            smoothConfig = {
              type: curveType,
              roundness: roundness
            };
          }
        }
        
        // Build base edge object
        const baseEdge: Edge = {
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
          // Always set smooth property explicitly
          // For relationships view with parallel edges, smoothConfig will be { type, roundness }
          // For other cases, smoothConfig will be false for straight edges
          // Use smoothConfig if it's an object (curved), otherwise false (straight)
          smooth: smoothConfig !== false && typeof smoothConfig === 'object' ? smoothConfig : false,
          properties: edge.properties || {}
        };
        
        // CRITICAL DEBUG: Log ALL edge smooth configs for relationships view
        if (viewType === 'relationships') {
          console.log(`Edge ${baseEdge.id}: from=${from}, to=${to}, totalParallel=${totalParallel}, parallelIndex=${parallelIndex}, smooth=`, baseEdge.smooth, typeof baseEdge.smooth);
        }
        
        // For self-loops with multiple relationships, add aggressive self-reference size offset
        // This creates larger loops that are clearly separated, similar to Neo4j
        if (isSelfLoop && totalParallel > 1) {
          // Use much larger offsets to ensure clear separation between multiple self-loops
          // Each loop gets progressively larger, fanning out from the node
          const baseOffset = 30; // Larger base offset for immediate separation
          const offsetIncrement = 25; // Much larger increments for clear separation
          baseEdge.selfReferenceSize = baseOffset + Math.abs(offsetIndex) * offsetIncrement;
        } else if (isSelfLoop) {
          // Single self-loop still needs reasonable size
          baseEdge.selfReferenceSize = 25;
        }
        
        return baseEdge;
      });

      const data: Data = { nodes, edges };
      
      // Debug: Verify edges have smooth config for relationships view
      if (viewType === 'relationships') {
        const curvedEdges = edges.filter((e: Edge) => e.smooth && typeof e.smooth === 'object' && 'type' in e.smooth);
        console.log(`Relationships view: ${edges.length} total edges, ${curvedEdges.length} curved edges`);
        if (curvedEdges.length > 0) {
          console.log('Sample curved edge:', {
            id: curvedEdges[0].id,
            from: curvedEdges[0].from,
            to: curvedEdges[0].to,
            smooth: curvedEdges[0].smooth
          });
        }
      }

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
          // IMPORTANT: Don't set smooth: false globally - let individual edges control their smooth property
          // Individual edges will set smooth: false for straight edges or smooth: { type, roundness } for curved
          // For relationships view, parallel edges will have curved smooth config
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
            iterations: isBulk ? 300 : 200, // More iterations for bulk views to ensure stabilization
            updateInterval: 25, // Update every 25ms for smoother stabilization
            onlyDynamicEdges: false,
            fit: true // Fit the network to container after stabilization
          },
          // Help separate multiple edges between same nodes
          // Use even stronger forces to push nodes apart, which helps separate parallel edges
          barnesHut: {
            gravitationalConstant: isBulk ? -5000 : -8000, // Less aggressive for bulk to prevent continuous movement
            centralGravity: isBulk ? 0.1 : 0.05, // Slightly more central gravity for bulk to help stabilization
            springLength: isBulk ? 200 : 300, // Shorter springs for bulk views for faster stabilization
            springConstant: isBulk ? 0.08 : 0.15, // Less strong springs for bulk to prevent oscillation
            damping: isBulk ? 0.25 : 0.15, // Higher damping for bulk views to reduce movement
            avoidOverlap: 1.0 // Maximum overlap avoidance
          },
          solver: 'barnesHut', // Explicitly use barnesHut solver
          maxVelocity: isBulk ? 5 : 10, // Limit velocity for bulk views to prevent excessive movement
          timestep: isBulk ? 0.25 : 0.35 // Smaller timestep for more stable simulation
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
          isLoadingRef.current = false;
          return;
        }

        networkRef.current = new VisNetwork(containerRef.current, data, options);

        // Fallback: Disable physics after a timeout if stabilization doesn't complete
        // This prevents infinite movement in cases where stabilization fails
        const stabilizationTimeout = setTimeout(() => {
          console.log('loadGraph: Stabilization timeout, disabling physics');
          if (networkRef.current) {
            networkRef.current.setOptions({ physics: { enabled: false } });
            setIsLoading(false);
            isLoadingRef.current = false;
          }
        }, 10000); // 10 second timeout

        // Disable physics after stabilization to prevent continuous movement
        // This is critical for bulk views with many nodes
        networkRef.current.once('stabilizationEnd', () => {
          console.log('loadGraph: Stabilization complete, disabling physics');
          clearTimeout(stabilizationTimeout); // Clear timeout since stabilization completed
          if (networkRef.current) {
            networkRef.current.setOptions({ physics: { enabled: false } });
            setIsLoading(false);
            isLoadingRef.current = false;
          }
        });

        // Add click handlers for nodes and edges
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

        // Don't set loading false here - wait for stabilization
        // setIsLoading(false);
        // isLoadingRef.current = false;
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

  // Zoom control handlers
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

  // Utility functions for details panel
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
      console.log('OntologyModal: Modal closed, cleaning up');
      cleanupNetwork();
      setError(null);
      setIsLoading(false);
      setSelectedNode(null);
      setSelectedEdge(null);
      setShowDetailsPanel(false);
      isLoadingRef.current = false;
      return;
    }

    // Determine if we should load based on current mode
    const shouldLoad = isBulkMode && objectNames && objectNames.length > 0
      ? true
      : objectName ? true : false;

    if (isOpen && shouldLoad) {
      console.log('OntologyModal: Modal opened, preparing to load', { isBulkMode, objectName, objectNames: objectNames?.length, viewType });
      
      // Reset state when modal opens
      setError(null);
      setIsLoading(true);
      setSelectedNode(null);
      setSelectedEdge(null);
      setShowDetailsPanel(false);
      isLoadingRef.current = false; // Reset loading ref before starting new load
      
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        loadGraph();
      }, 50);

      return () => {
        console.log('OntologyModal: Effect cleanup - clearing timer');
        clearTimeout(timer);
        // Don't cleanup network here - let the close handler do it
      };
    }
  }, [isOpen, objectName, objectNames, viewType, isBulkMode]);

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
                {isBulk 
                  ? `Objects: ${displayObjects.length} selected | Instance: ${envInfo.instanceName}`
                  : `Object: ${displayObjects[0]} | Instance: ${envInfo.instanceName}`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Eye Icon - Show details panel */}
            {(selectedNode || selectedEdge) && (
              <button
                onClick={() => setShowDetailsPanel(true)}
                className="p-2 text-ag-dark-accent hover:text-ag-dark-accent-hover hover:bg-ag-dark-bg rounded transition-colors"
                title={selectedNode ? 'View node details' : 'View relationship details'}
              >
                <Eye className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-ag-dark-text-secondary hover:text-ag-dark-text transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-hidden relative">
          {/* Render container div - vis-network will manage its own children */}
          <div 
            ref={containerRef} 
            className="w-full h-full bg-ag-dark-bg border border-ag-dark-border rounded relative"
            style={{ minHeight: '500px' }}
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

          {/* Zoom Controls - Positioned in bottom-right corner */}
          {/* Adjust position when details panel is open to avoid overlap */}
          <div 
            className={`absolute bottom-10 flex flex-col gap-2 z-20 transition-all ${
              showDetailsPanel ? 'right-[22rem]' : 'right-10'
            }`}
          >
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

          {/* Details Side Panel */}
          {showDetailsPanel && (
            <div className="absolute top-6 right-6 bottom-6 w-80 bg-ag-dark-surface border border-ag-dark-border rounded shadow-xl z-30 flex flex-col">
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

