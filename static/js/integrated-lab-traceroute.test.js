const assert = require('node:assert/strict');
const model = require('./integrated-lab-model.js');
const simulator = require('./integrated-lab-simulator.js');
const terminal = require('./integrated-lab-terminal.js');
const engine = require('./integrated-lab-exercise-engine.js');
const {PRESETS} = require('./integrated-lab-presets.js');

const preset = PRESETS.find(item => item.id === 'external-network');
assert.ok(preset, 'preset de ISP lógico');
const original = JSON.stringify(preset.scenario);
const restored = model.importScenario(preset.scenario);
const source = () => model.adaptForPing(restored.state, restored.sourceId).input;
const target = restored.state.devices[restored.destinationId].config.ip;
assert.equal(preset.scenario.format, 'dynamic');
for (const id of ['external-default-missing', 'external-next-hop-wrong', 'external-return-missing']) {
  const item = PRESETS.find(p => p.id === id), loaded = model.importScenario(item.scenario);
  assert.ok(item);
  assert.equal(simulator.simulate(model.adapt(loaded.state, loaded.sourceId, loaded.destinationId).input).status, 'failure', id);
}
assert.equal(restored.state.devices['router-2'].name, 'ISP-1');
assert.equal(restored.state.devices['router-3'].name, 'ISP-2');
assert.equal(simulator.ping(source(), target).status, 'reply');
const trace = simulator.traceroute(source(), target);
assert.equal(trace.status, 'reached');
assert.deepEqual(trace.hops.map(hop => [hop.ttl, hop.address, hop.response]), [
  [1, '192.168.10.1', 'Time Exceeded'], [2, '10.0.0.2', 'Time Exceeded'],
  [3, '10.0.1.2', 'Time Exceeded'], [4, '203.0.113.20', 'Echo Reply']
]);
assert.equal(trace.events.filter(event => event.id === 'time-exceeded-received').length, 3);
assert.ok(trace.events.filter(event => event.id === 'time-exceeded-start').every(event => event.packet.ttl === 64));
assert.ok(trace.events.every(event => event.traceTtl >= 1 && event.traceTtl <= 4));
assert.ok(trace.events.some(event => event.id === 'ttl-expired' && event.packet.ttl === 0));
for (const [ttl, forbidden] of [[1, 'router-2'], [2, 'router-3']])
  assert.ok(!trace.events.some(event => event.traceTtl === ttl && event.id === 'router-receive' && event.focusId === forbidden),
    `a sonda TTL ${ttl} descartada não chega ao próximo roteador`);
assert.ok(trace.events.filter(event => event.packet?.icmpType === 'echo-request').every(event =>
  event.packet.source === '192.168.10.10' && event.packet.destination === target));
assert.equal(new Set(trace.events.map(event => event.eventId)).size, trace.events.length);
assert.equal(simulator.traceroute(source(), target, {maxHops: 2}).status, 'max-hops');
assert.equal(simulator.traceroute(source(), target, {maxHops: 0}).status, 'invalid');

const change = result => { assert.equal(result.error, undefined, result.error); return result.state; };
let absent = change(model.removeStaticRoute(restored.state, 'router-1', '0.0.0.0', '0.0.0.0'));
let result = simulator.traceroute(model.adaptForPing(absent, 'pc-1').input, target, {maxHops: 5});
assert.equal(result.status, 'unreachable');
assert.ok(result.events.some(event => event.id === 'destination-unreachable-received'));
assert.equal(result.hops.at(-1).response, 'Destination Unreachable');

let wrong = change(model.setStaticRoute(restored.state, 'router-1', {destination: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.0.0.254'}));
result = simulator.traceroute(model.adaptForPing(wrong, 'pc-1').input, target, {maxHops: 4});
assert.equal(result.status, 'max-hops');
assert.equal(result.hops[0].response, 'Time Exceeded');
assert.ok(result.hops.slice(1).every(hop => hop.response === '*'));

let noReturn = change(model.removeStaticRoute(restored.state, 'router-3', '192.168.10.0', '255.255.255.0'));
result = simulator.traceroute(model.adaptForPing(noReturn, 'pc-1').input, target, {maxHops: 4});
assert.equal(result.status, 'max-hops');
assert.deepEqual(result.hops.map(hop => hop.response), ['Time Exceeded', 'Time Exceeded', '*', '*']);
assert.equal(simulator.ping(model.adaptForPing(noReturn, 'pc-1').input, target).status, 'timeout');

function run(deviceId, command, state = restored.state) {
  const session = terminal.createSession(state.devices[deviceId]);
  return terminal.execute(session, command, state);
}
const windows = run('pc-1', `tracert ${target}`);
assert.equal(windows.error, null);
assert.equal(windows.labResult.status, 'reached');
assert.match(windows.output.join('\n'), /1\s+192\.168\.10\.1.*2\s+10\.0\.0\.2/s);
const linux = run('pc-2', 'traceroute 192.168.10.10');
assert.equal(linux.error, null);
assert.equal(linux.labResult.status, 'reached');
const cisco = run('router-1', `traceroute ${target}`);
assert.equal(cisco.error, null);
assert.equal(cisco.labResult.status, 'reached');
assert.equal(run('pc-1', 'tracert wrong').error.code, 'invalid-input');
assert.equal(run('pc-2', 'traceroute wrong').error.code, 'invalid-input');

const varieties = new Set(), categories = new Set();
for (const difficulty of ['intermediate', 'advanced']) for (let seed = 0; seed < 24; seed++) {
  const item = engine.generateExercise('external-routing', seed, {difficulty});
  assert.deepEqual(item, engine.generateExercise('external-routing', seed, {difficulty}));
  const internal = engine.inspectExercise(item), broken = model.importScenario(item.scenario).state;
  assert.equal(internal.faults.length, difficulty === 'advanced' ? 2 : 1);
  assert.equal(simulator.simulate(model.adapt(internal.externalBase, 'pc-1', 'pc-2').input).status, 'success');
  assert.equal(simulator.simulate(model.adapt(broken, 'pc-1', 'pc-2').input).status, 'failure');
  const verdict = engine.validateExercise(item, broken);
  assert.equal(verdict.complete, false);
  categories.add(verdict.category);
  assert.equal(engine.validateExercise(item, internal.externalBase).complete, true);
  varieties.add(internal.faults.join('+'));
  if (difficulty === 'advanced') {
    const partial = change(model.configure(broken, 'router-1', {staticRoutes: internal.externalBase.devices['router-1'].config.staticRoutes}));
    assert.equal(engine.validateExercise(item, partial).category, 'return-route');
  }
  assert.equal(engine.validateExercise(item, change(model.configure(internal.externalBase, 'pc-1', {ip:'192.168.10.222'}))).category, 'invariant');
  assert.doesNotMatch(JSON.stringify(item), /faults|solution|externalBase|correctAnswer/);
}
assert.ok(varieties.size >= 4, 'seeds cobrem ausência de default, next hop e retorno');
assert.deepEqual([...categories].sort(), ['next-hop', 'return-route', 'route-missing']);
for (const environment of engine.OPERATIONAL_VARIANTS) {
  const item = engine.generateExercise('external-routing', `ops-${environment}`, {mode:'operational', environment});
  const bench = model.importScenario(item.scenario).state;
  assert.equal(item.environment, environment);
  assert.ok(Object.values(bench.devices).every(device => device.profile !== 'generic'));
  assert.equal(engine.validateExercise(item, bench).complete, false);
  assert.equal(engine.validateExercise(item, engine.inspectExercise(item).externalBase).complete, true);
}
assert.equal(JSON.stringify(preset.scenario), original, 'exercícios não modificam o preset');
console.log('Traceroute: TTL crescente, retorno ICMP, ISP lógico, terminais e exercícios aprovados.');
