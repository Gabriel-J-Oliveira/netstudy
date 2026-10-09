/* Dell SmartFabric OS10-like: sintaxe e apresentação próprias sobre o mesmo switch L2. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./integrated-lab-profiles.js") : root.NetStudyLabProfiles,
    typeof module === "object" && module.exports ? require("./integrated-lab-model.js") : root.NetStudyLabModel,
    typeof module === "object" && module.exports ? require("./integrated-lab-switch-cli.js") : root.NetStudyLabSwitchCLI);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetStudyLabDell = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (profiles, model, switchCLI) {
  "use strict";
  const commands = Object.freeze(["show interface status", "show interface", "show vlan", "show mac address-table",
    "show running-configuration", "show ip interface brief"]);
  const error = message => ({error: {code: "invalid-input", message: `% ${message}`}});
  const bare = state => { const {observation, ...bench} = state; return bench; };
  const name = (device, id) => profiles.interfaceName(device, id);
  const operational = (state, id) => state.connections.some(link => (link.a === id || link.b === id) &&
    ![link.a, link.b].some(port => state.devices[state.interfaces[port]?.deviceId]?.config?.portSettings?.[port]?.shutdown));
  const ports = (device, state) => device.interfaces.map(id => ({id, name: name(device, id), mode: state.interfaces[id].mode,
    disabled: Boolean(device.config.portSettings?.[id]?.shutdown), up: operational(state, id)}));
  function show(command, device, state) {
    const rows = ports(device, state), output = [];
    if (command === "show interface status") {
      output.push("Port                 Status       Mode     VLAN/Allowed");
      rows.forEach(port => output.push(`${port.name.padEnd(21)}${(port.disabled ? "disabled" : port.up ? "up" : "down").padEnd(13)}${port.mode.padEnd(9)}${port.mode === "trunk" ? device.config.allowedVlans.join(",") || "none" : device.config.vlans[port.id]}`));
    } else if (command === "show interface") {
      for (const port of rows) {
        output.push(`${port.name} is ${port.disabled ? "administratively down" : port.up ? "up" : "down"}, line protocol is ${port.up ? "up" : "down"}`);
        output.push(`  Layer 2 mode ${port.mode}${port.mode === "trunk" ? `, allowed VLANs ${device.config.allowedVlans.join(",") || "none"}` : `, access VLAN ${device.config.vlans[port.id]}`}`);
        const description = device.config.portSettings?.[port.id]?.description;
        if (description) output.push(`  Description: ${description}`);
      }
      output.push("Estado de enlace derivado dos cabos e das interfaces da bancada.");
    } else if (command === "show vlan") {
      output.push("VLAN   Name       Tagged Ports                   Untagged Ports");
      const vlans = [...new Set([1, ...Object.values(device.config.vlans), ...device.config.allowedVlans])].sort((a, b) => a - b);
      for (const vlan of vlans) output.push(`${String(vlan).padEnd(7)}${(vlan === 1 ? "default" : `VLAN${vlan}`).padEnd(11)}${(device.config.allowedVlans.includes(vlan) ? rows.filter(port => port.mode === "trunk").map(port => port.name).join(", ") : "-").padEnd(31)}${rows.filter(port => port.mode === "access" && device.config.vlans[port.id] === vlan).map(port => port.name).join(", ") || "-"}`);
      output.push("VLANs derivadas da configuração Access e Allowed VLANs local.");
    } else if (command === "show mac address-table") {
      output.push("VLAN   MAC Address        Type      Interface");
      const learned = (state.observation?.tables?.mac || []).filter(row => row.switchId === device.id && device.interfaces.includes(row.interfaceId));
      learned.forEach(row => output.push(`${String(row.vlan).padEnd(7)}${row.mac.padEnd(19)}DYNAMIC   ${name(device, row.interfaceId)}`));
      if (!learned.length) output.push("Nenhuma entrada MAC aprendida até o evento selecionado.");
    } else if (command === "show running-configuration") {
      output.push(`hostname ${device.name}`, "!");
      rows.forEach(port => {
        output.push(`interface ${port.name}`);
        const description = device.config.portSettings?.[port.id]?.description;
        if (description) output.push(` description ${description}`);
        output.push(` switchport mode ${port.mode}`);
        output.push(port.mode === "trunk" ? ` switchport trunk allowed vlan ${device.config.allowedVlans.join(",") || "none"}` : ` switchport access vlan ${device.config.vlans[port.id]}`);
        output.push(port.disabled ? " shutdown" : " no shutdown", "!");
      });
      output.push("Configuração representada pelo estado atual da bancada.");
    } else if (command === "show ip interface brief") {
      output.push("Este switch L2 não possui interface IP/SVI nesta bancada; não há IPv4 de gerência ou roteamento para exibir.");
    }
    return {output};
  }
  const help = mode => mode === "exec" ? ["configure terminal", ...commands, "help", "?", "clear", "exit"] :
    mode === "config" ? ["hostname <nome>", "interface ethernet1/1/<n>", "end", "exit", "?"] :
      ["switchport mode access|trunk", "switchport access vlan <id>", "switchport trunk allowed vlan <lista>", "shutdown", "no shutdown", "end", "exit", "?"];
  function install(registry) {
    const register = command => registry.register("switch", "dell-os10", command);
    register({name: "show", description: "Consultar interfaces, VLANs, MACs e configuração.", modes: ["exec"], acceptsArguments: true,
      execute: ({args, device, labState}) => {
        const query = `show ${args.map(arg => arg.toLowerCase()).join(" ")}`.trim();
        if (query === "show" || args.at(-1) === "?") return {output: commands};
        return commands.includes(query) ? show(query, device, labState) : error("Comando de consulta indisponível. Use show ?.");
      }});
    register({name: "configure", description: "Entrar no modo de configuração.", modes: ["exec"], acceptsArguments: true,
      execute: ({args, device}) => args.length === 1 && args[0].toLowerCase() === "terminal" ?
        {mode: "config", context: {deviceId: device.id}, output: []} : error("Use configure terminal.")});
    register({name: "hostname", description: "Alterar a identidade do switch.", modes: ["config"], acceptsArguments: true,
      execute: ({args, device, labState}) => {
        if (args.length !== 1 || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$/.test(args[0])) return error("Use hostname <nome> (sem espaços).");
        const result = model.renameDevice(bare(labState), device.id, args[0]);
        return result.error ? error(result.error) : {bench: result.state, output: [`Hostname alterado para ${args[0]}.`]};
      }});
    register({name: "interface", description: "Selecionar uma interface Ethernet.", modes: ["config"], acceptsArguments: true,
      execute: ({args, device}) => {
        const id = args.length === 1 && device.interfaces.find(port => name(device, port).toLowerCase() === args[0].toLowerCase());
        return id ? {mode: "config-if", context: {deviceId: device.id, interfaceId: id}, output: []} :
          error(`Interface desconhecida. Use ${device.interfaces.map(port => name(device, port)).join(", ")}.`);
      }});
    const configurePort = (words, {session, device, labState}) => {
      const id = session.context?.interfaceId;
      return id ? switchCLI.configure(labState, device, id, words) : error("Selecione uma interface Ethernet.");
    };
    register({name: "switchport", description: "Configurar modo e VLAN da interface.", modes: ["config-if"], acceptsArguments: true,
      execute: context => configurePort(["switchport", ...context.args], context)});
    register({name: "shutdown", description: "Desabilitar a interface.", modes: ["config-if"],
      execute: context => configurePort(["shutdown"], context)});
    register({name: "no", description: "Reverter uma configuração.", modes: ["config-if"], acceptsArguments: true,
      execute: context => configurePort(["no", ...context.args], context)});
    register({name: "end", description: "Voltar ao modo EXEC.", modes: ["config", "config-if"],
      execute: ({device}) => ({mode: "exec", context: {deviceId: device.id}, output: []})});
    register({name: "exit", description: "Subir um nível ou encerrar a sessão.", modes: ["exec", "config", "config-if"],
      execute: ({session, device}) => session.mode === "config-if" ? {mode: "config", context: {deviceId: device.id}, output: []} :
        session.mode === "config" ? {mode: "exec", context: {deviceId: device.id}, output: []} : {closed: true, output: ["Sessão encerrada."]}});
    for (const command of ["?", "help"]) register({name: command, description: "Listar comandos do modo atual.", modes: ["exec", "config", "config-if"],
      execute: ({session}) => ({output: help(session.mode)})});
  }
  return Object.freeze({install});
});
