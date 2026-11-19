import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { ArchitectureNodeData } from '../types';

export const ActorNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as ArchitectureNodeData;
  const status = nodeData.status || 'idle';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 18px',
        borderRadius: 16,
        background: '#181b20',
        border: `2px solid ${selected ? '#38bdf8' : '#0284c7'}`,
        boxShadow: selected ? '0 0 16px rgba(56, 189, 248, 0.4)' : '0 4px 12px rgba(0,0,0,0.3)',
        color: '#f3f4f6',
        minWidth: 120,
        position: 'relative',
        cursor: 'grab',
      }}
    >
      <Handle type="target" position={Position.Top} id="top" style={{ background: '#38bdf8' }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: '#38bdf8' }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: '#38bdf8' }} />
      <Handle type="target" position={Position.Left} id="left" style={{ background: '#38bdf8' }} />

      {/* Avatar Container */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 6,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f9ff' }}>
        {nodeData.label || 'User'}
      </div>

      {nodeData.subtitle && (
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
          {nodeData.subtitle}
        </div>
      )}

      {/* Status dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: status === 'running' ? '#38bdf8' : status === 'completed' ? '#22c55e' : '#94a3b8',
          }}
        />
        <span style={{ fontSize: 8.5, color: '#64748b', textTransform: 'capitalize' }}>{status}</span>
      </div>
    </div>
  );
});

ActorNode.displayName = 'ActorNode';
