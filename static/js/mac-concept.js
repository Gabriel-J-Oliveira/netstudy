(() => {
  "use strict";

  function mark(button, correct, message, feedback) {
    button.classList.add(correct ? "is-correct" : "is-wrong");
    if (!correct) button.disabled = true;
    feedback.textContent = message;
  }

  function setupOpeningFrame() {
    const root = document.querySelector("[data-mac-frame-builder]");
    if (!root) return;

    const start = root.querySelector("[data-mac-frame-start]");
    const replay = root.querySelector("[data-mac-frame-replay]");
    const choice = root.querySelector("[data-mac-destination-choice]");
    const tokens = [...root.querySelectorAll("[data-mac-destination-token]")];
    const slot = root.querySelector("[data-mac-destination-slot]");
    const sourceField = root.querySelector("[data-mac-source-field]");
    const sourceValue = root.querySelector("[data-mac-source-value]");
    const destinationValue = root.querySelector("[data-mac-destination-value]");
    const frame = root.querySelector("[data-mac-building-frame]");
    const feedback = root.querySelector("[data-mac-builder-feedback]");
    const conclusion = root.querySelector("[data-mac-builder-conclusion]");
    const errorMessages = {
      "mac-a": "Esse é o Source MAC de PC-A, a origem do frame; ele não representa o destino desta entrega.",
      ipv4: "Um endereço IPv4 não preenche um campo MAC do frame Ethernet.",
      tcp: "A porta TCP 443 pertence ao contexto de transporte, não ao endereçamento MAC do frame.",
    };
    let selected = null;
    let complete = false;

    function renderTokens() {
      tokens.forEach((button) => {
        const active = button.dataset.macDestinationToken === selected;
        button.classList.toggle("is-selected", active);
        button.setAttribute("aria-pressed", String(active));
        if (complete) button.disabled = true;
      });
    }

    function reset() {
      selected = null;
      complete = false;
      root.dataset.state = "idle";
      root.classList.remove("is-delivering");
      frame.querySelector(":scope > strong").textContent = "FRAME ETHERNET · INCOMPLETO";
      sourceValue.textContent = "Ainda não preenchido";
      destinationValue.textContent = "Ainda não preenchido";
      sourceField.classList.remove("is-filled");
      slot.classList.remove("is-filled", "is-correct", "is-wrong");
      slot.disabled = true;
      tokens.forEach((button) => {
        button.disabled = false;
        button.classList.remove("is-selected", "is-correct", "is-wrong");
        button.setAttribute("aria-pressed", "false");
      });
      start.hidden = false;
      replay.hidden = true;
      choice.hidden = true;
      conclusion.hidden = true;
      feedback.textContent = "";
    }

    function begin() {
      root.dataset.state = "source";
      sourceValue.textContent = "AA:AA:AA:AA:AA:AA";
      sourceField.classList.add("is-filled");
      slot.disabled = false;
      start.hidden = true;
      choice.hidden = false;
      feedback.textContent = "Source MAC preenchido com o MAC de PC-A. Agora complete Destination MAC.";
      tokens[0].focus();
    }

    start.addEventListener("click", begin);

    tokens.forEach((button) => button.addEventListener("click", () => {
      if (complete) return;
      selected = selected === button.dataset.macDestinationToken ? null : button.dataset.macDestinationToken;
      slot.classList.remove("is-wrong");
      feedback.textContent = selected ? "Valor selecionado. Posicione-o em Destination MAC." : "Seleção removida.";
      renderTokens();
    }));

    slot.addEventListener("click", () => {
      if (complete) return;
      if (!selected) {
        feedback.textContent = "Selecione primeiro um dos valores disponíveis.";
        return;
      }
      if (selected !== "mac-b") {
        const wrongToken = tokens.find((button) => button.dataset.macDestinationToken === selected);
        wrongToken.classList.remove("is-selected");
        wrongToken.classList.add("is-wrong");
        wrongToken.setAttribute("aria-pressed", "false");
        wrongToken.disabled = true;
        slot.classList.add("is-wrong");
        feedback.textContent = errorMessages[selected];
        selected = null;
        return;
      }

      complete = true;
      root.dataset.state = "complete";
      destinationValue.textContent = "BB:BB:BB:BB:BB:BB";
      slot.classList.remove("is-wrong");
      slot.classList.add("is-filled", "is-correct");
      frame.querySelector(":scope > strong").textContent = "FRAME ETHERNET · COMPLETO";
      tokens.find((button) => button.dataset.macDestinationToken === "mac-b").classList.add("is-correct");
      feedback.textContent = "Destination MAC preenchido. Observe a entrega até PC-B.";
      conclusion.hidden = false;
      replay.hidden = false;
      root.classList.add("is-delivering");
      renderTokens();
    });

    replay.addEventListener("click", () => {
      reset();
      begin();
    });

    reset();
  }

  function setupExplorer() {
    const root = document.querySelector("[data-mac-explorer]");
    if (!root) return;
    const feedback = root.querySelector("[data-explore-feedback]");
    const messages = {
      ipv4: "192.168.10.25 → IPv4",
      mac: "AA:BB:CC:DD:EE:FF → MAC",
      transport: "443 → pode representar porta de transporte",
      interface: "Gi0/7 → identificação de interface/porta de equipamento de rede",
    };
    root.querySelectorAll("[data-explore-kind]").forEach((button) => button.addEventListener("click", () => {
      root.querySelectorAll("[data-explore-kind]").forEach((item) => item.classList.toggle("is-selected", item === button));
      feedback.textContent = messages[button.dataset.exploreKind];
    }));
  }

  function setupIpconfigProof() {
    const root = document.querySelector("[data-ipconfig-proof]");
    if (!root) return;
    const feedback = root.querySelector("[data-proof-feedback]");
    root.querySelectorAll("[data-proof-value]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.proofValue !== "mac") {
        mark(button, false, "Esse valor é IPv4. A evidência de MAC aparece como Endereço Físico.", feedback);
        return;
      }
      button.classList.add("is-correct");
      root.querySelectorAll("[data-proof-value]").forEach((item) => { item.disabled = true; });
      root.querySelector("[data-proof-use]").hidden = false;
      feedback.textContent = "Endereço Físico fornece o MAC da interface. Agora conecte ao frame.";
    }));
    root.querySelectorAll("button[data-proof-use]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.proofUse !== "source") {
        mark(button, false, "A interface está originando o frame neste cenário.", feedback);
        return;
      }
      button.classList.add("is-correct");
      root.querySelectorAll("button[data-proof-use]").forEach((item) => { item.disabled = true; });
      feedback.textContent = "Correto. O valor pode aparecer como Source MAC do frame.";
    }));
  }

  function setupDirectionRapidFire(root) {
    if (root.dataset.ready) return;
    root.dataset.ready = "true";
    const items = [
      { prompt: "PC-A → PC-B · Source pertence a quem?", correct: "PC-A", wrong: "PC-B" },
      { prompt: "PC-B → PC-A · Destination pertence a quem?", correct: "PC-A", wrong: "PC-B" },
    ];
    let index = 0;
    const prompt = root.querySelector("[data-direction-rf-prompt]");
    const options = root.querySelector("[data-direction-rf-options]");
    const feedback = root.querySelector("[data-direction-rf-feedback]");
    function render() {
      prompt.textContent = items[index].prompt;
      options.replaceChildren();
      feedback.textContent = "";
      [items[index].correct, items[index].wrong].forEach((label) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => {
          if (label !== items[index].correct) {
            mark(button, false, "Observe quem origina ou recebe o frame indicado.", feedback);
            return;
          }
          button.classList.add("is-correct");
          [...options.querySelectorAll("button")].forEach((item) => { item.disabled = true; });
          if (index === 1) feedback.textContent = "Correto. Source e Destination acompanham a direção do frame.";
          else {
            feedback.textContent = "Correto.";
            const next = document.createElement("button");
            next.type = "button";
            next.textContent = "Próximo →";
            next.addEventListener("click", () => { index += 1; render(); });
            options.appendChild(next);
          }
        });
        options.appendChild(button);
      });
    }
    render();
  }

  function setupDirection() {
    const root = document.querySelector("[data-direction-demo]");
    if (!root) return;
    const feedback = root.querySelector("[data-direction-feedback]");
    const fields = root.querySelector("[data-direction-fields]");
    const assignments = {};
    let selected = null;
    function renderAssignments() {
      root.querySelectorAll("[data-direction-token]").forEach((button) => {
        const id = button.dataset.directionToken;
        button.classList.toggle("is-selected", selected === id);
        button.disabled = Object.hasOwn(assignments, id);
      });
      root.querySelectorAll("[data-direction-slot]").forEach((slot) => {
        const id = Object.keys(assignments).find((token) => assignments[token] === slot.dataset.directionSlot);
        slot.querySelector("span").textContent = id === "a" ? "AA:AA:AA:AA:AA:AA" : id === "b" ? "BB:BB:BB:BB:BB:BB" : "Posicionar";
      });
    }
    root.querySelectorAll("[data-predict-change]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.predictChange !== "both") {
        mark(button, false, "Ao inverter quem envia e quem recebe, os dois papéis mudam.", feedback);
        return;
      }
      button.classList.add("is-correct");
      root.querySelectorAll("[data-predict-change]").forEach((item) => { item.disabled = true; });
      fields.hidden = false;
      feedback.textContent = "Previsão correta. Complete os dois novos campos.";
    }));
    root.querySelectorAll("[data-direction-token]").forEach((button) => button.addEventListener("click", () => {
      selected = button.dataset.directionToken;
      renderAssignments();
    }));
    root.querySelectorAll("[data-direction-slot]").forEach((slot) => slot.addEventListener("click", () => {
      const slotId = slot.dataset.directionSlot;
      if (selected) {
        Object.keys(assignments).forEach((id) => { if (assignments[id] === slotId) delete assignments[id]; });
        assignments[selected] = slotId;
        selected = null;
      } else {
        const id = Object.keys(assignments).find((token) => assignments[token] === slotId);
        if (id) delete assignments[id];
      }
      renderAssignments();
    }));
    root.querySelector("[data-direction-check]").addEventListener("click", () => {
      if (assignments.b !== "source" || assignments.a !== "destination") {
        feedback.textContent = "PC-B responde: seu MAC passa a Source; PC-A passa a Destination.";
        return;
      }
      root.dataset.direction = "b-a";
      root.querySelector("[data-direction-arrow]").textContent = "←";
      root.querySelector("[data-direction-source]").textContent = "BB:BB:BB:BB:BB:BB";
      root.querySelector("[data-direction-destination]").textContent = "AA:AA:AA:AA:AA:AA";
      root.querySelector("[data-direction-tab='a-b']").classList.remove("is-active");
      const reverseTab = root.querySelector("[data-direction-tab='b-a']");
      reverseTab.disabled = false;
      reverseTab.classList.add("is-active");
      root.querySelectorAll("[data-direction-token], [data-direction-slot], [data-direction-check]").forEach((item) => { item.disabled = true; });
      feedback.textContent = "Correto. Ambos mudaram com a direção.";
      const rapid = document.querySelector("[data-direction-rf]");
      rapid.hidden = false;
      setupDirectionRapidFire(rapid);
    });
    renderAssignments();
  }

  function setupIntegratedDemo() {
    const root = document.querySelector("[data-integrated-demo]");
    if (!root) return;
    root.querySelector("[data-integrated-run]").addEventListener("click", (event) => {
      root.querySelector("[data-integrated-cache]").textContent = ".80 → BB:BB:BB:BB:BB:BB";
      root.querySelector("[data-integrated-mac]").textContent = "BB:BB:BB:BB:BB:BB";
      root.querySelector("[data-integrated-result]").hidden = false;
      event.currentTarget.disabled = true;
    });
  }

  function setupCacheConnect() {
    const root = document.querySelector("[data-cache-connect]");
    if (!root) return;
    const feedback = root.querySelector("[data-cache-feedback]");
    root.querySelectorAll("[data-cache-row]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.cacheRow !== "target") {
        mark(button, false, "O destino apresentado é .80. Use a associação correspondente.", feedback);
        return;
      }
      button.classList.add("is-correct");
      root.querySelectorAll("[data-cache-row]").forEach((item) => { item.disabled = true; });
      root.querySelector("[data-cache-value]").hidden = false;
      feedback.textContent = "Associação correta. Agora selecione o valor usado no frame.";
    }));
    root.querySelectorAll("[data-cache-mac]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.cacheMac !== "target") {
        mark(button, false, "Esse é o MAC associado ao gateway, não ao destino local .80.", feedback);
        return;
      }
      button.classList.add("is-correct");
      root.querySelectorAll("[data-cache-mac]").forEach((item) => { item.disabled = true; });
      feedback.textContent = "Correto. BB-BB... entra em Destination MAC.";
    }));
  }

  function setupScope() {
    const root = document.querySelector("[data-mac-scope]");
    if (!root) return;
    root.querySelectorAll("[data-mac-scope-tab]").forEach((button) => button.addEventListener("click", () => {
      const scope = button.dataset.macScopeTab;
      root.querySelectorAll("[data-mac-scope-tab]").forEach((tab) => tab.setAttribute("aria-selected", String(tab === button)));
      root.querySelectorAll("[data-mac-scope-panel]").forEach((panel) => { panel.hidden = panel.dataset.macScopePanel !== scope; });
    }));
  }

  function setupAssignments(config) {
    const root = document.querySelector(config.rootSelector);
    if (!root) return;
    const tokens = [...root.querySelectorAll("[data-" + config.prefix + "-token]")];
    const slots = [...root.querySelectorAll("[data-" + config.prefix + "-slot]")];
    const assignments = {};
    let selected = null;
    let done = false;
    function render() {
      tokens.forEach((button) => {
        const id = button.dataset[config.prefix + "Token"];
        button.classList.toggle("is-selected", selected === id);
        button.disabled = done || Object.hasOwn(assignments, id);
      });
      slots.forEach((slot) => {
        const slotId = slot.dataset[config.prefix + "Slot"];
        const tokenId = Object.keys(assignments).find((id) => assignments[id] === slotId);
        const token = tokens.find((button) => button.dataset[config.prefix + "Token"] === tokenId);
        slot.querySelector("span").textContent = token ? token.textContent : "Posicionar";
        slot.disabled = done;
      });
    }
    tokens.forEach((button) => button.addEventListener("click", () => { selected = button.dataset[config.prefix + "Token"]; render(); }));
    slots.forEach((slot) => slot.addEventListener("click", () => {
      const slotId = slot.dataset[config.prefix + "Slot"];
      if (selected) {
        Object.keys(assignments).forEach((id) => { if (assignments[id] === slotId) delete assignments[id]; });
        assignments[selected] = slotId;
        selected = null;
      } else {
        const id = Object.keys(assignments).find((token) => assignments[token] === slotId);
        if (id) delete assignments[id];
      }
      render();
    }));
    root.querySelector("[data-" + config.prefix + "-check]").addEventListener("click", () => {
      const valid = Object.keys(config.correct).every((id) => assignments[id] === config.correct[id]) && Object.keys(assignments).length === Object.keys(config.correct).length;
      root.querySelector(config.feedbackSelector).textContent = valid ? config.success : config.wrong;
      if (valid) {
        done = true;
        if (config.onSuccess) config.onSuccess();
      }
      render();
    });
    render();
  }

  function setupRemoteBuilder() {
    setupAssignments({
      rootSelector: "[data-remote-builder]", prefix: "remote",
      correct: { "remote-ip": "ip", source: "source", gateway: "destination" },
      feedbackSelector: "[data-remote-feedback]",
      success: "Correto. O IP continua remoto; o primeiro frame usa Source MAC de PC-A e Destination MAC do gateway.",
      wrong: "Separe o destino IP final da entrega Ethernet feita ao gateway.",
      onSuccess: () => { document.querySelector("[data-remote-rf]").hidden = false; },
    });
    const rapid = document.querySelector("[data-remote-rf]");
    const feedback = rapid && rapid.querySelector("[data-remote-rf-feedback]");
    if (!rapid) return;
    rapid.querySelectorAll("[data-remote-rf-answer]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.remoteRfAnswer !== "no") {
        mark(button, false, "O gateway recebe a entrega Ethernet local, mas o destino IP final continua 8.8.8.8.", feedback);
        return;
      }
      button.classList.add("is-correct");
      rapid.querySelectorAll("[data-remote-rf-answer]").forEach((item) => { item.disabled = true; });
      feedback.textContent = "Correto. Ele é o destino Ethernet da primeira entrega local, não o destino IP final.";
    }));
  }

  function setupTerminal() {
    const root = document.querySelector("[data-mac-terminal]");
    if (!root) return;
    const form = root.querySelector("[data-terminal-form]");
    const input = root.querySelector("[data-terminal-input]");
    const stage = root.querySelector("[data-terminal-stage]");
    const feedback = root.querySelector("[data-terminal-feedback]");
    let ownSolved = false;
    function command(value) {
      const line = document.createElement("div");
      line.className = "terminal-history-command";
      line.textContent = "C:\\Users\\Aluno> " + value;
      stage.appendChild(line);
    }
    function output(value) {
      const pre = document.createElement("pre");
      pre.textContent = value;
      stage.appendChild(pre);
    }
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); form.requestSubmit(); } });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value.trim().replace(/\s+/g, " ").toLowerCase();
      if (!value) return;
      command(value);
      input.value = "";
      if (value === "cls" || value === "clear") { stage.replaceChildren(); return; }
      if (value === "help") { output("ipconfig /all\ngetmac\narp -a\ncls\nhelp"); return; }
      if (value === "ipconfig /all") {
        output("Adaptador Ethernet Ethernet:\n\n   Endereço Físico. . . . . . . . . : AA-BB-CC-DD-EE-FF\n   Endereço IPv4. . . . . . . . . . : 192.168.10.25\n   Gateway Padrão. . . . . . . . .  : 192.168.10.1");
        root.querySelector("[data-terminal-own]").hidden = false;
        feedback.textContent = "Use a saída para identificar o valor que pode ocupar Source MAC.";
        return;
      }
      if (value === "getmac") {
        output("Physical Address    Transport Name\nAA-BB-CC-DD-EE-FF   \\Device\\Tcpip_{...}");
        root.querySelector("[data-terminal-own]").hidden = false;
        feedback.textContent = "getmac também mostra o endereço físico. O caminho principal continua ipconfig /all.";
        return;
      }
      if (value === "arp -a") {
        if (!ownSolved) { output("Antes, conclua a leitura do endereço da própria interface."); return; }
        output("Internet Address      Physical Address\n192.168.10.1          11-11-11-11-11-11\n192.168.10.80         BB-BB-BB-BB-BB-BB\n192.168.10.90         CC-CC-CC-CC-CC-CC");
        root.querySelector("[data-terminal-arp]").hidden = false;
        feedback.textContent = "Agora selecione a associação relevante para .80.";
        return;
      }
      output("'" + value + "' não é reconhecido neste cenário.");
    });
    root.querySelectorAll("[data-terminal-own-answer]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.terminalOwnAnswer !== "mac") {
        mark(button, false, "Selecione o Endereço Físico da interface.", feedback);
        return;
      }
      ownSolved = true;
      button.classList.add("is-correct");
      root.querySelectorAll("[data-terminal-own-answer]").forEach((item) => { item.disabled = true; });
      root.querySelector("[data-terminal-objective]").textContent = "Agora descubra qual MAC o host conhece para 192.168.10.80.";
      feedback.textContent = "Correto. Execute arp -a.";
    }));
    root.querySelectorAll("[data-terminal-arp-answer]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.terminalArpAnswer !== "target") {
        mark(button, false, "Procure a linha cujo IPv4 é 192.168.10.80.", feedback);
        return;
      }
      button.classList.add("is-correct");
      root.querySelectorAll("[data-terminal-arp-answer]").forEach((item) => { item.disabled = true; });
      feedback.textContent = "Correto. .80 → BB-BB... fornece o possível Destination MAC local.";
      document.querySelector("[data-terminal-rf]").hidden = false;
    }));
    const rapid = document.querySelector("[data-terminal-rf]");
    rapid.querySelector("[data-terminal-rf-check]").addEventListener("click", () => {
      const value = rapid.querySelector("[data-terminal-rf-input]").value.trim().toLowerCase().replace(/\s+/g, " ");
      const message = rapid.querySelector("[data-terminal-rf-feedback]");
      if (value !== "arp -a") { message.textContent = "Revise a comparação entre informações da interface e associações conhecidas."; return; }
      message.textContent = "Correto. arp -a.";
      rapid.querySelector("[data-terminal-rf-input]").disabled = true;
      rapid.querySelector("[data-terminal-rf-check]").disabled = true;
    });
  }

  function setupRolePairing() {
    const root = document.querySelector("[data-role-pairing]");
    if (!root) return;
    const correct = { mac: "ethernet", arp: "resolution", frame: "structure", switch: "equipment", ipv4: "layer3" };
    const done = new Set();
    let selected = null;
    const feedback = root.querySelector("[data-role-feedback]");
    root.querySelectorAll("[data-role-concept]").forEach((button) => button.addEventListener("click", () => {
      if (!done.has(button.dataset.roleConcept)) {
        selected = button.dataset.roleConcept;
        root.querySelectorAll("[data-role-concept]").forEach((item) => item.classList.toggle("is-selected", item === button));
      }
    }));
    root.querySelectorAll("[data-role-action]").forEach((button) => button.addEventListener("click", () => {
      if (!selected) { feedback.textContent = "Selecione primeiro um conceito."; return; }
      if (correct[selected] !== button.dataset.roleAction) { button.classList.add("is-wrong"); feedback.textContent = "Esse papel pertence a outro conceito."; return; }
      done.add(selected);
      root.querySelector("[data-role-concept='" + selected + "']").disabled = true;
      button.disabled = true;
      button.classList.add("is-correct");
      selected = null;
      root.querySelectorAll("[data-role-concept]").forEach((item) => item.classList.remove("is-selected"));
      feedback.textContent = done.size === 5 ? "Correto. Os cinco papéis estão separados." : "Par correto. Continue.";
    }));
  }

  function setupRecall() {
    setupAssignments({
      rootSelector: "[data-final-recall]", prefix: "recall",
      correct: { frame: "frame", arp: "arp", mac: "mac" },
      feedbackSelector: "[data-recall-feedback]",
      success: "Correto. Frame é a estrutura, ARP é o mecanismo e MAC é a informação.",
      wrong: "Use somente as três peças pedidas: estrutura, mecanismo e informação.",
      onSuccess: () => {
        document.querySelector("[data-final-gap='frame']").textContent = "FRAME ETHERNET";
        document.querySelector("[data-final-gap='arp']").textContent = "ARP";
        document.querySelector("[data-final-gap='mac']").textContent = "MAC APRENDIDO";
      },
    });
  }

  const FLOW_STEPS = [
    ["PC-A possui dados", "A transmissão começa com dados que precisam ser colocados em um frame Ethernet."],
    ["Source MAC já conhecido", "A interface de PC-A fornece o endereço de origem daquele frame."],
    ["Destination MAC necessário", "O frame ainda precisa indicar quem recebe a entrega Ethernet local."],
    ["ARP se necessário", "Se o MAC necessário não estiver conhecido, ARP pode obtê-lo a partir do IPv4 relevante."],
    ["MAC aprendido", "O endereço MAC necessário passa a estar disponível."],
    ["Frame construído", "Source MAC e Destination MAC completam o endereçamento Ethernet do frame."],
    ["Frame enviado", "O frame completo é transmitido pela rede Ethernet."],
    ["Switch recebe", "Agora sabemos qual endereço está dentro do frame. O próximo passo é entender como o switch utiliza essa informação."],
  ];

  function setupFullFlow() {
    const root = document.querySelector("[data-mac-full-flow]");
    if (!root) return;
    let current = 0;
    let timer = null;
    function render() {
      root.dataset.step = String(current + 1);
      root.querySelector("[data-flow-current]").textContent = current + 1;
      root.querySelector("[data-flow-title]").textContent = FLOW_STEPS[current][0];
      root.querySelector("[data-flow-copy]").textContent = FLOW_STEPS[current][1];
      root.querySelector("[data-flow-previous]").disabled = current === 0;
      root.querySelector("[data-flow-next]").disabled = current === FLOW_STEPS.length - 1;
    }
    function stop() {
      window.clearInterval(timer);
      timer = null;
      root.querySelector("[data-flow-play]").textContent = "▶ Reproduzir";
    }
    root.querySelector("[data-flow-play]").addEventListener("click", () => {
      if (timer) { stop(); return; }
      if (current === FLOW_STEPS.length - 1) current = 0;
      root.querySelector("[data-flow-play]").textContent = "Pausar";
      render();
      timer = window.setInterval(() => {
        if (current === FLOW_STEPS.length - 1) { stop(); return; }
        current += 1;
        render();
      }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 800);
    });
    root.querySelector("[data-flow-previous]").addEventListener("click", () => { stop(); current = Math.max(0, current - 1); render(); });
    root.querySelector("[data-flow-next]").addEventListener("click", () => { stop(); current = Math.min(FLOW_STEPS.length - 1, current + 1); render(); });
    root.querySelector("[data-flow-reset]").addEventListener("click", () => { stop(); current = 0; render(); });
    render();
  }

  function setupAsyncCheckpoint() {
    const container = document.querySelector("#mac-checkpoint");
    const start = document.querySelector("[data-mac-checkpoint-start]");
    if (!container || container.dataset.asyncReady === "true") return;
    container.dataset.asyncReady = "true";
    async function submit(form, submitter) {
      const data = new FormData(form);
      if (submitter && submitter.name) data.append(submitter.name, submitter.value);
      container.style.minHeight = Math.max(container.offsetHeight, Number.parseFloat(container.style.minHeight) || 0) + "px";
      container.setAttribute("aria-busy", "true");
      try {
        const response = await fetch(form.action, { method: "POST", body: data, headers: { "X-Requested-With": "XMLHttpRequest", "Accept": "application/json" }, credentials: "same-origin" });
        if (!response.ok) throw new Error("request failed");
        const payload = await response.json();
        const parsed = new DOMParser().parseFromString(payload.html, "text/html").querySelector("#mac-checkpoint");
        if (!parsed) throw new Error("invalid response");
        container.innerHTML = parsed.innerHTML;
        container.removeAttribute("aria-busy");
        window.NetStudyExercises && window.NetStudyExercises.init();
      } catch (error) {
        container.removeAttribute("aria-busy");
        container.innerHTML = '<div class="alert alert-danger">Não foi possível registrar a resposta. Tente novamente.</div>';
      }
    }
    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (form instanceof HTMLFormElement && (form === start || container.contains(form))) {
        event.preventDefault();
        submit(form, event.submitter);
      }
    });
  }

  setupOpeningFrame();
  setupExplorer();
  setupIpconfigProof();
  setupDirection();
  setupIntegratedDemo();
  setupCacheConnect();
  setupScope();
  setupRemoteBuilder();
  setupTerminal();
  setupRolePairing();
  setupRecall();
  setupFullFlow();
  setupAsyncCheckpoint();
})();
