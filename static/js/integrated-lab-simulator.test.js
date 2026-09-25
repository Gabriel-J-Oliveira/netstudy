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
assert.equal(run(remote).events.at(-1).id, "remote");
const invalid = model.configure(one, "pc-b", {ip: "192.168.10.999"}).state;
assert.match(run(invalid).message, /IPv4 ou máscara inválidos/);
const duplicate = model.configure(one, "pc-b", {ip: "192.168.10.10"}).state;
assert.match(run(duplicate).message, /IPv4 duplicado/);
assert.equal(simulate({...model.adapt(one, "pc-a", "pc-b").input, destinationId: "pc-a"}).status, "invalid");
const limited = run(cross, "pc-a", "pc-b", {events: 3});
assert.equal(limited.status, "interrupted");
assert.ok(!limited.events.some(e => e.outcome === "success"));
assert.deepEqual([LIMITS.devices, LIMITS.links, LIMITS.events, LIMITS.history], [6, 5, 64, 64]);
console.log("Simulador: LAN local, trunk 802.1Q, VLANs, falhas e limites aprovados.");
