# NetStudy

NetStudy é um aplicativo didático, em português, para estudar fundamentos de redes. Combina conceitos curtos, diagramas, interações no navegador e checkpoints com feedback. O conteúdo é escrito previamente; as simulações são determinísticas. Não há IA no produto nem contas de usuário. As tentativas dos exercícios da bancada persistem apenas no navegador local; isso não é uma conta nem sincronização entre dispositivos.

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

Além da trilha, **/praticar/** reúne os exercícios e **/laboratorio/** abre a bancada integrada editável descrita adiante. As três entradas principais são Aprender, Praticar e Laboratório; a navegação entre aulas aparece nas próprias páginas. ARP tem ainda o fluxo de atividades em learning/exercises.py e Rapid Fire de 12 itens em learning/content.py; MAC tem atividades em learning/mac_exercises.py.

**/laboratorios-praticos/** reúne quatro missões independentes para reprodução no GNS3: VLAN/trunk, roteamento entre VLANs, rotas estáticas e diagnóstico corporativo. `learning/external_labs.py` contém definições estáticas (topologia, endereços, missão, restrições, critérios, evidências, dicas e solução). As views e templates de `external_labs_*` apenas apresentam essas definições. `static/js/external-labs.js` guarda marcações de critérios/evidências por atividade em `localStorage` (`netstudy:external-lab:v1:<slug>`); dicas e solução usam elementos `details`. O aluno valida manualmente no GNS3; o NetStudy não inspeciona o ambiente, não recebe capturas, não distribui imagens e não exporta projetos GNS3. As definições ficam separadas do simulador e podem futuramente receber variações e fabricantes sem mudar o progresso local v1. Execute `python manage.py test learning.test_external_labs` e `node static/js/external-labs.test.js` para verificar esta área.

**/troubleshooting/** lista exercícios da bancada. A primeira família, Diagnóstico de conectividade IPv4, abre o mesmo laboratório em modo exercício nas dificuldades Intermediate e Advanced.

### Padrão pedagógico das aulas

As telas recentes seguem conceito breve → representação visual → interação guiada → interpretação/síntese → checkpoint. Diagramas conceituais estáticos não devem ganhar controles por acidente; o percurso detalhado fica no componente interativo da aula. Frame Ethernet e parte de ARP/MAC preservam fluxos anteriores mais extensos.

Termos auxiliares podem usar popovers com sublinhado pontilhado. O componente compartilhado está em static/js/context-glossary.js e static/css/context-glossary.css; algumas páginas usam uma variante própria existente. Conceitos centrais ficam no texto principal. As interações buscam uso por teclado, foco visível, feedback acessível, layout móvel e respeito a movimento reduzido.

Gateway, Rotas, Inter-VLAN e ICMP usam, respectivamente, os partials l3_path_stage, routing_table_visualizer, inter_vlan_path_stage e diagnostic_path_stage, com JS/CSS de mesmo nome. Switch/VLAN/Trunk têm componentes didáticos de Camada 2, também usados nos checkpoints. Esses componentes **não são o simulador da bancada integrada**.

### Checkpoints e persistência

learning/urls.py define as rotas; learning/views.py renderiza páginas e processa formulários. Situações, respostas, feedback, pistas e equívocos pedagógicos ficam nos arquivos learning/*_checkpoint.py. O progresso é guardado na **sessão Django**, usando o SQLite local; daí a necessidade da tabela django_session. Não há autenticação nem armazenamento permanente de pontuação.

Muitos formulários de checkpoint são enviados por AJAX e recebem de volta um partial HTML atualizado. Ao alterar atividades que inserem componentes interativos, confira se o JavaScript reinicializa o componente após a substituição do HTML. Preserve CSRF, memória de respostas, pistas, avanço, reinício e resumo final.

## Laboratório integrado (/laboratorio/)

A bancada em templates/learning/integrated_lab.html possui catálogo por tipo (+ PC, + Switch, + Router), área de montagem larga e alta, escolha livre de PCs de origem/destino, teste manual, navegação por eventos, inspetor e tabelas no evento. Não há autoplay. Cada clique no catálogo cria uma instância com ID estável e nome editável. O card pode ser arrastado diretamente com os cabos acompanhando o movimento; o botão Mover mantém a alternativa por teclado. Portas livres conectam em dois cliques e clicar em uma porta conectada desconecta o cabo. Um popover mostra resumo no hover e configurações editáveis ao clicar no card, inclusive nome e remoção. **Cenários do NetStudy** oferece montagens oficiais para carregar; **Meus cenários** salva e carrega montagens neste navegador, além de importar e exportar JSON.

**Inventário e limites:** a quantidade de PCs, switches, roteadores e cabos é dinâmica. Cada switch tem Gi0/1–Gi0/4 como portas Access para VLAN 10 ou 20 e Gi0/5 como trunk. Cada roteador tem Eth0 e Eth1, com IPv4, máscara e MAC próprios; cada interface liga-se a uma porta Access. Cada PC tem IPv4, máscara, MAC e gateway padrão. O modelo não permite PC–PC, roteador–roteador ou PC–trunk. O simulador ainda limita eventos, iterações e tempo para interromper percursos excessivos; interrupção nunca conta como sucesso.

### Responsabilidades dos arquivos

- static/js/integrated-lab-model.js: catálogo, configurações, posições, conexões e adaptação do grafo para o simulador. Também exporta a API para Node.
- O mesmo modelo define o **Scenario Schema v1** e as APIs exportScenario/importScenario. A configuração do cenário é separada do resultado dos testes. Novos cenários usam `format: "dynamic"`, com `{type, name, position, config}` por equipamento e `nextIds`; arquivos v1 antigos continuam importáveis.
- static/js/integrated-lab-storage.js: lista, salva, carrega e exclui cenários pessoais no localStorage; valida cada item pelo modelo e prepara importação/exportação JSON, sem DOM.
- static/js/integrated-lab-attempts.js: contrato e persistência das tentativas de exercícios, independentes de Meus cenários, do DOM e do Scenario Schema.
- static/js/integrated-lab-presets.js: biblioteca oficial de oito cenários Schema v1, sem localStorage. As topologias são montadas pelo modelo e seus cenários permanecem imutáveis.
- static/js/integrated-lab-exercise-engine.js: definições, geração por seed e validação de exercícios, sem DOM ou persistência. A instância mantém regras e metadados separados do Scenario Schema v1.
- static/js/integrated-lab-simulator.js: valida a montagem e **decide o percurso**. Calcula ARP, aprendizado/encaminhamento MAC por VLAN, passagem pelo trunk, decisão local/remoto do host e rotas conectadas/estáticas por prefixo mais longo entre roteadores. Emite eventos ordenados com IDs de evento, equipamento, interface, cabo, frame e pacote e snapshots das tabelas MAC/ARP/rotas em cada evento.
- static/js/integrated-lab.js: liga controles ao modelo e **representa os eventos**. A lógica de encaminhamento não deve ser duplicada na camada visual.
- static/css/integrated-lab.css: largura quase total da área de conteúdo, bancada alta, cartões de equipamentos, inspetor e layout móvel.

O teste usa uma cópia da configuração no clique em “Testar comunicação”. Alterar equipamento, cabo, VLAN ou o par de PCs invalida o resultado anterior. Anterior/Próximo percorrem os snapshots sem revelar informações futuras. Ao clicar em um roteador, o popover mostra Eth0/Eth1, rotas conectadas/estáticas e associações ARP existentes no evento selecionado; a aba de configuração permite adicionar ou excluir rotas estáticas. Nos momentos relevantes, o inspetor apresenta lado a lado Frame de entrada, Decisão do roteador e Frame de saída.

### Cenário reproduzível de roteamento com IDs legados

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

O exemplo acima representa o **formato v1 antigo**, mantido para presets e arquivos pessoais existentes. Cenários novos guardam as instâncias criadas com IDs dinâmicos (`pc-1`, `switch-1`, `router-1` etc.), nome editável, tipo, posição, configuração, conexões e contadores em `nextIds`. IDs não são derivados do nome. Cabos guardam apenas os endpoints; ID e tipo são reconstruídos pelo modelo.

O importador rejeita versão desconhecida, campos ausentes/desconhecidos, IDs fora do catálogo, posições fora da bancada, endereços ou máscaras estruturalmente inválidos, VLANs inválidas, conexões impossíveis/repetidas e seleção de PCs incoerente. Usa as mesmas regras de conexão e os limites do modelo. Valores semanticamente errados, mas estruturalmente válidos, como gateway na rede errada, continuam representáveis para estudo de falhas. O estado reconstruído não compartilha objetos mutáveis com o cenário recebido.

**O cenário é somente a rede configurada.** Não contém eventos, histórico, resultado, tabelas MAC/ARP aprendidas, leases DHCP ativos, snapshots de rotas, cursor, modo da UI nem evento selecionado. Esses dados surgem novamente ao executar o simulador.

### Save/Load local e arquivos JSON

O módulo de storage guarda um **array de objetos Scenario Schema v1** na chave `netstudy:integrated-lab:scenarios:v1` do localStorage. Cada cenário salvo precisa ter nome único (sem diferenciar maiúsculas/minúsculas). Sobrescrever exige confirmação na UI; Salvar como rejeita nome existente. Excluir remove só o item escolhido. Dados locais corrompidos são recusados sem sobrescrita automática.

Importar um `.json` valida pelo `importScenario` antes de substituir a bancada; a importação não salva automaticamente. Exportar usa `exportScenario` e produz JSON legível com nome de arquivo derivado do cenário. Carregar ou importar restaura rede e par de PCs, quando presente, e limpa eventos e tabelas anteriores. A persistência é apenas local ao navegador; não há contas nem backend Django para cenários.

### Cenários oficiais

A biblioteca inclui **LAN básica**, **VLANs separadas**, **Trunk entre switches**, **Roteamento entre duas redes**, **DHCP, DNS e serviço Web**, quatro versões de **Rede externa** e **Acesso externo · NAT/PAT**. Os dez objetos são Scenario Schema v1 e passam por `importScenario` ao carregar, usando a mesma restauração da bancada dos cenários pessoais. O preset de serviços mostra DHCP/DNS na VLAN 10 e uma aplicação TCP/80 na VLAN 20. A rede externa usa R1, dois roteadores nomeados ISP-1/ISP-2 e um servidor de teste: é uma representação lógica do caminho externo, sem acesso à Internet real. O preset de NAT/PAT não inclui rota ISP para a LAN privada; a resposta depende da tradução em R1. O preset original não pode ser editado ou excluído pela UI; alterações na bancada podem ser salvas como uma cópia pessoal. Carregar um preset não grava no localStorage.

### DHCP, DNS e serviços

Um PC pode atuar como servidor por meio de `config.dhcpServer`, `config.dnsServer` e `config.services`; outro PC pode usar `dhcpClient` e `dns`. São campos opcionais do Scenario Schema v1, validados também em cenários antigos. `static/js/integrated-lab-services.js` executa DORA simplificado dentro do domínio L2, aloca um IPv4 livre do pool e aplica máscara, gateway e DNS ao cliente. O lease em `serviceRuntime` vale na sessão da bancada e não é exportado; `leaseMinutes` é uma duração didática, sem expiração automática por relógio. DNS consulta registros A do servidor configurado depois de confirmar o percurso IP. A conexão simplificada testa protocolo, porta e disponibilidade do serviço após a resolução; não troca dados HTTP reais nem implementa TCP/UDP completo.

Na bancada, clique num PC para configurar cliente, servidor, registros A e serviços. O painel de teste oferece Renovar DHCP, Consultar DNS e Testar serviço; os eventos podem ser percorridos manualmente. Windows oferece `ipconfig /renew`, `ipconfig /all`, `nslookup`, `curl` e `connect tcp|udp`; Linux oferece `dhclient`, `dig`, `curl` e `connect tcp|udp`. Os comandos consultam a configuração e o percurso atuais da bancada.

### NAT/PAT básico

Roteadores podem ter `config.nat` opcional, com interfaces `inside`/`outside`, rede e máscara de origem e estado `enabled`. Cenários antigos sem NAT continuam válidos. A decisão de rota ocorre antes da tradução; somente o tráfego que entra pela inside, sai pela outside e combina com a rede configurada recebe source PAT. Nesta etapa o tráfego simulado é ICMP: o motor traduz o IPv4 de origem para o endereço da interface outside e o identificador ICMP para distinguir a tradução. O Echo Reply volta ao IPv4 público e é traduzido para o host interno. A tabela NAT é criada durante a simulação e armazenada nos snapshots dos eventos, nunca no cenário salvo.

O popover do roteador permite configurar NAT/PAT e mostra as traduções até o evento selecionado. Cisco oferece `ip nat inside|outside` na interface, `access-list 1 permit <rede> <wildcard>`, `ip nat inside source list 1 interface <interface> overload`, `show ip nat translations` e `show ip nat statistics`. MikroTik oferece `/ip firewall nat print|add|remove` com `chain=srcnat action=masquerade`. Os dois terminais alteram a mesma configuração da GUI. Esta implementação cobre PAT de origem para ICMP; não simula NAT estático, tradução TCP/UDP nem Internet real.

### Device Profiles v1

`static/js/integrated-lab-profiles.js` define uma camada independente do simulador: hosts `generic`, `windows`, `linux`; switches `generic`, `cisco-ios`, `dell-os10`; roteadores `generic`, `cisco-ios`, `mikrotik-routeros`. Cada definição imutável contém nome de apresentação, nomenclatura das interfaces, capabilities já suportadas pela bancada e metadados para o terminal (dialeto, template de prompt, fonte do hostname, encoding e adapter de comandos). Cisco IOS-like, Dell OS10-like, MikroTik RouterOS-like, Windows e Linux têm adapters didáticos; os profiles genéricos usam os comandos básicos do terminal.

O catálogo permite escolher um profile antes de criar o equipamento; o popover permite trocá-lo depois. `model.setProfile` e `model.interfaceName` preservam IDs, nomes canônicos internos, conexões e configurações. A UI resolve os nomes exibidos, inclusive nas tabelas e evidências, sem alterar os eventos do simulador. Trocar profile não limpa o teste nem modifica a validação do exercício.

Scenario Schema v1 aceita o campo opcional `profile` por equipamento, fora de `config`; exportações novas o incluem. Arquivos antigos sem esse campo carregam como `generic`, nos formatos legado e dinâmico. Profiles desconhecidos ou incompatíveis com o tipo são rejeitados. Save/Load, Import/Export, presets e exercícios usam a mesma API do modelo e preservam esse campo. O estado administrativo da interface do PC usa `config.portSettings` opcional, também retrocompatível.

### Exercise Engine v1

Em `/troubleshooting/`, o aluno escolhe **IPv4**, **VLAN Access**, **Trunk 802.1Q**, **Routing**, **Rotas estáticas**, **Rede externa**, **NAT/PAT**, **DHCP, DNS e serviços** ou **Diagnóstico misto**, em Intermediate (uma falha) ou Advanced (duas falhas independentes). A família de serviços parte de L2/L3 funcional e varia servidor ou opções DHCP, DNS do cliente, registro A e porta/estado da aplicação; Advanced combina uma falha de aquisição ou nome com uma falha de serviço. A família Rotas estáticas usa dois roteadores; Rede externa usa o caminho funcional do preset ISP como base e introduz rota padrão ausente, next hop incorreto ou rota de retorno ausente. NAT/PAT parte de uma rede externa funcional, mas sem rota de retorno para a LAN privada, e varia ausência de NAT, papéis inside/outside, rede de origem da política ou caminho de volta ao IPv4 público. A seed reproduz exatamente a instância na mesma família/dificuldade. O identificador antigo `ipv4-connectivity` continua compatível com links anteriores.

`generateExercise` valida a rede-base pelo simulador, aplica falhas, verifica cada falha isoladamente e confirma a interrupção e as correções parciais. Candidatos incoerentes são descartados em até 64 tentativas determinísticas derivadas da seed. IPv4 varia IPs válidos, máscaras e gateways; Access varia portas de origem/destino; Trunk varia allowed lists em uma ponta ou cabo desconectado; Routing varia gateway, IP/máscara ou conexão das interfaces físicas. Rotas estáticas usa dois roteadores e varia rota ausente ou next hop incorreto na ida ou volta. Rede externa parte do preset funcional e varia rota padrão ausente, próximo salto incorreto ou retorno ausente; em Advanced, há uma falha de ida e outra de volta. Mixed sorteia as famílias anteriores de L2/L3 básico em Intermediate e pares de famílias diferentes em Advanced. O Trunk Advanced transporta os dois segmentos de uma entrega roteada no mesmo enlace, permitindo duas restrições independentes de VLAN.

As instâncias públicas contêm título, enunciado, objetivo, seed, dificuldade e cenário Schema v1. Base, falhas e invariantes ficam em um `WeakMap` privado; não são exportados para a UI nem para JSON/localStorage. `inspectExercise` existe somente no módulo CommonJS para testes Node. `validateExercise` avalia novamente o estado atual e exige preservar equipamentos, identidades, cabos essenciais, endereçamento dos hosts (IPv4 e Mixed permitem corrigir dentro das redes previstas), VLANs e a função L3 quando necessária. `presentResult` neutraliza a indicação da ponta culpada do trunk no exercício; no modo operacional também retira o destaque visual de outros eventos de falha, preservando o resultado integral do simulador na bancada livre. O feedback acompanha a etapa real da interrupção; corrigir uma falha revela a restante. O Attempt Engine salva progresso local separado de Meus cenários, sem mudar as regras do Exercise Engine. Os testes existentes do engine também percorrem todas as famílias, seeds, bases, correções completas/parciais, atalhos rejeitados e o bundle de navegador sem metadados de resposta.

No **modo operacional**, selecionado na lista de troubleshooting, a seed também determina profiles compatíveis: Cisco + Windows, Cisco + Linux, Dell + Windows (roteador Cisco quando necessário), MikroTik + hosts ou ambiente misto. Topologias sem roteador não recebem a variante MikroTik. A bancada abre o terminal como primeira aba de cada equipamento; a GUI continua disponível para editar cabos e configurações, mas não destaca o equipamento ou a interface culpada no evento de falha. O aluno recebe evidências do percurso e dos comandos, enquanto `validateExercise` continua usando somente o estado real da rede e as invariantes. `recordCommand` e `attemptAnalysis` mantêm o registro em memória durante a sessão; o Attempt Engine guarda uma cópia limitada dos comandos para retomar a investigação, fora do Scenario Schema. O registro não é critério de aprovação. Reiniciar limpa o registro; gerar nova variação cria outra tentativa.

Resposta esperada, correção, pistas e condição de sucesso não pertencem ao Schema v1. O terminal integrado consulta o mesmo modelo da bancada, sem manter estado de rede paralelo.

### Attempt Engine v1

`static/js/integrated-lab-attempts.js` é independente do DOM e usa a chave `netstudy:attempts:v1` no `localStorage`, separada de `netstudy:integrated-lab:scenarios:v1`. O **Attempt Schema v1** registra `schemaVersion`, `attemptId`, `exerciseId`, `generatorVersion`, `seed`, `difficulty`, `mode`, `status` (`not_started`, `in_progress`, `completed`), `initialScenario`, `currentScenario`, `startedAt`, `updatedAt`, `completedAt`, `progress` e `checks`. `progress` contém `stepId`, respostas e evidências resumidas para etapas futuras, comandos limitados, estado limitado dos terminais e a referência ao último percurso/evento. `checks` guarda data, categoria e feedback de cada verificação, não eventos completos ou tabelas ARP/MAC. Não há gabaritos ou metadados privados no Attempt Schema ou no Scenario Schema.

Ao retomar, o módulo exige `generatorVersion` compatível, chama o Exercise Engine com a mesma família/seed/dificuldade/modo, compara o cenário inicial gerado ao salvo e valida o cenário editado pelo modelo. Se a definição mudou, a tentativa é preservada e a retomada é recusada explicitamente; ela não é regenerada em silêncio. O percurso de comunicação pode ser recalculado da configuração e o índice do evento é restaurado; resultados completos não são armazenados. Configurações alteradas por GUI ou CLI, histórico resumido de comandos e feedback de verificação são salvos automaticamente. A lista oferece continuar, nova variação independente, reiniciar com a mesma seed e descartar com confirmação. Erros de leitura, corrupção ou quota são mostrados ao aluno sem apagar os dados; se uma edição não pôde ser salva, a página avisa antes de sair.

Esta persistência é **local ao navegador/perfil**: limpar os dados do navegador remove as tentativas, e não há sincronização ou recuperação em outra máquina. Checkpoints e atividades ARP/MAC continuam com seus próprios fluxos; o Attempt Engine v1 cobre apenas os exercícios da bancada. A lista integradora e o orquestrador de múltiplas etapas ainda não foram implementados.

**Fora do escopo desta etapa:** protocolos de roteamento dinâmico, progresso permanente, ranking, pontuação, dicas automáticas complexas, NAT estático ou para TCP/UDP, DHCP relay, TCP/UDP completos, HTTP real, acesso à Internet real, router-on-a-stick, autoplay, autenticação e persistência no Django. Terminais e laboratórios das aulas são demonstrações independentes.

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
| Continuidade dos exercícios | static/js/integrated-lab-attempts.js, static/js/practice-attempts.js, templates/learning/troubleshooting.html |
| Testes Django | learning/tests.py, learning/test_integrated_lab.py |
| Testes Node do laboratório | static/js/integrated-lab-model.test.js, static/js/integrated-lab-simulator.test.js, static/js/integrated-lab-l3-routing.test.js, static/js/integrated-lab-traceroute.test.js, static/js/integrated-lab-nat.test.js, static/js/integrated-lab-services.test.js, static/js/integrated-lab-scenario.test.js, static/js/integrated-lab-storage.test.js, static/js/integrated-lab-presets.test.js, static/js/integrated-lab-exercise-engine.test.js, static/js/integrated-lab-dynamic.test.js |
| CI | .github/workflows/ci.yml (push e pull request para main) |

Antes de editar uma página, leia o template, os partials incluídos, os CSS/JS carregados ao fim do template e a view que fornece o contexto. Alguns dados de exemplo são definidos na view (como as rotas de /tabela-de-rotas/); outros ficam nos componentes JS. Verifique sempre o estado atual do Git, pois mudanças de outra tarefa podem estar presentes na árvore de trabalho.

## Terminal Engine v1

`static/js/integrated-lab-terminal.js` é independente do DOM. `createSession(device, profile)` cria uma sessão; `execute(session, command, labState)` consulta o equipamento e o profile atuais na bancada. O registry separa comandos por tipo/profile e modo, com fallback genérico. Contextos guardam apenas IDs de equipamento/interface, sem cópias de IP, VLAN, ARP, MAC ou rotas.

O popover persistente tem abas Configuração e Terminal. Nos profiles genéricos estão disponíveis `help`, `clear` e `exit`; Enter executa e ↑/↓ percorrem o histórico. Cada equipamento mantém sua própria sessão em memória ao fechar/reabrir o popover. Carregar ou reiniciar a bancada limpa as sessões; elas não fazem parte do Scenario Schema nem do localStorage. `exit` encerra a sessão e permite iniciar outra sem alterar a rede. Limites: 512 caracteres por comando, 100 entradas de histórico e 200 linhas de saída.

### Cisco IOS-like v1

`static/js/integrated-lab-cisco.js` registra consultas e configuração para switches e routers `cisco-ios`. `enable` entra em EXEC privilegiado (`nome#`); `disable` retorna a EXEC usuário (`nome>`). `?`, `help`, `show ?` e `show interfaces ?` listam os comandos do contexto. São aceitos comandos completos, sem abreviações. `show running-config` exige EXEC privilegiado; consultas são aceitas em EXEC usuário e privilegiado. `configure terminal` abre `(config)#`; `interface <interface>` abre `(config-if)#`. `hostname`, descrições, modo/VLAN Access, allowed list, IPv4 de roteador e shutdown/no shutdown chamam as APIs do modelo de bancada. O prompt, a GUI, a simulação e `show running-config` leem essas mesmas configurações. As mudanças são invalidadas no teste atual e preservadas pelo Scenario Schema v1; `interfaceModes` e `portSettings` são campos opcionais retrocompatíveis.

- Switch: `show interfaces`, `show interfaces status`, `show vlan brief`, `show interfaces trunk`, `show mac address-table`, `show running-config`, `show arp`.
- Router: `show ip interface brief`, `show interfaces`, `show ip route`, `show arp`, `show running-config`, `ping <ip>` e `traceroute <ip>`.

O adapter lê configuração e cabos atuais; tabelas MAC e ARP vêm exclusivamente do evento selecionado, passado como `labState.observation` por referência. Sem evento, não há entradas dinâmicas. O switch L2 não tem SVI/cache ARP. Rotas C/L são derivadas de interfaces conectadas com IPv4/máscara válidos. `ip route <rede> <máscara> <next-hop>` e `no ip route ...` configuram rotas S no estado da bancada; `show ip route` e `show running-config` refletem essas rotas. Os outputs são representações educacionais, não emulação completa de IOS.

### Dell SmartFabric OS10-like v1

`static/js/integrated-lab-dell.js` registra comandos para switches `dell-os10`, com prompts `nome#`, `nome(config)#` e `nome(conf-if-eth1/1/n)#`. Consulte `show interface status`, `show interface`, `show vlan`, `show mac address-table` e `show running-configuration`. `show ip interface brief` informa que o switch L2 da bancada não possui SVI nem IPv4 de gerência. A tabela MAC mostra somente entradas aprendidas até o evento selecionado; status, VLANs e configuração vêm do estado atual da bancada.

Use `configure terminal`, `interface ethernet1/1/<n>`, `switchport mode access|trunk`, `switchport access vlan <id>`, `switchport trunk allowed vlan <lista>`, `shutdown`, `no shutdown` e `hostname <nome>`. `exit` sobe um modo e `end` retorna ao EXEC. O adapter Dell interpreta os comandos e formata as saídas; `static/js/integrated-lab-switch-cli.js` aplica as mutações de porta/VLAN compartilhadas com o adapter Cisco pelo mesmo modelo da GUI. A lista Allowed VLANs continua global ao switch nesta versão da bancada, não individual por trunk. Não há configuração de SVI ou roteamento no profile Dell.

### MikroTik RouterOS-like v1

`static/js/integrated-lab-routeros.js` registra os menus `/interface`, `/ip` e `/system` para roteadores com profile `mikrotik-routeros`, com prompt `[admin@nome] >`. As consultas `/interface print`, `/interface ethernet print`, `/ip address print`, `/ip route print`, `/ip arp print` e `/system identity print` leem a configuração e o evento selecionado. `R` e `X` indicam interface operacional e desabilitada; `/ip route print` mostra rotas conectadas e estáticas. O índice de `/ip address print` identifica o endereço na listagem atual.

Para configurar, use `/system identity set name=<nome>`, `/interface set <iface> disabled=yes|no`, `/ip address remove <índice>` e `/ip address add address=<IPv4/prefixo> interface=<iface>`. A bancada suporta um IPv4 por interface: remova o endereço atual antes de adicionar outro. Essas ações chamam o modelo da bancada, atualizando imediatamente a GUI, o teste de rede e o Scenario Schema v1. `/ip route add dst-address=<IPv4/prefixo> gateway=<IPv4>` e `/ip route remove <IPv4/prefixo>` alteram rotas estáticas reais do simulador. Trata-se de um subconjunto educacional, sem outros recursos RouterOS.

### Terminais de hosts Windows e Linux

`static/js/integrated-lab-host.js` registra consultas e configuração dos PCs. Windows oferece `hostname`, `ipconfig`, `ipconfig /all`, `arp -a`, `route print`, `ping` e `tracert`. Linux oferece `hostname`, `ip addr`, `ip link`, `ip route`, `ip neigh`, `ping` e `traceroute`. ARP/neighbor mostra apenas associações aprendidas até o evento selecionado. `ping <IPv4>` executa uma tentativa ICMP no grafo; `tracert <IPv4>` e `traceroute <IPv4>` executam sondas ICMP distintas com TTL crescente e abrem seus eventos no mesmo histórico.

Para Windows, a sintaxe **educacional simplificada** de configuração é `netsh interface ipv4 set address name=Ethernet static <IPv4> <máscara> [gateway|none]`. O gateway omitido ou `none` remove a configuração anterior. DHCP não é implementado. No Linux, use `ip addr add <IPv4>/<prefixo> dev eth0`, `ip addr del <IPv4>/<prefixo> dev eth0`, `ip route add default via <IPv4> dev eth0`, `ip route del default` e `ip link set eth0 up|down`. A bancada modela um único IPv4 e uma rota padrão por PC: `addr add` substitui o endereço atual e `route add default` substitui o gateway atual. A GUI, o simulador, o Scenario Schema v1 e as consultas do terminal leem os mesmos campos.

### ICMP/Ping integrado

`simulator.ping(input, destinationIp, options)` usa os cabos operacionais, VLANs Access, allowed lists do trunk, interfaces dos roteadores e rotas conectadas/estáticas. Uma tentativa envia Echo Request, resolve MAC por ARP quando necessário, encaminha por switches e pelos roteadores, reduz TTL a cada salto L3 e só retorna `reply` após o Echo Reply alcançar a origem. O retorno usa as rotas reais de cada roteador; gateway ou VLAN incorretos na volta produzem `timeout`. O motor também distingue `destination-unreachable`, `ttl-expired` e execução interrompida por limite. As associações ARP e entradas MAC são aprendidas durante a tentativa e registradas nos snapshots de cada evento. Windows, Linux e roteadores Cisco usam essa mesma API; o switch L2 Cisco informa que não possui interface IP/SVI para originar ping.

Esta versão executa **uma tentativa de ping por comando**, sem estimar RTT ou perda estatística. `simulator.traceroute(input, destino, {maxHops})` envia uma sonda ICMP por TTL (1–12 por padrão, limite 30). Um roteador descarta a sonda quando o TTL expira e envia um novo ICMP Time Exceeded com TTL próprio; o salto só é identificado se essa resposta voltar. Na chegada ao destino, o Echo Reply também precisa retornar. `*` significa ausência de resposta observada, sem determinar a causa. Rotas ausentes podem gerar Destination Unreachable quando a mensagem retorna. Roteadores podem ser ligados por interfaces físicas roteadas; o motor escolhe o prefixo mais longo, usa `0.0.0.0/0` quando aplicável e exige rota de retorno. `staticRoutes` é opcional no Scenario Schema v1. Protocolos dinâmicos não estão implementados.

## Verificação

No Windows com .venv preparado:

~~~powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py test
node static/js/integrated-lab-model.test.js
node static/js/integrated-lab-profiles.test.js
node static/js/integrated-lab-terminal.test.js
node static/js/integrated-lab-cisco.test.js
node static/js/integrated-lab-dell.test.js
node static/js/integrated-lab-host.test.js
node static/js/integrated-lab-routeros.test.js
node static/js/integrated-lab-ping.test.js
node static/js/integrated-lab-l3-routing.test.js
node static/js/integrated-lab-traceroute.test.js
node static/js/integrated-lab-nat.test.js
node static/js/integrated-lab-services.test.js
node static/js/integrated-lab-simulator.test.js
node static/js/integrated-lab-scenario.test.js
node static/js/integrated-lab-storage.test.js
node static/js/integrated-lab-presets.test.js
node static/js/integrated-lab-exercise-engine.test.js
node static/js/integrated-lab-attempts.test.js
node static/js/practice-attempts.test.js
node static/js/integrated-lab-operational.test.js
node static/js/integrated-lab-dynamic.test.js
node --check static/js/integrated-lab-model.js
node --check static/js/integrated-lab-profiles.js
node --check static/js/integrated-lab-terminal.js
node --check static/js/integrated-lab-cisco.js
node --check static/js/integrated-lab-switch-cli.js
node --check static/js/integrated-lab-dell.js
node --check static/js/integrated-lab-host.js
node --check static/js/integrated-lab-routeros.js
node --check static/js/integrated-lab-simulator.js
node --check static/js/integrated-lab.js
node --check static/js/integrated-lab-storage.js
node --check static/js/integrated-lab-presets.js
node --check static/js/integrated-lab-exercise-engine.js
node --check static/js/integrated-lab-attempts.js
node --check static/js/practice-attempts.js
git diff --check
~~~

Os testes Django cobrem páginas, endpoints e checkpoints. Os testes Node cobrem o modelo, o simulador e o round-trip/isolamento/rejeições do Scenario Schema v1. O CI repete esses comandos em Linux com Python 3.11 e Node 22. Para mudanças visuais ou de interação, confira também a página no navegador em desktop e largura móvel (360 px é uma referência usada no projeto). Este mapa não substitui a inspeção do código nem a validação do comportamento alterado.
