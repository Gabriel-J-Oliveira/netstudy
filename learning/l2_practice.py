"""L2-02: avaliação curta e determinística, independente da bancada e checkpoints.

O contrato de resposta v1 é:
{classification, lookup, action, egress: [porta], received: [host], accepted: [host]}.
Somente IDs e estados verificados são persistidos na sessão Django; não há gabarito
no estado salvo nem integração com Attempt Schema v1.
"""

from dataclasses import dataclass


ACTIVITY_ID = "l2-02"
SCHEMA_VERSION = 1
INGRESS = "gi0/1"
PORT_HOSTS = {"gi0/2": "pc-c", "gi0/4": "pc-b", "gi0/6": "pc-d"}
HOST_MACS = {"pc-b": "BB:BB:BB:BB:BB:BB", "pc-c": "CC:CC:CC:CC:CC:CC", "pc-d": "DD:DD:DD:DD:DD:DD"}
ALL_PORTS = (INGRESS, *PORT_HOSTS)
ALL_HOSTS = tuple(HOST_MACS)


@dataclass(frozen=True)
class Scenario:
    id: str
    destination: str
    mac_table: tuple[tuple[str, str], ...]
    success_feedback: str


SCENARIOS = (
    Scenario("known", HOST_MACS["pc-b"], ((HOST_MACS["pc-b"], "gi0/4"),),
             "O Destination identifica PC-B e a tabela aponta Gi0/4. O switch usa uma única saída; PC-B recebe e aceita."),
    Scenario("unknown", HOST_MACS["pc-d"], ((HOST_MACS["pc-b"], "gi0/4"), (HOST_MACS["pc-c"], "gi0/2")),
             "O Destination continua unicast. Sem entrada para DD, o switch replica nas outras portas; só PC-D aceita."),
    Scenario("broadcast", "FF:FF:FF:FF:FF:FF",
             ((HOST_MACS["pc-b"], "gi0/4"), (HOST_MACS["pc-c"], "gi0/2"), (HOST_MACS["pc-d"], "gi0/6")),
             "O Destination é broadcast. O switch replica nas outras portas e todos os hosts deste domínio local aceitam."),
)
SCENARIO_BY_ID = {scenario.id: scenario for scenario in SCENARIOS}
ANSWER_FIELDS = frozenset({"classification", "lookup", "action", "egress", "received", "accepted"})


def _choice(value, allowed):
    return isinstance(value, str) and value in allowed


def _ids(value, allowed):
    return (isinstance(value, list)
            and all(isinstance(item, str) and item in allowed for item in value)
            and len(value) == len(set(value)))


def expected_result(scenario_id):
    """Calcula a decisão a partir do frame, tabela e portas, sem dados da UI."""
    if not isinstance(scenario_id, str) or scenario_id not in SCENARIO_BY_ID:
        raise ValueError("Cenário L2-02 desconhecido.")
    scenario = SCENARIO_BY_ID[scenario_id]
    broadcast = scenario.destination == "FF:FF:FF:FF:FF:FF"
    learned = dict(scenario.mac_table).get(scenario.destination) if not broadcast else None
    egress = (learned,) if learned else tuple(PORT_HOSTS)
    received = tuple(PORT_HOSTS[port] for port in egress)
    accepted = tuple(host for host in received if broadcast or HOST_MACS[host] == scenario.destination)
    return {
        "classification": "broadcast" if broadcast else "unicast",
        "lookup": "not_needed" if broadcast else "known" if learned else "unknown",
        "action": "single" if learned else "replicate",
        "egress": egress,
        "received": received,
        "accepted": accepted,
    }


def evaluate(scenario_id, answer):
    """Retorna feedback por decisão; resposta inválida lança ValueError."""
    expected = expected_result(scenario_id)
    if (not isinstance(answer, dict) or set(answer) != ANSWER_FIELDS or
            not _choice(answer["classification"], {"unicast", "broadcast"}) or
            not _choice(answer["lookup"], {"known", "unknown", "not_needed"}) or
            not _choice(answer["action"], {"single", "replicate"}) or
            not _ids(answer["egress"], ALL_PORTS) or
            not _ids(answer["received"], ALL_HOSTS) or
            not _ids(answer["accepted"], ALL_HOSTS)):
        raise ValueError("Resposta L2-02 inválida; revise os campos e selecione apenas portas e hosts apresentados.")

    feedback = []
    def add(field, code, message):
        feedback.append({"field": field, "code": code, "message": message})

    if answer["classification"] != expected["classification"]:
        if scenario_id == "unknown":
            add("classification", "unknown_is_unicast", "DD identifica um receptor específico. A ausência de DD na tabela muda a ação do switch, não o tipo do frame.")
        elif scenario_id == "broadcast":
            add("classification", "broadcast_destination", "FF:FF:FF:FF:FF:FF é o Destination MAC de broadcast; não identifica um único host.")
        else:
            add("classification", "specific_destination", "BB identifica um receptor específico; consulte o próprio Destination MAC antes de contar saídas.")
    if answer["lookup"] != expected["lookup"]:
        if scenario_id == "broadcast":
            add("lookup", "broadcast_no_lookup", "Broadcast não exige encontrar uma associação individual MAC → porta.")
        else:
            add("lookup", "read_table", "Confira se o Destination MAC deste frame aparece no extrato da tabela MAC.")
    if answer["action"] != expected["action"]:
        if scenario_id == "known":
            add("action", "known_direct", "Uma entrada para o Destination permite escolher uma única saída; replicar não é necessário.")
        else:
            add("action", "replication", "Sem saída individual aplicável, o switch replica o frame nas outras portas conectadas deste domínio.")
    if set(answer["egress"]) != set(expected["egress"]):
        if INGRESS in answer["egress"]:
            add("egress", "ingress_port", "Gi0/1 é a porta de entrada: o switch não devolve uma cópia por ela.")
        else:
            add("egress", "egress_ports", "Compare Destination e tabela antes de marcar as saídas. Considere somente portas conectadas, exceto a entrada.")
    if set(answer["received"]) != set(expected["received"]):
        add("received", "delivery_vs_receipt", "Marque os hosts conectados às portas de saída que você previu. Receber uma cópia ainda não significa aceitá-la.")
    if set(answer["accepted"]) != set(expected["accepted"]):
        if not set(answer["accepted"]).issubset(answer["received"]):
            add("accepted", "cannot_accept_unreceived", "Um host não pode aceitar um frame que não recebeu.")
        elif scenario_id == "unknown":
            add("accepted", "flood_not_broadcast", "No flooding, vários hosts recebem cópias; cada um compara o Destination com o próprio MAC. Isso não torna o frame broadcast.")
        elif scenario_id == "broadcast":
            add("accepted", "broadcast_acceptance", "Neste domínio local, todos os hosts que recebem o Destination de broadcast o aceitam.")
        else:
            add("accepted", "specific_acceptance", "Um Destination MAC específico é aceito pelo host correspondente, não por todos os conectados.")
    return {
        "correct": not feedback,
        "feedback": feedback,
        "summary": SCENARIO_BY_ID[scenario_id].success_feedback if not feedback else "Revise as decisões destacadas e verifique novamente.",
    }


def validate_progress(value):
    """Contrato mínimo de sessão: v1 e IDs de cenários efetivamente verificados."""
    if (not isinstance(value, dict) or set(value) != {"schema_version", "verified"} or
            value["schema_version"] != SCHEMA_VERSION or not isinstance(value["verified"], list) or
            any(not isinstance(item, str) or item not in SCENARIO_BY_ID for item in value["verified"]) or
            len(value["verified"]) != len(set(value["verified"]))):
        raise ValueError("Progresso L2-02 incompatível; os dados existentes não foram sobrescritos.")
    return {"schema_version": SCHEMA_VERSION, "verified": list(value["verified"])}


def empty_progress():
    return {"schema_version": SCHEMA_VERSION, "verified": []}
