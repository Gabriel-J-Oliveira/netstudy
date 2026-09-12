(() => {
  "use strict";
  function ipToInt(ip) {
    const parts = String(ip).trim().split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    return parts.reduce((value, octet) => ((value << 8) | octet) >>> 0, 0) >>> 0;
  }
  function routeMatches(ip, prefix) {
    const [network, lengthText] = prefix.split("/"), length = Number(lengthText);
    const ipValue = ipToInt(ip), networkValue = ipToInt(network);
    if (ipValue === null || networkValue === null || length < 0 || length > 32) return false;
    const mask = length === 0 ? 0 : (0xffffffff << (32 - length)) >>> 0;
    return (ipValue & mask) === (networkValue & mask);
  }
  function selectRoute(ip, routes) {
    const matches = routes.filter((route) => routeMatches(ip, route.prefix));
    matches.sort((a, b) => Number(b.prefix.split("/")[1]) - Number(a.prefix.split("/")[1]));
    return {matches, selected: matches[0] || null};
  }
  class RoutingTableVisualizer {
    constructor(root) { this.root = root; this.input = root.querySelector("[data-route-destination]"); this.rows = [...root.querySelectorAll("[data-prefix]")]; this.initial = this.input.value; this.bind(); }
    routes() { return this.rows.map((row) => ({prefix: row.dataset.prefix, nextHop: row.dataset.nextHop, interface: row.dataset.interface, row})); }
    bind() {
      this.root.querySelector("[data-route-run]").addEventListener("click", () => this.run());
      this.root.querySelector("[data-route-reset]").addEventListener("click", () => this.reset());
      this.rows.forEach((row) => row.addEventListener("click", () => { row.focus(); this.root.querySelector("[data-route-result]").textContent = `Rota ${row.dataset.prefix}: next hop ${row.dataset.nextHop}, interface ${row.dataset.interface}.`; }));
    }
    run(destination = this.input.value.trim()) {
      this.input.value = destination;
      if (ipToInt(destination) === null) { this.root.querySelector("[data-route-result]").textContent = "Informe um endereço IPv4 válido."; return null; }
      const result = selectRoute(destination, this.routes());
      this.rows.forEach((row) => {
        const matched = result.matches.some((route) => route.row === row), selected = result.selected?.row === row;
        row.classList.toggle("is-match", matched); row.classList.toggle("is-selected", selected); row.classList.toggle("is-no-match", !matched);
        row.querySelector("[data-route-label]").textContent = selected ? "MATCH · SELECIONADA" : matched ? "MATCH" : "NO MATCH";
      });
      const selected = result.selected;
      this.root.querySelector("[data-route-result]").textContent = selected ? `${selected.prefix} é a rota compatível mais específica. Saída: ${selected.interface}; ${selected.nextHop === "DIRECT" ? "entrega direta" : `next hop ${selected.nextHop}`}.` : "Nenhuma rota combina com esse destino.";
      this.root.dispatchEvent(new CustomEvent("routevisualizer:selected", {bubbles:true, detail:{destination, selected}}));
      return result;
    }
    reset() { this.input.value = this.initial; this.rows.forEach((row) => { row.classList.remove("is-match","is-selected","is-no-match"); row.querySelector("[data-route-label]").textContent="AGUARDANDO"; }); this.root.querySelector("[data-route-result]").textContent="Insira um destino e teste as linhas."; }
  }
  function init(scope=document) { scope.querySelectorAll("[data-route-visualizer]").forEach((root) => { if(root.dataset.routeReady) return; root.dataset.routeReady="true"; root.routeVisualizer=new RoutingTableVisualizer(root); }); }
  window.NetStudyRouting={ipToInt,routeMatches,selectRoute,RoutingTableVisualizer,init}; init();
})();
