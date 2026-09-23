(() => {
  "use strict";
  const one = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const hops = ["PC-A", "R1", "R2", "R3", "PC-B"];
  const hopIps = { 1: "192.168.10.1", 2: "10.0.0.2", 3: "10.0.1.2" };

  class DiagnosticPathStage {
    constructor(root) { this.root = root; this.initialMode = root.dataset.diagInitial === "trace" ? "trace" : "ping"; this.bind(); this.reset(); }
    bind() {
      one("[data-diag-reset]", this.root).addEventListener("click", () => this.reset());
      one("[data-ping-next]", this.root).addEventListener("click", () => this.runPing());
      one("[data-start-trace]", this.root).addEventListener("click", () => this.startTrace());
      one("[data-diag-run]", this.root).addEventListener("click", () => this.runTrace(Number(one("[data-ttl-control]", this.root).value)));
      one("[data-trace-scenario]", this.root).addEventListener("change", () => this.changeScenario());
      all("[data-message]", this.root).forEach((button) => button.addEventListener("click", () => this.inspectMessage(button.dataset.message)));
    }
    get scenario() { return one("[data-trace-scenario]", this.root).value; }
    reset() {
      this.mode = this.initialMode;
      this.phase = 0;
      this.probes = new Map();
      one("[data-trace-scenario]", this.root).value = "normal";
      one("[data-ttl-control]", this.root).value = this.root.dataset.diagTtl || "1";
      one("[data-diag-timeline]", this.root).replaceChildren();
      all("[data-message]", this.root).forEach((button) => { button.disabled = true; button.classList.remove("is-active"); });
      one("[data-inspector-detail]", this.root).textContent = "Inspecione as mensagens depois que aparecerem no percurso.";
      this.clearPath();
      this.showControls();
      this.setPacket("192.168.10.20", "192.168.50.30", "—", "—", "Nenhuma ainda");
      this.setFacts("—", "—", "—", "Sem teste, não há evidência de alcance.");
      this.result(this.mode === "trace" ? "Escolha o TTL e execute uma sonda." : "Inicie o Ping.");
      one("[data-diag-step]", this.root).textContent = this.mode === "trace" ? "Traceroute · pronto" : "Ping · pronto";
      one("[data-diag-task]", this.root).textContent = this.mode === "trace" ? "Execute sondas com TTL crescente" : "Envie o Echo Request";
      one("[data-ping-next]", this.root).textContent = "Enviar Echo Request";
    }
    showControls() {
      one("[data-ping-controls]", this.root).hidden = this.mode !== "ping" || this.phase === 7;
      one("[data-trace-intro]", this.root).hidden = this.mode !== "ping" || this.phase !== 7;
      one("[data-trace-controls]", this.root).hidden = this.mode !== "trace";
    }
    clearPath() { all("[data-hop]", this.root).forEach((node) => node.classList.remove("is-active", "is-reached", "is-return", "is-silent")); }
    mark(end, active, returning = false) {
      this.clearPath();
      for (let index = 0; index <= end; index += 1) one(`[data-hop="${index}"]`, this.root).classList.add(returning ? "is-return" : "is-reached");
      one(`[data-hop="${active}"]`, this.root).classList.add("is-active");
    }
    setPacket(source, destination, ttl, type, message) {
      const values = { "[data-ip-source]": source, "[data-ip-destination]": destination, "[data-ttl]": ttl, "[data-icmp-type]": type, "[data-icmp-message]": message };
      Object.entries(values).forEach(([selector, value]) => { one(selector, this.root).textContent = value; });
    }
    setFacts(sent, arrived, returned, unknown) {
      const values = { "[data-diag-sent]": sent, "[data-diag-arrived]": arrived, "[data-diag-returned]": returned, "[data-diag-unknown]": unknown };
      Object.entries(values).forEach(([selector, value]) => { one(selector, this.root).textContent = value; });
    }
    result(text) { one("[data-diag-result]", this.root).textContent = text; }
    runPing() {
      if (this.mode !== "ping" || this.phase >= 7) return;
      this.phase += 1;
      const phase = this.phase;
      const at = Math.min(phase - 1, 4);
      this.mark(phase >= 6 ? 4 : at, phase === 7 ? 0 : phase === 6 ? 4 : at, phase === 7);
      const reply = phase >= 6;
      this.setPacket(reply ? "192.168.50.30" : "192.168.10.20", reply ? "192.168.10.20" : "192.168.50.30", "—", reply ? "Echo Reply" : "Echo Request", phase === 7 ? "Recebido em PC-A · RTT 23 ms" : phase === 6 ? "Criado em PC-B" : `Em ${hops[at]}`);
      const messages = [
        "", "PC-A enviou Echo Request a PC-B.", "O Request chegou a R1.", "O Request chegou a R2.", "O Request chegou a R3.",
        "O Request chegou a PC-B.", "PC-B enviou Echo Reply de volta para PC-A.", "PC-A recebeu Echo Reply. RTT · 23 ms mede esta ida e volta.",
      ];
      this.setFacts(phase >= 6 ? "Echo Reply de PC-B" : "Echo Request de PC-A", phase === 7 ? "PC-A" : hops[phase === 6 ? 4 : at], phase === 7 ? "Echo Reply · 23 ms" : "Ainda não observado", phase === 7 ? "A troca não comprova DNS nem aplicação." : "Ainda não há Reply; não se pode concluir sucesso ou causa de falha.");
      one('[data-message="request"]', this.root).disabled = false;
      one('[data-message="reply"]', this.root).disabled = phase < 6;
      one("[data-diag-step]", this.root).textContent = `Ping · etapa ${phase} de 7`;
      one("[data-diag-task]", this.root).textContent = phase === 7 ? "Agora investigue os saltos" : "Avance a troca ICMP";
      one("[data-ping-next]", this.root).textContent = "Próxima etapa";
      this.showControls();
      this.result(messages[phase]);
    }
    inspectMessage(message) {
      const button = one(`[data-message="${message}"]`, this.root);
      if (button.disabled) return;
      const reply = message === "reply";
      all("[data-message]", this.root).forEach((item) => item.classList.toggle("is-active", item === button));
      this.setPacket(reply ? "192.168.50.30" : "192.168.10.20", reply ? "192.168.10.20" : "192.168.50.30", "—", reply ? "Echo Reply" : "Echo Request", reply ? "Resposta de PC-B" : "Solicitação de PC-A");
      const text = reply ? "Echo Reply: PC-B → PC-A. Os endereços IP foram invertidos na resposta." : "Echo Request: PC-A → PC-B. É a solicitação enviada ao destino.";
      one("[data-inspector-detail]", this.root).textContent = text;
      this.result(text);
    }
    startTrace() {
      if (this.mode !== "ping" || this.phase !== 7) return;
      this.mode = "trace";
      this.clearPath();
      this.showControls();
      one("[data-diag-step]", this.root).textContent = "Traceroute · pronto";
      one("[data-diag-task]", this.root).textContent = "Execute sondas com TTL crescente";
      this.setFacts("—", "—", "—", "Cada TTL usa uma sonda nova; ainda não há resultado.");
      this.result("Selecione TTL 1, 2, 3 ou 4 e execute uma sonda.");
    }
    changeScenario() {
      this.probes.clear();
      one("[data-diag-timeline]", this.root).replaceChildren();
      this.clearPath();
      this.setPacket("192.168.10.20", "192.168.50.30", "—", "—", "Nenhuma sonda neste cenário");
      this.setFacts("—", "—", "—", "Execute uma nova sonda para observar este cenário.");
      this.result(this.scenario === "silent" ? "Cenário com R2 silencioso: execute sondas e compare os hops posteriores." : "Cenário normal: execute sondas com TTL crescente.");
      this.root.dispatchEvent(new CustomEvent("diagnostic:scenario", { bubbles: true, detail: { scenario: this.scenario } }));
    }
    runTrace(ttl) {
      if (this.mode !== "trace" || !Number.isInteger(ttl) || ttl < 1 || ttl > 4) return;
      const silent = this.scenario === "silent" && ttl === 2;
      const endpoint = ttl === 4 ? "PC-B" : `R${ttl}`;
      this.mark(ttl, ttl);
      if (silent) one('[data-hop="2"]', this.root).classList.add("is-silent");
      const sent = `Sonda ICMP Echo Request · TTL ${ttl} · PC-A → PC-B`;
      let returned, unknown, message;
      if (silent) {
        returned = "* · nenhuma resposta observada";
        unknown = "Não sabemos por que R2 ficou silencioso; sondas com TTL maior podem seguir.";
        message = "TTL 2 se esgota em R2 e a sonda é descartada. Nenhuma resposta de R2 foi observada.";
        this.setPacket("192.168.10.20", "192.168.50.30", String(ttl), "Echo Request", "Descartada em R2 · resposta não observada");
      } else if (ttl < 4) {
        returned = `ICMP Time Exceeded de ${endpoint} (${hopIps[ttl]})`;
        unknown = "Essa resposta não mede o funcionamento de PC-B ou da aplicação.";
        message = `TTL ${ttl} chega a ${endpoint}, cai a zero e a sonda é descartada. ${endpoint} responde com ICMP Time Exceeded; essa sonda não segue adiante.`;
        this.setPacket(hopIps[ttl], "192.168.10.20", "—", "ICMP Time Exceeded", `Resposta de ${endpoint} à sonda descartada`);
      } else {
        returned = "ICMP Echo Reply de PC-B";
        unknown = "A resposta não comprova DNS nem o funcionamento da aplicação.";
        message = "A sonda com TTL 4 chega a PC-B. Como este tracert usa ICMP, PC-B responde com Echo Reply.";
        this.setPacket("192.168.50.30", "192.168.10.20", "—", "Echo Reply", "Resposta do destino à sonda TTL 4");
      }
      this.setFacts(sent, endpoint, returned, unknown);
      this.probes.set(ttl, `${ttl} · ${endpoint}${silent ? " · * sem resposta" : ttl === 4 ? " · Echo Reply" : " · ICMP Time Exceeded"}`);
      const timeline = one("[data-diag-timeline]", this.root);
      timeline.replaceChildren();
      [...this.probes.entries()].sort((a, b) => a[0] - b[0]).forEach(([, line]) => { const item = document.createElement("li"); item.textContent = line; timeline.appendChild(item); });
      one("[data-diag-step]", this.root).textContent = `Traceroute · TTL ${ttl}`;
      this.result(message);
    }
  }
  function init(scope = document) { scope.querySelectorAll("[data-diag-stage]").forEach((root) => { if (root.dataset.diagReady) return; root.dataset.diagReady = "true"; root.diagnosticStage = new DiagnosticPathStage(root); }); }
  window.NetStudyDiagnosticPath = { DiagnosticPathStage, init };
  init();
})();
