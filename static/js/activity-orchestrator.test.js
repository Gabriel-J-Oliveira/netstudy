"use strict";
const assert = require("node:assert/strict");
const orchestrator = require("./activity-orchestrator.js");

const pilot = orchestrator.defineActivity({activityId: "ipv4-investigation", activityVersion: "1.0",
  stages: [
    {id: "hypothesis", kind: "reflection", dependsOn: []},
    {id: "evidence", kind: "evidence", dependsOn: ["hypothesis"]},
    {id: "intervention", kind: "external", dependsOn: ["evidence"]},
    {id: "interpretation", kind: "external", dependsOn: ["intervention"], requiresResponse: true}
  ]});
const accepted = {accepted: true, code: "accepted", feedback: "Evidência confirmada."};
const rejected = {accepted: false, code: "insufficient", feedback: "Ainda falta evidência."};
const reference = {source: "simulation", referenceId: "run-1:event-4", scenarioRevision: "revision-1"};
const act = (progress, action) => orchestrator.apply(pilot, progress, action).progress;

assert.equal(pilot.contractVersion, 1);
assert.equal(pilot.activityId, "ipv4-investigation");
assert.equal(pilot.activityVersion, "1.0");
assert.equal(pilot.stages[3].requiresResponse, true);
assert.throws(() => orchestrator.defineActivity({activityId: "Bad id", activityVersion: "1", stages: []}), TypeError);
assert.throws(() => orchestrator.defineActivity({activityId: "ok", activityVersion: "x", stages: [{id: "a", kind: "reflection", dependsOn: []}]}), TypeError);
assert.throws(() => orchestrator.defineActivity({activityId: "ok", activityVersion: "1", stages: [
  {id: "same", kind: "reflection", dependsOn: []}, {id: "same", kind: "evidence", dependsOn: []}]}), TypeError);
assert.throws(() => orchestrator.defineActivity({activityId: "ok", activityVersion: "1", stages: [
  {id: "a", kind: "reflection", dependsOn: ["missing"]}]}), TypeError);
assert.throws(() => orchestrator.defineActivity({activityId: "ok", activityVersion: "1", stages: [
  {id: "a", kind: "reflection", dependsOn: ["b"]}, {id: "b", kind: "reflection", dependsOn: ["a"]}]}), TypeError);
assert.throws(() => orchestrator.defineActivity({activityId: "ok", activityVersion: "1", solution: "hidden",
  stages: [{id: "a", kind: "reflection", dependsOn: []}]}), /fora do contrato/);

const initial = orchestrator.createProgress(pilot);
assert.equal(initial.activeStageId, "hypothesis");
assert.equal(initial.stages.hypothesis.status, "active");
assert.equal(initial.stages.evidence.status, "pending");
assert.throws(() => act(initial, {type: "advance"}), /satisfeita/);
assert.throws(() => act(initial, {type: "complete"}), /concluída/);
assert.throws(() => act(initial, {type: "submit", stageId: "missing", response: "x"}), /etapa ativa/);
assert.throws(() => act(initial, {type: "submit", stageId: "hypothesis", response: " "}), TypeError);
assert.throws(() => act(initial, {type: "event-navigation", eventIndex: 4}), /desconhecido/);

const hypothesis = act(initial, {type: "submit", stageId: "hypothesis", response: "Minha hipótese inicial."});
assert.equal(hypothesis.stages.hypothesis.status, "satisfied"); // Não há correção da hipótese.
assert.equal(initial.stages.hypothesis.status, "active"); // Sem mutação da entrada.
const atEvidence = act(hypothesis, {type: "advance"});
assert.equal(atEvidence.activeStageId, "evidence");
assert.throws(() => act(atEvidence, {type: "submit", stageId: "evidence", evidence: [reference]}), TypeError);
const failedEvidence = act(atEvidence, {type: "submit", stageId: "evidence", evidence: [reference], assessment: rejected});
assert.equal(failedEvidence.stages.evidence.status, "active");
assert.throws(() => act(failedEvidence, {type: "advance"}), /satisfeita/);
assert.deepEqual(orchestrator.validateProgress(pilot, failedEvidence), failedEvidence);

const confirmed = act(failedEvidence, {type: "submit", stageId: "evidence", evidence: [reference], assessment: accepted});
const intervention = act(confirmed, {type: "advance"});
assert.equal(intervention.activeStageId, "intervention");
const technical = act(intervention, {type: "submit", stageId: "intervention", assessment: accepted});
assert.equal(technical.stages.intervention.status, "satisfied");
assert.equal(technical.status, "in_progress"); // Sucesso técnico não conclui a atividade.
assert.throws(() => act(technical, {type: "complete"}), /concluída/);
const interpretation = act(technical, {type: "advance"});
assert.throws(() => act(interpretation, {type: "submit", stageId: "interpretation", assessment: accepted}), TypeError);
const interpreted = act(interpretation, {type: "submit", stageId: "interpretation",
  response: "A intervenção explica as evidências.", assessment: accepted});
assert.equal(interpreted.status, "in_progress");
const completed = act(interpreted, {type: "complete"});
assert.equal(completed.status, "completed");
assert.throws(() => act(completed, {type: "submit", stageId: "interpretation", response: "outro", assessment: accepted}), TypeError);

const reviewed = act(interpreted, {type: "review", stageId: "evidence"});
assert.equal(reviewed.activeStageId, "evidence");
assert.equal(reviewed.stages.intervention.status, "satisfied");
assert.throws(() => act(reviewed, {type: "review", stageId: "interpretation"}), /anterior/);
const revisedEvidence = orchestrator.apply(pilot, reviewed, {type: "submit", stageId: "evidence",
  evidence: [{...reference, referenceId: "run-2:event-7"}], assessment: accepted});
assert.equal(revisedEvidence.progress.stages.hypothesis.status, "satisfied");
assert.equal(revisedEvidence.progress.stages.intervention.status, "stale");
assert.equal(revisedEvidence.progress.stages.interpretation.status, "stale");
assert.deepEqual(revisedEvidence.invalidated, ["intervention", "interpretation"]);
assert.throws(() => act(revisedEvidence.progress, {type: "complete"}), /concluída/);
assert.equal(interpretation.stages.intervention.status, "satisfied"); // Entrada preservada.

const changedBench = orchestrator.apply(pilot, completed, {type: "invalidate", stageId: "evidence"});
assert.equal(changedBench.progress.status, "in_progress");
assert.equal(changedBench.progress.activeStageId, "evidence");
assert.equal(changedBench.progress.stages.evidence.status, "stale");
assert.equal(changedBench.progress.stages.intervention.status, "stale");
assert.equal(changedBench.progress.stages.interpretation.status, "stale");
assert.equal(changedBench.progress.stages.hypothesis.status, "satisfied");
assert.throws(() => act(changedBench.progress, {type: "advance"}), /satisfeita/);

const independent = orchestrator.defineActivity({activityId: "parallel-facts", activityVersion: "2",
  stages: [{id: "first", kind: "reflection", dependsOn: []},
    {id: "second", kind: "reflection", dependsOn: []},
    {id: "third", kind: "external", dependsOn: ["first"]}]});
let independentProgress = orchestrator.createProgress(independent);
independentProgress = orchestrator.apply(independent, independentProgress, {type: "submit", stageId: "first", response: "A"}).progress;
independentProgress = orchestrator.apply(independent, independentProgress, {type: "advance"}).progress;
independentProgress = orchestrator.apply(independent, independentProgress, {type: "submit", stageId: "second", response: "B"}).progress;
independentProgress = orchestrator.apply(independent, independentProgress, {type: "advance"}).progress;
independentProgress = orchestrator.apply(independent, independentProgress, {type: "submit", stageId: "third", assessment: accepted}).progress;
const partial = orchestrator.apply(independent, independentProgress, {type: "invalidate", stageId: "first"}).progress;
assert.equal(partial.stages.first.status, "stale");
assert.equal(partial.stages.second.status, "satisfied");
assert.equal(partial.stages.third.status, "stale");
assert.throws(() => orchestrator.validateProgress(pilot, independentProgress), /incompatível/);
assert.throws(() => orchestrator.validateProgress({...pilot, activityVersion: "2"}, completed), /incompatível/);
assert.throws(() => orchestrator.validateProgress(pilot, {...completed, activeStageId: "absent"}), /incompatível/);
assert.throws(() => orchestrator.validateProgress(pilot, {...completed, stages: {...completed.stages, extra: {}}}), /incompatível/);

const action = {type: "submit", stageId: "hypothesis", response: "Previsão determinística."};
assert.deepEqual(orchestrator.apply(pilot, initial, action), orchestrator.apply(pilot, initial, action));
assert.deepEqual(action, {type: "submit", stageId: "hypothesis", response: "Previsão determinística."});
assert.equal(Object.hasOwn(initial, "operationalCursor"), false);
assert.equal(Object.hasOwn(completed, "operationalCursor"), false);
assert.equal(Object.hasOwn(completed, "currentScenario"), false);
assert.equal(Object.hasOwn(completed, "solution"), false);
console.log("Activity Orchestrator v1: contrato e transições OK");
