-- Extend the handout section type constraint for the optional pedagogical
-- blocks introduced by the adaptive HTML handout generator.
-- Safe to run after 20261029030000_student_progress_handouts_archive.sql.
-- Existing rows and legacy section types are preserved.

alter table public.handout_sections
  drop constraint if exists handout_sections_section_type_check;

alter table public.handout_sections
  add constraint handout_sections_section_type_check
  check (
    section_type in (
      'overview',
      'mindmap',
      'real_world',
      'slides',
      'cheatsheet',
      'mnemonic',
      'encouragement',
      'question_types',
      'question_ideas',
      'practice_module',
      'sources',
      'terminology',
      'reading_material',
      'dialogues',
      'learning_activities'
    )
  );
