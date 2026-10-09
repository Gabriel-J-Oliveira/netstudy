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
  function externalPreset() {
    let state = model.createEmpty();
    for (const type of ["pc", "pc", "switch", "switch", "router", "router", "router"]) state = applied(model.addDevice(state, type));
    for (const [id, x, y] of [["pc-1", .1, .35], ["switch-1", .23, .4], ["router-1", .36, .45],
      ["router-2", .5, .35], ["router-3", .64, .45], ["switch-2", .77, .5], ["pc-2", .9, .55]])
      state = applied(model.position(state, id, x, y));
    for (const [id, name, profile] of [["pc-1", "PC-A", "windows"], ["pc-2", "Servidor externo", "linux"],
      ["router-1", "R1", "cisco-ios"], ["router-2", "ISP-1", "cisco-ios"], ["router-3", "ISP-2", "cisco-ios"]]) {
      state = applied(model.renameDevice(state, id, name)); state = applied(model.setProfile(state, id, profile));
    }
    state = applied(model.configure(state, "pc-1", {ip: "192.168.10.10", gateway: "192.168.10.1"}));
    state = applied(model.configure(state, "pc-2", {ip: "203.0.113.20", gateway: "203.0.113.1"}));
    state = applied(model.configure(state, "switch-2", {vlans: {"switch-2:gi0/1": 20, "switch-2:gi0/2": 20}}));
    state = applied(model.configure(state, "router-1", {eth0: {ip: "192.168.10.1"}, eth1: {ip: "10.0.0.1"}}));
    state = applied(model.configure(state, "router-2", {eth0: {ip: "10.0.0.2"}, eth1: {ip: "10.0.1.1"}}));
    state = applied(model.configure(state, "router-3", {eth0: {ip: "10.0.1.2"}, eth1: {ip: "203.0.113.1"}}));
    for (const [a, b] of [["pc-1:eth0", "switch-1:gi0/1"], ["router-1:eth0", "switch-1:gi0/2"],
      ["router-1:eth1", "router-2:eth0"], ["router-2:eth1", "router-3:eth0"],
      ["router-3:eth1", "switch-2:gi0/2"], ["pc-2:eth0", "switch-2:gi0/1"]]) state = applied(model.connect(state, a, b));
    for (const [id, route] of [
      ["router-1", {destination: "0.0.0.0", mask: "0.0.0.0", nextHop: "10.0.0.2"}],
      ["router-2", {destination: "203.0.113.0", mask: "255.255.255.0", nextHop: "10.0.1.2"}],
      ["router-2", {destination: "192.168.10.0", mask: "255.255.255.0", nextHop: "10.0.0.1"}],
      ["router-3", {destination: "192.168.10.0", mask: "255.255.255.0", nextHop: "10.0.1.1"}],
      ["router-3", {destination: "10.0.0.0", mask: "255.255.255.0", nextHop: "10.0.1.1"}]
    ]) state = applied(model.setStaticRoute(state, id, route));
    return freeze({id: "external-network", description: "PC-A alcança um servidor de teste por R1 e dois roteadores ISP lógicos. Usa rota padrão e retorno; não há NAT nem Internet real.",
      scenario: model.exportScenario(state, {name: "Rede externa · ISP lógico", sourceId: "pc-1", destinationId: "pc-2"})});
  }
  function externalFaultPreset(working, kind) {
    let state = model.importScenario(working.scenario).state;
    const definitions = {
      "default-missing": ["Rota padrão ausente", "A LAN não tem uma rota padrão para iniciar o percurso até a rede externa."],
      "next-hop-wrong": ["Próximo salto incorreto", "Há rota padrão, mas o próximo salto configurado não responde no trânsito."],
      "return-missing": ["Retorno ausente", "A sonda chega ao servidor externo, mas a resposta não encontra rota de volta."]
    };
    if (kind === "default-missing") state = applied(model.removeStaticRoute(state, "router-1", "0.0.0.0", "0.0.0.0"));
    else if (kind === "next-hop-wrong") state = applied(model.setStaticRoute(state, "router-1", {destination: "0.0.0.0", mask: "0.0.0.0", nextHop: "10.0.0.254"}));
    else state = applied(model.removeStaticRoute(state, "router-3", "192.168.10.0", "255.255.255.0"));
    const [name, description] = definitions[kind];
    return freeze({id: `external-${kind}`, description,
      scenario: model.exportScenario(state, {name: `Rede externa · ${name}`, sourceId: "pc-1", destinationId: "pc-2"})});
  }
  function natPreset(working) {
    let state = model.importScenario(working.scenario).state;
    for (const id of ["router-2", "router-3"])
      state = applied(model.removeStaticRoute(state, id, "192.168.10.0", "255.255.255.0"));
    state = applied(model.setNat(state, "router-1", {inside: "eth0", outside: "eth1", sourceNetwork: "192.168.10.0",
      sourceMask: "255.255.255.0", enabled: true}));
    return freeze({id: "external-nat-pat", description: "A LAN acessa o servidor externo via PAT em R1; o retorno usa a tradução, sem rota ISP para o IPv4 privado.",
      scenario: model.exportScenario(state, {name: "Acesso externo · NAT/PAT", sourceId: "pc-1", destinationId: "pc-2"})});
  }
  function servicesPreset() {
    let state=model.create();
    for(const [id,x,y] of [['pc-a',.12,.35],['pc-b',.18,.7],['sw1',.36,.48],['r1',.52,.5],['sw2',.68,.5],['pc-c',.86,.5]])
      state=applied(model.position(state,id,x,y));
    for(const [id,name,profile] of [['pc-a','PC-A','windows'],['pc-b','Srv-DHCP-DNS','linux'],['pc-c','App','linux']]){
      state=applied(model.renameDevice(state,id,name));state=applied(model.setProfile(state,id,profile));
    }
    state=applied(model.setHostServices(state,'pc-a',{dhcpClient:true,dns:'192.168.10.20',gateway:'192.168.10.1'}));
    state=applied(model.setHostServices(state,'pc-b',{dhcpServer:{enabled:true,poolStart:'192.168.10.100',poolEnd:'192.168.10.150',mask:'255.255.255.0',gateway:'192.168.10.1',dns:'192.168.10.20',leaseMinutes:60},
      dnsServer:{enabled:true,records:[{name:'app.lab',address:'192.168.20.30'}]}}));
    state=applied(model.configure(state,'pc-c',{ip:'192.168.20.30',gateway:'192.168.20.1'}));
    state=applied(model.setHostServices(state,'pc-c',{services:[{name:'Web',protocol:'tcp',port:80,enabled:true},{name:'Consulta',protocol:'udp',port:5300,enabled:true}]}));
    state=applied(model.configure(state,'sw2',{vlans:{'sw2:gi0/1':20,'sw2:gi0/2':20}}));
    for(const [a,b] of [['pc-a:eth0','sw1:gi0/1'],['pc-b:eth0','sw1:gi0/3'],['r1:eth0','sw1:gi0/2'],
      ['r1:eth1','sw2:gi0/2'],['pc-c:eth0','sw2:gi0/1']])state=applied(model.connect(state,a,b));
    return freeze({id:'lan-services',description:'PC-A recebe DHCP de um servidor na VLAN 10, resolve app.lab por DNS e alcança o serviço Web na VLAN 20.',
      scenario:model.exportScenario(state,{name:'DHCP, DNS e serviço Web',sourceId:'pc-a',destinationId:'pc-c'})});
  }

  const external = externalPreset();
  const externalNat = natPreset(external);
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
    }),
    servicesPreset(),
    external,
    externalNat,
    externalFaultPreset(external, "default-missing"),
    externalFaultPreset(external, "next-hop-wrong"),
    externalFaultPreset(external, "return-missing")
  ]);
  return {PRESETS};
});
