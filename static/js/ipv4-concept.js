(() => {
  "use strict";
  const one = (selector, scope = document) => scope.querySelector(selector);
  const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const feedback = (root, message, ok = null) => {
    const node = typeof root === "string" ? one(root) : root;
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("feedback-ok", ok === true);
    node.classList.toggle("feedback-error", ok === false);
  };

  const layerState = {};
  all("[data-layer-item]").forEach((button) => button.addEventListener("click", () => {
    layerState[button.dataset.layerItem] = button.dataset.layerAnswer;
    all(`[data-layer-item='${button.dataset.layerItem}']`).forEach((item) => item.classList.toggle("is-selected", item === button));
    if (layerState.ipv4 && layerState.mac) {
      const ok = layerState.ipv4 === "3" && layerState.mac === "2";
      feedback(one("[data-layer-feedback]"), ok ? "Correto. IPv4 atua na Camada 3; MAC participa da entrega Ethernet na Camada 2." : "Revise: IPv4 é endereço lógico de Camada 3; MAC é usado na Camada 2.", ok);
    }
  }));

  one("[data-mask-reveal]")?.addEventListener("click", (event) => { one("[data-mask-answer]").hidden = false; event.currentTarget.disabled = true; });
  all("[data-prefix]").forEach((button) => button.addEventListener("click", () => {
    const prefix = Number(button.dataset.prefix), visualizer = one("#ipv4-mask [data-subnet-visualizer]")?.subnetVisualizer;
    visualizer?.setConfig({prefix});
    all("[data-prefix]").forEach((item) => item.classList.toggle("is-active", item === button));
    const readout = one("[data-context-readout]");
    readout.innerHTML = prefix === 16 ? "<code>192.168 | 10.25</code><span>/16 · máscara 255.255.0.0</span>" : "<code>192.168.10 | 25</code><span>/24 · máscara 255.255.255.0</span>";
  }));

  all("[data-block-choice] button").forEach((button) => button.addEventListener("click", () => {
    const output = one("p", button.closest("[data-block-choice]")), ok = button.dataset.choice === "128";
    feedback(output, ok ? "Correto. .200 está no bloco 128–255." : "O primeiro bloco termina em 127; .200 está no segundo bloco.", ok);
  }));
  one("[data-placement-check]")?.addEventListener("click", () => {
    const expected = {10: "0", 70: "64", 150: "128", 220: "192"};
    const wrong = all("[data-placement-ip]").filter((field) => field.value !== expected[field.dataset.placementIp]);
    feedback(one("[data-placement-feedback]"), wrong.length ? `Revise ${wrong.length} posição(ões). O /26 avança em blocos de 64.` : "Correto: .10→0–63, .70→64–127, .150→128–191 e .220→192–255.", wrong.length === 0);
  });

  all("[data-local-classifier] article").forEach((card) => card.addEventListener("click", (event) => {
    const button = event.target.closest("button"); if (!button) return;
    const octet = Number(card.dataset.destination), expected = octet <= 127 ? "local" : "remoto", ok = button.dataset.verdict === expected;
    all("button", card).forEach((item) => item.classList.toggle("is-selected", item === button));
    feedback(one("p", card), ok ? `Correto. .${octet} está ${expected === "local" ? "dentro de 64–127" : "fora de 64–127"}.` : `Posicione .${octet} no intervalo /26 antes de decidir.`, ok);
  }));
  all("[data-prefix-trap] button").forEach((button) => button.addEventListener("click", () => {
    const ok = button.dataset.answer === "nao";
    feedback(one("p:last-child", button.closest("[data-prefix-trap]")), ok ? "Correto. .20 está em 0–127 e .180 em 128–255; são sub-redes /25 diferentes." : "Os três primeiros octetos iguais não bastam: compare os blocos definidos por /25.", ok);
  }));

  const terminal = one("#ipv4-terminal [data-terminal-form]");
  function showConfig(event) {
    event?.preventDefault();
    const stage = one("#ipv4-terminal [data-terminal-stage]");
    const output = document.createElement("pre");
    output.textContent = "C:\\> ipconfig /all\n\nEthernet adapter Ethernet:\n   IPv4 Address. . . . . : 192.168.50.70\n   Subnet Mask . . . . . : 255.255.255.192\n   Default Gateway . . . : 192.168.50.65";
    stage?.appendChild(output); one("[data-terminal-fields]").hidden = false;
  }
  terminal?.addEventListener("submit", showConfig); one("[data-terminal-run]")?.addEventListener("click", showConfig);
  const selectedFields = new Set();
  all("[data-config-field]").forEach((button) => button.addEventListener("click", () => { const key = button.dataset.configField; selectedFields.has(key) ? selectedFields.delete(key) : selectedFields.add(key); button.classList.toggle("is-selected", selectedFields.has(key)); }));
  one("[data-analyze-config]")?.addEventListener("click", () => {
    const ok = selectedFields.size === 2 && selectedFields.has("ip") && selectedFields.has("mask");
    feedback(one("[data-config-feedback]"), ok ? "Correto. 255.255.255.192 é /26; .70 está na sub-rede 64–127." : "Selecione IPv4 Address e Subnet Mask. O gateway não define a sub-rede da interface.", ok);
    if (ok) one("[data-terminal-visualizer]").hidden = false;
  });

  const rapid = [
    {q: "1. O IPv4 sozinho define a sub-rede?", a: "nao", why: "Não. É necessário interpretar máscara ou prefixo."},
    {q: "2. Qual informação deve acompanhar o IPv4?", a: "prefixo", why: "Máscara ou prefixo define o contexto de sub-rede."},
    {q: "3. .70/26 e .100/26 estão na mesma sub-rede?", a: "sim", why: "Sim. Ambos estão no bloco 64–127."},
    {q: "4. .70/26 e .150/26 estão na mesma sub-rede?", a: "nao", why: "Não. .150 está no bloco 128–191."},
  ];
  let rapidIndex = 0;
  const rapidRoot = one("[data-rapid-fire]");
  function renderRapid() {
    one("[data-rapid-question]", rapidRoot).textContent = rapid[rapidIndex].q;
    const second = rapidIndex === 1;
    all("[data-rapid]", rapidRoot).forEach((button, index) => { button.dataset.rapid = second ? (index ? "prefixo" : "gateway") : (index ? "nao" : "sim"); button.textContent = second ? (index ? "Máscara / prefixo" : "Gateway") : (index ? "Não" : "Sim"); });
  }
  all("[data-rapid]", rapidRoot || document).forEach((button) => button.addEventListener("click", () => {
    const current = rapid[rapidIndex];
    if (button.dataset.rapid !== current.a) { feedback(one("[data-rapid-feedback]", rapidRoot), current.why, false); return; }
    feedback(one("[data-rapid-feedback]", rapidRoot), current.why, true);
    if (rapidIndex < rapid.length - 1) { rapidIndex += 1; window.setTimeout(() => { renderRapid(); feedback(one("[data-rapid-feedback]", rapidRoot), ""); }, 450); } else all("button", rapidRoot).forEach((item) => item.disabled = true);
  }));
  one("[data-reference-reveal]")?.addEventListener("click", () => { one("[data-reference]").hidden = false; });

  const memory = new Map();
  const checkpoint = one("#ipv4-checkpoint");
  checkpoint?.addEventListener("click", (event) => {
    if (event.target.closest("[data-reference-reveal]")) one("[data-reference]", checkpoint).hidden = false;
  });
  function currentNumber(scope) { return one(".checkpoint-header > strong", scope)?.textContent.trim().split(" ")[0] || "start"; }
  function capture(scope) { const values = {}; all("[data-ipv4-answer-field]", scope).forEach((field) => { values[field.dataset.ipv4AnswerField] = field.value; }); memory.set(currentNumber(scope), values); return values; }
  function restore(scope) { const values = memory.get(currentNumber(scope)) || {}; all("[data-ipv4-answer-field]", scope).forEach((field) => { if (values[field.dataset.ipv4AnswerField] !== undefined) field.value = values[field.dataset.ipv4AnswerField]; }); }
  checkpoint?.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-checkpoint-form]"); if (!form) return;
    event.preventDefault();
    if (form.matches("[data-answer-form]")) one("[data-answer-payload]", form).value = JSON.stringify(capture(checkpoint));
    if (form.matches("[data-reset-current]")) memory.delete(currentNumber(checkpoint));
    if (form.matches("[data-checkpoint-next], [data-checkpoint-restart]")) memory.clear();
    const button = one("button[type='submit']", form); if (button) button.disabled = true;
    try {
      const response = await fetch(form.action, {method: "POST", body: new FormData(form), headers: {"X-Requested-With": "XMLHttpRequest"}});
      if (!response.ok) throw new Error("Falha ao atualizar o checkpoint.");
      const data = await response.json(); checkpoint.innerHTML = data.html; window.NetStudySubnet?.init(checkpoint); restore(checkpoint);
      one(".checkpoint-feedback", checkpoint)?.focus?.();
    } catch (error) { feedback(one(".checkpoint-feedback", checkpoint) || checkpoint.appendChild(document.createElement("p")), error.message, false); }
  });
})();
