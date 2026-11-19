# Enterprise MLOps Production System Architecture
*Last updated: 2026-11-19 18:13:25*

**Total Nodes:** 23  |  **Total Connectors:** 21

## Current Nodes on Canvas
- **[ds_1]** `Structured - (SQL DB / Warehouse)` at (50, 55) [violet]
- **[ds_2]** `Semi-Structured - (JSON, XML, CSV)` at (200, 55) [orange]
- **[ds_3]** `Unstructured - (Audio, Text, Media)` at (350, 55) [blue]
- **[ext_batch]** `Batch Ingestion - (Kafka Streams)` at (40, 880) [green]
- **[ext_lake]** `Data Lake - (Delta Lake / Object Storage)` at (260, 880) [cyan]
- **[dp_1]** `Validate - (Schema & Null Checks)` at (420, 730) [green]
- **[dp_2]** `Clean - (Outliers & Imputation)` at (550, 730) [cyan]
- **[dp_3]** `Standardise - (Normalization)` at (680, 730) [violet]
- **[dp_4]** `Curate - (Gold Tables)` at (810, 730) [yellow]
- **[fe_1]** `Select Features - (Importance & Ranking)` at (50, 600) [yellow]
- **[fe_2]** `Extract Features - (Vector Embeddings)` at (50, 710) [orange]
- **[md_1]** `Code - (Notebooks & Git)` at (300, 440) [orange]
- **[md_2]** `Train - (Distributed GPU Cluster)` at (430, 440) [red]
- **[md_3]** `Validate - (Hyperparameters)` at (560, 440) [green]
- **[md_4]** `Evaluate - (F1 & ROC-AUC)` at (690, 440) [yellow]
- **[dep_1]** `Deploy - (Canary / Blue-Green)` at (50, 220) [cyan]
- **[dep_2]** `Containerise - (Docker & OCI Images)` at (50, 315) [blue]
- **[dep_3]** `Package - (ONNX / TensorRT)` at (50, 410) [orange]
- **[srv_1]** `Serve API - (Triton Server)` at (360, 230) [orange]
- **[csm_1]** `Consume API - (API Gateway)` at (560, 230) [orange]
- **[csm_2]** `Applications - (Dashboards & Web)` at (700, 230) [blue]
- **[ext_user]** `User - (Enterprise Clients)` at (740, 40) [blue]
- **[ext_monitor]** `Monitor - (Drift & Latency)` at (880, 440) [cyan]

## Flow Connections
- `[ds_1]` --(Raw Ingestion)--> `[ext_batch]`
- `[ext_batch]` --(Stream Feed)--> `[ext_lake]`
- `[ext_lake]` --(Batch Read)--> `[dp_1]`
- `[dp_1]` --(Cleaned)--> `[dp_2]`
- `[dp_2]` --(Standardized)--> `[dp_3]`
- `[dp_3]` --(Curated)--> `[dp_4]`
- `[dp_4]` --(Gold Tables)--> `[fe_2]`
- `[fe_2]` --(Vectors)--> `[fe_1]`
- `[fe_1]` --(Training Set)--> `[md_1]`
- `[md_1]` --(Train Job)--> `[md_2]`
- `[md_2]` --(Weights)--> `[md_3]`
- `[md_3]` --(Checkpoints)--> `[md_4]`
- `[md_4]` --(Promoted)--> `[dep_3]`
- `[dep_3]` --(Dockerize)--> `[dep_2]`
- `[dep_2]` --(Deploy Image)--> `[dep_1]`
- `[dep_1]` --(Active Replica)--> `[srv_1]`
- `[srv_1]` --(Inference REST)--> `[csm_1]`
- `[csm_1]` --(Responses)--> `[csm_2]`
- `[csm_2]` --(Interactions)--> `[ext_user]`
- `[csm_2]` --(Inference Logs)--> `[ext_monitor]`
- `[ext_monitor]` --(Drift Feedback)--> `[md_1]`
