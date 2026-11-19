# HRMS (Human Resource Management System) Architecture Flowchart
*Last updated: 2026-11-18 17:08:59*

**Total Nodes:** 14  |  **Total Connectors:** 13

## Current Nodes on Canvas
- **[hrms_1]** `1. Job Requisition & Posting
(Hiring Manager & HR)` at (80, 80) [blue]
- **[hrms_2]** `2. Applicant Tracking & Sourcing
(Portal & Referrals)` at (360, 80) [blue]
- **[hrms_3]** `3. Interview & Technical Screening
(Panel Assessment)` at (640, 80) [blue]
- **[hrms_4]** `4. Offer Management & BG Check
(Candidate Acceptance)` at (920, 80) [blue]
- **[hrms_5]** `5. Digital Onboarding
(Document Upload & ID Creation)` at (920, 240) [green]
- **[hrms_6]** `6. Employee Master Database
(Profile, Department, Roles)` at (640, 240) [green]
- **[hrms_7]** `7. Time & Attendance System
(Biometric / Geo-fencing)` at (360, 240) [green]
- **[hrms_8]** `8. Leave & Shift Management
(Accrual & Manager Approval)` at (80, 240) [green]
- **[hrms_9]** `9. Payroll & Tax Processing
(Salary, Deductions, Bonus)` at (80, 400) [yellow]
- **[hrms_10]** `10. Direct Deposit & Payslips
(Banking API & Self-Service)` at (360, 400) [yellow]
- **[hrms_11]** `11. Performance & KPI Reviews
(OKRs, 360 Feedback, Goals)` at (640, 400) [yellow]
- **[hrms_12]** `12. Training & L&D Management
(Courses & Certifications)` at (920, 400) [yellow]
- **[hrms_13]** `13. Separation & Offboarding
(Resignation, Exit Interview, Assets)` at (920, 560) [red]
- **[hrms_14]** `14. Full & Final Settlement (FnF)
(Gratuity, PF, Relieving Letter)` at (640, 560) [red]

## Flow Connections
- `[hrms_1]` --(Applications)--> `[hrms_2]`
- `[hrms_2]` --(Shortlisted)--> `[hrms_3]`
- `[hrms_3]` --(Recommended)--> `[hrms_4]`
- `[hrms_4]` --(Accepted)--> `[hrms_5]`
- `[hrms_5]` --(Records Stored)--> `[hrms_6]`
- `[hrms_6]` --(Track Daily)--> `[hrms_7]`
- `[hrms_7]` --(Leave Balances)--> `[hrms_8]`
- `[hrms_8]` --(Monthly Cutoff)--> `[hrms_9]`
- `[hrms_9]` --(Disbursed)--> `[hrms_10]`
- `[hrms_6]` --(Quarterly Appraisal)--> `[hrms_11]`
- `[hrms_11]` --(Skill Gaps)--> `[hrms_12]`
- `[hrms_11]` --(Exit / Retirement)--> `[hrms_13]`
- `[hrms_13]` --(Clearance Completed)--> `[hrms_14]`
