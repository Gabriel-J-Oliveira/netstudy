(() => {
  "use strict";

  const memory = new Map();
  let active = null;
  const has = (list, value) => list.includes(value);
  const add = (list, value) => { if (!list.includes(value)) list.push(value); };

  class InvestigationWorkbench {
    constructor(root) {
      this.root = root; this.id = root.dataset.activityId; this.data = JSON.parse(document.getElementById("switch-workbench-data").textContent); this.board = window.NetStudySwitchBoard.boards.checkpoint; this.state = memory.get(this.id) || { actions: [], discovered: [], evidence: [], hostHtml: "", switchHtml: "", privileged: false };
      if (this.state.board) this.board.reset(this.state.board);
      if (this.data.hide_mac_table && !has(this.state.actions, "command:show mac address-table")) this.board.hideMacTable();
      if (this.data.scenario_key === "switch-a7" && !this.state.board) { this.board.port(7).egress = true; this.board.port(7).attention = true; this.board.port(7).last_event = "Tentativa de encaminhamento observada"; this.board.render(); }
      this.bind(); this.restoreTerminals(); this.render(); this.save();
    }
    bind() {
      this.root.addEventListener("switchboard:field", (event) => { this.record("field:" + event.detail.field); });
      this.root.addEventListener("switchboard:inspect", (event) => { this.record("port:" + event.detail.port); if (event.detail.port === 4 && event.detail.state.link_status === "down") this.discover("g4-down"); if (this.id === "6" && event.detail.port === 5) this.discover("mac-bb-g5"); });
      this.root.addEventListener("switchboard:selectmac", (event) => { this.record("mac:" + event.detail.mac); if (event.detail.mac.includes("BB")) this.discover(this.id === "6" ? "mac-bb-g5" : this.id === "7" || this.id === "8" || this.id === "9" ? "mac-bb-g4" : this.id === "10" ? (this.board.state.table[event.detail.mac].port === 6 ? "updated-bb-g6" : "initial-bb-g4") : ""); });
      this.root.addEventListener("switchboard:frame", () => { this.record("frame:run"); });
      this.root.querySelectorAll("[data-tool-tab]").forEach((button) => button.addEventListener("click", () => this.selectTab(button.dataset.toolTab)));
      this.root.querySelector("[data-host-form]")?.addEventListener("submit", (event) => { event.preventDefault(); this.hostCommand(); });
      this.root.querySelector("[data-switch-form]")?.addEventListener("submit", (event) => { event.preventDefault(); this.switchCommand(); });
      this.root.querySelectorAll("[data-workbench-action]").forEach((button) => button.addEventListener("click", () => this.action(button.dataset.workbenchAction)));
      this.root.querySelector("[data-evidence-candidates]")?.addEventListener("click", (event) => { const button = event.target.closest("[data-add-evidence]"); if (button) this.addEvidence(button.dataset.addEvidence); });
      this.root.querySelector("[data-scenario-reset]").addEventListener("click", () => { memory.delete(this.id); this.root.closest(".frame-checkpoint").querySelector("[data-reset-current-form]").requestSubmit(); });
      const builder = this.root.closest(".checkpoint-activity").querySelector("[data-builder-form]");
      builder?.addEventListener("submit", (event) => { const missingActions = this.requiredMissing(); const missingEvidence = this.evidenceMissing(); if (missingActions.length || missingEvidence.length) { event.preventDefault(); event.stopImmediatePropagation(); this.root.querySelector("[data-workbench-guidance]").textContent = missingEvidence.length ? "Sua conclusão ainda precisa das evidências relevantes coletadas na bancada." : "Complete a investigação no equipamento antes de concluir."; this.root.querySelector("[data-workbench-guidance]").classList.add("is-warning"); } }, true);
    }
    selectTab(name) { this.root.querySelectorAll("[data-tool-tab]").forEach((button) => button.setAttribute("aria-selected", String(button.dataset.toolTab === name))); this.root.querySelectorAll("[data-tool-panel]").forEach((panel) => { panel.hidden = panel.dataset.toolPanel !== name; }); }
    terminalLine(target, text, className = "") { const line = document.createElement("p"); line.textContent = text; if (className) line.className = className; target.appendChild(line); target.scrollTop = target.scrollHeight; }
    hostCommand() {
      const input = this.root.querySelector("[data-host-input]"); const output = this.root.querySelector("[data-host-output]"); const command = input.value.trim().toLowerCase(); const hostLabel = this.data.host_label || "PC-A"; this.terminalLine(output, hostLabel + "> " + input.value.trim(), "command-line"); input.value = "";
      if (command === "clear" || command === "cls") output.innerHTML = "";
      else if (command === "help") this.terminalLine(output, "ping <ip>\narp -a\nipconfig /all\nclear · cls · help");
      else if (command === "arp -a") { this.terminalLine(output, this.data.host_arp_empty ? "Interface: 192.168.10.10\nNenhuma entrada dinâmica para 192.168.10.20." : "Interface: 192.168.10.10\n192.168.10.20    BB-BB-BB-BB-BB-BB    dynamic"); this.record("command:arp -a"); this.discover("arp-bb"); }
      else if (command === "ipconfig /all") { this.terminalLine(output, "IPv4 Address: 192.168.10.10\nPhysical Address: AA-AA-AA-AA-AA-AA\nDefault Gateway: 192.168.10.1"); this.record("command:ipconfig /all"); }
      else if (command.startsWith("ping ")) { this.terminalLine(output, "Pinging 192.168.10.20\nRequest timed out.\nPackets: Sent = 1, Received = 0, Lost = 1"); this.record("command:ping 192.168.10.20"); }
      else this.terminalLine(output, "Esse comando pode ser útil em outros problemas, mas ainda não fornece evidência sobre a entrega Ethernet investigada.", "tool-feedback");
      this.saveTerminals(); this.save();
    }
    switchCommand() {
      const input = this.root.querySelector("[data-switch-input]"); const output = this.root.querySelector("[data-switch-output]"); const raw = input.value.trim(); const command = raw.toLowerCase(); const prefix = this.state.privileged ? "Switch# " : "Switch> "; this.terminalLine(output, prefix + raw, "command-line"); input.value = "";
      if (command === "clear" || command === "cls") output.innerHTML = "";
      else if (command === "enable") { this.state.privileged = true; this.root.querySelector("[data-switch-prompt]").textContent = "Switch#"; this.terminalLine(output, "Modo privilegiado ativado."); }
      else if (command === "help") this.terminalLine(output, "enable\nshow vlan brief\nshow mac address-table\nshow interfaces status\nshow interfaces Gi0/x\nshow interfaces Gi0/x switchport\nclear · cls · help");
      else if (command === "show vlan brief") { this.renderVlanBrief(output); this.board.toggleVlanView(true); this.record("command:show vlan brief"); }
      else if (command === "show mac address-table") { this.renderCliMacTable(output); this.board.revealMacTable(); this.record("command:show mac address-table"); if (["7", "8", "9"].includes(this.id)) this.discover("mac-bb-g4"); if (this.id === "10") this.discover(this.board.state.table[window.NetStudySwitchBoard.MAC.B]?.port === 6 ? "updated-bb-g6" : "initial-bb-g4"); if (this.id === "6") this.discover("mac-bb-g5"); }
      else if (command === "show interfaces status") { this.renderInterfacesStatus(output); this.board.state.revealLinks = true; this.board.render(); this.record("command:show interfaces status"); if (["8", "9", "10"].includes(this.id)) this.discover("g4-down"); }
      else if (/^show interfaces gi0\/[1-8] switchport$/.test(command)) { const number = Number(command.match(/gi0\/([1-8])/)[1]); this.renderSwitchport(output, number); this.board.inspect(number); this.record("command:" + command); }
      else if (/^show interfaces gi0\/[1-8]$/.test(command)) { const number = Number(command.slice(-1)); this.renderInterface(output, number); this.board.inspect(number); this.record("command:" + command); if (number === 4 && this.board.port(4).link_status === "down") this.discover("g4-down"); }
      else this.terminalLine(output, "Esse comando pode ser útil em outros problemas, mas ainda não fornece evidência sobre a entrega Ethernet investigada.", "tool-feedback");
      this.saveTerminals(); this.save();
    }
    renderCliMacTable(output) {
      this.terminalLine(output, "VLAN    Mac Address          Type        Ports");
      Object.entries(this.board.state.table).sort((a, b) => (a[1].vlan - b[1].vlan) || (a[1].port - b[1].port)).forEach(([key, entry]) => { const mac = entry.mac || key; const row = document.createElement("button"); row.type = "button"; row.className = "terminal-data-row"; row.dataset.cliMac = key; row.textContent = String(entry.vlan || 1).padEnd(8) + window.NetStudySwitchBoard.dotted(mac).padEnd(20) + "DYNAMIC     Gi0/" + entry.port; row.addEventListener("click", () => { this.board.selectMac(key); this.record("mac:" + mac); this.record("macvlan:" + (entry.vlan || 1) + ":" + mac); }); output.appendChild(row); });
    }
    renderVlanBrief(output) { this.terminalLine(output, "VLAN   Name        Status     Ports"); const groups = {}; Object.values(this.board.state.ports).filter((port) => port.link_status === "up").forEach((port) => { (groups[port.access_vlan] ||= []).push(port); }); [1, 10, 20].forEach((vlan) => { const ports = groups[vlan] || []; if (!ports.length && vlan !== 1) return; const row = document.createElement("button"); row.type = "button"; row.className = "terminal-data-row"; row.dataset.cliVlan = vlan; row.textContent = String(vlan).padEnd(7) + (vlan === 10 ? "USERS" : vlan === 20 ? "SERVERS" : "default").padEnd(12) + "active     " + ports.map((port) => port.name).join(", "); row.addEventListener("click", () => { this.record("vlan:" + vlan); if (ports[0]) this.board.inspect(Number(ports[0].name.split("/")[1])); }); output.appendChild(row); }); }
    renderSwitchport(output, number) { const port = this.board.port(number); this.terminalLine(output, "Name: " + port.name + "\nAdministrative Mode: static access\nOperational Mode: " + port.mode + "\nAccess Mode VLAN: " + port.access_vlan); }
    renderInterfacesStatus(output) { this.terminalLine(output, "Port    Status       Device"); Object.values(this.board.state.ports).forEach((port) => { this.terminalLine(output, port.name.padEnd(8) + (port.link_status === "up" ? "connected" : "notconnect").padEnd(13) + (port.connected_device || "-")); }); }
    renderInterface(output, number) { const port = this.board.port(number); this.terminalLine(output, "Interface " + port.name + "\nLink status: " + port.link_status + "\nMode: " + port.mode + "\nAccess VLAN: " + port.access_vlan + "\nRX frames: " + port.rx_frames + "\nTX frames: " + port.tx_frames + "\nConnected device: " + (port.connected_device || "-") + "\n\nMAC observed:\n" + (port.learned_macs.map(window.NetStudySwitchBoard.dotted).join("\n") || "-")); }
    action(name) {
      const MAC = window.NetStudySwitchBoard.MAC;
      if (name === "move-a") { this.board.moveDevice("PC-A", 1, 6); this.record("action:move-a"); this.feedback("PC-A foi movido para Gi0/6. A tabela ainda conserva AA → Gi0/1 até novo tráfego de origem AA."); }
      if (name === "generate-a") { if (this.board.port(6).connected_device !== "PC-A") { this.feedback("Mova PC-A antes de gerar o novo frame."); return; } this.board.receiveFrame({ source: MAC.A, destination: MAC.B, ingress: 6 }); this.record("action:generate-a"); this.discover("source-aa-g6"); }
      if (name === "generate-b") { this.board.receiveFrame({ source: MAC.B, destination: MAC.A, ingress: 6 }); this.record("action:generate-b"); this.discover("source-bb-g6"); this.discover("updated-bb-g6"); this.feedback("Novo frame Source BB entrou por Gi0/6. Observe a entrada marcada como ALTERADO."); }
      if (name === "send-a-b") { if (this.board.state.table[MAC.B]?.port !== 6) { this.feedback("Ainda não existe evidência nova que permita encaminhar BB por Gi0/6. Teste primeiro o tráfego de PC-B."); return; } this.board.receiveFrame({ source: MAC.A, destination: MAC.B, ingress: 1 }); this.record("action:send-a-b"); this.feedback("O novo frame A → B consultou BB → Gi0/6. TX de Gi0/6 aumentou em 1."); }
      if (name === "mark-boundary") { this.record("action:mark-boundary"); this.feedback("R1 foi marcado como fronteira entre a Ethernet local e a outra rede. PC-X é o receptor incoerente daquele mesmo frame."); }
      if (name === "arp-request") { this.board.receiveFrame({ source: MAC.A, destination: MAC.BROADCAST, ingress: 1, frameType: "ARP", payload: "Who has 192.168.10.20?" }); this.record("action:arp-request"); this.feedback("O Request foi replicado para Gi0/4 e Gi0/7. PC-B reconhece o IPv4; PC-C apenas recebeu a consulta."); }
      if (name === "arp-reply") { if (!has(this.state.actions, "action:arp-request")) { this.feedback("Execute primeiro o ARP Request."); return; } this.board.receiveFrame({ source: MAC.B, destination: MAC.A, ingress: 4, frameType: "ARP", payload: "192.168.10.20 is at BB" }); this.record("action:arp-reply"); this.feedback("O Reply ensinou BB → Gi0/4 e foi encaminhado somente a AA em Gi0/1."); }
      if (name === "data-frame") { if (!has(this.state.actions, "action:arp-reply")) { this.feedback("Observe primeiro o Reply que fornece BB e ensina sua porta ao switch."); return; } this.board.receiveFrame({ source: MAC.A, destination: MAC.B, ingress: 1, frameType: "Ethernet II", payload: "Dados" }); this.record("action:data-frame"); this.feedback("BB já é conhecido em Gi0/4: known unicast com uma única saída."); }
      if (name === "unknown-frame") { if (!has(this.state.actions, "action:data-frame")) { this.feedback("Complete primeiro o frame de dados para BB."); return; } this.board.receiveFrame({ source: MAC.A, destination: MAC.D, ingress: 1, frameType: "Ethernet II", payload: "Dados" }); this.record("action:unknown-frame"); this.feedback("DD é específico, mas desconhecido: unknown unicast com flooding."); }
      if (name === "arp-a") { this.board.receiveFrame({ source: MAC.A, destination: MAC.BROADCAST, ingress: 1, frameType: "ARP", payload: "Who has 192.168.10.20?" }); this.record("action:arp-a"); this.feedback("O Request permaneceu no contexto VLAN 10. Observe quais portas receberam."); }
      if (name === "set-vlan-4-10") { this.board.setAccessVlan(4, 10); this.record("action:set-vlan-4-10"); this.feedback("Mudança controlada: Gi0/4 agora é ACCESS VLAN 10."); }
      if (name === "retest-a") { if (this.board.port(4).access_vlan !== 10) { this.feedback("A porta de PC-B ainda não participa do mesmo contexto de A."); return; } this.board.receiveFrame({ source: MAC.A, destination: MAC.BROADCAST, ingress: 1, frameType: "ARP", payload: "Who has 192.168.10.20?" }); this.board.receiveFrame({ source: MAC.B, destination: MAC.A, ingress: 4, frameType: "ARP", payload: "192.168.10.20 is at BB" }); this.record("action:retest-a"); this.feedback("Agora B recebeu o Request, respondeu e o switch aprendeu BB no contexto VLAN 10."); }
      if (name === "arp-e") { this.board.receiveFrame({ source: MAC.E, destination: MAC.BROADCAST, ingress: 5, frameType: "ARP", payload: "Who has 192.168.10.10?" }); this.record("action:arp-e"); this.feedback("Com Gi0/5 na VLAN 20, somente portas VLAN 20 receberam o Request de E."); }
      if (name === "set-vlan-5-10") { delete this.board.state.table["20|" + MAC.E]; this.board.setAccessVlan(5, 10); this.record("action:set-vlan-5-10"); this.feedback("Mudança controlada: Gi0/5 agora é ACCESS VLAN 10."); }
      if (name === "retest-e") { if (this.board.port(5).access_vlan !== 10) { this.feedback("Gi0/5 ainda não está no contexto esperado."); return; } this.board.receiveFrame({ source: MAC.E, destination: MAC.BROADCAST, ingress: 5, frameType: "ARP", payload: "Who has 192.168.10.10?" }); this.board.receiveFrame({ source: MAC.A, destination: MAC.E, ingress: 1, frameType: "ARP", payload: "192.168.10.10 is at AA" }); this.record("action:retest-e"); this.feedback("A/B receberam o novo Request; A respondeu e EE foi aprendido na VLAN 10."); }
      if (name === "unicast-e-a") { if (!has(this.state.actions, "action:retest-e")) { this.feedback("Reteste primeiro o ARP após corrigir a VLAN."); return; } this.board.receiveFrame({ source: MAC.E, destination: MAC.A, ingress: 5, frameType: "Ethernet II", payload: "Dados" }); this.record("action:unicast-e-a"); this.feedback("E → A foi encaminhado como known unicast dentro da VLAN 10."); }
      this.render(); this.save();
    }
    feedback(text) { const target = this.root.querySelector("[data-action-feedback]"); if (target) target.textContent = text; }
    discover(id) { if (!id || !this.data.evidence?.some((item) => item.id === id)) return; add(this.state.discovered, id); this.renderEvidence(); this.save(); }
    addEvidence(id) { add(this.state.evidence, id); this.record("evidence:" + id); this.renderEvidence(); this.save(); }
    record(action) { add(this.state.actions, action); (this.data.evidence_triggers?.[action] || []).forEach((id) => this.discover(id)); this.renderChecklist(); this.save(); }
    requiredMissing() { return (this.data.required_actions || []).filter((action) => !has(this.state.actions, action)); }
    evidenceMissing() { return (this.data.required_evidence || []).filter((id) => !has(this.state.evidence, id)); }
    renderEvidence() {
      const candidates = this.root.querySelector("[data-evidence-candidates]"); const list = this.root.querySelector("[data-evidence-list]"); if (!candidates || !list) return;
      candidates.innerHTML = ""; this.state.discovered.filter((id) => !has(this.state.evidence, id)).forEach((id) => { const item = this.data.evidence.find((candidate) => candidate.id === id); const button = document.createElement("button"); button.type = "button"; button.dataset.addEvidence = id; button.innerHTML = "<span>" + item.text + "</span><strong>+ Adicionar como evidência</strong>"; candidates.appendChild(button); });
      if (!candidates.children.length) candidates.innerHTML = "<p>Continue investigando ou todas as evidências descobertas já foram adicionadas.</p>";
      list.innerHTML = ""; this.state.evidence.forEach((id) => { const item = this.data.evidence.find((candidate) => candidate.id === id); const row = document.createElement("li"); row.innerHTML = "<span aria-hidden='true'>✓</span> " + item.text; list.appendChild(row); }); if (!list.children.length) list.innerHTML = "<li>Nenhuma evidência adicionada.</li>";
      this.root.querySelector("[data-evidence-count]").textContent = this.state.evidence.length + " / " + (this.data.required_evidence || []).length;
    }
    renderChecklist() { const list = this.root.querySelector("[data-action-checklist]"); if (!list) return; list.innerHTML = ""; (this.data.required_actions || []).forEach((action) => { const item = document.createElement("li"); item.className = has(this.state.actions, action) ? "is-done" : "is-pending"; item.textContent = (has(this.state.actions, action) ? "✓ " : "○ ") + this.actionLabel(action); list.appendChild(item); }); }
    actionLabel(action) { if (action.startsWith("command:")) return "Coletar: " + action.replace("command:", ""); if (action.startsWith("field:")) { const field = action.replace("field:", ""); return field === "vlan" ? "Inspecionar contexto VLAN" : "Inspecionar " + field + " MAC"; } if (action.startsWith("port:")) return "Inspecionar Gi0/" + action.replace("port:", ""); if (action.startsWith("mac:")) return "Selecionar entrada MAC relevante"; if (action.startsWith("macvlan:")) return "Selecionar entrada VLAN + MAC relevante"; if (action === "frame:run") return "Executar o frame no switch"; if (action.startsWith("action:")) return "Executar: " + action.replace("action:", "").replaceAll("-", " "); return action; }
    saveTerminals() { const host = this.root.querySelector("[data-host-output]"); const sw = this.root.querySelector("[data-switch-output]"); if (host) this.state.hostHtml = host.innerHTML; if (sw) this.state.switchHtml = sw.innerHTML; }
    restoreTerminals() { const host = this.root.querySelector("[data-host-output]"); const sw = this.root.querySelector("[data-switch-output]"); if (host && this.state.hostHtml) host.innerHTML = this.state.hostHtml; if (sw && this.state.switchHtml) { sw.innerHTML = this.state.switchHtml; sw.querySelectorAll("[data-cli-mac]").forEach((row) => row.addEventListener("click", () => { const key = row.dataset.cliMac; const entry = this.board.state.table[key]; this.board.selectMac(key); this.record("mac:" + (entry?.mac || key)); if (entry?.vlan) this.record("macvlan:" + entry.vlan + ":" + entry.mac); })); } if (this.state.privileged && this.root.querySelector("[data-switch-prompt]")) this.root.querySelector("[data-switch-prompt]").textContent = "Switch#"; }
    save() { this.state.board = this.board.snapshot(); memory.set(this.id, this.state); }
    render() { this.renderChecklist(); this.renderEvidence(); const missing = this.requiredMissing().length + this.evidenceMissing().length; const guidance = this.root.querySelector("[data-workbench-guidance]"); if (guidance && missing === 0) { guidance.textContent = "Evidências e ações necessárias concluídas. Monte sua conclusão abaixo."; guidance.classList.add("is-ready"); } }
  }

  function init(scope = document) { const root = scope.querySelector("[data-switch-workbench]"); if (!root || root.dataset.workbenchReady) return null; root.dataset.workbenchReady = "true"; active = new InvestigationWorkbench(root); return active; }
  function capture() { if (active) { active.saveTerminals(); active.save(); } }
  function discard(id) { memory.delete(id || active?.id); }
  window.NetStudySwitchWorkbench = { init, capture, discard, memory }; init();
})();
