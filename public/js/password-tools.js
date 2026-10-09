(function () {
  'use strict';

  const LABELS = ['not entered', 'Weak', 'Fair', 'Good', 'Strong'];
  const COMMON = ['password', 'qwerty', 'letmein', 'welcome', 'admin', 'iloveyou', 'monkey', 'dragon', 'india', 'abc123', 'login'];
  const SEQUENCES = ['abcdefghijklmnopqrstuvwxyz', 'qwertyuiopasdfghjklzxcvbnm', '01234567890'];

  function emailNameParts(email) {
    const local = (email || '').split('@')[0].toLowerCase();
    return [local, ...local.split(/[._+-]/)].filter((part) => part.length >= 3);
  }

  function containsEmailName(password, email) {
    const lower = password.toLowerCase();
    return emailNameParts(email).some((part) => lower.includes(part));
  }

  // Mirrors the server-side policy in src/validators/rules.js.
  function checkRules(password, email) {
    return {
      length: password.length >= 8 && password.length <= 64,
      lower: /[a-z]/.test(password),
      upper: /[A-Z]/.test(password),
      number: /\d/.test(password),
      symbol: /[^A-Za-z0-9]/.test(password),
      email: password.length > 0 && !containsEmailName(password, email)
    };
  }

  function countPatterns(password) {
    const lower = password.toLowerCase();
    let hits = 0;
    for (let i = 0; i < lower.length - 2; i++) {
      const chunk = lower.slice(i, i + 3);
      const repeated = chunk[0] === chunk[1] && chunk[1] === chunk[2];
      const sequential = SEQUENCES.some((seq) => seq.includes(chunk) || seq.includes([...chunk].reverse().join('')));
      if (repeated || sequential) hits++;
    }
    return hits;
  }

  // Rough entropy estimate: length x log2(size of the character pool), then
  // knocked down for runs like "aaa"/"123", dictionary words and the user's
  // own email name. Not zxcvbn, but it catches the usual bad habits.
  function scorePassword(password, email) {
    if (!password) return 0;

    let pool = 0;
    if (/[a-z]/.test(password)) pool += 26;
    if (/[A-Z]/.test(password)) pool += 26;
    if (/\d/.test(password)) pool += 10;
    if (/[^A-Za-z0-9]/.test(password)) pool += 33;

    let bits = password.length * Math.log2(pool);
    bits -= countPatterns(password) * 6;

    const lower = password.toLowerCase();
    if (COMMON.some((word) => lower.includes(word))) bits *= 0.5;
    if (/(19|20)\d\d/.test(password)) bits -= 6;

    if (containsEmailName(password, email)) bits = Math.min(bits, 20);

    let score = bits < 28 ? 1 : bits < 40 ? 2 : bits < 60 ? 3 : 4;

    // A password the server will reject shouldn't be called "Strong".
    const rules = checkRules(password, email);
    if (!Object.values(rules).every(Boolean)) score = Math.min(score, 2);
    return score;
  }

  document.querySelectorAll('[data-password-check]').forEach((box) => {
    const input = document.getElementById(box.dataset.passwordCheck);
    const emailInput = box.dataset.emailInput && document.getElementById(box.dataset.emailInput);
    const meter = box.querySelector('.pw-meter');
    const label = box.querySelector('[data-strength-label]');
    const items = box.querySelectorAll('[data-rule]');

    function update() {
      const password = input.value;
      const email = emailInput ? emailInput.value : box.dataset.email;
      const rules = checkRules(password, email);
      const score = scorePassword(password, email);

      items.forEach((item) => {
        item.classList.toggle('is-met', password.length > 0 && rules[item.dataset.rule]);
      });
      meter.dataset.strength = String(score);
      label.textContent = LABELS[score];
      input.dataset.policyValid = String(password.length === 0 || Object.values(rules).every(Boolean));
    }

    input.addEventListener('input', update);
    if (emailInput) emailInput.addEventListener('input', update);
    update();
  });
})();
