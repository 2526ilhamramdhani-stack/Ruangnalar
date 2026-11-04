const crypto = require('node:crypto');
const COOKIE_NAME = 'ruangnalar_admin';
const MAX_HTML_BYTES = 300 * 1024;

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
  const payload = token.slice(0, dot), signature = token.slice(dot + 1);
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
async function dbRequest(config, path, options = {}) {
  const response = await fetch(config.url + '/rest/v1/' + path, {
    ...options,
    headers: { apikey: config.key, Authorization: 'Bearer ' + config.key, ...(options.headers || {}) }
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { response, data };
}
function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch {} }
  return {};
}
module.exports = async function handler(req, res) {
  const config = databaseConfig();
  if (!config) return send(res, 503, { error: 'Database belum dikonfigurasi.' });
  const url = new URL(req.url || '/', 'http://localhost');
  const adminView = url.searchParams.get('admin') === '1';
  if (adminView && !isAuthenticated(req)) return send(res, 401, { error: 'Sesi Admin tidak valid. Silakan masuk kembali.' });

  if (req.method === 'GET') {
    try {
      const params = new URLSearchParams({
        select: adminView ? 'id,title,description,html,status,render_mode,created_at,updated_at' : 'id,title,description,html,render_mode,created_at,updated_at',
        order: 'updated_at.desc',
        limit: '100'
      });
      if (!adminView) params.set('status', 'eq.published');
      const result = await dbRequest(config, 'custom_html_modules?' + params.toString());
      if (!result.response.ok) return send(res, 502, { error: 'Gagal memuat modul HTML. Pastikan migration custom_html_modules sudah dijalankan di Supabase.' });
      return send(res, 200, { modules: Array.isArray(result.data) ? result.data : [] });
    } catch {
      return send(res, 502, { error: 'Tidak dapat menghubungi database.' });
    }
  }

  if (!['POST','PATCH','DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return send(res, 405, { error: 'Method tidak diizinkan.' });
  }
  if (!isAuthenticated(req)) return send(res, 401, { error: 'Sesi Admin tidak valid. Silakan masuk kembali.' });

  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id') || '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) return send(res, 400, { error: 'ID modul tidak valid.' });
    const result = await dbRequest(config, 'custom_html_modules?id=eq.' + encodeURIComponent(id) + '&select=id,title', {
      method: 'DELETE', headers: { Prefer: 'return=representation' }
    });
    if (!result.response.ok) return send(res, 502, { error: 'Modul gagal dihapus.' });
    if (!Array.isArray(result.data) || !result.data.length) return send(res, 404, { error: 'Modul tidak ditemukan.' });
    return send(res, 200, { deleted: true, module: result.data[0] });
  }

  const body = readBody(req);
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '';
  const html = typeof body.html === 'string' ? body.html : '';
  const status = body.status === 'published' ? 'published' : 'draft';
  const render_mode = body.renderMode === 'raw' ? 'raw' : 'module';
  const bytes = Buffer.byteLength(html, 'utf8');
  if (!title) return send(res, 400, { error: 'Judul modul wajib diisi.' });
  if (!html.trim()) return send(res, 400, { error: 'Konten HTML wajib diisi.' });
  if (bytes > MAX_HTML_BYTES) return send(res, 413, { error: 'Ukuran HTML melebihi batas 300 KB untuk versi awal.' });
  if (!/<html[\s>]|<!doctype\s+html|<body[\s>]/i.test(html)) return send(res, 400, { error: 'Masukkan dokumen HTML lengkap.' });

  const payload = { title, description, html, status, render_mode, updated_at: new Date().toISOString() };
  try {
    if (req.method === 'PATCH') {
      const id = typeof body.id === 'string' ? body.id : '';
      if (!/^[0-9a-f-]{36}$/i.test(id)) return send(res, 400, { error: 'ID modul tidak valid.' });
      const result = await dbRequest(config, 'custom_html_modules?id=eq.' + encodeURIComponent(id) + '&select=id,title,description,html,status,render_mode,created_at,updated_at', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(payload)
      });
      if (!result.response.ok) return send(res, 502, { error: 'Perubahan modul gagal disimpan.' });
      if (!Array.isArray(result.data) || !result.data.length) return send(res, 404, { error: 'Modul tidak ditemukan.' });
      return send(res, 200, { module: result.data[0] });
    }
    const result = await dbRequest(config, 'custom_html_modules?select=id,title,description,html,status,render_mode,created_at,updated_at', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });
    if (!result.response.ok) return send(res, 502, { error: 'Modul gagal disimpan.' });
    return send(res, 201, { module: Array.isArray(result.data) ? result.data[0] : null });
  } catch {
    return send(res, 502, { error: 'Tidak dapat menyimpan modul saat ini.' });
  }
};
