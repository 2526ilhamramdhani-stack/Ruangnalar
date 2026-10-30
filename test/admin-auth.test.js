const test = require('node:test');
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
