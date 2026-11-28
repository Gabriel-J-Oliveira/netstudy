"""Teaching content for the network loops lesson."""

TERMS = [
    ("redundancy", "Redundância", "Caminhos adicionais oferecem alternativas quando um enlace falha."),
    ("l2-loop", "Loop de camada 2", "Caminho circular que pode devolver frames a switches já percorridos."),
    ("flooding", "Flooding", "Replicação por portas elegíveis, exceto a porta de entrada."),
    ("storm", "Broadcast Storm", "Volume excessivo de broadcasts ocupando enlaces e recursos."),
    ("flapping", "MAC Flapping", "Aprendizado do mesmo MAC em portas diferentes em intervalos próximos."),
    ("saturation", "Saturação", "Uso de um enlace próximo de sua capacidade disponível."),
    ("ttl", "TTL", "Campo IPv4 reduzido por roteadores. Um frame Ethernet não possui TTL."),
    ("convergence", "Convergência", "Tempo para a rede estabilizar depois de uma mudança."),
    ("bpdu", "BPDU", "Mensagem de controle que switches trocam para compartilhar informações usadas pelo STP."),
    ("stp", "STP", "Spanning Tree Protocol: organiza caminhos redundantes em uma árvore lógica sem ciclos ativos de encaminhamento."),
    ("bridge-id", "Bridge ID", "Identificador composto pela prioridade da bridge e seu endereço MAC; o menor vence a eleição da raiz."),
    ("root-bridge", "Root Bridge", "Switch de referência da árvore lógica do STP, eleito pelo menor Bridge ID."),
    ("root-path-cost", "Root Path Cost", "Soma dos custos dos enlaces no caminho conhecido até a Root Bridge."),
    ("root-port", "Root Port", "Porta de cada switch não raiz que oferece o melhor caminho até a Root Bridge."),
    ("designated-port", "Designated Port", "Porta que encaminha no segmento, escolhida pela melhor informação de caminho até a raiz."),
    ("blocking", "Blocking", "Estado sem encaminhamento de dados de usuário; a porta continua recebendo BPDUs."),
    ("listening", "Listening", "Estado transitório do STP clássico em que a porta participa da topologia, mas ainda não aprende MACs nem encaminha dados."),
    ("learning", "Learning", "Estado transitório do STP clássico em que a porta aprende MACs, mas ainda não encaminha dados."),
    ("forwarding", "Forwarding", "Estado em que a porta encaminha tráfego de usuário."),
    ("reconvergence", "Reconvergência", "Reorganização da árvore lógica após falha ou mudança na topologia."),
]

# Each option has its own explanation so an incorrect prediction teaches the
# distinction being assessed without revealing the correct choice in advance.
QUESTIONS = [
    {"prompt": "O switch recebe broadcast por Gi0/1. Por qual porta não envia uma cópia?", "options": ["Gi0/1, a entrada", "Todas as saídas"], "correct": 0, "feedback": ["Correto. A porta de entrada é excluída do flooding.", "O switch não devolve a cópia pela mesma interface em que o frame entrou."]},
    {"prompt": "SW1, SW2 e SW3 estão ligados em triângulo. Que estrutura os enlaces formam?", "options": ["Caminho circular", "Árvore sem ciclos"], "correct": 0, "feedback": ["Correto. O terceiro enlace fecha o caminho circular.", "Com três enlaces entre os três switches, existe um ciclo."]},
    {"prompt": "Uma cópia volta ao switch por outra interface. Ela pode ser replicada de novo?", "options": ["Sim", "Não, a porta usada na primeira entrada fica bloqueada para sempre"], "correct": 0, "feedback": ["Correto. A exclusão se aplica à interface por onde cada recepção ocorreu.", "A exclusão da porta de entrada vale para aquela recepção, não para todo o percurso anterior."]},
    {"prompt": "O frame Ethernet possui TTL para encerrar sua circulação?", "options": ["Não", "Sim, igual ao IPv4"], "correct": 0, "feedback": ["Correto. O frame Ethernet não tem TTL.", "TTL pertence ao cabeçalho IPv4 e não encerra a circulação de um frame Ethernet."]},
    {"prompt": "A tabela aprende o mesmo MAC ora em Gi0/1, ora em Gi0/3. Qual evidência isso descreve?", "options": ["MAC Flapping", "TTL expirado"], "correct": 0, "feedback": ["Correto. O mesmo MAC aparece associado a portas diferentes em intervalos próximos.", "TTL não é uma entrada de tabela MAC. A associação de porta está mudando."]},
    {"prompt": "Loop de camada 2 e Broadcast Storm são...", "options": ["Relacionados, mas diferentes", "Sinônimos"], "correct": 0, "feedback": ["Correto. Um descreve o caminho; o outro, o volume excessivo de tráfego broadcast.", "Um loop pode favorecer uma tempestade, mas os termos descrevem coisas diferentes."]},
    {"prompt": "Após fechar o ciclo, há cópias repetidas e tráfego crescente. O que as evidências sustentam?", "options": ["Sinais compatíveis com loop e storm", "Que o STP falhou com certeza"], "correct": 0, "feedback": ["Correto. Os sinais são compatíveis, mas não provam por si só a causa raiz.", "Os dados observados não bastam para concluir que o STP falhou."]},
    {"prompt": "Nesta topologia triangular, desconectar uma aresta do ciclo faz o quê?", "options": ["Interrompe esse ciclo", "Protege contra qualquer outra falha"], "correct": 0, "feedback": ["Correto. Remover uma aresta rompe este caminho circular.", "A mudança rompe este ciclo, mas não garante proteção contra toda falha possível."]},
    {"prompt": "Ao fazer flooding, o switch envia uma cópia pela interface de entrada?", "options": ["Não", "Sempre"], "correct": 0, "feedback": ["Correto. A interface de entrada fica excluída dessa replicação.", "Flooding replica por portas elegíveis, exceto a porta de entrada."]},
    {"prompt": "Qual protocolo controla caminhos redundantes para evitar ciclos ativos de Camada 2?", "options": ["STP", "Aumentar o TTL do frame Ethernet"], "correct": 0, "feedback": ["Correto. O STP organiza os enlaces redundantes em uma árvore lógica sem ciclos ativos.", "Ethernet não possui TTL. O STP controla quais portas encaminham dados."]},
    {"prompt": "Três switches têm prioridade 32768. Qual vence se seus endereços MAC forem SW1 ...:01, SW2 ...:02 e SW3 ...:03?", "options": ["SW1, por ter o menor MAC entre prioridades iguais", "SW3, por ter o maior número"], "correct": 0, "feedback": ["Correto. Com prioridade igual, o menor endereço MAC desempata o Bridge ID.", "O STP não escolhe pelo número do nome. Com a prioridade empatada, compara o MAC no Bridge ID."]},
    {"prompt": "SW3 tem prioridade 0 e os outros switches 32768. Qual será a Root Bridge?", "options": ["SW3", "SW1, porque está no primeiro ramo"], "correct": 0, "feedback": ["Correto. A prioridade menor produz o Bridge ID menor nesta comparação.", "A posição no desenho não define a raiz; o STP compara Bridge IDs."]},
    {"prompt": "O caminho direto até a raiz custa 20. O caminho por outro switch custa 4 + 4. Qual caminho tem menor Root Path Cost?", "options": ["O caminho de custo 8", "O caminho direto de custo 20"], "correct": 0, "feedback": ["Correto. O Root Path Cost soma os custos dos enlaces do caminho.", "O STP compara a soma dos custos, não apenas se o caminho é direto."]},
    {"prompt": "Em um switch que não é raiz, qual porta se torna Root Port?", "options": ["A porta que oferece o melhor caminho até a Root Bridge", "A porta de maior custo"], "correct": 0, "feedback": ["Correto. Cada switch não raiz seleciona uma Root Port pelo melhor caminho até a raiz.", "Um custo maior não é preferido; o caminho de menor custo vence, com critérios de desempate."]},
    {"prompt": "Em cada segmento, para que serve a Designated Port?", "options": ["Representar o melhor caminho daquele segmento em direção à raiz e encaminhar", "Bloquear todos os BPDUs"], "correct": 0, "feedback": ["Correto. A Designated Port é escolhida pela melhor informação de caminho no segmento.", "Portas STP trocam BPDUs; a Designated Port encaminha tráfego de dados quando está em Forwarding."]},
    {"prompt": "Uma porta está em Blocking e o cabo continua conectado. O que isso indica?", "options": ["A porta não encaminha dados de usuário, mas continua recebendo BPDUs", "O cabo foi removido e a interface está desconectada"], "correct": 0, "feedback": ["Correto. Blocking é um estado lógico da porta; ela continua participando da prevenção de loops via BPDUs.", "Cabo desconectado é uma falha física. Uma porta em Blocking permanece conectada."]},
    {"prompt": "Qual sequência representa a transição clássica de uma porta para encaminhamento após a decisão do STP?", "options": ["Listening → Learning → Forwarding", "Forwarding → Blocking → Disabled"], "correct": 0, "feedback": ["Correto. No STP clássico, a porta passa por Listening e Learning antes de Forwarding.", "Essa sequência não representa a transição de uma porta selecionada para encaminhar."]},
    {"prompt": "Um enlace ativo falha e existe um caminho redundante anteriormente bloqueado. O que ocorre no STP clássico?", "options": ["A árvore é recalculada e a porta pode transitar até Forwarding; a recuperação não é instantânea", "A porta bloqueada encaminha dados imediatamente sem transição"], "correct": 0, "feedback": ["Correto. A mudança exige reconvergência e estados transitórios no STP clássico.", "A porta não deve pular diretamente de Blocking para encaminhamento instantâneo no STP clássico."]},
    {"prompt": "Por que uma porta Blocking continua recebendo BPDUs?", "options": ["Para continuar acompanhando informações STP e perceber mudanças na topologia", "Para encaminhar broadcasts de usuário pela porta bloqueada"], "correct": 0, "feedback": ["Correto. BPDUs mantêm a participação da porta no controle da topologia.", "Blocking impede encaminhamento de dados de usuário; receber BPDUs não significa encaminhar broadcasts."]},
]

# Balance the correct position while keeping each generated lesson version
# deterministic. The order is intentionally not the same for every item.
_correct_positions = [0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1]
for _question, _target in zip(QUESTIONS, _correct_positions):
    if _question["correct"] != _target:
        _question["options"][0], _question["options"][1] = _question["options"][1], _question["options"][0]
        _question["feedback"][0], _question["feedback"][1] = _question["feedback"][1], _question["feedback"][0]
        _question["correct"] = _target

# Keep each lesson's checkpoint in its own namespace. The first nine items
# assess loops/storm; the remaining original items assess the transferred STP
# demonstration and retain their original order and feedback.
LOOP_QUESTIONS = QUESTIONS[:9]
SPANNING_TREE_QUESTIONS = QUESTIONS[9:] + [
    {"prompt": "Na RSTP, um enlace alternativo válido pode assumir o papel de encaminhamento após uma falha sem percorrer os temporizadores clássicos?", "options": ["Sim, a porta Alternate pode substituir a Root Port", "Não, toda recuperação precisa repetir Listening e Learning"], "correct": 0, "feedback": ["Correto. A RSTP mantém uma alternativa identificada e pode acelerar a transição; o tempo real depende da topologia e da negociação.", "A sequência clássica não descreve todas as transições rápidas da RSTP." ]},
    {"prompt": "Em uma troca RSTP ponto a ponto, o que expressam Proposal e Agreement?", "options": ["Uma negociação de sincronização para transição rápida", "Uma confirmação de que o frame de dados chegou ao host"], "correct": 0, "feedback": ["Correto. São flags de BPDUs usadas na negociação de transição rápida.", "Essas mensagens são de controle STP, não confirmação de entrega de dados ao host."]},
    {"prompt": "Que estado RSTP corresponde ao bloqueio de encaminhamento de dados enquanto a porta participa do protocolo?", "options": ["Discarding", "Listening"], "correct": 0, "feedback": ["Correto. Discarding não encaminha dados de usuário; a nomenclatura pode aparecer como Blocking em implementações compatíveis.", "Listening é um estado transitório do STP clássico, não um dos três estados RSTP usados aqui."]},
    {"prompt": "Duas VLANs são mapeadas para a mesma instância MST. Isso exige uma árvore independente para cada VLAN?", "options": ["Não; VLANs mapeadas podem compartilhar uma instância", "Sim; cada VLAN precisa de uma instância exclusiva"], "correct": 0, "feedback": ["Correto. O mapeamento MST permite que várias VLANs compartilhem uma instância e sua árvore.", "MSTP não exige uma instância independente para cada VLAN."]},
    {"prompt": "A mesma porta encaminha na instância 1 e fica bloqueada na instância 2. Isso é possível?", "options": ["Sim, os papéis e estados são por instância", "Não, uma porta tem um único estado para toda a rede"], "correct": 0, "feedback": ["Correto. MSTP pode calcular árvores diferentes por instância.", "O estado da porta pode diferir entre instâncias MST."]},
    {"prompt": "Em uma porta de borda com BPDU Guard, chega uma BPDU inesperada. Qual é a reação representada nesta implementação Cisco?", "options": ["A porta é colocada em err-disabled", "A porta vira Root Port automaticamente"], "correct": 0, "feedback": ["Correto. Na representação Cisco, BPDU Guard desativa a porta protegida até recuperação/reabilitação conforme a configuração.", "BPDU Guard não promove a porta a Root Port."]},
    {"prompt": "Uma BPDU superior chega em uma interface com Root Guard. Qual resultado é esperado no modelo Cisco?", "options": ["A interface entra em root-inconsistent e a raiz não muda por esse segmento", "O novo switch torna-se raiz imediatamente"], "correct": 0, "feedback": ["Correto. Root Guard mantém a porta em estado inconsistente enquanto a condição persiste.", "Root Guard protege o segmento contra a aceitação dessa informação superior."]},
    {"prompt": "Uma porta não-designada deixa de receber BPDUs e Loop Guard está ativo. Qual comportamento a proteção busca evitar?", "options": ["Que a porta passe indevidamente a encaminhar", "Que o switch aprenda endereços MAC de origem"], "correct": 0, "feedback": ["Correto. Loop Guard evita uma transição indevida para encaminhamento quando BPDUs esperadas deixam de chegar.", "A proteção trata a continuidade de informações STP, não o aprendizado MAC comum."]},
]
LOOP_TERMS = TERMS[:8]
SPANNING_TREE_TERMS = TERMS[8:] + [
    ("rstp", "RSTP", "Rapid Spanning Tree Protocol, que pode acelerar mudanças de topologia por papéis e mecanismos de transição rápida."),
    ("alternate-port", "Alternate Port", "Porta que oferece um caminho alternativo até a raiz e pode assumir o encaminhamento após uma falha."),
    ("proposal-agreement", "Proposal / Agreement", "Flags de BPDUs usadas para negociar sincronização e transições rápidas em enlaces compatíveis."),
    ("mstp", "MSTP", "Multiple Spanning Tree Protocol: mapeia grupos de VLANs a instâncias de árvores lógicas."),
    ("msti", "MST Instance", "Instância que calcula uma árvore para o conjunto de VLANs associado a ela."),
    ("cist", "CIST", "Common and Internal Spanning Tree: estrutura comum que conecta a região MST ao restante da topologia compatível."),
    ("edge-port", "Edge Port / PortFast", "Configuração para uma porta voltada a um dispositivo final iniciar encaminhamento rapidamente; não deve ser aplicada indiscriminadamente a enlaces entre switches."),
    ("bpdu-guard", "BPDU Guard", "Proteção que reage à recepção inesperada de BPDU em uma porta de borda; a ação e o estado exibido dependem da plataforma."),
    ("root-guard", "Root Guard", "Proteção que impede informação superior de STP de tornar a porta protegida um caminho para uma nova raiz."),
    ("loop-guard", "Loop Guard", "Proteção que evita que uma porta não designada passe indevidamente a encaminhar quando BPDUs esperadas deixam de chegar."),
]
