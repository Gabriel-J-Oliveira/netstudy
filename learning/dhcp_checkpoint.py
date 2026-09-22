"""Checkpoint content for dynamic network configuration."""


def item(number, title, scenario, question, name, options, correct, explanation, wrong, misconception):
    return {
        "id": str(number), "number": number, "category": "Raciocinar",
        "difficulty_level": 3 if number <= 3 else 4 if number <= 7 else 5,
        "primary": "DHCP", "related": ["IPv4", "DNS", "Gateway"],
        "title": title, "scenario": scenario, "instruction": question,
        "fields": [{"name": name, "label": "Conclusão", "options": options}],
        "correct_map": {name: correct.lower()},
        "feedback_by_token_slot": {f"{name}:{option.lower()}": wrong for option in options if option.lower() != correct.lower()},
        "misconceptions": {name: misconception}, "wrong_feedback": wrong,
        "correct_feedback": "Correto. " + explanation, "hints": [wrong, explanation],
    }


ACTIVITIES = [
    item(1, "Primeiro contato", "Cliente ainda não tem IPv4 configurado na rede local.", "Qual etapa inicia DORA?", "step", ["Discover", "Offer", "ACK"], "Discover", "O cliente procura um servidor DHCP com Discover; neste cenário local pode usar broadcast.", "Offer e ACK são respostas posteriores.", "confuses_dora"),
    item(2, "Oferta", "Servidor 192.168.10.53 propõe configuração ao cliente.", "Qual mensagem representa a proposta?", "step", ["Offer", "Request", "ACK"], "Offer", "Offer apresenta a configuração que poderá ser concedida.", "Request é o pedido do cliente; ACK confirma a concessão.", "confuses_dora"),
    item(3, "Pedido e confirmação", "O cliente escolheu uma oferta e solicita a concessão.", "Qual ordem encerra DORA?", "sequence", ["Request → ACK", "ACK → Request", "Offer → Discover"], "Request → ACK", "O cliente solicita com Request e o servidor confirma com ACK.", "A confirmação vem depois do pedido.", "confuses_dora"),
    item(4, "IP e máscara", "Concessão: 192.168.10.50/24, gateway 192.168.10.1, DNS 192.168.10.53.", "Qual parte identifica o IP e a rede local?", "field", ["192.168.10.50/24", "192.168.10.1", "192.168.10.53"], "192.168.10.50/24", "IP e máscara permitem identificar o endereço do host e sua rede local.", "Gateway e DNS têm funções diferentes da configuração IP/máscara.", "confuses_configuration_fields"),
    item(5, "Rede remota", "Cliente com concessão válida quer alcançar outra rede.", "Qual configuração indica o próximo salto local?", "field", ["Gateway 192.168.10.1", "DNS 192.168.10.53", "Máscara /24"], "Gateway 192.168.10.1", "O gateway é usado para encaminhar tráfego destinado a outras redes.", "DNS resolve nomes; a máscara ajuda a classificar a rede.", "assumes_dhcp_routes"),
    item(6, "Resolver nomes", "Cliente recebeu DNS 192.168.10.53 na concessão.", "Qual função esse valor indica?", "role", ["Servidor para consultas DNS", "Rota escolhida por DHCP", "MAC do destino"], "Servidor para consultas DNS", "DHCP informa qual resolvedor usar; DNS executa a resolução depois.", "DHCP distribui a configuração, mas não substitui DNS.", "confuses_dhcp_with_dns"),
    item(7, "Endereço 169.254", "Cliente mostra 169.254.x.x em vez da concessão esperada.", "Qual conclusão é segura?", "claim", ["Pode não ter recebido concessão; causa indeterminada", "Servidor DHCP está desligado", "DNS necessariamente falhou"], "Pode não ter recebido concessão; causa indeterminada", "APIPA sugere ausência de concessão, sem determinar a causa raiz.", "Considere alcance, VLAN, servidor ou conectividade; não escolha causa específica sem evidência.", "overinterprets_apipa"),
    item(8, "IP válido, DNS incorreto", "Cliente tem 192.168.10.50/24 e gateway correto, mas DNS configurado errado.", "Qual efeito é plausível?", "effect", ["Nomes podem falhar; IP ainda pode funcionar", "Todo IP fica inválido", "DHCP escolhe outra rota"], "Nomes podem falhar; IP ainda pode funcionar", "Um DNS incorreto afeta consultas de nome; a configuração IP pode continuar válida.", "Não confunda resolução de nomes com validade do endereço IP.", "confuses_dhcp_with_dns"),
    item(9, "Leitura de ipconfig", "ipconfig /all exibe IPv4, máscara, gateway e DNS recebidos.", "O que essa saída demonstra?", "evidence", ["Configuração exibida; serviço remoto não comprovado", "Todo serviço web funciona", "Servidor DNS respondeu agora"], "Configuração exibida; serviço remoto não comprovado", "A saída mostra parâmetros configurados, não o funcionamento atual de outros serviços.", "Não extrapole de configuração para conectividade ou resposta DNS.", "overinterprets_ipconfig"),
    item(10, "Percurso após a concessão", "Cliente recebeu 192.168.10.50/24, gateway e DNS.", "Qual síntese respeita as funções?", "path", ["Rede local → gateway remoto → DNS para nomes", "DHCP transporta páginas e escolhe rotas", "DNS fornece máscara e MAC"], "Rede local → gateway remoto → DNS para nomes", "A configuração permite distinguir rede local, usar gateway para outras redes e consultar DNS para nomes.", "DHCP fornece parâmetros; não executa as funções dos demais protocolos.", "assumes_dhcp_replaces_protocols"),
]
ACTIVITY_MAP = {entry["id"]: entry for entry in ACTIVITIES}
CAPABILITIES = ["Ordenar Discover, Offer, Request e ACK", "Interpretar IP, máscara, gateway e DNS", "Distinguir configuração de funcionamento", "Interpretar APIPA e ipconfig sem adivinhar a causa"]
MISCONCEPTION_LABELS = {
    "confuses_dora": "Confunde a sequência DORA",
    "confuses_configuration_fields": "Confunde funções dos parâmetros da concessão",
    "assumes_dhcp_routes": "Supõe que DHCP escolhe a rota",
    "confuses_dhcp_with_dns": "Confunde DHCP com DNS",
    "overinterprets_apipa": "Atribui causa específica a APIPA sem evidência",
    "overinterprets_ipconfig": "Interpreta configuração como prova de serviço funcionando",
    "assumes_dhcp_replaces_protocols": "Supõe que DHCP substitui os demais protocolos",
}
