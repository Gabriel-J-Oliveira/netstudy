"""Structured content for the 20-activity ARP practice session."""

STAGES = [("conceito", "Conceito"), ("compreender", "Compreender"), ("diferenciar", "Diferenciar"), ("raciocinar", "Raciocinar"), ("aplicacao", "Aplicação prática"), ("diagnosticar", "Diagnosticar"), ("explicar", "Explicar")]


def option(key, text, feedback, misconception_code=None, kind=None):
    value = {"key": key, "text": text, "feedback": feedback, "misconception_code": misconception_code}
    if kind:
        value["kind"] = kind
    return value


ACTIVITIES = [
    {
        "id": "1", "number": 1, "category": "Relacionar", "stage": "compreender", "difficulty_level": 2,
        "type": "terminal_hotspot", "title": "Qual endereço será realmente usado?",
        "context_lines": ["PC-A", "IPv4: 192.168.10.25/24", "Destino: 192.168.10.80"],
        "terminal_heading": "C:\\> arp -a\n\nInterface: 192.168.10.25 --- 0x8", "terminal_columns": ["Internet Address", "Physical Address"],
        "terminal_rows": [
            [option("ip1", "192.168.10.1", "Esse é o IPv4 do gateway, não o endereço físico usado no frame."), option("mac1", "aa-bb-cc-dd-ee-ff", "Esse MAC pertence ao gateway. Como `192.168.10.80` está na mesma rede local de PC-A, o frame pode ser enviado diretamente ao host de destino.")],
            [option("ip80", "192.168.10.80", "Esse é o endereço IPv4 do destino. Para montar o frame Ethernet local, PC-A precisa utilizar o endereço físico associado a ele."), option("mac80", "11-22-33-44-55-66", "Correto. Como `192.168.10.80` é um destino local, PC-A utiliza no frame o MAC associado diretamente a esse IPv4.")],
            [option("ip90", "192.168.10.90", "Esse IPv4 pertence a outro host da tabela e não é o destino desta comunicação."), option("mac90", "cc-dd-ee-ff-00-11", "Esse endereço físico pertence a outro host da tabela e não ao IPv4 de destino.")],
        ],
        "question": "PC-A vai enviar um frame Ethernet para `192.168.10.80`. Clique no valor que será utilizado como Destination MAC desse frame.", "correct": "mac80",
    },
    {
        "id": "2", "number": 2, "category": "Aplicar", "stage": "compreender", "difficulty_level": 3,
        "type": "pair_match", "title": "Qual MAC cada comunicação precisa?",
        "events": ["PC-A: 192.168.10.10/24 · Gateway: 192.168.10.1", "192.168.10.20 is at BB:BB:BB:BB:BB:BB", "192.168.10.30 is at CC:CC:CC:CC:CC:CC", "192.168.10.1 is at AA:AA:AA:AA:AA:AA"],
        "slots": [{"id": "to20", "label": "Enviar um frame para 192.168.10.20"}, {"id": "to30", "label": "Enviar um frame para 192.168.10.30"}, {"id": "remote", "label": "Iniciar comunicação com 8.8.8.8"}],
        "tokens": [{"id": "mac-a", "text": "AA:AA:AA:AA:AA:AA"}, {"id": "mac-b", "text": "BB:BB:BB:BB:BB:BB"}, {"id": "mac-c", "text": "CC:CC:CC:CC:CC:CC"}],
        "correct_map": {"mac-b": "to20", "mac-c": "to30", "mac-a": "remote"},
        "feedback_by_token_slot": {"mac-b:remote": "O destino final está fora da rede local. O primeiro frame precisa ser entregue ao próximo salto local, não a outro host da LAN.", "mac-c:remote": "O destino final está fora da rede local. O primeiro frame precisa ser entregue ao próximo salto local, não a outro host da LAN."},
        "wrong_feedback": "Relacione cada destino local ao próprio MAC. Para o destino remoto, identifique quem recebe o primeiro frame na LAN.",
        "correct_feedback": "Correto. Para destinos locais, o MAC necessário pertence ao próprio destino. Para o destino remoto, o MAC necessário localmente pertence ao gateway.",
    },
    {
        "id": "3", "number": 3, "category": "Reconstruir", "stage": "compreender", "difficulty_level": 3,
        "type": "token_fill", "title": "Reconstrua a descoberta ARP", "flow_before": "IPv4 do destino conhecido", "flow_lines": ["nenhuma associação útil encontrada", "ARP Reply recebido", "frame Ethernet pode ser endereçado"],
        "slots": [{"id": "cache", "label": "Primeiro passo"}, {"id": "request", "label": "Após não encontrar associação"}, {"id": "learn", "label": "Após receber o Reply"}],
        "tokens": [{"id": "cache", "text": "Consultar ARP Cache"}, {"id": "request", "text": "Enviar ARP Request"}, {"id": "learn", "text": "Aprender IPv4 → MAC"}, {"id": "dns", "text": "Consultar DNS"}, {"id": "tcp", "text": "Escolher porta TCP"}, {"id": "switch", "text": "Consultar tabela MAC do switch"}],
        "correct_map": {"cache": "cache", "request": "request", "learn": "learn"},
        "feedback": {"dns": "O IPv4 já é conhecido. DNS não resolve o endereço físico necessário ao frame.", "tcp": "Portas TCP pertencem ao transporte entre aplicações e não participam da resolução do MAC.", "switch": "Essa estrutura pertence ao switch e relaciona MAC → porta. O host precisa verificar suas próprias associações IPv4 → MAC."},
        "wrong_feedback": "Observe a ordem: verificar o que já é conhecido, iniciar a descoberta e então aprender a associação recebida.",
        "correct_feedback": "Correto. O host primeiro verifica se já possui a associação. Se não possui, inicia a descoberta ARP e aprende o MAC a partir da resposta.",
    },
    {
        "id": "4", "number": 4, "category": "Compreender", "stage": "compreender", "difficulty_level": 3,
        "type": "multiple_choice", "title": "Qual definição continua correta em todos esses casos?", "question": "Qual descrição representa com maior precisão o papel do ARP?", "correct": "B",
        "options": [
            option("A", "ARP descobre o endereço MAC do destino IP final, mesmo quando esse destino está localizado em outra rede.", "Para um destino remoto, o host não resolve diretamente o MAC do destino final. Localmente ele precisa do MAC do próximo salto.", "confuses_remote_host_with_gateway"),
            option("B", "ARP resolve um IPv4 relevante no alcance local para o endereço MAC necessário à entrega Ethernet naquele segmento.", "Correto. ARP resolve um IPv4 relevante localmente para o MAC necessário à entrega Ethernet naquele segmento."),
            option("C", "ARP informa ao switch por qual porta física determinado IPv4 deve ser encaminhado.", "Quem relaciona MAC a porta é a tabela MAC do switch. ARP produz uma associação IPv4 → MAC.", "confuses_arp_with_mac_table"),
            option("D", "ARP só pode ser utilizado quando o IPv4 procurado pertence ao destino final da comunicação.", "ARP também pode ser utilizado para resolver o endereço MAC do gateway, que é um próximo salto e não o destino IP final.", "confuses_remote_host_with_gateway"),
        ],
        "hint": "Pense no que acontece quando o destino final é `8.8.8.8`, mas o primeiro frame precisa ser entregue ao gateway.",
    },
    {
        "id": "5", "number": 5, "category": "Diferenciar", "stage": "diferenciar", "difficulty_level": 3,
        "type": "sort_into_buckets", "title": "Request ou Reply? Leia os indícios",
        "slots": [{"id": "request", "label": "INDÍCIO DE ARP REQUEST", "capacity": "many"}, {"id": "reply", "label": "INDÍCIO DE ARP REPLY", "capacity": "many"}],
        "tokens": [{"id": "block1", "text": "Target IPv4: 192.168.10.80 · Destination MAC: FF:FF:FF:FF:FF:FF"}, {"id": "block2", "text": "Sender IPv4: 192.168.10.80 · Sender MAC: BB:BB:BB:BB:BB:BB"}, {"id": "block3", "text": "“Quem possui 192.168.10.80?”"}, {"id": "block4", "text": "“192.168.10.80 está em BB:BB:BB:BB:BB:BB”"}],
        "correct_map": {"block1": "request", "block3": "request", "block2": "reply", "block4": "reply"},
        "feedback_by_token_slot": {"block1:reply": "O MAC de destino `FF:FF:FF:FF:FF:FF` indica que a mensagem precisa alcançar todos no segmento porque o emissor ainda procura o dispositivo correto.", "block2:request": "Aqui já existe um host declarando seu próprio IPv4 e MAC. Isso caracteriza a informação fornecida em uma resposta."},
        "wrong_feedback": "Leia os indícios: uma pergunta procura a associação; uma resposta declara a associação conhecida.", "correct_feedback": "Correto. O Request revela a necessidade de descoberta; o Reply contém a informação necessária para completar essa descoberta.",
    },
    {
        "id": "6", "number": 6, "category": "Diferenciar", "stage": "diferenciar", "difficulty_level": 3,
        "type": "sort_into_buckets", "title": "Duas tabelas, dois problemas diferentes", "scenario": ["PC-A ───── SW1 ───── PC-B", "PC-B · IPv4: 192.168.10.20 · MAC: BB:BB:BB:BB:BB:BB"],
        "slots": [{"id": "host", "label": "INFORMAÇÃO QUE O HOST UTILIZA"}, {"id": "switch", "label": "INFORMAÇÃO QUE O SWITCH UTILIZA"}],
        "tokens": [{"id": "ipmac", "text": "192.168.10.20 → BB:BB:BB:BB:BB:BB"}, {"id": "macport", "text": "BB:BB:BB:BB:BB:BB → Gi0/7"}], "correct_map": {"ipmac": "host", "macport": "switch"},
        "wrong_feedback": "As duas informações podem participar da mesma comunicação, mas pertencem a estruturas e decisões diferentes.",
        "correct_feedback": "HOST\n“Qual MAC corresponde a 192.168.10.20?”\n\nSWITCH\n“Por qual porta alcanço BB:BB:BB:BB:BB:BB?”\n\nAs duas informações podem participar da mesma comunicação, mas pertencem a estruturas e decisões diferentes.",
    },
    {
        "id": "7", "number": 7, "category": "Reconstruir", "stage": "diferenciar", "difficulty_level": 4,
        "type": "sentence_repair", "title": "Conserte o raciocínio", "incorrect_sentence": "Quando um computador quer acessar um servidor em outra rede, ele usa ARP para descobrir diretamente o MAC desse servidor e então o switch escolhe a rota até ele.",
        "slots": [{"id": "destination", "label": "Tipo de destino"}, {"id": "first-hop", "label": "Quem recebe o primeiro frame"}, {"id": "mechanism", "label": "Mecanismo de descoberta"}, {"id": "resolved", "label": "Endereço físico resolvido"}, {"id": "between-networks", "label": "Encaminha entre redes"}, {"id": "local", "label": "Encaminha frames localmente"}],
        "tokens": [{"id": "remote", "text": "destino remoto"}, {"id": "gateway", "text": "gateway"}, {"id": "arp", "text": "ARP"}, {"id": "next-mac", "text": "MAC do próximo salto"}, {"id": "remote-mac", "text": "MAC do destino remoto"}, {"id": "router", "text": "roteador"}, {"id": "switch", "text": "switch"}],
        "correct_map": {"remote": "destination", "gateway": "first-hop", "arp": "mechanism", "next-mac": "resolved", "router": "between-networks", "switch": "local"},
        "feedback": {"remote-mac": "ARP não procura diretamente o endereço físico de um host fora do alcance local."},
        "feedback_by_token_slot": {"switch:between-networks": "O switch utiliza informações de camada 2 para encaminhar frames. A decisão de encaminhamento entre redes pertence ao roteamento."},
        "wrong_feedback": "Reconstrua separando o destino IP remoto, o próximo salto local e os papéis de switch e roteador.", "correct_feedback": "Correto. O destino IP final pode continuar remoto, enquanto o MAC utilizado no primeiro frame pertence ao próximo salto local.",
        "after": "Quando o destino está em outra rede, o computador envia o frame ao gateway. ARP pode ser usado para descobrir o MAC desse próximo salto local. O switch encaminha frames localmente; ele não escolhe a rota até o destino remoto.",
    },
    {
        "id": "8", "number": 8, "category": "Reconstruir", "stage": "diferenciar", "difficulty_level": 3,
        "type": "ordering", "title": "Coloque os acontecimentos em ordem",
        "items": ["O host envia um ARP Request.", "O host conhece o IPv4 de destino.", "O frame pode ser endereçado ao MAC correto.", "O host consulta sua ARP Cache.", "O dispositivo correto envia um ARP Reply.", "Não existe uma associação útil para aquele IPv4.", "O host aprende a associação IPv4 → MAC."],
        "correct_order": ["O host conhece o IPv4 de destino.", "O host consulta sua ARP Cache.", "Não existe uma associação útil para aquele IPv4.", "O host envia um ARP Request.", "O dispositivo correto envia um ARP Reply.", "O host aprende a associação IPv4 → MAC.", "O frame pode ser endereçado ao MAC correto."],
        "wrong_feedback": "Algumas etapas estão fora de ordem. Pense no que precisa ser conhecido antes de uma pergunta ARP fazer sentido e no que precisa ocorrer antes de o MAC poder ser utilizado.", "hint": "O Request só é necessário depois que o host percebe que ainda não possui a associação necessária.", "correct_feedback": "Correto. O ARP entra justamente entre perceber que o MAC não é conhecido e conseguir utilizar esse MAC no frame.",
    },
    {
        "id": "9", "number": 9, "category": "Aplicar", "stage": "raciocinar", "difficulty_level": 3,
        "type": "topology_hotspot", "title": "Qual dispositivo recebe o frame diretamente?", "topology": "local", "source": "PC-A\n192.168.10.25/24", "context_lines": ["ARP Cache: 192.168.10.1 → AA:AA:AA:AA:AA:AA", "Sem entrada para 192.168.10.80"],
        "question": "PC-A precisa falar com `192.168.10.80`. Clique no dispositivo cujo MAC ainda precisa ser descoberto antes dessa entrega.", "correct": "pc-b",
        "options": [option("switch", "SWITCH", "O switch encaminhará o frame, mas o host não precisa resolver o MAC do switch para endereçar esse frame ao destino."), option("pc-b", "PC-B\n192.168.10.80", "Correto. O destino é local e ainda não existe associação para ele, portanto PC-A precisa resolver o MAC do próprio PC-B."), option("pc-c", "PC-C\n192.168.10.90", "Esse host não possui o IPv4 procurado."), option("gateway", "Gateway\n192.168.10.1", "Embora o MAC do gateway já esteja conhecido, ele não é necessário para essa entrega porque o destino está na mesma rede local.")],
    },
    {
        "id": "10", "number": 10, "category": "Inferir", "stage": "raciocinar", "difficulty_level": 4,
        "type": "topology_hotspot", "title": "O próximo passo ainda é ARP?", "topology": "remote-cache", "context_lines": ["PC-A: 192.168.10.25/24", "Gateway: 192.168.10.1", "Destino: 8.8.8.8"],
        "question": "O destino é remoto, mas observe o ARP Cache. Clique no elemento que já fornece a informação necessária para endereçar o primeiro frame local.", "correct": "cache-gateway",
        "options": [option("pc-a", "PC-A\n192.168.10.25/24", "Esse é o emissor, não a associação que fornece o MAC do próximo salto."), option("switch", "SWITCH", "O switch encaminha o frame, mas sua representação não é uma entrada da ARP Cache do host."), option("gateway", "GATEWAY\n192.168.10.1", "Você identificou corretamente o próximo salto, mas observe que o exercício pergunta onde a informação necessária já está disponível."), option("remote", "INTERNET\n8.8.8.8", "O destino final é remoto. Seu MAC não é necessário ao primeiro frame na LAN.", "confuses_remote_host_with_gateway"), option("cache-gateway", "192.168.10.1 → AA:AA:AA:AA:AA:AA", "Correto. O MAC do próximo salto já está no ARP Cache, portanto PC-A pode utilizar essa associação sem iniciar imediatamente uma nova descoberta ARP.", kind="cache"), option("cache-host", "192.168.10.80 → BB:BB:BB:BB:BB:BB", "Essa associação é de outro host local e não do próximo salto necessário para alcançar `8.8.8.8`.", kind="cache")],
    },
    {
        "id": "11", "number": 11, "category": "Prever", "stage": "raciocinar", "difficulty_level": 4,
        "type": "predict_then_reveal", "title": "Preencha o ARP Request esperado", "config": ["PC-A: 192.168.10.25/24", "Gateway: 192.168.10.1", "Destino final: 8.8.8.8", "ARP Cache: sem entrada para 192.168.10.1"], "question": "Complete os dois campos da solicitação ARP que PC-A enviará.",
        "fields": [{"name": "target", "before": "Who has", "after": "?", "label": "IPv4 procurado"}, {"name": "sender", "before": "Tell", "after": "", "label": "IPv4 do solicitante"}], "correct_fields": {"target": "192.168.10.1", "sender": "192.168.10.25"},
        "feedback_fields": {"target:8.8.8.8": "O destino IP final está em outra rede. ARP precisa resolver o próximo salto local, não o host remoto.", "sender:192.168.10.1": "O campo `Tell` identifica quem está solicitando a resolução. Neste cenário, quem está fazendo a pergunta é PC-A."},
        "wrong_feedback": "Revise quem receberá o primeiro frame local e quem está fazendo a pergunta.", "hint": "Pergunte: “quem receberá o primeiro frame local?” e “quem está fazendo a pergunta?”.", "reveal": "Who has 192.168.10.1?\nTell 192.168.10.25", "correct_feedback": "Correto. O destino IP final continua sendo `8.8.8.8`, mas a resolução ARP local ocorre para o gateway.",
    },
    {
        "id": "12", "number": 12, "category": "Prever", "stage": "raciocinar", "difficulty_level": 3,
        "type": "event_selection_order", "title": "Precisa perguntar de novo?", "scenario": ["PC-A", "192.168.10.25", "ARP CACHE", "192.168.10.80 → BB:BB:BB:BB:BB:BB"], "situation": "PC-A precisa enviar outro frame para `192.168.10.80` enquanto essa entrada ainda está disponível.", "instruction": "Selecione somente os eventos necessários agora e coloque-os na ordem correta.",
        "events": ["Enviar um novo ARP Request", "Usar a associação já presente no cache", "Receber um novo ARP Reply", "Endereçar o frame usando BB:BB:BB:BB:BB:BB"], "correct_order": ["Usar a associação já presente no cache", "Endereçar o frame usando BB:BB:BB:BB:BB:BB"],
        "feedback": {"Enviar um novo ARP Request": "A associação necessária já está disponível. Neste cenário não há motivo para iniciar imediatamente uma nova descoberta ARP.", "Receber um novo ARP Reply": "Um novo Reply depende de uma nova solicitação. A entrada já conhecida pode ser utilizada diretamente."}, "correct_feedback": "Correto. O cache evita repetir imediatamente uma descoberta que já foi realizada.",
    },
    {
        "id": "13", "number": 13, "category": "Aplicar", "stage": "aplicacao", "difficulty_level": 1,
        "type": "command_fill", "title": "Consulte o ARP Cache", "context": "Você está em um computador Windows e quer visualizar as associações ARP atualmente conhecidas.", "prompt_before": "C:\\> arp ", "correct": "-a", "feedback": {"-d": "`arp -d` está relacionado à exclusão de entradas. Neste caso queremos exibir as associações existentes.", "a": "A letra está correta, mas precisa ser utilizada como parâmetro com hífen.", "other": "Esse parâmetro não corresponde à consulta solicitada."}, "hint": "O parâmetro começa com hífen e utiliza a letra associada a “all”.", "correct_feedback": "Correto. `arp -a` permite visualizar as associações ARP conhecidas pelo sistema.",
    },
    {
        "id": "14", "number": 14, "category": "Interpretar", "stage": "aplicacao", "difficulty_level": 4,
        "type": "terminal_hotspot", "title": "Qual associação permite iniciar essa comunicação?", "row_hotspot": True, "context_lines": ["PC-A · IPv4: 192.168.10.25/24", "Gateway: 192.168.10.1", "Destino final: 8.8.8.8"], "terminal_heading": "C:\\> arp -a\n\nInterface: 192.168.10.25 --- 0x8", "terminal_columns": ["Internet Address", "Physical Address"],
        "terminal_rows": [[option("row1", "192.168.10.1 → aa-bb-cc-dd-ee-ff", "Correto. O destino final é `8.8.8.8`, mas o primeiro frame Ethernet precisa ser entregue ao gateway `192.168.10.1`. Portanto, a associação relevante é a do gateway.")], [option("row50", "192.168.10.50 → 44-55-66-77-88-99", "Essa associação pertence a outro host local e não ao próximo salto utilizado para alcançar o destino remoto.")], [option("row80", "192.168.10.80 → 11-22-33-44-55-66", "Essa entrada também representa outro host local. O destino final está fora da rede e precisa ser entregue primeiro ao gateway.")]], "question": "Antes de qualquer tráfego para `8.8.8.8` sair da rede local, qual associação desta tabela permite endereçar o primeiro frame Ethernet? Clique na linha correta.", "correct": "row1",
    },
    {
        "id": "15", "number": 15, "category": "Inferir", "stage": "aplicacao", "difficulty_level": 4,
        "type": "compare_outputs", "title": "O que não apareceu — e por quê?", "context_lines": ["PC-A: 192.168.10.25/24", "Gateway: 192.168.10.1"],
        "question": "Nenhuma entrada `8.8.8.8 → MAC` apareceu depois do ping. Isso é incompatível com o comportamento esperado do ARP?",
        "before": "C:\\> arp -a\n\nInternet Address      Physical Address\n192.168.10.1          aa-bb-cc-dd-ee-ff", "between": "C:\\> ping 8.8.8.8", "after_text": "C:\\> arp -a\n\nInternet Address      Physical Address\n192.168.10.1          aa-bb-cc-dd-ee-ff",
        "options": [option("incompatible", "É incompatível", "A ausência de uma entrada para o destino remoto não significa que o ARP falhou. Pense em qual dispositivo recebe o primeiro frame Ethernet quando o destino está em outra rede."), option("expected", "É esperado", "Correto. `8.8.8.8` é remoto. O host precisa do MAC do gateway, cuja associação já estava presente. Não existe motivo para aprender diretamente o MAC de `8.8.8.8`.")], "correct": "expected",
    },
    {
        "id": "16", "number": 16, "category": "Aplicar", "stage": "aplicacao", "difficulty_level": 3,
        "type": "table_builder", "title": "Construa somente o que pertence ao ARP Cache", "unordered": True,
        "events": ["1. 192.168.10.20 is at BB:BB:BB:BB:BB:BB", "2. 192.168.10.30 is at CC:CC:CC:CC:CC:CC", "3. BB:BB:BB:BB:BB:BB is reachable through Gi0/7", "4. server01.local resolved to 192.168.10.50", "5. 192.168.10.1 is at AA:AA:AA:AA:AA:AA"],
        "slots": [{"id": "row1", "label": "Entrada ARP 1"}, {"id": "row2", "label": "Entrada ARP 2"}, {"id": "row3", "label": "Entrada ARP 3"}],
        "tokens": [{"id": "arp20", "text": "192.168.10.20 → BB:BB:BB:BB:BB:BB"}, {"id": "arp30", "text": "192.168.10.30 → CC:CC:CC:CC:CC:CC"}, {"id": "macport", "text": "BB:BB:BB:BB:BB:BB → Gi0/7"}, {"id": "dns", "text": "server01.local → 192.168.10.50"}, {"id": "arp1", "text": "192.168.10.1 → AA:AA:AA:AA:AA:AA"}],
        "correct_tokens": ["arp20", "arp30", "arp1"], "correct_map": {"arp20": "row1", "arp30": "row2", "arp1": "row3"},
        "feedback": {"macport": "Essa informação pertence ao raciocínio de uma tabela MAC de switch, não a uma ARP Cache.", "dns": "Essa é uma relação nome → IPv4, relacionada à resolução de nomes e não ao ARP."}, "wrong_feedback": "Mantenha somente relações em que um IPv4 está associado a um endereço MAC.", "correct_feedback": "Correto. Você filtrou as evidências e manteve apenas associações IPv4 → MAC.",
    },
    {
        "id": "17", "number": 17, "category": "Inferir", "stage": "diagnosticar", "difficulty_level": 4,
        "type": "find_inconsistency", "title": "Qual entrada merece suspeita?", "heading": "ARP CACHE", "context_lines": ["Host: 192.168.10.25/24", "Gateway: 192.168.10.1"], "question": "Considerando como ARP é utilizado pelo host neste cenário, clique na entrada que merece maior suspeita conceitual.", "correct": "remote",
        "options": [option("gateway", "192.168.10.1 → AA:AA:AA:AA:AA:AA", "Esse IPv4 pertence à rede local apresentada, portanto uma associação direta IPv4 → MAC é compatível com o uso de ARP."), option("twenty", "192.168.10.20 → BB:BB:BB:BB:BB:BB", "Esse IPv4 pertence à rede local apresentada, portanto uma associação direta IPv4 → MAC é compatível com o uso de ARP."), option("remote", "8.8.8.8 → CC:CC:CC:CC:CC:CC", "Correto. `8.8.8.8` está fora da rede local. O host normalmente precisaria resolver o MAC do gateway, não obter diretamente o MAC do destino remoto.", "confuses_remote_host_with_gateway"), option("eighty", "192.168.10.80 → DD:DD:DD:DD:DD:DD", "Esse IPv4 pertence à rede local apresentada, portanto uma associação direta IPv4 → MAC é compatível com o uso de ARP.")], "after": "O objetivo aqui é raciocinar sobre o alcance local do ARP, não assumir detalhes de implementações excepcionais fora do escopo desta aula.",
    },
    {
        "id": "18", "number": 18, "category": "Diagnosticar", "stage": "diagnosticar", "difficulty_level": 4,
        "type": "evidence_sort", "title": "Não adivinhe a causa", "scenario": ["PC01: 192.168.10.20/24", "PC02: 192.168.10.30/24"], "capture": "Who has 192.168.10.30? Tell 192.168.10.20\nWho has 192.168.10.30? Tell 192.168.10.20\nWho has 192.168.10.30? Tell 192.168.10.20", "capture_note": "Nenhum ARP Reply correspondente foi observado durante a captura.",
        "slots": [{"id": "evidence", "label": "EVIDÊNCIA", "capacity": "many"}, {"id": "hypothesis", "label": "HIPÓTESE", "capacity": "many"}], "tokens": [{"id": "requests", "text": "PC01 está enviando ARP Requests."}, {"id": "no-reply", "text": "Nenhum ARP Reply foi observado."}, {"id": "not-complete", "text": "A resolução ARP não está sendo concluída nesse momento."}, {"id": "off", "text": "PC02 está desligado."}, {"id": "cable", "text": "O cabo de PC02 está desconectado."}, {"id": "switch", "text": "O switch está com defeito."}],
        "correct_map": {"requests": "evidence", "no-reply": "evidence", "not-complete": "evidence", "off": "hypothesis", "cable": "hypothesis", "switch": "hypothesis"}, "feedback_by_slot": {"evidence": "Essa causa poderia produzir o sintoma, mas os dados apresentados não demonstram que ela realmente esteja ocorrendo.", "hypothesis": "Essa informação pode ser observada diretamente nos dados apresentados; não é apenas uma possibilidade."}, "correct_feedback": "Correto. Diagnóstico técnico começa separando aquilo que conseguimos demonstrar daquilo que ainda precisa ser investigado.",
    },
    {
        "id": "19", "number": 19, "category": "Diagnosticar", "stage": "diagnosticar", "difficulty_level": 5,
        "type": "diagnostic_map", "title": "Construa sua conclusão técnica", "scenario": ["PC01: 192.168.10.20/24", "PC02: 192.168.10.30/24", "ARP Requests repetidos", "Nenhum ARP Reply observado", "DNS configurado: 8.8.8.8", "Gateway: 192.168.10.1", "Uso de CPU do PC01: 4%", "Link local do PC01: ativo"],
        "slots": [{"id": "observed", "label": "O QUE OBSERVEI"}, {"id": "unknown", "label": "O QUE NÃO POSSO AFIRMAR AINDA"}, {"id": "investigate", "label": "ONDE INVESTIGARIA PRIMEIRO"}],
        "tokens": [{"id": "resolution", "text": "A resolução ARP para 192.168.10.30 não está sendo concluída."}, {"id": "off", "text": "PC02 está definitivamente desligado."}, {"id": "local", "text": "Comunicação local entre PC01 e PC02 / camada 2 e disponibilidade do host."}, {"id": "dns", "text": "DNS externo."}, {"id": "cpu", "text": "Uso de CPU do PC01."}, {"id": "nat", "text": "NAT de saída para Internet."}, {"id": "tcp", "text": "Existe necessariamente uma falha TCP."}],
        "correct_map": {"resolution": "observed", "off": "unknown", "local": "investigate"}, "feedback": {"dns": "A comunicação utiliza diretamente endereços IPv4 da mesma rede. A configuração DNS apresentada não explica a evidência ARP observada.", "cpu": "O uso de CPU apresentado não fornece relação causal com a ausência de ARP Reply neste cenário.", "nat": "NAT não é necessário para esta comunicação local entre hosts da mesma rede.", "tcp": "Ainda estamos observando uma dificuldade anterior a qualquer evidência de sessão TCP.", "off": "Essa é uma possível explicação, não uma conclusão demonstrada."},
        "wrong_feedback": "Escolha apenas afirmações sustentadas pelas evidências e uma investigação coerente com a comunicação local.", "correct_feedback": "Correto. Parte do diagnóstico é também saber ignorar informações que não explicam as evidências observadas.", "after": "Bom diagnóstico não significa saber a causa imediatamente. Significa saber exatamente o que já pode e ainda não pode ser afirmado.",
    },
    {
        "id": "20", "number": 20, "category": "Explicar", "stage": "explicar", "difficulty_level": 4,
        "type": "concept_map_builder", "title": "Construa os dois caminhos",
        "scenarios": [{"id": "local", "title": "CENÁRIO A — DESTINO LOCAL", "lines": ["PC-A: 192.168.10.25/24", "Destino: 192.168.10.80"]}, {"id": "remote", "title": "CENÁRIO B — DESTINO REMOTO", "lines": ["PC-A: 192.168.10.25/24", "Gateway: 192.168.10.1", "Destino: 8.8.8.8"]}],
        "slots": [{"id": "local-final", "label": "Destino IP final", "group": "local"}, {"id": "local-arp", "label": "IPv4 que será resolvido via ARP", "group": "local"}, {"id": "local-mac", "label": "MAC necessário ao frame local", "group": "local"}, {"id": "remote-final", "label": "Destino IP final", "group": "remote"}, {"id": "remote-arp", "label": "IPv4 que será resolvido via ARP", "group": "remote"}, {"id": "remote-mac", "label": "MAC necessário ao frame local", "group": "remote"}],
        "tokens": [{"id": "local80-final", "text": "192.168.10.80", "group": "local"}, {"id": "local80-arp", "text": "192.168.10.80", "group": "local"}, {"id": "local1", "text": "192.168.10.1", "group": "local"}, {"id": "local-mac80", "text": "MAC de 192.168.10.80", "group": "local"}, {"id": "local-gw", "text": "MAC do gateway", "group": "local"}, {"id": "remote8", "text": "8.8.8.8", "group": "remote"}, {"id": "remote1", "text": "192.168.10.1", "group": "remote"}, {"id": "remote-mac8", "text": "MAC de 8.8.8.8", "group": "remote"}, {"id": "remote-gw", "text": "MAC do gateway", "group": "remote"}],
        "correct_map": {"local80-final": "local-final", "local80-arp": "local-arp", "local-mac80": "local-mac", "remote8": "remote-final", "remote1": "remote-arp", "remote-gw": "remote-mac"},
        "feedback_by_token_slot": {"remote-mac8:remote-mac": "O destino IP final permanece `8.8.8.8`, mas o primeiro frame Ethernet não é entregue diretamente a esse host. O MAC local necessário pertence ao próximo salto.", "remote1:remote-final": "O gateway é o próximo salto local, mas não substitui o destino IP final da comunicação."}, "wrong_feedback": "Compare separadamente o destino IP final, o IPv4 resolvido via ARP e o MAC usado no primeiro frame.",
        "correct_feedback": "DESTINO LOCAL\nIPv4 final\n↓\nARP pelo próprio destino\n↓\nMAC do destino\n\nDESTINO REMOTO\nIPv4 final continua remoto\n↓\npróximo salto = gateway\n↓\nARP pelo gateway\n↓\nMAC do gateway\n\nCorreto. Esta é uma das distinções mais importantes para entender ARP: o destino IP final e o destino Ethernet do primeiro frame não precisam representar o mesmo dispositivo.",
        "free_question": "Explique com suas próprias palavras por que, ao acessar um destino remoto, o endereço IP final pode continuar sendo o servidor remoto enquanto o MAC utilizado no primeiro frame pertence ao gateway.", "reference": "O endereço IP identifica o destino final da comunicação entre redes. Como esse destino não está na LAN, o host precisa entregar o primeiro frame ao próximo salto local, normalmente o gateway. Por isso, ARP é usado para descobrir o MAC do gateway, enquanto o endereço IP de destino continua representando o host remoto.",
    },
]

ACTIVITY_MAP = {activity["id"]: activity for activity in ACTIVITIES}
CAPABILITIES = ["Reconhecer", "Relacionar", "Reconstruir", "Prever", "Interpretar", "Aplicar", "Diagnosticar", "Explicar"]
MISCONCEPTION_LABELS = {"confuses_arp_with_dns": "ARP × DNS", "confuses_arp_with_routing": "ARP × roteamento", "confuses_arp_with_transport": "ARP × transporte", "confuses_arp_with_mac_table": "ARP × tabela MAC", "confuses_remote_host_with_gateway": "Destino remoto × gateway"}
