from django.test import TestCase
from django.urls import reverse

from .osi_content import ACTIVITIES


class OsiLessonTests(TestCase):
    def setUp(self):
        self.lesson = reverse("learning:osi_concept")

    def post(self, action, answer=None):
        return self.client.post(
            reverse("learning:osi_checkpoint", args=[action]),
            {"conclusao": answer} if answer is not None else {},
            follow=True,
        )

    def test_models_path_evidence_and_context_links(self):
        page = self.client.get(self.lesson)
        self.assertContains(page, "data-osi-layer ", count=11)
        self.assertContains(page, "data-osi-step=", count=9)
        self.assertContains(page, "Por IP funciona, por nome falha")
        self.assertContains(page, f'data-trail-next href="{reverse("learning:encapsulation_concept")}"')
        self.assertContains(page, reverse("learning:transport_concept"))

    def test_active_lesson_is_highlighted_in_continuous_sidebar(self):
        page = self.client.get(reverse("learning:vlan_concept")).content.decode()
        navigation = page.split('class="lesson-trail lesson-trail-sidebar"', 1)[1].split("</ol>", 1)[0]
        self.assertNotIn("<details", navigation)
        self.assertEqual(navigation.count('aria-current="page"'), 1)
        self.assertIn(f'href="{reverse("learning:vlan_concept")}" aria-current="page"', navigation)

    def test_checkpoint_feedback_hint_and_session(self):
        self.assertContains(self.post("iniciar"), "1 / 10")
        self.assertContains(self.post("responder", "enlace"), "A situação destaca a transmissão dos bits.")
        self.assertContains(self.post("responder", "rede"), "A função de rede usa endereços IP")
        self.assertContains(self.post("pista"), "Observe o que acontece no meio")
        self.assertContains(self.client.get(self.lesson), "Revise sua resposta")
        self.assertContains(self.post("avancar"), "1 / 10")
        self.assertNotContains(self.post("rever"), "Revise sua resposta")

    def test_checkpoint_completion_and_restart(self):
        self.post("iniciar")
        for item in ACTIVITIES:
            self.assertContains(self.post("responder", item["correct_map"]["conclusao"]), "Correto")
            result = self.post("avancar")
        self.assertContains(result, "Checkpoint concluído")
        self.assertContains(result, "10 sem apoio")
        self.assertContains(self.post("refazer"), "1 / 10")
        self.assertEqual(self.client.get(reverse("learning:osi_checkpoint", args=["iniciar"])).status_code, 405)
