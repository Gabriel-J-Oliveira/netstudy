import json
from unittest.mock import patch

from django.conf import settings
from django.test import TestCase
from django.urls import reverse

from .content import RAPID_FIRE
from .exercises import ACTIVITIES, ACTIVITY_MAP
from .mac_exercises import ACTIVITIES as MAC_ACTIVITIES, ACTIVITY_MAP as MAC_ACTIVITY_MAP
from .frame_checkpoint import ACTIVITIES as FRAME_ACTIVITIES, ACTIVITY_MAP as FRAME_ACTIVITY_MAP
from .arp_checkpoint import ACTIVITIES as ARP_CHECKPOINT_ACTIVITIES, ACTIVITY_MAP as ARP_CHECKPOINT_ACTIVITY_MAP
from .mac_checkpoint import ACTIVITIES as MAC_CHECKPOINT_ACTIVITIES, ACTIVITY_MAP as MAC_CHECKPOINT_ACTIVITY_MAP
from .switch_checkpoint import (
    ACTIVITIES as SWITCH_ACTIVITIES,
    ACTIVITY_MAP as SWITCH_ACTIVITY_MAP,
    MISCONCEPTION_LABELS as SWITCH_MISCONCEPTION_LABELS,
)
from .delivery_checkpoint import (
    ACTIVITIES as DELIVERY_ACTIVITIES,
    ACTIVITY_MAP as DELIVERY_ACTIVITY_MAP,
    MISCONCEPTION_LABELS as DELIVERY_MISCONCEPTION_LABELS,
)
from .vlan_checkpoint import (
    ACTIVITIES as VLAN_ACTIVITIES,
    ACTIVITY_MAP as VLAN_ACTIVITY_MAP,
    MISCONCEPTION_LABELS as VLAN_MISCONCEPTION_LABELS,
)
from .trunk_checkpoint import (
    ACTIVITIES as TRUNK_ACTIVITIES,
    ACTIVITY_MAP as TRUNK_ACTIVITY_MAP,
    MISCONCEPTION_LABELS as TRUNK_MISCONCEPTION_LABELS,
)
from .ipv4_checkpoint import (
    ACTIVITIES as IPV4_ACTIVITIES,
    ACTIVITY_MAP as IPV4_ACTIVITY_MAP,
    MISCONCEPTION_LABELS as IPV4_MISCONCEPTION_LABELS,
)
from .gateway_checkpoint import (
    ACTIVITIES as GATEWAY_ACTIVITIES,
    ACTIVITY_MAP as GATEWAY_ACTIVITY_MAP,
    MISCONCEPTION_LABELS as GATEWAY_MISCONCEPTION_LABELS,
)
from .route_checkpoint import (
    ACTIVITIES as ROUTE_ACTIVITIES,
    ACTIVITY_MAP as ROUTE_ACTIVITY_MAP,
    MISCONCEPTION_LABELS as ROUTE_MISCONCEPTION_LABELS,
)
from .inter_vlan_checkpoint import ACTIVITIES as IV_ACTIVITIES, ACTIVITY_MAP as IV_ACTIVITY_MAP, MISCONCEPTION_LABELS as IV_MISCONCEPTION_LABELS
from .icmp_checkpoint import ACTIVITIES as ICMP_ACTIVITIES, ACTIVITY_MAP as ICMP_ACTIVITY_MAP, MISCONCEPTION_LABELS as ICMP_MISCONCEPTION_LABELS
from .transport_checkpoint import ACTIVITIES as TRANSPORT_ACTIVITIES, ACTIVITY_MAP as TRANSPORT_ACTIVITY_MAP, MISCONCEPTION_LABELS as TRANSPORT_MISCONCEPTION_LABELS


class ProjectAndConceptTests(TestCase):
    def test_home_loads(self):
        response = self.client.get(reverse("learning:home"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Estudo de Redes")

    def test_concept_page_integrates_images_and_complete_flow(self):
        response = self.client.get(reverse("learning:start"), follow=True)
        self.assertContains(response, "Veja o ARP acontecendo")
        for image_name in (
            "arp-basic-flow.png", "arp-request-broadcast.png",
            "arp-cache-before-after.png", "arp-local-vs-remote.png",
        ):
            self.assertContains(response, image_name)
        self.assertContains(response, "Veja o sistema completo")
        self.assertContains(response, 'data-complete-flow', html=False)
        self.assertContains(response, "Mesma rede")
        self.assertContains(response, "Outra rede")
        self.assertContains(response, reverse("learning:arp_checkpoint_start"))
        self.assertNotContains(response, reverse("learning:rapid_fire_intro"))
        self.assertNotContains(response, reverse("learning:begin"))

    def test_arp_has_exactly_seven_active_areas_and_required_components(self):
        response = self.client.get(reverse("learning:concept"))
        self.assertContains(response, 'data-arp-area=', count=7, html=False)
        for number in range(1, 8):
            self.assertContains(response, f"{number:02d} ·")
        self.assertNotContains(response, "08 ·")
        self.assertContains(response, "NetStudy Terminal")
        self.assertContains(response, 'data-arp-terminal', html=False)
        self.assertContains(response, 'data-scope-explorer', html=False)
        self.assertContains(response, 'data-complete-flow', html=False)
        self.assertContains(response, "COMEÇAR CHECKPOINT")

    def test_arp_area_one_uses_accessible_problem_builder_without_timed_intro(self):
        response = self.client.get(reverse("learning:concept"))
        self.assertContains(response, 'data-arp-problem-builder', html=False)
        self.assertContains(response, 'data-problem-token=', count=5, html=False)
        self.assertContains(response, 'data-problem-slot=', count=3, html=False)
        self.assertContains(response, "MAC que PC-A precisa colocar no Destination MAC")
        self.assertContains(response, "IPv4 conhecido → ARP descobre MAC → Destination MAC pode ser preenchido")
        self.assertContains(response, "Ver diagrama ampliado")
        self.assertNotContains(response, 'data-arp-intro', html=False)
        self.assertNotContains(response, "Ver acontecer")

    def test_arp_area_one_assets_drop_obsolete_intro_logic_and_styles(self):
        javascript = (settings.BASE_DIR / "static" / "js" / "arp-concept.js").read_text(encoding="utf-8")
        stylesheet = (settings.BASE_DIR / "static" / "css" / "arp-concept.css").read_text(encoding="utf-8")
        self.assertIn("setupProblemBuilder", javascript)
        self.assertNotIn("setupIntroDemo", javascript)
        self.assertNotIn("data-arp-intro", javascript)
        self.assertIn(".problem-slots", stylesheet)
        self.assertNotIn(".arp-intro-demo", stylesheet)
        self.assertNotIn(".intro-arp-sequence", stylesheet)
        self.assertIn("prefers-reduced-motion", stylesheet)

    def test_arp_legacy_rapid_fire_and_twenty_activity_routes_stay_available(self):
        self.assertEqual(self.client.get(reverse("learning:rapid_fire_intro")).status_code, 200)
        response = self.client.post(reverse("learning:begin"), follow=True)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Atividade 1 de 20")
        concept = self.client.get(reverse("learning:concept"))
        self.assertNotContains(concept, reverse("learning:rapid_fire_intro"))
        self.assertNotContains(concept, reverse("learning:begin"))

    @patch("learning.views.Path.exists", return_value=False)
    def test_concept_page_keeps_image_fallbacks(self, _mock_exists):
        response = self.client.get(reverse("learning:start"), follow=True)
        self.assertContains(response, "Conteúdo visual será adicionado posteriormente.", count=4)
        self.assertNotContains(response, "data-concept-image", html=False)

    def test_mac_concept_loads_and_appears_on_home(self):
        home = self.client.get(reverse("learning:home"))
        self.assertContains(home, "MAC Address")
        self.assertContains(home, reverse("learning:mac_concept"))
        response = self.client.get(reverse("learning:mac_concept"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "O endereço usado pela Ethernet")
        self.assertContains(response, 'aria-current="page">Conteúdos</a>', html=False)

    def test_mac_area_one_builds_source_then_asks_for_destination_mac(self):
        response = self.client.get(reverse("learning:mac_concept"))
        self.assertContains(response, 'data-mac-frame-builder', html=False)
        self.assertContains(response, 'data-mac-source-value', html=False)
        self.assertContains(response, 'data-mac-destination-slot', html=False)
        self.assertContains(response, 'data-mac-destination-token=', count=4, html=False)
        self.assertContains(response, "Ainda não preenchido", count=2)
        self.assertContains(response, "Reproduzir novamente")
        self.assertContains(response, "Source MAC identifica quem enviou este frame")
        self.assertContains(response, "MAC não é um “nome universal do computador”")
        self.assertContains(response, "Ver ilustração complementar")

    def test_mac_area_one_assets_cover_guided_errors_and_accessibility(self):
        javascript = (settings.BASE_DIR / "static" / "js" / "mac-concept.js").read_text(encoding="utf-8")
        stylesheet = (settings.BASE_DIR / "static" / "css" / "mac-concept.css").read_text(encoding="utf-8")
        for fragment in (
            "setupOpeningFrame", "Um endereço IPv4 não preenche um campo MAC",
            "Source MAC de PC-A", "porta TCP 443 pertence ao contexto de transporte",
        ):
            self.assertIn(fragment, javascript)
        self.assertIn('aria-pressed', javascript)
        self.assertIn(".mac-frame-builder", stylesheet)
        self.assertIn("prefers-reduced-motion", stylesheet)

    def test_frame_concept_loads_and_appears_on_home_and_navigation(self):
        home = self.client.get(reverse("learning:home"))
        self.assertContains(home, "Frame Ethernet")
        self.assertContains(home, "Estudar Frame Ethernet")
        self.assertContains(home, reverse("learning:frame_concept"))
        response = self.client.get(reverse("learning:frame_concept"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "O que é um Frame Ethernet?")
        self.assertContains(response, 'aria-current="page">Conteúdos</a>', html=False)

    def test_frame_keeps_arp_and_mac_available_and_links_to_both(self):
        response = self.client.get(reverse("learning:frame_concept"))
        self.assertContains(response, "Revisar ARP")
        self.assertContains(response, "Revisar MAC")
        self.assertContains(response, reverse("learning:concept"))
        self.assertContains(response, reverse("learning:mac_concept"))
        self.assertEqual(self.client.get(reverse("learning:concept")).status_code, 200)
        self.assertEqual(self.client.get(reverse("learning:mac_concept")).status_code, 200)

    def test_frame_interactive_sections_and_complete_animation_are_present(self):
        response = self.client.get(reverse("learning:frame_concept"))
        self.assertContains(response, 'data-frame-inspector', html=False)
        self.assertContains(response, 'data-build-frame', html=False)
        self.assertContains(response, "Local ou remoto: o Destination MAC muda")
        self.assertContains(response, 'data-frame-scope', html=False)
        self.assertContains(response, "Ethernet II")
        self.assertContains(response, "Internet Protocol Version 4")
        self.assertContains(response, 'data-frame-full-flow', html=False)
        self.assertContains(response, "Passo <b data-full-current>1</b> de 7", html=False)

    def test_frame_v5d_has_exactly_seven_conceptual_areas(self):
        response = self.client.get(reverse("learning:frame_concept"))
        self.assertContains(response, "OSI · CAMADA 2")
        self.assertNotContains(response, "Onde esse frame aparece?")
        self.assertContains(response, 'data-frame-area=', count=7, html=False)
        for number in range(1, 8):
            self.assertContains(response, f"{number:02d} ·")
        self.assertNotContains(response, "08 ·")
        self.assertNotContains(response, "E VLAN?")

    def test_frame_area_one_focuses_on_data_frame_and_transmission(self):
        response = self.client.get(reverse("learning:frame_concept"))
        self.assertContains(response, 'data-intro-frame', html=False)
        self.assertContains(response, "DADOS AINDA NÃO ORGANIZADOS COMO FRAME")
        self.assertContains(response, "Etapa <b data-intro-current>1</b> de 7", html=False)
        self.assertContains(response, "▶ Reproduzir")
        self.assertContains(response, "Dados precisam de uma estrutura Ethernet para serem transmitidos localmente. Essa estrutura é o frame.")
        for removed in (
            "HOST → INTERFACE DE REDE", "DESTINO LOCAL ou GATEWAY",
            "IP destino final", "Switch e gateway aparecerão em conteúdos próprios.",
        ):
            self.assertNotContains(response, removed)

    def test_frame_area_one_animation_is_step_controlled_without_timers(self):
        javascript = (settings.BASE_DIR / "static" / "js" / "frame-concept.js").read_text(encoding="utf-8")
        stylesheet = (settings.BASE_DIR / "static" / "css" / "frame-concept.css").read_text(encoding="utf-8")
        self.assertIn("function setupIntroFrame", javascript)
        self.assertIn('current === messages.length ? 1 : current + 1', javascript)
        self.assertIn('data-intro-current', javascript)
        self.assertNotIn("setupFirstFrameClaims", javascript)
        intro_source = javascript[javascript.index("function setupIntroFrame"):javascript.index("function setupLocalBuilder")]
        self.assertNotIn("setTimeout", intro_source)
        self.assertNotIn("setInterval", intro_source)
        self.assertIn(".intro-process", stylesheet)
        self.assertIn("@media (max-width: 420px)", stylesheet)
        self.assertIn("prefers-reduced-motion", stylesheet)
        self.assertNotIn(".frame-note", stylesheet)

    def test_frame_v5d_merges_old_standalone_sections_into_final_architecture(self):
        response = self.client.get(reverse("learning:frame_concept"))
        for title in (
            "01 · O QUE É UM FRAME ETHERNET?", "02 · O QUE EXISTE DENTRO DO FRAME?",
            "03 · COMO O FRAME É CONSTRUÍDO?", "04 · ARP + MAC + FRAME",
            "05 · DESTINO LOCAL × REMOTO", "06 · VEJA ISSO EM UMA CAPTURA",
            "07 · JUNTE TUDO",
        ):
            self.assertContains(response, title)
        for old_section in (
            "SOURCE × DESTINATION", "DADOS ENTRAM NO FRAME", "FRAME NÃO É...",
            "MODELO MENTAL FINAL", "VISÃO COMPLETA ANIMADA", "TRANSIÇÃO PARA O CHECKPOINT",
        ):
            self.assertNotContains(response, old_section)
        self.assertContains(response, "Modelo mental")
        self.assertContains(response, 'data-frame-full-flow', html=False)

    def test_frame_v5d_preserves_required_interactions(self):
        response = self.client.get(reverse("learning:frame_concept"))
        for marker in (
            "data-intro-frame", "data-field-builder",
            "data-direction-prediction", "data-connect-terminal", "data-packet-inspector",
            "data-model-recall", "data-frame-full-flow",
        ):
            self.assertContains(response, marker, html=False)
        self.assertContains(response, "Windows Terminal")
        self.assertContains(response, "Packet Inspector")
        self.assertContains(response, "COMEÇAR CHECKPOINT")
        self.assertNotContains(response, "data-first-frame-claims", html=False)
        self.assertNotContains(response, "data-packing-demo", html=False)
        self.assertNotContains(response, "data-contrast-sort", html=False)

    def test_frame_v5d_removes_redundant_concept_images(self):
        response = self.client.get(reverse("learning:frame_concept"))
        for image_name in (
            "frame-basic-structure.png", "frame-data-encapsulation.png", "frame-local-vs-remote.png",
        ):
            self.assertNotContains(response, image_name)

    def test_frame_checkpoint_links_to_available_switch_route(self):
        response = self.client.get(reverse("learning:frame_concept"))
        self.assertContains(response, "Agora você já sabe o suficiente")
        self.assertContains(response, "COMEÇAR CHECKPOINT")
        self.assertContains(response, reverse("learning:frame_checkpoint_start"))
        self.assertContains(self.client.get(reverse("learning:home")), reverse("learning:switch_concept"))
        self.assertEqual(self.client.get(reverse("learning:switch_concept")).status_code, 200)
        self.assertNotContains(response, 'href="/frame/atividades/', html=False)
        self.assertNotContains(response, 'href="/frame/rapid-fire/', html=False)

    def test_mac_links_to_arp_and_keeps_arp_available(self):
        response = self.client.get(reverse("learning:mac_concept"))
        self.assertContains(response, "Revisar ARP")
        self.assertContains(response, reverse("learning:concept"))
        arp = self.client.get(reverse("learning:concept"))
        self.assertEqual(arp.status_code, 200)
        self.assertContains(arp, "Address Resolution Protocol")

    def test_mac_animation_and_future_image_paths_are_present(self):
        response = self.client.get(reverse("learning:mac_concept"))
        self.assertContains(response, "PC-A possui dados")
        self.assertContains(response, "data-mac-full-flow", html=False)
        for image_name in (
            "mac-source-destination.png", "mac-local-vs-gateway.png", "mac-arp-to-frame.png",
        ):
            self.assertContains(response, image_name)
        self.assertContains(response, "Conteúdo visual será adicionado posteriormente.", count=3)

    def test_mac_has_exactly_seven_active_areas_and_required_components(self):
        response = self.client.get(reverse("learning:mac_concept"))
        self.assertContains(response, 'data-mac-area=', count=7, html=False)
        for number in range(1, 8):
            self.assertContains(response, f"{number:02d} ·")
        self.assertNotContains(response, "08 ·")
        self.assertContains(response, "NetStudy Terminal")
        self.assertContains(response, "ipconfig /all")
        self.assertContains(response, "arp -a")
        self.assertContains(response, "data-mac-scope", html=False)
        self.assertContains(response, "data-mac-full-flow", html=False)
        self.assertContains(response, "COMEÇAR CHECKPOINT")

    def test_mac_legacy_routes_remain_but_leave_primary_flow(self):
        self.assertEqual(self.client.get(reverse("learning:mac_rapid_fire")).status_code, 200)
        activities = self.client.get(reverse("learning:mac_activities"))
        self.assertEqual(activities.status_code, 200)
        self.assertContains(activities, "20 atividades")
        concept = self.client.get(reverse("learning:mac_concept"))
        self.assertNotContains(concept, reverse("learning:mac_rapid_fire"))
        self.assertNotContains(concept, reverse("learning:mac_activities"))

    def test_mac_rapid_fire_remains_provisional_and_activities_are_available(self):
        rapid_fire = self.client.get(reverse("learning:mac_rapid_fire"))
        self.assertEqual(rapid_fire.status_code, 200)
        self.assertContains(rapid_fire, "próxima etapa")
        activities = self.client.get(reverse("learning:mac_activities"))
        self.assertEqual(activities.status_code, 200)
        self.assertContains(activities, "20 atividades")

    def test_contextual_terms_on_arp_mac_and_frame(self):
        expected = {
            "learning:concept": {
                "arp-tip-resolution": "Descoberta do MAC associado ao IPv4",
                "arp-tip-cache": "Lista temporária de associações IPv4",
            },
            "learning:mac_concept": {
                "mac-tip-hex": "Sistema de numeração que usa 0–9 e A–F",
                "mac-tip-interface": "Conexão de rede do host",
            },
            "learning:frame_concept": {
                "frame-tip-fcs": "Frame Check Sequence",
            },
        }
        for route, definitions in expected.items():
            response = self.client.get(reverse(route))
            self.assertEqual(response.status_code, 200)
            self.assertContains(response, 'data-context-glossary', count=len(definitions), html=False)
            self.assertContains(response, "context-glossary.css")
            self.assertContains(response, "context-glossary.js")
            for tooltip_id, definition in definitions.items():
                self.assertContains(response, f'aria-controls="{tooltip_id}"')
                self.assertContains(response, f'aria-describedby="{tooltip_id}"')
                self.assertContains(response, f'id="{tooltip_id}" role="tooltip" hidden')
                self.assertContains(response, definition)
            self.assertContains(response, "COMEÇAR CHECKPOINT")
        script = (settings.BASE_DIR / "static" / "js" / "context-glossary.js").read_text(encoding="utf-8")
        stylesheet = (settings.BASE_DIR / "static" / "css" / "context-glossary.css").read_text(encoding="utf-8")
        for fragment in ('event.pointerType === "mouse"', 'event.pointerType !== "touch"', 'event.key === "Escape"', 'aria-expanded', 'window.innerWidth'):
            self.assertIn(fragment, script)
        for fragment in (":focus-visible", "100vw - 1rem", "[hidden]"):
            self.assertIn(fragment, stylesheet)


class ExerciseSessionTests(TestCase):
    def start(self):
        self.client.get(reverse("learning:start"), follow=True)
        self.client.post(reverse("learning:begin"), follow=True)

    def post_answer(self, activity_id, value):
        return self.client.post(reverse("learning:activity", args=[activity_id]), {"answer": value})

    def post_payload(self, activity_id, value):
        return self.client.post(reverse("learning:activity", args=[activity_id]), {"answer_payload": json.dumps(value)})

    def test_session_has_exactly_twenty_activities_in_order(self):
        self.assertEqual(len(ACTIVITIES), 20)
        self.assertEqual([activity["id"] for activity in ACTIVITIES], [str(number) for number in range(1, 21)])

    def test_all_twenty_accept_their_defined_correct_submission(self):
        self.start()
        discrete = {"terminal_hotspot", "multiple_choice", "topology_hotspot", "find_inconsistency", "compare_outputs"}
        mapping = {"pair_match", "token_fill", "sort_into_buckets", "sentence_repair", "table_builder", "evidence_sort", "diagnostic_map", "concept_map_builder"}
        for activity in ACTIVITIES:
            if activity["type"] in discrete:
                response = self.post_answer(activity["id"], activity["correct"])
            elif activity["type"] == "predict_then_reveal" and activity.get("fields"):
                response = self.client.post(reverse("learning:activity", args=[activity["id"]]), activity["correct_fields"])
            elif activity["type"] in {"predict_then_reveal", "command_fill"}:
                response = self.post_answer(activity["id"], activity["correct"])
            elif activity["type"] in mapping:
                response = self.post_payload(activity["id"], activity["correct_map"])
            elif activity["type"] in {"ordering", "event_selection_order"}:
                response = self.post_payload(activity["id"], activity["correct_order"])
            else:
                self.fail(f"Tipo sem cobertura: {activity['type']}")
            self.assertEqual(response.status_code, 200, activity["id"])
            self.assertTrue(self.client.session["arp_progress"]["answers"][activity["id"]]["complete"], activity["id"])

    def test_progression_labels_run_from_one_to_twenty(self):
        self.start()
        first = self.client.get(reverse("learning:activity", args=["1"]))
        last = self.client.get(reverse("learning:activity", args=["20"]))
        self.assertContains(first, "Atividade 1 de 20")
        self.assertContains(last, "Atividade 20 de 20")

    def test_first_correct_action_is_immediate(self):
        self.start()
        response = self.post_answer("1", "mac80")
        stored = self.client.session["arp_progress"]["answers"]["1"]
        self.assertContains(response, "Correto")
        self.assertEqual(stored["attempt_count"], 1)
        self.assertEqual(stored["result_type"], "immediate")

    def test_wrong_then_correct_is_guided_without_early_reveal(self):
        self.start()
        wrong = self.post_answer("1", "ip80")
        stored = self.client.session["arp_progress"]["answers"]["1"]
        self.assertFalse(stored["complete"])
        self.assertEqual(stored["incorrect_actions"], ["ip80"])
        self.assertNotContains(wrong, "is-correct")
        self.assertNotContains(wrong, "A linha associa")
        correct = self.post_answer("1", "mac80")
        stored = self.client.session["arp_progress"]["answers"]["1"]
        self.assertEqual(stored["result_type"], "guided")
        self.assertContains(correct, "is-wrong")
        self.assertContains(correct, "is-correct")

    def test_wrong_state_survives_between_requests_and_is_blocked(self):
        self.start()
        self.post_answer("1", "mac1")
        response = self.client.get(reverse("learning:activity", args=["1"]))
        self.assertContains(response, 'value="mac1"', html=False)
        self.assertContains(response, "is-wrong")
        self.post_answer("1", "mac1")
        self.assertEqual(self.client.session["arp_progress"]["answers"]["1"]["attempt_count"], 1)

    def test_advance_uses_defined_order(self):
        self.start()
        self.post_answer("1", "mac80")
        response = self.client.post(reverse("learning:advance", args=["1"]), follow=True)
        self.assertContains(response, "Atividade 2 de 20")
        self.assertContains(response, "Qual MAC cada comunicação precisa?")

    def test_command_fill_accepts_normalized_a(self):
        self.start()
        response = self.post_answer("13", "   -A   ")
        stored = self.client.session["arp_progress"]["answers"]["13"]
        self.assertTrue(stored["complete"])
        self.assertEqual(stored["last_payload"], "-a")
        self.assertContains(response, "arp -a")

    def test_command_fill_a_and_d_have_specific_feedback(self):
        self.start()
        response_a = self.post_answer("13", "a")
        self.assertContains(response_a, "parâmetro com hífen")
        response_d = self.post_answer("13", "-d")
        self.assertContains(response_d, "exclusão de entradas")
        self.assertContains(response_d, "Pista")

    def test_topology_wrong_selection_allows_retry(self):
        self.start()
        wrong = self.post_answer("9", "switch")
        self.assertContains(wrong, "não precisa resolver o MAC do switch")
        self.assertFalse(self.client.session["arp_progress"]["answers"]["9"]["complete"])
        correct = self.post_answer("9", "pc-b")
        self.assertContains(correct, "O destino é local e ainda não existe associação")
        self.assertEqual(self.client.session["arp_progress"]["answers"]["9"]["result_type"], "guided")

    def test_remote_topology_recognizes_gateway(self):
        self.start()
        self.post_answer("10", "cache-gateway")
        self.assertTrue(self.client.session["arp_progress"]["answers"]["10"]["complete"])

    def test_sorting_wrong_does_not_complete_and_correct_does(self):
        self.start()
        wrong_map = dict(ACTIVITY_MAP["5"]["correct_map"])
        wrong_map["q"] = "reply"
        wrong = self.post_payload("5", wrong_map)
        self.assertContains(wrong, "pergunta procura a associação")
        self.assertFalse(self.client.session["arp_progress"]["answers"]["5"]["complete"])
        correct = self.post_payload("5", ACTIVITY_MAP["5"]["correct_map"])
        self.assertContains(correct, "Request revela a necessidade")
        self.assertTrue(self.client.session["arp_progress"]["answers"]["5"]["complete"])

    def test_pair_matching_completes_with_correct_map(self):
        self.start()
        self.post_payload("2", ACTIVITY_MAP["2"]["correct_map"])
        self.assertEqual(self.client.session["arp_progress"]["answers"]["2"]["result_type"], "immediate")

    def test_ordering_wrong_does_not_reveal_solution(self):
        self.start()
        wrong_order = ACTIVITY_MAP["8"]["items"]
        response = self.post_payload("8", wrong_order)
        self.assertContains(response, "Algumas etapas estão fora de ordem")
        self.assertContains(response, "position-wrong")
        self.assertNotContains(response, "Correto. O ARP entra")
        self.assertFalse(self.client.session["arp_progress"]["answers"]["8"]["complete"])

    def test_ordering_correct_completes(self):
        self.start()
        response = self.post_payload("8", ACTIVITY_MAP["8"]["correct_order"])
        self.assertContains(response, "Correto. O ARP entra")
        self.assertTrue(self.client.session["arp_progress"]["answers"]["8"]["complete"])

    def test_concept_map_and_free_reference_are_separate(self):
        self.start()
        self.post_payload("20", ACTIVITY_MAP["20"]["correct_map"])
        response = self.client.post(reverse("learning:activity", args=["20"]), {
            "free_text": "Minha explicação", "reveal_reference": "1",
        })
        stored = self.client.session["arp_progress"]["answers"]["20"]
        self.assertEqual(stored["free_text"], "Minha explicação")
        self.assertTrue(stored["reference_revealed"])
        self.assertContains(response, "Resposta de referência")

    def test_final_advance_reaches_completion(self):
        self.start()
        progress = self.client.session["arp_progress"]
        progress["answers"]["20"] = {"complete": True, "result_type": "immediate", "misconception_codes": [], "reference_revealed": True}
        session = self.client.session
        session["arp_progress"] = progress
        session.save()
        response = self.client.post(reverse("learning:advance", args=["20"]), follow=True)
        self.assertContains(response, "Sessão concluída")

    def test_summary_counts_results_and_hides_absent_misconceptions(self):
        self.start()
        progress = self.client.session["arp_progress"]
        progress["answers"] = {
            str(number): {"complete": True, "result_type": "immediate" if number <= 12 else "guided", "misconception_codes": []}
            for number in range(1, 21)
        }
        session = self.client.session
        session["arp_progress"] = progress
        session.save()
        response = self.client.get(reverse("learning:completion"))
        self.assertContains(response, "20 atividades realizadas")
        self.assertContains(response, ">12<", html=False)
        self.assertContains(response, ">8<", html=False)
        self.assertNotContains(response, "Pontos que apareceram durante a sessão")

    def test_summary_shows_only_misconceptions_that_occurred(self):
        self.start()
        self.post_answer("4", "A")
        self.post_answer("4", "B")
        response = self.client.get(reverse("learning:completion"))
        self.assertContains(response, "Pontos que apareceram durante a sessão")
        self.assertContains(response, "Destino remoto × gateway")
        self.assertNotContains(response, "ARP × tabela MAC")

    def test_activity_10_existing_gateway_cache_and_retry(self):
        self.start()
        wrong = self.post_answer("10", "gateway")
        self.assertContains(wrong, "onde a informação necessária já está disponível")
        self.assertFalse(self.client.session["arp_progress"]["answers"]["10"]["complete"])
        correct = self.post_answer("10", "cache-gateway")
        self.assertContains(correct, "sem iniciar imediatamente uma nova descoberta ARP")
        self.assertEqual(self.client.session["arp_progress"]["answers"]["10"]["result_type"], "guided")

    def test_activity_11_validates_two_request_fields(self):
        self.start()
        wrong = self.client.post(reverse("learning:activity", args=["11"]), {"target": "8.8.8.8", "sender": "192.168.10.25"})
        self.assertContains(wrong, "ARP precisa resolver o próximo salto local")
        self.assertFalse(self.client.session["arp_progress"]["answers"]["11"]["complete"])
        correct = self.client.post(reverse("learning:activity", args=["11"]), {"target": "192.168.10.1", "sender": "192.168.10.25"})
        self.assertContains(correct, "Who has 192.168.10.1?")
        self.assertTrue(self.client.session["arp_progress"]["answers"]["11"]["complete"])

    def test_activity_14_requires_gateway_row(self):
        self.start()
        wrong = self.post_answer("14", "row50")
        self.assertContains(wrong, "outro host local")
        self.assertFalse(self.client.session["arp_progress"]["answers"]["14"]["complete"])
        correct = self.post_answer("14", "row1")
        self.assertContains(correct, "primeiro frame Ethernet precisa ser entregue ao gateway")

    def test_activity_15_expected_is_correct_without_early_reveal(self):
        self.start()
        wrong = self.post_answer("15", "incompatible")
        self.assertNotContains(wrong, "Não existe motivo para aprender diretamente")
        self.assertFalse(self.client.session["arp_progress"]["answers"]["15"]["complete"])
        self.post_answer("15", "expected")
        self.assertTrue(self.client.session["arp_progress"]["answers"]["15"]["complete"])

    def test_activity_16_filters_only_ipv4_to_mac(self):
        self.start()
        wrong_mac = self.post_payload("16", {"macport": "row1", "arp20": "row2", "arp30": "row3"})
        self.assertContains(wrong_mac, "tabela MAC de switch")
        wrong_dns = self.post_payload("16", {"dns": "row1", "arp20": "row2", "arp30": "row3"})
        self.assertContains(wrong_dns, "relação nome")
        self.post_payload("16", {"arp1": "row1", "arp20": "row2", "arp30": "row3"})
        self.assertTrue(self.client.session["arp_progress"]["answers"]["16"]["complete"])

    def test_activity_17_flags_remote_entry(self):
        self.start()
        self.post_answer("17", "remote")
        self.assertTrue(self.client.session["arp_progress"]["answers"]["17"]["complete"])

    def test_activity_20_keeps_final_ip_separate_from_next_hop(self):
        self.start()
        wrong = dict(ACTIVITY_MAP["20"]["correct_map"])
        del wrong["remote8"]
        wrong["remote1"] = "remote-final"
        response = self.post_payload("20", wrong)
        self.assertContains(response, "não substitui o destino IP final")
        self.assertFalse(self.client.session["arp_progress"]["answers"]["20"]["complete"])
        self.post_payload("20", ACTIVITY_MAP["20"]["correct_map"])
        self.assertTrue(self.client.session["arp_progress"]["answers"]["20"]["complete"])


class MacExerciseSessionTests(TestCase):
    def start(self):
        return self.client.post(reverse("learning:mac_begin"), follow=True)

    def post_answer(self, activity_id, value):
        return self.client.post(reverse("learning:mac_activity", args=[activity_id]), {"answer": value})

    def post_payload(self, activity_id, value):
        return self.client.post(
            reverse("learning:mac_activity", args=[activity_id]),
            {"answer_payload": json.dumps(value)},
        )

    def test_session_has_exactly_twenty_activities_and_expected_difficulties(self):
        self.assertEqual(len(MAC_ACTIVITIES), 20)
        self.assertEqual([item["id"] for item in MAC_ACTIVITIES], [str(number) for number in range(1, 21)])
        self.assertEqual([item["difficulty_level"] for item in MAC_ACTIVITIES], [
            1, 2, 2, 2, 3, 3, 4, 4, 1, 3, 4, 4, 3, 3, 3, 4, 4, 4, 5, 4,
        ])
        self.assertLessEqual(sum(item["type"] == "multiple_choice" for item in MAC_ACTIVITIES), 2)

    def test_all_twenty_accept_their_defined_correct_submission(self):
        self.start()
        discrete = {"visual_selection", "find_inconsistency", "frame_hotspot", "topology_hotspot", "terminal_hotspot"}
        mapping = {
            "sentence_repair", "frame_builder", "dual_concept_map", "command_match",
            "compare_outputs_builder", "process_builder", "concept_relation_builder",
            "role_sort", "evidence_sort", "diagnostic_map", "concept_map_builder",
        }
        for activity in MAC_ACTIVITIES:
            if activity["type"] in discrete:
                response = self.post_answer(activity["id"], activity["correct"])
            elif activity["type"] in mapping:
                response = self.post_payload(activity["id"], activity["correct_map"])
            elif activity["type"] == "integrated_flow_builder":
                response = self.post_payload(activity["id"], activity["correct_order"])
            else:
                self.fail(f"Tipo MAC sem cobertura: {activity['type']}")
            self.assertEqual(response.status_code, 200, activity["id"])
            self.assertTrue(self.client.session["mac_progress"]["answers"][activity["id"]]["complete"], activity["id"])

    def test_progression_runs_from_one_to_twenty_and_uses_separate_session(self):
        first = self.start()
        self.assertContains(first, "Atividade 1 de 20")
        self.assertContains(self.client.get(reverse("learning:mac_activity", args=["20"])), "Atividade 20 de 20")
        self.assertIn("mac_progress", self.client.session)
        self.assertNotIn("arp_progress", self.client.session)

    def test_immediate_and_guided_without_early_reveal(self):
        self.start()
        wrong = self.post_answer("1", "ipv4")
        self.assertContains(wrong, "formato de um endereço IPv4")
        self.assertNotContains(wrong, "seis grupos de dois dígitos")
        self.assertNotContains(wrong, "is-correct")
        correct = self.post_answer("1", "mac")
        stored = self.client.session["mac_progress"]["answers"]["1"]
        self.assertEqual(stored["result_type"], "guided")
        self.assertContains(correct, "is-wrong")
        self.assertContains(correct, "is-correct")
        self.post_answer("2", "ipv4")
        self.assertEqual(self.client.session["mac_progress"]["answers"]["2"]["result_type"], "immediate")

    def test_frame_builder_accepts_source_destination_and_rejects_inversion(self):
        self.start()
        inverted = {"mac-a": "destination", "mac-b": "source"}
        response = self.post_payload("5", inverted)
        self.assertContains(response, "Verifique quem está enviando")
        self.assertFalse(self.client.session["mac_progress"]["answers"]["5"]["complete"])
        response = self.post_payload("5", MAC_ACTIVITY_MAP["5"]["correct_map"])
        self.assertContains(response, "PC-A é a origem Ethernet")
        self.assertEqual(self.client.session["mac_progress"]["answers"]["5"]["result_type"], "guided")

    def test_remote_frame_requires_gateway_mac_and_records_misconception(self):
        self.start()
        wrong = {"mac-a": "source", "remote-mac": "destination"}
        response = self.post_payload("7", wrong)
        self.assertContains(response, "primeiro frame precisa ser entregue ao gateway")
        stored = self.client.session["mac_progress"]["answers"]["7"]
        self.assertIn("confuses_remote_ip_with_destination_mac", stored["misconception_codes"])
        self.post_payload("7", MAC_ACTIVITY_MAP["7"]["correct_map"])
        self.assertTrue(self.client.session["mac_progress"]["answers"]["7"]["complete"])

    def test_terminal_distinguishes_ipconfig_physical_address(self):
        self.start()
        wrong = self.post_answer("9", "ipv4")
        self.assertContains(wrong, "endereço lógico IPv4")
        correct = self.post_answer("9", "physical")
        self.assertContains(correct, "Endereço Físico")

    def test_command_match_distinguishes_ipconfig_and_arp(self):
        self.start()
        self.post_payload("10", MAC_ACTIVITY_MAP["10"]["correct_map"])
        stored = self.client.session["mac_progress"]["answers"]["10"]
        self.assertTrue(stored["complete"])
        response = self.client.get(reverse("learning:mac_activity", args=["10"]))
        self.assertContains(response, "ipconfig /all")
        self.assertContains(response, "arp -a")

    def test_compare_outputs_derives_source_from_ipconfig_and_destination_from_arp(self):
        self.start()
        local = self.post_payload("11", MAC_ACTIVITY_MAP["11"]["correct_map"])
        self.assertContains(local, "cruzar o MAC da própria interface")
        remote_wrong = self.post_payload("12", {"own": "source", "local80": "destination"})
        self.assertContains(remote_wrong, "primeiro frame precisa ser entregue ao gateway")
        self.post_payload("12", MAC_ACTIVITY_MAP["12"]["correct_map"])
        self.assertTrue(self.client.session["mac_progress"]["answers"]["12"]["complete"])

    def test_integrated_local_and_remote_flows_and_second_error_hint(self):
        self.start()
        wrong = list(MAC_ACTIVITY_MAP["16"]["items"])
        first = self.post_payload("16", wrong)
        self.assertContains(first, "Algumas etapas estão fora de ordem")
        second = self.post_payload("16", wrong)
        self.assertContains(second, "O frame só pode receber")
        self.post_payload("16", MAC_ACTIVITY_MAP["16"]["correct_order"])
        self.post_payload("17", MAC_ACTIVITY_MAP["17"]["correct_order"])
        self.assertTrue(self.client.session["mac_progress"]["answers"]["16"]["complete"])
        self.assertTrue(self.client.session["mac_progress"]["answers"]["17"]["complete"])

    def test_diagnostic_map_rejects_unsupported_hypotheses(self):
        self.start()
        wrong = {"dns": "affirm", "arp-less": "less", "all-ok": "unknown"}
        response = self.post_payload("19", wrong)
        self.assertContains(response, "Nada apresentado aponta especificamente para DNS")
        self.assertFalse(self.client.session["mac_progress"]["answers"]["19"]["complete"])
        self.post_payload("19", MAC_ACTIVITY_MAP["19"]["correct_map"])
        self.assertTrue(self.client.session["mac_progress"]["answers"]["19"]["complete"])

    def test_concept_map_keeps_free_explanation_unscored(self):
        self.start()
        self.post_payload("20", MAC_ACTIVITY_MAP["20"]["correct_map"])
        response = self.client.post(reverse("learning:mac_activity", args=["20"]), {
            "free_text": "MAC é a informação e ARP ajuda a encontrá-la.",
            "reveal_reference": "1",
        })
        stored = self.client.session["mac_progress"]["answers"]["20"]
        self.assertTrue(stored["reference_revealed"])
        self.assertEqual(stored["attempt_count"], 1)
        self.assertContains(response, "Resposta de referência")
        self.assertContains(response, "a informação — MAC — do mecanismo")

    def test_final_advance_and_summary_counts(self):
        self.start()
        progress = self.client.session["mac_progress"]
        progress["answers"] = {
            str(number): {
                "complete": True,
                "result_type": "immediate" if number <= 13 else "guided",
                "misconception_codes": [],
                "reference_revealed": number == 20,
            }
            for number in range(1, 21)
        }
        session = self.client.session
        session["mac_progress"] = progress
        session.save()
        response = self.client.post(reverse("learning:mac_advance", args=["20"]), follow=True)
        self.assertContains(response, "20 atividades realizadas")
        self.assertContains(response, ">13<", html=False)
        self.assertContains(response, ">7<", html=False)
        self.assertContains(response, "Conceitos conectados nesta sessão")
        self.assertNotContains(response, "Pontos que apareceram durante a sessão")

    def test_summary_shows_only_misconceptions_that_occurred(self):
        self.start()
        self.post_answer("1", "ipv4")
        self.post_answer("1", "mac")
        response = self.client.get(reverse("learning:mac_completion"))
        self.assertContains(response, "MAC × IPv4")
        self.assertNotContains(response, "Source MAC × Destination MAC")
        self.assertNotContains(response, "MAC × porta do switch")


class MacCheckpointTests(TestCase):
    def start(self, ajax=False):
        extra = {"HTTP_X_REQUESTED_WITH": "XMLHttpRequest", "HTTP_ACCEPT": "application/json"} if ajax else {}
        return self.client.post(reverse("learning:mac_checkpoint_start"), follow=not ajax, **extra)

    def set_current(self, activity_id):
        session = self.client.session
        progress = session.get("mac_checkpoint", {"answers": {}, "complete": False})
        progress["current"] = int(activity_id)
        session["mac_checkpoint"] = progress
        session.save()

    def post_payload(self, payload, ajax=False):
        extra = {"HTTP_X_REQUESTED_WITH": "XMLHttpRequest", "HTTP_ACCEPT": "application/json"} if ajax else {}
        return self.client.post(reverse("learning:mac_checkpoint_answer"), {"answer_payload": json.dumps(payload)}, follow=not ajax, **extra)

    def test_exactly_ten_activities_and_required_distribution(self):
        self.assertEqual(len(MAC_CHECKPOINT_ACTIVITIES), 10)
        self.assertEqual([item["difficulty_level"] for item in MAC_CHECKPOINT_ACTIVITIES], [3, 3, 3, 4, 4, 4, 4, 4, 5, 5])
        self.assertEqual([item["id"] for item in MAC_CHECKPOINT_ACTIVITIES], [str(number) for number in range(1, 11)])

    def test_ajax_start_returns_embedded_partial_without_redirect(self):
        response = self.start(ajax=True)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('id="mac-checkpoint"', payload["html"])
        self.assertIn("ATIVIDADE 1 DE 10", payload["html"])
        self.assertFalse(payload["complete"])

    def test_non_ajax_start_keeps_compatibility_redirect(self):
        response = self.start()
        self.assertEqual(response.redirect_chain[-1][0], f'{reverse("learning:mac_concept")}#mac-checkpoint')
        self.assertContains(response, "ATIVIDADE 1 DE 10")

    def test_all_ten_accept_their_defined_correct_submission(self):
        self.start()
        mapping_types = {"frame_builder", "direction_builder", "compare_outputs", "topology_builder", "evidence_sort", "diagnostic_map", "integrated_concept_map"}
        for item in MAC_CHECKPOINT_ACTIVITIES:
            self.set_current(item["id"])
            if item["type"] in mapping_types:
                response = self.post_payload(item["correct_map"])
            elif item["type"] in {"terminal_analysis", "find_inconsistency"}:
                response = self.client.post(reverse("learning:mac_checkpoint_answer"), {"answer": item["correct"]}, follow=True)
            elif item["type"] == "capture_analysis":
                self.client.post(reverse("learning:mac_checkpoint_answer"), {"answer": item["correct"]}, follow=True)
                response = self.client.post(reverse("learning:mac_checkpoint_answer"), {"evidence": item["correct_evidence"]}, follow=True)
            else:
                self.fail(f"Tipo MAC sem cobertura: {item['type']}")
            self.assertEqual(response.status_code, 200, item["id"])
            self.assertTrue(self.client.session["mac_checkpoint"]["answers"][item["id"]]["complete"], item["id"])

    def test_wrong_then_correct_is_guided_and_records_misconception(self):
        self.start()
        wrong = self.post_payload({"ip-a": "source", "mac-b": "destination"}, ajax=True).json()
        self.assertFalse(wrong["correct"])
        stored = self.client.session["mac_checkpoint"]["answers"]["1"]
        self.assertIn("confuses_mac_with_ip", stored["misconception_codes"])
        correct = self.post_payload(MAC_CHECKPOINT_ACTIVITY_MAP["1"]["correct_map"], ajax=True).json()
        self.assertTrue(correct["correct"])
        self.assertTrue(correct["guided"])

    def test_capture_requires_judgment_and_two_evidences(self):
        self.start()
        self.set_current("6")
        response = self.client.post(reverse("learning:mac_checkpoint_answer"), {"answer": "coherent"}, follow=True)
        self.assertContains(response, "Agora selecione as duas evidências")
        response = self.client.post(reverse("learning:mac_checkpoint_answer"), {"evidence": ["ip", "mac"]}, follow=True)
        self.assertTrue(self.client.session["mac_checkpoint"]["answers"]["6"]["complete"])

    def test_free_explanation_is_unscored(self):
        self.start()
        self.set_current("10")
        self.post_payload(MAC_CHECKPOINT_ACTIVITY_MAP["10"]["correct_map"])
        response = self.client.post(reverse("learning:mac_checkpoint_answer"), {"free_text": "MAC está no frame e ARP pode descobri-lo.", "reveal_reference": "1"}, follow=True)
        stored = self.client.session["mac_checkpoint"]["answers"]["10"]
        self.assertTrue(stored["reference_revealed"])
        self.assertEqual(stored["attempt_count"], 1)
        self.assertContains(response, "Resposta de referência")

    def test_ajax_advance_and_completion_summary(self):
        self.start()
        self.post_payload(MAC_CHECKPOINT_ACTIVITY_MAP["1"]["correct_map"])
        advanced = self.client.post(reverse("learning:mac_checkpoint_next"), HTTP_X_REQUESTED_WITH="XMLHttpRequest").json()
        self.assertIn("ATIVIDADE 2 DE 10", advanced["html"])
        progress = self.client.session["mac_checkpoint"]
        progress["current"] = 10
        progress["answers"] = {str(number): {"complete": True, "result_type": "immediate", "misconception_codes": [], "reference_revealed": number == 10} for number in range(1, 11)}
        session = self.client.session; session["mac_checkpoint"] = progress; session.save()
        complete = self.client.post(reverse("learning:mac_checkpoint_next"), HTTP_X_REQUESTED_WITH="XMLHttpRequest").json()
        self.assertTrue(complete["complete"])
        self.assertIn("10 situações resolvidas", complete["html"])
        self.assertIn("Próximo passo é entender como o switch", complete["html"].replace("próximo", "Próximo"))


class ArpCheckpointTests(TestCase):
    def start(self, ajax=False):
        extra = {"HTTP_X_REQUESTED_WITH": "XMLHttpRequest", "HTTP_ACCEPT": "application/json"} if ajax else {}
        return self.client.post(reverse("learning:arp_checkpoint_start"), follow=not ajax, **extra)

    def set_current(self, activity_id):
        session = self.client.session
        progress = session.get("arp_checkpoint", {"answers": {}, "complete": False})
        progress["current"] = int(activity_id)
        session["arp_checkpoint"] = progress
        session.save()

    def post_payload(self, payload, ajax=False):
        extra = {"HTTP_X_REQUESTED_WITH": "XMLHttpRequest", "HTTP_ACCEPT": "application/json"} if ajax else {}
        return self.client.post(reverse("learning:arp_checkpoint_answer"), {"answer_payload": json.dumps(payload)}, follow=not ajax, **extra)

    def test_exactly_ten_activities_and_required_distribution(self):
        self.assertEqual(len(ARP_CHECKPOINT_ACTIVITIES), 10)
        self.assertEqual([item["difficulty_level"] for item in ARP_CHECKPOINT_ACTIVITIES], [3, 3, 3, 4, 4, 4, 4, 4, 5, 5])
        self.assertEqual([item["id"] for item in ARP_CHECKPOINT_ACTIVITIES], [str(number) for number in range(1, 11)])

    def test_ajax_start_returns_embedded_partial_without_redirect(self):
        response = self.start(ajax=True)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('id="arp-checkpoint"', payload["html"])
        self.assertIn("ATIVIDADE 1 DE 10", payload["html"])
        self.assertFalse(payload["complete"])

    def test_non_ajax_start_keeps_compatibility_redirect(self):
        response = self.start()
        self.assertEqual(response.redirect_chain[-1][0], f'{reverse("learning:concept")}#arp-checkpoint')
        self.assertContains(response, "ATIVIDADE 1 DE 10")

    def test_all_ten_accept_their_defined_correct_submission(self):
        self.start()
        mapping_types = {"packet_builder", "dual_builder", "compare_outputs", "evidence_sort", "diagnostic_map", "integrated_concept_map"}
        for item in ARP_CHECKPOINT_ACTIVITIES:
            self.set_current(item["id"])
            if item["type"] in mapping_types:
                response = self.post_payload(item["correct_map"])
            elif item["type"] in {"process_builder", "event_selection"}:
                response = self.post_payload(item["correct_order"])
            elif item["type"] in {"terminal_analysis", "find_inconsistency"}:
                response = self.client.post(reverse("learning:arp_checkpoint_answer"), {"answer": item["correct"]}, follow=True)
            else:
                self.fail(f"Tipo ARP sem cobertura: {item['type']}")
            self.assertEqual(response.status_code, 200, item["id"])
            self.assertTrue(self.client.session["arp_checkpoint"]["answers"][item["id"]]["complete"], item["id"])

    def test_wrong_then_correct_is_guided_and_records_misconception(self):
        self.start()
        self.set_current("2")
        wrong = self.post_payload({"target-mac": "ethernet"}, ajax=True).json()
        self.assertFalse(wrong["correct"])
        stored = self.client.session["arp_checkpoint"]["answers"]["2"]
        self.assertIn("confuses_arp_with_mac", stored["misconception_codes"])
        correct = self.post_payload(ARP_CHECKPOINT_ACTIVITY_MAP["2"]["correct_map"], ajax=True).json()
        self.assertTrue(correct["correct"])
        self.assertTrue(correct["guided"])

    def test_free_explanation_is_unscored_and_completion_counts(self):
        self.start()
        self.set_current("10")
        self.post_payload(ARP_CHECKPOINT_ACTIVITY_MAP["10"]["correct_map"])
        response = self.client.post(reverse("learning:arp_checkpoint_answer"), {"free_text": "Nem todo frame exige nova resolução.", "reveal_reference": "1"}, follow=True)
        stored = self.client.session["arp_checkpoint"]["answers"]["10"]
        self.assertTrue(stored["reference_revealed"])
        self.assertEqual(stored["attempt_count"], 1)
        self.assertContains(response, "Resposta de referência")

    def test_ajax_advance_and_completion(self):
        self.start()
        self.post_payload(ARP_CHECKPOINT_ACTIVITY_MAP["1"]["correct_order"])
        advanced = self.client.post(reverse("learning:arp_checkpoint_next"), HTTP_X_REQUESTED_WITH="XMLHttpRequest").json()
        self.assertIn("ATIVIDADE 2 DE 10", advanced["html"])
        progress = self.client.session["arp_checkpoint"]
        progress["current"] = 10
        progress["answers"] = {str(number): {"complete": True, "result_type": "immediate", "misconception_codes": [], "reference_revealed": number == 10} for number in range(1, 11)}
        session = self.client.session; session["arp_checkpoint"] = progress; session.save()
        complete = self.client.post(reverse("learning:arp_checkpoint_next"), HTTP_X_REQUESTED_WITH="XMLHttpRequest").json()
        self.assertTrue(complete["complete"])
        self.assertIn("10 situações resolvidas", complete["html"])


class FrameCheckpointTests(TestCase):
    def start(self):
        return self.client.post(reverse("learning:frame_checkpoint_start"), follow=True)

    def post_answer(self, value):
        return self.client.post(reverse("learning:frame_checkpoint_answer"), {"answer": value}, follow=True)

    def post_payload(self, value):
        return self.client.post(
            reverse("learning:frame_checkpoint_answer"),
            {"answer_payload": json.dumps(value)},
            follow=True,
        )

    def set_current(self, activity_id):
        session = self.client.session
        progress = session.get("frame_checkpoint", {"answers": {}, "complete": False})
        progress["current"] = int(activity_id)
        session["frame_checkpoint"] = progress
        session.save()

    def test_checkpoint_has_exactly_ten_activities_and_required_distribution(self):
        self.assertEqual(len(FRAME_ACTIVITIES), 10)
        self.assertEqual([item["id"] for item in FRAME_ACTIVITIES], [str(number) for number in range(1, 11)])
        self.assertEqual([item["difficulty_level"] for item in FRAME_ACTIVITIES], [3, 3, 3, 4, 4, 4, 4, 4, 5, 5])
        self.assertEqual(sum(item["difficulty_level"] == 3 for item in FRAME_ACTIVITIES), 3)
        self.assertEqual(sum(item["difficulty_level"] == 4 for item in FRAME_ACTIVITIES), 5)
        self.assertEqual(sum(item["difficulty_level"] == 5 for item in FRAME_ACTIVITIES), 2)

    def test_checkpoint_starts_embedded_on_frame_page(self):
        response = self.start()
        self.assertEqual(response.redirect_chain[-1][0], f'{reverse("learning:frame_concept")}#frame-checkpoint')
        self.assertContains(response, "ATIVIDADE 1 DE 10")
        self.assertContains(response, "Monte o frame local")
        self.assertContains(response, 'data-builder-form', html=False)

    def test_fetch_start_returns_json_partial_without_redirect(self):
        response = self.client.post(
            reverse("learning:frame_checkpoint_start"),
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
            HTTP_ACCEPT="application/json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('id="frame-checkpoint"', payload["html"])
        self.assertIn("ATIVIDADE 1 DE 10", payload["html"])
        self.assertFalse(payload["complete"])

    def test_fetch_wrong_then_correct_preserves_guided_and_misconception(self):
        self.start()
        endpoint = reverse("learning:frame_checkpoint_answer")
        wrong = {"mac-a": "destination", "mac-b": "source", "report": "data"}
        response = self.client.post(
            endpoint, {"answer_payload": json.dumps(wrong)},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest", HTTP_ACCEPT="application/json",
        )
        payload = response.json()
        self.assertFalse(payload["correct"])
        self.assertIn("Reavalie quem está transmitindo", payload["feedback"])
        stored = self.client.session["frame_checkpoint"]["answers"]["1"]
        self.assertIn("confuses_source_and_destination_mac", stored["misconception_codes"])
        response = self.client.post(
            endpoint, {"answer_payload": json.dumps(FRAME_ACTIVITY_MAP["1"]["correct_map"])},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest", HTTP_ACCEPT="application/json",
        )
        payload = response.json()
        self.assertTrue(payload["correct"])
        self.assertTrue(payload["guided"])
        self.assertTrue(payload["next_available"])
        self.assertEqual(self.client.session["frame_checkpoint"]["answers"]["1"]["result_type"], "guided")

    def test_fetch_immediate_advance_and_completion_summary(self):
        self.start()
        self.client.post(
            reverse("learning:frame_checkpoint_answer"),
            {"answer_payload": json.dumps(FRAME_ACTIVITY_MAP["1"]["correct_map"])},
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )
        self.assertEqual(self.client.session["frame_checkpoint"]["answers"]["1"]["result_type"], "immediate")
        advanced = self.client.post(
            reverse("learning:frame_checkpoint_next"),
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        ).json()
        self.assertIn("ATIVIDADE 2 DE 10", advanced["html"])

        progress = self.client.session["frame_checkpoint"]
        progress["current"] = 10
        progress["answers"] = {
            str(number): {"complete": True, "result_type": "immediate", "misconception_codes": [], "reference_revealed": number == 10}
            for number in range(1, 11)
        }
        session = self.client.session
        session["frame_checkpoint"] = progress
        session.save()
        completed = self.client.post(
            reverse("learning:frame_checkpoint_next"),
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        ).json()
        self.assertTrue(completed["complete"])
        self.assertIn("10 situações resolvidas", completed["html"])
        self.assertIn("Acertos imediatos", completed["html"])

    def test_all_ten_accept_their_defined_correct_submission(self):
        self.start()
        mapping_types = {
            "frame_builder", "direction_builder", "compare_outputs_builder", "dual_builder",
            "evidence_sort", "diagnostic_map", "integrated_concept_map",
        }
        for item in FRAME_ACTIVITIES:
            self.set_current(item["id"])
            if item["type"] in mapping_types:
                response = self.post_payload(item["correct_map"])
            elif item["type"] == "event_selection_order":
                response = self.post_payload(item["correct_order"])
            elif item["type"] == "find_inconsistency":
                response = self.post_answer(item["correct"])
            elif item["type"] == "capture_analysis":
                self.post_answer(item["correct"])
                response = self.client.post(
                    reverse("learning:frame_checkpoint_answer"),
                    {"evidence": item["correct_evidence"]},
                    follow=True,
                )
            else:
                self.fail(f"Tipo Frame sem cobertura: {item['type']}")
            self.assertEqual(response.status_code, 200, item["id"])
            stored = self.client.session["frame_checkpoint"]["answers"][item["id"]]
            self.assertTrue(stored["complete"], item["id"])

    def test_wrong_mapping_is_guided_and_does_not_reveal_complete_solution(self):
        self.start()
        wrong = {"mac-a": "destination", "mac-b": "source", "report": "data"}
        response = self.post_payload(wrong)
        self.assertContains(response, "Reavalie quem está transmitindo")
        self.assertNotContains(response, "Correto. O frame leva o MAC")
        stored = self.client.session["frame_checkpoint"]["answers"]["1"]
        self.assertFalse(stored["complete"])
        self.assertIn("confuses_source_and_destination_mac", stored["misconception_codes"])
        response = self.post_payload(FRAME_ACTIVITY_MAP["1"]["correct_map"])
        stored = self.client.session["frame_checkpoint"]["answers"]["1"]
        self.assertEqual(stored["result_type"], "guided")
        self.assertContains(response, "Correto. O frame leva o MAC")

    def test_capture_analysis_requires_judgment_then_exact_evidence(self):
        self.start()
        self.set_current("5")
        phase_two = self.post_answer("coherent")
        self.assertContains(phase_two, "Agora selecione as duas evidências")
        stored = self.client.session["frame_checkpoint"]["answers"]["5"]
        self.assertEqual(stored["phase"], "evidence")
        self.assertEqual(stored["attempt_count"], 0)
        response = self.client.post(
            reverse("learning:frame_checkpoint_answer"),
            {"evidence": ["ip", "source"]}, follow=True,
        )
        self.assertContains(response, "duas evidências que explicam")
        response = self.client.post(
            reverse("learning:frame_checkpoint_answer"),
            {"evidence": ["ip", "mac"]}, follow=True,
        )
        stored = self.client.session["frame_checkpoint"]["answers"]["5"]
        self.assertEqual(stored["result_type"], "guided")

    def test_event_activity_requires_selection_and_correct_order(self):
        self.start()
        self.set_current("6")
        response = self.post_payload(["Consultar DNS"])
        self.assertContains(response, "Selecione e ordene os eventos necessários")
        self.post_payload(FRAME_ACTIVITY_MAP["6"]["correct_order"])
        self.assertTrue(self.client.session["frame_checkpoint"]["answers"]["6"]["complete"])

    def test_last_activity_keeps_free_explanation_unscored(self):
        self.start()
        self.set_current("10")
        self.post_payload(FRAME_ACTIVITY_MAP["10"]["correct_map"])
        response = self.client.post(reverse("learning:frame_checkpoint_answer"), {
            "free_text": "ARP descobre o MAC usado pelo frame.",
            "reveal_reference": "1",
        }, follow=True)
        stored = self.client.session["frame_checkpoint"]["answers"]["10"]
        self.assertTrue(stored["reference_revealed"])
        self.assertEqual(stored["attempt_count"], 1)
        self.assertContains(response, "Resposta de referência")

    def test_completion_counts_and_shows_only_actual_misconceptions(self):
        self.start()
        progress = self.client.session["frame_checkpoint"]
        progress["current"] = 10
        progress["answers"] = {
            str(number): {
                "complete": True,
                "result_type": "immediate" if number <= 6 else "guided",
                "misconception_codes": ["confuses_mac_with_ip"] if number == 1 else [],
                "reference_revealed": number == 10,
            }
            for number in range(1, 11)
        }
        session = self.client.session
        session["frame_checkpoint"] = progress
        session.save()
        response = self.client.post(reverse("learning:frame_checkpoint_next"), follow=True)
        self.assertContains(response, "10 situações resolvidas")
        self.assertContains(response, ">6<", html=False)
        self.assertContains(response, ">4<", html=False)
        self.assertContains(response, "MAC × IPv4")
        self.assertContains(response, "<aside class=\"checkpoint-review\"><h3>Pontos que apareceram</h3><span>MAC × IPv4</span></aside>", html=True)
        self.assertContains(response, "Switch")
        self.assertContains(response, reverse("learning:switch_concept"))


class SwitchConceptAndCheckpointTests(TestCase):
    def start(self):
        return self.client.post(reverse("learning:switch_checkpoint_start"), follow=True)

    def set_current(self, number, answers=None):
        session = self.client.session
        session["switch_checkpoint"] = {"current": number, "answers": answers or {}, "complete": False}
        session.save()

    def answer_map(self, payload):
        return self.client.post(reverse("learning:switch_checkpoint_answer"), {"answer_payload": json.dumps(payload)}, follow=True)

    def test_switch_page_has_one_guided_lab_and_five_step_panels(self):
        response = self.client.get(reverse("learning:switch_concept"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "data-step-panel=", count=5, html=False)
        self.assertContains(response, "data-step-target=", count=5, html=False)
        self.assertContains(response, "data-switch-board", count=1, html=False)
        self.assertContains(response, "switch-board-didactic", count=1, html=False)
        self.assertContains(response, "data-switch-port=", count=8, html=False)
        self.assertContains(response, 'data-board-id="switch-concept-shared"', html=False)
        self.assertContains(response, 'data-scenario="switch-concept-shared"', html=False)
        self.assertContains(response, "Como o switch aprende e encaminha")
        self.assertContains(response, "O primeiro frame chega ao switch")
        self.assertContains(response, "Ver a mesma tabela na CLI")
        self.assertContains(response, "Ver linha do tempo completa")
        self.assertContains(response, "data-board-last-event", html=False)
        self.assertContains(response, 'aria-current="step"', html=False)
        css = (settings.BASE_DIR / "static" / "css" / "switch-concept.css").read_text(encoding="utf-8")
        self.assertNotIn("position: sticky", css)
        self.assertNotIn("grid-template-columns: minmax(300px, .72fr)", css)
        self.assertContains(response, "show mac address-table")
        self.assertContains(response, "PRIMEIRA TENTATIVA")
        self.assertContains(response, "Esta resposta não recebe pontuação")
        self.assertNotContains(response, "ABRIR ESTA ETAPA NO LABORATÓRIO")
        self.assertNotContains(response, "data-switch-area=")
        self.assertContains(response, "switch-board.js?v=switch-guided-1")
        self.assertContains(response, "switch-concept.js?v=switch-static-1")

    def test_static_switch_explanation_precedes_guided_lab(self):
        response = self.client.get(reverse("learning:switch_concept"))
        page = response.content.decode()
        concept = page.split('<section class="switch-concept-prelude"', 1)[1].split('</section>', 1)[0]
        diagram = concept.split('<figure class="switch-static-figure"', 1)[1].split('</figure>', 1)[0]
        self.assertLess(page.index('id="switch-concept-title"'), page.index('class="switch-stepper"'))
        for text in ("MAC de origem", "porta de entrada", "MAC de destino", "MAC, VLAN e interface", "não endereços IP"):
            self.assertIn(text, concept)
        self.assertEqual(diagram.count('class="switch-static-device"'), 1)
        self.assertIn('role="img" aria-label="PC-A envia', diagram)
        for text in ("PC-A", "PC-B", "PC-C", "SW1", "Gi0/1", "Gi0/4", "MAC AA · VLAN 1 · Gi0/1", "BB conhecido", "BB desconhecido"):
            self.assertIn(text, diagram)
        for number in range(1, 5):
            self.assertIn(f'<li><b>{number}</b>', diagram)
        self.assertNotIn("<button", diagram)
        for glossary_id in ("switch-tip-learning", "switch-tip-table", "switch-tip-flooding"):
            self.assertIn(f'aria-controls="{glossary_id}"', concept)
            self.assertIn(f'aria-describedby="{glossary_id}"', concept)
            self.assertIn(f'id="{glossary_id}" role="tooltip" hidden', concept)
        self.assertEqual(concept.count("data-switch-glossary"), 3)
        self.assertIn('data-switch-board', page)
        self.assertIn('data-checkpoint-start', page)
        script = (settings.BASE_DIR / "static" / "js" / "switch-concept.js").read_text(encoding="utf-8")
        for fragment in ('event.pointerType === "mouse"', 'event.pointerType !== "touch"', 'event.key === "Escape"'):
            self.assertIn(fragment, script)

    def test_simplified_buttons_keep_the_javascript_contract(self):
        response = self.client.get(reverse("learning:switch_concept"))
        html = response.content.decode()
        script_path = settings.BASE_DIR / "static" / "js" / "switch-concept.js"
        script = script_path.read_text(encoding="utf-8")
        selectors = (
            "data-step-enter",
            "data-step-query",
            "data-step-flood-confirm",
            "data-step-five-action",
            "data-step-previous",
            "data-step-next",
            "data-step-target",
            "data-learning-source",
            "data-learning-port",
            "data-cli-mac-b",
            "data-switch-reference-button",
            "data-checkpoint-start",
            "data-switch-host-outcomes",
            "data-process",
        )
        for selector in selectors:
            with self.subTest(selector=selector):
                self.assertIn(selector, html)
                self.assertIn(selector, script)

    def test_shared_switch_board_supports_direct_actions_and_responsive_layout(self):
        board_script = (settings.BASE_DIR / "static" / "js" / "switch-board.js").read_text(encoding="utf-8")
        concept_script = (settings.BASE_DIR / "static" / "js" / "switch-concept.js").read_text(encoding="utf-8")
        concept_css = (settings.BASE_DIR / "static" / "css" / "switch-concept.css").read_text(encoding="utf-8")
        self.assertIn('"switch-concept-shared"', board_script)
        self.assertNotIn('"switch-clarity-problem"', board_script)
        self.assertIn("FLOOD_PORTS = [3, 4, 6]", concept_script)
        self.assertIn("Gi0/1 é a porta de entrada; o switch não devolve o frame por ela.", concept_script)
        self.assertIn('state.phase === "frame-arrived"', concept_script)
        self.assertIn('state.phase = "flood-selection"', concept_script)
        self.assertIn('state.phase = "second-request"', concept_script)
        self.assertIn("step > state.unlocked", concept_script)
        self.assertIn("state.completed.has(state.activeStep)", concept_script)
        self.assertIn("state.activeStep = step", concept_script)
        self.assertNotIn("position: sticky", concept_css)
        self.assertIn(".switch-stepper", concept_css)
        self.assertIn(".shared-switch-lab", concept_css)
        self.assertIn("@media(max-width:360px)", concept_css)
        self.assertIn("prefers-reduced-motion", concept_css)

    def test_stepper_unlocks_without_automatic_advance_and_reset_clears_progress(self):
        script = (settings.BASE_DIR / "static" / "js" / "switch-concept.js").read_text(encoding="utf-8")
        self.assertIn("state.unlocked = Math.max", script)
        self.assertIn("state.completed.add(step)", script)
        self.assertIn("button.disabled = step > state.unlocked", script)
        self.assertIn('state = {phase: "initial", activeStep: 1, unlocked: 1', script)
        self.assertIn("current.state.events = []", script)
        self.assertNotIn("setTimeout(", script)
        self.assertNotIn("showStep(step + 1", script)

    def test_continuous_switch_flow_has_unique_events_live_table_and_reset(self):
        script = (settings.BASE_DIR / "static" / "js" / "switch-concept.js").read_text(encoding="utf-8")
        events = (
            "Frame AA → BB entrou pela Gi0/1",
            "Switch aprendeu AA → Gi0/1",
            "Consulta por BB: não encontrado",
            "Flooding: Gi0/3, Gi0/4 e Gi0/6",
            "Resposta BB → AA entrou pela Gi0/4",
            "Switch aprendeu BB → Gi0/4",
            "AA encontrado: saída somente pela Gi0/1",
            "Novo frame AA → BB",
            "BB encontrado: saída somente pela Gi0/4",
        )
        for event in events:
            with self.subTest(event=event):
                self.assertIn(event, script)
        self.assertIn("if (state.history.includes(index)) return", script)
        self.assertIn("state.history.map(event => EVENTS[event])", script)
        self.assertIn("current.reset()", script)
        self.assertIn("current.state.events = []", script)
        self.assertIn("current.clearFrameState()", script)
        self.assertIn("setMacEntry(api().MAC.A, 1, null)", script)
        self.assertIn("current.setMacEntry(api().MAC.B, 4, null)", script)
        self.assertIn("receive(api().MAC.B, api().MAC.A, 4, 4)", script)
        self.assertIn("receive(api().MAC.A, api().MAC.B, 1, 7)", script)
        self.assertIn('root().addEventListener("keydown"', script)
        self.assertIn('root().addEventListener("click", handleBoardInput, true)', script)
        self.assertNotIn("setTimeout(", script)
        self.assertNotIn("activeStage", script)

    def test_sidebar_home_and_frame_integrate_switch(self):
        route = reverse("learning:switch_concept")
        self.assertContains(self.client.get(reverse("learning:home")), route)
        self.assertEqual(self.client.get(reverse("learning:frame_concept")).status_code, 200)
        self.assertContains(self.client.get(route), 'aria-current="page">Conteúdos</a>', html=False)

    def test_checkpoint_has_requested_size_difficulty_and_types(self):
        self.assertEqual(len(SWITCH_ACTIVITIES), 10)
        self.assertEqual([item["difficulty_level"] for item in SWITCH_ACTIVITIES], [3, 3, 4, 4, 4, 4, 5, 5, 5, 5])
        self.assertEqual(SWITCH_ACTIVITIES[-1]["type"], "switch_troubleshooting_challenge")
        self.assertTrue(all(item["mode"] == "investigation" for item in SWITCH_ACTIVITIES[5:]))

    def test_advanced_investigations_have_tools_evidence_hints_and_misconceptions(self):
        for number in (8, 9, 10):
            item = SWITCH_ACTIVITY_MAP[str(number)]
            self.assertEqual(item["mode"], "investigation")
            self.assertGreaterEqual(len(item["required_evidence"]), 2)
            self.assertGreaterEqual(len(item["hints"]), 2)
            self.assertIn("switch_cli", item["tools"])
        self.assertIn("host_terminal", SWITCH_ACTIVITY_MAP["9"]["tools"])
        self.assertIn("host_terminal", SWITCH_ACTIVITY_MAP["10"]["tools"])
        expected = {
            "assumes_destination_mac_is_learned",
            "ignores_ingress_port",
            "assumes_mac_table_is_current_truth",
            "jumps_from_evidence_to_unproven_cause",
            "confuses_arp_cache_with_mac_table",
        }
        self.assertTrue(expected.issubset(SWITCH_MISCONCEPTION_LABELS))

    def test_checkpoint_starts_embedded_on_switch_page(self):
        response = self.start()
        self.assertEqual(response.redirect_chain[-1][0], f'{reverse("learning:switch_concept")}#switch-checkpoint')
        self.assertContains(response, "Aprenda pela origem")

    def test_async_start_returns_checkpoint_fragment(self):
        response = self.client.post(reverse("learning:switch_checkpoint_start"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        payload = response.json()
        self.assertIn('id="switch-checkpoint"', payload["html"])
        self.assertFalse(payload["complete"])

    def test_correct_learning_mapping_is_immediate_and_locked(self):
        self.start()
        correct = SWITCH_ACTIVITY_MAP["1"]["correct_map"]
        response = self.answer_map(correct)
        self.assertContains(response, "CC → Gi0/3")
        stored = self.client.session["switch_checkpoint"]["answers"]["1"]
        self.assertTrue(stored["complete"])
        self.assertEqual(stored["result_type"], "immediate")
        self.answer_map({"destination": "field", "g01": "port", "cc3": "association"})
        self.assertEqual(self.client.session["switch_checkpoint"]["answers"]["1"]["last_payload"], correct)

    def test_wrong_learning_mapping_returns_specific_feedback_then_guided(self):
        self.start()
        response = self.answer_map({"destination": "field", "g03": "port", "cc3": "association"})
        self.assertContains(response, "aprendizagem usa Source MAC")
        self.answer_map(SWITCH_ACTIVITY_MAP["1"]["correct_map"])
        self.assertEqual(self.client.session["switch_checkpoint"]["answers"]["1"]["result_type"], "guided")

    def test_known_destination_selects_gi07_and_rejects_other_port(self):
        self.set_current(2)
        wrong = self.answer_map({"destination": "field", "cc7": "entry", "g04": "egress"})
        self.assertContains(wrong, "entrada de CC aponta Gi0/7")
        self.answer_map(SWITCH_ACTIVITY_MAP["2"]["correct_map"])
        self.assertTrue(self.client.session["switch_checkpoint"]["answers"]["2"]["complete"])

    def test_unknown_unicast_excludes_ingress(self):
        self.set_current(4)
        wrong = self.answer_map({"g01": "flood", "g02": "flood", "g04": "flood", "g06": "flood"})
        self.assertContains(wrong, "porta de entrada")
        self.answer_map(SWITCH_ACTIVITY_MAP["4"]["correct_map"])
        self.assertTrue(self.client.session["switch_checkpoint"]["answers"]["4"]["complete"])

    def test_end_to_end_investigation_uses_backend_mapping_validation(self):
        self.set_current(9)
        item = SWITCH_ACTIVITY_MAP["9"]
        response = self.answer_map(item["correct_map"])
        self.assertContains(response, "ARP e MAC Table existem")
        self.assertTrue(self.client.session["switch_checkpoint"]["answers"]["9"]["complete"])

    def test_final_challenge_completes_after_supported_conclusion(self):
        self.set_current(10)
        self.answer_map(SWITCH_ACTIVITY_MAP["10"]["correct_map"])
        final = self.client.post(reverse("learning:switch_checkpoint_next"), follow=True)
        self.assertContains(final, "10 situações resolvidas")

    def test_hint_marks_correct_answer_as_guided(self):
        self.start()
        hint = self.client.post(reverse("learning:switch_checkpoint_hint"), follow=True)
        self.assertContains(hint, "Separe o campo usado para aprender")
        self.answer_map(SWITCH_ACTIVITY_MAP["1"]["correct_map"])
        self.assertEqual(self.client.session["switch_checkpoint"]["answers"]["1"]["result_type"], "guided")

    def test_reset_current_clears_only_active_activity_state(self):
        self.start()
        self.answer_map({"destination": "field", "g03": "port", "cc3": "association"})
        self.client.post(reverse("learning:switch_checkpoint_reset_current"), follow=True)
        progress = self.client.session["switch_checkpoint"]
        self.assertEqual(progress["current"], 1)
        self.assertNotIn("1", progress["answers"])

    def test_completion_counts_immediate_guided_and_misconception(self):
        answers = {}
        for index in range(1, 11):
            answers[str(index)] = {"complete": True, "result_type": "immediate" if index <= 7 else "guided", "misconception_codes": []}
        answers["4"]["misconception_codes"] = ["ignores_ingress_port"]
        self.set_current(10, answers)
        response = self.client.post(reverse("learning:switch_checkpoint_next"), follow=True)
        self.assertContains(response, ">7<", html=False)
        self.assertContains(response, ">3<", html=False)
        self.assertContains(response, "Ignora a porta de entrada")


class DeliveryConceptAndCheckpointTests(TestCase):
    def start(self, ajax=False):
        extra = {"HTTP_X_REQUESTED_WITH": "XMLHttpRequest"} if ajax else {}
        return self.client.post(reverse("learning:delivery_checkpoint_start"), follow=not ajax, **extra)

    def set_current(self, number, answers=None):
        session = self.client.session
        session["delivery_checkpoint"] = {"current": number, "answers": answers or {}, "complete": False}
        session.save()

    def answer_map(self, payload, ajax=False):
        extra = {"HTTP_X_REQUESTED_WITH": "XMLHttpRequest"} if ajax else {}
        return self.client.post(reverse("learning:delivery_checkpoint_answer"), {"answer_payload": json.dumps(payload)}, follow=not ajax, **extra)

    def test_page_has_single_comparison_bench_and_three_experiments(self):
        response = self.client.get(reverse("learning:delivery_concept"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "data-experiment=", count=3, html=False)
        self.assertContains(response, "data-switch-board", count=1, html=False)
        self.assertContains(response, "switch-board-didactic", count=1, html=False)
        self.assertContains(response, "data-switch-port=", count=8, html=False)
        self.assertContains(response, 'data-board-id="delivery-concept-shared"', html=False)
        self.assertContains(response, 'data-scenario="delivery-concept-shared"', html=False)
        self.assertContains(response, "FF:FF:FF:FF:FF:FF")
        self.assertContains(response, "Unknown unicast")
        self.assertContains(response, "Unicast ou broadcast? Leia primeiro o Destination MAC.")
        self.assertContains(response, "Um frame saiu por três portas. Isso basta")
        self.assertContains(response, "EXPLIQUE ANTES DE COMPARAR")
        for label in ("CLASSIFICAÇÃO", "TABELA", "AÇÃO", "HOSTS"):
            self.assertContains(response, label)
        self.assertNotContains(response, "data-delivery-area=")
        self.assertNotContains(response, "ABRIR ESTA ETAPA NO LABORATÓRIO")
        self.assertContains(response, "delivery-concept.js?v=delivery-overview-1")

    def test_concept_and_static_diagram_precede_existing_experiments(self):
        response = self.client.get(reverse("learning:delivery_concept"))
        page = response.content.decode()
        concept = page.split('<section class="delivery-prelude"', 1)[1].split('</section>', 1)[0]
        diagram = concept.split('<figure class="delivery-overview"', 1)[1].split('</figure>', 1)[0]
        self.assertLess(page.index('id="delivery-concept-title"'), page.index('class="experiment-selector"'))
        for text in ("Destination MAC específico", "uma única porta", "FF:FF:FF:FF:FF:FF", "mesma VLAN", "porta de entrada"):
            self.assertIn(text, concept)
        for text in ("Unicast conhecido", "Broadcast · FF:FF:FF:FF:FF:FF", "Unknown unicast", "PC-B recebe", "PC-C recebe", "Host da VLAN 20 não recebe", "PC-B descarta", "PC-C aceita"):
            self.assertIn(text, diagram)
        self.assertIn('role="img" aria-label="Exemplo estático:', diagram)
        self.assertNotIn("<button", diagram)
        self.assertNotIn("data-experiment=", diagram)
        for glossary_id in ("delivery-tip-flooding", "delivery-tip-ingress", "delivery-tip-domain"):
            self.assertIn(f'aria-controls="{glossary_id}"', concept)
            self.assertIn(f'aria-describedby="{glossary_id}"', concept)
            self.assertIn(f'id="{glossary_id}" role="tooltip" hidden', concept)
        self.assertEqual(concept.count("data-delivery-glossary"), 3)
        self.assertIn('data-switch-board', page)
        self.assertIn('data-delivery-checkpoint-start', page)
        script = (settings.BASE_DIR / "static" / "js" / "delivery-concept.js").read_text(encoding="utf-8")
        for fragment in ('event.pointerType === "mouse"', 'event.pointerType !== "touch"', 'event.key === "Escape"'):
            self.assertIn(fragment, script)

    def test_simplified_delivery_buttons_keep_the_javascript_contract(self):
        response = self.client.get(reverse("learning:delivery_concept"))
        html = response.content.decode()
        script = (settings.BASE_DIR / "static" / "js" / "delivery-concept.js").read_text(encoding="utf-8")
        selectors = (
            "data-experiment", "data-consult-destination", "data-execute-scenario",
            "data-reset-experiment", "data-result-classification", "data-result-table",
            "data-result-action", "data-result-hosts", "data-host-outcomes",
            "data-arp-launch", "data-arp-action", "data-arp-reset",
            "data-delivery-reference-button", "data-delivery-checkpoint-start",
        )
        for selector in selectors:
            with self.subTest(selector=selector):
                self.assertIn(selector, html)
                self.assertIn(selector, script)

    def test_shared_delivery_lab_has_direct_actions_keyboard_and_responsive_contract(self):
        board_script = (settings.BASE_DIR / "static" / "js" / "switch-board.js").read_text(encoding="utf-8")
        concept_script = (settings.BASE_DIR / "static" / "js" / "delivery-concept.js").read_text(encoding="utf-8")
        concept_css = (settings.BASE_DIR / "static" / "css" / "delivery-concept.css").read_text(encoding="utf-8")
        self.assertIn('"delivery-concept-shared"', board_script)
        self.assertNotIn('"delivery-didactic-opening"', board_script)
        self.assertIn("FLOOD_PORTS = [3, 4, 6]", concept_script)
        for scenario in ('known:', 'unknown:', 'broadcast:', '"arp-request":', '"arp-reply":'):
            self.assertIn(scenario, concept_script)
        self.assertIn('["Enter"," "]', concept_script)
        self.assertIn("Flooding descreve a ação do switch, não a intenção do frame", concept_script)
        self.assertIn("state.events.has(key)", concept_script)
        self.assertNotIn("position: sticky", concept_css)
        self.assertIn(".experiment-selector", concept_css)
        self.assertIn("@media(max-width:360px)", concept_css)
        self.assertIn("prefers-reduced-motion", concept_css)

    def test_delivery_scenarios_separate_classification_table_action_and_hosts(self):
        script = (settings.BASE_DIR / "static" / "js" / "delivery-concept.js").read_text(encoding="utf-8")
        expected = (
            'classification: "Unicast / encaminhamento direto"',
            'tableResult: "BB conhecido → Gi0/4"',
            'classification: "Unicast", tableResult: "DD desconhecido"',
            'classification: "Broadcast", tableResult: "Associação individual não é necessária"',
            'hosts: "PC-D aceita; PC-B e PC-C descartam"',
            'hosts: "PC-B, PC-C e PC-D aceitam"',
        )
        for content in expected:
            with self.subTest(content=content):
                self.assertIn(content, script)
        self.assertIn("button.dataset.experiment === activeExperiment", script)
        self.assertIn("configure(state.kind)", script)
        self.assertNotIn("setTimeout(", script)

    def test_arp_request_and_reply_use_same_delivery_bench(self):
        response = self.client.get(reverse("learning:delivery_concept"))
        self.assertContains(response, "Ver aplicação prática: ARP")
        self.assertContains(response, "Enviar ARP Request")
        self.assertContains(response, "Reiniciar demonstração ARP")
        self.assertContains(response, "PC-A · 192.168.10.10")
        self.assertContains(response, "PC-B · 192.168.10.20")
        self.assertNotContains(response, 'data-arp-mode=', html=False)
        self.assertNotContains(response, "EXECUTAR ARP REQUEST")
        self.assertNotContains(response, "EXECUTAR ARP REPLY")
        script = (settings.BASE_DIR / "static" / "js" / "delivery-concept.js").read_text(encoding="utf-8")
        self.assertIn('destination: "BROADCAST"', script)
        self.assertIn('source: "A", destination: "BROADCAST", ingress: 1, table: [["A", 1]]', script)
        self.assertIn('source: "B", destination: "A", ingress: 4, table: [["A", 1], ["B", 4]]', script)
        self.assertIn("Todos recebem; somente PC-B responde ao IPv4 procurado", script)
        self.assertIn("o Request trouxe o Source MAC de PC-A", script)
        self.assertIn('arpPhase = "request-ready"', script)
        self.assertIn('arpPhase = "reply-ready"', script)
        self.assertIn('setText("[data-arp-action]", "Enviar ARP Reply")', script)
        self.assertIn("executeArpFrame();", script)
        self.assertIn("resetArpDemo", script)

    def test_navigation_connects_switch_delivery_and_future_vlan(self):
        route = reverse("learning:delivery_concept")
        self.assertContains(self.client.get(reverse("learning:home")), route)
        self.assertContains(self.client.get(reverse("learning:switch_concept")), route)
        response = self.client.get(route)
        self.assertContains(response, reverse("learning:switch_concept"))
        self.assertContains(response, "Próximo: VLAN")
        self.assertContains(response, 'aria-current="page"', html=False)

    def test_scenarios_cover_known_broadcast_unknown_arp_and_boundary(self):
        source = (settings.BASE_DIR / "static" / "js" / "switch-board.js").read_text(encoding="utf-8")
        for scenario in ("delivery-known", "delivery-broadcast", "delivery-compare", "delivery-arp", "delivery-boundary"):
            self.assertIn(f'"{scenario}"', source)
        self.assertIn("BROADCAST_IDENTIFIED", source)
        self.assertIn("UNKNOWN_UNICAST_FLOODED", source)

    def test_checkpoint_has_exactly_ten_registered_activities_and_difficulty(self):
        self.assertEqual(len(DELIVERY_ACTIVITIES), 10)
        self.assertEqual(set(DELIVERY_ACTIVITY_MAP), {str(number) for number in range(1, 11)})
        self.assertEqual([item["difficulty_level"] for item in DELIVERY_ACTIVITIES], [3, 3, 4, 4, 4, 4, 5, 5, 5, 5])
        self.assertTrue(all(item["mode"] == "investigation" for item in DELIVERY_ACTIVITIES[6:]))

    def test_evidence_board_is_required_in_requested_activities(self):
        for number in (5, 7, 8, 9, 10):
            item = DELIVERY_ACTIVITY_MAP[str(number)]
            self.assertTrue(item["required_evidence"])
            self.assertEqual(set(item["required_evidence"]), {evidence["id"] for evidence in item["evidence"]})

    def test_misconceptions_are_registered(self):
        expected = {
            "confuses_broadcast_with_unknown_unicast", "assumes_multiple_egress_ports_means_broadcast",
            "assumes_broadcast_returns_to_ingress", "assumes_router_forwards_l2_broadcast_unchanged",
            "confuses_arp_request_with_unicast", "confuses_arp_reply_with_broadcast",
            "ignores_destination_mac", "ignores_mac_table_when_classifying_unicast",
            "assumes_unknown_unicast_is_dropped", "assumes_broadcast_means_entire_internet",
        }
        self.assertTrue(expected.issubset(DELIVERY_MISCONCEPTION_LABELS))

    def test_async_start_and_answer_return_fragment_without_redirect(self):
        start = self.start(ajax=True)
        self.assertEqual(start.status_code, 200)
        self.assertIn('id="delivery-checkpoint"', start.json()["html"])
        answer = self.answer_map(DELIVERY_ACTIVITY_MAP["1"]["correct_map"], ajax=True)
        self.assertTrue(answer.json()["correct"])
        self.assertFalse(answer.json()["guided"])

    def test_wrong_then_correct_is_guided_and_preserves_misconception(self):
        self.start()
        self.answer_map({"bb": "destination", "bb4": "entry", "g2": "egress"})
        stored = self.client.session["delivery_checkpoint"]["answers"]["1"]
        self.assertIn("ignores_mac_table_when_classifying_unicast", stored["misconception_codes"])
        self.answer_map(DELIVERY_ACTIVITY_MAP["1"]["correct_map"])
        self.assertEqual(self.client.session["delivery_checkpoint"]["answers"]["1"]["result_type"], "guided")

    def test_hint_makes_first_correct_submission_guided(self):
        self.start()
        response = self.client.post(reverse("learning:delivery_checkpoint_hint"), follow=True)
        self.assertContains(response, "Inspecione o próprio frame")
        self.answer_map(DELIVERY_ACTIVITY_MAP["1"]["correct_map"])
        self.assertEqual(self.client.session["delivery_checkpoint"]["answers"]["1"]["result_type"], "guided")

    def test_second_error_reveals_contextual_hint_without_answer(self):
        self.start()
        self.answer_map({"bb": "destination", "bb4": "entry", "g2": "egress"})
        response = self.answer_map({"bb4": "destination", "bb": "entry", "g2": "egress"})
        stored = self.client.session["delivery_checkpoint"]["answers"]["1"]
        self.assertEqual(stored["hint_level"], 1)
        self.assertFalse(stored["complete"])
        self.assertContains(response, "Inspecione o próprio frame")

    def test_reset_clears_current_activity_only(self):
        self.start()
        self.answer_map({"bb": "destination", "bb4": "entry", "g2": "egress"})
        self.client.post(reverse("learning:delivery_checkpoint_reset_current"), follow=True)
        self.assertNotIn("1", self.client.session["delivery_checkpoint"]["answers"])

    def test_delivery_challenge_and_completion(self):
        answers = {str(number): {"complete": True, "result_type": "immediate" if number <= 6 else "guided", "misconception_codes": []} for number in range(1, 11)}
        answers["9"]["misconception_codes"] = ["assumes_multiple_egress_ports_means_broadcast"]
        self.set_current(10, answers)
        response = self.client.post(reverse("learning:delivery_checkpoint_next"), follow=True)
        self.assertContains(response, "10 situações resolvidas")
        self.assertContains(response, ">6<", html=False)
        self.assertContains(response, ">4<", html=False)
        self.assertContains(response, "Múltiplas saídas significam broadcast")
        self.assertContains(response, "Explique antes de comparar")


class VlanConceptAndCheckpointTests(TestCase):
    def start(self, ajax=False):
        extra = {"HTTP_X_REQUESTED_WITH": "XMLHttpRequest"} if ajax else {}
        return self.client.post(reverse("learning:vlan_checkpoint_start"), follow=not ajax, **extra)

    def answer_map(self, payload, ajax=False):
        extra = {"HTTP_X_REQUESTED_WITH": "XMLHttpRequest"} if ajax else {}
        return self.client.post(reverse("learning:vlan_checkpoint_answer"), {"answer_payload": json.dumps(payload)}, follow=not ajax, **extra)

    def set_current(self, number, answers=None):
        session = self.client.session
        session["vlan_checkpoint"] = {"current": number, "answers": answers or {}, "complete": False}
        session.save()

    def test_page_uses_visual_comparison_without_an_interactive_switch(self):
        response = self.client.get(reverse("learning:vlan_concept"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "VLAN: separar redes lógicas no mesmo switch")
        self.assertContains(response, "data-vlan-visualization", html=False)
        self.assertContains(response, 'class="vlan-static-diagram"', html=False)
        self.assertContains(response, "PC-A")
        self.assertContains(response, "PC-D")
        self.assertNotContains(response, 'id="vlan-shared-lab"', html=False)
        self.assertNotContains(response, 'data-vlan-stage-link=', html=False)
        page_markup = response.content.decode().split('<section id="vlan-checkpoint"', 1)[0]
        self.assertNotIn('data-switch-board', page_markup)
        self.assertNotIn('data-switch-port=', page_markup)
        self.assertContains(response, 'id="vlan-checkpoint"', html=False)
        self.assertContains(response, "show vlan brief")
        self.assertContains(response, 'data-vlan-cli-proof', html=False)
        self.assertContains(response, "EXPLIQUE COM SUAS PALAVRAS")
        self.assertContains(response, "vlan-concept.js?v=vlan-static-1")
        self.assertContains(response, reverse("learning:trunk_concept"))

    def test_access_exercise_keeps_the_javascript_contract(self):
        response = self.client.get(reverse("learning:vlan_concept"))
        html = response.content.decode()
        script = (settings.BASE_DIR / "static" / "js" / "vlan-concept.js").read_text(encoding="utf-8")
        selectors = (
            "data-pc-e-select", "data-apply-access", "data-test-pc-e",
            "data-vlan-reference-button",
            "data-vlan-checkpoint-start",
        )
        for selector in selectors:
            with self.subTest(selector=selector):
                self.assertIn(selector, html)
                self.assertIn(selector, script)

    def test_navigation_and_home_expose_vlan(self):
        route = reverse("learning:vlan_concept")
        self.assertContains(self.client.get(reverse("learning:home")), route)
        self.assertContains(self.client.get(reverse("learning:delivery_concept")), route)
        self.assertContains(self.client.get(route), 'aria-current="page"', html=False)

    def test_checkpoint_has_ten_activities_and_requested_difficulty(self):
        self.assertEqual(len(VLAN_ACTIVITIES), 10)
        self.assertEqual(set(VLAN_ACTIVITY_MAP), {str(number) for number in range(1, 11)})
        self.assertEqual([item["difficulty_level"] for item in VLAN_ACTIVITIES], [3, 3, 4, 4, 4, 4, 5, 5, 5, 5])
        self.assertTrue(all(item["mode"] == "investigation" for item in VLAN_ACTIVITIES[6:]))

    def test_board_model_is_vlan_aware_and_keeps_future_fields(self):
        source = (settings.BASE_DIR / "static" / "js" / "switch-board.js").read_text(encoding="utf-8")
        for fragment in ("vlanAware", "access_vlan", "allowed_vlans", "native_vlan", "tagged_state", "tableKey", "setAccessVlan"):
            self.assertIn(fragment, source)
        self.assertIn("port.access_vlan === vlan", source)
        self.assertIn('"vlan-concept-shared"', source)
        self.assertNotIn('"vlan-didactic-opening"', source)

    def test_visualization_models_vlan_broadcast_access_and_a11y(self):
        response = self.client.get(reverse("learning:vlan_concept"))
        template = (settings.BASE_DIR / "templates" / "learning" / "vlan_concept.html").read_text(encoding="utf-8")
        script = (settings.BASE_DIR / "static" / "js" / "vlan-concept.js").read_text(encoding="utf-8")
        css = (settings.BASE_DIR / "static" / "css" / "vlan-concept.css").read_text(encoding="utf-8")
        self.assertIn('state.pcEVlan === 10', script)
        self.assertIn("function applyAccess()", script)
        self.assertIn("function testPcE()", script)
        self.assertIn("unknown-unicast flooding", template)
        self.assertIn("roteamento de Camada 3", template)
        self.assertIn("VLAN não determina automaticamente uma sub-rede IP", template)
        self.assertNotIn("data-cli-vlan=", template)
        self.assertIn("data-cli-pc-e-vlan10", template)
        self.assertIn("data-cli-pc-e-vlan20", template)
        self.assertNotIn("Unknown Unicast A", template)
        self.assertIn("focus-visible", css)
        self.assertIn(".vlan-static-diagram", css)
        self.assertIn("@media(max-width:360px)", css)
        self.assertIn("prefers-reduced-motion", css)

    def test_static_vlan_diagram_and_contextual_terms(self):
        response = self.client.get(reverse("learning:vlan_concept"))
        page = response.content.decode()
        concept = page.split('<section class="vlan-concept-copy"', 1)[1].split('</section>', 1)[0]
        diagram = page.split('<figure class="vlan-static-figure"', 1)[1].split('</figure>', 1)[0]
        self.assertLess(page.index('id="vlan-concept-title"'), page.index('id="vlan-visual-title"'))
        self.assertIn("Uma <strong>VLAN</strong> (rede local virtual)", concept)
        self.assertIn("grupos separados no mesmo equipamento físico", concept)
        self.assertIn("Cada VLAN delimita um", concept)
        for text in ("PC-A", "PC-B", "PC-C", "PC-D", "VLAN 10", "VLAN 20", "SW1", "recebe", "não recebe", "roteamento de Camada 3"):
            self.assertIn(text, diagram)
        self.assertEqual(diagram.count('class="vlan-static-switch"'), 1)
        self.assertIn('role="img" aria-label="Um único switch físico', diagram)
        self.assertNotIn("<button", diagram)
        self.assertNotIn("data-vlan-mode", page)
        self.assertNotIn("data-broadcast-run", page)
        for glossary_id in ("vlan-tip-segmentation", "vlan-tip-domain", "vlan-tip-access"):
            self.assertIn(f'aria-controls="{glossary_id}"', concept)
            self.assertIn(f'aria-describedby="{glossary_id}"', page)
            self.assertIn(f'id="{glossary_id}" role="tooltip" hidden', page)
        self.assertEqual(page.count("data-vlan-glossary"), 3)
        self.assertIn("data-access-demo", page)
        self.assertIn("data-vlan-checkpoint-start", page)
        script = (settings.BASE_DIR / "static" / "js" / "vlan-concept.js").read_text(encoding="utf-8")
        for fragment in ('event.pointerType === "mouse"', 'event.pointerType !== "touch"', 'event.key === "Escape"', 'document.addEventListener("pointerdown"'):
            self.assertIn(fragment, script)

    def test_checkpoint_retains_switch_board_scripts_and_ajax(self):
        response = self.client.get(reverse("learning:vlan_concept"))
        html = response.content.decode()
        script = (settings.BASE_DIR / "static" / "js" / "vlan-concept.js").read_text(encoding="utf-8")
        self.assertContains(response, 'id="vlan-checkpoint"', html=False)
        self.assertContains(response, 'data-vlan-checkpoint-start', html=False)
        self.assertContains(response, "switch-board.js?v=vlan-visual-1")
        self.assertContains(response, "switch-workbench.js")
        self.assertIn('"X-Requested-With": "XMLHttpRequest"', script)
        self.assertIn('querySelector("#vlan-checkpoint")', script)
        self.assertIn("window.NetStudySwitchWorkbench?.capture()", script)
        active_checkpoint = self.start(ajax=True)
        self.assertEqual(active_checkpoint.status_code, 200)
        self.assertIn('data-switch-board', active_checkpoint.json()["html"])

    def test_cli_commands_and_access_only_scope_exist(self):
        source = (settings.BASE_DIR / "static" / "js" / "switch-workbench.js").read_text(encoding="utf-8")
        self.assertIn('command === "show vlan brief"', source)
        self.assertIn("switchport", source)
        self.assertNotIn("encapsulation dot1q", source.lower())

    def test_evidence_is_required_for_investigations(self):
        for number in (3, 6, 7, 8, 9, 10):
            item = VLAN_ACTIVITY_MAP[str(number)]
            self.assertTrue(item["required_evidence"])
            self.assertEqual(set(item["required_evidence"]), {evidence["id"] for evidence in item["evidence"]})

    def test_all_misconception_codes_have_labels(self):
        used = {code for item in VLAN_ACTIVITIES for code in item.get("misconceptions", {}).values()}
        self.assertTrue(used.issubset(VLAN_MISCONCEPTION_LABELS))
        self.assertIn("uses_trunk_as_generic_fix", VLAN_MISCONCEPTION_LABELS)

    def test_async_start_and_correct_answer(self):
        response = self.start(ajax=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn('id="vlan-checkpoint"', response.json()["html"])
        answer = self.answer_map(VLAN_ACTIVITY_MAP["1"]["correct_map"], ajax=True)
        self.assertTrue(answer.json()["correct"])
        self.assertFalse(answer.json()["guided"])

    def test_wrong_feedback_and_second_error_hint(self):
        self.start()
        response = self.answer_map({"c": "v10"})
        self.assertContains(response, "compartilhar o switch físico")
        self.assertIn("assumes_physical_switch_is_one_logical_network", self.client.session["vlan_checkpoint"]["answers"]["1"]["misconception_codes"])
        response = self.answer_map({"a": "v10"})
        self.assertContains(response, "Comece pela VLAN da porta de entrada")
        self.assertEqual(self.client.session["vlan_checkpoint"]["answers"]["1"]["hint_level"], 1)

    def test_correct_answer_cannot_be_replaced(self):
        self.start()
        self.answer_map(VLAN_ACTIVITY_MAP["1"]["correct_map"])
        self.answer_map({"c": "v10"})
        stored = self.client.session["vlan_checkpoint"]["answers"]["1"]
        self.assertTrue(stored["complete"])
        self.assertEqual(stored["attempt_count"], 1)

    def test_reset_and_completion(self):
        self.start()
        self.answer_map({"c": "v10"})
        self.client.post(reverse("learning:vlan_checkpoint_reset_current"), follow=True)
        self.assertNotIn("1", self.client.session["vlan_checkpoint"]["answers"])
        answers = {str(number): {"complete": True, "result_type": "immediate" if number <= 5 else "guided", "misconception_codes": []} for number in range(1, 11)}
        answers["10"]["misconception_codes"] = ["uses_trunk_as_generic_fix"]
        self.set_current(10, answers)
        response = self.client.post(reverse("learning:vlan_checkpoint_next"), follow=True)
        self.assertContains(response, "10 situações resolvidas")
        self.assertContains(response, "Trunk usado como correção genérica")
        self.assertContains(response, "Estudar Trunk + 802.1Q")


class TrunkConceptAndCheckpointTests(TestCase):
    ajax = {"HTTP_X_REQUESTED_WITH": "XMLHttpRequest"}

    def start(self, ajax=False):
        return self.client.post(
            reverse("learning:trunk_checkpoint_start"),
            follow=not ajax,
            **(self.ajax if ajax else {}),
        )

    def answer_map(self, payload, ajax=False):
        return self.client.post(
            reverse("learning:trunk_checkpoint_answer"),
            {"answer_payload": json.dumps(payload)},
            follow=not ajax,
            **(self.ajax if ajax else {}),
        )

    def set_current(self, number, answers=None):
        session = self.client.session
        session["trunk_checkpoint"] = {
            "current": number, "answers": answers or {}, "complete": False,
        }
        session.save()

    def test_page_uses_a_single_frame_journey_without_rendering_switches(self):
        response = self.client.get(reverse("learning:trunk_concept"))
        self.assertEqual(response.status_code, 200)
        page = response.content.decode()
        concept_start = page.index('aria-labelledby="trunk-concept-title"')
        diagram_start = page.index('class="trunk-overview"')
        example_start = page.index('class="trunk-concrete-example"')
        journey_start = page.index('data-trunk-journey')
        self.assertLess(concept_start, diagram_start)
        self.assertLess(diagram_start, example_start)
        self.assertLess(example_start, journey_start)
        self.assertIn("Trunk</strong> é um enlace configurado para transportar tráfego de várias VLANs", page)
        self.assertIn("802.1Q</strong> é o padrão usado neste cenário", page)
        self.assertIn("VLAN 10", page)
        self.assertIn('VLAN ID 20', page)
        self.assertIn("O Trunk transporta as duas VLANs pelo mesmo enlace", page)
        self.assertContains(response, "data-trunk-journey", html=False)
        self.assertContains(response, "→ Trunk identificado → Access")
        self.assertContains(response, "data-route-step=", count=3, html=False)
        self.assertContains(response, "Host A")
        self.assertContains(response, "Host C")
        script = (settings.BASE_DIR / "static" / "js" / "trunk-concept.js").read_text(encoding="utf-8")
        self.assertIn('sourceHost: "Host B", destinationHost: "Host D"', script)
        self.assertContains(response, "VLAN ID")
        self.assertContains(response, "Native VLAN")
        self.assertContains(response, "show interfaces trunk")
        page = page.split('<section id="trunk-checkpoint"', 1)[0]
        for legacy in ('data-switch-board', 'data-trunk-stage', 'data-switch-port', 'trunk-shared-lab', 'data-trunk-stage-link'):
            self.assertNotIn(legacy, page)
        self.assertNotIn('class="dual-switch"', page)
        self.assertNotIn('data-stage-switch=', page)
        self.assertNotContains(response, "ABRIR ESTA ETAPA NO LABORATÓRIO")

    def test_static_overview_shows_two_vlans_on_one_shared_trunk(self):
        response = self.client.get(reverse("learning:trunk_concept"))
        page = response.content.decode()
        overview = page.split('<figure class="trunk-overview"', 1)[1].split('</figure>', 1)[0]
        self.assertEqual(overview.count('class="overview-shared-trunk"'), 1)
        self.assertEqual(overview.count('class="overview-switch '), 2)
        self.assertEqual(overview.count('class="overview-tagged-frame '), 2)
        for text in ("Host A", "Host B", "SW1", "SW2", "Host C", "Host D", "VLAN ID 10", "VLAN ID 20", "Trunk físico único", "mesmo enlace físico", "sem tag"):
            self.assertIn(text, overview)
        self.assertEqual(overview.count('class="overview-flow vlan-10"'), 4)
        self.assertEqual(overview.count('class="overview-flow vlan-20"'), 4)
        self.assertEqual(overview.count('→ Access'), 4)
        self.assertIn('role="img" aria-label="VLAN 10:', overview)
        self.assertIn("as VLANs continuam separadas", overview)
        self.assertIn("A tag identifica a VLAN, não o conteúdo do frame", overview)
        self.assertNotIn("<button", overview)
        self.assertNotIn("data-overview-", overview)
        source = (settings.BASE_DIR / "static" / "js" / "trunk-concept.js").read_text(encoding="utf-8")
        self.assertNotIn("[data-trunk-overview]", source)
        self.assertNotIn("setTimeout", source)
        self.assertIn('data-trunk-journey', page)
        self.assertIn('data-allowed-toggle', page)
        self.assertIn('data-trunk-checkpoint-start', page)

    def test_contextual_glossary_has_accessible_definitions_without_replacing_page_content(self):
        response = self.client.get(reverse("learning:trunk_concept"))
        self.assertEqual(response.status_code, 200)
        page = response.content.decode()
        glossary_ids = (
            "trunk-tip-link", "trunk-tip-host", "trunk-tip-interface",
            "trunk-tip-access", "trunk-tip-vlan-id", "trunk-tip-allowed",
            "trunk-tip-link-up", "trunk-tip-untagged",
        )
        self.assertEqual(page.count('data-glossary-trigger'), len(glossary_ids))
        for glossary_id in glossary_ids:
            self.assertIn(f'aria-controls="{glossary_id}"', page)
            self.assertIn(f'aria-describedby="{glossary_id}"', page)
            self.assertIn(f'<span class="trunk-glossary-popover" id="{glossary_id}" role="tooltip" hidden>', page)
        self.assertEqual(page.count('aria-controls="trunk-tip-link"'), 1)
        self.assertEqual(page.count('aria-controls="trunk-tip-access"'), 1)
        self.assertLess(page.index('aria-controls="trunk-tip-link"'), page.index('id="trunk-concept-title"'))
        self.assertLess(page.index('aria-controls="trunk-tip-access"'), page.index('data-route-step="access-in"'))
        for definition in (
            "conexão lógica, não apenas um cabo", "Dispositivos finais, como PCs ou servidores",
            "não uma porta TCP/UDP", "tráfego do host à VLAN configurada",
            "Número que identifica a VLAN indicada pela tag 802.1Q",
            "não atravessa, mesmo com o enlace ativo", "não garante que todas as VLANs estejam permitidas",
            "A Native VLAN é um caso opcional relacionado",
        ):
            self.assertIn(definition, page)
        self.assertIn("data-journey-vlan=\"10\"", page)
        self.assertIn("data-journey-vlan=\"20\"", page)
        self.assertIn("data-allowed-toggle", page)
        self.assertIn("data-trunk-checkpoint-start", page)
        self.assertIn("Native VLAN</summary>", page)
        source = (settings.BASE_DIR / "static" / "js" / "trunk-concept.js").read_text(encoding="utf-8")
        for fragment in ("event.key === \"Escape\"", 'event.pointerType !== "touch"', 'event.pointerType === "mouse"', 'trigger.addEventListener("focus"', 'document.addEventListener("pointerdown"'):
            self.assertIn(fragment, source)
        css = (settings.BASE_DIR / "static" / "css" / "trunk-concept.css").read_text(encoding="utf-8")
        self.assertIn("border-bottom:1px dotted", css)
        self.assertIn("calc(100vw - 1rem)", css)

    def test_forwarding_model_supports_allowed_native_broadcast_and_independent_state(self):
        board = (settings.BASE_DIR / "static" / "js" / "switch-board.js").read_text(encoding="utf-8")
        stage = (settings.BASE_DIR / "static" / "js" / "trunk-stage.js").read_text(encoding="utf-8")
        for fragment in ("allowed_vlans", "native_vlan", "receiveTrunkFrame", "portCarriesVlan"):
            self.assertIn(fragment, board)
        for fragment in ("class TrunkLink", "this.sw1", "this.sw2", ".includes(vlan)", "UNTAGGED / NATIVE"):
            self.assertIn(fragment, stage)
        self.assertIn('kind="broadcast"', stage)

    def test_frame_journey_supports_both_vlans_and_manual_tagged_progress(self):
        response = self.client.get(reverse("learning:trunk_concept"))
        concept = (settings.BASE_DIR / "static" / "js" / "trunk-concept.js").read_text(encoding="utf-8")
        stage = (settings.BASE_DIR / "static" / "js" / "trunk-stage.js").read_text(encoding="utf-8")
        self.assertContains(response, 'data-journey-vlan="10"', html=False)
        self.assertContains(response, 'data-journey-vlan="20"', html=False)
        for fragment in ('state.vlan = Number(vlan)', 'state.step = 1', 'state.step = 2', 'state.step = 3', 'VLAN ID ${state.vlan}', 'Frame recebido · sem tag'):
            self.assertIn(fragment, concept)
        self.assertNotIn("setTimeout", concept)
        self.assertNotIn("setTimeout", stage)

    def test_allowed_vlan_toggle_blocks_vlan20_but_keeps_link_up_and_vlan10(self):
        response = self.client.get(reverse("learning:trunk_concept"))
        self.assertContains(response, 'data-link-status>UP</span>', html=False)
        self.assertContains(response, 'data-allowed-list>10, 20</b>', html=False)
        concept = (settings.BASE_DIR / "static" / "js" / "trunk-concept.js").read_text(encoding="utf-8")
        for fragment in ('state.allowed = state.allowed.includes(20) ? [10] : [10, 20]', 'state.allowed.includes(state.vlan)', 'VLAN 20 foi removida da lista permitida', 'VLAN 10 continua permitida', 'VLAN 20 voltou à lista permitida'):
            self.assertIn(fragment, concept)

    def test_cli_supports_required_observation_commands(self):
        source = (settings.BASE_DIR / "static" / "js" / "trunk-workbench.js").read_text(encoding="utf-8")
        for command in ("show interfaces trunk", "show interfaces gi0/8 switchport", "show vlan brief", "show mac address-table"):
            self.assertIn(command, source.lower())
        response = self.client.get(reverse("learning:trunk_concept"))
        self.assertContains(response, "show interfaces trunk")
        self.assertContains(response, "<details", html=False)
        self.assertNotContains(response, "data-cli-trunk-row", html=False)

    def test_clarity_interactions_keep_the_javascript_contract(self):
        source = (settings.BASE_DIR / "static" / "js" / "trunk-concept.js").read_text(encoding="utf-8")
        response = self.client.get(reverse("learning:trunk_concept"))
        for selector in (
            "data-trunk-journey", "data-journey-vlan", "data-journey-next",
            "data-journey-reset", "data-allowed-toggle", "data-route-tag",
            "data-reveal-reference", "data-trunk-checkpoint-start",
        ):
            self.assertContains(response, selector, html=False)
            self.assertIn(selector, source)

    def test_direct_actions_replace_old_quizzes_and_rapid_fire(self):
        response = self.client.get(reverse("learning:trunk_concept"))
        for selector in (
            "data-connection-choice", "data-tag-choice", "data-broadcast-choice",
            "data-allowed-choice", "data-trunk-rapid-fire", "data-rapid-answer",
        ):
            self.assertNotContains(response, selector, html=False)
        self.assertContains(response, "uma VLAN pode ser bloqueada sem derrubar o enlace.")
        self.assertContains(response, "roteamento de Camada 3")
        self.assertContains(response, "o host recebe o frame sem precisar processar a tag.")

    def test_shared_controls_are_keyboard_native_and_layout_is_responsive(self):
        response = self.client.get(reverse("learning:trunk_concept"))
        self.assertContains(response, 'data-journey-live aria-live="polite"', html=False)
        self.assertContains(response, 'data-journey-feedback aria-live="polite"', html=False)
        self.assertContains(response, 'data-journey-next', html=False)
        self.assertContains(response, 'aria-live="polite"', html=False)
        css = (settings.BASE_DIR / "static" / "css" / "trunk-concept.css").read_text(encoding="utf-8")
        for fragment in ("max-width:360px", "prefers-reduced-motion", ":focus-visible"):
            self.assertIn(fragment, css)

    def test_checkpoint_has_exactly_ten_with_requested_difficulty_and_investigations(self):
        self.assertEqual(len(TRUNK_ACTIVITIES), 10)
        self.assertEqual(set(TRUNK_ACTIVITY_MAP), {str(number) for number in range(1, 11)})
        self.assertEqual([item["difficulty_level"] for item in TRUNK_ACTIVITIES], [3, 3, 4, 4, 4, 4, 5, 5, 5, 5])
        self.assertEqual([item["mode"] for item in TRUNK_ACTIVITIES[6:]], ["investigation"] * 4)
        for number in (5, 7, 8, 9, 10):
            self.assertTrue(TRUNK_ACTIVITY_MAP[str(number)]["required_evidence"])

    def test_advanced_scenarios_model_allowed_native_and_full_challenge(self):
        allowed = TRUNK_ACTIVITY_MAP["8"]
        native = TRUNK_ACTIVITY_MAP["9"]
        challenge = TRUNK_ACTIVITY_MAP["10"]
        self.assertEqual((allowed["allowed_a"], allowed["allowed_b"]), ("10,20", "10"))
        self.assertEqual((native["native_a"], native["native_b"]), ("10", "20"))
        self.assertIn("arp-b-d", challenge["actions"])
        self.assertIn("known-b-d", challenge["actions"])
        self.assertIn("trunk:inspect", challenge["required_actions"])

    def test_async_start_immediate_and_answer_lock(self):
        response = self.start(ajax=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn('id="trunk-checkpoint"', response.json()["html"])
        response = self.answer_map(TRUNK_ACTIVITY_MAP["1"]["correct_map"], ajax=True)
        self.assertTrue(response.json()["correct"])
        self.assertFalse(response.json()["guided"])
        self.answer_map({"hosta": "choice"}, ajax=True)
        stored = self.client.session["trunk_checkpoint"]["answers"]["1"]
        self.assertEqual(stored["attempt_count"], 1)
        self.assertTrue(stored["complete"])

    def test_wrong_feedback_then_guided_completion(self):
        self.start()
        response = self.answer_map({"hosta": "choice"})
        self.assertContains(response, "host convencional")
        response = self.answer_map(TRUNK_ACTIVITY_MAP["1"]["correct_map"])
        stored = self.client.session["trunk_checkpoint"]["answers"]["1"]
        self.assertEqual(stored["result_type"], "guided")
        self.assertContains(response, "Correto")

    def test_all_misconceptions_have_labels(self):
        used = {code for item in TRUNK_ACTIVITIES for code in item.get("misconceptions", {}).values()}
        self.assertTrue(used.issubset(TRUNK_MISCONCEPTION_LABELS))
        self.assertEqual(len(TRUNK_MISCONCEPTION_LABELS), 14)

    def test_reset_and_completion(self):
        self.start()
        self.answer_map({"hosta": "choice"})
        self.client.post(reverse("learning:trunk_checkpoint_reset_current"), **self.ajax)
        self.assertNotIn("1", self.client.session["trunk_checkpoint"]["answers"])
        answers = {
            str(number): {
                "complete": True,
                "result_type": "immediate" if number <= 5 else "guided",
                "misconception_codes": [],
            }
            for number in range(1, 11)
        }
        answers["10"]["misconception_codes"] = ["confuses_trunk_with_inter_vlan_routing"]
        self.set_current(10, answers)
        response = self.client.post(reverse("learning:trunk_checkpoint_next"), follow=True)
        self.assertContains(response, "10 situações resolvidas")
        self.assertContains(response, "Confunde trunk com roteamento inter-VLAN")
        self.assertContains(response, "IPv4 + Sub-rede")

    def test_no_reload_hooks_and_navigation(self):
        response = self.client.get(reverse("learning:trunk_concept"))
        self.assertContains(response, "data-trunk-checkpoint-start", html=False)
        response = self.start()
        self.assertContains(response, "data-trunk-reset-current", html=False)
        self.assertContains(response, reverse("learning:vlan_concept"))
        self.assertContains(self.client.get(reverse("learning:home")), reverse("learning:trunk_concept"))
        source = (settings.BASE_DIR / "static" / "js" / "trunk-concept.js").read_text(encoding="utf-8")
        self.assertIn("fetch(", source)
        self.assertIn("NetStudyTrunkWorkbench?.init", source)


class IPv4SubnetConceptTests(TestCase):
    def start(self):
        return self.client.post(reverse("learning:ipv4_checkpoint_start"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")

    def test_page_loads_with_exactly_five_areas(self):
        response = self.client.get(reverse("learning:ipv4_concept"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "data-ipv4-area=", count=5, html=False)
        self.assertContains(response, "Como um host descobre se o destino está na rede local")
        self.assertContains(response, "O que um endereço IPv4 representa")

    def test_reusable_visualizer_outputs_and_accessible_blocks_are_present(self):
        response = self.client.get(reverse("learning:ipv4_concept"))
        self.assertContains(response, "data-subnet-visualizer", html=False)
        for label in ("Network", "Broadcast", "First Host", "Last Host", "Total Addresses", "Usable Hosts", "Subnet Mask", "Block Size"):
            self.assertContains(response, label)
        source = (settings.BASE_DIR / "static" / "js" / "subnet-visualizer.js").read_text(encoding="utf-8")
        for fragment in ("function calculate", "destinationNetwork", "networkBits", "hostBits", "maskFromPrefix", "local", 'type="button"', "aria-label"):
            self.assertIn(fragment, source)

    def test_prefix_progression_and_delayed_binary_exist(self):
        response = self.client.get(reverse("learning:ipv4_concept"))
        for value in ("255.255.0.0", "255.255.255.0", "255.255.255.128", "255.255.255.192", "255.255.255.224", "255.255.255.240"):
            self.assertContains(response, value)
        self.assertContains(response, "POR QUE /26 CRIA BLOCOS DE 64?")
        self.assertNotContains(response, "255.0.0.0")

    def test_local_remote_decision_and_arp_consequence_are_explicit(self):
        response = self.client.get(reverse("learning:ipv4_concept"))
        for value in ("192.168.10.90", "192.168.10.120", "192.168.10.130", "192.168.10.200"):
            self.assertContains(response, value.split("192.168.10")[1])
        self.assertContains(response, "ARP pelo IPv4 do destino")
        self.assertContains(response, "próximo salto local")
        self.assertContains(response, "MESMA APARÊNCIA NÃO SIGNIFICA MESMA SUB-REDE")

    def test_terminal_rapid_fire_and_reference_answer_are_present(self):
        response = self.client.get(reverse("learning:ipv4_concept"))
        self.assertContains(response, "192.168.50.70")
        self.assertContains(response, "255.255.255.192")
        self.assertContains(response, "RAPID FIRE · 4 PERGUNTAS")
        self.assertContains(response, "O host interpreta seu próprio endereço IPv4 junto com sua máscara")

    def test_navigation_exposes_ipv4_after_trunk(self):
        route = reverse("learning:ipv4_concept")
        self.assertContains(self.client.get(reverse("learning:home")), route)
        self.assertContains(self.client.get(reverse("learning:trunk_concept")), route)
        self.assertContains(self.client.get(route), 'aria-current="page"', html=False)

    def test_checkpoint_has_exact_requested_shape(self):
        self.assertEqual(len(IPV4_ACTIVITIES), 10)
        self.assertEqual([item["difficulty_level"] for item in IPV4_ACTIVITIES], [3, 3, 4, 4, 4, 4, 4, 5, 5, 5])
        self.assertEqual(IPV4_ACTIVITY_MAP["8"]["correct_map"], {"a_view": "local", "b_view": "remoto"})
        for code in ("ignores_subnet_mask", "ignores_asymmetric_masks", "confuses_ipv4_with_mac", "assumes_remote_host_mac_should_be_arp_resolved_directly"):
            self.assertIn(code, IPV4_MISCONCEPTION_LABELS)

    def test_correct_and_wrong_feedback_and_lock(self):
        self.start()
        wrong = self.client.post(reverse("learning:ipv4_checkpoint_answer"), {"answer_payload": json.dumps({"network": "192.168.10.1", "broadcast": "192.168.10.255"})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertFalse(wrong.json()["correct"])
        self.assertIn("início", wrong.json()["feedback"])
        correct = self.client.post(reverse("learning:ipv4_checkpoint_answer"), {"answer_payload": json.dumps({"network": "192.168.10.0", "broadcast": "192.168.10.255"})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(correct.json()["correct"])
        locked = self.client.post(reverse("learning:ipv4_checkpoint_answer"), {"answer_payload": json.dumps({"network": "x", "broadcast": "x"})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(locked.json()["correct"])
        self.assertEqual(self.client.session["ipv4_checkpoint"]["answers"]["1"]["attempt_count"], 2)

    def test_checkpoint_progress_reset_and_completion(self):
        self.start()
        answer = {"network": "192.168.10.0", "broadcast": "192.168.10.255"}
        self.client.post(reverse("learning:ipv4_checkpoint_answer"), {"answer_payload": json.dumps(answer)}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        advanced = self.client.post(reverse("learning:ipv4_checkpoint_next"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertIn("2 / 10", advanced.json()["html"])
        reset = self.client.post(reverse("learning:ipv4_checkpoint_reset_current"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertIn("2 / 10", reset.json()["html"])
        session = self.client.session
        session["ipv4_checkpoint"] = {"current": 10, "complete": False, "answers": {str(i): {"complete": True, "result_type": "immediate", "misconception_codes": []} for i in range(1, 11)}}
        session.save()
        done = self.client.post(reverse("learning:ipv4_checkpoint_next"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(done.json()["complete"])
        self.assertIn("Você concluiu as 10 situações", done.json()["html"])

    def test_checkpoint_uses_fetch_without_page_reload(self):
        self.assertContains(self.client.get(reverse("learning:ipv4_concept")), "CHECKPOINT FINAL · 10 SITUAÇÕES")
        source = (settings.BASE_DIR / "static" / "js" / "ipv4-concept.js").read_text(encoding="utf-8")
        self.assertIn("fetch(form.action", source)
        self.assertIn("memory", source)


class GatewayConceptTests(TestCase):
    def start(self):
        return self.client.post(reverse("learning:gateway_checkpoint_start"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")

    def test_page_has_continuous_order_without_side_lab(self):
        response = self.client.get(reverse("learning:gateway_concept"))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        markers = ["Do destino ao primeiro salto", "Visão geral do primeiro salto", "Laboratório · monte a primeira entrega", "Evidências e fechamento", 'id="gateway-checkpoint"']
        self.assertEqual([content.index(marker) for marker in markers], sorted(content.index(marker) for marker in markers))
        self.assertNotContains(response, "data-gateway-stage-link")
        css = (settings.BASE_DIR / "static" / "css" / "gateway-concept.css").read_text(encoding="utf-8")
        self.assertNotIn("position: sticky", css)
        self.assertNotIn("min-height: 70vh", css)

    def test_next_hop_and_default_gateway_definitions(self):
        response = self.client.get(reverse("learning:gateway_concept"))
        self.assertContains(response, "Next hop")
        self.assertContains(response, "próximo dispositivo de Camada 3 no caminho")
        self.assertContains(response, "próximo salto padrão quando não há uma")
        for term in ("localmente alcançável", "interface", "rota mais específica"):
            self.assertContains(response, term)
        self.assertContains(response, 'role="tooltip"', count=3)

    def test_gateway_reachability_and_arp_contrast(self):
        response = self.client.get(reverse("learning:gateway_concept"))
        for value in ("192.168.10.1", "192.168.30.1", "192.168.10.80", "192.168.20.50"):
            self.assertContains(response, value)
        self.assertContains(response, 'data-destination-mode="local"')
        self.assertContains(response, 'data-destination-mode="remote"')

    def test_l3_stage_and_layered_destinations(self):
        response = self.client.get(reverse("learning:gateway_concept"))
        self.assertContains(response, "data-l3-stage", count=1, html=False)
        self.assertContains(response, 'data-stage-id="gateway-shared"', count=1, html=False)
        self.assertContains(response, "primeiro frame: MAC RR")
        self.assertContains(response, "Destination MAC")
        self.assertContains(response, "Destination IP")
        self.assertContains(response, "rede remota ···")
        self.assertContains(response, "A linha pontilhada não representa entrega direta")

    def test_shared_path_has_gateway_arp_builder_and_reset(self):
        response = self.client.get(reverse("learning:gateway_concept"))
        for fragment in (
            'data-gateway="192.168.10.1"', 'data-gateway="192.168.30.1"',
            "data-arp-target", "data-destination-builder", "data-gateway-inspector",
        ):
            self.assertContains(response, fragment, html=False)
        self.assertContains(response, "data-lab-reset")
        source = (settings.BASE_DIR / "static" / "js" / "l3-path-stage.js").read_text(encoding="utf-8")
        self.assertIn("this.maxPhase = 5", source)
        self.assertIn("l3stage:phase", source)
        self.assertIn('root.dataset.stageMode === "shared"', source)

    def test_remote_ip_and_gateway_mac_are_explicit_and_redundancy_is_removed(self):
        response = self.client.get(reverse("learning:gateway_concept"))
        self.assertContains(response, "destino IP: 192.168.20.50")
        self.assertContains(response, "primeiro frame: MAC RR")
        self.assertNotContains(response, "Destination IP e Destination MAC representarem dispositivos diferentes indica erro?")
        self.assertNotContains(response, "data-different-question", html=False)
        self.assertNotContains(response, "data-gateway-rapid", html=False)
        self.assertNotContains(response, "RAPID FIRE")
        source = (settings.BASE_DIR / "static" / "js" / "gateway-concept.js").read_text(encoding="utf-8")
        self.assertNotIn("setTimeout", source)
        self.assertNotIn("data-rapid", source)

    def test_shared_path_accessibility_and_responsive_contract(self):
        response = self.client.get(reverse("learning:gateway_concept"))
        self.assertContains(response, 'data-path-node=', count=3, html=False)
        self.assertContains(response, 'aria-live="polite"', html=False)
        css = (settings.BASE_DIR / "static" / "css" / "gateway-concept.css").read_text(encoding="utf-8")
        stage_css = (settings.BASE_DIR / "static" / "css" / "l3-path-stage.css").read_text(encoding="utf-8")
        for fragment in ("max-width: 360px", "prefers-reduced-motion", ":focus-visible"):
            self.assertTrue(fragment in css or fragment in stage_css)

    def test_packet_inspector_terminal_and_cli_consolidation(self):
        response = self.client.get(reverse("learning:gateway_concept"))
        self.assertContains(response, "PACKET INSPECTOR")
        self.assertContains(response, "ipconfig /all")
        self.assertContains(response, "arp -a")
        self.assertContains(response, "route print")
        source = (settings.BASE_DIR / "static" / "js" / "gateway-concept.js").read_text(encoding="utf-8")
        self.assertIn('command === "arp -a"', source)
        self.assertIn('command === "route print"', source)
        self.assertIn("Comando não suportado", source)
        for fragment in ('mode: "remote"', 'mode === "local"', 'state.arp = true', 'state.delivered = true', 'state.gateway !== "192.168.10.1"', 'ip.value === "192.168.10.1"'):
            self.assertIn(fragment, source)

    def test_checkpoint_exact_shape_and_misconceptions(self):
        self.assertEqual(len(GATEWAY_ACTIVITIES), 10)
        self.assertEqual([item["difficulty_level"] for item in GATEWAY_ACTIVITIES], [3, 3, 4, 4, 4, 4, 4, 5, 5, 5])
        self.assertEqual(GATEWAY_ACTIVITY_MAP["4"]["correct_map"], {"ethernet": "rr", "ipv4": "8.8.8.8"})
        self.assertEqual(GATEWAY_ACTIVITY_MAP["9"]["stage"]["gateway_ip"], "192.168.30.1")
        self.assertEqual(GATEWAY_ACTIVITY_MAP["10"]["stage"]["destination_ip"], "192.168.50.150")
        for code in ("assumes_remote_host_is_arp_resolved_directly", "confuses_final_destination_with_next_hop", "ignores_gateway_local_reachability", "assumes_switch_routes_remote_packet"):
            self.assertIn(code, GATEWAY_MISCONCEPTION_LABELS)

    def test_wrong_correct_progressive_feedback_and_lock(self):
        self.start()
        wrong_payload = {"d80": "gateway", "d2080": "gateway"}
        wrong = self.client.post(reverse("learning:gateway_checkpoint_answer"), {"answer_payload": json.dumps(wrong_payload)}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertFalse(wrong.json()["correct"])
        self.assertIn("sub-rede local", wrong.json()["feedback"])
        correct_payload = {"d80": "entrega local", "d2080": "gateway"}
        correct = self.client.post(reverse("learning:gateway_checkpoint_answer"), {"answer_payload": json.dumps(correct_payload)}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(correct.json()["correct"])
        locked = self.client.post(reverse("learning:gateway_checkpoint_answer"), {"answer_payload": json.dumps(wrong_payload)}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(locked.json()["correct"])
        self.assertEqual(self.client.session["gateway_checkpoint"]["answers"]["1"]["result_type"], "guided")

    def test_hint_marks_level_five_as_guided(self):
        session = self.client.session
        session["gateway_checkpoint"] = {"current": 8, "answers": {}, "complete": False}
        session.save()
        hint = self.client.post(reverse("learning:gateway_checkpoint_hint"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertIn("Descubra primeiro", hint.json()["html"])
        answer = self.client.post(reverse("learning:gateway_checkpoint_answer"), {"answer_payload": json.dumps({"verdict": "comportamento esperado"})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(answer.json()["guided"])

    def test_reset_and_completion(self):
        self.start()
        self.client.post(reverse("learning:gateway_checkpoint_answer"), {"answer_payload": json.dumps({"d80": "gateway", "d2080": "gateway"})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        reset = self.client.post(reverse("learning:gateway_checkpoint_reset_current"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertNotIn("Ainda não", reset.json()["html"])
        session = self.client.session
        session["gateway_checkpoint"] = {"current": 10, "complete": False, "answers": {str(i): {"complete": True, "result_type": "immediate", "misconception_codes": []} for i in range(1, 11)}}
        session.save()
        done = self.client.post(reverse("learning:gateway_checkpoint_next"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(done.json()["complete"])
        self.assertIn("Primeiro salto concluído", done.json()["html"])

    def test_no_reload_and_navigation(self):
        response = self.client.get(reverse("learning:gateway_concept"))
        self.assertContains(response, reverse("learning:ipv4_concept"))
        self.assertContains(response, 'aria-current="page"', html=False)
        self.assertContains(self.client.get(reverse("learning:home")), reverse("learning:gateway_concept"))
        source = (settings.BASE_DIR / "static" / "js" / "gateway-concept.js").read_text(encoding="utf-8")
        self.assertIn("fetch(form.action", source)
        self.assertIn("NetStudyL3Path?.init", source)


class RouteConceptTests(TestCase):
    def start(self):
        return self.client.post(reverse("learning:route_checkpoint_start"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")

    def test_page_has_continuous_order_and_single_visualizer(self):
        response = self.client.get(reverse("learning:route_concept"))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        markers = ["O Destination IP orienta o caminho", "Visão geral · decisão de R1", "Laboratório · teste e escolha", "Evidências e fechamento", 'id="route-checkpoint"']
        self.assertEqual([content.index(marker) for marker in markers], sorted(content.index(marker) for marker in markers))
        self.assertNotContains(response, "data-route-stage-link")
        self.assertContains(response, "ROUTING TABLE VISUALIZER", count=1)
        self.assertContains(response, "data-route-visualizer", count=1, html=False)
        for destination in ("192.168.10.80", "192.168.20.50", "8.8.8.8"):
            self.assertContains(response, destination)

    def test_route_anatomy_direct_next_hop_and_default(self):
        response = self.client.get(reverse("learning:route_concept"))
        for value in ("DESTINATION PREFIX", "NEXT HOP", "INTERFACE", "on-link", "0.0.0.0/0"):
            self.assertContains(response, value)
        self.assertContains(response, 'role="tooltip"', count=3)
        self.assertContains(response, "Sem rota compatível, não há caminho")

    def test_longest_prefix_match_and_multiple_matches(self):
        response = self.client.get(reverse("learning:route_concept"))
        self.assertContains(response, "prefixo mais longo")
        for prefix in ("10.0.0.0/8", "10.10.0.0/16", "10.10.20.0/24"):
            self.assertContains(response, prefix)
        source = (settings.BASE_DIR / "static" / "js" / "routing-table-visualizer.js").read_text(encoding="utf-8")
        for fragment in ("function routeMatches", "function selectRoute", "matches.sort", "test(destination", "choose(row)", "reveal()", "COMPATÍVEL", "NÃO COMBINA", "VENCEDORA"):
            self.assertIn(fragment, source)

    def test_guided_actions_replace_old_quizzes_and_rapid_fire(self):
        response = self.client.get(reverse("learning:route_concept"))
        for fragment in (
            'data-route-preset="192.168.10.80"',
            'data-route-preset="192.168.20.50"',
            'data-route-preset="8.8.8.8"',
            'data-specificity-destination="10.10.20.50"',
            'data-specificity-destination="10.50.1.20"',
            "data-route-select",
            "data-route-reveal",
            "data-route-consequence",
        ):
            self.assertContains(response, fragment, html=False)
        for removed in ("data-human-route", "data-show-decision", "data-route-choice", "data-direct-choice", "data-route-rapid", "RAPID FIRE"):
            self.assertNotContains(response, removed)

    def test_visualizer_is_accessible_responsive_and_has_no_timed_sequence(self):
        response = self.client.get(reverse("learning:route_concept"))
        self.assertContains(response, 'data-route-select', count=3, html=False)
        self.assertContains(response, 'aria-live="polite"', html=False)
        visualizer = (settings.BASE_DIR / "static" / "js" / "routing-table-visualizer.js").read_text(encoding="utf-8")
        concept = (settings.BASE_DIR / "static" / "js" / "route-concept.js").read_text(encoding="utf-8")
        css = (settings.BASE_DIR / "static" / "css" / "route-concept.css").read_text(encoding="utf-8")
        self.assertIn('event.key === "Enter"', visualizer)
        self.assertNotIn("setTimeout", visualizer + concept)
        self.assertNotIn("position: sticky", css)
        self.assertNotIn("min-height: 70vh", css)
        for fragment in (":focus-visible", "max-width: 360px", "prefers-reduced-motion"):
            self.assertIn(fragment, css)
        table_css = (settings.BASE_DIR / "static" / "css" / "routing-table-visualizer.css").read_text(encoding="utf-8")
        self.assertIn("attr(data-cell-label)", table_css)

    def test_l3_to_l2_and_cli_are_delayed(self):
        response = self.client.get(reverse("learning:route_concept"))
        self.assertContains(response, "Novo frame: Destination MAC de R2")
        self.assertContains(response, "Destination IP continua")
        for value in ("route print", "Get-NetRoute", "show ip route"):
            self.assertContains(response, value)
        source = (settings.BASE_DIR / "static" / "js" / "route-concept.js").read_text(encoding="utf-8")
        for fragment in ('terminalDevice === "host"', 'terminalDevice === "router"', 'command === "route print"', 'command === "get-netroute"', 'command === "show ip route"', "Comando não disponível"):
            self.assertIn(fragment, source)

    def test_route_data_and_manual_selection_contract(self):
        response = self.client.get(reverse("learning:route_concept"))
        basic = response.context["basic_routes"]
        specific = response.context["specific_routes"]
        self.assertEqual([(r["prefix"], r["next_hop"], r["interface"]) for r in basic], [
            ("192.168.10.0/24", "DIRECT", "LAN"),
            ("192.168.20.0/24", "10.0.0.2", "WAN1"),
            ("0.0.0.0/0", "203.0.113.1", "WAN2"),
        ])
        self.assertEqual([(r["next_hop"], r["interface"]) for r in specific], [
            ("10.0.0.2", "WAN1"), ("10.0.1.2", "WAN3"),
            ("10.0.2.2", "WAN4"), ("203.0.113.1", "WAN2"),
        ])
        self.assertContains(response, "10.0.0.1/30")
        self.assertContains(response, "203.0.113.2/30")
        visualizer = (settings.BASE_DIR / "static" / "js" / "routing-table-visualizer.js").read_text(encoding="utf-8")
        self.assertIn('this.root.querySelector("[data-route-run]").addEventListener("click", () => this.test())', visualizer)
        self.assertIn("this.choose(button.closest", visualizer)
        self.assertIn('routevisualizer:revealed', visualizer)
        self.assertIn("menos específica", visualizer)
        self.assertIn("não combina", visualizer)

    def test_checkpoint_exact_shape_and_misconceptions(self):
        self.assertEqual(len(ROUTE_ACTIVITIES), 10)
        self.assertEqual([x["difficulty_level"] for x in ROUTE_ACTIVITIES], [3,3,4,4,4,4,4,5,5,5])
        self.assertEqual(ROUTE_ACTIVITY_MAP["10"]["correct_map"], {"a":"r3","b":"r4","c":"r2","d":"internet"})
        for code in ("assumes_default_route_has_priority", "chooses_largest_prefix_without_matching_destination", "ignores_directly_connected_route", "assumes_route_changes_final_destination_ip"):
            self.assertIn(code, ROUTE_MISCONCEPTION_LABELS)

    def test_wrong_correct_progressive_feedback_and_lock(self):
        self.start()
        wrong = self.client.post(reverse("learning:route_checkpoint_answer"), {"answer_payload":json.dumps({"prefix":"10.0.0.2","hop":"192.168.20.0/24","interface":"LAN"})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertFalse(wrong.json()["correct"])
        self.assertIn("conjunto", wrong.json()["feedback"])
        answer={"prefix":"192.168.20.0/24","hop":"10.0.0.2","interface":"WAN1"}
        correct=self.client.post(reverse("learning:route_checkpoint_answer"), {"answer_payload":json.dumps(answer)}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(correct.json()["correct"])
        locked=self.client.post(reverse("learning:route_checkpoint_answer"), {"answer_payload":json.dumps({})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(locked.json()["correct"])

    def test_hint_marks_level_five_guided(self):
        session=self.client.session; session["route_checkpoint"]={"current":8,"answers":{},"complete":False}; session.save()
        hint=self.client.post(reverse("learning:route_checkpoint_hint"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertIn("Primeiro identifique", hint.json()["html"])
        answer=self.client.post(reverse("learning:route_checkpoint_answer"), {"answer_payload":json.dumps({"ip":"192.168.20.50","mac":"RR"})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(answer.json()["guided"])

    def test_reset_and_completion(self):
        self.start(); self.client.post(reverse("learning:route_checkpoint_answer"), {"answer_payload":json.dumps({"prefix":"x","hop":"x","interface":"x"})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        reset=self.client.post(reverse("learning:route_checkpoint_reset_current"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertNotIn("Ainda não", reset.json()["html"])
        session=self.client.session; session["route_checkpoint"]={"current":10,"complete":False,"answers":{str(i):{"complete":True,"result_type":"immediate","misconception_codes":[]} for i in range(1,11)}}; session.save()
        done=self.client.post(reverse("learning:route_checkpoint_next"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(done.json()["complete"]); self.assertIn("Escolha de caminho concluída", done.json()["html"])

    def test_no_reload_and_navigation(self):
        response=self.client.get(reverse("learning:route_concept"))
        self.assertContains(response, reverse("learning:gateway_concept")); self.assertContains(response, 'aria-current="page"', html=False)
        self.assertContains(self.client.get(reverse("learning:home")), reverse("learning:route_concept"))
        self.assertContains(self.client.get(reverse("learning:gateway_concept")), reverse("learning:route_concept"))
        source=(settings.BASE_DIR / "static" / "js" / "route-concept.js").read_text(encoding="utf-8")
        self.assertIn("fetch(form.action", source); self.assertIn("memory", source)


class InterVlanConceptTests(TestCase):
    def start(self):return self.client.post(reverse("learning:iv_checkpoint_start"),HTTP_X_REQUESTED_WITH="XMLHttpRequest")
    def test_page_order_and_single_lab(self):
        r=self.client.get(reverse("learning:inter_vlan_concept"))
        self.assertEqual(r.status_code,200)
        content=r.content.decode()
        for heading in ("Uma entrega em cada VLAN","Visão geral · dois frames, um pacote","Laboratório · acompanhe a entrega","O que mudou no caminho?","inter-vlan-checkpoint"):
            self.assertIn(heading,content)
        positions=[content.index(x) for x in ("Uma entrega em cada VLAN","Visão geral · dois frames, um pacote","Laboratório · acompanhe a entrega","O que mudou no caminho?","id=\"inter-vlan-checkpoint\"")]
        self.assertEqual(positions,sorted(positions))
        self.assertContains(r,"data-iv-stage data-stage-id",count=1,html=False)
        self.assertNotContains(r,"data-iv-area=")
        self.assertNotContains(r,"data-iv-stage-link")
    def test_static_overview_two_frames_and_precision(self):
        r=self.client.get(reverse("learning:inter_vlan_concept"))
        for x in ("192.168.10.20/24","192.168.10.1 / MAC R10","192.168.20.30/24","192.168.20.1 / MAC R20","192.168.20.0/24","AA → R10","R20 → BB","Os endereços IP de origem e destino permanecem neste cenário, sem NAT","TTL","Router-on-a-Stick"):
            self.assertContains(r,x)
        self.assertContains(r,'class="iv-overview" role="img"',html=False)
        self.assertNotContains(r,"data-iv-area=")
        self.assertContains(r,"<details class=\"iv-implementation\">",html=False)
    def test_continuous_lab_actions_and_feedback(self):
        r=self.client.get(reverse("learning:inter_vlan_concept"))
        for x in ("data-select-l3","data-arp-target","data-build=\"f1\"","data-iv-next","data-route-prefix","data-arp20-target","data-build=\"f2\"","data-iv-deliver","data-inspect=\"f1\"","data-inspect=\"ip\"","data-inspect=\"f2\"","data-cache-r10","data-cache-bb"):
            self.assertContains(r,x,html=False)
        stage=(settings.BASE_DIR/"static"/"js"/"inter-vlan-path-stage.js").read_text(encoding="utf-8")
        for x in ("checkArp10", "checkFrame1", "checkRoute", "checkArp20", "checkFrame2", "inspect(button)", "this.phase = 0", "192.168.20.30", "R10 → BB", "AA → BB", "192.168.10.0/24 é a rede de origem"):
            self.assertIn(x,stage)
        self.assertNotIn("setMode",stage)
        self.assertNotIn("setTimeout",stage)
        self.assertContains(r,'data-iv-message aria-live="polite"',count=1,html=False)
    def test_responsive_nonsticky_and_visible_focus(self):
        css=(settings.BASE_DIR/"static"/"css"/"inter-vlan-concept.css").read_text(encoding="utf-8")+(settings.BASE_DIR/"static"/"css"/"inter-vlan-path-stage.css").read_text(encoding="utf-8")
        for x in ("max-width:360px",":focus-visible","prefers-reduced-motion",".iv-stage [hidden]"):self.assertIn(x,css)
        self.assertNotIn("position:sticky",css)
    def test_checkpoint_shape_and_misconceptions(self):
        self.assertEqual(len(IV_ACTIVITIES),10);self.assertEqual([x["difficulty_level"] for x in IV_ACTIVITIES],[3,3,4,4,4,4,5,5,5,5]);self.assertEqual(IV_ACTIVITY_MAP["5"]["correct_map"]["f2"],"r20 → bb")
        for x in ("assumes_trunk_performs_inter_vlan_routing","assumes_router_reuses_same_ethernet_frame","assumes_arp_broadcast_crosses_vlan","confuses_trunk_problem_with_routing_problem"):self.assertIn(x,IV_MISCONCEPTION_LABELS)
    def test_wrong_correct_lock(self):
        self.start();w=self.client.post(reverse("learning:iv_checkpoint_answer"),{"answer_payload":json.dumps({"ab":"requer camada 3","ac":"entrega local"})},HTTP_X_REQUESTED_WITH="XMLHttpRequest");self.assertFalse(w.json()["correct"])
        c=self.client.post(reverse("learning:iv_checkpoint_answer"),{"answer_payload":json.dumps({"ab":"entrega local","ac":"requer camada 3"})},HTTP_X_REQUESTED_WITH="XMLHttpRequest");self.assertTrue(c.json()["correct"])
        lock=self.client.post(reverse("learning:iv_checkpoint_answer"),{"answer_payload":"{}"},HTTP_X_REQUESTED_WITH="XMLHttpRequest");self.assertTrue(lock.json()["correct"])
    def test_hint_guided_reset_completion(self):
        s=self.client.session;s["iv_checkpoint"]={"current":7,"answers":{},"complete":False};s.save();self.client.post(reverse("learning:iv_checkpoint_hint"),HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        a=self.client.post(reverse("learning:iv_checkpoint_answer"),{"answer_payload":json.dumps({"cause":"gateway não é localmente alcançável"})},HTTP_X_REQUESTED_WITH="XMLHttpRequest");self.assertTrue(a.json()["guided"])
        reset=self.client.post(reverse("learning:iv_checkpoint_reset"),HTTP_X_REQUESTED_WITH="XMLHttpRequest");self.assertNotIn("Correto",reset.json()["html"])
        s=self.client.session;s["iv_checkpoint"]={"current":10,"complete":False,"answers":{str(i):{"complete":True,"result_type":"immediate","misconception_codes":[]} for i in range(1,11)}};s.save();done=self.client.post(reverse("learning:iv_checkpoint_next"),HTTP_X_REQUESTED_WITH="XMLHttpRequest");self.assertTrue(done.json()["complete"])
    def test_no_reload_navigation_and_cli_optional(self):
        r=self.client.get(reverse("learning:inter_vlan_concept"));self.assertContains(r,reverse("learning:route_concept"));self.assertContains(r,'aria-current="page"',html=False);self.assertContains(r,"show ip route");self.assertContains(self.client.get(reverse("learning:home")),reverse("learning:inter_vlan_concept"));self.assertContains(self.client.get(reverse("learning:route_concept")),reverse("learning:inter_vlan_concept"));src=(settings.BASE_DIR/"static"/"js"/"inter-vlan-concept.js").read_text(encoding="utf-8");self.assertIn("fetch(f.action",src);self.assertIn("memory",src)


class IcmpConceptTests(TestCase):
    def start(self):
        return self.client.post(reverse("learning:icmp_checkpoint_start"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")

    def test_page_order_and_one_main_lab(self):
        response = self.client.get(reverse("learning:icmp_concept"))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        markers = ("O que a resposta permite concluir?", "Visão geral · um caminho, duas leituras", "Laboratório · siga o diagnóstico", "Interprete a observação", 'id="icmp-checkpoint"')
        positions = [content.index(marker) for marker in markers]
        self.assertEqual(positions, sorted(positions))
        self.assertContains(response, 'data-diag-stage data-diag-initial="ping"', count=1, html=False)
        self.assertNotContains(response, "data-icmp-area=")
        self.assertNotContains(response, "data-diag-mode-link")

    def test_concepts_static_path_and_glossary(self):
        response = self.client.get(reverse("learning:icmp_concept"))
        for value in ("ICMP Echo Request", "Echo Reply", "Time Exceeded", "TTL 1 → R1", "TTL 4 → PC-B", "sonda nova", "tracert", "192.168.50.30"):
            self.assertContains(response, value)
        for term in ("rtt", "probe", "ttl", "hop", "timeout"):
            self.assertContains(response, f'id="icmp-tip-{term}" role="tooltip"', html=False)
        self.assertContains(response, "uma sonda nova")
        self.assertContains(response, "não segue ao próximo salto")

    def test_continuous_ping_trace_and_evidence(self):
        response = self.client.get(reverse("learning:icmp_concept"))
        for fragment in ("data-ping-next", "data-start-trace", "data-trace-scenario", "data-ttl-control", "data-diag-run", "data-diag-sent", "data-diag-arrived", "data-diag-returned", "data-diag-unknown", "data-diag-timeline", "data-icmp-inspector"):
            self.assertContains(response, fragment)
        source = (settings.BASE_DIR / "static" / "js" / "diagnostic-path-stage.js").read_text(encoding="utf-8")
        for fragment in ("runPing", "startTrace", "runTrace", "this.probes.set(ttl", "this.scenario === \"silent\"", "Time Exceeded", "ttl < 4", "essa sonda não segue adiante"):
            self.assertIn(fragment, source)
        self.assertNotIn("setMode", source)
        self.assertNotIn("setTimeout", source)

    def test_compact_interpretation_and_terminal_consistency(self):
        response = self.client.get(reverse("learning:icmp_concept"))
        for fragment in ("Request timed out.", "Destination host unreachable", "Perda: 1 de 4 (25%)", "Hop 2: *", "exemplo de interpretação separado", "data-prediction=\"reply\"", "data-prediction=\"service\"", "ping 192.168.50.30", "tracert 192.168.50.30"):
            self.assertContains(response, fragment, html=False)
        self.assertContains(response, "data-prediction-question", count=2, html=False)
        concept = (settings.BASE_DIR / "static" / "js" / "icmp-concept.js").read_text(encoding="utf-8")
        self.assertIn("Received = 4, Lost = 0", concept)
        self.assertIn("hop 2 silencioso", concept)
        self.assertIn("commands[normalized]", concept)
        self.assertIn("Comando não disponível neste cenário", concept)
        self.assertNotContains(response, "<textarea", html=False)

    def test_layout_accessibility_and_dynamic_checkpoint_stage(self):
        css = (settings.BASE_DIR / "static" / "css" / "icmp-concept.css").read_text(encoding="utf-8") + (settings.BASE_DIR / "static" / "css" / "diagnostic-path-stage.css").read_text(encoding="utf-8")
        for fragment in ("max-width:360px", ":focus-visible", "prefers-reduced-motion", "[hidden]"):
            self.assertIn(fragment, css)
        self.assertNotIn("position:sticky", css)
        source = (settings.BASE_DIR / "static" / "js" / "icmp-concept.js").read_text(encoding="utf-8")
        self.assertIn("window.NetStudyDiagnosticPath?.init(cp)", source)
        session = self.client.session
        session["icmp_checkpoint"] = {"current": 6, "answers": {}, "complete": False}
        session.save()
        response = self.client.get(reverse("learning:icmp_concept"))
        self.assertContains(response, 'data-diag-initial="trace"', count=1, html=False)
        self.assertContains(response, "Abrir Diagnostic Path Stage")

    def test_main_stage_is_manual_and_has_one_live_feedback(self):
        response = self.client.get(reverse("learning:icmp_concept"))
        self.assertContains(response, 'data-diag-result aria-live="polite"', count=1, html=False)
        self.assertContains(response, "caminho de volta não precisa ser idêntico")
        self.assertContains(response, "Hop 2 silencioso")

    def test_terminal_and_navigation(self):
        response = self.client.get(reverse("learning:icmp_concept"))
        self.assertContains(response, "ping 192.168.50.30")
        self.assertContains(response, "tracert 192.168.50.30")
        self.assertContains(response, reverse("learning:inter_vlan_concept"))
        self.assertContains(response, 'aria-current="page"', html=False)
        self.assertContains(self.client.get(reverse("learning:home")), reverse("learning:icmp_concept"))
        self.assertContains(self.client.get(reverse("learning:inter_vlan_concept")), reverse("learning:icmp_concept"))

    def test_checkpoint_exact_shape_and_misconceptions(self):
        self.assertEqual(len(ICMP_ACTIVITIES), 10)
        self.assertEqual([item["difficulty_level"] for item in ICMP_ACTIVITIES], [3,3,4,4,4,4,5,5,5,5])
        self.assertEqual(ICMP_ACTIVITY_MAP["6"]["correct_map"], {"hop": "r2"})
        for code in ("assumes_ping_timeout_means_host_is_off", "assumes_packet_loss_identifies_the_cause", "assumes_missing_traceroute_hop_means_forwarding_stopped", "jumps_from_evidence_to_root_cause"):
            self.assertIn(code, ICMP_MISCONCEPTION_LABELS)

    def test_wrong_correct_feedback_and_lock(self):
        self.start()
        wrong = self.client.post(reverse("learning:icmp_checkpoint_answer"), {"answer_payload": json.dumps({"a_to_b":"responde ao teste","b_to_a":"inicia o teste"})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertFalse(wrong.json()["correct"])
        self.assertIn("Echo Request", wrong.json()["feedback"])
        correct = self.client.post(reverse("learning:icmp_checkpoint_answer"), {"answer_payload": json.dumps({"a_to_b":"inicia o teste","b_to_a":"responde ao teste"})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(correct.json()["correct"])
        locked = self.client.post(reverse("learning:icmp_checkpoint_answer"), {"answer_payload":"{}"}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(locked.json()["correct"])

    def test_hint_guided_reset_completion_and_no_reload(self):
        session = self.client.session; session["icmp_checkpoint"]={"current":8,"answers":{},"complete":False}; session.save()
        hint = self.client.post(reverse("learning:icmp_checkpoint_hint"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertIn("Separe primeiro", hint.json()["html"])
        answer = self.client.post(reverse("learning:icmp_checkpoint_answer"), {"answer_payload":json.dumps({"verdict":"não é sustentada"})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(answer.json()["guided"])
        reset = self.client.post(reverse("learning:icmp_checkpoint_reset"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertNotIn("Correto.", reset.json()["html"])
        session=self.client.session;session["icmp_checkpoint"]={"current":10,"complete":False,"answers":{str(i):{"complete":True,"result_type":"immediate","misconception_codes":[]} for i in range(1,11)}};session.save()
        done=self.client.post(reverse("learning:icmp_checkpoint_next"),HTTP_X_REQUESTED_WITH="XMLHttpRequest");self.assertTrue(done.json()["complete"])
        source=(settings.BASE_DIR/"static"/"js"/"icmp-concept.js").read_text(encoding="utf-8");self.assertIn("fetch(f.action",source);self.assertIn("memory",source)


class TransportConceptTests(TestCase):
    def start(self):
        return self.client.post(reverse("learning:transport_checkpoint_start"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")

    def test_page_opens_with_short_transport_model_and_single_column_flow(self):
        response = self.client.get(reverse("learning:transport_concept"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "data-transport-area=\"01\"", html=False)
        self.assertContains(response, "IP leva dados entre hosts")
        self.assertContains(response, "nenhum deles escolhe a rota")
        self.assertContains(response, "datagramas separados")
        self.assertContains(response, "fluxo contínuo de bytes")
        self.assertContains(response, 'data-context-glossary', count=1, html=False)
        self.assertContains(response, 'aria-controls="transport-tip-datagram"')
        self.assertContains(response, 'id="transport-tip-datagram" role="tooltip" hidden')
        self.assertContains(response, "Datagrama: unidade independente transportada pelo UDP.")
        self.assertContains(response, "context-glossary.css")
        self.assertContains(response, "context-glossary.js")
        self.assertContains(response, "transport-visual-5")
        html = response.content.decode()
        self.assertLess(html.index("IP leva dados entre hosts"), html.index('id="transport-lab"'))
        self.assertLess(html.index('id="transport-lab"'), html.index('id="transport-comparison-title"'))
        css = (settings.BASE_DIR / "static" / "css" / "transport-concept.css").read_text(encoding="utf-8")
        self.assertNotIn("position:sticky", css)

    def test_single_shared_lab_contains_ordered_scenario_protocol_step_compare_controls(self):
        response = self.client.get(reverse("learning:transport_concept"))
        self.assertContains(response, "data-transport-stage", count=1, html=False)
        for value in ("Transport Behavior Lab", "Aplicação A", "Rede IP", "Aplicação B", "data-stage-mode=\"udp\"", "data-transport-open=\"boundaries\"", "data-stage-compare", "data-stage-next"):
            self.assertContains(response, value)
        source = (settings.BASE_DIR / "static" / "js" / "transport-concept.js").read_text(encoding="utf-8")
        for fragment in ("Datagramas independentes", "A mesma perda: parte 3", "A rede entrega os dados na ordem 1, 3, 2", "Os limites dos datagramas ABC e DEF são preservados", "comparisonReady"):
            self.assertIn(fragment, source)

    def test_tcp_stream_retransmission_order_and_connection(self):
        response = self.client.get(reverse("learning:transport_concept"))
        for value in ("Orientado a conexão", "limites dos envios", "Conexão (breve)", "não garante sucesso absoluto"):
            self.assertContains(response, value)
        source = (settings.BASE_DIR / "static" / "js" / "transport-concept.js").read_text(encoding="utf-8")
        for fragment in ("3 chegou · aguarda 2", "4 · chegou", "TCP recupera a parte 3", "3 chegou antes do 2", "prefixo contíguo"):
            self.assertIn(fragment, source)

    def test_no_udp_always_faster_packet_inspector_and_ports_teaser(self):
        response = self.client.get(reverse("learning:transport_concept"))
        self.assertContains(response, "desempenho depende da aplicação, rede, implementação e protocolo superior")
        self.assertContains(response, "UDP não implica perda obrigatória")
        self.assertContains(response, "UDP é sempre mais rápido")
        self.assertContains(response, reverse("learning:ports_concept"))

    def test_real_world_transport_examples_follow_the_comparison_table(self):
        response = self.client.get(reverse("learning:transport_concept"))
        html = response.content.decode()
        table_end = html.index("</table>")
        examples_start = html.index('id="transport-examples-title"')
        self.assertLess(table_end, examples_start)
        for example in ("HTTP/1.1 ou HTTP/2", "SSH", "SFTP", "Consultas DNS", "RTP", "HTTP/3 usa QUIC sobre UDP"):
            self.assertContains(response, example)
        css = (settings.BASE_DIR / "static" / "css" / "transport-concept.css").read_text(encoding="utf-8")
        self.assertIn("--gateway-ink:#102b42", css)

    def test_checkpoint_exact_shape_and_misconceptions(self):
        self.assertEqual(len(TRANSPORT_ACTIVITIES), 10)
        self.assertEqual([item["difficulty_level"] for item in TRANSPORT_ACTIVITIES], [3, 3, 4, 4, 4, 4, 4, 5, 5, 5])
        self.assertEqual(TRANSPORT_ACTIVITY_MAP["6"]["correct_map"], {"boundaries": "udp", "stream": "tcp"})
        for code in ("assumes_udp_is_always_faster", "assumes_udp_retransmits_automatically", "assumes_tcp_preserves_message_boundaries", "assumes_udp_cannot_be_reliable_at_application_layer"):
            self.assertIn(code, TRANSPORT_MISCONCEPTION_LABELS)

    def test_wrong_correct_feedback_and_locked_answer(self):
        self.start()
        wrong = self.client.post(reverse("learning:transport_checkpoint_answer"), {"answer_payload": json.dumps({"protocol": "tcp"})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertFalse(wrong.json()["correct"])
        self.assertIn("datagramas", wrong.json()["feedback"])
        correct = self.client.post(reverse("learning:transport_checkpoint_answer"), {"answer_payload": json.dumps({"protocol": "udp"})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(correct.json()["correct"])
        locked = self.client.post(reverse("learning:transport_checkpoint_answer"), {"answer_payload": "{}"}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(locked.json()["correct"])

    def test_immediate_guided_hint_reset_and_completion(self):
        session = self.client.session; session["transport_checkpoint"] = {"current": 7, "answers": {}, "complete": False}; session.save()
        self.client.post(reverse("learning:transport_checkpoint_hint"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        answer = self.client.post(reverse("learning:transport_checkpoint_answer"), {"answer_payload": json.dumps({"verdict": "não justificada"})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(answer.json()["guided"])
        reset = self.client.post(reverse("learning:transport_checkpoint_reset"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertNotIn("Correto.", reset.json()["html"])
        session = self.client.session; session["transport_checkpoint"] = {"current": 10, "complete": False, "answers": {str(i): {"complete": True, "result_type": "immediate", "misconception_codes": []} for i in range(1, 11)}}; session.save()
        done = self.client.post(reverse("learning:transport_checkpoint_next"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(done.json()["complete"])
        self.assertIn("sem apoio", done.json()["html"])

    def test_reset_no_reload_accessibility_and_navigation(self):
        response = self.client.get(reverse("learning:transport_concept"))
        self.assertContains(response, "Resetar cenário")
        source = (settings.BASE_DIR / "static" / "js" / "transport-concept.js").read_text(encoding="utf-8")
        for marker in ('aria-live="polite"', 'aria-pressed="false"', 'tabindex="-1"', 'data-stage-next', 'data-stage-reset', 'data-stage-compare', 'data-prediction-toggle'):
            self.assertContains(response, marker)
        self.assertIn('const state = { protocol: null, scenario: null, step: -1 }', source)
        self.assertNotIn("setTimeout", source)
        for marker in ("data-transport-rapid", "data-rapid-question", "data-udp-check", "data-tcp-check", "data-loss-visible"):
            self.assertNotContains(response, marker)
        self.assertNotIn("setTimeout", source)
        css = (settings.BASE_DIR / "static" / "css" / "transport-concept.css").read_text(encoding="utf-8")
        self.assertNotIn("position:sticky", css)
        self.assertIn("max-width:360px", css)
        self.assertIn("prefers-reduced-motion", css)
        self.assertContains(response, reverse("learning:icmp_concept"))
        self.assertContains(response, 'aria-current="page"', html=False)
        self.assertContains(self.client.get(reverse("learning:home")), reverse("learning:transport_concept"))
        self.assertContains(self.client.get(reverse("learning:icmp_concept")), reverse("learning:transport_concept"))
        self.assertIn("fetch(form.action", source); self.assertIn("memory", source); self.assertNotIn("location.reload", source)


class PortsConceptTests(TestCase):
    def start(self):
        return self.client.post(reverse("learning:ports_checkpoint_start"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")

    def test_route_navigation_single_column_visualization_and_one_lab(self):
        response = self.client.get(reverse("learning:ports_concept"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-ports-area="01"', count=1, html=False)
        self.assertContains(response, "data-endpoint-lab", count=1, html=False)
        self.assertContains(response, 'aria-current="page"', html=False)
        self.assertContains(response, "TCP 443 · Web")
        self.assertContains(response, "TCP 22 · SSH")
        self.assertContains(response, "UDP 53 · DNS")
        self.assertContains(response, "192.168.10.20:53012 → 192.168.20.30:443")
        self.assertContains(response, "192.168.20.30:443 → 192.168.10.20:53012")
        self.assertContains(response, "TCP 53 e UDP 53 são endpoints distintos")
        self.assertContains(response, 'data-context-glossary', count=2, html=False)
        self.assertContains(response, "context-glossary.css")
        self.assertContains(response, "context-glossary.js")
        for tooltip_id in ("ports-tip-endpoint", "ports-tip-ephemeral"):
            self.assertContains(response, f'aria-controls="{tooltip_id}"')
            self.assertContains(response, f'aria-describedby="{tooltip_id}"')
            self.assertContains(response, f'id="{tooltip_id}" role="tooltip" hidden')
        html = response.content.decode()
        self.assertLess(html.index("Um pedido e sua resposta"), html.index('id="endpoint-lab"'))
        self.assertLess(html.index('id="endpoint-lab"'), html.index('id="ports-checkpoint"'))
        self.assertNotIn('class="ports-layout"', html)
        self.assertNotIn("<textarea", html)
        self.assertNotIn("position:sticky", (settings.BASE_DIR / "static" / "css" / "ports-concept.css").read_text(encoding="utf-8"))
        self.assertContains(self.client.get(reverse("learning:home")), reverse("learning:ports_concept"))
        self.assertContains(self.client.get(reverse("learning:transport_concept")), reverse("learning:ports_concept"))
        self.assertContains(response, reverse("learning:dns_concept"))

    def test_lab_fields_reply_prediction_parallel_flow_and_accessibility(self):
        response = self.client.get(reverse("learning:ports_concept"))
        for text in ("Source IP", "Destination IP", "Source Port", "Destination Port",
                     "192.168.10.20:53012", "data-reply-choice",
                     "data-reply-check", "data-lab-parallel", 'aria-live="polite"', 'tabindex="-1"'):
            self.assertContains(response, text)
        source = (settings.BASE_DIR / "static" / "js" / "ports-concept.js").read_text(encoding="utf-8")
        for text in ("Protocolo:", "IP de destino:", "Porta de destino:", "Porta de origem:",
                     'request.protocol !== service.protocol', 'request.destinationPort !== service.port',
                     'chosen !== "53012"', "state.replyConfirmed", "renderDraft()",
                     "192.168.10.20:53012", "192.168.10.21:53013", "fetch(form.action", "memory"):
            self.assertIn(text, source)
        for unwanted in ("setTimeout", "location.reload", "<textarea"):
            self.assertNotIn(unwanted, source)
        css = (settings.BASE_DIR / "static" / "css" / "ports-concept.css").read_text(encoding="utf-8")
        for text in ("focus-visible", "prefers-reduced-motion", "max-width:360px"):
            self.assertIn(text, css)
        self.assertNotIn("ports-popover", css)
        self.assertNotIn("data-ports-glossary", source)

    def test_terminal_is_allowlisted(self):
        source = (settings.BASE_DIR / "static" / "js" / "ports-concept.js").read_text(encoding="utf-8")
        self.assertIn('command === "netstat -ano"', source)
        self.assertIn('command === "netstat -ano | findstr :443"', source)
        self.assertIn("Comando não disponível nesta simulação.", source)
        self.assertIn("192.168.20.30:443", source)
        self.assertIn("0.0.0.0:22", source)
        self.assertIn("UDP  0.0.0.0:53", source)
        self.assertIn("Terminal simulado executado no servidor", (settings.BASE_DIR / "templates" / "learning" / "ports_concept.html").read_text(encoding="utf-8"))
        self.assertNotIn("eval(", source)

    def test_checkpoint_shape_and_wrong_guided_lock(self):
        from .ports_checkpoint import ACTIVITIES as PORTS_ACTIVITIES
        self.assertEqual(len(PORTS_ACTIVITIES), 10)
        self.assertEqual(PORTS_ACTIVITIES[5]["correct_map"], {"source": "443", "destination": "53012"})
        self.start()
        wrong = self.client.post(reverse("learning:ports_checkpoint_answer"),
            {"answer_payload": json.dumps({"host": "destination port"})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertFalse(wrong.json()["correct"])
        self.assertIn("Porta identifica", wrong.json()["feedback"])
        self.client.post(reverse("learning:ports_checkpoint_hint"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        correct = self.client.post(reverse("learning:ports_checkpoint_answer"),
            {"answer_payload": json.dumps({"host": "destination ip"})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(correct.json()["correct"])
        self.assertTrue(correct.json()["guided"])
        locked = self.client.post(reverse("learning:ports_checkpoint_answer"),
            {"answer_payload": json.dumps({"host": "source port"})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(locked.json()["correct"])

    def test_checkpoint_reset_all_ten_and_completion(self):
        from .ports_checkpoint import ACTIVITIES as PORTS_ACTIVITIES
        self.start()
        reset = self.client.post(reverse("learning:ports_checkpoint_reset"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertIn("1 / 10", reset.json()["html"])
        for item in PORTS_ACTIVITIES:
            answer = self.client.post(reverse("learning:ports_checkpoint_answer"),
                {"answer_payload": json.dumps(item["correct_map"])}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
            self.assertTrue(answer.json()["correct"], item["id"])
            next_response = self.client.post(reverse("learning:ports_checkpoint_next"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertTrue(next_response.json()["complete"])
        self.assertIn("Capacidades praticadas", next_response.json()["html"])
        restarted = self.client.post(reverse("learning:ports_checkpoint_restart"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertIn("1 / 10", restarted.json()["html"])


class NetworkServicesConceptTests(TestCase):
    def test_shared_checkpoint_colors_are_scoped_and_loaded_on_every_page(self):
        stylesheet = (settings.BASE_DIR / "static" / "css" / "gateway-concept.css").read_text(encoding="utf-8")
        self.assertIn(".gateway-checkpoint { --gateway-blue: #087ea4; --gateway-ink: #102b42; --gateway-green: #08733e;", stylesheet)
        self.assertIn(".gateway-scenario { padding: 1rem; background: var(--gateway-ink); color: #fff;", stylesheet)
        self.assertIn(".gateway-primary { background: var(--gateway-blue) !important; color: #fff !important;", stylesheet)
        for route in ("gateway_concept", "route_concept", "inter_vlan_concept", "icmp_concept",
                      "transport_concept", "ports_concept", "dns_concept", "dhcp_concept"):
            with self.subTest(route=route):
                response = self.client.get(reverse(f"learning:{route}"))
                self.assertContains(response, "gateway-concept.css")
                self.assertContains(response, "checkpoint-contrast-1")
                self.assertContains(response, 'class="gateway-checkpoint"')

    def test_pages_navigation_labs_and_accessibility(self):
        for kind, previous, next_topic in (
            ("dns", "ports_concept", "dhcp_concept"),
            ("dhcp", "dns_concept", None),
        ):
            with self.subTest(kind=kind):
                response = self.client.get(reverse(f"learning:{kind}_concept"))
                self.assertEqual(response.status_code, 200)
                self.assertContains(response, f"data-{kind}-area=", count=1, html=False)
                self.assertContains(response, f"data-{kind}-lab", count=1, html=False)
                self.assertContains(response, f'id="{kind}-checkpoint"')
                self.assertContains(response, 'aria-current="page"', html=False)
                self.assertContains(response, 'aria-live="polite"', html=False)
                self.assertContains(response, 'tabindex="-1"', html=False)
                self.assertContains(response, reverse(f"learning:{previous}"))
                if next_topic:
                    self.assertContains(response, reverse(f"learning:{next_topic}"))
                else:
                    self.assertContains(response, "TCP por dentro · em breve")
                self.assertContains(self.client.get(reverse("learning:home")), reverse(f"learning:{kind}_concept"))
        self.assertContains(self.client.get(reverse("learning:ports_concept")), reverse("learning:dns_concept"))
        css = (settings.BASE_DIR / "static" / "css" / "network-concept.css").read_text(encoding="utf-8")
        for marker in ("position:sticky", "position:static", "max-width:400px", "focus-visible", "prefers-reduced-motion"):
            self.assertIn(marker, css)
        dns = self.client.get(reverse("learning:dns_concept"))
        self.assertNotContains(dns, 'class="network-layout"')
        self.assertNotContains(dns, "data-dns-open")
        self.assertContains(dns, "dns-concept.css")
        self.assertContains(dns, "data-dns-node=", count=3, html=False)
        self.assertContains(dns, "data-dns-next")
        self.assertContains(dns, "data-dns-clear")
        self.assertContains(dns, "data-dns-query-count")
        self.assertContains(dns, "intranet.exemplo.local → 192.168.20.30")
        self.assertContains(dns, "nslookup")
        self.assertContains(dns, "ping 192.168.20.30")
        self.assertContains(dns, "TCP 443")
        dns_css = (settings.BASE_DIR / "static" / "css" / "dns-concept.css").read_text(encoding="utf-8")
        for marker in ("max-width:360px", "prefers-reduced-motion", "grid-template-columns:1fr"):
            self.assertIn(marker, dns_css)
        dhcp = self.client.get(reverse("learning:dhcp_concept"))
        self.assertNotContains(dhcp, 'class="network-layout"')
        self.assertNotContains(dhcp, "data-dhcp-open")
        self.assertContains(dhcp, "dhcp-concept.css")
        self.assertContains(dhcp, "data-dhcp-node=", count=3, html=False)
        self.assertContains(dhcp, "data-dhcp-progress=", count=4, html=False)
        self.assertContains(dhcp, "data-dhcp-client-field=", count=4, html=False)
        self.assertContains(dhcp, "data-dhcp-field=", count=4, html=False)
        self.assertContains(dhcp, "data-dhcp-next")
        self.assertContains(dhcp, 'data-dhcp-state="missing"')
        self.assertContains(dhcp, "ipconfig /all")
        self.assertContains(dhcp, "ipconfig /renew")
        self.assertContains(dhcp, "concessão temporária")
        dhcp_css = (settings.BASE_DIR / "static" / "css" / "dhcp-concept.css").read_text(encoding="utf-8")
        for marker in ("max-width:360px", "prefers-reduced-motion", "grid-template-columns:1fr", "[hidden]"):
            self.assertIn(marker, dhcp_css)

    def test_labs_terminal_allowlist_and_ajax_memory(self):
        for kind, commands, fallback in (
            ("dns", ('nslookup intranet.exemplo.local', 'ipconfig /displaydns'),
             "Comando não disponível neste cenário. Use nslookup intranet.exemplo.local ou ipconfig /displaydns."),
            ("dhcp", ('ipconfig /all', 'ipconfig /renew'),
             "Comando não disponível neste cenário. Use ipconfig /all ou ipconfig /renew."),
        ):
            with self.subTest(kind=kind):
                source = (settings.BASE_DIR / "static" / "js" / f"{kind}-concept.js").read_text(encoding="utf-8")
                for command in commands:
                    self.assertIn(f'command === "{command}"', source)
                for marker in (fallback, "memory = new Map()", "fetch(form.action"):
                    self.assertIn(marker, source)
                for forbidden in ("setTimeout", "location.reload", "eval(", "data-rapid"):
                    self.assertNotIn(forbidden, source)
        dns = (settings.BASE_DIR / "static" / "js" / "dns-concept.js").read_text(encoding="utf-8")
        for marker in ("Request:", "Response:", "state.cacheValid = true", "state.cacheValid = false", "state.queries += 1", "sem nova consulta ao resolvedor", "ipconfig /displaydns", "displayDns()"):
            self.assertIn(marker, dns)
        self.assertIn('if (state.step === 3) state.queries += 1;', dns)
        self.assertIn('if (state.step === 5) state.cacheValid = true;', dns)
        self.assertIn('state.step = 0;', dns)
        self.assertIn('state.queries = 0;', dns)
        self.assertIn('state.cacheValid ? `${name} → ${address} · válido` : "Vazio"', dns)
        dhcp = (settings.BASE_DIR / "static" / "js" / "dhcp-concept.js").read_text(encoding="utf-8")
        for marker in ("Discover", "Offer", "Request", "ACK", "169.254.10.50", "Máscara 255.255.255.0", "Gateway 192.168.10.1"):
            self.assertIn(marker, dhcp)
        for marker in ('if (state.phase === 4) state.leaseConfirmed = true;',
                       'if (!state.leaseConfirmed || state.phase < 4)',
                       'state.mode === "missing"', 'Discover enviado; nenhuma Offer ou ACK observada.',
                       'state.phase = 4;', 'state.leaseConfirmed = true;', 'allOutput()'):
            self.assertIn(marker, dhcp)

    def test_checkpoints_ten_items_wrong_hint_lock_reset_and_completion(self):
        from .dns_checkpoint import ACTIVITIES as DNS_ACTIVITIES
        from .dhcp_checkpoint import ACTIVITIES as DHCP_ACTIVITIES
        for kind, activities in (("dns", DNS_ACTIVITIES), ("dhcp", DHCP_ACTIVITIES)):
            with self.subTest(kind=kind):
                self.assertEqual(len(activities), 10)
                self.client.post(reverse(f"learning:{kind}_checkpoint_start"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
                first = activities[0]
                field = first["fields"][0]
                wrong_value = next(option.lower() for option in field["options"] if option.lower() != first["correct_map"][field["name"]])
                wrong = self.client.post(reverse(f"learning:{kind}_checkpoint_answer"),
                    {"answer_payload": json.dumps({field["name"]: wrong_value})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
                self.assertFalse(wrong.json()["correct"])
                self.assertEqual(wrong.json()["feedback"], first["wrong_feedback"])
                hint = self.client.post(reverse(f"learning:{kind}_checkpoint_hint"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
                self.assertIn("PISTA", hint.json()["html"])
                correct = self.client.post(reverse(f"learning:{kind}_checkpoint_answer"),
                    {"answer_payload": json.dumps(first["correct_map"])}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
                self.assertTrue(correct.json()["correct"])
                self.assertTrue(correct.json()["guided"])
                locked = self.client.post(reverse(f"learning:{kind}_checkpoint_answer"),
                    {"answer_payload": json.dumps({field["name"]: wrong_value})}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
                self.assertTrue(locked.json()["correct"])
                self.client.post(reverse(f"learning:{kind}_checkpoint_next"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
                reset = self.client.post(reverse(f"learning:{kind}_checkpoint_reset"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
                self.assertIn("2 / 10", reset.json()["html"])
                for activity in activities[1:]:
                    answer = self.client.post(reverse(f"learning:{kind}_checkpoint_answer"),
                        {"answer_payload": json.dumps(activity["correct_map"])}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
                    self.assertTrue(answer.json()["correct"], activity["id"])
                    response = self.client.post(reverse(f"learning:{kind}_checkpoint_next"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
                self.assertTrue(response.json()["complete"])
                self.assertIn("Capacidades praticadas", response.json()["html"])
                self.assertIn("Pontos a revisar", response.json()["html"])
                restarted = self.client.post(reverse(f"learning:{kind}_checkpoint_restart"), HTTP_X_REQUESTED_WITH="XMLHttpRequest")
                self.assertIn("1 / 10", restarted.json()["html"])


class RapidFireTests(TestCase):
    def start(self):
        return self.client.post(reverse("learning:rapid_fire_start"), follow=True)

    def test_rapid_fire_remains_twelve_items(self):
        self.assertEqual(len(RAPID_FIRE), 12)
        self.assertContains(self.client.get(reverse("learning:rapid_fire_intro")), "Iniciar Rapid Fire")

    def test_rapid_fire_progresses(self):
        self.start()
        self.client.post(reverse("learning:rapid_fire_item", args=[1]), {"answer": "MAC"})
        response = self.client.post(reverse("learning:rapid_fire_next", args=[1]), follow=True)
        self.assertContains(response, "2 / 12")

    def test_rapid_fire_wrong_then_correct_is_guided(self):
        self.start()
        self.client.post(reverse("learning:rapid_fire_item", args=[1]), {"answer": "DNS"})
        self.client.post(reverse("learning:rapid_fire_item", args=[1]), {"answer": "MAC"})
        self.assertEqual(self.client.session["rapid_fire"]["answers"]["1"]["outcome"], "guided")

    def test_rapid_fire_completion_counts(self):
        session = self.client.session
        session["rapid_fire"] = {"answers": {str(index): {"complete": True, "outcome": "immediate" if index <= 7 else "guided"} for index in range(1, 13)}}
        session.save()
        response = self.client.get(reverse("learning:rapid_fire_completion"))
        self.assertContains(response, "Rapid Fire concluído")
        self.assertContains(response, ">12<", html=False)
