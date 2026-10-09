"use strict";
const assert = require("node:assert/strict");
const model = require("./integrated-lab-model.js");
const engine = require("./integrated-lab-exercise-engine.js");
const terminalEngine = require("./integrated-lab-terminal.js");
const attempts = require("./integrated-lab-attempts.js");
const items = new Map();
const storage = {getItem: key => items.has(key) ? items.get(key) : null,
  setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key)};
let serial = 0;
const options = {idFactory: () => `12345678-1234-4234-8234-${String(++serial).padStart(12, "0")}`,
  now: () => new Date(2026, 9, 9, 12, 0, serial).toISOString()};
const store = attempts.create(storage, options);
const first = store.createAttempt("ipv4", "17", "intermediate", "operational");
assert.equal(first.schemaVersion, 1);
assert.equal(first.generatorVersion, "1");
assert.equal(first.status, "not_started");
assert.equal(first.mode, "operational");
assert.equal(store.list().length, 1);
assert.equal(store.begin(first.attemptId).status, "in_progress");
let current = model.importScenario(first.currentScenario).state;
current = model.configure(current, "pc-1", {gateway: "192.168.10.254"}).state;
const edited = model.exportScenario(current, {sourceId: "pc-1", destinationId: "pc-3"});
const session = terminalEngine.execute(terminalEngine.createSession(current.devices["pc-1"]), "help", current).session;
const progress = {...first.progress, stepId: "investigation", answers: {hypothesis: "gateway"},
  evidence: [{type: "terminal", summary: "Gateway examinado"}], terminals: {"pc-1": session}};
store.update(first.attemptId, edited, {progress});
const reload = attempts.create(storage, options);
const resumed = reload.resume(first.attemptId);
assert.equal(resumed.attempt.seed, "17");
assert.equal(resumed.attempt.difficulty, "intermediate");
assert.equal(resumed.bench.devices["pc-1"].config.gateway, "192.168.10.254");
assert.equal(resumed.attempt.progress.answers.hypothesis, "gateway");
assert.equal(resumed.attempt.progress.evidence.length, 1);
assert.equal(resumed.attempt.progress.terminals["pc-1"].history[0], "help");
assert.deepEqual(resumed.attempt.initialScenario, first.initialScenario);
assert.equal(Object.hasOwn(resumed.attempt.currentScenario, "faultMetadata"), false);
const entry = {deviceId: "pc-1", profile: resumed.bench.devices["pc-1"].profile,
  command: "ipconfig", errorCode: "", changedState: false};
reload.recordCommand(first.attemptId, entry);
assert.deepEqual(reload.get(first.attemptId).progress.commands, [entry]);
assert.equal(reload.verify(first.attemptId).attempt.status, "in_progress");
assert.equal(reload.get(first.attemptId).checks.length, 1);
assert.equal(Object.hasOwn(reload.get(first.attemptId).checks[0], "result"), false);
const second = reload.newVariation(first.attemptId, "18");
assert.notEqual(second.attemptId, first.attemptId);
assert.equal(reload.get(first.attemptId).seed, "17");
assert.equal(reload.get(second.attemptId).seed, "18");
assert.equal(reload.restart(first.attemptId).seed, "17");
assert.deepEqual(reload.get(first.attemptId).currentScenario, first.initialScenario);
assert.equal(reload.get(first.attemptId).checks.length, 0);
assert.equal(reload.get(first.attemptId).progress.commands.length, 0);
reload.discard(second.attemptId);
assert.equal(reload.list().length, 1);

// O motor, e não o storage, decide se uma tentativa pode ser concluída.
const solved = store.createAttempt(engine.EXERCISE_ID, "4", "intermediate", "bench");
const definition = engine.generateExercise(engine.EXERCISE_ID, "4", {difficulty: "intermediate"});
let repaired = model.importScenario(solved.initialScenario).state;
for (const fault of definition.faultMetadata) {
  if (fault.kind === "gateway") repaired = model.configure(repaired, "pc-1", {gateway: "192.168.10.1"}).state;
  else if (fault.kind === "mask") repaired = model.configure(repaired, "pc-1", {mask: "255.255.255.0"}).state;
  else if (fault.kind === "access-vlan") repaired = model.configure(repaired, "switch-2", {vlans: {"switch-2:gi0/3": 20}}).state;
  else if (fault.kind === "trunk") repaired = model.configure(repaired, fault.side, {allowedVlans: [10, 20]}).state;
  else repaired = model.configure(repaired, "router-1", {eth1: {ip: "192.168.20.1", mask: "255.255.255.0"}}).state;
}
store.update(solved.attemptId, model.exportScenario(repaired, {sourceId: "pc-1", destinationId: "pc-3"}));
const verified = store.verify(solved.attemptId);
assert.equal(verified.verdict.complete, true);
assert.equal(store.get(solved.attemptId).status, "completed");
assert.ok(store.get(solved.attemptId).completedAt);
assert.equal(attempts.create(storage, options).resume(solved.attemptId).attempt.status, "completed");

const saved = JSON.parse(items.get(attempts.KEY));
saved[0].generatorVersion = "future";
items.set(attempts.KEY, JSON.stringify(saved));
assert.equal(store.list().find(item => item.attemptId === first.attemptId).compatible, false);
assert.throws(() => store.resume(first.attemptId), /incompatível/);
saved[0].generatorVersion = "1";
saved[0].progress.terminals["pc-1"] = session;
saved[0].progress.terminals["pc-1"].context.interfaceId = "switch-1:gi0/1";
items.set(attempts.KEY, JSON.stringify(saved));
assert.throws(() => store.resume(first.attemptId), /Sessão de terminal/);
delete saved[0].progress.terminals["pc-1"].context.interfaceId;
saved[0].initialScenario = {schemaVersion: 999};
items.set(attempts.KEY, JSON.stringify(saved));
assert.throws(() => store.list());
assert.equal(JSON.parse(items.get(attempts.KEY))[0].initialScenario.schemaVersion, 999,
  "dados inválidos não devem ser reescritos silenciosamente");
items.set(attempts.KEY, "{broken");
assert.throws(() => store.list(), /corrompidas/);
assert.equal(items.get(attempts.KEY), "{broken");
assert.throws(() => store.createAttempt("ipv4", "19"), /corrompidas/);
assert.throws(() => attempts.create({getItem() { throw new Error("blocked"); }, setItem() {}, removeItem() {}}).list(), /blocked/);
const full = {getItem: () => null, setItem() { throw new Error("quota"); }, removeItem() {}};
assert.throws(() => attempts.create(full, options).createAttempt("ipv4", "1"), /quota/);
console.log("Attempt Engine v1: criação, retomada, GUI/CLI, seed, conclusão, isolamento e falhas de storage aprovados.");
