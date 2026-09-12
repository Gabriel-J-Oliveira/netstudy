"""Structured content for the IPv4 + subnet checkpoint."""


def field(name, label, options=None, placeholder=""):
    return {"name": name, "label": label, "options": options or [], "placeholder": placeholder}


BLOCKS_26 = ["0–63", "64–127", "128–191", "192–255"]
LOCAL_REMOTE = ["LOCAL", "REMOTO"]
YES_NO = ["SIM", "NÃO"]
LEVEL5_HINTS = [
    "Descubra primeiro a sub-rede do host.",
    "Compare a posição do destino com o intervalo dessa sub-rede.",
]


ACTIVITIES = [
    {
        "id": "1", "number": 1, "category": "Aplicar", "difficulty_level": 3,
        "type": "network_broadcast", "primary": "IPv4 / SUB-REDE", "related": [],
        "title": "Rede e broadcast de um /24", "scenario": "Host: 192.168.10.25/24",
        "instruction": "Preencha os dois endereços. Não há alternativas para escolher.",
        "fields": [field("network", "Network"), field("broadcast", "Broadcast")],
        "correct_map": {"network": "192.168.10.0", "broadcast": "192.168.10.255"},
        "feedback": {"network": "O endereço de rede é o início do bloco /24.", "broadcast": "O broadcast é o último endereço do bloco /24."},
        "misconceptions": {"network": "confuses_network_address_with_host", "broadcast": "confuses_broadcast_address_with_usable_host"},
        "wrong_feedback": "Localize primeiro o início e o fim do bloco 0–255.",
        "correct_feedback": "Correto. 192.168.10.25/24 pertence à rede 192.168.10.0, cujo broadcast é 192.168.10.255.",
        "visualizers": [{"host": "192.168.10.25", "prefix": 24}], "hints": [],
    },
    {
        "id": "2", "number": 2, "category": "Aplicar", "difficulty_level": 3,
        "type": "local_remote", "primary": "IPv4 / SUB-REDE", "related": [],
        "title": "Local ou remoto em /24", "scenario": "Host: 192.168.10.25/24",
        "instruction": "Classifique cada destino usando a sub-rede do host.",
        "fields": [field("d80", "192.168.10.80", LOCAL_REMOTE), field("d2080", "192.168.20.80", LOCAL_REMOTE)],
        "correct_map": {"d80": "local", "d2080": "remoto"},
        "feedback": {"d80": "Compare os endereços usando a máscara /24.", "d2080": "O destino 192.168.20.80 pertence a outra rede /24."},
        "misconceptions": {"d80": "ignores_subnet_mask", "d2080": "assumes_similar_ip_means_local"},
        "wrong_feedback": "Calcule a rede /24 do host e de cada destino antes de classificar.",
        "correct_feedback": "Correto. 192.168.10.80 está na rede local; 192.168.20.80 está em outra sub-rede.",
        "visualizers": [{"host": "192.168.10.25", "prefix": 24, "destination": "192.168.10.80"}, {"host": "192.168.10.25", "prefix": 24, "destination": "192.168.20.80"}], "hints": [],
    },
    {
        "id": "3", "number": 3, "category": "Inferir", "difficulty_level": 4,
        "type": "block_and_destinations", "primary": "IPv4 / SUB-REDE", "related": [],
        "title": "Do bloco à decisão", "scenario": "Host: 192.168.10.70/25",
        "instruction": "Identifique o bloco do host e então classifique os destinos.",
        "fields": [field("block", "Bloco do host", ["0–127", "128–255"]), field("d100", "192.168.10.100", LOCAL_REMOTE), field("d200", "192.168.10.200", LOCAL_REMOTE)],
        "correct_map": {"block": "0–127", "d100": "local", "d200": "remoto"},
        "feedback": {"block": "Um /25 divide o último octeto em 0–127 e 128–255.", "d100": "Posicione 100 no bloco /25 antes de classificar.", "d200": "Os três primeiros octetos iguais não são suficientes neste prefixo."},
        "misconceptions": {"block": "confuses_prefix_with_host_count", "d100": "ignores_subnet_mask", "d200": "assumes_same_first_three_octets_means_same_subnet"},
        "wrong_feedback": "Primeiro localize os endereços nos dois blocos criados pelo /25.",
        "correct_feedback": "Correto. O host e .100 estão no bloco 0–127; .200 está no bloco 128–255.",
        "visualizers": [{"host": "192.168.10.70", "prefix": 25}], "hints": [],
    },
    {
        "id": "4", "number": 4, "category": "Inferir", "difficulty_level": 4,
        "type": "subnet_block", "primary": "IPv4 / SUB-REDE", "related": [],
        "title": "Localizar uma sub-rede /26", "scenario": "IP: 192.168.50.142/26",
        "instruction": "Selecione o bloco e preencha os limites da sub-rede.",
        "fields": [field("block", "Bloco", BLOCKS_26), field("network", "Network"), field("broadcast", "Broadcast")],
        "correct_map": {"block": "128–191", "network": "192.168.50.128", "broadcast": "192.168.50.191"},
        "feedback": {"block": "Um /26 avança em blocos de 64.", "network": "O Network é o primeiro endereço do bloco selecionado.", "broadcast": "O Broadcast é o último endereço do bloco selecionado."},
        "misconceptions": {"network": "confuses_network_address_with_host", "broadcast": "confuses_broadcast_address_with_usable_host"},
        "wrong_feedback": "Posicione 142 entre os limites dos blocos /26.",
        "correct_feedback": "Correto. 142 está em 128–191: Network 192.168.50.128 e Broadcast 192.168.50.191.",
        "visualizers": [{"host": "192.168.50.142", "prefix": 26}], "hints": [],
    },
    {
        "id": "5", "number": 5, "category": "Inferir", "difficulty_level": 4,
        "type": "prefix_mask", "primary": "IPv4 / SUB-REDE", "related": [],
        "title": "Prefixo e máscara", "scenario": "Associe cada prefixo à máscara decimal correspondente.",
        "instruction": "Use o padrão apresentado na referência da aula.",
        "fields": [
            field("p24", "/24", ["255.255.255.0", "255.255.255.128", "255.255.255.192", "255.255.255.224", "255.255.255.240"]),
            field("p25", "/25", ["255.255.255.0", "255.255.255.128", "255.255.255.192", "255.255.255.224", "255.255.255.240"]),
            field("p26", "/26", ["255.255.255.0", "255.255.255.128", "255.255.255.192", "255.255.255.224", "255.255.255.240"]),
            field("p27", "/27", ["255.255.255.0", "255.255.255.128", "255.255.255.192", "255.255.255.224", "255.255.255.240"]),
            field("p28", "/28", ["255.255.255.0", "255.255.255.128", "255.255.255.192", "255.255.255.224", "255.255.255.240"]),
        ],
        "correct_map": {"p24": "255.255.255.0", "p25": "255.255.255.128", "p26": "255.255.255.192", "p27": "255.255.255.224", "p28": "255.255.255.240"},
        "feedback": {}, "misconceptions": {"p26": "confuses_prefix_with_host_count"},
        "wrong_feedback": "Revise a progressão /24 → /28 e o tamanho decrescente dos blocos.",
        "correct_feedback": "Correto. Você associou os prefixos /24 a /28 às máscaras usadas nesta aula.", "visualizers": [], "hints": [],
    },
    {
        "id": "6", "number": 6, "category": "Inferir", "difficulty_level": 4,
        "type": "similar_ip", "primary": "IPv4 / SUB-REDE", "related": [],
        "title": "Parecem próximos, mas são locais?", "scenario": "PC-A: 192.168.10.20/25 · PC-B: 192.168.10.180/25",
        "instruction": "Demonstre os blocos antes de concluir.",
        "fields": [field("a", "Bloco de PC-A", ["0–127", "128–255"]), field("b", "Bloco de PC-B", ["0–127", "128–255"]), field("local", "São locais entre si?", YES_NO)],
        "correct_map": {"a": "0–127", "b": "128–255", "local": "não"},
        "feedback": {"a": "Localize .20 no primeiro bloco /25.", "b": "Os três primeiros octetos iguais não bastam; localize .180.", "local": "A conclusão deve ser sustentada pelos blocos, não apenas por os IPs serem diferentes."},
        "misconceptions": {"b": "assumes_same_first_three_octets_means_same_subnet", "local": "assumes_similar_ip_means_local"},
        "wrong_feedback": "Um /25 cria os blocos 0–127 e 128–255. Posicione cada endereço.",
        "correct_feedback": "Correto. A está em 0–127 e B em 128–255; portanto não são locais entre si.",
        "visualizers": [{"host": "192.168.10.20", "prefix": 25, "destination": "192.168.10.180"}], "hints": [],
    },
    {
        "id": "7", "number": 7, "category": "Inferir", "difficulty_level": 4,
        "type": "arp_local", "primary": "IPv4 / SUB-REDE", "related": ["ARP", "MAC"],
        "title": "ARP após a decisão local", "scenario": "Host: 192.168.10.70/26 · Destino: 192.168.10.100",
        "instruction": "O destino é local. Informe por qual IPv4 o host deve fazer ARP se o MAC ainda for desconhecido.",
        "fields": [field("arp", "ARP por", placeholder="IPv4")],
        "correct_map": {"arp": "192.168.10.100"},
        "feedback": {"arp": "Para um destino local, o ARP procura o próprio IPv4 do destino."},
        "misconceptions": {"arp": "assumes_remote_host_mac_should_be_arp_resolved_directly"},
        "wrong_feedback": "A decisão já foi LOCAL. Relacione isso ao IPv4 do próprio destino.",
        "correct_feedback": "Correto. Local → próprio destino: ARP por 192.168.10.100.",
        "visualizers": [{"host": "192.168.10.70", "prefix": 26, "destination": "192.168.10.100"}], "hints": [],
    },
    {
        "id": "8", "number": 8, "category": "Diagnosticar", "difficulty_level": 5,
        "type": "asymmetric_masks", "primary": "IPv4 / SUB-REDE", "related": [],
        "title": "Máscaras assimétricas", "scenario": "PC-A: 192.168.10.20/24 · PC-B: 192.168.10.130/25",
        "instruction": "Analise a decisão feita por cada host separadamente.",
        "fields": [field("a_view", "PC-A considera PC-B", LOCAL_REMOTE), field("b_view", "PC-B considera PC-A", LOCAL_REMOTE)],
        "correct_map": {"a_view": "local", "b_view": "remoto"},
        "feedback": {"a_view": "Use o /24 configurado em A, não o prefixo de B.", "b_view": "Use o /25 configurado em B e verifique se .20 está em 128–255."},
        "misconceptions": {"a_view": "ignores_asymmetric_masks", "b_view": "ignores_asymmetric_masks"},
        "wrong_feedback": "Cada host interpreta a rede usando sua própria máscara.",
        "correct_feedback": "Correto. A /24 considera B local; B /25 considera A remoto. As decisões são assimétricas.",
        "visualizers": [{"host": "192.168.10.20", "prefix": 24, "destination": "192.168.10.130"}, {"host": "192.168.10.130", "prefix": 25, "destination": "192.168.10.20"}], "hints": LEVEL5_HINTS,
    },
    {
        "id": "9", "number": 9, "category": "Diagnosticar", "difficulty_level": 5,
        "type": "terminal_hypothesis", "primary": "IPv4 / SUB-REDE", "related": [],
        "title": "Refutar uma hipótese com a configuração", "scenario": "Um técnico afirmou que 10.10.20.50 está na rede local de PC-A.",
        "instruction": "Use a configuração exibida e os blocos /28 para avaliar a afirmação.",
        "terminal": "Ethernet adapter Ethernet:\nIPv4 Address: 10.10.20.34\nSubnet Mask: 255.255.255.240\nPrefixo: /28\nDestino analisado: 10.10.20.50",
        "fields": [field("host_block", "Bloco de PC-A", ["32–47", "48–63"]), field("destination_block", "Bloco do destino", ["32–47", "48–63"]), field("verdict", "Conclusão", LOCAL_REMOTE)],
        "correct_map": {"host_block": "32–47", "destination_block": "48–63", "verdict": "remoto"},
        "feedback": {"host_block": ".34 está no bloco /28 iniciado em 32.", "destination_block": ".50 está no bloco /28 iniciado em 48.", "verdict": "A hipótese precisa ser confrontada com os blocos calculados."},
        "misconceptions": {"verdict": "assumes_similar_ip_means_local"},
        "wrong_feedback": "Em /28, os blocos avançam de 16 em 16. Posicione .34 e .50.",
        "correct_feedback": "Correto. PC-A está em 32–47 e .50 em 48–63. A evidência refuta a hipótese: o destino é remoto.",
        "visualizers": [{"host": "10.10.20.34", "prefix": 28, "destination": "10.10.20.50"}], "hints": LEVEL5_HINTS,
    },
    {
        "id": "10", "number": 10, "category": "Diagnosticar / Sintetizar", "difficulty_level": 5,
        "type": "complete_decision", "primary": "IPv4 / SUB-REDE", "related": ["ARP", "MAC", "FRAME"],
        "title": "Da configuração à entrega local", "scenario": "PC-A: 192.168.50.70/26 · PC-B: 192.168.50.100, MAC BB · PC-C: 192.168.50.150, MAC CC",
        "instruction": "Complete a decisão sem assumir ainda qual será o gateway.",
        "fields": [
            field("network", "Rede de A"), field("broadcast", "Broadcast"),
            field("b_verdict", "PC-B", LOCAL_REMOTE), field("arp", "ARP por", placeholder="IPv4"), field("ethernet", "Destination MAC para B", placeholder="MAC"),
            field("c_verdict", "PC-C", LOCAL_REMOTE), field("direct_arp", "Fazer ARP diretamente por PC-C?", YES_NO),
        ],
        "correct_map": {"network": "192.168.50.64", "broadcast": "192.168.50.127", "b_verdict": "local", "arp": "192.168.50.100", "ethernet": "bb", "c_verdict": "remoto", "direct_arp": "não"},
        "feedback": {"network": "O host .70 está no bloco /26 64–127.", "broadcast": "O fim desse bloco é .127.", "b_verdict": ".100 está no mesmo bloco de .70.", "arp": "Para B local, ARP procura o próprio IPv4 de B.", "ethernet": "O ARP Reply fornecido associa B ao MAC BB.", "c_verdict": ".150 está no bloco 128–191.", "direct_arp": "PC-C não está na sub-rede local; um próximo salto local será necessário."},
        "misconceptions": {"arp": "assumes_remote_host_mac_should_be_arp_resolved_directly", "direct_arp": "assumes_remote_host_mac_should_be_arp_resolved_directly"},
        "wrong_feedback": "Siga a ordem: bloco de A, decisão de B, consequência ARP, depois decisão de C.",
        "correct_feedback": "Correto. Para B: IP Destination 192.168.50.100 e Ethernet Destination BB. Para C: IP Destination 192.168.50.150 e Ethernet next-hop a definir no próximo módulo.",
        "visualizers": [{"host": "192.168.50.70", "prefix": 26, "destination": "192.168.50.100"}, {"host": "192.168.50.70", "prefix": 26, "destination": "192.168.50.150"}], "hints": LEVEL5_HINTS,
    },
]


ACTIVITY_MAP = {item["id"]: item for item in ACTIVITIES}

CAPABILITIES = [
    "Interpretar IPv4 junto com prefixo", "Encontrar Network e Broadcast",
    "Localizar endereços em blocos de sub-rede", "Decidir entre local e remoto",
    "Relacionar destino local ao ARP", "Analisar máscaras assimétricas",
]

MISCONCEPTION_LABELS = {
    "assumes_ip_alone_defines_subnet": "IPv4 sozinho define a sub-rede",
    "ignores_subnet_mask": "Ignora a máscara de sub-rede",
    "assumes_same_first_three_octets_means_same_subnet": "Três primeiros octetos iguais significam mesma sub-rede",
    "assumes_same_switch_means_same_ip_subnet": "Mesmo switch significa mesma sub-rede IPv4",
    "confuses_ipv4_with_mac": "Confunde IPv4 com endereço MAC",
    "confuses_prefix_with_host_count": "Confunde prefixo com quantidade de hosts",
    "confuses_network_address_with_host": "Confunde endereço de rede com host",
    "confuses_broadcast_address_with_usable_host": "Confunde broadcast com host convencional",
    "confuses_ipv4_broadcast_with_ethernet_broadcast": "Confunde broadcast IPv4 com broadcast Ethernet",
    "assumes_remote_host_mac_should_be_arp_resolved_directly": "Tenta resolver diretamente o MAC de host remoto",
    "assumes_subnet_mask_is_gateway": "Confunde máscara de sub-rede com gateway",
    "ignores_asymmetric_masks": "Ignora máscaras assimétricas",
    "assumes_similar_ip_means_local": "Aparência semelhante do IP usada como critério",
}
