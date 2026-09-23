(() => {
  "use strict";

  const one = (selector, scope = document) => scope.querySelector(selector);
  const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const visual = one("[data-vlan-visualization]");
  if (!visual) return;

  const state = { pcEVlan: 20, accessApplied: false };

  function applyAccess() {
    state.pcEVlan = Number(one("[data-pc-e-select]").value);
    state.accessApplied = true;
    one(".access-visual").dataset.pcEVlan = String(state.pcEVlan);
    one("[data-host-vlan]").textContent = `VLAN ${state.pcEVlan}`;
    one("[data-cli-pc-e-vlan10]").hidden = state.pcEVlan !== 10;
    one("[data-cli-pc-e-vlan20]").hidden = state.pcEVlan !== 20;
    const host = one('.access-host[data-host="E"]');
    host.classList.remove("is-broadcast-recipient", "is-outside-context");
    one("[data-host-result]", host).textContent = "—";
    one("[data-test-pc-e]").disabled = false;
    one("[data-access-feedback]").textContent = `PC-E agora está associado à VLAN ${state.pcEVlan}. O cabo e a infraestrutura física não mudaram. Teste o broadcast de PC-A.`;
  }

  function testPcE() {
    if (!state.accessApplied) return;
    const receives = state.pcEVlan === 10;
    const host = one('.access-host[data-host="E"]');
    host.classList.toggle("is-broadcast-recipient", receives);
    host.classList.toggle("is-outside-context", !receives);
    one("[data-host-result]", host).textContent = receives ? "Recebe" : "Não recebe";
    one("[data-access-feedback]").textContent = receives
      ? "PC-E recebe o broadcast de PC-A porque sua porta Access está na VLAN 10."
      : "PC-E não recebe o broadcast de PC-A porque sua porta Access está na VLAN 20.";
  }

  const glossaryTriggers = all("[data-vlan-glossary]");
  let openGlossaryTrigger = null;

  function closeGlossary(trigger) {
    if (!trigger) return;
    const popover = document.getElementById(trigger.getAttribute("aria-controls"));
    trigger.setAttribute("aria-expanded", "false");
    if (popover) popover.hidden = true;
    if (openGlossaryTrigger === trigger) openGlossaryTrigger = null;
  }

  function positionGlossary(trigger, popover) {
    const rect = trigger.getBoundingClientRect();
    const padding = 8;
    const width = Math.min(352, window.innerWidth - 2 * padding);
    popover.style.width = `${width}px`;
    popover.style.left = `${padding}px`;
    popover.style.top = `${padding}px`;
    const bounds = popover.getBoundingClientRect();
    const left = Math.max(padding, Math.min(rect.left, window.innerWidth - bounds.width - padding));
    const above = rect.top - bounds.height - padding;
    const top = above >= padding ? above : Math.min(rect.bottom + padding, window.innerHeight - bounds.height - padding);
    popover.style.left = `${left}px`;
    popover.style.top = `${Math.max(padding, top)}px`;
  }

  function openGlossary(trigger) {
    if (openGlossaryTrigger && openGlossaryTrigger !== trigger) closeGlossary(openGlossaryTrigger);
    const popover = document.getElementById(trigger.getAttribute("aria-controls"));
    if (!popover) return;
    trigger.setAttribute("aria-expanded", "true");
    popover.hidden = false;
    openGlossaryTrigger = trigger;
    positionGlossary(trigger, popover);
  }

  glossaryTriggers.forEach((trigger) => {
    trigger.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse") openGlossary(trigger);
    });
    trigger.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse" && !trigger.matches(":focus")) closeGlossary(trigger);
    });
    trigger.addEventListener("focus", () => {
      if (!trigger.dataset.vlanTouch) openGlossary(trigger);
    });
    trigger.addEventListener("blur", () => closeGlossary(trigger));
    trigger.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      trigger.dataset.vlanTouch = "true";
      if (openGlossaryTrigger === trigger) closeGlossary(trigger);
      else openGlossary(trigger);
    });
    trigger.addEventListener("click", () => {
      if (trigger.dataset.vlanTouch) {
        delete trigger.dataset.vlanTouch;
        return;
      }
      openGlossary(trigger);
    });
  });
  document.addEventListener("pointerdown", (event) => {
    if (openGlossaryTrigger && !event.target.closest("[data-vlan-glossary], .vlan-glossary-popover")) closeGlossary(openGlossaryTrigger);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openGlossaryTrigger) {
      closeGlossary(openGlossaryTrigger);
      openGlossaryTrigger = null;
      event.stopPropagation();
    }
  });
  window.addEventListener("resize", () => {
    if (openGlossaryTrigger) positionGlossary(openGlossaryTrigger, document.getElementById(openGlossaryTrigger.getAttribute("aria-controls")));
  });
  function setupSelfExplanation() {
    const section = one("[data-vlan-self-explanation]");
    section?.querySelector("[data-vlan-reference-button]")?.addEventListener("click", (event) => {
      one("[data-vlan-reference]", section).hidden = false;
      event.currentTarget.disabled = true;
    });
  }

  function setupAsyncCheckpoint() {
    const container = one("#vlan-checkpoint");
    const start = one("[data-vlan-checkpoint-start]");
    if (!container) return;
    async function submit(form, submitter) {
      window.NetStudySwitchWorkbench?.capture();
      if (form.matches("[data-reset-current-form]")) window.NetStudySwitchWorkbench?.discard();
      const data = new FormData(form);
      if (submitter?.name) data.append(submitter.name, submitter.value);
      container.setAttribute("aria-busy", "true");
      try {
        const response = await fetch(form.action, { method: "POST", body: data, headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" }, credentials: "same-origin" });
        if (!response.ok) throw new Error("request failed");
        const payload = await response.json();
        const parsed = new DOMParser().parseFromString(payload.html, "text/html").querySelector("#vlan-checkpoint");
        if (!parsed) throw new Error("invalid response");
        container.innerHTML = parsed.innerHTML;
        container.removeAttribute("aria-busy");
        window.NetStudySwitchBoard?.init(container);
        window.NetStudyExercises?.init();
        window.NetStudySwitchWorkbench?.init(container);
      } catch {
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
      if (form === start || container.contains(form)) { event.preventDefault(); submit(form, event.submitter); }
    });
  }

  one("[data-apply-access]").addEventListener("click", applyAccess);
  one("[data-test-pc-e]").addEventListener("click", testPcE);
  one("[data-pc-e-select]").addEventListener("change", () => {
    if (state.accessApplied) one("[data-access-feedback]").textContent = "A seleção mudou; aplique a associação para atualizar PC-E.";
  });

  setupSelfExplanation();
  setupAsyncCheckpoint();
})();
