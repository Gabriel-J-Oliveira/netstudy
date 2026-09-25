/* Exercise Engine v1: definição, geração e validação sem DOM nem persistência. */
(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports ? require("./integrated-lab-model.js") : root.NetStudyLabModel,
    typeof module === "object" && module.exports ? require("./integrated-lab-simulator.js") : root.NetStudyLabSimulator
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetStudyLabExerciseEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (model, simulator) {
  "use strict";
  const EXERCISE_ID = "ipv4-connectivity";
  const DEFINITIONS = Object.freeze({
    [EXERCISE_ID]: Object.freeze({
      id: EXERCISE_ID, title: "Diagnóstico de conectividade IPv4",
      description: "Investigue uma comunicação interrompida entre duas redes e corrija a bancada.",
      objective: "Faça PC-A alcançar PC-C, preservando as redes e as VLANs separadas por R1.",
      difficulties: Object.freeze(["intermediate", "advanced"])
    })
  });
  const FAULTS = Object.freeze(["gateway", "mask", "access-vlan", "trunk", "router-interface"]);
  const ADVANCED_PAIRS = Object.freeze([
    ["mask", "trunk"], ["gateway", "router-interface"],
    ["access-vlan", "router-interface"], ["gateway", "trunk"], ["router-interface", "trunk"]
  ]);
  const CAUSES = Object.freeze({
    gateway: "o próximo salto configurado em PC-A não correspondia a uma interface alcançável de R1",
    mask: "a máscara de PC-A o levava a tratar o destino remoto como local",
    "access-vlan": "uma porta Access não colocava o destino no contexto VLAN esperado",
    trunk: "a VLAN necessária não era admitida em uma ponta do trunk",
    "router-interface": "a configuração IPv4 de saída de R1 não fornecia uma rota conectada para a rede de PC-C"
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
    const adapted = model.adapt(state, "pc-a", "pc-c");
    return adapted.error ? {status: "invalid", message: adapted.error, events: []} : simulator.simulate(adapted.input);
  }
  function baseState(rng, difficulty) {
    let state = model.create();
    const positions = [
      ["pc-a", .14, .2], ["sw1", .39, .35], ["sw2", .62, .55],
      ["r1", .83, .28], ["pc-c", .83, .76], ["pc-b", .15, .65]
    ];
    if (difficulty === "advanced") positions.push(["pc-d", .39, .8]);
    positions.forEach(([id, x, y]) => { state = applied(model.position(state, id, x, y)); });
    const sourceHost = 10 + Math.floor(rng() * 5);
    const destinationHost = 30 + Math.floor(rng() * 5);
    state = applied(model.configure(state, "pc-a", {ip: `192.168.10.${sourceHost}`, gateway: "192.168.10.1"}));
    state = applied(model.configure(state, "pc-b", {ip: "192.168.20.20", gateway: "192.168.20.1"}));
    state = applied(model.configure(state, "pc-c", {ip: `192.168.20.${destinationHost}`, gateway: "192.168.20.1"}));
    state = applied(model.configure(state, "pc-d", {gateway: "192.168.10.1"}));
    state = applied(model.configure(state, "sw1", {vlans: {"sw1:gi0/2": 20}}));
    state = applied(model.configure(state, "sw2", {vlans: {"sw2:gi0/2": 20, "sw2:gi0/3": 20}}));
    const cables = [
      ["pc-a:eth0", "sw1:gi0/1"], ["pc-b:eth0", "sw1:gi0/2"],
      ["sw1:gi0/5", "sw2:gi0/5"], ["r1:eth0", "sw2:gi0/1"],
      ["r1:eth1", "sw2:gi0/2"], ["pc-c:eth0", "sw2:gi0/3"]
    ];
    if (difficulty === "advanced") cables.push(["pc-d:eth0", "sw1:gi0/3"]);
    cables.forEach(([a, b]) => { state = applied(model.connect(state, a, b)); });
    return state;
  }
  function inject(state, kind, rng, chosen = null) {
    if (kind === "gateway") {
      const variant = chosen?.variant || (rng() < .5 ? "offlink" : "unanswered");
      return {state: applied(model.configure(state, "pc-a", {gateway: variant === "offlink" ? "192.168.30.1" : "192.168.10.254"})), fault: {kind, variant}};
    }
    if (kind === "mask") return {state: applied(model.configure(state, "pc-a", {mask: "255.255.0.0"})), fault: {kind}};
    if (kind === "access-vlan") return {state: applied(model.configure(state, "sw2", {vlans: {"sw2:gi0/3": 10}})), fault: {kind}};
    if (kind === "trunk") {
      const side = chosen?.side || (rng() < .5 ? "sw1" : "sw2");
      return {state: applied(model.configure(state, side, {allowedVlans: [20]})), fault: {kind, side}};
    }
    const variant = chosen?.variant || (rng() < .5 ? "ip" : "mask");
    return {state: applied(model.configure(state, "r1", {eth1: variant === "ip" ? {ip: "192.168.30.1"} : {mask: "255.255.255.248"}})), fault: {kind, variant}};
  }
  function generateExercise(exerciseId, seed, options = {}) {
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
      sourceId: "pc-a", destinationId: "pc-c"
    });
    return {
      exerciseId, seed: normalizedSeed, difficulty, scenario, faultMetadata,
      objective: {sourceId: "pc-a", destinationId: "pc-c", text: definition.objective},
      invariants: {sourceNetwork: "192.168.10.0/24", destinationNetwork: "192.168.20.0/24",
        sourceVlan: 10, destinationVlan: 20, routerId: "r1", requiredDevices: difficulty === "advanced"
          ? ["pc-a", "pc-b", "pc-c", "pc-d", "sw1", "sw2", "r1"] : ["pc-a", "pc-b", "pc-c", "sw1", "sw2", "r1"]},
      title: definition.title,
      prompt: difficulty === "advanced"
        ? "PC-A não alcança PC-C. Há dois problemas na montagem. Investigue o percurso e preserve a arquitetura entre as redes."
        : "PC-A não alcança PC-C. Há um problema na montagem. Use o teste da bancada para investigar antes de alterar a configuração."
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
    if (instance.invariants.requiredDevices.some(id => !devices[id]?.position))
      return "Os equipamentos previstos para a topologia precisam permanecer instalados.";
    const a = devices["pc-a"].config, c = devices["pc-c"].config, r = devices.r1.config;
    if (!network(a.ip, "192.168.10") || a.mask !== "255.255.255.0" ||
        !network(c.ip, "192.168.20") || c.mask !== "255.255.255.0")
      return "PC-A e PC-C precisam continuar em suas redes /24 distintas.";
    if (!network(r.eth0.ip, "192.168.10") || r.eth0.mask !== "255.255.255.0" ||
        !network(r.eth1.ip, "192.168.20") || r.eth1.mask !== "255.255.255.0" ||
        a.gateway !== r.eth0.ip || c.gateway !== r.eth1.ip)
      return "R1 precisa manter uma interface e um gateway alcançável em cada rede prevista.";
    const access = (iface, switchId, vlan) => {
      const peer = connection(state, iface);
      return Boolean(peer && model.INTERFACES[peer]?.deviceId === switchId &&
        devices[switchId].config.vlans[peer] === vlan);
    };
    if (!access("pc-a:eth0", "sw1", 10) || !access("r1:eth0", "sw2", 10) ||
        !access("r1:eth1", "sw2", 20) || !access("pc-c:eth0", "sw2", 20))
      return "A entrega voltou, mas as portas Access não preservam os dois contextos VLAN previstos.";
    if (!connection(state, "sw1:gi0/5") || connection(state, "sw1:gi0/5") !== "sw2:gi0/5" ||
        !["sw1", "sw2"].every(id => devices[id].config.allowedVlans.includes(10)))
      return "O enlace entre os switches precisa continuar transportando a VLAN de origem.";
    if (instance.difficulty === "advanced" &&
        (!access("pc-b:eth0", "sw1", 20) || !access("pc-d:eth0", "sw1", 10)))
      return "A topologia avançada deve manter os hosts adicionais em suas VLANs.";
    if (!result.events.some(event => event.id === "router-receive") ||
        !result.events.some(event => event.id === "frame-out"))
      return "A comunicação precisa atravessar R1, sem unir as duas redes em um único domínio.";
    return null;
  }
  const FEEDBACK = Object.freeze({
    "local-mask": "PC-A está tentando resolver diretamente o MAC de PC-C. Pela configuração atual, ele considera o destino local. Revise a relação entre IP, máscara e rede de destino.",
    "gateway-missing": "PC-A reconhece o destino remoto, mas não tem próximo salto configurado para a primeira entrega.",
    "gateway-offlink": "O próximo salto indicado por PC-A não pertence à rede que sua interface considera local. Esse endereço não pode ser resolvido diretamente nesta LAN.",
    "gateway-arp": "O ARP pelo próximo salto não recebeu resposta. A evidência ainda não distingue endereço, cabo ou participação na VLAN; inspecione o alcance local.",
    "trunk-blocked": "A tentativa de ARP parou no trunk: a VLAN do frame não está admitida em uma das pontas. O enlace físico pode continuar ativo.",
    "route-missing": "R1 recebeu o primeiro frame, mas não encontrou uma rede diretamente conectada para encaminhar ao destino. Inspecione a rede da interface de saída.",
    "vlan-destination": "R1 chegou à rede de saída, mas seu ARP não alcançou PC-C no mesmo contexto VLAN. Observe as portas Access dessa entrega.",
    "destination-arp": "R1 escolheu a rede de saída, mas o ARP por PC-C não recebeu resposta. Cabo, porta ou VLAN ainda precisam ser investigados.",
    "source-cable": "PC-A não conseguiu iniciar a entrega pela sua interface. Verifique se existe um caminho físico até o switch.",
    invalid: "A configuração atual não pôde ser simulada. Revise os endereços, máscaras e conexões informados.",
    other: "A entrega continua interrompida. Examine o último evento da bancada e a primeira etapa sem resposta antes de alterar outra configuração."
  });
  function category(result, state) {
    if (result.status === "invalid") return "invalid";
    const last = result.events.at(-1);
    if (last?.id === "arp-unanswered" && result.events[0]?.id === "local") return "local-mask";
    if (last?.id === "gateway-missing") return "gateway-missing";
    if (last?.id === "gateway-offlink") return "gateway-offlink";
    if (result.events.some(event => event.id === "trunk-blocked")) return "trunk-blocked";
    if (last?.id === "gateway-arp-failed") return "gateway-arp";
    if (last?.id === "route-missing") return "route-missing";
    if (last?.id === "destination-arp-failed") {
      const rPort = connection(state, "r1:eth1"), cPort = connection(state, "pc-c:eth0");
      if (rPort && cPort && state.devices.sw2.config.vlans[rPort] !== state.devices.sw2.config.vlans[cPort]) return "vlan-destination";
      return "destination-arp";
    }
    if (last?.id === "source-unplugged") return "source-cable";
    return "other";
  }
  function validateExercise(instance, currentState) {
    if (!instance || !DEFINITIONS[instance.exerciseId] || !instance.invariants || !instance.objective)
      throw new TypeError("Instância de exercício inválida.");
    const adapted = model.adapt(currentState, instance.objective.sourceId, instance.objective.destinationId);
    const result = adapted.error ? {status: "invalid", message: adapted.error, events: []} : simulator.simulate(adapted.input);
    if (result.status !== "success") {
      const code = category(result, currentState);
      return {complete: false, category: code, feedback: FEEDBACK[code], result};
    }
    const issue = invariantIssue(instance, currentState, result);
    if (issue) return {complete: false, category: "invariant", feedback: `A comunicação foi restaurada, mas a arquitetura prevista foi alterada. ${issue}`, result};
    const causes = instance.faultMetadata.map(item => CAUSES[item.kind]);
    return {complete: true, category: "success", feedback: `Comunicação restaurada sem romper a separação das redes. O cenário inicial falhava porque ${causes.join(" e porque ")}.`, result};
  }
  return {DEFINITIONS, EXERCISE_ID, generateExercise, validateExercise};
});
