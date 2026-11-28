(() => {
  "use strict";
  const root = document.querySelector("[data-stp-lab]");
  const model = window.NetStudyStpModel;
  if (!root || !model) return;
  const bpduStatus = root.querySelector("[data-stp-bpdu-feedback]");
  if (bpduStatus) {
    bpduStatus.textContent = "Pronto para observar uma troca de informação de controle entre SW2 e SW1.";
  }
  const $ = (selector) => root.querySelector(selector);
  const switches = [
    { id: "sw1", name: "SW1", mac: "00:00:00:00:00:01", priority: 32768 },
    { id: "sw2", name: "SW2", mac: "00:00:00:00:00:02", priority: 32768 },
    { id: "sw3", name: "SW3", mac: "00:00:00:00:00:03", priority: 32768 },
  ];
  const links = [
    { id: "sw1-sw2", a: { switchId: "sw1", portId: "Gi0/2" }, b: { switchId: "sw2", portId: "Gi0/1" }, cost: 4 },
    { id: "sw1-sw3", a: { switchId: "sw1", portId: "Gi0/3" }, b: { switchId: "sw3", portId: "Gi0/1" }, cost: 19 },
    { id: "sw2-sw3", a: { switchId: "sw2", portId: "Gi0/2" }, b: { switchId: "sw3", portId: "Gi0/2" }, cost: 4 },
  ];
  const messages = {
    0: ["INÍCIO · TOPOLOGIA CONECTADA", "Preveja a raiz e os papéis das portas", "Os três switches estão conectados em triângulo. A redundância física existe; avance para observar os BPDUs e os cálculos.", "O cenário usa prioridades iguais e MACs distintos. A topologia tem até três enlaces; o modelo calcula as decisões sem animação automática."],
    1: ["ETAPA 1 · TROCA DE BPDUs", "As bridges compartilham informações de controle", "BPDUs circulam entre switches por todos os enlaces ativos, inclusive aquele que ficará em Blocking para dados de usuário.", "A troca de BPDUs permite comparar Bridge IDs e informações de custo. Nenhum cabo é removido nesta etapa."],
    2: ["ETAPA 2 · ELEIÇÃO DA ROOT BRIDGE", "O menor Bridge ID vence", "A prioridade configurada participa do Bridge ID; quando as prioridades empatam, o MAC desempata. O switch eleito torna-se referência da árvore.", "A posição visual do switch não determina a raiz. Confira o cálculo após registrar uma previsão."],
    3: ["ETAPA 3 · ROOT PATH COST", "Cada switch compara custos até a raiz", "O custo de um caminho é acumulado enlace a enlace. A menor soma oferece o melhor caminho até a Root Bridge.", "Na seleção de caminhos empatados, o STP usa critérios determinísticos de Bridge ID e identificadores de porta."],
    4: ["ETAPA 4 · PAPÉIS DAS PORTAS", "Root Port, Designated Port e Blocking", "Cada switch não raiz escolhe uma Root Port. Em cada segmento, uma Designated Port representa a melhor informação até a raiz; o caminho redundante restante fica em Blocking.", "Blocking é lógico: o enlace continua conectado e a porta continua recebendo BPDUs, mas não encaminha dados de usuário."],
    5: ["ETAPA 5 · ÁRVORE ESTÁVEL", "Todos os cabos seguem conectados; um caminho não encaminha dados", "A topologia física permanece triangular. A árvore lógica usa os enlaces em Forwarding e mantém um caminho redundante em Blocking.", "O STP preserva uma alternativa física sem deixar todos os caminhos formarem um ciclo ativo."],
    6: ["ETAPA 6 · FALHA FÍSICA", "O cabo escolhido foi desconectado", "A interface do enlace falho fica Disabled. O cálculo usa somente as conexões que continuam ativas.", "Esta mudança é diferente de Blocking: aqui há desconexão física, então não há troca de BPDUs nesse cabo."],
    7: ["ETAPA 7 · RECONVERGÊNCIA", "Uma porta pode passar por estados transitórios", "No STP clássico, uma porta selecionada para recuperar conectividade percorre Listening e Learning antes de Forwarding.", "Os estados aparecem como sequência didática, sem temporizador nem promessa de tempo exato. O caminho de dados não é tratado como recuperado antes de Forwarding."],
    8: ["ETAPA 8 · CAMINHO RECUPERADO", "A árvore lógica se estabilizou após a mudança", "O caminho redundante disponível pode encaminhar após o recálculo e a transição de estados. A falha física continua visível até você restaurar o cabo.", "Ao restaurar o enlace, o STP deve recalcular novamente; a simulação exige outro avanço manual."],
  };
  const state = { stage: 0, failedLinkId: null, result: null, recoveryPort: null, predictionChecked: false, restoring: false, frameAnimationKey: null, playTimer: null };

  function readConfiguration() {
    const configuredSwitches = switches.map((sw) => ({ ...sw, priority: Number($(`[data-stp-priority="${sw.id}"]`).value) }));
    const configuredLinks = links.map((link) => ({ ...link, cost: Number($(`[data-stp-cost="${link.id}"]`).value) }));
    return { switches: configuredSwitches, links: configuredLinks };
  }
  function updateCalculation() {
    const config = readConfiguration();
    state.result = model.calculate(config.switches, config.links, state.failedLinkId);
    config.switches.forEach((sw) => {
      const meta = $(`[data-stp-node-meta="${sw.id}"]`);
      if (meta) meta.textContent = `${sw.priority} · MAC ...:${sw.mac.slice(-2)}`;
    });
    if (state.result.status === "invalid" || state.result.status === "disconnected") {
      $(`[data-stp-status]`).textContent = state.result.reason || "Há switches sem caminho ativo até a raiz nesta configuração.";
    }
  }
  function currentStageDetails() { return messages[state.stage]; }
  function fillFailureChoices() {
    const select = $(`[data-stp-failure-link]`);
    const eligible = links.filter((link) => !state.failedLinkId && state.result.forwardingLinkIds?.includes(link.id));
    select.replaceChildren(...eligible.map((link) => {
      const option = document.createElement("option");
      option.value = link.id;
      option.textContent = `${link.id.toUpperCase().replaceAll("-", " ↔ ")} · ativo`;
      return option;
    }));
    if (!eligible.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = state.failedLinkId ? "Restaure o cabo para continuar" : "Nenhum enlace ativo disponível";
      select.append(option);
    }
    select.disabled = eligible.length === 0;
  }
  function renderTopology() {
    root.querySelectorAll("[data-stp-link]").forEach((line) => {
      const id = line.dataset.stpLink;
      const portRoles = state.result.ports;
      const found = links.find((link) => link.id === id);
      const blocked = state.result.blockedLinkIds?.includes(id);
      const forwarding = state.result.forwardingLinkIds?.includes(id);
      const rolesVisible = state.stage >= 4;
      line.classList.toggle("forwarding", rolesVisible && Boolean(forwarding));
      line.classList.toggle("blocking", rolesVisible && Boolean(blocked));
      line.classList.toggle("disconnected", id === state.failedLinkId);
      line.classList.toggle("stp-current", state.stage >= 4 && state.stage <= 5 && Boolean(forwarding));
      line.setAttribute("aria-label", `${id}: ${id === state.failedLinkId ? "fisicamente desconectado" : blocked ? "Blocking, cabo conectado" : forwarding ? "Forwarding" : "indisponível"}`);
      if (found && state.stage >= 4) {
        const left = portRoles[found.a.switchId]?.[found.a.portId];
        const right = portRoles[found.b.switchId]?.[found.b.portId];
        const label = root.querySelector(`[data-stp-link-label="${id}"]`);
        if (label) label.textContent = id === state.failedLinkId ? "DISCONNECTED" : `${left?.role || "—"} ↔ ${right?.role || "—"}`;
      }
    });
    root.querySelectorAll("[data-stp-switch]").forEach((node) => node.classList.toggle("root-bridge", state.stage >= 2 && node.dataset.stpSwitch === state.result.rootId));
    root.querySelectorAll("[data-stp-bpdu]").forEach((marker) => marker.classList.toggle("visible", state.stage >= 1 && marker.dataset.stpBpdu !== state.failedLinkId));
  }
  function renderPorts() {
    const body = $(`[data-stp-port-table]`);
    if (state.stage < 4) {
      body.innerHTML = `<tr><td colspan="4">Avance até a eleição e o cálculo dos papéis para revelar o resultado.</td></tr>`;
      return;
    }
    const rows = [];
    for (const sw of switches) {
      const switchPorts = state.result.ports[sw.id] || {};
      for (const [port, value] of Object.entries(switchPorts)) {
        let role = value.role;
        let status = value.state;
        if (state.stage === 6 && !state.restoring && state.recoveryPort?.switchId === sw.id && state.recoveryPort?.portId === port) {
          status = "aguardando reconvergência";
        } else if (state.stage === 7 && state.recoveryPort?.switchId === sw.id && state.recoveryPort?.portId === port) {
          status = state.restoring ? "recalculando papel da porta" : "Listening → Learning";
        }
        rows.push(`<tr${status === "Blocking" ? ' class="stp-blocking-row"' : ""}><th scope="row">${sw.name}</th><td>${port}</td><td>${role}</td><td>${status}</td></tr>`);
      }
    }
    body.innerHTML = rows.join("") || `<tr><td colspan="4">Sem portas calculadas.</td></tr>`;
  }
  function render() {
    updateCalculation();
    const details = currentStageDetails();
    const restoredCopy = state.stage === 8 && state.restoring;
    $(`[data-stp-event-stage]`).textContent = restoredCopy ? "ETAPA 8 · TOPOLOGIA RECALCULADA" : details[0];
    $(`[data-stp-event-title]`).textContent = restoredCopy ? "Todos os cabos estão conectados e a porta redundante voltou a Blocking" : details[1];
    $(`[data-stp-observation]`).textContent = restoredCopy ? "O enlace físico foi restaurado. A árvore lógica voltou a manter um caminho em Blocking enquanto os enlaces necessários permanecem em Forwarding." : details[2];
    $(`[data-stp-explanation]`).textContent = restoredCopy ? "Blocking é uma decisão lógica, não um cabo removido: essa porta continua recebendo BPDUs e pode voltar a encaminhar se uma mudança futura exigir novo cálculo." : details[3];
    $(`[data-stp-root]`).textContent = state.stage >= 2 ? `${state.result.rootId.toUpperCase()} · ${state.result.rootBridgeId}` : "não revelada";
    $(`[data-stp-costs]`).textContent = state.stage >= 3 ? switches.map((sw) => `${sw.name}: ${Number.isFinite(state.result.costs[sw.id]) ? state.result.costs[sw.id] : "sem caminho"}`).join(" · ") : "não revelados";
    $(`[data-stp-transition]`).textContent = state.restoring && state.stage >= 7 ? (state.stage === 7 ? "recalculo após restaurar enlace" : "porta redundante em Blocking") : state.stage < 6 ? "sem falha simulada" : state.stage === 6 ? "enlace fisicamente removido" : state.stage === 7 ? "Listening → Learning" : "papéis recalculados após reconvergência";
    const dataFrame = $(`[data-stp-data-frame]`);
    const dataLabel = $(`[data-stp-data-label]`);
    const dataPoints = { "sw1-sw2": [370, 115], "sw1-sw3": [280, 210], "sw2-sw3": [470, 210] };
    const dataPaths = { "sw1-sw2": "M120 350 L150 167 L205 115 L535 115 L590 167 L640 350", "sw1-sw3": "M120 350 L150 167 L205 135 L370 285 L425 255 L535 135 L590 167 L640 350", "sw2-sw3": "M120 350 L150 167 L205 115 L535 115 L550 135 L390 285 L425 255 L535 135 L590 167 L640 350" };
    const dataVisible = (state.stage === 5 || state.stage === 8) && state.result.forwardingLinkIds?.length;
    const dataLinkId = state.result.forwardingLinkIds?.[0];
    if (dataVisible && dataPoints[dataLinkId]) {
      dataFrame.setAttribute("cx", dataPoints[dataLinkId][0]);
      dataFrame.setAttribute("cy", dataPoints[dataLinkId][1]);
      dataFrame.classList.add("visible");
      const animationKey = `${state.stage}:${dataLinkId}`;
      if (state.frameAnimationKey !== animationKey) {
        dataFrame.querySelector("animateMotion")?.remove();
        state.frameAnimationKey = animationKey;
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          dataFrame.setAttribute("cx", "0");
          dataFrame.setAttribute("cy", "0");
          const motion = document.createElementNS("http://www.w3.org/2000/svg", "animateMotion");
          motion.setAttribute("path", dataPaths[dataLinkId]);
          motion.setAttribute("dur", "1.1s");
          motion.setAttribute("fill", "freeze");
          dataFrame.append(motion);
          motion.beginElement();
        } else {
          dataFrame.setAttribute("cx", dataPoints[dataLinkId][0]);
          dataFrame.setAttribute("cy", dataPoints[dataLinkId][1]);
        }
      }
      dataLabel.setAttribute("x", dataPoints[dataLinkId][0]);
      dataLabel.setAttribute("y", dataPoints[dataLinkId][1] - 22);
      dataLabel.classList.add("visible");
      $(`[data-stp-data-status]`).textContent = `Amostra de frame de usuário em ${dataLinkId.toUpperCase().replaceAll("-", " ↔ ")} · enlace Forwarding.`;
    } else {
      dataFrame.classList.remove("visible");
      dataFrame.querySelector("animateMotion")?.remove();
      dataFrame.setAttribute("cx", dataPoints[dataLinkId]?.[0] ?? "370");
      dataFrame.setAttribute("cy", dataPoints[dataLinkId]?.[1] ?? "115");
      state.frameAnimationKey = null;
      dataLabel.classList.remove("visible");
      $(`[data-stp-data-status]`).textContent = "Dados de usuário: ainda não apresentados.";
    }
    const fail = $(`[data-stp-fail]`);
    fail.disabled = state.stage !== 5 || Boolean(state.failedLinkId) || !state.result.forwardingLinkIds?.length;
    $(`[data-stp-restore]`).hidden = !state.failedLinkId;
    $(`[data-stp-next]`).disabled = state.stage >= 5 && state.stage < 6 || state.stage >= 8 || state.result.status === "invalid";
    $(`[data-stp-prev]`).disabled = state.stage === 0;
    $(`[data-stp-play]`).disabled = state.stage === 5 || state.stage >= 8;
    $(`[data-stp-pause]`).disabled = !state.playTimer;
    $(`[data-stp-next]`).textContent = state.stage === 0 ? "Iniciar troca de BPDUs" : state.stage === 5 ? "Escolha um enlace ativo e simule a falha" : state.stage === 6 ? "Avançar reconvergência" : state.stage === 7 ? "Concluir recuperação" : state.stage >= 8 ? "Demonstração concluída" : "Avançar etapa";
    $(`[data-stp-status]`).textContent = state.result.status === "invalid" ? state.result.reason : state.result.status === "disconnected" ? "Há switches sem caminho físico até a Root Bridge; não há árvore completa para apresentar como sucesso." : state.stage >= 2 ? `Root Bridge calculada: ${state.result.rootId.toUpperCase()}. Cálculo finito em ${state.result.iterations} iterações.` : "Etapa manual. Avance para observar a troca de BPDUs e a eleição.";
    root.querySelectorAll("[data-stp-stage-marker]").forEach((marker) => {
      const number = Number(marker.dataset.stpStageMarker);
      if (number === state.stage) marker.setAttribute("aria-current", "step"); else marker.removeAttribute("aria-current");
      marker.classList.toggle("passed", number < state.stage);
    });
    const note = $(`[data-stp-failure-note]`);
    note.hidden = !state.failedLinkId;
    note.textContent = state.failedLinkId ? `Enlace ${state.failedLinkId.toUpperCase().replaceAll("-", " ↔ ")} está fisicamente desconectado. As portas desse enlace não trocam BPDUs; isso difere de uma porta Blocking, que permanece conectada.` : "";
    renderTopology();
    renderPorts();
    fillFailureChoices();
  }
  function recalculateFromControls() {
    state.stage = 0;
    state.failedLinkId = null;
    state.recoveryPort = null;
    state.restoring = false;
    state.predictionChecked = false;
    $(`[data-stp-prediction-feedback]`).textContent = "";
    $(`[data-stp-port-feedback]`).textContent = "";
    render();
  }
  $(`[data-stp-recalculate]`).addEventListener("click", recalculateFromControls);
  $(`[data-stp-reset]`).addEventListener("click", () => {
    stopPlayback();
    switches.forEach((sw) => { $(`[data-stp-priority="${sw.id}"]`).value = "32768"; });
    links.forEach((link) => { $(`[data-stp-cost="${link.id}"]`).value = String(link.cost); });
    $(`[data-stp-root-prediction]`).value = "";
    $(`[data-stp-port-prediction]`).value = "";
    recalculateFromControls();
    $(`[data-stp-status]`).textContent = "Demonstração reiniciada. A topologia física foi restaurada e as etapas voltaram ao início.";
  });
  const stopPlayback = () => { if (state.playTimer) window.clearInterval(state.playTimer); state.playTimer = null; };
  const advanceStage = () => {
    if (state.stage < 5) state.stage += 1;
    else if (state.stage === 6) state.stage = 7;
    else if (state.stage === 7) state.stage = 8;
    if (state.stage === 5 || state.stage >= 8) stopPlayback();
    render();
  };
  $(`[data-stp-next]`).addEventListener("click", () => { stopPlayback(); advanceStage(); });
  $(`[data-stp-prev]`).addEventListener("click", () => {
    stopPlayback();
    if (state.stage > 0 && state.stage <= 5) state.stage -= 1;
    else if (state.stage === 6) { state.failedLinkId = null; state.stage = 5; state.restoring = false; updateCalculation(); }
    else if (state.stage > 6) state.stage -= 1;
    render();
  });
  $(`[data-stp-play]`).addEventListener("click", () => {
    stopPlayback();
    const interval = Number($(`[data-stp-play-speed]`).value) || 1000;
    state.playTimer = window.setInterval(advanceStage, interval);
    render();
  });
  $(`[data-stp-pause]`).addEventListener("click", () => { stopPlayback(); render(); });
  $(`[data-stp-play-speed]`).addEventListener("change", () => {
    if (!state.playTimer) return;
    stopPlayback();
    $(`[data-stp-play]`).click();
  });
  $(`[data-stp-check-root]`).addEventListener("click", () => {
    const answer = $(`[data-stp-root-prediction]`).value;
    const correct = answer && answer === state.result.rootId;
    $(`[data-stp-prediction-feedback]`).textContent = !answer ? "Escolha uma previsão antes de conferir." : correct ? "Previsão correta. Agora avance para acompanhar os BPDUs e revelar a eleição." : "Ainda não corresponde à prioridade e ao Bridge ID atuais. Reavalie esses dados e tente novamente antes de revelar.";
    state.predictionChecked = Boolean(correct);
  });
  $(`[data-stp-check-port]`).addEventListener("click", () => {
    const answer = $(`[data-stp-port-prediction]`).value;
    const actual = state.result.ports.sw3?.["Gi0/1"]?.role;
    $(`[data-stp-port-feedback]`).textContent = !answer ? "Escolha um papel antes de conferir." : answer === actual ? "Isso: SW3 Gi0/1 é Blocking porque o caminho direto custa 19, enquanto o caminho via SW2 soma 8." : answer === "Root Port" ? "A Root Port de SW3 é Gi0/2: por ela o custo acumulado até SW1 é 4 + 4 = 8." : "SW1 já oferece uma informação melhor para esse segmento; a porta de SW3 fica em Blocking, mas o cabo continua conectado.";
  });
  $(`[data-stp-fail]`).addEventListener("click", () => {
    stopPlayback();
    const id = $(`[data-stp-failure-link]`).value;
    if (!id || !state.result.forwardingLinkIds.includes(id)) return;
    const prior = state.result;
    const link = links.find((item) => item.id === id);
    state.recoveryPort = prior.blockedLinkIds.flatMap((blockedId) => {
      const blocked = links.find((item) => item.id === blockedId);
      const data = prior.links[blockedId]?.blocked;
      return data ? [{ switchId: data.switchId, portId: data.portId }] : [];
    })[0] || null;
    state.failedLinkId = id;
    state.stage = 6;
    state.restoring = false;
    updateCalculation();
    if (state.result.status !== "ok") {
      state.failedLinkId = null;
      state.result = prior;
      $(`[data-stp-status]`).textContent = "A falha não deixa um caminho ativo válido até todos os switches; não foi apresentada como recuperação bem-sucedida.";
      return render();
    }
    state.recoveryPort ||= { switchId: link.a.switchId, portId: link.a.portId };
    render();
  });
  $(`[data-stp-restore]`).addEventListener("click", () => {
    stopPlayback();
    const restoredLinkId = state.failedLinkId;
    state.failedLinkId = null;
    state.restoring = true;
    state.stage = 7;
    render();
    const blocked = state.result.links[restoredLinkId]?.blocked;
    state.recoveryPort = blocked ? { switchId: blocked.switchId, portId: blocked.portId } : null;
    render();
    $(`[data-stp-event-title]`).textContent = "Enlace físico restaurado; o STP recalcula os papéis";
    $(`[data-stp-observation]`).textContent = "O cabo voltou à topologia. A árvore não é declarada estabilizada automaticamente; avance para concluir o recálculo e observar se o enlace retorna a Blocking.";
    $(`[data-stp-transition]`).textContent = "restaurado · aguardando recálculo";
  });
  const teaching = root;
  if (teaching) {
    const bpduFeedback = teaching.querySelector("[data-stp-bpdu-feedback]");
    const bpduScene = teaching.querySelector("[data-stp-bpdu-lesson]");
    const roadDemo = teaching.querySelector("[data-stp-road-demo]");
    const roadToggle = teaching.querySelector("[data-stp-road-toggle]");
    const roadStatus = teaching.querySelector("[data-stp-road-status]");
    const playRoadMotion = (failed) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const pairs = [["[data-stp-road-motion]", failed ? "#st-road-alt-route" : "#st-road-main-route"], ["[data-stp-network-motion]", failed ? "#st-network-alt-route" : "#st-network-main-route"]];
      pairs.forEach(([selector, href]) => {
        const motion = teaching.querySelector(selector);
        const mpath = motion?.querySelector("mpath");
        if (mpath) mpath.setAttribute("href", href);
        try { motion?.beginElement(); } catch { /* SVG SMIL is optional; state and route remain visible. */ }
      });
    };
    roadToggle.addEventListener("click", () => {
      const failed = roadDemo.dataset.state !== "failed";
      roadDemo.dataset.state = failed ? "failed" : "stable";
      roadDemo.classList.toggle("is-main-failed", failed);
      roadToggle.textContent = failed ? "Restaurar o caminho principal" : "Simular falha do caminho principal";
      teaching.querySelector("[data-stp-road-caption]").textContent = failed ? "Estrada direta interditada; o veículo segue por B após reorganizar o caminho." : "Caminho principal ativo; alternativa disponível.";
      teaching.querySelector("[data-stp-network-caption]").textContent = failed ? "Enlace direto falhou; a porta redundante passa a encaminhar após o recálculo didático." : "O cabo segue conectado; a porta impede o ciclo lógico.";
      roadDemo.classList.add("is-moving");
      roadStatus.textContent = failed ? "Os dois desenhos mudaram juntos: a estrada/cabo direto falhou fisicamente e o caminho alternativo assumiu após reorganização. Blocking e cabo desconectado são situações diferentes." : "Caminho direto restaurado. A alternativa volta a ficar reservada; nenhum cabo foi removido pela decisão STP.";
      playRoadMotion(failed);
    });
    teaching.querySelector("[data-stp-road-send]").addEventListener("click", () => {
      const failed = roadDemo.dataset.state === "failed";
      roadDemo.classList.add("is-moving");
      playRoadMotion(failed);
      roadStatus.textContent = failed ? "Veículo e frame percorreram juntos a alternativa pelo bairro B/SW2." : "Veículo e frame percorreram juntos o caminho direto; a rota alternativa continua reservada.";
    });


    const bpduPayload = teaching.querySelector("[data-stp-bpdu-payload]");
    const receiveBpdu = () => {
      bpduPayload.hidden = false;
      teaching.querySelector("[data-stp-bpdu-sender]").textContent = "SW2 · Bridge ID 32768 / MAC final :02";
      teaching.querySelector("[data-stp-bpdu-root]").textContent = "SW1 · Bridge ID 32768 / MAC final :01";
      teaching.querySelector("[data-stp-bpdu-cost]").textContent = "4";
      bpduFeedback.textContent = "SW1 recebeu a BPDU: o emissor é SW2, a raiz anunciada é SW1 e o custo anunciado até ela é 4.";
    };
    bpduScene.addEventListener("animationend", (event) => {
      if (event.target.matches("[data-stp-ticket]")) receiveBpdu();
    });
    teaching.querySelector("[data-stp-bpdu-send]").addEventListener("click", () => {
      bpduScene.classList.remove("is-sent");
      void bpduScene.offsetWidth;
      bpduScene.classList.add("is-sent");
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) receiveBpdu();
      else bpduFeedback.textContent = "A BPDU está seguindo de SW2 para SW1. Quando chegar, o bilhete será aberto.";
    });
    teaching.querySelector("[data-stp-bpdu-match-check]").addEventListener("click", () => {
      const fields = Object.fromEntries([...teaching.querySelectorAll("[data-stp-bpdu-match-field]")].map((field) => [field.dataset.stpBpduMatchField, field.value]));
      const feedback = teaching.querySelector("[data-stp-bpdu-match-feedback]");
      if (Object.values(fields).some((value) => !value)) feedback.textContent = "Associe os três campos antes de conferir.";
      else if (fields.sender !== "sender") feedback.textContent = "O campo Emissor identifica a bridge que enviou o bilhete, por seu Bridge ID.";
      else if (fields.root !== "root") feedback.textContent = "Raiz conhecida é o Root ID anunciado na BPDU, não o endereço de quem a enviou.";
      else if (fields.cost !== "cost") feedback.textContent = "O custo anunciado é o custo acumulado até a raiz; não identifica o emissor nem a raiz.";
      else feedback.textContent = "Associação completa: emissor/Bridge ID, raiz/Root ID e custo/Root Path Cost.";
    });
    const election = teaching.querySelector("[data-stp-election]");
    const electionFeedback = election.querySelector("[data-stp-election-feedback]");
    let sw3Priority = 32768;
    let electionPhase = 0;
    let secondPrediction = "";
    let secondReady = false;
    const bridgeCards = [...election.querySelectorAll("[data-stp-bridge-card]")];
    const bridgeWinner = () => [...bridgeCards].map((card) => ({
      id: card.dataset.stpBridgeCard,
      priority: card.dataset.stpBridgeCard === "sw3" ? sw3Priority : 32768,
      mac: card.dataset.stpBridgeCard === "sw1" ? "01" : card.dataset.stpBridgeCard === "sw2" ? "02" : "03",
    })).sort((a, b) => a.priority - b.priority || a.mac.localeCompare(b.mac))[0];
    const renderElection = () => {
      election.querySelector('[data-stp-card-priority="sw3"]').textContent = String(sw3Priority);
      const winner = bridgeWinner();
      bridgeCards.forEach((card) => {
        const isWinner = electionPhase === 2 && !secondReady ? card.dataset.stpBridgeCard === "sw1" : card.dataset.stpBridgeCard === winner.id;
        card.classList.toggle("is-root-candidate", (electionPhase === 2 && !secondReady || electionPhase >= 3) && isWinner);
        card.querySelector("[data-stp-card-result]").textContent = electionPhase < 2 ? "aguardando comparação" : isWinner ? "Root Bridge eleita" : "não venceu esta eleição";
      });
      election.querySelector("[data-stp-election-priority-result]").textContent = electionPhase >= 1
        ? (sw3Priority === 32768 ? "Empate: SW1, SW2 e SW3 têm prioridade 32768. Agora o MAC pode desempatar." : `SW3 tem prioridade ${sw3Priority}, menor que 32768; a prioridade decide antes do MAC.`)
        : "As três prioridades estão visíveis. Compare os valores antes de avançar.";
      election.querySelector("[data-stp-election-mac]").disabled = electionPhase < 1 || sw3Priority !== 32768;
      election.querySelector("[data-stp-election-mac-result]").textContent = electionPhase >= 2 && sw3Priority === 32768
        ? "Com prioridade empatada, SW1 vence pelo menor MAC final :01."
        : sw3Priority !== 32768 && electionPhase >= 1 ? "Não há empate de prioridade: não usamos o MAC nesta comparação." : "Esta comparação só será apresentada se as prioridades empatarem.";
      election.querySelector("[data-stp-election-second]").hidden = electionPhase < 2;
      election.querySelector("[data-stp-election-prediction-area]").hidden = !secondReady;
      election.querySelector("[data-stp-election-change]").hidden = secondReady;
      if (electionPhase >= 3) {
        electionFeedback.textContent = "Nova eleição concluída: SW3 vence porque sua prioridade 4096 é menor que 32768; o MAC não precisou desempatar.";
      } else if (electionPhase >= 2 && sw3Priority === 32768) {
        electionFeedback.textContent = "Eleição concluída: prioridades empatadas; o menor MAC final :01 elege SW1.";
      }
    };
    election.querySelector("[data-stp-election-priority]").addEventListener("click", () => {
      electionPhase = Math.max(electionPhase, 1);
      electionFeedback.textContent = sw3Priority === 32768 ? "As prioridades empataram. Só agora compare os MACs." : "SW3 tem a menor prioridade; o MAC não é necessário para decidir.";
      renderElection();
    });
    election.querySelector("[data-stp-election-mac]").addEventListener("click", () => {
      if (sw3Priority !== 32768) return;
      electionPhase = 2;
      renderElection();
    });
    election.querySelector("[data-stp-election-change]").addEventListener("click", () => {
      sw3Priority = 4096;
      secondReady = true;
      secondPrediction = "";
      election.querySelector("[data-stp-election-run-second]").disabled = true;
      renderElection();
      election.querySelector("[data-stp-election-second-feedback]").textContent = "A prioridade de SW3 agora é 4096. Compare antes de prever.";
    });
    election.querySelector("[data-stp-election-second]").addEventListener("click", (event) => {
      const choice = event.target.closest("[data-stp-election-predict]");
      if (!choice) return;
      secondPrediction = choice.dataset.stpElectionPredict;
      election.querySelectorAll("[data-stp-election-predict]").forEach((button) => button.setAttribute("aria-pressed", String(button === choice)));
      election.querySelector("[data-stp-election-run-second]").disabled = false;
      election.querySelector("[data-stp-election-second-feedback]").textContent = `Previsão registrada: ${choice.textContent}. Confira quando estiver pronto.`;
    });
    election.querySelector("[data-stp-election-run-second]").addEventListener("click", () => {
      if (!secondPrediction) return;
      if (!secondReady) return;
      electionPhase = 3;
      const winner = bridgeWinner();
      renderElection();
      election.querySelector("[data-stp-election-second-feedback]").textContent = secondPrediction === winner.id
        ? "SW3 venceu porque sua prioridade é menor (4096). O MAC só seria desempate se as prioridades fossem iguais."
        : `Sua previsão foi ${secondPrediction.toUpperCase()}, mas SW3 venceu: prioridade 4096 é menor que 32768. O MAC não precisou desempatar.`;
      election.querySelector("[data-stp-election-second]").hidden = false;
    });
    renderElection();

    const costLesson = teaching.querySelector("[data-stp-cost-lesson]");
    const costState = { scenario: 1, choice: "", revealed: false };
    const costCases = {
      1: { values: { direct: 19, via: [4, 4] }, correct: "via", explain: "Via SW2 soma 4 + 4 = 8, menor que 19. O custo menor vence, mesmo com mais saltos." },
      2: { values: { direct: 5, via: [3, 4] }, correct: "direct", explain: "Direto custa 5; via SW2 soma 3 + 4 = 7. Agora o caminho direto tem a menor soma." },
    };
    const renderCost = () => {
      const scenario = costCases[costState.scenario];
      costLesson.dataset.scenario = String(costState.scenario);
      teaching.querySelector("[data-stp-cost-scenario-title]").textContent = `Situação ${costState.scenario} · raiz SW1`;
      teaching.querySelector('[data-stp-cost-label="direct"]').textContent = String(scenario.values.direct);
      teaching.querySelector('[data-stp-cost-label="via-a"]').textContent = String(scenario.values.via[0]);
      teaching.querySelector('[data-stp-cost-label="via-b"]').textContent = String(scenario.values.via[1]);
      teaching.querySelectorAll("[data-stp-cost-choice]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.stpCostChoice === costState.choice));
        button.classList.toggle("is-selected", button.dataset.stpCostChoice === costState.choice);
      });
      teaching.querySelector("[data-stp-cost-compare]").disabled = !costState.choice || costState.revealed;
      teaching.querySelector("[data-stp-cost-next]").hidden = !costState.revealed || costState.scenario >= 2;
      costLesson.querySelector(".cost-direct").classList.toggle("is-best", costState.revealed && scenario.correct === "direct");
      costLesson.querySelectorAll(".cost-via-a,.cost-via-b").forEach((line) => line.classList.toggle("is-best", costState.revealed && scenario.correct === "via"));
    };
    costLesson.querySelectorAll("[data-stp-cost-choice]").forEach((button) => button.addEventListener("click", () => {
      costState.choice = button.dataset.stpCostChoice;
      costState.revealed = false;
      teaching.querySelector("[data-stp-cost-feedback]").textContent = `Você escolheu o caminho ${costState.choice === "direct" ? "direto" : "via SW2"}. Agora revele as somas.`;
      renderCost();
    }));
    teaching.querySelector("[data-stp-cost-compare]").addEventListener("click", () => {
      if (!costState.choice) return;
      const scenario = costCases[costState.scenario];
      costState.revealed = true;
      costLesson.classList.add("is-compared");
      teaching.querySelector("[data-stp-cost-feedback]").textContent = `${costState.choice === scenario.correct ? "Previsão correta. " : "A soma mostra outra opção. "}${scenario.explain}`;
      teaching.querySelectorAll("[data-stp-cost-traveler]").forEach((traveler) => {
        traveler.querySelector("animateMotion")?.beginElement?.();
        traveler.classList.toggle("is-best-traveler", traveler.dataset.stpCostTraveler === scenario.correct);
      });
      renderCost();
    });
    teaching.querySelector("[data-stp-cost-next]").addEventListener("click", () => {
      costState.scenario = 2;
      costState.choice = "";
      costState.revealed = false;
      costLesson.classList.remove("is-compared");
      teaching.querySelector("[data-stp-cost-feedback]").textContent = "Nova topologia com custos diferentes. Preveja antes de conferir.";
      renderCost();
    });
    renderCost();

    const rolePractice = teaching.querySelector("[data-stp-role-practice]");
    const roleFeedback = rolePractice.querySelector("[data-stp-role-feedback]");
    const practiceResult = model.calculate(switches, links);
    const selectedRoleByPort = Object.fromEntries(Object.entries(practiceResult.ports).flatMap(([switchId, ports]) => Object.entries(ports).map(([portId, value]) => [`${switchId}:${portId}`, value.role])));
    let selectedRole = "";
    const resetRoles = () => {
      selectedRole = "";
      rolePractice.querySelectorAll("[data-stp-role-choice]").forEach((button) => button.setAttribute("aria-pressed", "false"));
      rolePractice.querySelectorAll("[data-stp-role-target]").forEach((button) => {
        button.classList.remove("is-correct", "is-incorrect");
        button.querySelector("[data-stp-role-slot]").textContent = "Escolher papel";
      });
      roleFeedback.textContent = `Referência calculada: ${practiceResult.rootId.toUpperCase()} é a raiz; custos até ela: SW2 ${practiceResult.costs.sw2}, SW3 ${practiceResult.costs.sw3}.`;
    };
    rolePractice.querySelectorAll("[data-stp-role-choice]").forEach((button) => button.addEventListener("click", () => {
      selectedRole = button.dataset.stpRoleChoice;
      rolePractice.querySelectorAll("[data-stp-role-choice]").forEach((choice) => choice.setAttribute("aria-pressed", String(choice === button)));
      roleFeedback.textContent = `${selectedRole} selecionado. Agora escolha uma interface na topologia.`;
    }));
    rolePractice.querySelectorAll("[data-stp-role-target]").forEach((target) => target.addEventListener("click", () => {
      if (!selectedRole) { roleFeedback.textContent = "Escolha um papel antes de selecionar a interface."; return; }
      const id = target.dataset.stpRoleTarget;
      const actual = selectedRoleByPort[id];
      const correct = selectedRole === actual;
      target.classList.toggle("is-correct", correct);
      target.classList.toggle("is-incorrect", !correct);
      target.querySelector("[data-stp-role-slot]").textContent = selectedRole;
      const portName = id.replace(":", " · ").replace(/^sw([123])/, "SW$1");
      roleFeedback.textContent = correct
        ? `Correto: ${portName} é ${actual}; esse resultado vem dos custos calculados até ${practiceResult.rootId.toUpperCase()}.`
        : `${portName} é ${actual}, não ${selectedRole}. Compare se a interface está na raiz, oferece o melhor caminho no segmento ou mantém a redundância sem encaminhar.`;
      selectedRole = "";
      rolePractice.querySelectorAll("[data-stp-role-choice]").forEach((choice) => choice.setAttribute("aria-pressed", "false"));
    }));
    rolePractice.querySelector("[data-stp-role-reset]").addEventListener("click", resetRoles);
    resetRoles();
    const stateDescriptions = {
      Blocking: "Recebe BPDUs para acompanhar mudanças, mas não aprende MACs nem encaminha dados de usuário. O enlace pode continuar fisicamente conectado.",
      Listening: "Participa da decisão STP e recebe BPDUs; ainda não aprende endereços MAC nem encaminha dados de usuário.",
      Learning: "Recebe BPDUs e aprende endereços MAC, mas ainda não encaminha dados de usuário.",
      Forwarding: "Recebe BPDUs, aprende MACs e encaminha dados de usuário.",
      Disabled: "Interface fora de operação, por exemplo quando o enlace físico está desconectado; não participa do encaminhamento.",
    };
    teaching.querySelector("[data-stp-state-practice]").addEventListener("click", (event) => {
      const button = event.target.closest("[data-stp-port-state]");
      if (!button) return;
      teaching.querySelectorAll("[data-stp-port-state]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      teaching.querySelector("[data-stp-state-practice]").dataset.state = button.dataset.stpPortState;
      teaching.querySelector("[data-stp-state-feedback]").textContent = `${button.dataset.stpPortState}: ${stateDescriptions[button.dataset.stpPortState]}`;
    });
    renderElection();
    teaching.querySelector("[data-stp-rapid]").addEventListener("click", (event) => {
      const button = event.target.closest("[data-stp-rapid-check]");
      if (!button) return;
      const item = button.closest("[data-stp-rapid-item]");
      const selected = item.querySelector("input:checked");
      const feedback = item.querySelector('[role="status"]');
      feedback.textContent = !selected ? "Escolha uma previsão antes de conferir. " + item.dataset.feedback : selected.value === item.dataset.answer ? "Previsão sustentada. " + item.dataset.feedback : "Compare a evidência do enunciado e ajuste a previsão. " + item.dataset.feedback;
      item.dataset.checked = selected?.value === item.dataset.answer ? "true" : "false";
    });
  }
  render();
})();
