from urllib.parse import urlencode

from django import template
from django.urls import reverse

register = template.Library()

# Presentation links only: exercise generation and validation remain in the engine.
LESSONS = (
    ("ARP", "concept", "ARP", "ipv4", "arp-checkpoint"),
    ("MAC", "mac_concept", "MAC Address", "vlan-access", "mac-checkpoint"),
    ("FRAME", "frame_concept", "Frame Ethernet", "vlan-access", "frame-checkpoint"),
    ("SWITCH", "switch_concept", "Switch Ethernet", "vlan-access", "switch-checkpoint"),
    ("DELIVERY", "delivery_concept", "Unicast e Broadcast", "vlan-access", "delivery-checkpoint"),
    ("VLAN", "vlan_concept", "VLAN", "vlan-access", "vlan-checkpoint"),
    ("TRUNK", "trunk_concept", "Trunk 802.1Q", "trunk-8021q", "trunk-checkpoint"),
    ("IPV4", "ipv4_concept", "IPv4 e Sub-rede", "ipv4", "ipv4-checkpoint"),
    ("GATEWAY", "gateway_concept", "Default Gateway", "routing", "gateway-checkpoint"),
    ("ROUTES", "route_concept", "Tabela de Rotas", "static-routing", "route-checkpoint"),
    ("INTERVLAN", "inter_vlan_concept", "Inter-VLAN Routing", "routing", "inter-vlan-checkpoint"),
    ("ICMP", "icmp_concept", "ICMP, Ping e Traceroute", "external-routing", "icmp-checkpoint"),
    ("TRANSPORT", "transport_concept", "TCP e UDP", "services", "transport-checkpoint"),
    ("PORTS", "ports_concept", "Portas e Cliente/Servidor", "services", "ports-checkpoint"),
    ("DNS", "dns_concept", "DNS", "services", "dns-checkpoint"),
    ("DHCP", "dhcp_concept", "DHCP", "services", "dhcp-checkpoint"),
)


@register.inclusion_tag("learning/partials/journey_navigation.html", takes_context=True)
def journey_navigation(context):
    request = context["request"]
    topic = context.get("current_topic")
    name = request.resolver_match.url_name
    area = "learn"
    if name == "home":
        area = "home"
    elif name in (
        "practice", "troubleshooting", "external_labs_catalog", "external_lab_detail",
        "activity", "completion", "mac_activity", "mac_completion", "mac_activities",
        "rapid_fire_intro", "rapid_fire_item", "rapid_fire_completion",
    ):
        area = "practice"
    elif name == "integrated_lab":
        area = "practice" if request.GET.get("exercise") else "lab"
    result = {"area": area}
    for index, lesson in enumerate(LESSONS):
        if lesson[0] != topic:
            continue
        result["lesson"] = lesson[2]
        result["checkpoint_url"] = reverse("learning:" + lesson[1]) + "#" + lesson[4]
        result["exercise_url"] = reverse("learning:integrated_lab") + "?" + urlencode({
            "exercise": lesson[3], "difficulty": "intermediate", "mode": "bench",
        })
        for key, offset in (("previous", -1), ("next", 1)):
            if 0 <= index + offset < len(LESSONS):
                neighbor = LESSONS[index + offset]
                result[key] = {"url": reverse("learning:" + neighbor[1]), "title": neighbor[2]}
        break
    if name == "integrated_lab" and request.GET.get("exercise"):
        result["exercise_context"] = reverse("learning:integrated_lab") + "?" + urlencode({
            key: request.GET[key] for key in ("exercise", "difficulty", "mode", "seed") if key in request.GET
        })
    return result
