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
  const state = {service: null, validated: false, sent: false, replyConfirmed: false, replied: false, parallel: false};
  const fields = Object.fromEntries(all("[data-choice]", lab).map(field => [field.dataset.choice, field]));
  const feedback = one("[data-lab-feedback]", lab);
  const fieldFeedback = one("[data-field-feedback]", lab);
  const replyFeedback = one("[data-reply-feedback]", lab);
  const validateButton = one("[data-lab-validate]", lab);
  const sendButton = one("[data-lab-send]", lab);
  const replyStage = one("[data-reply-stage]", lab);
  const replyCheck = one("[data-reply-check]", lab);
  const replySend = one("[data-reply-send]", lab);
  const parallelStage = one("[data-parallel-stage]", lab);
  const timeline = one("[data-lab-steps]", lab);

  function record(message) {
    const li = document.createElement("li");
    li.textContent = message;
    timeline.appendChild(li);
  }
  function displayPacket({sourceIP, sourcePort, destinationIP, destinationPort, protocol, direction, result}) {
    one("[data-packet-source-ip]", lab).textContent = sourceIP;
    one("[data-packet-source-port]", lab).textContent = sourcePort;
    one("[data-packet-destination-ip]", lab).textContent = destinationIP;
    one("[data-packet-destination-port]", lab).textContent = destinationPort;
    one("[data-packet-protocol]", lab).textContent = protocol;
    one("[data-packet-direction]", lab).textContent = direction;
    one("[data-endpoint-delivery-result]", lab).textContent = result;
  }
  function currentRequest() {
    return {
      sourceIP: "192.168.10.20",
      sourcePort: fields["source-port"].value,
      destinationIP: fields["destination-ip"].value,
      destinationPort: fields["destination-port"].value,
      protocol: fields.protocol.value,
    };
  }
  function renderDraft() {
    const request = currentRequest();
    displayPacket({
      sourceIP: request.sourceIP,
      sourcePort: request.sourcePort || "—",
      destinationIP: request.destinationIP || "—",
      destinationPort: request.destinationPort || "—",
      protocol: request.protocol || "—",
      direction: "SOLICITAÇÃO · RASCUNHO",
      result: "O Packet Inspector acompanha suas escolhas. Confira se protocolo, host e endpoint correspondem ao serviço selecionado.",
    });
  }
  function resetJourney(keepService = false) {
    state.validated = false;
    state.sent = false;
    state.replyConfirmed = false;
    state.replied = false;
    state.parallel = false;
    all("[data-choice]", lab).forEach(field => { field.value = ""; });
    all("[data-choice]", lab).forEach(field => { field.disabled = false; });
    one("[data-reply-choice]", lab).value = "";
    validateButton.disabled = !state.service;
    sendButton.hidden = true;
    sendButton.disabled = false;
    replyStage.hidden = true;
    parallelStage.hidden = true;
    replyCheck.hidden = false;
    replySend.hidden = true;
    replySend.disabled = false;
    replyFeedback.textContent = "";
    fieldFeedback.textContent = "";
    feedback.textContent = "";
    timeline.replaceChildren();
    const li = document.createElement("li");
    li.textContent = state.service ? "Monte protocolo, destino e porta temporária; depois confira os campos." : "Escolha web, SSH ou DNS.";
    timeline.appendChild(li);
    displayPacket({sourceIP: "—", sourcePort: "—", destinationIP: "—", destinationPort: "—", protocol: "—", direction: "AGUARDANDO MONTAGEM", result: "O destino identifica primeiro o host; protocolo e porta de destino indicam o endpoint."});
    one("[data-route-client]", lab).innerHTML = "Cliente<br><strong>192.168.10.20:53012</strong>";
    if (!keepService) {
      state.service = null;
      one("[data-service-note]").textContent = "Escolha um serviço para ver seu protocolo e endpoint.";
    }
    all("[data-lab-service]", lab).forEach(button => button.setAttribute("aria-pressed", String(button.dataset.labService === state.service)));
  }

  all("[data-lab-service]", lab).forEach(button => button.addEventListener("click", () => {
    state.service = button.dataset.labService;
    resetJourney(true);
    const service = services[state.service];
    one("[data-service-note]").textContent = `${service.label} neste servidor: ${service.protocol} ${service.port}. Agora escolha os campos da solicitação.`;
    fields["destination-ip"].value = "192.168.20.30";
    validateButton.disabled = false;
    record(`Serviço escolhido: ${service.label} usa ${service.protocol} ${service.port} neste cenário.`);
    all("[data-lab-service]", lab).forEach(item => item.setAttribute("aria-pressed", String(item === button)));
  }));

  all("[data-choice]", lab).forEach(field => field.addEventListener("change", () => {
    if (state.sent) return;
    if (state.validated) {
      state.validated = false;
      state.sent = false;
      sendButton.hidden = true;
      fieldFeedback.textContent = "O campo mudou; confira novamente antes de enviar.";
    }
    renderDraft();
  }));

  validateButton.addEventListener("click", () => {
    if (!state.service) {
      fieldFeedback.textContent = "Escolha primeiro web, SSH ou DNS.";
      return;
    }
    const service = services[state.service];
    const request = currentRequest();
    const errors = [];
    if (!request.protocol) errors.push("Escolha o protocolo.");
    else if (request.protocol !== service.protocol) errors.push(`Protocolo: ${service.label} usa ${service.protocol} neste cenário; o transporte participa da identificação do endpoint.`);
    if (!request.destinationIP) errors.push("Escolha o IP de destino.");
    else if (request.destinationIP !== "192.168.20.30") errors.push("IP de destino: o serviço está no host 192.168.20.30; a porta não escolhe outro host.");
    if (!request.destinationPort) errors.push("Escolha a porta de destino.");
    else if (request.destinationPort !== service.port) errors.push(`Porta de destino: ${service.label} está disponível em ${service.protocol} ${service.port} neste servidor, não em ${request.protocol} ${request.destinationPort}.`);
    if (!request.sourcePort) errors.push("Escolha uma porta temporária de origem.");
    else if (request.sourcePort !== "53012") errors.push("Porta de origem: este cenário usa 53012 no cliente 192.168.10.20; ela identifica onde a resposta deve voltar.");
    fieldFeedback.textContent = errors.length ? errors.join(" ") : `Campos compatíveis: ${service.protocol} ${request.destinationIP}:${service.port} seleciona ${service.label}; 53012 identifica o endpoint deste cliente.`;
    state.validated = errors.length === 0;
    sendButton.hidden = !state.validated;
    if (state.validated) displayPacket({...request, direction: "SOLICITAÇÃO · CLIENTE → SERVIDOR", result: `Pronto para enviar ao endpoint ${service.protocol} ${service.port} de ${service.label}.`});
  });

  sendButton.addEventListener("click", () => {
    if (!state.validated) return;
    state.sent = true;
    sendButton.disabled = true;
    all("[data-choice]", lab).forEach(field => { field.disabled = true; });
    const request = currentRequest();
    displayPacket({...request, direction: "SOLICITAÇÃO · CLIENTE → SERVIDOR", result: `O host 192.168.20.30 recebeu o pacote e ${services[state.service].label} é identificado pelo endpoint ${request.protocol} ${request.destinationPort}.`});
    record(`Solicitação enviada: ${request.protocol} ${request.sourceIP}:${request.sourcePort} → ${request.destinationIP}:${request.destinationPort}.`);
    feedback.textContent = `Chegou ao host 192.168.20.30; ${services[state.service].label} recebe pelo endpoint ${request.protocol} ${request.destinationPort}.`;
    replyStage.hidden = false;
    replyStage.focus?.();
  });

  replyCheck.addEventListener("click", () => {
    const chosen = one("[data-reply-choice]", lab).value;
    if (!chosen) {
      replyFeedback.textContent = "Escolha a porta de destino da resposta.";
      return;
    }
    if (chosen !== "53012") {
      replyFeedback.textContent = chosen === services[state.service].port
        ? `${chosen} é a porta do serviço no servidor. Na resposta, ela fica como origem; o destino é a porta temporária do cliente.`
        : `${chosen} não é a porta temporária usada pelo cliente 192.168.10.20 nesta solicitação.`;
      return;
    }
    state.replyConfirmed = true;
    replyFeedback.textContent = "Isso: 53012 era a porta temporária de origem do cliente. Agora envie a resposta com os endpoints invertidos.";
    replySend.hidden = false;
  });

  replySend.addEventListener("click", () => {
    if (!state.replyConfirmed) return;
    state.replied = true;
    replySend.disabled = true;
    const service = services[state.service];
    displayPacket({sourceIP: "192.168.20.30", sourcePort: service.port, destinationIP: "192.168.10.20", destinationPort: "53012", protocol: service.protocol, direction: "RESPOSTA · SERVIDOR → CLIENTE", result: `A resposta de ${service.protocol} ${service.port} volta ao endpoint temporário 192.168.10.20:53012.`});
    record(`Resposta: ${service.protocol} 192.168.20.30:${service.port} → 192.168.10.20:53012; os endpoints foram invertidos.`);
    feedback.textContent = "A resposta chegou ao endpoint do cliente que iniciou esta comunicação.";
    parallelStage.hidden = false;
  });

  one("[data-lab-parallel]", lab).addEventListener("click", () => {
    if (!state.replied) return;
    state.parallel = true;
    displayPacket({sourceIP: "192.168.10.21", sourcePort: "53013", destinationIP: "192.168.20.30", destinationPort: "443", protocol: "TCP", direction: "SEGUNDO CLIENTE → SERVIDOR", result: "Fluxo B usa o mesmo serviço TCP 443; IP e porta de origem diferenciam o cliente e sua comunicação."});
    record("Fluxo B destacado: TCP 192.168.10.21:53013 → 192.168.20.30:443. O destino permanece igual; a origem muda.");
    feedback.textContent = "Compare os dois fluxos: ambos chegam a TCP 443, mas têm IP e porta de origem diferentes.";
  });

  one("[data-lab-reset]", lab).addEventListener("click", () => resetJourney());

  const terminal = one("[data-ports-terminal]");
  terminal?.addEventListener("submit", event => {
    event.preventDefault();
    const command = one("input", terminal).value.trim();
    const output = one("[data-ports-terminal-output]");
    const serverLines = "TCP  0.0.0.0:443           0.0.0.0:0             LISTENING     4240\nTCP  0.0.0.0:22            0.0.0.0:0             LISTENING     4120\nUDP  0.0.0.0:53            *:*                                 4000\nTCP  192.168.20.30:443     192.168.10.20:53012   ESTABLISHED   4240\nTCP  192.168.20.30:443     192.168.10.21:53013   ESTABLISHED   4240";
    if (command === "netstat -ano") output.textContent = serverLines;
    else if (command === "netstat -ano | findstr :443") output.textContent = serverLines.split("\n").filter(line => line.includes(":443")).join("\n");
    else output.textContent = "Comando não disponível nesta simulação. Use netstat -ano ou netstat -ano | findstr :443.";
  });

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
  resetJourney();
})();
