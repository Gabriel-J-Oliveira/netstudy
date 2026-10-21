(() => {
  "use strict";
  const root = document.querySelector("[data-l2-practice]");
  if (!root) return;
  const sections = [...root.querySelectorAll("[data-l2-case]")];
  const selectors = [...root.querySelectorAll("[data-l2-select]")];
  const progress = root.querySelector("[data-l2-progress]");
  const verified = new Set(selectors.filter(button => button.querySelector("[data-l2-badge]")?.textContent.includes("Verificado")).map(button => button.dataset.l2Select));

  function show(id) {
    sections.forEach(section => { section.hidden = section.dataset.l2Case !== id; });
    selectors.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.l2Select === id)));
  }
  function updateProgress(ids) {
    verified.clear();
    ids.forEach(id => verified.add(id));
    selectors.forEach(button => {
      button.querySelector("[data-l2-badge]").textContent = verified.has(button.dataset.l2Select) ? "✓ Verificado" : "Pendente";
    });
    progress.textContent = `${verified.size} de 3 cenários verificados corretamente${verified.size === 3 ? " · Atividade L2-02 concluída" : ""}`;
  }
  function feedback(target, data) {
    target.replaceChildren();
    target.classList.toggle("is-correct", Boolean(data.result?.correct));
    target.classList.toggle("is-incorrect", !data.result?.correct);
    const heading = document.createElement("strong");
    heading.textContent = data.error ? "Não foi possível verificar" : data.result?.correct ? "Correto" : "Ainda não";
    target.append(heading);
    const messages = data.error ? [data.error] : [data.result.summary, ...data.result.feedback.map(item => item.message)];
    messages.forEach(message => {
      const paragraph = document.createElement("p");
      paragraph.textContent = message;
      target.append(paragraph);
    });
    target.focus({ preventScroll: true });
  }
  async function send(form) {
    const response = await fetch(form.getAttribute("action"), {
      method: "POST", body: new FormData(form), credentials: "same-origin",
      headers: { "X-Requested-With": "XMLHttpRequest" }
    });
    return { response, data: await response.json() };
  }
  selectors.forEach(button => button.addEventListener("click", () => show(button.dataset.l2Select)));
  sections.forEach(section => section.querySelector("[data-l2-form]").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const { data } = await send(form);
      updateProgress(data.verified || [...verified]);
      feedback(section.querySelector("[data-l2-feedback]"), data);
    } catch {
      feedback(section.querySelector("[data-l2-feedback]"), { error: "A conexão falhou. Sua resposta permanece na tela; tente verificar novamente." });
    } finally { button.disabled = false; }
  }));
  root.querySelector("[data-l2-reset]").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const { response, data } = await send(form);
      if (!response.ok) throw new Error();
      sections.forEach(section => {
        section.querySelector("form").reset();
        section.querySelector("[data-l2-feedback]").replaceChildren();
      });
      updateProgress(data.verified);
      show(sections[0].dataset.l2Case);
      selectors[0].focus();
    } catch { progress.textContent = "Não foi possível recomeçar agora. O progresso anterior foi preservado."; }
  });
  show(sections.find(section => !verified.has(section.dataset.l2Case))?.dataset.l2Case || sections[0].dataset.l2Case);
})();
