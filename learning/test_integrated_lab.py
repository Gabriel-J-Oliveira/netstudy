from django.test import TestCase
from django.urls import reverse


class IntegratedLabPageTests(TestCase):
    def test_lab_has_own_page_and_existing_home_remains(self):
        self.assertEqual(self.client.get(reverse("learning:home")).status_code, 200)
        response = self.client.get(reverse("learning:integrated_lab"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-integrated-lab')
        self.assertContains(response, 'data-lab-catalog="pc-a"')
        self.assertContains(response, 'data-lab-catalog="sw1"')
        self.assertContains(response, 'data-lab-catalog="sw2"')
        self.assertContains(response, 'data-lab-catalog="pc-b"')
        self.assertContains(response, 'data-lab-catalog="pc-c"')
        self.assertContains(response, 'data-lab-catalog="pc-d"')
        self.assertContains(response, 'data-lab-catalog="r1"')
        self.assertContains(response, 'data-lab-canvas')
        self.assertContains(response, 'data-lab-wires')
        self.assertContains(response, 'data-lab-connections')
        self.assertContains(response, 'data-lab-config="pc-a"')
        self.assertContains(response, 'data-lab-config="sw1"')
        self.assertContains(response, 'data-lab-config="sw2"')
        self.assertContains(response, 'data-lab-config="pc-b"')
        self.assertContains(response, 'data-lab-config="pc-c"')
        self.assertContains(response, 'data-lab-config="pc-d"')
        self.assertContains(response, 'data-lab-config="r1"')
        self.assertContains(response, 'data-lab-input="a-gateway"')
        self.assertContains(response, 'data-lab-input="b-gateway"')
        self.assertContains(response, 'data-lab-input="r1-eth0-ip"')
        self.assertContains(response, 'data-lab-input="r1-eth1-mac"')
        self.assertContains(response, 'data-lab-router-routes')
        self.assertContains(response, 'data-lab-router-arp')
        self.assertContains(response, 'data-lab-router-inspector')
        self.assertContains(response, 'Frame de entrada')
        self.assertContains(response, 'Decisão do roteador')
        self.assertContains(response, 'Frame de saída')
        self.assertContains(response, 'data-lab-input="d-mac"')
        self.assertContains(response, 'data-lab-input="sw1-port4"')
        self.assertContains(response, 'data-lab-input="sw2-port4"')
        self.assertContains(response, 'data-lab-allowed="sw1-10"')
        self.assertContains(response, 'data-lab-allowed="sw2-20"')
        self.assertContains(response, 'data-lab-interfaces')
        self.assertContains(response, 'data-lab-source')
        self.assertContains(response, 'data-lab-destination')
        self.assertContains(response, 'data-lab-arp-title')
        self.assertContains(response, 'data-lab-move')
        self.assertContains(response, 'data-lab-event-kind')
        self.assertContains(response, 'data-lab-prev')
        self.assertContains(response, 'data-lab-next')
        self.assertContains(response, 'aria-live="polite"')
        for marker in (
            'data-lab-scenario-name', 'data-lab-scenario-list', 'data-lab-scenario-feedback',
            'data-lab-save', 'data-lab-save-as', 'data-lab-load', 'data-lab-delete',
            'data-lab-import-button', 'data-lab-import-file', 'data-lab-export',
            'js/integrated-lab-storage.js',
        ):
            self.assertContains(response, marker)
        for marker in ('Cenários do NetStudy', 'data-lab-preset-list',
                       'data-lab-preset-feedback', 'js/integrated-lab-presets.js'):
            self.assertContains(response, marker)
        for marker in ('data-lab-exercise', 'data-lab-exercise-title',
                       'data-lab-exercise-prompt', 'data-lab-exercise-objective',
                       'data-lab-exercise-meta', 'data-lab-check-solution',
                       'data-lab-new-exercise', 'data-lab-exercise-feedback',
                       'js/integrated-lab-exercise-engine.js'):
            self.assertContains(response, marker)

    def test_troubleshooting_list_starts_exercise_in_lab(self):
        response = self.client.get(reverse('learning:troubleshooting'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Diagnóstico de conectividade IPv4')
        self.assertContains(response, 'name="exercise" value="ipv4-connectivity"')
        self.assertContains(response, 'value="intermediate"')
        self.assertContains(response, 'value="advanced"')
        self.assertContains(response, f'action="{reverse("learning:integrated_lab")}"')

    def test_sidebar_has_only_two_main_shortcuts(self):
        response = self.client.get(reverse("learning:integrated_lab"))
        nav = response.content.decode().split('aria-label="Navegação principal"', 1)[1].split("</nav>", 1)[0]
        self.assertEqual(nav.count("<a "), 2)
        self.assertIn('>Conteúdos</a>', nav)
        self.assertIn('>Laboratório</a>', nav)
