from pathlib import Path
import re
from urllib.parse import urlsplit

from django.conf import settings
from django.test import TestCase
from django.urls import reverse

from .templatetags.journey import LESSONS


class JourneyNavigationTests(TestCase):
    def test_home_and_learning_catalog_preserve_all_sixteen_lessons(self):
        for route in ("home", "learn"):
            response = self.client.get(reverse("learning:" + route))
            self.assertEqual(response.status_code, 200)
            for _, name, _, _, _ in LESSONS:
                self.assertContains(response, reverse("learning:" + ("start" if name == "concept" else name)))
        home = self.client.get(reverse("learning:home"))
        for area in ("Aprender", "Praticar", "Laboratório", "Aprofundamento GNS3"):
            self.assertContains(home, area)

    def test_lessons_have_existing_checkpoint_targets_and_continuity(self):
        for index, (_, name, _, family, anchor) in enumerate(LESSONS):
            response = self.client.get(reverse("learning:" + name))
            self.assertContains(response, f'id="{anchor}"')
            self.assertContains(response, f'#{anchor}')
            self.assertContains(response, f'exercise={family}')
            for neighbor in (index - 1, index + 1):
                if 0 <= neighbor < len(LESSONS):
                    self.assertContains(response, reverse("learning:" + LESSONS[neighbor][1]))

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
