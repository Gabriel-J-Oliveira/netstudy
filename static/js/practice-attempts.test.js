"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {test} = require("node:test");

test("practice starts, resumes, restarts and discards attempts without changing scenarios", () => {
  const attempts = [];
  const store = {
    list: () => attempts.map(item => ({...item, compatible: true})),
    get: id => attempts.find(item => item.attemptId === id),
    createAttempt: (exerciseId, seed, difficulty, mode) => {
      const item = {attemptId: `id-${attempts.length + 1}`, exerciseId, seed, difficulty, mode,
        status: "not_started", updatedAt: String(attempts.length + 1)};
      attempts.unshift(item); return item;
    },
    newVariation: (id, seed) => { const old = store.get(id); return store.createAttempt(old.exerciseId, seed, old.difficulty, old.mode); },
    restart: id => { store.get(id).status = "in_progress"; return store.get(id); },
    discard: id => { attempts.splice(attempts.findIndex(item => item.attemptId === id), 1); }
  };
  const callbacks = {};
  const elements = Object.fromEntries([
    "[data-practice-status]", "[data-practice-actions]", "[data-practice-other-attempts]",
    "[data-practice-continue]", "[data-practice-restart]"
  ].map(key => [key, {hidden: true, replaceChildren() { this.children = []; }, append(item) { this.children.push(item); }}]));
  elements["[data-practice-actions]"].querySelector = key => elements[key];
  elements["[data-practice-actions]"].querySelectorAll = () => [
    {dataset: {}}, {dataset: {}}
  ];
  const section = {dataset: {practiceFamily: "ipv4"}, querySelector: key => elements[key]};
  const notice = {textContent: ""};
  const root = {dataset: {labUrl: "/laboratorio/"},
    querySelector: key => key === "[data-practice-storage-status]" ? notice : null,
    querySelectorAll: () => [section], addEventListener: (name, callback) => { callbacks[name] = callback; }};
  const assigned = [];
  const context = {document: {querySelector: () => root, createElement: () => ({dataset: {}, append() {}, removeAttribute() {}})},
    window: {localStorage: {}, NetStudyLabAttempts: {create: () => store},
      crypto: {getRandomValues: array => { array[0] = 42 + attempts.length; return array; }},
      location: {search: "", assign: url => assigned.push(url)}, confirm: () => true},
    URLSearchParams,
    FormData: class { constructor() {} get(key) { return {exercise: "ipv4", difficulty: "advanced", mode: "operational"}[key]; } }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "practice-attempts.js"), "utf8"), context);
  assert.equal(elements["[data-practice-status]"].textContent, "Não iniciado");
  callbacks.submit({target: {closest: () => ({})}, preventDefault() {}});
  assert.equal(assigned.at(-1), "/laboratorio/?attempt=id-1");
  assert.equal(attempts[0].difficulty, "advanced");
  assert.equal(attempts[0].mode, "operational");
  // Uma nova visita à lista mostra a tentativa persistida.
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "practice-attempts.js"), "utf8"), context);
  assert.equal(elements["[data-practice-actions]"].hidden, false);
  assert.equal(elements["[data-practice-continue]"].href, "/laboratorio/?attempt=id-1");
  assert.equal(elements["[data-practice-status]"].textContent, "Não iniciado");
  attempts[0].status = "in_progress";
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "practice-attempts.js"), "utf8"), context);
  assert.equal(elements["[data-practice-status]"].textContent, "Em andamento");
  callbacks.click({target: {closest: () => ({dataset: {attemptId: "id-1"}, hasAttribute: key => key === "data-practice-new"})}});
  assert.equal(attempts.length, 2);
  assert.notEqual(attempts[0].seed, attempts[1].seed);
  assert.equal(assigned.at(-1), "/laboratorio/?attempt=id-2");
  context.window.location.search = "?attempt=id-1";
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "practice-attempts.js"), "utf8"), context);
  assert.equal(elements["[data-practice-continue]"].href, "/laboratorio/?attempt=id-1");
  assert.equal(elements["[data-practice-other-attempts]"].hidden, false);
  assert.equal(elements["[data-practice-other-attempts]"].children.length, 1);
  callbacks.click({target: {closest: () => ({dataset: {attemptId: "id-2"}, hasAttribute: key => key === "data-practice-restart"})}});
  assert.equal(attempts[0].status, "in_progress");
  callbacks.click({target: {closest: () => ({dataset: {attemptId: "id-2"}, hasAttribute: () => false})}});
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].attemptId, "id-1");
});
