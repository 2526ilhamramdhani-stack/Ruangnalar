const crypto = require('node:crypto');
const COOKIE_NAME = 'ruangnalar_admin';
const MAX_HTML_BYTES = 15 * 1024 * 1024;
const STORAGE_BUCKET = 'runa-html-modules';

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
async function storageRequest(config, path, options = {}) {
  const response = await fetch(config.url + '/storage/v1' + path, {
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
function validId(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function storagePath(value, id) {
  return typeof value === 'string' && value.startsWith(id + '/') && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.html$/i.test(value);
}
function storageObjectPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}
async function createSignedReadUrl(config, path) {
  const result = await storageRequest(config, '/object/sign/' + STORAGE_BUCKET + '/' + storageObjectPath(path), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 })
  });
  if (!result.response.ok) throw new Error('Gagal membuat tautan baca file HTML.');
  const signed = result.data && (result.data.signedURL || result.data.signedUrl || result.data.url);
  if (!signed) throw new Error('Supabase tidak mengembalikan tautan baca.');
  return /^https?:\/\//i.test(signed) ? signed : config.url + '/storage/v1' + (signed.startsWith('/') ? signed : '/' + signed);
}
module.exports = async function handler(req, res) {
  const config = databaseConfig();
  if (!config) return send(res, 503, { error: 'Database belum dikonfigurasi.' });
  const url = new URL(req.url || '/', 'http://localhost');
  const adminView = url.searchParams.get('admin') === '1';
  if (adminView && !isAuthenticated(req)) return send(res, 401, { error: 'Sesi Admin tidak valid. Silakan masuk kembali.' });

  if (req.method === 'GET') {
    try {
      const columns = 'id,title,description,html,storage_path,status,render_mode,subject_id,topic,author_name,comment,created_at,updated_at';
      const params = new URLSearchParams({ select: columns, order: 'updated_at.desc', limit: '100' });
      if (!adminView) params.set('status', 'eq.published');
      const result = await dbRequest(config, 'custom_html_modules?' + params.toString());
      if (!result.response.ok) return send(res, 502, { error: 'Gagal memuat modul HTML. Jalankan migration custom_html_modules terbaru di Supabase.' });
      const modules = await Promise.all((Array.isArray(result.data) ? result.data : []).map(async module => {
        if (module.storage_path) {
          try { module.html_url = await createSignedReadUrl(config, module.storage_path); }
          catch { module.html_url = null; }
          delete module.html;
        }
        return module;
      }));
      return send(res, 200, { modules });
    } catch {
      return send(res, 502, { error: 'Tidak dapat menghubungi database atau Supabase Storage.' });
    }
  }

  if (!['POST','PATCH','DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return send(res, 405, { error: 'Method tidak diizinkan.' });
  }
  if (!isAuthenticated(req)) return send(res, 401, { error: 'Sesi Admin tidak valid. Silakan masuk kembali.' });

  const body = readBody(req);
  if (req.method === 'POST' && body.action === 'sign-upload') {
    const id = validId(body.id) ? body.id : crypto.randomUUID();
    const size = Number(body.size);
    if (!Number.isSafeInteger(size) || size < 1 || size > MAX_HTML_BYTES) return send(res, 413, { error: 'Ukuran HTML maksimal 15 MiB.' });
    const path = id + '/' + crypto.randomUUID() + '.html';
    try {
      const signed = await storageRequest(config, '/object/upload/sign/' + STORAGE_BUCKET + '/' + storageObjectPath(path), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upsert: false })
      });
      if (!signed.response.ok) return send(res, 502, { error: 'Supabase Storage gagal menyiapkan upload. Pastikan bucket runa-html-modules sudah dibuat.' });
      const signedUrl = signed.data && (signed.data.url || signed.data.signedURL || signed.data.signedUrl);
      const token = signed.data && signed.data.token;
      if (!signedUrl || !token) return send(res, 502, { error: 'Respons upload Supabase tidak lengkap.' });
      const uploadUrl = /^https?:\/\//i.test(signedUrl) ? signedUrl : config.url + '/storage/v1' + (signedUrl.startsWith('/') ? signedUrl : '/' + signedUrl);
      const target = new URL(uploadUrl);
      if (token && !target.searchParams.has('token')) target.searchParams.set('token', token);
      return send(res, 200, { id, storagePath: path, uploadUrl: target.toString(), maxBytes: MAX_HTML_BYTES });
    } catch {
      return send(res, 502, { error: 'Tidak dapat menyiapkan upload ke Supabase Storage.' });
    }
  }

  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id') || '';
    if (!validId(id)) return send(res, 400, { error: 'ID modul tidak valid.' });
    const result = await dbRequest(config, 'custom_html_modules?id=eq.' + encodeURIComponent(id) + '&select=id,title,storage_path', {
      method: 'DELETE', headers: { Prefer: 'return=representation' }
    });
    if (!result.response.ok) return send(res, 502, { error: 'Modul gagal dihapus.' });
    if (!Array.isArray(result.data) || !result.data.length) return send(res, 404, { error: 'Modul tidak ditemukan.' });
    const removed = result.data[0];
    if (removed.storage_path) {
      await storageRequest(config, '/object/' + STORAGE_BUCKET + '/' + storageObjectPath(removed.storage_path), { method: 'DELETE' });
    }
    return send(res, 200, { deleted: true, module: { id: removed.id, title: removed.title } });
  }

  const id = req.method === 'PATCH' ? body.id : (validId(body.id) ? body.id : crypto.randomUUID());
  if (!validId(id)) return send(res, 400, { error: 'ID modul tidak valid.' });
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '';
  const html = typeof body.html === 'string' ? body.html : '';
  const path = typeof body.storagePath === 'string' ? body.storagePath : '';
  const status = body.status === 'published' ? 'published' : 'draft';
  const render_mode = body.renderMode === 'raw' ? 'raw' : 'module';
  const subject_id = typeof body.subjectId === 'string' ? body.subjectId : '';
  const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 100) : '';
  const author_name = typeof body.authorName === 'string' ? body.authorName.trim().slice(0, 100) : '';
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 1000) : '';
  const allowedSubjects = ["pendidikan-agama-islam","fiqih","sejarah-kebudayaan-islam","al-quran-hadits","akidah-akhlak","pendidikan-pancasila","seni","kimia","biologi","fisika","bahasa-arab","bahasa-inggris","sejarah","sosiologi","pendidikan-jasmani-dan-kesehatan","geografi","bahasa-indonesia","matematika","ekonomi"];
  if (!title) return send(res, 400, { error: 'Judul modul wajib diisi.' });
  if (!author_name) return send(res, 400, { error: 'Nama penerbit wajib diisi.' });
  if (!allowedSubjects.includes(subject_id)) return send(res, 400, { error: 'Pilih mata pelajaran dari daftar standar RuNa.' });
  if (path ? !storagePath(path, id) : (!html.trim() || Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES)) return send(res, 400, { error: 'File HTML belum diunggah atau ukurannya tidak valid.' });
  if (path && html) return send(res, 400, { error: 'Kirim file HTML melalui Storage, bukan body API.' });
  if (!path && !/<html[\s>]|<!doctype\s+html|<body[\s>]/i.test(html)) return send(res, 400, { error: 'Masukkan dokumen HTML lengkap.' });

  const payload = { id, title, description, html: path ? null : html, storage_path: path || null, status, render_mode, subject_id, topic, author_name, comment, updated_at: new Date().toISOString() };
  try {
    const columns = 'id,title,description,html,storage_path,status,render_mode,subject_id,topic,author_name,comment,created_at,updated_at';
    if (req.method === 'PATCH') {
      const result = await dbRequest(config, 'custom_html_modules?id=eq.' + encodeURIComponent(id) + '&select=' + columns, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(payload)
      });
      if (!result.response.ok) return send(res, 502, { error: 'Perubahan modul gagal disimpan.' });
      if (!Array.isArray(result.data) || !result.data.length) return send(res, 404, { error: 'Modul tidak ditemukan.' });
      return send(res, 200, { module: result.data[0] });
    }
    const result = await dbRequest(config, 'custom_html_modules?select=' + columns, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(payload)
    });
    if (!result.response.ok) return send(res, 502, { error: 'Modul gagal disimpan.' });
    return send(res, 201, { module: Array.isArray(result.data) ? result.data[0] : null });
  } catch {
    return send(res, 502, { error: 'Tidak dapat menyimpan modul saat ini.' });
  }
};
