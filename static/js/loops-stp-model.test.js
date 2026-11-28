"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { calculate, MAX_ITERATIONS } = require("./loops-stp-model.js");

const switches = [
  { id: "sw1", priority: 32768, mac: "00:00:00:00:00:01" },
  { id: "sw2", priority: 32768, mac: "00:00:00:00:00:02" },
  { id: "sw3", priority: 32768, mac: "00:00:00:00:00:03" },
];
const links = [
  { id: "sw1-sw2", a: { switchId: "sw1", portId: "Gi0/2" }, b: { switchId: "sw2", portId: "Gi0/1" }, cost: 4 },
  { id: "sw1-sw3", a: { switchId: "sw1", portId: "Gi0/3" }, b: { switchId: "sw3", portId: "Gi0/1" }, cost: 19 },
  { id: "sw2-sw3", a: { switchId: "sw2", portId: "Gi0/2" }, b: { switchId: "sw3", portId: "Gi0/2" }, cost: 4 },
];

test("elege menor Bridge ID, calcula Root Ports e bloqueia caminho redundante", () => {
  const result = calculate(switches, links);
  assert.equal(result.status, "ok");
  assert.equal(result.rootId, "sw1");
  assert.deepEqual(result.costs, { sw1: 0, sw2: 4, sw3: 8 });
  assert.deepEqual(result.rootPorts, { sw2: "Gi0/1", sw3: "Gi0/2" });
  assert.deepEqual(result.blockedLinkIds, ["sw1-sw3"]);
  assert.equal(result.ports.sw3["Gi0/1"].role, "Blocking");
  assert.equal(result.ports.sw3["Gi0/1"].state, "Blocking");
  assert.equal(result.forwardingLinkIds.length, 2);
});

test("prioridade precede MAC e recalcula raiz e custos", () => {
  const changed = switches.map((sw) => ({ ...sw, priority: sw.id === "sw3" ? 0 : 32768 }));
  const result = calculate(changed, links);
  assert.equal(result.rootId, "sw3");
  assert.equal(result.costs.sw1, 8);
  assert.equal(result.costs.sw2, 4);
  assert.equal(result.rootPorts.sw1, "Gi0/2");
  assert.equal(result.rootPorts.sw2, "Gi0/2");
});

test("custos empatados usam Bridge ID e enlace redundante ganha papel Blocking", () => {
  const equalCosts = links.map((link) => ({ ...link, cost: 4 }));
  const result = calculate(switches, equalCosts);
  assert.equal(result.rootId, "sw1");
  assert.equal(result.ports.sw3["Gi0/2"].role, "Blocking");
});

test("escolhe caminho indireto quando a soma de custos é menor", () => {
  const asymmetric = links.map((link) => ({ ...link }));
  asymmetric.find((link) => link.id === "sw1-sw3").cost = 19;
  asymmetric.find((link) => link.id === "sw1-sw2").cost = 4;
  asymmetric.find((link) => link.id === "sw2-sw3").cost = 4;
  const result = calculate(switches, asymmetric);
  assert.equal(result.costs.sw3, 8);
  assert.equal(result.rootPorts.sw3, "Gi0/2");
  assert.equal(result.ports.sw3["Gi0/1"].role, "Blocking");
});

test("falha física marca interfaces Disabled e recalcula árvore por caminho restante", () => {
  const result = calculate(switches, links, "sw1-sw2");
  assert.equal(result.status, "ok");
  assert.equal(result.ports.sw1["Gi0/2"].state, "Disabled");
  assert.equal(result.ports.sw2["Gi0/1"].state, "Disabled");
  assert.deepEqual(result.costs, { sw1: 0, sw2: 23, sw3: 19 });
  assert.equal(result.ports.sw2["Gi0/2"].role, "Root Port");
  assert.equal(result.blockedLinkIds.length, 0);
});

test("rejeita prioridade fora do contrato e topologia acima do limite", () => {
  assert.equal(calculate([{ ...switches[0], priority: 3 }, switches[1]], links.slice(0, 1)).status, "invalid");
  assert.equal(calculate(switches, [...links, { ...links[0], id: "extra" }]).status, "invalid");
  assert.equal(MAX_ITERATIONS, 32);
});
