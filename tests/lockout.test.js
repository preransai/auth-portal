const User = require('../src/models/User');
const LoginAttempt = require('../src/models/LoginAttempt');
const { useTestApp } = require('./helpers/setup');
const { newAgent, createUser, login, lastEmailTo } = require('./helpers/http');

const ctx = useTestApp();
const WRONG = 'Wrong#Pass123';

async function failTimes(count) {
  for (let i = 0; i < count; i++) {
    await login(newAgent(ctx.app), { password: WRONG });
  }
}

describe('account lockout', () => {
  test('counts consecutive failures without locking early', async () => {
    const user = await createUser();
    await failTimes(4);
    const fresh = await User.findById(user._id);
    expect(fresh.failedLoginAttempts).toBe(4);
    expect(fresh.isLocked).toBe(false);
  });

  test('a successful sign-in resets the failure counter', async () => {
    const user = await createUser();
    await failTimes(3);
    await login(newAgent(ctx.app));
    expect((await User.findById(user._id)).failedLoginAttempts).toBe(0);
  });

  test('locks the account for 15 minutes after 5 failures and emails the owner', async () => {
    const user = await createUser();
    await failTimes(5);

    const locked = await User.findById(user._id);
    expect(locked.isLocked).toBe(true);
    const minutes = (locked.lockUntil - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);

    expect(lastEmailTo(user.email).subject).toBe('Your account was temporarily locked');
  });

  test('blocks even the correct password while locked', async () => {
    await createUser();
    await failTimes(5);

    const agent = newAgent(ctx.app);
    const res = await login(agent);
    expect(res.status).toBe(401);
    expect(res.text).toContain('This account is locked');
    expect((await agent.get('/dashboard')).status).toBe(302);
    expect(await LoginAttempt.exists({ reason: 'locked' })).toBeTruthy();
  });

  test('a wrong password on a locked account still gets the generic message', async () => {
    await createUser();
    await failTimes(5);
    const res = await login(newAgent(ctx.app), { password: WRONG });
    expect(res.text).toContain('Invalid email or password.');
    expect(res.text).not.toContain('locked after');
  });

  test('the lock lifts by itself once the window has passed', async () => {
    const user = await createUser();
    await failTimes(5);

    // Pretend the 15 minutes are up.
    await User.updateOne({ _id: user._id }, { lockUntil: new Date(Date.now() - 1000) });

    const res = await login(newAgent(ctx.app));
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');
    const fresh = await User.findById(user._id);
    expect(fresh.lockUntil).toBeUndefined();
  });

  test('parallel wrong guesses cannot slip past the limit', async () => {
    const user = await createUser();
    await Promise.all(Array.from({ length: 8 }, () => login(newAgent(ctx.app), { password: WRONG })));
    expect((await User.findById(user._id)).isLocked).toBe(true);
  });
});
