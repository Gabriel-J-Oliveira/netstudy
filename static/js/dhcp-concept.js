(() => {
  "use strict";
  const one = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const lab = one("[data-dhcp-lab]");
  if (!lab) return;
  const scenes = {
    meaning: {title: "Antes da configuração", steps: ["Cliente começa sem endereço IPv4 configurado.", "DHCP fornece parâmetros para que outros mecanismos sejam utilizados depois."], feedback: "Configurar não equivale a transportar dados, resolver nomes ou escolher a rota."},
    dora: {title: "Discover → Offer → Request → ACK", steps: [
      "Discover: cliente sem IPv4 procura um servidor DHCP; neste cenário local pode usar broadcast.",
      "Offer: servidor 192.168.10.53 propõe uma configuração.",
      "Request: cliente solicita a concessão oferecida.",
      "ACK: servidor confirma a concessão de 192.168.10.50/24, gateway 192.168.10.1 e DNS 192.168.10.53.",
    ], feedback: "Discover → Offer → Request → ACK. A configuração está pronta para uso."},
    lease: {title: "Inspecione a concessão", steps: ["Concessão recebida: IP 192.168.10.50/24, gateway 192.168.10.1, DNS 192.168.10.53.", "Selecione cada campo para ver sua função na comunicação posterior."], feedback: "Cada campo tem uma função distinta; DHCP apenas fornece a configuração."},
    "diagnose-valid": {title: "Configuração válida", steps: ["ipconfig /all mostra 192.168.10.50/24, gateway 192.168.10.1 e DNS 192.168.10.53."], feedback: "Os parâmetros estão configurados; isso não testa o serviço remoto."},
    "diagnose-apipa": {title: "Endereço 169.254.x.x", steps: ["Cliente apresenta endereço 169.254.x.x em vez da concessão esperada."], feedback: "APIPA pode indicar concessão ausente; não determina a causa sozinho."},
    journey: {title: "Depois da concessão", steps: ["Cliente recebe IP 192.168.10.50 e máscara /24.", "IP e máscara permitem distinguir a rede local.", "Gateway 192.168.10.1 serve de próximo salto para redes remotas.", "DNS 192.168.10.53 é usado para consultar nomes."], feedback: "DHCP fornece configuração; cada mecanismo realiza seu trabalho depois."},
  };
  const fieldFeedback = {
    ip: "IP 192.168.10.50 identifica este host no cenário.",
    mask: "Máscara /24 ajuda a determinar qual rede é local.",
    gateway: "Gateway 192.168.10.1 é o próximo salto local para redes remotas.",
    dns: "DNS 192.168.10.53 é o resolvedor para consultas de nomes; DHCP não faz a resolução.",
  };
  const evidence = {
    "diagnose-valid": ["Concessão 192.168.10.50/24, gateway e DNS aparecem configurados.", "O cliente mostra os parâmetros esperados.", "Se DNS, gateway ou serviço remoto estão respondendo agora."],
    "diagnose-apipa": ["Endereço 169.254.x.x aparece no cliente.", "A concessão DHCP esperada pode não ter sido recebida.", "A causa: alcance, VLAN, servidor ou conectividade exigem investigação."],
  };
  const state = {scene: "meaning", step: -1};
  const timeline = one("[data-dhcp-steps]", lab), next = one("[data-dhcp-next]", lab), feedback = one("[data-dhcp-feedback]", lab);
  function render() {
    const scene = scenes[state.scene];
    one("[data-dhcp-title]", lab).textContent = scene.title;
    lab.dataset.scene = state.scene;
    one("[data-dhcp-client]", lab).textContent = state.scene === "diagnose-apipa" ? "169.254.x.x · APIPA" : state.step >= 0 && state.scene !== "meaning" && !(state.scene === "dora" && state.step < 3) ? "192.168.10.50/24" : "IPv4 não configurado";
    const panel = one("[data-dhcp-evidence]", lab), values = evidence[state.scene];
    panel.hidden = !values;
    if (values) {
      one("[data-dhcp-observed]", lab).textContent = values[0];
      one("[data-dhcp-safe]", lab).textContent = values[1];
      one("[data-dhcp-unknown]", lab).textContent = values[2];
    }
    timeline.replaceChildren();
    const visible = state.step < 0 ? ["Clique em Iniciar e avance no seu ritmo."] : scene.steps.slice(0, state.step + 1);
    visible.forEach(value => {const li = document.createElement("li"); li.textContent = value; timeline.appendChild(li);});
    feedback.textContent = state.step === scene.steps.length - 1 ? scene.feedback : "";
    next.hidden = state.step >= scene.steps.length - 1;
    next.textContent = state.step < 0 ? "Iniciar" : "Próxima etapa";
    all("[data-dhcp-open]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.dhcpOpen === state.scene)));
  }
  function select(scene) {
    state.scene = scene; state.step = -1; render();
    lab.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"});
    lab.focus({preventScroll: true});
  }
  all("[data-dhcp-open]").forEach(button => button.addEventListener("click", () => select(button.dataset.dhcpOpen)));
  next.addEventListener("click", () => {if (state.step < scenes[state.scene].steps.length - 1) state.step += 1; render();});
  one("[data-dhcp-reset]", lab).addEventListener("click", () => {state.step = -1; render();});
  all("[data-dhcp-field]", lab).forEach(button => button.addEventListener("click", () => {
    if (state.scene !== "lease") {state.scene = "lease"; state.step = 0; render();}
    feedback.textContent = fieldFeedback[button.dataset.dhcpField];
    all("[data-dhcp-field]", lab).forEach(field => field.setAttribute("aria-pressed", String(field === button)));
  }));
  const terminal = one("[data-dhcp-terminal]");
  terminal?.addEventListener("submit", event => {
    event.preventDefault();
    const command = one("input", terminal).value.trim();
    const output = one("[data-dhcp-terminal-output]");
    if (command === "ipconfig /all") {
      output.textContent = state.scene === "diagnose-apipa"
        ? "IPv4 Address: 169.254.10.50\nSubnet Mask: 255.255.0.0\nDefault Gateway: (não configurado)\nConcessão DHCP esperada não observada; causa indeterminada."
        : "IPv4 Address: 192.168.10.50\nSubnet Mask: 255.255.255.0\nDefault Gateway: 192.168.10.1\nDHCP Server: 192.168.10.53\nDNS Servers: 192.168.10.53";
    } else if (command === "ipconfig /renew") {
      output.textContent = "Concessão simulada confirmada.\nIPv4 Address: 192.168.10.50\nSubnet Mask: 255.255.255.0\nDefault Gateway: 192.168.10.1\nDNS Servers: 192.168.10.53";
      state.scene = "diagnose-valid"; state.step = 0; render();
    } else {
      output.textContent = "Comando não disponível neste cenário. Use ipconfig /all ou ipconfig /renew.";
    }
  });
  const checkpoint = one("#dhcp-checkpoint"), memory = new Map();
  const currentNumber = () => one(".gateway-checkpoint-header>strong", checkpoint)?.textContent.split(" ")[0] || "start";
  function capture() {
    const values = {};
    all("[data-dhcp-answer]", checkpoint).forEach(field => values[field.dataset.dhcpAnswer] = field.value);
    memory.set(currentNumber(), values);
    return values;
  }
  function restore() {
    const values = memory.get(currentNumber()) || {};
    all("[data-dhcp-answer]", checkpoint).forEach(field => {if (values[field.dataset.dhcpAnswer] !== undefined) field.value = values[field.dataset.dhcpAnswer];});
  }
  checkpoint?.addEventListener("submit", async event => {
    const form = event.target.closest("[data-dhcp-checkpoint-form]");
    if (!form) return;
    event.preventDefault();
    if (form.matches("[data-answer-form]")) one("[data-payload]", form).value = JSON.stringify(capture());
    if (form.matches("[data-reset]")) memory.delete(currentNumber());
    if (form.matches("[data-next], [data-restart]")) memory.clear();
    try {
      const response = await fetch(form.action, {method: "POST", body: new FormData(form), headers: {"X-Requested-With": "XMLHttpRequest"}});
      if (!response.ok) throw Error("Falha ao atualizar checkpoint.");
      const data = await response.json(); checkpoint.innerHTML = data.html; restore();
    } catch (error) {
      const note = document.createElement("p"); note.className = "gateway-feedback is-error"; note.textContent = error.message; checkpoint.appendChild(note);
    }
  });
  render();
})();
