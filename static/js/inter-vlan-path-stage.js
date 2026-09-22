(() => {
  "use strict";

  const one = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];

  class InterVlanStage {
    constructor(root) {
      this.root = root;
      this.mode = "isolation";
      this.phase = 0;
      this.routerPhase = 0;
      this.bind();
      this.reset();
    }

    bind() {
      one("[data-iv-reset]", this.root).addEventListener("click", () => this.reset());
      one("[data-select-l3]", this.root).addEventListener("click", () => this.selectLayer3());
      one("[data-check-arp]", this.root).addEventListener("click", () => this.checkArp());
      one("[data-arp-target]", this.root).addEventListener("keydown", (event) => {
        if (event.key === "Enter") this.checkArp();
      });
      one("[data-router-next]", this.root).addEventListener("click", () => this.advanceRouter());
      all("[data-route-prefix]", this.root).forEach((button) => {
        button.addEventListener("click", () => this.inspectRoute(button));
      });
      all("[data-inspect]", this.root).forEach((button) => {
        button.addEventListener("click", () => this.inspectPacket(button));
      });
      one("[data-build-check]", this.root).addEventListener("click", () => this.checkFrames());
      one("[data-iv-next]", this.root).addEventListener("click", () => this.advanceJourney());
      all("[data-iv-node]", this.root).forEach((node) => {
        node.addEventListener("click", () => this.describeNode(node));
      });
    }

    setMode(mode) {
      if (!one(`[data-iv-control="${mode}"]`, this.root)) return;
      this.mode = mode;
      this.reset();
    }

    reset() {
      this.phase = 0;
      this.routerPhase = 0;
      all("[data-iv-control]", this.root).forEach((panel) => {
        panel.hidden = panel.dataset.ivControl !== this.mode;
      });
      all("[data-iv-node], [data-route-prefix], [data-inspect]", this.root).forEach((item) => {
        item.classList.remove("is-active", "is-correct", "is-error");
        item.removeAttribute("aria-current");
      });
      all("[data-route-prefix]", this.root).forEach((button) => { button.disabled = true; });
      all("select", this.root).forEach((field) => { field.value = ""; });
      const arp = one("[data-arp-target]", this.root);
      if (arp) arp.value = "";
      this.setFrame(false, "AA", "?");
      this.setExtra("");
      this.clearFeedback();

      const initial = {
        isolation: ["ÁREA 01", "VLAN 10 e VLAN 20 são domínios Ethernet separados."],
        host: ["ÁREA 02", "PC-A compara 192.168.20.30 com sua rede 192.168.10.0/24."],
        router: ["ÁREA 03 · PASSO 0 / 4", "Comece construindo o primeiro frame."],
        frames: ["ÁREA 04", "Inspecione Frame 1, pacote IP e Frame 2; depois construa os frames."],
        journey: ["PASSO 0 / 9", "PC-A quer alcançar PC-B em outra VLAN."],
      }[this.mode];
      this.setState(initial[0], initial[1]);
      const next = one("[data-iv-next]", this.root);
      next.disabled = false;
      next.textContent = "INICIAR PERCURSO";
      one("[data-router-next]", this.root).textContent = "INICIAR PRIMEIRO FRAME";
      this.root.classList.remove("in-vlan20");
    }

    clearFeedback() {
      all("[aria-live]", this.root).forEach((node) => {
        if (node.matches("[data-iv-message]")) return;
        node.textContent = "";
        node.classList.remove("feedback-ok", "feedback-error");
      });
    }

    setState(label, message) {
      one("[data-iv-phase]", this.root).textContent = label;
      one("[data-iv-message]", this.root).textContent = message;
    }

    setExtra(text) {
      one("[data-iv-extra]", this.root).textContent = text;
    }

    setFrame(visible, source, destination) {
      const frame = one("[data-iv-frame]", this.root);
      frame.hidden = !visible;
      one("[data-frame-source]", this.root).textContent = source;
      one("[data-frame-destination]", this.root).textContent = destination;
    }

    activateNode(name) {
      all("[data-iv-node]", this.root).forEach((node) => {
        const active = node.dataset.ivNode === name;
        node.classList.toggle("is-active", active);
        if (active) node.setAttribute("aria-current", "step");
        else node.removeAttribute("aria-current");
      });
    }

    feedback(node, text, ok = null) {
      if (node) {
        node.textContent = text;
        node.classList.toggle("feedback-ok", ok === true);
        node.classList.toggle("feedback-error", ok === false);
      }
      this.root.dispatchEvent(new CustomEvent("ivstage:feedback", {
        bubbles: true,
        detail: { mode: this.mode, text, ok },
      }));
    }

    selectLayer3() {
      this.activateNode("l3");
      this.setExtra("CAMADA 3 · ENCAMINHA ENTRE AS REDES DAS VLANs");
      const text = "Correto. O roteador ou switch L3 atua entre as VLANs; switching L2 puro não atravessa essa separação.";
      this.setState("ÁREA 01 · FUNÇÃO L3", text);
      this.feedback(null, text, true);
    }

    checkArp() {
      const input = one("[data-arp-target]", this.root);
      const value = input.value.trim();
      const output = one("[data-arp-feedback]", this.root);
      if (value === "192.168.10.1") {
        this.activateNode("l3");
        this.setExtra("ARP · 192.168.10.1 IS AT R10");
        const text = "Correto. O próximo salto Ethernet é o gateway R10; o Destination IP continua 192.168.20.30, PC-B.";
        this.setState("ÁREA 02 · ARP CONCLUÍDO", text);
        this.feedback(output, text, true);
        return;
      }
      let text = "PC-B está fora da rede local de PC-A. Use o IPv4 do gateway da VLAN 10.";
      if (value === "192.168.20.30") text = "Esse é o Destination IP final. PC-A precisa resolver o próximo salto local, não PC-B.";
      if (value === "192.168.10.20") text = "Esse é o IPv4 do próprio PC-A. O ARP precisa localizar quem receberá o primeiro frame.";
      this.feedback(output, text, false);
    }

    advanceRouter() {
      this.routerPhase = Math.min(3, this.routerPhase + 1);
      const button = one("[data-router-next]", this.root);
      if (this.routerPhase === 1) {
        this.activateNode("a");
        this.setFrame(true, "AA", "R10");
        this.setState("ÁREA 03 · PASSO 1 / 4", "PC-A cria o Frame 1: AA → R10. Dentro dele, o pacote ainda aponta para PC-B.");
        button.textContent = "ENTREGAR AO ROTEADOR";
      } else if (this.routerPhase === 2) {
        this.activateNode("l3");
        this.setFrame(false, "AA", "R10");
        this.setState("ÁREA 03 · PASSO 2 / 4", "O roteador recebe o frame. A entrega Ethernet da VLAN 10 termina; o pacote IP continua.");
        button.textContent = "CONSULTAR TABELA DE ROTAS";
      } else {
        this.setExtra("ROUTE LOOKUP · DESTINATION 192.168.20.30");
        this.setState("ÁREA 03 · PASSO 3 / 4", "Selecione na tabela a rota que corresponde ao Destination IP 192.168.20.30.");
        all("[data-route-prefix]", this.root).forEach((route) => { route.disabled = false; });
        button.disabled = true;
        button.textContent = "SELECIONE A ROTA";
      }
    }

    inspectRoute(button) {
      const output = one("[data-route-feedback]", this.root);
      all("[data-route-prefix]", this.root).forEach((route) => route.classList.remove("is-correct", "is-error"));
      if (button.dataset.routePrefix === "192.168.20.0/24") {
        button.classList.add("is-correct");
        this.setExtra("ROUTE LOOKUP · 192.168.20.0/24 → DIRECT VLAN 20");
        const text = "Correto. 192.168.20.30 pertence a 192.168.20.0/24; a saída é diretamente conectada à VLAN 20.";
        this.setState("ÁREA 03 · PASSO 4 / 4", text);
        this.feedback(output, text, true);
      } else {
        button.classList.add("is-error");
        this.feedback(output, "Essa linha representa a rede de origem. Compare o Destination IP com o prefixo da VLAN 20.", false);
      }
    }

    inspectPacket(button) {
      all("[data-inspect]", this.root).forEach((item) => item.classList.toggle("is-active", item === button));
      const messages = {
        f1: "Frame 1 · VLAN 10: AA → R10. Pacote: 192.168.10.20 → 192.168.20.30.",
        ip: "No roteador, o Frame 1 terminou. O pacote mantém Source e Destination IP.",
        f2: "Frame 2 · VLAN 20: R20 → BB. O mesmo pacote IP segue dentro.",
      };
      if (button.dataset.inspect === "f1") this.setFrame(true, "AA", "R10");
      if (button.dataset.inspect === "ip") this.setFrame(false, "AA", "R10");
      if (button.dataset.inspect === "f2") {
        this.setFrame(true, "R20", "BB");
        this.setExtra("ARP VLAN 20 · 192.168.20.30 → BB");
        this.root.classList.add("in-vlan20");
      }
      this.feedback(one("[data-iv-inspector] p", this.root), messages[button.dataset.inspect]);
    }

    checkFrames() {
      const first = one("[data-build='f1']", this.root).value;
      const second = one("[data-build='f2']", this.root).value;
      const output = one("[data-frame-builder] p", this.root);
      if (first === "AA → R10" && second === "R20 → BB") {
        this.setFrame(true, "R20", "BB");
        this.root.classList.add("in-vlan20");
        this.feedback(output, "Correto. AA → R10 termina na VLAN 10; R20 → BB é criado para a VLAN 20. Os IPs permanecem iguais.", true);
      } else if (first === "AA → BB") {
        this.feedback(output, "No primeiro segmento, PC-B é remoto. PC-A entrega o frame ao gateway R10, não diretamente a BB.", false);
      } else if (second === "R10 → BB") {
        this.feedback(output, "Na VLAN 20, o novo frame parte da presença L3 R20, não da interface R10 da VLAN 10.", false);
      } else {
        this.feedback(output, "Complete os dois frames: observe quem envia e quem recebe em cada domínio Ethernet.", false);
      }
    }

    advanceJourney() {
      this.phase = Math.min(9, this.phase + 1);
      this.renderJourney();
    }

    renderJourney() {
      const messages = [
        "PC-A quer alcançar PC-B em outra VLAN.",
        "PC-A compara IP e máscara: 192.168.20.30 é remoto.",
        "PC-A escolhe o gateway 192.168.10.1 da VLAN 10.",
        "ARP na VLAN 10 resolve 192.168.10.1 → R10.",
        "Frame 1: AA → R10; o pacote continua para 192.168.20.30.",
        "A função L3 recebe o frame. O frame da VLAN 10 termina.",
        "Route lookup: 192.168.20.0/24 → Direct VLAN 20.",
        "ARP na VLAN 20 resolve 192.168.20.30 → BB.",
        "Frame 2: R20 → BB; o pacote IP permanece igual.",
        "PC-B recebe o mesmo pacote IP em um novo frame Ethernet.",
      ];
      const extras = {
        3: "ARP CACHE VLAN 10 · 192.168.10.1 → R10",
        6: "ROUTING TABLE · 192.168.20.0/24 → DIRECT VLAN 20",
        7: "ARP CACHE VLAN 20 · 192.168.20.30 → BB",
      };
      this.setState(`PASSO ${this.phase} / 9`, messages[this.phase]);
      this.setExtra(extras[this.phase] || "");
      this.setFrame(this.phase === 4 || this.phase === 8 || this.phase === 9, this.phase >= 8 ? "R20" : "AA", this.phase >= 8 ? "BB" : "R10");
      this.activateNode(this.phase === 9 ? "b" : this.phase >= 5 ? "l3" : "a");
      this.root.classList.toggle("in-vlan20", this.phase >= 7);
      const next = one("[data-iv-next]", this.root);
      next.disabled = this.phase === 9;
      next.textContent = this.phase === 9 ? "PERCURSO CONCLUÍDO" : "CONTINUAR PERCURSO";
      this.feedback(null, messages[this.phase], this.phase === 9 ? true : null);
    }

    describeNode(node) {
      const messages = {
        a: "PC-A origina o pacote e o primeiro frame na VLAN 10.",
        l3: "A função L3 possui presença nas duas redes e cria uma nova entrega Ethernet.",
        b: "PC-B recebe o pacote dentro do Frame 2 na VLAN 20.",
      };
      this.activateNode(node.dataset.ivNode);
      this.setState(one("[data-iv-phase]", this.root).textContent, messages[node.dataset.ivNode]);
    }
  }

  function init(scope = document) {
    scope.querySelectorAll("[data-iv-stage]").forEach((root) => {
      if (root.dataset.ivReady) return;
      root.dataset.ivReady = "true";
      root.interVlanStage = new InterVlanStage(root);
    });
  }

  window.NetStudyInterVlan = { InterVlanStage, init };
  init();
})();
