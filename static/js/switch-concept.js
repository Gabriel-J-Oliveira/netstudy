(() => {
  "use strict";
  const BOARD_ID = "switch-concept-shared";
  const FLOOD_PORTS = [3, 4, 6];
  const EVENTS = [
    "Frame AA → BB entrou pela Gi0/1",
    "Switch aprendeu AA → Gi0/1",
    "Consulta por BB: não encontrado",
    "Flooding: Gi0/3, Gi0/4 e Gi0/6",
    "Resposta BB → AA entrou pela Gi0/4",
    "Switch aprendeu BB → Gi0/4",
    "AA encontrado: saída somente pela Gi0/1",
    "Novo frame AA → BB",
    "BB encontrado: saída somente pela Gi0/4",
  ];
  const one = (selector, scope = document) => scope.querySelector(selector);
  const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const api = () => window.NetStudySwitchBoard;
  const board = () => api()?.boards[BOARD_ID];
  const root = () => one(`[data-board-id="${BOARD_ID}"]`);
  const lab = one("#switch-shared-lab");
  let state;

  function note(text, selector = "[data-shared-lab-feedback]") {
    const target = one(selector);
    if (target) target.textContent = text;
  }
  function result(step, text) { note(text, `[data-step-result="${step}"]`); }
  function mark(selector, value) {
    const target = one(selector);
    if (!target) return;
    target.classList.toggle("is-done", value);
    target.setAttribute("aria-label", `${target.textContent.trim()}: ${value ? "concluído" : "pendente"}`);
  }
  function record(index) {
    if (state.history.includes(index)) return;
    state.history.push(index);
    board().state.events = state.history.map(event => EVENTS[event]);
    board().renderTimeline();
  }
  function setProcess(process) {
    all("[data-process]", lab).forEach(element => element.classList.toggle("is-current", element.dataset.process === process));
  }
  function announce(message) {
    note(message);
    board().announce(message);
  }
  function updateStepper() {
    all("[data-step-target]").forEach(button => {
      const step = Number(button.dataset.stepTarget);
      button.disabled = step > state.unlocked;
      button.classList.toggle("is-complete", state.completed.has(step));
      if (step === state.activeStep) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    all("[data-step-panel]").forEach(panel => { panel.hidden = Number(panel.dataset.stepPanel) !== state.activeStep; });
    one("[data-step-previous]").disabled = state.activeStep === 1;
    one("[data-step-next]").disabled = !state.completed.has(state.activeStep) || state.activeStep === 5;
    one("[data-step-position]").textContent = `Etapa ${state.activeStep} de 5`;
    const titles = [null, "Etapa 1 · Entrada do frame", "Etapa 2 · Aprendizagem", "Etapa 3 · Consulta", "Etapa 4 · Flooding", "Etapa 5 · Caminho aprendido"];
    one("[data-shared-stage-title]").textContent = titles[state.activeStep];
  }
  function showStep(step, focus = false) {
    if (step < 1 || step > state.unlocked || step > 5) return;
    state.activeStep = step;
    if (step === 4 && state.phase === "destination-b-miss") state.phase = "flood-selection";
    updateStepper();
    if (focus) one(`[data-step-panel="${step}"]`)?.focus();
  }
  function completeStep(step) {
    state.completed.add(step);
    state.unlocked = Math.max(state.unlocked, Math.min(5, step + 1));
    updateStepper();
  }
  function animateFrame(from, to, flood = false) {
    const canvas = one("svg", root());
    if (!canvas || typeof canvas.animate !== "function") return;
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "g");
    marker.classList.add("switch-flow-marker");
    if (flood) marker.classList.add("is-flood");
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", "72"); rect.setAttribute("height", "30"); rect.setAttribute("rx", "6");
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", "36"); label.setAttribute("y", "20"); label.textContent = "FRAME";
    marker.append(rect, label); canvas.appendChild(marker);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    marker.animate([{transform: `translate(${from[0]}px, ${from[1]}px)`}, {transform: `translate(${to[0]}px, ${to[1]}px)`}], {duration: reduced ? 1 : 750, easing: "ease-in-out"}).finished.then(() => marker.remove()).catch(() => marker.remove());
  }
  function clearVisuals() {
    all(".switch-flow-marker", root()).forEach(marker => marker.remove());
    all("[data-host]", root()).forEach(host => host.classList.remove("is-accepted", "is-discarded", "is-cli-highlight"));
    all("[data-frame-field]", root()).forEach(field => field.classList.remove("is-flow-selected", "is-table-query"));
    all("[data-switch-port]", root()).forEach(port => { port.classList.remove("is-flood-choice", "is-cli-highlight"); port.setAttribute("aria-pressed", "false"); });
    one("[data-switch-host-outcomes]").replaceChildren();
    one("[data-flood-conclusion]").hidden = true;
    one("[data-path-summary]").hidden = true;
    one("[data-after-journey]").hidden = true;
    one("[data-cli-aa]").hidden = true;
    one("[data-cli-bb]").hidden = true;
    const fifthAction = one("[data-step-five-action]");
    fifthAction.disabled = false;
    fifthAction.textContent = "RECEBER BB → AA PELA Gi0/4";
    mark("[data-learning-source]", false); mark("[data-learning-port]", false);
    result(1, "Aguardando a entrada do frame.");
    result(2, "As duas evidências precisam ser selecionadas; apenas a porta não conclui a etapa.");
    result(3, "Destination MAC decide; não ensina.");
    result(4, "Gi0/1 permanece excluída porque é a porta de entrada.");
    result(5, "Avance manualmente pelos oito passos desta etapa.");
  }
  function reset() {
    const current = board();
    if (!current) return;
    current.reset();
    state = {phase: "initial", activeStep: 1, unlocked: 1, completed: new Set(), selected: {source: false, ingress: false}, flood: new Set(), history: [], stepFive: 0};
    current.state.events = [];
    current.render();
    clearVisuals();
    setProcess(null);
    updateStepper();
    announce("Tabela vazia. Inicie pela entrada do primeiro frame.");
  }
  function receive(source, destination, ingress, eventIndex) {
    const current = board();
    current.clearFrameState();
    current.state.source = source; current.state.destination = destination; current.state.ingress = ingress; current.state.step += 1;
    const port = current.port(ingress);
    port.ingress = true; port.rx_frames += 1; port.rx_delta = 1; port.last_event = "FRAME_RECEIVED"; port.last_frame_direction = "INGRESS";
    current.render(); record(eventIndex);
    animateFrame(ingress === 1 ? [120, 120] : [850, 120], [450, 170]);
  }
  function enter() {
    if (state.phase !== "initial") return;
    receive(api().MAC.A, api().MAC.B, 1, 0);
    state.phase = "frame-arrived";
    setProcess("reading"); completeStep(1);
    result(1, "Gi0/1 recebeu o frame. Source AA e Destination BB agora estão visíveis.");
    announce("Frame recebido pela Gi0/1. A etapa Aprendizagem foi liberada.");
  }
  function learnA() {
    if (state.phase !== "frame-arrived" || !state.selected.source || !state.selected.ingress) return;
    board().setMacEntry(api().MAC.A, 1, null); board().render(); record(1);
    state.phase = "source-a-learned";
    one("[data-cli-aa]").hidden = false;
    setProcess("learning"); completeStep(2);
    result(2, "AA → Gi0/1 foi inserido na tabela. Source MAC ensinou onde a origem foi observada.");
    announce("Aprendizagem concluída: AA está associado à Gi0/1.");
  }
  function queryB() {
    if (state.phase !== "source-a-learned") return;
    one('[data-frame-field="destination"]', root()).classList.add("is-flow-selected", "is-table-query");
    record(2); state.phase = "destination-b-miss";
    setProcess("lookup"); completeStep(3);
    result(3, "BB não encontrado. Destination MAC foi consultado para decidir a saída; ele não ensinou uma porta.");
    announce("Consulta concluída: BB não foi encontrado na tabela.");
  }
  function markFlood(number) {
    if (state.phase !== "flood-selection") return;
    if (number === 1) return result(4, "Gi0/1 é a porta de entrada; o switch não devolve o frame por ela.");
    if (!FLOOD_PORTS.includes(number)) return result(4, "Essa porta não participa deste cenário.");
    state.flood.has(number) ? state.flood.delete(number) : state.flood.add(number);
    const element = one(`[data-switch-port="${number}"]`, root());
    element.classList.toggle("is-flood-choice", state.flood.has(number));
    element.setAttribute("aria-pressed", String(state.flood.has(number)));
    element.setAttribute("aria-label", `Gi0/${number}: ${state.flood.has(number) ? "saída de flooding selecionada" : "selecionar saída de flooding"}`);
    result(4, `${state.flood.size} de 3 saídas corretas selecionadas.`);
  }
  function confirmFlood() {
    if (state.phase !== "flood-selection") return;
    const chosen = [...state.flood].sort((a, b) => a - b);
    if (chosen.length !== 3 || chosen.some((number, index) => number !== FLOOD_PORTS[index])) return result(4, "Selecione Gi0/3, Gi0/4 e Gi0/6, mantendo Gi0/1 excluída.");
    const current = board();
    FLOOD_PORTS.forEach(number => { const port = current.port(number); port.flooded = true; port.tx_frames += 1; port.tx_delta = 1; port.last_event = "FRAME_FLOODED"; port.last_frame_direction = "EGRESS · FLOODED"; });
    current.render(); record(3);
    all("[data-switch-port]", root()).forEach(port => { port.classList.remove("is-flood-choice"); port.setAttribute("aria-pressed", "false"); });
    state.phase = "flood-delivered";
    const outcomes = one("[data-switch-host-outcomes]");
    [["B", "PC-B aceitou: Destination BB corresponde ao seu MAC."], ["C", "PC-C descartou: seu MAC não é BB."], ["D", "PC-D descartou: seu MAC não é BB."]].forEach(([host, message]) => { one(`[data-host="${host}"]`, root()).classList.add(host === "B" ? "is-accepted" : "is-discarded"); const item = document.createElement("span"); item.textContent = message; outcomes.appendChild(item); });
    [[850, 120], [850, 320], [50, 320]].forEach(target => animateFrame([470, 170], target, true));
    one("[data-flood-conclusion]").hidden = false;
    setProcess("egress"); completeStep(4);
    result(4, "PC-B aceitou. PC-C e PC-D compararam Destination BB e descartaram.");
    announce("Flooding concluído pelas três saídas, sem retornar pela Gi0/1.");
  }
  function stepFiveAction() {
    const current = board();
    const actions = [
      () => { all("[data-host]", root()).forEach(host => host.classList.remove("is-accepted", "is-discarded")); one("[data-switch-host-outcomes]").replaceChildren(); receive(api().MAC.B, api().MAC.A, 4, 4); state.phase = "reply-arrived"; setProcess("reception"); return "APRENDER SOURCE BB → Gi0/4"; },
      () => { current.setMacEntry(api().MAC.B, 4, null); current.render(); record(5); state.phase = "source-b-learned"; one("[data-cli-bb]").hidden = false; setProcess("learning"); return "CONSULTAR DESTINATION AA"; },
      () => { one('[data-frame-field="destination"]', root()).classList.add("is-table-query"); setProcess("lookup"); return "ENCONTRAR AA → Gi0/1"; },
      () => { const entry = current.findEntry(api().MAC.A, 1); if (!entry) throw Error("AA deveria estar na tabela."); state.phase = "destination-a-hit"; return "ENCAMINHAR RESPOSTA PELA Gi0/1"; },
      () => { const port = current.port(1); current.clearFrameState(); port.egress = true; port.tx_frames += 1; port.tx_delta = 1; port.last_event = "FRAME_FORWARDED"; port.last_frame_direction = "EGRESS"; current.render(); record(6); animateFrame([470, 170], [120, 120]); state.phase = "reply-delivered"; setProcess("egress"); return "ENVIAR NOVO FRAME AA → BB"; },
      () => { receive(api().MAC.A, api().MAC.B, 1, 7); state.phase = "second-request"; setProcess("reception"); return "CONSULTAR DESTINATION BB"; },
      () => { one('[data-frame-field="destination"]', root()).classList.add("is-table-query"); setProcess("lookup"); return "ENCONTRAR BB → Gi0/4 E ENCAMINHAR"; },
      () => { const entry = current.findEntry(api().MAC.B, 1); if (!entry || entry.port !== 4) throw Error("BB deveria estar associada à Gi0/4."); current.clearFrameState(); const port = current.port(4); port.egress = true; port.tx_frames += 1; port.tx_delta = 1; port.last_event = "FRAME_FORWARDED"; port.last_frame_direction = "EGRESS"; current.render(); record(8); animateFrame([470, 170], [850, 120]); state.phase = "complete"; setProcess("egress"); completeStep(5); one("[data-path-summary]").hidden = false; one("[data-after-journey]").hidden = false; return "PERCURSO CONCLUÍDO"; },
    ];
    const action = actions[state.stepFive];
    if (!action) return;
    const nextLabel = action();
    state.stepFive += 1;
    const button = one("[data-step-five-action]"); button.textContent = nextLabel; button.disabled = state.stepFive >= actions.length;
    result(5, state.stepFive >= actions.length ? "Caminho aprendido: o segundo frame foi enviado somente pela Gi0/4." : `Passo ${state.stepFive} de 8 concluído. Continue quando estiver pronto.`);
    announce(resultText());
  }
  function resultText() { return one('[data-step-result="5"]').textContent; }
  function handleBoardInput(event) {
    const target = event.target.closest("[data-frame-field], [data-switch-port], [data-board-reset], [data-mac-entry]");
    if (!target || !root().contains(target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (target.matches("[data-board-reset]")) return reset();
    if (target.matches("[data-mac-entry]")) return announce("A tabela é estado vivo; as consultas são feitas pelo Destination MAC.");
    if (target.matches("[data-frame-field]")) {
      if (target.dataset.frameField === "source" && state.activeStep === 2 && state.phase === "frame-arrived") { state.selected.source = true; target.classList.add("is-flow-selected"); mark("[data-learning-source]", true); result(2, "Source AA selecionado. Confirme agora a porta Gi0/1."); learnA(); }
      else announce("Esse campo não é a ação solicitada nesta etapa.");
      return;
    }
    const number = Number(target.dataset.switchPort);
    if (state.activeStep === 2 && state.phase === "frame-arrived") {
      if (number === 1) { state.selected.ingress = true; mark("[data-learning-port]", true); result(2, "Gi0/1 selecionada. Falta confirmar Source AA, se ainda não foi escolhido."); learnA(); }
      else result(2, "O frame entrou pela Gi0/1, não por essa porta.");
    } else if (state.activeStep === 4) markFlood(number);
    else announce("Essa porta não é a ação solicitada nesta etapa.");
  }
  function setupGuidedLab() {
    if (!board() || !root()) return;
    root().addEventListener("click", handleBoardInput, true);
    root().addEventListener("keydown", event => { if (["Enter", " "].includes(event.key) && event.target.closest("[data-switch-port], [data-mac-entry]")) handleBoardInput(event); }, true);
    one("[data-step-enter]").addEventListener("click", enter);
    one("[data-step-query]").addEventListener("click", queryB);
    one("[data-step-flood-confirm]").addEventListener("click", confirmFlood);
    one("[data-step-five-action]").addEventListener("click", stepFiveAction);
    all("[data-step-target]").forEach(button => button.addEventListener("click", () => showStep(Number(button.dataset.stepTarget), true)));
    one("[data-step-previous]").addEventListener("click", () => showStep(state.activeStep - 1, true));
    one("[data-step-next]").addEventListener("click", () => showStep(state.activeStep + 1, true));
    reset();
  }
  function setupCliProof() {
    one("[data-cli-mac-b]")?.addEventListener("click", () => { one('[data-host="B"]', root())?.classList.add("is-cli-highlight"); one('[data-switch-port="4"]', root())?.classList.add("is-cli-highlight"); note("A linha bbbb.bbbb.bbbb → Gi0/4 representa PC-B e a porta do laboratório.", "[data-cli-feedback]"); });
  }
  function setupSelfExplanation() {
    const section = one("[data-switch-self-explanation]");
    section?.querySelector("[data-switch-reference-button]")?.addEventListener("click", event => { one("[data-switch-reference]", section).hidden = false; event.currentTarget.disabled = true; });
  }
  function setupAsyncCheckpoint() {
    const container = one("#switch-checkpoint"); const start = one("[data-checkpoint-start]"); if (!container) return;
    async function submit(form, submitter) {
      window.NetStudySwitchWorkbench?.capture(); if (form.matches("[data-reset-current-form]")) window.NetStudySwitchWorkbench?.discard();
      const data = new FormData(form); if (submitter?.name) data.append(submitter.name, submitter.value); container.setAttribute("aria-busy", "true");
      try { const response = await fetch(form.action, {method: "POST", body: data, headers: {"X-Requested-With": "XMLHttpRequest", "Accept": "application/json"}, credentials: "same-origin"}); if (!response.ok) throw new Error("request failed"); const payload = await response.json(); const parsed = new DOMParser().parseFromString(payload.html, "text/html").querySelector("#switch-checkpoint"); if (!parsed) throw new Error("invalid response"); container.innerHTML = parsed.innerHTML; container.removeAttribute("aria-busy"); api()?.init(container); window.NetStudyExercises?.init(); window.NetStudySwitchWorkbench?.init(container); if (form.matches("[data-reset-current-form]")) container.scrollIntoView({behavior: "auto", block: "start"}); }
      catch { container.removeAttribute("aria-busy"); const message = document.createElement("div"); message.className = "alert alert-danger"; message.textContent = "Não foi possível registrar sua resposta. Tente novamente."; container.prepend(message); }
    }
    document.addEventListener("submit", event => { const form = event.target; if (!(form instanceof HTMLFormElement) || form.matches("[data-host-form],[data-switch-form]")) return; if (form === start || container.contains(form)) { event.preventDefault(); submit(form, event.submitter); } });
  }
  function setupGlossary() {
    const triggers = all("[data-switch-glossary]");
    let active = null;
    function close(trigger) {
      if (!trigger) return;
      const popover = document.getElementById(trigger.getAttribute("aria-controls"));
      trigger.setAttribute("aria-expanded", "false");
      if (popover) popover.hidden = true;
      if (active === trigger) active = null;
    }
    function position(trigger, popover) {
      const rect = trigger.getBoundingClientRect();
      const padding = 8;
      popover.style.width = `${Math.min(352, window.innerWidth - 2 * padding)}px`;
      popover.style.left = `${padding}px`;
      popover.style.top = `${padding}px`;
      const bounds = popover.getBoundingClientRect();
      const left = Math.max(padding, Math.min(rect.left, window.innerWidth - bounds.width - padding));
      const above = rect.top - bounds.height - padding;
      const top = above >= padding ? above : Math.min(rect.bottom + padding, window.innerHeight - bounds.height - padding);
      popover.style.left = `${left}px`;
      popover.style.top = `${Math.max(padding, top)}px`;
    }
    function open(trigger) {
      if (active && active !== trigger) close(active);
      const popover = document.getElementById(trigger.getAttribute("aria-controls"));
      if (!popover) return;
      trigger.setAttribute("aria-expanded", "true");
      popover.hidden = false;
      active = trigger;
      position(trigger, popover);
    }
    triggers.forEach((trigger) => {
      trigger.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") open(trigger); });
      trigger.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse" && !trigger.matches(":focus")) close(trigger); });
      trigger.addEventListener("focus", () => { if (!trigger.dataset.switchTouch) open(trigger); });
      trigger.addEventListener("blur", () => close(trigger));
      trigger.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "touch") return;
        trigger.dataset.switchTouch = "true";
        if (active === trigger) close(trigger);
        else open(trigger);
      });
      trigger.addEventListener("click", () => {
        if (trigger.dataset.switchTouch) { delete trigger.dataset.switchTouch; return; }
        open(trigger);
      });
    });
    document.addEventListener("pointerdown", (event) => {
      if (active && !event.target.closest("[data-switch-glossary], .switch-glossary-popover")) close(active);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && active) { close(active); event.stopPropagation(); }
    });
    window.addEventListener("resize", () => {
      if (active) position(active, document.getElementById(active.getAttribute("aria-controls")));
    });
  }
  setupGuidedLab(); setupCliProof(); setupSelfExplanation(); setupAsyncCheckpoint(); setupGlossary();
})();
