/* Cenários oficiais, separados dos cenários pessoais e do localStorage. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports
    ? require("./integrated-lab-model.js") : root.NetStudyLabModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetStudyLabPresets = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (model) {
  "use strict";
  function applied(change) {
    if (change.error) throw new Error(`Preset inválido: ${change.error}`);
    return change.state;
  }
  function freeze(value) {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  function preset({id, name, description, positions, configs = {}, cables, sourceId, destinationId}) {
    let state = model.create();
    positions.forEach(([deviceId, x, y]) => { state = applied(model.position(state, deviceId, x, y)); });
    Object.entries(configs).forEach(([deviceId, values]) => { state = applied(model.configure(state, deviceId, values)); });
    cables.forEach(([a, b]) => { state = applied(model.connect(state, a, b)); });
    const scenario = model.exportScenario(state, {name, sourceId, destinationId});
    return freeze({id, description, scenario});
  }

  const PRESETS = freeze([
    preset({
      id: "basic-lan", name: "LAN básica",
      description: "PC-A e PC-B compartilham SW1, a VLAN 10 e a mesma rede IPv4.",
      positions: [["pc-a", .18, .43], ["sw1", .5, .5], ["pc-b", .82, .43]],
      cables: [["pc-a:eth0", "sw1:gi0/1"], ["pc-b:eth0", "sw1:gi0/2"]],
      sourceId: "pc-a", destinationId: "pc-b"
    }),
    preset({
      id: "separate-vlans", name: "VLANs separadas",
      description: "PC-A está na VLAN 10 e PC-B na VLAN 20; não há função de Camada 3 entre elas.",
      positions: [["pc-a", .18, .43], ["sw1", .5, .5], ["pc-b", .82, .43]],
      configs: {"pc-b": {ip: "192.168.20.20"}, "sw1": {vlans: {"sw1:gi0/2": 20}}},
      cables: [["pc-a:eth0", "sw1:gi0/1"], ["pc-b:eth0", "sw1:gi0/2"]],
      sourceId: "pc-a", destinationId: "pc-b"
    }),
    preset({
      id: "switch-trunk", name: "Trunk entre switches",
      description: "PC-A e PC-B estão na VLAN 10 em switches diferentes, ligados por um único trunk 802.1Q.",
      positions: [["pc-a", .16, .42], ["sw1", .37, .5], ["sw2", .63, .5], ["pc-b", .84, .42]],
      cables: [["pc-a:eth0", "sw1:gi0/1"], ["sw1:gi0/5", "sw2:gi0/5"], ["pc-b:eth0", "sw2:gi0/1"]],
      sourceId: "pc-a", destinationId: "pc-b"
    }),
    preset({
      id: "two-networks-router", name: "Roteamento entre duas redes",
      description: "PC-A usa R1 Eth0 na rede 10; R1 Eth1 entrega à rede 20 de PC-C.",
      positions: [["pc-a", .17, .24], ["sw1", .39, .28], ["r1", .5, .5], ["sw2", .61, .72], ["pc-c", .83, .76]],
      configs: {
        "pc-a": {gateway: "192.168.10.1"},
        "pc-c": {ip: "192.168.20.30", gateway: "192.168.20.1"},
        "sw2": {vlans: {"sw2:gi0/1": 20, "sw2:gi0/2": 20}}
      },
      cables: [["pc-a:eth0", "sw1:gi0/1"], ["r1:eth0", "sw1:gi0/2"],
        ["r1:eth1", "sw2:gi0/2"], ["pc-c:eth0", "sw2:gi0/1"]],
      sourceId: "pc-a", destinationId: "pc-c"
    })
  ]);
  return {PRESETS};
});
