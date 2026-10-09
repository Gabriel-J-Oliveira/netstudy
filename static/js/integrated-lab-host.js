/* Adaptadores de host: comandos consultam o evento atual e configuram o modelo da bancada. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./integrated-lab-model.js") : root.NetStudyLabModel,
    typeof module === "object" && module.exports ? require("./integrated-lab-simulator.js") : root.NetStudyLabSimulator,
    typeof module === "object" && module.exports ? require("./integrated-lab-profiles.js") : root.NetStudyLabProfiles,
    typeof module === "object" && module.exports ? require("./integrated-lab-services.js") : root.NetStudyLabServices);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetStudyLabHost = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (model, simulator, profiles, services) {
  "use strict";
  const problem = (message, code = "invalid-input") => ({error: {code, message}});
  const single = (args, expected, syntax) => args.join(" ").toLowerCase() === expected ? null : problem(`Sintaxe: ${syntax}`);
  const port = device => device.interfaces[0];
  const portName = device => profiles.interfaceName(device, port(device));
  const adminDown = device => Boolean(device.config.portSettings?.[port(device)]?.shutdown);
  const connected = (device, state) => !adminDown(device) && state.connections.some(link => link.a === port(device) || link.b === port(device));
  const prefixLength = mask => simulator.mask(mask)?.flatMap(byte => byte.toString(2).padStart(8, "0").split("")).filter(bit => bit === "1").length;
  const dottedMask = length => Array.from({length: 4}, (_, index) => {
    const bits = Math.max(0, Math.min(8, length - index * 8));
    return bits ? 256 - 2 ** (8 - bits) : 0;
  }).join(".");
  const localRoute = device => {
    const ip = simulator.ipv4(device.config.ip), mask = simulator.mask(device.config.mask);
    return ip && mask ? simulator.prefix(ip, mask) : null;
  };
  const arpRows = (device, state) => (state.observation?.tables?.arp || []).filter(row => row.owner === device.id && row.interfaceId === port(device));
  const bench = state => { const {observation, ...configuration} = state; return configuration; };
  const changed = (state, device, values) => {
    const result = model.configure(bench(state), device.id, values);
    return result.error ? problem(result.error, "configuration-error") : {bench: result.state, output: []};
  };
  const ping = ({args, device, labState}) => {
    if (args.length !== 1 || !simulator.ipv4(args[0])) return problem("Informe um IPv4: ping <destino>.");
    const adapted = model.adaptForPing(labState, device.id);
    if (adapted.error) return problem(adapted.error, "configuration-error");
    const result = simulator.ping(adapted.input, args[0]);
    const line = result.status === "reply" ? `Resposta de ${args[0]}: Echo Reply recebido; TTL ${result.events.at(-1).packet.ttl}.`
      : result.status === "timeout" ? `Tempo esgotado: Echo Reply de ${args[0]} não retornou.`
      : result.status === "destination-unreachable" ? `Destino ${args[0]} inalcançável nesta configuração.`
      : result.status === "ttl-expired" ? `TTL expirou antes de alcançar ${args[0]}.`
      : result.status === "interrupted" ? "Ping interrompido por limite de segurança." : result.message;
    return {labResult: result, output: [line, result.status === "reply" ? "1 enviado, 1 recebido; RTT não modelado." : "1 enviado, 0 recebidos; consulte os eventos da bancada."]};
  };
  const trace = (command, {args, device, labState}) => {
    if (args.length !== 1 || !simulator.ipv4(args[0])) return problem(`Informe um IPv4: ${command} <destino>.`);
    const adapted = model.adaptForPing(labState, device.id);
    if (adapted.error) return problem(adapted.error, "configuration-error");
    const result = simulator.traceroute(adapted.input, args[0]);
    const header = command === "tracert" ? `Rastreando a rota para ${args[0]} (até 12 saltos; sondas ICMP)` : `traceroute to ${args[0]} (12 hops max; ICMP nesta bancada)`;
    const lines = result.hops.map(hop => `${String(hop.ttl).padStart(2)}  ${hop.address || "*"}  ${hop.response}${hop.address ? " · RTT não modelado" : ""}`);
    return {labResult: result, output: [header, ...lines, result.message]};
  };

  function windowsIpconfig(device, all, state) {
    const c = device.config,lease=state?.serviceRuntime?.leases?.[device.id];
    return {output: [
      `Configuração IP do Windows${all ? " (perfil educacional)" : ""}`,
      ...(all ? [`Nome do host . . . . . . . . . . : ${device.name}`] : []),
      `Adaptador ${portName(device)}:`,
      `   Endereço IPv4 . . . . . . . . . : ${c.ip || "não atribuído"}`,
      `   Máscara de Sub-rede . . . . . . : ${c.mask || "não atribuída"}`,
      `   Gateway Padrão . . . . . . . . : ${c.gateway || "não configurado"}`,
      ...(all ? [`   Endereço Físico . . . . . . . : ${c.mac}`,
        `   DHCP Habilitado . . . . . . . : ${c.dhcpClient ? "Sim" : "Não"}`,
        `   Servidor DNS . . . . . . . . . : ${c.dns || "não configurado"}`,
        ...(lease&&lease.ip===c.ip&&c.dhcpClient?[`   Servidor DHCP . . . . . . . . : ${state.devices[lease.serverId]?.config.ip||lease.serverId}`,
          `   Lease (duração) . . . . . . : ${lease.leaseMinutes} minutos`]:[])] : [])
    ]};
  }
  function windowsRoute(device) {
    const route = localRoute(device), c = device.config;
    return {output: ["Tabela de Rotas IPv4 (PC)", "Destino             Máscara          Gateway         Interface",
      ...(route ? [`${route.split("/")[0].padEnd(20)}${c.mask.padEnd(17)}No vínculo      ${c.ip}`] : []),
      ...(c.gateway ? [`${"0.0.0.0/0".padEnd(20)}${"0.0.0.0".padEnd(17)}${c.gateway.padEnd(16)}${c.ip || "sem IPv4"}`] : []),
      ...(!route && !c.gateway ? ["Nenhuma rota IPv4 configurada."] : []),
      "Rotas exibidas a partir da configuração do PC; o teste da bancada verifica alcançabilidade."]};
  }
  function windowsArp(device, state) {
    const rows = arpRows(device, state);
    return {output: [`Interface: ${device.config.ip || "sem IPv4"} --- ${portName(device)}`,
      "Endereço Internet      Endereço físico         Tipo",
      ...rows.map(row => `${row.ip.padEnd(23)}${row.mac.padEnd(24)}dinâmico`),
      ...(!rows.length ? ["Nenhuma associação ARP aprendida até o evento selecionado."] : [])]};
  }
  function windowsNetsh(args, device, state) {
    const syntax = "netsh interface ipv4 set address name=Ethernet static <IPv4> <máscara> [gateway|none]";
    const lower = args.map(value => value.toLowerCase());
    if ((args.length !== 8 && args.length !== 9) || lower.slice(0, 4).join(" ") !== "interface ipv4 set address" || lower[5] !== "static") return problem(`Perfil educacional simplificado. Sintaxe: ${syntax}`);
    const interfaceArg = args[4].replace(/^name=/i, "");
    if (interfaceArg.toLowerCase() !== portName(device).toLowerCase()) return problem(`Interface desconhecida: ${interfaceArg}. Use ${portName(device)}.`);
    const ip = args[6], mask = args[7], gateway = !args[8] || args[8].toLowerCase() === "none" ? "" : args[8];
    if (!simulator.ipv4(ip) || !simulator.mask(mask) || (gateway && !simulator.ipv4(gateway))) return problem("Informe IPv4, máscara contígua e gateway válidos (ou none).", "invalid-address");
    return changed(state, device, {ip, mask, gateway, dhcpClient:false});
  }
  const dhcpRenew=({args,device,labState})=>{
    if(args.length)return problem('Use ipconfig /renew ou dhclient sem argumentos.');
    const attempted=services.renew(bench(labState),device.id);
    return {...(attempted.bench?{bench:attempted.bench}:{}),labResult:attempted.result,
      output:[attempted.result.message,attempted.result.lease?`Lease ${attempted.result.lease.ip} · gateway ${attempted.result.lease.gateway} · DNS ${attempted.result.lease.dns||'não informado'}`:'Confira os eventos DHCP.']};
  };
  const query=(command,{args,device,labState})=>{
    if(args.length!==1)return problem(`Use ${command} <nome>.`);
    const result=services.resolve(bench(labState),device.id,args[0]);
    return {labResult:result,output:[result.message]};
  };
  const connection=({args,device,labState})=>{
    if(args.length!==3||!['tcp','udp'].includes(args[0].toLowerCase())||!/^(?:[1-9]\d{0,4})$/.test(args[2]))return problem('Use connect tcp|udp <IPv4|nome> <porta>.');
    const result=services.connect(bench(labState),device.id,args[1],args[0].toLowerCase(),Number(args[2]));
    return {labResult:result,output:[result.message]};
  };
  const curl=({args,device,labState})=>{
    const match=args.length===1&&/^https?:\/\/([^/:\s]+)(?::(\d{1,5}))?\/?$/i.exec(args[0]);
    if(!match)return problem('Use curl http://<IPv4|nome>[:porta] ou https://<IPv4|nome>[:porta].');
    const secure=args[0].toLowerCase().startsWith('https:'),port=match[2]?Number(match[2]):secure?443:80;
    const result=services.connect(bench(labState),device.id,match[1],'tcp',port);
    return {labResult:result,output:[result.status==='success'?`Conexão HTTP educacional: ${result.message}`:result.message]};
  };
  function linuxIp(device, state, args) {
    const sub = args[0]?.toLowerCase(), c = device.config;
    const flags = adminDown(device) ? "DOWN" : connected(device, state) ? "UP,LOWER_UP" : "UP";
    if (sub === "addr" && args.length === 1) return {output: [
      `1: ${portName(device)}: <${flags}> state ${connected(device, state) ? "UP" : "DOWN"}`,
      `    link/ether ${c.mac.toLowerCase()}`,
      ...(localRoute(device) ? [`    inet ${c.ip}/${prefixLength(c.mask)} scope global ${portName(device)}`] : ["    sem endereço IPv4"])]};
    if (sub === "link" && args.length === 1) return {output: [
      `1: ${portName(device)}: <${flags}> state ${connected(device, state) ? "UP" : "DOWN"}`,
      `    link/ether ${c.mac.toLowerCase()}  ${adminDown(device) ? "administrativamente desligada" : "administrativamente ativa"}`]};
    if (sub === "route" && args.length === 1) return {output: [
      ...(c.gateway ? [`default via ${c.gateway} dev ${portName(device)}`] : []),
      ...(localRoute(device) ? [`${localRoute(device)} dev ${portName(device)} proto kernel scope link src ${c.ip}`] : []),
      ...(!c.gateway && !localRoute(device) ? ["Nenhuma rota IPv4 configurada."] : [])]};
    if (sub === "neigh" && args.length === 1) { const rows = arpRows(device, state); return {output: rows.length ? rows.map(row => `${row.ip} dev ${portName(device)} lladdr ${row.mac.toLowerCase()} REACHABLE`) : ["Nenhuma associação ARP aprendida até o evento selecionado."]}; }
    if (sub === "addr" && ["add", "del"].includes(args[1]?.toLowerCase()) && args.length === 5 && args[3]?.toLowerCase() === "dev") {
      if (args[4].toLowerCase() !== portName(device).toLowerCase()) return problem(`Interface desconhecida. Use ${portName(device)}.`);
      const parts = args[2].match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/), length = parts && Number(parts[2]);
      if (!parts || !simulator.ipv4(parts[1]) || length < 1 || length > 32) return problem("Use IPv4/prefixo válido, por exemplo 192.168.10.10/24.", "invalid-address");
      if (args[1].toLowerCase() === "del") {
        if (c.ip !== parts[1] || prefixLength(c.mask) !== length) return problem("Esse IPv4/prefixo não está configurado nesta interface.", "address-not-found");
        return changed(state, device, {ip: "", mask: ""});
      }
      return changed(state, device, {ip: parts[1], mask: dottedMask(length), dhcpClient:false});
    }
    if (sub === "route" && args[1]?.toLowerCase() === "del" && args[2]?.toLowerCase() === "default" && args.length === 3) {
      if (!c.gateway) return problem("Não há rota padrão configurada.", "route-not-found");
      return changed(state, device, {gateway: ""});
    }
    if (sub === "route" && args[1]?.toLowerCase() === "add" && args[2]?.toLowerCase() === "default" && args[3]?.toLowerCase() === "via" && args[5]?.toLowerCase() === "dev" && args.length === 7) {
      if (args[6].toLowerCase() !== portName(device).toLowerCase()) return problem(`Interface desconhecida. Use ${portName(device)}.`);
      if (!simulator.ipv4(args[4])) return problem("Gateway IPv4 inválido.", "invalid-address");
      return changed(state, device, {gateway: args[4]});
    }
    if (sub === "link" && args[1]?.toLowerCase() === "set" && args.length === 4 && ["up", "down"].includes(args[3]?.toLowerCase())) {
      if (args[2].toLowerCase() !== portName(device).toLowerCase()) return problem(`Interface desconhecida. Use ${portName(device)}.`);
      return changed(state, device, {portSettings: {[port(device)]: {shutdown: args[3].toLowerCase() === "down"}}});
    }
    return problem("Use ip addr|link|route|neigh ou consulte help para a sintaxe de configuração.");
  }
  function install(registry) {
    const register = (profile, name, description, execute, acceptsArguments = false) => registry.register("pc", profile, {name, description, modes: ["exec"], acceptsArguments, execute});
    register("windows", "hostname", "Mostrar nome do host.", ({device}) => ({output: [device.name]}));
    register("windows", "ipconfig", "Mostrar configuração; /renew executa DHCP DORA.", ({args, device, labState}) => args.length===1&&args[0].toLowerCase()==='/renew'?dhcpRenew({args:[],device,labState}):args.length && (args.length !== 1 || args[0].toLowerCase() !== "/all") ? problem("Use ipconfig, ipconfig /all ou ipconfig /renew.") : windowsIpconfig(device, args.length === 1,labState), true);
    register("windows", "arp", "arp -a: mostrar associações aprendidas até o evento selecionado.", ({args, device, labState}) => single(args, "-a", "arp -a") || windowsArp(device, labState), true);
    register("windows", "route", "route print: mostrar rotas IPv4 configuradas neste PC.", ({args, device}) => single(args, "print", "route print") || windowsRoute(device), true);
    register("windows", "netsh", "Perfil educacional: netsh interface ipv4 set address name=Ethernet static <IPv4> <máscara> [gateway|none].", ({args, device, labState}) => windowsNetsh(args, device, labState), true);
    register("windows", "ping", "Enviar ICMP Echo Request e acompanhar Echo Reply na bancada.", ping, true);
    register("windows", "tracert", "Enviar sondas ICMP com TTL crescente e observar cada resposta.", context => trace("tracert", context), true);
    register("windows", "nslookup", "Consultar um registro A no DNS configurado.", context=>query('nslookup',context), true);
    register("windows", "curl", "Testar um serviço HTTP TCP pela URL.", curl, true);
    register("windows", "connect", "Testar TCP/UDP: connect <protocolo> <destino> <porta>.", connection, true);
    register("linux", "hostname", "Mostrar nome do host.", ({device}) => ({output: [device.name]}));
    register("linux", "ip", "ip addr|link|route|neigh; configuração: addr add/del, route add/del default, link set.", ({args, device, labState}) => linuxIp(device, labState, args), true);
    register("linux", "ping", "Enviar ICMP Echo Request e acompanhar Echo Reply na bancada.", ping, true);
    register("linux", "traceroute", "Enviar sondas ICMP com TTL crescente e observar cada resposta.", context => trace("traceroute", context), true);
    register("linux", "dhclient", "Renovar o lease DHCP pela bancada.", dhcpRenew, true);
    register("linux", "dig", "Consultar um registro A no DNS configurado.", context=>query('dig',context), true);
    register("linux", "nslookup", "Consultar um registro A no DNS configurado.", context=>query('nslookup',context), true);
    register("linux", "curl", "Testar um serviço HTTP TCP pela URL.", curl, true);
    register("linux", "connect", "Testar TCP/UDP: connect <protocolo> <destino> <porta>.", connection, true);
  }
  return Object.freeze({install});
});
