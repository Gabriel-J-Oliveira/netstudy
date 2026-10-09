/* RouterOS-like educacional: consultas e configuração usam exclusivamente a bancada. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./integrated-lab-model.js") : root.NetStudyLabModel,
    typeof module === "object" && module.exports ? require("./integrated-lab-simulator.js") : root.NetStudyLabSimulator,
    typeof module === "object" && module.exports ? require("./integrated-lab-profiles.js") : root.NetStudyLabProfiles);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetStudyLabRouterOS = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (model, simulator, profiles) {
  "use strict";
  const error = (message, code = "invalid-input") => ({error: {code, message}});
  const bare = state => { const {observation, ...bench} = state; return bench; };
  const changed = (result, output) => result.error ? error(result.error, "configuration-error") : {bench: result.state, output: [output]};
  const name = (device, id) => profiles.interfaceName(device, id);
  const ifaceKey = id => id.endsWith(":eth0") ? "eth0" : "eth1";
  const interfaceId = (device, label) => device.interfaces.find(id => name(device, id).toLowerCase() === label?.toLowerCase());
  const prefixLength = mask => simulator.mask(mask)?.flatMap(byte => byte.toString(2).padStart(8, "0").split("")).filter(bit => bit === "1").length;
  const dottedMask = length => Array.from({length: 4}, (_, i) => {
    const bits = Math.max(0, Math.min(8, length - i * 8));
    return bits ? 256 - 2 ** (8 - bits) : 0;
  }).join(".");
  const cidr = (value, allowDefault = false) => {
    const match = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(value || "");
    const length = match && Number(match[2]);
    return match && simulator.ipv4(match[1]) && length >= (allowDefault ? 0 : 1) && length <= 32 ? {ip: match[1], length, mask: dottedMask(length)} : null;
  };
  const parameters = args => {
    const values = {};
    for (const arg of args) {
      const match = /^([a-z-]+)=(.+)$/i.exec(arg);
      if (!match || Object.hasOwn(values, match[1].toLowerCase())) return null;
      values[match[1].toLowerCase()] = match[2];
    }
    return values;
  };
  const exact = (values, keys) => values && Object.keys(values).length === keys.length && keys.every(key => Object.hasOwn(values, key));
  const linked = (state, id) => state.connections.some(link => (link.a === id || link.b === id) &&
    ![link.a, link.b].some(port => state.devices[state.interfaces[port]?.deviceId]?.config?.portSettings?.[port]?.shutdown));
  const assigned = device => device.interfaces.filter(id => {
    const c = device.config[ifaceKey(id)]; return simulator.ipv4(c.ip) && simulator.mask(c.mask);
  });
  function interfaces(device, state) {
    return {output: ["Flags: X - disabled, R - running", " #   NAME     TYPE      ACTUAL-MTU  MAC-ADDRESS", ...device.interfaces.map((id, index) => {
      const down = Boolean(device.config.portSettings?.[id]?.shutdown);
      const flags = down ? "X" : linked(state, id) ? "R" : " ";
      return `${String(index).padStart(2)} ${flags} ${name(device, id).padEnd(8)} ether     1500        ${device.config[ifaceKey(id)].mac}`;
    })]};
  }
  function addresses(device) {
    const rows = assigned(device);
    return {output: [" #   ADDRESS             NETWORK          INTERFACE", ...rows.map((id, index) => {
      const c = device.config[ifaceKey(id)], network = simulator.prefix(simulator.ipv4(c.ip), simulator.mask(c.mask)).split("/")[0];
      return `${String(index).padStart(2)}   ${`${c.ip}/${prefixLength(c.mask)}`.padEnd(20)}${network.padEnd(17)}${name(device, id)}`;
    }), ...(!rows.length ? ["Nenhum endereço IPv4 configurado."] : [])]};
  }
  function routes(device, state) {
    const rows = assigned(device).filter(id => linked(state, id));
    return {output: ["Flags: D - dynamic, A - active, c - connected, s - static", " #   DST-ADDRESS         GATEWAY     INTERFACE", ...rows.map((id, index) => {
      const c = device.config[ifaceKey(id)];
      return `${String(index).padStart(2)} DAc ${simulator.prefix(simulator.ipv4(c.ip), simulator.mask(c.mask)).padEnd(20)}${name(device, id).padEnd(12)}${name(device, id)}`;
    }), ...(device.config.staticRoutes||[]).map((route,index)=>{
      const transit=rows.find(id=>simulator.sameSubnet(simulator.ipv4(route.nextHop),simulator.ipv4(device.config[ifaceKey(id)].ip),simulator.mask(device.config[ifaceKey(id)].mask))&&route.nextHop!==device.config[ifaceKey(id)].ip);
      return `${String(rows.length+index).padStart(2)} ${transit?'As':' s'}  ${simulator.prefix(simulator.ipv4(route.destination),simulator.mask(route.mask)).padEnd(20)}${route.nextHop.padEnd(12)}${transit?name(device,transit):'unreachable'}`;
    }), ...(!rows.length&&!device.config.staticRoutes?.length ? ["Nenhuma rota ativa."] : [])]};
  }
  function arp(device, state) {
    const rows = (state.observation?.tables?.arp || []).filter(row => row.owner === device.id && device.interfaces.includes(row.interfaceId));
    return {output: ["Flags: D - dynamic", " #   ADDRESS           MAC-ADDRESS         INTERFACE", ...rows.map((row, index) =>
      `${String(index).padStart(2)} D ${row.ip.padEnd(17)} ${row.mac.padEnd(19)} ${name(device, row.interfaceId)}`),
    ...(!rows.length ? ["Nenhuma associação ARP aprendida até o evento selecionado."] : [])]};
  }
  function nat(device, state, args) {
    const [action,...rest]=args.map(value=>value.toLowerCase()), current=device.config.nat;
    if(action==='print'&&args.length===1) {
      const rows=(state.observation?.tables?.nat||[]).filter(row=>row.routerId===device.id);
      return {output:[` #  CHAIN   ACTION      SRC-ADDRESS         OUT-INTERFACE`,
        ...(current?.enabled&&current.sourceNetwork&&current.outside?[` 0  srcnat  masquerade  ${simulator.prefix(simulator.ipv4(current.sourceNetwork),simulator.mask(current.sourceMask))}  ${name(device,`${device.id}:${current.outside}`)}`]:[]),
        ...(!current?.enabled?['Nenhuma regra srcnat ativa.']:[]),
        `Traduções dinâmicas até este evento: ${rows.length}`,...rows.map(row=>` ICMP ${row.insideLocal}:${row.originalId} → ${row.insideGlobal}:${row.translatedId} · ${row.outsideGlobal}`)]};
    }
    if(action==='add') {
      const options=parameters(rest),network=cidr(options?.['src-address'],true),outside=interfaceId(device,options?.['out-interface']);
      if(!exact(options,['chain','action','src-address','out-interface'])||options.chain!=='srcnat'||options.action!=='masquerade'||!network||!outside||
          simulator.prefix(simulator.ipv4(network.ip),simulator.mask(network.mask)).split('/')[0]!==network.ip)
        return error('Use /ip firewall nat add chain=srcnat action=masquerade src-address=<rede/prefixo> out-interface=<iface>.');
      const inside=device.interfaces.find(id=>id!==outside&&simulator.ipv4(device.config[ifaceKey(id)].ip)&&
        simulator.sameSubnet(simulator.ipv4(device.config[ifaceKey(id)].ip),simulator.ipv4(network.ip),simulator.mask(network.mask)));
      if(!inside)return error('A rede de origem deve estar ligada à interface inside deste roteador.');
      return changed(model.setNat(bare(state),device.id,{inside:ifaceKey(inside),outside:ifaceKey(outside),sourceNetwork:network.ip,sourceMask:network.mask,enabled:true}),
        'Regra srcnat masquerade configurada.');
    }
    if(action==='remove'&&args.length===2&&args[1]==='0')return changed(model.setNat(bare(state),device.id,{enabled:false}),'Regra srcnat desabilitada.');
    return error('Use /ip firewall nat print|add ou /ip firewall nat remove 0.');
  }
  function interfaceCommand(args, device, state) {
    if (args.length === 1 && args[0].toLowerCase() === "print") return interfaces(device, state);
    if (args.length === 2 && args[0].toLowerCase() === "ethernet" && args[1].toLowerCase() === "print") return interfaces(device, state);
    if (args.length === 3 && args[0].toLowerCase() === "set") {
      const id = interfaceId(device, args[1]), options = parameters([args[2]]);
      if (!id) return error(`Interface desconhecida. Use ${device.interfaces.map(port => name(device, port)).join(" ou ")}.`, "interface-not-found");
      if (!exact(options, ["disabled"]) || !["yes", "no"].includes(options.disabled.toLowerCase()))
        return error("Sintaxe: /interface set <iface> disabled=yes|no.");
      return changed(model.configure(bare(state), device.id, {portSettings: {[id]: {shutdown: options.disabled.toLowerCase() === "yes"}}}),
        `${name(device, id)} ${options.disabled.toLowerCase() === "yes" ? "desabilitada" : "habilitada"}.`);
    }
    return error("Use /interface print, /interface ethernet print ou /interface set <iface> disabled=yes|no.");
  }
  function ipCommand(args, device, state) {
    const [menu, action] = args.map(value => value.toLowerCase());
    if(menu==='firewall'&&action==='nat')return nat(device,state,args.slice(2));
    if (menu === "address" && action === "print" && args.length === 2) return addresses(device);
    if (menu === "route" && action === "print" && args.length === 2) return routes(device, state);
    if (menu === "arp" && action === "print" && args.length === 2) return arp(device, state);
    if (menu === "address" && action === "add") {
      const options = parameters(args.slice(2)), address = cidr(options?.address), id = interfaceId(device, options?.interface);
      if (!exact(options, ["address", "interface"]) || !address || !id)
        return error("Sintaxe: /ip address add address=<IPv4/prefixo> interface=<iface>.", "invalid-address");
      if (assigned(device).includes(id)) return error(`Remova primeiro o endereço atual de ${name(device, id)}; esta bancada admite um IPv4 por interface.`, "address-exists");
      return changed(model.configure(bare(state), device.id, {[ifaceKey(id)]: {ip: address.ip, mask: address.mask}}),
        `Endereço ${address.ip}/${address.length} configurado em ${name(device, id)}.`);
    }
    if (menu === "address" && action === "remove") {
      const value = args.length === 3 ? args[2].replace(/^numbers=/i, "") : "";
      if (!/^(0|[1-9]\d*)$/.test(value)) return error("Sintaxe: /ip address remove <número exibido em /ip address print>.");
      const id = assigned(device)[Number(value)];
      if (!id) return error("Endereço não encontrado. Consulte /ip address print.", "address-not-found");
      return changed(model.configure(bare(state), device.id, {[ifaceKey(id)]: {ip: "", mask: ""}}),
        `Endereço removido de ${name(device, id)}.`);
    }
    if (menu === "route" && action === "add") {
      const options = parameters(args.slice(2));
      if (!exact(options, ["dst-address", "gateway"]) || !cidr(options["dst-address"], true) || !simulator.ipv4(options.gateway))
        return error("Sintaxe: /ip route add dst-address=<IPv4/prefixo> gateway=<IPv4>.");
      const destination=cidr(options["dst-address"], true);
      return changed(model.setStaticRoute(bare(state),device.id,{destination:destination.ip,mask:destination.mask,nextHop:options.gateway}),`Rota ${options["dst-address"]} via ${options.gateway} configurada.`);
    }
    if(menu==="route"&&action==="remove"&&args.length===3){
      const route=cidr(args[2], true);if(!route)return error("Use /ip route remove <IPv4/prefixo>.");
      return changed(model.removeStaticRoute(bare(state),device.id,route.ip,route.mask),`Rota ${args[2]} removida.`);
    }
    return error("Use /ip address print|add|remove, /ip route print|add|remove, /ip arp print ou /ip firewall nat print|add|remove.");
  }
  function systemCommand(args, device, state) {
    if (args.length === 2 && args[0].toLowerCase() === "identity" && args[1].toLowerCase() === "print") return {output: [`name: ${device.name}`]};
    if (args.length === 3 && args[0].toLowerCase() === "identity" && args[1].toLowerCase() === "set") {
      const options = parameters([args[2]]);
      if (!exact(options, ["name"])) return error("Sintaxe: /system identity set name=<nome>.");
      return changed(model.renameDevice(bare(state), device.id, options.name), `Identidade alterada para ${options.name}.`);
    }
    return error("Use /system identity print ou /system identity set name=<nome>.");
  }
  function install(registry) {
    for (const [name, description, run] of [
      ["/interface", "Consultar interfaces Ethernet e habilitar/desabilitar uma interface.", interfaceCommand],
      ["/ip", "Consultar/configurar endereços, rotas conectadas e ARP.", ipCommand],
      ["/system", "Consultar/alterar a identidade do roteador.", systemCommand]
    ]) registry.register("router", "mikrotik-routeros", {name, description, modes: ["exec"], acceptsArguments: true,
      execute: ({args, device, labState}) => run(args, device, labState)});
  }
  return Object.freeze({install});
});
