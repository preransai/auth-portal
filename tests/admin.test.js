const User = require('../src/models/User');
const { useTestApp } = require('./helpers/setup');
const { newAgent, createUser, login, postForm, pageText } = require('./helpers/http');

const ctx = useTestApp();

async function signedInAdmin() {
  const admin = await createUser({ name: 'Ananya Iyer', email: 'admin@example.com', role: 'admin' });
  const agent = newAgent(ctx.app);
  await login(agent, { email: 'admin@example.com' });
  return { admin, agent };
}

const adminPost = (agent, path, data = {}) => postForm(agent, path, data, '/admin/users');

describe('admin panel', () => {
  test('normal users get a 403 on every admin route', async () => {
    const target = await createUser({ email: 'other@example.com' });
    await createUser();
    const agent = newAgent(ctx.app);
    await login(agent);

    expect((await agent.get('/admin/users')).status).toBe(403);
    const _csrf = (await agent.get('/dashboard')).text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
    for (const action of ['unlock', 'role', 'status']) {
      const res = await agent.post(`/admin/users/${target.id}/${action}`).type('form').send({ _csrf });
      expect(res.status).toBe(403);
    }
    expect((await User.findById(target._id)).isActive).toBe(true);
  });

  test('lists users with status badges and supports search', async () => {
    const { agent } = await signedInAdmin();
    await createUser({ name: 'Rohan Mehta', email: 'rohan@example.com', lockUntil: new Date(Date.now() + 600000) });
    await createUser({ name: 'Diya Patel', email: 'diya@example.com', isVerified: false });

    const all = await agent.get('/admin/users');
    expect(all.status).toBe(200);
    expect(all.text).toContain('rohan@example.com');
    expect(all.text).toContain('Unverified');
    expect(all.text).toContain('Unlock account');

    const search = await agent.get('/admin/users?q=dIyA');
    expect(search.text).toContain('diya@example.com');
    expect(search.text).not.toContain('rohan@example.com');

    const locked = await agent.get('/admin/users?status=locked');
    expect(locked.text).toContain('rohan@example.com');
    expect(locked.text).not.toContain('diya@example.com');
  });

  test('treats regex characters in the search box as plain text', async () => {
    const { agent } = await signedInAdmin();
    const res = await agent.get('/admin/users?q=.*');
    expect(res.status).toBe(200);
    expect(res.text).toContain('No users match');
  });

  test('can unlock a locked account', async () => {
    const { agent } = await signedInAdmin();
    const locked = await createUser({ email: 'rohan@example.com', lockUntil: new Date(Date.now() + 600000), failedLoginAttempts: 2 });

    const res = await adminPost(agent, `/admin/users/${locked.id}/unlock`);
    expect(res.status).toBe(302);
    const fresh = await User.findById(locked._id);
    expect(fresh.isLocked).toBe(false);
    expect(fresh.failedLoginAttempts).toBe(0);
  });

  test('can promote and demote other users', async () => {
    const { agent } = await signedInAdmin();
    const user = await createUser({ email: 'meera@example.com' });

    await adminPost(agent, `/admin/users/${user.id}/role`);
    expect((await User.findById(user._id)).role).toBe('admin');
    await adminPost(agent, `/admin/users/${user.id}/role`);
    expect((await User.findById(user._id)).role).toBe('user');
  });

  test("an admin can't demote or deactivate themselves", async () => {
    const { admin, agent } = await signedInAdmin();

    await adminPost(agent, `/admin/users/${admin.id}/role`);
    expect(pageText(await agent.get('/admin/users'))).toContain("You can't change your own role.");

    await adminPost(agent, `/admin/users/${admin.id}/status`);
    expect(pageText(await agent.get('/admin/users'))).toContain("You can't deactivate your own account.");

    const fresh = await User.findById(admin._id);
    expect(fresh.role).toBe('admin');
    expect(fresh.isActive).toBe(true);
  });

  test('deactivating a user ends their current session', async () => {
    const { agent } = await signedInAdmin();
    const user = await createUser();
    const userAgent = newAgent(ctx.app);
    await login(userAgent);
    expect((await userAgent.get('/dashboard')).status).toBe(200);

    await adminPost(agent, `/admin/users/${user.id}/status`);
    expect((await User.findById(user._id)).isActive).toBe(false);
    expect((await userAgent.get('/dashboard')).status).toBe(302);

    await adminPost(agent, `/admin/users/${user.id}/status`);
    expect((await login(newAgent(ctx.app))).status).toBe(302);
  });

  test('an unknown user id returns 404', async () => {
    const { agent } = await signedInAdmin();
    expect((await adminPost(agent, '/admin/users/64b7f0c2a1b2c3d4e5f60718/unlock')).status).toBe(404);
    expect((await adminPost(agent, '/admin/users/not-an-id/unlock')).status).toBe(404);
  });
});
