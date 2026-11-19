# HRMS project workflow

Semantic workflow · illustrative animation

## Recruitment
- requisition: Approve role (clipboard-list)
- candidate: Assess candidates (search)
- offer: Accept offer (handshake)
## Employee onboarding
- documents: Verify documents (file-check)
- provision: Provision access (rocket)
- master: Employee record (database)
## Time & attendance
- capture: Capture time (clock)
- reconcile: Reconcile leave (calendar-days)
- approve_time: Approve period (circle-check)
## Payroll & delivery
- calculate: Calculate payroll (calculator)
- authorize: Approve payroll (shield-check)
- bank: Release payment (landmark)
- payslip: Publish payslip (receipt)
## Training & knowledge
- review: Review skills (target)
- train: Complete training (graduation-cap)
- knowledge: Publish guides (book-open)
## Separation
- request_exit: Approve exit (log-out)
- clearance: Clear assets (package-check)
- settle: Final settlement (briefcase-business)

## Flows
- hr → requisition [main] Approved headcount
- offer → documents [main] Accepted candidate
- master → capture [main] Employee & schedule
- approve_time → calculate [main] Approved payable days
- master → review [main] Role & objectives
- master → request_exit [main] Authorized separation
- settle → calculate [main] Final payment draft
- payslip → employee [output] Payslip available
- knowledge → employee [output] Published policies
- knowledge → review [feedback] Learning outcomes
- authorize → calculate [feedback] Corrections required
- bank → authorize [feedback] Reconcile failed payment
- approve_time → capture [feedback] Resolve time exceptions
- requisition → candidate [seq] 
- candidate → offer [seq] 
- documents → provision [seq] 
- provision → master [seq] 
- capture → reconcile [seq] 
- reconcile → approve_time [seq] 
- calculate → authorize [seq] 
- authorize → bank [seq] 
- bank → payslip [seq] 
- review → train [seq] 
- train → knowledge [seq] 
- request_exit → clearance [seq] 
- clearance → settle [seq] 
