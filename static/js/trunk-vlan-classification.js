(() => {
  "use strict";

  function classifyFrame(inputTag, pvid, outputMode, peerPvid) {
    const internalVlan = inputTag || pvid;
    const outputTag = outputMode === "tagged" ? internalVlan : "";
    const peerVlan = outputTag || peerPvid;
    return { internalVlan, outputTag, peerVlan, sameVlan: internalVlan === peerVlan };
  }

  if (typeof module === "object" && module.exports) module.exports = { classifyFrame };
  if (typeof document === "undefined") return;

  const demo = document.querySelector("[data-trunk-tag-demo]");
  if (!demo) return;
  const input = demo.querySelector("[data-tag-input]");
  const pvid = demo.querySelector("[data-tag-pvid]");
  const output = demo.querySelector("[data-tag-output]");
  const peer = demo.querySelector("[data-tag-peer]");
  const result = demo.querySelector("[data-tag-result]");

  function updatePackage(position, vlan, label) {
    const box = demo.querySelector(`[data-tag-package="${position}"]`);
    box.dataset.vlan = vlan;
    box.querySelector("figcaption").textContent = label;
  }

  function render() {
    const inputTag = input.value;
    const { internalVlan, outputTag, peerVlan, sameVlan } = classifyFrame(inputTag, pvid.value, output.value, peer.value);
    const onWire = outputTag ? `Tagged VLAN ${outputTag}` : "Untagged";
    updatePackage("input", inputTag, inputTag ? `Tag 802.1Q · VLAN ${inputTag}` : "Sem tag");
    updatePackage("internal", internalVlan, `Contexto VLAN ${internalVlan}`);
    updatePackage("wire", outputTag, outputTag ? `Tag 802.1Q · VLAN ${outputTag}` : "Sem tag");
    updatePackage("peer", peerVlan, `Contexto VLAN ${peerVlan}`);
    demo.querySelector("[data-tag-ingress]").textContent = inputTag
      ? `A tag indica VLAN ${internalVlan}. O PVID ${pvid.value} não é usado.`
      : `Sem tag na entrada: o PVID atribui a VLAN ${internalVlan}.`;
    demo.querySelector("[data-tag-egress]").textContent = outputTag
      ? `SW1 ${inputTag ? "mantém" : "acrescenta"} a tag VLAN ${outputTag}.`
      : inputTag ? "SW1 remove a tag para transmitir." : "SW1 transmite sem acrescentar uma tag.";
    demo.querySelector("[data-tag-receive]").textContent = outputTag
      ? `O SW2 lê a VLAN ${peerVlan} na tag.`
      : `Sem tag no enlace: SW2 usa seu PVID ${peerVlan}.`;
    result.dataset.state = sameVlan ? "correct" : "incorrect";
    result.textContent = `SW1: VLAN ${internalVlan}. No enlace: ${onWire}. SW2: VLAN ${peerVlan}. ${sameVlan ? "O contexto foi preservado." : "Configuração inconsistente para este frame: o SW2 o classifica em outra VLAN."}`;
  }

  [input, pvid, output, peer].forEach(control => control.addEventListener("change", render));
  render();

  function showFeedback(group, correct, explanation) {
    group.dataset.state = correct ? "correct" : "incorrect";
    group.querySelector("[data-tag-feedback]").textContent = `${correct ? "Correto." : "Ainda não."} ${explanation}`;
  }

  function clearFeedback(group) {
    delete group.dataset.state;
    group.querySelector("[data-tag-feedback]").textContent = "";
  }

  const association = document.querySelector("[data-tag-association]");
  const matches = association.querySelectorAll("[data-tag-match]");
  for (const match of matches) {
    const control = match.querySelector("select");
    control.addEventListener("change", () => {
      if (!control.value) {
        clearFeedback(match);
        return;
      }
      const correct = control.value === match.dataset.tagMatch;
      showFeedback(match, correct, correct ? match.dataset.feedback : "Compare o termo com a etapa da demonstração em que ele aparece.");
    });
  }
  association.querySelector("[data-tag-reset]").addEventListener("click", () => {
    for (const match of matches) {
      match.querySelector("select").value = "";
      clearFeedback(match);
    }
    matches[0].querySelector("select").focus();
  });

  const rapid = document.querySelector("[data-tag-rapid]");
  for (const question of rapid.querySelectorAll("fieldset")) {
    const choices = question.querySelectorAll("[data-tag-answer]");
    for (const choice of choices) {
      choice.addEventListener("click", () => {
        for (const option of choices) option.setAttribute("aria-pressed", String(option === choice));
        showFeedback(question, choice.dataset.correct === "true", choice.dataset.feedback);
      });
    }
  }
  rapid.querySelector("[data-tag-reset]").addEventListener("click", () => {
    for (const question of rapid.querySelectorAll("fieldset")) clearFeedback(question);
    const choices = rapid.querySelectorAll("[data-tag-answer]");
    for (const choice of choices) choice.setAttribute("aria-pressed", "false");
    choices[0].focus();
  });
})();
