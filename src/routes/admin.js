const express = require('express');
const admin = require('../controllers/adminController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Mounted at /admin, so these guards only ever see admin URLs.
router.use(requireAuth, requireAdmin);

router.get('/', (req, res) => res.redirect('/admin/users'));
router.get('/users', admin.listUsers);
router.post('/users/:id/unlock', admin.unlock);
router.post('/users/:id/role', admin.toggleRole);
router.post('/users/:id/status', admin.toggleActive);

module.exports = router;
