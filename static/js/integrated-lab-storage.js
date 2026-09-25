/* Cenários pessoais: persistência local de configurações, sem estado da simulação ou DOM. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports
    ? require("./integrated-lab-model.js") : root.NetStudyLabModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NetStudyLabStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (model) {
  "use strict";
  const KEY = "netstudy:integrated-lab:scenarios:v1";
  const identity = name => name.trim().toLocaleLowerCase();

  function create(storage) {
    if (!storage || !["getItem", "setItem"].every(method => typeof storage[method] === "function"))
      throw new TypeError("Armazenamento local indisponível.");

    function canonical(scenario) {
      const restored = model.importScenario(scenario);
      return model.exportScenario(restored.state, {
        ...(restored.name === null ? {} : {name: restored.name}),
        ...(restored.sourceId === null ? {} : {sourceId: restored.sourceId, destinationId: restored.destinationId})
      });
    }
    function read() {
      const raw = storage.getItem(KEY);
      if (raw === null) return [];
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch { throw new TypeError("Cenários locais corrompidos: JSON inválido."); }
      if (!Array.isArray(parsed)) throw new TypeError("Cenários locais corrompidos: lista inválida.");
      const names = new Set();
      return parsed.map(item => {
        let scenario;
        try { scenario = canonical(item); }
        catch (error) { throw new TypeError(`Cenários locais inválidos: ${error.message}`); }
        if (!scenario.name || names.has(identity(scenario.name)))
          throw new TypeError("Cenários locais corrompidos: nomes ausentes ou repetidos.");
        names.add(identity(scenario.name));
        return scenario;
      });
    }
    function write(items) { storage.setItem(KEY, JSON.stringify(items)); }
    function find(items, name) { return items.findIndex(item => identity(item.name) === identity(name)); }
    function list() { return read().map(item => item.name); }
    function load(name) {
      if (typeof name !== "string" || !name.trim()) throw new TypeError("Selecione um cenário.");
      const items = read(), index = find(items, name);
      if (index < 0) throw new TypeError("Cenário não encontrado.");
      return model.importScenario(items[index]);
    }
    function save(state, metadata, overwrite = false) {
      if (!metadata || typeof metadata.name !== "string" || !metadata.name.trim())
        throw new TypeError("Informe um nome para o cenário.");
      const scenario = model.exportScenario(state, {...metadata, name: metadata.name.trim()});
      const items = read(), index = find(items, scenario.name);
      if (index >= 0 && !overwrite) throw new TypeError(`Já existe um cenário chamado “${items[index].name}”.`);
      if (index >= 0) items[index] = scenario;
      else items.push(scenario);
      write(items);
      return {name: scenario.name, overwritten: index >= 0};
    }
    function remove(name) {
      if (typeof name !== "string" || !name.trim()) throw new TypeError("Selecione um cenário.");
      const items = read(), index = find(items, name);
      if (index < 0) throw new TypeError("Cenário não encontrado.");
      const [removed] = items.splice(index, 1);
      write(items);
      return removed.name;
    }
    function importJson(json) {
      let parsed;
      try { parsed = JSON.parse(json); }
      catch { throw new TypeError("Arquivo JSON inválido."); }
      return model.importScenario(parsed);
    }
    function exportJson(state, metadata = {}) {
      const scenario = model.exportScenario(state, metadata);
      const slug = (scenario.name || "cenario-netstudy").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "cenario-netstudy";
      return {json: JSON.stringify(scenario, null, 2) + "\n", filename: `${slug}.json`};
    }
    return {list, load, save, remove, importJson, exportJson};
  }
  return {KEY, create};
});
