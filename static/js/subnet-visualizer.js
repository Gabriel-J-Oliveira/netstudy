(() => {
  "use strict";

  const visualizers = {};
  const toInt = (ip) => ip.split(".").reduce((value, octet) => ((value << 8) | Number(octet)) >>> 0, 0);
  const toIp = (value) => [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");
  const maskInt = (prefix) => prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const maskFromPrefix = (prefix) => toIp(maskInt(prefix));
  const isValidIp = (ip) => /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && ip.split(".").every((part) => Number(part) >= 0 && Number(part) <= 255);

  function calculate(hostIp, prefix, destinationIp = "") {
    prefix = Number(prefix);
    if (!isValidIp(hostIp) || prefix < 8 || prefix > 28) throw new Error("Configuração IPv4 fora do escopo desta aula.");
    const host = toInt(hostIp), mask = maskInt(prefix), network = (host & mask) >>> 0;
    const total = 2 ** (32 - prefix), broadcast = (network + total - 1) >>> 0;
    const result = {
      hostIp, prefix, mask: maskFromPrefix(prefix), network: toIp(network), broadcast: toIp(broadcast),
      first: toIp(network + 1), last: toIp(broadcast - 1), total, usable: total - 2,
      blockSize: prefix >= 24 ? 2 ** (32 - prefix) : 256,
      networkBits: prefix, hostBits: 32 - prefix,
    };
    if (destinationIp && isValidIp(destinationIp)) {
      const destinationNetwork = (toInt(destinationIp) & mask) >>> 0;
      result.destinationIp = destinationIp;
      result.destinationNetwork = toIp(destinationNetwork);
      result.local = destinationNetwork === network;
    }
    return result;
  }

  class SubnetVisualizer {
    constructor(root) {
      this.root = root;
      this.id = root.dataset.visualizerId || `subnet-${Object.keys(visualizers).length + 1}`;
      this.config = { hostIp: root.dataset.hostIp, prefix: Number(root.dataset.prefix), destinationIp: root.dataset.destinationIp || "", gateway: root.dataset.gateway || "" };
      this.render();
    }
    setConfig(next) { Object.assign(this.config, next); this.render(); }
    set(selector, value) { const node = this.root.querySelector(selector); if (node) node.textContent = value; }
    renderBoundary(result) {
      const octets = result.hostIp.split(".");
      const wholeNetworkOctets = Math.floor(result.prefix / 8);
      this.root.querySelector("[data-ip-boundary]").innerHTML = octets.map((octet, index) => {
        const role = index < wholeNetworkOctets ? "network" : index > wholeNetworkOctets || result.prefix % 8 === 0 ? "host" : "mixed";
        return `<span class="octet octet-${role}"><b>${octet}</b><small>${role === "network" ? "REDE" : role === "host" ? "HOST" : "REDE + HOST"}</small></span>${index < 3 ? '<i>.</i>' : ''}`;
      }).join("");
    }
    renderRuler(result) {
      const ruler = this.root.querySelector("[data-subnet-ruler]");
      if (result.prefix < 24) { ruler.innerHTML = `<span class="ruler-note">/${result.prefix}: o limite de rede está antes do último octeto.</span>`; return; }
      const size = result.blockSize, hostLast = Number(result.hostIp.split(".")[3]);
      ruler.innerHTML = Array.from({length: 256 / size}, (_, index) => {
        const start = index * size, end = start + size - 1, active = hostLast >= start && hostLast <= end;
        const label = `Bloco de endereços ${start} até ${end}. ${active ? `O endereço ${hostLast} está neste bloco.` : `Bloco do prefixo ${result.prefix}.`}`;
        return `<button type="button" class="subnet-block ${active ? "is-active" : ""}" aria-label="${label}" data-subnet-block="${start}"><b>${start}–${end}</b><small>${active ? `← ${hostLast} está aqui` : `bloco /${result.prefix}`}</small></button>`;
      }).join("");
      ruler.querySelectorAll("[data-subnet-block]").forEach((block) => block.addEventListener("click", () => {
        ruler.querySelectorAll("[data-subnet-block]").forEach((item) => item.classList.toggle("is-focused", item === block));
      }));
    }
    render() {
      const result = calculate(this.config.hostIp, this.config.prefix, this.config.destinationIp);
      this.result = result;
      this.set("[data-subnet-heading]", `${result.hostIp}/${result.prefix}`);
      this.set("[data-network-address]", `${result.network}/${result.prefix}`);
      this.set("[data-broadcast-address]", result.broadcast);
      this.set("[data-first-host]", result.first);
      this.set("[data-last-host]", result.last);
      this.set("[data-total-addresses]", result.total);
      this.set("[data-usable-hosts]", result.usable);
      this.set("[data-subnet-mask]", result.mask);
      this.set("[data-block-size]", `${result.blockSize} endereços`);
      this.renderBoundary(result); this.renderRuler(result);
      const binary = result.mask.split(".").map((octet) => Number(octet).toString(2).padStart(8, "0")).join(".");
      this.set("[data-binary-mask]", binary);
      this.set("[data-binary-meaning]", `${result.networkBits} bits de rede · ${result.hostBits} bits de host · 2^${result.hostBits} = ${result.total} endereços.`);
      const verdict = this.root.querySelector("[data-destination-verdict]");
      verdict.hidden = !result.destinationIp;
      if (result.destinationIp) {
        this.set("[data-destination-value]", result.destinationIp);
        this.set("[data-local-remote]", result.local ? "LOCAL" : "REMOTO");
        this.set("[data-destination-network]", result.local ? `Mesma rede: ${result.network}/${result.prefix}` : `Rede do destino: ${result.destinationNetwork}/${result.prefix}`);
        verdict.dataset.verdict = result.local ? "local" : "remote";
      }
    }
  }

  function init(scope = document) {
    scope.querySelectorAll("[data-subnet-visualizer]").forEach((root) => {
      if (root.dataset.subnetReady) return;
      root.dataset.subnetReady = "true";
      const visualizer = new SubnetVisualizer(root);
      visualizers[visualizer.id] = visualizer;
      root.subnetVisualizer = visualizer;
    });
    return visualizers;
  }

  window.NetStudySubnet = { calculate, maskFromPrefix, SubnetVisualizer, visualizers, init };
  init();
})();
