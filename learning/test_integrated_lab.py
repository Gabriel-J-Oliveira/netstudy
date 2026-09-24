from django.test import TestCase
from django.urls import reverse


class IntegratedLabPageTests(TestCase):
    def test_lab_has_own_page_and_existing_home_remains(self):
        self.assertEqual(self.client.get(reverse("learning:home")).status_code, 200)
        response = self.client.get(reverse("learning:integrated_lab"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-integrated-lab')
        self.assertContains(response, 'data-lab-slot="a"')
        self.assertContains(response, 'data-lab-slot="sw"')
        self.assertContains(response, 'data-lab-slot="b"')
        self.assertContains(response, 'data-lab-connect="a-sw"')
        self.assertContains(response, 'data-lab-connect="sw-b"')
        self.assertContains(response, 'aria-live="polite"')

    def test_sidebar_has_only_two_main_shortcuts(self):
        response = self.client.get(reverse("learning:integrated_lab"))
        nav = response.content.decode().split('aria-label="Navegação principal"', 1)[1].split("</nav>", 1)[0]
        self.assertEqual(nav.count("<a "), 2)
        self.assertIn('>Conteúdos</a>', nav)
        self.assertIn('>Laboratório</a>', nav)
