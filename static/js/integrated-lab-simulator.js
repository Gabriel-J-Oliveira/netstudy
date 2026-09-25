/* Grafo e eventos da bancada; nenhuma decisão de encaminhamento fica na interface visual. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetStudyLabSimulator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const LIMITS = Object.freeze({devices: 7, links: 7, events: 128, history: 128, iterations: 256, timeMs: 200});
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
  const prefix = (ip, m) => `${ip.map((byte, i) => byte & m[i]).join(".")}/${m.flatMap(byte => byte.toString(2).padStart(8, "0").split("")).filter(bit => bit === "1").length}`;
  const validMac = value => /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(value || "");

  function validate(input) {
    if (!input || typeof input !== "object") return "Configuração ausente.";
    const {devices, interfaces, connections, sourceId, destinationId} = input;
    if (!devices || !interfaces || !Array.isArray(connections)) return "Grafo de equipamentos e cabos incompleto.";
    const ids = Object.keys(devices);
    if (ids.length > LIMITS.devices) return "Limite de 7 equipamentos excedido.";
    if (connections.length > LIMITS.links) return "Limite de 7 cabos excedido.";
    if (!devices[sourceId] || devices[sourceId].type !== "pc") return "Escolha um PC de origem instalado.";
    if (!devices[destinationId] || devices[destinationId].type !== "pc") return "Escolha um PC de destino instalado.";
    if (sourceId === destinationId) return "Origem e destino precisam ser PCs diferentes.";
    if (ids.filter(id => devices[id].type === "switch").length > 2 || ids.filter(id => devices[id].type === "pc").length > 4 || ids.filter(id => devices[id].type === "router").length > 1) return "Esta bancada aceita até 4 PCs, 2 switches e 1 roteador.";
    const ips = new Set(), macs = new Set();
    const unique = (ip, mac, owner) => {
      if (ips.has(ip)) return `IPv4 duplicado: ${ip}.`;
      if (macs.has(mac.toUpperCase())) return `MAC duplicado em ${owner}.`;
      ips.add(ip); macs.add(mac.toUpperCase()); return null;
    };
    for (const id of ids) {
      const device = devices[id];
      if (device.type === "pc") {
        if (!ipv4(device.config?.ip) || !mask(device.config?.mask) || (device.config?.gateway && !ipv4(device.config.gateway))) return `Configuração IPv4 inválida em ${device.name || id}.`;
        if (!validMac(device.config?.mac)) return `MAC inválido em ${device.name || id}.`;
        const error = unique(device.config.ip, device.config.mac, device.name || id); if (error) return error;
      } else if (device.type === "router") {
        if (device.interfaces.length !== 2) return "R1 deve ter Eth0 e Eth1.";
        for (const iface of ["eth0", "eth1"]) {
          const config = device.config?.[iface];
          if (!ipv4(config?.ip) || !mask(config?.mask)) return `Configuração IPv4 inválida em R1 ${iface.toUpperCase()}.`;
          if (!validMac(config?.mac)) return `MAC inválido em R1 ${iface.toUpperCase()}.`;
          const error = unique(config.ip, config.mac, `R1 ${iface}`); if (error) return error;
        }
      } else if (device.type === "switch") {
        for (const port of device.interfaces) if (interfaces[port]?.mode === "access" && ![10, 20].includes(Number(device.config?.vlans?.[port]))) return `VLAN inválida em ${port}.`;
        const allowed = device.config?.allowedVlans;
        if (!Array.isArray(allowed) || allowed.some(v => ![10, 20].includes(Number(v))) || new Set(allowed).size !== allowed.length) return `Lista de VLANs do trunk inválida em ${device.name || id}.`;
      } else return `Tipo de equipamento inválido: ${id}.`;
    }
    const used = new Set(), cableIds = new Set(); let trunks = 0;
    for (const cable of connections) {
      const a = interfaces[cable.a], b = interfaces[cable.b];
      if (!a || !b || !devices[a.deviceId] || !devices[b.deviceId]) return "Cabo ligado a uma interface inexistente.";
      if (used.has(cable.a) || used.has(cable.b) || cableIds.has(cable.id)) return "Interface ou cabo conectado mais de uma vez.";
      if (a.deviceId === b.deviceId) return "Cabo não pode ligar interfaces do mesmo equipamento.";
      const types = [devices[a.deviceId].type, devices[b.deviceId].type];
      const trunk = types.every(type => type === "switch") && a.mode === "trunk" && b.mode === "trunk";
      const access = types.includes("switch") && (types.includes("pc") || types.includes("router")) && a.mode === "access" && b.mode !== "trunk";
      const reverseAccess = types.includes("switch") && (types.includes("pc") || types.includes("router")) && b.mode === "access" && a.mode !== "trunk";
      if (!trunk && !access && !reverseAccess) return "Use portas access para PCs e R1, e uplinks trunk entre switches.";
      if (trunk) trunks++;
      used.add(cable.a); used.add(cable.b); cableIds.add(cable.id);
    }
    if (trunks > 1) return "Somente um enlace trunk é permitido; ciclos não são suportados.";
    return null;
  }

  function simulate(input, testLimits = {}) {
    const error = validate(input);
    if (error) return {status: "invalid", message: error, events: [], tables: {mac: [], arp: [], routes: []}};
    const cap = name => Math.min(LIMITS[name], Math.max(1, Number(testLimits[name]) || LIMITS[name]));
    const maxEvents = cap("events"), maxIterations = cap("iterations"), maxTime = cap("timeMs"), startTime = Date.now();
    const {devices, interfaces, connections, sourceId, destinationId} = input;
    const source = devices[sourceId], destination = devices[destinationId], router = Object.values(devices).find(device => device.type === "router");
    const linkAt = id => connections.find(link => link.a === id || link.b === id);
    const other = (link, id) => link.a === id ? link.b : link.a;
    const endpoint = interfaceId => {
      const link = linkAt(interfaceId), port = link && other(link, interfaceId);
      const switchId = port && interfaces[port].deviceId;
      return {interfaceId, link, port, switchId, vlan: switchId && Number(devices[switchId].config.vlans[port])};
    };
    const host = id => ({id, interfaceId: `${id}:eth0`, ip: devices[id].config.ip, mac: devices[id].config.mac, name: devices[id].name});
    const routerHost = iface => ({id: router.id, interfaceId: `${router.id}:${iface}`, ip: router.config[iface].ip, mac: router.config[iface].mac, name: `${router.name} ${interfaces[`${router.id}:${iface}`].name}`});
    const routes = router ? ["eth0", "eth1"].map(iface => ({routerId: router.id, interfaceId: `${router.id}:${iface}`, prefix: prefix(ipv4(router.config[iface].ip), mask(router.config[iface].mask)), ip: router.config[iface].ip, mask: router.config[iface].mask, connected: Boolean(linkAt(`${router.id}:${iface}`))})) : [];
    const mac = [], arp = [], events = [];
    const snapshots = () => ({mac: mac.map(row => ({...row})), arp: arp.map(row => ({...row})), routes: routes.map(row => ({...row}))});
    const limit = Symbol("limit"); let iterations = 0, blockedReason = null;
    function tick() { if (++iterations > maxIterations || Date.now() - startTime > maxTime) throw limit; }
    function emit(id, observation, explanation, options = {}) {
      tick(); if (events.length >= maxEvents) throw limit;
      events.push({id, eventId: `event-${events.length + 1}`, observation, explanation, focusId: options.focusId || null, interfaceIds: options.interfaceIds || [], connectionIds: options.connectionIds || [], incomingInterfaceId: options.incomingInterfaceId || null, outgoingInterfaceIds: options.outgoingInterfaceIds || [], fromId: options.fromId || null, toId: options.toId || null, frame: options.frame || null, packet: options.packet || null, routerDecision: options.routerDecision || null, outcome: options.outcome || null, tables: snapshots()});
    }
    function failure(id, observation, explanation, focusId, options = {}) { emit(id, observation, explanation, {...options, focusId, outcome: "failure"}); return finish("failure"); }
    function finish(status) { const last = events.at(-1); return {status, message: last?.observation || "Teste sem eventos.", events, tables: last?.tables || snapshots()}; }
    const ports = switchId => Object.keys(interfaces).filter(id => interfaces[id].deviceId === switchId && linkAt(id)).sort();
    const makeFrame = (kind, sender, receiver, tag = null) => ({id: `${kind}:${sender.interfaceId}:${receiver.interfaceId}`, source: sender.mac, destination: kind === "arp-request" ? BROADCAST : receiver.mac, type: kind === "ipv4" ? "IPv4" : "ARP", kind, label: kind === "arp-request" ? "ARP Request" : kind === "arp-reply" ? "ARP Reply" : "Frame IPv4", vlanTag: tag});
    function learn(switchId, sender, ingress, vlan, frame) {
      const row = {switchId, mac: sender.mac, port: interfaces[ingress].name, interfaceId: ingress, vlan};
      const existing = mac.find(item => item.switchId === switchId && item.vlan === vlan && item.mac === sender.mac);
      const verb = existing ? (existing.port === row.port ? "confirma" : "atualiza") : "aprende";
      if (existing) Object.assign(existing, row); else mac.push(row);
      emit("mac-learn", `${devices[switchId].name} ${verb} ${sender.mac} em ${row.port} na VLAN ${vlan}.`, "A tabela MAC associa Source MAC, porta de entrada e VLAN.", {focusId: switchId, incomingInterfaceId: ingress, interfaceIds: [ingress], frame});
    }
    function broadcast(sender, targetIp) {
      const origin = endpoint(sender.interfaceId), vlan = origin.vlan;
      if (!origin.link) return {found: null, reason: `${sender.name} não possui cabo para enviar o ARP Request.`};
      const frame = makeFrame("arp-request", sender, sender);
      emit("arp-request", `${sender.name} envia ARP Request para ${targetIp}.`, `O Destination MAC é broadcast na VLAN ${vlan}; o alvo ARP é ${targetIp}.`, {focusId: sender.id, outgoingInterfaceIds: [sender.interfaceId], interfaceIds: [sender.interfaceId, origin.port], connectionIds: [origin.link.id], fromId: sender.id, toId: origin.switchId, frame});
      const queue = [{switchId: origin.switchId, ingress: origin.port, via: null}], visited = new Set(); let found = null;
      while (queue.length) {
        tick(); const {switchId, ingress, via} = queue.shift();
        if (visited.has(switchId)) continue; visited.add(switchId);
        if (via) emit("trunk-in", `${devices[switchId].name} recebe ARP Request com tag VLAN ${vlan}.`, "A tag 802.1Q identifica a VLAN no trunk.", {focusId: switchId, incomingInterfaceId: ingress, interfaceIds: [ingress], connectionIds: [via.id], fromId: interfaces[other(via, ingress)].deviceId, toId: switchId, frame: makeFrame("arp-request", sender, sender, vlan)});
        learn(switchId, sender, ingress, vlan, makeFrame("arp-request", sender, sender, via ? vlan : null));
        const egress = ports(switchId).filter(port => port !== ingress && (interfaces[port].mode === "trunk" || Number(devices[switchId].config.vlans[port]) === vlan));
        emit("broadcast-decision", `${devices[switchId].name} avalia ${egress.length} saída(s) na VLAN ${vlan}.`, "Exclui a porta de entrada e portas access de outra VLAN.", {focusId: switchId, incomingInterfaceId: ingress, outgoingInterfaceIds: egress, interfaceIds: [ingress, ...egress], connectionIds: egress.map(port => linkAt(port).id), frame: makeFrame("arp-request", sender, sender, via ? vlan : null)});
        for (const port of egress) {
          const link = linkAt(port), peer = other(link, port), peerId = interfaces[peer].deviceId;
          if (interfaces[port].mode === "trunk") {
            if (!devices[switchId].config.allowedVlans.includes(vlan)) { blockedReason = `A VLAN ${vlan} não está admitida no uplink de ${devices[switchId].name}.`; emit("trunk-blocked", `${devices[switchId].name} interrompe ARP Request na VLAN ${vlan}.`, blockedReason, {focusId: switchId, outgoingInterfaceIds: [port], interfaceIds: [port], frame: makeFrame("arp-request", sender, sender, vlan)}); continue; }
            emit("trunk-out", `${devices[switchId].name} envia ARP Request com tag VLAN ${vlan} pelo trunk.`, "A tag 802.1Q identifica a VLAN durante a travessia.", {focusId: switchId, incomingInterfaceId: ingress, outgoingInterfaceIds: [port], interfaceIds: [port, peer], connectionIds: [link.id], fromId: switchId, toId: peerId, frame: makeFrame("arp-request", sender, sender, vlan)});
            if (!devices[peerId].config.allowedVlans.includes(vlan)) { blockedReason = `A VLAN ${vlan} não está admitida no uplink de ${devices[peerId].name}.`; emit("trunk-blocked", `${devices[peerId].name} interrompe ARP Request na VLAN ${vlan}.`, blockedReason, {focusId: peerId, incomingInterfaceId: peer, interfaceIds: [peer], connectionIds: [link.id], fromId: switchId, toId: peerId, frame: makeFrame("arp-request", sender, sender, vlan)}); continue; }
            queue.push({switchId: peerId, ingress: peer, via: link});
          } else {
            const candidate = devices[peerId].type === "router" ? {id: peerId, interfaceId: peer, ip: devices[peerId].config[interfaces[peer].name.toLowerCase()].ip, mac: devices[peerId].config[interfaces[peer].name.toLowerCase()].mac, name: `${devices[peerId].name} ${interfaces[peer].name}`} : host(peerId);
            emit("broadcast-out", `ARP Request sai por ${interfaces[port].name} de ${devices[switchId].name} para ${candidate.name}.`, "Na porta access, o frame segue sem tag 802.1Q.", {focusId: switchId, incomingInterfaceId: ingress, outgoingInterfaceIds: [port], interfaceIds: [port, peer], connectionIds: [link.id], fromId: switchId, toId: peerId, frame});
            const target = candidate.ip === targetIp && peer !== sender.interfaceId;
            const ignoredReason = targetIp === destination.config.ip ? `o IPv4 consultado é de ${destination.name}` : `o IPv4 consultado (${targetIp}) não é o seu`;
            emit(target ? "arp-target" : "arp-discarded", target ? `${candidate.name} reconhece o IPv4 consultado.` : `${candidate.name} recebe o ARP Request, mas não responde: ${ignoredReason}.`, target ? "A interface com o IPv4 procurado prepara ARP Reply." : `O IPv4 consultado não é ${candidate.ip}.`, {focusId: peerId, incomingInterfaceId: peer, interfaceIds: [port, peer], connectionIds: [link.id], fromId: switchId, toId: peerId, frame});
            if (target) found = candidate;
          }
        }
      }
      return {found, reason: blockedReason};
    }
    function unicast(kind, sender, receiver, packet, idPrefix = "") {
      const origin = endpoint(sender.interfaceId), target = endpoint(receiver.interfaceId), vlan = origin.vlan;
      if (!origin.link) return false;
      emit(kind === "arp-reply" ? "arp-reply" : idPrefix || "data", `${sender.name} envia ${makeFrame(kind, sender, receiver).label} a ${receiver.name}.`, "Na porta access, o frame sai sem tag 802.1Q.", {focusId: sender.id, outgoingInterfaceIds: [sender.interfaceId], interfaceIds: [sender.interfaceId, origin.port], connectionIds: [origin.link.id], fromId: sender.id, toId: origin.switchId, frame: makeFrame(kind, sender, receiver), packet});
      let switchId = origin.switchId, ingress = origin.port; const visited = new Set();
      while (true) {
        tick(); if (visited.has(switchId)) return false; visited.add(switchId);
        learn(switchId, sender, ingress, vlan, makeFrame(kind, sender, receiver, interfaces[ingress].mode === "trunk" ? vlan : null));
        const row = mac.find(item => item.switchId === switchId && item.vlan === vlan && item.mac === receiver.mac);
        if (!row) return false;
        const out = row.interfaceId, link = linkAt(out), peer = link && other(link, out), peerId = peer && interfaces[peer].deviceId;
        if (!link || out === ingress) return false;
        emit(kind === "arp-reply" ? "reply-decision" : "unicast-decision", `${devices[switchId].name} escolhe ${interfaces[out].name} para ${makeFrame(kind, sender, receiver).label}.`, "A decisão usa a tabela MAC deste switch e desta VLAN.", {focusId: switchId, incomingInterfaceId: ingress, outgoingInterfaceIds: [out], interfaceIds: [ingress, out], frame: makeFrame(kind, sender, receiver, interfaces[ingress].mode === "trunk" ? vlan : null), packet});
        if (interfaces[out].mode === "trunk") {
          if (!devices[switchId].config.allowedVlans.includes(vlan)) return false;
          emit(kind === "arp-reply" ? "reply-trunk" : "data-trunk", `${devices[switchId].name} encaminha ${makeFrame(kind, sender, receiver).label} pelo trunk com tag VLAN ${vlan}.`, "A tag identifica a VLAN no enlace.", {focusId: switchId, incomingInterfaceId: ingress, outgoingInterfaceIds: [out], interfaceIds: [out, peer], connectionIds: [link.id], fromId: switchId, toId: peerId, frame: makeFrame(kind, sender, receiver, vlan), packet});
          if (!devices[peerId].config.allowedVlans.includes(vlan)) return false;
          emit("trunk-in", `${devices[peerId].name} recebe ${makeFrame(kind, sender, receiver).label} com tag VLAN ${vlan}.`, "O pacote IPv4 mantém seus endereços.", {focusId: peerId, incomingInterfaceId: peer, interfaceIds: [peer], connectionIds: [link.id], fromId: switchId, toId: peerId, frame: makeFrame(kind, sender, receiver, vlan), packet});
          switchId = peerId; ingress = peer;
        } else {
          emit(kind === "arp-reply" ? "reply-forward" : "unicast-forward", `${devices[switchId].name} encaminha ${makeFrame(kind, sender, receiver).label} somente por ${interfaces[out].name}.`, "Na saída access, o frame é entregue sem tag 802.1Q.", {focusId: switchId, incomingInterfaceId: ingress, outgoingInterfaceIds: [out], interfaceIds: [out, peer], connectionIds: [link.id], fromId: switchId, toId: peerId, frame: makeFrame(kind, sender, receiver), packet});
          return peer === target.interfaceId;
        }
      }
    }
    function resolve(sender, targetIp, failureId, failureFocus) {
      blockedReason = null;
      const answer = broadcast(sender, targetIp);
      if (!answer.found) return {error: answer.reason || `ARP para ${targetIp} não recebeu resposta na VLAN de ${sender.name}.`, focusId: failureFocus || sender.id, failureId};
      if (answer.found.id === router?.id) {
        arp.push({owner: router.id, interfaceId: answer.found.interfaceId, ip: sender.ip, mac: sender.mac});
        emit("arp-learned", `${answer.found.name} aprende ${sender.ip} → ${sender.mac} pelo ARP Request.`, "R1 registra a origem do pedido na interface de entrada.", {focusId: router.id, incomingInterfaceId: answer.found.interfaceId, interfaceIds: [answer.found.interfaceId]});
      }
      if (!unicast("arp-reply", answer.found, sender, null)) return {error: "ARP Reply não chegou à origem.", focusId: answer.found.id, failureId};
      arp.push({owner: sender.id, interfaceId: sender.interfaceId, ip: targetIp, mac: answer.found.mac});
      emit("arp-learned", `${sender.name} associa ${targetIp} ao MAC ${answer.found.mac}.`, "A associação ARP passa a estar disponível para esta entrega local.", {focusId: sender.id, interfaceIds: [sender.interfaceId]});
      return {target: answer.found};
    }
    try {
      const src = host(sourceId), dst = host(destinationId);
      const initialPacket = {id: `ipv4:${src.interfaceId}:${dst.interfaceId}`, source: src.ip, destination: dst.ip, ttl: 64};
      const local = sameSubnet(ipv4(src.ip), ipv4(dst.ip), mask(source.config.mask));
      emit("local", `${src.name} compara ${dst.ip} com sua rede local.`, local ? "Pela máscara do próprio PC, o destino é local; ele tentará ARP para o destino." : "Pela máscara do próprio PC, o destino é remoto; o primeiro frame precisa de um gateway local.", {focusId: sourceId, interfaceIds: [src.interfaceId], packet: initialPacket});
      if (!endpoint(src.interfaceId).link) return failure("source-unplugged", `${src.name} não possui cabo para enviar o ARP Request.`, "Nenhum frame entrou no switch.", src.id, {interfaceIds: [src.interfaceId]});
      if (local) {
        const resolved = resolve(src, dst.ip, "arp-unanswered", endpoint(dst.interfaceId).switchId || endpoint(src.interfaceId).switchId);
        if (resolved.error) {
          const sourceEnd = endpoint(src.interfaceId), destinationEnd = endpoint(dst.interfaceId);
          const reason = !destinationEnd.link ? `${dst.name} não tem cabo conectado.` : destinationEnd.vlan !== sourceEnd.vlan ? `${dst.name} está na VLAN ${destinationEnd.vlan}; não há roteamento entre VLANs para uma tentativa local de ARP.` : sourceEnd.switchId !== destinationEnd.switchId && !connections.some(link => interfaces[link.a].mode === "trunk" && interfaces[link.b].mode === "trunk") ? "Os switches não possuem enlace trunk conectado." : resolved.error;
          return failure("arp-unanswered", `A resolução ARP para ${dst.name} não se concluiu.`, reason, resolved.focusId);
        }
        if (!unicast("ipv4", src, dst, initialPacket)) return failure("data-unanswered", "O frame IPv4 não chegou ao destino.", "O encaminhamento não encontrou a porta MAC do destino.", endpoint(src.interfaceId).switchId);
        emit("delivered", `O frame chega a ${dst.name} neste teste.`, "Entrega local concluída. Isto não simula um ping completo.", {focusId: dst.id, incomingInterfaceId: dst.interfaceId, interfaceIds: [dst.interfaceId, endpoint(dst.interfaceId).port], connectionIds: [endpoint(dst.interfaceId).link.id], fromId: endpoint(dst.interfaceId).switchId, toId: dst.id, frame: makeFrame("ipv4", src, dst), packet: initialPacket, outcome: "success"});
        return finish("success");
      }
      if (!source.config.gateway) return failure("gateway-missing", `${src.name} não tem gateway padrão configurado.`, "Destino remoto: sem próximo salto local, o primeiro frame não pode ser enviado.", src.id);
      if (!sameSubnet(ipv4(src.ip), ipv4(source.config.gateway), mask(source.config.mask))) return failure("gateway-offlink", `Gateway ${source.config.gateway} está fora da rede local de ${src.name}.`, "O host não pode resolver esse próximo salto diretamente nesta rede.", src.id);
      emit("next-hop", `${src.name} escolhe ${source.config.gateway} como próximo salto local.`, `ARP consultará o gateway, não o IP final ${dst.ip}.`, {focusId: src.id, interfaceIds: [src.interfaceId], packet: initialPacket});
      const gateway = resolve(src, source.config.gateway, "gateway-arp-failed", endpoint(src.interfaceId).switchId);
      if (gateway.error || gateway.target.id !== router?.id) return failure("gateway-arp-failed", `ARP do gateway ${source.config.gateway} não obteve resposta de R1.`, gateway.error || "O IPv4 informado não pertence a uma interface de R1 alcançável nesta VLAN.", endpoint(src.interfaceId).switchId);
      const ingress = gateway.target;
      if (!unicast("ipv4", src, ingress, initialPacket, "frame-in")) return failure("gateway-frame-failed", "Frame de entrada não chegou a R1.", "Confira cabos, porta Access e VLAN do gateway.", endpoint(src.interfaceId).switchId);
      const inFrame = makeFrame("ipv4", src, ingress);
      emit("router-receive", `R1 recebe e encerra o frame destinado a ${ingress.name}.`, `R1 retira o pacote IPv4 do frame de entrada. O Destination IP ainda é o de ${dst.name}.`, {focusId: router.id, incomingInterfaceId: ingress.interfaceId, interfaceIds: [ingress.interfaceId], frame: inFrame, packet: initialPacket, routerDecision: {input: ingress.interfaceId}});
      const selected = routes.find(route => route.interfaceId !== ingress.interfaceId && sameSubnet(ipv4(dst.ip), ipv4(route.ip), mask(route.mask)));
      if (!selected || !selected.connected) return failure("route-missing", `R1 não tem interface conectada à rede de ${dst.name}.`, "Somente rotas diretamente conectadas estão disponíveis nesta etapa.", router.id, {incomingInterfaceId: ingress.interfaceId, packet: initialPacket, routerDecision: {input: ingress.interfaceId, route: selected?.prefix || null}});
      const egress = routerHost(interfaces[selected.interfaceId].name.toLowerCase());
      const forwarded = {...initialPacket, ttl: initialPacket.ttl - 1};
      const decision = {input: ingress.interfaceId, route: selected.prefix, output: egress.interfaceId, ttlBefore: initialPacket.ttl, ttlAfter: forwarded.ttl};
      emit("route-decision", `R1 escolhe ${interfaces[egress.interfaceId].name} para ${selected.prefix}.`, "Rota diretamente conectada; o pacote mantém Source e Destination IP e o TTL diminui de 64 para 63.", {focusId: router.id, incomingInterfaceId: ingress.interfaceId, outgoingInterfaceIds: [egress.interfaceId], interfaceIds: [ingress.interfaceId, egress.interfaceId], packet: forwarded, routerDecision: decision});
      const resolvedDestination = resolve(egress, dst.ip, "destination-arp-failed", router.id);
      if (resolvedDestination.error || resolvedDestination.target.interfaceId !== dst.interfaceId) return failure("destination-arp-failed", `ARP de R1 para ${dst.ip} não recebeu resposta de ${dst.name}.`, resolvedDestination.error || "Confira cabo, porta Access e VLAN da rede de saída.", router.id, {outgoingInterfaceIds: [egress.interfaceId], packet: forwarded, routerDecision: decision});
      const outFrame = makeFrame("ipv4", egress, dst);
      emit("frame-out", `R1 cria novo frame ${egress.mac} → ${dst.mac}.`, `Source MAC é de ${interfaces[egress.interfaceId].name}; Destination MAC é de ${dst.name}. Os endereços IP permanecem, TTL ${forwarded.ttl}.`, {focusId: router.id, outgoingInterfaceIds: [egress.interfaceId], interfaceIds: [egress.interfaceId], frame: outFrame, packet: forwarded, routerDecision: decision});
      if (!unicast("ipv4", egress, dst, forwarded, "frame-out-send")) return failure("destination-frame-failed", "Frame de saída não chegou ao destino.", "Confira a rede de saída e a tabela MAC.", router.id, {packet: forwarded, routerDecision: decision});
      emit("delivered", `O novo frame chega a ${dst.name}.`, "R1 encaminhou entre duas redes por duas interfaces físicas. Isto não simula um ping completo.", {focusId: dst.id, incomingInterfaceId: dst.interfaceId, interfaceIds: [dst.interfaceId, endpoint(dst.interfaceId).port], connectionIds: [endpoint(dst.interfaceId).link.id], fromId: endpoint(dst.interfaceId).switchId, toId: dst.id, frame: outFrame, packet: forwarded, routerDecision: decision, outcome: "success"});
      return finish("success");
    } catch (caught) {
      if (caught !== limit) throw caught;
      const event = {id: "limit", eventId: `event-${Math.min(events.length + 1, maxEvents)}`, observation: "Simulação interrompida por limite de segurança", explanation: "O teste terminou sem marcar sucesso.", focusId: sourceId, interfaceIds: [], connectionIds: [], incomingInterfaceId: null, outgoingInterfaceIds: [], fromId: null, toId: null, frame: null, packet: null, routerDecision: null, outcome: "interrupted", tables: snapshots()};
      if (events.length >= maxEvents) events.length = maxEvents - 1;
      events.push(event); return finish("interrupted");
    }
  }
  return {LIMITS, ipv4, mask, prefix, validate, simulate};
});
