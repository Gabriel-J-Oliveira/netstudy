/* Attempt Schema v1: continuidade local, independente de cenários pessoais e do DOM. */
(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports ? require("./integrated-lab-model.js") : root.NetStudyLabModel,
    typeof module === "object" && module.exports ? require("./integrated-lab-exercise-engine.js") : root.NetStudyLabExerciseEngine,
    root
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetStudyLabAttempts = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (model, engine, root) {
  "use strict";
  const KEY = "netstudy:attempts:v1";
  const SCHEMA_VERSION = 1;
  const GENERATOR_VERSION = "1";
  const LIMITS = Object.freeze({attempts: 100, checks: 40, commands: 100, evidence: 40, answers: 40, terminalHistory: 50, terminalOutput: 40});
  const copy = value => JSON.parse(JSON.stringify(value));
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const text = (value, max = 512) => typeof value === "string" && value.length <= max;
  const iso = value => typeof value === "string" && !Number.isNaN(Date.parse(value));
  function scenario(value) {
    const imported = model.importScenario(value);
    return model.exportScenario(imported.state, {
      ...(imported.name ? {name: imported.name} : {}),
      ...(imported.sourceId ? {sourceId: imported.sourceId, destinationId: imported.destinationId} : {})
    });
  }
  function emptyProgress() { return {stepId: null, answers: {}, evidence: [], commands: [], terminals: {}, lastRun: null}; }
  function command(entry, devices) {
    if (!object(entry) || !devices[entry.deviceId] || !text(entry.profile, 40) ||
        !text(entry.command, 512) || !entry.command.trim() || !text(entry.errorCode, 80) ||
        typeof entry.changedState !== "boolean") throw new TypeError("Comando salvo inválido.");
    return {deviceId: entry.deviceId, profile: entry.profile, command: entry.command,
      errorCode: entry.errorCode, changedState: entry.changedState};
  }
  function terminal(session, id, devices, interfaces) {
    const device = devices[id];
    if (!device || !object(session) || session.deviceId !== id || session.type !== device.type ||
        session.profileId !== (device.profile || "generic") || !text(session.mode, 24) || !text(session.prompt, 200) ||
        !["exec", "privileged", "config", "config-if", "closed"].includes(session.mode) ||
        !object(session.context) && session.context !== null ||
        (session.context && (Object.keys(session.context).some(key => !["deviceId", "interfaceId"].includes(key)) ||
          session.context.deviceId !== id ||
          session.context.interfaceId && interfaces[session.context.interfaceId]?.deviceId !== id)) ||
        !Array.isArray(session.history) || session.history.length > LIMITS.terminalHistory ||
        session.history.some(row => !text(row, 512)) ||
        !Number.isInteger(session.historyIndex) || session.historyIndex < 0 || session.historyIndex > session.history.length ||
        !text(session.draft, 512) ||
        !Array.isArray(session.output) || session.output.length > LIMITS.terminalOutput ||
        session.output.some(row => !object(row) || !["command", "output", "error"].includes(row.kind) || !text(row.text, 2000)) ||
        typeof session.closed !== "boolean" || (session.closed && session.mode !== "closed"))
      throw new TypeError("Sessão de terminal salva inválida.");
    return copy(session);
  }
  function progress(value, bench, commandDevices = bench.devices) {
    if (!object(value) || !(value.stepId === null || text(value.stepId, 80)) ||
        !object(value.answers) || Object.keys(value.answers).length > LIMITS.answers ||
        !Array.isArray(value.evidence) || value.evidence.length > LIMITS.evidence ||
        !Array.isArray(value.commands) || value.commands.length > LIMITS.commands ||
        !object(value.terminals) || !(value.lastRun === null || object(value.lastRun)))
      throw new TypeError("Progresso da tentativa inválido.");
    for (const [key, answer] of Object.entries(value.answers)) {
      if (!text(key, 80) || !["string", "number", "boolean"].includes(typeof answer) ||
          typeof answer === "string" && !text(answer, 2000)) throw new TypeError("Resposta salva inválida.");
    }
    if (value.evidence.some(row => !object(row) || !text(row.type, 80) || !text(row.summary, 500)))
      throw new TypeError("Evidência salva inválida.");
    const commands = value.commands.map(row => command(row, commandDevices));
    const terminals = {};
    for (const [id, session] of Object.entries(value.terminals))
      terminals[id] = terminal(session, id, bench.devices, bench.interfaces);
    const run = value.lastRun;
    if (run && (!["communication", "verification"].includes(run.kind) ||
        !Number.isInteger(run.index) || run.index < 0 || run.index > 1000 ||
        !bench.devices[run.sourceId] || !bench.devices[run.destinationId]))
      throw new TypeError("Etapa anterior inválida.");
    return {stepId: value.stepId, answers: copy(value.answers), evidence: copy(value.evidence), commands,
      terminals, lastRun: run ? copy(run) : null};
  }
  function validate(value) {
    if (!object(value) || value.schemaVersion !== SCHEMA_VERSION || !text(value.attemptId, 100) ||
        !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value.attemptId) ||
        !text(value.exerciseId, 60) || !text(value.generatorVersion, 30) || !text(value.seed, 40) || !value.seed ||
        !["intermediate", "advanced"].includes(value.difficulty) || !["bench", "operational"].includes(value.mode) ||
        !["not_started", "in_progress", "completed"].includes(value.status) ||
        !iso(value.startedAt) || !iso(value.updatedAt) ||
        !(value.completedAt === null || iso(value.completedAt)) ||
        (value.status === "completed") !== (value.completedAt !== null) ||
        !Array.isArray(value.checks) || value.checks.length > LIMITS.checks)
      throw new TypeError("Attempt Schema inválido.");
    const initialScenario = scenario(value.initialScenario);
    const currentScenario = scenario(value.currentScenario);
    const bench = model.importScenario(currentScenario).state;
    const initialBench = model.importScenario(initialScenario).state;
    const checks = value.checks.map(row => {
      if (!object(row) || !iso(row.at) || typeof row.complete !== "boolean" ||
          !text(row.category, 100) || !text(row.feedback, 2000)) throw new TypeError("Histórico de verificação inválido.");
      return {at: row.at, complete: row.complete, category: row.category, feedback: row.feedback};
    });
    return {...value, initialScenario, currentScenario, progress: progress(value.progress, bench, initialBench.devices), checks};
  }
  function create(storage, options = {}) {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function" ||
        typeof storage.removeItem !== "function") throw new TypeError("Armazenamento local indisponível.");
    const now = options.now || (() => new Date().toISOString());
    const idFactory = options.idFactory || (() => {
      if (typeof root.crypto?.randomUUID !== "function") throw new Error("Gerador seguro de IDs indisponível.");
      return root.crypto.randomUUID();
    });
    function read() {
      let raw;
      try { raw = storage.getItem(KEY); }
      catch (error) { throw new Error(`Não foi possível ler tentativas locais: ${error.message}`); }
      if (raw === null) return [];
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch { throw new TypeError("Tentativas locais corrompidas: JSON inválido. Os dados foram preservados."); }
      if (!Array.isArray(parsed) || parsed.length > LIMITS.attempts)
        throw new TypeError("Tentativas locais corrompidas: lista inválida. Os dados foram preservados.");
      const ids = new Set();
      return parsed.map(item => {
        const valid = validate(item);
        if (ids.has(valid.attemptId)) throw new TypeError("Tentativas locais com IDs duplicados.");
        ids.add(valid.attemptId);
        return valid;
      });
    }
    function write(items) {
      try { storage.setItem(KEY, JSON.stringify(items)); }
      catch (error) { throw new Error(`Tentativa não salva; armazenamento indisponível ou cheio: ${error.message}`); }
    }
    function find(items, id) {
      const index = items.findIndex(item => item.attemptId === id);
      if (index < 0) throw new TypeError("Tentativa não encontrada.");
      return index;
    }
    function get(id) { const items = read(); return copy(items[find(items, id)]); }
    function list() { return read().map(item => ({attemptId: item.attemptId, exerciseId: item.exerciseId,
      seed: item.seed, difficulty: item.difficulty, mode: item.mode, status: item.status,
      updatedAt: item.updatedAt, generatorVersion: item.generatorVersion,
      compatible: item.generatorVersion === GENERATOR_VERSION})).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
    function replace(id, transform) {
      const items = read(), index = find(items, id);
      const next = validate(transform(copy(items[index])));
      if (next.attemptId !== id) throw new TypeError("ID da tentativa não pode mudar.");
      items[index] = next; write(items); return copy(next);
    }
    function createAttempt(exerciseId, seed, difficulty = "intermediate", mode = "bench") {
      const instance = engine.generateExercise(exerciseId, seed, {difficulty, mode});
      const items = read();
      if (items.length >= LIMITS.attempts) throw new Error("Limite de tentativas locais atingido; descarte uma tentativa antes de criar outra.");
      const attemptId = idFactory();
      if (items.some(item => item.attemptId === attemptId)) throw new Error("ID de tentativa repetido; tente novamente.");
      const stamp = now();
      const initialScenario = scenario(instance.scenario);
      const attempt = validate({schemaVersion: SCHEMA_VERSION, attemptId, exerciseId, generatorVersion: GENERATOR_VERSION,
        seed: String(instance.seed), difficulty: instance.difficulty, mode: instance.mode || "bench",
        status: "not_started", initialScenario, currentScenario: initialScenario,
        startedAt: stamp, updatedAt: stamp, completedAt: null, progress: emptyProgress(), checks: []});
      items.push(attempt); write(items); return copy(attempt);
    }
    function resume(id) {
      const attempt = get(id);
      if (attempt.generatorVersion !== GENERATOR_VERSION)
        throw new Error(`Gerador ${attempt.generatorVersion} incompatível com a versão ${GENERATOR_VERSION}; tentativa preservada, sem regeneração.`);
      const instance = engine.generateExercise(attempt.exerciseId, attempt.seed, {difficulty: attempt.difficulty, mode: attempt.mode});
      if (JSON.stringify(scenario(instance.scenario)) !== JSON.stringify(attempt.initialScenario))
        throw new Error("A definição gerada mudou para esta seed. Tentativa preservada, sem substituição automática.");
      return {attempt, instance, bench: model.importScenario(attempt.currentScenario).state};
    }
    function begin(id) {
      const item = get(id);
      if (item.status !== "not_started") return item;
      return replace(id, current => ({...current, status: "in_progress", updatedAt: now()}));
    }
    function update(id, currentScenario, changes = {}) {
      return replace(id, item => {
        const nextScenario = scenario(currentScenario);
        const changed = JSON.stringify(nextScenario) !== JSON.stringify(item.currentScenario);
        const nextProgress = changes.progress ? progress(changes.progress, model.importScenario(nextScenario).state,
          model.importScenario(item.initialScenario).state.devices) : item.progress;
        return {...item, currentScenario: nextScenario, progress: nextProgress, updatedAt: now(),
          status: changed && item.status === "completed" ? "in_progress" : item.status === "not_started" ? "in_progress" : item.status,
          completedAt: changed ? null : item.completedAt};
      });
    }
    function verify(id) {
      const {attempt, instance, bench} = resume(id);
      const verdict = engine.validateExercise(instance, bench);
      const stamp = now();
      const saved = replace(id, item => ({...item, status: verdict.complete ? "completed" : "in_progress",
        completedAt: verdict.complete ? stamp : null, updatedAt: stamp,
        checks: [...item.checks, {at: stamp, complete: verdict.complete, category: verdict.category || "", feedback: verdict.feedback}].slice(-LIMITS.checks)}));
      return {verdict, attempt: saved};
    }
    function recordCommand(id, entry) {
      return replace(id, item => {
        const bench = model.importScenario(item.currentScenario).state;
        return {...item, updatedAt: now(), progress: {...item.progress,
          commands: [...item.progress.commands, command(entry, bench.devices)].slice(-LIMITS.commands)}};
      });
    }
    function restart(id) {
      return replace(id, item => ({...item, currentScenario: copy(item.initialScenario), status: "in_progress",
        startedAt: now(), updatedAt: now(), completedAt: null, progress: emptyProgress(), checks: []}));
    }
    function discard(id) { const items = read(); const index = find(items, id); items.splice(index, 1); write(items); }
    function newVariation(id, seed) { const old = get(id); if (String(seed) === old.seed) throw new TypeError("A nova seed deve ser diferente.");
      return createAttempt(old.exerciseId, seed, old.difficulty, old.mode); }
    return Object.freeze({list, get, createAttempt, resume, begin, update, verify, recordCommand, restart, discard, newVariation});
  }
  return Object.freeze({KEY, SCHEMA_VERSION, GENERATOR_VERSION, LIMITS, create});
});
