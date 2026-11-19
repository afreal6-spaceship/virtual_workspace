import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ArchitectureNode } from './nodes/ArchitectureNode';
import { GroupNode } from './nodes/GroupNode';
import { ActorNode } from './nodes/ActorNode';
import { CustomEdge } from './edges/CustomEdge';
import { NodePalette } from './components/NodePalette';
import { PropertiesInspector } from './components/PropertiesInspector';
import { SimulationControls } from './components/SimulationControls';
import { ValidationModal, validateArchitecture } from './components/ValidationModal';
import { BLUEPRINTS } from './templates/blueprints';
import { ArchitectureNodeData, BoardDiskFormat, CustomEdgeData, SimulationState } from './types';

interface ArchitectureDesignerProps {
  projectId: string;
  boardId: string;
  onStatusChange?: (status: string) => void;
}

const nodeTypes = {
  architecture: ArchitectureNode,
  group: GroupNode,
  actor: ActorNode,
};

const edgeTypes = {
  customEdge: CustomEdge,
};

export const ArchitectureDesigner: React.FC<ArchitectureDesignerProps> = ({
  projectId,
  boardId,
  onStatusChange,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [lastMtime, setLastMtime] = useState<number>(0);
  const isSavingRef = useRef(false);

  // Simulation State
  const [simulation, setSimulation] = useState<SimulationState>({
    isActive: false,
    status: 'idle',
    currentStep: 0,
    totalSteps: 6,
    speed: 1200,
    activeNodeIds: [],
    activeEdgeIds: [],
    processedCount: 0,
  });

  const simTimerRef = useRef<number | null>(null);

  // Convert board.json disk format to React Flow nodes & edges
  const loadBoardDiskData = useCallback((data: BoardDiskFormat) => {
    const nextNodes: Node[] = [];
    const nextEdges: Edge[] = [];

    // 1. Add Groups first (so they render behind child nodes)
    if (data.groups && Array.isArray(data.groups)) {
      data.groups.forEach((g) => {
        nextNodes.push({
          id: g.id,
          type: 'group',
          position: { x: g.x, y: g.y },
          style: { width: g.w, height: g.h },
          data: {
            label: g.title,
            category: g.category,
            color: g.color || 'blue',
            width: g.w,
            height: g.h,
          },
          draggable: true,
          selectable: true,
        });
      });
    }

    // 2. Add Architecture Nodes
    if (data.nodes && Array.isArray(data.nodes)) {
      data.nodes.forEach((n) => {
        const isActor = n.category === 'Actor' || n.icon === 'user';
        nextNodes.push({
          id: n.id,
          type: isActor ? 'actor' : 'architecture',
          position: { x: n.x, y: n.y },
          data: {
            label: n.label,
            subtitle: n.subtitle,
            category: n.category || 'Service',
            icon: n.icon || (isActor ? 'user' : 'app'),
            color: n.color || 'blue',
            status: n.status || 'idle',
            details: n.details,
          },
          draggable: true,
          selectable: true,
        });
      });
    }

    // 3. Add Edges
    if (data.arrows && Array.isArray(data.arrows)) {
      data.arrows.forEach((a, idx) => {
        const edgeId = a.id || `e_${a.from}_${a.to}_${idx}`;
        const color = a.color || (a.type === 'monitoring' ? '#06b6d4' : a.type === 'stream' ? '#22c55e' : '#f97316');
        nextEdges.push({
          id: edgeId,
          source: a.from,
          target: a.to,
          type: 'customEdge',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color,
            width: 16,
            height: 16,
          },
          data: {
            label: a.label,
            edgeType: a.type || 'dataflow',
            animated: a.animated ?? true,
            color,
            dashed: true,
          },
        });
      });
    }

    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [setNodes, setEdges]);

  // Convert React Flow canvas back to board.json format for disk persistence
  const serializeToDiskFormat = useCallback((): BoardDiskFormat => {
    const diskNodes: BoardDiskFormat['nodes'] = [];
    const diskGroups: BoardDiskFormat['groups'] = [];
    const diskArrows: BoardDiskFormat['arrows'] = [];

    nodes.forEach((n) => {
      if (n.type === 'group') {
        diskGroups.push({
          id: n.id,
          title: (n.data as any)?.label || 'Section',
          x: Math.round(n.position.x),
          y: Math.round(n.position.y),
          w: Math.round(n.style?.width ? Number(n.style.width) : 300),
          h: Math.round(n.style?.height ? Number(n.style.height) : 200),
          color: (n.data as any)?.color || 'blue',
          category: (n.data as any)?.category,
        });
      } else {
        const d = n.data as ArchitectureNodeData;
        diskNodes.push({
          id: n.id,
          label: d.label || 'Node',
          subtitle: d.subtitle,
          x: Math.round(n.position.x),
          y: Math.round(n.position.y),
          color: d.color || 'blue',
          category: d.category,
          icon: d.icon,
          status: d.status,
          details: d.details,
        });
      }
    });

    edges.forEach((e) => {
      const d = (e.data || {}) as CustomEdgeData;
      diskArrows.push({
        id: e.id,
        from: e.source,
        to: e.target,
        label: d.label,
        type: d.edgeType || 'dataflow',
        animated: d.animated ?? true,
        color: d.color,
      });
    });

    return {
      boardId,
      nodes: diskNodes,
      arrows: diskArrows,
      groups: diskGroups,
    };
  }, [boardId, nodes, edges]);

  // Save to backend board.json API
  const saveToDisk = useCallback(async () => {
    if (isSavingRef.current || nodes.length === 0) return;
    try {
      isSavingRef.current = true;
      const payload = serializeToDiskFormat();
      const res = await fetch(`/api/projects/${projectId}/board`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: payload }),
      });
      if (res.ok) {
        const resData = await res.json();
        setLastMtime(resData.mtime || Date.now());
      }
    } catch (err) {
      console.warn('Failed to save architecture to disk:', err);
    } finally {
      isSavingRef.current = false;
    }
  }, [projectId, nodes.length, serializeToDiskFormat]);

  // Load initial board or MLOps blueprint if empty
  useEffect(() => {
    let isMounted = true;
    fetch(`/api/projects/${projectId}/board`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data?.exists && data?.board && (data.board.nodes?.length > 0 || data.board.groups?.length > 0)) {
          setLastMtime(data.mtime || Date.now());
          loadBoardDiskData(data.board);
          onStatusChange?.('Loaded architecture from project files (board.json).');
        } else {
          // Seed with MLOps architecture blueprint matching user Reference Image 1
          loadBoardDiskData(BLUEPRINTS.mlops);
          onStatusChange?.('Applied Enterprise MLOps Architecture template.');
        }
      })
      .catch(() => {
        if (isMounted) {
          loadBoardDiskData(BLUEPRINTS.mlops);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [projectId, loadBoardDiskData, onStatusChange]);

  // Poll disk for updates from terminal / codex / opencode / board_tool.py
  useEffect(() => {
    const timer = setInterval(async () => {
      if (isSavingRef.current || simulation.isActive) return;
      try {
        const res = await fetch(`/api/projects/${projectId}/board`);
        if (res.ok) {
          const data = await res.json();
          if (data.exists && data.mtime && data.mtime > lastMtime) {
            setLastMtime(data.mtime);
            loadBoardDiskData(data.board);
            onStatusChange?.('Architecture updated from terminal / project files.');
          }
        }
      } catch {
        // ignore
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [projectId, lastMtime, loadBoardDiskData, onStatusChange, simulation.isActive]);

  // Debounced auto-save when user moves nodes or alters graph
  useEffect(() => {
    if (simulation.isActive) return;
    const timer = setTimeout(() => {
      void saveToDisk();
    }, 1200);
    return () => clearTimeout(timer);
  }, [nodes, edges, saveToDisk, simulation.isActive]);

  // New edge connection handler
  const onConnect = useCallback(
    (params: Connection) => {
      const color = '#f97316';
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'customEdge',
            markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
            data: {
              label: 'Data Flow',
              edgeType: 'dataflow',
              animated: true,
              color,
              dashed: true,
            },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // Selection handlers
  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  // Inspector updates
  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Partial<ArchitectureNodeData>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                ...updates,
              },
            };
          }
          return n;
        })
      );
      if (selectedNode?.id === nodeId) {
        setSelectedNode((prev) => (prev ? { ...prev, data: { ...prev.data, ...updates } } : null));
      }
    },
    [setNodes, selectedNode]
  );

  const handleUpdateEdge = useCallback(
    (edgeId: string, updates: Record<string, any>) => {
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id === edgeId) {
            const newColor = updates.edgeType === 'monitoring' ? '#06b6d4' : updates.edgeType === 'api' ? '#38bdf8' : updates.edgeType === 'stream' ? '#22c55e' : '#f97316';
            return {
              ...e,
              markerEnd: { type: MarkerType.ArrowClosed, color: newColor, width: 16, height: 16 },
              data: {
                ...e.data,
                ...updates,
                color: updates.color || newColor,
              },
            };
          }
          return e;
        })
      );
      if (selectedEdge?.id === edgeId) {
        setSelectedEdge((prev) => (prev ? { ...prev, data: { ...prev.data, ...updates } } : null));
      }
    },
    [setEdges, selectedEdge]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode(null);
    },
    [setNodes, setEdges]
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setSelectedEdge(null);
    },
    [setEdges]
  );

  // Palette add node
  const handleAddPaletteItem = useCallback(
    (item: any) => {
      const id = `${item.category.toLowerCase().replace(/\s+/g, '_')}_${Date.now().toString().slice(-4)}`;
      if (item.type === 'group') {
        const newGroup: Node = {
          id: `grp_${Date.now().toString().slice(-4)}`,
          type: 'group',
          position: { x: 100, y: 100 },
          style: { width: 360, height: 200 },
          data: {
            label: 'New Section',
            category: 'Group',
            color: 'blue',
          },
        };
        setNodes((nds) => [newGroup, ...nds]);
      } else {
        const newNode: Node = {
          id,
          type: item.type === 'actor' ? 'actor' : 'architecture',
          position: { x: 200 + Math.random() * 80, y: 150 + Math.random() * 80 },
          data: {
            label: item.label,
            subtitle: item.subtitle,
            category: item.category,
            icon: item.icon,
            color: item.color,
            status: 'idle',
          },
        };
        setNodes((nds) => [...nds, newNode]);
      }
      setIsPaletteOpen(false);
    },
    [setNodes]
  );

  // Auto-arrange layout
  const handleAutoArrange = useCallback(() => {
    setNodes((nds) => {
      const standardNodes = nds.filter((n) => n.type !== 'group');
      const groupNodes = nds.filter((n) => n.type === 'group');

      const arranged = standardNodes.map((node, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        return {
          ...node,
          position: {
            x: 80 + col * 260,
            y: 100 + row * 160,
          },
        };
      });

      return [...groupNodes, ...arranged];
    });
    onStatusChange?.('Auto-arranged architecture layout.');
  }, [setNodes, onStatusChange]);

  // Simulation Engine: Runs animated step-by-step dataflow through the pipeline
  const runSimulationStep = useCallback(() => {
    setSimulation((prev) => {
      if (!prev.isActive || prev.status !== 'running') return prev;

      const nextStep = prev.currentStep + 1;
      if (nextStep > prev.totalSteps) {
        // Complete simulation
        setNodes((nds) =>
          nds.map((n) => (n.type !== 'group' ? { ...n, data: { ...n.data, status: 'completed' } } : n))
        );
        return {
          ...prev,
          status: 'completed',
          isActive: false,
          processedCount: prev.processedCount + 5000,
        };
      }

      // Progress node statuses according to step
      setNodes((nds) => {
        return nds.map((n, idx) => {
          if (n.type === 'group') return n;
          const assignedStep = (idx % prev.totalSteps) + 1;
          let nodeStatus: 'idle' | 'running' | 'completed' = 'idle';

          if (assignedStep < nextStep) nodeStatus = 'completed';
          else if (assignedStep === nextStep) nodeStatus = 'running';

          return {
            ...n,
            data: {
              ...n.data,
              status: nodeStatus,
              metrics:
                nodeStatus === 'running'
                  ? { latency: `${Math.floor(8 + Math.random() * 15)}ms`, qps: `${Math.floor(1200 + Math.random() * 800)}/s` }
                  : (n.data as any).metrics,
            },
          };
        });
      });

      return {
        ...prev,
        currentStep: nextStep,
        processedCount: prev.processedCount + Math.floor(1200 + Math.random() * 600),
      };
    });
  }, [setNodes]);

  useEffect(() => {
    if (simulation.isActive && simulation.status === 'running') {
      simTimerRef.current = window.setTimeout(runSimulationStep, simulation.speed);
    }
    return () => {
      if (simTimerRef.current) clearTimeout(simTimerRef.current);
    };
  }, [simulation.isActive, simulation.status, simulation.currentStep, simulation.speed, runSimulationStep]);

  const handlePlaySimulation = useCallback(() => {
    setSimulation((prev) => ({
      ...prev,
      isActive: true,
      status: 'running',
      currentStep: prev.status === 'completed' ? 0 : prev.currentStep,
    }));
  }, []);

  const handlePauseSimulation = useCallback(() => {
    setSimulation((prev) => ({
      ...prev,
      status: 'paused',
    }));
  }, []);

  const handleResetSimulation = useCallback(() => {
    setSimulation({
      isActive: false,
      status: 'idle',
      currentStep: 0,
      totalSteps: 6,
      speed: 1200,
      activeNodeIds: [],
      activeEdgeIds: [],
      processedCount: 0,
    });
    setNodes((nds) => nds.map((n) => (n.type !== 'group' ? { ...n, data: { ...n.data, status: 'idle' } } : n)));
  }, [setNodes]);

  // Load predefined blueprint
  const handleSelectBlueprint = useCallback(
    (key: string) => {
      if (BLUEPRINTS[key]) {
        loadBoardDiskData(BLUEPRINTS[key]);
        onStatusChange?.(`Loaded ${BLUEPRINTS[key].title}`);
      }
    },
    [loadBoardDiskData, onStatusChange]
  );

  // Export JSON file
  const handleExportJson = useCallback(() => {
    const data = serializeToDiskFormat();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `architecture-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [serializeToDiskFormat]);

  const healthScore = useMemo(() => {
    return validateArchitecture(nodes, edges).score;
  }, [nodes, edges]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#0d1117',
        color: '#f8fafc',
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        minZoom={0.2}
        maxZoom={2.5}
      >
        <Background color="#334155" gap={24} size={1.2} />
        <Controls
          style={{
            background: '#13161a',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        />
        <MiniMap
          nodeColor={(n) => (n.type === 'group' ? '#1e293b' : '#38bdf8')}
          maskColor="rgba(0,0,0,0.6)"
          style={{
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
          }}
        />

        {/* Top-Left Action Bar */}
        <Panel position="top-left" style={{ margin: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(19, 22, 26, 0.85)',
              backdropFilter: 'blur(8px)',
              padding: '6px 12px',
              borderRadius: 10,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}
          >
            {/* Blueprints selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Architecture:</span>
              <select
                onChange={(e) => handleSelectBlueprint(e.target.value)}
                defaultValue="mlops"
                style={{
                  background: '#1a1f26',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#f8fafc',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <option value="mlops">🤖 MLOps Pipeline (Full Architecture)</option>
                <option value="hrms">👥 HRMS Lifecycle & Payroll</option>
                <option value="microservices">🛒 Microservices Cloud Backend</option>
              </select>
            </div>

            <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)' }} />

            {/* Add component button */}
            <button
              onClick={() => setIsPaletteOpen((prev) => !prev)}
              style={{
                background: isPaletteOpen ? '#0284c7' : 'rgba(255,255,255,0.08)',
                color: '#f8fafc',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>+</span> Add Component
            </button>

            {/* Auto Arrange */}
            <button
              onClick={handleAutoArrange}
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: '#cbd5e1',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 11,
                cursor: 'pointer',
              }}
              title="Auto-organize node layout"
            >
              ⚡ Auto Layout
            </button>

            {/* Health Score Pill */}
            <button
              onClick={() => setIsValidating(true)}
              style={{
                background: healthScore >= 90 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                color: healthScore >= 90 ? '#86efac' : '#fde047',
                border: `1px solid ${healthScore >= 90 ? '#22c55e44' : '#eab30844'}`,
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🛡️ Health {healthScore}%
            </button>
          </div>
        </Panel>

        {/* Top-Right Simulation & Export Bar */}
        <Panel position="top-right" style={{ margin: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SimulationControls
              simulation={simulation}
              onPlay={handlePlaySimulation}
              onPause={handlePauseSimulation}
              onReset={handleResetSimulation}
              onSpeedChange={(speed) => setSimulation((prev) => ({ ...prev, speed }))}
            />

            <button
              onClick={handleExportJson}
              style={{
                background: 'rgba(19, 22, 26, 0.85)',
                color: '#cbd5e1',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
              }}
              title="Export Architecture JSON"
            >
              📥 Export JSON
            </button>
          </div>
        </Panel>
      </ReactFlow>

      {/* Floating Node Palette */}
      <NodePalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onAddNode={handleAddPaletteItem}
      />

      {/* Properties Inspector */}
      <PropertiesInspector
        selectedNode={selectedNode}
        selectedEdge={selectedEdge}
        onUpdateNode={handleUpdateNode}
        onUpdateEdge={handleUpdateEdge}
        onDeleteNode={handleDeleteNode}
        onDeleteEdge={handleDeleteEdge}
        onClose={() => {
          setSelectedNode(null);
          setSelectedEdge(null);
        }}
      />

      {/* Topology Validation Modal */}
      <ValidationModal
        isOpen={isValidating}
        nodes={nodes}
        edges={edges}
        onClose={() => setIsValidating(false)}
      />
    </div>
  );
};
