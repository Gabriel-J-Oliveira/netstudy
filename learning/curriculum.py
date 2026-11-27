"""Sequência pedagógica e metadados de apresentação das aulas."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Lesson:
    key: str
    route: str
    title: str
    exercise: str
    checkpoint: str
    introduction: str
    objective: str
    prerequisites: tuple[str, ...]
    bridge: str


LESSONS = (
    Lesson("OSI", "osi_concept", "Modelo OSI e TCP/IP", "ipv4", "osi-checkpoint",
           "Comece com uma ação familiar: abrir uma página. O pedido passa por várias funções até chegar ao servidor.",
           "Relacionar as camadas dos dois modelos às responsabilidades de uma comunicação.", (),
           "A entrega local começa entre interfaces. Em seguida, veja como a Ethernet usa um endereço para identificá-las."),
    Lesson("MAC", "mac_concept", "MAC Address", "vlan-access", "mac-checkpoint",
           "No modelo em camadas, o enlace faz a entrega local. A Ethernet usa endereços MAC para indicar quais interfaces participam dessa entrega.",
           "Identificar o MAC de origem e o de destino em uma entrega Ethernet.", ("OSI",),
           "Com os dois endereços em mãos, veja onde colocá-los na estrutura enviada pela Ethernet."),
    Lesson("FRAME", "frame_concept", "Frame Ethernet", "vlan-access", "frame-checkpoint",
           "Você já conhece os endereços MAC. Agora veja como eles viajam junto aos dados em um frame, a unidade de entrega da Ethernet.",
           "Interpretar os campos de um frame e acompanhar sua montagem com os MACs fornecidos.", ("MAC",),
           "O frame já leva um endereço de destino. O switch precisa decidir por qual porta encaminhá-lo."),
    Lesson("SWITCH", "switch_concept", "Switch Ethernet", "vlan-access", "switch-checkpoint",
           "O frame tem MACs de origem e destino. O switch usa esses campos para aprender de onde veio a entrega e decidir para onde ela segue.",
           "Distinguir o aprendizado pelo MAC de origem da decisão baseada no MAC de destino.", ("MAC", "FRAME"),
           "O switch pode usar uma porta ou várias. A seguir, compare esse alcance com a intenção indicada pelo endereço de destino."),
    Lesson("DELIVERY", "delivery_concept", "Unicast e Broadcast", "vlan-access", "delivery-checkpoint",
           "Você já viu o switch aprender portas e encaminhar frames. Compare agora uma entrega a um destinatário com uma entrega a todos no domínio local.",
           "Distinguir unicast, flooding de destino desconhecido e broadcast.", ("FRAME", "SWITCH"),
           "A Ethernet descreve o alcance local. Para decidir se um destino IP está nessa rede, o host precisa interpretar seus endereços com a máscara."),
    Lesson("IPV4", "ipv4_concept", "IPv4 e Sub-redes", "ipv4", "ipv4-checkpoint",
           "O MAC identifica a entrega no enlace. O IPv4 e a máscara dão ao host outra informação: se o destino faz parte da sua sub-rede.",
           "Usar o prefixo IPv4 para distinguir destinos locais e remotos.", ("MAC", "DELIVERY"),
           "Quando o IPv4 indica um destino local, ainda falta descobrir qual MAC colocar no frame. Esse é o problema que o ARP resolve."),
    Lesson("ARP", "concept", "ARP", "ipv4", "arp-checkpoint",
           "Você já sabe identificar um IPv4 local, ler o destino MAC de um frame e prever quem recebe um broadcast. O ARP junta essas peças para descobrir o MAC que falta.",
           "Acompanhar a solicitação em broadcast, a resposta e o uso da associação IPv4–MAC no frame.", ("MAC", "FRAME", "DELIVERY", "IPV4"),
           "A solicitação ARP só alcança seu domínio de broadcast. Veja como VLANs delimitam domínios diferentes nos mesmos switches."),
    Lesson("VLAN", "vlan_concept", "VLAN", "vlan-access", "vlan-checkpoint",
           "O switch pode espalhar um broadcast pelo domínio local. Uma VLAN define quais portas pertencem a esse domínio.",
           "Prever o alcance do broadcast e a entrega entre portas Access.", ("SWITCH", "DELIVERY", "ARP"),
           "Uma VLAN pode precisar ocupar mais de um switch. A seguir, veja como um único enlace mantém as VLANs identificadas."),
    Lesson("TRUNK", "trunk_concept", "Trunk 802.1Q", "trunk-8021q", "trunk-checkpoint",
           "VLANs separam domínios de broadcast. No enlace entre switches, a identificação 802.1Q ajuda a manter essa separação.",
           "Seguir frames de várias VLANs por um trunk e interpretar as VLANs permitidas.", ("FRAME", "VLAN"),
           "O trunk estende a entrega de uma VLAN. Quando o destino IP está em outra rede, o host precisa escolher um primeiro salto local."),
    Lesson("GATEWAY", "gateway_concept", "Default Gateway", "routing", "gateway-checkpoint",
           "A máscara permite reconhecer um destino remoto. Para o primeiro frame, o host usa ARP para descobrir o MAC do próximo salto local.",
           "Distinguir o destino IPv4 final do MAC usado para alcançar o gateway.", ("IPV4", "ARP"),
           "Depois de receber o frame, o roteador precisa escolher um caminho para o pacote. A tabela de rotas orienta essa decisão."),
    Lesson("ROUTES", "route_concept", "Tabela de Rotas", "static-routing", "route-checkpoint",
           "O gateway recebe o primeiro frame. Para continuar a entrega, consulta o IPv4 de destino na tabela de rotas.",
           "Selecionar a rota de prefixo mais longo e interpretar sua saída e seu próximo salto.", ("IPV4", "GATEWAY"),
           "Com essa decisão de saída, um roteador pode ligar duas redes associadas a VLANs diferentes."),
    Lesson("INTERVLAN", "inter_vlan_concept", "Inter-VLAN Routing", "routing", "inter-vlan-checkpoint",
           "As VLANs delimitam a entrega local. Gateway e tabela de rotas permitem levar um pacote de uma rede VLAN à outra.",
           "Acompanhar a decisão do roteador e os frames locais usados em cada VLAN.", ("VLAN", "GATEWAY", "ROUTES"),
           "Você já pode prever os saltos de um pacote. Agora use respostas ICMP para observar o caminho e testar alcançabilidade."),
    Lesson("ICMP", "icmp_concept", "ICMP, Ping e Traceroute", "external-routing", "icmp-checkpoint",
           "As rotas definem o caminho do pacote. Ping e traceroute ajudam a observar respostas do destino e de alguns saltos intermediários.",
           "Interpretar respostas ICMP, TTL e os limites dos testes de diagnóstico.", ("IPV4", "ROUTES", "INTERVLAN"),
           "Um ping pode responder enquanto um serviço falha. A seguir, veja os mecanismos que transportam dados entre aplicações."),
    Lesson("TRANSPORT", "transport_concept", "TCP e UDP", "services", "transport-checkpoint",
           "O roteamento leva pacotes entre redes, e o ICMP ajuda a observar esse alcance. Aplicações precisam também de um modo de trocar seus dados.",
           "Comparar fluxo de bytes, datagramas e o comportamento de TCP e UDP diante de perda.", ("OSI", "ICMP"),
           "TCP e UDP chegam ao host de destino. As portas ajudam a selecionar o serviço que deve receber os dados."),
    Lesson("PORTS", "ports_concept", "Portas e Cliente/Servidor", "services", "ports-checkpoint",
           "TCP e UDP transportam dados. Os números de porta identificam os endpoints usados pelo cliente e pelo serviço.",
           "Interpretar como protocolo, IP e portas identificam os dois lados de uma troca.", ("IPV4", "TRANSPORT"),
           "Um cliente precisa de configuração de rede para usar esses serviços. Veja como o DHCP começa essa troca mesmo antes de o cliente ter um IPv4."),
    Lesson("DHCP", "dhcp_concept", "DHCP", "services", "dhcp-checkpoint",
           "Um cliente recém-conectado pode usar um frame em broadcast e portas UDP conhecidas para encontrar um servidor que forneça sua configuração IPv4.",
           "Acompanhar Discover, Offer, Request e ACK e interpretar a configuração recebida.", ("DELIVERY", "IPV4", "GATEWAY", "TRANSPORT", "PORTS"),
           "Entre as opções recebidas por DHCP pode estar o endereço de um resolvedor. A última aula mostra como o cliente usa esse endereço para consultar nomes."),
    Lesson("DNS", "dns_concept", "DNS", "services", "dns-checkpoint",
           "O DHCP pode informar qual resolvedor usar. O cliente consulta esse servidor por nome antes de tentar alcançar o serviço da aplicação.",
           "Distinguir resolução de nomes, conectividade IP e disponibilidade do serviço.", ("DHCP", "PORTS", "ICMP"),
           "Você percorreu da entrega Ethernet aos serviços de aplicação. Em Praticar, combine essas evidências para diagnosticar uma comunicação."),
)

LESSONS_BY_KEY = {lesson.key: lesson for lesson in LESSONS}
