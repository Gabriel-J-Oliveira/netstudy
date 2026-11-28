"""Cenário didático e checkpoint de encapsulamento."""

ANALOGY = (
    ("caneta", "application", "A caneta é o objeto a entregar.", "O pedido HTTP é o conteúdo produzido pela aplicação.",
     "Uma caneta violeta, sem embalagem."),
    ("estojo", "tcp", "A caneta entra no estojo.", "O cabeçalho TCP acompanha os dados com as portas da comunicação. Juntos, formam um segmento.",
     "A mesma caneta dentro de um estojo verde com fecho."),
    ("caixa", "ip", "O estojo entra na caixa endereçada.", "O cabeçalho IPv4 acrescenta os endereços IP. O pacote carrega o segmento TCP.",
     "O mesmo estojo com a caneta dentro de uma caixa azul com etiqueta de endereço."),
    ("embalagem", "ethernet", "A caixa ganha uma embalagem para o trecho local.", "O frame carrega o pacote. Os MACs indicam as interfaces do enlace e o FCS ajuda a detectar erros.",
     "A mesma caixa com estojo e caneta dentro de uma embalagem externa âmbar."),
    ("abertura", "application", "O destinatário abre as embalagens em ordem.", "Ethernet, IPv4 e TCP interpretam suas próprias informações e passam a carga adiante. A aplicação recebe os dados.",
     "A embalagem externa, a caixa e o estojo aparecem separados acima da caneta recuperada."),
)

ASSOCIATION_OPTIONS = (
    ("ip", "Pacote IPv4"), ("application", "Dados da aplicação"),
    ("ethernet", "Frame Ethernet"), ("tcp", "Segmento TCP"),
)
ASSOCIATION_FEEDBACK = {
    "caneta": "A caneta é o conteúdo por si só. Ainda não ganhou nenhuma informação de entrega.",
    "estojo": "O estojo envolve o conteúdo assim como o TCP envolve os dados com seu cabeçalho.",
    "caixa": "A caixa endereçada representa o IPv4, que carrega o segmento até o destino IP.",
    "embalagem": "A embalagem externa representa a entrega Ethernet no enlace atual.",
}
ASSOCIATIONS = tuple(
    (image, layer, alt, ASSOCIATION_FEEDBACK[image])
    for image, layer, _, _, alt in ANALOGY[:4]
)

RAPID_FIRE = (
    ("O pedido precisa chegar ao endpoint HTTP. Onde se lê a porta 80?", (
        ("Cabeçalho IPv4", False, "O IPv4 identifica a interface IP de destino. Procure a informação usada pelo transporte."),
        ("Cabeçalho TCP", True, "A porta de destino no TCP identifica o endpoint do serviço HTTP."),
        ("Trailer Ethernet", False, "O trailer pode detectar erros no frame. Qual camada identifica o serviço?"),
    )),
    ("Qual endereço o switch usa para decidir a porta de saída do frame?", (
        ("MAC de destino", True, "O switch consulta o MAC de destino na tabela de encaminhamento do enlace."),
        ("IPv4 de origem", False, "O IPv4 de origem indica de onde veio o pacote. Aqui a decisão é Ethernet."),
        ("Porta TCP de origem", False, "A porta TCP identifica um endpoint, não uma porta física do switch."),
    )),
    ("Qual campo Ethernet indica que sua carga deve ser entregue ao IPv4?", (
        ("FCS", False, "O FCS ajuda a detectar erros nos bits do frame. Procure o identificador do protocolo carregado."),
        ("TTL", False, "O TTL limita a vida do pacote, mas já faz parte do IPv4."),
        ("EtherType", True, "O EtherType 0x0800 indica que a carga do frame contém IPv4."),
    )),
)

LAYERS = (
    ("ethernet", "Cabeçalho Ethernet", 3, (
        ("MAC origem → destino", "Indicam quem envia e quem recebe no enlace. Compare os valores usados no cliente e no servidor."),
        ("EtherType", "0x0800 indica que a carga contém um pacote IPv4."),
    )),
    ("ip", "Cabeçalho IPv4", 2, (
        ("IPv4 origem → destino", "192.0.2.10 → 198.51.100.20. Identificam os endpoints de rede deste cenário."),
        ("TTL", "Um roteador reduz esse limite ao encaminhar. Se o TTL expirar, o pacote é descartado."),
        ("Checksum", "Verifica o cabeçalho IPv4. O roteador o atualiza quando reduz o TTL."),
    )),
    ("tcp", "Cabeçalho TCP", 1, (
        ("Portas origem → destino", "51514 → 80. A primeira identifica o endpoint do cliente e a segunda o serviço HTTP."),
    )),
    ("application", "Dados da aplicação", 0, (
        ("Conteúdo", "Pedido HTTP simplificado: GET /aula. A aplicação interpreta o pedido."),
    )),
    ("fcs", "Trailer Ethernet · FCS", 3, (
        ("Frame Check Sequence", "O receptor do enlace calcula a verificação e compara com o FCS recebido para detectar erros no frame."),
    )),
)

WALKTHROUGH = {
    "send": (
        ("Dados da aplicação", "O navegador prepara o pedido HTTP.", 0, "application"),
        ("Segmento TCP", "TCP acrescenta o cabeçalho com as portas dos dois endpoints.", 1, "tcp"),
        ("Pacote IPv4", "IPv4 acrescenta endereços, TTL e checksum do seu cabeçalho.", 2, "ip"),
        ("Frame Ethernet", "Ethernet coloca um cabeçalho antes do pacote e o trailer FCS depois. O MAC de destino é o do próximo salto local.", 3, "ethernet"),
        ("Transmissão física", "A interface codifica os bits do frame em sinais para o enlace. Os sinais representam os bits que carregam o frame.", 4, "ethernet"),
    ),
    "receive": (
        ("Receber sinais", "A interface do servidor recupera os bits do frame recebido no último enlace.", 4, "ethernet"),
        ("Interpretar o frame", "Ethernet verifica o FCS, confere o destino local e usa EtherType para entregar a carga ao IPv4.", 3, "fcs"),
        ("Interpretar o pacote IPv4", "IPv4 verifica o cabeçalho, reconhece o destino local e identifica TCP como o protocolo da carga.", 2, "ip"),
        ("Interpretar o segmento TCP", "TCP usa as portas e os dados da conexão para entregar os bytes em ordem ao serviço.", 1, "tcp"),
        ("Entregar à aplicação", "O serviço HTTP interpreta os dados do pedido e pode preparar uma resposta.", 0, "application"),
    ),
}

PATH = (
    ("PC-A", "monta a entrega", "PC-A prepara o frame para o primeiro enlace. O MAC de destino é o da interface de entrada do roteador.", "before"),
    ("Switch A", "encaminha no enlace A", "O switch decide a porta pela tabela MAC. Os endereços do frame, o TTL e as portas TCP deste exemplo permanecem.", "before"),
    ("Roteador", "reconstrói o frame", "O roteador extrai o pacote, escolhe a saída, reduz o TTL de 64 para 63 e atualiza o checksum IPv4. A interface de saída monta outro frame com MACs do segundo enlace e um novo FCS.", "both"),
    ("Switch B", "encaminha no enlace B", "O switch entrega o novo frame ao servidor no segundo enlace. Ele usa a informação Ethernet e não reduz o TTL.", "after"),
    ("Servidor", "recebe a entrega", "O servidor recebe o frame do segundo enlace. O IPv4 de destino e a porta TCP 80 continuam identificando o serviço.", "after"),
)

FRAMES = (
    ("ethernet", "MAC origem", "02:00:00:00:01:10", "02:00:00:00:02:01", True),
    ("ethernet", "MAC destino", "02:00:00:00:01:01", "02:00:00:00:02:20", True),
    ("ethernet", "EtherType", "0x0800 · IPv4", "0x0800 · IPv4", False),
    ("ip", "IPv4 origem → destino", "192.0.2.10 → 198.51.100.20", "192.0.2.10 → 198.51.100.20", False),
    ("ip", "TTL", "64", "63", True),
    ("ip", "Checksum IPv4", "Calculado na origem", "Atualizado após reduzir o TTL", True),
    ("tcp", "Portas TCP", "51514 → 80", "51514 → 80", False),
    ("fcs", "Trailer FCS", "Calculado para o frame A", "Calculado para o frame B", True),
)

PREDICTIONS = (
    ("O switch é trocado por outro no mesmo enlace. Isso muda o TTL?", "O encaminhamento Ethernet do switch preserva o TTL. Um salto roteado reduz o TTL."),
    ("O MAC de destino mudou depois do roteador. O servidor IPv4 também mudou?", "Compare o contexto de cada campo. O MAC identifica quem recebe naquele enlace. Os endereços IP e as portas TCP permanecem no cenário sem NAT."),
    ("A interface detectou um FCS inválido. Os bytes chegam ao serviço?", "A interface descarta o frame com erro. Neste caso, ele não entrega o pacote ao IPv4."),
)


def question(number, title, scenario, prompt, options, correct, explanation, hint):
    return {
        "id": str(number),
        "number": number,
        "title": title,
        "scenario": scenario,
        "prompt": prompt,
        "options": [label for label, _ in options],
        "correct_map": {"conclusao": options[correct][0].lower()},
        "feedback_by_token_slot": {f"conclusao:{label.lower()}": message for label, message in options if message},
        "misconceptions": {"conclusao": title},
        "correct_feedback": explanation,
        "wrong_feedback": "Compare o campo ou a unidade com a etapa do percurso.",
        "hints": [hint],
    }


ACTIVITIES = (
    question(1, "Dados com portas", "O navegador já montou o pedido e TCP acabou de acrescentar as portas.",
             "Qual unidade existe nesse ponto?",
             (("Pacote IPv4", "Para formar o pacote ainda falta o cabeçalho IPv4."),
              ("Segmento TCP", None),
              ("Frame Ethernet", "O frame depende do cabeçalho e trailer Ethernet.")),
             1, "O cabeçalho TCP junto aos dados forma um segmento neste cenário.", "Procure a unidade da camada que acrescentou as portas."),
    question(2, "Para quem vai a próxima entrega?", "Um host envia um pacote por Ethernet ao seu roteador.",
             "Em que parte viaja o endereço da interface Ethernet que vai recebê-lo?",
             (("Cabeçalho TCP", "As portas TCP identificam endpoints da conexão."),
              ("Cabeçalho IPv4", "O IPv4 identifica o destino da entrega IP."),
              ("Cabeçalho Ethernet", None)),
             2, "Destination MAC identifica quem recebe o frame nesse enlace.", "Separe interface de enlace de destino final."),
    question(3, "Monte as unidades", "A aplicação entrega dados ao TCP. A rede usa IPv4 sobre Ethernet.",
             "Qual é a sequência de construção?",
             (("Dados → segmento → pacote → frame", None),
              ("Dados → frame → segmento → pacote", "A interface Ethernet recebe o pacote pronto antes de montar o frame."),
              ("Dados → pacote → frame → segmento", "Os campos TCP acompanham os dados antes de o IPv4 receber o segmento.")),
             0, "Transporte envolve os dados, IPv4 carrega o segmento e Ethernet carrega o pacote.", "Siga a entrega da aplicação em direção ao enlace."),
    question(4, "O trailer", "O cabeçalho Ethernet vem antes do pacote. O FCS detecta erros nos bits do frame.",
             "Onde essa informação de verificação aparece?",
             (("No cabeçalho IPv4", "O checksum IPv4 verifica apenas seu cabeçalho. O FCS pertence à Ethernet."),
              ("Depois da carga Ethernet", None),
              ("No início dos dados HTTP", "O FCS é uma informação do enlace. A aplicação recebe seus próprios dados.")),
             1, "O FCS é um trailer Ethernet e vem ao fim do frame.", "Compare a posição do cabeçalho com a do trailer."),
    question(5, "Escolha o frame de saída", "R1 encaminha por outra interface para um servidor diretamente ligado ao enlace B.",
             "Qual par de MACs é esperado no frame B?",
             (("PC-A → servidor", "O MAC de origem do primeiro enlace não é usado no frame montado por R1."),
              ("PC-A → entrada de R1", "Esse par pertence ao enlace A, que já terminou."),
              ("Saída de R1 → servidor", None)),
             2, "O frame B é uma nova entrega Ethernet da saída de R1 à interface do servidor.", "Identifique quem envia no enlace B."),
    question(6, "Um salto a menos", "Um pacote chega a R1 com TTL 64 e R1 o encaminha uma vez.",
             "Que alteração você espera no cabeçalho IPv4?",
             (("TTL 63 e checksum atualizado", None),
              ("TTL 64 e checksum atualizado", "Um encaminhamento por roteador consome uma unidade do TTL."),
              ("TTL 63 e checksum sem atualização", "Como o TTL integra o cabeçalho IPv4, sua alteração exige atualizar o checksum.")),
             0, "O TTL cai para 63 e a verificação do cabeçalho precisa refletir o novo valor.", "O TTL e o checksum pertencem ao mesmo cabeçalho."),
    question(7, "Conexão através de dois enlaces", "Uma captura vê o pedido antes e depois do roteador. O cenário não usa NAT.",
             "Quais identificadores dos endpoints devem coincidir nas duas capturas?",
             (("MACs e TTL", "Os MACs pertencem a entregas locais diferentes e o TTL diminui no roteador."),
              ("IPs e portas TCP", None),
              ("Somente os MACs", "A troca de enlace muda os MACs. Neste cenário, os endpoints IP e TCP permanecem.")),
             1, "Sem NAT ou alteração de transporte, permanecem os endereços IP e as portas TCP.", "Observe os campos dos endpoints, mesmo quando o frame é reconstruído."),
    question(8, "A evidência do switch", "Dois pontos no mesmo enlace mostram os mesmos MACs e o mesmo TTL. Entre eles há um switch.",
             "O que a observação sustenta?",
             (("O switch cumpriu um salto IP", "Um salto roteado reduziria o TTL. O switch apenas encaminha a entrega local no cenário."),
              ("O serviço HTTP respondeu", "Os campos comparados não mostram uma resposta da aplicação."),
              ("Compatível com encaminhamento Ethernet local", None)),
             2, "A captura é compatível com um switch que encaminha sem alterar o TTL.", "Separe os campos observados de uma conclusão sobre o serviço."),
    question(9, "Da Ethernet ao IPv4", "O servidor recebe um frame íntegro e endereçado à sua interface.",
             "Qual campo indica que a carga entregue pela Ethernet é IPv4?",
             (("EtherType", None),
              ("Porta TCP 80", "O IPv4 entrega ao TCP em uma etapa posterior. A porta é consultada pelo transporte."),
              ("FCS", "O FCS verifica erros. Ele não indica o protocolo da carga.")),
             0, "EtherType 0x0800 identifica IPv4 neste frame Ethernet.", "Procure um identificador de protocolo no cabeçalho Ethernet."),
    question(10, "O pedido chega ao serviço", "O pacote chegou ao IPv4 correto do servidor e contém um segmento TCP.",
             "Como os dados chegam à aplicação HTTP?",
             (("Ethernet interpreta o GET", "Ethernet entrega o pacote conforme o EtherType. O serviço interpreta o pedido."),
              ("TCP usa a conexão e a porta e entrega os bytes ao serviço", None),
              ("O roteador interpreta o pedido", "O roteador encaminha o pacote. Neste cenário, o pedido é interpretado no servidor.")),
             1, "TCP entrega os bytes ao endpoint correto. O serviço HTTP interpreta o conteúdo.", "Separe a entrega dos bytes da interpretação do pedido."),
)

ACTIVITY_MAP = {item["id"]: item for item in ACTIVITIES}
CAPABILITIES = ["Montar e ler unidades de dados", "Distinguir cabeçalho de trailer", "Interpretar o que muda no roteador"]
MISCONCEPTION_LABELS = {item["title"]: item["title"] for item in ACTIVITIES}
