const assert = require("node:assert/strict");
const model = require("./integrated-lab-model.js");
const simulator = require("./integrated-lab-simulator.js");
const engine = require("./integrated-lab-exercise-engine.js");
const ID = engine.EXERCISE_ID;
const restore = instance => model.importScenario(instance.scenario).state;
const run = state => simulator.simulate(model.adapt(state, "pc-a", "pc-c").input);
function repair(state, fault) {
  if (fault.kind === "gateway") return model.configure(state, "pc-a", {gateway: "192.168.10.1"}).state;
  if (fault.kind === "mask") return model.configure(state, "pc-a", {mask: "255.255.255.0"}).state;
  if (fault.kind === "access-vlan") return model.configure(state, "sw2", {vlans: {"sw2:gi0/3": 20}}).state;
  if (fault.kind === "trunk") return model.configure(state, fault.side, {allowedVlans: [10, 20]}).state;
  return model.configure(state, "r1", {eth1: {ip: "192.168.20.1", mask: "255.255.255.0"}}).state;
}

assert.throws(() => engine.generateExercise("unknown", 1), /desconhecidos/);
assert.throws(() => engine.generateExercise(ID, "", {difficulty: "advanced"}), /Seed inválida/);
assert.throws(() => engine.generateExercise(ID, 1, {difficulty: "easy"}), /desconhecidos/);
assert.deepEqual(engine.generateExercise(ID, "same", {difficulty: "advanced"}),
  engine.generateExercise(ID, "same", {difficulty: "advanced"}));
const signatures = new Set(), faultKinds = new Set(), categories = new Set();
let maskSeed, gatewayRouteSeed;
for (const difficulty of ["intermediate", "advanced"]) {
  for (let seed = 0; seed < 100; seed++) {
    const instance = engine.generateExercise(ID, seed, {difficulty});
    const scenario = instance.scenario;
    assert.equal(scenario.schemaVersion, model.SCENARIO_VERSION);
    assert.deepEqual(Object.keys(scenario).sort(), ["connections", "destinationId", "devices", "name", "schemaVersion", "sourceId"]);
    for (const forbidden of ["faultMetadata", "fault", "objective", "invariants", "solution", "correctAnswer", "hint"])
      assert.equal(Object.hasOwn(scenario, forbidden), false);
    assert.equal(instance.faultMetadata.length, difficulty === "advanced" ? 2 : 1);
    assert.equal(new Set(instance.faultMetadata.map(fault => fault.kind)).size, instance.faultMetadata.length);
    signatures.add(JSON.stringify(scenario));
    instance.faultMetadata.forEach(fault => faultKinds.add(fault.kind));
    const broken = restore(instance);
    assert.equal(run(broken).status, "failure", `seed ${seed} deve realmente quebrar a entrega`);
    const initial = engine.validateExercise(instance, broken);
    assert.equal(initial.complete, false);
    assert.ok(initial.feedback.length > 30);
    categories.add(initial.category);
    if (difficulty === "advanced") {
      const firstOnly = repair(broken, instance.faultMetadata[0]);
      assert.equal(engine.validateExercise(instance, firstOnly).complete, false,
        `seed ${seed}: corrigir só uma falha não conclui o exercício`);
      if (instance.faultMetadata.map(fault => fault.kind).join(",") === "mask,trunk") maskSeed = seed;
      if (instance.faultMetadata.map(fault => fault.kind).join(",") === "gateway,router-interface") gatewayRouteSeed = seed;
    }
    const repaired = instance.faultMetadata.reduce(repair, broken);
    assert.equal(run(repaired).status, "success", `seed ${seed}: rede base deve funcionar`);
    const solved = engine.validateExercise(instance, repaired);
    assert.equal(solved.complete, true, `seed ${seed}: ${solved.feedback}`);
    assert.equal(solved.category, "success");
    assert.match(solved.feedback, /cenário inicial falhava/i);
    if (difficulty === "intermediate" && seed === 0) {
      const bypass = model.configure(repaired, "pc-c", {ip: "192.168.10.30"}).state;
      const sameVlan = model.configure(bypass, "sw2", {vlans: {"sw2:gi0/3": 10}}).state;
      assert.equal(run(sameVlan).status, "success", "a entrega pode voltar de forma arquiteturalmente incorreta");
      const verdict = engine.validateExercise(instance, sameVlan);
      assert.equal(verdict.complete, false);
      assert.equal(verdict.category, "invariant");
    }
  }
}
assert.ok(signatures.size > 50, "seeds diferentes devem variar topologia/configuração/falhas");
assert.deepEqual([...faultKinds].sort(), ["access-vlan", "gateway", "mask", "router-interface", "trunk"]);
for (const code of ["local-mask", "gateway-offlink", "gateway-arp", "vlan-destination", "trunk-blocked", "route-missing"])
  assert.ok(categories.has(code), `feedback ${code} deve ocorrer nas seeds iniciais`);

assert.notEqual(maskSeed, undefined);
let instance = engine.generateExercise(ID, maskSeed, {difficulty: "advanced"});
let bench = restore(instance);
assert.equal(engine.validateExercise(instance, bench).category, "local-mask");
bench = repair(bench, instance.faultMetadata[0]);
assert.equal(engine.validateExercise(instance, bench).category, "trunk-blocked");
assert.notEqual(gatewayRouteSeed, undefined);
instance = engine.generateExercise(ID, gatewayRouteSeed, {difficulty: "advanced"});
bench = restore(instance);
assert.ok(["gateway-offlink", "gateway-arp"].includes(engine.validateExercise(instance, bench).category));
bench = repair(bench, instance.faultMetadata[0]);
assert.equal(engine.validateExercise(instance, bench).category, "route-missing");

const sample = engine.generateExercise(ID, "feedback", {difficulty: "intermediate"});
const absentGateway = model.configure(restore(sample), "pc-a", {gateway: ""}).state;
assert.equal(engine.validateExercise(sample, absentGateway).category, "gateway-missing");
const sourceUnplugged = model.disconnect(absentGateway,
  absentGateway.connections.find(link => link.a === "pc-a:eth0" || link.b === "pc-a:eth0").id).state;
assert.equal(engine.validateExercise(sample, sourceUnplugged).category, "source-cable");
const invalid = model.configure(restore(sample), "pc-a", {ip: "192.168.10.999"}).state;
assert.equal(engine.validateExercise(sample, invalid).category, "invalid");
console.log("Exercise Engine v1: determinismo, falhas, correções, invariantes e feedback aprovados.");
