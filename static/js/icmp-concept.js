(() => {
  "use strict";
  const one = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const stageRoot = one("[data-diag-stage]");
  const stage = stageRoot?.diagnosticStage;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const modes = {
    ping: ["Área 01 · Ping", "Avance do Request até o Reply."],
    messages: ["Área 02 · Packet Inspector", "Compare a solicitação com a resposta."],
    evidence: ["Área 03 · Evidência", "Separe observação, conclusão segura e hipóteses."],
    trace: ["Área 04 · Traceroute", "Controle o TTL da sonda."],
  };
  function activate(mode) {
    stage?.setMode(mode);
    one("[data-diag-mode-title]").textContent = modes[mode][0];
    one("[data-diag-mode-copy]").textContent = modes[mode][1];
  }
  all("[data-diag-mode-link]").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    activate(link.dataset.diagModeLink);
    one("#icmp-shared-lab")?.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
  }));
  stageRoot?.addEventListener("diagnostic:feedback", (event) => {
    const target = one(`[data-${event.detail.mode}-feedback]`);
    if (target) target.textContent = event.detail.text;
  });
  one("[data-missing-demo]")?.addEventListener("click", () => {
    activate("trace");
    stage?.showMissingHop();
    one("#icmp-shared-lab")?.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
  });

  const terminal = one("[data-icmp-terminal]");
  const commands = {
    "ping 192.168.50.30": "C:\\> ping 192.168.50.30\nReply from 192.168.50.30: bytes=32 time=23ms\nReply from 192.168.50.30: bytes=32 time=22ms\nReply from 192.168.50.30: bytes=32 time=24ms\nReply from 192.168.50.30: bytes=32 time=23ms\nSent = 4, Received = 4, Lost = 0 · Average = 23ms",
    "tracert 192.168.50.30": "C:\\> tracert 192.168.50.30\n1  1 ms  192.168.10.1\n2  8 ms  10.0.0.2\n3  15 ms 10.0.1.2\n4  23 ms 192.168.50.30",
  };
  function output(command) {
    const normalized = command.trim().replace(/\s+/g, " ").toLowerCase();
    const text = commands[normalized];
    if (!text) {
      one("[data-terminal-note]", terminal).textContent = "Comando não disponível neste cenário. Use ping 192.168.50.30 ou tracert 192.168.50.30.";
      return;
    }
    const pre = document.createElement("pre");
    pre.textContent = text;
    one("[data-terminal-stage]", terminal).appendChild(pre);
    one("[data-terminal-note]", terminal).textContent = normalized.startsWith("ping") ? "O Reply é evidência desta troca ICMP, não do funcionamento de outros serviços." : "As respostas indicam pontos observados no caminho; ele pode mudar.";
  }
  all("[data-command]", terminal || document).forEach((button) => button.addEventListener("click", () => output(button.textContent)));
  one("[data-terminal-form]", terminal || document)?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = one("[data-terminal-input]", terminal);
    output(input.value);
    input.value = "";
  });
  all("[data-reference-reveal]").forEach((button) => button.addEventListener("click", () => { one("[data-reference]", button.closest("[data-self]")).hidden = false; }));

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
    } catch (error) {
      const message = document.createElement("p");
      message.className = "gateway-feedback is-error";
      message.textContent = error.message;
      cp.appendChild(message);
    }
  });
})();
