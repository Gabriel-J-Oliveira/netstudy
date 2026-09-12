(() => {
  "use strict";

  const stage = (id) => window.NetStudyTrunkStage?.stages[id];
  const say = (root, selector, text) => {
    const target = root?.querySelector(selector) || document.querySelector(selector);
    if (target) target.textContent = text;
  };
  const lockChoice = (root, selected, correct) => {
    root.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    selected.classList.add(correct ? "is-correct" : "is-wrong");
    if (!correct) root.querySelector('[data-correct="true"]')?.classList.add("is-correct");
  };

  ["trunk-clarity-roles", "trunk-clarity-dot1q", "trunk-clarity-across", "trunk-clarity-summary"].forEach((id) => stage(id)?.reveal());

  const openingStage = stage("trunk-clarity-problem");
  document.querySelector("[data-opening-solution]")?.addEventListener("click", (event) => {
    openingStage?.reveal();
    document.querySelector("[data-trunk-reveal]").hidden = false;
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = "TRUNK REVELADO";
  });
  document.querySelectorAll("[data-opening-frame]").forEach((button) => button.addEventListener("click", () => {
    const vlan = Number(button.dataset.openingFrame);
    openingStage?.send(vlan, { kind: "known" });
    say(document, "[data-opening-feedback]", `Frame VLAN ${vlan} atravessou a mesma Gi0/8 entre SW1 e SW2.`);
  }));

  const connectionChoice = document.querySelector("[data-connection-choice]");
  connectionChoice?.querySelectorAll("[data-connection-answer]").forEach((button) => {
    if (button.dataset.connectionAnswer === "inter-switch") button.dataset.correct = "true";
    button.addEventListener("click", () => {
      const correct = button.dataset.connectionAnswer === "inter-switch";
      lockChoice(connectionChoice, button, correct);
      say(connectionChoice, "[data-connection-feedback]", correct
        ? "Correto. SW1 ↔ SW2 precisa transportar VLAN 10 e VLAN 20: essa conexão é Trunk."
        : "Essa conexão liga um host a um único contexto VLAN neste cenário. O enlace entre SW1 e SW2 é que precisa transportar as duas VLANs.");
    });
  });

  const walkthrough = document.querySelector("[data-dot1q-walkthrough]");
  const dot1qStage = stage("trunk-clarity-dot1q");
  const stepText = (vlan, step) => {
    const host = vlan === 10 ? "PC-A" : "PC-B";
    const remote = vlan === 10 ? "PC-C" : "PC-D";
    return [
      `Pronto para acompanhar o frame de ${host}.`,
      `1. ${host} gera o frame Ethernet.`,
      `2. O frame entra pela porta Access VLAN ${vlan}.`,
      `3. O SW1 mantém o contexto VLAN ${vlan}.`,
      `4. No Trunk, o 802.1Q identifica VLAN ID ${vlan}.`,
      "5. O SW2 recebe o frame pela mesma conexão compartilhada.",
      `6. O SW2 interpreta o identificador: VLAN ${vlan}.`,
      `7. O frame continua na VLAN ${vlan} e sai pela Access até ${remote}.`,
    ][step];
  };
  const resetWalkthrough = (vlan) => {
    walkthrough.dataset.vlan = String(vlan);
    walkthrough.dataset.step = "0";
    walkthrough.querySelectorAll("[data-dot1q-vlan]").forEach((button) => button.classList.toggle("is-active", Number(button.dataset.dot1qVlan) === vlan));
    walkthrough.querySelector("[data-simple-source]").textContent = vlan === 10 ? "AA" : "BB";
    walkthrough.querySelector("[data-simple-destination]").textContent = vlan === 10 ? "CC" : "DD";
    walkthrough.querySelector("[data-simple-vlan]").textContent = String(vlan);
    walkthrough.querySelector("[data-simple-tag]").hidden = true;
    walkthrough.querySelector("[data-dot1q-step-text]").textContent = stepText(vlan, 0);
    walkthrough.querySelector("[data-dot1q-next]").textContent = "PRÓXIMO PASSO";
    dot1qStage?.reset();
    dot1qStage?.reveal();
  };
  walkthrough?.querySelectorAll("[data-dot1q-vlan]").forEach((button) => button.addEventListener("click", () => resetWalkthrough(Number(button.dataset.dot1qVlan))));
  walkthrough?.querySelector("[data-dot1q-next]")?.addEventListener("click", (event) => {
    const vlan = Number(walkthrough.dataset.vlan);
    let step = Number(walkthrough.dataset.step) + 1;
    if (step > 7) { resetWalkthrough(vlan); return; }
    walkthrough.dataset.step = String(step);
    walkthrough.querySelector("[data-dot1q-step-text]").textContent = stepText(vlan, step);
    const tag = walkthrough.querySelector("[data-simple-tag]");
    tag.hidden = step < 4 || step === 7;
    if (step === 4) dot1qStage?.send(vlan, { kind: "known" });
    if (step === 7) {
      dot1qStage.packet.phase = "access-out";
      dot1qStage.renderPacket();
      event.currentTarget.textContent = "REINICIAR CAMINHO";
    }
  });

  const tagChoice = document.querySelector("[data-tag-choice]");
  tagChoice?.querySelectorAll("[data-tag-answer]").forEach((button) => {
    if (button.dataset.tagAnswer === "vlan-id") button.dataset.correct = "true";
    button.addEventListener("click", () => {
      const correct = button.dataset.tagAnswer === "vlan-id";
      lockChoice(tagChoice, button, correct);
      say(tagChoice, "[data-tag-feedback]", correct
        ? "Correto. O VLAN ID preserva a identificação do contexto durante o transporte no trunk."
        : "Source e Destination MAC continuam identificando origem e destino. O contexto da VLAN é indicado pelo VLAN ID do 802.1Q.");
    });
  });

  const acrossStage = stage("trunk-clarity-across");
  document.querySelectorAll("[data-across-action]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.acrossAction === "unicast") {
      acrossStage?.send(10, { kind: "known" });
      document.querySelector("[data-mac-proof]").hidden = false;
      say(document, "[data-across-feedback]", "A → C: Access VLAN 10 → SW1 → Trunk com VLAN ID 10 → SW2 → Access VLAN 10 → C.");
    } else {
      acrossStage?.send(10, { kind: "broadcast", payload: "Broadcast VLAN 10" });
      say(document, "[data-across-feedback]", "O broadcast atravessou o trunk no contexto VLAN 10. PC-C recebe; PC-D, na VLAN 20, não recebe.");
    }
  }));

  const broadcastChoice = document.querySelector("[data-broadcast-choice]");
  broadcastChoice?.querySelectorAll("[data-broadcast-answer]").forEach((button) => {
    if (button.dataset.broadcastAnswer === "c") button.dataset.correct = "true";
    button.addEventListener("click", () => {
      const correct = button.dataset.broadcastAnswer === "c";
      lockChoice(broadcastChoice, button, correct);
      say(broadcastChoice, "[data-broadcast-feedback]", correct
        ? "Correto. PC-C recebe porque sua porta Access pertence à VLAN 10."
        : "PC-D está na VLAN 20. O trunk transporta o broadcast sem misturar os dois contextos.");
    });
  });

  const allowedChoice = document.querySelector("[data-allowed-choice]");
  allowedChoice?.querySelectorAll("[data-allowed-answer]").forEach((button) => {
    if (button.dataset.allowedAnswer === "10") button.dataset.correct = "true";
    button.addEventListener("click", () => {
      const correct = button.dataset.allowedAnswer === "10";
      lockChoice(allowedChoice, button, correct);
      say(allowedChoice, "[data-allowed-feedback]", correct
        ? "Correto. VLAN 10 está na lista permitida e pode usar o trunk."
        : "VLAN 30 não está na lista 10,20. O link pode continuar UP mesmo assim.");
    });
  });

  const summaryStage = stage("trunk-clarity-summary");
  document.querySelectorAll("[data-summary-phase]").forEach((button) => button.addEventListener("click", () => {
    const phase = button.dataset.summaryPhase;
    if (phase === "v10") {
      summaryStage?.send(10, { kind: "known" });
      say(document, "[data-summary-feedback]", "A → C: Access VLAN 10 → trunk com 802.1Q VLAN ID 10 → Access VLAN 10.");
    }
    if (phase === "v20") {
      summaryStage?.send(20, { kind: "known" });
      say(document, "[data-summary-feedback]", "B → D atravessou o mesmo cabo, agora identificado como 802.1Q VLAN ID 20.");
    }
    if (phase === "broadcast") {
      summaryStage?.send(10, { kind: "broadcast", payload: "Broadcast VLAN 10" });
      say(document, "[data-summary-feedback]", "Broadcast VLAN 10: C recebe no SW2; D não. Trunk não mistura VLANs.");
    }
    if (phase === "blocked" && button.dataset.restore !== "true") {
      summaryStage?.setAllowed("sw2", [10]);
      summaryStage?.send(20, { kind: "known" });
      say(document, "[data-summary-feedback]", "Link físico UP. Trunk UP. VLAN 20 não está permitida no SW2 e o frame não atravessa.");
      button.dataset.restore = "true";
      button.textContent = "RESTAURAR VLAN 20";
    } else if (phase === "blocked") {
      summaryStage?.setAllowed("sw2", [10, 20]);
      summaryStage?.root.classList.remove("is-blocked");
      summaryStage?.render();
      say(document, "[data-summary-feedback]", "VLAN 20 restaurada. O trunk voltou ao estado didático inicial: Allowed 10,20.");
      button.dataset.restore = "false";
      button.textContent = "4 · VLAN 20 NÃO PERMITIDA";
    }
  }));

  document.querySelector("[data-cli-trunk-row]")?.addEventListener("click", () => {
    const root = document.querySelector('[data-stage-id="trunk-clarity-summary"]');
    root?.classList.add("cli-highlight");
    say(document, "[data-cli-feedback]", "Gi0/8 trunking 10,20 corresponde ao link destacado entre SW1 e SW2.");
    window.setTimeout(() => root?.classList.remove("cli-highlight"), 1800);
  });

  document.querySelectorAll("[data-trunk-rapid-fire] article").forEach((item) => {
    item.querySelectorAll("[data-rapid-answer]").forEach((button) => button.addEventListener("click", () => {
      const correct = button.dataset.rapidCorrect === "true";
      item.querySelectorAll("button").forEach((choice) => { choice.disabled = true; });
      button.classList.add(correct ? "is-correct" : "is-wrong");
      item.querySelector('[data-rapid-correct="true"]')?.classList.add("is-correct");
      say(item, "[data-rapid-feedback]", correct ? "Correto." : "Incorreto. Observe a alternativa indicada como correta.");
    }));
  });

  document.querySelector("[data-reveal-reference]")?.addEventListener("click", (event) => {
    document.querySelector("[data-reference-answer]").hidden = false;
    event.currentTarget.disabled = true;
  });

  function asyncCheckpoint() {
    const container = document.querySelector("#trunk-checkpoint");
    const start = document.querySelector("[data-trunk-checkpoint-start]");
    if (!container) return;
    async function submit(form, submitter) {
      window.NetStudyTrunkWorkbench?.capture();
      if (form.matches("[data-trunk-reset-current]")) window.NetStudyTrunkWorkbench?.discard();
      const data = new FormData(form);
      if (submitter?.name) data.append(submitter.name, submitter.value);
      container.setAttribute("aria-busy", "true");
      try {
        const response = await fetch(form.action, { method: "POST", body: data, headers: { "X-Requested-With": "XMLHttpRequest", "Accept": "application/json" }, credentials: "same-origin" });
        if (!response.ok) throw new Error("request failed");
        const payload = await response.json();
        const parsed = new DOMParser().parseFromString(payload.html, "text/html").querySelector("#trunk-checkpoint");
        container.innerHTML = parsed.innerHTML;
        container.removeAttribute("aria-busy");
        window.NetStudySwitchBoard?.init(container);
        window.NetStudyTrunkStage?.init(container);
        window.NetStudyExercises?.init();
        window.NetStudyTrunkWorkbench?.init(container);
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
      if (!(form instanceof HTMLFormElement) || form.matches("[data-trunk-terminal-form]")) return;
      if (form === start || container.contains(form)) {
        event.preventDefault();
        submit(form, event.submitter);
      }
    });
  }
  asyncCheckpoint();
})();
