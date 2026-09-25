/* Equipamentos, interfaces, posições, cabos e configurações da bancada. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports
    ? require("./integrated-lab-simulator.js") : root.NetStudyLabSimulator);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetStudyLabModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (simulator) {
  "use strict";
  const PC_IDS = Object.freeze(["pc-a", "pc-b", "pc-c", "pc-d"]);
  const SWITCH_IDS = Object.freeze(["sw1", "sw2"]);
  const DEVICE_IDS = Object.freeze(["pc-a", "sw1", "pc-b", "pc-c", "sw2", "pc-d"]);
  const INTERFACES = Object.freeze({
    ...Object.fromEntries(PC_IDS.map(id => [`${id}:eth0`, {deviceId: id, name: "Eth0"}])),
    ...Object.fromEntries(SWITCH_IDS.flatMap(id => [1, 2, 3, 4].map(n => [`${id}:gi0/${n}`, {deviceId: id, name: `Gi0/${n}`, mode: "access"}]))),
    ...Object.fromEntries(SWITCH_IDS.map(id => [`${id}:gi0/5`, {deviceId: id, name: "Gi0/5", mode: "trunk"}]))
  });
  const MACS = {"pc-a": "AA:AA:AA:AA:AA:AA", "pc-b": "BB:BB:BB:BB:BB:BB", "pc-c": "CC:CC:CC:CC:CC:CC", "pc-d": "DD:DD:DD:DD:DD:DD"};
  function create() {
    const devices = Object.fromEntries(PC_IDS.map((id, index) => [id, {id, type: "pc", name: `PC-${id.at(-1).toUpperCase()}`, position: null, interfaces: [`${id}:eth0`], config: {ip: `192.168.10.${(index + 1) * 10}`, mask: "255.255.255.0", mac: MACS[id]}}]));
    for (const id of SWITCH_IDS) devices[id] = {id, type: "switch", name: id.toUpperCase(), position: null, interfaces: [1, 2, 3, 4, 5].map(n => `${id}:gi0/${n}`), config: {vlans: Object.fromEntries([1, 2, 3, 4].map(n => [`${id}:gi0/${n}`, 10])), allowedVlans: [10, 20]}};
    return {devices, interfaces: INTERFACES, connections: []};
  }
  const clamp = value => Math.max(.08, Math.min(.92, value));
  function position(state, id, x, y) {
    if (!DEVICE_IDS.includes(id)) return {error: "Este equipamento não está disponível na bancada."};
    if (!Number.isFinite(x) || !Number.isFinite(y)) return {error: "Posição inválida."};
    if (!state.devices[id].position && DEVICE_IDS.filter(key => state.devices[key].position).length >= simulator.LIMITS.devices) return {error: "Limite de 6 dispositivos excedido."};
    return {state: {...state, devices: {...state.devices, [id]: {...state.devices[id], position: {x: clamp(x), y: clamp(y)}}}}};
  }
  function configure(state, id, values) {
    if (!DEVICE_IDS.includes(id)) return {error: "Equipamento desconhecido."};
    const config = {...state.devices[id].config, ...values};
    if (SWITCH_IDS.includes(id) && values.vlans) config.vlans = {...state.devices[id].config.vlans, ...values.vlans};
    if (SWITCH_IDS.includes(id) && values.allowedVlans) config.allowedVlans = [...values.allowedVlans];
    return {state: {...state, devices: {...state.devices, [id]: {...state.devices[id], config}}}};
  }
  function connectionId(a, b) { return [a, b].sort().join("--"); }
  function connect(state, a, b) {
    if (!INTERFACES[a] || !INTERFACES[b]) return {error: "Selecione duas interfaces disponíveis."};
    if (a === b || INTERFACES[a].deviceId === INTERFACES[b].deviceId) return {error: "As interfaces precisam pertencer a equipamentos diferentes."};
    const ids = [INTERFACES[a].deviceId, INTERFACES[b].deviceId];
    const pcSwitch = ids.some(id => PC_IDS.includes(id)) && ids.some(id => SWITCH_IDS.includes(id));
    const trunk = ids.every(id => SWITCH_IDS.includes(id));
    if (pcSwitch && (INTERFACES[a].mode === "trunk" || INTERFACES[b].mode === "trunk")) return {error: "PCs usam portas access; o uplink é exclusivo dos switches."};
    if (trunk && (INTERFACES[a].mode !== "trunk" || INTERFACES[b].mode !== "trunk")) return {error: "Conecte os switches apenas pelas interfaces de uplink Gi0/5."};
    if (!pcSwitch && !trunk) return {error: "Conecte PC a porta access ou os dois uplinks entre switches."};
    if (trunk && state.connections.some(link => [link.a, link.b].every(iface => INTERFACES[iface].mode === "trunk"))) return {error: "Somente um enlace trunk entre switches é permitido."};
    if (ids.some(id => !state.devices[id].position)) return {error: "Instale os dois equipamentos antes de conectar."};
    if (state.connections.some(link => [link.a, link.b].includes(a) || [link.a, link.b].includes(b))) return {error: "Uma das interfaces já está conectada. Desconecte-a primeiro."};
    if (state.connections.length >= simulator.LIMITS.links) return {error: "Limite de 5 cabos excedido."};
    return {state: {...state, connections: [...state.connections, {id: connectionId(a, b), a, b, type: trunk ? "trunk" : "access"}]}};
  }
  function disconnect(state, id) {
    if (!state.connections.some(link => link.id === id)) return {error: "Cabo não encontrado."};
    return {state: {...state, connections: state.connections.filter(link => link.id !== id)}};
  }
  function adapt(state, sourceId, destinationId) {
    if (!PC_IDS.includes(sourceId) || !state.devices[sourceId].position) return {error: "Escolha um PC de origem instalado."};
    if (!PC_IDS.includes(destinationId) || !state.devices[destinationId].position) return {error: "Escolha um PC de destino instalado."};
    if (sourceId === destinationId) return {error: "Origem e destino precisam ser PCs diferentes."};
    const installed = DEVICE_IDS.filter(id => state.devices[id].position);
    return {input: {
      devices: Object.fromEntries(installed.map(id => [id, {...state.devices[id], config: SWITCH_IDS.includes(id) ? {vlans: {...state.devices[id].config.vlans}, allowedVlans: [...state.devices[id].config.allowedVlans]} : {...state.devices[id].config}}])),
      interfaces: Object.fromEntries(Object.entries(state.interfaces).filter(([, item]) => installed.includes(item.deviceId))),
      connections: state.connections.map(link => ({...link})),
      sourceId, destinationId
    }};
  }
  function eventTargets(event) {
    return {deviceId: event?.focusId || null, interfaceIds: event?.interfaceIds || [], connectionIds: event?.connectionIds || []};
  }
  return {PC_IDS, SWITCH_IDS, DEVICE_IDS, INTERFACES, create, position, configure, connect, disconnect, adapt, eventTargets, connectionId};
});
