import React from 'react';
import { Node, Edge } from '@xyflow/react';
import { ArchitectureValidationError } from '../types';

interface ValidationModalProps {
  nodes: Node[];
  edges: Edge[];
  isOpen: boolean;
  onClose: () => void;
}

export function validateArchitecture(nodes: Node[], edges: Edge[]): { errors: ArchitectureValidationError[]; score: number } {
  const errors: ArchitectureValidationError[] = [];
  const standardNodes = nodes.filter((n) => n.type !== 'group');

  if (standardNodes.length === 0) {
    return { errors: [], score: 100 };
  }

  const incomingCounts: Record<string, number> = {};
  const outgoingCounts: Record<string, number> = {};

  standardNodes.forEach((n) => {
    incomingCounts[n.id] = 0;
    outgoingCounts[n.id] = 0;
  });

  edges.forEach((e) => {
    if (outgoingCounts[e.source] !== undefined) outgoingCounts[e.source]++;
    if (incomingCounts[e.target] !== undefined) incomingCounts[e.target]++;
  });

  // Check for orphan nodes
  standardNodes.forEach((n) => {
    const inc = incomingCounts[n.id] || 0;
    const out = outgoingCounts[n.id] || 0;
    const label = (n.data as any)?.label || n.id;
    const cat = (n.data as any)?.category || '';

    if (inc === 0 && out === 0) {
      errors.push({
        id: `orphan-${n.id}`,
        type: 'orphan',
        severity: 'warning',
        message: `Isolated component "${label}" has no incoming or outgoing connections.`,
        nodeId: n.id,
      });
    } else if (inc === 0 && cat !== 'Data Source' && cat !== 'Actor' && cat !== 'Ingress') {
      errors.push({
        id: `no-input-${n.id}`,
        type: 'no-input',
        severity: 'info',
        message: `Component "${label}" has no incoming data source or upstream dependency.`,
        nodeId: n.id,
      });
    } else if (out === 0 && cat !== 'Monitoring' && cat !== 'Actor' && cat !== 'Storage' && cat !== 'Application') {
      errors.push({
        id: `no-output-${n.id}`,
        type: 'no-output',
        severity: 'info',
        message: `Terminal component "${label}" has no downstream consumers.`,
        nodeId: n.id,
      });
    }
  });

  const penalty = errors.reduce((acc, err) => acc + (err.severity === 'error' ? 25 : err.severity === 'warning' ? 10 : 4), 0);
  const score = Math.max(0, 100 - penalty);

  return { errors, score };
}

export const ValidationModal: React.FC<ValidationModalProps> = ({ nodes, edges, isOpen, onClose }) => {
  if (!isOpen) return null;

  const { errors, score } = validateArchitecture(nodes, edges);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 480,
          maxHeight: '80vh',
          background: '#13161a',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 16,
          boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🔍</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Architecture Health Check</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Health Score Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: 10,
              background: score >= 90 ? 'rgba(34, 197, 94, 0.12)' : score >= 70 ? 'rgba(234, 179, 8, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${score >= 90 ? '#22c55e44' : score >= 70 ? '#eab30844' : '#ef444444'}`,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Architecture Score</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: score >= 90 ? '#86efac' : score >= 70 ? '#fde047' : '#fca5a5' }}>
                {score}% {score >= 90 ? 'Production Ready' : score >= 70 ? 'Good / Minor Gaps' : 'Needs Review'}
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#cbd5e1', textAlign: 'right' }}>
              <div>{nodes.length} Components</div>
              <div>{edges.length} Data Connections</div>
            </div>
          </div>

          {/* Validation Details */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>
              Topology Audit ({errors.length} {errors.length === 1 ? 'Finding' : 'Findings'})
            </div>

            {errors.length === 0 ? (
              <div style={{ padding: 16, background: '#1a1f26', borderRadius: 8, textAlign: 'center', color: '#86efac', fontSize: 12 }}>
                ✅ All modules and data flows are properly linked with valid inputs and outputs.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {errors.map((err) => (
                  <div
                    key={err.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: '#1a1f26',
                      borderLeft: `3px solid ${err.severity === 'error' ? '#ef4444' : err.severity === 'warning' ? '#eab308' : '#38bdf8'}`,
                      fontSize: 11.5,
                      color: '#e2e8f0',
                      lineHeight: 1.4,
                    }}
                  >
                    {err.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
