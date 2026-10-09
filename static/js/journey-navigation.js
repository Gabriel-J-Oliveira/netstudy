"use strict";
// The existing engine may generate or change the seed after initial rendering.
document.querySelectorAll("[data-exercise-context-link]").forEach(link => {
  link.href = window.location.href;
  link.addEventListener("click", () => { link.href = window.location.href; });
});
