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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return send(res, 503, { error: 'AI belum dikonfigurasi. Tambahkan OPENAI_API_KEY di Vercel.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 160) : '';
  const topic = typeof body?.topic === 'string' ? body.topic.trim().slice(0, 100) : '';
  const sourceText = typeof body?.sourceText === 'string' ? body.sourceText.trim() : '';
  if (!title || !sourceText) return send(res, 400, { error: 'Judul dan teks materi wajib diisi.' });
  if (sourceText.length > 50000) return send(res, 413, { error: 'Teks materi terlalu panjang. Batas saat ini 50.000 karakter.' });

  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        instructions: 'Kamu adalah asisten penyusun materi matematika SMA berbahasa Indonesia. Gunakan hanya fakta yang didukung sumber. Jika sumber tidak cukup, nyatakan keterbatasannya. Jangan mengarang kutipan atau rumus. Kembalikan jawaban sebagai JSON valid dengan kunci summary (string), keyPoints (array string), example (string), questions (array 5 objek dengan keys question, options (array tepat 4 string), answerIndex (integer 0-3), explanation (string)). Buat soal beragam dan periksa jawaban serta pembahasannya secara matematis.',
        text: { format: { type: 'json_object' } },
        input: 'Susun draf pembelajaran berdasarkan data berikut. Ini draf untuk ditinjau admin, bukan untuk langsung dipublikasikan.\nJudul: ' + title + '\nTopik: ' + topic + '\n\nSUMBER MATERI:\n' + sourceText
      })
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      const message = data?.error?.message || 'Penyedia AI mengembalikan kesalahan.';
      return send(res, upstream.status === 429 ? 429 : 502, { error: message.slice(0, 500) });
    }
    const outputText = (data.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n').trim();
    if (!outputText) return send(res, 502, { error: 'AI tidak mengembalikan teks yang dapat digunakan.' });
    let draft;
    try { draft = JSON.parse(outputText); } catch { return send(res, 502, { error: 'Respons AI belum berbentuk JSON valid. Silakan coba lagi.' }); }
    if (typeof draft.summary !== 'string' || !Array.isArray(draft.keyPoints) || !Array.isArray(draft.questions)) {
      return send(res, 502, { error: 'Struktur draf AI tidak sesuai format yang diharapkan.' });
    }
    return send(res, 200, { draft });
  } catch (error) {
    return send(res, 502, { error: 'Tidak dapat menghubungi layanan AI saat ini.' });
  }
};
