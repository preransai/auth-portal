// Every date and time the app prints is formatted in one zone, so the dashboard's
// passport dates, the MRZ and the sign-in register can never disagree around midnight.
const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Asia/Kolkata';

const dateTime = new Intl.DateTimeFormat('en-IN', {
  timeZone: APP_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
});

const dateOnly = new Intl.DateTimeFormat('en-IN', {
  timeZone: APP_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

function formatDateTime(value) {
  return value ? dateTime.format(new Date(value)) : '-';
}

function formatDate(value) {
  return value ? dateOnly.format(new Date(value)) : '-';
}

function timeAgo(value) {
  if (!value) return 'never';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(value);
}

function formatIp(ip) {
  if (!ip) return 'unknown';
  if (ip === '::1') return '127.0.0.1';
  return ip.replace(/^::ffff:/, '');
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Picks one of six photo inks so the same name always gets the same one.
function avatarTone(name = '') {
  let sum = 0;
  for (const char of name) sum += char.codePointAt(0);
  return `avatar--t${sum % 6}`;
}

/* ---------------------------------------------------------------------------
   Passport helpers for the dashboard's data page (the "holder's page").
   --------------------------------------------------------------------------- */

const passportFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

// 08 OCT 2026: the date style printed on documents (data page, seals, entry stamp).
function passportDate(value) {
  if (!value) return null;
  return passportFmt.format(new Date(value)).replace('Sept', 'Sep').toUpperCase();
}

const timeFmt = new Intl.DateTimeFormat('en-IN', { timeZone: APP_TIME_ZONE, hour: 'numeric', minute: '2-digit' });

// 1:26 pm (the same lower-case form formatDateTime prints in the registers)
function formatTime(value) {
  return timeFmt.format(new Date(value)).toLowerCase();
}

// The first user-perceived character of a name, so an accent or a surrogate pair
// is never split off ("Ánanya" written with a combining accent keeps it).
const graphemes = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;
function initial(name = '') {
  const text = String(name || '').trim();
  if (!text) return '?';
  const first = graphemes ? graphemes.segment(text)[Symbol.iterator]().next().value.segment : Array.from(text)[0];
  return first.toUpperCase();
}

// Document number: the last 9 characters of the account's ObjectId, upper case.
function documentNumber(id) {
  return String(id || '').slice(-9).toUpperCase();
}

/* Machine-readable zone (ICAO 9303 TD3, 2 x 44 characters) for the signed-in user's own
   account. The account stores one free-text name and never a surname/given split, so the
   whole name is the primary identifier (nothing is guessed or invented). */
const FILL = '<';
const MRZ_NON_LATIN = 'NON<LATIN<NAME';

function mrzChars(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (é -> e)
    .toUpperCase()
    .replace(/['.’]/g, '') // O'Brien -> OBRIEN, R. -> R
    .replace(/[^A-Z0-9]+/g, FILL) // spaces, hyphens, other scripts -> '<'
    .replace(/^<+|<+$/g, ''); // no leading/trailing filler
}

// 7-3-1 weighted check digit: '<' = 0, digits = value, A = 10 ... Z = 35.
function checkDigit(field) {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < field.length; i++) {
    const c = field[i];
    const value = c === FILL ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55;
    sum += value * weights[i % 3];
  }
  return String(sum % 10);
}

const padMrz = (text, length) => (text + FILL.repeat(length)).slice(0, length);

const ymdFmt = new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIME_ZONE, year: '2-digit', month: '2-digit', day: '2-digit' });
function yymmdd(value) {
  const parts = Object.fromEntries(ymdFmt.formatToParts(new Date(value)).map((p) => [p.type, p.value]));
  return parts.year + parts.month + parts.day;
}

function mrzLines(user) {
  // A name with no Latin letters can't be transliterated without inventing a spelling,
  // so the zone says so in MRZ alphabet. Mixed-script names keep their Latin part.
  const name = mrzChars(user.name) || MRZ_NON_LATIN;
  const line1 = padMrz(`P${FILL}APT${name}`, 44); // cut at 44, never abbreviated

  const doc = padMrz(documentNumber(user.id || user._id), 9);
  const issued = yymmdd(user.createdAt);
  const expiry = FILL.repeat(6); // accounts don't expire
  const optional = padMrz(user.role === 'admin' ? 'ADMIN' : 'MEMBER', 14);
  const composite = doc + checkDigit(doc) + issued + checkDigit(issued) + expiry + checkDigit(expiry) + optional + checkDigit(optional);
  const line2 =
    doc + checkDigit(doc) + 'APT' + issued + checkDigit(issued) + FILL + expiry + checkDigit(expiry) +
    optional + checkDigit(optional) + checkDigit(composite);
  return [line1, line2];
}

/* Laser-perforated serial numbers: a 5x7 dot-matrix font read top to bottom
   (glyphs rotated 90 degrees clockwise). Unknown characters are skipped. */
const PERF_GLYPHS = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11100', '10010', '10001', '10001', '10001', '10010', '11100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000']
};

function perforationDots(text, pitch = 3.2) {
  const chars = [...String(text || '').toUpperCase()].filter((c) => PERF_GLYPHS[c]);
  const dots = [];
  chars.forEach((c, i) => {
    PERF_GLYPHS[c].forEach((row, y) => {
      [...row].forEach((bit, x) => {
        if (bit === '1') dots.push({ cx: (6 - y) * pitch + pitch / 2, cy: (i * 6 + x) * pitch + pitch / 2 });
      });
    });
  });
  return {
    width: 7 * pitch,
    height: Math.max(0, chars.length * 6 * pitch - pitch),
    r: Math.round(pitch * 34) / 100,
    dots
  };
}

module.exports = {
  APP_TIME_ZONE,
  formatDateTime,
  formatDate,
  timeAgo,
  formatIp,
  escapeRegex,
  avatarTone,
  passportDate,
  formatTime,
  initial,
  documentNumber,
  checkDigit,
  mrzLines,
  perforationDots
};
