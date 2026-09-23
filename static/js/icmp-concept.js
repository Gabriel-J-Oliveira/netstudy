(() => {
  "use strict";
  const one = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const stageRoot = one("#icmp-lab [data-diag-stage]");
  const terminal = one("[data-icmp-terminal]");
  const commands = {
    "ping 192.168.50.30": () => "C:\\> ping 192.168.50.30\nReply from 192.168.50.30: bytes=32 time=23ms\nReply from 192.168.50.30: bytes=32 time=22ms\nReply from 192.168.50.30: bytes=32 time=24ms\nReply from 192.168.50.30: bytes=32 time=23ms\nSent = 4, Received = 4, Lost = 0 (0% loss) · Average = 23ms",
    "tracert 192.168.50.30": () => {
      const silent = stageRoot?.diagnosticStage?.scenario === "silent";
      return `C:\\> tracert 192.168.50.30\nCenário: ${silent ? "hop 2 silencioso" : "todos os hops respondem"}\n1    1 ms    1 ms    1 ms  192.168.10.1\n2  ${silent ? "  *       *       *     Request timed out." : "  8 ms    7 ms    8 ms  10.0.0.2"}\n3   15 ms   14 ms   16 ms  10.0.1.2\n4   23 ms   22 ms   24 ms  192.168.50.30`;
    },
  };
  function output(command) {
    const normalized = command.trim().replace(/\s+/g, " ").toLowerCase();
    const build = commands[normalized];
    if (!build) {
      one("[data-terminal-note]", terminal).textContent = "Comando não disponível neste cenário. Use ping 192.168.50.30 ou tracert 192.168.50.30.";
      return;
    }
    const pre = document.createElement("pre");
    pre.textContent = build();
    one("[data-terminal-stage]", terminal).appendChild(pre);
    one("[data-terminal-note]", terminal).textContent = normalized.startsWith("ping") ? "Quatro respostas nesta demonstração; não é o exemplo separado de 25% de perda." : "Saída didática do cenário selecionado no laboratório; cada linha reúne três sondas.";
  }
  all("[data-command]", terminal || document).forEach((button) => button.addEventListener("click", () => output(button.textContent)));
  one("[data-terminal-form]", terminal || document)?.addEventListener("submit", (event) => { event.preventDefault(); const input = one("[data-terminal-input]", terminal); output(input.value); input.value = ""; });
  stageRoot?.addEventListener("diagnostic:scenario", () => {
    one("[data-terminal-stage]", terminal)?.replaceChildren();
    one("[data-terminal-note]", terminal).textContent = "Cenário alterado. Execute o comando novamente para ver a saída correspondente.";
  });
  all("[data-prediction-question]").forEach((question) => {
    all("[data-prediction]", question).forEach((button) => button.addEventListener("click", () => {
      all("[data-prediction]", question).forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      const feedback = {
        reply: "Correto. No tracert ICMP deste cenário, PC-B responde com Echo Reply.",
        time: "Time Exceeded vem do roteador onde o TTL se esgota. A sonda TTL 4 chegou a PC-B, que responde com Echo Reply.",
        service: "Correto. Testar a aplicação web fornece evidência sobre o serviço que o Ping não testou.",
        ping: "Outro Ping testa novamente ICMP. Para investigar o sistema web, teste a aplicação diretamente.",
      };
      one("[data-prediction-feedback]", question).textContent = feedback[button.dataset.prediction];
    }));
  });

  const cp = one("#icmp-checkpoint"), memory = new Map();
  const num = () => one(".gateway-checkpoint-header>strong", cp)?.textContent.split(" ")[0] || "start";
  function capture() {
    const values = {};
    all("[data-icmp-answer]", cp).forEach((field) => { values[field.dataset.icmpAnswer] = field.value; });
    memory.set(num(), values);
    return values;
  }
  function restore() {
    const values = memory.get(num()) || {};
    all("[data-icmp-answer]", cp).forEach((field) => { if (values[field.dataset.icmpAnswer] !== undefined) field.value = values[field.dataset.icmpAnswer]; });
  }
  cp?.addEventListener("submit", async (event) => {
    const f = event.target.closest("[data-icmp-checkpoint-form]");
    if (!f) return;
    event.preventDefault();
    if (f.matches("[data-answer-form]")) one("[data-payload]", f).value = JSON.stringify(capture());
    if (f.matches("[data-reset]")) memory.delete(num());
    if (f.matches("[data-next],[data-restart]")) memory.clear();
    try {
      const response = await fetch(f.action, { method: "POST", body: new FormData(f), headers: { "X-Requested-With": "XMLHttpRequest" } });
      if (!response.ok) throw Error("Falha ao atualizar checkpoint.");
      const data = await response.json();
      cp.innerHTML = data.html;
      restore();
      window.NetStudyDiagnosticPath?.init(cp);
    } catch (error) {
      const message = document.createElement("p");
      message.className = "gateway-feedback is-error";
      message.textContent = error.message;
      cp.appendChild(message);
    }
  });
})();
