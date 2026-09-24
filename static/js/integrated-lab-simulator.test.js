const assert = require("node:assert/strict");
const {simulate, LIMITS} = require("./integrated-lab-simulator.js");

const input = () => ({
  devices: {a: "pc", sw: "switch", b: "pc"},
  links: ["a-sw", "sw-b"],
  config: {
    a: {ip: "192.168.10.10", mask: "255.255.255.0"},
    b: {ip: "192.168.10.20", mask: "255.255.255.0"},
    sw: {port1: 10, port2: 10}
  }
});

const working = simulate(input());
assert.equal(working.status, "success");
assert.deepEqual(working.events.map(event => event.id), ["local", "arp-request", "learn-a", "flood", "arp-at-b", "arp-reply", "learn-b", "reply-at-a", "data", "forward", "success"]);
assert.equal(working.events.find(event => event.id === "arp-request").frame.destination, "FF:FF:FF:FF:FF:FF");
assert.equal(working.events.find(event => event.id === "reply-at-a").tables.arp[0].ip, "192.168.10.20");
assert.equal(working.events.find(event => event.id === "forward").link, "sw-b");

const mismatch = input();
mismatch.config.sw.port2 = 20;
const failed = simulate(mismatch);
assert.equal(failed.status, "failure");
assert.equal(failed.events.at(-1).id, "blocked");
assert.ok(!failed.events.some(event => event.id === "arp-at-b" || event.id === "success"));
assert.equal(simulate(input()).status, "success");

const tooMany = input();
tooMany.devices.extra = "pc";
assert.equal(simulate(tooMany).status, "invalid");
const tooManyLinks = input();
tooManyLinks.links.push("extra");
assert.equal(simulate(tooManyLinks).status, "invalid");

const limited = simulate(input(), {events: 3});
assert.equal(limited.status, "interrupted");
assert.equal(limited.events.length, 3);
assert.equal(limited.events.at(-1).observation, "Simulação interrompida por limite de segurança");
assert.ok(!limited.events.some(event => event.outcome === "success"));
assert.equal(LIMITS.devices, 3);
assert.equal(LIMITS.links, 2);
assert.equal(LIMITS.events, 64);
assert.equal(LIMITS.history, 64);
console.log("Simulador integrado: casos determinísticos aprovados.");
