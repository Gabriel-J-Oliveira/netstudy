"""Structured content for the Default Gateway + Next Hop checkpoint."""


def field(name, label, options=None):
    return {"name": name, "label": label, "options": options or []}


LOCAL_GATEWAY = ["ENTREGA LOCAL", "GATEWAY"]
LOCAL_REMOTE = ["LOCAL", "REMOTO"]
YES_NO = ["SIM", "NÃO"]
LEVEL5_HINTS = [
    "Descubra primeiro se o destino pertence à sub-rede do host.",
    "Se for remoto, separe o destino IP final do próximo salto local.",
]


ACTIVITIES = [
    {
        "id": "1", "number": 1, "category": "Aplicar", "difficulty_level": 3,
        "primary": "DEFAULT GATEWAY / NEXT HOP", "related": ["IPv4", "Subnet"],
        "title": "Entrega local ou gateway", "scenario": "PC-A: 192.168.10.25/24 · Gateway: 192.168.10.1",
        "instruction": "Associe cada destino ao primeiro tipo de entrega.",
        "fields": [field("d80", "192.168.10.80", LOCAL_GATEWAY), field("d2080", "192.168.20.80", LOCAL_GATEWAY)],
        "correct_map": {"d80": "entrega local", "d2080": "gateway"},
        "feedback": {"d80": "192.168.10.80 pertence à sub-rede local /24.", "d2080": "192.168.20.80 está fora da sub-rede local."},
        "misconceptions": {"d80": "assumes_default_gateway_used_for_every_destination", "d2080": "confuses_final_destination_with_next_hop"},
        "wrong_feedback": "Classifique primeiro cada destino como local ou remoto.",
        "correct_feedback": "Correto. .10.80 recebe entrega local; .20.80 usa o gateway no cenário estudado.", "hints": [],
    },
    {
        "id": "2", "number": 2, "category": "Aplicar", "difficulty_level": 3,
        "primary": "DEFAULT GATEWAY / NEXT HOP", "related": ["IPv4"],
        "title": "Identificar o próximo salto", "scenario": "PC-A: 10.0.0.20/24 · Gateway: 10.0.0.1 · Destino: 172.16.5.20",
        "instruction": "Informe o próximo salto no cenário.", "fields": [field("next_hop", "Next Hop")],
        "correct_map": {"next_hop": "10.0.0.1"},
        "feedback": {"next_hop": "O destino é remoto; procure o endereço local configurado como gateway."},
        "misconceptions": {"next_hop": "confuses_final_destination_with_next_hop"},
        "wrong_feedback": "O próximo salto não é o destino final remoto. Use o gateway configurado.",
        "correct_feedback": "Correto. 10.0.0.1 é o próximo salto local para esse destino remoto.", "hints": [],
    },
    {
        "id": "3", "number": 3, "category": "Inferir", "difficulty_level": 4,
        "primary": "DEFAULT GATEWAY / NEXT HOP", "related": ["ARP", "IPv4"],
        "title": "Escolher o alvo do ARP", "scenario": "PC-A: 192.168.1.50/24 · Gateway: 192.168.1.1 · Destino: 8.8.8.8",
        "instruction": "Por qual IPv4 PC-A deve fazer ARP para iniciar a entrega?", "fields": [field("arp", "ARP target")],
        "correct_map": {"arp": "192.168.1.1"},
        "feedback": {"arp": "Antes de escolher o alvo do ARP, determine se 8.8.8.8 está localmente alcançável na sub-rede do host."},
        "misconceptions": {"arp": "assumes_remote_host_is_arp_resolved_directly"},
        "wrong_feedback": "O host já concluiu que o destino é remoto. Procure qual endereço local receberá a primeira entrega Ethernet.",
        "correct_feedback": "Correto. ARP resolve 192.168.1.1, o próximo salto local.", "hints": [],
    },
    {
        "id": "4", "number": 4, "category": "Inferir", "difficulty_level": 4,
        "primary": "DEFAULT GATEWAY / NEXT HOP", "related": ["MAC", "Frame", "IPv4"],
        "title": "Separar frame e pacote", "scenario": "PC-A: IP 192.168.1.50, MAC AA · Gateway: IP 192.168.1.1, MAC RR · Destino: 8.8.8.8",
        "instruction": "Preencha os dois destinos usados na primeira entrega.",
        "fields": [field("ethernet", "Ethernet Destination"), field("ipv4", "IPv4 Destination")],
        "correct_map": {"ethernet": "rr", "ipv4": "8.8.8.8"},
        "feedback": {"ethernet": "O frame local precisa chegar ao MAC do gateway.", "ipv4": "O gateway não substitui o destino IP final."},
        "misconceptions": {"ethernet": "confuses_gateway_ip_with_gateway_mac", "ipv4": "assumes_gateway_replaces_destination_ip"},
        "wrong_feedback": "Separe quem recebe o frame agora de onde a comunicação IP precisa chegar.",
        "correct_feedback": "Correto. Ethernet Destination RR; IPv4 Destination 8.8.8.8.", "hints": [],
    },
    {
        "id": "5", "number": 5, "category": "Inferir", "difficulty_level": 4,
        "primary": "DEFAULT GATEWAY / NEXT HOP", "related": ["Subnet", "ARP"],
        "title": "Subnetting muda o alvo do ARP", "scenario": "PC-A: 192.168.10.70/26 · Gateway: 192.168.10.65",
        "instruction": "Informe o alvo ARP para cada destino.",
        "fields": [field("local_arp", "Destino 192.168.10.100"), field("remote_arp", "Destino 192.168.10.150")],
        "correct_map": {"local_arp": "192.168.10.100", "remote_arp": "192.168.10.65"},
        "feedback": {"local_arp": ".100 está no bloco local 64–127.", "remote_arp": ".150 está fora; resolva o próximo salto .65."},
        "misconceptions": {"remote_arp": "assumes_remote_host_is_arp_resolved_directly"},
        "wrong_feedback": "Local → ARP pelo destino. Remoto → ARP pelo gateway local.",
        "correct_feedback": "Correto. Para .100, ARP por .100; para .150, ARP por .65.", "hints": [],
    },
    {
        "id": "6", "number": 6, "category": "Inferir", "difficulty_level": 4,
        "primary": "DEFAULT GATEWAY / NEXT HOP", "related": ["Subnet"],
        "title": "Gateway fora da LAN", "scenario": "PC-A: 192.168.10.25/24 · Gateway configurado: 192.168.20.1",
        "instruction": "Avalie se o gateway está diretamente alcançável no cenário simples.",
        "fields": [field("reachable", "Gateway localmente alcançável?", YES_NO)],
        "correct_map": {"reachable": "não"},
        "feedback": {"reachable": "Compare a rede 192.168.10.0/24 do host com a rede do gateway."},
        "misconceptions": {"reachable": "ignores_gateway_local_reachability"},
        "wrong_feedback": "Neste cenário, o próximo salto precisa pertencer à LAN usada para a entrega.",
        "correct_feedback": "Correto. 192.168.20.1 não pertence à rede local 192.168.10.0/24.", "hints": [],
        "visualizers": [{"host": "192.168.10.25", "prefix": 24, "destination": "192.168.20.1"}],
    },
    {
        "id": "7", "number": 7, "category": "Inferir", "difficulty_level": 4,
        "primary": "DEFAULT GATEWAY / NEXT HOP", "related": ["ARP", "MAC"],
        "title": "Interpretar o ARP cache", "scenario": "Após PC-A acessar 10.50.20.30, arp -a mostra: 192.168.10.1 → RR",
        "instruction": "Escolha por que aparece o gateway, não o host remoto.",
        "fields": [field("reason", "Evidência", ["A ENTREGA ETHERNET LOCAL FOI AO GATEWAY", "ARP DESCOBRIU O HOST REMOTO ATRAVÉS DO ROUTER"])],
        "correct_map": {"reason": "a entrega ethernet local foi ao gateway"},
        "feedback": {"reason": "ARP não atravessa o roteador para resolver diretamente o host remoto."},
        "misconceptions": {"reason": "assumes_arp_crosses_router"},
        "wrong_feedback": "A entrada representa o dispositivo local que recebeu o primeiro frame.",
        "correct_feedback": "Correto. O host resolveu a entrega Ethernet local para o gateway.", "hints": [],
        "terminal": "C:\\> arp -a\n192.168.10.1    RR",
    },
    {
        "id": "8", "number": 8, "category": "Diagnosticar", "difficulty_level": 5,
        "primary": "DEFAULT GATEWAY / NEXT HOP", "related": ["Frame", "IPv4", "MAC"],
        "title": "Refutar uma interpretação da captura", "scenario": "Ethernet Destination: RR · IPv4 Destination: 172.16.20.50",
        "instruction": "Um técnico afirma que o frame está errado porque MAC e IP apontam para dispositivos diferentes.",
        "fields": [field("verdict", "Conclusão", ["COMPORTAMENTO ESPERADO", "FRAME INCORRETO"])],
        "correct_map": {"verdict": "comportamento esperado"},
        "feedback": {"verdict": "O destino IP remoto e o MAC do próximo salto local cumprem papéis diferentes."},
        "misconceptions": {"verdict": "assumes_different_mac_and_ip_destinations_mean_error"},
        "wrong_feedback": "Separe o destino final de Camada 3 do destinatário do enlace local.",
        "correct_feedback": "Correto. É esperado: IP aponta ao host remoto e MAC ao gateway local.", "hints": LEVEL5_HINTS,
        "packet": {"source_mac": "AA", "destination_mac": "RR", "source_ip": "192.168.10.25", "destination_ip": "172.16.20.50"},
    },
    {
        "id": "9", "number": 9, "category": "Diagnosticar", "difficulty_level": 5,
        "primary": "DEFAULT GATEWAY / NEXT HOP", "related": ["IPv4", "Subnet", "ARP"],
        "title": "Local funciona, remoto falha", "scenario": "PC-A alcança hosts locais, mas nenhum destino remoto funciona.",
        "instruction": "Use as evidências e avalie o gateway configurado.",
        "fields": [field("local", "Comunicação local", ["POSSÍVEL", "IMPOSSÍVEL"]), field("gateway", "Gateway localmente alcançável?", YES_NO), field("cause", "Conclusão", ["GATEWAY FORA DA SUB-REDE LOCAL", "SWITCH PRECISA ROTEAR O PACOTE"])],
        "correct_map": {"local": "possível", "gateway": "não", "cause": "gateway fora da sub-rede local"},
        "feedback": {"local": "O sintoma informa que a comunicação local funciona.", "gateway": "Compare 192.168.30.1 com 192.168.10.0/24.", "cause": "O switch mantém sua função L2; ele não escolhe o próximo salto IP."},
        "misconceptions": {"gateway": "ignores_gateway_local_reachability", "cause": "assumes_switch_routes_remote_packet"},
        "wrong_feedback": "As evidências isolam o problema na saída para destinos remotos e mostram um gateway fora da LAN.",
        "correct_feedback": "Correto. A LAN funciona, mas 192.168.30.1 não é um próximo salto localmente alcançável nesse cenário.", "hints": LEVEL5_HINTS,
        "terminal": "IPv4 Address: 192.168.10.25\nSubnet Mask: 255.255.255.0\nDefault Gateway: 192.168.30.1\n\narp -a\n192.168.10.80    DD",
        "stage": {
            "host_ip": "192.168.10.25", "host_prefix": 24, "host_mac": "AA",
            "gateway_ip": "192.168.30.1", "gateway_mac": "desconhecido",
            "destination_ip": "destino remoto", "destination_mac": "desconhecido",
        },
        "visualizers": [{"host": "192.168.10.25", "prefix": 24, "destination": "192.168.30.1"}],
    },
    {
        "id": "10", "number": 10, "category": "Diagnosticar / Sintetizar", "difficulty_level": 5,
        "primary": "DEFAULT GATEWAY / NEXT HOP", "related": ["IPv4", "Subnet", "ARP", "MAC", "Frame", "Switch"],
        "title": "Executar o primeiro salto inteiro", "scenario": "PC-A: 192.168.50.70/26, MAC AA · Gateway: 192.168.50.65, MAC RR · PC-C: 192.168.50.150, MAC CC",
        "instruction": "Complete a decisão até a chegada do primeiro frame ao router.",
        "fields": [
            field("network", "Rede de A"), field("verdict", "PC-C é", LOCAL_REMOTE), field("next_hop", "Next Hop"),
            field("arp", "ARP target"), field("learned_mac", "MAC aprendido"), field("ip_destination", "IPv4 Destination"),
            field("ethernet_destination", "Ethernet Destination"), field("router_info", "R1 precisa agora de", ["INFORMAÇÕES DE ROTEAMENTO", "MAC DE PC-C VIA ARP NA LAN DE A"]),
        ],
        "correct_map": {"network": "192.168.50.64", "verdict": "remoto", "next_hop": "192.168.50.65", "arp": "192.168.50.65", "learned_mac": "rr", "ip_destination": "192.168.50.150", "ethernet_destination": "rr", "router_info": "informações de roteamento"},
        "feedback": {"network": ".70 está no bloco /26 64–127.", "verdict": ".150 está em 128–191.", "next_hop": "Use o gateway local .65.", "arp": "ARP resolve o IPv4 do próximo salto.", "learned_mac": "A resposta do gateway fornece RR.", "ip_destination": "O gateway não substitui PC-C como destino IP.", "ethernet_destination": "O primeiro frame vai ao MAC RR.", "router_info": "Ao receber o pacote, R1 precisa decidir o encaminhamento com informações de roteamento."},
        "misconceptions": {"next_hop": "confuses_final_destination_with_next_hop", "arp": "assumes_remote_host_is_arp_resolved_directly", "ip_destination": "assumes_gateway_replaces_destination_ip", "ethernet_destination": "assumes_destination_mac_remains_remote_host_mac"},
        "wrong_feedback": "Siga a ordem: sub-rede, local/remoto, next hop, ARP, pacote e frame.",
        "correct_feedback": "Correto. O pacote continua destinado a 192.168.50.150; o primeiro frame vai para RR. R1 precisará de informações de roteamento para continuar.",
        "hints": LEVEL5_HINTS,
        "visualizers": [{"host": "192.168.50.70", "prefix": 26, "destination": "192.168.50.150"}],
        "packet": {"source_mac": "AA", "destination_mac": "RR", "source_ip": "192.168.50.70", "destination_ip": "192.168.50.150"},
        "stage": {
            "host_ip": "192.168.50.70", "host_prefix": 26, "host_mac": "AA",
            "gateway_ip": "192.168.50.65", "gateway_mac": "RR",
            "destination_ip": "192.168.50.150", "destination_mac": "CC",
        },
    },
]


ACTIVITY_MAP = {item["id"]: item for item in ACTIVITIES}

CAPABILITIES = [
    "Escolher um próximo salto para destino remoto", "Validar se o gateway é localmente alcançável",
    "Escolher corretamente o alvo do ARP", "Separar Ethernet Destination de IPv4 Destination",
    "Interpretar ipconfig e arp -a", "Acompanhar o primeiro frame até o router",
]

MISCONCEPTION_LABELS = {
    "assumes_remote_host_is_arp_resolved_directly": "Tenta resolver diretamente o host remoto por ARP",
    "confuses_final_destination_with_next_hop": "Confunde destino final com próximo salto",
    "assumes_gateway_replaces_destination_ip": "Substitui o destino IP pelo gateway",
    "assumes_gateway_can_be_any_remote_ip": "Considera qualquer IP remoto um gateway válido",
    "ignores_gateway_local_reachability": "Ignora que o gateway precisa ser localmente alcançável",
    "confuses_gateway_ip_with_gateway_mac": "Confunde o IPv4 e o MAC do gateway",
    "assumes_switch_routes_remote_packet": "Atribui ao switch a decisão de roteamento",
    "assumes_destination_mac_remains_remote_host_mac": "Usa o MAC do host remoto no primeiro frame",
    "assumes_different_mac_and_ip_destinations_mean_error": "Interpreta destinos MAC e IP diferentes como erro",
    "assumes_arp_crosses_router": "Supõe que ARP atravessa o roteador",
    "assumes_default_gateway_used_for_every_destination": "Usa o gateway também para destinos locais",
    "assumes_gateway_is_dns_server": "Confunde gateway com servidor DNS",
}
