(() => {
  "use strict";
  const one = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const lab = one("[data-endpoint-lab]");
  if (!lab) return;
  const services = {
    web: {protocol: "TCP", port: "443", label: "Serviço web"},
    ssh: {protocol: "TCP", port: "22", label: "SSH"},
    dns: {protocol: "UDP", port: "53", label: "DNS"},
  };
  const state = {scenario: "inspect", service: "web", step: -1, assembled: new Set()};
  const timeline = one("[data-lab-steps]", lab), feedback = one("[data-lab-feedback]", lab);
  const next = one("[data-lab-next]", lab), reply = one("[data-lab-reply]", lab);
  const assembly = one("[data-lab-assembly]", lab), flows = one("[data-lab-flows]", lab);
  const titles = {inspect: "Qual host? Qual serviço?", service: "Entrega ao serviço", assemble: "Monte o envio ao web", reply: "Resposta ao cliente", parallel: "Dois clientes, um serviço"};
  const stages = {
    inspect: ["Clique em Destination IP ou em Protocolo + Destination Port para inspecionar cada responsabilidade."],
    service: ["Pacote preparado para o servidor 192.168.20.30.", "O protocolo e a porta de destino selecionam o serviço dentro do servidor."],
    assemble: ["Selecione serviço web, porta temporária e protocolo.", "Envio montado: TCP 192.168.10.20:53012 → 192.168.20.30:443.", "O serviço web recebe dados no endpoint TCP 443."],
    reply: ["Envio original: TCP 192.168.10.20:53012 → 192.168.20.30:443.", "Resposta: TCP 192.168.20.30:443 → 192.168.10.20:53012."],
    parallel: ["Fluxo A: 192.168.10.20:53012 → 192.168.20.30:443.", "Fluxo B: 192.168.10.21:53013 → 192.168.20.30:443.", "Protocolo, IPs e portas de origem/destino distinguem os dois fluxos."],
  };
  function packet(reverse = false) {
    const service = services[state.service];
    const sourceIP = reverse ? "192.168.20.30" : "192.168.10.20";
    const sourcePort = reverse ? service.port : "53012";
    const destinationIP = reverse ? "192.168.10.20" : "192.168.20.30";
    const destinationPort = reverse ? "53012" : service.port;
    one("[data-packet-source-ip]", lab).textContent = sourceIP;
    one("[data-packet-source-port]", lab).textContent = sourcePort;
    one("[data-packet-destination-ip]", lab).textContent = destinationIP;
    one("[data-packet-destination-port]", lab).textContent = destinationPort;
    one("[data-packet-protocol]", lab).textContent = service.protocol;
    one("[data-field-host]", lab).textContent = destinationIP;
    one("[data-field-endpoint]", lab).textContent = `${service.protocol} ${destinationPort}`;
  }
  function render() {
    one("[data-lab-title]", lab).textContent = titles[state.scenario];
    lab.dataset.scenario = state.scenario;
    assembly.hidden = state.scenario !== "assemble";
    flows.hidden = state.scenario !== "parallel" || state.step < 0;
    all("[data-lab-service]", lab).forEach(button => button.setAttribute("aria-pressed", String(button.dataset.labService === state.service)));
    all("[data-assemble]", lab).forEach(button => button.setAttribute("aria-pressed", String(state.assembled.has(button.dataset.assemble))));
    all("[data-ports-open]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.portsOpen === state.scenario && (!button.dataset.service || button.dataset.service === state.service))));
    timeline.replaceChildren();
    const messages = state.step < 0 ? [stages[state.scenario][0]] : stages[state.scenario].slice(0, state.step + 1);
    messages.forEach(message => { const li = document.createElement("li"); li.textContent = message; timeline.appendChild(li); });
    const reversed = state.scenario === "reply" && state.step === 1;
    packet(reversed);
    next.hidden = state.scenario === "inspect" || state.scenario === "reply" || state.step >= stages[state.scenario].length - 1 || (state.scenario === "assemble" && state.assembled.size < 3);
    next.textContent = state.step < 0 ? "Iniciar entrega" : "Próxima etapa";
    reply.hidden = state.scenario !== "reply" || state.step >= 1;
  }
  function select(scenario, service = "web") {
    state.scenario = scenario; state.service = service; state.step = -1; state.assembled.clear();
    feedback.textContent = "";
    render();
    lab.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"});
    lab.focus({preventScroll: true});
  }
  all("[data-ports-open]").forEach(button => button.addEventListener("click", () => select(button.dataset.portsOpen, button.dataset.service)));
  all("[data-lab-service]", lab).forEach(button => button.addEventListener("click", () => {
    state.scenario = "service"; state.service = button.dataset.labService; state.step = 0;
    feedback.textContent = `${services[state.service].protocol} ${services[state.service].port} identifica o endpoint usado por ${services[state.service].label} no servidor.`;
    render();
  }));
  all("[data-lab-field]", lab).forEach(button => button.addEventListener("click", () => {
    const host = button.dataset.labField === "host";
    feedback.textContent = host
      ? "192.168.20.30 leva os dados ao servidor. Destination IP responde qual host receberá."
      : `${services[state.service].protocol} ${services[state.service].port} indica qual serviço deve receber dentro dele. Protocolo e Destination Port identificam o endpoint.`;
    all("[data-lab-field]", lab).forEach(field => field.setAttribute("aria-pressed", String(field === button)));
  }));
  all("[data-assemble]", lab).forEach(button => button.addEventListener("click", () => {
    if (state.scenario !== "assemble") select("assemble");
    state.assembled.add(button.dataset.assemble);
    const detail = {
      service: "Destino: TCP 443 pertence ao serviço web no servidor.",
      client: "Origem: 53012 é a porta temporária do cliente; ela não precisa ser 443.",
      protocol: "Protocolo: TCP faz parte da identificação desse endpoint.",
    };
    feedback.textContent = detail[button.dataset.assemble];
    render();
    if (state.assembled.size === 3) feedback.textContent += " Envio pronto: avance para observar a entrega.";
  }));
  next.addEventListener("click", () => {
    if (state.step < stages[state.scenario].length - 1) state.step += 1;
    if (state.scenario === "service" && state.step === 1) feedback.textContent = `O pacote chegou ao endpoint ${services[state.service].protocol} ${services[state.service].port} · ${services[state.service].label}.`;
    if (state.scenario === "parallel" && state.step === 2) feedback.textContent = "Mesmo destino TCP 443, origens diferentes: dois fluxos distinguíveis.";
    render();
  });
  reply.addEventListener("click", () => {
    state.step = 1;
    feedback.textContent = "Origem e destino se invertem; a resposta volta ao endpoint temporário 192.168.10.20:53012.";
    render();
  });
  one("[data-lab-reset]", lab).addEventListener("click", () => select(state.scenario, state.service));

  const terminal = one("[data-ports-terminal]");
  terminal?.addEventListener("submit", event => {
    event.preventDefault();
    const command = one("input", terminal).value.trim();
    const output = one("[data-ports-terminal-output]");
    if (command === "netstat -ano") {
      output.textContent = "TCP  192.168.10.20:53012  192.168.20.30:443  ESTABLISHED\nTCP  0.0.0.0:22           0.0.0.0:0           LISTENING\nUDP  0.0.0.0:53           *:*";
    } else if (command === "netstat -ano | findstr :443") {
      output.textContent = "TCP  192.168.10.20:53012  192.168.20.30:443  ESTABLISHED";
    } else {
      output.textContent = "Comando não disponível neste cenário. Use netstat -ano ou netstat -ano | findstr :443.";
    }
  });
  all("[data-reference-reveal]").forEach(button => button.addEventListener("click", () => {
    const card = button.closest("[data-self]");
    one("[data-reference]", card).hidden = false;
    one("textarea", card).readOnly = true;
    button.disabled = true;
  }));

  const checkpoint = one("#ports-checkpoint"), memory = new Map();
  const currentNumber = () => one(".gateway-checkpoint-header>strong", checkpoint)?.textContent.split(" ")[0] || "start";
  function capture() {
    const values = {};
    all("[data-ports-answer]", checkpoint).forEach(field => values[field.dataset.portsAnswer] = field.value);
    memory.set(currentNumber(), values);
    return values;
  }
  function restore() {
    const values = memory.get(currentNumber()) || {};
    all("[data-ports-answer]", checkpoint).forEach(field => { if (values[field.dataset.portsAnswer] !== undefined) field.value = values[field.dataset.portsAnswer]; });
  }
  checkpoint?.addEventListener("submit", async event => {
    const form = event.target.closest("[data-ports-checkpoint-form]");
    if (!form) return;
    event.preventDefault();
    if (form.matches("[data-answer-form]")) one("[data-payload]", form).value = JSON.stringify(capture());
    if (form.matches("[data-reset]")) memory.delete(currentNumber());
    if (form.matches("[data-next], [data-restart]")) memory.clear();
    try {
      const response = await fetch(form.action, {method: "POST", body: new FormData(form), headers: {"X-Requested-With": "XMLHttpRequest"}});
      if (!response.ok) throw Error("Falha ao atualizar checkpoint.");
      const data = await response.json();
      checkpoint.innerHTML = data.html;
      restore();
    } catch (error) {
      const note = document.createElement("p"); note.className = "gateway-feedback is-error"; note.textContent = error.message; checkpoint.appendChild(note);
    }
  });
  render();
})();
