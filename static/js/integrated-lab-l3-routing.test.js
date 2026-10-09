const assert = require('node:assert/strict');
const model = require('./integrated-lab-model.js');
const simulator = require('./integrated-lab-simulator.js');
const terminal = require('./integrated-lab-terminal.js');

const use = result => { assert.equal(result.error, undefined, result.error); return result.state; };
function network() {
  let state = model.createEmpty();
  for (const type of ['pc', 'pc', 'switch', 'switch', 'router', 'router']) state = use(model.addDevice(state, type));
  for (const id of Object.keys(state.devices)) state = use(model.position(state, id, .2, .3));
  state = use(model.configure(state, 'pc-1', {ip: '192.168.10.10', gateway: '192.168.10.1'}));
  state = use(model.configure(state, 'pc-2', {ip: '192.168.20.20', gateway: '192.168.20.1'}));
  state = use(model.configure(state, 'router-1', {eth0: {ip: '192.168.10.1'}, eth1: {ip: '10.0.0.1'}}));
  state = use(model.configure(state, 'router-2', {eth0: {ip: '10.0.0.2'}, eth1: {ip: '192.168.20.1'}}));
  for (const [a, b] of [['pc-1:eth0','switch-1:gi0/1'],['router-1:eth0','switch-1:gi0/2'],
    ['router-1:eth1','router-2:eth0'],['router-2:eth1','switch-2:gi0/2'],['pc-2:eth0','switch-2:gi0/1']]) state = use(model.connect(state, a, b));
  return state;
}
function ping(state, ttl) {
  const adapted = model.adaptForPing(state, 'pc-1'); assert.equal(adapted.error, undefined);
  return simulator.ping(adapted.input, '192.168.20.20', ttl ? {ttl} : {});
}
const base = network();
assert.equal(ping(base).status, 'destination-unreachable');
let state = use(model.setStaticRoute(base, 'router-1', {destination: '192.168.20.0', mask: '255.255.255.0', nextHop: '10.0.0.2'}));
assert.equal(ping(state).status, 'timeout');
state = use(model.setStaticRoute(state, 'router-2', {destination: '192.168.10.0', mask: '255.255.255.0', nextHop: '10.0.0.1'}));
const result = ping(state);
assert.equal(result.status, 'reply', result.message);
assert.equal(result.events.filter(e => e.id === 'router-receive').length, 4);
assert.ok(result.events.filter(e => e.id === 'router-receive').every(e => e.frame?.source && e.frame?.destination));
assert.equal(result.events.filter(e => e.id === 'route-decision').length, 4);
assert.equal(result.events.filter(e => e.id === 'frame-out').length, 4);
assert.equal(result.events.filter(e => e.id === 'route-decision').map(e => e.routerDecision.ttlAfter).join(','), '63,62,63,62');
assert.deepEqual(result.events[0].tables.arp, [], 'snapshot inicial não antecipa ARP');
assert.ok(result.events.some(e => e.tables.arp.some(row => row.owner === 'router-1' && row.ip === '10.0.0.2')));
assert.ok(result.events.filter(e => e.id === 'frame-out').some(e => e.frame.source === state.devices['router-1'].config.eth1.mac && e.frame.destination === state.devices['router-2'].config.eth0.mac));
assert.equal(ping(state, 2).status, 'ttl-expired');
assert.equal(simulator.simulate(model.adapt(state, 'pc-1', 'pc-2').input).status, 'success');
const exported = model.exportScenario(state, {name: 'Dois roteadores', sourceId: 'pc-1', destinationId: 'pc-2'});
const imported = model.importScenario(exported);
assert.deepEqual(imported.state.devices['router-1'].config.staticRoutes, state.devices['router-1'].config.staticRoutes);
assert.equal(ping(imported.state).status, 'reply');
const legacy = model.create();
const legacyRoute = use(model.setStaticRoute(legacy, 'r1', {destination: '0.0.0.0', mask: '0.0.0.0', nextHop: '192.168.10.2'}));
assert.deepEqual(model.importScenario(model.exportScenario(legacyRoute)).state.devices.r1.config.staticRoutes, legacyRoute.devices.r1.config.staticRoutes);
assert.equal(model.importScenario(model.exportScenario(legacy)).state.devices.r1.config.staticRoutes, undefined);
const reverse = simulator.ping(model.adaptForPing(state, 'pc-2').input, '192.168.10.10');
assert.equal(reverse.status, 'reply');
let preferred = use(model.setStaticRoute(state, 'router-1', {destination: '192.168.20.0', mask: '255.255.255.128', nextHop: '10.0.0.254'}));
assert.equal(ping(preferred).status, 'timeout', 'a rota /25 prevalece sobre a /24 mesmo com next hop sem resposta');
preferred = use(model.setStaticRoute(preferred, 'router-1', {destination: '192.168.20.20', mask: '255.255.255.255', nextHop: '10.0.0.2'}));
assert.equal(ping(preferred).status, 'reply', 'a rota /32 prevalece sobre a /25');
let defaulted = use(model.removeStaticRoute(state, 'router-1', '192.168.20.0', '255.255.255.0'));
defaulted = use(model.setStaticRoute(defaulted, 'router-1', {destination: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.0.0.2'}));
assert.equal(ping(defaulted).status, 'reply', 'rota padrão cobre destino sem prefixo específico');
let loop = use(model.setStaticRoute(base, 'router-1', {destination:'0.0.0.0',mask:'0.0.0.0',nextHop:'10.0.0.2'}));
loop = use(model.setStaticRoute(loop, 'router-2', {destination:'0.0.0.0',mask:'0.0.0.0',nextHop:'10.0.0.1'}));
assert.equal(simulator.ping(model.adaptForPing(loop,'pc-1').input,'8.8.8.8',{ttl:4}).status,'ttl-expired');
assert.equal(ping(use(model.disconnect(state, state.connections.find(c => c.type === 'routed').id))).status, 'destination-unreachable');
assert.equal(model.setStaticRoute(state, 'router-1', {destination:'192.168.21.1',mask:'255.255.255.0',nextHop:'10.0.0.2'}).error !== undefined, true);
const malformed = JSON.parse(JSON.stringify(exported));
malformed.devices['router-1'].config.staticRoutes[0].destination = '192.168.21.1';
assert.throws(() => model.importScenario(malformed), /Rota|rota/, 'schema rejeita prefixo não canônico');
function cli(bench, routerId, profile, commands) {
  let current = use(model.setProfile(bench, routerId, profile));
  let session = terminal.createSession(current.devices[routerId]);
  let output = '';
  for (const command of commands) {
    const result = terminal.execute(session, command, current);
    assert.equal(result.error, null, `${command}: ${result.error?.message}`);
    session = result.session; current = result.bench || current;
    output = result.output.join('\n');
  }
  return {state: current, output};
}
const cisco = cli(base, 'router-1', 'cisco-ios', ['enable','configure terminal','ip route 192.168.20.0 255.255.255.0 10.0.0.2','end','show ip route']);
assert.match(cisco.output, /S.*192\.168\.20\.0\/24.*10\.0\.0\.2/);
assert.deepEqual(cisco.state.devices['router-1'].config.staticRoutes, state.devices['router-1'].config.staticRoutes);
assert.match(cli(cisco.state, 'router-1', 'cisco-ios', ['enable','show running-config']).output, /ip route 192\.168\.20\.0 255\.255\.255\.0 10\.0\.0\.2/);
const ciscoRemoved=cli(cisco.state,'router-1','cisco-ios',['enable','configure terminal','no ip route 192.168.20.0 255.255.255.0 10.0.0.2']);
assert.deepEqual(ciscoRemoved.state.devices['router-1'].config.staticRoutes, []);
const mikrotik = cli(base, 'router-1', 'mikrotik-routeros', ['/ip route add dst-address=192.168.20.0/24 gateway=10.0.0.2','/ip route print']);
assert.match(mikrotik.output, /192\.168\.20\.0\/24.*10\.0\.0\.2/);
assert.deepEqual(mikrotik.state.devices['router-1'].config.staticRoutes, state.devices['router-1'].config.staticRoutes);
let triple = use(model.addDevice(state, 'router'));
triple = use(model.position(triple, 'router-3', .7, .4));
triple = use(model.disconnect(triple, triple.connections.find(c => c.a === 'router-2:eth1' || c.b === 'router-2:eth1').id));
triple = use(model.configure(triple, 'router-2', {eth1: {ip: '10.0.1.2'}}));
triple = use(model.configure(triple, 'router-3', {eth0: {ip: '10.0.1.3'}, eth1: {ip: '192.168.20.1'}}));
triple = use(model.connect(triple, 'router-2:eth1', 'router-3:eth0'));
triple = use(model.connect(triple, 'router-3:eth1', 'switch-2:gi0/2'));
triple = use(model.setStaticRoute(triple, 'router-2', {destination: '192.168.20.0', mask: '255.255.255.0', nextHop: '10.0.1.3'}));
triple = use(model.setStaticRoute(triple, 'router-3', {destination: '192.168.10.0', mask: '255.255.255.0', nextHop: '10.0.1.2'}));
const threeHops = ping(triple);
assert.equal(threeHops.status, 'reply', threeHops.message);
assert.equal(threeHops.events.filter(e => e.id === 'router-receive').length, 6);
assert.equal(threeHops.events.filter(e => e.id === 'route-decision').map(e => e.routerDecision.ttlAfter).join(','), '63,62,61,63,62,61');
assert.equal(ping(triple, 3).status, 'ttl-expired');
console.log('L3 avançado: trânsito, ida/volta, TTL e Scenario Schema aprovados.');
