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
da publicacao. A continuidade de exercicios preserva os parametros da montagem,
nao promete restaurar edicoes manuais nao salvas; cenarios seguem seu fluxo atual.
