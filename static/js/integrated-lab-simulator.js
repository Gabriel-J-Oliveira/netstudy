/* Grafo e eventos da bancada; nenhuma decisão de encaminhamento fica na interface visual. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetStudyLabSimulator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const LIMITS = Object.freeze({events: 1024, history: 256, iterations: 4096, timeMs: 1000});
  const BROADCAST = "FF:FF:FF:FF:FF:FF";
  const ipv4 = value => {
    if (typeof value !== "string" || !/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return null;
    const bytes = value.split(".").map(Number);
    return bytes.every(byte => byte <= 255) ? bytes : null;
  };
  const mask = value => {
    const bytes = ipv4(value);
    return bytes && /^(?:1+0*|0{32})$/.test(bytes.map(byte => byte.toString(2).padStart(8, "0")).join("")) ? bytes : null;
  };
  const sameSubnet = (a, b, m) => a.every((byte, i) => (byte & m[i]) === (b[i] & m[i]));
  const prefix = (ip, m) => `${ip.map((byte, i) => byte & m[i]).join(".")}/${m.flatMap(byte => byte.toString(2).padStart(8, "0").split("")).filter(bit => bit === "1").length}`;
  const validMac = value => /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(value || "");

  function validate(input, options = {}) {
    if (!input || typeof input !== "object") return "Configuração ausente.";
    const {devices, interfaces, connections, sourceId, destinationId} = input;
    if (!devices || !interfaces || !Array.isArray(connections)) return "Grafo de equipamentos e cabos incompleto.";
    const ids = Object.keys(devices);
    if (!devices[sourceId] || (devices[sourceId].type !== "pc" && !(options.ping && devices[sourceId].type === "router"))) return "Escolha um PC de origem instalado.";
    if (!options.ping && (!devices[destinationId] || devices[destinationId].type !== "pc")) return "Escolha um PC de destino instalado.";
    if (!options.ping && sourceId === destinationId) return "Origem e destino precisam ser PCs diferentes.";
    const ips = new Set(), macs = new Set();
    const unique = (ip, mac, owner) => {
      if (ips.has(ip)) return `IPv4 duplicado: ${ip}.`;
      if (macs.has(mac.toUpperCase())) return `MAC duplicado em ${owner}.`;
      ips.add(ip); macs.add(mac.toUpperCase()); return null;
    };
    for (const id of ids) {
      const device = devices[id];
      if (device.type === "pc") {
        const unassigned=device.config?.ip===""&&device.config?.mask===""&&device.config?.dhcpClient&&id!==sourceId&&id!==destinationId;
        if ((!unassigned&&(!ipv4(device.config?.ip)||!mask(device.config?.mask))) || (device.config?.gateway && !ipv4(device.config.gateway))) return `Configuração IPv4 inválida em ${device.name || id}.`;
        if (!validMac(device.config?.mac)) return `MAC inválido em ${device.name || id}.`;
        if(unassigned){if(macs.has(device.config.mac.toUpperCase()))return `MAC duplicado em ${device.name || id}.`;macs.add(device.config.mac.toUpperCase());}
        else {const error = unique(device.config.ip, device.config.mac, device.name || id); if (error) return error;}
      } else if (device.type === "router") {
        if (device.interfaces.length !== 2) return `${device.name || id} deve ter Eth0 e Eth1.`;
        const nat = device.config?.nat;
        if (nat !== undefined && (!nat || Object.keys(nat).sort().join(",") !== "enabled,inside,outside,sourceMask,sourceNetwork" ||
            !["", "eth0", "eth1"].includes(nat.inside) || !["", "eth0", "eth1"].includes(nat.outside) ||
            (nat.inside && nat.inside === nat.outside) || typeof nat.enabled !== "boolean" ||
            !(((nat.sourceNetwork === "" || ipv4(nat.sourceNetwork)) && (nat.sourceMask === "" || mask(nat.sourceMask)) &&
              (nat.sourceNetwork === "" || nat.sourceMask === "")) ||
              (ipv4(nat.sourceNetwork) && mask(nat.sourceMask) && prefix(ipv4(nat.sourceNetwork), mask(nat.sourceMask)).split("/")[0] === nat.sourceNetwork))))
          return `Configuração NAT inválida em ${device.name || id}.`;
        if (device.config?.staticRoutes !== undefined) {
          if (!Array.isArray(device.config.staticRoutes) || device.config.staticRoutes.length > 64) return `Rotas estáticas inválidas em ${device.name || id}.`;
          const seenRoutes = new Set();
          for (const route of device.config.staticRoutes) {
            if (!route || Object.keys(route).sort().join(",") !== "destination,mask,nextHop" || !ipv4(route.destination) || !mask(route.mask) || !ipv4(route.nextHop) || prefix(ipv4(route.destination), mask(route.mask)).split("/")[0] !== route.destination) return `Rota estática inválida em ${device.name || id}.`;
            const key = `${route.destination}/${route.mask}`;
            if (seenRoutes.has(key)) return `Rota estática duplicada em ${device.name || id}.`;
            seenRoutes.add(key);
          }
        }
        for (const iface of ["eth0", "eth1"]) {
          const config = device.config?.[iface];
          if (!(config?.ip === "" && config?.mask === "") && (!ipv4(config?.ip) || !mask(config?.mask))) return `Configuração IPv4 inválida em ${device.name || id} ${iface.toUpperCase()}.`;
          if (!validMac(config?.mac)) return `MAC inválido em ${device.name || id} ${iface.toUpperCase()}.`;
          if (config.ip === "" && config.mask === "") { if (macs.has(config.mac.toUpperCase())) return `MAC duplicado em ${device.name || id} ${iface}.`; macs.add(config.mac.toUpperCase()); }
          else { const error = unique(config.ip, config.mac, `${device.name || id} ${iface}`); if (error) return error; }
        }
      } else if (device.type === "switch") {
        for (const port of device.interfaces) if (interfaces[port]?.mode === "access" && (!Number.isInteger(Number(device.config?.vlans?.[port])) || Number(device.config.vlans[port]) < 1 || Number(device.config.vlans[port]) > 4094)) return `VLAN inválida em ${port}.`;
        const allowed = device.config?.allowedVlans;
        if (!Array.isArray(allowed) || allowed.some(v => !Number.isInteger(Number(v)) || Number(v) < 1 || Number(v) > 4094) || new Set(allowed).size !== allowed.length) return `Lista de VLANs do trunk inválida em ${device.name || id}.`;
      } else return `Tipo de equipamento inválido: ${id}.`;
    }
    const used = new Set(), cableIds = new Set();
    for (const cable of connections) {
      const a = interfaces[cable.a], b = interfaces[cable.b];
      if (!a || !b || !devices[a.deviceId] || !devices[b.deviceId]) return "Cabo ligado a uma interface inexistente.";
      if (used.has(cable.a) || used.has(cable.b) || cableIds.has(cable.id)) return "Interface ou cabo conectado mais de uma vez.";
      if (a.deviceId === b.deviceId) return "Cabo não pode ligar interfaces do mesmo equipamento.";
      const types = [devices[a.deviceId].type, devices[b.deviceId].type];
      const switchLink = types.every(type => type === "switch");
      const trunk = switchLink && a.mode === "trunk" && b.mode === "trunk";
      const access = types.includes("switch") && (types.includes("pc") || types.includes("router")) && a.mode === "access" && b.mode !== "trunk";
      const reverseAccess = types.includes("switch") && (types.includes("pc") || types.includes("router")) && b.mode === "access" && a.mode !== "trunk";
      const routed = types.every(type => type === "router") && a.mode === "routed" && b.mode === "routed";
      if (!switchLink && !access && !reverseAccess && !routed) return "Use portas access, uplinks trunk ou interfaces roteadas compatíveis.";
      used.add(cable.a); used.add(cable.b); cableIds.add(cable.id);
    }
    return null;
  }

  function layer2Path(input, fromInterfaceId, toInterfaceId) {
    const {devices,interfaces,connections}=input;
    if(!interfaces[fromInterfaceId]||!interfaces[toInterfaceId])return null;
    const linkAt=id=>connections.find(link=>(link.a===id||link.b===id)&&![link.a,link.b].some(port=>
      devices[interfaces[port]?.deviceId]?.config?.portSettings?.[port]?.shutdown));
    const other=(link,id)=>link.a===id?link.b:link.a;
    const first=linkAt(fromInterfaceId);if(!first)return null;
    const ingress=other(first,fromInterfaceId),firstDevice=devices[interfaces[ingress]?.deviceId];
    if(firstDevice?.type!=="switch"||interfaces[ingress].mode!=="access")return null;
    const vlan=Number(firstDevice.config.vlans[ingress]);
    const queue=[{ingress,hops:[first.id]}],seen=new Set();
    while(queue.length){
      const item=queue.shift(),sw=devices[interfaces[item.ingress].deviceId],key=`${sw.id}:${item.ingress}:${vlan}`;
      if(seen.has(key))continue;seen.add(key);
      for(const port of sw.interfaces){
        if(port===item.ingress)continue;
        const cable=linkAt(port);if(!cable)continue;
        const peer=other(cable,port),peerDevice=devices[interfaces[peer].deviceId],mode=interfaces[port].mode;
        if(mode==="access"&&Number(sw.config.vlans[port])!==vlan)continue;
        if(mode==="trunk"&&(!sw.config.allowedVlans.includes(vlan)||peerDevice.type!=="switch"||interfaces[peer].mode!=="trunk"||!peerDevice.config.allowedVlans.includes(vlan)))continue;
        if(peer===toInterfaceId&&mode==="access")return {vlan,connectionIds:[...item.hops,cable.id]};
        if(peerDevice.type==="switch"&&((mode==="trunk"&&interfaces[peer].mode==="trunk")||
          (mode==="access"&&interfaces[peer].mode==="access"&&Number(peerDevice.config.vlans[peer])===vlan)))
          queue.push({ingress:peer,hops:[...item.hops,cable.id]});
      }
    }
    return null;
  }

  function simulate(input, testLimits = {}) {
    const error = validate(input);
    if (error) return {status: "invalid", message: error, events: [], tables: {mac: [], arp: [], routes: []}};
    const routers = Object.values(input.devices).filter(device => device.type === "router");
    if (routers.length > 1 || routers.some(device => device.config.staticRoutes?.length || device.config.nat)) {
      const result = ping(input, input.devices[input.destinationId].config.ip, testLimits);
      return {...result, status: result.status === "reply" ? "success" : result.status === "interrupted" || result.status === "invalid" ? result.status : "failure"};
    }
    const cap = name => Math.min(LIMITS[name], Math.max(1, Number(testLimits[name]) || LIMITS[name]));
    const maxEvents = cap("events"), maxIterations = cap("iterations"), maxTime = cap("timeMs"), startTime = Date.now();
    const {devices, interfaces, connections, sourceId, destinationId} = input;
    const source = devices[sourceId], destination = devices[destinationId]; let router = null;
    const linkAt = id => connections.find(link => link.a === id || link.b === id);
    const other = (link, id) => link.a === id ? link.b : link.a;
    const endpoint = interfaceId => {
      const link = linkAt(interfaceId), port = link && other(link, interfaceId);
      const switchId = port && interfaces[port].deviceId;
      return {interfaceId, link, port, switchId, vlan: switchId && Number(devices[switchId].config.vlans[port])};
    };
    const host = id => ({id, interfaceId: `${id}:eth0`, ip: devices[id].config.ip, mac: devices[id].config.mac, name: devices[id].name});
    const routerHost = iface => ({id: router.id, interfaceId: `${router.id}:${iface}`, ip: router.config[iface].ip, mac: router.config[iface].mac, name: `${router.name} ${interfaces[`${router.id}:${iface}`].name}`});
    const routes = Object.values(devices).filter(device => device.type === "router").flatMap(device => ["eth0", "eth1"].filter(iface => ipv4(device.config[iface].ip) && mask(device.config[iface].mask)).map(iface => ({routerId: device.id, interfaceId: `${device.id}:${iface}`, prefix: prefix(ipv4(device.config[iface].ip), mask(device.config[iface].mask)), ip: device.config[iface].ip, mask: device.config[iface].mask, connected: Boolean(linkAt(`${device.id}:${iface}`))})));
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
            if (interfaces[peer].mode !== "trunk") { blockedReason = `A porta remota de ${devices[peerId].name} não está em trunk.`; continue; }
            if (!devices[peerId].config.allowedVlans.includes(vlan)) { blockedReason = `A VLAN ${vlan} não está admitida no uplink de ${devices[peerId].name}.`; emit("trunk-blocked", `${devices[peerId].name} interrompe ARP Request na VLAN ${vlan}.`, blockedReason, {focusId: peerId, incomingInterfaceId: peer, interfaceIds: [peer], connectionIds: [link.id], fromId: switchId, toId: peerId, frame: makeFrame("arp-request", sender, sender, vlan)}); continue; }
            queue.push({switchId: peerId, ingress: peer, via: link});
          } else {
            if (devices[peerId].type === "switch") {
              if (interfaces[peer].mode === "access" && Number(devices[peerId].config.vlans[peer]) === vlan) queue.push({switchId:peerId,ingress:peer,via:null});
              continue;
            }
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
          if (interfaces[peer].mode !== "trunk" || !devices[peerId].config.allowedVlans.includes(vlan)) return false;
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
      if (devices[answer.found.id]?.type === "router") {
        arp.push({owner: answer.found.id, interfaceId: answer.found.interfaceId, ip: sender.ip, mac: sender.mac});
        emit("arp-learned", `${answer.found.name} aprende ${sender.ip} → ${sender.mac} pelo ARP Request.`, "O roteador registra a origem do pedido na interface de entrada.", {focusId: answer.found.id, incomingInterfaceId: answer.found.interfaceId, interfaceIds: [answer.found.interfaceId]});
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
      if (gateway.error || devices[gateway.target.id]?.type !== "router") return failure("gateway-arp-failed", `ARP do gateway ${source.config.gateway} não obteve resposta de um roteador.`, gateway.error || "O IPv4 informado não pertence a uma interface de roteador alcançável nesta VLAN.", endpoint(src.interfaceId).switchId);
      router = devices[gateway.target.id];
      const ingress = gateway.target;
      if (!unicast("ipv4", src, ingress, initialPacket, "frame-in")) return failure("gateway-frame-failed", `Frame de entrada não chegou a ${router.name}.`, "Confira cabos, porta Access e VLAN do gateway.", endpoint(src.interfaceId).switchId);
      const inFrame = makeFrame("ipv4", src, ingress);
      emit("router-receive", `${router.name} recebe e encerra o frame destinado a ${ingress.name}.`, `${router.name} retira o pacote IPv4 do frame de entrada. O Destination IP ainda é o de ${dst.name}.`, {focusId: router.id, incomingInterfaceId: ingress.interfaceId, interfaceIds: [ingress.interfaceId], frame: inFrame, packet: initialPacket, routerDecision: {input: ingress.interfaceId}});
      const selected = routes.find(route => route.routerId === router.id && route.interfaceId !== ingress.interfaceId && sameSubnet(ipv4(dst.ip), ipv4(route.ip), mask(route.mask)));
      if (!selected || !selected.connected) return failure("route-missing", `${router.name} não tem interface conectada à rede de ${dst.name}.`, "Somente rotas diretamente conectadas estão disponíveis nesta etapa.", router.id, {incomingInterfaceId: ingress.interfaceId, packet: initialPacket, routerDecision: {input: ingress.interfaceId, route: selected?.prefix || null}});
      const egress = routerHost(interfaces[selected.interfaceId].name.toLowerCase());
      const forwarded = {...initialPacket, ttl: initialPacket.ttl - 1};
      const decision = {input: ingress.interfaceId, route: selected.prefix, output: egress.interfaceId, ttlBefore: initialPacket.ttl, ttlAfter: forwarded.ttl};
      emit("route-decision", `${router.name} escolhe ${interfaces[egress.interfaceId].name} para ${selected.prefix}.`, "Rota diretamente conectada; o pacote mantém Source e Destination IP e o TTL diminui de 64 para 63.", {focusId: router.id, incomingInterfaceId: ingress.interfaceId, outgoingInterfaceIds: [egress.interfaceId], interfaceIds: [ingress.interfaceId, egress.interfaceId], packet: forwarded, routerDecision: decision});
      const resolvedDestination = resolve(egress, dst.ip, "destination-arp-failed", router.id);
      if (resolvedDestination.error || resolvedDestination.target.interfaceId !== dst.interfaceId) return failure("destination-arp-failed", `ARP de ${router.name} para ${dst.ip} não recebeu resposta de ${dst.name}.`, resolvedDestination.error || "Confira cabo, porta Access e VLAN da rede de saída.", router.id, {outgoingInterfaceIds: [egress.interfaceId], packet: forwarded, routerDecision: decision});
      const outFrame = makeFrame("ipv4", egress, dst);
      emit("frame-out", `${router.name} cria novo frame ${egress.mac} → ${dst.mac}.`, `Source MAC é de ${interfaces[egress.interfaceId].name}; Destination MAC é de ${dst.name}. Os endereços IP permanecem, TTL ${forwarded.ttl}.`, {focusId: router.id, outgoingInterfaceIds: [egress.interfaceId], interfaceIds: [egress.interfaceId], frame: outFrame, packet: forwarded, routerDecision: decision});
      if (!unicast("ipv4", egress, dst, forwarded, "frame-out-send")) return failure("destination-frame-failed", "Frame de saída não chegou ao destino.", "Confira a rede de saída e a tabela MAC.", router.id, {packet: forwarded, routerDecision: decision});
      emit("delivered", `O novo frame chega a ${dst.name}.`, `${router.name} encaminhou entre duas redes por duas interfaces físicas. Isto não simula um ping completo.`, {focusId: dst.id, incomingInterfaceId: dst.interfaceId, interfaceIds: [dst.interfaceId, endpoint(dst.interfaceId).port], connectionIds: [endpoint(dst.interfaceId).link.id], fromId: endpoint(dst.interfaceId).switchId, toId: dst.id, frame: outFrame, packet: forwarded, routerDecision: decision, outcome: "success"});
      return finish("success");
    } catch (caught) {
      if (caught !== limit) throw caught;
      const event = {id: "limit", eventId: `event-${Math.min(events.length + 1, maxEvents)}`, observation: "Simulação interrompida por limite de segurança", explanation: "O teste terminou sem marcar sucesso.", focusId: sourceId, interfaceIds: [], connectionIds: [], incomingInterfaceId: null, outgoingInterfaceIds: [], fromId: null, toId: null, frame: null, packet: null, routerDecision: null, outcome: "interrupted", tables: snapshots()};
      if (events.length >= maxEvents) events.length = maxEvents - 1;
      events.push(event); return finish("interrupted");
    }
  }
  function ping(input, destinationIp, options = {}) {
    const error = validate(input, {ping: true});
    if (error || !ipv4(destinationIp)) return {status: "invalid", message: error || "IPv4 de destino inválido.", events: [], tables: {mac: [], arp: [], routes: []}};
    const ttl = options.ttl === undefined ? 64 : Number(options.ttl);
    if (!Number.isInteger(ttl) || ttl < 1 || ttl > 255) return {status: "invalid", message: "TTL deve estar entre 1 e 255.", events: [], tables: {mac: [], arp: [], routes: []}};
    const {devices, interfaces, connections, sourceId} = input;
    const source = devices[sourceId], events = [], arp = [], mac = [], natTable = [];
    const maxEvents = Math.min(LIMITS.events, Math.max(1, Number(options.events) || LIMITS.events));
    const maxIterations = Math.min(LIMITS.iterations, Math.max(1, Number(options.iterations) || LIMITS.iterations));
    const maxTime = Math.min(LIMITS.timeMs, Math.max(1, Number(options.timeMs) || LIMITS.timeMs));
    const started = Date.now(), limit = Symbol("ping-limit"); let iterations = 0, blockedTrunk = null;
    const tick = () => { if (++iterations > maxIterations || Date.now() - started > maxTime) throw limit; };
    const linkAt = port => connections.find(link => link.a === port || link.b === port);
    const other = (link, port) => link.a === port ? link.b : link.a;
    const iface = port => interfaces[port];
    const owner = port => devices[iface(port).deviceId];
    const endpoints = Object.values(devices).flatMap(device => device.type === "pc"
      ? [{deviceId: device.id, interfaceId: device.interfaces[0], ip: device.config.ip, mac: device.config.mac, name: device.name}]
      : device.type === "router" ? device.interfaces.map((id, index) => {
        const config = device.config[`eth${index}`];
        return {deviceId: device.id, interfaceId: id, ip: config.ip, mac: config.mac, name: `${device.name} ${iface(id).name}`};
      }) : []);
    const atIp = ip => endpoints.find(endpoint => endpoint.ip && endpoint.ip === ip);
    const routes = endpoints.filter(endpoint => devices[endpoint.deviceId].type === "router" && endpoint.ip && mask(devices[endpoint.deviceId].config[iface(endpoint.interfaceId).name.toLowerCase()].mask))
      .map(endpoint => {
        const configured = devices[endpoint.deviceId].config[iface(endpoint.interfaceId).name.toLowerCase()];
        return {routerId: endpoint.deviceId, interfaceId: endpoint.interfaceId, prefix: prefix(ipv4(endpoint.ip), mask(configured.mask)), ip: endpoint.ip, mask: configured.mask, connected: Boolean(linkAt(endpoint.interfaceId)), type: "connected", nextHop: null};
      });
    for (const device of Object.values(devices).filter(item => item.type === "router")) {
      for (const configured of device.config.staticRoutes || []) {
        const transit = routes.filter(route => route.routerId === device.id && route.type === "connected" && route.connected &&
          sameSubnet(ipv4(configured.nextHop), ipv4(route.ip), mask(route.mask)) && configured.nextHop !== route.ip)
          .sort((a, b) => Number(b.prefix.split("/")[1]) - Number(a.prefix.split("/")[1]))[0];
        routes.push({routerId: device.id, interfaceId: transit?.interfaceId || null,
          prefix: prefix(ipv4(configured.destination), mask(configured.mask)), ip: configured.destination,
          mask: configured.mask, nextHop: configured.nextHop, connected: Boolean(transit), type: "static"});
      }
    }
    const snapshot = () => ({mac: mac.map(row => ({...row})), arp: arp.map(row => ({...row})), routes: routes.map(row => ({...row})), nat: natTable.map(row => ({...row}))});
    function emit(id, observation, explanation, fields = {}) {
      tick(); if (events.length >= maxEvents) throw limit;
      events.push({id, eventId: `event-${events.length + 1}`, observation, explanation, focusId: fields.focusId || null,
        interfaceIds: fields.interfaceIds || [], connectionIds: fields.connectionIds || [], incomingInterfaceId: fields.incomingInterfaceId || null,
        outgoingInterfaceIds: fields.outgoingInterfaceIds || [], fromId: fields.fromId || null, toId: fields.toId || null,
        frame: fields.frame ? {...fields.frame} : null, packet: fields.packet ? {...fields.packet} : null,
        routerDecision: fields.routerDecision ? {...fields.routerDecision} : null,
        natTranslation: fields.natTranslation ? {before: {...fields.natTranslation.before}, after: {...fields.natTranslation.after}} : null,
        outcome: fields.outcome || null, tables: snapshot()});
    }
    const finish = status => ({status, message: events.at(-1)?.observation || "Ping sem eventos.", events, tables: snapshot()});
    function stop(status, message, focusId, packet = null) {
      emit(status, message, status === "timeout" ? "Echo Reply não chegou à origem; a causa deve ser investigada no ponto indicado." :
        status === "ttl-expired" ? "O roteador descartou o pacote quando o TTL chegou a zero." : "Não há caminho de Camada 3 aplicável nesta configuração.",
      {focusId, packet, outcome: "failure"});
      return {status};
    }
    function path(from, to) {
      blockedTrunk = null;
      if (!from || !to || !linkAt(from.interfaceId) || !linkAt(to.interfaceId)) return null;
      const first = linkAt(from.interfaceId), ingress = other(first, from.interfaceId);
      if (ingress === to.interfaceId && owner(ingress).type === "router" && owner(from.interfaceId).type === "router")
        return {hops: [{link: first, from: from.interfaceId, to: ingress, tag: null}], vlan: null};
      if (owner(ingress).type !== "switch" || iface(ingress).mode !== "access") return null;
      const vlan = Number(owner(ingress).config.vlans[ingress]);
      const queue = [{switchId: owner(ingress).id, ingress, hops: [{link: first, from: from.interfaceId, to: ingress, tag: null}]}], seen = new Set();
      while (queue.length) {
        tick(); const item = queue.shift(), key = `${item.switchId}:${item.ingress}:${vlan}`;
        if (seen.has(key)) continue; seen.add(key);
        const sw = devices[item.switchId];
        for (const port of sw.interfaces) {
          const link = linkAt(port); if (!link || port === item.ingress) continue;
          const peer = other(link, port), peerDevice = owner(peer), mode = iface(port).mode;
          if (mode === "trunk") {
            if (peerDevice.type !== "switch" || iface(peer).mode !== "trunk" ||
                !sw.config.allowedVlans.includes(vlan) || !peerDevice.config.allowedVlans.includes(vlan)) {
              blockedTrunk ||= {switchId: sw.id, port, linkId: link.id, vlan};
              continue;
            }
            queue.push({switchId: peerDevice.id, ingress: peer, hops: [...item.hops, {link, from: port, to: peer, tag: vlan}]});
          } else if (mode === "access" && Number(sw.config.vlans[port]) === vlan) {
            const hop = {link, from: port, to: peer, tag: null};
            if (peer === to.interfaceId) return {hops: [...item.hops, hop], vlan};
            if (peerDevice.type === "switch" && iface(peer).mode === "access" && Number(peerDevice.config.vlans[peer]) === vlan)
              queue.push({switchId: peerDevice.id, ingress: peer, hops: [...item.hops, hop]});
          }
        }
      }
      return null;
    }
    function learn(switchId, sender, ingress, vlan, frame) {
      const existing = mac.find(row => row.switchId === switchId && row.mac === sender.mac && row.vlan === vlan);
      const row = {switchId, mac: sender.mac, port: iface(ingress).name, interfaceId: ingress, vlan};
      if (existing) Object.assign(existing, row); else mac.push(row);
      emit("mac-learn", `${devices[switchId].name} ${existing ? "atualiza" : "aprende"} ${sender.mac} em ${row.port} na VLAN ${vlan}.`,
        "O switch usa MAC, interface e VLAN para o próximo encaminhamento.", {focusId: switchId, incomingInterfaceId: ingress, interfaceIds: [ingress], frame});
    }
    function sendFrame(from, to, kind, packet = null, knownPath = null) {
      const route = knownPath || path(from, to);
      if (!route) {
        if (blockedTrunk) emit("trunk-blocked", `A VLAN ${blockedTrunk.vlan} não atravessou o trunk.`,
          "Confira o modo e as VLANs permitidas nas duas pontas.", {focusId: blockedTrunk.switchId, interfaceIds: [blockedTrunk.port], connectionIds: [blockedTrunk.linkId], packet});
        return false;
      }
      const label = kind === "arp-request" ? "ARP Request" : kind === "arp-reply" ? "ARP Reply" : kind === "echo-request" ? "ICMP Echo Request" : kind === "time-exceeded" ? "ICMP Time Exceeded" : kind === "destination-unreachable" ? "ICMP Destination Unreachable" : "ICMP Echo Reply";
      const base = {id: `${kind}:${from.interfaceId}:${to.interfaceId}:${events.length + 1}`, source: from.mac,
        destination: kind === "arp-request" ? BROADCAST : to.mac, type: kind.startsWith("arp") ? "ARP" : "IPv4", kind, label};
      for (const hop of route.hops) {
        const recipient = owner(hop.to), sender = owner(hop.from), frame = {...base, vlanTag: hop.tag};
        if (sender.type === "switch" && kind !== "arp-request") {
          const known = mac.find(row => row.switchId === sender.id && row.vlan === route.vlan && row.mac === to.mac);
          emit(known ? "switch-decision" : "unknown-unicast", known
            ? `${sender.name} consulta a tabela MAC e escolhe ${iface(known.interfaceId).name} para ${to.mac}.`
            : `${sender.name} ainda não conhece ${to.mac} e faz flooding na VLAN ${route.vlan}.`,
          known ? "A saída corresponde ao MAC de destino aprendido nesta VLAN." : "A intenção continua sendo alcançar um MAC específico.",
          {focusId: sender.id, outgoingInterfaceIds: [hop.from], interfaceIds: [hop.from], frame, packet});
          if (known && known.interfaceId !== hop.from) return false;
        }
        emit(kind === "arp-request" ? "arp-request" : kind === "arp-reply" ? "arp-reply" : hop.tag ? "data-trunk" : kind,
          `${sender.name} envia ${label} a ${recipient.name}${hop.tag ? ` com tag VLAN ${hop.tag}` : ""}.`,
          kind === "arp-request" ? `ARP procura ${to.ip} por broadcast na VLAN ${route.vlan}.` :
            hop.tag ? "O VLAN ID mantém este frame no contexto da VLAN durante o trunk." : "O frame segue pela interface selecionada neste enlace.",
          {focusId: recipient.id, interfaceIds: [hop.from, hop.to], incomingInterfaceId: hop.to, connectionIds: [hop.link.id], fromId: sender.id, toId: recipient.id, frame, packet});
        if (recipient.type === "switch") learn(recipient.id, from, hop.to, route.vlan, frame);
      }
      return true;
    }
    function remember(holder, target) {
      const row = arp.find(item => item.owner === holder.deviceId && item.interfaceId === holder.interfaceId && item.ip === target.ip);
      if (row) row.mac = target.mac;
      else arp.push({owner: holder.deviceId, interfaceId: holder.interfaceId, ip: target.ip, mac: target.mac});
      emit("arp-learned", `${holder.name} associa ${target.ip} ao MAC ${target.mac}.`, "Entrada ARP disponível a partir deste evento.",
        {focusId: holder.deviceId, interfaceIds: [holder.interfaceId]});
    }
    function resolve(from, to, packet, targetIp = to?.ip || packet.destination) {
      if (to && arp.some(row => row.owner === from.deviceId && row.interfaceId === from.interfaceId && row.ip === to.ip && row.mac === to.mac)) {
        emit("arp-cache-hit", `${from.name} usa a associação ARP já aprendida para ${to.ip}.`, "Nenhum novo ARP Request é necessário.",
          {focusId: from.deviceId, interfaceIds: [from.interfaceId], packet});
        return true;
      }
      emit("arp-request", `${from.name} procura ${targetIp} por ARP.`, "O Request usa broadcast no domínio VLAN de saída.",
        {focusId: from.deviceId, interfaceIds: [from.interfaceId], frame: {id: `arp-request:${events.length + 1}`, source: from.mac, destination: BROADCAST, type: "ARP", kind: "arp-request", label: "ARP Request", vlanTag: null}, packet});
      if (!to) return false;
      const forward = path(from, to);
      if (!sendFrame(from, to, "arp-request", null, forward)) return false;
      remember(to, from);
      const backward = path(to, from);
      if (!sendFrame(to, from, "arp-reply", null, backward)) return false;
      remember(from, to);
      return true;
    }
    const routeFrom = (routerId, targetIp) => routes.filter(route => route.routerId === routerId && route.connected &&
      sameSubnet(ipv4(targetIp), ipv4(route.ip), mask(route.mask)))
      .sort((a, b) => Number(b.prefix.split("/")[1]) - Number(a.prefix.split("/")[1]) || Number(a.type !== "connected") - Number(b.type !== "connected"))[0];
    const icmpLabel = type => type === "echo-request" ? "Echo Request" : type === "echo-reply" ? "Echo Reply" : type === "time-exceeded" ? "Time Exceeded" : "Destination Unreachable";
    function deliver(senderId, sourceIp, targetIp, type, relatedPacket = null) {
      const senderDevice = devices[senderId]; let target = atIp(targetIp);
      let from = senderDevice.type === "pc" ? endpoints.find(endpoint => endpoint.deviceId === senderId) : atIp(sourceIp);
      let incomingFrame = null;
      const packet = {id: `icmp:${type}:${senderId}:${targetIp}`, source: sourceIp || "", destination: targetIp,
        ttl: type === "time-exceeded" || type === "destination-unreachable" ? 64 : ttl, protocol: "ICMP", icmpType: type,
        icmpId: relatedPacket?.icmpId || 1};
      emit(`${type}-start`, `${senderDevice.name} cria ICMP ${icmpLabel(type)} para ${targetIp}.`,
        "O destino IPv4 do pacote permanece durante cada trecho; o MAC do frame pode mudar no roteador.",
        {focusId: senderId, interfaceIds: from ? [from.interfaceId] : [], packet});
      if (senderDevice.type === "pc") {
        if (!linkAt(from.interfaceId)) return stop("destination-unreachable", `${senderDevice.name} está sem enlace operacional.`, senderId, packet);
        const local = sameSubnet(ipv4(from.ip), ipv4(targetIp), mask(senderDevice.config.mask));
        const nextIp = local ? targetIp : senderDevice.config.gateway;
        if (!local && (!nextIp || !sameSubnet(ipv4(from.ip), ipv4(nextIp), mask(senderDevice.config.mask))))
          return stop("destination-unreachable", `${senderDevice.name} não tem gateway local válido para ${targetIp}.`, senderId, packet);
        const next = atIp(nextIp);
        if (!resolve(from, next, packet, nextIp)) return stop("timeout", `ARP para ${nextIp} não obteve resposta.`, senderId, packet);
        if (!sendFrame(from, next, type, packet)) return stop("timeout", `O primeiro frame não chegou a ${nextIp}.`, senderId, packet);
        if (next?.ip === targetIp) return {status: "delivered", packet};
        if (devices[next.deviceId].type !== "router") return stop("destination-unreachable", `${next.name} não encaminha pacotes de Camada 3.`, next.deviceId, packet);
        incomingFrame = {id: `${type}:in:${next.interfaceId}`, source: from.mac, destination: next.mac, type: "IPv4", kind: type,
          label: `ICMP ${icmpLabel(type)}`, vlanTag: null};
        from = next;
      } else {
        const selected = routeFrom(senderId, targetIp);
        if (!selected) return stop("destination-unreachable", `${senderDevice.name} não tem rota para ${targetIp}.`, senderId, packet);
        if (!sourceIp) packet.source = endpoints.find(endpoint => endpoint.interfaceId === selected.interfaceId).ip;
        from = atIp(packet.source);
      }
      const visited = new Set();
      while (from && devices[from.deviceId].type === "router") {
        tick();
        const router = devices[from.deviceId];
        if (visited.has(`${router.id}:${from.interfaceId}:${packet.ttl}`)) return stop("destination-unreachable", `Loop de roteamento detectado em ${router.name}.`, router.id, packet);
        visited.add(`${router.id}:${from.interfaceId}:${packet.ttl}`);
        if (senderId !== router.id) {
          emit("router-receive", `${router.name} recebe o frame destinado ao próximo salto.`, `O Destination IP neste frame é ${packet.destination}.`,
            {focusId: router.id, incomingInterfaceId: from.interfaceId, interfaceIds: [from.interfaceId], packet: {...packet}, frame: incomingFrame});
          const reverse = natTable.find(row => row.routerId === router.id && row.outsideInterfaceId === from.interfaceId &&
            row.insideGlobal === packet.destination && row.translatedId === packet.icmpId &&
            (type !== "echo-reply" || row.outsideGlobal === packet.source));
          if (reverse) {
            const before = {...packet}; packet.destination = reverse.insideLocal; packet.icmpId = reverse.originalId;
            target = atIp(packet.destination);
            emit("nat-reverse", `${router.name} traduz o destino ${before.destination} para ${packet.destination} no retorno.`,
              "A associação PAT foi criada na ida; agora o roteador entrega a resposta à rede inside.",
              {focusId: router.id, incomingInterfaceId: from.interfaceId, packet: {...packet}, natTranslation: {before, after: {...packet}}});
          }
          if (target?.deviceId === router.id) return {status: "delivered", packet};
          if (packet.ttl <= 1) {
            if (options.trace && type === "echo-request") {
              emit("ttl-expired", `${router.name} descarta a sonda: TTL expirou.`, "A sonda não segue ao próximo roteador.",
                {focusId: router.id, incomingInterfaceId: from.interfaceId, interfaceIds: [from.interfaceId], packet: {...packet, ttl: 0}});
              const control = deliver(router.id, from.ip, packet.source, "time-exceeded", packet);
              if (control.status !== "delivered") return stop("timeout", `ICMP Time Exceeded de ${router.name} não voltou à origem.`, router.id, packet);
              emit("time-exceeded-received", `${source.name} recebe ICMP Time Exceeded de ${from.ip}.`,
                "A resposta identifica este salto; o destino final ainda não foi alcançado.",
                {focusId: sourceId, packet: {...control.packet}});
              return {status: "ttl-expired", packet};
            }
            return stop("ttl-expired", `${router.name} descarta a sonda: TTL expirou.`, router.id, {...packet, ttl: 0});
          }
        }
        const selected = routeFrom(router.id, packet.destination);
        if (!selected) {
          if (options.trace && type === "echo-request") {
            emit("route-unreachable", `${router.name} não tem rota para ${packet.destination}.`, "A sonda não pode avançar sem rota compatível.",
              {focusId: router.id, incomingInterfaceId: from.interfaceId, packet: {...packet}});
            const control = deliver(router.id, from.ip, packet.source, "destination-unreachable", packet);
            if (control.status !== "delivered") return stop("timeout", `ICMP Destination Unreachable de ${router.name} não voltou à origem.`, router.id, packet);
            emit("destination-unreachable-received", `${source.name} recebe ICMP Destination Unreachable de ${from.ip}.`,
              "O roteador informou que não encontrou caminho para esta sonda.", {focusId: sourceId, packet: {...control.packet}});
            return {status: "destination-unreachable", packet};
          }
          return stop("destination-unreachable", `${router.name} não tem rota para ${packet.destination}.`, router.id, packet);
        }
        const egress = endpoints.find(endpoint => endpoint.interfaceId === selected.interfaceId);
        if (senderId !== router.id) packet.ttl--;
        const decision = {input: from.interfaceId, route: selected.prefix, output: egress.interfaceId,
          nextHop: selected.nextHop, ttlBefore: packet.ttl + (senderId !== router.id ? 1 : 0), ttlAfter: packet.ttl};
        emit("route-decision", `${router.name} escolhe ${selected.prefix} pela ${iface(egress.interfaceId).name}${selected.nextHop ? ` via ${selected.nextHop}` : ""}.`,
          `A rota usa o Destination IP antes de eventual tradução NAT; TTL ${decision.ttlBefore} → ${decision.ttlAfter}.`,
          {focusId: router.id, incomingInterfaceId: from.interfaceId, outgoingInterfaceIds: [egress.interfaceId], packet: {...packet}, routerDecision: decision});
        const nat = router.config.nat;
        if (senderId !== router.id && nat?.enabled && from.interfaceId === `${router.id}:${nat.inside}` &&
            egress.interfaceId === `${router.id}:${nat.outside}` && nat.sourceNetwork && nat.sourceMask &&
            sameSubnet(ipv4(packet.source), ipv4(nat.sourceNetwork), mask(nat.sourceMask))) {
          const before = {...packet};
          const row = {routerId: router.id, insideInterfaceId: from.interfaceId, outsideInterfaceId: egress.interfaceId,
            insideLocal: packet.source, insideGlobal: egress.ip, outsideGlobal: packet.destination,
            originalId: packet.icmpId, translatedId: 10000 + natTable.length + 1, protocol: "ICMP"};
          natTable.push(row); packet.source = egress.ip; packet.icmpId = row.translatedId;
          emit("nat-source", `${router.name} aplica PAT: ${before.source} → ${packet.source} (ICMP ID ${row.translatedId}).`,
            "A rota já foi escolhida. PAT altera a origem para o IPv4 da interface outside; o destino final permanece.",
            {focusId: router.id, incomingInterfaceId: from.interfaceId, outgoingInterfaceIds: [egress.interfaceId], packet: {...packet}, natTranslation: {before, after: {...packet}}});
        }
        const nextIp = selected.nextHop || packet.destination, next = atIp(nextIp);
        if (!resolve(egress, next, packet, nextIp)) return stop("timeout", `ARP de ${router.name} para ${nextIp} não obteve resposta.`, router.id, packet);
        emit("frame-out", `${router.name} cria novo frame ${egress.mac} → ${next.mac}.`, "O MAC de destino é o próximo salto deste enlace.",
          {focusId: router.id, outgoingInterfaceIds: [egress.interfaceId], packet: {...packet}, routerDecision: decision,
            frame: {id: `${type}:out:${egress.interfaceId}`, source: egress.mac, destination: next.mac, type: "IPv4", kind: type,
              label: `ICMP ${icmpLabel(type)}`, vlanTag: null}});
        if (!sendFrame(egress, next, type, packet)) return stop("timeout", `O frame de ${router.name} não chegou a ${nextIp}.`, router.id, packet);
        if (next.ip === packet.destination && !(devices[next.deviceId].type === "router" &&
            natTable.some(row => row.routerId === next.deviceId && row.outsideInterfaceId === next.interfaceId &&
              row.insideGlobal === packet.destination && row.translatedId === packet.icmpId &&
              (type !== "echo-reply" || row.outsideGlobal === packet.source)))) return {status: "delivered", packet};
        if (devices[next.deviceId].type !== "router") return stop("destination-unreachable", `${next.name} não encaminha pacotes de Camada 3.`, next.deviceId, packet);
        incomingFrame = {id: `${type}:in:${next.interfaceId}`, source: egress.mac, destination: next.mac, type: "IPv4", kind: type,
          label: `ICMP ${icmpLabel(type)}`, vlanTag: null};
        from = next;
      }
      return stop("destination-unreachable", `Não há caminho para ${targetIp}.`, senderId, packet);
    }
    try {
      const request = deliver(sourceId, source.type === "pc" ? source.config.ip : "", destinationIp, "echo-request");
      if (request.status !== "delivered") return finish(request.status);
      const target = atIp(destinationIp);
      emit("echo-request-arrived", `${target.name} recebe ICMP Echo Request.`, "A resposta ainda precisa percorrer a rede de volta.",
        {focusId: target.deviceId, incomingInterfaceId: target.interfaceId, interfaceIds: [target.interfaceId], packet: {...request.packet}});
      const reply = deliver(target.deviceId, target.ip, request.packet.source, "echo-reply", request.packet);
      if (reply.status !== "delivered") {
        emit("timeout", `Echo Request chegou a ${target.name}, mas Echo Reply não voltou à origem.`,
          "A configuração ou o percurso de retorno impede confirmar a troca ICMP.", {focusId: target.deviceId, packet: reply.packet, outcome: "failure"});
        return finish("timeout");
      }
      emit("echo-reply-received", `${source.name} recebe ICMP Echo Reply de ${target.ip}.`,
        "Request e Reply completaram seus percursos; esta tentativa de ping obteve resposta.",
        {focusId: sourceId, incomingInterfaceId: source.type === "pc" ? source.interfaces[0] : atIp(request.packet.source)?.interfaceId,
          packet: {...reply.packet}, outcome: "success"});
      return finish("reply");
    } catch (caught) {
      if (caught !== limit) throw caught;
      const event = {id: "limit", eventId: `event-${Math.min(events.length + 1, maxEvents)}`, observation: "Ping interrompido por limite de segurança.",
        explanation: "A execução terminou sem confirmar Echo Reply.", focusId: sourceId, interfaceIds: [], connectionIds: [], incomingInterfaceId: null,
        outgoingInterfaceIds: [], fromId: null, toId: null, frame: null, packet: null, routerDecision: null, outcome: "interrupted", tables: snapshot()};
      if (events.length >= maxEvents) events.length = maxEvents - 1;
      events.push(event); return finish("interrupted");
    }
  }
  function traceroute(input, destinationIp, options = {}) {
    const error = validate(input, {ping: true});
    if (error || !ipv4(destinationIp)) return {status: "invalid", message: error || "IPv4 de destino inválido.", hops: [], events: [], tables: {mac: [], arp: [], routes: []}};
    const maxHops = options.maxHops === undefined ? 12 : Number(options.maxHops);
    if (!Number.isInteger(maxHops) || maxHops < 1 || maxHops > 30) return {status: "invalid", message: "maxHops deve estar entre 1 e 30.", hops: [], events: [], tables: {mac: [], arp: [], routes: []}};
    const hops = [], events = []; let tables = {mac: [], arp: [], routes: []}, status = "max-hops";
    for (let ttl = 1; ttl <= maxHops; ttl++) {
      const probe = ping(input, destinationIp, {...options, ttl, trace: true});
      const expired = probe.events.findLast(event => event.id === "ttl-expired");
      const unreachable = probe.events.findLast(event => event.id === "route-unreachable");
      const observed = expired || unreachable;
      const routerId = observed?.focusId || null, incoming = observed?.incomingInterfaceId;
      const address = probe.status === "reply" ? destinationIp : probe.status === "ttl-expired" || probe.events.some(event => event.id === "destination-unreachable-received")
        ? routerId && incoming ? input.devices[routerId]?.config?.[incoming.split(":").at(-1)]?.ip || null : null : null;
      const response = probe.status === "reply" ? "Echo Reply" : probe.status === "ttl-expired" ? "Time Exceeded" :
        probe.events.some(event => event.id === "destination-unreachable-received") ? "Destination Unreachable" : "*";
      hops.push({ttl, status: probe.status, response, address, routerId: address ? routerId : null});
      for (const event of probe.events) events.push({...event, eventId: `event-${events.length + 1}`, traceTtl: ttl});
      tables = probe.tables;
      if (probe.status === "reply") { status = "reached"; break; }
      if (probe.status === "invalid" || probe.status === "interrupted") { status = probe.status; break; }
      if (probe.status === "destination-unreachable") { status = "unreachable"; break; }
    }
    return {status, message: status === "reached" ? `Destino ${destinationIp} respondeu ao Echo Request.` :
      status === "unreachable" ? (hops.at(-1)?.response === "Destination Unreachable" ? `ICMP informou que ${destinationIp} está inalcançável.` : `Não há caminho local configurado para ${destinationIp}.`) :
      status === "max-hops" ? `Destino não confirmado em ${maxHops} saltos.` :
      events.at(-1)?.observation || "Traceroute interrompido.", hops, events, tables};
  }
  return {LIMITS, ipv4, mask, prefix, sameSubnet, validate, simulate, ping, traceroute, layer2Path};
});
