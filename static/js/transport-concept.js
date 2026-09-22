(() => {
  "use strict";
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const one = (selector, root = document) => root.querySelector(selector);
  const lab = one("[data-transport-stage]");
  if (!lab) return;

  // One protocol/scenario/step state drives the only lab; there are no timers.
  const state = {protocol: null, scenario: "intro", step: -1};
  const frame = (source, destination, note, result = "") => ({source, destination, note, result});
  const scenes = {
    intro: {
      title: "O papel da Camada de Transporte",
      prompt: "Selecione “Transporte” no caminho para observar sua responsabilidade.",
      steps: [frame([], [], "TCP e UDP não escolhem a rota IP. Eles oferecem serviços entre aplicações finais.", "Routing permanece na Camada 3; transporte é Camada 4.")]
    },
    normal: {
      title: "UDP · três datagramas",
      prompt: "A aplicação envia A, B e C. Avance para observar o destino.",
      steps: [
        frame(["A", "B", "C"], [], "A, B e C partem como datagramas independentes."),
        frame(["A", "B", "C"], ["A", "B", "C"], "A aplicação recebe três datagramas separados.", "Os limites entre os datagramas A, B e C são preservados.")
      ]
    },
    loss: {
      title: "Perda no caminho",
      prompt: "Compare a mesma variável — uma perda — em UDP ou TCP. Avance uma etapa por vez.",
      udp: [
        frame(["1", "2", "3", "4"], [], "A aplicação envia os datagramas 1, 2, 3 e 4."),
        frame(["1", "2", "3 · perdido", "4"], ["1", "2"], "O datagrama 3 se perde; 1 e 2 chegaram."),
        frame(["1", "2", "3 · perdido", "4"], ["1", "2", "4"], "O datagrama 4 chega. UDP não retransmite 3 automaticamente.", "Destino recebeu 1, 2 e 4. A aplicação pode criar seus próprios controles acima do UDP.")
      ],
      tcp: [
        frame(["A", "B", "C", "D"], [], "A/B/C/D representam trechos de um fluxo de bytes, não mensagens independentes."),
        frame(["A", "B", "C", "D"], ["A", "B"], "A e B chegaram."),
        frame(["A", "B", "C · ausente", "D"], ["A", "B"], "C está ausente; ainda falta uma parte do fluxo."),
        frame(["A", "B", "C · ausente", "D · na rede"], ["A", "B"], "D pode ter chegado fisicamente, mas não é entregue à aplicação antes de C."),
        frame(["A", "B", "C · recuperado", "D"], ["A", "B", "C", "D"], "TCP recupera conceitualmente C; o fluxo fica completo em ordem.", "A aplicação recebe o fluxo de bytes A B C D, enquanto a conexão funciona.")
      ]
    },
    order: {
      title: "Chegada fora de ordem",
      prompt: "A rede entrega 1, 3, 2. Compare o que chega à aplicação.",
      udp: [
        frame(["1", "2", "3"], [], "Origem envia três datagramas independentes."),
        frame(["1", "3", "2 · rede"], ["1", "3", "2"], "A rede entrega 1, 3, 2; a aplicação recebe os datagramas conforme chegam.", "UDP não fornece reordenação garantida por si.")
      ],
      tcp: [
        frame(["1", "2", "3"], [], "A rede entrega partes do fluxo na ordem 1, 3, 2."),
        frame(["1", "3", "2 · rede"], ["1", "2", "3"], "TCP reorganiza conceitualmente o fluxo antes de disponibilizá-lo à aplicação.", "A aplicação vê o fluxo de bytes em ordem: 1, 2, 3.")
      ]
    },
    connection: {
      title: "TCP · estado da conexão",
      prompt: "Uma visão compacta do ciclo da conexão, sem detalhar o handshake.",
      steps: [
        frame([], [], "Estabelecer estado entre os endpoints."),
        frame(["Dados"], ["Dados"], "Trocar dados no fluxo de bytes."),
        frame([], [], "Encerrar a conexão.", "Estabelecer estado → trocar dados → encerrar.")
      ]
    },
    ordered: {
      title: "Requisito · fluxo em ordem",
      prompt: "Observe a conclusão permitida por este requisito.",
      steps: [frame([], [], "TCP fornece diretamente fluxo em ordem e mecanismos de recuperação de perda.", "Isso não garante que a comunicação nunca falhe.")]
    },
    independent: {
      title: "Requisito · datagramas",
      prompt: "Observe a conclusão permitida por este requisito.",
      steps: [frame([], [], "UDP pode ser uma base para datagramas independentes; o protocolo superior controla o restante.", "UDP não impede confirmação ou recuperação implementadas acima dele.")]
    },
    latency: {
      title: "Requisito · menor latência",
      prompt: "Observe por que este requisito sozinho não escolhe o protocolo.",
      steps: [frame([], [], "“Quero menor latência” não basta para escolher TCP ou UDP.", "O desempenho depende da aplicação, da rede, da implementação e do protocolo superior.")]
    },
    boundaries: {
      title: "Limites dos envios · ABC e DEF",
      prompt: "A aplicação escreve ABC e depois DEF. Avance e alterne UDP/TCP para comparar.",
      udp: [
        frame(["ABC", "DEF"], [], "Aplicação escreve ABC e depois DEF em dois envios."),
        frame(["ABC", "DEF"], ["[ABC]", "[DEF]"], "UDP entrega dois datagramas separados.", "Os limites dos datagramas ABC e DEF são preservados.")
      ],
      tcp: [
        frame(["ABC", "DEF"], [], "Aplicação escreve os bytes ABC e depois DEF."),
        frame(["ABC", "DEF"], ["Fluxo: ABCDEF"], "TCP oferece um fluxo contínuo de bytes.", "Os limites dos dois envios não são mensagens preservadas; uma leitura não precisa receber ABCDEF de uma só vez.")
      ]
    }
  };
  const current = () => scenes[state.scenario];
  const steps = () => current()[state.protocol] || current().steps;
  const source = one("[data-stage-source]", lab), destination = one("[data-stage-destination]", lab);
  const timeline = one("[data-stage-timeline]", lab), result = one("[data-stage-result]", lab);
  const next = one("[data-stage-next]", lab);
  function units(container, values) {
    container.replaceChildren();
    values.forEach(value => {
      const chip = document.createElement("span");
      chip.className = "transport-unit";
      if (/perdido|ausente/.test(value)) chip.classList.add("is-lost");
      chip.textContent = value;
      container.appendChild(chip);
    });
  }
  function render() {
    const scene = current(), sequence = steps();
    lab.dataset.protocol = state.protocol || "";
    lab.dataset.scenario = state.scenario;
    one("[data-stage-heading]", lab).textContent = scene.title;
    one("[data-stage-prompt]", lab).textContent = scene.prompt;
    all("[data-stage-mode]", lab).forEach(button => button.setAttribute("aria-pressed", String(button.dataset.stageMode === state.protocol)));
    all("[data-transport-open]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.transportOpen === state.scenario && (!button.dataset.transportProtocol || button.dataset.transportProtocol === state.protocol))));
    one("[data-stage-layer]", lab).setAttribute("aria-pressed", String(state.scenario === "intro" && state.step >= 0));
    if (state.step < 0) {
      units(source, []); units(destination, []);
      timeline.replaceChildren();
      const item = document.createElement("li"); item.textContent = "Use o controle para observar o comportamento."; timeline.appendChild(item);
      result.textContent = "";
    } else {
      const snapshot = sequence[state.step];
      units(source, snapshot.source); units(destination, snapshot.destination);
      timeline.replaceChildren();
      sequence.slice(0, state.step + 1).forEach((item, index) => {
        const li = document.createElement("li"); li.textContent = `${index + 1}. ${item.note}`; timeline.appendChild(li);
      });
      result.textContent = snapshot.result;
    }
    next.hidden = state.scenario === "intro" || state.step >= sequence.length - 1;
    next.textContent = state.step < 0 ? "Iniciar observação" : "Próxima etapa";
  }
  function select(scenario, protocol) {
    state.scenario = scenario;
    state.protocol = protocol || (["intro", "latency"].includes(scenario) ? null : state.protocol || "udp");
    state.step = -1;
    render();
    lab.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"});
    lab.focus({preventScroll: true});
  }
  all("[data-transport-open]").forEach(button => button.addEventListener("click", () => select(button.dataset.transportOpen, button.dataset.transportProtocol)));
  all("[data-stage-mode]", lab).forEach(button => button.addEventListener("click", () => {
    const scenario = ["loss", "order", "boundaries"].includes(state.scenario) ? state.scenario : button.dataset.stageMode === "udp" ? "normal" : "loss";
    state.protocol = button.dataset.stageMode; state.scenario = scenario; state.step = -1; render();
  }));
  one("[data-stage-layer]", lab).addEventListener("click", () => {state.scenario = "intro"; state.protocol = null; state.step = 0; render();});
  next.addEventListener("click", () => {if (state.step < steps().length - 1) {state.step += 1; render();}});
  one("[data-stage-reset]", lab).addEventListener("click", () => {state.step = -1; render();});
  render();

  all("[data-reference-reveal]").forEach(button => button.addEventListener("click", () => {
    const card = button.closest("[data-self]");
    one("[data-reference]", card).hidden = false;
    one("textarea", card).readOnly = true;
    button.disabled = true;
  }));

  // Checkpoint transport stays server-driven; remember fields across AJAX rerenders.
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
