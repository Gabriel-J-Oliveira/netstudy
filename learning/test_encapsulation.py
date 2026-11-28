import json
import re

from django.test import TestCase
from django.urls import reverse
from django.contrib.staticfiles import finders

from .encapsulation_content import ACTIVITIES, ANALOGY, RAPID_FIRE


class EncapsulationLessonTests(TestCase):
    def setUp(self):
        self.url = reverse("learning:encapsulation_concept")

    def post(self, action, answer=None):
        fields = {"conclusao": answer} if answer is not None else {}
        response = self.client.post(reverse("learning:encapsulation_checkpoint", args=[action]), fields,
                                    headers={"X-Requested-With": "XMLHttpRequest"})
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_models_and_comparison_are_rendered(self):
        response = self.client.get(self.url)
        self.assertContains(response, "Aula 02 de 20")
        self.assertContains(response, 'data-enc-layer=', count=5)
        self.assertContains(response, 'data-path-point=', count=5)
        self.assertContains(response, 'data-frame-field=', count=8)
        self.assertContains(response, 'data-checkpoint-panel')
        self.assertContains(response, "Atualizado após reduzir o TTL")
        self.assertContains(response, "Calculado para o frame B")
        comparison = response.content.decode().split('data-enc-comparison', 1)[1].split("</table>", 1)[0]
        self.assertEqual(comparison.count("192.0.2.10 → 198.51.100.20"), 2)
        self.assertContains(response, 'data-trail-previous href="/osi-tcp-ip/"')
        self.assertContains(response, 'data-trail-next href="/mac/"')
        data = re.search(r'<script id="enc-walkthrough-data" type="application/json">(.*?)</script>',
                         response.content.decode()).group(1)
        modes = json.loads(data)
        self.assertEqual([step[2] for step in modes["send"]], [0, 1, 2, 3, 4])
        self.assertEqual([step[2] for step in modes["receive"]], [4, 3, 2, 1, 0])

    def test_feedback_hint_persistence_and_review_are_session_scoped(self):
        self.assertIn("1 / 10", self.post("iniciar")["html"])
        wrong = self.post("responder", "pacote ipv4")
        self.assertFalse(wrong["correct"])
        self.assertIn("ainda falta o cabeçalho IPv4", wrong["feedback"])
        self.assertIn("Procure a unidade da camada", self.post("pista")["html"])
        self.assertContains(self.client.get(self.url), "Revise sua resposta")
        self.assertIn("1 / 10", self.post("avancar")["html"])
        self.assertNotIn("Revise sua resposta", self.post("rever")["html"])
        self.assertNotIn("osi_checkpoint", self.client.session)

    def test_visual_sequence_associations_rapid_fire_and_glossary(self):
        response = self.client.get(self.url)
        html = response.content.decode()
        labels = ["Enxergar", "Associar", "Compreender", "Experimentar", "Consolidar"]
        markers = [html.index(f"Área {index:02} · {label}") for index, label in enumerate(labels, 1)]
        self.assertEqual(markers, sorted(markers))
        self.assertContains(response, "Na rede:", count=5)
        self.assertContains(response, "data-enc-match=", count=4)
        self.assertContains(response, "data-rapid-question", count=len(RAPID_FIRE))
        self.assertContains(response, "data-context-glossary", count=14)
        self.assertContains(response, "/static/js/context-glossary.js")
        for image, _, _, _, alt in ANALOGY:
            relative = f"images/concepts/encapsulamento/{image}.svg"
            self.assertIsNotNone(finders.find(relative))
            self.assertContains(response, relative)
            self.assertContains(response, alt)
        for _, options in RAPID_FIRE:
            self.assertEqual(sum(correct for _, correct, _ in options), 1)

    def test_all_ten_situations_can_finish_and_restart(self):
        self.post("iniciar")
        for entry in ACTIVITIES:
            self.assertTrue(self.post("responder", entry["correct_map"]["conclusao"])["correct"])
            result = self.post("avancar")
        self.assertTrue(result["complete"])
        self.assertIn("10 sem apoio", result["html"])
        self.assertIn("1 / 10", self.post("refazer")["html"])
