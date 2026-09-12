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

  function showOnlyIngress(current, portNumber) {
    current.clearFrameState(); current.state.step += 1; current.port(portNumber).ingress = true; current.render();
  }

  function setupSimpleInspectors() {
    document.querySelectorAll(".switch-board-switch-page, .switch-board-switch-page-learning").forEach((root) => root.addEventListener("switchboard:inspect", () => root.classList.add("show-simple-inspector")));
  }

  function setupProblem() {
    const root = document.querySelector("[data-problem-demo]"); const current = board("switch-clarity-problem"); if (!root || !current) return;
    root.querySelector("button").addEventListener("click", () => { current.reset(); current.setFrame({ source: MAC().A, destination: MAC().B, ingress: 1 }); showOnlyIngress(current, 1); root.querySelector("[data-demo-feedback]").textContent = "O frame entrou pela Gi0/1. Agora o switch precisa aprender a origem e procurar o destino."; });
  }

  function setupLearning() {
    const root = document.querySelector("[data-learning-demo]"); const current = board("switch-clarity-learning"); if (root && current) root.querySelector("button").addEventListener("click", () => { current.reset(); current.setFrame({ source: MAC().C, destination: MAC().A, ingress: 3 }); showOnlyIngress(current, 3); current.setMacEntry(MAC().C, 3); current.render(); root.querySelector("[data-demo-feedback]").textContent = "Source CC entrou pela Gi0/3. Aprendido: CC → Gi0/3."; document.querySelector("[data-learning-entry]").innerHTML = "<code>CC</code> → <code>Gi0/3</code>"; });
    const question = document.querySelector("[data-learning-question]"); if (!question) return;
    question.querySelectorAll("[data-learning-answer]").forEach((button) => button.addEventListener("click", () => { const correct = button.dataset.learningAnswer === "correct"; lockAnswer(question, button, correct); question.querySelector("[data-question-feedback]").textContent = correct ? "Correto. Source CC + ingresso Gi0/3 produz CC → Gi0/3." : button.dataset.learningAnswer === "destination" ? "AA é o Destination. O aprendizado usa o Source MAC CC." : "CC é aprendido na porta em que entrou: Gi0/3."; }));
  }

  function setupForwarding() {
    const root = document.querySelector("[data-forward-demo]"); const current = board("switch-clarity-known"); if (root && current) root.querySelector("button").addEventListener("click", () => { current.reset(); current.receiveFrame({ source: MAC().A, destination: MAC().B, ingress: 1 }); root.querySelector("[data-demo-feedback]").textContent = "Destination BB foi encontrado: BB → Gi0/4. O frame saiu somente pela Gi0/4."; });
    const question = document.querySelector("[data-forward-question]"); if (!question) return;
    question.querySelectorAll("[data-forward-answer]").forEach((button) => button.addEventListener("click", () => { const correct = button.dataset.forwardAnswer === "correct"; lockAnswer(question, button, correct); question.querySelector("[data-question-feedback]").textContent = correct ? "Correto. Destination BB encontra BB → Gi0/4." : button.dataset.forwardAnswer === "ingress" ? "Gi0/1 é a entrada. A tabela aponta BB para Gi0/4." : "Há uma associação conhecida para BB, portanto não é necessário flooding."; }));
  }

  function setupUnknown() {
    const root = document.querySelector("[data-unknown-demo]"); const current = board("switch-clarity-unknown"); if (root && current) root.querySelector("button").addEventListener("click", () => { current.reset(); current.receiveFrame({ source: MAC().A, destination: MAC().D, ingress: 1 }); root.querySelector("[data-demo-feedback]").textContent = "DD não foi encontrado. Flooding pelas Gi0/4 e Gi0/6; nunca de volta pela Gi0/1."; });
    const later = document.querySelector("[data-later-learning]"); if (later && current) later.querySelector("button").addEventListener("click", (event) => { current.setMacEntry(MAC().D, 6); current.inspect(6); later.querySelector("[data-later-feedback]").textContent = "Um frame Source DD observado na Gi0/6 permite aprender DD → Gi0/6."; event.currentTarget.disabled = true; });
    const question = document.querySelector("[data-unknown-question]"); if (!question) return;
    question.querySelectorAll("[data-unknown-answer]").forEach((button) => button.addEventListener("click", () => { const correct = button.dataset.unknownAnswer === "correct"; lockAnswer(question, button, correct); question.querySelector("[data-question-feedback]").textContent = correct ? "Correto. O switch usa as demais portas apropriadas e exclui a entrada." : button.dataset.unknownAnswer === "ingress" ? "O flooding não envia uma cópia de volta pela porta de entrada." : "Neste cenário, um Destination desconhecido provoca flooding, não descarte."; }));
  }

  function setCycleSteps(activeUntil) {
    document.querySelectorAll("[data-cycle-step]").forEach((item) => item.classList.toggle("is-done", Number(item.dataset.cycleStep) <= activeUntil));
  }

  function setupCycle() {
    const root = document.querySelector("[data-cycle-demo]"); const current = board("switch-clarity-cycle"); if (!root || !current) return;
    const button = root.querySelector("button"); const feedback = root.querySelector("[data-cycle-feedback]");
    button.addEventListener("click", () => {
      const phase = Number(root.dataset.phase);
      if (phase === 0) { current.reset(); current.receiveFrame({ source: MAC().A, destination: MAC().B, ingress: 1 }); setCycleSteps(5); document.querySelector("[data-cycle-aa]").hidden = false; document.querySelector("[data-cycle-empty]").hidden = true; feedback.textContent = "1. Entrou Gi0/1 → aprendeu AA → procurou BB → BB ausente → flooding."; button.textContent = "AGORA FRAME B → A"; root.dataset.phase = "1"; }
      else if (phase === 1) { current.receiveFrame({ source: MAC().B, destination: MAC().A, ingress: 4 }); document.querySelector("[data-cycle-bb]").hidden = false; feedback.textContent = "2. Entrou Gi0/4 → aprendeu BB → encontrou AA → enviou pela Gi0/1."; button.textContent = "AGORA NOVO FRAME A → B"; root.dataset.phase = "2"; }
      else if (phase === 2) { current.receiveFrame({ source: MAC().A, destination: MAC().B, ingress: 1 }); document.querySelector("[data-first-later]").hidden = false; feedback.textContent = "3. Destination BB → BB → Gi0/4 → somente Gi0/4."; button.textContent = "REINICIAR SEQUÊNCIA"; root.dataset.phase = "3"; }
      else { current.reset(); setCycleSteps(0); document.querySelector("[data-cycle-aa]").hidden = true; document.querySelector("[data-cycle-bb]").hidden = true; document.querySelector("[data-cycle-empty]").hidden = false; document.querySelector("[data-first-later]").hidden = true; feedback.textContent = "Tabela vazia. Source AA, Destination BB."; button.textContent = "INICIAR FRAME A → B"; root.dataset.phase = "0"; }
    });
  }

  function setupCliProof() {
    const root = document.querySelector("[data-switch-cli-proof]"); const boardRoot = document.querySelector('[data-board-id="switch-clarity-cycle"]'); if (!root || !boardRoot) return;
    root.querySelector("[data-cli-mac-b]").addEventListener("click", (event) => { boardRoot.querySelectorAll(".is-cli-highlight").forEach((item) => item.classList.remove("is-cli-highlight")); boardRoot.querySelector('[data-host="B"]')?.classList.add("is-cli-highlight"); boardRoot.querySelector('[data-switch-port="4"]')?.classList.add("is-cli-highlight"); root.querySelector("[data-cli-feedback]").textContent = "A linha bbbb.bbbb.bbbb → Gi0/4 representa PC-B e a mesma porta Gi0/4 do quadro."; event.currentTarget.classList.add("is-active"); });
  }

  function setupRapidFire() {
    const root = document.querySelector("[data-switch-rapid-fire]"); if (!root) return; const expected = { "1": "source", "2": "destination", "3": "flood" };
    root.querySelectorAll("[data-rapid-question]").forEach((question) => question.addEventListener("click", (event) => { const button = event.target.closest("[data-rapid-answer]"); if (!button) return; const correct = button.dataset.rapidAnswer === expected[question.dataset.rapidQuestion]; lockAnswer(question, button, correct); question.querySelector("[data-rapid-feedback]").textContent = correct ? "Correto." : question.dataset.rapidQuestion === "1" ? "O switch aprende observando o Source MAC." : question.dataset.rapidQuestion === "2" ? "A consulta para encaminhar usa o Destination MAC." : "Destino ausente provoca flooding pelas demais portas apropriadas."; }));
  }

  function setupSelfExplanation() {
    const root = document.querySelector("[data-switch-self-explanation]"); if (!root) return; root.querySelector("[data-switch-reference-button]").addEventListener("click", (event) => { root.querySelector("[data-switch-reference]").hidden = false; event.currentTarget.disabled = true; });
  }

  function setupAsyncCheckpoint() {
    const container = document.querySelector("#switch-checkpoint"); const start = document.querySelector("[data-checkpoint-start]"); if (!container) return;
    async function submit(form, submitter) { window.NetStudySwitchWorkbench?.capture(); if (form.matches("[data-reset-current-form]")) window.NetStudySwitchWorkbench?.discard(); const data = new FormData(form); if (submitter?.name) data.append(submitter.name, submitter.value); container.setAttribute("aria-busy", "true"); try { const response = await fetch(form.action, { method: "POST", body: data, headers: { "X-Requested-With": "XMLHttpRequest", "Accept": "application/json" }, credentials: "same-origin" }); if (!response.ok) throw new Error("request failed"); const payload = await response.json(); const parsed = new DOMParser().parseFromString(payload.html, "text/html").querySelector("#switch-checkpoint"); if (!parsed) throw new Error("invalid response"); container.innerHTML = parsed.innerHTML; container.removeAttribute("aria-busy"); api()?.init(container); window.NetStudyExercises?.init(); window.NetStudySwitchWorkbench?.init(container); if (form.matches("[data-reset-current-form]")) container.scrollIntoView({ behavior: "auto", block: "start" }); } catch (error) { container.removeAttribute("aria-busy"); const message = document.createElement("div"); message.className = "alert alert-danger"; message.textContent = "Não foi possível registrar sua resposta. Tente novamente."; container.prepend(message); } }
    document.addEventListener("submit", (event) => { const form = event.target; if (!(form instanceof HTMLFormElement) || form.matches("[data-host-form],[data-switch-form]")) return; if (form === start || container.contains(form)) { event.preventDefault(); submit(form, event.submitter); } });
  }

  setupSimpleInspectors(); setupProblem(); setupLearning(); setupForwarding(); setupUnknown(); setupCycle(); setupCliProof(); setupRapidFire(); setupSelfExplanation(); setupAsyncCheckpoint();
})();
