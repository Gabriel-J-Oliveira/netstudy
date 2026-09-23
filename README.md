# NetStudy

Aplicativo pessoal de estudos de redes. A trilha cobre ARP, MAC Address, Frame Ethernet, Switch Ethernet, Unicast × Broadcast, VLAN, Trunk + 802.1Q e a introdução de Camada 3 com IPv4 + Sub-rede. O projeto não usa IA, contas de usuário nem histórico persistente.

## Requisitos

- Python 3.11 ou mais recente
- `pip`
- Navegador moderno

## Preparar o ambiente no Windows/PowerShell

Na pasta do projeto:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Se a política do PowerShell impedir a ativação, você pode executar os comandos diretamente com `.\.venv\Scripts\python.exe`.

## Criar o banco e executar

```powershell
python manage.py migrate
python manage.py runserver
```

Abra `http://127.0.0.1:8000/` no navegador.

## Acessar de outras máquinas na rede local

Descubra o IPv4 da interface conectada com `ipconfig`. Nesta máquina, a interface Ethernet usa `192.168.101.78` no momento. Inicie o NetStudy por esse endereço:

```powershell
.\run-lan.ps1 -IpAddress 192.168.101.78
```

O script aplica as migrations, configura esse IP em `DJANGO_ALLOWED_HOSTS` somente durante a execução e inicia o Django na porta 8000. Mantenha o terminal aberto. Em outra máquina que consiga alcançar essa rede, abra `http://192.168.101.78:8000/`. Se o endereço da máquina mudar, substitua o valor de `-IpAddress` e use a nova URL.

Se o Firewall do Windows bloquear conexões de entrada, abra um PowerShell **como administrador** e crie uma regra restrita à sub-rede local (ajuste o IP se ele tiver mudado):

```powershell
New-NetFirewallRule -DisplayName "NetStudy LAN 8000" -Direction Inbound -Action Allow -Protocol TCP -LocalAddress 192.168.101.78 -LocalPort 8000 -RemoteAddress LocalSubnet -Profile Domain,Private
```

Este modo usa o servidor de desenvolvimento do Django e deve ficar restrito à rede local confiável. Para publicar na internet, siga [deploy.md](deploy.md).

## Verificações

```powershell
python manage.py test
python manage.py check
```

## Estrutura

```text
NetStudy/
├── manage.py
├── requirements.txt
├── netstudy/             # Configuração e URLs principais do Django
├── learning/             # Conteúdo estruturado, fluxo, views e testes
├── templates/learning/   # Templates da sessão
└── static/
    ├── css/              # Estilos dos conceitos e componentes interativos
    ├── js/               # Interações em JavaScript simples, sem frameworks
    └── images/concepts/arp/
```

O conteúdo estruturado dos checkpoints fica em arquivos Python dentro de `learning/`, incluindo `arp_checkpoint.py`, `mac_checkpoint.py`, `frame_checkpoint.py`, `switch_checkpoint.py`, `delivery_checkpoint.py`, `vlan_checkpoint.py` e `trunk_checkpoint.py`. O progresso é guardado somente na sessão Django e pode ser reiniciado pela própria interface.

Na sessão normal, respostas incorretas são mantidas como alternativas descartadas e não revelam a correta. A segunda resposta incorreta libera a pista definida no conteúdo; um acerto é registrado como `immediate` ou `guided`.

A trilha principal alterna hotspots de terminal e topologia, associação de pares, preenchimento por tokens, classificação em áreas, reparo de frase, ordenação, previsão, comando, comparação de saídas, construção de tabela e mapas de diagnóstico e conceito. As interações de encaixe funcionam por clique, sem depender de arrastar com o mouse.

## Switch Ethernet

O conteúdo está disponível em:

```text
http://127.0.0.1:8000/switch/
```

A página possui cinco áreas conceituais lineares: decisão inicial, aprendizagem pela origem, encaminhamento pelo destino, unknown unicast e consolidação. No conteúdo, o `Interactive Switch Board` opera em modo didático simplificado, mantendo visíveis somente a topologia principal, as portas Gi0/1, Gi0/4 e Gi0/6, o frame e a tabela MAC. Port Inspector, timeline, contadores e detalhes de VLAN continuam disponíveis no componente reutilizável para o checkpoint e módulos posteriores, mas não competem com a explicação introdutória.

As atividades mais avançadas usam uma bancada de investigação com ações controladas, terminal do host, CLI educacional do switch, coleta de evidências e checklist de progresso. Os comandos suportados incluem `ping`, `arp -a`, `ipconfig /all`, `show mac address-table`, `show interfaces status` e `show interfaces Gi0/x`. A atividade final combina os dois terminais para investigar uma entrada MAC desatualizada, gerar novo tráfego e confirmar a recuperação do encaminhamento. Toda a simulação é determinística, roda localmente em JavaScript simples e pode ser reiniciada sem recarregar a página.

## Unicast × Broadcast

O conteúdo seguinte ao Switch está disponível em:

```text
http://127.0.0.1:8000/unicast-broadcast/
```

A aula possui cinco áreas conceituais lineares: leitura do Destination MAC, unicast direcionado, broadcast local, distinção entre broadcast e unknown unicast e síntese com ARP Request/Reply. A topologia didática permanece em PC-A/Gi0/1, PC-B/Gi0/4 e PC-C/Gi0/6. O `Interactive Switch Board` opera em modo simplificado no conteúdo, sem Port Inspector, timeline, contadores ou detalhes de VLAN; os recursos avançados continuam disponíveis no checkpoint.

O checkpoint contém dez situações, com distribuição de dificuldade 2/4/4 entre os níveis 3, 4 e 5. As investigações combinam Packet Inspector, tabela MAC, CLI, terminal do host, Port Inspector e Evidence Board. Todo o fluxo funciona assincronamente, preserva o estado da bancada e pode ser reiniciado sem reload.

VLAN deixou de ser apenas contextualização: o módulo seguinte implementa portas Access, associação lógica, domínio de broadcast e tabela MAC com contexto VLAN. O módulo Trunk + 802.1Q estende esse contexto por dois switches.

## VLAN

O módulo está disponível em:

```text
http://127.0.0.1:8000/vlan/
```

A experiência possui cinco áreas conceituais lineares: necessidade da separação, grupos lógicos no mesmo switch, associação por porta Access, efeito da VLAN sobre frames e síntese. A topologia permanece em PC-A/Gi0/1, PC-B/Gi0/2, PC-C/Gi0/3 e PC-D/Gi0/4. O `Interactive Switch Board` usa uma variante didática de VLAN com quadro enxuto e inspetor simples; CLI, Evidence Board, troubleshooting e detalhes futuros de trunk permanecem exclusivamente no checkpoint e nos módulos posteriores.

O checkpoint contém dez situações com dificuldade progressiva `[3, 3, 4, 4, 4, 4, 5, 5, 5, 5]`. As investigações avançadas exigem ações na bancada, coleta explícita de evidências, correção controlada e reteste. A CLI educacional aceita `show vlan brief`, `show interfaces Gi0/x switchport` e `show mac address-table`, além dos comandos já disponíveis nos módulos anteriores.

Este módulo se concentra nas portas Access. A continuação em Trunk + 802.1Q ativa tagged frames, native VLAN e allowed VLANs em uma topologia com dois switches.

## Trunk + 802.1Q

O módulo está disponível em:

```text
http://127.0.0.1:8000/trunk-8021q/
```

A experiência possui exatamente sete áreas conceituais e evolui o mesmo `Interactive Switch Board` para um `Dual Switch Stage`: duas instâncias com estados independentes, conectadas por um `TrunkLink` interativo entre Gi0/8. O estágio apresenta Port Inspector para portas Access/Trunk, Trunk Inspector, Packet Inspector com o contexto 802.1Q, linhas do tempo e MAC Address Tables próprias de SW1 e SW2.

O motor valida estado e modo do link, allowed VLANs e native VLAN. Broadcast e unknown unicast só atravessam o trunk dentro do contexto VLAN elegível; frames da native VLAN são representados como untagged no modelo pedagógico. As CLIs de SW1 e SW2 aceitam `show interfaces trunk`, `show interfaces Gi0/8 switchport`, `show vlan brief` e `show mac address-table`.

O checkpoint contém dez situações com dificuldade `[3, 3, 4, 4, 4, 4, 5, 5, 5, 5]`. As situações 5, 7, 8, 9 e 10 usam Investigation Mode e Evidence Board; o desafio final isola uma allowed VLAN ausente em SW2, aplica uma correção controlada e valida ARP e known unicast. O fluxo é assíncrono, preserva immediate/guided e restaura switches, trunk, terminais, evidências, seleções, contadores e timelines pelo reset local.

Inter-VLAN Routing continua fora do escopo: trunk transporta múltiplos contextos VLAN mantendo a separação, mas não roteia entre eles.

## IPv4 + Sub-rede

O módulo está disponível em:

```text
http://127.0.0.1:8000/ipv4-subnet/
```

A página possui sete áreas conceituais sobre endereço lógico, interpretação conjunta de IPv4 e máscara, identificação do bloco, decisão local/remoto, prefixos `/24` a `/28`, terminal e síntese. O binário aparece somente depois do modelo visual de intervalos; `/16` é usado para mostrar que o limite da rede depende do prefixo.

O componente reutilizável `IPv4 / Subnet Visualizer` recebe IPv4, prefixo, destino e gateway opcional. Ele calcula e apresenta endereço de rede, broadcast, primeiro e último host convencional, total de endereços, hosts utilizáveis, máscara, tamanho do bloco, partes de rede/host e classificação local/remoto. A implementação fica em `static/js/subnet-visualizer.js` e pode ser reaproveitada futuramente nos módulos de gateway, routing, DHCP e ACL.

O terminal educacional aceita `ipconfig /all`, `ping 192.168.10.80` e `ping 192.168.20.80`, mantendo o foco na decisão de entrega em vez do sucesso do ping. Default Gateway + Routing permanece como próximo conteúdo.

A especificação recebida para esta versão termina antes de fornecer os enunciados, respostas e feedbacks das dez situações anunciadas para o checkpoint. Para respeitar a regra de não inventar conteúdo pedagógico, a página sinaliza essa dependência e não cria perguntas fictícias.

## Rapid Fire

O modo compacto com 12 itens pode ser aberto pela página de conceito ARP ou diretamente em:

```text
http://127.0.0.1:8000/arp/rapid-fire/
```

## Imagem conceitual opcional

O layout procura o arquivo:

```text
static/images/concepts/arp/arp-basic-flow.png
static/images/concepts/arp/arp-request-broadcast.png
static/images/concepts/arp/arp-cache-before-after.png
static/images/concepts/arp/arp-local-vs-remote.png
```

Enquanto esses arquivos não existirem, a página mostra placeholders discretos. O projeto não gera essas imagens.
