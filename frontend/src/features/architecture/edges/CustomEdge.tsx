import React, { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getSmoothStepPath,
} from '@xyflow/react';
import { CustomEdgeData } from '../types';

export const CustomEdge: React.FC<EdgeProps> = memo((props) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
    selected,
  } = props;

  const edgeData = (data || {}) as CustomEdgeData;
  const isDashed = edgeData.dashed !== false;
  const edgeColor = edgeData.color || (edgeData.edgeType === 'monitoring' ? '#06b6d4' : edgeData.edgeType === 'api' ? '#38bdf8' : '#f97316');
  const isAnimated = edgeData.animated ?? true;

  // Use smooth step for structured architectural diagrams
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? '#ffffff' : edgeColor,
          strokeWidth: selected ? 2.5 : 1.75,
          strokeDasharray: isDashed ? '6 5' : undefined,
          strokeDashoffset: isAnimated ? 0 : undefined,
          animation: isAnimated ? 'dashAnimation 1.5s linear infinite' : undefined,
          filter: selected ? 'drop-shadow(0 0 4px rgba(255,255,255,0.6))' : `drop-shadow(0 0 2px ${edgeColor}44)`,
          cursor: 'pointer',
        }}
      />

      {edgeData.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              fontSize: 9.5,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 6,
              background: '#0f172a',
              border: `1px solid ${edgeColor}`,
              color: '#f8fafc',
              boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
              zIndex: 10,
              letterSpacing: '0.02em',
            }}
            className="nodrag nopan"
          >
            {edgeData.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

CustomEdge.displayName = 'CustomEdge';
