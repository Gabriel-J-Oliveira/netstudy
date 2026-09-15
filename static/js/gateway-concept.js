(() => {
  "use strict";

  const one = (selector, scope = document) => scope?.querySelector(selector);
  const all = (selector, scope = document) => [...(scope?.querySelectorAll(selector) || [])];
  const getStage = () => window.NetStudyL3Path?.stages["gateway-shared"];
  let activeArea = "remote";

  const areaText = {
    remote: ["Área 01 · Destino remoto e próximo salto", "PC-B é remoto. Selecione o próximo dispositivo de Camada 3 local."],
    gateway: ["Área 02 · Gateway localmente alcançável", "Compare o gateway configurado com a LAN 192.168.10.0/24."],
    arp: ["Área 03 · ARP resolve o gateway", "Informe o alvo do ARP e observe o cache ganhar o MAC RR."],
    frame: ["Área 04 · Pacote × frame", "Monte os dois destinos e acompanhe o primeiro frame até R1."],
    summary: ["Área 05 · Síntese do primeiro salto", "Avance manualmente pelas seis consequências do mesmo caminho."],
  };
  const initialPhase = {remote: 0, gateway: 0, arp: 1, frame: 2, summary: 0};

  function say(node, message, ok = null) {
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("feedback-ok", ok === true);
    node.classList.toggle("feedback-error", ok === false);
  }

  function announce(selector, message, ok = null) {
    say(one(selector), message, ok);
    say(one("[data-gateway-lab-feedback]"), message, ok);
  }

  function setSummary(phase) {
    all("[data-summary-step]").forEach((item) => {
      const number = Number(item.dataset.summaryStep);
      item.classList.toggle("is-done", number <= phase);
      item.classList.toggle("is-current", number === phase);
      item.setAttribute("aria-label", `${item.textContent.trim()}: ${number <= phase ? "concluído" : "pendente"}`);
    });
    const stage = getStage();
    if (stage) announce("[data-summary-feedback]", stage.root.querySelector("[data-l3-message]").textContent);
  }

  function resetAreaUi(area) {
    if (area === "remote") announce("[data-remote-feedback]", "PC-B é o destino final. Qual dispositivo de Camada 3 recebe o primeiro frame?");
    if (area === "gateway") {
      all("[data-gateway-choice] button").forEach((button) => { button.classList.remove("is-selected", "is-wrong"); button.setAttribute("aria-pressed", "false"); });
      say(one("[data-gateway-choice] p:last-child"), "Compare cada endereço com a LAN 192.168.10.0/24.");
    }
    if (area === "arp") {
      const root = one("[data-arp-target]");
      one("input", root).value = "";
      say(one("p:last-child", root), "Informe o endereço que receberá a primeira entrega Ethernet.");
    }
    if (area === "frame") {
      const root = one("[data-destination-builder]");
      all("select", root).forEach((field) => { field.value = ""; field.classList.remove("is-correct", "is-wrong"); });
      say(one("p:last-child", root), "Separe o destino final do destinatário deste enlace.");
    }
    if (area === "summary") setSummary(0);
  }

  function activate(area, shouldScroll = false) {
    const stage = getStage();
    if (!stage || !areaText[area]) return;
    activeArea = area;
    stage.reset();
    stage.setPhase(initialPhase[area]);
    stage.root.classList.toggle("is-summary-mode", area === "summary");
    one("[data-gateway-stage-title]").textContent = areaText[area][0];
    one("[data-gateway-stage-copy]").textContent = areaText[area][1];
    resetAreaUi(area);
    say(one("[data-gateway-lab-feedback]"), areaText[area][1]);
    if (shouldScroll) {
      const lab = one("#gateway-shared-lab");
      const bounds = lab?.getBoundingClientRect();
      if (lab && bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight)) {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        lab.scrollIntoView({behavior: reduced ? "auto" : "smooth", block: "start"});
      }
    }
  }

  function setupSharedStage() {
    const stage = getStage();
    if (!stage) return;
    stage.root.addEventListener("l3stage:inspect", (event) => {
      if (activeArea !== "remote") return;
      const ok = event.detail.kind === "gateway";
      if (ok) stage.setPhase(1);
      announce("[data-remote-feedback]", ok
        ? "Correto. PC-B continua sendo o destino final, mas R1 é o primeiro dispositivo de Camada 3 que PC-A consegue alcançar localmente."
        : "Esse elemento não é o próximo dispositivo de Camada 3 capaz de encaminhar a comunicação.", ok);
    });
    stage.root.addEventListener("l3stage:phase", (event) => {
      if (activeArea === "summary") setSummary(event.detail.phase);
    });
    stage.root.addEventListener("l3stage:reset", () => {
      if (activeArea === "summary") setSummary(0);
    });
    all("[data-gateway-stage-link]").forEach((link) => link.addEventListener("click", (event) => {
      event.preventDefault();
      activate(link.dataset.gatewayStageLink, true);
    }));
    activate("remote");
  }

  function setupGatewayChoice() {
    all("[data-gateway-choice] button").forEach((button) => button.addEventListener("click", () => {
      if (activeArea !== "gateway") activate("gateway");
      const ok = button.dataset.gateway === "192.168.10.1";
      all("[data-gateway-choice] button").forEach((item) => { item.classList.remove("is-selected", "is-wrong"); item.setAttribute("aria-pressed", "false"); });
      button.classList.add(ok ? "is-selected" : "is-wrong");
      button.setAttribute("aria-pressed", "true");
      if (ok) getStage().setPhase(1);
      announce("[data-gateway-choice] p:last-child", ok
        ? "Correto. 192.168.10.1 está na LAN de PC-A e pode receber o primeiro frame. R1 foi destacado na topologia."
        : "192.168.30.1 pertence a outra sub-rede /24 e não está diretamente alcançável nesta LAN.", ok);
    }));
  }

  function setupArpTarget() {
    const root = one("[data-arp-target]");
    one("button", root)?.addEventListener("click", () => {
      const value = one("input", root).value.trim();
      if (activeArea !== "arp") activate("arp");
      one("input", root).value = value;
      const ok = value === "192.168.10.1";
      if (ok) getStage().setPhase(2);
      announce("[data-arp-target] p:last-child", ok
        ? "Correto. ARP Cache: 192.168.10.1 → RR. R1 foi identificado e o primeiro frame agora pode ser montado."
        : "O destino é remoto. Procure o IPv4 do dispositivo local que receberá a primeira entrega Ethernet.", ok);
    });
  }

  function setupBuilder() {
    const root = one("[data-destination-builder]");
    one("button", root)?.addEventListener("click", () => {
      const selectedIp = one("[data-build='ip']", root).value;
      const selectedMac = one("[data-build='mac']", root).value;
      if (activeArea !== "frame") activate("frame");
      const ipField = one("[data-build='ip']", root);
      const macField = one("[data-build='mac']", root);
      ipField.value = selectedIp;
      macField.value = selectedMac;
      const ipOk = ipField.value === "192.168.20.50";
      const macOk = macField.value === "RR";
      ipField.classList.toggle("is-correct", ipOk);
      ipField.classList.toggle("is-wrong", !ipOk);
      macField.classList.toggle("is-correct", macOk);
      macField.classList.toggle("is-wrong", !macOk);
      if (ipOk && macOk) getStage().setPhase(3);
      announce("[data-destination-builder] p:last-child", ipOk && macOk
        ? "Correto. O primeiro frame segue até R1. MAC responde “para quem entrego agora?”; IP responde “onde a comunicação precisa chegar?”."
        : !ipOk && macOk
          ? "O MAC do gateway está correto, mas o gateway não substitui o host remoto como Destination IP."
          : ipOk && !macOk
            ? "O Destination IP está correto, mas o primeiro frame Ethernet precisa ser entregue ao MAC RR do gateway."
            : "Separe o host remoto, que continua como Destination IP, do gateway local, que fornece o Destination MAC.", ipOk && macOk);
    });
  }

  function setupInspector() {
    all("[data-gateway-inspector] [data-inspector]").forEach((button) => button.addEventListener("click", () => {
      const kind = button.dataset.inspector;
      all("[data-gateway-inspector] [data-inspector]").forEach((item) => {
        item.classList.toggle("is-active", item === button);
        item.setAttribute("aria-expanded", item === button ? "true" : "false");
      });
      say(one("[data-inspector-feedback]"), kind === "ethernet"
        ? "Ethernet Destination RR destaca R1: para quem entrego agora?"
        : "Destination IP 192.168.20.50 destaca PC-B: onde a comunicação precisa chegar?");
      getStage()?.highlight(kind === "ethernet" ? "gateway" : "destination");
    }));
  }

  function setupTerminal() {
    const terminal = one("[data-gateway-terminal]");
    function output(command) {
      const stage = one("[data-terminal-stage]", terminal);
      const block = document.createElement("pre");
      if (command === "ipconfig /all") block.textContent = "Ethernet adapter Ethernet:\nIPv4 Address: 192.168.10.25\nSubnet Mask: 255.255.255.0\nDefault Gateway: 192.168.10.1";
      else if (command === "arp -a") block.textContent = "Internet Address      Physical Address\n192.168.10.1          RR";
      else block.textContent = "Tabela de rotas será estudada no próximo módulo.";
      stage.appendChild(block);
      say(one("[data-terminal-explain]"), command === "arp -a"
        ? "O host remoto não aparece: a entrega Ethernet local foi resolvida para o gateway."
        : command === "ipconfig /all"
          ? "IPv4 e máscara definem a LAN; Default Gateway identifica o próximo salto padrão no cenário."
          : "Teaser: as informações de roteamento serão abertas no próximo módulo.");
    }
    all("[data-command]", terminal).forEach((button) => button.addEventListener("click", () => output(button.dataset.command)));
    one("[data-terminal-form]", terminal)?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = one("[data-terminal-input]", terminal);
      const command = input.value.trim().toLowerCase();
      input.value = "";
      output(["ipconfig /all", "arp -a"].includes(command) ? command : "route print");
    });
  }

  function setupReference() {
    all("[data-reference-reveal]").forEach((button) => button.addEventListener("click", () => {
      one("[data-reference]", button.closest(".gateway-explanation")).hidden = false;
    }));
  }

  function setupCheckpoint() {
    const checkpoint = one("#gateway-checkpoint");
    const memory = new Map();
    const number = () => one(".gateway-checkpoint-header>strong", checkpoint)?.textContent.trim().split(" ")[0] || "start";
    function capture() { const values = {}; all("[data-gateway-answer-field]", checkpoint).forEach((field) => { values[field.dataset.gatewayAnswerField] = field.value; }); memory.set(number(), values); return values; }
    function restore() { const values = memory.get(number()) || {}; all("[data-gateway-answer-field]", checkpoint).forEach((field) => { if (values[field.dataset.gatewayAnswerField] !== undefined) field.value = values[field.dataset.gatewayAnswerField]; }); }
    checkpoint?.addEventListener("click", (event) => { const button = event.target.closest("[data-reference-reveal]"); if (button) one("[data-reference]", button.closest(".gateway-explanation")).hidden = false; });
    checkpoint?.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-gateway-checkpoint-form]");
      if (!form) return;
      event.preventDefault();
      if (form.matches("[data-answer-form]")) one("[data-answer-payload]", form).value = JSON.stringify(capture());
      if (form.matches("[data-reset-current]")) memory.delete(number());
      if (form.matches("[data-checkpoint-next], [data-checkpoint-restart]")) memory.clear();
      const submit = one("button[type='submit']", form);
      if (submit) submit.disabled = true;
      try {
        const response = await fetch(form.action, {method: "POST", body: new FormData(form), headers: {"X-Requested-With": "XMLHttpRequest"}});
        if (!response.ok) throw new Error("Falha ao atualizar o checkpoint.");
        const data = await response.json();
        checkpoint.innerHTML = data.html;
        window.NetStudySubnet?.init(checkpoint);
        window.NetStudyL3Path?.init(checkpoint);
        restore();
      } catch (error) {
        const node = document.createElement("p");
        node.className = "gateway-feedback is-error";
        node.textContent = error.message;
        checkpoint.appendChild(node);
      }
    });
  }

  setupSharedStage();
  setupGatewayChoice();
  setupArpTarget();
  setupBuilder();
  setupInspector();
  setupTerminal();
  setupReference();
  setupCheckpoint();
})();
