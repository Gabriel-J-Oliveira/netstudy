(() => {
  "use strict";
  const one = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const lab = one("[data-dhcp-lab]");
  if (!lab) return;

  const messages = [
    {actor: "client", name: "Aguardando Discover", direction: "Cliente ainda não enviou mensagem.", content: "Cliente sem IPv4 configurado.", feedback: "O cliente ainda não recebeu uma concessão.", next: "Enviar Discover"},
    {actor: "client", name: "Discover", direction: "Cliente → rede local (broadcast) → servidor DHCP", content: "Procura um servidor DHCP neste cenário local.", feedback: "O Discover procura o servidor; o cliente continua sem IPv4 configurado.", next: "Observar Offer"},
    {actor: "server", name: "Offer", direction: "Servidor DHCP 192.168.10.53 → cliente", content: "Proposta: IPv4 192.168.10.50/24, gateway 192.168.10.1 e DNS 192.168.10.53.", feedback: "A Offer propõe estes parâmetros. Eles ainda não estão aplicados no cliente.", next: "Enviar Request"},
    {actor: "client", name: "Request", direction: "Cliente → servidor DHCP", content: "Solicita a configuração oferecida: 192.168.10.50/24, gateway 192.168.10.1 e DNS 192.168.10.53.", feedback: "O Request solicita a oferta; ainda falta a confirmação do servidor.", next: "Observar ACK"},
    {actor: "server", name: "ACK", direction: "Servidor DHCP 192.168.10.53 → cliente", content: "Concessão confirmada: IPv4 192.168.10.50/24, gateway 192.168.10.1 e DNS 192.168.10.53.", feedback: "O ACK confirmou a concessão. Agora os parâmetros aparecem aplicados no cliente; a concessão é temporária e pode precisar de renovação.", next: null},
  ];
  const fieldUse = {
    ip: "IPv4 192.168.10.50 identifica este host no cenário.",
    mask: "Máscara 255.255.255.0 (/24) ajuda a identificar a rede local.",
    gateway: "Gateway 192.168.10.1 é o próximo salto para uma rede remota.",
    dns: "DNS 192.168.10.53 é consultado para resolver nomes; DHCP não faz essa resolução.",
  };
  const state = {phase: 0, mode: "normal", leaseConfirmed: false, selectedField: null};
  const next = one("[data-dhcp-next]", lab);
  const feedback = one("[data-dhcp-feedback]", lab);
  const terminal = one("[data-dhcp-terminal]", lab);
  const terminalOutput = one("[data-dhcp-terminal-output]", lab);

  function allOutput() {
    if (state.mode === "missing") {
      return "Saída simulada no cliente Windows\nDHCP Enabled: Yes\nIPv4 Address: 169.254.10.50 (APIPA observado neste cenário)\nSubnet Mask: 255.255.0.0\nDefault Gateway: (não configurado)\nDNS Servers: (não configurado)\nConcessão DHCP esperada não observada; causa indeterminada.";
    }
    if (!state.leaseConfirmed || state.phase < 4) {
      return "Saída simulada no cliente Windows\nDHCP Enabled: Yes\nIPv4 Address: (ainda não configurado)\nSubnet Mask: (não configurada)\nDefault Gateway: (não configurado)\nDNS Servers: (não configurado)\nOferta, se recebida, ainda não é concessão aplicada.";
    }
    return "Saída simulada no cliente Windows\nDHCP Enabled: Yes\nIPv4 Address: 192.168.10.50\nSubnet Mask: 255.255.255.0\nDefault Gateway: 192.168.10.1\nDHCP Server: 192.168.10.53\nDNS Servers: 192.168.10.53\nConcessão temporária confirmada.";
  }
  function refreshTerminal() {
    if (one("input", terminal).value.trim() === "ipconfig /all") terminalOutput.textContent = allOutput();
  }
  function evidence() {
    if (state.mode === "missing") return [
      "Endereço 169.254.10.50/16 no cliente Windows simulado; a concessão esperada não aparece.",
      "A concessão DHCP esperada não foi recebida neste cenário.",
      "Servidor desligado não está comprovado. Alcance, VLAN, servidor e conectividade ainda precisam ser investigados.",
    ];
    if (state.phase === 4) return [
      "IPv4 192.168.10.50/24, gateway e DNS aparecem no cliente após o ACK.",
      "A concessão foi confirmada e os parâmetros estão configurados.",
      "Ainda não sabemos se DNS, gateway ou serviço remoto respondem agora.",
    ];
    if (state.phase >= 2) return [
      "O servidor apresentou ou recebeu uma proposta de configuração.",
      "Ainda não há ACK; a configuração não foi aplicada ao cliente.",
      "O resultado final da solicitação ainda não foi observado.",
    ];
    return [
      "Cliente ainda sem IPv4 configurado.",
      "Ainda não há concessão aplicada.",
      "Não há causa de falha determinada por este estado inicial.",
    ];
  }
  function render() {
    const missing = state.mode === "missing";
    const message = missing && state.phase === 1
      ? {actor: "client", name: "Discover sem resposta", direction: "Cliente → rede local (broadcast); nenhuma Offer observada", content: "O cliente procurou um servidor, mas não recebeu a oferta neste cenário.", feedback: "Sem Offer e ACK, não há concessão aplicada. A causa ainda precisa ser investigada.", next: null}
      : missing
        ? {actor: "client", name: "Sem concessão esperada", direction: "Nenhuma resposta DHCP observada nesta comparação.", content: "Windows mostra 169.254.10.50/16 como observação possível.", feedback: "APIPA é uma pista de ausência da concessão esperada, não prova que o servidor está desligado.", next: "Enviar Discover"}
        : messages[state.phase];
    lab.dataset.actor = message.actor;
    lab.dataset.phase = String(state.phase);
    lab.dataset.mode = state.mode;
    one("[data-dhcp-message-name]", lab).textContent = message.name;
    one("[data-dhcp-direction]", lab).textContent = message.direction;
    one("[data-dhcp-message-content]", lab).textContent = message.content;
    const applied = !missing && state.phase === 4;
    one("[data-dhcp-client]", lab).textContent = missing ? "169.254.10.50 · APIPA" : applied ? "192.168.10.50/24" : "Sem IPv4 configurado";
    const values = missing
      ? {ip: "169.254.10.50/16 · observado", mask: "255.255.0.0 · APIPA", gateway: "Não configurado", dns: "Não configurado"}
      : applied
        ? {ip: "192.168.10.50", mask: "255.255.255.0 (/24)", gateway: "192.168.10.1", dns: "192.168.10.53"}
        : {ip: "Não configurado", mask: "Não configurada", gateway: "Não configurado", dns: "Não configurado"};
    Object.entries(values).forEach(([key, value]) => { one(`[data-dhcp-client-field="${key}"]`, lab).textContent = value; });
    all("[data-dhcp-progress]", lab).forEach(item => {
      const phase = Number(item.dataset.dhcpProgress);
      item.classList.toggle("is-current", !missing && phase === state.phase);
      item.classList.toggle("is-done", !missing && phase < state.phase);
    });
    feedback.textContent = message.feedback;
    next.hidden = !message.next;
    if (message.next) next.textContent = message.next;
    one("[data-dhcp-inspect]", lab).hidden = !applied;
    if (!applied) state.selectedField = null;
    all("[data-dhcp-field]", lab).forEach(button => {
      const selected = applied && button.dataset.dhcpField === state.selectedField;
      button.setAttribute("aria-pressed", String(selected));
      one(`[data-dhcp-client-field="${button.dataset.dhcpField}"]`, lab).classList.toggle("is-highlighted", selected);
    });
    one("[data-dhcp-field-use]", lab).textContent = state.selectedField ? fieldUse[state.selectedField] : "Selecione um campo para ver sua função na comunicação posterior.";
    const [observed, safe, unknown] = evidence();
    one("[data-dhcp-observed]", lab).textContent = observed;
    one("[data-dhcp-safe]", lab).textContent = safe;
    one("[data-dhcp-unknown]", lab).textContent = unknown;
    all("[data-dhcp-state]", lab).forEach(button => button.setAttribute("aria-pressed", String(button.dataset.dhcpState === (missing ? "missing" : "valid") && (missing || applied))));
    refreshTerminal();
  }
  next.addEventListener("click", () => {
    if (state.mode === "missing") {
      if (state.phase === 0) state.phase = 1;
    } else if (state.phase < 4) {
      state.phase += 1;
      if (state.phase === 4) state.leaseConfirmed = true;
    }
    render();
  });
  one("[data-dhcp-reset]", lab).addEventListener("click", () => {
    state.phase = 0;
    state.mode = "normal";
    state.leaseConfirmed = false;
    state.selectedField = null;
    render();
  });
  all("[data-dhcp-field]", lab).forEach(button => button.addEventListener("click", () => {
    if (state.mode === "missing" || state.phase !== 4) return;
    state.selectedField = button.dataset.dhcpField;
    render();
  }));
  all("[data-dhcp-state]", lab).forEach(button => button.addEventListener("click", () => {
    if (button.dataset.dhcpState === "missing") {
      state.mode = "missing";
      state.phase = 0;
      state.selectedField = null;
      render();
    } else if (state.leaseConfirmed) {
      state.mode = "normal";
      state.phase = 4;
      render();
    } else {
      feedback.textContent = "Ainda não há concessão válida para comparar. Complete o DORA ou use ipconfig /renew com o servidor acessível.";
    }
  }));
  terminal?.addEventListener("submit", event => {
    event.preventDefault();
    const command = one("input", terminal).value.trim();
    if (command === "ipconfig /all") {
      terminalOutput.textContent = allOutput();
    } else if (command === "ipconfig /renew") {
      if (state.mode === "missing") {
        state.phase = 1;
        render();
        terminalOutput.textContent = "Renovação simulada no cliente Windows\nDiscover enviado; nenhuma Offer ou ACK observada.\nA concessão esperada não foi obtida.\nIPv4 observado: 169.254.10.50 (APIPA).\nA causa da ausência de resposta permanece indeterminada.";
      } else {
        state.phase = 4;
        state.leaseConfirmed = true;
        state.selectedField = null;
        render();
        terminalOutput.textContent = "Renovação simulada no cliente Windows\nServidor acessível neste cenário: Discover → Offer → Request → ACK.\nConcessão temporária confirmada e aplicada.\nIPv4 Address: 192.168.10.50\nSubnet Mask: 255.255.255.0\nDefault Gateway: 192.168.10.1\nDNS Servers: 192.168.10.53";
      }
    } else {
      terminalOutput.textContent = "Comando não disponível neste cenário. Use ipconfig /all ou ipconfig /renew.";
    }
  });

  const checkpoint = one("#dhcp-checkpoint"), memory = new Map();
  const currentNumber = () => one(".gateway-checkpoint-header>strong", checkpoint)?.textContent.split(" ")[0] || "start";
  function capture() {
    const values = {};
    all("[data-dhcp-answer]", checkpoint).forEach(field => { values[field.dataset.dhcpAnswer] = field.value; });
    memory.set(currentNumber(), values);
    return values;
  }
  function restore() {
    const values = memory.get(currentNumber()) || {};
    all("[data-dhcp-answer]", checkpoint).forEach(field => { if (values[field.dataset.dhcpAnswer] !== undefined) field.value = values[field.dataset.dhcpAnswer]; });
  }
  checkpoint?.addEventListener("submit", async event => {
    const form = event.target.closest("[data-dhcp-checkpoint-form]");
    if (!form) return;
    event.preventDefault();
    if (form.matches("[data-answer-form]")) one("[data-payload]", form).value = JSON.stringify(capture());
    if (form.matches("[data-reset]")) memory.delete(currentNumber());
    if (form.matches("[data-next], [data-restart]")) memory.clear();
    try {
      const response = await fetch(form.action, {method: "POST", body: new FormData(form), headers: {"X-Requested-With": "XMLHttpRequest"}});
      if (!response.ok) throw Error("Falha ao atualizar checkpoint.");
      const data = await response.json(); checkpoint.innerHTML = data.html; restore();
    } catch (error) {
      const note = document.createElement("p"); note.className = "gateway-feedback is-error"; note.textContent = error.message; checkpoint.appendChild(note);
    }
  });
  render();
})();
