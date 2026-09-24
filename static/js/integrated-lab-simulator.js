/* Simulador puro: não lê o DOM e não agenda trabalho em segundo plano. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetStudyLabSimulator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const LIMITS = Object.freeze({devices: 3, links: 2, events: 64, history: 64, iterations: 64, timeMs: 50});
  const MAC = Object.freeze({a: "AA:AA:AA:AA:AA:AA", b: "BB:BB:BB:BB:BB:BB"});

  function ipv4(value) {
    if (typeof value !== "string" || !/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return null;
    const octets = value.split(".").map(Number);
    return octets.every(octet => octet <= 255) ? octets : null;
  }
  function validMask(value) {
    const octets = ipv4(value);
    if (!octets) return false;
    return /^1+0*$/.test(octets.map(octet => octet.toString(2).padStart(8, "0")).join(""));
  }
  function sameSubnet(left, right, mask) {
    return left.every((octet, index) => (octet & mask[index]) === (right[index] & mask[index]));
  }
  function validate(input) {
    if (!input || typeof input !== "object") return "Configuração ausente.";
    const devices = input.devices || {}, links = input.links || [], config = input.config || {};
    if (Object.keys(devices).length > LIMITS.devices) return "Limite de 3 dispositivos excedido.";
    if (!Array.isArray(links) || links.length > LIMITS.links) return "Limite de 2 links excedido.";
    if (devices.a !== "pc" || devices.sw !== "switch" || devices.b !== "pc") return "Preencha PC-A, SW1 e PC-B com os equipamentos corretos.";
    if (links.length !== 2 || !links.includes("a-sw") || !links.includes("sw-b") || new Set(links).size !== 2) return "Conecte Eth0 de PC-A à Gi0/1 e Gi0/2 à Eth0 de PC-B.";
    for (const key of ["a", "b"]) {
      if (!config[key] || !ipv4(config[key].ip) || !validMask(config[key].mask)) return `Informe IPv4 e máscara válidos para PC-${key.toUpperCase()}.`;
    }
    if (!config.sw || ![10, 20].includes(Number(config.sw.port1)) || ![10, 20].includes(Number(config.sw.port2))) return "As portas access devem usar VLAN 10 ou 20.";
    return null;
  }
  function simulate(input, testLimits = {}) {
    const error = validate(input);
    if (error) return {status: "invalid", message: error, events: [], tables: {mac: [], arp: []}};
    const maxEvents = Math.min(LIMITS.events, Math.max(1, Number(testLimits.events) || LIMITS.events));
    const maxIterations = Math.min(LIMITS.iterations, Math.max(1, Number(testLimits.iterations) || LIMITS.iterations));
    const maxTimeMs = Math.min(LIMITS.timeMs, Math.max(1, Number(testLimits.timeMs) || LIMITS.timeMs));
    const started = Date.now();
    const {a, b, sw} = input.config;
    const local = sameSubnet(ipv4(a.ip), ipv4(b.ip), ipv4(a.mask)) && sameSubnet(ipv4(a.ip), ipv4(b.ip), ipv4(b.mask));
    const sameVlan = Number(sw.port1) === Number(sw.port2);
    const vlan = Number(sw.port1);
    const queue = local
      ? ["local", "arp-request", "learn-a", "flood", ...(sameVlan ? ["arp-at-b", "arp-reply", "learn-b", "reply-at-a", "data", "forward", "success"] : ["blocked"])]
      : ["remote", "no-router"];
    const events = [], visited = new Set(), mac = [], arp = [];
    let iterations = 0;
    const interrupted = () => {
      const event = {id: "limit", observation: "Simulação interrompida por limite de segurança", explanation: "O teste terminou sem marcar sucesso. Revise a configuração e tente novamente.", focus: "sw", link: null, frame: null, packet: null, tables: {mac: mac.map(row => ({...row})), arp: arp.map(row => ({...row}))}, outcome: "interrupted"};
      if (events.length >= maxEvents) events.length = maxEvents - 1;
      events.push(event);
      return {status: "interrupted", message: event.observation, events, tables: event.tables};
    };
    while (queue.length) {
      if (iterations >= maxIterations || events.length >= maxEvents || Date.now() - started > maxTimeMs) return interrupted();
      iterations += 1;
      const step = queue.shift();
      if (visited.has(step)) return interrupted();
      visited.add(step);
      let event;
      const arpRequest = {source: MAC.a, destination: "FF:FF:FF:FF:FF:FF", type: "ARP"};
      const arpReply = {source: MAC.b, destination: MAC.a, type: "ARP"};
      const dataFrame = {source: MAC.a, destination: MAC.b, type: "IPv4"};
      const packet = {source: a.ip, destination: b.ip};
      switch (step) {
        case "local": event = {observation: "PC-A identifica PC-B como destino local.", explanation: "IP e máscara colocam os dois hosts na mesma rede; falta descobrir o MAC de PC-B.", focus: "a", link: null, frame: null, packet}; break;
        case "arp-request": event = {observation: "PC-A envia ARP Request.", explanation: `Pergunta quem possui ${b.ip}; usa Destination MAC de broadcast na VLAN ${vlan}.`, focus: "a", link: "a-sw", frame: arpRequest, packet: null}; break;
        case "learn-a": mac.push({mac: MAC.a, port: "Gi0/1", vlan}); event = {observation: "SW1 aprende o Source MAC de PC-A.", explanation: `AA fica associado à Gi0/1 na VLAN ${vlan}. O switch ainda não conhece o MAC de PC-B.`, focus: "sw", link: "a-sw", frame: arpRequest, packet: null}; break;
        case "flood": event = {observation: sameVlan ? "SW1 replica o ARP Request pela Gi0/2." : "SW1 limita o ARP Request à VLAN de entrada.", explanation: sameVlan ? `Gi0/2 também está na VLAN ${vlan}; o broadcast pode alcançar PC-B.` : `Gi0/2 está na VLAN ${sw.port2}, fora da VLAN ${vlan} de entrada. O broadcast não atravessa para PC-B.`, focus: "sw", link: sameVlan ? "sw-b" : null, frame: arpRequest, packet: null}; break;
        case "blocked": event = {observation: "O frame não chegou a PC-B neste teste.", explanation: "As portas access estão em VLANs diferentes; não há entrega de Camada 2 entre elas nesta topologia. Isso descreve o resultado observado, sem afirmar outra causa raiz.", focus: "sw", link: null, frame: arpRequest, packet: null, outcome: "failure"}; break;
        case "arp-at-b": event = {observation: "PC-B reconhece o IPv4 procurado.", explanation: "O ARP Request chegou a PC-B, que pode responder com seu MAC.", focus: "b", link: "sw-b", frame: arpRequest, packet: null}; break;
        case "arp-reply": event = {observation: "PC-B envia ARP Reply a PC-A.", explanation: "O Reply informa o MAC de PC-B e usa o MAC de PC-A como destino.", focus: "b", link: "sw-b", frame: arpReply, packet: null}; break;
        case "learn-b": mac.push({mac: MAC.b, port: "Gi0/2", vlan}); event = {observation: "SW1 aprende o Source MAC de PC-B.", explanation: "BB fica associado à Gi0/2; o Reply pode seguir à Gi0/1, onde AA já foi aprendido.", focus: "sw", link: "a-sw", frame: arpReply, packet: null}; break;
        case "reply-at-a": arp.push({ip: b.ip, mac: MAC.b}); event = {observation: "PC-A recebe o ARP Reply.", explanation: "PC-A agora conhece o MAC de PC-B para preparar o frame Ethernet.", focus: "a", link: "a-sw", frame: arpReply, packet: null}; break;
        case "data": event = {observation: "PC-A envia o frame de dados.", explanation: "Destination IP continua sendo PC-B; Destination MAC do frame é o MAC de PC-B.", focus: "a", link: "a-sw", frame: dataFrame, packet}; break;
        case "forward": event = {observation: "SW1 encaminha apenas pela Gi0/2.", explanation: "A tabela MAC associa BB à Gi0/2 na mesma VLAN.", focus: "sw", link: "sw-b", frame: dataFrame, packet}; break;
        case "success": event = {observation: "O frame chega a PC-B neste teste.", explanation: "ARP concluiu a associação e o switch encaminhou o frame pela porta correta. Este laboratório não simula um ping completo.", focus: "b", link: "sw-b", frame: dataFrame, packet, outcome: "success"}; break;
        case "remote": event = {observation: "PC-A identifica PC-B fora da rede local.", explanation: "Os endereços e máscaras informados não permitem entrega direta nesta topologia.", focus: "a", link: null, frame: null, packet}; break;
        case "no-router": event = {observation: "Entrega interrompida: não há roteador neste laboratório.", explanation: "O frame não chegou a PC-B neste teste; é necessário corrigir a configuração para uma rede local ou usar roteamento em outro cenário.", focus: "a", link: null, frame: null, packet, outcome: "failure"}; break;
        default: return interrupted();
      }
      events.push({id: step, ...event, tables: {mac: mac.map(row => ({...row})), arp: arp.map(row => ({...row}))}});
    }
    const last = events[events.length - 1];
    return {status: last?.outcome === "success" ? "success" : "failure", message: last?.observation || "Teste sem resultado.", events, tables: last.tables};
  }
  return {LIMITS, MAC, validate, simulate};
});
