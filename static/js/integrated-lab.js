(function () {
  "use strict";
  const root = document.querySelector("[data-integrated-lab]");
  const simulator = window.NetStudyLabSimulator;
  const model = window.NetStudyLabModel;
  if (!root || !simulator || !model) return;
  const storageApi = window.NetStudyLabStorage;
  const presets = window.NetStudyLabPresets?.PRESETS || [];
  const exerciseEngine = window.NetStudyLabExerciseEngine;

  const canvas = root.querySelector("[data-lab-canvas]");
  const nodes = root.querySelector("[data-lab-nodes]");
  const wires = root.querySelector("[data-lab-wires]");
  const feedback = root.querySelector("[data-lab-feedback]");
  const status = root.querySelector("[data-lab-status]");
  const catalog = [...root.querySelectorAll("[data-lab-catalog]")];
  const inputs = [...root.querySelectorAll("[data-lab-input]")];
  const allowedInputs = [...root.querySelectorAll("[data-lab-allowed]")];
  const sourceSelect = root.querySelector("[data-lab-source]");
  const destinationSelect = root.querySelector("[data-lab-destination]");
  const scenarioName = root.querySelector("[data-lab-scenario-name]");
  const scenarioList = root.querySelector("[data-lab-scenario-list]");
  const scenarioFeedback = root.querySelector("[data-lab-scenario-feedback]");
  const importFile = root.querySelector("[data-lab-import-file]");
  const presetList = root.querySelector("[data-lab-preset-list]");
  const presetFeedback = root.querySelector("[data-lab-preset-feedback]");
  const exercisePanel = root.querySelector("[data-lab-exercise]");
  const exerciseFeedback = root.querySelector("[data-lab-exercise-feedback]");
  const checkSolution = root.querySelector("[data-lab-check-solution]");
  const state = {bench: model.create(), mode: "idle", targetId: null, pendingInterface: null, activeDevice: null, cursor: {x: .5, y: .5}, result: null, index: -1, running: false, exercise: null};
  let pointerDrag = null;
  let scenarios = null;
  try { scenarios = storageApi.create(window.localStorage); }
  catch (error) { scenarioFeedback.textContent = `Armazenamento local indisponível: ${error.message}`; scenarioFeedback.dataset.error = "true"; }
  const text = (selector, value) => { root.querySelector(selector).textContent = value; };
  const label = id => state.bench.devices[id]?.name || id;

  function invalidate(message) {
    state.result = null;
    state.index = -1;
    status.textContent = message || "Montagem alterada. Teste novamente para observar o novo resultado.";
    renderEvent();
  }
  function announce(message) { feedback.textContent = message; }
  function apply(change, message, invalidateResult = true) {
    if (change.error) { announce(change.error); return false; }
    state.bench = change.state;
    if (invalidateResult) {
      invalidate();
      if (state.exercise) {
        state.exercise.completed = false;
        checkSolution.disabled = false;
        exerciseFeedback.textContent = "Bancada alterada. Teste a comunicação e depois teste sua solução.";
        exerciseFeedback.dataset.state = "";
      }
    }
    renderPair();
    renderBoard();
    renderConfig();
    announce(message);
    return true;
  }
  function card(id) {
    const device = state.bench.devices[id];
    const element = document.createElement("article");
    element.className = `lab-node lab-node-${device.type}`;
    element.dataset.labNode = id;
    element.innerHTML = `<div class="lab-node-top"><span class="lab-node-icon" aria-hidden="true"></span><button type="button" class="lab-drag-handle" data-lab-drag="${id}" draggable="true" aria-label="Mover ${device.name}">Mover</button></div><button type="button" class="lab-node-main" data-lab-open="${id}"><strong>${device.name}</strong><small>${device.type === "pc" ? "PC · Camada 2/3" : device.type === "router" ? "Roteador · Eth0 / Eth1" : "Switch Ethernet"}</small></button><div class="lab-node-interfaces"></div>`;
    const interfaceBox = element.querySelector(".lab-node-interfaces");
    device.interfaces.forEach(interfaceId => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.labInterface = interfaceId;
      button.textContent = state.bench.interfaces[interfaceId].name;
      interfaceBox.append(button);
    });
    return element;
  }
  model.DEVICE_IDS.forEach(id => nodes.append(card(id)));
  const cursor = document.createElement("span");
  cursor.className = "lab-cursor";
  cursor.setAttribute("aria-hidden", "true");
  canvas.append(cursor);

  function canvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const xMargin = Math.min(.46, 85 / rect.width);
    const yMargin = Math.min(.46, 85 / rect.height);
    return {x: Math.max(xMargin, Math.min(1 - xMargin, (clientX - rect.left) / rect.width)), y: Math.max(yMargin, Math.min(1 - yMargin, (clientY - rect.top) / rect.height))};
  }
  function setMode(mode, id = null) {
    state.mode = mode;
    state.targetId = id;
    if (mode !== "connect") state.pendingInterface = null;
    catalog.forEach(button => button.setAttribute("aria-pressed", String(mode === "place" && button.dataset.labCatalog === id)));
    cursor.hidden = !["place", "move"].includes(mode);
    renderBoard();
  }
  function placeAt(point) {
    if (!["place", "move"].includes(state.mode) || !state.targetId) return;
    const id = state.targetId;
    const wasInstalled = Boolean(state.bench.devices[id].position);
    if (apply(model.position(state.bench, id, point.x, point.y), `${label(id)} ${wasInstalled ? "movido" : "instalado"}. Configurações e cabos preservados.`, !wasInstalled)) {
      setMode("idle");
      openConfig(id);
    }
  }
  function openConfig(id) {
    if (!state.bench.devices[id].position) return;
    state.activeDevice = id;
    setMode("idle");
    renderConfig();
    renderBoard();
    announce(`${label(id)} selecionado. Configuração aberta abaixo da bancada.`);
  }
  function selectInterface(id) {
    if (!state.pendingInterface) {
      state.pendingInterface = id;
      state.mode = "connect";
      announce(`${label(state.bench.interfaces[id].deviceId)} ${state.bench.interfaces[id].name} selecionada. Escolha a interface livre da outra ponta.`);
    } else if (state.pendingInterface === id) {
      state.pendingInterface = null;
      state.mode = "idle";
      announce("Seleção de interface cancelada.");
    } else {
      const first = state.pendingInterface;
      if (apply(model.connect(state.bench, first, id), "Cabo conectado às duas interfaces selecionadas.")) {
        state.pendingInterface = null;
        state.mode = "idle";
      }
    }
    renderBoard();
  }
  function renderConfig() {
    const id = state.activeDevice;
    root.querySelector("[data-lab-config-empty]").hidden = Boolean(id);
    root.querySelectorAll("[data-lab-config]").forEach(panel => { panel.hidden = panel.dataset.labConfig !== id; });
    text("[data-lab-config-title]", id ? `${label(id)} · configuração` : "Selecione um equipamento");
    const move = root.querySelector("[data-lab-move]");
    move.hidden = !id;
    const deviceState = root.querySelector("[data-lab-device-state]");
    deviceState.hidden = !id;
    if (id) {
      const device = state.bench.devices[id];
      const used = device.interfaces.filter(interfaceId => state.bench.connections.some(link => [link.a, link.b].includes(interfaceId))).length;
      if (device.type === "switch") {
        const ports = device.interfaces.map(interfaceId => {
          const link = state.bench.connections.find(cable => [cable.a, cable.b].includes(interfaceId));
          const peer = link ? label(state.bench.interfaces[link.a === interfaceId ? link.b : link.a].deviceId) : "livre";
          const setting = state.bench.interfaces[interfaceId].mode === "trunk" ? `trunk · admitidas ${device.config.allowedVlans.join(", ") || "nenhuma"}` : `VLAN ${device.config.vlans[interfaceId]}`;
          return `${state.bench.interfaces[interfaceId].name}: ${setting} · ${peer}`;
        });
        deviceState.textContent = `${used} de ${device.interfaces.length} interfaces conectadas. ${ports.join("; ")}.`;
      } else if (device.type === "router") {
        const details = device.interfaces.map(interfaceId => {
          const link = state.bench.connections.find(cable => [cable.a, cable.b].includes(interfaceId));
          const config = device.config[state.bench.interfaces[interfaceId].name.toLowerCase()];
          const peer = link ? (link.a === interfaceId ? link.b : link.a) : null;
          const vlan = peer && state.bench.devices[state.bench.interfaces[peer].deviceId].config.vlans[peer];
          return `${state.bench.interfaces[interfaceId].name}: ${config.ip} / ${config.mask} · MAC ${config.mac} · ${peer ? `${label(state.bench.interfaces[peer].deviceId)} ${state.bench.interfaces[peer].name}, VLAN ${vlan}` : "sem cabo"}`;
        });
        deviceState.textContent = details.join("; ");
      } else {
        const link = state.bench.connections.find(cable => [cable.a, cable.b].includes(device.interfaces[0]));
        const switchPort = link ? (link.a === device.interfaces[0] ? link.b : link.a) : null;
        const switchId = switchPort && state.bench.interfaces[switchPort].deviceId;
        deviceState.textContent = `Eth0 · MAC ${device.config.mac} · gateway ${device.config.gateway || "não configurado"}. ${switchPort ? `Conectado a ${label(switchId)} ${state.bench.interfaces[switchPort].name}, VLAN ${state.bench.devices[switchId].config.vlans[switchPort]}.` : "Sem cabo conectado."}`;
      }
    }
    renderRouterState();
  }
  function renderRouterState() {
    const router = state.bench.devices.r1;
    const current = state.result?.events[state.index];
    const routes = current?.tables.routes || ["eth0", "eth1"].map(iface => {
      const config = router.config[iface], ip = simulator.ipv4(config.ip), mask = simulator.mask(config.mask);
      return {interfaceId: `r1:${iface}`, prefix: ip && mask ? simulator.prefix(ip, mask) : "IPv4/máscara inválidos", connected: Boolean(state.bench.connections.find(link => [link.a, link.b].includes(`r1:${iface}`)))};
    });
    renderList("[data-lab-router-routes]", routes.filter(row => row.connected), row => `${state.bench.interfaces[row.interfaceId].name}: ${row.prefix} · diretamente conectada`, "Sem rotas conectadas.");
    renderList("[data-lab-router-arp]", (current?.tables.arp || []).filter(row => row.owner === "r1"), row => `${state.bench.interfaces[row.interfaceId].name}: ${row.ip} → ${row.mac}`, "Ainda não aprendidas.");
  }
  function renderPair() {
    const installed = model.PC_IDS.filter(id => state.bench.devices[id].position);
    const oldSource = sourceSelect.value, oldDestination = destinationSelect.value;
    for (const select of [sourceSelect, destinationSelect]) {
      select.replaceChildren();
      const empty = document.createElement("option"); empty.value = ""; empty.textContent = "Escolha um PC";
      select.append(empty);
      installed.forEach(id => { const option = document.createElement("option"); option.value = id; option.textContent = label(id); select.append(option); });
    }
    sourceSelect.value = installed.includes(oldSource) ? oldSource : (installed[0] || "");
    destinationSelect.value = installed.includes(oldDestination) ? oldDestination : (installed.find(id => id !== sourceSelect.value) || "");
    text("[data-lab-arp-title]", "Associações ARP neste evento");
  }
  function scenarioMessage(message, error = false) {
    scenarioFeedback.textContent = message;
    scenarioFeedback.dataset.error = String(error);
  }
  function refreshScenarios(selected = scenarioList.value) {
    if (!scenarios) return;
    try {
      const names = scenarios.list();
      scenarioList.replaceChildren();
      const empty = document.createElement("option");
      empty.value = ""; empty.textContent = names.length ? "Selecione um cenário" : "Nenhum cenário salvo";
      scenarioList.append(empty);
      names.forEach(name => { const option = document.createElement("option"); option.value = name; option.textContent = name; scenarioList.append(option); });
      scenarioList.value = names.includes(selected) ? selected : "";
      root.querySelector("[data-lab-load]").disabled = !scenarioList.value;
      root.querySelector("[data-lab-delete]").disabled = !scenarioList.value;
    } catch (error) { scenarioMessage(error.message, true); }
  }
  function scenarioMetadata(name) {
    const metadata = {};
    if (name) metadata.name = name;
    if (sourceSelect.value && destinationSelect.value && sourceSelect.value !== destinationSelect.value) {
      metadata.sourceId = sourceSelect.value;
      metadata.destinationId = destinationSelect.value;
    }
    return metadata;
  }
  function syncConfigInputs() {
    inputs.forEach(input => {
      const key = input.dataset.labInput;
      input.value = key.startsWith("sw") ? state.bench.devices[key.slice(0, 3)].config.vlans[`${key.slice(0, 3)}:gi0/${key.slice(-1)}`]
        : key.startsWith("r1-") ? state.bench.devices.r1.config[key.split("-")[1]][key.split("-")[2]]
          : state.bench.devices[`pc-${key[0]}`].config[key.slice(2)];
    });
    allowedInputs.forEach(input => {
      const [id, vlan] = input.dataset.labAllowed.split("-");
      input.checked = state.bench.devices[id].config.allowedVlans.includes(Number(vlan));
    });
  }
  function restoreBench(restored, message) {
    presetFeedback.textContent = "";
    state.bench = restored.state;
    state.result = null; state.index = -1; state.activeDevice = null;
    state.cursor = {x: .5, y: .5};
    setMode("idle");
    syncConfigInputs();
    renderPair();
    if (restored.sourceId) sourceSelect.value = restored.sourceId;
    if (restored.destinationId) destinationSelect.value = restored.destinationId;
    renderConfig();
    invalidate("Cenário carregado. Execute um novo teste para gerar eventos e tabelas.");
    announce(message);
  }
  function renderPresets() {
    presetList.replaceChildren();
    presets.forEach(item => {
      const entry = document.createElement("li");
      const name = document.createElement("strong"); name.textContent = item.scenario.name;
      const description = document.createElement("p"); description.textContent = item.description;
      const button = document.createElement("button");
      button.type = "button"; button.dataset.labPreset = item.id;
      button.textContent = "Carregar cenário";
      button.setAttribute("aria-label", `Carregar ${item.scenario.name}`);
      entry.append(name, description, button);
      presetList.append(entry);
    });
  }
  function nextExerciseSeed() {
    const number = window.crypto?.getRandomValues ? window.crypto.getRandomValues(new Uint32Array(1))[0] : Date.now();
    return String(number);
  }
  function startExercise(exerciseId, seed, difficulty) {
    const instance = exerciseEngine.generateExercise(exerciseId, seed, {difficulty});
    const restored = model.importScenario(instance.scenario);
    state.exercise = {instance, completed: false};
    exercisePanel.hidden = false;
    root.querySelector(".lab-presets").hidden = true;
    root.querySelector(".lab-scenarios").hidden = true;
    text("[data-lab-exercise-title]", instance.title);
    text("[data-lab-exercise-meta]", `${difficulty === "advanced" ? "Advanced" : "Intermediate"} · seed ${instance.seed}`);
    text("[data-lab-exercise-prompt]", instance.prompt);
    text("[data-lab-exercise-objective]", instance.objective.text);
    checkSolution.disabled = false;
    root.querySelector("[data-lab-reset]").textContent = "Reiniciar exercício";
    restoreBench(restored, "Exercício iniciado. Investigue o percurso na bancada.");
    exerciseFeedback.dataset.state = "";
    exerciseFeedback.textContent = "Use Testar comunicação para observar o percurso. Ajuste a bancada e depois selecione Testar solução.";
  }
  function renderConnections() {
    const list = root.querySelector("[data-lab-connections]");
    list.replaceChildren();
    if (!state.bench.connections.length) { const li = document.createElement("li"); li.textContent = "Nenhum cabo conectado."; list.append(li); return; }
    state.bench.connections.forEach(link => {
      const li = document.createElement("li");
      const name = id => {
        const iface = state.bench.interfaces[id];
        const detail = iface.mode === "trunk" ? ` · trunk 802.1Q · admitidas ${state.bench.devices[iface.deviceId].config.allowedVlans.join(", ") || "nenhuma"}` : state.bench.devices[iface.deviceId].type === "switch" ? ` · VLAN ${state.bench.devices[iface.deviceId].config.vlans[id]}` : "";
        return `${label(iface.deviceId)} ${iface.name}${detail}`;
      };
      const span = document.createElement("span"); span.textContent = `${name(link.a)} ↔ ${name(link.b)}`;
      const button = document.createElement("button"); button.type = "button"; button.dataset.labDisconnect = link.id; button.textContent = "Desconectar"; button.setAttribute("aria-label", `Desconectar ${span.textContent}`);
      li.append(span, button); list.append(li);
    });
  }
  function drawWires(event) {
    const rect = canvas.getBoundingClientRect();
    wires.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    wires.replaceChildren();
    const targets = model.eventTargets(event);
    for (const link of state.bench.connections) {
      const ends = [link.a, link.b].map(id => nodes.querySelector(`[data-lab-interface="${id}"]`).getBoundingClientRect());
      const [a, b] = ends.map(r => ({x: r.left + r.width / 2 - rect.left, y: r.top + r.height / 2 - rect.top}));
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      for (const [key, value] of Object.entries({x1: a.x, y1: a.y, x2: b.x, y2: b.y})) line.setAttribute(key, value);
      line.setAttribute("class", `lab-wire${link.type === "trunk" ? " is-trunk" : ""}${targets.connectionIds.includes(link.id) ? " is-active" : ""}`);
      wires.append(line);
      if (link.type === "trunk" && !targets.connectionIds.includes(link.id)) {
        const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
        title.setAttribute("x", (a.x + b.x) / 2); title.setAttribute("y", (a.y + b.y) / 2 - 10);
        title.setAttribute("class", "lab-wire-label"); title.textContent = "trunk 802.1Q"; wires.append(title);
      }
      if (targets.connectionIds.includes(link.id) && event?.frame) {
        const badge = document.createElementNS("http://www.w3.org/2000/svg", "text");
        badge.setAttribute("x", (a.x + b.x) / 2); badge.setAttribute("y", (a.y + b.y) / 2 - 10);
        badge.setAttribute("class", `lab-wire-label ${event.frame.kind}`);
        const from = state.bench.devices[event.fromId]?.position;
        const to = state.bench.devices[event.toId]?.position;
        const dx = from && to ? (to.x - from.x) * rect.width : 0;
        const dy = from && to ? (to.y - from.y) * rect.height : 0;
        const direction = !from || !to ? "•" : Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "→" : "←") : (dy >= 0 ? "↓" : "↑");
        badge.textContent = `${direction} ${event.frame.label}`;
        wires.append(badge);
      }
    }
  }
  function renderBoard() {
    const event = state.result?.events[state.index] || null;
    const targets = model.eventTargets(event);
    for (const id of model.DEVICE_IDS) {
      const device = state.bench.devices[id];
      const element = nodes.querySelector(`[data-lab-node="${id}"]`);
      element.hidden = !device.position;
      if (device.position) { element.style.left = `${device.position.x * 100}%`; element.style.top = `${device.position.y * 100}%`; }
      element.dataset.selected = String(state.activeDevice === id);
      element.dataset.active = String(targets.deviceId === id);
      element.dataset.blocked = String(event?.outcome === "failure" && event.focusId === id);
      for (const interfaceId of device.interfaces) {
        const button = element.querySelector(`[data-lab-interface="${interfaceId}"]`);
        const setting = device.type !== "switch" ? "" : state.bench.interfaces[interfaceId].mode === "trunk" ? " · trunk" : ` · VLAN ${device.config.vlans[interfaceId]}`;
        button.textContent = `${state.bench.interfaces[interfaceId].name}${setting}`;
        button.setAttribute("aria-label", `${device.name} ${state.bench.interfaces[interfaceId].name}${setting}: selecionar interface para conectar`);
        button.dataset.pending = String(state.pendingInterface === interfaceId);
        button.dataset.active = String(targets.interfaceIds.includes(interfaceId));
        button.dataset.connected = String(state.bench.connections.some(link => [link.a, link.b].includes(interfaceId)));
      }
    }
    const count = model.DEVICE_IDS.filter(id => state.bench.devices[id].position).length;
    root.querySelector("[data-lab-canvas-hint]").hidden = count > 0;
    cursor.style.left = `${state.cursor.x * 100}%`;
    cursor.style.top = `${state.cursor.y * 100}%`;
    cursor.hidden = !["place", "move"].includes(state.mode);
    renderConnections();
    drawWires(event);
  }
  function renderList(selector, rows, format, empty) {
    const list = root.querySelector(selector); list.replaceChildren();
    if (!rows.length) { const li = document.createElement("li"); li.textContent = empty; list.append(li); return; }
    rows.forEach(row => { const li = document.createElement("li"); li.textContent = format(row); list.append(li); });
  }
  function renderEvent() {
    const event = state.result?.events[state.index] || null;
    text("[data-lab-position]", event ? `Evento ${state.index + 1} de ${state.result.events.length}` : "Sem evento");
    text("[data-lab-observation]", event?.observation || "Pronto para montar");
    text("[data-lab-event-kind]", event?.frame?.label || (event?.outcome === "failure" ? "ENTREGA INTERROMPIDA" : "OBSERVAÇÃO"));
    root.querySelector(".lab-event").dataset.kind = event?.frame?.kind || "none";
    text("[data-lab-explanation]", event?.explanation || "Os eventos serão calculados da configuração atual.");
    const portName = id => id ? `${label(state.bench.interfaces[id].deviceId)} ${state.bench.interfaces[id].name}` : "—";
    text("[data-lab-interfaces]", event ? `${portName(event.incomingInterfaceId)} → ${(event.outgoingInterfaceIds || []).map(portName).join(", ") || "—"}` : "—");
    text("[data-lab-frame]", event?.frame ? `${event.frame.label} · Source ${event.frame.source} → Destination ${event.frame.destination} · ${event.frame.vlanTag ? `802.1Q VLAN ${event.frame.vlanTag}` : "sem tag (access)"}` : "—");
    text("[data-lab-packet]", event?.packet ? `${event.packet.source} → ${event.packet.destination} · TTL ${event.packet.ttl}` : "—");
    renderList("[data-lab-mac-table]", event?.tables.mac || [], row => `${row.switchId.toUpperCase()} · VLAN ${row.vlan} · ${row.mac} → ${row.port}`, "Sem entradas aprendidas.");
    renderList("[data-lab-arp-table]", event?.tables.arp || [], row => `${label(row.owner)} ${row.interfaceId ? state.bench.interfaces[row.interfaceId].name : ""} · ${row.ip} → ${row.mac}`, "Ainda não aprendida.");
    renderRouterState();
    const prior = state.result?.events.slice(0, state.index + 1) || [];
    const incoming = prior.find(item => item.id === "router-receive")?.frame;
    const decision = prior.find(item => item.id === "route-decision")?.routerDecision;
    const outgoing = prior.find(item => item.id === "frame-out")?.frame;
    const inspector = root.querySelector("[data-lab-router-inspector]");
    inspector.hidden = !incoming;
    text("[data-lab-frame-in]", incoming ? `${incoming.source} → ${incoming.destination} · VLAN de entrada` : "Ainda não recebido.");
    text("[data-lab-route-decision]", decision ? `${decision.route} → ${state.bench.interfaces[decision.output].name} · TTL ${decision.ttlBefore} → ${decision.ttlAfter}` : "R1 ainda não escolheu a saída.");
    text("[data-lab-frame-out]", outgoing ? `${outgoing.source} → ${outgoing.destination} · VLAN de saída` : "Ainda não criado.");
    root.querySelector("[data-lab-prev]").disabled = state.index <= 0;
    root.querySelector("[data-lab-next]").disabled = !state.result || state.index >= state.result.events.length - 1;
    const history = root.querySelector("[data-lab-history]"); history.replaceChildren();
    (state.result?.events || []).slice(0, simulator.LIMITS.history).forEach((entry, index) => {
      const li = document.createElement("li"); li.textContent = entry.observation;
      if (index === state.index) li.setAttribute("aria-current", "step");
      history.append(li);
    });
    if (event?.outcome) status.textContent = event.observation;
    else if (event) status.textContent = `Evento ${state.index + 1} de ${state.result.events.length}. Avance no seu ritmo.`;
    renderBoard();
  }

  catalog.forEach(button => {
    button.addEventListener("pointerdown", () => { pointerDrag = button.dataset.labCatalog; });
    button.addEventListener("click", () => {
      const id = button.dataset.labCatalog;
      if (state.bench.devices[id].position) { announce(`${label(id)} já está instalado. Use Mover para reposicioná-lo.`); return; }
      state.cursor = {x: .5, y: .5}; setMode("place", id); canvas.focus();
      announce(`${label(id)} selecionado. Clique na bancada ou use as setas e Enter para posicionar.`);
    });
    button.addEventListener("dragstart", event => { event.dataTransfer.setData("text/plain", button.dataset.labCatalog); event.dataTransfer.effectAllowed = "copy"; });
  });
  canvas.addEventListener("dragover", event => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; });
  canvas.addEventListener("drop", event => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    if (!model.DEVICE_IDS.includes(id)) return;
    setMode("move", id);
    placeAt(canvasPoint(event.clientX, event.clientY));
  });
  canvas.addEventListener("click", event => {
    const interfaceButton = event.target.closest("[data-lab-interface]");
    if (interfaceButton) { selectInterface(interfaceButton.dataset.labInterface); return; }
    const dragButton = event.target.closest("[data-lab-drag]");
    if (dragButton) { const id = dragButton.dataset.labDrag; state.cursor = {...state.bench.devices[id].position}; setMode("move", id); canvas.focus(); announce(`${label(id)} em modo mover. Clique no novo local ou use as setas e Enter.`); return; }
    const openButton = event.target.closest("[data-lab-open]");
    if (openButton) { openConfig(openButton.dataset.labOpen); return; }
    if (state.mode === "place" || state.mode === "move") placeAt(canvasPoint(event.clientX, event.clientY));
  });
  canvas.addEventListener("keydown", event => {
    if (!["place", "move"].includes(state.mode)) return;
    const delta = {ArrowLeft: [-.04, 0], ArrowRight: [.04, 0], ArrowUp: [0, -.06], ArrowDown: [0, .06]}[event.key];
    if (delta) {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      state.cursor = canvasPoint(rect.left + (state.cursor.x + delta[0]) * rect.width, rect.top + (state.cursor.y + delta[1]) * rect.height);
      cursor.style.left = `${state.cursor.x * 100}%`; cursor.style.top = `${state.cursor.y * 100}%`;
      announce(`Posição preparada para ${label(state.targetId)}. Pressione Enter para confirmar.`);
    } else if (event.key === "Enter") { event.preventDefault(); placeAt(state.cursor); }
    else if (event.key === "Escape") { event.preventDefault(); setMode("idle"); announce("Movimento cancelado."); }
  });
  canvas.addEventListener("dragstart", event => {
    const handle = event.target.closest("[data-lab-drag]");
    if (!handle) return;
    event.dataTransfer.setData("text/plain", handle.dataset.labDrag);
    event.dataTransfer.effectAllowed = "move";
  });
  canvas.addEventListener("pointerdown", event => {
    const handle = event.target.closest("[data-lab-drag]");
    pointerDrag = handle ? handle.dataset.labDrag : null;
  });
  document.addEventListener("pointerup", event => {
    if (!pointerDrag) return;
    const id = pointerDrag; pointerDrag = null;
    if (!canvas.contains(event.target) || event.target.closest("[data-lab-drag]")) return;
    setMode(state.bench.devices[id].position ? "move" : "place", id);
    placeAt(canvasPoint(event.clientX, event.clientY));
  });
  document.addEventListener("pointercancel", () => { pointerDrag = null; });
  root.querySelector("[data-lab-connections]").addEventListener("click", event => {
    const button = event.target.closest("[data-lab-disconnect]");
    if (!button) return;
    apply(model.disconnect(state.bench, button.dataset.labDisconnect), "Cabo desconectado. Execute um novo teste para atualizar o percurso.");
  });
  root.querySelector("[data-lab-move]").addEventListener("click", () => {
    const id = state.activeDevice;
    if (!id) return;
    state.cursor = {...state.bench.devices[id].position}; setMode("move", id); canvas.focus();
    announce(`${label(id)} em modo mover. Clique no novo local ou use as setas e Enter.`);
  });
  inputs.forEach(input => input.addEventListener(input.tagName === "SELECT" ? "change" : "input", () => {
    const key = input.dataset.labInput;
    const id = key.startsWith("sw") ? key.slice(0, 3) : key.startsWith("r1-") ? "r1" : `pc-${key[0]}`;
    const values = id.startsWith("sw") ? {vlans: {[`${id}:gi0/${key.slice(-1)}`]: Number(input.value)}} : id === "r1" ? {[key.split("-")[1]]: {[key.split("-")[2]]: input.value.trim()}} : {[key.slice(2)]: input.value.trim()};
    apply(model.configure(state.bench, id, values), `${label(id)} atualizado. Teste novamente para observar o efeito.`);
  }));
  allowedInputs.forEach(input => input.addEventListener("change", () => {
    const id = input.dataset.labAllowed.slice(0, 3);
    const allowedVlans = allowedInputs.filter(item => item.dataset.labAllowed.startsWith(`${id}-`) && item.checked).map(item => Number(item.dataset.labAllowed.slice(-2)));
    apply(model.configure(state.bench, id, {allowedVlans}), `${label(id)}: trunk admite ${allowedVlans.join(", ") || "nenhuma VLAN"}. Teste novamente.`);
  }));
  [sourceSelect, destinationSelect].forEach(select => select.addEventListener("change", () => {
    invalidate("Par de PCs alterado. Execute um novo teste.");
    text("[data-lab-arp-title]", "Associações ARP neste evento");
    announce("Origem ou destino alterado. Execute um novo teste.");
  }));
  root.querySelector("[data-lab-test]").addEventListener("click", () => {
    if (state.running) return;
    state.running = true;
    try {
      invalidate("Calculando novo teste…");
      const adapted = model.adapt(state.bench, sourceSelect.value, destinationSelect.value);
      if (adapted.error) { status.textContent = adapted.error; announce(adapted.error); return; }
      state.result = simulator.simulate(adapted.input);
      if (state.result.status === "invalid") { status.textContent = state.result.message; announce(state.result.message); return; }
      state.index = 0; renderEvent();
      announce(state.result.status === "interrupted" ? state.result.message : "Teste pronto. Use Próximo para acompanhar cada evento.");
    } finally { state.running = false; }
  });
  root.querySelector("[data-lab-prev]").addEventListener("click", () => { if (state.index > 0) { state.index--; renderEvent(); } });
  root.querySelector("[data-lab-next]").addEventListener("click", () => { if (state.result && state.index < state.result.events.length - 1) { state.index++; renderEvent(); } });
  presetList.addEventListener("click", event => {
    const button = event.target.closest("[data-lab-preset]");
    if (!button) return;
    const item = presets.find(preset => preset.id === button.dataset.labPreset);
    if (!item) return;
    try {
      const restored = model.importScenario(item.scenario);
      restoreBench(restored, `Cenário oficial “${restored.name}” carregado.`);
      scenarioName.value = `Cópia de ${restored.name}`;
      scenarioList.value = "";
      refreshScenarios("");
      presetFeedback.textContent = `“${restored.name}” carregado. Você pode editar a bancada e salvar uma cópia pessoal.`;
      presetFeedback.dataset.error = "false";
      scenarioMessage("Cenário oficial carregado; nenhuma cópia pessoal foi salva.");
    } catch (error) {
      presetFeedback.textContent = `Não foi possível carregar: ${error.message}`;
      presetFeedback.dataset.error = "true";
    }
  });
  scenarioList.addEventListener("change", () => {
    if (scenarioList.value) scenarioName.value = scenarioList.value;
    refreshScenarios();
  });
  function saveScenario(asNew) {
    if (!scenarios) { scenarioMessage("Armazenamento local indisponível.", true); return; }
    const name = scenarioName.value.trim();
    if (!name) { scenarioMessage("Informe um nome para salvar o cenário.", true); scenarioName.focus(); return; }
    try {
      const existing = scenarios.list().find(item => item.toLocaleLowerCase() === name.toLocaleLowerCase());
      if (existing && asNew) { scenarioMessage(`Já existe “${existing}”. Escolha outro nome para salvar como novo.`, true); return; }
      if (existing && !window.confirm(`Substituir o cenário salvo “${existing}” pela configuração atual?`)) {
        scenarioMessage("Substituição cancelada."); return;
      }
      const saved = scenarios.save(state.bench, scenarioMetadata(name), Boolean(existing));
      scenarioName.value = saved.name;
      refreshScenarios(saved.name);
      scenarioMessage(saved.overwritten ? `Cenário “${saved.name}” atualizado.` : `Cenário “${saved.name}” salvo neste navegador.`);
    } catch (error) { scenarioMessage(`Não foi possível salvar: ${error.message}`, true); }
  }
  root.querySelector("[data-lab-save]").addEventListener("click", () => saveScenario(false));
  root.querySelector("[data-lab-save-as]").addEventListener("click", () => saveScenario(true));
  root.querySelector("[data-lab-load]").addEventListener("click", () => {
    if (!scenarios || !scenarioList.value) return;
    try {
      const restored = scenarios.load(scenarioList.value);
      restoreBench(restored, `Cenário “${restored.name}” carregado.`);
      scenarioName.value = restored.name;
      scenarioMessage(`Cenário “${restored.name}” carregado. O teste anterior foi limpo.`);
    } catch (error) { scenarioMessage(`Não foi possível carregar: ${error.message}`, true); }
  });
  root.querySelector("[data-lab-delete]").addEventListener("click", () => {
    if (!scenarios || !scenarioList.value) return;
    const name = scenarioList.value;
    if (!window.confirm(`Excluir somente o cenário salvo “${name}”? A bancada atual continuará aberta.`)) {
      scenarioMessage("Exclusão cancelada."); return;
    }
    try {
      scenarios.remove(name);
      refreshScenarios("");
      scenarioMessage(`Cenário “${name}” excluído. A bancada atual foi mantida.`);
    } catch (error) { scenarioMessage(`Não foi possível excluir: ${error.message}`, true); }
  });
  root.querySelector("[data-lab-import-button]").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    try {
      if (!file.name.toLowerCase().endsWith(".json")) throw new TypeError("Selecione um arquivo .json.");
      const restored = scenarios.importJson(await file.text());
      restoreBench(restored, `Cenário importado de “${file.name}”.`);
      scenarioName.value = restored.name || "";
      scenarioList.value = ""; refreshScenarios("");
      scenarioMessage(`Cenário importado de “${file.name}”. Use Salvar para guardá-lo neste navegador.`);
    } catch (error) { scenarioMessage(`Importação recusada: ${error.message}`, true); }
    finally { importFile.value = ""; }
  });
  root.querySelector("[data-lab-export]").addEventListener("click", () => {
    try {
      const {json, filename} = scenarios.exportJson(state.bench, scenarioMetadata(scenarioName.value.trim()));
      const url = URL.createObjectURL(new Blob([json], {type: "application/json"}));
      const link = document.createElement("a");
      link.href = url; link.download = filename; link.hidden = true;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      scenarioMessage(`Cenário exportado para “${filename}”.`);
    } catch (error) { scenarioMessage(`Não foi possível exportar: ${error.message}`, true); }
  });
  checkSolution.addEventListener("click", () => {
    if (!state.exercise || state.running) return;
    state.running = true;
    try {
      const verdict = exerciseEngine.validateExercise(state.exercise.instance, state.bench);
      state.result = verdict.result;
      state.index = verdict.result.events.length ? verdict.result.events.length - 1 : -1;
      renderEvent();
      if (state.index < 0) status.textContent = verdict.feedback;
      state.exercise.completed = verdict.complete;
      checkSolution.disabled = verdict.complete;
      exerciseFeedback.dataset.state = verdict.complete ? "success" : "error";
      exerciseFeedback.textContent = verdict.complete
        ? `${verdict.feedback} Exercício concluído. Você pode gerar outro exercício.` : verdict.feedback;
    } catch (error) {
      exerciseFeedback.dataset.state = "error";
      exerciseFeedback.textContent = `Não foi possível validar a bancada: ${error.message}`;
    } finally { state.running = false; }
  });
  root.querySelector("[data-lab-new-exercise]").addEventListener("click", () => {
    if (!state.exercise) return;
    const {exerciseId, difficulty, seed} = state.exercise.instance;
    let fresh = nextExerciseSeed();
    if (fresh === seed) fresh = String(Number(fresh) + 1);
    const url = new URL(window.location.href);
    url.searchParams.set("seed", fresh);
    window.history.replaceState(null, "", url);
    try { startExercise(exerciseId, fresh, difficulty); }
    catch (error) { exerciseFeedback.dataset.state = "error"; exerciseFeedback.textContent = error.message; }
  });
  root.querySelector("[data-lab-reset]").addEventListener("click", () => {
    if (state.exercise) {
      const {exerciseId, seed, difficulty} = state.exercise.instance;
      startExercise(exerciseId, seed, difficulty);
      exerciseFeedback.textContent = "Exercício reiniciado com a mesma seed. Investigue novamente.";
      return;
    }
    presetFeedback.textContent = "";
    state.bench = model.create(); state.result = null; state.index = -1;
    state.activeDevice = null; state.cursor = {x: .5, y: .5}; setMode("idle");
    syncConfigInputs(); scenarioName.value = ""; scenarioList.value = ""; refreshScenarios("");
    renderPair(); invalidate("Bancada reiniciada. Monte e conecte os equipamentos."); renderConfig(); announce("Bancada reiniciada.");
    scenarioMessage("Nova bancada. Cenários salvos permanecem disponíveis.");
  });
  window.addEventListener("resize", () => drawWires(state.result?.events[state.index] || null));
  renderPresets(); renderPair(); renderConfig(); renderEvent(); refreshScenarios("");
  const parameters = new URLSearchParams(window.location.search);
  if (parameters.has("exercise")) {
    try {
      const seed = parameters.get("seed") || nextExerciseSeed();
      if (!parameters.has("seed")) {
        const url = new URL(window.location.href);
        url.searchParams.set("seed", seed);
        window.history.replaceState(null, "", url);
      }
      startExercise(parameters.get("exercise"), seed, parameters.get("difficulty") || "intermediate");
    } catch (error) {
      exercisePanel.hidden = false;
      exerciseFeedback.dataset.state = "error";
      exerciseFeedback.textContent = `Exercício indisponível: ${error.message}`;
    }
  }
})();
