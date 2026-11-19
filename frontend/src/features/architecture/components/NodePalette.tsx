import React from 'react';
import { NodeCategory, FlowColor } from '../types';
import { renderNodeIcon } from '../nodes/icons';

interface PaletteItem {
  type: 'node' | 'group' | 'actor';
  label: string;
  category: NodeCategory;
  icon: string;
  color: FlowColor;
  subtitle: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  { type: 'node', label: 'Database', category: 'Storage', icon: 'database', color: 'violet', subtitle: 'SQL / NoSQL' },
  { type: 'node', label: 'Data Lake', category: 'Storage', icon: 'datalake', color: 'cyan', subtitle: 'Object Storage' },
  { type: 'node', label: 'Ingestion Stream', category: 'Ingestion', icon: 'pipeline', color: 'green', subtitle: 'Kafka / PubSub' },
  { type: 'node', label: 'Pipeline Step', category: 'Pipeline', icon: 'standardise', color: 'cyan', subtitle: 'ETL / Transform' },
  { type: 'node', label: 'Feature Store', category: 'Feature Engineering', icon: 'features', color: 'yellow', subtitle: 'Features & Vectors' },
  { type: 'node', label: 'ML Model', category: 'Model', icon: 'brain', color: 'red', subtitle: 'Train & Inference' },
  { type: 'node', label: 'Model Deploy', category: 'Deployment', icon: 'rocket', color: 'cyan', subtitle: 'Canary / K8s' },
  { type: 'node', label: 'Microservice', category: 'Service', icon: 'container', color: 'blue', subtitle: 'Container / Pod' },
  { type: 'node', label: 'API Endpoint', category: 'API', icon: 'api', color: 'orange', subtitle: 'REST / gRPC' },
  { type: 'node', label: 'Application UI', category: 'Application', icon: 'app', color: 'blue', subtitle: 'Web & Mobile' },
  { type: 'actor', label: 'User Actor', category: 'Actor', icon: 'user', color: 'blue', subtitle: 'End User / Client' },
  { type: 'node', label: 'Monitor & Alerts', category: 'Monitoring', icon: 'monitor', color: 'cyan', subtitle: 'Metrics & Drift' },
  { type: 'group', label: 'Container Group', category: 'Custom', icon: 'box', color: 'blue', subtitle: 'Section Box' },
];

interface NodePaletteProps {
  onAddNode: (item: PaletteItem) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const NodePalette: React.FC<NodePaletteProps> = ({ onAddNode, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 20,
        top: 60,
        zIndex: 50,
        width: 250,
        maxHeight: 'calc(100% - 100px)',
        background: '#13161a',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#f3f4f6',
      }}
    >
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
        <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.02em' }}>
          📦 Architecture Palette
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: 2,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: '8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {PALETTE_ITEMS.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              onAddNode(item);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 8,
              background: '#1a1f26',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              color: '#f8fafc',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#242b35';
              e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#1a1f26';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: 'rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {renderNodeIcon(item.icon, 15, '#38bdf8')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontSize: 9.5, color: '#94a3b8' }}>{item.subtitle}</div>
            </div>
            <span style={{ fontSize: 13, color: '#64748b' }}>+</span>
          </button>
        ))}
      </div>
    </div>
  );
};
