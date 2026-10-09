"use strict";
(function () {
  const root = document.querySelector("[data-practice-attempts]");
  const api = window.NetStudyLabAttempts;
  if (!root || !api) return;
  const notice = root.querySelector("[data-practice-storage-status]");
  const labUrl = root.dataset.labUrl;
  const returnedAttemptId = new URLSearchParams(window.location.search).get("attempt");
  let store;
  try { store = api.create(window.localStorage); store.list(); }
  catch (error) { notice.textContent = `Continuidade indisponível: ${error.message} Os exercícios ainda podem ser abertos sem salvamento automático.`; return; }
  const seed = () => String(window.crypto.getRandomValues(new Uint32Array(1))[0]);
  const href = id => `${labUrl}?attempt=${encodeURIComponent(id)}`;
  function warn(error) { notice.textContent = `Não foi possível atualizar a tentativa: ${error.message}`; }
  function render() {
    try {
      const attempts = store.list();
      for (const section of root.querySelectorAll("[data-practice-family]")) {
        const family = section.dataset.practiceFamily;
        const matching = attempts.filter(item => item.exerciseId === family);
        const latest = matching.find(item => item.attemptId === returnedAttemptId) || matching[0];
        const status = section.querySelector("[data-practice-status]");
        const actions = section.querySelector("[data-practice-actions]");
        const others = section.querySelector("[data-practice-other-attempts]");
        status.textContent = !latest ? "Não iniciado" : latest.status === "completed" ? "Concluído" : latest.status === "in_progress" ? "Em andamento" : "Não iniciado";
        actions.hidden = !latest;
        others.replaceChildren();
        if (!latest) continue;
        actions.querySelector("[data-practice-continue]").href = href(latest.attemptId);
        actions.querySelector("[data-practice-continue]").textContent = latest.status === "completed" ? "Rever tentativa" : "Continuar tentativa";
        actions.querySelectorAll("button").forEach(button => button.dataset.attemptId = latest.attemptId);
        for (const item of matching.filter(item => item.attemptId !== latest.attemptId)) {
          const row = document.createElement("div");
          const link = document.createElement("a");
          link.href = href(item.attemptId);
          link.textContent = `${item.seed} · ${item.difficulty} · ${item.status === "completed" ? "Concluído" : "Em andamento"}`;
          if (!item.compatible) { link.removeAttribute("href"); link.textContent += " · versão incompatível"; }
          const discard = document.createElement("button");
          discard.type = "button"; discard.dataset.practiceDiscard = ""; discard.dataset.attemptId = item.attemptId;
          discard.textContent = "Descartar";
          row.append(link, discard); others.append(row);
        }
        others.hidden = matching.length < 2;
        if (!latest.compatible) {
          actions.querySelector("[data-practice-continue]").removeAttribute("href");
          actions.querySelector("[data-practice-restart]").disabled = true;
          status.textContent += " · versão incompatível";
        } else actions.querySelector("[data-practice-restart]").disabled = false;
      }
    } catch (error) { warn(error); }
  }
  root.addEventListener("submit", event => {
    const form = event.target.closest("[data-practice-start]");
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    try {
      const attempt = store.createAttempt(data.get("exercise"), seed(), data.get("difficulty"), data.get("mode"));
      window.location.assign(href(attempt.attemptId));
    } catch (error) { warn(error); }
  });
  root.addEventListener("click", event => {
    const button = event.target.closest("[data-practice-new], [data-practice-restart], [data-practice-discard]");
    if (!button) return;
    const id = button.dataset.attemptId;
    try {
      if (button.hasAttribute("data-practice-new")) {
        const old = store.get(id);
        let fresh = seed(); if (fresh === old.seed) fresh = String((Number(fresh) + 1) >>> 0);
        window.location.assign(href(store.newVariation(id, fresh).attemptId));
      } else if (button.hasAttribute("data-practice-restart")) {
        store.restart(id); window.location.assign(href(id));
      } else if (window.confirm("Descartar esta tentativa? Essa ação não afeta outras tentativas ou Meus cenários.")) {
        store.discard(id); render(); notice.textContent = "Tentativa descartada; as demais foram preservadas.";
      }
    } catch (error) { warn(error); }
  });
  render();
})();
