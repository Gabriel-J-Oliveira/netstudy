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
  const state = { stage: 0, failedLinkId: null, result: null, recoveryPort: null, predictionChecked: false, restoring: false, frameAnimationKey: null };

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
    const dataPaths = { "sw1-sw2": "M205 115 L535 115", "sw1-sw3": "M205 147 L315 255", "sw2-sw3": "M535 147 L425 255" };
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
    switches.forEach((sw) => { $(`[data-stp-priority="${sw.id}"]`).value = "32768"; });
    links.forEach((link) => { $(`[data-stp-cost="${link.id}"]`).value = String(link.cost); });
    $(`[data-stp-root-prediction]`).value = "";
    $(`[data-stp-port-prediction]`).value = "";
    recalculateFromControls();
    $(`[data-stp-status]`).textContent = "Demonstração reiniciada. A topologia física foi restaurada e as etapas voltaram ao início.";
  });
  $(`[data-stp-next]`).addEventListener("click", () => {
    if (state.stage >= 0 && state.stage < 5) state.stage += 1;
    else if (state.stage === 6) state.stage = 7;
    else if (state.stage === 7) state.stage = 8;
    render();
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
    bpduFeedback.textContent = "Pronto para observar uma troca de informação de controle entre SW2 e SW1.";
    teaching.querySelector("[data-stp-bpdu-send]").addEventListener("click", () => {
      bpduScene.classList.remove("is-sent");
      void bpduScene.offsetWidth;
      bpduScene.classList.add("is-sent");
      bpduFeedback.textContent = "SW2 compartilhou sua mensagem de controle com SW1. Esse bilhete carrega informações para o cálculo do STP; não é um frame de dados do usuário.";
    });
    teaching.querySelector("[data-stp-bpdu-inspect]").addEventListener("click", (event) => {
      const button = event.currentTarget;
      const payload = teaching.querySelector("[data-stp-bpdu-payload]");
      const open = payload.hidden;
      payload.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      if (open) bpduFeedback.textContent = "Na BPDU simplificada, observe o emissor, a raiz conhecida e o custo anunciado até ela.";
    });

    const election = teaching.querySelector("[data-stp-election]");
    const electionFeedback = election.querySelector("[data-stp-election-feedback]");
    let sw3Priority = 32768;
    let electionRevealed = false;
    const renderElection = () => {
      election.querySelector('[data-stp-card-priority="sw3"]').textContent = String(sw3Priority);
      const cards = [...election.querySelectorAll("[data-stp-bridge-card]")];
      const values = cards.map((card) => ({
        id: card.dataset.stpBridgeCard,
        priority: card.dataset.stpBridgeCard === "sw3" ? sw3Priority : 32768,
        mac: card.dataset.stpBridgeCard === "sw1" ? "01" : card.dataset.stpBridgeCard === "sw2" ? "02" : "03",
      }));
      values.sort((a, b) => a.priority - b.priority || a.mac.localeCompare(b.mac));
      const winner = values[0];
      cards.forEach((card) => {
        const wins = electionRevealed && card.dataset.stpBridgeCard === winner.id;
        card.classList.toggle("is-root-candidate", wins);
        card.querySelector("[data-stp-card-result]").textContent = !electionRevealed ? "Cartão de identidade" : wins ? "Root Bridge eleita" : "Não foi eleita";
      });
      const toggle = election.querySelector("[data-stp-priority-toggle]");
      toggle.disabled = !electionRevealed;
      toggle.textContent = sw3Priority === 32768 ? "Alterar prioridade de SW3 para 4096" : "Restaurar prioridade de SW3 para 32768";
      if (electionRevealed) {
        electionFeedback.textContent = sw3Priority < 32768
          ? `SW3 vence: sua prioridade ${sw3Priority} é menor. O MAC é comparado depois da prioridade.`
          : "SW1 vence: as três prioridades empataram em 32768, então o MAC final :01 desempata.";
      }
    };
    election.querySelector("[data-stp-election-run]").addEventListener("click", () => {
      electionRevealed = true;
      renderElection();
    });
    election.querySelector("[data-stp-priority-toggle]").addEventListener("click", () => {
      sw3Priority = sw3Priority === 32768 ? 4096 : 32768;
      renderElection();
    });

    const costLesson = teaching.querySelector("[data-stp-cost-lesson]");
    teaching.querySelector("[data-stp-cost-compare]").addEventListener("click", () => {
      costLesson.classList.add("is-compared");
      teaching.querySelector("[data-stp-cost-feedback]").textContent = "8 é menor que 19. Por isso, neste exemplo, SW3 alcança SW1 passando por SW2.";
    });

    const rolePractice = teaching.querySelector("[data-stp-role-practice]");
    const roleFeedback = rolePractice.querySelector("[data-stp-role-feedback]");
    const expectedRoles = { "sw2-root": "Root Port", "sw1-designated": "Designated Port", "sw3-blocked": "Blocking" };
    let selectedRole = "";
    const resetRoles = () => {
      selectedRole = "";
      rolePractice.querySelectorAll("[data-stp-role-choice]").forEach((button) => button.setAttribute("aria-pressed", "false"));
      rolePractice.querySelectorAll("[data-stp-role-target]").forEach((button) => {
        button.classList.remove("is-correct", "is-incorrect");
        button.querySelector("[data-stp-role-slot]").textContent = "Escolha um papel";
      });
      roleFeedback.textContent = "Selecione um rótulo e depois uma interface.";
    };
    rolePractice.querySelectorAll("[data-stp-role-choice]").forEach((button) => button.addEventListener("click", () => {
      selectedRole = button.dataset.stpRoleChoice;
      rolePractice.querySelectorAll("[data-stp-role-choice]").forEach((choice) => choice.setAttribute("aria-pressed", String(choice === button)));
      roleFeedback.textContent = `${selectedRole} selecionada. Agora escolha a interface.`;
    }));
    rolePractice.querySelectorAll("[data-stp-role-target]").forEach((target) => target.addEventListener("click", () => {
      if (!selectedRole) {
        roleFeedback.textContent = "Primeiro escolha um papel na linha acima; depois selecione uma interface.";
        return;
      }
      const id = target.dataset.stpRoleTarget;
      const correct = selectedRole === expectedRoles[id];
      target.classList.toggle("is-correct", correct);
      target.classList.toggle("is-incorrect", !correct);
      target.querySelector("[data-stp-role-slot]").textContent = selectedRole;
      roleFeedback.textContent = correct
        ? `Correto. ${target.firstChild.textContent.trim()} recebe o papel ${selectedRole}.`
        : id === "sw3-blocked" && selectedRole === "Root Port"
          ? "A porta bloqueada não é o melhor caminho. SW3 Gi0/2 oferece custo acumulado 8; Gi0/1 fica em Blocking porque o caminho direto custa 19."
          : id === "sw3-blocked" && selectedRole === "Designated Port"
            ? "Neste segmento, a informação de SW1 é melhor: SW1 tem custo 0 até a raiz. SW3 Gi0/1 fica em Blocking."
            : `Revise quem oferece o menor custo até a raiz neste segmento; ${target.firstChild.textContent.trim()} não é ${selectedRole}.`;
      selectedRole = "";
      rolePractice.querySelectorAll("[data-stp-role-choice]").forEach((choice) => choice.setAttribute("aria-pressed", "false"));
    }));
    rolePractice.querySelector("[data-stp-role-reset]").addEventListener("click", resetRoles);
    resetRoles();
    renderElection();
  }
  render();
})();
