# Auditoria da jornada integrada

Base avançada recuperada em `recovery/netstudy-advanced` (`c4325a1`). Estado descrito aqui: linha de desenvolvimento `feature/lista-1-l2-02`, descendente de `feature/activity-orchestrator-v1` (`f22a607`). A `main` permanece na base antiga (`684d738`); consulte a tabela de branches e commits no README antes de comparar funcionalidades.

## Inventario real preservado

- 16 conteudos com laboratorios conceituais e checkpoints existentes.
- Exercise Engine: ipv4, vlan-access, trunk-8021q, routing, static-routing,
  external-routing, nat-pat, services e mixed. Dificuldades intermediate/advanced
  e modos bench/operational continuam usando geradores e avaliadores existentes.
- Atividades ARP/MAC e Rapid Fire ARP; MAC Rapid Fire nao e apresentado como pronto.
- Bancada dinamica com Device Profiles, terminais Cisco/MikroTik/Dell/host,
  ICMP, routing, NAT, DHCP/DNS, cenarios pessoais e presets oficiais.
- Catalogo e detalhes de laboratorios GNS3 com verificacao manual existente.

## Navegacao

- /: tres entradas e sequencia recomendada, sem gates novos; catalogo mantido.
- /aprender/: os 16 conteudos originais. Sidebar contextual liga checkpoint,
  aula anterior/proxima, familia de exercicio relacionada e catalogo GNS3.
- /praticar/: nove familias do engine, ARP/MAC, L2-02 da Lista 1,
  troubleshooting e GNS3.
  /troubleshooting/ permanece compativel e apresenta o mesmo catalogo.
- /laboratorio/: bancada livre acessivel diretamente. Parametros exercise,
  difficulty, mode e seed continuam sendo tratados pelo engine existente.
  O link da montagem acompanha a seed atual, inclusive apos gerar novo exercicio.
- /laboratorios-praticos/ e suas rotas de detalhes permanecem inalteradas,
  com retorno a Praticar e acesso a bancada livre.

Sequencia opcional: Aprender -> Checkpoint -> Praticar -> Laboratorio contextual
-> Aprofundamento GNS3. Nenhum progresso ficticio ou motor novo foi criado.

## Limites da consolidação original da navegação

A lista integradora multidisciplinar futura ainda tem somente uma indicação
de indisponibilidade. A Lista 1 começou separadamente com L2-02; abrir
práticas relacionadas de VLAN/Trunk não marca essas práticas como concluídas.
Na entrega original de navegação, nenhum gerador, avaliador, motor de rede,
conteúdo ou armazenamento de cenários foi alterado. L2-02 acrescentou depois
um avaliador curto e isolado, descrito abaixo. O IP local em
`netstudy/settings.py` e dados locais não fazem parte da publicação; cenários
seguem seu fluxo atual.

## Atualizacao: Attempt Engine v1

- A continuidade dos exercicios da bancada agora usa Attempt Schema v1 em
  `netstudy:attempts:v1`, separado de Scenario Schema e Meus cenarios.
- `/praticar/` mostra estado local por familia e permite iniciar, continuar,
  gerar outra seed, reiniciar e descartar uma tentativa. `/laboratorio/` preserva
  o attemptId ao retornar a lista e salva automaticamente alteracoes GUI/CLI.
- A retomada reconstroi o problema pelo Exercise Engine, exige generatorVersion
  compativel e confere o cenario inicial antes de restaurar a configuracao atual.
  Feedbacks e verificacoes resumidas persistem; gabaritos, eventos completos e
  tabelas transitorias nao sao gravados. O indice de um percurso pode ser
  reconstituido do simulador sem armazenar seus eventos.
- A persistencia e apenas no navegador atual, sem login, servidor ou sincronizacao.
  Dados corrompidos/incompativeis nao sao sobrescritos automaticamente. Os
  checkpoints individuais, GNS3, L2-02 e a lista integradora futura continuam
  fora deste contrato v1.

## Atualização: Activity Orchestrator v1

- O commit `f22a607` acrescentou `static/js/activity-orchestrator.js`, seus
  testes Node e `docs/ACTIVITY_ORCHESTRATOR_V1.md`, sem modificar os motores
  de exercício, simulação ou persistência. O núcleo puro define atividades
  versionadas com etapas dependentes, estados, evidências de referência,
  vereditos externos e invalidação transitiva.
- Não há tela, adaptador de Exercise Engine, gravação em Attempt Schema v2 ou
  piloto multidisciplinar em execução. Navegar eventos da bancada não satisfaz
  etapas pedagógicas; o núcleo não avalia respostas nem decide conectividade.

## Atualização: Lista 1 — L2-02

- O commit de implementação `a6b3da1`, em `feature/lista-1-l2-02`, acrescentou
  `/praticar/camada-2/uma-saida-ou-varias/`. Três cenários fixos distinguem
  unicast conhecido, unicast desconhecido com flooding e broadcast. O aluno
  prevê classificação, consulta à tabela, ação do switch, portas de saída,
  hosts que recebem e hosts que aceitam; erros permitem revisão com feedback
  específico. A avaliação fica em `learning/l2_practice.py`, não no simulador.
- A sessão Django usa a chave isolada `netstudy_l2_02_v1` para versão e IDs
  verificados. Ela não grava gabaritos e não equivale a conclusão da Lista 1,
  histórico permanente ou tentativa da bancada. Não há variação por seed nem
  integração desta atividade com o núcleo do Orchestrator nesta versão.
- Checkpoints, nove famílias do Exercise Engine, Attempt Engine v1 e bancada
  livre permanecem com seus contratos próprios. O próximo trabalho pedagógico
  pode adaptar L2-01; as demais atividades e listas ainda não estão prontas.
