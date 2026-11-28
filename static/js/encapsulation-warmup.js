(() => {
  "use strict";

  const association = document.querySelector("[data-enc-associations]");
  const rapid = document.querySelector("[data-enc-rapid]");
  if (!association || !rapid) return;

  const pairs = [...association.querySelectorAll("[data-enc-match]")];
  const summary = association.querySelector("[data-match-summary]");
  function updateMatches() {
    const complete = pairs.every(pair => pair.dataset.state === "correct");
    summary.textContent = complete ? "Todas as associações estão corretas." : "";
  }

  for (const pair of pairs) {
    const select = pair.querySelector("select");
    const result = pair.querySelector("[data-match-result]");
    select.addEventListener("change", () => {
      const correct = select.value === pair.dataset.encMatch;
      pair.dataset.state = !select.value ? "" : correct ? "correct" : "incorrect";
      result.textContent = !select.value ? "" : correct
        ? "Correto. " + pair.dataset.matchFeedback
        : "Ainda não. " + pair.dataset.matchFeedback;
      updateMatches();
    });
  }
  association.querySelector("[data-match-reset]").addEventListener("click", () => {
    for (const pair of pairs) {
      pair.querySelector("select").value = "";
      pair.querySelector("[data-match-result]").textContent = "";
      pair.dataset.state = "";
    }
    updateMatches();
    pairs[0].querySelector("select").focus();
  });

  const questions = [...rapid.querySelectorAll("[data-rapid-question]")];
  const next = rapid.querySelector("[data-rapid-next]");
  const done = rapid.querySelector("[data-rapid-done]");
  let index = 0;

  function showQuestion(moveFocus) {
    const current = questions[index];
    for (const question of questions) question.hidden = question !== current;
    done.hidden = Boolean(current);
    next.hidden = !current;
    next.disabled = true;
    next.textContent = index === questions.length - 1 ? "Concluir Rapid Fire" : "Próxima pergunta";
    if (moveFocus) {
      const target = current ? current.querySelector("[data-rapid-title]") : done;
      target.focus();
    }
  }

  for (const question of questions) {
    const buttons = [...question.querySelectorAll("[data-rapid-option]")];
    const result = question.querySelector("[data-rapid-result]");
    for (const button of buttons) {
      button.addEventListener("click", () => {
        if (question.hidden || question.dataset.state === "correct") return;
        const correct = button.dataset.correct === "true";
        question.dataset.state = correct ? "correct" : "incorrect";
        for (const option of buttons) option.setAttribute("aria-pressed", String(option === button));
        result.textContent = (correct ? "Correto. " : "Ainda não. ") + button.dataset.feedback;
        next.disabled = !correct;
      });
    }
  }

  next.addEventListener("click", () => {
    if (questions[index]?.dataset.state !== "correct") return;
    index += 1;
    showQuestion(true);
  });
  rapid.querySelector("[data-rapid-reset]").addEventListener("click", () => {
    for (const question of questions) {
      question.dataset.state = "";
      question.querySelector("[data-rapid-result]").textContent = "";
      for (const button of question.querySelectorAll("[data-rapid-option]")) {
        button.setAttribute("aria-pressed", "false");
      }
    }
    index = 0;
    showQuestion(true);
  });
  showQuestion(false);
})();
