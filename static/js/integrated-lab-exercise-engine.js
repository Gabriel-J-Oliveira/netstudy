/* Exercise Engine v1: definição, geração e validação sem DOM nem persistência. */
(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports ? require("./integrated-lab-model.js") : root.NetStudyLabModel,
    typeof module === "object" && module.exports ? require("./integrated-lab-simulator.js") : root.NetStudyLabSimulator,
    typeof module === "object" && module.exports ? require("./integrated-lab-presets.js") : root.NetStudyLabPresets,
    typeof module === "object" && module.exports ? require("./integrated-lab-services.js") : root.NetStudyLabServices
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetStudyLabExerciseEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (model, simulator, presets, servicesEngine) {
  "use strict";
  const EXERCISE_ID = "ipv4-connectivity";
  const ROLES = Object.freeze({sourceId: "pc-1", distractorId: "pc-2", destinationId: "pc-3", extraId: "pc-4",
    sourceSwitchId: "switch-1", destinationSwitchId: "switch-2", routerId: "router-1"});
  const DEFINITIONS = Object.freeze({
    ipv4: Object.freeze({id: "ipv4", title: "IPv4", description: "Investigue decisões de entrega e endereçamento dos hosts.", difficulties: Object.freeze(["intermediate", "advanced"])}),
    "vlan-access": Object.freeze({id: "vlan-access", title: "VLAN Access", description: "Investigue a participação dos hosts nos domínios locais.", difficulties: Object.freeze(["intermediate", "advanced"])}),
    "trunk-8021q": Object.freeze({id: "trunk-8021q", title: "Trunk 802.1Q", description: "Investigue a comunicação entre hosts distribuídos em dois switches.", difficulties: Object.freeze(["intermediate", "advanced"])}),
    routing: Object.freeze({id: "routing", title: "Routing", description: "Investigue uma entrega que precisa atravessar duas redes.", difficulties: Object.freeze(["intermediate", "advanced"])}),
    "static-routing": Object.freeze({id: "static-routing", title: "Rotas estáticas", description: "Investigue o caminho de ida e volta entre dois roteadores.", difficulties: Object.freeze(["intermediate", "advanced"])}),
    "external-routing": Object.freeze({id: "external-routing", title: "Rede externa", description: "Investigue rota padrão, próximo salto e retorno por roteadores ISP lógicos.", difficulties: Object.freeze(["intermediate", "advanced"])}),
    "nat-pat": Object.freeze({id: "nat-pat", title: "NAT/PAT", description: "Investigue tradução de origem e retorno no acesso externo.", difficulties: Object.freeze(["intermediate", "advanced"])}),
    services: Object.freeze({id: "services", title: "DHCP, DNS e serviços", description: "Investigue falhas de configuração e aplicação com L2/L3 funcional.", difficulties: Object.freeze(["intermediate", "advanced"])}),
    mixed: Object.freeze({id: "mixed", title: "Diagnóstico misto", description: "Investigue o percurso completo sem uma categoria de causa indicada.", difficulties: Object.freeze(["intermediate", "advanced"])}),
    [EXERCISE_ID]: Object.freeze({
      id: EXERCISE_ID, title: "Diagnóstico de conectividade IPv4",
      description: "Investigue uma comunicação interrompida entre duas redes e corrija a bancada.",
      objective: "Faça PC-1 alcançar PC-3, preservando as redes e as VLANs separadas por R-1.",
      difficulties: Object.freeze(["intermediate", "advanced"])
    })
  });
  const FAULTS = Object.freeze(["gateway", "mask", "access-vlan", "trunk", "router-interface"]);
  const ADVANCED_PAIRS = Object.freeze([
    ["mask", "trunk"], ["gateway", "router-interface"],
    ["access-vlan", "router-interface"], ["gateway", "trunk"], ["router-interface", "trunk"]
  ]);
  const CAUSES = Object.freeze({
    gateway: "o próximo salto configurado em PC-1 não correspondia a uma interface alcançável de R-1",
    mask: "a máscara de PC-1 o levava a tratar o destino remoto como local",
    "access-vlan": "uma porta Access não colocava o destino no contexto VLAN esperado",
    trunk: "a VLAN necessária não era admitida em uma ponta do trunk",
    "router-interface": "a configuração IPv4 de saída de R-1 não fornecia uma rota conectada para a rede de PC-3"
  });

  function hash(text) {
    let value = 2166136261;
    for (const char of text) { value ^= char.charCodeAt(0); value = Math.imul(value, 16777619); }
    return value >>> 0;
  }
  function random(seed) {
    let value = hash(seed);
    return () => {
      value += 0x6D2B79F5;
      let mixed = value;
      mixed = Math.imul(mixed ^ mixed >>> 15, mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
      return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
    };
  }
  function applied(change) {
    if (change.error) throw new Error(`Definição de exercício inválida: ${change.error}`);
    return change.state;
  }
  function test(state) {
    const adapted = model.adapt(state, "pc-1", "pc-3");
    return adapted.error ? {status: "invalid", message: adapted.error, events: []} : simulator.simulate(adapted.input);
  }
  function baseState(rng, difficulty) {
    let state = model.createEmpty();
    for (const type of ["pc", "pc", "pc", "pc", "switch", "switch", "router"]) state = applied(model.addDevice(state, type));
    const positions = [
      ["pc-1", .14, .2], ["switch-1", .39, .35], ["switch-2", .62, .55],
      ["router-1", .83, .28], ["pc-3", .83, .76], ["pc-2", .15, .65]
    ];
    if (difficulty === "advanced") positions.push(["pc-4", .39, .8]);
    positions.forEach(([id, x, y]) => { state = applied(model.position(state, id, x, y)); });
    const sourceHost = 10 + Math.floor(rng() * 5);
    const destinationHost = 30 + Math.floor(rng() * 5);
    state = applied(model.configure(state, "pc-1", {ip: `192.168.10.${sourceHost}`, gateway: "192.168.10.1"}));
    state = applied(model.configure(state, "pc-2", {ip: "192.168.20.20", gateway: "192.168.20.1"}));
    state = applied(model.configure(state, "pc-3", {ip: `192.168.20.${destinationHost}`, gateway: "192.168.20.1"}));
    state = applied(model.configure(state, "pc-4", {ip: "192.168.10.40", gateway: "192.168.10.1"}));
    state = applied(model.configure(state, "switch-1", {vlans: {"switch-1:gi0/2": 20}}));
    state = applied(model.configure(state, "switch-2", {vlans: {"switch-2:gi0/2": 20, "switch-2:gi0/3": 20}}));
    const cables = [
      ["pc-1:eth0", "switch-1:gi0/1"], ["pc-2:eth0", "switch-1:gi0/2"],
      ["switch-1:gi0/5", "switch-2:gi0/5"], ["router-1:eth0", "switch-2:gi0/1"],
      ["router-1:eth1", "switch-2:gi0/2"], ["pc-3:eth0", "switch-2:gi0/3"]
    ];
    if (difficulty === "advanced") cables.push(["pc-4:eth0", "switch-1:gi0/3"]);
    cables.forEach(([a, b]) => { state = applied(model.connect(state, a, b)); });
    return state;
  }
  function inject(state, kind, rng, chosen = null) {
    if (kind === "gateway") {
      const variant = chosen?.variant || (rng() < .5 ? "offlink" : "unanswered");
      return {state: applied(model.configure(state, "pc-1", {gateway: variant === "offlink" ? "192.168.30.1" : "192.168.10.254"})), fault: {kind, variant}};
    }
    if (kind === "mask") return {state: applied(model.configure(state, "pc-1", {mask: "255.255.0.0"})), fault: {kind}};
    if (kind === "access-vlan") return {state: applied(model.configure(state, "switch-2", {vlans: {"switch-2:gi0/3": 10}})), fault: {kind}};
    if (kind === "trunk") {
      const side = chosen?.side || (rng() < .5 ? "switch-1" : "switch-2");
      return {state: applied(model.configure(state, side, {allowedVlans: [20]})), fault: {kind, side}};
    }
    const variant = chosen?.variant || (rng() < .5 ? "ip" : "mask");
    return {state: applied(model.configure(state, "router-1", {eth1: variant === "ip" ? {ip: "192.168.30.1"} : {mask: "255.255.255.248"}})), fault: {kind, variant}};
  }
  function legacyGenerate(exerciseId, seed, options = {}) {
    const definition = DEFINITIONS[exerciseId];
    const difficulty = options.difficulty || "intermediate";
    if (!definition || !definition.difficulties.includes(difficulty)) throw new TypeError("Exercício ou dificuldade desconhecidos.");
    if ((typeof seed !== "string" && typeof seed !== "number") || !String(seed).trim() || String(seed).length > 40)
      throw new TypeError("Seed inválida.");
    const normalizedSeed = String(seed);
    const rng = random(`${exerciseId}:${difficulty}:${normalizedSeed}`);
    const base = baseState(rng, difficulty);
    if (test(base).status !== "success") throw new Error("A rede base do exercício não funciona.");
    const kinds = difficulty === "advanced"
      ? ADVANCED_PAIRS[Math.floor(rng() * ADVANCED_PAIRS.length)]
      : [FAULTS[Math.floor(rng() * FAULTS.length)]];
    let state = base;
    const faultMetadata = [];
    for (const kind of kinds) {
      const single = inject(base, kind, rng);
      if (test(single.state).status === "success") throw new Error(`A falha ${kind} não interrompe o objetivo.`);
      const result = inject(state, kind, rng, single.fault);
      state = result.state;
      faultMetadata.push(single.fault);
    }
    if (test(state).status === "success") throw new Error("A instância gerada não apresenta falha.");
    const scenario = model.exportScenario(state, {
      name: `Diagnóstico IPv4 · ${difficulty} · ${normalizedSeed}`,
      sourceId: "pc-1", destinationId: "pc-3"
    });
    return {
      exerciseId, seed: normalizedSeed, difficulty, scenario, faultMetadata, roles: {...ROLES},
      objective: {sourceId: "pc-1", destinationId: "pc-3", text: definition.objective},
      invariants: {sourceNetwork: "192.168.10.0/24", destinationNetwork: "192.168.20.0/24",
        sourceVlan: 10, destinationVlan: 20, routerId: "router-1", requiredDevices: difficulty === "advanced"
          ? ["pc-1", "pc-2", "pc-3", "pc-4", "switch-1", "switch-2", "router-1"] : ["pc-1", "pc-2", "pc-3", "switch-1", "switch-2", "router-1"]},
      title: definition.title,
      prompt: difficulty === "advanced"
        ? "PC-1 não alcança PC-3. Há dois problemas na montagem. Investigue o percurso e preserve a arquitetura entre as redes."
        : "PC-1 não alcança PC-3. Há um problema na montagem. Use o teste da bancada para investigar antes de alterar a configuração."
    };
  }
  function connection(state, interfaceId) {
    const link = state.connections.find(item => item.a === interfaceId || item.b === interfaceId);
    return link ? (link.a === interfaceId ? link.b : link.a) : null;
  }
  function network(ip, firstThree) {
    const bytes = simulator.ipv4(ip);
    return Boolean(bytes && bytes.slice(0, 3).join(".") === firstThree);
  }
  function invariantIssue(instance, state, result) {
    const devices = state.devices;
    const roles = instance.roles;
    if (instance.invariants.requiredDevices.some(id => !devices[id]?.position))
      return "Os equipamentos previstos para a topologia precisam permanecer instalados.";
    const a = devices[roles.sourceId].config, c = devices[roles.destinationId].config, r = devices[roles.routerId].config;
    if (!network(a.ip, "192.168.10") || a.mask !== "255.255.255.0" ||
        !network(c.ip, "192.168.20") || c.mask !== "255.255.255.0")
      return "PC-1 e PC-3 precisam continuar em suas redes /24 distintas.";
    if (!network(r.eth0.ip, "192.168.10") || r.eth0.mask !== "255.255.255.0" ||
        !network(r.eth1.ip, "192.168.20") || r.eth1.mask !== "255.255.255.0" ||
        a.gateway !== r.eth0.ip || c.gateway !== r.eth1.ip)
      return "R-1 precisa manter uma interface e um gateway alcançável em cada rede prevista.";
    const access = (iface, switchId, vlan) => {
      const peer = connection(state, iface);
      return Boolean(peer && state.interfaces[peer]?.deviceId === switchId &&
        devices[switchId].config.vlans[peer] === vlan);
    };
    if (!access(`${roles.sourceId}:eth0`, roles.sourceSwitchId, 10) || !access(`${roles.routerId}:eth0`, roles.destinationSwitchId, 10) ||
        !access(`${roles.routerId}:eth1`, roles.destinationSwitchId, 20) || !access(`${roles.destinationId}:eth0`, roles.destinationSwitchId, 20))
      return "A entrega voltou, mas as portas Access não preservam os dois contextos VLAN previstos.";
    if (!connection(state, `${roles.sourceSwitchId}:gi0/5`) || connection(state, `${roles.sourceSwitchId}:gi0/5`) !== `${roles.destinationSwitchId}:gi0/5` ||
        [roles.sourceSwitchId, roles.destinationSwitchId].some(id => !devices[id].config.allowedVlans.includes(10)))
      return "O enlace entre os switches precisa continuar transportando a VLAN de origem.";
    if (instance.difficulty === "advanced" &&
        (!access(`${roles.distractorId}:eth0`, roles.sourceSwitchId, 20) || !access(`${roles.extraId}:eth0`, roles.sourceSwitchId, 10)))
      return "A topologia avançada deve manter os hosts adicionais em suas VLANs.";
    if (!result.events.some(event => event.id === "router-receive") ||
        !result.events.some(event => event.id === "frame-out"))
      return "A comunicação precisa atravessar R-1, sem unir as duas redes em um único domínio.";
    return null;
  }
  const FEEDBACK = Object.freeze({
    "local-mask": "PC-1 está tentando resolver diretamente o MAC de PC-3. Pela configuração atual, ele considera o destino local. Revise a relação entre IP, máscara e rede de destino.",
    "gateway-missing": "PC-1 reconhece o destino remoto, mas não tem próximo salto configurado para a primeira entrega.",
    "gateway-offlink": "O próximo salto indicado por PC-1 não pertence à rede que sua interface considera local. Esse endereço não pode ser resolvido diretamente nesta LAN.",
    "gateway-arp": "O ARP pelo próximo salto não recebeu resposta. A evidência ainda não distingue endereço, cabo ou participação na VLAN; inspecione o alcance local.",
    "trunk-blocked": "A tentativa de ARP parou no trunk: a VLAN do frame não está admitida em uma das pontas. O enlace físico pode continuar ativo.",
    "route-missing": "R-1 recebeu o primeiro frame, mas não encontrou uma rede diretamente conectada para encaminhar ao destino. Inspecione a rede da interface de saída.",
    "vlan-destination": "R-1 chegou à rede de saída, mas seu ARP não alcançou PC-3 no mesmo contexto VLAN. Observe as portas Access dessa entrega.",
    "destination-arp": "R-1 escolheu a rede de saída, mas o ARP por PC-3 não recebeu resposta. Cabo, porta ou VLAN ainda precisam ser investigados.",
    "source-cable": "PC-1 não conseguiu iniciar a entrega pela sua interface. Verifique se existe um caminho físico até o switch.",
    invalid: "A configuração atual não pôde ser simulada. Revise os endereços, máscaras e conexões informados.",
    other: "A entrega continua interrompida. Examine o último evento da bancada e a primeira etapa sem resposta antes de alterar outra configuração."
  });
  function category(result, state, roles) {
    if (result.status === "invalid") return "invalid";
    const last = result.events.at(-1);
    if (last?.id === "arp-unanswered" && result.events[0]?.id === "local") return "local-mask";
    if (last?.id === "gateway-missing") return "gateway-missing";
    if (last?.id === "gateway-offlink") return "gateway-offlink";
    if (result.events.some(event => event.id === "trunk-blocked")) return "trunk-blocked";
    if (last?.id === "gateway-arp-failed") return "gateway-arp";
    if (last?.id === "route-missing") return "route-missing";
    if (last?.id === "destination-arp-failed") {
      const rPort = connection(state, `${roles.routerId}:eth1`), cPort = connection(state, `${roles.destinationId}:eth0`);
      if (rPort && cPort && state.devices[roles.destinationSwitchId].config.vlans[rPort] !== state.devices[roles.destinationSwitchId].config.vlans[cPort]) return "vlan-destination";
      return "destination-arp";
    }
    if (last?.id === "source-unplugged") return "source-cable";
    return "other";
  }
  function legacyValidate(instance, currentState) {
    if (!instance || !DEFINITIONS[instance.exerciseId] || !instance.invariants || !instance.objective || !instance.roles)
      throw new TypeError("Instância de exercício inválida.");
    const adapted = model.adapt(currentState, instance.objective.sourceId, instance.objective.destinationId);
    const result = adapted.error ? {status: "invalid", message: adapted.error, events: []} : simulator.simulate(adapted.input);
    const named = message => message.replaceAll("PC-1", currentState.devices[instance.roles.sourceId]?.name || "PC-1")
      .replaceAll("PC-3", currentState.devices[instance.roles.destinationId]?.name || "PC-3")
      .replaceAll("R-1", currentState.devices[instance.roles.routerId]?.name || "R-1");
    if (result.status !== "success") {
      const code = category(result, currentState, instance.roles);
      return {complete: false, category: code, feedback: named(FEEDBACK[code]), result};
    }
    const issue = invariantIssue(instance, currentState, result);
    if (issue) return {complete: false, category: "invariant", feedback: named(`A comunicação foi restaurada, mas a arquitetura prevista foi alterada. ${issue}`), result};
    const causes = instance.faultMetadata.map(item => CAUSES[item.kind]);
    return {complete: true, category: "success", feedback: named(`Comunicação restaurada sem romper a separação das redes. O cenário inicial falhava porque ${causes.join(" e porque ")}.`), result};
  }
  // As instâncias públicas não transportam respostas ou descrições das falhas.
  // O registro privado também impede que uma importação JSON forneça invariantes falsas.
  const instances = new WeakMap();
  const attempts = new WeakMap();
  const clone = value => JSON.parse(JSON.stringify(value));
  const FAMILY_IDS = Object.freeze(["ipv4", "vlan-access", "trunk-8021q", "routing", "static-routing", "external-routing", "nat-pat", "services", "mixed"]);
  const OPERATIONAL_VARIANTS = Object.freeze(["cisco-windows", "cisco-linux", "dell-windows", "mikrotik-hosts", "mixed"]);
  function profileEnvironment(state, variant) {
    let next = state;
    for (const device of Object.values(state.devices)) {
      const profile = device.type === "pc" ? variant === "cisco-linux" ? "linux" : ["mikrotik-hosts", "mixed"].includes(variant) && ["pc-2", "pc-3"].includes(device.id) ? "linux" : "windows"
        : device.type === "router" ? ["mikrotik-hosts", "mixed"].includes(variant) ? "mikrotik-routeros" : "cisco-ios"
          : variant === "dell-windows" ? "dell-os10" : variant === "mixed" && device.id === ROLES.destinationSwitchId ? "dell-os10" : "cisco-ios";
      next = applied(model.setProfile(next, device.id, profile));
    }
    return next;
  }
  function operationalVariant(options, rng, routed) {
    if (options.mode !== "operational") return null;
    const available = routed ? OPERATIONAL_VARIANTS : OPERATIONAL_VARIANTS.filter(id => id !== "mikrotik-hosts");
    if (options.environment && !available.includes(options.environment)) throw new TypeError("Ambiente operacional incompatível com esta topologia.");
    return options.environment || available[Math.floor(rng() * available.length)];
  }
  function checkMode(options) {
    if (options.mode && !["bench", "operational"].includes(options.mode)) throw new TypeError("Modo de exercício desconhecido.");
    if (options.environment && (options.mode !== "operational" || !OPERATIONAL_VARIANTS.includes(options.environment))) throw new TypeError("Ambiente operacional desconhecido.");
  }
  const POOLS = Object.freeze({
    ipv4: ["host-ip", "host-mask", "gateway", "gateway-missing", "host-network"],
    "vlan-access": ["access-source", "access-destination"],
    "trunk-8021q": ["trunk-allowed", "trunk-disconnected", "trunk-source-allowed", "trunk-destination-allowed"],
    routing: ["gateway", "router-input-ip", "router-output-ip", "router-output-mask", "router-input-disconnected", "router-output-disconnected"]
  });
  const PAIRS = Object.freeze({
    ipv4: [["gateway", "host-network"], ["gateway-missing", "host-network"]],
    "vlan-access": [["access-source", "access-destination"]],
    "trunk-8021q": [["trunk-source-allowed", "trunk-destination-allowed"]],
    routing: [["gateway", "router-output-ip"], ["router-input-ip", "router-output-mask"], ["gateway", "router-output-disconnected"]],
    mixed: [["host-mask", "trunk-allowed"], ["gateway-missing", "access-destination"],
      ["access-source", "router-output-ip"], ["trunk-disconnected", "router-output-mask"], ["gateway", "router-output-disconnected"]]
  });
  function simulateState(state) {
    const adapted = model.adapt(state, ROLES.sourceId, ROLES.destinationId);
    return adapted.error ? {status: "invalid", message: adapted.error, events: []} : simulator.simulate(adapted.input);
  }
  function detach(state, iface) {
    const link = state.connections.find(item => item.a === iface || item.b === iface);
    return link ? applied(model.disconnect(state, link.id)) : state;
  }
  function familyBase(rng, routed, across, dualTransport = false) {
    let state = baseState(rng, "advanced");
    const first = 10 + Math.floor(rng() * 80), second = first + 90;
    const subnet = n => `192.168.${n}`;
    for (const [id, net] of [["pc-1", first], ["pc-4", first], ["pc-2", second], ["pc-3", routed ? second : first]]) {
      const suffix = state.devices[id].config.ip.split(".").at(-1);
      state = applied(model.configure(state, id, {ip: `${subnet(net)}.${suffix}`, gateway: routed ? `${subnet(net)}.1` : ""}));
    }
    if (routed) {
      state = applied(model.configure(state, "router-1", {eth0: {ip: `${subnet(first)}.1`}, eth1: {ip: `${subnet(second)}.1`}}));
      if (dualTransport) {
        for (const iface of ["pc-1:eth0", "pc-4:eth0", "router-1:eth0", "router-1:eth1"]) state = detach(state, iface);
        state = applied(model.configure(state, "switch-1", {vlans: {"switch-1:gi0/3": 10, "switch-1:gi0/4": 20}}));
        for (const [a, b] of [["pc-1:eth0", "switch-2:gi0/1"], ["pc-4:eth0", "switch-2:gi0/4"],
          ["router-1:eth0", "switch-1:gi0/3"], ["router-1:eth1", "switch-1:gi0/4"]]) state = applied(model.connect(state, a, b));
      }
    }
    else {
      state = applied(model.removeDevice(state, "router-1"));
      state = applied(model.configure(state, "switch-2", {vlans: {"switch-2:gi0/3": 10}}));
      if (!across) {
        state = detach(state, "pc-3:eth0");
        state = applied(model.connect(state, "pc-3:eth0", "switch-1:gi0/4"));
      }
    }
    // Posições variam sem alterar IDs, papéis nem a conectividade calculada.
    for (const id of Object.keys(state.devices)) {
      const p = state.devices[id].position;
      state = applied(model.position(state, id, p.x + (rng() - .5) * .04, p.y + (rng() - .5) * .04));
    }
    return state;
  }
  function familyFor(kind) {
    return Object.keys(POOLS).find(id => POOLS[id].includes(kind));
  }
  function mutation(base, kind, rng) {
    const source = base.devices[ROLES.sourceId].config;
    const subnet = ip => ip.split(".").slice(0, 3).join(".");
    let deviceId = ROLES.sourceId, values, iface;
    switch (kind) {
      case "host-ip": values = {ip: `172.16.${Math.floor(rng() * 100)}.15`}; break;
      case "host-mask": values = {mask: "255.255.0.0"}; break;
      case "gateway": values = {gateway: rng() < .5 ? "172.20.1.1" : `${subnet(source.ip)}.254`}; break;
      case "gateway-missing": values = {gateway: ""}; break;
      case "host-network": deviceId = ROLES.destinationId; values = {ip: `172.21.${Math.floor(rng() * 100)}.35`}; break;
      case "access-source":
      case "access-destination": {
        iface = connection(base, `${kind === "access-source" ? ROLES.sourceId : ROLES.destinationId}:eth0`);
        deviceId = base.interfaces[iface].deviceId;
        values = {vlans: {[iface]: base.devices[deviceId].config.vlans[iface] === 10 ? 20 : 10}};
        break;
      }
      case "trunk-allowed": deviceId = rng() < .5 ? ROLES.sourceSwitchId : ROLES.destinationSwitchId; values = {allowedVlans: [20]}; break;
      case "trunk-source-allowed": deviceId = ROLES.sourceSwitchId; values = {allowedVlans: [20]}; break;
      case "trunk-destination-allowed": deviceId = ROLES.destinationSwitchId; values = {allowedVlans: [10]}; break;
      case "trunk-disconnected": iface = `${ROLES.sourceSwitchId}:gi0/5`; break;
      case "router-input-disconnected": iface = `${ROLES.routerId}:eth0`; break;
      case "router-output-disconnected": iface = `${ROLES.routerId}:eth1`; break;
      case "router-input-ip": deviceId = ROLES.routerId; values = {eth0: {ip: `${subnet(source.ip)}.253`}}; break;
      case "router-output-ip": deviceId = ROLES.routerId; values = {eth1: {ip: "172.22.1.1"}}; break;
      case "router-output-mask": deviceId = ROLES.routerId; values = {eth1: {mask: "255.255.255.248"}}; break;
      default: throw new Error("Falha desconhecida.");
    }
    return {kind, family: familyFor(kind), deviceId, values, iface,
      // Referências usadas somente nos testes Node e no registro privado.
      original: values ? clone(base.devices[deviceId].config) : null,
      link: !values ? clone(base.connections.find(item => item.a === iface || item.b === iface)) : null};
  }
  function applyMutation(state, fault) {
    return fault.values ? applied(model.configure(state, fault.deviceId, fault.values)) : detach(state, fault.iface);
  }
  function repairMutation(state, fault) {
    if (!fault.values) return applied(model.connect(state, fault.link.a, fault.link.b));
    // Só restaura os campos afetados: corrigir uma falha não corrige outra.
    const values = {};
    for (const key of Object.keys(fault.values)) {
      if (["eth0", "eth1", "vlans"].includes(key)) values[key] = Object.fromEntries(Object.keys(fault.values[key]).map(k => [k, fault.original[key][k]]));
      else values[key] = clone(fault.original[key]);
    }
    return applied(model.configure(state, fault.deviceId, values));
  }
  function routeBase(rng) {
    let state=model.createEmpty();
    for(const type of ['pc','pc','switch','switch','router','router'])state=applied(model.addDevice(state,type));
    const transit=40+Math.floor(rng()*80), hostA=10+Math.floor(rng()*80), hostB=20+Math.floor(rng()*80);
    for(const [id,x,y] of [['pc-1',.12,.3],['switch-1',.3,.3],['router-1',.45,.3],['router-2',.65,.5],['switch-2',.8,.5],['pc-2',.9,.7]])state=applied(model.position(state,id,x,y));
    state=applied(model.configure(state,'pc-1',{ip:`192.168.10.${hostA}`,gateway:'192.168.10.1'}));
    state=applied(model.configure(state,'pc-2',{ip:`192.168.20.${hostB}`,gateway:'192.168.20.1'}));
    state=applied(model.configure(state,'router-1',{eth0:{ip:'192.168.10.1'},eth1:{ip:`10.${transit}.0.1`}}));
    state=applied(model.configure(state,'router-2',{eth0:{ip:`10.${transit}.0.2`},eth1:{ip:'192.168.20.1'}}));
    for(const [a,b] of [['pc-1:eth0','switch-1:gi0/1'],['router-1:eth0','switch-1:gi0/2'],['router-1:eth1','router-2:eth0'],['router-2:eth1','switch-2:gi0/2'],['pc-2:eth0','switch-2:gi0/1']])state=applied(model.connect(state,a,b));
    state=applied(model.setStaticRoute(state,'router-1',{destination:'192.168.20.0',mask:'255.255.255.0',nextHop:`10.${transit}.0.2`}));
    state=applied(model.setStaticRoute(state,'router-2',{destination:'192.168.10.0',mask:'255.255.255.0',nextHop:`10.${transit}.0.1`}));
    return state;
  }
  function routeFault(state,side,kind) {
    const id=side==='forward'?'router-1':'router-2',route=state.devices[id].config.staticRoutes[0];
    if(kind==='missing')return applied(model.removeStaticRoute(state,id,route.destination,route.mask));
    return applied(model.setStaticRoute(state,id,{...route,nextHop:route.nextHop.replace(/\.\d+$/,'.254')}));
  }
  function routeResult(state) {
    const adapted=model.adapt(state,'pc-1','pc-2');
    return adapted.error?{status:'invalid',events:[],message:adapted.error}:simulator.simulate(adapted.input);
  }
  function routeExercise(seed,difficulty,options) {
    for(let attempt=0;attempt<64;attempt++) {
      const rng=random(`static-routing:${difficulty}:${seed}:${attempt}`),rawBase=routeBase(rng);
      const variant=operationalVariant(options,random(`static-routing:${difficulty}:${seed}:${attempt}:profiles`),true);
      const base=variant?profileEnvironment(rawBase,variant):rawBase;
      if(routeResult(base).status!=='success')continue;
      const side=difficulty==='advanced'||rng()<.5?'forward':'return';
      const kind=rng()<.5?'missing':'wrong-next-hop';
      const faults=difficulty==='advanced'?[{side:'forward',kind},{side:'return',kind:rng()<.5?'missing':'wrong-next-hop'}]:[{side,kind}];
      const broken=faults.reduce((state,fault)=>routeFault(state,fault.side,fault.kind),base);
      if(routeResult(broken).status!=='failure')continue;
      const instance={exerciseId:'static-routing',seed:String(seed),difficulty,title:DEFINITIONS['static-routing'].title,
        prompt:difficulty==='advanced'?'Dois segmentos da comunicação entre PC-1 e PC-2 deixaram de funcionar após uma alteração. Investigue ida e volta e preserve o trânsito entre os roteadores.':'PC-1 deixou de obter resposta de PC-2. Investigue o caminho entre as redes, inclusive a volta, sem alterar a topologia.',
        objective:{sourceId:'pc-1',destinationId:'pc-2',text:'Restaure a comunicação entre PC-1 e PC-2 pelos dois roteadores.'},
        scenario:model.exportScenario(broken,{name:`Rotas estáticas · ${difficulty} · ${seed}`,sourceId:'pc-1',destinationId:'pc-2'}),
        ...(variant?{mode:'operational',environment:variant}:{})};
      instances.set(instance,{routeBase:base,faults});attempts.set(instance,[]);return instance;
    }
    throw new Error('Não foi possível gerar um exercício de rotas coerente.');
  }
  function externalExercise(seed,difficulty,options) {
    const preset=presets.PRESETS.find(item=>item.id==='external-network');
    if(!preset)throw new Error('Preset de rede externa indisponível.');
    for(let attempt=0;attempt<64;attempt++) {
      const rng=random(`external-routing:${difficulty}:${seed}:${attempt}`);
      let base=model.importScenario(preset.scenario).state;
      base=applied(model.configure(base,'pc-1',{ip:`192.168.10.${10+Math.floor(rng()*60)}`}));
      base=applied(model.configure(base,'pc-2',{ip:`203.0.113.${20+Math.floor(rng()*60)}`}));
      const variant=operationalVariant(options,random(`external-routing:${difficulty}:${seed}:${attempt}:profiles`),true);
      if(variant)base=profileEnvironment(base,variant);
      if(routeResult(base).status!=='success')continue;
      const forward=rng()<.5?'default-missing':'next-hop-wrong';
      const returnRouter=rng()<.5?'router-2':'router-3';
      const faults=difficulty==='advanced'?[forward,`return-missing:${returnRouter}`]:[[forward,'return-missing:router-2','return-missing:router-3'][Math.floor(rng()*3)]];
      let broken=base;
      for(const fault of faults) {
        if(fault==='default-missing')broken=applied(model.removeStaticRoute(broken,'router-1','0.0.0.0','0.0.0.0'));
        else if(fault==='next-hop-wrong')broken=applied(model.setStaticRoute(broken,'router-1',{destination:'0.0.0.0',mask:'0.0.0.0',nextHop:'10.0.0.254'}));
        else {
          const id=fault.split(':')[1];
          broken=applied(model.removeStaticRoute(broken,id,'192.168.10.0','255.255.255.0'));
        }
      }
      if(routeResult(broken).status!=='failure')continue;
      const instance={exerciseId:'external-routing',seed:String(seed),difficulty,title:DEFINITIONS['external-routing'].title,
        prompt:difficulty==='advanced'?'A comunicação com o servidor externo parou após alterações no encaminhamento. Há duas interrupções independentes no percurso. Investigue a ida e a volta sem modificar a topologia.':'PC-A não consegue confirmar uma resposta do servidor externo. Use as evidências de rota e das sondas para localizar a interrupção.',
        objective:{sourceId:'pc-1',destinationId:'pc-2',text:'Restaure o caminho até o servidor externo e a resposta de volta, preservando a rede local e os enlaces ISP lógicos.'},
        scenario:model.exportScenario(broken,{name:`Rede externa · ${difficulty} · ${seed}`,sourceId:'pc-1',destinationId:'pc-2'}),
        ...(variant?{mode:'operational',environment:variant}:{})};
      instances.set(instance,{externalBase:base,faults});attempts.set(instance,[]);return instance;
    }
    throw new Error('Não foi possível gerar um exercício de rede externa coerente.');
  }
  function natExercise(seed,difficulty,options) {
    const preset=presets.PRESETS.find(item=>item.id==='external-nat-pat');
    if(!preset)throw new Error('Preset NAT/PAT indisponível.');
    const kinds=['nat-missing','inside-outside','source-network','return-invalid'];
    for(let attempt=0;attempt<64;attempt++) {
      const rng=random(`nat-pat:${difficulty}:${seed}:${attempt}`);
      let base=model.importScenario(preset.scenario).state;
      base=applied(model.configure(base,'pc-1',{ip:`192.168.10.${10+Math.floor(rng()*60)}`}));
      base=applied(model.configure(base,'pc-2',{ip:`203.0.113.${20+Math.floor(rng()*60)}`}));
      const variant=operationalVariant(options,random(`nat-pat:${difficulty}:${seed}:${attempt}:profiles`),true);
      if(variant)base=profileEnvironment(base,variant);
      if(routeResult(base).status!=='success')continue;
      const first=kinds[Math.floor(rng()*kinds.length)];
      const faults=difficulty==='advanced'?[first,first==='return-invalid'?kinds[Math.floor(rng()*3)]:'return-invalid']:[first];
      let broken=base;
      for(const kind of faults) {
        if(kind==='nat-missing')broken=applied(model.setNat(broken,'router-1',{enabled:false}));
        else if(kind==='inside-outside')broken=applied(model.setNat(broken,'router-1',{inside:'eth1',outside:'eth0'}));
        else if(kind==='source-network')broken=applied(model.setNat(broken,'router-1',{sourceNetwork:'192.168.30.0'}));
        else broken=applied(model.removeStaticRoute(broken,'router-3','10.0.0.0','255.255.255.0'));
      }
      if(routeResult(broken).status!=='failure')continue;
      const instance={exerciseId:'nat-pat',seed:String(seed),difficulty,title:DEFINITIONS['nat-pat'].title,
        prompt:difficulty==='advanced'?'O acesso externo deixou de confirmar resposta após duas mudanças na borda e no retorno. Investigue as evidências sem alterar os endereços dos hosts.':'PC-A possui rota para o servidor externo, mas o teste não confirma ida e volta. Investigue tradução e retorno sem modificar os hosts.',
        objective:{sourceId:'pc-1',destinationId:'pc-2',text:'Restaure a resposta do servidor externo preservando LAN, trânsito e separação entre roteamento e PAT.'},
        scenario:model.exportScenario(broken,{name:`NAT/PAT · ${difficulty} · ${seed}`,sourceId:'pc-1',destinationId:'pc-2'}),
        ...(variant?{mode:'operational',environment:variant}:{})};
      instances.set(instance,{natBase:base,faults});attempts.set(instance,[]);return instance;
    }
    throw new Error('Não foi possível gerar um exercício NAT/PAT coerente.');
  }
  function serviceFault(state,kind) {
    if(kind==='dhcp-off')return applied(model.setHostServices(state,'pc-b',{dhcpServer:{...state.devices['pc-b'].config.dhcpServer,enabled:false}}));
    if(kind==='dhcp-gateway')return applied(model.setHostServices(state,'pc-b',{dhcpServer:{...state.devices['pc-b'].config.dhcpServer,gateway:'192.168.10.254'}}));
    if(kind==='dhcp-dns')return applied(model.setHostServices(state,'pc-b',{dhcpServer:{...state.devices['pc-b'].config.dhcpServer,dns:'192.168.10.99'}}));
    if(kind==='client-dns')return applied(model.setHostServices(state,'pc-a',{dns:'192.168.10.99'}));
    if(kind==='dns-record')return applied(model.setHostServices(state,'pc-b',{dnsServer:{...state.devices['pc-b'].config.dnsServer,records:[]}}));
    if(kind==='service-port')return applied(model.setHostServices(state,'pc-c',{services:state.devices['pc-c'].config.services.map(item=>item.port===80?{...item,port:8080}:item)}));
    return applied(model.setHostServices(state,'pc-c',{services:state.devices['pc-c'].config.services.map(item=>item.port===80?{...item,enabled:false}:item)}));
  }
  function serviceChecks(state,base) {
    const dhcp=servicesEngine.renew(state,'pc-a');
    if(dhcp.result.status!=='success')return {category:'dhcp-unavailable',result:dhcp.result};
    const offer=dhcp.result.lease,expected=base.devices['pc-b'].config.dhcpServer;
    if(offer.gateway!==expected.gateway||offer.dns!==expected.dns||offer.mask!==expected.mask)
      return {category:'dhcp-options',result:dhcp.result};
    const dns=servicesEngine.resolve(state,'pc-a','app.lab');
    if(dns.status!=='success')return {category:dns.events.at(-1)?.id==='dns-no-record'?'dns-record':'dns-config',result:dns};
    const connection=servicesEngine.connect(state,'pc-a','app.lab','tcp',80);
    if(connection.status!=='success')return {category:connection.events.at(-1)?.id==='service-unavailable'?'service-unavailable':'service-path',result:connection};
    return {category:'success',result:connection};
  }
  function servicesExercise(seed,difficulty,options) {
    const preset=presets.PRESETS.find(item=>item.id==='lan-services');if(!preset)throw new Error('Preset de serviços indisponível.');
    const firstKinds=['dhcp-off','dhcp-gateway','dhcp-dns','client-dns','dns-record','service-port','service-down'];
    for(let attempt=0;attempt<64;attempt++){
      const rng=random(`services:${difficulty}:${seed}:${attempt}`);
      let base=model.importScenario(preset.scenario).state;
      const target=`192.168.20.${30+Math.floor(rng()*60)}`,start=100+Math.floor(rng()*20);
      base=applied(model.configure(base,'pc-c',{ip:target}));
      base=applied(model.setHostServices(base,'pc-b',{dnsServer:{enabled:true,records:[{name:'app.lab',address:target}]},
        dhcpServer:{...base.devices['pc-b'].config.dhcpServer,poolStart:`192.168.10.${start}`,poolEnd:`192.168.10.${start+4}`}}));
      const variant=operationalVariant(options,random(`services:${difficulty}:${seed}:${attempt}:profiles`),true);
      if(variant)base=profileEnvironment(base,variant);
      if(simulator.simulate(model.adapt(base,'pc-a','pc-c').input).status!=='success'||serviceChecks(base,base).category!=='success')continue;
      const first=difficulty==='advanced'?firstKinds[Math.floor(rng()*5)]:firstKinds[Math.floor(rng()*firstKinds.length)];
      const faults=difficulty==='advanced'?[first,rng()<.5?'service-down':'service-port']:[first];
      let broken=base;for(const kind of faults)broken=serviceFault(broken,kind);
      if(serviceChecks(broken,base).category==='success')continue;
      const instance={exerciseId:'services',seed:String(seed),difficulty,title:DEFINITIONS.services.title,
        prompt:difficulty==='advanced'?'A rede entre PC-A e App funciona, mas a aplicação continua indisponível após duas alterações em serviços. Investigue aquisição, nomes e porta sem alterar a topologia.':'PC-A consegue percorrer a rede até App, mas a experiência por nome e serviço falha. Investigue DHCP, DNS e a porta sem alterar cabos ou VLANs.',
        objective:{sourceId:'pc-a',destinationId:'pc-c',text:'Obtenha as opções DHCP corretas, resolva app.lab e acesse a aplicação TCP/80.'},
        scenario:model.exportScenario(broken,{name:`Serviços · ${difficulty} · ${seed}`,sourceId:'pc-a',destinationId:'pc-c'}),
        ...(variant?{mode:'operational',environment:variant}:{})};
      instances.set(instance,{servicesBase:base,faults});attempts.set(instance,[]);return instance;
    }
    throw new Error('Não foi possível gerar um exercício de serviços coerente.');
  }
  function generateExercise(exerciseId, seed, options = {}) {
    checkMode(options);
    if(exerciseId==='static-routing') {
      const difficulty=options.difficulty||'intermediate';
      if(!['intermediate','advanced'].includes(difficulty)||!['string','number'].includes(typeof seed)||!String(seed).trim()||String(seed).length>40)throw new TypeError('Seed ou dificuldade inválida.');
      return routeExercise(String(seed),difficulty,options);
    }
    if(exerciseId==='external-routing') {
      const difficulty=options.difficulty||'intermediate';
      if(!['intermediate','advanced'].includes(difficulty)||!['string','number'].includes(typeof seed)||!String(seed).trim()||String(seed).length>40)throw new TypeError('Seed ou dificuldade inválida.');
      return externalExercise(String(seed),difficulty,options);
    }
    if(exerciseId==='nat-pat') {
      const difficulty=options.difficulty||'intermediate';
      if(!['intermediate','advanced'].includes(difficulty)||!['string','number'].includes(typeof seed)||!String(seed).trim()||String(seed).length>40)throw new TypeError('Seed ou dificuldade inválida.');
      return natExercise(String(seed),difficulty,options);
    }
    if(exerciseId==='services') {
      const difficulty=options.difficulty||'intermediate';
      if(!['intermediate','advanced'].includes(difficulty)||!['string','number'].includes(typeof seed)||!String(seed).trim()||String(seed).length>40)throw new TypeError('Seed ou dificuldade inválida.');
      return servicesExercise(String(seed),difficulty,options);
    }
    if (exerciseId === EXERCISE_ID) {
      const internal = legacyGenerate(exerciseId, seed, options);
      const publicInstance = {...internal};
      if (options.mode === "operational") {
        const variant = operationalVariant(options, random(`${exerciseId}:${internal.difficulty}:${seed}:profiles`), true);
        const restored = model.importScenario(internal.scenario);
        publicInstance.scenario = model.exportScenario(profileEnvironment(restored.state, variant),
          {name: restored.name, sourceId: restored.sourceId, destinationId: restored.destinationId});
        publicInstance.mode = "operational"; publicInstance.environment = variant;
      }
      if (typeof module !== "object" || !module.exports) {
        delete publicInstance.faultMetadata; delete publicInstance.invariants; delete publicInstance.roles;
      }
      instances.set(publicInstance, {legacy: internal});
      attempts.set(publicInstance, []);
      return publicInstance;
    }
    const difficulty = options.difficulty || "intermediate";
    if (!FAMILY_IDS.includes(exerciseId) || !["intermediate", "advanced"].includes(difficulty)) throw new TypeError("Exercício ou dificuldade desconhecidos.");
    if (!["string", "number"].includes(typeof seed) || !String(seed).trim() || String(seed).length > 40) throw new TypeError("Seed inválida.");
    const normalizedSeed = String(seed);
    for (let attempt = 0; attempt < 64; attempt++) {
      const rng = random(`${exerciseId}:${difficulty}:${normalizedSeed}:${attempt}`);
      const dualTransport = exerciseId === "trunk-8021q" && difficulty === "advanced";
      const routed = ["ipv4", "routing", "mixed"].includes(exerciseId) || difficulty === "advanced";
      const baseNetwork = familyBase(rng, routed, exerciseId !== "vlan-access" || rng() < .5, dualTransport);
      const variant = operationalVariant(options, random(`${exerciseId}:${difficulty}:${normalizedSeed}:${attempt}:profiles`), routed);
      const base = variant ? profileEnvironment(baseNetwork, variant) : baseNetwork;
      if (simulateState(base).status !== "success") continue;
      const pick = list => list[Math.floor(rng() * list.length)];
      const kinds = difficulty === "advanced" && PAIRS[exerciseId]
        ? pick(PAIRS[exerciseId]) : [pick((exerciseId === "mixed" ? Object.values(POOLS).flat() : POOLS[exerciseId]).filter(kind => !kind.endsWith("-allowed") || kind === "trunk-allowed"))];
      const faults = kinds.map(kind => mutation(base, kind, rng));
      if (dualTransport && rng() < .5) {
        for (const fault of faults) {
          fault.deviceId = fault.deviceId === ROLES.sourceSwitchId ? ROLES.destinationSwitchId : ROLES.sourceSwitchId;
          fault.original = clone(base.devices[fault.deviceId].config);
        }
      }
      if (faults.some(fault => simulateState(applyMutation(base, fault)).status !== "failure")) continue;
      const broken = faults.reduce(applyMutation, base);
      if (simulateState(broken).status !== "failure") continue;
      if (faults.length === 2 && faults.some(fault => simulateState(repairMutation(broken, fault)).status !== "failure")) continue;
      const allowHostAddress = ["ipv4", "mixed"].includes(exerciseId);
      const policy = allowHostAddress
        ? "Preserve as redes previstas para os hosts, seus domínios VLAN e os equipamentos instalados."
        : "Preserve os IPs dos hosts, a separação lógica e os equipamentos instalados.";
      const prompts = [
        "Após uma alteração na infraestrutura, PC-1 deixou de alcançar PC-3. Investigue a comunicação e corrija a bancada.",
        "Uma entrega de PC-1 a PC-3 não se conclui nesta montagem. Os equipamentos continuam disponíveis para inspeção; encontre uma correção consistente.",
        "A equipe registrou uma interrupção entre PC-1 e PC-3 após uma manutenção. Observe o percurso antes de propor alterações."
      ];
      const instance = {exerciseId, seed: normalizedSeed, difficulty, title: DEFINITIONS[exerciseId].title,
        prompt: `${pick(prompts)} ${difficulty === "advanced" ? "Confira todo o caminho após cada ajuste." : "Compare as evidências com a configuração atual."} ${policy}`,
        objective: {sourceId: ROLES.sourceId, destinationId: ROLES.destinationId, text: `Restaure a comunicação de PC-1 para PC-3. ${policy}`},
        scenario: model.exportScenario(broken, {name: `${DEFINITIONS[exerciseId].title} · ${difficulty} · ${normalizedSeed}`, sourceId: ROLES.sourceId, destinationId: ROLES.destinationId}),
        ...(variant ? {mode: "operational", environment: variant} : {})};
      instances.set(instance, {base, faults, routed, policy, exerciseId, allowHostAddress});
      attempts.set(instance, []);
      return instance;
    }
    throw new Error("Não foi possível gerar uma instância coerente para esta seed.");
  }
  function sameNetwork(a, b, maskValue) {
    const x = simulator.ipv4(a), y = simulator.ipv4(b), m = simulator.mask(maskValue);
    return Boolean(x && y && m && x.every((byte, i) => (byte & m[i]) === (y[i] & m[i])));
  }
  function preserved(internal, state, result) {
    const base = internal.base;
    for (const [id, device] of Object.entries(base.devices)) {
      const current = state.devices[id];
      if (!current?.position || current.type !== device.type) return "Preserve os equipamentos essenciais da montagem.";
      if (device.type === "pc") {
        const c = current.config, expected = device.config;
        if (c.mac !== expected.mac || c.mask !== expected.mask ||
            (internal.allowHostAddress ? !sameNetwork(c.ip, expected.ip, expected.mask) : c.ip !== expected.ip))
          return "A solução precisa preservar o endereçamento previsto e a identidade dos hosts.";
      }
    }
    for (const link of base.connections) {
      if (connection(state, link.a) !== link.b) return "Preserve a montagem física essencial, incluindo o caminho entre equipamentos.";
      for (const iface of [link.a, link.b]) {
        if (base.interfaces[iface].mode === "access") {
          const id = base.interfaces[iface].deviceId;
          if (state.devices[id].config.vlans[iface] !== base.devices[id].config.vlans[iface]) return "A entrega não pode unir os domínios VLAN que devem continuar separados.";
        }
      }
    }
    if (internal.routed && !result.events.some(e => e.id === "router-receive")) return "O roteador deve continuar exercendo a função de Camada 3 entre as redes.";
    if (internal.routed) {
      const router = state.devices[ROLES.routerId].config, expected = base.devices[ROLES.routerId].config;
      for (const iface of ["eth0", "eth1"]) {
        if (router[iface].mask !== expected[iface].mask || !sameNetwork(router[iface].ip, expected[iface].ip, expected[iface].mask) || router[iface].mac !== expected[iface].mac)
          return "As interfaces de roteamento precisam preservar as duas redes previstas e suas identidades.";
      }
    }
    return null;
  }
  const FAMILY_FEEDBACK = Object.freeze({
    "host-classification": "O host está classificando a entrega como local ou remota de forma incompatível com as redes previstas. Compare os endereços com a máscara da própria interface.",
    "gateway-missing": FEEDBACK["gateway-missing"], "gateway-offlink": FEEDBACK["gateway-offlink"],
    "gateway-arp": FEEDBACK["gateway-arp"], "trunk-blocked": FEEDBACK["trunk-blocked"],
    "access-incompatible": "A resolução local não se completa no domínio esperado. Confira se as portas Access participantes da entrega pertencem ao mesmo contexto VLAN, preservando os demais domínios.",
    "l2-interrupted": "O caminho físico necessário para esta entrega está interrompido. Examine as conexões participantes; a configuração de endereços, por si só, não cria um enlace.",
    "routing-interface": "A entrega parou na função de roteamento: uma interface relevante não está conectada ou sua rede é incompatível com a entrega prevista. Compare as interfaces com os segmentos locais.",
    "route-missing": "O roteador recebeu o pacote, mas não encontrou uma rede de saída diretamente conectada compatível. Confira os prefixos disponíveis e o Destination IP.",
    "arp-unanswered": "O ARP não recebeu resposta no segmento consultado. O resultado sozinho não distingue endereço, conexão ou participação na VLAN; compare essas evidências.",
    invalid: FEEDBACK.invalid, other: FEEDBACK.other
  });
  function currentCategory(internal, state, result) {
    if (result.status === "invalid") return "invalid";
    const src = state.devices[ROLES.sourceId]?.config, dst = state.devices[ROLES.destinationId]?.config;
    const base = internal.base;
    if (!src || !dst) return "l2-interrupted";
    const last = result.events.at(-1)?.id;
    if (sameNetwork(src.ip, dst.ip, src.mask) !== !internal.routed) return "host-classification";
    if (last === "source-unplugged") return "source-cable";
    if (["gateway-missing", "gateway-offlink"].includes(last)) return last;
    if (result.events.some(e => e.id === "trunk-blocked")) return "trunk-blocked";
    const afterRouter = result.events.some(e => e.id === "router-receive");
    const segment = internal.routed
      ? (afterRouter ? [`${ROLES.routerId}:eth1`, `${ROLES.destinationId}:eth0`] : [`${ROLES.sourceId}:eth0`, `${ROLES.routerId}:eth0`])
      : [`${ROLES.sourceId}:eth0`, `${ROLES.destinationId}:eth0`];
    const ports = segment.map(iface => connection(state, iface));
    if (ports.some(port => !port)) return internal.routed && !connection(state, `${ROLES.routerId}:${afterRouter ? "eth1" : "eth0"}`) ? "routing-interface" : "l2-interrupted";
    if (ports.some((port, i) => {
      const expectedPort = connection(base, segment[i]);
      return state.devices[state.interfaces[port].deviceId]?.config.vlans?.[port] !== base.devices[base.interfaces[expectedPort].deviceId].config.vlans[expectedPort];
    })) return "access-incompatible";
    if (base.connections.some(link => base.interfaces[link.a].mode === "trunk") && !connection(state, `${ROLES.sourceSwitchId}:gi0/5`) && !afterRouter) return "l2-interrupted";
    if (last === "route-missing") return !connection(state, `${ROLES.routerId}:eth1`) ? "routing-interface" : "route-missing";
    if (last === "gateway-arp-failed") {
      const r = state.devices[ROLES.routerId]?.config.eth0;
      if (r && !sameNetwork(r.ip, src.ip, r.mask)) return "routing-interface";
      return "gateway-arp";
    }
    if (["arp-unanswered", "destination-arp-failed"].includes(last)) return "arp-unanswered";
    return "other";
  }
  function validateExercise(instance, currentState) {
    const internal = instances.get(instance);
    if (!internal) throw new TypeError("Instância de exercício inválida.");
    if(internal.servicesBase) {
      const base=internal.servicesBase,checked=serviceChecks(currentState,base),result=presentResult(instance,checked.result);
      if(checked.category!=='success') {
        const feedback={
          'dhcp-unavailable':'A aquisição DHCP não se concluiu. Compare o servidor, o pool e o domínio de broadcast do cliente.',
          'dhcp-options':'O lease foi entregue, mas uma opção DHCP não corresponde à rede necessária. Compare gateway e DNS ofertados com o percurso.',
          'dns-config':'O caminho IP até a aplicação pode estar funcional, mas a consulta DNS falhou. Verifique servidor configurado e serviço DNS.',
          'dns-record':'O servidor DNS respondeu, porém não encontrou o nome solicitado. Consulte os registros A.',
          'service-unavailable':'Nome e caminho IP funcionam; a porta ou o serviço de aplicação não está disponível no destino.',
          'service-path':'A resolução ocorreu, mas a conexão não completou o percurso IP até o serviço.'
        }[checked.category]||'A comunicação de aplicação ainda não se concluiu.';
        return {complete:false,category:checked.category,feedback,result};
      }
      const client=currentState.devices['pc-a']?.config,original=base.devices['pc-a'].config,pool=base.devices['pc-b'].config.dhcpServer;
      const leased=client&&Number(client.ip.split('.').at(-1))>=Number(pool.poolStart.split('.').at(-1))&&
        Number(client.ip.split('.').at(-1))<=Number(pool.poolEnd.split('.').at(-1))&&client.ip.startsWith('192.168.10.');
      const clientValid=client&&(client.ip===original.ip||leased)&&client.mask===original.mask&&client.gateway===original.gateway&&client.dns===original.dns;
      const changed=!clientValid||Object.entries(base.devices).some(([id,device])=>{
        const actual=currentState.devices[id];if(!actual||actual.type!==device.type||(device.position&&!actual.position))return true;
        const expected={...device.config},configured={...actual.config};
        if(id==='pc-a')for(const key of ['ip','mask','gateway','dns']){delete expected[key];delete configured[key];}
        return JSON.stringify(expected)!==JSON.stringify(configured);
      })||base.connections.some(link=>connection(currentState,link.a)!==link.b);
      if(changed)return {complete:false,category:'invariant',feedback:'Serviço acessível, mas uma alteração fora do reparo comprometeu a configuração ou a topologia que devem ser preservadas.',result};
      return {complete:true,category:'success',feedback:'Lease, resolução DNS e serviço TCP/80 funcionam com a topologia preservada.',result};
    }
    if(internal.natBase) {
      const raw=routeResult(currentState),result=presentResult(instance,raw),base=internal.natBase;
      if(raw.status!=='success') {
        const translation=raw.events.some(event=>event.id==='nat-source'),reached=raw.events.some(event=>event.id==='echo-request-arrived');
        const configured=currentState.devices['router-1']?.config.nat;
        const code=translation?'nat-return':!configured?.enabled?'nat-missing':configured.inside!=='eth0'||configured.outside!=='eth1'?'nat-roles':reached?'nat-policy':'nat-route';
        const feedback=code==='nat-return'?'A tradução ocorreu na ida, mas a resposta não completou o retorno. Consulte as rotas até o IPv4 público e os eventos do caminho inverso.':
          code==='nat-missing'?'A rota de ida existe, mas nenhuma tradução de origem apareceu. Examine a política NAT da borda.':
          code==='nat-roles'?'A rota foi selecionada, porém a tradução não ocorreu no sentido esperado. Compare as interfaces inside e outside com o percurso real.':
          code==='nat-policy'?'A sonda chegou ao destino sem tradução de origem útil. Compare a rede de origem da política com o tráfego observado.':
          'O percurso não chegou ao ponto esperado da tradução. Examine gateway, rotas e enlaces antes da política NAT.';
        return {complete:false,category:code,feedback,result};
      }
      const changed=Object.entries(base.devices).some(([id,device])=>{
        const actual=currentState.devices[id];
        return !actual||actual.type!==device.type||!actual.position||JSON.stringify(actual.config)!==JSON.stringify(device.config);
      })||base.connections.some(link=>connection(currentState,link.a)!==link.b);
      if(changed)return {complete:false,category:'invariant',feedback:'A comunicação voltou, mas houve alterações fora do reparo previsto. Preserve hosts, separação da LAN, trânsito e equipamentos essenciais.',result};
      return {complete:true,category:'success',feedback:'PAT e caminho de retorno restaurados; Request e Reply completaram o percurso.',result};
    }
    if(internal.routeBase||internal.externalBase) {
      const raw=routeResult(currentState),result=presentResult(instance,raw),base=internal.routeBase||internal.externalBase;
      if(raw.status!=='success') {
        const reached=raw.events.some(event=>event.id==='echo-request-arrived');
        const code=reached?'return-route':internal.externalBase&&raw.events.some(event=>event.id==='route-decision'&&event.routerDecision?.nextHop)?'next-hop':internal.externalBase&&raw.events.some(event=>event.id==='router-receive')?'route-missing':raw.events.some(event=>event.id==='route-decision')?'forward-route':'gateway-or-transit';
        const feedback=reached?'A sonda chegou ao destino, mas a resposta não voltou. Examine as rotas e o próximo salto no caminho de retorno.':code==='next-hop'?'Uma rota foi selecionada, mas seu próximo salto não respondeu no segmento de trânsito. Compare tabela, interface e alcance local.':code==='route-missing'?'A sonda chegou ao primeiro roteador, mas não encontrou um caminho para o destino externo. Compare os prefixos da tabela com o endereço de destino.':code==='forward-route'?'O primeiro roteador recebeu o pacote, mas a entrega adiante não se concluiu. Compare prefixos, próximo salto e enlace de trânsito.':'A entrega parou antes de completar o primeiro salto. Confira gateway e alcance local.';
        return {complete:false,category:code,feedback,result};
      }
      const issue=Object.entries(base.devices).find(([id,device])=>{
        const actual=currentState.devices[id];
        if(!actual?.position||actual.type!==device.type)return true;
        const expected={...device.config},configured={...actual.config};delete expected.staticRoutes;delete configured.staticRoutes;
        return JSON.stringify(expected)!==JSON.stringify(configured);
      })||base.connections.find(link=>connection(currentState,link.a)!==link.b);
      if(issue)return {complete:false,category:'invariant',feedback:'A comunicação voltou, mas equipamentos, interfaces ou cabos essenciais foram alterados. Preserve a arquitetura do exercício.',result};
      return {complete:true,category:'success',feedback:'Comunicação restaurada nos dois sentidos, com rotas e next hops coerentes e topologia preservada.',result};
    }
    if (internal.legacy) {
      const verdict = legacyValidate(internal.legacy, currentState);
      return {...verdict, result: presentResult(instance, verdict.result)};
    }
    const rawResult = simulateState(currentState);
    const result = presentResult(instance, rawResult);
    if (result.status !== "success") {
      const code = currentCategory(internal, currentState, rawResult);
      const stage = internal.routed ? (result.events.some(e => e.id === "router-receive")
        ? " O primeiro frame chegou ao roteador; a interrupção observada está na entrega de saída."
        : " A entrega ainda não chegou à decisão de encaminhamento do roteador.") : " A entrega permanece no domínio local dos hosts.";
      return {complete: false, category: code, feedback: (FAMILY_FEEDBACK[code] || FEEDBACK[code] || FEEDBACK.other) + stage, result};
    }
    const issue = preserved(internal, currentState, result);
    if (issue) return {complete: false, category: "invariant", feedback: `Comunicação restaurada, mas invariantes quebradas. ${issue}`, result};
    return {complete: true, category: "success", feedback: "Comunicação restaurada e invariantes preservadas. As decisões locais, o transporte e as redes de saída agora permitem a entrega prevista.", result};
  }
  function presentResult(instance, result) {
    if (!instances.has(instance)) throw new TypeError("Instância de exercício inválida.");
    if (!result.events.some(e => e.id === "trunk-blocked") && instance.mode !== "operational") return result;
    // O simulador continua produzindo a evidência completa; no exercício, a
    // apresentação pede inspeção das duas pontas sem entregar a ponta culpada.
    const visible = clone(result);
    for (const event of visible.events) {
      if (event.id === "trunk-blocked") {
        event.observation = "O transporte da VLAN pelo trunk não se concluiu.";
        event.explanation = "Compare a participação dessa VLAN nas duas pontas do enlace.";
        event.focusId = null; event.interfaceIds = []; event.incomingInterfaceId = null;
        event.outgoingInterfaceIds = []; event.fromId = null; event.toId = null;
      } else if (event.explanation?.includes("não está admitida no uplink")) {
        event.explanation = "O ARP não atravessou o trunk no contexto VLAN necessário. Inspecione as duas pontas.";
      }
      if (instance.mode === "operational" && event.outcome === "failure") {
        event.observation = "A comunicação foi interrompida nesta etapa.";
        event.explanation = "Compare as evidências do percurso com as consultas nos terminais dos equipamentos envolvidos.";
        event.focusId = null; event.interfaceIds = []; event.connectionIds = []; event.incomingInterfaceId = null;
        event.outgoingInterfaceIds = []; event.fromId = null; event.toId = null;
      }
    }
    visible.message = visible.events.at(-1)?.observation || visible.message;
    return visible;
  }
  function recordCommand(instance, entry) {
    const log = attempts.get(instance);
    if (!log) throw new TypeError("Instância de exercício inválida.");
    if (!entry || typeof entry.deviceId !== "string" || typeof entry.command !== "string" || !entry.command.trim() || entry.command.length > 512 ||
        typeof entry.profile !== "string" || typeof entry.errorCode !== "string" || typeof entry.changedState !== "boolean")
      throw new TypeError("Registro de comando inválido.");
    log.push({deviceId: entry.deviceId, profile: entry.profile, command: entry.command.trim(),
      errorCode: entry.errorCode, changedState: entry.changedState});
    if (log.length > 200) log.shift();
    return log.length;
  }
  function attemptAnalysis(instance) {
    const log = attempts.get(instance);
    if (!log) throw new TypeError("Instância de exercício inválida.");
    return {commandCount: log.length, commands: clone(log)};
  }
  function presentTerminalResult(instance, result) {
    if (!instances.has(instance)) throw new TypeError("Instância de exercício inválida.");
    if (instance.mode !== "operational" || !result.labResult || ["reply", "success"].includes(result.labResult.status)) return result;
    const lines = [`Resultado da tentativa: ${result.labResult.status}.`, "A resposta esperada não foi recebida. Compare os eventos com as consultas dos equipamentos."];
    const output = (result.output.length ? result.session.output.slice(0, -result.output.length) : result.session.output.slice())
      .concat(lines.map(text => ({kind: "output", text})));
    return {...result, output: lines, session: {...result.session, output}};
  }
  const api = {DEFINITIONS, EXERCISE_ID, FAMILY_IDS, OPERATIONAL_VARIANTS, generateExercise, validateExercise, presentResult, presentTerminalResult, recordCommand, attemptAnalysis};
  // Instrumentação de testes, ausente do bundle exposto pelo navegador.
  if (typeof module === "object" && module.exports) api.inspectExercise = instance => clone(instances.get(instance));
  return api;
});
