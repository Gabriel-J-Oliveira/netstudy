"""Ten focused situations for the Ports + Client/Server checkpoint."""


def field(name, label, options):
    return {"name": name, "label": label, "options": options}


def activity(number, category, title, scenario, instruction, fields, correct, feedback, wrong, misconception, hint):
    wrong_options = {
        f"{field_item['name']}:{option.lower()}": wrong
        for field_item in fields for option in field_item["options"]
        if option.lower() != correct[field_item["name"]]
    }
    return {
        "id": str(number), "number": number, "category": category,
        "difficulty_level": 3 if number <= 3 else 4 if number <= 7 else 5,
        "primary": "Endpoints", "related": ["IPv4", "TCP / UDP"],
        "title": title, "scenario": scenario, "instruction": instruction,
        "fields": fields, "correct_map": correct, "feedback": feedback,
        "feedback_by_token_slot": wrong_options,
        "misconceptions": misconception, "wrong_feedback": wrong,
        "correct_feedback": "Correto. " + " ".join(feedback.values()),
        "hints": [hint, wrong],
    }


ACTIVITIES = [
    activity(1, "Localizar", "Qual host?", "O cliente envia dados para 192.168.20.30:443 por TCP.",
        "Identifique o campo que leva ao host.", [field("host", "Campo", ["DESTINATION IP", "DESTINATION PORT", "SOURCE PORT"])],
        {"host": "destination ip"}, {"host": "Destination IP 192.168.20.30 identifica o servidor."},
        "Porta identifica o endpoint no host; o endereço IP identifica o host.", {"host": "confuses_port_with_ip"},
        "Procure o endereço que identifica o servidor na rede."),
    activity(2, "Diferenciar", "Host certo, serviço errado", "O pacote chega a 192.168.20.30, mas usa TCP 22 em vez de TCP 443.",
        "Qual endpoint foi selecionado?", [field("service", "Serviço", ["SSH", "WEB", "DNS"])],
        {"service": "ssh"}, {"service": "No cenário, TCP 22 aponta para SSH, não para o serviço web em TCP 443."},
        "O IP correto não basta: compare protocolo e porta de destino.", {"service": "assumes_ip_selects_service"},
        "O servidor oferece mais de um serviço no mesmo IP."),
    activity(3, "Diferenciar", "Mesmo número, protocolos distintos", "Compare TCP 53 e UDP 53 no mesmo host.",
        "Avalie os endpoints.", [field("relation", "Relação", ["DISTINTOS", "IDÊNTICOS"])],
        {"relation": "distintos"}, {"relation": "TCP 53 e UDP 53 são endpoints de transporte distintos, embora o número seja igual."},
        "O protocolo faz parte da identificação do endpoint.", {"relation": "ignores_protocol"},
        "Compare a combinação protocolo + porta, não somente o número."),
    activity(4, "Aplicar", "Porta temporária do cliente", "Cliente 192.168.10.20:53012 inicia uma comunicação com o serviço web TCP 443.",
        "Identifique a porta de origem.", [field("port", "Source Port", ["53012", "443", "22"])],
        {"port": "53012"}, {"port": "53012 é a porta temporária de origem neste cenário; 443 identifica o serviço de destino."},
        "A porta do serviço permanece no lado do servidor.", {"port": "assumes_client_uses_service_port"},
        "Leia o lado Source do envio inicial."),
    activity(5, "Montar", "Envio ao serviço web", "192.168.10.20:53012 envia ao servidor 192.168.20.30:443.",
        "Complete protocolo e porta de destino.", [field("protocol", "Protocolo", ["TCP", "UDP"]), field("port", "Destination Port", ["443", "53012", "22"])],
        {"protocol": "tcp", "port": "443"}, {"protocol": "TCP é o protocolo do serviço web deste cenário.", "port": "443 é a porta de destino no servidor."},
        "O endpoint de destino é a combinação TCP 443.", {"protocol": "ignores_protocol", "port": "assumes_client_uses_service_port"},
        "Observe a linha do serviço web na topologia."),
    activity(6, "Inverter", "Resposta ao cliente", "O servidor responde ao envio TCP de 192.168.10.20:53012 para 192.168.20.30:443.",
        "Indique as portas da resposta.", [field("source", "Source Port", ["443", "53012"]), field("destination", "Destination Port", ["443", "53012"])],
        {"source": "443", "destination": "53012"}, {"source": "A resposta sai do serviço web em 443.", "destination": "Ela retorna ao endpoint temporário 53012 do cliente."},
        "Na resposta, IPs e portas de origem/destino se invertem; o protocolo permanece TCP.", {"source": "forgets_reverse_direction", "destination": "forgets_reverse_direction"},
        "A resposta sai do serviço e volta ao cliente que iniciou a comunicação."),
    activity(7, "Comparar", "Dois clientes, um serviço", "A: 192.168.10.20:53012 e B: 192.168.10.21:53013 acessam TCP 443 no mesmo servidor.",
        "Qual conclusão é sustentada?", [field("conclusion", "Conclusão", ["FLUXOS DISTINTOS", "MESMO FLUXO", "SEGUNDO CLIENTE IMPOSSÍVEL"])],
        {"conclusion": "fluxos distintos"}, {"conclusion": "Origem IP e porta diferem; os dois fluxos são distinguíveis apesar do mesmo destino TCP 443."},
        "O mesmo serviço pode atender comunicações distintas.", {"conclusion": "assumes_single_client_per_port"},
        "Compare as origens A e B."),
    activity(8, "Avaliar", "Número não é regra universal", "Um serviço web deste cenário usa TCP 443. Alguém conclui que nenhum serviço web pode usar outra porta.",
        "Avalie a conclusão.", [field("verdict", "Conclusão", ["NÃO JUSTIFICADA", "JUSTIFICADA"])],
        {"verdict": "não justificada"}, {"verdict": "443 identifica o serviço neste cenário; a porta usada por um serviço não é uma obrigação universal."},
        "Não transforme o número apresentado no exemplo em regra sem exceções.", {"verdict": "memorizes_port_as_universal"},
        "Separe convenção do cenário de obrigação técnica."),
    activity(9, "Diagnosticar", "Ler um netstat simples", "Saída simulada: TCP 192.168.10.20:53012 192.168.20.30:443 ESTABLISHED.",
        "Qual conclusão é segura?", [field("evidence", "Evidência", ["HÁ ENDPOINTS TCP INDICADOS", "O SITE FUNCIONA PERFEITAMENTE", "O DNS FALHOU"])],
        {"evidence": "há endpoints tcp indicados"}, {"evidence": "A linha mostra protocolo e endpoints indicados; não prova que a aplicação web funciona perfeitamente."},
        "A saída não sustenta afirmações sobre todo o serviço ou sobre DNS.", {"evidence": "overinterprets_netstat"},
        "Afirme apenas o que a linha efetivamente mostra."),
    activity(10, "Sintetizar", "Entrega ao endpoint", "O cliente envia 192.168.10.20:53012 → 192.168.20.30:443 por TCP e recebe resposta.",
        "Associe host, serviço e retorno.", [
            field("host", "Host", ["192.168.20.30", "443", "53012"]),
            field("service", "Serviço de destino", ["TCP 443", "TCP 53012", "UDP 53"]),
            field("return", "Destino da resposta", ["192.168.10.20:53012", "192.168.20.30:443", "192.168.10.20:443"]),
        ], {"host": "192.168.20.30", "service": "tcp 443", "return": "192.168.10.20:53012"},
        {"host": "O Destination IP identifica o servidor.", "service": "TCP 443 seleciona o endpoint do serviço web.", "return": "A resposta volta ao IP e à porta temporária do cliente."},
        "Siga a direção do envio e depois inverta os endpoints para o retorno.",
        {"host": "confuses_port_with_ip", "service": "ignores_protocol", "return": "forgets_reverse_direction"},
        "Host, serviço e retorno são três perguntas diferentes."),
]

ACTIVITY_MAP = {item["id"]: item for item in ACTIVITIES}
CAPABILITIES = [
    "Separar host de endpoint de aplicação", "Usar protocolo e porta de destino para localizar o serviço",
    "Reconhecer a porta temporária do cliente", "Inverter endpoints na resposta",
    "Distinguir fluxos simultâneos", "Tirar conclusões limitadas de uma saída netstat",
]
MISCONCEPTION_LABELS = {
    "confuses_port_with_ip": "Confunde porta com endereço IP",
    "assumes_ip_selects_service": "Supõe que o IP sozinho seleciona o serviço",
    "ignores_protocol": "Ignora o protocolo na identificação do endpoint",
    "assumes_client_uses_service_port": "Coloca a porta do serviço no cliente",
    "forgets_reverse_direction": "Não inverte os endpoints no retorno",
    "assumes_single_client_per_port": "Supõe um só cliente por porta de serviço",
    "memorizes_port_as_universal": "Trata porta convencional como obrigação universal",
    "overinterprets_netstat": "Conclui mais do que o netstat evidencia",
}
