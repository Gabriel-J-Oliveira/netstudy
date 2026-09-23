(() => {
  "use strict";
  const BOARD_ID = "delivery-concept-shared";
  const FLOOD_PORTS = [3, 4, 6];
  const one = (selector, scope = document) => scope.querySelector(selector);
  const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const api = () => window.NetStudySwitchBoard;
  const board = () => api()?.boards[BOARD_ID];
  const root = () => one(`[data-board-id="${BOARD_ID}"]`);
  const SCENARIOS = {
    known: {
      title: "Unicast conhecido", question: "Destination BB está na tabela. Qual saída corresponde a esse conhecimento?",
      source: "A", destination: "B", ingress: 1, table: [["B", 4]], outputs: [4],
      instruction: "Consulte o Destination MAC BB na tabela e depois selecione a porta de saída.",
      classification: "Unicast / encaminhamento direto", tableResult: "BB conhecido → Gi0/4",
      action: "Somente Gi0/4", hosts: "PC-B aceita; PC-C e PC-D não recebem",
      explanationTitle: "Destino específico e conhecido",
      explanation: "O Destination MAC identifica um receptor específico; a tabela permite ao switch escolher uma porta.",
    },
    unknown: {
      title: "Unknown unicast", question: "Destination DD é específico, mas DD não aparece na tabela. O que o switch faz?",
      source: "A", destination: "D", ingress: 1, table: [["B", 4]], outputs: FLOOD_PORTS,
      instruction: "Consulte DD e selecione Gi0/3, Gi0/4 e Gi0/6, mantendo Gi0/1 excluída.",
      classification: "Unicast", tableResult: "DD desconhecido",
      action: "Flooding: Gi0/3, Gi0/4 e Gi0/6", hosts: "PC-D aceita; PC-B e PC-C descartam",
      explanationTitle: "Várias saídas, intenção ainda unicast",
      explanation: "Flooding descreve a ação do switch, não a intenção do frame. Várias saídas não tornam o frame broadcast.",
    },
    broadcast: {
      title: "Broadcast", question: "Destination FF:FF:FF:FF:FF:FF foi criado para todos daquele domínio.",
      source: "A", destination: "BROADCAST", ingress: 1, table: [["B", 4]], outputs: FLOOD_PORTS,
      instruction: "Consulte o endereço broadcast e selecione Gi0/3, Gi0/4 e Gi0/6, sem retornar pela entrada.",
      classification: "Broadcast", tableResult: "Associação individual não é necessária",
      action: "Flooding: Gi0/3, Gi0/4 e Gi0/6", hosts: "PC-B, PC-C e PC-D aceitam",
      explanationTitle: "Destino para todos do domínio local",
      explanation: "Broadcast é definido pelo endereço de destino e limitado ao domínio de Camada 2/VLAN.",
    },
    "arp-request": {
      title: "ARP Request", question: "PC-A pergunta: quem possui 192.168.10.20?",
      source: "A", destination: "BROADCAST", ingress: 1, table: [["A", 1]], outputs: FLOOD_PORTS,
      instruction: "Envie o Request broadcast e observe quem recebe e quem processa a pergunta.",
      classification: "Broadcast", tableResult: "Associação individual não é necessária",
      action: "Flooding: Gi0/3, Gi0/4 e Gi0/6", hosts: "Todos recebem; somente PC-B responde ao IPv4 procurado",
      explanationTitle: "ARP Request usa broadcast",
      explanation: "PC-A usa Broadcast porque ainda não conhece o MAC de PC-B. Todos recebem o Request, mas apenas PC-B reconhece 192.168.10.20 e prepara a resposta.",
    },
    "arp-reply": {
      title: "ARP Reply", question: "PC-B responde diretamente a PC-A com seu endereço MAC.",
      source: "B", destination: "A", ingress: 4, table: [["A", 1], ["B", 4]], outputs: [1],
      instruction: "Envie o Reply unicast de PC-B para PC-A.",
      classification: "Unicast", tableResult: "AA conhecido → Gi0/1",
      action: "Somente Gi0/1", hosts: "PC-A aceita; os demais não recebem",
      explanationTitle: "ARP Reply usa unicast",
      explanation: "PC-B já sabe quem solicitou: o Request trouxe o Source MAC de PC-A. Por isso o Reply volta como Unicast para AA:AA:AA:AA:AA:AA.",
    },
  };
  let state;
  let arpPhase = "idle";

  function mac(key) { return api().MAC[key]; }
  function setText(selector, text) { const target = one(selector); if (target) target.textContent = text; }
  function feedback(text) { setText("[data-delivery-lab-feedback]", text); board().announce(text); }
  function setResult(selector, text) { setText(selector, text); }
  function record(key, text) {
    if (state.events.has(key)) return;
    state.events.add(key);
    board().state.events.push(text);
    board().renderTimeline();
  }
  function clearHostStates() {
    all("[data-host]", root()).forEach(host => host.classList.remove("is-accepted", "is-discarded", "is-received", "is-cli-highlight"));
    one("[data-host-outcomes]").replaceChildren();
  }
  function clearSelections() {
    all("[data-switch-port]", root()).forEach(port => { port.classList.remove("is-delivery-choice"); port.setAttribute("aria-pressed", "false"); });
  }
  function updateResults(stage = "initial") {
    const scenario = SCENARIOS[state.kind];
    setResult("[data-result-classification]", stage === "initial" ? "—" : scenario.classification);
    setResult("[data-result-table]", stage === "initial" ? "—" : scenario.tableResult);
    setResult("[data-result-action]", stage === "complete" ? scenario.action : "—");
    setResult("[data-result-hosts]", stage === "complete" ? scenario.hosts : "—");
  }
  function prepareFrame(scenario) {
    const current = board();
    current.state.source = mac(scenario.source);
    current.state.destination = mac(scenario.destination);
    current.state.ingress = scenario.ingress;
    current.state.step = 1;
    current.clearFrameState();
    const ingress = current.port(scenario.ingress);
    ingress.ingress = true; ingress.rx_frames = 1; ingress.rx_delta = 1;
    ingress.last_event = "FRAME_RECEIVED"; ingress.last_frame_direction = "INGRESS";
  }
  function configure(kind, announce = true) {
    const scenario = SCENARIOS[kind];
    if (!scenario || !board()) return;
    const current = board(); current.reset();
    state = {kind, consulted: false, complete: false, selected: new Set(), events: new Set()};
    current.state.events = [];
    scenario.table.forEach(([key, port]) => current.setMacEntry(mac(key), port, null));
    current.state.tableChanges = {};
    prepareFrame(scenario); current.render();
    clearSelections(); clearHostStates(); updateResults();
    setText("[data-experiment-title]", scenario.title);
    setText("[data-experiment-question]", scenario.question);
    setText("[data-builder-instruction]", scenario.instruction);
    setText("[data-explanation-title]", scenario.explanationTitle);
    setText("[data-explanation-text]", scenario.explanation);
    const activeExperiment = kind.startsWith("arp-") ? "broadcast" : kind;
    all("[data-experiment]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.experiment === activeExperiment)));
    one("[data-execute-scenario]").disabled = true;
    one("[data-scenario-builder]").hidden = kind.startsWith("arp-");
    if (!kind.startsWith("arp-")) {
      arpPhase = "idle";
      one("[data-arp-demo]").hidden = true;
      one("[data-arp-launch]").hidden = kind !== "broadcast";
      one("[data-arp-launch]").setAttribute("aria-expanded", "false");
    }
    if (announce) feedback(`${scenario.title} carregado. Comece consultando o Destination MAC.`);
  }
  function consultDestination() {
    if (state.consulted) return feedback("O destino já foi consultado. Agora selecione as portas aplicáveis.");
    state.consulted = true;
    const scenario = SCENARIOS[state.kind];
    one('[data-frame-field="destination"]', root()).classList.add("is-didactic-focus");
    updateResults("consulted");
    record("consult", `Consulta · ${scenario.tableResult}`);
    one("[data-execute-scenario]").disabled = false;
    feedback(`${scenario.classification}. Tabela: ${scenario.tableResult}. Selecione a ação no switch.`);
  }
  function togglePort(number) {
    if (!state.consulted) return feedback("Consulte primeiro o Destination MAC para separar classificação e encaminhamento.");
    const scenario = SCENARIOS[state.kind];
    if (number === scenario.ingress) return feedback(`Gi0/${number} é a porta de entrada; o switch não devolve o frame por ela.`);
    if (!scenario.outputs.includes(number)) return feedback("Essa porta não é uma saída aplicável neste cenário.");
    state.selected.has(number) ? state.selected.delete(number) : state.selected.add(number);
    const element = one(`[data-switch-port="${number}"]`, root());
    element.classList.toggle("is-delivery-choice", state.selected.has(number));
    element.setAttribute("aria-pressed", String(state.selected.has(number)));
    element.setAttribute("aria-label", `Gi0/${number}: ${state.selected.has(number) ? "selecionada" : "não selecionada"}`);
    feedback(`${state.selected.size} de ${scenario.outputs.length} porta(s) correta(s) selecionada(s).`);
  }
  function selectionMatches() {
    const expected = [...SCENARIOS[state.kind].outputs].sort((a, b) => a - b);
    const actual = [...state.selected].sort((a, b) => a - b);
    return actual.length === expected.length && actual.every((port, index) => port === expected[index]);
  }
  function animateFrame(targets, flood) {
    const svg = one("svg", root());
    if (!svg || typeof svg.animate !== "function") return;
    const positions = {1:[80,105],3:[850,310],4:[850,105],6:[80,310]};
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    targets.forEach(port => {
      const marker = document.createElementNS("http://www.w3.org/2000/svg", "g"); marker.classList.add("delivery-flow-marker"); if (flood) marker.classList.add("is-flood");
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect"); rect.setAttribute("width", "66"); rect.setAttribute("height", "28"); rect.setAttribute("rx", "6");
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text"); label.setAttribute("x", "33"); label.setAttribute("y", "19"); label.textContent = "FRAME"; marker.append(rect, label); svg.appendChild(marker);
      marker.animate([{transform:"translate(470px,170px)"},{transform:`translate(${positions[port][0]}px,${positions[port][1]}px)`}],{duration:reduced?1:700,easing:"ease-in-out"}).finished.then(()=>marker.remove()).catch(()=>marker.remove());
    });
  }
  function renderHosts() {
    clearHostStates();
    const outcomes = one("[data-host-outcomes]");
    let entries = [];
    if (state.kind === "known") entries = [["B","accept","PC-B aceita: Destination BB é seu MAC."],["C","none","PC-C não recebe."],["D","none","PC-D não recebe."]];
    if (state.kind === "unknown") entries = [["B","discard","PC-B recebe uma cópia e descarta: seu MAC não é DD."],["C","discard","PC-C recebe uma cópia e descarta: seu MAC não é DD."],["D","accept","PC-D aceita: Destination DD é seu MAC."]];
    if (state.kind === "broadcast") entries = [["B","accept","PC-B aceita o broadcast."],["C","accept","PC-C aceita o broadcast."],["D","accept","PC-D aceita o broadcast."]];
    if (state.kind === "arp-request") entries = [["B","accept","PC-B recebe e responde: possui o IPv4 procurado."],["C","receive","PC-C recebe, mas não responde."],["D","receive","PC-D recebe, mas não responde."]];
    if (state.kind === "arp-reply") entries = [["A","accept","PC-A aceita o ARP Reply unicast."],["C","none","PC-C não recebe."],["D","none","PC-D não recebe."]];
    entries.forEach(([host,status,text]) => { if(status !== "none") one(`[data-host="${host}"]`,root()).classList.add(status === "accept" ? "is-accepted" : status === "discard" ? "is-discarded" : "is-received"); const item=document.createElement("span"); item.dataset.status=status; item.textContent=text; outcomes.appendChild(item); });
  }
  function executeScenario() {
    if (state.complete) return feedback("Este resultado já foi executado. Reinicie o cenário para repeti-lo.");
    if (!state.consulted) return feedback("Consulte o Destination MAC antes de executar.");
    if (!selectionMatches()) return feedback(`A seleção correta exige ${SCENARIOS[state.kind].outputs.map(port=>`Gi0/${port}`).join(", ")}.`);
    const scenario = SCENARIOS[state.kind], current = board();
    current.clearFrameState();
    scenario.outputs.forEach(number => { const port=current.port(number); const flood=scenario.outputs.length>1; port.egress=!flood; port.flooded=flood; port.tx_frames+=1; port.tx_delta=1; port.last_event=flood?"FRAME_FLOODED":"FRAME_FORWARDED"; port.last_frame_direction=flood?"EGRESS · FLOODED":"EGRESS"; });
    current.render(); clearSelections();
    state.complete = true;
    record("execute", `Ação · ${scenario.action}`);
    updateResults("complete"); renderHosts(); animateFrame(scenario.outputs, scenario.outputs.length > 1);
    feedback(`${scenario.action}. ${scenario.hosts}.`);
  }
  function executeArpFrame() {
    const scenario = SCENARIOS[state.kind];
    if (!state.consulted) consultDestination();
    state.selected = new Set(scenario.outputs);
    executeScenario();
  }
  function prepareArpRequest() {
    arpPhase = "request-ready";
    configure("arp-request", false);
    one("[data-arp-demo]").hidden = false;
    one("[data-arp-launch]").hidden = true;
    one("[data-arp-launch]").setAttribute("aria-expanded", "true");
    one("[data-arp-action]").disabled = false;
    setText("[data-arp-action]", "Enviar ARP Request");
    setText("[data-arp-step-copy]", "PC-A ainda não conhece o MAC de PC-B. Envie o ARP Request para 192.168.10.20.");
    setText("[data-arp-feedback]", "O Request está pronto com Destination FF:FF:FF:FF:FF:FF.");
  }
  function runArpStep() {
    if (arpPhase === "request-ready") {
      executeArpFrame();
      arpPhase = "reply-ready";
      setText("[data-arp-action]", "Enviar ARP Reply");
      setText("[data-arp-step-copy]", "Todos receberam o Request. Somente PC-B reconheceu 192.168.10.20; agora ele pode responder a PC-A.");
      setText("[data-arp-feedback]", "Request entregue por broadcast. PC-B processou a pergunta; PC-C e PC-D apenas a receberam.");
      return;
    }
    if (arpPhase === "reply-ready") {
      configure("arp-reply", false);
      executeArpFrame();
      arpPhase = "complete";
      one("[data-arp-action]").disabled = true;
      setText("[data-arp-action]", "Troca ARP concluída");
      setText("[data-arp-step-copy]", "PC-B usou o Source MAC trazido pelo Request e enviou o Reply diretamente a PC-A.");
      setText("[data-arp-feedback]", "Reply entregue por unicast a PC-A. Os demais hosts não receberam esse frame.");
    }
  }
  function resetArpDemo() {
    prepareArpRequest();
    setText("[data-arp-feedback]", "Demonstração reiniciada. O Request está pronto para ser enviado novamente.");
  }
  function handleBoardInput(event) {
    const target = event.target.closest("[data-switch-port], [data-frame-field], [data-mac-entry], [data-board-reset]");
    if (!target || !root().contains(target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (target.matches("[data-board-reset]")) return state.kind.startsWith("arp-") ? resetArpDemo() : configure(state.kind);
    if (target.matches("[data-switch-port]")) return togglePort(Number(target.dataset.switchPort));
    if (target.matches('[data-frame-field="destination"]')) return consultDestination();
    feedback("Nesta bancada, leia primeiro o Destination MAC e depois selecione as portas.");
  }
  function setupBench() {
    if (!root() || !board()) return;
    root().addEventListener("click", handleBoardInput, true);
    root().addEventListener("keydown", event => { if (["Enter"," "].includes(event.key) && event.target.closest("[data-switch-port], [data-mac-entry]")) handleBoardInput(event); }, true);
    all("[data-experiment]").forEach(button => button.addEventListener("click", () => configure(button.dataset.experiment)));
    one("[data-consult-destination]").addEventListener("click", consultDestination);
    one("[data-execute-scenario]").addEventListener("click", executeScenario);
    one("[data-reset-experiment]").addEventListener("click", () => configure(state.kind));
    one("[data-arp-launch]").addEventListener("click", () => { prepareArpRequest(); labScroll(); });
    one("[data-arp-action]").addEventListener("click", runArpStep);
    one("[data-arp-reset]").addEventListener("click", resetArpDemo);
    configure("known", false);
  }
  function labScroll() { one("#delivery-shared-lab").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"}); }
  function setupSelfExplanation() {
    const section=one("[data-delivery-self-explanation]"); section?.querySelector("[data-delivery-reference-button]")?.addEventListener("click",event=>{one("[data-delivery-reference]",section).hidden=false;event.currentTarget.disabled=true;});
  }
  function setupAsyncCheckpoint() {
    const container=one("#delivery-checkpoint"),start=one("[data-delivery-checkpoint-start]"); if(!container)return;
    async function submit(form,submitter){window.NetStudySwitchWorkbench?.capture();if(form.matches("[data-reset-current-form]"))window.NetStudySwitchWorkbench?.discard();const data=new FormData(form);if(submitter?.name)data.append(submitter.name,submitter.value);container.setAttribute("aria-busy","true");try{const response=await fetch(form.action,{method:"POST",body:data,headers:{"X-Requested-With":"XMLHttpRequest","Accept":"application/json"},credentials:"same-origin"});if(!response.ok)throw new Error("request failed");const payload=await response.json();const parsed=new DOMParser().parseFromString(payload.html,"text/html").querySelector("#delivery-checkpoint");if(!parsed)throw new Error("invalid response");container.innerHTML=parsed.innerHTML;container.removeAttribute("aria-busy");api()?.init(container);window.NetStudyExercises?.init();window.NetStudySwitchWorkbench?.init(container);}catch{container.removeAttribute("aria-busy");const warning=document.createElement("div");warning.className="alert alert-danger";warning.textContent="Não foi possível registrar sua resposta. Tente novamente.";container.prepend(warning);}}
    document.addEventListener("submit",event=>{const form=event.target;if(!(form instanceof HTMLFormElement)||form.matches("[data-host-form],[data-switch-form]"))return;if(form===start||container.contains(form)){event.preventDefault();submit(form,event.submitter);}});
  }
  setupBench(); setupSelfExplanation(); setupAsyncCheckpoint();
})();
