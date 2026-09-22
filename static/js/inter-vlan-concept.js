(() => {
  "use strict";
  const one = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const stageRoot = one("[data-iv-stage]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const stageDetails = {
    isolation: ["Área 01 · Domínios L2", "Identifique quem pode encaminhar entre as VLANs."],
    host: ["Área 02 · Decisão do host", "Preencha o IPv4 que PC-A deve resolver com ARP."],
    router: ["Área 03 · Frame e rota", "Construa o primeiro frame e inspecione a rota correta."],
    frames: ["Área 04 · Packet Inspector", "Compare o pacote e construa as duas entregas Ethernet."],
    journey: ["Área 05 · Percurso completo", "Avance manualmente do PC-A até o PC-B."],
  };

  function activate(mode) {
    if (!stageRoot?.interVlanStage) return;
    stageRoot.interVlanStage.setMode(mode);
    one("[data-iv-stage-title]").textContent = stageDetails[mode][0];
    one("[data-iv-stage-copy]").textContent = stageDetails[mode][1];
  }

  all("[data-iv-stage-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      activate(link.dataset.ivStageLink);
      one("#iv-shared-lab")?.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
    });
  });

  stageRoot?.addEventListener("ivstage:feedback", (event) => {
    const target = one(`[data-${event.detail.mode}-feedback]`);
    if (!target) return;
    target.textContent = event.detail.text;
    target.classList.toggle("feedback-ok", event.detail.ok === true);
    target.classList.toggle("feedback-error", event.detail.ok === false);
  });

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
