const crypto = require('node:crypto');

const COOKIE_NAME = 'ruangnalar_admin';

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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method tidak diizinkan.' });
  }
  if (!isAuthenticated(req)) return send(res, 401, { error: 'Sesi Admin tidak valid. Silakan masuk kembali.' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return send(res, 503, { error: 'AI belum dikonfigurasi. Tambahkan GEMINI_API_KEY di Vercel.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 160) : '';
  const topic = typeof body?.topic === 'string' ? body.topic.trim().slice(0, 100) : '';
  const subjectId = typeof body?.subjectId === 'string' ? body.subjectId : 'matematika-wajib';
  const subjectLabels = {'matematika-wajib':'Matematika Wajib','matematika-lanjut':'Matematika Lanjut','kimia':'Kimia','fisika':'Fisika','fiqih':'Fiqih'};
  const subject = subjectLabels[subjectId];
  const sourceText = typeof body?.sourceText === 'string' ? body.sourceText.trim() : '';
  if (!subject) return send(res, 400, { error: 'Pilih mata pelajaran yang valid.' });
  if (!title || !sourceText) return send(res, 400, { error: 'Judul dan teks materi wajib diisi.' });
  if (sourceText.length > 50000) return send(res, 413, { error: 'Teks materi terlalu panjang. Batas saat ini 50.000 karakter.' });

  const model = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
  if (!/^gemini-[a-zA-Z0-9.-]+$/.test(model)) {
    return send(res, 503, { error: 'Nilai GEMINI_MODEL tidak valid. Gunakan nama model Gemini yang tersedia.' });
  }

  const prompt = 'Buat draf pembelajaran SMA berbahasa Indonesia untuk mata pelajaran ' + subject + ' berdasarkan sumber. Ini draf untuk ditinjau admin, bukan untuk langsung dipublikasikan. Gunakan hanya fakta yang didukung sumber. Jika sumber tidak cukup, nyatakan keterbatasannya. Jangan mengarang kutipan, data, rumus, atau ketentuan. Pastikan ringkasan, contoh, soal, kunci, dan pembahasan sesuai bidang ' + subject + '. Keluaran wajib berupa JSON valid dengan kunci summary (string), keyPoints (array string), example (string), questions (array tepat 5 objek; setiap objek berisi question (string), options (array tepat 4 string), answerIndex (integer 0-3), explanation (string)).\nMata pelajaran: ' + subject + '\nJudul: ' + title + '\nTopik: ' + topic + '\n\nSUMBER MATERI:\n' + sourceText;

  try {
    const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'Kamu adalah asisten penyusun materi pembelajaran SMA yang teliti untuk berbagai mata pelajaran. Jawab dalam bahasa Indonesia dan ikuti mata pelajaran yang diminta. Ikuti format json yang diminta pengguna dan jangan menambahkan teks di luar objek json.' }]
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
          maxOutputTokens: 8192
        }
      })
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      const message = data?.error?.message || 'Penyedia AI mengembalikan kesalahan.';
      if (upstream.status === 429) {
        return send(res, 429, { error: 'Kuota gratis Gemini sedang habis atau batas permintaan tercapai. Tunggu sebentar lalu coba lagi. Detail: ' + message.slice(0, 250) });
      }
      if (upstream.status === 400 || upstream.status === 403) {
        return send(res, 502, { error: 'Gemini menolak permintaan. Periksa GEMINI_API_KEY, akses model, dan pengaturan API di Google AI Studio. Detail: ' + message.slice(0, 250) });
      }
      return send(res, 502, { error: ('Layanan Gemini gagal: ' + message).slice(0, 500) });
    }

    const candidate = data?.candidates?.[0];
    const outputText = (candidate?.content?.parts || []).map(part => part.text || '').join('\n').trim();
    if (!outputText) {
      const reason = candidate?.finishReason ? ' Alasan: ' + candidate.finishReason + '.' : '';
      return send(res, 502, { error: 'Gemini tidak mengembalikan teks yang dapat digunakan.' + reason });
    }

    let draft;
    try { draft = JSON.parse(outputText); } catch { return send(res, 502, { error: 'Respons Gemini belum berbentuk json valid. Silakan coba lagi.' }); }
    if (typeof draft.summary !== 'string' || !Array.isArray(draft.keyPoints) || !Array.isArray(draft.questions)) {
      return send(res, 502, { error: 'Struktur draf AI tidak sesuai format yang diharapkan.' });
    }
    const validQuestions = draft.questions.length === 5 && draft.questions.every(q => {
      if (!q || typeof q.question !== 'string' || !Array.isArray(q.options) || q.options.length !== 4) return false;
      const answerIndex = typeof q.answerIndex === 'string' && q.answerIndex.trim() !== '' ? Number(q.answerIndex) : q.answerIndex;
      return Number.isInteger(answerIndex) && answerIndex >= 0 && answerIndex <= 3 && typeof q.explanation === 'string';
    });
    if (!validQuestions) {
      return send(res, 502, { error: 'Gemini belum menghasilkan tepat 5 soal dengan masing-masing 4 opsi, answerIndex 0–3, dan pembahasan. Coba buat draf ulang. Jika berulang, periksa konfigurasi model Gemini.' });
    }
    draft.questions = draft.questions.map(q => ({ ...q, answerIndex: Number(q.answerIndex) }));
    if (typeof draft.example !== 'string') draft.example = '';
    return send(res, 200, { draft });
  } catch {
    return send(res, 502, { error: 'Tidak dapat menghubungi layanan Gemini saat ini.' });
  }
};
