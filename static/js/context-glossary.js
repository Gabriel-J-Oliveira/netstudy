(() => {
  "use strict";
  const triggers = [...document.querySelectorAll("[data-context-glossary]")];
  let active = null;
  function tip(trigger) { return document.getElementById(trigger.getAttribute("aria-controls")); }
  function close(trigger) {
    if (!trigger) return;
    trigger.setAttribute("aria-expanded", "false");
    const popover = tip(trigger);
    if (popover) popover.hidden = true;
    if (active === trigger) active = null;
  }
  function position(trigger, popover) {
    const rect = trigger.getBoundingClientRect();
    const padding = 8;
    popover.style.width = `${Math.min(352, window.innerWidth - 2 * padding)}px`;
    popover.style.left = `${padding}px`;
    popover.style.top = `${padding}px`;
    const bounds = popover.getBoundingClientRect();
    popover.style.left = `${Math.max(padding, Math.min(rect.left, window.innerWidth - bounds.width - padding))}px`;
    const above = rect.top - bounds.height - padding;
    const top = above >= padding ? above : Math.min(rect.bottom + padding, window.innerHeight - bounds.height - padding);
    popover.style.top = `${Math.max(padding, top)}px`;
  }
  function open(trigger) {
    if (active && active !== trigger) close(active);
    const popover = tip(trigger);
    if (!popover) return;
    trigger.setAttribute("aria-expanded", "true");
    popover.hidden = false;
    active = trigger;
    position(trigger, popover);
  }
  triggers.forEach((trigger) => {
    trigger.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") open(trigger); });
    trigger.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse" && !trigger.matches(":focus")) close(trigger); });
    trigger.addEventListener("focus", () => { if (!trigger.dataset.contextTouch) open(trigger); });
    trigger.addEventListener("blur", () => close(trigger));
    trigger.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      trigger.dataset.contextTouch = true;
      if (active === trigger) close(trigger);
      else open(trigger);
    });
    trigger.addEventListener("click", () => {
      if (trigger.dataset.contextTouch) { delete trigger.dataset.contextTouch; return; }
      open(trigger);
    });
  });
  document.addEventListener("pointerdown", (event) => {
    if (active && !event.target.closest("[data-context-glossary], .context-glossary [role='tooltip']")) close(active);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && active) { const trigger = active; close(trigger); trigger.focus(); event.stopPropagation(); }
  });
  window.addEventListener("resize", () => { if (active) position(active, tip(active)); });
  window.addEventListener("scroll", () => { if (active) position(active, tip(active)); }, true);
})();
