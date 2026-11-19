import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { GroupNodeData } from '../types';

const GROUP_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  blue: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.04)', text: '#93c5fd' },
  green: { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.04)', text: '#86efac' },
  yellow: { border: '#eab308', bg: 'rgba(234, 179, 8, 0.04)', text: '#fde047' },
  red: { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.04)', text: '#fca5a5' },
  violet: { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.04)', text: '#c4b5fd' },
  cyan: { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.04)', text: '#67e8f9' },
  orange: { border: '#f97316', bg: 'rgba(249, 115, 22, 0.04)', text: '#fdba74' },
  default: { border: 'rgba(255, 255, 255, 0.3)', bg: 'rgba(255, 255, 255, 0.02)', text: '#e5e7eb' },
};

export const GroupNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const groupData = data as GroupNodeData;
  const colors = GROUP_COLORS[groupData.color || 'default'] || GROUP_COLORS.default;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minWidth: 260,
        minHeight: 140,
        borderRadius: 16,
        border: `2px dashed ${selected ? '#ffffff' : colors.border}`,
        background: colors.bg,
        position: 'relative',
        boxShadow: selected ? '0 0 20px rgba(255,255,255,0.15)' : 'none',
        pointerEvents: 'none',
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* External group handles for macro level architecture connections */}
      <Handle type="target" position={Position.Top} id="top" style={{ pointerEvents: 'auto', background: colors.border }} />
      <Handle type="source" position={Position.Right} id="right" style={{ pointerEvents: 'auto', background: colors.border }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ pointerEvents: 'auto', background: colors.border }} />
      <Handle type="target" position={Position.Left} id="left" style={{ pointerEvents: 'auto', background: colors.border }} />

      {/* Floating Header Tag */}
      <div
        style={{
          position: 'absolute',
          top: -14,
          left: 20,
          background: '#0d1117',
          padding: '2px 14px',
          borderRadius: 20,
          border: `1.5px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          pointerEvents: 'auto',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: colors.text,
            letterSpacing: '0.02em',
          }}
        >
          {groupData.label}
        </span>
        {groupData.category && (
          <span
            style={{
              fontSize: 9.5,
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            • {groupData.category}
          </span>
        )}
      </div>

      {groupData.description && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 12,
            fontSize: 10,
            color: '#6b7280',
            fontStyle: 'italic',
          }}
        >
          {groupData.description}
        </div>
      )}
    </div>
  );
});

GroupNode.displayName = 'GroupNode';
