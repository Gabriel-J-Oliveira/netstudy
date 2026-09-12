(() => {
  "use strict";

  const api = () => window.NetStudySwitchBoard;
  const board = (id) => api()?.boards[id];
  const MAC = () => api()?.MAC;

  function lockCorrect(root, chosen) {
    root.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    chosen.classList.add("is-correct");
  }

  function setupSimpleInspectors() {
    document.querySelectorAll(".switch-board-vlan").forEach((root) => {
      root.addEventListener("switchboard:inspect", () => root.classList.add("show-simple-inspector"));
    });
  }

  function setupOpening() {
    const root = document.querySelector("[data-vlan-opening]");
    const current = board("vlan-didactic-opening");
    if (!root || !current) return;
    root.querySelectorAll("[data-opening-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        root.querySelectorAll("[data-opening-mode]").forEach((item) => item.classList.toggle("is-active", item === button));
        current.reset();
        if (button.dataset.openingMode === "together") {
          current.receiveFrame({ source: MAC().A, destination: MAC().BROADCAST, ingress: 1 });
          root.querySelector("[data-opening-feedback]").textContent = "Sem separação: B, C e D recebem o broadcast de A.";
          return;
        }
        current.setAccessVlan(1, 10);
        current.setAccessVlan(2, 10);
        current.setAccessVlan(3, 20);
        current.setAccessVlan(4, 20);
        current.toggleVlanView(true);
        current.receiveFrame({ source: MAC().A, destination: MAC().BROADCAST, ingress: 1 });
        root.querySelector("[data-opening-feedback]").textContent = "Com VLANs: somente B, também na VLAN 10, recebe. C e D permanecem na VLAN 20.";
      });
    });
  }

  function setupGroups() {
    const root = document.querySelector("[data-same-context]");
    if (!root) return;
    root.querySelectorAll("[data-context-answer]").forEach((button) => {
      button.addEventListener("click", () => {
        const correct = button.dataset.contextAnswer === "no";
        button.classList.add(correct ? "is-correct" : "is-wrong");
        root.querySelector("[data-context-feedback]").textContent = correct
          ? "Correto. Estar no mesmo switch físico não garante participar da mesma VLAN."
          : "O switch físico pode manter contextos separados de Camada 2 por meio de VLANs.";
        if (correct) lockCorrect(root, button);
        else button.disabled = true;
      });
    });
  }

  function setupAccess() {
    const root = document.querySelector("[data-access-question]");
    const current = board("vlan-didactic-access");
    if (!root || !current) return;
    root.querySelectorAll("[data-access-answer]").forEach((button) => {
      button.addEventListener("click", () => {
        const correct = button.dataset.accessAnswer === "20";
        button.classList.add(correct ? "is-correct" : "is-wrong");
        root.querySelector("[data-access-feedback]").textContent = correct
          ? "Correto. Gi0/3 é Access VLAN 20, então o host conectado utiliza o contexto da VLAN 20."
          : "A associação Access da Gi0/3 indica explicitamente a VLAN 20.";
        if (correct) {
          lockCorrect(root, button);
          current.inspect(3);
        } else button.disabled = true;
      });
    });
    const change = document.querySelector("[data-access-change]");
    change.querySelector("button").addEventListener("click", (event) => {
      current.setAccessVlan(5, 10);
      current.inspect(5);
      change.querySelector("[data-change-feedback]").textContent = "PC-E continua na Gi0/5, mas agora participa da VLAN 10 junto de A e B.";
      event.currentTarget.disabled = true;
    });
  }

  function setupFrames() {
    const current = board("vlan-didactic-frames");
    const feedback = document.querySelector("[data-frame-feedback]");
    if (!current || !feedback) return;
    document.querySelectorAll("[data-frame-demo]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-frame-demo]").forEach((item) => item.classList.toggle("is-active", item === button));
        current.reset();
        const demo = button.dataset.frameDemo;
        if (demo === "broadcast10") {
          current.receiveFrame({ source: MAC().A, destination: MAC().BROADCAST, ingress: 1 });
          feedback.textContent = "VLAN 10: B recebeu. C e D estão em outra VLAN.";
        } else if (demo === "broadcast20") {
          current.receiveFrame({ source: MAC().C, destination: MAC().BROADCAST, ingress: 3 });
          feedback.textContent = "VLAN 20: D recebeu. A e B estão em outra VLAN.";
        } else if (demo === "known") {
          current.receiveFrame({ source: MAC().A, destination: MAC().B, ingress: 1 });
          feedback.textContent = "Known Unicast: BB foi encontrado no contexto da VLAN 10 e o frame saiu somente pela Gi0/2.";
        } else {
          current.receiveFrame({ source: MAC().A, destination: MAC().E, ingress: 1 });
          feedback.textContent = "Unknown Unicast: EE não está na tabela da VLAN 10. O flooding permanece nesse contexto e alcança somente Gi0/2.";
        }
      });
    });

    const question = document.querySelector("[data-broadcast-question]");
    question.addEventListener("click", (event) => {
      const button = event.target.closest("[data-broadcast-answer]");
      if (!button) return;
      const correct = button.dataset.broadcastAnswer === "no";
      button.classList.add(correct ? "is-correct" : "is-wrong");
      question.querySelector("[data-broadcast-feedback]").textContent = correct
        ? "Correto. O broadcast permanece no contexto da VLAN 10 e não é entregue diretamente às portas Access da VLAN 20."
        : "As portas Access da VLAN 20 pertencem a outro domínio de broadcast.";
      if (correct) lockCorrect(question, button);
      else button.disabled = true;
      current.reset();
      current.receiveFrame({ source: MAC().A, destination: MAC().BROADCAST, ingress: 1 });
    });
  }

  function setupCliProof() {
    const root = document.querySelector("[data-vlan-cli-proof]");
    const boardRoot = document.querySelector('[data-board-id="vlan-didactic-summary"]');
    if (!root || !boardRoot) return;
    const clear = () => boardRoot.querySelectorAll(".is-cli-highlight").forEach((item) => item.classList.remove("is-cli-highlight"));
    root.querySelectorAll("[data-cli-vlan]").forEach((button) => {
      button.addEventListener("click", () => {
        const vlan = button.dataset.cliVlan;
        const ports = vlan === "10" ? ["1", "2"] : ["3", "4"];
        const hosts = vlan === "10" ? ["A", "B"] : ["C", "D"];
        clear();
        ports.forEach((port) => boardRoot.querySelector(`[data-switch-port="${port}"]`)?.classList.add("is-cli-highlight"));
        hosts.forEach((host) => boardRoot.querySelector(`[data-host="${host}"]`)?.classList.add("is-cli-highlight"));
        root.querySelectorAll("[data-cli-vlan]").forEach((item) => {
          const selected = item === button;
          item.classList.toggle("is-active", selected);
          item.setAttribute("aria-pressed", String(selected));
        });
        root.querySelector("[data-cli-feedback]").textContent = vlan === "10"
          ? "VLAN 10 na CLI: PC-A em Gi0/1 e PC-B em Gi0/2 estão destacados no mesmo contexto."
          : "VLAN 20 na CLI: PC-C em Gi0/3 e PC-D em Gi0/4 estão destacados no mesmo contexto.";
      });
    });
  }

  function setupSelfExplanation() {
    const root = document.querySelector("[data-vlan-self-explanation]");
    if (!root) return;
    root.querySelector("[data-vlan-reference-button]").addEventListener("click", (event) => {
      root.querySelector("[data-vlan-reference]").hidden = false;
      event.currentTarget.disabled = true;
    });
  }

  function setupSummary() {
    const root = document.querySelector("[data-summary-demo]");
    const current = board("vlan-didactic-summary");
    if (!root || !current) return;
    root.querySelectorAll("[data-summary-case]").forEach((button) => {
      button.addEventListener("click", () => {
        root.querySelectorAll("[data-summary-case]").forEach((item) => item.classList.toggle("is-active", item === button));
        current.reset();
        const name = button.dataset.summaryCase;
        if (name === "broadcast") {
          current.receiveFrame({ source: MAC().A, destination: MAC().BROADCAST, ingress: 1 });
          root.querySelector("[data-summary-feedback]").textContent = "A ingressou pela VLAN 10. O broadcast permanece na VLAN 10 e somente B recebe.";
        } else if (name === "known") {
          current.receiveFrame({ source: MAC().A, destination: MAC().B, ingress: 1 });
          root.querySelector("[data-summary-feedback]").textContent = "BB é conhecido na VLAN 10: o frame unicast sai pela Gi0/2.";
        } else if (name === "unknown") {
          current.receiveFrame({ source: MAC().A, destination: MAC().E, ingress: 1 });
          root.querySelector("[data-summary-feedback]").textContent = "EE é desconhecido na VLAN 10: flooding somente pelas outras portas desse contexto.";
        } else {
          current.setAccessVlan(2, 20);
          delete current.state.table[current.tableKey(MAC().B, 10)];
          current.setMacEntry(MAC().B, 2, null, 20);
          current.receiveFrame({ source: MAC().A, destination: MAC().BROADCAST, ingress: 1 });
          root.querySelector("[data-summary-feedback]").textContent = "Gi0/2 agora é VLAN 20. B não recebe mais o broadcast de A, embora nada físico tenha mudado.";
          document.querySelector("[data-summary-change]").hidden = false;
          document.querySelector("[data-nothing-physical]").hidden = false;
        }
      });
    });
  }

  function setupAsyncCheckpoint() {
    const container = document.querySelector("#vlan-checkpoint");
    const start = document.querySelector("[data-vlan-checkpoint-start]");
    if (!container) return;
    async function submit(form, submitter) {
      window.NetStudySwitchWorkbench?.capture();
      if (form.matches("[data-reset-current-form]")) window.NetStudySwitchWorkbench?.discard();
      const data = new FormData(form);
      if (submitter?.name) data.append(submitter.name, submitter.value);
      container.setAttribute("aria-busy", "true");
      try {
        const response = await fetch(form.action, {
          method: "POST", body: data,
          headers: { "X-Requested-With": "XMLHttpRequest", "Accept": "application/json" },
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("request failed");
        const payload = await response.json();
        const parsed = new DOMParser().parseFromString(payload.html, "text/html").querySelector("#vlan-checkpoint");
        if (!parsed) throw new Error("invalid response");
        container.innerHTML = parsed.innerHTML;
        container.removeAttribute("aria-busy");
        api()?.init(container);
        window.NetStudyExercises?.init();
        window.NetStudySwitchWorkbench?.init(container);
      } catch (error) {
        container.removeAttribute("aria-busy");
        const warning = document.createElement("div");
        warning.className = "alert alert-danger";
        warning.textContent = "Não foi possível registrar sua resposta. Tente novamente.";
        container.prepend(warning);
      }
    }
    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.matches("[data-host-form],[data-switch-form]")) return;
      if (form === start || container.contains(form)) {
        event.preventDefault();
        submit(form, event.submitter);
      }
    });
  }

  setupSimpleInspectors();
  setupOpening();
  setupGroups();
  setupAccess();
  setupFrames();
  setupSummary();
  setupCliProof();
  setupSelfExplanation();
  setupAsyncCheckpoint();
})();
