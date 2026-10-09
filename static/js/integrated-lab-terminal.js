/* Terminal Engine v1: sessões e comandos, sem DOM nem cópias do estado de rede. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./integrated-lab-profiles.js") : root.NetStudyLabProfiles,
    typeof module === "object" && module.exports ? require("./integrated-lab-cisco.js") : root.NetStudyLabCisco,
    typeof module === "object" && module.exports ? require("./integrated-lab-host.js") : root.NetStudyLabHost,
    typeof module === "object" && module.exports ? require("./integrated-lab-routeros.js") : root.NetStudyLabRouterOS,
    typeof module === "object" && module.exports ? require("./integrated-lab-dell.js") : root.NetStudyLabDell);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetStudyLabTerminal = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (profiles, cisco, host, routeros, dell) {
  "use strict";
  const LIMITS = Object.freeze({command: 512, history: 100, output: 200});
  const copy = s => ({...s, context: s.context ? {...s.context} : null, history: [...s.history], output: s.output.map(row => ({...row}))});
  const error = (code, message) => ({code, message});
  const commandName = name => /^[a-z][a-z0-9-]*$/i.test(name) || /^\/[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*$/i.test(name);
  const prompt = (device, mode, context) => {
    if (device.profile === "dell-os10") return `${device.name}${mode === "config" ? "(config)#" : mode === "config-if" ? `(conf-if-${profiles.interfaceName(device, context.interfaceId).replace(/^ethernet/, "eth")})#` : "#"}`;
    if (device.profile !== "cisco-ios") return profiles.prompt(device);
    return `${device.name}${mode === "privileged" ? "#" : mode === "config" ? "(config)#" : mode === "config-if" ? `(config-if)#` : ">"}`;
  };
  function parse(command) {
    if (typeof command !== "string") return {error: error("invalid-input", "O comando precisa ser texto.")};
    if (command.length > LIMITS.command || /[\x00-\x1f\x7f]/.test(command.replaceAll("\t", "")))
      return {error: error("invalid-input", "Digite um único comando de até 512 caracteres.")};
    const tokens = []; let word = "", quote = null, started = false;
    for (let i = 0; i < command.length; i++) {
      const c = command[i];
      if (c === "\\" && i + 1 < command.length && /[\\"'\s]/.test(command[i + 1])) { word += command[++i]; started = true; }
      else if (quote) { if (c === quote) quote = null; else word += c; }
      else if (c === '"' || c === "'") { quote = c; started = true; }
      else if (/\s/.test(c)) { if (started) tokens.push(word); word = ""; started = false; }
      else { word += c; started = true; }
    }
    if (quote) return {error: error("unclosed-quote", "Feche as aspas do comando.")};
    if (started) tokens.push(word);
    if (!tokens.length) return {name: "", args: [], empty: true};
    if (tokens[0] !== "?" && !commandName(tokens[0])) return {error: error("invalid-command", "Nome de comando inválido.")};
    return {name: tokens[0].toLowerCase(), args: tokens.slice(1), empty: false};
  }
  function createSession(device, selected = device?.profile ?? "generic") {
    if (!device?.id || !device.type || !device.name) throw new TypeError("Equipamento inválido.");
    if (typeof selected !== "string" && (typeof selected?.id !== "string")) throw new TypeError("Profile inválido.");
    const profile = profiles.get(device.type, typeof selected === "string" ? selected : selected?.id);
    if (profile.id !== (device.profile ?? "generic")) throw new TypeError("Profile da sessão não corresponde ao equipamento.");
    return {deviceId: device.id, type: device.type, profileId: profile.id, mode: "exec", context: {deviceId: device.id},
      prompt: profiles.prompt(device), history: [], historyIndex: 0, draft: "", output: [], closed: false};
  }
  function syncSession(session, labState) {
    const next = copy(session), device = labState?.devices?.[session.deviceId];
    if (!device || device.type !== session.type) return {session: next, error: error("device-unavailable", "O equipamento não está mais nesta bancada.")};
    const profile = profiles.get(device.type, device.profile ?? "generic");
    if (next.profileId !== profile.id && !next.closed) { next.mode = "exec"; next.context = {deviceId: device.id}; }
    next.profileId = profile.id; next.prompt = next.closed ? "" : prompt(device, next.mode, next.context);
    return {session: next, device, profile};
  }
  function createRegistry() {
    const entries = new Map();
    const registry = {
      register(type, profileId, command) {
        if (type !== "*") profiles.get(type, profileId);
        else if (profileId !== "*") throw new TypeError("Registry global usa profile *.");
        if (!command || (command.name !== "?" && !commandName(command.name)) || typeof command.execute !== "function" ||
            typeof command.description !== "string" || !Array.isArray(command.modes) || !command.modes.length ||
            command.modes.some(mode => !/^[a-z][a-z0-9-]*$/.test(mode))) throw new TypeError("Definição de comando inválida.");
        const key = `${type}:${profileId}:${command.name}`;
        if (entries.has(key)) throw new TypeError("Comando já registrado neste profile.");
        entries.set(key, Object.freeze({...command, modes: Object.freeze([...command.modes])}));
        return registry;
      },
      resolve(type, profileId, name) { return entries.get(`${type}:${profileId}:${name}`) || entries.get(`*:*:${name}`); },
      available(type, profileId, mode) {
        const names = new Set([...entries.values()].map(c => c.name));
        return [...names].map(name => registry.resolve(type, profileId, name)).filter(c => c?.modes.includes(mode)).sort((a, b) => a.name.localeCompare(b.name));
      }
    };
    registry.register("*", "*", {name: "help", description: "Listar os comandos disponíveis neste modo.", modes: ["exec", "privileged"], execute: ({registry: r, session, device, profile}) => ({output:
      [`${device.name} · ${profile.label} · modo ${session.mode}`, ...r.available(device.type, profile.id, session.mode).map(c => `${c.name} — ${c.description}`)]})});
    registry.register("*", "*", {name: "clear", description: "Limpar a saída sem apagar o histórico.", modes: ["exec", "privileged"], execute: () => ({clear: true, output: []})});
    registry.register("*", "*", {name: "exit", description: "Encerrar esta sessão de terminal.", modes: ["exec", "privileged"], execute: () => ({closed: true, output: ["Sessão encerrada. A configuração da bancada foi mantida."]})});
    cisco.install(registry);
    host.install(registry);
    routeros.install(registry);
    dell.install(registry);
    return Object.freeze(registry);
  }
  const defaultRegistry = createRegistry();
  function execute(session, command, labState, registry = defaultRegistry) {
    const synced = syncSession(session, labState), next = synced.session;
    function fail(problem) {
      next.output.push({kind: "error", text: problem.message}); next.output = next.output.slice(-LIMITS.output);
      return {session: next, output: [problem.message], error: problem};
    }
    if (synced.error) return fail(synced.error);
    if (next.closed) return fail(error("session-closed", "A sessão está encerrada. Inicie uma nova sessão."));
    const parsed = parse(command);
    if (parsed.empty) return {session: next, output: [], error: null};
    if (typeof command === "string" && command.trim()) {
      next.history.push(command.trim().slice(0, LIMITS.command)); next.history = next.history.slice(-LIMITS.history);
      next.historyIndex = next.history.length; next.draft = "";
      next.output.push({kind: "command", text: `${next.prompt} ${command.trim().slice(0, LIMITS.command)}`});
    }
    if (parsed.error) return next.profileId === "cisco-ios" ? fail(error(parsed.error.code, `% Invalid input. ${parsed.error.message} Use ? para ajuda.`)) : fail(parsed.error);
    const handler = registry.resolve(next.type, next.profileId, parsed.name);
    if (!handler) return next.profileId === "cisco-ios" ? fail(error("unknown-command", "% Comando não reconhecido. Use ? para listar os comandos válidos neste modo.")) : fail(error("unknown-command", "Comando não disponível. Use help para consultar os comandos deste terminal."));
    if (!handler.modes.includes(next.mode)) return fail(error("wrong-mode", next.profileId === "cisco-ios" ? "% Comando indisponível no modo atual. Use ? para consultar as opções." : "Este comando não está disponível no modo atual."));
    if (parsed.args.length && !handler.acceptsArguments) return fail(error("unexpected-arguments", next.profileId === "cisco-ios" ? "% Argumentos inesperados. Consulte ? para a sintaxe disponível." : "Este comando não aceita argumentos."));
    try {
      // O handler recebe a bancada fornecida nesta chamada, nunca um snapshot da sessão.
      const result = handler.execute({session: copy(next), args: parsed.args, labState, device: synced.device, profile: synced.profile, registry}) || {};
      if (typeof result.then === "function") throw new TypeError("Comandos v1 precisam executar de forma síncrona.");
      const output = result.output || [];
      if (!Array.isArray(output) || output.some(line => typeof line !== "string")) throw new TypeError("Output inválido.");
      if (result.error) return fail(result.error);
      if (result.mode && !/^[a-z][a-z0-9-]*$/.test(result.mode)) throw new TypeError("Modo inválido.");
      if (result.context && (Object.keys(result.context).some(k => !["deviceId", "interfaceId"].includes(k)) || result.context.deviceId !== next.deviceId ||
          (result.context.interfaceId && labState.interfaces?.[result.context.interfaceId]?.deviceId !== next.deviceId))) throw new TypeError("Contexto inválido.");
      if (result.mode) next.mode = result.mode;
      if (result.context) next.context = {...result.context};
      if (result.bench && (!result.bench.devices || !result.bench.interfaces || !Array.isArray(result.bench.connections))) throw new TypeError("Bancada resultante inválida.");
      if (result.labResult && (!Array.isArray(result.labResult.events) || typeof result.labResult.status !== "string")) throw new TypeError("Resultado de laboratório inválido.");
      if (result.mode || result.context || result.bench) next.prompt = prompt(result.bench?.devices?.[next.deviceId] || synced.device, next.mode, next.context);
      if (result.clear) next.output = [];
      if (result.closed) { next.closed = true; next.mode = "closed"; next.context = null; next.prompt = ""; }
      next.output.push(...output.map(text => ({kind: "output", text}))); next.output = next.output.slice(-LIMITS.output);
      return {session: next, output, error: null, cleared: Boolean(result.clear), closed: next.closed,
        ...(result.bench ? {bench: result.bench} : {}), ...(result.labResult ? {labResult: result.labResult} : {})};
    } catch (_) { return fail(error("execution-error", "% Falha ao aplicar o comando. Confira o modo, a sintaxe e a configuração atual da bancada.")); }
  }
  function navigateHistory(session, direction, currentInput = "") {
    if (!["up", "down"].includes(direction)) throw new TypeError("Direção de histórico inválida.");
    const next = copy(session);
    if (next.historyIndex === next.history.length) next.draft = currentInput;
    next.historyIndex = Math.max(0, Math.min(next.history.length, next.historyIndex + (direction === "up" ? -1 : 1)));
    return {session: next, command: next.historyIndex === next.history.length ? next.draft : next.history[next.historyIndex]};
  }
  return Object.freeze({VERSION: 1, LIMITS, parse, createSession, syncSession, execute, navigateHistory, createRegistry});
});
