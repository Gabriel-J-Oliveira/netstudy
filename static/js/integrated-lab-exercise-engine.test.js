const assert = require("node:assert/strict");
const model = require("./integrated-lab-model.js");
const simulator = require("./integrated-lab-simulator.js");
const engine = require("./integrated-lab-exercise-engine.js");
const ID = engine.EXERCISE_ID;
const restore = instance => model.importScenario(instance.scenario).state;
const run = state => simulator.simulate(model.adapt(state, "pc-1", "pc-3").input);
function repair(state, fault) {
  if (fault.kind === "gateway") return model.configure(state, "pc-1", {gateway: "192.168.10.1"}).state;
  if (fault.kind === "mask") return model.configure(state, "pc-1", {mask: "255.255.255.0"}).state;
  if (fault.kind === "access-vlan") return model.configure(state, "switch-2", {vlans: {"switch-2:gi0/3": 20}}).state;
  if (fault.kind === "trunk") return model.configure(state, fault.side, {allowedVlans: [10, 20]}).state;
  return model.configure(state, "router-1", {eth1: {ip: "192.168.20.1", mask: "255.255.255.0"}}).state;
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
    assert.deepEqual(Object.keys(scenario).sort(), ["connections", "destinationId", "devices", "format", "name", "nextIds", "schemaVersion", "sourceId"]);
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
      const bypass = model.configure(repaired, "pc-3", {ip: "192.168.10.30"}).state;
      const sameVlan = model.configure(bypass, "switch-2", {vlans: {"switch-2:gi0/3": 10}}).state;
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
const absentGateway = model.configure(restore(sample), "pc-1", {gateway: ""}).state;
assert.equal(engine.validateExercise(sample, absentGateway).category, "gateway-missing");
const sourceUnplugged = model.disconnect(absentGateway,
  absentGateway.connections.find(link => link.a === "pc-1:eth0" || link.b === "pc-1:eth0").id).state;
assert.equal(engine.validateExercise(sample, sourceUnplugged).category, "source-cable");
const invalid = model.configure(restore(sample), "pc-1", {ip: "192.168.10.999"}).state;
assert.equal(engine.validateExercise(sample, invalid).category, "invalid");
console.log("Exercise Engine v1: determinismo, falhas, correções, invariantes e feedback aprovados.");

// Famílias novas: instrumentação privada só existe sob CommonJS, nunca na UI.
function repairFamily(state, fault) {
  if (!fault.values) return model.connect(state, fault.link.a, fault.link.b).state;
  const values = {};
  for (const key of Object.keys(fault.values)) {
    values[key] = ["eth0", "eth1", "vlans"].includes(key)
      ? Object.fromEntries(Object.keys(fault.values[key]).map(k => [k, fault.original[key][k]]))
      : fault.original[key];
  }
  return model.configure(state, fault.deviceId, values).state;
}
const observedFamilies = new Set(), newCategories = new Set(), observedFaults = new Set();
assert.equal(engine.FAMILY_IDS.length, 9);
for (const family of engine.FAMILY_IDS.filter(id => !["static-routing", "external-routing", "nat-pat", "services"].includes(id))) {
  const variations = new Set();
  for (const difficulty of ["intermediate", "advanced"]) {
    for (let seed = 0; seed < 45; seed++) {
      const item = engine.generateExercise(family, seed, {difficulty});
      assert.deepEqual(item, engine.generateExercise(family, seed, {difficulty}));
      const debug = engine.inspectExercise(item);
      assert.equal(run(debug.base).status, "success", `${family}/${difficulty}/${seed}: base funcional`);
      assert.equal(debug.faults.length, difficulty === "advanced" ? 2 : 1);
      debug.faults.forEach(f => { observedFaults.add(f.kind); if (family === "mixed") observedFamilies.add(f.family); });
      if (family === "mixed" && difficulty === "advanced") assert.equal(new Set(debug.faults.map(f => f.family)).size, 2);
      variations.add(JSON.stringify(item.scenario));
      assert.equal(item.scenario.schemaVersion, 1);
      for (const key of ["faultMetadata", "faults", "base", "solution", "correctAnswer", "invariants"])
        assert.equal(Object.hasOwn(item, key), false, `${key} não deve chegar à UI`);
      const broken = restore(item);
      assert.equal(run(broken).status, "failure");
      const initial = engine.validateExercise(item, broken);
      assert.equal(initial.complete, false);
      newCategories.add(initial.category);
      assert.doesNotMatch(item.prompt, /switch-\d|SW-\d|255\.255|192\.168|\/24|gateway incorreto|VLAN errada|falha de/i);
      if (difficulty === "advanced") {
        // A correção da primeira falha visível deve revelar a etapa restante.
        const partials = debug.faults.map(f => engine.validateExercise(item, repairFamily(broken, f)));
        assert.ok(partials.every(p => !p.complete && p.result.status === "failure"));
        assert.ok(partials.some(p => p.feedback !== initial.feedback), `${family}/${seed}: feedback deve acompanhar correção parcial`);
        partials.forEach(p => newCategories.add(p.category));
      }
      const solved = debug.faults.reduce(repairFamily, broken);
      assert.equal(run(solved).status, "success");
      assert.equal(engine.validateExercise(item, solved).complete, true);
      // Remover um distrator não pode servir como solução destrutiva.
      const removed = model.removeDevice(solved, "pc-4").state;
      assert.equal(run(removed).status, "success");
      assert.equal(engine.validateExercise(item, removed).category, "invariant");
      if (!["ipv4", "mixed"].includes(family)) {
        const ip = solved.devices["pc-1"].config.ip.split("."); ip[3] = "70";
        const changed = model.configure(solved, "pc-1", {ip: ip.join(".")}).state;
        assert.equal(run(changed).status, "success");
        assert.equal(engine.validateExercise(item, changed).category, "invariant");
      }
      assert.throws(() => engine.validateExercise(JSON.parse(JSON.stringify(item)), solved), /Instância/);
      // O registro privado e o cenário são cópias isoladas.
      debug.base.devices["pc-1"].config.ip = "0.0.0.0";
      assert.notEqual(engine.inspectExercise(item).base.devices["pc-1"].config.ip, "0.0.0.0");
    }
  }
  assert.ok(variations.size > 40, `${family}: várias seeds devem variar a instância`);
}
assert.deepEqual([...observedFamilies].sort(), ["ipv4", "routing", "trunk-8021q", "vlan-access"]);
// Atalhos que restauram a entrega ainda precisam ser rejeitados.
const accessItem = engine.generateExercise("vlan-access", "shortcut");
const accessBase = engine.inspectExercise(accessItem).base;
let collapsed = accessBase;
for (const id of ["switch-1", "switch-2"])
  collapsed = model.configure(collapsed, id, {vlans: Object.fromEntries(Object.keys(collapsed.devices[id].config.vlans).map(port => [port, 20]))}).state;
assert.equal(run(collapsed).status, "success");
assert.equal(engine.validateExercise(accessItem, collapsed).category, "invariant");
const trunkItem = engine.generateExercise("trunk-8021q", "shortcut");
const trunkBase = engine.inspectExercise(trunkItem).base;
const destCable = trunkBase.connections.find(link => [link.a, link.b].includes("pc-3:eth0"));
let bypassTrunk = model.disconnect(trunkBase, destCable.id).state;
bypassTrunk = model.connect(bypassTrunk, "pc-3:eth0", "switch-1:gi0/4").state;
assert.equal(run(bypassTrunk).status, "success");
assert.equal(engine.validateExercise(trunkItem, bypassTrunk).category, "invariant");
let blockedItem;
for (let seed = 0; !blockedItem; seed++) {
  const item = engine.generateExercise("trunk-8021q", seed);
  if (run(restore(item)).events.some(e => e.id === "trunk-blocked")) blockedItem = item;
}
const raw = run(restore(blockedItem)), rawCopy = JSON.stringify(raw);
const presented = engine.presentResult(blockedItem, raw);
assert.equal(JSON.stringify(raw), rawCopy, "a apresentação não muda eventos do simulador");
for (const event of presented.events.filter(e => e.id === "trunk-blocked")) {
  assert.doesNotMatch(event.observation + event.explanation, /SW-\d|switch-\d/);
  assert.equal(event.focusId, null);
}
assert.ok(presented.events.every(e => !e.explanation.includes("não está admitida no uplink")));
for (const kind of ["host-ip", "host-mask", "gateway", "gateway-missing", "host-network", "access-source", "access-destination", "trunk-allowed", "trunk-disconnected", "router-input-ip", "router-output-ip", "router-output-mask", "router-input-disconnected", "router-output-disconnected"])
  assert.ok(observedFaults.has(kind), `variação ${kind} deve existir`);
for (const code of ["host-classification", "gateway-missing", "gateway-offlink", "gateway-arp", "access-incompatible", "trunk-blocked", "l2-interrupted", "route-missing", "routing-interface"])
  assert.ok(newCategories.has(code), `feedback ${code} deve ocorrer`);

const routeVariations = new Set();
for (const difficulty of ["intermediate", "advanced"]) for (let seed = 0; seed < 24; seed++) {
  const item = engine.generateExercise("static-routing", seed, {difficulty});
  assert.deepEqual(item, engine.generateExercise("static-routing", seed, {difficulty}), "seed reproduz o exercício");
  const internal = engine.inspectExercise(item), broken = restore(item);
  assert.equal(internal.faults.length, difficulty === "advanced" ? 2 : 1);
  assert.equal(simulator.simulate(model.adapt(internal.routeBase, "pc-1", "pc-2").input).status, "success");
  assert.equal(simulator.simulate(model.adapt(broken, "pc-1", "pc-2").input).status, "failure");
  const initial = engine.validateExercise(item, broken);
  assert.equal(initial.complete, false);
  routeVariations.add(internal.faults.map(f => `${f.side}:${f.kind}`).join("+"));
  if (difficulty === "advanced") {
    const partial = model.configure(broken, "router-1", {staticRoutes: internal.routeBase.devices["router-1"].config.staticRoutes}).state;
    const after = engine.validateExercise(item, partial);
    assert.equal(after.complete, false);
    assert.equal(after.category, "return-route", "correção da ida revela a falha da volta");
  }
  assert.equal(engine.validateExercise(item, internal.routeBase).complete, true);
  const shortcut = model.configure(internal.routeBase, "pc-1", {ip: "192.168.10.222"}).state;
  assert.equal(engine.validateExercise(item, shortcut).category, "invariant");
  assert.doesNotMatch(JSON.stringify(item), /faults|solution|routeBase|correctAnswer/);
}
assert.ok(routeVariations.size >= 4, "as seeds variam lado e tipo da falha de rota");
for (const environment of engine.OPERATIONAL_VARIANTS) {
  const item = engine.generateExercise('static-routing', `ops-${environment}`, {mode:'operational', environment});
  const bench = restore(item), internal = engine.inspectExercise(item);
  assert.equal(item.environment, environment);
  assert.ok(Object.values(bench.devices).every(device => device.profile !== 'generic'));
  assert.equal(engine.validateExercise(item, bench).complete, false);
  assert.equal(engine.validateExercise(item, internal.routeBase).complete, true);
}

const vm = require("node:vm"), fs = require("node:fs");
const browserContext = vm.createContext({});
for (const file of ["./integrated-lab-simulator.js", "./integrated-lab-profiles.js", "./integrated-lab-model.js", "./integrated-lab-presets.js", "./integrated-lab-services.js", "./integrated-lab-exercise-engine.js"])
  vm.runInContext(fs.readFileSync(require.resolve(file), "utf8"), browserContext);
assert.equal(browserContext.NetStudyLabExerciseEngine.inspectExercise, undefined);
for (const family of [...engine.FAMILY_IDS, engine.EXERCISE_ID]) {
  const publicItem = browserContext.NetStudyLabExerciseEngine.generateExercise(family, "public", {difficulty: "advanced"});
  assert.doesNotMatch(JSON.stringify(publicItem), /faultMetadata|"faults"|"solution"|correctAnswer|"invariants"|"base"/);
  assert.equal(browserContext.NetStudyLabExerciseEngine.validateExercise(publicItem, browserContext.NetStudyLabModel.importScenario(publicItem.scenario).state).complete, false);
}
console.log("Exercise Engine: nove famílias, bases, seeds, duas falhas, feedback parcial e privacidade aprovados.");
