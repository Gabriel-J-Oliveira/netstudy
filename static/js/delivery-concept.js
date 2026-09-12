(() => {
  "use strict";
  const api = () => window.NetStudySwitchBoard;
  const board = (id) => api()?.boards[id];
  const MAC = () => api()?.MAC;

  function lockAnswer(root, chosen, correct) {
    chosen.classList.add(correct ? "is-correct" : "is-wrong");
    if (correct) root.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    else chosen.disabled = true;
  }

  function focusDestination(current) {
    current.root.querySelectorAll("[data-frame-field]").forEach((field) => field.classList.toggle("is-didactic-focus", field.dataset.frameField === "destination"));
  }

  function setupOpening() {
    const root = document.querySelector("[data-opening-demo]");
    const current = board("delivery-didactic-opening");
    if (!root || !current) return;
    root.querySelector("button").addEventListener("click", () => {
      focusDestination(current);
      root.querySelector("[data-demo-feedback]").textContent = "Destination BB é específico: a intenção do frame é Unicast, mesmo antes de consultar uma porta.";
    });
  }

  function setupUnicast() {
    const root = document.querySelector("[data-unicast-demo]");
    const current = board("delivery-didactic-known");
    if (root && current) root.querySelector("button").addEventListener("click", () => {
      current.reset(); current.receiveFrame({ source: MAC().A, destination: MAC().B, ingress: 1 });
      root.querySelector("[data-demo-feedback]").textContent = "Destination BB → Unicast. BB → Gi0/4 conhecido → saída somente Gi0/4.";
    });
    const question = document.querySelector("[data-unicast-question]");
    if (!question) return;
    question.querySelectorAll("[data-unicast-answer]").forEach((button) => button.addEventListener("click", () => {
      const correct = button.dataset.unicastAnswer === "correct"; lockAnswer(question, button, correct);
      question.querySelector("[data-question-feedback]").textContent = correct ? "Correto. BB é específico e a tabela aponta Gi0/4." : button.dataset.unicastAnswer === "broadcast" ? "BB é específico, portanto a intenção não é Broadcast." : "Gi0/1 é a entrada; BB está associado à Gi0/4.";
    }));
  }

  function setupBroadcast() {
    const root = document.querySelector("[data-broadcast-demo]"); const current = board("delivery-didactic-broadcast");
    if (root && current) root.querySelector("button").addEventListener("click", () => { current.reset(); current.receiveFrame({ source: MAC().A, destination: MAC().BROADCAST, ingress: 1 }); root.querySelector("[data-demo-feedback]").textContent = "FF:FF:FF:FF:FF:FF identifica Broadcast sem consultar a tabela."; });
    const question = document.querySelector("[data-broadcast-question]"); if (!question) return;
    question.querySelectorAll("[data-broadcast-answer]").forEach((button) => button.addEventListener("click", () => { const correct = button.dataset.broadcastAnswer === "correct"; lockAnswer(question, button, correct); question.querySelector("[data-question-feedback]").textContent = correct ? "Correto. FF:FF:FF:FF:FF:FF define Broadcast." : "Um Destination específico seria Unicast. Este endereço especial define Broadcast."; }));
  }

  function setupUnknown() {
    const root = document.querySelector("[data-unknown-demo]"); const current = board("delivery-didactic-unknown");
    if (root && current) root.querySelector("button").addEventListener("click", () => { current.reset(); current.receiveFrame({ source: MAC().A, destination: MAC().D, ingress: 1 }); root.querySelector("[data-demo-feedback]").textContent = "DD permaneceu como Destination MAC. As várias saídas são flooding de um Unicast desconhecido."; });
    const question = document.querySelector("[data-unknown-question]"); if (!question) return;
    question.querySelectorAll("[data-unknown-answer]").forEach((button) => button.addEventListener("click", () => { const correct = button.dataset.unknownAnswer === "correct"; lockAnswer(question, button, correct); question.querySelector("[data-question-feedback]").textContent = correct ? "Correto. DD mantém a intenção Unicast; DD ausente provoca flooding." : button.dataset.unknownAnswer === "broadcast" ? "Flooding não altera DD para FF:FF:FF:FF:FF:FF. O frame continua Unicast." : "Neste cenário, o switch faz flooding de um destino Unicast desconhecido."; }));
  }

  function setupSummary() {
    const current = board("delivery-didactic-summary"); const copy = document.querySelector("[data-summary-copy]");
    document.querySelectorAll("[data-summary]").forEach((button) => button.addEventListener("click", () => {
      if (!current || !copy) return; document.querySelectorAll("[data-summary]").forEach((item) => item.classList.toggle("is-active", item === button)); current.reset();
      if (button.dataset.summary === "known") { current.receiveFrame({ source: MAC().A, destination: MAC().B, ingress: 1 }); copy.innerHTML = "<strong>Unicast conhecido</strong><p>Destination BB é específico; BB conhecido em Gi0/4 produz saída direta.</p>"; }
      else if (button.dataset.summary === "unknown") { current.receiveFrame({ source: MAC().A, destination: MAC().D, ingress: 1 }); copy.innerHTML = "<strong>Unknown Unicast</strong><p>Destination DD é específico; DD ausente produz flooding sem alterar o destino.</p>"; }
      else { current.receiveFrame({ source: MAC().A, destination: MAC().BROADCAST, ingress: 1 }); copy.innerHTML = "<strong>Broadcast</strong><p>Destination FF:FF:FF:FF:FF:FF define a intenção para todos daquele domínio.</p>"; }
    }));
  }

  function setupArp() {
    const button = document.querySelector("[data-arp-demo]"); const feedback = document.querySelector("[data-arp-feedback]"); if (!button || !feedback) return; let reply = false;
    button.addEventListener("click", () => { reply = !reply; feedback.textContent = reply ? "ARP Request: Ethernet II + ARP, Destination FF:FF:FF:FF:FF:FF → Broadcast." : "ARP Reply no fluxo estudado: Ethernet II + ARP, Destination MAC do solicitante → Unicast."; button.textContent = reply ? "AGORA VER O ARP REPLY" : "REINICIAR REQUEST × REPLY"; });
  }

  function setupSelfExplanation() {
    const root = document.querySelector("[data-delivery-self-explanation]"); if (!root) return;
    root.querySelector("[data-delivery-reference-button]").addEventListener("click", (event) => { root.querySelector("[data-delivery-reference]").hidden = false; event.currentTarget.disabled = true; });
  }

  function setupAsyncCheckpoint() {
    const container = document.querySelector("#delivery-checkpoint"); const start = document.querySelector("[data-delivery-checkpoint-start]"); if (!container) return;
    async function submit(form, submitter) { window.NetStudySwitchWorkbench?.capture(); if (form.matches("[data-reset-current-form]")) window.NetStudySwitchWorkbench?.discard(); const data = new FormData(form); if (submitter?.name) data.append(submitter.name, submitter.value); container.setAttribute("aria-busy", "true"); try { const response = await fetch(form.action, { method: "POST", body: data, headers: { "X-Requested-With": "XMLHttpRequest", "Accept": "application/json" }, credentials: "same-origin" }); if (!response.ok) throw new Error("request failed"); const payload = await response.json(); const parsed = new DOMParser().parseFromString(payload.html, "text/html").querySelector("#delivery-checkpoint"); if (!parsed) throw new Error("invalid response"); container.innerHTML = parsed.innerHTML; container.removeAttribute("aria-busy"); api()?.init(container); window.NetStudyExercises?.init(); window.NetStudySwitchWorkbench?.init(container); } catch (error) { container.removeAttribute("aria-busy"); const warning = document.createElement("div"); warning.className = "alert alert-danger"; warning.textContent = "Não foi possível registrar sua resposta. Tente novamente."; container.prepend(warning); } }
    document.addEventListener("submit", (event) => { const form = event.target; if (!(form instanceof HTMLFormElement) || form.matches("[data-host-form],[data-switch-form]")) return; if (form === start || container.contains(form)) { event.preventDefault(); submit(form, event.submitter); } });
  }

  setupOpening(); setupUnicast(); setupBroadcast(); setupUnknown(); setupSummary(); setupArp(); setupSelfExplanation(); setupAsyncCheckpoint();
})();
