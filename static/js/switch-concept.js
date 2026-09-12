(() => {
  "use strict";

  const BOARD_ID = "switch-concept-shared";
  const FLOOD_PORTS = [3, 4, 6];
  const api = () => window.NetStudySwitchBoard;
  const getBoard = () => api()?.boards[BOARD_ID];
  const mac = () => api()?.MAC;
  const boardRoot = () => document.querySelector(`[data-board-id="${BOARD_ID}"]`);
  let activeStage = "problem";
  let stageState = {};

  const stageText = {
    problem: ["Área 01 · Entrada do frame", "Observe o frame chegar e identifique a decisão que ainda falta."],
    learning: ["Área 02 · Aprendizagem", "Selecione no próprio quadro as duas evidências usadas para aprender."],
    forwarding: ["Área 03 · Encaminhamento", "Cruze Destination MAC, tabela e porta de saída."],
    unknown: ["Área 04 · Flooding", "Marque no desenho as portas que devem receber uma cópia."],
    summary: ["Área 05 · Sequência completa", "Acompanhe os três frames sem trocar de switch."],
  };

  function setText(selector, value) {
    const target = document.querySelector(selector);
    if (target) target.textContent = value;
  }

  function setDone(selector, done) {
    const target = document.querySelector(selector);
    if (!target) return;
    target.classList.toggle("is-done", done);
    target.setAttribute("aria-label", `${target.textContent.trim()}: ${done ? "concluído" : "pendente"}`);
  }

  function prepareFrame(current, source, destination, ingress) {
    current.setFrame({ source, destination, ingress });
    current.state.step = 1;
    current.clearFrameState();
    const port = current.port(ingress);
    port.ingress = true;
    port.rx_frames += 1;
    port.rx_delta = 1;
    port.last_event = "FRAME_RECEIVED";
    port.last_frame_direction = "INGRESS";
    current.state.events = [`FRAME_RECEIVED · Gi0/${ingress}`];
    current.render();
  }

  function clearFloodChoices() {
    boardRoot()?.querySelectorAll("[data-switch-port]").forEach((port) => {
      port.classList.remove("is-flood-choice");
      port.setAttribute("aria-pressed", "false");
    });
  }

  function syncFloodChoices() {
    boardRoot()?.querySelectorAll("[data-switch-port]").forEach((port) => {
      port.setAttribute("aria-pressed", String(port.classList.contains("is-flood-choice")));
    });
  }

  function resetAreaUi(stage) {
    if (stage === "learning") {
      setDone("[data-learning-source]", false);
      setDone("[data-learning-port]", false);
      setText("[data-learning-feedback]", "Use as duas evidências que chegam juntas ao switch.");
    } else if (stage === "forwarding") {
      setDone("[data-forward-destination]", false);
      setDone("[data-forward-entry]", false);
      setDone("[data-forward-port]", false);
      setText("[data-forward-feedback]", "Cruze o campo do frame com a associação da tabela.");
    } else if (stage === "unknown") {
      clearFloodChoices();
      setText("[data-unknown-feedback]", "Selecione as portas no desenho do switch.");
      const later = document.querySelector("[data-later-learning]");
      if (later) later.hidden = true;
    } else if (stage === "summary") {
      const cycle = document.querySelector("[data-cycle-demo]");
      if (cycle) cycle.dataset.phase = "0";
      setText("[data-cycle-next]", "INICIAR FRAME A → B");
      setText("[data-cycle-feedback]", "Tabela vazia. Source AA, Destination BB.");
      const comparison = document.querySelector("[data-first-later]");
      if (comparison) comparison.hidden = true;
      const cli = document.querySelector("[data-cli-mac-b]");
      if (cli) { cli.disabled = true; cli.classList.remove("is-active"); }
      setText("[data-cli-feedback]", "A entrada de BB ficará disponível depois que a resposta for observada.");
    }
  }

  function activate(stage, announce = false) {
    const current = getBoard();
    if (!current || !stageText[stage]) return;
    activeStage = stage;
    stageState = stage === "unknown" ? { selected: new Set() } : {};
    current.reset();
    resetAreaUi(stage);
    const values = mac();
    if (stage === "problem") current.setFrame({ source: values.A, destination: values.B, ingress: 1 });
    if (stage === "learning") prepareFrame(current, values.C, values.A, 3);
    if (stage === "forwarding") {
      current.setMacEntry(values.B, 4, null);
      current.state.tableChanges = {};
      prepareFrame(current, values.A, values.B, 1);
    }
    if (stage === "unknown") prepareFrame(current, values.A, values.D, 1);
    if (stage === "summary") current.setFrame({ source: values.A, destination: values.B, ingress: 1 });
    setText("[data-shared-stage-title]", stageText[stage][0]);
    setText("[data-shared-stage-copy]", stageText[stage][1]);
    if (announce) setText("[data-shared-lab-feedback]", `${stageText[stage][0]} carregada no laboratório.`);
  }

  function completeLearningIfReady(current) {
    setDone("[data-learning-source]", Boolean(stageState.source));
    setDone("[data-learning-port]", Boolean(stageState.port));
    if (!stageState.source || !stageState.port || stageState.complete) return;
    stageState.complete = true;
    current.setMacEntry(mac().C, 3);
    current.render();
    setText("[data-learning-feedback]", "Correto. Source CC chegou pela Gi0/3: o switch aprendeu CC → Gi0/3.");
  }

  function handleLearning(kind, value, current) {
    if (stageState.complete) return;
    if (kind === "field") {
      if (value === "source") stageState.source = true;
      else setText("[data-learning-feedback]", "Destination MAC orienta a saída. O aprendizado observa o Source MAC.");
    } else if (kind === "port") {
      if (value === 3) stageState.port = true;
      else setText("[data-learning-feedback]", "A porta escolhida não é a entrada mostrada para este frame. Observe o destaque de ingresso.");
    }
    completeLearningIfReady(current);
  }

  function completeForwardingIfReady(current) {
    setDone("[data-forward-destination]", Boolean(stageState.destination));
    setDone("[data-forward-entry]", Boolean(stageState.entry));
    setDone("[data-forward-port]", Boolean(stageState.port));
    if (!stageState.destination || !stageState.entry || !stageState.port || stageState.complete) return;
    stageState.complete = true;
    current.receiveFrame({ source: mac().A, destination: mac().B, ingress: 1 });
    setText("[data-forward-feedback]", "Correto. Destination BB encontrou BB → Gi0/4; somente essa porta transmitiu o frame.");
  }

  function handleForwarding(kind, value, current) {
    if (stageState.complete) return;
    if (kind === "field") {
      if (value === "destination") stageState.destination = true;
      else setText("[data-forward-feedback]", "Source MAC serve ao aprendizado. Para decidir a saída, consulte o Destination MAC.");
    } else if (kind === "entry") {
      if (value === mac().B) stageState.entry = true;
      else setText("[data-forward-feedback]", "Essa entrada não corresponde ao Destination MAC deste frame.");
    } else if (kind === "port") {
      if (value === 4) stageState.port = true;
      else setText("[data-forward-feedback]", "Essa porta não corresponde à associação selecionada na tabela.");
    }
    completeForwardingIfReady(current);
  }

  function handleUnknownPort(portNumber) {
    if (portNumber === 1) {
      setText("[data-unknown-feedback]", "Gi0/1 é a porta de entrada. O flooding nunca devolve uma cópia por ela.");
      return;
    }
    if (!FLOOD_PORTS.includes(portNumber)) {
      setText("[data-unknown-feedback]", "Essa porta não participa do cenário atual. Marque apenas portas conectadas e diferentes da entrada.");
      return;
    }
    if (stageState.selected.has(portNumber)) stageState.selected.delete(portNumber);
    else stageState.selected.add(portNumber);
    const target = boardRoot()?.querySelector(`[data-switch-port="${portNumber}"]`);
    target?.classList.toggle("is-flood-choice", stageState.selected.has(portNumber));
    syncFloodChoices();
    setText("[data-unknown-feedback]", `${stageState.selected.size} porta(s) marcada(s). Confirme quando considerar a seleção completa.`);
  }

  function confirmFlood() {
    if (activeStage !== "unknown" || stageState.complete) return;
    const selected = [...stageState.selected].sort((a, b) => a - b);
    if (selected.length !== FLOOD_PORTS.length || selected.some((port, index) => port !== FLOOD_PORTS[index])) {
      setText("[data-unknown-feedback]", "A seleção ainda não representa todas as saídas possíveis. Releia os links conectados e exclua a entrada.");
      return;
    }
    stageState.complete = true;
    clearFloodChoices();
    getBoard().receiveFrame({ source: mac().A, destination: mac().D, ingress: 1 });
    setText("[data-unknown-feedback]", "Correto. DD não está na tabela: o switch replica o frame nas demais portas conectadas e exclui Gi0/1.");
    const later = document.querySelector("[data-later-learning]");
    if (later) later.hidden = false;
  }

  function advanceCycle() {
    if (activeStage !== "summary") activate("summary", true);
    const current = getBoard();
    const cycle = document.querySelector("[data-cycle-demo]");
    if (!current || !cycle) return;
    const phase = Number(cycle.dataset.phase);
    if (phase === 0) {
      current.receiveFrame({ source: mac().A, destination: mac().B, ingress: 1 });
      setText("[data-cycle-feedback]", "1. Entrou Gi0/1 → aprendeu AA → BB ausente → flooding.");
      setText("[data-cycle-next]", "AGORA FRAME B → A");
      cycle.dataset.phase = "1";
    } else if (phase === 1) {
      current.receiveFrame({ source: mac().B, destination: mac().A, ingress: 4 });
      setText("[data-cycle-feedback]", "2. A resposta entrou Gi0/4 → aprendeu BB → encontrou AA → enviou pela Gi0/1.");
      setText("[data-cycle-next]", "AGORA NOVO FRAME A → B");
      const cli = document.querySelector("[data-cli-mac-b]");
      if (cli) cli.disabled = false;
      cycle.dataset.phase = "2";
    } else if (phase === 2) {
      current.receiveFrame({ source: mac().A, destination: mac().B, ingress: 1 });
      setText("[data-cycle-feedback]", "3. BB já está na tabela → o novo frame saiu somente pela Gi0/4.");
      setText("[data-cycle-next]", "REINICIAR SEQUÊNCIA");
      const comparison = document.querySelector("[data-first-later]");
      if (comparison) comparison.hidden = false;
      cycle.dataset.phase = "3";
    } else activate("summary", true);
  }

  function handleBoardAction(event) {
    const current = getBoard();
    if (!current) return;
    const row = event.target.closest("[data-mac-entry]");
    const field = event.target.closest("[data-frame-field]");
    const port = event.target.closest("[data-switch-port]");
    if (activeStage === "learning") {
      if (field) handleLearning("field", field.dataset.frameField, current);
      else if (port) handleLearning("port", Number(port.dataset.switchPort), current);
    } else if (activeStage === "forwarding") {
      if (row) handleForwarding("entry", row.dataset.mac, current);
      else if (field) handleForwarding("field", field.dataset.frameField, current);
      else if (port) handleForwarding("port", Number(port.dataset.switchPort), current);
    } else if (activeStage === "unknown" && port) handleUnknownPort(Number(port.dataset.switchPort));
  }

  function setupSharedBoard() {
    const root = boardRoot();
    if (!root || !getBoard()) return;
    root.addEventListener("click", handleBoardAction);
    root.addEventListener("keydown", (event) => {
      const interactive = event.target.closest("[data-switch-port], [data-mac-entry]");
      if (!interactive || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (interactive.dataset.switchPort) getBoard().inspect(Number(interactive.dataset.switchPort));
      else getBoard().selectMac(interactive.dataset.macEntry);
      handleBoardAction({ target: interactive });
    }, true);
    root.addEventListener("click", (event) => {
      if (!event.target.closest("[data-board-reset]")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      activate(activeStage, true);
    }, true);
    document.querySelectorAll("[data-stage-link]").forEach((link) => link.addEventListener("click", () => activate(link.dataset.stageLink, true)));
    document.querySelector("[data-problem-enter]")?.addEventListener("click", () => {
      activate("problem");
      prepareFrame(getBoard(), mac().A, mac().B, 1);
      setText("[data-problem-feedback]", "O frame entrou pela Gi0/1. A tabela está vazia: o switch ainda precisa descobrir por onde alcançar BB.");
      document.querySelector("#switch-shared-lab")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.querySelector("[data-flood-confirm]")?.addEventListener("click", confirmFlood);
    document.querySelector("[data-cycle-next]")?.addEventListener("click", advanceCycle);
    activate("problem");
  }

  function setupCliProof() {
    const root = document.querySelector("[data-switch-cli-proof]");
    const button = root?.querySelector("[data-cli-mac-b]");
    if (!root || !button) return;
    button.addEventListener("click", () => {
      const currentRoot = boardRoot();
      currentRoot?.querySelectorAll(".is-cli-highlight").forEach((item) => item.classList.remove("is-cli-highlight"));
      currentRoot?.querySelector('[data-host="B"]')?.classList.add("is-cli-highlight");
      currentRoot?.querySelector('[data-switch-port="4"]')?.classList.add("is-cli-highlight");
      setText("[data-cli-feedback]", "A linha bbbb.bbbb.bbbb → Gi0/4 representa PC-B e a mesma porta Gi0/4 do laboratório.");
      button.classList.add("is-active");
    });
  }

  function setupSelfExplanation() {
    const root = document.querySelector("[data-switch-self-explanation]");
    if (!root) return;
    root.querySelector("[data-switch-reference-button]")?.addEventListener("click", (event) => {
      root.querySelector("[data-switch-reference]").hidden = false;
      event.currentTarget.disabled = true;
    });
  }

  function setupAsyncCheckpoint() {
    const container = document.querySelector("#switch-checkpoint");
    const start = document.querySelector("[data-checkpoint-start]");
    if (!container) return;
    async function submit(form, submitter) {
      window.NetStudySwitchWorkbench?.capture();
      if (form.matches("[data-reset-current-form]")) window.NetStudySwitchWorkbench?.discard();
      const data = new FormData(form);
      if (submitter?.name) data.append(submitter.name, submitter.value);
      container.setAttribute("aria-busy", "true");
      try {
        const response = await fetch(form.action, { method: "POST", body: data, headers: { "X-Requested-With": "XMLHttpRequest", "Accept": "application/json" }, credentials: "same-origin" });
        if (!response.ok) throw new Error("request failed");
        const payload = await response.json();
        const parsed = new DOMParser().parseFromString(payload.html, "text/html").querySelector("#switch-checkpoint");
        if (!parsed) throw new Error("invalid response");
        container.innerHTML = parsed.innerHTML;
        container.removeAttribute("aria-busy");
        api()?.init(container);
        window.NetStudyExercises?.init();
        window.NetStudySwitchWorkbench?.init(container);
        if (form.matches("[data-reset-current-form]")) container.scrollIntoView({ behavior: "auto", block: "start" });
      } catch (error) {
        container.removeAttribute("aria-busy");
        const message = document.createElement("div");
        message.className = "alert alert-danger";
        message.textContent = "Não foi possível registrar sua resposta. Tente novamente.";
        container.prepend(message);
      }
    }
    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.matches("[data-host-form],[data-switch-form]")) return;
      if (form === start || container.contains(form)) {
        event.preventDefault();
        submit(form, event.submitter);
      }
    });
  }

  setupSharedBoard();
  setupCliProof();
  setupSelfExplanation();
  setupAsyncCheckpoint();
})();
