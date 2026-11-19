export type NodeStatus = 'idle' | 'running' | 'completed' | 'failed';

export type NodeCategory =
  | 'Data Source'
  | 'Ingestion'
  | 'Storage'
  | 'Pipeline'
  | 'Feature Engineering'
  | 'Model'
  | 'Deployment'
  | 'API'
  | 'Application'
  | 'Actor'
  | 'Monitoring'
  | 'Service'
  | 'Security'
  | 'Custom';

export type FlowColor = 'blue' | 'green' | 'yellow' | 'red' | 'violet' | 'cyan' | 'orange' | 'purple';

export interface ArchitectureNodeData extends Record<string, unknown> {
  label: string;
  subtitle?: string;
  category?: NodeCategory;
  icon?: string;
  color?: FlowColor;
  status?: NodeStatus;
  details?: string;
  metrics?: {
    latency?: string;
    qps?: string;
    cpu?: string;
    records?: string;
  };
  config?: Record<string, any>;
  collapsed?: boolean;
}

export interface GroupNodeData extends Record<string, unknown> {
  label: string;
  category?: string;
  description?: string;
  color?: FlowColor;
  width?: number;
  height?: number;
}

export type EdgeType = 'dataflow' | 'api' | 'dependency' | 'monitoring' | 'event' | 'stream';

export interface CustomEdgeData extends Record<string, unknown> {
  label?: string;
  edgeType?: EdgeType;
  animated?: boolean;
  color?: string;
  dashed?: boolean;
}

export interface SimulationState {
  isActive: boolean;
  status: 'idle' | 'running' | 'paused' | 'completed';
  currentStep: number;
  totalSteps: number;
  speed: number;
  activeNodeIds: string[];
  activeEdgeIds: string[];
  processedCount: number;
}

export interface ArchitectureValidationError {
  id: string;
  type: 'orphan' | 'no-input' | 'no-output' | 'cycle' | 'missing-config';
  severity: 'error' | 'warning' | 'info';
  message: string;
  nodeId?: string;
}

export interface BoardDiskFormat {
  boardId?: string;
  title?: string;
  nodes: Array<{
    id: string;
    label: string;
    subtitle?: string;
    x: number;
    y: number;
    w?: number;
    h?: number;
    color?: string;
    category?: string;
    icon?: string;
    status?: NodeStatus;
    parentId?: string;
    details?: string;
  }>;
  arrows: Array<{
    id?: string;
    from: string;
    to: string;
    label?: string;
    type?: string;
    animated?: boolean;
    color?: string;
  }>;
  groups?: Array<{
    id: string;
    title: string;
    x: number;
    y: number;
    w: number;
    h: number;
    color?: string;
    category?: string;
  }>;
}
