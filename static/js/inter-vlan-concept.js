(() => {
  "use strict";
  const one = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  one("[data-reference-reveal]")?.addEventListener("click", (event) => {
    one("[data-reference]", event.currentTarget.parentElement).hidden = false;
  });

  const checkpoint = one("#inter-vlan-checkpoint");
  const memory = new Map();
  const number = () => one(".gateway-checkpoint-header>strong", checkpoint)?.textContent.split(" ")[0] || "start";
  function capture() {
    const values = {};
    all("[data-iv-answer]", checkpoint).forEach((field) => { values[field.dataset.ivAnswer] = field.value; });
    memory.set(number(), values);
    return values;
  }
  function restore() {
    const values = memory.get(number()) || {};
    all("[data-iv-answer]", checkpoint).forEach((field) => {
      if (values[field.dataset.ivAnswer] !== undefined) field.value = values[field.dataset.ivAnswer];
    });
  }
  checkpoint?.addEventListener("submit", async (event) => {
    const f = event.target.closest("[data-iv-checkpoint-form]");
    if (!f) return;
    event.preventDefault();
    if (f.matches("[data-answer-form]")) one("[data-payload]", f).value = JSON.stringify(capture());
    if (f.matches("[data-reset]")) memory.delete(number());
    if (f.matches("[data-next],[data-restart]")) memory.clear();
    try {
      const response = await fetch(f.action, { method: "POST", body: new FormData(f), headers: { "X-Requested-With": "XMLHttpRequest" } });
      if (!response.ok) throw Error("Falha ao atualizar checkpoint.");
      const data = await response.json();
      checkpoint.innerHTML = data.html;
      restore();
    } catch (error) {
      const message = document.createElement("p");
      message.className = "gateway-feedback is-error";
      message.textContent = error.message;
      checkpoint.appendChild(message);
    }
  });
})();
