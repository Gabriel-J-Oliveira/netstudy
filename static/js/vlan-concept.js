(() => {
  "use strict";

  const BOARD_ID = "vlan-concept-shared";
  const api = () => window.NetStudySwitchBoard;
  const getBoard = () => api()?.boards[BOARD_ID];
  const mac = () => api()?.MAC;
  const boardRoot = () => document.querySelector(`[data-board-id="${BOARD_ID}"]`);
  let activeStage = "why";
  let stageState = {};

  const stageText = {
    why: ["Área 01 · Por que separar?", "Compare o mesmo broadcast antes e depois da organização lógica."],
    groups: ["Área 02 · Grupos lógicos", "Inspecione as portas Access e reconheça as duas VLANs."],
    access: ["Área 03 · Porta Access", "Observe a Gi0/5 e altere a participação lógica de PC-E."],
    frames: ["Área 04 · Alcance dos frames", "Escolha um cenário e confirme as saídas dentro da VLAN 10."],
    summary: ["Área 05 · Síntese", "Execute quatro passos no mesmo switch e acompanhe cada consequência."],
  };

  function setText(selector, value) {
    const target = document.querySelector(selector);
    if (target) target.textContent = value;
  }

  function feedback(selector, value) {
    setText(selector, value);
    setText("[data-vlan-lab-feedback]", value);
  }

  function setDone(selector, done) {
    const target = document.querySelector(selector);
    if (!target) return;
    target.classList.toggle("is-done", done);
    target.setAttribute("aria-label", `${target.textContent.trim()}: ${done ? "concluído" : "pendente"}`);
  }

  function configureSplit(current, includeE = false) {
    current.setAccessVlan(1, 10);
    current.setAccessVlan(2, 10);
    current.setAccessVlan(3, 20);
    current.setAccessVlan(4, 20);
    if (includeE) {
      current.connectDevice("PC-E", 5);
      current.setAccessVlan(5, 20);
    }
    current.toggleVlanView(true);
    current.state.events = ["VLAN 10 · Gi0/1, Gi0/2", "VLAN 20 · Gi0/3, Gi0/4" + (includeE ? ", Gi0/5" : "")];
    current.render();
  }

  function seedMacTable(current) {
    current.setMacEntry(mac().A, 1, null, 10);
    current.setMacEntry(mac().B, 2, null, 10);
    current.setMacEntry(mac().C, 3, null, 20);
    current.setMacEntry(mac().D, 4, null, 20);
    current.state.tableChanges = {};
    current.render();
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
    current.state.events = [`FRAME_RECEIVED · Gi0/${ingress} · VLAN ${port.access_vlan}`];
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
      port.classList.remove("is-vlan-choice");
      port.setAttribute("aria-pressed", "false");
    });
  }

  function syncPortChoices() {
    boardRoot()?.querySelectorAll("[data-switch-port]").forEach((port) => {
      port.setAttribute("aria-pressed", String(port.classList.contains("is-vlan-choice")));
    });
  }

  function showControls(stage) {
    const opening = document.querySelector("[data-opening-controls]");
    const access = document.querySelector("[data-access-change]");
    const frames = document.querySelector("[data-frame-controls]");
    const summary = document.querySelector("[data-summary-next]");
    if (opening) opening.hidden = stage !== "why";
    if (access) access.hidden = stage !== "access";
    if (frames) frames.hidden = stage !== "frames";
    if (summary) summary.hidden = stage !== "summary";
  }

  function updateCliOutput() {
    const current = getBoard();
    if (!current) return;
    [10, 20].forEach((vlan) => {
      const ports = Object.values(current.state.ports)
        .filter((port) => port.link_status === "up" && port.access_vlan === vlan && port.name !== "Gi0/5")
        .map((port) => port.name)
        .join(", ") || "—";
      setText(`[data-cli-vlan${vlan}-ports]`, ports);
      setText(`[data-cli-button-ports="${vlan}"]`, ports);
    });
  }

  function resetStageUi(stage) {
    clearPortChoices();
    boardRoot()?.classList.remove("is-groups-identified");
    if (stage === "why") {
      document.querySelectorAll("[data-opening-mode]").forEach((button) => button.classList.remove("is-active"));
      feedback("[data-opening-feedback]", "Use as duas ações ao lado do switch.");
    }
    if (stage === "groups") {
      document.querySelectorAll("[data-group-port]").forEach((item) => setDone(`[data-group-port="${item.dataset.groupPort}"]`, false));
      feedback("[data-groups-feedback]", "VLAN 10 e VLAN 20 ainda precisam ser relacionadas às portas.");
    }
    if (stage === "access") {
      setDone("[data-access-inspected]", false);
      setDone("[data-access-moved]", false);
      const button = document.querySelector("[data-access-change]");
      if (button) button.disabled = false;
      const result = document.querySelector("[data-access-result]");
      const physical = document.querySelector("[data-access-physical]");
      if (result) result.hidden = true;
      if (physical) physical.hidden = true;
      feedback("[data-access-feedback]", "Comece selecionando Gi0/5 no switch.");
    }
    if (stage === "frames") {
      setDone("[data-frame-scenario-status]", false);
      setDone("[data-frame-ports-status]", false);
      document.querySelectorAll("[data-frame-scenario]").forEach((button) => button.classList.remove("is-active"));
      feedback("[data-frame-feedback]", "A VLAN da porta de entrada define o contexto desta decisão.");
    }
    if (stage === "summary") {
      document.querySelectorAll("[data-summary-step]").forEach((item) => item.classList.remove("is-done", "is-current"));
      setText("[data-summary-next]", "INICIAR PASSO 1");
      const change = document.querySelector("[data-summary-change]");
      const physical = document.querySelector("[data-nothing-physical]");
      if (change) change.hidden = true;
      if (physical) physical.hidden = true;
      feedback("[data-summary-feedback]", "A sequência ainda não começou.");
    }
  }

  function activate(stage, announce = false) {
    const current = getBoard();
    if (!current || !stageText[stage]) return;
    activeStage = stage;
    stageState = { inspected: new Set(), selected: new Set(), phase: 0 };
    current.reset();
    showControls(stage);
    resetStageUi(stage);
    if (stage === "groups") configureSplit(current);
    if (stage === "access") configureSplit(current, true);
    if (stage === "frames" || stage === "summary") {
      configureSplit(current);
      seedMacTable(current);
    }
    if (stage === "summary") updateCliOutput();
    setText("[data-vlan-stage-title]", stageText[stage][0]);
    setText("[data-vlan-stage-copy]", stageText[stage][1]);
    if (announce) setText("[data-vlan-lab-feedback]", `${stageText[stage][0]} carregada no laboratório.`);
  }

  function runOpening(mode, button) {
    if (activeStage !== "why") activate("why");
    const current = getBoard();
    current.reset();
    document.querySelectorAll("[data-opening-mode]").forEach((item) => item.classList.toggle("is-active", item === button));
    if (mode === "together") {
      current.receiveFrame({ source: mac().A, destination: mac().BROADCAST, ingress: 1 });
      feedback("[data-opening-feedback]", "Sem separação: o broadcast de A alcança B, C e D no mesmo contexto de Camada 2.");
    } else {
      configureSplit(current);
      current.receiveFrame({ source: mac().A, destination: mac().BROADCAST, ingress: 1 });
      feedback("[data-opening-feedback]", "Com VLAN 10 e VLAN 20, o broadcast de A alcança somente B. Nenhum host, cabo, porta ou switch físico mudou; apenas a organização lógica.");
    }
  }

  function inspectGroupPort(portNumber) {
    if (![1, 2, 3, 4].includes(portNumber)) {
      feedback("[data-groups-feedback]", "Nesta etapa, inspecione Gi0/1 a Gi0/4 para comparar os dois grupos.");
      return;
    }
    stageState.inspected.add(portNumber);
    setDone(`[data-group-port="${portNumber}"]`, true);
    const current = getBoard();
    const port = current.port(portNumber);
    const hasVlan10 = [...stageState.inspected].some((number) => current.port(number).access_vlan === 10);
    const hasVlan20 = [...stageState.inspected].some((number) => current.port(number).access_vlan === 20);
    if (hasVlan10 && hasVlan20) {
      boardRoot()?.classList.add("is-groups-identified");
      feedback("[data-groups-feedback]", `${port.name}: ${port.connected_device}, modo Access, VLAN ${port.access_vlan}. Os dois contextos lógicos já foram identificados no mesmo switch físico.`);
    } else feedback("[data-groups-feedback]", `${port.name}: ${port.connected_device}, modo Access, VLAN ${port.access_vlan}. Agora inspecione uma porta do outro grupo.`);
  }

  function inspectAccessPort(portNumber) {
    if (portNumber !== 5) {
      feedback("[data-access-feedback]", "A mudança desta etapa ocorre na Gi0/5, onde PC-E está conectado.");
      return;
    }
    stageState.accessInspected = true;
    setDone("[data-access-inspected]", true);
    feedback("[data-access-feedback]", "Gi0/5 conecta PC-E e está em modo Access VLAN 20. Agora altere sua VLAN.");
  }

  function changeAccessVlan() {
    if (activeStage !== "access") return;
    if (!stageState.accessInspected) {
      feedback("[data-access-feedback]", "Inspecione Gi0/5 antes de alterar a configuração lógica.");
      return;
    }
    const current = getBoard();
    current.setAccessVlan(5, 10);
    current.inspect(5);
    stageState.accessChanged = true;
    setDone("[data-access-moved]", true);
    const result = document.querySelector("[data-access-result]");
    const physical = document.querySelector("[data-access-physical]");
    const button = document.querySelector("[data-access-change]");
    if (result) result.hidden = false;
    if (physical) physical.hidden = false;
    if (button) button.disabled = true;
    feedback("[data-access-feedback]", "PC-E continua na mesma Gi0/5 e no mesmo cabo, mas agora participa da VLAN 10 com A e B.");
  }

  function chooseFrameScenario(kind, button) {
    if (activeStage !== "frames") activate("frames");
    const current = getBoard();
    current.reset();
    configureSplit(current);
    seedMacTable(current);
    stageState.scenario = kind;
    stageState.selected = new Set();
    clearPortChoices();
    document.querySelectorAll("[data-frame-scenario]").forEach((item) => item.classList.toggle("is-active", item === button));
    setDone("[data-frame-scenario-status]", true);
    setDone("[data-frame-ports-status]", false);
    prepareFrame(current, mac().A, kind === "broadcast" ? mac().BROADCAST : mac().E, 1);
    feedback("[data-frame-feedback]", kind === "broadcast" ? "Broadcast de A preparado na VLAN 10. Marque as portas aplicáveis antes de confirmar." : "Destination EE não está na tabela da VLAN 10. Marque as portas aplicáveis ao flooding.");
  }

  function eligiblePorts() {
    const current = getBoard();
    const ingress = current.port(current.state.ingress);
    return Object.values(current.state.ports)
      .filter((port) => port.link_status === "up" && port.name !== ingress.name && port.access_vlan === ingress.access_vlan)
      .map((port) => Number(port.name.split("/")[1]))
      .sort((a, b) => a - b);
  }

  function toggleFramePort(portNumber) {
    if (!stageState.scenario) {
      feedback("[data-frame-feedback]", "Escolha primeiro Broadcast ou Unknown Unicast para preparar o frame.");
      return;
    }
    const current = getBoard();
    if (portNumber === current.state.ingress) {
      current.port(portNumber).selected = false;
      current.state.selectedPort = null;
      current.renderPorts();
      syncPortChoices();
      feedback("[data-frame-feedback]", "Gi0/1 é a entrada; o switch não devolve uma cópia pela porta em que o frame chegou.");
      return;
    }
    if (!eligiblePorts().includes(portNumber)) {
      current.port(portNumber).selected = false;
      current.state.selectedPort = null;
      current.renderPorts();
      syncPortChoices();
      feedback("[data-frame-feedback]", `Gi0/${portNumber} pertence a outro contexto VLAN ou não possui link aplicável neste cenário.`);
      return;
    }
    if (stageState.selected.has(portNumber)) stageState.selected.delete(portNumber);
    else stageState.selected.add(portNumber);
    boardRoot()?.querySelector(`[data-switch-port="${portNumber}"]`)?.classList.toggle("is-vlan-choice", stageState.selected.has(portNumber));
    syncPortChoices();
    feedback("[data-frame-feedback]", `${stageState.selected.size} porta(s) marcada(s). Confirme quando o alcance estiver completo.`);
  }

  function confirmFramePorts() {
    if (activeStage !== "frames" || !stageState.scenario) {
      feedback("[data-frame-feedback]", "Escolha um dos dois cenários antes de confirmar as portas.");
      return;
    }
    const expected = eligiblePorts();
    const selected = [...stageState.selected].sort((a, b) => a - b);
    if (selected.length !== expected.length || selected.some((port, index) => port !== expected[index])) {
      feedback("[data-frame-feedback]", "A seleção não corresponde às saídas da VLAN de entrada. Observe a VLAN indicada em cada porta e tente novamente.");
      return;
    }
    clearPortChoices();
    const current = getBoard();
    current.receiveFrame({ source: mac().A, destination: stageState.scenario === "broadcast" ? mac().BROADCAST : mac().E, ingress: 1 });
    setDone("[data-frame-ports-status]", true);
    feedback("[data-frame-feedback]", stageState.scenario === "broadcast" ? "Correto. O broadcast de A permanece na VLAN 10: somente Gi0/2, onde está B, recebe." : "Correto. EE é desconhecido, mas o unknown-unicast flooding permanece na VLAN 10 e usa somente Gi0/2.");
  }

  function setSummaryStep(number) {
    document.querySelectorAll("[data-summary-step]").forEach((item) => {
      const step = Number(item.dataset.summaryStep);
      item.classList.toggle("is-done", step <= number);
      item.classList.toggle("is-current", step === number);
    });
  }

  function advanceSummary() {
    if (activeStage !== "summary") activate("summary");
    const current = getBoard();
    const phase = stageState.phase;
    if (phase === 0) {
      current.receiveFrame({ source: mac().A, destination: mac().BROADCAST, ingress: 1 });
      setSummaryStep(1);
      feedback("[data-summary-feedback]", "1. Broadcast de A entrou na VLAN 10 e alcançou somente B em Gi0/2.");
      setText("[data-summary-next]", "EXECUTAR PASSO 2");
      stageState.phase = 1;
    } else if (phase === 1) {
      current.receiveFrame({ source: mac().A, destination: mac().B, ingress: 1 });
      setSummaryStep(2);
      feedback("[data-summary-feedback]", "2. BB conhecido na VLAN 10: o Unicast A → B saiu diretamente pela Gi0/2.");
      setText("[data-summary-next]", "EXECUTAR PASSO 3");
      stageState.phase = 2;
    } else if (phase === 2) {
      current.receiveFrame({ source: mac().A, destination: mac().E, ingress: 1 });
      setSummaryStep(3);
      feedback("[data-summary-feedback]", "3. EE desconhecido: flooding apenas pela outra porta aplicável da VLAN 10, Gi0/2.");
      setText("[data-summary-next]", "EXECUTAR PASSO 4");
      stageState.phase = 3;
    } else if (phase === 3) {
      current.setAccessVlan(2, 20);
      delete current.state.table[current.tableKey(mac().B, 10)];
      current.setMacEntry(mac().B, 2, null, 20);
      current.receiveFrame({ source: mac().A, destination: mac().BROADCAST, ingress: 1 });
      setSummaryStep(4);
      updateCliOutput();
      const change = document.querySelector("[data-summary-change]");
      const physical = document.querySelector("[data-nothing-physical]");
      if (change) change.hidden = false;
      if (physical) physical.hidden = false;
      feedback("[data-summary-feedback]", "4. Gi0/2 passou à VLAN 20. B deixou de receber o broadcast de A sem mudança de host, cabo, porta física ou switch.");
      setText("[data-summary-next]", "REINICIAR SEQUÊNCIA");
      stageState.phase = 4;
    } else activate("summary", true);
  }

  function handleBoardAction(event) {
    const port = event.target.closest("[data-switch-port]");
    if (!port) return;
    const number = Number(port.dataset.switchPort);
    if (activeStage === "groups") inspectGroupPort(number);
    else if (activeStage === "access") inspectAccessPort(number);
    else if (activeStage === "frames") toggleFramePort(number);
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
    document.querySelectorAll("[data-vlan-stage-link]").forEach((link) => link.addEventListener("click", (event) => {
      event.preventDefault();
      activate(link.dataset.vlanStageLink, true);
      const lab = document.querySelector("#vlan-shared-lab");
      const bounds = lab?.getBoundingClientRect();
      if (lab && bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight)) {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        lab.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      }
    }));
    document.querySelectorAll("[data-opening-mode]").forEach((button) => button.addEventListener("click", () => runOpening(button.dataset.openingMode, button)));
    document.querySelector("[data-access-change]")?.addEventListener("click", changeAccessVlan);
    document.querySelectorAll("[data-frame-scenario]").forEach((button) => button.addEventListener("click", () => chooseFrameScenario(button.dataset.frameScenario, button)));
    document.querySelector("[data-frame-confirm]")?.addEventListener("click", confirmFramePorts);
    document.querySelector("[data-summary-next]")?.addEventListener("click", advanceSummary);
    activate("why");
  }

  function setupCliProof() {
    const root = document.querySelector("[data-vlan-cli-proof]");
    if (!root) return;
    root.querySelectorAll("[data-cli-vlan]").forEach((button) => button.addEventListener("click", () => {
      if (activeStage !== "summary") activate("summary");
      const current = getBoard();
      const vlan = Number(button.dataset.cliVlan);
      const ports = Object.values(current.state.ports).filter((port) => port.link_status === "up" && port.access_vlan === vlan && port.name !== "Gi0/5");
      boardRoot()?.querySelectorAll(".is-cli-highlight").forEach((item) => item.classList.remove("is-cli-highlight"));
      ports.forEach((port) => {
        const number = port.name.split("/")[1];
        boardRoot()?.querySelector(`[data-switch-port="${number}"]`)?.classList.add("is-cli-highlight");
        const host = port.connected_device?.slice(-1);
        if (host) boardRoot()?.querySelector(`[data-host="${host}"]`)?.classList.add("is-cli-highlight");
      });
      root.querySelectorAll("[data-cli-vlan]").forEach((item) => {
        const selected = item === button;
        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      feedback("[data-summary-feedback]", `VLAN ${vlan} na CLI e no quadro: ${ports.map((port) => `${port.connected_device} em ${port.name}`).join("; ")}.`);
      setText("[data-cli-feedback]", `As portas listadas para a VLAN ${vlan} estão destacadas no mesmo SW1.`);
    }));
  }

  function setupSelfExplanation() {
    const root = document.querySelector("[data-vlan-self-explanation]");
    if (!root) return;
    root.querySelector("[data-vlan-reference-button]")?.addEventListener("click", (event) => {
      root.querySelector("[data-vlan-reference]").hidden = false;
      event.currentTarget.disabled = true;
    });
  }

  function setupAsyncCheckpoint() {
    const container = document.querySelector("#vlan-checkpoint");
    const start = document.querySelector("[data-vlan-checkpoint-start]");
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
        const parsed = new DOMParser().parseFromString(payload.html, "text/html").querySelector("#vlan-checkpoint");
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
  setupCliProof();
  setupSelfExplanation();
  setupAsyncCheckpoint();
})();
