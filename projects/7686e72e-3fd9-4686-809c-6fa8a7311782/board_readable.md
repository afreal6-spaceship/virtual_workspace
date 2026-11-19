# Automated Cloud CI/CD Pipeline & Production Deployment Workflow
*Last updated: 2026-11-19 10:47:01*

**Total Nodes:** 8  |  **Total Connectors:** 7

## Current Nodes on Canvas
- **[d_1]** `1. Git Push / Pull Request - Developer triggers webhook on main branch` at (80, 80) [blue]
- **[d_2]** `2. Static Analysis & Linting - Run ESLint, Flake8, SonarQube & secret scanners` at (360, 80) [blue]
- **[d_3]** `3. Automated Test Suite - Execute unit, integration & mocked API contracts` at (640, 80) [blue]
- **[d_4]** `4. Container Image Build - Multi-stage Dockerfile, vulnerability scan (Trivy)` at (920, 80) [green]
- **[d_5]** `5. Publish to Container Registry - Tag SHA & push to Google Artifact Registry / ECR` at (920, 240) [green]
- **[d_6]** `6. Staging Environment Deployment - Helm upgrade & automated smoke testing` at (640, 240) [green]
- **[d_7]** `7. Canary Production Rollout - Direct 10% traffic, monitor error rates & latency` at (360, 240) [yellow]
- **[d_8]** `8. Full Promotion & Monitoring - 100% rollout, Datadog alerts & Prometheus metrics` at (80, 240) [purple]

## Flow Connections
- `[d_1]` ----> `[d_2]`
- `[d_2]` ----> `[d_3]`
- `[d_3]` ----> `[d_4]`
- `[d_4]` ----> `[d_5]`
- `[d_5]` ----> `[d_6]`
- `[d_6]` ----> `[d_7]`
- `[d_7]` ----> `[d_8]`
