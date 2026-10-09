const bcrypt = require('bcrypt');
const config = require('../src/config');
const User = require('../src/models/User');
const { useTestApp } = require('./helpers/setup');
const { newAgent, postForm, createUser, lastEmailTo, csrfFor, pageText } = require('./helpers/http');

const ctx = useTestApp();

const validForm = {
  name: 'Priya Raman',
  email: 'priya@example.com',
  password: 'Garden#Lamp42',
  confirmPassword: 'Garden#Lamp42',
  terms: 'on'
};

function register(agent, overrides = {}) {
  return postForm(agent, '/register', { ...validForm, ...overrides });
}

describe('registration', () => {
  test('renders the form with a CSRF token', async () => {
    const res = await newAgent(ctx.app).get('/register');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/name="_csrf" value="[a-f0-9]{64}"/);
  });

  test('shows an error for every missing field', async () => {
    const res = await postForm(newAgent(ctx.app), '/register', {});
    expect(res.status).toBe(422);
    expect(res.text).toContain('Enter your full name.');
    expect(res.text).toContain('Enter your email address.');
    expect(res.text).toContain('Password must be 8 to 64 characters long.');
    expect(res.text).toContain('Please accept the terms to continue.');
    expect(await User.countDocuments()).toBe(0);
  });

  test('rejects an invalid email address', async () => {
    const res = await register(newAgent(ctx.app), { email: 'not-an-email' });
    expect(res.status).toBe(422);
    expect(res.text).toContain('Enter a valid email address');
  });

  test.each([
    ['garden#lamp42', 'Add at least one uppercase letter.'],
    ['GARDEN#LAMP42', 'Add at least one lowercase letter.'],
    ['Garden#Lamp', 'Add at least one number.'],
    ['GardenLamp42', 'Add at least one symbol'],
    ['G#l4', 'Password must be 8 to 64 characters long.']
  ])('enforces the password policy (%s)', async (password, message) => {
    const res = await register(newAgent(ctx.app), { password, confirmPassword: password });
    expect(res.status).toBe(422);
    expect(res.text).toContain(message);
  });

  test.each([
    ['priya@example.com', 'Priya#2026x'],
    ['priya.raman@example.com', 'Raman#2026x']
  ])('rejects a password built from the email name (%s)', async (email, password) => {
    const res = await register(newAgent(ctx.app), { email, password, confirmPassword: password });
    expect(res.status).toBe(422);
    expect(pageText(res)).toContain("Password can't contain the first part of your email address.");
  });

  test('rejects a confirmation that does not match', async () => {
    const res = await register(newAgent(ctx.app), { confirmPassword: 'Garden#Lamp43' });
    expect(res.status).toBe(422);
    expect(pageText(res)).toContain("Passwords don't match.");
  });

  test('keeps name and email on error but never echoes the password', async () => {
    const res = await register(newAgent(ctx.app), { terms: '' });
    expect(res.status).toBe(422);
    expect(res.text).toContain('value="Priya Raman"');
    expect(res.text).toContain('value="priya@example.com"');
    expect(res.text).not.toContain('Garden#Lamp42');
  });

  test('rejects an email that is already registered, ignoring case', async () => {
    await createUser({ email: 'priya@example.com' });
    const res = await register(newAgent(ctx.app), { email: 'Priya@Example.com' });
    expect(res.status).toBe(422);
    expect(res.text).toContain('An account with this email already exists');
    expect(await User.countDocuments()).toBe(1);
  });

  test('creates an unverified user with a bcrypt hash and emails a link', async () => {
    const agent = newAgent(ctx.app);
    const res = await register(agent, { name: '  Priya Raman  ', email: ' PRIYA@example.com ' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/verify-email/sent');

    const user = await User.findOne({ email: 'priya@example.com' }).select('+password');
    expect(user.name).toBe('Priya Raman');
    expect(user.isVerified).toBe(false);
    expect(user.password).not.toBe(validForm.password);
    expect(bcrypt.getRounds(user.password)).toBe(config.security.bcryptRounds);
    expect(await bcrypt.compare(validForm.password, user.password)).toBe(true);

    const email = lastEmailTo('priya@example.com');
    expect(email.subject).toBe('Confirm your email address');
    expect(email.action.url).toMatch(/\/verify-email\/[a-f0-9]{64}$/);

    const sent = await agent.get('/verify-email/sent');
    expect(sent.text).toContain('priya@example.com');
  });

  test('never exposes the password hash', async () => {
    await createUser({ email: 'priya@example.com' });
    const user = await User.findOne({ email: 'priya@example.com' });
    expect(user.password).toBeUndefined();

    const withHash = await User.findOne({ email: 'priya@example.com' }).select('+password');
    expect(withHash.toJSON()).not.toHaveProperty('password');
  });

  test('requires a CSRF token', async () => {
    const agent = newAgent(ctx.app);
    await csrfFor(agent, '/register');
    const res = await agent.post('/register').type('form').send(validForm);
    expect(res.status).toBe(403);
    expect(await User.countDocuments()).toBe(0);
  });
});
