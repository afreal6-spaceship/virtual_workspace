# Workflow design knowledge base

## Requirement and reference analysis

The user wants “generate/make an HRMS project workflow” to produce a ready diagram,
using `pasted_image.png` as the visual reference. Its transferable features are a
dark background, dotted module containers, recognizable icons, short titles,
colored dashed directional connectors, and feedback paths. Its machine-learning
content is not the HRMS business model.

## Implementation plan and delivered files

1. Store a reusable, explicit HRMS graph in `templates/hrms.json`.
2. Preserve the board contract: nodes with id, label, x, y, color, w, h; arrows
   with from, to, label. Put icons inside labels for compatibility. Extra title,
   icon, description, group and animation metadata support richer rendering.
3. Generate `board.json` and `board_readable.md` through `board_tool.py`.
4. Generate `workflow.html` with dotted groups, icons, animated directional paths,
   a module selector, keyboard-accessible nodes, incoming/outgoing transfer details,
   pause/reset controls and reduced-motion support. It works offline.
5. Save examples and these instructions for future agents. This is a reusable
   knowledge base and training/example dataset, not model weight training.

## HRMS semantics

- Hiring: approved role → candidates → interview/accepted offer → onboarding.
- Employee master supplies identity, schedules and compensation terms.
- Attendance and approved leave independently feed time approval and payroll.
- Payroll requires finance approval before bank instructions. Corrections return
  to calculation; failed bank results return for reconciliation. Production
  retries must be idempotent and reconcile uncertain outcomes before resending.
- Performance identifies training needs; completion feeds later reviews.
- Approved training materials enrich a versioned knowledge library; the library
  provides course guides and employee-facing policies.
- Separation begins with an authorized exit request, not poor performance alone.
  Clearance and final balances feed a separately approved final payment.
- Access checks are required for employee records and payslips; this is a system
  map, not a full permissions, payroll rules, or jurisdiction-specific tax design.

## Future request procedure

For requests such as “make HRMS project workflow”, run:

```sh
python3 board_tool.py design "make HRMS project workflow"
```

Read this knowledge base and `templates/hrms.json` first when changing the
workflow. Edit the template, regenerate, and validate references. Keep each icon,
title and data-transfer label meaningful. Preserve explicit approval and error
paths. Use a domain-specific template for other systems instead of merely
renaming HRMS modules. Clarify extra requirements only when they materially
change the workflow.

## Live behavior and limits

Saving the board invokes the existing local notification endpoint. Delivery is
best effort; the CLI does not verify that the parent browser received it. The
parent canvas renderer is outside this project; it may ignore group/animation
metadata. `workflow.html` provides the implemented rich rendering independently.
Regeneration updates the HTML file; reopen/reload an already open preview.

Animation demonstrates data direction. There is no real HRMS connection and no
invented employee activity, transaction counters, or success status. To add real
telemetry later, define an authenticated event API (event ID, source, target,
timestamp, status, correlation ID), map events to allowed edges, deduplicate,
reconnect, and visibly distinguish connected/stale/offline states. Do not expose
employee personal data in animation events.

## Verification

Check unique node IDs, valid arrow endpoints, nonempty titles/icons/labels and
positive dimensions. Exercise both `draw-hrms` and natural-language generation.
Ensure unrelated words containing `hr` do not select HRMS. Check keyboard
selection, pause/reset and responsive horizontal scrolling in a browser when
browser tooling is available.
