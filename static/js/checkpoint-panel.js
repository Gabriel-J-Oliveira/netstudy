(() => {
  "use strict";

  for (const panel of document.querySelectorAll("[data-checkpoint-panel]")) {
    panel.addEventListener("submit", async event => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.method !== "post") return;
      event.preventDefault();
      if (panel.getAttribute("aria-busy") === "true") return;

      const button = event.submitter;
      const body = new FormData(form);
      if (button?.name) body.append(button.name, button.value);
      const keepSelection = form.hasAttribute("data-checkpoint-keep-selection");
      const selection = keepSelection
        ? Array.from(panel.querySelectorAll('input[type="radio"]:checked'), input => [input.name, input.value])
        : [];
      panel.querySelector("[data-checkpoint-request-error]")?.remove();
      panel.setAttribute("aria-busy", "true");
      if (button) button.disabled = true;

      try {
        const response = await fetch(form.action, {
          method: "POST",
          body,
          credentials: "same-origin",
          headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
        });
        if (!response.ok || response.redirected) throw new Error("Falha no checkpoint");
        const { html } = await response.json();
        if (typeof html !== "string" || !html.trim()) throw new Error("Painel vazio");
        panel.innerHTML = html;

        for (const input of panel.querySelectorAll('input[type="radio"]:enabled')) {
          if (selection.some(([name, value]) => name === input.name && value === input.value)) {
            input.checked = true;
          }
        }

        const destination = (keepSelection && panel.querySelector("[data-checkpoint-hint]"))
          || panel.querySelector("[data-checkpoint-feedback]")
          || panel.querySelector("h2");
        if (destination) {
          destination.tabIndex = -1;
          destination.focus({ preventScroll: true });
        }
      } catch {
        const warning = document.createElement("p");
        warning.className = "alert alert-danger mt-3";
        warning.setAttribute("role", "alert");
        warning.setAttribute("data-checkpoint-request-error", "");
        warning.textContent = "Não foi possível atualizar o checkpoint. Tente novamente.";
        panel.append(warning);
      } finally {
        panel.removeAttribute("aria-busy");
        if (button) button.disabled = false;
      }
    });
  }
})();
