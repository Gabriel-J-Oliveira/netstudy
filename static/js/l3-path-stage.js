(() => {
  "use strict";
  const stages = {};
  class L3PathStage {
    constructor(root) {
      this.root = root;
      this.id = root.dataset.stageId;
      this.phase = 0;
      this.maxPhase = 5;
      this.config = {
        hostIp: root.dataset.hostIp,
        gatewayIp: root.dataset.gatewayIp,
        gatewayMac: root.dataset.gatewayMac,
        destinationIp: root.dataset.destinationIp,
      };
      this.bind();
      this.render();
    }
    bind() {
      this.root.querySelector("[data-l3-reset]").addEventListener("click", () => this.reset());
      this.root.querySelector("[data-l3-next]").addEventListener("click", () => this.advance());
      this.root.querySelectorAll("[data-l3-node]").forEach((node) => node.addEventListener("click", () => this.inspect(node.dataset.l3Node)));
    }
    inspect(kind) {
      this.root.querySelectorAll("[data-l3-node]").forEach((node) => node.classList.toggle("is-inspected", node.dataset.l3Node === kind));
      const messages = {
        host: "PC-A inicia a comunicação e classifica o destino como remoto.",
        switch: "SW1 encaminha o frame usando o Destination MAC. Ele não escolhe o gateway.",
        gateway: "Correto. R1 é o próximo dispositivo de Camada 3 localmente alcançável.",
        destination: "PC-B é o destino final, mas não recebe diretamente o primeiro frame nesta LAN.",
      };
      this.message(messages[kind]);
      this.root.dispatchEvent(new CustomEvent("l3stage:inspect", {bubbles: true, detail: {kind}}));
    }
    message(value) { this.root.querySelector("[data-l3-message]").textContent = value; }
    advance() { this.setPhase(this.phase + 1); }
    setPhase(value) {
      this.phase = Math.max(0, Math.min(this.maxPhase, Number(value)));
      this.render();
      this.root.dispatchEvent(new CustomEvent("l3stage:phase", {bubbles: true, detail: {phase: this.phase}}));
    }
    render() {
      const transit = this.root.querySelector("[data-l3-transit]");
      this.root.dataset.phase = String(this.phase);
      transit.dataset.phase = String(this.phase);
      const messages = [
        "Destino remoto identificado. Escolha o próximo salto local.",
        `Next Hop: ${this.config.gatewayIp} — Default Gateway.`,
        `ARP: Who has ${this.config.gatewayIp}? R1 responde: ${this.config.gatewayMac}.`,
        `Primeiro frame: Destination MAC ${this.config.gatewayMac}; pacote: Destination IP ${this.config.destinationIp}.`,
        `SW1 lê Destination MAC ${this.config.gatewayMac} e entrega o primeiro frame a R1.`,
        "R1 recebeu o frame. O pacote continua; informações de roteamento definirão o próximo encaminhamento.",
      ];
      this.root.querySelector("[data-l3-cache]").textContent = this.phase >= 2 ? `${this.config.gatewayIp} → ${this.config.gatewayMac}` : `${this.config.gatewayIp} → desconhecido`;
      this.root.classList.toggle("is-at-switch", this.phase === 4);
      this.root.classList.toggle("is-at-router", this.phase === 5);
      const currentNode = ["host", "gateway", "gateway", "host", "switch", "gateway"][this.phase];
      this.root.querySelectorAll("[data-l3-node]").forEach((node) => node.classList.toggle("is-path-current", node.dataset.l3Node === currentNode));
      this.message(messages[this.phase]);
      const next = this.root.querySelector("[data-l3-next]");
      next.textContent = this.phase < this.maxPhase ? "Avançar um passo" : "Primeiro salto concluído";
      next.disabled = this.phase === this.maxPhase;
      next.setAttribute("aria-label", this.phase < this.maxPhase ? `Avançar para o passo ${this.phase + 1} de ${this.maxPhase}` : "Primeiro salto concluído");
    }
    reset() { this.phase = 0; this.root.querySelectorAll("[data-l3-node]").forEach((node) => node.classList.remove("is-inspected")); this.render(); this.root.dispatchEvent(new CustomEvent("l3stage:reset", {bubbles: true, detail: {phase: 0}})); }
    highlight(kind) { this.inspect(kind); }
  }
  function init(scope = document) {
    scope.querySelectorAll("[data-l3-stage]").forEach((root) => { if (root.dataset.l3Ready) return; root.dataset.l3Ready = "true"; const stage = new L3PathStage(root); stages[stage.id] = stage; root.l3PathStage = stage; });
    return stages;
  }
  window.NetStudyL3Path = {L3PathStage, stages, init}; init();
})();
