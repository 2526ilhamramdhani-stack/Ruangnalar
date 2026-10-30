const test = require('node:test');
const assert = require('node:assert/strict');
const { validQuestion, validateHandout } = require('../api/generate-content');

function makeQuestion() {
  return {
    question: 'Berapakah 2 + 2?',
    options: ['1', '2', '3', '4', '5'],
    answerIndex: 3,
    explanation: 'Dua ditambah dua sama dengan empat.'
  };
}

function makeHandout(slideCount = 5) {
  const requiredSections = [
    'overview', 'mindmap', 'real_world', 'slides', 'cheatsheet',
    'mnemonic', 'encouragement', 'question_types', 'question_ideas', 'sources'
  ];
  const sections = Object.fromEntries(requiredSections.map(key => [key, {}]));
  sections.slides = { slides: Array.from({ length: slideCount }, (_, i) => ({ title: 'Slide ' + (i + 1) })) };
  sections.sources = { references: [] };
  return {
    sections,
    practiceModules: Array.from({ length: 2 }, (_, i) => ({
      title: 'Modul ' + (i + 1),
      questions: Array.from({ length: 10 }, makeQuestion)
    }))
  };
}

test('accepts a valid five-option multiple-choice question', () => {
  assert.equal(validQuestion(makeQuestion()), true);
});

test('rejects a question with an invalid answer index', () => {
  assert.equal(validQuestion({ ...makeQuestion(), answerIndex: 5 }), false);
});

test('accepts a complete Handout with five slides and two ten-question modules', () => {
  assert.equal(validateHandout(makeHandout(5)), null);
});

test('reports the actual five-slide minimum when the Handout has too few slides', () => {
  assert.equal(validateHandout(makeHandout(4)), 'Handout harus memiliki minimal 5 slide materi.');
});

test('rejects a practice module that does not contain ten questions', () => {
  const draft = makeHandout(5);
  draft.practiceModules[0].questions.pop();
  assert.match(validateHandout(draft), /harus berisi tepat 10 soal/);
});

test('rejects a question that does not have exactly five options', () => {
  assert.equal(validQuestion({ ...makeQuestion(), options: ['A', 'B', 'C', 'D'] }), false);
});

test('rejects a Handout when a required section is missing', () => {
  const draft = makeHandout(5);
  delete draft.sections.mindmap;
  assert.match(validateHandout(draft), /mindmap/);
});
