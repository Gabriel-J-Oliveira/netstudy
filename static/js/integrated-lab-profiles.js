/* Device Profiles v1: apresentação e metadados; nenhuma decisão de rede. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetStudyLabProfiles = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function profile(id, label, displayType, dialect, promptTemplate, capabilities, interfaceNames) {
    return Object.freeze({id, label, displayType, interfaceNames: Object.freeze(interfaceNames),
      capabilities: Object.freeze(capabilities), terminal: Object.freeze({dialect, promptTemplate,
        implemented: ["cisco-ios", "windows", "linux", "mikrotik-routeros", "dell-os10"].includes(id), commandAdapter: id === "cisco-ios" ? "cisco-ios-v1" : id === "mikrotik-routeros" ? "routeros-v1" : id === "dell-os10" ? "dell-os10-v1" : ["windows", "linux"].includes(id) ? `host-${id}-v1` : null, hostnameSource: "device.name", encoding: "utf-8"})});
  }
  const host = {ethernet: true, ipv4: true, arp: true, defaultGateway: true, dhcpClient: true, dhcpServer: true, dnsClient: true, dnsServer: true, tcpUdpServices: true};
  const switching = {ethernet: true, vlanAccess: true, trunk8021q: true, macLearning: true};
  const routing = {ethernet: true, ipv4: true, arp: true, directlyConnectedRoutes: true, sourceNatPat: true};
  const ports = prefix => Array.from({length: 5}, (_, i) => `${prefix}${i + 1}`);
  const REGISTRY = Object.freeze({
    pc: Object.freeze({
      generic: profile("generic", "Genérico", "PC · Camada 2/3", "generic-host", "{name}>", host, ["Eth0"]),
      windows: profile("windows", "Windows", "Host Windows", "windows", "C:\\Users\\{name}>", host, ["Ethernet"]),
      linux: profile("linux", "Linux", "Host Linux", "posix-shell", "{name}:~$", host, ["eth0"])
    }),
    switch: Object.freeze({
      generic: profile("generic", "Genérico", "Switch Ethernet", "generic-switch", "{name}>", switching, ports("Gi0/")),
      "cisco-ios": profile("cisco-ios", "Cisco IOS", "Switch · Cisco IOS", "cisco-ios", "{name}>", switching, ports("GigabitEthernet1/0/")),
      "dell-os10": profile("dell-os10", "Dell OS10", "Switch · Dell OS10", "dell-os10", "{name}#", switching, ports("ethernet1/1/"))
    }),
    router: Object.freeze({
      generic: profile("generic", "Genérico", "Roteador · Eth0 / Eth1", "generic-router", "{name}>", routing, ["Eth0", "Eth1"]),
      "cisco-ios": profile("cisco-ios", "Cisco IOS", "Roteador · Cisco IOS", "cisco-ios", "{name}>", routing, ["GigabitEthernet0/0", "GigabitEthernet0/1"]),
      "mikrotik-routeros": profile("mikrotik-routeros", "MikroTik RouterOS", "Roteador · MikroTik RouterOS", "routeros", "[admin@{name}] >", routing, ["ether1", "ether2"])
    })
  });
  function get(type, id = "generic") {
    if (!Object.hasOwn(REGISTRY, type) || typeof id !== "string" || !Object.hasOwn(REGISTRY[type], id))
      throw new TypeError("Profile incompatível com o tipo de equipamento.");
    return REGISTRY[type][id];
  }
  function list(type) { get(type); return Object.values(REGISTRY[type]); }
  function interfaceName(device, interfaceId) {
    const index = device.interfaces.indexOf(interfaceId);
    if (index < 0) throw new TypeError("Interface não pertence ao equipamento.");
    return get(device.type, device.profile ?? "generic").interfaceNames[index];
  }
  function prompt(device) { return get(device.type, device.profile ?? "generic").terminal.promptTemplate.replace("{name}", device.name); }
  return Object.freeze({VERSION: 1, REGISTRY, get, list, interfaceName, prompt});
});
