(() => {
  "use strict";
  const one = (selector, scope = document) => scope?.querySelector(selector);
  const all = (selector, scope = document) => [...(scope?.querySelectorAll(selector) || [])];
  const basicRoutes = JSON.parse(one("#route-basic-data")?.textContent || "[]");
  const specificRoutes = JSON.parse(one("#route-specific-data")?.textContent || "[]");
  const root = one("[data-route-visualizer]");
  const tool = root?.routeVisualizer;
  const consequence = one("[data-route-consequence]");
  let mode = "basic";
  let terminalDevice = "host";

  function clearConsequence() {
    consequence.hidden = true;
    one("[data-route-synthesis]").textContent = "Escolha uma rota para ver a síntese da decisão.";
  }
  function setMode(nextMode, destination) {
    mode = nextMode;
    tool.setRoutes(mode === "basic" ? basicRoutes : specificRoutes, destination);
    clearConsequence();
    all("[data-route-preset], [data-specificity-destination]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.routePreset === destination || button.dataset.specificityDestination === destination)));
  }
  all("[data-route-preset]").forEach((button) => button.addEventListener("click", () => setMode("basic", button.dataset.routePreset)));
  all("[data-specificity-destination]").forEach((button) => button.addEventListener("click", () => setMode("specific", button.dataset.specificityDestination)));
  one("[data-route-basic]")?.addEventListener("click", () => setMode("basic", "192.168.20.50"));
  root?.addEventListener("routevisualizer:cleared", clearConsequence);
  root?.addEventListener("routevisualizer:revealed", (event) => {
    const {destination, selected} = event.detail;
    const direct = selected.nextHop === "DIRECT";
    const defaultRoute = selected.prefix === "0.0.0.0/0";
    const destinationMac = direct ? "MAC do host de destino" : selected.nextHop === "10.0.0.2" ? "MAC de R2" : `MAC do roteador ${selected.nextHop}`;
    let outcome;
    if (direct) outcome = `${destination} está na LAN: entrega direta pela interface ${selected.interface}, sem roteador intermediário.`;
    else if (defaultRoute) outcome = `Nenhuma rota mais específica combinou. A rota padrão sai por ${selected.interface} para o next hop ${selected.nextHop}.`;
    else outcome = `A rota ${selected.prefix} vence pelo prefixo mais longo. Saída ${selected.interface}; next hop ${selected.nextHop}.`;
    one("[data-route-consequence-copy]").textContent = outcome;
    one("[data-route-frame-copy]").textContent = `Novo frame: Destination MAC = ${destinationMac} no enlace de saída. Pacote: Destination IP permanece ${destination}.`;
    consequence.hidden = false;
    one("[data-route-synthesis]").textContent = `Síntese: ${destination} → ${selected.prefix} → ${direct ? "entrega direta" : selected.nextHop} pela ${selected.interface}.`;
  });

  function setupTerminal() {
    const terminal = one("[data-route-terminal]");
    const stage = one("[data-terminal-stage]", terminal);
    const note = one("[data-terminal-explain]", terminal);
    all("[data-terminal-device]", terminal).forEach((button) => button.addEventListener("click", () => {
      terminalDevice = button.dataset.terminalDevice;
      all("[data-terminal-device]", terminal).forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      one("[data-terminal-form] label span", terminal).textContent = terminalDevice === "host" ? "C:\\Users\\Aluno>" : "R1#";
      stage.replaceChildren();
      note.textContent = terminalDevice === "host" ? "Contexto: PC-A Windows." : "Contexto: roteador R1 simulado.";
    }));
    function output(rawCommand) {
      const command = rawCommand.trim().toLowerCase();
      const block = document.createElement("pre");
      if (terminalDevice === "host" && command === "route print") {
        block.textContent = "PC-A · Windows\nDestino             Máscara           Gateway          Interface\n192.168.10.0        255.255.255.0    On-link          192.168.10.25\n0.0.0.0             0.0.0.0          192.168.10.1     192.168.10.25";
        note.textContent = "No host, o destino local é on-link; os demais seguem pela rota padrão ao gateway 192.168.10.1.";
      } else if (terminalDevice === "host" && command === "get-netroute") {
        block.textContent = "PC-A · Windows\nDestinationPrefix  NextHop        InterfaceAlias\n192.168.10.0/24    0.0.0.0        Ethernet\n0.0.0.0/0          192.168.10.1   Ethernet";
        note.textContent = "Get-NetRoute mostra as mesmas duas decisões da tabela do host.";
      } else if (terminalDevice === "router" && command === "show ip route") {
        block.textContent = mode === "basic"
          ? "R1 · tabela principal\nC 192.168.10.0/24 is directly connected, LAN\nC 10.0.0.0/30 is directly connected, WAN1\nC 203.0.113.0/30 is directly connected, WAN2\nS 192.168.20.0/24 via 10.0.0.2, WAN1\nS* 0.0.0.0/0 via 203.0.113.1, WAN2"
          : "R1 · prática de especificidade\nC 10.0.0.0/30 is directly connected, WAN1\nC 10.0.1.0/30 is directly connected, WAN3\nC 10.0.2.0/30 is directly connected, WAN4\nC 203.0.113.0/30 is directly connected, WAN2\nS 10.0.0.0/8 via 10.0.0.2, WAN1\nS 10.10.0.0/16 via 10.0.1.2, WAN3\nS 10.10.20.0/24 via 10.0.2.2, WAN4\nS* 0.0.0.0/0 via 203.0.113.1, WAN2";
        note.textContent = "R1 pode alcançar cada next hop pela rede da interface indicada.";
      } else {
        block.textContent = `Comando não disponível em ${terminalDevice === "host" ? "PC-A Windows" : "R1"}: ${rawCommand || "(vazio)"}.`;
        note.textContent = terminalDevice === "host" ? "Use route print ou Get-NetRoute no host Windows." : "Use show ip route no roteador simulado.";
      }
      stage.appendChild(block);
    }
    all("[data-command]", terminal).forEach((button) => button.addEventListener("click", () => output(button.dataset.command)));
    one("[data-terminal-form]", terminal)?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = one("[data-terminal-input]", terminal);
      output(input.value);
      input.value = "";
    });
  }
  one("[data-reference-reveal]")?.addEventListener("click", (event) => {
    one("[data-reference]", event.currentTarget.closest("[data-route-explanation]")).hidden = false;
  });

  function setupCheckpoint() {
    const checkpoint = one("#route-checkpoint");
    const memory = new Map();
    const number = () => one(".gateway-checkpoint-header>strong", checkpoint)?.textContent.trim().split(" ")[0] || "start";
    function capture() { const values = {}; all("[data-route-answer-field]", checkpoint).forEach((field) => { values[field.dataset.routeAnswerField] = field.value; }); memory.set(number(), values); return values; }
    function restore() { const values = memory.get(number()) || {}; all("[data-route-answer-field]", checkpoint).forEach((field) => { if (values[field.dataset.routeAnswerField] !== undefined) field.value = values[field.dataset.routeAnswerField]; }); }
    checkpoint?.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-route-checkpoint-form]");
      if (!form) return;
      event.preventDefault();
      if (form.matches("[data-answer-form]")) one("[data-answer-payload]", form).value = JSON.stringify(capture());
      if (form.matches("[data-reset-current]")) memory.delete(number());
      if (form.matches("[data-checkpoint-next], [data-checkpoint-restart]")) memory.clear();
      try {
        const response = await fetch(form.action, {method: "POST", body: new FormData(form), headers: {"X-Requested-With": "XMLHttpRequest"}});
        if (!response.ok) throw new Error("Falha ao atualizar o checkpoint.");
        const data = await response.json();
        checkpoint.innerHTML = data.html;
        restore();
      } catch (error) {
        const node = document.createElement("p");
        node.className = "gateway-feedback is-error";
        node.textContent = error.message;
        checkpoint.appendChild(node);
      }
    });
  }
  setupTerminal();
  setupCheckpoint();
})();
