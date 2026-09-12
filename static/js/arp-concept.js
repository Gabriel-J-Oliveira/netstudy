(() => {
  "use strict";

  function setupWalkthrough() {
    const root = document.querySelector("[data-arp-demo]");
    if (!root) return;

    const copies = [...root.querySelectorAll("[data-demo-copy]")];
    const counter = root.querySelector("[data-demo-current]");
    const back = root.querySelector("[data-demo-back]");
    const next = root.querySelector("[data-demo-next]");
    const reset = root.querySelector("[data-demo-reset]");
    let step = 1;
    let predictionSolved = false;

    function renderStep() {
      root.dataset.step = String(step);
      counter.textContent = String(step);
      copies.forEach((copy) => copy.classList.toggle("is-current", copy.dataset.demoCopy === String(step)));
      back.disabled = step === 1;
      next.disabled = step === 7 || (step === 4 && !predictionSolved);
      next.textContent = step === 7 ? "Último passo" : "Próximo passo →";
    }

    back.addEventListener("click", () => { step = Math.max(1, step - 1); renderStep(); });
    next.addEventListener("click", () => { step = Math.min(7, step + 1); renderStep(); });
    root.querySelectorAll("[data-demo-host]").forEach((host) => host.addEventListener("click", () => {
      if (step !== 4 || predictionSolved) return;
      if (host.dataset.demoHost !== "b") { host.classList.add("is-wrong"); return; }
      host.classList.add("is-correct");
      root.querySelector("[data-demo-evidence]").hidden = false;
    }));
    root.querySelectorAll("[data-evidence]").forEach((button) => button.addEventListener("click", () => {
      const feedback = root.querySelector("[data-evidence-feedback]");
      if (button.dataset.evidence !== "ip") { button.disabled = true; button.classList.add("is-wrong"); feedback.textContent = "Proximidade e ordem do MAC não determinam quem responde."; return; }
      button.classList.add("is-correct"); predictionSolved = true; feedback.textContent = "Correto. PC-B responde porque possui o IPv4 procurado."; root.querySelectorAll("[data-evidence]").forEach((item) => { item.disabled = true; }); renderStep();
    }));
    reset.addEventListener("click", () => { step = 1; predictionSolved = false; root.querySelector("[data-demo-evidence]").hidden = true; root.querySelectorAll("[data-demo-host], [data-evidence]").forEach((item) => { item.disabled = false; item.classList.remove("is-correct", "is-wrong"); }); renderStep(); });
    renderStep();
  }

  function setupParticipantExplorer() {
    const root = document.querySelector("[data-participant-explorer]");
    if (!root) return;
    const buttons = [...root.querySelectorAll("[data-explore]")];
    const details = [...root.querySelectorAll("[data-explore-detail]")];
    const prompt = root.querySelector(".explore-prompt");

    buttons.forEach((button) => button.addEventListener("click", () => {
      const selected = button.dataset.explore;
      buttons.forEach((item) => item.classList.toggle("is-selected", item === button));
      buttons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      details.forEach((detail) => { detail.hidden = detail.dataset.exploreDetail !== selected; });
      prompt.hidden = true;
    }));
  }

  function setupCacheDemo() {
    const root = document.querySelector("[data-cache-demo]");
    if (!root) return;
    const button = root.querySelector("[data-cache-run]");
    const note = document.querySelector("[data-cache-note]");
    let timer;

    button.addEventListener("click", () => {
      window.clearTimeout(timer);
      root.classList.remove("is-complete");
      note.classList.remove("is-visible");
      root.classList.add("is-running");
      button.disabled = true;
      timer = window.setTimeout(() => {
        root.classList.add("is-complete");
        root.classList.remove("is-running");
        note.classList.add("is-visible");
        button.disabled = false;
        button.textContent = "Executar novamente";
      }, 700);
    });
  }

  function setupScopeExplorer() {
    const root = document.querySelector("[data-scope-explorer]");
    if (!root) return;
    const tabs = [...root.querySelectorAll("[data-scope]")];
    const panels = [...root.querySelectorAll("[data-scope-panel]")];

    function selectScope(scope) {
      tabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.scope === scope)));
      panels.forEach((panel) => {
        const active = panel.dataset.scopePanel === scope;
        panel.hidden = !active;
        panel.classList.toggle("is-active", active);
      });
    }
    tabs.forEach((tab) => tab.addEventListener("click", () => selectScope(tab.dataset.scope)));
  }

  function setupTerminalRelation() {
    const terminal = document.querySelector("[data-terminal-relation]");
    const relation = document.querySelector("[data-terminal-line]");
    if (!terminal || !relation) return;
    const targets = [...terminal.querySelectorAll("[data-terminal-ip], [data-terminal-mac]")];
    let locked = false;

    function show(active) {
      relation.classList.toggle("is-related", active);
      targets.forEach((target) => target.classList.toggle("is-related", active));
    }
    targets.forEach((target) => {
      target.addEventListener("pointerenter", () => show(true));
      target.addEventListener("focus", () => show(true));
      target.addEventListener("blur", () => { if (!locked) show(false); });
      target.addEventListener("click", () => { locked = !locked; show(locked); });
    });
    terminal.addEventListener("pointerleave", () => { if (!locked) show(false); });
  }

  function setupConceptImages() {
    const dialog = document.querySelector("[data-image-dialog]");
    const dialogImage = dialog?.querySelector("[data-image-dialog-content]");
    const close = dialog?.querySelector("[data-image-close]");

    document.querySelectorAll("[data-concept-image]").forEach((image) => {
      const frame = image.closest(".concept-image-frame");
      const trigger = image.closest("[data-image-open]");
      const fallback = frame?.querySelector("[data-image-fallback]");

      function useFallback() {
        if (trigger) trigger.hidden = true;
        if (fallback) fallback.hidden = false;
      }

      image.addEventListener("error", useFallback);
      if (image.complete && image.naturalWidth === 0) useFallback();
      trigger?.addEventListener("click", () => {
        if (!dialog || !dialogImage) return;
        dialogImage.src = image.currentSrc || image.src;
        dialogImage.alt = image.alt;
        dialog.showModal();
      });
    });

    close?.addEventListener("click", () => dialog.close());
    dialog?.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  }

  const FLOW_STEPS = {
    local: [
      { title: "Identificar a entrega local", copy: "O destino está na mesma rede local. PC-A precisa entregar o frame diretamente a PC-B.", facts: [["MAC necessário", "MAC de PC-B"]], focus: ["pc-a", "pc-b"] },
      { title: "Consultar a ARP Cache", copy: "PC-A ainda não possui a associação necessária.", facts: [["ARP Cache", "192.168.10.80 → não conhecido"]], focus: ["pc-a"], cacheFocus: true },
      { title: "Enviar ARP Request", copy: "O Request é enviado em broadcast porque PC-A ainda não conhece o MAC procurado.", facts: [["Ethernet destination", "FF:FF:FF:FF:FF:FF"]], focus: ["pc-a", "switch", "pc-b", "pc-c"], path: "request", message: "ARP REQUEST · Quem tem 192.168.10.80? Diga 192.168.10.25" },
      { title: "O host correto se identifica", copy: "Todos recebem o Request, mas PC-B reconhece o IPv4 procurado.", facts: [["PC-B · 192.168.10.80", "“Esse IPv4 é meu.”"]], focus: ["pc-b"], done: ["pc-a", "switch"], subdued: ["pc-c"] },
      { title: "Receber ARP Reply", copy: "PC-B informa seu endereço MAC diretamente ao solicitante.", facts: [["Associação informada", "192.168.10.80 está em BB:BB:BB:BB:BB:BB"]], focus: ["pc-a", "switch", "pc-b"], path: "reply", message: "ARP REPLY · 192.168.10.80 está em BB:BB:BB:BB:BB:BB" },
      { title: "Atualizar a ARP Cache", copy: "A associação IPv4 → MAC agora está disponível.", facts: [["Associação aprendida", "192.168.10.80 → BB:BB:BB:BB:BB:BB"]], done: ["pc-a", "pc-b"], learned: true, cacheFocus: true },
      { title: "Enviar o frame", copy: "Como o destino é local, o primeiro frame Ethernet utiliza diretamente o MAC de PC-B.", facts: [["IP destino", "192.168.10.80"], ["MAC destino", "BB:BB:BB:BB:BB:BB"], ["Destino local", "ARP pelo próprio host de destino"]], focus: ["pc-a", "switch", "pc-b"], path: "frame", learned: true },
    ],
    remote: [
      { title: "Identificar que o destino é remoto", copy: "O destino IP final continua sendo 8.8.8.8, mas PC-A precisa entregar o primeiro frame ao gateway.", facts: [["Destino IP final", "8.8.8.8"], ["Próximo salto local", "192.168.10.1"]], focus: ["pc-a", "gateway", "remote"], subdued: ["internet"] },
      { title: "Consultar a ARP Cache", copy: "PC-A ainda não conhece o MAC do próximo salto.", facts: [["ARP Cache", "192.168.10.1 → não conhecido"]], focus: ["pc-a", "gateway"], cacheFocus: true },
      { title: "Resolver o gateway", copy: "O ARP Request procura o gateway local, não o servidor remoto.", facts: [["IPv4 resolvido via ARP", "192.168.10.1"]], focus: ["pc-a", "switch", "gateway"], subdued: ["internet", "remote"], path: "request", message: "ARP REQUEST · Quem tem 192.168.10.1? Diga 192.168.10.25" },
      { title: "Gateway responde", copy: "O gateway informa o MAC que PC-A precisa utilizar localmente.", facts: [["Associação informada", "192.168.10.1 está em AA:AA:AA:AA:AA:AA"]], focus: ["pc-a", "switch", "gateway"], subdued: ["internet", "remote"], path: "reply", message: "ARP REPLY · 192.168.10.1 está em AA:AA:AA:AA:AA:AA" },
      { title: "Atualizar a ARP Cache", copy: "O MAC do próximo salto agora é conhecido.", facts: [["Associação aprendida", "192.168.10.1 → AA:AA:AA:AA:AA:AA"]], done: ["pc-a", "gateway"], learned: true, cacheFocus: true },
      { title: "Montar o primeiro frame", copy: "O endereço IP continua apontando para o destino remoto, mas o MAC do primeiro frame pertence ao gateway.", facts: [["IP destino", "8.8.8.8"], ["MAC destino", "AA:AA:AA:AA:AA:AA"], ["Dispositivos diferentes", "Servidor remoto × gateway local"]], focus: ["gateway", "remote"], done: ["pc-a"], learned: true },
      { title: "Entregar ao próximo salto", copy: "PC-A cumpriu sua parte da entrega local. A partir do gateway, o tráfego pode continuar em direção ao destino final.", facts: [["Destino remoto", "ARP pelo próximo salto local"]], focus: ["pc-a", "switch", "gateway"], done: ["internet", "remote"], path: "frame", continuation: true, learned: true },
    ],
  };

  class ARPFlowController {
    constructor(root) {
      this.root = root;
      this.scenario = "local";
      this.currentStep = 0;
      this.playing = false;
      this.hasPlayed = false;
      this.timer = null;
      this.tabs = [...root.querySelectorAll("[data-flow-tab]")];
      this.panels = [...root.querySelectorAll("[data-flow-panel]")];
      this.current = root.querySelector("[data-flow-current]");
      this.title = root.querySelector("[data-flow-step-title]");
      this.copy = root.querySelector("[data-flow-step-copy]");
      this.facts = root.querySelector("[data-flow-step-facts]");
      this.playButton = root.querySelector("[data-flow-play]");
      this.pauseButton = root.querySelector("[data-flow-pause]");
      this.previousButton = root.querySelector("[data-flow-previous]");
      this.nextButton = root.querySelector("[data-flow-next]");
      this.comparison = root.querySelector("[data-flow-comparison]");
      this.bindEvents();
      this.render();
    }

    get activePanel() { return this.root.querySelector(`[data-flow-panel="${this.scenario}"]`); }
    get steps() { return FLOW_STEPS[this.scenario]; }

    bindEvents() {
      this.tabs.forEach((tab) => {
        tab.addEventListener("click", () => this.setScenario(tab.dataset.flowTab));
        tab.addEventListener("keydown", (event) => {
          const index = this.tabs.indexOf(tab);
          let nextIndex = null;
          if (event.key === "ArrowRight") nextIndex = (index + 1) % this.tabs.length;
          if (event.key === "ArrowLeft") nextIndex = (index - 1 + this.tabs.length) % this.tabs.length;
          if (event.key === "Home") nextIndex = 0;
          if (event.key === "End") nextIndex = this.tabs.length - 1;
          if (nextIndex !== null) { event.preventDefault(); this.tabs[nextIndex].focus(); this.setScenario(this.tabs[nextIndex].dataset.flowTab); }
        });
      });
      this.playButton.addEventListener("click", () => this.play());
      this.pauseButton.addEventListener("click", () => this.pause());
      this.previousButton.addEventListener("click", () => { this.pause(); this.previous(); });
      this.nextButton.addEventListener("click", () => { this.pause(); this.next(); });
      this.root.querySelector("[data-flow-reset]").addEventListener("click", () => this.reset());
    }

    setScenario(scenario) {
      if (scenario === this.scenario) return this.reset();
      this.pause();
      this.scenario = scenario;
      this.currentStep = 0;
      this.hasPlayed = false;
      this.tabs.forEach((tab) => {
        const active = tab.dataset.flowTab === scenario;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      this.panels.forEach((panel) => { const active = panel.dataset.flowPanel === scenario; panel.hidden = !active; panel.classList.toggle("is-active", active); });
      this.render();
    }

    setStep(step) { this.currentStep = Math.max(0, Math.min(this.steps.length - 1, step)); this.render(); }
    next() { this.setStep(this.currentStep + 1); }
    previous() { this.setStep(this.currentStep - 1); }

    play() {
      if (this.currentStep === this.steps.length - 1) this.currentStep = 0;
      this.playing = true;
      this.hasPlayed = true;
      this.render();
      this.schedule();
    }

    schedule() {
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => {
        if (!this.playing) return;
        if (this.currentStep < this.steps.length - 1) {
          this.currentStep += 1;
          this.render();
          if (this.currentStep < this.steps.length - 1) this.schedule(); else this.pause();
        } else this.pause();
      }, 2700);
    }

    pause() { window.clearTimeout(this.timer); this.timer = null; this.playing = false; this.render(); }
    reset() { this.pause(); this.currentStep = 0; this.hasPlayed = false; this.render(); }

    render() {
      const step = this.steps[this.currentStep];
      const panel = this.activePanel;
      this.root.dataset.scenario = this.scenario;
      this.root.dataset.step = String(this.currentStep + 1);
      this.root.dataset.playing = String(this.playing);
      this.current.textContent = String(this.currentStep + 1);
      this.title.textContent = step.title;
      this.copy.textContent = step.copy;
      this.facts.replaceChildren(...step.facts.map(([label, value]) => {
        const item = document.createElement("div");
        const labelElement = document.createElement("span");
        const valueElement = document.createElement("code");
        labelElement.textContent = label;
        valueElement.textContent = value;
        item.append(labelElement, valueElement);
        return item;
      }));

      panel.querySelectorAll("[data-flow-node]").forEach((node) => {
        const name = node.dataset.flowNode;
        node.classList.toggle("is-focus", (step.focus || []).includes(name));
        node.classList.toggle("is-done", (step.done || []).includes(name));
        node.classList.toggle("is-subdued", (step.subdued || []).includes(name));
      });
      panel.querySelectorAll("[data-flow-path]").forEach((path) => {
        path.classList.toggle("is-active", path.dataset.flowPath === step.path || (path.dataset.flowPath === "continuation" && step.continuation));
      });

      const message = panel.querySelector("[data-flow-message]");
      message.textContent = step.message || "";
      message.classList.toggle("is-visible", Boolean(step.message));
      message.classList.toggle("is-reply", step.path === "reply");
      const cache = panel.querySelector("[data-flow-cache]");
      cache.classList.toggle("is-focus", Boolean(step.cacheFocus));
      cache.classList.toggle("is-learned", Boolean(step.learned));
      panel.querySelector("[data-flow-cache-target]").textContent = step.learned
        ? (this.scenario === "local" ? "192.168.10.80 → BB:BB:BB:BB:BB:BB" : "192.168.10.1 → AA:AA:AA:AA:AA:AA")
        : (this.scenario === "local" ? "192.168.10.80 → não conhecido" : "192.168.10.1 → não conhecido");

      this.playButton.hidden = this.playing;
      this.playButton.innerHTML = `<span aria-hidden="true">▶</span> ${this.hasPlayed ? "Continuar" : "Reproduzir"}`;
      this.pauseButton.hidden = !this.playing;
      this.previousButton.disabled = this.currentStep === 0;
      this.nextButton.disabled = this.currentStep === this.steps.length - 1;
      this.comparison.hidden = this.currentStep !== this.steps.length - 1;
    }
  }

  function setupIntroDemo() {
    const root = document.querySelector("[data-arp-intro]");
    if (!root) return;
    const messages = ["PC-A conhece o IPv4, mas ainda não conhece o MAC necessário.", "O host envia um ARP Request.", "O dispositivo correspondente envia um ARP Reply.", "O MAC agora é conhecido.", "O frame pode receber o Destination MAC."];
    let timers = [];
    const play = root.querySelector("[data-arp-intro-play]");
    function reset() { timers.forEach(window.clearTimeout); timers = []; root.dataset.step = "1"; root.querySelector("[data-arp-intro-message]").textContent = messages[0]; play.disabled = false; play.textContent = "Ver acontecer"; }
    play.addEventListener("click", () => { reset(); play.disabled = true; const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 70 : 520; messages.slice(1).forEach((message, index) => timers.push(window.setTimeout(() => { root.dataset.step = String(index + 2); root.querySelector("[data-arp-intro-message]").textContent = message; if (index === 3) { play.disabled = false; play.textContent = "Ver novamente"; } }, delay * (index + 1)))); });
    root.querySelector("[data-arp-intro-reset]").addEventListener("click", reset); reset();
  }

  function setupMessageLabeler() {
    const root = document.querySelector("[data-message-labeler]");
    if (!root) return;
    const labels = {};
    const feedback = root.querySelector("[data-label-feedback]");
    root.querySelectorAll("[data-label-block]").forEach((button) => button.addEventListener("click", () => {
      const block = button.dataset.labelBlock; labels[block] = button.dataset.label;
      root.querySelectorAll(`[data-label-block='${block}']`).forEach((item) => item.classList.toggle("is-selected", item === button));
      if (labels.a && labels.b) {
        if (labels.a === "request" && labels.b === "reply") { root.querySelector("[data-request-evidence-group]").hidden = false; feedback.textContent = "Rótulos corretos. Agora indique uma evidência do Request."; }
        else feedback.textContent = "O bloco que pergunta é o Request; o bloco que informa o MAC é o Reply.";
      }
    }));
    root.querySelectorAll("button[data-request-evidence]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.requestEvidence === "reply-mac") { button.disabled = true; button.classList.add("is-wrong"); feedback.textContent = "Esse MAC aparece como conteúdo da resposta."; return; }
      button.classList.add("is-correct"); root.querySelectorAll("button[data-request-evidence]").forEach((item) => { item.disabled = true; }); feedback.textContent = "Correto. A pergunta e o broadcast sustentam a identificação do Request."; const rapid = document.querySelector("[data-arp-message-rf]"); rapid.hidden = false; setupMessageRapidFire(rapid);
    }));
  }

  function setupMessageRapidFire(root) {
    if (root.dataset.ready) return; root.dataset.ready = "true";
    const items = [
      { prompt: "Request normalmente procura:", options: [["correct", "MAC a partir de um IPv4"], ["wrong", "IPv4 a partir de uma porta"]] },
      { prompt: "192.168.10.80 está em BB:BB... Quem respondeu?", options: [["correct", "Host que possui 192.168.10.80"], ["wrong", "Servidor DNS"]] },
    ];
    let index = 0; const prompt = root.querySelector("[data-arp-rf-prompt]"); const options = root.querySelector("[data-arp-rf-options]"); const feedback = root.querySelector("[data-arp-rf-feedback]");
    function render() { prompt.textContent = items[index].prompt; options.replaceChildren(); feedback.textContent = ""; items[index].options.forEach(([key, text]) => { const button = document.createElement("button"); button.type = "button"; button.textContent = text; button.addEventListener("click", () => { if (key === "wrong") { button.disabled = true; button.classList.add("is-wrong"); feedback.textContent = "Observe o IPv4 procurado e quem declara possuí-lo."; return; } button.classList.add("is-correct"); [...options.querySelectorAll("button")].forEach((item) => { item.disabled = true; }); if (index === 1) feedback.textContent = "Correto. Request e Reply recuperados."; else { feedback.textContent = "Correto."; const next = document.createElement("button"); next.type = "button"; next.textContent = "Próximo →"; next.addEventListener("click", () => { index += 1; render(); }); options.appendChild(next); } }); options.appendChild(button); }); }
    render();
  }

  function setupAssignments({ rootSelector, prefix, correct, feedbackSelector, success, wrong, onSuccess }) {
    const root = document.querySelector(rootSelector); if (!root) return;
    const tokens = [...root.querySelectorAll(`[data-${prefix}-token]`)]; const slots = [...root.querySelectorAll(`[data-${prefix}-slot]`)]; const assignments = {}; let selected = null; let done = false;
    function render() { tokens.forEach((button) => { const id = button.dataset[`${prefix}Token`]; button.classList.toggle("is-selected", selected === id); button.disabled = done || Object.hasOwn(assignments, id); }); slots.forEach((slot) => { const slotId = slot.dataset[`${prefix}Slot`]; const tokenId = Object.keys(assignments).find((id) => assignments[id] === slotId); slot.querySelector("span").textContent = tokenId ? tokens.find((button) => button.dataset[`${prefix}Token`] === tokenId).textContent : "Posicionar"; slot.disabled = done; }); }
    tokens.forEach((button) => button.addEventListener("click", () => { selected = button.dataset[`${prefix}Token`]; render(); }));
    slots.forEach((slot) => slot.addEventListener("click", () => { const slotId = slot.dataset[`${prefix}Slot`]; if (selected) { Object.keys(assignments).forEach((id) => { if (assignments[id] === slotId) delete assignments[id]; }); assignments[selected] = slotId; selected = null; } else { const current = Object.keys(assignments).find((id) => assignments[id] === slotId); if (current) delete assignments[current]; } render(); }));
    root.querySelector(`[data-${prefix}-check]`).addEventListener("click", () => { const valid = Object.keys(correct).every((id) => assignments[id] === correct[id]) && Object.keys(assignments).length === Object.keys(correct).length; root.querySelector(feedbackSelector).textContent = valid ? success : wrong; if (valid) { done = true; if (onSuccess) onSuccess(); } render(); }); render();
  }

  function setupCacheReuse() {
    const root = document.querySelector("[data-cache-reuse]"); if (!root) return; const feedback = root.querySelector("[data-cache-reuse-feedback]");
    root.querySelectorAll("[data-cache-choice]").forEach((button) => button.addEventListener("click", () => { if (button.dataset.cacheChoice !== "reuse") { button.disabled = true; button.classList.add("is-wrong"); feedback.textContent = button.dataset.cacheChoice === "dns" ? "DNS não fornece essa associação IPv4 → MAC." : "Uma nova descoberta imediata não é obrigatória quando a entrada útil já existe."; return; } button.classList.add("is-correct"); root.querySelectorAll("[data-cache-choice]").forEach((item) => { item.disabled = true; }); root.querySelector("[data-cache-execute]").hidden = false; feedback.textContent = "Previsão correta. Agora observe o uso direto."; }));
    root.querySelector("[data-cache-execute]").addEventListener("click", (event) => { root.querySelector("[data-cache-frame]").hidden = false; event.currentTarget.disabled = true; });
  }

  function setupRemoteRequest() {
    setupAssignments({ rootSelector: "[data-remote-request]", prefix: "remote", correct: { gateway: "target", source: "tell" }, feedbackSelector: "[data-remote-feedback]", success: "Correto. O Request procura o gateway e identifica PC-A como solicitante.", wrong: "Who has recebe o IPv4 do próximo salto local; Tell recebe o IPv4 de PC-A.", onSuccess: () => { document.querySelector("[data-remote-use-group]").hidden = false; } });
    const root = document.querySelector("[data-remote-request]"); if (!root) return; root.querySelectorAll("button[data-remote-use]").forEach((button) => button.addEventListener("click", () => { const feedback = root.querySelector("[data-remote-feedback]"); if (button.dataset.remoteUse !== "destination") { button.disabled = true; button.classList.add("is-wrong"); feedback.textContent = "O MAC aprendido representa quem receberá o primeiro frame localmente."; return; } button.classList.add("is-correct"); root.querySelectorAll("button[data-remote-use]").forEach((item) => { item.disabled = true; }); feedback.textContent = "Correto. O MAC do gateway ocupa Destination MAC do primeiro frame."; }));
  }

  function setupArpTerminal() {
    const root = document.querySelector("[data-arp-terminal]"); if (!root) return; const form = root.querySelector("[data-terminal-form]"); const input = root.querySelector("[data-terminal-input]"); const stage = root.querySelector("[data-terminal-stage]"); const feedback = root.querySelector("[data-terminal-feedback]"); let phase = "before"; let missingSolved = false;
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); form.requestSubmit(); } });
    function command(text) { const line = document.createElement("div"); line.className = "terminal-history-command"; line.textContent = `C:\\Users\\Aluno> ${text}`; stage.appendChild(line); }
    function output(text, className = "") { const pre = document.createElement("pre"); pre.className = className; pre.textContent = text; stage.appendChild(pre); }
    form.addEventListener("submit", (event) => { event.preventDefault(); const value = input.value.trim().replace(/\s+/g, " ").toLowerCase(); if (!value) return; command(value); input.value = "";
      if (value === "cls" || value === "clear") { stage.replaceChildren(); return; }
      if (value === "help") { output("arp -a\nping 192.168.10.80\ncls\nhelp"); return; }
      if (value === "arp -a") { output(phase === "after" ? "Interface: 192.168.10.25\n\nInternet Address      Physical Address\n192.168.10.1          11-11-11-11-11-11\n192.168.10.80         BB-BB-BB-BB-BB-BB\n192.168.10.90         CC-CC-CC-CC-CC-CC" : "Interface: 192.168.10.25\n\nInternet Address      Physical Address\n192.168.10.1          11-11-11-11-11-11\n192.168.10.90         CC-CC-CC-CC-CC-CC", phase === "after" ? "terminal-after-cache" : ""); if (phase === "before") { root.querySelector("[data-terminal-analysis]").hidden = false; feedback.textContent = "Analise o que falta antes de gerar a comunicação."; } else { feedback.textContent = "Nova associação destacada: .80 → BB-BB..."; document.querySelector("[data-terminal-rf]").hidden = false; } return; }
      if (value === "ping 192.168.10.80") { if (!missingSolved) { output("Antes, identifique a informação ausente na análise acima.", "terminal-command-error"); return; } output("Disparando 192.168.10.80...\nResolução ARP concluída para este cenário."); phase = "after"; feedback.textContent = "Execute arp -a novamente para observar a mudança."; return; }
      output(`'${value}' não é reconhecido neste cenário.`, "terminal-command-error");
    });
    root.querySelectorAll("[data-terminal-missing]").forEach((button) => button.addEventListener("click", () => { if (button.dataset.terminalMissing !== "mac") { button.disabled = true; button.classList.add("is-wrong"); feedback.textContent = "A saída já fornece gateway; porta TCP e nome DNS não completam o endereço Ethernet."; return; } missingSolved = true; button.classList.add("is-correct"); root.querySelectorAll("[data-terminal-missing]").forEach((item) => { item.disabled = true; }); feedback.textContent = "Correto. Digite ping 192.168.10.80 para gerar a comunicação."; }));
    const rapid = document.querySelector("[data-terminal-rf]"); rapid.querySelectorAll("[data-terminal-rf-answer]").forEach((button) => button.addEventListener("click", () => { const message = rapid.querySelector("[data-terminal-rf-feedback]"); if (button.dataset.terminalRfAnswer !== "destination") { button.disabled = true; button.classList.add("is-wrong"); message.textContent = "O MAC aprendido pertence ao receptor desta entrega Ethernet."; return; } button.classList.add("is-correct"); rapid.querySelectorAll("[data-terminal-rf-answer]").forEach((item) => { item.disabled = true; }); message.textContent = "Correto. A associação fornece o Destination MAC."; }));
  }

  function setupRolePairing() {
    const root = document.querySelector("[data-arp-role-pairing]"); if (!root) return; const correct = { arp: "resolve", mac: "identify", frame: "transport" }; const done = new Set(); let selected = null; const feedback = root.querySelector("[data-role-feedback]");
    root.querySelectorAll("[data-role-concept]").forEach((button) => button.addEventListener("click", () => { if (!done.has(button.dataset.roleConcept)) selected = button.dataset.roleConcept; }));
    root.querySelectorAll("[data-role-action]").forEach((button) => button.addEventListener("click", () => { if (!selected) { feedback.textContent = "Selecione primeiro um conceito."; return; } if (correct[selected] !== button.dataset.roleAction) { button.classList.add("is-wrong"); feedback.textContent = "Esse verbo pertence a outro papel."; return; } done.add(selected); root.querySelector(`[data-role-concept='${selected}']`).disabled = true; button.disabled = true; button.classList.add("is-correct"); selected = null; feedback.textContent = done.size === 3 ? "Correto. ARP resolve, MAC identifica e Frame transporta." : "Par correto. Continue."; }));
  }

  function setupRecall() {
    setupAssignments({ rootSelector: "[data-arp-recall]", prefix: "recall", correct: { arp: "arp", mac: "mac", frame: "frame" }, feedbackSelector: "[data-recall-feedback]", success: "Correto. ARP obtém o MAC necessário e o frame usa essa informação.", wrong: "Recupere somente mecanismo, informação aprendida e estrutura completada.", onSuccess: () => { document.querySelector("[data-mental-gap='arp']").textContent = "ARP"; document.querySelector("[data-mental-gap='mac']").textContent = "MAC APRENDIDO"; document.querySelector("[data-mental-gap='frame']").textContent = "FRAME"; } });
  }

  function setupAsyncCheckpoint() {
    const container = document.querySelector("#arp-checkpoint"); const start = document.querySelector("[data-arp-checkpoint-start]"); if (!container || container.dataset.asyncReady === "true") return; container.dataset.asyncReady = "true";
    async function submit(form, submitter) { const data = new FormData(form); if (submitter?.name) data.append(submitter.name, submitter.value); container.style.minHeight = `${Math.max(container.offsetHeight, Number.parseFloat(container.style.minHeight) || 0)}px`; container.setAttribute("aria-busy", "true"); try { const response = await fetch(form.action, { method: "POST", body: data, headers: { "X-Requested-With": "XMLHttpRequest", "Accept": "application/json" }, credentials: "same-origin" }); if (!response.ok) throw new Error("request failed"); const payload = await response.json(); const parsed = new DOMParser().parseFromString(payload.html, "text/html").querySelector("#arp-checkpoint"); if (!parsed) throw new Error("invalid response"); container.innerHTML = parsed.innerHTML; container.removeAttribute("aria-busy"); window.NetStudyExercises?.init(); } catch (error) { container.removeAttribute("aria-busy"); container.innerHTML = '<div class="alert alert-danger">Não foi possível registrar a resposta. Tente novamente.</div>'; } }
    document.addEventListener("submit", (event) => { const form = event.target; if (form instanceof HTMLFormElement && (form === start || container.contains(form))) { event.preventDefault(); submit(form, event.submitter); } });
  }

  function setupCompleteFlow() {
    const root = document.querySelector("[data-complete-flow]");
    if (root) new ARPFlowController(root);
  }

  setupWalkthrough();
  setupParticipantExplorer();
  setupCacheDemo();
  setupScopeExplorer();
  setupTerminalRelation();
  setupConceptImages();
  setupIntroDemo();
  setupMessageLabeler();
  setupCacheReuse();
  setupRemoteRequest();
  setupArpTerminal();
  setupRolePairing();
  setupRecall();
  setupAsyncCheckpoint();
  setupCompleteFlow();
})();
