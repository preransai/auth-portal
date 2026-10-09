const User = require('../src/models/User');
const LoginAttempt = require('../src/models/LoginAttempt');
const { useTestApp } = require('./helpers/setup');
const { newAgent, createUser, login, postForm, lastEmailTo, pageText, PASSWORD } = require('./helpers/http');

const ctx = useTestApp();
const NEW_PASSWORD = 'Brand#New2026x';

async function signedIn() {
  const user = await createUser();
  const agent = newAgent(ctx.app);
  await login(agent);
  return { user, agent };
}

describe('protected routes', () => {
  test.each(['/dashboard', '/account', '/admin/users'])('%s redirects to /login when signed out', async (path) => {
    const res = await newAgent(ctx.app).get(path);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});

describe('account area', () => {
  test('dashboard lists the 10 most recent sign-in attempts', async () => {
    const { agent } = await signedIn();
    for (let i = 0; i < 12; i++) {
      await login(newAgent(ctx.app), { password: i % 2 ? PASSWORD : 'Wrong#Pass123' });
    }
    const res = await agent.get('/dashboard');
    const rows = res.text.match(/<tr>\s*<td>\s*<span class="badge/g) || [];
    expect(rows).toHaveLength(10);
    expect(res.text).toContain('Wrong password');
    expect(await LoginAttempt.countDocuments()).toBe(13);
  });

  test('updates the display name', async () => {
    const { user, agent } = await signedIn();
    const res = await postForm(agent, '/account/profile', { name: 'Kiran Rao' }, '/account');
    expect(res.status).toBe(302);
    expect((await User.findById(user._id)).name).toBe('Kiran Rao');
  });

  test('rejects an invalid name', async () => {
    const { agent } = await signedIn();
    const res = await postForm(agent, '/account/profile', { name: '<script>' }, '/account');
    expect(res.status).toBe(422);
    expect(res.text).toContain('Use letters, spaces, apostrophes, dots or hyphens only.');
    expect(res.text).not.toContain('<script>');
  });

  test('changing the password requires the current one', async () => {
    const { agent } = await signedIn();
    const res = await postForm(
      agent,
      '/account/password',
      { currentPassword: 'Wrong#Pass123', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD },
      '/account'
    );
    expect(res.status).toBe(422);
    expect(pageText(res)).toContain("That isn't your current password.");
    expect((await login(newAgent(ctx.app))).status).toBe(302);
  });

  test('changing the password keeps this session and signs out the others', async () => {
    const { agent } = await signedIn();
    const otherDevice = newAgent(ctx.app);
    await login(otherDevice);

    const res = await postForm(
      agent,
      '/account/password',
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD },
      '/account'
    );
    expect(res.status).toBe(302);

    expect((await agent.get('/dashboard')).status).toBe(200);
    expect((await otherDevice.get('/dashboard')).status).toBe(302);
    expect(lastEmailTo('test.user@example.com').subject).toBe('Your password was changed');
    expect((await login(newAgent(ctx.app), { password: NEW_PASSWORD })).status).toBe(302);
  });

  test('deleting the account needs the password and removes the data', async () => {
    const { user, agent } = await signedIn();

    const wrong = await postForm(agent, '/account/delete', { deletePassword: 'nope', confirmText: 'DELETE' }, '/account');
    expect(wrong.status).toBe(422);
    expect(await User.exists({ _id: user._id })).toBeTruthy();

    const res = await postForm(agent, '/account/delete', { deletePassword: PASSWORD, confirmText: 'DELETE' }, '/account');
    expect(res.headers.location).toBe('/login');
    expect(await User.exists({ _id: user._id })).toBeNull();
    expect(await LoginAttempt.countDocuments({ user: user._id })).toBe(0);
    expect((await agent.get('/dashboard')).status).toBe(302);
  });
});
