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
function databaseConfig() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return url && key ? { url, key } : null;
}
module.exports = async function handler(req, res) {
  const config = databaseConfig();
  if (!config) return send(res, 503, { error: 'Database belum dikonfigurasi. Tambahkan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di Vercel, lalu redeploy.' });
  if (req.method === 'GET') {
    const url = new URL(req.url || '/', 'http://localhost');
    const adminView = url.searchParams.get('admin') === '1';
    if (adminView && !isAuthenticated(req)) return send(res, 401, { error: 'Sesi Admin tidak valid. Silakan masuk kembali.' });
    const subjectId = url.searchParams.get('subjectId');
    const validSubjects = ['matematika-wajib','matematika-lanjut','kimia','fisika','fiqih'];
    if (subjectId && !validSubjects.includes(subjectId)) return send(res, 400, { error: 'Mata pelajaran tidak valid.' });
    try {
      const params = new URLSearchParams({
        select: 'id,subject_id,status,title,topic,summary,key_points,example,questions,author_name,created_at,published',
        order: 'created_at.desc',
        limit: '100'
      });
      if (subjectId) params.set('subject_id', 'eq.' + subjectId);
      if (!adminView) {
        params.set('published', 'eq.true');
        params.set('status', 'eq.published');
      }
      const response = await fetch(config.url + '/rest/v1/learning_contents?' + params.toString(), {
        headers: { apikey: config.key, Authorization: 'Bearer ' + config.key }
      });
      const rows = await response.json();
      if (!response.ok) return send(res, 502, { error: 'Gagal mengambil materi dari database. Jalankan migration subject/draft terbaru di Supabase.' });
      return send(res, 200, { contents: rows });
    } catch {
      return send(res, 502, { error: 'Tidak dapat menghubungi database saat ini.' });
    }
  }
  if (!['POST','PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PATCH');
    return send(res, 405, { error: 'Method tidak diizinkan.' });
  }
  if (!isAuthenticated(req)) return send(res, 401, { error: 'Sesi Admin tidak valid. Silakan masuk kembali.' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 160) : '';
  const topic = typeof body?.topic === 'string' ? body.topic.trim().slice(0, 100) : '';
  const authorName = typeof body?.authorName === 'string' ? body.authorName.trim().slice(0, 100) : '';
  const subjectId = typeof body?.subjectId === 'string' ? body.subjectId : 'matematika-wajib';
  const status = body?.status === 'published' ? 'published' : 'draft';
  const id = typeof body?.contentId === 'string' ? body.contentId : '';
  const draft = body?.draft;
  const validSubjects = ['matematika-wajib','matematika-lanjut','kimia','fisika','fiqih'];
  if (!validSubjects.includes(subjectId)) return send(res, 400, { error: 'Pilih mata pelajaran yang valid.' });
  if (!title || !topic || !authorName || !draft || typeof draft.summary !== 'string' || !Array.isArray(draft.questions)) {
    return send(res, 400, { error: 'Data materi tidak lengkap. Buat atau periksa draf AI terlebih dahulu.' });
  }
  const row = {
    title, topic, subject_id: subjectId, status, author_name: authorName,
    summary: draft.summary.slice(0, 12000),
    key_points: Array.isArray(draft.keyPoints) ? draft.keyPoints.slice(0, 30).map(v => String(v).slice(0, 1000)) : [],
    example: typeof draft.example === 'string' ? draft.example.slice(0, 12000) : '',
    questions: draft.questions.slice(0, 20),
    published: status === 'published'
  };
  try {
    const endpoint = config.url + '/rest/v1/learning_contents' + (req.method === 'PATCH' ? '?id=eq.' + encodeURIComponent(id) : '');
    if (req.method === 'PATCH' && !id) return send(res, 400, { error: 'ID draf tidak ditemukan. Simpan draf terlebih dahulu.' });
    const response = await fetch(endpoint, {
      method: req.method,
      headers: { apikey: config.key, Authorization: 'Bearer ' + config.key, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(row)
    });
    const data = await response.json();
    if (!response.ok) return send(res, 502, { error: 'Gagal menyimpan materi. Pastikan migration subject/draft terbaru sudah dijalankan di Supabase.' });
    if (req.method === 'PATCH' && (!Array.isArray(data) || !data.length)) return send(res, 404, { error: 'Draf tidak ditemukan.' });
    return send(res, req.method === 'PATCH' ? 200 : 201, { content: Array.isArray(data) ? data[0] : null });
  } catch {
    return send(res, 502, { error: 'Tidak dapat menyimpan materi ke database saat ini.' });
  }
};
