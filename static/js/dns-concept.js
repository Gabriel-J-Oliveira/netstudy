(() => {
  "use strict";
  const one = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const lab = one("[data-dns-lab]");
  if (!lab) return;

  const name = "intranet.exemplo.local";
  const address = "192.168.20.30";
  const steps = [
    {actor: "client", direction: "Cliente ainda não enviou uma consulta.", kind: "Nenhuma mensagem em trânsito", question: "—", answer: "—", feedback: "O cliente conhece o nome, mas ainda não tem a associação IPv4 no cache.", next: "Solicitar o nome", event: `O cliente conhece ${name}.`},
    {actor: "client", direction: "Cliente prepara a resolução do nome.", kind: "Solicitação local", question: `Qual é o IPv4 de ${name}?`, answer: "—", feedback: "Antes de enviar uma consulta, verifique se o cliente já tem uma resposta válida.", next: "Inspecionar cache", event: "O cliente solicitou a resolução do nome."},
    {actor: "client", direction: "Consulta ao cache local; nada enviado ao resolvedor.", kind: "Cache vazio", question: `Qual é o IPv4 de ${name}?`, answer: "—", feedback: "Não há resposta válida em cache. Neste cenário, será preciso consultar o resolvedor.", next: "Enviar consulta", event: "Cache vazio: nenhuma associação válida encontrada."},
    {actor: "resolver", direction: "Request: cliente 192.168.10.50 → resolvedor 192.168.10.53", kind: "Consulta DNS · registro A", question: `Qual é o registro A de ${name}?`, answer: "Aguardando resposta", feedback: "A consulta saiu do cliente e chegou ao resolvedor. O registro A ainda não foi apresentado.", next: "Observar resposta A", event: "Uma consulta DNS foi enviada ao resolvedor."},
    {actor: "client", direction: "Response: resolvedor 192.168.10.53 → cliente 192.168.10.50", kind: "Resposta DNS · registro A", question: `Qual é o registro A de ${name}?`, answer: `${name} → ${address}`, feedback: "A resposta contém a associação nome–IPv4. Ela ainda não comprova que o serviço web responde.", next: "Armazenar resposta", event: `O resolvedor respondeu com o registro A ${name} → ${address}.`},
    {actor: "client", direction: "Resposta recebida e armazenada localmente.", kind: "Cache atualizado", question: `Qual é o IPv4 de ${name}?`, answer: `${name} → ${address}`, feedback: "A associação válida está no cache do cliente e pode ser reutilizada neste percurso.", next: "Ver próximo passo", event: "A associação válida foi armazenada no cache do cliente."},
    {actor: "web", direction: "Possível comunicação posterior: cliente → servidor web.", kind: "Não é uma mensagem DNS", question: "—", answer: `IPv4 conhecido: ${address}`, feedback: "Agora o cliente tem um IPv4 para tentar acessar o serviço. DNS não realizou essa comunicação nem testou TCP 443.", next: "Consultar o mesmo nome novamente", event: "Com o IPv4 conhecido, o cliente pode tentar uma comunicação separada com o serviço."},
    {actor: "client", direction: "Segunda tentativa: cliente consulta primeiro seu cache local.", kind: "Nova solicitação local", question: `Qual é o IPv4 de ${name}?`, answer: "Verificando cache", feedback: "O nome é o mesmo. Verifique a resposta ainda válida antes de consultar o resolvedor.", next: "Usar cache válido", event: "Segunda tentativa para o mesmo nome iniciada."},
    {actor: "client", direction: "Cache local → cliente; sem nova consulta ao resolvedor.", kind: "Resposta A reutilizada do cache", question: `Qual é o IPv4 de ${name}?`, answer: `${name} → ${address}`, feedback: "O cliente reutilizou a resposta válida. O contador de consultas ao resolvedor permaneceu em 1; isso ainda não testa o serviço web.", next: null, event: "A segunda tentativa usou o cache válido, sem consultar novamente o resolvedor."},
  ];
  const state = {step: 0, cacheValid: false, queries: 0};
  const next = one("[data-dns-next]", lab);
  const terminal = one("[data-dns-terminal]");
  const terminalOutput = one("[data-dns-terminal-output]");

  function displayDns() {
    return state.cacheValid
      ? `Cache DNS simulado do cliente 192.168.10.50\n${name}\nRecord Type: A\nA (Host) Record: ${address}\nResposta válida em cache; não comprova serviço ativo.`
      : `Cache DNS simulado do cliente 192.168.10.50\nNenhuma entrada válida para ${name}.`;
  }
  function refreshTerminal() {
    if (terminal && one("input", terminal).value.trim() === "ipconfig /displaydns") {
      terminalOutput.textContent = displayDns();
    }
  }
  function render() {
    const step = steps[state.step];
    lab.dataset.actor = step.actor;
    lab.dataset.stage = String(state.step);
    one("[data-dns-direction]", lab).textContent = step.direction;
    one("[data-dns-message-kind]", lab).textContent = step.kind;
    one("[data-dns-question]", lab).textContent = step.question;
    one("[data-dns-answer]", lab).textContent = step.answer;
    one("[data-dns-cache]", lab).textContent = state.cacheValid ? `${name} → ${address} · válido` : "Vazio";
    one("[data-dns-query-count]", lab).textContent = String(state.queries);
    one("[data-dns-feedback]", lab).textContent = step.feedback;
    next.hidden = !step.next;
    if (step.next) next.textContent = step.next;
    const timeline = one("[data-dns-steps]", lab);
    timeline.replaceChildren();
    steps.slice(0, state.step + 1).forEach(item => {
      const entry = document.createElement("li");
      entry.textContent = item.event;
      timeline.appendChild(entry);
    });
    refreshTerminal();
  }
  next.addEventListener("click", () => {
    if (state.step >= steps.length - 1) return;
    state.step += 1;
    if (state.step === 3) state.queries += 1;
    if (state.step === 5) state.cacheValid = true;
    render();
  });
  one("[data-dns-clear]", lab).addEventListener("click", () => {
    state.step = 0;
    state.cacheValid = false;
    state.queries = 0;
    render();
    one("[data-dns-feedback]", lab).textContent = "Cache limpo. Uma nova tentativa precisará consultar o resolvedor neste cenário.";
  });
  terminal?.addEventListener("submit", event => {
    event.preventDefault();
    const command = one("input", terminal).value.trim();
    if (command === "nslookup intranet.exemplo.local") {
      terminalOutput.textContent = `Consulta simulada ao resolvedor 192.168.10.53 (não comprova uso do cache local)\nServer: 192.168.10.53\nName: ${name}\nAddress: ${address}`;
    } else if (command === "ipconfig /displaydns") {
      terminalOutput.textContent = displayDns();
    } else {
      terminalOutput.textContent = "Comando não disponível neste cenário. Use nslookup intranet.exemplo.local ou ipconfig /displaydns.";
    }
  });

  const checkpoint = one("#dns-checkpoint"), memory = new Map();
  const currentNumber = () => one(".gateway-checkpoint-header>strong", checkpoint)?.textContent.split(" ")[0] || "start";
  function capture() {
    const values = {};
    all("[data-dns-answer]", checkpoint).forEach(field => { values[field.dataset.dnsAnswer] = field.value; });
    memory.set(currentNumber(), values);
    return values;
  }
  function restore() {
    const values = memory.get(currentNumber()) || {};
    all("[data-dns-answer]", checkpoint).forEach(field => { if (values[field.dataset.dnsAnswer] !== undefined) field.value = values[field.dataset.dnsAnswer]; });
  }
  checkpoint?.addEventListener("submit", async event => {
    const form = event.target.closest("[data-dns-checkpoint-form]");
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
