# Visual Board - 454ee137-d658-4c04-b5ff-bc3c24757d4f
**Total Nodes:** 23  |  **Total Connectors:** 21

## Current Nodes on Canvas:
- [ds_1] `Structured
(SQL DB / Warehouse)` at (-544, 304)
- [ds_2] `Semi-Structured
(JSON, XML, CSV)` at (-96, -96)
- [ds_3] `Unstructured
(Audio, Text, Media)` at (416, -32)
- [ext_batch] `Batch Ingestion
(Kafka Streams)` at (40, 880)
- [ext_lake] `Data Lake
(Delta Lake / Object Storage)` at (260, 880)
- [dp_1] `Validate
(Schema & Null Checks)` at (420, 730)
- [dp_2] `Clean
(Outliers & Imputation)` at (550, 730)
- [dp_3] `Standardise
(Normalization)` at (680, 730)
- [dp_4] `Curate
(Gold Tables)` at (810, 730)
- [fe_1] `Select Features
(Importance & Ranking)` at (50, 600)
- [fe_2] `Extract Features
(Vector Embeddings)` at (50, 710)
- [md_1] `Code
(Notebooks & Git)` at (300, 440)
- [md_2] `Train
(Distributed GPU Cluster)` at (430, 440)
- [md_3] `Validate
(Hyperparameters)` at (560, 440)
- [md_4] `Evaluate
(F1 & ROC-AUC)` at (690, 440)
- [dep_1] `Deploy
(Canary / Blue-Green)` at (50, 220)
- [dep_2] `Containerise
(Docker & OCI Images)` at (50, 315)
- [dep_3] `Package
(ONNX / TensorRT)` at (50, 410)
- [srv_1] `Serve API
(Triton Server)` at (360, 230)
- [csm_1] `Consume API
(API Gateway)` at (560, 230)
- [csm_2] `Applications
(Dashboards & Web)` at (700, 230)
- [ext_user] `User
(Enterprise Clients)` at (1088, -16)
- [ext_monitor] `Monitor
(Drift & Latency)` at (880, 440)

## Flow Connections:
- `[ds_1]` ----> `[ext_batch]`
- `[ext_batch]` ----> `[ext_lake]`
- `[ext_lake]` ----> `[dp_1]`
- `[dp_1]` ----> `[dp_2]`
- `[dp_2]` ----> `[dp_3]`
- `[dp_3]` ----> `[dp_4]`
- `[dp_4]` ----> `[fe_2]`
- `[fe_2]` ----> `[fe_1]`
- `[fe_1]` ----> `[md_1]`
- `[md_1]` ----> `[md_2]`
- `[md_2]` ----> `[md_3]`
- `[md_3]` ----> `[md_4]`
- `[md_4]` ----> `[dep_3]`
- `[dep_3]` ----> `[dep_2]`
- `[dep_2]` ----> `[dep_1]`
- `[dep_1]` ----> `[srv_1]`
- `[srv_1]` ----> `[csm_1]`
- `[csm_1]` ----> `[csm_2]`
- `[csm_2]` ----> `[ext_user]`
- `[csm_2]` ----> `[ext_monitor]`
- `[ext_monitor]` ----> `[md_1]`
