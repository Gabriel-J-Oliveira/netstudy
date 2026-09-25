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
  const ROUTER_IDS = Object.freeze(["r1"]);
  const SCENARIO_VERSION = 1;
  const DEVICE_IDS = Object.freeze(["pc-a", "sw1", "pc-b", "pc-c", "r1", "sw2", "pc-d"]);
  const INTERFACES = Object.freeze({
    ...Object.fromEntries(PC_IDS.map(id => [`${id}:eth0`, {deviceId: id, name: "Eth0"}])),
    ...Object.fromEntries(SWITCH_IDS.flatMap(id => [1, 2, 3, 4].map(n => [`${id}:gi0/${n}`, {deviceId: id, name: `Gi0/${n}`, mode: "access"}]))),
    ...Object.fromEntries(SWITCH_IDS.map(id => [`${id}:gi0/5`, {deviceId: id, name: "Gi0/5", mode: "trunk"}])),
    "r1:eth0": {deviceId: "r1", name: "Eth0", mode: "routed"},
    "r1:eth1": {deviceId: "r1", name: "Eth1", mode: "routed"}
  });
  const MACS = {"pc-a": "AA:AA:AA:AA:AA:AA", "pc-b": "BB:BB:BB:BB:BB:BB", "pc-c": "CC:CC:CC:CC:CC:CC", "pc-d": "DD:DD:DD:DD:DD:DD"};
  function create() {
    const devices = Object.fromEntries(PC_IDS.map((id, index) => [id, {id, type: "pc", name: `PC-${id.at(-1).toUpperCase()}`, position: null, interfaces: [`${id}:eth0`], config: {ip: `192.168.10.${(index + 1) * 10}`, mask: "255.255.255.0", mac: MACS[id], gateway: ""}}]));
    for (const id of SWITCH_IDS) devices[id] = {id, type: "switch", name: id.toUpperCase(), position: null, interfaces: [1, 2, 3, 4, 5].map(n => `${id}:gi0/${n}`), config: {vlans: Object.fromEntries([1, 2, 3, 4].map(n => [`${id}:gi0/${n}`, 10])), allowedVlans: [10, 20]}};
    devices.r1 = {id: "r1", type: "router", name: "R1", position: null, interfaces: ["r1:eth0", "r1:eth1"], config: {eth0: {ip: "192.168.10.1", mask: "255.255.255.0", mac: "10:10:10:10:10:10"}, eth1: {ip: "192.168.20.1", mask: "255.255.255.0", mac: "20:20:20:20:20:20"}}};
    return {devices, interfaces: INTERFACES, connections: []};
  }
  const clamp = value => Math.max(.08, Math.min(.92, value));
  function position(state, id, x, y) {
    if (!DEVICE_IDS.includes(id)) return {error: "Este equipamento não está disponível na bancada."};
    if (!Number.isFinite(x) || !Number.isFinite(y)) return {error: "Posição inválida."};
    if (!state.devices[id].position && DEVICE_IDS.filter(key => state.devices[key].position).length >= simulator.LIMITS.devices) return {error: "Limite de 7 dispositivos excedido."};
    return {state: {...state, devices: {...state.devices, [id]: {...state.devices[id], position: {x: clamp(x), y: clamp(y)}}}}};
  }
  function configure(state, id, values) {
    if (!DEVICE_IDS.includes(id)) return {error: "Equipamento desconhecido."};
    const config = {...state.devices[id].config, ...values};
    if (SWITCH_IDS.includes(id) && values.vlans) config.vlans = {...state.devices[id].config.vlans, ...values.vlans};
    if (SWITCH_IDS.includes(id) && values.allowedVlans) config.allowedVlans = [...values.allowedVlans];
    if (ROUTER_IDS.includes(id)) for (const iface of ["eth0", "eth1"]) if (values[iface]) config[iface] = {...state.devices[id].config[iface], ...values[iface]};
    return {state: {...state, devices: {...state.devices, [id]: {...state.devices[id], config}}}};
  }
  function connectionId(a, b) { return [a, b].sort().join("--"); }
  function connect(state, a, b) {
    if (!INTERFACES[a] || !INTERFACES[b]) return {error: "Selecione duas interfaces disponíveis."};
    if (a === b || INTERFACES[a].deviceId === INTERFACES[b].deviceId) return {error: "As interfaces precisam pertencer a equipamentos diferentes."};
    const ids = [INTERFACES[a].deviceId, INTERFACES[b].deviceId];
    const pcSwitch = ids.some(id => PC_IDS.includes(id)) && ids.some(id => SWITCH_IDS.includes(id));
    const routerSwitch = ids.some(id => ROUTER_IDS.includes(id)) && ids.some(id => SWITCH_IDS.includes(id));
    const trunk = ids.every(id => SWITCH_IDS.includes(id));
    if (pcSwitch && (INTERFACES[a].mode === "trunk" || INTERFACES[b].mode === "trunk")) return {error: "PCs usam portas access; o uplink é exclusivo dos switches."};
    if (routerSwitch && (INTERFACES[a].mode === "trunk" || INTERFACES[b].mode === "trunk")) return {error: "R1 usa interfaces físicas ligadas a portas access, não ao trunk."};
    if (trunk && (INTERFACES[a].mode !== "trunk" || INTERFACES[b].mode !== "trunk")) return {error: "Conecte os switches apenas pelas interfaces de uplink Gi0/5."};
    if (!pcSwitch && !routerSwitch && !trunk) return {error: "Conecte PC ou R1 a porta access, ou os dois uplinks entre switches."};
    if (trunk && state.connections.some(link => [link.a, link.b].every(iface => INTERFACES[iface].mode === "trunk"))) return {error: "Somente um enlace trunk entre switches é permitido."};
    if (ids.some(id => !state.devices[id].position)) return {error: "Instale os dois equipamentos antes de conectar."};
    if (state.connections.some(link => [link.a, link.b].includes(a) || [link.a, link.b].includes(b))) return {error: "Uma das interfaces já está conectada. Desconecte-a primeiro."};
    if (state.connections.length >= simulator.LIMITS.links) return {error: "Limite de 7 cabos excedido."};
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
      devices: Object.fromEntries(installed.map(id => [id, {...state.devices[id], config: SWITCH_IDS.includes(id) ? {vlans: {...state.devices[id].config.vlans}, allowedVlans: [...state.devices[id].config.allowedVlans]} : ROUTER_IDS.includes(id) ? {eth0: {...state.devices[id].config.eth0}, eth1: {...state.devices[id].config.eth1}} : {...state.devices[id].config}}])),
      interfaces: Object.fromEntries(Object.entries(state.interfaces).filter(([, item]) => installed.includes(item.deviceId))),
      connections: state.connections.map(link => ({...link})),
      sourceId, destinationId
    }};
  }
  function eventTargets(event) {
    return {deviceId: event?.focusId || null, interfaceIds: event?.interfaceIds || [], connectionIds: event?.connectionIds || []};
  }
  const record = value => value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  function keys(value, required, optional, label) {
    if (!record(value)) throw new TypeError(label + " deve ser um objeto.");
    const actual = Object.keys(value);
    const allowed = [...required, ...optional];
    if (required.some(key => !Object.hasOwn(value, key)) || actual.some(key => !allowed.includes(key)))
      throw new TypeError(label + " possui campos ausentes ou desconhecidos.");
  }
  function address(config, label, withGateway = false) {
    keys(config, withGateway ? ["ip", "mask", "mac", "gateway"] : ["ip", "mask", "mac"], [], label);
    if (!simulator.ipv4(config.ip) || !simulator.mask(config.mask) ||
        typeof config.mac !== "string" || !/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(config.mac) ||
        (withGateway && config.gateway !== "" && !simulator.ipv4(config.gateway)))
      throw new TypeError(label + " tem IPv4, máscara, MAC ou gateway estruturalmente inválido.");
  }
  function switchConfig(config, id) {
    keys(config, ["vlans", "allowedVlans"], [], "Configuração de " + id);
    const ports = [1, 2, 3, 4].map(n => id + ":gi0/" + n);
    keys(config.vlans, ports, [], "Portas de " + id);
    if (ports.some(port => ![10, 20].includes(config.vlans[port])) ||
        !Array.isArray(config.allowedVlans) ||
        config.allowedVlans.some(vlan => ![10, 20].includes(vlan)) ||
        new Set(config.allowedVlans).size !== config.allowedVlans.length)
      throw new TypeError("VLANs inválidas em " + id + ".");
  }
  function importScenario(scenario) {
    keys(scenario, ["schemaVersion", "devices", "connections"], ["name", "sourceId", "destinationId"], "Cenário");
    if (scenario.schemaVersion !== SCENARIO_VERSION) throw new TypeError("schemaVersion desconhecida.");
    if (Object.hasOwn(scenario, "name") && (typeof scenario.name !== "string" || !scenario.name.trim() || scenario.name.length > 120))
      throw new TypeError("Nome do cenário inválido.");
    keys(scenario.devices, DEVICE_IDS, [], "Equipamentos do cenário");
    if (!Array.isArray(scenario.connections) || scenario.connections.length > simulator.LIMITS.links)
      throw new TypeError("Lista de conexões inválida.");
    let state = create();
    for (const id of DEVICE_IDS) {
      const entry = scenario.devices[id];
      keys(entry, ["position", "config"], [], "Equipamento " + id);
      if (entry.position !== null) {
        keys(entry.position, ["x", "y"], [], "Posição de " + id);
        if (![entry.position.x, entry.position.y].every(value => Number.isFinite(value) && value >= .08 && value <= .92))
          throw new TypeError("Posição inválida em " + id + ".");
        state = position(state, id, entry.position.x, entry.position.y).state;
      }
      if (PC_IDS.includes(id)) address(entry.config, id, true);
      else if (SWITCH_IDS.includes(id)) switchConfig(entry.config, id);
      else {
        keys(entry.config, ["eth0", "eth1"], [], "Configuração de R1");
        address(entry.config.eth0, "R1 Eth0");
        address(entry.config.eth1, "R1 Eth1");
      }
      state = configure(state, id, entry.config).state;
    }
    for (const cable of scenario.connections) {
      keys(cable, ["a", "b"], [], "Conexão");
      if (typeof cable.a !== "string" || typeof cable.b !== "string" ||
          !Object.hasOwn(INTERFACES, cable.a) || !Object.hasOwn(INTERFACES, cable.b))
        throw new TypeError("Conexão usa interface inexistente.");
      const change = connect(state, cable.a, cable.b);
      if (change.error) throw new TypeError("Conexão inválida: " + change.error);
      state = change.state;
    }
    const source = Object.hasOwn(scenario, "sourceId"), destination = Object.hasOwn(scenario, "destinationId");
    if (source !== destination) throw new TypeError("Origem e destino devem aparecer juntos.");
    if (source && (!PC_IDS.includes(scenario.sourceId) || !PC_IDS.includes(scenario.destinationId) ||
        !state.devices[scenario.sourceId].position || !state.devices[scenario.destinationId].position ||
        scenario.sourceId === scenario.destinationId))
      throw new TypeError("Par de PCs inválido para o cenário.");
    return {state, name: scenario.name ?? null, sourceId: source ? scenario.sourceId : null,
      destinationId: destination ? scenario.destinationId : null};
  }
  function exportScenario(state, metadata = {}) {
    keys(metadata, [], ["name", "sourceId", "destinationId"], "Metadados do cenário");
    if (!record(state) || !record(state.devices) || !Array.isArray(state.connections))
      throw new TypeError("Estado da bancada inválido.");
    const devices = Object.fromEntries(DEVICE_IDS.map(id => {
      const device = state.devices[id];
      if (!record(device) || !record(device.config)) throw new TypeError("Equipamento " + id + " ausente.");
      const config = PC_IDS.includes(id)
        ? {ip: device.config.ip, mask: device.config.mask, mac: device.config.mac, gateway: device.config.gateway}
        : SWITCH_IDS.includes(id)
          ? {vlans: Object.fromEntries([1, 2, 3, 4].map(n => {
            const port = id + ":gi0/" + n; return [port, device.config.vlans?.[port]];
          })), allowedVlans: [...(device.config.allowedVlans || [])]}
          : {eth0: {...device.config.eth0}, eth1: {...device.config.eth1}};
      return [id, {position: device.position === null ? null : {...device.position}, config}];
    }));
    const scenario = {schemaVersion: SCENARIO_VERSION, ...metadata, devices,
      connections: state.connections.map(link => ({a: link.a, b: link.b}))};
    importScenario(scenario);
    return scenario;
  }
  return {PC_IDS, SWITCH_IDS, ROUTER_IDS, DEVICE_IDS, INTERFACES, SCENARIO_VERSION,
    create, position, configure, connect, disconnect, adapt, eventTargets, connectionId,
    exportScenario, importScenario};
});
