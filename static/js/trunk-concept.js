(() => {
  "use strict";

  const root = document.querySelector("[data-trunk-journey]");
  if (!root) return;
  const one = (selector) => root.querySelector(selector);
  const all = (selector) => [...root.querySelectorAll(selector)];
  const frames = {
    10: { sourceHost: "Host A", destinationHost: "Host C", source: "AA:AA:AA:AA:AA:AA", destination: "CC:CC:CC:CC:CC:CC" },
    20: { sourceHost: "Host B", destinationHost: "Host D", source: "BB:BB:BB:BB:BB:BB", destination: "DD:DD:DD:DD:DD:DD" },
  };
  const state = { vlan: 10, step: 0, allowed: [10, 20] };

  function text(selector, value) {
    const node = one(selector);
    if (node) node.textContent = value;
  }

  function announce(message) {
    text("[data-journey-live]", message);
    text("[data-journey-feedback]", message);
  }

  function renderFrame() {
    const frame = frames[state.vlan];
    root.dataset.vlan = String(state.vlan);
    one(".journey-route").dataset.vlan = String(state.vlan);
    all("[data-journey-vlan]").forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.journeyVlan) === state.vlan)));
    text("[data-source-host]", frame.sourceHost);
    text("[data-destination-host]", frame.destinationHost);
    text("[data-source-mac]", frame.source);
    text("[data-destination-mac]", frame.destination);
    text("[data-frame-source]", frame.source);
    text("[data-frame-destination]", frame.destination);
    text("[data-access-vlan-in]", state.vlan);
    text("[data-access-vlan-out]", state.vlan);
    text("[data-route-vlan-id]", state.vlan);
    text("[data-frame-vlan]", state.vlan);
    const allowed = state.allowed.includes(state.vlan);
    one("[data-route-tag]").hidden = state.step < 2;
    one("[data-frame-tag-row]").hidden = state.step !== 2;
    text("[data-source-result]", state.step === 0 ? "Frame pronto · sem tag" : "Enviado sem tag pelo host");
    text("[data-trunk-status]", state.step < 2 ? "aguardando o frame" : allowed ? "marcado com 802.1Q" : "VLAN bloqueada · não atravessa");
    text("[data-destination-result]", state.step >= 3 ? "Frame recebido · sem tag" : state.step === 2 && !allowed ? "Não recebe · VLAN não permitida" : "aguardando entrega");
    one(".journey-route").dataset.routeState = state.step >= 3 ? "delivered" : state.step === 2 && !allowed ? "blocked" : state.step === 0 ? "ready" : "moving";
    all("[data-route-step]").forEach((item) => item.classList.toggle("is-current", item.dataset.routeStep === ({ 1: "access-in", 2: "trunk", 3: "access-out" }[state.step])));
    text("[data-allowed-list]", state.allowed.join(", "));
    text("[data-link-status]", "UP");
    const next = one("[data-journey-next]");
    next.disabled = state.step >= 3 || (state.step === 2 && !allowed);
    next.textContent = state.step === 0 ? "Avançar para Access" : state.step === 1 ? "Avançar para Trunk 802.1Q" : state.step === 2 ? (allowed ? "Avançar para Access de saída" : "VLAN bloqueada no Trunk") : "Percurso concluído";
    one("[data-allowed-toggle]").setAttribute("aria-pressed", String(state.allowed.includes(20)));
    text("[data-allowed-toggle]", state.allowed.includes(20) ? "Bloquear VLAN 20" : "Permitir VLAN 20");
  }

  function resetJourney(message) {
    state.step = 0;
    renderFrame();
    announce(message || `Percurso reiniciado. O frame de VLAN ${state.vlan} está sem tag na origem.`);
  }

  function selectVlan(vlan) {
    state.vlan = Number(vlan);
    state.step = 0;
    renderFrame();
    announce(`Frame de ${frames[state.vlan].sourceHost} para ${frames[state.vlan].destinationHost}. Na entrada, Access associa o frame sem tag à VLAN ${state.vlan}.`);
  }

  function advance() {
    if (state.step === 0) {
      state.step = 1;
      renderFrame();
      announce(`${frames[state.vlan].sourceHost} envia o frame sem tag. A porta Access associa esse tráfego à VLAN ${state.vlan}.`);
      return;
    }
    if (state.step === 1) {
      state.step = 2;
      renderFrame();
      if (!state.allowed.includes(state.vlan)) {
        announce(`O frame recebe a identificação VLAN ID ${state.vlan}, mas VLAN ${state.vlan} não está permitida. O enlace continua UP e o frame não atravessa.`);
      } else {
        announce(`No enlace compartilhado, 802.1Q identifica este frame com VLAN ID ${state.vlan}.`);
      }
      return;
    }
    if (state.step === 2 && state.allowed.includes(state.vlan)) {
      state.step = 3;
      renderFrame();
      announce(`O lado receptor usa VLAN ID ${state.vlan}, mantém o frame nesse contexto e o entrega a ${frames[state.vlan].destinationHost} pela porta Access sem exigir que o host processe a tag.`);
    }
  }

  all("[data-journey-vlan]").forEach((button) => button.addEventListener("click", () => selectVlan(button.dataset.journeyVlan)));
  one("[data-journey-next]").addEventListener("click", advance);
  one("[data-journey-reset]").addEventListener("click", () => resetJourney());
  one("[data-allowed-toggle]").addEventListener("click", () => {
    state.allowed = state.allowed.includes(20) ? [10] : [10, 20];
    if (state.vlan === 20) state.step = 0;
    renderFrame();
    announce(state.allowed.includes(20)
      ? "VLAN 20 voltou à lista permitida. O enlace segue UP; percorra novamente B → D para confirmar a entrega."
      : "VLAN 20 foi removida da lista permitida. O enlace continua UP; na tentativa B → D, o frame será identificado no Trunk, mas não atravessará. VLAN 10 continua permitida.");
  });

  document.querySelector("[data-reveal-reference]")?.addEventListener("click", (event) => {
    document.querySelector("[data-reference-answer]").hidden = false;
    event.currentTarget.disabled = true;
  });

  function setupAsyncCheckpoint() {
    const container = document.querySelector("#trunk-checkpoint");
    const start = document.querySelector("[data-trunk-checkpoint-start]");
    if (!container) return;
    async function submit(form, submitter) {
      window.NetStudyTrunkWorkbench?.capture();
      if (form.matches("[data-trunk-reset-current]")) window.NetStudyTrunkWorkbench?.discard();
      const data = new FormData(form);
      if (submitter?.name) data.append(submitter.name, submitter.value);
      container.setAttribute("aria-busy", "true");
      try {
        const response = await fetch(form.action, { method: "POST", body: data, headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" }, credentials: "same-origin" });
        if (!response.ok) throw new Error("request failed");
        const payload = await response.json();
        const parsed = new DOMParser().parseFromString(payload.html, "text/html").querySelector("#trunk-checkpoint");
        if (!parsed) throw new Error("invalid response");
        container.innerHTML = parsed.innerHTML;
        container.removeAttribute("aria-busy");
        window.NetStudySwitchBoard?.init(container);
        window.NetStudyTrunkStage?.init(container);
        window.NetStudyExercises?.init();
        window.NetStudyTrunkWorkbench?.init(container);
      } catch {
        container.removeAttribute("aria-busy");
        const warning = document.createElement("div");
        warning.className = "alert alert-danger";
        warning.textContent = "Não foi possível registrar sua resposta. Tente novamente.";
        container.prepend(warning);
      }
    }
    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.matches("[data-trunk-terminal-form]")) return;
      if (form === start || container.contains(form)) { event.preventDefault(); submit(form, event.submitter); }
    });
  }

  renderFrame();
  setupAsyncCheckpoint();
})();
