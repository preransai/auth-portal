const mongoose = require('mongoose');
const User = require('../models/User');
const { escapeRegex } = require('../utils/format');

const STATUS_FILTERS = {
  all: () => ({}),
  unverified: () => ({ isVerified: false }),
  locked: () => ({ lockUntil: mongoose.trusted({ $gt: new Date() }) }),
  admins: () => ({ role: 'admin' }),
  inactive: () => ({ isActive: false })
};

function buildFilter(q, status) {
  const filter = STATUS_FILTERS[status]();
  if (q) {
    const pattern = mongoose.trusted({ $regex: escapeRegex(q), $options: 'i' });
    filter.$or = [{ name: pattern }, { email: pattern }];
  }
  return filter;
}

function listQuery(source) {
  const q = String(source.q || '').trim().slice(0, 100);
  const status = Object.hasOwn(STATUS_FILTERS, source.status) ? source.status : 'all';
  return { q, status };
}

function listUrl({ q, status }) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status !== 'all') params.set('status', status);
  const query = params.toString();
  return `/admin/users${query ? `?${query}` : ''}`;
}

async function listUsers(req, res) {
  const { q, status } = listQuery(req.query);
  const [users, total, verified, locked, admins] = await Promise.all([
    User.find(buildFilter(q, status)).sort({ createdAt: -1 }).limit(100),
    User.countDocuments(),
    User.countDocuments({ isVerified: true }),
    User.countDocuments(STATUS_FILTERS.locked()),
    User.countDocuments({ role: 'admin' })
  ]);

  res.render('admin/users', { users, q, status, listUrl, stats: { total, verified, locked, admins } });
}

async function findTarget(req) {
  if (!mongoose.isValidObjectId(req.params.id)) return null;
  return User.findById(req.params.id);
}

function notFound() {
  const err = new Error('That user does not exist.');
  err.status = 404;
  return err;
}

async function unlock(req, res) {
  const user = await findTarget(req);
  if (!user) throw notFound();
  user.clearLock();
  await user.save();
  req.flash('success', `${user.name}'s account has been unlocked.`);
  res.redirect(listUrl(listQuery(req.body)));
}

async function toggleRole(req, res) {
  const user = await findTarget(req);
  if (!user) throw notFound();
  if (user.id === req.user.id) {
    req.flash('error', "You can't change your own role. Ask another admin.");
    return res.redirect(listUrl(listQuery(req.body)));
  }

  user.role = user.role === 'admin' ? 'user' : 'admin';
  await user.save();
  req.flash('success', user.role === 'admin' ? `${user.name} is now an admin.` : `${user.name} is no longer an admin.`);
  res.redirect(listUrl(listQuery(req.body)));
}

async function toggleActive(req, res) {
  const user = await findTarget(req);
  if (!user) throw notFound();
  if (user.id === req.user.id) {
    req.flash('error', "You can't deactivate your own account.");
    return res.redirect(listUrl(listQuery(req.body)));
  }

  user.isActive = !user.isActive;
  if (!user.isActive) user.sessionVersion += 1;
  await user.save();
  req.flash('success', user.isActive ? `${user.name} has been reactivated.` : `${user.name} has been deactivated and signed out.`);
  res.redirect(listUrl(listQuery(req.body)));
}

module.exports = { listUsers, unlock, toggleRole, toggleActive };
