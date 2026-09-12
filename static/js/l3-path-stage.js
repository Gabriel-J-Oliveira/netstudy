(() => {
  "use strict";
  const stages = {};
  class L3PathStage {
    constructor(root) {
      this.root = root;
      this.id = root.dataset.stageId;
      this.phase = 0;
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
      this.root.querySelector("[data-l3-next]").addEventListener("click", () => { this.phase = Math.min(4, this.phase + 1); this.render(); });
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
    render() {
      const transit = this.root.querySelector("[data-l3-transit]");
      transit.dataset.phase = String(this.phase);
      const messages = [
        "Destino remoto identificado. Escolha o próximo salto local.",
        `Next Hop: ${this.config.gatewayIp} — Default Gateway.`,
        `ARP: Who has ${this.config.gatewayIp}? R1 responde: ${this.config.gatewayMac}.`,
        `Primeiro frame: Destination MAC ${this.config.gatewayMac}; pacote: Destination IP ${this.config.destinationIp}.`,
        "R1 recebeu o frame. O frame termina neste enlace; o pacote continua.",
      ];
      this.root.querySelector("[data-l3-cache]").textContent = this.phase >= 2 ? `${this.config.gatewayIp} → ${this.config.gatewayMac}` : `${this.config.gatewayIp} → desconhecido`;
      this.root.classList.toggle("is-at-router", this.phase === 4);
      this.message(messages[this.phase]);
      this.root.querySelector("[data-l3-next]").textContent = this.phase < 4 ? "Avançar um passo" : "Primeiro salto concluído";
      this.root.querySelector("[data-l3-next]").disabled = this.phase === 4;
    }
    reset() { this.phase = 0; this.root.querySelectorAll("[data-l3-node]").forEach((node) => node.classList.remove("is-inspected")); this.render(); }
    highlight(kind) { this.inspect(kind); }
  }
  function init(scope = document) {
    scope.querySelectorAll("[data-l3-stage]").forEach((root) => { if (root.dataset.l3Ready) return; root.dataset.l3Ready = "true"; const stage = new L3PathStage(root); stages[stage.id] = stage; root.l3PathStage = stage; });
    return stages;
  }
  window.NetStudyL3Path = {L3PathStage, stages, init}; init();
})();
