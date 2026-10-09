(function () {
  'use strict';

  const ALERT_ICON =
    '<svg class="icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v5.5"/><circle cx="12" cy="16.3" r=".6" fill="currentColor"/></svg>';

  /* Toasts */

  function dismissToast(toast) {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 200);
  }

  document.querySelectorAll('[data-toast]').forEach((toast) => {
    toast.querySelector('[data-dismiss-toast]').addEventListener('click', () => dismissToast(toast));
    if (!toast.classList.contains('toast--error')) {
      setTimeout(() => dismissToast(toast), 6000);
    }
  });

  /* Show / hide password */

  document.querySelectorAll('[data-toggle-password]').forEach((button) => {
    const input = document.getElementById(button.dataset.togglePassword);
    button.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(show));
      button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      input.focus();
    });
  });

  /* Client-side validation. The server checks everything again; this only
     saves a round trip and shows errors in the same place the server would. */

  function fieldOf(input) {
    return input.closest('.field');
  }

  function clearError(input) {
    const field = fieldOf(input);
    if (!field) return;
    field.classList.remove('field--error');
    field.querySelector('.field__error')?.remove();
    input.removeAttribute('aria-invalid');
  }

  function showError(input, message) {
    const field = fieldOf(input);
    if (!field) return;
    clearError(input);
    const error = document.createElement('p');
    error.className = 'field__error';
    error.id = `${input.id || input.name}-error`;
    error.innerHTML = ALERT_ICON;
    const text = document.createElement('span');
    text.textContent = message;
    error.appendChild(text);
    field.appendChild(error);
    field.classList.add('field--error');
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', error.id);
  }

  function messageFor(input, form) {
    const v = input.validity;
    if (v.valueMissing) {
      if (input.type === 'checkbox') return 'Please accept the terms to continue.';
      const label = form.querySelector(`label[for="${input.id}"]`);
      return `${label ? label.textContent.trim() : 'This field'} is required.`;
    }
    if (v.typeMismatch && input.type === 'email') return 'Enter a valid email address, like name@example.com.';
    if (v.tooShort) return `Use at least ${input.minLength} characters.`;
    if (v.tooLong) return `Use at most ${input.maxLength} characters.`;
    if (v.patternMismatch) return input.dataset.patternMessage || 'Please match the requested format.';
    if (input.dataset.policyValid === 'false') return "Password doesn't meet all the requirements below.";
    if (input.dataset.match) {
      const other = document.getElementById(input.dataset.match);
      if (other && other.value !== input.value) return "Passwords don't match.";
    }
    return null;
  }

  function setLoading(form) {
    const button = form.querySelector('button[type="submit"]');
    if (!button || !button.dataset.loadingText) return;
    button.dataset.originalHtml = button.innerHTML;
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span>${button.dataset.loadingText}`;
    button.classList.add('is-loading');
    button.setAttribute('aria-busy', 'true');
    // Disabled on the next tick so the click still submits the form.
    setTimeout(() => {
      button.disabled = true;
    });
  }

  document.querySelectorAll('form').forEach((form) => {
    const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"])'));

    inputs.forEach((input) => {
      input.addEventListener('input', () => clearError(input));
      input.addEventListener('change', () => clearError(input));
    });

    form.addEventListener('submit', (event) => {
      if (form.hasAttribute('data-validate')) {
        const invalid = inputs
          .map((input) => ({ input, message: messageFor(input, form) }))
          .filter((result) => result.message);

        invalid.forEach(({ input, message }) => showError(input, message));
        if (invalid.length) {
          event.preventDefault();
          invalid[0].input.focus();
          return;
        }
      }

      if (form.dataset.confirm && !window.confirm(form.dataset.confirm)) {
        event.preventDefault();
        return;
      }

      setLoading(form);
    });
  });

  // Coming back with the browser's back button can restore a page from cache
  // with its buttons still in the loading state.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    document.querySelectorAll('button.is-loading').forEach((button) => {
      button.disabled = false;
      button.classList.remove('is-loading');
      button.removeAttribute('aria-busy');
      button.innerHTML = button.dataset.originalHtml;
    });
  });
})();
