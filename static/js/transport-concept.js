(() => {
  "use strict";
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const one = (selector, root = document) => root.querySelector(selector);
  const lab = one("[data-transport-stage]");
  if (!lab) return;

  const state = { protocol: null, scenario: null, step: -1 };
  const completed = {};
  const frame = (source, destination, note, result = "") => ({ source, destination, note, result });
  const scenes = {
    normal: {
      title: "Datagramas independentes",
      prompt: "Observe os dados de origem e avance para o que chega à aplicação.",
      udp: { result: "UDP disponibiliza datagramas separados; cada um mantém seu próprio limite.", steps: [frame(["A", "B", "C"], [], "A aplicação envia três datagramas independentes."), frame(["A", "B", "C"], ["Datagrama A", "Datagrama B", "Datagrama C"], "Os três datagramas chegam à aplicação como unidades independentes.", "Os limites A, B e C permanecem separados.")] },
      tcp: { result: "TCP disponibiliza bytes em ordem como um fluxo; não oferece datagramas independentes à aplicação.", steps: [frame(["A", "B", "C"], [], "A aplicação escreve bytes no fluxo TCP."), frame(["A", "B", "C"], ["A", "B", "C"], "A aplicação lê bytes do fluxo em ordem.", "As letras são marcadores visuais, não mensagens preservadas pelo TCP.")] },
    },
    loss: {
      title: "A mesma perda: parte 3",
      prompt: "UDP e TCP enfrentam a mesma perda do item 3. Avance e compare as consequências.",
      udp: { result: "A aplicação recebeu 1, 2 e 4. UDP não retransmite 3 automaticamente; um protocolo acima dele pode implementar recuperação.", steps: [frame(["1", "2", "3", "4"], [], "Origem envia os mesmos quatro itens usados na comparação TCP."), frame(["1", "2", "3 · perdido", "4"], ["1", "2"], "A parte 3 se perde; 1 e 2 chegaram à aplicação."), frame(["1", "2", "3 · perdido", "4"], ["1", "2", "4"], "A parte 4 chega apesar da perda de 3.", "A aplicação pode receber 4 sem que UDP recupere automaticamente 3.")] },
      tcp: { result: "Enquanto a conexão funciona, TCP usa recuperação para preencher a parte 3 e disponibiliza o fluxo em ordem; isso não garante sucesso absoluto.", steps: [frame(["1", "2", "3", "4"], [], "Origem envia a mesma sequência 1, 2, 3, 4."), frame(["1", "2", "3 · perdido", "4"], ["1", "2"], "A mesma parte 3 se perde; a aplicação já pode ler o prefixo contínuo 1, 2."), frame(["1", "2", "3 · perdido", "4 · chegou"], ["1", "2"], "A parte 4 chega pela rede, mas fica aguardando a parte 3 ausente."), frame(["1", "2", "3 · recuperado", "4"], ["1", "2", "3", "4"], "TCP recupera a parte 3 e recompõe a sequência contígua.", "A aplicação recebe o fluxo em ordem enquanto a conexão funciona; não é garantia absoluta de sucesso.")] },
    },
    order: {
      title: "Chegada da rede: 1, 3, 2",
      prompt: "Avance para ver a ordem de chegada; depois observe o que cada protocolo disponibiliza à aplicação.",
      udp: { result: "UDP disponibiliza os datagramas independentes conforme chegaram: 1, 3, 2.", steps: [frame([], [], "Prepare a transmissão dos três itens."), frame(["1 chegou", "3 chegou antes do 2", "2 chegou"], [], "A rede entrega os dados na ordem 1, 3, 2; observe a chegada antes do resultado na aplicação."), frame(["1 chegou", "3 chegou antes do 2", "2 chegou"], ["1", "3", "2"], "A aplicação recebe os datagramas à medida que chegam.", "UDP não fornece reordenação garantida por si.")] },
      tcp: { result: "A parte 3 chegou antes da 2, mas não completa o fluxo disponível à aplicação; com a parte 2, TCP disponibiliza 1, 2, 3 em ordem.", steps: [frame([], [], "Prepare o fluxo de dados."), frame(["1 chegou", "3 chegou antes do 2", "2 ainda não chegou"], [], "A rede entrega 1 e depois 3; a parte 2 ainda está ausente."), frame(["1 chegou", "3 chegou · aguarda 2", "2 ainda não chegou"], ["1 · prefixo contíguo"], "A parte 3 chegou, mas TCP a mantém aguardando; só o prefixo completo 1 está disponível à aplicação."), frame(["1 chegou", "3 chegou antes do 2", "2 chegou"], ["1", "2", "3"], "Com a chegada de 2, TCP reorganiza o fluxo antes de disponibilizá-lo.", "A aplicação vê os bytes em ordem: 1, 2, 3. Os números são simplificações visuais, não mensagens do TCP.")] },
    },
    boundaries: {
      title: "Dois envios: ABC e DEF",
      prompt: "A aplicação escreve ABC e depois DEF. Compare os dados disponibilizados por cada transporte.",
      udp: { result: "UDP mantém dois datagramas: ABC e DEF.", steps: [frame(["Envio: ABC", "Envio: DEF"], [], "A aplicação realiza dois envios separados."), frame(["Envio: ABC", "Envio: DEF"], ["Datagrama ABC", "Datagrama DEF"], "UDP recebe e disponibiliza dois datagramas separados.", "Os limites dos datagramas ABC e DEF são preservados.")] },
      tcp: { result: "TCP oferece bytes como fluxo contínuo. Os limites dos envios ABC e DEF não são preservados; uma leitura não precisa receber ABCDEF de uma vez.", steps: [frame(["Envio: ABC", "Envio: DEF"], [], "A aplicação escreve ABC e depois DEF em chamadas separadas."), frame(["A", "B", "C", "D", "E", "F"], ["A", "B", "C", "D", "E", "F"], "TCP disponibiliza bytes do fluxo, não duas mensagens baseadas nos limites dos envios.", "Fluxo contínuo: ABCDEF. Uma leitura pode conter uma parte, várias partes ou uma combinação diferente; os limites de envio não são preservados.")] },
    },
    connection: {
      title: "Conexão, em resumo",
      prompt: "Observe apenas a ideia de conexão, sem detalhar o handshake.",
      udp: { result: "UDP não estabelece conexão TCP-like antes de enviar datagramas.", steps: [frame([], [], "Sem estabelecer conexão TCP-like."), frame(["Datagrama"], ["Datagrama"], "A aplicação pode enviar um datagrama sem esse estado de conexão.", "Datagramas UDP são independentes; mecanismos adicionais podem existir acima do UDP.")] },
      tcp: { result: "TCP mantém estado de conexão para trocar o fluxo; essa conexão não torna o sucesso absoluto.", steps: [frame([], [], "Estabelecer estado entre endpoints."), frame(["Dados"], ["Dados"], "Trocar dados no fluxo de bytes."), frame([], [], "Encerrar a conexão.", "Estabelecer estado → trocar dados → encerrar. O detalhe do handshake fica para TCP por dentro.")] },
    },
  };

  const source = one("[data-stage-source]", lab), destination = one("[data-stage-destination]", lab);
  const timeline = one("[data-stage-timeline]", lab), result = one("[data-stage-result]", lab);
  const next = one("[data-stage-next]", lab), compare = one("[data-stage-compare]", lab);
  let comparisonShown = false;
  const current = () => state.scenario ? scenes[state.scenario] : null;
  const steps = () => current() && state.protocol ? current()[state.protocol].steps : [];

  function units(container, values) {
    container.replaceChildren();
    values.forEach(value => {
      const chip = document.createElement("span");
      chip.className = "transport-unit";
      if (/perdido|ausente|ainda não chegou/.test(value)) chip.classList.add("is-lost");
      if (/aguarda|chegou/.test(value)) chip.classList.add("is-arrival");
      chip.textContent = value;
      container.appendChild(chip);
    });
  }
  function comparisonReady() {
    const outcome = completed[state.scenario] || {};
    return Boolean(outcome.udp && outcome.tcp);
  }
  function render() {
    const scene = current(), sequence = steps();
    lab.dataset.protocol = state.protocol || "";
    lab.dataset.scenario = state.scenario || "";
    one("[data-stage-heading]", lab).textContent = scene ? scene.title : "Escolha um cenário";
    one("[data-stage-prompt]", lab).textContent = scene ? scene.prompt : "1 · Escolha cenário → 2 · Observe UDP → 3 · Observe TCP → 4 · Avance → 5 · Compare.";
    all("[data-stage-mode]", lab).forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.stageMode === state.protocol));
      button.disabled = !scene;
    });
    all("[data-transport-open]", lab).forEach(button => button.setAttribute("aria-pressed", String(button.dataset.transportOpen === state.scenario)));
    if (state.step < 0 || !sequence.length) {
      units(source, []); units(destination, []);
      timeline.replaceChildren();
      const item = document.createElement("li"); item.textContent = scene ? "Agora escolha Observar UDP ou Observar TCP." : "Escolha um cenário acima para começar."; timeline.appendChild(item);
      result.textContent = "";
    } else {
      const snapshot = sequence[state.step];
      units(source, snapshot.source); units(destination, snapshot.destination);
      timeline.replaceChildren();
      sequence.slice(0, state.step + 1).forEach((item, index) => {
        const li = document.createElement("li"); li.textContent = `${index + 1}. ${item.note}`; timeline.appendChild(li);
      });
      result.textContent = snapshot.result;
      if (state.step === sequence.length - 1) completed[state.scenario][state.protocol] = current()[state.protocol].result;
    }
    next.hidden = !scene || !state.protocol;
    next.disabled = !scene || !state.protocol || state.step >= sequence.length - 1;
    next.textContent = state.step < 0 ? "Iniciar observação" : "Avançar etapa";
    compare.disabled = !scene || !comparisonReady();
    one("[data-stage-comparison]", lab).hidden = !comparisonShown || !comparisonReady();
  }
  function chooseScenario(scenario) {
    state.scenario = scenario;
    state.protocol = null;
    state.step = -1;
    completed[scenario] = {};
    comparisonShown = false;
    render();
    lab.focus({ preventScroll: true });
  }
  function chooseProtocol(protocol) {
    if (!state.scenario) return;
    state.protocol = protocol;
    state.step = -1;
    comparisonShown = false;
    render();
  }
  all("[data-transport-open]", lab).forEach(button => button.addEventListener("click", () => chooseScenario(button.dataset.transportOpen)));
  all("[data-stage-mode]", lab).forEach(button => button.addEventListener("click", () => chooseProtocol(button.dataset.stageMode)));
  next.addEventListener("click", () => {
    if (!state.scenario || !state.protocol || state.step >= steps().length - 1) return;
    state.step += 1;
    render();
  });
  compare.addEventListener("click", () => {
    if (!comparisonReady()) return;
    text("[data-comparison-udp]", completed[state.scenario].udp);
    text("[data-comparison-tcp]", completed[state.scenario].tcp);
    comparisonShown = true;
    render();
  });
  one("[data-stage-reset]", lab).addEventListener("click", () => {
    if (state.scenario) completed[state.scenario] = {};
    state.protocol = null;
    state.step = -1;
    comparisonShown = false;
    render();
  });
  function text(selector, value) { const target = one(selector, lab); if (target) target.textContent = value; }
  all("[data-prediction-toggle]").forEach(button => button.addEventListener("click", () => {
    const answer = one("[data-prediction-answer]", button.closest(".prediction-item"));
    answer.hidden = !answer.hidden;
    button.setAttribute("aria-expanded", String(!answer.hidden));
    button.textContent = answer.hidden ? "Conferir previsão" : "Ocultar conferência";
  }));
  render();

  // Checkpoint remains server-driven; preserve answers across AJAX rerenders.
  const checkpoint = one("#transport-checkpoint"), memory = new Map();
  const currentNumber = () => one(".gateway-checkpoint-header>strong", checkpoint)?.textContent.split(" ")[0] || "start";
  function capture() { const values = {}; all("[data-transport-answer]", checkpoint).forEach(field => values[field.dataset.transportAnswer] = field.value); memory.set(currentNumber(), values); return values; }
  function restore() { const values = memory.get(currentNumber()) || {}; all("[data-transport-answer]", checkpoint).forEach(field => { if (values[field.dataset.transportAnswer] !== undefined) field.value = values[field.dataset.transportAnswer]; }); }
  checkpoint?.addEventListener("submit", async event => {
    const form = event.target.closest("[data-transport-checkpoint-form]"); if (!form) return;
    event.preventDefault();
    if (form.matches("[data-answer-form]")) one("[data-payload]", form).value = JSON.stringify(capture());
    if (form.matches("[data-reset]")) memory.delete(currentNumber());
    if (form.matches("[data-next], [data-restart]")) memory.clear();
    try {
      const response = await fetch(form.action, {method: "POST", body: new FormData(form), headers: {"X-Requested-With": "XMLHttpRequest"}});
      if (!response.ok) throw Error("Falha ao atualizar checkpoint.");
      const data = await response.json(); checkpoint.innerHTML = data.html; restore();
    } catch (error) { const note = document.createElement("p"); note.className = "gateway-feedback is-error"; note.textContent = error.message; checkpoint.appendChild(note); }
  });
})();
