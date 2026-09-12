(() => {
  "use strict";

  const FIELD_CONTENT = {
    destination: { question: "PARA QUEM?", title: "Destination MAC", example: "BB:BB:BB:BB:BB:BB", copy: "Para qual endereço Ethernet o frame está sendo entregue.", extra: "" },
    source: { question: "DE QUEM?", title: "Source MAC", example: "AA:AA:AA:AA:AA:AA", copy: "Qual endereço Ethernet originou o frame.", extra: "" },
    type: { question: "TIPO DE CONTEÚDO", title: "Tipo", example: "", copy: "Ajuda a indicar qual protocolo está sendo transportado.", extra: "" },
    data: { question: "INFORMAÇÃO TRANSPORTADA", title: "Dados", example: "", copy: "Conteúdo transportado para a camada superior.", extra: "" },
    fcs: { question: "INTEGRIDADE", title: "FCS", example: "", copy: "Ajuda a detectar erros ocorridos durante a transmissão.", extra: "" },
  };

  function setupFieldInspector() {
    const root = document.querySelector("[data-frame-inspector]");
    if (!root) return;
    const buttons = [...root.querySelectorAll("[data-frame-field]")];
    const title = root.querySelector("[data-field-title]");
    const example = root.querySelector("[data-field-example]");
    const copy = root.querySelector("[data-field-copy]");
    const question = root.querySelector("[data-field-question]");
    const extra = root.querySelector("[data-field-extra]");
    function select(key, focus = false) {
      const data = FIELD_CONTENT[key];
      buttons.forEach((button) => {
        const selected = button.dataset.frameField === key;
        button.setAttribute("aria-pressed", String(selected));
        if (selected && focus) button.focus();
      });
      question.textContent = data.question;
      title.textContent = data.title;
      example.textContent = data.example;
      example.hidden = !data.example;
      copy.textContent = data.copy;
      extra.textContent = data.extra;
    }
    buttons.forEach((button, index) => {
      button.addEventListener("click", () => select(button.dataset.frameField));
      button.addEventListener("keydown", (event) => {
        let next = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % buttons.length;
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + buttons.length) % buttons.length;
        if (next !== null) { event.preventDefault(); select(buttons[next].dataset.frameField, true); }
      });
    });
  }

  function setupIntroFrame() {
    const root = document.querySelector("[data-intro-frame]");
    if (!root) return;
    const messages = ["Os dados ainda não estão em uma estrutura Ethernet.", "O host precisa transmitir pela Ethernet.", "Uma estrutura de entrega começa a ser preparada.", "Source MAC identifica a origem.", "Destination MAC identifica quem recebe a entrega local.", "Os dados entram na estrutura.", "O frame está pronto e é transmitido."];
    const play = root.querySelector("[data-intro-play]");
    let timers = [];
    function setStep(step) { root.dataset.step = String(step); root.querySelector("[data-intro-message]").textContent = messages[step - 1]; }
    function reset() { timers.forEach(window.clearTimeout); timers = []; play.disabled = false; play.textContent = "Ver acontecer"; setStep(1); }
    play.addEventListener("click", () => {
      reset(); play.disabled = true; play.textContent = "Acontecendo…";
      const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 650;
      for (let step = 2; step <= 7; step += 1) timers.push(window.setTimeout(() => { setStep(step); if (step === 7) { play.disabled = false; play.textContent = "Ver novamente"; } }, delay * (step - 1)));
    });
    root.querySelector("[data-intro-reset]").addEventListener("click", reset);
    reset();
  }

  function setupFirstFrameClaims() {
    const root = document.querySelector("[data-first-frame-claims]");
    if (!root) return;
    const selected = new Set();
    const correct = new Set(["local", "gateway", "ip"]);
    const buttons = [...root.querySelectorAll("[data-claim]")];
    const feedback = root.querySelector("[data-claims-feedback]");
    buttons.forEach((button) => button.addEventListener("click", () => { const key = button.dataset.claim; selected.has(key) ? selected.delete(key) : selected.add(key); button.classList.toggle("is-selected", selected.has(key)); }));
    root.querySelector("[data-claims-check]").addEventListener("click", () => {
      const valid = selected.size === correct.size && [...correct].every((key) => selected.has(key));
      if (!valid) { feedback.textContent = selected.has("intact") ? "Uma entrega Ethernet termina naquele enlace; o mesmo frame não atravessa intacto toda a Internet." : selected.has("remote-mac") ? "O primeiro frame é entregue localmente ao gateway, não diretamente ao MAC do host remoto." : "Considere simultaneamente a entrega Ethernet local, o gateway e o destino IP final."; return; }
      feedback.textContent = "Correto. O primeiro frame é uma entrega local ao gateway, enquanto o destino IPv4 final pode continuar sendo 8.8.8.8.";
      buttons.forEach((button) => { button.disabled = true; button.classList.toggle("is-correct", correct.has(button.dataset.claim)); });
    });
  }

  function setupLocalBuilder({ rootSelector, prefix, correct, success, wrong, onSuccess }) {
    const root = document.querySelector(rootSelector);
    if (!root) return null;
    const key = `${prefix}Token`;
    const slotKey = `${prefix}Slot`;
    const tokens = [...root.querySelectorAll(`[data-${prefix}-token]`)];
    const slots = [...root.querySelectorAll(`[data-${prefix}-slot]`)];
    const feedback = root.querySelector(`[data-${prefix}-feedback]`);
    const assignments = {};
    let selected = null;
    let complete = false;
    function render() {
      tokens.forEach((button) => {
        const id = button.dataset[key];
        button.classList.toggle("is-selected", selected === id);
        button.classList.toggle("is-assigned", Object.hasOwn(assignments, id));
        button.disabled = complete || Object.hasOwn(assignments, id);
      });
      slots.forEach((slot) => {
        const id = slot.dataset[slotKey];
        const tokenId = Object.keys(assignments).find((candidate) => assignments[candidate] === id);
        slot.querySelector("span").textContent = tokenId ? tokens.find((button) => button.dataset[key] === tokenId).textContent : "Posicionar";
        slot.classList.toggle("has-value", Boolean(tokenId));
        slot.disabled = complete;
      });
    }
    tokens.forEach((button) => button.addEventListener("click", () => { selected = button.dataset[key]; render(); }));
    slots.forEach((slot) => slot.addEventListener("click", () => {
      const slotId = slot.dataset[slotKey];
      if (selected) {
        Object.keys(assignments).forEach((tokenId) => { if (assignments[tokenId] === slotId) delete assignments[tokenId]; });
        assignments[selected] = slotId;
        selected = null;
      } else {
        const placed = Object.keys(assignments).find((tokenId) => assignments[tokenId] === slotId);
        if (placed) delete assignments[placed];
      }
      render();
    }));
    root.querySelector(`[data-${prefix}-check]`).addEventListener("click", () => {
      const valid = Object.keys(correct).every((tokenId) => assignments[tokenId] === correct[tokenId]) && Object.keys(assignments).length === Object.keys(correct).length;
      if (valid) {
        complete = true;
        feedback.textContent = success;
        root.classList.add("is-complete");
        if (onSuccess) onSuccess(assignments);
      } else {
        feedback.textContent = typeof wrong === "function" ? wrong(assignments) : wrong;
        root.classList.add("has-error");
      }
      render();
    });
    render();
    return { isComplete: () => complete };
  }

  function setupInlineBuilders() {
    setupLocalBuilder({ rootSelector: "[data-field-builder]", prefix: "field", correct: { "mac-a": "source", "mac-b": "destination", ipv4: "type" }, success: "Correto. As evidências permitem determinar Source MAC, Destination MAC e Tipo. Os dados já estão indicados, e não precisamos calcular FCS manualmente.", wrong: (assignments) => Object.hasOwn(assignments, "ip-a") ? "Este campo espera endereçamento Ethernet, não um endereço IPv4." : Object.hasOwn(assignments, "manual-fcs") ? "Neste ponto do curso não há informação nem necessidade para calcular esse campo." : "Use somente as informações que o cenário permite determinar conceitualmente." });
    setupLocalBuilder({ rootSelector: "[data-remote-builder]", prefix: "remote", correct: { "remote-ip": "ip", "gateway-mac": "mac" }, success: "Correto. O IP continua remoto e o Destination MAC do primeiro frame pertence ao gateway.", wrong: (assignments) => assignments["gateway-ip"] === "ip" ? "O gateway recebe o primeiro frame localmente, mas não substitui o destino IP final." : assignments["remote-mac"] === "mac" ? "O host remoto não recebe diretamente o primeiro frame da LAN." : "Separe o destino IP final do dispositivo que recebe o primeiro frame localmente.", onSuccess: () => { document.querySelector("[data-remote-reveal]").hidden = false; } });
    setupLocalBuilder({ rootSelector: "[data-model-recall]", prefix: "model", correct: { frame: "frame", arp: "arp", learned: "learned" }, success: "Correto. O modelo mental está completo.", wrong: "Recupere a sequência: estrutura necessária, mecanismo de descoberta e informação aprendida.", onSuccess: () => { document.querySelector("[data-model-gap='frame']").textContent = "CONSTRUO UM FRAME"; document.querySelector("[data-model-gap='arp']").textContent = "ARP PODE DESCOBRIR"; document.querySelector("[data-model-gap='learned']").textContent = "MAC APRENDIDO"; } });
  }

  function setupDirection() {
    const root = document.querySelector("[data-frame-direction]");
    if (!root) return;
    const buttons = [...root.querySelectorAll("[data-direction]")];
    const values = {
      "a-b": { source: "AA:AA:AA:AA:AA:AA", destination: "BB:BB:BB:BB:BB:BB", sourceName: "PC-A", destinationName: "PC-B" },
      "b-a": { source: "BB:BB:BB:BB:BB:BB", destination: "AA:AA:AA:AA:AA:AA", sourceName: "PC-B", destinationName: "PC-A" },
    };
    function applyDirection(key) {
      const data = values[key];
      buttons.forEach((item) => item.setAttribute("aria-pressed", String(item.dataset.direction === key)));
      root.querySelector("[data-direction-source]").textContent = data.source;
      root.querySelector("[data-direction-destination]").textContent = data.destination;
      root.querySelector("[data-direction-source-name]").textContent = data.sourceName;
      root.querySelector("[data-direction-destination-name]").textContent = data.destinationName;
    }
    buttons[0].addEventListener("click", () => applyDirection("a-b"));
    const prediction = root.querySelector("[data-direction-prediction]");
    buttons[1].addEventListener("click", () => { prediction.hidden = false; prediction.querySelector("[data-change-answer='both']").focus(); });
    prediction.querySelectorAll("[data-change-answer]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.changeAnswer !== "both") { button.disabled = true; button.classList.add("is-wrong"); prediction.querySelector("[data-predict-feedback]").textContent = "Quando a direção se inverte, muda quem origina e quem recebe aquele frame."; return; }
      button.classList.add("is-correct"); prediction.querySelectorAll("[data-change-answer]").forEach((candidate) => { candidate.disabled = true; }); prediction.querySelector("[data-direction-addresses]").hidden = false; prediction.querySelector("[data-predict-feedback]").textContent = "Correto. Agora determine os dois novos valores.";
    }));
    setupLocalBuilder({ rootSelector: "[data-direction-prediction]", prefix: "predict", correct: { b: "source", a: "destination" }, success: "Os dois campos mudam porque outro dispositivo passa a originar o frame e o antigo emissor passa a ser o destino Ethernet.", wrong: "Na resposta, PC-B origina o novo frame e PC-A recebe a entrega Ethernet.", onSuccess: () => {
      applyDirection("b-a"); const rapidFire = root.querySelector("[data-direction-rapid-fire]"); rapidFire.hidden = false; if (!rapidFire.dataset.ready) { rapidFire.dataset.ready = "true"; setupDirectionRapidFire(rapidFire); }
    } });
  }

  const DIRECTION_RAPID_FIRE = [
    { prompt: "PC-A → PC-B · Source MAC pertence a:", options: [["a", "PC-A"], ["b", "PC-B"]], correct: "a" },
    { prompt: "PC-B → PC-A · Destination MAC pertence a:", options: [["a", "PC-A"], ["b", "PC-B"]], correct: "a" },
  ];

  function setupDirectionRapidFire(root) {
    let index = 0;
    const prompt = root.querySelector("[data-rf-direction-prompt]");
    const options = root.querySelector("[data-rf-direction-options]");
    const feedback = root.querySelector("[data-rf-direction-feedback]");
    function render() {
      const item = DIRECTION_RAPID_FIRE[index];
      prompt.textContent = item.prompt;
      options.replaceChildren();
      feedback.textContent = "";
      item.options.forEach(([key, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => {
          if (key !== item.correct) { button.classList.add("is-wrong"); button.disabled = true; feedback.textContent = "Observe a direção deste frame específico."; return; }
          button.classList.add("is-correct");
          [...options.querySelectorAll("button")].forEach((candidate) => { candidate.disabled = true; });
          if (index === DIRECTION_RAPID_FIRE.length - 1) { feedback.textContent = "Ótimo. A direção do frame determina quem ocupa Source e Destination."; return; }
          feedback.textContent = "Correto.";
          const next = document.createElement("button");
          next.type = "button";
          next.textContent = "Próximo →";
          next.addEventListener("click", () => { index += 1; render(); });
          options.appendChild(next);
        });
        options.appendChild(button);
      });
    }
    render();
  }

  const BUILD_STEPS = [
    { title: "Existem dados para enviar", copy: "PC-A possui informação que precisa ser enviada pela Ethernet.", source: "?", destination: "?" },
    { title: "Identificar a origem", copy: "O frame é originado pela interface Ethernet de PC-A.", source: "AA:AA:AA:AA:AA:AA", destination: "?", focus: "a" },
    { title: "Identificar o destino Ethernet", copy: "Para esta entrega local, PC-B é o destino Ethernet.", source: "AA:AA:AA:AA:AA:AA", destination: "BB:BB:BB:BB:BB:BB", focus: "b" },
    { title: "Montar o frame", copy: "Destination MAC, Source MAC e os dados entram na estrutura simplificada.", source: "AA:AA:AA:AA:AA:AA", destination: "BB:BB:BB:BB:BB:BB" },
    { title: "Transmitir", copy: "O frame agora pode atravessar o enlace Ethernet em direção ao destino.", source: "AA:AA:AA:AA:AA:AA", destination: "BB:BB:BB:BB:BB:BB", transmitting: true },
  ];

  function setupBuildFrame() {
    const root = document.querySelector("[data-build-frame]");
    if (!root) return;
    let step = 0;
    const previous = root.querySelector("[data-build-previous]");
    const next = root.querySelector("[data-build-next]");
    const topology = root.querySelector(".build-topology");
    function render() {
      const data = BUILD_STEPS[step];
      root.querySelector("[data-build-current]").textContent = String(step + 1);
      root.querySelector("[data-build-title]").textContent = data.title;
      root.querySelector("[data-build-copy]").textContent = data.copy;
      root.querySelector("[data-build-source]").textContent = data.source;
      root.querySelector("[data-build-destination]").textContent = data.destination;
      root.querySelectorAll("[data-build-node]").forEach((node) => node.classList.toggle("is-focus", node.dataset.buildNode === data.focus));
      topology.classList.toggle("is-transmitting", Boolean(data.transmitting));
      previous.disabled = step === 0;
      next.disabled = step === BUILD_STEPS.length - 1;
    }
    previous.addEventListener("click", () => { step = Math.max(0, step - 1); render(); });
    next.addEventListener("click", () => {
      step = Math.min(BUILD_STEPS.length - 1, step + 1);
      render();
    });
    root.querySelector("[data-build-reset]").addEventListener("click", () => { step = 0; render(); });
    render();
  }

  const INTEGRATION_STEPS = [
    { message: "Destino IPv4: 192.168.10.20\nDestination MAC: ?", mac: "???", destination: "?" },
    { message: "Quem tem 192.168.10.20?", mac: "???", destination: "?" },
    { message: "192.168.10.20 está em\nBB:BB:BB:BB:BB:BB", mac: "BB:BB:BB:BB:BB:BB", destination: "?" },
    { message: "MAC aprendido e utilizado no frame.", mac: "BB:BB:BB:BB:BB:BB", destination: "BB:BB:BB:BB:BB:BB" },
  ];

  function setupIntegration() {
    const root = document.querySelector("[data-arp-frame-demo]");
    if (!root) return;
    let step = 0;
    const next = root.querySelector("[data-integration-next]");
    function render() {
      const data = INTEGRATION_STEPS[step];
      root.querySelector("[data-integration-message]").textContent = data.message;
      root.querySelector("[data-integration-mac]").textContent = data.mac;
      root.querySelector("[data-integration-frame-dest]").textContent = data.destination;
      next.disabled = step === INTEGRATION_STEPS.length - 1;
    }
    next.addEventListener("click", () => { step = Math.min(INTEGRATION_STEPS.length - 1, step + 1); render(); });
    root.querySelector("[data-integration-reset]").addEventListener("click", () => { step = 0; render(); });
    render();
  }

  function setupConnectTerminal() {
    const root = document.querySelector("[data-connect-terminal]");
    if (!root) return;
    const form = root.querySelector("[data-terminal-form]");
    const input = root.querySelector("[data-terminal-input]");
    const feedback = root.querySelector("[data-terminal-feedback]");
    const stage = root.querySelector("[data-terminal-stage]");
    const screen = root.querySelector("[data-terminal-screen]");
    let phase = "before";
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); form.requestSubmit(); } });
    function appendCommand(command) { const line = document.createElement("div"); line.className = "terminal-history-command"; line.textContent = `C:\\Users\\Aluno> ${command}`; stage.appendChild(line); }
    function appendOutput(text, className = "") { const output = document.createElement("pre"); output.className = className; output.textContent = text; stage.appendChild(output); screen.scrollTop = screen.scrollHeight; }
    function addPresenceQuestion() {
      const question = document.createElement("div");
      question.className = "terminal-question";
      question.innerHTML = "<p>Existe uma associação para <code>192.168.10.80</code>?</p>";
      [["yes", "Sim"], ["no", "Não"]].forEach(([key, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => {
          if (key === "yes") { button.disabled = true; button.classList.add("is-wrong"); feedback.textContent = "Observe os IPv4 exibidos na tabela e procure exatamente 192.168.10.80."; return; }
          feedback.textContent = "Exato. O IPv4 que queremos alcançar não possui uma associação MAC conhecida nessa tabela.";
          [...question.querySelectorAll("button")].forEach((candidate) => { candidate.disabled = true; });
          const resolve = document.createElement("button");
          resolve.type = "button";
          resolve.textContent = "Executar resolução visual →";
          resolve.addEventListener("click", () => {
            phase = "after-resolution";
            const visual = document.createElement("div"); visual.className = "arp-resolution-visual"; visual.innerHTML = "<span>Who has 192.168.10.80?</span><b>↓</b><span>192.168.10.80 is at<br>BB:BB:BB:BB:BB:BB</span>"; stage.appendChild(visual);
            input.value = "";
            input.focus();
            feedback.textContent = "A resolução ocorreu. Execute arp -a novamente para observar a nova associação.";
          });
          question.appendChild(resolve);
        });
        question.appendChild(button);
      });
      stage.appendChild(question);
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const command = input.value.trim().replace(/\s+/g, " ").toLowerCase();
      if (!command) return;
      appendCommand(command); input.value = "";
      if (command === "cls" || command === "clear") { stage.replaceChildren(); feedback.textContent = "Terminal limpo."; return; }
      if (command === "help") { appendOutput("Comandos disponíveis:\n  arp -a   Exibe associações IPv4 → MAC\n  cls      Limpa a tela\n  clear    Limpa a tela\n  help     Exibe esta ajuda"); feedback.textContent = "Ajuda exibida."; return; }
      if (command !== "arp -a") { appendOutput(`'${command}' não é reconhecido neste laboratório simulado.\nDigite help para ver os comandos disponíveis.`, "terminal-command-error"); feedback.textContent = "Comando não reconhecido neste cenário simulado."; return; }
      if (phase === "before") {
        phase = "first-output";
        appendOutput("Interface: 192.168.10.25\n\nInternet Address      Physical Address\n192.168.10.1          11-11-11-11-11-11\n192.168.10.90         CC-CC-CC-CC-CC-CC");
        feedback.textContent = "Tabela consultada.";
        addPresenceQuestion();
      } else if (phase === "after-resolution") {
        phase = "complete";
        appendOutput("Internet Address      Physical Address\n192.168.10.1          11-11-11-11-11-11\n192.168.10.80         BB-BB-BB-BB-BB-BB\n192.168.10.90         CC-CC-CC-CC-CC-CC", "terminal-after-cache");
        const result = document.createElement("p"); result.className = "terminal-result"; result.innerHTML = "<strong>Nova associação destacada: 192.168.10.80 → BB-BB-BB-BB-BB-BB</strong><br>Destination MAC: BB:BB:BB:BB:BB:BB"; stage.appendChild(result);
        feedback.textContent = "ARP forneceu a informação que faltava para endereçar o frame.";
        document.querySelector("[data-delayed-source-rf]").hidden = false;
      } else {
        appendOutput("Internet Address      Physical Address\n192.168.10.1          11-11-11-11-11-11\n192.168.10.80         BB-BB-BB-BB-BB-BB\n192.168.10.90         CC-CC-CC-CC-CC-CC");
      }
      input.focus(); screen.scrollTop = screen.scrollHeight;
    });
  }

  function setupDelayedSourceRapidFire() {
    const root = document.querySelector("[data-delayed-source-rf]");
    if (!root) return;
    root.querySelectorAll("[data-delayed-answer]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.delayedAnswer === "b") { button.classList.add("is-correct"); root.querySelector("[data-delayed-feedback]").textContent = "Correto. PC-B origina o frame de resposta, então seu MAC ocupa Source."; root.querySelectorAll("button").forEach((candidate) => { candidate.disabled = true; }); }
      else { button.classList.add("is-wrong"); button.disabled = true; root.querySelector("[data-delayed-feedback]").textContent = "A resposta segue de PC-B para PC-A. Observe quem está originando esse novo frame."; }
    }));
  }

  function setupCaptureExperiment() {
    const root = document.querySelector("[data-packet-inspector]");
    if (!root) return;
    const selected = new Set();
    const buttons = [...root.querySelectorAll("[data-capture-value]")];
    const feedback = root.querySelector("[data-capture-feedback]");
    root.querySelectorAll("[data-inspector-layer]").forEach((toggle) => toggle.addEventListener("click", () => {
      const section = toggle.closest("[data-inspector-section]"); const fields = section.querySelector(".inspector-fields"); const open = fields.hidden; fields.hidden = !open; toggle.setAttribute("aria-expanded", String(open)); toggle.querySelector("span").textContent = open ? "⌄" : "›"; section.classList.toggle("is-open", open);
    }));
    buttons.forEach((button) => button.addEventListener("click", () => {
      const value = button.dataset.captureValue;
      if (value.startsWith("ip-")) feedback.textContent = "Esse valor pertence ao endereçamento IPv4. Procure as informações da entrega Ethernet.";
      if (selected.has(value)) selected.delete(value); else if (selected.size < 2) selected.add(value);
      button.classList.toggle("is-selected", selected.has(value));
    }));
    root.querySelector("[data-capture-check]").addEventListener("click", () => {
      const correct = selected.size === 2 && selected.has("mac-source") && selected.has("mac-destination");
      if (!correct) { feedback.textContent = selected.size !== 2 ? "Selecione exatamente dois valores." : "Esses valores identificam origem e destino IP, mas a pergunta está pedindo especificamente o endereçamento Ethernet."; return; }
      feedback.textContent = "Correto. Source MAC e Destination MAC identificam a entrega Ethernet observada.";
      buttons.forEach((button) => { button.disabled = true; button.classList.toggle("is-correct", selected.has(button.dataset.captureValue)); });
      document.querySelector("[data-type-rapid-fire]").hidden = false;
    });
  }

  function setupRolePairing() {
    const root = document.querySelector("[data-role-pairing]");
    if (!root) return;
    const correct = { frame: "structure", mac: "address", arp: "mechanism", switch: "equipment" };
    const labels = { frame: "Frame Ethernet", mac: "MAC", arp: "ARP", switch: "Switch", structure: "estrutura transmitida", address: "endereço Ethernet", mechanism: "mecanismo de resolução", equipment: "equipamento" };
    const pairs = {};
    let left = null;
    const feedback = root.querySelector("[data-pair-feedback]");
    root.querySelectorAll("[data-pair-left]").forEach((button) => button.addEventListener("click", () => { if (pairs[button.dataset.pairLeft]) return; left = button.dataset.pairLeft; root.querySelectorAll("[data-pair-left]").forEach((candidate) => candidate.classList.toggle("is-selected", candidate === button)); feedback.textContent = "Agora selecione o papel correspondente."; }));
    root.querySelectorAll("[data-pair-right]").forEach((button) => button.addEventListener("click", () => {
      if (!left) { feedback.textContent = "Selecione primeiro um conceito do lado esquerdo."; return; }
      const role = button.dataset.pairRight;
      if (correct[left] !== role) { button.classList.add("is-wrong"); feedback.textContent = "Esse papel pertence a outro conceito. Compare as definições logo acima."; return; }
      pairs[left] = role; button.disabled = true; button.classList.add("is-correct"); const leftButton = root.querySelector(`[data-pair-left='${left}']`); leftButton.disabled = true; leftButton.classList.remove("is-selected"); leftButton.classList.add("is-correct");
      const row = document.createElement("div"); row.innerHTML = `<strong>${labels[left]}</strong><span>─────────</span><b>${labels[role]}</b>`; root.querySelector("[data-pair-results]").appendChild(row); left = null;
      if (Object.keys(pairs).length === 4) { feedback.textContent = "Correto. Os quatro papéis estão conectados."; root.querySelector("[data-pair-closure]").hidden = false; }
    }));
    root.querySelectorAll("[data-closure-answer]").forEach((button) => button.addEventListener("click", () => { const closure = root.querySelector("[data-closure-feedback]"); if (button.dataset.closureAnswer === "correct") { button.classList.add("is-correct"); closure.textContent = "Correto. ARP procura, MAC identifica, Frame transporta e o switch trabalha com frames."; root.querySelectorAll("[data-closure-answer]").forEach((candidate) => { candidate.disabled = true; }); } else { button.classList.add("is-wrong"); button.disabled = true; closure.textContent = "A sequência conecta mecanismo, endereço, estrutura e equipamento — um não se transforma no outro."; } }));
  }

  function setupAsyncCheckpoint() {
    const container = document.querySelector("#frame-checkpoint");
    const start = document.querySelector("[data-checkpoint-start]");
    if (!container || container.dataset.asyncReady === "true") return;
    container.dataset.asyncReady = "true";
    async function submit(form, submitter) {
      const data = new FormData(form);
      if (submitter?.name) data.append(submitter.name, submitter.value);
      const stableHeight = Math.max(container.offsetHeight, Number.parseFloat(container.style.minHeight) || 0);
      container.style.minHeight = `${stableHeight}px`;
      container.setAttribute("aria-busy", "true");
      try {
        const response = await fetch(form.action, { method: "POST", body: data, headers: { "X-Requested-With": "XMLHttpRequest", "Accept": "application/json" }, credentials: "same-origin" });
        if (!response.ok) throw new Error("request failed");
        const payload = await response.json();
        const parsed = new DOMParser().parseFromString(payload.html, "text/html").querySelector("#frame-checkpoint");
        if (!parsed) throw new Error("invalid response");
        container.innerHTML = parsed.innerHTML;
        container.removeAttribute("aria-busy");
        window.NetStudyExercises?.init();
      } catch (error) {
        container.removeAttribute("aria-busy");
        let message = container.querySelector("[data-checkpoint-network-error]");
        if (!message) { message = document.createElement("div"); message.dataset.checkpointNetworkError = ""; message.className = "alert alert-danger checkpoint-network-error"; container.prepend(message); }
        message.textContent = "Não foi possível registrar sua resposta. Tente novamente.";
      }
    }
    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form === start || container.contains(form)) { event.preventDefault(); submit(form, event.submitter); }
    });
  }

  function setupTypeRapidFire() {
    const root = document.querySelector("[data-type-rapid-fire]");
    if (!root) return;
    root.querySelectorAll("[data-type-answer]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.typeAnswer === "protocol") { button.classList.add("is-correct"); root.querySelector("[data-type-feedback]").textContent = "Correto. O campo ajuda a indicar qual protocolo está sendo transportado."; root.querySelectorAll("button").forEach((candidate) => { candidate.disabled = true; }); }
      else { button.classList.add("is-wrong"); button.disabled = true; root.querySelector("[data-type-feedback]").textContent = "Recupere a função conceitual observada quando o frame foi aberto."; }
    }));
  }

  function setupTabs(rootSelector, tabSelector, panelSelector, tabKey, panelKey) {
    const root = document.querySelector(rootSelector);
    if (!root) return;
    const tabs = [...root.querySelectorAll(tabSelector)];
    const panels = [...root.querySelectorAll(panelSelector)];
    function select(value, focus = false) {
      tabs.forEach((tab) => {
        const active = tab.dataset[tabKey] === value;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
        if (active && focus) tab.focus();
      });
      panels.forEach((panel) => {
        const active = panel.dataset[panelKey] === value;
        if (panel.hasAttribute("role")) panel.hidden = !active;
        panel.classList.toggle("is-active", active);
      });
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => select(tab.dataset[tabKey]));
      tab.addEventListener("keydown", (event) => {
        let next = null;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabs.length - 1;
        if (next !== null) { event.preventDefault(); select(tabs[next].dataset[tabKey], true); }
      });
    });
    select(tabs[0].dataset[tabKey]);
  }

  const FULL_STEPS = [
    { title: "Aplicação possui dados", copy: "Existe informação a transmitir.", data: true },
    { title: "Ethernet precisa de um destino", copy: "O MAC de origem é conhecido, mas ainda falta o endereço Ethernet de destino.", frame: true },
    { title: "ARP é necessário", copy: "PC-A pergunta: quem tem 192.168.10.20?", frame: true, path: "request", message: "Quem tem 192.168.10.20?" },
    { title: "ARP Reply", copy: "PC-B informa o endereço MAC correspondente.", frame: true, path: "reply", message: "192.168.10.20 está em BB:BB:BB:BB:BB:BB" },
    { title: "MAC aprendido", copy: "A associação é atualizada e o Destination MAC pode ser preenchido.", frame: true, learned: true },
    { title: "Frame completo", copy: "Destination MAC, Source MAC e dados estão prontos para transmissão.", frame: true, learned: true, message: "PRONTO PARA TRANSMITIR" },
    { title: "Frame enviado", copy: "O frame atravessa a rede Ethernet em direção ao destino.", frame: true, learned: true, path: "frame" },
  ];

  class FullFlowController {
    constructor(root) {
      this.root = root;
      this.step = 0;
      this.playing = false;
      this.hasPlayed = false;
      this.timer = null;
      this.unlocked = { arp: false, destination: false };
      this.predictions = [...root.querySelectorAll("[data-prediction]")];
      this.playButton = root.querySelector("[data-full-play]");
      this.pauseButton = root.querySelector("[data-full-pause]");
      this.previousButton = root.querySelector("[data-full-previous]");
      this.nextButton = root.querySelector("[data-full-next]");
      this.bind();
      this.bindPredictions();
      this.render();
    }
    bind() {
      this.playButton.addEventListener("click", () => this.play());
      this.pauseButton.addEventListener("click", () => this.pause());
      this.previousButton.addEventListener("click", () => { this.pause(); this.setStep(this.step - 1); });
      this.nextButton.addEventListener("click", () => { this.pause(); this.requestAdvance(); });
      this.root.querySelector("[data-full-reset]").addEventListener("click", () => this.reset());
    }
    bindPredictions() {
      const correct = { arp: "arp", destination: "destination" };
      this.predictions.forEach((panel) => {
        const key = panel.dataset.prediction;
        const feedback = panel.querySelector("[data-prediction-feedback]");
        const continuation = panel.querySelector("[data-prediction-continue]");
        panel.querySelectorAll("[data-prediction-answer]").forEach((button) => button.addEventListener("click", () => {
          if (button.dataset.predictionAnswer !== correct[key]) { button.disabled = true; button.classList.add("is-wrong"); feedback.textContent = key === "arp" ? "O Destination MAC ainda precisa ser descoberto antes da transmissão." : "A associação retornada fornece o endereço Ethernet de destino."; return; }
          button.classList.add("is-correct");
          panel.querySelectorAll("[data-prediction-answer]").forEach((candidate) => { candidate.disabled = true; });
          feedback.textContent = "Correto. Agora continue a animação.";
          continuation.hidden = false;
        }));
        continuation.addEventListener("click", () => {
          this.unlocked[key] = true;
          panel.hidden = true;
          this.setStep(this.step + 1);
        });
      });
    }
    showPrediction(key) {
      this.pause();
      this.predictions.forEach((panel) => { panel.hidden = panel.dataset.prediction !== key; });
    }
    requestAdvance() {
      if (this.step === 1 && !this.unlocked.arp) { this.showPrediction("arp"); return false; }
      if (this.step === 3 && !this.unlocked.destination) { this.showPrediction("destination"); return false; }
      this.setStep(this.step + 1);
      return true;
    }
    setStep(value) { this.step = Math.max(0, Math.min(FULL_STEPS.length - 1, value)); this.render(); }
    play() { if (this.step === FULL_STEPS.length - 1) this.step = 0; this.playing = true; this.hasPlayed = true; this.render(); this.schedule(); }
    pause() { window.clearTimeout(this.timer); this.timer = null; this.playing = false; this.render(); }
    reset() {
      this.pause(); this.step = 0; this.hasPlayed = false; this.unlocked = { arp: false, destination: false };
      this.predictions.forEach((panel) => { panel.hidden = true; panel.querySelector("[data-prediction-feedback]").textContent = ""; panel.querySelector("[data-prediction-continue]").hidden = true; panel.querySelectorAll("[data-prediction-answer]").forEach((button) => { button.disabled = false; button.classList.remove("is-correct", "is-wrong"); }); });
      this.render();
    }
    schedule() {
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => {
        if (!this.playing) return;
        const advanced = this.requestAdvance();
        if (advanced && this.step < FULL_STEPS.length - 1) this.schedule(); else this.pause();
      }, 2600);
    }
    render() {
      const data = FULL_STEPS[this.step];
      this.root.dataset.step = String(this.step + 1);
      this.root.dataset.playing = String(this.playing);
      this.root.querySelector("[data-full-current]").textContent = String(this.step + 1);
      this.root.querySelector("[data-full-title]").textContent = data.title;
      this.root.querySelector("[data-full-copy]").textContent = data.copy;
      this.root.querySelector("[data-full-cache]").textContent = data.learned ? "192.168.10.20 → BB:BB:BB:BB:BB:BB" : "192.168.10.20 → não conhecido";
      this.root.querySelector("[data-full-destination]").textContent = data.learned ? "BB:BB:BB:BB:BB:BB" : "?";
      this.root.querySelector("[data-full-data]").style.opacity = data.data ? "1" : ".25";
      this.root.querySelectorAll("[data-full-path]").forEach((path) => path.classList.toggle("is-active", path.dataset.fullPath === data.path));
      this.root.querySelectorAll("[data-full-node]").forEach((node) => node.classList.toggle("is-focus", Boolean(data.path)));
      const message = this.root.querySelector("[data-full-message]");
      message.textContent = data.message || "";
      message.classList.toggle("is-visible", Boolean(data.message));
      message.classList.toggle("is-reply", data.path === "reply" || data.learned);
      this.playButton.hidden = this.playing;
      this.playButton.textContent = `▶ ${this.hasPlayed ? "Continuar" : "Reproduzir"}`;
      this.pauseButton.hidden = !this.playing;
      this.previousButton.disabled = this.step === 0;
      this.nextButton.disabled = this.step === FULL_STEPS.length - 1;
    }
  }

  setupFieldInspector();
  setupIntroFrame();
  setupFirstFrameClaims();
  setupInlineBuilders();
  setupDirection();
  setupBuildFrame();
  setupIntegration();
  setupConnectTerminal();
  setupDelayedSourceRapidFire();
  setupCaptureExperiment();
  setupTypeRapidFire();
  setupRolePairing();
  setupAsyncCheckpoint();
  setupTabs("[data-frame-scope]", "[data-frame-scope-tab]", "[data-frame-scope-panel]", "frameScopeTab", "frameScopePanel");
  const fullFlow = document.querySelector("[data-frame-full-flow]");
  if (fullFlow) new FullFlowController(fullFlow);
})();
