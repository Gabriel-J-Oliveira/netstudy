(function () {
  "use strict";
  const root = document.querySelector("[data-integrated-lab]");
  const simulator = window.NetStudyLabSimulator;
  const model = window.NetStudyLabModel;
  const profiles = window.NetStudyLabProfiles;
  const terminalEngine = window.NetStudyLabTerminal;
  const servicesEngine = window.NetStudyLabServices;
  if (!root || !simulator || !model) return;
  const storageApi = window.NetStudyLabStorage;
  const attemptsApi = window.NetStudyLabAttempts;
  const presets = window.NetStudyLabPresets?.PRESETS || [];
  const exerciseEngine = window.NetStudyLabExerciseEngine;

  const canvas = root.querySelector("[data-lab-canvas]");
  const world = root.querySelector("[data-lab-world]");
  const nodes = root.querySelector("[data-lab-nodes]");
  const wires = root.querySelector("[data-lab-wires]");
  const feedback = root.querySelector("[data-lab-feedback]");
  const status = root.querySelector("[data-lab-status]");
  const catalog = [...root.querySelectorAll("[data-lab-catalog]")];
  const popover = root.querySelector("[data-lab-popover]");
  const popoverContent = root.querySelector("[data-lab-popover-content]");
  const deviceTabs = [...root.querySelectorAll("[data-lab-device-tab]")];
  const terminalPanel = root.querySelector("[data-lab-terminal-panel]");
  const terminalInput = root.querySelector("[data-lab-terminal-input]");
  const terminalFeedback = root.querySelector("[data-lab-terminal-feedback]");
  const terminalSessions = new Map(), terminalDrafts = new Map(), deviceTabState = new Map(), servicePanelOpen = new Map();
  let terminalRenderedDevice = null;
  function resetTerminals() { terminalSessions.clear(); terminalDrafts.clear(); deviceTabState.clear(); terminalRenderedDevice = null; }
  function renderTerminal(id) {
    const device = state.bench.devices[id];
    if (!terminalSessions.has(id)) terminalSessions.set(id, terminalEngine.createSession(device));
    const synced = terminalEngine.syncSession(terminalSessions.get(id), state.bench);
    const session = synced.session; terminalSessions.set(id, session);
    text("[data-lab-terminal-prompt]", session.prompt);
      text("[data-lab-terminal-note]", device.profile === "cisco-ios" ? "Cisco IOS-like · consultas e configuração sincronizadas com a bancada. Use ? para ver os comandos do modo atual." : device.profile === "dell-os10" ? "Dell OS10-like · use ? para ver os comandos. Configuração de portas e VLANs sincronizada com a bancada; sem SVI nesta etapa." : device.profile === "mikrotik-routeros" ? "RouterOS-like · use help para ver os menus. Endereços, interfaces e rotas estáticas alteram a bancada." : device.profile === "windows" ? "Host Windows · use ipconfig /renew, nslookup, curl e connect para investigar serviços." : device.profile === "linux" ? "Host Linux · use dhclient, dig, curl e connect para investigar serviços." : "Terminal genérico v1. Use help para consultar os comandos disponíveis.");
    const output = root.querySelector("[data-lab-terminal-output]");
    output.textContent = session.output.map(row => row.text).join("\n"); output.scrollTop = output.scrollHeight;
    if (terminalRenderedDevice !== id) { terminalInput.value = terminalDrafts.get(id) || ""; terminalFeedback.textContent = ""; }
    terminalRenderedDevice = id;
    terminalInput.disabled = session.closed;
    root.querySelector("[data-lab-terminal-form] button").disabled = session.closed;
    root.querySelector("[data-lab-terminal-restart]").hidden = !session.closed;
  }
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
  const state = {bench: model.createEmpty(), mode: "idle", targetId: null, pendingInterface: null, activeDevice: null, hoveredDevice: null, cursor: {x: .5, y: .5}, result: null, index: -1, running: false, exercise: null, attempt: null};
  let pointerDrag = null, dragFrame = 0, suppressClick = false;
  const viewport = {scale: 1, x: 0, y: 0};
  const zoomLimits = Object.freeze({min: .85, max: 1.6});
  let pointerPan = null;
  let scenarios = null;
  try { scenarios = storageApi.create(window.localStorage); }
  catch (error) { scenarioFeedback.textContent = `Armazenamento local indisponível: ${error.message}`; scenarioFeedback.dataset.error = "true"; }
  let attempts = null, attemptDirty = false;
  try { attempts = attemptsApi.create(window.localStorage); attempts.list(); }
  catch (error) { root.querySelector("[data-lab-attempt-state]").textContent = `Continuidade indisponível: ${error.message}`; }
  const text = (selector, value) => { root.querySelector(selector).textContent = value; };
  function attemptMessage(message, error = false) {
    const element = root.querySelector("[data-lab-attempt-state]");
    element.textContent = message; element.dataset.error = String(error);
  }
  function renderExercisePresentation(initial = false, completionChanged = false) {
    if (!state.exercise) return;
    root.dataset.labContext = "guided";
    root.dataset.labCompleted = String(state.exercise.completed);
    const brief = root.querySelector("[data-lab-exercise-brief]");
    if (initial || completionChanged) brief.open = !state.exercise.completed;
    if (initial) {
      root.querySelector("[data-lab-exercise-more]").open = false;
      root.querySelector("[data-lab-evidence]").open = false;
    }
    const navigation = document.querySelector('.topic-navigation[aria-label="Navegação principal"]');
    const practicePath = new URL(root.querySelector("[data-lab-return-practice]").href).pathname;
    navigation?.querySelectorAll("a").forEach(link => {
      if (new URL(link.href).pathname === practicePath) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }
  function snapshotProgress() {
    const progress = structuredClone(state.attempt.progress);
    if (state.exercise.instance.mode === "operational")
      progress.commands = exerciseEngine.attemptAnalysis(state.exercise.instance).commands.slice(-100);
    progress.terminals = {};
    for (const [id, session] of terminalSessions) {
      if (!state.bench.devices[id]) continue;
      const synced = terminalEngine.syncSession(session, state.bench).session;
      progress.terminals[id] = {...synced, history: synced.history.slice(-50),
        historyIndex: Math.min(synced.historyIndex, 50),
        output: synced.output.slice(-40).map(row => ({kind: row.kind, text: row.text.slice(0, 2000)}))};
    }
    return progress;
  }
  function persistAttempt() {
    if (!state.attempt || !attempts) return true;
    try {
      const metadata = {name: state.exercise.instance.scenario.name};
      if (sourceSelect.value && destinationSelect.value && sourceSelect.value !== destinationSelect.value &&
          state.bench.devices[sourceSelect.value]?.position && state.bench.devices[destinationSelect.value]?.position) {
        metadata.sourceId = sourceSelect.value; metadata.destinationId = destinationSelect.value;
      }
      const current = model.exportScenario(state.bench, metadata);
      state.attempt = attempts.update(state.attempt.attemptId, current, {progress: snapshotProgress()});
      if (state.exercise.completed && state.attempt.status !== "completed") {
        state.exercise.completed = false; checkSolution.disabled = false;
        exerciseFeedback.dataset.state = "";
        exerciseFeedback.textContent = "Bancada alterada após a conclusão. Teste a solução novamente.";
        renderExercisePresentation(false, true);
      }
      attemptDirty = false;
      attemptMessage(state.attempt.status === "completed" ? "Tentativa concluída e salva neste navegador." : "Tentativa salva automaticamente neste navegador.");
      return true;
    } catch (error) {
      attemptDirty = true;
      attemptMessage(`Alterações ainda não salvas: ${error.message} Não feche esta página antes de liberar o armazenamento.`, true);
      return false;
    }
  }
  window.addEventListener("beforeunload", event => { if (attemptDirty) { event.preventDefault(); event.returnValue = ""; } });
  const label = id => state.bench.devices[id]?.name || id;
  const interfaceName = id => model.interfaceName(state.bench, id);
  function eventText(message, event) {
    if (!message || !event) return message;
    for (const device of Object.values(state.bench.devices)) for (const id of device.interfaces) {
      const canonical = state.bench.interfaces[id].name;
      message = message.replaceAll(`${device.name} ${canonical}`, `${device.name} ${interfaceName(id)}`);
    }
    const focused = state.bench.devices[event.focusId];
    if (focused) for (const id of focused.interfaces) message = message.replaceAll(state.bench.interfaces[id].name, interfaceName(id));
    return message;
  }
  function profileOptions(select, type, selected = "generic") {
    select.replaceChildren();
    for (const item of profiles.list(type)) {
      const option = document.createElement("option"); option.value = item.id; option.textContent = item.label;
      option.selected = item.id === selected; select.append(option);
    }
  }
  root.querySelectorAll("[data-lab-catalog-profile]").forEach(select => profileOptions(select, select.dataset.labCatalogProfile));

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
        const wasCompleted = state.exercise.completed;
        state.exercise.completed = false;
        checkSolution.disabled = false;
        exerciseFeedback.textContent = "Bancada alterada. Teste a comunicação e depois teste sua solução.";
        exerciseFeedback.dataset.state = "";
        if (state.attempt) { state.attempt.progress.lastRun = null; state.attempt.progress.stepId = null; }
        if (wasCompleted) renderExercisePresentation(false, true);
      }
    }
    renderPair();
    renderBoard();
    renderConfig();
    announce(message);
    persistAttempt();
    return true;
  }
  function card(id) {
    const device = state.bench.devices[id];
    const element = document.createElement("article");
    element.className = `lab-node lab-node-${device.type}`;
    element.dataset.labNode = id;
    element.innerHTML = '<div class="lab-node-top"><span class="lab-node-icon" aria-hidden="true"></span><button type="button" class="lab-drag-handle">Mover</button></div><button type="button" class="lab-node-main"><strong></strong><small></small></button><div class="lab-node-interfaces"></div>';
    element.querySelector(".lab-drag-handle").dataset.labDrag = id;
    element.querySelector(".lab-drag-handle").setAttribute("aria-label", `Mover ${device.name} com teclado`);
    element.querySelector(".lab-node-main").dataset.labOpen = id;
    element.querySelector(".lab-node-main strong").textContent = device.name;
    element.querySelector(".lab-node-main small").textContent = profiles.get(device.type, device.profile).displayType;
    const interfaceBox = element.querySelector(".lab-node-interfaces");
    device.interfaces.forEach(interfaceId => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.labInterface = interfaceId;
      const setting = device.config.portSettings?.[interfaceId] || {};
      button.textContent = `${interfaceName(interfaceId)}${setting.shutdown ? " · desligada" : ""}`;
      button.title = setting.description || "";
      interfaceBox.append(button);
    });
    return element;
  }
  function syncCards() {
    [...nodes.querySelectorAll("[data-lab-node]")].forEach(element => { if (!state.bench.devices[element.dataset.labNode]) element.remove(); });
    Object.keys(state.bench.devices).forEach(id => { if (![...nodes.children].some(element => element.dataset.labNode === id)) nodes.append(card(id)); });
  }
  const cursor = document.createElement("span");
  cursor.className = "lab-cursor";
  cursor.setAttribute("aria-hidden", "true");
  world.append(cursor);

  function worldPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {x: (clientX - rect.left - canvas.clientLeft - viewport.x) / viewport.scale,
      y: (clientY - rect.top - canvas.clientTop - viewport.y) / viewport.scale};
  }
  function setViewport() {
    world.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`;
    canvas.style.backgroundSize = `${24 * viewport.scale}px ${24 * viewport.scale}px`;
    canvas.style.backgroundPosition = `${viewport.x}px ${viewport.y}px`;
    positionPopover();
  }
  function zoomAt(nextScale, clientX, clientY) {
    const scale = Math.max(zoomLimits.min, Math.min(zoomLimits.max, nextScale));
    if (scale === viewport.scale) return;
    const point = worldPoint(clientX, clientY);
    const rect = canvas.getBoundingClientRect();
    viewport.scale = scale;
    viewport.x = clientX - rect.left - canvas.clientLeft - point.x * scale;
    viewport.y = clientY - rect.top - canvas.clientTop - point.y * scale;
    setViewport();
  }
  function canvasPoint(clientX, clientY) {
    const point = worldPoint(clientX, clientY);
    const xMargin = Math.min(.46, 100 / canvas.clientWidth);
    const yMargin = Math.min(.46, 85 / canvas.clientHeight);
    return {x: Math.max(xMargin, Math.min(1 - xMargin, point.x / canvas.clientWidth)),
      y: Math.max(yMargin, Math.min(1 - yMargin, point.y / canvas.clientHeight))};
  }
  function setMode(mode, id = null) {
    state.mode = mode;
    state.targetId = id;
    if (mode !== "connect") state.pendingInterface = null;
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
    state.hoveredDevice = null;
    if (state.exercise?.instance.mode === "operational" && !deviceTabState.has(id)) deviceTabState.set(id, "terminal");
    setMode("idle");
    renderConfig();
    renderBoard();
    announce(`${label(id)} selecionado. Detalhes abertos junto ao equipamento.`);
  }
  function selectInterface(id) {
    const existing = state.bench.connections.find(link => link.a === id || link.b === id);
    if (existing) {
      const other = existing.a === id ? existing.b : existing.a;
      const local = `${label(state.bench.interfaces[id].deviceId)} ${interfaceName(id)}`;
      const remote = `${label(state.bench.interfaces[other].deviceId)} ${interfaceName(other)}`;
      state.pendingInterface = null; state.mode = "idle";
      apply(model.disconnect(state.bench, existing.id), `${local} desconectada de ${remote}.`);
      return;
    }
    if (!state.pendingInterface) {
      state.pendingInterface = id;
      state.mode = "connect";
      announce(`${label(state.bench.interfaces[id].deviceId)} ${interfaceName(id)} selecionada. Escolha a interface livre da outra ponta.`);
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
  function peerOf(interfaceId) {
    const link = state.bench.connections.find(cable => cable.a === interfaceId || cable.b === interfaceId);
    return link ? (link.a === interfaceId ? link.b : link.a) : null;
  }
  function peerLabel(interfaceId) {
    const peer = peerOf(interfaceId);
    return peer ? `${label(state.bench.interfaces[peer].deviceId)} ${interfaceName(peer)}` : "sem cabo";
  }
  function details(id) {
    const device = state.bench.devices[id];
    if (!device) return [];
    const rows = [];
    if (device.type === "pc") rows.push(`IPv4 ${device.config.ip || "não atribuído"} / ${device.config.mask || "sem máscara"}`, `Gateway ${device.config.gateway || "não configurado"}`, `DNS ${device.config.dns || "não configurado"}`, `DHCP cliente ${device.config.dhcpClient ? "ativo" : "inativo"}`, `Serviços: ${device.config.services?.length || 0}`, `MAC ${device.config.mac}`, `${interfaceName(device.interfaces[0])}: ${device.config.portSettings?.[device.interfaces[0]]?.shutdown ? "administrativamente desligada" : "administrativamente ativa"}`);
    if (device.type === "switch") rows.push(...device.interfaces.map(interfaceId => `${interfaceName(interfaceId)}: ${state.bench.interfaces[interfaceId].mode === "trunk" ? `trunk · Allowed VLANs ${device.config.allowedVlans.join(", ") || "nenhuma"}` : `Access VLAN ${device.config.vlans[interfaceId]}`}${device.config.portSettings?.[interfaceId]?.shutdown ? " · administrativamente desligada" : ""}${device.config.portSettings?.[interfaceId]?.description ? ` · ${device.config.portSettings[interfaceId].description}` : ""} · ${peerOf(interfaceId) ? peerLabel(interfaceId) : "livre"}`));
    if (device.type === "router") rows.push(...["eth0", "eth1"].map(iface => { const port=`${id}:${iface}`,setting=device.config.portSettings?.[port]||{}; return `${interfaceName(port)}: ${device.config[iface].ip||"sem IPv4"} / ${device.config[iface].mask||"sem máscara"} · MAC ${device.config[iface].mac}${setting.shutdown?" · administrativamente desligada":""}${setting.description?` · ${setting.description}`:""}`; }));
    if (device.type !== "switch") rows.push(...device.interfaces.map(interfaceId => `${interfaceName(interfaceId)} ↔ ${peerLabel(interfaceId)}`));
    return rows;
  }
  function field(container, id, key, value, labelText, type = "text") {
    const labelElement = document.createElement("label"); labelElement.textContent = labelText;
    const input = document.createElement(type === "select" ? "select" : "input");
    input.dataset.deviceId = id; input.dataset.configKey = key;
    if (type === "select") [...new Set([10, 20, Number(value)])].sort((a,b)=>a-b).forEach(vlan => { const option = document.createElement("option"); option.value = String(vlan); option.textContent = `VLAN ${vlan}`; input.append(option); });
    input.value = String(value); labelElement.append(input); container.append(labelElement);
  }
  function defaultDhcp(device) {
    const ip=simulator.ipv4(device.config.ip)||[192,168,10,1],mask=simulator.mask(device.config.mask)||[255,255,255,0];
    const address=ip.reduce((value,byte)=>(value*256+byte)>>>0,0),bits=mask.reduce((value,byte)=>(value*256+byte)>>>0,0);
    const network=(address&bits)>>>0,broadcast=(network|~bits)>>>0;
    const start=Math.min(network+100,broadcast>network+1?broadcast-1:network),end=Math.min(start+50,broadcast>start+1?broadcast-1:start);
    const dotted=value=>[24,16,8,0].map(shift=>(value>>>shift)&255).join(".");
    return {enabled:false,poolStart:dotted(start),poolEnd:dotted(end),mask:device.config.mask||"255.255.255.0",
      gateway:device.config.ip||"192.168.10.1",dns:device.config.ip||"",leaseMinutes:60};
  }
  function renderConfig() {
    const id = state.activeDevice || state.hoveredDevice;
    const device = state.bench.devices[id];
    popover.hidden = !device;
    if (!device) return;
    popover.dataset.pinned = String(Boolean(state.activeDevice));
    const terminalOpen = Boolean(state.activeDevice && deviceTabState.get(id) === "terminal");
    text("[data-lab-popover-title]", `${device.name} · ${state.activeDevice ? terminalOpen ? "terminal" : "configuração" : "resumo"}`);
    root.querySelector("[data-lab-popover-tabs]").hidden = !state.activeDevice;
    deviceTabs.forEach(tab => { const selected = tab.dataset.labDeviceTab === (terminalOpen ? "terminal" : "config"); tab.setAttribute("aria-selected", String(selected)); tab.tabIndex = selected ? 0 : -1; });
    popoverContent.hidden = terminalOpen; terminalPanel.hidden = !terminalOpen;
    if (terminalOpen) renderTerminal(id);
    popoverContent.replaceChildren();
    if (state.activeDevice) {
      field(popoverContent, id, "name", device.name, "Nome");
      const profileLabel = document.createElement("label"); profileLabel.textContent = "Profile";
      const profileSelect = document.createElement("select"); profileSelect.dataset.deviceId = id; profileSelect.dataset.configKey = "profile";
      profileOptions(profileSelect, device.type, device.profile || "generic"); profileLabel.append(profileSelect); popoverContent.append(profileLabel);
      if (device.type === "pc") {
        for (const [key, labelText] of [["ip", "IPv4"], ["mask", "Máscara"], ["gateway", "Gateway padrão"], ["mac", "MAC"]]) field(popoverContent, id, key, device.config[key], labelText);
        const servicePanel=document.createElement("details"),serviceTitle=document.createElement("summary");serviceTitle.textContent="DHCP, DNS e serviços";servicePanel.append(serviceTitle);
        servicePanel.open=Boolean(servicePanelOpen.get(id));servicePanel.addEventListener("toggle",()=>servicePanelOpen.set(id,servicePanel.open));
        const serviceField=(key,value,labelText,type="text")=>{const labelElement=document.createElement("label"),input=document.createElement("input");
          input.type=type;input.dataset.deviceId=id;input.dataset.serviceField=key;if(type==="checkbox")input.checked=Boolean(value);else input.value=String(value??"");
          labelElement.append(`${labelText} `,input);servicePanel.append(labelElement);};
        serviceField("dhcpClient",device.config.dhcpClient,"Cliente DHCP","checkbox");
        serviceField("dns",device.config.dns,"Servidor DNS (IPv4)");
        const dhcp=device.config.dhcpServer||defaultDhcp(device);
        const heading=document.createElement("strong");heading.textContent="Servidor DHCP · mesma VLAN";servicePanel.append(heading);
        for(const [key,labelText,type] of [["enabled","Ativo","checkbox"],["poolStart","Pool início"],["poolEnd","Pool fim"],["mask","Máscara ofertada"],["gateway","Gateway ofertado"],["dns","DNS ofertado"],["leaseMinutes","Lease (minutos)","number"]])serviceField(`dhcpServer.${key}`,dhcp[key],labelText,type||"text");
        const dnsServer=device.config.dnsServer||{enabled:false,records:[]};
        const dnsHeading=document.createElement("strong");dnsHeading.textContent="Servidor DNS · registros A";servicePanel.append(dnsHeading);
        serviceField("dnsServer.enabled",dnsServer.enabled,"Ativo","checkbox");
        dnsServer.records.forEach((record,index)=>{serviceField(`dnsRecord.${index}.name`,record.name,`Nome ${index+1}`);serviceField(`dnsRecord.${index}.address`,record.address,"IPv4");const remove=document.createElement("button");remove.type="button";remove.dataset.serviceRemoveRecord=String(index);remove.dataset.deviceId=id;remove.textContent="Excluir registro";servicePanel.append(remove);});
        serviceField("newRecordName","","Novo nome");serviceField("newRecordAddress","","Novo IPv4");const addRecord=document.createElement("button");addRecord.type="button";addRecord.dataset.serviceAddRecord=id;addRecord.textContent="Adicionar registro A";servicePanel.append(addRecord);
        const serviceHeading=document.createElement("strong");serviceHeading.textContent="Serviços TCP/UDP";servicePanel.append(serviceHeading);
        (device.config.services||[]).forEach((service,index)=>{serviceField(`service.${index}.name`,service.name,`Serviço ${index+1}`);serviceField(`service.${index}.port`,service.port,"Porta","number");serviceField(`service.${index}.enabled`,service.enabled,"Disponível","checkbox");const line=document.createElement("p");line.textContent=`${service.protocol.toUpperCase()}/${service.port}`;servicePanel.append(line);const remove=document.createElement("button");remove.type="button";remove.dataset.serviceRemove=id;remove.dataset.serviceIndex=String(index);remove.textContent="Excluir serviço";servicePanel.append(remove);});
        serviceField("newServiceName","","Novo serviço");serviceField("newServicePort","","Nova porta","number");const protocol=document.createElement("select");protocol.dataset.serviceProtocol="";for(const value of ["tcp","udp"]){const option=document.createElement("option");option.value=value;option.textContent=value.toUpperCase();protocol.append(option);}servicePanel.append(protocol);const addService=document.createElement("button");addService.type="button";addService.dataset.serviceAdd=id;addService.textContent="Adicionar serviço";servicePanel.append(addService);
        popoverContent.append(servicePanel);
        const labelElement = document.createElement("label"), checkbox = document.createElement("input");
        checkbox.type = "checkbox"; checkbox.dataset.deviceId = id; checkbox.dataset.configKey = "adminUp";
        checkbox.checked = !device.config.portSettings?.[device.interfaces[0]]?.shutdown;
        labelElement.append(checkbox, ` ${interfaceName(device.interfaces[0])} administrativamente ativa`);
        popoverContent.append(labelElement);
      }
      if (device.type === "router") for (const iface of ["eth0", "eth1"]) {
        const heading = document.createElement("strong"); heading.textContent = interfaceName(`${id}:${iface}`); popoverContent.append(heading);
        for (const [key, labelText] of [["ip", "IPv4"], ["mask", "Máscara"], ["mac", "MAC"]]) field(popoverContent, id, `${iface}.${key}`, device.config[iface][key], labelText);
      }
      if (device.type === "router") {
        const routes = document.createElement("details"), title = document.createElement("summary"); title.textContent = `Rotas estáticas (${device.config.staticRoutes?.length || 0})`; routes.append(title);
        (device.config.staticRoutes || []).forEach((route, index) => {
          const row = document.createElement("p"), remove = document.createElement("button"); remove.type = "button";
          remove.dataset.labRouteRemove = String(index); remove.dataset.deviceId = id; remove.textContent = "Excluir";
          row.append(`${simulator.prefix(simulator.ipv4(route.destination), simulator.mask(route.mask))} via ${route.nextHop} `, remove); routes.append(row);
        });
        for (const [key, labelText] of [["destination", "Rede de destino"], ["mask", "Máscara"], ["nextHop", "Próximo salto"]]) {
          const labelElement = document.createElement("label"), input = document.createElement("input");
          labelElement.textContent = labelText; input.dataset.routeField = key; input.placeholder = key === "destination" ? "192.168.20.0" : key === "mask" ? "255.255.255.0" : "10.0.0.2";
          labelElement.append(input); routes.append(labelElement);
        }
        const add = document.createElement("button"); add.type = "button"; add.dataset.labRouteAdd = id; add.textContent = "Adicionar rota"; routes.append(add); popoverContent.append(routes);
        const nat = device.config.nat || {inside: "", outside: "", sourceNetwork: "", sourceMask: "", enabled: false};
        const natPanel = document.createElement("details"), natTitle = document.createElement("summary");
        natTitle.textContent = "NAT/PAT de origem (ICMP)"; natPanel.append(natTitle);
        const note=document.createElement("p");note.textContent="A rota escolhe a saída; PAT traduz o IPv4 de origem na interface outside. A tabela abaixo aparece após a ida.";natPanel.append(note);
        for(const role of ["inside","outside"]) {
          const labelElement=document.createElement("label"), select=document.createElement("select");labelElement.textContent=`Interface ${role}`;
          select.dataset.deviceId=id;select.dataset.natField=role;
          for(const key of ["","eth0","eth1"]){const option=document.createElement("option");option.value=key;option.textContent=key?interfaceName(`${id}:${key}`):"Não definida";select.append(option);}
          select.value=nat[role];labelElement.append(select);natPanel.append(labelElement);
        }
        for(const [key,labelText] of [["sourceNetwork","Rede inside"],["sourceMask","Máscara da rede inside"]]){
          const labelElement=document.createElement("label"),input=document.createElement("input");labelElement.textContent=labelText;
          input.dataset.deviceId=id;input.dataset.natField=key;input.value=nat[key];input.placeholder=key==="sourceNetwork"?"192.168.10.0":"255.255.255.0";
          labelElement.append(input);natPanel.append(labelElement);
        }
        const toggle=document.createElement("label"),checkbox=document.createElement("input");checkbox.type="checkbox";checkbox.dataset.deviceId=id;checkbox.dataset.natField="enabled";checkbox.checked=nat.enabled;
        toggle.append(checkbox," PAT ativo");natPanel.append(toggle);popoverContent.append(natPanel);
      }
      if (device.type === "switch") {
        for (const interfaceId of device.interfaces.filter(interfaceId => state.bench.interfaces[interfaceId].mode === "access")) field(popoverContent, id, interfaceId, device.config.vlans[interfaceId], interfaceName(interfaceId), "select");
        const title = document.createElement("strong"); title.textContent = `${interfaceName(device.interfaces.at(-1))} · Allowed VLANs`; popoverContent.append(title);
        for (const vlan of [...new Set([10, 20, ...device.config.allowedVlans])].sort((a,b)=>a-b)) { const labelElement = document.createElement("label"); const input = document.createElement("input"); input.type = "checkbox"; input.dataset.deviceId = id; input.dataset.allowedVlan = String(vlan); input.checked = device.config.allowedVlans.includes(vlan); labelElement.append(input, ` VLAN ${vlan}`); popoverContent.append(labelElement); }
        device.interfaces.forEach(interfaceId => { const setting=device.config.portSettings?.[interfaceId]||{}; field(popoverContent,id,`description:${interfaceId}`,setting.description||"", `${interfaceName(interfaceId)} · descrição`); });
      }
      const remove = document.createElement("button"); remove.type = "button"; remove.dataset.labRemove = id; remove.textContent = `Remover ${device.name}`; popoverContent.append(remove);
    }
    const summary = document.createElement("ul");
    details(id).forEach(row => { const li = document.createElement("li"); li.textContent = row; summary.append(li); });
    popoverContent.append(summary);
    if (device.type === "router") {
      const current = state.result?.events[state.index];
      const routes = current?.tables.routes.filter(row => row.routerId === id) || ["eth0", "eth1"].map(iface => {
        const config = device.config[iface], ip = simulator.ipv4(config.ip), mask = simulator.mask(config.mask);
        return {interfaceId: `${id}:${iface}`, prefix: ip && mask ? simulator.prefix(ip, mask) : "IPv4/máscara inválidos", connected: Boolean(peerOf(`${id}:${iface}`)), type: "connected"};
      }).concat((device.config.staticRoutes || []).map(route => ({...route, type: "static", prefix: simulator.prefix(simulator.ipv4(route.destination), simulator.mask(route.mask)),
        interfaceId: ["eth0", "eth1"].map(iface => `${id}:${iface}`).find(port => { const c=device.config[port.endsWith("eth0")?"eth0":"eth1"];return peerOf(port)&&simulator.ipv4(c.ip)&&simulator.sameSubnet(simulator.ipv4(c.ip),simulator.ipv4(route.nextHop),simulator.mask(c.mask)); }) || null})));
      const routeList = document.createElement("p"); routeList.textContent = `Tabela de rotas: ${routes.map(row => `${row.type === "static" ? "S" : "C"} ${row.prefix}${row.nextHop ? ` via ${row.nextHop}` : ""}${row.interfaceId ? ` · ${interfaceName(row.interfaceId)}` : " · inativa"}`).join("; ") || "nenhuma"}`; popoverContent.append(routeList);
      const arpList = document.createElement("p"); arpList.textContent = `ARP neste evento: ${(current?.tables.arp || []).filter(row => row.owner === id).map(row => `${row.ip} → ${row.mac}`).join("; ") || "ainda não aprendido"}`; popoverContent.append(arpList);
      const natRows=(current?.tables.nat||[]).filter(row=>row.routerId===id),natTable=document.createElement("table"),caption=document.createElement("caption");
      caption.textContent="Traduções NAT neste evento";natTable.append(caption);
      const header=document.createElement("tr");for(const heading of ["Protocolo","Inside local","Inside global","Destino externo"]){const th=document.createElement("th");th.scope="col";th.textContent=heading;header.append(th);}natTable.append(header);
      for(const row of natRows){const tr=document.createElement("tr");for(const value of [row.protocol,`${row.insideLocal}:${row.originalId}`,`${row.insideGlobal}:${row.translatedId}`,row.outsideGlobal]){const td=document.createElement("td");td.textContent=value;tr.append(td);}natTable.append(tr);}
      popoverContent.append(natTable);
      if(!natRows.length){const empty=document.createElement("p");empty.textContent="Ainda nenhuma tradução aprendida.";popoverContent.append(empty);}
    }
    positionPopover();
  }
  function positionPopover() {
    const id = state.activeDevice || state.hoveredDevice;
    const node = id && nodes.querySelector(`[data-lab-node="${id}"]`);
    if (node && !popover.hidden) {
      const nodeRect = node.getBoundingClientRect();
      const scale = viewport.scale, margin = 8 / scale;
      const visibleLeft = -viewport.x / scale, visibleTop = -viewport.y / scale;
      const visibleRight = visibleLeft + canvas.clientWidth / scale;
      const visibleBottom = visibleTop + canvas.clientHeight / scale;
      const width = Math.min(360, (canvas.clientWidth - 16) / scale);
      const nodeLeft = worldPoint(nodeRect.left, nodeRect.top).x;
      const nodeRight = worldPoint(nodeRect.right, nodeRect.top).x;
      const nodeTop = worldPoint(nodeRect.left, nodeRect.top).y;
      const right = nodeRight + margin;
      popover.style.width = `${width}px`;
      popover.style.maxHeight = `${(canvas.clientHeight - 16) / scale}px`;
      const left = right + width > visibleRight - margin ? nodeLeft - width - margin : right;
      popover.style.left = `${Math.max(visibleLeft + margin, Math.min(visibleRight - width - margin, left))}px`;
      popover.style.top = `${Math.max(visibleTop + margin, Math.min(visibleBottom - popover.offsetHeight - margin, nodeTop))}px`;
    }
  }
  function renderPair() {
    const installed = Object.keys(state.bench.devices).filter(id => state.bench.devices[id].type === "pc" && state.bench.devices[id].position);
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
    renderConfig();
  }
  function restoreBench(restored, message) {
    resetTerminals();
    presetFeedback.textContent = "";
    state.bench = restored.state;
    state.result = null; state.index = -1; state.activeDevice = null; state.hoveredDevice = null;
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
  function renderCommandAnalysis() {
    const panel = root.querySelector("[data-lab-command-analysis]");
    panel.hidden = state.exercise?.instance.mode !== "operational";
    if (panel.hidden) return;
    const analysis = exerciseEngine.attemptAnalysis(state.exercise.instance);
    text("[data-lab-command-count]", String(analysis.commandCount));
    const list = root.querySelector("[data-lab-command-log]"); list.replaceChildren();
    for (const entry of analysis.commands) {
      const row = document.createElement("li");
      row.textContent = `${state.bench.devices[entry.deviceId]?.name || entry.deviceId} · ${entry.command} — ${entry.errorCode || "executado"}`;
      list.append(row);
    }
  }
  function startExercise(exerciseId, seed, difficulty, mode = "bench", attemptId = null) {
    let loaded = null;
    if (attemptId) {
      if (!attempts) throw new Error("Armazenamento de tentativas indisponível; não é possível recuperar esta tentativa.");
      loaded = attempts.resume(attemptId);
    }
    const instance = loaded?.instance || exerciseEngine.generateExercise(exerciseId, seed, {difficulty, mode});
    const restored = loaded ? model.importScenario(loaded.attempt.currentScenario) : model.importScenario(instance.scenario);
    state.attempt = null;
    if (loaded) {
      try { state.attempt = attempts.begin(attemptId); }
      catch (error) { state.attempt = loaded.attempt; attemptDirty = true;
        attemptMessage(`Tentativa recuperada somente para leitura: ${error.message}`, true); }
    }
    if (!loaded && attempts) {
      try { state.attempt = attempts.begin(attempts.createAttempt(instance.exerciseId, instance.seed, instance.difficulty, instance.mode || "bench").attemptId); }
      catch (error) { attemptMessage(`Exercício aberto sem continuidade: ${error.message}`, true); }
    }
    state.exercise = {instance, completed: state.attempt?.status === "completed"};
    exercisePanel.hidden = false;
    text("[data-lab-exercise-title]", instance.title);
    const environments = {"cisco-windows": "Cisco + Windows", "cisco-linux": "Cisco + Linux", "dell-windows": "Dell + Windows", "mikrotik-hosts": "MikroTik + hosts", mixed: "Ambiente misto"};
    text("[data-lab-exercise-meta]", `${instance.difficulty === "advanced" ? "Advanced" : "Intermediate"} · ${instance.mode === "operational" ? `Operacional · ${environments[instance.environment]} · ` : ""}seed ${instance.seed}`);
    text("[data-lab-exercise-prompt]", instance.prompt);
    text("[data-lab-exercise-objective]", instance.objective.text);
    checkSolution.disabled = Boolean(state.exercise.completed);
    root.querySelector("[data-lab-reset]").textContent = "Reiniciar exercício";
    restoreBench(restored, "Exercício iniciado. Investigue o percurso na bancada.");
    root.querySelector(".lab-presets").hidden = true;
    root.querySelector(".lab-scenarios").hidden = true;
    if (state.attempt) {
      const url = new URL(window.location.href);
      url.searchParams.set("attempt", state.attempt.attemptId);
      url.searchParams.set("exercise", instance.exerciseId);
      url.searchParams.set("seed", instance.seed);
      url.searchParams.set("difficulty", instance.difficulty);
      url.searchParams.set("mode", instance.mode || "bench");
      window.history.replaceState(null, "", url);
      root.querySelector("[data-lab-return-practice]").href = `${root.querySelector("[data-lab-return-practice]").href.split("?")[0]}?attempt=${encodeURIComponent(state.attempt.attemptId)}`;
      for (const entry of state.attempt.progress.commands) exerciseEngine.recordCommand(instance, entry);
      for (const [id, session] of Object.entries(state.attempt.progress.terminals)) terminalSessions.set(id, session);
      if (state.attempt.progress.lastRun) {
        const prior = state.attempt.progress.lastRun;
        try {
          if (prior.kind === "verification") state.result = exerciseEngine.validateExercise(instance, state.bench).result;
          else {
            const adapted = model.adapt(state.bench, prior.sourceId, prior.destinationId);
            if (!adapted.error) state.result = exerciseEngine.presentResult(instance, simulator.simulate(adapted.input));
          }
          if (state.result) { state.index = Math.min(prior.index, state.result.events.length - 1); renderEvent(); }
        } catch (error) { attemptMessage(`Percurso anterior não pôde ser reconstituído: ${error.message}`, true); }
      }
      renderConfig();
    }
    renderCommandAnalysis();
    const lastCheck = state.attempt?.status === "completed" || state.attempt?.progress.lastRun?.kind === "verification"
      ? state.attempt.checks.at(-1) : null;
    exerciseFeedback.dataset.state = lastCheck ? lastCheck.complete ? "success" : "error" : "";
    exerciseFeedback.textContent = lastCheck ? `${lastCheck.feedback}${lastCheck.complete ? " Exercício concluído." : ""}` : instance.mode === "operational"
      ? "Abra o terminal de um equipamento para investigar. Use o teste para observar o percurso; cabos podem ser corrigidos na bancada. Testar solução avalia o estado final."
      : "Use Testar comunicação para observar o percurso. Ajuste a bancada e depois selecione Testar solução.";
    if (state.attempt && !attemptDirty) attemptMessage(state.attempt.status === "completed" ? "Tentativa concluída e salva neste navegador." : "Tentativa em andamento; alterações são salvas automaticamente.");
    renderExercisePresentation(true);
  }
  function renderConnections() {
    const list = root.querySelector("[data-lab-connections]");
    list.replaceChildren();
    text("[data-lab-cable-count]", `${state.bench.connections.length} ${state.bench.connections.length === 1 ? "cabo conectado" : "cabos conectados"}`);
    if (!state.bench.connections.length) { const li = document.createElement("li"); li.textContent = "Nenhum cabo conectado."; list.append(li); return; }
    state.bench.connections.forEach(link => {
      const li = document.createElement("li");
      const name = id => {
        const iface = state.bench.interfaces[id];
        const detail = iface.mode === "trunk" ? ` · trunk 802.1Q · admitidas ${state.bench.devices[iface.deviceId].config.allowedVlans.join(", ") || "nenhuma"}` : state.bench.devices[iface.deviceId].type === "switch" ? ` · VLAN ${state.bench.devices[iface.deviceId].config.vlans[id]}` : "";
        return `${label(iface.deviceId)} ${interfaceName(id)}${detail}`;
      };
      const span = document.createElement("span"); span.textContent = `${name(link.a)} ↔ ${name(link.b)}`;
      const button = document.createElement("button"); button.type = "button"; button.dataset.labDisconnect = link.id; button.textContent = "Desconectar"; button.setAttribute("aria-label", `Desconectar ${span.textContent}`);
      li.append(span, button); list.append(li);
    });
  }
  function drawWires(event) {
    wires.setAttribute("viewBox", `0 0 ${canvas.clientWidth} ${canvas.clientHeight}`);
    wires.replaceChildren();
    const targets = model.eventTargets(event);
    for (const link of state.bench.connections) {
      const ends = [link.a, link.b].map(id => nodes.querySelector(`[data-lab-interface="${id}"]`)?.getBoundingClientRect());
      if (ends.some(end => !end)) continue;
      const [a, b] = ends.map(r => worldPoint(r.left + r.width / 2, r.top + r.height / 2));
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.dataset.connectionId = link.id;
      for (const [key, value] of Object.entries({x1: a.x, y1: a.y, x2: b.x, y2: b.y})) line.setAttribute(key, value);
      const isTrunk=state.bench.interfaces[link.a]?.mode==='trunk'&&state.bench.interfaces[link.b]?.mode==='trunk';
      const administrativelyDown=[link.a,link.b].some(port=>state.bench.devices[state.bench.interfaces[port]?.deviceId]?.config.portSettings?.[port]?.shutdown);
      line.setAttribute("class", `lab-wire${isTrunk ? " is-trunk" : ""}${administrativelyDown?" is-down":""}${targets.connectionIds.includes(link.id) ? " is-active" : ""}`);
      wires.append(line);
      if (isTrunk && !administrativelyDown && !targets.connectionIds.includes(link.id)) {
        const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
        title.setAttribute("x", (a.x + b.x) / 2); title.setAttribute("y", (a.y + b.y) / 2 - 10);
        title.setAttribute("class", "lab-wire-label"); title.textContent = "trunk 802.1Q"; wires.append(title);
        title.dataset.connectionLabel = link.id;
      }
      if (targets.connectionIds.includes(link.id) && event?.frame) {
        const badge = document.createElementNS("http://www.w3.org/2000/svg", "text");
        badge.setAttribute("x", (a.x + b.x) / 2); badge.setAttribute("y", (a.y + b.y) / 2 - 10);
        badge.setAttribute("class", `lab-wire-label ${event.frame.kind}`);
        const from = state.bench.devices[event.fromId]?.position;
        const to = state.bench.devices[event.toId]?.position;
        const dx = from && to ? (to.x - from.x) * canvas.clientWidth : 0;
        const dy = from && to ? (to.y - from.y) * canvas.clientHeight : 0;
        const direction = !from || !to ? "•" : Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "→" : "←") : (dy >= 0 ? "↓" : "↑");
        badge.textContent = `${direction} ${event.frame.label}`;
        badge.dataset.connectionLabel = link.id;
        wires.append(badge);
      }
    }
  }
  function updateDragWires(deviceId) {
    for (const link of state.bench.connections) {
      if (![link.a, link.b].some(interfaceId => state.bench.interfaces[interfaceId].deviceId === deviceId)) continue;
      const ends = [link.a, link.b].map(interfaceId => nodes.querySelector(`[data-lab-interface="${interfaceId}"]`).getBoundingClientRect());
      const [a, b] = ends.map(end => worldPoint(end.left + end.width / 2, end.top + end.height / 2));
      const line = [...wires.querySelectorAll("line")].find(item => item.dataset.connectionId === link.id);
      if (!line) continue;
      for (const [key, value] of Object.entries({x1: a.x, y1: a.y, x2: b.x, y2: b.y})) line.setAttribute(key, value);
      [...wires.querySelectorAll("text")].filter(item => item.dataset.connectionLabel === link.id).forEach(item => {
        item.setAttribute("x", (a.x + b.x) / 2); item.setAttribute("y", (a.y + b.y) / 2 - 10);
      });
    }
  }
  function renderBoard() {
    syncCards();
    const event = state.result?.events[state.index] || null;
    const targets = model.eventTargets(event);
    for (const id of Object.keys(state.bench.devices)) {
      const device = state.bench.devices[id];
      const element = nodes.querySelector(`[data-lab-node="${id}"]`);
      element.hidden = !device.position;
      if (device.position) {
        const rect = canvas.getBoundingClientRect(), xMargin = Math.min(.46, 100 / rect.width), yMargin = Math.min(.46, 85 / rect.height);
        element.style.left = `${Math.max(xMargin, Math.min(1 - xMargin, device.position.x)) * 100}%`;
        element.style.top = `${Math.max(yMargin, Math.min(1 - yMargin, device.position.y)) * 100}%`;
      }
      element.dataset.selected = String(state.activeDevice === id);
      element.dataset.active = String(targets.deviceId === id);
      element.dataset.blocked = String(event?.outcome === "failure" && event.focusId === id);
      element.querySelector(".lab-node-main strong").textContent = device.name;
      element.querySelector(".lab-node-main small").textContent = profiles.get(device.type, device.profile).displayType;
      element.querySelector(".lab-drag-handle").setAttribute("aria-label", `Mover ${device.name} com teclado`);
      for (const interfaceId of device.interfaces) {
        const button = element.querySelector(`[data-lab-interface="${interfaceId}"]`);
        const portStatus = device.config.portSettings?.[interfaceId]?.shutdown ? " · desligada" : "";
        const setting = (device.type !== "switch" ? "" : state.bench.interfaces[interfaceId].mode === "trunk" ? " · trunk" : ` · VLAN ${device.config.vlans[interfaceId]}`) + portStatus;
        button.textContent = `${interfaceName(interfaceId)}${setting}`;
        const connected = state.bench.connections.some(link => [link.a, link.b].includes(interfaceId));
        button.setAttribute("aria-label", `${device.name} ${interfaceName(interfaceId)}${setting}: ${connected ? "desconectar" : "selecionar para conectar"}`);
        button.dataset.pending = String(state.pendingInterface === interfaceId);
        button.dataset.active = String(targets.interfaceIds.includes(interfaceId));
        button.dataset.connected = String(connected);
      }
    }
    const count = Object.values(state.bench.devices).filter(device => device.position).length;
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
    text("[data-lab-position]", event ? `${event.traceTtl ? `Sonda TTL ${event.traceTtl} · ` : ""}Evento ${state.index + 1} de ${state.result.events.length}` : "Sem evento");
    text("[data-lab-observation]", eventText(event?.observation, event) || "Pronto para montar");
    const icmpName = {"echo-request": "Echo Request", "echo-reply": "Echo Reply", "time-exceeded": "Time Exceeded", "destination-unreachable": "Destination Unreachable"};
    text("[data-lab-event-kind]", event?.frame?.label || (event?.packet?.icmpType ? `ICMP ${icmpName[event.packet.icmpType] || event.packet.icmpType}` : event?.outcome === "failure" ? "ENTREGA INTERROMPIDA" : "OBSERVAÇÃO"));
    root.querySelector(".lab-event").dataset.kind = event?.frame?.kind || "none";
    text("[data-lab-explanation]", eventText(event?.explanation, event) || "Os eventos serão calculados da configuração atual.");
    const portName = id => id ? `${label(state.bench.interfaces[id].deviceId)} ${interfaceName(id)}` : "—";
    text("[data-lab-interfaces]", event ? `${portName(event.incomingInterfaceId)} → ${(event.outgoingInterfaceIds || []).map(portName).join(", ") || "—"}` : "—");
    text("[data-lab-frame]", event?.frame ? `${event.frame.label} · Source ${event.frame.source} → Destination ${event.frame.destination} · ${event.frame.vlanTag ? `802.1Q VLAN ${event.frame.vlanTag}` : "sem tag (access)"}` : "—");
    text("[data-lab-packet]", event?.packet ? `${event.packet.source} → ${event.packet.destination} · TTL ${event.packet.ttl}${event.packet.icmpType ? ` · ICMP ${icmpName[event.packet.icmpType] || event.packet.icmpType}${event.packet.icmpId?` ID ${event.packet.icmpId}`:""}` : ""}${event.traceTtl ? ` · sonda TTL ${event.traceTtl}` : ""}${event.natTranslation?` · NAT ${event.natTranslation.before.source}→${event.natTranslation.before.destination} ⇢ ${event.natTranslation.after.source}→${event.natTranslation.after.destination}`:""}` : "—");
    renderList("[data-lab-mac-table]", event?.tables.mac || [], row => `${label(row.switchId)} · VLAN ${row.vlan} · ${row.mac} → ${interfaceName(row.interfaceId)}`, "Sem entradas aprendidas.");
    renderList("[data-lab-arp-table]", event?.tables.arp || [], row => `${label(row.owner)} ${row.interfaceId ? interfaceName(row.interfaceId) : ""} · ${row.ip} → ${row.mac}`, "Ainda não aprendida.");
    if (state.activeDevice || state.hoveredDevice) renderConfig();
    const prior = state.result?.events.slice(0, state.index + 1) || [];
    const currentLeg = event?.traceTtl ? prior.filter(item => item.traceTtl === event.traceTtl) : event?.packet?.icmpType ? prior.slice(Math.max(0, prior.findLastIndex(item => item.id === "echo-reply-start"))) : prior;
    const incoming = currentLeg.findLast(item => item.id === "router-receive")?.frame;
    const decision = currentLeg.findLast(item => item.id === "route-decision")?.routerDecision;
    const outgoing = currentLeg.findLast(item => item.id === "frame-out")?.frame;
    const inspector = root.querySelector("[data-lab-router-inspector]");
    inspector.hidden = !incoming;
    text("[data-lab-frame-in]", incoming ? `${incoming.source} → ${incoming.destination} · VLAN de entrada` : "Ainda não recebido.");
    text("[data-lab-route-decision]", decision ? `${decision.route} → ${interfaceName(decision.output)} · TTL ${decision.ttlBefore} → ${decision.ttlAfter}` : "O roteador ainda não escolheu a saída.");
    text("[data-lab-frame-out]", outgoing ? `${outgoing.source} → ${outgoing.destination} · VLAN de saída` : "Ainda não criado.");
    root.querySelector("[data-lab-prev]").disabled = state.index <= 0;
    root.querySelector("[data-lab-next]").disabled = !state.result || state.index >= state.result.events.length - 1;
    const history = root.querySelector("[data-lab-history]"); history.replaceChildren();
    const allEvents = state.result?.events || [];
    const historyStart = Math.max(0, Math.min(Math.max(0, state.index - Math.floor(simulator.LIMITS.history / 2)), allEvents.length - simulator.LIMITS.history));
    allEvents.slice(historyStart, historyStart + simulator.LIMITS.history).forEach((entry, offset) => {
      const index = historyStart + offset;
      const li = document.createElement("li"); li.textContent = eventText(entry.observation, entry);
      if (index === state.index) li.setAttribute("aria-current", "step");
      history.append(li);
    });
    if (event?.outcome) status.textContent = eventText(event.observation, event);
    else if (event) status.textContent = `Evento ${state.index + 1} de ${state.result.events.length}. Avance no seu ritmo.`;
    renderBoard();
  }

  canvas.append(popover);
  function activateDeviceTab(tabName, focusInput = false) {
    if (!state.activeDevice) return;
    deviceTabState.set(state.activeDevice, tabName); renderConfig();
    if (focusInput && tabName === "terminal") {
      if (terminalInput.disabled) root.querySelector("[data-lab-terminal-restart]").focus(); else terminalInput.focus();
    }
  }
  deviceTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateDeviceTab(tab.dataset.labDeviceTab, true));
    tab.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const next = event.key === "Home" ? 0 : event.key === "End" ? deviceTabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + deviceTabs.length) % deviceTabs.length;
      activateDeviceTab(deviceTabs[next].dataset.labDeviceTab); deviceTabs[next].focus();
    });
  });
  terminalInput.addEventListener("input", () => { if (state.activeDevice) terminalDrafts.set(state.activeDevice, terminalInput.value); });
  terminalInput.addEventListener("keydown", event => {
    event.stopPropagation();
    if (!["ArrowUp", "ArrowDown"].includes(event.key) || !state.activeDevice) return;
    event.preventDefault();
    const id = state.activeDevice;
    const moved = terminalEngine.navigateHistory(terminalSessions.get(id), event.key === "ArrowUp" ? "up" : "down", terminalInput.value);
    terminalSessions.set(id, moved.session); terminalInput.value = moved.command; terminalDrafts.set(id, moved.command);
  });
  root.querySelector("[data-lab-terminal-form]").addEventListener("submit", event => {
    event.preventDefault(); event.stopPropagation();
    const id = state.activeDevice; if (!id || terminalInput.disabled) return;
    const command = terminalInput.value;
    const executed = terminalEngine.execute(terminalSessions.get(id), command, {...state.bench, observation: state.result?.events[state.index] || null});
    const result = state.exercise ? exerciseEngine.presentTerminalResult(state.exercise.instance, executed) : executed;
    if (state.exercise?.instance.mode === "operational" && command.trim()) {
      const entry = {deviceId: id, profile: state.bench.devices[id].profile,
        command, errorCode: result.error?.code || "", changedState: Boolean(result.bench)};
      exerciseEngine.recordCommand(state.exercise.instance, entry);
      if (state.attempt && attempts) {
        try { state.attempt = attempts.recordCommand(state.attempt.attemptId, entry); }
        catch (error) { attemptDirty = true; attemptMessage(`Comando não salvo: ${error.message}`, true); }
      }
      renderCommandAnalysis();
    }
    terminalSessions.set(id, result.session); terminalDrafts.set(id, ""); terminalInput.value = "";
    if (result.bench) apply({state:result.bench}, `${label(id)}: configuração alterada via terminal.`);
    if (result.labResult) {
      state.result = state.exercise ? exerciseEngine.presentResult(state.exercise.instance, result.labResult) : result.labResult;
      state.index = state.result.events.length ? 0 : -1;
      renderEvent();
      const commandName=command.trim().split(/\s+/)[0]?.toLowerCase();
      const activity=["tracert","traceroute"].includes(commandName)?"Traceroute":commandName==="dhclient"||command.toLowerCase().trim()==="ipconfig /renew"?"DHCP":
        ["nslookup","dig"].includes(commandName)?"DNS":["curl","connect"].includes(commandName)?"Serviço":"Ping";
      announce(`${activity}: ${result.labResult.status}. Use Próximo para acompanhar os eventos.`);
    }
    renderTerminal(id);
    terminalFeedback.textContent = result.cleared ? "Saída limpa. Histórico preservado." : result.output.join(" ") || result.session.prompt;
    persistAttempt();
    if (result.closed) root.querySelector("[data-lab-terminal-restart]").focus(); else terminalInput.focus();
  });
  root.querySelector("[data-lab-terminal-restart]").addEventListener("click", () => {
    const id = state.activeDevice; if (!id) return;
    terminalSessions.set(id, terminalEngine.createSession(state.bench.devices[id])); terminalDrafts.set(id, "");
    terminalInput.value = ""; renderTerminal(id); terminalFeedback.textContent = "Nova sessão iniciada."; terminalInput.focus();
    persistAttempt();
  });
  catalog.forEach(button => button.addEventListener("click", () => {
    const type = button.dataset.labCatalog;
    const change = model.addDevice(state.bench, type, root.querySelector(`[data-lab-catalog-profile="${type}"]`).value);
    if (change.error) { announce(change.error); return; }
    const count = Object.values(state.bench.devices).filter(device => device.position).length;
    const x = .22 + (count % 4) * .19, y = .2 + (Math.floor(count / 4) % 5) * .15;
    const rect = canvas.getBoundingClientRect();
    const point = canvasPoint(rect.left + x * rect.width, rect.top + y * rect.height);
    const placed = model.position(change.state, change.id, point.x, point.y);
    if (apply(placed, `${change.state.devices[change.id].name} adicionado à bancada.`)) openConfig(change.id);
  }));
  canvas.addEventListener("click", event => {
    if (suppressClick) { suppressClick = false; return; }
    if (event.target.closest("[data-lab-view-reset]")) return;
    if (event.target.closest("[data-lab-popover]")) return;
    const interfaceButton = event.target.closest("[data-lab-interface]");
    if (interfaceButton) { selectInterface(interfaceButton.dataset.labInterface); return; }
    const dragButton = event.target.closest("[data-lab-drag]");
    if (dragButton) { const id = dragButton.dataset.labDrag; state.cursor = {...state.bench.devices[id].position}; setMode("move", id); canvas.focus(); announce(`${label(id)} em modo mover. Clique no novo local ou use as setas e Enter.`); return; }
    const openButton = event.target.closest("[data-lab-open]");
    if (openButton) { openConfig(openButton.dataset.labOpen); return; }
    if (state.mode === "place" || state.mode === "move") placeAt(canvasPoint(event.clientX, event.clientY));
    else if (state.activeDevice) { state.activeDevice = null; renderConfig(); renderBoard(); }
  });
  canvas.addEventListener("keydown", event => {
    if (event.target.closest("[data-lab-popover]")) return;
    if (event.target === canvas && state.mode === "idle") {
      const rect = canvas.getBoundingClientRect();
      if (["+", "=", "-"].includes(event.key)) {
        event.preventDefault();
        zoomAt(viewport.scale * (event.key === "-" ? 1 / 1.2 : 1.2), rect.left + rect.width / 2, rect.top + rect.height / 2);
        announce(`Zoom da bancada: ${Math.round(viewport.scale * 100)}%.`);
        return;
      }
      const pan = event.shiftKey && {ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40]}[event.key];
      if (pan) { event.preventDefault(); viewport.x += pan[0]; viewport.y += pan[1]; setViewport(); return; }
    }
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
  canvas.addEventListener("wheel", event => {
    if (event.target.closest("[data-lab-popover]")) return;
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
    zoomAt(viewport.scale * Math.exp(-delta * .001), event.clientX, event.clientY);
  }, {passive: false});
  root.querySelector("[data-lab-view-reset]").addEventListener("click", () => {
    viewport.scale = 1; viewport.x = 0; viewport.y = 0;
    setViewport();
    announce("Vista da bancada recentrada, com zoom de 100%.");
  });
  canvas.addEventListener("pointerdown", event => {
    if (event.button !== 1) return;
    event.preventDefault();
    pointerPan = {id: event.pointerId, x: event.clientX, y: event.clientY};
    canvas.setPointerCapture(event.pointerId);
    canvas.dataset.panning = "true";
  });
  canvas.addEventListener("pointermove", event => {
    if (!pointerPan || event.pointerId !== pointerPan.id) return;
    viewport.x += event.clientX - pointerPan.x;
    viewport.y += event.clientY - pointerPan.y;
    pointerPan.x = event.clientX; pointerPan.y = event.clientY;
    setViewport();
  });
  function stopPan(event) {
    if (!pointerPan || event.pointerId !== pointerPan.id) return;
    pointerPan = null;
    delete canvas.dataset.panning;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  canvas.addEventListener("pointerup", stopPan);
  canvas.addEventListener("pointercancel", stopPan);
  canvas.addEventListener("auxclick", event => { if (event.button === 1) event.preventDefault(); });
  canvas.addEventListener("pointerdown", event => {
    if (event.target.closest("[data-lab-interface], [data-lab-popover]")) return;
    const node = event.target.closest("[data-lab-node]");
    if (!node || event.button !== 0) return;
    pointerDrag = {id: node.dataset.labNode, startX: event.clientX, startY: event.clientY, moved: false};
  });
  document.addEventListener("pointermove", event => {
    if (!pointerDrag) return;
    const drag = pointerDrag;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
    drag.moved = true;
    const node = nodes.querySelector(`[data-lab-node="${drag.id}"]`);
    const point = canvasPoint(event.clientX, event.clientY);
    node.style.left = `${point.x * 100}%`; node.style.top = `${point.y * 100}%`;
    drag.point = point;
    if (!dragFrame) dragFrame = requestAnimationFrame(() => { dragFrame = 0; updateDragWires(drag.id); });
  });
  document.addEventListener("pointerup", event => {
    if (!pointerDrag) return;
    const drag = pointerDrag; pointerDrag = null;
    if (!drag.moved) return;
    event.preventDefault();
    suppressClick = true;
    window.setTimeout(() => { suppressClick = false; }, 0);
    apply(model.position(state.bench, drag.id, drag.point.x, drag.point.y), `${label(drag.id)} movido. Cabos preservados.`, false);
    if (state.activeDevice === drag.id || state.hoveredDevice === drag.id) renderConfig();
  });
  document.addEventListener("pointercancel", () => { if (pointerDrag) renderBoard(); pointerDrag = null; });
  nodes.addEventListener("pointerover", event => {
    const node = event.target.closest("[data-lab-node]");
    if (!node || state.activeDevice || pointerDrag) return;
    if (event.relatedTarget?.closest?.("[data-lab-node]") === node) return;
    state.hoveredDevice = node.dataset.labNode; renderConfig();
  });
  nodes.addEventListener("pointerout", event => {
    if (!state.hoveredDevice || state.activeDevice) return;
    if (event.relatedTarget?.closest?.("[data-lab-node], [data-lab-popover]")) return;
    state.hoveredDevice = null; renderConfig();
  });
  popover.addEventListener("pointerleave", event => {
    if (state.activeDevice || event.relatedTarget?.closest?.("[data-lab-node]")) return;
    state.hoveredDevice = null; renderConfig();
  });
  root.querySelector("[data-lab-popover-close]").addEventListener("click", () => {
    state.activeDevice = null; state.hoveredDevice = null; renderConfig(); renderBoard();
  });
  document.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    if (event.target.closest("[data-lab-view-reset]")) return;
    if (state.activeDevice && !event.target.closest("[data-lab-node], [data-lab-popover]")) { state.activeDevice = null; renderConfig(); renderBoard(); }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && state.activeDevice) { state.activeDevice = null; state.hoveredDevice = null; renderConfig(); renderBoard(); }
  });
  root.querySelector("[data-lab-connections]").addEventListener("click", event => {
    const button = event.target.closest("[data-lab-disconnect]");
    if (!button) return;
    apply(model.disconnect(state.bench, button.dataset.labDisconnect), "Cabo desconectado. Execute um novo teste para atualizar o percurso.");
  });
  popover.addEventListener("change", event => {
    const input = event.target, id = input.dataset.deviceId;
    if (!id) return;
    if (input.dataset.allowedVlan) {
      const allowedVlans = [...popover.querySelectorAll("[data-allowed-vlan]:checked")].map(item => Number(item.dataset.allowedVlan));
      apply(model.configure(state.bench, id, {allowedVlans}), `${label(id)}: Allowed VLANs atualizadas.`);
    } else if (input.dataset.serviceField) {
      const path=input.dataset.serviceField.split("."),value=input.type==="checkbox"?input.checked:input.type==="number"?Number(input.value):input.value.trim();
      if(path[0].startsWith("new"))return;
      servicePanelOpen.set(id,true);
      const focusKey=popover.contains(document.activeElement)?document.activeElement.dataset.serviceField:null;
      const current=state.bench.devices[id].config;
      let values;
      if(path[0]==="dns"||path[0]==="dhcpClient")values={[path[0]]:value};
      else if(path[0]==="dhcpServer")values={dhcpServer:{...(current.dhcpServer||defaultDhcp(state.bench.devices[id])),[path[1]]:value}};
      else if(path[0]==="dnsServer")values={dnsServer:{...(current.dnsServer||{enabled:false,records:[]}),[path[1]]:value}};
      else if(path[0]==="dnsRecord") {const records=(current.dnsServer?.records||[]).map(row=>({...row}));records[Number(path[1])][path[2]]=value;values={dnsServer:{...(current.dnsServer||{enabled:false}),records}};}
      else {const services=(current.services||[]).map(row=>({...row}));services[Number(path[1])][path[2]]=value;values={services};}
      if(apply(model.setHostServices(state.bench,id,values),`${label(id)}: serviço atualizado. Execute novo teste para observar o efeito.`)&&focusKey)
        [...popover.querySelectorAll("[data-service-field]")].find(field=>field.dataset.serviceField===focusKey)?.focus();
    } else if (input.dataset.natField) {
      const key=input.dataset.natField,value=key==="enabled"?input.checked:input.value.trim();
      apply(model.setNat(state.bench,id,{[key]:value}),`${label(id)}: NAT/PAT atualizado. Execute novo teste para observar as traduções.`);
    } else if (input.dataset.configKey === "name") apply(model.renameDevice(state.bench, id, input.value), `Equipamento renomeado para ${input.value.trim()}.`, false);
    else if (input.dataset.configKey === "adminUp") apply(model.configure(state.bench, id, {portSettings: {[state.bench.devices[id].interfaces[0]]: {shutdown: !input.checked}}}), `${label(id)}: interface ${input.checked ? "ativada" : "desligada"}.`);
    else if (input.dataset.configKey === "profile") {
      if (apply(model.setProfile(state.bench, id, input.value), `${label(id)}: profile atualizado.`, false)) renderEvent();
    }
    else {
      const key = input.dataset.configKey;
      const values = key.startsWith("description:") ? {portSettings:{[key.slice("description:".length)]:{description:input.value}}} : key.includes(":gi0/") ? {vlans: {[key]: Number(input.value)}} : key.includes(".") ? {[key.split(".")[0]]: {[key.split(".")[1]]: input.value.trim()}} : {[key]: input.value.trim()};
      apply(model.configure(state.bench, id, values), `${label(id)} atualizado. Teste novamente para observar o efeito.`);
    }
  });
  popover.addEventListener("click", event => {
    const serviceButton=event.target.closest("[data-service-add-record], [data-service-remove-record], [data-service-add], [data-service-remove]");
    if(serviceButton){
      const id=serviceButton.dataset.deviceId||serviceButton.dataset.serviceAddRecord||serviceButton.dataset.serviceAdd||serviceButton.dataset.serviceRemove;
      servicePanelOpen.set(id,true);
      const config=state.bench.devices[id].config,panel=serviceButton.closest("details");let values;
      if(serviceButton.hasAttribute("data-service-add-record")){
        const name=panel.querySelector('[data-service-field="newRecordName"]').value.trim(),address=panel.querySelector('[data-service-field="newRecordAddress"]').value.trim();
        values={dnsServer:{...(config.dnsServer||{enabled:false}),records:[...(config.dnsServer?.records||[]),{name,address}]}};
      }else if(serviceButton.hasAttribute("data-service-remove-record"))values={dnsServer:{...config.dnsServer,records:config.dnsServer.records.filter((_,index)=>index!==Number(serviceButton.dataset.serviceRemoveRecord))}};
      else if(serviceButton.hasAttribute("data-service-add")){
        const name=panel.querySelector('[data-service-field="newServiceName"]').value.trim(),port=Number(panel.querySelector('[data-service-field="newServicePort"]').value),protocol=panel.querySelector('[data-service-protocol]').value;
        values={services:[...(config.services||[]),{name,protocol,port,enabled:true}]};
      }else values={services:(config.services||[]).filter((_,index)=>index!==Number(serviceButton.dataset.serviceIndex))};
      apply(model.setHostServices(state.bench,id,values),`${label(id)}: configuração de serviço atualizada.`);return;
    }
    const routeAdd = event.target.closest("[data-lab-route-add]");
    if (routeAdd) {
      const route = Object.fromEntries([...routeAdd.closest("details").querySelectorAll("[data-route-field]")].map(input => [input.dataset.routeField, input.value.trim()]));
      apply(model.setStaticRoute(state.bench, routeAdd.dataset.labRouteAdd, route), "Rota estática atualizada. Execute novo teste para observar o percurso.");
      return;
    }
    const routeRemove = event.target.closest("[data-lab-route-remove]");
    if (routeRemove) {
      const route = state.bench.devices[routeRemove.dataset.deviceId]?.config.staticRoutes?.[Number(routeRemove.dataset.labRouteRemove)];
      if (route) apply(model.removeStaticRoute(state.bench, routeRemove.dataset.deviceId, route.destination, route.mask), "Rota estática removida. Execute novo teste para observar o percurso.");
      return;
    }
    const button = event.target.closest("[data-lab-remove]");
    if (!button) return;
    const id = button.dataset.labRemove, linked = state.bench.connections.some(link => link.a.startsWith(`${id}:`) || link.b.startsWith(`${id}:`));
    if (linked && !window.confirm(`Remover ${label(id)} e seus cabos conectados?`)) return;
    const name = label(id);
    state.activeDevice = null; state.hoveredDevice = null;
    terminalSessions.delete(id); terminalDrafts.delete(id); deviceTabState.delete(id);
    apply(model.removeDevice(state.bench, id), `${name} removido; cabos e seleções atualizados.`);
  });
  [sourceSelect, destinationSelect].forEach(select => select.addEventListener("change", () => {
    invalidate("Par de PCs alterado. Execute um novo teste.");
    if (state.attempt) { state.attempt.progress.lastRun = null; state.attempt.progress.stepId = null; persistAttempt(); }
    text("[data-lab-arp-title]", "Associações ARP neste evento");
    announce("Origem ou destino alterado. Execute um novo teste.");
  }));
  function showServiceResult(attempt,description){
    if(attempt.bench)apply({state:attempt.bench},`${description}: configuração atualizada.`);
    const result=attempt.result||attempt;
    state.result=state.exercise?exerciseEngine.presentResult(state.exercise.instance,result):result;
    state.index=state.result.events.length?0:-1;renderEvent();
    status.textContent=`${description}: ${result.message}`;
    if (state.attempt) {
      state.attempt.progress.lastRun = null;
      state.attempt.progress.stepId = `service:${description}`;
      state.attempt.progress.evidence = [...state.attempt.progress.evidence,
        {type: "service", summary: `${description}: ${result.message}`.slice(0, 500)}].slice(-40);
      persistAttempt();
    }
  }
  root.querySelector("[data-lab-dhcp-renew]").addEventListener("click",()=>showServiceResult(servicesEngine.renew(state.bench,sourceSelect.value),"DHCP"));
  root.querySelector("[data-lab-dns-query]").addEventListener("click",()=>showServiceResult(servicesEngine.resolve(state.bench,sourceSelect.value,root.querySelector("[data-lab-service-target]").value),"DNS"));
  root.querySelector("[data-lab-service-test]").addEventListener("click",()=>showServiceResult(servicesEngine.connect(state.bench,sourceSelect.value,
    root.querySelector("[data-lab-service-target]").value,root.querySelector("[data-lab-service-protocol]").value,
    Number(root.querySelector("[data-lab-service-port]").value)),"Serviço"));
  root.querySelector("[data-lab-test]").addEventListener("click", () => {
    if (state.running) return;
    state.running = true;
    try {
      invalidate("Calculando novo teste…");
      const adapted = model.adapt(state.bench, sourceSelect.value, destinationSelect.value);
      if (adapted.error) { status.textContent = adapted.error; announce(adapted.error); return; }
      state.result = simulator.simulate(adapted.input);
      if (state.exercise) state.result = exerciseEngine.presentResult(state.exercise.instance, state.result);
      if (state.result.status === "invalid") { status.textContent = state.result.message; announce(state.result.message); return; }
      state.index = 0; renderEvent();
      if (state.attempt) {
        state.attempt.progress.lastRun = {kind: "communication", index: 0, sourceId: sourceSelect.value, destinationId: destinationSelect.value};
        state.attempt.progress.stepId = "event:0";
        state.attempt.progress.evidence = [...state.attempt.progress.evidence,
          {type: "communication", summary: state.result.message || state.result.status}].slice(-40);
        persistAttempt();
      }
      announce(state.result.status === "interrupted" ? state.result.message : "Teste pronto. Use Próximo para acompanhar cada evento.");
    } finally { state.running = false; }
  });
  function persistEventPosition() {
    if (!state.attempt?.progress.lastRun) return;
    state.attempt.progress.lastRun.index = state.index;
    state.attempt.progress.stepId = `event:${state.index}`;
    persistAttempt();
  }
  root.querySelector("[data-lab-prev]").addEventListener("click", () => { if (state.index > 0) { state.index--; renderEvent(); persistEventPosition(); } });
  root.querySelector("[data-lab-next]").addEventListener("click", () => { if (state.result && state.index < state.result.events.length - 1) { state.index++; renderEvent(); persistEventPosition(); } });
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
      const saved = persistAttempt();
      let checked = null;
      if (saved && state.attempt && attempts) {
        try { checked = attempts.verify(state.attempt.attemptId); }
        catch (error) { attemptDirty = true; attemptMessage(`Verificação não salva: ${error.message}`, true); }
      }
      const verdict = checked ? checked.verdict : exerciseEngine.validateExercise(state.exercise.instance, state.bench);
      if (checked) state.attempt = checked.attempt;
      state.result = verdict.result;
      state.index = verdict.result.events.length ? verdict.result.events.length - 1 : -1;
      if (checked && state.index >= 0) {
        state.attempt.progress.lastRun = {kind: "verification", index: state.index,
          sourceId: state.exercise.instance.objective.sourceId, destinationId: state.exercise.instance.objective.destinationId};
        state.attempt.progress.stepId = `event:${state.index}`;
        persistAttempt();
      }
      renderEvent();
      if (state.index < 0) status.textContent = verdict.feedback;
      state.exercise.completed = verdict.complete && (!state.attempt || Boolean(checked));
      checkSolution.disabled = state.exercise.completed;
      exerciseFeedback.dataset.state = verdict.complete ? "success" : "error";
      exerciseFeedback.textContent = verdict.complete
        ? `${verdict.feedback} ${state.exercise.completed ? "Exercício concluído. Você pode gerar outro exercício." : "Solução correta, mas a conclusão não foi salva; libere o armazenamento e verifique novamente."}` : verdict.feedback;
      renderExercisePresentation(false, state.exercise.completed);
    } catch (error) {
      exerciseFeedback.dataset.state = "error";
      exerciseFeedback.textContent = `Não foi possível validar a bancada: ${error.message}`;
    } finally { state.running = false; }
  });
  root.querySelector("[data-lab-new-exercise]").addEventListener("click", () => {
    if (!state.exercise) return;
    const {exerciseId, difficulty, seed, mode} = state.exercise.instance;
    let fresh = nextExerciseSeed();
    if (fresh === seed) fresh = String(Number(fresh) + 1);
    const url = new URL(window.location.href);
    url.searchParams.set("seed", fresh);
    window.history.replaceState(null, "", url);
    try {
      const next = state.attempt && attempts ? attempts.newVariation(state.attempt.attemptId, fresh) : null;
      startExercise(exerciseId, fresh, difficulty, mode, next?.attemptId || null);
    }
    catch (error) { exerciseFeedback.dataset.state = "error"; exerciseFeedback.textContent = error.message; }
  });
  root.querySelector("[data-lab-reset]").addEventListener("click", () => {
    if (state.exercise) {
      const {exerciseId, seed, difficulty, mode} = state.exercise.instance;
      const id = state.attempt?.attemptId;
      if (id && attempts) attempts.restart(id);
      startExercise(exerciseId, seed, difficulty, mode, id || null);
      exerciseFeedback.textContent = "Exercício reiniciado com a mesma seed. Investigue novamente.";
      return;
    }
    presetFeedback.textContent = "";
    state.bench = model.createEmpty(); state.result = null; state.index = -1;
    resetTerminals();
    state.activeDevice = null; state.hoveredDevice = null; state.cursor = {x: .5, y: .5}; setMode("idle");
    syncConfigInputs(); scenarioName.value = ""; scenarioList.value = ""; refreshScenarios("");
    renderPair(); invalidate("Bancada reiniciada. Monte e conecte os equipamentos."); renderConfig(); announce("Bancada reiniciada.");
    scenarioMessage("Nova bancada. Cenários salvos permanecem disponíveis.");
  });
  window.addEventListener("resize", () => { drawWires(state.result?.events[state.index] || null); renderConfig(); });
  renderPresets(); renderPair(); renderConfig(); renderEvent(); refreshScenarios("");
  const parameters = new URLSearchParams(window.location.search);
  if (parameters.has("attempt")) {
    try { startExercise(null, null, null, "bench", parameters.get("attempt")); }
    catch (error) { exercisePanel.hidden = false; exerciseFeedback.dataset.state = "error";
      exerciseFeedback.textContent = `Tentativa preservada, mas não recuperada: ${error.message}`; }
  } else if (parameters.has("exercise")) {
    try {
      const seed = parameters.get("seed") || nextExerciseSeed();
      if (!parameters.has("seed")) {
        const url = new URL(window.location.href);
        url.searchParams.set("seed", seed);
        window.history.replaceState(null, "", url);
      }
      startExercise(parameters.get("exercise"), seed, parameters.get("difficulty") || "intermediate", parameters.get("mode") || "bench");
    } catch (error) {
      exercisePanel.hidden = false;
      exerciseFeedback.dataset.state = "error";
      exerciseFeedback.textContent = `Exercício indisponível: ${error.message}`;
    }
  }
})();
