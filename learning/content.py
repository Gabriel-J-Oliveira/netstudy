STAGES = [
    ("conceito", "Conceito"), ("compreender", "Compreender"),
    ("diferenciar", "Diferenciar"), ("raciocinar", "Raciocinar"),
    ("aplicacao", "Aplicação prática"),
    ("diagnosticar", "Diagnosticar"), ("explicar", "Explicar"),
]

ACTIVITIES = [
    {"id": "1", "number": "Atividade 1", "stage": "compreender", "type": "multiple_choice", "question": "Qual informação o ARP está tentando descobrir?", "options": [
        ("A", "O endereço IPv4 do destino"), ("B", "O endereço MAC correspondente a um IPv4 conhecido"),
        ("C", "A porta TCP utilizada pela aplicação"), ("D", "A rota completa até o destino")], "correct": "B", "feedback": {
        "B": "Correto. O dispositivo já conhece o IPv4 que deseja alcançar. O ARP é utilizado para descobrir qual endereço MAC deve ser usado localmente para representar aquele destino ou próximo salto.",
        "A": "O ARP não está tentando descobrir o IPv4. Neste cenário, o IPv4 já é conhecido e é justamente a informação utilizada para perguntar qual MAC corresponde a ele.",
        "C": "Portas TCP pertencem ao transporte entre aplicações e não são resolvidas pelo ARP.",
        "D": "A escolha de rotas é uma função de roteamento. ARP resolve uma associação local entre IPv4 e endereço MAC."}},
    {"id": "2", "number": "Atividade 2", "stage": "compreender", "type": "true_false", "question": "Um ARP Request normalmente é enviado como broadcast na rede local.", "options": [("verdadeiro", "Verdadeiro"), ("falso", "Falso")], "correct": "verdadeiro", "feedback": {
        "verdadeiro": "Correto. Como o emissor ainda não sabe qual dispositivo possui o IPv4 procurado, o ARP Request precisa ser visto pelos dispositivos daquele domínio de broadcast.",
        "falso": "Falso seria incorreto porque, antes de receber a resposta, o emissor ainda não conhece o MAC específico para o qual poderia enviar uma consulta unicast."}},
    {"id": "3", "number": "Atividade 3", "stage": "compreender", "type": "classify_choice", "question": "Qual destas relações representa uma associação mantida em uma tabela ARP?", "options": [
        ("ip_mac", "IPv4 → MAC"), ("nome_ip", "Nome → IPv4"), ("mac_porta", "MAC → porta do switch"), ("app_tcp", "Aplicação → porta TCP")], "correct": "ip_mac", "visual": True, "feedback": {
        "ip_mac": "Exatamente. Uma entrada ARP associa um endereço IPv4 conhecido ao endereço MAC correspondente na rede local.",
        "nome_ip": "Essa relação está associada à resolução de nomes, como ocorre com DNS, e não ao ARP.",
        "mac_porta": "Essa é a lógica de uma tabela MAC de switch, não de uma tabela ARP.",
        "app_tcp": "Essa relação pertence ao contexto de transporte e aplicações, não à resolução ARP."}},
    {"id": "4", "number": "Atividade 4", "stage": "diferenciar", "type": "classify_choice", "presented": "192.168.10.20 → BB:BB:BB:BB:BB:BB", "question": "Essa associação pertence conceitualmente a qual estrutura?", "options": [("arp", "Tabela ARP de um host"), ("mac", "Tabela MAC de um switch")], "correct": "arp", "feedback": {
        "arp": "Correto. Há uma associação entre IPv4 e MAC, característica de uma tabela ARP.",
        "mac": "Uma tabela MAC de switch não usa IPv4 como chave dessa associação. Ela aprende MACs e relaciona cada um às portas do switch."}},
    {"id": "5", "number": "Atividade 5", "stage": "diferenciar", "type": "classify_choice", "presented": "BB:BB:BB:BB:BB:BB → Gi0/7", "question": "Essa associação pertence conceitualmente a qual estrutura?", "options": [("arp", "Tabela ARP de um host"), ("mac", "Tabela MAC de um switch")], "correct": "mac", "feedback": {
        "mac": "Correto. O switch associa um endereço MAC a uma interface pela qual aquele MAC pode ser alcançado.",
        "arp": "Uma tabela ARP associa IPv4 a MAC. Como esta informação associa MAC a uma porta física ou lógica do switch, trata-se de uma entrada da tabela MAC."}},
    {"id": "6", "number": "Atividade 6", "stage": "raciocinar", "type": "multiple_choice", "config": {"PC-A": ["IP: 192.168.10.25/24", "Gateway: 192.168.10.1"], "Destino": ["192.168.10.80"]}, "question": "Antes de enviar o frame, qual MAC PC-A precisa descobrir para alcançar diretamente esse destino?", "options": [("A", "MAC de 192.168.10.80"), ("B", "MAC de 192.168.10.1"), ("C", "MAC do switch"), ("D", "MAC do servidor DNS")], "correct": "A", "feedback": {
        "A": "Correto. 192.168.10.25/24 e 192.168.10.80/24 pertencem à mesma sub-rede. O destino pode ser alcançado diretamente na rede local, então PC-A precisa descobrir o MAC do próprio host 192.168.10.80.",
        "B": "O gateway seria relevante para um destino que precisasse ser alcançado através de outra rede. Neste exercício, origem e destino estão na mesma sub-rede.",
        "C": "O computador não usa o MAC do switch como destino apenas porque o frame passa fisicamente pelo switch. O frame é destinado ao host que deve recebê-lo.",
        "D": "O servidor DNS não participa desta decisão. O endereço IPv4 de destino já é conhecido."}},
    {"id": "7", "number": "Atividade 7", "stage": "raciocinar", "type": "multiple_choice", "config": {"PC-A": ["IP: 192.168.10.25/24", "Gateway: 192.168.10.1"], "Destino": ["8.8.8.8"]}, "question": "Qual endereço IPv4 local PC-A utilizará no ARP para obter o MAC necessário para iniciar essa comunicação?", "options": [("A", "8.8.8.8"), ("B", "192.168.10.25"), ("C", "192.168.10.1"), ("D", "O endereço do servidor DNS")], "correct": "C", "feedback": {
        "C": "Correto. 8.8.8.8 não pertence à rede local de PC-A. O host precisa encaminhar o tráfego ao seu gateway 192.168.10.1. Portanto, localmente, precisa descobrir o MAC correspondente ao IPv4 do gateway.",
        "A": "PC-A não tenta obter diretamente via ARP o MAC de 8.8.8.8, porque esse destino não está em sua rede local.",
        "B": "192.168.10.25 é o próprio endereço do PC-A. Ele precisa descobrir o MAC do próximo dispositivo que receberá o frame.",
        "D": "DNS não determina o próximo salto dessa comunicação. Neste exemplo o destino já é fornecido diretamente como endereço IPv4."}},
    {"id": "diagnostico", "number": "Chamado", "stage": "diagnosticar", "type": "multiple_choice", "ticket": True, "question": "Qual conclusão é mais bem sustentada pelas evidências disponíveis?", "options": [
        ("A", "O DNS está necessariamente com problema"), ("B", "PC01 está enviando solicitações ARP, mas não está recebendo uma resposta para 192.168.10.30"),
        ("C", "O gateway está necessariamente configurado incorretamente"), ("D", "O TCP handshake está falhando")], "correct": "B", "feedback": {
        "B": "Correto. As capturas mostram repetidas solicitações perguntando quem possui 192.168.10.30, sem uma resposta correspondente apresentada. Isso indica que a resolução ARP para esse host não está sendo concluída. A próxima investigação deveria permanecer inicialmente na comunicação local e em causas capazes de impedir essa resposta.",
        "A": "O teste utiliza diretamente um endereço IPv4. Não há evidência apresentada de uma tentativa de resolução de nome, portanto DNS não explica os dados observados.",
        "C": "Os dois endereços apresentados pertencem à mesma sub-rede /24. Para essa comunicação direta, o gateway não é o primeiro elemento necessário.",
        "D": "O problema observado ocorre antes de termos evidência de uma sessão TCP. O host ainda está tentando resolver o endereço MAC necessário para a comunicação local."},
        "after": "Diagnóstico técnico não é adivinhar a causa. Primeiro identificamos o que as evidências permitem afirmar."},
    {"id": "8", "number": "Atividade 8", "stage": "explicar", "type": "ordering", "question": "Ordene os eventos do fluxo conceitual do ARP.", "items": [
        "O computador aprende o endereço MAC.", "O computador conhece o IPv4 de destino.", "O computador pode montar o frame Ethernet destinado ao MAC correto.", "O computador envia um ARP Request.", "O dispositivo correspondente envia um ARP Reply."],
        "correct_order": ["O computador conhece o IPv4 de destino.", "O computador envia um ARP Request.", "O dispositivo correspondente envia um ARP Reply.", "O computador aprende o endereço MAC.", "O computador pode montar o frame Ethernet destinado ao MAC correto."],
        "correct_feedback": "Correto. Essa sequência representa o fluxo conceitual básico usado para resolver um endereço IPv4 local em um endereço MAC antes da transmissão Ethernet.",
        "wrong_feedback": "O ARP Request só faz sentido depois que existe um IPv4 conhecido a ser resolvido. O ARP Reply fornece o MAC, que então pode ser utilizado na construção do frame.", "scored": False},
    {"id": "9", "number": "Atividade 9", "stage": "explicar", "type": "self_explanation", "question": "Com suas próprias palavras, explique por que um computador precisa de ARP para falar com outro host IPv4 na mesma rede Ethernet quando ainda não conhece seu MAC.",
        "reference": "O computador conhece o IPv4 do destino, mas precisa de um endereço MAC para enviar um frame Ethernet localmente. O ARP permite descobrir qual MAC corresponde àquele IPv4. Depois dessa resolução, o computador consegue usar esse MAC como destino do frame.",
        "guidance": "Compare sua explicação com a resposta de referência. O objetivo não é usar exatamente as mesmas palavras, mas conseguir explicar a relação entre IPv4 conhecido, MAC desconhecido, ARP e transmissão Ethernet.", "scored": False},
]

NEW_ACTIVITIES = [
    {"id": "find-inconsistency", "number": "Encontrar a inconsistência", "stage": "diferenciar", "type": "find_inconsistency",
        "title": "Qual informação não combina com o conceito?", "question": "Qual tabela representa uma tabela ARP?",
        "tables": {
            "Tabela A": ["192.168.10.1  → AA:AA:AA:AA:AA:AA", "192.168.10.30 → BB:BB:BB:BB:BB:BB", "192.168.10.80 → CC:CC:CC:CC:CC:CC"],
            "Tabela B": ["AA:AA:AA:AA:AA:AA → Gi0/1", "BB:BB:BB:BB:BB:BB → Gi0/7", "CC:CC:CC:CC:CC:CC → Gi0/12"],
        },
        "options": [("A", "Tabela A"), ("B", "Tabela B")], "correct": "A",
        "feedback": {"A": "Correto. A Tabela A relaciona IPv4 → MAC, característica de uma tabela ARP.", "B": "A Tabela B associa MAC → porta de switch. Isso representa conceitualmente uma tabela MAC do switch, e não uma tabela ARP."},
        "misconceptions": {"B": "confuses_arp_with_mac_table"},
        "after_comparison": [("ARP", "IPv4 → MAC"), ("MAC TABLE", "MAC → PORTA")]},
    {"id": "command-fill", "number": "Completar comando", "stage": "aplicacao", "type": "command_fill", "title": "Consultando a tabela ARP",
        "context": "Você está em um computador Windows e quer visualizar as associações IPv4 → MAC atualmente conhecidas pelo sistema.",
        "prompt_before": "C:\\> arp ", "correct": "-a",
        "feedback": {
            "correct": "Correto. `arp -a` exibe as entradas ARP conhecidas pelo computador, permitindo observar associações entre endereços IPv4 e endereços físicos MAC.",
            "-d": "`arp -d` está relacionado à remoção de entradas da tabela ARP. Neste cenário você quer consultar as entradas existentes, não apagá-las.",
            "a": "Você identificou a letra utilizada pela opção correta, mas no comando do Windows ela precisa ser utilizada como parâmetro com hífen.",
            "other": "Esse parâmetro não corresponde à consulta da tabela ARP solicitada no cenário. Pense em qual opção do comando `arp` exibe as associações atualmente conhecidas.",
        },
        "hint": "O parâmetro procurado começa com `-` e utiliza a letra associada a “all”."},
    {"id": "command-output", "number": "Interpretar saída", "stage": "aplicacao", "type": "command_output", "title": "O que esta saída demonstra?",
        "terminal": "C:\\> arp -a\n\nInterface: 192.168.10.25 --- 0x8\n\nInternet Address      Physical Address\n192.168.10.1          aa-bb-cc-dd-ee-ff\n192.168.10.80         11-22-33-44-55-66",
        "question": "Qual conclusão podemos tirar especificamente sobre 192.168.10.80?",
        "options": [("A", "O computador conhece uma associação entre 192.168.10.80 e o MAC 11-22-33-44-55-66."), ("B", "O switch obrigatoriamente encaminha 192.168.10.80 pela porta 11."), ("C", "192.168.10.80 é necessariamente o gateway."), ("D", "O computador estabeleceu uma conexão TCP com 192.168.10.80.")],
        "correct": "A", "feedback": {
            "A": "Correto. A tabela apresentada contém uma associação entre o IPv4 192.168.10.80 e o endereço físico 11-22-33-44-55-66.",
            "B": "A saída não mostra a tabela MAC de um switch nem informa portas de switch. O valor apresentado é um endereço MAC associado ao IPv4.",
            "C": "A existência de uma entrada ARP não transforma aquele host em gateway. A saída apenas mostra uma associação IPv4 → MAC conhecida localmente.",
            "D": "Uma entrada ARP não comprova a existência de uma conexão TCP. ARP ocorre em um nível anterior à comunicação entre aplicações.",
        }, "misconceptions": {"B": "confuses_arp_with_mac_table"},
        "hint": "Observe os títulos `Internet Address` e `Physical Address`. Pense em qual tipo de associação esses dois campos representam."},
    {"id": "evidence-analysis", "number": "Análise de evidências", "stage": "diagnosticar", "type": "evidence_analysis", "title": "O que sabemos e o que estamos supondo?",
        "scenario": ["PC01: 192.168.10.20/24", "PC02: 192.168.10.30/24"],
        "capture": "Who has 192.168.10.30? Tell 192.168.10.20\nWho has 192.168.10.30? Tell 192.168.10.20\nWho has 192.168.10.30? Tell 192.168.10.20",
        "capture_note": "Nenhum ARP Reply foi observado durante a captura.",
        "statements": [
            {"id": "1", "text": "PC01 está enviando ARP Requests procurando 192.168.10.30.", "correct": "evidence", "explanation": "Isso aparece diretamente na captura apresentada."},
            {"id": "2", "text": "Durante a captura apresentada, não observamos um ARP Reply correspondente.", "correct": "evidence", "explanation": "A ausência do Reply na captura é uma observação dos dados disponíveis."},
            {"id": "3", "text": "PC02 está desligado.", "correct": "hypothesis", "explanation": "Um equipamento desligado poderia produzir esse sintoma, mas os dados apresentados não provam que essa seja a causa."},
            {"id": "4", "text": "Existe algum problema impedindo a resolução ARP de ser concluída nesse momento.", "correct": "evidence", "explanation": "Os Requests estão sendo emitidos e nenhuma resposta correspondente foi observada, portanto a resolução não está sendo concluída no cenário apresentado. Isso ainda não identifica a causa raiz."},
        ],
        "after": "Diagnóstico técnico começa separando o que os dados demonstram daquilo que ainda é apenas uma possível explicação."},
]

ACTIVITIES.extend(NEW_ACTIVITIES)
_ORDER = ["1", "2", "3", "4", "5", "find-inconsistency", "6", "7", "command-fill", "command-output", "diagnostico", "evidence-analysis", "8", "9"]
ACTIVITIES.sort(key=lambda item: _ORDER.index(item["id"]))

DEFAULT_HINT = "TODO: pista pedagógica ainda não fornecida para esta atividade."
for activity in ACTIVITIES:
    if "options" in activity:
        misconceptions = activity.get("misconceptions", {})
        activity["options"] = [
            {"key": key, "text": text, "feedback": activity.get("feedback", {}).get(key, ""), "misconception_code": misconceptions.get(key)}
            for key, text in activity["options"]
        ]
        activity.setdefault("hint", DEFAULT_HINT)

ACTIVITY_MAP = {a["id"]: a for a in ACTIVITIES}


RAPID_FIRE = [
    {"id": "1", "question": "ARP relaciona IPv4 com qual tipo de endereço?", "options": ["MAC", "DNS", "TCP", "VLAN"], "correct": "MAC", "feedback": "IPv4 → MAC é a associação fundamental do ARP."},
    {"id": "2", "question": "“Who has 192.168.10.30?” representa:", "options": ["ARP Request", "ARP Reply"], "correct": "ARP Request", "feedback": "É uma pergunta procurando quem possui determinado IPv4."},
    {"id": "3", "presented": "192.168.10.30 → BB:BB:BB:BB:BB:BB", "question": "ARP ou tabela MAC do switch?", "options": ["ARP", "Tabela MAC do switch"], "correct": "ARP", "feedback": "IPv4 → MAC caracteriza uma associação ARP."},
    {"id": "4", "presented": "BB:BB:BB:BB:BB:BB → Gi0/7", "question": "ARP ou tabela MAC do switch?", "options": ["ARP", "Tabela MAC do switch"], "correct": "Tabela MAC do switch", "feedback": "MAC → porta é uma associação típica da tabela MAC do switch."},
    {"id": "5", "question": "O destino está fora da sub-rede local. Qual MAC o host normalmente precisa descobrir primeiro?", "options": ["MAC do host remoto", "MAC do gateway"], "correct": "MAC do gateway", "feedback": "O frame local precisa ser entregue ao próximo salto, normalmente o gateway."},
    {"id": "6", "question": "Um ARP Request normalmente é:", "options": ["Broadcast", "Unicast"], "correct": "Broadcast", "feedback": "O emissor ainda não conhece o MAC específico que está procurando."},
    {"id": "7", "prompt_before": "C:\\> arp ", "question": "Complete o comando:", "type": "fill", "correct": "-a", "feedback": "`arp -a` exibe as associações ARP conhecidas."},
    {"id": "8", "presented": "Nome do host → IPv4", "question": "ARP ou DNS?", "options": ["ARP", "DNS"], "correct": "DNS", "feedback": "Resolução de nomes pertence ao papel do DNS, não do ARP."},
    {"id": "9", "presented": "IPv4 → MAC", "question": "ARP ou DNS?", "options": ["ARP", "DNS"], "correct": "ARP", "feedback": "Essa é a relação fundamental tratada pelo ARP."},
    {"id": "10", "presented": "PC-A: 192.168.1.10/24\nPC-B: 192.168.1.20/24", "question": "PC-A precisa descobrir o MAC do gateway ou de PC-B?", "options": ["Gateway", "PC-B"], "correct": "PC-B", "feedback": "Os dois hosts estão na mesma sub-rede, portanto a entrega pode ser direta."},
    {"id": "11", "question": "ARP descobre diretamente o MAC de um servidor localizado em outra rede?", "options": ["Sim", "Não"], "correct": "Não", "feedback": "Para destinos remotos, o MAC relevante localmente pertence ao próximo salto."},
    {"id": "12", "presented": "ARP Request\nARP Request\nARP Request\nnenhum ARP Reply observado", "question": "Podemos afirmar que o computador remoto está desligado?", "options": ["Sim", "Não"], "correct": "Não", "feedback": "Podemos afirmar que a resolução não está sendo concluída, mas ainda não sabemos a causa."},
]
