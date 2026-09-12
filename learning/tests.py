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
        self.assertContains(response, 'aria-current="page">MAC Address</a>', html=False)

    def test_frame_concept_loads_and_appears_on_home_and_navigation(self):
        home = self.client.get(reverse("learning:home"))
        self.assertContains(home, "Frame Ethernet")
        self.assertContains(home, "Estudar Frame Ethernet")
        self.assertContains(home, reverse("learning:frame_concept"))
        response = self.client.get(reverse("learning:frame_concept"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "O que é um Frame Ethernet?")
        self.assertContains(response, 'aria-current="page">Frame Ethernet</a>', html=False)

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
        self.assertContains(response, "Onde esse frame aparece?")
        self.assertContains(response, 'data-frame-area=', count=7, html=False)
        for number in range(1, 8):
            self.assertContains(response, f"{number:02d} ·")
        self.assertNotContains(response, "08 ·")
        self.assertNotContains(response, "E VLAN?")

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
        self.assertContains(response, reverse("learning:switch_concept"))
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

    def test_switch_page_has_exactly_five_areas_and_simplified_reusable_boards(self):
        response = self.client.get(reverse("learning:switch_concept"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "data-switch-area=", count=5, html=False)
        self.assertContains(response, "data-switch-board", count=5, html=False)
        self.assertContains(response, "switch-board-didactic", count=5, html=False)
        self.assertContains(response, "data-switch-port=", count=40, html=False)
        self.assertContains(response, "Decidir por onde encaminhar o frame")
        self.assertContains(response, "SOURCE MAC + INGRESS PORT → APRENDER")
        self.assertContains(response, "DESTINATION MAC + MAC TABLE → DECIDIR")
        self.assertContains(response, "RAPID FIRE · 3 PERGUNTAS")
        self.assertContains(response, "data-rapid-question=", count=3, html=False)
        self.assertContains(response, "show mac address-table")
        self.assertContains(response, "PRIMEIRA VEZ")
        self.assertContains(response, "Esta resposta não recebe pontuação")
        self.assertNotContains(response, "data-switch-terminal")
        self.assertContains(response, "switch-board.js?v=switch-clarity-1")
        self.assertContains(response, "switch-concept.js?v=switch-clarity-1")

    def test_simplified_buttons_keep_the_javascript_contract(self):
        response = self.client.get(reverse("learning:switch_concept"))
        html = response.content.decode()
        script_path = settings.BASE_DIR / "static" / "js" / "switch-concept.js"
        script = script_path.read_text(encoding="utf-8")
        selectors = (
            "data-problem-demo",
            "data-learning-demo",
            "data-learning-question",
            "data-forward-demo",
            "data-forward-question",
            "data-unknown-demo",
            "data-later-learning",
            "data-unknown-question",
            "data-cycle-demo",
            "data-cli-mac-b",
            "data-switch-rapid-fire",
            "data-switch-reference-button",
            "data-checkpoint-start",
        )
        for selector in selectors:
            with self.subTest(selector=selector):
                self.assertIn(selector, html)
                self.assertIn(selector, script)

    def test_sidebar_home_and_frame_integrate_switch(self):
        route = reverse("learning:switch_concept")
        self.assertContains(self.client.get(reverse("learning:home")), route)
        self.assertContains(self.client.get(reverse("learning:frame_concept")), route)
        self.assertContains(self.client.get(route), 'aria-current="page"', html=False)

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

    def test_page_has_exactly_five_areas_and_reuses_simplified_switch_board(self):
        response = self.client.get(reverse("learning:delivery_concept"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "data-delivery-area=", count=5, html=False)
        self.assertContains(response, "data-switch-board", count=5, html=False)
        self.assertContains(response, "switch-board-didactic", count=5, html=False)
        self.assertContains(response, "FF:FF:FF:FF:FF:FF")
        self.assertContains(response, "UNKNOWN UNICAST")
        self.assertContains(response, "O destino escrito no frame revela a intenção da entrega")
        self.assertContains(response, "data-concept-question=", count=3, html=False)
        self.assertContains(response, "Um frame saiu por três portas do switch")
        self.assertContains(response, "Esta explicação não recebe pontuação")
        self.assertContains(response, "Destination DD → Unicast")
        self.assertNotContains(response, "EVIDENCE BOARD")
        self.assertContains(response, "delivery-concept.js?v=delivery-clarity-3")

    def test_simplified_delivery_buttons_keep_the_javascript_contract(self):
        response = self.client.get(reverse("learning:delivery_concept"))
        html = response.content.decode()
        script = (settings.BASE_DIR / "static" / "js" / "delivery-concept.js").read_text(encoding="utf-8")
        selectors = (
            "data-opening-demo", "data-unicast-demo",
            "data-unicast-question", "data-broadcast-demo", "data-broadcast-question",
            "data-unknown-demo", "data-unknown-question", "data-summary",
            "data-arp-demo", "data-delivery-reference-button", "data-delivery-checkpoint-start",
        )
        for selector in selectors:
            with self.subTest(selector=selector):
                self.assertIn(selector, html)
                self.assertIn(selector, script)

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

    def test_page_has_exactly_five_areas_and_reuses_didactic_board(self):
        response = self.client.get(reverse("learning:vlan_concept"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "data-vlan-area=", count=5, html=False)
        self.assertContains(response, "data-switch-board", count=5, html=False)
        self.assertContains(response, "switch-board-didactic", count=5, html=False)
        self.assertContains(response, "switch-board-vlan", count=5, html=False)
        self.assertContains(response, "E se eu não quiser que todos façam parte da mesma rede Ethernet?")
        self.assertContains(response, "MESMO SWITCH FÍSICO")
        self.assertContains(response, "PORTA ACCESS → UMA VLAN")
        self.assertContains(response, "data-concept-question=", count=3, html=False)
        self.assertContains(response, "show vlan brief")
        self.assertContains(response, "OUTRA REPRESENTAÇÃO DA MESMA ESTRUTURA")
        self.assertContains(response, "E se a VLAN 10 e a VLAN 20 precisarem existir nos dois switches?")
        self.assertContains(response, "Esta explicação não recebe pontuação")
        self.assertNotContains(response, "data-vlan-cli-form")
        self.assertNotContains(response, "EVIDENCE BOARD")
        self.assertContains(response, "vlan-concept.js?v=vlan-clarity-2")
        self.assertContains(response, reverse("learning:trunk_concept"))

    def test_simplified_vlan_buttons_keep_the_javascript_contract(self):
        response = self.client.get(reverse("learning:vlan_concept"))
        html = response.content.decode()
        script = (settings.BASE_DIR / "static" / "js" / "vlan-concept.js").read_text(encoding="utf-8")
        selectors = (
            "data-opening-mode", "data-same-context", "data-access-question",
            "data-access-change", "data-frame-demo", "data-broadcast-question",
            "data-summary-case", "data-cli-vlan", "data-vlan-reference-button",
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
        for scenario in ("vlan-didactic-opening", "vlan-didactic-groups", "vlan-didactic-access", "vlan-didactic-frames", "vlan-didactic-summary"):
            self.assertIn(f'"{scenario}"', source)

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

    def test_page_loads_with_exactly_five_areas_and_dual_switch_stages(self):
        response = self.client.get(reverse("learning:trunk_concept"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "data-trunk-area=", count=5, html=False)
        self.assertContains(response, "data-trunk-stage", count=5, html=False)
        self.assertContains(response, "data-switch-board", count=10, html=False)
        self.assertContains(response, "Como continuar a mesma VLAN em outro switch?")
        self.assertContains(response, "TRUNK TRANSPORTA.")
        self.assertContains(response, "802.1Q IDENTIFICA.")

    def test_advanced_stage_capabilities_remain_but_content_uses_clarity_mode(self):
        response = self.client.get(reverse("learning:trunk_concept"))
        self.assertContains(response, "data-trunk-link", count=5, html=False)
        self.assertContains(response, "TRUNK INSPECTOR")
        self.assertContains(response, "Access VLAN")
        self.assertContains(response, "Allowed VLANs")
        self.assertContains(response, "Conceito adicional: Native VLAN")
        self.assertContains(response, "trunk-content-stage", count=5, html=False)

    def test_forwarding_model_supports_allowed_native_broadcast_and_independent_state(self):
        board = (settings.BASE_DIR / "static" / "js" / "switch-board.js").read_text(encoding="utf-8")
        stage = (settings.BASE_DIR / "static" / "js" / "trunk-stage.js").read_text(encoding="utf-8")
        for fragment in ("allowed_vlans", "native_vlan", "receiveTrunkFrame", "portCarriesVlan"):
            self.assertIn(fragment, board)
        for fragment in ("class TrunkLink", "this.sw1", "this.sw2", ".includes(vlan)", "UNTAGGED / NATIVE"):
            self.assertIn(fragment, stage)
        self.assertIn('kind="broadcast"', stage)

    def test_simplified_packet_view_focuses_on_vlan_id(self):
        response = self.client.get(reverse("learning:trunk_concept"))
        self.assertContains(response, "data-simple-packet", html=False)
        self.assertContains(response, "VLAN ID")
        self.assertNotContains(response, "TPID")
        self.assertNotContains(response, "PCP")
        self.assertNotContains(response, "DEI")

    def test_cli_supports_required_observation_commands(self):
        source = (settings.BASE_DIR / "static" / "js" / "trunk-workbench.js").read_text(encoding="utf-8")
        for command in ("show interfaces trunk", "show interfaces gi0/8 switchport", "show vlan brief", "show mac address-table"):
            self.assertIn(command, source.lower())
        response = self.client.get(reverse("learning:trunk_concept"))
        self.assertContains(response, "show interfaces trunk")
        self.assertContains(response, "data-cli-trunk-row", html=False)

    def test_clarity_interactions_keep_the_javascript_contract(self):
        source = (settings.BASE_DIR / "static" / "js" / "trunk-concept.js").read_text(encoding="utf-8")
        for selector in (
            "data-opening-solution", "data-opening-frame", "data-connection-answer",
            "data-dot1q-vlan", "data-dot1q-next", "data-tag-answer",
            "data-across-action", "data-broadcast-answer", "data-allowed-answer",
            "data-summary-phase", "data-cli-trunk-row", "data-rapid-answer",
            "data-reveal-reference", "data-trunk-checkpoint-start",
        ):
            self.assertIn(selector, source)

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

    def test_page_loads_with_exactly_five_areas(self):
        response = self.client.get(reverse("learning:gateway_concept"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "data-gateway-area=", count=5, html=False)
        self.assertContains(response, "O que o host faz quando o destino está em outra rede?")

    def test_next_hop_and_default_gateway_definitions(self):
        response = self.client.get(reverse("learning:gateway_concept"))
        self.assertContains(response, "Next hop")
        self.assertContains(response, "ou próximo salto, é o próximo dispositivo de Camada 3")
        self.assertContains(response, "O Default Gateway é o próximo salto utilizado pelo host")
        self.assertContains(response, "não existe uma rota mais específica aplicável")

    def test_gateway_reachability_and_arp_contrast(self):
        response = self.client.get(reverse("learning:gateway_concept"))
        for value in ("192.168.10.1", "192.168.30.1", "ARP procura 192.168.10.80", "ARP procura 192.168.10.1"):
            self.assertContains(response, value)
        self.assertContains(response, "ARP RESOLVE A ENTREGA LOCAL RELEVANTE")

    def test_l3_stage_and_layered_destinations(self):
        response = self.client.get(reverse("learning:gateway_concept"))
        self.assertContains(response, "data-l3-stage", count=2, html=False)
        self.assertContains(response, "R1 — Default Gateway — 192.168.10.1 — MAC RR")
        self.assertContains(response, "Destination MAC")
        self.assertContains(response, "Destination IP")
        self.assertContains(response, "DESTINO FINAL ≠ PRÓXIMO SALTO")

    def test_packet_inspector_terminal_and_cli_consolidation(self):
        response = self.client.get(reverse("learning:gateway_concept"))
        self.assertContains(response, "PACKET INSPECTOR")
        self.assertContains(response, "ipconfig /all")
        self.assertContains(response, "arp -a")
        self.assertContains(response, "route print · próximo módulo")
        source = (settings.BASE_DIR / "static" / "js" / "gateway-concept.js").read_text(encoding="utf-8")
        self.assertIn('command === "arp -a"', source)
        self.assertIn("Tabela de rotas será estudada no próximo módulo", source)

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

    def test_page_has_exactly_five_areas_and_visualizer(self):
        response = self.client.get(reverse("learning:route_concept"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "data-route-area=", count=5, html=False)
        self.assertContains(response, "ROUTING TABLE VISUALIZER", count=3)
        self.assertContains(response, "Como um host ou roteador decide qual caminho usar?")
        self.assertContains(response, "O DESTINO ESCOLHE A ROTA")
        for node in ("PC-A", "SW1", "R1", "R2", "Internet", "LAN 2"):
            self.assertContains(response, node)

    def test_route_anatomy_direct_next_hop_and_default(self):
        response = self.client.get(reverse("learning:route_concept"))
        for value in ("DESTINATION PREFIX", "NEXT HOP", "INTERFACE", "DIRECTLY CONNECTED / ON-LINK", "0.0.0.0/0"):
            self.assertContains(response, value)
        self.assertContains(response, "DEFAULT GATEWAY É UMA CONSEQUÊNCIA DA ROTA PADRÃO")

    def test_longest_prefix_match_and_multiple_matches(self):
        response = self.client.get(reverse("learning:route_concept"))
        self.assertContains(response, "LONGEST PREFIX MATCH")
        self.assertContains(response, "PRIMEIRO: A ROTA PRECISA COMBINAR")
        for prefix in ("10.0.0.0/8", "10.10.0.0/16", "10.10.20.0/24"):
            self.assertContains(response, prefix)
        source = (settings.BASE_DIR / "static" / "js" / "routing-table-visualizer.js").read_text(encoding="utf-8")
        for fragment in ("function routeMatches", "function selectRoute", "matches.sort", "is-selected", "NO MATCH"):
            self.assertIn(fragment, source)

    def test_l3_to_l2_and_cli_are_delayed(self):
        response = self.client.get(reverse("learning:route_concept"))
        self.assertContains(response, "MAC de R2 naquele enlace")
        self.assertContains(response, "IP FINAL CONTINUA 192.168.20.50")
        for value in ("route print", "Get-NetRoute", "show ip route"):
            self.assertContains(response, value)

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
        self.assertIn("fetch(f.action", source); self.assertIn("memory", source)


class InterVlanConceptTests(TestCase):
    def start(self):return self.client.post(reverse("learning:iv_checkpoint_start"),HTTP_X_REQUESTED_WITH="XMLHttpRequest")
    def test_page_and_exact_five_areas(self):
        r=self.client.get(reverse("learning:inter_vlan_concept"));self.assertEqual(r.status_code,200);self.assertContains(r,"data-iv-area=",count=5,html=False);self.assertContains(r,"Como dispositivos em VLANs diferentes conseguem se comunicar?")
    def test_stage_and_full_path(self):
        r=self.client.get(reverse("learning:inter_vlan_concept"));self.assertContains(r,"data-iv-stage",count=2,html=False)
        for x in ("192.168.10.1 is at R10","Ethernet AA → R10","Destination 192.168.20.30","192.168.20.0/24 → diretamente conectada","192.168.20.30 is at BB","R20 → BB"):self.assertContains(r,x)
        src=(settings.BASE_DIR/"static"/"js"/"inter-vlan-path-stage.js").read_text(encoding="utf-8");self.assertIn("frame.hidden",src);self.assertIn("Route lookup",src)
    def test_vlan_isolation_frames_packet_and_router_on_stick(self):
        r=self.client.get(reverse("learning:inter_vlan_concept"))
        for x in ("ROTEAR ENTRE VLANs NÃO REMOVE","O PACOTE CONTINUA. O FRAME MUDA","FRAME #1 · VLAN 10","FRAME #2 · VLAN 20","Router-on-a-Stick","trunk preserva os contextos","não realiza routing"):self.assertContains(r,x)
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

    def test_page_loads_with_exactly_five_areas(self):
        response = self.client.get(reverse("learning:icmp_concept"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "data-icmp-area=", count=5, html=False)
        self.assertContains(response, "O que realmente descobrimos quando testamos a comunicação?")

    def test_ping_echo_rtt_loss_timeout_and_unreachable(self):
        response = self.client.get(reverse("learning:icmp_concept"))
        for value in ("ICMP Echo Request", "Echo Reply", "RTT · 23 ms", "Loss = 25%", "Request timed out", "Destination host unreachable"):
            self.assertContains(response, value)
        self.assertContains(response, "PERDA É UMA MEDIÇÃO. NÃO É UMA CAUSA")
        self.assertContains(response, "AUSÊNCIA DE RESPOSTA NÃO É UMA CAUSA")

    def test_diagnostic_stage_ttl_and_time_exceeded(self):
        response = self.client.get(reverse("learning:icmp_concept"))
        self.assertContains(response, "data-diag-stage", count=2, html=False)
        self.assertContains(response, "ICMP Time Exceeded")
        self.assertContains(response, "TTL LIMITA ATÉ ONDE O PACOTE PODE IR")
        source = (settings.BASE_DIR / "static" / "js" / "diagnostic-path-stage.js").read_text(encoding="utf-8")
        for fragment in ("runPing", "runTrace", "showMissingHop", "Time Exceeded", "TTL ${ttl}"):
            self.assertIn(fragment, source)

    def test_missing_hop_later_hops_and_packet_inspector(self):
        response = self.client.get(reverse("learning:icmp_concept"))
        self.assertContains(response, "2 *")
        self.assertContains(response, "R3 e o destino responderam")
        self.assertContains(response, "PACKET INSPECTOR")
        self.assertContains(response, "caminho de volta não precisa ser idêntico")

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

    def test_page_loads_with_exactly_five_areas_and_layer_definition(self):
        response = self.client.get(reverse("learning:transport_concept"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "data-transport-area=", count=5, html=False)
        self.assertContains(response, "OSI · CAMADA 4 — TRANSPORTE")
        self.assertContains(response, "comunicação entre aplicações nos hosts finais")

    def test_transport_flow_stage_udp_datagrams_boundaries_loss_and_order(self):
        response = self.client.get(reverse("learning:transport_concept"))
        self.assertContains(response, "data-transport-stage", count=6, html=False)
        for value in ("UDP DATAGRAM A", "O limite entre cada datagrama é preservado", "UDP não reordena datagramas"):
            self.assertContains(response, value)
        source = (settings.BASE_DIR / "static" / "js" / "transport-concept.js").read_text(encoding="utf-8")
        for fragment in ("Datagrama 3 — perdido", "UDP não retransmitiu 3 automaticamente", "A rede entregou 1, 3 e 2"):
            self.assertIn(fragment, source)

    def test_tcp_stream_retransmission_order_and_connection(self):
        response = self.client.get(reverse("learning:transport_concept"))
        for value in ("fluxo de bytes orientado a conexão", "TCP não preserva esses limites", "ESTABELECER CONEXÃO", "TCP NÃO É MÁGICO"):
            self.assertContains(response, value)
        source = (settings.BASE_DIR / "static" / "js" / "transport-concept.js").read_text(encoding="utf-8")
        for fragment in ("C foi retransmitido", "TCP reorganizou conceitualmente o fluxo", "fluxo A, B, C e D"):
            self.assertIn(fragment, source)

    def test_no_udp_always_faster_packet_inspector_and_ports_teaser(self):
        response = self.client.get(reverse("learning:transport_concept"))
        self.assertContains(response, "não significa que toda aplicação usando UDP será automaticamente mais rápida")
        self.assertContains(response, "PACKET INSPECTOR · ESTRUTURA SIMPLIFICADA")
        self.assertContains(response, "Source Port: …", count=2)
        self.assertContains(response, "QUAL ENDPOINT DE APLICAÇÃO?")

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
        self.assertIn("Datagrama 3 — perdido", source)
        self.assertIn("Byte block C — retransmitido", source)
        self.assertContains(response, reverse("learning:icmp_concept"))
        self.assertContains(response, 'aria-current="page"', html=False)
        self.assertContains(self.client.get(reverse("learning:home")), reverse("learning:transport_concept"))
        self.assertContains(self.client.get(reverse("learning:icmp_concept")), reverse("learning:transport_concept"))
        self.assertIn("fetch(form.action", source); self.assertIn("memory", source); self.assertNotIn("location.reload", source)


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
