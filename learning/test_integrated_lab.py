from django.test import TestCase
from django.urls import reverse


class IntegratedLabPageTests(TestCase):
    def test_lab_has_own_page_and_existing_home_remains(self):
        self.assertEqual(self.client.get(reverse("learning:home")).status_code, 200)
        response = self.client.get(reverse("learning:integrated_lab"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-integrated-lab')
        for device_type in ('pc', 'switch', 'router'):
            self.assertContains(response, f'data-lab-catalog="{device_type}"')
            self.assertContains(response, f'data-lab-catalog-profile="{device_type}"')
        self.assertContains(response, 'js/integrated-lab-profiles.js')
        for marker in ('js/integrated-lab-terminal.js', 'js/integrated-lab-cisco.js', 'js/integrated-lab-host.js', 'js/integrated-lab-routeros.js', 'js/integrated-lab-dell.js', 'js/integrated-lab-switch-cli.js', 'data-lab-device-tab="terminal"',
                       'data-lab-device-tab="config"', 'data-lab-terminal-input',
                       'data-lab-terminal-output', 'data-lab-terminal-restart',
                       'data-lab-terminal-feedback', 'role="tablist"', 'role="tabpanel"'):
            self.assertContains(response, marker)
        html = response.content.decode()
        self.assertLess(html.index('js/integrated-lab-profiles.js'), html.index('js/integrated-lab-model.js'))
        self.assertLess(html.index('js/integrated-lab-host.js'), html.index('js/integrated-lab-terminal.js'))
        self.assertLess(html.index('js/integrated-lab-routeros.js'), html.index('js/integrated-lab-terminal.js'))
        self.assertLess(html.index('js/integrated-lab-switch-cli.js'), html.index('js/integrated-lab-cisco.js'))
        self.assertLess(html.index('js/integrated-lab-dell.js'), html.index('js/integrated-lab-terminal.js'))
        self.assertContains(response, 'data-lab-canvas')
        self.assertContains(response, 'data-lab-wires')
        self.assertContains(response, 'data-lab-connections')
        self.assertContains(response, 'data-lab-popover')
        self.assertContains(response, 'data-lab-popover-close')
        self.assertContains(response, 'data-lab-cable-count')
        self.assertContains(response, 'data-lab-router-inspector')
        self.assertContains(response, 'Frame de entrada')
        self.assertContains(response, 'Decisão do roteador')
        self.assertContains(response, 'Frame de saída')
        self.assertContains(response, 'data-lab-interfaces')
        self.assertContains(response, 'data-lab-source')
        self.assertContains(response, 'data-lab-destination')
        self.assertContains(response, 'data-lab-arp-title')
        self.assertContains(response, 'data-lab-event-kind')
        for marker in ('js/integrated-lab-services.js', 'data-lab-dhcp-renew', 'data-lab-dns-query',
                       'data-lab-service-test', 'data-lab-service-target', 'data-lab-service-port'):
            self.assertContains(response, marker)
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
        self.assertContains(response, 'Nos cenários externos')
        self.assertContains(response, 'sondas com TTL crescente')
        for marker in ('data-lab-exercise', 'data-lab-exercise-title',
                       'data-lab-exercise-prompt', 'data-lab-exercise-objective',
                       'data-lab-exercise-meta', 'data-lab-check-solution',
                       'data-lab-new-exercise', 'data-lab-exercise-feedback',
                       'data-lab-command-analysis', 'data-lab-command-log',
                       'js/integrated-lab-exercise-engine.js'):
            self.assertContains(response, marker)

    def test_troubleshooting_list_starts_exercise_in_lab(self):
        response = self.client.get(reverse('learning:troubleshooting'))
        self.assertEqual(response.status_code, 200)
        for family_id, title in [('ipv4', 'IPv4'), ('vlan-access', 'VLAN Access'),
                                 ('trunk-8021q', 'Trunk 802.1Q'), ('routing', 'Routing'),
                                 ('static-routing', 'Rotas estáticas'),
                                 ('external-routing', 'Rede externa'),
                                 ('nat-pat', 'NAT/PAT'),
                                 ('services', 'DHCP, DNS e serviços'),
                                 ('mixed', 'Diagnóstico misto')]:
            self.assertContains(response, title)
            self.assertContains(response, f'name="exercise" value="{family_id}"')
            self.assertContains(response, f'id="{family_id}-difficulty"')
            self.assertContains(response, f'id="{family_id}-mode"')
        for forbidden in ('faultMetadata', 'correctAnswer', 'solution', 'faults'):
            self.assertNotContains(response, forbidden)
        self.assertContains(response, 'value="intermediate"')
        self.assertContains(response, 'value="advanced"')
        self.assertContains(response, 'value="operational"')
        self.assertContains(response, f'action="{reverse("learning:integrated_lab")}"')

    def test_sidebar_has_main_shortcuts(self):
        response = self.client.get(reverse("learning:integrated_lab"))
        nav = response.content.decode().split('aria-label="Navegação principal"', 1)[1].split("</nav>", 1)[0]
        self.assertEqual(nav.count("<a "), 3)
        self.assertIn('>Conteúdos</a>', nav)
        self.assertIn('>Laboratório</a>', nav)
        self.assertIn('>Laboratórios Práticos</a>', nav)
