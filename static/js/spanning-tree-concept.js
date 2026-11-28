(() => {
  "use strict";
  const root = document.querySelector("[data-spanning-tree]");
  if (!root) return;

  // RSTP comparison is a user-stepped didactic clock; no timers or autoplay.
  const rstp = root.querySelector("[data-rstp-lab]");
  if (rstp) {
    const tick = rstp.querySelector("[data-rstp-tick]");
    const status = rstp.querySelector("[data-rstp-status]");
    let time = null;
    const reset = () => {
      time = null; tick.disabled = true;
      rstp.querySelectorAll(".rstp-network").forEach((network) => network.classList.remove("is-disrupted"));
      rstp.querySelectorAll("[data-rstp-state]").forEach((el) => { el.textContent = "Forwarding"; });
      rstp.querySelectorAll("[data-rstp-loss]").forEach((el) => { el.textContent = "0"; });
      rstp.querySelectorAll("[data-rstp-uptime]").forEach((el) => { el.textContent = "100%"; });
      rstp.querySelectorAll("[data-rstp-message]").forEach((el) => { el.textContent = "Rede estável; tráfego passa."; });
      rstp.querySelectorAll("[data-rstp-bpdu]").forEach((marker) => { marker.classList.remove("visible"); marker.setAttribute("cx", "70"); marker.setAttribute("cy", "52"); });
      rstp.querySelector("[data-rstp-alt]").textContent = "Alternate · Discarding";
      rstp.querySelectorAll("[data-rstp-marker]").forEach((el) => el.removeAttribute("aria-current"));
      status.textContent = "Os dois cenários estão estáveis. Inicie a falha e avance no seu ritmo.";
    };
    rstp.querySelector("[data-rstp-fail]").addEventListener("click", () => {
      time = 0; tick.disabled = false;
      rstp.querySelectorAll(".rstp-network").forEach((network) => network.classList.add("is-disrupted"));
      rstp.querySelectorAll("[data-rstp-state]").forEach((el) => { el.textContent = "Falha · sem caminho"; });
      rstp.querySelector("[data-rstp-alt]").textContent = "Alternate · Discarding · negociando";
      rstp.querySelectorAll("[data-rstp-bpdu]").forEach((marker) => marker.classList.add("visible"));
      rstp.querySelectorAll("[data-rstp-message]").forEach((el) => { el.textContent = "Tentativa de comunicação perdida."; });
      rstp.querySelector('[data-rstp-marker="0"]').setAttribute("aria-current", "step");
      status.textContent = "A mesma falha foi aplicada às duas redes. Avance um segundo didático por clique.";
    });
    tick.addEventListener("click", () => {
      if (time === null) return;
      time = Math.min(30, time + 1);
      const stpReady = time >= 30;
      const rstpReady = time >= 4;
      rstp.querySelector('[data-rstp-side="stp"] [data-rstp-state]').textContent = stpReady ? "Forwarding · recuperada" : time >= 15 ? "Learning" : time >= 1 ? "Listening" : "Falha · sem caminho";
      rstp.querySelector("[data-rstp-alt]").textContent = rstpReady ? "Alternate promovida · Forwarding" : time >= 3 ? "Learning" : time >= 2 ? "Agreement · sincronizando" : time >= 1 ? "Proposal · sincronizando" : "Alternate · Discarding";
      rstp.querySelector('[data-rstp-side="stp"] [data-rstp-loss]').textContent = String(Math.min(time, 30));
      rstp.querySelector('[data-rstp-side="rstp"] [data-rstp-loss]').textContent = String(Math.min(time, 4));
      rstp.querySelector('[data-rstp-side="stp"] [data-rstp-uptime]').textContent = `${Math.round((30 - Math.min(time, 30)) / 30 * 100)}%`;
      rstp.querySelector('[data-rstp-side="rstp"] [data-rstp-uptime]').textContent = `${Math.round((30 - Math.min(time, 4)) / 30 * 100)}%`;
      rstp.querySelector('[data-rstp-side="stp"] [data-rstp-message]').textContent = stpReady ? "Caminho alternativo Forwarding após etapas clássicas." : time >= 15 ? "Tentativa perdida; porta em Learning." : "Tentativa perdida; transição clássica em andamento.";
      rstp.querySelector('[data-rstp-side="rstp"] [data-rstp-message]').textContent = rstpReady ? "Caminho alternativo Forwarding após sincronização rápida." : time >= 2 ? "Agreement recebido; negociação prossegue." : "BPDU Proposal no caminho alternativo.";
      rstp.querySelectorAll("[data-rstp-bpdu]").forEach((marker) => {
        marker.classList.toggle("visible", time < 4);
        marker.setAttribute("cx", time % 2 ? "180" : "290");
        marker.setAttribute("cy", time % 2 ? "90" : "52");
      });
      rstp.querySelectorAll("[data-rstp-marker]").forEach((el) => {
        const mark = Number(el.dataset.rstpMarker);
        if (mark <= time) el.setAttribute("aria-current", "step"); else el.removeAttribute("aria-current");
      });
      status.textContent = `Relógio didático: ${time}s. RSTP ${rstpReady ? "recuperada" : "em transição"}; STP clássico ${stpReady ? "recuperado" : "em transição"}. A contagem ilustra a comparação e não promete tempos universais.`;
      if (stpReady) tick.disabled = true;
    });
    rstp.querySelector("[data-rstp-reset]").addEventListener("click", reset);
    rstp.querySelector("[data-rstp-check]").addEventListener("click", () => {
      const answer = rstp.querySelector("#rstp-prediction").value;
      rstp.querySelector("[data-rstp-feedback]").textContent = answer === "Discarding" ? "Correto. Discarding não encaminha dados; a porta pode avançar após as condições de sincronização." : answer ? "Forwarding encaminha dados. Durante a recuperação, procure o estado que ainda não encaminha." : "Escolha uma previsão antes de conferir.";
    });
  }

  // The four-stage MSTP story and the optional workbench share the same calculations.
  const mst = root.querySelector("[data-mstp-lab]");
  if (mst && window.NetStudyStpModel) {
    const demo = mst.querySelector("[data-mstp-demo]");
    const svg = mst.querySelector("[data-mstp-topology]");
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const baseSwitches = ["sw1", "sw2", "sw3"].map((id, index) => ({ id, name: id.toUpperCase(), mac: `00:00:00:00:00:0${index + 1}`, priority: 32768 }));
    const links = [
      { id: "sw1-sw2", a: { switchId: "sw1", portId: "Gi0/2" }, b: { switchId: "sw2", portId: "Gi0/1" }, cost: 4 },
      { id: "sw1-sw3", a: { switchId: "sw1", portId: "Gi0/3" }, b: { switchId: "sw3", portId: "Gi0/1" }, cost: 4 },
      { id: "sw2-sw3", a: { switchId: "sw2", portId: "Gi0/2" }, b: { switchId: "sw3", portId: "Gi0/2" }, cost: 4 },
    ];
    const endpointByLink = {
      "sw1-sw2": [{ switchId: "sw1", portId: "Gi0/2" }, { switchId: "sw2", portId: "Gi0/1" }],
      "sw1-sw3": [{ switchId: "sw1", portId: "Gi0/3" }, { switchId: "sw3", portId: "Gi0/1" }],
      "sw2-sw3": [{ switchId: "sw2", portId: "Gi0/2" }, { switchId: "sw3", portId: "Gi0/2" }],
    };
    const narratives = {
      1: { kicker: "ETAPA 1 · VLAN 10 → MSTI 1", title: "Uma árvore lógica sem ciclo", description: "A VLAN 10 usa a MSTI 1, cuja Root Bridge é SW1. Os dois caminhos a partir da raiz encaminham; SW2—SW3 fica bloqueado nesta instância, mas o cabo continua conectado.", activity: "PC-A envia pela árvore azul e PC-B recebe pela VLAN 10." },
      2: { kicker: "ETAPA 2 · VLAN 20 → MSTI 2", title: "Uma segunda árvore sobre os mesmos cabos", description: "Agora a VLAN 20 usa a MSTI 2, com SW3 como raiz. A infraestrutura física não muda; muda a decisão lógica. SW1—SW2 fica bloqueado nesta instância.", activity: "PC-C envia pela árvore laranja e PC-D recebe pela VLAN 20." },
      3: { kicker: "ETAPA 3 · DUAS INSTÂNCIAS ATIVAS", title: "Dois caminhos lógicos, uma infraestrutura", description: "SW1 é raiz da MSTI 1 e SW3 é raiz da MSTI 2. Cada árvore encaminha pelos seus enlaces Forwarding e exclui o caminho bloqueado; assim, os fluxos coexistem sem formar um ciclo ativo.", activity: "PC-A ↔ PC-B usa azul. PC-C ↔ PC-D usa laranja. Os estados são independentes por instância." },
      4: { kicker: "ETAPA 4 · FALHA E RECUPERAÇÃO", title: "Uma falha física, árvores recalculadas", description: "O cabo SW1—SW2 é interrompido. A MSTI 1 passa a usar a alternativa por SW3; a MSTI 2 mantém sua árvore. O enlace aparece desconectado em vermelho, diferente de uma porta Blocking que mantém o cabo conectado.", activity: "As duas VLANs continuam conectadas após o recálculo. Nenhum caminho encaminha em ciclo." },
    };
    let stage = 1, viewedInstance = "1", playing = false, timer = null, advanced = false;
    const getMaps = () => ({ 10: mst.querySelector('[data-mstp-map="10"]').value, 20: mst.querySelector('[data-mstp-map="20"]').value });
    const getFailure = () => advanced ? (mst.querySelector("[data-mstp-failure]").value || null) : (stage === 4 ? "sw1-sw2" : null);
    const getResults = (failure = getFailure()) => Object.fromEntries(["1", "2"].map((instance) => {
      const rootId = mst.querySelector(`[data-mstp-root="${instance}"]`).value;
      const switches = baseSwitches.map((sw) => ({ ...sw, priority: sw.id === rootId ? 0 : 32768 }));
      return [instance, window.NetStudyStpModel.calculate(switches, links, failure)];
    }));
    const displayLinks = (ids) => ids?.length ? ids.map((id) => id.toUpperCase().replaceAll("-", "—")).join(" · ") : "nenhum";
    const activeInstances = () => advanced ? ["1", "2"] : stage === 1 ? ["1"] : stage === 2 ? [viewedInstance] : ["1", "2"];
    const stopMotion = () => {
      playing = false;
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      demo.classList.remove("is-playing");
      svg.pauseAnimations?.();
      mst.querySelector("[data-mstp-play]").disabled = reducedMotion;
      mst.querySelector("[data-mstp-pause]").disabled = true;
    };
    const render = () => {
      const failure = getFailure(), maps = getMaps(), results = getResults(failure);
      const visible = activeInstances();
      mst.querySelector("[data-mstp-map-summary]").textContent = `10 → MSTI ${maps[10]} · 20 → MSTI ${maps[20]}`;
      mst.querySelector("[data-mstp-demo-roots]").textContent = visible.map((instance) => `Raiz MSTI ${instance}: ${results[instance].rootId?.toUpperCase() || "sem raiz conectada"}`).join(" · ");
      const vlanFocus = stage === 1 ? "10" : stage === 2 ? ([10, 20].filter((vlan) => maps[vlan] === viewedInstance).join(" e ") || "nenhuma") : "10 e 20";
      const treeDescription = visible.map((instance) => {
        const vlans = [10, 20].filter((vlan) => maps[vlan] === instance).join(", ") || "sem VLANs mapeadas";
        return `MSTI ${instance} · VLAN ${vlans} · raiz ${results[instance].rootId?.toUpperCase() || "indisponível"} · Forwarding ${displayLinks(results[instance].forwardingLinkIds)} · Blocking ${displayLinks(results[instance].blockedLinkIds)}`;
      }).join(". ");
      mst.querySelector("[data-mstp-demo-result]").textContent = `${stage === 4 ? "Após a falha: " : `Tráfego da VLAN ${vlanFocus}: `}${treeDescription}.`;
      mst.querySelectorAll("[data-mstp-instance-root]").forEach((el) => { el.textContent = results[el.dataset.mstpInstanceRoot].rootId?.toUpperCase() || "sem raiz conectada"; });
      mst.querySelectorAll("[data-mstp-forwarding]").forEach((el) => { el.textContent = displayLinks(results[el.dataset.mstpForwarding].forwardingLinkIds); });
      mst.querySelectorAll("[data-mstp-blocked]").forEach((el) => { el.textContent = displayLinks(results[el.dataset.mstpBlocked].blockedLinkIds); });
      mst.querySelectorAll("[data-mstp-vlans]").forEach((el) => { el.textContent = [10, 20].filter((vlan) => maps[vlan] === el.dataset.mstpVlans).join(", ") || "nenhuma"; });
      mst.querySelectorAll("[data-mst-instance-path]").forEach((line) => {
        const instance = line.dataset.mstInstancePath, id = line.dataset.mstLink, result = results[instance];
        line.classList.toggle("msti-forwarding", result.forwardingLinkIds?.includes(id));
        line.classList.toggle("msti-blocked", result.blockedLinkIds?.includes(id));
        line.classList.toggle("msti-disconnected", id === failure);
        line.classList.toggle("msti-hidden", !visible.includes(instance));
      });
      mst.querySelectorAll("[data-mstp-port]").forEach((port) => {
        const [a, b] = endpointByLink[port.dataset.mstpPort];
        const endpoint = [a, b].find((entry) => entry.switchId === port.dataset.mstpSwitch);
        const state = results[port.dataset.mstpInstance].ports[endpoint.switchId][endpoint.portId]?.state.toLowerCase().replaceAll(" ", "-") || "disabled";
        port.setAttribute("class", `mstp-port ${state}${failure === port.dataset.mstpPort ? " disconnected" : ""}${visible.includes(port.dataset.mstpInstance) ? "" : " msti-hidden"}`);
      });
      mst.querySelectorAll("[data-mstp-frame]").forEach((frame) => {
        const instance = frame.dataset.mstpFrame;
        const active = visible.includes(instance);
        frame.classList.toggle("visible", active);
      });
      mst.querySelectorAll("[data-mst-switch]").forEach((node) => {
        const id = node.dataset.mstSwitch;
        const roots = visible.filter((instance) => results[instance].rootId === id);
        node.classList.toggle("is-root", roots.length > 0);
        const badge = node.querySelector("[data-mstp-root-badge]");
        badge.textContent = roots.length ? `ROOT · MSTI ${roots.join(" + ")}` : "Bridge";
      });
      mst.querySelectorAll("[data-mstp-bubble]").forEach((bubble) => {
        const id = bubble.dataset.mstpBubble;
        const show = stage === 3 || stage === 4 ? id === "sw1" || id === "sw3" : (stage === 1 && id === "sw1") || (stage === 2 && id === "sw3");
        bubble.classList.toggle("visible", show);
        const phrase = stage === 4 ? (id === "sw1" ? "Recalculei a árvore 1 pela alternativa." : "Minha árvore 2 continua ativa.") : id === "sw1" ? "Para a instância 1, minha raiz é SW1." : "Para a instância 2, minha raiz é SW3.";
        bubble.querySelector("text").textContent = phrase;
      });
      mst.querySelectorAll("[data-mstp-pc]").forEach((pc) => {
        const isActive = stage === 3 || stage === 4 || pc.dataset.vlan === (stage === 1 ? "10" : stage === 2 ? "20" : "");
        pc.classList.toggle("active", isActive);
        const status = pc.querySelector("[data-mstp-pc-state]");
        status.textContent = !isActive ? `aguarda VLAN ${pc.dataset.vlan}` : stage === 1 || stage === 2 ? (pc.dataset.vlan === (stage === 1 ? "10" : "20") ? "envia / recebe" : "") : stage === 4 ? "comunicação retomada" : "tráfego ativo";
      });
      const cut = mst.querySelector("[data-mstp-cut]");
      cut.classList.toggle("visible", Boolean(failure));
      cut.dataset.linkFailed = failure || "";
      const stageInfo = narratives[stage];
      demo.dataset.stage = String(stage);
      mst.querySelector("[data-mstp-stage-kicker]").textContent = advanced ? "EXPERIMENTE VOCÊ MESMO · CONFIGURAÇÃO ATUAL" : stageInfo.kicker;
      mst.querySelector("[data-mstp-stage-title]").textContent = advanced ? "Observe como a árvore responde" : stageInfo.title;
      const viewDescription = stage === 2 && viewedInstance === "1"
        ? "A VLAN 10 segue na MSTI 1, cuja raiz é SW1. Compare com a MSTI 2: ela usa SW3 como raiz e pode bloquear outra porta, embora os cabos sejam os mesmos."
        : stageInfo.description;
      mst.querySelector("[data-mstp-stage-description]").textContent = advanced ? "Os estados, as raízes e os enlaces destacados são recalculados pelo modelo STP existente; nenhuma regra de encaminhamento é criada pelo desenho." : viewDescription;
      mst.querySelector("[data-mstp-activity]").textContent = advanced ? (failure ? `Enlace ${failure.toUpperCase().replaceAll("-", "—")} desconectado; as instâncias foram recalculadas.` : "Altere uma opção para recalcular e observar as árvores nesta topologia.") : stageInfo.activity;
      mst.querySelector("[data-mstp-conclusion]").hidden = !(!advanced && stage === 4);
      mst.querySelector("[data-mstp-prev]").disabled = advanced || stage <= 1 || playing;
      mst.querySelector("[data-mstp-next]").disabled = advanced || stage >= 4 || playing;
      mst.querySelector("[data-mstp-play]").disabled = reducedMotion || advanced || stage >= 4 || playing;
      mst.querySelector("[data-mstp-pause]").disabled = !playing;
      mst.querySelector("[data-mstp-instance-switch]").hidden = advanced || stage !== 2;
      mst.querySelectorAll("[data-mstp-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mstpView === viewedInstance)));
      mst.querySelectorAll("[data-mstp-stage-marker]").forEach((marker) => {
        marker.toggleAttribute("aria-current", Number(marker.dataset.mstpStageMarker) === stage);
        marker.classList.toggle("passed", Number(marker.dataset.mstpStageMarker) < stage);
      });
      const motionOne = mst.querySelector('[data-mstp-motion="1"]'), motionTwo = mst.querySelector('[data-mstp-motion="2"]');
      motionOne.setAttribute("dur", `${3.6 / Number(mst.querySelector("[data-mstp-speed]").value)}s`);
      motionTwo.setAttribute("dur", `${3.2 / Number(mst.querySelector("[data-mstp-speed]").value)}s`);
      const viaBottom = failure === "sw1-sw2";
      mst.querySelector("#mstp-route-one").setAttribute("d", viaBottom ? "M153 131L215 186L308 270L440 370L499 415L560 370L692 270L785 186L847 131" : "M153 131L215 186L370 198L500 214L630 198L785 186L847 131");
      mst.querySelector("[data-mstp-map-summary]").textContent = `10 → MSTI ${maps[10]} · 20 → MSTI ${maps[20]}`;
      const feedback = mst.querySelector("[data-mstp-feedback]");
      feedback.textContent = failure ? `Falha física em ${failure.toUpperCase().replaceAll("-", "—")}; o modelo recalculou cada instância pela topologia conectada. A representação não simula interoperabilidade entre fabricantes.` : "Árvores calculadas separadamente pelo modelo STP. VLANs podem compartilhar uma MSTI; uma instância não é obrigatória para cada VLAN.";
    };
    const setStage = (nextStage) => {
      stopMotion();
      advanced = false;
      stage = Math.max(1, Math.min(4, nextStage));
      if (stage === 4) mst.querySelector("[data-mstp-failure]").value = "sw1-sw2";
      else mst.querySelector("[data-mstp-failure]").value = "";
      viewedInstance = stage === 2 ? "2" : "1";
      render();
    };
    const startMotion = () => {
      if (reducedMotion || advanced || stage >= 4 || playing) return;
      playing = true;
      svg.unpauseAnimations?.();
      mst.querySelectorAll("[data-mstp-frame] animateMotion").forEach((motion) => motion.beginElement?.());
      demo.classList.add("is-playing");
      render();
      const speed = Number(mst.querySelector("[data-mstp-speed]").value);
      const advance = () => {
        if (stage >= 4) { stopMotion(); render(); return; }
        stage += 1;
        if (stage === 2) viewedInstance = "2";
        render();
        if (stage >= 4) { stopMotion(); render(); }
        else timer = window.setTimeout(advance, Math.round(7000 / speed));
      };
      timer = window.setTimeout(advance, Math.round(7000 / speed));
    };
    mst.querySelector("[data-mstp-prev]").addEventListener("click", () => setStage(stage - 1));
    mst.querySelector("[data-mstp-next]").addEventListener("click", () => setStage(stage + 1));
    mst.querySelector("[data-mstp-play]").addEventListener("click", startMotion);
    mst.querySelector("[data-mstp-pause]").addEventListener("click", () => { stopMotion(); render(); });
    mst.querySelector("[data-mstp-demo-reset]").addEventListener("click", () => {
      mst.querySelector('[data-mstp-map="10"]').value = "1"; mst.querySelector('[data-mstp-map="20"]').value = "2";
      mst.querySelector('[data-mstp-root="1"]').value = "sw1"; mst.querySelector('[data-mstp-root="2"]').value = "sw3";
      mst.querySelector("[data-mstp-failure]").value = ""; advanced = false; setStage(1);
    });
    mst.querySelectorAll("[data-mstp-view]").forEach((button) => button.addEventListener("click", () => { viewedInstance = button.dataset.mstpView; render(); }));
    mst.querySelector("[data-mstp-speed]").addEventListener("change", render);
    mst.querySelectorAll(".mstp-controls select").forEach((select) => select.addEventListener("change", () => { advanced = true; stopMotion(); render(); }));
    mst.querySelector("[data-mstp-reset]").addEventListener("click", () => {
      mst.querySelector('[data-mstp-map="10"]').value = "1"; mst.querySelector('[data-mstp-map="20"]').value = "2";
      mst.querySelector('[data-mstp-root="1"]').value = "sw1"; mst.querySelector('[data-mstp-root="2"]').value = "sw3";
      mst.querySelector("[data-mstp-failure]").value = ""; advanced = false; setStage(1);
    });
    mst.querySelector("[data-mstp-advanced]").addEventListener("toggle", (event) => { if (event.target.open) { advanced = true; stopMotion(); render(); } });
    mst.querySelector("[data-mstp-check]").addEventListener("click", () => {
      const answer = mst.querySelector("#mstp-prediction").value;
      mst.querySelector("[data-mstp-prediction-feedback]").textContent = answer === "no" ? "Correto. VLANs podem compartilhar uma MSTI e a mesma árvore lógica." : answer ? "MSTP permite que várias VLANs compartilhem uma instância. Uma árvore exclusiva por VLAN não é obrigatória." : "Escolha uma previsão.";
    });
    if (reducedMotion) mst.querySelector("[data-mstp-play]").setAttribute("aria-label", "Reprodução desativada pela preferência de movimento reduzido; avance manualmente pelas etapas");
    render();
  }

  // Compact manual scenes share one stage; no scene starts running on its own.
  const protection = root.querySelector("[data-st-protection]");
  if (protection) {
    const scenes = {
      edge: { title: "Edge / PortFast", normal: "Uma porta de borda voltada ao host pode chegar rapidamente a Forwarding. Não aplique sem proteção em enlaces que podem ligar switches.", trigger: "Conectar um switch pode formar um caminho redundante.", effect: "Porta de borda chega rapidamente a Forwarding; isso pode abrir risco de loop se o vizinho for um switch.", state: "forwarding" },
      bpdu: { title: "BPDU Guard", normal: "Porta de borda protegida aguarda o dispositivo final.", trigger: "Conectar switch e receber BPDU inesperada.", effect: "Na implementação Cisco representada, BPDU Guard desativa a porta em err-disabled; a recuperação depende da configuração.", state: "err-disabled" },
      root: { title: "Root Guard", normal: "A porta protegida não deve aceitar informação superior para mudar a raiz por este segmento.", trigger: "Receber BPDU superior de um switch com Bridge ID menor.", effect: "A porta protegida entra em root-inconsistent enquanto a informação superior persistir; a raiz não muda por esse segmento.", state: "root-inconsistent" },
      loop: { title: "Loop Guard", normal: "Porta não-designada recebe BPDUs esperadas e permanece sem encaminhar dados.", trigger: "Interromper a recepção de BPDUs esperadas.", effect: "A porta fica loop-inconsistent/sem encaminhamento em vez de transitar indevidamente para Forwarding; rótulos variam por fabricante.", state: "loop-inconsistent" },
    };
    let selected = "edge", triggered = false;
    const render = () => {
      const item = scenes[selected];
      protection.querySelectorAll("[data-protection-scene]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.protectionScene === selected)));
      protection.querySelector("[data-protection-title]").textContent = item.title;
      protection.querySelector("[data-protection-explanation]").textContent = item.normal;
      protection.querySelector("[data-protection-event]").textContent = triggered ? item.effect : `Estado normal: ${item.normal}`;
      protection.querySelector("[data-protection-stage]").dataset.state = triggered ? item.state : "normal";
      protection.querySelector("[data-protection-device='right']").textContent = selected === "edge" ? "PC / SW?" : selected === "root" ? "SW novo · Bridge ID superior" : selected === "loop" ? "BPDU ausente" : "SW novo · BPDU";
      protection.querySelector("[data-protection-trigger]").textContent = triggered ? "Evento aplicado" : item.trigger;
      protection.querySelector("[data-protection-trigger]").disabled = triggered;
    };
    protection.querySelectorAll("[data-protection-scene]").forEach((button) => button.addEventListener("click", () => { selected = button.dataset.protectionScene; triggered = false; render(); }));
    protection.querySelector("[data-protection-trigger]").addEventListener("click", () => { triggered = true; render(); });
    protection.querySelector("[data-protection-reset]").addEventListener("click", () => { triggered = false; render(); });
    render();
  }

  const association = root.querySelector("[data-st-association-check]");
  association?.addEventListener("click", () => {
    const answer = root.querySelector("#st-association").value;
    root.querySelector("[data-st-association-feedback]").textContent = answer === "bridge" ? "Correto. O menor Bridge ID é eleito Root Bridge; custo compara caminhos até essa raiz." : answer ? "Root Path Cost compara caminhos até a raiz; a eleição compara Bridge IDs." : "Selecione uma opção.";
  });

  const checkpoint = root.querySelector("[data-st-checkpoint]");
  const data = document.getElementById("spanning-tree-questions");
  if (!checkpoint || !data) return;
  const questions = JSON.parse(data.textContent);
  let index = 0, answered = false;
  const show = () => {
    answered = false;
    checkpoint.querySelector("[data-count]").textContent = `Questão ${index + 1} de ${questions.length}`;
    checkpoint.querySelector("[data-progress]").value = index;
    checkpoint.querySelector("[data-question]").textContent = questions[index].prompt;
    checkpoint.querySelector("[data-feedback]").textContent = "";
    checkpoint.querySelector("[data-next]").disabled = true;
    checkpoint.querySelector("[data-options]").replaceChildren(...questions[index].options.map((label, optionIndex) => {
      const button = document.createElement("button"); button.type = "button"; button.textContent = label;
      button.addEventListener("click", () => { answered = optionIndex === questions[index].correct; checkpoint.querySelector("[data-feedback]").textContent = questions[index].feedback[optionIndex]; checkpoint.querySelector("[data-next]").disabled = !answered; });
      return button;
    }));
  };
  checkpoint.querySelector("[data-next]").addEventListener("click", () => {
    if (!answered) return;
    index += 1;
    if (index < questions.length) { show(); checkpoint.querySelector("[data-options] button")?.focus(); return; }
    checkpoint.querySelector("[data-count]").textContent = `Checkpoint concluído · ${questions.length} de ${questions.length}`;
    checkpoint.querySelector("[data-progress]").value = questions.length;
    checkpoint.querySelector("[data-question]").textContent = "Compare os papéis, as instâncias e as proteções com as evidências da topologia.";
    checkpoint.querySelector("[data-feedback]").textContent = `Você concluiu as ${questions.length} situações.`;
    checkpoint.querySelector("[data-options]").replaceChildren(); checkpoint.querySelector("[data-next]").hidden = true;
    checkpoint.querySelector("[data-restart]").hidden = false; checkpoint.querySelector("[data-restart]").focus();
  });
  checkpoint.querySelector("[data-restart]").addEventListener("click", () => { index = 0; checkpoint.querySelector("[data-next]").hidden = false; checkpoint.querySelector("[data-restart]").hidden = true; show(); checkpoint.querySelector("[data-options] button")?.focus(); });
  show();
})();
