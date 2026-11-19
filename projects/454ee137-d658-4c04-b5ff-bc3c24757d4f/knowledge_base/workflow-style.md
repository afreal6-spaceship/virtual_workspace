# Workflow style contract

Read this file on every workflow request, including generation, import and rendering.
The CLI reads it at runtime; AGENTS.md requires agents to read it before edits.

- Output a semantic spec only: version, title, actors, modules containing ordered
  steps, and typed flows. Never put x/y, width/height or path coordinates in the spec.
- Each module contains at most four steps; prefer three or four. Each step has a
  globally unique id, a meaningful label, and a locally bundled Lucide SVG icon name.
- Render modules as dashed rounded containers on a dark canvas with clear titles.
  Steps are actual children, with an SVG icon above a short label. Actors are outside.
- Derive seq flows automatically between adjacent ordered steps. Explicit flow
  endpoints reference step or actor IDs, never nonexistent or ambiguous IDs.
- Flow colors: main orange (#fb9062), seq blue (#7db8ff), feedback grey (#929ba7),
  output green (#72cc95). Every flow has dashed stroke, source dot and target arrow.
- Use hierarchical ELK layered layout: lay out children within modules, then modules
  and actors by forward dependencies. Stagger modules without reversing main flow.
  Feedback does not affect forward rank; route it back around the outer perimeter.
- Keep coordinates in renderer/layout output only. Bind connectors to current shape
  bounds; dragging a module moves its children and recomputes attached paths. Step
  dragging remains inside its parent. Provide keyboard movement and layout reset.
- Animate stroke-dashoffset, expose pause/play and respect reduced motion.
- Validate all endpoints, unique IDs, icon existence, types, module size, main-flow
  acyclicity, and participation of every step (including automatic seq connections).
- Animation is illustrative, not real HRMS activity. Do not claim telemetry without
  a real event source. Preserve semantic specs independently from renderer state.

Reference: MLOps diagram supplied in the conversation. Use its visual language,
not its domain labels. The newest pasted_image.png may instead show the old board.
ELK docs: https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html
Lucide license: https://lucide.dev/license (bundled license retained).
