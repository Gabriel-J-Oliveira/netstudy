# NetStudy

NetStudy é um aplicativo didático, em português, para estudar fundamentos de redes. Combina conceitos curtos, diagramas, interações no navegador e checkpoints com feedback. O conteúdo é escrito previamente; as simulações são determinísticas. Não há IA no produto, contas de usuário nem histórico permanente de aprendizagem.

**Este README é um mapa do código atual.** Ao assumir uma tarefa, confira também a view, o template, os partials, o CSS/JS e os testes do módulo afetado. Cada aula tem demonstrações próprias; o laboratório integrado é uma bancada independente e não compartilha o estado dessas demonstrações.

## Executar localmente

Requisitos: Python 3.11 ou posterior, pip e navegador moderno. Node.js é usado nos testes do simulador. A dependência Python direta é Django 5.2.17 em requirements.txt; SQLite vem com Python. A interface usa Django Templates, CSS/JavaScript próprios e Bootstrap 5.3.3 por CDN.

No Windows/PowerShell, na raiz do repositório:

~~~powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver
~~~

Abra http://127.0.0.1:8000/. Em outros sistemas, use o Python do respectivo ambiente virtual. O erro “no such table: django_session” significa que falta executar migrate no banco usado por esse processo. Se o Python global não encontrar Django, use o executável de .venv ou ative o ambiente.

Para acesso na **rede local**, descubra o IPv4 atual da máquina (por exemplo, com ipconfig) e execute:

~~~powershell
.\run-lan.ps1 -IpAddress SEU_IP_LOCAL
~~~

O script aplica as migrations, define DJANGO_ALLOWED_HOSTS para esse IP enquanto roda e inicia o servidor de desenvolvimento na porta 8000. Pode ser necessário liberar a porta no firewall da rede privada. Não reutilize um IP antigo: ele pode mudar. As configurações de netstudy/settings.py usam DEBUG=True e chave fixa de desenvolvimento; não são uma configuração de produção. deploy.md contém notas de implantação, mas deve ser conferido contra o código antes de publicar.

## Mapa do produto

A página inicial (/) apresenta **16 módulos**, na ordem abaixo. Todos têm um checkpoint de **10 situações**, definido em learning/<tema>_checkpoint.py. O conteúdo, o laboratório da aula e o checkpoint são partes distintas.

| # | Módulo | URL | Interação ou foco |
|---|---|---|---|
| 1 | ARP | /arp/conceito/ | Request/Reply, cache e terminal; há atividades tradicionais e Rapid Fire à parte. |
| 2 | MAC Address | /mac/ | Endereço MAC, exercícios e checkpoint. |
| 3 | Frame Ethernet | /frame/ | Campos, montagem e inspeção do frame; integração com ARP. |
| 4 | Switch Ethernet | /switch/ | Aprendizado MAC, tabela MAC e encaminhamento. |
| 5 | Unicast × Broadcast | /unicast-broadcast/ | Unicast conhecido, broadcast e unknown unicast. |
| 6 | VLAN | /vlan/ | Separação lógica, portas Access e limite do broadcast. |
| 7 | Trunk + 802.1Q | /trunk-8021q/ | VLANs no mesmo enlace, percurso do frame e Allowed VLANs. |
| 8 | IPv4 + Sub-rede | /ipv4-subnet/ | Máscara, prefixo e decisão local/remoto. |
| 9 | Default Gateway + Next Hop | /default-gateway/ | Primeira entrega local e ARP do próximo salto. |
| 10 | Tabela de Rotas + Escolha de Caminho | /tabela-de-rotas/ | Correspondência de prefixos e escolha manual da rota mais específica. |
| 11 | Inter-VLAN Routing | /inter-vlan-routing/ | Dois frames ligados por uma função de Camada 3. |
| 12 | ICMP + Ping + Traceroute | /icmp-ping-traceroute/ | Echo Request/Reply e sondas com TTL crescente. |
| 13 | TCP × UDP | /tcp-udp/ | Comparação dos serviços de transporte. |
| 14 | Portas + Cliente/Servidor | /portas-cliente-servidor/ | Entrega ao endpoint e resposta do servidor. |
| 15 | DNS + Resolução de Nomes | /dns-resolucao-nomes/ | Consulta de nomes, laboratório e evidências. |
| 16 | DHCP + Configuração Dinâmica | /dhcp-configuracao-dinamica/ | DORA e configuração recebida. |

Além da trilha, **/laboratorio/** abre a bancada integrada editável descrita adiante. O menu lateral contém apenas Conteúdos e Laboratório; a navegação entre aulas aparece nas próprias páginas. ARP tem ainda o fluxo de atividades em learning/exercises.py e Rapid Fire de 12 itens em learning/content.py; MAC tem atividades em learning/mac_exercises.py.

### Padrão pedagógico das aulas

As telas recentes seguem conceito breve → representação visual → interação guiada → interpretação/síntese → checkpoint. Diagramas conceituais estáticos não devem ganhar controles por acidente; o percurso detalhado fica no componente interativo da aula. Frame Ethernet e parte de ARP/MAC preservam fluxos anteriores mais extensos.

Termos auxiliares podem usar popovers com sublinhado pontilhado. O componente compartilhado está em static/js/context-glossary.js e static/css/context-glossary.css; algumas páginas usam uma variante própria existente. Conceitos centrais ficam no texto principal. As interações buscam uso por teclado, foco visível, feedback acessível, layout móvel e respeito a movimento reduzido.

Gateway, Rotas, Inter-VLAN e ICMP usam, respectivamente, os partials l3_path_stage, routing_table_visualizer, inter_vlan_path_stage e diagnostic_path_stage, com JS/CSS de mesmo nome. Switch/VLAN/Trunk têm componentes didáticos de Camada 2, também usados nos checkpoints. Esses componentes **não são o simulador da bancada integrada**.

### Checkpoints e persistência

learning/urls.py define as rotas; learning/views.py renderiza páginas e processa formulários. Situações, respostas, feedback, pistas e equívocos pedagógicos ficam nos arquivos learning/*_checkpoint.py. O progresso é guardado na **sessão Django**, usando o SQLite local; daí a necessidade da tabela django_session. Não há autenticação nem armazenamento permanente de pontuação.

Muitos formulários de checkpoint são enviados por AJAX e recebem de volta um partial HTML atualizado. Ao alterar atividades que inserem componentes interativos, confira se o JavaScript reinicializa o componente após a substituição do HTML. Preserve CSRF, memória de respostas, pistas, avanço, reinício e resumo final.

## Laboratório integrado (/laboratorio/)

A bancada em templates/learning/integrated_lab.html possui catálogo, área de montagem larga e alta, configuração do equipamento selecionado, escolha livre de PC de origem/destino, teste manual, navegação por eventos, inspetor e tabelas no evento. Não há autoplay. Pode-se instalar e mover equipamentos com mouse ou teclado (setas e Enter), conectar interfaces, ajustar VLANs/Allowed VLANs e reiniciar a bancada.

**Inventário e limites:** até 4 PCs (A–D), 2 switches (SW1/SW2), 1 roteador (R1), 7 equipamentos instalados, 7 cabos, 1 trunk entre switches e 128 eventos por teste. SW1/SW2 têm Gi0/1–Gi0/4 como portas Access configuráveis para VLAN 10 ou 20 e Gi0/5 como trunk. R1 tem Eth0 e Eth1, cada uma com IPv4, máscara e MAC próprios; cada interface liga-se a uma porta Access. Cada PC tem IPv4, máscara, MAC e gateway padrão. O modelo não permite PC–PC, roteador–roteador ou PC–trunk. Interrupção por limite é resultado interrompido, nunca sucesso.

### Responsabilidades dos arquivos

- static/js/integrated-lab-model.js: catálogo, configurações, posições, conexões e adaptação do grafo para o simulador. Também exporta a API para Node.
- O mesmo modelo define o **Scenario Schema v1** e as APIs exportScenario/importScenario. A configuração do cenário é separada do resultado dos testes.
- static/js/integrated-lab-simulator.js: valida a montagem e **decide o percurso**. Calcula ARP, aprendizado/encaminhamento MAC por VLAN, passagem pelo trunk, decisão local/remoto do host e rotas diretamente conectadas de R1. Emite eventos ordenados com IDs de evento, equipamento, interface, cabo, frame e pacote e snapshots das tabelas MAC/ARP/rotas em cada evento.
- static/js/integrated-lab.js: liga controles ao modelo e **representa os eventos**. A lógica de encaminhamento não deve ser duplicada na camada visual.
- static/css/integrated-lab.css: largura quase total da área de conteúdo, bancada alta, cartões de equipamentos, inspetor e layout móvel.

O teste usa uma cópia da configuração no clique em “Testar comunicação”. Alterar equipamento, cabo, VLAN ou o par de PCs invalida o resultado anterior. Anterior/Próximo percorrem os snapshots sem revelar informações futuras. Ao clicar R1, a interface mostra Eth0/Eth1, rotas de interfaces conectadas e associações ARP existentes no evento selecionado. Nos momentos relevantes, o inspetor apresenta lado a lado Frame de entrada, Decisão do roteador e Frame de saída.

### Cenário reproduzível de roteamento

~~~text
PC-A    192.168.10.10/24  gateway 192.168.10.1  MAC AA:AA:AA:AA:AA:AA  VLAN 10
R1 Eth0 192.168.10.1/24                         MAC 10:10:10:10:10:10  VLAN 10
R1 Eth1 192.168.20.1/24                         MAC 20:20:20:20:20:20  VLAN 20
PC-B    192.168.20.20/24  gateway 192.168.20.1  MAC BB:BB:BB:BB:BB:BB  VLAN 20
~~~

Conecte PC-A e R1 Eth0 a portas Access VLAN 10; R1 Eth1 e PC-B a portas Access VLAN 20. As interfaces do roteador podem estar no mesmo switch ou em switches diferentes, segundo os cabos disponíveis. O trunk pode ligar SW1 a SW2, mas **não é requisito universal** para rotear entre as VLANs. A montagem física válida define os trechos reais.

No teste A→B, PC-A usa **a própria máscara** e classifica PC-B como remoto. Faz ARP para 192.168.10.1, envia o frame AA → R1 Eth0 e mantém Destination IP = 192.168.20.20 no pacote. R1 encerra o frame, seleciona a rede 192.168.20.0/24 diretamente conectada por Eth1, faz ARP para PC-B na saída e cria um novo frame R1 Eth1 → BB. Os IPs de origem e destino permanecem neste cenário sem NAT; o TTL cai de 64 para 63. B→A usa primeiro Eth1 e depois Eth0. Entrega local na mesma VLAN, inclusive através do trunk, continua funcionando sem roteador.

Falhas representadas no ponto em que ocorrem: gateway ausente ou fora da rede local; ARP do gateway sem resposta por cabo/porta/VLAN; falta de interface conectada à rede de destino; ARP do destino sem resposta na saída; IPv4 inválido. **Uma máscara errada no PC não é corrigida pelo gateway**: se o host considera o destino local, tenta ARP para o próprio destino na rede local.

### Scenario Schema v1

O contrato versionado está em static/js/integrated-lab-model.js e funciona em Node, sem DOM. exportScenario(state, metadata?) devolve um objeto novo; importScenario(scenario) valida o contrato e devolve {state, name, sourceId, destinationId}. Dados inválidos geram TypeError. Nome e par origem/destino são opcionais; se houver seleção, os dois IDs devem identificar PCs distintos e instalados.

~~~js
{
  schemaVersion: 1,
  name: "Duas redes por R1", // opcional; até 120 caracteres
  devices: {
    "pc-a": {
      position: {x: 0.18, y: 0.22}, // ou null quando não instalado
      config: {ip: "192.168.10.10", mask: "255.255.255.0",
               mac: "AA:AA:AA:AA:AA:AA", gateway: "192.168.10.1"}
    },
    // Também contém pc-b, pc-c, pc-d, sw1, sw2 e r1.
    // Switch: config = {vlans: {"sw1:gi0/1": 10, ...}, allowedVlans: [10, 20]}
    // R1: config = {eth0: {ip, mask, mac}, eth1: {ip, mask, mac}}
  },
  connections: [{a: "pc-a:eth0", b: "sw1:gi0/1"}],
  sourceId: "pc-a",      // opcional, sempre junto de destinationId
  destinationId: "pc-b" // opcional
}
~~~

O mapa devices inclui **todos os sete IDs do catálogo**, mesmo os não instalados, para preservar também configurações editáveis de equipamentos cuja posição é null. Armazena somente posição e configuração; tipo, nome e lista de interfaces são reconstruídos pelo catálogo. Cabos guardam apenas os dois endpoints; ID e tipo são reconstruídos pelo modelo. Não há interfaces redundantes no arquivo.

O importador rejeita versão desconhecida, campos ausentes/desconhecidos, IDs fora do catálogo, posições fora da bancada, endereços ou máscaras estruturalmente inválidos, VLANs inválidas, conexões impossíveis/repetidas e seleção de PCs incoerente. Usa as mesmas regras de conexão e os limites do modelo. Valores semanticamente errados, mas estruturalmente válidos, como gateway na rede errada, continuam representáveis para estudo de falhas. O estado reconstruído não compartilha objetos mutáveis com o cenário recebido.

**O cenário é somente a rede configurada.** Não contém eventos, histórico, resultado, tabelas MAC/ARP aprendidas, snapshots de rotas, cursor, modo da UI nem evento selecionado. Esses dados surgem novamente ao executar o simulador. Ainda não existe botão Salvar/Carregar, arquivo de cenário, localStorage ou persistência da bancada no Django.

Uma futura definição de exercício de troubleshooting deve ficar em uma **camada separada** que referencie um cenário. Resposta esperada, correção, pistas e condição de sucesso não pertencem ao Schema v1. Também não existe terminal integrado nesta bancada; uma futura interface de comandos deverá consultar e alterar o mesmo modelo/simulador, mantendo os estados coerentes, em vez de manter um estado paralelo decorativo.

**Fora do escopo desta etapa:** interface Salvar/Carregar, presets, desafios, terminal/CLI na bancada, mais roteadores, rotas estáticas, NAT, DHCP, DNS, Internet simulada, router-on-a-stick, ping/ICMP completo, autoplay, autenticação e persistência da montagem. Terminais e laboratórios das aulas são demonstrações independentes.

## Estrutura e pontos de edição

| Necessidade | Fonte principal |
|---|---|
| Configuração Django, SQLite, hosts | netstudy/settings.py |
| Rotas e views | learning/urls.py, learning/views.py |
| Questões e feedback | learning/<tema>_checkpoint.py |
| Página de uma aula | templates/learning/<tema>_concept.html e partials incluídos |
| Comportamento/estilo de uma aula | static/js/<tema>-concept.js, static/css/<tema>-concept.css e componente reutilizado |
| Moldura, menu e largura geral | templates/learning/base.html, static/css/netstudy.css |
| Bancada integrada | templates/learning/integrated_lab.html, static/js/integrated-lab-*.js, static/css/integrated-lab.css |
| Testes Django | learning/tests.py, learning/test_integrated_lab.py |
| Testes Node do laboratório | static/js/integrated-lab-model.test.js, static/js/integrated-lab-simulator.test.js, static/js/integrated-lab-scenario.test.js |
| CI | .github/workflows/ci.yml (push e pull request para main) |

Antes de editar uma página, leia o template, os partials incluídos, os CSS/JS carregados ao fim do template e a view que fornece o contexto. Alguns dados de exemplo são definidos na view (como as rotas de /tabela-de-rotas/); outros ficam nos componentes JS. Verifique sempre o estado atual do Git, pois mudanças de outra tarefa podem estar presentes na árvore de trabalho.

## Verificação

No Windows com .venv preparado:

~~~powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py test
node static/js/integrated-lab-model.test.js
node static/js/integrated-lab-simulator.test.js
node static/js/integrated-lab-scenario.test.js
node --check static/js/integrated-lab-model.js
node --check static/js/integrated-lab-simulator.js
node --check static/js/integrated-lab.js
git diff --check
~~~

Os testes Django cobrem páginas, endpoints e checkpoints. Os testes Node cobrem o modelo, o simulador e o round-trip/isolamento/rejeições do Scenario Schema v1. O CI repete esses comandos em Linux com Python 3.11 e Node 22. Para mudanças visuais ou de interação, confira também a página no navegador em desktop e largura móvel (360 px é uma referência usada no projeto). Este mapa não substitui a inspeção do código nem a validação do comportamento alterado.
