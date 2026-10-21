"""Contrato e integração HTTP da primeira atividade da Lista 1."""

from django.test import TestCase
from django.urls import reverse

from . import l2_practice as l2


def correct_answer(case_id):
    expected = l2.expected_result(case_id)
    return {key: list(value) if isinstance(value, tuple) else value
            for key, value in expected.items()}


class L202RulesTests(TestCase):
    def test_known_destination_has_one_egress_and_one_receiver(self):
        result = l2.expected_result("known")
        self.assertEqual(result["classification"], "unicast")
        self.assertEqual(result["lookup"], "known")
        self.assertEqual(result["action"], "single")
        self.assertEqual(result["egress"], ("gi0/4",))
        self.assertEqual(result["received"], ("pc-b",))
        self.assertEqual(result["accepted"], ("pc-b",))

    def test_unknown_unicast_floods_without_changing_classification(self):
        result = l2.expected_result("unknown")
        self.assertEqual((result["classification"], result["lookup"], result["action"]),
                         ("unicast", "unknown", "replicate"))
        self.assertEqual(set(result["egress"]), {"gi0/2", "gi0/4", "gi0/6"})
        self.assertEqual(set(result["received"]), {"pc-b", "pc-c", "pc-d"})
        self.assertEqual(result["accepted"], ("pc-d",))

    def test_broadcast_reaches_and_is_accepted_by_all_hosts(self):
        result = l2.expected_result("broadcast")
        self.assertEqual((result["classification"], result["lookup"], result["action"]),
                         ("broadcast", "not_needed", "replicate"))
        self.assertEqual(set(result["egress"]), set(l2.PORT_HOSTS))
        self.assertEqual(set(result["received"]), set(l2.ALL_HOSTS))
        self.assertEqual(set(result["accepted"]), set(l2.ALL_HOSTS))

    def test_feedback_distinguishes_flooding_ingress_and_acceptance(self):
        answer = correct_answer("unknown")
        answer["classification"] = "broadcast"
        answer["egress"].append("gi0/1")
        answer["accepted"] = list(l2.ALL_HOSTS)
        outcome = l2.evaluate("unknown", answer)
        self.assertFalse(outcome["correct"])
        self.assertEqual({item["code"] for item in outcome["feedback"]},
                         {"unknown_is_unicast", "ingress_port", "flood_not_broadcast"})

    def test_invalid_states_rejected_and_results_repeatable(self):
        for case in l2.SCENARIOS:
            answer = correct_answer(case.id)
            self.assertTrue(l2.evaluate(case.id, answer)["correct"])
            self.assertEqual(l2.evaluate(case.id, answer), l2.evaluate(case.id, answer))
        bad = correct_answer("known")
        bad["egress"] = ["gi0/4", "gi0/4"]
        with self.assertRaises(ValueError):
            l2.evaluate("known", bad)
        bad["egress"] = [{}]
        with self.assertRaises(ValueError):
            l2.evaluate("known", bad)
        with self.assertRaises(ValueError):
            l2.evaluate(["known"], correct_answer("known"))
        with self.assertRaises(ValueError):
            l2.validate_progress({"schema_version": 1, "verified": [{}]})


class L202WebTests(TestCase):
    def setUp(self):
        self.url = reverse("learning:l2_02_practice")

    def submit(self, case_id, answer, **overrides):
        fields = {**answer, "scenario_id": case_id, **overrides}
        fields["switch_action"] = fields.pop("action")
        return self.client.post(self.url, fields, HTTP_X_REQUESTED_WITH="XMLHttpRequest")

    def test_practice_index_keeps_existing_families_and_related_links(self):
        page = self.client.get(reverse("learning:practice"))
        self.assertEqual(page.status_code, 200)
        self.assertContains(page, "Lista 1 — Comunicação na Camada 2")
        self.assertContains(page, self.url)
        for family in ("ipv4", "vlan-access", "trunk-8021q", "routing", "static-routing",
                       "external-routing", "nat-pat", "services", "mixed"):
            self.assertContains(page, f'data-practice-family="{family}"')
        self.assertContains(page, 'id="vlan-access-exercise-title"')
        self.assertContains(page, 'id="trunk-8021q-exercise-title"')

    def test_activity_has_three_scenarios_and_accessible_controls(self):
        page = self.client.get(self.url)
        self.assertEqual(page.status_code, 200)
        for case in l2.SCENARIOS:
            self.assertContains(page, f'data-l2-case="{case.id}"')
        self.assertContains(page, 'aria-live="polite"')
        self.assertContains(page, 'name="accepted"')
        self.assertNotContains(page, "✓ Verificado")
        self.assertNotContains(page, l2.SCENARIOS[0].success_feedback)

    def test_wrong_then_correct_and_completion_persist_across_requests(self):
        wrong = correct_answer("unknown")
        wrong["classification"] = "broadcast"
        response = self.submit("unknown", wrong)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["result"]["correct"])
        self.assertEqual(response.json()["completed_count"], 0)
        self.assertIn("unknown_is_unicast", [item["code"] for item in response.json()["result"]["feedback"]])
        for number, case in enumerate(l2.SCENARIOS, 1):
            response = self.submit(case.id, correct_answer(case.id))
            self.assertEqual(response.json()["completed_count"], number)
        self.assertTrue(response.json()["completed"])
        self.assertEqual(self.client.get(self.url).context["completed_count"], 3)
        self.assertEqual(self.client.session["netstudy_l2_02_v1"]["verified"], ["known", "unknown", "broadcast"])

    def test_invalid_answer_does_not_mark_progress(self):
        answer = correct_answer("known")
        answer["egress"] = ["gi0/99"]
        response = self.submit("known", answer)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["verified"], [])
        self.assertNotIn("netstudy_l2_02_v1", self.client.session)

    def test_reset_is_isolated_from_other_session_state(self):
        session = self.client.session
        session["netstudy_attempts_v1"] = {"keep": "unchanged"}
        session.save()
        self.submit("known", correct_answer("known"))
        response = self.client.post(self.url, {"action": "reset"}, HTTP_X_REQUESTED_WITH="XMLHttpRequest")
        self.assertEqual(response.json()["verified"], [])
        self.assertEqual(self.client.session["netstudy_attempts_v1"], {"keep": "unchanged"})

    def test_incompatible_progress_is_not_overwritten_silently(self):
        session = self.client.session
        session["netstudy_l2_02_v1"] = {"schema_version": 99, "verified": ["known"]}
        session.save()
        self.assertContains(self.client.get(self.url), "incompatível")
        self.assertEqual(self.submit("known", correct_answer("known")).status_code, 409)
        self.assertEqual(self.client.session["netstudy_l2_02_v1"]["schema_version"], 99)

    def test_existing_checkpoint_and_free_lab_still_load(self):
        for name in ("learning:switch_concept", "learning:delivery_concept", "learning:mac_concept", "learning:integrated_lab"):
            self.assertEqual(self.client.get(reverse(name)).status_code, 200)
