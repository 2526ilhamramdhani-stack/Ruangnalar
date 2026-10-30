# RuangNalar — Phase One Technical Audit

**Audit date:** 2026-10-30  
**Repository:** `2526ilhamramdhani-stack/Ruangnalar`  
**Audited baseline:** `e2335dab320b9e7736e5ee23b720d9c42cf76ef2` (branch `main`)  
**Scope:** Repository structure, source code, API handlers, SQL migrations, setup documentation, Vercel configuration, and latest GitHub Actions result.

> This is a repository-level static audit. No production database, Vercel environment variables, or private service credentials were accessed. Runtime behavior against live Supabase/Gemini services has not been independently verified.

## Executive summary

RuNa has progressed beyond the original static prototype. The current repository contains a Vercel static frontend, three serverless API handlers, a Gemini-based Handout generator, Supabase-backed content persistence, four additive SQL migrations, and a CI workflow. The latest recorded CI run on the audited `main` commit completed successfully.

However, the product is **not yet ready to be treated as a complete student learning platform**. Student authentication and progress endpoints are not implemented; assessment remains a frontend demo; and the public content API returns question records containing answer data. Security hardening and integration tests should precede a broad student launch.

## Repository inventory

- `index.html`: single-page frontend and the majority of UI/client logic.
- `api/admin-auth.js`: Admin password login and signed HTTP-only cookie session.
- `api/content.js`: Admin-protected content writes and public published-content reads via Supabase service role.
- `api/generate-content.js`: Admin-protected Gemini Handout generation and structural validation.
- `supabase/migrations/`: four migrations for learning content, subject/status fields, author metadata, student progress, Handout sections, and archive metadata.
- `docs/ADMIN-AI-SETUP.md`: Admin, Gemini, Supabase, and migration setup guidance.
- `build.js` / `vercel.json`: static build and Vercel deployment configuration.
- `.github/workflows/ci.yml`: build, syntax, and source-invariant checks.

## Existing capabilities observed in source

- Five subject slugs: Matematika Wajib, Matematika Lanjut, Kimia, Fisika, and Fiqih.
- Admin login backed by `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET`, with an eight-hour HMAC-signed HTTP-only cookie.
- Admin-only content create/update/delete paths in `api/content.js`.
- Public reads filtered to `published = true` and `status = 'published'`.
- Gemini draft generation with a 50,000-character source-text limit.
- Handout structure validation, including two practice modules of ten questions each and five answer options per question.
- Structured Handout section persistence in `handout_sections`.
- Additive database schema for student profiles, learning progress, Handout sections, and archive metadata.
- Existing formative/summative timer constants are present in frontend product-invariant checks (30 and 45 minutes respectively).

## Findings and priorities

### HIGH

1. **Published content API exposes question answer fields.**  
   `GET /api/content` selects and returns the `questions` JSON field for every published item. The generator stores `answerIndex` and explanations in those question objects. A second exposure path also exists: the endpoint returns complete `handoutSections.body` values, including `practice_module` question objects that contain `answerIndex` and explanations. The public frontend currently renders those fields as visible answer/review material. Therefore, callers can inspect the key directly in both the legacy question field and structured Handout modules before attempting a question.  
   **Recommended action:** design a versioned learner payload that contains question text/options only, then add an authenticated or otherwise abuse-resistant submission/review endpoint that validates answers server-side and returns feedback only after submission. Migrate the frontend to that contract before stripping answer data from public responses; do not simply remove fields and silently break the current Handout experience. Preserve Admin preview access to full keys.

2. **Admin login and AI generation have no application-level rate limiting.**  
   The setup documentation explicitly records the lack of dedicated rate limiting. The password endpoint can be repeatedly attempted, and authenticated AI generation can incur provider usage/cost. A per-instance in-memory counter would not be reliable on serverless deployments.  
   **Recommended action:** add shared edge/server-side throttling and abuse controls, with safe handling that does not lock out the legitimate owner unexpectedly. Verify Vercel/platform limits rather than assuming they exist.

3. **Student identity and progress are schema foundations, not a working student account feature.**  
   Migration 300 creates `student_profiles` and `learning_progress` with RLS, but the documentation confirms that student signup/login UI and bearer-token-verified progress endpoints are not implemented. Authenticated users are granted read-only access to these tables; writes are intentionally server-mediated.  
   **Recommended action:** implement Supabase Auth, profile lifecycle, token verification, owner-scoped progress endpoints, and integration tests before advertising student accounts or cross-device progress.

4. **Assessment integrity is not yet server-enforced.**  
   The repository documentation and frontend structure identify the quiz/exam as client-side/demo behavior. No server-side attempt/submission/scoring endpoint was found in the current API inventory. Client-only timers and scores must not be used as official assessment records.  
   **Recommended action:** implement server-created attempts, server-validated submissions, duplicate-submission protection, authoritative timing, and server-side scoring before official use.

### MEDIUM

5. **README is stale and conflicts with the current codebase.**  
   The README still describes the package as a front-end prototype with no real login, database, or live AI connection, while the repository now includes Admin APIs, Supabase content persistence, Gemini generation, and migrations. This can mislead future contributors and deployment operators.  
   **Recommended action:** update README to describe the actual current architecture and clearly distinguish implemented features from remaining gaps.

6. **Documentation and runtime Gemini model defaults differ.**  
   `docs/ADMIN-AI-SETUP.md` describes `gemini-2.5-flash-lite`, while `api/generate-content.js` currently defaults to `gemini-3.5-flash-lite`. The model's availability has not been verified as part of this static audit.  
   **Recommended action:** choose one verified model identifier and keep code, documentation, and deployment guidance aligned.

7. **Handout persistence spans multiple REST calls and is not transactional.**  
   Content rows and Handout sections are saved in separate requests. The API does avoid publishing until section writes succeed, which is a useful safeguard, but partial draft/section updates can remain if a later request fails.  
   **Recommended action:** consider a single database RPC/transaction for content plus sections, or retain the current safe draft-first flow with explicit recovery and retry behavior.

8. **Automated checks validate syntax and source invariants, not end-to-end behavior.**  
   CI builds the static site, checks Node/inline JavaScript syntax, and verifies selected strings/schema files. It does not exercise login, Supabase permissions, Gemini response validation, publishing, answer visibility, or assessment flows.  
   **Recommended action:** add unit tests for API validators and auth, then integration tests against isolated Supabase test infrastructure and browser-level journey tests.

9. **Frontend architecture is concentrated in one large HTML file.**  
   The current `index.html` is approximately 144 KB and contains styles, markup, and client logic. This increases change risk and makes isolated component testing difficult.  
   **Recommended action:** refactor incrementally into maintainable modules/components only after establishing regression coverage; do not rewrite the app wholesale.

10. **File ingestion is PDF-text oriented.**  
    Setup documentation says PDF.js extracts text in the browser; scanned PDFs need OCR, and DOCX/PPTX are not supported. There is no verified secure multi-format ingestion pipeline.  
    **Recommended action:** keep the UI and documentation explicit about supported formats until extraction, size/MIME validation, storage, and failure cases are tested.

11. **Student profile schema is narrower than the target product profile.**  
    The current table stores `display_name` and timestamps only; avatar, education level, and grade/class fields from the product requirements are not present.  
    **Recommended action:** add only the profile fields needed by the product, with privacy-minimizing validation and migration compatibility.

### LOW

12. **Admin cookie parsing previously handled malformed values inconsistently.**  
    At the audited baseline, `api/admin-auth.js` decoded the cookie without a local try/catch, while the other API handlers handled decode errors. A malformed cookie could cause an avoidable server error, but this did not appear to bypass authentication. A fix and regression tests are now proposed separately in PR #4.  
    **Recommended action:** merge only after CI confirms the regression tests pass.

13. **Build script deletes and recreates `dist/`.**  
    This is normal for a generated output directory, but contributors should not store source assets or user files there.  
    **Recommended action:** keep `dist/` generated-only and document this behavior.

## Positive controls already present

- Service-role key is read server-side and is not part of the browser bundle in the inspected source.
- Admin writes require a signed session.
- Admin cookie uses `HttpOnly`, `Secure`, and `SameSite=Strict`.
- Database migrations revoke direct browser table access and enable RLS on student/profile/progress and archive/Handout tables.
- Progress writes are intentionally not granted directly to authenticated clients, avoiding client-submitted grades before a trusted scoring endpoint exists.
- AI output is treated as a draft and the documented workflow requires Admin review before publication.
- CI's latest run for the audited `main` commit (`e2335dab`) completed with conclusion `success`.

## Recommended implementation order

1. Design a safe question delivery/submission contract that accounts for both `learning_contents.questions` and nested `handout_sections.body` practice modules; keep full answer data available only to Admin.
2. Add shared rate limiting and harden Admin auth/session handling.
3. Update README and deployment/model documentation.
4. Implement Supabase student authentication and owner-scoped profile/progress APIs.
5. Implement server-authoritative formative/summative assessment attempts and scoring.
6. Add API unit tests, database integration tests, and browser journey tests.
7. Improve transactional reliability for content and Handout section persistence.
8. Refactor frontend modules incrementally with regression coverage.
9. Expand validated file ingestion only when the complete pipeline is ready.

## Verification status

| Check | Status |
|---|---|
| Repository tree and source inspection | COMPLETED |
| API and migration static review | COMPLETED |
| Latest GitHub Actions run for audited commit | COMPLETED — SUCCESS |
| Local build executed in this audit session | NOT RUN |
| Live Supabase schema and RLS verified | NOT VERIFIED — requires project access |
| Live Vercel environment variables verified | NOT VERIFIED — requires project access |
| Live Gemini generation verified | NOT VERIFIED — requires configured credentials |
| Browser end-to-end tests | NOT RUN |
| Production readiness | NOT ESTABLISHED |

## Owner access still required

- Supabase project access to verify applied migrations, RLS behavior, and existing data safely.
- Vercel project access to verify environment variables and deployment target.
- No secrets should be shared in chat or committed to GitHub. Use the hosting provider's secret manager.
- Production database changes, data deletion, and production deployment remain subject to explicit owner approval.
