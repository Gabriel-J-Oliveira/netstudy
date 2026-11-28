(() => {
  "use strict";

  const lesson = document.querySelector("[data-osi-lesson]");
  if (!lesson) return;

  const layers = [...lesson.querySelectorAll("[data-osi-layer]")];
  const panels = lesson.querySelectorAll("[data-osi-info]");

  function selectLayer(selected) {
    for (const layer of layers) {
      layer.setAttribute("aria-pressed", String(layer === selected));
      layer.classList.toggle("is-related", layer !== selected && layer.dataset.group === selected.dataset.group);
    }
    for (const panel of panels) {
      panel.hidden = panel.id !== selected.getAttribute("aria-controls");
    }
  }

  for (const layer of layers) {
    layer.addEventListener("click", () => selectLayer(layer));
  }
  selectLayer(layers[0]);

  const path = lesson.querySelector("[data-osi-path]");
  const steps = [...path.querySelectorAll("[data-osi-step]")];
  const places = path.querySelectorAll("[data-osi-place]");
  const back = path.querySelector("[data-osi-back]");
  const next = path.querySelector("[data-osi-next]");
  const reset = path.querySelector("[data-osi-reset]");
  let position = 0;

  function renderStep() {
    steps.forEach((step, index) => { step.hidden = index !== position; });
    for (const place of places) {
      if (place.dataset.osiPlace === steps[position].dataset.osiStep) {
        place.setAttribute("aria-current", "step");
      } else {
        place.removeAttribute("aria-current");
      }
    }
    back.disabled = position === 0;
    next.disabled = position === steps.length - 1;
  }

  back.addEventListener("click", () => {
    position -= 1;
    renderStep();
    if (back.disabled) next.focus();
  });
  next.addEventListener("click", () => {
    position += 1;
    renderStep();
    if (next.disabled) back.focus();
  });
  reset.addEventListener("click", () => {
    position = 0;
    renderStep();
    next.focus();
  });
  renderStep();
})();
