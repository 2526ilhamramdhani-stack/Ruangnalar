const crypto = require('node:crypto');

const COOKIE_NAME = 'ruangnalar_admin';
const SUBJECT_LABELS = {
  'matematika-wajib': 'Matematika Wajib',
  'matematika-lanjut': 'Matematika Lanjut',
  kimia: 'Kimia',
  fisika: 'Fisika',
  fiqih: 'Fiqih'
};

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function isAuthenticated(req) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) return false;
  const cookie = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE_NAME + '='));
  if (!cookie) return false;
  let token;
  try { token = decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1)); } catch { return false; }
  const dot = token.lastIndexOf('.');
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return false;
  const expiresAt = Number(payload);
  return Number.isSafeInteger(expiresAt) && expiresAt > Math.floor(Date.now() / 1000);
}
function validQuestion(question) {
  if (!question || typeof question.question !== 'string' || !Array.isArray(question.options) || question.options.length !== 5) return false;
  const answerIndex = typeof question.answerIndex === 'string' && question.answerIndex.trim() !== '' ? Number(question.answerIndex) : question.answerIndex;
  return Number.isInteger(answerIndex) && answerIndex >= 0 && answerIndex <= 4 &&
    typeof question.explanation === 'string' && question.question.trim().length > 0 &&
    question.options.every(option => typeof option === 'string' && option.trim().length > 0);
}
function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function validateHandout(draft) {
  const requiredSections = ['overview','mindmap','real_world','slides','cheatsheet','mnemonic','encouragement','question_types','question_ideas','sources'];
  if (!isObject(draft.sections)) return 'Bagian Handout terstruktur belum tersedia.';
  for (const key of requiredSections) if (!isObject(draft.sections[key])) return 'Bagian Handout wajib belum lengkap: ' + key + '.';
  if (!Array.isArray(draft.sections.slides.slides) || draft.sections.slides.slides.length < 3) return 'Handout harus memiliki minimal 3 slide materi.';
  if (!Array.isArray(draft.sections.sources.references)) return 'Daftar sumber harus berupa array.';
  if (!Array.isArray(draft.practiceModules) || draft.practiceModules.length !== 2) return 'AI harus menghasilkan tepat dua modul latihan awal.';
  for (let i = 0; i < draft.practiceModules.length; i++) {
    const module = draft.practiceModules[i];
    if (!isObject(module) || !Array.isArray(module.questions) || module.questions.length !== 10) return 'Modul latihan ' + (i + 1) + ' harus berisi tepat 10 soal.';
    if (!module.questions.every(validQuestion)) return 'Setiap soal harus memiliki lima opsi A–E, answerIndex 0–4, dan pembahasan.';
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method tidak diizinkan.' });
  }
  if (!isAuthenticated(req)) return send(res, 401, { error: 'Sesi Admin tidak valid. Silakan masuk kembali.' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return send(res, 503, { error: 'AI belum dikonfigurasi. Tambahkan GEMINI_API_KEY di Vercel.' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 160) : '';
  const topic = typeof body?.topic === 'string' ? body.topic.trim().slice(0, 100) : '';
  const subjectId = typeof body?.subjectId === 'string' ? body.subjectId : 'matematika-wajib';
  const subject = SUBJECT_LABELS[subjectId];
  const sourceText = typeof body?.sourceText === 'string' ? body.sourceText.trim() : '';
  if (!subject) return send(res, 400, { error: 'Pilih mata pelajaran yang valid.' });
  if (!title || !sourceText) return send(res, 400, { error: 'Judul dan teks materi wajib diisi.' });
  if (sourceText.length > 50000) return send(res, 413, { error: 'Teks materi terlalu panjang. Batas saat ini 50.000 karakter.' });
  const model = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
  if (!/^gemini-[a-zA-Z0-9.-]+$/.test(model)) return send(res, 503, { error: 'Nilai GEMINI_MODEL tidak valid. Gunakan nama model Gemini yang tersedia.' });

  // Canonical generation contract: every uploaded source follows this same Handout structure.
  const systemInstruction = [
    'Kamu adalah tim penyusun materi dan pengajar SMA berbahasa Indonesia yang teliti.',
    'Dokumen Admin adalah sumber utama. Jangan mengarang fakta, rumus, kutipan, halaman, atau sumber internet.',
    'Jika sumber tidak cukup, jelaskan keterbatasannya dan tandai untuk ditinjau Admin.',
    'Keluaran adalah DRAF untuk ditinjau dan diedit Admin, tidak pernah otomatis benar atau otomatis terbit.',
    'Gunakan bahasa komunikatif, runtut, pedagogis, definisikan istilah, jelaskan langkah demi langkah, sertakan miskonsepsi umum.',
    'Kembalikan JSON valid saja tanpa markdown atau teks di luar JSON.'
  ].join(' ');

  const prompt = `Buat Handout Pintar lengkap untuk materi SMA. Standar ini WAJIB dipakai setiap kali Admin mengunggah sumber materi.

KONTEKS
Mata pelajaran: ${subject}
Judul: ${title}
Topik: ${topic}

STRUKTUR OUTPUT WAJIB
draft berisi summary (string), keyPoints (array string), example (string), sections (object), practiceModules (array tepat 2), dan questions (gabungan 20 soal untuk kompatibilitas).

sections wajib memiliki:
1. overview: {summary, learningObjectives: string[], prerequisites: string[], topicMap: string[]}
2. mindmap: {centralConcept, branches: [{title, concepts: string[], connections: string[]}], textAlternative}
3. real_world: {examples: [{title, context, explanation, takeaway}]}
4. slides: {slides: [{title, learningGoal, explanation, workedExample, visualSuggestion, commonMistake, checkForUnderstanding}]}. Minimal 5 slide bermakna, penjelasan mendalam dan bukan sekadar bullet pendek. Jangan mengarang rumus/angka yang tidak didukung atau tidak dapat diverifikasi.
5. cheatsheet: {keyConcepts: [{concept, rule, whenToUse, caution}], formulas: [{formula, meaning, conditions}], quickReview: string[]}. Untuk bidang non-kuantitatif, gunakan aturan/konsep yang relevan dan jangan memaksakan rumus.
6. mnemonic: {items: [{mnemonic, meaning, usage, limitation}]}. Jika tidak cocok, berikan strategi mengingat yang alami.
7. encouragement: {message, arabicPhrase, transliteration, meaning, attributionNote}. Ungkapan Arab opsional; jangan mengatribusikan kutipan agama tanpa sumber yang pasti.
8. question_types: {types: [{name, conceptTested, recognitionClues, solvingStrategy, commonErrors}]}
9. question_ideas: {ideas: [{coreConcept, variation, reasoningPath, prerequisiteKnowledge}]}
10. sources: {primarySourceDescription, references: [{title, publisher, url, accessedAt, usageNote, sourceType}], limitations: string[]}. Dokumen Admin adalah sumber utama. Referensi eksternal hanya dicantumkan jika benar-benar tersedia; jangan mengarang URL atau mengklaim browsing yang tidak dilakukan.

SOAL WAJIB
practiceModules berisi tepat 2 modul. Tiap modul {title, learningFocus, difficulty, questions:[10 soal]}.
Setiap soal berupa {question, options, answerIndex, explanation, concept, difficulty, sourceNote}.
- options tepat 5 string dalam urutan A, B, C, D, E.
- answerIndex integer 0–4.
- explanation menjelaskan alasan dan langkah berpikir, bukan hanya mengulang jawaban.
- concept menyebut konsep yang diuji.
- difficulty salah satu: dasar, menengah, lanjut.
- sourceNote mengaitkan soal dengan sumber Admin; sintesis AI tambahan harus ditandai untuk ditinjau.
- Variasikan penalaran, bukan sekadar mengganti angka. Distraktor masuk akal tetapi salah.
- Hanya satu jawaban terbaik. Periksa ulang opsi, kunci, perhitungan, dan pembahasan.
- Kesulitan konsisten dengan tujuan belajar dan materi. Jika sumber tidak cukup, jangan mengarang; catat keterbatasan untuk Admin.

Jangan hilangkan struktur wajib walaupun sumber pendek. Bagian yang tidak dapat disimpulkan harus berisi catatan keterbatasan yang jelas. Keluaran hanya JSON valid.

SUMBER MATERI ADMIN:
${sourceText}`;

  try {
    const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.25, maxOutputTokens: 20000 }
      })
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      const message = data?.error?.message || 'Penyedia AI mengembalikan kesalahan.';
      if (upstream.status === 429) return send(res, 429, { error: 'Kuota gratis Gemini sedang habis atau batas permintaan tercapai. Tunggu sebentar lalu coba lagi. Detail: ' + message.slice(0, 250) });
      if (upstream.status === 400 || upstream.status === 403) return send(res, 502, { error: 'Gemini menolak permintaan. Periksa GEMINI_API_KEY, akses model, dan pengaturan API di Google AI Studio. Detail: ' + message.slice(0, 250) });
      return send(res, 502, { error: ('Layanan Gemini gagal: ' + message).slice(0, 500) });
    }
    const candidate = data?.candidates?.[0];
    const outputText = (candidate?.content?.parts || []).map(part => part.text || '').join('\n').trim();
    if (!outputText) {
      const reason = candidate?.finishReason ? ' Alasan: ' + candidate.finishReason + '.' : '';
      return send(res, 502, { error: 'Gemini tidak mengembalikan teks yang dapat digunakan.' + reason });
    }
    let draft;
    try { draft = JSON.parse(outputText); } catch {
      return send(res, 502, { error: 'Respons AI belum berupa JSON valid. Draf belum disimpan. Coba lagi atau kurangi panjang sumber.' });
    }
    if (!isObject(draft) || typeof draft.summary !== 'string' || !Array.isArray(draft.keyPoints) || typeof draft.example !== 'string') {
      return send(res, 502, { error: 'Struktur ringkasan kompatibilitas tidak sesuai format.' });
    }
    const validationError = validateHandout(draft);
    if (validationError) return send(res, 502, { error: 'Draf belum memenuhi standar Handout Pintar: ' + validationError + ' Draf belum disimpan; coba ulangi atau tinjau sumber.' });
    draft.practiceModules = draft.practiceModules.map(module => ({
      ...module,
      questions: module.questions.map(q => ({ ...q, answerIndex: Number(q.answerIndex) }))
    }));
    draft.questions = draft.practiceModules.flatMap(module => module.questions);
    return send(res, 200, { draft });
  } catch {
    return send(res, 502, { error: 'Tidak dapat menghubungi layanan Gemini saat ini.' });
  }
};
