# RuangNalar — Design Direction

**Status:** Active product direction  
**Design language:** Navy-led academic editorial  
**Product:** RuangNalar (RuNa), an Indonesian learning workspace for students

## Identity

RuNa should feel like a contemporary academic reading room crossed with a carefully edited scientific field journal. It is thoughtful, precise, calm, and curious. It should feel designed for learning, not like a generic SaaS admin dashboard.

The interface should communicate that knowledge is organized, connected, and worth spending time with. The brand character comes from editorial composition, information hierarchy, scientific notation, and a restrained material palette—not from decorative gradients or a pile of cards.

## Brand palette

Use these as the core identity colors:

- **RuNa Navy** `#172B3A` — dominant structural color for the sidebar, selected navigation, important headings, hero surfaces, and key framing.
- **RuNa Teal** `#31AAA9` — functional accent for active states, progress, links, and primary interactive emphasis.
- **RuNa Cream** `#F8E0A4` — sparing highlight for annotations, study cues, and important notes.
- **RuNa Maroon** `#6C1A1A` — rare emphasis for warnings, important distinctions, or editorial marks.
- **Warm Paper** `#FAF9F6` — low-glare reading surface.
- **Ink** `#243846` — body text on light surfaces.
- **Muted Ink** `#687985` — secondary text, labels, metadata.
- **Line** `#DFE7E8` — quiet separators.

Navy dominance means it anchors the composition and navigation; it does not mean every reading surface is dark. Long-form learning content stays on warm paper for sustained readability. Do not introduce unrelated purple, electric blue, or rainbow palettes.

## Typography

- **Lora** for editorial display headings and long-form learning titles.
- **Inter** for interface text, navigation, metadata, controls, and dense information.
- Use the existing Adumu brand asset only where it is already part of the approved logo/wordmark. Do not recreate or approximate the logo with a generic text treatment.
- Establish hierarchy through scale, weight, measure, and spacing. Avoid making every label uppercase or every heading oversized.

## Composition and layout

- Prefer editorial asymmetry and clear reading order over repetitive equal-sized card grids.
- Use numbered section markers, fine rules, small metadata, and deliberate alignment to make dense information navigable.
- Cards are appropriate when they represent distinct objects or actions (a file, a course, a topic, a saved handout). Do not wrap every paragraph or section in a card.
- Use the woven-grid motif only as a recognizable RuNa identity detail in the hero or a small number of intentional surfaces. It must not become a generic full-page technical grid.
- Keep the existing sidebar navigation model. The library may use a hybrid list/grid composition with balanced density.
- Use mostly flat surfaces. Reserve shadows and larger radii for elements that genuinely need elevation or grouping.

## Interaction

- Teal indicates actionable or selected states; navy provides structural contrast.
- Controls need visible hover, focus-visible, active, disabled, loading, empty, and error states where applicable.
- Keyboard operation and readable contrast are required.
- Respect reduced-motion preferences. Motion should clarify state changes, not decorate the page.
- Maintain usable responsive behavior from narrow mobile screens through wide desktop layouts.

## Voice and copy

Write in clear, direct Indonesian. Prefer specific labels that describe the action or learning purpose. Avoid inflated claims, generic motivational slogans, and invented metrics.

## Non-negotiable product constraints

- Preserve all existing functionality, data flows, APIs, database behavior, authentication, routes, and existing reader/Practice/Exam behavior during visual work.
- Do not change handout renderer or handout CSS as part of a dashboard-only visual refresh.
- Do not fabricate course progress, counts, testimonials, or learning outcomes.
- Do not change the approved logo, brand name, or existing content to fit a visual concept.

## Design Read

- **ENERGY:** composed, intellectually curious, quietly confident.
- **RHYTHM:** editorial pacing; a few strong moments separated by calm, readable stretches.
- **MOTION:** restrained and purposeful; state transitions only, with reduced-motion support.

## Acceptance test

If the RuNa logo and name were removed, the combination of navy framing, warm paper, editorial typography, scientific information hierarchy, and restrained woven motif should still feel like a coherent academic product—not a generic SaaS dashboard.
