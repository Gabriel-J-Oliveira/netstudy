from django.test import TestCase
from django.urls import reverse

from .external_labs import LABS, LAB_BY_SLUG


class ExternalLabCatalogTests(TestCase):
    def test_four_unique_complete_definitions(self):
        self.assertEqual(
            [lab["slug"] for lab in LABS],
            ["vlan-trunk", "inter-vlan", "rotas-estaticas", "diagnostico-corporativo"],
        )
        self.assertEqual(len(LAB_BY_SLUG), 4)
        for lab in LABS:
            with self.subTest(lab=lab["slug"]):
                for field in ("title", "subject", "difficulty", "context", "mission", "appliance_note"):
                    self.assertTrue(lab[field])
                for field in ("requirements", "nodes", "links", "addresses", "restrictions", "criteria", "evidence", "hints", "solution"):
                    self.assertGreaterEqual(len(lab[field]), 2)
                node_names = {name for name, _ in lab["nodes"]}
                self.assertEqual(len(node_names), len(lab["nodes"]))
                for source, target, _ in lab["links"]:
                    self.assertTrue(any(source == node or source.startswith(node + " ") for node in node_names))
                    self.assertTrue(any(target == node or target.startswith(node + " ") for node in node_names))

    def test_catalog_and_navigation(self):
        response = self.client.get(reverse("learning:external_labs_catalog"))
        self.assertEqual(response.status_code, 200)
        for lab in LABS:
            self.assertContains(response, lab["title"])
            self.assertContains(response, reverse("learning:external_lab_detail", args=[lab["slug"]]))
            self.assertNotContains(response, lab["solution"][0])
        self.assertContains(response, "verificações são manuais")
        self.assertContains(self.client.get(reverse("learning:home")), "Laboratórios Práticos")

    def test_detail_contents_and_hidden_solution(self):
        for lab in LABS:
            with self.subTest(lab=lab["slug"]):
                response = self.client.get(reverse("learning:external_lab_detail", args=[lab["slug"]]))
                self.assertEqual(response.status_code, 200)
                for field in ("context", "mission", "appliance_note"):
                    self.assertContains(response, lab[field])
                for field in ("criteria", "evidence", "hints", "solution"):
                    for item in lab[field]:
                        self.assertContains(response, item)
                for source, target, medium in lab["links"]:
                    self.assertContains(response, medium)
                for name, address, gateway in lab["addresses"]:
                    self.assertContains(response, address)
                html = response.content.decode()
                self.assertIn('<details class="external-reveal external-solution" data-solution>', html)
                self.assertNotIn('data-solution open', html)
                self.assertIn('data-hint-index="1" hidden', html)
                self.assertEqual(html.count('data-progress-group="criteria"'), 1)
                self.assertEqual(html.count('data-progress-group="evidence"'), 1)
                self.assertEqual(html.count('data-hint-index='), len(lab["hints"]))
                self.assertIn('js/external-labs.js', html)
                self.assertIn('não inspeciona o GNS3', html)
                self.assertIn(reverse("learning:external_labs_catalog"), html)

    def test_unknown_lab_is_404(self):
        response = self.client.get(reverse("learning:external_lab_detail", args=["inexistente"]))
        self.assertEqual(response.status_code, 404)
