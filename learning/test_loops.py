from pathlib import Path
import re

from django.conf import settings
from django.test import TestCase
from django.urls import reverse

from .curriculum import LESSONS
from .loop_content import (
    LOOP_QUESTIONS, LOOP_TERMS, QUESTIONS, SPANNING_TREE_QUESTIONS, SPANNING_TREE_TERMS, TERMS,
)


class NetworkLoopsLessonTests(TestCase):
    def test_lessons_are_consecutive_and_old_loop_url_is_preserved(self):
        keys = [lesson.key for lesson in LESSONS]
        self.assertEqual(keys[keys.index("TRUNK") + 1], "LOOPS")
        self.assertEqual(keys[keys.index("LOOPS") + 1], "SPANNING_TREE")
        self.assertEqual(keys[keys.index("SPANNING_TREE") + 1], "GATEWAY")
        self.assertEqual(reverse("learning:loops_concept"), "/loops-de-rede/")
        self.assertEqual(reverse("learning:spanning_tree_concept"), "/spanning-tree/")

    def test_loop_storm_lesson_keeps_demo_but_has_only_its_checkpoint(self):
        response = self.client.get(reverse("learning:loops_concept"))
        self.assertEqual(response.status_code, 200)
        for selector in ("data-loop-lab", "data-redundant", "data-step", "data-play", "data-pause", "data-speed", "data-checkpoint", "data-topology", "data-event-title", "data-util-bar", "data-queue", "data-queue-bar", "data-gateway-state", "data-normal-manual", "data-storm-manual"):
            self.assertContains(response, selector, html=False)
        self.assertContains(response, "Loops de Rede e Broadcast Storm")
        self.assertContains(response, "Como manter enlaces redundantes sem provocar loops na rede?")
        self.assertContains(response, "pessoas-linha.svg")
        self.assertContains(response, "pessoas-circulo.svg")
        self.assertContains(response, 'id="loops-checkpoint"')
        self.assertContains(response, 'id="loop-questions"')
        self.assertNotContains(response, "data-stp-lab")
        self.assertNotContains(response, "loops-stp-concept.js")
        self.assertEqual(len(response.context["loop_questions"]), 9)
        css = (Path(settings.BASE_DIR) / "static/css/loops-concept.css").read_text(encoding="utf-8")
        self.assertIn("prefers-reduced-motion", css)

    def test_original_loop_questions_and_glossary_are_preserved_without_stp_items(self):
        self.assertEqual(len(LOOP_QUESTIONS), 9)
        self.assertEqual([question["prompt"] for question in LOOP_QUESTIONS], [question["prompt"] for question in QUESTIONS[:9]])
        self.assertEqual([term[0] for term in LOOP_TERMS], ["redundancy", "l2-loop", "flooding", "storm", "flapping", "saturation", "ttl", "convergence"])
        self.assertTrue(all(len(q["options"]) == len(q["feedback"]) == 2 for q in LOOP_QUESTIONS))
        response = self.client.get(reverse("learning:loops_concept"))
        self.assertContains(response, 'aria-live="polite"')
        self.assertContains(response, 'data-context-glossary')
        self.assertIn("prefers-reduced-motion", (Path(settings.BASE_DIR) / "static/css/loops-concept.css").read_text(encoding="utf-8"))

    def test_spanning_tree_lesson_reuses_classic_stp_and_adds_rstp_mstp_protection(self):
        response = self.client.get(reverse("learning:spanning_tree_concept"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "data-stp-lab")
        self.assertContains(response, "loops-stp-model.js")
        self.assertContains(response, "loops-stp-concept.js")
        for selector in ("data-rstp-lab", "data-rstp-fail", "data-rstp-tick", "data-rstp-reset", "data-mstp-lab", "data-mstp-map", "data-mstp-root", "data-mstp-failure", "data-protection-scene", "data-protection-trigger", "data-st-checkpoint"):
            self.assertContains(response, selector, html=False)
        self.assertContains(response, "Proposal")
        self.assertContains(response, "Agreement")
        self.assertContains(response, "CIST")
        self.assertContains(response, "root-inconsistent")
        self.assertContains(response, "loop-inconsistent")
        self.assertContains(response, 'id="spanning-tree-checkpoint"')
        self.assertContains(response, 'id="spanning-tree-questions"')
        self.assertEqual(len(response.context["spanning_tree_questions"]), 18)
        self.assertIn("prefers-reduced-motion", (Path(settings.BASE_DIR) / "static/css/spanning-tree-concept.css").read_text(encoding="utf-8"))

    def test_classic_stp_has_progressive_concepts_before_guided_demo_and_collapsed_controls(self):
        response = self.client.get(reverse("learning:spanning_tree_concept"))
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        overview = html.index('class="st-problem-review"')
        roads = html.index('aria-labelledby="stp-roads-title"')
        bpdu = html.index('aria-labelledby="stp-bpdu-title"')
        root = html.index('aria-labelledby="stp-root-learning-title"')
        costs = html.index('aria-labelledby="stp-cost-title"')
        roles = html.index('aria-labelledby="stp-roles-title"')
        demo = html.index('class="stp-demo-brief"')
        advanced = html.index('<details class="stp-experiment" data-stp-experiment>')
        self.assertLess(overview, roads)
        self.assertLess(roads, bpdu)
        self.assertLess(bpdu, root)
        self.assertLess(root, costs)
        self.assertLess(costs, roles)
        self.assertLess(roles, demo)
        self.assertLess(demo, advanced)
        for fragment in (
            "Um cabo extra cria um caminho de reserva",
            "O mesmo cabo extra pode ser solução ou problema",
            "Inspecionar BPDU simplificada",
            "32768",
            "4 + 4 = 8",
            "Disabled",
            "Uma porta bloqueada não é um cabo desconectado",
            "data-stp-role-choice",
            "data-stp-role-target",
            "data-stp-next",
        ):
            self.assertIn(fragment, html)
        self.assertRegex(html, re.compile(r'data-stp-cost="sw1-sw2"[^>]*>.*?<option selected>4</option>', re.S))
        self.assertRegex(html, re.compile(r'data-stp-cost="sw1-sw3"[^>]*>.*?<option selected>19</option>', re.S))
        self.assertRegex(html, re.compile(r'data-stp-cost="sw2-sw3"[^>]*>.*?<option selected>4</option>', re.S))
        self.assertIn('aria-live="polite"', html)
        self.assertIn('aria-controls="stp-bpdu-payload"', html)
        self.assertIn("prefers-reduced-motion", (Path(settings.BASE_DIR) / "static/css/spanning-tree-concept.css").read_text(encoding="utf-8"))

    def test_stp_questions_move_to_distinct_checkpoint_and_keep_existing_items(self):
        self.assertEqual(len(SPANNING_TREE_QUESTIONS), 18)
        self.assertEqual([q["prompt"] for q in SPANNING_TREE_QUESTIONS[:10]], [q["prompt"] for q in QUESTIONS[9:]])
        self.assertEqual({q["correct"] for q in SPANNING_TREE_QUESTIONS}, {0, 1})
        for question in SPANNING_TREE_QUESTIONS:
            self.assertEqual(len(question["options"]), len(question["feedback"]))
            self.assertTrue(all(question["feedback"]))
        self.assertEqual([term[0] for term in TERMS[:8]], [term[0] for term in LOOP_TERMS])
        self.assertIn("rstp", [term[0] for term in SPANNING_TREE_TERMS])
        self.assertIn("mstp", [term[0] for term in SPANNING_TREE_TERMS])

    def test_rstp_mstp_and_protection_use_manual_deterministic_native_js(self):
        response = self.client.get(reverse("learning:spanning_tree_concept"))
        self.assertContains(response, "spanning-tree-concept.js")
        script = (Path(settings.BASE_DIR) / "static/js/spanning-tree-concept.js").read_text(encoding="utf-8")
        self.assertIn("Math.min(30, time + 1)", script)
        self.assertIn("NetStudyStpModel.calculate", script)
        self.assertIn("data-protection-trigger", script)
        self.assertNotIn("setInterval", script)
        self.assertNotIn("requestAnimationFrame", script)

    def test_mstp_guided_visual_precedes_collapsed_configuration_workbench(self):
        response = self.client.get(reverse("learning:spanning_tree_concept"))
        html = response.content.decode()
        demo_at = html.index('data-mstp-demo')
        advanced_at = html.index('data-mstp-advanced')
        self.assertLess(demo_at, advanced_at)
        for marker in ('data-mstp-stage-marker="1"', 'data-mstp-stage-marker="2"',
                       'data-mstp-stage-marker="3"', 'data-mstp-stage-marker="4"',
                       'data-mstp-prev', 'data-mstp-next', 'data-mstp-play',
                       'data-mstp-pause', 'data-mstp-speed', 'data-mstp-demo-reset'):
            self.assertIn(marker, html)
        for fragment in ('data-mstp-pc', 'data-mstp-port=', 'data-mstp-root-badge=',
                         'PC-A', 'PC-B', 'PC-C', 'PC-D', 'MSTI 1', 'MSTI 2',
                         'Mesma infraestrutura física, diferentes árvores lógicas, redundância sem loops.'):
            self.assertIn(fragment, html)
        self.assertIn('<details class="mstp-advanced" data-mstp-advanced>', html)
        self.assertIn('<summary>Experimente você mesmo</summary>', html)
        css = (Path(settings.BASE_DIR) / "static/css/spanning-tree-concept.css").read_text(encoding="utf-8")
        self.assertIn(".mstp-switches .switch-body", css)
        self.assertIn(".mstp-logical-links>path.msti-blocked", css)
        self.assertIn(".mstp-logical-links>path.msti-disconnected", css)
        self.assertIn("prefers-reduced-motion", css)

    def test_both_lessons_have_distinct_route_and_checkpoint_ids(self):
        loops = self.client.get(reverse("learning:loops_concept")).content.decode()
        spanning = self.client.get(reverse("learning:spanning_tree_concept")).content.decode()
        self.assertIn('id="loops-checkpoint"', loops)
        self.assertIn('id="spanning-tree-checkpoint"', spanning)
        self.assertIn("loops-checkpoint", loops)
        self.assertIn("spanning-tree-checkpoint", spanning)
