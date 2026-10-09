const { describeUserAgent, deviceKind } = require('../src/utils/userAgent');
const {
  escapeRegex,
  formatIp,
  timeAgo,
  checkDigit,
  mrzLines,
  passportDate,
  formatTime,
  initial,
  documentNumber,
  perforationDots
} = require('../src/utils/format');
const { safeReturnPath } = require('../src/utils/session');

const UA = {
  chromeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'
};

describe('user agent labels', () => {
  test.each([
    [UA.chromeWindows, 'Chrome on Windows', 'desktop'],
    [UA.edgeWindows, 'Edge on Windows', 'desktop'],
    [UA.safariIphone, 'Safari on iOS', 'phone'],
    [UA.firefoxLinux, 'Firefox on Linux', 'desktop'],
    [UA.chromeAndroid, 'Chrome on Android', 'phone']
  ])('%#: %s', (ua, label, kind) => {
    expect(describeUserAgent(ua)).toBe(label);
    expect(deviceKind(ua)).toBe(kind);
  });

  test('labels scripts and empty values', () => {
    expect(describeUserAgent('curl/8.9.1')).toBe('Script or API client');
    expect(describeUserAgent('')).toBe('Unknown device');
  });
});

describe('helpers', () => {
  test('escapeRegex makes user input match literally', () => {
    expect(new RegExp(escapeRegex('a.b*')).test('axb')).toBe(false);
    expect(new RegExp(escapeRegex('a.b*')).test('a.b*')).toBe(true);
  });

  test('formatIp tidies IPv4-mapped and loopback addresses', () => {
    expect(formatIp('::ffff:192.168.1.20')).toBe('192.168.1.20');
    expect(formatIp('::1')).toBe('127.0.0.1');
  });

  test('timeAgo gives short relative times', () => {
    expect(timeAgo(new Date())).toBe('just now');
    expect(timeAgo(new Date(Date.now() - 5 * 60000))).toBe('5 min ago');
    expect(timeAgo(new Date(Date.now() - 3 * 3600000))).toBe('3 hr ago');
  });

  test('production config hashes with cost 12 and refuses to start without secrets', () => {
    const saved = { ...process.env };
    const loadConfig = () => {
      let config;
      jest.isolateModules(() => {
        config = require('../src/config');
      });
      return config;
    };

    try {
      process.env.NODE_ENV = 'production';
      process.env.SESSION_SECRET = '';
      expect(loadConfig).toThrow(/Missing environment variables for production: SESSION_SECRET/);

      Object.assign(process.env, {
        SESSION_SECRET: 'a-long-random-secret',
        MONGODB_URI: 'mongodb://db.example.com/auth',
        APP_URL: 'https://auth.example.com',
        SMTP_HOST: 'smtp.example.com'
      });
      const config = loadConfig();
      expect(config.security.bcryptRounds).toBe(12);
      expect(config.mail.devMailbox).toBe(false);
    } finally {
      process.env = saved;
    }
  });

  test('safeReturnPath only allows local paths (no open redirect)', () => {
    expect(safeReturnPath('/account')).toBe('/account');
    expect(safeReturnPath('//evil.example.com')).toBeNull();
    expect(safeReturnPath('https://evil.example.com')).toBeNull();
    expect(safeReturnPath('/\\evil.example.com')).toBeNull();
  });
});

describe('passport helpers', () => {
  const user = (overrides) => ({
    id: '6704c1f2a9e3b5d0c81f27a4',
    name: 'Aarav Sharma',
    createdAt: new Date('2026-10-08T05:14:00Z'),
    role: 'user',
    ...overrides
  });

  test('check digits use the ICAO 7-3-1 weighting', () => {
    expect(checkDigit('L898902C3')).toBe('6');
    expect(checkDigit('740812')).toBe('2');
  });

  test('both MRZ lines are 44 characters and the whole name is the primary identifier', () => {
    const [line1, line2] = mrzLines(user());
    expect(line1).toHaveLength(44);
    expect(line2).toHaveLength(44);
    expect(line1.startsWith('P<APTAARAV<SHARMA<')).toBe(true);
    expect(line1).not.toContain('<<SHARMA');
    expect(line2).toBe('0C81F27A41APT2610081<<<<<<<0MEMBER<<<<<<<<44');
  });

  test('single names, initials and non-Latin names', () => {
    expect(mrzLines(user({ name: 'Kiran' }))[0]).toBe(`P<APTKIRAN${'<'.repeat(34)}`);
    expect(mrzLines(user({ name: 'R. Venkatesh' }))[0].startsWith('P<APTR<VENKATESH<')).toBe(true);
    expect(mrzLines(user({ name: 'आरव शर्मा' }))[0].startsWith('P<APTNON<LATIN<NAME<')).toBe(true);
    expect(mrzLines(user({ name: "Seán O'Brien-Nair" }))[0].startsWith('P<APTSEAN<OBRIEN<NAIR<')).toBe(true);
    expect(mrzLines(user({ role: 'admin' }))[1]).toContain('ADMIN<<<<<<<<<');
  });

  test('dates are printed in the app time zone (just after midnight IST)', () => {
    const late = user({ createdAt: new Date('2026-10-08T18:50:00Z') });
    expect(passportDate(late.createdAt)).toBe('09 OCT 2026');
    expect(mrzLines(late)[1].slice(13, 19)).toBe('261009');
    expect(passportDate(null)).toBeNull();
  });

  test('formatTime is lower case', () => {
    const time = formatTime(new Date('2026-10-08T07:56:00Z'));
    expect(time).toBe(time.toLowerCase());
    expect(time).toMatch(/^1:26\s?pm$/);
  });

  test('initial keeps the first whole grapheme', () => {
    expect(initial('aarav')).toBe('A');
    expect(initial('Ánanya')).toBe('Á');
    expect(initial('')).toBe('?');
  });

  test('document number and perforation', () => {
    expect(documentNumber('6704c1f2a9e3b5d0c81f27a4')).toBe('0C81F27A4');
    const perf = perforationDots('AP-1', 4.4);
    // A has 18 holes, P 15, - 5, 1 10
    expect(perf.dots).toHaveLength(48);
    expect(perf.width).toBeCloseTo(30.8);
    expect(perf.height).toBeCloseTo(101.2);
  });
});
