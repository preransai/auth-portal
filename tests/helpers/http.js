const request = require('supertest');
const User = require('../../src/models/User');
const { getOutbox } = require('../../src/services/mail');

const PASSWORD = 'Str0ng!Passw0rd';

// Pulls the synchronizer token out of a rendered form, the same way a
// browser would send it back.
function csrfFrom(html) {
  const match = html.match(/name="_csrf" value="([a-f0-9]+)"/);
  if (!match) throw new Error('No CSRF token found in the page');
  return match[1];
}

async function csrfFor(agent, path = '/login') {
  const res = await agent.get(path);
  return csrfFrom(res.text);
}

function newAgent(app) {
  return request.agent(app);
}

async function createUser(overrides = {}) {
  const user = new User({
    name: 'Test User',
    email: 'test.user@example.com',
    password: PASSWORD,
    isVerified: true,
    ...overrides
  });
  await user.save();
  return user;
}

async function login(agent, { email = 'test.user@example.com', password = PASSWORD, remember, userAgent } = {}) {
  const _csrf = await csrfFor(agent, '/login');
  const form = { _csrf, email, password };
  if (remember) form.remember = 'on';
  const req = agent.post('/login').type('form');
  if (userAgent) req.set('User-Agent', userAgent);
  return req.send(form);
}

async function postForm(agent, path, data, csrfPath = path) {
  const _csrf = await csrfFor(agent, csrfPath);
  return agent.post(path).type('form').send({ _csrf, ...data });
}

function lastEmailTo(email) {
  return getOutbox().find((message) => message.to === email);
}

function tokenFromEmail(message) {
  const match = message.action.url.match(/\/([a-f0-9]{64})$/);
  return match[1];
}

// EJS escapes quotes, so "don't" arrives as "don&#39;t". Undo the few
// entities our messages use before matching on text.
function pageText(res) {
  return res.text.replace(/&#39;/g, "'").replace(/&#34;|&quot;/g, '"').replace(/&amp;/g, '&');
}

function sessionCookie(res) {
  return (res.headers['set-cookie'] || []).find((cookie) => cookie.startsWith('sid='));
}

module.exports = {
  PASSWORD,
  csrfFrom,
  csrfFor,
  newAgent,
  createUser,
  login,
  postForm,
  lastEmailTo,
  tokenFromEmail,
  pageText,
  sessionCookie
};
