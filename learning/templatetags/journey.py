from urllib.parse import urlencode

from django import template
from django.urls import reverse

from learning.curriculum import LESSONS, LESSONS_BY_KEY

register = template.Library()


def lesson_link(lesson):
    return {
        "key": lesson.key,
        "number": f"{LESSONS.index(lesson) + 1:02}",
        "title": lesson.title,
        "url": reverse("learning:" + lesson.route),
        "objective": lesson.objective,
        "section": lesson.section,
    }


def checkpoint_progress(request, lesson):
    # Inter-VLAN predates the convention of deriving the key from the anchor.
    key = "iv_checkpoint" if lesson.key == "INTERVLAN" else lesson.checkpoint.replace("-", "_")
    state = request.session.get(key)
    if state and state.get("complete"):
        return "Checkpoint concluído"
    if state:
        return "Checkpoint em andamento"
    return ""


def neighbors(lesson):
    index = LESSONS.index(lesson)
    return {
        "previous": lesson_link(LESSONS[index - 1]) if index else None,
        "next": lesson_link(LESSONS[index + 1]) if index + 1 < len(LESSONS) else None,
    }


def trail(request, active=None):
    entries = [dict(lesson_link(lesson), active=lesson == active,
                    progress=checkpoint_progress(request, lesson)) for lesson in LESSONS]
    if active:
        recommendation = neighbors(active)["next"]
    else:
        recommendation = next((entry for entry in entries if entry["progress"] != "Checkpoint concluído"), None)
    for entry in entries:
        entry["recommended"] = bool(recommendation and entry["key"] == recommendation["key"])
    previous_section = ""
    for entry in entries:
        entry["section_heading"] = entry["section"] if entry["section"] != previous_section else ""
        previous_section = entry["section"]
    return {"entries": entries, "recommendation": recommendation}


def current_lesson(context):
    lesson = LESSONS_BY_KEY.get(context.get("current_topic"))
    name = context["request"].resolver_match.url_name
    return lesson if lesson and lesson.route == name else None


@register.inclusion_tag("learning/partials/lesson_trail.html", takes_context=True)
def lesson_trail(context):
    return trail(context["request"])


@register.inclusion_tag("learning/partials/lesson_intro.html", takes_context=True)
def lesson_intro(context):
    lesson = current_lesson(context)
    if not lesson:
        return {}
    return {
        "lesson": lesson_link(lesson),
        "total": len(LESSONS),
        "introduction": lesson.introduction,
        "prerequisites": [lesson_link(LESSONS_BY_KEY[key]) for key in lesson.prerequisites],
    }


@register.inclusion_tag("learning/partials/lesson_transition.html", takes_context=True)
def lesson_transition(context, key=None, shortcut=False):
    lesson = LESSONS_BY_KEY[key] if key else current_lesson(context)
    return {"bridge": lesson.bridge, "shortcut": shortcut, **neighbors(lesson)} if lesson else {}


@register.inclusion_tag("learning/partials/journey_navigation.html", takes_context=True)
def journey_navigation(context):
    request = context["request"]
    name = request.resolver_match.url_name
    lesson = current_lesson(context)
    area = "learn"
    if name == "home":
        area = "home"
    elif name in (
        "practice", "troubleshooting", "external_labs_catalog", "external_lab_detail", "l2_02_practice",
        "activity", "completion", "mac_activity", "mac_completion", "mac_activities",
        "rapid_fire_intro", "rapid_fire_item", "rapid_fire_completion",
    ):
        area = "practice"
    elif name == "integrated_lab":
        area = "practice" if request.GET.get("exercise") else "lab"
    result = {"area": area}
    if area == "learn":
        result.update(trail(request, lesson))
    if lesson:
        result.update(neighbors(lesson))
        result["lesson"] = lesson.title
        result["checkpoint_url"] = reverse("learning:" + lesson.route) + "#" + lesson.checkpoint
        result["exercise_url"] = reverse("learning:integrated_lab") + "?" + urlencode({
            "exercise": lesson.exercise, "difficulty": "intermediate", "mode": "bench",
        })
    if name == "integrated_lab" and request.GET.get("exercise"):
        result["exercise_context"] = reverse("learning:integrated_lab") + "?" + urlencode({
            key: request.GET[key] for key in ("exercise", "difficulty", "mode", "seed") if key in request.GET
        })
    return result
