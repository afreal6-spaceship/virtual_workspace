import { BoardDiskFormat } from '../types';

export const BLUEPRINTS: Record<string, BoardDiskFormat> = {
  mlops: {
    title: 'Enterprise MLOps Production System Architecture',
    groups: [
      {
        id: 'grp_datasources',
        title: 'Data Sources',
        x: 30,
        y: 20,
        w: 480,
        h: 130,
        color: 'violet',
        category: 'Ingress',
      },
      {
        id: 'grp_deployment',
        title: 'Model Deployment',
        x: 30,
        y: 180,
        w: 220,
        h: 340,
        color: 'cyan',
        category: 'CD / Runtime',
      },
      {
        id: 'grp_serve',
        title: 'Serve',
        x: 340,
        y: 190,
        w: 160,
        h: 130,
        color: 'orange',
        category: 'Inference',
      },
      {
        id: 'grp_consume',
        title: 'Consume',
        x: 540,
        y: 190,
        w: 320,
        h: 130,
        color: 'blue',
        category: 'Client Facing',
      },
      {
        id: 'grp_modeldev',
        title: 'Model Development',
        x: 280,
        y: 400,
        w: 520,
        h: 150,
        color: 'red',
        category: 'Training & Eval',
      },
      {
        id: 'grp_features',
        title: 'Feature Engineering',
        x: 30,
        y: 560,
        w: 200,
        h: 260,
        color: 'yellow',
        category: 'Feature Store',
      },
      {
        id: 'grp_datapipeline',
        title: 'Data Pipeline',
        x: 400,
        y: 690,
        w: 520,
        h: 150,
        color: 'green',
        category: 'ETL Processing',
      },
    ],
    nodes: [
      // Data Sources
      { id: 'ds_1', label: 'Structured', subtitle: 'SQL DB / Warehouse', x: 50, y: 55, color: 'violet', icon: 'database', category: 'Data Source' },
      { id: 'ds_2', label: 'Semi-Structured', subtitle: 'JSON, XML, CSV', x: 200, y: 55, color: 'orange', icon: 'code', category: 'Data Source' },
      { id: 'ds_3', label: 'Unstructured', subtitle: 'Audio, Text, Media', x: 350, y: 55, color: 'blue', icon: 'mail', category: 'Data Source' },

      // Ingestion & Storage
      { id: 'ext_batch', label: 'Batch Ingestion', subtitle: 'Kafka & Event Streams', x: 40, y: 880, color: 'green', icon: 'pipeline', category: 'Ingestion' },
      { id: 'ext_lake', label: 'Data Lake', subtitle: 'GCS / Delta Lake / Iceberg', x: 260, y: 880, color: 'cyan', icon: 'datalake', category: 'Storage' },

      // Data Pipeline
      { id: 'dp_1', label: 'Validate', subtitle: 'Schema & Null Checks', x: 420, y: 730, color: 'green', icon: 'check', category: 'Pipeline' },
      { id: 'dp_2', label: 'Clean', subtitle: 'Outliers & Imputation', x: 550, y: 730, color: 'cyan', icon: 'clean', category: 'Pipeline' },
      { id: 'dp_3', label: 'Standardise', subtitle: 'Normalization & Scaling', x: 680, y: 730, color: 'violet', icon: 'standardise', category: 'Pipeline' },
      { id: 'dp_4', label: 'Curate', subtitle: 'Gold / Production Ready', x: 810, y: 730, color: 'yellow', icon: 'file', category: 'Pipeline' },

      // Feature Engineering
      { id: 'fe_1', label: 'Select Features', subtitle: 'Importance & Filtering', x: 50, y: 600, color: 'yellow', icon: 'features', category: 'Feature Engineering' },
      { id: 'fe_2', label: 'Extract Features', subtitle: 'Vector Embeddings', x: 50, y: 710, color: 'orange', icon: 'features', category: 'Feature Engineering' },

      // Model Development
      { id: 'md_1', label: 'Code', subtitle: 'PyTorch / Experiments', x: 300, y: 440, color: 'orange', icon: 'git', category: 'Model' },
      { id: 'md_2', label: 'Train', subtitle: 'Distributed GPU Cluster', x: 430, y: 440, color: 'red', icon: 'brain', category: 'Model' },
      { id: 'md_3', label: 'Validate', subtitle: 'Hyperparameter Tuning', x: 560, y: 440, color: 'green', icon: 'check', category: 'Model' },
      { id: 'md_4', label: 'Evaluate', subtitle: 'F1, ROC-AUC, Latency', x: 690, y: 440, color: 'yellow', icon: 'flask', category: 'Model' },

      // Model Deployment
      { id: 'dep_1', label: 'Deploy', subtitle: 'Canary / Blue-Green', x: 50, y: 220, color: 'cyan', icon: 'rocket', category: 'Deployment' },
      { id: 'dep_2', label: 'Containerise', subtitle: 'Docker & OCI Images', x: 50, y: 315, color: 'blue', icon: 'container', category: 'Deployment' },
      { id: 'dep_3', label: 'Package', subtitle: 'ONNX / TensorRT Export', x: 50, y: 410, color: 'orange', icon: 'box', category: 'Deployment' },

      // Serve & Consume
      { id: 'srv_1', label: 'Serve API', subtitle: 'Triton / vLLM Server', x: 360, y: 230, color: 'orange', icon: 'api', category: 'API' },
      { id: 'csm_1', label: 'Consume API', subtitle: 'Ingress & Gateway', x: 560, y: 230, color: 'orange', icon: 'api', category: 'API' },
      { id: 'csm_2', label: 'Applications', subtitle: 'Dashboards & Web Apps', x: 700, y: 230, color: 'blue', icon: 'app', category: 'Application' },

      // Actor & Monitoring
      { id: 'ext_user', label: 'User', subtitle: 'Enterprise Clients', x: 740, y: 40, color: 'blue', icon: 'user', category: 'Actor' },
      { id: 'ext_monitor', label: 'Monitor', subtitle: 'Drift, Latency & Alerts', x: 880, y: 440, color: 'cyan', icon: 'monitor', category: 'Monitoring' },
    ],
    arrows: [
      // Ingestion flow
      { from: 'ds_1', to: 'ext_batch', label: 'Raw Ingestion', type: 'stream', color: '#f97316' },
      { from: 'ext_batch', to: 'ext_lake', label: 'Stream Feed', type: 'stream', color: '#f97316' },
      { from: 'ext_lake', to: 'dp_1', label: 'Batch Read', type: 'dataflow', color: '#f97316' },

      // Data Pipeline internal sequence
      { from: 'dp_1', to: 'dp_2', label: 'Cleaned', type: 'dataflow', color: '#22c55e' },
      { from: 'dp_2', to: 'dp_3', label: 'Standardized', type: 'dataflow', color: '#22c55e' },
      { from: 'dp_3', to: 'dp_4', label: 'Curated', type: 'dataflow', color: '#22c55e' },

      // Pipeline -> Features -> Model Dev
      { from: 'dp_4', to: 'fe_2', label: 'Gold Tables', type: 'dataflow', color: '#f97316' },
      { from: 'fe_2', to: 'fe_1', label: 'Vectors', type: 'dataflow', color: '#eab308' },
      { from: 'fe_1', to: 'md_1', label: 'Training Set', type: 'dataflow', color: '#f97316' },

      // Model Dev sequence
      { from: 'md_1', to: 'md_2', label: 'Train Job', type: 'dataflow', color: '#ef4444' },
      { from: 'md_2', to: 'md_3', label: 'Weights', type: 'dataflow', color: '#ef4444' },
      { from: 'md_3', to: 'md_4', label: 'Checkpoints', type: 'dataflow', color: '#ef4444' },

      // Model Dev -> Deployment
      { from: 'md_4', to: 'dep_3', label: 'Promoted', type: 'dataflow', color: '#f97316' },
      { from: 'dep_3', to: 'dep_2', label: 'Dockerize', type: 'dependency', color: '#3b82f6' },
      { from: 'dep_2', to: 'dep_1', label: 'Deploy Image', type: 'dependency', color: '#06b6d4' },

      // Deployment -> Serve -> Consume
      { from: 'dep_1', to: 'srv_1', label: 'Active Replica', type: 'api', color: '#f97316' },
      { from: 'srv_1', to: 'csm_1', label: 'Inference REST/gRPC', type: 'api', color: '#f97316' },
      { from: 'csm_1', to: 'csm_2', label: 'Responses', type: 'api', color: '#3b82f6' },

      // Consumer -> User & Monitoring
      { from: 'csm_2', to: 'ext_user', label: 'Interactions', type: 'dataflow', color: '#38bdf8' },
      { from: 'csm_2', to: 'ext_monitor', label: 'Inference Logs', type: 'monitoring', color: '#06b6d4' },
      { from: 'ext_monitor', to: 'md_1', label: 'Drift Feedback', type: 'monitoring', color: '#06b6d4' },
    ],
  },

  hrms: {
    title: 'HRMS Employee Lifecycle & Payroll Workflow',
    groups: [
      { id: 'grp_talent', title: 'Talent Acquisition', x: 40, y: 30, w: 720, h: 140, color: 'blue', category: 'Recruitment' },
      { id: 'grp_onboarding', title: 'Core HR & Attendance', x: 40, y: 220, w: 720, h: 140, color: 'green', category: 'Operations' },
      { id: 'grp_finance', title: 'Payroll & Banking', x: 40, y: 410, w: 720, h: 140, color: 'yellow', category: 'Finance' },
      { id: 'grp_exit', title: 'Offboarding & Settlement', x: 40, y: 600, w: 720, h: 140, color: 'red', category: 'Separation' },
    ],
    nodes: [
      { id: 'h_1', label: 'Job Requisition', subtitle: 'Position & Budget', x: 60, y: 70, color: 'blue', icon: 'file', category: 'Talent Acquisition' },
      { id: 'h_2', label: 'Applicant Tracking', subtitle: 'Screening & Scoring', x: 240, y: 70, color: 'blue', icon: 'features', category: 'Talent Acquisition' },
      { id: 'h_3', label: 'Interview Panel', subtitle: 'Technical & Culture', x: 420, y: 70, color: 'blue', icon: 'user', category: 'Talent Acquisition' },
      { id: 'h_4', label: 'Offer & BG Check', subtitle: 'Salary & Contracts', x: 600, y: 70, color: 'blue', icon: 'check', category: 'Talent Acquisition' },

      { id: 'h_5', label: 'Digital Onboarding', subtitle: 'E-Sign & ID Creation', x: 60, y: 260, color: 'green', icon: 'file', category: 'Core HR' },
      { id: 'h_6', label: 'Employee Master', subtitle: 'Profiles & Departments', x: 240, y: 260, color: 'green', icon: 'database', category: 'Core HR' },
      { id: 'h_7', label: 'Biometric Attendance', subtitle: 'Daily Check-in & Shifts', x: 420, y: 260, color: 'green', icon: 'pipeline', category: 'Core HR' },
      { id: 'h_8', label: 'Leave Management', subtitle: 'Paid Leaves & Approvals', x: 600, y: 260, color: 'green', icon: 'check', category: 'Core HR' },

      { id: 'h_9', label: 'Payroll Engine', subtitle: 'Taxes, Deductions, Bonus', x: 60, y: 450, color: 'yellow', icon: 'standardise', category: 'Payroll' },
      { id: 'h_10', label: 'Banking Disbursal', subtitle: 'Direct Deposit API', x: 280, y: 450, color: 'yellow', icon: 'api', category: 'Payroll' },
      { id: 'h_11', label: 'Digital Payslips', subtitle: 'Employee Portal View', x: 500, y: 450, color: 'yellow', icon: 'app', category: 'Payroll' },

      { id: 'h_12', label: 'Resignation & Clearance', subtitle: 'Asset Return & Sign-off', x: 120, y: 640, color: 'red', icon: 'mail', category: 'Offboarding' },
      { id: 'h_13', label: 'Full & Final (FnF)', subtitle: 'Gratuity, PF & Release', x: 440, y: 640, color: 'red', icon: 'check', category: 'Offboarding' },
    ],
    arrows: [
      { from: 'h_1', to: 'h_2', label: 'Requisition Approved', type: 'dataflow', color: '#3b82f6' },
      { from: 'h_2', to: 'h_3', label: 'Candidates Shortlisted', type: 'dataflow', color: '#3b82f6' },
      { from: 'h_3', to: 'h_4', label: 'Selected', type: 'dataflow', color: '#3b82f6' },
      { from: 'h_4', to: 'h_5', label: 'Offer Accepted', type: 'dataflow', color: '#22c55e' },
      { from: 'h_5', to: 'h_6', label: 'Profile Registered', type: 'dataflow', color: '#22c55e' },
      { from: 'h_6', to: 'h_7', label: 'Shift Assigned', type: 'dataflow', color: '#22c55e' },
      { from: 'h_7', to: 'h_8', label: 'Overtime & Leaves', type: 'dataflow', color: '#22c55e' },
      { from: 'h_8', to: 'h_9', label: 'Attendance Lock', type: 'dataflow', color: '#eab308' },
      { from: 'h_9', to: 'h_10', label: 'ACH Batch Payout', type: 'dataflow', color: '#eab308' },
      { from: 'h_10', to: 'h_11', label: 'Generated Slips', type: 'dataflow', color: '#eab308' },
      { from: 'h_6', to: 'h_12', label: 'Notice Period', type: 'dataflow', color: '#ef4444' },
      { from: 'h_12', to: 'h_13', label: 'Clearance Done', type: 'dataflow', color: '#ef4444' },
    ],
  },

  microservices: {
    title: 'Cloud-Native Microservices Architecture',
    groups: [
      { id: 'grp_edge', title: 'Edge & Gateway', x: 40, y: 40, w: 260, h: 420, color: 'blue', category: 'Ingress' },
      { id: 'grp_services', title: 'Core Services', x: 340, y: 40, w: 380, h: 420, color: 'cyan', category: 'Backend' },
      { id: 'grp_data', title: 'Data Tier & Messaging', x: 760, y: 40, w: 280, h: 420, color: 'violet', category: 'Storage' },
    ],
    nodes: [
      { id: 'ms_user', label: 'Web / Mobile Client', subtitle: 'React & iOS/Android', x: 60, y: 90, color: 'blue', icon: 'user', category: 'Actor' },
      { id: 'ms_gw', label: 'API Gateway', subtitle: 'Kong / Envoy Proxy', x: 60, y: 220, color: 'blue', icon: 'api', category: 'API' },
      { id: 'ms_auth', label: 'Auth & OAuth2', subtitle: 'JWT & Session Token', x: 60, y: 340, color: 'yellow', icon: 'shield', category: 'Security' },

      { id: 'ms_order', label: 'Order Service', subtitle: 'Go / gRPC Microservice', x: 360, y: 90, color: 'cyan', icon: 'container', category: 'Service' },
      { id: 'ms_payment', label: 'Payment Service', subtitle: 'Stripe & PayPal Webhooks', x: 360, y: 220, color: 'green', icon: 'container', category: 'Service' },
      { id: 'ms_inventory', label: 'Inventory Service', subtitle: 'Stock Reservation', x: 360, y: 340, color: 'orange', icon: 'box', category: 'Service' },

      { id: 'ms_kafka', label: 'Kafka Event Bus', subtitle: 'Pub/Sub Event Broker', x: 780, y: 90, color: 'orange', icon: 'pipeline', category: 'Ingestion' },
      { id: 'ms_db', label: 'PostgreSQL DB', subtitle: 'Primary & Replicas', x: 780, y: 220, color: 'violet', icon: 'database', category: 'Storage' },
      { id: 'ms_cache', label: 'Redis Cache', subtitle: 'Distributed In-Memory', x: 780, y: 340, color: 'red', icon: 'database', category: 'Storage' },
    ],
    arrows: [
      { from: 'ms_user', to: 'ms_gw', label: 'HTTPS / WSS', type: 'api', color: '#38bdf8' },
      { from: 'ms_gw', to: 'ms_auth', label: 'Verify Token', type: 'api', color: '#eab308' },
      { from: 'ms_gw', to: 'ms_order', label: 'Route /api/orders', type: 'api', color: '#38bdf8' },
      { from: 'ms_order', to: 'ms_payment', label: 'Trigger Payout', type: 'api', color: '#22c55e' },
      { from: 'ms_order', to: 'ms_kafka', label: 'OrderCreated Event', type: 'stream', color: '#f97316' },
      { from: 'ms_kafka', to: 'ms_inventory', label: 'Consume Stock Event', type: 'stream', color: '#f97316' },
      { from: 'ms_order', to: 'ms_db', label: 'ACID Transaction', type: 'dataflow', color: '#8b5cf6' },
      { from: 'ms_order', to: 'ms_cache', label: 'Cache Lookup', type: 'dataflow', color: '#ef4444' },
    ],
  },
};
