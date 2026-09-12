(() => {
  "use strict";
  const one = (selector, scope = document) => scope.querySelector(selector);
  const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  function say(node, message, ok = null) { if (!node) return; node.textContent = message; node.classList.toggle("feedback-ok", ok === true); node.classList.toggle("feedback-error", ok === false); }

  one("[data-stage-id='gateway-intro']")?.addEventListener("l3stage:inspect", (event) => {
    const ok = event.detail.kind === "gateway";
    say(one("[data-stage-answer]"), ok ? "Correto. R1 é o próximo salto local; PC-B continua sendo o destino final." : "Esse elemento não é o próximo dispositivo de Camada 3 que pode encaminhar a comunicação.", ok);
  });
  all("[data-gateway-choice] button").forEach((button) => button.addEventListener("click", () => {
    const ok = button.dataset.gateway === "192.168.10.1";
    say(one("p:last-child", button.closest("[data-gateway-choice]")), ok ? "Correto. O próximo salto precisa estar acessível pela rede local utilizada para aquela entrega." : "192.168.20.1 pertence a outra rede /24 e não está diretamente alcançável nesta LAN.", ok);
  }));
  const arpRoot = one("[data-arp-target]");
  one("button", arpRoot || document)?.addEventListener("click", () => {
    const value = one("input", arpRoot).value.trim(), ok = value === "192.168.10.1";
    say(one("p:last-child", arpRoot), ok ? "Correto. ARP resolve 192.168.10.1 → RR. O primeiro frame pode seguir ao gateway." : "O destino final está fora da rede local. Identifique o endereço local que receberá a primeira entrega Ethernet.", ok);
    if (ok) one("[data-stage-id='gateway-complete']")?.l3PathStage?.highlight("gateway");
  });
  const builder = one("[data-destination-builder]");
  one("button", builder || document)?.addEventListener("click", () => {
    const ip = one("[data-build='ip']", builder).value, mac = one("[data-build='mac']", builder).value;
    const ok = ip === "172.16.20.50" && mac === "RR";
    say(one("p:last-child", builder), ok ? "Correto. IPv4 continua apontando para o host remoto; Ethernet entrega agora ao gateway RR." : "Separe o destino final IP do destinatário Ethernet deste enlace.", ok);
  });
  all("[data-different-question] button").forEach((button) => button.addEventListener("click", () => {
    const ok = button.dataset.answer === "nao";
    say(one("p:last-child", button.closest("[data-different-question]")), ok ? "Correto. Em comunicação remota, isso é esperado: o pacote segue destinado ao host remoto e o primeiro frame vai ao próximo salto local." : "Não é erro. MAC e IPv4 descrevem entregas em camadas e alcances diferentes.", ok);
  }));
  all("[data-gateway-inspector] [data-inspector]").forEach((button) => button.addEventListener("click", () => {
    const kind = button.dataset.inspector;
    all("[data-gateway-inspector] [data-inspector]").forEach((item) => { item.classList.toggle("is-active", item === button); item.setAttribute("aria-expanded", item === button ? "true" : "false"); });
    say(one("[data-inspector-feedback]"), kind === "ethernet" ? "Ethernet Destination RR destaca R1: para quem entrego agora?" : "IPv4 Destination 192.168.20.50 destaca PC-B: onde a comunicação precisa chegar?");
    one("[data-stage-id='gateway-complete']")?.l3PathStage?.highlight(kind === "ethernet" ? "gateway" : "destination");
  }));

  const terminal = one("[data-gateway-terminal]");
  function terminalOutput(command) {
    const stage = one("[data-terminal-stage]", terminal), output = document.createElement("pre");
    if (command === "ipconfig /all") output.textContent = "Ethernet adapter Ethernet:\nIPv4 Address: 192.168.10.25\nSubnet Mask: 255.255.255.0\nDefault Gateway: 192.168.10.1";
    else if (command === "arp -a") output.textContent = "Internet Address      Physical Address\n192.168.10.1          RR";
    else output.textContent = "Tabela de rotas será estudada no próximo módulo.";
    stage.appendChild(output);
    say(one("[data-terminal-explain]"), command === "arp -a" ? "O MAC de 192.168.20.50 não aparece porque a entrega Ethernet local foi resolvida para o gateway." : command === "ipconfig /all" ? "IPv4 identifica a interface; Mask define a sub-rede; Gateway é o próximo salto padrão no cenário." : "Teaser apenas: a tabela não será aberta nesta aula.");
  }
  all("[data-command]", terminal || document).forEach((button) => button.addEventListener("click", () => terminalOutput(button.dataset.command)));
  one("[data-terminal-form]", terminal || document)?.addEventListener("submit", (event) => { event.preventDefault(); const input = one("[data-terminal-input]", terminal), command = input.value.trim().toLowerCase(); input.value = ""; terminalOutput(["ipconfig /all", "arp -a"].includes(command) ? command : "route print"); });

  const rapid = [
    {q: "1. Destino local: ARP procura quem?", options: [["destino", "O próprio destino"], ["gateway", "Gateway"]], answer: "destino", why: "Local: ARP resolve o próprio destino."},
    {q: "2. Destino remoto: qual é o próximo salto neste cenário?", options: [["gateway", "Default Gateway"], ["remoto", "Host remoto"]], answer: "gateway", why: "Remoto: o gateway é o próximo salto no cenário estudado."},
    {q: "3. Para enviar ao gateway, o que ainda falta?", options: [["mac", "MAC do gateway"], ["dns", "Nome DNS"]], answer: "mac", why: "Ethernet precisa do MAC do próximo salto local."},
    {q: "4. MAC do gateway e IP do host remoto podem coexistir?", options: [["sim", "Sim"], ["nao", "Não"]], answer: "sim", why: "Sim. Eles representam a entrega local e o destino final."},
  ];
  const rapidRoot = one("[data-gateway-rapid]"); let rapidIndex = 0;
  function renderRapid() { const item = rapid[rapidIndex]; one("[data-rapid-question]", rapidRoot).textContent = item.q; all("[data-rapid]", rapidRoot).forEach((button, index) => { button.dataset.rapid = item.options[index][0]; button.textContent = item.options[index][1]; }); }
  all("[data-rapid]", rapidRoot || document).forEach((button) => button.addEventListener("click", () => { const item = rapid[rapidIndex], ok = button.dataset.rapid === item.answer; say(one("[data-rapid-feedback]", rapidRoot), ok ? item.why : "Revise a diferença entre destino final e entrega local.", ok); if (ok && rapidIndex < rapid.length - 1) { rapidIndex += 1; window.setTimeout(() => { renderRapid(); say(one("[data-rapid-feedback]", rapidRoot), ""); }, 450); } else if (ok) all("button", rapidRoot).forEach((node) => node.disabled = true); }));
  all("[data-reference-reveal]").forEach((button) => button.addEventListener("click", () => { one("[data-reference]", button.closest(".gateway-explanation")).hidden = false; }));

  const checkpoint = one("#gateway-checkpoint"), memory = new Map();
  const number = () => one(".gateway-checkpoint-header>strong", checkpoint)?.textContent.trim().split(" ")[0] || "start";
  function capture() { const values = {}; all("[data-gateway-answer-field]", checkpoint).forEach((field) => { values[field.dataset.gatewayAnswerField] = field.value; }); memory.set(number(), values); return values; }
  function restore() { const values = memory.get(number()) || {}; all("[data-gateway-answer-field]", checkpoint).forEach((field) => { if (values[field.dataset.gatewayAnswerField] !== undefined) field.value = values[field.dataset.gatewayAnswerField]; }); }
  checkpoint?.addEventListener("click", (event) => { const button = event.target.closest("[data-reference-reveal]"); if (button) one("[data-reference]", button.closest(".gateway-explanation")).hidden = false; });
  checkpoint?.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-gateway-checkpoint-form]"); if (!form) return; event.preventDefault();
    if (form.matches("[data-answer-form]")) one("[data-answer-payload]", form).value = JSON.stringify(capture());
    if (form.matches("[data-reset-current]")) memory.delete(number());
    if (form.matches("[data-checkpoint-next], [data-checkpoint-restart]")) memory.clear();
    const submit = one("button[type='submit']", form); if (submit) submit.disabled = true;
    try {
      const response = await fetch(form.action, {method: "POST", body: new FormData(form), headers: {"X-Requested-With": "XMLHttpRequest"}});
      if (!response.ok) throw new Error("Falha ao atualizar o checkpoint.");
      const data = await response.json(); checkpoint.innerHTML = data.html; window.NetStudySubnet?.init(checkpoint); window.NetStudyL3Path?.init(checkpoint); restore();
    } catch (error) { const node = document.createElement("p"); node.className = "gateway-feedback is-error"; node.textContent = error.message; checkpoint.appendChild(node); }
  });
})();
