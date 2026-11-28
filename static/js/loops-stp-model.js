/* Small deterministic model of a three-bridge, classic-STP teaching topology. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NetStudyStpModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const MAX_ITERATIONS = 32;

  function compareBridge(a, b) {
    return Number(a.priority) - Number(b.priority) || String(a.mac).localeCompare(String(b.mac));
  }
  function comparePort(a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); }

  function calculate(switches, links, failedLinkId = null) {
    if (!Array.isArray(switches) || switches.length < 2 || switches.length > 3 || !Array.isArray(links) || links.length > 3) {
      return { status: "invalid", reason: "Esta demonstração aceita de dois a três switches e até três enlaces." };
    }
    const ids = new Set(switches.map((sw) => sw.id));
    if (ids.size !== switches.length || switches.some((sw) => !sw.id || !Number.isInteger(Number(sw.priority)) || Number(sw.priority) < 0 || Number(sw.priority) > 61440 || Number(sw.priority) % 4096 || !sw.mac)) {
      return { status: "invalid", reason: "Verifique IDs, endereços MAC e prioridades em múltiplos de 4096 entre 0 e 61440." };
    }
    const activeLinks = links.filter((link) => link.id !== failedLinkId);
    if (activeLinks.some((link) => !ids.has(link.a.switchId) || !ids.has(link.b.switchId) || link.a.switchId === link.b.switchId || !Number.isInteger(link.cost) || link.cost < 1 || link.cost > 200000000)) {
      return { status: "invalid", reason: "O grafo contém uma interface, conexão ou custo inválido." };
    }
    const byId = new Map(switches.map((sw) => [sw.id, sw]));
    const root = [...switches].sort(compareBridge)[0];
    const distance = Object.fromEntries(switches.map((sw) => [sw.id, sw.id === root.id ? 0 : Infinity]));
    const predecessor = {};
    const visited = new Set();
    let iterations = 0;
    while (visited.size < switches.length && iterations < MAX_ITERATIONS) {
      iterations += 1;
      const current = switches.filter((sw) => !visited.has(sw.id) && Number.isFinite(distance[sw.id]))
        .sort((a, b) => distance[a.id] - distance[b.id] || compareBridge(a, b))[0];
      if (!current) break;
      visited.add(current.id);
      for (const link of activeLinks) {
        const isA = link.a.switchId === current.id;
        const isB = link.b.switchId === current.id;
        if (!isA && !isB) continue;
        const from = isA ? link.a : link.b;
        const to = isA ? link.b : link.a;
        const candidate = distance[current.id] + link.cost;
        const prior = predecessor[to.switchId];
        const winsTie = candidate === distance[to.switchId] && prior &&
          (compareBridge(byId.get(current.id), byId.get(prior.fromSwitchId)) < 0 ||
            (compareBridge(byId.get(current.id), byId.get(prior.fromSwitchId)) === 0 && comparePort(from.portId, prior.fromPortId) < 0));
        if (candidate < distance[to.switchId] || winsTie) {
          distance[to.switchId] = candidate;
          predecessor[to.switchId] = { linkId: link.id, fromSwitchId: current.id, fromPortId: from.portId, localPortId: to.portId };
        }
      }
    }
    const ports = {};
    const rolesByLink = {};
    for (const sw of switches) ports[sw.id] = {};
    for (const link of links) {
      if (link.id === failedLinkId) {
        ports[link.a.switchId][link.a.portId] = { role: "Disabled", state: "Disabled", linkId: link.id };
        ports[link.b.switchId][link.b.portId] = { role: "Disabled", state: "Disabled", linkId: link.id };
        rolesByLink[link.id] = { active: false, designated: null, blocked: null };
        continue;
      }
      const leftIsDesignated = distance[link.a.switchId] < distance[link.b.switchId] ||
        (distance[link.a.switchId] === distance[link.b.switchId] &&
          (compareBridge(byId.get(link.a.switchId), byId.get(link.b.switchId)) < 0 ||
            (compareBridge(byId.get(link.a.switchId), byId.get(link.b.switchId)) === 0 && comparePort(link.a.portId, link.b.portId) < 0)));
      const designated = leftIsDesignated ? link.a : link.b;
      const other = leftIsDesignated ? link.b : link.a;
      const otherIsRootPort = predecessor[other.switchId]?.linkId === link.id;
      const otherRole = otherIsRootPort ? "Root Port" : "Non-designated Port";
      ports[designated.switchId][designated.portId] = { role: "Designated Port", state: "Forwarding", linkId: link.id };
      ports[other.switchId][other.portId] = { role: otherRole, state: otherIsRootPort ? "Forwarding" : "Blocking", linkId: link.id };
      rolesByLink[link.id] = { active: true, designated, other, blocked: otherIsRootPort ? null : other, rootPort: otherIsRootPort ? other : null };
    }
    return {
      status: visited.size === switches.length ? "ok" : "disconnected",
      rootId: root.id,
      rootBridgeId: `${root.priority} · ${root.mac}`,
      costs: distance,
      rootPorts: Object.fromEntries(Object.entries(predecessor).map(([id, item]) => [id, item.localPortId])),
      predecessor,
      ports,
      links: rolesByLink,
      forwardingLinkIds: activeLinks.filter((link) => rolesByLink[link.id] && rolesByLink[link.id].blocked === null).map((link) => link.id),
      blockedLinkIds: activeLinks.filter((link) => rolesByLink[link.id]?.blocked).map((link) => link.id),
      failedLinkId,
      iterations,
    };
  }
  return { calculate, MAX_ITERATIONS };
});
