(() => {
  "use strict";

  const lesson = document.querySelector("[data-enc-lesson]");
  if (!lesson) return;

  const walkthrough = JSON.parse(document.getElementById("enc-walkthrough-data").textContent);
  const path = JSON.parse(document.getElementById("enc-path-data").textContent);
  const stage = lesson.querySelector("[data-enc-walkthrough]");
  const parts = [...stage.querySelectorAll("[data-enc-layer]")];
  const inspectors = [...stage.querySelectorAll("[data-enc-inspector]")];
  const modes = [...stage.querySelectorAll("[data-enc-mode]")];
  const previous = stage.querySelector("[data-enc-prev]");
  const next = stage.querySelector("[data-enc-next]");
  let mode = "send";
  let step = 0;

  function inspect(key) {
    for (const part of parts) {
      part.setAttribute("aria-pressed", String(part.dataset.encLayer === key));
    }
    for (const inspector of inspectors) {
      inspector.hidden = inspector.dataset.encInspector !== key;
    }
  }

  function renderStage() {
    const steps = walkthrough[mode];
    const [title, explanation, level, field] = steps[step];
    const receiving = mode === "receive";
    const label = receiving ? "Servidor" : "Cliente";
    stage.querySelector("[data-enc-step-position]").textContent = `${label} · ${step + 1}/${steps.length}`;
    stage.querySelector("[data-enc-step-title]").textContent = title;
    stage.querySelector("[data-enc-step-copy]").textContent = explanation;
    stage.querySelector("[data-enc-side]").textContent = receiving ? "Servidor · enlace B" : "Cliente · enlace A";
    stage.querySelector("[data-enc-macs]").textContent = receiving
      ? "02:00:00:00:02:01 → 02:00:00:00:02:20"
      : "02:00:00:00:01:10 → 02:00:00:00:01:01";
    stage.querySelector("[data-enc-ttl]").textContent = receiving ? "63" : "64";
    stage.querySelector("[data-enc-signal]").hidden = level !== 4;
    for (const button of modes) {
      button.setAttribute("aria-pressed", String(button.dataset.encMode === mode));
    }
    for (const part of parts) part.hidden = Number(part.dataset.minLevel) > level;
    previous.disabled = step <= 0;
    next.disabled = step >= steps.length - 1;
    inspect(field);
  }

  for (const part of parts) part.addEventListener("click", () => inspect(part.dataset.encLayer));
  for (const button of modes) button.addEventListener("click", () => {
    if (mode === button.dataset.encMode) return;
    mode = button.dataset.encMode;
    step = 0;
    renderStage();
  });
  previous.addEventListener("click", () => {
    step -= 1;
    renderStage();
    if (previous.disabled) next.focus();
  });
  next.addEventListener("click", () => {
    step += 1;
    renderStage();
    if (next.disabled) previous.focus();
  });
  renderStage();

  const journey = lesson.querySelector("[data-enc-path]");
  const points = [...journey.querySelectorAll("[data-path-point]")];
  const previousPoint = journey.querySelector("[data-path-prev]");
  const nextPoint = journey.querySelector("[data-path-next]");
  let position = 0;

  function renderPath(index) {
    position = index;
    const [point, , explanation, side] = path[index];
    journey.querySelector("[data-path-position]").textContent = `${point} · ${index + 1}/${path.length}`;
    journey.querySelector("[data-path-copy]").textContent = explanation;
    journey.querySelector("[data-enc-comparison]").dataset.side = side;
    for (const button of points) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.pathPoint) === index));
    }
    previousPoint.disabled = index <= 0;
    nextPoint.disabled = index >= path.length - 1;
  }

  for (const point of points) point.addEventListener("click", () => renderPath(Number(point.dataset.pathPoint)));
  previousPoint.addEventListener("click", () => {
    renderPath(position - 1);
    if (previousPoint.disabled) nextPoint.focus();
  });
  nextPoint.addEventListener("click", () => {
    renderPath(position + 1);
    if (nextPoint.disabled) previousPoint.focus();
  });
})();
