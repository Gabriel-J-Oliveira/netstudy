const assert = require('node:assert/strict');
const model = require('./integrated-lab-model.js');
const simulator = require('./integrated-lab-simulator.js');
const terminal = require('./integrated-lab-terminal.js');
const {PRESETS} = require('./integrated-lab-presets.js');

const load = id => model.importScenario(PRESETS.find(item => item.id === id).scenario);
const ping = (state, sourceId, destinationIp, options) => simulator.ping(model.adaptForPing(state, sourceId).input, destinationIp, options);
const destination = restored => restored.state.devices[restored.destinationId].config.ip;
const lan = load('basic-lan');
const basic = ping(lan.state, lan.sourceId, destination(lan));
assert.equal(basic.status, 'reply');
assert.equal(basic.events.at(-1).id, 'echo-reply-received');
assert.equal(basic.events.at(-1).outcome, 'success');
assert.ok(basic.events.some(event => event.id === 'echo-request-arrived'));
assert.ok(basic.events.some(event => event.id === 'echo-request' && event.frame));
assert.ok(basic.events.some(event => event.id === 'echo-reply' && event.frame));
assert.ok(basic.events.some(event => event.id === 'switch-decision'));
assert.ok(basic.events.some(event => event.id === 'arp-learned'));
assert.equal(basic.events.some(event => event.id === 'arp-request' && event.fromId === lan.destinationId), false,
  'responder aprendeu o vizinho no Request e não faz ARP desnecessário na volta');
assert.equal(new Set(basic.events.map(event => event.eventId)).size, basic.events.length);
assert.equal(basic.events[0].tables.arp.length, 0);
assert.ok(basic.events.at(-1).tables.arp.length > 0);
assert.equal(basic.events.at(-1).packet.source, destination(lan));
assert.equal(basic.events.at(-1).packet.destination, lan.state.devices[lan.sourceId].config.ip);
assert.ok(basic.events.filter(event => event.outcome === 'success').length === 1);

const trunk = load('switch-trunk');
const crossed = ping(trunk.state, trunk.sourceId, destination(trunk));
assert.equal(crossed.status, 'reply');
const tagged = crossed.events.filter(event => event.frame?.vlanTag === 10 && event.packet?.protocol === 'ICMP');
assert.ok(tagged.some(event => event.packet.icmpType === 'echo-request'));
assert.ok(tagged.some(event => event.packet.icmpType === 'echo-reply'));
const trunkCable = trunk.state.connections.find(link => link.a.endsWith('gi0/5') || link.b.endsWith('gi0/5'));
assert.ok(tagged.filter(event => event.id === 'data-trunk').every(event => event.connectionIds.includes(trunkCable.id)));

const routed = load('two-networks-router');
const routedResult = ping(routed.state, routed.sourceId, destination(routed));
assert.equal(routedResult.status, 'reply');
const decisions = routedResult.events.filter(event => event.id === 'route-decision');
assert.equal(decisions.length, 2, 'um encaminhamento L3 em cada direção');
assert.ok(decisions.every(event => event.routerDecision.ttlBefore === 64 && event.routerDecision.ttlAfter === 63));
assert.ok(routedResult.events.some(event => event.id === 'frame-out' && event.frame.source === routed.state.devices.r1.config.eth1.mac));
assert.ok(routedResult.events.some(event => event.id === 'frame-out' && event.frame.source === routed.state.devices.r1.config.eth0.mac));
assert.equal(routedResult.events.at(-1).packet.ttl, 63);
assert.ok(routedResult.events.some(event => event.id === 'arp-cache-hit' && event.packet?.icmpType === 'echo-reply'));

const noReturn = model.configure(routed.state, routed.destinationId, {gateway: ''}).state;
const noReturnResult = ping(noReturn, routed.sourceId, destination(routed));
assert.equal(noReturnResult.status, 'timeout');
assert.ok(noReturnResult.events.some(event => event.id === 'echo-request-arrived'));
assert.ok(noReturnResult.events.some(event => event.packet?.icmpType === 'echo-reply'));
assert.ok(!noReturnResult.events.some(event => event.id === 'echo-reply-received'));

const offlink = model.configure(routed.state, routed.sourceId, {gateway: '192.168.30.1'}).state;
assert.equal(ping(offlink, routed.sourceId, destination(routed)).status, 'destination-unreachable');
const wrongGateway = model.configure(routed.state, routed.sourceId, {gateway: '192.168.10.254'}).state;
const wrongGatewayResult = ping(wrongGateway, routed.sourceId, destination(routed));
assert.equal(wrongGatewayResult.status, 'timeout');
assert.ok(wrongGatewayResult.events.some(event => event.id === 'arp-request' && event.observation.includes('192.168.10.254')));
const wrongVlan = model.configure(lan.state, 'sw1', {vlans: {'sw1:gi0/2': 20}}).state;
const wrongVlanResult = ping(wrongVlan, lan.sourceId, destination(lan));
assert.equal(wrongVlanResult.status, 'timeout');
assert.ok(wrongVlanResult.events.some(event => event.id === 'arp-request'));
const wrongRoute = model.configure(routed.state, 'r1', {eth1: {ip: '192.168.99.1'}}).state;
const noRoute = ping(wrongRoute, routed.sourceId, destination(routed));
assert.equal(noRoute.status, 'destination-unreachable');
assert.ok(noRoute.events.some(event => event.id === 'router-receive'));
assert.equal(ping(routed.state, routed.sourceId, destination(routed), {ttl: 1}).status, 'ttl-expired');
const limited = ping(routed.state, routed.sourceId, destination(routed), {events: 3});
assert.equal(limited.status, 'interrupted');
assert.ok(!limited.events.some(event => event.outcome === 'success'));
assert.equal(ping(routed.state, routed.sourceId, 'bad').status, 'invalid');

const router = model.setProfile(routed.state, 'r1', 'cisco-ios').state;
const routerPing = ping(router, 'r1', destination(routed));
assert.equal(routerPing.status, 'reply', 'roteador origina ICMP pela interface conectada');
assert.ok(routerPing.events.some(event => event.id === 'route-decision'));
const routerSession = terminal.createSession(router.devices.r1);
const cisco = terminal.execute(routerSession, `ping ${destination(routed)}`, router);
assert.equal(cisco.error, null);
assert.equal(cisco.labResult.status, 'reply');
assert.match(cisco.output.join(' '), /100 percent/);
const switchBench = model.setProfile(router, 'sw1', 'cisco-ios').state;
assert.equal(terminal.execute(terminal.createSession(switchBench.devices.sw1), `ping ${destination(routed)}`, switchBench).error.code, 'no-ip-interface');

for (const profile of ['windows', 'linux']) {
  const bench = model.setProfile(lan.state, lan.sourceId, profile).state;
  const session = terminal.createSession(bench.devices[lan.sourceId]);
  const result = terminal.execute(session, `ping ${destination(lan)}`, bench);
  assert.equal(result.error, null);
  assert.equal(result.labResult.status, 'reply');
  assert.match(result.output.join(' '), /Echo Reply recebido/);
  assert.equal(terminal.execute(session, 'ping bad', bench).error.code, 'invalid-input');
}
console.log('ICMP/Ping: LAN, trunk, roteamento, volta, falhas, TTL, limites e terminais aprovados.');
