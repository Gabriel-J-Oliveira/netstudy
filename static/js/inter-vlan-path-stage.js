(() => {
  "use strict";
  const one = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const steps = [["enable", "Habilite a função L3"], ["arp10", "Decida a primeira entrega"], ["frame1", "Monte o Frame 1"], ["receive", "R1 recebe o Frame 1"], ["route", "Selecione a rota"], ["arp20", "Resolva o destino na VLAN 20"], ["frame2", "Monte o Frame 2"], ["deliver", "Entregue a PC-B"], ["done", "Entrega concluída"]];
  class InterVlanStage {
    constructor(root) { this.root = root; this.bind(); this.reset(); }
    bind() {
      one("[data-iv-reset]", this.root).addEventListener("click", () => this.reset());
      one("[data-select-l3]", this.root).addEventListener("click", () => this.advance(1, "Função L3 habilitada. PC-A compara o destino com 192.168.10.0/24: PC-B é remoto."));
      const submit = (selector, action) => one(selector, this.root).addEventListener("submit", (event) => { event.preventDefault(); action.call(this); });
      submit('[data-iv-control="arp10"]', this.checkArp10);
      submit('[data-iv-control="frame1"]', this.checkFrame1);
      submit('[data-iv-control="arp20"]', this.checkArp20);
      submit('[data-iv-control="frame2"]', this.checkFrame2);
      one("[data-iv-next]", this.root).addEventListener("click", () => this.advance(4, "R1 encerrou o Frame 1. Agora consulta o Destination IP 192.168.20.30 na tabela de rotas."));
      all("[data-route-prefix]", this.root).forEach((button) => button.addEventListener("click", () => this.checkRoute(button)));
      one("[data-iv-deliver]", this.root).addEventListener("click", () => this.advance(8, "PC-B recebeu o pacote dentro do Frame 2. Os endereços IP de origem e destino permaneceram neste cenário, sem NAT."));
      all("[data-inspect]", this.root).forEach((button) => button.addEventListener("click", () => this.inspect(button)));
    }
    reset() {
      this.phase = 0;
      one("[data-arp-target]", this.root).value = "";
      one("[data-arp20-target]", this.root).value = "";
      all("[data-build]", this.root).forEach((field) => { field.value = ""; });
      all("[data-route-prefix], [data-inspect]", this.root).forEach((button) => button.classList.remove("is-active", "is-error"));
      one("[data-inspector-detail]", this.root).textContent = "Selecione o pacote IP; os frames ficam disponíveis quando forem criados.";
      this.render("Sem encaminhamento L3, PC-A não alcança PC-B em outra VLAN.");
    }
    advance(phase, message) { this.phase = phase; this.render(message); }
    feedback(message, error = false) { const output = one("[data-iv-message]", this.root); output.textContent = message; output.classList.toggle("is-error", error); }
    render(message) {
      const root = this.root;
      all("[data-iv-control]", root).forEach((panel) => { panel.hidden = panel.dataset.ivControl !== steps[this.phase][0]; });
      one("[data-iv-phase]", root).textContent = this.phase === 8 ? "Concluído" : `Etapa ${this.phase + 1} de 8`;
      one("[data-iv-task]", root).textContent = steps[this.phase][1];
      one("[data-l3-status]", root).textContent = this.phase ? "Habilitada" : "Desabilitada";
      one("[data-cache-r10]", root).textContent = this.phase >= 2 ? "R10" : "desconhecido";
      one("[data-cache-bb]", root).textContent = this.phase >= 6 ? "BB" : "desconhecido";
      one('[data-inspect="f1"]', root).disabled = this.phase < 3;
      one('[data-inspect="f2"]', root).disabled = this.phase < 7;
      const first = this.phase === 3, second = this.phase >= 7;
      one("[data-frame-source]", root).textContent = first ? "AA" : second ? "R20" : "—";
      one("[data-frame-destination]", root).textContent = first ? "R10" : second ? "BB" : "—";
      one("[data-frame-location]", root).textContent = first ? "VLAN 10 · a caminho de R1" : this.phase === 8 ? "VLAN 20 · entregue a PC-B" : second ? "VLAN 20 · a caminho de PC-B" : "Nenhum frame em trânsito";
      all("[data-iv-node]", root).forEach((node) => node.classList.toggle("is-active", node.dataset.ivNode === (this.phase === 8 ? "b" : this.phase >= 4 ? "l3" : "a")));
      root.classList.toggle("in-vlan20", this.phase >= 6);
      this.feedback(message);
    }
    checkArp10() {
      const value = one("[data-arp-target]", this.root).value.trim();
      if (value === "192.168.10.1") this.advance(2, "ARP na VLAN 10: 192.168.10.1 → R10. O IP de destino do pacote continua 192.168.20.30.");
      else this.feedback(value === "192.168.20.30" ? "PC-B é o destino IP final, mas está fora da VLAN 10. Resolva por ARP o gateway local 192.168.10.1." : "PC-A precisa do MAC de seu gateway na VLAN 10: resolva 192.168.10.1.", true);
    }
    checkFrame1() {
      const value = one('[data-build="f1"]', this.root).value;
      if (value === "AA → R10") this.advance(3, "Frame 1 criado: AA → R10 na VLAN 10. O pacote segue destinado a 192.168.20.30.");
      else this.feedback(value === "AA → BB" ? "AA → BB atravessaria dois domínios L2. PC-A deve entregar o primeiro frame a R10." : value === "R10 → BB" ? "R10 não é a origem do primeiro frame. PC-A usa seu MAC AA e o MAC R10 do gateway." : "Selecione os MACs do primeiro frame na VLAN 10.", true);
    }
    checkRoute(button) {
      all("[data-route-prefix]", this.root).forEach((item) => item.classList.remove("is-active", "is-error"));
      if (button.dataset.routePrefix === "192.168.20.0/24") { button.classList.add("is-active"); this.advance(5, "Rota 192.168.20.0/24 selecionada: entrega direta pela interface da VLAN 20."); }
      else { button.classList.add("is-error"); this.feedback("192.168.10.0/24 é a rede de origem. O Destination IP 192.168.20.30 combina com 192.168.20.0/24.", true); }
    }
    checkArp20() {
      const value = one("[data-arp20-target]", this.root).value.trim();
      if (value === "192.168.20.30") this.advance(6, "ARP na VLAN 20: 192.168.20.30 → BB. R1 pode criar uma nova entrega Ethernet.");
      else this.feedback("Na VLAN 20, R1 resolve o IP do host diretamente conectado: 192.168.20.30.", true);
    }
    checkFrame2() {
      const value = one('[data-build="f2"]', this.root).value;
      if (value === "R20 → BB") this.advance(7, "Frame 2 criado: R20 → BB na VLAN 20. R1 usa sua interface dessa VLAN.");
      else this.feedback(value === "R10 → BB" ? "R10 pertence à interface da VLAN 10. O novo frame sai pela interface R20 na VLAN 20." : value === "AA → BB" ? "AA é o MAC de PC-A na VLAN 10. R1 cria um novo frame R20 → BB na VLAN 20." : "Selecione os MACs do novo frame na VLAN 20.", true);
    }
    inspect(button) {
      if (button.disabled) return;
      const details = { f1: "Frame 1 · VLAN 10 · Source MAC AA · Destination MAC R10. Termina em R1.", ip: "Pacote IP · 192.168.10.20 → 192.168.20.30. Esses endereços permanecem neste cenário, sem NAT; R1 reduz o TTL.", f2: "Frame 2 · VLAN 20 · Source MAC R20 · Destination MAC BB. Novo frame para PC-B." };
      all("[data-inspect]", this.root).forEach((item) => item.classList.toggle("is-active", item === button));
      one("[data-inspector-detail]", this.root).textContent = details[button.dataset.inspect];
      this.feedback(details[button.dataset.inspect]);
    }
  }
  function init(scope = document) { scope.querySelectorAll("[data-iv-stage]").forEach((root) => { if (root.dataset.ivReady) return; root.dataset.ivReady = "true"; root.interVlanStage = new InterVlanStage(root); }); }
  window.NetStudyInterVlan = { InterVlanStage, init };
  init();
})();
