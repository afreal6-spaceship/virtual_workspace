import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { ArchitectureNodeData } from '../types';
import { renderNodeIcon } from './icons';

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; accent: string; glow: string }> = {
  blue: {
    bg: 'rgba(30, 58, 138, 0.15)',
    border: '#3b82f6',
    text: '#93c5fd',
    accent: '#2563eb',
    glow: 'rgba(59, 130, 246, 0.35)',
  },
  green: {
    bg: 'rgba(20, 83, 45, 0.15)',
    border: '#22c55e',
    text: '#86efac',
    accent: '#16a34a',
    glow: 'rgba(34, 197, 94, 0.35)',
  },
  yellow: {
    bg: 'rgba(113, 63, 18, 0.15)',
    border: '#eab308',
    text: '#fde047',
    accent: '#ca8a04',
    glow: 'rgba(234, 179, 8, 0.35)',
  },
  red: {
    bg: 'rgba(127, 29, 29, 0.15)',
    border: '#ef4444',
    text: '#fca5a5',
    accent: '#dc2626',
    glow: 'rgba(239, 68, 68, 0.35)',
  },
  violet: {
    bg: 'rgba(76, 29, 149, 0.15)',
    border: '#8b5cf6',
    text: '#c4b5fd',
    accent: '#7c3aed',
    glow: 'rgba(139, 92, 246, 0.35)',
  },
  purple: {
    bg: 'rgba(76, 29, 149, 0.15)',
    border: '#8b5cf6',
    text: '#c4b5fd',
    accent: '#7c3aed',
    glow: 'rgba(139, 92, 246, 0.35)',
  },
  cyan: {
    bg: 'rgba(22, 78, 99, 0.15)',
    border: '#06b6d4',
    text: '#67e8f9',
    accent: '#0891b2',
    glow: 'rgba(6, 182, 212, 0.35)',
  },
  orange: {
    bg: 'rgba(124, 45, 18, 0.15)',
    border: '#f97316',
    text: '#fdba74',
    accent: '#ea580c',
    glow: 'rgba(249, 115, 22, 0.35)',
  },
};

export const ArchitectureNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as ArchitectureNodeData;
  const colorScheme = COLOR_MAP[nodeData.color || 'blue'] || COLOR_MAP.blue;
  const status = nodeData.status || 'idle';

  return (
    <div
      className={`arch-node ${selected ? 'is-selected' : ''} status-${status}`}
      style={{
        minWidth: 160,
        maxWidth: 240,
        padding: '10px 14px',
        borderRadius: 12,
        background: '#181b20',
        border: `1.5px solid ${selected ? '#ffffff' : colorScheme.border}`,
        boxShadow: selected
          ? `0 0 16px ${colorScheme.glow}, 0 4px 12px rgba(0,0,0,0.4)`
          : `0 2px 8px rgba(0,0,0,0.3)`,
        position: 'relative',
        transition: 'all 0.2s ease',
        cursor: 'grab',
        color: '#f3f4f6',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* 4 Multi-directional handles for flexible data-flow architectures */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{ background: colorScheme.border, width: 8, height: 8, border: '2px solid #111' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: colorScheme.border, width: 8, height: 8, border: '2px solid #111' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ background: colorScheme.border, width: 8, height: 8, border: '2px solid #111' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ background: colorScheme.border, width: 8, height: 8, border: '2px solid #111' }}
      />

      {/* Top Header: Category & Status Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: colorScheme.text,
            background: colorScheme.bg,
            padding: '2px 6px',
            borderRadius: 4,
            border: `1px solid ${colorScheme.border}33`,
          }}
        >
          {nodeData.category || 'Service'}
        </span>

        {/* Live Status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background:
                status === 'running'
                  ? '#38bdf8'
                  : status === 'completed'
                  ? '#22c55e'
                  : status === 'failed'
                  ? '#ef4444'
                  : '#6b7280',
              boxShadow:
                status === 'running'
                  ? '0 0 8px #38bdf8'
                  : status === 'completed'
                  ? '0 0 6px #22c55e'
                  : 'none',
              animation: status === 'running' ? 'pulseDot 1.2s infinite' : 'none',
            }}
          />
          <span style={{ fontSize: 9, color: '#9ca3af', textTransform: 'capitalize' }}>
            {status}
          </span>
        </div>
      </div>

      {/* Center Body: Icon + Title + Subtitle */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: colorScheme.bg,
            border: `1px solid ${colorScheme.border}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colorScheme.text,
            flexShrink: 0,
          }}
        >
          {renderNodeIcon(nodeData.icon, 18, colorScheme.border)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              lineHeight: 1.3,
              color: '#f9fafb',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {nodeData.label}
          </div>
          {nodeData.subtitle && (
            <div
              style={{
                fontSize: 10.5,
                color: '#9ca3af',
                marginTop: 2,
                lineHeight: 1.2,
                whiteSpace: 'pre-wrap',
              }}
            >
              {nodeData.subtitle}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Metrics Bar (if available) */}
      {nodeData.metrics && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 8,
            paddingTop: 6,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: 9.5,
            color: '#94a3b8',
          }}
        >
          {nodeData.metrics.latency && <span>⚡ {nodeData.metrics.latency}</span>}
          {nodeData.metrics.qps && <span>📊 {nodeData.metrics.qps}</span>}
          {nodeData.metrics.records && <span>📦 {nodeData.metrics.records}</span>}
        </div>
      )}
    </div>
  );
});

ArchitectureNode.displayName = 'ArchitectureNode';
