from pathlib import Path
import re
from urllib.parse import urlsplit

from django.conf import settings
from django.test import TestCase
from django.urls import reverse

from .curriculum import LESSONS


class JourneyNavigationTests(TestCase):
    def test_home_and_learning_catalog_link_all_twenty_lessons(self):
        self.assertEqual(
            [lesson.key for lesson in LESSONS],
            ["OSI", "ENCAPSULATION", "MAC", "FRAME", "SWITCH", "DELIVERY", "IPV4", "ARP", "VLAN", "TRUNK",
             "LOOPS", "SPANNING_TREE", "GATEWAY", "ROUTES", "INTERVLAN", "ICMP", "TRANSPORT", "PORTS", "DHCP", "DNS"],
        )
        prior = set()
        for lesson in LESSONS:
            self.assertNotIn(lesson.key, prior)
            self.assertTrue(set(lesson.prerequisites) <= prior)
            prior.add(lesson.key)

        for route in ("home", "learn"):
            response = self.client.get(reverse("learning:" + route))
            self.assertEqual(response.status_code, 200)
            self.assert_trail_order(response, "lesson-trail")
        home = self.client.get(reverse("learning:home"))
        for area in ("Aprender", "Praticar", "Laboratório", "Aprofundamento GNS3"):
            self.assertContains(home, area)

    def test_lessons_have_existing_checkpoint_targets_and_continuity(self):
        for index, lesson in enumerate(LESSONS):
            with self.subTest(lesson=lesson.key):
                response = self.client.get(reverse("learning:" + lesson.route))
                self.assertContains(response, f'id="{lesson.checkpoint}"')
                self.assertContains(response, f'#{lesson.checkpoint}')
                self.assertContains(response, f'exercise={lesson.exercise}')
                self.assertContains(response, f"Aula {index + 1:02} de 20")
                self.assert_trail_order(response, "lesson-trail lesson-trail-sidebar")
                for offset, direction in [(-1, "previous"), (1, "next")]:
                    links = re.findall(rf'data-trail-{direction} href="([^"]+)"', response.content.decode())
                    neighbor = index + offset
                    expected = [reverse("learning:" + LESSONS[neighbor].route)] if 0 <= neighbor < len(LESSONS) else []
                    self.assertEqual(links, expected)

    def assert_trail_order(self, response, class_name):
        html = response.content.decode().split(f'<ol class="{class_name}"', 1)[1].split("</ol>", 1)[0]
        self.assertEqual(re.findall(r'class="trail-link" href="([^"]+)"', html),
                         [reverse("learning:" + lesson.route) for lesson in LESSONS])
        self.assertEqual(re.findall(r'class="trail-number">(\d+)<', html),
                         [f"{number:02}" for number in range(1, 21)])

    def test_recommendation_reads_existing_checkpoint_session(self):
        session = self.client.session
        session["osi_checkpoint"] = {"complete": True}
        session["encapsulation_checkpoint"] = {"complete": True}
        session["mac_checkpoint"] = {"complete": False, "current": 1, "answers": {}}
        session.save()
        page = self.client.get(reverse("learning:learn"))
        self.assertContains(page, "03 · MAC Address")
        self.assertContains(page, "Checkpoint concluído", count=4)
        self.assertContains(page, "Checkpoint em andamento", count=2)
        self.assertEqual(self.client.session["osi_checkpoint"], {"complete": True})

    def test_practice_catalog_matches_actual_engine_families(self):
        source = (Path(settings.BASE_DIR) / "static/js/integrated-lab-exercise-engine.js").read_text(encoding="utf-8")
        families = re.findall(r'"([^"]+)"', re.search(r'FAMILY_IDS = Object.freeze\(\[(.*?)\]\)', source).group(1))
        response = self.client.get(reverse("learning:practice"))
        self.assertEqual(len(families), 9)
        for family in families:
            self.assertContains(response, f'name="exercise" value="{family}"', count=1)
        for route in ("begin", "rapid_fire_intro", "mac_activities", "external_labs_catalog"):
            self.assertContains(response, reverse("learning:" + route))

    def test_attempt_continuity_is_available_without_changing_existing_routes(self):
        practice = self.client.get(reverse("learning:practice"))
        self.assertContains(practice, 'data-practice-attempts')
        self.assertContains(practice, 'data-practice-status', count=9)
        self.assertContains(practice, 'data-practice-continue', count=9)
        self.assertContains(practice, 'data-practice-new', count=9)
        self.assertContains(practice, 'data-practice-restart', count=9)
        self.assertContains(practice, 'data-practice-discard', count=9)
        self.assertContains(practice, 'js/practice-attempts.js')
        lab = self.client.get(reverse("learning:integrated_lab"))
        self.assertContains(lab, 'data-lab-attempt-state')
        self.assertContains(lab, 'js/integrated-lab-attempts.js')
        self.assertContains(lab, 'data-lab-return-practice')

    def test_context_keeps_seed_mode_and_difficulty_without_external_return_url(self):
        response = self.client.get(reverse("learning:integrated_lab"), {
            "exercise": "nat-pat", "seed": "42", "mode": "operational",
            "difficulty": "advanced", "next": "https://evil.example/",
        })
        self.assertContains(response, 'exercise=nat-pat&amp;difficulty=advanced&amp;mode=operational&amp;seed=42')
        self.assertNotContains(response, "evil.example")
        self.assertContains(response, 'aria-current="page">Praticar</a>')
        self.assertContains(self.client.get(reverse("learning:integrated_lab")), 'aria-current="page">Laboratório</a>')

    def test_gns3_has_return_to_practice_and_existing_detail_routes(self):
        from .external_labs import LABS
        response = self.client.get(reverse("learning:external_labs_catalog"))
        self.assertContains(response, reverse("learning:practice"))
        for lab in LABS:
            self.assertContains(response, reverse("learning:external_lab_detail", args=[lab["slug"]]))
