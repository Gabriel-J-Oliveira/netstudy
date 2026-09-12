(() => {
  "use strict";

  function setupOrdering() {
    const form = document.querySelector("[data-ordering-form]");
    if (!form) return;
    const list = form.querySelector("[data-ordering-list]");
    const input = form.querySelector("input[name='answer_payload']");
    function refresh() {
      [...list.children].forEach((item, index) => { item.querySelector(".sequence-number").textContent = index + 1; });
    }
    list.addEventListener("click", (event) => {
      const button = event.target.closest("[data-move]");
      if (!button) return;
      const item = button.closest("li");
      if (button.dataset.move === "up" && item.previousElementSibling) list.insertBefore(item, item.previousElementSibling);
      if (button.dataset.move === "down" && item.nextElementSibling) list.insertBefore(item.nextElementSibling, item);
      refresh();
    });
    form.addEventListener("submit", () => { input.value = JSON.stringify([...list.children].map((item) => item.dataset.value)); });
  }

  function setupEventSelection() {
    const form = document.querySelector("[data-event-form]");
    if (!form) return;
    const bank = form.querySelector("[data-event-bank]");
    const list = form.querySelector("[data-selected-events]");
    const input = form.querySelector("input[name='answer_payload']");

    function refresh() {
      [...list.children].forEach((item, index) => { item.querySelector(".event-number").textContent = index + 1; });
      const selected = new Set([...list.children].map((item) => item.dataset.value));
      bank.querySelectorAll("button").forEach((button) => { button.disabled = selected.has(button.dataset.eventValue); });
    }
    function addEvent(value) {
      const item = document.createElement("li");
      item.dataset.value = value;
      item.innerHTML = `<span class="event-number"></span><span class="event-text"></span><div><button type="button" data-event-move="up" aria-label="Mover para cima">↑</button><button type="button" data-event-move="down" aria-label="Mover para baixo">↓</button><button type="button" data-event-remove aria-label="Remover">×</button></div>`;
      item.querySelector(".event-text").textContent = value;
      list.appendChild(item);
      refresh();
    }
    bank.addEventListener("click", (event) => { const button = event.target.closest("[data-event-value]"); if (button) addEvent(button.dataset.eventValue); });
    list.addEventListener("click", (event) => {
      const item = event.target.closest("li");
      if (!item) return;
      if (event.target.closest("[data-event-remove]")) item.remove();
      else if (event.target.closest("[data-event-move='up']") && item.previousElementSibling) list.insertBefore(item, item.previousElementSibling);
      else if (event.target.closest("[data-event-move='down']") && item.nextElementSibling) list.insertBefore(item.nextElementSibling, item);
      refresh();
    });
    form.addEventListener("submit", () => { input.value = JSON.stringify([...list.children].map((item) => item.dataset.value)); });
  }

  function setupBuilder() {
    const form = document.querySelector("[data-builder-form]");
    if (!form) return;
    const tokenButtons = [...form.querySelectorAll("[data-token]")];
    const slots = [...form.querySelectorAll("[data-slot]")];
    const hidden = form.querySelector("input[name='answer_payload']");
    const initial = document.getElementById("exercise-initial-payload");
    const assignments = initial ? JSON.parse(initial.textContent) : {};
    const locked = form.dataset.locked === "true";
    let selectedToken = null;

    function tokenText(id) {
      return tokenButtons.find((button) => button.dataset.token === id)?.dataset.tokenText || id;
    }
    function render() {
      tokenButtons.forEach((button) => {
        const assigned = Object.hasOwn(assignments, button.dataset.token);
        button.classList.toggle("is-assigned", assigned);
        button.classList.toggle("is-selected", selectedToken === button.dataset.token);
        button.disabled = locked || assigned;
      });
      slots.forEach((slot) => {
        const content = slot.querySelector("[data-slot-content]");
        const tokens = Object.keys(assignments).filter((token) => assignments[token] === slot.dataset.slot);
        content.textContent = tokens.length ? tokens.map(tokenText).join(" · ") : "Clique para posicionar";
        slot.classList.toggle("has-value", tokens.length > 0);
        slot.disabled = locked;
        document.querySelectorAll(`[data-slot-preview='${slot.dataset.slot}']`).forEach((preview) => { preview.textContent = tokens.length ? tokens.map(tokenText).join(" · ") : "_____"; });
      });
    }
    tokenButtons.forEach((button) => button.addEventListener("click", () => { selectedToken = button.dataset.token; render(); }));
    slots.forEach((slot) => slot.addEventListener("click", () => {
      const slotId = slot.dataset.slot;
      if (selectedToken) {
        if (slot.dataset.capacity !== "many") {
          Object.keys(assignments).forEach((token) => { if (assignments[token] === slotId) delete assignments[token]; });
        }
        assignments[selectedToken] = slotId;
        selectedToken = null;
      } else {
        const placed = Object.keys(assignments).filter((token) => assignments[token] === slotId);
        if (placed.length) delete assignments[placed[placed.length - 1]];
      }
      render();
    }));
    form.addEventListener("submit", () => { hidden.value = JSON.stringify(assignments); });
    render();
  }

  function init() {
    setupOrdering();
    setupEventSelection();
    setupBuilder();
  }

  window.NetStudyExercises = { init };
  init();
})();
