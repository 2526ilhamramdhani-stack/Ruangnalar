# RuangNalar — Secure Practice and Assessment Contract

**Status:** Design proposal; not implemented  
**Updated:** 2026-10-30  
**Related audit:** [TECHNICAL-AUDIT.md](./TECHNICAL-AUDIT.md)

This document defines the safe migration path for practice questions and formal assessments. It intentionally does not change the current public API or database. The current public content response exposes answer data in both legacy question records and structured practice-module sections; the frontend also uses those fields to render review material. Removing the fields before replacing that experience would break learning feedback.

## 1. Security objectives

1. Public lesson delivery must never contain `answerIndex`, correct-answer values, or answer explanations for questions that students have not submitted.
2. Admin preview and editing must retain access to complete question data.
3. Practice mode may return immediate correctness and explanation after a student submits an answer.
4. Formative and summative assessment must not return per-question answer feedback before the attempt is finalized.
5. The server, not the browser, owns attempt state, deadlines, answer validation, scoring, and final result.
6. Student identity must be derived from a verified Supabase Auth access token. Never trust a client-supplied `user_id`.
7. All changes must be additive, testable, and deployable without rewriting existing Handout records.

## 2. Learner delivery projection

The public learner projection should retain the existing lesson and Handout structure, but transform question objects in both locations:

- `learning_contents.questions`
- `handout_sections.body` where `section_type = 'practice_module'` and `body.questions[]`

Allowed learner fields:
- stable question identifier (generated deterministically or stored with the question);
- question text;
- answer options;
- concept/topic label;
- difficulty label;
- optional image/media references that are safe for public delivery.

Fields that must not be present in learner delivery:
- `answerIndex`, `correctAnswer`, `correctOption`, or equivalent aliases;
- answer explanation or solution steps that reveal the answer;
- internal grading metadata or answer-specific hints.

Admin requests (`?admin=1`) remain authenticated and may receive full records for editing. Public and Admin projections should be separate functions with unit tests; do not rely on CSS or client-side hiding.

## 3. Practice answer feedback contract

Suggested endpoint: `POST /api/practice/answer`

Request:
```json
{
  "contentId": "uuid",
  "modulePosition": 10,
  "questionId": "stable-question-id",
  "selectedOption": 2
}
```

Requirements:
- Require a valid Supabase Auth bearer token and verify it with Supabase Auth on the server.
- Load the published question and its answer key from the database using the server-side service role.
- Validate that the content is published, the module belongs to that content, and the selected option is within the available options.
- Return only after the submission has been accepted:
  ```json
  {
    "accepted": true,
    "correct": false,
    "explanation": "..."
  }
  ```
- Store the student's attempt/progress server-side, with ownership derived from the verified token.
- Decide explicitly whether practice allows retry; do not infer it from the client.
- Apply shared rate limits and duplicate-submission semantics. A client retry after a network timeout should not create duplicate records.

Practice feedback is intentionally more permissive than exam feedback: immediate correctness is a learning feature, not a secure exam score.

## 4. Formal assessment contract

Suggested endpoints:
- `POST /api/assessments/attempts` — create an attempt.
- `POST /api/assessments/attempts/:id/submit` — finalize an attempt.
- `GET /api/assessments/attempts/:id/result` — read the finalized result for its owner.

At attempt creation, the server must:
- verify the student identity;
- validate the assessment type and configured question count;
- select and snapshot the questions and answer key server-side;
- set `started_at`, `expires_at`, and the allowed duration server-side;
- persist the attempt before returning a client-safe question payload;
- return only question text and options, never answer keys.

At submission, the server must:
- verify the attempt belongs to the authenticated student;
- reject attempts that are already finalized;
- enforce `expires_at` using server time (not a client timer);
- validate answer IDs/options and reject unknown or duplicate question IDs;
- compute the score from the stored server-side snapshot;
- persist the final answers, score, and completion time atomically;
- return a receipt/result without exposing keys for unrelated questions.

Expected product defaults:
- Formative: 10 questions, 30 minutes.
- Summative: 15 questions, 45 minutes.

A timeout must be finalized by server logic even if the browser closes. Use a scheduled worker/cron where available and also finalize expired attempts on the next authenticated read or submit request; unanswered items count as blank. A client timer is presentation only.

## 5. Data model direction

Prefer dedicated tables over storing official exam answers in a generic progress JSON blob.

Potential additive tables:
- `assessment_attempts`: `id`, `user_id`, `assessment_type`, `subject_id`, `content_id`, `status`, `question_snapshot`, `started_at`, `expires_at`, `submitted_at`, `score`, `created_at`.
- `assessment_answers`: `id`, `attempt_id`, `question_id`, `selected_option`, `is_correct`, `answered_at`; unique `(attempt_id, question_id)`.

For practice, either use a separate `practice_attempts` table or extend the progress model with a carefully constrained answer-history structure. Do not mix official exam scoring with self-reported client progress.

Database requirements:
- foreign keys and unique constraints for idempotency;
- RLS enabled;
- students may read only their own learner-safe attempt snapshots and permitted results;
- answer-key snapshots live in a separate server-only table (or equivalent private storage) with no student SELECT policy or grant;
- student-readable answer rows must not expose per-question correctness before finalization;
- writes remain server-mediated until the API has complete validation;
- service-role credentials never enter browser code;
- use a database transaction/RPC for final submission and scoring to avoid partial results.

The exact schema must be checked against existing project migrations before implementation. No migration in this design document has been applied to Supabase.

## 6. Migration and rollout sequence

1. Add pure projection and validation helpers with unit tests. Test nested `practice_module` payloads as well as legacy `questions`.
2. Add additive database migration(s) and test them in an isolated Supabase project.
3. Implement token verification and owner-scoped practice/assessment APIs.
4. Implement server-side attempt creation, expiry, idempotent submission, and scoring.
5. Update the frontend to use the new learner payload and submission endpoints.
6. Verify Admin preview still shows complete answer keys.
7. Verify public JSON responses contain no answer keys or revealing explanations at every nested path.
8. Run browser journeys for practice, formative, summative, refresh, timeout, duplicate submission, and cross-user access.
9. Deploy to Preview, apply migrations only to the test database, and obtain owner approval before production migration/deploy.
10. Only after all checks pass, remove legacy public answer fields and mark the old client-side scoring path deprecated.

## 7. Acceptance criteria

- Anonymous requests cannot read answer keys from either question storage path.
- Authenticated students receive only the learner-safe question projection.
- Students cannot read answer-key snapshots through table queries, RPCs, or result endpoints before allowed review.
- Admin can still preview/edit complete Handout content.
- Practice answer feedback is computed by the server and tied to the verified student.
- Formal assessments use server-generated attempts and server-side deadlines/scoring.
- A student cannot read or submit another student's attempt.
- Duplicate and late submissions are handled deterministically.
- Tests cover malformed payloads, invalid tokens, answer enumeration controls, cross-user access, time expiry, and database transaction failure.
- Existing published Handouts remain readable during the migration and are not silently deleted or rewritten.

## 8. Explicit non-goals

- This design does not claim that current practice or assessment behavior is secure.
- It does not introduce anonymous cookie-based scoring as a substitute for student identity.
- It does not move answer keys into another public endpoint.
- It does not apply migrations, change Supabase data, or deploy production code.
