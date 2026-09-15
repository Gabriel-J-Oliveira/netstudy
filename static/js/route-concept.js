(() => {
  "use strict";

  const one = (selector, scope = document) => scope?.querySelector(selector);
  const all = (selector, scope = document) => [...(scope?.querySelectorAll(selector) || [])];
  const parseRoutes = (id) => JSON.parse(one(`#${id}`)?.textContent || "[]");
  const basicRoutes = parseRoutes("route-basic-data");
  const specificRoutes = parseRoutes("route-specific-data");
  const extraNoMatch = {prefix: "192.168.20.0/24", next_hop: "R5", interface: "WAN5"};
  const visualizerRoot = one("[data-route-visualizer]");
  const visualizer = () => visualizerRoot?.routeVisualizer;
  let activeArea = "decision";
  let summaryPhase = 0;

  const areaText = {
    decision: ["Área 01 · Destination IP escolhe uma rota", "Teste 192.168.20.50 contra todas as linhas."],
    anatomy: ["Área 02 · Anatomia da rota", "Clique em Destination Prefix, Next Hop e Interface na linha selecionada."],
    outcomes: ["Área 03 · Três resultados possíveis", "Troque entre Direct, Next Hop e Default Route."],
    specificity: ["Área 04 · Longest Prefix Match", "Primeiro revele as rotas compatíveis; depois escolha a mais específica."],
    summary: ["Área 05 · Síntese e novo frame", "Avance manualmente da leitura do Destination IP até o novo frame para R2."],
  };

  function say(node, message, ok = null) {
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("feedback-ok", ok === true);
    node.classList.toggle("feedback-error", ok === false);
  }

  function announce(selector, message, ok = null) {
    say(one(selector), message, ok);
    say(one("[data-route-lab-feedback]"), message, ok);
  }

  function showControls(area) {
    one("[data-outcome-controls]").hidden = area !== "outcomes";
    one("[data-specificity-controls]").hidden = area !== "specificity";
    one("[data-summary-next]").hidden = area !== "summary";
  }

  function setSummary(phase) {
    all("[data-summary-step]").forEach((item) => {
      const number = Number(item.dataset.summaryStep);
      item.classList.toggle("is-done", number <= phase);
      item.classList.toggle("is-current", number === phase);
      item.setAttribute("aria-label", `${item.textContent.trim()}: ${number <= phase ? "concluído" : "pendente"}`);
    });
    one("[data-summary-next]").textContent = phase < 6 ? `${phase === 0 ? "INICIAR" : "EXECUTAR"} PASSO ${phase + 1}` : "REINICIAR SÍNTESE";
  }

  function resetAreaUi(area) {
    all("[data-anatomy-field]").forEach((item) => item.classList.remove("is-done"));
    all("[data-route-preset], [data-specificity-destination]").forEach((button) => button.classList.remove("is-active"));
    const winner = one("[data-specificity-winner]");
    winner.disabled = true;
    winner.classList.remove("is-active");
    one("[data-route-new-frame]").hidden = true;
    if (area === "decision") announce("[data-decision-feedback]", "Confirme o Destination IP e teste todas as linhas.");
    if (area === "anatomy") announce("[data-anatomy-feedback]", "Cada campo responde a uma parte da decisão.");
    if (area === "outcomes") announce("[data-outcome-feedback]", "Escolha Direct, Next Hop ou Default Route abaixo do visualizador.");
    if (area === "specificity") announce("[data-specificity-feedback]", "Escolha um destino, teste as correspondências e só depois revele a vencedora.");
    if (area === "summary") { summaryPhase = 0; setSummary(0); announce("[data-summary-feedback]", "Comece lendo o Destination IP."); }
  }

  function configure(area) {
    const tool = visualizer();
    if (!tool || !areaText[area]) return;
    activeArea = area;
    showControls(area);
    if (area === "specificity") tool.setRoutes(specificRoutes, "10.10.20.50");
    else tool.setRoutes(basicRoutes, "192.168.20.50");
    if (area === "anatomy") tool.run("192.168.20.50");
    resetAreaUi(area);
    one("[data-route-stage-title]").textContent = areaText[area][0];
    one("[data-route-stage-copy]").textContent = areaText[area][1];
    say(one("[data-route-lab-feedback]"), areaText[area][1]);
  }

  function openArea(link) {
    configure(link.dataset.routeStageLink);
    const lab = one("#route-shared-lab");
    const bounds = lab?.getBoundingClientRect();
    if (lab && bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight)) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      lab.scrollIntoView({behavior: reduced ? "auto" : "smooth", block: "start"});
    }
  }

  function setupStageLinks() {
    all("[data-route-stage-link]").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); openArea(link); }));
  }

  function setupVisualizerEvents() {
    visualizerRoot.addEventListener("routevisualizer:tested", (event) => {
      if (activeArea !== "specificity") return;
      const prefixes = event.detail.matches.map((route) => route.prefix).join(", ");
      one("[data-specificity-winner]").disabled = !event.detail.matches.length;
      announce("[data-specificity-feedback]", `${prefixes || "Nenhuma rota"} ${prefixes ? "combina(m)" : "combina"}. Agora compare somente as compatíveis.`);
    });
    visualizerRoot.addEventListener("routevisualizer:selected", (event) => {
      const {destination, selected} = event.detail;
      if (activeArea === "decision") {
        announce("[data-decision-feedback]", `${selected.prefix} venceu. Next Hop ${selected.nextHop}; interface ${selected.interface}.`, true);
      }
      if (activeArea === "outcomes") {
        const message = selected.nextHop === "DIRECT"
          ? `${destination}: rota DIRECT. A consequência L2 é ARP pelo próprio host da rede local.`
          : selected.prefix === "0.0.0.0/0"
            ? `${destination}: Default Route venceu porque nenhuma rota mais específica combinou. A entrega L2 usa o MAC do próximo roteador ${selected.nextHop}.`
            : `${destination}: rota via Next Hop ${selected.nextHop} pela ${selected.interface}. O novo frame usa o MAC desse roteador.`;
        announce("[data-outcome-feedback]", message, true);
      }
      if (activeArea === "specificity") {
        const message = destination === "10.50.1.20"
          ? "10.0.0.0/8 vence 0.0.0.0/0. A rota 192.168.20.0/24 não entra na comparação de especificidade porque não combina."
          : "10.10.20.0/24 vence /16, /8 e /0 porque é a rota compatível mais específica.";
        announce("[data-specificity-feedback]", message, true);
        one("[data-specificity-winner]").classList.add("is-active");
      }
    });
    visualizerRoot.addEventListener("routevisualizer:field", (event) => {
      if (activeArea !== "anatomy") return;
      const {field, route} = event.detail;
      if (route.prefix !== "192.168.20.0/24") {
        announce("[data-anatomy-feedback]", "Inspecione os campos da rota selecionada 192.168.20.0/24.");
        return;
      }
      const item = one(`[data-anatomy-field="${field}"]`);
      item.classList.add("is-done");
      item.setAttribute("aria-label", `${item.textContent.trim()}: concluído`);
      const messages = {
        prefix: "Destination Prefix define o conjunto de destinos alcançados por esta rota.",
        nextHop: "Next Hop 10.0.0.2 identifica o outro roteador que receberá o novo frame.",
        interface: "WAN1 é a interface local usada para enviar esse frame.",
      };
      announce("[data-anatomy-feedback]", messages[field], true);
    });
  }

  function setupOutcomeControls() {
    all("[data-route-preset]").forEach((button) => button.addEventListener("click", () => {
      if (activeArea !== "outcomes") configure("outcomes");
      all("[data-route-preset]").forEach((item) => item.classList.toggle("is-active", item === button));
      visualizer().run(button.dataset.routePreset);
    }));
  }

  function setupSpecificityControls() {
    all("[data-specificity-destination]").forEach((button) => button.addEventListener("click", () => {
      if (activeArea !== "specificity") configure("specificity");
      const destination = button.dataset.specificityDestination;
      const routes = destination === "10.50.1.20" ? [...specificRoutes, extraNoMatch] : specificRoutes;
      visualizer().setRoutes(routes, destination);
      visualizer().test(destination);
      all("[data-specificity-destination]").forEach((item) => item.classList.toggle("is-active", item === button));
    }));
    one("[data-specificity-winner]").addEventListener("click", () => visualizer().selectBest());
  }

  function setupSummary() {
    one("[data-summary-next]").addEventListener("click", () => {
      if (activeArea !== "summary") configure("summary");
      if (summaryPhase >= 6) { configure("summary"); return; }
      summaryPhase += 1;
      if (summaryPhase === 1) {
        visualizer().setRoutes(basicRoutes, "192.168.20.50");
        announce("[data-summary-feedback]", "1. R1 lê Destination IP 192.168.20.50.");
      } else if (summaryPhase === 2) {
        visualizer().test("192.168.20.50");
        announce("[data-summary-feedback]", "2. Todas as linhas foram testadas; rotas incompatíveis ficaram fora da decisão.");
      } else if (summaryPhase === 3) {
        announce("[data-summary-feedback]", "3. 192.168.20.0/24 e 0.0.0.0/0 são compatíveis.");
      } else if (summaryPhase === 4) {
        visualizer().selectBest();
        announce("[data-summary-feedback]", "4. /24 venceu /0 por ser a rota compatível mais específica.");
      } else if (summaryPhase === 5) {
        visualizer().selectFields(["nextHop", "interface"]);
        announce("[data-summary-feedback]", "5. A rota informa Next Hop 10.0.0.2 e saída WAN1.");
      } else {
        one("[data-route-new-frame]").hidden = false;
        announce("[data-summary-feedback]", "6. R1 cria um novo frame para o MAC de R2; Destination IP permanece 192.168.20.50.", true);
      }
      setSummary(summaryPhase);
    });
  }

  function setupTerminal() {
    const terminal = one("[data-route-terminal]");
    function output(command) {
      const block = document.createElement("pre");
      const stage = one("[data-terminal-stage]", terminal);
      block.textContent = command === "show ip route"
        ? "C 192.168.10.0/24 directly connected\nS 192.168.20.0/24 via 10.0.0.2\nS* 0.0.0.0/0 via 203.0.113.1"
        : "Network Destination   Netmask           Gateway\n192.168.10.0         255.255.255.0     On-link\n0.0.0.0              0.0.0.0           192.168.10.1";
      stage.appendChild(block);
      say(one("[data-terminal-explain]", terminal), command === "show ip route"
        ? "C = connected; S = static; S* = default. Apenas leitura."
        : "São as mesmas ideias do visualizador: Destination Prefix, on-link ou gateway.");
    }
    all("[data-command]", terminal).forEach((button) => button.addEventListener("click", () => output(button.dataset.command)));
    one("[data-terminal-form]", terminal)?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = one("[data-terminal-input]", terminal);
      const command = input.value.trim();
      input.value = "";
      output(command === "show ip route" ? command : "route print");
    });
  }

  function setupReference() {
    one("[data-reference-reveal]")?.addEventListener("click", (event) => {
      one("[data-reference]", event.currentTarget.closest("[data-route-explanation]")).hidden = false;
    });
  }

  function setupCheckpoint() {
    const checkpoint = one("#route-checkpoint");
    const memory = new Map();
    const number = () => one(".gateway-checkpoint-header>strong", checkpoint)?.textContent.trim().split(" ")[0] || "start";
    function capture() { const values = {}; all("[data-route-answer-field]", checkpoint).forEach((field) => { values[field.dataset.routeAnswerField] = field.value; }); memory.set(number(), values); return values; }
    function restore() { const values = memory.get(number()) || {}; all("[data-route-answer-field]", checkpoint).forEach((field) => { if (values[field.dataset.routeAnswerField] !== undefined) field.value = values[field.dataset.routeAnswerField]; }); }
    checkpoint?.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-route-checkpoint-form]");
      if (!form) return;
      event.preventDefault();
      if (form.matches("[data-answer-form]")) one("[data-answer-payload]", form).value = JSON.stringify(capture());
      if (form.matches("[data-reset-current]")) memory.delete(number());
      if (form.matches("[data-checkpoint-next], [data-checkpoint-restart]")) memory.clear();
      try {
        const response = await fetch(form.action, {method: "POST", body: new FormData(form), headers: {"X-Requested-With": "XMLHttpRequest"}});
        if (!response.ok) throw new Error("Falha ao atualizar o checkpoint.");
        const data = await response.json();
        checkpoint.innerHTML = data.html;
        restore();
      } catch (error) {
        const node = document.createElement("p");
        node.className = "gateway-feedback is-error";
        node.textContent = error.message;
        checkpoint.appendChild(node);
      }
    });
  }

  setupStageLinks();
  setupVisualizerEvents();
  setupOutcomeControls();
  setupSpecificityControls();
  setupSummary();
  setupTerminal();
  setupReference();
  setupCheckpoint();
  configure("decision");
})();
