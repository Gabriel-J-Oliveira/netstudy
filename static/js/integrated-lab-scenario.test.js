const assert = require("node:assert/strict");
const model = require("./integrated-lab-model.js");
const {simulate} = require("./integrated-lab-simulator.js");

const clone = value => JSON.parse(JSON.stringify(value));
let bench = model.create();
for (const [id, x, y] of [
  ["pc-a", .18, .22], ["sw1", .38, .25], ["r1", .62, .35],
  ["sw2", .43, .72], ["pc-b", .78, .75]
]) bench = model.position(bench, id, x, y).state;
bench = model.configure(bench, "pc-a", {ip: "192.168.10.15", gateway: "192.168.10.1"}).state;
bench = model.configure(bench, "pc-b", {ip: "192.168.20.25", gateway: "192.168.20.254"}).state;
bench = model.configure(bench, "r1", {eth1: {ip: "192.168.20.254", mac: "22:22:22:22:22:22"}}).state;
bench = model.configure(bench, "sw1", {allowedVlans: [10, 20]}).state;
bench = model.configure(bench, "sw2", {vlans: {"sw2:gi0/1": 20, "sw2:gi0/2": 20}, allowedVlans: [10, 20]}).state;
for (const [a, b] of [
  ["pc-a:eth0", "sw1:gi0/1"], ["r1:eth0", "sw1:gi0/2"],
  ["sw1:gi0/5", "sw2:gi0/5"], ["r1:eth1", "sw2:gi0/1"],
  ["pc-b:eth0", "sw2:gi0/2"]
]) bench = model.connect(bench, a, b).state;

const metadata = {name: "Duas redes por R1", sourceId: "pc-a", destinationId: "pc-b"};
const scenario = model.exportScenario(bench, metadata);
const canonical = clone(scenario);
assert.equal(scenario.schemaVersion, 1);
assert.equal(Object.hasOwn(scenario, "interfaces"), false);
assert.deepEqual(scenario.connections[0], {a: "pc-a:eth0", b: "sw1:gi0/1"});
for (const forbidden of ["events", "history", "arp", "mac", "routes", "result", "cursor", "mode", "index", "correctAnswer", "expectedFix"])
  assert.equal(Object.hasOwn(scenario, forbidden), false);
assert.deepEqual(Object.keys(scenario.devices["pc-a"]).sort(), ["config", "position"]);
assert.deepEqual(Object.keys(scenario.devices.sw1.config).sort(), ["allowedVlans", "vlans"]);
assert.deepEqual(Object.keys(scenario.devices.r1.config).sort(), ["eth0", "eth1"]);

const restored = model.importScenario(scenario);
assert.equal(restored.name, metadata.name);
assert.equal(restored.sourceId, "pc-a");
assert.equal(restored.destinationId, "pc-b");
assert.deepEqual(model.exportScenario(restored.state, metadata), canonical);
assert.equal(simulate(model.adapt(restored.state, restored.sourceId, restored.destinationId).input).status, "success");
assert.strictEqual(restored.state.interfaces, model.INTERFACES);

bench.devices["pc-a"].config.gateway = "192.168.99.1";
bench.devices.sw2.config.vlans["sw2:gi0/1"] = 10;
bench.connections[0].a = "pc-c:eth0";
assert.deepEqual(scenario, canonical, "alterar o estado não pode alterar o cenário exportado");

scenario.devices["pc-b"].config.ip = "192.168.99.99";
scenario.devices.r1.config.eth1.ip = "192.168.99.1";
scenario.devices.sw1.config.allowedVlans.pop();
scenario.connections[0].a = "pc-d:eth0";
assert.equal(bench.devices["pc-b"].config.ip, "192.168.20.25", "alterar o cenário não pode alterar o estado original");
assert.equal(bench.devices.r1.config.eth1.ip, "192.168.20.254");
assert.equal(bench.connections[0].a, "pc-c:eth0");
assert.equal(restored.state.devices["pc-b"].config.ip, "192.168.20.25");
assert.equal(restored.state.devices.r1.config.eth1.ip, "192.168.20.254");
assert.deepEqual(restored.state.devices.sw1.config.allowedVlans, [10, 20]);
assert.equal(restored.state.connections[0].a, "pc-a:eth0");

function rejects(change, pattern) {
  const input = clone(canonical);
  change(input);
  assert.throws(() => model.importScenario(input), pattern);
}
rejects(value => { value.schemaVersion = 2; }, /schemaVersion/);
rejects(value => { value.devices.unknown = {position: null, config: {}}; }, /Equipamentos/);
rejects(value => { delete value.devices["pc-a"]; }, /Equipamentos/);
rejects(value => { value.devices["pc-a"].interfaces = ["pc-a:eth0"]; }, /Equipamento/);
rejects(value => { value.connections[0].a = "pc-a:eth9"; }, /interface inexistente/);
rejects(value => { value.connections[0].b = "r1:eth0"; }, /Conexão inválida/);
rejects(value => { value.connections.push(clone(value.connections[0])); }, /Conexão inválida/);
rejects(value => { value.connections.push({a: "pc-c:eth0", b: "sw1:gi0/1"}); }, /Conexão inválida/);
rejects(value => { value.connections.push({a: "sw1:gi0/1", b: "sw2:gi0/1"}); }, /Conexão inválida/);
rejects(value => { value.devices["pc-a"].config.ip = "192.168.10.999"; }, /estruturalmente inválido/);
rejects(value => { value.devices.r1.config.eth1.mask = "255.0.255.0"; }, /estruturalmente inválido/);
rejects(value => { value.devices["pc-b"].config.gateway = "foo"; }, /estruturalmente inválido/);
rejects(value => { value.devices.sw2.config.vlans["sw2:gi0/1"] = 30; }, /VLANs inválidas/);
rejects(value => { value.devices["pc-a"].position.x = 2; }, /Posição inválida/);
rejects(value => { value.sourceId = "pc-a"; value.destinationId = "pc-a"; }, /Par de PCs inválido/);
rejects(value => { value.result = {status: "success"}; }, /Cenário/);
assert.throws(() => model.exportScenario(restored.state, {correctAnswer: "x"}), /Metadados/);
assert.deepEqual(model.importScenario(model.exportScenario(model.create())).state.devices["pc-c"].position, null);
console.log("Scenario Schema v1: round-trip, isolamento e rejeições aprovados.");
