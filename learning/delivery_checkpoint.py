"""Checkpoint Unicast × Broadcast: decisões de entrega baseadas em evidências."""


def token(key, text):
    return {"id": key, "text": text}


def slot(key, label, many=False):
    value = {"id": key, "label": label}
    if many:
        value["capacity"] = "many"
    return value


COMMON_HINTS = [
    "Inspecione o próprio frame antes de concluir pelo número de portas.",
    "Compare o Destination MAC com a MAC Address Table.",
]


ACTIVITIES = [
    {
        "id": "1", "number": 1, "primary": "UNICAST", "related": ["SWITCH", "MAC", "FRAME"],
        "category": "Aplicar", "difficulty_level": 3, "type": "known_unicast", "mode": "exercise", "scenario_key": "delivery-a1",
        "title": "Known Unicast", "symptom": "Destination BB entra por Gi0/1; a tabela possui BB → Gi0/4.",
        "instruction": "Inspecione Destination, selecione a entrada BB, clique Gi0/4 e execute.", "tools": ["board"],
        "required_actions": ["field:destination", "mac:BB:BB:BB:BB:BB:BB", "port:4", "frame:run"], "required_evidence": [],
        "slots": [slot("destination", "DESTINATION"), slot("entry", "ENTRADA DA TABELA"), slot("egress", "SAÍDA")],
        "tokens": [token("bb", "Destination BB"), token("bb4", "BB → Gi0/4"), token("g4", "Gi0/4"), token("g2", "Gi0/2")],
        "correct_map": {"bb": "destination", "bb4": "entry", "g4": "egress"},
        "feedback": {"g2": "A tabela associa BB a Gi0/4, não a Gi0/2."}, "misconceptions": {"g2": "ignores_mac_table_when_classifying_unicast"},
        "wrong_feedback": "Siga o Destination BB até a entrada correspondente e então até a porta física.", "hints": COMMON_HINTS,
        "correct_feedback": "Correto. BB é um destino específico conhecido e somente Gi0/4 transmite: known unicast.",
    },
    {
        "id": "2", "number": 2, "primary": "BROADCAST", "related": ["SWITCH", "FRAME"],
        "category": "Aplicar", "difficulty_level": 3, "type": "broadcast_ports", "mode": "exercise", "scenario_key": "delivery-a2",
        "title": "Broadcast", "symptom": "Um frame FF:FF:FF:FF:FF:FF entra por Gi0/1.",
        "instruction": "Marque Gi0/2, Gi0/4 e Gi0/6, execute e compare os contadores.", "tools": ["board"],
        "required_actions": ["field:destination", "port:2", "port:4", "port:6", "frame:run"], "required_evidence": [],
        "slots": [slot("egress", "PORTAS QUE RECEBEM CÓPIA", True)],
        "tokens": [token("g1", "Gi0/1"), token("g2", "Gi0/2"), token("g4", "Gi0/4"), token("g6", "Gi0/6")],
        "correct_map": {"g2": "egress", "g4": "egress", "g6": "egress"},
        "feedback": {"g1": "Gi0/1 é o ingresso e não recebe uma cópia enviada de volta pelo switch."}, "misconceptions": {"g1": "assumes_broadcast_returns_to_ingress"},
        "wrong_feedback": "Considere as demais portas conectadas aplicáveis e exclua a porta de entrada.", "hints": COMMON_HINTS,
        "correct_feedback": "Correto. O Destination broadcast produz cópias em Gi0/2, Gi0/4 e Gi0/6, nunca no ingresso Gi0/1.",
    },
    {
        "id": "3", "number": 3, "primary": "BROADCAST", "related": ["ARP", "FRAME", "SWITCH"],
        "category": "Inferir", "difficulty_level": 4, "type": "arp_request_builder", "mode": "exercise", "scenario_key": "delivery-a3",
        "title": "ARP Request", "symptom": "PC-A procura 192.168.10.80. PC-B possui .80; PC-C não.",
        "instruction": "Monte o destino do Request, indique as portas que recebem e quem tem motivo para responder.", "tools": ["board"],
        "required_actions": ["field:destination", "port:4", "port:7", "frame:run"], "required_evidence": [],
        "slots": [slot("destination", "DESTINATION MAC"), slot("receivers", "PORTAS QUE RECEBEM", True), slot("responder", "HOST QUE RESPONDE")],
        "tokens": [token("ff", "FF:FF:FF:FF:FF:FF"), token("g4", "Gi0/4 · PC-B"), token("g7", "Gi0/7 · PC-C"), token("b", "PC-B · 192.168.10.80"), token("c", "PC-C · 192.168.10.30")],
        "correct_map": {"ff": "destination", "g4": "receivers", "g7": "receivers", "b": "responder"},
        "feedback": {"c": "PC-C recebe o Request, mas o IPv4 procurado não é o seu."}, "misconceptions": {"c": "confuses_arp_request_with_unicast"},
        "wrong_feedback": "Todos ouvem o Request; somente o host que possui .80 tem motivo para responder.", "hints": COMMON_HINTS,
        "correct_feedback": "Correto. O Request usa broadcast; PC-B e PC-C recebem, mas somente PC-B reconhece o IPv4 procurado.",
    },
    {
        "id": "4", "number": 4, "primary": "UNICAST / BROADCAST", "related": ["ARP", "MAC", "FRAME"],
        "category": "Inferir", "difficulty_level": 4, "type": "request_reply_compare", "mode": "exercise", "scenario_key": "delivery-a4",
        "title": "Request × Reply", "symptom": "Compare dois frames ARP sem usar apenas o texto do payload.",
        "instruction": "Classifique cada frame e associe seu alcance.", "tools": ["board"], "required_actions": ["field:destination", "frame:run"], "required_evidence": [],
        "slots": [slot("request", "FRAME A · WHO HAS .80?"), slot("reply", "FRAME B · .80 IS AT BB")],
        "tokens": [token("request", "Broadcast ARP Request · múltiplas portas"), token("reply", "Unicast ARP Reply · somente Gi0/1"), token("reply-broadcast", "Broadcast ARP Reply"), token("request-unicast", "Unicast ARP Request")],
        "correct_map": {"request": "request", "reply": "reply"},
        "feedback": {"reply-broadcast": "O Reply possui Destination AA específico.", "request-unicast": "O Request usa FF:FF:FF:FF:FF:FF."},
        "misconceptions": {"reply-broadcast": "confuses_arp_reply_with_broadcast", "request-unicast": "confuses_arp_request_with_unicast"},
        "wrong_feedback": "Compare o Destination MAC de cada frame.", "hints": COMMON_HINTS,
        "correct_feedback": "Correto. O Request é broadcast; o Reply pode voltar como unicast para AA.",
    },
    {
        "id": "5", "number": 5, "primary": "UNICAST / BROADCAST", "related": ["SWITCH", "MAC TABLE"],
        "category": "Inferir", "difficulty_level": 4, "type": "unknown_unicast_evidence", "mode": "investigation", "scenario_key": "delivery-a5", "hide_mac_table": True,
        "title": "Parece Broadcast, mas não é", "symptom": "Um frame apareceu em várias portas. Determine a causa sem usar apenas esse efeito.",
        "instruction": "Inspecione Destination, consulte a tabela e colete as duas evidências.", "tools": ["switch_cli", "board"],
        "required_actions": ["field:destination", "command:show mac address-table", "frame:run"], "required_evidence": ["dest-dd", "dd-absent"],
        "evidence": [{"id": "dest-dd", "text": "Destination é o MAC específico DD"}, {"id": "dd-absent", "text": "DD não possui entrada na MAC Table"}],
        "evidence_triggers": {"field:destination": ["dest-dd"], "command:show mac address-table": ["dd-absent"]},
        "slots": [slot("classification", "CLASSIFICAÇÃO"), slot("cause", "CAUSA")],
        "tokens": [token("unknown", "UNKNOWN UNICAST"), token("broadcast", "BROADCAST"), token("absence", "Destino específico ausente da tabela"), token("many", "Muitas portas transmitiram")],
        "correct_map": {"unknown": "classification", "absence": "cause"},
        "feedback": {"broadcast": "Várias saídas não provam broadcast; o Destination é DD específico.", "many": "O número de portas é efeito, não evidência suficiente da classificação."},
        "misconceptions": {"broadcast": "confuses_broadcast_with_unknown_unicast", "many": "assumes_multiple_egress_ports_means_broadcast"},
        "wrong_feedback": "Use a intenção expressa no Destination e o estado de conhecimento da tabela.", "hints": COMMON_HINTS,
        "correct_feedback": "Correto. DD é específico e está ausente da tabela: unknown unicast com flooding.",
    },
    {
        "id": "6", "number": 6, "primary": "UNICAST / BROADCAST", "related": ["SWITCH", "FRAME"],
        "category": "Inferir", "difficulty_level": 4, "type": "three_scenarios", "mode": "exercise", "scenario_key": "delivery-a6",
        "title": "Três cenários", "symptom": "A mesma topologia produzirá três decisões diferentes.",
        "instruction": "Associe Destination, estado da tabela e resultado.", "tools": ["board"], "required_actions": ["field:destination", "frame:run"], "required_evidence": [],
        "slots": [slot("a", "A · BB CONHECIDO"), slot("b", "B · DD DESCONHECIDO"), slot("c", "C · FF:FF:FF:FF:FF:FF")],
        "tokens": [token("known", "Known Unicast · uma porta"), token("unknown", "Unknown Unicast · flooding"), token("broadcast", "Broadcast · múltiplas portas")],
        "correct_map": {"known": "a", "unknown": "b", "broadcast": "c"}, "feedback": {},
        "wrong_feedback": "Primeiro leia Destination; para unicast, consulte se a entrada existe.", "hints": COMMON_HINTS,
        "correct_feedback": "Correto. Intenção do frame e conhecimento do switch explicam os três resultados.",
    },
    {
        "id": "7", "number": 7, "primary": "BROADCAST", "related": ["SWITCH", "GATEWAY"],
        "category": "Diagnosticar", "difficulty_level": 5, "type": "broadcast_boundary", "mode": "investigation", "scenario_key": "delivery-a7",
        "title": "O Broadcast atravessou?", "symptom": "A animação afirma que o mesmo broadcast Ethernet local chegou a PC-X em outra rede.",
        "instruction": "Inspecione o frame, identifique a fronteira e marque o receptor incoerente.", "tools": ["board"], "actions": ["mark-boundary"],
        "action_buttons": [{"id": "mark-boundary", "label": "Marcar R1 como fronteira"}],
        "required_actions": ["field:destination", "action:mark-boundary"], "required_evidence": ["broadcast-destination", "router-boundary"],
        "evidence": [{"id": "broadcast-destination", "text": "Destination é broadcast Ethernet local"}, {"id": "router-boundary", "text": "R1 separa a rede local de PC-X"}],
        "evidence_triggers": {"field:destination": ["broadcast-destination"], "action:mark-boundary": ["router-boundary"]},
        "slots": [slot("boundary", "FRONTEIRA"), slot("inconsistent", "RECEPTOR INCOERENTE")],
        "tokens": [token("r1", "R1"), token("x", "PC-X em outra rede"), token("b", "PC-B local"), token("crosses", "O mesmo frame atravessou R1")],
        "correct_map": {"r1": "boundary", "x": "inconsistent"},
        "feedback": {"b": "PC-B está no domínio local mostrado e é receptor aplicável.", "crosses": "R1 é uma fronteira: o mesmo broadcast Ethernet local não é simplesmente encaminhado à outra rede."}, "misconceptions": {"crosses": "assumes_router_forwards_l2_broadcast_unchanged"},
        "wrong_feedback": "Localize a interface que separa a Ethernet local da outra rede.", "hints": COMMON_HINTS,
        "correct_feedback": "Correto. R1 é a fronteira; o mesmo frame broadcast Ethernet local não aparece diretamente em PC-X.",
    },
    {
        "id": "8", "number": 8, "primary": "UNICAST / BROADCAST", "related": ["SWITCH", "MAC"],
        "category": "Diagnosticar", "difficulty_level": 5, "type": "frame_cli_investigation", "mode": "investigation", "scenario_key": "delivery-a8", "hide_mac_table": True,
        "title": "Leia o switch e o frame", "symptom": "Destination CC foi transmitido por múltiplas portas. Descubra a classificação.",
        "instruction": "Use Packet Inspector e CLI; apresente duas evidências.", "tools": ["switch_cli", "board"],
        "required_actions": ["field:destination", "command:show mac address-table", "frame:run"], "required_evidence": ["dest-cc", "cc-absent"],
        "evidence": [{"id": "dest-cc", "text": "Destination CC é específico"}, {"id": "cc-absent", "text": "CC está ausente da MAC Table"}],
        "evidence_triggers": {"field:destination": ["dest-cc"], "command:show mac address-table": ["cc-absent"]},
        "slots": [slot("classification", "CLASSIFICAÇÃO"), slot("action", "AÇÃO DO SWITCH")],
        "tokens": [token("unknown", "UNKNOWN UNICAST"), token("broadcast", "BROADCAST"), token("flood", "Flooding pelas demais portas aplicáveis"), token("direct", "Saída única conhecida")],
        "correct_map": {"unknown": "classification", "flood": "action"},
        "feedback": {"broadcast": "CC é um endereço específico, não FF:FF:FF:FF:FF:FF.", "direct": "Não existe entrada CC que sustente uma saída única."},
        "misconceptions": {"broadcast": "confuses_broadcast_with_unknown_unicast", "direct": "ignores_mac_table_when_classifying_unicast"},
        "wrong_feedback": "Cruze o Destination específico com sua ausência na tabela.", "hints": COMMON_HINTS,
        "correct_feedback": "Correto. Destination CC específico + CC ausente = unknown unicast e flooding.",
    },
    {
        "id": "9", "number": 9, "primary": "UNICAST / BROADCAST", "related": ["SWITCH", "MAC", "FRAME"],
        "category": "Diagnosticar", "difficulty_level": 5, "type": "delivery_investigation", "mode": "investigation", "scenario_key": "delivery-a9", "hide_mac_table": True,
        "title": "Por que tantas portas?", "symptom": "Um único frame de PC-A apareceu em três portas de saída. Descubra por quê.",
        "instruction": "Escolha as ferramentas, colete evidências e limite a conclusão ao que elas sustentam.", "tools": ["switch_cli", "board"],
        "required_actions": ["field:destination", "command:show mac address-table", "port:1", "frame:run"], "required_evidence": ["dest-ee", "ee-absent", "egress-many"],
        "evidence": [{"id": "dest-ee", "text": "Destination EE é específico"}, {"id": "ee-absent", "text": "EE não aparece na MAC Table"}, {"id": "egress-many", "text": "Três portas, exceto o ingresso, transmitiram"}],
        "evidence_triggers": {"field:destination": ["dest-ee"], "command:show mac address-table": ["ee-absent"], "frame:run": ["egress-many"]},
        "slots": [slot("intent", "INTENÇÃO DO FRAME"), slot("knowledge", "ESTADO DO SWITCH"), slot("conclusion", "CONCLUSÃO")],
        "tokens": [token("specific", "Destino específico EE"), token("absent", "Sem entrada EE"), token("unknown", "Unknown unicast / flooding"), token("broadcast", "Broadcast porque houve três saídas")],
        "correct_map": {"specific": "intent", "absent": "knowledge", "unknown": "conclusion"},
        "feedback": {"broadcast": "O número de saídas não define a intenção do frame."}, "misconceptions": {"broadcast": "assumes_multiple_egress_ports_means_broadcast"},
        "wrong_feedback": "Separe intenção do Destination e conhecimento atual do switch.", "hints": COMMON_HINTS,
        "correct_feedback": "Correto. EE é específico, mas desconhecido: o switch faz flooding de um unknown unicast.",
    },
    {
        "id": "10", "number": 10, "primary": "UNICAST / BROADCAST", "related": ["ARP", "MAC", "FRAME", "SWITCH"],
        "category": "Diagnosticar / Sintetizar", "difficulty_level": 5, "type": "delivery_challenge", "mode": "investigation", "scenario_key": "delivery-a10", "hide_mac_table": False,
        "title": "Delivery Challenge", "symptom": "PC-A precisa falar com PC-B, mas seu cache ARP ainda não possui BB.",
        "host_arp_empty": True,
        "instruction": "Percorra Request, Reply, dado conhecido e contraste com um destino desconhecido.", "tools": ["host_terminal", "switch_cli", "board"],
        "actions": ["arp-request", "arp-reply", "data-frame", "unknown-frame"],
        "action_buttons": [{"id": "arp-request", "label": "1 · Gerar ARP Request"}, {"id": "arp-reply", "label": "2 · Gerar ARP Reply"}, {"id": "data-frame", "label": "3 · Enviar frame A → B"}, {"id": "unknown-frame", "label": "4 · Enviar frame para DD"}],
        "required_actions": ["command:arp -a", "action:arp-request", "action:arp-reply", "action:data-frame", "action:unknown-frame"],
        "required_evidence": ["arp-empty", "request-broadcast", "reply-unicast", "bb-learned", "dd-unknown"],
        "evidence": [{"id": "arp-empty", "text": "Cache ARP de A inicialmente não possui BB"}, {"id": "request-broadcast", "text": "ARP Request usa FF:FF:FF:FF:FF:FF"}, {"id": "reply-unicast", "text": "ARP Reply usa Destination AA"}, {"id": "bb-learned", "text": "Switch aprendeu BB → Gi0/4"}, {"id": "dd-unknown", "text": "DD é específico e está ausente da tabela"}],
        "evidence_triggers": {"command:arp -a": ["arp-empty"], "action:arp-request": ["request-broadcast"], "action:arp-reply": ["reply-unicast", "bb-learned"], "action:unknown-frame": ["dd-unknown"]},
        "slots": [slot("request", "ARP REQUEST"), slot("reply", "ARP REPLY"), slot("data", "DADO PARA BB"), slot("contrast", "DESTINO DD")],
        "tokens": [token("broadcast", "Broadcast · múltiplas portas"), token("reply", "Unicast para AA · Gi0/1"), token("known", "Known unicast para BB · Gi0/4"), token("unknown", "Unknown unicast · flooding"), token("all-broadcast", "Todos são broadcast")],
        "correct_map": {"broadcast": "request", "reply": "reply", "known": "data", "unknown": "contrast"},
        "feedback": {"all-broadcast": "Request, Reply e frames de dados possuem Destinations diferentes."}, "misconceptions": {"all-broadcast": "confuses_broadcast_with_unknown_unicast"},
        "wrong_feedback": "Reconstrua a sequência usando o Destination MAC e a tabela em cada fase.", "hints": COMMON_HINTS,
        "correct_feedback": "Correto. Você conectou ARP Request broadcast, Reply unicast, known unicast e unknown unicast sem confundir intenção com flooding.",
    },
]


ACTIVITY_MAP = {activity["id"]: activity for activity in ACTIVITIES}
CAPABILITIES = ["Ler Destination MAC", "Distinguir intenção e efeito", "Consultar MAC Table", "Prever portas de saída", "Interpretar broadcast", "Reconhecer unknown unicast", "Cruzar ARP e Ethernet", "Coletar evidências", "Respeitar fronteiras de Camada 2", "Explicar flooding"]
MISCONCEPTION_LABELS = {
    "confuses_broadcast_with_unknown_unicast": "Broadcast × unknown unicast",
    "assumes_multiple_egress_ports_means_broadcast": "Múltiplas saídas significam broadcast",
    "assumes_broadcast_destination_is_specific_host": "Broadcast como host específico",
    "assumes_broadcast_returns_to_ingress": "Broadcast retorna ao ingresso",
    "assumes_router_forwards_l2_broadcast_unchanged": "Roteador encaminha broadcast L2 inalterado",
    "confuses_arp_request_with_unicast": "ARP Request como unicast",
    "confuses_arp_reply_with_broadcast": "ARP Reply como broadcast",
    "ignores_destination_mac": "Ignora o Destination MAC",
    "ignores_mac_table_when_classifying_unicast": "Ignora a MAC Table no unicast",
    "assumes_unknown_unicast_is_dropped": "Unknown unicast descartado",
    "assumes_broadcast_means_entire_internet": "Broadcast significa Internet inteira",
}
