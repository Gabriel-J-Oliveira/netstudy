(function () {
  'use strict';

  function readProgress(storage, key) {
    try {
      const value = JSON.parse(storage.getItem(key) || 'null');
      if (value && value.version === 1 && Array.isArray(value.criteria) && Array.isArray(value.evidence)) {
        return value;
      }
    } catch (_) { /* Private browsing or invalid stored data: use a fresh checklist. */ }
    return { version: 1, criteria: [], evidence: [] };
  }

  function init(root, storage) {
    const key = 'netstudy:external-lab:v1:' + root.dataset.externalLab;
    const progress = readProgress(storage, key);
    const status = root.querySelector('[data-progress-status]');
    const checks = Array.from(root.querySelectorAll('[data-progress-group] input[type="checkbox"]'));
    const updateStatus = () => {
      const total = checks.filter((item) => item.closest('[data-progress-group="criteria"]')).length;
      const done = checks.filter((item) => item.checked && item.closest('[data-progress-group="criteria"]')).length;
      status.textContent = `${done} de ${total} critérios marcados por você. Validação manual no GNS3.`;
    };
    checks.forEach((input) => {
      const group = input.closest('[data-progress-group]').dataset.progressGroup;
      const index = Number(input.dataset.progressIndex);
      input.checked = progress[group].includes(index);
      input.addEventListener('change', () => {
        progress[group] = checks.filter((candidate) =>
          candidate.checked && candidate.closest('[data-progress-group]').dataset.progressGroup === group
        ).map((candidate) => Number(candidate.dataset.progressIndex));
        try { storage.setItem(key, JSON.stringify(progress)); } catch (_) { /* Checklist remains usable without storage. */ }
        updateStatus();
      });
    });
    updateStatus();

    const hints = Array.from(root.querySelectorAll('[data-hint-index]'));
    hints.forEach((hint, index) => hint.addEventListener('toggle', () => {
      if (hint.open && hints[index + 1]) hints[index + 1].hidden = false;
    }));
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { readProgress, init };
  if (typeof document !== 'undefined') {
    let storage;
    try { storage = window.localStorage; } catch (_) { storage = { getItem: () => null, setItem: () => {} }; }
    document.querySelectorAll('[data-external-lab]').forEach((root) => init(root, storage));
  }
}());
