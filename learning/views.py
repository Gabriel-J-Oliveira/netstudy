import json
from pathlib import Path

from django.conf import settings
from django.http import Http404, JsonResponse
from django.shortcuts import redirect, render
from django.template.loader import render_to_string
from django.urls import reverse
from django.views.decorators.http import require_POST

from .content import RAPID_FIRE
from .exercises import ACTIVITIES, ACTIVITY_MAP, CAPABILITIES, MISCONCEPTION_LABELS, STAGES
from .mac_exercises import (
    ACTIVITIES as MAC_ACTIVITIES,
    ACTIVITY_MAP as MAC_ACTIVITY_MAP,
    CAPABILITIES as MAC_CAPABILITIES,
    MISCONCEPTION_LABELS as MAC_MISCONCEPTION_LABELS,
)
from .frame_checkpoint import (
    ACTIVITIES as FRAME_ACTIVITIES,
    ACTIVITY_MAP as FRAME_ACTIVITY_MAP,
    CAPABILITIES as FRAME_CAPABILITIES,
    MISCONCEPTION_LABELS as FRAME_MISCONCEPTION_LABELS,
)
from .arp_checkpoint import (
    ACTIVITIES as ARP_CHECKPOINT_ACTIVITIES,
    ACTIVITY_MAP as ARP_CHECKPOINT_ACTIVITY_MAP,
    CAPABILITIES as ARP_CHECKPOINT_CAPABILITIES,
    MISCONCEPTION_LABELS as ARP_CHECKPOINT_MISCONCEPTION_LABELS,
)
from .mac_checkpoint import (
    ACTIVITIES as MAC_CHECKPOINT_ACTIVITIES,
    ACTIVITY_MAP as MAC_CHECKPOINT_ACTIVITY_MAP,
    CAPABILITIES as MAC_CHECKPOINT_CAPABILITIES,
    MISCONCEPTION_LABELS as MAC_CHECKPOINT_MISCONCEPTION_LABELS,
)
from .switch_checkpoint import (
    ACTIVITIES as SWITCH_ACTIVITIES,
    ACTIVITY_MAP as SWITCH_ACTIVITY_MAP,
    CAPABILITIES as SWITCH_CAPABILITIES,
    MISCONCEPTION_LABELS as SWITCH_MISCONCEPTION_LABELS,
)
from .delivery_checkpoint import (
    ACTIVITIES as DELIVERY_ACTIVITIES,
    ACTIVITY_MAP as DELIVERY_ACTIVITY_MAP,
    CAPABILITIES as DELIVERY_CAPABILITIES,
    MISCONCEPTION_LABELS as DELIVERY_MISCONCEPTION_LABELS,
)
from .vlan_checkpoint import (
    ACTIVITIES as VLAN_ACTIVITIES,
    ACTIVITY_MAP as VLAN_ACTIVITY_MAP,
    CAPABILITIES as VLAN_CAPABILITIES,
    MISCONCEPTION_LABELS as VLAN_MISCONCEPTION_LABELS,
)
from .trunk_checkpoint import (
    ACTIVITIES as TRUNK_ACTIVITIES,
    ACTIVITY_MAP as TRUNK_ACTIVITY_MAP,
    CAPABILITIES as TRUNK_CAPABILITIES,
    MISCONCEPTION_LABELS as TRUNK_MISCONCEPTION_LABELS,
)
from .ipv4_checkpoint import (
    ACTIVITIES as IPV4_ACTIVITIES,
    ACTIVITY_MAP as IPV4_ACTIVITY_MAP,
    CAPABILITIES as IPV4_CAPABILITIES,
    MISCONCEPTION_LABELS as IPV4_MISCONCEPTION_LABELS,
)
from .gateway_checkpoint import (
    ACTIVITIES as GATEWAY_ACTIVITIES,
    ACTIVITY_MAP as GATEWAY_ACTIVITY_MAP,
    CAPABILITIES as GATEWAY_CAPABILITIES,
    MISCONCEPTION_LABELS as GATEWAY_MISCONCEPTION_LABELS,
)
from .route_checkpoint import (
    ACTIVITIES as ROUTE_ACTIVITIES,
    ACTIVITY_MAP as ROUTE_ACTIVITY_MAP,
    CAPABILITIES as ROUTE_CAPABILITIES,
    MISCONCEPTION_LABELS as ROUTE_MISCONCEPTION_LABELS,
)
from .inter_vlan_checkpoint import ACTIVITIES as IV_ACTIVITIES, ACTIVITY_MAP as IV_ACTIVITY_MAP, CAPABILITIES as IV_CAPABILITIES, MISCONCEPTION_LABELS as IV_MISCONCEPTION_LABELS
from .icmp_checkpoint import ACTIVITIES as ICMP_ACTIVITIES, ACTIVITY_MAP as ICMP_ACTIVITY_MAP, CAPABILITIES as ICMP_CAPABILITIES, MISCONCEPTION_LABELS as ICMP_MISCONCEPTION_LABELS
from .transport_checkpoint import ACTIVITIES as TRANSPORT_ACTIVITIES, ACTIVITY_MAP as TRANSPORT_ACTIVITY_MAP, CAPABILITIES as TRANSPORT_CAPABILITIES, MISCONCEPTION_LABELS as TRANSPORT_MISCONCEPTION_LABELS


def _new_progress():
    return {"current_stage": None, "completed_stages": [], "answers": {}}


def _progress(request):
    return request.session.setdefault("arp_progress", _new_progress())


def _context(request, **extra):
    progress = _progress(request)
    status = []
    for key, label in STAGES:
        if key in progress["completed_stages"]:
            state = "completed"
        elif key == progress["current_stage"]:
            state = "current"
        else:
            state = "pending"
        status.append({"key": key, "label": label, "state": state})
    return {"stage_status": status, "progress": progress, "current_topic": "ARP", **extra}


def _initial_answer():
    return {
        "attempt_count": 0, "attempts": 0, "incorrect_actions": [], "wrong_answers": [],
        "misconception_codes": [], "correct": False, "complete": False,
    }


def _increment_attempt(stored):
    stored["attempt_count"] += 1
    stored["attempts"] = stored["attempt_count"]


def _record_correct(stored, feedback, payload):
    _increment_attempt(stored)
    result_type = "immediate" if stored["attempt_count"] == 1 else "guided"
    stored.update({
        "correct": True, "complete": True, "result_type": result_type, "outcome": result_type,
        "last_feedback": feedback, "last_payload": payload,
    })
    return stored


def _record_wrong(stored, feedback, payload, misconception=None, wrong_positions=None):
    _increment_attempt(stored)
    stored["incorrect_actions"].append(payload)
    stored["last_payload"] = payload
    stored["last_feedback"] = feedback
    if isinstance(payload, str) and payload not in stored["wrong_answers"]:
        stored["wrong_answers"].append(payload)
    if misconception and misconception not in stored["misconception_codes"]:
        stored["misconception_codes"].append(misconception)
    if wrong_positions is not None:
        stored["wrong_positions"] = wrong_positions
    return stored


def _all_options(item):
    if item.get("options"):
        return item["options"]
    if item.get("after_rows"):
        return item["after_rows"]
    if item.get("capture_fields"):
        return item["capture_fields"]
    return [option for row in item.get("terminal_rows", []) for option in row]


def _submit_discrete(item, stored, selected):
    options = {option["key"]: option for option in _all_options(item)}
    if selected not in options:
        return stored, "Selecione um elemento antes de verificar."
    if selected in stored["wrong_answers"]:
        return stored, "Essa resposta já foi descartada. Escolha outro elemento."
    chosen = options[selected]
    if selected == item["correct"]:
        return _record_correct(stored, chosen["feedback"], selected), None
    return _record_wrong(stored, chosen["feedback"], selected, chosen.get("misconception_code")), None


def _submit_text(item, stored, raw_value):
    value = raw_value.strip().lower()
    if not value:
        return stored, "Preencha o campo antes de verificar."
    if value in stored["wrong_answers"]:
        return stored, "Essa resposta já foi descartada. Tente outro valor."
    correct = item["correct"].strip().lower()
    if value == correct:
        return _record_correct(stored, item["correct_feedback"], value), None
    feedback = item.get("feedback", {}).get(value, item.get("feedback", {}).get("other", "TODO: feedback pedagógico não fornecido para esta resposta."))
    return _record_wrong(stored, feedback, value), None


def _submit_multi_text(item, stored, post_data):
    payload = {field["name"]: post_data.get(field["name"], "").strip().lower() for field in item["fields"]}
    if any(not value for value in payload.values()):
        return stored, "Preencha os dois campos antes de verificar."
    if payload in stored["incorrect_actions"]:
        return stored, "Essa combinação já foi descartada. Revise os dois campos."
    correct = {name: value.lower() for name, value in item["correct_fields"].items()}
    if payload == correct:
        return _record_correct(stored, item["correct_feedback"], payload), None
    feedback = None
    for name, value in payload.items():
        if value != correct[name]:
            feedback = item.get("feedback_fields", {}).get(f"{name}:{value}")
            if feedback:
                break
    return _record_wrong(stored, feedback or item["wrong_feedback"], payload), None


def _decode_payload(raw, expected_type):
    try:
        value = json.loads(raw)
    except (TypeError, ValueError):
        return None
    return value if isinstance(value, expected_type) else None


def _mapping_feedback(item, payload):
    correct = item["correct_map"]
    for token, slot in payload.items():
        if correct.get(token) != slot:
            feedback = item.get("feedback_by_token_slot", {}).get(f"{token}:{slot}")
            if feedback:
                return feedback, item.get("misconceptions", {}).get(token)
            feedback = item.get("feedback", {}).get(token)
            if feedback:
                return feedback, item.get("misconceptions", {}).get(token)
            feedback = item.get("feedback_by_slot", {}).get(slot)
            if feedback:
                return feedback, item.get("misconceptions", {}).get(token)
            return item.get("wrong_feedback", "TODO: feedback pedagógico não fornecido para este encaixe."), item.get("misconceptions", {}).get(token)
    return item.get("wrong_feedback", "TODO: feedback pedagógico não fornecido para esta composição incompleta."), None


def _submit_mapping(item, stored, raw_payload):
    payload = _decode_payload(raw_payload, dict)
    if not payload:
        return stored, "Posicione os elementos antes de verificar."
    correct = item["correct_map"]
    unordered_correct = item.get("unordered") and set(payload) == set(item["correct_tokens"]) and len(set(payload.values())) == len(item["correct_tokens"])
    if payload == correct or unordered_correct:
        return _record_correct(stored, item["correct_feedback"], payload), None
    feedback, misconception = _mapping_feedback(item, payload)
    if item.get("unordered"):
        wrong_token = next((token for token in payload if token not in item["correct_tokens"]), None)
    else:
        wrong_token = next((token for token, slot in payload.items() if correct.get(token) != slot), None)
    stored = _record_wrong(stored, feedback, payload, misconception)
    stored["last_error_token"] = wrong_token
    if wrong_token:
        stored.setdefault("error_tokens", [])
        if wrong_token not in stored["error_tokens"]:
            stored["error_tokens"].append(wrong_token)
    return stored, None


def _submit_ordering(item, stored, raw_payload):
    payload = _decode_payload(raw_payload, list)
    if not payload or len(payload) != len(item["correct_order"]):
        return stored, "Organize todos os eventos antes de verificar."
    if payload == item["correct_order"]:
        return _record_correct(stored, item["correct_feedback"], payload), None
    wrong_positions = [index + 1 for index, value in enumerate(payload) if value != item["correct_order"][index]]
    stored = _record_wrong(
        stored, item["wrong_feedback"], payload,
        misconception=item.get("wrong_order_misconception"), wrong_positions=wrong_positions,
    )
    return stored, None


def _submit_event_order(item, stored, raw_payload):
    payload = _decode_payload(raw_payload, list)
    if not payload or len(payload) < len(item["correct_order"]):
        return stored, "Selecione e ordene os eventos necessários antes de verificar."
    if payload == item["correct_order"]:
        return _record_correct(stored, item["correct_feedback"], payload), None
    offending = next((event for event in payload if item.get("feedback", {}).get(event)), None)
    feedback = item.get("feedback", {}).get(offending, item.get("wrong_feedback", "Revise a sequência selecionada."))
    misconception = item.get("misconceptions_by_event", {}).get(offending)
    return _record_wrong(stored, feedback, payload, misconception), None


def home(request):
    return render(request, "learning/home.html", _context(request, current_topic=None))


def start_session(request):
    request.session["arp_progress"] = {"current_stage": "conceito", "completed_stages": [], "answers": {}}
    return redirect("learning:concept")


def concept(request):
    progress = _progress(request)
    progress["current_stage"] = "conceito"
    image_root = Path(settings.BASE_DIR) / "static/images/concepts/arp"
    image_slots = {
        "basic": (image_root / "arp-basic-flow.png").exists(),
        "request": (image_root / "arp-request-broadcast.png").exists(),
        "cache": (image_root / "arp-cache-before-after.png").exists(),
        "local_remote": (image_root / "arp-local-vs-remote.png").exists(),
    }
    request.session.modified = True
    return render(request, "learning/concept.html", _context(
        request, image_slots=image_slots, **_arp_checkpoint_context(request),
    ))


def _arp_checkpoint_context(request):
    checkpoint = request.session.get("arp_checkpoint")
    context = {"arp_checkpoint_started": bool(checkpoint)}
    if not checkpoint:
        return context
    answers = checkpoint.get("answers", {})
    if checkpoint.get("complete"):
        result_types = [answer.get("result_type") for answer in answers.values()]
        codes = []
        for answer in answers.values():
            for code in answer.get("misconception_codes", []):
                if code not in codes:
                    codes.append(code)
        context.update({
            "arp_checkpoint_complete": True,
            "arp_checkpoint_immediate": result_types.count("immediate"),
            "arp_checkpoint_guided": result_types.count("guided"),
            "arp_checkpoint_capabilities": ARP_CHECKPOINT_CAPABILITIES,
            "arp_checkpoint_misconceptions": [ARP_CHECKPOINT_MISCONCEPTION_LABELS[code] for code in codes if code in ARP_CHECKPOINT_MISCONCEPTION_LABELS],
        })
    else:
        item = ARP_CHECKPOINT_ACTIVITY_MAP[str(checkpoint.get("current", 1))]
        stored = answers.get(item["id"])
        context.update({
            "arp_checkpoint_activity": item,
            "arp_checkpoint_result": stored,
            "arp_checkpoint_total": len(ARP_CHECKPOINT_ACTIVITIES),
            "arp_checkpoint_show_hint": bool(stored and stored.get("attempt_count", 0) >= 2 and not stored.get("complete") and item.get("hint")),
            "arp_checkpoint_builder_initial": stored.get("last_payload", {}) if stored and stored.get("complete") else {},
        })
    return context


def _arp_checkpoint_response(request):
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        context = _arp_checkpoint_context(request)
        html = render_to_string("learning/partials/arp_checkpoint.html", context, request=request)
        checkpoint = request.session.get("arp_checkpoint", {})
        current = checkpoint.get("current")
        stored = checkpoint.get("answers", {}).get(str(current), {}) if current else {}
        return JsonResponse({"html": html, "complete": bool(checkpoint.get("complete")), "correct": bool(stored.get("complete")), "guided": stored.get("result_type") == "guided", "feedback": stored.get("last_feedback", stored.get("ui_error", "")), "next_available": bool(stored.get("complete"))})
    return redirect(f"{reverse('learning:concept')}#arp-checkpoint")


@require_POST
def arp_checkpoint_start(request):
    request.session["arp_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _arp_checkpoint_response(request)


@require_POST
def arp_checkpoint_answer(request):
    checkpoint = request.session.get("arp_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _arp_checkpoint_response(request)
    item = ARP_CHECKPOINT_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"])
    if stored and stored.get("complete") and item["id"] == "10" and "reveal_reference" in request.POST:
        stored["free_text"] = request.POST.get("free_text", "")
        stored["reference_revealed"] = True
    elif not (stored and stored.get("complete")):
        stored = stored or _initial_answer()
        if item["type"] in {"terminal_analysis", "find_inconsistency"}:
            stored, error = _submit_discrete(item, stored, request.POST.get("answer"))
        elif item["type"] in {"process_builder", "event_selection"}:
            stored, error = _submit_event_order(item, stored, request.POST.get("answer_payload"))
        else:
            stored, error = _submit_mapping(item, stored, request.POST.get("answer_payload"))
        if error:
            stored["ui_error"] = error
        if stored.get("complete"):
            stored.pop("ui_error", None)
        checkpoint["answers"][item["id"]] = stored
    request.session.modified = True
    return _arp_checkpoint_response(request)


@require_POST
def arp_checkpoint_next(request):
    checkpoint = request.session.get("arp_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _arp_checkpoint_response(request)
    item = ARP_CHECKPOINT_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"], {})
    if not stored.get("complete") or (item["id"] == "10" and not stored.get("reference_revealed")):
        return _arp_checkpoint_response(request)
    if checkpoint["current"] == len(ARP_CHECKPOINT_ACTIVITIES):
        checkpoint["complete"] = True
    else:
        checkpoint["current"] += 1
    request.session.modified = True
    return _arp_checkpoint_response(request)


@require_POST
def arp_checkpoint_restart(request):
    request.session["arp_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _arp_checkpoint_response(request)


def mac_concept(request):
    image_root = Path(settings.BASE_DIR) / "static/images/concepts/mac"
    image_slots = {
        "source_destination": (image_root / "mac-source-destination.png").exists(),
        "local_gateway": (image_root / "mac-local-vs-gateway.png").exists(),
        "arp_to_frame": (image_root / "mac-arp-to-frame.png").exists(),
    }
    return render(request, "learning/mac_concept.html", _context(
        request, current_topic="MAC", image_slots=image_slots, **_mac_checkpoint_context(request),
    ))


def _mac_checkpoint_context(request):
    checkpoint = request.session.get("mac_checkpoint")
    context = {"mac_checkpoint_started": bool(checkpoint)}
    if not checkpoint:
        return context
    answers = checkpoint.get("answers", {})
    if checkpoint.get("complete"):
        result_types = [answer.get("result_type") for answer in answers.values()]
        codes = []
        for answer in answers.values():
            for code in answer.get("misconception_codes", []):
                if code not in codes:
                    codes.append(code)
        context.update({
            "mac_checkpoint_complete": True,
            "mac_checkpoint_immediate": result_types.count("immediate"),
            "mac_checkpoint_guided": result_types.count("guided"),
            "mac_checkpoint_capabilities": MAC_CHECKPOINT_CAPABILITIES,
            "mac_checkpoint_misconceptions": [MAC_CHECKPOINT_MISCONCEPTION_LABELS[code] for code in codes if code in MAC_CHECKPOINT_MISCONCEPTION_LABELS],
        })
    else:
        item = MAC_CHECKPOINT_ACTIVITY_MAP[str(checkpoint.get("current", 1))]
        stored = answers.get(item["id"])
        context.update({
            "mac_checkpoint_activity": item,
            "mac_checkpoint_result": stored,
            "mac_checkpoint_total": len(MAC_CHECKPOINT_ACTIVITIES),
            "mac_checkpoint_show_hint": bool(stored and stored.get("attempt_count", 0) >= 2 and not stored.get("complete") and item.get("hint")),
            "mac_checkpoint_builder_initial": stored.get("last_payload", {}) if stored and stored.get("complete") else {},
        })
    return context


def _mac_checkpoint_response(request):
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        context = _mac_checkpoint_context(request)
        html = render_to_string("learning/partials/mac_checkpoint.html", context, request=request)
        checkpoint = request.session.get("mac_checkpoint", {})
        current = checkpoint.get("current")
        stored = checkpoint.get("answers", {}).get(str(current), {}) if current else {}
        return JsonResponse({
            "html": html,
            "complete": bool(checkpoint.get("complete")),
            "correct": bool(stored.get("complete")),
            "guided": stored.get("result_type") == "guided",
            "feedback": stored.get("last_feedback", stored.get("ui_error", "")),
            "next_available": bool(stored.get("complete")),
        })
    return redirect(f"{reverse('learning:mac_concept')}#mac-checkpoint")


@require_POST
def mac_checkpoint_start(request):
    request.session["mac_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _mac_checkpoint_response(request)


@require_POST
def mac_checkpoint_answer(request):
    checkpoint = request.session.get("mac_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _mac_checkpoint_response(request)
    item = MAC_CHECKPOINT_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"])

    if stored and stored.get("complete") and item["id"] == "10" and "reveal_reference" in request.POST:
        stored["free_text"] = request.POST.get("free_text", "")
        stored["reference_revealed"] = True
    elif not (stored and stored.get("complete")):
        stored = stored or _initial_answer()
        if item["type"] == "capture_analysis":
            if stored.get("phase") == "evidence":
                selected = request.POST.getlist("evidence")
                if len(selected) != 2:
                    stored["ui_error"] = "Selecione duas evidências antes de verificar."
                elif set(selected) == set(item["correct_evidence"]):
                    stored.pop("ui_error", None)
                    stored = _record_correct(stored, item["correct_feedback"], selected)
                else:
                    stored.pop("ui_error", None)
                    stored = _record_wrong(stored, item["wrong_feedback"], selected)
            else:
                stored, error = _submit_discrete(item, stored, request.POST.get("answer"))
                if error:
                    stored["ui_error"] = error
                elif stored.get("complete"):
                    stored["complete"] = False
                    stored["correct"] = False
                    stored.pop("result_type", None)
                    stored.pop("outcome", None)
                    stored["attempt_count"] -= 1
                    stored["attempts"] = stored["attempt_count"]
                    stored["phase"] = "evidence"
                    stored["last_feedback"] = "A combinação é coerente. Agora selecione as duas evidências."
        elif item["type"] in {"terminal_analysis", "find_inconsistency"}:
            stored, error = _submit_discrete(item, stored, request.POST.get("answer"))
            if error:
                stored["ui_error"] = error
        else:
            stored, error = _submit_mapping(item, stored, request.POST.get("answer_payload"))
            if error:
                stored["ui_error"] = error
        if stored.get("complete"):
            stored.pop("ui_error", None)
        checkpoint["answers"][item["id"]] = stored
    request.session.modified = True
    return _mac_checkpoint_response(request)


@require_POST
def mac_checkpoint_next(request):
    checkpoint = request.session.get("mac_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _mac_checkpoint_response(request)
    item = MAC_CHECKPOINT_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"], {})
    if not stored.get("complete") or (item["id"] == "10" and not stored.get("reference_revealed")):
        return _mac_checkpoint_response(request)
    if checkpoint["current"] == len(MAC_CHECKPOINT_ACTIVITIES):
        checkpoint["complete"] = True
    else:
        checkpoint["current"] += 1
    request.session.modified = True
    return _mac_checkpoint_response(request)


@require_POST
def mac_checkpoint_restart(request):
    request.session["mac_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _mac_checkpoint_response(request)


def frame_concept(request):
    image_root = Path(settings.BASE_DIR) / "static/images/concepts/frame"
    image_slots = {
        "basic_structure": (image_root / "frame-basic-structure.png").exists(),
        "data_encapsulation": (image_root / "frame-data-encapsulation.png").exists(),
        "local_remote": (image_root / "frame-local-vs-remote.png").exists(),
    }
    checkpoint_context = _frame_checkpoint_context(request)
    return render(request, "learning/frame_concept.html", _context(
        request, current_topic="FRAME", image_slots=image_slots, **checkpoint_context,
    ))


def _frame_checkpoint_context(request):
    checkpoint = request.session.get("frame_checkpoint")
    checkpoint_context = {"checkpoint_started": bool(checkpoint)}
    if checkpoint:
        answers = checkpoint.get("answers", {})
        if checkpoint.get("complete"):
            result_types = [answer.get("result_type") for answer in answers.values()]
            codes = []
            for answer in answers.values():
                for code in answer.get("misconception_codes", []):
                    if code not in codes:
                        codes.append(code)
            checkpoint_context.update({
                "checkpoint_complete": True,
                "checkpoint_immediate": result_types.count("immediate"),
                "checkpoint_guided": result_types.count("guided"),
                "checkpoint_capabilities": FRAME_CAPABILITIES,
                "checkpoint_misconceptions": [FRAME_MISCONCEPTION_LABELS[code] for code in codes if code in FRAME_MISCONCEPTION_LABELS],
            })
        else:
            item = FRAME_ACTIVITY_MAP[str(checkpoint.get("current", 1))]
            stored = answers.get(item["id"])
            display_order = stored.get("last_payload", item.get("events", [])) if stored else item.get("events", [])
            checkpoint_context.update({
                "checkpoint_activity": item,
                "checkpoint_result": stored,
                "checkpoint_total": len(FRAME_ACTIVITIES),
                "checkpoint_show_hint": bool(stored and stored.get("attempt_count", 0) >= 2 and not stored.get("complete") and item.get("hint")),
                "checkpoint_display_order": display_order,
                "checkpoint_builder_initial": stored.get("last_payload", {}) if stored and stored.get("complete") else {},
            })
    return checkpoint_context


def _frame_checkpoint_redirect():
    return redirect(f"{reverse('learning:frame_concept')}#frame-checkpoint")


def _frame_checkpoint_response(request):
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        context = _frame_checkpoint_context(request)
        html = render_to_string("learning/partials/frame_checkpoint.html", context, request=request)
        checkpoint = request.session.get("frame_checkpoint", {})
        current = checkpoint.get("current")
        stored = checkpoint.get("answers", {}).get(str(current), {}) if current else {}
        return JsonResponse({
            "html": html,
            "complete": bool(checkpoint.get("complete")),
            "correct": bool(stored.get("complete")),
            "guided": stored.get("result_type") == "guided",
            "feedback": stored.get("last_feedback", stored.get("ui_error", "")),
            "next_available": bool(stored.get("complete")),
        })
    return _frame_checkpoint_redirect()


@require_POST
def frame_checkpoint_start(request):
    request.session["frame_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _frame_checkpoint_response(request)


@require_POST
def frame_checkpoint_answer(request):
    checkpoint = request.session.get("frame_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _frame_checkpoint_response(request)
    item = FRAME_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"])

    if stored and stored.get("complete") and item["id"] == "10" and "reveal_reference" in request.POST:
        stored["free_text"] = request.POST.get("free_text", "")
        stored["reference_revealed"] = True
    elif not (stored and stored.get("complete")):
        stored = stored or _initial_answer()
        if item["type"] == "capture_analysis":
            if stored.get("phase") == "evidence":
                selected = request.POST.getlist("evidence")
                if len(selected) != 2:
                    stored["ui_error"] = "Selecione duas evidências antes de verificar."
                elif set(selected) == set(item["correct_evidence"]):
                    stored.pop("ui_error", None)
                    stored = _record_correct(stored, item["correct_feedback"], selected)
                else:
                    stored.pop("ui_error", None)
                    stored = _record_wrong(stored, item["wrong_feedback"], selected)
            else:
                stored, error = _submit_discrete(item, stored, request.POST.get("answer"))
                if error:
                    stored["ui_error"] = error
                elif stored.get("complete"):
                    stored["complete"] = False
                    stored["correct"] = False
                    stored.pop("result_type", None)
                    stored.pop("outcome", None)
                    stored["attempt_count"] -= 1
                    stored["attempts"] = stored["attempt_count"]
                    stored["phase"] = "evidence"
                    stored["last_feedback"] = "A combinação é coerente. Agora selecione as duas evidências."
        elif item["type"] == "find_inconsistency":
            stored, error = _submit_discrete(item, stored, request.POST.get("answer"))
            if error:
                stored["ui_error"] = error
        elif item["type"] in {"frame_builder", "direction_builder", "compare_outputs_builder", "dual_builder", "evidence_sort", "diagnostic_map", "integrated_concept_map"}:
            stored, error = _submit_mapping(item, stored, request.POST.get("answer_payload"))
            if error:
                stored["ui_error"] = error
        elif item["type"] == "event_selection_order":
            stored, error = _submit_event_order(item, stored, request.POST.get("answer_payload"))
            if error:
                stored["ui_error"] = error
        if stored.get("complete"):
            stored.pop("ui_error", None)
        checkpoint["answers"][item["id"]] = stored
    request.session.modified = True
    return _frame_checkpoint_response(request)


@require_POST
def frame_checkpoint_next(request):
    checkpoint = request.session.get("frame_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _frame_checkpoint_response(request)
    item = FRAME_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"], {})
    if not stored.get("complete") or (item["id"] == "10" and not stored.get("reference_revealed")):
        return _frame_checkpoint_response(request)
    if checkpoint["current"] == len(FRAME_ACTIVITIES):
        checkpoint["complete"] = True
    else:
        checkpoint["current"] += 1
    request.session.modified = True
    return _frame_checkpoint_response(request)


@require_POST
def frame_checkpoint_restart(request):
    request.session["frame_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _frame_checkpoint_response(request)


def switch_concept(request):
    return render(request, "learning/switch_concept.html", _context(
        request, current_topic="SWITCH", **_switch_checkpoint_context(request),
    ))


def _switch_checkpoint_context(request):
    checkpoint = request.session.get("switch_checkpoint")
    context = {"switch_checkpoint_started": bool(checkpoint)}
    if not checkpoint:
        return context
    answers = checkpoint.get("answers", {})
    if checkpoint.get("complete"):
        result_types = [answer.get("result_type") for answer in answers.values()]
        codes = []
        for answer in answers.values():
            for code in answer.get("misconception_codes", []):
                if code not in codes:
                    codes.append(code)
        context.update({
            "switch_checkpoint_complete": True,
            "switch_checkpoint_immediate": result_types.count("immediate"),
            "switch_checkpoint_guided": result_types.count("guided"),
            "switch_checkpoint_capabilities": SWITCH_CAPABILITIES,
            "switch_checkpoint_misconceptions": [SWITCH_MISCONCEPTION_LABELS[code] for code in codes if code in SWITCH_MISCONCEPTION_LABELS],
        })
    else:
        item = SWITCH_ACTIVITY_MAP[str(checkpoint.get("current", 1))]
        stored = answers.get(item["id"])
        display_order = stored.get("last_payload", item.get("events", [])) if stored else item.get("events", [])
        context.update({
            "switch_checkpoint_activity": item,
            "switch_checkpoint_result": stored,
            "switch_checkpoint_total": len(SWITCH_ACTIVITIES),
            "switch_checkpoint_hint_text": item.get("hints", [])[min(stored.get("hint_level", 0), len(item.get("hints", []))) - 1] if stored and stored.get("hint_level") and item.get("hints") else None,
            "switch_checkpoint_display_order": display_order,
            "switch_checkpoint_builder_initial": stored.get("last_payload", {}) if stored and stored.get("complete") else {},
        })
    return context


def _switch_checkpoint_response(request):
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        context = _switch_checkpoint_context(request)
        html = render_to_string("learning/partials/switch_checkpoint.html", context, request=request)
        checkpoint = request.session.get("switch_checkpoint", {})
        current = checkpoint.get("current")
        stored = checkpoint.get("answers", {}).get(str(current), {}) if current else {}
        return JsonResponse({
            "html": html, "complete": bool(checkpoint.get("complete")),
            "correct": bool(stored.get("complete")), "guided": stored.get("result_type") == "guided",
            "feedback": stored.get("last_feedback", stored.get("ui_error", "")),
            "next_available": bool(stored.get("complete")),
        })
    return redirect(f"{reverse('learning:switch_concept')}#switch-checkpoint")


@require_POST
def switch_checkpoint_start(request):
    request.session["switch_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _switch_checkpoint_response(request)


@require_POST
def switch_checkpoint_answer(request):
    checkpoint = request.session.get("switch_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _switch_checkpoint_response(request)
    item = SWITCH_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"])
    if not (stored and stored.get("complete")):
        stored = stored or _initial_answer()
        if item["type"] == "port_selection":
            stored, error = _submit_discrete(item, stored, request.POST.get("answer"))
        elif item["type"] == "event_selection_order":
            stored, error = _submit_event_order(item, stored, request.POST.get("answer_payload"))
        else:
            stored, error = _submit_mapping(item, stored, request.POST.get("answer_payload"))
        if error:
            stored["ui_error"] = error
        if stored.get("complete"):
            stored.pop("ui_error", None)
            if stored.get("hint_level", 0):
                stored["result_type"] = "guided"
                stored["outcome"] = "guided"
        checkpoint["answers"][item["id"]] = stored
    request.session.modified = True
    return _switch_checkpoint_response(request)


@require_POST
def switch_checkpoint_next(request):
    checkpoint = request.session.get("switch_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _switch_checkpoint_response(request)
    item = SWITCH_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"], {})
    if not stored.get("complete"):
        return _switch_checkpoint_response(request)
    if checkpoint["current"] == len(SWITCH_ACTIVITIES):
        checkpoint["complete"] = True
    else:
        checkpoint["current"] += 1
    request.session.modified = True
    return _switch_checkpoint_response(request)


@require_POST
def switch_checkpoint_restart(request):
    request.session["switch_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _switch_checkpoint_response(request)


@require_POST
def switch_checkpoint_hint(request):
    checkpoint = request.session.get("switch_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _switch_checkpoint_response(request)
    item = SWITCH_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"]) or _initial_answer()
    stored["hint_level"] = min(stored.get("hint_level", 0) + 1, len(item.get("hints", [])))
    checkpoint["answers"][item["id"]] = stored
    request.session.modified = True
    return _switch_checkpoint_response(request)


@require_POST
def switch_checkpoint_reset_current(request):
    checkpoint = request.session.get("switch_checkpoint")
    if checkpoint and not checkpoint.get("complete"):
        checkpoint.get("answers", {}).pop(str(checkpoint["current"]), None)
        request.session.modified = True
    return _switch_checkpoint_response(request)


def delivery_concept(request):
    return render(request, "learning/delivery_concept.html", _context(
        request, current_topic="DELIVERY", **_delivery_checkpoint_context(request),
    ))


def _delivery_checkpoint_context(request):
    checkpoint = request.session.get("delivery_checkpoint")
    context = {"delivery_checkpoint_started": bool(checkpoint)}
    if not checkpoint:
        return context
    answers = checkpoint.get("answers", {})
    if checkpoint.get("complete"):
        result_types = [answer.get("result_type") for answer in answers.values()]
        codes = []
        for answer in answers.values():
            for code in answer.get("misconception_codes", []):
                if code not in codes:
                    codes.append(code)
        context.update({
            "delivery_checkpoint_complete": True,
            "delivery_checkpoint_immediate": result_types.count("immediate"),
            "delivery_checkpoint_guided": result_types.count("guided"),
            "delivery_checkpoint_capabilities": DELIVERY_CAPABILITIES,
            "delivery_checkpoint_misconceptions": [DELIVERY_MISCONCEPTION_LABELS[code] for code in codes if code in DELIVERY_MISCONCEPTION_LABELS],
        })
    else:
        item = DELIVERY_ACTIVITY_MAP[str(checkpoint.get("current", 1))]
        stored = answers.get(item["id"])
        context.update({
            "delivery_checkpoint_activity": item,
            "delivery_checkpoint_result": stored,
            "delivery_checkpoint_total": len(DELIVERY_ACTIVITIES),
            "delivery_checkpoint_hint_text": item.get("hints", [])[min(stored.get("hint_level", 0), len(item.get("hints", []))) - 1] if stored and stored.get("hint_level") and item.get("hints") else None,
            "delivery_checkpoint_builder_initial": stored.get("last_payload", {}) if stored and stored.get("complete") else {},
        })
    return context


def _delivery_checkpoint_response(request):
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        context = _delivery_checkpoint_context(request)
        html = render_to_string("learning/partials/delivery_checkpoint.html", context, request=request)
        checkpoint = request.session.get("delivery_checkpoint", {})
        current = checkpoint.get("current")
        stored = checkpoint.get("answers", {}).get(str(current), {}) if current else {}
        return JsonResponse({
            "html": html, "complete": bool(checkpoint.get("complete")),
            "correct": bool(stored.get("complete")), "guided": stored.get("result_type") == "guided",
            "feedback": stored.get("last_feedback", stored.get("ui_error", "")),
            "next_available": bool(stored.get("complete")),
        })
    return redirect(f"{reverse('learning:delivery_concept')}#delivery-checkpoint")


@require_POST
def delivery_checkpoint_start(request):
    request.session["delivery_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _delivery_checkpoint_response(request)


@require_POST
def delivery_checkpoint_answer(request):
    checkpoint = request.session.get("delivery_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _delivery_checkpoint_response(request)
    item = DELIVERY_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"])
    if not (stored and stored.get("complete")):
        stored = stored or _initial_answer()
        stored, error = _submit_mapping(item, stored, request.POST.get("answer_payload"))
        if error:
            stored["ui_error"] = error
        if not stored.get("complete") and stored.get("attempt_count", 0) >= 2 and not stored.get("hint_level"):
            stored["hint_level"] = 1
        if stored.get("complete"):
            stored.pop("ui_error", None)
            if stored.get("hint_level", 0):
                stored["result_type"] = "guided"
                stored["outcome"] = "guided"
        checkpoint["answers"][item["id"]] = stored
    request.session.modified = True
    return _delivery_checkpoint_response(request)


@require_POST
def delivery_checkpoint_next(request):
    checkpoint = request.session.get("delivery_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _delivery_checkpoint_response(request)
    item = DELIVERY_ACTIVITY_MAP[str(checkpoint["current"])]
    if not checkpoint["answers"].get(item["id"], {}).get("complete"):
        return _delivery_checkpoint_response(request)
    if checkpoint["current"] == len(DELIVERY_ACTIVITIES):
        checkpoint["complete"] = True
    else:
        checkpoint["current"] += 1
    request.session.modified = True
    return _delivery_checkpoint_response(request)


@require_POST
def delivery_checkpoint_restart(request):
    request.session["delivery_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _delivery_checkpoint_response(request)


@require_POST
def delivery_checkpoint_hint(request):
    checkpoint = request.session.get("delivery_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _delivery_checkpoint_response(request)
    item = DELIVERY_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"]) or _initial_answer()
    stored["hint_level"] = min(stored.get("hint_level", 0) + 1, len(item.get("hints", [])))
    checkpoint["answers"][item["id"]] = stored
    request.session.modified = True
    return _delivery_checkpoint_response(request)


@require_POST
def delivery_checkpoint_reset_current(request):
    checkpoint = request.session.get("delivery_checkpoint")
    if checkpoint and not checkpoint.get("complete"):
        checkpoint.get("answers", {}).pop(str(checkpoint["current"]), None)
        request.session.modified = True
    return _delivery_checkpoint_response(request)


def vlan_concept(request):
    return render(request, "learning/vlan_concept.html", _context(
        request, current_topic="VLAN", **_vlan_checkpoint_context(request),
    ))


def _vlan_checkpoint_context(request):
    checkpoint = request.session.get("vlan_checkpoint")
    context = {"vlan_checkpoint_started": bool(checkpoint)}
    if not checkpoint:
        return context
    answers = checkpoint.get("answers", {})
    if checkpoint.get("complete"):
        result_types = [answer.get("result_type") for answer in answers.values()]
        codes = []
        for answer in answers.values():
            for code in answer.get("misconception_codes", []):
                if code not in codes:
                    codes.append(code)
        context.update({
            "vlan_checkpoint_complete": True,
            "vlan_checkpoint_immediate": result_types.count("immediate"),
            "vlan_checkpoint_guided": result_types.count("guided"),
            "vlan_checkpoint_capabilities": VLAN_CAPABILITIES,
            "vlan_checkpoint_misconceptions": [VLAN_MISCONCEPTION_LABELS[code] for code in codes if code in VLAN_MISCONCEPTION_LABELS],
        })
    else:
        item = VLAN_ACTIVITY_MAP[str(checkpoint.get("current", 1))]
        stored = answers.get(item["id"])
        context.update({
            "vlan_checkpoint_activity": item,
            "vlan_checkpoint_result": stored,
            "vlan_checkpoint_total": len(VLAN_ACTIVITIES),
            "vlan_checkpoint_hint_text": item.get("hints", [])[min(stored.get("hint_level", 0), len(item.get("hints", []))) - 1] if stored and stored.get("hint_level") and item.get("hints") else None,
            "vlan_checkpoint_builder_initial": stored.get("last_payload", {}) if stored and stored.get("complete") else {},
        })
    return context


def _vlan_checkpoint_response(request):
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        context = _vlan_checkpoint_context(request)
        html = render_to_string("learning/partials/vlan_checkpoint.html", context, request=request)
        checkpoint = request.session.get("vlan_checkpoint", {})
        current = checkpoint.get("current")
        stored = checkpoint.get("answers", {}).get(str(current), {}) if current else {}
        return JsonResponse({"html": html, "complete": bool(checkpoint.get("complete")), "correct": bool(stored.get("complete")), "guided": stored.get("result_type") == "guided", "feedback": stored.get("last_feedback", stored.get("ui_error", "")), "next_available": bool(stored.get("complete"))})
    return redirect(f"{reverse('learning:vlan_concept')}#vlan-checkpoint")


@require_POST
def vlan_checkpoint_start(request):
    request.session["vlan_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _vlan_checkpoint_response(request)


@require_POST
def vlan_checkpoint_answer(request):
    checkpoint = request.session.get("vlan_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _vlan_checkpoint_response(request)
    item = VLAN_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"])
    if not (stored and stored.get("complete")):
        stored = stored or _initial_answer()
        stored, error = _submit_mapping(item, stored, request.POST.get("answer_payload"))
        if error:
            stored["ui_error"] = error
        if not stored.get("complete") and stored.get("attempt_count", 0) >= 2 and not stored.get("hint_level"):
            stored["hint_level"] = 1
        if stored.get("complete"):
            stored.pop("ui_error", None)
            if stored.get("hint_level", 0):
                stored["result_type"] = stored["outcome"] = "guided"
        checkpoint["answers"][item["id"]] = stored
    request.session.modified = True
    return _vlan_checkpoint_response(request)


@require_POST
def vlan_checkpoint_next(request):
    checkpoint = request.session.get("vlan_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _vlan_checkpoint_response(request)
    item = VLAN_ACTIVITY_MAP[str(checkpoint["current"])]
    if not checkpoint["answers"].get(item["id"], {}).get("complete"):
        return _vlan_checkpoint_response(request)
    if checkpoint["current"] == len(VLAN_ACTIVITIES):
        checkpoint["complete"] = True
    else:
        checkpoint["current"] += 1
    request.session.modified = True
    return _vlan_checkpoint_response(request)


@require_POST
def vlan_checkpoint_restart(request):
    request.session["vlan_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _vlan_checkpoint_response(request)


@require_POST
def vlan_checkpoint_hint(request):
    checkpoint = request.session.get("vlan_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _vlan_checkpoint_response(request)
    item = VLAN_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"]) or _initial_answer()
    stored["hint_level"] = min(stored.get("hint_level", 0) + 1, len(item.get("hints", [])))
    checkpoint["answers"][item["id"]] = stored
    request.session.modified = True
    return _vlan_checkpoint_response(request)


@require_POST
def vlan_checkpoint_reset_current(request):
    checkpoint = request.session.get("vlan_checkpoint")
    if checkpoint and not checkpoint.get("complete"):
        checkpoint.get("answers", {}).pop(str(checkpoint["current"]), None)
        request.session.modified = True
    return _vlan_checkpoint_response(request)


def trunk_concept(request):
    return render(request, "learning/trunk_concept.html", _context(request, current_topic="TRUNK", **_trunk_checkpoint_context(request)))


def ipv4_concept(request):
    return render(request, "learning/ipv4_concept.html", _context(
        request, current_topic="IPV4", **_ipv4_checkpoint_context(request)
    ))


def _ipv4_checkpoint_context(request):
    checkpoint = request.session.get("ipv4_checkpoint")
    context = {"ipv4_checkpoint_started": bool(checkpoint)}
    if not checkpoint:
        return context
    answers = checkpoint.get("answers", {})
    if checkpoint.get("complete"):
        result_types = [answer.get("result_type") for answer in answers.values()]
        codes = []
        for answer in answers.values():
            for code in answer.get("misconception_codes", []):
                if code not in codes:
                    codes.append(code)
        context.update({
            "ipv4_checkpoint_complete": True,
            "ipv4_checkpoint_immediate": result_types.count("immediate"),
            "ipv4_checkpoint_guided": result_types.count("guided"),
            "ipv4_checkpoint_capabilities": IPV4_CAPABILITIES,
            "ipv4_checkpoint_misconceptions": [
                IPV4_MISCONCEPTION_LABELS[code] for code in codes
                if code in IPV4_MISCONCEPTION_LABELS
            ],
        })
    else:
        item = IPV4_ACTIVITY_MAP[str(checkpoint.get("current", 1))]
        stored = answers.get(item["id"])
        hints = item.get("hints", [])
        hint_level = stored.get("hint_level", 0) if stored else 0
        context.update({
            "ipv4_checkpoint_activity": item,
            "ipv4_checkpoint_result": stored,
            "ipv4_checkpoint_total": len(IPV4_ACTIVITIES),
            "ipv4_checkpoint_hint_text": hints[min(hint_level, len(hints)) - 1] if hint_level and hints else None,
        })
    return context


def _ipv4_checkpoint_response(request):
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        context = _ipv4_checkpoint_context(request)
        html = render_to_string("learning/partials/ipv4_checkpoint.html", context, request=request)
        checkpoint = request.session.get("ipv4_checkpoint", {})
        current = checkpoint.get("current")
        stored = checkpoint.get("answers", {}).get(str(current), {}) if current else {}
        return JsonResponse({
            "html": html,
            "complete": bool(checkpoint.get("complete")),
            "correct": bool(stored.get("complete")),
            "guided": stored.get("result_type") == "guided",
            "feedback": stored.get("last_feedback", stored.get("ui_error", "")),
            "next_available": bool(stored.get("complete")),
        })
    return redirect(f"{reverse('learning:ipv4_concept')}#ipv4-checkpoint")


@require_POST
def ipv4_checkpoint_start(request):
    request.session["ipv4_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _ipv4_checkpoint_response(request)


@require_POST
def ipv4_checkpoint_answer(request):
    checkpoint = request.session.get("ipv4_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _ipv4_checkpoint_response(request)
    item = IPV4_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"])
    if not (stored and stored.get("complete")):
        stored = stored or _initial_answer()
        stored, error = _submit_mapping(item, stored, request.POST.get("answer_payload"))
        if error:
            stored["ui_error"] = error
        if not stored.get("complete") and stored.get("attempt_count", 0) >= 2:
            stored["last_feedback"] = item["wrong_feedback"]
        if not stored.get("complete") and stored.get("attempt_count", 0) >= 2 and not stored.get("hint_level"):
            stored["hint_level"] = 1
        if stored.get("complete"):
            stored.pop("ui_error", None)
            if stored.get("hint_level", 0):
                stored["result_type"] = stored["outcome"] = "guided"
        checkpoint["answers"][item["id"]] = stored
    request.session.modified = True
    return _ipv4_checkpoint_response(request)


@require_POST
def ipv4_checkpoint_next(request):
    checkpoint = request.session.get("ipv4_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _ipv4_checkpoint_response(request)
    item = IPV4_ACTIVITY_MAP[str(checkpoint["current"])]
    if not checkpoint["answers"].get(item["id"], {}).get("complete"):
        return _ipv4_checkpoint_response(request)
    if checkpoint["current"] == len(IPV4_ACTIVITIES):
        checkpoint["complete"] = True
    else:
        checkpoint["current"] += 1
    request.session.modified = True
    return _ipv4_checkpoint_response(request)


@require_POST
def ipv4_checkpoint_restart(request):
    request.session["ipv4_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _ipv4_checkpoint_response(request)


@require_POST
def ipv4_checkpoint_hint(request):
    checkpoint = request.session.get("ipv4_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _ipv4_checkpoint_response(request)
    item = IPV4_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"]) or _initial_answer()
    stored["hint_level"] = min(stored.get("hint_level", 0) + 1, len(item.get("hints", [])))
    checkpoint["answers"][item["id"]] = stored
    request.session.modified = True
    return _ipv4_checkpoint_response(request)


@require_POST
def ipv4_checkpoint_reset_current(request):
    checkpoint = request.session.get("ipv4_checkpoint")
    if checkpoint and not checkpoint.get("complete"):
        checkpoint.get("answers", {}).pop(str(checkpoint["current"]), None)
        request.session.modified = True
    return _ipv4_checkpoint_response(request)


def gateway_concept(request):
    return render(request, "learning/gateway_concept.html", _context(
        request, current_topic="GATEWAY", **_gateway_checkpoint_context(request)
    ))


def _gateway_checkpoint_context(request):
    checkpoint = request.session.get("gateway_checkpoint")
    context = {"gateway_checkpoint_started": bool(checkpoint)}
    if not checkpoint:
        return context
    answers = checkpoint.get("answers", {})
    if checkpoint.get("complete"):
        result_types = [answer.get("result_type") for answer in answers.values()]
        codes = []
        for answer in answers.values():
            for code in answer.get("misconception_codes", []):
                if code not in codes:
                    codes.append(code)
        context.update({
            "gateway_checkpoint_complete": True,
            "gateway_checkpoint_immediate": result_types.count("immediate"),
            "gateway_checkpoint_guided": result_types.count("guided"),
            "gateway_checkpoint_capabilities": GATEWAY_CAPABILITIES,
            "gateway_checkpoint_misconceptions": [
                GATEWAY_MISCONCEPTION_LABELS[code] for code in codes
                if code in GATEWAY_MISCONCEPTION_LABELS
            ],
        })
    else:
        item = GATEWAY_ACTIVITY_MAP[str(checkpoint.get("current", 1))]
        stored = answers.get(item["id"])
        hints = item.get("hints", [])
        hint_level = stored.get("hint_level", 0) if stored else 0
        context.update({
            "gateway_checkpoint_activity": item,
            "gateway_checkpoint_result": stored,
            "gateway_checkpoint_total": len(GATEWAY_ACTIVITIES),
            "gateway_checkpoint_hint_text": hints[min(hint_level, len(hints)) - 1] if hint_level and hints else None,
        })
    return context


def _gateway_checkpoint_response(request):
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        context = _gateway_checkpoint_context(request)
        html = render_to_string("learning/partials/gateway_checkpoint.html", context, request=request)
        checkpoint = request.session.get("gateway_checkpoint", {})
        current = checkpoint.get("current")
        stored = checkpoint.get("answers", {}).get(str(current), {}) if current else {}
        return JsonResponse({
            "html": html, "complete": bool(checkpoint.get("complete")),
            "correct": bool(stored.get("complete")), "guided": stored.get("result_type") == "guided",
            "feedback": stored.get("last_feedback", stored.get("ui_error", "")),
            "next_available": bool(stored.get("complete")),
        })
    return redirect(f"{reverse('learning:gateway_concept')}#gateway-checkpoint")


@require_POST
def gateway_checkpoint_start(request):
    request.session["gateway_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _gateway_checkpoint_response(request)


@require_POST
def gateway_checkpoint_answer(request):
    checkpoint = request.session.get("gateway_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _gateway_checkpoint_response(request)
    item = GATEWAY_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"])
    if not (stored and stored.get("complete")):
        stored = stored or _initial_answer()
        stored, error = _submit_mapping(item, stored, request.POST.get("answer_payload"))
        if error:
            stored["ui_error"] = error
        if not stored.get("complete") and stored.get("attempt_count", 0) >= 2:
            stored["last_feedback"] = item["wrong_feedback"]
        if not stored.get("complete") and stored.get("attempt_count", 0) >= 2 and not stored.get("hint_level"):
            stored["hint_level"] = 1
        if stored.get("complete"):
            stored.pop("ui_error", None)
            if stored.get("hint_level", 0):
                stored["result_type"] = stored["outcome"] = "guided"
        checkpoint["answers"][item["id"]] = stored
    request.session.modified = True
    return _gateway_checkpoint_response(request)


@require_POST
def gateway_checkpoint_next(request):
    checkpoint = request.session.get("gateway_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _gateway_checkpoint_response(request)
    item = GATEWAY_ACTIVITY_MAP[str(checkpoint["current"])]
    if not checkpoint["answers"].get(item["id"], {}).get("complete"):
        return _gateway_checkpoint_response(request)
    if checkpoint["current"] == len(GATEWAY_ACTIVITIES):
        checkpoint["complete"] = True
    else:
        checkpoint["current"] += 1
    request.session.modified = True
    return _gateway_checkpoint_response(request)


@require_POST
def gateway_checkpoint_restart(request):
    request.session["gateway_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _gateway_checkpoint_response(request)


@require_POST
def gateway_checkpoint_hint(request):
    checkpoint = request.session.get("gateway_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _gateway_checkpoint_response(request)
    item = GATEWAY_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"]) or _initial_answer()
    stored["hint_level"] = min(stored.get("hint_level", 0) + 1, len(item.get("hints", [])))
    checkpoint["answers"][item["id"]] = stored
    request.session.modified = True
    return _gateway_checkpoint_response(request)


@require_POST
def gateway_checkpoint_reset_current(request):
    checkpoint = request.session.get("gateway_checkpoint")
    if checkpoint and not checkpoint.get("complete"):
        checkpoint.get("answers", {}).pop(str(checkpoint["current"]), None)
        request.session.modified = True
    return _gateway_checkpoint_response(request)


def route_concept(request):
    basic_routes = [
        {"prefix":"192.168.10.0/24","next_hop":"DIRECT","interface":"LAN","aria_prefix":"192.168.10.0 slash 24"},
        {"prefix":"192.168.20.0/24","next_hop":"10.0.0.2","interface":"WAN1","aria_prefix":"192.168.20.0 slash 24"},
        {"prefix":"0.0.0.0/0","next_hop":"203.0.113.1","interface":"WAN2","aria_prefix":"0.0.0.0 slash 0"},
    ]
    specific_routes = [
        {"prefix":"10.0.0.0/8","next_hop":"R2","interface":"WAN1"},
        {"prefix":"10.10.0.0/16","next_hop":"R3","interface":"WAN2"},
        {"prefix":"10.10.20.0/24","next_hop":"R4","interface":"WAN3"},
        {"prefix":"0.0.0.0/0","next_hop":"Internet","interface":"WAN4"},
    ]
    complete_routes = [basic_routes[0], basic_routes[1], {"prefix":"10.0.0.0/8","next_hop":"10.0.0.2","interface":"WAN1"}, basic_routes[2]]
    return render(request, "learning/route_concept.html", _context(request, current_topic="ROUTES", basic_routes=basic_routes, specific_routes=specific_routes, complete_routes=complete_routes, **_route_checkpoint_context(request)))


def _route_checkpoint_context(request):
    checkpoint = request.session.get("route_checkpoint")
    context = {"route_checkpoint_started": bool(checkpoint)}
    if not checkpoint:
        return context
    answers = checkpoint.get("answers", {})
    if checkpoint.get("complete"):
        result_types = [answer.get("result_type") for answer in answers.values()]
        codes = []
        for answer in answers.values():
            for code in answer.get("misconception_codes", []):
                if code not in codes: codes.append(code)
        context.update({"route_checkpoint_complete":True,"route_checkpoint_immediate":result_types.count("immediate"),"route_checkpoint_guided":result_types.count("guided"),"route_checkpoint_capabilities":ROUTE_CAPABILITIES,"route_checkpoint_misconceptions":[ROUTE_MISCONCEPTION_LABELS[c] for c in codes if c in ROUTE_MISCONCEPTION_LABELS]})
    else:
        item = ROUTE_ACTIVITY_MAP[str(checkpoint.get("current", 1))]
        stored = answers.get(item["id"])
        hints = item.get("hints", [])
        level = stored.get("hint_level", 0) if stored else 0
        context.update({"route_checkpoint_activity":item,"route_checkpoint_result":stored,"route_checkpoint_total":len(ROUTE_ACTIVITIES),"route_checkpoint_hint_text":hints[min(level,len(hints))-1] if level and hints else None})
    return context


def _route_checkpoint_response(request):
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        html = render_to_string("learning/partials/route_checkpoint.html", _route_checkpoint_context(request), request=request)
        checkpoint = request.session.get("route_checkpoint", {}); current = checkpoint.get("current")
        stored = checkpoint.get("answers", {}).get(str(current), {}) if current else {}
        return JsonResponse({"html":html,"complete":bool(checkpoint.get("complete")),"correct":bool(stored.get("complete")),"guided":stored.get("result_type")=="guided","feedback":stored.get("last_feedback",stored.get("ui_error","")),"next_available":bool(stored.get("complete"))})
    return redirect(f"{reverse('learning:route_concept')}#route-checkpoint")


@require_POST
def route_checkpoint_start(request):
    request.session["route_checkpoint"] = {"current":1,"answers":{},"complete":False}
    return _route_checkpoint_response(request)


@require_POST
def route_checkpoint_answer(request):
    checkpoint = request.session.get("route_checkpoint")
    if not checkpoint or checkpoint.get("complete"): return _route_checkpoint_response(request)
    item = ROUTE_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"])
    if not (stored and stored.get("complete")):
        stored = stored or _initial_answer()
        raw_payload = request.POST.get("answer_payload")
        decoded = _decode_payload(raw_payload, dict)
        if decoded:
            raw_payload = json.dumps({key: value.strip().lower() if isinstance(value, str) else value for key, value in decoded.items()})
        stored, error = _submit_mapping(item, stored, raw_payload)
        if error: stored["ui_error"] = error
        if not stored.get("complete") and stored.get("attempt_count",0) >= 2:
            stored["last_feedback"] = item["wrong_feedback"]
            if not stored.get("hint_level"): stored["hint_level"] = 1
        if stored.get("complete"):
            stored.pop("ui_error",None)
            if stored.get("hint_level",0): stored["result_type"] = stored["outcome"] = "guided"
        checkpoint["answers"][item["id"]] = stored
    request.session.modified = True
    return _route_checkpoint_response(request)


@require_POST
def route_checkpoint_next(request):
    checkpoint = request.session.get("route_checkpoint")
    if not checkpoint or checkpoint.get("complete"): return _route_checkpoint_response(request)
    item = ROUTE_ACTIVITY_MAP[str(checkpoint["current"])]
    if not checkpoint["answers"].get(item["id"],{}).get("complete"): return _route_checkpoint_response(request)
    if checkpoint["current"] == len(ROUTE_ACTIVITIES): checkpoint["complete"] = True
    else: checkpoint["current"] += 1
    request.session.modified = True
    return _route_checkpoint_response(request)


@require_POST
def route_checkpoint_restart(request):
    request.session["route_checkpoint"] = {"current":1,"answers":{},"complete":False}
    return _route_checkpoint_response(request)


@require_POST
def route_checkpoint_hint(request):
    checkpoint=request.session.get("route_checkpoint")
    if not checkpoint or checkpoint.get("complete"): return _route_checkpoint_response(request)
    item=ROUTE_ACTIVITY_MAP[str(checkpoint["current"])]; stored=checkpoint["answers"].get(item["id"]) or _initial_answer()
    stored["hint_level"]=min(stored.get("hint_level",0)+1,len(item.get("hints",[]))); checkpoint["answers"][item["id"]]=stored; request.session.modified=True
    return _route_checkpoint_response(request)


@require_POST
def route_checkpoint_reset_current(request):
    checkpoint=request.session.get("route_checkpoint")
    if checkpoint and not checkpoint.get("complete"): checkpoint.get("answers",{}).pop(str(checkpoint["current"]),None); request.session.modified=True
    return _route_checkpoint_response(request)


def inter_vlan_concept(request):
    return render(request,"learning/inter_vlan_concept.html",_context(request,current_topic="INTERVLAN",**_iv_context(request)))

def _iv_context(request):
    cp=request.session.get("iv_checkpoint"); ctx={"iv_checkpoint_started":bool(cp)}
    if not cp:return ctx
    answers=cp.get("answers",{})
    if cp.get("complete"):
        types=[a.get("result_type") for a in answers.values()]; codes=[]
        for a in answers.values():
            for c in a.get("misconception_codes",[]):
                if c not in codes:codes.append(c)
        ctx.update({"iv_checkpoint_complete":True,"iv_checkpoint_immediate":types.count("immediate"),"iv_checkpoint_guided":types.count("guided"),"iv_checkpoint_capabilities":IV_CAPABILITIES,"iv_checkpoint_misconceptions":[IV_MISCONCEPTION_LABELS[c] for c in codes if c in IV_MISCONCEPTION_LABELS]})
    else:
        item=IV_ACTIVITY_MAP[str(cp.get("current",1))]; stored=answers.get(item["id"]); hints=item.get("hints",[]); level=stored.get("hint_level",0) if stored else 0
        ctx.update({"iv_checkpoint_activity":item,"iv_checkpoint_result":stored,"iv_checkpoint_total":len(IV_ACTIVITIES),"iv_checkpoint_hint_text":hints[min(level,len(hints))-1] if level and hints else None})
    return ctx

def _iv_response(request):
    if request.headers.get("X-Requested-With")=="XMLHttpRequest":
        html=render_to_string("learning/partials/inter_vlan_checkpoint.html",_iv_context(request),request=request);cp=request.session.get("iv_checkpoint",{});cur=cp.get("current");stored=cp.get("answers",{}).get(str(cur),{}) if cur else {}
        return JsonResponse({"html":html,"complete":bool(cp.get("complete")),"correct":bool(stored.get("complete")),"guided":stored.get("result_type")=="guided","feedback":stored.get("last_feedback","")})
    return redirect(f"{reverse('learning:inter_vlan_concept')}#inter-vlan-checkpoint")

@require_POST
def iv_checkpoint_start(request):request.session["iv_checkpoint"]={"current":1,"answers":{},"complete":False};return _iv_response(request)
@require_POST
def iv_checkpoint_answer(request):
    cp=request.session.get("iv_checkpoint")
    if not cp or cp.get("complete"):return _iv_response(request)
    item=IV_ACTIVITY_MAP[str(cp["current"])];stored=cp["answers"].get(item["id"])
    if not(stored and stored.get("complete")):
        stored=stored or _initial_answer();raw=request.POST.get("answer_payload");decoded=_decode_payload(raw,dict)
        if decoded:raw=json.dumps({k:v.strip().lower() if isinstance(v,str) else v for k,v in decoded.items()})
        stored,error=_submit_mapping(item,stored,raw)
        if error:stored["ui_error"]=error
        if not stored.get("complete") and stored.get("attempt_count",0)>=2:stored["last_feedback"]=item["wrong_feedback"];stored["hint_level"]=max(1,stored.get("hint_level",0))
        if stored.get("complete") and stored.get("hint_level",0):stored["result_type"]=stored["outcome"]="guided"
        cp["answers"][item["id"]]=stored
    request.session.modified=True;return _iv_response(request)
@require_POST
def iv_checkpoint_next(request):
    cp=request.session.get("iv_checkpoint")
    if not cp or cp.get("complete"):return _iv_response(request)
    if not cp["answers"].get(str(cp["current"]),{}).get("complete"):return _iv_response(request)
    if cp["current"]==len(IV_ACTIVITIES):cp["complete"]=True
    else:cp["current"]+=1
    request.session.modified=True;return _iv_response(request)
@require_POST
def iv_checkpoint_restart(request):request.session["iv_checkpoint"]={"current":1,"answers":{},"complete":False};return _iv_response(request)
@require_POST
def iv_checkpoint_hint(request):
    cp=request.session.get("iv_checkpoint")
    if not cp or cp.get("complete"):return _iv_response(request)
    item=IV_ACTIVITY_MAP[str(cp["current"])];s=cp["answers"].get(item["id"]) or _initial_answer();s["hint_level"]=min(s.get("hint_level",0)+1,len(item.get("hints",[])));cp["answers"][item["id"]]=s;request.session.modified=True;return _iv_response(request)
@require_POST
def iv_checkpoint_reset(request):
    cp=request.session.get("iv_checkpoint")
    if cp and not cp.get("complete"):cp.get("answers",{}).pop(str(cp["current"]),None);request.session.modified=True
    return _iv_response(request)


def icmp_concept(request):
    return render(request, "learning/icmp_concept.html", _context(request, current_topic="ICMP", **_icmp_context(request)))


def _icmp_context(request):
    cp = request.session.get("icmp_checkpoint")
    context = {"icmp_checkpoint_started": bool(cp)}
    if not cp:
        return context
    answers = cp.get("answers", {})
    if cp.get("complete"):
        types = [answer.get("result_type") for answer in answers.values()]
        codes = []
        for answer in answers.values():
            for code in answer.get("misconception_codes", []):
                if code not in codes:
                    codes.append(code)
        context.update({
            "icmp_checkpoint_complete": True,
            "icmp_checkpoint_immediate": types.count("immediate"),
            "icmp_checkpoint_guided": types.count("guided"),
            "icmp_checkpoint_capabilities": ICMP_CAPABILITIES,
            "icmp_checkpoint_misconceptions": [ICMP_MISCONCEPTION_LABELS[code] for code in codes if code in ICMP_MISCONCEPTION_LABELS],
        })
    else:
        item = ICMP_ACTIVITY_MAP[str(cp.get("current", 1))]
        stored = answers.get(item["id"])
        hints = item.get("hints", [])
        level = stored.get("hint_level", 0) if stored else 0
        context.update({
            "icmp_checkpoint_activity": item, "icmp_checkpoint_result": stored,
            "icmp_checkpoint_total": len(ICMP_ACTIVITIES),
            "icmp_checkpoint_hint_text": hints[min(level, len(hints)) - 1] if level and hints else None,
        })
    return context


def _icmp_response(request):
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        html = render_to_string("learning/partials/icmp_checkpoint.html", _icmp_context(request), request=request)
        cp = request.session.get("icmp_checkpoint", {})
        current = cp.get("current")
        stored = cp.get("answers", {}).get(str(current), {}) if current else {}
        return JsonResponse({"html": html, "complete": bool(cp.get("complete")), "correct": bool(stored.get("complete")), "guided": stored.get("result_type") == "guided", "feedback": stored.get("last_feedback", stored.get("ui_error", ""))})
    return redirect(f"{reverse('learning:icmp_concept')}#icmp-checkpoint")


@require_POST
def icmp_checkpoint_start(request):
    request.session["icmp_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _icmp_response(request)


@require_POST
def icmp_checkpoint_answer(request):
    cp = request.session.get("icmp_checkpoint")
    if not cp or cp.get("complete"):
        return _icmp_response(request)
    item = ICMP_ACTIVITY_MAP[str(cp["current"])]
    stored = cp["answers"].get(item["id"])
    if not (stored and stored.get("complete")):
        stored = stored or _initial_answer()
        raw = request.POST.get("answer_payload")
        decoded = _decode_payload(raw, dict)
        if decoded:
            raw = json.dumps({key: value.strip().lower() if isinstance(value, str) else value for key, value in decoded.items()})
        stored, error = _submit_mapping(item, stored, raw)
        if error:
            stored["ui_error"] = error
        if not stored.get("complete") and stored.get("attempt_count", 0) >= 2:
            stored["last_feedback"] = item["wrong_feedback"]
            stored["hint_level"] = max(1, stored.get("hint_level", 0))
        if stored.get("complete"):
            stored.pop("ui_error", None)
            if stored.get("hint_level", 0):
                stored["result_type"] = stored["outcome"] = "guided"
        cp["answers"][item["id"]] = stored
    request.session.modified = True
    return _icmp_response(request)


@require_POST
def icmp_checkpoint_next(request):
    cp = request.session.get("icmp_checkpoint")
    if not cp or cp.get("complete"):
        return _icmp_response(request)
    if not cp["answers"].get(str(cp["current"]), {}).get("complete"):
        return _icmp_response(request)
    if cp["current"] == len(ICMP_ACTIVITIES):
        cp["complete"] = True
    else:
        cp["current"] += 1
    request.session.modified = True
    return _icmp_response(request)


@require_POST
def icmp_checkpoint_restart(request):
    request.session["icmp_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _icmp_response(request)


@require_POST
def icmp_checkpoint_hint(request):
    cp = request.session.get("icmp_checkpoint")
    if not cp or cp.get("complete"):
        return _icmp_response(request)
    item = ICMP_ACTIVITY_MAP[str(cp["current"])]
    stored = cp["answers"].get(item["id"]) or _initial_answer()
    stored["hint_level"] = min(stored.get("hint_level", 0) + 1, len(item.get("hints", [])))
    cp["answers"][item["id"]] = stored
    request.session.modified = True
    return _icmp_response(request)


@require_POST
def icmp_checkpoint_reset(request):
    cp = request.session.get("icmp_checkpoint")
    if cp and not cp.get("complete"):
        cp.get("answers", {}).pop(str(cp["current"]), None)
        request.session.modified = True
    return _icmp_response(request)


def transport_concept(request):
    return render(request, "learning/transport_concept.html", _context(request, current_topic="TRANSPORT", **_transport_context(request)))


def _transport_context(request):
    checkpoint = request.session.get("transport_checkpoint")
    context = {"transport_checkpoint_started": bool(checkpoint)}
    if not checkpoint:
        return context
    answers = checkpoint.get("answers", {})
    if checkpoint.get("complete"):
        result_types = [answer.get("result_type") for answer in answers.values()]
        codes = []
        for answer in answers.values():
            for code in answer.get("misconception_codes", []):
                if code not in codes: codes.append(code)
        context.update({"transport_checkpoint_complete": True, "transport_checkpoint_immediate": result_types.count("immediate"), "transport_checkpoint_guided": result_types.count("guided"), "transport_checkpoint_capabilities": TRANSPORT_CAPABILITIES, "transport_checkpoint_misconceptions": [TRANSPORT_MISCONCEPTION_LABELS[code] for code in codes if code in TRANSPORT_MISCONCEPTION_LABELS]})
    else:
        item = TRANSPORT_ACTIVITY_MAP[str(checkpoint.get("current", 1))]
        stored = answers.get(item["id"]); hints = item.get("hints", []); level = stored.get("hint_level", 0) if stored else 0
        context.update({"transport_checkpoint_activity": item, "transport_checkpoint_result": stored, "transport_checkpoint_total": len(TRANSPORT_ACTIVITIES), "transport_checkpoint_hint_text": hints[min(level, len(hints)) - 1] if level and hints else None})
    return context


def _transport_response(request):
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        html = render_to_string("learning/partials/transport_checkpoint.html", _transport_context(request), request=request)
        checkpoint = request.session.get("transport_checkpoint", {}); current = checkpoint.get("current")
        stored = checkpoint.get("answers", {}).get(str(current), {}) if current else {}
        return JsonResponse({"html": html, "complete": bool(checkpoint.get("complete")), "correct": bool(stored.get("complete")), "guided": stored.get("result_type") == "guided", "feedback": stored.get("last_feedback", stored.get("ui_error", ""))})
    return redirect(f"{reverse('learning:transport_concept')}#transport-checkpoint")


@require_POST
def transport_checkpoint_start(request):
    request.session["transport_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _transport_response(request)


@require_POST
def transport_checkpoint_answer(request):
    checkpoint = request.session.get("transport_checkpoint")
    if not checkpoint or checkpoint.get("complete"): return _transport_response(request)
    item = TRANSPORT_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"])
    if not (stored and stored.get("complete")):
        stored = stored or _initial_answer(); decoded = _decode_payload(request.POST.get("answer_payload"), dict)
        raw = json.dumps({key: value.strip().lower() if isinstance(value, str) else value for key, value in decoded.items()}) if decoded else None
        stored, error = _submit_mapping(item, stored, raw)
        if error: stored["ui_error"] = error
        if not stored.get("complete") and stored.get("attempt_count", 0) >= 2:
            stored["last_feedback"] = item["wrong_feedback"]; stored["hint_level"] = max(1, stored.get("hint_level", 0))
        if stored.get("complete"):
            stored.pop("ui_error", None)
            if stored.get("hint_level", 0): stored["result_type"] = stored["outcome"] = "guided"
        checkpoint["answers"][item["id"]] = stored
    request.session.modified = True
    return _transport_response(request)


@require_POST
def transport_checkpoint_next(request):
    checkpoint = request.session.get("transport_checkpoint")
    if not checkpoint or checkpoint.get("complete"): return _transport_response(request)
    if not checkpoint["answers"].get(str(checkpoint["current"]), {}).get("complete"): return _transport_response(request)
    if checkpoint["current"] == len(TRANSPORT_ACTIVITIES): checkpoint["complete"] = True
    else: checkpoint["current"] += 1
    request.session.modified = True
    return _transport_response(request)


@require_POST
def transport_checkpoint_restart(request):
    request.session["transport_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _transport_response(request)


@require_POST
def transport_checkpoint_hint(request):
    checkpoint = request.session.get("transport_checkpoint")
    if not checkpoint or checkpoint.get("complete"): return _transport_response(request)
    item = TRANSPORT_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"]) or _initial_answer()
    stored["hint_level"] = min(stored.get("hint_level", 0) + 1, len(item.get("hints", [])))
    checkpoint["answers"][item["id"]] = stored; request.session.modified = True
    return _transport_response(request)


@require_POST
def transport_checkpoint_reset(request):
    checkpoint = request.session.get("transport_checkpoint")
    if checkpoint and not checkpoint.get("complete"):
        checkpoint.get("answers", {}).pop(str(checkpoint["current"]), None); request.session.modified = True
    return _transport_response(request)


def _trunk_checkpoint_context(request):
    checkpoint = request.session.get("trunk_checkpoint")
    context = {"trunk_checkpoint_started": bool(checkpoint)}
    if not checkpoint:
        return context
    answers = checkpoint.get("answers", {})
    if checkpoint.get("complete"):
        result_types = [answer.get("result_type") for answer in answers.values()]
        codes = []
        for answer in answers.values():
            for code in answer.get("misconception_codes", []):
                if code not in codes:
                    codes.append(code)
        context.update({"trunk_checkpoint_complete": True, "trunk_checkpoint_immediate": result_types.count("immediate"), "trunk_checkpoint_guided": result_types.count("guided"), "trunk_checkpoint_capabilities": TRUNK_CAPABILITIES, "trunk_checkpoint_misconceptions": [TRUNK_MISCONCEPTION_LABELS[code] for code in codes if code in TRUNK_MISCONCEPTION_LABELS]})
    else:
        item = TRUNK_ACTIVITY_MAP[str(checkpoint.get("current", 1))]
        stored = answers.get(item["id"])
        context.update({"trunk_checkpoint_activity": item, "trunk_checkpoint_result": stored, "trunk_checkpoint_total": len(TRUNK_ACTIVITIES), "trunk_checkpoint_hint_text": item.get("hints", [])[min(stored.get("hint_level", 0), len(item.get("hints", []))) - 1] if stored and stored.get("hint_level") and item.get("hints") else None, "trunk_checkpoint_builder_initial": stored.get("last_payload", {}) if stored and stored.get("complete") else {}})
    return context


def _trunk_checkpoint_response(request):
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        context = _trunk_checkpoint_context(request)
        html = render_to_string("learning/partials/trunk_checkpoint.html", context, request=request)
        checkpoint = request.session.get("trunk_checkpoint", {})
        current = checkpoint.get("current")
        stored = checkpoint.get("answers", {}).get(str(current), {}) if current else {}
        return JsonResponse({"html": html, "complete": bool(checkpoint.get("complete")), "correct": bool(stored.get("complete")), "guided": stored.get("result_type") == "guided", "feedback": stored.get("last_feedback", stored.get("ui_error", "")), "next_available": bool(stored.get("complete"))})
    return redirect(f"{reverse('learning:trunk_concept')}#trunk-checkpoint")


@require_POST
def trunk_checkpoint_start(request):
    request.session["trunk_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _trunk_checkpoint_response(request)


@require_POST
def trunk_checkpoint_answer(request):
    checkpoint = request.session.get("trunk_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _trunk_checkpoint_response(request)
    item = TRUNK_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"])
    if not (stored and stored.get("complete")):
        stored = stored or _initial_answer()
        stored, error = _submit_mapping(item, stored, request.POST.get("answer_payload"))
        if error:
            stored["ui_error"] = error
        if not stored.get("complete") and stored.get("attempt_count", 0) >= 2 and not stored.get("hint_level"):
            stored["hint_level"] = 1
        if stored.get("complete"):
            stored.pop("ui_error", None)
            if stored.get("hint_level", 0):
                stored["result_type"] = stored["outcome"] = "guided"
        checkpoint["answers"][item["id"]] = stored
    request.session.modified = True
    return _trunk_checkpoint_response(request)


@require_POST
def trunk_checkpoint_next(request):
    checkpoint = request.session.get("trunk_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _trunk_checkpoint_response(request)
    item = TRUNK_ACTIVITY_MAP[str(checkpoint["current"])]
    if not checkpoint["answers"].get(item["id"], {}).get("complete"):
        return _trunk_checkpoint_response(request)
    if checkpoint["current"] == len(TRUNK_ACTIVITIES): checkpoint["complete"] = True
    else: checkpoint["current"] += 1
    request.session.modified = True
    return _trunk_checkpoint_response(request)


@require_POST
def trunk_checkpoint_restart(request):
    request.session["trunk_checkpoint"] = {"current": 1, "answers": {}, "complete": False}
    return _trunk_checkpoint_response(request)


@require_POST
def trunk_checkpoint_hint(request):
    checkpoint = request.session.get("trunk_checkpoint")
    if not checkpoint or checkpoint.get("complete"):
        return _trunk_checkpoint_response(request)
    item = TRUNK_ACTIVITY_MAP[str(checkpoint["current"])]
    stored = checkpoint["answers"].get(item["id"]) or _initial_answer()
    stored["hint_level"] = min(stored.get("hint_level", 0) + 1, len(item.get("hints", [])))
    checkpoint["answers"][item["id"]] = stored
    request.session.modified = True
    return _trunk_checkpoint_response(request)


@require_POST
def trunk_checkpoint_reset_current(request):
    checkpoint = request.session.get("trunk_checkpoint")
    if checkpoint and not checkpoint.get("complete"):
        checkpoint.get("answers", {}).pop(str(checkpoint["current"]), None)
        request.session.modified = True
    return _trunk_checkpoint_response(request)


def mac_coming_soon(request, destination):
    if destination != "rapid-fire":
        raise Http404
    return render(request, "learning/mac_coming_soon.html", _context(
        request, current_topic="MAC", destination=destination,
    ))


def _mac_progress(request):
    return request.session.setdefault("mac_progress", {"answers": {}})


def _mac_context(request, **extra):
    return {"current_topic": "MAC", "progress": _mac_progress(request), **extra}


def mac_activities(request):
    return render(request, "learning/mac_activities_intro.html", _mac_context(
        request, activity_total=len(MAC_ACTIVITIES),
    ))


@require_POST
def mac_begin_activities(request):
    request.session["mac_progress"] = {"answers": {}}
    return redirect("learning:mac_activity", activity_id=MAC_ACTIVITIES[0]["id"])


def mac_activity(request, activity_id):
    item = MAC_ACTIVITY_MAP.get(activity_id)
    if not item:
        raise Http404
    progress = _mac_progress(request)
    stored = progress["answers"].get(activity_id)
    error = None

    if request.method == "POST" and stored and stored.get("complete") and item["type"] == "concept_map_builder" and "reveal_reference" in request.POST:
        stored["free_text"] = request.POST.get("free_text", "")
        stored["reference_revealed"] = True
        progress["answers"][activity_id] = stored
    elif request.method == "POST" and not (stored and stored.get("complete")):
        stored = stored or _initial_answer()
        if item["type"] in {"visual_selection", "find_inconsistency", "frame_hotspot", "topology_hotspot", "terminal_hotspot"}:
            stored, error = _submit_discrete(item, stored, request.POST.get("answer"))
        elif item["type"] in {
            "sentence_repair", "frame_builder", "dual_concept_map", "command_match",
            "compare_outputs_builder", "process_builder", "concept_relation_builder",
            "role_sort", "evidence_sort", "diagnostic_map", "concept_map_builder",
        }:
            stored, error = _submit_mapping(item, stored, request.POST.get("answer_payload"))
        elif item["type"] == "integrated_flow_builder":
            stored, error = _submit_ordering(item, stored, request.POST.get("answer_payload"))
        if stored:
            progress["answers"][activity_id] = stored

    request.session.modified = True
    display_order = item.get("items", [])
    if item["type"] == "integrated_flow_builder" and stored and stored.get("last_payload"):
        display_order = stored["last_payload"]
    return render(request, "learning/mac_activity.html", _mac_context(
        request, activity=item, result=stored, error=error,
        activity_number=item["number"], activity_total=len(MAC_ACTIVITIES),
        show_hint=bool(stored and stored.get("attempt_count", 0) >= 2 and not stored.get("complete") and item.get("hint")),
        display_order=display_order,
        builder_initial=stored.get("last_payload", {}) if stored and stored.get("complete") else {},
    ))


@require_POST
def mac_advance(request, activity_id):
    item = MAC_ACTIVITY_MAP.get(activity_id)
    progress = _mac_progress(request)
    stored = progress["answers"].get(activity_id, {})
    if not item or not stored.get("complete"):
        return redirect("learning:mac_activity", activity_id=activity_id)
    index = next(i for i, candidate in enumerate(MAC_ACTIVITIES) if candidate["id"] == activity_id)
    next_item = MAC_ACTIVITIES[index + 1] if index + 1 < len(MAC_ACTIVITIES) else None
    return redirect("learning:mac_activity", activity_id=next_item["id"]) if next_item else redirect("learning:mac_completion")


def mac_completion(request):
    progress = _mac_progress(request)
    answers = progress["answers"].values()
    result_types = [answer.get("result_type") for answer in answers]
    codes = []
    for answer in answers:
        for code in answer.get("misconception_codes", []):
            if code not in codes:
                codes.append(code)
    return render(request, "learning/mac_completion.html", _mac_context(
        request, immediate_count=result_types.count("immediate"), guided_count=result_types.count("guided"),
        activity_total=len(MAC_ACTIVITIES), completed_count=sum(1 for answer in answers if answer.get("complete")),
        capabilities=MAC_CAPABILITIES,
        misconceptions=[MAC_MISCONCEPTION_LABELS[code] for code in codes if code in MAC_MISCONCEPTION_LABELS],
    ))


@require_POST
def mac_restart(request):
    request.session.pop("mac_progress", None)
    return redirect("learning:mac_activities")


@require_POST
def begin_activities(request):
    progress = _progress(request)
    if "conceito" not in progress["completed_stages"]:
        progress["completed_stages"].append("conceito")
    progress["current_stage"] = ACTIVITIES[0]["stage"]
    request.session.modified = True
    return redirect("learning:activity", activity_id=ACTIVITIES[0]["id"])


def activity(request, activity_id):
    item = ACTIVITY_MAP.get(activity_id)
    if not item:
        raise Http404
    progress = _progress(request)
    progress["current_stage"] = item["stage"]
    stored = progress["answers"].get(activity_id)
    error = None

    if request.method == "POST" and stored and stored.get("complete") and item["type"] == "concept_map_builder" and "reveal_reference" in request.POST:
        stored["free_text"] = request.POST.get("free_text", "")
        stored["reference_revealed"] = True
        progress["answers"][activity_id] = stored
    elif request.method == "POST" and not (stored and stored.get("complete")):
        stored = stored or _initial_answer()
        if item["type"] in {"terminal_hotspot", "multiple_choice", "topology_hotspot", "find_inconsistency", "compare_outputs"}:
            stored, error = _submit_discrete(item, stored, request.POST.get("answer"))
        elif item["type"] == "predict_then_reveal" and item.get("fields"):
            stored, error = _submit_multi_text(item, stored, request.POST)
        elif item["type"] in {"predict_then_reveal", "command_fill"}:
            stored, error = _submit_text(item, stored, request.POST.get("answer", ""))
        elif item["type"] in {"pair_match", "token_fill", "sort_into_buckets", "sentence_repair", "table_builder", "evidence_sort", "diagnostic_map", "concept_map_builder"}:
            stored, error = _submit_mapping(item, stored, request.POST.get("answer_payload"))
        elif item["type"] == "ordering":
            stored, error = _submit_ordering(item, stored, request.POST.get("answer_payload"))
        elif item["type"] == "event_selection_order":
            stored, error = _submit_event_order(item, stored, request.POST.get("answer_payload"))
        if stored:
            progress["answers"][activity_id] = stored

    request.session.modified = True
    display_order = item.get("items", [])
    if item["type"] == "ordering" and stored and stored.get("last_payload"):
        display_order = stored["last_payload"]
    return render(request, "learning/activity.html", _context(
        request, activity=item, result=stored, error=error,
        activity_number=item["number"], activity_total=len(ACTIVITIES),
        show_hint=bool(stored and stored.get("attempt_count", 0) >= 2 and not stored.get("complete") and item.get("hint")),
        display_order=display_order,
        builder_initial=stored.get("last_payload", {}) if stored and stored.get("complete") else {},
    ))


@require_POST
def advance(request, activity_id):
    item = ACTIVITY_MAP.get(activity_id)
    progress = _progress(request)
    stored = progress["answers"].get(activity_id, {})
    if not item or not stored.get("complete"):
        return redirect("learning:activity", activity_id=activity_id)
    index = next(i for i, activity_item in enumerate(ACTIVITIES) if activity_item["id"] == activity_id)
    next_item = ACTIVITIES[index + 1] if index + 1 < len(ACTIVITIES) else None
    if not next_item or next_item["stage"] != item["stage"]:
        if item["stage"] not in progress["completed_stages"]:
            progress["completed_stages"].append(item["stage"])
    request.session.modified = True
    return redirect("learning:activity", activity_id=next_item["id"]) if next_item else redirect("learning:completion")


def completion(request):
    progress = _progress(request)
    progress["current_stage"] = None
    progress["completed_stages"] = [key for key, _ in STAGES]
    answers = progress["answers"].values()
    result_types = [answer.get("result_type") for answer in answers]
    codes = []
    for answer in answers:
        for code in answer.get("misconception_codes", []):
            if code not in codes:
                codes.append(code)
    request.session.modified = True
    return render(request, "learning/completion.html", _context(
        request, immediate_count=result_types.count("immediate"), guided_count=result_types.count("guided"),
        activity_total=len(ACTIVITIES), completed_count=sum(1 for answer in answers if answer.get("complete")),
        capabilities=CAPABILITIES, misconceptions=[MISCONCEPTION_LABELS[code] for code in codes if code in MISCONCEPTION_LABELS],
    ))


@require_POST
def restart(request):
    request.session.pop("arp_progress", None)
    return redirect("learning:start")


def rapid_fire_intro(request):
    return render(request, "learning/rapid_fire_intro.html", _context(request))


@require_POST
def rapid_fire_start(request):
    request.session["rapid_fire"] = {"answers": {}}
    return redirect("learning:rapid_fire_item", item_number=1)


def rapid_fire_item(request, item_number):
    if item_number < 1 or item_number > len(RAPID_FIRE):
        raise Http404
    item = RAPID_FIRE[item_number - 1]
    rf = request.session.setdefault("rapid_fire", {"answers": {}})
    stored = rf["answers"].get(item["id"])
    error = None
    if request.method == "POST" and not (stored and stored.get("complete")):
        stored = stored or _initial_answer()
        raw = request.POST.get("answer", "")
        value = raw.strip().lower() if item.get("type") == "fill" else raw
        correct = item["correct"].lower() if item.get("type") == "fill" else item["correct"]
        if not value:
            error = "Informe uma resposta antes de verificar."
        elif value in stored["wrong_answers"]:
            error = "Essa resposta já foi descartada. Escolha outra opção."
        else:
            _increment_attempt(stored)
            stored["last_selected"] = value
            if value == correct:
                result_type = "immediate" if stored["attempt_count"] == 1 else "guided"
                stored.update({"correct": True, "complete": True, "selected": value, "outcome": result_type, "result_type": result_type})
            else:
                stored["wrong_answers"].append(value)
                stored["incorrect_actions"].append(value)
            stored["last_feedback"] = item["feedback"]
            rf["answers"][item["id"]] = stored
    request.session.modified = True
    return render(request, "learning/rapid_fire_item.html", _context(
        request, item=item, item_number=item_number, total=len(RAPID_FIRE), result=stored, error=error
    ))


@require_POST
def rapid_fire_next(request, item_number):
    rf = request.session.get("rapid_fire", {"answers": {}})
    item = RAPID_FIRE[item_number - 1] if 1 <= item_number <= len(RAPID_FIRE) else None
    if not item or not rf["answers"].get(item["id"], {}).get("complete"):
        return redirect("learning:rapid_fire_item", item_number=item_number)
    return redirect("learning:rapid_fire_completion") if item_number == len(RAPID_FIRE) else redirect("learning:rapid_fire_item", item_number=item_number + 1)


def rapid_fire_completion(request):
    answers = request.session.get("rapid_fire", {}).get("answers", {})
    outcomes = [answer.get("outcome") for answer in answers.values()]
    return render(request, "learning/rapid_fire_completion.html", _context(
        request, immediate_count=outcomes.count("immediate"), guided_count=outcomes.count("guided"), total=len(RAPID_FIRE)
    ))
