import React from 'react';
import { Node, Edge } from '@xyflow/react';
import { ArchitectureNodeData, FlowColor, NodeCategory, NodeStatus } from '../types';

interface PropertiesInspectorProps {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  onUpdateNode: (nodeId: string, updates: Partial<ArchitectureNodeData>) => void;
  onUpdateEdge: (edgeId: string, updates: Record<string, any>) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onClose: () => void;
}

const CATEGORIES: NodeCategory[] = [
  'Data Source',
  'Ingestion',
  'Storage',
  'Pipeline',
  'Feature Engineering',
  'Model',
  'Deployment',
  'API',
  'Application',
  'Actor',
  'Monitoring',
  'Service',
  'Security',
  'Custom',
];

const COLORS: FlowColor[] = ['blue', 'green', 'yellow', 'red', 'violet', 'cyan', 'orange', 'purple'];
const STATUSES: NodeStatus[] = ['idle', 'running', 'completed', 'failed'];

export const PropertiesInspector: React.FC<PropertiesInspectorProps> = ({
  selectedNode,
  selectedEdge,
  onUpdateNode,
  onUpdateEdge,
  onDeleteNode,
  onDeleteEdge,
  onClose,
}) => {
  if (!selectedNode && !selectedEdge) return null;

  return (
    <div
      style={{
        position: 'absolute',
        right: 20,
        top: 60,
        zIndex: 50,
        width: 270,
        background: '#13161a',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        color: '#f3f4f6',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
          ⚙️ {selectedNode ? 'Component Properties' : 'Connection Properties'}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: 16,
            padding: 2,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11.5 }}>
        {selectedNode && (
          <>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>Title</label>
              <input
                type="text"
                value={(selectedNode.data as ArchitectureNodeData)?.label || ''}
                onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })}
                style={{
                  width: '100%',
                  background: '#1e242d',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  color: '#fff',
                  padding: '5px 8px',
                  fontSize: 12,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>Subtitle / Subtext</label>
              <input
                type="text"
                value={(selectedNode.data as ArchitectureNodeData)?.subtitle || ''}
                onChange={(e) => onUpdateNode(selectedNode.id, { subtitle: e.target.value })}
                placeholder="e.g. Postgres DB / Kafka"
                style={{
                  width: '100%',
                  background: '#1e242d',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  color: '#fff',
                  padding: '5px 8px',
                  fontSize: 12,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>Category</label>
              <select
                value={(selectedNode.data as ArchitectureNodeData)?.category || 'Service'}
                onChange={(e) => onUpdateNode(selectedNode.id, { category: e.target.value as NodeCategory })}
                style={{
                  width: '100%',
                  background: '#1e242d',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  color: '#fff',
                  padding: '5px 8px',
                  fontSize: 12,
                  boxSizing: 'border-box',
                }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>Color Theme</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {COLORS.map((col) => {
                  const isCurrent = (selectedNode.data as ArchitectureNodeData)?.color === col;
                  return (
                    <button
                      key={col}
                      onClick={() => onUpdateNode(selectedNode.id, { color: col })}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        border: isCurrent ? '1.5px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                        background: isCurrent ? 'rgba(255,255,255,0.2)' : '#1e242d',
                        color: '#f8fafc',
                        cursor: 'pointer',
                        fontSize: 10,
                        textTransform: 'capitalize',
                      }}
                    >
                      {col}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>Runtime Status</label>
              <select
                value={(selectedNode.data as ArchitectureNodeData)?.status || 'idle'}
                onChange={(e) => onUpdateNode(selectedNode.id, { status: e.target.value as NodeStatus })}
                style={{
                  width: '100%',
                  background: '#1e242d',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  color: '#fff',
                  padding: '5px 8px',
                  fontSize: 12,
                  boxSizing: 'border-box',
                }}
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => onDeleteNode(selectedNode.id)}
                style={{
                  width: '100%',
                  padding: '6px',
                  borderRadius: 6,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 11,
                }}
              >
                🗑️ Delete Component
              </button>
            </div>
          </>
        )}

        {selectedEdge && (
          <>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>Relationship Label</label>
              <input
                type="text"
                value={(selectedEdge.data as any)?.label || ''}
                onChange={(e) => onUpdateEdge(selectedEdge.id, { label: e.target.value })}
                placeholder="e.g. gRPC Call / Kafka Event"
                style={{
                  width: '100%',
                  background: '#1e242d',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  color: '#fff',
                  padding: '5px 8px',
                  fontSize: 12,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>Edge Type</label>
              <select
                value={(selectedEdge.data as any)?.edgeType || 'dataflow'}
                onChange={(e) => onUpdateEdge(selectedEdge.id, { edgeType: e.target.value })}
                style={{
                  width: '100%',
                  background: '#1e242d',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  color: '#fff',
                  padding: '5px 8px',
                  fontSize: 12,
                  boxSizing: 'border-box',
                }}
              >
                <option value="dataflow">Data Flow (Orange / Dash)</option>
                <option value="api">API Call (Blue / Pulse)</option>
                <option value="stream">Stream / Ingest (Green)</option>
                <option value="monitoring">Telemetry / Monitoring (Cyan)</option>
                <option value="dependency">Dependency (Violet)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input
                type="checkbox"
                id="edge_anim"
                checked={(selectedEdge.data as any)?.animated ?? true}
                onChange={(e) => onUpdateEdge(selectedEdge.id, { animated: e.target.checked })}
              />
              <label htmlFor="edge_anim" style={{ color: '#cbd5e1', cursor: 'pointer' }}>
                Animated Data Movement
              </label>
            </div>

            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => onDeleteEdge(selectedEdge.id)}
                style={{
                  width: '100%',
                  padding: '6px',
                  borderRadius: 6,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 11,
                }}
              >
                🗑️ Delete Connection
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
