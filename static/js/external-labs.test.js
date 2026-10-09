const assert = require('node:assert/strict');
const { readProgress, init } = require('./external-labs');

const memory = new Map();
const storage = { getItem: (key) => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
const key = 'netstudy:external-lab:v1:vlan-trunk';
assert.deepEqual(readProgress(storage, key), { version: 1, criteria: [], evidence: [] });
storage.setItem(key, '{bad json');
assert.deepEqual(readProgress(storage, key), { version: 1, criteria: [], evidence: [] });
storage.setItem(key, JSON.stringify({ version: 2, criteria: [0], evidence: [] }));
assert.deepEqual(readProgress(storage, key), { version: 1, criteria: [], evidence: [] });
storage.setItem(key, JSON.stringify({ version: 1, criteria: [0], evidence: [1] }));
assert.deepEqual(readProgress(storage, key), { version: 1, criteria: [0], evidence: [1] });

function check(group, index) {
  const parent = { dataset: { progressGroup: group } };
  return {
    checked: false, dataset: { progressIndex: String(index) },
    closest: (selector) => selector.includes('="criteria"') && group !== 'criteria' ? null :
      selector.includes('="evidence"') && group !== 'evidence' ? null : parent,
    addEventListener(event, handler) { this.handler = handler; },
  };
}
const criteria = [check('criteria', 0), check('criteria', 1)];
const evidence = [check('evidence', 0), check('evidence', 1)];
const status = { textContent: '' };
const hints = [{ open: false, hidden: false }, { open: false, hidden: true }];
hints.forEach((hint) => { hint.addEventListener = (_, handler) => { hint.handler = handler; }; });
const root = {
  dataset: { externalLab: 'vlan-trunk' },
  querySelector: () => status,
  querySelectorAll: (selector) => selector.startsWith('[data-hint') ? hints : [...criteria, ...evidence],
};
init(root, storage);
assert.equal(criteria[0].checked, true);
assert.equal(evidence[1].checked, true);
assert.match(status.textContent, /1 de 2 critérios/);
criteria[1].checked = true;
criteria[1].handler();
assert.deepEqual(JSON.parse(memory.get(key)).criteria, [0, 1]);
assert.deepEqual(JSON.parse(memory.get(key)).evidence, [1]);
hints[0].open = true;
hints[0].handler();
assert.equal(hints[1].hidden, false);
assert.match(status.textContent, /2 de 2 critérios/);
console.log('external-labs progress tests passed');
