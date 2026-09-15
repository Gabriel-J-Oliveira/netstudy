(() => {
  "use strict";

  const BOARD_ID = "delivery-concept-shared";
  const OUTPUT_PORTS = [3, 4, 6];
  const api = () => window.NetStudySwitchBoard;
  const getBoard = () => api()?.boards[BOARD_ID];
  const mac = () => api()?.MAC;
  const boardRoot = () => document.querySelector(`[data-board-id="${BOARD_ID}"]`);
  let activeStage = "destination";
  let stageState = {};

  const stageText = {
    destination: ["Área 01 · Ler o destino", "Classifique a intenção antes de procurar uma saída."],
    known: ["Área 02 · Unicast conhecido", "Relacione Destination MAC, tabela e porta."],
    broadcast: ["Área 03 · Broadcast", "Marque as saídas aplicáveis, mantendo a entrada excluída."],
    unknown: ["Área 04 · Unknown Unicast", "Confirme o destino específico, a ausência na tabela e o flooding."],
    summary: ["Área 05 · Síntese", "Compare intenção do frame e ação do switch no mesmo equipamento."],
  };

  function setText(selector, value) {
    const target = document.querySelector(selector);
    if (target) target.textContent = value;
  }

  function feedback(selector, value) {
    setText(selector, value);
    setText("[data-delivery-lab-feedback]", value);
  }

  function setDone(selector, done) {
    const target = document.querySelector(selector);
    if (!target) return;
    target.classList.toggle("is-done", done);
    target.setAttribute("aria-label", `${target.textContent.trim()}: ${done ? "concluído" : "pendente"}`);
  }

  function prepareFrame(current, source, destination, ingress = 1) {
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

  function clearPortChoices() {
    const current = getBoard();
    if (current?.state) {
      Object.values(current.state.ports).forEach((port) => { port.selected = false; });
      current.state.selectedPort = null;
      current.renderPorts();
    }
    boardRoot()?.querySelectorAll("[data-switch-port]").forEach((port) => {
      port.classList.remove("is-delivery-choice");
      port.setAttribute("aria-pressed", "false");
    });
  }

  function syncPortChoices() {
    boardRoot()?.querySelectorAll("[data-switch-port]").forEach((port) => {
      port.setAttribute("aria-pressed", String(port.classList.contains("is-delivery-choice")));
    });
  }

  function showControls(stage) {
    const broadcast = document.querySelector("[data-broadcast-confirm]");
    const unknown = document.querySelector("[data-unknown-controls]");
    const summary = document.querySelector("[data-summary-controls]");
    if (broadcast) broadcast.hidden = stage !== "broadcast";
    if (unknown) unknown.hidden = stage !== "unknown";
    if (summary) summary.hidden = stage !== "summary";
  }

  function resetStageUi(stage) {
    clearPortChoices();
    if (stage === "destination") feedback("[data-destination-feedback]", "Primeiro classifique a intenção; a saída ainda não foi decidida.");
    if (stage === "known") {
      setDone("[data-known-destination]", false);
      setDone("[data-known-entry]", false);
      setDone("[data-known-port]", false);
      feedback("[data-known-feedback]", "A ordem é livre: relacione frame, tabela e porta.");
    }
    if (stage === "broadcast") feedback("[data-broadcast-feedback]", "Selecione as saídas no desenho e confirme no laboratório.");
    if (stage === "unknown") {
      setDone("[data-unknown-destination]", false);
      setDone("[data-unknown-table]", false);
      setDone("[data-unknown-ports]", false);
      feedback("[data-unknown-feedback]", "Há várias saídas possíveis, mas a classificação vem do endereço DD.");
    }
    if (stage === "summary") {
      document.querySelectorAll("[data-summary]").forEach((button) => button.classList.remove("is-active"));
      feedback("[data-summary-feedback]", "Escolha um dos três cenários junto ao switch.");
    }
  }

  function activate(stage, announce = false) {
    const current = getBoard();
    if (!current || !stageText[stage]) return;
    activeStage = stage;
    stageState = { selected: new Set() };
    current.reset();
    showControls(stage);
    resetStageUi(stage);
    const values = mac();
    if (stage === "destination") prepareFrame(current, values.A, values.B);
    if (stage === "known") {
      current.setMacEntry(values.B, 4, null);
      current.state.tableChanges = {};
      prepareFrame(current, values.A, values.B);
    }
    if (stage === "broadcast") prepareFrame(current, values.A, values.BROADCAST);
    if (stage === "unknown") {
      current.setMacEntry(values.A, 1, null);
      current.state.tableChanges = {};
      prepareFrame(current, values.A, values.D);
    }
    setText("[data-delivery-stage-title]", stageText[stage][0]);
    setText("[data-delivery-stage-copy]", stageText[stage][1]);
    if (announce) setText("[data-delivery-lab-feedback]", `${stageText[stage][0]} carregada no laboratório.`);
  }

  function handleDestinationField(field) {
    if (field !== "destination") {
      feedback("[data-destination-feedback]", "Source MAC identifica a origem. Para classificar a intenção, observe o Destination MAC.");
      return;
    }
    boardRoot()?.querySelectorAll("[data-frame-field]").forEach((item) => item.classList.toggle("is-didactic-focus", item.dataset.frameField === "destination"));
    feedback("[data-destination-feedback]", "BB é específico; portanto a intenção é Unicast. Ainda não sabemos a saída.");
  }

  function completeKnownIfReady(current) {
    setDone("[data-known-destination]", Boolean(stageState.destination));
    setDone("[data-known-entry]", Boolean(stageState.entry));
    setDone("[data-known-port]", Boolean(stageState.port));
    if (!stageState.destination || !stageState.entry || !stageState.port || stageState.complete) return;
    stageState.complete = true;
    current.receiveFrame({ source: mac().A, destination: mac().B, ingress: 1 });
    feedback("[data-known-feedback]", "Destination BB define Unicast; a associação BB → Gi0/4 faz o switch encaminhar somente pela Gi0/4.");
  }

  function handleKnown(kind, value, current) {
    if (stageState.complete) return;
    if (kind === "field") {
      if (value === "destination") stageState.destination = true;
      else feedback("[data-known-feedback]", "Source MAC é usado para aprender. A decisão de saída começa no Destination MAC.");
    } else if (kind === "entry") {
      if (value === mac().B) stageState.entry = true;
      else feedback("[data-known-feedback]", "Essa associação não corresponde ao Destination MAC do frame.");
    } else if (kind === "port") {
      if (value === 4) stageState.port = true;
      else feedback("[data-known-feedback]", "A porta escolhida não corresponde à associação consultada na tabela.");
    }
    completeKnownIfReady(current);
  }

  function toggleOutputPort(portNumber, selector) {
    if (portNumber === 1) {
      getBoard().port(portNumber).selected = false;
      getBoard().state.selectedPort = null;
      getBoard().renderPorts();
      syncPortChoices();
      feedback(selector, "Gi0/1 é a entrada. O switch não devolve uma cópia pela porta em que o frame chegou.");
      return;
    }
    if (!OUTPUT_PORTS.includes(portNumber)) {
      getBoard().port(portNumber).selected = false;
      getBoard().state.selectedPort = null;
      getBoard().renderPorts();
      syncPortChoices();
      feedback(selector, "Essa porta não participa do cenário. Considere apenas links conectados e diferentes da entrada.");
      return;
    }
    if (stageState.selected.has(portNumber)) stageState.selected.delete(portNumber);
    else stageState.selected.add(portNumber);
    boardRoot()?.querySelector(`[data-switch-port="${portNumber}"]`)?.classList.toggle("is-delivery-choice", stageState.selected.has(portNumber));
    syncPortChoices();
    feedback(selector, `${stageState.selected.size} porta(s) marcada(s). Confirme quando a seleção estiver completa.`);
  }

  function selectionIsComplete() {
    const selected = [...stageState.selected].sort((a, b) => a - b);
    return selected.length === OUTPUT_PORTS.length && selected.every((port, index) => port === OUTPUT_PORTS[index]);
  }

  function confirmBroadcast() {
    if (activeStage !== "broadcast" || stageState.complete) return;
    if (!selectionIsComplete()) {
      feedback("[data-broadcast-feedback]", "A seleção ainda não contém todas as saídas aplicáveis. Observe os links ativos e mantenha a entrada excluída.");
      return;
    }
    stageState.complete = true;
    clearPortChoices();
    getBoard().receiveFrame({ source: mac().A, destination: mac().BROADCAST, ingress: 1 });
    feedback("[data-broadcast-feedback]", "FF:FF:FF:FF:FF:FF define Broadcast por si só; o switch replica pelas demais portas aplicáveis do domínio local.");
  }

  function checkUnknownTable() {
    if (activeStage !== "unknown" || stageState.complete) return;
    stageState.table = true;
    setDone("[data-unknown-table]", true);
    feedback("[data-unknown-feedback]", "DD não foi encontrado na MAC Address Table. Isso determina flooding, não muda a intenção Unicast.");
  }

  function handleUnknownField(field) {
    if (stageState.complete) return;
    if (field === "destination") {
      stageState.destination = true;
      setDone("[data-unknown-destination]", true);
      feedback("[data-unknown-feedback]", "DD é um Destination MAC específico: o frame é Unicast. Agora consulte a tabela.");
    } else feedback("[data-unknown-feedback]", "A classificação deste caso depende do Destination MAC, não do Source MAC.");
  }

  function confirmUnknown() {
    if (activeStage !== "unknown" || stageState.complete) return;
    if (!stageState.destination) {
      feedback("[data-unknown-feedback]", "Antes das saídas, identifique a intenção clicando no Destination MAC.");
      return;
    }
    if (!stageState.table) {
      feedback("[data-unknown-feedback]", "Ainda falta consultar se DD possui uma associação na tabela.");
      return;
    }
    if (!selectionIsComplete()) {
      feedback("[data-unknown-feedback]", "A seleção ainda não representa todas as saídas aplicáveis. Exclua a entrada e observe os links ativos.");
      return;
    }
    stageState.complete = true;
    setDone("[data-unknown-ports]", true);
    clearPortChoices();
    getBoard().receiveFrame({ source: mac().A, destination: mac().D, ingress: 1 });
    feedback("[data-unknown-feedback]", "DD continua sendo o Destination MAC em todas as cópias. Há várias saídas, mas isto não é Broadcast.");
  }

  function loadSummaryScenario(kind, button) {
    if (activeStage !== "summary") activate("summary");
    const current = getBoard();
    if (!current) return;
    current.reset();
    document.querySelectorAll("[data-summary]").forEach((item) => item.classList.toggle("is-active", item === button));
    if (kind === "known") {
      current.setMacEntry(mac().B, 4, null);
      current.state.tableChanges = {};
      current.receiveFrame({ source: mac().A, destination: mac().B, ingress: 1 });
      feedback("[data-summary-feedback]", "Intenção: Destination BB é Unicast. Ação: BB conhecido faz o switch usar somente Gi0/4.");
    } else if (kind === "unknown") {
      current.receiveFrame({ source: mac().A, destination: mac().D, ingress: 1 });
      feedback("[data-summary-feedback]", "Intenção: Destination DD é Unicast. Ação: DD desconhecido provoca flooding, mantendo DD nas cópias.");
    } else {
      current.receiveFrame({ source: mac().A, destination: mac().BROADCAST, ingress: 1 });
      feedback("[data-summary-feedback]", "Intenção: FF:FF:FF:FF:FF:FF é Broadcast. Ação: o switch replica no domínio local, sem retornar à entrada.");
    }
  }

  function handleBoardAction(event) {
    const current = getBoard();
    if (!current) return;
    const row = event.target.closest("[data-mac-entry]");
    const field = event.target.closest("[data-frame-field]");
    const port = event.target.closest("[data-switch-port]");
    if (activeStage === "destination" && field) handleDestinationField(field.dataset.frameField);
    else if (activeStage === "known") {
      if (row) handleKnown("entry", row.dataset.mac, current);
      else if (field) handleKnown("field", field.dataset.frameField, current);
      else if (port) handleKnown("port", Number(port.dataset.switchPort), current);
    } else if (activeStage === "broadcast" && port) toggleOutputPort(Number(port.dataset.switchPort), "[data-broadcast-feedback]");
    else if (activeStage === "unknown") {
      if (field) handleUnknownField(field.dataset.frameField);
      else if (port) toggleOutputPort(Number(port.dataset.switchPort), "[data-unknown-feedback]");
    }
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
    document.querySelectorAll("[data-delivery-stage-link]").forEach((link) => link.addEventListener("click", (event) => {
      event.preventDefault();
      activate(link.dataset.deliveryStageLink, true);
      const lab = document.querySelector("#delivery-shared-lab");
      const bounds = lab?.getBoundingClientRect();
      if (lab && bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight)) {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        lab.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      }
    }));
    document.querySelector("[data-broadcast-confirm]")?.addEventListener("click", confirmBroadcast);
    document.querySelector("[data-unknown-table-check]")?.addEventListener("click", checkUnknownTable);
    document.querySelector("[data-unknown-confirm]")?.addEventListener("click", confirmUnknown);
    document.querySelectorAll("[data-summary]").forEach((button) => button.addEventListener("click", () => loadSummaryScenario(button.dataset.summary, button)));
    activate("destination");
  }

  function setupArp() {
    const button = document.querySelector("[data-arp-demo]");
    const target = document.querySelector("[data-arp-feedback]");
    if (!button || !target) return;
    let showingRequest = false;
    button.addEventListener("click", () => {
      showingRequest = !showingRequest;
      target.textContent = showingRequest ? "ARP Request: Destination FF:FF:FF:FF:FF:FF → Broadcast local." : "ARP Reply no fluxo estudado: Destination MAC do solicitante → Unicast.";
      button.textContent = showingRequest ? "AGORA VER O ARP REPLY" : "REINICIAR REQUEST × REPLY";
    });
  }

  function setupSelfExplanation() {
    const root = document.querySelector("[data-delivery-self-explanation]");
    if (!root) return;
    root.querySelector("[data-delivery-reference-button]")?.addEventListener("click", (event) => {
      root.querySelector("[data-delivery-reference]").hidden = false;
      event.currentTarget.disabled = true;
    });
  }

  function setupAsyncCheckpoint() {
    const container = document.querySelector("#delivery-checkpoint");
    const start = document.querySelector("[data-delivery-checkpoint-start]");
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
        const parsed = new DOMParser().parseFromString(payload.html, "text/html").querySelector("#delivery-checkpoint");
        if (!parsed) throw new Error("invalid response");
        container.innerHTML = parsed.innerHTML;
        container.removeAttribute("aria-busy");
        api()?.init(container);
        window.NetStudyExercises?.init();
        window.NetStudySwitchWorkbench?.init(container);
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
      if (!(form instanceof HTMLFormElement) || form.matches("[data-host-form],[data-switch-form]")) return;
      if (form === start || container.contains(form)) {
        event.preventDefault();
        submit(form, event.submitter);
      }
    });
  }

  setupSharedBoard();
  setupArp();
  setupSelfExplanation();
  setupAsyncCheckpoint();
})();
