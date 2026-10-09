const LoginAttempt = require('../src/models/LoginAttempt');
const User = require('../src/models/User');
const { useTestApp } = require('./helpers/setup');
const { newAgent, createUser, login, sessionCookie, PASSWORD, csrfFor } = require('./helpers/http');

const ctx = useTestApp();

describe('sign in', () => {
  test('signs in with the right password and records the attempt', async () => {
    const user = await createUser();
    const agent = newAgent(ctx.app);
    const res = await login(agent, {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36'
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');

    const dashboard = await agent.get('/dashboard');
    expect(dashboard.status).toBe(200);
    expect(dashboard.text).toContain('Hello, Test');
    expect(dashboard.text).toContain('Chrome on Windows');

    const attempt = await LoginAttempt.findOne({ user: user._id });
    expect(attempt).toMatchObject({ success: true, reason: 'ok', email: 'test.user@example.com' });
    expect(attempt.ip).toBeTruthy();

    const updated = await User.findById(user._id);
    expect(updated.lastLoginAt).toBeInstanceOf(Date);
  });

  test('accepts the email in any letter case', async () => {
    await createUser();
    const res = await login(newAgent(ctx.app), { email: '  Test.User@Example.COM ' });
    expect(res.status).toBe(302);
  });

  test('wrong password and unknown email get the same generic message', async () => {
    await createUser();
    const wrongPassword = await login(newAgent(ctx.app), { password: 'Wrong#Pass123' });
    const unknownEmail = await login(newAgent(ctx.app), { email: 'ghost@example.com' });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.text).toContain('Invalid email or password.');
    }
    expect(await LoginAttempt.countDocuments({ success: false })).toBe(2);
    expect(await LoginAttempt.exists({ reason: 'unknown-email', email: 'ghost@example.com' })).toBeTruthy();
  });

  test('a deactivated account cannot sign in', async () => {
    await createUser({ isActive: false });
    const res = await login(newAgent(ctx.app));
    expect(res.status).toBe(401);
    expect(res.text).toContain('This account has been deactivated');
  });

  test('issues a new session id on sign-in (session fixation)', async () => {
    await createUser();
    const agent = newAgent(ctx.app);
    const page = await agent.get('/login');
    const before = sessionCookie(page);
    expect(before).toBeDefined();

    const res = await login(agent);
    const after = sessionCookie(res);
    expect(after).toBeDefined();
    expect(after.split(';')[0]).not.toBe(before.split(';')[0]);
  });

  test('"keep me signed in" sets a 30-day cookie, otherwise a browser-session cookie', async () => {
    await createUser();
    const remembered = sessionCookie(await login(newAgent(ctx.app), { remember: true }));
    const normal = sessionCookie(await login(newAgent(ctx.app)));

    expect(remembered).toMatch(/Expires=/);
    const expires = new Date(remembered.match(/Expires=([^;]+)/)[1]);
    const days = (expires - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThanOrEqual(30);

    expect(normal).not.toMatch(/Expires=/);
    expect(normal).toMatch(/HttpOnly/);
    expect(normal).toMatch(/SameSite=Lax/);
  });

  test('sign out destroys the session', async () => {
    await createUser();
    const agent = newAgent(ctx.app);
    await login(agent);
    expect((await agent.get('/dashboard')).status).toBe(200);

    const _csrf = await csrfFor(agent, '/dashboard');
    const res = await agent.post('/logout').type('form').send({ _csrf });
    expect(res.headers.location).toBe('/login');

    const after = await agent.get('/dashboard');
    expect(after.status).toBe(302);
    expect(after.headers.location).toBe('/login');
  });

  test('a signed-in user visiting /login is sent to the dashboard', async () => {
    await createUser();
    const agent = newAgent(ctx.app);
    await login(agent);
    const res = await agent.get('/login');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');
  });

  test('returns to the page that asked for sign-in', async () => {
    await createUser();
    const agent = newAgent(ctx.app);
    await agent.get('/account');
    const res = await login(agent, { password: PASSWORD });
    expect(res.headers.location).toBe('/account');
  });
});
