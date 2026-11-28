(() => {
  "use strict";
  const root = document.querySelector("[data-loops]");
  if (!root) return;
  const lab = root.querySelector("[data-loop-lab]");
  const $ = (selector) => lab.querySelector(selector);
  const svg = $("[data-topology]");
  const motion = Array.from(svg.querySelectorAll("animateMotion"));
  const state = { stage: 1, loop: false, sent: false, playing: false, timer: null };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const maxStormFrames = 48;
  const stages = {
    1: {
      title: "Comunicação normal",
      observation: "Os computadores trocam dados. O broadcast percorre as saídas elegíveis; os enlaces têm baixa utilização e R1 responde.",
      explanation: "Esta é a referência saudável para comparar o que muda quando se fecha um caminho circular.",
      frames: 3, utilization: 8, queue: 0, drops: 0, mac: "Gi0/1 · estável", gateway: "Respondendo", label: "REDE SAUDÁVEL",
    },
    2: {
      title: "Agora existe um caminho circular de Camada 2",
      observation: "O enlace SW2 Gi0/2 ↔ SW3 Gi0/2 fechou o circuito SW1–SW2–SW3–SW1. As setas tracejadas mostram o sentido possível das cópias.",
      explanation: "Cada recepção exclui a própria porta de entrada. Uma cópia que retorna por outra interface ainda pode ser replicada.",
      frames: 3, utilization: 12, queue: 0, drops: 0, mac: "Gi0/1 · sem mudança ainda", gateway: "Respondendo", label: "FORMAÇÃO DO LOOP",
    },
    3: {
      title: "As cópias retornam e são replicadas",
      observation: "Frames percorrem o circuito e alcançam outros enlaces e hosts. Cópias podem voltar por outra interface e sofrer novo flooding.",
      explanation: "A exclusão da porta de entrada vale para cada recepção. Ela não elimina os outros caminhos do ciclo.",
      frames: 12, utilization: 42, queue: 2, drops: 0, mac: "Gi0/1 ⇄ Gi0/2 · mudando", gateway: "Recebe broadcast local", label: "REPLICAÇÃO",
    },
    4: {
      title: "O tráfego excessivo começa a comprometer a rede",
      observation: "O modelo mostra frames duplicados nos hosts, flooding excessivo, MAC Flapping e filas de enlace congestionadas.",
      explanation: "Um loop é o caminho circular; Broadcast Storm é o excesso de broadcasts. São fenômenos relacionados, não sinônimos.",
      frames: 28, utilization: 74, queue: 6, drops: 2, mac: "Gi0/2 ⇄ Gi0/3 · MAC Flapping", gateway: "Fila local crescendo", label: "STORM · IMPACTO CRESCENTE",
    },
    5: {
      title: "Os equipamentos estão ligados, mas a comunicação está comprometida",
      observation: "Os enlaces deste modelo estão próximos da saturação. Frames legítimos atrasam ou são descartados; PC-A não consegue alcançar o gateway e R1 não responde a tempo neste teste didático (timeout).",
      explanation: "O impacto real depende da topologia, das VLANs, da capacidade e das proteções. Nem todo loop derruba toda a infraestrutura.",
      frames: maxStormFrames, utilization: 96, queue: 10, drops: 8, mac: "Gi0/3 ⇄ Gi0/2 · MAC Flapping", gateway: "Timeout neste modelo", label: "COLAPSO PERCEBIDO",
    },
    6: {
      title: "O circuito foi interrompido e a rede se estabiliza",
      observation: "Ao remover o cabo redundante, este caminho circular deixa de existir. O tráfego ilustrativo cai, as associações MAC estabilizam e a comunicação legítima volta a responder.",
      explanation: "A recuperação é gradual na representação; o enlace continua instalado nos outros ramos e oferece caminhos físicos alternativos sem manter este ciclo.",
      frames: 0, utilization: 14, queue: 1, drops: 0, mac: "Gi0/1 · estável", gateway: "Respondendo novamente", label: "RECUPERAÇÃO",
    },
  };
  const usageTrace = { 1: [8, 8, 8, 8, 8, 8], 2: [8, 12, 12, 12, 12, 12], 3: [8, 12, 42, 42, 42, 42], 4: [8, 12, 42, 74, 74, 74], 5: [8, 12, 42, 74, 96, 96], 6: [8, 12, 42, 74, 96, 14] };

  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
  }

  function setDeviceNotes() {
    const pcA = lab.querySelector('[data-device="pc-a"] [data-host-note]');
    const pcB = lab.querySelector('[data-device="pc-b"] [data-host-note]');
    const pcC = lab.querySelector('[data-device="pc-c"] [data-host-note]');
    const gateway = lab.querySelector('[data-device="gateway"] [data-gateway-note]');
    const notes = {
      1: ["Envia broadcast", "Recebe uma cópia", "Recebe uma cópia", "Respondendo"],
      2: ["Aguardando resposta…", "Uma cópia", "Uma cópia", "Recebe broadcast local"],
      3: ["Aguardando resposta…", "Recebi cópias!", "Recebi cópias!", "Recebe tráfego local"],
      4: ["Aguardando resposta…", "Recebi várias cópias!", "Recebi várias cópias!", "Tráfego excessivo"],
      5: ["Timeout!", "Frames atrasados", "Frames atrasados", "Não responde a tempo"],
      6: ["Comunica novamente", "Recebe uma cópia", "Recebe uma cópia", "Respondendo"],
    }[state.stage];
    pcA.textContent = notes[0]; pcB.textContent = notes[1]; pcC.textContent = notes[2]; gateway.textContent = notes[3];
    lab.querySelectorAll("[data-alert]").forEach((alert) => alert.classList.toggle("visible", state.stage >= 4 && state.stage <= 5));
    lab.querySelectorAll("[data-device]").forEach((device) => device.classList.toggle("overloaded", state.stage >= 4 && state.stage <= 5));
    lab.querySelectorAll("[data-device-note]").forEach((note, index) => {
      note.textContent = state.stage >= 4 && state.stage <= 5
        ? ["MAC Flapping", "Flooding excessivo", "Enlace saturado"][index] || "Fila congestionada"
        : index === 0 ? "Aprendizado estável" : "Flooding normal";
    });
  }

  function render() {
    const details = stages[state.stage];
    for (let phase = 1; phase <= 6; phase += 1) lab.classList.toggle(`stage-${phase}`, state.stage === phase);
    lab.classList.toggle("is-loop", state.loop);
    lab.classList.toggle("is-playing", state.playing);
    lab.dataset.stage = String(state.stage);
    $("[data-loop-link]").classList.toggle("connected", state.loop);
    $("[data-loop-link]").classList.toggle("current", state.loop && state.stage >= 2 && state.stage <= 5);
    $("[data-circuit]").classList.toggle("visible", state.loop);
    $("[data-copies]").textContent = state.sent ? Math.min(maxStormFrames, details.frames) : "0";
    $("[data-util]").textContent = `${details.utilization}%`;
    $("[data-util-bar]").style.width = `${details.utilization}%`;
    $("[data-queue]").textContent = `${details.queue} / ${details.drops} frames`;
    $("[data-queue-bar]").style.width = `${details.queue * 10}%`;
    $("[data-mac]").textContent = details.mac;
    const macEvidence = root.querySelector("[data-mac-change]");
    macEvidence.textContent = state.stage === 1 ? "Gi0/1 · estável" : state.stage === 2 ? "Sem mudança observada" : state.stage === 3 ? "Gi0/1 ⇄ Gi0/2 · mudança no modelo" : state.stage <= 5 ? "Gi0/2 ⇄ Gi0/3 · MAC Flapping" : "Gi0/1 · estável após a recuperação";
    $("[data-gateway-state]").textContent = details.gateway;
    $("[data-model-state]").textContent = ["Antes", "Durante", "Durante", "Durante", "Durante", "Depois"][state.stage - 1] + " · " + details.label.toLocaleLowerCase("pt-BR");
    $("[data-event-stage]").textContent = `ETAPA ${state.stage} · ${details.label}`;
    $("[data-event-title]").textContent = details.title;
    $("[data-event-observation]").textContent = details.observation;
    $("[data-event-explanation]").textContent = details.explanation;
    $("[data-redundant]").textContent = state.loop ? "Desconectar cabo redundante" : "Conectar cabo redundante";
    $("[data-send]").disabled = state.sent || state.stage === 6;
    $("[data-redundant]").disabled = state.stage === 6 && !state.loop;
    $("[data-step]").disabled = !state.loop || state.stage < 2 || state.stage >= 5 || state.playing;
    $("[data-play]").disabled = (!state.loop && !(state.sent && state.stage === 1)) || (state.loop && (state.stage < 2 || state.stage >= 5)) || state.playing || reducedMotion.matches;
    $("[data-pause]").disabled = !state.playing;
    $("[data-pause]").setAttribute("aria-pressed", String(state.playing));
    $("[data-reset]").disabled = state.stage === 1 && !state.loop && !state.sent;
    lab.querySelectorAll("[data-stage-marker]").forEach((marker) => {
      const active = Number(marker.dataset.stageMarker) === state.stage;
      if (active) marker.setAttribute("aria-current", "step"); else marker.removeAttribute("aria-current");
      marker.classList.toggle("passed", Number(marker.dataset.stageMarker) < state.stage);
    });
    const visibleNormal = state.sent && state.stage === 1 && !state.loop;
    lab.querySelectorAll("[data-normal-particle]").forEach((particle) => particle.classList.toggle("visible", visibleNormal && state.playing));
    lab.querySelectorAll("[data-normal-manual]").forEach((particle) => particle.classList.toggle("visible", visibleNormal && !state.playing));
    const stormCount = state.stage >= 4 ? 8 : state.stage === 3 ? 4 : 2;
    lab.querySelectorAll("[data-storm-particle]").forEach((particle, index) => particle.classList.toggle("visible", state.loop && state.sent && state.stage >= 2 && state.stage <= 5 && state.playing && index < stormCount));
    lab.querySelectorAll("[data-storm-manual]").forEach((particle, index) => particle.classList.toggle("visible", state.loop && state.sent && state.stage >= 2 && state.stage <= 5 && !state.playing && index < stormCount));
    lab.querySelectorAll("[data-path]").forEach((path) => path.classList.toggle("current", state.loop && state.stage >= 2 && state.stage <= 5 && Number(path.dataset.pathStep) === (state.stage - 2) % 3));
    lab.querySelectorAll("[data-path-label]").forEach((label) => label.classList.toggle("current", state.loop && state.stage >= 2 && state.stage <= 5 && Number(label.dataset.pathLabel) === (state.stage - 2) % 3));
    const trace = usageTrace[state.stage].map((value, index) => {
      const x = 24 + index * 73.2;
      const y = 80 - value * 0.55;
      return `${x},${y}`;
    }).join(" ");
    root.querySelector("[data-traffic-line]").setAttribute("points", trace);
    lab.querySelectorAll("[data-loop-status]").forEach((status) => {
      const statusText = {
        1: state.sent ? "Rede saudável: três saídas broadcast são representadas uma vez. A utilização permanece baixa e o gateway responde." : "Rede saudável: baixa utilização, switches estáveis e gateway respondendo. Envie um broadcast para iniciar a observação.",
        2: "Agora existe um caminho circular de Camada 2. O circuito está destacado; as cópias podem voltar por outra interface.",
        3: "Replicação no modelo: cópias percorrem o circuito, chegam a outros enlaces e podem ser encaminhadas novamente.",
        4: "Flooding excessivo, frames duplicados, MAC Flapping e filas crescentes afetam as comunicações legítimas.",
        5: "Os equipamentos seguem ligados, mas este modelo mostra enlaces quase saturados e timeout do gateway no teste representado.",
        6: "Cabo redundante removido: este ciclo foi interrompido, os indicadores caíram e a comunicação legítima voltou a responder.",
      }[state.stage];
      status.textContent = statusText;
    });
    setDeviceNotes();
  }

  function stopPlayback() {
    if (state.timer !== null) {
      window.clearInterval(state.timer);
      window.clearTimeout(state.timer);
    }
    state.timer = null;
    state.playing = false;
    if (typeof svg.pauseAnimations === "function") svg.pauseAnimations();
  }

  function advance() {
    if (!state.loop || state.stage < 2 || state.stage >= 5) return;
    state.stage += 1;
    if (state.stage >= 5) stopPlayback();
    render();
  }

  function beginPlayback() {
    if (state.playing || reducedMotion.matches) return;
    const normalBurst = !state.loop && state.sent && state.stage === 1;
    if (!normalBurst && (!state.loop || state.stage < 2 || state.stage >= 5)) return;
    state.playing = true;
    const speed = Number($("[data-speed]").value) || 1500;
    motion.forEach((animation) => animation.setAttribute("dur", `${speed === 850 ? 2.6 : 4.8}s`));
    if (typeof svg.unpauseAnimations === "function") svg.unpauseAnimations();
    render();
    if (normalBurst) {
      state.timer = window.setTimeout(() => { stopPlayback(); render(); }, speed * 3);
      return;
    }
    state.timer = window.setInterval(advance, speed);
  }

  $("[data-send]").addEventListener("click", () => {
    if (state.stage === 6) return;
    state.sent = true;
    if (state.loop) state.stage = 3;
    else state.stage = 1;
    render();
  });
  $("[data-redundant]").addEventListener("click", () => {
    stopPlayback();
    if (state.loop) {
      state.loop = false;
      state.sent = false;
      state.stage = 6;
      if (typeof svg.setCurrentTime === "function") svg.setCurrentTime(0);
    } else {
      state.loop = true;
      state.stage = 2;
    }
    render();
  });
  $("[data-step]").addEventListener("click", advance);
  $("[data-play]").addEventListener("click", beginPlayback);
  $("[data-pause]").addEventListener("click", () => { stopPlayback(); render(); });
  $("[data-speed]").addEventListener("change", () => { if (state.playing) { stopPlayback(); beginPlayback(); } });
  $("[data-reset]").addEventListener("click", () => {
    stopPlayback();
    Object.assign(state, { stage: 1, loop: false, sent: false });
    if (typeof svg.setCurrentTime === "function") svg.setCurrentTime(0);
    render();
  });
  window.addEventListener("pagehide", stopPlayback, { once: true });
  reducedMotion.addEventListener?.("change", () => { if (reducedMotion.matches) stopPlayback(); render(); });
  if (typeof svg.pauseAnimations === "function") svg.pauseAnimations();
  render();

  const match = root.querySelector("[data-match]");
  const matchFeedback = root.querySelector("[data-match-feedback]");
  match.addEventListener("change", () => {
    matchFeedback.textContent = !match.value ? "" : match.value === "loop"
      ? "Correto. Loop descreve o caminho circular. Broadcast Storm descreve o excesso de tráfego."
      : match.value === "storm"
        ? "Broadcast Storm descreve tráfego excessivo; a pergunta identifica o caminho circular."
        : "TTL é um campo IPv4. O frame Ethernet não usa TTL para encerrar o percurso.";
  });
  root.querySelector("[data-match-reset]").addEventListener("click", () => { match.value = ""; matchFeedback.textContent = ""; match.focus(); });

  const rapid = root.querySelector("[data-rapid]");
  const rapidFeedback = rapid.querySelector("[data-rapid-feedback]");
  rapid.querySelectorAll("[data-answer]").forEach((button) => button.addEventListener("click", () => {
    rapid.querySelectorAll("[data-answer]").forEach((choice) => choice.setAttribute("aria-pressed", String(choice === button)));
    rapidFeedback.textContent = button.dataset.answer === "no" ? "Correto. TTL pertence ao cabeçalho IPv4; o frame Ethernet não tem esse campo." : "TTL é usado no pacote IPv4, não no frame Ethernet.";
  }));
  rapid.querySelector("[data-rapid-reset]").addEventListener("click", () => {
    rapidFeedback.textContent = "";
    rapid.querySelectorAll("[data-answer]").forEach((button) => button.setAttribute("aria-pressed", "false"));
    rapid.querySelector("[data-answer]").focus();
  });

  const tableAnswer = root.querySelector("[data-table-answer]");
  const tableFeedback = root.querySelector("[data-table-feedback]");
  tableAnswer.addEventListener("change", () => {
    tableFeedback.textContent = tableAnswer.value === "flap"
      ? "Correto. A alternância de portas é a evidência de MAC Flapping; ela não determina sozinha a causa raiz."
      : tableAnswer.value === "cause"
        ? "A tabela sustenta que a associação de porta mudou, mas não identifica sozinha qual cabo causou a mudança."
        : "";
  });

  const questions = JSON.parse(document.getElementById("loop-questions").textContent);
  const checkpoint = root.querySelector("[data-checkpoint]");
  let index = 0;
  let answered = false;
  function showQuestion() {
    answered = false;
    checkpoint.querySelector("[data-count]").textContent = `Questão ${index + 1} de ${questions.length}`;
    checkpoint.querySelector("[data-progress]").value = index;
    checkpoint.querySelector("[data-question]").textContent = questions[index].prompt;
    checkpoint.querySelector("[data-feedback]").textContent = "";
    checkpoint.querySelector("[data-next]").disabled = true;
    const options = checkpoint.querySelector("[data-options]");
    options.replaceChildren(...questions[index].options.map((label, number) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => {
        const correct = number === questions[index].correct;
        checkpoint.querySelector("[data-feedback]").textContent = questions[index].feedback[number];
        answered = correct;
        checkpoint.querySelector("[data-next]").disabled = !correct;
      });
      return button;
    }));
  }
  checkpoint.querySelector("[data-next]").addEventListener("click", () => {
    if (!answered) return;
    index += 1;
    if (index === questions.length) {
      checkpoint.querySelector("[data-count]").textContent = `Checkpoint concluído · ${questions.length} de ${questions.length}`;
      checkpoint.querySelector("[data-progress]").value = questions.length;
      checkpoint.querySelector("[data-question]").textContent = "Como manter a redundância sem provocar loops? STP ajuda a controlar caminhos redundantes.";
      checkpoint.querySelector("[data-options]").replaceChildren();
      checkpoint.querySelector("[data-feedback]").textContent = `Você concluiu as ${questions.length} situações.`;
      checkpoint.querySelector("[data-next]").hidden = true;
      checkpoint.querySelector("[data-restart]").hidden = false;
      checkpoint.querySelector("[data-restart]").focus();
      return;
    }
    showQuestion();
    checkpoint.querySelector("[data-options] button")?.focus();
  });
  checkpoint.querySelector("[data-restart]").addEventListener("click", () => {
    index = 0;
    checkpoint.querySelector("[data-next]").hidden = false;
    checkpoint.querySelector("[data-restart]").hidden = true;
    showQuestion();
    checkpoint.querySelector("[data-options] button")?.focus();
  });
  showQuestion();
})();
