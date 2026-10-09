/* Equipamentos, interfaces, posições, cabos e configurações da bancada. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports
    ? require("./integrated-lab-simulator.js") : root.NetStudyLabSimulator,
    typeof module === "object" && module.exports ? require("./integrated-lab-profiles.js") : root.NetStudyLabProfiles);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetStudyLabModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (simulator, profiles) {
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
  const TYPES = Object.freeze({pc: "pc", switch: "switch", router: "router"});
  const PREFIX = Object.freeze({pc: "pc", switch: "switch", router: "router"});
  function createEmpty() { return {devices: {}, interfaces: {}, connections: [], nextIds: {pc: 1, switch: 1, router: 1}}; }
  function defaultDevice(type, id, number) {
    if (type === "pc") {
      const ip = number <= 245 ? `192.168.10.${number + 9}` : `10.${Math.floor((number - 246) / 64516) % 256}.${Math.floor((number - 246) / 254) % 254}.${(number - 246) % 254 + 1}`;
      return {id, type, name: `PC-${number}`, position: null, interfaces: [`${id}:eth0`], config: {ip, mask: "255.255.255.0", mac: dynamicMac(type, number, 0), gateway: ""}};
    }
    if (type === "switch") return {id, type, name: `SW-${number}`, position: null, interfaces: [1, 2, 3, 4, 5].map(n => `${id}:gi0/${n}`), config: {vlans: Object.fromEntries([1, 2, 3, 4].map(n => [`${id}:gi0/${n}`, 10])), allowedVlans: [10, 20]}};
    if (type === "router") {
      const first = number === 1 ? "192.168.10.1" : `172.${16 + Math.floor((number - 2) / 254) % 16}.${(number - 2) % 254 + 1}.1`;
      const second = number === 1 ? "192.168.20.1" : `172.${32 + Math.floor((number - 2) / 254) % 16}.${(number - 2) % 254 + 1}.1`;
      return {id, type, name: `R-${number}`, position: null, interfaces: [`${id}:eth0`, `${id}:eth1`], config: {eth0: {ip: first, mask: "255.255.255.0", mac: dynamicMac(type, number, 0)}, eth1: {ip: second, mask: "255.255.255.0", mac: dynamicMac(type, number, 1)}}};
    }
    throw new TypeError("Tipo de equipamento desconhecido.");
  }
  function dynamicMac(type, number, interfaceNumber) {
    const code = {pc: 0x02, router: 0x06}[type];
    const value = number >>> 0;
    return [code, interfaceNumber, (value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].map(byte => byte.toString(16).padStart(2, "0")).join(":").toUpperCase();
  }
  function addDevice(state, type, profile = "generic") {
    if (!Object.hasOwn(PREFIX, type)) return {error: "Tipo de equipamento desconhecido."};
    try { profiles.get(type, profile); } catch (error) { return {error: error.message}; }
    let number = state.nextIds?.[type] || 1;
    while (Object.hasOwn(state.devices, `${PREFIX[type]}-${number}`)) number++;
    const id = `${PREFIX[type]}-${number}`, device = defaultDevice(type, id, number);
    device.profile = profile;
    const interfaces = {...state.interfaces};
    device.interfaces.forEach((interfaceId, index) => {
      interfaces[interfaceId] = {deviceId: id, name: type === "switch" ? `Gi0/${index + 1}` : `Eth${index}`,
        ...(type === "switch" ? {mode: index === 4 ? "trunk" : "access"} : type === "router" ? {mode: "routed"} : {})};
    });
    return {id, state: {...state, devices: {...state.devices, [id]: device}, interfaces,
      nextIds: {...(state.nextIds || {pc: 1, switch: 1, router: 1}), [type]: number + 1}}};
  }
  function renameDevice(state, id, name) {
    if (!state.devices[id]) return {error: "Equipamento desconhecido."};
    const clean = typeof name === "string" ? name.trim() : "";
    if (!clean || clean.length > 80) return {error: "Nome deve ter entre 1 e 80 caracteres."};
    return {state: {...state, nextIds: state.nextIds || {pc: 1, switch: 1, router: 1}, devices: {...state.devices, [id]: {...state.devices[id], name: clean}}}};
  }
  function setProfile(state, id, profile) {
    if (!state.devices[id]) return {error: "Equipamento desconhecido."};
    if (typeof profile !== "string") return {error: "Profile incompatível com o tipo de equipamento."};
    try { profiles.get(state.devices[id].type, profile); } catch (error) { return {error: error.message}; }
    return {state: {...state, devices: {...state.devices, [id]: {...state.devices[id], profile}}}};
  }
  function interfaceName(state, interfaceId) {
    const iface = state.interfaces[interfaceId];
    if (!iface) throw new TypeError("Interface inexistente.");
    return profiles.interfaceName(state.devices[iface.deviceId], interfaceId);
  }
  function removeDevice(state, id) {
    if (!state.devices[id]) return {error: "Equipamento desconhecido."};
    const devices = {...state.devices}, interfaces = {...state.interfaces};
    devices[id].interfaces.forEach(interfaceId => { delete interfaces[interfaceId]; });
    delete devices[id];
    return {state: {...state, nextIds: state.nextIds || {pc: 1, switch: 1, router: 1}, devices, interfaces, connections: state.connections.filter(link => interfaces[link.a] && interfaces[link.b])}};
  }
  function create() {
    const devices = Object.fromEntries(PC_IDS.map((id, index) => [id, {id, type: "pc", name: `PC-${id.at(-1).toUpperCase()}`, position: null, interfaces: [`${id}:eth0`], config: {ip: `192.168.10.${(index + 1) * 10}`, mask: "255.255.255.0", mac: MACS[id], gateway: ""}}]));
    for (const id of SWITCH_IDS) devices[id] = {id, type: "switch", name: id.toUpperCase(), position: null, interfaces: [1, 2, 3, 4, 5].map(n => `${id}:gi0/${n}`), config: {vlans: Object.fromEntries([1, 2, 3, 4].map(n => [`${id}:gi0/${n}`, 10])), allowedVlans: [10, 20]}};
    devices.r1 = {id: "r1", type: "router", name: "R1", position: null, interfaces: ["r1:eth0", "r1:eth1"], config: {eth0: {ip: "192.168.10.1", mask: "255.255.255.0", mac: "10:10:10:10:10:10"}, eth1: {ip: "192.168.20.1", mask: "255.255.255.0", mac: "20:20:20:20:20:20"}}};
    for (const device of Object.values(devices)) device.profile = "generic";
    return {devices, interfaces: INTERFACES, connections: []};
  }
  const clamp = value => Math.max(.08, Math.min(.92, value));
  function position(state, id, x, y) {
    if (!state.devices[id]) return {error: "Este equipamento não está disponível na bancada."};
    if (!Number.isFinite(x) || !Number.isFinite(y)) return {error: "Posição inválida."};
    return {state: {...state, devices: {...state.devices, [id]: {...state.devices[id], position: {x: clamp(x), y: clamp(y)}}}}};
  }
  function configure(state, id, values) {
    if (!state.devices[id]) return {error: "Equipamento desconhecido."};
    const config = {...state.devices[id].config, ...values};
    if (state.devices[id].type === "switch" && values.vlans) config.vlans = {...state.devices[id].config.vlans, ...values.vlans};
    if (state.devices[id].type === "switch" && values.allowedVlans) config.allowedVlans = [...values.allowedVlans];
    if (values.portSettings) {
      const existingSettings = state.devices[id].config.portSettings || {};
      config.portSettings = {...existingSettings, ...Object.fromEntries(Object.entries(values.portSettings).map(([port, value]) => [port, {...(existingSettings[port] || {}), ...value}]))};
    }
    if (state.devices[id].type === "router") for (const iface of ["eth0", "eth1"]) if (values[iface]) config[iface] = {...state.devices[id].config[iface], ...values[iface]};
    if (state.devices[id].type === "router" && values.staticRoutes) config.staticRoutes = values.staticRoutes.map(route => ({...route}));
    if (state.devices[id].type === "router" && values.nat) config.nat = {...(state.devices[id].config.nat || emptyNat()), ...values.nat};
    if (state.devices[id].type === "pc") {
      if (values.dhcpServer) config.dhcpServer = {...values.dhcpServer};
      if (values.dnsServer) config.dnsServer = {...values.dnsServer, records: values.dnsServer.records?.map(record => ({...record})) || []};
      if (values.services) config.services = values.services.map(service => ({...service}));
    }
    return {state: {...state, devices: {...state.devices, [id]: {...state.devices[id], config}}}};
  }
  function validStaticRoute(route) {
    if (!record(route)) return false;
    try { keys(route, ["destination", "mask", "nextHop"], [], "Rota estática"); } catch (_) { return false; }
    const destination = simulator.ipv4(route.destination), routeMask = simulator.mask(route.mask);
    return Boolean(destination && routeMask && simulator.ipv4(route.nextHop) &&
      simulator.prefix(destination, routeMask).split("/")[0] === route.destination);
  }
  function validateStaticRoutes(routes) {
    if (!Array.isArray(routes) || routes.length > 64 || routes.some(route => !validStaticRoute(route)) ||
        new Set(routes.map(route => `${route.destination}/${route.mask}`)).size !== routes.length)
      throw new TypeError("Rotas estáticas inválidas: use rede canônica, máscara contígua e next hop IPv4, sem duplicatas.");
  }
  const emptyNat = () => ({inside: "", outside: "", sourceNetwork: "", sourceMask: "", enabled: false});
  function validNat(nat) {
    if (!record(nat)) return false;
    try { keys(nat, ["inside", "outside", "sourceNetwork", "sourceMask", "enabled"], [], "NAT"); } catch (_) { return false; }
    if (![nat.inside, nat.outside].every(value => ["", "eth0", "eth1"].includes(value)) ||
        (nat.inside && nat.inside === nat.outside) || typeof nat.enabled !== "boolean") return false;
    if (nat.sourceNetwork === "" || nat.sourceMask === "") return (nat.sourceNetwork === "" || Boolean(simulator.ipv4(nat.sourceNetwork))) &&
      (nat.sourceMask === "" || Boolean(simulator.mask(nat.sourceMask)));
    const ip = simulator.ipv4(nat.sourceNetwork), netmask = simulator.mask(nat.sourceMask);
    return Boolean(ip && netmask && simulator.prefix(ip, netmask).split("/")[0] === nat.sourceNetwork);
  }
  function setNat(state, id, values) {
    if (state.devices[id]?.type !== "router") return {error: "Selecione um roteador."};
    const nat = {...(state.devices[id].config.nat || emptyNat()), ...values};
    if (!validNat(nat)) return {error: "NAT inválido: defina interfaces distintas e uma rede de origem canônica."};
    return configure(state, id, {nat});
  }
  function setStaticRoute(state, id, route) {
    if (state.devices[id]?.type !== "router") return {error: "Selecione um roteador."};
    if (!validStaticRoute(route)) return {error: "Rota inválida: informe rede canônica, máscara contígua e next hop IPv4."};
    const current = state.devices[id].config.staticRoutes || [];
    const next = current.filter(item => item.destination !== route.destination || item.mask !== route.mask);
    if (next.length >= 64) return {error: "Limite de 64 rotas estáticas por roteador."};
    return configure(state, id, {staticRoutes: [...next, {...route}]});
  }
  function removeStaticRoute(state, id, destination, routeMask) {
    if (state.devices[id]?.type !== "router") return {error: "Selecione um roteador."};
    const current = state.devices[id].config.staticRoutes || [];
    const next = current.filter(item => item.destination !== destination || item.mask !== routeMask);
    return next.length === current.length ? {error: "Rota estática não encontrada."} : configure(state, id, {staticRoutes: next});
  }
  function setInterfaceMode(state, interfaceId, mode) {
    const iface = state.interfaces[interfaceId], device = iface && state.devices[iface.deviceId];
    if (!device || device.type !== "switch" || !["access", "trunk"].includes(mode)) return {error: "Modo de switchport inválido para esta interface."};
    const devices = {...state.devices};
    if (mode === "access" && device.config.vlans[interfaceId] === undefined)
      devices[device.id] = {...device, config: {...device.config, vlans: {...device.config.vlans, [interfaceId]: 10}}};
    return {state: {...state, devices, interfaces: {...state.interfaces, [interfaceId]: {...iface, mode}}}};
  }
  function connectionId(a, b) { return [a, b].sort().join("--"); }
  function connect(state, a, b) {
    const interfaces = state.interfaces;
    if (!interfaces[a] || !interfaces[b]) return {error: "Selecione duas interfaces disponíveis."};
    if (a === b || interfaces[a].deviceId === interfaces[b].deviceId) return {error: "As interfaces precisam pertencer a equipamentos diferentes."};
    const ids = [interfaces[a].deviceId, interfaces[b].deviceId];
    const types = ids.map(id => state.devices[id].type);
    const pcSwitch = types.includes("pc") && types.includes("switch");
    const routerSwitch = types.includes("router") && types.includes("switch");
    const switchLink = types.every(type => type === "switch");
    const routerLink = types.every(type => type === "router") && interfaces[a].mode === "routed" && interfaces[b].mode === "routed";
    const trunk = switchLink && interfaces[a].mode === "trunk" && interfaces[b].mode === "trunk";
    if (pcSwitch && (interfaces[a].mode === "trunk" || interfaces[b].mode === "trunk")) return {error: "PCs usam portas access; o uplink é exclusivo dos switches."};
    if (routerSwitch && (interfaces[a].mode === "trunk" || interfaces[b].mode === "trunk")) return {error: "Roteadores usam interfaces físicas ligadas a portas access, não ao trunk."};
    if (!pcSwitch && !routerSwitch && !switchLink && !routerLink) return {error: "Conecte hosts a portas access, uplinks trunk ou duas interfaces roteadas."};
    if (ids.some(id => !state.devices[id].position)) return {error: "Instale os dois equipamentos antes de conectar."};
    if (state.connections.some(link => [link.a, link.b].includes(a) || [link.a, link.b].includes(b))) return {error: "Uma das interfaces já está conectada. Desconecte-a primeiro."};
    return {state: {...state, connections: [...state.connections, {id: connectionId(a, b), a, b, type: routerLink ? "routed" : trunk ? "trunk" : "access"}]}};
  }
  function disconnect(state, id) {
    if (!state.connections.some(link => link.id === id)) return {error: "Cabo não encontrado."};
    return {state: {...state, connections: state.connections.filter(link => link.id !== id)}};
  }
  function operationalGraph(state) {
    const installed = Object.keys(state.devices).filter(id => state.devices[id].position);
    return {
      devices: Object.fromEntries(installed.map(id => [id, {...state.devices[id], config: JSON.parse(JSON.stringify(state.devices[id].config))}])),
      interfaces: Object.fromEntries(Object.entries(state.interfaces).filter(([, item]) => installed.includes(item.deviceId))),
      connections: state.connections.filter(link => ![link.a, link.b].some(port =>
        state.devices[state.interfaces[port]?.deviceId]?.config?.portSettings?.[port]?.shutdown)).map(link => ({...link}))
    };
  }
  function adapt(state, sourceId, destinationId) {
    if (state.devices[sourceId]?.type !== "pc" || !state.devices[sourceId].position) return {error: "Escolha um PC de origem instalado."};
    if (state.devices[destinationId]?.type !== "pc" || !state.devices[destinationId].position) return {error: "Escolha um PC de destino instalado."};
    if (sourceId === destinationId) return {error: "Origem e destino precisam ser PCs diferentes."};
    return {input: {...operationalGraph(state), sourceId, destinationId}};
  }
  function adaptForPing(state, sourceId) {
    const source = state.devices[sourceId];
    if (!source || !["pc", "router"].includes(source.type) || !source.position)
      return {error: "Escolha um PC ou roteador instalado para originar o ping."};
    return {input: {...operationalGraph(state), sourceId}};
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
    keys(config, withGateway ? ["ip", "mask", "mac", "gateway"] : ["ip", "mask", "mac"],
      withGateway ? ["portSettings", "dns", "dhcpClient", "dhcpServer", "dnsServer", "services"] : [], label);
    const unassigned = config.ip === "" && config.mask === "";
    if ((!unassigned && (!simulator.ipv4(config.ip) || !simulator.mask(config.mask))) ||
        typeof config.mac !== "string" || !/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(config.mac) ||
        (withGateway && config.gateway !== "" && !simulator.ipv4(config.gateway)))
      throw new TypeError(label + " tem IPv4, máscara, MAC ou gateway estruturalmente inválido.");
    if (withGateway && config.portSettings) validatePortSettings(config.portSettings, [label + ":eth0"]);
    if (withGateway) validateHostServices(config);
  }
  function validateHostServices(config) {
    if (config.dns !== undefined && config.dns !== "" && !simulator.ipv4(config.dns)) throw new TypeError("DNS do host inválido.");
    if (config.dhcpClient !== undefined && typeof config.dhcpClient !== "boolean") throw new TypeError("Modo DHCP do host inválido.");
    if (config.dhcpServer !== undefined) {
      const server=config.dhcpServer;keys(server,["enabled","poolStart","poolEnd","mask","gateway","dns","leaseMinutes"],[],"Servidor DHCP");
      if(typeof server.enabled!=="boolean"||![server.poolStart,server.poolEnd,server.gateway].every(simulator.ipv4)||
          !simulator.mask(server.mask)||(server.dns!==""&&!simulator.ipv4(server.dns))||
          !Number.isInteger(server.leaseMinutes)||server.leaseMinutes<1||server.leaseMinutes>10080)
        throw new TypeError("Pool ou opções DHCP inválidos.");
      const start=server.poolStart.split(".").reduce((n,part)=>(n<<8)>>>0|Number(part),0)>>>0;
      const end=server.poolEnd.split(".").reduce((n,part)=>(n<<8)>>>0|Number(part),0)>>>0;
      if(start>end||end-start>1023||!simulator.sameSubnet(simulator.ipv4(server.poolStart),simulator.ipv4(server.poolEnd),simulator.mask(server.mask)))
        throw new TypeError("Pool DHCP deve conter até 1024 endereços na mesma rede.");
    }
    if (config.dnsServer !== undefined) {
      const server=config.dnsServer;keys(server,["enabled","records"],[],"Servidor DNS");
      if(typeof server.enabled!=="boolean"||!Array.isArray(server.records)||server.records.length>64)throw new TypeError("Registros DNS inválidos.");
      const seen=new Set();for(const record of server.records){keys(record,["name","address"],[],"Registro A");
        if(typeof record.name!=="string")throw new TypeError("Registro A inválido.");
        const name=record.name.toLowerCase();if(!/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(name)||name.includes("..")||!simulator.ipv4(record.address)||seen.has(name))throw new TypeError("Registro A inválido ou duplicado.");seen.add(name);}
    }
    if(config.services!==undefined){if(!Array.isArray(config.services)||config.services.length>32)throw new TypeError("Serviços inválidos.");
      const seen=new Set();for(const service of config.services){keys(service,["name","protocol","port","enabled"],[],"Serviço");
        const key=`${service.protocol}:${service.port}`;if(typeof service.name!=="string"||!service.name.trim()||service.name.length>60||
          !["tcp","udp"].includes(service.protocol)||!Number.isInteger(service.port)||service.port<1||service.port>65535||
          typeof service.enabled!=="boolean"||seen.has(key))throw new TypeError("Serviço TCP/UDP inválido ou duplicado.");seen.add(key);}
    }
  }
  function setHostServices(state,id,values) {
    if(state.devices[id]?.type!=="pc")return {error:"Selecione um PC ou servidor."};
    const config={...state.devices[id].config,...values};
    try{validateHostServices(config);}catch(error){return {error:error.message};}
    return configure(state,id,values);
  }
  function switchConfig(config, id) {
    keys(config, ["vlans", "allowedVlans"], ["portSettings"], "Configuração de " + id);
    const ports = [1, 2, 3, 4].map(n => id + ":gi0/" + n);
    keys(config.vlans, ports, [id + ":gi0/5"], "Portas de " + id);
    const validVlan = vlan => Number.isInteger(vlan) && vlan >= 1 && vlan <= 4094;
    if ([...ports, id + ":gi0/5"].some(port => config.vlans[port] !== undefined && !validVlan(config.vlans[port])) ||
        ports.some(port => !validVlan(config.vlans[port])) ||
        !Array.isArray(config.allowedVlans) ||
        config.allowedVlans.some(vlan => !validVlan(vlan)) ||
        new Set(config.allowedVlans).size !== config.allowedVlans.length)
      throw new TypeError("VLANs inválidas em " + id + ".");
    if (config.portSettings) validatePortSettings(config.portSettings, [...ports, id + ":gi0/5"]);
  }
  function validatePortSettings(settings, ports) {
    keys(settings, [], ports, "Configuração de interfaces");
    for (const [id, value] of Object.entries(settings)) {
      keys(value, [], ["shutdown", "description"], "Interface " + id);
      if ((value.shutdown !== undefined && typeof value.shutdown !== "boolean") ||
          (value.description !== undefined && (typeof value.description !== "string" || value.description.length > 240)))
        throw new TypeError("Configuração inválida em " + id + ".");
    }
  }
  function importScenario(scenario) {
    if (scenario?.format === "dynamic") return importDynamicScenario(scenario);
    keys(scenario, ["schemaVersion", "devices", "connections"], ["name", "sourceId", "destinationId", "interfaceModes"], "Cenário");
    if (scenario.schemaVersion !== SCENARIO_VERSION) throw new TypeError("schemaVersion desconhecida.");
    if (Object.hasOwn(scenario, "name") && (typeof scenario.name !== "string" || !scenario.name.trim() || scenario.name.length > 120))
      throw new TypeError("Nome do cenário inválido.");
    keys(scenario.devices, DEVICE_IDS, [], "Equipamentos do cenário");
    if (!Array.isArray(scenario.connections) || scenario.connections.length > simulator.LIMITS.links)
      throw new TypeError("Lista de conexões inválida.");
    let state = create();
    if (scenario.interfaceModes !== undefined) {
      const allowedPorts = Object.keys(state.interfaces).filter(port => state.interfaces[port].deviceId.startsWith("sw"));
      keys(scenario.interfaceModes, [], allowedPorts, "Modos de interface");
      for (const [port, mode] of Object.entries(scenario.interfaceModes)) {
        const changed = setInterfaceMode(state, port, mode);
        if (changed.error) throw new TypeError(changed.error);
        state = changed.state;
      }
    }
    for (const id of DEVICE_IDS) {
      const entry = scenario.devices[id];
      keys(entry, ["position", "config"], ["profile"], "Equipamento " + id);
      const selected = setProfile(state, id, Object.hasOwn(entry, "profile") ? entry.profile : "generic");
      if (selected.error) throw new TypeError(selected.error);
      state = selected.state;
      if (entry.position !== null) {
        keys(entry.position, ["x", "y"], [], "Posição de " + id);
        if (![entry.position.x, entry.position.y].every(value => Number.isFinite(value) && value >= .08 && value <= .92))
          throw new TypeError("Posição inválida em " + id + ".");
        state = position(state, id, entry.position.x, entry.position.y).state;
      }
      if (PC_IDS.includes(id)) address(entry.config, id, true);
      else if (SWITCH_IDS.includes(id)) switchConfig(entry.config, id);
      else {
        keys(entry.config, ["eth0", "eth1"], ["portSettings", "staticRoutes", "nat"], "Configuração de R1");
        address(entry.config.eth0, "R1 Eth0");
        address(entry.config.eth1, "R1 Eth1");
        if (entry.config.portSettings) validatePortSettings(entry.config.portSettings, ["r1:eth0", "r1:eth1"]);
        if (entry.config.staticRoutes) validateStaticRoutes(entry.config.staticRoutes);
        if (entry.config.nat && !validNat(entry.config.nat)) throw new TypeError("NAT inválido em R1.");
      }
      if (SWITCH_IDS.includes(id) && scenario.interfaceModes && Object.keys(scenario.interfaceModes).some(port => port.startsWith(id + ":"))) {
        const savedModes = Object.entries(scenario.interfaceModes).filter(([port]) => port.startsWith(id + ":"));
        for (const [port, mode] of savedModes) state = setInterfaceMode(state, port, mode).state;
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
    if (state.nextIds) return exportDynamicScenario(state, metadata);
    keys(metadata, [], ["name", "sourceId", "destinationId"], "Metadados do cenário");
    if (!record(state) || !record(state.devices) || !Array.isArray(state.connections))
      throw new TypeError("Estado da bancada inválido.");
    const devices = Object.fromEntries(DEVICE_IDS.map(id => {
      const device = state.devices[id];
      if (!record(device) || !record(device.config)) throw new TypeError("Equipamento " + id + " ausente.");
      const config = PC_IDS.includes(id)
        ? {ip: device.config.ip, mask: device.config.mask, mac: device.config.mac, gateway: device.config.gateway,
          ...Object.fromEntries(["dns","dhcpClient","dhcpServer","dnsServer","services"].filter(key=>Object.hasOwn(device.config,key)).map(key=>[key,JSON.parse(JSON.stringify(device.config[key]))]))}
        : SWITCH_IDS.includes(id)
          ? {vlans: Object.fromEntries([1, 2, 3, 4].map(n => {
            const port = id + ":gi0/" + n; return [port, device.config.vlans?.[port]];
          })), allowedVlans: [...(device.config.allowedVlans || [])]}
          : {eth0: {...device.config.eth0}, eth1: {...device.config.eth1}, ...(device.config.staticRoutes ? {staticRoutes: device.config.staticRoutes.map(route => ({...route}))} : {}), ...(device.config.nat ? {nat: {...device.config.nat}} : {})};
      if (SWITCH_IDS.includes(id) && state.interfaces[id + ":gi0/5"].mode === "access") config.vlans[id + ":gi0/5"] = device.config.vlans[id + ":gi0/5"] ?? 10;
      if (Object.keys(device.config.portSettings || {}).length) config.portSettings = JSON.parse(JSON.stringify(device.config.portSettings));
      return [id, {profile: Object.hasOwn(device, "profile") ? device.profile : "generic", position: device.position === null ? null : {...device.position}, config}];
    }));
    const interfaceModes = Object.fromEntries(Object.entries(state.interfaces).filter(([port, iface]) =>
      iface.deviceId.startsWith("sw") && iface.mode !== (port.endsWith("gi0/5") ? "trunk" : "access")).map(([port, iface]) => [port, iface.mode]));
    const scenario = {schemaVersion: SCENARIO_VERSION, ...metadata, devices, ...(Object.keys(interfaceModes).length ? {interfaceModes} : {}),
      connections: state.connections.map(link => ({a: link.a, b: link.b}))};
    importScenario(scenario);
    return scenario;
  }
  function importDynamicScenario(scenario) {
    keys(scenario, ["schemaVersion", "format", "devices", "connections", "nextIds"], ["name", "sourceId", "destinationId", "interfaceModes"], "Cenário");
    if (scenario.schemaVersion !== SCENARIO_VERSION || scenario.format !== "dynamic") throw new TypeError("schemaVersion desconhecida.");
    if (Object.hasOwn(scenario, "name") && (typeof scenario.name !== "string" || !scenario.name.trim() || scenario.name.length > 120)) throw new TypeError("Nome do cenário inválido.");
    keys(scenario.nextIds, ["pc", "switch", "router"], [], "Contadores");
    if (Object.values(scenario.nextIds).some(n => !Number.isSafeInteger(n) || n < 1)) throw new TypeError("Contadores inválidos.");
    if (!record(scenario.devices) || !Array.isArray(scenario.connections)) throw new TypeError("Equipamentos ou conexões inválidos.");
    let state = createEmpty();
    for (const [id, entry] of Object.entries(scenario.devices)) {
      keys(entry, ["type", "name", "position", "config"], ["profile"], `Equipamento ${id}`);
      const legacy = DEVICE_IDS.includes(id) && ((PC_IDS.includes(id) && entry.type === "pc") || (SWITCH_IDS.includes(id) && entry.type === "switch") || (ROUTER_IDS.includes(id) && entry.type === "router"));
      if (!Object.hasOwn(TYPES, entry.type) || (!legacy && !new RegExp(`^${PREFIX[entry.type]}-[1-9]\\d*$`).test(id)) ||
          typeof entry.name !== "string" || !entry.name.trim() || entry.name.length > 80) throw new TypeError(`Identidade inválida em ${id}.`);
      const number = legacy ? 1 : Number(id.slice(PREFIX[entry.type].length + 1));
      if (!legacy && (!Number.isSafeInteger(number) || number >= scenario.nextIds[entry.type])) throw new TypeError(`Contador incompatível em ${id}.`);
      const device = defaultDevice(entry.type, id, number);
      device.profile = Object.hasOwn(entry, "profile") ? entry.profile : "generic";
      profiles.get(entry.type, device.profile);
      const interfaces = {...state.interfaces};
      device.interfaces.forEach((interfaceId, index) => { interfaces[interfaceId] = {deviceId: id, name: entry.type === "switch" ? `Gi0/${index + 1}` : `Eth${index}`,
        ...(entry.type === "switch" ? {mode: index === 4 ? "trunk" : "access"} : entry.type === "router" ? {mode: "routed"} : {})}; });
      state = {...state, devices: {...state.devices, [id]: {...device, name: entry.name}}, interfaces};
      if (entry.position !== null) {
        keys(entry.position, ["x", "y"], [], `Posição de ${id}`);
        if (![entry.position.x, entry.position.y].every(n => Number.isFinite(n) && n >= .08 && n <= .92)) throw new TypeError(`Posição inválida em ${id}.`);
        state = position(state, id, entry.position.x, entry.position.y).state;
      }
      if (entry.type === "pc") address(entry.config, id, true);
      else if (entry.type === "switch") switchConfig(entry.config, id);
      else { keys(entry.config, ["eth0", "eth1"], ["portSettings", "staticRoutes", "nat"], `Configuração de ${id}`); address(entry.config.eth0, `${id} Eth0`); address(entry.config.eth1, `${id} Eth1`); if (entry.config.staticRoutes) validateStaticRoutes(entry.config.staticRoutes); if (entry.config.nat && !validNat(entry.config.nat)) throw new TypeError(`NAT inválido em ${id}.`); }
      if (entry.type === "switch") {
        keys(entry.config, ["vlans", "allowedVlans"], ["portSettings"], `Configuração de ${id}`);
        if (entry.config.portSettings) validatePortSettings(entry.config.portSettings, device.interfaces);
      } else if (entry.config.portSettings) validatePortSettings(entry.config.portSettings, device.interfaces);
      if (scenario.interfaceModes && scenario.interfaceModes[id]) {
        keys(scenario.interfaceModes[id], [], device.interfaces, "Modos de interface");
        for (const [port, mode] of Object.entries(scenario.interfaceModes[id])) {
          if (!device.interfaces.includes(port)) throw new TypeError("Interface fora do equipamento " + id);
          const changed = setInterfaceMode(state, port, mode);
          if (changed.error) throw new TypeError(changed.error);
          state = changed.state;
        }
      }
      state = configure(state, id, entry.config).state;
    }
    state.nextIds = {...scenario.nextIds};
    for (const cable of scenario.connections) {
      keys(cable, ["a", "b"], [], "Conexão");
      const change = connect(state, cable.a, cable.b);
      if (change.error) throw new TypeError("Conexão inválida: " + change.error);
      state = change.state;
    }
    const source = Object.hasOwn(scenario, "sourceId"), destination = Object.hasOwn(scenario, "destinationId");
    if (source !== destination || (source && (state.devices[scenario.sourceId]?.type !== "pc" || state.devices[scenario.destinationId]?.type !== "pc" ||
        !state.devices[scenario.sourceId].position || !state.devices[scenario.destinationId].position || scenario.sourceId === scenario.destinationId)))
      throw new TypeError("Par de PCs inválido para o cenário.");
    return {state, name: scenario.name ?? null, sourceId: source ? scenario.sourceId : null, destinationId: destination ? scenario.destinationId : null};
  }
  function exportDynamicScenario(state, metadata = {}) {
    keys(metadata, [], ["name", "sourceId", "destinationId"], "Metadados do cenário");
    if (!record(state) || !record(state.devices) || !Array.isArray(state.connections)) throw new TypeError("Estado da bancada inválido.");
    const devices = Object.fromEntries(Object.entries(state.devices).map(([id, device]) => [id, {type: device.type, name: device.name, profile: Object.hasOwn(device, "profile") ? device.profile : "generic",
      position: device.position ? {...device.position} : null, config: JSON.parse(JSON.stringify(device.config))}]));
    const interfaceModes = Object.fromEntries(Object.values(state.devices).filter(d => d.type === "switch").map(d => [d.id,
      Object.fromEntries(d.interfaces.filter(port => state.interfaces[port].mode !== (port.endsWith("gi0/5") ? "trunk" : "access")).map(port => [port,state.interfaces[port].mode]))]).filter(([,modes])=>Object.keys(modes).length));
    const scenario = {schemaVersion: SCENARIO_VERSION, format: "dynamic", ...metadata, devices, ...(Object.keys(interfaceModes).length ? {interfaceModes} : {}),
      connections: state.connections.map(link => ({a: link.a, b: link.b})), nextIds: {...state.nextIds}};
    importDynamicScenario(scenario);
    return scenario;
  }
  return {PC_IDS, SWITCH_IDS, ROUTER_IDS, DEVICE_IDS, INTERFACES, SCENARIO_VERSION,
    create, position, configure, setInterfaceMode, connect, disconnect, adapt, adaptForPing, eventTargets, connectionId,
    exportScenario, importScenario, createEmpty, addDevice, renameDevice, removeDevice, setProfile, interfaceName,
    setStaticRoute, removeStaticRoute, setNat, setHostServices};
});
