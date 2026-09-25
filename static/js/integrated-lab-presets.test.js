const assert = require("node:assert/strict");
const model = require("./integrated-lab-model.js");
const simulator = require("./integrated-lab-simulator.js");
const storageModule = require("./integrated-lab-storage.js");

let localTouches = 0;
global.localStorage = {getItem: () => { localTouches++; throw new Error("preset acessou localStorage"); },
  setItem: () => { localTouches++; throw new Error("preset gravou localStorage"); }};
const {PRESETS} = require("./integrated-lab-presets.js");
delete global.localStorage;
assert.equal(localTouches, 0);
assert.deepEqual(PRESETS.map(item => item.id), ["basic-lan", "separate-vlans", "switch-trunk", "two-networks-router"]);
assert.equal(new Set(PRESETS.map(item => item.scenario.name)).size, 4);

const byId = Object.fromEntries(PRESETS.map(item => [item.id, item]));
for (const preset of PRESETS) {
  const original = JSON.stringify(preset.scenario);
  assert.equal(preset.scenario.schemaVersion, model.SCENARIO_VERSION);
  assert.deepEqual(Object.keys(preset.scenario).sort(),
    ["connections", "destinationId", "devices", "name", "schemaVersion", "sourceId"]);
  assert.equal(Object.isFrozen(preset.scenario.devices["pc-a"].config), true);
  const restored = model.importScenario(preset.scenario);
  assert.equal(restored.name, preset.scenario.name);
  assert.deepEqual(model.exportScenario(restored.state, {
    name: restored.name, sourceId: restored.sourceId, destinationId: restored.destinationId
  }), preset.scenario);
  restored.state.devices["pc-a"].config.ip = "10.99.99.99";
  restored.state.devices["pc-a"].position.x = .9;
  assert.equal(JSON.stringify(preset.scenario), original, "editar uma bancada não pode alterar o preset");
}

function run(id) {
  const restored = model.importScenario(byId[id].scenario);
  return simulator.simulate(model.adapt(restored.state, restored.sourceId, restored.destinationId).input);
}
const lan = byId["basic-lan"].scenario;
assert.deepEqual(lan.connections, [
  {a: "pc-a:eth0", b: "sw1:gi0/1"}, {a: "pc-b:eth0", b: "sw1:gi0/2"}
]);
assert.equal(lan.devices["pc-a"].config.ip, "192.168.10.10");
assert.equal(lan.devices["pc-b"].config.ip, "192.168.10.20");
assert.equal(lan.devices.sw1.config.vlans["sw1:gi0/1"], 10);
assert.equal(lan.devices.sw1.config.vlans["sw1:gi0/2"], 10);
assert.equal(run("basic-lan").status, "success");

const isolated = byId["separate-vlans"].scenario;
assert.equal(isolated.devices.sw1.config.vlans["sw1:gi0/1"], 10);
assert.equal(isolated.devices.sw1.config.vlans["sw1:gi0/2"], 20);
assert.equal(isolated.devices["pc-b"].config.ip, "192.168.20.20");
assert.equal(isolated.devices.r1.position, null);
assert.equal(run("separate-vlans").status, "failure");

const trunk = byId["switch-trunk"].scenario;
assert.deepEqual(trunk.connections.filter(link => link.a.endsWith("gi0/5") || link.b.endsWith("gi0/5")),
  [{a: "sw1:gi0/5", b: "sw2:gi0/5"}]);
assert.equal(trunk.devices.sw1.config.vlans["sw1:gi0/1"], 10);
assert.equal(trunk.devices.sw2.config.vlans["sw2:gi0/1"], 10);
const trunkResult = run("switch-trunk");
assert.equal(trunkResult.status, "success");
assert.ok(trunkResult.events.some(event => event.id === "trunk-out" && event.frame?.vlanTag === 10));

const routed = byId["two-networks-router"].scenario;
assert.equal(routed.sourceId, "pc-a");
assert.equal(routed.destinationId, "pc-c");
assert.equal(routed.devices["pc-a"].config.gateway, "192.168.10.1");
assert.equal(routed.devices["pc-c"].config.ip, "192.168.20.30");
assert.equal(routed.devices["pc-c"].config.gateway, "192.168.20.1");
assert.equal(routed.devices.r1.config.eth0.ip, "192.168.10.1");
assert.equal(routed.devices.r1.config.eth1.ip, "192.168.20.1");
assert.ok(routed.connections.some(link => link.a === "r1:eth0" && link.b === "sw1:gi0/2"));
assert.ok(routed.connections.some(link => link.a === "r1:eth1" && link.b === "sw2:gi0/2"));
assert.equal(routed.devices.sw2.config.vlans["sw2:gi0/1"], 20);
assert.equal(routed.devices.sw2.config.vlans["sw2:gi0/2"], 20);
const routedResult = run("two-networks-router");
assert.equal(routedResult.status, "success");
const incoming = routedResult.events.find(event => event.id === "frame-in");
const outgoing = routedResult.events.find(event => event.id === "frame-out");
assert.equal(incoming.packet.destination, "192.168.20.30");
assert.equal(outgoing.packet.destination, "192.168.20.30");
assert.equal(outgoing.packet.ttl, incoming.packet.ttl - 1);

const data = new Map();
const personal = storageModule.create({getItem: key => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value)});
const originalPreset = JSON.stringify(routed);
const restored = model.importScenario(routed);
assert.deepEqual(personal.list(), [], "carregar preset não salva automaticamente");
assert.equal(data.has(storageModule.KEY), false);
restored.state.devices["pc-c"].config.ip = "192.168.20.40";
personal.save(restored.state, {name: "Minha cópia", sourceId: "pc-a", destinationId: "pc-c"});
assert.deepEqual(personal.list(), ["Minha cópia"]);
assert.equal(JSON.stringify(routed), originalPreset);
console.log("Presets: quatro schemas válidos, topologias, resultados e isolamento aprovados.");
