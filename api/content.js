const crypto = require('node:crypto');
const COOKIE_NAME = 'ruangnalar_admin';
const SUBJECTS = ['matematika-wajib','matematika-lanjut','kimia','fisika','fiqih'];
const SECTION_TITLES = {
  overview: 'Overview & Tujuan Belajar', mindmap: 'Mind Map', real_world: 'Penerapan Nyata',
  slides: 'Slide Materi Mendalam', cheatsheet: 'Cheatsheet', mnemonic: 'Jembatan Keledai',
  encouragement: 'Penutup Motivasi', question_types: 'Tipe Soal', question_ideas: 'Ide dan Konsep Soal',
  sources: 'Sumber Materi'
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
function databaseConfig() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return url && key ? { url, key } : null;
}
async function dbRequest(config, path, options = {}) {
  const response = await fetch(config.url + '/rest/v1/' + path, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: 'Bearer ' + config.key,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { response, data };
}
function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function normalizeQuestions(draft) {
  if (Array.isArray(draft?.practiceModules) && draft.practiceModules.length) {
    return draft.practiceModules.flatMap(module => Array.isArray(module.questions) ? module.questions : []).slice(0, 20);
  }
  return Array.isArray(draft?.questions) ? draft.questions.slice(0, 20) : [];
}
function buildSections(draft) {
  if (!isObject(draft?.sections)) return null;
  const rows = [];
  for (const [type, title] of Object.entries(SECTION_TITLES)) {
    const body = draft.sections[type];
    if (!isObject(body)) continue;
    rows.push({ section_type: type, title, body, position: rows.length });
  }
  if (Array.isArray(draft.practiceModules)) {
    draft.practiceModules.forEach((module, index) => {
      rows.push({
        section_type: 'practice_module',
        title: typeof module.title === 'string' && module.title.trim() ? module.title.trim().slice(0, 180) : 'Modul Latihan ' + (index + 1),
        body: module,
        position: rows.length
      });
    });
  }
  return rows;
}
async function saveSections(config, contentId, rows) {
  const deleted = await dbRequest(config, 'handout_sections?content_id=eq.' + encodeURIComponent(contentId), {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' }
  });
  if (!deleted.response.ok) return false;
  if (!rows.length) return true;
  const payload = rows.map(row => ({ ...row, content_id: contentId }));
  const inserted = await dbRequest(config, 'handout_sections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(payload)
  });
  return inserted.response.ok;
}
module.exports = async function handler(req, res) {
  const config = databaseConfig();
  if (!config) return send(res, 503, { error: 'Database belum dikonfigurasi. Tambahkan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di Vercel, lalu redeploy.' });

  if (req.method === 'GET') {
    const url = new URL(req.url || '/', 'http://localhost');
    const adminView = url.searchParams.get('admin') === '1';
    if (adminView && !isAuthenticated(req)) return send(res, 401, { error: 'Sesi Admin tidak valid. Silakan masuk kembali.' });
    const subjectId = url.searchParams.get('subjectId');
    if (subjectId && !SUBJECTS.includes(subjectId)) return send(res, 400, { error: 'Mata pelajaran tidak valid.' });
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
      const result = await dbRequest(config, 'learning_contents?' + params.toString());
      if (!result.response.ok) return send(res, 502, { error: 'Gagal mengambil materi dari database. Pastikan seluruh migration learning_contents, subjects/drafts, author, dan handout sudah dijalankan di Supabase.' });
      const contents = Array.isArray(result.data) ? result.data : [];
      if (contents.length) {
        const ids = contents.map(item => item.id).filter(Boolean);
        if (ids.length) {
          const sectionParams = new URLSearchParams({
            select: 'id,content_id,section_type,title,body,position',
            content_id: 'in.(' + ids.join(',') + ')',
            order: 'position.asc'
          });
          const sectionsResult = await dbRequest(config, 'handout_sections?' + sectionParams.toString());
          const grouped = new Map();
          for (const section of (sectionsResult.response.ok && Array.isArray(sectionsResult.data) ? sectionsResult.data : [])) {
            if (!grouped.has(section.content_id)) grouped.set(section.content_id, []);
            grouped.get(section.content_id).push(section);
          }
          for (const item of contents) item.handoutSections = grouped.get(item.id) || [];
          if (!sectionsResult.response.ok) contents.handoutWarning = 'Bagian Handout terstruktur belum tersedia. Admin perlu memeriksa migration Supabase.';
        }
      }
      return send(res, 200, { contents });
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
  const requestedStatus = body?.status === 'published' ? 'published' : 'draft';
  const id = typeof body?.contentId === 'string' ? body.contentId : '';
  const draft = body?.draft;
  if (!SUBJECTS.includes(subjectId)) return send(res, 400, { error: 'Pilih mata pelajaran yang valid.' });
  if (!title || !topic || !authorName || !draft || typeof draft.summary !== 'string' || !Array.isArray(draft.questions)) {
    return send(res, 400, { error: 'Data materi tidak lengkap. Buat atau periksa draf AI terlebih dahulu.' });
  }
  const sections = buildSections(draft);
  if (requestedStatus === 'published' && (!sections || sections.length < 10)) {
    return send(res, 400, { error: 'Handout belum memiliki struktur lengkap. Buat ulang draf AI dengan standar Handout Pintar sebelum menerbitkan.' });
  }
  const questions = normalizeQuestions(draft);
  const row = {
    title, topic, subject_id: subjectId,
    status: 'draft', author_name: authorName,
    summary: draft.summary.slice(0, 12000),
    key_points: Array.isArray(draft.keyPoints) ? draft.keyPoints.slice(0, 30).map(v => String(v).slice(0, 1000)) : [],
    example: typeof draft.example === 'string' ? draft.example.slice(0, 12000) : '',
    questions,
    published: false,
    source_references: Array.isArray(draft.sections?.sources?.references) ? draft.sections.sources.references : []
  };
  try {
    let contentId = id;
    let saved;
    if (req.method === 'PATCH') {
      if (!id) return send(res, 400, { error: 'ID draf tidak ditemukan. Simpan draf terlebih dahulu.' });
      saved = await dbRequest(config, 'learning_contents?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(row)
      });
    } else {
      saved = await dbRequest(config, 'learning_contents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(row)
      });
    }
    if (!saved.response.ok) return send(res, 502, { error: 'Gagal menyimpan materi. Pastikan seluruh migration konten, author, dan Handout sudah dijalankan di Supabase.' });
    const savedRows = Array.isArray(saved.data) ? saved.data : [];
    if (req.method === 'PATCH' && !savedRows.length) return send(res, 404, { error: 'Draf tidak ditemukan.' });
    if (req.method === 'POST') contentId = savedRows[0]?.id;
    if (!contentId) return send(res, 502, { error: 'Materi tersimpan tanpa ID yang dapat dipakai untuk menyimpan bagian Handout.' });

    if (sections && sections.length) {
      const sectionsSaved = await saveSections(config, contentId, sections);
      if (!sectionsSaved) {
        return send(res, 502, { error: 'Materi tersimpan sebagai draf, tetapi bagian Handout gagal disimpan. Materi tidak diterbitkan; periksa migration handout_sections lalu simpan ulang.' });
      }
    }
    if (requestedStatus === 'published') {
      const publish = await dbRequest(config, 'learning_contents?id=eq.' + encodeURIComponent(contentId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ status: 'published', published: true, reviewed_at: new Date().toISOString() })
      });
      if (!publish.response.ok || !Array.isArray(publish.data) || !publish.data.length) {
        return send(res, 502, { error: 'Handout tersimpan sebagai draf, tetapi publikasi gagal. Tidak ada status sukses yang dilaporkan; coba terbitkan ulang.' });
      }
      saved.data = publish.data;
    }
    return send(res, req.method === 'PATCH' ? 200 : 201, {
      content: { ...(Array.isArray(saved.data) ? saved.data[0] : null), id: contentId, status: requestedStatus, published: requestedStatus === 'published' }
    });
  } catch {
    return send(res, 502, { error: 'Tidak dapat menyimpan materi ke database saat ini.' });
  }
};
