const test = require('node:test');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const handler = require('../api/admin-auth');

function mockResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    end(value) { this.body = value; return this; }
  };
}

const originalPassword = process.env.ADMIN_PASSWORD;
const originalSecret = process.env.ADMIN_SESSION_SECRET;

test.before(() => {
  process.env.ADMIN_PASSWORD = 'test-admin-password';
  process.env.ADMIN_SESSION_SECRET = 'test-session-secret-that-is-long-enough-123456';
});

test.after(() => {
  if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = originalPassword;
  if (originalSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = originalSecret;
});

test('GET returns unauthenticated when no session cookie is present', async () => {
  const res = mockResponse();
  await handler({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { authenticated: false });
});

test('GET rejects malformed percent-encoded session cookies without throwing', async () => {
  const res = mockResponse();
  await handler({
    method: 'GET',
    headers: { cookie: 'ruangnalar_admin=%E0%A4%A' }
  }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { authenticated: false });
});

test('a valid login session can be checked successfully', async () => {
  const loginRes = mockResponse();
  await handler({
    method: 'POST',
    headers: {},
    body: { password: 'test-admin-password' }
  }, loginRes);
  assert.equal(loginRes.statusCode, 200);

  const cookie = loginRes.headers['Set-Cookie'].split(';')[0];
  const checkRes = mockResponse();
  await handler({ method: 'GET', headers: { cookie } }, checkRes);
  assert.equal(checkRes.statusCode, 200);
  assert.deepEqual(JSON.parse(checkRes.body), { authenticated: true });
});

test('GET rejects a session with an invalid signature', async () => {
  const res = mockResponse();
  await handler({
    method: 'GET',
    headers: { cookie: 'ruangnalar_admin=' + encodeURIComponent(String(Math.floor(Date.now() / 1000) + 3600) + '.invalid-signature') }
  }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { authenticated: false });
});

test('GET rejects a correctly signed but expired session', async () => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const payload = String(Math.floor(Date.now() / 1000) - 60);
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const cookie = 'ruangnalar_admin=' + encodeURIComponent(payload + '.' + signature);
  const res = mockResponse();
  await handler({ method: 'GET', headers: { cookie } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { authenticated: false });
});

test('DELETE clears the Admin session cookie', async () => {
  const res = mockResponse();
  await handler({ method: 'DELETE', headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['Set-Cookie'], /Max-Age=0/);
});

test('POST rejects an incorrect Admin password', async () => {
  const res = mockResponse();
  await handler({
    method: 'POST',
    headers: {},
    body: { password: 'incorrect-password' }
  }, res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(JSON.parse(res.body), { error: 'Kata sandi Admin tidak sesuai.' });
});
