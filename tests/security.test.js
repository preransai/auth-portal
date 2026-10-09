const User = require('../src/models/User');
const { useTestApp } = require('./helpers/setup');
const { newAgent, createUser, csrfFor, login, PASSWORD } = require('./helpers/http');

const ctx = useTestApp();

describe('CSRF protection', () => {
  test('rejects a POST without a token', async () => {
    await createUser();
    const agent = newAgent(ctx.app);
    await agent.get('/login');
    const res = await agent.post('/login').type('form').send({ email: 'test.user@example.com', password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.text).toContain('This form expired or was submitted from somewhere else.');
  });

  test('rejects a token that belongs to a different session', async () => {
    await createUser();
    const attacker = newAgent(ctx.app);
    const victim = newAgent(ctx.app);
    const attackerToken = await csrfFor(attacker, '/login');
    await victim.get('/login');

    const res = await victim
      .post('/login')
      .type('form')
      .send({ _csrf: attackerToken, email: 'test.user@example.com', password: PASSWORD });
    expect(res.status).toBe(403);
  });

  test('protects state-changing account actions too', async () => {
    const user = await createUser();
    const agent = newAgent(ctx.app);
    await login(agent);
    const res = await agent.post('/account/delete').type('form').send({ deletePassword: PASSWORD, confirmText: 'DELETE' });
    expect(res.status).toBe(403);
    expect(await User.exists({ _id: user._id })).toBeTruthy();
  });

  test('accepts the token from the X-CSRF-Token header', async () => {
    await createUser();
    const agent = newAgent(ctx.app);
    const token = await csrfFor(agent, '/login');
    const res = await agent
      .post('/login')
      .set('X-CSRF-Token', token)
      .type('form')
      .send({ email: 'test.user@example.com', password: PASSWORD });
    expect(res.status).toBe(302);
  });
});

describe('NoSQL injection', () => {
  test('rejects operator objects in a JSON body', async () => {
    await createUser();
    const agent = newAgent(ctx.app);
    const _csrf = await csrfFor(agent, '/login');
    const res = await agent
      .post('/login')
      .set('Accept', 'application/json')
      .send({ _csrf, email: { $ne: null }, password: { $ne: null } });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'The request contained unexpected data.' });
    expect((await agent.get('/dashboard')).status).toBe(302);
  });

  test('rejects repeated form fields that would arrive as arrays', async () => {
    const agent = newAgent(ctx.app);
    const _csrf = await csrfFor(agent, '/forgot-password');
    const res = await agent
      .post('/forgot-password')
      .type('form')
      .send(`_csrf=${_csrf}&email=a@example.com&email=b@example.com`);
    expect(res.status).toBe(400);
  });

  test('bracket syntax stays a literal string', async () => {
    await createUser();
    const agent = newAgent(ctx.app);
    const _csrf = await csrfFor(agent, '/login');
    const res = await agent.post('/login').type('form').send(`_csrf=${_csrf}&email[$ne]=x&password[$ne]=x`);
    expect(res.status).toBe(422);
    expect((await agent.get('/dashboard')).status).toBe(302);
  });

  test('mongoose sanitizeFilter neutralises operators that reach a query', async () => {
    await createUser();
    // Wrapped as { $eq: { $ne: null } }: a literal value that can't be cast to
    // a string, instead of "every user whose email isn't null".
    await expect(User.findOne({ email: { $ne: null } })).rejects.toThrow(/Cast to string failed/);
    expect(await User.findOne({ email: 'test.user@example.com' })).not.toBeNull();
  });
});

describe('hardening', () => {
  test('sends a strict CSP and other security headers', async () => {
    const res = await newAgent(ctx.app).get('/login');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers).not.toHaveProperty('x-powered-by');
  });

  test('rejects oversized request bodies with 413', async () => {
    const agent = newAgent(ctx.app);
    const _csrf = await csrfFor(agent, '/login');
    const res = await agent
      .post('/login')
      .type('form')
      .send({ _csrf, email: 'test.user@example.com', password: 'x'.repeat(20000) });
    expect(res.status).toBe(413);
  });

  test('unknown pages get the styled 404 page', async () => {
    const res = await newAgent(ctx.app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Page not found');
  });
});
