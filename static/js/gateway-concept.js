(() => {
  "use strict";
  const one = (selector, scope = document) => scope?.querySelector(selector);
  const all = (selector, scope = document) => [...(scope?.querySelectorAll(selector) || [])];
  const lab = one("#gateway-shared-lab");
  const stage = one('[data-stage-id="gateway-shared"]', lab);
  const state = {mode: "remote", gateway: null, arp: false, delivered: false};
  const values = {
    remote: {ip: "192.168.20.50", arpIp: "192.168.10.1", mac: "RR", receiver: "R1"},
    local: {ip: "192.168.10.80", arpIp: "192.168.10.80", mac: "LL", receiver: "PC-L"},
  };
  const current = () => values[state.mode];

  function feedback(message, ok = null) {
    const node = one("[data-gateway-feedback]", lab);
    node.textContent = message;
    node.classList.toggle("is-success", ok === true);
    node.classList.toggle("is-error", ok === false);
  }

  function render() {
    const local = state.mode === "local";
    const target = current();
    one("[data-remote-gateway]", lab).hidden = local;
    all("[data-destination-mode]", lab).forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.destinationMode === state.mode)));
    all("[data-gateway]", lab).forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.gateway === state.gateway)));
    all("[data-remote-tail]", stage).forEach((item) => { item.hidden = local; });
    one("[data-receiver-name]", stage).textContent = target.receiver;
    one("[data-receiver-role]", stage).textContent = local ? "host na mesma LAN" : "Default Gateway";
    one("[data-receiver-address]", stage).textContent = `${target.arpIp} · MAC ${target.mac}`;
    one("[data-network-result]", stage).textContent = local
      ? "192.168.10.80 pertence a 192.168.10.0/24: destino local; gateway dispensado na primeira entrega."
      : "192.168.20.50 está fora de 192.168.10.0/24: destino remoto; o próximo salto é R1.";
    one("[data-l3-cache]", stage).textContent = state.arp ? `${target.arpIp} → ${target.mac}` : "vazio · próximo MAC desconhecido";
    one("[data-frame-ip]", stage).textContent = target.ip;
    one("[data-frame-mac]", stage).textContent = state.arp ? target.mac : "aguardando ARP";
    one("[data-frame-position]", stage).textContent = state.delivered
      ? local ? "Primeiro frame entregue a PC-L nesta LAN." : "Primeiro frame entregue a R1. O percurso desta aula termina aqui."
      : "Frame ainda não enviado.";
    one("[data-l3-transit]", stage).dataset.delivery = state.delivered ? "delivered" : "pending";
    all("[data-path-node]", stage).forEach((node) => node.classList.toggle("is-path-current", state.delivered && node.dataset.pathNode === "receiver"));
    one("[data-inspector-ethernet]").textContent = `Source MAC AA · Destination MAC ${state.arp ? target.mac : "aguardando ARP"}`;
    one("[data-inspector-ipv4]").textContent = `Source IP 192.168.10.25 · Destination IP ${target.ip}`;
    one("[data-inspector-status]").textContent = state.delivered
      ? local ? "SW1 encaminhou pelo MAC LL ao host local." : "SW1 encaminhou pelo MAC RR a R1. R1 decidirá o próximo encaminhamento."
      : "O switch usará o MAC para encaminhar a primeira entrega. O IP final permanece no pacote.";
    one("[data-decision-summary]", lab).hidden = !state.delivered;
    if (state.delivered) one("[data-decision-text]", lab).textContent = local
      ? "Destino local em 192.168.10.0/24 → ARP 192.168.10.80 → LL → frame entregue a PC-L, sem gateway."
      : "Destino remoto fora de 192.168.10.0/24 → gateway 192.168.10.1 → ARP 192.168.10.1 → RR → primeiro frame entregue a R1; Destination IP 192.168.20.50.";
  }

  function reset(mode = state.mode) {
    state.mode = mode;
    state.gateway = null;
    state.arp = false;
    state.delivered = false;
    one("[data-arp-target] input", lab).value = "";
    all("[data-destination-builder] select", lab).forEach((field) => { field.value = ""; field.classList.remove("is-correct", "is-wrong"); });
    render();
    feedback(mode === "local"
      ? "Destino local: o gateway não é necessário. Resolva por ARP o IPv4 do próprio host local."
      : "Destino remoto: escolha o gateway na LAN 192.168.10.0/24.");
  }

  all("[data-destination-mode]", lab).forEach((button) => button.addEventListener("click", () => reset(button.dataset.destinationMode)));
  one("[data-lab-reset]", lab)?.addEventListener("click", () => reset());
  all("[data-gateway]", lab).forEach((button) => button.addEventListener("click", () => {
    state.gateway = button.dataset.gateway;
    state.arp = false;
    state.delivered = false;
    render();
    if (state.gateway === "192.168.10.1") feedback("192.168.10.1 está na LAN de PC-A e pode receber o primeiro frame. Agora resolva seu MAC por ARP.", true);
    else if (state.gateway === "SW1") feedback("SW1 encaminha pelo MAC, mas não é o gateway de Camada 3. Escolha R1.", false);
    else feedback("192.168.30.1 está fora de 192.168.10.0/24. PC-A não consegue entregar o primeiro frame a esse gateway nesta LAN.", false);
  }));
  one("[data-arp-target]", lab)?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = one("input", event.currentTarget);
    const entered = input.value.trim();
    if (state.mode === "remote" && state.gateway !== "192.168.10.1") {
      feedback("Escolha primeiro um gateway de Camada 3 alcançável na LAN. O frame não avança.", false);
    } else if (entered === current().arpIp) {
      state.arp = true;
      state.delivered = false;
      render();
      feedback(`ARP Cache atualizado: ${current().arpIp} → ${current().mac}. Monte o primeiro frame.`, true);
    } else if (state.mode === "remote" && entered === "192.168.20.50") {
      feedback("PC-B é remoto: ARP resolve o próximo salto local 192.168.10.1, não o host remoto.", false);
    } else {
      feedback(`Nesta entrega, ARP deve resolver ${current().arpIp}.`, false);
    }
  });
  one("[data-destination-builder]", lab)?.addEventListener("submit", (event) => {
    event.preventDefault();
    const ip = one('[data-build="ip"]', event.currentTarget);
    const mac = one('[data-build="mac"]', event.currentTarget);
    if (state.mode === "remote" && state.gateway !== "192.168.10.1") return feedback("O gateway ainda não é alcançável. Corrija essa escolha antes de enviar o frame.", false);
    if (!state.arp) return feedback("Resolva primeiro o MAC da primeira entrega com ARP.", false);
    const ipOk = ip.value === current().ip;
    const macOk = mac.value === current().mac;
    [ip, mac].forEach((field, index) => {
      const ok = index === 0 ? ipOk : macOk;
      field.classList.toggle("is-correct", ok);
      field.classList.toggle("is-wrong", !ok);
    });
    if (!ipOk || !macOk) {
      if (state.mode === "remote" && ip.value === "192.168.10.1") return feedback("O IP do gateway não substitui PC-B como Destination IP final. Use 192.168.20.50.", false);
      if (!ipOk) return feedback(`Destination IP deve permanecer ${current().ip}, o host escolhido.`, false);
      return feedback(`Destination MAC da primeira entrega deve ser ${current().mac}, obtido por ARP.`, false);
    }
    state.delivered = true;
    render();
    feedback(state.mode === "remote"
      ? "Frame AA → RR entregue a R1. O pacote continua destinado a 192.168.20.50; R1 decidirá o próximo encaminhamento."
      : "Frame AA → LL entregue ao host local 192.168.10.80. O gateway não foi usado.", true);
  });

  function setupTerminal() {
    const terminal = one("[data-gateway-terminal]");
    function output(command) {
      const block = document.createElement("pre");
      if (command === "ipconfig /all") {
        block.textContent = "Ethernet adapter Ethernet:\nIPv4 Address: 192.168.10.25\nSubnet Mask: 255.255.255.0\nDefault Gateway: 192.168.10.1";
        one("[data-terminal-explain]", terminal).textContent = "O gateway configurado é 192.168.10.1; para o destino local ele não participa da primeira entrega.";
      } else if (command === "arp -a") {
        block.textContent = state.arp ? `Internet Address      Physical Address\n${current().arpIp}          ${current().mac}` : "Internet Address      Physical Address\n(nenhuma entrada para esta entrega)";
        one("[data-terminal-explain]", terminal).textContent = state.arp ? "O cache já contém o MAC resolvido para a entrega selecionada." : "O cache ainda não contém a entrada; resolva o alvo por ARP no laboratório.";
      } else if (command === "route print") {
        block.textContent = "Network Destination  Netmask        Gateway       Interface\n0.0.0.0              0.0.0.0        192.168.10.1  192.168.10.25";
        one("[data-terminal-explain]", terminal).textContent = "A rota padrão aponta para R1. A seleção detalhada de rotas vem na próxima página.";
      } else {
        block.textContent = `Comando não suportado: ${command || "(vazio)"}. Use ipconfig /all, arp -a ou route print.`;
        one("[data-terminal-explain]", terminal).textContent = "Esse comando não faz parte deste terminal de prática.";
      }
      one("[data-terminal-stage]", terminal).appendChild(block);
    }
    all("[data-command]", terminal).forEach((button) => button.addEventListener("click", () => output(button.dataset.command)));
    one("[data-terminal-form]", terminal)?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = one("[data-terminal-input]", terminal);
      output(input.value.trim().toLowerCase());
      input.value = "";
    });
  }

  function setupPopovers() {
    all(".gateway-term button").forEach((button) => {
      const term = button.parentElement;
      button.addEventListener("click", () => {
        const open = term.classList.contains("is-open");
        all(".gateway-term").forEach((item) => item.classList.remove("is-open"));
        term.classList.toggle("is-open", !open);
      });
      button.addEventListener("keydown", (event) => { if (event.key === "Escape") { term.classList.remove("is-open"); button.focus(); } });
    });
    document.addEventListener("click", (event) => { if (!event.target.closest(".gateway-term")) all(".gateway-term").forEach((item) => item.classList.remove("is-open")); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") all(".gateway-term").forEach((item) => item.classList.remove("is-open")); });
  }

  function setupCheckpoint() {
    const checkpoint = one("#gateway-checkpoint");
    const memory = new Map();
    const number = () => one(".gateway-checkpoint-header>strong", checkpoint)?.textContent.trim().split(" ")[0] || "start";
    function capture() { const values = {}; all("[data-gateway-answer-field]", checkpoint).forEach((field) => { values[field.dataset.gatewayAnswerField] = field.value; }); memory.set(number(), values); return values; }
    function restore() { const values = memory.get(number()) || {}; all("[data-gateway-answer-field]", checkpoint).forEach((field) => { if (values[field.dataset.gatewayAnswerField] !== undefined) field.value = values[field.dataset.gatewayAnswerField]; }); }
    checkpoint?.addEventListener("click", (event) => { const button = event.target.closest("[data-reference-reveal]"); if (button) one("[data-reference]", button.closest(".gateway-explanation")).hidden = false; });
    checkpoint?.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-gateway-checkpoint-form]");
      if (!form) return;
      event.preventDefault();
      if (form.matches("[data-answer-form]")) one("[data-answer-payload]", form).value = JSON.stringify(capture());
      if (form.matches("[data-reset-current]")) memory.delete(number());
      if (form.matches("[data-checkpoint-next], [data-checkpoint-restart]")) memory.clear();
      const submit = one("button[type='submit']", form);
      if (submit) submit.disabled = true;
      try {
        const response = await fetch(form.action, {method: "POST", body: new FormData(form), headers: {"X-Requested-With": "XMLHttpRequest"}});
        if (!response.ok) throw new Error("Falha ao atualizar o checkpoint.");
        const data = await response.json();
        checkpoint.innerHTML = data.html;
        window.NetStudySubnet?.init(checkpoint);
        window.NetStudyL3Path?.init(checkpoint);
        restore();
      } catch (error) {
        const node = document.createElement("p");
        node.className = "gateway-feedback is-error";
        node.textContent = error.message;
        checkpoint.appendChild(node);
      }
    });
  }
  render();
  setupTerminal();
  setupPopovers();
  one("[data-reference-reveal]", one("[data-gateway-explanation]"))?.addEventListener("click", (event) => {
    one("[data-reference]", event.currentTarget.closest(".gateway-explanation")).hidden = false;
  });
  setupCheckpoint();
})();
