"use strict";
const lessonSidebar = document.querySelector(".lesson-trail-sidebar");
const currentLessonLink = lessonSidebar?.querySelector('[aria-current="page"]');
if (currentLessonLink && lessonSidebar.scrollHeight > lessonSidebar.clientHeight) {
  const top = currentLessonLink.getBoundingClientRect().top - lessonSidebar.getBoundingClientRect().top;
  if (top + currentLessonLink.offsetHeight > lessonSidebar.clientHeight) {
    lessonSidebar.scrollTop = top - lessonSidebar.clientHeight / 3;
  }
}

// The existing engine may generate or change the seed after initial rendering.
document.querySelectorAll("[data-exercise-context-link]").forEach(link => {
  link.href = window.location.href;
  link.addEventListener("click", () => { link.href = window.location.href; });
});
