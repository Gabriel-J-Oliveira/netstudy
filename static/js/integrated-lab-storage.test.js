const assert = require("node:assert/strict");
const model = require("./integrated-lab-model.js");
const storageModule = require("./integrated-lab-storage.js");

function memoryStorage() {
  const data = new Map();
  return {getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, value), data};
}
const local = memoryStorage();
const storage = storageModule.create(local);
let bench = model.create();
for (const [id, x, y] of [["pc-a", .2, .2], ["sw1", .4, .3], ["r1", .6, .4], ["pc-b", .8, .7]])
  bench = model.position(bench, id, x, y).state;
bench = model.configure(bench, "pc-a", {gateway: "192.168.10.1"}).state;
bench = model.configure(bench, "pc-b", {ip: "192.168.20.20", gateway: "192.168.20.1"}).state;
bench = model.configure(bench, "sw1", {allowedVlans: [10]}).state;
bench = model.connect(bench, "pc-a:eth0", "sw1:gi0/1").state;
const metadata = {name: "Duas redes", sourceId: "pc-a", destinationId: "pc-b"};

assert.deepEqual(storage.list(), []);
assert.deepEqual(storage.save(bench, metadata), {name: "Duas redes", overwritten: false});
assert.deepEqual(storage.list(), ["Duas redes"]);
const saved = JSON.parse(local.getItem(storageModule.KEY));
assert.equal(saved[0].schemaVersion, 1);
assert.deepEqual(Object.keys(saved[0]).sort(), ["connections", "destinationId", "devices", "name", "schemaVersion", "sourceId"]);
assert.equal(saved[0].devices["pc-a"].config.gateway, "192.168.10.1");
assert.deepEqual(saved[0].connections[0], {a: "pc-a:eth0", b: "sw1:gi0/1"});
assert.equal(JSON.stringify(saved).includes("events"), false);
assert.equal(JSON.stringify(saved).includes("tables"), false);
const loaded = storage.load("duas REDES");
assert.equal(loaded.sourceId, "pc-a");
assert.equal(loaded.destinationId, "pc-b");
assert.deepEqual(model.exportScenario(loaded.state, metadata), saved[0]);

bench.devices["pc-a"].config.gateway = "192.168.99.1";
assert.equal(storage.load("Duas redes").state.devices["pc-a"].config.gateway, "192.168.10.1");
loaded.state.devices["pc-b"].config.ip = "1.2.3.4";
assert.equal(storage.load("Duas redes").state.devices["pc-b"].config.ip, "192.168.20.20");
saved[0].devices.r1.config.eth0.ip = "10.0.0.1";
assert.equal(storage.load("Duas redes").state.devices.r1.config.eth0.ip, "192.168.10.1");

assert.throws(() => storage.save(bench, metadata), /Já existe/);
assert.throws(() => storage.save(bench, {...metadata, name: "  "}), /Informe um nome/);
assert.deepEqual(storage.save(bench, metadata, true), {name: "Duas redes", overwritten: true});
assert.equal(storage.load("Duas redes").state.devices["pc-a"].config.gateway, "192.168.99.1");
assert.deepEqual(storage.list(), ["Duas redes"]);
storage.save(model.create(), {name: "Vazia"});
assert.deepEqual(storage.list(), ["Duas redes", "Vazia"]);
assert.equal(storage.remove("Vazia"), "Vazia");
assert.deepEqual(storage.list(), ["Duas redes"]);
assert.throws(() => storage.remove("Vazia"), /não encontrado/);

const exported = storage.exportJson(bench, metadata);
assert.equal(exported.filename, "duas-redes.json");
assert.equal(exported.json.endsWith("\n"), true);
assert.deepEqual(model.exportScenario(storage.importJson(exported.json).state, metadata), JSON.parse(exported.json));
assert.throws(() => storage.importJson("{"), /JSON inválido/);
assert.throws(() => storage.importJson(JSON.stringify({...JSON.parse(exported.json), schemaVersion: 2})), /schemaVersion/);
assert.throws(() => storage.importJson(JSON.stringify({...JSON.parse(exported.json), connections: [{a: "pc-a:eth0", b: "r1:eth0"}]})), /Conexão inválida/);

const invalidBench = model.configure(model.create(), "pc-a", {ip: "999.1.1.1"}).state;
const before = local.getItem(storageModule.KEY);
assert.throws(() => storage.save(invalidBench, {name: "Inválido"}), /estruturalmente inválido/);
assert.equal(local.getItem(storageModule.KEY), before);

for (const corrupt of ["{", "{}", JSON.stringify([{...JSON.parse(exported.json), schemaVersion: 2}]),
  JSON.stringify([JSON.parse(exported.json), JSON.parse(exported.json)])]) {
  local.setItem(storageModule.KEY, corrupt);
  assert.throws(() => storage.list(), /corrompidos|inválidos/);
  assert.throws(() => storage.save(bench, {name: "Outra"}), /corrompidos|inválidos/);
  assert.equal(local.getItem(storageModule.KEY), corrupt, "dados corrompidos não devem ser sobrescritos");
}
console.log("Storage: salvar, listar, carregar, sobrescrever, excluir, JSON e corrupção aprovados.");
