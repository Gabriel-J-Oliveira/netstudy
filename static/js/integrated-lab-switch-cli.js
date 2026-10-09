/* Mutações de switch compartilhadas entre dialetos; o modelo é a fonte de verdade. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./integrated-lab-model.js") : root.NetStudyLabModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetStudyLabSwitchCLI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (model) {
  "use strict";
  const error = message => ({error: {code: "invalid-input", message: `% ${message}`}});
  const bare = state => { const {observation, ...bench} = state; return bench; };
  const change = result => result.error ? error(result.error) : {bench: result.state, output: []};
  function vlanList(raw) {
    if (raw === "none") return [];
    const values = new Set();
    for (const part of raw.split(",")) {
      const match = /^(\d+)(?:-(\d+))?$/.exec(part);
      if (!match) return null;
      const first = Number(match[1]), last = Number(match[2] || match[1]);
      if (first < 1 || last > 4094 || last < first || last - first > 256) return null;
      for (let vlan = first; vlan <= last; vlan++) values.add(vlan);
    }
    return [...values].sort((a, b) => a - b);
  }
  function configure(state, device, interfaceId, words) {
    if (device.type !== "switch" || !device.interfaces.includes(interfaceId)) return error("Selecione uma interface de switch válida.");
    const args = words.map(word => word.toLowerCase()), command = args.join(" "), bench = bare(state);
    if (command === "shutdown" || command === "no shutdown")
      return change(model.configure(bench, device.id, {portSettings: {[interfaceId]: {shutdown: command === "shutdown"}}}));
    if (args[0] === "description" && words.length > 1) {
      const description = words.slice(1).join(" ");
      return description.length > 240 ? error("Description aceita até 240 caracteres.") :
        change(model.configure(bench, device.id, {portSettings: {[interfaceId]: {description}}}));
    }
    if (command === "switchport mode access") return change(model.setInterfaceMode(bench, interfaceId, "access"));
    if (command === "switchport mode trunk") return change(model.setInterfaceMode(bench, interfaceId, "trunk"));
    if (args.length === 4 && args.slice(0, 3).join(" ") === "switchport access vlan") {
      if (bench.interfaces[interfaceId].mode !== "access") return error("Configure a porta em modo access antes de atribuir sua VLAN.");
      const vlan = Number(words[3]);
      if (!/^\d+$/.test(words[3]) || !Number.isInteger(vlan) || vlan < 1 || vlan > 4094) return error("VLAN deve estar entre 1 e 4094.");
      return change(model.configure(bench, device.id, {vlans: {[interfaceId]: vlan}}));
    }
    if (args.length === 5 && args.slice(0, 4).join(" ") === "switchport trunk allowed vlan") {
      if (bench.interfaces[interfaceId].mode !== "trunk") return error("Configure a porta em modo trunk antes da lista de VLANs permitidas.");
      const vlans = vlanList(args[4]);
      return vlans === null ? error("Use VLANs ou faixas, por exemplo 10,20-22, ou none.") :
        change(model.configure(bench, device.id, {allowedVlans: vlans}));
    }
    return error("Comando de interface não suportado nesta bancada.");
  }
  return Object.freeze({configure, vlanList});
});
