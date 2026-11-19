import React from 'react';
import { SimulationState } from '../types';

interface SimulationControlsProps {
  simulation: SimulationState;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  simulation,
  onPlay,
  onPause,
  onReset,
  onSpeedChange,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: 10,
        padding: '5px 12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(8px)',
        color: '#f8fafc',
        fontSize: 11.5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: simulation.status === 'running' ? '#38bdf8' : simulation.status === 'completed' ? '#22c55e' : '#64748b',
            boxShadow: simulation.status === 'running' ? '0 0 10px #38bdf8' : 'none',
          }}
        />
        <span style={{ fontWeight: 700, color: '#e0f2fe' }}>
          {simulation.status === 'running'
            ? 'Workflow Simulating...'
            : simulation.status === 'completed'
            ? 'Simulation Complete'
            : 'Workflow Simulator'}
        </span>
      </div>

      {simulation.status === 'running' ? (
        <button
          onClick={onPause}
          style={{
            background: '#eab308',
            color: '#000',
            border: 'none',
            borderRadius: 6,
            padding: '4px 10px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          ⏸ Pause
        </button>
      ) : (
        <button
          onClick={onPlay}
          style={{
            background: '#0284c7',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '4px 12px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          ▶ Run Simulation
        </button>
      )}

      <button
        onClick={onReset}
        style={{
          background: 'rgba(255,255,255,0.08)',
          color: '#cbd5e1',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6,
          padding: '4px 8px',
          cursor: 'pointer',
          fontSize: 11,
        }}
      >
        ↺ Reset
      </button>

      {simulation.isActive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 8, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 10 }}>
          <span style={{ color: '#93c5fd' }}>
            Step {simulation.currentStep}/{simulation.totalSteps}
          </span>
          <span style={{ color: '#86efac' }}>
            ⚡ {simulation.processedCount} req/s
          </span>
        </div>
      )}

      {/* Speed control */}
      <select
        value={simulation.speed}
        onChange={(e) => onSpeedChange(Number(e.target.value))}
        style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#cbd5e1',
          borderRadius: 4,
          padding: '2px 4px',
          fontSize: 10.5,
          cursor: 'pointer',
        }}
      >
        <option value={1500}>1x</option>
        <option value={800}>2x</option>
        <option value={400}>4x</option>
      </select>
    </div>
  );
};
