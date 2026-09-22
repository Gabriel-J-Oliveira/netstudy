(() => {
  "use strict";
  const one = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const lab = one("[data-dns-lab]");
  if (!lab) return;
  const scenes = {
    meaning: {title: "Nome e endereço", steps: ["O cliente conhece intranet.exemplo.local.", "DNS associa o nome ao IPv4 192.168.20.30.", "O IPv4 identifica o host; o serviço TCP 443 será uma etapa posterior."], feedback: "DNS fornece endereçamento, não a página nem o caminho."},
    query: {title: "Request → Response", steps: ["Cliente 192.168.10.50 prepara a consulta pelo nome intranet.exemplo.local.", "Request: cliente → resolvedor DNS 192.168.10.53.", "Response: registro A intranet.exemplo.local → 192.168.20.30."], feedback: "A resposta A fornece o IPv4 associado ao nome neste cenário."},
    "cache-empty": {title: "Cache vazio", steps: ["Não há resposta válida no cache do cliente.", "O cliente consulta o resolvedor 192.168.10.53.", "A resposta A pode ser armazenada e reutilizada enquanto válida."], feedback: "Cache vazio exige consulta para obter a associação neste cenário."},
    "cache-full": {title: "Cache preenchido", steps: ["Existe uma resposta A ainda válida no cache.", "O cliente reutiliza 192.168.20.30 sem nova consulta neste percurso.", "A resposta em cache não testa o serviço web agora."], feedback: "Cache válido economiza a consulta; não prova disponibilidade atual."},
    "diagnose-nslookup": {title: "Diagnóstico · nslookup", steps: ["nslookup mostra intranet.exemplo.local → 192.168.20.30."], feedback: "Evidência de resolução, não de funcionamento do serviço."},
    "diagnose-ping": {title: "Diagnóstico · ping ao IP", steps: ["Um ping direto a 192.168.20.30 recebe resposta."], feedback: "O teste ao IP não comprova resolução do nome."},
    journey: {title: "Do nome ao serviço", steps: ["Nome: intranet.exemplo.local.", "DNS responde o IPv4 192.168.20.30.", "Gateway/rota encaminham conforme o destino IP.", "TCP + porta 443 identificam o endpoint do serviço.", "A aplicação web é uma etapa distinta da resolução DNS."], feedback: "Nome → DNS → IPv4 → gateway/rota → TCP + porta → serviço."},
  };
  const evidence = {
    "diagnose-nslookup": ["O resolvedor forneceu 192.168.20.30 para o nome.", "A associação nome–IPv4 foi observada.", "Se rota, TCP 443 ou aplicação web funcionam."],
    "diagnose-ping": ["O IPv4 192.168.20.30 respondeu ao ping.", "Há resposta para esse teste direto ao IP.", "Se o nome resolve corretamente ou se HTTP/TCP 443 funciona."],
  };
  const state = {scene: "meaning", step: -1};
  const timeline = one("[data-dns-steps]", lab), next = one("[data-dns-next]", lab);
  function render() {
    const scene = scenes[state.scene];
    one("[data-dns-title]", lab).textContent = scene.title;
    lab.dataset.scene = state.scene;
    one("[data-dns-cache]", lab).textContent = state.scene === "cache-empty" ? "Vazio" : state.scene === "cache-full" ? "Resposta A válida: 192.168.20.30" : "Não inspecionado";
    const evidencePanel = one("[data-dns-evidence]", lab), values = evidence[state.scene];
    evidencePanel.hidden = !values;
    if (values) {
      one("[data-dns-observed]", lab).textContent = values[0];
      one("[data-dns-safe]", lab).textContent = values[1];
      one("[data-dns-unknown]", lab).textContent = values[2];
    }
    timeline.replaceChildren();
    const visible = state.step < 0 ? ["Clique em Iniciar e avance no seu ritmo."] : scene.steps.slice(0, state.step + 1);
    visible.forEach(value => { const li = document.createElement("li"); li.textContent = value; timeline.appendChild(li); });
    one("[data-dns-feedback]", lab).textContent = state.step === scene.steps.length - 1 ? scene.feedback : "";
    next.hidden = state.step >= scene.steps.length - 1;
    next.textContent = state.step < 0 ? "Iniciar" : "Próxima etapa";
    all("[data-dns-open]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.dnsOpen === state.scene)));
  }
  function select(scene) {
    state.scene = scene; state.step = -1; render();
    lab.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"});
    lab.focus({preventScroll: true});
  }
  all("[data-dns-open]").forEach(button => button.addEventListener("click", () => select(button.dataset.dnsOpen)));
  next.addEventListener("click", () => {if (state.step < scenes[state.scene].steps.length - 1) state.step += 1; render();});
  one("[data-dns-reset]", lab).addEventListener("click", () => {state.step = -1; render();});
  const terminal = one("[data-dns-terminal]");
  terminal?.addEventListener("submit", event => {
    event.preventDefault();
    const command = one("input", terminal).value.trim();
    const output = one("[data-dns-terminal-output]");
    if (command === "nslookup intranet.exemplo.local") {
      output.textContent = "Server: 192.168.10.53\nName: intranet.exemplo.local\nAddress: 192.168.20.30";
    } else if (command === "ipconfig /displaydns") {
      output.textContent = state.scene === "cache-empty"
        ? "Nenhuma entrada válida para intranet.exemplo.local no cache simulado."
        : "intranet.exemplo.local\nRecord Type: A\nA (Host) Record: 192.168.20.30\nResposta em cache simulada; não comprova serviço ativo.";
    } else {
      output.textContent = "Comando não disponível neste cenário. Use nslookup intranet.exemplo.local ou ipconfig /displaydns.";
    }
  });
  const checkpoint = one("#dns-checkpoint"), memory = new Map();
  const currentNumber = () => one(".gateway-checkpoint-header>strong", checkpoint)?.textContent.split(" ")[0] || "start";
  function capture() {
    const values = {};
    all("[data-dns-answer]", checkpoint).forEach(field => values[field.dataset.dnsAnswer] = field.value);
    memory.set(currentNumber(), values);
    return values;
  }
  function restore() {
    const values = memory.get(currentNumber()) || {};
    all("[data-dns-answer]", checkpoint).forEach(field => {if (values[field.dataset.dnsAnswer] !== undefined) field.value = values[field.dataset.dnsAnswer];});
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
