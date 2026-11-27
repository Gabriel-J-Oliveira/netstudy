"""Conteúdo e situações avaliativas da aula de modelos de rede."""

MODELS = (
    ("application", "Aplicação", (
        ("7 · Aplicação", "Oferece serviços de rede aos programas.", "HTTP, DNS e DHCP", "dns_concept", "DNS"),
        ("6 · Apresentação", "Trata a representação dos dados para que possam ser interpretados.", "Codificação e formatos de dados", None, None),
        ("5 · Sessão", "Organiza o diálogo entre aplicações, incluindo seu início e encerramento.", "Controle de diálogo", None, None),
    ), "Reúne funções de aplicação, representação e diálogo que o OSI separa."),
    ("transport", "Transporte", (
        ("4 · Transporte", "Entrega dados entre aplicações nos hosts.", "TCP, UDP e portas", "transport_concept", "TCP e UDP"),
    ), "TCP e UDP oferecem serviços de transporte distintos. Portas identificam endpoints de transporte."),
    ("internet", "Internet", (
        ("3 · Rede", "Endereça e encaminha pacotes entre redes.", "IPv4, rotas e ICMP", "route_concept", "Tabela de Rotas"),
    ), "IP endereça pacotes. Roteadores escolhem por onde encaminhá-los. ICMP fornece mensagens de controle."),
    ("link", "Acesso à rede", (
        ("2 · Enlace", "Entrega frames no enlace local.", "Ethernet, MAC, switches e VLANs", "frame_concept", "Frame Ethernet"),
        ("1 · Física", "Transmite bits por sinais no meio físico.", "Sinais elétricos, fibra e rádio", None, None),
    ), "Aqui reunimos entrega no enlace e transmissão no meio físico em um único bloco didático."),
)

STEPS = (
    ("Cliente", "application", "Aplicação", "O navegador prepara um pedido HTTP de uma página.", "Pedido HTTP"),
    ("Cliente", "transport", "Transporte", "Com a conexão deste exemplo já aberta, TCP transporta os dados para a porta 80 do servidor.", "Porta temporária do cliente → TCP 80"),
    ("Cliente", "internet", "Internet", "IPv4 identifica o servidor como destino. Como ele está em outra rede, o cliente usa o gateway.", "IPv4 do cliente → IPv4 do servidor"),
    ("Cliente", "link", "Acesso à rede", "O cliente envia o frame ao próximo salto local. A interface transmite os bits no meio.", "MAC do cliente → MAC do gateway"),
    ("Percurso", "internet", "Roteamento", "O roteador escolhe uma saída. A cada enlace, a entrega usa um frame local novo.", "O destino IP continua sendo o servidor"),
    ("Servidor", "link", "Acesso à rede", "A interface recebe os sinais e recupera o frame do último enlace.", "MAC do último salto → MAC do servidor"),
    ("Servidor", "internet", "Internet", "O servidor reconhece seu IPv4 como destino e entrega os dados ao TCP.", "IPv4 de destino é local ao servidor"),
    ("Servidor", "transport", "Transporte", "TCP entrega bytes ao serviço que escuta na porta 80.", "Destino TCP 80"),
    ("Servidor", "application", "Aplicação", "O serviço interpreta o pedido HTTP e pode preparar a resposta.", "Pedido HTTP disponível ao serviço"),
)

EVIDENCE = (
    ("Cabo desconectado", "Comece pelo meio físico. Verifique cabo e interface. A ausência de enlace não permite avaliar DNS ou a aplicação por esse caminho."),
    ("Gateway incorreto", "Compare a configuração com a rede local e teste um destino local. Uma falha só com destinos remotos orienta a investigação da rota e do próximo salto, mas não identifica a causa por si só."),
    ("Ping responde, site não abre", "O teste confirma a troca ICMP com aquele destino naquele momento. Verifique a porta e o serviço web para separar transporte de aplicação."),
    ("Por IP funciona, por nome falha", "A resolução de nomes é uma hipótese útil. Consulte o nome e compare o endereço retornado. Verifique também se o serviço trata os dois acessos da mesma forma."),
)


def situation(number, category, title, scenario, question, choices, correct, explanation, hints):
    field = "conclusao"
    return {
        "id": str(number),
        "number": number,
        "category": category,
        "title": title,
        "scenario": scenario,
        "instruction": question,
        "fields": [{"name": field, "label": question, "options": [label for label, _ in choices]}],
        "correct_map": {field: choices[correct][0].lower()},
        "correct_feedback": explanation,
        "feedback_by_token_slot": {
            f"{field}:{label.lower()}": feedback
            for label, feedback in choices if feedback
        },
        "misconceptions": {field: title},
        "wrong_feedback": "Releia a situação e concentre-se na função ou na evidência descrita.",
        "hints": hints,
    }


ACTIVITIES = [
    situation(1, "Associar", "Sinais no cabo", "A interface Ethernet transmite bits em sinais elétricos.", "Qual função está em ação no OSI?",
              (("Enlace", "O enlace organiza a entrega em frames. A situação destaca a transmissão dos bits."), ("Física", None), ("Rede", "A função de rede usa endereços IP e decide caminhos entre redes.")),
              1, "A função física transmite bits em sinais no meio.", ["Observe o que acontece no meio de transmissão."]),
    situation(2, "Identificar", "MAC e porta do switch", "Um switch consulta sua tabela MAC para decidir a porta de saída.", "Qual responsabilidade está em ação?",
              (("Enlace", None), ("Transporte", "Portas de transporte identificam endpoints como TCP 80. Aqui a porta é uma interface do switch."), ("Apresentação", "Representação de dados não determina a porta de saída do frame.")),
              0, "O switch decide a entrega local do frame por endereços MAC.", ["A decisão usa o endereço do frame Ethernet."]),
    situation(3, "Comparar", "Três funções em um grupo", "O OSI descreve aplicação, apresentação e sessão em camadas distintas.", "Onde ficam as funções correspondentes na visão TCP/IP da aula?",
              (("Internet", "Internet trata o endereçamento e o encaminhamento IP."), ("Transporte", "Transporte fornece entrega entre endpoints. Representação e diálogo de aplicação ficam acima."), ("Aplicação", None)),
              2, "A camada de aplicação TCP/IP agrupa funções que o OSI descreve separadamente.", ["Procure o bloco mais próximo dos programas."]),
    situation(4, "Associar", "Rota e porta TCP", "Um roteador escolhe uma saída com base no IPv4 de destino.", "Qual camada TCP/IP descreve essa decisão?",
              (("Transporte", "TCP cuida da entrega entre aplicações. A decisão descrita usa IPv4."), ("Internet", None), ("Acesso à rede", "O enlace entrega um frame ao próximo salto depois da decisão de rota.")),
              1, "A camada Internet trata o encaminhamento de pacotes IP.", ["Identifique o endereço consultado pelo roteador."]),
    situation(5, "Identificar", "O serviço no servidor", "Dois serviços usam o mesmo IPv4 do servidor, com portas TCP diferentes.", "Qual informação ajuda o TCP a entregar os bytes ao serviço certo?",
              (("MAC de destino", "O MAC ajuda na entrega local do frame e pode ser igual para os dois serviços."), ("Prefixo da rota", "A rota leva o pacote ao destino IP. Os dois serviços compartilham esse IP."), ("Porta TCP de destino", None)),
              2, "A porta TCP de destino identifica o endpoint do serviço nessa comunicação.", ["Compare o que difere entre os dois serviços."]),
    situation(6, "Interpretar", "Sem enlace", "O cabo está desconectado e a interface indica ausência de enlace.", "O que essa observação permite concluir?",
              (("O enlace físico está indisponível nesse ponto", None), ("O DNS está fora do ar", "A observação é local à interface. Ela não mede a disponibilidade do resolvedor."), ("O gateway está errado", "O cabo desconectado não informa qual gateway está configurado.")),
              0, "A observação informa o estado da conexão local. Outras verificações são necessárias para os serviços.", ["Separe o estado da interface do estado dos serviços."]),
    situation(7, "Interpretar", "Ping respondeu", "O servidor respondeu ao ping. O navegador continua sem abrir a página.", "Qual conclusão é sustentada?",
              (("A porta web está aberta", "ICMP não testa a porta usada pelo serviço web."), ("Houve troca ICMP com o destino", None), ("O DNS respondeu corretamente", "O cenário não oferece resultado de uma consulta DNS.")),
              1, "O ping mostra a troca ICMP. A conexão de transporte e a aplicação exigem outras evidências.", ["Identifique o protocolo do teste que respondeu."]),
    situation(8, "Raciocinar", "Nome e endereço", "O teste por IP funciona. O acesso pelo nome falha.", "Qual é a primeira verificação mais diretamente relacionada à diferença?",
              (("Trocar o cabo", "O caminho direto ao IP já funcionou. Verifique o que foi acrescentado ao usar o nome."), ("Declarar o servidor web indisponível", "Os resultados diferem com o modo de acesso. Investigue antes de concluir indisponibilidade."), ("Consultar a resolução do nome e comparar o IP", None)),
              2, "A consulta DNS testa a associação do nome. Outras diferenças da aplicação ainda podem explicar a falha.", ["Que informação o cliente precisa obter quando recebe um nome?"]),
    situation(9, "Raciocinar", "O destino está longe", "O cliente quer acessar um servidor remoto e já conhece o IPv4 dele.", "Quem recebe o primeiro frame Ethernet da entrega?",
              (("O próximo salto local", None), ("A aplicação remota diretamente", "A aplicação recebe dados no servidor. O primeiro frame percorre apenas o enlace local."), ("O resolvedor DNS", "O IPv4 já é conhecido. O resolvedor não é o próximo salto por essa razão.")),
              0, "O frame mira o próximo salto local enquanto o pacote mantém o IPv4 do servidor como destino.", ["Separe o destino do frame local do destino do pacote IP."]),
    situation(10, "Comparar", "Dois mapas da mesma comunicação", "Um diagrama usa sete camadas OSI e outro usa quatro camadas TCP/IP.", "Como interpretar suas correspondências?",
              (("Cada protocolo precisa de uma equivalência exata", "Os modelos agrupam responsabilidades de formas diferentes. Funções específicas podem atravessar fronteiras didáticas."), ("As correspondências aproximam responsabilidades", None), ("A camada Física desaparece no TCP/IP", "O meio físico continua necessário. Esta visão didática inclui suas funções no acesso à rede.")),
              1, "A correspondência é conceitual. Ela ajuda a comparar responsabilidades sem impor uma identidade entre os modelos.", ["Veja como o modelo de quatro camadas agrupa funções."]),
]

ACTIVITY_MAP = {item["id"]: item for item in ACTIVITIES}
CAPABILITIES = ["Comparar os dois modelos", "Relacionar protocolos a responsabilidades", "Separar evidência e hipótese"]
MISCONCEPTION_LABELS = {item["title"]: item["title"] for item in ACTIVITIES}
