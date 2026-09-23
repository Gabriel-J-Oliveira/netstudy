(() => {
  "use strict";
  function ipToInt(ip) {
    const parts = String(ip).trim().split(".");
    if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return null;
    return parts.reduce((value, part) => ((value << 8) | Number(part)) >>> 0, 0) >>> 0;
  }
  function routeMatches(ip, prefix) {
    const [network, lengthText] = prefix.split("/");
    const length = Number(lengthText);
    const ipValue = ipToInt(ip);
    const networkValue = ipToInt(network);
    if (ipValue === null || networkValue === null || !Number.isInteger(length) || length < 0 || length > 32) return false;
    const mask = length === 0 ? 0 : (0xffffffff << (32 - length)) >>> 0;
    return (ipValue & mask) === (networkValue & mask);
  }
  function selectRoute(ip, routes) {
    const matches = routes.filter((route) => routeMatches(ip, route.prefix));
    matches.sort((a, b) => Number(b.prefix.split("/")[1]) - Number(a.prefix.split("/")[1]));
    return {matches, selected: matches[0] || null};
  }
  class RoutingTableVisualizer {
    constructor(root) {
      this.root = root;
      this.input = root.querySelector("[data-route-destination]");
      this.rowsRoot = root.querySelector("[data-route-rows]");
      this.initialDestination = this.input.value;
      this.initialRoutes = this.readRoutes();
      this.configuredRoutes = this.initialRoutes;
      this.configuredDestination = this.initialDestination;
      this.currentResult = null;
      this.chosen = null;
      this.bind();
    }
    readRoutes() {
      return [...this.rowsRoot.querySelectorAll("[data-prefix]")].map((row) => ({prefix: row.dataset.prefix, nextHop: row.dataset.nextHop, interface: row.dataset.interface}));
    }
    routes() {
      return [...this.rowsRoot.querySelectorAll("[data-prefix]")].map((row) => ({prefix: row.dataset.prefix, nextHop: row.dataset.nextHop, interface: row.dataset.interface, row}));
    }
    resultMessage(message) { this.root.querySelector("[data-route-result]").textContent = message; }
    bind() {
      this.root.querySelector("[data-route-run]").addEventListener("click", () => this.test());
      this.root.querySelector("[data-route-reset]").addEventListener("click", () => this.reset());
      this.root.querySelector("[data-route-reveal]").addEventListener("click", () => this.reveal());
      this.input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); this.test(); } });
      this.input.addEventListener("input", () => { if (this.currentResult) this.clearState(); });
      this.rowsRoot.addEventListener("click", (event) => {
        const button = event.target.closest("[data-route-select]");
        if (button) this.choose(button.closest("[data-prefix]"));
      });
    }
    setRoutes(routes, destination = this.input.value) {
      this.configuredRoutes = routes.map((route) => ({prefix: route.prefix, nextHop: route.nextHop ?? route.next_hop, interface: route.interface}));
      this.configuredDestination = destination;
      this.rowsRoot.replaceChildren();
      this.configuredRoutes.forEach((route) => {
        const row = document.createElement("div");
        row.className = "route-row";
        row.setAttribute("role", "row");
        row.dataset.prefix = route.prefix;
        row.dataset.nextHop = route.nextHop;
        row.dataset.interface = route.interface;
        [["Prefixo", route.prefix], ["Próximo salto", route.nextHop], ["Interface", route.interface]].forEach(([label, value]) => {
          const cell = document.createElement("span");
          cell.className = "route-cell";
          cell.dataset.cellLabel = label;
          cell.textContent = value;
          row.append(cell);
        });
        const label = document.createElement("strong");
        label.dataset.routeLabel = "";
        label.dataset.cellLabel = "Resultado";
        label.textContent = "AGUARDANDO";
        row.append(label);
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.routeSelect = "";
        button.setAttribute("aria-label", `Escolher rota ${route.prefix}`);
        button.textContent = "Escolher esta rota";
        button.disabled = true;
        row.append(button);
        this.rowsRoot.append(row);
      });
      this.input.value = destination;
      this.clearState();
      this.root.dispatchEvent(new CustomEvent("routevisualizer:configured", {bubbles: true, detail: {destination}}));
    }
    clearState() {
      this.currentResult = null;
      this.chosen = null;
      this.routes().forEach(({row}) => {
        row.classList.remove("is-match", "is-selected", "is-no-match");
        row.querySelector("[data-route-label]").textContent = "AGUARDANDO";
        row.querySelector("[data-route-select]").disabled = true;
        row.querySelector("[data-route-select]").setAttribute("aria-pressed", "false");
      });
      this.root.querySelector("[data-route-reveal]").disabled = true;
      this.resultMessage("Teste as correspondências antes de escolher uma rota.");
      this.root.dispatchEvent(new CustomEvent("routevisualizer:cleared", {bubbles: true}));
    }
    test(destination = this.input.value.trim()) {
      this.input.value = destination;
      this.clearState();
      if (ipToInt(destination) === null) {
        this.resultMessage("Informe um endereço IPv4 válido.");
        return null;
      }
      const result = selectRoute(destination, this.routes());
      this.currentResult = {destination, ...result};
      this.routes().forEach(({row}) => {
        const matched = result.matches.some((route) => route.row === row);
        row.classList.toggle("is-match", matched);
        row.classList.toggle("is-no-match", !matched);
        row.querySelector("[data-route-label]").textContent = matched ? "COMPATÍVEL" : "NÃO COMBINA";
        row.querySelector("[data-route-select]").disabled = false;
      });
      this.resultMessage(result.matches.length ? `${result.matches.length} rota(s) compatível(is). Compare os comprimentos e escolha a melhor rota.` : "Nenhuma rota compatível. R1 não tem caminho para encaminhar esse pacote.");
      this.root.dispatchEvent(new CustomEvent("routevisualizer:tested", {bubbles: true, detail: this.currentResult}));
      return this.currentResult;
    }
    choose(row) {
      const result = this.currentResult;
      if (!result) return this.resultMessage("Teste as correspondências antes de escolher.");
      const route = this.routes().find((item) => item.row === row);
      if (!routeMatches(result.destination, route.prefix)) return this.resultMessage(`${route.prefix} não combina com ${result.destination}. Escolha uma rota compatível.`);
      if (route.prefix !== result.selected.prefix) return this.resultMessage(`${route.prefix} combina, mas é menos específica que ${result.selected.prefix}. Compare os comprimentos dos prefixos.`);
      this.chosen = route;
      this.routes().forEach((item) => {
        const selected = item.row === row;
        item.row.classList.toggle("is-selected", selected);
        item.row.querySelector("[data-route-select]").setAttribute("aria-pressed", String(selected));
        if (item.row.classList.contains("is-match")) item.row.querySelector("[data-route-label]").textContent = selected ? "COMPATÍVEL · VENCEDORA" : "COMPATÍVEL · NÃO ESCOLHIDA";
      });
      this.root.querySelector("[data-route-reveal]").disabled = false;
      this.resultMessage(`${route.prefix} é a rota compatível mais específica. Revele a consequência.`);
      this.root.dispatchEvent(new CustomEvent("routevisualizer:chosen", {bubbles: true, detail: {destination: result.destination, selected: route}}));
    }
    reveal() {
      if (!this.chosen || !this.currentResult) return;
      const selected = this.chosen;
      this.resultMessage(`Rota ${selected.prefix}: saída ${selected.interface}; ${selected.nextHop === "DIRECT" ? "entrega direta" : `next hop ${selected.nextHop}`}.`);
      this.root.dispatchEvent(new CustomEvent("routevisualizer:revealed", {bubbles: true, detail: {destination: this.currentResult.destination, selected}}));
    }
    reset() {
      this.setRoutes(this.configuredRoutes, this.configuredDestination);
      this.root.dispatchEvent(new CustomEvent("routevisualizer:reset", {bubbles: true}));
    }
  }
  function init(scope = document) {
    scope.querySelectorAll("[data-route-visualizer]").forEach((root) => {
      if (root.dataset.routeReady) return;
      root.dataset.routeReady = "true";
      root.routeVisualizer = new RoutingTableVisualizer(root);
    });
  }
  window.NetStudyRouting = {ipToInt, routeMatches, selectRoute, RoutingTableVisualizer, init};
  init();
})();
