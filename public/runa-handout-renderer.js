(() => {
  'use strict';

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  const arr = value => Array.isArray(value) ? value : [];
  const obj = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const textList = values => arr(values).filter(Boolean).map(value => '<li>' + esc(value) + '</li>').join('');
  const formatExplanation = value => String(value || '').split(/\n\s*\n/).map((paragraph,index) => paragraph.trim()).filter(Boolean).map((paragraph,index) => '<p' + (index === 0 ? ' class="rn-h-explanation-lead"' : '') + '>' + esc(paragraph).replace(/\n/g,'<br>') + '</p>').join('');
  const subjectLabels = {'matematika-wajib':'Matematika Wajib','matematika-lanjut':'Matematika Lanjut','kimia':'Kimia','fisika':'Fisika','fiqih':'Fiqih'};
  const slug = value => String(value || 'section').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48) || 'section';

  function render(item) {
    const sections = arr(item.handoutSections);
    if (!sections.length) return '';
    const byType = {};
    sections.forEach(section => { byType[section.section_type] = obj(section.body); });
    const subject = subjectLabels[item.subject_id] || item.subject || item.subject_id || 'Materi belajar';
    const title = item.title || 'Handout RuNa';
    const rootId = 'runa-handout-' + slug(item.id || title);
    const blocks = [];
    const toc = [];
    const add = (key, label, markup) => {
      if (!markup) return;
      const id = rootId + '-' + key;
      toc.push('<a href="#' + id + '">' + esc(label) + '</a>');
      blocks.push('<section class="rn-h-section" id="' + id + '"><div class="rn-h-section-heading"><span>' + String(toc.length).padStart(2,'0') + '</span><h3>' + esc(label) + '</h3></div>' + markup + '</section>');
    };

    const overview = byType.overview || {};
    if (overview.summary || arr(overview.learningObjectives).length || arr(overview.prerequisites).length || arr(overview.topicMap).length) {
      add('overview','Gambaran pembelajaran',
        (overview.summary ? '<p class="rn-h-lead">' + esc(overview.summary) + '</p>' : '') +
        (arr(overview.learningObjectives).length ? '<div class="rn-h-info-grid"><article class="rn-h-info-card rn-h-card-teal"><span class="rn-h-card-label">TUJUAN BELAJAR</span><ul>' + textList(overview.learningObjectives) + '</ul></article>' : '') +
        (arr(overview.prerequisites).length ? '<article class="rn-h-info-card rn-h-card-cream"><span class="rn-h-card-label">PRASYARAT</span><ul>' + textList(overview.prerequisites) + '</ul></article>' : '') +
        (arr(overview.topicMap).length ? '<article class="rn-h-info-card rn-h-card-maroon"><span class="rn-h-card-label">PETA TOPIK</span><ul>' + textList(overview.topicMap) + '</ul></article>' : '') +
        (arr(overview.learningObjectives).length || arr(overview.prerequisites).length || arr(overview.topicMap).length ? '</div>' : ''));
    }

    const mindmap = byType.mindmap || {};
    if (mindmap.centralConcept || arr(mindmap.branches).length) {
      add('mindmap','Peta konsep',
        '<div class="rn-h-mindmap"><div class="rn-h-mindmap-center">' + esc(mindmap.centralConcept || title) + '</div><div class="rn-h-mindmap-branches">' +
        arr(mindmap.branches).map(branch => '<article class="rn-h-branch"><h4>' + esc(branch.title) + '</h4><ul>' + textList(branch.concepts) + '</ul>' +
          (arr(branch.connections).length ? '<p>' + esc(branch.connections.join(' · ')) + '</p>' : '') + '</article>').join('') +
        '</div></div>' + (mindmap.textAlternative ? '<p class="rn-h-caption">' + esc(mindmap.textAlternative) + '</p>' : ''));
    }

    const real = byType.real_world || {};
    if (arr(real.examples).length) {
      add('real-world','Koneksi dengan dunia nyata',
        '<div class="rn-h-example-grid">' + arr(real.examples).map((example,index) =>
          '<article class="rn-h-example-card"><span class="rn-h-index">' + String(index+1).padStart(2,'0') + '</span><h4>' + esc(example.title) + '</h4>' +
          (example.context ? '<p class="rn-h-context">' + esc(example.context) + '</p>' : '') +
          (example.explanation ? '<p>' + esc(example.explanation) + '</p>' : '') +
          (example.takeaway ? '<div class="rn-h-takeaway"><b>Yang perlu dipahami</b><p>' + esc(example.takeaway) + '</p></div>' : '') + '</article>'
        ).join('') + '</div>');
    }

    const slideData = byType.slides || {};
    if (arr(slideData.slides).length) {
      const slides = arr(slideData.slides);
      const slideCards = slides.map((slide,index) => {
        const query = slide.visualQuery || slide.visualSuggestion || (title + ' ' + slide.title + ' ' + subject);
        return '<article class="rn-learning-slide rn-h-slide" data-slide-index="' + index + '">' +
          '<div class="rn-slide-topline"><span class="rn-slide-kicker">SUBMATERI ' + String(index+1).padStart(2,'0') + '</span><span class="rn-slide-total">BAGIAN ' + String(index+1).padStart(2,'0') + ' / ' + slides.length + '</span></div>' +
          '<div class="rn-h-slide-grid"><div class="rn-h-slide-copy">' +
          '<h4>' + esc(slide.title || ('Konsep ' + (index+1))) + '</h4>' +
          (slide.learningGoal ? '<div class="rn-slide-goal"><span class="rn-mini-label">FOKUS PEMBELAJARAN</span><p>' + esc(slide.learningGoal) + '</p></div>' : '') +
          '<div class="rn-slide-explanation">' + formatExplanation(slide.explanation) + '</div>' +
          (slide.workedExample ? '<div class="rn-slide-example"><span class="rn-mini-label">CONTOH / PENERAPAN</span><p>' + esc(slide.workedExample) + '</p></div>' : '') +
          (slide.commonMistake ? '<div class="rn-slide-mistake"><b>⚑ Perlu diperhatikan</b><p>' + esc(slide.commonMistake) + '</p></div>' : '') +
          (slide.checkForUnderstanding ? '<div class="rn-slide-check"><b>Cek pemahaman</b><p>' + esc(slide.checkForUnderstanding) + '</p></div>' : '') +
          '</div><figure class="rn-h-visual" data-rn-visual data-query="' + esc(query) + '">' +
          '<div class="rn-h-visual-placeholder"><span class="rn-h-visual-icon">✦</span><b>Ilustrasi submateri</b><p>' + esc(slide.visualPurpose || slide.visualSuggestion || 'Visual pendukung konsep') + '</p><small>Menelusuri ilustrasi berlisensi terbuka…</small></div>' +
          '</figure></div></article>';
      }).join('');
      add('slides','Materi inti',
        '<div class="rn-h-slide-intro"><p>Materi inti ini disusun sebagai satu rangkaian pembelajaran. Baca berurutan atau pilih submateri melalui navigasi di kanan atas.</p><span>' + slides.length + ' submateri</span></div>' +
        '<div class="rn-h-slide-stack">' + slideCards + '</div>');
    }

    const cheat = byType.cheatsheet || {};
    if (arr(cheat.keyConcepts).length || arr(cheat.formulas).length || arr(cheat.quickReview).length) {
      add('cheatsheet','Konsep dan rumus penting',
        (arr(cheat.keyConcepts).length ? '<div class="rn-h-key-grid">' + arr(cheat.keyConcepts).map(item =>
          '<article class="rn-h-key-card"><span class="rn-h-card-label">KONSEP</span><h4>' + esc(item.concept) + '</h4><p>' + esc(item.rule) + '</p>' +
          (item.whenToUse ? '<p class="rn-h-caption"><b>Kapan digunakan:</b> ' + esc(item.whenToUse) + '</p>' : '') +
          (item.caution ? '<p class="rn-h-caution">' + esc(item.caution) + '</p>' : '') + '</article>'
        ).join('') + '</div>' : '') +
        (arr(cheat.formulas).length ? '<div class="rn-h-formula-grid">' + arr(cheat.formulas).map(item =>
          '<article class="rn-h-formula"><div class="rn-h-formula-expression">' + esc(item.formula) + '</div><p>' + esc(item.meaning) + '</p>' +
          (item.conditions ? '<small>' + esc(item.conditions) + '</small>' : '') + '</article>'
        ).join('') + '</div>' : '') +
        (arr(cheat.quickReview).length ? '<div class="rn-h-review"><b>Ringkasan cepat</b><ul>' + textList(cheat.quickReview) + '</ul></div>' : ''));
    }

    const mnemonics = byType.mnemonic || {};
    if (arr(mnemonics.items).length) {
      add('mnemonic','Strategi mengingat',
        '<div class="rn-h-example-grid">' + arr(mnemonics.items).map(item =>
          '<article class="rn-h-example-card"><span class="rn-h-card-label">STRATEGI</span><h4>' + esc(item.mnemonic) + '</h4><p>' + esc(item.meaning) + '</p>' +
          (item.usage ? '<p><b>Penggunaan:</b> ' + esc(item.usage) + '</p>' : '') +
          (item.limitation ? '<p class="rn-h-caption">' + esc(item.limitation) + '</p>' : '') + '</article>'
        ).join('') + '</div>');
    }

    const encouragement = byType.encouragement || {};
    if (encouragement.message || encouragement.arabicPhrase) {
      add('encouragement','Penutup dan refleksi',
        '<div class="rn-h-closing">' + (encouragement.message ? '<p>' + esc(encouragement.message) + '</p>' : '') +
        (encouragement.arabicPhrase ? '<strong>' + esc(encouragement.arabicPhrase) + '</strong>' : '') +
        (encouragement.transliteration ? '<p>' + esc(encouragement.transliteration) + '</p>' : '') +
        (encouragement.meaning ? '<p>' + esc(encouragement.meaning) + '</p>' : '') +
        (encouragement.attributionNote ? '<small>' + esc(encouragement.attributionNote) + '</small>' : '') + '</div>');
    }

    const types = byType.question_types || {};
    if (arr(types.types).length) {
      add('question-types','Mengenali tipe soal',
        '<div class="rn-h-key-grid">' + arr(types.types).map(item =>
          '<article class="rn-h-key-card"><h4>' + esc(item.name) + '</h4><p><b>Konsep yang diuji:</b> ' + esc(item.conceptTested) + '</p>' +
          '<p><b>Petunjuk:</b> ' + esc(item.recognitionClues) + '</p><p><b>Strategi:</b> ' + esc(item.solvingStrategy) + '</p>' +
          (item.commonErrors ? '<p class="rn-h-caution">' + esc(item.commonErrors) + '</p>' : '') + '</article>'
        ).join('') + '</div>');
    }

    const ideas = byType.question_ideas || {};
    if (arr(ideas.ideas).length) {
      add('question-ideas','Ide pengembangan soal',
        '<div class="rn-h-example-grid">' + arr(ideas.ideas).map(item =>
          '<article class="rn-h-example-card"><span class="rn-h-card-label">IDE SOAL</span><h4>' + esc(item.coreConcept) + '</h4><p>' + esc(item.variation) + '</p>' +
          '<p><b>Alur penalaran:</b> ' + esc(item.reasoningPath) + '</p><p class="rn-h-caption">Prasyarat: ' + esc(item.prerequisiteKnowledge) + '</p></article>'
        ).join('') + '</div>');
    }

    const terminology = byType.terminology || {};
    if (arr(terminology.items).length) {
      add('terminology', terminology.title || 'Kosakata dan terminologi',
        (terminology.description ? '<p class="rn-h-lead">' + esc(terminology.description) + '</p>' : '') +
        '<div class="rn-h-term-grid">' + arr(terminology.items).map(item =>
          '<details class="rn-h-term-card"><summary><span><b>' + esc(item.term || item.word || 'Istilah') + '</b><small>' +
          esc(item.category || item.form || 'Istilah penting') + '</small></span><em>Lihat makna</em></summary><div class="rn-h-term-body">' +
          (item.meaning || item.definition ? '<p>' + esc(item.meaning || item.definition) + '</p>' : '') +
          (item.example ? '<p><b>Contoh:</b> ' + esc(item.example) + '</p>' : '') +
          (arr(item.relatedTerms).length ? '<p><b>Istilah terkait:</b> ' + esc(item.relatedTerms.join(' · ')) + '</p>' : '') +
          (item.memoryHint ? '<p class="rn-h-term-hint">' + esc(item.memoryHint) + '</p>' : '') + '</div></details>'
        ).join('') + '</div>');
    }

    const reading = byType.reading_material || {};
    if (arr(reading.passages).length) {
      add('reading-material', reading.title || 'Bacaan dan pemahaman teks',
        '<div class="rn-h-reading-list">' + arr(reading.passages).map((passage,index) =>
          '<article class="rn-h-reading-card"><span class="rn-h-card-label">BACAAN ' + String(index+1).padStart(2,'0') + '</span>' +
          '<h4>' + esc(passage.title || ('Teks ' + (index+1))) + '</h4>' +
          (passage.originalText ? '<div class="rn-h-reading-original" dir="auto">' + esc(passage.originalText).replace(/\r?\n/g,'<br>') + '</div>' : '') +
          (passage.translation ? '<details><summary>Lihat terjemahan / makna</summary><p>' + esc(passage.translation).replace(/\r?\n/g,'<br>') + '</p></details>' : '') +
          (passage.notes ? '<div class="rn-h-takeaway"><b>Catatan pemahaman</b><p>' + esc(passage.notes) + '</p></div>' : '') +
          (arr(passage.comprehensionQuestions).length ? '<div class="rn-h-reading-questions">' + arr(passage.comprehensionQuestions).map(question =>
            '<details><summary>' + esc(question.question) + '</summary><p>' + esc(question.answer) + '</p>' +
            (question.explanation ? '<small>' + esc(question.explanation) + '</small>' : '') + '</details>'
          ).join('') + '</div>' : '') + '</article>'
        ).join('') + '</div>');
    }

    const dialogues = byType.dialogues || {};
    if (arr(dialogues.items).length) {
      add('dialogues', dialogues.title || 'Dialog dan percakapan',
        '<div class="rn-h-dialogue-list">' + arr(dialogues.items).map((dialogue,index) =>
          '<article class="rn-h-dialogue-card"><span class="rn-h-card-label">DIALOG ' + String(index+1).padStart(2,'0') + '</span>' +
          '<h4>' + esc(dialogue.title || ('Percakapan ' + (index+1))) + '</h4>' +
          (dialogue.context ? '<p class="rn-h-caption">' + esc(dialogue.context) + '</p>' : '') +
          '<div class="rn-h-dialogue-lines">' + arr(dialogue.lines).map(line =>
            '<div class="rn-h-dialogue-line"><b>' + esc(line.speaker || 'Pembicara') + '</b><p dir="auto">' + esc(line.text || '') + '</p>' +
            (line.translation ? '<details><summary>Lihat terjemahan</summary><p>' + esc(line.translation) + '</p></details>' : '') +
            (line.note ? '<small>' + esc(line.note) + '</small>' : '') + '</div>'
          ).join('') + '</div></article>'
        ).join('') + '</div>');
    }

    const learningActivities = byType.learning_activities || {};
    if (arr(learningActivities.activities).length) {
      const activityMarkup = arr(learningActivities.activities).map((activity,activityIndex) => {
        const type = String(activity.type || '').toLowerCase();
        const heading = '<div class="rn-h-activity-heading"><h4>' + esc(activity.title || ('Aktivitas ' + (activityIndex+1))) + '</h4>' +
          (activity.instructions ? '<p>' + esc(activity.instructions) + '</p>' : '') + '</div>';
        if (type === 'true_false' || type === 'classification') {
          const items = arr(activity.items).map((item,index) => {
            const options = type === 'true_false' ? ['Benar','Salah'] : arr(item.options);
            const answerIndex = type === 'true_false' ? (item.answer === true ? 0 : 1) : Number(item.answerIndex);
            return '<article class="rn-h-question rn-h-activity-question" data-rn-question data-answer-index="' + answerIndex + '">' +
              '<div class="rn-h-question-meta"><span>' + esc(type === 'true_false' ? 'PERNYATAAN ' : 'KLASIFIKASI ') + String(index+1).padStart(2,'0') + '</span></div>' +
              '<h4>' + esc(item.statement || item.prompt || '') + '</h4><div class="rn-h-options">' + options.map((option,optionIndex) =>
                '<button type="button" data-rn-option="' + optionIndex + '"><span>' + String.fromCharCode(65+optionIndex) + '</span>' + esc(option) + '</button>'
              ).join('') + '</div><div class="rn-h-question-actions"><button type="button" class="rn-h-check" data-rn-check>Periksa jawaban</button><span class="rn-h-question-status" aria-live="polite"></span></div>' +
              '<div class="rn-h-feedback" data-rn-feedback hidden><b data-rn-feedback-title></b><p>' + esc(item.explanation || '') + '</p></div></article>';
          }).join('');
          return '<section class="rn-h-activity-group">' + heading + items + '</section>';
        }
        if (type === 'fill_blank') {
          const items = arr(activity.items).map((item,index) => {
            const accepted = [item.answer,...arr(item.acceptedAnswers)].filter(value => typeof value === 'string' && value.trim());
            const input = '<input type="text" data-rn-fill-input aria-label="Jawaban bagian kosong" autocomplete="off">';
            const prompt = esc(item.prompt || '').replace(/\{\{blank\}\}/g,input);
            return '<article class="rn-h-fill-question" data-rn-fill-accepted="' + esc(JSON.stringify(accepted)) + '" data-rn-fill-explanation="' + esc(item.explanation || '') + '">' +
              '<div class="rn-h-question-meta"><span>ISI BAGIAN KOSONG ' + String(index+1).padStart(2,'0') + '</span></div>' +
              '<p>' + (prompt.includes('data-rn-fill-input') ? prompt : prompt + ' ' + input) + '</p>' +
              '<div class="rn-h-question-actions"><button type="button" class="rn-h-check" data-rn-fill-check>Periksa jawaban</button><span class="rn-h-question-status" aria-live="polite"></span></div>' +
              '<div class="rn-h-feedback" data-rn-fill-feedback hidden><b data-rn-fill-title></b><p data-rn-fill-explanation-text></p></div></article>';
          }).join('');
          return '<section class="rn-h-activity-group">' + heading + items + '</section>';
        }
        if (type === 'flashcards') {
          return '<section class="rn-h-activity-group">' + heading + '<div class="rn-h-flash-grid">' + arr(activity.cards).map(card =>
            '<details class="rn-h-flashcard"><summary>' + esc(card.front || 'Kartu hafalan') + '</summary><div>' + esc(card.back || '') + '</div></details>'
          ).join('') + '</div></section>';
        }
        if (type === 'short_answer') {
          return '<section class="rn-h-activity-group">' + heading + arr(activity.items).map(item =>
            '<details class="rn-h-short-answer"><summary>' + esc(item.prompt || 'Pertanyaan refleksi') + '</summary><div><b>Contoh jawaban</b><p>' +
            esc(item.sampleAnswer || '') + '</p>' + (item.rubric ? '<small>Kriteria: ' + esc(item.rubric) + '</small>' : '') + '</div></details>'
          ).join('') + '</section>';
        }
        return '';
      }).join('');
      if (activityMarkup) add('learning-activities', 'Aktivitas belajar interaktif', activityMarkup);
    }

    const modules = sections.filter(section => section.section_type === 'practice_module');
    if (modules.length) {
      const moduleMarkup = modules.map((section,moduleIndex) => {
        const module = obj(section.body);
        const questions = arr(module.questions);
        return '<details class="rn-h-module"><summary><span><b>' + esc(module.title || ('Modul latihan ' + (moduleIndex+1))) + '</b><small>' + esc(module.learningFocus || 'Latihan pemahaman') + '</small></span><em>' + questions.length + ' soal</em></summary>' +
          '<div class="rn-h-module-body">' + questions.map((q,index) => {
            const options = arr(q.options);
            return '<article class="rn-h-question" data-rn-question data-answer-index="' + Number(q.answerIndex) + '">' +
              '<div class="rn-h-question-meta"><span>SOAL ' + String(index+1).padStart(2,'0') + '</span><span>' + esc(q.difficulty || module.difficulty || 'Latihan') + '</span></div>' +
              '<h4>' + esc(q.question) + '</h4><div class="rn-h-options">' + options.map((option,optionIndex) =>
                '<button type="button" data-rn-option="' + optionIndex + '"><span>' + String.fromCharCode(65+optionIndex) + '</span>' + esc(option) + '</button>'
              ).join('') + '</div><div class="rn-h-question-actions"><button type="button" class="rn-h-check" data-rn-check>Periksa jawaban</button><span class="rn-h-question-status" aria-live="polite"></span></div>' +
              '<div class="rn-h-feedback" data-rn-feedback hidden><b data-rn-feedback-title></b><p>' + esc(q.explanation) + '</p><small>Konsep: ' + esc(q.concept) + '</small></div></article>';
          }).join('') + '</div></details>';
      }).join('');
      add('practice','Latihan interaktif',
        '<div class="rn-h-practice-intro"><b>Uji pemahamanmu</b><p>Pilih jawaban pada setiap soal, lalu periksa untuk melihat umpan balik dan pembahasan.</p></div>' + moduleMarkup);
    }

    const sources = byType.sources || {};
    if (sources.primarySourceDescription || arr(sources.references).length || arr(sources.limitations).length) {
      add('sources','Sumber dan catatan',
        (sources.primarySourceDescription ? '<p class="rn-h-lead">' + esc(sources.primarySourceDescription) + '</p>' : '') +
        (arr(sources.references).length ? '<div class="rn-h-source-list">' + arr(sources.references).map(ref => {
          const url = typeof ref.url === 'string' && /^https?:\/\//i.test(ref.url) ? ref.url : '';
          return '<article><b>' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(ref.title || url) + '</a>' : esc(ref.title || 'Sumber tanpa tautan')) + '</b>' +
            '<span>' + esc(ref.publisher || ref.sourceType || '') + '</span>' + (ref.usageNote ? '<p>' + esc(ref.usageNote) + '</p>' : '') + '</article>';
        }).join('') + '</div>' : '') +
        (arr(sources.limitations).length ? '<div class="rn-h-review"><b>Catatan keterbatasan</b><ul>' + textList(sources.limitations) + '</ul></div>' : ''));
    }

    const header = '<header class="rn-h-header"><a class="rn-h-brand" href="#' + rootId + '-top" aria-label="RuNa — kembali ke awal handout"><img src="/runa-logo-slide7.svg" alt="Logo resmi RuNa"></a>' +
      '<div class="rn-h-title"><span>' + esc(subject) + '</span><b>' + esc(title) + '</b></div>' +
      '<div class="rn-h-progress-wrap"><span>PROGRES MEMBACA</span><div class="rn-h-progress"><i data-rn-progress></i></div></div></header>';
    const navigation = '<nav class="rn-h-toc" aria-label="Navigasi handout"><b>JELAJAHI HANDOUT</b><div class="rn-h-toc-links">' + toc.map((link,index) => link.replace('<a ', '<a data-rn-nav data-nav-index="' + index + '" ')).join('') + '</div></nav>';
    return '<div class="rn-handout" id="' + rootId + '" data-rn-handout data-subject="' + esc(subject) + '">' +
      '<div id="' + rootId + '-top"></div>' + header +
      '<div class="rn-h-layout"><div class="rn-h-content">' + navigation +
      '<section class="rn-h-cover"><span class="rn-h-eyebrow">RUANGNALAR · INTERACTIVE LEARNING HANDOUT</span><h2>' + esc(title) + '</h2>' +
      '<p>' + esc(item.summary || overview.summary || 'Pelajari materi secara bertahap melalui konsep, contoh, visual, dan latihan interaktif.') + '</p>' +
      '<div class="rn-h-cover-meta"><span>' + esc(subject) + '</span><span>Materi terstruktur</span><span>' + toc.length + ' bagian</span></div></section>' +
      blocks.join('') + '<footer class="rn-h-footer"><img src="/runa-logo-slide7.svg" alt="RuNa"><span>Belajar dengan nalar. Bertumbuh dengan konsisten.</span></footer>' +
      '</div></div></div>';
  }

  function cleanMeta(value) {
    return String(value || '').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
  }
  function allowedLicense(name) {
    return /^(CC0\b|CC BY(?:-SA)?(?:\s|$)|Public domain\b)/i.test(String(name || '').trim());
  }
  async function hydrate(root) {
    const nodes = Array.from((root || document).querySelectorAll('[data-rn-visual]:not([data-rn-loaded])'));
    await Promise.all(nodes.map(async node => {
      node.dataset.rnLoaded = '1';
      const query = String(node.dataset.query || '').trim().slice(0,180);
      if (!query) return;
      try {
        const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' +
          encodeURIComponent('filetype:bitmap ' + query) +
          '&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=1100&format=json&origin=*';
        const response = await fetch(url, {headers:{'Accept':'application/json'}});
        if (!response.ok) throw new Error('Sumber visual tidak tersedia.');
        const data = await response.json();
        const pages = Object.values(obj(data.query).pages || {});
        const candidate = pages.map(page => {
          const info = arr(page.imageinfo)[0] || {};
          const meta = obj(info.extmetadata);
          return {page,info,meta,license:cleanMeta(meta.LicenseShortName && meta.LicenseShortName.value)};
        }).find(item => item.info.thumburl && allowedLicense(item.license));
        if (!candidate) throw new Error('Belum ada aset terbuka yang cocok.');
        const info = candidate.info, meta = candidate.meta;
        const figure = document.createElement('figure');
        figure.className = 'rn-h-visual-result';
        const image = document.createElement('img');
        image.src = info.thumburl;
        image.alt = cleanMeta(meta.ObjectName && meta.ObjectName.value) || candidate.page.title.replace(/^File:/,'');
        image.loading = 'lazy';
        image.decoding = 'async';
        const caption = document.createElement('figcaption');
        const name = cleanMeta(meta.Artist && meta.Artist.value) || 'Kontributor Wikimedia Commons';
        const license = candidate.license || 'Lisensi terbuka';
        const pageLink = document.createElement('a');
        pageLink.href = info.descriptionurl || candidate.page.fullurl || 'https://commons.wikimedia.org/';
        pageLink.target = '_blank';
        pageLink.rel = 'noopener noreferrer';
        pageLink.textContent = 'Sumber: ' + name + ' · ' + license;
        caption.appendChild(pageLink);
        figure.appendChild(image);
        figure.appendChild(caption);
        node.replaceChildren(figure);
      } catch (_) {
        const placeholder = node.querySelector('.rn-h-visual-placeholder');
        if (placeholder) {
          const small = placeholder.querySelector('small');
          if (small) small.textContent = 'Visual foto belum tersedia. Gunakan diagram atau penjelasan pada materi.';
          placeholder.classList.add('is-fallback');
        }
      }
    }));
  }

  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-rn-nav]');
    if (nav) {
      const root = nav.closest('[data-rn-handout]');
      const target = root && root.querySelector(nav.getAttribute('href'));
      if (target) {
        event.preventDefault();
        target.scrollIntoView({behavior:'smooth',block:'start'});
        root.querySelectorAll('[data-rn-nav]').forEach(link => link.classList.toggle('is-active', link === nav));
      }
      return;
    }
    const fillCheck = event.target.closest('[data-rn-fill-check]');
    if (fillCheck) {
      const card = fillCheck.closest('.rn-h-fill-question');
      if (!card || card.dataset.rnAnswered === '1') return;
      const input = card.querySelector('[data-rn-fill-input]');
      const status = card.querySelector('.rn-h-question-status');
      const feedback = card.querySelector('[data-rn-fill-feedback]');
      if (!input || !input.value.trim()) { if (status) status.textContent = 'Isi jawaban terlebih dahulu.'; return; }
      let accepted = [];
      try { accepted = JSON.parse(card.dataset.rnFillAccepted || '[]'); } catch (_) {}
      const normalize = value => String(value || '').normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/\s+/g,' ').trim().toLocaleLowerCase();
      const correct = accepted.some(value => normalize(value) === normalize(input.value));
      card.dataset.rnAnswered = '1';
      input.disabled = true;
      fillCheck.disabled = true;
      fillCheck.textContent = 'Sudah diperiksa';
      if (status) status.textContent = correct ? 'Benar' : 'Perlu dipelajari';
      if (feedback) {
        feedback.hidden = false;
        feedback.classList.toggle('is-correct', correct);
        feedback.classList.toggle('is-incorrect', !correct);
        const title = feedback.querySelector('[data-rn-fill-title]');
        const explanation = feedback.querySelector('[data-rn-fill-explanation-text]');
        if (title) title.textContent = correct ? 'Tepat! Jawabanmu benar.' : 'Belum tepat. Periksa kembali materi.';
        if (explanation) explanation.textContent = (card.dataset.rnFillExplanation || '') + (accepted.length ? ' Jawaban yang diharapkan: ' + accepted[0] : '');
      }
      return;
    }
    const option = event.target.closest('[data-rn-option]');
    if (option) {
      const question = option.closest('[data-rn-question]');
      if (!question || question.dataset.rnAnswered === '1') return;
      question.querySelectorAll('[data-rn-option]').forEach(button => button.classList.toggle('is-selected', button === option));
      question.dataset.rnSelected = option.dataset.rnOption;
      return;
    }
    const check = event.target.closest('[data-rn-check]');
    if (!check) return;
    const question = check.closest('[data-rn-question]');
    if (!question || question.dataset.rnAnswered === '1') return;
    const selected = question.dataset.rnSelected;
    const feedback = question.querySelector('[data-rn-feedback]');
    const status = question.querySelector('.rn-h-question-status');
    if (selected == null) { if (status) status.textContent = 'Pilih satu jawaban terlebih dahulu.'; return; }
    const correct = Number(selected) === Number(question.dataset.answerIndex);
    question.dataset.rnAnswered = '1';
    question.querySelectorAll('[data-rn-option]').forEach(button => {
      button.disabled = true;
      if (Number(button.dataset.rnOption) === Number(question.dataset.answerIndex)) button.classList.add('is-correct');
      else if (Number(button.dataset.rnOption) === Number(selected)) button.classList.add('is-incorrect');
    });
    if (feedback) {
      feedback.hidden = false;
      const heading = feedback.querySelector('[data-rn-feedback-title]');
      if (heading) heading.textContent = correct ? 'Tepat! Jawabanmu benar.' : 'Belum tepat. Pelajari pembahasannya.';
      feedback.classList.toggle('is-correct', correct);
      feedback.classList.toggle('is-incorrect', !correct);
    }
    if (status) status.textContent = correct ? 'Benar' : 'Perlu dipelajari';
    check.disabled = true;
    check.textContent = 'Sudah diperiksa';
  });

  let progressBound = false;
  function updateProgress() {
    document.querySelectorAll('[data-rn-handout]').forEach(root => {
      const rect = root.getBoundingClientRect();
      const total = rect.height + window.innerHeight;
      const value = total > 0 ? Math.max(0,Math.min(100,((window.innerHeight - rect.top) / total) * 100)) : 0;
      const bar = root.querySelector('[data-rn-progress]');
      if (bar) bar.style.width = value + '%';
    });
  }
  if (!progressBound) {
    window.addEventListener('scroll', updateProgress, {passive:true});
    window.addEventListener('resize', updateProgress);
    progressBound = true;
  }

  window.RuNaHandoutRenderer = {render,hydrate};
})();