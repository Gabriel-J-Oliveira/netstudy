(function () {
  "use strict";
  const root = document.querySelector("[data-integrated-lab]");
  const simulator = window.NetStudyLabSimulator;
  if (!root || !simulator) return;

  const slots = [...root.querySelectorAll("[data-lab-slot]")];
  const palette = [...root.querySelectorAll("[data-lab-palette]")];
  const links = [...root.querySelectorAll("[data-lab-link]")];
  const inputs = [...root.querySelectorAll("[data-lab-input]")];
  const feedback = root.querySelector("[data-lab-feedback]");
  const status = root.querySelector("[data-lab-status]");
  const state = {devices: {}, links: [], config: {}, tables: {mac: [], arp: []}, result: null, index: -1, selected: null, running: false};
  let dragCandidate = null;
  const defaults = Object.fromEntries(inputs.map(input => [input.dataset.labInput, input.value]));
  const text = (selector, value) => { root.querySelector(selector).textContent = value; };

  function currentConfig() {
    const value = key => root.querySelector(`[data-lab-input="${key}"]`).value.trim();
    return {a: {ip: value("a-ip"), mask: value("a-mask")}, b: {ip: value("b-ip"), mask: value("b-mask")}, sw: {port1: Number(value("port1")), port2: Number(value("port2"))}};
  }
  function clearResult(message) {
    state.result = null;
    state.index = -1;
    state.tables = {mac: [], arp: []};
    status.textContent = message;
    renderEvent();
  }
  function renderTopology(event) {
    slots.forEach(slot => {
      const key = slot.dataset.labSlot;
      const placed = Boolean(state.devices[key]);
      slot.querySelector("[data-slot-name]").textContent = placed ? ({a: "PC-A", sw: "SW1", b: "PC-B"})[key] : "Vazia";
      slot.dataset.placed = String(placed);
      slot.dataset.active = String(event?.focus === key);
      slot.setAttribute("aria-label", `${({a: "PC-A", sw: "SW1", b: "PC-B"})[key]}: ${placed ? "instalado" : "vazio"}. ${slot.dataset.accept === "pc" ? "Aceita PC" : "Aceita switch"}.`);
    });
    links.forEach(link => {
      const key = link.dataset.labLink;
      const connected = state.links.includes(key);
      const button = link.querySelector("[data-lab-connect]");
      button.textContent = connected ? "Desconectar" : "Conectar";
      button.setAttribute("aria-label", `${connected ? "Desconectar" : "Conectar"} ${link.querySelector("span").textContent}`);
      link.dataset.connected = String(connected);
      link.dataset.active = String(event?.link === key);
      link.dataset.frameActive = String(event?.link === key && Boolean(event.frame));
    });
  }
  function renderList(selector, rows, format, empty) {
    const list = root.querySelector(selector);
    list.replaceChildren();
    if (!rows.length) {
      const item = document.createElement("li"); item.textContent = empty; list.append(item); return;
    }
    rows.forEach(row => { const item = document.createElement("li"); item.textContent = format(row); list.append(item); });
  }
  function renderEvent() {
    const event = state.result?.events[state.index] || null;
    renderTopology(event);
    text("[data-lab-position]", event ? `Evento ${state.index + 1} de ${state.result.events.length}` : "Sem evento");
    text("[data-lab-observation]", event?.observation || "Pronto para montar");
    text("[data-lab-explanation]", event?.explanation || "Os eventos serão calculados da configuração atual.");
    text("[data-lab-frame]", event?.frame ? `${event.frame.type} · Source ${event.frame.source} → Destination ${event.frame.destination}` : "—");
    text("[data-lab-packet]", event?.packet ? `${event.packet.source} → ${event.packet.destination}` : "—");
    renderList("[data-lab-mac-table]", event?.tables.mac || [], row => `${row.mac} → ${row.port} · VLAN ${row.vlan}`, "Sem entradas aprendidas.");
    renderList("[data-lab-arp-table]", event?.tables.arp || [], row => `${row.ip} → ${row.mac}`, "Ainda não aprendida.");
    root.querySelector("[data-lab-prev]").disabled = state.index <= 0;
    root.querySelector("[data-lab-next]").disabled = !state.result || state.index >= state.result.events.length - 1;
    const history = root.querySelector("[data-lab-history]");
    history.replaceChildren();
    (state.result?.events || []).slice(0, simulator.LIMITS.history).forEach((entry, index) => {
      const item = document.createElement("li");
      item.textContent = entry.observation;
      if (index === state.index) item.setAttribute("aria-current", "step");
      history.append(item);
    });
    if (event?.outcome) status.textContent = event.observation;
    else if (event && state.result) status.textContent = `Evento ${state.index + 1} de ${state.result.events.length}. Avance no seu ritmo.`;
  }
  function changed(message) {
    if (state.result) clearResult("Configuração alterada. Execute um novo teste para observar o resultado atualizado.");
    feedback.textContent = message;
    renderTopology(null);
  }
  function place(slotKey, type) {
    const expected = slotKey === "sw" ? "switch" : "pc";
    if (type !== expected) { feedback.textContent = `${slotKey === "sw" ? "SW1 aceita um switch" : "PC-A e PC-B aceitam PCs"}. Escolha o equipamento correspondente.`; return; }
    if (!state.devices[slotKey] && Object.keys(state.devices).length >= simulator.LIMITS.devices) { feedback.textContent = "Limite de 3 dispositivos excedido."; return; }
    state.devices[slotKey] = type;
    changed(`${({a: "PC-A", sw: "SW1", b: "PC-B"})[slotKey]} instalado. Conecte as interfaces indicadas.`);
  }
  palette.forEach(button => {
    button.addEventListener("pointerdown", () => { dragCandidate = button.dataset.labPalette; });
    button.addEventListener("click", () => {
      state.selected = button.dataset.labPalette;
      palette.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
      feedback.textContent = `${button.textContent} selecionado. Clique na posição desejada.`;
    });
    button.addEventListener("dragstart", event => {
      state.selected = button.dataset.labPalette;
      event.dataTransfer.setData("text/plain", state.selected);
      event.dataTransfer.effectAllowed = "copy";
    });
  });
  document.addEventListener("pointerup", event => {
    if (!dragCandidate) return;
    const type = dragCandidate;
    dragCandidate = null;
    const slot = event.target.closest("[data-lab-slot]");
    if (slot && root.contains(slot)) place(slot.dataset.labSlot, type);
  });
  document.addEventListener("pointercancel", () => { dragCandidate = null; });
  slots.forEach(slot => {
    slot.addEventListener("click", () => {
      if (!state.selected) { feedback.textContent = "Selecione PC ou Switch Ethernet antes de preencher uma posição."; return; }
      place(slot.dataset.labSlot, state.selected);
    });
    slot.addEventListener("dragover", event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; });
    slot.addEventListener("drop", event => { event.preventDefault(); place(slot.dataset.labSlot, event.dataTransfer.getData("text/plain")); });
  });
  root.querySelectorAll("[data-lab-connect]").forEach(button => button.addEventListener("click", () => {
    const key = button.dataset.labConnect;
    const ends = key === "a-sw" ? ["a", "sw"] : ["sw", "b"];
    if (ends.some(end => !state.devices[end])) { feedback.textContent = "Instale os equipamentos das duas pontas antes de conectar este link."; return; }
    if (state.links.includes(key)) state.links = state.links.filter(link => link !== key);
    else {
      if (state.links.length >= simulator.LIMITS.links) { feedback.textContent = "Limite de 2 links excedido."; return; }
      state.links.push(key);
    }
    changed(`${key === "a-sw" ? "Eth0 ↔ Gi0/1" : "Gi0/2 ↔ Eth0"}: ${state.links.includes(key) ? "conectado" : "desconectado"}.`);
  }));
  inputs.forEach(input => input.addEventListener("change", () => { state.config = currentConfig(); changed("Configuração atualizada. Teste para observar o efeito."); }));
  root.querySelector("[data-lab-test]").addEventListener("click", () => {
    if (state.running) return;
    state.running = true;
    try {
      clearResult("Calculando novo teste…");
      state.config = currentConfig();
      state.result = simulator.simulate({devices: {...state.devices}, links: [...state.links], config: state.config});
      state.tables = state.result.tables;
      if (state.result.status === "invalid") { feedback.textContent = state.result.message; status.textContent = state.result.message; return; }
      state.index = 0;
      renderEvent();
      feedback.textContent = state.result.status === "interrupted" ? state.result.message : "Teste pronto. Use Próximo para percorrer os eventos.";
    } finally { state.running = false; }
  });
  root.querySelector("[data-lab-prev]").addEventListener("click", () => { if (state.index > 0) { state.index -= 1; renderEvent(); } });
  root.querySelector("[data-lab-next]").addEventListener("click", () => { if (state.result && state.index < state.result.events.length - 1) { state.index += 1; renderEvent(); } });
  root.querySelector("[data-lab-reset]").addEventListener("click", () => {
    state.devices = {}; state.links = []; state.selected = null; state.config = {}; state.tables = {mac: [], arp: []};
    palette.forEach(button => button.setAttribute("aria-pressed", "false"));
    inputs.forEach(input => { input.value = defaults[input.dataset.labInput]; });
    clearResult("Bancada reiniciada. Monte a topologia e teste a comunicação.");
    feedback.textContent = "Equipamentos e conexões removidos. Valores de configuração restaurados.";
  });
  renderEvent();
})();
