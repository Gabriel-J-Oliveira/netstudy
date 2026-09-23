(() => {
  "use strict";

  const one = (selector, scope = document) => scope.querySelector(selector);
  const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const visual = one("[data-vlan-visualization]");
  if (!visual) return;

  const state = { mode: "single", pcEVlan: 20, accessApplied: false, broadcastRun: false };
  const modeCopy = {
    single: "Todos os hosts A–D pertencem ao mesmo contexto lógico.",
    split: "A e B pertencem à VLAN 10; C e D pertencem à VLAN 20. A infraestrutura física continua compartilhada.",
  };

  function resetBroadcast() {
    state.broadcastRun = false;
    all("[data-host]").forEach((host) => {
      host.classList.remove("is-broadcast-recipient", "is-outside-context");
      const result = one("[data-host-result]", host);
      if (result) result.textContent = host.dataset.host === "A" ? "Origem" : "—";
    });
    one("[data-broadcast-title]").textContent = "Pronto para comparar";
    one("[data-broadcast-copy]").textContent = "Escolha um estado e execute o broadcast para ver quem recebe.";
    one("[data-broadcast-recipients]").replaceChildren();
  }

  function selectMode(mode) {
    state.mode = mode;
    visual.querySelector(".physical-infrastructure").dataset.vlanState = mode;
    all("[data-vlan-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.vlanMode === mode)));
    all("[data-context]").forEach((context) => { context.hidden = mode === "single" ? context.dataset.context !== "single" : context.dataset.context === "single"; });
    one("[data-vlan-mode-explanation]").textContent = modeCopy[mode];
    resetBroadcast();
    renderPcE();
  }

  function renderPcE() {
    const accessVisual = one(".access-visual");
    accessVisual.dataset.pcEVlan = String(state.pcEVlan);
    one("[data-host-vlan]").textContent = `VLAN ${state.pcEVlan}`;
    const test = one("[data-test-pc-e]");
    test.disabled = !state.accessApplied;
    if (state.broadcastRun && state.accessApplied) renderPcEResult();
  }

  function renderPcEResult() {
    const receives = state.mode === "single" || state.pcEVlan === 10;
    const host = one('.access-host[data-host="E"]');
    const result = one("[data-host-result]", host);
    host.classList.toggle("is-broadcast-recipient", receives);
    host.classList.toggle("is-outside-context", !receives);
    result.textContent = receives ? "Recebe" : "Não recebe";
    return receives;
  }

  function broadcast(includePcE = false) {
    resetBroadcast();
    state.broadcastRun = true;
    const mainRecipients = state.mode === "single" ? ["B", "C", "D"] : ["B"];
    const labelByHost = {B:"PC-B", C:"PC-C", D:"PC-D"};
    const list = one("[data-broadcast-recipients]");
    mainRecipients.forEach((hostId) => {
      const host = one(`[data-context]:not([hidden]) [data-host="${hostId}"]`, visual) || one(`[data-host="${hostId}"]`, visual);
      host?.classList.add("is-broadcast-recipient");
      const result = one("[data-host-result]", host);
      if (result) result.textContent = "Recebe";
      const item = document.createElement("span");
      item.className = "recipient-yes";
      item.textContent = `${labelByHost[hostId]} recebe`;
      list.appendChild(item);
    });
    const excluded = state.mode === "single" ? [] : ["C", "D"];
    excluded.forEach((hostId) => {
      const host = one(`[data-context="vlan20"] [data-host="${hostId}"]`, visual);
      host?.classList.add("is-outside-context");
      const result = one("[data-host-result]", host);
      if (result) result.textContent = "Fora da VLAN 10";
      const item = document.createElement("span");
      item.className = "recipient-no";
      item.textContent = `PC-${hostId} não recebe: VLAN 20`;
      list.appendChild(item);
    });

    let pcEReceives = null;
    if (state.accessApplied) {
      pcEReceives = renderPcEResult();
      if (includePcE || state.accessApplied) {
        const item = document.createElement("span");
        item.className = pcEReceives ? "recipient-yes" : "recipient-no";
        item.textContent = pcEReceives ? "PC-E recebe: participa do mesmo contexto do broadcast" : `PC-E não recebe: está na VLAN ${state.pcEVlan}, fora do contexto da origem`;
        list.appendChild(item);
      }
    }

    one("[data-broadcast-title]").textContent = state.mode === "single" ? "Broadcast no mesmo contexto" : "Broadcast limitado à VLAN 10";
    let copy = state.mode === "single"
      ? "Sem separação lógica, B, C e D recebem o broadcast de A no mesmo domínio."
      : "A entrou pela VLAN 10. B recebe; C e D ficam na VLAN 20 e não recebem. O flooding também permanece na VLAN de entrada.";
    if (pcEReceives !== null) copy += pcEReceives
      ? ` PC-E também recebe porque está associado à VLAN ${state.mode === "single" ? "única" : "10"}.`
      : ` PC-E não recebe porque sua porta Access pertence à VLAN ${state.pcEVlan}.`;
    one("[data-broadcast-copy]").textContent = copy;
    visual.classList.remove("is-broadcasting");
    void visual.offsetWidth;
    visual.classList.add("is-broadcasting");
    visual.dataset.lastBroadcast = includePcE ? "access" : "comparison";
  }

  function applyAccess() {
    state.pcEVlan = Number(one("[data-pc-e-select]").value);
    state.accessApplied = true;
    one("[data-cli-pc-e-vlan10]").hidden = state.pcEVlan !== 10;
    one("[data-cli-pc-e-vlan20]").hidden = state.pcEVlan !== 20;
    resetBroadcast();
    renderPcE();
    one("[data-access-feedback]").textContent = `PC-E agora está associado à VLAN ${state.pcEVlan}. O cabo e a infraestrutura física não mudaram. Execute o broadcast de A para verificar se ele recebe.`;
  }

  function setupSelfExplanation() {
    const section = one("[data-vlan-self-explanation]");
    section?.querySelector("[data-vlan-reference-button]")?.addEventListener("click", (event) => {
      one("[data-vlan-reference]", section).hidden = false;
      event.currentTarget.disabled = true;
    });
  }

  function setupAsyncCheckpoint() {
    const container = one("#vlan-checkpoint");
    const start = one("[data-vlan-checkpoint-start]");
    if (!container) return;
    async function submit(form, submitter) {
      window.NetStudySwitchWorkbench?.capture();
      if (form.matches("[data-reset-current-form]")) window.NetStudySwitchWorkbench?.discard();
      const data = new FormData(form);
      if (submitter?.name) data.append(submitter.name, submitter.value);
      container.setAttribute("aria-busy", "true");
      try {
        const response = await fetch(form.action, { method: "POST", body: data, headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" }, credentials: "same-origin" });
        if (!response.ok) throw new Error("request failed");
        const payload = await response.json();
        const parsed = new DOMParser().parseFromString(payload.html, "text/html").querySelector("#vlan-checkpoint");
        if (!parsed) throw new Error("invalid response");
        container.innerHTML = parsed.innerHTML;
        container.removeAttribute("aria-busy");
        window.NetStudySwitchBoard?.init(container);
        window.NetStudyExercises?.init();
        window.NetStudySwitchWorkbench?.init(container);
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
      if (!(form instanceof HTMLFormElement) || form.matches("[data-host-form],[data-switch-form]")) return;
      if (form === start || container.contains(form)) { event.preventDefault(); submit(form, event.submitter); }
    });
  }

  all("[data-vlan-mode]").forEach((button) => button.addEventListener("click", () => selectMode(button.dataset.vlanMode)));
  one("[data-broadcast-run]").addEventListener("click", () => broadcast(false));
  one("[data-apply-access]").addEventListener("click", applyAccess);
  one("[data-test-pc-e]").addEventListener("click", () => broadcast(true));
  one("[data-pc-e-select]").addEventListener("change", () => {
    if (state.accessApplied) one("[data-access-feedback]").textContent = "A seleção mudou; aplique a associação para atualizar PC-E.";
  });

  setupSelfExplanation();
  setupAsyncCheckpoint();
})();
