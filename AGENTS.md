# RuangNalar — Agent Working Agreement

## Required design workflow
- For every UI, visual, responsive, or accessibility task, read `DESIGN.md` first.
- Load `.agents/skills/antislop/SKILL.md` for every task.
- For interface work, also load `.agents/skills/antislop-ui/SKILL.md`.
- For accessibility and interaction work, load `.agents/skills/antislop-human/SKILL.md`.
- For responsive work, load `.agents/skills/antislop-layoutmobile/SKILL.md`.
- For user-facing copy, load `.agents/skills/antislop-copywriting/SKILL.md`.
- Apply the core Antislop rules during implementation and complete its Delivery Gate before calling UI work finished.

## Project safety constraints
- Preserve existing product behavior, APIs, database schema, authentication, routes, storage, and reader/Practice/Exam flows unless the task explicitly authorizes a functional change.
- Prefer small, component-scoped changes. Do not append broad global CSS overrides or use blanket `!important`.
- Do not replace existing product assets or logos with invented substitutes.
- Do not claim tests, browser checks, or visual QA that were not actually run.
- Keep changes on a feature branch until they have been reviewed and verified.

## Source of truth
- `DESIGN.md` is the visual and verbal direction for RuangNalar.
- The Antislop skill files are the quality filter; they do not override product requirements or security constraints.
