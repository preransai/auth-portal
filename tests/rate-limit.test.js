// Must be set before the app (and its config) is loaded.
process.env.LOGIN_RATE_LIMIT = '3';
process.env.EMAIL_RATE_LIMIT = '2';

const { useTestApp } = require('./helpers/setup');
const { newAgent, login, postForm } = require('./helpers/http');

const ctx = useTestApp();

describe('per-IP rate limiting', () => {
  test('POST /login answers 429 once the limit is reached', async () => {
    const statuses = [];
    for (let i = 0; i < 4; i++) {
      const res = await login(newAgent(ctx.app), { email: `user${i}@example.com`, password: 'Wrong#Pass123' });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([401, 401, 401, 429]);
  });

  test('the 429 page still renders the sign-in form with an explanation', async () => {
    const res = await login(newAgent(ctx.app), { email: 'someone@example.com', password: 'Wrong#Pass123' });
    expect(res.status).toBe(429);
    expect(res.text).toContain('Too many sign-in attempts from your network');
    expect(res.headers).toHaveProperty('ratelimit-policy');
  });

  test('forgot-password requests are limited too', async () => {
    const agent = newAgent(ctx.app);
    const first = await postForm(agent, '/forgot-password', { email: 'a@example.com' });
    const second = await postForm(agent, '/forgot-password', { email: 'b@example.com' });
    const third = await postForm(agent, '/forgot-password', { email: 'c@example.com' });
    expect([first.status, second.status, third.status]).toEqual([200, 200, 429]);
  });
});
