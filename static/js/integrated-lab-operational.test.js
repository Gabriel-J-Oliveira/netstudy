const assert = require("node:assert/strict");
const engine = require("./integrated-lab-exercise-engine.js");
const terminal = require("./integrated-lab-terminal.js");
const model = require("./integrated-lab-model.js");
const simulator = require("./integrated-lab-simulator.js");

const restore = instance => model.importScenario(instance.scenario).state;
const run = state => simulator.simulate(model.adapt(state, "pc-1", "pc-3").input);
function repair(state, fault) {
  if (!fault.values) return model.connect(state, fault.link.a, fault.link.b).state;
  const values = {};
  for (const key of Object.keys(fault.values)) values[key] = ["eth0", "eth1", "vlans"].includes(key)
    ? Object.fromEntries(Object.keys(fault.values[key]).map(field => [field, fault.original[key][field]]))
    : fault.original[key];
  return model.configure(state, fault.deviceId, values).state;
}
const profilesByVariant = {
  "cisco-windows": {pc: "windows", switch: "cisco-ios", router: "cisco-ios"},
  "cisco-linux": {pc: "linux", switch: "cisco-ios", router: "cisco-ios"},
  "dell-windows": {pc: "windows", switch: "dell-os10", router: "cisco-ios"},
  "mikrotik-hosts": {switch: "cisco-ios", router: "mikrotik-routeros"},
  mixed: {router: "mikrotik-routeros"}
};
assert.deepEqual(engine.OPERATIONAL_VARIANTS, Object.keys(profilesByVariant));
assert.throws(() => engine.generateExercise("routing", "x", {mode: "unknown"}), /Modo/);
assert.throws(() => engine.generateExercise("routing", "x", {mode: "operational", environment: "unknown"}), /Ambiente/);
assert.throws(() => engine.generateExercise("vlan-access", "x", {mode: "operational", environment: "mikrotik-hosts"}), /incompatível/);
const observed = new Set();
for (const family of engine.FAMILY_IDS.filter(id => !["static-routing", "external-routing", "nat-pat", "services"].includes(id))) for (const difficulty of ["intermediate", "advanced"]) {
  for (let seed = 0; seed < 14; seed++) {
    const options = {difficulty, mode: "operational"};
    const item = engine.generateExercise(family, seed, options);
    assert.deepEqual(item, engine.generateExercise(family, seed, options), "a seed reproduz profiles e falhas");
    const benchItem = engine.generateExercise(family, seed, {difficulty});
    const withoutProfiles = scenario => {
      const copy = JSON.parse(JSON.stringify(scenario));
      for (const device of Object.values(copy.devices)) device.profile = "generic";
      return copy;
    };
    assert.deepEqual(withoutProfiles(item.scenario), benchItem.scenario, "modo operacional preserva a rede e as falhas da mesma seed");
    observed.add(item.environment);
    const debug = engine.inspectExercise(item), broken = restore(item);
    assert.equal(item.mode, "operational");
    assert.equal(debug.faults.length, difficulty === "advanced" ? 2 : 1);
    assert.equal(run(debug.base).status, "success");
    assert.equal(run(broken).status, "failure");
    assert.equal(engine.validateExercise(item, broken).complete, false);
    assert.deepEqual(engine.attemptAnalysis(item), {commandCount: 0, commands: []});
    assert.ok(Object.values(broken.devices).every(device => device.profile !== "generic"));
    for (const device of Object.values(broken.devices)) {
      const expected = profilesByVariant[item.environment][device.type];
      if (expected) assert.equal(device.profile, expected);
    }
    if (item.environment === "mixed") {
      assert.equal(broken.devices["switch-1"].profile, "cisco-ios");
      assert.equal(broken.devices["switch-2"].profile, "dell-os10");
      assert.equal(broken.devices["pc-1"].profile, "windows");
      assert.equal(broken.devices["pc-3"].profile, "linux");
    }
    const presented = engine.presentResult(item, run(broken));
    for (const event of presented.events.filter(event => event.outcome === "failure")) {
      assert.equal(event.focusId, null);
      assert.deepEqual(event.interfaceIds, []);
      assert.deepEqual(event.connectionIds, []);
      assert.doesNotMatch(event.observation + event.explanation, /switch-\d|router-\d|sw-\d|corrija/i);
    }
    if (difficulty === "advanced") {
      const partials = debug.faults.map(fault => engine.validateExercise(item, repair(broken, fault)));
      assert.ok(partials.every(verdict => !verdict.complete));
      assert.ok(partials.some(verdict => verdict.feedback !== engine.validateExercise(item, broken).feedback), "segunda falha deve se tornar observável");
    }
    const solved = debug.faults.reduce(repair, broken);
    assert.equal(engine.validateExercise(item, solved).complete, true, "aprovação independe dos comandos usados");
    const shortcut = model.removeDevice(solved, "pc-4").state;
    assert.equal(engine.validateExercise(item, shortcut).category, "invariant");
    for (const forbidden of ["faultMetadata", "faults", "base", "solution", "correctAnswer", "invariants"])
      assert.equal(Object.hasOwn(item, forbidden), false);
  }
}
assert.deepEqual([...observed].sort(), engine.OPERATIONAL_VARIANTS.slice().sort(), "todas as variantes aparecem com seeds diferentes");

for (const variant of engine.OPERATIONAL_VARIANTS) {
  const item = engine.generateExercise("routing", `explicit-${variant}`, {difficulty: "advanced", mode: "operational", environment: variant});
  const bench = restore(item);
  assert.equal(item.environment, variant);
  const commands = {
    "cisco-windows": [["pc-1", "ipconfig /all"], ["switch-1", "show vlan brief"], ["router-1", "show ip route"]],
    "cisco-linux": [["pc-1", "ip addr"], ["switch-1", "show vlan brief"], ["router-1", "show ip route"]],
    "dell-windows": [["pc-1", "ipconfig /all"], ["switch-1", "show vlan"], ["router-1", "show ip route"]],
    "mikrotik-hosts": [["pc-1", "ipconfig /all"], ["pc-3", "ip addr"], ["router-1", "/ip route print"]],
    mixed: [["pc-1", "ipconfig /all"], ["pc-3", "ip addr"], ["switch-2", "show vlan"], ["router-1", "/ip route print"]]
  }[variant];
  for (const [id, command] of commands) {
    const device = bench.devices[id], session = terminal.createSession(device);
    const result = terminal.execute(session, command, bench);
    assert.equal(result.error, null, `${variant}: ${id}: ${command}`);
    assert.ok(result.output.join(" ").length > 20);
    engine.recordCommand(item, {deviceId: id, profile: device.profile, command, errorCode: "", changedState: Boolean(result.bench)});
  }
  const analysis = engine.attemptAnalysis(item);
  assert.equal(analysis.commandCount, commands.length);
  assert.equal(analysis.commands[0].command, commands[0][1]);
  analysis.commands[0].command = "alterado fora";
  assert.equal(engine.attemptAnalysis(item).commands[0].command, commands[0][1], "análise é cópia isolada");
  assert.equal(engine.validateExercise(item, engine.inspectExercise(item).base).complete, true, "histórico não é requisito de aprovação");
  assert.doesNotMatch(JSON.stringify(item.scenario), /commandCount|commands|faultMetadata/);
}
const isolated = engine.generateExercise("routing", "isolated", {mode: "operational"});
engine.recordCommand(isolated, {deviceId: "pc-1", profile: "windows", command: "ipconfig", errorCode: "", changedState: false});
assert.equal(engine.attemptAnalysis(engine.generateExercise("routing", "isolated", {mode: "operational"})).commandCount, 0);
assert.throws(() => engine.recordCommand(isolated, {deviceId: "pc-1", command: ""}), /inválido/);
const sensitive = {output: ["Sending ICMP", "SW-2 interrompe ARP Request na VLAN 10."],
  session: {output: [{kind: "command", text: "ping"}, {kind: "output", text: "Sending ICMP"}, {kind: "output", text: "SW-2 interrompe ARP Request na VLAN 10."}]},
  labResult: {status: "timeout", events: []}};
const presentedTerminal = engine.presentTerminalResult(isolated, sensitive);
assert.doesNotMatch(presentedTerminal.output.join(" "), /SW-2/);
assert.doesNotMatch(presentedTerminal.session.output.at(-1).text, /SW-2/);
assert.equal(sensitive.session.output.at(-1).text, "SW-2 interrompe ARP Request na VLAN 10.");
assert.equal(engine.presentTerminalResult(engine.generateExercise("routing", "plain"), sensitive), sensitive);

let cliItem, cliDebug;
for (let seed = 0; seed < 100 && !cliItem; seed++) {
  const candidate = engine.generateExercise("routing", `cli-${seed}`, {difficulty: "advanced", mode: "operational", environment: "cisco-windows"});
  const debug = engine.inspectExercise(candidate);
  if (debug.faults.map(fault => fault.kind).join(",") === "gateway,router-output-ip") { cliItem = candidate; cliDebug = debug; }
}
assert.ok(cliItem, "uma seed deve produzir duas correções disponíveis pela CLI");
let cliState = restore(cliItem);
const initialFeedback = engine.validateExercise(cliItem, cliState).feedback;
let pcSession = terminal.createSession(cliState.devices["pc-1"]);
const correctHost = cliDebug.base.devices["pc-1"].config;
const hostCommand = `netsh interface ipv4 set address name=Ethernet static ${correctHost.ip} ${correctHost.mask} ${correctHost.gateway}`;
let executed = terminal.execute(pcSession, hostCommand, cliState);
assert.equal(executed.error, null); cliState = executed.bench; pcSession = executed.session;
engine.recordCommand(cliItem, {deviceId: "pc-1", profile: "windows", command: hostCommand, errorCode: "", changedState: true});
const partial = engine.validateExercise(cliItem, cliState);
assert.equal(partial.complete, false);
assert.notEqual(partial.feedback, initialFeedback);
let routerSession = terminal.createSession(cliState.devices["router-1"]);
const correctRouter = cliDebug.base.devices["router-1"].config.eth1;
for (const command of ["enable", "configure terminal", "interface GigabitEthernet0/1",
  `ip address ${correctRouter.ip} ${correctRouter.mask}`]) {
  executed = terminal.execute(routerSession, command, cliState);
  assert.equal(executed.error, null, `${command}: ${executed.error?.message}`);
  routerSession = executed.session;
  if (executed.bench) cliState = executed.bench;
  engine.recordCommand(cliItem, {deviceId: "router-1", profile: "cisco-ios", command, errorCode: "", changedState: Boolean(executed.bench)});
}
assert.equal(engine.validateExercise(cliItem, cliState).complete, true);
assert.equal(engine.attemptAnalysis(cliItem).commandCount, 5);
console.log("Modo operacional: variantes, seeds, terminais, duas falhas, feedback, invariantes e análise aprovados.");
