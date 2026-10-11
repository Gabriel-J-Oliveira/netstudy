# Activity Orchestrator v1 — contrato do núcleo

Este incremento acrescenta apenas `static/js/activity-orchestrator.js` e testes Node. Não há integração com UI, `localStorage`, Exercise Engine, simulador ou Attempt Engine v1. O núcleo coordena progresso **pedagógico**; o cursor de eventos, equipamento selecionado e histórico visual da bancada são **operacionais** e ficam fora dele.

## Contratos e API

- `ActivityDefinition`: `{activityId, activityVersion, stages}`. A versão do contrato do núcleo é `contractVersion: 1`. `stages` é uma lista ordenada (1 a 16 itens) de `{id, kind, dependsOn, requiresResponse?}`. Dependências apontam somente para etapas anteriores; a ordem guia a navegação, mas não substitui a dependência explícita. A definição pública não inclui gabaritos nem regras privadas do gerador.
- Tipos de etapa: `reflection` registra uma resposta sem avaliar acerto; `evidence` recebe uma ou mais referências de evidência e um veredito externo; `external` recebe um veredito externo, com resposta obrigatória somente quando `requiresResponse: true`.
- `ActivityProgress`: `{activityId, activityVersion, activeStageId, status, stages}`. `status` é `in_progress` ou `completed`. Cada `StageProgress` guarda `{status, response, evidence, assessment}`; o status é `pending`, `active`, `satisfied` ou `stale`. A etapa em foco pode continuar `satisfied` quando o aluno a revisita. Uma etapa `stale` preserva o registro anterior para revisão, mas não vale como satisfeita.
- Referência de evidência: `{source, referenceId, scenarioRevision}`, com `source` entre `bench`, `simulation`, `cli` e `text`. São referências curtas, não cópias de eventos, tabelas ou saídas completas.
- Veredito externo: `{accepted, code, feedback}`. O chamador consulta o avaliador apropriado e fornece o resultado; o núcleo **não** decide conectividade, correção conceitual ou a sequência de comandos. O chamador é responsável por não persistir gabaritos em `feedback`.
- `defineActivity(raw)` valida e normaliza a definição; `createProgress(definition)` inicia a primeira etapa; `validateProgress(definition, saved)` valida e copia um estado antes de usá-lo; `apply(definition, progress, action)` retorna `{progress, outcome, invalidated}` sem modificar entradas. Erros de contrato/transição lançam `TypeError`. `outcome` é `satisfied`, `needs-revision`, `advanced`, `reviewed`, `invalidated` ou `completed`.
- Ações pedagógicas: `submit` para a etapa em foco; `advance` apenas após satisfação; `review` apenas para etapa anterior; `invalidate` para desatualizar uma etapa e seus dependentes transitivos; `complete` apenas após satisfação de **todas** as etapas. Reenvio de uma etapa já satisfeita invalida dependentes se seu registro mudou. Etapas independentes permanecem satisfeitas.

## Exemplo do piloto futuro

```js
const activity = orchestrator.defineActivity({
  activityId: "ipv4-investigation", activityVersion: "1.0",
  stages: [
    {id: "hypothesis", kind: "reflection", dependsOn: []},
    {id: "evidence", kind: "evidence", dependsOn: ["hypothesis"]},
    {id: "intervention", kind: "external", dependsOn: ["evidence"]},
    {id: "interpretation", kind: "external", dependsOn: ["intervention"], requiresResponse: true}
  ]
});
let progress = orchestrator.createProgress(activity);
progress = orchestrator.apply(activity, progress, {
  type: "submit", stageId: "hypothesis", response: "Minha hipótese inicial"
}).progress;
progress = orchestrator.apply(activity, progress, {type: "advance"}).progress;
progress = orchestrator.apply(activity, progress, {
  type: "submit", stageId: "evidence",
  evidence: [{source: "simulation", referenceId: "run-1:event-4", scenarioRevision: "revision-1"}],
  assessment: {accepted: true, code: "accepted", feedback: "Evidência pertinente."}
}).progress;
```

Depois, o chamador avança para `intervention` e fornece o veredito do Exercise Engine. Mesmo se aceito, `progress.status` continua `in_progress` até a interpretação final ser satisfeita e a ação `complete` ser aplicada. Mover o cursor entre eventos da simulação não chama `apply`; mudar a configuração pode fazer o chamador aplicar `invalidate` à evidência ou intervenção afetada.

## Envelope planejado do Attempt Schema v2

O contrato do futuro armazenamento deve separar `schemaVersion: 2` de `activityId/activityVersion` e de `exerciseId/generatorVersion`. Também deverá guardar `attemptId`, `seed`, `difficulty`, `mode`, `initialScenario`, `currentScenario`, `pedagogicalProgress` (validado pelo orquestrador), `operationalProgress` (cursor/seleção da bancada, validado em seu próprio domínio), datas e histórico resumido. O gerador deve reconstruir a mesma definição a partir de identidade, seed e versão antes de restaurar o progresso. Versões incompatíveis devem ser apresentadas explicitamente, sem regeneração silenciosa. O armazenamento deve validar referências de evidência contra o cenário e execuções disponíveis, tratar corrupção/indisponibilidade e preservar tentativas existentes.

O Attempt Engine v1 e seu namespace `netstudy:attempts:v1` permanecem inalterados. Este documento **não** define migração automática, gravação v2, retentativa, UI ou orquestração de comandos. Essas responsabilidades ficam para incrementos posteriores.
