/* Simulador finito: grafo e eventos independentes da interface visual. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetStudyLabSimulator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const LIMITS = Object.freeze({devices: 6, links: 5, events: 64, history: 64, iterations: 64, timeMs: 50});
  const BROADCAST = "FF:FF:FF:FF:FF:FF";
  const ipv4 = value => {
    if (typeof value !== "string" || !/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return null;
    const bytes = value.split(".").map(Number);
    return bytes.every(byte => byte <= 255) ? bytes : null;
  };
  const mask = value => {
    const bytes = ipv4(value);
    return bytes && /^1+0*$/.test(bytes.map(byte => byte.toString(2).padStart(8, "0")).join("")) ? bytes : null;
  };
  const sameSubnet = (a, b, m) => a.every((byte, i) => (byte & m[i]) === (b[i] & m[i]));
  function validate(input) {
    if (!input || typeof input !== "object") return "Configuração ausente.";
    const {devices, interfaces, connections, sourceId, destinationId} = input;
    if (!devices || !interfaces || !Array.isArray(connections)) return "Grafo de equipamentos e cabos incompleto.";
    const ids = Object.keys(devices);
    if (ids.length > LIMITS.devices) return "Limite de 6 equipamentos excedido.";
    if (connections.length > LIMITS.links) return "Limite de 5 cabos excedido.";
    if (!devices[sourceId] || devices[sourceId].type !== "pc") return "Escolha um PC de origem instalado.";
    if (!devices[destinationId] || devices[destinationId].type !== "pc") return "Escolha um PC de destino instalado.";
    if (sourceId === destinationId) return "Origem e destino precisam ser PCs diferentes.";
    if (ids.filter(id => devices[id].type === "switch").length > 2 || ids.filter(id => devices[id].type === "pc").length > 4) return "Esta bancada aceita até 4 PCs e 2 switches.";
    const ips = new Set(), macs = new Set();
    for (const id of ids) {
      const device = devices[id];
      if (device.type === "pc") {
        if (!ipv4(device.config?.ip) || !mask(device.config?.mask)) return `IPv4 ou máscara inválidos em ${device.name || id}.`;
        if (!/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(device.config?.mac || "")) return `MAC inválido em ${device.name || id}.`;
        if (ips.has(device.config.ip)) return `IPv4 duplicado: ${device.config.ip}.`;
        if (macs.has(device.config.mac.toUpperCase())) return `MAC duplicado: ${device.config.mac}.`;
        ips.add(device.config.ip); macs.add(device.config.mac.toUpperCase());
      } else if (device.type === "switch") {
        for (const port of device.interfaces) {
          if (interfaces[port]?.mode === "access" && ![10, 20].includes(Number(device.config?.vlans?.[port]))) return `VLAN inválida em ${port}.`;
        }
        const allowed = device.config?.allowedVlans;
        if (!Array.isArray(allowed) || allowed.some(v => ![10, 20].includes(Number(v))) || new Set(allowed).size !== allowed.length) return `Lista de VLANs do trunk inválida em ${device.name || id}.`;
      } else return `Tipo de equipamento inválido: ${id}.`;
    }
    const used = new Set(), cableIds = new Set();
    let trunks = 0;
    for (const cable of connections) {
      const a = interfaces[cable.a], b = interfaces[cable.b];
      if (!a || !b || !devices[a.deviceId] || !devices[b.deviceId]) return "Cabo ligado a uma interface inexistente.";
      if (used.has(cable.a) || used.has(cable.b) || cableIds.has(cable.id)) return "Interface ou cabo conectado mais de uma vez.";
      if (a.deviceId === b.deviceId) return "Cabo não pode ligar interfaces do mesmo equipamento.";
      const types = [devices[a.deviceId].type, devices[b.deviceId].type];
      const isTrunk = types.every(type => type === "switch") && a.mode === "trunk" && b.mode === "trunk";
      const isAccess = types.includes("pc") && types.includes("switch") && a.mode !== "trunk" && b.mode !== "trunk";
      if (!isTrunk && !isAccess) return "Use portas access para PCs e uplinks trunk entre switches.";
      if (isTrunk) trunks++;
      used.add(cable.a); used.add(cable.b); cableIds.add(cable.id);
    }
    if (trunks > 1) return "Somente um enlace trunk é permitido; ciclos não são suportados.";
    return null;
  }
  function simulate(input, testLimits = {}) {
    const error = validate(input);
    if (error) return {status: "invalid", message: error, events: [], tables: {mac: [], arp: []}};
    const cap = name => Math.min(LIMITS[name], Math.max(1, Number(testLimits[name]) || LIMITS[name]));
    const maxEvents = cap("events"), maxIterations = cap("iterations"), maxTime = cap("timeMs"), start = Date.now();
    const {devices, interfaces, connections, sourceId, destinationId} = input;
    const source = devices[sourceId], destination = devices[destinationId];
    const linkAt = id => connections.find(link => link.a === id || link.b === id);
    const other = (link, id) => link.a === id ? link.b : link.a;
    const endpoint = id => {
      const link = linkAt(`${id}:eth0`);
      const port = link && other(link, `${id}:eth0`);
      return {link, port, switchId: port && interfaces[port].deviceId, vlan: port && Number(devices[interfaces[port].deviceId].config.vlans[port])};
    };
    const src = endpoint(sourceId), dst = endpoint(destinationId), vlan = src.vlan;
    const trunk = connections.find(link => interfaces[link.a].mode === "trunk" && interfaces[link.b].mode === "trunk");
    const ports = switchId => Object.keys(interfaces).filter(id => interfaces[id].deviceId === switchId && linkAt(id)).sort();
    const mac = [], arp = [], events = [];
    const snapshots = () => ({mac: mac.map(row => ({...row})), arp: arp.map(row => ({...row}))});
    let iterations = 0, blockedReason = null;
    const limit = Symbol("limit");
    function emit(id, observation, explanation, options = {}) {
      if (++iterations > maxIterations || events.length >= maxEvents || Date.now() - start > maxTime) throw limit;
      events.push({id, observation, explanation, focusId: options.focusId || null,
        interfaceIds: options.interfaceIds || [], connectionIds: options.connectionIds || [],
        incomingInterfaceId: options.incomingInterfaceId || null, outgoingInterfaceIds: options.outgoingInterfaceIds || [],
        fromId: options.fromId || null, toId: options.toId || null,
        frame: options.frame || null, packet: options.packet || null, outcome: options.outcome || null,
        tables: snapshots()});
    }
    function learn(switchId, macAddress, ingress, frame) {
      const row = {switchId, mac: macAddress, port: interfaces[ingress].name, interfaceId: ingress, vlan};
      const existing = mac.find(item => item.switchId === switchId && item.vlan === vlan && item.mac === macAddress);
      if (existing) Object.assign(existing, row);
      else mac.push(row);
      emit("mac-learn", `${devices[switchId].name} aprende ${macAddress} em ${row.port} na VLAN ${vlan}.`, "A tabela MAC deste switch associa Source MAC, porta de entrada e VLAN.", {focusId: switchId, incomingInterfaceId: ingress, interfaceIds: [ingress], frame});
    }
    const frame = (kind, tag = null) => ({
      source: kind === "arp-reply" ? destination.config.mac : source.config.mac,
      destination: kind === "arp-request" ? BROADCAST : kind === "arp-reply" ? source.config.mac : destination.config.mac,
      type: kind === "ipv4" ? "IPv4" : "ARP", kind, label: kind === "arp-request" ? "ARP Request" : kind === "arp-reply" ? "ARP Reply" : "Frame IPv4", vlanTag: tag
    });
    const packet = {source: source.config.ip, destination: destination.config.ip};
    function blocked(kind, atSwitch, port, explanation, cable = null, receiver = null) {
      blockedReason = explanation;
      emit("trunk-blocked", `${devices[atSwitch].name} interrompe ${frame(kind).label} na VLAN ${vlan}.`, explanation,
        {focusId: atSwitch, incomingInterfaceId: receiver ? port : null, outgoingInterfaceIds: receiver ? [] : [port], interfaceIds: [port], connectionIds: cable ? [cable.id] : [], fromId: receiver ? devices[interfaces[other(cable, port)].deviceId].id : null, toId: receiver ? atSwitch : null, frame: frame(kind, vlan)});
    }
    function broadcast() {
      const queue = [{switchId: src.switchId, ingress: src.port, via: null}];
      const visited = new Set();
      let found = false;
      while (queue.length) {
        if (++iterations > maxIterations || Date.now() - start > maxTime) throw limit;
        const {switchId, ingress, via} = queue.shift();
        if (visited.has(switchId)) throw limit;
        visited.add(switchId);
        if (via) emit("trunk-in", `${devices[switchId].name} recebe ARP Request com tag VLAN ${vlan} em ${interfaces[ingress].name}.`, "O 802.1Q identifica a VLAN no enlace trunk.", {focusId: switchId, incomingInterfaceId: ingress, interfaceIds: [ingress], connectionIds: [via.id], fromId: interfaces[other(via, ingress)].deviceId, toId: switchId, frame: frame("arp-request", vlan)});
        learn(switchId, source.config.mac, ingress, frame("arp-request", via ? vlan : null));
        const egress = ports(switchId).filter(port => port !== ingress && (interfaces[port].mode === "trunk" || Number(devices[switchId].config.vlans[port]) === vlan));
        emit("broadcast-decision", `${devices[switchId].name} avalia ${egress.length} saída(s) na VLAN ${vlan}.`, "Exclui a porta de entrada e portas access de outra VLAN.", {focusId: switchId, incomingInterfaceId: ingress, outgoingInterfaceIds: egress, interfaceIds: [ingress, ...egress], connectionIds: egress.map(port => linkAt(port).id), frame: frame("arp-request", via ? vlan : null)});
        for (const port of egress) {
          const link = linkAt(port), peer = other(link, port), peerId = interfaces[peer].deviceId;
          if (interfaces[port].mode === "trunk") {
            if (!devices[switchId].config.allowedVlans.includes(vlan)) { blocked("arp-request", switchId, port, `A VLAN ${vlan} não está admitida no uplink de ${devices[switchId].name}.`); continue; }
            emit("trunk-out", `${devices[switchId].name} envia ARP Request com tag VLAN ${vlan} pelo trunk.`, "A tag 802.1Q identifica a VLAN durante a travessia.", {focusId: switchId, incomingInterfaceId: ingress, outgoingInterfaceIds: [port], interfaceIds: [port, peer], connectionIds: [link.id], fromId: switchId, toId: peerId, frame: frame("arp-request", vlan)});
            if (!devices[peerId].config.allowedVlans.includes(vlan)) { blocked("arp-request", peerId, peer, `A VLAN ${vlan} não está admitida no uplink de ${devices[peerId].name}; o frame chegou ao trunk, mas não entra na VLAN.`, link, true); continue; }
            queue.push({switchId: peerId, ingress: peer, via: link});
          } else {
            emit("broadcast-out", `ARP Request sai por ${interfaces[port].name} de ${devices[switchId].name} para ${devices[peerId].name}.`, "Na porta access, o frame é entregue sem tag 802.1Q.", {focusId: switchId, incomingInterfaceId: ingress, outgoingInterfaceIds: [port], interfaceIds: [port, peer], connectionIds: [link.id], fromId: switchId, toId: peerId, frame: frame("arp-request")});
            const target = peerId === destinationId;
            emit(target ? "arp-target" : "arp-discarded", target ? `${destination.name} reconhece o IPv4 consultado.` : `${devices[peerId].name} recebe e descarta o ARP Request.`, target ? "Somente o PC com o IPv4 procurado prepara a resposta." : `O IPv4 consultado não é ${devices[peerId].config.ip}.`, {focusId: peerId, incomingInterfaceId: peer, interfaceIds: [port, peer], connectionIds: [link.id], fromId: switchId, toId: peerId, frame: frame("arp-request")});
            if (target) found = true;
          }
        }
      }
      return found;
    }
    function unicast(kind, senderId, receiverId) {
      const sender = devices[senderId], receiver = devices[receiverId], start = endpoint(senderId);
      const packetData = kind === "ipv4" ? packet : null;
      emit(kind === "arp-reply" ? "arp-reply" : "data", `${sender.name} envia ${frame(kind).label} a ${receiver.name}.`, "Na porta access, o frame sai sem tag 802.1Q.", {focusId: senderId, outgoingInterfaceIds: [`${senderId}:eth0`], interfaceIds: [`${senderId}:eth0`, start.port], connectionIds: [start.link.id], fromId: senderId, toId: start.switchId, frame: frame(kind), packet: packetData});
      let switchId = start.switchId, ingress = start.port;
      const visited = new Set();
      while (true) {
        if (++iterations > maxIterations || Date.now() - startTime > maxTime) throw limit;
        if (visited.has(switchId)) throw limit;
        visited.add(switchId);
        learn(switchId, sender.config.mac, ingress, frame(kind, interfaces[ingress].mode === "trunk" ? vlan : null));
        const destinationRow = mac.find(row => row.switchId === switchId && row.vlan === vlan && row.mac === receiver.config.mac);
        if (!destinationRow) return false;
        const out = destinationRow.interfaceId, link = linkAt(out), peer = link && other(link, out), peerId = peer && interfaces[peer].deviceId;
        if (!link || out === ingress) return false;
        emit(kind === "arp-reply" ? "reply-decision" : "unicast-decision", `${devices[switchId].name} escolhe ${interfaces[out].name} para ${frame(kind).label}.`, "A decisão usa a tabela MAC deste switch e desta VLAN.", {focusId: switchId, incomingInterfaceId: ingress, outgoingInterfaceIds: [out], interfaceIds: [ingress, out], frame: frame(kind, interfaces[ingress].mode === "trunk" ? vlan : null), packet: packetData});
        if (interfaces[out].mode === "trunk") {
          if (!devices[switchId].config.allowedVlans.includes(vlan)) { blocked(kind, switchId, out, `A VLAN ${vlan} não está admitida no uplink de ${devices[switchId].name}.`); return false; }
          emit(kind === "arp-reply" ? "reply-trunk" : "data-trunk", `${devices[switchId].name} encaminha ${frame(kind).label} pelo trunk com tag VLAN ${vlan}.`, "A tag é preservada ao atravessar o enlace.", {focusId: switchId, incomingInterfaceId: ingress, outgoingInterfaceIds: [out], interfaceIds: [out, peer], connectionIds: [link.id], fromId: switchId, toId: peerId, frame: frame(kind, vlan), packet: packetData});
          if (!devices[peerId].config.allowedVlans.includes(vlan)) { blocked(kind, peerId, peer, `A VLAN ${vlan} não está admitida no uplink de ${devices[peerId].name}.`, link, true); return false; }
          emit("trunk-in", `${devices[peerId].name} recebe ${frame(kind).label} com tag VLAN ${vlan}.`, "O pacote IPv4 permanece inalterado.", {focusId: peerId, incomingInterfaceId: peer, interfaceIds: [peer], connectionIds: [link.id], fromId: switchId, toId: peerId, frame: frame(kind, vlan), packet: packetData});
          switchId = peerId; ingress = peer;
        } else {
          emit(kind === "arp-reply" ? "reply-forward" : "unicast-forward", `${devices[switchId].name} encaminha ${frame(kind).label} somente por ${interfaces[out].name}.`, "Na saída access, o frame é entregue sem tag 802.1Q.", {focusId: switchId, incomingInterfaceId: ingress, outgoingInterfaceIds: [out], interfaceIds: [out, peer], connectionIds: [link.id], fromId: switchId, toId: peerId, frame: frame(kind), packet: packetData});
          return peerId === receiverId;
        }
      }
    }
    const startTime = start;
    function finish(status) { const last = events.at(-1); return {status, message: last?.observation || "Teste sem eventos.", events, tables: last?.tables || snapshots()}; }
    try {
      const local = sameSubnet(ipv4(source.config.ip), ipv4(destination.config.ip), mask(source.config.mask)) && sameSubnet(ipv4(source.config.ip), ipv4(destination.config.ip), mask(destination.config.mask));
      emit("local", `${source.name} avalia se ${destination.name} está na rede local.`, local ? "IP e máscara indicam entrega local; falta descobrir o MAC do destino." : "O IPv4 de destino não pertence à rede local segundo a configuração informada.", {focusId: sourceId, interfaceIds: [`${sourceId}:eth0`], packet});
      if (!local) { emit("remote", "Destino remoto: esta bancada não possui roteador.", "Não há próximo salto configurável para essa comunicação.", {focusId: sourceId, outcome: "failure"}); return finish("failure"); }
      if (!src.link) { emit("source-unplugged", `${source.name} não possui cabo para enviar o ARP Request.`, "Nenhum frame entrou no switch.", {focusId: sourceId, interfaceIds: [`${sourceId}:eth0`], outcome: "failure"}); return finish("failure"); }
      emit("arp-request", `${source.name} envia ARP Request para ${destination.config.ip}.`, `O Destination MAC é broadcast na VLAN ${vlan}.`, {focusId: sourceId, outgoingInterfaceIds: [`${sourceId}:eth0`], interfaceIds: [`${sourceId}:eth0`, src.port], connectionIds: [src.link.id], fromId: sourceId, toId: src.switchId, frame: frame("arp-request")});
      const found = broadcast();
      if (!found) {
        const reason = !dst.link ? `${destination.name} não tem cabo conectado.` : dst.vlan !== vlan ? `${destination.name} está na VLAN ${dst.vlan}; não há roteamento entre VLANs nesta bancada.` : blockedReason || (src.switchId !== dst.switchId && !trunk ? "Os switches não possuem enlace trunk conectado." : "O ARP Request não alcançou o destino na VLAN configurada; confira o trunk e as portas.");
        emit("arp-unanswered", `A resolução ARP para ${destination.name} não se concluiu.`, reason, {focusId: dst.switchId || src.switchId, interfaceIds: dst.port ? [dst.port] : [], outcome: "failure"});
        return finish("failure");
      }
      if (!unicast("arp-reply", destinationId, sourceId)) { emit("reply-unanswered", "ARP Reply não chegou à origem.", "O encaminhamento não encontrou uma porta MAC válida na VLAN.", {focusId: dst.switchId, outcome: "failure"}); return finish("failure"); }
      arp.push({owner: sourceId, ip: destination.config.ip, mac: destination.config.mac});
      emit("arp-learned", `${source.name} associa ${destination.config.ip} ao MAC de ${destination.name}.`, "Agora o Destination MAC do frame IPv4 pode ser preenchido.", {focusId: sourceId, interfaceIds: [`${sourceId}:eth0`]});
      if (!unicast("ipv4", sourceId, destinationId)) { emit("data-unanswered", "O frame IPv4 não chegou ao destino.", "O encaminhamento não encontrou uma porta MAC válida na VLAN.", {focusId: src.switchId, outcome: "failure"}); return finish("failure"); }
      emit("delivered", `O frame chega a ${destination.name} neste teste.`, "ARP e as tabelas MAC dos switches permitiram a entrega local. Isto não simula um ping completo.", {focusId: destinationId, incomingInterfaceId: `${destinationId}:eth0`, interfaceIds: [dst.port, `${destinationId}:eth0`], connectionIds: [dst.link.id], fromId: dst.switchId, toId: destinationId, frame: frame("ipv4"), packet, outcome: "success"});
      return finish("success");
    } catch (caught) {
      if (caught !== limit) throw caught;
      const interruption = {id: "limit", observation: "Simulação interrompida por limite de segurança", explanation: "O teste terminou sem marcar sucesso.", focusId: src.switchId || sourceId, interfaceIds: [], connectionIds: [], incomingInterfaceId: null, outgoingInterfaceIds: [], fromId: null, toId: null, frame: null, packet: null, outcome: "interrupted", tables: snapshots()};
      if (events.length >= maxEvents) events.length = maxEvents - 1;
      events.push(interruption);
      return finish("interrupted");
    }
  }
  return {LIMITS, validate, simulate};
});
