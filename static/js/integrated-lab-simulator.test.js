const assert = require("node:assert/strict");
const model = require("./integrated-lab-model.js");
const {simulate, LIMITS} = require("./integrated-lab-simulator.js");

function setup(entries, withTrunk = false) {
  let state = model.create();
  for (const id of ["sw1", ...(withTrunk ? ["sw2"] : []), ...entries.map(row => row[0])]) state = model.position(state, id, .5, .5).state;
  for (const [pc, sw, port, vlan = 10] of entries) {
    state = model.connect(state, `${pc}:eth0`, `${sw}:gi0/${port}`).state;
    state = model.configure(state, sw, {vlans: {[`${sw}:gi0/${port}`]: vlan}}).state;
  }
  if (withTrunk) state = model.connect(state, "sw1:gi0/5", "sw2:gi0/5").state;
  return state;
}
const run = (state, from = "pc-a", to = "pc-b", options) => simulate(model.adapt(state, from, to).input, options);
const one = setup([["pc-a", "sw1", 3], ["pc-b", "sw1", 1]]);
const original = run(one);
assert.equal(original.status, "success");
assert.equal(original.events.find(e => e.id === "arp-request").frame.destination, "FF:FF:FF:FF:FF:FF");
assert.equal(original.events.find(e => e.id === "arp-request").frame.vlanTag, null);
assert.equal(original.events.find(e => e.id === "unicast-forward").toId, "pc-b");
assert.equal(original.events.find(e => e.id === "arp-learned").tables.arp[0].owner, "pc-a");
assert.equal(run(one, "pc-b", "pc-a").status, "success");

const three = setup([["pc-a", "sw1", 3], ["pc-b", "sw1", 1], ["pc-c", "sw1", 4]]);
const threeResult = run(three);
assert.equal(threeResult.events.filter(e => e.id === "broadcast-out").length, 2);
assert.equal(threeResult.events.find(e => e.id === "arp-discarded").focusId, "pc-c");
assert.equal(threeResult.events.find(e => e.id === "broadcast-decision").connectionIds.length, 2);
const mismatch = model.configure(three, "sw1", {vlans: {"sw1:gi0/1": 20}}).state;
assert.equal(run(mismatch).status, "failure");
assert.match(run(mismatch).events.at(-1).explanation, /não há roteamento entre VLANs/);
assert.ok(!run(mismatch).events.some(e => e.toId === "pc-b"));

const cross = setup([["pc-a", "sw1", 1], ["pc-b", "sw2", 1], ["pc-c", "sw1", 2, 20], ["pc-d", "sw2", 2, 20]], true);
const crossed = run(cross);
assert.equal(crossed.status, "success");
assert.ok(crossed.events.length <= LIMITS.events);
assert.deepEqual(crossed.events.filter(e => e.id === "arp-target").map(e => e.focusId), ["pc-b"]);
assert.ok(!crossed.events.some(e => e.id === "arp-discarded" && ["pc-c", "pc-d"].includes(e.focusId)));
assert.ok(crossed.events.some(e => e.id === "trunk-out" && e.frame.vlanTag === 10));
assert.ok(crossed.events.some(e => e.id === "reply-trunk" && e.frame.vlanTag === 10));
assert.ok(crossed.events.some(e => e.id === "data-trunk" && e.frame.vlanTag === 10));
assert.ok(crossed.events.some(e => e.id === "unicast-forward" && e.toId === "pc-b" && e.frame.vlanTag === null));
assert.equal(crossed.events.find(e => e.id === "data-trunk").packet.destination, "192.168.10.20");
const endMac = crossed.events.at(-1).tables.mac;
for (const sw of ["sw1", "sw2"]) for (const pc of ["AA:AA:AA:AA:AA:AA", "BB:BB:BB:BB:BB:BB"]) assert.ok(endMac.some(row => row.switchId === sw && row.vlan === 10 && row.mac === pc));
assert.equal(run(cross, "pc-b", "pc-a").status, "success");

for (const sw of ["sw1", "sw2"]) {
  const blocked = model.configure(cross, sw, {allowedVlans: [20]}).state;
  const result = run(blocked);
  assert.equal(result.status, "failure");
  assert.ok(result.events.some(e => e.id === "trunk-blocked" && e.focusId === sw));
  assert.match(result.events.at(-1).explanation, new RegExp(`uplink de ${sw.toUpperCase()}`));
  assert.ok(!result.events.some(e => e.outcome === "success" || e.id === "arp-target"));
  assert.equal(run(model.configure(blocked, sw, {allowedVlans: [10, 20]}).state).status, "success");
}
const noTrunk = model.disconnect(cross, cross.connections.at(-1).id).state;
assert.match(run(noTrunk).events.at(-1).explanation, /não possuem enlace trunk/);
const noCable = model.disconnect(one, one.connections[0].id).state;
assert.equal(run(noCable).events.at(-1).id, "source-unplugged");
const remote = model.configure(one, "pc-b", {ip: "192.168.20.20"}).state;
assert.equal(run(remote).events.at(-1).id, "gateway-missing");
const invalid = model.configure(one, "pc-b", {ip: "192.168.10.999"}).state;
assert.match(run(invalid).message, /Configuração IPv4 inválida/);
const duplicate = model.configure(one, "pc-b", {ip: "192.168.10.10"}).state;
assert.match(run(duplicate).message, /IPv4 duplicado/);
assert.equal(simulate({...model.adapt(one, "pc-a", "pc-b").input, destinationId: "pc-a"}).status, "invalid");
const limited = run(cross, "pc-a", "pc-b", {events: 3});
assert.equal(limited.status, "interrupted");
assert.ok(!limited.events.some(e => e.outcome === "success"));
assert.deepEqual([LIMITS.devices, LIMITS.links, LIMITS.events, LIMITS.history], [7, 7, 128, 128]);

function routed() {
  let state = model.create();
  for (const id of ["pc-a", "pc-b", "sw1", "sw2", "r1"]) state = model.position(state, id, .5, .5).state;
  state = model.configure(state, "pc-a", {gateway: "192.168.10.1"}).state;
  state = model.configure(state, "pc-b", {ip: "192.168.20.20", gateway: "192.168.20.1"}).state;
  for (const [a, b] of [["pc-a:eth0", "sw1:gi0/1"], ["r1:eth0", "sw1:gi0/2"], ["r1:eth1", "sw2:gi0/2"], ["pc-b:eth0", "sw2:gi0/1"], ["sw1:gi0/5", "sw2:gi0/5"]]) state = model.connect(state, a, b).state;
  state = model.configure(state, "sw2", {vlans: {"sw2:gi0/1": 20, "sw2:gi0/2": 20}}).state;
  return state;
}
const routedBench = routed(), ab = run(routedBench), ba = run(routedBench, "pc-b", "pc-a");
for (const result of [ab, ba]) {
  assert.equal(result.status, "success", result.message);
  assert.equal(new Set(result.events.map(event => event.eventId)).size, result.events.length);
  const first = result.events.find(event => event.id === "frame-in");
  const second = result.events.find(event => event.id === "frame-out");
  const decision = result.events.find(event => event.id === "route-decision");
  assert.ok(first && second && decision);
  assert.equal(first.packet.source, second.packet.source);
  assert.equal(first.packet.destination, second.packet.destination);
  assert.equal(first.packet.id, second.packet.id);
  assert.notEqual(first.frame.id, second.frame.id);
  assert.equal(first.packet.ttl, 64);
  assert.equal(second.packet.ttl, 63);
  assert.notEqual(first.frame.source, second.frame.source);
  assert.notEqual(first.frame.destination, second.frame.destination);
  assert.equal(decision.routerDecision.ttlAfter, 63);
  assert.ok(result.events.find(event => event.id === "delivered"));
}
assert.equal(ab.events.find(event => event.id === "arp-request").observation.includes("192.168.10.1"), true);
assert.ok(ab.events.some(event => event.id === "arp-learned" && event.tables.arp.some(row => row.owner === "pc-a" && row.ip === "192.168.10.1")));
assert.equal(ab.events.find(event => event.id === "frame-in").frame.destination, routedBench.devices.r1.config.eth0.mac);
assert.equal(ab.events.find(event => event.id === "frame-out").frame.source, routedBench.devices.r1.config.eth1.mac);
assert.equal(ab.events.find(event => event.id === "frame-out").frame.destination, routedBench.devices["pc-b"].config.mac);
assert.equal(ab.events.find(event => event.id === "local").tables.arp.some(row => row.owner === "r1"), false);
assert.equal(ab.events.find(event => event.id === "router-receive").tables.arp.some(row => row.owner === "r1" && row.ip === "192.168.10.10"), true);
assert.equal(ab.events.find(event => event.id === "frame-out").tables.arp.some(row => row.owner === "r1" && row.ip === "192.168.20.20"), true);
assert.equal(ba.events.find(event => event.id === "frame-in").frame.destination, routedBench.devices.r1.config.eth1.mac);
assert.equal(ba.events.find(event => event.id === "frame-out").frame.source, routedBench.devices.r1.config.eth0.mac);

const withoutGateway = model.configure(routedBench, "pc-a", {gateway: ""}).state;
assert.equal(run(withoutGateway).events.at(-1).id, "gateway-missing");
const offlinkGateway = model.configure(routedBench, "pc-a", {gateway: "192.168.30.1"}).state;
assert.equal(run(offlinkGateway).events.at(-1).id, "gateway-offlink");
const wrongGatewayVlan = model.configure(routedBench, "sw1", {vlans: {"sw1:gi0/2": 20}}).state;
assert.equal(run(wrongGatewayVlan).events.at(-1).id, "gateway-arp-failed");
const routerCable = routedBench.connections.find(link => [link.a, link.b].includes("r1:eth0"));
assert.equal(run(model.disconnect(routedBench, routerCable.id).state).events.at(-1).id, "gateway-arp-failed");
const exitCable = routedBench.connections.find(link => [link.a, link.b].includes("r1:eth1"));
assert.equal(run(model.disconnect(routedBench, exitCable.id).state).events.at(-1).id, "route-missing");
const wrongDestinationVlan = model.configure(routedBench, "sw2", {vlans: {"sw2:gi0/1": 10}}).state;
assert.equal(run(wrongDestinationVlan).events.at(-1).id, "destination-arp-failed");
const destinationCable = routedBench.connections.find(link => [link.a, link.b].includes("pc-b:eth0"));
assert.equal(run(model.disconnect(routedBench, destinationCable.id).state).events.at(-1).id, "destination-arp-failed");
assert.equal(run(model.configure(routedBench, "r1", {eth1: {ip: "192.168.99.1"}}).state).events.at(-1).id, "route-missing");
assert.equal(run(model.configure(routedBench, "pc-b", {ip: "192.168.20.999"}).state).status, "invalid");
const wrongMask = model.configure(routedBench, "pc-a", {mask: "255.255.0.0"}).state;
assert.equal(run(wrongMask).events.at(-1).id, "arp-unanswered");
assert.equal(run(wrongMask).events.some(event => event.id === "next-hop"), false);
assert.equal(run(routedBench, "pc-a", "pc-b", {events: 4}).status, "interrupted");
let fullBench = routedBench;
for (const id of ["pc-c", "pc-d"]) fullBench = model.position(fullBench, id, .5, .5).state;
fullBench = model.connect(fullBench, "pc-c:eth0", "sw1:gi0/3").state;
fullBench = model.connect(fullBench, "pc-d:eth0", "sw2:gi0/3").state;
fullBench = model.configure(fullBench, "sw2", {vlans: {"sw2:gi0/3": 20}}).state;
assert.equal(fullBench.connections.length, LIMITS.links);
assert.equal(run(fullBench).status, "success");
console.log("Simulador: LAN, trunk, roteamento físico, falhas e limites aprovados.");
