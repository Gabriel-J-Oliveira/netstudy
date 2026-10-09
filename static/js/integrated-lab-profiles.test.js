const assert = require("node:assert/strict");
const profiles = require("./integrated-lab-profiles.js");
const model = require("./integrated-lab-model.js");
const simulator = require("./integrated-lab-simulator.js");
const storageApi = require("./integrated-lab-storage.js");
const {PRESETS} = require("./integrated-lab-presets.js");
const engine = require("./integrated-lab-exercise-engine.js");
const clone = value => JSON.parse(JSON.stringify(value));
for (const type of ["pc", "switch", "router"]) {
  assert.equal(profiles.list(type).length, 3);
  for (const p of profiles.list(type)) {
    const added = model.addDevice(model.createEmpty(), type, p.id);
    assert.equal(added.state.devices[added.id].profile, p.id);
    const device = added.state.devices[added.id];
    device.interfaces.forEach((id, i) => assert.equal(model.interfaceName(added.state, id), p.interfaceNames[i]));
    assert.ok(p.displayType && p.terminal.dialect && p.terminal.promptTemplate && profiles.prompt(device));
    assert.equal(p.terminal.implemented, ["cisco-ios", "windows", "linux", "mikrotik-routeros", "dell-os10"].includes(p.id));
    assert.equal(p.terminal.commandAdapter, p.id === "cisco-ios" ? "cisco-ios-v1" : p.id === "mikrotik-routeros" ? "routeros-v1" : p.id === "dell-os10" ? "dell-os10-v1" : ["windows", "linux"].includes(p.id) ? `host-${p.id}-v1` : null);
    assert.ok(Object.isFrozen(p) && Object.isFrozen(p.capabilities) && Object.isFrozen(p.interfaceNames));
    const scenario = model.exportScenario(added.state);
    assert.equal(scenario.schemaVersion, 1);
    assert.equal(model.importScenario(scenario).state.devices[added.id].profile, p.id);
    const old = clone(scenario); delete old.devices[added.id].profile;
    assert.equal(model.importScenario(old).state.devices[added.id].profile, "generic");
    const invalid = clone(scenario); invalid.devices[added.id].profile = "unknown";
    assert.throws(() => model.importScenario(invalid), /Profile/);
    invalid.devices[added.id].profile = null;
    assert.throws(() => model.importScenario(invalid), /Profile/);
  }
}
assert.ok(model.addDevice(model.createEmpty(), "switch", "windows").error);
assert.ok(model.addDevice(model.createEmpty(), "pc", "cisco-ios").error);
assert.equal(profiles.get("switch", "cisco-ios").interfaceNames[0], "GigabitEthernet1/0/1");
assert.equal(profiles.get("switch", "dell-os10").interfaceNames[0], "ethernet1/1/1");
assert.equal(profiles.get("router", "mikrotik-routeros").interfaceNames[0], "ether1");
assert.equal(profiles.get("pc", "windows").interfaceNames[0], "Ethernet");
assert.equal(profiles.get("pc", "linux").interfaceNames[0], "eth0");

const preset = PRESETS.find(p => p.id === "two-networks-router");
const restored = model.importScenario(preset.scenario);
const simulate = state => simulator.simulate(model.adapt(state, restored.sourceId, restored.destinationId).input);
let bench = restored.state;
const originalResult = simulate(bench), originalInterfaces = clone(bench.interfaces), originalConnections = clone(bench.connections);
assert.equal(originalResult.status, "success");
for (const [id, device] of Object.entries(bench.devices)) {
  const next = device.type === "pc" ? "windows" : device.type === "switch" ? "dell-os10" : "mikrotik-routeros";
  bench = model.setProfile(bench, id, next).state;
}
assert.deepEqual(bench.interfaces, originalInterfaces, "identidade e nomes canônicos nunca mudam");
assert.deepEqual(bench.connections, originalConnections);
assert.deepEqual(simulate(bench), originalResult, "ARP, VLAN, trunk, frames, TTL e rotas são independentes do profile");
assert.equal(restored.state.devices.r1.profile, "generic", "troca é imutável");
assert.ok(model.setProfile(bench, "r1", "linux").error);
assert.ok(model.setProfile(bench, "r1", undefined).error);

const memory = new Map();
const storage = storageApi.create({getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value)});
storage.save(bench, {name: "Profiles", sourceId: restored.sourceId, destinationId: restored.destinationId});
const loaded = storage.load("Profiles");
assert.equal(loaded.state.devices.r1.profile, "mikrotik-routeros");
assert.equal(loaded.state.devices.sw1.profile, "dell-os10");
assert.equal(loaded.state.devices["pc-a"].profile, "windows");
const json = JSON.parse(JSON.stringify(model.exportScenario(loaded.state)));
assert.equal(model.importScenario(json).state.devices.r1.profile, "mikrotik-routeros");
const legacy = clone(preset.scenario);
for (const device of Object.values(legacy.devices)) delete device.profile;
assert.ok(Object.values(model.importScenario(legacy).state.devices).every(d => d.profile === "generic"));
assert.ok(PRESETS.filter(p => !p.id.startsWith("external-") && p.id !== "lan-services").every(p => Object.values(p.scenario.devices).every(d => d.profile === "generic")));
for (const family of engine.FAMILY_IDS.filter(id => !["static-routing", "external-routing", "nat-pat", "services"].includes(id))) for (const difficulty of ["intermediate", "advanced"]) {
  const item = engine.generateExercise(family, "profiles", {difficulty});
  const base = engine.inspectExercise(item).base;
  let changed = base;
  for (const [id, d] of Object.entries(base.devices)) changed = model.setProfile(changed, id, d.type === "pc" ? "linux" : "cisco-ios").state;
  assert.equal(engine.validateExercise(item, changed).complete, true);
  const scenario = model.exportScenario(changed);
  assert.ok(Object.values(model.importScenario(scenario).state.devices).every(d => d.profile !== "generic"));
  const broken = model.importScenario(item.scenario).state;
  const verdict = engine.validateExercise(item, broken);
  const changedBroken = Object.keys(broken.devices).reduce((state, id) => model.setProfile(state, id, broken.devices[id].type === "pc" ? "windows" : "cisco-ios").state, broken);
  assert.equal(engine.validateExercise(item, changedBroken).category, verdict.category);
  assert.equal(engine.validateExercise(item, changedBroken).complete, false);
}
console.log("Device Profiles v1: nove profiles, interfaces estáveis, persistência, legado e exercícios aprovados.");
