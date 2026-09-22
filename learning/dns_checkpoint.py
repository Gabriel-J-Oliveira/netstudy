"""Checkpoint content for DNS name resolution."""


def item(number, title, scenario, question, name, options, correct, explanation, wrong, misconception):
    return {
        "id": str(number), "number": number, "category": "Raciocinar",
        "difficulty_level": 3 if number <= 3 else 4 if number <= 7 else 5,
        "primary": "DNS", "related": ["IPv4", "Application"],
        "title": title, "scenario": scenario, "instruction": question,
        "fields": [{"name": name, "label": "Conclusão", "options": options}],
        "correct_map": {name: correct.lower()},
        "feedback_by_token_slot": {f"{name}:{option.lower()}": wrong for option in options if option.lower() != correct.lower()},
        "misconceptions": {name: misconception}, "wrong_feedback": wrong,
        "correct_feedback": "Correto. " + explanation, "hints": [wrong, explanation],
    }


ACTIVITIES = [
    item(1, "Nome ou endereço?", "O cliente conhece intranet.exemplo.local, mas não o endereço do host.", "Que informação a consulta DNS procura?", "target", ["IPv4 associado ao nome", "MAC do servidor", "Porta TCP"], "IPv4 associado ao nome", "DNS associa esse nome ao IPv4 192.168.20.30 no cenário.", "DNS não descobre MAC nem escolhe a porta do serviço.", "confuses_dns_with_other_layers"),
    item(2, "Registro A", "O resolvedor responde um registro A para intranet.exemplo.local.", "Qual valor é a resposta A?", "address", ["192.168.20.30", "192.168.10.1", "TCP 443"], "192.168.20.30", "O registro A apresentado contém o IPv4 192.168.20.30.", "Gateway e porta não são o endereço retornado nesse registro A.", "confuses_answer_with_gateway"),
    item(3, "Consulta ao resolvedor", "Cliente 192.168.10.50 consulta o resolvedor 192.168.10.53.", "Qual é a conclusão segura sobre o resolvedor?", "role", ["Responde associação nome–IP", "Transporta a página", "Escolhe a rota"], "Responde associação nome–IP", "O resolvedor devolve informação de endereçamento, não o conteúdo da página.", "DNS não transporta a página nem escolhe a rota IP.", "assumes_dns_delivers_page"),
    item(4, "Cache preenchido", "Uma resposta DNS ainda válida está no cache do cliente.", "O que o cache pode fazer?", "cache", ["Reutilizar a resposta válida", "Provar serviço disponível", "Trocar gateway"], "Reutilizar a resposta válida", "O cache pode reutilizar a associação enquanto válida.", "Uma resposta em cache não comprova disponibilidade atual do serviço.", "assumes_cache_proves_service"),
    item(5, "Cache vazio", "O cliente não tem resposta válida em cache para o nome.", "Qual é o próximo passo conceitual?", "next", ["Consultar o resolvedor", "ARP para nome", "Conectar sem IP"], "Consultar o resolvedor", "Sem resposta válida, o cliente consulta o resolvedor DNS.", "ARP trabalha com endereços locais, não transforma nomes em IPv4.", "confuses_dns_with_other_layers"),
    item(6, "DNS respondeu, web falhou", "nslookup retorna 192.168.20.30, mas o serviço web não abre.", "O que os dados permitem afirmar?", "claim", ["Nome foi resolvido; serviço não comprovado", "TCP 443 funciona", "Rota está correta"], "Nome foi resolvido; serviço não comprovado", "A resposta DNS não comprova rota, TCP 443 ou funcionamento da aplicação.", "Não atribua ao nslookup evidências de conexão ou de aplicação.", "overinterprets_nslookup"),
    item(7, "Ping ao IP", "Um ping para 192.168.20.30 recebe resposta; a consulta por nome falha.", "Qual conclusão é segura?", "claim", ["IP responde; DNS ainda pode falhar", "DNS está correto", "HTTP funciona"], "IP responde; DNS ainda pode falhar", "O teste direto ao IP não verifica a resolução do nome.", "Ping ao IP não comprova DNS nem serviço web.", "assumes_ping_proves_dns"),
    item(8, "Gateway e DNS", "O cliente conhece o IPv4 de destino após consultar DNS.", "Quem cuida da escolha do caminho?", "role", ["Routing/gateway", "DNS", "Registro A"], "Routing/gateway", "DNS fornece o endereço; routing/gateway trata o caminho até redes remotas.", "A resposta DNS não escolhe a rota.", "assumes_dns_selects_route"),
    item(9, "Sequência segura", "Cliente quer abrir intranet.exemplo.local por TCP 443.", "Qual sequência conceitual faz sentido?", "sequence", ["Nome → DNS → IPv4 → rota → TCP 443", "Nome → TCP 443 → DNS → IPv4", "Nome → ARP → página"], "Nome → DNS → IPv4 → rota → TCP 443", "A resolução fornece o IPv4 antes da comunicação com o serviço.", "Não misture resolução de nomes com entrega do serviço.", "confuses_dns_with_other_layers"),
    item(10, "Evidência de nslookup", "Saída simulada: Name: intranet.exemplo.local; Address: 192.168.20.30.", "Qual afirmação não extrapola a saída?", "evidence", ["Resolvedor forneceu um IPv4 para o nome", "Serviço web está disponível", "TCP 443 respondeu"], "Resolvedor forneceu um IPv4 para o nome", "A saída mostra associação nome–IPv4, não disponibilidade do serviço.", "nslookup não testa TCP 443 nem a aplicação web.", "overinterprets_nslookup"),
]
ACTIVITY_MAP = {entry["id"]: entry for entry in ACTIVITIES}
CAPABILITIES = ["Separar nome de endereço IPv4", "Interpretar consulta, resposta A e cache", "Limitar conclusões de nslookup e ping", "Distinguir DNS de rota e serviço"]
MISCONCEPTION_LABELS = {
    "confuses_dns_with_other_layers": "Confunde DNS com ARP, transporte ou serviço",
    "confuses_answer_with_gateway": "Confunde resposta A com gateway ou porta",
    "assumes_dns_delivers_page": "Supõe que DNS transporta a página",
    "assumes_cache_proves_service": "Trata cache como prova de serviço ativo",
    "overinterprets_nslookup": "Extrapola o que nslookup evidencia",
    "assumes_ping_proves_dns": "Trata ping ao IP como teste de DNS",
    "assumes_dns_selects_route": "Supõe que DNS escolhe o caminho",
}
