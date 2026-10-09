# Auditoria da jornada integrada

Base avancada: recovery/netstudy-advanced, c4325a17.

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
- /praticar/: nove familias do engine, ARP/MAC, troubleshooting e GNS3.
  /troubleshooting/ permanece compativel e apresenta o mesmo catalogo.
- /laboratorio/: bancada livre acessivel diretamente. Parametros exercise,
  difficulty, mode e seed continuam sendo tratados pelo engine existente.
  O link da montagem acompanha a seed atual, inclusive apos gerar novo exercicio.
- /laboratorios-praticos/ e suas rotas de detalhes permanecem inalteradas,
  com retorno a Praticar e acesso a bancada livre.

Sequencia opcional: Aprender -> Checkpoint -> Praticar -> Laboratorio contextual
-> Aprofundamento GNS3. Nenhum progresso ficticio ou motor novo foi criado.

## Limites desta entrega

A lista integradora futura tem somente uma indicacao de indisponibilidade.
Nenhum gerador, avaliador, motor de rede, conteudo ou armazenamento de cenarios
foi alterado. O IP local em netstudy/settings.py e dados locais nao fazem parte
da publicacao; cenarios seguem seu fluxo atual.

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
  checkpoints individuais, GNS3 e a lista integradora futura continuam fora
  deste contrato v1.
