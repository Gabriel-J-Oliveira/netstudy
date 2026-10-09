const assert = require("node:assert/strict");
const model = require("./integrated-lab-model.js");
const simulator = require("./integrated-lab-simulator.js");
const storage = require("./integrated-lab-storage.js");
const presets = require("./integrated-lab-presets.js");
const exercise = require("./integrated-lab-exercise-engine.js");

let state = model.createEmpty();
const ids = {pc: [], switch: [], router: []};
for (const [type, count] of [["pc", 5], ["switch", 3], ["router", 2]]) {
  for (let n = 0; n < count; n++) {
    const added = model.addDevice(state, type);
    assert.equal(added.error, undefined);
    ids[type].push(added.id);
    state = model.position(added.state, added.id, .3 + n * .08, .3 + n * .08).state;
  }
}
assert.deepEqual(ids.pc, ["pc-1", "pc-2", "pc-3", "pc-4", "pc-5"]);
assert.deepEqual(ids.switch, ["switch-1", "switch-2", "switch-3"]);
assert.deepEqual(ids.router, ["router-1", "router-2"]);
assert.equal(new Set(Object.keys(state.devices)).size, 10);
const cables = [
  ["pc-1:eth0", "switch-1:gi0/1"], ["pc-2:eth0", "switch-1:gi0/2"],
  ["pc-3:eth0", "switch-1:gi0/3"], ["pc-4:eth0", "switch-1:gi0/4"],
  ["router-1:eth0", "switch-2:gi0/1"], ["router-1:eth1", "switch-2:gi0/2"],
  ["router-2:eth0", "switch-2:gi0/3"], ["router-2:eth1", "switch-2:gi0/4"]
];
cables.forEach(([a, b]) => { const result = model.connect(state, a, b); assert.equal(result.error, undefined); state = result.state; });
assert.equal(state.connections.length, 8);
assert.equal(simulator.simulate(model.adapt(state, "pc-1", "pc-2").input).status, "success");
const connectionIds = state.connections.map(link => link.id);
const renamed = model.renameDevice(state, "pc-1", "Servidor Financeiro");
assert.equal(renamed.state.devices["pc-1"].name, "Servidor Financeiro");
assert.deepEqual(renamed.state.connections.map(link => link.id), connectionIds);
state = renamed.state;
const moved = model.position(state, "pc-1", .8, .8).state;
assert.deepEqual(moved.connections, state.connections);
assert.deepEqual(moved.devices["pc-1"].position, {x: .8, y: .8});
state = moved;
const scenario = model.exportScenario(state, {name: "Rede dinâmica", sourceId: "pc-1", destinationId: "pc-2"});
assert.equal(scenario.schemaVersion, 1);
assert.equal(scenario.format, "dynamic");
assert.equal(scenario.devices["pc-1"].name, "Servidor Financeiro");
const restored = model.importScenario(scenario);
assert.equal(restored.sourceId, "pc-1");
assert.deepEqual(model.exportScenario(restored.state, {name: "Rede dinâmica", sourceId: "pc-1", destinationId: "pc-2"}), scenario);
assert.equal(simulator.simulate(model.adapt(restored.state, "pc-1", "pc-2").input).status, "success");
let routed = model.createEmpty();
for (const type of ["pc", "pc", "switch", "switch", "router", "router"]) routed = model.addDevice(routed, type).state;
for (const id of Object.keys(routed.devices)) routed = model.position(routed, id, .5, .5).state;
routed = model.configure(routed, "pc-1", {gateway: "192.168.10.1"}).state;
routed = model.configure(routed, "pc-2", {ip: "192.168.20.20", gateway: "192.168.20.1"}).state;
routed = model.configure(routed, "router-2", {eth0: {ip: "192.168.10.2"}}).state;
routed = model.configure(routed, "switch-2", {vlans: {"switch-2:gi0/1": 20, "switch-2:gi0/2": 20}}).state;
for (const [a, b] of [["pc-1:eth0", "switch-1:gi0/1"], ["router-1:eth0", "switch-1:gi0/2"],
  ["router-2:eth0", "switch-1:gi0/3"], ["router-1:eth1", "switch-2:gi0/1"], ["pc-2:eth0", "switch-2:gi0/2"]]) routed = model.connect(routed, a, b).state;
assert.equal(simulator.simulate(model.adapt(routed, "pc-1", "pc-2").input).status, "success");
routed = model.configure(routed, "pc-1", {gateway: "192.168.10.2"}).state;
const wrongRouter = simulator.simulate(model.adapt(routed, "pc-1", "pc-2").input);
assert.equal(wrongRouter.status, "failure");
assert.equal(wrongRouter.events.at(-1).id, "destination-unreachable");
assert.equal(wrongRouter.events.at(-1).focusId, "router-2");
const memory = new Map();
const localStorage = {getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value)};
const store = storage.create(localStorage);
store.save(state, {name: "Rede dinâmica", sourceId: "pc-1", destinationId: "pc-2"});
assert.equal(store.load("Rede dinâmica").state.devices["pc-1"].name, "Servidor Financeiro");
assert.equal(store.importJson(store.exportJson(state, {name: "Rede dinâmica"}).json).state.devices["pc-1"].name, "Servidor Financeiro");
for (const preset of presets.PRESETS) assert.equal(model.importScenario(preset.scenario).name, preset.scenario.name);
let converted = model.importScenario(presets.PRESETS[0].scenario).state;
converted = model.renameDevice(converted, "pc-a", "Servidor legado").state;
converted = model.addDevice(converted, "router").state;
assert.equal(model.importScenario(model.exportScenario(converted)).state.devices["pc-a"].name, "Servidor legado");
assert.equal(model.importScenario(model.exportScenario(converted)).state.devices["router-1"].name, "R-1");
const instance = exercise.generateExercise(exercise.EXERCISE_ID, "dynamic-compatibility", {difficulty: "advanced"});
assert.equal(exercise.validateExercise(instance, model.importScenario(instance.scenario).state).complete, false);
let renamedExercise = model.importScenario(instance.scenario).state;
renamedExercise = model.renameDevice(renamedExercise, instance.roles.sourceId, "Cliente Alfa").state;
renamedExercise = model.renameDevice(renamedExercise, instance.roles.routerId, "Roteador Central").state;
const exerciseVerdict = exercise.validateExercise(instance, renamedExercise);
assert.equal(exerciseVerdict.complete, false);
assert.equal(exerciseVerdict.result.status, "failure");
const removed = model.removeDevice(state, "pc-1").state;
assert.equal(removed.devices["pc-1"], undefined);
assert.equal(removed.interfaces["pc-1:eth0"], undefined);
assert.equal(removed.connections.some(link => link.a.startsWith("pc-1:") || link.b.startsWith("pc-1:")), false);
const next = model.addDevice(removed, "pc");
assert.equal(next.id, "pc-6");
assert.notEqual(next.id, "pc-1");
assert.throws(() => model.importScenario({...scenario, nextIds: {...scenario.nextIds, pc: 1}}), /Contador incompatível/);
console.log("Instâncias dinâmicas: IDs, nome, cabos, cenário, storage, presets e exercício aprovados.");
