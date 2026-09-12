(() => {
  "use strict";
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const one = (selector, root = document) => root.querySelector(selector);
  const chip = (value, label, state = "") => `<span class="transport-unit ${state}"><b>${value}</b><small>${label}</small></span>`;

  function resetStage(stage) {
    one("[data-stage-source]", stage).innerHTML = "";
    one("[data-stage-destination]", stage).innerHTML = "";
    one("[data-stage-timeline]", stage).innerHTML = "<li>Use o controle para observar o comportamento.</li>";
    one("[data-stage-result]", stage).textContent = "";
    stage.dataset.executed = "false";
  }

  function runStage(stage) {
    const protocol = stage.dataset.protocol;
    const scenario = stage.dataset.scenario;
    const source = one("[data-stage-source]", stage);
    const destination = one("[data-stage-destination]", stage);
    const timeline = one("[data-stage-timeline]", stage);
    const result = one("[data-stage-result]", stage);
    stage.dataset.executed = "true";
    if (scenario === "normal") {
      source.innerHTML = ["A", "B", "C"].map(x => chip(x, `Datagrama ${x}`)).join("");
      destination.innerHTML = ["A", "B", "C"].map(x => chip(x, `Datagrama ${x} — recebido`, "arrived")).join("");
      timeline.innerHTML = "<li>A, B e C foram enviados como datagramas distintos.</li><li>Todos chegaram e seus limites foram preservados.</li>";
      result.textContent = "UDP normal: a aplicação recebeu três datagramas independentes.";
    } else if (scenario === "loss" && protocol === "udp") {
      source.innerHTML = chip(1, "Datagrama 1 — enviado") + chip(2, "Datagrama 2 — enviado") + chip(3, "Datagrama 3 — perdido", "lost") + chip(4, "Datagrama 4 — enviado");
      destination.innerHTML = [1, 2, 4].map(x => chip(x, `Datagrama ${x} — recebido`, "arrived")).join("");
      timeline.innerHTML = "<li>Datagramas 1 e 2 chegaram.</li><li>Datagrama 3 — perdido.</li><li>Datagrama 4 chegou.</li><li>UDP não retransmitiu 3 automaticamente.</li>";
      result.textContent = "Destino recebeu: 1, 2 e 4.";
    } else if (scenario === "loss" && protocol === "tcp") {
      source.innerHTML = chip("A", "Byte block A") + chip("B", "Byte block B") + chip("C", "Byte block C — retransmitido", "retransmitted") + chip("D", "Byte block D");
      destination.innerHTML = ["A", "B", "C", "D"].map(x => chip(x, `Byte block ${x} — no fluxo`, "arrived")).join("");
      timeline.innerHTML = "<li>A e B chegaram.</li><li>Byte block C — ausente; D chegou fisicamente.</li><li>TCP detectou conceitualmente a ausência.</li><li>C foi retransmitido.</li><li>A aplicação recebeu o fluxo A, B, C e D.</li>";
      result.textContent = "Detecção conceitual → retransmissão → fluxo completo em ordem.";
    } else if (scenario === "order" && protocol === "udp") {
      source.innerHTML = [1, 2, 3].map(x => chip(x, `Datagrama ${x} — enviado`)).join("");
      destination.innerHTML = [1, 3, 2].map(x => chip(x, `Datagrama ${x} — recebido`, "arrived")).join("");
      timeline.innerHTML = "<li>Origem enviou 1, 2 e 3.</li><li>A rede entregou 1, 3 e 2.</li><li>UDP apresentou os datagramas conforme recebidos.</li>";
      result.textContent = "UDP não oferece reordenação garantida dos datagramas.";
    } else if (scenario === "order" && protocol === "tcp") {
      source.innerHTML = [1, 2, 3].map(x => chip(x, `Byte block ${x} — enviado`)).join("");
      destination.innerHTML = [1, 2, 3].map(x => chip(x, `Byte block ${x} — no fluxo`, "arrived")).join("");
      timeline.innerHTML = "<li>A rede entregou 1, 3 e 2.</li><li>TCP reorganizou conceitualmente o fluxo.</li><li>A aplicação recebeu 1, 2 e 3.</li>";
      result.textContent = "TCP disponibilizou o fluxo na ordem apropriada.";
    } else if (scenario === "boundaries") {
      source.innerHTML = chip("ABC", "Envio 1") + chip("DEF", "Envio 2");
      destination.innerHTML = chip("ABC · DEF", "UDP: dois datagramas", "arrived") + chip("ABCDEF", "TCP: fluxo de bytes", "retransmitted");
      timeline.innerHTML = "<li>UDP preserva os limites: ABC e DEF.</li><li>TCP oferece o fluxo ABCDEF.</li>";
      result.textContent = "Mesmos dados; modelos de dados diferentes.";
    }
  }

  all("[data-transport-stage]").forEach(stage => {
    one("[data-stage-run]", stage)?.addEventListener("click", () => runStage(stage));
    one("[data-stage-reset]", stage)?.addEventListener("click", () => resetStage(stage));
  });

  const roleFeedback = {routing: "Routing → Camada 3: escolhe o caminho.", tcp: "TCP → transporte com mecanismos de ordem e confiabilidade.", udp: "UDP → transporte de datagramas."};
  all("[data-responsibility] [data-role]").forEach(button => button.addEventListener("click", () => {
    button.classList.add("is-correct"); button.setAttribute("aria-pressed", "true");
    one("[data-role-feedback]", button.closest("[data-responsibility]")).textContent = roleFeedback[button.dataset.role];
  }));

  function bindSingle(root, correct, feedback, wrongFirst, wrongSecond = wrongFirst) {
    if (!root) return;
    root.dataset.tries = "0";
    all("[data-answer]", root).forEach(button => button.addEventListener("click", () => {
      const right = button.dataset.answer === correct;
      all("[data-answer]", root).forEach(x => x.classList.remove("is-correct", "is-wrong"));
      button.classList.add(right ? "is-correct" : "is-wrong");
      if (right) {
        all("[data-answer]", root).forEach(x => x.disabled = true);
        one("p[aria-live]", root).textContent = feedback;
      } else {
        root.dataset.tries = String(Number(root.dataset.tries) + 1);
        one("p[aria-live]", root).textContent = Number(root.dataset.tries) === 1 ? wrongFirst : wrongSecond;
      }
    }));
  }
  bindSingle(one("[data-udp-check]"), "nothing", "Correto. Destino recebeu 1, 2 e 4; o próprio UDP não recuperou 3.", "Qual dos protocolos estudados possui confirmação e retransmissão integradas ao transporte?", "UDP não possui retransmissão automática embutida.");
  bindSingle(one("[data-tcp-check]"), "no", "Correto. Depois da recuperação, a aplicação recebeu o fluxo completo A, B, C e D.", "Observe o resultado entregue à aplicação, não a chegada física inicial.");
  bindSingle(one("[data-loss-visible]"), "no", "Correto. A aplicação pode tolerar, ocultar ou recuperar a perda com mecanismos próprios.", "UDP não fornece recuperação por si, mas a aplicação pode tratar o resultado.");

  const requirementAnswers = {a: "tcp", b: "udp", c: "unknown"};
  all("[data-requirement]").forEach(row => all("[data-pick]", row).forEach(button => button.addEventListener("click", () => {
    const right = button.dataset.pick === requirementAnswers[row.dataset.requirement];
    button.classList.add(right ? "is-correct" : "is-wrong");
    one("span[aria-live]", row).textContent = right ? "Correto." : row.dataset.requirement === "c" ? "Esse requisito isolado não determina o protocolo. Precisamos conhecer as propriedades exigidas e o protocolo superior." : "Revise o modelo de dados e a responsabilidade desejada no transporte.";
  })));

  all("[data-interaction-reset]").forEach(button => button.addEventListener("click", () => {
    const root = button.parentElement.closest("[data-responsibility], [data-udp-check], [data-tcp-check], [data-requirements], [data-loss-visible], [data-transport-rapid]");
    if (!root) return;
    all("button", root).forEach(x => { if (!x.matches("[data-interaction-reset]")) { x.disabled = false; x.classList.remove("is-correct", "is-wrong"); x.removeAttribute("aria-pressed"); } });
    all("[aria-live]", root).forEach(x => x.textContent = ""); root.dataset.tries = "0";
    if (root.matches("[data-transport-rapid]")) initRapid(root);
  }));

  const rapid = [
    {q: "1. TCP entrega mensagens independentes ou fluxo de bytes?", choices: [["stream", "Fluxo de bytes"], ["messages", "Mensagens independentes"]], a: "stream", f: "TCP oferece um fluxo de bytes."},
    {q: "2. UDP preserva limites entre datagramas?", choices: [["yes", "Sim"], ["no", "Não"]], a: "yes", f: "Sim. Cada datagrama permanece uma unidade independente."},
    {q: "3. UDP retransmite automaticamente um datagrama perdido?", choices: [["no", "Não"], ["yes", "Sim"]], a: "no", f: "Não. O próprio UDP não implementa retransmissão automática."},
    {q: "4. TCP possui mecanismos para ordenação e recuperação de perdas?", choices: [["yes", "Sim"], ["no", "Não"]], a: "yes", f: "Sim, enquanto a conexão está funcionando."},
    {q: "5. “UDP sempre é mais rápido que TCP.”", choices: [["simple", "Simplificação"], ["correct", "Correto"]], a: "simple", f: "É uma simplificação. Desempenho depende da aplicação, rede, implementação e protocolo superior."},
  ];
  function initRapid(root) {
    root.dataset.index = "0"; renderRapid(root);
  }
  function renderRapid(root) {
    const item = rapid[Number(root.dataset.index)];
    one("[data-rapid-question]", root).textContent = item.q;
    const buttons = all("[data-rapid]", root);
    buttons.forEach((button, index) => { button.hidden = false; button.disabled = false; button.classList.remove("is-correct", "is-wrong"); button.dataset.rapid = item.choices[index][0]; button.textContent = item.choices[index][1]; });
    one("[data-rapid-feedback]", root).textContent = "";
  }
  const rapidRoot = one("[data-transport-rapid]");
  rapidRoot && initRapid(rapidRoot);
  all("[data-rapid]", rapidRoot || document).forEach(button => button.addEventListener("click", () => {
    const index = Number(rapidRoot.dataset.index), item = rapid[index], right = button.dataset.rapid === item.a;
    button.classList.add(right ? "is-correct" : "is-wrong");
    one("[data-rapid-feedback]", rapidRoot).textContent = right ? item.f : "Revise a propriedade do transporte apresentada nesta página.";
    if (right) setTimeout(() => { if (index < rapid.length - 1) { rapidRoot.dataset.index = String(index + 1); renderRapid(rapidRoot); } else { all("[data-rapid]", rapidRoot).forEach(x => x.hidden = true); one("[data-rapid-question]", rapidRoot).textContent = "Rapid Fire concluído · 5 de 5 situações percorridas"; } }, 350);
  }));

  all("[data-reference-reveal]").forEach(button => button.addEventListener("click", () => {
    const card = button.closest("[data-self]"); one("[data-reference]", card).hidden = false; one("textarea", card).readOnly = true; button.disabled = true;
  }));

  const checkpoint = one("#transport-checkpoint"), memory = new Map();
  const currentNumber = () => one(".gateway-checkpoint-header>strong", checkpoint)?.textContent.split(" ")[0] || "start";
  function capture() { const values = {}; all("[data-transport-answer]", checkpoint).forEach(field => values[field.dataset.transportAnswer] = field.value); memory.set(currentNumber(), values); return values; }
  function restore() { const values = memory.get(currentNumber()) || {}; all("[data-transport-answer]", checkpoint).forEach(field => { if (values[field.dataset.transportAnswer] !== undefined) field.value = values[field.dataset.transportAnswer]; }); }
  checkpoint?.addEventListener("submit", async event => {
    const form = event.target.closest("[data-transport-checkpoint-form]"); if (!form) return;
    event.preventDefault();
    if (form.matches("[data-answer-form]")) one("[data-payload]", form).value = JSON.stringify(capture());
    if (form.matches("[data-reset]")) memory.delete(currentNumber());
    if (form.matches("[data-next], [data-restart]")) memory.clear();
    try {
      const response = await fetch(form.action, {method: "POST", body: new FormData(form), headers: {"X-Requested-With": "XMLHttpRequest"}});
      if (!response.ok) throw Error("Falha ao atualizar checkpoint.");
      const data = await response.json(); checkpoint.innerHTML = data.html; restore();
    } catch (error) { const note = document.createElement("p"); note.className = "gateway-feedback is-error"; note.textContent = error.message; checkpoint.appendChild(note); }
  });
})();
