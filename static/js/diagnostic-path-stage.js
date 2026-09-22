(() => {
  "use strict";
  const one = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];

  class DiagnosticPathStage {
    constructor(root) {
      this.root = root;
      this.mode = "ping";
      this.phase = 0;
      this.bind();
      this.reset();
    }

    bind() {
      one("[data-diag-reset]", this.root).addEventListener("click", () => this.reset());
      one("[data-ping-next]", this.root).addEventListener("click", () => this.runPing());
      one("[data-diag-run]", this.root).addEventListener("click", () => this.runTrace(Number(one("[data-ttl-control]", this.root).value)));
      one("[data-evidence-next]", this.root).addEventListener("click", () => this.showEvidence());
      all("[data-message]", this.root).forEach((button) => button.addEventListener("click", () => this.inspectMessage(button.dataset.message)));
      all("[data-hop]", this.root).forEach((button) => button.addEventListener("click", () => this.inspect(Number(button.dataset.hop))));
    }

    setMode(mode) {
      if (!["ping", "messages", "evidence", "trace"].includes(mode)) return;
      this.mode = mode;
      this.reset();
    }

    reset() {
      this.phase = 0;
      this.clear();
      one("[data-ping-controls]", this.root).hidden = this.mode !== "ping";
      one("[data-message-controls]", this.root).hidden = this.mode !== "messages";
      one("[data-evidence-controls]", this.root).hidden = this.mode !== "evidence";
      one("[data-trace-controls]", this.root).hidden = this.mode !== "trace";
      one("[data-ttl-label]", this.root).hidden = this.mode !== "trace";
      one("[data-ttl]", this.root).hidden = this.mode !== "trace";
      one("[data-ttl-control]", this.root).value = "1";
      one("[data-ping-next]", this.root).disabled = false;
      one("[data-ping-next]", this.root).textContent = "INICIAR ECHO REQUEST";
      one("[data-evidence-next]", this.root).textContent = "OBSERVAR TIMEOUT";
      one("[data-evidence-board]", this.root).hidden = true;
      one("[data-inspector-feedback]", this.root).textContent = "Selecione uma mensagem.";
      all("[data-message]", this.root).forEach((button) => button.classList.remove("is-active"));
      this.setPacket("—", "Echo Request", "Teste ainda não executado");
      const initial = {
        ping: "Inicie o Echo Request; avance uma etapa por clique.",
        messages: "Inspecione Request e Reply no painel de pacote.",
        evidence: "Observe o resultado antes de propor uma causa.",
        trace: "Selecione TTL 1, 2, 3 ou 4 e execute a sonda.",
      };
      this.result(initial[this.mode]);
    }

    clear() {
      all("[data-hop]", this.root).forEach((node) => node.classList.remove("is-active", "is-reached", "is-silent", "is-return"));
      one("[data-diag-timeline]", this.root).replaceChildren();
    }

    setPacket(ttl, type, message, reply = false, sourceOverride = null) {
      one("[data-ttl]", this.root).textContent = ttl;
      one("[data-icmp-type]", this.root).textContent = type;
      one("[data-icmp-message]", this.root).textContent = message;
      one("[data-ip-source]", this.root).textContent = sourceOverride || (reply ? "192.168.50.30" : "192.168.10.20");
      one("[data-ip-destination]", this.root).textContent = sourceOverride ? "192.168.10.20" : (reply ? "192.168.10.20" : "192.168.50.30");
    }

    add(text) {
      const item = document.createElement("li");
      item.textContent = text;
      one("[data-diag-timeline]", this.root).appendChild(item);
    }

    result(text) {
      one("[data-diag-result]", this.root).textContent = text;
      this.root.dispatchEvent(new CustomEvent("diagnostic:feedback", { bubbles: true, detail: { mode: this.mode, text } }));
    }

    markThrough(end, className = "is-reached") {
      for (let index = 0; index <= end; index += 1) one(`[data-hop='${index}']`, this.root).classList.add(className);
    }

    inspect(hop) {
      all("[data-hop]", this.root).forEach((node) => node.classList.toggle("is-active", Number(node.dataset.hop) === hop));
      const names = ["PC-A · origem", "R1 · hop 1", "R2 · hop 2", "R3 · hop 3", "PC-B · destino"];
      this.result(names[hop]);
    }

    runPing() {
      if (this.mode !== "ping") return;
      this.phase = Math.min(5, this.phase + 1);
      const button = one("[data-ping-next]", this.root);
      const messages = [
        "",
        "PC-A cria ICMP Echo Request para 192.168.50.30.",
        "O Echo Request percorre R1, R2 e R3 até PC-B.",
        "PC-B cria ICMP Echo Reply; Source e Destination IP são invertidos.",
        "O Echo Reply retorna a PC-A; neste cenário didático, seguimos a mesma topologia.",
        "PC-A recebeu Echo Reply. RTT = 23 ms: tempo de ida e volta desta troca.",
      ];
      if (this.phase === 1) {
        one("[data-hop='0']", this.root).classList.add("is-active", "is-reached");
        this.setPacket("—", "Echo Request", "Criado em PC-A");
      } else if (this.phase === 2) {
        this.markThrough(4);
        one("[data-hop='4']", this.root).classList.add("is-active");
        this.setPacket("—", "Echo Request", "Chegou a PC-B");
      } else if (this.phase === 3) {
        this.setPacket("—", "Echo Reply", "Criado em PC-B", true);
      } else if (this.phase === 4) {
        this.markThrough(4, "is-return");
        one("[data-hop='0']", this.root).classList.add("is-active");
        this.setPacket("—", "Echo Reply", "Retornando à origem", true);
      } else {
        this.setPacket("—", "Echo Reply", "Recebido por PC-A · RTT 23 ms", true);
      }
      this.add(`${this.phase}. ${messages[this.phase]}`);
      this.result(messages[this.phase]);
      button.disabled = this.phase === 5;
      button.textContent = this.phase === 5 ? "PING CONCLUÍDO" : "PRÓXIMA ETAPA";
    }

    inspectMessage(message) {
      if (this.mode !== "messages") return;
      const reply = message === "reply";
      all("[data-message]", this.root).forEach((button) => button.classList.toggle("is-active", button.dataset.message === message));
      this.setPacket("—", reply ? "Echo Reply" : "Echo Request", reply ? "Resposta ao teste" : "Solicitação do teste", reply);
      this.clear();
      if (reply) this.markThrough(4, "is-return");
      else this.markThrough(4);
      const text = reply ? "Echo Reply: 192.168.50.30 → 192.168.10.20. É a resposta no sentido inverso." : "Echo Request: 192.168.10.20 → 192.168.50.30. Inicia o teste.";
      one("[data-inspector-feedback]", this.root).textContent = text;
      this.result(text);
    }

    showEvidence() {
      if (this.mode !== "evidence") return;
      one("[data-evidence-board]", this.root).hidden = false;
      one("[data-evidence-next]", this.root).textContent = "OBSERVAÇÃO EXIBIDA";
      this.setPacket("—", "Echo Request", "Echo Reply não observado");
      this.result("Timeout: Echo Reply não foi recebido no tempo esperado. A causa ainda não foi identificada.");
    }

    runTrace(ttl) {
      if (this.mode !== "trace" || !Number.isInteger(ttl) || ttl < 1 || ttl > 4) return;
      this.clear();
      this.markThrough(ttl);
      this.setPacket(String(ttl), "Sonda", "Saída de PC-A");
      for (let hop = 1; hop <= Math.min(ttl, 3); hop += 1) this.add(`R${hop}: TTL ${ttl - hop + 1} → ${ttl - hop}`);
      if (ttl < 4) {
        one(`[data-hop='${ttl}']`, this.root).classList.add("is-active");
        const hopAddresses = { 1: "192.168.10.1", 2: "10.0.0.2", 3: "10.0.1.2" };
        this.setPacket("—", "ICMP Time Exceeded", `R${ttl} descarta a sonda e pode responder`, false, hopAddresses[ttl]);
        this.add(`R${ttl}: TTL 0 → sonda descartada → ICMP Time Exceeded pode retornar`);
        this.result(`TTL ${ttl} expira em R${ttl}. Cada roteador alcançado reduziu o TTL uma vez.`);
      } else {
        one("[data-hop='4']", this.root).classList.add("is-active");
        this.setPacket("—", "Echo Reply", "A sonda chegou a PC-B", true);
        this.add("TTL 4 → PC-B alcançado → destino responde");
        this.result("TTL 4 chega a PC-B. O destino respondeu à sonda.");
      }
    }

    showMissingHop() {
      this.setMode("trace");
      this.markThrough(4);
      one("[data-hop='2']", this.root).classList.add("is-silent");
      this.setPacket("—", "Sondas Traceroute", "Hop 2 sem resposta; R3 e PC-B responderam");
      ["1 · R1", "2 · * · sem resposta", "3 · R3", "4 · PC-B"].forEach((line) => this.add(line));
      this.result("R3 e PC-B responderam: a sonda avançou além do hop 2. Respostas ICMP podem ser filtradas ou limitadas.");
    }
  }

  function init(scope = document) {
    scope.querySelectorAll("[data-diag-stage]").forEach((root) => {
      if (root.dataset.diagReady) return;
      root.dataset.diagReady = "true";
      root.diagnosticStage = new DiagnosticPathStage(root);
    });
  }
  window.NetStudyDiagnosticPath = { DiagnosticPathStage, init };
  init();
})();
