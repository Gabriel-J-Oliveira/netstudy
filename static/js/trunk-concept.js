(() => {
  "use strict";

  const STAGE_ID = "trunk-concept-shared";
  const getStage = () => window.NetStudyTrunkStage?.stages[STAGE_ID];
  let activeArea = "problem";
  let areaState = {};

  const stageText = {
    problem: ["Área 01 · A mesma VLAN em dois switches", "Revele um enlace e envie os dois contextos pelo mesmo cabo."],
    roles: ["Área 02 · Access × Trunk", "Inspecione uma porta de host e o enlace entre os switches."],
    dot1q: ["Área 03 · 802.1Q", "Controle o frame de Access até Access pelo Trunk identificado."],
    across: ["Área 04 · Allowed VLANs", "Execute os casos e observe um Trunk UP bloquear somente a VLAN 20."],
    summary: ["Área 05 · Síntese", "Avance manualmente pelos cinco estados do mesmo enlace."],
  };

  function setText(selector, value) {
    const target = document.querySelector(selector);
    if (target) target.textContent = value;
  }

  function feedback(selector, value) {
    setText(selector, value);
    setText("[data-trunk-lab-feedback]", value);
  }

  function setDone(selector, done) {
    const target = document.querySelector(selector);
    if (!target) return;
    target.classList.toggle("is-done", done);
    target.setAttribute("aria-label", `${target.textContent.trim()}: ${done ? "concluído" : "pendente"}`);
  }

  function showControls(area) {
    const opening = document.querySelector("[data-opening-controls]");
    const across = document.querySelector("[data-across-controls]");
    const summary = document.querySelector("[data-summary-next]");
    if (opening) opening.hidden = area !== "problem";
    if (across) across.hidden = area !== "across";
    if (summary) summary.hidden = area !== "summary";
  }

  function resetAreaUi(area) {
    if (area === "problem") {
      setDone("[data-problem-revealed]", false);
      setDone('[data-problem-vlan="10"]', false);
      setDone('[data-problem-vlan="20"]', false);
      document.querySelectorAll("[data-opening-frame]").forEach((button) => { button.disabled = true; button.classList.remove("is-active"); });
      feedback("[data-opening-feedback]", "Clique no enlace entre os switches para revelar o Trunk.");
    }
    if (area === "roles") {
      setDone("[data-role-access]", false);
      setDone("[data-role-trunk]", false);
      feedback("[data-role-feedback]", "Compare o que cada conexão precisa transportar.");
    }
    if (area === "across") {
      document.querySelectorAll("[data-across-step]").forEach((item) => setDone(`[data-across-step="${item.dataset.acrossStep}"]`, false));
      document.querySelectorAll("[data-across-action]").forEach((button) => button.classList.remove("is-active"));
      const proof = document.querySelector("[data-mac-proof]");
      if (proof) proof.hidden = true;
      feedback("[data-across-feedback]", "Comece executando A → C.");
    }
    if (area === "summary") {
      document.querySelectorAll("[data-summary-step]").forEach((item) => item.classList.remove("is-done", "is-current"));
      setText("[data-summary-next]", "INICIAR PASSO 1");
      feedback("[data-summary-feedback]", "O Trunk está UP e permite VLAN 10 e VLAN 20.");
    }
  }

  function activate(area, announce = false) {
    const shared = getStage();
    if (!shared || !stageText[area]) return;
    activeArea = area;
    areaState = { phase: 0 };
    shared.reset();
    shared.root.classList.remove("cli-highlight", "is-blocked", "is-flowing");
    if (area === "problem") {
      shared.root.classList.remove("is-revealed");
      shared.render();
    } else shared.reveal();
    showControls(area);
    resetAreaUi(area);
    setText("[data-trunk-stage-title]", stageText[area][0]);
    setText("[data-trunk-stage-copy]", stageText[area][1]);
    if (area === "dot1q") resetWalkthrough(10, false);
    if (announce) setText("[data-trunk-lab-feedback]", `${stageText[area][0]} carregada na topologia.`);
  }

  function handleTrunkSelection() {
    if (activeArea === "problem") {
      areaState.revealed = true;
      setDone("[data-problem-revealed]", true);
      document.querySelectorAll("[data-opening-frame]").forEach((button) => { button.disabled = false; });
      feedback("[data-opening-feedback]", "Um único Trunk Gi0/8 ↔ Gi0/8 está UP e pode transportar VLAN 10 e VLAN 20.");
    } else if (activeArea === "roles") {
      areaState.trunk = true;
      setDone("[data-role-trunk]", true);
      finishRoles();
    }
  }

  function sendOpeningFrame(vlan, button) {
    if (activeArea !== "problem") activate("problem");
    if (!areaState.revealed) {
      feedback("[data-opening-feedback]", "Revele primeiro o enlace central para substituir as conexões separadas.");
      return;
    }
    getStage().send(vlan, { kind: "known" });
    areaState[`vlan${vlan}`] = true;
    button.classList.add("is-active");
    setDone(`[data-problem-vlan="${vlan}"]`, true);
    const both = areaState.vlan10 && areaState.vlan20;
    feedback("[data-opening-feedback]", both ? "VLAN 10 e VLAN 20 atravessaram a mesma Gi0/8. O cabo é o mesmo; o contexto transportado é diferente." : `O frame da VLAN ${vlan} atravessou a Gi0/8. Envie também o outro contexto pelo mesmo enlace.`);
  }

  function handleRolePort(detail) {
    if (activeArea !== "roles") return;
    if ([1, 2].includes(Number(detail.port))) {
      areaState.access = true;
      setDone("[data-role-access]", true);
      const vlan = Number(detail.port) === 1 ? 10 : 20;
      feedback("[data-role-feedback]", `${detail.side.toUpperCase()} Gi0/${detail.port}: porta Access associa o host a uma VLAN, aqui VLAN ${vlan}. Agora inspecione o enlace entre switches.`);
      finishRoles();
    }
  }

  function finishRoles() {
    if (!areaState.access || !areaState.trunk) return;
    feedback("[data-role-feedback]", "Access associa um host a uma VLAN no cenário; Trunk transporta VLAN 10 e VLAN 20 pela mesma conexão entre switches.");
  }

  const walkthrough = () => document.querySelector("[data-dot1q-walkthrough]");
  const walkthroughText = (vlan, step) => {
    const host = vlan === 10 ? "PC-A" : "PC-B";
    const remote = vlan === 10 ? "PC-C" : "PC-D";
    return [
      `Pronto para acompanhar o frame de ${host}.`,
      `1. ${host} gera o frame Ethernet.`,
      `2. O frame entra pela porta Access VLAN ${vlan}.`,
      `3. O SW1 mantém o contexto VLAN ${vlan}.`,
      `4. No Trunk, o 802.1Q identifica VLAN ID ${vlan}.`,
      "5. O SW2 recebe o frame pela mesma conexão compartilhada.",
      `6. O SW2 interpreta o identificador: VLAN ${vlan}.`,
      `7. O frame continua na VLAN ${vlan} e sai pela Access até ${remote}.`,
    ][step];
  };

  function resetWalkthrough(vlan, resetStage = true) {
    const root = walkthrough();
    const shared = getStage();
    if (!root || !shared) return;
    if (resetStage) { shared.reset(); shared.reveal(); }
    root.dataset.vlan = String(vlan);
    root.dataset.step = "0";
    root.querySelectorAll("[data-dot1q-vlan]").forEach((button) => button.classList.toggle("is-active", Number(button.dataset.dot1qVlan) === vlan));
    setText("[data-simple-source]", vlan === 10 ? "AA" : "BB");
    setText("[data-simple-destination]", vlan === 10 ? "CC" : "DD");
    setText("[data-simple-vlan]", String(vlan));
    const field = root.querySelector("[data-dot1q-field]");
    if (field) { field.hidden = true; field.classList.remove("is-inspected"); }
    setText("[data-dot1q-step-text]", walkthroughText(vlan, 0));
    setText("[data-dot1q-next]", "PRÓXIMO PASSO");
    feedback("[data-dot1q-feedback]", `Frame VLAN ${vlan} selecionado. Avance quando estiver pronto.`);
  }

  function advanceWalkthrough() {
    if (activeArea !== "dot1q") activate("dot1q");
    const root = walkthrough();
    const shared = getStage();
    const vlan = Number(root.dataset.vlan);
    const next = Number(root.dataset.step) + 1;
    if (next > 7) { resetWalkthrough(vlan); return; }
    root.dataset.step = String(next);
    setText("[data-dot1q-step-text]", walkthroughText(vlan, next));
    const field = root.querySelector("[data-dot1q-field]");
    if (field) field.hidden = next < 4 || next === 7;
    if (next === 2) {
      shared.packet = { source: vlan === 10 ? "AA" : "BB", destination: vlan === 10 ? "CC" : "DD", vlan, payload: "Dados", phase: "access-in" };
      shared.renderPacket();
    }
    if (next === 4) shared.send(vlan, { kind: "known" });
    if (next === 7) {
      shared.packet.phase = "access-out";
      shared.renderPacket();
      setText("[data-dot1q-next]", "REINICIAR CAMINHO");
    }
  }

  function inspectDot1qField() {
    const root = walkthrough();
    if (activeArea !== "dot1q" || Number(root?.dataset.step) < 4) return;
    root.querySelector("[data-dot1q-field]")?.classList.add("is-inspected");
    feedback("[data-dot1q-feedback]", "Source e Destination MAC continuam identificando origem e destino. O VLAN ID preserva o contexto VLAN durante o transporte.");
  }

  function runAcross(action, button) {
    if (activeArea !== "across") activate("across");
    const shared = getStage();
    if (action === "unicast") {
      shared.send(10, { kind: "known" });
      areaState.unicast = true;
      document.querySelector("[data-mac-proof]").hidden = false;
      feedback("[data-across-feedback]", "A e C permanecem na VLAN 10 em switches diferentes. SW1 alcança CC pelo Trunk; SW2 alcança CC pela porta local.");
    } else if (action === "broadcast") {
      shared.send(10, { kind: "broadcast", payload: "Broadcast VLAN 10" });
      areaState.broadcast = true;
      feedback("[data-across-feedback]", "O Broadcast VLAN 10 atravessa e alcança C. D está na VLAN 20 e não recebe.");
    } else if (action === "restrict") {
      shared.setAllowed("sw2", [10]);
      areaState.restricted = true;
      feedback("[data-across-feedback]", "O enlace continua UP, mas o lado SW2 agora permite apenas VLAN 10.");
    } else if (action === "blocked") {
      if (!areaState.restricted) {
        feedback("[data-across-feedback]", "Restrinja primeiro a Allowed List para observar a diferença entre link UP e VLAN permitida.");
        return;
      }
      shared.send(20, { kind: "known" });
      areaState.blocked = true;
      feedback("[data-across-feedback]", "B → D falhou: o Trunk continua UP, porém VLAN 20 não está permitida no lado SW2.");
    } else {
      if (!areaState.blocked) {
        feedback("[data-across-feedback]", "Tente B → D com a VLAN 20 bloqueada antes de restaurá-la.");
        return;
      }
      shared.setAllowed("sw2", [10, 20]);
      shared.root.classList.remove("is-blocked");
      shared.send(20, { kind: "known" });
      areaState.restored = true;
      feedback("[data-across-feedback]", "VLAN 20 voltou à Allowed List e B → D atravessou novamente pelo mesmo link físico.");
    }
    button.classList.add("is-active");
    setDone(`[data-across-step="${action}"]`, true);
  }

  function setSummaryStep(number) {
    document.querySelectorAll("[data-summary-step]").forEach((item) => {
      const step = Number(item.dataset.summaryStep);
      item.classList.toggle("is-done", step <= number);
      item.classList.toggle("is-current", step === number);
    });
  }

  function advanceSummary() {
    if (activeArea !== "summary") activate("summary");
    const shared = getStage();
    const phase = areaState.phase;
    if (phase === 0) {
      shared.send(10, { kind: "known" });
      setSummaryStep(1);
      feedback("[data-summary-feedback]", "1. A → C atravessou com 802.1Q VLAN ID 10 e saiu por uma Access VLAN 10.");
      setText("[data-summary-next]", "EXECUTAR PASSO 2");
    } else if (phase === 1) {
      shared.send(20, { kind: "known" });
      setSummaryStep(2);
      feedback("[data-summary-feedback]", "2. B → D usou o mesmo enlace físico, agora preservando o contexto VLAN 20.");
      setText("[data-summary-next]", "EXECUTAR PASSO 3");
    } else if (phase === 2) {
      shared.send(10, { kind: "broadcast", payload: "Broadcast VLAN 10" });
      setSummaryStep(3);
      feedback("[data-summary-feedback]", "3. O Broadcast VLAN 10 alcançou C, mas não D na VLAN 20.");
      setText("[data-summary-next]", "EXECUTAR PASSO 4");
    } else if (phase === 3) {
      shared.setAllowed("sw2", [10]);
      shared.send(20, { kind: "known" });
      setSummaryStep(4);
      feedback("[data-summary-feedback]", "4. O link permaneceu UP, mas B → D falhou porque VLAN 20 foi removida da Allowed List.");
      setText("[data-summary-next]", "EXECUTAR PASSO 5");
    } else if (phase === 4) {
      shared.setAllowed("sw2", [10, 20]);
      shared.root.classList.remove("is-blocked");
      shared.send(20, { kind: "known" });
      setSummaryStep(5);
      feedback("[data-summary-feedback]", "5. VLAN 20 restaurada: B → D voltou a atravessar sem qualquer troca de cabo.");
      setText("[data-summary-next]", "REINICIAR SEQUÊNCIA");
    } else {
      activate("summary", true);
      return;
    }
    areaState.phase += 1;
  }

  function setupSharedStage() {
    const shared = getStage();
    if (!shared) return;
    shared.root.addEventListener("trunkstage:trunk", handleTrunkSelection);
    shared.root.addEventListener("trunkstage:port", (event) => handleRolePort(event.detail));
    shared.root.addEventListener("click", (event) => {
      if (!event.target.closest("[data-stage-reset]")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      activate(activeArea, true);
    }, true);
    document.querySelectorAll("[data-trunk-stage-link]").forEach((link) => link.addEventListener("click", (event) => {
      event.preventDefault();
      activate(link.dataset.trunkStageLink, true);
      const lab = document.querySelector("#trunk-shared-lab");
      const bounds = lab?.getBoundingClientRect();
      if (lab && bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight)) {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        lab.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      }
    }));
    document.querySelectorAll("[data-opening-frame]").forEach((button) => button.addEventListener("click", () => sendOpeningFrame(Number(button.dataset.openingFrame), button)));
    document.querySelectorAll("[data-dot1q-vlan]").forEach((button) => button.addEventListener("click", () => resetWalkthrough(Number(button.dataset.dot1qVlan))));
    document.querySelector("[data-dot1q-next]")?.addEventListener("click", advanceWalkthrough);
    document.querySelector("[data-dot1q-field]")?.addEventListener("click", inspectDot1qField);
    document.querySelectorAll("[data-across-action]").forEach((button) => button.addEventListener("click", () => runAcross(button.dataset.acrossAction, button)));
    document.querySelector("[data-summary-next]")?.addEventListener("click", advanceSummary);
    activate("problem");
  }

  function setupCliProof() {
    document.querySelector("[data-cli-trunk-row]")?.addEventListener("click", () => {
      if (activeArea !== "summary") activate("summary");
      getStage().root.classList.add("cli-highlight");
      feedback("[data-summary-feedback]", "Gi0/8 trunking 10,20 corresponde ao enlace destacado entre SW1 e SW2.");
      setText("[data-cli-feedback]", "A linha da CLI e o enlace central representam o mesmo Trunk.");
    });
  }

  function setupSelfExplanation() {
    document.querySelector("[data-reveal-reference]")?.addEventListener("click", (event) => {
      document.querySelector("[data-reference-answer]").hidden = false;
      event.currentTarget.disabled = true;
    });
  }

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
        const response = await fetch(form.action, { method: "POST", body: data, headers: { "X-Requested-With": "XMLHttpRequest", "Accept": "application/json" }, credentials: "same-origin" });
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
      } catch (error) {
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
      if (form === start || container.contains(form)) {
        event.preventDefault();
        submit(form, event.submitter);
      }
    });
  }

  setupSharedStage();
  setupCliProof();
  setupSelfExplanation();
  setupAsyncCheckpoint();
})();
