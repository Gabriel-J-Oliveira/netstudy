(() => {
  "use strict";

  function ipToInt(ip) {
    const parts = String(ip).trim().split(".").map(Number);
    if (parts.length !== 4 || parts.some((number) => !Number.isInteger(number) || number < 0 || number > 255)) return null;
    return parts.reduce((value, octet) => ((value << 8) | octet) >>> 0, 0) >>> 0;
  }

  function routeMatches(ip, prefix) {
    const [network, lengthText] = prefix.split("/");
    const length = Number(lengthText);
    const ipValue = ipToInt(ip);
    const networkValue = ipToInt(network);
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
    constructor(root) {
      this.root = root;
      this.input = root.querySelector("[data-route-destination]");
      this.rowsRoot = root.querySelector("[data-route-rows]");
      this.initialDestination = this.input.value;
      this.initialRoutes = this.readRoutes();
      this.configuredDestination = this.initialDestination;
      this.configuredRoutes = this.initialRoutes;
      this.currentResult = null;
      this.bind();
    }

    readRoutes() {
      return [...this.root.querySelectorAll("[data-prefix]")].map((row) => ({
        prefix: row.dataset.prefix,
        nextHop: row.dataset.nextHop,
        interface: row.dataset.interface,
      }));
    }

    routes() {
      return [...this.root.querySelectorAll("[data-prefix]")].map((row) => ({
        prefix: row.dataset.prefix,
        nextHop: row.dataset.nextHop,
        interface: row.dataset.interface,
        row,
      }));
    }

    bind() {
      this.root.querySelector("[data-route-run]").addEventListener("click", () => this.run());
      this.root.querySelector("[data-route-reset]").addEventListener("click", () => this.reset());
      this.input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); this.run(); }
      });
      this.rowsRoot.addEventListener("click", (event) => {
        const field = event.target.closest("[data-route-field]");
        if (field) this.inspectField(field);
      });
    }

    normalize(route) {
      return {
        prefix: route.prefix,
        nextHop: route.nextHop ?? route.next_hop,
        interface: route.interface,
      };
    }

    makeField(name, value) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.routeField = name;
      button.textContent = value;
      button.setAttribute("aria-label", `${name === "prefix" ? "Destination Prefix" : name === "nextHop" ? "Next Hop" : "Interface"} ${value}`);
      button.setAttribute("aria-pressed", "false");
      return button;
    }

    setRoutes(routes, destination = this.input.value) {
      this.configuredRoutes = routes.map((route) => this.normalize(route));
      this.configuredDestination = destination;
      this.rowsRoot.replaceChildren();
      this.configuredRoutes.forEach((route) => {
        const row = document.createElement("div");
        row.className = "route-row";
        row.setAttribute("role", "row");
        row.dataset.prefix = route.prefix;
        row.dataset.nextHop = route.nextHop;
        row.dataset.interface = route.interface;
        row.append(this.makeField("prefix", route.prefix), this.makeField("nextHop", route.nextHop), this.makeField("interface", route.interface));
        const label = document.createElement("strong");
        label.dataset.routeLabel = "";
        label.textContent = "AGUARDANDO";
        row.append(label);
        this.rowsRoot.append(row);
      });
      this.input.value = destination;
      this.currentResult = null;
      this.resultMessage("Informe um destino e teste as linhas.");
      this.root.dispatchEvent(new CustomEvent("routevisualizer:configured", {bubbles: true, detail: {destination, routes: this.routes()}}));
    }

    clearState() {
      this.routes().forEach(({row}) => {
        row.classList.remove("is-match", "is-selected", "is-no-match", "is-inspected");
        row.querySelectorAll("[data-route-field]").forEach((field) => { field.classList.remove("is-field-selected"); field.setAttribute("aria-pressed", "false"); });
        row.querySelector("[data-route-label]").textContent = "AGUARDANDO";
      });
    }

    resultMessage(message) { this.root.querySelector("[data-route-result]").textContent = message; }

    test(destination = this.input.value.trim()) {
      this.input.value = destination;
      this.clearState();
      if (ipToInt(destination) === null) {
        this.currentResult = null;
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
      });
      this.resultMessage(result.matches.length ? `${result.matches.length} rota(s) compatível(is). Agora compare o comprimento dos prefixos.` : "Nenhuma rota combina com esse destino.");
      this.root.dispatchEvent(new CustomEvent("routevisualizer:tested", {bubbles: true, detail: this.currentResult}));
      return this.currentResult;
    }

    selectBest() {
      const result = this.currentResult || this.test();
      if (!result?.selected) return null;
      result.matches.forEach((route) => {
        const selected = route.row === result.selected.row;
        route.row.classList.toggle("is-selected", selected);
        route.row.querySelector("[data-route-label]").textContent = selected ? "COMPATÍVEL · VENCEDORA" : "COMPATÍVEL · NÃO ESCOLHIDA";
      });
      const selected = result.selected;
      this.resultMessage(`${selected.prefix} é a rota compatível mais específica. Saída: ${selected.interface}; ${selected.nextHop === "DIRECT" ? "entrega direta" : `Next Hop ${selected.nextHop}`}.`);
      this.root.dispatchEvent(new CustomEvent("routevisualizer:selected", {bubbles: true, detail: {destination: result.destination, matches: result.matches, selected}}));
      return result;
    }

    run(destination = this.input.value.trim()) {
      const result = this.test(destination);
      return result ? this.selectBest() : null;
    }

    inspectField(field) {
      const row = field.closest("[data-prefix]");
      this.root.querySelectorAll("[data-route-field]").forEach((item) => { item.classList.toggle("is-field-selected", item === field); item.setAttribute("aria-pressed", item === field ? "true" : "false"); });
      this.root.querySelectorAll("[data-prefix]").forEach((item) => item.classList.toggle("is-inspected", item === row));
      const name = field.dataset.routeField;
      const messages = {
        prefix: `Destination Prefix ${row.dataset.prefix}: conjunto de destinos que esta rota alcança.`,
        nextHop: row.dataset.nextHop === "DIRECT" ? "Next Hop DIRECT / ON-LINK: nenhum roteador intermediário neste enlace." : `Next Hop ${row.dataset.nextHop}: outro roteador receberá o novo frame.`,
        interface: `Interface ${row.dataset.interface}: saída local usada para o encaminhamento.`,
      };
      this.resultMessage(messages[name]);
      this.root.dispatchEvent(new CustomEvent("routevisualizer:field", {bubbles: true, detail: {field: name, row, route: {prefix: row.dataset.prefix, nextHop: row.dataset.nextHop, interface: row.dataset.interface}}}));
    }

    selectField(name) {
      const row = this.currentResult?.selected?.row;
      const field = row?.querySelector(`[data-route-field="${name}"]`);
      if (field) this.inspectField(field);
    }

    selectFields(names) {
      const row = this.currentResult?.selected?.row;
      if (!row) return;
      this.root.querySelectorAll("[data-route-field]").forEach((field) => {
        const selected = row.contains(field) && names.includes(field.dataset.routeField);
        field.classList.toggle("is-field-selected", selected);
        field.setAttribute("aria-pressed", selected ? "true" : "false");
      });
      this.root.querySelectorAll("[data-prefix]").forEach((item) => item.classList.toggle("is-inspected", item === row));
      this.resultMessage(`Next Hop ${row.dataset.nextHop} e interface ${row.dataset.interface} orientam o próximo encaminhamento.`);
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
