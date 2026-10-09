// A tiny replacement for connect-flash. Messages stay in the session until a
// page is actually rendered, so a redirect chain doesn't swallow them.
function flash(req, res, next) {
  req.flash = (type, message) => {
    req.session.flash = req.session.flash || [];
    req.session.flash.push({ type, message });
  };

  res.locals.takeFlash = () => {
    const messages = req.session.flash || [];
    delete req.session.flash;
    return messages;
  };

  next();
}

module.exports = flash;
