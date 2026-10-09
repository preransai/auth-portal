// Good enough to label a sign-in as "Chrome on Windows". Order matters:
// Edge and Opera include "Chrome" in their UA string, and Chrome includes
// "Safari", so the more specific names are checked first.
const BROWSERS = [
  ['Edge', /Edg(e|A|iOS)?\/(\d+)/],
  ['Opera', /OPR\/(\d+)/],
  ['Samsung Internet', /SamsungBrowser\/(\d+)/],
  ['Firefox', /(Firefox|FxiOS)\/(\d+)/],
  ['Chrome', /(Chrome|CriOS)\/(\d+)/],
  ['Safari', /Version\/(\d+).*Safari/]
];

const SYSTEMS = [
  ['iOS', /iPhone|iPad|iPod/],
  ['Android', /Android/],
  ['Windows', /Windows NT/],
  ['macOS', /Mac OS X|Macintosh/],
  ['ChromeOS', /CrOS/],
  ['Linux', /Linux/]
];

function match(list, ua) {
  const found = list.find(([, pattern]) => pattern.test(ua));
  return found ? found[0] : null;
}

function describeUserAgent(ua = '') {
  if (!ua) return 'Unknown device';
  if (/curl|wget|python-requests|node-superagent|axios|PostmanRuntime/i.test(ua)) {
    return 'Script or API client';
  }
  const browser = match(BROWSERS, ua);
  const os = match(SYSTEMS, ua);
  if (browser && os) return `${browser} on ${os}`;
  return browser || os || 'Unknown device';
}

function deviceKind(ua = '') {
  if (/iPad|Tablet/.test(ua)) return 'tablet';
  if (/Mobi|iPhone|Android/.test(ua)) return 'phone';
  return 'desktop';
}

module.exports = { describeUserAgent, deviceKind };
