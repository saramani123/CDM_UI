import React, { useState, useEffect, useRef } from 'react';
import { X, Network, Eye, Copy, Plus, Minus, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
// @ts-ignore - vis-network doesn't have complete TypeScript definitions
import { Network as VisNetwork } from 'vis-network/standalone';
// @ts-ignore - vis-network types
import type { Data, Options, Node, Edge } from 'vis-network';
import { getOntologyView, getBulkOntologyView, getVariableOntologyView, getBulkVariableOntologyView } from '../services/api';

interface OntologyModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Object mode props
  objectId?: string; // Optional - for single object mode (preferred for distinct objects)
  objectName?: string; // Optional - for single object mode (fallback for backward compatibility)
  objectIds?: string[]; // Optional - for bulk mode (preferred for distinct objects)
  objectNames?: string[]; // Optional - for bulk mode (fallback for backward compatibility)
  // Variable mode props
  variableId?: string; // Optional - for single variable mode (preferred)
  variableName?: string; // Optional - for single variable mode (fallback)
  variableIds?: string[]; // Optional - for bulk variable mode (preferred)
  variableNames?: string[]; // Optional - for bulk variable mode (fallback)
  sectionName: string;
  viewType: 'drivers' | 'ontology' | 'identifiers' | 'relationships' | 'variants' | 'metadata' | 'objectRelationships';
  isBulkMode?: boolean; // New flag to indicate bulk mode
  mode?: 'object' | 'variable'; // New flag to indicate if this is for objects or variables
}

export const OntologyModal: React.FC<OntologyModalProps> = ({
  isOpen,
  onClose,
  objectId,
  objectName,
  objectIds,
  objectNames,
  variableId,
  variableName,
  variableIds,
  variableNames,
  sectionName,
  viewType,
  isBulkMode = false,
  mode = 'object' // Default to object mode for backward compatibility
}) => {
  // Detect if this is for variables or objects
  const isVariableMode = mode === 'variable' || variableId || variableName || variableIds?.length > 0 || variableNames?.length > 0;
  
  // Detect mode (single vs bulk) - prefer IDs if available
  const isBulk = isBulkMode && (
    isVariableMode 
      ? (variableIds?.length > 0 || variableNames?.length > 0)
      : (objectIds?.length > 0 || objectNames?.length > 0)
  );
  const hasObjectIds = isBulk ? (objectIds?.length > 0) : !!objectId;
  const hasVariableIds = isBulk ? (variableIds?.length > 0) : !!variableId;
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  // For metadata view, auto-expand properties panel
  const [showDetailsPanel, setShowDetailsPanel] = useState(isVariableMode && viewType === 'metadata');
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
    // Variable mode color configs
    if (isVariableMode) {
      switch (viewType) {
        case 'drivers':
          return {
            Sector: { background: '#10B981', border: '#059669', highlight: { background: '#34D399', border: '#10B981' } },
            Domain: { background: '#3B82F6', border: '#2563EB', highlight: { background: '#60A5FA', border: '#3B82F6' } },
            Country: { background: '#F59E0B', border: '#D97706', highlight: { background: '#FBBF24', border: '#F59E0B' } },
            VariableClarifier: { background: '#6B7280', border: '#4B5563', highlight: { background: '#9CA3AF', border: '#6B7280' } },
            Variable: { background: '#EF4444', border: '#DC2626', highlight: { background: '#F87171', border: '#EF4444' } } // Bold color for focus node
          };
        case 'ontology':
          return {
            Part: { background: '#6B7280', border: '#4B5563', highlight: { background: '#9CA3AF', border: '#6B7280' } },
            Group: { background: '#10B981', border: '#059669', highlight: { background: '#34D399', border: '#10B981' } },
            Variable: { background: '#FFD700', border: '#D4AF37', highlight: { background: '#FFE55C', border: '#FFD700' } } // Gold for focal node
          };
        case 'metadata':
          return {
            Variable: { background: '#FFD700', border: '#D4AF37', highlight: { background: '#FFE55C', border: '#FFD700' } } // Gold for focal node
          };
        case 'objectRelationships':
          return {
            Variable: { background: '#FFD700', border: '#D4AF37', highlight: { background: '#FFE55C', border: '#FFD700' } }, // Gold for focal node
            Object: { background: '#3B82F6', border: '#2563EB', highlight: { background: '#60A5FA', border: '#3B82F6' } },
            Group: { background: '#10B981', border: '#059669', highlight: { background: '#34D399', border: '#10B981' } },
            Part: { background: '#6B7280', border: '#4B5563', highlight: { background: '#9CA3AF', border: '#6B7280' } }
          };
        default:
          return {};
      }
    }
    
    // Object mode color configs (existing)
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
    
    console.log('loadGraph: Starting load', { isBulk, isVariableMode, objectName, objectNames: objectNames?.length, variableName, variableNames: variableNames?.length, viewType });
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

      // Fetch ontology view data (bulk or single) - prefer IDs if available
      let graphData;
      if (isVariableMode) {
        // Variable mode
        if (isBulk) {
          graphData = await getBulkVariableOntologyView(variableIds || null, variableNames || null, viewType as 'drivers' | 'ontology' | 'metadata' | 'objectRelationships');
        } else {
          graphData = await getVariableOntologyView(variableId || null, variableName || null, viewType as 'drivers' | 'ontology' | 'metadata' | 'objectRelationships');
        }
      } else {
        // Object mode (existing)
        if (isBulk) {
          graphData = await getBulkOntologyView(objectIds || null, objectNames || null, viewType as 'drivers' | 'ontology' | 'identifiers' | 'relationships' | 'variants');
        } else {
          graphData = await getOntologyView(objectId || null, objectName || null, viewType as 'drivers' | 'ontology' | 'identifiers' | 'relationships' | 'variants');
        }
      }

      if (graphData.nodeCount === 0) {
        setError(isVariableMode 
          ? 'No nodes found. This variable may not have relationships in this view.'
          : 'No nodes found. This object may not have relationships in this view.');
        setIsLoading(false);
        isLoadingRef.current = false;
        return;
      }

      // For metadata view, auto-select the first variable node and expand panel
      if (isVariableMode && viewType === 'metadata' && graphData.nodes.length > 0) {
        const firstVariable = graphData.nodes.find((n: any) => n.group === 'Variable') || graphData.nodes[0];
        if (firstVariable) {
          setSelectedNode({
            ...firstVariable,
            label: firstVariable.label || firstVariable.properties?.name || firstVariable.properties?.variable || 'Variable',
            group: firstVariable.group || 'Variable'
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
        
                        // Highlight selected nodes (objects or variables) in bulk mode, or single in single mode
        let isSelected = false;
        if (isVariableMode) {
          isSelected = isBulk 
            ? (variableIds && variableIds.some(id => node.properties?.id === id)) || 
              (variableNames && variableNames.some(name => node.label === name || node.properties?.variable === name || node.properties?.name === name))
            : (variableId && node.properties?.id === variableId) ||
              (variableName && (node.label === variableName || node.properties?.variable === variableName || node.properties?.name === variableName));
        } else {
          isSelected = isBulk 
            ? (objectIds && objectIds.some(id => node.properties?.id === id)) || 
              (objectNames && objectNames.some(name => node.label === name || node.properties?.object === name))
            : (objectId && node.properties?.id === objectId) ||
              (objectName && (node.label === objectName || node.properties?.object === objectName));
        }
        const nodeColor = isSelected && (viewType === 'drivers' || (isVariableMode && viewType === 'metadata')) 
          ? (isVariableMode && viewType === 'metadata' 
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
            iterations: 50, // Further reduced for much faster loading
            updateInterval: 100, // Increased to reduce computation overhead
            onlyDynamicEdges: false,
            fit: true // Fit the network to container after stabilization
          },
          // Optimized physics settings for fastest stabilization
          barnesHut: {
            gravitationalConstant: -1500, // Reduced for faster convergence
            centralGravity: 0.35, // Increased for faster stabilization
            springLength: 80, // Reduced for faster stabilization
            springConstant: 0.03, // Reduced for faster convergence
            damping: 0.1, // Optimized for fast stabilization
            avoidOverlap: 0.05 // Minimized to speed up calculation
          },
          solver: 'barnesHut',
          maxVelocity: 15, // Increased for faster movement
          timestep: 0.4 // Increased for faster simulation
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

        // For faster loading, disable physics immediately after short stabilization
        // Use a much shorter timeout for faster user experience
        const stabilizationTimeout = setTimeout(() => {
          console.log('loadGraph: Fast stabilization timeout, disabling physics');
          if (networkRef.current) {
            networkRef.current.setOptions({ physics: { enabled: false } });
            setIsLoading(false);
            isLoadingRef.current = false;
          }
        }, 2000); // 2 second timeout for faster loading

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

        // Force stop physics after initial render for even faster loading
        // This gives immediate visual feedback while physics finishes in background
        setTimeout(() => {
          if (networkRef.current && isLoadingRef.current) {
            // Check if graph is already reasonably laid out
            const scale = networkRef.current.getScale();
            if (scale > 0.1) { // If graph has some layout, disable physics immediately
              networkRef.current.setOptions({ physics: { enabled: false } });
              setIsLoading(false);
              isLoadingRef.current = false;
              clearTimeout(stabilizationTimeout);
            }
          }
        }, 500); // After 500ms, disable physics if graph looks reasonable

        // Add click handlers for nodes and edges
        networkRef.current.on('click', (params: any) => {
          if (params.nodes.length > 0) {
            // Node clicked - select but don't auto-open panel (unless metadata view)
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
              // For metadata view, auto-open panel when node is selected
              if (isVariableMode && viewType === 'metadata') {
                setShowDetailsPanel(true);
              }
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
            // Clicked on empty space - deselect and close panel (unless metadata view)
            setSelectedNode(null);
            setSelectedEdge(null);
            if (!(isVariableMode && viewType === 'metadata')) {
              setShowDetailsPanel(false);
            }
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

  // Generate Cypher query for the current view
  const getCypherQuery = (): string => {
    if (isVariableMode) {
      // Variable mode queries
      if (isBulk) {
        const useIds = variableIds?.length > 0;
        const paramValue = useIds ? '$variable_ids' : '$variable_names';
        const fieldName = useIds ? 'v.id' : 'v.name';
        
        switch (viewType) {
          case 'drivers':
            return `MATCH (v:Variable)
WHERE ${fieldName} IN ${paramValue}
WITH v
OPTIONAL MATCH (s:Sector)-[r1:IS_RELEVANT_TO]->(v)
WITH v, s, r1
OPTIONAL MATCH (d:Domain)-[r2:IS_RELEVANT_TO]->(v)
WITH v, s, r1, d, r2
OPTIONAL MATCH (c:Country)-[r3:IS_RELEVANT_TO]->(v)
WITH v, s, r1, d, r2, c, r3
OPTIONAL MATCH (vc:VariableClarifier)-[r4:IS_RELEVANT_TO]->(v)
RETURN s, r1, d, r2, c, r3, vc, r4, v`;
          case 'ontology':
            return `MATCH (v:Variable)
WHERE ${fieldName} IN ${paramValue}
OPTIONAL MATCH (p:Part)-[r1:HAS_GROUP]->(g:Group)-[r2:HAS_VARIABLE]->(v)
RETURN p, r1, g, r2, v`;
          case 'metadata':
            return `MATCH (v:Variable)
WHERE ${fieldName} IN ${paramValue}
RETURN v`;
          case 'objectRelationships':
            return `MATCH (v:Variable)
WHERE ${fieldName} IN ${paramValue}
WITH v
OPTIONAL MATCH (o:Object)-[r1:HAS_SPECIFIC_VARIABLE]->(v)
WITH v, o, r1
OPTIONAL MATCH (v)<-[r2:HAS_VARIABLE]-(g:Group)
WITH v, o, r1, g, r2
OPTIONAL MATCH (g)<-[r3:HAS_GROUP]-(p:Part)
RETURN v, o, r1, g, r2, p, r3`;
          default:
            return '';
        }
      } else {
        // Single variable mode
        const paramValue = variableId ? `{id: $variable_id}` : `{name: $variable_name}`;
        
        switch (viewType) {
          case 'drivers':
            return `MATCH (v:Variable ${paramValue})
WITH v
OPTIONAL MATCH (s:Sector)-[r1:IS_RELEVANT_TO]->(v)
WITH v, s, r1
OPTIONAL MATCH (d:Domain)-[r2:IS_RELEVANT_TO]->(v)
WITH v, s, r1, d, r2
OPTIONAL MATCH (c:Country)-[r3:IS_RELEVANT_TO]->(v)
WITH v, s, r1, d, r2, c, r3
OPTIONAL MATCH (vc:VariableClarifier)-[r4:IS_RELEVANT_TO]->(v)
RETURN s, r1, d, r2, c, r3, vc, r4, v`;
          case 'ontology':
            return `MATCH (p:Part)-[r1:HAS_GROUP]->(g:Group)-[r2:HAS_VARIABLE]->(v:Variable ${paramValue})
RETURN p, r1, g, r2, v`;
          case 'metadata':
            return `MATCH (v:Variable ${paramValue})
RETURN v`;
          case 'objectRelationships':
            return `MATCH (v:Variable ${paramValue})
WITH v
OPTIONAL MATCH (o:Object)-[r1:HAS_SPECIFIC_VARIABLE]->(v)
WITH v, o, r1
OPTIONAL MATCH (v)<-[r2:HAS_VARIABLE]-(g:Group)
WITH v, o, r1, g, r2
OPTIONAL MATCH (g)<-[r3:HAS_GROUP]-(p:Part)
RETURN v, o, r1, g, r2, p, r3`;
          default:
            return '';
        }
      }
    } else {
      // Object mode queries
      if (isBulk) {
        const useIds = objectIds?.length > 0;
        const paramValue = useIds ? '$object_ids' : '$object_names';
        const fieldName = useIds ? 'o.id' : 'o.object';
        
        switch (viewType) {
          case 'drivers':
            return `MATCH (o:Object)
WHERE ${fieldName} IN ${paramValue}
WITH o
OPTIONAL MATCH (s:Sector)-[r1:RELEVANT_TO]->(o)
WITH o, s, r1
OPTIONAL MATCH (d:Domain)-[r2:RELEVANT_TO]->(o)
WITH o, s, r1, d, r2
OPTIONAL MATCH (c:Country)-[r3:RELEVANT_TO]->(o)
WITH o, s, r1, d, r2, c, r3
OPTIONAL MATCH (oc:ObjectClarifier)-[r4:RELEVANT_TO]->(o)
RETURN s, r1, d, r2, c, r3, oc, r4, o`;
          case 'ontology':
            return `MATCH (o:Object)
WHERE ${fieldName} IN ${paramValue}
OPTIONAL MATCH (b:Being)-[r1:HAS_AVATAR]->(a:Avatar)-[r2:HAS_OBJECT]->(o)
RETURN b, r1, a, r2, o`;
          case 'identifiers':
            return `MATCH (o:Object)
WHERE ${fieldName} IN ${paramValue}
WITH o
OPTIONAL MATCH (o)-[r1:HAS_DISCRETE_ID]->(v1:Variable)
OPTIONAL MATCH (v1)<-[r4a:HAS_VARIABLE]-(g1:Group)
OPTIONAL MATCH (g1)<-[r5a:HAS_GROUP]-(p1:Part)
WITH o, v1, r1, g1, p1, r4a, r5a
OPTIONAL MATCH (o)-[r2:HAS_COMPOSITE_ID_1|HAS_COMPOSITE_ID_2|HAS_COMPOSITE_ID_3|HAS_COMPOSITE_ID_4|HAS_COMPOSITE_ID_5]->(v2:Variable)
OPTIONAL MATCH (v2)<-[r4b:HAS_VARIABLE]-(g2:Group)
OPTIONAL MATCH (g2)<-[r5b:HAS_GROUP]-(p2:Part)
WITH o, v1, r1, g1, p1, r4a, r5a, v2, r2, g2, p2, r4b, r5b
OPTIONAL MATCH (o)-[r3:HAS_UNIQUE_ID]->(v3:Variable)
OPTIONAL MATCH (v3)<-[r4c:HAS_VARIABLE]-(g3:Group)
OPTIONAL MATCH (g3)<-[r5c:HAS_GROUP]-(p3:Part)
RETURN o, v1, r1, g1, p1, r4a, r5a, v2, r2, g2, p2, r4b, r5b, v3, r3, g3, p3, r4c, r5c`;
          case 'relationships':
            return `MATCH (o:Object)
WHERE ${fieldName} IN ${paramValue}
OPTIONAL MATCH (o)-[r:RELATES_TO]->(o2:Object)
OPTIONAL MATCH (o3:Object)-[r2:RELATES_TO]->(o)
RETURN o, r, o2, r2, o3`;
          case 'variants':
            return `MATCH (o:Object)
WHERE ${fieldName} IN ${paramValue}
OPTIONAL MATCH (o)-[r:HAS_VARIANT]->(v:Variant)
RETURN o, r, v`;
          default:
            return '';
        }
      } else {
        // Single object mode
        const paramValue = objectId ? `{id: $object_id}` : `{object: $object_name}`;
        
        switch (viewType) {
          case 'drivers':
            return `MATCH (o:Object ${paramValue})
WITH o
OPTIONAL MATCH (s:Sector)-[r1:RELEVANT_TO]->(o)
WITH o, s, r1
OPTIONAL MATCH (d:Domain)-[r2:RELEVANT_TO]->(o)
WITH o, s, r1, d, r2
OPTIONAL MATCH (c:Country)-[r3:RELEVANT_TO]->(o)
WITH o, s, r1, d, r2, c, r3
OPTIONAL MATCH (oc:ObjectClarifier)-[r4:RELEVANT_TO]->(o)
RETURN s, r1, d, r2, c, r3, oc, r4, o`;
          case 'ontology':
            return `MATCH (b:Being)-[r1:HAS_AVATAR]->(a:Avatar)-[r2:HAS_OBJECT]->(o:Object ${paramValue})
RETURN b, r1, a, r2, o`;
          case 'identifiers':
            return `MATCH (o:Object ${paramValue})
WITH o
OPTIONAL MATCH (o)-[r1:HAS_DISCRETE_ID]->(v1:Variable)
OPTIONAL MATCH (v1)<-[r4a:HAS_VARIABLE]-(g1:Group)
OPTIONAL MATCH (g1)<-[r5a:HAS_GROUP]-(p1:Part)
WITH o, v1, r1, g1, p1, r4a, r5a
OPTIONAL MATCH (o)-[r2:HAS_COMPOSITE_ID_1|HAS_COMPOSITE_ID_2|HAS_COMPOSITE_ID_3|HAS_COMPOSITE_ID_4|HAS_COMPOSITE_ID_5]->(v2:Variable)
OPTIONAL MATCH (v2)<-[r4b:HAS_VARIABLE]-(g2:Group)
OPTIONAL MATCH (g2)<-[r5b:HAS_GROUP]-(p2:Part)
WITH o, v1, r1, g1, p1, r4a, r5a, v2, r2, g2, p2, r4b, r5b
OPTIONAL MATCH (o)-[r3:HAS_UNIQUE_ID]->(v3:Variable)
OPTIONAL MATCH (v3)<-[r4c:HAS_VARIABLE]-(g3:Group)
OPTIONAL MATCH (g3)<-[r5c:HAS_GROUP]-(p3:Part)
RETURN o, v1, r1, g1, p1, r4a, r5a, v2, r2, g2, p2, r4b, r5b, v3, r3, g3, p3, r4c, r5c`;
          case 'relationships':
            return `MATCH (o:Object ${paramValue})-[r:RELATES_TO]->(o2:Object)
RETURN o, r, o2`;
          case 'variants':
            return `MATCH (o:Object ${paramValue})-[r:HAS_VARIANT]->(v:Variant)
RETURN o, r, v`;
          default:
            return '';
        }
      }
    }
  };

  // Copy query to clipboard
  const copyQueryToClipboard = (query: string) => {
    navigator.clipboard.writeText(query).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(err => {
      console.error('Failed to copy query:', err);
    });
  };

  // Handle opening in Neo4j Console
  const handleOpenInNeo4jConsole = () => {
    const query = getCypherQuery();
    const encodedQuery = encodeURIComponent(query);
    const neo4jUrl = import.meta.env.VITE_NEO4J_CONSOLE_URL || 'https://console.neo4j.io/';
    window.open(`${neo4jUrl}?query=${encodedQuery}`, '_blank');
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

    // Determine if we should load based on current mode - check IDs first, then names
    const shouldLoad = isVariableMode
      ? (isBulkMode 
          ? (variableIds && variableIds.length > 0) || (variableNames && variableNames.length > 0)
          : (variableId || variableName))
      : (isBulkMode 
          ? (objectIds && objectIds.length > 0) || (objectNames && objectNames.length > 0)
          : (objectId || objectName));

    if (isOpen && shouldLoad) {
      console.log('OntologyModal: Modal opened, preparing to load', { isBulkMode, isVariableMode, objectId, objectName, objectIds: objectIds?.length, objectNames: objectNames?.length, variableId, variableName, variableIds: variableIds?.length, variableNames: variableNames?.length, viewType });
      
      // Reset state when modal opens
      setError(null);
      setIsLoading(true);
      setSelectedNode(null);
      setSelectedEdge(null);
      // For metadata view, auto-expand properties panel
      setShowDetailsPanel(isVariableMode && viewType === 'metadata');
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
  }, [isOpen, objectId, objectName, objectIds, objectNames, variableId, variableName, variableIds, variableNames, viewType, isBulkMode, isVariableMode]);

  // Separate effect for cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupNetwork();
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
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
                {isVariableMode 
                  ? (isBulk 
                      ? `Variables: ${(variableIds?.length || variableNames?.length || 0)} selected | Instance: ${envInfo.instanceName}`
                      : `Variable: ${variableName || 'Unknown'} | Instance: ${envInfo.instanceName}`)
                  : (isBulk 
                      ? `Objects: ${(objectIds?.length || objectNames?.length || 0)} selected | Instance: ${envInfo.instanceName}`
                      : `Object: ${objectName || 'Unknown'} | Instance: ${envInfo.instanceName}`)
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
              <div className="flex flex-col items-center gap-4">
                {/* Cute loading animation */}
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 border-4 border-ag-dark-border rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-transparent border-t-ag-dark-accent rounded-full animate-spin"></div>
                  <div className="absolute inset-2 border-4 border-transparent border-b-ag-dark-accent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
                  <div className="absolute inset-4 border-4 border-transparent border-r-ag-dark-accent rounded-full animate-spin" style={{ animationDuration: '0.6s' }}></div>
                </div>
                <div className="text-ag-dark-text-secondary text-sm animate-pulse">Loading ontology view...</div>
              </div>
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
              onClick={handleOpenInNeo4jConsole}
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
                  onClick={() => copyQueryToClipboard(getCypherQuery())}
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

