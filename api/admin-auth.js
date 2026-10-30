const crypto = require('node:crypto');

const COOKIE_NAME = 'ruangnalar_admin';
const SESSION_SECONDS = 8 * 60 * 60;

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function validSession(req, secret) {
  const cookie = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE_NAME + '='));
  if (!cookie) return false;
  let token;
  try { token = decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1)); } catch { return false; }
  const dot = token.lastIndexOf('.');
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!safeEqual(sign(payload, secret), signature)) return false;
  const expiresAt = Number(payload);
  return Number.isSafeInteger(expiresAt) && expiresAt > Math.floor(Date.now() / 1000);
}

module.exports = async function handler(req, res) {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!password || !secret || secret.length < 32) {
    return send(res, 503, { error: 'Admin belum dikonfigurasi. Atur ADMIN_PASSWORD dan ADMIN_SESSION_SECRET (minimal 32 karakter) di Vercel.' });
  }

  if (req.method === 'GET') {
    return send(res, 200, { authenticated: validSession(req, secret) });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', COOKIE_NAME + '=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
    return send(res, 200, { ok: true });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return send(res, 405, { error: 'Method tidak diizinkan.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const supplied = typeof body?.password === 'string' ? body.password : '';
  if (!safeEqual(supplied, password)) {
    return send(res, 401, { error: 'Kata sandi Admin tidak sesuai.' });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = String(expiresAt);
  const token = payload + '.' + sign(payload, secret);
  res.setHeader('Set-Cookie', COOKIE_NAME + '=' + encodeURIComponent(token) + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + SESSION_SECONDS);
  return send(res, 200, { authenticated: true, expiresIn: SESSION_SECONDS });
};
