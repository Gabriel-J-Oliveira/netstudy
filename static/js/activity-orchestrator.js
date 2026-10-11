/* Activity Orchestrator v1: progresso pedagógico puro, sem DOM ou persistência. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetStudyActivityOrchestrator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CONTRACT_VERSION = 1;
  const MAX_STAGES = 16;
  const KINDS = ["reflection", "evidence", "external"];
  const STATES = ["pending", "active", "satisfied", "stale"];
  const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const clone = value => JSON.parse(JSON.stringify(value));
  const identifier = value => typeof value === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(value);
  const version = value => typeof value === "string" && /^[0-9]+(?:\.[0-9]+){0,2}$/.test(value);
  const shortText = (value, max) => typeof value === "string" && value.length <= max;
  function fail(message) { throw new TypeError(message); }

  function defineActivity(value) {
    if (!isObject(value) || value.contractVersion !== undefined && value.contractVersion !== CONTRACT_VERSION ||
        !identifier(value.activityId) || !version(value.activityVersion) ||
        !Array.isArray(value.stages) || value.stages.length < 1 || value.stages.length > MAX_STAGES)
      fail("Definição de atividade inválida.");
    if (Object.keys(value).some(key => !["contractVersion", "activityId", "activityVersion", "stages"].includes(key)))
      fail("Definição contém campos fora do contrato público.");
    const seen = new Set();
    const stages = value.stages.map((stage, index) => {
      if (!isObject(stage) || !identifier(stage.id) || seen.has(stage.id) ||
          !KINDS.includes(stage.kind) || !Array.isArray(stage.dependsOn) ||
          typeof stage.requiresResponse !== "undefined" && typeof stage.requiresResponse !== "boolean" ||
          Object.keys(stage).some(key => !["id", "kind", "dependsOn", "requiresResponse", "order"].includes(key)))
        fail("Etapa inválida ou duplicada.");
      if (stage.kind !== "external" && stage.requiresResponse) fail("Resposta obrigatória só se aplica à validação externa.");
      const dependencies = new Set();
      for (const dependency of stage.dependsOn) {
        if (!identifier(dependency) || !seen.has(dependency) || dependencies.has(dependency))
          fail("Dependência deve apontar uma única vez para uma etapa anterior.");
        dependencies.add(dependency);
      }
      seen.add(stage.id);
      return Object.freeze({id: stage.id, kind: stage.kind,
        dependsOn: Object.freeze([...dependencies]), requiresResponse: stage.kind === "external" && Boolean(stage.requiresResponse),
        order: index});
    });
    return Object.freeze({contractVersion: CONTRACT_VERSION, activityId: value.activityId,
      activityVersion: value.activityVersion, stages: Object.freeze(stages)});
  }

  function asDefinition(value) {
    if (value?.contractVersion !== undefined && value.contractVersion !== CONTRACT_VERSION)
      fail("Versão do contrato da atividade incompatível.");
    return defineActivity(value);
  }

  function emptyStage(active = false) {
    return {status: active ? "active" : "pending", response: null, evidence: [], assessment: null};
  }

  function createProgress(definition) {
    const activity = asDefinition(definition);
    const stages = {};
    activity.stages.forEach((stage, index) => { stages[stage.id] = emptyStage(index === 0); });
    return {activityId: activity.activityId, activityVersion: activity.activityVersion,
      activeStageId: activity.stages[0].id, status: "in_progress", stages};
  }

  function evidenceReference(value) {
    if (!isObject(value) || !["bench", "simulation", "cli", "text"].includes(value.source) ||
        !shortText(value.referenceId, 120) || !value.referenceId.trim() ||
        !shortText(value.scenarioRevision, 120) || !value.scenarioRevision.trim() ||
        Object.keys(value).some(key => !["source", "referenceId", "scenarioRevision"].includes(key)))
      fail("Referência de evidência inválida.");
    return {source: value.source, referenceId: value.referenceId, scenarioRevision: value.scenarioRevision};
  }

  function assessment(value) {
    if (!isObject(value) || typeof value.accepted !== "boolean" ||
        !identifier(value.code) || !shortText(value.feedback, 500) ||
        Object.keys(value).some(key => !["accepted", "code", "feedback"].includes(key)))
      fail("Resultado de validação externa inválido.");
    return {accepted: value.accepted, code: value.code, feedback: value.feedback};
  }

  function validateProgress(definition, value) {
    const activity = asDefinition(definition);
    if (!isObject(value) || value.activityId !== activity.activityId ||
        value.activityVersion !== activity.activityVersion || !identifier(value.activeStageId) ||
        !["in_progress", "completed"].includes(value.status) || !isObject(value.stages) ||
        Object.keys(value.stages).length !== activity.stages.length ||
        !activity.stages.some(stage => stage.id === value.activeStageId) ||
        Object.keys(value).some(key => !["activityId", "activityVersion", "activeStageId", "status", "stages"].includes(key)))
      fail("Progresso incompatível com a atividade.");
    const result = {activityId: activity.activityId, activityVersion: activity.activityVersion,
      activeStageId: value.activeStageId, status: value.status, stages: {}};
    for (const stage of activity.stages) {
      const row = value.stages[stage.id];
      if (!isObject(row) || !STATES.includes(row.status) ||
          !(row.response === null || shortText(row.response, 2000)) ||
          !Array.isArray(row.evidence) || row.evidence.length > 8 ||
          !(row.assessment === null || isObject(row.assessment)) ||
          Object.keys(row).some(key => !["status", "response", "evidence", "assessment"].includes(key)))
        fail("Progresso de etapa inválido.");
      const evidence = row.evidence.map(evidenceReference);
      const verdict = row.assessment === null ? null : assessment(row.assessment);
      if (stage.kind !== "evidence" && evidence.length || stage.kind === "evidence" && row.response !== null ||
          stage.kind === "reflection" && verdict !== null ||
          row.status === "pending" && (row.response !== null || evidence.length || verdict !== null) ||
          row.status === "active" && stage.kind === "reflection" && row.response !== null ||
          row.status === "active" && verdict?.accepted === true ||
          row.status === "active" && stage.id !== value.activeStageId)
        fail("Estado da etapa incompatível com seu tipo ou foco.");
      if (row.status === "satisfied" && (
        stage.kind === "reflection" && !row.response?.trim() ||
        stage.kind === "evidence" && (!evidence.length || verdict?.accepted !== true) ||
        stage.kind === "external" && (verdict?.accepted !== true || stage.requiresResponse && !row.response?.trim()) ||
        stage.dependsOn.some(id => value.stages[id]?.status !== "satisfied")))
        fail("Etapa não pode estar satisfeita sem seus requisitos e dependências.");
      result.stages[stage.id] = {status: row.status, response: row.response, evidence, assessment: verdict};
    }
    if (value.status === "completed" && activity.stages.some(stage => result.stages[stage.id].status !== "satisfied"))
      fail("Atividade concluída com etapas não satisfeitas.");
    return result;
  }

  function dependentIds(activity, stageId) {
    const affected = new Set([stageId]);
    for (const stage of activity.stages) {
      if (stage.dependsOn.some(id => affected.has(id))) affected.add(stage.id);
    }
    return affected;
  }

  function invalidateDependents(activity, progress, stageId, includeSelf) {
    const affected = dependentIds(activity, stageId);
    if (!includeSelf) affected.delete(stageId);
    for (const id of affected) {
      const row = progress.stages[id];
      row.status = row.status === "satisfied" || row.status === "stale" ||
        row.response !== null || row.evidence.length || row.assessment !== null ? "stale" : "pending";
    }
    if (progress.status === "completed" && affected.size) progress.status = "in_progress";
    return [...affected];
  }

  function apply(definition, progress, action) {
    const activity = asDefinition(definition);
    const next = validateProgress(activity, progress);
    if (!isObject(action) || typeof action.type !== "string") fail("Ação pedagógica inválida.");
    const index = activity.stages.findIndex(stage => stage.id === next.activeStageId);
    if (action.type === "review") {
      const target = activity.stages.find(stage => stage.id === action.stageId);
      if (!target || target.order >= index) fail("Só é possível revisar uma etapa anterior.");
      if (next.stages[next.activeStageId].status === "active") {
        const current = next.stages[next.activeStageId];
        current.status = current.response !== null || current.evidence.length || current.assessment !== null ? "stale" : "pending";
      }
      next.activeStageId = target.id;
      if (next.stages[target.id].status === "pending") next.stages[target.id].status = "active";
      return {progress: next, outcome: "reviewed", invalidated: []};
    }
    if (action.type === "advance") {
      if (next.stages[next.activeStageId].status !== "satisfied" || index === activity.stages.length - 1)
        fail("A etapa atual precisa estar satisfeita antes de avançar.");
      const target = activity.stages[index + 1];
      if (target.dependsOn.some(id => next.stages[id].status !== "satisfied"))
        fail("Dependências da próxima etapa não satisfeitas.");
      next.activeStageId = target.id;
      if (next.stages[target.id].status === "pending") next.stages[target.id].status = "active";
      return {progress: next, outcome: "advanced", invalidated: []};
    }
    if (action.type === "invalidate") {
      const target = activity.stages.find(stage => stage.id === action.stageId);
      if (!target) fail("Etapa inexistente para invalidação.");
      const invalidated = invalidateDependents(activity, next, target.id, true);
      const earliest = activity.stages.find(stage => invalidated.includes(stage.id));
      if (earliest.order < index) {
        if (next.stages[next.activeStageId].status === "active") {
          const current = next.stages[next.activeStageId];
          current.status = current.response !== null || current.evidence.length || current.assessment !== null ? "stale" : "pending";
        }
        next.activeStageId = earliest.id;
      }
      if (next.stages[next.activeStageId].status === "pending") next.stages[next.activeStageId].status = "active";
      return {progress: next, outcome: "invalidated", invalidated};
    }
    if (action.type === "complete") {
      if (activity.stages.some(stage => next.stages[stage.id].status !== "satisfied"))
        fail("A atividade não pode ser concluída antes de todas as etapas.");
      next.status = "completed";
      return {progress: next, outcome: "completed", invalidated: []};
    }
    if (action.type !== "submit") fail("Tipo de ação pedagógica desconhecido.");
    const stage = activity.stages[index];
    if (next.status === "completed" || action.stageId !== stage.id ||
        stage.dependsOn.some(id => next.stages[id].status !== "satisfied"))
      fail("Envio fora da etapa ativa ou com dependências pendentes.");
    const row = next.stages[stage.id];
    const previous = JSON.stringify(row);
    if (stage.kind === "reflection") {
      if (!shortText(action.response, 2000) || !action.response.trim() ||
          own(action, "assessment") || own(action, "evidence")) fail("Reflexão requer apenas uma resposta não vazia.");
      row.response = action.response;
      row.evidence = [];
      row.assessment = null;
      row.status = "satisfied"; // Hipótese registrada, não corrigida pelo núcleo.
    } else {
      row.assessment = assessment(action.assessment); // Veredito recebido; o núcleo não avalia a bancada.
      if (stage.kind === "evidence") {
        if (!Array.isArray(action.evidence) || !action.evidence.length || action.evidence.length > 8 ||
            own(action, "response")) fail("Evidências requerem referências e veredito externo.");
        row.evidence = action.evidence.map(evidenceReference);
        row.response = null;
      } else {
        if (!(action.response === null || action.response === undefined || shortText(action.response, 2000)) ||
            stage.requiresResponse && !action.response?.trim() || own(action, "evidence"))
          fail("Resposta da etapa externa inválida.");
        row.response = action.response ?? null;
        row.evidence = [];
      }
      row.status = row.assessment.accepted ? "satisfied" : (row.status === "stale" ? "stale" : "active");
    }
    const changed = JSON.stringify(row) !== previous;
    const invalidated = changed ? invalidateDependents(activity, next, stage.id, false) : [];
    if (next.status === "completed" && changed) next.status = "in_progress";
    return {progress: next, outcome: row.status === "satisfied" ? "satisfied" : "needs-revision", invalidated};
  }

  return Object.freeze({CONTRACT_VERSION, defineActivity, createProgress, validateProgress, apply});
});
