(function () {
  "use strict";
  const root = document.querySelector("[data-integrated-lab]");
  const simulator = window.NetStudyLabSimulator;
  const model = window.NetStudyLabModel;
  if (!root || !simulator || !model) return;

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
  const state = {bench: model.create(), mode: "idle", targetId: null, pendingInterface: null, activeDevice: null, cursor: {x: .5, y: .5}, result: null, index: -1, running: false};
  let pointerDrag = null;
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
    if (invalidateResult) invalidate();
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
    element.innerHTML = `<div class="lab-node-top"><span class="lab-node-icon" aria-hidden="true"></span><button type="button" class="lab-drag-handle" data-lab-drag="${id}" draggable="true" aria-label="Mover ${device.name}">Mover</button></div><button type="button" class="lab-node-main" data-lab-open="${id}"><strong>${device.name}</strong><small>${device.type === "pc" ? "PC · Camada 2/3" : "Switch Ethernet"}</small></button><div class="lab-node-interfaces"></div>`;
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
      } else {
        const link = state.bench.connections.find(cable => [cable.a, cable.b].includes(device.interfaces[0]));
        const switchPort = link ? (link.a === device.interfaces[0] ? link.b : link.a) : null;
        const switchId = switchPort && state.bench.interfaces[switchPort].deviceId;
        deviceState.textContent = `Eth0 · MAC ${device.config.mac}. ${switchPort ? `Conectado a ${label(switchId)} ${state.bench.interfaces[switchPort].name}, VLAN ${state.bench.devices[switchId].config.vlans[switchPort]}.` : "Sem cabo conectado."}`;
      }
    }
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
    text("[data-lab-arp-title]", `Associação ARP de ${sourceSelect.value ? label(sourceSelect.value) : "origem"}`);
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
      element.dataset.blocked = String((event?.id === "arp-unanswered" || event?.id === "trunk-blocked") && event.focusId === id);
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
    text("[data-lab-packet]", event?.packet ? `${event.packet.source} → ${event.packet.destination}` : "—");
    renderList("[data-lab-mac-table]", event?.tables.mac || [], row => `${row.switchId.toUpperCase()} · VLAN ${row.vlan} · ${row.mac} → ${row.port}`, "Sem entradas aprendidas.");
    renderList("[data-lab-arp-table]", event?.tables.arp || [], row => `${row.ip} → ${row.mac}`, "Ainda não aprendida.");
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
    const id = key.startsWith("sw") ? key.slice(0, 3) : `pc-${key[0]}`;
    const values = id.startsWith("sw")
      ? {vlans: {[`${id}:gi0/${key.slice(-1)}`]: Number(input.value)}}
      : {[key.slice(2)]: input.value.trim()};
    apply(model.configure(state.bench, id, values), `${label(id)} atualizado. Teste novamente para observar o efeito.`);
  }));
  allowedInputs.forEach(input => input.addEventListener("change", () => {
    const id = input.dataset.labAllowed.slice(0, 3);
    const allowedVlans = allowedInputs.filter(item => item.dataset.labAllowed.startsWith(`${id}-`) && item.checked).map(item => Number(item.dataset.labAllowed.slice(-2)));
    apply(model.configure(state.bench, id, {allowedVlans}), `${label(id)}: trunk admite ${allowedVlans.join(", ") || "nenhuma VLAN"}. Teste novamente.`);
  }));
  [sourceSelect, destinationSelect].forEach(select => select.addEventListener("change", () => {
    invalidate("Par de PCs alterado. Execute um novo teste.");
    text("[data-lab-arp-title]", `Associação ARP de ${sourceSelect.value ? label(sourceSelect.value) : "origem"}`);
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
  root.querySelector("[data-lab-reset]").addEventListener("click", () => {
    state.bench = model.create(); state.activeDevice = null; state.cursor = {x: .5, y: .5}; setMode("idle");
    inputs.forEach(input => {
      const key = input.dataset.labInput;
      input.value = key.startsWith("sw") ? "10" : state.bench.devices[`pc-${key[0]}`].config[key.slice(2)];
    });
    allowedInputs.forEach(input => { input.checked = true; });
    renderPair(); invalidate("Bancada reiniciada. Monte e conecte os equipamentos."); renderConfig(); announce("Bancada reiniciada.");
  });
  window.addEventListener("resize", () => drawWires(state.result?.events[state.index] || null));
  renderPair(); renderConfig(); renderEvent();
})();
